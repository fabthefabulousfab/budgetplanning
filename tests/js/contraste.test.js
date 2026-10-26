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
  ['--positif', '--positif-fond'], ['--negatif', '--negatif-fond'],
];

for (const nom of ['clair', 'sombre']) {
  test('contrastes AA (4.5) du jeu ' + nom, () => {
    const v = jeux[nom];
    for (const [a, b] of PAIRES) {
      const r = contraste(v[a], v[b]);
      assert.ok(r >= 4.5, `${a} sur ${b} (${nom}) : ${r.toFixed(2)} < 4.5`);
    }
  });
}

test('variables du theme presentes et pas de couleur en dur dans style.css', () => {
  const colorees = ['--fond', '--carte', '--encre', '--encre-2', '--trait', '--grille', '--accent',
    '--positif', '--negatif', '--positif-fond', '--negatif-fond', '--filet', '--papier-2'];
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
