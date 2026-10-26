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

// ---- impression : valeurs en entier -------------------------------------------------------------

const { valeurAffichee, SELECTEUR } = require('../../js/impression.js');

test('valeurAffichee : valeur du champ, texte d\'exemple si vide, option choisie pour une liste', () => {
  const champ = (value, placeholder) => ({ tagName: 'INPUT', type: 'text', value, getAttribute: (n) => (n === 'placeholder' ? placeholder : null) });
  assert.strictEqual(valeurAffichee(champ('2026-12-50, 2027-1-50', '')), '2026-12-50, 2027-1-50');
  assert.strictEqual(valeurAffichee(champ('', '—')), '—');
  assert.strictEqual(valeurAffichee({ tagName: 'SELECT', selectedIndex: 1, options: [{ textContent: 'Revenu' }, { textContent: 'Dépense' }] }), 'Dépense');
  assert.strictEqual(valeurAffichee({ tagName: 'SELECT', selectedIndex: -1, options: [] }), '');
  assert.strictEqual(valeurAffichee({ tagName: 'INPUT', type: 'checkbox', checked: true }), null);
  assert.strictEqual(valeurAffichee(null), null);
  assert.match(SELECTEUR, /table\.releve input/);
});

test('impression.css : le champ avec jumeau est masque, le jumeau s\'affiche et passe a la ligne', () => {
  const css = lire('css/impression.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /input\[type="text"\]:has\(\+ \.valeur-impression\)[^{]*\{[^}]*display:\s*none/);
  assert.match(css, /\.valeur-impression\s*\{[^}]*display:\s*block[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/);
  assert.match(lire('css/style.css'), /\.valeur-impression\s*\{\s*display:\s*none/); // invisible a l'ecran
  assert.ok(lire('index.html').includes('js/impression.js'));
});

test('en-tete etroit : onglets sur leur ligne, defilement lateral, bouton d\'aide a droite', () => {
  const sel = regles(lire('css/style.css')).filter((r) => r.selecteur === '.onglets' || r.selecteur === '.bouton-aide');
  const etroit = sel.filter((r) => /flex:\s*1 1 100%/.test(r.corps));
  assert.ok(etroit.length, 'ligne propre pour les onglets');
  assert.match(etroit[0].corps, /overflow-x:\s*auto/);
  assert.match(etroit[0].corps, /flex-wrap:\s*nowrap/);
  assert.ok(sel.some((r) => r.selecteur === '.bouton-aide' && /margin-left:\s*auto/.test(r.corps) && /order:\s*2/.test(r.corps)));
});

test('contraste eleve : l\'onglet choisi garde un marqueur, focus et cadre de visite en couleurs systeme', () => {
  const r = regles(lire('css/mouvement.css'));
  assert.ok(r.some((x) => x.selecteur === '.onglets button[aria-selected="true"]' && /border-bottom-color:\s*Highlight/.test(x.corps)));
  assert.ok(r.some((x) => x.selecteur === ':focus-visible' && /outline-color:\s*Highlight/.test(x.corps)));
  assert.ok(r.some((x) => x.selecteur === '.visite-cadre' && /border-color:\s*Highlight/.test(x.corps)));
  assert.match(lire('css/mouvement.css'), /@media \(forced-colors: active\)/);
});

test('bandeau des chiffres cles : chaque chiffre s\'adapte a sa colonne (jamais de debordement de page)', () => {
  const r = regles(lire('css/style.css'));
  assert.ok(r.some((x) => x.selecteur === '.chiffres-cles .chiffre' && /container-type:\s*inline-size/.test(x.corps)));
  assert.ok(r.some((x) => x.selecteur === '.chiffres-cles .chiffre-val' && /cqi/.test(x.corps)));
});

test('un seul fondu des chiffres cles : plus de classe apparait', () => {
  assert.ok(!/apparait/.test(lire('css/style.css')) && !/apparait/.test(lire('js/ui-dashboard.js')));
});
