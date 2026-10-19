const test = require('node:test');
const assert = require('node:assert');
const store = require('../../js/store.js');
const { PARAMETRES_DEFAUT } = require('../../js/projection.js');

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

const EV = { id: 'e1', type: 'depense', categorie: 'Achat', libelle: 'Voiture', montant: '2027-3-5000', debut: null, fin: null };

test('dossier vide', async () => {
  const r = await store.loadAll(fakeDir());
  assert.strictEqual(r.donnees, null);
  assert.deepStrictEqual(r.evenements, []);
  assert.deepStrictEqual(r.parametres, PARAMETRES_DEFAUT);
});

test('evenements vide', async () => {
  const r = await store.loadAll(fakeDir({ 'evenements-futurs.yaml': '' }));
  assert.deepStrictEqual(r.evenements, []);
});

test('aller-retour evenements', async () => {
  const d = fakeDir();
  const evs = [EV, Object.assign({}, EV, { id: 'e2', montant: '300', debut: '2027-01', fin: '2028-01' })];
  await store.saveEvenements(d, evs);
  const r = await store.loadAll(d);
  assert.deepStrictEqual(r.evenements, evs);
});

test('yaml invalide: erreur et fichier inchange', async () => {
  const bad = 'horizon_annees: [12\n  : :';
  const d = fakeDir({ 'parametres.yaml': bad });
  await assert.rejects(store.loadAll(d), /parametres\.yaml/);
  assert.strictEqual(d.files.get('parametres.yaml'), bad);
});

test('validerLigne', () => {
  const ok = { id: 'x', type: 'depense', categorie: 'Autre', libelle: 'x', montant: '3-300' };
  assert.throws(() => store.validerLigne(Object.assign({}, ok, { montant: '13:500' }), 'evenement'));
  assert.throws(() => store.validerLigne(Object.assign({}, ok, { debut: '2027-05', fin: '2027-01' }), 'evenement'), /fin/);
  assert.throws(() => store.validerLigne(Object.assign({}, ok, { type: 'autre' }), 'evenement'));
  store.validerLigne(ok, 'evenement');
  store.validerLigne(Object.assign({}, ok, { montant: '2026-3-300' }), 'evenement');
  assert.throws(() => store.validerLigne({ type: 'depense', categorie: 'A', libelle: 'x', montant: 0 }, 'mensuel'));
});

test('parametres partiels fusionnes', async () => {
  const d = fakeDir({ 'parametres.yaml': 'horizon_annees: 12\nprets_etudiants: {x: 1}\n' });
  const r = await store.loadAll(d);
  assert.deepStrictEqual(r.parametres, Object.assign({}, PARAMETRES_DEFAUT, { horizon_annees: 12 }));
});

test('parametres: null/NaN/hors bornes', async () => {
  const d = fakeDir({ 'parametres.yaml': 'horizon_annees: ~\nrevalorisation: {taux: 0.03}\n' });
  const r = await store.loadAll(d);
  assert.strictEqual(r.parametres.horizon_annees, 15);
  assert.strictEqual(r.parametres.revalorisation.taux, 0.03);
  assert.strictEqual(r.parametres.revalorisation.mois, 1);
  await assert.rejects(store.loadAll(fakeDir({ 'parametres.yaml': 'horizon_annees: abc' })), /parametres\.yaml/);
});

test('horizon 20 refuse', async () => {
  const d = fakeDir();
  await assert.rejects(store.saveParametres(d, Object.assign({}, PARAMETRES_DEFAUT, { horizon_annees: 20 })), /horizon/);
  assert.ok(!d.files.has('parametres.yaml'));
  await assert.rejects(store.saveParametres(d, { revalorisation: { taux: 0.02, mois: 13 } }));
});

test('ligne invalide au chargement et a la sauvegarde', async () => {
  const d = fakeDir({ 'evenements-futurs.yaml': '- {id: a, type: autre, categorie: Autre, libelle: x, montant: "1"}\n' });
  await assert.rejects(store.loadAll(d), /evenements-futurs\.yaml/);
  const d2 = fakeDir();
  await assert.rejects(store.saveEvenements(d2, [Object.assign({}, EV, { type: 'x' })]));
  assert.ok(!d2.files.has('evenements-futurs.yaml'));
});

test('donnees: aller-retour et validation', async () => {
  const d = fakeDir();
  const donnees = {
    situation: { compte_courant: 350, epargne: 4000 },
    mensuel: [{ type: 'depense', categorie: 'Maison', libelle: 'EDF', montant: 240, revalorise: false, fin: null }],
    annuel: [{ type: 'depense', categorie: 'Auto', libelle: 'Assur', echeances: '3-300,9-200', revalorise: true }],
    exceptionnel: [],
  };
  await store.saveDonnees(d, donnees);
  const r = await store.loadAll(d);
  assert.deepStrictEqual(r.donnees, donnees);
  await assert.rejects(store.saveDonnees(d, { mensuel: [{ type: 'depense', categorie: 'M', libelle: 'x', montant: -1 }] }));
});

test('parametres.yaml: contenu scalaire ou liste refuse, fichier inchange', async () => {
  for (const bad of ['horizon_annees 12\n', '- 12\n- 13\n']) {
    const d = fakeDir({ 'parametres.yaml': bad });
    await assert.rejects(store.loadAll(d), /parametres\.yaml/);
    assert.strictEqual(d.files.get('parametres.yaml'), bad);
  }
});

test('parametres.yaml: cle inconnue refusee, prets_etudiants obsolete accepte', async () => {
  const bad = 'horizon: 12\n';
  const d = fakeDir({ 'parametres.yaml': bad });
  await assert.rejects(store.loadAll(d), /parametres\.yaml.*horizon/);
  assert.strictEqual(d.files.get('parametres.yaml'), bad);
  const ok = fakeDir({ 'parametres.yaml': 'horizon_annees: 12\nprets_etudiants: []\n' });
  const r = await store.loadAll(ok);
  assert.strictEqual(r.parametres.horizon_annees, 12);
});

test('parametres.yaml: revalorisation non objet refusee', async () => {
  const d = fakeDir({ 'parametres.yaml': 'revalorisation: 2\n' });
  await assert.rejects(store.loadAll(d), /parametres\.yaml.*revalorisation/);
});

test('revalorise doit etre un booleen', () => {
  const ok = { type: 'revenu', categorie: 'A', libelle: 'x', montant: 1000 };
  ['non', 'oui'].forEach((v) => assert.throws(() => store.validerLigne(Object.assign({}, ok, { revalorise: v }), 'mensuel'), /true ou false/));
  [true, false, undefined, null].forEach((v) => store.validerLigne(Object.assign({}, ok, { revalorise: v }), 'mensuel'));
});
