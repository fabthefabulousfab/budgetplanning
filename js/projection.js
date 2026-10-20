(function (root) {
  'use strict';

  const S = typeof module !== 'undefined' ? require('./schedule.js') : root.Budget;

  const PARAMETRES_DEFAUT = { depart: '2026-10', horizon_annees: 15, revalorisation: { taux: 0.02, mois: 1 }, solde_depart: { compte_courant: null, epargne: null } };

  // Solde de départ : chaque champ surchargé (nombre) remplace la valeur Excel (donnees.situation), sinon Excel, sinon 0.
  function soldeDepart(donnees, params) {
    const sit = (donnees && donnees.situation) || {};
    const sd = (params && params.solde_depart) || {};
    function val(k) {
      if (typeof sd[k] === 'number' && Number.isFinite(sd[k])) return sd[k];
      return typeof sit[k] === 'number' && Number.isFinite(sit[k]) ? sit[k] : 0;
    }
    const cc = val('compte_courant');
    const ep = val('epargne');
    return { compte_courant: cc, epargne: ep, total: cc + ep };
  }

  // Une ligne masquée (actif: false) n'est prise en compte nulle part.
  function estActif(ligne) { return ligne.actif !== false; }

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

  // Facteur de revalorisation appliqué au mois d'indice `idx` (même règle que project()).
  function facteurReval(params, idx) {
    const p = Object.assign({}, PARAMETRES_DEFAUT, params);
    const reval = Object.assign({}, PARAMETRES_DEFAUT.revalorisation, p.revalorisation);
    return Math.pow(1 + reval.taux, passages(S.monthIndex(p.depart), idx, reval.mois));
  }

  function project(donnees, evenements, params) {
    const p = Object.assign({}, PARAMETRES_DEFAUT, params);
    const reval = Object.assign({}, PARAMETRES_DEFAUT.revalorisation, p.revalorisation);
    const n = p.horizon_annees * 12;
    const debutIdx = S.monthIndex(p.depart);
    const fenetre = { debut: p.depart, fin: S.ym(Math.floor((debutIdx + n - 1) / 12), ((debutIdx + n - 1) % 12) + 1) };

    const lignes = []
      .concat((donnees.mensuel || []).filter(estActif).map(function (l) { return normaliser(l, true); }))
      .concat((donnees.annuel || []).filter(estActif).map(function (l) { return normaliser(l, false); }))
      .concat((donnees.exceptionnel || []).filter(estActif).map(function (l) { return normaliser(l, false); }))
      .concat((evenements || []).filter(estActif).map(function (l) { return normaliser(l, false); }));

    const revenus = new Array(n).fill(0);
    const depenses = new Array(n).fill(0);
    lignes.forEach(function (l) {
      S.occurrences(l.schedule, l.bornes, fenetre).forEach(function (o) {
        const idx = S.monthIndex(o.ym);
        const pos = idx - debutIdx;
        if (pos < 0 || pos >= n) return;
        let montant = o.montant;
        if (l.revalorise) montant *= facteurReval(p, idx);
        if (l.type === 'revenu') revenus[pos] += montant;
        else depenses[pos] += montant;
      });
    });

    let solde = soldeDepart(donnees, p).total;
    const out = [];
    for (let pos = 0; pos < n; pos++) {
      const idx = debutIdx + pos;
      const net = revenus[pos] - depenses[pos];
      solde += net;
      out.push({ ym: S.ym(Math.floor(idx / 12), (idx % 12) + 1), revenus: revenus[pos], depenses: depenses[pos], net: net, solde: solde });
    }
    return out;
  }

  const api = { project: project, PARAMETRES_DEFAUT: PARAMETRES_DEFAUT, normaliser: normaliser, estActif: estActif, facteurReval: facteurReval, soldeDepart: soldeDepart };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
