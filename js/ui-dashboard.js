(function (root) {
  'use strict';

  const B = root.Budget;
  const charts = []; // ordre : [0] solde sur la période (menu Période), [1] solde cumulé sur N ans (menu Durée)
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmt = function (v) { return eur.format(Math.round(v) + 0); }; // + 0 : évite « -0 € »

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

  const ANNEES_SOLDE = [5, 8, 10, 15];
  let anneesSolde = 8; // durée du graphe Solde cumulé : survit aux redessins
  let periode = '12'; // période du premier graphe : survit aux redessins
  const moisFr = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const signe = function (v) { return (v > 0 ? '+' : '') + fmt(v); };

  function titreMois(ym) { return moisFr.format(new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1))); }

  // Infobulle HTML (hors canvas) : jamais rognée par le graphe, repositionnée pour rester dans la fenêtre.
  let bulle = null;
  function masquerBulle() { if (bulle) bulle.style.display = 'none'; }

  // Beaucoup de lignes (ex. un mois chargé) : le détail passe sur plusieurs colonnes, puis la police diminue,
  // jusqu'à tenir dans la fenêtre sans couper de ligne.
  function ajusterBulle(corps) {
    const maxH = root.innerHeight - 16;
    const maxL = root.innerWidth - 16;
    for (const taille of [12, 11, 10, 9]) {
      bulle.style.fontSize = taille + 'px';
      for (let n = 1; n <= 6; n++) {
        corps.style.columnCount = String(n);
        if (bulle.offsetWidth > maxL) break; // plus de colonnes = encore plus large
        if (bulle.offsetHeight <= maxH) return;
      }
    }
  }

  function afficherBulle(ctx) {
    const t = ctx.tooltip;
    if (!bulle) {
      bulle = el('div', '', { class: 'bulle-graphe', role: 'tooltip' });
      document.body.appendChild(bulle);
    }
    if (t.opacity === 0) { masquerBulle(); return; }
    bulle.textContent = '';
    bulle.appendChild(el('div', t.title.join(' '), { class: 'bulle-titre' }));
    const corps = el('div', '', { class: 'bulle-corps' });
    t.beforeBody.forEach(function (l) { corps.appendChild(el('div', l)); });
    bulle.appendChild(corps);
    t.footer.forEach(function (l, i) { bulle.appendChild(el('div', l, i === 0 ? {} : { class: 'bulle-total' })); });
    bulle.style.display = 'block';
    ajusterBulle(corps);
    const r = ctx.chart.canvas.getBoundingClientRect();
    const w = bulle.offsetWidth;
    const h = bulle.offsetHeight;
    let x = r.left + t.caretX + 14;
    if (x + w > root.innerWidth - 8) x = r.left + t.caretX - w - 14;
    const y = Math.min(Math.max(8, r.top + t.caretY - h / 2), Math.max(8, root.innerHeight - h - 8));
    bulle.style.left = Math.max(8, x) + 'px';
    bulle.style.top = y + 'px';
  }

  // Infobulle détaillée partagée par les graphes de la période : le détail du seul mois survolé
  // est calculé à l'affichage. getMois() renvoie les mois actuellement affichés.
  function tooltipDetail(getMois) {
    const infos = function (items) { return items.length ? getMois()[items[0].dataIndex] : null; };
    const lignes = function (m) {
      const s = B.state;
      return B.lignesInfobulle(B.detailMois(s.donnees, B.lignesFutures(s.evenements, s.prets), s.parametres, m.ym), m, fmt);
    };
    return {
      enabled: false, // l'infobulle canvas serait rognée par le graphe : affichage HTML via external
      external: afficherBulle,
      callbacks: {
        title: function (items) { const m = infos(items); return m ? titreMois(m.ym) : ''; },
        label: function () { return null; }, // le détail par origine remplace une ligne par série
        beforeBody: function (items) { const m = infos(items); return m ? lignes(m).corps : []; },
        footer: function (items) { const m = infos(items); return m ? lignes(m).pied : []; },
      },
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

  // Carte « Solde cumulé sur la période » : choix de la période (12 prochains mois ou une année civile).
  function soldePeriode(root_, mois) {
    const opts = B.optionsPeriode(mois);
    if (!opts.some(function (x) { return x.valeur === periode; })) periode = '12';
    let sel = B.moisDePeriode(mois, periode);
    const c = carte('Solde cumulé sur la période', 'Solde en fin de mois sur la période choisie ; survolez un mois pour son détail : régulier, annuel, exceptionnel, futur et prêts.');
    const ligne = el('div', '', { class: 'choix-periode' });
    ligne.appendChild(el('label', 'Période', { for: 'solde-periode' }));
    const select = el('select', '', { id: 'solde-periode' });
    opts.forEach(function (x) {
      const op = el('option', x.libelle, { value: x.valeur });
      if (x.valeur === periode) op.setAttribute('selected', '');
      select.appendChild(op);
    });
    ligne.appendChild(select);
    c.appendChild(ligne);
    c.appendChild(legende([{ couleur: css('--positif'), texte: 'Solde positif' }, { couleur: css('--negatif'), texte: 'Solde négatif' }]));
    const o = optionsCommunes();
    o.plugins.tooltip = tooltipDetail(function () { return sel; });
    const chart = new Chart(canvas(c, 'Histogramme du solde cumulé en fin de mois sur la période choisie'), {
      type: 'bar',
      data: donneesSolde(sel),
      options: o,
    });
    charts.push(chart);
    root_.appendChild(c);

    select.addEventListener('change', function () {
      periode = select.value;
      sel = B.moisDePeriode(mois, periode) || B.moisDePeriode(mois, '12');
      chart.data = donneesSolde(sel);
      chart.update();
    });
  }

  function graphes(root_, mois) {
    soldePeriode(root_, mois);
    const pos = css('--positif');
    const neg = css('--negatif');

    const c2 = carte('Solde cumulé', 'Compte courant + épargne de départ, puis résultat de chaque mois.');
    const ligneA = el('div', '', { class: 'choix-periode' });
    ligneA.appendChild(el('label', 'Durée affichée', { for: 'solde-annees' }));
    const selectA = el('select', '', { id: 'solde-annees' });
    ANNEES_SOLDE.forEach(function (a) {
      const op = el('option', a + ' ans', { value: String(a) });
      if (a === anneesSolde) op.setAttribute('selected', '');
      selectA.appendChild(op);
    });
    ligneA.appendChild(selectA);
    c2.appendChild(ligneA);
    c2.appendChild(legende([{ couleur: pos, texte: 'Solde positif' }, { couleur: neg, texte: 'Solde négatif' }]));
    let selSolde = mois.slice(0, anneesSolde * 12);
    const o3 = optionsCommunes();
    o3.plugins.tooltip = tooltipDetail(function () { return selSolde; });
    const chartLong = new Chart(canvas(c2, 'Histogramme du solde cumulé'), {
      type: 'bar',
      data: donneesSolde(selSolde),
      options: o3,
    });
    charts.push(chartLong);
    selectA.addEventListener('change', function () {
      anneesSolde = Number(selectA.value);
      selSolde = mois.slice(0, anneesSolde * 12);
      chartLong.data = donneesSolde(selSolde);
      chartLong.update();
    });
    root_.appendChild(c2);
  }

  const ORIGINES = { mensuel: 'mensuel', annuel: 'annuel', exceptionnel: 'exceptionnel', futur: 'futur', pret: 'prêt' };
  let moisDetail = null; // mois choisi dans « Détail d'un mois par catégorie » : survit aux redessins

  function colonneDetail(titre, col, classe) {
    const c = el('section', '', { class: 'detail-col ' + classe, 'aria-label': titre });
    const h = el('h3', '', { class: 'detail-entete' });
    h.appendChild(el('span', titre));
    h.appendChild(el('strong', fmt(col.total)));
    c.appendChild(h);
    col.categories.forEach(function (cat) {
      const g = el('div', '', { class: 'detail-cat' });
      const t = el('div', '', { class: 'detail-cat-titre' });
      t.appendChild(el('strong', cat.categorie));
      t.appendChild(el('strong', fmt(cat.total)));
      g.appendChild(t);
      cat.lignes.forEach(function (l) {
        const r = el('div', '', { class: 'detail-ligne' });
        const lib = el('span', l.libelle);
        lib.appendChild(el('small', ORIGINES[l.origine] || l.origine, { class: 'detail-origine' }));
        r.appendChild(lib);
        r.appendChild(el('span', fmt(l.montant)));
        g.appendChild(r);
      });
      c.appendChild(g);
    });
    return c;
  }

  function contenuDetail(zone, ym) {
    const s = B.state;
    const d = B.detailParCategorie(s.donnees, B.lignesFutures(s.evenements, s.prets), s.parametres, ym);
    zone.textContent = '';
    if (!d.revenus.categories.length && !d.depenses.categories.length) {
      zone.appendChild(el('p', 'Aucun mouvement ce mois-ci.', { class: 'vide' }));
    } else {
      const cols = el('div', '', { class: 'detail-cols' });
      cols.appendChild(colonneDetail('Revenus', d.revenus, 'detail-revenus'));
      cols.appendChild(colonneDetail('Dépenses', d.depenses, 'detail-depenses'));
      zone.appendChild(cols);
    }
    const pied = el('div', '', { class: 'detail-pied' });
    pied.appendChild(el('div', 'Net du mois : ' + signe(d.net)));
    pied.appendChild(el('div', 'Solde fin de mois : ' + fmt(d.solde)));
    zone.appendChild(pied);
  }

  // Carte « Détail d'un mois par catégorie » : seule la zone de détail est redessinée au changement de mois.
  function detailParMois(root_, mois) {
    if (!mois.length) return;
    if (!mois.some(function (m) { return m.ym === moisDetail; })) moisDetail = mois[0].ym;
    const c = carte('Détail d’un mois par catégorie', 'Revenus et dépenses du mois choisi, regroupés par catégorie, avec le détail de chaque ligne.');
    const ligne = el('div', '', { class: 'choix-periode' });
    ligne.appendChild(el('label', 'Mois', { for: 'detail-mois' }));
    const select = el('select', '', { id: 'detail-mois' });
    mois.forEach(function (m) {
      const op = el('option', titreMois(m.ym), { value: m.ym });
      if (m.ym === moisDetail) op.setAttribute('selected', '');
      select.appendChild(op);
    });
    ligne.appendChild(select);
    c.appendChild(ligne);
    const zone = el('div', '', { class: 'detail-zone', 'aria-live': 'polite' });
    c.appendChild(zone);
    contenuDetail(zone, moisDetail);
    select.addEventListener('change', function () {
      moisDetail = select.value;
      contenuDetail(zone, moisDetail);
    });
    root_.appendChild(c);
  }

  function render(panneau) {
    charts.splice(0).forEach(function (ch) { ch.destroy(); });
    masquerBulle();
    panneau.textContent = '';
    const s = B.state;
    if (!s.donnees) return;
    graphes(panneau, s.mois);
    detailParMois(panneau, s.mois);
  }

  B.registerTab('dashboard', 'Tableau de bord', render);
  B.charts = charts; // lecture seule : permet de contrôler les graphes depuis la console

  // Les couleurs viennent de variables CSS : redessiner au changement de thème.
  if (root.matchMedia) {
    root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { B.refresh(); });
  }
})(this);
