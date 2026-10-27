package com.dccreativity.metrohome;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextClock;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * The home screen: sidebar on the left, a featured panel, coloured app tiles, a row of recently opened
 * apps and a bar of shortcuts at the bottom. Positions are in the 1672 x 941 reference design (see Ui).
 */
public class MainActivity extends Activity {
    private static final int GRAY = 0xFFC8D0E0;

    private Ui ui;
    private FrameLayout root;
    private HorizontalScrollView row;
    private List<Apps.Entry> apps = Collections.emptyList();
    private boolean appsDirty = true;   // installed apps changed: reload them
    private boolean viewDirty;          // only the recent order changed: rebuild the views
    private boolean resumed;
    private String lastFocus;

    private final BroadcastReceiver packages = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            appsDirty = true;
            if (resumed) reload();
        }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        ui = new Ui(this);
        root = new FrameLayout(this);
        root.setBackground(ui.wallpaper());
        root.setClipChildren(false);
        setContentView(root);

        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_PACKAGE_ADDED);
        f.addAction(Intent.ACTION_PACKAGE_REMOVED);
        f.addAction(Intent.ACTION_PACKAGE_CHANGED);
        f.addAction(Intent.ACTION_PACKAGE_REPLACED);
        f.addDataScheme("package");
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(packages, f, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(packages, f);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        if (appsDirty) {
            reload();
        } else if (viewDirty) {
            build();
        }
    }

    @Override
    protected void onPause() {
        resumed = false;
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        unregisterReceiver(packages);
        super.onDestroy();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Home pressed while already on Home: back to the first tile. Coming back from an app keeps the
        // last focused tile (onNewIntent then arrives before onResume, while resumed is still false).
        if (!resumed) return;
        lastFocus = null;
        if (row != null) row.scrollTo(0, 0);
        focus("tile:0");
    }

    @Override
    public void onBackPressed() {
        // Home has nowhere to go back to; Back returns to the first tile instead of closing the launcher.
        focus("tile:0");
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_TV_INPUT) {
            Inputs.show(this, apps);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private void reload() {
        appsDirty = false;
        Context app = getApplicationContext();
        new Thread(() -> {
            List<Apps.Entry> loaded = Apps.load(app);
            runOnUiThread(() -> {
                if (isDestroyed()) return;
                apps = loaded;
                build();
            });
        }, "load-apps").start();
    }

    private void build() {
        viewDirty = false;
        String want = lastFocus;
        root.removeAllViews();
        header();
        sidebar();
        hero();
        tiles();
        recentRow();
        bottomBar();
        root.post(() -> {
            if (want == null || !focus(want)) focus("tile:0");
        });
    }

    private boolean focus(String tag) {
        View v = root.findViewWithTag(tag);
        return v != null && v.requestFocus();
    }

    private final Ui.FocusListener remember = v -> lastFocus = (String) v.getTag();

    // ---- header -------------------------------------------------------------------------------------

    private void header() {
        ui.place(root, ui.image(new Glyph(Glyph.APPS), ImageView.ScaleType.FIT_CENTER), 50, 46, 56, 56);
        ui.place(root, ui.text(Config.TITLE, 56, Color.WHITE, true), 136, 40, -1, -1);
        ui.place(root, ui.text(Config.SUBTITLE, 20, GRAY, false), 140, 102, -1, -1);

        LinearLayout clock = new LinearLayout(this);
        clock.setOrientation(LinearLayout.VERTICAL);
        clock.setGravity(Gravity.END);
        TextClock time = ui.style(new TextClock(this), 42, Color.WHITE, true);
        time.setFormat12Hour("h:mm a");
        time.setFormat24Hour("HH:mm");
        TextClock date = ui.style(new TextClock(this), 19, GRAY, false);
        date.setFormat12Hour("EEE, d MMM");
        date.setFormat24Hour("EEE, d MMM");
        clock.addView(time);
        clock.addView(date);
        ((LinearLayout.LayoutParams) date.getLayoutParams()).topMargin = ui.px(10);
        ui.place(root, clock, 1132, 38, 500, -1);
    }

    // ---- sidebar ------------------------------------------------------------------------------------

    private void sidebar() {
        View bg = new View(this);
        bg.setBackgroundColor(0xB30A1020);
        ui.place(root, bg, 0, 148, 200, 793);

        String[] names = {"Home", "Search", "Inputs", "Movies", "TV Shows", "Live TV", "Apps", "My Library", "Settings"};
        int[] glyphs = {Glyph.HOME, Glyph.SEARCH, Glyph.INPUT, Glyph.MOVIES, Glyph.TV, Glyph.LIVE, Glyph.APPS,
                Glyph.HEART, Glyph.SETTINGS};
        Runnable[] actions = {
                () -> focus("tile:0"),
                this::search,
                () -> Inputs.show(this, apps),
                () -> openOrAll(Config.MOVIES_APPS, "Movies"),
                () -> openOrAll(Config.TV_SHOWS_APPS, "TV Shows"),
                this::liveTv,
                this::allApps,
                () -> openOrAll(Config.LIBRARY_APPS, "My Library"),
                this::settings,
        };
        for (int i = 0; i < names.length; i++) {
            float y = 148 + i * 80;
            LinearLayout item = new LinearLayout(this);
            item.setOrientation(LinearLayout.HORIZONTAL);
            item.setGravity(Gravity.CENTER_VERTICAL);
            item.setPadding(ui.px(30), 0, 0, 0);
            StateListDrawable bgState = new StateListDrawable();
            bgState.addState(new int[]{android.R.attr.state_focused}, new ColorDrawable(0x40FFFFFF));
            bgState.addState(new int[]{}, new ColorDrawable(i == 0 ? 0x1FFFFFFF : Color.TRANSPARENT));
            item.setBackground(bgState);
            item.addView(ui.image(new Glyph(glyphs[i]), ImageView.ScaleType.FIT_CENTER),
                    new LinearLayout.LayoutParams(ui.px(34), ui.px(34)));
            TextView label = ui.text(names[i], 19, Color.WHITE, false);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.leftMargin = ui.px(22);
            item.addView(label, lp);

            Runnable action = actions[i];
            item.setTag("side:" + i);
            item.setFocusable(true);
            item.setClickable(true);
            item.setOnClickListener(v -> action.run());
            item.setOnFocusChangeListener((v, has) -> {
                if (has) remember.onFocus(v);
            });
            ui.place(root, item, 0, y, 200, 80);
            if (i == 0) {
                View bar = new View(this);
                bar.setBackgroundColor(0xFF8B5CF6);
                ui.place(root, bar, 0, y, 14, 80);
            }
        }
    }

    // ---- featured panel -----------------------------------------------------------------------------

    private void hero() {
        List<Apps.Entry> recent = Apps.byRecent(this, apps);
        Apps.Entry feat = !recent.isEmpty() ? recent.get(0) : Apps.find(apps, Config.FEATURED_DEFAULT_PACKAGE);
        if (feat == null) {
            for (Apps.Entry e : apps) {
                if (!Apps.hidden(e.pkg)) {
                    feat = e;
                    break;
                }
            }
        }
        float w = 723, h = 427;
        FrameLayout hero = new FrameLayout(this);
        Ui.clipRounded(hero, ui.px(4));

        int heroId = getResources().getIdentifier("hero", "drawable", getPackageName());
        if (heroId != 0) {
            // Your own picture: drop hero.jpg into app/src/main/res/drawable-nodpi/.
            ui.place(hero, ui.image(getDrawable(heroId), ImageView.ScaleType.CENTER_CROP), 0, 0, w, h);
        } else {
            int c = feat != null ? feat.color : 0xFF2A3550;
            hero.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                    new int[]{darken(c, 0.55f), darken(c, 0.9f)}));
            if (feat != null) {
                Drawable art = feat.banner != null ? feat.banner : feat.icon;
                ui.place(hero, ui.image(art, ImageView.ScaleType.FIT_CENTER), 300, 40, 400, 225);
            }
        }
        View shade = new View(this);
        shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{0xE6000000, 0x80000000, 0x00000000}));
        ui.place(hero, shade, 0, 0, w, h);

        boolean isRecent = !recent.isEmpty();
        ui.place(hero, ui.text(isRecent ? "Continue" : "Featured", 19, Color.WHITE, false), 25, 188, -1, -1);
        ui.place(hero, ui.text(feat != null ? feat.label : "No apps yet", 64, Color.WHITE, true), 25, 214, 670, -1);
        TextView sub = ui.text(Config.FEATURED_SUBTITLE, 19, 0xFFE0E6F0, false);
        sub.setSingleLine(false);
        sub.setMaxLines(2);
        sub.setLineSpacing(ui.px(6), 1f);
        ui.place(hero, sub, 28, 294, 420, -1);
        ui.place(hero, ui.image(new Glyph(Glyph.PLAY), ImageView.ScaleType.FIT_CENTER), 28, 358, 54, 54);
        ui.place(hero, ui.text("Watch Now", 22, Color.WHITE, false), 100, 373, -1, -1);

        Apps.Entry target = feat;
        ui.tile(hero, "hero", 4, false, () -> {
            if (target != null) launch(target);
        }, remember);
        ui.place(root, hero, 238, 154, w, h);
    }

    private static int darken(int c, float f) {
        return Color.rgb((int) (Color.red(c) * f), (int) (Color.green(c) * f), (int) (Color.blue(c) * f));
    }

    // ---- app tiles ----------------------------------------------------------------------------------

    private void tiles() {
        List<Apps.Entry> picked = new ArrayList<>();
        for (String pkg : Config.TILE_APPS) {
            Apps.Entry e = Apps.find(apps, pkg);
            if (e != null && !Apps.hidden(pkg) && !picked.contains(e)) picked.add(e);
        }
        for (Apps.Entry e : apps) {
            if (picked.size() >= 9) break;
            if (!Apps.hidden(e.pkg) && !picked.contains(e)) picked.add(e);
        }

        float colW = (1640 - 973 - 3 * 8) / 4f;
        float[] rowY = {154, 311, 463};
        float[] rowH = {149, 142, 118};
        for (int i = 0; i < 9; i++) {
            float x, y, w, h;
            if (i < 8) {
                x = 973 + (i % 4) * (colW + 8);
                y = rowY[i / 4];
                w = colW;
                h = rowH[i / 4];
            } else {
                x = 973;
                y = rowY[2];
                w = 163;
                h = rowH[2];
            }
            if (i < picked.size()) {
                appTile(picked.get(i), "tile:" + i, x, y, w, h);
            } else {
                View empty = new View(this);
                empty.setBackground(Ui.rounded(0x33000000, ui.px(3)));
                ui.place(root, empty, x, y, w, h);
            }
        }
        actionTile("Live TV", Glyph.TV, 0xFF1E7BE0, "tile:live", 1146, 463, 205, 118, this::liveTv);
        actionTile("All Apps", Glyph.APPS, 0xFF2563EB, "tile:all", 1360, 463, 280, 118, this::allApps);
    }

    private void appTile(Apps.Entry e, String tag, float x, float y, float w, float h) {
        FrameLayout t = new FrameLayout(this);
        t.setBackground(Ui.rounded(e.color, ui.px(3)));
        Ui.clipRounded(t, ui.px(3));
        float art = h - 38;
        if (e.banner != null) {
            ui.place(t, ui.image(e.banner, ImageView.ScaleType.FIT_CENTER), 6, 4, w - 12, art);
        } else {
            float s = Math.min(64, art - 12);
            ui.place(t, ui.image(e.icon, ImageView.ScaleType.FIT_CENTER), (w - s) / 2, (art - s) / 2 + 4, s, s);
        }
        TextView label = ui.text(e.label, 18, Color.WHITE, false);
        label.setShadowLayer(4, 0, 1, 0x99000000);
        ui.place(t, label, 16, h - 32, w - 24, -1);
        ui.tile(t, tag, 3, true, () -> launch(e), remember);
        ui.place(root, t, x, y, w, h);
    }

    private void actionTile(String name, int glyph, int color, String tag, float x, float y, float w, float h,
                            Runnable action) {
        FrameLayout t = new FrameLayout(this);
        t.setBackground(Ui.rounded(color, ui.px(3)));
        float s = 48;
        ui.place(t, ui.image(new Glyph(glyph), ImageView.ScaleType.FIT_CENTER), (w - s) / 2, 16, s, s);
        ui.place(t, ui.text(name, 18, Color.WHITE, false), 16, h - 32, w - 24, -1);
        ui.tile(t, tag, 3, true, action, remember);
        ui.place(root, t, x, y, w, h);
    }

    // ---- recently opened ----------------------------------------------------------------------------

    private void recentRow() {
        boolean any = !Apps.byRecent(this, apps).isEmpty();
        ui.place(root, ui.text(any ? "Recently opened" : "Your apps", 27, Color.WHITE, false), 241, 594, -1, -1);

        row = new HorizontalScrollView(this);
        row.setHorizontalScrollBarEnabled(false);
        row.setClipChildren(false);
        row.setSmoothScrollingEnabled(true);
        LinearLayout strip = new LinearLayout(this);
        strip.setOrientation(LinearLayout.HORIZONTAL);
        strip.setClipChildren(false);
        strip.setPadding(ui.px(12), ui.px(10), ui.px(12), ui.px(10));
        for (Apps.Entry e : Apps.recentThenAll(this, apps)) {
            FrameLayout card = ui.appCard(e, 276, 155);
            ui.tile(card, "row:" + e.pkg, 3, true, () -> launch(e), remember);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ui.px(276), ui.px(155));
            lp.rightMargin = ui.px(14);
            strip.addView(card, lp);
        }
        row.addView(strip);
        ui.place(root, row, 226, 624, 1426, 176);
    }

    // ---- bottom bar ---------------------------------------------------------------------------------

    private void bottomBar() {
        String[] names = {"Movies", "TV Shows", "Live TV", "My Library", "Settings"};
        int[] glyphs = {Glyph.MOVIES, Glyph.TV, Glyph.LIVE, Glyph.LIBRARY, Glyph.SETTINGS};
        int[] colors = {0xFF1F6FE5, 0xFF7B2FD6, 0xFF2FA318, 0xFFE07012, 0xFFD93636};
        Runnable[] actions = {
                () -> openOrAll(Config.MOVIES_APPS, "Movies"),
                () -> openOrAll(Config.TV_SHOWS_APPS, "TV Shows"),
                this::liveTv,
                () -> openOrAll(Config.LIBRARY_APPS, "My Library"),
                this::settings,
        };
        float w = (1640 - 238 - 4 * 8) / 5f, h = 106;
        for (int i = 0; i < names.length; i++) {
            FrameLayout b = new FrameLayout(this);
            b.setBackground(Ui.rounded(colors[i], ui.px(2)));
            ui.place(b, ui.image(new Glyph(glyphs[i]), ImageView.ScaleType.FIT_CENTER), 22, 25, 56, 56);
            ui.place(b, ui.text(names[i], 23, Color.WHITE, false), 92, 40, w - 100, -1);
            ui.tile(b, "bar:" + i, 2, true, actions[i], remember);
            ui.place(root, b, 238 + i * (w + 8), 810, w, h);
        }
    }

    // ---- actions ------------------------------------------------------------------------------------

    private void launch(Apps.Entry e) {
        if (Apps.open(this, e)) viewDirty = true;
    }

    private void openOrAll(String[] pkgs, String what) {
        if (Apps.openFirst(this, apps, pkgs)) {
            viewDirty = true;
        } else {
            Toast.makeText(this, "No app for " + what + " is installed", Toast.LENGTH_SHORT).show();
            allApps();
        }
    }

    private void liveTv() {
        Apps.Entry live = Apps.find(apps, Config.LIVE_TV_PACKAGE);
        if (live != null) {
            Apps.open(this, live);
        } else {
            Inputs.show(this, apps);
        }
    }

    private void allApps() {
        viewDirty = true;
        startActivity(new Intent(this, AllAppsActivity.class));
    }

    private void settings() {
        start(new Intent(Settings.ACTION_SETTINGS), "Settings");
    }

    private void search() {
        String[] actions = {"android.search.action.GLOBAL_SEARCH", Intent.ACTION_ASSIST, Intent.ACTION_WEB_SEARCH};
        for (String action : actions) {
            try {
                startActivity(new Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                return;
            } catch (ActivityNotFoundException | SecurityException ignored) {
                // try the next one
            }
        }
        Toast.makeText(this, "No search app is enabled", Toast.LENGTH_SHORT).show();
    }

    private void start(Intent i, String what) {
        try {
            startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException | SecurityException e) {
            Toast.makeText(this, what + " could not be opened", Toast.LENGTH_SHORT).show();
        }
    }
}
