#!/usr/bin/env bash
# Give the TV its stock launcher back: re-enables what tools/disable-stock-launcher.sh disabled (through
# cleanyourtv's tools/restore.sh, which also returns Home to it) and, with --uninstall, removes Metro Home.
#
# Usage: CLEANYOURTV=~/cleanyourtv TV_HOST=192.168.1.50 tools/restore.sh [--uninstall]
# The debloat itself is undone separately, with the list you applied:
#   TV_HOST=... $CLEANYOURTV/tools/restore.sh <your debloat list> com.google.android.apps.tv.launcherx
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CYT="${CLEANYOURTV:?set CLEANYOURTV to your cleanyourtv clone}"
CYT="$(cd "$CYT" && pwd)"
: "${TV_HOST:?set TV_HOST to the TV IP address}"
PKG=com.dccreativity.metrohome
LIST="$HERE/state/stock-launcher.txt"
PY="$CYT/tools/venv/bin/python"
tv() { "$PY" -I "$CYT/tools/tv.py" "$@"; }

if [ -f "$LIST" ]; then
  STOCK=$(grep -v '^#' "$LIST" | grep -v setupwraith | head -n 1)
  TV_HOST="$TV_HOST" "$CYT/tools/restore.sh" "$LIST" "${STOCK:-com.google.android.apps.tv.launcherx}"
else
  echo "No $LIST: the stock launcher was not disabled from this folder. Re-enabling the usual ones directly."
  for p in com.google.android.apps.tv.launcherx com.google.android.tvlauncher com.google.android.tungsten.setupwraith; do
    tv "pm enable $p" 2>/dev/null || true
  done
fi

if [ "${1:-}" = "--uninstall" ]; then
  tv "pm uninstall $PKG"
fi
tv 'input keyevent KEYCODE_HOME' >/dev/null
sleep 3
tv 'dumpsys activity activities | grep mFocusedApp'
