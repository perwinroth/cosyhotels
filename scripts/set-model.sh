#!/usr/bin/env bash
set -euo pipefail

VAL="${1:-}"
if [[ -z "$VAL" ]]; then
  echo "Usage: scripts/set-model.sh <model>"
  echo "Example: scripts/set-model.sh gpt-5"
  exit 1
fi

FILE=".env.local"
TMP="$(mktemp)"

if [[ -f "$FILE" ]]; then
  # remove existing OPENAI_MODEL lines
  grep -v '^OPENAI_MODEL=' "$FILE" > "$TMP" || true
  mv "$TMP" "$FILE"
fi

echo "OPENAI_MODEL=$VAL" >> "$FILE"
echo "Set OPENAI_MODEL=$VAL in $FILE"

