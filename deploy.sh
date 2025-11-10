#!/bin/bash
set -e

cd /opt/reudiger-ruediger

# Pull latest code
git fetch --all
git reset --hard origin/main

# Build updated images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache

# Stop and remove old container
docker rm -f reudiger-ruediger-prod || true

# Clean dangling images to free up space
docker image prune -f

# Start new container detached
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo "Deployment completed at $(date)"
