#!/bin/bash
set -euo pipefail

request="${SSH_ORIGINAL_COMMAND:-deploy.sh $*}"
if [[ "$request" =~ deploy\.sh[[:space:]]+(deploy|logs-kou)([[:space:]]+([A-Za-z0-9_]+))? ]]; then
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
    echo "usage: deploy <rust_calculator|greek_drilling> | logs-kou [lines]" >&2
    exit 2
    ;;
esac
