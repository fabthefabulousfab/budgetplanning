const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const SOURCES = ['index.html', 'js', 'css', 'vendor', 'scripts', '.gitignore'];
const PUBLIE = ['.nojekyll', 'css', 'index.html', 'js', 'vendor'];
const INTERDIT = /\.(md|yaml|csv|xlsx)$|(^|\/)\.env$/;

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, Object.assign({ encoding: 'utf8' }, opts));
  if (r.error) {
    assert.fail(cmd + ' est introuvable ou inutilisable : ' + r.error.message);
  }
  return r;
}

function git(cwd, ...args) {
  const r = run('git', args, { cwd });
  assert.strictEqual(r.status, 0, 'git ' + args.join(' ') + ' : ' + r.stderr);
  return r.stdout.trim();
}

function tmp() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'publier-test-')));
}

function ecrire(fichier, contenu) {
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, contenu);
}

// Copie temporaire du dépôt (sources + scripts), dépôt git réel, avec des leurres.
function copie() {
  const racine = tmp();
  for (const s of SOURCES) {
    fs.cpSync(path.join(REPO, s), path.join(racine, s), { recursive: true });
  }
  // Leurres SUIVIS par git : ils ne doivent pas être publiés.
  const suivis = {
    'docs/x.md': 'doc', 'js/.DS_Store': 'x', 'js/notes.md': 'notes', 'js/store.js~': 'editeur',
    'js/sous/profond.js': 'x', 'css/notes.md': 'notes', 'vendor/LICENSE.md': 'licence',
    'tests/js/x.test.js': 'x', 'spike/s.html': 's',
  };
  for (const [f, c] of Object.entries(suivis)) ecrire(path.join(racine, f), c);
  git(racine, 'init', '-q', '-b', 'main');
  git(racine, 'config', 'user.name', 'Test');
  git(racine, 'config', 'user.email', 'test@example.invalid');
  git(racine, 'config', 'commit.gpgsign', 'false');
  for (const s of SOURCES) git(racine, 'add', s);
  git(racine, 'add', '-f', ...Object.keys(suivis));
  git(racine, 'commit', '-q', '-m', 'initial');
  // Leurres NON suivis (jamais publiés).
  ecrire(path.join(racine, 'data/x.yaml'), 'a: 1');
  ecrire(path.join(racine, 'data/x.csv'), 'a,b');
  ecrire(path.join(racine, 'budget.xlsx'), 'xlsx');
  ecrire(path.join(racine, '.env'), 'SECRET=1');
  ecrire(path.join(racine, 'TODO.md'), 'todo');
  ecrire(path.join(racine, 'js/secret.js'), 'SECRET');
  ecrire(path.join(racine, 'css/priv.css'), 'SECRET');
  fs.symlinkSync(path.join(tmp(), 'dehors.js'), path.join(racine, 'js/link.js'));
  return racine;
}

function lister(dossier) {
  const out = [];
  (function parcourir(d, prefixe) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const rel = prefixe + e.name;
      if (e.isDirectory()) parcourir(path.join(d, e.name), rel + '/');
      else out.push(rel);
    }
  })(dossier, '');
  return out.sort();
}

// Attendu : les fichiers SUIVIS du dépôt temporaire qui sont la page, des scripts
// ou des styles (jamais déduit du dossier de travail ni du vrai dépôt).
function attendu(racine) {
  const suivis = git(racine, 'ls-files').split('\n');
  const liste = suivis.filter((f) => /^(index\.html|js\/[^/]+\.js|css\/[^/]+\.css|vendor\/[^/]+\.js)$/.test(f));
  assert.ok(liste.includes('index.html') && liste.some((f) => f.startsWith('js/')), 'liste attendue plausible');
  return ['.nojekyll', ...liste].sort();
}

function build(racine, ...args) {
  return run('bash', [path.join(racine, 'scripts/publier.sh'), ...args], { cwd: racine });
}

test('bash et git sont disponibles', () => {
  assert.strictEqual(run('bash', ['--version']).status, 0);
  assert.strictEqual(run('git', ['--version']).status, 0);
});

test('publier.sh : la sortie contient exactement la page et .nojekyll', () => {
  const racine = copie();
  const sortie = path.join(racine, 'sortie');
  const r = build(racine, sortie);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.deepStrictEqual(lister(sortie), attendu(racine));
  assert.deepStrictEqual(fs.readdirSync(sortie).sort(), PUBLIE);
  assert.strictEqual(fs.readFileSync(path.join(sortie, '.nojekyll'), 'utf8'), '');
  assert.ok(r.stdout.includes('index.html'), 'la liste des fichiers est affichée');
  for (const f of lister(sortie)) assert.ok(!INTERDIT.test(f), f);
});

test('publier.sh : dossier par défaut dist/ à la racine du dépôt, ignoré par git', () => {
  const racine = copie();
  const r = build(racine);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.deepStrictEqual(lister(path.join(racine, 'dist')), attendu(racine));
  assert.match(fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8'), /^dist\/$/m);
});

test('publier.sh : un second lancement vide les anciens fichiers de la sortie', () => {
  const racine = copie();
  const sortie = path.join(racine, 'dist');
  assert.strictEqual(build(racine, sortie).status, 0);
  ecrire(path.join(sortie, 'vieux.html'), 'vieux');
  ecrire(path.join(sortie, 'js/vieux.js'), 'vieux');
  ecrire(path.join(sortie, 'dossier/a.txt'), 'a');
  ecrire(path.join(sortie, '.cache'), 'a');
  assert.strictEqual(build(racine, sortie).status, 0);
  assert.deepStrictEqual(lister(sortie), attendu(racine));
});

test('publier.sh : refuse les sorties dangereuses sans rien supprimer', () => {
  const racine = copie();
  const dehors = tmp();
  ecrire(path.join(dehors, 'garde.txt'), 'garde');
  const avant = lister(racine);
  const cas = ['/', racine, racine + '/', path.join(racine, '.git'), path.join(racine, 'js'),
    path.join(racine, 'css'), path.join(racine, 'vendor'), path.join(racine, 'js/sous'),
    path.join(racine, 'x/../js'), dehors, path.join(racine, '..')];
  for (const c of cas) {
    const r = build(racine, c);
    assert.notStrictEqual(r.status, 0, 'devait refuser : ' + c);
    assert.ok(r.stderr.length > 0, 'message attendu pour ' + c);
  }
  assert.deepStrictEqual(lister(racine), avant);
  assert.deepStrictEqual(lister(dehors), ['garde.txt']);
});

test('publier.sh : refuse un dossier de sortie qui contient des fichiers suivis par git', () => {
  const racine = copie();
  const r = build(racine, path.join(racine, 'docs'));
  assert.notStrictEqual(r.status, 0);
  assert.ok(fs.existsSync(path.join(racine, 'docs/x.md')));
});

test('publier.sh : refuse hors dépôt git et argument vide', () => {
  const racine = copie();
  const vide = build(racine, '');
  assert.notStrictEqual(vide.status, 0);
  assert.match(vide.stderr, /vide/);
  fs.rmSync(path.join(racine, '.git'), { recursive: true, force: true });
  const r = build(racine, path.join(racine, 'dist'));
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /pas un dépôt git/);
});

test('publier.sh : un lien symbolique suivi dans js/ fait refuser la construction', () => {
  const racine = copie();
  fs.symlinkSync(path.join(tmp(), 'cible'), path.join(racine, 'js/suivi.txt'));
  git(racine, 'add', '-f', 'js/suivi.txt');
  git(racine, 'commit', '-q', '-m', 'lien');
  const sortie = path.join(racine, 'dist');
  const r = build(racine, sortie);
  assert.notStrictEqual(r.status, 0);
  assert.ok(r.stderr.includes('js/suivi.txt'), r.stderr);
  assert.ok(!fs.existsSync(path.join(sortie, 'index.html')));
});

test('publier.sh : seul l\'état committé est publié (non suivis, liens, modifs non validées)', () => {
  const racine = copie();
  const sortie = path.join(racine, 'dist');
  assert.strictEqual(build(racine, sortie).status, 0);
  const publies = lister(sortie);
  for (const f of ['js/secret.js', 'css/priv.css', 'js/link.js', 'js/sous/profond.js']) {
    assert.ok(!publies.includes(f), f);
  }
  assert.deepStrictEqual(publies, attendu(racine));
  // Modification non validée : la construction publie le contenu committé et avertit.
  fs.appendFileSync(path.join(racine, 'js/store.js'), '\n// NON VALIDE\n');
  const r = build(racine, sortie);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!fs.readFileSync(path.join(sortie, 'js/store.js'), 'utf8').includes('NON VALIDE'));
  assert.match(r.stderr, /js\/store\.js/);
  assert.match(r.stdout, /COMMITT/);
});

// --- publier-pages.sh -------------------------------------------------------

function depot() {
  const racine = copie();
  const distant = path.join(tmp(), 'distant.git');
  git(path.dirname(distant), 'init', '--bare', '-q', distant);
  git(racine, 'remote', 'add', 'origin', 'file://' + distant);
  return { racine, distant };
}

function pages(racine, ...args) {
  return run('bash', [path.join(racine, 'scripts/publier-pages.sh'), ...args], { cwd: racine });
}

function arbre(racine, ref) {
  const sortie = git(racine, 'ls-tree', '-r', '--name-only', ref);
  return sortie.split('\n').filter(Boolean).sort();
}

function etat(racine) {
  return {
    head: git(racine, 'rev-parse', 'HEAD'),
    branche: git(racine, 'rev-parse', '--abbrev-ref', 'HEAD'),
    status: git(racine, 'status', '--porcelain'),
    fichiers: lister(racine).filter((f) => !f.startsWith('.git/') && !f.startsWith('dist/')),
  };
}

test('publier-pages.sh : crée gh-pages orpheline sans toucher à la branche courante, sans pousser', () => {
  const { racine, distant } = depot();
  const avant = etat(racine);
  const r = pages(racine);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.deepStrictEqual(etat(racine), avant);
  assert.deepStrictEqual(arbre(racine, 'gh-pages'), attendu(racine));
  for (const f of arbre(racine, 'gh-pages')) assert.ok(!INTERDIT.test(f), f);
  assert.ok(!arbre(racine, 'gh-pages').some((f) => /secret|priv|link/.test(f)));
  assert.strictEqual(git(racine, 'rev-list', '--count', 'gh-pages'), '1');
  assert.strictEqual(git(racine, 'rev-list', '--max-parents=0', 'gh-pages'), git(racine, 'rev-parse', 'gh-pages'));
  const court = git(racine, 'rev-parse', '--short', 'HEAD');
  assert.match(git(racine, 'log', '-1', '--format=%s', 'gh-pages'), new RegExp('^publication \\d{4}-\\d{2}-\\d{2} \\(' + court + '\\)$'));
  assert.match(r.stdout, /on ne pousse rien/);
  assert.match(r.stdout, /non suivis.*js\/secret\.js/, 'note sur les fichiers non suivis');
  assert.strictEqual(git(distant, 'branch', '--list'), '', 'rien poussé sur le distant');
  assert.strictEqual(git(racine, 'worktree', 'list').split('\n').length, 1, 'worktree temporaire retiré');
});

test('publier-pages.sh : sans changement, rien à publier et aucun commit', () => {
  const { racine } = depot();
  assert.strictEqual(pages(racine).status, 0);
  const avant = git(racine, 'rev-parse', 'gh-pages');
  const r = pages(racine);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('Rien à publier : la page est déjà à jour.'), r.stdout);
  assert.strictEqual(git(racine, 'rev-parse', 'gh-pages'), avant);
  assert.strictEqual(git(racine, 'rev-list', '--count', 'gh-pages'), '1');
});

test('publier-pages.sh : un changement ajoute exactement un commit', () => {
  const { racine } = depot();
  assert.strictEqual(pages(racine).status, 0);
  fs.appendFileSync(path.join(racine, 'js/store.js'), '\n// modif\n');
  git(racine, 'add', 'js/store.js');
  git(racine, 'commit', '-q', '-m', 'modif');
  const avant = etat(racine);
  const r = pages(racine);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(git(racine, 'rev-list', '--count', 'gh-pages'), '2');
  assert.ok(git(racine, 'show', 'gh-pages:js/store.js').includes('// modif'));
  assert.deepStrictEqual(etat(racine), avant);
});

test('publier-pages.sh --push : pousse gh-pages vers le distant (sans force)', () => {
  const { racine, distant } = depot();
  const r = pages(racine, '--push');
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.strictEqual(git(distant, 'rev-parse', 'gh-pages'), git(racine, 'rev-parse', 'gh-pages'));
  assert.deepStrictEqual(arbre(distant, 'gh-pages'), attendu(racine));
  assert.strictEqual(git(distant, 'branch', '--list', 'main'), '');
  assert.ok(!/git push[^\n]*(--force|--force-with-lease|\s-f\b)/.test(fs.readFileSync(path.join(REPO, 'scripts/publier-pages.sh'), 'utf8').replace(/#.*$/gm, '')));
});

test('publier-pages.sh --push : un push rejeté affiche la raison et échoue', () => {
  const { racine, distant } = depot();
  const hook = path.join(distant, 'hooks/pre-receive');
  ecrire(hook, '#!/bin/sh\necho "refus de test" >&2\nexit 1\n');
  fs.chmodSync(hook, 0o755);
  const r = pages(racine, '--push');
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /rejeté/);
  assert.match(r.stderr, /ne forcez pas/);
  assert.strictEqual(git(distant, 'branch', '--list'), '');
});

function secondePoste(racine, distant) {
  const dossier = path.join(tmp(), 'poste2');
  git(path.dirname(dossier), 'clone', '-q', '--single-branch', '-b', 'main', racine, dossier);
  git(dossier, 'remote', 'set-url', 'origin', 'file://' + distant);
  git(dossier, 'config', 'user.name', 'Poste2');
  git(dossier, 'config', 'user.email', 'poste2@example.invalid');
  git(dossier, 'config', 'commit.gpgsign', 'false');
  return dossier;
}

test('publier-pages.sh --push : un second poste publie par-dessus la gh-pages distante', () => {
  const { racine, distant } = depot();
  assert.strictEqual(pages(racine, '--push').status, 0);
  const premier = git(distant, 'rev-parse', 'gh-pages');
  for (const dejaLocale of [false, true]) {
    const poste = secondePoste(racine, distant);
    fs.appendFileSync(path.join(poste, 'css/style.css'), '\n/* poste2 ' + dejaLocale + ' */\n');
    git(poste, 'add', 'css/style.css');
    git(poste, 'commit', '-q', '-m', 'modif poste2');
    if (dejaLocale) {
      // Une gh-pages orpheline locale (publication sans --push) ne doit pas gêner.
      assert.strictEqual(pages(poste).status, 0);
      assert.strictEqual(git(poste, 'rev-list', '--count', 'gh-pages'), '1');
    }
    const r = pages(poste, '--push');
    assert.strictEqual(r.status, 0, r.stderr + r.stdout);
    assert.notStrictEqual(git(distant, 'rev-parse', 'gh-pages'), premier);
    git(distant, 'merge-base', '--is-ancestor', premier, 'gh-pages');
    assert.ok(git(distant, 'show', 'gh-pages:css/style.css').includes('poste2 ' + dejaLocale));
    assert.deepStrictEqual(arbre(distant, 'gh-pages'), attendu(poste));
    // On repart de l'état distant initial pour l'itération suivante.
    git(distant, 'update-ref', 'refs/heads/gh-pages', premier);
  }
});

test('publier-pages.sh --push : distant injoignable, arrêt explicite', () => {
  const { racine } = depot();
  git(racine, 'remote', 'set-url', 'origin', 'file://' + path.join(tmp(), 'inexistant.git'));
  const r = pages(racine, '--push');
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /Impossible de joindre origin/);
  assert.strictEqual(git(racine, 'branch', '--list', 'gh-pages'), '');
});

test('publier-pages.sh : un arbre de travail périmé après un plantage ne bloque pas', () => {
  const { racine } = depot();
  const perime = path.join(tmp(), 'perime');
  git(racine, 'worktree', 'add', '-q', '-b', 'gh-pages', perime);
  fs.rmSync(perime, { recursive: true, force: true });
  const r = pages(racine);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.deepStrictEqual(arbre(racine, 'gh-pages'), attendu(racine));
});

test('publier-pages.sh : refuse avec des modifications non validées dans les sources', () => {
  for (const f of ['index.html', 'js/store.js', 'css/style.css', 'vendor/chart.umd.js']) {
    const { racine } = depot();
    fs.appendFileSync(path.join(racine, f), '\n');
    const avant = etat(racine);
    const r = pages(racine);
    assert.notStrictEqual(r.status, 0, f);
    assert.ok((r.stderr + r.stdout).includes(f), 'cite ' + f + ' : ' + r.stderr);
    assert.strictEqual(git(racine, 'branch', '--list', 'gh-pages'), '', 'aucune branche créée');
    assert.deepStrictEqual(etat(racine), avant);
  }
});

test('publier-pages.sh : les fichiers hors sources (docs, données) ne bloquent pas', () => {
  const { racine } = depot();
  fs.appendFileSync(path.join(racine, 'TODO.md'), 'x');
  fs.appendFileSync(path.join(racine, 'data/x.yaml'), 'b: 2');
  assert.strictEqual(pages(racine).status, 0);
});
