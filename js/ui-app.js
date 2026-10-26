(function (root) {
  'use strict';

  const B = root.Budget;
  const state = { dir: null, donnees: null, evenements: [], prets: [], parametres: null, mois: [], orphelins: [], avertissements: [] };
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

  // Avertissements non bloquants (affichés à l'ouverture, jusqu'à fermeture ou prochain chargement).
  function avertir(messages) {
    const b = $('avertissements');
    b.textContent = '';
    if (!messages || !messages.length) { b.hidden = true; return; }
    b.hidden = false;
    const ul = el('ul');
    messages.forEach(function (m) { ul.appendChild(el('li', m)); });
    b.appendChild(ul);
    const f = el('button', 'Fermer', { type: 'button', class: 'btn-lien', 'aria-label': 'Fermer les avertissements' });
    f.addEventListener('click', function () { avertir([]); });
    b.appendChild(f);
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
        el('h2', 'Navigateur non pris en charge', { 'data-aide': 'accueil-navigateur' }),
        el('p', "Cette application a besoin de l'accès aux dossiers locaux (File System Access API). Ouvrez cette page dans Chrome ou Edge sur ordinateur."),
      ]);
      return;
    }
    accueil([
      el('h2', 'Bienvenue', { 'data-aide': 'accueil-intro' }),
      el('p', 'Choisissez le dossier data/ du projet : les fichiers YAML y sont lus et enregistrés directement, rien ne quitte votre ordinateur. Vous pouvez aussi importer une sauvegarde exportée depuis un autre ordinateur.'),
    ].concat(boutonsOuverture()));
  }

  // Sélecteur de fichier hors DOM ; résout null si l'utilisateur annule.
  function choisirFichier() {
    return new Promise(function (resolve) {
      const input = el('input', '', { type: 'file', accept: '.yaml,.yml,text/yaml' });
      input.addEventListener('change', function () { resolve(input.files && input.files[0] ? input.files[0] : null); });
      input.addEventListener('cancel', function () { resolve(null); });
      input.click();
    });
  }

  function confirmerRemplacement(noms) {
    return Promise.resolve(root.confirm('Les fichiers suivants existent déjà dans ce dossier et seront remplacés :\n\n' + noms.join('\n') + '\n\nPensez à exporter une sauvegarde de ce dossier avant de continuer. Remplacer ces fichiers ?'));
  }

  // Étape 2 : le choix du dossier exige un clic récent, d'où un bouton dédié une fois la sauvegarde lue et validée.
  function proposerDossier(zone, sauvegarde) {
    zone.textContent = '';
    const nb = Object.keys(sauvegarde.fichiers).length;
    zone.appendChild(el('p', 'Sauvegarde « ' + sauvegarde.nom + ' » valide (' + nb + (nb > 1 ? ' fichiers' : ' fichier') + '). Choisissez le dossier de destination.', { role: 'status' }));
    const choisir = el('button', 'Choisir le dossier de destination', { type: 'button', class: 'btn', 'aria-label': 'Choisir le dossier de destination de la sauvegarde' });
    const annuler = el('button', 'Annuler', { type: 'button', class: 'btn-lien', 'aria-label': 'Annuler l’import de la sauvegarde' });
    annuler.addEventListener('click', function () { zone.textContent = ''; });
    choisir.addEventListener('click', async function () {
      try {
        const dir = await root.showDirectoryPicker({ mode: 'readwrite' });
        await B.importerSauvegarde(sauvegarde, dir, { confirmerRemplacement: confirmerRemplacement });
        zone.textContent = '';
        await start(dir);
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        if (e && e.annule) { zone.textContent = ''; return; }
        const message = e && e.message ? e.message : String(e);
        // Après un échec, l'écran doit refléter le disque : on recharge le dossier ouvert (s'il y en a un), puis on affiche l'erreur.
        if (state.dir) { zone.textContent = ''; await start(state.dir); }
        erreur(message);
      }
    });
    zone.appendChild(choisir);
    zone.appendChild(annuler);
  }

  // Import : fichier lu et validé d'abord (rien n'est écrit en cas d'erreur), puis choix du dossier dans `zone`.
  async function importerFichier(zone) {
    try {
      const fichier = await choisirFichier();
      if (!fichier) return;
      erreur('');
      if (fichier.size > 5 * 1024 * 1024) throw new Error('Sauvegarde invalide : fichier trop volumineux (5 Mo au maximum).');
      const sauvegarde = await B.lireSauvegarde(await fichier.text());
      proposerDossier(zone, sauvegarde);
    } catch (e) {
      zone.textContent = '';
      erreur(e && e.message ? e.message : String(e));
    }
  }

  function boutonsOuverture() {
    const zone = el('div', '', { class: 'zone-import' });
    const ouvrir = el('button', 'Ouvrir le dossier data/', { type: 'button', class: 'btn', 'data-aide': 'accueil-ouvrir' });
    ouvrir.addEventListener('click', ouvrirDossier);
    const importer = el('button', 'Importer une sauvegarde', { type: 'button', class: 'btn', 'aria-label': 'Importer une sauvegarde', 'data-aide': 'accueil-importer' });
    importer.addEventListener('click', function () { importerFichier(zone); });
    const ligne = el('div', '', { class: 'actions-accueil' });
    ligne.appendChild(ouvrir);
    ligne.appendChild(importer);
    return [ligne, zone];
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
      marquerAide(panneau);
    } catch (e) {
      erreur('Erreur d’affichage (' + t.titre + ') : ' + e.message);
      console.error(e);
    }
  }

  // Cibles de la visite guidée communes aux onglets d'édition : première ligne (œil, case « Palier ») et premier palier
  // du panneau. Ne change aucun comportement.
  function marquerAide(panneau) {
    const oeil = panneau.querySelector('.oeil');
    if (oeil) oeil.setAttribute('data-aide', 'ligne-oeil');
    const casePalier = panneau.querySelector('.case-palier');
    if (casePalier) casePalier.setAttribute('data-aide', 'ligne-palier');
    const palier = panneau.querySelector('tr.palier');
    if (palier) palier.setAttribute('data-aide', 'palier-ligne');
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

  // Résout quand toutes les écritures en cours sont terminées (utilisé avant un export).
  async function attendreEcritures() {
    await Promise.all(Object.keys(files).map(function (k) { return files[k].catch(function () {}); }));
  }

  async function persistNow(kind) {
    const fn = {
      donnees: function () { return B.saveDonnees(state.dir, state.donnees, state.orphelins); },
      evenements: function () { return B.saveEvenements(state.dir, state.evenements, state.prets); },
      prets: function () { return B.saveEvenements(state.dir, state.evenements, state.prets); },
      parametres: function () { return B.saveParametres(state.dir, state.parametres); },
    }[kind];
    if (!fn) throw new Error('Type de fichier inconnu : ' + kind);
    try {
      await fn();
      erreur('');
      // Un enregistrement de donnees réussi prouve que toutes les lignes (paliers compris) sont valides : les avertissements de chargement sont périmés.
      if (kind === 'donnees' && state.avertissements.length) { state.avertissements = []; avertir([]); }
    } catch (e) {
      erreur(e.message);
      throw e;
    }
    refresh();
    // Historique synthétique : une erreur d'écriture n'invalide pas l'enregistrement qui vient de réussir.
    try {
      const detail = B.detailHistorique(state.donnees, B.lignesFutures(state.evenements, state.prets), state.parametres);
      await B.ecrireHistorique(state.dir, state.mois, detail);
    } catch (e) {
      erreur('Historique non enregistré (' + FICHIER_HISTORIQUE + ') : ' + e.message);
    }
  }

  // Tableau de bilans en ligne : une colonne par période (+ un total), lignes Revenus / Dépenses / Bilan.
  const eurBilan = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  function tableauBilan(libelle, periodes) {
    const f = function (v) { return eurBilan.format(Math.round(v) + 0); };
    const total = periodes.reduce(function (a, p) { return { revenus: a.revenus + p.revenus, depenses: a.depenses + p.depenses, net: a.net + p.net }; }, { revenus: 0, depenses: 0, net: 0 });
    const t = el('table', '', { class: 'bilan', 'aria-label': libelle });
    const tr0 = el('tr');
    tr0.appendChild(el('th', '', { scope: 'col' }));
    periodes.forEach(function (p) { tr0.appendChild(el('th', p.titre, { scope: 'col', class: 'num' })); });
    tr0.appendChild(el('th', 'Total', { scope: 'col', class: 'num' }));
    t.appendChild(el('thead')).appendChild(tr0);
    const tb = el('tbody');
    [['Revenus', 'revenus', 1], ['Dépenses', 'depenses', -1], ['Bilan', 'net', 1]].forEach(function (r) {
      const tr = el('tr', '', r[1] === 'net' ? { class: 'bilan-net' } : {});
      tr.appendChild(el('th', r[0], { scope: 'row' }));
      periodes.concat([total]).forEach(function (p) {
        const v = r[2] * p[r[1]];
        tr.appendChild(el('td', p[r[1]] === 0 && r[1] !== 'net' ? '—' : f(v), { class: v < 0 ? 'num neg' : 'num' }));
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    const w = el('div', '', { class: 'defil' });
    w.appendChild(t);
    return w;
  }

  // Bouton « œil » : masque ou réaffiche une ligne (actif: false = ignorée par la projection).
  function boutonOeil(actifLigne, libelle, onClick, cle) {
    const b = el('button', '', { type: 'button', class: 'btn-icone oeil' + (actifLigne ? '' : ' oeil-ferme'), 'aria-pressed': String(!actifLigne), 'aria-label': (actifLigne ? 'Masquer la ligne ' : 'Afficher la ligne ') + libelle, title: actifLigne ? 'Masquer (ignorée dans la projection)' : 'Masquée : cliquer pour la reprendre en compte' });
    if (cle) b.setAttribute('data-cle', cle);
    b.appendChild(B.creerIcone(actifLigne ? 'oeil' : 'oeil-barre'));
    b.addEventListener('click', onClick);
    return b;
  }

  // Petit bouton-icône (corbeille…) : nom accessible et info-bulle obligatoires, l'icône est décorative.
  function boutonIcone(icone, label, titre, cle, onClick) {
    const b = el('button', '', { type: 'button', class: 'btn-icone btn-' + icone, 'aria-label': label, title: titre });
    if (cle) b.setAttribute('data-cle', cle);
    b.appendChild(B.creerIcone(icone));
    b.addEventListener('click', onClick);
    return b;
  }

  // Champ de mois : « — » quand il est vide ; le format attendu apparaît au focus et en info-bulle.
  function champMois(input) {
    input.setAttribute('placeholder', '—');
    input.setAttribute('title', 'Mois au format AAAA-MM, par exemple 2028-06');
    input.addEventListener('focus', function () { input.setAttribute('placeholder', 'AAAA-MM'); });
    input.addEventListener('blur', function () { input.setAttribute('placeholder', '—'); });
    return input;
  }

  async function start(dir) {
    erreur('');
    avertir([]);
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
    state.orphelins = r.orphelins || [];
    state.avertissements = r.avertissements || [];
    avertir(state.avertissements);
    if (B.paliersUI) B.paliersUI.reset();
    if (r.donnees === null) {
      accueil([
        el('h2', 'Aucune donnée courante', { 'data-aide': 'accueil-intro' }),
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
    boutonsOuverture().forEach(function (n) { a.appendChild(n); });
  }

  Object.assign(B, { state: state, refresh: refresh, persist: persist, boutonOeil: boutonOeil, boutonIcone: boutonIcone, champMois: champMois, tableauBilan: tableauBilan, registerTab: registerTab, ongletActif: function () { return actif; }, start: start, erreur: erreur, attendreEcritures: attendreEcritures, importerFichier: importerFichier });
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ecranAccueil);
    else ecranAccueil();
  }
})(this);
