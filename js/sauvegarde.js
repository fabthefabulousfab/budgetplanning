(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined';
  const St = isNode ? require('./store.js') : root.Budget;
  const yaml = isNode ? require('../vendor/js-yaml.min.js') : root.jsyaml;

  const FORMAT = 'budget-sauvegarde';
  const VERSION_FORMAT = 1;
  const APPLICATION = 'budget-previsionnel';
  const TAILLE_MAX = 5 * 1024 * 1024;
  const NOM_DEFAUT = 'sauvegarde';
  // Liste blanche : jamais le CSV (regénéré), jamais un autre nom (pas d'évasion de chemin).
  const FICHIERS_SAUVEGARDE = [St.FICHIERS.donnees, St.FICHIERS.evenements, St.FICHIERS.parametres, St.FICHIERS.paliers];

  const estObjet = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };

  async function lireBrut(dir, nom) {
    let handle;
    try {
      handle = await dir.getFileHandle(nom);
    } catch (e) {
      if (e && e.name === 'NotFoundError') return null;
      throw e;
    }
    return (await handle.getFile()).text();
  }

  function nomFichierSauvegarde(nom, maintenant) {
    const propre = String(nom == null ? '' : nom)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '');
    const jour = (maintenant || new Date()).toISOString().slice(0, 10);
    return 'budget-' + (propre || NOM_DEFAUT) + '-' + jour + '.yaml';
  }

  async function exporterSauvegarde(dir, options) {
    const o = options || {};
    const maintenant = o.maintenant || new Date();
    const nom = typeof o.nom === 'string' && o.nom.trim() !== '' ? o.nom.trim() : NOM_DEFAUT;
    const fichiers = {};
    for (const f of FICHIERS_SAUVEGARDE) {
      const t = await lireBrut(dir, f);
      if (t !== null) fichiers[f] = t;
    }
    if (!(St.FICHIERS.donnees in fichiers)) throw new Error('Rien à exporter : ' + St.FICHIERS.donnees + ' est introuvable dans ce dossier.');
    const doc = { format: FORMAT, version_format: VERSION_FORMAT, application: APPLICATION, exporte_le: maintenant.toISOString(), nom: nom, fichiers: fichiers };
    const texte = yaml.dump(doc, { lineWidth: -1, noRefs: true });
    return { texte: texte, nomFichier: nomFichierSauvegarde(nom, maintenant) };
  }

  function controlerFichiers(fichiers) {
    if (!estObjet(fichiers)) throw new Error('Sauvegarde invalide : la section « fichiers » est absente ou n’est pas une liste de fichiers.');
    let total = 0;
    Object.keys(fichiers).forEach(function (k) {
      if (FICHIERS_SAUVEGARDE.indexOf(k) < 0) throw new Error('Sauvegarde invalide : fichier non autorisé « ' + k + ' ».');
      if (typeof fichiers[k] !== 'string') throw new Error('Sauvegarde invalide : le contenu de « ' + k + ' » doit être un texte.');
      total += fichiers[k].length;
    });
    if (total > TAILLE_MAX) throw new Error('Sauvegarde invalide : sauvegarde trop volumineuse (5 Mo au maximum).');
    if (!(St.FICHIERS.donnees in fichiers)) throw new Error('Sauvegarde invalide : ' + St.FICHIERS.donnees + ' est absent de la sauvegarde.');
  }

  // Dossier en mémoire (même interface que le dossier réel) pour réutiliser loadAll tel quel.
  function dossierMemoire(fichiers) {
    return {
      async getFileHandle(nom) {
        if (!Object.prototype.hasOwnProperty.call(fichiers, nom)) { const e = new Error('absent'); e.name = 'NotFoundError'; throw e; }
        return { async getFile() { return { async text() { return fichiers[nom]; } }; } };
      },
    };
  }

  async function lireSauvegarde(texte) {
    if (typeof texte !== 'string' || texte.length > 2 * TAILLE_MAX) throw new Error('Sauvegarde invalide : fichier trop volumineux ou illisible (5 Mo au maximum).');
    let doc;
    try {
      doc = yaml.load(texte);
    } catch (e) {
      throw new Error('Sauvegarde invalide : ce fichier n’est pas un YAML valide (' + e.message.split('\n')[0] + ').');
    }
    if (!estObjet(doc) || doc.format !== FORMAT) throw new Error('Sauvegarde invalide : ce fichier n’est pas une sauvegarde du budget prévisionnel.');
    if (typeof doc.version_format !== 'number' || !Number.isInteger(doc.version_format) || doc.version_format < 1) {
      throw new Error('Sauvegarde invalide : version_format manquant ou incorrect.');
    }
    if (doc.version_format > VERSION_FORMAT) throw new Error('Sauvegarde invalide : elle a été créée par une version plus récente de l’application.');
    controlerFichiers(doc.fichiers);
    try {
      await St.loadAll(dossierMemoire(doc.fichiers));
    } catch (e) {
      throw new Error('Sauvegarde invalide : ' + e.message);
    }
    const exporteLe = doc.exporte_le instanceof Date ? doc.exporte_le.toISOString() : (typeof doc.exporte_le === 'string' ? doc.exporte_le : '');
    return { nom: typeof doc.nom === 'string' ? doc.nom : NOM_DEFAUT, exporteLe: exporteLe, fichiers: Object.assign({}, doc.fichiers) };
  }

  async function importerSauvegarde(sauvegarde, dirCible, options) {
    const fichiers = sauvegarde && sauvegarde.fichiers;
    controlerFichiers(fichiers); // revalidé : on n'écrit jamais hors de la liste blanche
    const noms = FICHIERS_SAUVEGARDE.filter(function (f) { return f in fichiers; });
    const existants = [];
    for (const n of noms) {
      if ((await lireBrut(dirCible, n)) !== null) existants.push(n);
    }
    if (existants.length > 0) {
      const confirmer = options && options.confirmerRemplacement;
      const ok = typeof confirmer === 'function' ? await confirmer(existants.slice()) : false;
      if (ok !== true) {
        const e = new Error('Import annulé : aucun fichier n’a été modifié.');
        e.annule = true;
        throw e;
      }
    }
    for (const n of noms) {
      const handle = await dirCible.getFileHandle(n, { create: true });
      const w = await handle.createWritable();
      await w.write(fichiers[n]);
      await w.close();
    }
    return { ecrits: noms };
  }

  const api = { exporterSauvegarde: exporterSauvegarde, lireSauvegarde: lireSauvegarde, importerSauvegarde: importerSauvegarde, nomFichierSauvegarde: nomFichierSauvegarde };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
