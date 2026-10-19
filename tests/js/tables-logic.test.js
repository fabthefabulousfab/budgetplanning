const test = require('node:test');
const assert = require('node:assert');
const T = require('../../js/tables-logic.js');

test('grouperParCategorie garde l ordre et les index', () => {
  const g = T.grouperParCategorie([
    { categorie: 'A', libelle: 'x' }, { categorie: 'B', libelle: 'y' }, { categorie: 'A', libelle: 'z' },
  ]);
  assert.deepStrictEqual(g.map((x) => x.categorie), ['A', 'B']);
  assert.deepStrictEqual(g[0].items.map((i) => i.index), [0, 2]);
});

test('appliquerEdition ne modifie pas l original', () => {
  const l = { type: 'depense', categorie: 'A', libelle: 'x', montant: 10, fin: '2030-01' };
  const c = T.appliquerEdition(l, 'montant', '12,5', 'mensuel');
  assert.strictEqual(c.montant, 12.5);
  assert.strictEqual(l.montant, 10);
  assert.strictEqual(T.appliquerEdition(l, 'fin', ' ', 'mensuel').fin, null);
  assert.ok(Number.isNaN(T.appliquerEdition(l, 'montant', 'abc', 'mensuel').montant));
  assert.strictEqual(T.appliquerEdition(l, 'revalorise', true, 'mensuel').revalorise, true);
  assert.strictEqual(T.appliquerEdition({ echeances: '1:1' }, 'echeances', ' 6:500 ', 'annuel').echeances, '6:500');
});
