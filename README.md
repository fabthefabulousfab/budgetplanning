# Budget prévisionnel

Application HTML autonome de projection budgétaire sur 10 à 15 ans (JavaScript sans framework ; Chart.js et js-yaml sont fournis dans `vendor/`). Elle s'ouvre directement depuis `index.html` (`file://`), sans serveur. Les données restent sur votre ordinateur.

## Prérequis

- [uv](https://docs.astral.sh/uv/) (exécute le convertisseur Python Excel vers YAML).
- Google Chrome ou Microsoft Edge sur ordinateur (l'application utilise l'API d'accès aux dossiers locaux).

## Démarrer

```
./demarrer.sh [--depuis-excel]
```

- Si `budget.xlsx` existe et que `data/donnees-courantes.yaml` n'existe pas encore, ou avec `--depuis-excel`, le fichier Excel est converti (`uv run python scripts/excel_to_yaml.py budget.xlsx`).
- Si `data/donnees-courantes.yaml` existe déjà et qu'aucune option n'est donnée : en terminal interactif, le script demande « Repartir de budget.xlsx (écrase les modifications faites dans la page) ? [o/N] » ; sans terminal, il repart des YAML existants.
- Si la conversion échoue, le script s'arrête avec un message ; les YAML existants ne sont pas modifiés.
- Puis Chrome ouvre `index.html`. Cliquez sur « Ouvrir le dossier data/ » et choisissez le dossier `data/` du projet.
- `DEMARRER_SANS_OUVRIR=1 ./demarrer.sh` fait tout sauf ouvrir Chrome (utile pour les tests).

## Format de `budget.xlsx`

Quatre feuilles, en-têtes en ligne 1 :

| Feuille | Colonnes |
| --- | --- |
| Situation | Poste, Montant (lignes « Compte courant » et « Épargne » obligatoires) |
| Mensuel | Type, Catégorie, Libellé, Montant, Revalorisé, Fin |
| Annuel | Type, Catégorie, Libellé, Échéances, Revalorisé, Début, Fin |
| Exceptionnel | Type, Catégorie, Libellé, Échéances |

Type : `revenu` ou `depense`. Revalorisé : `oui` ou `non`. Début et Fin : `AAAA-MM`.

### Syntaxe des échéances

| Saisie | Signification |
| --- | --- |
| `800` | 800 par mois entre début et fin |
| `3-300` | 300 chaque mois de mars |
| `6-500, 10-500` | 500 en juin et 500 en octobre, chaque année |
| `2026-3-300` | 300 en mars 2026 seulement |

Le mois va de 1 à 12. Ne pas mélanger des échéances avec année et sans année dans une même cellule. La virgule décimale n'est pas acceptée (utiliser le point).

## Les trois fichiers YAML (dossier `data/`)

- `donnees-courantes.yaml` : situation, lignes mensuelles, annuelles et exceptionnelles. Il est régénéré à chaque import Excel : les modifications faites dans la page sur ces lignes sont alors perdues.
- `evenements-futurs.yaml` : revenus et dépenses futurs ajoutés dans l'onglet dédié, et prêts de l'onglet Prêts (entrées `nature: pret`, `statut: simule` ou `en_cours`). Jamais écrasé par l'import Excel.
- `historique-comptes.csv` : historique mois par mois : résumé (revenus, dépenses, solde, euros arrondis), puis le détail de chaque revenu et dépense du mois (origine, catégorie, libellé, montant, revalorisation comprise ; lignes masquées exclues), regénéré après chaque enregistrement, à donner tel quel à un LLM pour un avis financier.
- Une ligne peut être masquée avec l'icône œil (`actif: false`) : elle est ignorée dans toute la projection. Un nouvel import Excel remet les lignes de `donnees-courantes.yaml` à l'état actif.
- `parametres.yaml` : départ, horizon, revalorisation, solde de départ (onglet Paramètres). Jamais écrasé par l'import Excel.
- `paliers.yaml` : paliers (changements de montant à une date donnée) des lignes importées (mensuelles, annuelles, exceptionnelles). Jamais écrasé par l'import Excel.

### Paliers

Une ligne peut changer de montant à des dates précises. Le montant propre de la ligne s'applique de son `debut` (s'il y en a un) jusqu'au premier palier (exclu) ; chaque palier remplace tout le montant à partir de son `depuis` (inclus) jusqu'au palier suivant (exclu) ; le dernier palier court jusqu'à la `fin` de la ligne (incluse) ou sans limite. `debut` et `fin` bornent toujours l'ensemble. La revalorisation (`revalorise`) et le masquage (`actif: false`) s'appliquent à tous les paliers de la ligne.

Un montant de palier à `0` (nombre `0` pour une ligne mensuelle, texte `0` pour les échéances) signifie « plus rien à partir de cette date » (jusqu'au palier suivant s'il y en a un) ; une dépense mensuelle qui s'arrête ainsi apparaît dans les fins de prêt du tableau de bord. La `fin` d'une ligne à paliers ne peut pas précéder son dernier palier (refusé à l'enregistrement ; avertissement à l'ouverture).

Un palier est `{ depuis: 'AAAA-MM', … }` avec, pour une ligne mensuelle, `montant` (nombre supérieur ou égal à 0) et, pour une ligne annuelle, exceptionnelle ou un événement, `echeances` (même syntaxe que ci-dessus : `800`, `3-300`, `6-500, 10-500`, `2026-3-300`). Les `depuis` sont strictement croissants, postérieurs au `debut` de la ligne, 50 paliers au plus.

Lignes importées, dans `paliers.yaml` (la ligne est identifiée par ses quatre champs `nature`, `type`, `categorie`, `libelle`, espaces ignorés) :

```yaml
paliers:
  - ligne: { nature: mensuel, type: depense, categorie: Logement, libelle: Loyer }
    etapes:
      - { depuis: '2027-09', montant: 950 }
      - { depuis: '2029-01', montant: 1000 }
```

Événements : clé `paliers` dans l'événement de `evenements-futurs.yaml`, avec `echeances` dans chaque palier.

Les paliers suivent la ligne quand on change son libellé ou sa catégorie dans la page. Une entrée de `paliers.yaml` dont la ligne n'existe plus (par exemple après un nouvel import Excel) est conservée comme « ligne introuvable », jamais supprimée en silence. `donnees-courantes.yaml` ne contient jamais de `paliers`. Si deux lignes ont exactement la même clé (mêmes quatre champs), seule la première porte les paliers ; la seconde reste sans palier. Renommer une ligne vers la clé d'une entrée « ligne introuvable » lui rattache cette entrée. À l'ouverture, un premier palier qui n'est pas postérieur au `debut` de la ligne est accepté (avertissement), mais devra être corrigé pour enregistrer.

Dans la page, les onglets Mensuel, Annuel & exceptionnel et Revenus et dépenses futurs ont une case « Palier » par ligne. La cocher affiche sous la ligne les sous-lignes `↳ palier N` (mois « à partir de » au format AAAA-MM, montant — un nombre pour une ligne mensuelle, les échéances sinon — et un bouton Supprimer) et le bouton « + ajouter un palier » : le nouveau palier commence le mois suivant le précédent et recopie son montant. Dès qu'une ligne a des paliers, la saisie de la « Fin » passe sur son dernier palier. Décocher la case d'une ligne qui a des paliers demande confirmation puis les supprime. Une saisie invalide (ordre non croissant, format de mois, montant) est refusée avec un message sous la ligne et rien n'est écrit. Les paliers des lignes importées sont enregistrés dans `paliers.yaml`, ceux des événements dans `evenements-futurs.yaml`. Les entrées de `paliers.yaml` sans ligne correspondante sont listées en bas de l'onglet Mensuel (« Paliers sans ligne correspondante »), avec un bouton Supprimer par entrée.

Ces fichiers sont ignorés par git.

Si vous modifiez ces fichiers à la main :

- Dans `evenements-futurs.yaml`, chaque événement décrit ses montants avec la clé `echeances` (même syntaxe que ci-dessus).
- `revalorise` doit valoir `true` ou `false` (pas `oui`/`non`).
- `parametres.yaml` n'accepte que les clés `depart`, `horizon_annees`, `revalorisation` (`taux`, `mois`) et `solde_depart` (`compte_courant`, `epargne`).
- `solde_depart` fixe ce qu'il reste sur les comptes au premier mois de la projection, à la place des montants de l'Excel (section `situation` de `donnees-courantes.yaml`). Chaque champ est indépendant : `null` (ou absent) reprend la valeur de l'Excel, un nombre la remplace (les négatifs sont acceptés). Cette valeur est conservée lors d'un nouvel import Excel. Pour revenir aux valeurs de l'Excel, videz le champ dans l'onglet Paramètres, ou mettez `null` dans le fichier.
- En cas de YAML invalide, le message d'erreur nomme le fichier concerné et rien n'est écrasé : corrigez le fichier puis rouvrez le dossier.

## Modéliser un prêt à la main

Un prêt = un revenu ponctuel à la date du versement (par exemple `2027-9-20000`) et une dépense mensuelle avec début et fin pour les remboursements. Aucun calcul d'intérêts n'est fait : saisissez la mensualité.

## Sauvegarde et partage

Un seul fichier YAML (`budget-<nom>-AAAA-MM-JJ.yaml`) regroupe `donnees-courantes.yaml`, `evenements-futurs.yaml`, `parametres.yaml` et `paliers.yaml` (ceux qui existent), tels quels, commentaires compris. L'historique `historique-comptes.csv` n'y figure pas : il est regénéré à chaque enregistrement.

- **Exporter** : onglet Paramètres, carte « Sauvegarde », bouton « Exporter la sauvegarde ». Le fichier est téléchargé depuis le dossier ouvert (donc tel qu'enregistré).
- **Importer sur un autre ordinateur** : sur l'écran d'accueil (ou dans l'onglet Paramètres), « Importer une sauvegarde », choisissez le fichier, puis le dossier de destination (par exemple un dossier vide). Le fichier est entièrement vérifié avant toute écriture ; en cas d'erreur, le message nomme le fichier concerné et rien n'est écrit.
- **Aucun remplacement silencieux** : si le dossier de destination contient déjà certains de ces fichiers, la liste vous est montrée et rien n'est écrit sans votre accord (exportez d'abord le dossier actuel). Les fichiers absents de la sauvegarde ne sont pas touchés.
- **Partager** : le fichier est un simple fichier texte de moins de 5 Mo ; envoyez-le par e-mail ou déposez-le dans un drive. Il contient vos données financières : partagez-le avec soin.

## Limites

- Chrome ou Edge uniquement (pas de Firefox ni Safari).
- L'autorisation d'accès au dossier `data/` est à redonner à chaque session.
- Un seul scénario.
- Pas d'intérêts, pas d'impôts, pas d'inflation (hors revalorisation configurée).

## Tests

- JavaScript : `npm test`
- Python : `uv run pytest tests/py`
