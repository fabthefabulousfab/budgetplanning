(function (root) {
  'use strict';

  // Réglages communs des graphiques : couleurs lues dans les variables CSS du thème, options Chart.js,
  // durée des animations (coupées si l'ordinateur demande de réduire les animations), changement de thème.
  const F = typeof module !== 'undefined' ? require('./format.js') : root.Budget;

  const SOMBRE = '(prefers-color-scheme: dark)';
  const REDUIT = '(prefers-reduced-motion: reduce)';
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmt = function (v) { return eur.format(Math.round(v) + 0); }; // + 0 : évite « -0 € »

  function lireVariable(nom) {
    return root.getComputedStyle ? root.getComputedStyle(root.document.documentElement).getPropertyValue(nom) : '';
  }

  // `lire(nom)` (optionnel) rend la valeur brute d'une variable CSS ; par défaut, le style calculé de la page.
  function couleursTheme(lire) {
    const l = lire || lireVariable;
    const v = function (nom) { return String(l(nom) || '').trim(); };
    return {
      encre2: v('--encre-2'),
      grille: v('--grille'),
      positif: v('--positif'),
      negatif: v('--negatif'),
      positifFond: v('--positif-fond'),
      carte: v('--carte'),
      trait: v('--trait'),
    };
  }

  // Couleur #rrggbb en rgba d'opacité `a` (le canvas ne lit pas les variables CSS) ; autre format : rendu tel quel.
  function transparence(couleur, a) {
    const s = String(couleur).trim();
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
    if (!m) return s;
    return 'rgba(' + [m[1], m[2], m[3]].map(function (h) { return parseInt(h, 16); }).join(', ') + ', ' + a + ')';
  }

  // Options Chart.js partagées : sans légende, grille horizontale très légère, mois en lettres.
  function optionsCommunes(couleurs) {
    const c = couleurs || couleursTheme();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 8, right: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (x) { return x.dataset.label + ' : ' + fmt(x.raw); } } },
      },
      scales: {
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: c.encre2, maxTicksLimit: 8, autoSkip: true, autoSkipPadding: 24, maxRotation: 0, padding: 6,
            callback: function (valeur) { return F.moisCourt(this.getLabelForValue(valeur)); },
          },
        },
        y: {
          border: { display: false },
          grid: { color: c.grille, lineWidth: 1, drawTicks: false },
          ticks: { color: c.encre2, padding: 10, maxTicksLimit: 6, precision: 0, callback: function (v) { return fmt(v); } },
        },
      },
    };
  }

  function requete(env, q) {
    const e = env || root;
    return e && typeof e.matchMedia === 'function' ? e.matchMedia(q) : null;
  }

  function animationsReduites(env) {
    const m = requete(env, REDUIT);
    return !!(m && m.matches);
  }

  function dureeAnimation(reduit, ms) { return reduit ? 0 : ms; }

  // Appelle `rappel` quand le thème du système change ; rend la fonction de désabonnement.
  function surChangementTheme(rappel, env) {
    const m = requete(env, SOMBRE);
    if (!m || typeof m.addEventListener !== 'function') return function () {};
    const f = function () { rappel(); };
    m.addEventListener('change', f);
    return function () { m.removeEventListener('change', f); };
  }

  const api = {
    couleursTheme: couleursTheme,
    transparence: transparence,
    optionsCommunes: optionsCommunes,
    animationsReduites: animationsReduites,
    dureeAnimation: dureeAnimation,
    surChangementTheme: surChangementTheme,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
