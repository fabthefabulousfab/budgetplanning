#!/usr/bin/env bash
# Met à jour la branche locale gh-pages avec la page seule (voir publier.sh).
# Usage : ./scripts/publier-pages.sh [--push]
#   --push  envoie ensuite gh-pages sur origin (git push simple, jamais --force)
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

court=$(git rev-parse --short HEAD)
date_jour=$(date +%Y-%m-%d)
sortie="$racine/dist"

"$racine/scripts/publier.sh" "$sortie"

temp=$(mktemp -d "${TMPDIR:-/tmp}/publier-pages.XXXXXX")
arbre="$temp/arbre"
nettoyer() {
  git -C "$racine" worktree remove --force "$arbre" >/dev/null 2>&1 || true
  git -C "$racine" worktree prune >/dev/null 2>&1 || true
  rm -rf "$temp"
}
trap nettoyer EXIT

if git show-ref --verify --quiet refs/heads/gh-pages; then
  git worktree add --quiet "$arbre" gh-pages
else
  echo "Création de la branche gh-pages (première publication)."
  git worktree add --quiet --detach "$arbre" HEAD
  git -C "$arbre" checkout --quiet --orphan gh-pages
  git -C "$arbre" rm -rfq --ignore-unmatch .
fi

# La branche ne contient que la sortie de la construction.
find "$arbre" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$sortie"/. "$arbre"/
git -C "$arbre" add -A

if [ -z "$(git -C "$arbre" status --porcelain)" ]; then
  echo "Rien à publier : la page est déjà à jour."
else
  git -C "$arbre" commit --quiet -m "publication $date_jour ($court)"
  echo "Branche gh-pages mise à jour : publication $date_jour ($court)."
fi

if [ "$pousser" -eq 1 ]; then
  if sortie_push=$(git push origin gh-pages 2>&1); then
    echo "$sortie_push"
    echo "gh-pages envoyée sur origin."
  else
    echo "$sortie_push" >&2
    echo "L'envoi a été rejeté : voir le message ci-dessus (rien n'a été forcé)." >&2
    exit 1
  fi
else
  echo "Sans --push : on ne pousse rien. Pour envoyer : ./scripts/publier-pages.sh --push"
fi
