(function (root) {
  'use strict';

  const B = root.Budget;
  const charts = [];
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

  function graphes(root_, mois) {
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
