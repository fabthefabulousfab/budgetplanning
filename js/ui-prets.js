(function (root) {
  'use strict';

  const B = root.Budget;
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

  // Champs numériques : saisie en texte, convertie à l'enregistrement (les virgules françaises sont acceptées).
  const NUMERIQUES = ['montant', 'mensualite', 'duree_mois', 'differe_mois', 'taux'];
  // classe : colonne du relevé ; mois : champ AAAA-MM (« — » au repos) ; facultatif : vide = valeur par défaut.
  const COLONNES = {
    en_cours: [
      { champ: 'libelle', label: 'Libellé', classe: 'c-lib' },
      { champ: 'mensualite', label: 'Mensualité (€)', placeholder: '300', num: true, classe: 'c-mont' },
      { champ: 'fin', label: 'Fin du remboursement', entete: 'Fin du remboursement (AAAA-MM)', placeholder: 'AAAA-MM', mois: true, classe: 'c-fin' },
    ],
    simule: [
      { champ: 'libelle', label: 'Libellé', classe: 'c-lib' },
      { champ: 'montant', label: 'Montant (€)', placeholder: '20000', num: true, classe: 'c-mont' },
      { champ: 'mise_a_disposition', label: 'Mise à disposition', entete: 'Mise à disposition (AAAA-MM)', placeholder: 'AAAA-MM', mois: true, classe: 'c-fin' },
      { champ: 'duree_mois', label: 'Durée (mois)', placeholder: '120', num: true, classe: 'c-int' },
      { champ: 'differe_mois', label: 'Différé (mois)', placeholder: '0', num: true, facultatif: true, classe: 'c-int' },
      { champ: 'taux', label: 'Taux annuel (%)', placeholder: '0', num: true, facultatif: true, classe: 'c-int c-taux' },
    ],
  };

  // État conservé hors du DOM : l'onglet est redessiné à chaque modification.
  const erreurs = new Map(); // prêt (objet) -> message
  const brouillons = { en_cours: {}, simule: {} };
  const erreursAjout = { en_cours: '', simule: '' };

  function el(tag, texte, attrs) {
    const e = document.createElement(tag);
    if (texte != null && texte !== '') e.textContent = texte;
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function carte(titre, note) {
    const c = el('div', '', { class: 'carte' });
    c.appendChild(el('h2', titre));
    if (note) c.appendChild(el('p', note, { class: 'note' }));
    return c;
  }

  function td(contenu, classe) {
    const c = el('td', '', classe ? { class: classe } : {});
    if (contenu) c.appendChild(contenu);
    return c;
  }

  function valeur(p, champ) { return p[champ] == null ? '' : String(p[champ]); }

  function convertir(champ, v) {
    const t = typeof v === 'string' ? v.trim() : v;
    if (NUMERIQUES.indexOf(champ) >= 0) return t === '' ? null : Number(String(t).replace(/\s/g, '').replace(',', '.'));
    return t;
  }

  // Applique une saisie à une COPIE du prêt.
  function appliquer(p, champ, v) {
    const c = Object.assign({}, p);
    if (champ === 'actif') {
      if (v === false) c.actif = false; else delete c.actif;
    } else if ((champ === 'differe_mois' || champ === 'taux') && String(v).trim() === '') {
      delete c[champ]; // facultatifs : vide = absent
    } else {
      c[champ] = convertir(champ, v);
    }
    return c;
  }

  // ---- Modification, suppression, ajout ---------------------------------------------------

  async function modifier(ligne, champ, v) {
    const liste = B.state.prets;
    const idx = liste.indexOf(ligne); // par identité, jamais par index mémorisé
    if (idx < 0) return;
    const copie = appliquer(ligne, champ, v);
    if (JSON.stringify(copie) === JSON.stringify(ligne)) {
      if (erreurs.delete(ligne)) B.refresh();
      return;
    }
    try {
      B.validerPret(copie);
    } catch (e) {
      erreurs.set(ligne, e.message);
      B.refresh();
      return;
    }
    erreurs.delete(ligne);
    liste[idx] = copie;
    B.refresh();
    try {
      await B.persist('prets');
    } catch (e) {
      const j = liste.indexOf(copie);
      if (j >= 0) {
        liste[j] = ligne;
        erreurs.set(ligne, e.message);
      }
      B.refresh();
    }
  }

  async function supprimer(ligne) {
    const liste = B.state.prets;
    const idx = liste.indexOf(ligne);
    if (idx < 0) return;
    if (!root.confirm('Supprimer le prêt « ' + ligne.libelle + ' » ?')) return;
    erreurs.delete(ligne);
    liste.splice(idx, 1);
    B.refresh();
    try {
      await B.persist('prets');
    } catch (e) {
      liste.splice(Math.min(idx, liste.length), 0, ligne);
      B.refresh();
    }
  }

  async function ajouter(statut, ligne, copieBrouillon) {
    const liste = B.state.prets;
    try {
      B.validerPret(ligne);
    } catch (e) {
      erreursAjout[statut] = e.message; // le brouillon est conservé
      B.refresh();
      return;
    }
    erreursAjout[statut] = '';
    liste.push(ligne);
    brouillons[statut] = {};
    B.refresh();
    try {
      await B.persist('prets');
    } catch (e) {
      const j = liste.indexOf(ligne);
      if (j >= 0) liste.splice(j, 1);
      brouillons[statut] = copieBrouillon; // l'utilisateur ne perd pas sa saisie
      erreursAjout[statut] = e.message;
      B.refresh();
    }
  }

  // ---- Rendu ------------------------------------------------------------------------------

  function champTexte(ligne, col) {
    const i = el('input', '', {
      type: 'text', 'aria-label': col.label + ' — ' + ligne.libelle, 'data-cle': ligne.id + ':' + col.champ,
    });
    if (col.champ === 'libelle') i.setAttribute('title', ligne.libelle);
    if (col.num) { i.setAttribute('inputmode', 'decimal'); i.className = 'num'; }
    i.value = valeur(ligne, col.champ);
    i.addEventListener('change', function () { modifier(ligne, col.champ, i.value); });
    if (col.mois) return B.champMois(i); // « — » quand vide, AAAA-MM au focus
    if (col.facultatif) { i.setAttribute('placeholder', '—'); i.setAttribute('title', 'Facultatif : vide = 0'); }
    return i;
  }

  function tableau(statut, prets, calculs) {
    const R = B.releve;
    const cols = COLONNES[statut];
    const entetes = cols.map(function (c) { return { t: c.entete || c.label, num: !!c.num, classe: c.classe }; })
      .concat(calculs.map(function (c) { return { t: c.label, num: !!c.num, classe: c.classe }; }), [{ t: 'Actions', classe: 'c-act', cache: true }]);
    const t = el('table', '', { class: 'edition releve ' + (statut === 'simule' ? 't-simules' : 't-encours') });
    t.appendChild(R.entetes(entetes));
    const tb = el('tbody');
    prets.forEach(function (p) {
      const tr = el('tr', '', { class: 'ligne' + (erreurs.has(p) ? ' invalide' : '') + (p.actif === false ? ' masque' : '') });
      cols.forEach(function (c) { tr.appendChild(td(champTexte(p, c), (c.num ? 'num ' : '') + c.classe)); });
      calculs.forEach(function (c) {
        const v = c.valeur(p);
        tr.appendChild(td(v === '—' ? R.tiret('Non calculable : prêt incomplet') : el('span', v), (c.num ? 'num ' : '') + c.classe));
      });
      const act = el('span', '', { class: 'actions' });
      act.appendChild(B.boutonOeil(p.actif !== false, p.libelle, function () { modifier(p, 'actif', p.actif === false); }, p.id + ':actif'));
      act.appendChild(B.boutonIcone('corbeille', 'Supprimer le prêt ' + p.libelle, 'Supprimer le prêt (après confirmation)', p.id + ':suppr', function () { supprimer(p); }));
      tr.appendChild(td(act, 'c-act'));
      tb.appendChild(tr);
      const e = R.ligneMessage(erreurs.get(p), entetes.length);
      if (e) tb.appendChild(e);
    });
    if (!prets.length) {
      tb.appendChild(statut === 'simule'
        ? R.releveVide('Aucun prêt à simuler pour l’instant.', 'Indiquez un montant, une date et une durée avec le formulaire ci-dessus pour voir la mensualité, les dates de remboursement et le coût des intérêts.', entetes.length)
        : R.releveVide('Aucun prêt en cours pour l’instant.', 'Ajoutez un crédit déjà souscrit avec le formulaire ci-dessus : sa mensualité sera comptée jusqu’à sa date de fin.', entetes.length));
    }
    t.appendChild(tb);
    const defil = el('div', '', { class: 'defil' });
    defil.appendChild(t);
    return defil;
  }

  function formulaire(statut) {
    const f = el('form', '', { class: 'ajout', 'aria-label': statut === 'simule' ? 'Ajouter un prêt à simuler' : 'Ajouter un prêt en cours' });
    COLONNES[statut].forEach(function (col) {
      const i = el('input', '', { type: 'text', 'aria-label': col.label, 'data-cle': 'ajout:' + statut + ':' + col.champ });
      if (col.placeholder) i.setAttribute('placeholder', col.placeholder);
      if (col.num) i.setAttribute('inputmode', 'decimal');
      i.value = brouillons[statut][col.champ] || '';
      i.addEventListener('input', function () { brouillons[statut][col.champ] = i.value; });
      f.appendChild(B.releve.champEtiquete(col.label, i, col.champ === 'libelle' ? 'champ-large' : 'champ-court', col.facultatif ? 'facultatif' : ''));
    });
    f.appendChild(el('button', statut === 'simule' ? 'Ajouter le prêt simulé' : 'Ajouter le prêt en cours', { type: 'submit', class: 'btn' }));
    if (erreursAjout[statut]) f.appendChild(el('p', erreursAjout[statut], { class: 'erreur-ligne', role: 'alert' }));
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const copie = Object.assign({}, brouillons[statut]);
      let ligne = { id: root.crypto.randomUUID(), statut: statut, libelle: (copie.libelle || '').trim() };
      COLONNES[statut].forEach(function (col) {
        if (col.champ === 'libelle') return;
        const brut = (copie[col.champ] || '').trim();
        if (brut === '' && (col.champ === 'differe_mois' || col.champ === 'taux')) return; // facultatifs
        ligne[col.champ] = convertir(col.champ, brut);
      });
      ajouter(statut, ligne, copie);
    });
    return f;
  }

  function resume(p) {
    if (p.statut !== 'simule') return null;
    try { B.validerPret(p); } catch (e) { return null; }
    return B.echeancier(p);
  }

  function rendu(panneau) {
    const prets = B.state.prets;
    const enCours = prets.filter(function (p) { return p.statut === 'en_cours'; });
    const simules = prets.filter(function (p) { return p.statut === 'simule'; });

    const c1 = carte('Prêts en cours', 'Prêts déjà souscrits : seulement la mensualité et la date de fin. Retirez la ligne équivalente de l’onglet Mensuel pour ne pas la compter deux fois.');
    c1.setAttribute('data-aide', 'prets-encours');
    c1.appendChild(formulaire('en_cours'));
    c1.appendChild(tableau('en_cours', enCours, []));
    panneau.appendChild(c1);

    const c2 = carte('Prêts à simuler', 'Le montant est versé le mois de mise à disposition ; les mensualités commencent le mois suivant, décalées du différé (prêt étudiant). Sans taux, mensualité = montant ÷ durée ; avec un taux, annuité constante (intérêts non capitalisés pendant le différé).');
    c2.setAttribute('data-aide', 'prets-simules');
    const formSimule = formulaire('simule');
    formSimule.setAttribute('data-aide', 'prets-simules-ajout');
    c2.appendChild(formSimule);
    const tableSimule = tableau('simule', simules, [
      { label: 'Mensualité', num: true, classe: 'c-calc', valeur: function (p) { const e = resume(p); return e ? eur.format(e.mensualite) : '—'; } },
      { label: 'Remboursement', classe: 'c-rbt', valeur: function (p) { const e = resume(p); return e ? e.debut + ' → ' + e.fin : '—'; } },
      { label: 'Coût des intérêts', num: true, classe: 'c-calc', valeur: function (p) { const e = resume(p); return e ? eur.format(e.total - p.montant) : '—'; } },
    ]);
    tableSimule.setAttribute('data-aide', 'prets-simules-tableau');
    c2.appendChild(tableSimule);
    panneau.appendChild(c2);
  }

  function render(panneau) {
    const actif = document.activeElement;
    const cle = actif && panneau.contains(actif) && actif.getAttribute ? actif.getAttribute('data-cle') : null;
    panneau.textContent = '';
    if (!B.state.donnees) return;
    rendu(panneau);
    if (cle) {
      const cible = Array.from(panneau.querySelectorAll('[data-cle]')).find(function (n) { return n.getAttribute('data-cle') === cle; });
      if (cible) cible.focus();
    }
  }

  B.registerTab('prets', 'Prêts', render);
})(this);
