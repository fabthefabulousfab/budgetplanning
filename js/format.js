(function (root) {
  'use strict';

  // Mois écrits en lettres, à partir d'une chaîne AAAA-MM (aucune Date : pas de décalage de fuseau).
  const COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function decouper(ym) {
    const s = String(ym);
    return { an: s.slice(0, 4), m: Number(s.slice(5, 7)) - 1 };
  }

  function moisCourt(ym) { const d = decouper(ym); return (COURTS[d.m] || '?') + ' ' + d.an; }
  function moisLong(ym) { const d = decouper(ym); return (LONGS[d.m] || '?') + ' ' + d.an; }

  const api = { moisCourt: moisCourt, moisLong: moisLong };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
