const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { echelonner } = require('../../js/graphiques.js');

const racine = path.join(__dirname, '..', '..');
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
const FICHIERS = ['css/mouvement.css', 'css/style.css'];
const REDUIT = '@media (prefers-reduced-motion: reduce)';

// Aplatit une feuille de style en regles { selecteur, corps, reduit } (les @media sont parcourus, les @keyframes ignores).
function regles(source, reduit) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const sortie = [];
  let i = 0;
  while (i < css.length) {
    const ouvre = css.indexOf('{', i);
    if (ouvre < 0) break;
    const tete = css.slice(i, ouvre).trim();
    let prof = 1;
    let j = ouvre + 1;
    for (; j < css.length && prof > 0; j++) {
      if (css[j] === '{') prof++;
      else if (css[j] === '}') prof--;
    }
    const corps = css.slice(ouvre + 1, j - 1);
    if (tete.startsWith('@media')) {
      sortie.push(...regles(corps, reduit || tete.replace(/\s+/g, ' ').startsWith(REDUIT)));
    } else if (!tete.startsWith('@')) {
      tete.split(',').forEach((s) => sortie.push({ selecteur: s.trim().replace(/\s+/g, ' '), corps, reduit: !!reduit }));
    }
    i = j;
  }
  return sortie;
}

const declare = (corps, prop) => new RegExp('(^|[;\\s])' + prop + '\\s*:\\s*([^;]+)', 'i').exec(corps);
const anime = (corps) => { const m = declare(corps, 'animation'); return !!m && !/^none\b/.test(m[2].trim()); };
const transitionne = (corps) => { const m = declare(corps, 'transition'); return !!m && !/^none\b/.test(m[2].trim()); };
const neutre = (corps, prop) => { const m = declare(corps, prop); return !!m && /^(none|0s?\b|0ms)/.test(m[2].trim()); };

for (const f of FICHIERS) {
  test(f + ' : tout ce qui s\'anime est neutralise sous prefers-reduced-motion', () => {
    const source = lire(f);
    const toutes = regles(source);
    const animantes = toutes.filter((r) => !r.reduit && (anime(r.corps) || transitionne(r.corps)));
    const aKeyframes = /@keyframes/.test(source);
    if (!animantes.length && !aKeyframes) return;
    assert.ok(source.includes(REDUIT), f + ' : bloc ' + REDUIT + ' absent');
    const reduites = toutes.filter((r) => r.reduit);
    assert.ok(reduites.length, f + ' : bloc de mouvement reduit vide');
    for (const r of animantes) {
      // Couvert par une regle du meme selecteur, ou par le filet de securite universel (*, *::before, *::after).
      const pseudo = /::(before|after)$/.exec(r.selecteur);
      const universel = pseudo ? '*::' + pseudo[1] : '*';
      const trouvees = reduites.filter((x) => x.selecteur === r.selecteur || x.selecteur === universel);
      assert.ok(trouvees.length, f + ' : ' + r.selecteur + ' anime mais n\'est pas neutralise');
      if (anime(r.corps)) assert.ok(trouvees.some((x) => neutre(x.corps, 'animation')), f + ' : animation de ' + r.selecteur + ' non neutralisee');
      if (transitionne(r.corps)) assert.ok(trouvees.some((x) => neutre(x.corps, 'transition')), f + ' : transition de ' + r.selecteur + ' non neutralisee');
    }
  });
}

test('la visite guidee (cadre, pulsation, bulle) est couverte par le mouvement reduit', () => {
  const reduites = regles(lire('css/style.css')).filter((r) => r.reduit);
  for (const sel of ['.visite-cadre', '.visite-cadre::after', '.visite-bulle']) {
    const r = reduites.filter((x) => x.selecteur === sel);
    assert.ok(r.length, sel + ' absent du bloc de mouvement reduit');
    if (sel.endsWith('::after')) assert.ok(r.some((x) => neutre(x.corps, 'animation')), sel + ' : animation non neutralisee');
    else assert.ok(r.some((x) => neutre(x.corps, 'transition')), sel + ' : transition non neutralisee');
  }
});

test('mouvement reduit : aucune transformation ni delai ne subsiste pour la classe entree', () => {
  const reduites = regles(lire('css/mouvement.css')).filter((r) => r.reduit);
  const r = reduites.filter((x) => x.selecteur === '.entree');
  assert.ok(r.length && r.some((x) => neutre(x.corps, 'animation')), '.entree doit etre neutralisee');
});

test('css/mouvement.css : pas de couleur en dur, charge apres style.css, durees par variables', () => {
  const css = lire('css/mouvement.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepStrictEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g), null, 'code couleur en dur dans mouvement.css');
  const html = lire('index.html');
  const a = html.indexOf('css/style.css');
  const b = html.indexOf('css/mouvement.css');
  assert.ok(a > 0 && b > a, 'mouvement.css doit etre charge apres style.css');
  assert.match(css, /var\(--duree-(courte|longue)\)/);
  assert.match(css, /@keyframes entree/);
  assert.match(css, /--i\b/);
});

test('l\'impression est une feuille a part, chargee pour le media print', () => {
  const html = lire('index.html');
  assert.match(html, /<link[^>]*impression\.css[^>]*media="print"/);
  const css = lire('css/impression.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepStrictEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g), null, 'code couleur en dur dans impression.css');
  for (const sel of ['.onglets', '.bouton-aide', '.visite', '.bandeau', '.ajout', '.export-import']) {
    assert.ok(css.includes(sel), sel + ' doit etre masque a l\'impression');
  }
  assert.match(css, /animation:\s*none/);
  assert.match(css, /break-inside:\s*avoid/);
});

// ---- echelonner ---------------------------------------------------------------------------------

function faux(n) {
  const enfants = [];
  for (let k = 0; k < n; k++) {
    const props = {};
    const classes = new Set();
    enfants.push({ props, classes, style: { setProperty: (nom, v) => { props[nom] = v; } }, classList: { add: (c) => classes.add(c) } });
  }
  return { children: enfants };
}

test('echelonner : --i croissant sur les enfants directs, plafonne', () => {
  const c = faux(10);
  echelonner(c);
  assert.deepStrictEqual(c.children.slice(0, 4).map((e) => e.props['--i']), ['0', '1', '2', '3']);
  const dernier = c.children[9].props['--i'];
  assert.ok(Number(dernier) <= 5, 'rang plafonne pour que l\'entree reste breve : ' + dernier);
  assert.ok(c.children.every((e) => e.classes.has('entree')));
});

test('echelonner : conteneur absent ou vide sans erreur', () => {
  assert.doesNotThrow(() => echelonner(null));
  assert.doesNotThrow(() => echelonner({ children: [] }));
});
