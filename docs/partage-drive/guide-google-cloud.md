# Guide : configurer Google Cloud pour le partage via Drive

Ce guide se fait **une seule fois**, depuis le compte Gmail familial (celui qui servira aux deux personnes). Il est gratuit : aucune carte bancaire, aucune facturation. Durée : environ 15 minutes.

À la fin, vous aurez un **identifiant client** (une longue chaîne qui se termine par `.apps.googleusercontent.com`) à noter et à communiquer.

Les noms des menus de Google changent parfois légèrement ; en cas de doute, cherchez le mot en gras dans la barre de recherche en haut de la console.

## 1. Créer le projet

1. Ouvrez <https://console.cloud.google.com/> et connectez-vous avec le **compte Gmail familial**.
2. Si Google affiche les conditions d'utilisation, cochez la case et validez. Ne demandez **pas** d'essai gratuit payant : aucune facturation n'est nécessaire.
3. En haut de la page, cliquez sur le sélecteur de projet (à droite du logo « Google Cloud »), puis sur **Nouveau projet**.
4. Nom du projet : `Budget famille`. Laissez « Organisation » et « Emplacement » tels quels (« Aucune organisation »).
5. Cliquez sur **Créer**. Attendez la notification, puis cliquez sur **Sélectionner le projet** (ou choisissez `Budget famille` dans le sélecteur en haut). Le nom du projet doit s'afficher en haut de la page.

## 2. Activer l'API Google Drive

1. Menu (trois barres, en haut à gauche) > **API et services** > **Bibliothèque**.
2. Dans la recherche, tapez `Google Drive API`, puis cliquez sur le résultat **Google Drive API**.
3. Cliquez sur le bouton bleu **Activer**. Attendez l'arrivée sur la page « Présentation de l'API ».

## 3. Configurer l'écran de consentement OAuth

C'est la page que Google affiche quand l'application demande l'accès au Drive.

1. Menu > **API et services** > **Écran de consentement OAuth** (selon la version de la console : **Google Auth Platform**, puis **Commencer**).
2. **Informations sur l'application** : nom `Budget famille` ; adresse e-mail d'assistance : le compte familial. Cliquez sur **Suivant**.
3. **Audience** (ou « Type d'utilisateur ») : choisissez **Externe**. Cliquez sur **Suivant**.
4. **Coordonnées** : saisissez le compte familial comme adresse e-mail. Suivant.
5. Cochez la case d'acceptation de la politique relative aux données utilisateur, puis **Continuer** et **Créer**.
6. **Portées (Data Access / Accès aux données)** : cliquez sur **Ajouter ou supprimer des portées**. Dans le filtre, tapez `drive.file` et cochez uniquement la ligne `.../auth/drive.file` (« Afficher et gérer les fichiers Google Drive que vous avez ouverts ou créés avec cette application »). Cliquez sur **Mettre à jour**, puis **Enregistrer**.
   - Ne cochez **aucune autre portée**. En particulier, pas `.../auth/drive` tout court : elle donnerait accès à tout le Drive.
7. **Audience** (ou « Utilisateurs de test ») :
   - Vérifiez que l'état de publication est **Test** (« Testing »). Ne cliquez **pas** sur « Publier l'application ».
   - Dans « Utilisateurs test », cliquez sur **Add users** (Ajouter des utilisateurs), saisissez le **compte Gmail familial** (il doit y être, même si c'est le compte propriétaire du projet), puis **Enregistrer**. Ce doit être le seul utilisateur de test.

## 4. Créer l'identifiant client OAuth

1. Menu > **API et services** > **Identifiants** (ou, dans Google Auth Platform, **Clients**).
2. Cliquez sur **Créer des identifiants** > **ID client OAuth** (ou **Créer un client**).
3. **Type d'application** : choisissez **Application Web**.
4. Nom : `Budget famille web`.
5. Section **Origines JavaScript autorisées** > **Ajouter un URI**, et saisissez exactement :
   - `http://localhost:8000` (pour l'essai et le travail en local ; pas de barre oblique finale, pas de chemin) ;
   - puis cliquez de nouveau sur **Ajouter un URI** pour l'adresse de l'hébergement : `https://ADRESSE-DE-L-HEBERGEMENT` (**à remplacer** dès qu'elle est connue, par exemple `https://budget-famille.pages.dev`). Vous pourrez revenir ajouter ou modifier cette ligne plus tard ; tant qu'elle n'est pas connue, laissez-la de côté.
6. Laissez vide la section **URI de redirection autorisés** : elle n'est pas utilisée ici.
7. Cliquez sur **Créer**. Une fenêtre affiche l'**ID client** : copiez-le (bouton de copie). Vous le retrouverez à tout moment dans **Identifiants**.
8. Un changement d'origine autorisée peut mettre de quelques minutes à quelques heures pour être pris en compte.

## 5. Ce qu'il faut savoir

- **L'ID client n'est pas un secret.** Il est fait pour apparaître dans la page web ; on peut le copier dans un message ou dans le code de l'application.
- **Aucun « secret client » ni « clé API » ne doit jamais être mis dans le dépôt ni dans la page.** Google peut afficher un « code secret du client » ou proposer de télécharger un fichier JSON : ne le copiez nulle part, ne le commitez pas. L'application n'en a pas besoin. Ne créez pas de « clé API ».
- **L'avertissement « Google n'a pas validé cette application » est normal** tant que l'écran de consentement est en mode Test. À la première connexion, Google affiche cet écran : cliquez sur **Paramètres avancés** (en bas à gauche), puis sur **Accéder à Budget famille (non sécurisé)**, puis sur **Continuer** pour accepter l'accès aux fichiers créés par l'application. C'est votre propre application : il n'y a pas de risque.
- En mode Test, l'autorisation donnée expire au bout d'environ 7 jours : l'écran de consentement réapparaîtra alors de temps en temps. C'est attendu.
- L'application ne verra que les fichiers qu'elle a elle-même créés dans le Drive (portée `drive.file`) ; le reste du Drive reste hors de portée.

## 6. À communiquer

Notez, sans rien d'autre :

- l'**ID client** ;
- l'adresse de l'hébergement quand elle sera connue (à ajouter alors aux origines autorisées).

## Que faire si ça ne marche pas

| Message ou symptôme | Cause probable | Que faire |
| :--- | :--- | :--- |
| `Erreur 400 : origin_mismatch` | L'adresse de la page n'est pas dans les origines JavaScript autorisées. | Vérifiez que l'adresse affichée dans le navigateur correspond **exactement** (http ou https, nom, port, sans barre finale) à une origine du client OAuth. Pour l'essai : `http://localhost:8000` (et non `127.0.0.1`). Attendez quelques minutes après modification. |
| `Erreur 403 : access_denied` / « L'application n'a pas terminé la procédure de validation Google » | Le compte utilisé n'est pas dans les utilisateurs de test. | Écran de consentement > Audience > Utilisateurs test : ajoutez le compte exact avec lequel vous vous connectez ; ou connectez-vous avec le compte familial. |
| `403` avec `accessNotConfigured` ou « Google Drive API has not been used in project … » | L'API Drive n'est pas activée dans ce projet. | Refaites l'étape 2 sur le bon projet (le nom du projet est en haut de la console). |
| `401` plus tard dans la session | Le jeton de connexion dure environ une heure. | Cliquez de nouveau sur « Se connecter ». |
| La fenêtre de connexion ne s'ouvre pas | Le navigateur bloque les fenêtres surgissantes. | Autorisez les fenêtres surgissantes pour cette page, puis recliquez. |
| `Erreur 400 : invalid_request` / `redirect_uri_mismatch` | Le type de client n'est pas « Application Web ». | Recréez un client de type **Application Web**. |
