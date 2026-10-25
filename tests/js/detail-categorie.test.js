const test = require('node:test');
const assert = require('node:assert');
const { detailParCategorie } = require('../../js/summary.js');
const { project } = require('../../js/projection.js');
const { lignesFutures } = require('../../js/prets.js');

const P = { depart: '2026-10', horizon_annees: 2, revalorisation: { taux: 0.1, mois: 1 } };
const D = {
  situation: { compte_courant: 100, epargne: 50 },
  mensuel: [
    { type: 'revenu', categorie: 'Salaire', libelle: 'paie', montant: 3000, revalorise: true },
    { type: 'revenu', categorie: 'Salaire', libelle: 'prime mensuelle', montant: 100 },
    { type: 'depense', categorie: 'Vie', libelle: 'courses', montant: 2000, revalorise: true },
    { type: 'depense', categorie: 'Vie', libelle: 'transports', montant: 150 },
    { type: 'depense', categorie: 'Logement', libelle: 'loyer', montant: 800, paliers: [{ depuis: '2027-02', montant: 900 }] },
    { type: 'depense', categorie: 'Vie', libelle: 'masquée', montant: 777, actif: false },
    { type: 'depense', categorie: 'Zéro', libelle: 'rien', montant: 0 },
    { type: 'depense', libelle: 'divers', montant: 10 },
  ],
  annuel: [{ type: 'depense', categorie: 'Vie', libelle: 'taxe', echeances: '3-600', revalorise: true }],
  exceptionnel: [{ type: 'revenu', categorie: 'Salaire', libelle: 'bonus', echeances: '2027-03-400' }],
};
const EV = [{ id: 'e', type: 'depense', categorie: 'Achat', libelle: 'voyage', echeances: '2027-03-1000' }];
const PRETS = [{ id: 'p', statut: 'simule', libelle: 'Étudiant', montant: 1200, mise_a_disposition: '2027-03', duree_mois: 12 }];
const futurs = lignesFutures(EV, PRETS);
const proche = function (a, b, msg) { assert.ok(Math.abs(a - b) < 1e-6, msg + ' : ' + a + ' vs ' + b); };
const somme = function (col) { return col.categories.reduce(function (a, c) { return a + c.total; }, 0); };
const cat = function (col, nom) { return col.categories.find(function (c) { return c.categorie === nom; }); };

test('detailParCategorie : les groupes égalent revenus, dépenses, net et solde de project() pour chaque mois', () => {
  project(D, futurs, P).forEach(function (m) {
    const d = detailParCategorie(D, futurs, P, m.ym);
    assert.equal(d.ym, m.ym);
    proche(d.revenus.total, m.revenus, m.ym + ' revenus');
    proche(d.depenses.total, m.depenses, m.ym + ' dépenses');
    proche(somme(d.revenus), m.revenus, m.ym + ' somme revenus');
    proche(somme(d.depenses), m.depenses, m.ym + ' somme dépenses');
    proche(d.net, m.net, m.ym + ' net');
    proche(d.solde, m.solde, m.ym + ' solde');
    d.revenus.categories.concat(d.depenses.categories).forEach(function (c) {
      proche(c.lignes.reduce(function (a, l) { return a + l.montant; }, 0), c.total, m.ym + ' ' + c.categorie);
    });
  });
});

test('detailParCategorie : mars 2027, toutes origines, palier, prêt et revalorisation', () => {
  const d = detailParCategorie(D, futurs, P, '2027-03');
  const salaire = cat(d.revenus, 'Salaire');
  assert.deepEqual(salaire.lignes.map(function (l) { return l.libelle + ':' + l.origine; }), ['paie:mensuel', 'bonus:exceptionnel', 'prime mensuelle:mensuel']);
  proche(salaire.lignes[0].montant, 3300, 'paie revalorisée');
  assert.deepEqual(cat(d.revenus, 'Prêt').lignes.map(function (l) { return l.origine; }), ['pret']);
  assert.equal(cat(d.revenus, 'Prêt').lignes[0].montant, 1200);
  assert.deepEqual(cat(d.depenses, 'Achat').lignes.map(function (l) { return l.origine; }), ['futur']);
  proche(cat(d.depenses, 'Logement').lignes[0].montant, 900, 'palier');
  assert.ok(cat(d.depenses, 'Vie').lignes.some(function (l) { return l.origine === 'annuel' && Math.abs(l.montant - 660) < 1e-6; }));
});

test('detailParCategorie : tri par total décroissant, puis par montant décroissant', () => {
  const d = detailParCategorie(D, futurs, P, '2027-03');
  [d.depenses, d.revenus].forEach(function (col) {
    const totaux = col.categories.map(function (c) { return c.total; });
    assert.deepEqual(totaux, totaux.slice().sort(function (a, b) { return b - a; }));
    col.categories.forEach(function (c) {
      const m = c.lignes.map(function (l) { return l.montant; });
      assert.deepEqual(m, m.slice().sort(function (a, b) { return b - a; }));
    });
  });
});

test('detailParCategorie : catégorie à zéro masquée, ligne masquée exclue, catégorie vide = Sans catégorie', () => {
  const d = detailParCategorie(D, futurs, P, '2026-10');
  const noms = d.depenses.categories.map(function (c) { return c.categorie; });
  assert.ok(!noms.includes('Zéro'));
  assert.ok(noms.includes('Sans catégorie'));
  assert.ok(d.depenses.categories.every(function (c) { return c.lignes.every(function (l) { return l.libelle !== 'masquée'; }); }));
});

test('detailParCategorie : même catégorie issue de plusieurs origines fusionnée en une seule', () => {
  const d = detailParCategorie(D, futurs, P, '2027-03');
  assert.equal(d.revenus.categories.filter(function (c) { return c.categorie === 'Salaire'; }).length, 1);
  const vie = d.depenses.categories.filter(function (c) { return c.categorie === 'Vie'; });
  assert.equal(vie.length, 1);
  assert.deepEqual(vie[0].lignes.map(function (l) { return l.origine; }).sort(), ['annuel', 'mensuel', 'mensuel']);
});

test('detailParCategorie : mois hors fenêtre, colonnes vides', () => {
  ['2026-09', '2040-01'].forEach(function (ym) {
    const d = detailParCategorie(D, futurs, P, ym);
    assert.deepEqual(d.revenus, { total: 0, categories: [] });
    assert.deepEqual(d.depenses, { total: 0, categories: [] });
    assert.equal(d.net, 0);
    assert.equal(d.solde, null);
  });
});
