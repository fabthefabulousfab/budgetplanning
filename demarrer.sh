#!/bin/sh
# Lance l'application budget prévisionnel.
# Usage : ./demarrer.sh [--depuis-excel]
#   --depuis-excel  régénère data/donnees-courantes.yaml depuis budget.xlsx
# Variable d'environnement : DEMARRER_SANS_OUVRIR=1 n'ouvre pas Chrome (tests).
set -eu

cd "$(dirname "$0")"

XLSX="budget.xlsx"
COURANT="data/donnees-courantes.yaml"
depuis_excel=0

for arg in "$@"; do
  case "$arg" in
    --depuis-excel) depuis_excel=1 ;;
    -h|--help) echo "Usage : ./demarrer.sh [--depuis-excel]"; exit 0 ;;
    *) echo "Option inconnue : $arg" >&2; echo "Usage : ./demarrer.sh [--depuis-excel]" >&2; exit 2 ;;
  esac
done

convertir=0
if [ -f "$XLSX" ]; then
  if [ "$depuis_excel" -eq 1 ] || [ ! -f "$COURANT" ]; then
    convertir=1
  elif [ -t 0 ] && [ -t 1 ]; then
    printf '%s' "Repartir de budget.xlsx (écrase les modifications faites dans la page) ? [o/N] "
    reponse=""
    read -r reponse || reponse=""
    case "$reponse" in o|O|oui|OUI|Oui) convertir=1 ;; esac
  fi
elif [ "$depuis_excel" -eq 1 ]; then
  echo "budget.xlsx est introuvable : impossible de convertir." >&2
  exit 1
elif [ ! -f "$COURANT" ]; then
  echo "Ni budget.xlsx ni $COURANT : rien à afficher. Placez budget.xlsx à la racine du projet." >&2
  exit 1
fi

if [ "$convertir" -eq 1 ]; then
  if ! command -v uv >/dev/null 2>&1; then
    echo "uv est introuvable : installez-le (https://docs.astral.sh/uv/) pour convertir $XLSX. Les fichiers YAML existants sont inchangés." >&2
    exit 1
  fi
  if ! uv run python scripts/excel_to_yaml.py "$XLSX"; then
    echo "La conversion de $XLSX a échoué : les fichiers YAML existants sont inchangés." >&2
    exit 1
  fi
else
  echo "Démarrage à partir des fichiers YAML existants."
fi

if [ "${DEMARRER_SANS_OUVRIR:-}" = "1" ]; then
  echo "DEMARRER_SANS_OUVRIR=1 : Chrome n'est pas ouvert."
  exit 0
fi

open -a "Google Chrome" index.html
