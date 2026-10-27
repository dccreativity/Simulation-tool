package com.dccreativity.metrohome;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** The installed apps, their banners and colours, and which ones were opened most recently. */
final class Apps {
    private Apps() {}

    static final class Entry {
        final String pkg;
        final String label;
        final Drawable banner;   // 16:9 TV banner, or null
        final Drawable icon;
        final int color;
        final Intent launch;

        Entry(String pkg, String label, Drawable banner, Drawable icon, int color, Intent launch) {
            this.pkg = pkg;
            this.label = label;
            this.banner = banner;
            this.icon = icon;
            this.color = color;
            this.launch = launch;
        }
    }

    private static final String PREFS = "recent";

    /** Every launchable app except this launcher, sorted by label. Slow (loads drawables): call off the UI thread. */
    static List<Entry> load(Context ctx) {
        PackageManager pm = ctx.getPackageManager();
        Map<String, ActivityInfo> found = new HashMap<>();
        collect(pm, Intent.CATEGORY_LEANBACK_LAUNCHER, found);
        collect(pm, Intent.CATEGORY_LAUNCHER, found);
        found.remove(ctx.getPackageName());

        Map<String, Integer> colors = new HashMap<>();
        for (String[] pair : Config.TILE_COLORS) {
            try {
                colors.put(pair[0], Color.parseColor(pair[1]));
            } catch (IllegalArgumentException ignored) {
                // a typo in Config: fall back to the banner colour
            }
        }

        List<Entry> out = new ArrayList<>();
        for (Map.Entry<String, ActivityInfo> e : found.entrySet()) {
            String pkg = e.getKey();
            ActivityInfo ai = e.getValue();
            Intent launch = launchIntent(pm, pkg);
            if (launch == null) continue;
            Drawable banner = ai.loadBanner(pm);
            if (banner == null) banner = ai.applicationInfo.loadBanner(pm);
            Drawable icon = ai.loadIcon(pm);
            String label = String.valueOf(ai.loadLabel(pm));
            Integer fixed = colors.get(pkg);
            int color = fixed != null ? fixed : edgeColor(banner != null ? banner : icon);
            out.add(new Entry(pkg, label, banner, icon, color, launch));
        }
        Collections.sort(out, (a, b) -> a.label.toLowerCase(Locale.ROOT).compareTo(b.label.toLowerCase(Locale.ROOT)));
        return out;
    }

    private static void collect(PackageManager pm, String category, Map<String, ActivityInfo> into) {
        Intent q = new Intent(Intent.ACTION_MAIN).addCategory(category);
        for (ResolveInfo ri : pm.queryIntentActivities(q, 0)) {
            ActivityInfo ai = ri.activityInfo;
            if (ai != null && !into.containsKey(ai.packageName)) into.put(ai.packageName, ai);
        }
    }

    static Intent launchIntent(PackageManager pm, String pkg) {
        Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
        if (i == null) i = pm.getLaunchIntentForPackage(pkg);
        if (i != null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        return i;
    }

    /** The colour at the banner's edge: banners are drawn on their brand colour, so a tile behind one blends in. */
    static int edgeColor(Drawable d) {
        if (d == null) return 0xFF2A3550;
        try {
            Bitmap bmp = Bitmap.createBitmap(32, 18, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bmp);
            d.setBounds(0, 0, 32, 18);
            d.draw(c);
            int[] px = {bmp.getPixel(1, 1), bmp.getPixel(30, 1), bmp.getPixel(1, 16), bmp.getPixel(30, 16)};
            bmp.recycle();
            int r = 0, g = 0, b = 0, n = 0;
            for (int p : px) {
                if (Color.alpha(p) < 128) continue;
                r += Color.red(p);
                g += Color.green(p);
                b += Color.blue(p);
                n++;
            }
            if (n == 0) return 0xFF2A3550;
            return Color.rgb(r / n, g / n, b / n);
        } catch (RuntimeException e) {
            return 0xFF2A3550;
        }
    }

    static boolean hidden(String pkg) {
        for (String h : Config.HIDDEN_APPS) if (h.equals(pkg)) return true;
        return false;
    }

    /** Apps opened from this launcher, newest first. */
    static List<Entry> byRecent(Context ctx, List<Entry> apps) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        List<Entry> recent = new ArrayList<>();
        for (Entry e : apps) if (p.getLong(e.pkg, 0) > 0 && !hidden(e.pkg)) recent.add(e);
        Collections.sort(recent, (a, b) -> Long.compare(p.getLong(b.pkg, 0), p.getLong(a.pkg, 0)));
        return recent;
    }

    /** Recently opened apps first, then the rest alphabetically. */
    static List<Entry> recentThenAll(Context ctx, List<Entry> apps) {
        List<Entry> out = byRecent(ctx, apps);
        Set<String> seen = new HashSet<>();
        for (Entry e : out) seen.add(e.pkg);
        for (Entry e : apps) if (!seen.contains(e.pkg) && !hidden(e.pkg)) out.add(e);
        return out;
    }

    static Entry find(List<Entry> apps, String pkg) {
        for (Entry e : apps) if (e.pkg.equals(pkg)) return e;
        return null;
    }

    static boolean open(Context ctx, Entry e) {
        try {
            ctx.startActivity(e.launch);
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong(e.pkg, System.currentTimeMillis()).apply();
            return true;
        } catch (ActivityNotFoundException | SecurityException ex) {
            Toast.makeText(ctx, e.label + " could not be opened", Toast.LENGTH_SHORT).show();
            return false;
        }
    }

    /** Opens the first installed app of the list. */
    static boolean openFirst(Context ctx, List<Entry> apps, String[] pkgs) {
        for (String pkg : pkgs) {
            Entry e = find(apps, pkg);
            if (e != null) return open(ctx, e);
        }
        return false;
    }
}
