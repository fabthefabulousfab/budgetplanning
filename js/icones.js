(function (root) {
  'use strict';

  // Petites icônes au trait (grille 24 × 24, couleur du texte) : œil, œil barré, corbeille, palier.
  // Construites élément par élément (createElementNS), jamais par innerHTML.
  const SVG = 'http://www.w3.org/2000/svg';
  const ICONES = {
    oeil: [
      'M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12z',
      'M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5z',
    ],
    'oeil-barre': [
      'M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12z',
      'M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5z',
      'M4 4l16 16',
    ],
    corbeille: [
      'M4.5 7h15',
      'M9.5 7V4.75h5V7',
      'M6.5 7l.85 11.9a1.6 1.6 0 0 0 1.6 1.5h6.1a1.6 1.6 0 0 0 1.6-1.5L17.5 7',
      'M10.25 10.75v6',
      'M13.75 10.75v6',
    ],
    palier: [
      'M3.5 19h5.5v-5h5.5V9h6',
    ],
  };

  // options.titre : icône porteuse de sens (role="img" + <title>) ; sans titre, elle est décorative (aria-hidden).
  function creerIcone(nom, options) {
    if (!Object.prototype.hasOwnProperty.call(ICONES, nom)) throw new Error('Icône inconnue : ' + nom);
    const titre = options && options.titre;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('class', 'icone icone-' + nom);
    svg.setAttribute('focusable', 'false');
    if (titre) {
      svg.setAttribute('role', 'img');
      const t = document.createElementNS(SVG, 'title');
      t.textContent = titre;
      svg.appendChild(t);
    } else {
      svg.setAttribute('aria-hidden', 'true');
    }
    ICONES[nom].forEach(function (d) {
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '1.75');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
    });
    return svg;
  }

  const api = { ICONES: ICONES, creerIcone: creerIcone };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
