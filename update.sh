#!/bin/sh
# Pull the latest pre-built image and restart the container.
# Run this on Unraid instead of git pull + docker compose build.
set -e
docker compose pull
docker compose up -d --force-recreate
echo "Done. Container is up to date."
