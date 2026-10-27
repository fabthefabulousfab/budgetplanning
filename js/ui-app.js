(function (root) {
  'use strict';

  const B = root.Budget;
  const state = { dir: null, donnees: null, evenements: [], prets: [], parametres: null, mois: [], orphelins: [], avertissements: [], migres: { donnees: false, evenements: false } };
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
    if (B.echelonner) B.echelonner(a);
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
        el('p', "Cette application a besoin de l'accès aux dossiers locaux (File System Access API). Ouvrez cette page dans Chrome ou Edge sur ordinateur.", { class: 'accueil-texte' }),
      ]);
      return;
    }
    accueil([
      el('h2', 'Bienvenue', { 'data-aide': 'accueil-intro' }),
      el('p', 'Pour commencer un nouveau budget, choisissez un dossier vide : les fichiers y seront créés pour vous. Vous pouvez aussi choisir un dossier de données existant. Les fichiers sont lus et enregistrés directement, rien ne quitte votre ordinateur. Une sauvegarde exportée depuis un autre ordinateur peut aussi être importée.', { class: 'accueil-texte' }),
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
    const ouvrir = el('button', 'Choisir un dossier', { type: 'button', class: 'btn', 'aria-label': 'Choisir un dossier : vide pour un nouveau budget, ou un dossier de données existant', 'data-aide': 'accueil-ouvrir' });
    ouvrir.addEventListener('click', ouvrirDossier);
    const importer = el('button', 'Importer une sauvegarde', { type: 'button', class: 'btn btn-secondaire', 'aria-label': 'Importer une sauvegarde', 'data-aide': 'accueil-importer' });
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
      // Un clic sur l'onglet déjà actif ne fait rien : l'entrée en cascade ne se rejoue pas.
      b.addEventListener('click', function () { if (t.id !== actif) activer(t.id); });
      nav.appendChild(b);
      const p = el('section', '', { id: 'panneau-' + t.id, role: 'tabpanel', 'aria-labelledby': 'tab-' + t.id, hidden: '' });
      // Fin de l'entrée d'un bloc : on retire sa classe, qui ne sert qu'à l'animation.
      p.addEventListener('animationend', function (ev) {
        if (ev.animationName === 'entree' && ev.target.classList) ev.target.classList.remove('entree');
      });
      panneaux.appendChild(p);
    });
    nav.hidden = tabs.length < 2;
    if (!nav.$fondus) {
      nav.$fondus = true;
      nav.addEventListener('scroll', fondusOnglets, { passive: true });
      // Au clavier, l'onglet qui prend le focus se dévoile (instantané : le focus ne doit pas attendre une animation).
      nav.addEventListener('focusin', function (ev) { if (ev.target.scrollIntoView) ev.target.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'auto' }); });
      root.addEventListener('resize', fondusOnglets);
    }
    root.requestAnimationFrame(fondusOnglets);
    panneaux.hidden = false;
    if (tabs.length) activer(actif && tabs.some(function (t) { return t.id === actif; }) ? actif : tabs[0].id);
  }

  // Écran étroit : les onglets défilent ; un bord s'estompe tant qu'il reste des onglets à découvrir de ce côté.
  function fondusOnglets() {
    const nav = $('onglets');
    const reste = nav.scrollWidth - nav.clientWidth > 1;
    nav.classList.toggle('fondu-gauche', reste && nav.scrollLeft > 6);
    nav.classList.toggle('fondu-droite', reste && nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 6);
  }

  function activer(id) {
    actif = id;
    tabs.forEach(function (t) {
      $('tab-' + t.id).setAttribute('aria-selected', String(t.id === id));
      $('panneau-' + t.id).hidden = t.id !== id;
    });
    dessiner();
    entrer($('panneau-' + id));
    // Onglets défilants (écran étroit) : l'onglet choisi reste visible ; instantané si les animations sont réduites.
    $('tab-' + id).scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: B.animationsReduites && B.animationsReduites() ? 'auto' : 'smooth' });
  }

  // Entrée de l'onglet : fondu court du panneau, blocs en cascade. Seulement à l'activation : les
  // redessins après une saisie ou un changement de thème ne rejouent rien.
  function entrer(panneau) {
    if (!panneau || !B.echelonner) return;
    panneau.classList.remove('panneau-entree');
    void panneau.offsetWidth;
    panneau.classList.add('panneau-entree');
    B.echelonner(panneau);
  }

  // Seul l'onglet visible est dessiné (Chart.js mesure mal un canvas masqué) ; les autres le sont à l'activation.
  function dessiner() {
    const t = tabs.find(function (x) { return x.id === actif; });
    if (!t) return;
    const panneau = $('panneau-' + t.id);
    try {
      t.render(panneau);
      marquerAide(panneau);
      if (B.impression) B.impression.siImpression(panneau);
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
      donnees: async function () { await B.saveDonnees(state.dir, state.donnees, state.orphelins); state.migres.donnees = false; },
      evenements: async function () { await B.saveEvenements(state.dir, state.evenements, state.prets); state.migres.evenements = false; },
      prets: async function () { await B.saveEvenements(state.dir, state.evenements, state.prets); state.migres.evenements = false; },
      parametres: async function () {
        // Les revenus d'un ancien fichier ont reçu l'inflation d'alors à l'ouverture : on les écrit avant d'enregistrer un autre taux,
        // sinon la prochaine ouverture leur appliquerait la nouvelle inflation.
        if (state.migres.donnees) { await B.saveDonnees(state.dir, state.donnees, state.orphelins); state.migres.donnees = false; }
        if (state.migres.evenements) { await B.saveEvenements(state.dir, state.evenements, state.prets); state.migres.evenements = false; }
        await B.saveParametres(state.dir, state.parametres);
      },
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

  // Crée les fichiers manquants ; en cas d'échec, le bandeau d'erreur nomme le fichier et dit ce qui existe déjà.
  async function creerFichiers(dir, options) {
    try {
      await B.creerBudgetVide(dir, options);
      erreur('');
      return true;
    } catch (e) {
      erreur(e && e.message ? e.message : String(e));
      return false;
    }
  }

  // Dossier sans budget mais non vide (ou illisible), ou budget incomplet : rien n'est écrit sans accord.
  function ecranCreation(dir, etat, decision) {
    const completer = decision === 'completer';
    const noms = completer ? [B.FICHIERS.donnees] : B.FICHIERS_A_CREER;
    const liste = el('ul', '', { class: 'accueil-liste' });
    noms.forEach(function (n) { liste.appendChild(el('li')).appendChild(el('code', n)); });
    let intro;
    let note;
    if (completer) {
      intro = 'Ce dossier contient déjà des fichiers de budget (' + etat.fichiersBudget.join(', ') + '), mais pas ' + B.FICHIERS.donnees + ', qui porte la situation et les lignes du budget. Seul ce fichier peut être créé, vide :';
      note = 'Les fichiers existants ne seront pas modifiés.';
    } else {
      intro = 'Ce dossier ne contient pas encore de budget. Ces fichiers vont y être créés, vides :';
      note = etat.autres === null
        ? 'Le contenu de ce dossier n’a pas pu être listé : aucun fichier existant ne sera remplacé.'
        : (etat.autres.length > 1 ? 'Les ' + etat.autres.length + ' autres éléments de ce dossier ne seront pas touchés.' : 'L’autre élément de ce dossier ne sera pas touché.');
    }
    const creer = el('button', 'Créer le budget ici', { type: 'button', class: 'btn', 'aria-label': completer ? 'Créer ici le fichier manquant ' + B.FICHIERS.donnees : 'Créer un nouveau budget dans ce dossier' });
    const autre = el('button', 'Choisir un autre dossier', { type: 'button', class: 'btn btn-secondaire' });
    const ligne = el('div', '', { class: 'actions-accueil' });
    ligne.appendChild(creer);
    ligne.appendChild(autre);
    creer.addEventListener('click', async function () {
      creer.disabled = true;
      autre.disabled = true;
      const ok = await creerFichiers(dir, completer ? { seulement: [B.FICHIERS.donnees] } : undefined);
      if (ok) { await ouvrirBudget(dir); return; }
      creer.disabled = false;
      autre.disabled = false;
    });
    autre.addEventListener('click', function () { erreur(''); ecranAccueil(); });
    accueil([
      el('h2', completer ? 'Il manque ' + B.FICHIERS.donnees : 'Créer un nouveau budget dans ce dossier ?', { 'data-aide': 'accueil-intro' }),
      el('p', intro, { class: 'accueil-texte' }),
      liste,
      el('p', note, { class: 'accueil-texte' }),
      ligne,
    ]);
    creer.focus();
  }

  // Point d'entrée après le choix d'un dossier : ouvrir, créer (dossier vide) ou demander confirmation.
  async function start(dir) {
    erreur('');
    avertir([]);
    let etat;
    let decision;
    try {
      etat = await B.etatDossier(dir);
      decision = B.decisionOuverture(etat);
    } catch (e) {
      erreur(e && e.message ? e.message : String(e));
      return;
    }
    if (decision === 'creer') {
      if (!(await creerFichiers(dir))) return;
    } else if (decision !== 'ouvrir') {
      ecranCreation(dir, etat, decision);
      return;
    }
    await ouvrirBudget(dir);
  }

  async function ouvrirBudget(dir) {
    erreur('');
    avertir([]);
    let r;
    try {
      r = await B.loadAll(dir);
    } catch (e) {
      erreur(e.message);
      return; // jamais d'écriture en cas d'erreur
    }
    if (r.donnees === null) {
      // Le fichier existe mais est vide : on ne l'écrase jamais.
      erreur(B.FICHIERS.donnees + ' est vide : ajoutez-y la situation et les lignes du budget, ou choisissez un autre dossier.');
      ecranAccueil();
      return;
    }
    state.dir = dir;
    state.donnees = r.donnees;
    state.evenements = r.evenements;
    state.prets = r.prets;
    state.parametres = r.parametres;
    state.orphelins = r.orphelins || [];
    state.migres = r.migres || { donnees: false, evenements: false };
    state.avertissements = r.avertissements || [];
    avertir(state.avertissements);
    if (B.paliersUI) B.paliersUI.reset();
    $('accueil').hidden = true;
    state.mois = B.project(state.donnees, B.lignesFutures(state.evenements, state.prets), state.parametres);
    construireOnglets();
  }

  Object.assign(B, { state: state, refresh: refresh, persist: persist, boutonOeil: boutonOeil, boutonIcone: boutonIcone, champMois: champMois, tableauBilan: tableauBilan, registerTab: registerTab, ongletActif: function () { return actif; }, start: start, erreur: erreur, attendreEcritures: attendreEcritures, importerFichier: importerFichier });
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ecranAccueil);
    else ecranAccueil();
  }
})(this);
