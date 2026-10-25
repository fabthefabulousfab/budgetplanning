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

// Copie temporaire du dépôt (sources + scripts) avec des leurres à ne pas publier.
function copie() {
  const racine = tmp();
  for (const s of SOURCES) {
    fs.cpSync(path.join(REPO, s), path.join(racine, s), { recursive: true });
  }
  ecrire(path.join(racine, 'docs/x.md'), 'doc');
  ecrire(path.join(racine, 'data/x.yaml'), 'a: 1');
  ecrire(path.join(racine, 'data/x.csv'), 'a,b');
  ecrire(path.join(racine, 'budget.xlsx'), 'xlsx');
  ecrire(path.join(racine, '.env'), 'SECRET=1');
  ecrire(path.join(racine, 'TODO.md'), 'todo');
  ecrire(path.join(racine, 'js/.DS_Store'), 'x');
  ecrire(path.join(racine, 'js/notes.md'), 'notes');
  ecrire(path.join(racine, 'js/store.js~'), 'sauvegarde editeur');
  ecrire(path.join(racine, 'css/notes.md'), 'notes');
  ecrire(path.join(racine, 'vendor/LICENSE.md'), 'licence');
  ecrire(path.join(racine, 'tests/js/x.test.js'), 'x');
  ecrire(path.join(racine, 'spike/s.html'), 's');
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

function attendu(racine) {
  const liste = ['.nojekyll', 'index.html'];
  for (const [dossier, ext] of [['js', '.js'], ['css', '.css'], ['vendor', '.js']]) {
    for (const f of fs.readdirSync(path.join(REPO, dossier))) {
      if (f.endsWith(ext)) liste.push(dossier + '/' + f);
    }
  }
  return liste.sort();
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

// --- publier-pages.sh -------------------------------------------------------

function depot() {
  const racine = copie();
  const distant = path.join(tmp(), 'distant.git');
  git(path.dirname(distant), 'init', '--bare', '-q', distant);
  git(racine, 'init', '-q', '-b', 'main');
  git(racine, 'config', 'user.name', 'Test');
  git(racine, 'config', 'user.email', 'test@example.invalid');
  git(racine, 'config', 'commit.gpgsign', 'false');
  git(racine, 'remote', 'add', 'origin', 'file://' + distant);
  for (const s of ['index.html', 'js', 'css', 'vendor', 'scripts', '.gitignore']) git(racine, 'add', s);
  git(racine, 'commit', '-q', '-m', 'initial');
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
  const apres = etat(racine);
  assert.deepStrictEqual(apres, avant);
  assert.deepStrictEqual(arbre(racine, 'gh-pages'), attendu(racine));
  for (const f of arbre(racine, 'gh-pages')) assert.ok(!INTERDIT.test(f), f);
  assert.strictEqual(git(racine, 'rev-list', '--count', 'gh-pages'), '1');
  assert.strictEqual(git(racine, 'rev-list', '--max-parents=0', 'gh-pages'), git(racine, 'rev-parse', 'gh-pages'));
  const court = git(racine, 'rev-parse', '--short', 'HEAD');
  assert.match(git(racine, 'log', '-1', '--format=%s', 'gh-pages'), new RegExp('^publication \\d{4}-\\d{2}-\\d{2} \\(' + court + '\\)$'));
  assert.match(r.stdout, /ne pousse rien|rien n'a été poussé|Aucun envoi/i);
  assert.strictEqual(git(distant, 'branch', '--list'), '', 'rien poussé sur le distant');
  assert.strictEqual(git(racine, 'worktree', 'list').split('\n').length, 1, 'worktree temporaire retiré');
});

test('publier-pages.sh : sans changement, rien à publier et aucun commit', () => {
  const { racine } = depot();
  assert.strictEqual(pages(racine).status, 0);
  const avant = git(racine, 'rev-parse', 'gh-pages');
  const r = pages(racine);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("Rien à publier : la page est déjà à jour."), r.stdout);
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
  assert.strictEqual(pages(racine, '--push').status, 0);
  // Le distant reçoit un autre commit : le push suivant n'est plus un avance rapide.
  const autre = tmp();
  git(autre, 'clone', '-q', '-b', 'gh-pages', 'file://' + distant, 'c');
  const c = path.join(autre, 'c');
  git(c, 'config', 'user.name', 'Autre');
  git(c, 'config', 'user.email', 'autre@example.invalid');
  ecrire(path.join(c, 'autre.txt'), 'x');
  git(c, 'add', 'autre.txt');
  git(c, 'commit', '-q', '-m', 'autre');
  git(c, 'push', '-q', 'origin', 'gh-pages');
  fs.appendFileSync(path.join(racine, 'css/style.css'), '\n/* modif */\n');
  git(racine, 'add', 'css/style.css');
  git(racine, 'commit', '-q', '-m', 'modif css');
  const r = pages(racine, '--push');
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /rejet|refus|rejected/i);
  assert.ok(git(distant, 'show', 'gh-pages:autre.txt') === 'x', 'le distant est intact');
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

test('publier.sh : refuse un dossier de sortie qui contient des fichiers suivis par git', () => {
  const { racine } = depot();
  git(racine, 'add', '-f', 'docs/x.md');
  git(racine, 'commit', '-q', '-m', 'doc');
  const r = build(racine, path.join(racine, 'docs'));
  assert.notStrictEqual(r.status, 0);
  assert.ok(fs.existsSync(path.join(racine, 'docs/x.md')));
});
