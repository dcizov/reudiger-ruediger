#!/bin/bash
set -e

cd /opt/reudiger-ruediger

git fetch --all
git reset --hard origin/main

docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache

docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm migrate

docker rm -f reudiger-ruediger-prod || true

docker image prune -f

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo "Deployment and migration completed at $(date)"
