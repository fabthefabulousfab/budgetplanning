const test = require('node:test');
const assert = require('node:assert');
const { project, PARAMETRES_DEFAUT, soldeDepart } = require('../../js/projection.js');

const P = { depart: '2026-10', horizon_annees: 1, revalorisation: { taux: 0.02, mois: 1 } };
function donnees(over) {
  return Object.assign({ situation: { compte_courant: 1000, epargne: 500 }, mensuel: [], annuel: [], exceptionnel: [] }, over);
}
function mois(res, k) { return res.find((m) => m.ym === k); }

test('defauts', () => {
  assert.deepEqual(PARAMETRES_DEFAUT, { depart: '2026-10', horizon_annees: 15, revalorisation: { taux: 0.02, mois: 1 }, solde_depart: { compte_courant: null, epargne: null } });
});

test('soldeDepart: sans surcharge, valeurs Excel', () => {
  assert.deepEqual(soldeDepart(donnees(), PARAMETRES_DEFAUT), { compte_courant: 1000, epargne: 500, total: 1500 });
  assert.deepEqual(soldeDepart(donnees(), {}), { compte_courant: 1000, epargne: 500, total: 1500 });
});

test('soldeDepart: surcharges independantes, negatif, null', () => {
  const d = donnees();
  assert.deepEqual(soldeDepart(d, { solde_depart: { compte_courant: 200, epargne: null } }), { compte_courant: 200, epargne: 500, total: 700 });
  assert.deepEqual(soldeDepart(d, { solde_depart: { compte_courant: null, epargne: 0 } }), { compte_courant: 1000, epargne: 0, total: 1000 });
  assert.deepEqual(soldeDepart(d, { solde_depart: { compte_courant: -300, epargne: 50 } }), { compte_courant: -300, epargne: 50, total: -250 });
  assert.deepEqual(soldeDepart(d, { solde_depart: {} }), { compte_courant: 1000, epargne: 500, total: 1500 });
});

test('soldeDepart: situation absente = 0', () => {
  assert.deepEqual(soldeDepart({}, {}), { compte_courant: 0, epargne: 0, total: 0 });
  assert.deepEqual(soldeDepart(null, { solde_depart: { compte_courant: 10, epargne: null } }), { compte_courant: 10, epargne: 0, total: 10 });
});

test('project: solde initial avec et sans surcharge', () => {
  const d = donnees({ mensuel: [{ type: 'depense', categorie: 'c', libelle: 'l', montant: 100 }] });
  assert.equal(project(d, [], P)[0].solde, 1400);
  assert.equal(project(d, [], Object.assign({}, P, { solde_depart: { compte_courant: -50, epargne: null } }))[0].solde, 350);
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
  const r = project(donnees({ mensuel: [{ type: 'revenu', categorie: 'c', libelle: 'l', montant: 1000, taux_revalorisation: 2 }] }), [], P);
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

// ---- taux de revalorisation par ligne (revenus) et inflation (dépenses) ----
const Pj = require('../../js/projection.js');

test('facteurLigne: revenu suit son propre taux, pas l inflation', () => {
  const l = Pj.normaliser({ type: 'revenu', montant: 100, taux_revalorisation: 5 }, true);
  const idxJan27 = 2027 * 12;
  assert.equal(Pj.facteurLigne(P, l, idxJan27 - 1), 1);
  assert.ok(Math.abs(Pj.facteurLigne(P, l, idxJan27) - 1.05) < 1e-12);
  assert.ok(Math.abs(Pj.facteurLigne(P, l, idxJan27 + 12) - 1.05 * 1.05) < 1e-12);
});

test('facteurLigne: revenu a taux negatif, nul, absent ou revalorise herite ignore', () => {
  const idx = 2028 * 12;
  const f = (x) => Pj.facteurLigne(P, Pj.normaliser(Object.assign({ type: 'revenu', montant: 1 }, x), true), idx);
  assert.ok(Math.abs(f({ taux_revalorisation: -10 }) - 0.81) < 1e-12);
  assert.equal(f({ taux_revalorisation: 0 }), 1);
  assert.equal(f({ taux_revalorisation: null }), 1);
  assert.equal(f({}), 1);
  assert.equal(f({ revalorise: true }), 1, 'revalorise est sans effet pour un revenu');
});

test('facteurLigne: depense cochee suit l inflation, non cochee 1, taux de ligne ignore', () => {
  const idx = 2028 * 12;
  const f = (x) => Pj.facteurLigne(P, Pj.normaliser(Object.assign({ type: 'depense', montant: 1 }, x), true), idx);
  assert.ok(Math.abs(f({ revalorise: true }) - 1.02 * 1.02) < 1e-12);
  assert.equal(f({}), 1);
  assert.equal(f({ taux_revalorisation: 9 }), 1);
});

test('normaliser expose tauxReval (fraction) et revalorise (depense seulement)', () => {
  const r = Pj.normaliser({ type: 'revenu', montant: 1, taux_revalorisation: 1.5, revalorise: true }, true);
  assert.ok(Math.abs(r.tauxReval - 0.015) < 1e-12);
  assert.equal(r.revalorise, false);
  const d = Pj.normaliser({ type: 'depense', montant: 1, revalorise: true }, true);
  assert.equal(d.tauxReval, 0);
  assert.equal(d.revalorise, true);
});

test('project: revenu a 1.5 % independant d une inflation a 2 %, depense a 2 %', () => {
  const r = project(donnees({ mensuel: [
    { type: 'revenu', categorie: 'c', libelle: 'a', montant: 1000, taux_revalorisation: 1.5 },
    { type: 'depense', categorie: 'c', libelle: 'b', montant: 500, revalorise: true },
  ] }), [], P);
  assert.ok(Math.abs(mois(r, '2027-01').revenus - 1015) < 1e-9);
  assert.ok(Math.abs(mois(r, '2027-01').depenses - 510) < 1e-9);
});

test('project: le taux de ligne se combine avec les paliers', () => {
  const r = project(donnees({ mensuel: [
    { type: 'revenu', categorie: 'c', libelle: 'a', montant: 1000, taux_revalorisation: 3, paliers: [{ depuis: '2026-12', montant: 2000 }] },
  ] }), [], P);
  assert.equal(mois(r, '2026-11').revenus, 1000);
  assert.equal(mois(r, '2026-12').revenus, 2000);
  assert.ok(Math.abs(mois(r, '2027-01').revenus - 2060) < 1e-9);
});
