# Publier la page sur GitHub Pages

Seul le code de la page est publié (`index.html`, `js/`, `css/`, `vendor/`). Aucune donnée n'est jamais envoyée : elle reste dans le dossier choisi sur chaque ordinateur.

## Publier

1. Validez vos modifications (`git commit`). **Seuls les fichiers validés (committés) sont publiés** : un fichier non suivi ou modifié mais non validé n'est jamais publié, et le script refuse de publier si `index.html`, `js/`, `css/` ou `vendor/` ont des modifications non validées. Un lien symbolique dans ces dossiers fait refuser la construction.
2. Lancez, à la racine du projet :

   ```
   ./scripts/publier-pages.sh --push
   ```

   Le script construit la page dans `dist/` (ignoré par git) à partir du dernier commit, met à jour la branche `gh-pages` (sans toucher à votre branche courante ni à vos fichiers) puis l'envoie sur GitHub. Sans `--push`, il met à jour `gh-pages` en local, ne pousse rien et n'utilise pas le réseau.

Avec `--push`, le script récupère d'abord la branche `gh-pages` de GitHub et publie par-dessus : sur un ordinateur où vous n'avez jamais publié (nouveau clone), cela évite un conflit avec la publication faite ailleurs. Une `gh-pages` locale divergente est remise sur la distante (son contenu est régénéré à chaque publication).

Si l'envoi est rejeté, la branche `gh-pages` distante a probablement changé entre-temps (ou vos droits sont insuffisants) : relancez la même commande. Ne forcez jamais l'envoi sans savoir pourquoi.

## Activer GitHub Pages (une seule fois)

1. Sur GitHub, ouvrez le dépôt, puis **Settings**.
2. Menu de gauche : **Pages**.
3. Dans **Build and deployment**, **Source** : « Deploy from a branch ».
4. **Branch** : `gh-pages`, dossier `/ (root)`, puis **Save**.

La page est alors disponible à l'adresse `https://fabthefabulousfab.github.io/budgetplanning/` (comptez une minute après chaque publication).

## Mettre à jour

Même commande : `./scripts/publier-pages.sh --push`. S'il n'y a rien de nouveau, le script l'indique (« Rien à publier ») et ne crée aucun commit.

## Ce qui est public

Le code de la page uniquement ; le dépôt est déjà public. Ni vos données, ni votre sauvegarde, ni `budget.xlsx` ne sont publiés ou envoyés quelque part.

## Navigateur

Chrome ou Edge sur ordinateur sont nécessaires pour travailler sur un dossier. Safari et Firefox affichent « navigateur non pris en charge ».

## Une deuxième personne démarre

1. Ouvrir `https://fabthefabulousfab.github.io/budgetplanning/` dans Chrome ou Edge.
2. Cliquer sur « Importer une sauvegarde » et choisir le fichier exporté depuis l'onglet Paramètres (« Exporter la sauvegarde »).
3. Choisir un dossier de destination vide sur son ordinateur : ses données y sont enregistrées.
