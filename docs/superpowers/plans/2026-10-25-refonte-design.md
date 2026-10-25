# Refonte du design — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à l'application l'identité « éditorial chaleureux » (papier crème, titres à empattement, vert sapin et terre cuite, filets fins), avec des tableaux en présentation de relevé et des animations discrètes, sans changer aucune fonction.

**Architecture:** Les couleurs, polices, espacements et durées passent dans des variables CSS partagées (`css/theme.css`, jeu clair et jeu sombre) ; la mise en page reste dans `css/style.css` et le mouvement dans `css/mouvement.css`. Les noms de variables que le JavaScript lit déjà sont conservés (leurs valeurs changent). De petits modules purs (`js/format.js`, `js/graphiques.js`, `js/icones.js`) portent ce qui se teste sans navigateur ; les fichiers d'interface existants ne gardent plus de couleur ni de taille en dur.

**Tech Stack:** CSS (variables, `@media (prefers-color-scheme)`, `@media (prefers-reduced-motion)`), JS vanilla en scripts classiques, Chart.js déjà fourni, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-25-refonte-design-design.md` (décisions du PO, maquettes de la direction C et de l'onglet Mensuel, précisions du constructeur).

## Global Constraints

- Direction retenue : « éditorial chaleureux » : papier crème, titres à empattement, vert sapin et terre cuite, filets fins plutôt que cartes à ombres.
- Aucun changement de fonctionnement, de calcul, de format de fichier ni de textes d'aide, sauf ajustement strictement nécessaire à la nouvelle mise en page.
- Pas de bibliothèque ni de police téléchargée : tout reste hors ligne et léger ; polices du système : pile à empattement (Iowan Old Style, Palatino, Georgia) pour les titres et grands chiffres, pile sans empattement du système pour libellés et champs.
- Valeurs de départ de la palette (le niveau AA prime et peut les assombrir) : crème `#f7f1e6`, vert sapin `#2f5d50`, terre cuite `#c0562f`, encre `#2b2a24`, filet `#d9cfb8`, gris chaud `#7d745f`. Mode sombre « papier de nuit » : brun profond, texte crème, mêmes verts et terre cuite ; automatique selon l'ordinateur, sans bouton.
- Noms de variables CSS existants à conserver (le JavaScript les lit) : `--fond`, `--carte`, `--encre`, `--encre-2`, `--trait`, `--grille`, `--accent`, `--positif` (vert), `--negatif` (terre cuite), `--positif-fond`, `--negatif-fond`.
- Accessibilité : contrastes de niveau AA dans les deux thèmes ; focus clavier toujours visible ; cibles d'action assez grandes ; « réduire les animations » = aucun mouvement ; les animations n'empêchent jamais d'utiliser la page.
- La visite guidée s'appuie sur des attributs `data-aide` : ils sont tous conservés et les zones restent visibles (le test statique de `tests/js/visite.test.js` doit rester vert).
- Les tests existants (`npm test`, 191 en JS ; `uv run pytest tests/py -q`, 34) restent verts ; ceux qui vérifient la structure ou des noms de classes peuvent être modifiés quand la mise en page change, pas les assertions de comportement ni de calcul.
- Impression : fonds clairs, sans animation, lisible. Navigateurs : Chrome et Edge récents.
- Graphiques : Chart.js, uniquement le vert sapin et la terre cuite avec leurs nuances ; solde cumulé en courbe avec une aire douce ; mois écrits en lettres (« oct. 2026 ») ; plus de légende redondante.
- Onglet Mensuel : trois grands chiffres (Revenus, Dépenses, Reste chaque mois) ; « Mensualités de prêts (moyenne) » et « Reste chaque mois après prêts » restent sur une ligne plus petite ; la case « Palier » garde son libellé ; l'œil et la suppression deviennent de petites icônes avec nom accessible et info-bulle ; les cellules vides affichent « — » et le format `AAAA-MM` est indiqué dans l'en-tête ; champs modifiables repérables au repos par un fin soulignement pointillé clair ; aucun nouveau calcul de total.
- Livraison : une branche, une étape par commit, captures d'écran jointes à chaque relecture ; la republication de la page en ligne n'a lieu qu'à la demande du PO.
- Commits : message conventionnel, terminé par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Contrastes : texte en terre cuite ou en vert sur crème, texte sur bouton, gris du texte secondaire, dans les deux thèmes (test dans la Task 1).
- « Réduire les animations » : aucun mouvement CSS ni animation Chart.js, et la visite guidée ne glisse plus (Tasks 2 et 5).
- Libellés très longs, montants très grands ou négatifs (`-1 234 567 €`) et nombreuses catégories : pas de débordement ni de coupure, les cellules passent à la ligne (vérification navigateur des Tasks 3 et 4).
- États vides : aucune ligne, aucun palier, aucun prêt, mois sans mouvement, projection sans donnée : pas de trou ni de zone vide incompréhensible (Tasks 2, 3 et 4).
- Changement de thème du système pendant que la page est ouverte : graphiques, bandeau de chiffres et visite guidée prennent les bonnes couleurs sans rechargement (Tasks 2 et 5).

## File Structure

| Fichier | Responsabilité |
| :--- | :--- |
| `css/theme.css` (nouveau) | Variables : couleurs (clair et sombre), polices, espacements, rayons, durées ; échelle typographique |
| `css/style.css` (réécrit) | Mise en page et composants (en-tête, sections à filets, boutons, champs, tableaux en relevé, bulles) sans valeur en dur |
| `css/mouvement.css` (nouveau) | Animations d'entrée et transitions, bloc `prefers-reduced-motion` |
| `js/format.js` (nouveau) | `moisCourt`, `moisLong` |
| `js/graphiques.js` (nouveau) | Couleurs du thème, options Chart.js communes, durée d'animation, abonnement au changement de thème |
| `js/icones.js` (nouveau) | Icônes SVG simples (œil, œil barré, corbeille, palier) |
| `js/summary.js` (modifié) | `chiffresCles` |
| `js/ui-*.js`, `index.html` (modifiés) | Utilisent les nouveaux modules et classes ; aucune couleur en dur |
| `tests/js/contraste.test.js`, `format.test.js`, `graphiques.test.js`, `icones.test.js`, `chiffres-cles.test.js` | Tests Node |

Chaque module JS suit le patron `(function (root) { …; if (typeof module !== 'undefined') module.exports = api; else root.Budget = Object.assign(root.Budget || {}, api); })(this);`.

---

### Task 1: Socle commun (variables, typographie, composants, thème sombre)

**Files:**
- Create: `css/theme.css`, `tests/js/contraste.test.js`
- Modify: `css/style.css`, `index.html` (ordre : `theme.css`, `style.css`)

**Interfaces:**
- Produces (variables, `:root` clair puis `@media (prefers-color-scheme: dark)` sombre) : les onze noms existants (valeurs nouvelles) et les nouveaux `--police-titre`, `--police-texte`, `--filet` (filets fins), `--papier-2` (aplat très léger pour bandes de catégorie), `--rayon`, `--espace-1` à `--espace-5`, `--duree-courte`, `--duree-longue`, `--ease`, et l'échelle `--taille-1` à `--taille-5` (texte, titre de section, titre de page, grand chiffre, très grand chiffre).

- [ ] **Step 1: Écrire le test `tests/js/contraste.test.js`** : une fonction locale `contraste(hexA, hexB)` (luminance relative WCAG) ; le test lit `css/theme.css`, extrait le jeu clair (bloc `:root`) et le jeu sombre (bloc dans `@media (prefers-color-scheme: dark)`), puis exige un rapport ≥ 4.5 pour : `--encre` sur `--fond` et sur `--carte` ; `--encre-2` sur `--fond` et sur `--carte` ; `--positif` sur `--fond` et sur `--carte` (texte vert) ; `--negatif` sur `--fond` et sur `--carte` (texte terre cuite) ; `--carte` sur `--accent` (texte de bouton) ; `--positif` sur `--positif-fond` et `--negatif` sur `--negatif-fond`. Un second test vérifie que tous les noms de variables listés dans les Interfaces existent dans les deux jeux (hors variables non colorées présentes dans le jeu clair seulement) et que `css/style.css` ne contient aucun code couleur hexadécimal en dur (`#xxxxxx`), hors commentaires.
- [ ] **Step 2: Lancer** `npm test` → les nouveaux tests échouent (`css/theme.css` absent).
- [ ] **Step 3: Écrire `css/theme.css`** à partir des valeurs de départ des Global Constraints ; ajuster les teintes (assombrir terre cuite/vert en texte, gris secondaire) jusqu'à ce que le test passe ; jeu sombre « papier de nuit ».
- [ ] **Step 4: Réécrire `css/style.css`** sur ces variables : en-tête sticky sobre (titre à empattement, onglets avec filet actif), contenu en sections séparées par des filets (plus de cartes ombrées ni de bordures grises lourdes), titres de section à empattement, boutons (plein vert sapin / discret), champs (fond léger, bordure fine, focus visible vert), menus déroulants, étiquettes, bandeaux d'erreur et d'avertissement, tableaux existants provisoirement dans le nouveau style de base. Aucune valeur de couleur en dur. Conserver toutes les classes utilisées par les fichiers `js/ui-*.js` et `js/visite.js` (grep avant de renommer).
- [ ] **Step 5: Lancer** `npm test` et `uv run pytest tests/py -q` → tout passe (adapter seulement les tests qui vérifient des noms de classes retirés).
- [ ] **Step 6: Vérifier à la main** (navigateur isolé, données fictives, `file://`) : les six onglets et l'écran d'accueil dans le nouveau style clair, puis en émulant `prefers-color-scheme: dark` ; captures d'écran de chaque onglet dans `.superpowers/captures/` ; focus clavier visible sur boutons, champs et onglets ; aucune erreur de console ; la visite guidée fonctionne encore.
- [ ] **Step 7: Commit** `feat: design tokens and base components for the editorial theme`.

---

### Task 2: Tableau de bord et graphiques

**Files:**
- Create: `js/format.js`, `js/graphiques.js`, `tests/js/format.test.js`, `tests/js/graphiques.test.js`, `tests/js/chiffres-cles.test.js`
- Modify: `js/summary.js`, `js/ui-dashboard.js`, `css/style.css`, `index.html`

**Interfaces:**
- Consumes: variables CSS de la Task 1 ; `Budget.state.mois: {ym, revenus, depenses, net, solde}[]`.
- Produces :
  - `moisCourt(ym: string): string` (`'2026-10'` → `'oct. 2026'` ; abréviations `janv.`, `févr.`, `mars`, `avr.`, `mai`, `juin`, `juil.`, `août`, `sept.`, `oct.`, `nov.`, `déc.`) et `moisLong(ym: string): string` (`'octobre 2026'`, sans décalage de fuseau).
  - `chiffresCles(mois: Mois[]): { debut: {ym, solde, net}, fin: {ym, solde} } | null` (`null` si `mois` est vide), dans `js/summary.js`.
  - `couleursTheme(): { encre2, grille, positif, negatif, positifFond }` (lit les variables CSS) ; `optionsCommunes(): object` (options Chart.js : sans légende, grilles très légères, étiquettes en lettres via `moisCourt`) ; `animationsReduites(): boolean` ; `dureeAnimation(reduit: boolean, ms: number): number` (0 si `reduit`) ; `surChangementTheme(rappel: () => void): () => void` (appelle `rappel` quand le thème du système change, retourne la fonction de désabonnement).

- [ ] **Step 1: Écrire les tests** : `moisCourt('2026-10') === 'oct. 2026'`, `moisCourt('2027-05') === 'mai 2027'`, `moisCourt('2027-02') === 'févr. 2027'`, `moisLong('2026-10') === 'octobre 2026'` ; `dureeAnimation(true, 700) === 0` et `dureeAnimation(false, 700) === 700` ; `chiffresCles([])` → `null`, sur trois mois `{ym, solde, net, solde}` pris au premier et au dernier mois ; `surChangementTheme` avec un faux `matchMedia` : le rappel est appelé au changement et plus après désabonnement.
- [ ] **Step 2: Lancer** `npm test` → échec attendu.
- [ ] **Step 3: Implémenter** `js/format.js`, `js/graphiques.js` et `chiffresCles` ; remplacer dans `js/ui-dashboard.js` les couleurs et options Chart.js locales par `couleursTheme`/`optionsCommunes`, le formatage de mois par `moisCourt`/`moisLong`.
- [ ] **Step 4: Refaire le tableau de bord** : un bandeau de trois grands chiffres souligné (« Solde fin <mois 1> », « Net du mois », « Solde fin <dernier mois> », à partir de `chiffresCles`, sans nouveau calcul) ; les deux graphiques de solde cumulé en courbe avec aire douce (vert sapin, terre cuite sous zéro) ; barres fines si un histogramme subsiste ; infobulle HTML restylée ; carte « Détail d'un mois par catégorie » restylée (deux colonnes à filets, titres de catégorie à empattement avec leur total) ; animations : la courbe se trace et le bandeau apparaît en fondu, avec `dureeAnimation(animationsReduites(), …)` ; redessin des graphiques via `surChangementTheme`.
- [ ] **Step 5: Lancer** `npm test` et `uv run pytest tests/py -q` → tout passe.
- [ ] **Step 6: Vérifier à la main** (navigateur isolé, données fictives) : bandeau, courbes, infobulle, détail du mois, en clair et en sombre ; « réduire les animations » émulé : aucun mouvement ; bascule du thème du système avec la page ouverte : les graphiques se redessinent aux bonnes couleurs ; projection vide ou mois sans mouvement : pas de trou ; captures dans `.superpowers/captures/` ; la visite guidée de cet onglet cible toujours ses zones.
- [ ] **Step 7: Commit** `feat: editorial dashboard with area charts and key figures`.

---

### Task 3: Onglet Mensuel en relevé

**Files:**
- Create: `js/icones.js`, `tests/js/icones.test.js`
- Modify: `js/ui-tables.js` (rendu de l'onglet Mensuel), `js/ui-paliers.js` (présentation des sous-lignes), `css/style.css`, `index.html`

**Interfaces:**
- Consumes: Tasks 1 et 2 ; le rendu et les gestionnaires existants de `js/ui-tables.js` (identités de lignes, `commit`, validation, `data-aide`).
- Produces: `ICONES: Record<string, string[]>` (noms `oeil`, `oeil-barre`, `corbeille`, `palier` → données de tracés SVG) ; `creerIcone(nom: string, options?: { titre?: string }): SVGElement` (`aria-hidden="true"` sauf si `titre` ; erreur sur un nom inconnu ; construit par `createElementNS`, jamais `innerHTML`).

- [ ] **Step 1: Écrire les tests** `tests/js/icones.test.js` : chaque nom attendu existe dans `ICONES` avec au moins un tracé non vide ; un nom inconnu lève une erreur au message français. Les tests de structure existants de l'onglet Mensuel sont adaptés si des classes changent.
- [ ] **Step 2: Lancer** `npm test` → échec attendu.
- [ ] **Step 3: Implémenter** `js/icones.js`.
- [ ] **Step 4: Refaire le rendu du Mensuel** selon la maquette validée : trois grands chiffres soulignés (Revenus, Dépenses, Reste chaque mois) puis une ligne plus petite pour « Mensualités de prêts (moyenne) » et « Reste chaque mois après prêts » ; en-têtes de colonne discrets (« Fin (AAAA-MM) ») ; lignes sans cases dessinées, champs repérables par un fin soulignement pointillé clair, case dessinée au survol et au focus ; montants alignés à droite en chiffres de largeur fixe ; titres de catégorie à empattement avec total à droite (vert revenus, terre cuite dépenses) ; cellules vides « — » ; case « Palier » avec son libellé ; œil et suppression en `creerIcone` avec `aria-label` et `title` ; sous-lignes de paliers et carte des paliers orphelins dans le même style. Toutes les clés `data-aide`, les `aria-label` des champs et les comportements (édition sur place, suppression avec confirmation, masquage) sont conservés.
- [ ] **Step 5: Lancer** `npm test` et `uv run pytest tests/py -q` → tout passe.
- [ ] **Step 6: Vérifier à la main** (navigateur isolé, données fictives avec libellé très long, montant `-1 234 567`, paliers, ligne masquée, aucune ligne dans une catégorie vide) : mise en page sans débordement ; les lignes se modifient et se suppriment comme avant ; focus clavier sur chaque champ et icône ; navigation clavier de tout l'onglet ; clair et sombre ; captures ; la visite guidée de l'onglet Mensuel cible toujours ses zones.
- [ ] **Step 7: Commit** `feat: statement-style Mensuel tab`.

---

### Task 4: Autres onglets et accueil

**Files:**
- Modify: `js/ui-tables.js` (Annuel & exceptionnel), `js/ui-events.js`, `js/ui-prets.js`, `js/ui-params.js`, `js/ui-app.js` (accueil et bandeaux), `js/ui-paliers.js`, `css/style.css`

**Interfaces:**
- Consumes: Tasks 1 à 3 (`creerIcone`, classes de relevé, bandeaux de chiffres).

- [ ] **Step 1: Appliquer le style de relevé** aux onglets Annuel & exceptionnel (y compris le tableau mois par mois des bilans), Revenus et dépenses futurs (y compris sa synthèse par année), Prêts, avec : champs repérables par un soulignement pointillé au repos, listes déroulantes avec chevron, case dessinée au survol et au focus, icônes d'action, `—` dans les cellules vides, aucun nouveau calcul de total dans les titres de catégorie.
- [ ] **Step 2: Restyler** l'onglet Paramètres (groupes de champs à filets, grands chiffres pour le solde de départ), l'écran d'accueil (invitation soignée, deux boutons clairs), les bandeaux d'erreur et d'avertissement, la carte « Sauvegarde », et les formulaires « Ajouter une ligne » de chaque onglet.
- [ ] **Step 3: Lancer** `npm test` et `uv run pytest tests/py -q` → tout passe (tests de structure adaptés au besoin).
- [ ] **Step 4: Vérifier à la main** (navigateur isolé, données fictives) : chaque onglet en clair et en sombre ; état vide de chaque onglet (aucune ligne, aucun événement, aucun prêt, aucun palier) ; libellés très longs et montants très grands ; saisie invalide (messages visibles et lisibles) ; écran « Navigateur non pris en charge » ; captures ; visite guidée de chaque onglet : les zones ciblées restent visibles.
- [ ] **Step 5: Commit** `feat: statement style on the remaining tabs, home and settings`.

---

### Task 5: Visite guidée, mouvement et finitions

**Files:**
- Create: `css/mouvement.css`
- Modify: `css/style.css`, `js/visite.js` (si le style l'exige), `js/ui-app.js` (transition entre onglets), `index.html`, `README.md`, `tests/js/graphiques.test.js`

**Interfaces:**
- Consumes: Tasks 1 à 4 ; `dureeAnimation`, `animationsReduites` (Task 2).
- Produces: classes `entree` (apparition en fondu avec léger glissement) et variable `--i` (rang pour décaler les éléments successifs), `echelonner(conteneur: Element): void` (affecte `--i` aux enfants directs) dans `js/graphiques.js` ou `js/ui-app.js` selon l'usage ; bloc `@media (prefers-reduced-motion: reduce)` qui neutralise toute animation et transition de `css/mouvement.css` et de `css/style.css`.

- [ ] **Step 1: Écrire les tests** : un test Node lit `css/mouvement.css` et `css/style.css` et vérifie qu'un bloc `@media (prefers-reduced-motion: reduce)` existe et couvre `animation` et `transition` (`none` ou durée `0`) ; un test vérifie que la visite guidée n'applique aucune transition sous ce bloc (règle présente pour le cadre et la bulle) ; `dureeAnimation` déjà testé en Task 2.
- [ ] **Step 2: Lancer** `npm test` → échec attendu.
- [ ] **Step 3: Écrire `css/mouvement.css`** : apparition des sections et blocs en cascade, transition douce entre onglets (fondu court), filets qui se tracent, boutons et champs avec transitions courtes, durées issues de `--duree-courte`/`--duree-longue` ; tout neutralisé sous `prefers-reduced-motion: reduce`.
- [ ] **Step 4: Restyler la visite guidée** (voile, cadre, bulle, boutons, compteur) avec les variables du thème ; vérifier que le cadre glisse en douceur et ne bouge plus sous « réduire les animations » ; brancher la transition entre onglets et l'échelonnage des blocs d'entrée.
- [ ] **Step 5: Finitions** : feuille d'impression (fonds clairs, aucune animation, en-tête et bulles masqués) ; revue des contrastes sur les états survol, focus et désactivé ; `README.md` : court paragraphe « Apparence » (thème clair et sombre automatique, animations réduites respectées).
- [ ] **Step 6: Lancer** `npm test` et `uv run pytest tests/py -q` → tout passe, y compris le test statique des `data-aide`.
- [ ] **Step 7: Vérifier à la main** (navigateur isolé, données fictives) : visite guidée de chaque onglet dans le nouveau style, en clair et en sombre, avec le thème système changé en cours de visite ; « réduire les animations » émulé sur toute l'application ; aperçu d'impression (`emulate` du média `print`) lisible ; captures finales de tous les onglets ; aucune erreur de console.
- [ ] **Step 8: Commit** `feat: motion, guided tour restyle and finishing touches`.

---

## Self-Review

- **Couverture de la conception :** identité et variables (Task 1) ; hiérarchie, chiffres clés, graphiques en courbe et mois en lettres, infobulle, détail du mois (Task 2) ; onglet Mensuel en relevé avec trois grands chiffres, palier visible, icônes, « — », pointillé au repos (Task 3) ; autres onglets, accueil, paramètres, bandeaux (Task 4) ; visite guidée, animations d'entrée et transitions, mouvement réduit, impression (Task 5) ; contrastes AA et test (Task 1) ; thème sombre automatique et redessin au changement de thème (Tasks 1, 2 et 5) ; `data-aide` conservés (Tasks 3 à 5, test statique existant) ; livraison par commits et captures, publication à la demande (Global Constraints).
- **Cohérence des noms :** `moisCourt`, `moisLong`, `chiffresCles`, `couleursTheme`, `optionsCommunes`, `animationsReduites`, `dureeAnimation`, `surChangementTheme`, `ICONES`, `creerIcone`, `echelonner` sont définis dans les Tasks 2, 3 et 5 et réutilisés tels quels dans les tâches suivantes.
- **Laissé au constructeur** (comme la conception) : valeurs exactes de la palette (sous contrainte AA), tracés exacts des icônes, durées et courbes d'animation, détail de l'écran d'accueil.
