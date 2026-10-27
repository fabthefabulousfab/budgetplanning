const test = require('node:test');
const assert = require('node:assert');
const store = require('../../js/store.js');
const sv = require('../../js/sauvegarde.js');
const { project } = require('../../js/projection.js');
const { detailHistorique, detailMois } = require('../../js/summary.js');
const T = require('../../js/tables-logic.js');

function fakeDir(initial) {
  const files = new Map(Object.entries(initial || {}));
  return {
    files,
    async getFileHandle(name, opts) {
      if (!files.has(name)) {
        if (!(opts && opts.create)) { const e = new Error('absent'); e.name = 'NotFoundError'; throw e; }
        files.set(name, '');
      }
      return {
        async getFile() { return { async text() { return files.get(name); } }; },
        async createWritable() {
          let buf = '';
          return { async write(s) { buf += s; }, async close() { files.set(name, buf); } };
        },
      };
    },
  };
}

// Ancien format : revenus et dépenses cochés « revalorise », taux global 3 % en janvier.
const ANCIEN = [
  'situation: {compte_courant: 100, epargne: 50}',
  'mensuel:',
  '  - {type: revenu, categorie: Salaire, libelle: Paie fictive, montant: 2000, revalorise: true}',
  '  - {type: revenu, categorie: Salaire, libelle: Prime fictive, montant: 300, revalorise: false}',
  '  - {type: depense, categorie: Logement, libelle: Loyer fictif, montant: 700, revalorise: true}',
  'annuel:',
  '  - {type: revenu, categorie: Prime, libelle: Treizieme fictif, echeances: "11:1000", revalorise: true}',
  'exceptionnel: []',
  '',
].join('\n');
const EVENEMENTS = '- {id: e1, type: revenu, categorie: Revenu, libelle: Bourse fictive, montant: "200", debut: "2026-10", fin: null, revalorise: true}\n';
const PARAMS = 'depart: "2026-10"\nhorizon_annees: 10\nrevalorisation: {taux: 0.03, mois: 1}\n';
const PALIERS = 'paliers:\n  - ligne: {nature: mensuel, type: revenu, categorie: Salaire, libelle: Paie fictive}\n    etapes: [{depuis: "2027-06", montant: 2500}]\n';

// Référence indépendante : l'ancien moteur (case unique, taux global).
function referenceAncienne(montant, ym, tauxGlobal) {
  const passages = Number(ym.slice(0, 4)) - 2026; // revalorisation chaque janvier, départ 2026-10
  return montant * Math.pow(1 + tauxGlobal, passages);
}

test('migration: un ancien fichier donne exactement les memes chiffres qu avant', async () => {
  const d = fakeDir({ 'donnees-courantes.yaml': ANCIEN, 'evenements-futurs.yaml': EVENEMENTS, 'parametres.yaml': PARAMS, 'paliers.yaml': PALIERS });
  const r = await store.loadAll(d);
  const paie = r.donnees.mensuel[0];
  assert.ok(Math.abs(paie.taux_revalorisation - 3) < 1e-12);
  assert.ok(!('revalorise' in paie));
  assert.ok(!('taux_revalorisation' in r.donnees.mensuel[1]), 'revalorise false: pas de taux');
  assert.strictEqual(r.donnees.mensuel[2].revalorise, true, 'depense inchangee');
  assert.ok(!('taux_revalorisation' in r.donnees.mensuel[2]));
  assert.ok(Math.abs(r.donnees.annuel[0].taux_revalorisation - 3) < 1e-12);
  assert.ok(Math.abs(r.evenements[0].taux_revalorisation - 3) < 1e-12);

  const mois = project(r.donnees, r.evenements, r.parametres);
  const m = (k) => mois.find((x) => x.ym === k);
  // 2027-01 : paie (palier en 2027-06 : 2000 avant) + prime 300 + bourse 200 revalorisees une fois
  const attendu2027_01 = referenceAncienne(2000, '2027-01', 0.03) + 300 + referenceAncienne(200, '2027-01', 0.03);
  assert.ok(Math.abs(m('2027-01').revenus - attendu2027_01) < 1e-9);
  // palier : 2500 revalorise une fois en 2027-06, deux fois en 2028-06
  assert.ok(Math.abs(m('2027-06').revenus - (referenceAncienne(2500, '2027-06', 0.03) + 300 + referenceAncienne(200, '2027-06', 0.03))) < 1e-9);
  assert.ok(Math.abs(m('2028-06').revenus - (referenceAncienne(2500, '2028-06', 0.03) + 300 + referenceAncienne(200, '2028-06', 0.03))) < 1e-9);
  assert.ok(Math.abs(m('2027-11').revenus - (referenceAncienne(2500, '2027-11', 0.03) + 300 + referenceAncienne(200, '2027-11', 0.03) + referenceAncienne(1000, '2027-11', 0.03))) < 1e-9);
  assert.ok(Math.abs(m('2027-01').depenses - referenceAncienne(700, '2027-01', 0.03)) < 1e-9);

  // le detail (infobulle, CSV) suit exactement project()
  const rows = detailHistorique(r.donnees, r.evenements, r.parametres);
  mois.forEach((x) => {
    const s = rows.filter((l) => l.ym === x.ym).reduce((a, l) => a + l.montant, 0);
    assert.ok(Math.abs(s - x.net) < 1e-6, x.ym);
    assert.ok(Math.abs(detailMois(r.donnees, r.evenements, r.parametres, x.ym).net - x.net) < 1e-6, x.ym);
  });
});

test('migration: un changement ulterieur d inflation ne modifie plus les revenus', async () => {
  const d = fakeDir({ 'donnees-courantes.yaml': ANCIEN, 'parametres.yaml': PARAMS });
  const r = await store.loadAll(d);
  await store.saveDonnees(d, r.donnees);
  await store.saveParametres(d, Object.assign({}, r.parametres, { revalorisation: { taux: 0.05, mois: 1 } }));
  const r2 = await store.loadAll(d);
  assert.ok(Math.abs(r2.donnees.mensuel[0].taux_revalorisation - 3) < 1e-12);
  const j = project(r2.donnees, [], r2.parametres).find((x) => x.ym === '2027-01');
  assert.ok(Math.abs(j.revenus - (2000 * 1.03 + 300)) < 1e-9);
  assert.ok(Math.abs(j.depenses - 700 * 1.05) < 1e-9, 'la depense suit la nouvelle inflation');
});

test('migration: signale ce qui a ete migre ; un fichier deja au nouveau format n est pas touche', async () => {
  const r = await store.loadAll(fakeDir({ 'donnees-courantes.yaml': ANCIEN, 'evenements-futurs.yaml': EVENEMENTS, 'parametres.yaml': PARAMS }));
  assert.deepStrictEqual(r.migres, { donnees: true, evenements: true });
  const neuf = 'mensuel:\n  - {type: revenu, categorie: A, libelle: x, montant: 10, taux_revalorisation: 1.5}\n  - {type: depense, categorie: A, libelle: y, montant: 10, revalorise: true}\n';
  const r2 = await store.loadAll(fakeDir({ 'donnees-courantes.yaml': neuf, 'parametres.yaml': PARAMS }));
  assert.deepStrictEqual(r2.migres, { donnees: false, evenements: false });
  assert.strictEqual(r2.donnees.mensuel[0].taux_revalorisation, 1.5);
});

test('migration: un taux de ligne deja present l emporte sur l ancienne case', async () => {
  const d = 'mensuel:\n  - {type: revenu, categorie: A, libelle: x, montant: 10, revalorise: true, taux_revalorisation: 1.5}\n';
  const r = await store.loadAll(fakeDir({ 'donnees-courantes.yaml': d, 'parametres.yaml': PARAMS }));
  assert.strictEqual(r.donnees.mensuel[0].taux_revalorisation, 1.5);
  assert.ok(!('revalorise' in r.donnees.mensuel[0]));
});

test('ecriture: revalorise n est plus ecrit pour un revenu, conserve pour une depense', async () => {
  const d = fakeDir({ 'donnees-courantes.yaml': ANCIEN, 'parametres.yaml': PARAMS });
  const r = await store.loadAll(d);
  r.donnees.mensuel[1].revalorise = true; // reste d'une manipulation : ne doit pas etre ecrit
  await store.saveDonnees(d, r.donnees);
  const txt = d.files.get('donnees-courantes.yaml');
  assert.match(txt, /taux_revalorisation: 3/);
  const revenus = txt.split('- type:').filter((b) => /^ ?revenu/.test(b));
  revenus.forEach((b) => assert.ok(!/revalorise:/.test(b.replace(/taux_revalorisation/g, '')), b));
  assert.match(txt, /libelle: Loyer fictif\n\s+montant: 700\n\s+revalorise: true/);
  const evs = fakeDir();
  await store.saveEvenements(evs, [{ id: 'e1', type: 'revenu', categorie: 'Revenu', libelle: 'b', montant: '200', taux_revalorisation: 2, revalorise: true }]);
  assert.ok(!/ revalorise:/.test(evs.files.get('evenements-futurs.yaml')));
});

test('ecriture: l objet en memoire n est pas modifie par l ecriture', async () => {
  const d = fakeDir();
  const donnees = { mensuel: [{ type: 'revenu', categorie: 'A', libelle: 'x', montant: 10, taux_revalorisation: 2, revalorise: true }], annuel: [], exceptionnel: [] };
  await store.saveDonnees(d, donnees);
  assert.strictEqual(donnees.mensuel[0].revalorise, true);
});

test('validation: taux_revalorisation accepte nombre, negatif, zero, null', () => {
  const ok = { type: 'revenu', categorie: 'A', libelle: 'x', montant: 1000 };
  [1.5, -2, 0, null, undefined, 100].forEach((v) => store.validerLigne(Object.assign({}, ok, { taux_revalorisation: v }), 'mensuel'));
});

test('validation: taux_revalorisation texte ou decimale a virgule refuse avec un message clair', () => {
  const ok = { type: 'revenu', categorie: 'A', libelle: 'x', montant: 1000 };
  ['abc', '1,5', '1.5', true, NaN, Infinity, -100, -250].forEach((v) => {
    assert.throws(() => store.validerLigne(Object.assign({}, ok, { taux_revalorisation: v }), 'mensuel'), /taux_revalorisation/, String(v));
  });
  assert.throws(() => store.validerLigne(Object.assign({}, ok, { taux_revalorisation: '1,5' }), 'mensuel'), /1,5/);
});

test('validation: une depense avec taux_revalorisation est refusee (fichier nomme)', async () => {
  const dep = { type: 'depense', categorie: 'A', libelle: 'x', montant: 10 };
  assert.throws(() => store.validerLigne(Object.assign({}, dep, { taux_revalorisation: 2 }), 'mensuel'), /taux_revalorisation.*revenus/);
  const d = fakeDir({ 'donnees-courantes.yaml': 'mensuel:\n  - {type: depense, categorie: A, libelle: x, montant: 10, taux_revalorisation: 2}\n' });
  await assert.rejects(store.loadAll(d), /donnees-courantes\.yaml.*mensuel #1.*taux_revalorisation/);
  const ev = fakeDir({ 'evenements-futurs.yaml': '- {id: e1, type: depense, categorie: Achat, libelle: x, montant: "100", taux_revalorisation: 2}\n' });
  await assert.rejects(store.loadAll(ev), /evenements-futurs\.yaml.*taux_revalorisation/);
});

test('validation: fichier invalide jamais ecrase', async () => {
  const bad = 'mensuel:\n  - {type: revenu, categorie: A, libelle: x, montant: 10, taux_revalorisation: "1,5"}\n';
  const d = fakeDir({ 'donnees-courantes.yaml': bad });
  await assert.rejects(store.loadAll(d), /donnees-courantes\.yaml.*taux_revalorisation/);
  assert.strictEqual(d.files.get('donnees-courantes.yaml'), bad);
});

test('sauvegarde: ancienne sauvegarde importable, sauvegarde exportee puis reimportee identique', async () => {
  const src = fakeDir({ 'donnees-courantes.yaml': ANCIEN, 'evenements-futurs.yaml': EVENEMENTS, 'parametres.yaml': PARAMS });
  const { texte } = await sv.exporterSauvegarde(src, { nom: 'essai', maintenant: new Date('2026-10-27T10:00:00Z') });
  const lue = await sv.lireSauvegarde(texte);
  assert.strictEqual(lue.fichiers['donnees-courantes.yaml'], ANCIEN);
  const cible = fakeDir();
  await sv.importerSauvegarde(lue, cible, { confirme: true });
  assert.strictEqual(cible.files.get('donnees-courantes.yaml'), ANCIEN);
  const a = await store.loadAll(src);
  const b = await store.loadAll(cible);
  assert.deepStrictEqual(b.donnees, a.donnees);
  // nouveau format : export -> import -> export identique
  await store.saveDonnees(src, a.donnees);
  const e1 = (await sv.exporterSauvegarde(src, { nom: 'essai', maintenant: new Date('2026-10-27T10:00:00Z') })).texte;
  const cible2 = fakeDir();
  await sv.importerSauvegarde(await sv.lireSauvegarde(e1), cible2, { confirme: true });
  const e2 = (await sv.exporterSauvegarde(cible2, { nom: 'essai', maintenant: new Date('2026-10-27T10:00:00Z') })).texte;
  assert.strictEqual(e2, e1);
});

// ---- tables-logic ----
test('edition: taux_revalorisation, nombre a point, negatif, vide supprime la cle, virgule et texte conserves bruts', () => {
  const l = { type: 'revenu', categorie: 'A', libelle: 'x', montant: 10 };
  assert.strictEqual(T.appliquerEdition(l, 'taux_revalorisation', ' 1.5 ', 'mensuel').taux_revalorisation, 1.5);
  assert.strictEqual(T.appliquerEdition(l, 'taux_revalorisation', '-2', 'mensuel').taux_revalorisation, -2);
  assert.strictEqual(T.appliquerEdition(l, 'taux_revalorisation', '0', 'mensuel').taux_revalorisation, 0);
  assert.ok(!('taux_revalorisation' in T.appliquerEdition(Object.assign({ taux_revalorisation: 2 }, l), 'taux_revalorisation', '  ', 'mensuel')));
  assert.strictEqual(T.appliquerEdition(l, 'taux_revalorisation', '1,5', 'mensuel').taux_revalorisation, '1,5');
  assert.strictEqual(T.appliquerEdition(l, 'taux_revalorisation', 'abc', 'mensuel').taux_revalorisation, 'abc');
  assert.ok(!('taux_revalorisation' in l));
});

test('changement de type: revenu -> depense garde l information (taux non nul = coche), cle supprimee', () => {
  const avec = T.appliquerEdition({ type: 'revenu', libelle: 'x', taux_revalorisation: 1.5 }, 'type', 'depense', 'mensuel', 0.02);
  assert.strictEqual(avec.type, 'depense');
  assert.strictEqual(avec.revalorise, true);
  assert.ok(!('taux_revalorisation' in avec));
  const sans = T.appliquerEdition({ type: 'revenu', libelle: 'x', taux_revalorisation: 0 }, 'type', 'depense', 'mensuel', 0.02);
  assert.strictEqual(sans.revalorise, false);
  assert.ok(!('taux_revalorisation' in sans));
  assert.strictEqual(T.appliquerEdition({ type: 'revenu', libelle: 'x' }, 'type', 'depense', 'mensuel', 0.02).revalorise, false);
});

test('changement de type: depense -> revenu prend l inflation actuelle si coche, sinon rien, sans revalorise', () => {
  const coche = T.appliquerEdition({ type: 'depense', libelle: 'x', revalorise: true }, 'type', 'revenu', 'mensuel', 0.025);
  assert.strictEqual(coche.type, 'revenu');
  assert.strictEqual(coche.taux_revalorisation, 2.5);
  assert.ok(!('revalorise' in coche));
  const non = T.appliquerEdition({ type: 'depense', libelle: 'x', revalorise: false }, 'type', 'revenu', 'mensuel', 0.025);
  assert.ok(!('taux_revalorisation' in non));
  assert.ok(!('revalorise' in non));
  // pas de flottant parasite : 0.07 -> 7
  assert.strictEqual(T.appliquerEdition({ type: 'depense', libelle: 'x', revalorise: true }, 'type', 'revenu', 'mensuel', 0.07).taux_revalorisation, 7);
});

test('changement de type vers le meme type: rien ne bouge', () => {
  const l = { type: 'revenu', libelle: 'x', taux_revalorisation: 4 };
  assert.deepStrictEqual(T.appliquerEdition(l, 'type', 'revenu', 'mensuel', 0.02), l);
});

// ---- revue 1 : precision, borne haute, impression ----
test('migration: un taux global a plus de 3 decimales de pourcent est converti sans perte', async () => {
  const d = fakeDir({
    'donnees-courantes.yaml': 'mensuel:\n  - {type: revenu, categorie: A, libelle: x, montant: 1000, revalorise: true}\n',
    'parametres.yaml': 'depart: "2026-10"\nhorizon_annees: 10\nrevalorisation: {taux: 0.0123456, mois: 1}\n',
  });
  const r = await store.loadAll(d);
  assert.strictEqual(r.donnees.mensuel[0].taux_revalorisation, 1.23456);
  const j = project(r.donnees, [], r.parametres).find((x) => x.ym === '2027-01');
  assert.ok(Math.abs(j.revenus - 1000 * 1.0123456) < 1e-9);
});

test('changement de type: depense -> revenu conserve la precision de l inflation', () => {
  const c = T.appliquerEdition({ type: 'depense', libelle: 'x', revalorise: true }, 'type', 'revenu', 'mensuel', 0.0123456);
  assert.strictEqual(c.taux_revalorisation, 1.23456);
});

test('validation: taux_revalorisation au-dela de 1000 % refuse, 1000 accepte', () => {
  const ok = { type: 'revenu', categorie: 'A', libelle: 'x', montant: 1000 };
  store.validerLigne(Object.assign({}, ok, { taux_revalorisation: 1000 }), 'mensuel');
  [1000.01, 1e300, 99999999999999999999].forEach((v) => {
    assert.throws(() => store.validerLigne(Object.assign({}, ok, { taux_revalorisation: v }), 'mensuel'), /taux_revalorisation.*1000/, String(v));
  });
});

test('fichier avec un taux demesure: refuse en nommant le fichier, jamais ecrase', async () => {
  const bad = 'mensuel:\n  - {type: revenu, categorie: A, libelle: x, montant: 10, taux_revalorisation: 1e300}\n';
  const d = fakeDir({ 'donnees-courantes.yaml': bad });
  await assert.rejects(store.loadAll(d), /donnees-courantes\.yaml.*taux_revalorisation/);
  assert.strictEqual(d.files.get('donnees-courantes.yaml'), bad);
});

test('impression: un taux vide imprime un tiret, pas le 0 d exemple', () => {
  const { valeurAffichee } = require('../../js/impression.js');
  const champ = (value, attrs) => ({ tagName: 'INPUT', type: 'text', value, getAttribute: (n) => (attrs[n] === undefined ? null : attrs[n]) });
  assert.strictEqual(valeurAffichee(champ('', { placeholder: '0', 'data-vide-impression': '—' })), '—');
  assert.strictEqual(valeurAffichee(champ('1.5', { placeholder: '0', 'data-vide-impression': '—' })), '1.5');
  assert.strictEqual(valeurAffichee(champ('', { placeholder: '6-500' })), '6-500');
  const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/impression.css'), 'utf8');
  assert.match(css, /\.champ-taux:has\(input:placeholder-shown\)::after\s*\{\s*content:\s*none/);
});
