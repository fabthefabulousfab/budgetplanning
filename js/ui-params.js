(function (root) {
  'use strict';

  const B = root.Budget;

  // État conservé hors du DOM : les onglets sont redessinés à chaque activation.
  const brouillons = {}; // champ -> texte saisi (tant qu'il n'est pas accepté)
  const erreurs = {};    // champ -> message

  const CHAMPS = [
    { cle: 'depart', label: 'Départ (AAAA-MM)', aide: 'Premier mois de la projection.', placeholder: 'AAAA-MM' },
    { cle: 'horizon', label: 'Horizon (années, de 10 à 15)', aide: 'Durée de la projection.', type: 'number', min: '10', max: '15', step: '1' },
    { cle: 'taux', label: 'Inflation (dépenses) : taux annuel (%)', aide: 'Appliqué aux dépenses cochées « Revalorisé ». Les revenus ont chacun leur taux dans leur ligne.', type: 'text', placeholder: '2' },
    { cle: 'mois', label: 'Revalorisation : mois (de 1 à 12)', aide: 'Mois de l’année où les revalorisations (inflation des dépenses, taux des revenus) s’appliquent (1 = janvier).', type: 'number', min: '1', max: '12', step: '1' },
    { cle: 'solde_compte_courant', label: 'Solde de départ : compte courant (€)', aide: 'Vide = montant de la situation enregistrée (0 pour un nouveau budget). Un nombre le remplace (négatif accepté).', type: 'text', solde: 'compte_courant' },
    { cle: 'solde_epargne', label: 'Solde de départ : épargne (€)', aide: 'Vide = montant de la situation enregistrée (0 pour un nouveau budget). Un nombre le remplace.', type: 'text', solde: 'epargne' },
  ];

  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

  function el(tag, texte, attrs) {
    const e = document.createElement(tag);
    if (texte != null && texte !== '') e.textContent = texte;
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function lire(cle, p) {
    if (cle.indexOf('solde_') === 0) {
      const v = p.solde_depart[cle.slice(6)];
      return v == null ? '' : String(v);
    }
    if (cle === 'depart') return p.depart;
    if (cle === 'horizon') return String(p.horizon_annees);
    if (cle === 'taux') return String(Math.round(p.revalorisation.taux * 100000) / 1000);
    return String(p.revalorisation.mois);
  }

  function entier(texte) {
    return /^\d+$/.test(texte) ? Number(texte) : NaN;
  }

  // Construit une COPIE des paramètres avec la saisie ; lève Error si invalide.
  function appliquer(cle, texte) {
    const t = String(texte).trim();
    const p = state().parametres;
    const c = { depart: p.depart, horizon_annees: p.horizon_annees, revalorisation: { taux: p.revalorisation.taux, mois: p.revalorisation.mois }, solde_depart: { compte_courant: p.solde_depart.compte_courant, epargne: p.solde_depart.epargne } };
    if (p.categories) c.categories = p.categories; // jamais modifiées ici : les fonctions de categories.js renvoient des copies
    if (cle.indexOf('solde_') === 0) {
      const k = cle.slice(6);
      if (t === '') {
        c.solde_depart[k] = null;
      } else {
        const n = /^-?\d+([.,]\d+)?$/.test(t.replace(/[\s  ]/g, '')) ? Number(t.replace(/[\s  ]/g, '').replace(',', '.')) : NaN;
        if (!Number.isFinite(n)) throw new Error('Le solde de départ doit être un nombre (par exemple 1250 ou -300,50), ou vide pour reprendre la situation enregistrée.');
        c.solde_depart[k] = n;
      }
    } else if (cle === 'depart') {
      const m = /^(\d{4})-(\d{2})$/.exec(t);
      if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new Error('Départ invalide : « ' + t + ' » (attendu AAAA-MM, mois de 01 à 12).');
      c.depart = t;
    } else if (cle === 'horizon') {
      const n = entier(t);
      if (!Number.isInteger(n) || n < 10 || n > 15) throw new Error('L’horizon doit être un entier entre 10 et 15 ans.');
      c.horizon_annees = n;
    } else if (cle === 'taux') {
      const n = /^-?\d+([.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : NaN;
      if (!Number.isFinite(n) || n < -100 || n > 100) throw new Error('Le taux doit être un nombre en pourcent (par exemple 2 ou 1,5).');
      c.revalorisation.taux = Math.round(n * 1000) / 100000;
    } else {
      const n = entier(t);
      if (!Number.isInteger(n) || n < 1 || n > 12) throw new Error('Le mois de revalorisation doit être un entier entre 1 et 12.');
      c.revalorisation.mois = n;
    }
    return c;
  }

  function state() { return B.state; }

  async function modifier(cle, texte) {
    const avant = state().parametres;
    let copie;
    try {
      copie = appliquer(cle, texte);
    } catch (e) {
      brouillons[cle] = texte;
      erreurs[cle] = e.message;
      B.refresh();
      return;
    }
    delete erreurs[cle];
    if (JSON.stringify(copie) === JSON.stringify(avant)) {
      delete brouillons[cle];
      B.refresh();
      return;
    }
    delete brouillons[cle];
    state().parametres = copie;
    B.refresh();
    try {
      await B.persist('parametres');
    } catch (e) {
      if (state().parametres === copie) state().parametres = avant;
      brouillons[cle] = texte;
      erreurs[cle] = e.message;
      B.refresh();
    }
  }

  let noteExport = ''; // conservée hors du DOM : l'onglet est redessiné à chaque rafraîchissement

  // Téléchargement via Blob + lien temporaire : fonctionne dans tous les navigateurs.
  function telecharger(texte, nomFichier) {
    const url = URL.createObjectURL(new Blob([texte], { type: 'text/yaml;charset=utf-8' }));
    const a = el('a', '', { href: url, download: nomFichier });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  async function exporter() {
    try {
      await B.attendreEcritures(); // l'export reflète ce qui est enregistré, sans mélange ancien/nouveau
      const r = await B.exporterSauvegarde(state().dir, { nom: state().dir && state().dir.name });
      telecharger(r.texte, r.nomFichier);
      B.erreur('');
      noteExport = 'Sauvegarde exportée : ' + r.nomFichier;
    } catch (e) {
      noteExport = '';
      B.erreur(e && e.message ? e.message : String(e));
    }
    B.refresh();
  }

  function carteSauvegarde() {
    const c = el('div', '', { class: 'carte export-import' });
    c.appendChild(el('h2', 'Sauvegarde'));
    c.appendChild(el('p', 'Un seul fichier YAML contient vos données, événements, paramètres et paliers (pas l’historique CSV, regénéré à l’enregistrement). Importer ne remplace jamais un fichier sans confirmation.', { class: 'note' }));
    const ligne = el('div', '', { class: 'actions-accueil' });
    const exp = el('button', 'Exporter la sauvegarde', { type: 'button', class: 'btn', 'aria-label': 'Exporter la sauvegarde' });
    exp.setAttribute('data-aide', 'param-export');
    exp.addEventListener('click', exporter);
    const zone = el('div', '', { class: 'zone-import' });
    const imp = el('button', 'Importer une sauvegarde', { type: 'button', class: 'btn btn-secondaire', 'aria-label': 'Importer une sauvegarde' });
    imp.setAttribute('data-aide', 'param-import');
    imp.addEventListener('click', function () { noteExport = ''; B.importerFichier(zone); });
    ligne.appendChild(exp);
    ligne.appendChild(imp);
    c.appendChild(ligne);
    if (state().demo) {
      // Démo en mémoire : aucune sauvegarde à exporter, aucun dossier réel où importer.
      exp.disabled = true;
      imp.disabled = true;
      c.appendChild(el('p', 'Désactivé en mode démo : ces données fictives ne sont enregistrées nulle part. Quittez la démo pour ouvrir un vrai dossier, puis exporter ou importer une sauvegarde.', { class: 'note', 'data-note-demo': '1' }));
    }
    if (noteExport) c.appendChild(el('p', noteExport, { class: 'note note-export', role: 'status', 'data-note-export': '1' }));
    c.appendChild(zone);
    return c;
  }

  // ---- Catégories -------------------------------------------------------------------------
  // État hors du DOM (l'onglet est redessiné à chaque rafraîchissement) : ligne en renommage, ligne en suppression, messages.
  const cat = { renomme: null, brouillon: '', supprime: null, vers: '', erreurs: {}, ajout: {}, erreursAjout: {}, focus: null };
  const TYPES_CAT = [['depense', 'Dépenses'], ['revenu', 'Revenus']];
  const NATURES_CAT = ['mensuel', 'annuel', 'exceptionnel'];
  const cleCat = function (type, nom) { return type + ':' + nom; };
  const memeLigneCat = function (e, type, nom) { return !!e && e.type === type && e.nom === nom; };

  function reinitialiserCat() { cat.renomme = null; cat.supprime = null; cat.vers = ''; cat.brouillon = ''; }
  if (B.surReinitialisation) B.surReinitialisation(function () {
    [brouillons, erreurs, cat.erreurs, cat.ajout, cat.erreursAjout].forEach(function (o) { Object.keys(o).forEach(function (k) { delete o[k]; }); });
    reinitialiserCat();
    cat.focus = null;
    noteExport = '';
  });

  // Les lignes remplacées par une copie gardent leur état d'interface (case « Palier » ouverte).
  function suivreLignes(avant, apres) {
    NATURES_CAT.forEach(function (n) {
      ((avant && avant[n]) || []).forEach(function (l, i) {
        const l2 = apres && apres[n] && apres[n][i];
        if (l2 && l2 !== l && B.paliersUI) B.paliersUI.remplacer(l, l2);
      });
    });
  }

  // Applique (donnees, params) en mémoire puis écrit d'abord donnees, ensuite parametres : un échec entre les deux ne masque rien
  // (une catégorie utilisée reste toujours visible). Échec sur donnees : tout est annulé ; échec sur parametres : seule la liste revient en arrière.
  async function appliquerCategories(cle, resultat, ecrireDonnees) {
    const d0 = state().donnees;
    const p0 = state().parametres;
    delete cat.erreurs[cle];
    state().donnees = resultat.donnees;
    state().parametres = resultat.params;
    suivreLignes(d0, resultat.donnees);
    reinitialiserCat();
    B.refresh();
    try {
      if (ecrireDonnees) await B.persist('donnees');
    } catch (e) {
      if (state().donnees === resultat.donnees) { state().donnees = d0; suivreLignes(resultat.donnees, d0); }
      if (state().parametres === resultat.params) state().parametres = p0;
      cat.erreurs[cle] = e.message;
      B.refresh();
      return;
    }
    if (JSON.stringify(resultat.params) === JSON.stringify(p0)) return;
    try {
      await B.persist('parametres');
    } catch (e) {
      if (state().parametres === resultat.params) state().parametres = p0;
      cat.erreurs[cle] = e.message;
      B.refresh();
    }
  }

  function aDesLignesDeplacees(avant, apres) {
    return NATURES_CAT.some(function (n) {
      return ((avant && avant[n]) || []).some(function (l, i) { return apres[n][i] !== l; });
    });
  }

  async function renommerCat(type, ancien, nouveau, depuisClavier) {
    const cle = cleCat(type, ancien);
    let r;
    try {
      r = B.renommerCategorie(state().donnees, state().parametres, type, ancien, nouveau);
    } catch (e) {
      cat.renomme = { type: type, nom: ancien };
      cat.brouillon = nouveau;
      cat.erreurs[cle] = e.message;
      if (depuisClavier) cat.focus = 'cat:' + cle + ':champ';
      B.refresh();
      return;
    }
    if (B.nomCategorieValide(nouveau) === ancien) { delete cat.erreurs[cle]; reinitialiserCat(); cat.focus = 'cat:' + cle + ':renommer'; B.refresh(); return; }
    cat.focus = 'cat:' + cleCat(type, B.nomCategorieValide(nouveau)) + ':renommer';
    await appliquerCategories(cle, r, aDesLignesDeplacees(state().donnees, r.donnees));
  }

  async function supprimerCat(type, nom, vers) {
    const cle = cleCat(type, nom);
    let r;
    try {
      r = B.supprimerCategorie(state().donnees, state().parametres, type, nom, vers);
    } catch (e) {
      cat.supprime = { type: type, nom: nom };
      cat.erreurs[cle] = e.message;
      B.refresh();
      return;
    }
    cat.focus = 'cat:ajout:' + type;
    await appliquerCategories(cle, r, aDesLignesDeplacees(state().donnees, r.donnees));
  }

  async function ajouterCat(type, texte) {
    const t = B.nomCategorieValide(texte);
    if (t === '') { delete cat.ajout[type]; if (cat.erreursAjout[type]) { delete cat.erreursAjout[type]; B.refresh(); } return; }
    const avant = state().parametres;
    let p;
    try {
      p = B.ajouterCategorie(avant, type, t, state().donnees);
    } catch (e) {
      cat.ajout[type] = texte;
      cat.erreursAjout[type] = e.message;
      B.refresh();
      return;
    }
    delete cat.erreursAjout[type];
    delete cat.ajout[type];
    cat.focus = 'cat:ajout:' + type;
    state().parametres = p;
    B.refresh();
    try {
      await B.persist('parametres');
    } catch (e) {
      if (state().parametres === p) state().parametres = avant;
      cat.ajout[type] = texte;
      cat.erreursAjout[type] = e.message;
      B.refresh();
    }
  }

  function texteUsages(n) { return n === 0 ? 'aucune ligne' : n === 1 ? '1 ligne' : n + ' lignes'; }

  // Champ de renommage en place : Entrée valide, Échap annule, la perte du focus valide.
  function champRenommage(type, nom) {
    const cle = cleCat(type, nom);
    const i = el('input', '', { type: 'text', class: 'categorie-champ', 'aria-label': 'Nouveau nom de la catégorie ' + nom, 'data-cle': 'cat:' + cle + ':champ', maxlength: '200' });
    if (cat.erreurs[cle]) { i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', 'cat-err-' + type + '-' + encodeURIComponent(nom)); }
    i.value = cat.brouillon !== '' ? cat.brouillon : nom;
    let clos = false;
    i.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); if (clos) return; clos = true; renommerCat(type, nom, i.value, true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); clos = true; delete cat.erreurs[cle]; reinitialiserCat(); cat.focus = 'cat:' + cle + ':renommer'; B.refresh(); }
    });
    i.addEventListener('blur', function () { if (clos) return; clos = true; renommerCat(type, nom, i.value, false); });
    return i;
  }

  function choixDestination(type, nom, n, autres) {
    const cle = cleCat(type, nom);
    const w = el('div', '', { class: 'categorie-deplacer' });
    if (autres.length === 0) {
      w.appendChild(el('p', 'Cette catégorie est la seule de sa liste et ' + texteUsages(n) + ' l’utilise : ajoutez d’abord une autre catégorie pour y déplacer ces lignes.', { class: 'note' }));
      const a = el('button', 'Annuler', { type: 'button', class: 'btn-lien', 'data-cle': 'cat:' + cle + ':annuler', 'aria-label': 'Annuler la suppression de la catégorie ' + nom });
      a.addEventListener('click', function () { reinitialiserCat(); delete cat.erreurs[cle]; cat.focus = 'cat:' + cle + ':supprimer'; B.refresh(); });
      w.appendChild(a);
      return w;
    }
    const idSel = 'cat-vers-' + type + '-' + encodeURIComponent(nom);
    w.appendChild(el('label', 'Déplacer ses ' + n + (n > 1 ? ' lignes' : ' ligne') + ' vers…', { for: idSel, class: 'categorie-deplacer-lib' }));
    const s = el('select', '', { id: idSel, 'aria-label': 'Catégorie de destination pour les lignes de ' + nom, 'aria-required': 'true', 'data-cle': 'cat:' + cle + ':vers' });
    s.appendChild(el('option', 'Choisir une catégorie', { value: '' }));
    autres.forEach(function (x) {
      const o = el('option', x, { value: x });
      if (cat.vers === x) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener('change', function () { cat.vers = s.value; });
    w.appendChild(s);
    const ok = el('button', 'Valider', { type: 'button', class: 'btn btn-petit', 'data-cle': 'cat:' + cle + ':valider', 'aria-label': 'Valider la suppression de la catégorie ' + nom });
    ok.addEventListener('click', function () { supprimerCat(type, nom, s.value); });
    const non = el('button', 'Annuler', { type: 'button', class: 'btn-lien', 'data-cle': 'cat:' + cle + ':annuler', 'aria-label': 'Annuler la suppression de la catégorie ' + nom });
    non.addEventListener('click', function () { reinitialiserCat(); delete cat.erreurs[cle]; cat.focus = 'cat:' + cle + ':supprimer'; B.refresh(); });
    w.appendChild(ok);
    w.appendChild(non);
    return w;
  }

  function ligneCategorie(type, nom) {
    const cle = cleCat(type, nom);
    const n = B.compterUsages(state().donnees, type, nom);
    const enRenommage = memeLigneCat(cat.renomme, type, nom);
    const enSuppression = memeLigneCat(cat.supprime, type, nom);
    const li = el('li', '', { class: 'categorie' + (cat.erreurs[cle] ? ' invalide' : '') });
    if (enRenommage) {
      li.appendChild(champRenommage(type, nom));
    } else {
      li.appendChild(el('span', nom, { class: 'categorie-nom' }));
      li.appendChild(el('span', texteUsages(n), { class: 'categorie-usages' }));
      const act = el('span', '', { class: 'categorie-actions' });
      act.appendChild(B.boutonIcone('crayon', 'Renommer la catégorie ' + nom, 'Renommer la catégorie', 'cat:' + cle + ':renommer', function () {
        reinitialiserCat();
        cat.renomme = { type: type, nom: nom };
        cat.focus = 'cat:' + cle + ':champ';
        delete cat.erreurs[cle];
        B.refresh();
      }));
      act.appendChild(B.boutonIcone('corbeille', 'Supprimer la catégorie ' + nom, n > 0 ? 'Supprimer la catégorie (ses lignes seront déplacées)' : 'Supprimer la catégorie', 'cat:' + cle + ':supprimer', function () {
        reinitialiserCat();
        delete cat.erreurs[cle];
        if (n === 0) { supprimerCat(type, nom, ''); return; }
        cat.supprime = { type: type, nom: nom };
        cat.focus = 'cat:' + cle + ':vers';
        B.refresh();
      }));
      li.appendChild(act);
    }
    if (enSuppression) {
      const autres = B.categoriesDisponibles(state().donnees, state().parametres, type).filter(function (x) { return x !== nom; });
      li.appendChild(choixDestination(type, nom, n, autres));
    }
    if (cat.erreurs[cle]) li.appendChild(el('p', cat.erreurs[cle], { id: 'cat-err-' + type + '-' + encodeURIComponent(nom), class: 'erreur-ligne', role: 'alert' }));
    return li;
  }

  function colonneCategories(type, titre) {
    const col = el('div', '', { class: 'categories-colonne' });
    col.appendChild(el('h4', titre, { class: 'categories-titre' }));
    const noms = B.categoriesDisponibles(state().donnees, state().parametres, type);
    const ul = el('ul', '', { class: 'categories-liste', 'aria-label': 'Catégories : ' + titre.toLowerCase() });
    noms.forEach(function (nom) { ul.appendChild(ligneCategorie(type, nom)); });
    if (noms.length) col.appendChild(ul);
    else col.appendChild(el('p', 'Aucune catégorie : ajoutez-en une ci-dessous.', { class: 'note' }));
    const f = el('div', '', { class: 'categorie-ajout' });
    const i = el('input', '', { type: 'text', 'aria-label': 'Ajouter une catégorie de ' + (type === 'depense' ? 'dépense' : 'revenu'), placeholder: '+ Ajouter une catégorie', 'data-cle': 'cat:ajout:' + type, maxlength: '200' });
    i.value = cat.ajout[type] || '';
    if (cat.erreursAjout[type]) { i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', 'cat-err-ajout-' + type); }
    i.addEventListener('input', function () { cat.ajout[type] = i.value; });
    i.addEventListener('change', function () { ajouterCat(type, i.value); });
    f.appendChild(i);
    if (cat.erreursAjout[type]) f.appendChild(el('p', cat.erreursAjout[type], { id: 'cat-err-ajout-' + type, class: 'erreur-ligne', role: 'alert' }));
    col.appendChild(f);
    return col;
  }

  function sectionCategories() {
    if (cat.dir !== state().dir) { cat.dir = state().dir; reinitialiserCat(); cat.erreurs = {}; cat.ajout = {}; cat.erreursAjout = {}; } // autre dossier ouvert : plus rien d'en cours
    const grille = el('div', '', { class: 'categories' });
    TYPES_CAT.forEach(function (t) { grille.appendChild(colonneCategories(t[0], t[1])); });
    const s = section('Catégories', [
      el('p', 'Les listes proposées dans les onglets Mensuel et Annuel. Renommer ou supprimer une catégorie met aussi à jour les lignes qui l’utilisent.', { class: 'note' }),
      grille,
    ]);
    s.setAttribute('data-aide', 'param-categories');
    return s;
  }

  // Section à filet : titre à empattement à gauche, champs alignés à droite.
  function section(titre, contenu) {
    const s = el('section', '', { class: 'param-section' });
    s.appendChild(el('h3', titre, { class: 'param-titre' }));
    const d = el('div', '', { class: 'param-corps' });
    contenu.forEach(function (n) { d.appendChild(n); });
    s.appendChild(d);
    return s;
  }

  function render(panneau) {
    const actif = document.activeElement;
    const cleActive = actif && panneau.contains(actif) && actif.getAttribute ? actif.getAttribute('data-cle') : null;
    panneau.textContent = '';
    if (!state().donnees || !state().parametres) return;

    const c = el('div', '', { class: 'carte' });
    c.setAttribute('data-aide', 'parametres-carte');
    c.appendChild(el('h2', 'Paramètres de la projection'));
    c.appendChild(el('p', 'Chaque changement valide est enregistré dans parametres.yaml.', { class: 'note' }));

    const f = el('form', '', { class: 'param-form', 'aria-label': 'Paramètres de la projection' });
    f.addEventListener('submit', function (ev) { ev.preventDefault(); });
    // Revalorisation (taux + mois) et soldes de départ (compte courant + épargne) forment deux groupes ciblés par la visite guidée.
    const groupePeriode = el('div', '', { class: 'groupe-param' });
    groupePeriode.setAttribute('data-aide', 'param-periode'); // mois de départ et horizon : une seule étape de visite
    const groupeReval = el('div', '', { class: 'groupe-param' });
    groupeReval.setAttribute('data-aide', 'param-revalorisation');
    const groupeSolde = el('div', '', { class: 'groupe-param' });
    groupeSolde.setAttribute('data-aide', 'param-solde');
    CHAMPS.forEach(function (ch) {
      const bloc = el('div', '', { class: 'champ-param' });
      const id = 'param-' + ch.cle;
      bloc.appendChild(el('label', ch.label, { for: id }));
      const attrs = { id: id, type: ch.type || 'text', 'aria-label': ch.label, 'data-cle': ch.cle, 'aria-describedby': id + '-aide' };
      ['min', 'max', 'step', 'placeholder'].forEach(function (k) { if (ch[k]) attrs[k] = ch[k]; });
      if (ch.solde) {
        attrs.inputmode = 'decimal';
        const sit = state().donnees.situation;
        const x = sit ? sit[ch.solde] : null;
        if (typeof x === 'number' && Number.isFinite(x)) attrs.placeholder = 'Situation : ' + eur.format(x);
      }
      if (erreurs[ch.cle]) { attrs['aria-invalid'] = 'true'; attrs['aria-describedby'] = id + '-aide ' + id + '-err'; }
      const i = el('input', '', attrs);
      i.value = brouillons[ch.cle] !== undefined ? brouillons[ch.cle] : lire(ch.cle, state().parametres);
      i.addEventListener('change', function () { modifier(ch.cle, i.value); });
      bloc.appendChild(i);
      const aideChamp = el('div', '', { class: 'champ-aide' });
      aideChamp.appendChild(el('small', ch.aide, { id: id + '-aide', class: 'note' }));
      if (erreurs[ch.cle]) aideChamp.appendChild(el('p', erreurs[ch.cle], { id: id + '-err', class: 'erreur-ligne', role: 'alert' }));
      bloc.appendChild(aideChamp);
      if (ch.cle === 'taux' || ch.cle === 'mois') groupeReval.appendChild(bloc);
      else if (ch.solde) groupeSolde.appendChild(bloc);
      else groupePeriode.appendChild(bloc);
    });
    f.appendChild(section('Période', [groupePeriode]));
    f.appendChild(section('Revalorisation', [groupeReval]));

    // Total des deux soldes : grand chiffre à empattement sous les champs.
    const total = B.soldeDepart(state().donnees, state().parametres).total;
    const p = el('p', '', { class: 'solde-total', 'data-total-solde': '1' });
    const lib = el('span', 'Solde de départ', { class: 'solde-lib' });
    lib.appendChild(el('span', ' : ', { class: 'visuellement-cache' }));
    p.appendChild(lib);
    p.appendChild(el('strong', eur.format(total), { class: 'solde-val' + (total < 0 ? ' neg' : '') }));
    f.appendChild(section('Soldes de départ', [groupeSolde, p]));
    c.appendChild(f);
    c.appendChild(sectionCategories());
    panneau.appendChild(c);
    panneau.appendChild(carteSauvegarde());

    const cleCible = cat.focus || cleActive;
    cat.focus = null;
    if (cleCible) {
      const cible = Array.from(panneau.querySelectorAll('[data-cle]')).find(function (n) { return n.getAttribute('data-cle') === cleCible; });
      if (cible) { cible.focus(); if (cible.select && cible.classList.contains('categorie-champ')) cible.select(); }
    }
  }

  B.registerTab('parametres', 'Paramètres', render);
})(this);
