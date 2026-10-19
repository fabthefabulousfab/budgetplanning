(function (root) {
  'use strict';

  // Regroupe des lignes par catégorie (ordre de première apparition), en gardant l'index d'origine.
  function grouperParCategorie(lignes) {
    const groupes = [];
    const parNom = new Map();
    (lignes || []).forEach(function (ligne, index) {
      const nom = ligne.categorie || '';
      if (!parNom.has(nom)) {
        const g = { categorie: nom, items: [] };
        parNom.set(nom, g);
        groupes.push(g);
      }
      parNom.get(nom).items.push({ index: index, ligne: ligne });
    });
    return groupes;
  }

  function nombre(texte) {
    const t = String(texte == null ? '' : texte).trim().replace(/\s/g, '').replace(',', '.');
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
  }

  // Applique une saisie de cellule à une COPIE de la ligne (l'originale n'est jamais modifiée).
  function appliquerEdition(ligne, champ, valeur, nature) {
    const copie = Object.assign({}, ligne);
    if (champ === 'montant' && nature === 'mensuel') {
      copie.montant = nombre(valeur);
    } else if (champ === 'debut' || champ === 'fin') {
      const t = String(valeur == null ? '' : valeur).trim();
      copie[champ] = t === '' ? null : t;
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

  const api = { grouperParCategorie: grouperParCategorie, appliquerEdition: appliquerEdition, valeurCellule: valeurCellule };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
