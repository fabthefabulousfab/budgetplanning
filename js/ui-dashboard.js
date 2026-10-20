(function (root) {
  'use strict';

  const B = root.Budget;
  const charts = []; // ordre : [0] focus mensuel, [1] solde sur la période, [2] revenus/dépenses, [3] solde cumulé
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmt = function (v) { return eur.format(Math.round(v)); };

  function css(nom) { return getComputedStyle(document.documentElement).getPropertyValue(nom).trim(); }

  function el(tag, texte, attrs) {
    const e = document.createElement(tag);
    if (texte != null && texte !== '') e.textContent = texte;
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function carte(titre, note) {
    const c = el('div', '', { class: 'carte' });
    c.appendChild(el('h2', titre));
    if (note) c.appendChild(el('p', note, { class: 'note' }));
    return c;
  }

  function legende(items) {
    const l = el('div', '', { class: 'legende' });
    items.forEach(function (it) {
      const s = el('span');
      const i = el('i');
      i.style.background = it.couleur;
      s.appendChild(i);
      s.appendChild(document.createTextNode(it.texte));
      l.appendChild(s);
    });
    return l;
  }

  function canvas(carteEl, label) {
    const w = el('div', '', { class: 'graphe' });
    const c = el('canvas', '', { role: 'img', 'aria-label': label });
    w.appendChild(c);
    carteEl.appendChild(w);
    return c;
  }

  function optionsCommunes() {
    const encre = css('--encre-2');
    const grille = css('--grille');
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) { return c.dataset.label + ' : ' + fmt(c.raw); } } },
      },
      scales: {
        x: { ticks: { color: encre, maxTicksLimit: 15, autoSkip: true, maxRotation: 0 }, grid: { display: false } },
        y: { ticks: { color: encre, callback: function (v) { return fmt(v); } }, grid: { color: grille } },
      },
    };
  }

  let periode = '12'; // période du Focus mensuel : survit aux redessins
  const moisFr = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const signe = function (v) { return (v > 0 ? '+' : '') + fmt(v); };

  function titreMois(ym) { return moisFr.format(new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1))); }

  // Infobulle détaillée partagée par les graphes de la période : le détail du seul mois survolé
  // est calculé à l'affichage. getMois() renvoie les mois actuellement affichés.
  function tooltipDetail(getMois) {
    const infos = function (items) { return items.length ? getMois()[items[0].dataIndex] : null; };
    const lignes = function (m) {
      const s = B.state;
      return B.lignesInfobulle(B.detailMois(s.donnees, s.evenements, s.parametres, m.ym), m, fmt);
    };
    return {
      displayColors: false,
      bodyFont: { family: 'ui-monospace, Menlo, monospace', size: 12 },
      footerFont: { family: 'ui-monospace, Menlo, monospace', size: 12 },
      callbacks: {
        title: function (items) { const m = infos(items); return m ? titreMois(m.ym) : ''; },
        label: function () { return null; }, // le détail par origine remplace une ligne par série
        beforeBody: function (items) { const m = infos(items); return m ? lignes(m).corps : []; },
        footer: function (items) { const m = infos(items); return m ? lignes(m).pied : []; },
      },
    };
  }

  function optionsFocus(getMois) {
    const o = optionsCommunes();
    o.scales.x.stacked = true;
    o.scales.y.stacked = true;
    o.plugins.tooltip = tooltipDetail(getMois);
    return o;
  }

  function donneesFocus(sel) {
    return {
      labels: sel.map(function (m) { return m.ym; }),
      datasets: [
        { label: 'Revenus', data: sel.map(function (m) { return m.revenus; }), backgroundColor: css('--positif'), borderRadius: 2 },
        { label: 'Dépenses', data: sel.map(function (m) { return -m.depenses; }), backgroundColor: css('--negatif'), borderRadius: 2 },
      ],
    };
  }

  function donneesSolde(sel) {
    return {
      labels: sel.map(function (m) { return m.ym; }),
      datasets: [{
        label: 'Solde',
        data: sel.map(function (m) { return m.solde; }),
        backgroundColor: sel.map(function (m) { return m.solde < 0 ? css('--negatif') : css('--positif'); }),
        borderRadius: 2,
      }],
    };
  }

  // Ajoute les cartes Focus mensuel puis Solde cumulé sur la période, pilotées par le même sélecteur.
  function focus(root_, mois) {
    const opts = B.optionsPeriode(mois);
    if (!opts.some(function (x) { return x.valeur === periode; })) periode = '12';
    let sel = B.moisDePeriode(mois, periode);
    const c = carte('Focus mensuel', 'Survolez un mois pour voir son détail : régulier, annuel, exceptionnel et futur.');
    const ligne = el('div', '', { class: 'choix-periode' });
    ligne.appendChild(el('label', 'Période', { for: 'focus-periode' }));
    const select = el('select', '', { id: 'focus-periode' });
    opts.forEach(function (x) {
      const op = el('option', x.libelle, { value: x.valeur });
      if (x.valeur === periode) op.setAttribute('selected', '');
      select.appendChild(op);
    });
    ligne.appendChild(select);
    c.appendChild(ligne);
    c.appendChild(legende([{ couleur: css('--positif'), texte: 'Revenus' }, { couleur: css('--negatif'), texte: 'Dépenses' }]));
    const chart = new Chart(canvas(c, 'Histogramme des revenus et des dépenses sur la période choisie'), {
      type: 'bar',
      data: donneesFocus(sel),
      options: optionsFocus(function () { return sel; }),
    });
    charts.push(chart);
    root_.appendChild(c);

    const c2 = carte('Solde cumulé sur la période', 'Solde en fin de mois sur la période choisie ci-dessus ; survolez un mois pour son détail.');
    c2.appendChild(legende([{ couleur: css('--positif'), texte: 'Solde positif' }, { couleur: css('--negatif'), texte: 'Solde négatif' }]));
    const o2 = optionsCommunes();
    o2.plugins.tooltip = tooltipDetail(function () { return sel; });
    const chartSolde = new Chart(canvas(c2, 'Histogramme du solde cumulé en fin de mois sur la période choisie'), {
      type: 'bar',
      data: donneesSolde(sel),
      options: o2,
    });
    charts.push(chartSolde);
    root_.appendChild(c2);

    select.addEventListener('change', function () {
      periode = select.value;
      sel = B.moisDePeriode(mois, periode) || B.moisDePeriode(mois, '12');
      chart.data = donneesFocus(sel);
      chart.update();
      chartSolde.data = donneesSolde(sel);
      chartSolde.update();
    });
  }

  function graphes(root_, mois) {
    focus(root_, mois);
    const pos = css('--positif');
    const neg = css('--negatif');
    const labels = mois.map(function (m) { return m.ym; });

    const c1 = carte('Revenus et dépenses par mois', 'Revenus au-dessus de zéro, dépenses en dessous.');
    c1.appendChild(legende([{ couleur: pos, texte: 'Revenus' }, { couleur: neg, texte: 'Dépenses' }]));
    const o1 = optionsCommunes();
    o1.scales.x.stacked = true;
    o1.scales.y.stacked = true;
    charts.push(new Chart(canvas(c1, 'Histogramme mensuel des revenus et des dépenses'), {
      type: 'bar',
      data: { labels: labels, datasets: [
        { label: 'Revenus', data: mois.map(function (m) { return m.revenus; }), backgroundColor: pos, borderRadius: 2 },
        { label: 'Dépenses', data: mois.map(function (m) { return -m.depenses; }), backgroundColor: neg, borderRadius: 2 },
      ] },
      options: o1,
    }));
    root_.appendChild(c1);

    const c2 = carte('Solde cumulé', 'Compte courant + épargne de départ, puis résultat de chaque mois.');
    c2.appendChild(legende([{ couleur: pos, texte: 'Solde positif' }, { couleur: neg, texte: 'Solde négatif' }]));
    charts.push(new Chart(canvas(c2, 'Histogramme du solde cumulé'), {
      type: 'bar',
      data: { labels: labels, datasets: [{
        label: 'Solde',
        data: mois.map(function (m) { return m.solde; }),
        backgroundColor: mois.map(function (m) { return m.solde < 0 ? neg : pos; }),
        borderRadius: 2,
      }] },
      options: optionsCommunes(),
    }));
    root_.appendChild(c2);
  }

  function tableau(entetes, lignes) {
    const t = el('table');
    const tr = el('tr');
    entetes.forEach(function (h) { tr.appendChild(el('th', h.t, h.num ? { class: 'num', scope: 'col' } : { scope: 'col' })); });
    t.appendChild(el('thead')).appendChild(tr);
    const tb = el('tbody');
    lignes.forEach(function (l) {
      const r = el('tr');
      l.forEach(function (c, i) {
        const td = el('td', c.t, entetes[i].num ? { class: 'num' + (c.neg ? ' neg' : '') } : {});
        r.appendChild(td);
      });
      tb.appendChild(r);
    });
    t.appendChild(tb);
    return t;
  }

  function periodesDeficit(root_, mois) {
    const c = carte('Périodes de déficit', 'Mois où le solde cumulé passe sous zéro ; montant manquant maximal sur la période.');
    const d = B.deficits(mois);
    if (!d.length) c.appendChild(el('p', 'Aucun déficit sur la période projetée.', { class: 'vide' }));
    else c.appendChild(tableau(
      [{ t: 'Début' }, { t: 'Fin' }, { t: 'Mois', num: true }, { t: 'Manque maximal', num: true }],
      d.map(function (p) { return [{ t: p.debut }, { t: p.fin }, { t: String(p.mois_en_deficit) }, { t: fmt(p.manque_max), neg: true }]; })
    ));
    root_.appendChild(c);
  }

  function fins(root_, donnees) {
    const c = carte('Fins de prêts et de charges', 'Montants de départ (hors revalorisation) libérés chaque mois à l’échéance.');
    const f = B.finsDePret(donnees);
    if (!f.length) c.appendChild(el('p', 'Aucune charge mensuelle avec date de fin.', { class: 'vide' }));
    else c.appendChild(tableau(
      [{ t: 'Fin' }, { t: 'Libellé' }, { t: 'Libéré par mois (montant de départ)', num: true }],
      f.map(function (x) { return [{ t: x.fin }, { t: x.libelle }, { t: fmt(x.libere_par_mois) }]; })
    ));
    root_.appendChild(c);
  }

  function render(panneau) {
    charts.splice(0).forEach(function (ch) { ch.destroy(); });
    panneau.textContent = '';
    const s = B.state;
    if (!s.donnees) return;
    graphes(panneau, s.mois);
    periodesDeficit(panneau, s.mois);
    fins(panneau, s.donnees);
  }

  B.registerTab('dashboard', 'Tableau de bord', render);
  B.charts = charts; // lecture seule : permet de contrôler les graphes depuis la console

  // Les couleurs viennent de variables CSS : redessiner au changement de thème.
  if (root.matchMedia) {
    root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { B.refresh(); });
  }
})(this);
