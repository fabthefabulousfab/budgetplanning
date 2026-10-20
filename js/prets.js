(function (root) {
  'use strict';

  const S = typeof module !== 'undefined' ? require('./schedule.js') : root.Budget;

  const STATUTS = ['simule', 'en_cours'];

  function nombre(v) { return typeof v === 'number' && Number.isFinite(v); }
  function entier(v) { return nombre(v) && Number.isInteger(v); }

  function validerMoisPret(v, nom) {
    if (typeof v !== 'string' || v === '') throw new Error(nom + ' manquant (attendu AAAA-MM).');
    const p = S.parseYm(v);
    if (p.m < 1 || p.m > 12) throw new Error(nom + ' invalide : « ' + v + ' » (mois de 1 à 12).');
  }

  // Un prêt est soit simulé (montant mis à disposition puis remboursé), soit déjà en cours (mensualité et fin seulement).
  function validerPret(p) {
    if (!p || typeof p !== 'object') throw new Error('Prêt invalide.');
    if (typeof p.id !== 'string' || p.id === '') throw new Error('Identifiant manquant.');
    if (typeof p.libelle !== 'string' || p.libelle.trim() === '') throw new Error('Libellé manquant.');
    if (STATUTS.indexOf(p.statut) < 0) throw new Error('Statut invalide : « ' + p.statut + ' » (simule ou en_cours).');
    if (p.actif != null && typeof p.actif !== 'boolean') throw new Error('« actif » doit valoir true ou false.');
    if (p.statut === 'en_cours') {
      if (!nombre(p.mensualite) || p.mensualite <= 0) throw new Error('La mensualité doit être un nombre supérieur à 0.');
      validerMoisPret(p.fin, 'Fin');
      return;
    }
    if (!nombre(p.montant) || p.montant <= 0) throw new Error('Le montant doit être un nombre supérieur à 0.');
    validerMoisPret(p.mise_a_disposition, 'Mise à disposition');
    if (!entier(p.duree_mois) || p.duree_mois < 1) throw new Error('La durée de remboursement doit être un nombre entier de mois (au moins 1).');
    if (p.differe_mois != null && (!entier(p.differe_mois) || p.differe_mois < 0)) throw new Error('Le différé doit être un nombre entier de mois (0 ou plus).');
    if (p.taux != null && (!nombre(p.taux) || p.taux < 0)) throw new Error('Le taux annuel doit être un nombre (en %, 0 ou plus).');
  }

  function arrondi(v) { return Math.round(v * 100) / 100; }

  // Mensualité, premier et dernier mois de remboursement d'un prêt simulé.
  // Taux nul : montant / durée ; sinon annuité constante. Aucun intérêt n'est capitalisé pendant le différé.
  function echeancier(p) {
    const n = p.duree_mois;
    const r = (p.taux || 0) / 100 / 12;
    const mensualite = r === 0 ? p.montant / n : (p.montant * r) / (1 - Math.pow(1 + r, -n));
    const debut = S.monthIndex(p.mise_a_disposition) + 1 + (p.differe_mois || 0);
    return { mensualite: arrondi(mensualite), debut: S.fromIndex(debut), fin: S.fromIndex(debut + n - 1), total: arrondi(mensualite) * n };
  }

  // Lignes de même forme que les événements futurs : la projection les traite sans cas particulier.
  function lignesPret(prets) {
    const out = [];
    (prets || []).forEach(function (p) {
      if (p.actif === false) return;
      if (p.statut === 'en_cours') {
        out.push({ id: p.id, pret: true, type: 'depense', categorie: 'Prêt', libelle: p.libelle + ' (remboursement)', montant: p.mensualite, fin: p.fin });
        return;
      }
      const e = echeancier(p);
      const d = S.parseYm(p.mise_a_disposition);
      out.push({ id: p.id, pret: true, type: 'revenu', categorie: 'Prêt', libelle: p.libelle + ' (mise à disposition)', echeances: d.y + '-' + d.m + '-' + p.montant });
      out.push({ id: p.id, pret: true, type: 'depense', categorie: 'Prêt', libelle: p.libelle + ' (remboursement)', montant: e.mensualite, debut: e.debut, fin: e.fin });
    });
    return out;
  }

  function lignesFutures(evenements, prets) {
    return (evenements || []).concat(lignesPret(prets));
  }

  const api = { validerPret: validerPret, echeancier: echeancier, lignesPret: lignesPret, lignesFutures: lignesFutures, STATUTS: STATUTS };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
