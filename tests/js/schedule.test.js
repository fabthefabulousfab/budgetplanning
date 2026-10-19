const test = require('node:test');
const assert = require('node:assert');
const S = require('../../js/schedule.js');
const cases = require('../fixtures/echeances-cases.json');

test('cas valides', () => {
  for (const c of cases.valides) {
    assert.equal(S.parseEcheances(c.texte).kind, c.kind, c.texte);
  }
});

test('cas invalides', () => {
  for (const t of cases.invalides) {
    assert.throws(() => S.parseEcheances(t), Error, JSON.stringify(t));
  }
});

test('formes équivalentes annuel', () => {
  const exp = { kind: 'annuel', items: [{ mois: 3, montant: 300 }] };
  for (const t of ['3-300', '3:300', '03-300']) assert.deepEqual(S.parseEcheances(t), exp, t);
});

test('formes équivalentes dates', () => {
  const exp = { kind: 'dates', items: [{ ym: '2026-03', montant: 300 }] };
  for (const t of ['2026-3-300', '2026-03:300']) assert.deepEqual(S.parseEcheances(t), exp, t);
});

test('occurrences annuel', () => {
  const r = S.occurrences(S.parseEcheances('6-500, 10-500'), {}, { debut: '2026-10', fin: '2028-09' });
  assert.deepEqual(r, [
    { ym: '2026-10', montant: 500 }, { ym: '2027-06', montant: 500 },
    { ym: '2027-10', montant: 500 }, { ym: '2028-06', montant: 500 },
  ]);
});

test('occurrences mensuel avec bornes', () => {
  const r = S.occurrences(S.parseEcheances('800'), { debut: '2027-01', fin: '2027-03' }, { debut: '2026-10', fin: '2030-12' });
  assert.deepEqual(r.map(o => o.ym), ['2027-01', '2027-02', '2027-03']);
});

test('dates hors fenêtre', () => {
  assert.deepEqual(S.occurrences(S.parseEcheances('2029-03:25000'), {}, { debut: '2026-10', fin: '2028-09' }), []);
});

test('borne fin inclusive', () => {
  const r = S.occurrences(S.parseEcheances('800'), { fin: '2032-07' }, { debut: '2026-10', fin: '2040-12' });
  assert.equal(r[r.length - 1].ym, '2032-07');
});

test('annuel avec bornes', () => {
  const r = S.occurrences(S.parseEcheances('3-300'), { debut: '2028-01', fin: '2029-12' }, { debut: '2026-10', fin: '2035-12' });
  assert.deepEqual(r.map(o => o.ym), ['2028-03', '2029-03']);
});

test('date unique hors bornes', () => {
  assert.deepEqual(S.occurrences(S.parseEcheances('2026-3-300'), { debut: '2027-01' }, { debut: '2026-01', fin: '2030-12' }), []);
});

test('ym utilitaires', () => {
  assert.equal(S.ym(2026, 3), '2026-03');
  assert.deepEqual(S.parseYm('2026-10'), { y: 2026, m: 10 });
  assert.equal(S.monthIndex('2026-10'), 2026 * 12 + 9);
});
