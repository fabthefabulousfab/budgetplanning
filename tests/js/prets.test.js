const test = require('node:test');
const assert = require('node:assert');
const { validerPret, echeancier, lignesPret, lignesFutures } = require('../../js/prets.js');
const { project } = require('../../js/projection.js');
const { detailMois, lignesInfobulle, historiqueCsv } = require('../../js/summary.js');
const store = require('../../js/store.js');

const P = { depart: '2026-10', horizon_annees: 10, revalorisation: { taux: 0, mois: 1 } };
const D = { situation: { compte_courant: 1000, epargne: 0 }, mensuel: [{ type: 'revenu', categorie: 'salaire', libelle: 'paie', montant: 2000 }] };
const SIM = { id: 'p1', nature: 'pret', statut: 'simule', libelle: 'Étudiant', montant: 12000, mise_a_disposition: '2027-01', duree_mois: 12 };
const COURS = { id: 'p2', nature: 'pret', statut: 'en_cours', libelle: 'Voiture', mensualite: 300, fin: '2027-03' };
const mois = function (res, ym) { return res.find(function (m) { return m.ym === ym; }); };

test('echeancier : sans taux, sans différé', () => {
  const e = echeancier(SIM);
  assert.deepEqual([e.mensualite, e.debut, e.fin], [1000, '2027-02', '2028-01']);
});

test('echeancier : différé de 6 mois décale le début du remboursement', () => {
  const e = echeancier(Object.assign({}, SIM, { differe_mois: 6 }));
  assert.deepEqual([e.debut, e.fin], ['2027-08', '2028-07']);
});

test('echeancier : taux annuel de 6 % = annuité constante', () => {
  const e = echeancier(Object.assign({}, SIM, { taux: 6 }));
  assert.equal(e.mensualite, 1032.8);
});

test('prêt simulé dans project() : déblocage puis mensualités, solde final inchangé hors intérêts', () => {
  const res = project(D, lignesFutures([], [SIM]), P);
  const avant = project(D, [], P);
  assert.equal(mois(res, '2027-01').net, mois(avant, '2027-01').net + 12000);
  assert.equal(mois(res, '2027-02').net, mois(avant, '2027-02').net - 1000);
  assert.equal(mois(res, '2028-01').net, mois(avant, '2028-01').net - 1000);
  assert.equal(mois(res, '2028-02').net, mois(avant, '2028-02').net);
  assert.equal(mois(res, '2030-01').solde, mois(avant, '2030-01').solde);
});

test('prêt en cours : mensualité jusqu\'à la fin seulement, pas de mise à disposition', () => {
  const res = project(D, lignesFutures([], [COURS]), P);
  assert.equal(mois(res, '2026-10').depenses, 300);
  assert.equal(mois(res, '2027-03').depenses, 300);
  assert.equal(mois(res, '2027-04').depenses, 0);
  assert.equal(mois(res, '2026-10').revenus, 2000);
});

test('prêt masqué (actif: false) ignoré', () => {
  assert.deepEqual(lignesPret([Object.assign({}, SIM, { actif: false })]), []);
});

test('infobulle : groupe Prêts avec net et solde de project()', () => {
  const fut = lignesFutures([], [SIM, COURS]);
  const res = project(D, fut, P);
  const m = mois(res, '2027-01');
  const d = detailMois(D, fut, P, m.ym);
  assert.equal(d.futurs.length, 0);
  assert.equal(d.prets.length, 2);
  assert.ok(Math.abs(d.net - m.net) < 1e-6);
  const l = lignesInfobulle(d, m, function (v) { return String(Math.round(v)); });
  assert.ok(l.corps.indexOf('Prêts') > 0);
  assert.ok(l.corps.indexOf('  Étudiant (mise à disposition) : +12000') > 0);
  assert.equal(l.pied[2], 'Solde fin de mois : ' + Math.round(m.solde));
});

test('validerPret : cas valides et refus explicites', () => {
  validerPret(SIM);
  validerPret(COURS);
  validerPret(Object.assign({}, SIM, { differe_mois: 24, taux: 1.5 }));
  const refus = [
    [{ montant: 0 }, /montant/i], [{ duree_mois: 0 }, /durée/], [{ duree_mois: 1.5 }, /durée/],
    [{ mise_a_disposition: '2027-13' }, /mois de 1 à 12/], [{ differe_mois: -1 }, /différé/],
    [{ taux: -1 }, /taux/], [{ statut: 'x' }, /Statut/], [{ libelle: ' ' }, /Libellé/], [{ actif: 'non' }, /actif/],
  ];
  refus.forEach(function (r) { assert.throws(function () { validerPret(Object.assign({}, SIM, r[0])); }, r[1]); });
  assert.throws(function () { validerPret(Object.assign({}, COURS, { mensualite: -3 })); }, /mensualité/);
  assert.throws(function () { validerPret(Object.assign({}, COURS, { fin: '' })); }, /Fin/);
});

test('ligne masquée : ignorée par project() et detailMois()', () => {
  const D2 = Object.assign({}, D, { mensuel: D.mensuel.concat([{ type: 'depense', categorie: 'x', libelle: 'cachée', montant: 500, actif: false }]) });
  const res = project(D2, [{ id: 'e', type: 'depense', categorie: 'Achat', libelle: 'cachée', montant: '2027-3-900', actif: false }], P);
  assert.equal(mois(res, '2027-03').depenses, 0);
  assert.equal(detailMois(D2, [], P, '2027-03').mensuel.depenses, 0);
  assert.throws(function () { store.validerLigne({ type: 'depense', categorie: 'x', libelle: 'a', montant: 5, actif: 'non' }, 'mensuel'); }, /actif/);
});

function fakeDir(initial) {
  const files = new Map(Object.entries(initial || {}));
  return {
    files,
    async getFileHandle(name, opts) {
      if (!files.has(name)) {
        if (!(opts && opts.create)) { const e = new Error('absent'); e.name = 'NotFoundError'; throw e; }
        files.set(name, '');
      }
      return {
        async getFile() { return { async text() { return files.get(name); } }; },
        async createWritable() {
          let buf = '';
          return { async write(s) { buf += s; }, async close() { files.set(name, buf); } };
        },
      };
    },
  };
}

test('store : les prêts vivent dans evenements-futurs.yaml, séparés des événements au chargement', async () => {
  const ev = { id: 'e1', type: 'depense', categorie: 'Achat', libelle: 'Voiture', montant: '2027-3-5000', debut: null, fin: null };
  const d = fakeDir();
  await store.saveEvenements(d, [ev], [SIM, COURS]);
  const r = await store.loadAll(d);
  assert.deepEqual(r.evenements, [ev]);
  assert.deepEqual(r.prets, [SIM, COURS]);
  assert.ok(!d.files.has('prets.yaml'));
});

test('store : prêt invalide refusé à la lecture et à l\'écriture, fichier intact', async () => {
  const d = fakeDir({ 'evenements-futurs.yaml': '- {id: p, nature: pret, statut: simule, libelle: X, montant: 10, mise_a_disposition: "2027-01", duree_mois: 0}\n' });
  await assert.rejects(store.loadAll(d), /evenements-futurs\.yaml : prêt #1 : .*durée/);
  const avant = d.files.get('evenements-futurs.yaml');
  await assert.rejects(store.saveEvenements(d, [], [Object.assign({}, SIM, { montant: -1 })]), /prêt #1/);
  assert.equal(d.files.get('evenements-futurs.yaml'), avant);
});

test('historiqueCsv : une ligne par mois, entiers, en-tête', () => {
  const res = project(D, lignesFutures([], [SIM]), P);
  const lignes = historiqueCsv(res).trim().split('\n');
  assert.equal(lignes[0], 'mois,revenus,depenses,solde');
  assert.equal(lignes.length, 121);
  const m = mois(res, '2027-02');
  assert.ok(lignes.indexOf('2027-02,' + Math.round(m.revenus) + ',' + Math.round(m.depenses) + ',' + Math.round(m.solde)) > 0);
});

test('store : l\'historique est écrit dans historique-comptes.csv', async () => {
  const d = fakeDir();
  await store.ecrireHistorique(d, [{ ym: '2026-10', revenus: 1, depenses: 2, net: -1, solde: 5 }]);
  assert.equal(d.files.get('historique-comptes.csv'), 'mois,revenus,depenses,solde\n2026-10,1,2,5\n');
});
