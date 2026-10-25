# Résultat de l'essai d'accès au Drive (`drive.file`)

> **Porte de décision : si (1) ou (2) échoue, ne pas continuer le plan avant d'en parler.**

Cet essai vérifie, avec un vrai compte, ce que la documentation de Google ne dit pas clairement. La page jetable est `spike/drive-spike.html` (hors du site publié). Elle ne garde aucun jeton.

Prérequis : avoir fait le guide `guide-google-cloud.md` et avoir l'ID client sous la main.

## Déroulé

**Appareil A (le Mac) : créer**

1. Dans un terminal : `cd spike && python3 -m http.server 8000`
2. Ouvrez <http://localhost:8000/drive-spike.html> (pas `127.0.0.1`).
3. Collez l'ID client, cliquez sur **Se connecter**, acceptez (avertissement « non vérifiée » : Paramètres avancés > Accéder...).
4. Cliquez sur **1. Créer Budget/Base/essai.txt**. Notez les identifiants affichés.
5. Copiez le journal (ou une capture) de l'appareil A.

**Appareil B (le PC Windows) : lister, lire, modifier**

1. Même commande dans le dossier `spike` du PC (`python -m http.server 8000` si `python3` n'existe pas), ou toute adresse dont l'origine est autorisée dans Google Cloud. Ouvrez <http://localhost:8000/drive-spike.html>.
2. Même ID client, **même compte Gmail familial**, **Se connecter**.
3. **Ne cliquez pas** sur « 1. Créer » : cliquez sur **2. Lister et lire**. Relevez : les sous-dossiers de `Budget` sont-ils listés ? `essai.txt` est-il listé et son contenu lu ?
4. Saisissez le nom de l'appareil (par exemple `PC`) puis cliquez sur **3. Modifier essai.txt**. Relevez `version` et `modifiedTime` avant et après.
5. Retour sur l'appareil A : **2. Lister et lire** doit montrer le contenu modifié par B.

**Facultatif (constat 3)** : sur l'appareil B, après le test, créez à la main un second sous-dossier dans `Budget` depuis l'interface web de Drive, puis relancez « 2. Lister et lire » : apparaît-il ? (Attendu avec `drive.file` : non, car il n'a pas été créé par l'application.)

## Informations de l'essai

| | Appareil A | Appareil B |
| :--- | :--- | :--- |
| Nom de l'appareil | | |
| Système / navigateur (ligne `userAgent` de la page) | | |
| Date de l'essai | | |
| Compte Gmail utilisé | | |

## Constats

| # | Constat | Résultat (OK / KO) | Détail observé (statut HTTP, ids, extraits) |
| :--- | :--- | :--- | :--- |
| 1 | Un fichier créé depuis l'appareil A est lisible **et** modifiable depuis l'appareil B (même compte, même ID client) | | |
| 2 | Les sous-dossiers de `Budget` sont listés depuis l'appareil B **sans** Picker | | |
| 3 | Comportement avec un sous-dossier créé par l'application (`Base`) : fichiers visibles dans `Base` depuis B ? sous-dossier créé à la main non listé ? | | |

## Erreurs observées

(Copiez ici les messages d'erreur du journal : statut, `reason`, `message`.)

-

## Décision

**Décision : drive.file suffit / plan B Picker** (rayez la mention inutile)

Commentaire :

-
