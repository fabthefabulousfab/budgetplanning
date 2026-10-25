(function (root) {
  'use strict';

  // Visite guidée : bulles de texte et cadre animé autour des vrais éléments de la page.
  // Les textes sont dans visite-textes.js ; chaque étape désigne sa cible par une clé `data-aide`.
  // Le moteur ne modifie jamais les données : il n'ajoute que sa propre couche au-dessus de la page.
  const ECART = 12; // espace entre la cible et la bulle
  const MARGE = 8; // marge minimale avec les bords de la fenêtre
  const LARGEUR_ETROITE = 640; // en dessous : bulle ancrée en bas de l'écran

  // ---- Logique pure (testée sous Node) ---------------------------------------------------------

  // Étapes dont la cible existe (`existe(cle)` → booléen), dans l'ordre d'origine.
  function etapesDisponibles(etapes, existe) {
    return (etapes || []).filter(function (e) { return existe(e.cible); });
  }

  // Place la bulle : sous la cible si elle tient, sinon au-dessus, sinon ancrée en bas ; toujours dans la
  // fenêtre et sous l'en-tête collant (margeEntete = bas de l'en-tête). Écran étroit : ancrée en bas.
  // rectCible : { top, left, width, height } (bottom/right facultatifs) ; tailleBulle : { width, height }.
  function positionBulle(rectCible, tailleBulle, viewport, margeEntete) {
    const haut = (margeEntete || 0) + MARGE;
    const bornes = function (v, min, max) { return Math.max(min, Math.min(v, max)); };
    const bas = Math.max(haut, viewport.height - tailleBulle.height - MARGE);
    if (viewport.width < LARGEUR_ETROITE) {
      return { top: bas, left: bornes((viewport.width - tailleBulle.width) / 2, 0, Math.max(0, viewport.width - tailleBulle.width)), placement: 'bas' };
    }
    const r = rectCible;
    const bordBas = r.bottom != null ? r.bottom : r.top + r.height;
    const left = bornes(r.left + r.width / 2 - tailleBulle.width / 2, MARGE, Math.max(MARGE, viewport.width - tailleBulle.width - MARGE));
    const dessous = bordBas + ECART;
    if (dessous + tailleBulle.height <= viewport.height - MARGE) {
      return { top: Math.max(dessous, haut), left: left, placement: 'dessous' };
    }
    const dessus = r.top - ECART - tailleBulle.height;
    if (dessus >= haut) return { top: dessus, left: left, placement: 'dessus' };
    return { top: bas, left: left, placement: 'bas' };
  }

  const api = { etapesDisponibles: etapesDisponibles, positionBulle: positionBulle };
  if (typeof module !== 'undefined') { module.exports = api; return; }
  root.Budget = Object.assign(root.Budget || {}, api);
  if (typeof document === 'undefined') return;

  // ---- Interface (navigateur) ------------------------------------------------------------------

  const B = root.Budget;
  const MARGE_CADRE = 6;
  let session = null;

  function el(tag, texte, attrs) {
    const e = document.createElement(tag);
    if (texte) e.textContent = texte;
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  // Les onglets masqués gardent leur dernier dessin : la même clé peut y exister aussi, on prend l'élément affiché.
  function cible(cle) {
    const c = root.CSS && root.CSS.escape ? root.CSS.escape(cle) : cle;
    const tous = Array.from(document.querySelectorAll('[data-aide="' + c + '"]'));
    return tous.find(function (n) { return n.getClientRects().length > 0; }) || tous[0] || null;
  }

  function existe(cle) {
    const n = cible(cle);
    return !!n && n.getClientRects().length > 0; // absent ou masqué : étape sautée
  }

  function viewport() {
    return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
  }

  function margeEntete() {
    const e = document.querySelector('.entete');
    return e ? Math.max(0, e.getBoundingClientRect().bottom) : 0;
  }

  function idOnglet() {
    const accueil = document.getElementById('accueil');
    if (!accueil || !accueil.hidden || !B.ongletActif) return 'accueil';
    return B.ongletActif() || 'accueil';
  }

  // ---- Affichage d'une étape -------------------------------------------------------------------

  function placer(n, animer) {
    const s = session;
    const r = n.getBoundingClientRect();
    const cadre = s.cadre.style;
    const boite = [r.top, r.left, r.width, r.height].join(',');
    // Même boîte qu'au dernier placement (ex. évènement de défilement déclenché par le saut vers la cible) :
    // on ne touche pas au cadre, pour ne pas couper la glissade en cours.
    if (boite !== s.boite) {
      s.boite = boite;
      if (!animer) cadre.transition = 'none';
      cadre.top = (r.top - MARGE_CADRE) + 'px';
      cadre.left = (r.left - MARGE_CADRE) + 'px';
      cadre.width = (r.width + 2 * MARGE_CADRE) + 'px';
      cadre.height = (r.height + 2 * MARGE_CADRE) + 'px';
      if (!animer) { void s.cadre.offsetWidth; cadre.transition = ''; }
    }
    const vp = viewport();
    s.bulle.style.width = vp.width < LARGEUR_ETROITE ? (vp.width - 2 * MARGE) + 'px' : '';
    const pos = positionBulle(r, { width: s.bulle.offsetWidth, height: s.bulle.offsetHeight }, vp, margeEntete());
    s.bulle.style.top = pos.top + 'px';
    s.bulle.style.left = pos.left + 'px';
    s.bulle.setAttribute('data-placement', pos.placement);
    return pos;
  }

  // Bulle ancrée en bas : la cible est remontée pour rester visible au-dessus de la bulle.
  function degager(n, pos) {
    if (pos.placement !== 'bas') return false;
    const r = n.getBoundingClientRect();
    const haut = margeEntete() + MARGE;
    const libre = pos.top - ECART - haut;
    let delta = 0;
    if (r.height <= libre) delta = r.top + r.height / 2 - (haut + libre / 2);
    else if (r.top < haut || r.top > haut + MARGE) delta = r.top - haut;
    if (Math.abs(delta) < 1) return false;
    root.scrollBy(0, delta);
    return true;
  }

  function defiler(n) {
    if (n.closest('.entete')) return; // l'en-tête est collant : rien à défiler
    const hauteurUtile = viewport().height - margeEntete() - 2 * MARGE;
    const haut = n.getBoundingClientRect().height > hauteurUtile;
    n.scrollIntoView({ block: haut ? 'start' : 'center', inline: 'nearest', behavior: 'auto' });
    if (haut) root.scrollBy(0, -(margeEntete() + MARGE));
  }

  function afficher(dispo, idx, premier) {
    const s = session;
    const etape = dispo[idx];
    const n = cible(etape.cible);
    s.courante = etape.cible;
    s.titre.textContent = etape.titre;
    s.texte.textContent = etape.texte;
    s.compteur.textContent = (idx + 1) + ' / ' + dispo.length;
    s.precedent.hidden = idx === 0;
    s.suivant.textContent = idx === dispo.length - 1 ? 'Terminer' : 'Suivant';
    s.bulle.classList.remove('visible');
    void s.bulle.offsetWidth;
    s.bulle.classList.add('visible');
    defiler(n);
    let pos = placer(n, !premier);
    if (degager(n, pos)) pos = placer(n, true);
    if (document.activeElement === document.body || !s.bulle.contains(document.activeElement) || document.activeElement.hidden) s.suivant.focus();
  }

  // Étapes disponibles maintenant ; `sens` : +1 suivant, -1 précédent, 0 rester (ou reprendre au plus proche).
  function aller(sens) {
    const s = session;
    if (!s) return;
    const dispo = etapesDisponibles(s.toutes, existe);
    if (!dispo.length) { fermer(); return; }
    const pos = s.courante ? dispo.findIndex(function (e) { return e.cible === s.courante; }) : -1;
    let idx;
    if (pos >= 0) {
      idx = pos + sens;
    } else {
      // L'étape courante a disparu : on reprend à la première étape disponible qui la suivait.
      const rang = s.toutes.findIndex(function (e) { return e.cible === s.courante; });
      const avant = dispo.filter(function (e) { return s.toutes.indexOf(e) < rang; }).length;
      idx = rang < 0 ? 0 : avant + (sens < 0 ? -1 : 0);
    }
    if (idx >= dispo.length) { fermer(); return; }
    afficher(dispo, Math.max(0, idx), !s.courante);
  }

  function repositionner() {
    const s = session;
    if (!s) return;
    const n = s.courante ? cible(s.courante) : null;
    if (!n || n.getClientRects().length === 0) { aller(0); return; }
    // Le compteur suit les étapes réellement disponibles (une cible a pu apparaître ou disparaître).
    const dispo = etapesDisponibles(s.toutes, existe);
    const idx = dispo.findIndex(function (e) { return e.cible === s.courante; });
    if (idx >= 0) {
      s.compteur.textContent = (idx + 1) + ' / ' + dispo.length;
      s.suivant.textContent = idx === dispo.length - 1 ? 'Terminer' : 'Suivant';
      s.precedent.hidden = idx === 0;
    }
    placer(n, false);
  }

  function planifier() {
    if (!session || session.attente) return;
    session.attente = root.requestAnimationFrame(function () {
      if (!session) return;
      session.attente = 0;
      repositionner();
    });
  }

  // ---- Clavier, ouverture, fermeture -----------------------------------------------------------

  function surTouche(ev) {
    const s = session;
    if (!s) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      fermer();
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      ev.stopPropagation();
      aller(1);
    } else if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      ev.stopPropagation();
      aller(-1);
    } else if (ev.key === 'Tab') {
      // Le focus reste dans la bulle (fenêtre modale).
      const f = Array.from(s.bulle.querySelectorAll('button')).filter(function (b) { return !b.hidden; });
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      ev.preventDefault();
      f[i < 0 ? 0 : (i + (ev.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }

  const ZONES_BLOQUEES = ['app', 'onglets', 'bandeau', 'avertissements'];

  function lancer() {
    if (session) return;
    const textes = B.textesVisite || {};
    const toutes = textes[idOnglet()] || [];
    if (!etapesDisponibles(toutes, existe).length) return;

    const racine = el('div', '', { class: 'visite' });
    const voile = el('div', '', { class: 'visite-voile' });
    ['mousedown', 'click'].forEach(function (t) { voile.addEventListener(t, function (ev) { ev.preventDefault(); ev.stopPropagation(); }); });
    const cadre = el('div', '', { class: 'visite-cadre', 'aria-hidden': 'true' });
    const bulle = el('div', '', { class: 'visite-bulle', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'visite-titre', 'aria-describedby': 'visite-texte' });
    const fermerBtn = el('button', '×', { type: 'button', class: 'visite-fermer', 'aria-label': 'Fermer la visite guidée', title: 'Fermer (Échap)' });
    const titre = el('h2', '', { id: 'visite-titre', class: 'visite-titre' });
    const texte = el('p', '', { id: 'visite-texte', class: 'visite-texte' });
    const pied = el('div', '', { class: 'visite-pied' });
    const compteur = el('span', '', { class: 'visite-compteur', 'aria-live': 'polite' });
    const boutons = el('div', '', { class: 'visite-boutons' });
    const precedent = el('button', 'Précédent', { type: 'button', class: 'visite-btn' });
    const suivant = el('button', 'Suivant', { type: 'button', class: 'visite-btn visite-btn-principal' });
    boutons.appendChild(precedent);
    boutons.appendChild(suivant);
    pied.appendChild(compteur);
    pied.appendChild(boutons);
    [fermerBtn, titre, texte, pied].forEach(function (n) { bulle.appendChild(n); });
    [voile, cadre, bulle].forEach(function (n) { racine.appendChild(n); });

    const bouton = document.getElementById('bouton-aide');
    session = { toutes: toutes, courante: null, racine: racine, cadre: cadre, bulle: bulle, titre: titre, texte: texte, compteur: compteur, precedent: precedent, suivant: suivant, bouton: bouton, attente: 0, observateurs: [], inertes: [] };

    fermerBtn.addEventListener('click', fermer);
    precedent.addEventListener('click', function () { aller(-1); });
    suivant.addEventListener('click', function () { aller(1); });
    document.addEventListener('keydown', surTouche, true);
    root.addEventListener('resize', planifier);
    document.addEventListener('scroll', planifier, true);
    // Un onglet redessiné pendant la visite remplace ses éléments : on retrouve la cible par sa clé.
    if (root.MutationObserver) {
      const app = document.getElementById('app');
      const mo = new root.MutationObserver(planifier);
      mo.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
      session.observateurs.push(mo);
    }
    if (root.ResizeObserver) {
      const ro = new root.ResizeObserver(planifier);
      ro.observe(document.body);
      session.observateurs.push(ro);
    }
    ZONES_BLOQUEES.forEach(function (id) {
      const z = document.getElementById(id);
      if (z && !z.hasAttribute('inert')) { z.setAttribute('inert', ''); session.inertes.push(z); }
    });
    document.body.appendChild(racine);
    aller(0);
    if (session) session.suivant.focus();
  }

  function fermer() {
    const s = session;
    if (!s) return;
    session = null;
    document.removeEventListener('keydown', surTouche, true);
    root.removeEventListener('resize', planifier);
    document.removeEventListener('scroll', planifier, true);
    if (s.attente) root.cancelAnimationFrame(s.attente);
    s.observateurs.forEach(function (o) { o.disconnect(); });
    s.inertes.forEach(function (z) { z.removeAttribute('inert'); });
    s.racine.remove();
    if (s.bouton) s.bouton.focus();
  }

  function init() {
    const bouton = document.getElementById('bouton-aide');
    if (!bouton) return;
    bouton.setAttribute('data-aide', 'bouton-aide');
    bouton.addEventListener('click', lancer);
  }

  B.visite = { lancer: lancer, fermer: fermer };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(this);
