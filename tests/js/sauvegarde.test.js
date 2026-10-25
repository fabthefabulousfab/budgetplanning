const test = require('node:test');
const assert = require('node:assert');
const yaml = require('../../vendor/js-yaml.min.js');
const store = require('../../js/store.js');
const sv = require('../../js/sauvegarde.js');

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

const DONNEES = [
  '# Données de test (commentaire à conserver)',
  'situation:',
  '  compte_courant:   1200',
  '  epargne: 3000',
  'mensuel:',
  '  - type: revenu',
  '    categorie: Salaire',
  '    libelle: Salaire A',
  '    montant: 2500',
  '',
  '',
].join('\n');
const EVENEMENTS = '- id: e1\n  type: depense\n  categorie: Achat\n  libelle: Voiture\n  montant: 2027-3-5000\n  debut: null\n  fin: null\n';
const PARAMETRES = '# réglages\ndepart: 2026-01\nhorizon_annees: 12\nrevalorisation:\n  taux: 0.02\n  mois: 1\n';
const PALIERS = 'paliers:\n  - ligne: { nature: mensuel, type: revenu, categorie: Salaire, libelle: Salaire A }\n    etapes:\n      - { depuis: 2027-01, montant: 2600 }\n      - { depuis: 2028-01, montant: 2700 }\n';

function dossierComplet() {
  return fakeDir({
    'donnees-courantes.yaml': DONNEES,
    'evenements-futurs.yaml': EVENEMENTS,
    'parametres.yaml': PARAMETRES,
    'paliers.yaml': PALIERS,
    'historique-comptes.csv': 'mois;solde\n2026-01;1\n',
  });
}

const MAINTENANT = new Date('2026-03-07T10:20:30.000Z');

async function refuse(promesse, motif) {
  await assert.rejects(promesse, function (e) {
    assert.match(e.message, motif);
    return true;
  });
}

function bundle(modif) {
  const b = { format: 'budget-sauvegarde', version_format: 1, application: 'budget-previsionnel', exporte_le: '2026-03-07T10:20:30.000Z', nom: 'x', fichiers: { 'donnees-courantes.yaml': DONNEES } };
  return yaml.dump(modif ? modif(b) : b, { lineWidth: -1 });
}

test('export : en-tête, fichiers bruts, jamais le CSV', async () => {
  const { texte, nomFichier } = await sv.exporterSauvegarde(dossierComplet(), { nom: 'Famille', maintenant: MAINTENANT });
  const doc = yaml.load(texte);
  assert.strictEqual(doc.format, 'budget-sauvegarde');
  assert.strictEqual(doc.version_format, 1);
  assert.strictEqual(doc.application, 'budget-previsionnel');
  assert.strictEqual(doc.exporte_le, '2026-03-07T10:20:30.000Z');
  assert.strictEqual(doc.nom, 'Famille');
  assert.deepStrictEqual(Object.keys(doc.fichiers).sort(), ['donnees-courantes.yaml', 'evenements-futurs.yaml', 'paliers.yaml', 'parametres.yaml']);
  assert.strictEqual(doc.fichiers['donnees-courantes.yaml'], DONNEES);
  assert.ok(!texte.includes('historique-comptes.csv'));
  assert.strictEqual(nomFichier, 'budget-Famille-2026-03-07.yaml');
});

test('export : nom par défaut et fichiers optionnels absents', async () => {
  const { texte, nomFichier } = await sv.exporterSauvegarde(fakeDir({ 'donnees-courantes.yaml': DONNEES }), { maintenant: MAINTENANT });
  const doc = yaml.load(texte);
  assert.strictEqual(doc.nom, 'sauvegarde');
  assert.deepStrictEqual(Object.keys(doc.fichiers), ['donnees-courantes.yaml']);
  assert.strictEqual(nomFichier, 'budget-sauvegarde-2026-03-07.yaml');
});

test('export : refus sans donnees-courantes.yaml', async () => {
  await refuse(sv.exporterSauvegarde(fakeDir({ 'parametres.yaml': PARAMETRES }), { maintenant: MAINTENANT }), /Rien à exporter/);
  await refuse(sv.exporterSauvegarde(fakeDir(), {}), /Rien à exporter/);
});

test('nom de fichier nettoyé', () => {
  assert.strictEqual(sv.nomFichierSauvegarde('Été 2026 / Papa & Maman', MAINTENANT), 'budget-Ete-2026-Papa-Maman-2026-03-07.yaml');
  assert.strictEqual(sv.nomFichierSauvegarde('../../etc', MAINTENANT), 'budget-etc-2026-03-07.yaml');
  assert.strictEqual(sv.nomFichierSauvegarde('a_b-c', MAINTENANT), 'budget-a_b-c-2026-03-07.yaml');
  assert.strictEqual(sv.nomFichierSauvegarde('!!!', MAINTENANT), 'budget-sauvegarde-2026-03-07.yaml');
  assert.strictEqual(sv.nomFichierSauvegarde('', MAINTENANT), 'budget-sauvegarde-2026-03-07.yaml');
  const long = sv.nomFichierSauvegarde('x'.repeat(100), MAINTENANT);
  assert.strictEqual(long, 'budget-' + 'x'.repeat(40) + '-2026-03-07.yaml');
});

test('aller-retour : export, lecture, import dans un dossier vide', async () => {
  const source = dossierComplet();
  const { texte } = await sv.exporterSauvegarde(source, { nom: 'Famille', maintenant: MAINTENANT });
  const sauvegarde = await sv.lireSauvegarde(texte);
  assert.strictEqual(sauvegarde.nom, 'Famille');
  assert.strictEqual(sauvegarde.exporteLe, '2026-03-07T10:20:30.000Z');
  const cible = fakeDir();
  const r = await sv.importerSauvegarde(sauvegarde, cible, { confirmerRemplacement: async function () { throw new Error('ne doit pas être appelé'); } });
  assert.deepStrictEqual(r.ecrits.slice().sort(), ['donnees-courantes.yaml', 'evenements-futurs.yaml', 'paliers.yaml', 'parametres.yaml']);
  assert.deepStrictEqual(await store.loadAll(cible), await store.loadAll(source));
  assert.ok(!cible.files.has('historique-comptes.csv'));
});

test('texte préservé octet pour octet (commentaires, espaces, sans saut de ligne final)', async () => {
  const bizarre = '# commentaire\nsituation:\n  compte_courant:    1200   \n  epargne: 3000\t\n\n\n# fin sans retour';
  const source = fakeDir({ 'donnees-courantes.yaml': bizarre, 'parametres.yaml': PARAMETRES.replace('\n', '\r\n') });
  const { texte } = await sv.exporterSauvegarde(source, { maintenant: MAINTENANT });
  const cible = fakeDir();
  await sv.importerSauvegarde(await sv.lireSauvegarde(texte), cible, { confirmerRemplacement: async function () { return true; } });
  assert.strictEqual(cible.files.get('donnees-courantes.yaml'), bizarre);
  assert.strictEqual(cible.files.get('parametres.yaml'), PARAMETRES.replace('\n', '\r\n'));
});

test('lecture : refus (pas du YAML, mauvais format, version, fichiers)', async () => {
  await refuse(sv.lireSauvegarde('a: [1'), /n’est pas un YAML valide|n'est pas un YAML valide/);
  await refuse(sv.lireSauvegarde('- 1\n- 2\n'), /pas une sauvegarde/);
  await refuse(sv.lireSauvegarde(bundle(function (b) { b.format = 'autre'; return b; })), /pas une sauvegarde/);
  await refuse(sv.lireSauvegarde(bundle(function (b) { b.version_format = 2; return b; })), /version plus récente/);
  await refuse(sv.lireSauvegarde(bundle(function (b) { delete b.fichiers; return b; })), /fichiers/);
  await refuse(sv.lireSauvegarde(bundle(function (b) { b.fichiers = ['a']; return b; })), /fichiers/);
});

test('lecture : clé hors liste blanche et valeur non texte', async () => {
  await refuse(sv.lireSauvegarde(bundle(function (b) { b.fichiers['../evil.yaml'] = 'x: 1\n'; return b; })), /fichier non autorisé/);
  await refuse(sv.lireSauvegarde(bundle(function (b) { b.fichiers['historique-comptes.csv'] = 'x'; return b; })), /fichier non autorisé/);
  await refuse(sv.lireSauvegarde(bundle(function (b) { b.fichiers['parametres.yaml'] = 12; return b; })), /doit être un texte/);
});

test('lecture : taille maximale 5 Mo et donnees absentes', async () => {
  const gros = bundle(function (b) { b.fichiers['evenements-futurs.yaml'] = '#' + 'a'.repeat(5 * 1024 * 1024); return b; });
  await refuse(sv.lireSauvegarde(gros), /trop volumineuse/);
  await refuse(sv.lireSauvegarde(bundle(function (b) { b.fichiers = { 'parametres.yaml': PARAMETRES }; return b; })), /donnees-courantes\.yaml/);
});

test('lecture : contenu invalide, erreur nommant le fichier', async () => {
  const paliersKo = 'paliers:\n  - ligne: { nature: mensuel, type: revenu, categorie: Salaire, libelle: Salaire A }\n    etapes:\n      - { depuis: 2028-01, montant: 2600 }\n      - { depuis: 2027-01, montant: 2700 }\n';
  await refuse(sv.lireSauvegarde(bundle(function (b) { b.fichiers['paliers.yaml'] = paliersKo; return b; })), /^Sauvegarde invalide : paliers\.yaml/);
  await refuse(sv.lireSauvegarde(bundle(function (b) { b.fichiers['parametres.yaml'] = 'horizon_annees: [12\n'; return b; })), /^Sauvegarde invalide : parametres\.yaml : YAML invalide/);
});

test('import : confirmation reçoit exactement les fichiers existants ; refus = rien écrit', async () => {
  const sauvegarde = await sv.lireSauvegarde((await sv.exporterSauvegarde(dossierComplet(), { maintenant: MAINTENANT })).texte);
  const cible = fakeDir({ 'donnees-courantes.yaml': 'situation: {}\n', 'parametres.yaml': 'depart: 2030-01\nhorizon_annees: 10\nrevalorisation: { taux: 0.01, mois: 2 }\n', 'historique-comptes.csv': 'ancien' });
  const avant = new Map(cible.files);
  let recu = null;
  await assert.rejects(sv.importerSauvegarde(sauvegarde, cible, { confirmerRemplacement: async function (noms) { recu = noms; return false; } }), function (e) {
    assert.match(e.message, /Import annulé/);
    assert.strictEqual(e.annule, true);
    return true;
  });
  assert.deepStrictEqual(recu.slice().sort(), ['donnees-courantes.yaml', 'parametres.yaml']);
  assert.deepStrictEqual(cible.files, avant);
});

test('import accepté : remplace, ne touche pas aux fichiers absents de la sauvegarde', async () => {
  const mince = await sv.lireSauvegarde((await sv.exporterSauvegarde(fakeDir({ 'donnees-courantes.yaml': DONNEES }), { maintenant: MAINTENANT })).texte);
  const cible = fakeDir({ 'donnees-courantes.yaml': 'situation: {}\n', 'paliers.yaml': 'paliers: []\n', 'historique-comptes.csv': 'ancien' });
  const r = await sv.importerSauvegarde(mince, cible, { confirmerRemplacement: async function () { return true; } });
  assert.deepStrictEqual(r.ecrits, ['donnees-courantes.yaml']);
  assert.strictEqual(cible.files.get('donnees-courantes.yaml'), DONNEES);
  assert.strictEqual(cible.files.get('paliers.yaml'), 'paliers: []\n');
  assert.strictEqual(cible.files.get('historique-comptes.csv'), 'ancien');
});

test('import : n’écrit jamais hors de la liste blanche', async () => {
  const cible = fakeDir();
  await refuse(sv.importerSauvegarde({ nom: 'x', exporteLe: '', fichiers: { 'donnees-courantes.yaml': DONNEES, '../evil.yaml': 'x' } }, cible, { confirmerRemplacement: async function () { return true; } }), /fichier non autorisé/);
  assert.strictEqual(cible.files.size, 0);
});

// ---- Correctifs de revue ----

async function sauvegardeComplete() {
  return sv.lireSauvegarde((await sv.exporterSauvegarde(dossierComplet(), { maintenant: MAINTENANT })).texte);
}

const OUI = { confirmerRemplacement: async function () { return true; } };

test('lecture : donnees vide, commentaires seuls ou scalaire refusés', async () => {
  for (const contenu of ['', '   \n\n', '# rien que des commentaires\n', 'juste un texte\n', '- 1\n- 2\n']) {
    await refuse(sv.lireSauvegarde(bundle(function (b) { b.fichiers['donnees-courantes.yaml'] = contenu; return b; })), /donnees-courantes\.yaml est vide ou n’a pas la forme attendue/);
  }
});

test('lecture : fichiers optionnels vides refusés', async () => {
  for (const nom of ['parametres.yaml', 'paliers.yaml', 'evenements-futurs.yaml']) {
    await refuse(sv.lireSauvegarde(bundle(function (b) { b.fichiers[nom] = '# vide\n'; return b; })), new RegExp(nom.replace('.', '\\.') + ' est vide'));
  }
  await refuse(sv.lireSauvegarde(bundle(function (b) { b.fichiers['evenements-futurs.yaml'] = 'a: 1\n'; return b; })), /evenements-futurs\.yaml/);
});

test('donnees vide : refusé avant tout import, cible intacte', async () => {
  const cible = fakeDir({ 'donnees-courantes.yaml': DONNEES });
  await assert.rejects(sv.lireSauvegarde(bundle(function (b) { b.fichiers['donnees-courantes.yaml'] = '# vide\n'; return b; })));
  assert.strictEqual(cible.files.get('donnees-courantes.yaml'), DONNEES);
});

test('lecture : taille comptée en octets', async () => {
  // 2 Mo de caractères sur 3 octets = 6 Mo > 5 Mo, alors que le nombre de caractères reste sous la limite
  const gros = '#' + '€'.repeat(2 * 1024 * 1024);
  await refuse(sv.lireSauvegarde(bundle(function (b) { b.fichiers['evenements-futurs.yaml'] = gros; return b; })), /trop volumineuse/);
});

test('import : échec d’écriture au 2e fichier, le 1er est restauré octet pour octet', async () => {
  const sauvegarde = await sauvegardeComplete();
  const cible = fakeDir({ 'donnees-courantes.yaml': 'ancien donnees\n', 'paliers.yaml': 'ancien paliers\n' });
  const base = cible.getFileHandle.bind(cible);
  cible.getFileHandle = async function (nom, opts) {
    const h = await base(nom, opts);
    if (nom !== 'evenements-futurs.yaml' || !(opts && opts.create)) return h;
    return { getFile: h.getFile, async createWritable() { return { async write() { throw new Error('disque plein'); }, async close() {} }; } };
  };
  await assert.rejects(sv.importerSauvegarde(sauvegarde, cible, OUI), function (e) {
    assert.strictEqual(e.interrompu, true);
    assert.match(e.message, /^Import interrompu \(disque plein\)/);
    assert.match(e.message, /1 remplacé\(s\) puis restauré\(s\) \(donnees-courantes\.yaml\)/);
    assert.match(e.message, /3 non écrit\(s\) \(evenements-futurs\.yaml, parametres\.yaml, paliers\.yaml\)/);
    return true;
  });
  assert.strictEqual(cible.files.get('donnees-courantes.yaml'), 'ancien donnees\n');
  assert.strictEqual(cible.files.get('paliers.yaml'), 'ancien paliers\n');
  assert.ok(!cible.files.has('parametres.yaml'));
});

test('import : échec de restauration signalé', async () => {
  const sauvegarde = await sauvegardeComplete();
  const cible = fakeDir({ 'donnees-courantes.yaml': 'ancien donnees\n' });
  const base = cible.getFileHandle.bind(cible);
  let ecritDonnees = 0;
  cible.getFileHandle = async function (nom, opts) {
    const h = await base(nom, opts);
    if (!(opts && opts.create)) return h;
    if (nom === 'evenements-futurs.yaml') return { getFile: h.getFile, async createWritable() { return { async write() { throw new Error('panne'); }, async close() {} }; } };
    if (nom === 'donnees-courantes.yaml' && ++ecritDonnees === 2) return { getFile: h.getFile, async createWritable() { return { async write() { throw new Error('restauration impossible'); }, async close() {} }; } };
    return h;
  };
  await assert.rejects(sv.importerSauvegarde(sauvegarde, cible, OUI), function (e) {
    assert.match(e.message, /NON restauré\(s\), contenu à vérifier \(donnees-courantes\.yaml\)/);
    return true;
  });
});

test('import : erreur autre que NotFoundError propagée, rien écrit', async () => {
  const sauvegarde = await sauvegardeComplete();
  const cible = fakeDir({ 'donnees-courantes.yaml': 'ancien\n' });
  const base = cible.getFileHandle.bind(cible);
  cible.getFileHandle = async function (nom, opts) {
    if (nom === 'parametres.yaml' && !(opts && opts.create)) { const e = new Error('accès refusé'); e.name = 'NotAllowedError'; throw e; }
    return base(nom, opts);
  };
  await refuse(sv.importerSauvegarde(sauvegarde, cible, OUI), /accès refusé/);
  assert.strictEqual(cible.files.get('donnees-courantes.yaml'), 'ancien\n');
  assert.strictEqual(cible.files.size, 1);
});

test('première ligne avec espace initial préservée', async () => {
  const texte0 = '  # première ligne indentée\nsituation:\n  epargne: 3000\n';
  const { texte } = await sv.exporterSauvegarde(fakeDir({ 'donnees-courantes.yaml': texte0 }), { maintenant: MAINTENANT });
  const s = await sv.lireSauvegarde(texte);
  assert.strictEqual(s.fichiers['donnees-courantes.yaml'], texte0);
});

test('exporte_le lu comme Date par js-yaml : aller-retour', async () => {
  const brut = 'format: budget-sauvegarde\nversion_format: 1\napplication: budget-previsionnel\nexporte_le: 2026-03-07T10:20:30.000Z\nnom: x\nfichiers:\n  donnees-courantes.yaml: |\n    situation:\n      epargne: 1\n';
  assert.ok(yaml.load(brut).exporte_le instanceof Date);
  const s = await sv.lireSauvegarde(brut);
  assert.strictEqual(s.exporteLe, '2026-03-07T10:20:30.000Z');
});
