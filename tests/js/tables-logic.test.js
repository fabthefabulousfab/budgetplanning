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

// ---- paliers ----
const mens = () => ({ type: 'revenu', categorie: 'c', libelle: 'CAF', montant: 249, fin: '2033-01' });

test('moisApres passe la fin d annee', () => {
  assert.strictEqual(T.moisApres('2026-11'), '2026-12');
  assert.strictEqual(T.moisApres('2026-12'), '2027-01');
});

test('ajouterPalier : premier palier apres le depart ou le debut, montant de base copie', () => {
  const l = mens();
  const c = T.ajouterPalier(l, 'mensuel', '2026-10');
  assert.deepStrictEqual(c.paliers, [{ depuis: '2026-11', montant: 249 }]);
  assert.strictEqual(l.paliers, undefined);
  const a = { echeances: '6-2500', debut: '2028-12' };
  assert.deepStrictEqual(T.ajouterPalier(a, 'annuel', '2026-10').paliers, [{ depuis: '2029-01', echeances: '6-2500' }]);
  assert.deepStrictEqual(T.ajouterPalier({ echeances: '800' }, 'evenement', '2026-12').paliers, [{ depuis: '2027-01', echeances: '800' }]);
  assert.deepStrictEqual(T.ajouterPalier({ montant: '800' }, 'evenement', '2026-12').paliers[0].echeances, '800');
});

test('ajouterPalier : suivant = mois apres le dernier palier, montant du dernier copie, original intact', () => {
  const l = Object.assign(mens(), { paliers: [{ depuis: '2029-12', montant: 130 }] });
  const c = T.ajouterPalier(l, 'mensuel', '2026-10');
  assert.deepStrictEqual(c.paliers, [{ depuis: '2029-12', montant: 130 }, { depuis: '2030-01', montant: 130 }]);
  assert.strictEqual(l.paliers.length, 1);
  c.paliers[0].montant = 1;
  assert.strictEqual(l.paliers[0].montant, 130);
});

test('retirerPalier supprime la cle quand il n en reste aucun', () => {
  const l = Object.assign(mens(), { paliers: [{ depuis: '2029-01', montant: 130 }, { depuis: '2030-01', montant: 0.5 }] });
  assert.deepStrictEqual(T.retirerPalier(l, 0).paliers, [{ depuis: '2030-01', montant: 0.5 }]);
  assert.strictEqual('paliers' in T.retirerPalier(T.retirerPalier(l, 0), 0), false);
  assert.strictEqual(l.paliers.length, 2);
  assert.strictEqual('paliers' in T.retirerPaliers(l), false);
  assert.strictEqual(T.retirerPalier(l, 5).paliers.length, 2);
});

test('editerPalier : copie, depuis/montant par nature', () => {
  const l = Object.assign(mens(), { paliers: [{ depuis: '2029-01', montant: 130 }] });
  const c = T.editerPalier(l, 0, 'montant', '99,5', 'mensuel');
  assert.strictEqual(c.paliers[0].montant, 99.5);
  assert.strictEqual(l.paliers[0].montant, 130);
  assert.ok(Number.isNaN(T.editerPalier(l, 0, 'montant', 'abc', 'mensuel').paliers[0].montant));
  assert.strictEqual(T.editerPalier(l, 0, 'depuis', ' 2030-02 ', 'mensuel').paliers[0].depuis, '2030-02');
  assert.strictEqual(T.editerPalier(l, 0, 'depuis', '2030-3', 'mensuel').paliers[0].depuis, '2030-03');
  assert.strictEqual(T.editerPalier(l, 0, 'depuis', '2030-13', 'mensuel').paliers[0].depuis, '2030-13');
  const a = { echeances: '6-5', paliers: [{ depuis: '2029-01', echeances: '6-4' }] };
  assert.strictEqual(T.editerPalier(a, 0, 'montant', ' 6-3 ', 'annuel').paliers[0].echeances, '6-3');
  assert.strictEqual(T.editerPalier(a, 0, 'montant', '6-3', 'evenement').paliers[0].montant, undefined);
});

test('proprietaireFin et actionBascule', () => {
  assert.strictEqual(T.proprietaireFin(mens()), 'base');
  assert.strictEqual(T.proprietaireFin(Object.assign(mens(), { paliers: [] })), 'base');
  assert.strictEqual(T.proprietaireFin(Object.assign(mens(), { paliers: [{ depuis: '2029-01', montant: 1 }] })), 'palier');
  assert.strictEqual(T.actionBascule(mens(), true), 'ouvrir');
  assert.strictEqual(T.actionBascule(mens(), false), 'masquer');
  assert.strictEqual(T.actionBascule(Object.assign(mens(), { paliers: [{ depuis: '2029-01', montant: 1 }] }), false), 'confirmer');
});
