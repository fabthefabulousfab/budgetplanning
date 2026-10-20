(function (root) {
  'use strict';

  function ym(year, month) {
    return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0');
  }

  function parseYm(s) {
    const m = /^(\d{4})-(\d{1,2})$/.exec(String(s));
    if (!m) throw new Error('Mois invalide : « ' + s + ' » (attendu AAAA-MM).');
    return { y: Number(m[1]), m: Number(m[2]) };
  }

  function monthIndex(s) {
    const p = parseYm(s);
    return p.y * 12 + p.m - 1;
  }

  function fromIndex(i) {
    return ym(Math.floor(i / 12), (i % 12) + 1);
  }

  const ITEM = /^(?:(\d{4})-)?(\d{1,2})[-:](\d+(?:\.\d+)?)$/;

  function parseEcheances(text) {
    const t = String(text == null ? '' : text).trim();
    if (t === '') throw new Error('Échéances vides.');
    if (/^\d+(\.\d+)?$/.test(t)) {
      const montant = Number(t);
      if (!(montant > 0)) throw new Error('Le montant doit être supérieur à 0.');
      return { kind: 'mensuel', montant };
    }
    const items = t.split(',').map(function (raw) {
      const part = raw.trim();
      const m = ITEM.exec(part);
      if (!m) throw new Error('Échéance invalide : « ' + part + ' ».');
      const mois = Number(m[2]);
      const montant = Number(m[3]);
      if (mois < 1 || mois > 12) throw new Error('Mois invalide (1 à 12) : « ' + part + ' ».');
      if (!(montant > 0)) throw new Error('Le montant doit être supérieur à 0 : « ' + part + ' ».');
      return { annee: m[1] ? Number(m[1]) : null, mois: mois, montant: montant };
    });
    const avecAnnee = items.filter(function (i) { return i.annee !== null; }).length;
    if (avecAnnee === items.length) {
      return { kind: 'dates', items: items.map(function (i) { return { ym: ym(i.annee, i.mois), montant: i.montant }; }) };
    }
    if (avecAnnee === 0) {
      return { kind: 'annuel', items: items.map(function (i) { return { mois: i.mois, montant: i.montant }; }) };
    }
    throw new Error('Mélange d’échéances avec et sans année : utilisez un seul format.');
  }

  function occurrences(schedule, bornes, fenetre) {
    bornes = bornes || {};
    const lo = Math.max(monthIndex(fenetre.debut), bornes.debut ? monthIndex(bornes.debut) : -Infinity);
    const hi = Math.min(monthIndex(fenetre.fin), bornes.fin ? monthIndex(bornes.fin) : Infinity);
    const out = [];
    if (lo > hi) return out;
    if (schedule.kind === 'mensuel') {
      for (let i = lo; i <= hi; i++) out.push({ ym: fromIndex(i), montant: schedule.montant });
    } else if (schedule.kind === 'annuel') {
      for (let i = lo; i <= hi; i++) {
        const mois = (i % 12) + 1;
        schedule.items.forEach(function (it) {
          if (it.mois === mois) out.push({ ym: fromIndex(i), montant: it.montant });
        });
      }
    } else {
      schedule.items.forEach(function (it) {
        const i = monthIndex(it.ym);
        if (i >= lo && i <= hi) out.push({ ym: it.ym, montant: it.montant });
      });
      out.sort(function (a, b) { return monthIndex(a.ym) - monthIndex(b.ym); });
    }
    return out;
  }

  const api = { parseEcheances: parseEcheances, ym: ym, parseYm: parseYm, monthIndex: monthIndex, fromIndex: fromIndex, occurrences: occurrences };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
