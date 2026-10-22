const test = require('node:test');
const assert = require('node:assert');
const { project, expandPaliers } = require('../../js/projection.js');
const Su = require('../../js/summary.js');
const { lignesFutures } = require('../../js/prets.js');
const store = require('../../js/store.js');

const P = { depart: '2026-10', horizon_annees: 5, revalorisation: { taux: 0.1, mois: 1 } };

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

const segs = (l) => expandPaliers(l).map((x) => [x.montant != null ? x.montant : x.echeances, x.debut || null, x.fin || null]);

// ---- expandPaliers ----
test('expandPaliers : sans palier, la ligne telle quelle', () => {
  const l = { type: 'depense', categorie: 'c', libelle: 'l', montant: 100, fin: '2028-01' };
  assert.deepStrictEqual(expandPaliers(l), [l]);
  assert.deepStrictEqual(expandPaliers(Object.assign({}, l, { paliers: [] })).length, 1);
});

test('expandPaliers : un palier remplace le montant depuis sa date', () => {
  const l = { type: 'depense', categorie: 'c', libelle: 'l', montant: 100, revalorise: true, paliers: [{ depuis: '2027-03', montant: 150 }] };
  assert.deepStrictEqual(segs(l), [[100, null, '2027-02'], [150, '2027-03', null]]);
  const x = expandPaliers(l)[1];
  assert.strictEqual(x.paliers, undefined);
  assert.strictEqual(x.revalorise, true);
  assert.strictEqual(x.libelle, 'l');
});

test('expandPaliers : plusieurs paliers et bornes debut/fin', () => {
  const l = { type: 'revenu', categorie: 'c', libelle: 'l', montant: 1, debut: '2026-10', fin: '2029-06', paliers: [{ depuis: '2027-01', montant: 2 }, { depuis: '2028-01', montant: 3 }] };
  assert.deepStrictEqual(segs(l), [[1, '2026-10', '2026-12'], [2, '2027-01', '2027-12'], [3, '2028-01', '2029-06']]);
});

test('expandPaliers : palier avant debut ou apres fin ne donne rien', () => {
  const l = { type: 'revenu', categorie: 'c', libelle: 'l', montant: 1, debut: '2027-06', fin: '2028-06', paliers: [{ depuis: '2027-01', montant: 2 }, { depuis: '2029-01', montant: 3 }] };
  assert.deepStrictEqual(segs(l), [[2, '2027-06', '2028-06']]);
});

test('expandPaliers : echeances annuelles remplacees, date unique', () => {
  const l = { type: 'depense', categorie: 'c', libelle: 'l', echeances: '3-600', paliers: [{ depuis: '2028-01', echeances: '6-500, 10-500' }] };
  assert.deepStrictEqual(segs(l), [['3-600', null, '2027-12'], ['6-500, 10-500', '2028-01', null]]);
  const e = { type: 'depense', categorie: 'Achat', libelle: 'v', montant: '2027-03-300', paliers: [{ depuis: '2027-05', echeances: '2027-08-400' }] };
  const r = project({ mensuel: [] }, [e], Object.assign({}, P, { horizon_annees: 2 }));
  assert.strictEqual(r.find((m) => m.ym === '2027-03').depenses, 300);
  assert.strictEqual(r.find((m) => m.ym === '2027-08').depenses, 400);
});

// ---- project ----
test('project : paliers et revalorisation apres la frontiere', () => {
  const D = { mensuel: [{ type: 'revenu', categorie: 'c', libelle: 'l', montant: 100, revalorise: true, paliers: [{ depuis: '2027-03', montant: 200 }] }] };
  const r = project(D, [], P);
  const m = (k) => r.find((x) => x.ym === k).revenus;
  assert.strictEqual(m('2026-10'), 100);
  assert.ok(Math.abs(m('2027-01') - 110) < 1e-9);
  assert.ok(Math.abs(m('2027-02') - 110) < 1e-9);
  assert.ok(Math.abs(m('2027-03') - 220) < 1e-9);
  assert.ok(Math.abs(m('2028-01') - 242) < 1e-9);
});

test('project : ligne masquee avec paliers ignoree', () => {
  const D = { mensuel: [{ type: 'revenu', categorie: 'c', libelle: 'l', montant: 100, actif: false, paliers: [{ depuis: '2027-03', montant: 200 }] }] };
  assert.strictEqual(project(D, [], P).reduce((a, m) => a + m.revenus, 0), 0);
});

// ---- cohérence des consommateurs ----
const D = {
  situation: { compte_courant: 100, epargne: 50 },
  mensuel: [
    { type: 'revenu', categorie: 'salaire', libelle: 'paie', montant: 3000, revalorise: true, paliers: [{ depuis: '2027-04', montant: 3500 }, { depuis: '2028-09', montant: 3800 }] },
    { type: 'depense', categorie: 'vie', libelle: 'loyer', montant: 900, fin: '2029-12', paliers: [{ depuis: '2026-10', montant: 950 }] },
  ],
  annuel: [{ type: 'depense', categorie: 'imp', libelle: 'taxe', echeances: '3-600', revalorise: true, paliers: [{ depuis: '2028-01', echeances: '3-700, 9-100' }] }],
  exceptionnel: [{ type: 'revenu', categorie: 'prime', libelle: 'prime', echeances: '2027-03-400', paliers: [{ depuis: '2027-01', echeances: '2027-03-450' }] }],
};
const EV = [{ id: 'e', type: 'depense', categorie: 'Achat', libelle: 'voyage', echeances: '2027-03-1000', paliers: [{ depuis: '2027-02', echeances: '2027-03-1100' }] }];

test('detailMois : somme des groupes = net de project()', () => {
  const futurs = lignesFutures(EV, []);
  project(D, futurs, P).forEach((m) => {
    const d = Su.detailMois(D, futurs, P, m.ym);
    assert.ok(Math.abs(d.net - m.net) < 1e-6, m.ym);
    assert.ok(d.mensuel.revenus >= 0);
  });
  const d = Su.detailMois(D, futurs, P, '2027-03');
  assert.strictEqual(d.annuel.length, 1);
  assert.strictEqual(d.annuel[0].montant, -660);
  assert.strictEqual(d.exceptionnel.length, 1);
  assert.strictEqual(d.exceptionnel[0].montant, 450);
  assert.strictEqual(d.futurs.length, 1);
  assert.strictEqual(d.futurs[0].montant, -1100);
});

test('lignesInfobulle : montants en vigueur', () => {
  const futurs = lignesFutures(EV, []);
  const mois = project(D, futurs, P);
  const m = mois.find((x) => x.ym === '2027-03');
  const l = Su.lignesInfobulle(Su.detailMois(D, futurs, P, '2027-03'), m, (v) => String(Math.round(v)));
  assert.ok(l.corps.some((s) => s.includes('voyage : -1100')));
  assert.ok(l.corps.some((s) => s.includes('prime : +450')));
});

test('CSV detail : la somme par mois = net de project()', () => {
  const futurs = lignesFutures(EV, []);
  const rows = Su.detailHistorique(D, futurs, P);
  project(D, futurs, P).forEach((m) => {
    const s = rows.filter((r) => r.ym === m.ym).reduce((a, r) => a + r.montant, 0);
    assert.ok(Math.abs(s - m.net) < 1e-6, m.ym);
  });
});

test('bilans : par mois et par annee = project() (hors revalorisation absente)', () => {
  const sans = { situation: {}, mensuel: [{ type: 'depense', categorie: 'c', libelle: 'l', montant: 10, paliers: [{ depuis: '2027-01', montant: 20 }] }], annuel: [{ type: 'revenu', categorie: 'c', libelle: 'a', echeances: '2-100', paliers: [{ depuis: '2028-01', echeances: '2-300' }] }] };
  const lignes = sans.mensuel.concat(sans.annuel);
  const parMois = Su.bilanParMois(lignes, P, 24);
  const r = project(sans, [], P);
  parMois.forEach((b, i) => assert.ok(Math.abs(b.net - r[i].net) < 1e-9));
  const imp = Su.impactMensuel(sans.annuel, P);
  assert.strictEqual(imp[0].total_annuel, 100); // 2027-02 : echeance 100 sur 12 mois depuis 2026-10
  const syn = Su.syntheseEvenements(EV, P);
  assert.strictEqual(syn[0].total, -1100);
});

test('restantMensuel : montant en vigueur au depart', () => {
  const l = (paliers) => ({ mensuel: [{ type: 'revenu', categorie: 'c', libelle: 'a', montant: 1000, paliers }, { type: 'depense', categorie: 'c', libelle: 'b', montant: 400 }] });
  assert.strictEqual(Su.restantMensuel(l(undefined), P), 600);
  assert.strictEqual(Su.restantMensuel(l([{ depuis: '2026-10', montant: 1500 }]), P), 1100); // palier = depart
  assert.strictEqual(Su.restantMensuel(l([{ depuis: '2027-01', montant: 1500 }]), P), 600); // futur
  assert.strictEqual(Su.restantMensuel(l([{ depuis: '2025-01', montant: 1200 }, { depuis: '2026-09', montant: 1300 }, { depuis: '2026-11', montant: 9 }]), P), 900);
  assert.strictEqual(Su.restantMoyen({ mensuel: l([{ depuis: '2027-01', montant: 1500 }]).mensuel, annuel: [], exceptionnel: [] }, P), 600);
});

// ---- store ----
const LIGNE = { type: 'depense', categorie: 'vie', libelle: 'loyer', montant: 900 };
const DON = () => ({ situation: { compte_courant: 1, epargne: 2 }, mensuel: [Object.assign({}, LIGNE)], annuel: [], exceptionnel: [] });
const ENTREE = { ligne: { nature: 'mensuel', type: 'depense', categorie: 'vie', libelle: 'loyer' }, etapes: [{ depuis: '2027-01', montant: 950 }] };
const dump = (o) => require('../../vendor/js-yaml.min.js').dump(o);

test('store : fichier absent ou vide, aucun orphelin', async () => {
  let r = await store.loadAll(fakeDir({ 'donnees-courantes.yaml': dump(DON()) }));
  assert.deepStrictEqual(r.orphelins, []);
  assert.strictEqual(r.donnees.mensuel[0].paliers, undefined);
  r = await store.loadAll(fakeDir({ 'donnees-courantes.yaml': dump(DON()), 'paliers.yaml': '' }));
  assert.deepStrictEqual(r.orphelins, []);
  assert.strictEqual(store.FICHIERS.paliers, 'paliers.yaml');
});

test('store : attache les paliers, orphelins conserves, aller-retour sans paliers dans donnees', async () => {
  const orph = { ligne: { nature: 'annuel', type: 'depense', categorie: 'x', libelle: 'disparue' }, etapes: [{ depuis: '2027-01', echeances: '3-100' }] };
  const d = fakeDir({ 'donnees-courantes.yaml': dump(DON()), 'paliers.yaml': dump({ paliers: [ENTREE, orph] }) });
  const r = await store.loadAll(d);
  assert.deepStrictEqual(r.donnees.mensuel[0].paliers, ENTREE.etapes);
  assert.deepStrictEqual(r.orphelins, [orph]);
  await store.saveDonnees(d, r.donnees, r.orphelins);
  assert.ok(!/paliers/.test(d.files.get('donnees-courantes.yaml')));
  const r2 = await store.loadAll(d);
  assert.deepStrictEqual(r2.donnees.mensuel[0].paliers, ENTREE.etapes);
  assert.deepStrictEqual(r2.orphelins, [orph]);
});

test('store : renommer le libelle re-cle les paliers', async () => {
  const d = fakeDir({ 'donnees-courantes.yaml': dump(DON()), 'paliers.yaml': dump({ paliers: [ENTREE] }) });
  const r = await store.loadAll(d);
  r.donnees.mensuel[0].libelle = 'loyer 2';
  await store.saveDonnees(d, r.donnees, r.orphelins);
  const r2 = await store.loadAll(d);
  assert.deepStrictEqual(r2.orphelins, []);
  assert.deepStrictEqual(r2.donnees.mensuel[0].paliers, ENTREE.etapes);
});

test('store : saveDonnees sans paliers ne cree pas le fichier ; vidé si fichier existant', async () => {
  const d = fakeDir();
  await store.saveDonnees(d, DON(), []);
  assert.ok(!d.files.has('paliers.yaml'));
  const e = fakeDir({ 'paliers.yaml': dump({ paliers: [ENTREE] }) });
  await store.saveDonnees(e, DON(), []);
  assert.ok(e.files.has('paliers.yaml'));
  assert.deepStrictEqual((await store.loadAll(e)).orphelins, []);
});

test('store : yaml invalide nomme paliers.yaml, fichiers inchanges', async () => {
  const bad = 'paliers: [{ligne';
  const don = dump(DON());
  const d = fakeDir({ 'donnees-courantes.yaml': don, 'paliers.yaml': bad });
  await assert.rejects(store.loadAll(d), /paliers\.yaml/);
  assert.strictEqual(d.files.get('paliers.yaml'), bad);
  assert.strictEqual(d.files.get('donnees-courantes.yaml'), don);
});

test('store : validation des paliers', () => {
  const ok = (p, nature, extra) => store.validerLigne(Object.assign({ id: 'x', type: 'depense', categorie: nature === 'evenement' ? 'Achat' : 'c', libelle: 'l', montant: nature === 'mensuel' ? 10 : '3-300', paliers: p }, extra), nature);
  ok([{ depuis: '2027-01', montant: 5 }], 'mensuel');
  assert.throws(() => ok([{ depuis: '2027-1', montant: 5 }, { depuis: '2027-13', montant: 5 }], 'mensuel'), /AAAA-MM|invalide/);
  assert.throws(() => ok([{ depuis: '2027/01', montant: 5 }], 'mensuel'), /depuis|Mois/);
  assert.throws(() => ok([{ depuis: '2027-05', montant: 5 }, { depuis: '2027-05', montant: 6 }], 'mensuel'), /croissant/);
  assert.throws(() => ok([{ depuis: '2027-05', montant: 5 }, { depuis: '2027-04', montant: 6 }], 'mensuel'), /croissant/);
  assert.throws(() => ok([{ depuis: '2027-05', montant: 0 }], 'mensuel'), /supérieur à 0/);
  assert.throws(() => ok([{ depuis: '2027-05', montant: '3-300' }], 'mensuel'), /nombre/);
  assert.throws(() => ok([{ depuis: '2027-05', echeances: '13:5' }], 'annuel'), /invalide/);
  ok([{ depuis: '2027-05', echeances: '6-500, 10-500' }], 'annuel');
  ok([{ depuis: '2027-05', echeances: '800' }], 'evenement');
  assert.throws(() => ok([{ depuis: '2027-05', echeances: '' }], 'evenement'));
  assert.throws(() => ok([{ depuis: '2027-05', montant: 5 }], 'mensuel', { debut: '2027-05' }), /début/);
  ok([{ depuis: '2027-06', montant: 5 }], 'mensuel', { debut: '2027-05' });
  assert.throws(() => ok('x', 'mensuel'), /liste/);
  const beaucoup = Array.from({ length: 51 }, (_, i) => ({ depuis: String(2000 + i) + '-01', montant: 1 }));
  assert.throws(() => ok(beaucoup, 'mensuel'), /50/);
});

test('store : paliers d evenements, aller-retour dans evenements-futurs.yaml', async () => {
  const d = fakeDir();
  const ev = { id: 'e1', type: 'depense', categorie: 'Achat', libelle: 'V', echeances: '300', paliers: [{ depuis: '2027-01', echeances: '2027-03-5' }] };
  await store.saveEvenements(d, [ev], []);
  assert.deepStrictEqual((await store.loadAll(d)).evenements, [ev]);
  await assert.rejects(store.saveEvenements(d, [Object.assign({}, ev, { paliers: [{ depuis: 'zz', echeances: '1' }] })], []), /evenements-futurs\.yaml/);
});

test('store : entree de paliers.yaml invalide nomme paliers.yaml', async () => {
  const mk = (e) => fakeDir({ 'donnees-courantes.yaml': dump(DON()), 'paliers.yaml': dump({ paliers: [e] }) });
  await assert.rejects(store.loadAll(mk({ ligne: ENTREE.ligne, etapes: [{ depuis: '2027-02', montant: 1 }, { depuis: '2027-01', montant: 1 }] })), /paliers\.yaml.*croissant/);
  await assert.rejects(store.loadAll(mk({ ligne: { nature: 'zzz', type: 'depense', categorie: 'vie', libelle: 'l' }, etapes: ENTREE.etapes })), /paliers\.yaml/);
  await assert.rejects(store.loadAll(mk({ ligne: ENTREE.ligne, etapes: [] })), /paliers\.yaml/);
  await assert.rejects(store.loadAll(fakeDir({ 'paliers.yaml': dump({ autre: [] }) })), /paliers\.yaml/);
});

test('store : un echec d ecriture de paliers ne touche pas donnees si invalide avant ecriture', async () => {
  const d = fakeDir();
  const don = DON();
  don.mensuel[0].paliers = [{ depuis: '2027-02', montant: 1 }, { depuis: '2027-01', montant: 1 }];
  await assert.rejects(store.saveDonnees(d, don, []), /croissant/);
  assert.ok(!d.files.has('donnees-courantes.yaml'));
  // entree orpheline en doublon avec une ligne : refusee avant toute ecriture
  const don2 = DON();
  don2.mensuel[0].paliers = ENTREE.etapes;
  await assert.rejects(store.saveDonnees(d, don2, [ENTREE]), /paliers\.yaml/);
  assert.ok(!d.files.has('donnees-courantes.yaml'));
});

// ---- fix round 1 ----
test('finsDePret : montant libere = montant en vigueur a la fin', () => {
  const d = { mensuel: [
    { type: 'depense', categorie: 'c', libelle: 'a', montant: 100, fin: '2028-06', paliers: [{ depuis: '2027-01', montant: 80 }, { depuis: '2028-01', montant: 60 }] },
    { type: 'depense', categorie: 'c', libelle: 'b', montant: 50, fin: '2027-12', paliers: [{ depuis: '2029-01', montant: 1 }] },
    { type: 'depense', categorie: 'c', libelle: 'c', montant: 30, fin: '2027-01' },
  ] };
  const r = Su.finsDePret(d);
  const par = (l) => r.find((x) => x.libelle === l).libere_par_mois;
  assert.strictEqual(par('a'), 60);
  assert.strictEqual(par('b'), 50);
  assert.strictEqual(par('c'), 30);
});

test('expandPaliers : echeances numerique acceptee', () => {
  const l = { type: 'depense', categorie: 'c', libelle: 'l', echeances: '5', paliers: [{ depuis: '2027-01', echeances: 800 }] };
  assert.strictEqual(expandPaliers(l)[1].echeances, '800');
});

test('store : paliers avant le debut de la ligne : chargement tolerant + avertissement, refus a l enregistrement', async () => {
  const don = DON();
  don.mensuel[0].debut = '2027-06';
  const d = fakeDir({ 'donnees-courantes.yaml': dump(don), 'paliers.yaml': dump({ paliers: [ENTREE] }) });
  const r = await store.loadAll(d);
  assert.strictEqual(r.donnees.mensuel[0].paliers.length, 1);
  assert.strictEqual(r.avertissements.length, 1);
  assert.match(r.avertissements[0], /paliers\.yaml/);
  assert.ok(project(r.donnees, [], P).every((m) => Number.isFinite(m.net)));
  assert.throws(() => store.validerLigne(r.donnees.mensuel[0], 'mensuel'), /début/);
  await assert.rejects(store.saveDonnees(d, r.donnees, r.orphelins), /début/);
});

test('store : renommer une ligne vers la cle d un orphelin lui rattache ses paliers', async () => {
  const orph = { ligne: { nature: 'mensuel', type: 'depense', categorie: 'vie', libelle: 'nouveau' }, etapes: [{ depuis: '2027-03', montant: 7 }] };
  const d = fakeDir({ 'donnees-courantes.yaml': dump(DON()), 'paliers.yaml': dump({ paliers: [orph] }) });
  const r = await store.loadAll(d);
  assert.deepStrictEqual(r.orphelins, [orph]);
  r.donnees.mensuel[0].libelle = 'nouveau';
  await store.saveDonnees(d, r.donnees, r.orphelins);
  assert.deepStrictEqual(r.orphelins, []);
  assert.deepStrictEqual(r.donnees.mensuel[0].paliers, orph.etapes);
  const r2 = await store.loadAll(d);
  assert.deepStrictEqual(r2.orphelins, []);
  assert.deepStrictEqual(r2.donnees.mensuel[0].paliers, orph.etapes);
});

test('store : doublon refuse si l orphelin ou une autre ligne a deja ses paliers', async () => {
  const orph = { ligne: { nature: 'mensuel', type: 'depense', categorie: 'vie', libelle: 'loyer' }, etapes: [{ depuis: '2027-03', montant: 7 }] };
  const d = fakeDir();
  const don = DON();
  don.mensuel[0].paliers = ENTREE.etapes;
  await assert.rejects(store.saveDonnees(d, don, [orph]), /paliers\.yaml.*doublon/);
  const don2 = DON();
  don2.mensuel.push(Object.assign({}, LIGNE, { paliers: ENTREE.etapes }));
  don2.mensuel[0].paliers = ENTREE.etapes;
  await assert.rejects(store.saveDonnees(d, don2, []), /paliers\.yaml.*doublon/);
  assert.ok(!d.files.has('donnees-courantes.yaml'));
});

test('store : cle de montant selon la nature', () => {
  const base = { id: 'x', type: 'depense', categorie: 'c', libelle: 'l' };
  assert.throws(() => store.validerLigne(Object.assign({ montant: 10, paliers: [{ depuis: '2027-01', echeances: '5' }] }, base), 'mensuel'), /utiliser « montant »/);
  assert.throws(() => store.validerLigne(Object.assign({ echeances: '3-5', paliers: [{ depuis: '2027-01', montant: 5 }] }, base), 'annuel'), /utiliser « echeances »/);
  assert.throws(() => store.validerLigne(Object.assign({ echeances: '3-5', paliers: [{ depuis: '2027-01', montant: '5' }] }, base, { categorie: 'Achat' }), 'evenement'), /utiliser « echeances »/);
});

test('store : echec d ecriture de paliers.yaml : erreur remontee, donnees sans paliers, rien perdu', async () => {
  const d = fakeDir({ 'donnees-courantes.yaml': dump(DON()), 'paliers.yaml': dump({ paliers: [ENTREE] }) });
  const r = await store.loadAll(d);
  r.donnees.mensuel[0].paliers = [{ depuis: '2027-02', montant: 1 }];
  const orig = d.getFileHandle.bind(d);
  d.getFileHandle = async (name, opts) => {
    const h = await orig(name, opts);
    if (name === 'paliers.yaml' && opts && opts.create) return { async createWritable() { throw new Error('disque plein'); } };
    return h;
  };
  await assert.rejects(store.saveDonnees(d, r.donnees, r.orphelins), /paliers\.yaml : disque plein/);
  assert.ok(!/paliers/.test(d.files.get('donnees-courantes.yaml')));
  const r2 = await store.loadAll(d);
  assert.deepStrictEqual(r2.donnees.mensuel[0].paliers, ENTREE.etapes);
});
