const test = require('node:test');
const assert = require('node:assert');
const { chiffresCles } = require('../../js/summary.js');

test('chiffresCles : null sans mois', () => {
  assert.strictEqual(chiffresCles([]), null);
  assert.strictEqual(chiffresCles(null), null);
});

test('chiffresCles : premier mois (solde, net) et dernier mois (solde), sans recalcul', () => {
  const mois = [
    { ym: '2026-10', revenus: 3000, depenses: 2500, net: 500, solde: 1500 },
    { ym: '2026-11', revenus: 3000, depenses: 3200, net: -200, solde: 1300 },
    { ym: '2026-12', revenus: 3100, depenses: 2000, net: 1100, solde: 2400 },
  ];
  assert.deepStrictEqual(chiffresCles(mois), {
    debut: { ym: '2026-10', solde: 1500, net: 500 },
    fin: { ym: '2026-12', solde: 2400 },
  });
});

test('chiffresCles : un seul mois, début et fin identiques', () => {
  const r = chiffresCles([{ ym: '2027-01', revenus: 0, depenses: 0, net: 0, solde: -40 }]);
  assert.deepStrictEqual(r, { debut: { ym: '2027-01', solde: -40, net: 0 }, fin: { ym: '2027-01', solde: -40 } });
});
