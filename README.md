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

Ces fichiers sont ignorés par git.

Si vous modifiez ces fichiers à la main :

- Dans `evenements-futurs.yaml`, chaque événement décrit ses montants avec la clé `echeances` (même syntaxe que ci-dessus).
- `revalorise` doit valoir `true` ou `false` (pas `oui`/`non`).
- `parametres.yaml` n'accepte que les clés `depart`, `horizon_annees`, `revalorisation` (`taux`, `mois`) et `solde_depart` (`compte_courant`, `epargne`).
- `solde_depart` fixe ce qu'il reste sur les comptes au premier mois de la projection, à la place des montants de l'Excel (section `situation` de `donnees-courantes.yaml`). Chaque champ est indépendant : `null` (ou absent) reprend la valeur de l'Excel, un nombre la remplace (les négatifs sont acceptés). Cette valeur est conservée lors d'un nouvel import Excel. Pour revenir aux valeurs de l'Excel, videz le champ dans l'onglet Paramètres, ou mettez `null` dans le fichier.
- En cas de YAML invalide, le message d'erreur nomme le fichier concerné et rien n'est écrasé : corrigez le fichier puis rouvrez le dossier.

## Modéliser un prêt à la main

Un prêt = un revenu ponctuel à la date du versement (par exemple `2027-9-20000`) et une dépense mensuelle avec début et fin pour les remboursements. Aucun calcul d'intérêts n'est fait : saisissez la mensualité.

## Limites

- Chrome ou Edge uniquement (pas de Firefox ni Safari).
- L'autorisation d'accès au dossier `data/` est à redonner à chaque session.
- Un seul scénario.
- Pas d'intérêts, pas d'impôts, pas d'inflation (hors revalorisation configurée).

## Tests

- JavaScript : `npm test`
- Python : `uv run pytest tests/py`
