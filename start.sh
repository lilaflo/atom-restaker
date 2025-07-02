#!/bin/sh
cd /app
echo "[Cron] $(date): running pnpm run start"
exec pnpm run start