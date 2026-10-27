(function (root) {
  'use strict';

  const normeCat = function (t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); };

  // Regroupe des lignes par catégorie (ordre de première apparition), en gardant l'index d'origine.
  // Clé de groupe : casse et espaces ignorés ; titre : l'orthographe configurée (`preferes`, facultatif) sinon celle de la première ligne.
  function grouperParCategorie(lignes, preferes) {
    const groupes = [];
    const parCle = new Map();
    const choisies = new Map();
    (preferes || []).forEach(function (n) { const k = normeCat(n).toLowerCase(); if (!choisies.has(k)) choisies.set(k, normeCat(n)); });
    (lignes || []).forEach(function (ligne, index) {
      const k = normeCat(ligne.categorie).toLowerCase();
      if (!parCle.has(k)) {
        const g = { categorie: k === '' ? '' : (choisies.get(k) || normeCat(ligne.categorie)), items: [] };
        parCle.set(k, g);
        groupes.push(g);
      }
      parCle.get(k).items.push({ index: index, ligne: ligne });
    });
    return groupes;
  }

  function nombre(texte) {
    const t = String(texte == null ? '' : texte).trim().replace(/\s/g, '').replace(',', '.');
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
  }

  // Applique une saisie de cellule à une COPIE de la ligne (l'originale n'est jamais modifiée).
  // `inflation` (fraction, facultatif) : taux de parametres.yaml, repris par un revenu issu d'une dépense « revalorisée ».
  function appliquerEdition(ligne, champ, valeur, nature, inflation) {
    const copie = Object.assign({}, ligne);
    if (champ === 'type') {
      if (valeur === ligne.type) return copie;
      copie.type = valeur;
      // Aucune information perdue en silence : la case des dépenses et le taux des revenus se convertissent l'un en l'autre.
      if (valeur === 'depense') {
        const t = ligne.taux_revalorisation;
        copie.revalorise = typeof t === 'number' && t !== 0;
        delete copie.taux_revalorisation;
      } else if (valeur === 'revenu') {
        if (ligne.revalorise === true && typeof inflation === 'number') copie.taux_revalorisation = Number((inflation * 100).toPrecision(12));
        delete copie.revalorise;
      }
    } else if (champ === 'taux_revalorisation') {
      const t = String(valeur == null ? '' : valeur).trim();
      if (t === '') delete copie.taux_revalorisation;
      else copie.taux_revalorisation = /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t; // texte conservé tel quel : la validation le refuse avec un message
    } else if (champ === 'montant' && nature === 'mensuel') {
      copie.montant = nombre(valeur);
    } else if (champ === 'debut' || champ === 'fin') {
      const t = String(valeur == null ? '' : valeur).trim();
      copie[champ] = t === '' ? null : t;
    } else if (champ === 'actif') {
      if (valeur === false || valeur === 'false') copie.actif = false;
      else delete copie.actif; // actif par défaut : la clé disparaît du fichier
    } else if (champ === 'revalorise') {
      copie.revalorise = valeur === true || valeur === 'true';
    } else {
      copie[champ] = typeof valeur === 'string' ? valeur.trim() : valeur;
    }
    return copie;
  }

  // Valeur affichée dans la cellule d'une ligne pour un champ.
  function valeurCellule(ligne, champ) {
    const v = ligne[champ];
    return v == null ? '' : String(v);
  }

  // ---- Paliers : fonctions pures, toujours sur des copies --------------------------------

  // Clé du montant d'un palier : nombre « montant » pour une ligne mensuelle, texte « echeances » sinon.
  function cleMontantPalier(nature) { return nature === 'mensuel' ? 'montant' : 'echeances'; }

  function aDesPaliers(ligne) { return Array.isArray(ligne.paliers) && ligne.paliers.length > 0; }

  function moisApres(ym) {
    const a = Number(ym.slice(0, 4));
    const m = Number(ym.slice(5, 7));
    const n = a * 12 + (m - 1) + 1;
    return String(Math.floor(n / 12)).padStart(4, '0') + '-' + String((n % 12) + 1).padStart(2, '0');
  }

  function montantPalier(p) { return p.echeances != null ? p.echeances : p.montant; }

  // Ajoute un palier : `depuis` = mois suivant le palier précédent (ou le début de la ligne / le mois de départ), montant = copie du précédent.
  function ajouterPalier(ligne, nature, depart) {
    const copie = Object.assign({}, ligne);
    const ps = aDesPaliers(ligne) ? ligne.paliers.map(function (p) { return Object.assign({}, p); }) : [];
    let depuis;
    let montant;
    if (ps.length) {
      depuis = moisApres(ps[ps.length - 1].depuis);
      montant = montantPalier(ps[ps.length - 1]);
    } else {
      const base = ligne.debut && ligne.debut > depart ? ligne.debut : depart;
      depuis = moisApres(base);
      montant = nature === 'mensuel' ? ligne.montant : (ligne.echeances != null ? ligne.echeances : ligne.montant);
    }
    const p = { depuis: depuis };
    p[cleMontantPalier(nature)] = nature === 'mensuel' ? montant : String(montant == null ? '' : montant);
    ps.push(p);
    copie.paliers = ps;
    return copie;
  }

  function retirerPalier(ligne, i) {
    const copie = Object.assign({}, ligne);
    const ps = (ligne.paliers || []).filter(function (p, k) { return k !== i; }).map(function (p) { return Object.assign({}, p); });
    if (ps.length) copie.paliers = ps; else delete copie.paliers;
    return copie;
  }

  function retirerPaliers(ligne) {
    const copie = Object.assign({}, ligne);
    delete copie.paliers;
    return copie;
  }

  // champ : 'depuis' ou 'montant' (le montant d'un palier se range sous « montant » ou « echeances » selon la nature).
  function editerPalier(ligne, i, champ, valeur, nature) {
    const copie = Object.assign({}, ligne);
    copie.paliers = (ligne.paliers || []).map(function (p) { return Object.assign({}, p); });
    const p = copie.paliers[i];
    if (!p) return copie;
    if (champ === 'depuis') {
      const t = String(valeur == null ? '' : valeur).trim();
      p.depuis = /^\d{4}-\d$/.test(t) ? t.slice(0, 5) + '0' + t.slice(5) : t; // 2030-3 -> 2030-03
    } else if (nature === 'mensuel') {
      p.montant = nombre(valeur);
    } else {
      p.echeances = String(valeur == null ? '' : valeur).trim();
    }
    return copie;
  }

  // Qui porte l'entrée « Fin » à l'écran : le dernier palier s'il y en a, sinon la ligne (la donnée reste `ligne.fin`).
  function proprietaireFin(ligne) { return aDesPaliers(ligne) ? 'palier' : 'base'; }

  // Décocher « Palier » : confirmation et suppression si la ligne a des paliers, simple masquage sinon.
  function actionBascule(ligne, coche) {
    if (coche) return 'ouvrir';
    return aDesPaliers(ligne) ? 'confirmer' : 'masquer';
  }

  const api = {
    grouperParCategorie: grouperParCategorie, appliquerEdition: appliquerEdition, valeurCellule: valeurCellule,
    cleMontantPalier: cleMontantPalier, aDesPaliers: aDesPaliers, moisApres: moisApres, montantPalier: montantPalier,
    ajouterPalier: ajouterPalier, retirerPalier: retirerPalier, retirerPaliers: retirerPaliers, editerPalier: editerPalier,
    proprietaireFin: proprietaireFin, actionBascule: actionBascule,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
