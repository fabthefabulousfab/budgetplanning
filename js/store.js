(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined';
  const S = isNode ? require('./schedule.js') : root.Budget;
  const P = isNode ? require('./projection.js') : root.Budget;
  const Su = isNode ? require('./summary.js') : root.Budget;
  const Pr = isNode ? require('./prets.js') : root.Budget;
  const yaml = isNode ? require('../vendor/js-yaml.min.js') : root.jsyaml;
  const PARAMETRES_DEFAUT = P.PARAMETRES_DEFAUT;

  const FICHIERS = { donnees: 'donnees-courantes.yaml', evenements: 'evenements-futurs.yaml', parametres: 'parametres.yaml', paliers: 'paliers.yaml', historique: 'historique-comptes.csv' };
  const CATEGORIES_EVENEMENT = ['Études', 'Prêt', 'Achat', 'Revenu', 'Autre'];
  const NATURES = ['mensuel', 'annuel', 'exceptionnel', 'evenement'];

  function validerMois(v, nom) {
    if (v === null || v === undefined || v === '') return;
    if (typeof v !== 'string') throw new Error(nom + ' invalide : « ' + v + ' » (attendu AAAA-MM).');
    const p = S.parseYm(v);
    if (p.m < 1 || p.m > 12) throw new Error(nom + ' invalide : « ' + v + ' » (mois de 1 à 12).');
  }

  const MAX_PALIERS = 50;
  const CLES_PALIER = ['depuis', 'montant', 'echeances'];

  // Paliers d'une ligne : liste d'étapes { depuis: 'AAAA-MM', montant | echeances }, `depuis` strictement croissant et postérieur au début de la ligne.
  function validerPaliers(ps, nature, debut) {
    if (!Array.isArray(ps)) throw new Error('Les paliers doivent former une liste.');
    if (ps.length > MAX_PALIERS) throw new Error('Trop de paliers (' + MAX_PALIERS + ' au maximum).');
    let prec = null;
    ps.forEach(function (p, i) {
      const nom = 'Palier #' + (i + 1);
      try {
        if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('palier invalide.');
        const cleMontant = nature === 'mensuel' ? 'montant' : 'echeances';
        Object.keys(p).forEach(function (k) {
          if (CLES_PALIER.indexOf(k) < 0) throw new Error('clé inconnue « ' + k + ' » (attendues : depuis, ' + cleMontant + ').');
          if (k !== 'depuis' && k !== cleMontant) throw new Error('clé « ' + k + ' » non admise pour cette ligne : utiliser « ' + cleMontant + ' ».');
        });
        if (typeof p.depuis !== 'string' || p.depuis === '') throw new Error('« depuis » manquant (attendu AAAA-MM).');
        validerMois(p.depuis, '« depuis »');
        const idx = S.monthIndex(p.depuis);
        if (prec !== null && idx <= prec) throw new Error('« depuis » (' + p.depuis + ') doit être strictement postérieur au palier précédent (ordre croissant).');
        if (debut && idx <= S.monthIndex(debut)) throw new Error('« depuis » (' + p.depuis + ') doit être postérieur au début de la ligne (' + debut + ').');
        prec = idx;
        if (nature === 'mensuel') {
          if (typeof p.montant !== 'number' || !Number.isFinite(p.montant) || p.montant <= 0) throw new Error('le montant mensuel doit être un nombre supérieur à 0.');
        } else {
          const src = p.echeances;
          S.parseEcheances(typeof src === 'number' ? String(src) : src);
        }
      } catch (e) {
        throw new Error(nom + ' : ' + e.message);
      }
    });
  }

  function validerLigne(l, nature) {
    if (!l || typeof l !== 'object') throw new Error('Ligne invalide.');
    if (NATURES.indexOf(nature) < 0) throw new Error('Nature de ligne inconnue : ' + nature);
    if (l.type !== 'revenu' && l.type !== 'depense') throw new Error('Type invalide : « ' + l.type + ' » (revenu ou depense).');
    if (typeof l.libelle !== 'string' || l.libelle.trim() === '') throw new Error('Libellé manquant.');
    if (nature === 'evenement') {
      if (typeof l.id !== 'string' || l.id === '') throw new Error('Identifiant manquant.');
      if (CATEGORIES_EVENEMENT.indexOf(l.categorie) < 0) throw new Error('Catégorie invalide : « ' + l.categorie + ' ».');
    } else if (typeof l.categorie !== 'string' || l.categorie === '') {
      throw new Error('Catégorie manquante.');
    }
    if (l.revalorise != null && typeof l.revalorise !== 'boolean') {
      throw new Error('« revalorise » doit valoir true ou false (écrire true ou false, pas « ' + l.revalorise + ' »).');
    }
    if (l.actif != null && typeof l.actif !== 'boolean') throw new Error('« actif » doit valoir true ou false.');
    validerMois(l.debut, 'Début');
    validerMois(l.fin, 'Fin');
    if (l.debut && l.fin && S.monthIndex(l.fin) < S.monthIndex(l.debut)) throw new Error('La fin (' + l.fin + ') précède le début (' + l.debut + ').');
    if (nature === 'mensuel') {
      const m = l.montant;
      if (typeof m === 'number') {
        if (!Number.isFinite(m) || m <= 0) throw new Error('Le montant mensuel doit être supérieur à 0.');
      } else {
        const sch = S.parseEcheances(m);
        if (sch.kind !== 'mensuel') throw new Error('Montant mensuel attendu : un nombre.');
      }
    } else {
      const src = l.echeances != null ? l.echeances : l.montant;
      S.parseEcheances(typeof src === 'number' ? String(src) : src);
    }
    if (l.paliers != null) validerPaliers(l.paliers, nature, l.debut);
  }

  function validerDonnees(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Données invalides.');
    if (d.situation != null) {
      ['compte_courant', 'epargne'].forEach(function (k) {
        const v = d.situation[k];
        if (v != null && !(typeof v === 'number' && Number.isFinite(v))) throw new Error('Situation : ' + k + ' doit être un nombre.');
      });
    }
    ['mensuel', 'annuel', 'exceptionnel'].forEach(function (nature) {
      const rows = d[nature];
      if (rows == null) return;
      if (!Array.isArray(rows)) throw new Error('« ' + nature + ' » doit être une liste.');
      rows.forEach(function (l, i) {
        try { validerLigne(l, nature); } catch (e) { throw new Error(nature + ' #' + (i + 1) + ' : ' + e.message); }
      });
    });
  }

  function validerEvenements(evs) {
    if (!Array.isArray(evs)) throw new Error('Les événements doivent former une liste.');
    evs.forEach(function (l, i) {
      try { validerLigne(l, 'evenement'); } catch (e) { throw new Error('événement #' + (i + 1) + ' : ' + e.message); }
    });
  }

  function validerPrets(prets) {
    if (!Array.isArray(prets)) throw new Error('Les prêts doivent former une liste.');
    prets.forEach(function (p, i) {
      try { Pr.validerPret(p); } catch (e) { throw new Error('prêt #' + (i + 1) + ' : ' + e.message); }
    });
  }

  const estPret = function (l) { return l !== null && typeof l === 'object' && l.nature === 'pret'; };

  function num(v) { return typeof v === 'number' && Number.isFinite(v); }

  const CLES_SOLDE = ['compte_courant', 'epargne'];

  function validerParametres(p) {
    if (!p || typeof p !== 'object') throw new Error('Paramètres invalides.');
    validerMois(p.depart, 'Départ');
    if (!p.depart) throw new Error('Départ manquant.');
    if (!num(p.horizon_annees) || !Number.isInteger(p.horizon_annees) || p.horizon_annees < 10 || p.horizon_annees > 15) {
      throw new Error('horizon_annees doit être un entier entre 10 et 15.');
    }
    const r = p.revalorisation;
    if (!r || !num(r.taux)) throw new Error('revalorisation.taux doit être un nombre.');
    if (!num(r.mois) || !Number.isInteger(r.mois) || r.mois < 1 || r.mois > 12) throw new Error('revalorisation.mois doit être un entier entre 1 et 12.');
    CLES_SOLDE.forEach(function (k) {
      const v = p.solde_depart ? p.solde_depart[k] : null;
      if (v != null && !num(v)) throw new Error('solde_depart.' + k + ' doit être un nombre (ou vide pour reprendre la valeur Excel).');
    });
  }

  // Fusion profonde des défauts avec le contenu ; clés inconnues (ex. prets_etudiants) ignorées ; undefined/null ignorés.
  function fusionnerParametres(contenu) {
    const c = contenu && typeof contenu === 'object' && !Array.isArray(contenu) ? contenu : {};
    const out = { depart: PARAMETRES_DEFAUT.depart, horizon_annees: PARAMETRES_DEFAUT.horizon_annees, revalorisation: Object.assign({}, PARAMETRES_DEFAUT.revalorisation), solde_depart: Object.assign({}, PARAMETRES_DEFAUT.solde_depart) };
    if (c.depart != null) out.depart = c.depart;
    if (c.horizon_annees != null) out.horizon_annees = c.horizon_annees;
    const r = c.revalorisation;
    if (r && typeof r === 'object') {
      if (r.taux != null) out.revalorisation.taux = r.taux;
      if (r.mois != null) out.revalorisation.mois = r.mois;
    }
    const s = c.solde_depart;
    if (s && typeof s === 'object') {
      CLES_SOLDE.forEach(function (k) { if (s[k] != null) out.solde_depart[k] = s[k]; });
    }
    return out;
  }

  const CLES_PARAMETRES = ['depart', 'horizon_annees', 'revalorisation', 'solde_depart'];
  const CLES_OBSOLETES = ['prets_etudiants'];

  function estObjet(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  // Contrôle de la structure du fichier lu (avant fusion avec les défauts) : rien n'est ignoré en silence.
  function validerContenuParametres(c) {
    if (c === null) return;
    if (!estObjet(c)) throw new Error('contenu invalide (un objet « clé: valeur » est attendu).');
    Object.keys(c).forEach(function (k) {
      if (CLES_PARAMETRES.indexOf(k) < 0 && CLES_OBSOLETES.indexOf(k) < 0) {
        throw new Error('clé inconnue « ' + k + ' » (attendues : ' + CLES_PARAMETRES.join(', ') + ').');
      }
    });
    if (c.revalorisation != null && !estObjet(c.revalorisation)) {
      throw new Error('revalorisation doit être un objet (taux, mois).');
    }
    if (c.solde_depart != null) {
      if (!estObjet(c.solde_depart)) throw new Error('solde_depart doit être un objet (' + CLES_SOLDE.join(', ') + ').');
      Object.keys(c.solde_depart).forEach(function (k) {
        if (CLES_SOLDE.indexOf(k) < 0) throw new Error('clé inconnue « solde_depart.' + k + ' » (attendues : ' + CLES_SOLDE.join(', ') + ').');
      });
    }
  }

  async function lire(dir, nom) {
    let handle;
    try {
      handle = await dir.getFileHandle(nom);
    } catch (e) {
      if (e && e.name === 'NotFoundError') return null;
      throw e;
    }
    const texte = await (await handle.getFile()).text();
    if (texte.trim() === '') return null;
    try {
      const v = yaml.load(texte);
      return v === undefined ? null : v;
    } catch (e) {
      throw new Error(nom + ' : YAML invalide (' + e.message.split('\n')[0] + ').');
    }
  }

  async function ecrire(dir, nom, valeur) {
    const texte = yaml.dump(valeur, { lineWidth: -1, noRefs: true });
    const handle = await dir.getFileHandle(nom, { create: true });
    const w = await handle.createWritable();
    await w.write(texte);
    await w.close();
  }

  function enFichier(nom, fn) {
    try { return fn(); } catch (e) { throw new Error(nom + ' : ' + e.message); }
  }

  const NATURES_IMPORT = ['mensuel', 'annuel', 'exceptionnel'];
  const cleLigne = function (nature, l) { return [nature, l.type, String(l.categorie).trim(), String(l.libelle).trim()].join('\u0000'); };

  // paliers.yaml : { paliers: [{ ligne: { nature, type, categorie, libelle }, etapes: [{ depuis, montant | echeances }] }] }
  function validerEntreesPaliers(entrees) {
    const vues = new Set();
    entrees.forEach(function (e, i) {
      try {
        if (!estObjet(e) || !estObjet(e.ligne)) throw new Error('entrée invalide (« ligne » et « etapes » attendus).');
        const g = e.ligne;
        if (NATURES_IMPORT.indexOf(g.nature) < 0) throw new Error('nature invalide : « ' + g.nature + ' » (' + NATURES_IMPORT.join(', ') + ').');
        if (g.type !== 'revenu' && g.type !== 'depense') throw new Error('type invalide : « ' + g.type + ' » (revenu ou depense).');
        if (typeof g.categorie !== 'string' || g.categorie.trim() === '') throw new Error('catégorie manquante.');
        if (typeof g.libelle !== 'string' || g.libelle.trim() === '') throw new Error('libellé manquant.');
        if (!Array.isArray(e.etapes) || e.etapes.length === 0) throw new Error('« etapes » doit être une liste non vide.');
        const cle = cleLigne(g.nature, g);
        if (vues.has(cle)) throw new Error('doublon pour la ligne « ' + g.libelle + ' ».');
        vues.add(cle);
        validerPaliers(e.etapes, g.nature);
      } catch (err) {
        throw new Error('paliers #' + (i + 1) + ' : ' + err.message);
      }
    });
  }

  function validerContenuPaliers(c) {
    if (c === null) return [];
    if (!estObjet(c) || Object.keys(c).some(function (k) { return k !== 'paliers'; })) throw new Error('contenu invalide (un objet « paliers: [...] » est attendu).');
    if (c.paliers == null) return [];
    if (!Array.isArray(c.paliers)) throw new Error('« paliers » doit être une liste.');
    validerEntreesPaliers(c.paliers);
    return c.paliers;
  }

  // Rattache chaque entrée à la première ligne importée correspondante (4 champs, espaces ignorés) ; renvoie les entrées sans ligne.
  // Lenient : une entrée dont le premier `depuis` précède le `debut` de la ligne reste attachée (ignorée par la projection) et produit un avertissement.
  // Une entrée dont la ligne a déjà ses propres paliers est un doublon (erreur).
  function attacherPaliers(donnees, entrees, avertissements) {
    const parCle = new Map();
    NATURES_IMPORT.forEach(function (nature) {
      ((donnees && donnees[nature]) || []).forEach(function (l) {
        const k = cleLigne(nature, l);
        if (!parCle.has(k)) parCle.set(k, l);
      });
    });
    const orphelins = [];
    entrees.forEach(function (e) {
      const l = parCle.get(cleLigne(e.ligne.nature, e.ligne));
      if (!l) { orphelins.push(e); return; }
      if (Array.isArray(l.paliers) && l.paliers.length > 0) throw new Error('doublon de paliers pour la ligne « ' + String(l.libelle).trim() + ' » (' + e.ligne.nature + ').');
      if (avertissements && l.debut && S.monthIndex(e.etapes[0].depuis) <= S.monthIndex(l.debut)) {
        avertissements.push(FICHIERS.paliers + ' : le premier palier de « ' + String(l.libelle).trim() + ' » (' + e.etapes[0].depuis + ') n’est pas postérieur au début de la ligne (' + l.debut + ').');
      }
      l.paliers = e.etapes;
    });
    return orphelins;
  }

  // Entrées de paliers.yaml reconstruites depuis les lignes (les paliers suivent le libellé courant) puis les orphelins.
  function entreesPaliers(donnees, orphelins) {
    const out = [];
    NATURES_IMPORT.forEach(function (nature) {
      ((donnees && donnees[nature]) || []).forEach(function (l) {
        if (!Array.isArray(l.paliers) || l.paliers.length === 0) return;
        out.push({ ligne: { nature: nature, type: l.type, categorie: l.categorie, libelle: l.libelle }, etapes: l.paliers.map(function (p) { return Object.assign({}, p); }) });
      });
    });
    return out.concat(orphelins || []);
  }

  function sansPaliers(donnees) {
    const copie = Object.assign({}, donnees);
    NATURES_IMPORT.forEach(function (nature) {
      if (!Array.isArray(donnees[nature])) return;
      copie[nature] = donnees[nature].map(function (l) { const c = Object.assign({}, l); delete c.paliers; return c; });
    });
    return copie;
  }

  async function loadAll(dir) {
    const donnees = await lire(dir, FICHIERS.donnees);
    if (donnees !== null) enFichier(FICHIERS.donnees, function () { validerDonnees(donnees); });
    if (donnees !== null) {
      NATURES_IMPORT.forEach(function (nature) {
        (donnees[nature] || []).forEach(function (l, i) {
          if (l.paliers != null) throw new Error(FICHIERS.donnees + ' : ' + nature + ' #' + (i + 1) + ' : les paliers des lignes importées se saisissent dans ' + FICHIERS.paliers + '.');
        });
      });
    }
    const brutPaliers = await lire(dir, FICHIERS.paliers);
    const entreesLues = enFichier(FICHIERS.paliers, function () { return validerContenuPaliers(brutPaliers); });
    const avertissements = [];
    const orphelins = enFichier(FICHIERS.paliers, function () { return attacherPaliers(donnees, entreesLues, avertissements); });

    // evenements-futurs.yaml contient les événements et les prêts (nature: pret), séparés à la lecture.
    let brutEv = await lire(dir, FICHIERS.evenements);
    if (brutEv === null) brutEv = [];
    if (!Array.isArray(brutEv)) throw new Error(FICHIERS.evenements + ' : les événements doivent former une liste.');
    const evenements = brutEv.filter(function (l) { return !estPret(l); });
    const prets = brutEv.filter(estPret);
    enFichier(FICHIERS.evenements, function () { validerEvenements(evenements); validerPrets(prets); });

    const brut = await lire(dir, FICHIERS.parametres);
    enFichier(FICHIERS.parametres, function () { validerContenuParametres(brut); });
    const parametres = fusionnerParametres(brut);
    enFichier(FICHIERS.parametres, function () { validerParametres(parametres); });

    return { donnees: donnees, evenements: evenements, prets: prets, parametres: parametres, orphelins: orphelins, avertissements: avertissements };
  }

  // donnees-courantes.yaml est écrit sans `paliers` ; paliers.yaml est regénéré (lignes + orphelins), tout est validé avant la première écriture.
  // Un orphelin dont la clé correspond à une ligne sans paliers (ex. ligne renommée) lui est rattaché et quitte `orphelins` (modifié en place).
  async function saveDonnees(dir, donnees, orphelins) {
    if (Array.isArray(orphelins) && orphelins.length > 0) {
      const restants = enFichier(FICHIERS.paliers, function () { return attacherPaliers(donnees, orphelins.slice()); });
      orphelins.splice(0, orphelins.length, ...restants);
    }
    enFichier(FICHIERS.donnees, function () { validerDonnees(donnees); });
    const entrees = entreesPaliers(donnees, orphelins);
    enFichier(FICHIERS.paliers, function () { validerEntreesPaliers(entrees); });
    await ecrire(dir, FICHIERS.donnees, sansPaliers(donnees));
    let existe = true;
    try { await dir.getFileHandle(FICHIERS.paliers); } catch (e) {
      if (e && e.name === 'NotFoundError') existe = false; else throw e;
    }
    if (entrees.length > 0 || existe) {
      try { await ecrire(dir, FICHIERS.paliers, { paliers: entrees }); } catch (e) { throw new Error(FICHIERS.paliers + ' : ' + e.message); }
    }
  }

  async function saveEvenements(dir, evenements, prets) {
    const lesPrets = (prets || []).map(function (p) { return Object.assign({}, p, { nature: 'pret' }); });
    enFichier(FICHIERS.evenements, function () { validerEvenements(evenements); validerPrets(lesPrets); });
    await ecrire(dir, FICHIERS.evenements, evenements.concat(lesPrets));
  }

  // Historique synthétique des comptes, regénéré après chaque enregistrement (jamais à l'ouverture).
  async function ecrireHistorique(dir, mois, detail) {
    const handle = await dir.getFileHandle(FICHIERS.historique, { create: true });
    const w = await handle.createWritable();
    await w.write(Su.historiqueCsv(mois, detail));
    await w.close();
  }

  async function saveParametres(dir, params) {
    const p = fusionnerParametres(params);
    enFichier(FICHIERS.parametres, function () { validerParametres(p); });
    await ecrire(dir, FICHIERS.parametres, p);
  }

  function supported() {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  const api = {
    FICHIERS: FICHIERS, CATEGORIES_EVENEMENT: CATEGORIES_EVENEMENT, validerLigne: validerLigne,
    loadAll: loadAll, saveDonnees: saveDonnees, saveEvenements: saveEvenements, ecrireHistorique: ecrireHistorique, saveParametres: saveParametres, supported: supported,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
