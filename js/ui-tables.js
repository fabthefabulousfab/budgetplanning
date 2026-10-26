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

  // ouiNon : présentation de relevé (« ● oui » / « non ») ; la case reste une vraie case à cocher.
  function champCase(nature, index, ligne, ouiNon) {
    const c = el('input', '', { type: 'checkbox', 'aria-label': 'Revalorisé — ' + ligne.libelle, 'data-cle': nature + ':' + index + ':revalorise' });
    c.checked = ligne.revalorise === true;
    c.addEventListener('change', function () { modifier(nature, ligne, 'revalorise', c.checked); });
    const zone = el('label', '', { class: 'case-reval' + (ouiNon ? ' case-oui-non' : '') }); // zone cliquable d'au moins 24 px autour de la case
    zone.appendChild(c);
    if (ouiNon) { // l'état est annoncé par la case elle-même : les mots sont décoratifs
      zone.appendChild(el('span', 'oui', { class: 'reval-oui', 'aria-hidden': 'true' }));
      zone.appendChild(el('span', 'non', { class: 'reval-non', 'aria-hidden': 'true' }));
    }
    return zone;
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
    return 'ligne' + (erreurs.has(ligne) ? ' invalide' : '') + (ligne.actif === false ? ' masque' : '');
  }

  function boutonSupprimer(nature, index, ligne) {
    return B.boutonIcone('corbeille', 'Supprimer la ligne ' + ligne.libelle, 'Supprimer la ligne (après confirmation)', nature + ':' + index + ':suppr', function () { supprimer(nature, ligne); });
  }

  function td(contenu, classe) {
    const c = el('td', '', classe ? { class: classe } : {});
    if (contenu) c.appendChild(contenu);
    return c;
  }

  // Texte lu par les lecteurs d'écran mais invisible à l'écran.
  function cache(texte) { return el('span', texte, { class: 'visuellement-cache' }); }

  // Cellule vide d'un relevé : un tiret, et une explication pour les lecteurs d'écran.
  function tiret(explication) {
    const s = el('span', '', { class: 'tiret', title: explication });
    s.appendChild(el('span', '—', { 'aria-hidden': 'true' }));
    s.appendChild(cache(explication));
    return s;
  }

  // cols : { t, num?, classe?, cache? } ; cache : en-tête lu par les lecteurs d'écran seulement.
  function entetes(cols) {
    const tr = el('tr');
    cols.forEach(function (h) {
      const classe = [h.num ? 'num' : '', h.classe || ''].join(' ').trim();
      const fmtMois = !h.cache && /^(.+ )\(AAAA-MM\)$/.exec(h.t); // le format ne se coupe pas en fin de ligne
      const th = el('th', h.cache || fmtMois ? '' : h.t, classe ? { class: classe, scope: 'col' } : { scope: 'col' });
      if (h.cache) th.appendChild(cache(h.t));
      if (fmtMois) {
        th.appendChild(document.createTextNode(fmtMois[1]));
        th.appendChild(el('span', '(AAAA-MM)', { class: 'format-mois' }));
      }
      tr.appendChild(th);
    });
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

  // Ligne de message d'erreur sous une ligne de relevé (null s'il n'y a pas de message).
  function ligneMessage(msg, nbCols) {
    if (!msg) return null;
    const tr = el('tr', '', { class: 'ligne-erreur' });
    const c = el('td', '', { colspan: String(nbCols), role: 'alert' });
    c.appendChild(el('div', msg, { class: 'colle-gauche' })); // le message reste lisible quand le tableau défile
    tr.appendChild(c);
    return tr;
  }

  function ligneErreur(ligne, nbCols) { return ligneMessage(erreurs.get(ligne), nbCols); }

  // Relevé vide : une phrase calme et une invitation (le texte reste visible quand le tableau défile).
  function releveVide(titre, texte, nbCols) {
    const tr = el('tr', '', { class: 'releve-vide' });
    const cel = el('td', '', { colspan: String(nbCols) });
    const w = el('div', '', { class: 'colle-gauche releve-vide-texte' });
    w.appendChild(el('p', titre, { class: 'releve-vide-titre' }));
    w.appendChild(el('p', texte));
    cel.appendChild(w);
    tr.appendChild(cel);
    return tr;
  }

  // ---- Formulaire d'ajout -----------------------------------------------------------------

  // Champ de formulaire étiqueté : le libellé est visible, le nom accessible reste l'aria-label du champ.
  function champEtiquete(texte, controle, classe, note) {
    const l = el('label', '', { class: 'champ-ajout' + (classe ? ' ' + classe : '') });
    const lib = el('span', texte, { class: 'champ-lib' });
    if (note) lib.appendChild(el('em', note, { class: 'champ-note' }));
    l.appendChild(lib);
    l.appendChild(controle);
    return l;
  }

  function champAjout(brouillon, cle, label, attrs) {
    const i = el('input', '', Object.assign({ type: 'text', 'aria-label': label, 'data-cle': 'ajout:' + cle }, attrs || {}));
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
      f.appendChild(champEtiquete('Nature', selNature, 'champ-court'));
    }
    const selType = el('select', '', { 'aria-label': 'Type de la nouvelle ligne', 'data-cle': 'ajout:type' });
    TYPES.forEach(function (t) {
      const o = el('option', t[1], { value: t[0] });
      if ((brouillon.type || 'depense') === t[0]) o.selected = true;
      selType.appendChild(o);
    });
    selType.addEventListener('change', function () { brouillon.type = selType.value; });
    f.appendChild(champEtiquete('Type', selType, 'champ-court'));
    f.appendChild(champEtiquete('Catégorie', champAjout(brouillon, 'categorie', 'Catégorie', { list: dlId }), 'champ-moyen'));
    f.appendChild(champEtiquete('Libellé', champAjout(brouillon, 'libelle', 'Libellé'), 'champ-large'));
    const champ = nature === 'mensuel' ? 'montant' : 'echeances';
    const lib = nature === 'mensuel' ? 'Montant mensuel' : 'Échéances';
    const attrs = nature === 'mensuel' ? { inputmode: 'decimal' } : { placeholder: '6-500, 10-500' };
    f.appendChild(champEtiquete(lib, champAjout(brouillon, champ, lib, attrs), 'champ-moyen'));
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

  // En-tête du relevé : trois grands chiffres soulignés, puis les prêts sur une ligne plus petite.
  function chiffresReleve(surtitre, grands, petits) {
    const w = el('div', '', { class: 'mensuel-totaux' });
    w.appendChild(el('p', surtitre, { class: 'surtitre' }));
    const g = el('div', '', { class: 'mensuel-chiffres' });
    grands.forEach(function (it) {
      const d = el('div', '', { class: 'mensuel-chiffre ' + it.filet });
      const lib = el('span', it.t, { class: 'mensuel-lib' });
      if (it.detail) lib.appendChild(el('span', ' ' + it.detail, { class: 'mensuel-lib-detail' })); // masqué visuellement sur écran étroit, lu par les lecteurs d'écran
      d.appendChild(lib);
      d.appendChild(el('strong', signe(it.v), { class: 'mensuel-val' + (it.signe && it.v < 0 ? ' neg' : '') }));
      g.appendChild(d);
    });
    w.appendChild(g);
    const p = el('div', '', { class: 'mensuel-prets' });
    petits.forEach(function (it) {
      const d = el('div', '', { class: 'mensuel-pret' });
      d.appendChild(el('span', it.t, { class: 'mensuel-lib' }));
      d.appendChild(el('strong', signe(it.v), { class: it.signe && it.v < 0 ? 'neg' : '' }));
      p.appendChild(d);
    });
    w.appendChild(p);
    return w;
  }

  function chiffresMensuels(tot, restant, moyennePrets) {
    const w = chiffresReleve('Ce qui revient chaque mois', [
      { t: 'Revenus', v: tot.revenus, filet: 'filet-positif' },
      { t: 'Dépenses', v: -tot.depenses, filet: 'filet-negatif' },
      { t: 'Reste chaque mois', v: restant, filet: 'filet-encre', signe: true },
    ], [
      { t: 'Mensualités de prêts (moyenne)', v: moyennePrets },
      { t: 'Reste chaque mois après prêts', v: restant + moyennePrets, signe: true },
    ]);
    w.setAttribute('data-aide', 'mensuel-totaux');
    return w;
  }

  // Titre de catégorie : nom à empattement, total (montants de départ des lignes visibles, même calcul que les
  // grands chiffres) dans la colonne des montants, aligné sur eux.
  function titreCategorie(g, nbCols) {
    const t = B.totauxMensuels({ mensuel: g.items.map(function (it) { return it.ligne; }) }, B.state.parametres);
    const net = t.revenus - t.depenses;
    const tr = el('tr', '', { class: 'groupe' });
    tr.appendChild(el('th', g.categorie || 'Sans catégorie', { colspan: '2', scope: 'colgroup', class: 'groupe-nom' }));
    const total = el('td', '', { class: 'num groupe-total ' + (net < 0 ? 'groupe-neg' : net > 0 ? 'groupe-pos' : 'groupe-nul') });
    total.appendChild(cache('Total ' + (g.categorie || 'Sans catégorie') + ' : '));
    total.appendChild(document.createTextNode(signe(net)));
    tr.appendChild(total);
    tr.appendChild(el('td', '', { colspan: String(nbCols - 3) }));
    return tr;
  }

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
    c.appendChild(chiffresMensuels(tot, restant, moyennePrets));

    const cols = [
      { t: 'Libellé', classe: 'c-lib' }, { t: 'Type', classe: 'c-type' }, { t: '€ / mois', num: true, classe: 'c-mont' },
      { t: 'Revalorisé', classe: 'c-reval' }, { t: 'Fin (AAAA-MM)', classe: 'c-fin' }, { t: 'Actions', classe: 'c-act', cache: true },
    ];
    const t = el('table', '', { class: 'edition releve' });
    t.appendChild(entetes(cols));
    const tb = el('tbody');
    B.grouperParCategorie(lignes).forEach(function (g) {
      tb.appendChild(titreCategorie(g, cols.length));
      g.items.forEach(function (it) {
        const l = it.ligne;
        const tr = el('tr', '', { class: classeLigne(l) });
        tr.appendChild(td(champTexte('mensuel', it.index, l, 'libelle', 'Libellé', { title: l.libelle }), 'c-lib'));
        tr.appendChild(td(champSelect('mensuel', it.index, l, 'type', 'Type', TYPES), 'c-type'));
        tr.appendChild(td(champTexte('mensuel', it.index, l, 'montant', 'Montant mensuel', { inputmode: 'decimal', class: 'num' }), 'num c-mont'));
        tr.appendChild(td(champCase('mensuel', it.index, l, true), 'c-reval'));
        const creerFin = function () { return B.champMois(champTexte('mensuel', it.index, l, 'fin', 'Fin')); };
        // Avec des paliers, la fin se saisit sur le dernier palier.
        tr.appendChild(td(B.proprietaireFin(l) === 'base' ? creerFin() : tiret('La fin se saisit sur le dernier palier'), 'c-fin'));
        tr.appendChild(td(actions('mensuel', it.index, l), 'c-act'));
        tb.appendChild(tr);
        sousLignes('mensuel', it.index, l, cols.length, { depuis: 1, montant: 2, fin: 4, actions: 5 }, creerFin, { placeholder: 'Montant mensuel' }).forEach(function (s) { tb.appendChild(s); });
        const e = ligneErreur(l, cols.length);
        if (e) tb.appendChild(e);
      });
    });
    if (!lignes.length) {
      tb.appendChild(releveVide('Aucune ligne mensuelle pour l’instant.', 'Ajoutez un salaire, un loyer ou un abonnement avec le formulaire « Ajouter une ligne mensuelle », juste en dessous.', cols.length));
    }
    t.appendChild(tb);
    const defil = el('div', '', { class: 'defil' });
    defil.appendChild(t);
    defil.setAttribute('data-aide', 'mensuel-tableau');
    c.appendChild(defil);
    panneau.appendChild(c);

    const a = carte('Ajouter une ligne mensuelle');
    a.setAttribute('data-aide', 'mensuel-ajout');
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
    c.setAttribute('data-aide', 'orphelins');
    const ul = el('ul', '', { class: 'orphelins' });
    B.state.orphelins.forEach(function (o, i) {
      const g = o.ligne;
      const li = el('li');
      const texte = el('span', '', { class: 'orphelin-texte' });
      texte.appendChild(el('span', g.nature + ' · ' + g.type + ' · ' + g.categorie + ' · ' + g.libelle, { class: 'orphelin-titre' }));
      texte.appendChild(el('span', texteEtapes(o), { class: 'orphelin-etapes' }));
      li.appendChild(texte);
      li.appendChild(B.boutonIcone('corbeille', 'Supprimer les paliers de ' + g.libelle, 'Supprimer ces paliers (après confirmation)', 'orphelin:' + i, function () { supprimerOrphelin(o); }));
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

  // Annuel et exceptionnel : même relevé que Mensuel (lignes à plat, la catégorie reste modifiable dans sa colonne).
  function tableAnnuel(nature, lignes, impacts) {
    const annuel = nature === 'annuel';
    const cols = [
      { t: 'Libellé', classe: 'c-lib' }, { t: 'Catégorie', classe: 'c-cat' }, { t: 'Type', classe: 'c-type' },
      { t: 'Échéances', classe: 'c-ech' }, { t: 'Début (AAAA-MM)', classe: 'c-deb' }, { t: 'Fin (AAAA-MM)', classe: 'c-fin' },
      { t: 'Revalorisé', classe: 'c-reval' }, { t: 'Impact mensuel', num: true, classe: 'c-mont' }, { t: 'Actions', classe: 'c-act', cache: true },
    ];
    const t = el('table', '', { class: 'edition releve t-annuel' });
    t.appendChild(entetes(cols));
    const tb = el('tbody');
    lignes.forEach(function (l, i) {
      const creerFin = function () { return B.champMois(champTexte(nature, i, l, 'fin', 'Fin')); };
      const tr = el('tr', '', { class: classeLigne(l) });
      tr.appendChild(td(champTexte(nature, i, l, 'libelle', 'Libellé', { title: l.libelle }), 'c-lib'));
      tr.appendChild(td(champTexte(nature, i, l, 'categorie', 'Catégorie', { placeholder: '—' }), 'c-cat'));
      tr.appendChild(td(champSelect(nature, i, l, 'type', 'Type', TYPES), 'c-type'));
      tr.appendChild(td(champTexte(nature, i, l, 'echeances', 'Échéances', { placeholder: '6-500, 10-500' }), 'c-ech'));
      // Les lignes exceptionnelles sont datées par leurs échéances : pas de début/fin/revalorisé.
      if (annuel) {
        tr.appendChild(td(B.champMois(champTexte(nature, i, l, 'debut', 'Début')), 'c-deb'));
        tr.appendChild(td(B.proprietaireFin(l) === 'base' ? creerFin() : tiret('La fin se saisit sur le dernier palier'), 'c-fin'));
        tr.appendChild(td(champCase(nature, i, l, true), 'c-reval'));
      } else {
        ['c-deb', 'c-fin', 'c-reval'].forEach(function (k) { tr.appendChild(td(tiret('Non applicable'), k)); });
      }
      const imp = impacts[i] ? impacts[i].impact_mensuel : 0;
      tr.appendChild(td(el('span', signe(imp), { class: imp < 0 ? 'neg' : '' }), 'num c-mont c-impact'));
      tr.appendChild(td(actions(nature, i, l), 'c-act'));
      tb.appendChild(tr);
      sousLignes(nature, i, l, cols.length, { depuis: 1, montant: 3, fin: annuel ? 5 : null, actions: 8 }, creerFin, { placeholder: '6-500, 10-500' }).forEach(function (s) { tb.appendChild(s); });
      const e = ligneErreur(l, cols.length);
      if (e) tb.appendChild(e);
    });
    if (!lignes.length) {
      tb.appendChild(annuel
        ? releveVide('Aucune ligne annuelle pour l’instant.', 'Ajoutez une taxe, une assurance ou une cotisation avec le formulaire « Ajouter une ligne », plus bas.', cols.length)
        : releveVide('Aucune ligne exceptionnelle pour l’instant.', 'Ajoutez une dépense ou un revenu daté (une prime, un voyage…) avec le formulaire « Ajouter une ligne », plus bas, en choisissant la nature « Exceptionnel ».', cols.length));
    }
    t.appendChild(tb);
    const defil = el('div', '', { class: 'defil' });
    defil.appendChild(t);
    return defil;
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
    resume.appendChild(chiffresReleve('Sur les douze premiers mois projetés', [
      { t: 'Revenus sur 12 mois', v: bilan.revenus, filet: 'filet-positif' },
      { t: 'Dépenses sur 12 mois', v: -bilan.depenses, filet: 'filet-negatif' },
      { t: 'Impact bilan sur 12 mois', detail: '(revenus − dépenses)', v: bilan.net, filet: 'filet-encre', signe: true },
    ], [
      { t: 'Impact mensuel total', v: total, signe: true },
      { t: 'Restant moyen mensuel (montants de départ)', v: B.restantMoyen(d, params), signe: true },
    ]));
    // Les 12 premiers mois projetés, rangés de janvier à décembre (chaque mois civil apparaît une fois).
    const parMois = B.bilanParMois(annuel.concat(exc), params, 12).sort(function (a, b) { return Number(a.ym.slice(5)) - Number(b.ym.slice(5)); });
    resume.appendChild(el('p', 'Mois par mois, de janvier à décembre : chaque mois civil des 12 premiers mois projetés (à partir du mois de départ), montants de départ.', { class: 'note' }));
    const bilanMois = B.tableauBilan('Bilan annuel et exceptionnel mois par mois', parMois.map(function (m) {
      return { titre: MOIS_COURTS[Number(m.ym.slice(5)) - 1], revenus: m.revenus, depenses: m.depenses, net: m.net };
    }));
    bilanMois.setAttribute('data-aide', 'annuel-bilan');
    resume.appendChild(bilanMois);
    panneau.appendChild(resume);

    const ca = carte('Annuel');
    ca.setAttribute('data-aide', 'annuel-tableau');
    const tete = el('div', '', { class: 'aide-ligne' });
    tete.setAttribute('data-aide', 'annuel-syntaxe');
    tete.appendChild(el('span', 'Syntaxe des échéances'));
    tete.appendChild(aide());
    ca.appendChild(tete);
    ca.appendChild(tableAnnuel('annuel', annuel, iA));
    panneau.appendChild(ca);
    const ce = carte('Exceptionnel');
    ce.appendChild(tableAnnuel('exceptionnel', exc, iE));
    panneau.appendChild(ce);

    const a = carte('Ajouter une ligne');
    a.setAttribute('data-aide', 'annuel-ajout');
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

  // Pièces communes du relevé, réutilisées par les onglets Revenus et dépenses futurs et Prêts.
  B.releve = { el: el, td: td, cache: cache, tiret: tiret, entetes: entetes, ligneMessage: ligneMessage, releveVide: releveVide, champEtiquete: champEtiquete };

  B.registerTab('mensuel', 'Mensuel', enveloppe(renderMensuel));
  B.registerTab('annuel', 'Annuel & exceptionnel', enveloppe(renderAnnuel));
})(this);
