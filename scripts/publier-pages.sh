#!/usr/bin/env bash
# Met à jour la branche locale gh-pages avec la page seule, construite à partir
# de l'état COMMITTÉ (voir publier.sh).
# Usage : ./scripts/publier-pages.sh [--push]
#   --push  récupère gh-pages distante, publie par-dessus, puis l'envoie sur origin
#           (git push simple, jamais --force)
set -eu

usage="Usage : ./scripts/publier-pages.sh [--push]"
pousser=0
for arg in "$@"; do
  case "$arg" in
    --push) pousser=1 ;;
    -h|--help) echo "$usage"; exit 0 ;;
    *) echo "Option inconnue : $arg" >&2; echo "$usage" >&2; exit 2 ;;
  esac
done

racine=$(cd -P "$(dirname "$0")/.." && pwd)
cd "$racine"

# Ce qui est publié doit être ce qui est validé.
sales=$(git status --porcelain --untracked-files=no -- index.html js css vendor)
if [ -n "$sales" ]; then
  echo "Des fichiers de la page ont des modifications non validées : validez-les (git commit) avant de publier." >&2
  echo "$sales" >&2
  exit 1
fi
inconnus=$(git ls-files --others --exclude-standard -- index.html js css vendor | tr '\n' ' ')
if [ -n "$inconnus" ]; then
  echo "Note : fichiers non suivis (jamais publiés) : $inconnus"
fi

court=$(git rev-parse --short HEAD)
date_jour=$(date +%Y-%m-%d)
sortie="$racine/dist"

# Seul le mode --push touche au réseau.
distante=0
if [ "$pousser" -eq 1 ]; then
  code=0
  git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1 || code=$?
  case "$code" in
    0)
      if ! git fetch --quiet origin "+refs/heads/gh-pages:refs/remotes/origin/gh-pages"; then
        echo "Impossible de récupérer gh-pages depuis origin : vérifiez la connexion et vos droits, puis relancez." >&2
        exit 1
      fi
      distante=1
      ;;
    2) echo "gh-pages n'existe pas encore sur origin : elle sera créée." ;;
    *)
      echo "Impossible de joindre origin (code $code) : vérifiez la connexion et vos droits, puis relancez." >&2
      exit 1
      ;;
  esac
fi

"$racine/scripts/publier.sh" "$sortie"

temp=$(mktemp -d "${TMPDIR:-/tmp}/publier-pages.XXXXXX")
arbre="$temp/arbre"
nettoyer() {
  git -C "$racine" worktree remove --force "$arbre" >/dev/null 2>&1 || true
  git -C "$racine" worktree prune >/dev/null 2>&1 || true
  rm -rf "$temp"
}
trap nettoyer EXIT

# Un arbre de travail resté d'un lancement interrompu ne doit pas bloquer.
git worktree prune

if git show-ref --verify --quiet refs/heads/gh-pages; then
  git worktree add --quiet "$arbre" gh-pages
  if [ "$distante" -eq 1 ] && ! git merge-base --is-ancestor refs/remotes/origin/gh-pages refs/heads/gh-pages; then
    echo "gh-pages locale en retard ou divergente : repartir de la gh-pages distante (le contenu est régénéré à chaque publication)."
    git -C "$arbre" reset --quiet --hard refs/remotes/origin/gh-pages
  fi
elif [ "$distante" -eq 1 ]; then
  git worktree add --quiet -b gh-pages "$arbre" refs/remotes/origin/gh-pages
else
  echo "Création de la branche gh-pages (première publication)."
  git worktree add --quiet --detach "$arbre" HEAD
  git -C "$arbre" checkout --quiet --orphan gh-pages
  git -C "$arbre" rm -rfq --ignore-unmatch .
fi

# La branche ne contient que la sortie de la construction : on vide l'arbre
# temporaire (sauf son fichier .git, qui le relie au dépôt) puis on le remplit.
find "$arbre" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$sortie"/. "$arbre"/
git -C "$arbre" add -A

if [ -z "$(git -C "$arbre" status --porcelain)" ]; then
  echo "Rien à publier : la page est déjà à jour."
else
  # --no-verify : aucun hook du dépôt ne doit s'exécuter dans l'arbre temporaire.
  git -C "$arbre" commit --quiet --no-verify -m "publication $date_jour ($court)"
  echo "Branche gh-pages mise à jour : publication $date_jour ($court)."
fi

if [ "$pousser" -eq 1 ]; then
  if sortie_push=$(git push origin gh-pages 2>&1); then
    echo "$sortie_push"
    echo "gh-pages envoyée sur origin."
  else
    echo "$sortie_push" >&2
    echo "L'envoi a été rejeté. Cause probable : la branche gh-pages distante a changé entre-temps (ou vos droits sont insuffisants)." >&2
    echo "Relancez la commande ; ne forcez pas sans savoir pourquoi." >&2
    exit 1
  fi
else
  echo "Sans --push : on ne pousse rien. Pour envoyer : ./scripts/publier-pages.sh --push"
fi
