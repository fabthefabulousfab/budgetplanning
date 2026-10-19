(function (root) {
  'use strict';

  const B = root.Budget;
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmt = function (v) { return eur.format(Math.round(v)); };
  const AVERTISSEMENT = 'Les modifications des lignes importées sont perdues au prochain import Excel — reportez-les dans budget.xlsx';
  const AIDE = [
    'Syntaxe des échéances (séparées par des virgules) :',
    '800 : 800 € chaque mois',
    '3-300 : 300 € chaque année en mars',
    '6-500, 10-500 : 500 € en juin et en octobre, chaque année',
    '2026-3-300 : 300 € une seule fois, en mars 2026',
    'Le mois va de 1 à 12 ; ne pas mélanger échéances avec et sans année.',
  ].join('\n');
  const TYPES = [['depense', 'Dépense'], ['revenu', 'Revenu']];

  // État d'édition conservé hors du DOM (les onglets sont redessinés à chaque activation).
  const erreurs = new Map(); // "nature:index" -> message
  const brouillons = { mensuel: {}, annuel: {} };
  const erreursAjout = {};

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

  function avertissement() { return el('p', AVERTISSEMENT, { class: 'avertissement', role: 'note' }); }

  function signe(v) { return fmt(v); }

  function totaux(items) {
    const w = el('div', '', { class: 'totaux' });
    items.forEach(function (it) {
      const d = el('div', '', { class: 'total' });
      d.appendChild(el('span', it.t, { class: 'total-lib' }));
      d.appendChild(el('strong', signe(it.v), { class: it.v < 0 ? 'neg' : '' }));
      w.appendChild(d);
    });
    return w;
  }

  // ---- Modification, suppression, ajout --------------------------------------------------

  async function modifier(nature, index, champ, valeur) {
    const liste = B.state.donnees[nature];
    const ancienne = liste[index];
    const cle = nature + ':' + index;
    const copie = B.appliquerEdition(ancienne, champ, valeur, nature);
    if (JSON.stringify(copie) === JSON.stringify(ancienne)) { // rien de changé (NaN -> null en JSON : on laisse valider)
      if (!(champ === 'montant' && Number.isNaN(copie.montant))) return;
    }
    try {
      B.validerLigne(copie, nature);
    } catch (e) {
      erreurs.set(cle, e.message);
      B.refresh(); // la cellule revient à la valeur enregistrée
      return;
    }
    erreurs.delete(cle);
    liste[index] = copie;
    try {
      await B.persist('donnees');
    } catch (e) {
      if (liste[index] === copie) liste[index] = ancienne;
      erreurs.set(cle, e.message);
      B.refresh();
    }
  }

  async function supprimer(nature, index) {
    const liste = B.state.donnees[nature];
    const ligne = liste[index];
    if (!root.confirm('Supprimer la ligne « ' + ligne.libelle + ' » ?')) return;
    erreurs.clear();
    liste.splice(index, 1);
    try {
      await B.persist('donnees');
    } catch (e) {
      liste.splice(index, 0, ligne);
      B.refresh();
    }
  }

  async function ajouter(nature, ligne) {
    const liste = B.state.donnees[nature];
    try {
      B.validerLigne(ligne, nature);
    } catch (e) {
      erreursAjout[nature] = e.message;
      B.refresh();
      return;
    }
    delete erreursAjout[nature];
    erreurs.clear();
    liste.push(ligne);
    try {
      await B.persist('donnees');
      brouillons[nature === 'mensuel' ? 'mensuel' : 'annuel'] = {};
      B.refresh();
    } catch (e) {
      liste.pop();
      erreursAjout[nature] = e.message;
      B.refresh();
    }
  }

  // ---- Cellules ---------------------------------------------------------------------------

  function champTexte(nature, index, ligne, champ, label, extra) {
    const i = el('input', '', Object.assign({
      type: 'text', 'aria-label': label + ' — ' + ligne.libelle, 'data-cle': nature + ':' + index + ':' + champ,
    }, extra || {}));
    i.value = B.valeurCellule(ligne, champ);
    i.addEventListener('change', function () { modifier(nature, index, champ, i.value); });
    return i;
  }

  function champSelect(nature, index, ligne, champ, label, options) {
    const s = el('select', '', { 'aria-label': label + ' — ' + ligne.libelle, 'data-cle': nature + ':' + index + ':' + champ });
    options.forEach(function (o) {
      const op = el('option', o[1], { value: o[0] });
      if (ligne[champ] === o[0]) op.selected = true;
      s.appendChild(op);
    });
    s.addEventListener('change', function () { modifier(nature, index, champ, s.value); });
    return s;
  }

  function champCase(nature, index, ligne) {
    const c = el('input', '', { type: 'checkbox', 'aria-label': 'Revalorisé — ' + ligne.libelle, 'data-cle': nature + ':' + index + ':revalorise' });
    c.checked = ligne.revalorise === true;
    c.addEventListener('change', function () { modifier(nature, index, 'revalorise', c.checked); });
    return c;
  }

  function boutonSupprimer(nature, index, ligne) {
    const b = el('button', 'Supprimer', { type: 'button', class: 'btn-lien', 'aria-label': 'Supprimer la ligne ' + ligne.libelle, 'data-cle': nature + ':' + index + ':suppr' });
    b.addEventListener('click', function () { supprimer(nature, index); });
    return b;
  }

  function td(contenu, classe) {
    const c = el('td', '', classe ? { class: classe } : {});
    if (contenu) c.appendChild(contenu);
    return c;
  }

  function entetes(cols) {
    const tr = el('tr');
    cols.forEach(function (h) { tr.appendChild(el('th', h.t, h.num ? { class: 'num', scope: 'col' } : { scope: 'col' })); });
    const th = el('thead');
    th.appendChild(tr);
    return th;
  }

  function ligneErreur(nature, index, nbCols) {
    const msg = erreurs.get(nature + ':' + index);
    if (!msg) return null;
    const tr = el('tr', '', { class: 'ligne-erreur' });
    tr.appendChild(el('td', msg, { colspan: String(nbCols), role: 'alert' }));
    return tr;
  }

  // ---- Formulaire d'ajout -----------------------------------------------------------------

  function champAjout(brouillon, cle, label, attrs) {
    const i = el('input', '', Object.assign({ type: 'text', 'aria-label': label, placeholder: label, 'data-cle': 'ajout:' + cle }, attrs || {}));
    i.value = brouillon[cle] || '';
    i.addEventListener('input', function () { brouillon[cle] = i.value; });
    return i;
  }

  function formulaireAjout(nature, brouillon, categories, natures) {
    const f = el('form', '', { class: 'ajout', 'aria-label': 'Ajouter une ligne' });
    const dlId = 'categories-' + nature;
    const dl = el('datalist', '', { id: dlId });
    categories.forEach(function (c) { dl.appendChild(el('option', '', { value: c })); });
    f.appendChild(dl);

    let selNature = null;
    if (natures) {
      selNature = el('select', '', { 'aria-label': 'Nature de la nouvelle ligne', 'data-cle': 'ajout:nature' });
      natures.forEach(function (n) {
        const o = el('option', n[1], { value: n[0] });
        if ((brouillon.nature || natures[0][0]) === n[0]) o.selected = true;
        selNature.appendChild(o);
      });
      selNature.addEventListener('change', function () { brouillon.nature = selNature.value; });
      f.appendChild(selNature);
    }
    const selType = el('select', '', { 'aria-label': 'Type de la nouvelle ligne', 'data-cle': 'ajout:type' });
    TYPES.forEach(function (t) {
      const o = el('option', t[1], { value: t[0] });
      if ((brouillon.type || 'depense') === t[0]) o.selected = true;
      selType.appendChild(o);
    });
    selType.addEventListener('change', function () { brouillon.type = selType.value; });
    f.appendChild(selType);
    f.appendChild(champAjout(brouillon, 'categorie', 'Catégorie', { list: dlId }));
    f.appendChild(champAjout(brouillon, 'libelle', 'Libellé'));
    const champ = nature === 'mensuel' ? 'montant' : 'echeances';
    f.appendChild(champAjout(brouillon, champ, nature === 'mensuel' ? 'Montant mensuel' : 'Échéances'));
    f.appendChild(el('button', 'Ajouter une ligne', { type: 'submit', class: 'btn' }));
    if (erreursAjout[nature]) f.appendChild(el('p', erreursAjout[nature], { class: 'erreur-ligne', role: 'alert' }));

    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const nat = nature === 'mensuel' ? 'mensuel' : (brouillon.nature || 'annuel');
      const base = { type: brouillon.type || 'depense', categorie: (brouillon.categorie || '').trim(), libelle: (brouillon.libelle || '').trim() };
      let ligne;
      if (nat === 'mensuel') {
        ligne = Object.assign(base, { montant: B.appliquerEdition({}, 'montant', brouillon.montant, 'mensuel').montant, revalorise: false, fin: null });
      } else if (nat === 'annuel') {
        ligne = Object.assign(base, { echeances: (brouillon.echeances || '').trim(), revalorise: false, debut: null, fin: null });
      } else {
        ligne = Object.assign(base, { echeances: (brouillon.echeances || '').trim() });
      }
      ajouter(nat, ligne);
    });
    return f;
  }

  function categoriesDe(listes) {
    const s = new Set();
    listes.forEach(function (l) { (l || []).forEach(function (x) { if (x.categorie) s.add(x.categorie); }); });
    return Array.from(s);
  }

  // ---- Onglet Mensuel ---------------------------------------------------------------------

  function renderMensuel(panneau) {
    const d = B.state.donnees;
    const lignes = d.mensuel || (d.mensuel = []);
    panneau.appendChild(avertissement());

    const somme = function (type) {
      return lignes.filter(function (l) { return l.type === type; }).reduce(function (a, l) { return a + Number(l.montant); }, 0);
    };
    const c = carte('Mensuel', 'Montants de départ (hors revalorisation), par catégorie.');
    c.appendChild(totaux([
      { t: 'Total revenus', v: somme('revenu') },
      { t: 'Total dépenses', v: -somme('depense') },
      { t: 'Restant mensuel (montants de départ)', v: B.restantMensuel(d) },
    ]));

    const cols = [{ t: 'Libellé' }, { t: 'Type' }, { t: 'Montant (€/mois)', num: true }, { t: 'Revalorisé' }, { t: 'Fin (AAAA-MM)' }, { t: 'Actions' }];
    const t = el('table', '', { class: 'edition' });
    t.appendChild(entetes(cols));
    const tb = el('tbody');
    B.grouperParCategorie(lignes).forEach(function (g) {
      const th = el('tr', '', { class: 'groupe' });
      th.appendChild(el('th', g.categorie, { colspan: String(cols.length), scope: 'colgroup' }));
      tb.appendChild(th);
      g.items.forEach(function (it) {
        const l = it.ligne;
        const tr = el('tr', '', erreurs.has('mensuel:' + it.index) ? { class: 'invalide' } : {});
        tr.appendChild(td(champTexte('mensuel', it.index, l, 'libelle', 'Libellé')));
        tr.appendChild(td(champSelect('mensuel', it.index, l, 'type', 'Type', TYPES)));
        tr.appendChild(td(champTexte('mensuel', it.index, l, 'montant', 'Montant mensuel', { inputmode: 'decimal', class: 'num' }), 'num'));
        tr.appendChild(td(champCase('mensuel', it.index, l)));
        tr.appendChild(td(champTexte('mensuel', it.index, l, 'fin', 'Fin', { placeholder: 'AAAA-MM' })));
        tr.appendChild(td(boutonSupprimer('mensuel', it.index, l)));
        tb.appendChild(tr);
        const e = ligneErreur('mensuel', it.index, cols.length);
        if (e) tb.appendChild(e);
      });
    });
    t.appendChild(tb);
    const defil = el('div', '', { class: 'defil' });
    defil.appendChild(t);
    c.appendChild(defil);
    panneau.appendChild(c);

    const a = carte('Ajouter une ligne mensuelle');
    a.appendChild(formulaireAjout('mensuel', brouillons.mensuel, categoriesDe([lignes])));
    panneau.appendChild(a);
  }

  // ---- Onglet Annuel & exceptionnel -------------------------------------------------------

  function aide() {
    const w = el('span', '', { class: 'aide' });
    w.appendChild(el('button', '?', { type: 'button', class: 'aide-btn', 'aria-label': 'Aide sur la syntaxe des échéances', 'aria-describedby': 'aide-echeances', title: AIDE }));
    w.appendChild(el('span', AIDE, { id: 'aide-echeances', role: 'tooltip', class: 'bulle' }));
    return w;
  }

  function tableAnnuel(panneauCarte, nature, lignes, impacts) {
    const cols = [{ t: 'Libellé' }, { t: 'Catégorie' }, { t: 'Type' }, { t: 'Échéances' }, { t: 'Début' }, { t: 'Fin' }, { t: 'Revalorisé' }, { t: 'Impact mensuel', num: true }, { t: 'Actions' }];
    const t = el('table', '', { class: 'edition' });
    t.appendChild(entetes(cols));
    const tb = el('tbody');
    lignes.forEach(function (l, i) {
      const tr = el('tr', '', erreurs.has(nature + ':' + i) ? { class: 'invalide' } : {});
      tr.appendChild(td(champTexte(nature, i, l, 'libelle', 'Libellé')));
      tr.appendChild(td(champTexte(nature, i, l, 'categorie', 'Catégorie')));
      tr.appendChild(td(champSelect(nature, i, l, 'type', 'Type', TYPES)));
      tr.appendChild(td(champTexte(nature, i, l, 'echeances', 'Échéances', { placeholder: '6-500, 10-500' })));
      tr.appendChild(td(champTexte(nature, i, l, 'debut', 'Début', { placeholder: 'AAAA-MM' })));
      tr.appendChild(td(champTexte(nature, i, l, 'fin', 'Fin', { placeholder: 'AAAA-MM' })));
      tr.appendChild(td(champCase(nature, i, l)));
      const imp = impacts[i] ? impacts[i].impact_mensuel : 0;
      tr.appendChild(td(el('span', signe(imp), { class: imp < 0 ? 'neg' : '' }), 'num'));
      tr.appendChild(td(boutonSupprimer(nature, i, l)));
      tb.appendChild(tr);
      const e = ligneErreur(nature, i, cols.length);
      if (e) tb.appendChild(e);
    });
    if (!lignes.length) {
      const tr = el('tr');
      tr.appendChild(el('td', 'Aucune ligne.', { colspan: String(cols.length), class: 'vide' }));
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    const defil = el('div', '', { class: 'defil' });
    defil.appendChild(t);
    panneauCarte.appendChild(defil);
  }

  function renderAnnuel(panneau) {
    const d = B.state.donnees;
    const annuel = d.annuel || (d.annuel = []);
    const exc = d.exceptionnel || (d.exceptionnel = []);
    const params = B.state.parametres;
    panneau.appendChild(avertissement());

    const iA = B.impactMensuel(annuel, params);
    const iE = B.impactMensuel(exc, params);
    const total = iA.concat(iE).reduce(function (a, x) { return a + x.impact_mensuel; }, 0);

    const resume = carte('Annuel & exceptionnel', 'Impact mensuel = total des douze premiers mois projetés ÷ 12, calculé sur les montants de départ (hors revalorisation).');
    const tete = el('div', '', { class: 'aide-ligne' });
    tete.appendChild(el('span', 'Syntaxe des échéances'));
    tete.appendChild(aide());
    resume.appendChild(tete);
    resume.appendChild(totaux([
      { t: 'Impact mensuel total', v: total },
      { t: 'Restant moyen mensuel (montants de départ)', v: B.restantMoyen(d, params) },
    ]));
    panneau.appendChild(resume);

    const ca = carte('Annuel');
    tableAnnuel(ca, 'annuel', annuel, iA);
    panneau.appendChild(ca);
    const ce = carte('Exceptionnel');
    tableAnnuel(ce, 'exceptionnel', exc, iE);
    panneau.appendChild(ce);

    const a = carte('Ajouter une ligne');
    a.appendChild(formulaireAjout('annuel', brouillons.annuel, categoriesDe([annuel, exc, d.mensuel]), [['annuel', 'Annuel'], ['exceptionnel', 'Exceptionnel']]));
    panneau.appendChild(a);
  }

  // Redessin complet, avec restitution du focus (les écritures redessinent l'onglet actif).
  function enveloppe(rendu) {
    return function (panneau) {
      const actif = document.activeElement;
      const cle = actif && panneau.contains(actif) && actif.getAttribute ? actif.getAttribute('data-cle') : null;
      panneau.textContent = '';
      if (!B.state.donnees) return;
      rendu(panneau);
      if (cle) {
        const cible = Array.from(panneau.querySelectorAll('[data-cle]')).find(function (n) { return n.getAttribute('data-cle') === cle; });
        if (cible) cible.focus();
      }
    };
  }

  B.registerTab('mensuel', 'Mensuel', enveloppe(renderMensuel));
  B.registerTab('annuel', 'Annuel & exceptionnel', enveloppe(renderAnnuel));
})(this);
