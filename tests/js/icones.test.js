const test = require('node:test');
const assert = require('node:assert');
const { ICONES, creerIcone } = require('../../js/icones.js');

const NOMS = ['oeil', 'oeil-barre', 'corbeille', 'palier', 'crayon'];

test('icones : chaque nom attendu a au moins un tracé non vide', () => {
  for (const nom of NOMS) {
    assert.ok(Array.isArray(ICONES[nom]), 'icône absente : ' + nom);
    assert.ok(ICONES[nom].length >= 1, 'aucun tracé : ' + nom);
    for (const d of ICONES[nom]) assert.ok(typeof d === 'string' && d.trim() !== '', 'tracé vide : ' + nom);
  }
});

test('icones : un nom inconnu lève une erreur en français', () => {
  assert.throws(() => creerIcone('licorne'), /Icône inconnue : licorne/);
});

// Faux document minimal : enregistre les éléments créés et refuse innerHTML.
function fauxDocument() {
  const crees = [];
  function noeud(ns, tag) {
    const n = {
      ns, tag, attrs: {}, enfants: [], textContent: '',
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      appendChild(c) { this.enfants.push(c); return c; },
    };
    Object.defineProperty(n, 'innerHTML', { set() { throw new Error('innerHTML interdit'); } });
    crees.push(n);
    return n;
  }
  return {
    crees,
    createElementNS: (ns, tag) => noeud(ns, tag),
    createElement: () => { throw new Error('createElementNS attendu'); },
  };
}

test('icones : SVG construit par createElementNS, décoratif par défaut', () => {
  const doc = fauxDocument();
  global.document = doc;
  try {
    const svg = creerIcone('corbeille');
    assert.strictEqual(svg.tag, 'svg');
    assert.strictEqual(svg.ns, 'http://www.w3.org/2000/svg');
    assert.strictEqual(svg.getAttribute('aria-hidden'), 'true');
    assert.strictEqual(svg.getAttribute('focusable'), 'false');
    const chemins = svg.enfants.filter((e) => e.tag === 'path');
    assert.strictEqual(chemins.length, ICONES.corbeille.length);
    assert.ok(chemins.every((p) => p.ns === 'http://www.w3.org/2000/svg' && p.getAttribute('d')));
    assert.ok(!svg.enfants.some((e) => e.tag === 'title'));
  } finally {
    delete global.document;
  }
});

test('icones : avec un titre, l\'icône est nommée (role img + <title>) et non masquée', () => {
  global.document = fauxDocument();
  try {
    const svg = creerIcone('oeil', { titre: 'Visible' });
    assert.strictEqual(svg.getAttribute('aria-hidden'), null);
    assert.strictEqual(svg.getAttribute('role'), 'img');
    const titre = svg.enfants.find((e) => e.tag === 'title');
    assert.ok(titre, '<title> attendu');
    assert.strictEqual(titre.textContent, 'Visible');
  } finally {
    delete global.document;
  }
});
