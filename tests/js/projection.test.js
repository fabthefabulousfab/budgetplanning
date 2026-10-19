const test = require('node:test');
const assert = require('node:assert');
const { project, PARAMETRES_DEFAUT } = require('../../js/projection.js');

const P = { depart: '2026-10', horizon_annees: 1, revalorisation: { taux: 0.02, mois: 1 } };
function donnees(over) {
  return Object.assign({ situation: { compte_courant: 1000, epargne: 500 }, mensuel: [], annuel: [], exceptionnel: [] }, over);
}
function mois(res, k) { return res.find((m) => m.ym === k); }

test('defauts', () => {
  assert.deepEqual(PARAMETRES_DEFAUT, { depart: '2026-10', horizon_annees: 15, revalorisation: { taux: 0.02, mois: 1 } });
});

test('(a) depense mensuelle sans fin', () => {
  const r = project(donnees({ mensuel: [{ type: 'depense', categorie: 'c', libelle: 'l', montant: 100 }] }), [], P);
  assert.equal(r.length, 12);
  r.forEach((m, i) => {
    assert.equal(m.depenses, 100);
    assert.equal(m.revenus, 0);
    assert.equal(m.net, -100);
    assert.equal(m.solde, 1500 - 100 * (i + 1));
  });
});

test('(b) fin 2026-12', () => {
  const r = project(donnees({ mensuel: [{ type: 'depense', categorie: 'c', libelle: 'l', montant: 100, fin: '2026-12' }] }), [], P);
  assert.deepEqual(r.map((m) => m.depenses), [100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('(c) revalorisation', () => {
  const r = project(donnees({ mensuel: [{ type: 'revenu', categorie: 'c', libelle: 'l', montant: 1000, revalorise: true }] }), [], P);
  assert.equal(mois(r, '2026-10').revenus, 1000);
  assert.equal(mois(r, '2026-12').revenus, 1000);
  assert.ok(Math.abs(mois(r, '2027-01').revenus - 1020) < 1e-9);
});

test('(d) annuel 3:600', () => {
  const r = project(donnees({ annuel: [{ type: 'revenu', categorie: 'c', libelle: 'l', echeances: '3:600' }] }), [], P);
  r.forEach((m) => assert.equal(m.revenus, m.ym === '2027-03' ? 600 : 0));
});

test('(e) annuel avec debut', () => {
  const r = project(donnees({ annuel: [{ type: 'revenu', categorie: 'c', libelle: 'l', echeances: '3:600', debut: '2029-01' }] }), [], P);
  r.forEach((m) => assert.equal(m.revenus, 0));
});

test('(f) exceptionnel', () => {
  const r = project(donnees({ exceptionnel: [{ type: 'depense', categorie: 'c', libelle: 'l', echeances: '2027-05:1500' }] }), [], P);
  r.forEach((m) => assert.equal(m.depenses, m.ym === '2027-05' ? 1500 : 0));
});

test('(g) evenement mensuel borne', () => {
  const ev = [{ type: 'revenu', categorie: 'c', libelle: 'l', montant: '800', debut: '2027-01', fin: '2027-02' }];
  const r = project(donnees(), ev, P);
  r.forEach((m) => assert.equal(m.revenus, m.ym === '2027-01' || m.ym === '2027-02' ? 800 : 0));
});

test('(h) evenement annuel', () => {
  const ev = [{ type: 'depense', categorie: 'c', libelle: 'l', montant: '3-300', debut: '2027-01' }];
  const r = project(donnees(), ev, P);
  r.forEach((m) => assert.equal(m.depenses, m.ym === '2027-03' ? 300 : 0));
});

test('(i) evenement date', () => {
  const ev = [{ type: 'revenu', categorie: 'c', libelle: 'l', montant: '2026-12-400' }];
  const r = project(donnees(), ev, P);
  r.forEach((m) => assert.equal(m.revenus, m.ym === '2026-12' ? 400 : 0));
});

test('(j) solde initial', () => {
  const r = project(donnees(), [], P);
  assert.equal(r[0].solde, 1500);
});

test('(k) hors fenetre ignore', () => {
  const d = donnees({ exceptionnel: [
    { type: 'depense', categorie: 'c', libelle: 'l', echeances: '2020-05:10' },
    { type: 'depense', categorie: 'c', libelle: 'l', echeances: '2040-05:10' },
  ] });
  const r = project(d, [], P);
  assert.equal(r.length, 12);
  r.forEach((m) => assert.equal(m.depenses, 0));
});
