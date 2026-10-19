(function (root) {
  'use strict';

  const S = typeof module !== 'undefined' ? require('./schedule.js') : root.Budget;
  const Pj = typeof module !== 'undefined' ? require('./projection.js') : root.Budget;

  function fenetre(params) {
    const p = Object.assign({}, Pj.PARAMETRES_DEFAUT, params);
    const n = p.horizon_annees * 12;
    const debutIdx = S.monthIndex(p.depart);
    const finIdx = debutIdx + n - 1;
    return { debut: p.depart, fin: S.ym(Math.floor(finIdx / 12), (finIdx % 12) + 1) };
  }

  function occurrencesSignees(ligne, win) {
    const l = Pj.normaliser(ligne, true);
    const signe = l.type === 'revenu' ? 1 : -1;
    return S.occurrences(l.schedule, l.bornes, win).map(function (o) {
      return { ym: o.ym, montant: signe * o.montant };
    });
  }

  function restantMensuel(donnees) {
    return (donnees.mensuel || []).reduce(function (acc, l) {
      return acc + (l.type === 'revenu' ? 1 : -1) * Number(l.montant);
    }, 0);
  }

  function impactMensuel(lignes, params) {
    const p = Object.assign({}, Pj.PARAMETRES_DEFAUT, params);
    const d = S.monthIndex(p.depart);
    const win = { debut: p.depart, fin: S.ym(Math.floor((d + 11) / 12), ((d + 11) % 12) + 1) };
    return (lignes || []).map(function (l) {
      const total = occurrencesSignees(l, win).reduce(function (a, o) { return a + o.montant; }, 0);
      return { libelle: l.libelle, total_annuel: total, impact_mensuel: total / 12 };
    });
  }

  function restantMoyen(donnees, params) {
    const lignes = (donnees.annuel || []).concat(donnees.exceptionnel || []);
    return restantMensuel(donnees) + impactMensuel(lignes, params).reduce(function (a, x) { return a + x.impact_mensuel; }, 0);
  }

  function syntheseEvenements(evenements, params) {
    const win = fenetre(params);
    const groupes = new Map();
    (evenements || []).forEach(function (e) {
      const cle = e.type + '\u0000' + e.categorie;
      if (!groupes.has(cle)) groupes.set(cle, { type: e.type, categorie: e.categorie, par_annee: {}, total: 0 });
      const g = groupes.get(cle);
      occurrencesSignees(e, win).forEach(function (o) {
        const an = o.ym.slice(0, 4);
        g.par_annee[an] = (g.par_annee[an] || 0) + o.montant;
        g.total += o.montant;
      });
    });
    return Array.from(groupes.values()).filter(function (g) { return Object.keys(g.par_annee).length > 0; });
  }

  function deficits(mois) {
    const out = [];
    let cur = null;
    (mois || []).forEach(function (m) {
      if (m.solde < 0) {
        if (!cur) cur = { debut: m.ym, fin: m.ym, manque_max: 0, mois_en_deficit: 0 };
        cur.fin = m.ym;
        cur.mois_en_deficit++;
        cur.manque_max = Math.max(cur.manque_max, -m.solde);
      } else if (cur) {
        out.push(cur);
        cur = null;
      }
    });
    if (cur) out.push(cur);
    return out;
  }

  function finsDePret(donnees) {
    return (donnees.mensuel || [])
      .filter(function (l) { return l.type === 'depense' && l.fin; })
      .map(function (l) { return { libelle: l.libelle, fin: l.fin, libere_par_mois: Number(l.montant) }; })
      .sort(function (a, b) { return S.monthIndex(a.fin) - S.monthIndex(b.fin); });
  }

  const api = {
    restantMensuel: restantMensuel,
    impactMensuel: impactMensuel,
    restantMoyen: restantMoyen,
    syntheseEvenements: syntheseEvenements,
    deficits: deficits,
    finsDePret: finsDePret,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
