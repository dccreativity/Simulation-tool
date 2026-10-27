package com.dccreativity.metrohome;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.Typeface;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;

/**
 * Layout helpers. Every size is given in pixels of the 1672 x 941 reference design (the mock-up this
 * launcher copies) and scaled to the real screen, so the layout looks the same at 720p, 1080p and 4K.
 */
final class Ui {
    static final float REF_W = 1672f;

    final float u;
    private final Activity a;

    Ui(Activity a) {
        this.a = a;
        DisplayMetrics dm = new DisplayMetrics();
        a.getWindowManager().getDefaultDisplay().getRealMetrics(dm);
        u = Math.max(dm.widthPixels, dm.heightPixels) / REF_W;
    }

    int px(float ref) {
        return Math.round(ref * u);
    }

    /** Adds v to parent at (x, y) with size (w, h), all in reference pixels. */
    <T extends View> T place(FrameLayout parent, T v, float x, float y, float w, float h) {
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                w < 0 ? ViewGroup.LayoutParams.WRAP_CONTENT : px(w),
                h < 0 ? ViewGroup.LayoutParams.WRAP_CONTENT : px(h));
        lp.leftMargin = px(x);
        lp.topMargin = px(y);
        lp.gravity = Gravity.TOP | Gravity.START;
        parent.addView(v, lp);
        return v;
    }

    TextView text(String s, float size, int color, boolean light) {
        TextView t = style(new TextView(a), size, color, light);
        t.setText(s);
        return t;
    }

    <T extends TextView> T style(T t, float size, int color, boolean light) {
        t.setTextColor(color);
        t.setTextSize(TypedValue.COMPLEX_UNIT_PX, size * u);
        t.setTypeface(Typeface.create(light ? "sans-serif-light" : "sans-serif", Typeface.NORMAL));
        t.setIncludeFontPadding(false);
        t.setSingleLine(true);
        t.setEllipsize(TextUtils.TruncateAt.END);
        return t;
    }

    /** A 16:9 card: the app's banner (or its icon on its colour) with the name over a dark fade at the bottom. */
    FrameLayout appCard(Apps.Entry e, float w, float h) {
        FrameLayout card = new FrameLayout(a);
        card.setBackground(rounded(e.color, px(3)));
        clipRounded(card, px(3));
        if (e.banner != null) {
            place(card, image(e.banner, ImageView.ScaleType.CENTER_CROP), 0, 0, w, h);
        } else {
            float s = h * 0.46f;
            place(card, image(e.icon, ImageView.ScaleType.FIT_CENTER), (w - s) / 2, (h - s) / 2 - h * 0.08f, s, s);
        }
        View fade = new View(a);
        fade.setBackground(new GradientDrawable(GradientDrawable.Orientation.BOTTOM_TOP,
                new int[]{0xCC000000, 0x00000000}));
        place(card, fade, 0, h * 0.55f, w, h * 0.45f);
        TextView label = text(e.label, 20, Color.WHITE, false);
        label.setShadowLayer(4, 0, 1, 0x99000000);
        place(card, label, 14, h - 34, w - 28, -1);
        return card;
    }

    ImageView image(Drawable d, ImageView.ScaleType type) {
        ImageView iv = new ImageView(a);
        // One drawable has one set of bounds: a banner shown in a tile, the row and the featured panel
        // needs its own copy in each, or every view draws it at the size of the last one laid out.
        Drawable.ConstantState cs = d != null ? d.getConstantState() : null;
        iv.setImageDrawable(cs != null ? cs.newDrawable() : d);
        iv.setScaleType(type);
        return iv;
    }

    static GradientDrawable rounded(int color, float radiusPx) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(radiusPx);
        return g;
    }

    /** Clips a view (and its children) to a rounded rectangle. */
    static void clipRounded(View v, float radiusPx) {
        v.setOutlineProvider(new ViewOutlineProvider() {
            @Override
            public void getOutline(View view, Outline outline) {
                outline.setRoundRect(0, 0, view.getWidth(), view.getHeight(), radiusPx);
            }
        });
        v.setClipToOutline(true);
    }

    interface FocusListener {
        void onFocus(View v);
    }

    /**
     * Makes a tile focusable and clickable: a white frame and a slight zoom while it has focus, the same
     * on every tile, so it is always clear where the remote is.
     */
    void tile(View v, String tag, float radiusRef, boolean zoom, Runnable onClick, FocusListener listener) {
        v.setTag(tag);
        v.setFocusable(true);
        v.setFocusableInTouchMode(false);
        v.setClickable(true);
        v.setOnClickListener(x -> onClick.run());
        GradientDrawable frame = new GradientDrawable();
        frame.setColor(Color.TRANSPARENT);
        frame.setCornerRadius(px(radiusRef));
        frame.setStroke(Math.max(2, px(4)), Color.WHITE);
        StateListDrawable fg = new StateListDrawable();
        fg.addState(new int[]{android.R.attr.state_focused}, frame);
        fg.addState(new int[]{}, new ColorDrawable(Color.TRANSPARENT));
        v.setForeground(fg);
        v.setOnFocusChangeListener((view, has) -> {
            float s = has && zoom ? 1.06f : 1f;
            view.animate().scaleX(s).scaleY(s).translationZ(has ? px(12) : 0).setDuration(140).start();
            if (has && listener != null) listener.onFocus(view);
        });
    }

    /** The wallpaper: res/drawable-nodpi/wallpaper.jpg (or .png), decoded at screen size in RGB_565 to save memory. */
    Drawable wallpaper() {
        int id = a.getResources().getIdentifier("wallpaper", "drawable", a.getPackageName());
        if (id != 0) {
            DisplayMetrics dm = new DisplayMetrics();
            a.getWindowManager().getDefaultDisplay().getRealMetrics(dm);
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeResource(a.getResources(), id, o);
            int sample = 1;
            while (o.outWidth / (sample * 2) >= dm.widthPixels) sample *= 2;
            o = new BitmapFactory.Options();
            o.inSampleSize = sample;
            o.inPreferredConfig = Bitmap.Config.RGB_565;
            o.inScaled = false;
            Bitmap bmp = BitmapFactory.decodeResource(a.getResources(), id, o);
            if (bmp != null) {
                BitmapDrawable bd = new BitmapDrawable(a.getResources(), bmp);
                bd.setGravity(Gravity.FILL);
                return bd;
            }
        }
        return new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{0xFF14213F, 0xFF2B3560, 0xFF0A0F1E});
    }
}
