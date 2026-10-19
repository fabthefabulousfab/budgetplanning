const test = require('node:test');
const assert = require('node:assert');
const { restantMensuel, impactMensuel, restantMoyen, syntheseEvenements, deficits, finsDePret } = require('../../js/summary.js');

const P = { depart: '2026-10', horizon_annees: 3, revalorisation: { taux: 0.02, mois: 1 } };
const D = {
  situation: { compte_courant: 0, epargne: 0 },
  mensuel: [
    { type: 'revenu', categorie: 'salaire', libelle: 's', montant: 8000 },
    { type: 'depense', categorie: 'vie', libelle: 'v', montant: 7000 },
  ],
  annuel: [{ type: 'depense', categorie: 'imp', libelle: 'taxe', echeances: '6-600' }],
  exceptionnel: [],
};

test('(a) restantMensuel', () => assert.equal(restantMensuel(D), 1000));

test('(b) impactMensuel annuel depense', () => {
  const r = impactMensuel(D.annuel, P);
  assert.deepEqual(r, [{ libelle: 'taxe', total_annuel: -600, impact_mensuel: -50 }]);
});

test('restantMoyen', () => assert.equal(restantMoyen(D, P), 950));

test('(c) deficits', () => {
  const m = [10, -5, -20, 3, -1].map((s, i) => ({ ym: '2027-0' + (i + 1), solde: s }));
  assert.deepEqual(deficits(m), [
    { debut: '2027-02', fin: '2027-03', manque_max: 20, mois_en_deficit: 2 },
    { debut: '2027-05', fin: '2027-05', manque_max: 1, mois_en_deficit: 1 },
  ]);
  assert.deepEqual(deficits([{ ym: '2027-01', solde: 0 }, { ym: '2027-02', solde: 5 }]), []);
});

test('(d)(f) syntheseEvenements', () => {
  const ev = [
    { type: 'depense', categorie: 'voyage', libelle: 'a', echeances: '2027-03-1000' },
    { type: 'depense', categorie: 'voyage', libelle: 'b', echeances: '2028-04-500' },
    { type: 'revenu', categorie: 'voyage', libelle: 'c', echeances: '2027-05-200' },
    { type: 'depense', categorie: 'loin', libelle: 'd', echeances: '2040-01-999' },
    { type: 'revenu', categorie: 'loyer', libelle: 'e', montant: '800', debut: '2027-01', fin: '2028-06' },
  ];
  const r = syntheseEvenements(ev, P);
  const get = (t, c) => r.find((x) => x.type === t && x.categorie === c);
  assert.deepEqual(get('depense', 'voyage').par_annee, { 2027: -1000, 2028: -500 });
  assert.equal(get('depense', 'voyage').total, -1500);
  assert.deepEqual(get('revenu', 'voyage').par_annee, { 2027: 200 });
  assert.equal(get('depense', 'loin'), undefined);
  assert.deepEqual(get('revenu', 'loyer').par_annee, { 2027: 9600, 2028: 4800 });
});

test('(e) finsDePret', () => {
  const d = { mensuel: [
    { type: 'depense', categorie: 'p', libelle: 'B', montant: 300, fin: '2030-01' },
    { type: 'depense', categorie: 'p', libelle: 'A', montant: 100, fin: '2028-05' },
    { type: 'depense', categorie: 'p', libelle: 'N', montant: 50 },
    { type: 'revenu', categorie: 'p', libelle: 'R', montant: 50, fin: '2027-01' },
  ] };
  assert.deepEqual(finsDePret(d), [
    { libelle: 'A', fin: '2028-05', libere_par_mois: 100 },
    { libelle: 'B', fin: '2030-01', libere_par_mois: 300 },
  ]);
});
