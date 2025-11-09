#!/usr/bin/env bash
set -a
source .env

DB_PASSWORD=$(echo "$DATABASE_URL" | awk -F':' '{print $3}' | awk -F'@' '{print $1}')
DB_PORT=$(echo "$DATABASE_URL" | awk -F':' '{print $4}' | awk -F'\/' '{print $1}')
DB_NAME=$(echo "$DATABASE_URL" | awk -F'/' '{print $4}')
DB_CONTAINER_NAME="$DB_NAME-postgres"

# Check docker or podman availability
if ! [ -x "$(command -v docker)" ] && ! [ -x "$(command -v podman)" ]; then
  echo -e "Docker or Podman not installed. Please install and try again."
  exit 1
fi

if [ -x "$(command -v docker)" ]; then DOCKER_CMD="docker"
elif [ -x "$(command -v podman)" ]; then DOCKER_CMD="podman"
fi

if ! $DOCKER_CMD info > /dev/null 2>&1; then
  echo "$DOCKER_CMD daemon not running. Start it and try again."
  exit 1
fi

# Check if port is used
if command -v nc >/dev/null 2>&1; then
  if nc -z localhost "$DB_PORT" 2>/dev/null; then
    echo "Port $DB_PORT already in use. Aborting."
    exit 1
  fi
else
  echo "Warning: netcat not installed, cannot check port"
  read -p "Continue anyway? [y/N]: " -r REPLY
  if ! [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborting."
    exit 1
  fi
fi

# Check if container already running or exists
if [ "$($DOCKER_CMD ps -q -f name=$DB_CONTAINER_NAME)" ]; then
  echo "Database container '$DB_CONTAINER_NAME' already running"
  exit 0
fi

if [ "$($DOCKER_CMD ps -q -a -f name=$DB_CONTAINER_NAME)" ]; then
  $DOCKER_CMD start "$DB_CONTAINER_NAME"
  echo "Existing database container '$DB_CONTAINER_NAME' started"
  exit 0
fi

# If password is default, ask to generate new one
if [ "$DB_PASSWORD" = "password" ]; then
  echo "You are using the default database password"
  read -p "Generate a random password? [y/N]: " -r REPLY
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    DB_PASSWORD=$(openssl rand -base64 12 | tr '+/' '-_')
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s#:password@#:$DB_PASSWORD@#" .env
    else
      sed -i "s#:password@#:$DB_PASSWORD@#" .env
    fi
    echo "Generated and updated new DB password in .env"
  else
    echo "Change default password in .env and restart"
    exit 1
  fi
fi

# Run Postgres container
$DOCKER_CMD run -d \
  --name $DB_CONTAINER_NAME \
  -e POSTGRES_USER="postgres" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "$DB_PORT":5432 \
  docker.io/postgres && echo "Database container '$DB_CONTAINER_NAME' was successfully created"
