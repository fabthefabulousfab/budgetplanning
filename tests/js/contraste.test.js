const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..', '..');
const theme = fs.readFileSync(path.join(racine, 'css', 'theme.css'), 'utf8');
const style = fs.readFileSync(path.join(racine, 'css', 'style.css'), 'utf8');

function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  assert.ok(m, 'couleur hexadecimale attendue : ' + hex);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// Extrait le contenu du bloc { ... } qui suit l'ouverture donnee (accolades equilibrees).
function bloc(source, ouverture) {
  const debut = source.indexOf(ouverture);
  assert.ok(debut >= 0, 'bloc introuvable : ' + ouverture);
  let i = source.indexOf('{', debut);
  const dep = i + 1;
  let prof = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') prof++;
    else if (source[i] === '}' && --prof === 0) return source.slice(dep, i);
  }
  throw new Error('bloc non ferme : ' + ouverture);
}
function variables(texte) {
  const v = {};
  for (const m of texte.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) v[m[1]] = m[2].trim();
  return v;
}

const sansCommentaires = theme.replace(/\/\*[\s\S]*?\*\//g, '');
const media = bloc(sansCommentaires, '@media (prefers-color-scheme: dark)');
const sombreTexte = bloc(media, ':root');
const clairTexte = bloc(sansCommentaires.replace(media, ''), ':root');
const jeux = { clair: variables(clairTexte), sombre: variables(sombreTexte) };

const PAIRES = [
  ['--encre', '--fond'], ['--encre', '--carte'],
  ['--encre-2', '--fond'], ['--encre-2', '--carte'],
  ['--positif', '--fond'], ['--positif', '--carte'],
  ['--negatif', '--fond'], ['--negatif', '--carte'],
  ['--carte', '--accent'],
  // Boutons pleins : texte sur l'aplat plus profond
  ['--sur-accent', '--accent-fond'],
  ['--positif', '--positif-fond'], ['--negatif', '--negatif-fond'],
  // Bandeau d'erreur (texte courant) et d'avertissement (fond --papier-2)
  ['--encre', '--negatif-fond'], ['--encre', '--papier-2'],
  // Texte dans les champs et bandes de categorie (fond --papier-2)
  ['--encre-2', '--papier-2'], ['--negatif', '--papier-2'],
  // Releve : « oui » vert sur la ligne survolee (lavis de --papier-2)
  ['--positif', '--papier-2'],
];
// Elements graphiques (WCAG 1.4.11, 3:1) : bord des champs sur leur fond, au repos et au survol ;
// icones discretes du releve (--bord-champ) sur le papier, au repos.
const PAIRES_GRAPHIQUES = [['--bord-champ', '--papier-2'], ['--bord-champ', '--carte'], ['--bord-champ', '--fond']];

// Melange de la couleur `hex` d'opacite `a` sur le fond `fond`.
function melange(hex, a, fond) {
  const c = (h, i) => parseInt(h.slice(1 + i, 3 + i), 16);
  return '#' + [0, 2, 4].map((i) => Math.round(c(hex, i) * a + c(fond, i) * (1 - a)).toString(16).padStart(2, '0')).join('');
}

for (const nom of ['clair', 'sombre']) {
  test('contrastes AA (4.5) du jeu ' + nom, () => {
    const v = jeux[nom];
    for (const [a, b] of PAIRES) {
      const r = contraste(v[a], v[b]);
      assert.ok(r >= 4.5, `${a} sur ${b} (${nom}) : ${r.toFixed(2)} < 4.5`);
    }
  });
  test('contrastes non textuels (3:1) du jeu ' + nom, () => {
    const v = jeux[nom];
    for (const [a, b] of PAIRES_GRAPHIQUES) {
      const r = contraste(v[a], v[b]);
      assert.ok(r >= 3, `${a} sur ${b} (${nom}) : ${r.toFixed(2)} < 3`);
    }
  });
  test('texte d\'exemple (::placeholder) lisible sur le fond des champs, jeu ' + nom, () => {
    const css = style.replace(/\/\*[\s\S]*?\*\//g, '');
    const regle = /::placeholder\s*\{([^}]*)\}/.exec(css);
    assert.ok(regle, 'regle ::placeholder absente de style.css');
    const couleur = /color:\s*var\((--[a-z0-9-]+)\)/.exec(regle[1]);
    assert.ok(couleur, 'couleur du placeholder en variable attendue');
    const op = /opacity:\s*([0-9.]+)/.exec(regle[1]);
    const a = op ? Number(op[1]) : 1;
    const v = jeux[nom];
    for (const fond of ['--papier-2', '--carte']) {
      const r = contraste(melange(v[couleur[1]], a, v[fond]), v[fond]);
      assert.ok(r >= 4.5, `placeholder sur ${fond} (${nom}) : ${r.toFixed(2)} < 4.5`);
    }
  });
}

test('variables du theme presentes et pas de couleur en dur dans style.css', () => {
  const colorees = ['--fond', '--carte', '--encre', '--encre-2', '--trait', '--grille', '--accent',
    '--positif', '--negatif', '--positif-fond', '--negatif-fond', '--filet', '--papier-2', '--bord-champ', '--accent-fond', '--sur-accent'];
  for (const nom of colorees) {
    assert.ok(jeux.clair[nom], nom + ' absent du jeu clair');
    assert.ok(jeux.sombre[nom], nom + ' absent du jeu sombre');
  }
  const autres = ['--police-titre', '--police-texte', '--rayon', '--espace-1', '--espace-2', '--espace-3',
    '--espace-4', '--espace-5', '--duree-courte', '--duree-longue', '--ease', '--taille-1', '--taille-2',
    '--taille-3', '--taille-4', '--taille-5'];
  for (const nom of autres) assert.ok(jeux.clair[nom], nom + ' absent du jeu clair');
  assert.match(clairTexte, /color-scheme:\s*light dark/);
  const css = style.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepStrictEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g), null, 'code couleur en dur dans style.css');
});
