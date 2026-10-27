const test = require('node:test');
const assert = require('node:assert');
const { detailMois, optionsPeriode, moisDePeriode } = require('../../js/summary.js');
const { project } = require('../../js/projection.js');

const P = { depart: '2026-10', horizon_annees: 2, revalorisation: { taux: 0.1, mois: 1 } };
const D = {
  situation: { compte_courant: 100, epargne: 50 },
  mensuel: [
    { type: 'revenu', categorie: 'salaire', libelle: 'paie', montant: 3000, taux_revalorisation: 10 },
    { type: 'depense', categorie: 'vie', libelle: 'vie', montant: 2000 },
    { type: 'depense', categorie: 'pret', libelle: 'pret', montant: 500, fin: '2027-02' },
  ],
  annuel: [{ type: 'depense', categorie: 'imp', libelle: 'taxe', echeances: '3-600', revalorise: true }],
  exceptionnel: [{ type: 'revenu', categorie: 'prime', libelle: 'prime', echeances: '2027-03-400' }],
};
const EV = [{ type: 'depense', categorie: 'voyage', libelle: 'voyage', echeances: '2027-03-1000' }];

const somme = function (d) {
  const s = function (a) { return a.reduce(function (x, l) { return x + l.montant; }, 0); };
  return d.mensuel.revenus - d.mensuel.depenses + s(d.annuel) + s(d.exceptionnel) + s(d.futurs);
};

test('(a) detail somme au net de project() sur 14 mois', () => {
  const mois = project(D, EV, P).slice(0, 14);
  mois.forEach(function (m) {
    const d = detailMois(D, EV, P, m.ym);
    assert.equal(d.ym, m.ym);
    assert.ok(Math.abs(somme(d) - m.net) < 1e-6, m.ym);
    assert.ok(Math.abs(d.net - m.net) < 1e-6, m.ym);
  });
  const mars = detailMois(D, EV, P, '2027-03');
  assert.equal(mars.annuel.length, 1);
  assert.equal(mars.exceptionnel[0].montant, 400);
  assert.equal(mars.futurs[0].montant, -1000);
  assert.ok(Math.abs(mars.annuel[0].montant + 600 * 1.1) < 1e-6);
  assert.ok(Math.abs(mars.mensuel.revenus - 3300) < 1e-6);
});

test('(b) mois avec seulement des lignes mensuelles', () => {
  const d = detailMois(D, EV, P, '2026-11');
  assert.deepEqual([d.annuel, d.exceptionnel, d.futurs], [[], [], []]);
  assert.equal(d.mensuel.revenus, 3000);
  assert.equal(d.mensuel.depenses, 2500);
});

test('(c) mois hors fenetre', () => {
  ['2026-09', '2028-10', '2040-01'].forEach(function (ym) {
    const d = detailMois(D, EV, P, ym);
    assert.deepEqual([d.annuel, d.exceptionnel, d.futurs], [[], [], []]);
    assert.equal(d.net, 0);
    assert.deepEqual(d.mensuel, { revenus: 0, depenses: 0 });
  });
});

test('(d) ligne terminee absente', () => {
  assert.equal(detailMois(D, EV, P, '2027-02').mensuel.depenses, 2500);
  assert.equal(detailMois(D, EV, P, '2027-03').mensuel.depenses, 2000);
});

test('(e) options de periode et decoupage', () => {
  const mois = project(D, EV, { depart: '2026-10', horizon_annees: 3 });
  const o = optionsPeriode(mois);
  assert.deepEqual(o.map(function (x) { return x.valeur; }), ['12', '2026', '2027', '2028', '2029']);
  assert.equal(o[0].libelle, '12 prochains mois');
  assert.equal(o[1].libelle, '2026');
  assert.equal(moisDePeriode(mois, '12').length, 12);
  assert.equal(moisDePeriode(mois, '12')[0].ym, '2026-10');
  assert.equal(moisDePeriode(mois, '2026').length, 3);
  assert.equal(moisDePeriode(mois, '2027').length, 12);
  assert.equal(moisDePeriode(mois, '2029').length, 9);
  assert.equal(moisDePeriode(mois, '1999'), null);
});
