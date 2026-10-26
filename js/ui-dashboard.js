(function (root) {
  'use strict';

  const B = root.Budget;
  const charts = []; // ordre : [0] solde sur la période (menu Période), [1] solde cumulé sur N ans (menu Durée)
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmt = function (v) { return eur.format(Math.round(v) + 0); }; // + 0 : évite « -0 € »
  const signe = function (v) { return (v > 0 ? '+' : '') + fmt(v); };

  const DUREE_TRACE = 900; // la courbe se trace de gauche à droite
  const DUREE_TRACE_MAJ = 500; // après un changement de période ou de durée
  let sansAnimation = false; // redessin dû au changement de thème : pas de nouvelle entrée

  function css(nom) { return getComputedStyle(document.documentElement).getPropertyValue(nom).trim(); }
  function duree(ms) { return sansAnimation ? 0 : B.dureeAnimation(B.animationsReduites(), ms); }

  function el(tag, texte, attrs) {
    const e = document.createElement(tag);
    if (texte != null && texte !== '') e.textContent = texte;
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  // Section à filet : titre et note à gauche, menu de choix (optionnel) à droite.
  function carte(titre, note, controle) {
    const c = el('div', '', { class: 'carte' });
    const tete = el('div', '', { class: 'carte-tete' });
    const titres = el('div', '', { class: 'carte-titres' });
    titres.appendChild(el('h2', titre));
    if (note) titres.appendChild(el('p', note, { class: 'note' }));
    tete.appendChild(titres);
    if (controle) tete.appendChild(controle);
    c.appendChild(tete);
    return c;
  }

  // Menu « libellé + liste » ; `choix` : [{ valeur, libelle }].
  function menu(libelle, id, choix, valeur) {
    const ligne = el('div', '', { class: 'choix-periode' });
    ligne.appendChild(el('label', libelle, { for: id }));
    const select = el('select', '', { id: id });
    choix.forEach(function (x) {
      const op = el('option', x.libelle, { value: x.valeur });
      if (x.valeur === valeur) op.setAttribute('selected', '');
      select.appendChild(op);
    });
    ligne.appendChild(select);
    return { ligne: ligne, select: select };
  }

  // ---- Bandeau des chiffres clés -----------------------------------------------------------

  function chiffre(libelle, valeur, texte) {
    const d = el('div', '', { class: 'chiffre ' + (valeur < 0 ? 'chiffre-neg' : 'chiffre-pos') });
    d.appendChild(el('span', libelle, { class: 'chiffre-lib' }));
    d.appendChild(el('strong', texte, { class: 'chiffre-val' }));
    return d;
  }

  // Valeurs prises telles quelles dans chiffresCles (aucun calcul ici).
  function bandeau(root_, mois) {
    const k = B.chiffresCles(mois);
    if (!k) return;
    const b = el('div', '', { class: 'chiffres-cles', role: 'group', 'aria-label': 'Chiffres clés' });
    b.setAttribute('data-aide', 'chiffres-cles');
    b.appendChild(chiffre('Solde fin ' + B.moisLong(k.debut.ym), k.debut.solde, fmt(k.debut.solde)));
    b.appendChild(chiffre('Net du mois', k.debut.net, signe(k.debut.net)));
    b.appendChild(chiffre('Solde fin ' + B.moisLong(k.fin.ym), k.fin.solde, fmt(k.fin.solde)));
    root_.appendChild(b);
  }

  // ---- Graphiques --------------------------------------------------------------------------

  function canvas(carteEl, label, premier) {
    const w = el('div', '', { class: 'graphe' });
    if (premier) w.setAttribute('data-aide', 'solde-periode-graphe');
    const c = el('canvas', '', { role: 'img', 'aria-label': label });
    w.appendChild(c);
    carteEl.appendChild(w);
    return c;
  }

  // Position du zéro dans la zone du graphe (0 = haut, 1 = bas), bornée.
  function partZero(chart) {
    const a = chart.chartArea;
    const z = (chart.scales.y.getPixelForValue(0) - a.top) / Math.max(1, a.bottom - a.top);
    return Math.min(1, Math.max(0, z));
  }

  // Aire : lavis vert au-dessus de zéro, terre cuite en dessous, qui s'efface vers la ligne de zéro.
  function aire(c) {
    return function (ctx) {
      const ch = ctx.chart;
      if (!ch.chartArea || !ch.scales.y) return 'transparent';
      const a = ch.chartArea;
      const z = partZero(ch);
      const g = ch.ctx.createLinearGradient(0, a.top, 0, a.bottom);
      const f = c.aire; // lavis plus soutenu pres de la courbe, presque nul sur la ligne de zero
      const fn = z <= 0 ? f * 0.6 : f; // courbe entierement negative : une grande aire terre cuite, adoucie
      g.addColorStop(0, B.transparence(c.positif, f));
      g.addColorStop(z, B.transparence(c.positif, 0.02));
      g.addColorStop(z, B.transparence(c.negatif, 0.02));
      g.addColorStop(1, B.transparence(c.negatif, fn));
      return g;
    };
  }

  // Trait : vert au-dessus de zéro, terre cuite en dessous (changement net au passage de zéro).
  function trait(c) {
    return function (ctx) {
      const ch = ctx.chart;
      if (!ch.chartArea || !ch.scales.y) return c.positif;
      const a = ch.chartArea;
      const z = partZero(ch);
      const g = ch.ctx.createLinearGradient(0, a.top, 0, a.bottom);
      g.addColorStop(0, c.positif);
      g.addColorStop(z, c.positif);
      g.addColorStop(z, c.negatif);
      g.addColorStop(1, c.negatif);
      return g;
    };
  }

  function couleurPoint(c) {
    return function (ctx) { return ctx.raw < 0 ? c.negatif : c.positif; };
  }

  function donneesSolde(sel, c) {
    const dernier = sel.length - 1;
    return {
      labels: sel.map(function (m) { return m.ym; }),
      datasets: [{
        label: 'Solde',
        data: sel.map(function (m) { return m.solde; }),
        fill: 'origin',
        backgroundColor: aire(c),
        borderColor: trait(c),
        borderWidth: sel.length > 60 ? 1.75 : 2, // longues durées : trait un peu plus fin, plus fluide
        borderCapStyle: 'round',
        borderJoinStyle: 'round',
        cubicInterpolationMode: 'monotone',
        // Premier mois mis en avant (point plein cerclé de papier) ; dernier mois discret.
        pointRadius: function (ctx) { return ctx.dataIndex === 0 ? 4.5 : (ctx.dataIndex === dernier ? 3 : 0); },
        pointHoverRadius: 5,
        pointBackgroundColor: couleurPoint(c),
        pointBorderColor: c.carte,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2,
        pointHitRadius: 12,
      }],
    };
  }

  // Le graphe se trace de gauche à droite : découpe progressive de la zone des séries.
  const traceProgressif = {
    id: 'traceProgressif',
    beforeDatasetsDraw: function (chart) {
      const p = chart.$trace;
      if (p == null || p >= 1) return;
      const a = chart.chartArea;
      chart.ctx.save();
      chart.ctx.beginPath();
      chart.ctx.rect(a.left - 8, a.top - 12, (a.right - a.left + 16) * p, a.bottom - a.top + 24);
      chart.ctx.clip();
    },
    afterDatasetsDraw: function (chart) {
      const p = chart.$trace;
      if (p == null || p >= 1) return;
      chart.ctx.restore();
    },
  };

  // Repère vertical fin sous le mois survolé.
  const repereSurvol = {
    id: 'repereSurvol',
    beforeDatasetsDraw: function (chart) {
      const actifs = chart.getActiveElements();
      if (!actifs.length) return;
      const a = chart.chartArea;
      const x = actifs[0].element.x;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = chart.$couleurs.trait;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, a.top);
      ctx.lineTo(Math.round(x) + 0.5, a.bottom);
      ctx.stroke();
      ctx.restore();
    },
  };

  // Un jeton par tracé : un nouveau tracé (changement rapide de menu) arrête la boucle précédente.
  function lancerTrace(chart, ms) {
    const jeton = (chart.$traceId || 0) + 1;
    chart.$traceId = jeton;
    if (!ms) { chart.$trace = 1; chart.draw(); return; }
    const t0 = root.performance.now();
    chart.$trace = 0;
    function pas(t) {
      if (chart.$detruit || chart.$traceId !== jeton) return;
      const x = Math.min(1, Math.max(0, (t - t0) / ms));
      chart.$trace = 1 - Math.pow(1 - x, 3); // décélération douce
      chart.draw();
      if (x < 1) root.requestAnimationFrame(pas);
    }
    root.requestAnimationFrame(pas);
  }

  // Solde toujours nul (aucun mouvement) : une échelle de 0 à 100 € plutôt que des graduations de 0 à 1 €.
  function echelleVide(sel) {
    return sel.some(function (m) { return m.solde !== 0; }) ? undefined : 100;
  }

  function graphe(carteEl, label, premier, sel, getSel) {
    const c = Object.assign(B.couleursTheme(), { aire: Number(css('--aire-force')) || 0.2 });
    const o = B.optionsCommunes(c);
    o.plugins.tooltip = tooltipDetail(getSel);
    o.scales.y.beginAtZero = true;
    o.scales.y.suggestedMax = echelleVide(sel);
    o.scales.y.grid.color = function (ctx) { return ctx.tick && ctx.tick.value === 0 ? c.trait : c.grille; };
    const chart = new Chart(canvas(carteEl, label, premier), {
      type: 'line',
      data: donneesSolde(sel, c),
      options: o,
      plugins: [traceProgressif, repereSurvol],
    });
    chart.$couleurs = c;
    lancerTrace(chart, duree(DUREE_TRACE));
    charts.push(chart);
    return function (nouvelle) {
      masquerBulle(); // l'infobulle affichée décrivait un mois de l'ancienne sélection
      chart.data = donneesSolde(nouvelle, c);
      chart.options.scales.y.suggestedMax = echelleVide(nouvelle);
      chart.update('none');
      lancerTrace(chart, duree(DUREE_TRACE_MAJ));
    };
  }

  const ANNEES_SOLDE = [5, 8, 10, 15];
  let anneesSolde = 8; // durée du graphe Solde cumulé : survit aux redessins
  let periode = '12'; // période du premier graphe : survit aux redessins

  // Infobulle HTML (hors canvas) : jamais rognée par le graphe, repositionnée pour rester dans la fenêtre.
  let bulle = null;
  function masquerBulle() { if (bulle) bulle.style.display = 'none'; }

  // Beaucoup de lignes (ex. un mois chargé) : le détail passe sur plusieurs colonnes, puis la police diminue,
  // jusqu'à tenir dans la fenêtre sans couper de ligne.
  function ajusterBulle(corps) {
    const maxH = root.innerHeight - 16;
    const maxL = root.innerWidth - 16;
    for (const taille of [13, 12, 11, 10, 9]) {
      bulle.style.fontSize = taille + 'px';
      for (let n = 1; n <= 6; n++) {
        corps.style.columnCount = String(n);
        if (bulle.offsetWidth > maxL) break; // plus de colonnes = encore plus large
        if (bulle.offsetHeight <= maxH) return;
      }
    }
  }

  // Une ligne « libellé : montant » de lignesInfobulle devient libellé à gauche, montant à droite ;
  // une ligne sans montant est un titre de groupe ; une ligne indentée est un détail.
  function ligneBulle(texte, classe) {
    const i = texte.lastIndexOf(' : ');
    const d = el('div', '', { class: 'bulle-ligne' + (classe ? ' ' + classe : '') });
    if (/^\s/.test(texte)) d.classList.add('bulle-detail');
    if (i < 0) {
      d.classList.add('bulle-groupe');
      d.textContent = texte.trim();
      return d;
    }
    d.appendChild(el('span', texte.slice(0, i).trim()));
    d.appendChild(el('span', texte.slice(i + 3), { class: 'bulle-montant' }));
    return d;
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
    t.beforeBody.forEach(function (l) { corps.appendChild(ligneBulle(l)); });
    bulle.appendChild(corps);
    // Pied : le premier élément est un séparateur (filet), puis le net et le solde du mois.
    t.footer.forEach(function (l, i) {
      if (i === 0) { bulle.appendChild(el('div', '', { class: 'bulle-filet', 'aria-hidden': 'true' })); return; }
      bulle.appendChild(ligneBulle(l, 'bulle-total'));
    });
    bulle.style.display = 'block';
    ajusterBulle(corps);
    const r = ctx.chart.canvas.getBoundingClientRect();
    const w = bulle.offsetWidth;
    const h = bulle.offsetHeight;
    let x = r.left + t.caretX + 16;
    if (x + w > root.innerWidth - 8) x = r.left + t.caretX - w - 16;
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
        title: function (items) { const m = infos(items); return m ? B.moisLong(m.ym) : ''; },
        label: function () { return null; }, // le détail par origine remplace une ligne par série
        beforeBody: function (items) { const m = infos(items); return m ? lignes(m).corps : []; },
        footer: function (items) { const m = infos(items); return m ? lignes(m).pied : []; },
      },
    };
  }

  // Carte « Solde cumulé sur la période » : choix de la période (12 prochains mois ou une année civile).
  function soldePeriode(root_, mois) {
    const opts = B.optionsPeriode(mois);
    if (!opts.some(function (x) { return x.valeur === periode; })) periode = '12';
    let sel = B.moisDePeriode(mois, periode);
    const m = menu('Période', 'solde-periode', opts, periode);
    m.ligne.setAttribute('data-aide', 'solde-periode-choix');
    const c = carte('Solde cumulé sur la période', 'Solde en fin de mois sur la période choisie ; survolez un mois pour son détail : régulier, annuel, exceptionnel, futur et prêts.', m.ligne);
    root_.appendChild(c);
    const maj = graphe(c, 'Courbe du solde cumulé en fin de mois sur la période choisie', true, sel, function () { return sel; });
    m.select.addEventListener('change', function () {
      periode = m.select.value;
      sel = B.moisDePeriode(mois, periode) || B.moisDePeriode(mois, '12');
      maj(sel);
    });
  }

  function graphes(root_, mois) {
    soldePeriode(root_, mois);
    const m = menu('Durée affichée', 'solde-annees', ANNEES_SOLDE.map(function (a) { return { valeur: String(a), libelle: a + ' ans' }; }), String(anneesSolde));
    const c2 = carte('Solde cumulé', 'Compte courant + épargne de départ, puis résultat de chaque mois.', m.ligne);
    c2.setAttribute('data-aide', 'solde-long');
    root_.appendChild(c2);
    let selSolde = mois.slice(0, anneesSolde * 12);
    const maj = graphe(c2, 'Courbe du solde cumulé', false, selSolde, function () { return selSolde; });
    m.select.addEventListener('change', function () {
      anneesSolde = Number(m.select.value);
      selSolde = mois.slice(0, anneesSolde * 12);
      maj(selSolde);
    });
  }

  // ---- Détail d'un mois --------------------------------------------------------------------

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
      zone.appendChild(el('p', 'Aucun mouvement ce mois-ci.', { class: 'vide detail-vide' }));
    } else {
      const cols = el('div', '', { class: 'detail-cols' });
      cols.appendChild(colonneDetail('Revenus', d.revenus, 'detail-revenus'));
      cols.appendChild(colonneDetail('Dépenses', d.depenses, 'detail-depenses'));
      zone.appendChild(cols);
    }
    // Net et solde du mois en chiffres à empattement (valeurs de detailParCategorie, sans calcul).
    const pied = el('div', '', { class: 'detail-pied' });
    pied.appendChild(chiffre('Net du mois', d.net, signe(d.net)));
    pied.appendChild(chiffre('Solde fin de mois', d.solde, fmt(d.solde)));
    zone.appendChild(pied);
  }

  // Carte « Détail d'un mois par catégorie » : seule la zone de détail est redessinée au changement de mois.
  function detailParMois(root_, mois) {
    if (!mois.length) return;
    if (!mois.some(function (m) { return m.ym === moisDetail; })) moisDetail = mois[0].ym;
    const m = menu('Mois', 'detail-mois', mois.map(function (x) { return { valeur: x.ym, libelle: B.moisLong(x.ym) }; }), moisDetail);
    m.ligne.setAttribute('data-aide', 'detail-mois-choix');
    const c = carte('Détail d’un mois par catégorie', 'Revenus et dépenses du mois choisi, regroupés par catégorie, avec le détail de chaque ligne.', m.ligne);
    const zone = el('div', '', { class: 'detail-zone', 'aria-live': 'polite', 'data-aide': 'detail-mois-zone' });
    c.appendChild(zone);
    contenuDetail(zone, moisDetail);
    m.select.addEventListener('change', function () {
      moisDetail = m.select.value;
      contenuDetail(zone, moisDetail);
    });
    root_.appendChild(c);
  }

  function render(panneau) {
    charts.splice(0).forEach(function (ch) { ch.$detruit = true; ch.destroy(); });
    masquerBulle();
    panneau.textContent = '';
    const s = B.state;
    if (!s.donnees) return;
    Chart.defaults.font.family = css('--police-texte');
    bandeau(panneau, s.mois);
    graphes(panneau, s.mois);
    detailParMois(panneau, s.mois);
  }

  B.registerTab('dashboard', 'Tableau de bord', render);
  B.charts = charts; // lecture seule : permet de contrôler les graphes depuis la console

  // Les couleurs viennent de variables CSS : redessiner au changement de thème, sans rejouer les entrées.
  B.surChangementTheme(function () {
    sansAnimation = true;
    try { B.refresh(); } finally { sansAnimation = false; }
  });
})(this);
