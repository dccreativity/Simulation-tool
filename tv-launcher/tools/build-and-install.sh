#!/usr/bin/env bash
# Build Metro Home and install it on the TV as the default Home screen. It does NOT disable the stock
# launcher: run tools/disable-stock-launcher.sh for that once you have seen Metro Home on the TV.
#
# Usage: CLEANYOURTV=~/cleanyourtv TV_HOST=192.168.1.50 tools/build-and-install.sh
#   CLEANYOURTV  your clone of https://github.com/Gathin23/cleanyourtv, with its venv set up
#                (python3 -m venv tools/venv && tools/venv/bin/pip install -r tools/requirements.txt)
#   TV_HOST      the TV's IP address (TV_PORT if network ADB is not on 5555)
# Needs JDK 17 and the Android SDK (platform 34) for the Gradle build.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CYT="${CLEANYOURTV:?set CLEANYOURTV to your cleanyourtv clone}"
CYT="$(cd "$CYT" && pwd)"
: "${TV_HOST:?set TV_HOST to the TV IP address}"
PKG=com.dccreativity.metrohome
PY="$CYT/tools/venv/bin/python"
[ -x "$PY" ] || { echo "set up the cleanyourtv venv first: cd $CYT && python3 -m venv tools/venv && tools/venv/bin/pip install -r tools/requirements.txt" >&2; exit 1; }
tv() { "$PY" -I "$CYT/tools/tv.py" "$@"; }

# Ask the TV before spending a minute on the build: below Android 8.0 the install is refused anyway.
SDK=$(tv 'getprop ro.build.version.sdk' | tr -dc '0-9')
if [ -z "$SDK" ] || [ "$SDK" -lt 26 ]; then
  echo "ERROR: the TV reports SDK '${SDK:-?}'; Metro Home needs 26 (Android 8.0) or newer. Nothing was installed." >&2
  exit 1
fi
echo "TV runs SDK $SDK"

cd "$HERE"
./gradlew --no-daemon assembleRelease
APK=app/build/outputs/apk/release/app-release.apk

# Push as base64 chunks with an md5 check, then install from the shell: on Android 14 `adb install` can
# hang on an on-screen confirmation.
"$PY" -I "$CYT/tools/b64push.py" "$APK" /data/local/tmp/metrohome.apk
OUT=$(tv 'pm install -r /data/local/tmp/metrohome.apk' | tr -d '\r')
tv 'rm -f /data/local/tmp/metrohome.apk' >/dev/null
echo "$OUT"
case "$OUT" in
  *Success*) ;;
  *INSTALL_FAILED_VERIFICATION_FAILURE*)
    echo "ERROR: this TV refuses sideloaded apps. The launcher half cannot be done on this set; stop retrying." >&2
    exit 1 ;;
  *) echo "ERROR: pm install did not succeed." >&2; exit 1 ;;
esac

tv "cmd package set-home-activity --user 0 $PKG/.MainActivity"
# Start it by name first so you can see it whatever owns Home, then ask the TV who answers Home.
tv "am start -W -n $PKG/.MainActivity" >/dev/null
sleep 3
mkdir -p shots
tv --screenshot shots/01-metrohome.png || true
tv 'input keyevent KEYCODE_HOME' >/dev/null
sleep 3

# set-home-activity can print Success and change nothing (some Google TV builds), so check what Home opened.
FOCUS=$(tv 'dumpsys activity activities | grep mFocusedApp' | tr -d '\r')
echo "$FOCUS"
case "$FOCUS" in
  *"$PKG"*)
    echo
    echo "Metro Home is installed and the Home button opens it. Look at shots/01-metrohome.png."
    echo "Next, when you are happy with it: tools/disable-stock-launcher.sh" ;;
  *)
    echo
    echo "Metro Home is installed (shots/01-metrohome.png), but the Home button still opens the app above."
    echo "Apps that answer Home:"
    tv 'cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.HOME' || true
    echo "Expected on Google TV: launcherx keeps Home until it is disabled. If Metro Home is in that list,"
    echo "continue with tools/disable-stock-launcher.sh (README.md)."
    exit 3 ;;
esac
