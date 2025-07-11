#!/bin/sh
cd /app
echo "[Restake] $(date): running restake bot"

# Run the restake bot with a 10-minute timeout
timeout 600 node dist/index.js

# Check the exit code
EXIT_CODE=$?
if [ $EXIT_CODE -eq 124 ]; then
  echo "❌ Restake bot timed out after 10 minutes"
  exit 1
elif [ $EXIT_CODE -ne 0 ]; then
  echo "❌ Restake bot failed with exit code $EXIT_CODE"
  exit $EXIT_CODE
else
  echo "✅ Restake bot completed successfully"
  exit 0
fi 