#!/bin/sh
set -e

HOST="vadim@mac-mini.local"
REMOTE_DIR="~/docker/rust_calculator"
IMAGE="rust_calculator"
PORT=8081

echo "==> Syncing project to Mac Mini..."
rsync -az --exclude node_modules --exclude dist --exclude .git \
  ./ "$HOST:$REMOTE_DIR/"

echo "==> Building Docker image on Mac Mini..."
ssh "$HOST" "cd $REMOTE_DIR && docker build -t $IMAGE ."

echo "==> Restarting container..."
ssh "$HOST" "
  docker rm -f $IMAGE 2>/dev/null || true
  docker run -d \
    --name $IMAGE \
    --restart unless-stopped \
    -p $PORT:80 \
    $IMAGE
"

echo "==> Done! http://mac-mini.local:$PORT"
