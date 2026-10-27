const test = require('node:test');
const assert = require('node:assert');
const demo = require('../../js/demo.js');
const store = require('../../js/store.js');
const ini = require('../../js/initialisation.js');
const P = require('../../js/projection.js');
const Pr = require('../../js/prets.js');
const Su = require('../../js/summary.js');
const Ca = require('../../js/categories.js');
const yaml = require('../../vendor/js-yaml.min.js');

const maintenant = (y, m, j) => new Date(y, m - 1, j || 15, 12);
const NOMS = ['donnees-courantes.yaml', 'evenements-futurs.yaml', 'parametres.yaml', 'paliers.yaml'];

async function charger(date) {
  const dir = demo.dossierDemo(date);
  return { dir: dir, r: await store.loadAll(dir) };
}

test('fichiersDemo : les quatre fichiers YAML du budget, textes non vides', () => {
  const f = demo.fichiersDemo(maintenant(2027, 3));
  assert.deepStrictEqual(Object.keys(f).sort(), NOMS.slice().sort());
  NOMS.forEach((n) => { assert.ok(typeof f[n] === 'string' && f[n].trim() !== '', n); yaml.load(f[n]); });
  assert.deepStrictEqual(Object.keys(demo.DEMO_FICHIERS).sort(), NOMS.slice().sort());
});

test('dossierDemo : le seam DirHandle (NotFoundError si absent, lecture, creation)', async () => {
  const dir = demo.dossierDemo(maintenant(2027, 3));
  await assert.rejects(() => dir.getFileHandle('inconnu.csv'), (e) => e.name === 'NotFoundError');
  const h = await dir.getFileHandle('parametres.yaml');
  assert.match(await (await h.getFile()).text(), /depart/);
  const neuf = await dir.getFileHandle('historique-comptes.csv', { create: true });
  const w = await neuf.createWritable();
  await w.write('a;b');
  await w.close();
  assert.strictEqual(await (await (await dir.getFileHandle('historique-comptes.csv')).getFile()).text(), 'a;b');
});

test('dossierDemo : ecrire dans un dossier ne touche ni les autres dossiers ni les textes d\'origine', async () => {
  const a = demo.dossierDemo(maintenant(2027, 3));
  const b = demo.dossierDemo(maintenant(2027, 3));
  const avant = await (await (await b.getFileHandle('parametres.yaml')).getFile()).text();
  const w = await (await a.getFileHandle('parametres.yaml', { create: true })).createWritable();
  await w.write('depart: 1999-01\n');
  await w.close();
  assert.strictEqual(await (await (await b.getFileHandle('parametres.yaml')).getFile()).text(), avant);
  assert.strictEqual(demo.fichiersDemo(maintenant(2027, 3))['parametres.yaml'], avant);
});

test('dossierDemo : n\'expose que le nom et les fichiers (aucun acces au disque)', async () => {
  const dir = demo.dossierDemo(maintenant(2027, 3));
  const etat = await ini.etatDossier(dir);
  assert.deepStrictEqual(etat.fichiersBudget, NOMS);
  assert.deepStrictEqual(etat.autres, []);
  assert.strictEqual(ini.decisionOuverture(etat), 'ouvrir');
});

test('les donnees de demo passent loadAll strictement, sans avertissement ni orphelin', async () => {
  const { r } = await charger(maintenant(2027, 3));
  assert.deepStrictEqual(r.avertissements, []);
  assert.deepStrictEqual(r.orphelins, []);
  assert.deepStrictEqual(r.migres, { donnees: false, evenements: false });
  assert.strictEqual(r.parametres.revalorisation.taux, 0.02);
});

test('depart = mois courant, quel que soit le jour d\'ouverture', async () => {
  for (const [y, m, j] of [[2027, 3, 15], [2028, 12, 31], [2026, 1, 1]]) {
    const { r } = await charger(maintenant(y, m, j));
    assert.strictEqual(r.parametres.depart, y + '-' + String(m).padStart(2, '0'));
  }
});

test('categories : la liste par defaut, et toute categorie de ligne y figure', async () => {
  const { r } = await charger(maintenant(2027, 3));
  assert.deepStrictEqual(r.parametres.categories, Ca.CATEGORIES_DEFAUT);
  ['mensuel', 'annuel', 'exceptionnel'].forEach((n) => r.donnees[n].forEach((l) => {
    assert.ok(Ca.CATEGORIES_DEFAUT[l.type].indexOf(l.categorie) >= 0, l.libelle + ' : ' + l.categorie);
  }));
});

test('contenu : revenus au taux propre, depenses revalorisees, ligne masquee, palier, pret, evenements', async () => {
  const { r } = await charger(maintenant(2027, 3));
  const salaires = r.donnees.mensuel.filter((l) => l.type === 'revenu' && l.categorie === 'Salaires');
  assert.strictEqual(salaires.length, 2);
  salaires.forEach((l) => { assert.ok(typeof l.taux_revalorisation === 'number' && l.taux_revalorisation > 0); assert.ok(!('revalorise' in l)); });
  assert.notStrictEqual(salaires[0].taux_revalorisation, salaires[1].taux_revalorisation);
  assert.ok(r.donnees.mensuel.some((l) => l.type === 'depense' && l.revalorise === true));
  assert.ok(r.donnees.mensuel.some((l) => l.actif === false), 'une ligne masquee');
  assert.ok(r.donnees.mensuel.some((l) => Array.isArray(l.paliers) && l.paliers.length > 0), 'un palier attache');
  assert.ok(r.donnees.annuel.length >= 3);
  assert.strictEqual(r.donnees.exceptionnel.length, 1);
  assert.ok(r.prets.length >= 1 && r.prets.every((p) => p.nature === 'pret'));
  assert.ok(r.prets.some((p) => p.statut === 'en_cours'));
  assert.ok(r.evenements.length >= 2);
  r.prets.forEach((p) => Pr.validerPret(p));
});

test('projection : aucun NaN sur tout l\'horizon, solde final positif, au moins un mois tendu', async () => {
  const { r } = await charger(maintenant(2027, 3));
  const mois = P.project(r.donnees, Pr.lignesFutures(r.evenements, r.prets), r.parametres);
  assert.strictEqual(mois.length, r.parametres.horizon_annees * 12);
  mois.forEach((m) => {
    ['revenus', 'depenses', 'net', 'solde'].forEach((k) => assert.ok(Number.isFinite(m[k]), m.ym + ' ' + k));
  });
  assert.ok(mois[mois.length - 1].solde > 0, 'solde final positif');
  assert.ok(mois.every((m) => m.solde > 0), 'jamais a decouvert');
  assert.ok(mois.some((m) => m.net < 0), 'un mois tendu (net negatif)');
  assert.ok(mois.filter((m) => m.net < 0).length <= mois.length / 4, 'les mois tendus restent l\'exception');
});

test('historique : le detail se calcule sans erreur sur les donnees de demo', async () => {
  const { r } = await charger(maintenant(2027, 3));
  const futures = Pr.lignesFutures(r.evenements, r.prets);
  const mois = P.project(r.donnees, futures, r.parametres);
  const csv = Su.historiqueCsv(mois, Su.detailHistorique(r.donnees, futures, r.parametres));
  assert.ok(typeof csv === 'string' && csv.length > 0);
});

test('aucune donnee personnelle : libelles fictifs, pas de fichier lu sur le disque', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../js/demo.js'), 'utf8');
  assert.ok(!/require\(['"]fs['"]\)|showDirectoryPicker|localStorage/.test(src));
});
