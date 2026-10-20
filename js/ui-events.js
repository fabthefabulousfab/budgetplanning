(function (root) {
  'use strict';

  const B = root.Budget;
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmt = function (v) { return eur.format(Math.round(v) + 0); }; // + 0 : évite « -0 € »
  const TYPES = [['depense', 'Dépense'], ['revenu', 'Revenu']];
  const NOM_TYPE = { depense: 'Dépenses', revenu: 'Revenus' };
  const AIDE = [
    'Syntaxe du montant :',
    '800 = 800 € par mois entre début et fin',
    '3-300 = 300 € chaque mars',
    '6-500, 10-500 = plusieurs fois par an',
    '2026-3-300 = 300 € en mars 2026 seulement',
    'Le mois va de 1 à 12 ; ne pas mélanger échéances avec et sans année.',
    'Un prêt contracté à la main = un revenu ponctuel (ex. 2027-9-20000) + une dépense mensuelle avec début et fin.',
  ].join('\n');

  // État conservé hors du DOM : les onglets sont redessinés à chaque activation.
  const erreurs = new Map(); // événement (objet) -> message
  let brouillon = { type: 'depense' };
  let erreurAjout = '';

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

  function aide() {
    const w = el('span', '', { class: 'aide' });
    w.appendChild(el('button', '?', { type: 'button', class: 'aide-btn', 'aria-label': 'Aide sur la saisie du montant', 'aria-describedby': 'aide-evenements', title: AIDE }));
    w.appendChild(el('span', AIDE, { id: 'aide-evenements', role: 'tooltip', class: 'bulle' }));
    return w;
  }

  function valeur(ev, champ) {
    if (champ === 'echeances') return String(ev.echeances != null ? ev.echeances : (ev.montant != null ? ev.montant : ''));
    return ev[champ] == null ? '' : String(ev[champ]);
  }

  // Applique une saisie à une COPIE de l'événement.
  function appliquer(ev, champ, v) {
    const c = Object.assign({}, ev);
    const t = typeof v === 'string' ? v.trim() : v;
    if (champ === 'debut' || champ === 'fin') c[champ] = t === '' ? null : t;
    else if (champ === 'actif') { if (t === false) c.actif = false; else delete c.actif; }
    else if (champ === 'echeances') { c.echeances = t; delete c.montant; }
    else c[champ] = t;
    return c;
  }

  // ---- Modification, suppression, ajout ---------------------------------------------------

  async function modifier(ligne, champ, v) {
    const liste = B.state.evenements;
    const idx = liste.indexOf(ligne); // par identité, jamais par index mémorisé
    if (idx < 0) return;
    const copie = appliquer(ligne, champ, v);
    if (JSON.stringify(copie) === JSON.stringify(ligne)) {
      if (erreurs.delete(ligne)) B.refresh();
      return;
    }
    try {
      B.validerLigne(copie, 'evenement');
    } catch (e) {
      erreurs.set(ligne, e.message);
      B.refresh();
      return;
    }
    erreurs.delete(ligne);
    liste[idx] = copie;
    B.refresh();
    try {
      await B.persist('evenements');
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
    const liste = B.state.evenements;
    const idx = liste.indexOf(ligne);
    if (idx < 0) return;
    if (!root.confirm('Supprimer l’événement « ' + ligne.libelle + ' » ?')) return;
    erreurs.delete(ligne);
    liste.splice(idx, 1);
    B.refresh();
    try {
      await B.persist('evenements');
    } catch (e) {
      liste.splice(Math.min(idx, liste.length), 0, ligne);
      B.refresh();
    }
  }

  async function ajouter(ligne, copieBrouillon) {
    const liste = B.state.evenements;
    try {
      B.validerLigne(ligne, 'evenement');
    } catch (e) {
      erreurAjout = e.message; // le brouillon est conservé
      B.refresh();
      return;
    }
    erreurAjout = '';
    liste.push(ligne);
    brouillon = { type: copieBrouillon.type };
    B.refresh();
    try {
      await B.persist('evenements');
    } catch (e) {
      const j = liste.indexOf(ligne);
      if (j >= 0) liste.splice(j, 1);
      brouillon = copieBrouillon; // l'utilisateur ne perd pas sa saisie
      erreurAjout = e.message;
      B.refresh();
    }
  }

  // ---- Cellules ---------------------------------------------------------------------------

  function champTexte(ligne, champ, label, extra) {
    const i = el('input', '', Object.assign({
      type: 'text', 'aria-label': label + ' — ' + ligne.libelle, 'data-cle': ligne.id + ':' + champ,
    }, extra || {}));
    i.value = valeur(ligne, champ);
    i.addEventListener('change', function () { modifier(ligne, champ, i.value); });
    return i;
  }

  function champSelect(ligne, champ, label, options) {
    const s = el('select', '', { 'aria-label': label + ' — ' + ligne.libelle, 'data-cle': ligne.id + ':' + champ });
    options.forEach(function (o) {
      const op = el('option', o[1], { value: o[0] });
      if (ligne[champ] === o[0]) op.selected = true;
      s.appendChild(op);
    });
    s.addEventListener('change', function () { modifier(ligne, champ, s.value); });
    return s;
  }

  function categories(courante) {
    const l = B.CATEGORIES_EVENEMENT.map(function (c) { return [c, c]; });
    if (courante && B.CATEGORIES_EVENEMENT.indexOf(courante) < 0) l.push([courante, courante]);
    return l;
  }

  // ---- Rendu ------------------------------------------------------------------------------

  function liste(panneau) {
    const evs = B.state.evenements;
    const c = carte('Événements enregistrés', 'Modifiables sur place ; chaque changement est enregistré dans evenements-futurs.yaml.');
    const cols = ['Libellé', 'Type', 'Catégorie', 'Montant / échéances', 'Début', 'Fin', 'Actions'];
    const t = el('table', '', { class: 'edition' });
    const tr0 = el('tr');
    cols.forEach(function (h) { tr0.appendChild(el('th', h, { scope: 'col' })); });
    const th = el('thead');
    th.appendChild(tr0);
    t.appendChild(th);
    const tb = el('tbody');
    evs.forEach(function (l) {
      const tr = el('tr', '', { class: (erreurs.has(l) ? 'invalide ' : '') + (l.actif === false ? 'masque' : '') });
      tr.appendChild(td(champTexte(l, 'libelle', 'Libellé')));
      tr.appendChild(td(champSelect(l, 'type', 'Type', TYPES)));
      tr.appendChild(td(champSelect(l, 'categorie', 'Catégorie', categories(l.categorie))));
      tr.appendChild(td(champTexte(l, 'echeances', 'Montant', { placeholder: '800 ou 3-300' })));
      tr.appendChild(td(champTexte(l, 'debut', 'Début', { placeholder: 'AAAA-MM' })));
      tr.appendChild(td(champTexte(l, 'fin', 'Fin', { placeholder: 'AAAA-MM' })));
      const b = el('button', 'Supprimer', { type: 'button', class: 'btn-lien', 'aria-label': 'Supprimer l’événement ' + l.libelle, 'data-cle': l.id + ':suppr' });
      b.addEventListener('click', function () { supprimer(l); });
      const act = el('span', '', { class: 'actions' });
      act.appendChild(B.boutonOeil(l.actif !== false, l.libelle, function () { modifier(l, 'actif', l.actif === false); }, l.id + ':actif'));
      act.appendChild(b);
      tr.appendChild(td(act));
      tb.appendChild(tr);
      if (erreurs.has(l)) {
        const e = el('tr', '', { class: 'ligne-erreur' });
        e.appendChild(el('td', erreurs.get(l), { colspan: String(cols.length), role: 'alert' }));
        tb.appendChild(e);
      }
    });
    if (!evs.length) {
      const tr = el('tr');
      tr.appendChild(el('td', 'Aucun événement.', { colspan: String(cols.length), class: 'vide' }));
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    const defil = el('div', '', { class: 'defil' });
    defil.appendChild(t);
    c.appendChild(defil);
    panneau.appendChild(c);
  }

  // Impact bilan des événements (hors prêts) sur les 10 prochaines années, montants de départ.
  function bilan(panneau) {
    const b = B.bilanLignes(B.state.evenements, B.state.parametres, 120);
    const c = carte('Impact bilan sur les 10 prochaines années', 'Revenus − dépenses des événements ci-dessous, montants de départ (hors revalorisation, hors prêts).');
    const w = el('div', '', { class: 'totaux' });
    [['Revenus', b.revenus], ['Dépenses', -b.depenses], ['Impact bilan (revenus − dépenses)', b.net]].forEach(function (it) {
      const d = el('div', '', { class: 'total' });
      d.appendChild(el('span', it[0], { class: 'total-lib' }));
      d.appendChild(el('strong', fmt(it[1]), { class: it[1] < 0 ? 'neg' : '' }));
      w.appendChild(d);
    });
    c.appendChild(w);
    panneau.appendChild(c);
  }

  function synthese(panneau) {
    const c = carte('Synthèse par type, catégorie et année', 'Montants de départ (hors revalorisation), sur l’horizon de projection.');
    const groupes = B.syntheseEvenements(B.state.evenements, B.state.parametres);
    if (!groupes.length) {
      c.appendChild(el('p', 'Aucun événement dans l’horizon de projection.', { class: 'vide' }));
      panneau.appendChild(c);
      return;
    }
    const annees = Array.from(new Set([].concat.apply([], groupes.map(function (g) { return Object.keys(g.par_annee); })))).sort();
    const t = el('table', '', { class: 'synthese' });
    const tr0 = el('tr');
    tr0.appendChild(el('th', 'Type', { scope: 'col' }));
    tr0.appendChild(el('th', 'Catégorie', { scope: 'col' }));
    annees.forEach(function (a) { tr0.appendChild(el('th', a, { scope: 'col', class: 'num' })); });
    tr0.appendChild(el('th', 'Total', { scope: 'col', class: 'num' }));
    const th = el('thead');
    th.appendChild(tr0);
    t.appendChild(th);
    const tb = el('tbody');
    ['revenu', 'depense'].forEach(function (type) {
      groupes.filter(function (g) { return g.type === type; })
        .sort(function (a, b) { return a.categorie < b.categorie ? -1 : 1; })
        .forEach(function (g) {
          const tr = el('tr');
          tr.appendChild(el('td', NOM_TYPE[type]));
          tr.appendChild(el('td', g.categorie));
          annees.forEach(function (a) {
            const v = g.par_annee[a] || 0;
            tr.appendChild(el('td', v ? fmt(v) : '—', { class: v < 0 ? 'num neg' : 'num' }));
          });
          tr.appendChild(el('td', fmt(g.total), { class: g.total < 0 ? 'num neg' : 'num' }));
          tb.appendChild(tr);
        });
    });
    t.appendChild(tb);
    const defil = el('div', '', { class: 'defil' });
    defil.appendChild(t);
    c.appendChild(defil);
    panneau.appendChild(c);
  }

  function champAjout(cle, label, attrs) {
    const i = el('input', '', Object.assign({ type: 'text', 'aria-label': label, placeholder: label, 'data-cle': 'ajout:' + cle }, attrs || {}));
    i.value = brouillon[cle] || '';
    i.addEventListener('input', function () { brouillon[cle] = i.value; });
    return i;
  }

  function formulaire(panneau) {
    const c = carte('Ajouter un événement', 'Études, achat d’une voiture, prime, prêt… Le type est à choisir explicitement.');
    const tete = el('div', '', { class: 'aide-ligne' });
    tete.appendChild(el('span', 'Syntaxe du montant'));
    tete.appendChild(aide());
    c.appendChild(tete);

    const f = el('form', '', { class: 'ajout', 'aria-label': 'Ajouter un événement' });
    const selType = el('select', '', { 'aria-label': 'Type : revenu ou dépense', 'data-cle': 'ajout:type' });
    TYPES.forEach(function (t) {
      const o = el('option', t[1], { value: t[0] });
      if ((brouillon.type || 'depense') === t[0]) o.selected = true;
      selType.appendChild(o);
    });
    selType.addEventListener('change', function () { brouillon.type = selType.value; });
    f.appendChild(selType);

    const selCat = el('select', '', { 'aria-label': 'Catégorie', 'data-cle': 'ajout:categorie' });
    B.CATEGORIES_EVENEMENT.forEach(function (n) {
      const o = el('option', n, { value: n });
      if ((brouillon.categorie || B.CATEGORIES_EVENEMENT[0]) === n) o.selected = true;
      selCat.appendChild(o);
    });
    selCat.addEventListener('change', function () { brouillon.categorie = selCat.value; });
    f.appendChild(selCat);

    f.appendChild(champAjout('libelle', 'Libellé'));
    f.appendChild(champAjout('echeances', 'Montant', { placeholder: '800 ou 3-300 ou 2026-3-300' }));
    f.appendChild(champAjout('debut', 'Début', { placeholder: 'Début AAAA-MM' }));
    f.appendChild(champAjout('fin', 'Fin', { placeholder: 'Fin AAAA-MM' }));
    f.appendChild(el('button', 'Ajouter l’événement', { type: 'submit', class: 'btn' }));
    if (erreurAjout) f.appendChild(el('p', erreurAjout, { class: 'erreur-ligne', role: 'alert' }));

    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const copie = Object.assign({}, brouillon, { type: brouillon.type || 'depense', categorie: brouillon.categorie || B.CATEGORIES_EVENEMENT[0] });
      const ligne = {
        id: root.crypto.randomUUID(),
        type: copie.type,
        categorie: copie.categorie,
        libelle: (copie.libelle || '').trim(),
        echeances: (copie.echeances || '').trim(),
        debut: (copie.debut || '').trim() || null,
        fin: (copie.fin || '').trim() || null,
      };
      ajouter(ligne, copie);
    });
    c.appendChild(f);
    panneau.appendChild(c);
  }

  function render(panneau) {
    const actif = document.activeElement;
    const cle = actif && panneau.contains(actif) && actif.getAttribute ? actif.getAttribute('data-cle') : null;
    panneau.textContent = '';
    if (!B.state.donnees) return;
    bilan(panneau);
    formulaire(panneau);
    liste(panneau);
    synthese(panneau);
    if (cle) {
      const cible = Array.from(panneau.querySelectorAll('[data-cle]')).find(function (n) { return n.getAttribute('data-cle') === cle; });
      if (cible) cible.focus();
    }
  }

  B.registerTab('evenements', 'Revenus et dépenses futurs', render);
})(this);
