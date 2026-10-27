const test = require('node:test');
const assert = require('node:assert');
const { detailHistorique, historiqueCsv } = require('../../js/summary.js');
const { project } = require('../../js/projection.js');
const { lignesFutures } = require('../../js/prets.js');
const store = require('../../js/store.js');

const P = { depart: '2026-10', horizon_annees: 10, revalorisation: { taux: 0.1, mois: 1 } };
const D = {
  situation: { compte_courant: 100, epargne: 50 },
  mensuel: [
    { type: 'revenu', categorie: 'salaire', libelle: 'paie', montant: 3000, taux_revalorisation: 10 },
    { type: 'depense', categorie: 'vie', libelle: 'courses, "bio"', montant: 2000 },
    { type: 'depense', categorie: 'vie', libelle: 'masquée', montant: 777, actif: false },
  ],
  annuel: [{ type: 'depense', categorie: 'imp', libelle: 'taxe', echeances: '3-600', revalorise: true }],
  exceptionnel: [{ type: 'revenu', categorie: 'prime', libelle: 'prime', echeances: '2027-03-400' }],
};
const EV = [{ id: 'e', type: 'depense', categorie: 'Achat', libelle: 'voyage', echeances: '2027-03-1000' }];
const PRETS = [{ id: 'p', statut: 'simule', libelle: 'Étudiant', montant: 1200, mise_a_disposition: '2027-03', duree_mois: 12 }];

test('detailHistorique : chaque mois, la somme des lignes égale le net de project()', () => {
  const futurs = lignesFutures(EV, PRETS);
  const rows = detailHistorique(D, futurs, P);
  project(D, futurs, P).forEach(function (m) {
    const s = rows.filter(function (r) { return r.ym === m.ym; }).reduce(function (a, r) { return a + r.montant; }, 0);
    assert.ok(Math.abs(s - m.net) < 1e-6, m.ym);
  });
  assert.ok(rows.every(function (r) { return r.libelle !== 'masquée'; }));
  assert.ok(rows.some(function (r) { return r.ym === '2027-03' && r.origine === 'annuel' && Math.abs(r.montant + 660) < 1e-6; }));
  assert.ok(rows.some(function (r) { return r.ym === '2027-03' && r.origine === 'pret' && r.montant === 1200; }));
  assert.ok(rows.some(function (r) { return r.ym === '2027-03' && r.origine === 'futur' && r.montant === -1000; }));
  assert.ok(rows.some(function (r) { return r.ym === '2027-03' && r.origine === 'exceptionnel' && r.montant === 400; }));
});

test('historiqueCsv : résumé mensuel puis détail, champs protégés', () => {
  const futurs = lignesFutures(EV, PRETS);
  const csv = historiqueCsv(project(D, futurs, P), detailHistorique(D, futurs, P));
  const [resume, detail] = csv.split('\n\n');
  assert.equal(resume.split('\n')[0], 'mois,revenus,depenses,solde');
  assert.equal(detail.split('\n')[0], 'mois,origine,categorie,libelle,montant');
  assert.ok(detail.includes('2026-10,mensuel,vie,"courses, ""bio""",-2000'));
  assert.ok(detail.includes('2027-03,pret,Prêt,Étudiant (mise à disposition),1200'));
  assert.ok(csv.endsWith('\n'));
});

test('store : l\'historique écrit contient le détail', async () => {
  const files = new Map();
  const dir = { async getFileHandle(n) { return { async createWritable() { let b = ''; return { async write(s) { b += s; }, async close() { files.set(n, b); } }; } }; } };
  await store.ecrireHistorique(dir, [{ ym: '2026-10', revenus: 1, depenses: 2, net: -1, solde: 5 }], [{ ym: '2026-10', origine: 'mensuel', categorie: 'c', libelle: 'l', montant: -2 }]);
  assert.equal(files.get('historique-comptes.csv'), 'mois,revenus,depenses,solde\n2026-10,1,2,5\n\nmois,origine,categorie,libelle,montant\n2026-10,mensuel,c,l,-2\n');
});
