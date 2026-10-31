#!/usr/bin/env bash
# Deploy bricks-mcp-bridge from repo to local Docker WordPress.
# Usage: ./scripts/deploy_mcp_bridge.sh [container_name]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${1:-vietnixvn-vnxdev_website-1}"
PLUGIN_SRC="$ROOT/plugins/bricks-mcp-bridge"
DEST="/var/www/html/wp-content/plugins/bricks-mcp-bridge"

if [[ ! -d "$PLUGIN_SRC" ]]; then
  echo "Missing $PLUGIN_SRC" >&2
  exit 1
fi

docker exec "$CONTAINER" rm -rf "$DEST"
docker cp "$PLUGIN_SRC" "$CONTAINER:/var/www/html/wp-content/plugins/"
echo "Deployed to $CONTAINER:$DEST"
echo "Activate in WP Admin if first install; token: Bricks MCP Bridge settings."
