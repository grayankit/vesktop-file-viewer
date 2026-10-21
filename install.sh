#!/usr/bin/env bash
# Build Full File Viewer into a Vencord desktop bundle and point Vesktop at it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENCORD_DIR="${VENCORD_DIR:-$HOME/.local/share/full-file-viewer/Vencord}"
PLUGIN_NAME="fullFileViewer"
CMD="${1:-all}"

if [[ -n "${VESKTOP_STATE_FILE:-}" ]]; then
    STATE_FILE="$VESKTOP_STATE_FILE"
elif [[ -f "$HOME/.config/vesktop/state.json" ]]; then
    STATE_FILE="$HOME/.config/vesktop/state.json"
elif [[ -f "$HOME/.var/app/dev.vencord.Vesktop/config/vesktop/state.json" ]]; then
    STATE_FILE="$HOME/.var/app/dev.vencord.Vesktop/config/vesktop/state.json"
else
    STATE_FILE="$HOME/.config/vesktop/state.json"
fi

LOCK_FILE="$(dirname "$STATE_FILE")/SingletonLock"

need() {
    command -v "$1" >/dev/null 2>&1 || {
        echo "Missing '$1'. Install it and run this again."
        exit 1
    }
}

vesktop_running() {
    [[ -e "$LOCK_FILE" ]]
}

clone_vencord() {
    if [[ ! -d "$VENCORD_DIR/.git" ]]; then
        git clone --depth 1 https://github.com/Vendicated/Vencord.git "$VENCORD_DIR"
    fi
}

install_plugin() {
    mkdir -p "$VENCORD_DIR/src/userplugins"
    rm -rf "$VENCORD_DIR/src/userplugins/$PLUGIN_NAME"
    mkdir -p "$VENCORD_DIR/src/userplugins/$PLUGIN_NAME"
    cp -a "$ROOT/plugin/." "$VENCORD_DIR/src/userplugins/$PLUGIN_NAME/"
}

build() {
    need git
    need node
    need corepack
    clone_vencord
    install_plugin
    (
        cd "$VENCORD_DIR"
        corepack pnpm install --frozen-lockfile
        corepack pnpm build
    )
    if [[ ! -f "$VENCORD_DIR/dist/package.json" ]]; then
        printf '%s\n' '{}' > "$VENCORD_DIR/dist/package.json"
    fi
    if ! grep -q "FullFileViewer" "$VENCORD_DIR/dist/vencordDesktopRenderer.js"; then
        echo "Build finished, but FullFileViewer was not in the bundle."
        exit 1
    fi
    echo "Built $VENCORD_DIR/dist"
}

apply() {
    if vesktop_running; then
        echo "Vesktop is still running, so its settings file would overwrite this change."
        echo "Quit it completely, including the tray icon, then run:"
        echo "  $ROOT/install.sh apply"
        exit 1
    fi
    if [[ ! -f "$VENCORD_DIR/dist/vencordDesktopRenderer.js" ]]; then
        echo "No build found. Run: $ROOT/install.sh build"
        exit 1
    fi
    python3 - "$STATE_FILE" "$VENCORD_DIR/dist" << 'PY'
import json, sys
from pathlib import Path
state_path, dist = Path(sys.argv[1]), sys.argv[2]
data = {}
if state_path.exists() and state_path.read_text().strip():
    data = json.loads(state_path.read_text())
data["vencordDir"] = dist
state_path.parent.mkdir(parents=True, exist_ok=True)
state_path.write_text(json.dumps(data, indent=4) + "\n")
print(f"Vesktop will load Vencord from {dist}")
PY
}

case "$CMD" in
    build) build ;;
    apply) apply ;;
    all)
        build
        if vesktop_running; then
            echo
            echo "Build is ready. Quit Vesktop completely (tray icon too), then run:"
            echo "  $ROOT/install.sh apply"
            echo "Start Vesktop again after that. Full File Viewer is on by default."
        else
            apply
            echo "Start Vesktop. Full File Viewer is on by default."
        fi
        ;;
    *)
        echo "Usage: $0 [build|apply|all]"
        exit 1
        ;;
esac
