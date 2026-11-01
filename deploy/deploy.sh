#!/bin/bash
set -euo pipefail

request="${SSH_ORIGINAL_COMMAND:-deploy.sh $*}"
if [[ "$request" =~ deploy\.sh[[:space:]]+(deploy|kou|logs-kou)([[:space:]]+([A-Za-z0-9_]+))? ]]; then
  action="${BASH_REMATCH[1]}"
  target="${BASH_REMATCH[3]}"
else
  action=""
  target=""
fi

export PATH="$HOME/.docker-deploy/bin:/usr/bin:/bin"
export DOCKER_CONFIG="$HOME/.docker-deploy"
export DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"

wait_docker() {
  if docker info >/dev/null 2>&1; then return; fi
  /usr/bin/open -a Docker
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && return; sleep 2; done
  docker info >/dev/null
}

case "$action" in
  deploy)
    case "$target" in
      rust_calculator|greek_drilling) ;;
      *) echo "unknown project: $target" >&2; exit 2 ;;
    esac
    wait_docker
    cd "$HOME/workdir/$target"
    docker compose pull
    docker compose up -d
    docker compose ps --format '{{.Name}} {{.Status}}'
    ;;
  kou)
    case "$target" in
      master) port=9090 ;;
      develop) port=9095 ;;
      *) echo "unknown env: $target" >&2; exit 2 ;;
    esac
    src=/Users/kou-runner/actions-runner/_work/kingofunderground/kingofunderground
    ctx="$(mktemp -d)"
    trap 'rm -rf "$ctx"' EXIT
    for p in Dockerfile Dockerfile.server webgl.conf Override Override/index.html build build/WebGL build/WebGL/WebGL build/StandaloneLinux64; do
      [[ -L "$src/$p" ]] && { echo "symlink in build input: $p" >&2; exit 2; }
    done
    mkdir -p "$ctx/client/Override" "$ctx/client/build/WebGL" "$ctx/server/build"
    cp -P "$src/Dockerfile" "$src/webgl.conf" "$ctx/client/"
    cp -P "$src/Override/index.html" "$ctx/client/Override/"
    cp -RP "$src/build/WebGL/WebGL" "$ctx/client/build/WebGL/"
    cp -P "$src/Dockerfile.server" "$ctx/server/"
    cp -RP "$src/build/StandaloneLinux64" "$ctx/server/build/"
    if [[ -n "$(find "$ctx" -type l -print -quit)" ]]; then echo "symlink in build output" >&2; exit 2; fi
    wait_docker
    docker build -t "kingofunderground/webgl:$target" "$ctx/client"
    docker buildx build --platform linux/amd64 -f "$ctx/server/Dockerfile.server" -t "kingofunderground/server:$target" --load "$ctx/server"
    mkdir -p "$HOME/workdir/kingofunderground"
    compose="$HOME/workdir/kingofunderground/docker-compose.$target.yml"
    cat > "$compose" <<EOF2
services:
  webgl:
    container_name: client-$target
    image: kingofunderground/webgl:$target
    ports:
      - "127.0.0.1:$port:80"
    restart: unless-stopped
  gameserver:
    container_name: server-$target
    image: kingofunderground/server:$target
    platform: linux/amd64
    restart: unless-stopped
EOF2
    docker compose -p "kou-$target" -f "$compose" up -d
    docker image prune -f
    sleep 8
    docker compose -p "kou-$target" -f "$compose" ps
    ;;
  logs-kou)
    lines="${target:-200}"
    [[ "$lines" =~ ^[0-9]{1,5}$ ]] || { echo "bad line count" >&2; exit 2; }
    wait_docker
    echo "=== containers ==="
    docker ps --filter name=-master --filter name=-develop --format '{{.Names}} {{.Status}}'
    echo "=== CPU/MEM ==="
    docker ps -q --filter name=server- | xargs docker stats --no-stream --format '{{.Name}}  CPU={{.CPUPerc}}  MEM={{.MemUsage}}'
    echo "=== server-master logs (last $lines) ==="
    docker logs --tail "$lines" server-master 2>&1
    ;;
  *)
    echo "usage: deploy <rust_calculator|greek_drilling> | kou <master|develop> | logs-kou [lines]" >&2
    exit 2
    ;;
esac
