(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined';
  const St = isNode ? require('./store.js') : root.Budget;
  const P = isNode ? require('./projection.js') : root.Budget;

  const F = St.FICHIERS;
  const FICHIERS_BUDGET = [F.donnees, F.evenements, F.parametres, F.paliers];
  const A_CREER = [F.donnees, F.evenements, F.parametres]; // paliers.yaml n'est créé que lorsqu'il y a une entrée
  const IGNORES = ['thumbs.db', 'desktop.ini'];

  const estIgnore = function (nom) { return nom.charAt(0) === '.' || IGNORES.indexOf(nom.toLowerCase()) >= 0; };

  async function existe(dir, nom) {
    try {
      await dir.getFileHandle(nom);
      return true;
    } catch (e) {
      if (e && e.name === 'NotFoundError') return false;
      throw e;
    }
  }

  async function sonder(dir) {
    const trouves = [];
    for (const nom of FICHIERS_BUDGET) { if (await existe(dir, nom)) trouves.push(nom); }
    return trouves;
  }

  // Contenu du dossier : fichiers de budget présents et autres entrées (sous-dossiers compris).
  // `autres: null` = liste impossible à obtenir (on ne sait pas ce que le dossier contient).
  async function etatDossier(dir) {
    if (dir && typeof dir.values === 'function') {
      try {
        const fichiersBudget = [];
        const autres = [];
        for await (const h of dir.values()) {
          const nom = h && h.name;
          if (typeof nom !== 'string' || estIgnore(nom)) continue;
          if (FICHIERS_BUDGET.indexOf(nom) >= 0 && h.kind !== 'directory') fichiersBudget.push(nom);
          else autres.push(nom);
        }
        fichiersBudget.sort(function (a, b) { return FICHIERS_BUDGET.indexOf(a) - FICHIERS_BUDGET.indexOf(b); });
        return { fichiersBudget: fichiersBudget, autres: autres };
      } catch (e) {
        // liste refusée ou interrompue : on retombe sur le sondage, contenu inconnu
      }
    }
    return { fichiersBudget: await sonder(dir), autres: null };
  }

  function decisionOuverture(etat) {
    const budget = etat.fichiersBudget || [];
    if (budget.length === 0) return etat.autres !== null && etat.autres.length === 0 ? 'creer' : 'confirmer';
    return budget.indexOf(F.donnees) >= 0 ? 'ouvrir' : 'completer';
  }

  const donneesVides = function () { return { situation: { compte_courant: 0, epargne: 0 }, mensuel: [], annuel: [], exceptionnel: [] }; };

  const ecrivains = {
    [F.donnees]: function (dir) { return St.saveDonneesSeules(dir, donneesVides()); },
    [F.evenements]: function (dir) { return St.saveEvenements(dir, [], []); },
    [F.parametres]: function (dir) { return St.saveParametres(dir, P.PARAMETRES_DEFAUT); },
  };

  // Écrit uniquement des fichiers absents ; refuse (sans rien écrire) si l'un d'eux existe déjà.
  // En cas d'échec en cours de route, l'erreur porte `crees` : les fichiers réellement écrits.
  async function creerBudgetVide(dir, options) {
    const voulus = options && Array.isArray(options.seulement) ? options.seulement : A_CREER;
    const cibles = A_CREER.filter(function (n) { return voulus.indexOf(n) >= 0; });
    const presents = [];
    for (const n of cibles) { if (await existe(dir, n)) presents.push(n); }
    if (presents.length > 0) {
      const e = new Error('Création refusée : ' + presents.join(', ') + (presents.length > 1 ? ' existent' : ' existe') + ' déjà dans ce dossier. Aucun fichier n’a été modifié.');
      e.crees = [];
      throw e;
    }
    const crees = [];
    for (const n of cibles) {
      try {
        await ecrivains[n](dir);
      } catch (cause) {
        const detail = cause && cause.message ? cause.message : String(cause);
        const e = new Error('Création interrompue : ' + n + ' n’a pas pu être écrit (' + detail + '). ' + (crees.length ? 'Déjà créé : ' + crees.join(', ') + '.' : 'Aucun fichier n’a été créé.'));
        e.crees = crees.slice();
        e.fichier = n;
        throw e;
      }
      crees.push(n);
    }
    return { crees: crees };
  }

  const api = { etatDossier: etatDossier, creerBudgetVide: creerBudgetVide, decisionOuverture: decisionOuverture, FICHIERS_A_CREER: A_CREER };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
