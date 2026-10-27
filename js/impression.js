(function (root) {
  'use strict';

  // Impression : un champ de saisie ne passe pas à la ligne et coupe les valeurs longues. Le temps de l'impression,
  // chaque champ des relevés reçoit un texte jumeau (span.valeur-impression, texte brut) que css/impression.css affiche
  // à la place du champ. Rien ne change à l'écran : les jumeaux sont retirés dès la fin de l'impression.
  const SELECTEUR = 'table.releve input[type="text"], table.releve select';
  const CLASSE = 'valeur-impression';

  // Texte à imprimer pour un champ : sa valeur, à défaut son texte d'exemple (« — » des mois vides) ; liste : l'option choisie.
  function valeurAffichee(noeud) {
    if (!noeud || !noeud.tagName) return null;
    const tag = String(noeud.tagName).toUpperCase();
    if (tag === 'SELECT') {
      const o = noeud.options && noeud.options[noeud.selectedIndex];
      return o ? String(o.textContent) : '';
    }
    if (tag === 'INPUT' && (!noeud.type || noeud.type === 'text')) {
      if (noeud.value !== '' && noeud.value != null) return String(noeud.value);
      const vide = noeud.getAttribute ? noeud.getAttribute('data-vide-impression') : null; // exemple (« 0 ») à ne pas imprimer comme une valeur
      return vide != null ? String(vide) : String(noeud.getAttribute ? noeud.getAttribute('placeholder') || '' : '');
    }
    return null;
  }

  const api = { valeurAffichee: valeurAffichee, SELECTEUR: SELECTEUR, CLASSE: CLASSE };
  if (typeof module !== 'undefined') { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  const B = root.Budget = Object.assign(root.Budget || {}, api);

  function nettoyer(racine) {
    Array.from((racine || document).querySelectorAll('.' + CLASSE)).forEach(function (s) { s.remove(); });
  }

  function preparer(racine) {
    const r = racine || document;
    nettoyer(r); // jamais de doublon, même si l'événement arrive deux fois
    Array.from(r.querySelectorAll(SELECTEUR)).forEach(function (champ) {
      const s = document.createElement('span');
      s.className = CLASSE + (champ.classList.contains('num') ? ' num' : '');
      s.textContent = valeurAffichee(champ); // texte brut, jamais de HTML
      champ.insertAdjacentElement('afterend', s);
    });
  }

  let enImpression = false;
  function commencer() { enImpression = true; preparer(document); }
  function finir() { enImpression = false; nettoyer(document); }

  // Un onglet redessiné pendant l'impression (changement de thème des graphiques, par exemple) repart sans jumeaux.
  function siImpression(racine) { if (enImpression) preparer(racine); }

  root.addEventListener('beforeprint', commencer);
  root.addEventListener('afterprint', finir);
  // Navigateurs qui émulent l'impression (outils de développement) : seul le média change.
  const m = typeof root.matchMedia === 'function' ? root.matchMedia('print') : null;
  if (m && typeof m.addEventListener === 'function') m.addEventListener('change', function (ev) { if (ev.matches) commencer(); else finir(); });
  if (m && m.matches) commencer();

  B.impression = { preparer: preparer, nettoyer: nettoyer, siImpression: siImpression };
})(this);
