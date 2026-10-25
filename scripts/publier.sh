#!/usr/bin/env bash
# Construit le dossier de publication : la page seule (index.html, js/, css/, vendor/),
# jamais de documents, tests, données ni secrets.
# Usage : ./scripts/publier.sh [dossier-sortie]   (défaut : dist/ à la racine du dépôt)
set -eu

usage="Usage : ./scripts/publier.sh [dossier-sortie]"

case "${1:-}" in
  -h|--help) echo "$usage"; exit 0 ;;
esac
if [ "$#" -gt 1 ]; then
  echo "$usage" >&2
  exit 2
fi

racine=$(cd -P "$(dirname "$0")/.." && pwd)
demande="${1:-$racine/dist}"

if [ -z "$demande" ]; then
  echo "Dossier de sortie vide : refusé." >&2
  exit 1
fi

# Chemin absolu sans exiger que le dossier existe : on résout le plus proche
# ancêtre existant (liens symboliques compris) puis on rajoute le reste.
case "$demande" in
  /*) absolu="$demande" ;;
  *) absolu="$PWD/$demande" ;;
esac
reste=""
base="$absolu"
while [ ! -d "$base" ]; do
  nom=$(basename "$base")
  case "$nom" in
    ..|.) echo "Chemin de sortie refusé (« $demande ») : '.' ou '..' dans une partie à créer." >&2; exit 1 ;;
  esac
  reste="/$nom$reste"
  base=$(dirname "$base")
done
base=$(cd -P "$base" && pwd)
sortie="${base%/}$reste"
[ -n "$sortie" ] || sortie="/"

refuser() {
  echo "Dossier de sortie refusé (« $demande ») : $1" >&2
  exit 1
}

case "$sortie" in
  "$racine") refuser "c'est la racine du dépôt." ;;
  "$racine"/*) ;;
  *) refuser "il est en dehors du dépôt ($racine)." ;;
esac
for protege in .git js css vendor; do
  case "$sortie" in
    "$racine/$protege"|"$racine/$protege"/*) refuser "$protege est un dossier du dépôt à ne jamais vider." ;;
  esac
done
# Ne jamais vider un dossier qui contient des fichiers suivis par git.
if [ -d "$sortie" ] && command -v git >/dev/null 2>&1 && [ -d "$racine/.git" ]; then
  if [ -n "$(git -C "$racine" ls-files -- "${sortie#"$racine"/}" 2>/dev/null | head -n 1)" ]; then
    refuser "il contient des fichiers suivis par git."
  fi
fi

mkdir -p "$sortie"
# Seul le dossier de sortie est vidé (contenu, fichiers cachés compris).
find "$sortie" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

cp "$racine/index.html" "$sortie/index.html"
: > "$sortie/.nojekyll"

copier() { # dossier extension
  mkdir -p "$sortie/$1"
  for f in "$racine/$1"/*."$2"; do
    [ -f "$f" ] || continue
    cp "$f" "$sortie/$1/$(basename "$f")"
  done
}
copier js js
copier css css
copier vendor js

echo "Publication construite dans : $sortie"
echo "Fichiers publiés :"
(cd "$sortie" && find . -type f | sed 's|^\./||' | LC_ALL=C sort) | sed 's|^|  |'
