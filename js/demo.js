(function (root) {
  'use strict';

  // Budget de démonstration : une famille fictive, tenue entièrement en mémoire (rien n'est lu ni écrit sur l'ordinateur).
  // Les dates sont calculées par rapport à « maintenant » pour rester crédibles quel que soit le jour d'ouverture.
  const isNode = typeof module !== 'undefined';
  const S = isNode ? require('./schedule.js') : root.Budget;
  const Ca = isNode ? require('./categories.js') : root.Budget;
  const St = isNode ? require('./store.js') : root.Budget;
  const yaml = isNode ? require('../vendor/js-yaml.min.js') : root.jsyaml;

  const F = St.FICHIERS;
  const NOMS = [F.donnees, F.evenements, F.parametres, F.paliers];

  function moisCourant(maintenant) {
    return maintenant.getFullYear() + '-' + String(maintenant.getMonth() + 1).padStart(2, '0'); // heure locale
  }

  // Contenu des quatre fichiers (objets) pour le mois de départ donné.
  function contenu(maintenant) {
    const depart = moisCourant(maintenant);
    const idx = S.monthIndex(depart);
    const plus = function (n) { return S.fromIndex(idx + n); };
    const unefois = function (n, montant) { const d = S.parseYm(plus(n)); return d.y + '-' + d.m + '-' + montant; };
    const copie = function (liste) { return liste.slice(); }; // la liste par défaut n'est jamais partagée

    const donnees = {
      situation: { compte_courant: 3200, epargne: 18000 },
      mensuel: [
        { type: 'revenu', categorie: 'Salaires', libelle: 'Salaire de Camille', montant: 2150, taux_revalorisation: 1.8 },
        { type: 'revenu', categorie: 'Salaires', libelle: 'Salaire d’Alex', montant: 1850, taux_revalorisation: 1.2 },
        { type: 'revenu', categorie: 'Allocations', libelle: 'Allocations familiales', montant: 145 },
        { type: 'depense', categorie: 'Logement', libelle: 'Énergie et eau', montant: 160, revalorise: true },
        { type: 'depense', categorie: 'Alimentation', libelle: 'Courses', montant: 720, revalorise: true },
        { type: 'depense', categorie: 'Transport', libelle: 'Carburant et entretien', montant: 200, revalorise: true },
        { type: 'depense', categorie: 'Vêtements', libelle: 'Vêtements', montant: 90 },
        { type: 'depense', categorie: 'Abonnements', libelle: 'Internet et téléphones', montant: 60 },
        { type: 'depense', categorie: 'Assurances', libelle: 'Assurances habitation et auto', montant: 115, revalorise: true },
        { type: 'depense', categorie: 'Santé', libelle: 'Mutuelle', montant: 90 },
        { type: 'depense', categorie: 'Impôts et taxes', libelle: 'Impôt sur le revenu (mensualisé)', montant: 140 },
        { type: 'depense', categorie: 'Enfants et éducation', libelle: 'Cantine et activités', montant: 220 },
        { type: 'depense', categorie: 'Loisirs', libelle: 'Sorties et loisirs', montant: 240, revalorise: true },
        { type: 'depense', categorie: 'Loisirs', libelle: 'Salle de sport', montant: 38, actif: false },
      ],
      annuel: [
        { type: 'depense', categorie: 'Impôts et taxes', libelle: 'Taxe foncière', echeances: '10-1100', revalorise: true },
        { type: 'depense', categorie: 'Loisirs', libelle: 'Vacances d’été', echeances: '7-2200', revalorise: true },
        { type: 'depense', categorie: 'Cadeaux', libelle: 'Cadeaux de fin d’année', echeances: '12-400' },
        { type: 'revenu', categorie: 'Primes', libelle: 'Prime annuelle de Camille', echeances: '12-1800', taux_revalorisation: 1.8 },
      ],
      exceptionnel: [
        { type: 'depense', categorie: 'Logement', libelle: 'Remplacement de la chaudière', echeances: unefois(5, 2800) },
      ],
    };

    const evenements = [
      { id: 'demo-etudes', type: 'depense', categorie: 'Études', libelle: 'Études supérieures de l’aîné', montant: 380, debut: plus(72), fin: plus(107) },
      { id: 'demo-voiture', type: 'depense', categorie: 'Achat', libelle: 'Achat d’une voiture', echeances: unefois(20, 14000) },
      { id: 'pret-immobilier', nature: 'pret', statut: 'en_cours', libelle: 'Crédit immobilier', mensualite: 1150, fin: plus(168) },
      { id: 'pret-voiture', nature: 'pret', statut: 'simule', libelle: 'Prêt pour la voiture', montant: 14000, mise_a_disposition: plus(20), duree_mois: 48, differe_mois: 0, taux: 4.5 },
    ];

    const parametres = {
      depart: depart,
      horizon_annees: 15,
      revalorisation: { taux: 0.02, mois: 1 },
      solde_depart: { compte_courant: null, epargne: null },
      categories: { depense: copie(Ca.CATEGORIES_DEFAUT.depense), revenu: copie(Ca.CATEGORIES_DEFAUT.revenu) },
    };

    const paliers = {
      paliers: [
        { ligne: { nature: 'mensuel', type: 'depense', categorie: 'Alimentation', libelle: 'Courses' }, etapes: [{ depuis: plus(12), montant: 790 }, { depuis: plus(96), montant: 620 }] },
      ],
    };

    return { donnees: donnees, evenements: evenements, parametres: parametres, paliers: paliers };
  }

  // Textes YAML des quatre fichiers, par nom de fichier.
  function fichiersDemo(maintenant) {
    const c = contenu(maintenant || new Date());
    const dump = function (v) { return yaml.dump(v, { lineWidth: -1, noRefs: true }); };
    return { [F.donnees]: dump(c.donnees), [F.evenements]: dump(c.evenements), [F.parametres]: dump(c.parametres), [F.paliers]: dump(c.paliers) };
  }

  function erreurAbsent(nom) {
    const e = new Error('Fichier introuvable : ' + nom);
    e.name = 'NotFoundError';
    return e;
  }

  // Dossier en mémoire respectant le seam DirHandle : getFileHandle(nom, { create }) -> { getFile(), createWritable() }.
  function dossierDemo(maintenant) {
    const textes = new Map(Object.entries(fichiersDemo(maintenant)));
    return {
      name: 'Démo',
      demo: true,
      async getFileHandle(nom, options) {
        if (!textes.has(nom) && !(options && options.create)) throw erreurAbsent(nom);
        return {
          async getFile() {
            if (!textes.has(nom)) throw erreurAbsent(nom);
            return { async text() { return textes.get(nom); } };
          },
          async createWritable() {
            let tampon = '';
            return {
              async write(s) { tampon += s; },
              async close() { textes.set(nom, tampon); },
            };
          },
        };
      },
      async *values() {
        for (const nom of textes.keys()) yield { name: nom, kind: 'file' };
      },
    };
  }

  const api = { fichiersDemo: fichiersDemo, dossierDemo: dossierDemo, DEMO_FICHIERS: fichiersDemo(new Date()), NOMS_DEMO: NOMS };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
