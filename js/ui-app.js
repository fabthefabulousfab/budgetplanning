(function (root) {
  'use strict';

  const B = root.Budget;
  const state = { dir: null, donnees: null, evenements: [], parametres: null, mois: [] };
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

  function ecranAccueil() {
    if (!B.supported()) {
      accueil([
        el('h2', 'Navigateur non pris en charge'),
        el('p', "Cette application a besoin de l'accès aux dossiers locaux (File System Access API). Ouvrez cette page dans Chrome ou Edge sur ordinateur."),
      ]);
      return;
    }
    const bouton = el('button', 'Ouvrir le dossier data/', { type: 'button', class: 'btn' });
    bouton.addEventListener('click', async function () {
      try {
        const dir = await root.showDirectoryPicker({ mode: 'readwrite' });
        await start(dir);
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        erreur(e && e.message ? e.message : String(e));
      }
    });
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
    state.mois = B.project(state.donnees, state.evenements, state.parametres);
    dessiner();
  }

  // Écritures sérialisées par type de fichier : chaque appel attend la fin du précédent.
  const files = {};
  function persist(kind) {
    const run = (files[kind] || Promise.resolve()).catch(function () {}).then(function () { return persistNow(kind); });
    files[kind] = run;
    return run;
  }

  async function persistNow(kind) {
    const fn = { donnees: B.saveDonnees, evenements: B.saveEvenements, parametres: B.saveParametres }[kind];
    if (!fn) throw new Error('Type de fichier inconnu : ' + kind);
    try {
      await fn(state.dir, state[kind]);
      erreur('');
    } catch (e) {
      erreur(e.message);
      throw e;
    }
    refresh();
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
    state.mois = B.project(state.donnees, state.evenements, state.parametres);
    construireOnglets();
  }

  function ecranAccueilBouton() {
    const a = $('accueil');
    const b = el('button', 'Ouvrir le dossier data/', { type: 'button', class: 'btn' });
    b.addEventListener('click', function () { ecranAccueil(); });
    a.appendChild(b);
  }

  Object.assign(B, { state: state, refresh: refresh, persist: persist, registerTab: registerTab, start: start });
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ecranAccueil);
    else ecranAccueil();
  }
})(this);
