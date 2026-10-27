# Metro Home: a tile launcher for the Lumio Arc 5

A small home screen for Android TV / Google TV that follows the tiled mock-up it was drawn from: a sidebar
on the left, a featured panel, coloured app tiles, a row of recently opened apps and a coloured shortcut
bar along the bottom. It is plain Java with no libraries, no internet permission, no blur, no video and
no background polling, so it suits a TV with 1 to 2 GB of RAM.

The debloat half of the job uses [cleanyourtv](https://github.com/Gathin23/cleanyourtv) as it is. Its
`tools/disable.sh` and `tools/restore.sh` keep their safety checks, and the scripts here call them
instead of replacing them.

> **Status:** the code compiles against the Android 14 (API 34) framework. It has **not** been run on a TV
> or an emulator yet. The first run on the Arc 5 (below) is the test: check each screenshot it takes.

## What is on the screen

| Area | What it does |
|---|---|
| Header | Title and subtitle (`Config.TITLE`, `Config.SUBTITLE`), clock and date. |
| Sidebar | Home, Search, Inputs, Movies, TV Shows, Live TV, Apps, My Library, Settings. |
| Featured panel | The app you opened last, shown with its banner, plus a Watch Now action that opens it. Until you have opened something, it shows `Config.FEATURED_DEFAULT_PACKAGE`. |
| App tiles | Nine apps from `Config.TILE_APPS` in order, each on its brand colour, plus Live TV and All Apps. |
| Recently opened | Every app as a 16:9 banner, with the ones you opened last first. Scrolls sideways. |
| Bottom bar | Movies, TV Shows, Live TV, My Library, Settings. |

These differ from the mock-up on purpose. The mock-up's "Continue Watching" row with progress bars and
episode art would need data that streaming apps do not share with launchers, and getting it would need
network access. The row shows recently opened apps instead. The mountain photo is replaced by a
generated wallpaper you can swap out. There is no profile picture.

Remote: the D-pad moves between tiles, OK opens, and Back and Home return to the first tile. The
**Input/Source** button opens the Inputs list while Home is on screen.

## Run it on the TV

This must run on a computer **on the same network as the TV**, for example Claude Code in the desktop app
or the terminal, not a cloud session. You need JDK 17, the Android SDK (platform 34) and Python 3.

1. **Get the tools.**
   ```sh
   git clone https://github.com/Gathin23/cleanyourtv ~/cleanyourtv
   cd ~/cleanyourtv && python3 -m venv tools/venv && tools/venv/bin/pip install -r tools/requirements.txt
   export CLEANYOURTV=~/cleanyourtv TV_HOST=<tv ip>
   ```
2. **Connect.** Turn on Developer options on the TV, then Wireless debugging (Google TV) or USB/Network
   debugging. Run `$CLEANYOURTV/tools/tv.py --probe` and accept the **"Allow debugging?"** prompt on the TV.
   On Google TV, if 5555 is closed, pair first (cleanyourtv `PROMPT.md`, "Connect").
3. **Back up and debloat.** Follow cleanyourtv's `PROMPT.md` (paste it into Claude Code on that computer).
   No list exists yet for the **Arc 5**. The closest is `examples/lumio-vision-7/` (same brand, built by
   KTC, Google TV 14), but the Arc 5 may use a different board. Treat that list as a starting point: check
   every package with `pm list packages` / `dumpsys package` on *your* TV, and untick the streaming apps,
   voice assistant, Chromecast and updater you use before running `tools/disable.sh`.
4. **Install Metro Home.**
   ```sh
   cd /path/to/Simulation-tool/tv-launcher
   tools/build-and-install.sh
   ```
   This checks the TV's Android version, builds, pushes the APK with an md5 check, installs it with
   `pm install -r`, sets it as Home, and saves `shots/01-metrohome.png`. On Google TV it will say that
   launcherx still holds Home. That is expected.
5. **Disable the stock launcher** (Google TV: `launcherx`).
   ```sh
   tools/disable-stock-launcher.sh
   ```
   It writes the list to `state/stock-launcher.txt` and runs cleanyourtv's `disable.sh`, whose guard
   refuses to remove the last app that answers Home. It then waits 15 seconds for Android to save the
   change, presses Home and saves `shots/02-after-stock-launcher-off.png`.
6. **Reboot once** and check Home again:
   `$CLEANYOURTV/tools/tv.py --reboot`, wait, then
   `$CLEANYOURTV/tools/tv.py "dumpsys activity activities | grep mFocusedApp"`.
7. **Press the real remote buttons.** Try YouTube, Netflix, Prime Video, Input and Settings. On the
   Vision 7 the app buttons went to launcherx and stopped working once it was disabled. If they do the
   same here, either live with it or use cleanyourtv's launcher, whose key helpers remap them.
8. **Close ADB.** Turn off USB debugging, Network/ADB debugging and Wireless debugging, revoke the
   authorisations, and reboot. Then `$CLEANYOURTV/tools/adb-closed.py <tv ip>` must say the port is closed.

### Google TV and setupwraith

On the Lumio Vision 7, Google TV's setup wizard (`com.google.android.tungsten.setupwraith`) took Home back
the moment launcherx was disabled. If step 5 ends with "setupwraith took Home", check which Wi-Fi network
is in use and who owns it:

```sh
$CLEANYOURTV/tools/tv.py "dumpsys wifi | grep -oE 'Currently Connected: [a-z]*|cname=[^ ]*'"
```

If the `cname=` after `Currently Connected: true` is `com.google.android.tungsten.setupwraith`, disabling it
**drops Wi-Fi and ADB**. First forget that network and join it again in Settings, so it becomes system-owned.
Then run `WITH_SETUPWRAITH=1 tools/disable-stock-launcher.sh`. cleanyourtv's guard still skips setupwraith
while it owns *any* saved network. On the Vision 7 that needed `FORCE_SETUPWRAITH=1`, which you should only
set once you have checked that the network in use is `android.uid.system`. Disabling setupwraith can break
Chromecast. Re-enabling it brings casting back, and launcherx's hold on Home with it.

## Undo

| To undo | Run |
|---|---|
| Stock launcher back as Home | `tools/restore.sh` |
| …and remove Metro Home too | `tools/restore.sh --uninstall` |
| One app you disabled in the debloat | `$CLEANYOURTV/tools/tv.py "pm enable <package>"` |
| The whole debloat | `TV_HOST=<tv ip> $CLEANYOURTV/tools/restore.sh <the list you applied> com.google.android.apps.tv.launcherx` |
| Optional ad-blocking Private DNS, if you set it | `$CLEANYOURTV/tools/tv.py "settings put global private_dns_mode opportunistic"` |

## Change the tiles, the order or the wallpaper

Everything is in [`Config.java`](app/src/main/java/com/dccreativity/metrohome/Config.java). After an edit,
run `tools/build-and-install.sh` again.

- **Which apps get tiles, and their order:** `TILE_APPS`. The first four fill the top row, the next four
  the second row, and the ninth sits next to Live TV. To list package names:
  `$CLEANYOURTV/tools/tv.py "pm list packages -3"`. Apps that are not installed are skipped, and the gaps
  are filled with your other apps.
- **Tile colours:** `TILE_COLORS`. An app not listed there takes its banner's edge colour.
- **Movies / TV Shows / My Library shortcuts:** `MOVIES_APPS`, `TV_SHOWS_APPS`, `LIBRARY_APPS`. The first
  installed app of each list opens.
- **Live TV app:** `LIVE_TV_PACKAGE` (`com.realtek.tv` on the Vision 7; confirm it on the Arc 5).
- **Wallpaper:** replace `app/src/main/res/drawable-nodpi/wallpaper.jpg` with your own picture, ideally
  1920 x 1080. It is decoded at screen size in a memory-saving format.
- **Featured picture:** add `app/src/main/res/drawable-nodpi/hero.jpg` (16:9). It then replaces the app
  banner in the featured panel.
- **Title:** `TITLE` and `SUBTITLE`.

## Files

| Path | What it is |
|---|---|
| `app/src/main/java/.../MainActivity.java` | The home screen layout and its actions. |
| `.../AllAppsActivity.java` | The All Apps grid. |
| `.../Apps.java` | Loading apps, banners and colours; recently opened order. |
| `.../Inputs.java` | The Inputs list (HDMI and AV through the TV input framework, plus Live TV). |
| `.../Ui.java`, `Glyph.java` | Layout scaling, focus frame, and the line icons. |
| `tools/build-and-install.sh` | Build, install, set as Home and take a screenshot. |
| `tools/disable-stock-launcher.sh` | Disable the stock launcher through cleanyourtv's guarded `disable.sh`. |
| `tools/restore.sh` | Put the stock launcher back; `--uninstall` also removes Metro Home. |
