# Haier MatrixTV EE: what was done and how to change or undo it

**TV:** Haier MatrixTV EE (device `omonia`, MediaTek), Google TV 14, firmware `UKN4.250714.105`.
It is the same board as cleanyourtv's tested [AQUA MatrixTV EE](https://github.com/Gathin23/cleanyourtv/tree/main/examples/aqua-matrixtv-ee-50),
on older firmware.

**Home screen:** the launcher from [cleanyourtv](https://github.com/Gathin23/cleanyourtv) (`launcher/`,
package `com.gathin.tvhome`) with its Glass theme. The dock holds 6 apps: Netflix, YouTube, Prime Video,
JioHotstar, Sony LIV, ZEE5. The theme is in [`haier-matrixtv-ee-theme/config.json`](haier-matrixtv-ee-theme/config.json).

All commands below assume a computer that can reach the TV (same Wi-Fi, or Tailscale) with cleanyourtv
cloned and its venv set up:

```sh
git clone https://github.com/Gathin23/cleanyourtv ~/cleanyourtv
cd ~/cleanyourtv && python3 -m venv tools/venv && tools/venv/bin/pip install -r tools/requirements.txt
export CLEANYOURTV=~/cleanyourtv TV_HOST=<tv ip>
```

Turn on debugging on the TV first (Settings → System → Developer options). On this firmware, network
debugging on port 5555 does **not** survive a restart. Use **Wireless debugging**: pair with the code it
shows, `adb connect` to its port, then run `adb tcpip 5555` so cleanyourtv's tools can use 5555.

## What was switched off

Everything was disabled, not uninstalled. The four batches, in the order they were applied, are in
[`debloat/haier-matrixtv-ee/`](debloat/haier-matrixtv-ee/):

| Batch | Packages |
|---|---|
| 1, Haier bloat | Haier IoT and hOn services, the Haier promo app, the "TV housekeeper" cleaner, the e-manual, the Haier tab and the Zeasn content launcher |
| 2, ads and tracking | Google feedback, Anoki ACR (content recognition), partner rows, retail demo, partner auto-installs |
| 3, apps | Plex |
| 4, home handover | Google TV's setup wizard (`setupwraith`). Its Wi-Fi network was forgotten and re-joined first, so the network became system-owned |

The launcher's install script then disabled Google TV's home (`launcherx`).

**Kept by choice:**
- the voice assistant, Chromecast, Miracast and system updates
- the Google screensaver
- Play Games, TalkBack and Bluetooth speaker mode
- every streaming app except Plex

The gear-button helper (`HOME_KEY_SERVICE`) is off, so holding Volume Up still ramps smoothly. Settings
opens from the gear on screen.

**Checked on the TV after one restart:**
- all 20 disabled packages stayed disabled
- the TV powers on into the new home screen
- the Inputs menu lists HDMI 1–4, Composite and Live TV (`com.cltv.hybrid`)
- the owner reports every remote button still works

## Re-enable one app

```sh
$CLEANYOURTV/tools/venv/bin/python -I $CLEANYOURTV/tools/tv.py 'pm enable com.plexapp.android'
```

Without a computer: Settings → Apps → See all apps → pick the app → Enable.

## Change the dock apps, their order, the number of columns or the wallpaper

1. Edit [`haier-matrixtv-ee-theme/config.json`](haier-matrixtv-ee-theme/config.json):
   - `dock_apps`: the packages, left to right. To list package names:
     `$CLEANYOURTV/tools/venv/bin/python -I $CLEANYOURTV/tools/tv.py 'pm list packages -3'`.
   - `columns`: tiles per row (1–8).
   - Every other key is described in cleanyourtv's `themes/README.md`.
2. Put a `wallpaper.jpg` next to it: the Glass one is `$CLEANYOURTV/themes/glass/wallpaper.jpg`, or use your own
   picture, ideally 1920 x 1080.
3. Push it:

```sh
cp $CLEANYOURTV/themes/glass/wallpaper.jpg haier-matrixtv-ee-theme/   # or your own picture
$CLEANYOURTV/tools/theme.sh haier-matrixtv-ee-theme
```

`$CLEANYOURTV/tools/theme.sh --reset` goes back to the launcher's built-in look. To try another style, run
`theme.sh` with one of cleanyourtv's `themes/` folders.

## Build and install the launcher again

```sh
cd $CLEANYOURTV/launcher && ./build-and-install.sh
$CLEANYOURTV/tools/theme.sh /path/to/tv-launcher/haier-matrixtv-ee-theme
```

This needs JDK 17 and the Android SDK (platform 34). Don't add `HOME_KEY_SERVICE=1` unless you want the gear
button back at the cost of the smooth volume ramp.

## Undo everything

```sh
tools/restore-haier-matrixtv-ee.sh                        # Google TV's home and every disabled package back
tools/restore-haier-matrixtv-ee.sh --uninstall-launcher   # ...and remove the new launcher too
```

It switches Google TV's home on first, because the setup wizard must never come back on its own while another
launcher is Home. Then it runs cleanyourtv's `restore.sh` on each batch.

## Afterwards

Switch **USB debugging** and **Wireless debugging** off again in Developer options, and revoke the USB debugging
authorisations.
