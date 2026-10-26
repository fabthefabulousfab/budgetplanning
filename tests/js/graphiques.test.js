const test = require('node:test');
const assert = require('node:assert');
const G = require('../../js/graphiques.js');

// Faux matchMedia : une liste d'écouteurs par requête, déclenchable à la main.
function fauxEnv(etats) {
  const listes = {};
  return {
    matchMedia(q) {
      listes[q] = listes[q] || [];
      return {
        matches: !!etats[q],
        addEventListener(type, f) { if (type === 'change') listes[q].push(f); },
        removeEventListener(type, f) { listes[q] = listes[q].filter((g) => g !== f); },
      };
    },
    declencher(q) { (listes[q] || []).slice().forEach((f) => f({ matches: true })); },
    nb(q) { return (listes[q] || []).length; },
  };
}
const SOMBRE = '(prefers-color-scheme: dark)';
const REDUIT = '(prefers-reduced-motion: reduce)';

test('dureeAnimation : 0 si réduit, sinon la durée demandée', () => {
  assert.strictEqual(G.dureeAnimation(true, 700), 0);
  assert.strictEqual(G.dureeAnimation(false, 700), 700);
});

test('animationsReduites : lit prefers-reduced-motion, faux sans matchMedia', () => {
  assert.strictEqual(G.animationsReduites(fauxEnv({ [REDUIT]: true })), true);
  assert.strictEqual(G.animationsReduites(fauxEnv({})), false);
  assert.strictEqual(G.animationsReduites({}), false);
});

test('surChangementTheme : rappel au changement, plus rien après désabonnement', () => {
  const env = fauxEnv({});
  let n = 0;
  const stop = G.surChangementTheme(() => { n++; }, env);
  env.declencher(SOMBRE);
  assert.strictEqual(n, 1);
  stop();
  env.declencher(SOMBRE);
  assert.strictEqual(n, 1);
  assert.strictEqual(env.nb(SOMBRE), 0);
});

test('surChangementTheme : sans matchMedia, désabonnement sans erreur', () => {
  const stop = G.surChangementTheme(() => {}, {});
  assert.doesNotThrow(stop);
});

test('couleursTheme : lit les variables CSS par la fonction fournie', () => {
  const vars = { '--encre-2': ' #111111', '--grille': '#222222', '--positif': '#333333', '--negatif': '#444444', '--positif-fond': '#555555', '--carte': '#666666', '--trait': '#777777' };
  assert.deepStrictEqual(G.couleursTheme((n) => vars[n]), {
    encre2: '#111111', grille: '#222222', positif: '#333333', negatif: '#444444', positifFond: '#555555', carte: '#666666', trait: '#777777',
  });
});

test('transparence : couleur hexadécimale du thème en rgba (aires dégradées du canvas)', () => {
  assert.strictEqual(G.transparence('#2f5d50', 0.2), 'rgba(47, 93, 80, 0.2)');
  assert.strictEqual(G.transparence(' #A8451E ', 0), 'rgba(168, 69, 30, 0)');
  assert.strictEqual(G.transparence('rgb(1, 2, 3)', 0.5), 'rgb(1, 2, 3)'); // format inconnu : rendu tel quel
});

test('optionsCommunes : sans légende, grilles légères, mois en lettres', () => {
  const c = { encre2: 'a', grille: 'b', positif: 'c', negatif: 'd', positifFond: 'e' };
  const o = G.optionsCommunes(c);
  assert.strictEqual(o.plugins.legend.display, false);
  assert.strictEqual(o.scales.x.grid.display, false);
  assert.strictEqual(o.scales.y.grid.color, 'b');
  assert.strictEqual(o.scales.x.ticks.color, 'a');
  // Chart.js appelle le rappel avec l'index ; this.getLabelForValue rend l'étiquette (AAAA-MM).
  const echelle = { getLabelForValue: (i) => ['2026-10', '2026-11'][i] };
  assert.strictEqual(o.scales.x.ticks.callback.call(echelle, 1, 1), 'nov. 2026');
});
