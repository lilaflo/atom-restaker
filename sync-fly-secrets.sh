#!/bin/bash
# Usage: ./sync-fly-secrets.sh

set -e

if [ ! -f .env ]; then
  echo ".env file not found!"
  exit 1
fi

# Read each non-comment, non-empty line and build the fly secrets set command
CMD="fly secrets set"
while IFS= read -r line; do
  # Skip comments and empty lines
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
  # Only process lines with KEY=VALUE
  if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
    CMD+=" $line"
  fi
done < .env

echo "Running: $CMD"
eval $CMD