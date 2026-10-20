const test = require('node:test');
const assert = require('node:assert');
const { bilanLignes, bilanParMois, bilanParAnnee, lignesInfobulle } = require('../../js/summary.js');
const { lignesPret } = require('../../js/prets.js');

const P = { depart: '2026-10', horizon_annees: 10 };
const ANNUEL = [
  { type: 'depense', categorie: 'imp', libelle: 'taxe', echeances: '3-600' },
  { type: 'revenu', categorie: 'prime', libelle: 'prime', echeances: '6-200' },
];
const EXC = [{ type: 'revenu', categorie: 'prime', libelle: 'bonus', echeances: '2027-1-1000' }, { type: 'depense', categorie: 'x', libelle: 'hors fenêtre', echeances: '2028-1-999' }];

test('bilan sur 12 mois : revenus, dépenses et net des lignes annuelles et exceptionnelles', () => {
  const b = bilanLignes(ANNUEL.concat(EXC), P, 12);
  assert.deepEqual(b, { revenus: 1200, depenses: 600, net: 600 });
});

test('bilan : la fenêtre commence au départ et compte exactement nbMois mois', () => {
  const ev = [
    { type: 'depense', categorie: 'Achat', libelle: 'dernier mois', echeances: '2036-9-100' },
    { type: 'depense', categorie: 'Achat', libelle: 'après la fenêtre', echeances: '2036-10-50' },
    { type: 'revenu', categorie: 'Revenu', libelle: 'avant le départ', echeances: '2026-9-70' },
  ];
  assert.deepEqual(bilanLignes(ev, P, 120), { revenus: 0, depenses: 100, net: -100 });
});

test('bilan : lignes masquées ignorées, mensuel compté mois par mois, prêts', () => {
  const lignes = [
    { type: 'depense', categorie: 'v', libelle: 'a', montant: 100 },
    { type: 'depense', categorie: 'v', libelle: 'b', montant: 999, actif: false },
  ];
  assert.equal(bilanLignes(lignes, P, 12).depenses, 1200);
  const prets = lignesPret([{ id: 'p', statut: 'en_cours', libelle: 'Voiture', mensualite: 300, fin: '2027-03' }]);
  assert.equal(bilanLignes(prets, P, 12).depenses, 1800);
  assert.deepEqual(bilanLignes([], P, 12), { revenus: 0, depenses: 0, net: 0 });
});

test('bilanParMois : 12 mois consécutifs depuis le départ, un seul passage par mois civil', () => {
  const m = bilanParMois(ANNUEL.concat(EXC), P, 12);
  assert.equal(m.length, 12);
  assert.equal(m[0].ym, '2026-10');
  assert.equal(m[11].ym, '2027-09');
  const par = function (ym) { return m.find(function (x) { return x.ym === ym; }); };
  assert.deepEqual([par('2027-01').revenus, par('2027-01').net], [1000, 1000]);
  assert.deepEqual([par('2027-03').depenses, par('2027-03').net], [600, -600]);
  assert.equal(par('2027-06').revenus, 200);
  assert.equal(m.reduce(function (a, x) { return a + x.net; }, 0), bilanLignes(ANNUEL.concat(EXC), P, 12).net);
});

test('bilanParAnnee : de l\'année de départ à +10 (11 années), première année partielle', () => {
  const ev = [
    { type: 'depense', categorie: 'Achat', libelle: 'avant départ', echeances: '2026-9-70' },
    { type: 'depense', categorie: 'Achat', libelle: 'oct 2026', echeances: '2026-10-100' },
    { type: 'revenu', categorie: 'Revenu', libelle: 'fin', echeances: '2036-12-500' },
    { type: 'revenu', categorie: 'Revenu', libelle: 'hors', echeances: '2037-1-999' },
    { type: 'depense', categorie: 'Achat', libelle: 'masquée', echeances: '2030-1-999', actif: false },
  ];
  const a = bilanParAnnee(ev, P, 10);
  assert.equal(a.length, 11);
  assert.deepEqual([a[0].annee, a[10].annee], [2026, 2036]);
  assert.deepEqual([a[0].depenses, a[0].net], [100, -100]);
  assert.deepEqual([a[10].revenus, a[10].net], [500, 500]);
  assert.equal(a.reduce(function (s, x) { return s + x.net; }, 0), 400);
});

test('infobulle : les libellés longs ne sont pas tronqués', () => {
  const lib = 'Inscription école avec un libellé vraiment très long pour le test';
  const d = { mensuel: { revenus: 0, depenses: 0 }, annuel: [{ libelle: lib, montant: -10 }], exceptionnel: [], futurs: [], prets: [] };
  const l = lignesInfobulle(d, { net: -10, solde: 0 }, String);
  assert.ok(l.corps.indexOf('  ' + lib + ' : -10') > 0);
});
