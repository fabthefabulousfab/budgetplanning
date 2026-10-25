#!/usr/bin/env bash
# Construit le dossier de publication à partir de l'état COMMITTÉ (HEAD) :
# la page seule (index.html, js/*.js, css/*.css, vendor/*.js) + .nojekyll,
# jamais de documents, tests, données, secrets, ni de fichier non validé.
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
if [ "${1+x}" = x ] && [ -z "$1" ]; then
  echo "Dossier de sortie vide : refusé." >&2
  exit 1
fi

tab=$(printf '\t')
racine=$(cd -P "$(dirname "$0")/.." && pwd)
demande="${1:-$racine/dist}"

if ! command -v git >/dev/null 2>&1; then
  echo "git est introuvable : il est nécessaire pour publier l'état validé de la page." >&2
  exit 1
fi
haut=$(git -C "$racine" rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$haut" ] || [ "$(cd -P "$haut" && pwd)" != "$racine" ]; then
  echo "Ce dossier n'est pas un dépôt git (racine attendue : $racine) : publication impossible." >&2
  exit 1
fi
if ! git -C "$racine" rev-parse --verify --quiet HEAD >/dev/null; then
  echo "Le dépôt n'a aucun commit : validez la page (git commit) avant de publier." >&2
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
if [ -d "$sortie" ]; then
  if [ -n "$(git -C "$racine" ls-files -- "${sortie#"$racine"/}" | head -n 1)" ]; then
    refuser "il contient des fichiers suivis par git."
  fi
fi

# Liste des entrées validées des dossiers publiables ; tout lien symbolique,
# sous-module ou fichier spécial fait refuser la construction.
entrees=$(git -C "$racine" ls-tree -r -z HEAD -- index.html js css vendor | tr '\0' '\n')
if [ -z "$entrees" ]; then
  echo "index.html est absent du dernier commit : rien à publier." >&2
  exit 1
fi
while IFS= read -r ligne; do
  mode=${ligne%% *}
  chemin=${ligne#*"$tab"}
  case "$mode" in
    100644|100755) ;;
    *) echo "Construction refusée : « $chemin » n'est pas un fichier ordinaire (mode $mode : lien symbolique ou sous-module)." >&2; exit 1 ;;
  esac
done <<EOF
$entrees
EOF

sales=$(git -C "$racine" status --porcelain --untracked-files=no -- index.html js css vendor)
echo "Construction de l'état COMMITTÉ (HEAD) : les fichiers non validés ne sont jamais publiés."
if [ -n "$sales" ]; then
  echo "Attention : des fichiers de la page ont des modifications non validées (ignorées) :" >&2
  echo "$sales" | sed 's|^|  |' >&2
fi

mkdir -p "$sortie"
# Seul le dossier de sortie est vidé (contenu, fichiers cachés compris).
find "$sortie" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

extraire() { # chemin : copie le contenu validé (HEAD) vers la sortie
  mkdir -p "$sortie/$(dirname "$1")"
  git -C "$racine" show "HEAD:$1" > "$sortie/$1"
}
while IFS= read -r ligne; do
  chemin=${ligne#*"$tab"}
  dossier=$(dirname "$chemin")
  nom=$(basename "$chemin")
  case "$dossier" in
    .) if [ "$nom" = index.html ]; then extraire "$chemin"; fi ;;
    js|vendor) case "$nom" in *.js) extraire "$chemin" ;; esac ;;
    css) case "$nom" in *.css) extraire "$chemin" ;; esac ;;
  esac
done <<EOF
$entrees
EOF
: > "$sortie/.nojekyll"

echo "Publication construite dans : $sortie"
echo "Fichiers publiés :"
(cd "$sortie" && find . -type f | sed 's|^\./||' | LC_ALL=C sort) | sed 's|^|  |'
