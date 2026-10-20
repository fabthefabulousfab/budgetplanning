(function (root) {
  'use strict';

  const B = root.Budget;
  const state = { dir: null, donnees: null, evenements: [], prets: [], parametres: null, mois: [] };
  const FICHIER_HISTORIQUE = 'historique-comptes.csv';
  const tabs = [];
  let actif = null;

  const $ = function (id) { return document.getElementById(id); };

  function erreur(message) {
    const b = $('bandeau');
    if (!message) { b.hidden = true; b.textContent = ''; return; }
    b.hidden = false;
    b.textContent = message;
  }

  function accueil(contenu) {
    const a = $('accueil');
    a.hidden = false;
    $('panneaux').hidden = true;
    $('onglets').hidden = true;
    a.textContent = '';
    contenu.forEach(function (n) { a.appendChild(n); });
  }

  function el(tag, texte, attrs) {
    const e = document.createElement(tag);
    if (texte) e.textContent = texte;
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  async function ouvrirDossier() {
    try {
      const dir = await root.showDirectoryPicker({ mode: 'readwrite' });
      await start(dir);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      erreur(e && e.message ? e.message : String(e));
    }
  }

  function ecranAccueil() {
    if (!B.supported()) {
      accueil([
        el('h2', 'Navigateur non pris en charge'),
        el('p', "Cette application a besoin de l'accès aux dossiers locaux (File System Access API). Ouvrez cette page dans Chrome ou Edge sur ordinateur."),
      ]);
      return;
    }
    const bouton = el('button', 'Ouvrir le dossier data/', { type: 'button', class: 'btn' });
    bouton.addEventListener('click', ouvrirDossier);
    accueil([
      el('h2', 'Bienvenue'),
      el('p', 'Choisissez le dossier data/ du projet : les fichiers YAML y sont lus et enregistrés directement, rien ne quitte votre ordinateur.'),
      bouton,
    ]);
  }

  function registerTab(id, titre, render) {
    tabs.push({ id: id, titre: titre, render: render });
    if (state.donnees) construireOnglets();
  }

  function construireOnglets() {
    const nav = $('onglets');
    const panneaux = $('panneaux');
    nav.textContent = '';
    panneaux.textContent = '';
    tabs.forEach(function (t) {
      const b = el('button', t.titre, { type: 'button', role: 'tab', id: 'tab-' + t.id, 'aria-controls': 'panneau-' + t.id });
      b.addEventListener('click', function () { activer(t.id); });
      nav.appendChild(b);
      panneaux.appendChild(el('section', '', { id: 'panneau-' + t.id, role: 'tabpanel', 'aria-labelledby': 'tab-' + t.id, hidden: '' }));
    });
    nav.hidden = tabs.length < 2;
    panneaux.hidden = false;
    if (tabs.length) activer(actif && tabs.some(function (t) { return t.id === actif; }) ? actif : tabs[0].id);
  }

  function activer(id) {
    actif = id;
    tabs.forEach(function (t) {
      $('tab-' + t.id).setAttribute('aria-selected', String(t.id === id));
      $('panneau-' + t.id).hidden = t.id !== id;
    });
    dessiner();
  }

  // Seul l'onglet visible est dessiné (Chart.js mesure mal un canvas masqué) ; les autres le sont à l'activation.
  function dessiner() {
    const t = tabs.find(function (x) { return x.id === actif; });
    if (!t) return;
    const panneau = $('panneau-' + t.id);
    try {
      t.render(panneau);
    } catch (e) {
      erreur('Erreur d’affichage (' + t.titre + ') : ' + e.message);
      console.error(e);
    }
  }

  function refresh() {
    if (!state.donnees) return;
    state.mois = B.project(state.donnees, B.lignesFutures(state.evenements, state.prets), state.parametres);
    dessiner();
  }

  // Écritures sérialisées par type de fichier : chaque appel attend la fin du précédent.
  const files = {};
  // Les prêts sont enregistrés dans evenements-futurs.yaml : même file d'écriture que les événements.
  function persist(kind) {
    const cle = kind === 'prets' ? 'evenements' : kind;
    const run = (files[cle] || Promise.resolve()).catch(function () {}).then(function () { return persistNow(kind); });
    files[cle] = run;
    return run;
  }

  async function persistNow(kind) {
    const fn = {
      donnees: function () { return B.saveDonnees(state.dir, state.donnees); },
      evenements: function () { return B.saveEvenements(state.dir, state.evenements, state.prets); },
      prets: function () { return B.saveEvenements(state.dir, state.evenements, state.prets); },
      parametres: function () { return B.saveParametres(state.dir, state.parametres); },
    }[kind];
    if (!fn) throw new Error('Type de fichier inconnu : ' + kind);
    try {
      await fn();
      erreur('');
    } catch (e) {
      erreur(e.message);
      throw e;
    }
    refresh();
    // Historique synthétique : une erreur d'écriture n'invalide pas l'enregistrement qui vient de réussir.
    try {
      await B.ecrireHistorique(state.dir, state.mois);
    } catch (e) {
      erreur('Historique non enregistré (' + FICHIER_HISTORIQUE + ') : ' + e.message);
    }
  }

  // Bouton « œil » : masque ou réaffiche une ligne (actif: false = ignorée par la projection).
  function boutonOeil(actifLigne, libelle, onClick, cle) {
    const b = el('button', '', { type: 'button', class: 'oeil' + (actifLigne ? '' : ' oeil-ferme'), 'aria-pressed': String(!actifLigne), 'aria-label': (actifLigne ? 'Masquer la ligne ' : 'Afficher la ligne ') + libelle, title: actifLigne ? 'Masquer (ignorée dans la projection)' : 'Masquée : cliquer pour la reprendre en compte' });
    if (cle) b.setAttribute('data-cle', cle);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    ['M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'].concat(actifLigne ? [] : ['M3 3l18 18']).forEach(function (d) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '2');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
    });
    b.appendChild(svg);
    b.addEventListener('click', onClick);
    return b;
  }

  async function start(dir) {
    erreur('');
    let r;
    try {
      r = await B.loadAll(dir);
    } catch (e) {
      erreur(e.message);
      return; // jamais d'écriture en cas d'erreur
    }
    state.dir = dir;
    state.donnees = r.donnees;
    state.evenements = r.evenements;
    state.prets = r.prets;
    state.parametres = r.parametres;
    if (r.donnees === null) {
      accueil([
        el('h2', 'Aucune donnée courante'),
        el('p', 'Lancez ./demarrer.sh pour importer budget.xlsx, puis rouvrez le dossier data/.'),
      ]);
      ecranAccueilBouton();
      return;
    }
    $('accueil').hidden = true;
    state.mois = B.project(state.donnees, B.lignesFutures(state.evenements, state.prets), state.parametres);
    construireOnglets();
  }

  function ecranAccueilBouton() {
    const a = $('accueil');
    const b = el('button', 'Ouvrir le dossier data/', { type: 'button', class: 'btn' });
    b.addEventListener('click', ouvrirDossier);
    a.appendChild(b);
  }

  Object.assign(B, { state: state, refresh: refresh, persist: persist, boutonOeil: boutonOeil, registerTab: registerTab, start: start });
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ecranAccueil);
    else ecranAccueil();
  }
})(this);
