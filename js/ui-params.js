(function (root) {
  'use strict';

  const B = root.Budget;

  // État conservé hors du DOM : les onglets sont redessinés à chaque activation.
  const brouillons = {}; // champ -> texte saisi (tant qu'il n'est pas accepté)
  const erreurs = {};    // champ -> message

  const CHAMPS = [
    { cle: 'depart', label: 'Départ (AAAA-MM)', aide: 'Premier mois de la projection.', placeholder: 'AAAA-MM' },
    { cle: 'horizon', label: 'Horizon (années, de 10 à 15)', aide: 'Durée de la projection.', type: 'number', min: '10', max: '15', step: '1' },
    { cle: 'taux', label: 'Revalorisation : taux annuel (%)', aide: 'Appliqué aux lignes « revalorisé », par exemple 2 pour 2 %.', type: 'text', placeholder: '2' },
    { cle: 'mois', label: 'Revalorisation : mois (de 1 à 12)', aide: 'Mois de l’année où la revalorisation s’applique (1 = janvier).', type: 'number', min: '1', max: '12', step: '1' },
    { cle: 'solde_compte_courant', label: 'Solde de départ : compte courant (€)', aide: 'Vide = valeur de l’Excel. Un nombre la remplace (négatif accepté), même après un nouvel import.', type: 'text', solde: 'compte_courant' },
    { cle: 'solde_epargne', label: 'Solde de départ : épargne (€)', aide: 'Vide = valeur de l’Excel. Un nombre la remplace, même après un nouvel import.', type: 'text', solde: 'epargne' },
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
    if (cle.indexOf('solde_') === 0) {
      const k = cle.slice(6);
      if (t === '') {
        c.solde_depart[k] = null;
      } else {
        const n = /^-?\d+([.,]\d+)?$/.test(t.replace(/[\s  ]/g, '')) ? Number(t.replace(/[\s  ]/g, '').replace(',', '.')) : NaN;
        if (!Number.isFinite(n)) throw new Error('Le solde de départ doit être un nombre (par exemple 1250 ou -300,50), ou vide pour reprendre la valeur de l’Excel.');
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
    const c = el('div', '', { class: 'carte' });
    c.appendChild(el('h2', 'Sauvegarde'));
    c.appendChild(el('p', 'Un seul fichier YAML contient vos données, événements, paramètres et paliers (pas l’historique CSV, regénéré à l’enregistrement). Importer ne remplace jamais un fichier sans confirmation.', { class: 'note' }));
    const ligne = el('div', '', { class: 'actions-accueil' });
    const exp = el('button', 'Exporter la sauvegarde', { type: 'button', class: 'btn', 'aria-label': 'Exporter la sauvegarde' });
    exp.addEventListener('click', exporter);
    const zone = el('div', '', { class: 'zone-import' });
    const imp = el('button', 'Importer une sauvegarde', { type: 'button', class: 'btn', 'aria-label': 'Importer une sauvegarde' });
    imp.addEventListener('click', function () { noteExport = ''; B.importerFichier(zone); });
    ligne.appendChild(exp);
    ligne.appendChild(imp);
    c.appendChild(ligne);
    if (noteExport) c.appendChild(el('p', noteExport, { class: 'note', role: 'status', 'data-note-export': '1' }));
    c.appendChild(zone);
    return c;
  }

  function render(panneau) {
    const actif = document.activeElement;
    const cleActive = actif && panneau.contains(actif) && actif.getAttribute ? actif.getAttribute('data-cle') : null;
    panneau.textContent = '';
    if (!state().donnees || !state().parametres) return;

    const c = el('div', '', { class: 'carte' });
    c.appendChild(el('h2', 'Paramètres de la projection'));
    c.appendChild(el('p', 'Chaque changement valide est enregistré dans parametres.yaml.', { class: 'note' }));

    const f = el('form', '', { class: 'ajout', 'aria-label': 'Paramètres de la projection' });
    f.addEventListener('submit', function (ev) { ev.preventDefault(); });
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
        if (typeof x === 'number' && Number.isFinite(x)) attrs.placeholder = 'Excel : ' + eur.format(x);
      }
      if (erreurs[ch.cle]) { attrs['aria-invalid'] = 'true'; attrs['aria-describedby'] = id + '-aide ' + id + '-err'; }
      const i = el('input', '', attrs);
      i.value = brouillons[ch.cle] !== undefined ? brouillons[ch.cle] : lire(ch.cle, state().parametres);
      i.addEventListener('change', function () { modifier(ch.cle, i.value); });
      bloc.appendChild(i);
      bloc.appendChild(el('small', ch.aide, { id: id + '-aide', class: 'note' }));
      if (erreurs[ch.cle]) bloc.appendChild(el('p', erreurs[ch.cle], { id: id + '-err', class: 'erreur-ligne', role: 'alert' }));
      f.appendChild(bloc);
    });
    c.appendChild(f);
    const total = B.soldeDepart(state().donnees, state().parametres).total;
    c.appendChild(el('p', 'Solde de départ : ' + eur.format(total), { class: 'note', 'data-total-solde': '1' }));
    panneau.appendChild(c);
    panneau.appendChild(carteSauvegarde());

    if (cleActive) {
      const cible = Array.from(panneau.querySelectorAll('[data-cle]')).find(function (n) { return n.getAttribute('data-cle') === cleActive; });
      if (cible) cible.focus();
    }
  }

  B.registerTab('parametres', 'Paramètres', render);
})(this);
