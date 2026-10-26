(function (root) {
  'use strict';

  // Éléments d'interface communs aux paliers (onglets Mensuel, Annuel & exceptionnel, Revenus et dépenses futurs).
  // Le DOM reste mince : toute la logique est dans tables-logic.js, les écritures dans les onglets.
  const B = root.Budget;

  // Lignes (objets) sans palier dont la case « Palier » est cochée : conservé hors du DOM, les onglets sont redessinés.
  const ouverts = new Set();

  function el(tag, texte, attrs) {
    const e = document.createElement(tag);
    if (texte != null && texte !== '') e.textContent = texte;
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  // Une ligne remplacée par sa copie (édition) ou restaurée (échec d'écriture) garde son état ouvert/fermé.
  function remplacer(ancien, nouveau) {
    if (ouverts.delete(ancien)) ouverts.add(nouveau);
  }

  function oublier(ligne) { ouverts.delete(ligne); }
  function estOuvert(ligne) { return ouverts.has(ligne); }
  function ouvrir(ligne) { ouverts.add(ligne); }
  function reset() { ouverts.clear(); } // nouvelles données chargées : plus aucune ligne ouverte

  // Case « Palier » d'une ligne ; cochée si la ligne a des paliers ou si elle a été ouverte.
  function caseCoche(ligne, cle, onChange) {
    const w = el('label', '', { class: 'case-palier' });
    const c = el('input', '', { type: 'checkbox', 'aria-label': 'Palier — ' + ligne.libelle, 'data-cle': cle + ':palier' });
    c.checked = B.aDesPaliers(ligne) || ouverts.has(ligne);
    c.addEventListener('change', function () { onChange(c.checked); });
    w.appendChild(c);
    w.appendChild(el('span', 'Palier'));
    return w;
  }

  // Cocher / décocher : `appliquer(copie)` écrit la ligne modifiée (suppression des paliers après confirmation).
  function basculer(ligne, coche, appliquer) {
    const a = B.actionBascule(ligne, coche);
    if (a === 'ouvrir') {
      ouverts.add(ligne);
      B.refresh();
    } else if (a === 'masquer') {
      ouverts.delete(ligne);
      B.refresh();
    } else if (root.confirm('Supprimer les ' + ligne.paliers.length + ' palier(s) de la ligne « ' + ligne.libelle + ' » ?')) {
      ouverts.delete(ligne);
      return appliquer(B.retirerPaliers(ligne));
    } else {
      B.refresh(); // la case reprend son état
    }
    return null;
  }

  function afficher(ligne) { return B.aDesPaliers(ligne) || ouverts.has(ligne); }

  // Sous-lignes (<tr>) d'une ligne : un palier par ligne, puis « + ajouter un palier ».
  // cfg : { ligne, nature, cle, nbCols, col: { depuis, montant, fin|null, actions }, aide, creerFin(), onEdit(i, champ, valeur), onAjouter(), onSupprimer(i) }
  function sousLignes(cfg) {
    const ligne = cfg.ligne;
    const out = [];
    if (!afficher(ligne)) return out;
    const ps = ligne.paliers || [];
    const classe = 'palier' + (ligne.actif === false ? ' masque' : '');
    const mensuel = cfg.nature === 'mensuel';
    ps.forEach(function (p, i) {
      const n = i + 1;
      const tr = el('tr', '', { class: classe });
      const tds = [];
      for (let k = 0; k < cfg.nbCols; k++) { const t = el('td'); tds.push(t); tr.appendChild(t); }
      const lib = el('span', '', { class: 'palier-lib' });
      lib.appendChild(B.creerIcone('palier'));
      lib.appendChild(document.createTextNode('palier ' + n));
      tds[0].appendChild(lib);
      tds[cfg.col.depuis].appendChild(el('span', 'à partir de', { class: 'palier-etiq' }));
      const dep = B.champMois(el('input', '', { type: 'text', 'aria-label': 'Palier ' + n + ' à partir de — ' + ligne.libelle, 'data-cle': cfg.cle + ':p' + i + ':depuis' }));
      dep.value = p.depuis == null ? '' : String(p.depuis);
      dep.addEventListener('change', function () { cfg.onEdit(i, 'depuis', dep.value); });
      tds[cfg.col.depuis].appendChild(dep);
      const m = B.montantPalier(p);
      const mont = el('input', '', Object.assign({ type: 'text', 'aria-label': 'Palier ' + n + (mensuel ? ' montant mensuel — ' : ' échéances — ') + ligne.libelle, 'data-cle': cfg.cle + ':p' + i + ':montant' }, cfg.aide || {}));
      if (mensuel) { mont.setAttribute('inputmode', 'decimal'); mont.className = 'num'; tds[cfg.col.montant].className = 'num'; }
      mont.value = m == null ? '' : String(m);
      mont.addEventListener('change', function () { cfg.onEdit(i, 'montant', mont.value); });
      tds[cfg.col.montant].appendChild(mont);
      if (i === ps.length - 1 && cfg.col.fin != null && cfg.creerFin) tds[cfg.col.fin].appendChild(cfg.creerFin());
      tds[cfg.col.actions].className = 'c-act';
      tds[cfg.col.actions].appendChild(B.boutonIcone('corbeille', 'Supprimer le palier ' + n + ' — ' + ligne.libelle, 'Supprimer ce palier', cfg.cle + ':p' + i + ':suppr', function () { cfg.onSupprimer(i); }));
      out.push(tr);
    });
    const tr = el('tr', '', { class: classe + ' palier-ajout' });
    const c = el('td', '', { colspan: String(cfg.nbCols) });
    const b = el('button', '+ ajouter un palier', { type: 'button', class: 'btn-palier', 'aria-label': 'Ajouter un palier — ' + ligne.libelle, 'data-cle': cfg.cle + ':palier+' });
    b.addEventListener('click', function () { cfg.onAjouter(); });
    const contenu = el('div', '', { class: 'colle-gauche' }); // reste visible quand le tableau défile (écran étroit)
    contenu.appendChild(b);
    contenu.appendChild(el('span', '0 = plus rien à partir de cette date', { class: 'palier-aide' }));
    c.appendChild(contenu);
    tr.appendChild(c);
    out.push(tr);
    return out;
  }

  B.paliersUI = { caseCoche: caseCoche, basculer: basculer, sousLignes: sousLignes, remplacer: remplacer, oublier: oublier, estOuvert: estOuvert, ouvrir: ouvrir, reset: reset, afficher: afficher };
})(this);
