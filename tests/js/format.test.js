const test = require('node:test');
const assert = require('node:assert');
const { moisCourt, moisLong } = require('../../js/format.js');

test('moisCourt : abréviation française et année', () => {
  assert.strictEqual(moisCourt('2026-10'), 'oct. 2026');
  assert.strictEqual(moisCourt('2027-05'), 'mai 2027');
  assert.strictEqual(moisCourt('2027-02'), 'févr. 2027');
});

test('moisCourt : les douze abréviations', () => {
  const attendu = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  attendu.forEach((a, i) => assert.strictEqual(moisCourt('2030-' + String(i + 1).padStart(2, '0')), a + ' 2030'));
});

test('moisLong : nom complet, sans décalage de fuseau (premier et dernier mois)', () => {
  assert.strictEqual(moisLong('2026-10'), 'octobre 2026');
  assert.strictEqual(moisLong('2027-01'), 'janvier 2027');
  assert.strictEqual(moisLong('2027-12'), 'décembre 2027');
});
