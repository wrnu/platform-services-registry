#!/usr/bin/env bash
# Start/stop Cloudflare quick tunnels for the local app (3000) and Keycloak (8080).
# Updates app/.env.local so OAuth works through the public URLs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ENV_FILE="$ROOT/app/.env.local"
ENV_BACKUP="$ROOT/sandbox/.tunnel/.env.local.bak"
TUNNEL_DIR="$ROOT/sandbox/.tunnel"
APP_PORT="${APP_PORT:-3000}"
KEYCLOAK_PORT="${KEYCLOAK_PORT:-8080}"
URL_PATTERN='https://[a-zA-Z0-9-]+\.trycloudflare\.com'

sed_inplace() {
    if [[ ${OSTYPE:-} == darwin* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

require_cloudflared() {
    if ! command -v cloudflared >/dev/null 2>&1; then
        echo "cloudflared is not installed."
        echo "Install: brew install cloudflared"
        exit 1
    fi
}

ensure_env_file() {
    if [[ ! -f $APP_ENV_FILE ]]; then
        if [[ -f "$ROOT/app/.env.example" ]]; then
            cp "$ROOT/app/.env.example" "$APP_ENV_FILE"
            echo "Created $APP_ENV_FILE from .env.example"
        else
            echo "Missing $APP_ENV_FILE — copy app/.env.example first."
            exit 1
        fi
    fi
}

is_running() {
    local name=$1
    local pid_file="$TUNNEL_DIR/${name}.pid"
    [[ -f $pid_file ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

wait_for_tunnel_url() {
    local logfile=$1
    local timeout=${2:-90}
    local elapsed=0
    local url

    while ((elapsed < timeout)); do
        url=$(grep -oE "$URL_PATTERN" "$logfile" 2>/dev/null | head -1 || true)
        if [[ -n $url ]]; then
            echo "$url"
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    echo "Timed out waiting for tunnel URL in $logfile" >&2
    tail -20 "$logfile" >&2 || true
    return 1
}

set_env_var() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" "$APP_ENV_FILE"; then
        sed_inplace "s|^${key}=.*|${key}=${value}|" "$APP_ENV_FILE"
    else
        echo "${key}=${value}" >>"$APP_ENV_FILE"
    fi
}

start_tunnel() {
    local port=$1
    local name=$2
    local log="$TUNNEL_DIR/${name}.log"
    local pid_file="$TUNNEL_DIR/${name}.pid"

    if is_running "$name"; then
        echo "Tunnel $name already running (pid $(cat "$pid_file"))"
        wait_for_tunnel_url "$log" 5 || true
        grep -oE "$URL_PATTERN" "$log" 2>/dev/null | head -1
        return 0
    fi

    : >"$log"
    local metrics_port=$((20000 + port))
    cloudflared tunnel --url "http://localhost:${port}" --metrics "127.0.0.1:${metrics_port}" >>"$log" 2>&1 &
    echo $! >"$pid_file"
    wait_for_tunnel_url "$log"
}

cmd_start() {
    require_cloudflared
    mkdir -p "$TUNNEL_DIR"
    ensure_env_file

    kill_tunnel app
    kill_tunnel keycloak
    rm -f "$TUNNEL_DIR/urls.txt"

    if [[ ! -f $ENV_BACKUP ]]; then
        cp "$APP_ENV_FILE" "$ENV_BACKUP"
        echo "Backed up .env.local to sandbox/.tunnel/.env.local.bak"
    fi

    echo "Starting Keycloak tunnel (localhost:${KEYCLOAK_PORT})..."
    KEYCLOAK_URL=$(start_tunnel "$KEYCLOAK_PORT" keycloak)

    echo "Starting app tunnel (localhost:${APP_PORT})..."
    APP_URL=$(start_tunnel "$APP_PORT" app)

    set_env_var BASE_URL "$APP_URL"
    set_env_var NEXTAUTH_URL "$APP_URL"
    # next.config.js reads BASE_URL for allowedDevOrigins (tunnel hostname)
    set_env_var AUTH_BASE_URL "$KEYCLOAK_URL"
    set_env_var AUTH_SERVER_URL "$KEYCLOAK_URL"
    set_env_var AWS_ROLES_BASE_URL "$KEYCLOAK_URL"
    set_env_var CHES_TOKEN_URL "${KEYCLOAK_URL}/realms/platform-services/protocol/openid-connect/token"

    if grep -q '^MS_GRAPH_API_TOKEN_ENDPOINT=' "$APP_ENV_FILE"; then
        if grep '^MS_GRAPH_API_TOKEN_ENDPOINT=' "$APP_ENV_FILE" | grep -qE 'localhost:(8443|8080)'; then
            set_env_var MS_GRAPH_API_TOKEN_ENDPOINT \
                "${KEYCLOAK_URL}/realms/platform-services/protocol/openid-connect/token"
        fi
    fi

    cat >"$TUNNEL_DIR/urls.txt" <<EOF
APP_URL=$APP_URL
KEYCLOAK_URL=$KEYCLOAK_URL
EOF

    echo ""
    echo "================================================================"
    echo "  Share this URL (login first):"
    echo "  $APP_URL/login"
    echo ""
    echo "  Or after signing in:"
    echo "  $APP_URL"
    echo ""
    echo "  Keycloak (for reference): $KEYCLOAK_URL"
    echo "================================================================"
    echo ""
    echo "Updated app/.env.local for tunnel mode."
    echo "Restart the Next dev server if it is already running:"
    echo "  cd app && pnpm run dev"
    echo ""
    echo "  Do not use lsof -ti:3000 | xargs kill — that also kills the app tunnel."
    echo "  Stop Next with Ctrl+C in its terminal, or: pkill -f 'next dev --webpack'"
    echo ""
    echo "Stop tunnels and restore .env.local:"
    echo "  make tunnel-stop"
    echo "  (or press Ctrl+C in this terminal)"

    trap 'echo ""; echo "Stopping tunnels..."; cmd_stop; exit 0' INT TERM

    if [[ ${TUNNEL_DETACHED:-} == true ]]; then
        echo ""
        echo "Detached mode — tunnels run in background. Use make tunnel-stop to stop."
        return 0
    fi

    echo ""
    echo "----------------------------------------------------------------"
    echo "  Tunnels are running — keep this terminal open while sharing."
    echo "  Press Ctrl+C to stop tunnels and restore .env.local."
    echo "----------------------------------------------------------------"

    while is_running app || is_running keycloak; do
        sleep 2
    done
}

kill_tunnel() {
    local name=$1
    local pid_file="$TUNNEL_DIR/${name}.pid"
    if [[ -f $pid_file ]]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            wait "$pid" 2>/dev/null || true
        fi
        rm -f "$pid_file"
    fi
}

cmd_stop() {
    kill_tunnel app
    kill_tunnel keycloak
    rm -f "$TUNNEL_DIR/urls.txt"

    if [[ -f $ENV_BACKUP ]]; then
        cp "$ENV_BACKUP" "$APP_ENV_FILE"
        rm -f "$ENV_BACKUP"
        echo "Restored app/.env.local from backup."
        echo "Restart the Next dev server to use localhost URLs again."
    else
        echo "No .env.local backup found — tunnels stopped."
    fi
}

cmd_status() {
    for name in app keycloak; do
        if is_running "$name"; then
            local log="$TUNNEL_DIR/${name}.log"
            local url
            url=$(grep -oE "$URL_PATTERN" "$log" 2>/dev/null | head -1 || echo "unknown")
            echo "$name: running (pid $(cat "$TUNNEL_DIR/${name}.pid")) -> $url"
        else
            echo "$name: not running"
        fi
    done
    if [[ -f "$TUNNEL_DIR/urls.txt" ]]; then
        echo ""
        cat "$TUNNEL_DIR/urls.txt"
    fi
}

usage() {
    echo "Usage: $0 {start|stop|status}"
    exit 1
}

case "${1:-}" in
start) cmd_start ;;
stop) cmd_stop ;;
status) cmd_status ;;
*) usage ;;
esac
