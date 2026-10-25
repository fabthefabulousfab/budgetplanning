(function (root) {
  'use strict';

  const B = root.Budget;
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmt = function (v) { return eur.format(Math.round(v) + 0); }; // + 0 : évite « -0 € »
  const AIDE = [
    'Syntaxe des échéances (séparées par des virgules) :',
    '800 : 800 € chaque mois',
    '3-300 : 300 € chaque année en mars',
    '6-500, 10-500 : 500 € en juin et en octobre, chaque année',
    '2026-3-300 : 300 € une seule fois, en mars 2026',
    'Le mois va de 1 à 12 ; ne pas mélanger échéances avec et sans année.',
  ].join('\n');
  const MOIS_COURTS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const TYPES = [['depense', 'Dépense'], ['revenu', 'Revenu']];

  // État d'édition conservé hors du DOM (les onglets sont redessinés à chaque activation).
  const erreurs = new Map(); // ligne (objet) -> message
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

  async function modifier(nature, ligne, champ, valeur) {
    return commit(nature, ligne, B.appliquerEdition(ligne, champ, valeur, nature));
  }

  // Enregistre `copie` à la place de `ligne` (repérée par identité) : validation, mise à jour, écriture, retour arrière si échec.
  async function commit(nature, ligne, copie) {
    const liste = B.state.donnees[nature];
    const idx = liste.indexOf(ligne); // par identité : les index changent après suppression/ajout
    if (idx < 0) return;
    if (JSON.stringify(copie) === JSON.stringify(ligne) && !Number.isNaN(copie.montant)) {
      if (erreurs.delete(ligne)) B.refresh(); // valeur enregistrée ressaisie : l'erreur n'a plus lieu d'être
      return;
    }
    try {
      B.validerLigne(copie, nature);
    } catch (e) {
      erreurs.set(ligne, e.message);
      B.refresh(); // la cellule revient à la valeur enregistrée
      return;
    }
    erreurs.delete(ligne);
    erreurOrphelins = ''; // un enregistrement réussi périme l'ancien message de la carte des paliers orphelins
    liste[idx] = copie;
    B.paliersUI.remplacer(ligne, copie);
    B.refresh(); // les gestionnaires se relient aux nouvelles lignes avant toute écriture en attente
    try {
      await B.persist('donnees');
    } catch (e) {
      const j = liste.indexOf(copie);
      if (j >= 0) {
        liste[j] = ligne;
        B.paliersUI.remplacer(copie, ligne);
        erreurs.set(ligne, e.message);
      }
      B.refresh();
    }
  }

  async function supprimer(nature, ligne) {
    const liste = B.state.donnees[nature];
    const idx = liste.indexOf(ligne);
    if (idx < 0) return;
    if (!root.confirm('Supprimer la ligne « ' + ligne.libelle + ' » ?')) return;
    erreurs.delete(ligne);
    const etaitOuvert = B.paliersUI.estOuvert(ligne);
    B.paliersUI.oublier(ligne);
    liste.splice(idx, 1);
    B.refresh();
    try {
      await B.persist('donnees');
    } catch (e) {
      liste.splice(Math.min(idx, liste.length), 0, ligne);
      if (etaitOuvert) B.paliersUI.ouvrir(ligne);
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
    liste.push(ligne);
    const cleBrouillon = nature === 'mensuel' ? 'mensuel' : 'annuel';
    const brouillonAvant = brouillons[cleBrouillon];
    brouillons[cleBrouillon] = {};
    B.refresh();
    try {
      await B.persist('donnees');
    } catch (e) {
      const j = liste.indexOf(ligne);
      if (j >= 0) liste.splice(j, 1);
      brouillons[cleBrouillon] = brouillonAvant; // l'utilisateur ne perd pas sa saisie
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
    i.addEventListener('change', function () { modifier(nature, ligne, champ, i.value); });
    return i;
  }

  function champSelect(nature, index, ligne, champ, label, options) {
    const s = el('select', '', { 'aria-label': label + ' — ' + ligne.libelle, 'data-cle': nature + ':' + index + ':' + champ });
    options.forEach(function (o) {
      const op = el('option', o[1], { value: o[0] });
      if (ligne[champ] === o[0]) op.selected = true;
      s.appendChild(op);
    });
    s.addEventListener('change', function () { modifier(nature, ligne, champ, s.value); });
    return s;
  }

  function champCase(nature, index, ligne) {
    const c = el('input', '', { type: 'checkbox', 'aria-label': 'Revalorisé — ' + ligne.libelle, 'data-cle': nature + ':' + index + ':revalorise' });
    c.checked = ligne.revalorise === true;
    c.addEventListener('change', function () { modifier(nature, ligne, 'revalorise', c.checked); });
    return c;
  }

  function boutonOeil(nature, index, ligne) {
    return B.boutonOeil(ligne.actif !== false, ligne.libelle, function () { modifier(nature, ligne, 'actif', ligne.actif === false); }, nature + ':' + index + ':actif');
  }

  function actions(nature, index, ligne) {
    const w = el('span', '', { class: 'actions' });
    w.appendChild(B.paliersUI.caseCoche(ligne, nature + ':' + index, function (coche) {
      B.paliersUI.basculer(ligne, coche, function (copie) { return commit(nature, ligne, copie); });
    }));
    w.appendChild(boutonOeil(nature, index, ligne));
    w.appendChild(boutonSupprimer(nature, index, ligne));
    return w;
  }

  function classeLigne(ligne) {
    return (erreurs.has(ligne) ? 'invalide ' : '') + (ligne.actif === false ? 'masque' : '');
  }

  function boutonSupprimer(nature, index, ligne) {
    const b = el('button', 'Supprimer', { type: 'button', class: 'btn-lien', 'aria-label': 'Supprimer la ligne ' + ligne.libelle, 'data-cle': nature + ':' + index + ':suppr' });
    b.addEventListener('click', function () { supprimer(nature, ligne); });
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

  // Sous-lignes de paliers d'une ligne (vide si la case « Palier » n'est pas cochée).
  function sousLignes(nature, index, ligne, nbCols, col, creerFin, aide) {
    return B.paliersUI.sousLignes({
      ligne: ligne, nature: nature, cle: nature + ':' + index, nbCols: nbCols, col: col, creerFin: creerFin, aide: aide,
      onEdit: function (i, champ, valeur) { commit(nature, ligne, B.editerPalier(ligne, i, champ, valeur, nature)); },
      onAjouter: function () { commit(nature, ligne, B.ajouterPalier(ligne, nature, B.state.parametres.depart)); },
      onSupprimer: function (i) { commit(nature, ligne, B.retirerPalier(ligne, i)); },
    });
  }

  function ligneErreur(ligne, nbCols) {
    const msg = erreurs.get(ligne);
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

    // Montants en vigueur au mois de départ (paliers compris), comme le restant mensuel.
    const tot = B.totauxMensuels(d, B.state.parametres);
    // Mensualités des prêts (en cours et simulés) : moyenne sur les 12 premiers mois, montants de départ.
    const prets = B.bilanLignes(B.lignesPret(B.state.prets), B.state.parametres, 12);
    const moyennePrets = -prets.depenses / 12;
    const restant = B.restantMensuel(d, B.state.parametres);
    const c = carte('Mensuel', 'Montants de départ (hors revalorisation), par catégorie. Les prêts sont ceux de l’onglet Prêts (moyenne des mensualités des 12 premiers mois).');
    c.appendChild(totaux([
      { t: 'Total revenus', v: tot.revenus },
      { t: 'Total dépenses', v: -tot.depenses },
      { t: 'Restant mensuel (montants de départ)', v: restant },
      { t: 'Mensualités de prêts (moyenne)', v: moyennePrets },
      { t: 'Restant mensuel après prêts', v: restant + moyennePrets },
    ]));

    const cols = [{ t: 'Libellé' }, { t: 'Type' }, { t: 'Montant (€/mois)', num: true }, { t: 'Revalorisé' }, { t: 'Fin (AAAA-MM)' }, { t: 'Actions' }];
    const t = el('table', '', { class: 'edition' });
    t.appendChild(entetes(cols));
    const tb = el('tbody');
    B.grouperParCategorie(lignes).forEach(function (g) {
      const th = el('tr', '', { class: 'groupe' });
      th.appendChild(el('th', g.categorie || 'Sans catégorie', { colspan: String(cols.length), scope: 'colgroup' }));
      tb.appendChild(th);
      g.items.forEach(function (it) {
        const l = it.ligne;
        const tr = el('tr', '', { class: classeLigne(l) });
        tr.appendChild(td(champTexte('mensuel', it.index, l, 'libelle', 'Libellé')));
        tr.appendChild(td(champSelect('mensuel', it.index, l, 'type', 'Type', TYPES)));
        tr.appendChild(td(champTexte('mensuel', it.index, l, 'montant', 'Montant mensuel', { inputmode: 'decimal', class: 'num' }), 'num'));
        tr.appendChild(td(champCase('mensuel', it.index, l)));
        const creerFin = function () { return champTexte('mensuel', it.index, l, 'fin', 'Fin', { placeholder: 'AAAA-MM' }); };
        // Avec des paliers, la fin se saisit sur le dernier palier.
        tr.appendChild(td(B.proprietaireFin(l) === 'base' ? creerFin() : null));
        tr.appendChild(td(actions('mensuel', it.index, l)));
        tb.appendChild(tr);
        sousLignes('mensuel', it.index, l, cols.length, { depuis: 1, montant: 2, fin: 4, actions: 5 }, creerFin, { placeholder: 'Montant mensuel' }).forEach(function (s) { tb.appendChild(s); });
        const e = ligneErreur(l, cols.length);
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

    if (B.state.orphelins.length) panneau.appendChild(carteOrphelins());
  }

  // ---- Paliers sans ligne correspondante --------------------------------------------------

  let erreurOrphelins = '';

  function texteEtapes(o) {
    return o.etapes.map(function (p) { return 'à partir de ' + p.depuis + ' : ' + B.montantPalier(p); }).join(' ; ');
  }

  async function supprimerOrphelin(o) {
    const liste = B.state.orphelins;
    const idx = liste.indexOf(o);
    if (idx < 0) return;
    if (!root.confirm('Supprimer les paliers de « ' + o.ligne.libelle + ' » (ligne introuvable) ?')) return;
    erreurOrphelins = '';
    liste.splice(idx, 1);
    B.refresh();
    try {
      await B.persist('donnees');
    } catch (e) {
      liste.splice(Math.min(idx, liste.length), 0, o);
      erreurOrphelins = e.message;
      B.refresh();
    }
  }

  function carteOrphelins() {
    const c = carte('Paliers sans ligne correspondante', 'Ces paliers (paliers.yaml) ne correspondent à aucune ligne importée (ligne renommée ou retirée par un nouvel import). Ils sont conservés tant que vous ne les supprimez pas ; renommer une ligne vers ces champs leur rattache à nouveau ces paliers.');
    const ul = el('ul', '', { class: 'orphelins' });
    B.state.orphelins.forEach(function (o, i) {
      const g = o.ligne;
      const li = el('li');
      li.appendChild(el('span', g.nature + ' · ' + g.type + ' · ' + g.categorie + ' · ' + g.libelle, { class: 'orphelin-titre' }));
      li.appendChild(el('span', texteEtapes(o), { class: 'orphelin-etapes' }));
      const b = el('button', 'Supprimer', { type: 'button', class: 'btn-lien', 'aria-label': 'Supprimer les paliers de ' + g.libelle, 'data-cle': 'orphelin:' + i });
      b.addEventListener('click', function () { supprimerOrphelin(o); });
      li.appendChild(b);
      ul.appendChild(li);
    });
    c.appendChild(ul);
    if (erreurOrphelins) c.appendChild(el('p', erreurOrphelins, { class: 'erreur-ligne', role: 'alert' }));
    return c;
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
      const creerFin = function () { return champTexte(nature, i, l, 'fin', 'Fin', { placeholder: 'AAAA-MM' }); };
      const tr = el('tr', '', { class: classeLigne(l) });
      tr.appendChild(td(champTexte(nature, i, l, 'libelle', 'Libellé')));
      tr.appendChild(td(champTexte(nature, i, l, 'categorie', 'Catégorie')));
      tr.appendChild(td(champSelect(nature, i, l, 'type', 'Type', TYPES)));
      tr.appendChild(td(champTexte(nature, i, l, 'echeances', 'Échéances', { placeholder: '6-500, 10-500' })));
      // Les lignes exceptionnelles sont datées par leurs échéances : pas de début/fin/revalorisé.
      if (nature === 'annuel') {
        tr.appendChild(td(champTexte(nature, i, l, 'debut', 'Début', { placeholder: 'AAAA-MM' })));
        tr.appendChild(td(B.proprietaireFin(l) === 'base' ? creerFin() : null));
        tr.appendChild(td(champCase(nature, i, l)));
      } else {
        for (let k = 0; k < 3; k++) tr.appendChild(td(el('span', '—', { class: 'vide', 'aria-label': 'Non applicable' })));
      }
      const imp = impacts[i] ? impacts[i].impact_mensuel : 0;
      tr.appendChild(td(el('span', signe(imp), { class: imp < 0 ? 'neg' : '' }), 'num'));
      tr.appendChild(td(actions(nature, i, l)));
      tb.appendChild(tr);
      sousLignes(nature, i, l, cols.length, { depuis: 1, montant: 3, fin: nature === 'annuel' ? 5 : null, actions: 8 }, creerFin, { placeholder: '6-500, 10-500' }).forEach(function (s) { tb.appendChild(s); });
      const e = ligneErreur(l, cols.length);
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

    const iA = B.impactMensuel(annuel, params);
    const iE = B.impactMensuel(exc, params);
    const total = iA.concat(iE).reduce(function (a, x) { return a + x.impact_mensuel; }, 0);
    const bilan = B.bilanLignes(annuel.concat(exc), params, 12);

    const resume = carte('Annuel & exceptionnel', 'Impact mensuel = total des douze premiers mois projetés ÷ 12, calculé sur les montants de départ (hors revalorisation).');
    const tete = el('div', '', { class: 'aide-ligne' });
    tete.appendChild(el('span', 'Syntaxe des échéances'));
    tete.appendChild(aide());
    resume.appendChild(tete);
    // Les 12 premiers mois projetés, rangés de janvier à décembre (chaque mois civil apparaît une fois).
    const parMois = B.bilanParMois(annuel.concat(exc), params, 12).sort(function (a, b) { return Number(a.ym.slice(5)) - Number(b.ym.slice(5)); });
    resume.appendChild(el('p', 'Mois par mois, de janvier à décembre : chaque mois civil des 12 premiers mois projetés (à partir du mois de départ), montants de départ.', { class: 'note' }));
    resume.appendChild(B.tableauBilan('Bilan annuel et exceptionnel mois par mois', parMois.map(function (m) {
      return { titre: MOIS_COURTS[Number(m.ym.slice(5)) - 1], revenus: m.revenus, depenses: m.depenses, net: m.net };
    })));
    resume.appendChild(totaux([
      { t: 'Revenus sur 12 mois', v: bilan.revenus },
      { t: 'Dépenses sur 12 mois', v: -bilan.depenses },
      { t: 'Impact bilan sur 12 mois (revenus − dépenses)', v: bilan.net },
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
