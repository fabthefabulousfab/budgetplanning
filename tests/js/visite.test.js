const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { etapesDisponibles, positionBulle } = require('../../js/visite.js');
const { textesVisite } = require('../../js/visite-textes.js');

const JS = path.join(__dirname, '..', '..', 'js');
const sources = fs.readdirSync(JS).filter((f) => f.endsWith('.js'));

// ---- etapesDisponibles ---------------------------------------------------------------------

const ETAPES = [{ cible: 'a' }, { cible: 'b' }, { cible: 'c' }, { cible: 'd' }];

test('etapesDisponibles : garde tout si toutes les cibles existent', () => {
  assert.deepStrictEqual(etapesDisponibles(ETAPES, () => true), ETAPES);
});

test('etapesDisponibles : saute les cibles absentes et garde l\'ordre', () => {
  const r = etapesDisponibles(ETAPES, (cle) => cle !== 'b' && cle !== 'd');
  assert.deepStrictEqual(r.map((e) => e.cible), ['a', 'c']);
});

test('etapesDisponibles : résultat vide si plus aucune cible', () => {
  assert.deepStrictEqual(etapesDisponibles(ETAPES, () => false), []);
  assert.deepStrictEqual(etapesDisponibles([], () => true), []);
});

test('etapesDisponibles : ne modifie pas la liste d\'origine', () => {
  const copie = JSON.parse(JSON.stringify(ETAPES));
  etapesDisponibles(ETAPES, () => false);
  assert.deepStrictEqual(ETAPES, copie);
});

// ---- positionBulle -------------------------------------------------------------------------

const VP = { width: 1200, height: 800 };
const BULLE = { width: 320, height: 180 };
const ENTETE = 60;
const rect = (top, left, width, height) => ({ top, left, width, height, bottom: top + height, right: left + width });

test('positionBulle : sous la cible quand il y a de la place', () => {
  const p = positionBulle(rect(200, 400, 200, 100), BULLE, VP, ENTETE);
  assert.strictEqual(p.placement, 'dessous');
  assert.ok(p.top >= 300, 'sous le bas de la cible');
  assert.ok(p.top + BULLE.height <= VP.height);
});

test('positionBulle : au-dessus quand il n\'y a pas de place dessous', () => {
  const p = positionBulle(rect(600, 400, 200, 150), BULLE, VP, ENTETE);
  assert.strictEqual(p.placement, 'dessus');
  assert.ok(p.top + BULLE.height <= 600, 'au-dessus du haut de la cible');
  assert.ok(p.top >= ENTETE);
});

test('positionBulle : centrée sur la cible quand elle tient', () => {
  const p = positionBulle(rect(200, 500, 200, 100), BULLE, VP, ENTETE);
  assert.strictEqual(p.left, 500 + 100 - BULLE.width / 2);
});

test('positionBulle : calée dans la fenêtre à gauche et à droite', () => {
  const g = positionBulle(rect(200, 0, 40, 40), BULLE, VP, ENTETE);
  assert.ok(g.left >= 0 && g.left <= 16);
  const d = positionBulle(rect(200, 1160, 40, 40), BULLE, VP, ENTETE);
  assert.ok(d.left + BULLE.width <= VP.width);
  assert.ok(d.left > VP.width - BULLE.width - 20);
});

test('positionBulle : jamais sous la marge de l\'en-tête collant', () => {
  const p = positionBulle(rect(-200, 400, 200, 205), BULLE, VP, ENTETE);
  assert.ok(p.top >= ENTETE, 'top=' + p.top);
});

test('positionBulle : ancrée en bas si ni dessous ni dessus ne conviennent', () => {
  const p = positionBulle(rect(70, 100, 900, 700), BULLE, VP, ENTETE);
  assert.strictEqual(p.placement, 'bas');
  assert.strictEqual(p.top + BULLE.height <= VP.height, true);
});

test('positionBulle : écran étroit (< 640) ancrée en bas, pleine largeur', () => {
  const vp = { width: 500, height: 700 };
  const p = positionBulle(rect(200, 100, 200, 100), { width: 400, height: 200 }, vp, ENTETE);
  assert.strictEqual(p.placement, 'bas');
  assert.ok(p.top + 200 <= 700);
  assert.ok(p.top >= 700 - 200 - 20, 'collée en bas');
  assert.ok(p.left >= 0 && p.left + 400 <= 500);
});

test('positionBulle : 640 de large n\'est pas encore « étroit »', () => {
  const p = positionBulle(rect(100, 100, 200, 80), BULLE, { width: 640, height: 800 }, ENTETE);
  assert.notStrictEqual(p.placement, 'bas');
  const e = positionBulle(rect(100, 100, 200, 80), BULLE, { width: 639, height: 800 }, ENTETE);
  assert.strictEqual(e.placement, 'bas');
});

// ---- Textes --------------------------------------------------------------------------------

function ongletsEnregistres() {
  const ids = [];
  sources.filter((f) => f.startsWith('ui-')).forEach((f) => {
    const src = fs.readFileSync(path.join(JS, f), 'utf8');
    const re = /registerTab\(\s*'([a-z]+)'/g;
    let m;
    while ((m = re.exec(src))) ids.push(m[1]);
  });
  return ids;
}

test('textes : un jeu d\'étapes par onglet enregistré, plus l\'accueil', () => {
  const ids = ongletsEnregistres();
  assert.ok(ids.length >= 6, 'onglets trouvés : ' + ids.join(','));
  ids.concat(['accueil']).forEach((id) => {
    assert.ok(Array.isArray(textesVisite[id]), 'textes manquants pour ' + id);
  });
});

test('textes : chaque onglet a de 4 à 7 étapes', () => {
  Object.keys(textesVisite).forEach((id) => {
    const n = textesVisite[id].length;
    assert.ok(n >= 4 && n <= 7, id + ' : ' + n + ' étapes');
  });
});

test('textes : chaque étape a une cible, un titre et un texte non vides', () => {
  Object.keys(textesVisite).forEach((id) => {
    textesVisite[id].forEach((e, i) => {
      ['cible', 'titre', 'texte'].forEach((k) => {
        assert.ok(typeof e[k] === 'string' && e[k].trim() !== '', id + '[' + i + '].' + k + ' vide');
      });
    });
  });
});

test('textes : pas de doublon de cible dans un même onglet', () => {
  Object.keys(textesVisite).forEach((id) => {
    const cles = textesVisite[id].map((e) => e.cible);
    assert.strictEqual(new Set(cles).size, cles.length, id);
  });
});

test('textes : chaque cible est posée quelque part dans js/ (data-aide)', () => {
  const code = sources
    .filter((f) => f !== 'visite-textes.js')
    .map((f) => fs.readFileSync(path.join(JS, f), 'utf8'))
    .join('\n');
  const cles = new Set();
  Object.keys(textesVisite).forEach((id) => textesVisite[id].forEach((e) => cles.add(e.cible)));
  cles.forEach((cle) => {
    const attr = 'data-aide="' + cle + '"';
    const setter = "setAttribute('data-aide', '" + cle + "')";
    const objet = "'data-aide': '" + cle + "'"; // el('div', '', { 'data-aide': 'cle' })
    assert.ok(code.includes(attr) || code.includes(setter) || code.includes(objet), 'cible introuvable dans js/ : ' + cle);
  });
});
