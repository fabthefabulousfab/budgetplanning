# Partage du budget via Google Drive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à deux personnes d'ouvrir la même application depuis n'importe quel navigateur, avec des données et des versions nommées stockées dans le Google Drive du compte familial, sans rien installer.

**Architecture:** Les modules métier restent inchangés : ils lisent et écrivent déjà à travers une petite interface de dossier (`getFileHandle(nom, {create})` → `{getFile(): {text()}, createWritable(): {write, close}}`, `NotFoundError` si absent). On ajoute une réalisation « Drive » de cette interface (`js/drive-dir.js`) au-dessus d'un client REST Drive (`js/drive-api.js`) et d'une connexion Google (`js/drive-auth.js`), une logique de versions (`js/versions.js`) et une interface (`js/ui-drive.js`). Le mode « dossier local » actuel reste tel quel. Un dossier de publication ne contient que les fichiers de l'application.

**Tech Stack:** JS vanilla (scripts classiques), Google Identity Services (modèle jeton d'accès), API REST Drive v3 par `fetch`, `node --test` avec des fausses dépendances injectées.

**Spec:** `docs/superpowers/specs/2026-10-22-partage-drive-design.md` (décisions du PO et du constructeur, essai préalable, plan B).

## Global Constraints

- Droits Google : portée `https://www.googleapis.com/auth/drive.file` uniquement (fichiers créés par l'application) ; aucun accès au reste du Drive.
- Connexion : modèle « jeton d'accès » de Google Identity Services, sans serveur ; jeton d'environ une heure ; reconnexion par un clic ; modifications en attente conservées puis réessayées après reconnexion.
- Structure Drive : dossier `Budget` à la racine ; un sous-dossier par version ; chaque version contient les fichiers `donnees-courantes.yaml`, `evenements-futurs.yaml`, `parametres.yaml`, `paliers.yaml`, `historique-comptes.csv` (clés de `FICHIERS` dans `js/store.js`).
- Version active : propre à chaque appareil (stockage du navigateur), `Base` par défaut ; aucun fichier « version courante » dans le Drive ; pas de renommage ni de suppression de version dans l'application.
- Conflit : vérification par fichier juste avant l'écriture ; si le fichier a changé depuis sa dernière lecture, l'écriture est suspendue et l'utilisateur choisit écraser, recharger (en abandonnant, après confirmation, la modification en cours) ou annuler ; jamais d'écrasement silencieux.
- « Envoyer un dossier local vers Drive » crée une nouvelle version et ne remplace jamais une version existante ; il refuse de remplacer un dossier `Budget` existant.
- Le mode « dossier local » reste disponible tel quel ; le rafraîchissement depuis l'Excel (`demarrer.sh`) reste local.
- Hébergé : uniquement `index.html`, `js/`, `css/`, `vendor/` ; jamais de données, de documents, de tests. L'identifiant client OAuth n'est pas un secret.
- En mode Drive, aucune API de dossier local n'est requise : Chrome, Edge, Firefox et Safari conviennent.
- Écran de consentement Google en mode « Test », le compte familial comme seul utilisateur de test.
- Les tests existants (`npm test`, 126 en JS ; `uv run pytest tests/py`, 34) restent verts ; chaque module nouveau suit le patron `(function (root) { …; if (typeof module !== 'undefined') module.exports = api; else root.Budget = Object.assign(root.Budget || {}, api); })(this);` ; interface en français ; texte inséré par `textContent`/`setAttribute` uniquement.
- Commits : message conventionnel, terminé par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Le jeton expire en pleine modification : l'écriture échoue sur une erreur d'authentification, la modification reste en mémoire, un bandeau propose « Se reconnecter », et l'écriture est réessayée après reconnexion sans perte (Tasks 3, 6 et 7).
- L'autre personne a modifié un seul des fichiers d'une version : la détection se fait fichier par fichier, le message nomme le fichier, les fichiers déjà écrits restent cohérents (Task 4).
- Drive autorise plusieurs dossiers de même nom dans un même dossier : deux dossiers `Budget` ou deux versions du même nom sont gérés de façon déterministe, avec avertissement (Tasks 2 et 5).
- « Enregistrer sous » ou l'envoi d'un dossier local est interrompu en route : aucune version à moitié copiée n'apparaît dans la liste (dossier temporaire renommé à la fin) (Task 5).
- Réseau coupé, erreur serveur ou quota dépassé : message clair, aucun fichier tronqué, l'application reste utilisable avec les données déjà chargées (Tasks 2 et 4).

## File Structure

| Fichier | Responsabilité |
| :--- | :--- |
| `js/drive-api.js` | Client REST Drive (fetch injecté), classes d'erreurs |
| `js/drive-auth.js` | Connexion Google (jeton, expiration), chargement du script Google |
| `js/drive-dir.js` | Réalisation Drive de l'interface de dossier, détection de conflit |
| `js/versions.js` | Racine `Budget`, liste/copie/envoi de versions, version mémorisée |
| `js/config.js` | `Budget.config = { clientId }` (public) |
| `js/ui-drive.js` | Choix du mode, connexion, premier lancement, sélecteur de versions, conflit, reconnexion |
| `js/ui-app.js` (modifié) | Point d'entrée commun `start(dir)`, mode local inchangé, hooks d'erreur d'écriture |
| `scripts/publier.sh` | Construit `dist/` (fichiers de l'application seulement) |
| `tests/js/drive-*.test.js`, `versions.test.js`, `publier.test.js` | Tests Node avec fausses dépendances |
| `docs/partage-drive/` | Guide Google Cloud, guide de publication, résultat de l'essai |

---

### Task 1: Guide Google Cloud, essai jetable et décision

**Files:**
- Create: `docs/partage-drive/guide-google-cloud.md`, `spike/drive-spike.html`, `docs/partage-drive/resultat-essai.md`

**Interfaces:**
- Produces: un identifiant client OAuth et une adresse autorisée (fournis par le PO), et une décision écrite « `drive.file` suffit » ou « plan B Picker », dont dépendent les Tasks 2 à 7.

- [ ] **Step 1: Écrire le guide** pas à pas pour le PO : créer le projet Google Cloud, activer l'API Drive, configurer l'écran de consentement (externe, mode Test, le compte familial comme utilisateur de test, portée `drive.file`), créer un identifiant client « application Web » avec les origines autorisées `http://localhost:8000` et l'adresse de l'hébergement, et noter l'identifiant. Le guide dit aussi que l'avertissement « application non vérifiée » est normal en mode Test.
- [ ] **Step 2: Écrire `spike/drive-spike.html`** (jetable, hors dossier publié, identifiant client lu dans un champ de saisie) : bouton « Se connecter » (jeton Google) ; bouton « Créer Budget/Base/essai.txt » (dossiers + fichier créés par l'application) ; bouton « Lister et lire » qui liste les sous-dossiers de `Budget` sans sélecteur Google, lit `essai.txt`, puis le modifie ; affichage brut de chaque réponse.
- [ ] **Step 3: Faire exécuter l'essai par le PO** depuis `python3 -m http.server 8000` sur le Mac (créer), puis depuis le PC Windows par l'adresse hébergée ou un second `localhost` (lister, lire, modifier), avec le même compte familial.
- [ ] **Step 4: Consigner dans `docs/partage-drive/resultat-essai.md`** les trois constats : (1) lecture et modification depuis le second appareil ; (2) liste des sous-dossiers de `Budget` sans Picker ; (3) comportement avec un sous-dossier créé par l'application. **Porte de décision : si (1) ou (2) échoue, arrêter et revenir vers le PO avec le plan B (Picker, une fois par appareil) avant de continuer.**
- [ ] **Step 5: Commit** `docs: Google Cloud guide and Drive access experiment` (sans l'identifiant client ni aucun jeton).

---

### Task 2: Client REST Drive (`js/drive-api.js`)

**Files:**
- Create: `js/drive-api.js`, `tests/js/drive-api.test.js`

**Interfaces:**
- Produces:
  - `class ErreurDriveAuth extends Error` (jeton absent/expiré, HTTP 401), `class ErreurDriveReseau extends Error` (échec réseau, 5xx, 429), `class ErreurDrive extends Error` (autres ; propriété `status`).
  - `creerClientDrive({ jeton: () => string, fetchImpl?: typeof fetch }) → Client` avec : `chercherDossier(nom, parentId|null): Promise<{id, name, doublons:number}|null>` (`null` = racine ; plusieurs résultats → le plus ancien par `createdTime`, `doublons` = nombre en trop) ; `creerDossier(nom, parentId|null): Promise<{id, name}>` ; `renommer(id, nom): Promise<void>` ; `lister(parentId): Promise<{id, name, mimeType, version}[]>` (hors corbeille, tri par nom) ; `meta(id): Promise<{id, name, version}>` ; `lireTexte(id): Promise<{texte, version}>` ; `ecrireTexte(parentId, nom, texte, { id?: string }): Promise<{id, version}>` (crée, ou met à jour si `id` donné) ; `copierFichier(id, parentId, nom): Promise<{id}>`.
- Toutes les requêtes portent `Authorization: Bearer <jeton()>` ; les noms sont échappés dans les requêtes `q` ; la corbeille est exclue.

- [ ] **Step 1: Écrire les tests** (fausse `fetch` qui enregistre les appels et rejoue des réponses) : `chercherDossier` retourne `null` si aucun résultat ; avec deux dossiers de même nom retourne le plus ancien et `doublons === 1` ; un nom contenant une apostrophe est échappé dans `q` ; `lister` exclut `trashed=true` ; `ecrireTexte` sans `id` fait un POST multipart puis, avec `id`, un PATCH ; un 401 lève `ErreurDriveAuth` ; un 503 et un `fetch` qui rejette lèvent `ErreurDriveReseau` ; un 403 de quota lève `ErreurDrive` avec `status === 403` ; l'en-tête `Authorization` vaut `Bearer jeton-test`.
- [ ] **Step 2: Lancer** `npm test` → les nouveaux tests échouent.
- [ ] **Step 3: Implémenter** `creerClientDrive` et les trois classes d'erreur dans `js/drive-api.js` (API Drive v3, `fields` limités à ce qui est utilisé).
- [ ] **Step 4: Lancer** `npm test` → tout passe.
- [ ] **Step 5: Commit** `feat: Drive REST client`.

---

### Task 3: Connexion Google (`js/drive-auth.js`)

**Files:**
- Create: `js/drive-auth.js`, `tests/js/drive-auth.test.js`

**Interfaces:**
- Consumes: `ErreurDriveAuth` (Task 2).
- Produces: `creerAuth({ clientId: string, scope?: string, charger?: () => Promise<GoogleOAuth2>, maintenant?: () => number }) → { seConnecter(): Promise<void>, jeton(): string, estConnecte(): boolean, deconnecter(): void }` ; `chargerGis(): Promise<GoogleOAuth2>` (insère le script `https://accounts.google.com/gsi/client` et résout `google.accounts.oauth2`). `jeton()` lève `ErreurDriveAuth` si aucun jeton ou s'il expire dans moins de 60 s. `seConnecter()` doit être appelée depuis un clic ; la portée par défaut est `https://www.googleapis.com/auth/drive.file`.

- [ ] **Step 1: Écrire les tests** (faux `GoogleOAuth2` dont `initTokenClient` enregistre ses arguments et dont `requestAccessToken` déclenche le rappel ; horloge injectée) : `initTokenClient` reçoit `client_id` et la portée `drive.file` ; après `seConnecter()` résolue, `jeton()` retourne le jeton et `estConnecte()` vaut `true` ; 61 s avant l'expiration `jeton()` fonctionne, 59 s avant il lève `ErreurDriveAuth` ; un rappel d'erreur ou une fenêtre fermée fait rejeter `seConnecter()` avec un message français ; `deconnecter()` fait lever `jeton()`.
- [ ] **Step 2: Lancer** `npm test` → échec attendu.
- [ ] **Step 3: Implémenter** `creerAuth` et `chargerGis` dans `js/drive-auth.js`.
- [ ] **Step 4: Lancer** `npm test` → tout passe.
- [ ] **Step 5: Commit** `feat: Google sign-in token wrapper`.

---

### Task 4: Dossier Drive et détection de conflit (`js/drive-dir.js`)

**Files:**
- Create: `js/drive-dir.js`, `tests/js/drive-dir.test.js`

**Interfaces:**
- Consumes: `Client` (Task 2).
- Produces: `class ErreurConflitDrive extends Error` (propriétés `nom`, `action: 'recharger'|'annuler'`) ; `creerDossierDrive(client, dossierId, { surConflit: ({ nom }) => Promise<'ecraser'|'recharger'|'annuler'> }) → DirHandle` où `getFileHandle(nom, { create?: boolean })` rejette `{name: 'NotFoundError'}` si le fichier est absent et `create` faux, et retourne `{ getFile(): Promise<{ text(): Promise<string> }>, createWritable(): Promise<{ write(texte): Promise<void>, close(): Promise<void> }> }`. La version de chaque fichier est retenue à la lecture et à l'écriture ; l'écriture est tamponnée jusqu'à `close()`, qui compare la version distante à la version retenue avant d'écrire.

- [ ] **Step 1: Écrire les tests** (faux `Client` en mémoire) : fichier absent sans `create` → `NotFoundError` ; lecture puis écriture sans changement distant → écrit et la nouvelle version est retenue ; version distante changée entre lecture et écriture → `surConflit` appelé avec le nom du fichier ; réponse `'ecraser'` → écrit ; `'recharger'` et `'annuler'` → `ErreurConflitDrive` avec l'action correspondante et rien d'écrit ; fichier créé par l'autre personne pendant qu'on s'apprête à le créer → traité comme un conflit ; conflit sur `paliers.yaml` seulement : `donnees-courantes.yaml` (écrit avant, sans conflit) reste écrit et le message nomme `paliers.yaml` ; une `ErreurDriveReseau` pendant `close()` est relancée telle quelle, le fichier distant reste intact ; deux `getFileHandle` du même nom partagent la même identité de fichier (identifiant mis en cache, pas de nouveau listing après création).
- [ ] **Step 2: Lancer** `npm test` → échec attendu.
- [ ] **Step 3: Implémenter** `creerDossierDrive` et `ErreurConflitDrive` dans `js/drive-dir.js`.
- [ ] **Step 4: Lancer** `npm test` → tout passe, dont les tests existants du stockage (`tests/js/store.test.js`).
- [ ] **Step 5: Vérifier le branchement avec la logique métier** : un test qui fait passer `loadAll`/`saveDonnees` de `js/store.js` sur un `creerDossierDrive` adossé au faux client (aller-retour complet de données de test) → même résultat qu'avec le faux dossier en mémoire existant.
- [ ] **Step 6: Commit** `feat: Drive-backed directory with conflict detection`.

---

### Task 5: Versions (`js/versions.js`)

**Files:**
- Create: `js/versions.js`, `tests/js/versions.test.js`

**Interfaces:**
- Consumes: `Client` (Task 2) ; `Budget.FICHIERS` (`js/store.js`).
- Produces: constantes `RACINE = 'Budget'`, `VERSION_DEFAUT = 'Base'` ; `nomVersionValide(texte): string` (retire les espaces en trop et `/ \ : * ? " < > |`, 60 caractères au plus, lève une erreur française si vide) ; `nomUnique(existants: string[], souhaite: string): string` (insensible à la casse et aux accents ; ajoute ` (2)`, ` (3)`…) ; `trouverRacine(client): Promise<{id, doublons}|null>` ; `creerRacine(client): Promise<{id}>` ; `listerVersions(client, racineId): Promise<{id, nom}[]>` (sous-dossiers, `Base` d'abord puis ordre alphabétique, dossiers temporaires `.tmp-*` ignorés) ; `copierVersion(client, sourceId, racineId, nomSouhaite): Promise<{id, nom}>` ; `envoyerDossierLocal(dirLocal, client, racineId, nomSouhaite): Promise<{id, nom, envoyes: string[]}>` ; `versionMemorisee(stockage): string` (défaut `Base`) ; `memoriser(stockage, nom): void` (clé `budget.versionActive`).
- `copierVersion` et `envoyerDossierLocal` créent d'abord `.tmp-<nom>`, copient ou écrivent les fichiers, puis renomment à la fin ; en cas d'échec la copie partielle n'est jamais listée.

- [ ] **Step 1: Écrire les tests** (faux `Client` et faux dossier local en mémoire) : `nomVersionValide('  Simu: voiture/2028 ? ')` → `'Simu voiture2028'` ; texte vide ou ne contenant que des caractères interdits → erreur ; `nomUnique(['Base', 'simulation'], 'Simulation')` → `'Simulation (2)'` ; `listerVersions` met `Base` en premier et ignore `.tmp-x` ; deux dossiers `Budget` → `trouverRacine` retourne le plus ancien avec `doublons: 1` ; `copierVersion` copie les cinq fichiers présents dans la source et retourne le nom unique ; échec du troisième fichier → ni `.tmp-` ni version partielle dans `listerVersions`, erreur relancée ; `envoyerDossierLocal` n'envoie que les fichiers du dossier local qui existent (liste `envoyes`), ne remplace jamais une version existante de même nom (nom unique) ; `versionMemorisee` sans valeur → `Base`, après `memoriser(s, 'Simu')` → `Simu` (faux stockage `Map`).
- [ ] **Step 2: Lancer** `npm test` → échec attendu.
- [ ] **Step 3: Implémenter** `js/versions.js`.
- [ ] **Step 4: Lancer** `npm test` → tout passe.
- [ ] **Step 5: Commit** `feat: versions (list, copy, upload local folder)`.

---

### Task 6: Choix du mode, connexion, premier lancement, sélecteur de versions

**Files:**
- Create: `js/config.js`, `js/ui-drive.js`
- Modify: `js/ui-app.js` (écran d'accueil et gestion des erreurs d'écriture), `index.html` (scripts `drive-api`, `drive-auth`, `drive-dir`, `versions`, `config`, `ui-drive`), `css/style.css`

**Interfaces:**
- Consumes: Tasks 2 à 5 ; `Budget.start(dir)`, `Budget.state`, `Budget.persist` (`js/ui-app.js`).
- Produces: `Budget.config = { clientId: 'COLLER_ICI_LE_CLIENT_ID.apps.googleusercontent.com' }` ; `Budget.drive.init(): void` (appelé par l'écran d'accueil) ; `Budget.drive.utiliser({ auth, client, stockage }): void` (point d'injection pour les essais sans Google) ; `Budget.drive.etat = { client, racineId, versions: [{id, nom}], versionActive: {id, nom} | null }`.
- Comportement : l'écran d'accueil propose deux modes, « Dossier local (Chrome ou Edge) » (inchangé, désactivé avec explication si l'API de dossier est absente) et « Google Drive » (toujours disponible). Le mode Drive : bouton « Se connecter avec Google » → si `Budget` n'existe pas, écran explicatif avec « Envoyer un dossier local vers Drive » (désactivé avec explication si l'API de dossier local est absente) ; sinon ouvre la version mémorisée (ou `Base`, ou propose la liste si elle n'existe pas) en appelant `Budget.start(creerDossierDrive(...))`. Un avertissement est affiché si `doublons > 0`. Les erreurs Drive s'affichent dans le bandeau d'erreur existant.

- [ ] **Step 1: Écrire `Budget.drive.utiliser`** et les écrans, avec un faux `auth`/`client` injectés pour pouvoir tester sans réseau.
- [ ] **Step 2: Vérifier à la main** dans un contexte de navigateur isolé (outils chrome-devtools, données fictives, faux client injecté) : accueil à deux modes ; mode Drive avec racine absente → écran d'envoi ; avec une racine et une version `Base` → l'application s'ouvre ; une version mémorisée absente → liste proposée ; navigateur sans API de dossier : mode Drive utilisable, mode local désactivé avec explication ; aucune erreur dans la console.
- [ ] **Step 3: Lancer** `npm test` et `uv run pytest tests/py -q` → tout passe.
- [ ] **Step 4: Commit** `feat: Drive mode — sign-in, first run and version loading`.

---

### Task 7: « Enregistrer sous », « Basculer », conflit et reconnexion

**Files:**
- Modify: `js/ui-drive.js`, `js/ui-app.js`, `css/style.css`, `index.html` (si un nouveau script est nécessaire)

**Interfaces:**
- Consumes: Tasks 3 à 6 ; `ErreurDriveAuth`, `ErreurDriveReseau`, `ErreurConflitDrive`.
- Produces: dans l'en-tête, un sélecteur « Version » (liste de `Budget.drive.etat.versions`), un bouton « Enregistrer sous… » (nom demandé → `copierVersion` depuis la version courante → bascule sur la nouvelle) ; « Basculer » (changement du sélecteur → `memoriser` puis rechargement complet des données depuis cette version via `Budget.start`). Boîte de conflit (écraser / recharger / annuler, texte français nommant le fichier) branchée sur `surConflit`. Bandeau « Session expirée — Se reconnecter » : un clic relance `seConnecter()` puis réessaie l'écriture en attente (`Budget.persist(kind)` une fois).

- [ ] **Step 1: Brancher** `surConflit` sur la boîte de conflit : « recharger » demande une confirmation explicite (« votre dernière modification sera abandonnée ») avant de recharger.
- [ ] **Step 2: Brancher** les erreurs de `persist` : `ErreurDriveAuth` → bandeau de reconnexion, la modification reste en mémoire et est réessayée après reconnexion ; `ErreurDriveReseau`/`ErreurDrive` → message clair, l'application reste utilisable.
- [ ] **Step 3: Vérifier à la main** dans un contexte isolé avec un faux client (jeton qui expire, version distante qui change, écriture lente) : modification après expiration → bandeau, reconnexion, la modification est bien écrite ; conflit sur un seul fichier → boîte de conflit qui nomme ce fichier, chacun des trois choix se comporte comme prévu ; « Enregistrer sous… » crée une version visible dans le sélecteur et bascule dessus ; « Basculer » recharge les données de l'autre version ; un nom déjà pris reçoit un suffixe ; échec réseau en cours d'enregistrement sous → aucune version partielle listée.
- [ ] **Step 4: Lancer** `npm test` et `uv run pytest tests/py -q` → tout passe.
- [ ] **Step 5: Commit** `feat: Save As, switch, conflict dialog and reconnect banner`.

---

### Task 8: Construction du site publié et guide d'hébergement

**Files:**
- Create: `scripts/publier.sh`, `tests/js/publier.test.js`, `docs/partage-drive/guide-hebergement.md`
- Modify: `.gitignore` (`dist/`)

**Interfaces:**
- Produces: `scripts/publier.sh [dossier-sortie]` (défaut `dist/`) copie uniquement `index.html`, `js/`, `css/`, `vendor/` ; code de retour non nul si le dossier de sortie est hors du dépôt ou si `Budget.config.clientId` vaut encore le texte de remplacement.

- [ ] **Step 1: Écrire le test** (Node, exécute le script vers un dossier temporaire) : le résultat contient `index.html`, `js/`, `css/`, `vendor/` et rien d'autre (ni `docs`, `tests`, `data`, `spike`, `.superpowers`, `*.md`, `*.xlsx`, `TODO.md`) ; échec si `clientId` est encore `COLLER_ICI_LE_CLIENT_ID…` ; un second appel écrase proprement le dossier de sortie.
- [ ] **Step 2: Lancer** `npm test` → échec attendu.
- [ ] **Step 3: Implémenter** `scripts/publier.sh` (`set -eu`, chemins entre guillemets, aucune suppression hors du dossier de sortie).
- [ ] **Step 4: Écrire `docs/partage-drive/guide-hebergement.md`** : hébergement statique gratuit au choix du PO (Cloudflare Pages, Netlify ou GitHub Pages), comment publier `dist/`, comment ajouter l'adresse obtenue aux origines autorisées de l'identifiant client, mise à jour de l'application, et l'avertissement que ce qui est publié est visible de quiconque connaît l'adresse (code seulement, aucune donnée).
- [ ] **Step 5: Lancer** `npm test` → tout passe.
- [ ] **Step 6: Commit** `feat: build the published site and hosting guide`.

---

### Task 9: README et recette réelle

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Documenter** dans le README : les deux modes, le mode Drive (connexion, version active par appareil, « Enregistrer sous », « Basculer », conflit), « Envoyer un dossier local vers Drive », les limites (jeton d'environ une heure, pas de renommage ni de suppression de version dans l'application, rafraîchissement Excel local), et les trois guides de `docs/partage-drive/`.
- [ ] **Step 2: Recette sur le vrai Drive par le PO** (liste de contrôle dans le README) : envoi du dossier local depuis le Mac → version `Base` ; ouverture depuis le PC Windows dans Chrome, puis dans un navigateur non-Chrome ; modification d'un côté visible de l'autre après rechargement ; « Enregistrer sous… » depuis un poste, bascule sur l'autre poste ; conflit provoqué volontairement (même fichier modifié des deux côtés) ; session expirée simulée (attendre plus d'une heure ou révoquer l'accès) puis reconnexion sans perte.
- [ ] **Step 3: Lancer** `npm test` et `uv run pytest tests/py -q` → tout passe.
- [ ] **Step 4: Commit** `docs: Drive sharing usage and acceptance checklist`.

---

## Self-Review

- **Couverture de la conception :** hébergement et connexion Google (Tasks 1, 3, 8) ; compte familial unique, mode Test (Tasks 1, 8) ; structure `Budget` et versions (Task 5) ; « Enregistrer sous » et « Basculer », version par appareil (Tasks 5 et 7) ; conflit par fichier avec avertissement (Tasks 4 et 7) ; jeton d'une heure et reconnexion (Tasks 3 et 7) ; première utilisation et envoi du dossier local sans remplacement (Tasks 5 et 6) ; mode local conservé (Task 6) ; Safari et Firefox en mode Drive (Task 6) ; hébergement des fichiers de l'application seulement (Task 8) ; essai préalable et plan B (Task 1) ; guide Google Cloud (Task 1) ; rafraîchissement Excel local hors périmètre (Task 9, limites).
- **Cohérence des noms :** `Client`, `ErreurDriveAuth`, `ErreurDriveReseau`, `ErreurDrive`, `ErreurConflitDrive`, `creerClientDrive`, `creerAuth`, `creerDossierDrive`, `trouverRacine`, `listerVersions`, `copierVersion`, `envoyerDossierLocal`, `versionMemorisee`/`memoriser` sont définis dans les Tasks 2 à 5 et réutilisés tels quels dans les Tasks 6 et 7.
- **Points que le plan laisse volontairement au constructeur** (comme la conception) : le choix de l'hébergement, l'ergonomie du sélecteur et des boîtes de dialogue, le regroupement des écritures rapprochées.
