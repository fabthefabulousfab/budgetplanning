const test = require('node:test');
const assert = require('node:assert');
const { detailMois, lignesInfobulle } = require('../../js/summary.js');
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
const f = function (v) { return String(Math.round(v)); };
const sg = function (v) { return (v > 0 ? '+' : '') + f(v); };
const moisDe = function (ym) { return project(D, EV, P).find(function (x) { return x.ym === ym; }); };

test('infobulle : mensuel + annuel + exceptionnel + futur, net et solde de project()', () => {
  const m = moisDe('2027-03');
  const l = lignesInfobulle(detailMois(D, EV, P, m.ym), m, f);
  assert.deepEqual(l.corps.slice(0, 3), ['Mensuel (régulier)', '  Revenus : +3300', '  Dépenses : -2000']);
  assert.ok(l.corps.indexOf('Annuel') > 0);
  assert.ok(l.corps.indexOf('Exceptionnel / futur') > 0);
  assert.ok(l.corps.indexOf('  prime : +400') > 0 && l.corps.indexOf('  voyage : -1000') > 0);
  assert.equal(l.pied[1], 'Net du mois : ' + sg(m.net));
  assert.equal(l.pied[2], 'Solde fin de mois : ' + f(m.solde));
});

test('infobulle : mois avec seulement des lignes mensuelles', () => {
  const m = moisDe('2026-11');
  const l = lignesInfobulle(detailMois(D, EV, P, m.ym), m, f);
  assert.deepEqual(l.corps, ['Mensuel (régulier)', '  Revenus : +3000', '  Dépenses : -2500']);
  assert.equal(l.pied[2], 'Solde fin de mois : ' + f(m.solde));
});

test('infobulle : mois hors fenêtre, sans ligne de détail', () => {
  const l = lignesInfobulle(detailMois(D, EV, P, '2040-01'), { net: 0, solde: 0 }, f);
  assert.deepEqual(l.corps, ['Mensuel (régulier)', '  Revenus : 0', '  Dépenses : 0']);
});
