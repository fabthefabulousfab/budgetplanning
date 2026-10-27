# Taux de revalorisation par ligne (revenus) et inflation (dépenses) — plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD, small commits.

**Goal:** Chaque ligne de revenu a son propre taux de revalorisation ; les dépenses cochées « Revalorisé » suivent un taux d'inflation unique réglé dans Paramètres.

**Architecture:** Une seule fonction de facteur par ligne dans `js/projection.js` (utilisée par la projection, `summary.js`, l'historique CSV, les graphiques) ; migration des anciens fichiers au chargement (`js/store.js`) ; l'UI remplace la case par un champ « Revalorisation (%) » pour les revenus seulement.

**Spec (décidée avec le PO, en chat) :**
- Dépenses : la case « Revalorisé » reste ; cochée, la ligne suit l'inflation = `parametres.yaml: revalorisation.taux` (format de fichier inchangé ; seul le libellé change en « Inflation (dépenses) »). Le mois d'application `revalorisation.mois` reste unique pour tous.
- Revenus : nouvelle clé de ligne `taux_revalorisation` (nombre en %, ex. `1.5`, négatif accepté, vide/absent/0 = pas de revalorisation). Remplace la case pour les lignes `type: revenu` (Mensuel, Annuel & exceptionnel, Futurs). Les dépenses n'ont jamais cette clé (la refuser à la validation pour une dépense).
- Migration : au chargement, un revenu avec `revalorise: true` et sans `taux_revalorisation` reçoit `taux_revalorisation = revalorisation.taux * 100` (taux global courant) ; `revalorise` est ensuite sans effet pour un revenu et n'est plus écrit pour un revenu. Les anciennes sauvegardes/fichiers s'ouvrent sans erreur et donnent exactement les mêmes projections qu'avant. Un changement ultérieur de l'inflation ne modifie plus les revenus.
- Changer le type d'une ligne dans l'UI revenu→dépense/dépense→revenu : ne pas perdre de donnée silencieusement (revenu→dépense : `revalorise = taux non nul`, clé supprimée ; dépense→revenu : `taux_revalorisation` = inflation actuelle si `revalorise` était vrai, sinon absent).
- Paliers : conserver la règle actuelle de combinaison avec la revalorisation de la ligne, mais avec le facteur propre à la ligne.
- Textes : aide de Paramètres, visite guidée (`js/visite-textes.js`, étapes concernées), README (tableau des colonnes, section clés YAML et validations, « Pas d'inflation (hors revalorisation configurée) »).

## Global Constraints
- Classic-script JS modules, aucun hex dans `css/style.css`, tests `node --test tests/js/` et `uv run pytest tests/py -q` verts (baseline 292 / 34).
- Validation stricte nommant le fichier ; ne jamais écraser un fichier invalide ; décimale à virgule refusée ; persistance via `Budget.refresh()` puis `persist(kind)`.
- Import Excel Python : ne pas casser (colonne Revalorisé oui/non reste valable ; un revenu « oui » est converti comme la migration).

## Review Focus
1. Ancien fichier (revenu `revalorise: true`) → mêmes chiffres qu'avant, au centime, y compris paliers et évènements futurs.
2. Revenu avec taux 0 / vide / négatif / texte invalide (« abc », « 1,5 ») : comportement et message d'erreur clairs.
3. Dépense avec `taux_revalorisation` dans un fichier : refusée avec message.
4. Changement de type d'une ligne : aucune perte silencieuse.
5. Sauvegarde exportée puis réimportée : identique ; ancienne sauvegarde importable.

### Task 1: moteur et données
**Files:** `js/projection.js`, `js/summary.js`, `js/store.js`, `js/tables-logic.js`, tests correspondants.
- `Pj.facteurLigne(params, ligneNormalisee, idx) -> number` : 1 si pas revalorisée ; revenu → `(1+taux_ligne/100)^passages` ; dépense → `(1+inflation)^passages`. `normaliser` expose `tauxReval` (fraction ou 0) et `revalorise` (dépense seulement). Remplacer tous les usages de `facteurReval` + `l.revalorise` (projection, summary lignes 167 et 222, détail/CSV/graphiques) ; garder `facteurReval` si encore utile.
- `store.js` : validation de `taux_revalorisation` (nombre fini, revenus seulement), migration au chargement dans `loadAll` (donnees mensuel/annuel/exceptionnel et evenements), exclusion de `revalorise` à l'écriture pour les revenus.
- `tables-logic.js` : édition du champ `taux_revalorisation`, règle de changement de type ci-dessus.
- Tests : équivalence ancien/nouveau (Review Focus 1), validations, changement de type, aller-retour sauvegarde.
- Commit: `feat: per-line revaluation rate for revenues, inflation for expenses (engine and data)`

### Task 2: interface, textes, README
**Files:** `js/ui-tables.js`, `js/ui-params.js`, `js/visite-textes.js`, `css/style.css`, `README.md`, `tests/`.
- Tableaux Mensuel / Annuel / Futurs : revenu → champ texte « Revalorisation (%) » (même style que les champs du relevé, aligné à droite, placeholder `0`, validation comme l'édition des montants, message d'erreur inline) à la place de la case ; dépense → case « Revalorisé » inchangée. Respecter les layouts étroits (≤960 px, épinglage 580–720 px), l'impression (jumeaux `valeur-impression`) et le mode sombre.
- Paramètres : libellé « Inflation (dépenses) : taux annuel (%) », aide « Appliqué aux dépenses cochées « Revalorisé ». Les revenus ont chacun leur taux dans leur ligne. » ; garder le champ du mois.
- Visite et README mis à jour. Captures 1280/585/320 clair et sombre, Mensuel + Annuel + Paramètres.
- Commit: `feat: revaluation rate field on revenue lines, inflation label in settings`
