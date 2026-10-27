const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { textesVisite } = require('../../js/visite-textes.js');

const racine = path.join(__dirname, '..', '..');
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');

// Corps d'une fonction de premier niveau du script (de « function nom( » a la fonction suivante, indentee pareil).
function fonction(src, nom) {
  const m = new RegExp('\\n  (?:async )?function ' + nom + '\\([\\s\\S]*?\\n  }\\n').exec(src);
  assert.ok(m, 'fonction introuvable : ' + nom);
  return m[0];
}

test('index.html charge js/demo.js apres store.js et avant ui-app.js', () => {
  const html = lire('index.html');
  const i = (f) => html.indexOf('src="js/' + f + '"');
  assert.ok(i('demo.js') > i('store.js') && i('demo.js') > i('categories.js'), 'demo.js apres ses dependances');
  assert.ok(i('demo.js') < i('ui-app.js'), 'demo.js avant ui-app.js');
});

test('index.html : un bandeau de demo en role status, masque au depart', () => {
  assert.match(lire('index.html'), /<div id="bandeau-demo"[^>]*role="status"[^>]*hidden/);
});

test('ouvrirDemo n\'appelle jamais showDirectoryPicker et ouvre le dossier en memoire', () => {
  const f = fonction(lire('js/ui-app.js'), 'ouvrirDemo');
  assert.ok(!/showDirectoryPicker/.test(f));
  assert.match(f, /dossierDemo\(/);
  assert.match(f, /demo: true|true\)/);
});

test('quitter la demo remet l\'etat a zero et reaffiche l\'accueil', () => {
  const f = fonction(lire('js/ui-app.js'), 'quitterDemo');
  ['state.dir = null', 'state.donnees = null', 'state.demo = false', 'ecranAccueil()', 'bandeauDemo(false)'].forEach((s) => assert.ok(f.indexOf(s) >= 0, s));
});

test('le bouton de demo existe sur l\'accueil et sur l\'ecran navigateur non pris en charge', () => {
  const src = lire('js/ui-app.js');
  const ecran = fonction(src, 'ecranAccueil');
  assert.strictEqual(ecran.split('boutonDemo()').length - 1, 2, 'boutonDemo() utilise sur les deux ecrans');
  assert.match(fonction(src, 'boutonDemo'), /Découvrir avec un exemple/);
  assert.match(fonction(src, 'boutonDemo'), /accueil-demo/);
});

test('visite : l\'accueil presente le bouton de demo', () => {
  const e = textesVisite.accueil.find((x) => x.cible === 'accueil-demo');
  assert.ok(e, 'etape accueil-demo');
  assert.match(e.texte, /rien n’est enregistré/i);
});

test('Parametres : en demo, export et import de sauvegarde sont desactives avec une explication', () => {
  const f = fonction(lire('js/ui-params.js'), 'carteSauvegarde');
  assert.match(f, /state\(\)\.demo/);
  assert.match(f, /disabled/);
});

test('style : bandeau de demo sans couleur ecrite, masque a l\'impression', () => {
  const css = lire('css/style.css');
  const regles = css.split('\n').filter((l) => /bandeau-demo|demo-accueil/.test(l));
  assert.ok(regles.length >= 2, 'regles du bandeau et du bloc d\'accueil');
  regles.forEach((l) => assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(l), 'couleur en dur : ' + l));
  assert.match(lire('css/impression.css'), /\.bandeau-demo/);
});

test('README : section « Démo »', () => {
  assert.match(lire('README.md'), /^## Démo$/m);
});
