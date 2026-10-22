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
    const out = [];
    Pj.normaliserTout(ligne, true).forEach(function (l) {
      const signe = l.type === 'revenu' ? 1 : -1;
      S.occurrences(l.schedule, l.bornes, win).forEach(function (o) { out.push({ ym: o.ym, montant: signe * o.montant }); });
    });
    return out;
  }

  // Montant mensuel d'une ligne mensuelle en vigueur au mois `ym` (dernier palier dont `depuis` <= ym, sinon montant de la ligne).
  function montantAu(ligne, ym) {
    let m = ligne.montant;
    const i = S.monthIndex(ym);
    (ligne.paliers || []).forEach(function (p) { if (S.monthIndex(p.depuis) <= i) m = p.montant; });
    return Number(m);
  }

  // `params` (optionnel) donne le mois de départ pour lequel est pris le montant en vigueur des lignes à paliers.
  // Totaux des lignes mensuelles actives au mois de départ (montant en vigueur, paliers compris).
  function totauxMensuels(donnees, params) {
    const depart = Object.assign({}, Pj.PARAMETRES_DEFAUT, params).depart;
    return (donnees.mensuel || []).filter(Pj.estActif).reduce(function (acc, l) {
      acc[l.type === 'revenu' ? 'revenus' : 'depenses'] += montantAu(l, depart);
      return acc;
    }, { revenus: 0, depenses: 0 });
  }

  function restantMensuel(donnees, params) {
    const t = totauxMensuels(donnees, params);
    return t.revenus - t.depenses;
  }

  function impactMensuel(lignes, params) {
    const p = Object.assign({}, Pj.PARAMETRES_DEFAUT, params);
    const d = S.monthIndex(p.depart);
    const win = { debut: p.depart, fin: S.ym(Math.floor((d + 11) / 12), ((d + 11) % 12) + 1) };
    return (lignes || []).filter(Pj.estActif).map(function (l) {
      const total = occurrencesSignees(l, win).reduce(function (a, o) { return a + o.montant; }, 0);
      return { libelle: l.libelle, total_annuel: total, impact_mensuel: total / 12 };
    });
  }

  // Bilan (revenus, dépenses, net) des lignes sur les nbMois premiers mois de la projection, montants de départ (hors revalorisation).
  function bilanLignes(lignes, params, nbMois) {
    const g = bilanGroupe(lignes, params, nbMois, function () { return 'total'; })[0];
    return g ? { revenus: g.revenus, depenses: g.depenses, net: g.net } : { revenus: 0, depenses: 0, net: 0 };
  }

  // Regroupe les occurrences signées des nbMois premiers mois selon cleDe(ym) (ordre de première apparition, clés triées).
  function bilanGroupe(lignes, params, nbMois, cleDe) {
    const p = Object.assign({}, Pj.PARAMETRES_DEFAUT, params);
    const d = S.monthIndex(p.depart);
    const win = { debut: p.depart, fin: S.fromIndex(d + nbMois - 1) };
    const groupes = new Map();
    for (let i = 0; i < nbMois; i++) {
      const c = cleDe(S.fromIndex(d + i));
      if (!groupes.has(c)) groupes.set(c, { cle: c, revenus: 0, depenses: 0, net: 0 });
    }
    (lignes || []).filter(Pj.estActif).forEach(function (l) {
      occurrencesSignees(l, win).forEach(function (o) {
        const g = groupes.get(cleDe(o.ym));
        if (o.montant > 0) g.revenus += o.montant; else g.depenses -= o.montant;
        g.net = g.revenus - g.depenses;
      });
    });
    return Array.from(groupes.values());
  }

  // Un bilan par mois (nbMois mois consécutifs depuis le départ).
  function bilanParMois(lignes, params, nbMois) {
    return bilanGroupe(lignes, params, nbMois, function (ym) { return ym; }).map(function (g) {
      return { ym: g.cle, revenus: g.revenus, depenses: g.depenses, net: g.net };
    });
  }

  // Un bilan par année civile, de l'année de départ à l'année de départ + nbAnnees (première année partielle : à partir du mois de départ).
  function bilanParAnnee(lignes, params, nbAnnees) {
    const p = Object.assign({}, Pj.PARAMETRES_DEFAUT, params);
    const dep = S.parseYm(p.depart);
    const nbMois = (nbAnnees + 1) * 12 - (dep.m - 1);
    return bilanGroupe(lignes, params, nbMois, function (ym) { return ym.slice(0, 4); }).map(function (g) {
      return { annee: Number(g.cle), revenus: g.revenus, depenses: g.depenses, net: g.net };
    });
  }

  function restantMoyen(donnees, params) {
    const lignes = (donnees.annuel || []).concat(donnees.exceptionnel || []);
    return restantMensuel(donnees, params) + impactMensuel(lignes, params).reduce(function (a, x) { return a + x.impact_mensuel; }, 0);
  }

  function syntheseEvenements(evenements, params) {
    const win = fenetre(params);
    const groupes = new Map();
    (evenements || []).filter(Pj.estActif).forEach(function (e) {
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
      .filter(function (l) { return Pj.estActif(l) && l.type === 'depense' && l.fin; })
      .map(function (l) { return { libelle: l.libelle, fin: l.fin, libere_par_mois: montantAu(l, l.fin) }; })
      .sort(function (a, b) { return S.monthIndex(a.fin) - S.monthIndex(b.fin); });
  }

  // Détail d'un seul mois, calculé à la volée (mêmes règles que project()).
  function detailMois(donnees, evenements, params, ym) {
    const p = Object.assign({}, Pj.PARAMETRES_DEFAUT, params);
    const debutIdx = S.monthIndex(p.depart);
    const idx = S.monthIndex(ym);
    const out = { ym: ym, mensuel: { revenus: 0, depenses: 0 }, annuel: [], exceptionnel: [], futurs: [], prets: [], net: 0 };
    if (idx < debutIdx || idx >= debutIdx + p.horizon_annees * 12) return out;
    const facteur = Pj.facteurReval(p, idx);
    const win = { debut: ym, fin: ym };
    function lignes(liste, mensuelNumerique, groupe) {
      (liste || []).filter(Pj.estActif).forEach(function (ligne) {
        Pj.normaliserTout(ligne, mensuelNumerique).forEach(function (l) {
          S.occurrences(l.schedule, l.bornes, win).forEach(function (o) {
            const montant = l.revalorise ? o.montant * facteur : o.montant;
            if (groupe === null) out.mensuel[l.type === 'revenu' ? 'revenus' : 'depenses'] += montant;
            else (ligne.pret ? out.prets : groupe).push({ libelle: ligne.libelle, type: l.type, montant: (l.type === 'revenu' ? 1 : -1) * montant });
          });
        });
      });
    }
    lignes(donnees.mensuel, true, null);
    lignes(donnees.annuel, false, out.annuel);
    lignes(donnees.exceptionnel, false, out.exceptionnel);
    lignes(evenements, false, out.futurs);
    const somme = function (a) { return a.reduce(function (x, l) { return x + l.montant; }, 0); };
    out.net = out.mensuel.revenus - out.mensuel.depenses + somme(out.annuel) + somme(out.exceptionnel) + somme(out.futurs) + somme(out.prets);
    return out;
  }

  // Lignes de l'infobulle détaillée d'un mois : d = detailMois(), m = mois de project(), fmt = formateur monétaire.
  function lignesInfobulle(d, m, fmt) {
    const signe = function (v) { return (v > 0 ? '+' : '') + fmt(v); };
    const corps = ['Mensuel (régulier)', '  Revenus : ' + signe(d.mensuel.revenus), '  Dépenses : ' + signe(-d.mensuel.depenses)];
    [['Annuel', d.annuel], ['Exceptionnel / futur', d.exceptionnel.concat(d.futurs)], ['Prêts', d.prets || []]].forEach(function (g) {
      if (!g[1].length) return;
      corps.push(g[0]);
      g[1].forEach(function (l) { corps.push('  ' + String(l.libelle) + ' : ' + signe(l.montant)); });
    });
    return { corps: corps, pied: ['────────────────', 'Net du mois : ' + signe(m.net), 'Solde fin de mois : ' + fmt(m.solde)] };
  }

  // Historique synthétique des comptes (une ligne par mois, euros arrondis), pensé pour être relu par un LLM avec peu de tokens.
  // Avec `detail` (voir detailHistorique), une seconde section liste chaque revenu et chaque dépense de chaque mois.
  function historiqueCsv(mois, detail) {
    const r = Math.round;
    const champ = function (v) { const t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const montant = function (v) { return String(Math.round(v * 100) / 100 + 0); };
    let out = 'mois,revenus,depenses,solde\n' + (mois || []).map(function (m) {
      return m.ym + ',' + r(m.revenus) + ',' + r(m.depenses) + ',' + r(m.solde);
    }).join('\n') + '\n';
    if (detail) {
      out += '\nmois,origine,categorie,libelle,montant\n' + detail.map(function (d) {
        return [d.ym, d.origine, champ(d.categorie), champ(d.libelle), montant(d.montant)].join(',');
      }).join('\n') + '\n';
    }
    return out;
  }

  // Toutes les lignes (revenus > 0, dépenses < 0) de chaque mois de la projection, revalorisation comprise, triées par mois.
  // donnees = lignes mensuelles/annuelles/exceptionnelles ; futurs = événements et prêts (lignesFutures).
  function detailHistorique(donnees, futurs, params) {
    const p = Object.assign({}, Pj.PARAMETRES_DEFAUT, params);
    const win = fenetre(p);
    const rows = [];
    [['mensuel', donnees.mensuel, true], ['annuel', donnees.annuel, false], ['exceptionnel', donnees.exceptionnel, false], ['futur', futurs, false]].forEach(function (g) {
      (g[1] || []).filter(Pj.estActif).forEach(function (ligne) {
        Pj.normaliserTout(ligne, g[2]).forEach(function (l) {
          S.occurrences(l.schedule, l.bornes, win).forEach(function (o) {
            const m = l.revalorise ? o.montant * Pj.facteurReval(p, S.monthIndex(o.ym)) : o.montant;
            rows.push({ ym: o.ym, origine: ligne.pret ? 'pret' : g[0], categorie: ligne.categorie || '', libelle: String(ligne.libelle), montant: (l.type === 'revenu' ? 1 : -1) * m });
          });
        });
      });
    });
    return rows.sort(function (a, b) { return S.monthIndex(a.ym) - S.monthIndex(b.ym); }); // tri stable : l'ordre des groupes est conservé
  }

  // Options du sélecteur de période : 12 prochains mois, puis une option par année civile couverte.
  function optionsPeriode(mois) {
    const opts = [{ valeur: '12', libelle: '12 prochains mois' }];
    const vues = [];
    (mois || []).forEach(function (m) {
      const an = m.ym.slice(0, 4);
      if (vues.indexOf(an) < 0) vues.push(an);
    });
    vues.forEach(function (an) { opts.push({ valeur: an, libelle: an }); });
    return opts;
  }

  // Mois de la période choisie ; null si la période n'existe pas (l'appelant retombe sur '12').
  function moisDePeriode(mois, periode) {
    if (periode === '12') return (mois || []).slice(0, 12);
    const r = (mois || []).filter(function (m) { return m.ym.slice(0, 4) === periode; });
    return r.length ? r : null;
  }

  const api = {
    detailMois: detailMois,
    lignesInfobulle: lignesInfobulle,
    historiqueCsv: historiqueCsv,
    detailHistorique: detailHistorique,
    bilanLignes: bilanLignes,
    bilanParMois: bilanParMois,
    bilanParAnnee: bilanParAnnee,
    optionsPeriode: optionsPeriode,
    moisDePeriode: moisDePeriode,
    restantMensuel: restantMensuel,
    totauxMensuels: totauxMensuels,
    montantAu: montantAu,
    impactMensuel: impactMensuel,
    restantMoyen: restantMoyen,
    syntheseEvenements: syntheseEvenements,
    deficits: deficits,
    finsDePret: finsDePret,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
