#!/usr/bin/env bash
# Put the Haier MatrixTV EE back the way it was: re-enables every package in tv-launcher/debloat/haier-matrixtv-ee/
# (Google TV's home first, then the newest batch) through
# cleanyourtv's tools/restore.sh, which also returns Home to Google TV. The Clean Your TV launcher stays installed.
#
# Usage: CLEANYOURTV=~/cleanyourtv TV_HOST=<tv ip> tools/restore-haier-matrixtv-ee.sh [--uninstall-launcher]
#   CLEANYOURTV  your clone of https://github.com/Gathin23/cleanyourtv, with its venv set up
#   TV_HOST      the TV's IP address (TV_PORT if network ADB is not on 5555)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CYT="${CLEANYOURTV:?set CLEANYOURTV to your cleanyourtv clone}"
CYT="$(cd "$CYT" && pwd)"
: "${TV_HOST:?set TV_HOST to the TV IP address}"
STOCK=com.google.android.apps.tv.launcherx
# Google TV's home first (the launcher's install script disabled it, not a list here): setupwraith must never come
# back on its own while another launcher is Home.
"$CYT/tools/venv/bin/python" -I "$CYT/tools/tv.py" "pm enable $STOCK"
for list in "$HERE"/debloat/haier-matrixtv-ee/4-setupwraith.txt \
            "$HERE"/debloat/haier-matrixtv-ee/3-apps.txt \
            "$HERE"/debloat/haier-matrixtv-ee/2-ads-tracking.txt \
            "$HERE"/debloat/haier-matrixtv-ee/1-haier-bloat.txt; do
  echo "== $(basename "$list")"
  "$CYT/tools/restore.sh" "$list" "$STOCK"
done
if [ "${1:-}" = "--uninstall-launcher" ]; then
  "$CYT/tools/venv/bin/python" -I "$CYT/tools/tv.py" "pm uninstall com.gathin.tvhome"
fi
"$CYT/tools/venv/bin/python" -I "$CYT/tools/tv.py" 'input keyevent KEYCODE_HOME'
sleep 3
"$CYT/tools/venv/bin/python" -I "$CYT/tools/tv.py" 'dumpsys activity activities | grep mFocusedApp'
