const test = require('node:test');
const assert = require('node:assert');
const store = require('../../js/store.js');
const ini = require('../../js/initialisation.js');
const sauv = require('../../js/sauvegarde.js');
const { PARAMETRES_DEFAUT } = require('../../js/projection.js');

const D = 'donnees-courantes.yaml';
const E = 'evenements-futurs.yaml';
const P = 'parametres.yaml';
const PAL = 'paliers.yaml';
const horloge = (y, m, j) => () => new Date(y, m - 1, j || 15, 12);
const H = { maintenant: horloge(2027, 3) };
const DEFAUT_H = Object.assign({}, PARAMETRES_DEFAUT, { depart: '2027-03' });

// Dossier en memoire. options : liste (false = pas de values()), dossiers (sous-dossiers), echec (nom de fichier dont l'ecriture echoue).
function fakeDir(initial, options) {
  const o = options || {};
  const files = new Map(Object.entries(initial || {}));
  const ecritures = [];
  const dir = {
    files,
    ecritures,
    name: 'dossier-test',
    async getFileHandle(name, opts) {
      if (!files.has(name)) {
        if (!(opts && opts.create)) { const e = new Error('absent'); e.name = 'NotFoundError'; throw e; }
      }
      return {
        async getFile() { return { async text() { return files.get(name); } }; },
        async createWritable() {
          let buf = '';
          return {
            async write(s) { buf += s; },
            async close() {
              if (o.echec === name) throw new Error('disque plein');
              files.set(name, buf);
              ecritures.push(name);
            },
          };
        },
      };
    },
  };
  if (o.liste !== false) {
    dir.values = async function* () {
      for (const n of files.keys()) yield { name: n, kind: 'file' };
      for (const n of (o.dossiers || [])) yield { name: n, kind: 'directory' };
    };
  }
  return dir;
}

test('dossier vide : decision creer, trois fichiers crees, loadAll coherent', async () => {
  const d = fakeDir();
  const etat = await ini.etatDossier(d);
  assert.deepStrictEqual(etat, { fichiersBudget: [], autres: [] });
  assert.strictEqual(ini.decisionOuverture(etat), 'creer');
  const r = await ini.creerBudgetVide(d, H);
  assert.deepStrictEqual(r.crees, [D, E, P]);
  assert.ok(!d.files.has(PAL));
  const c = await store.loadAll(d);
  assert.deepStrictEqual(c.donnees, { situation: { compte_courant: 0, epargne: 0 }, mensuel: [], annuel: [], exceptionnel: [] });
  assert.deepStrictEqual(c.evenements, []);
  assert.deepStrictEqual(c.prets, []);
  assert.deepStrictEqual(c.parametres, DEFAUT_H);
  assert.deepStrictEqual(c.orphelins, []);
  assert.deepStrictEqual(c.avertissements, []);
});

test('fichiers de systeme ignores : .DS_Store seul reste creer', async () => {
  const d = fakeDir({ '.DS_Store': 'x', '.localized': '', '._photo.jpg': 'x', 'Thumbs.db': 'x', 'desktop.ini': 'x' });
  const etat = await ini.etatDossier(d);
  assert.deepStrictEqual(etat, { fichiersBudget: [], autres: [] });
  assert.strictEqual(ini.decisionOuverture(etat), 'creer');
});

test('photo.jpg : confirmer, rien d ecrit avant confirmation', async () => {
  const d = fakeDir({ 'photo.jpg': 'x' });
  const etat = await ini.etatDossier(d);
  assert.deepStrictEqual(etat.autres, ['photo.jpg']);
  assert.strictEqual(ini.decisionOuverture(etat), 'confirmer');
  assert.strictEqual(d.ecritures.length, 0);
  assert.deepStrictEqual([...d.files.keys()], ['photo.jpg']);
});

test('sous-dossier : confirmer', async () => {
  const d = fakeDir({}, { dossiers: ['archives'] });
  const etat = await ini.etatDossier(d);
  assert.deepStrictEqual(etat.autres, ['archives']);
  assert.strictEqual(ini.decisionOuverture(etat), 'confirmer');
});

test('listage impossible : confirmer, et les fichiers de budget sont trouves par sondage', async () => {
  const vide = fakeDir({}, { liste: false });
  const e1 = await ini.etatDossier(vide);
  assert.deepStrictEqual(e1, { fichiersBudget: [], autres: null });
  assert.strictEqual(ini.decisionOuverture(e1), 'confirmer');
  const partiel = fakeDir({ [P]: 'a: 1' }, { liste: false });
  const e2 = await ini.etatDossier(partiel);
  assert.deepStrictEqual(e2, { fichiersBudget: [P], autres: null });
  assert.strictEqual(ini.decisionOuverture(e2), 'completer');
});

test('listage qui echoue : traite comme inconnu', async () => {
  const d = fakeDir();
  d.values = function () { throw new Error('refuse'); };
  const etat = await ini.etatDossier(d);
  assert.strictEqual(etat.autres, null);
  assert.strictEqual(ini.decisionOuverture(etat), 'confirmer');
});

test('fichiers de budget presents : ouvrir (avec ou sans autres entrees)', async () => {
  const d = fakeDir({ [D]: 'situation: {}', 'photo.jpg': 'x' });
  const etat = await ini.etatDossier(d);
  assert.deepStrictEqual(etat.fichiersBudget, [D]);
  assert.strictEqual(ini.decisionOuverture(etat), 'ouvrir');
});

test('seulement parametres.yaml : completer, la creation ne touche que le fichier de donnees', async () => {
  const texte = '# a la main\ndepart: 2027-01\n';
  const d = fakeDir({ [P]: texte, [PAL]: 'paliers: []\n' });
  const etat = await ini.etatDossier(d);
  assert.strictEqual(ini.decisionOuverture(etat), 'completer');
  const r = await ini.creerBudgetVide(d, { seulement: [D] });
  assert.deepStrictEqual(r.crees, [D]);
  assert.strictEqual(d.files.get(P), texte);
  assert.strictEqual(d.files.get(PAL), 'paliers: []\n');
  assert.ok(!d.files.has(E));
  assert.deepStrictEqual(d.ecritures, [D]);
  const c = await store.loadAll(d);
  assert.strictEqual(c.donnees.situation.epargne, 0);
  assert.strictEqual(c.parametres.depart, '2027-01');
});

test('creerBudgetVide refuse si un fichier a creer existe deja, sans rien modifier', async () => {
  const d = fakeDir({ [D]: 'situation: {compte_courant: 5, epargne: 7}\n' });
  await assert.rejects(ini.creerBudgetVide(d), /donnees-courantes\.yaml/);
  assert.strictEqual(d.files.get(D), 'situation: {compte_courant: 5, epargne: 7}\n');
  assert.strictEqual(d.ecritures.length, 0);
  const d2 = fakeDir({ [P]: 'depart: 2027-01\n' });
  await assert.rejects(ini.creerBudgetVide(d2), /parametres\.yaml/);
  assert.strictEqual(d2.ecritures.length, 0);
  assert.ok(!d2.files.has(D));
});

test('echec d ecriture du deuxieme fichier : erreur nommee, premier conserve, crees fidele', async () => {
  const d = fakeDir({}, { echec: E });
  let err;
  try { await ini.creerBudgetVide(d); } catch (e) { err = e; }
  assert.ok(err, 'doit echouer');
  assert.match(err.message, /evenements-futurs\.yaml/);
  assert.match(err.message, /disque plein/);
  assert.match(err.message, /donnees-courantes\.yaml/);
  assert.deepStrictEqual(err.crees, [D]);
  assert.ok(d.files.has(D));
  assert.ok(!d.files.has(P));
});

test('echec du premier fichier : aucun fichier cree', async () => {
  const d = fakeDir({}, { echec: D });
  let err;
  try { await ini.creerBudgetVide(d); } catch (e) { err = e; }
  assert.deepStrictEqual(err.crees, []);
  assert.match(err.message, /donnees-courantes\.yaml/);
  assert.match(err.message, /Aucun fichier/);
});

test('rouvrir le dossier cree : ouvrir, aucune nouvelle ecriture', async () => {
  const d = fakeDir();
  await ini.creerBudgetVide(d);
  const avant = d.ecritures.length;
  const etat = await ini.etatDossier(d);
  assert.deepStrictEqual(etat.fichiersBudget, [D, E, P]);
  assert.strictEqual(ini.decisionOuverture(etat), 'ouvrir');
  await store.loadAll(d);
  assert.strictEqual(d.ecritures.length, avant);
});

test('sauvegarde exportee d un budget vide : reimport propre dans un autre dossier', async () => {
  const d = fakeDir();
  await ini.creerBudgetVide(d, H);
  const exp = await sauv.exporterSauvegarde(d, { nom: 'vide' });
  const lue = await sauv.lireSauvegarde(exp.texte);
  assert.deepStrictEqual(Object.keys(lue.fichiers).sort(), [D, E, P].sort());
  const cible = fakeDir();
  const r = await sauv.importerSauvegarde(lue, cible, {});
  assert.deepStrictEqual(r.ecrits.sort(), [D, E, P].sort());
  const c = await store.loadAll(cible);
  assert.deepStrictEqual(c.donnees.mensuel, []);
  assert.deepStrictEqual(c.parametres, DEFAUT_H);
});

test('premiere ligne mensuelle sur un budget vide : enregistrement et relecture', async () => {
  const d = fakeDir();
  await ini.creerBudgetVide(d);
  const c = await store.loadAll(d);
  c.donnees.mensuel.push({ type: 'revenu', categorie: 'Salaire', libelle: 'Salaire test', montant: 1000 });
  await store.saveDonnees(d, c.donnees, c.orphelins);
  const c2 = await store.loadAll(d);
  assert.strictEqual(c2.donnees.mensuel.length, 1);
  assert.ok(!d.files.has(PAL));
});

test('.git ou .env seuls : confirmer (ne sont pas des fichiers de systeme)', async () => {
  for (const nom of ['.git', '.env', '.gitkeep']) {
    const d = fakeDir({ [nom]: 'x' });
    const etat = await ini.etatDossier(d);
    assert.deepStrictEqual(etat.autres, [nom]);
    assert.strictEqual(ini.decisionOuverture(etat), 'confirmer');
  }
});

test('mois de depart : mois courant en heure locale (mars, fin d annee, janvier)', async () => {
  const cas = [[2027, 3, 10, '2027-03'], [2026, 12, 31, '2026-12'], [2027, 1, 1, '2027-01']];
  for (const [y, m, j, attendu] of cas) {
    const d = fakeDir();
    await ini.creerBudgetVide(d, { maintenant: () => new Date(y, m - 1, j, 23, 59) });
    const c = await store.loadAll(d);
    assert.strictEqual(c.parametres.depart, attendu);
    const mois = require('../../js/projection.js').project(c.donnees, [], c.parametres);
    assert.strictEqual(mois[0].ym, attendu);
  }
});

test('fichier apparu entre le controle initial et l ecriture : jamais ecrase', async () => {
  const d = fakeDir();
  const orig = d.getFileHandle.bind(d);
  let sondages = 0;
  d.getFileHandle = async function (nom, opts) {
    if (nom === E && !(opts && opts.create)) {
      sondages++;
      if (sondages === 2) d.files.set(E, '# apparu\n- id: x\n'); // 1er sondage = controle initial, 2e = juste avant l'ecriture
    }
    return orig(nom, opts);
  };
  let err;
  try { await ini.creerBudgetVide(d, H); } catch (e) { err = e; }
  assert.ok(err);
  assert.match(err.message, /evenements-futurs\.yaml/);
  assert.deepStrictEqual(err.crees, [D]);
  assert.strictEqual(d.files.get(E), '# apparu\n- id: x\n');
  assert.ok(!d.files.has(P));
});
