(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined';
  const S = isNode ? require('./schedule.js') : root.Budget;
  const P = isNode ? require('./projection.js') : root.Budget;
  const Su = isNode ? require('./summary.js') : root.Budget;
  const Pr = isNode ? require('./prets.js') : root.Budget;
  const yaml = isNode ? require('../vendor/js-yaml.min.js') : root.jsyaml;
  const PARAMETRES_DEFAUT = P.PARAMETRES_DEFAUT;

  const FICHIERS = { donnees: 'donnees-courantes.yaml', evenements: 'evenements-futurs.yaml', parametres: 'parametres.yaml', historique: 'historique-comptes.csv' };
  const CATEGORIES_EVENEMENT = ['Études', 'Prêt', 'Achat', 'Revenu', 'Autre'];
  const NATURES = ['mensuel', 'annuel', 'exceptionnel', 'evenement'];

  function validerMois(v, nom) {
    if (v === null || v === undefined || v === '') return;
    if (typeof v !== 'string') throw new Error(nom + ' invalide : « ' + v + ' » (attendu AAAA-MM).');
    const p = S.parseYm(v);
    if (p.m < 1 || p.m > 12) throw new Error(nom + ' invalide : « ' + v + ' » (mois de 1 à 12).');
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

  async function loadAll(dir) {
    const donnees = await lire(dir, FICHIERS.donnees);
    if (donnees !== null) enFichier(FICHIERS.donnees, function () { validerDonnees(donnees); });

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

    return { donnees: donnees, evenements: evenements, prets: prets, parametres: parametres };
  }

  async function saveDonnees(dir, donnees) {
    enFichier(FICHIERS.donnees, function () { validerDonnees(donnees); });
    await ecrire(dir, FICHIERS.donnees, donnees);
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
