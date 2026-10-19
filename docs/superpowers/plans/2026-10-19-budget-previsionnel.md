# Budget prévisionnel familial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page HTML autonome (sans serveur) qui projette mois par mois, sur 10-15 ans, le solde du foyer à partir d'un Excel structuré, de revenus/dépenses futurs saisis dans la page et de paramètres, le tout persisté en YAML.

**Architecture:** Un script Python (`scripts/excel_to_yaml.py`) convertit `budget.xlsx` en `data/donnees-courantes.yaml`. La page `index.html` (JS vanilla, scripts classiques, libs dans `vendor/`) lit/écrit les 3 fichiers YAML de `data/` via l'API File System Access (Chrome/Edge). Le cœur métier (parseur d'échéances, projection, synthèses) est en JS pur, testé avec `node --test`, sans DOM.

**Tech Stack:** HTML/CSS/JS vanilla, Chart.js 4 + js-yaml 4 (vendorisés), Node `--test`, Python ≥3.11 via `uv` (openpyxl, pyyaml, pytest).

**Spec:** `need-polished.md` (brief, intentions I1-I29) et `flashmob-need-polishing.md` (décisions 1-23, annexe A). Format Excel : `budget.xlsx` à la racine (feuilles `Situation`, `Mensuel`, `Annuel`, `Exceptionnel`). **Amendement du PO (2026-10-19) :** l'estimation automatique de prêts étudiants (I9, I10, décision 6) est abandonnée ; elle est remplacée par la saisie manuelle de revenus/dépenses futurs (montant mensuel sur une période, ou échéances annuelles), qui permet de modéliser un prêt à la main.

## Global Constraints

- Application en **page HTML sans serveur applicatif** (pas de Django), exécutable depuis ce répertoire ; **Chrome ou Edge uniquement**, autorisation du dossier redonnée à chaque session.
- Le script Python ne fait **que** la conversion Excel → YAML ; l'application n'écrit **jamais** dans l'Excel.
- Projection **mensuelle**, départ **octobre 2026** (paramètre `depart`, défaut `"2026-10"`), horizon 10-15 ans (paramètre `horizon_annees`, défaut 15, min 10, max 15).
- Convention de signe : revenu = +, dépense = −. Un seul scénario. Pas d'intérêts d'épargne, pas d'impôts, pas d'inflation des dépenses, **pas de simulation automatique de prêts**.
- Revalorisation : 2 % par an (`revalorisation.taux`), appliquée aux seules lignes marquées `revalorise: true` (colonne Excel « Revalorisé » = `oui`), au mois `revalorisation.mois` (défaut 1 = janvier), la première fois strictement après le mois de départ.
- 3 fichiers YAML dans `data/` : `donnees-courantes.yaml` (régénéré à chaque import Excel), `evenements-futurs.yaml` et `parametres.yaml` (jamais écrasés par un import).
- Données réelles jamais versionnées : `.gitignore` contient `*.xlsx`, `data/*.yaml`, `prototypes/`. Les fixtures de test sont fictives.
- Début et fin de période **inclusifs** (« Fin 2032-07 » = dernier paiement en juillet 2032).
- Syntaxe d'échéance unique, partagée par l'Excel et les événements futurs (montants positifs, décimale = point, éléments séparés par une virgule) :
  - `800` : 800 € **chaque mois**, entre `debut` et `fin` (facultatifs) ;
  - `3-300` ou `3:300` : 300 € **en mars, chaque année** ; `6-500, 10-500` : X fois par an, un élément par mois ; années restreintes par `debut`/`fin` ;
  - `2026-3-300` ou `2026-03:300` : 300 € **en mars 2026 uniquement**.
  Un même texte ne mélange pas les trois formes.
- Commits : message conventionnel, terminé par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Échéance invalide (`13:500`, `abc`, `6:`, mois seul `2026-3`, décimale à virgule `5:1237,5` qui ressemble à deux éléments) : refusée avec un message clair ; dans le script Python, l'erreur nomme feuille + ligne et **n'écrase pas** un `donnees-courantes.yaml` existant.
- Équivalence des notations : `3-300`, `3:300`, `03-300` donnent le même résultat ; `2026-3-300` = `2026-03:300` ; `2026-3-300` dans un événement avec `debut`/`fin` hors de cette date → aucune occurrence, sans erreur.
- Événement ou ligne daté hors fenêtre de projection → ignoré sans erreur ; `fin` < `debut` → refusé à la saisie et à l'import.
- Premier lancement : `evenements-futurs.yaml` / `parametres.yaml` absents ou vides → traités comme vides/défauts, jamais d'écran blanc ; YAML édité à la main et invalide → message nommant le fichier, **sans l'écraser**.
- Navigateur sans File System Access (Firefox/Safari) → message explicite, pas de page cassée ; dossier choisi sans `donnees-courantes.yaml` → invitation à lancer `demarrer.sh`.

## File Structure

| Fichier | Responsabilité |
| :--- | :--- |
| `scripts/excel_to_yaml.py` | Lit `budget.xlsx`, valide, écrit `data/donnees-courantes.yaml` |
| `tests/py/test_excel_to_yaml.py` | Tests pytest du script |
| `tests/fixtures/echeances-cases.json` | Cas valides/invalides partagés JS + Python |
| `js/schedule.js` | Parseur d'échéances + génération des occurrences |
| `js/projection.js` | Projection mensuelle |
| `js/summary.js` | Restant mensuel, impact mensuel, synthèse événements, déficits, fins de prêt |
| `js/store.js` | Validation + lecture/écriture YAML via un handle de dossier |
| `js/ui-*.js`, `index.html`, `css/style.css` | Interface (shell, dashboard, tables, événements, paramètres) |
| `vendor/` | `chart.umd.js`, `js-yaml.min.js` |
| `tests/js/*.test.js` | Tests `node --test` |
| `demarrer.sh` | Conversion optionnelle puis ouverture de `index.html` |

Chaque module JS suit le pattern : `(function (root) { …; if (typeof module !== 'undefined') module.exports = api; else root.Budget = Object.assign(root.Budget || {}, api); })(this);`.

---

### Task 1: Scaffold, outillage et libs vendorisées

**Files:**
- Create: `.gitignore`, `pyproject.toml`, `package.json`, `README.md`, `vendor/chart.umd.js`, `vendor/js-yaml.min.js`, `tests/js/smoke.test.js`

**Interfaces:**
- Produces: `npm test` (lance `node --test tests/js/`), `uv run pytest tests/py` ; dossiers `scripts/ js/ css/ vendor/ data/ tests/{js,py,fixtures}`.

- [ ] **Step 1: `git init` et créer `.gitignore`** (`*.xlsx`, `data/*.yaml`, `prototypes/`, `node_modules/`, `.venv/`, `.pytest_cache/`, `__pycache__/`). `budget.xlsx` est donc exclu : normal (données réelles).
- [ ] **Step 2: `pyproject.toml`** (projet `budget`, `requires-python >=3.11`, deps `openpyxl`, `pyyaml`, dev `pytest`) ; **`package.json`** (`"scripts": {"test": "node --test tests/js/"}`, sans dépendance).
- [ ] **Step 3: Vendoriser les libs** dans un dossier temporaire séparé : `npm pack chart.js@4 js-yaml@4`, extraire, copier `dist/chart.umd.js` et `dist/js-yaml.min.js` dans `vendor/`. Ne rien exécuter depuis le dossier extrait.
- [ ] **Step 4: Test de fumée** `tests/js/smoke.test.js` : `assert.equal(1 + 1, 2)` ; lancer `npm test` → PASS, et `uv run pytest tests/py` (dossier vide) → « no tests ran » sans erreur d'outillage.
- [ ] **Step 5: Commit** `chore: scaffold tooling and vendored libs`.

---

### Task 2: Parseur d'échéances (`js/schedule.js`)

**Files:**
- Create: `js/schedule.js`, `tests/fixtures/echeances-cases.json`, `tests/js/schedule.test.js`

**Interfaces:**
- Produces:
  - `parseEcheances(text: string): Schedule` — `Schedule = {kind:'mensuel', montant:number} | {kind:'annuel', items:{mois:number, montant:number}[]} | {kind:'dates', items:{ym:string, montant:number}[]}` ; lève `Error` au message en français sinon.
  - `ym(year:number, month:number): string` (`"2026-10"`), `parseYm(s:string): {y:number, m:number}`, `monthIndex(s:string): number` (`y*12+m-1`).
  - `occurrences(schedule: Schedule, bornes: {debut?:string|null, fin?:string|null}, fenetre: {debut:string, fin:string}): {ym:string, montant:number}[]` — montants positifs, ordre chronologique, bornes inclusives, occurrences hors `fenetre` ou hors `bornes` omises. `bornes` s'applique aux trois formes (y compris une date unique : hors bornes → omise).
- Grammaire (non déterminée par la signature) : texte à un seul élément purement numérique `^\d+(\.\d+)?$` → `mensuel` ; sinon éléments séparés par `,`, chacun `^(?:(\d{4})-)?(\d{1,2})[-:](\d+(?:\.\d+)?)$` (mois 1-12, montant > 0) ; tous avec année → `dates`, aucun → `annuel`, mélange → erreur.
- `tests/fixtures/echeances-cases.json` : `{"valides":[{"texte":"800","kind":"mensuel"},{"texte":"1237.5","kind":"mensuel"},{"texte":"6:500, 10:500","kind":"annuel"},{"texte":"3-300","kind":"annuel"},{"texte":"6-500, 10-500","kind":"annuel"},{"texte":"2029-03:25000","kind":"dates"},{"texte":"2026-3-300","kind":"dates"},{"texte":"2026-10:50, 2026-11:50","kind":"dates"}],"invalides":["","13:500","0:5","abc","6:","6:-5","2029-13:5","2026-3","3-300-2026","5:100, 2029-03:5","5:1237,5","800, 3-300"]}`.

- [ ] **Step 1: Écrire les tests** : (a) chaque cas de `echeances-cases.json` : valide → `kind` attendu, invalide → `assert.throws` ; (b) `parseEcheances("3-300")` et `"3:300"` et `"03-300"` → même `Schedule` `{kind:'annuel', items:[{mois:3, montant:300}]}` ; (c) `"2026-3-300"` et `"2026-03:300"` → même `Schedule` `{kind:'dates', items:[{ym:'2026-03', montant:300}]}` ; (d) `occurrences` annuel `"6-500, 10-500"` sur fenêtre `2026-10..2028-09` → `[2026-10:500, 2027-06:500, 2027-10:500, 2028-06:500]` ; (e) mensuel `"800"` avec bornes `{debut:"2027-01", fin:"2027-03"}` → 3 occurrences ; (f) dates `"2029-03:25000"` hors fenêtre → `[]` ; (g) bornes `{fin:"2032-07"}` inclusive : dernière occurrence mensuelle = `2032-07` ; (h) `"3-300"` avec bornes `{debut:"2028-01", fin:"2029-12"}` → mars 2028 et mars 2029 seulement ; (i) `"2026-3-300"` avec bornes `{debut:"2027-01"}` → `[]`.
- [ ] **Step 2: Lancer** `npm test` → FAIL (module absent).
- [ ] **Step 3: Implémenter** les fonctions ci-dessus dans `js/schedule.js` selon la grammaire.
- [ ] **Step 4: Lancer** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: schedule parser and occurrences`.

---

### Task 3: Projection mensuelle (`js/projection.js`)

**Files:**
- Create: `js/projection.js`, `tests/js/projection.test.js`

**Interfaces:**
- Consumes: `occurrences`, `ym`, `parseYm`, `monthIndex` (Task 2).
- Produces:
  - Type `Ligne = {type:'revenu'|'depense', categorie:string, libelle:string, revalorise?:boolean, montant?:number|string, echeances?:string, debut?:string|null, fin?:string|null}` (ligne `mensuel` : `montant` numérique + `fin` ; lignes `annuel`/`exceptionnel` : `echeances` ; événement : `montant` au format texte d'échéance).
  - `Donnees = {situation:{compte_courant:number, epargne:number}, mensuel:Ligne[], annuel:Ligne[], exceptionnel:Ligne[]}`.
  - `PARAMETRES_DEFAUT` = `{depart:"2026-10", horizon_annees:15, revalorisation:{taux:0.02, mois:1}}`.
  - `project(donnees: Donnees, evenements: Ligne[], params: Parametres): Mois[]` avec `Mois = {ym:string, revenus:number, depenses:number, net:number, solde:number}` ; `revenus`/`depenses` positifs ; `net = revenus - depenses` ; `solde` cumulé, initialisé à `compte_courant + epargne` ; longueur `horizon_annees*12`.
  - Revalorisation : facteur `(1+taux)^k`, `k` = nombre de passages du mois `revalorisation.mois` strictement après `depart` jusqu'au mois courant inclus.

- [ ] **Step 1: Écrire les tests** (fixtures en littéraux, départ `2026-10`, `horizon_annees:1` accepté par `project` — la borne 10-15 n'est validée que dans le store) : (a) une dépense mensuelle 100 sans fin → `depenses===100` chaque mois, `solde` décroît de 100 ; (b) `fin:"2026-12"` → dépense présente oct/nov/déc seulement ; (c) revenu mensuel 1000 `revalorise:true` → 1000 en 2026-12, 1020 en 2027-01 ; (d) annuel `"3:600"` revenu → 600 en 2027-03 uniquement ; (e) annuel avec `debut:"2029-01"` → rien avant ; (f) exceptionnel `"2027-05:1500"` dépense → 1500 en 2027-05 ; (g) événement `montant:"800"` revenu `debut:"2027-01"` `fin:"2027-02"` ; (h) événement `montant:"3-300"` dépense `debut:"2027-01"` → 300 en 2027-03 ; (i) événement `montant:"2026-12-400"` revenu → 400 en 2026-12 ; (j) solde initial = compte + épargne ; (k) occurrence avant `depart` ou après l'horizon → ignorée, pas d'exception.
- [ ] **Step 2: Lancer** `npm test` → FAIL.
- [ ] **Step 3: Implémenter** `project` dans `js/projection.js` : normaliser chaque ligne en `{type, schedule, bornes, revalorise}` (le `montant` numérique d'une ligne `mensuel` devient un schedule mensuel ; un `montant` texte ou `echeances` passe par `parseEcheances`), agréger par mois via `occurrences`, appliquer le facteur de revalorisation.
- [ ] **Step 4: Lancer** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: monthly projection engine`.

---

### Task 4: Script `excel_to_yaml.py`

**Files:**
- Create: `scripts/excel_to_yaml.py`, `tests/py/test_excel_to_yaml.py`

**Interfaces:**
- Consumes: `tests/fixtures/echeances-cases.json` (Task 2).
- Produces:
  - `convert(xlsx_path: Path) -> dict` — retourne `{situation:{compte_courant, epargne}, mensuel:[{type, categorie, libelle, montant, revalorise, fin}], annuel:[{type, categorie, libelle, echeances, revalorise, debut, fin}], exceptionnel:[{type, categorie, libelle, echeances}]}` ; `type ∈ {revenu, depense}` (« dépense » → `depense`), `revalorise` booléen (`oui`/`non`), `debut`/`fin` `"AAAA-MM"` ou `null`. Lève `ExcelError(str)` avec « Feuille <nom>, ligne <n> : … ».
  - `valider_echeances(texte: str) -> None` (lève `ValueError`), même grammaire que Task 2.
  - CLI : `python scripts/excel_to_yaml.py <xlsx> [--sortie data/donnees-courantes.yaml]` ; code retour 1 + message stderr si erreur ; écriture via fichier temporaire puis `os.replace` (jamais d'écrasement partiel).
- Contrat de feuilles (identique à `budget.xlsx`) : `Situation` (`Poste`/`Montant`, lignes `Compte courant` et `Épargne`), `Mensuel` (`Type, Catégorie, Libellé, Montant, Revalorisé, Fin`), `Annuel` (`Type, Catégorie, Libellé, Échéances, Revalorisé, Début, Fin`), `Exceptionnel` (`Type, Catégorie, Libellé, Échéances`). En-têtes vérifiés (erreur si absents) ; lignes vides ignorées ; `Début`/`Fin` cellules texte `AAAA-MM` (une date Excel est convertie) ; `fin < debut` refusé. Les échéances existantes du fichier (`6:500, 10:500`, `2027-05:1500.0`) restent valides sans migration.

- [ ] **Step 1: Écrire les tests** (fixture Excel construite avec openpyxl dans un `tmp_path`) : (a) conversion nominale (valeurs exactes de 2 lignes par feuille + situation 350/4000) ; (b) `valider_echeances` : tous les `valides` passent, tous les `invalides` de `echeances-cases.json` lèvent ; (c) échéance `"3-300"` acceptée dans `Annuel` ; (d) en-tête manquant → `ExcelError` nommant la feuille ; (e) échéance invalide à la ligne 3 de `Annuel` → message contient `Annuel` et `ligne 3` ; (f) CLI en échec ne modifie pas un `--sortie` pré-existant (contenu identique après) ; (g) `fin < debut` → erreur ; (h) conversion du vrai `budget.xlsx` racine si présent (`pytest.skip` sinon) : `Prime Leader` a `debut == "2029-01"` et le nombre de lignes `Mensuel` égale celui lu dans le fichier.
- [ ] **Step 2: Lancer** `uv run pytest tests/py -v` → FAIL.
- [ ] **Step 3: Implémenter** `scripts/excel_to_yaml.py` (openpyxl `read_only`, `data_only=True` ; `yaml.safe_dump(..., allow_unicode=True, sort_keys=False)`).
- [ ] **Step 4: Lancer** `uv run pytest tests/py -v` → PASS ; puis `uv run python scripts/excel_to_yaml.py budget.xlsx` → crée `data/donnees-courantes.yaml`.
- [ ] **Step 5: Commit** `feat: excel to yaml converter` (sans `data/`).

---

### Task 5: Store YAML (`js/store.js`)

**Files:**
- Create: `js/store.js`, `tests/js/store.test.js`

**Interfaces:**
- Consumes: `parseEcheances`, `parseYm` (Task 2), `PARAMETRES_DEFAUT` (Task 3), `jsyaml` (global navigateur / `require('../vendor/js-yaml.min.js')` en Node).
- Produces:
  - `FICHIERS = {donnees:'donnees-courantes.yaml', evenements:'evenements-futurs.yaml', parametres:'parametres.yaml'}`.
  - `validerLigne(l: Ligne, nature:'mensuel'|'annuel'|'exceptionnel'|'evenement'): void` (lève `Error` français : type invalide, échéance invalide, `fin<debut`, montant mensuel ≤ 0…).
  - `loadAll(dir: DirHandle): Promise<{donnees:Donnees|null, evenements:Ligne[], parametres:Parametres}>` — `donnees:null` si `donnees-courantes.yaml` absent ; fichiers événements/paramètres absents ou vides → `[]` / `PARAMETRES_DEFAUT` fusionné profondément avec le contenu ; YAML invalide ou ligne invalide → `Error` dont le message contient le nom du fichier.
  - `saveDonnees(dir, donnees)`, `saveEvenements(dir, evenements)`, `saveParametres(dir, params): Promise<void>` — valident avant d'écrire (`horizon_annees` ∈ [10, 15]).
  - `DirHandle` = sous-ensemble de `FileSystemDirectoryHandle` : `getFileHandle(name, {create?})` → `{getFile(): Promise<{text(): Promise<string>}>, createWritable(): Promise<{write(s), close()}>}` ; rejette avec `e.name==='NotFoundError'` si absent.
  - `supported(): boolean` (`'showDirectoryPicker' in window`).
  - Événement : `{id:string, type:'revenu'|'depense', categorie ∈ CATEGORIES_EVENEMENT, libelle, montant:string (syntaxe d'échéance), debut:string|null, fin:string|null}` ; `CATEGORIES_EVENEMENT = ['Études','Prêt','Achat','Revenu','Autre']`.

- [ ] **Step 1: Écrire les tests** avec un faux `DirHandle` en mémoire (Map) : (a) `loadAll` sur dossier vide → `donnees:null`, `evenements:[]`, paramètres = défauts ; (b) fichier `evenements-futurs.yaml` vide (`""`) → `[]` ; (c) aller-retour `saveEvenements` → `loadAll` identique ; (d) YAML invalide dans `parametres.yaml` → `Error` contenant `parametres.yaml`, et le contenu du faux fichier est inchangé ; (e) `validerLigne` refuse échéance `13:500`, `fin<debut`, type `autre` ; accepte `montant:"3-300"` et `"2026-3-300"` ; (f) paramètres partiels (`horizon_annees: 12` seul) fusionnés avec défauts ; (g) `horizon_annees: 20` refusé.
- [ ] **Step 2: Lancer** `npm test` → FAIL.
- [ ] **Step 3: Implémenter** `js/store.js`.
- [ ] **Step 4: Lancer** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: yaml store with validation`.

---

### Task 6: Synthèses (`js/summary.js`)

**Files:**
- Create: `js/summary.js`, `tests/js/summary.test.js`

**Interfaces:**
- Consumes: `Donnees`, `Ligne`, `Parametres`, `Mois` (Task 3), `occurrences` (Task 2).
- Produces:
  - `restantMensuel(donnees: Donnees): number` — somme revenus mensuels − dépenses mensuelles (montants de départ, sans revalorisation).
  - `impactMensuel(lignes: Ligne[], params: Parametres): {libelle:string, total_annuel:number, impact_mensuel:number}[]` — pour chaque ligne `annuel`/`exceptionnel`, total sur les 12 mois à partir de `depart` (signé : revenu +, dépense −), `impact_mensuel = total/12`.
  - `restantMoyen(donnees: Donnees, params: Parametres): number` = restant mensuel + somme des impacts mensuels des lignes `annuel` et `exceptionnel`.
  - `syntheseEvenements(evenements: Ligne[], params: Parametres): {type, categorie, par_annee:Record<string,number>, total:number}[]` — regroupé par type puis catégorie, montants par année civile dans la fenêtre de projection, signés.
  - `deficits(mois: Mois[]): {debut:string, fin:string, manque_max:number, mois_en_deficit:number}[]` — périodes consécutives où `solde<0` ; `manque_max` positif.
  - `finsDePret(donnees: Donnees): {libelle:string, fin:string, libere_par_mois:number}[]` — lignes `mensuel` de type dépense avec `fin` non nul, triées par `fin` (I3).

- [ ] **Step 1: Écrire les tests** : (a) `restantMensuel` = 8000−7000 sur fixture ; (b) `impactMensuel` : annuel dépense `"6-600"` → `impact_mensuel === -50` ; (c) `deficits` sur série de soldes `[+,-,-,+,-]` → 2 périodes avec `manque_max` corrects ; solde jamais négatif → `[]` ; (d) `syntheseEvenements` : 2 événements de même catégorie sur 2 années → totaux par année exacts, type revenu séparé de dépense même catégorie ; événement mensuel `"800"` du `2027-01` au `2028-06` → 9600 en 2027, 4800 en 2028 ; (e) `finsDePret` trié et ignore les lignes sans `fin` ; (f) événements hors fenêtre ignorés.
- [ ] **Step 2: Lancer** `npm test` → FAIL.
- [ ] **Step 3: Implémenter** dans `js/summary.js`.
- [ ] **Step 4: Lancer** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: summaries and deficit detection`.

---

### Task 7: Shell UI, démarrage et dashboard

**Files:**
- Create: `index.html`, `css/style.css`, `js/ui-app.js`, `js/ui-dashboard.js`

**Interfaces:**
- Consumes: `supported`, `loadAll`, `saveDonnees`, `saveEvenements`, `saveParametres` (Task 5) ; `project` (Task 3) ; `deficits`, `finsDePret` (Task 6) ; `Chart` (vendor).
- Produces: état partagé `Budget.state = {dir, donnees, evenements, parametres}` ; `Budget.refresh(): void` (recalcule la projection et redessine tous les onglets) ; `Budget.persist(kind:'donnees'|'evenements'|'parametres'): Promise<void>` (écrit puis `refresh`) ; `Budget.registerTab(id:string, titre:string, render:(root:HTMLElement)=>void)`.
- Contenu : écran d'accueil (bouton « Ouvrir le dossier data/ » → `showDirectoryPicker({mode:'readwrite'})` ; message dédié si navigateur non supporté, ou si `donnees:null` : « Lancez `./demarrer.sh` pour importer budget.xlsx ») ; onglets via `registerTab` ; dashboard : deux histogrammes Chart.js superposés — mensuel revenus (+, bleu) / dépenses (−, rouge), puis solde cumulé (positif/négatif colorés) ; tableau des périodes de déficit (`deficits`) avec montant manquant ; liste des fins de prêt/charges (`finsDePret`) ; design épuré, palette bleu/rouge accessible, mode sombre via `prefers-color-scheme`. Consulter la skill `dataviz` avant les graphes.

- [ ] **Step 1: Créer `index.html`** (scripts classiques dans l'ordre vendor → js/schedule, projection, summary, store → ui-*) et `css/style.css`.
- [ ] **Step 2: Implémenter** `ui-app.js` (état, accueil, onglets, `refresh`, `persist`, erreurs de `loadAll` affichées dans un bandeau) et `ui-dashboard.js`.
- [ ] **Step 3: Vérifier à la main** (skill `chrome-devtools-mcp:chrome-devtools`) : ouvrir `file:///…/index.html`, vérifier `window.isSecureContext === true` et la présence de `showDirectoryPicker` ; avec `data/donnees-courantes.yaml` généré (Task 4) et, si le sélecteur natif est inutilisable en automatisation, un faux handle injecté via `evaluate_script`, constater : 180 barres, solde < 0 dès `2027-02` (≈ −295 € avec le `budget.xlsx` actuel), aucune erreur console.
- [ ] **Step 4: Commit** `feat: app shell and dashboard`.

---

### Task 8: Onglets Mensuel et Annuel/Exceptionnel (édition, suppression)

**Files:**
- Create: `js/ui-tables.js`
- Modify: `index.html` (script)

**Interfaces:**
- Consumes: `Budget.state`, `Budget.persist`, `Budget.registerTab` (Task 7) ; `validerLigne` (Task 5) ; `restantMensuel`, `impactMensuel`, `restantMoyen` (Task 6).
- Produces: onglet « Mensuel » (tableau groupé par catégorie : libellé, montant, revalorisé, fin ; total revenus, total dépenses, **restant mensuel** affiché à côté) ; onglet « Annuel & exceptionnel » (libellé, échéances, début, fin, revalorisé, **impact mensuel** par ligne et total, bulle d'aide sur la syntaxe). Chaque cellule modifiable en place ; chaque ligne supprimable (confirmation) ; ajout d'une ligne ; toute modification est validée (`validerLigne`), erreur affichée sur la ligne sans enregistrer, puis `persist('donnees')` → graphes recalculés (I19, I24, I25, I26). Bandeau permanent : « Les modifications des lignes importées sont perdues au prochain import Excel — reportez-les dans budget.xlsx ».

- [ ] **Step 1: Implémenter** `ui-tables.js`.
- [ ] **Step 2: Vérifier à la main** (navigateur) : modifier un montant mensuel → le restant mensuel et l'histogramme changent ; saisir échéance `13:500` → rejetée avec message, YAML inchangé ; supprimer une ligne → absente du YAML après rechargement.
- [ ] **Step 3: Commit** `feat: editable monthly and annual tables`.

---

### Task 9: Onglet Revenus et dépenses futurs

**Files:**
- Create: `js/ui-events.js`
- Modify: `index.html` (script)

**Interfaces:**
- Consumes: `Budget.state`, `Budget.persist`, `Budget.registerTab` (Task 7) ; `validerLigne`, `CATEGORIES_EVENEMENT` (Task 5) ; `syntheseEvenements` (Task 6).
- Produces: formulaire (type revenu/dépense **explicite**, catégorie, libellé, montant, début, fin) où le champ « montant » accepte les trois formes de la syntaxe d'échéance, avec bulle d'aide : « `800` = 800 € par mois entre début et fin · `3-300` = 300 € chaque mars · `6-500, 10-500` = plusieurs fois par an · `2026-3-300` = 300 € en mars 2026 seulement » ; liste modifiable/supprimable ; synthèse par type puis catégorie puis année ; chaque ajout/modification/suppression → `persist('evenements')` (écrit `evenements-futurs.yaml`, jamais `donnees-courantes.yaml`) ; `id` généré par `crypto.randomUUID()`. Cas d'usage couverts : études (mensuel avec début/fin), achat de voiture (date unique), prêt contracté à la main (revenu ponctuel puis dépense mensuelle avec début/fin), arrêt d'une dépense annuelle (`Etude Noé` : borner via `fin` sur la ligne importée dans Task 8) (I4, I15, I17, I22, I27).

- [ ] **Step 1: Implémenter** `ui-events.js`.
- [ ] **Step 2: Vérifier à la main** : ajouter « Études Noé » dépense `1237.5` début `2027-09` fin `2030-06` → barres rouges mensuelles, synthèse mise à jour ; ajouter « Prime » revenu `3-300` → barre bleue chaque mars ; ajouter « Voiture » dépense `2028-3-15000` → une seule barre ; `evenements-futurs.yaml` lisible à la main ; `fin < debut` refusé.
- [ ] **Step 3: Commit** `feat: future income and expense events tab`.

---

### Task 10: Onglet Paramètres, `demarrer.sh`, README, recette finale

**Files:**
- Create: `js/ui-params.js`, `demarrer.sh`
- Modify: `index.html`, `README.md`

**Interfaces:**
- Consumes: `Budget.state`, `Budget.persist`, `Budget.registerTab` (Task 7), `PARAMETRES_DEFAUT` (Task 3), `saveParametres` (Task 5).
- Produces: onglet « Paramètres » (départ, horizon 10-15, revalorisation taux + mois) écrivant `parametres.yaml` ; `demarrer.sh [--depuis-excel]` : si `budget.xlsx` existe et (`--depuis-excel` ou `data/donnees-courantes.yaml` absent) → `uv run python scripts/excel_to_yaml.py budget.xlsx` ; si `data/donnees-courantes.yaml` existe déjà, sans option et sans TTY → repart des YAML ; en TTY sans option, demande « Repartir de budget.xlsx (écrase les modifications faites dans la page) ? [o/N] » ; échec de conversion → arrêt avec message, YAML existants intacts ; puis `open -a "Google Chrome" index.html`. (Substitut du choix « Excel ou YAML au démarrage » : la page ne peut pas lancer Python — I21.)

- [ ] **Step 1: Implémenter** `ui-params.js` et `demarrer.sh` (`chmod +x`).
- [ ] **Step 2: README** : prérequis (uv, Chrome/Edge), usage de `demarrer.sh`, format du `budget.xlsx` (4 feuilles, syntaxe d'échéance), 3 fichiers YAML et leur cycle de vie, limites (pas de Firefox/Safari, autorisation de dossier à chaque session).
- [ ] **Step 3: Recette complète** : `npm test` et `uv run pytest tests/py` → tout PASS ; `./demarrer.sh --depuis-excel` ; dans Chrome : choisir `data/`, ajouter un revenu ponctuel `2027-2-1000` → le creux de 2027-02 disparaît du tableau des déficits ; recharger la page → événements et paramètres retrouvés ; relancer `./demarrer.sh --depuis-excel` → `evenements-futurs.yaml` et `parametres.yaml` inchangés (comparer `shasum` avant/après) ; en simulant `delete window.showDirectoryPicker` → message explicite.
- [ ] **Step 4: Commit** `feat: parameters tab, launcher and docs`.

---

## Self-Review

- **Couverture :** I1-I3 (T3, T6, T7) ; I4/I22/I27 (T5, T9) ; I5/I11/I13/I16/I18 (T4, T10) ; I6 (T3 solde initial) ; I7 (`.gitignore` T1) ; I8 (T3) ; I12/I20/I28 (T5, T9, T10) ; I14 (feuilles structurées T4) ; I15 (`fin` sur lignes annuelles, T2/T8) ; I17 (T6/T9) ; I19/I25/I26 (T8) ; I21 (T10, substitut documenté) ; I23/I24 (T7) ; I29 (T4-T7). **I9 et I10 (prêts étudiants automatiques) sont retirés par amendement du PO** ; le besoin de couvrir un déficit est traité à la main via T9.
- **Syntaxe :** `3-300` / `2026-3-300` ajoutées ; `:` et `-` acceptés indifféremment, donc `budget.xlsx` reste importable sans migration. La décimale à virgule (`1237,5`) n'est plus acceptée : elle est ambiguë avec le séparateur d'éléments, donc refusée avec message.
- **Points ouverts du brief tranchés ici :** horizon configurable 10-15 (défaut 15) ; revalorisation en janvier, selon la colonne « Revalorisé » et non selon la catégorie « salaire » ; « Augmentation fabrice Mai » reste le versement ponctuel déjà saisi dans l'Excel.
- **Écart connu avec le brief :** le brief annonce un point bas ≈ −800 € en janvier-février 2027 ; avec le `budget.xlsx` actuel, un calcul manuel donne ≈ −295 € en février 2027 (Excel plus récent). La recette vérifie « sous zéro dès 2027-02 », pas le montant du brief.
