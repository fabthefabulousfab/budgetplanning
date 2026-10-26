(function (root) {
  'use strict';

  // Catégories des lignes mensuelles, annuelles et exceptionnelles (les événements ont leurs propres catégories fixes).
  // Module pur : toutes les fonctions renvoient des copies et ne modifient jamais leurs arguments.
  const CATEGORIES_DEFAUT = {
    depense: ['Logement', 'Alimentation', 'Transport', 'Santé', 'Enfants et éducation', 'Loisirs', 'Abonnements', 'Assurances', 'Impôts et taxes', 'Vêtements', 'Cadeaux', 'Épargne', 'Autre'],
    revenu: ['Salaires', 'Allocations', 'Primes', 'Loyers perçus', 'Autres revenus'],
  };
  const NATURES = ['mensuel', 'annuel', 'exceptionnel'];
  const TYPES = ['depense', 'revenu'];
  const LONGUEUR_MAX = 60;
  const NOMBRE_MAX = 100;

  // Nom nettoyé : espaces de début et de fin retirés, espaces internes réduits à un seul.
  function nomCategorieValide(texte) {
    return String(texte == null ? '' : texte).replace(/\s+/g, ' ').trim();
  }

  // Clé de comparaison : casse et espaces ignorés (« Santé » et « Sante » restent distincts).
  function cle(texte) { return nomCategorieValide(texte).toLowerCase(); }

  function verifierType(type) {
    if (TYPES.indexOf(type) < 0) throw new Error('Type de catégorie inconnu : « ' + type + ' ».');
  }

  function listeDefinie(params, type) {
    return params && params.categories && Array.isArray(params.categories[type]) ? params.categories[type] : null;
  }

  // Lignes du type donné, toutes natures confondues.
  function lignesDuType(donnees, type) {
    const out = [];
    NATURES.forEach(function (n) {
      ((donnees && donnees[n]) || []).forEach(function (l) { if (l && l.type === type) out.push(l); });
    });
    return out;
  }

  function utilisees(donnees, type) {
    const vues = new Map();
    lignesDuType(donnees, type).forEach(function (l) {
      const nom = nomCategorieValide(l.categorie);
      if (nom !== '' && !vues.has(cle(nom))) vues.set(cle(nom), nom);
    });
    return Array.from(vues.values());
  }

  const alpha = function (a, b) { return a.localeCompare(b, 'fr'); };

  // Liste proposée : celle des paramètres (dans son ordre) plus, triées, les catégories utilisées qui n'y figurent pas.
  // Sans liste enregistrée (budget existant) : uniquement les catégories déjà utilisées. Rien n'est jamais masqué.
  function categoriesDisponibles(donnees, params, type) {
    const liste = listeDefinie(params, type);
    const base = liste ? liste.slice() : [];
    const connues = new Set(base.map(cle));
    const en_plus = utilisees(donnees, type).filter(function (n) { return !connues.has(cle(n)); }).sort(alpha);
    return base.concat(en_plus);
  }

  function compterUsages(donnees, type, nom) {
    const k = cle(nom);
    return lignesDuType(donnees, type).filter(function (l) { return cle(l.categorie) === k; }).length;
  }

  function copieParams(params) {
    const c = Object.assign({}, params);
    if (params && params.categories) c.categories = { depense: params.categories.depense ? params.categories.depense.slice() : undefined, revenu: params.categories.revenu ? params.categories.revenu.slice() : undefined };
    if (c.categories) Object.keys(c.categories).forEach(function (k) { if (c.categories[k] === undefined) delete c.categories[k]; });
    return c;
  }

  function verifierNom(nom) {
    if (nom === '') throw new Error('Le nom d’une catégorie ne peut pas être vide.');
    if (nom.length > LONGUEUR_MAX) throw new Error('Le nom d’une catégorie est limité à ' + LONGUEUR_MAX + ' caractères.');
  }

  // `donnees` (facultatif) sert à conserver, quand la liste n'était pas encore enregistrée, les catégories déjà utilisées.
  function ajouterCategorie(params, type, nom, donnees) {
    verifierType(type);
    const n = nomCategorieValide(nom);
    verifierNom(n);
    const p = copieParams(params);
    if (!p.categories) p.categories = {};
    TYPES.forEach(function (t) {
      if (!Array.isArray(p.categories[t])) p.categories[t] = categoriesDisponibles(donnees, params, t);
    });
    const existantes = categoriesDisponibles(donnees, p, type);
    if (existantes.some(function (x) { return cle(x) === cle(n); })) throw new Error('La catégorie « ' + n + ' » existe déjà.');
    if (p.categories[type].length >= NOMBRE_MAX) throw new Error('Trop de catégories (' + NOMBRE_MAX + ' au maximum par type).');
    p.categories[type].push(n);
    return p;
  }

  function copieDonnees(donnees, transforme) {
    const d = Object.assign({}, donnees);
    NATURES.forEach(function (nat) {
      if (!Array.isArray(donnees[nat])) return;
      d[nat] = donnees[nat].map(transforme); // les lignes non touchées gardent leur identité (l'interface y rattache son état)
    });
    return d;
  }

  // Renomme dans la liste et sur chaque ligne du type qui l'utilise.
  function renommerCategorie(donnees, params, type, ancien, nouveau) {
    verifierType(type);
    const n = nomCategorieValide(nouveau);
    verifierNom(n);
    const dispo = categoriesDisponibles(donnees, params, type);
    const kAncien = cle(ancien);
    if (!dispo.some(function (x) { return cle(x) === kAncien; })) throw new Error('Catégorie introuvable : « ' + nomCategorieValide(ancien) + ' ».');
    if (cle(n) !== kAncien && dispo.some(function (x) { return cle(x) === cle(n); })) {
      throw new Error('La catégorie « ' + n + ' » existe déjà : pour les réunir, supprimez « ' + nomCategorieValide(ancien) + ' » en déplaçant ses lignes vers « ' + n + ' ».');
    }
    const p = copieParams(params);
    const liste = listeDefinie(p, type);
    if (liste) p.categories[type] = liste.map(function (x) { return cle(x) === kAncien ? n : x; });
    const d = copieDonnees(donnees || {}, function (l) {
      if (l.type !== type || cle(l.categorie) !== kAncien) return l;
      return Object.assign({}, l, { categorie: n });
    });
    return { donnees: d, params: p };
  }

  // Supprime de la liste ; si des lignes l'utilisent, `vers` (autre catégorie existante du même type) est obligatoire.
  function supprimerCategorie(donnees, params, type, nom, vers) {
    verifierType(type);
    const k = cle(nom);
    const usages = compterUsages(donnees, type, nom);
    let cible = null;
    if (usages > 0) {
      if (nomCategorieValide(vers) === '') throw new Error('Choisissez la catégorie vers laquelle déplacer les ' + usages + ' ligne(s) de « ' + nomCategorieValide(nom) + ' ».');
      if (cle(vers) === k) throw new Error('Choisissez une autre catégorie que « ' + nomCategorieValide(nom) + ' » pour y déplacer ses lignes.');
      cible = categoriesDisponibles(donnees, params, type).find(function (x) { return cle(x) === cle(vers); });
      if (!cible) throw new Error('Catégorie de destination introuvable : « ' + nomCategorieValide(vers) + ' ».');
    }
    const p = copieParams(params);
    const liste = listeDefinie(p, type);
    if (liste) p.categories[type] = liste.filter(function (x) { return cle(x) !== k; });
    const d = copieDonnees(donnees || {}, function (l) {
      if (cible === null || l.type !== type || cle(l.categorie) !== k) return l;
      return Object.assign({}, l, { categorie: cible });
    });
    return { donnees: d, params: p };
  }

  const api = {
    CATEGORIES_DEFAUT: CATEGORIES_DEFAUT, CATEGORIE_LONGUEUR_MAX: LONGUEUR_MAX, CATEGORIES_MAX: NOMBRE_MAX,
    nomCategorieValide: nomCategorieValide, categoriesDisponibles: categoriesDisponibles, compterUsages: compterUsages,
    ajouterCategorie: ajouterCategorie, renommerCategorie: renommerCategorie, supprimerCategorie: supprimerCategorie,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
