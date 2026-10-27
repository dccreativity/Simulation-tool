#!/usr/bin/env bash
# Disable the TV's stock launcher once Metro Home is installed, through cleanyourtv's tools/disable.sh,
# whose Home guard refuses to take the last app that can answer Home. Disabled, never uninstalled:
# tools/restore.sh puts it back.
#
# Usage: CLEANYOURTV=~/cleanyourtv TV_HOST=192.168.1.50 tools/disable-stock-launcher.sh
#   WITH_SETUPWRAITH=1  also disable Google TV's setup wizard, which takes Home back from any other
#                       launcher on the Lumio sets. Read README.md ("Google TV and setupwraith") first:
#                       it can take the TV off Wi-Fi, and it may break Chromecast.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CYT="${CLEANYOURTV:?set CLEANYOURTV to your cleanyourtv clone}"
CYT="$(cd "$CYT" && pwd)"
: "${TV_HOST:?set TV_HOST to the TV IP address}"
PKG=com.dccreativity.metrohome
WRAITH=com.google.android.tungsten.setupwraith
PY="$CYT/tools/venv/bin/python"
[ -x "$PY" ] || { echo "set up the cleanyourtv venv first (see tools/build-and-install.sh)" >&2; exit 1; }
tv() { "$PY" -I "$CYT/tools/tv.py" "$@"; }

if ! tv "pm list packages -e $PKG" | grep -q "package:$PKG"; then
  echo "ERROR: Metro Home is not installed (or is disabled). Run tools/build-and-install.sh first." >&2
  exit 1
fi

CLAIMS=$(tv 'cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.HOME' | tr -d '\r')
echo "Apps that answer Home now:"
echo "$CLAIMS" | grep / | sed 's/^ */  /'

mkdir -p "$HERE/state"
LIST="$HERE/state/stock-launcher.txt"
{
  echo "# Stock launcher(s) disabled by tv-launcher/tools/disable-stock-launcher.sh on $(date +%Y-%m-%d)."
  echo "# Undo: tv-launcher/tools/restore.sh"
} > "$LIST"
FOUND=""
for stock in com.google.android.apps.tv.launcherx com.google.android.tvlauncher com.google.android.leanbacklauncher; do
  if echo "$CLAIMS" | grep -q "^ *$stock/"; then
    echo "$stock" >> "$LIST"
    FOUND="$FOUND $stock"
  fi
done
if [ -n "${WITH_SETUPWRAITH:-}" ] && echo "$CLAIMS" | grep -q "^ *$WRAITH/"; then
  echo "Wi-Fi networks and their owners (the one after 'Currently Connected: true' is the one in use):"
  tv "dumpsys wifi | grep -oE 'Currently Connected: [a-z]*|cname=[^ ]*'" | sort -u || true
  echo "$WRAITH" >> "$LIST"
  FOUND="$FOUND $WRAITH"
fi
if [ -z "$FOUND" ]; then
  echo "No known stock launcher answers Home (see the list above). Nothing to disable; nothing changed." >&2
  echo "If the TV uses a maker launcher, add its package to $LIST by hand after checking it with" >&2
  echo "  tools/tv.py 'dumpsys package <name>'  and run $CYT/tools/disable.sh on that file." >&2
  exit 1
fi
echo "Disabling:$FOUND"
TV_HOST="$TV_HOST" "$CYT/tools/disable.sh" "$LIST"

# Android writes package state about ten seconds after a change; give it time before anything reboots.
tv sync >/dev/null || true
sleep 15
tv 'input keyevent KEYCODE_HOME' >/dev/null
sleep 3
FOCUS=$(tv 'dumpsys activity activities | grep mFocusedApp' | tr -d '\r')
echo "$FOCUS"
mkdir -p "$HERE/shots"
tv --screenshot "$HERE/shots/02-after-stock-launcher-off.png" || true
case "$FOCUS" in
  *"$PKG"*) echo "Home is Metro Home. Look at shots/02-after-stock-launcher-off.png, then reboot once and check again." ;;
  *"$WRAITH"*)
    echo "Google TV's setup wizard (setupwraith) took Home. Read README.md, 'Google TV and setupwraith', then" >&2
    echo "run again with WITH_SETUPWRAITH=1." >&2
    exit 3 ;;
  *) echo "Something else holds Home (above). Undo with tools/restore.sh if the screen is blank." >&2; exit 3 ;;
esac
