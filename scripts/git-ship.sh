#!/usr/bin/env bash
set -euo pipefail

# Usage: npm run ship --m="your commit message" OR ./scripts/git-ship.sh your commit message

if [[ $# -gt 0 ]]; then
  MSG="$*"
else
  # Support npm config param: npm run ship --m="message"
  MSG=${npm_config_m:-"chore: ship changes"}
fi

git add -A
git commit -m "$MSG" || echo "Nothing to commit; continuing..."
git pull --rebase origin main
git push origin main

echo "Shipped to main: $MSG"
