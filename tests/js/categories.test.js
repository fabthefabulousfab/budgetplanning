const test = require('node:test');
const assert = require('node:assert');
const C = require('../../js/categories.js');

const donnees = () => ({
  situation: { compte_courant: 0, epargne: 0 },
  mensuel: [
    { type: 'depense', categorie: 'Logement', libelle: 'Loyer', montant: 800 },
    { type: 'depense', categorie: 'Cantine', libelle: 'Cantine', montant: 50 },
    { type: 'revenu', categorie: 'Salaires', libelle: 'Salaire', montant: 2000 },
  ],
  annuel: [
    { type: 'depense', categorie: 'Impôts et taxes', libelle: 'Taxe', echeances: '9-500' },
    { type: 'revenu', categorie: 'Logement', libelle: 'Remboursement', echeances: '5-100' },
  ],
  exceptionnel: [
    { type: 'depense', categorie: 'logement ', libelle: 'Travaux', echeances: '2027-3-900' },
  ],
});

const sansCategories = () => ({ depart: '2026-10', horizon_annees: 10, revalorisation: { taux: 0.02, mois: 1 }, solde_depart: { compte_courant: null, epargne: null } });
const avecCategories = (cats) => Object.assign(sansCategories(), { categories: cats });

test('CATEGORIES_DEFAUT : contenu attendu', () => {
  assert.deepStrictEqual(C.CATEGORIES_DEFAUT.depense, ['Logement', 'Alimentation', 'Transport', 'Santé', 'Enfants et éducation', 'Loisirs', 'Abonnements', 'Assurances', 'Impôts et taxes', 'Vêtements', 'Cadeaux', 'Épargne', 'Autre']);
  assert.deepStrictEqual(C.CATEGORIES_DEFAUT.revenu, ['Salaires', 'Allocations', 'Primes', 'Loyers perçus', 'Autres revenus']);
});

test('nomCategorieValide : trim, espaces internes réduits', () => {
  assert.strictEqual(C.nomCategorieValide('  Enfants   et \t éducation  '), 'Enfants et éducation');
  assert.strictEqual(C.nomCategorieValide(null), '');
  assert.strictEqual(C.nomCategorieValide('   '), '');
});

test('categoriesDisponibles : liste de paramètres dans son ordre, puis les catégories utilisées absentes (alphabétique)', () => {
  const p = avecCategories({ depense: ['Transport', 'Logement'], revenu: ['Primes'] });
  assert.deepStrictEqual(C.categoriesDisponibles(donnees(), p, 'depense'), ['Transport', 'Logement', 'Cantine', 'Impôts et taxes']);
  assert.deepStrictEqual(C.categoriesDisponibles(donnees(), p, 'revenu'), ['Primes', 'Logement', 'Salaires']);
});

test('categoriesDisponibles : insensible à la casse et aux espaces autour (« logement  » est « Logement »)', () => {
  const p = avecCategories({ depense: ['Logement'], revenu: [] });
  const r = C.categoriesDisponibles(donnees(), p, 'depense');
  assert.strictEqual(r.filter((x) => x.trim().toLowerCase() === 'logement').length, 1);
});

test('categoriesDisponibles : Santé et Sante sont deux catégories', () => {
  const d = { mensuel: [{ type: 'depense', categorie: 'Sante', libelle: 'a', montant: 1 }], annuel: [], exceptionnel: [] };
  const p = avecCategories({ depense: ['Santé'], revenu: [] });
  assert.deepStrictEqual(C.categoriesDisponibles(d, p, 'depense'), ['Santé', 'Sante']);
});

test('categoriesDisponibles : sans clé categories, seulement les catégories utilisées (alphabétique), aucune injection par défaut', () => {
  assert.deepStrictEqual(C.categoriesDisponibles(donnees(), sansCategories(), 'depense'), ['Cantine', 'Impôts et taxes', 'Logement']);
  assert.deepStrictEqual(C.categoriesDisponibles(donnees(), sansCategories(), 'revenu'), ['Logement', 'Salaires']);
  assert.deepStrictEqual(C.categoriesDisponibles({ mensuel: [], annuel: [], exceptionnel: [] }, sansCategories(), 'depense'), []);
});

test('categoriesDisponibles : params ou données absents, rien ne casse', () => {
  assert.deepStrictEqual(C.categoriesDisponibles(null, null, 'depense'), []);
  assert.deepStrictEqual(C.categoriesDisponibles({}, { categories: { depense: ['A'] } }, 'depense'), ['A']);
  assert.deepStrictEqual(C.categoriesDisponibles({}, { categories: { depense: ['A'] } }, 'revenu'), []);
});

test('compterUsages : par type, insensible à la casse et aux espaces', () => {
  assert.strictEqual(C.compterUsages(donnees(), 'depense', 'Logement'), 2);
  assert.strictEqual(C.compterUsages(donnees(), 'revenu', 'Logement'), 1);
  assert.strictEqual(C.compterUsages(donnees(), 'depense', 'Inconnue'), 0);
});

test('ajouterCategorie : ajoute à la fin, nettoie le nom, ne modifie pas ses entrées', () => {
  const p = avecCategories({ depense: ['A'], revenu: ['R'] });
  const avant = JSON.stringify(p);
  const r = C.ajouterCategorie(p, 'depense', '  Mon   truc ');
  assert.deepStrictEqual(r.categories, { depense: ['A', 'Mon truc'], revenu: ['R'] });
  assert.strictEqual(JSON.stringify(p), avant);
  assert.notStrictEqual(r, p);
});

test('ajouterCategorie : refuse vide, doublon (casse ignorée), trop long', () => {
  const p = avecCategories({ depense: ['Logement'], revenu: [] });
  assert.throws(() => C.ajouterCategorie(p, 'depense', '   '), /vide|nom/i);
  assert.throws(() => C.ajouterCategorie(p, 'depense', ' logement '), /existe déjà/);
  assert.throws(() => C.ajouterCategorie(p, 'depense', 'x'.repeat(61)), /60/);
  assert.doesNotThrow(() => C.ajouterCategorie(p, 'depense', 'x'.repeat(60)));
  assert.doesNotThrow(() => C.ajouterCategorie(p, 'revenu', 'Logement'));
});

test('ajouterCategorie : refuse au-delà de 100 catégories', () => {
  const liste = Array.from({ length: 100 }, (_, i) => 'c' + i);
  const p = avecCategories({ depense: liste, revenu: [] });
  assert.throws(() => C.ajouterCategorie(p, 'depense', 'de trop'), /100/);
});

test('ajouterCategorie : sans clé categories, matérialise d’abord la liste disponible (les catégories existantes restent)', () => {
  const r = C.ajouterCategorie(sansCategories(), 'depense', 'Nouvelle', donnees());
  assert.deepStrictEqual(r.categories.depense, ['Cantine', 'Impôts et taxes', 'Logement', 'Nouvelle']);
  assert.deepStrictEqual(r.categories.revenu, ['Logement', 'Salaires']);
  assert.deepStrictEqual(C.categoriesDisponibles(donnees(), r, 'depense'), ['Cantine', 'Impôts et taxes', 'Logement', 'Nouvelle']);
});

test('ajouterCategorie : le doublon est testé aussi contre une catégorie déjà utilisée', () => {
  assert.throws(() => C.ajouterCategorie(sansCategories(), 'depense', 'cantine', donnees()), /existe déjà/);
});

test('renommerCategorie : liste et lignes du bon type uniquement (mensuel, annuel, exceptionnel)', () => {
  const d = donnees();
  const p = avecCategories({ depense: ['Logement', 'Transport'], revenu: ['Salaires', 'Logement'] });
  const avantD = JSON.stringify(d);
  const avantP = JSON.stringify(p);
  const r = C.renommerCategorie(d, p, 'depense', 'Logement', 'Habitat');
  assert.deepStrictEqual(r.params.categories.depense, ['Habitat', 'Transport']);
  assert.deepStrictEqual(r.params.categories.revenu, ['Salaires', 'Logement']);
  assert.strictEqual(r.donnees.mensuel[0].categorie, 'Habitat');
  assert.strictEqual(r.donnees.exceptionnel[0].categorie, 'Habitat'); // « logement » (casse et espace) suit
  assert.strictEqual(r.donnees.annuel[1].categorie, 'Logement'); // revenu : inchangé
  assert.strictEqual(r.donnees.mensuel[1].categorie, 'Cantine');
  assert.strictEqual(JSON.stringify(d), avantD);
  assert.strictEqual(JSON.stringify(p), avantP);
  assert.notStrictEqual(r.donnees.mensuel[0], d.mensuel[0]);
  assert.notStrictEqual(r.donnees.mensuel, d.mensuel);
});

test('renommerCategorie : les lignes conservent leurs paliers et leurs autres champs', () => {
  const d = donnees();
  d.mensuel[0].paliers = [{ depuis: '2027-01', montant: 900 }];
  d.mensuel[0].actif = false;
  const r = C.renommerCategorie(d, avecCategories({ depense: ['Logement'], revenu: [] }), 'depense', 'Logement', 'Habitat');
  assert.deepStrictEqual(r.donnees.mensuel[0].paliers, [{ depuis: '2027-01', montant: 900 }]);
  assert.strictEqual(r.donnees.mensuel[0].actif, false);
  assert.strictEqual(r.donnees.mensuel[0].libelle, 'Loyer');
});

test('renommerCategorie : refuse vide, trop long, cible existante (message : supprimer ou déplacer), source inconnue', () => {
  const d = donnees();
  const p = avecCategories({ depense: ['Logement', 'Transport'], revenu: [] });
  assert.throws(() => C.renommerCategorie(d, p, 'depense', 'Logement', '  '), /vide|nom/i);
  assert.throws(() => C.renommerCategorie(d, p, 'depense', 'Logement', 'x'.repeat(61)), /60/);
  assert.throws(() => C.renommerCategorie(d, p, 'depense', 'Logement', ' transport '), /supprim|déplac/i);
  assert.throws(() => C.renommerCategorie(d, p, 'depense', 'Logement', 'Cantine'), /existe déjà/); // utilisée mais hors liste
  assert.throws(() => C.renommerCategorie(d, p, 'depense', 'Fantôme', 'Autre'), /introuvable|inconnue/i);
});

test('renommerCategorie : changer seulement la casse est permis ; même nom = aucun changement', () => {
  const d = donnees();
  const p = avecCategories({ depense: ['Logement'], revenu: [] });
  const r = C.renommerCategorie(d, p, 'depense', 'Logement', 'LOGEMENT');
  assert.deepStrictEqual(r.params.categories.depense, ['LOGEMENT']);
  assert.strictEqual(r.donnees.mensuel[0].categorie, 'LOGEMENT');
  const idem = C.renommerCategorie(d, p, 'depense', 'Logement', 'Logement');
  assert.deepStrictEqual(idem.params.categories.depense, ['Logement']);
});

test('renommerCategorie : sans clé categories, renomme les lignes et laisse la clé absente', () => {
  const r = C.renommerCategorie(donnees(), sansCategories(), 'depense', 'Cantine', 'Restauration');
  assert.strictEqual(r.params.categories, undefined);
  assert.strictEqual(r.donnees.mensuel[1].categorie, 'Restauration');
  assert.deepStrictEqual(C.categoriesDisponibles(r.donnees, r.params, 'depense'), ['Impôts et taxes', 'Logement', 'Restauration']);
});

test('renommerCategorie : Unicode, Sante est distincte de Santé', () => {
  const d = { mensuel: [{ type: 'depense', categorie: 'Santé', libelle: 'a', montant: 1 }, { type: 'depense', categorie: 'Sante', libelle: 'b', montant: 1 }], annuel: [], exceptionnel: [] };
  const p = avecCategories({ depense: ['Santé', 'Sante'], revenu: [] });
  const r = C.renommerCategorie(d, p, 'depense', 'Santé', 'Soins');
  assert.deepStrictEqual(r.donnees.mensuel.map((l) => l.categorie), ['Soins', 'Sante']);
});

test('supprimerCategorie : inutilisée, vers ignoré', () => {
  const p = avecCategories({ depense: ['Logement', 'Vide'], revenu: [] });
  const d = donnees();
  const r = C.supprimerCategorie(d, p, 'depense', 'Vide', 'inexistante');
  assert.deepStrictEqual(r.params.categories.depense, ['Logement']);
  assert.deepStrictEqual(r.donnees, d);
});

test('supprimerCategorie : utilisée, déplace les lignes vers la catégorie choisie (du même type)', () => {
  const p = avecCategories({ depense: ['Logement', 'Transport'], revenu: ['Logement'] });
  const d = donnees();
  const avantD = JSON.stringify(d);
  const avantP = JSON.stringify(p);
  const r = C.supprimerCategorie(d, p, 'depense', 'Logement', 'transport');
  assert.deepStrictEqual(r.params.categories.depense, ['Transport']);
  assert.deepStrictEqual(r.params.categories.revenu, ['Logement']);
  assert.strictEqual(r.donnees.mensuel[0].categorie, 'Transport');
  assert.strictEqual(r.donnees.exceptionnel[0].categorie, 'Transport');
  assert.strictEqual(r.donnees.annuel[1].categorie, 'Logement'); // revenu
  assert.strictEqual(JSON.stringify(d), avantD);
  assert.strictEqual(JSON.stringify(p), avantP);
});

test('supprimerCategorie : utilisée sans vers, vers inconnu, vers = la supprimée, vers d’un autre type : refus', () => {
  const p = avecCategories({ depense: ['Logement', 'Transport'], revenu: ['Salaires'] });
  const d = donnees();
  assert.throws(() => C.supprimerCategorie(d, p, 'depense', 'Logement'), /vers|déplac/i);
  assert.throws(() => C.supprimerCategorie(d, p, 'depense', 'Logement', ''), /vers|déplac/i);
  assert.throws(() => C.supprimerCategorie(d, p, 'depense', 'Logement', 'Nulle part'), /introuvable|existe/i);
  assert.throws(() => C.supprimerCategorie(d, p, 'depense', 'Logement', ' logement '), /autre/i);
  assert.throws(() => C.supprimerCategorie(d, p, 'depense', 'Logement', 'Salaires'), /introuvable|existe/i);
});

test('supprimerCategorie : la dernière catégorie d’un type peut être supprimée', () => {
  const d = { mensuel: [], annuel: [], exceptionnel: [] };
  const r = C.supprimerCategorie(d, avecCategories({ depense: ['Seule'], revenu: [] }), 'depense', 'Seule');
  assert.deepStrictEqual(r.params.categories.depense, []);
});

test('supprimerCategorie : catégorie utilisée mais hors liste, les lignes sont déplacées', () => {
  const p = avecCategories({ depense: ['Transport'], revenu: [] });
  const r = C.supprimerCategorie(donnees(), p, 'depense', 'Cantine', 'Transport');
  assert.strictEqual(r.donnees.mensuel[1].categorie, 'Transport');
  assert.deepStrictEqual(r.params.categories.depense, ['Transport']);
});

test('supprimerCategorie : sans clé categories, déplace les lignes, la clé reste absente', () => {
  const r = C.supprimerCategorie(donnees(), sansCategories(), 'depense', 'Cantine', 'Logement');
  assert.strictEqual(r.params.categories, undefined);
  assert.deepStrictEqual(C.categoriesDisponibles(r.donnees, r.params, 'depense'), ['Impôts et taxes', 'Logement']);
});
