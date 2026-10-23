# Partage du budget via Google Drive — conception

Date : 2026-10-22. Auteur du besoin : fabulous. Statut : à valider.

## Pourquoi

Aujourd'hui, l'application est une page HTML locale (Chrome ou Edge) qui lit et écrit des fichiers YAML dans un dossier choisi sur l'ordinateur. Elle ne fonctionne donc que sur la machine où se trouve le dossier.

Le besoin : que fabulous (Mac d'entreprise) et sa femme (PC Windows personnel) ouvrent la même application, chacun sur son ordinateur, pour regarder le budget et le modifier, y compris pour faire des simulations de leur côté, avec des données qui restent à un seul endroit commun : le Google Drive d'un compte Gmail familial partagé.

Contraintes de départ :
- Sur le Mac d'entreprise, on ne peut pas installer « Google Drive pour ordinateur », et il est probable qu'un exécutable inconnu (Electron ou autre) y soit refusé.
- Les données financières ne doivent pas quitter le Drive de la famille.

## Ce qui est décidé (par le PO)

- L'application devient une page web hébergée, qui se connecte à Google (connexion Google) et lit/écrit les fichiers directement dans le Drive par l'interface de programmation de Drive. Rien à installer sur les ordinateurs.
- Un seul compte Gmail familial, utilisé par les deux personnes. Il n'y a pas de partage entre comptes à gérer.
- Des versions nommées d'un même budget (« Base », « Simulation voiture 2028 »…) : « Enregistrer sous » crée une version à partir de la version courante, « Basculer » change de version. Les versions sont visibles et utilisables depuis les deux postes.
- Si deux personnes modifient la même version en même temps, la dernière sauvegarde l'emporte, mais l'application avertit quand le fichier a changé depuis sa dernière lecture, avant d'écraser.
- La page seule est hébergée gratuitement : le code est sur l'hébergement, jamais les données.

## Objectifs

- Ouvrir l'application depuis n'importe quel ordinateur et navigateur moderne avec une connexion au compte familial, sans installation.
- Retrouver la même liste de versions et les mêmes données des deux côtés.
- Créer une version par « Enregistrer sous », basculer entre versions, sans jamais perdre ni mélanger des données.
- Garder tout le comportement actuel du budget (projection, graphiques, onglets, paliers, prêts, paramètres, historique CSV) : seule la couche de stockage change.
- Mise à jour automatique de l'application pour les deux utilisateurs à chaque rechargement.

## Non-objectifs et anti-objectifs

- Pas d'exécutable, pas de serveur applicatif, pas de base de données externe.
- Pas d'accès de l'application au reste du Drive : uniquement les fichiers qu'elle a créés.
- Jamais d'écrasement silencieux d'une modification faite par l'autre personne.
- Jamais de données dans le dépôt de code ni sur l'hébergement.
- Hors périmètre : comptes séparés avec droits différents, édition simultanée en temps réel, gestion fine des conflits (fusion), application mobile.
- Un échec d'écriture sur Drive n'est jamais un échec silencieux : l'utilisateur le voit, et ses modifications en attente ne sont pas perdues.

## Choix techniques de la proposition (mes décisions, à relire)

- **Droits Google :** portée `drive.file` seulement (fichiers créés par l'application). Google la classe « non sensible ». Aucune donnée du reste du Drive n'est lisible.
- **Connexion :** le modèle « jeton d'accès » de Google Identity Services, sans serveur. Le jeton dure environ une heure ; à l'expiration, l'application demande de se reconnecter par un clic, retient les modifications en attente et les renvoie après reconnexion.
- **Structure Drive :** l'application crée un dossier « Budget » à la racine du Drive familial. Chaque version est un sous-dossier qui contient les mêmes fichiers qu'aujourd'hui (données courantes, événements futurs, paramètres, paliers, historique CSV). Tout est donc créé par l'application.
- **Première connexion :** si le Drive ne contient pas encore l'espace « Budget », l'application propose de le créer en envoyant le dossier de données local actuel (choisi sur le Mac), comme version « Base ».
- **Couche de stockage :** la logique actuelle lit et écrit déjà à travers une petite interface de dossier (`getFileHandle`, `getFile`, `createWritable`). On ajoute une réalisation « Drive » de cette interface ; le mode « dossier local » actuel reste disponible comme second mode. La logique métier et ses tests ne changent pas.
- **Navigateurs :** en mode Drive, l'API de dossier local n'est plus nécessaire : Chrome, Edge, Firefox et Safari conviennent.
- **Hébergement :** hébergement statique gratuit (par exemple Cloudflare Pages, Netlify ou GitHub Pages, au choix du constructeur). Il faut une adresse en https, car la connexion Google l'exige.
- **Configuration Google :** un projet Google Cloud gratuit, créé une fois par le PO avec l'identifiant client OAuth et l'adresse de l'hébergement autorisée. L'identifiant client n'est pas un secret. Un guide pas à pas sera livré pour ces étapes manuelles.
- **Versions :** « Enregistrer sous » copie les fichiers de la version courante dans un nouveau sous-dossier (nom unique, caractères sûrs) puis bascule dessus ; « Basculer » recharge toutes les données depuis le sous-dossier choisi. Version par défaut : « Base ». Pas de renommage ni de suppression dans l'application pour la première livraison (possible depuis l'interface de Drive).
- **Détection de changement :** avant d'écrire un fichier, l'application compare l'horodatage ou l'empreinte de version Drive à celui lu ; s'ils diffèrent, elle propose de recharger ou d'écraser en connaissance de cause.

## À vérifier avant de construire (essai réel, jetable)

La documentation de Google ne dit pas clairement comment `drive.file` se comporte pour un même compte sur deux appareils, ni pour des fichiers dans un dossier créé par l'application. Un essai de quelques lignes doit confirmer : (1) un fichier créé depuis le Mac est lisible et modifiable depuis le PC avec le même compte et le même identifiant client, y compris dans un sous-dossier créé par l'application ; (2) la liste des sous-dossiers de « Budget » est obtenue sans Picker. Si ce n'est pas le cas, le plan B est de faire choisir une fois le dossier « Budget » par la fenêtre de sélection de Google (Picker) à la première connexion de chaque appareil, ou de passer à une portée plus large.

## Précisions (mes décisions après relecture, à vérifier)

- **Premier chantier du plan :** configuration Google Cloud par le PO (avec le guide pas à pas), puis l'essai ci-dessus. Le reste ne démarre qu'après le résultat de l'essai. Plan B : le sélecteur Google (Picker) pour choisir une fois le dossier « Budget » par appareil. Une portée plus large que `drive.file` contredit l'anti-objectif « seulement les fichiers créés par l'application » : elle ne serait envisagée qu'avec l'accord explicite du PO.
- **Version active :** propre à chaque appareil, mémorisée dans le navigateur (version par défaut : « Base »). Basculer sur un poste ne déplace pas l'autre : c'est ce qui permet à chacun de faire ses simulations de son côté. Aucun fichier « version courante » dans le Drive.
- **Modifications en attente et conflit :** la vérification se fait par fichier, juste avant son écriture. En cas de changement externe, l'écriture est suspendue et l'utilisateur choisit : écraser, recharger (en abandonnant, après confirmation, la modification qu'il venait de faire) ou annuler. Les fichiers d'une version sont écrits dans un ordre fixe ; si l'un échoue, l'application dit lequel, et une incohérence entre fichiers se manifeste comme aujourd'hui par des paliers « sans ligne correspondante », sans perte de données.
- **Mode « dossier local » :** conservé tel quel (écran de choix du mode au démarrage). Le rafraîchissement depuis l'Excel (`demarrer.sh`) reste local ; pour la première livraison, « Envoyer un dossier local vers Drive » crée une nouvelle version et ne remplace jamais une version existante. Un rafraîchissement d'une version existante depuis l'Excel est hors périmètre.
- **Première utilisation :** envoyer le dossier local complet (CSV d'historique compris) peut se faire depuis n'importe quel appareil qui a ce dossier. Si le Drive ne contient pas encore « Budget » quand quelqu'un se connecte, l'application l'explique et propose cet envoi. Elle refuse de remplacer un dossier « Budget » déjà existant.
- **Ce qui est hébergé :** uniquement les fichiers de l'application (`index.html`, `js/`, `css/`, `vendor/`), dans un dossier de publication dédié. Pas de documents du projet, pas de tests, pas de données.

- **Qui peut se connecter :** l'écran de consentement Google reste en mode « Test », avec le compte familial comme seul utilisateur de test. Un autre compte Google qui trouverait l'adresse de la page serait refusé par Google. Même sans cette restriction, un autre compte ne verrait jamais que son propre Drive, jamais le vôtre. Le mode « Test » affiche un avertissement « application non vérifiée » à la connexion, que le compte de test peut passer. Coût : aucun, ni pour l'hébergement ni pour le projet Google Cloud (usage très faible, aucune facturation à activer).

## Laissé au constructeur

- Le choix exact de l'hébergement gratuit et du processus de publication.
- Le découpage du code (module de stockage Drive, connexion, sélecteur de versions).
- L'ergonomie du sélecteur de versions et de la fenêtre de reconnexion.
- Les détails de la file d'attente des écritures (regroupement des écritures rapprochées, réessais).
- Le format de l'empreinte de version et la formulation des messages d'avertissement.
