(function (root) {
  'use strict';

  const S = typeof module !== 'undefined' ? require('./schedule.js') : root.Budget;

  const PARAMETRES_DEFAUT = { depart: '2026-10', horizon_annees: 15, revalorisation: { taux: 0.02, mois: 1 } };

  function normaliser(ligne, mensuelNumerique) {
    let schedule;
    if (mensuelNumerique && typeof ligne.montant === 'number') {
      schedule = { kind: 'mensuel', montant: ligne.montant };
    } else {
      schedule = S.parseEcheances(ligne.echeances != null ? ligne.echeances : ligne.montant);
    }
    return {
      type: ligne.type,
      schedule: schedule,
      bornes: { debut: ligne.debut || null, fin: ligne.fin || null },
      revalorise: !!ligne.revalorise,
    };
  }

  // Nombre de passages du mois `mois` (1-12) dans l'intervalle ]debutIdx, courIdx].
  function passages(debutIdx, courIdx, mois) {
    let k = 0;
    for (let i = debutIdx + 1; i <= courIdx; i++) if (i % 12 === mois - 1) k++;
    return k;
  }

  function project(donnees, evenements, params) {
    const p = Object.assign({}, PARAMETRES_DEFAUT, params);
    const reval = Object.assign({}, PARAMETRES_DEFAUT.revalorisation, p.revalorisation);
    const n = p.horizon_annees * 12;
    const debutIdx = S.monthIndex(p.depart);
    const fenetre = { debut: p.depart, fin: S.ym(Math.floor((debutIdx + n - 1) / 12), ((debutIdx + n - 1) % 12) + 1) };

    const lignes = []
      .concat((donnees.mensuel || []).map(function (l) { return normaliser(l, true); }))
      .concat((donnees.annuel || []).map(function (l) { return normaliser(l, false); }))
      .concat((donnees.exceptionnel || []).map(function (l) { return normaliser(l, false); }))
      .concat((evenements || []).map(function (l) { return normaliser(l, false); }));

    const revenus = new Array(n).fill(0);
    const depenses = new Array(n).fill(0);
    lignes.forEach(function (l) {
      S.occurrences(l.schedule, l.bornes, fenetre).forEach(function (o) {
        const idx = S.monthIndex(o.ym);
        const pos = idx - debutIdx;
        if (pos < 0 || pos >= n) return;
        let montant = o.montant;
        if (l.revalorise) montant *= Math.pow(1 + reval.taux, passages(debutIdx, idx, reval.mois));
        if (l.type === 'revenu') revenus[pos] += montant;
        else depenses[pos] += montant;
      });
    });

    let solde = ((donnees.situation && donnees.situation.compte_courant) || 0) + ((donnees.situation && donnees.situation.epargne) || 0);
    const out = [];
    for (let pos = 0; pos < n; pos++) {
      const idx = debutIdx + pos;
      const net = revenus[pos] - depenses[pos];
      solde += net;
      out.push({ ym: S.ym(Math.floor(idx / 12), (idx % 12) + 1), revenus: revenus[pos], depenses: depenses[pos], net: net, solde: solde });
    }
    return out;
  }

  const api = { project: project, PARAMETRES_DEFAUT: PARAMETRES_DEFAUT };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
