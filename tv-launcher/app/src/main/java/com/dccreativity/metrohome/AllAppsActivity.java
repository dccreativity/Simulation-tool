package com.dccreativity.metrohome;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ScrollView;

import java.util.ArrayList;
import java.util.List;

/** Every installed app as a grid of banners, alphabetically. Back returns to Home. */
public class AllAppsActivity extends Activity {
    private static final int COLS = 5;
    private static final float CARD_W = 276, CARD_H = 155, GAP_X = 40, GAP_Y = 30, LEFT = 66, TOP = 130;

    private Ui ui;
    private FrameLayout root;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        ui = new Ui(this);
        root = new FrameLayout(this);
        root.setBackground(ui.wallpaper());
        setContentView(root);
        View dim = new View(this);
        dim.setBackgroundColor(0x99000000);
        root.addView(dim, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        Context app = getApplicationContext();
        new Thread(() -> {
            List<Apps.Entry> loaded = Apps.load(app);
            runOnUiThread(() -> {
                if (!isDestroyed()) build(loaded);
            });
        }, "load-apps").start();
    }

    private void build(List<Apps.Entry> all) {
        List<Apps.Entry> apps = new ArrayList<>();
        for (Apps.Entry e : all) if (!Apps.hidden(e.pkg)) apps.add(e);

        ScrollView scroll = new ScrollView(this);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.setClipChildren(false);
        FrameLayout grid = new FrameLayout(this);
        grid.setClipChildren(false);
        ui.place(grid, ui.text("All Apps", 44, Color.WHITE, true), LEFT, 48, -1, -1);
        int rows = (apps.size() + COLS - 1) / COLS;
        for (int i = 0; i < apps.size(); i++) {
            Apps.Entry e = apps.get(i);
            FrameLayout card = ui.appCard(e, CARD_W, CARD_H);
            ui.tile(card, "all:" + e.pkg, 3, true, () -> {
                if (Apps.open(this, e)) finish();
            }, null);
            ui.place(grid, card, LEFT + (i % COLS) * (CARD_W + GAP_X), TOP + (i / COLS) * (CARD_H + GAP_Y),
                    CARD_W, CARD_H);
        }
        // Room below the last row so its zoomed, focused card is not clipped.
        View end = new View(this);
        ui.place(grid, end, 0, TOP + rows * (CARD_H + GAP_Y), 1, 40);
        scroll.addView(grid);
        root.addView(scroll, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        if (!apps.isEmpty()) grid.post(() -> grid.getChildAt(1).requestFocus());
    }
}
