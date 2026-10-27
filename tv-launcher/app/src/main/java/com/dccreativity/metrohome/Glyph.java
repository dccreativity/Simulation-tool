package com.dccreativity.metrohome;

import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;

/** Small white line icons drawn in code, on a 24x24 grid, so the APK carries no icon assets. */
final class Glyph extends Drawable {
    static final int HOME = 0, SEARCH = 1, MOVIES = 2, TV = 3, LIVE = 4, APPS = 5, HEART = 6,
            SETTINGS = 7, PLAY = 8, LIBRARY = 9, INPUT = 10;

    private final int type;
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF r = new RectF();

    Glyph(int type) {
        this.type = type;
        fill.setColor(0xFFFFFFFF);
        line.setColor(0xFFFFFFFF);
        line.setStyle(Paint.Style.STROKE);
        line.setStrokeWidth(2f);
        line.setStrokeCap(Paint.Cap.ROUND);
        line.setStrokeJoin(Paint.Join.ROUND);
    }

    @Override
    public void draw(Canvas c) {
        Rect b = getBounds();
        float s = Math.min(b.width(), b.height()) / 24f;
        int save = c.save();
        c.translate(b.exactCenterX() - 12 * s, b.exactCenterY() - 12 * s);
        c.scale(s, s);
        path.reset();
        switch (type) {
            case HOME:
                path.moveTo(2.5f, 11.5f);
                path.lineTo(12, 3);
                path.lineTo(21.5f, 11.5f);
                path.lineTo(19, 11.5f);
                path.lineTo(19, 21);
                path.lineTo(14, 21);
                path.lineTo(14, 15);
                path.lineTo(10, 15);
                path.lineTo(10, 21);
                path.lineTo(5, 21);
                path.lineTo(5, 11.5f);
                path.close();
                c.drawPath(path, fill);
                break;
            case SEARCH:
                line.setStrokeWidth(2.4f);
                c.drawCircle(10, 10, 6.5f, line);
                c.drawLine(15, 15, 21, 21, line);
                line.setStrokeWidth(2f);
                break;
            case MOVIES:
                c.drawRect(4, 3, 20, 21, line);
                c.drawLine(8, 3, 8, 21, line);
                c.drawLine(16, 3, 16, 21, line);
                for (float y = 7.5f; y < 20; y += 4.5f) {
                    c.drawLine(4, y, 8, y, line);
                    c.drawLine(16, y, 20, y, line);
                }
                break;
            case TV:
                r.set(2, 4, 22, 17);
                c.drawRoundRect(r, 1.5f, 1.5f, line);
                c.drawLine(12, 17, 12, 20.5f, line);
                c.drawLine(7.5f, 20.5f, 16.5f, 20.5f, line);
                break;
            case LIVE:
                c.drawCircle(12, 12, 2.2f, fill);
                r.set(7, 7, 17, 17);
                c.drawArc(r, 135, 90, false, line);
                c.drawArc(r, -45, 90, false, line);
                r.set(2.5f, 2.5f, 21.5f, 21.5f);
                c.drawArc(r, 135, 90, false, line);
                c.drawArc(r, -45, 90, false, line);
                break;
            case APPS:
                c.drawRect(3, 3, 11, 11, fill);
                c.drawRect(13, 3, 21, 11, fill);
                c.drawRect(3, 13, 11, 21, fill);
                c.drawRect(13, 13, 21, 21, fill);
                break;
            case HEART:
                path.moveTo(12, 20.5f);
                path.cubicTo(5, 15, 2, 11.5f, 2, 8);
                path.cubicTo(2, 5, 4.5f, 3, 7.2f, 3);
                path.cubicTo(9.2f, 3, 11, 4.2f, 12, 6);
                path.cubicTo(13, 4.2f, 14.8f, 3, 16.8f, 3);
                path.cubicTo(19.5f, 3, 22, 5, 22, 8);
                path.cubicTo(22, 11.5f, 19, 15, 12, 20.5f);
                path.close();
                c.drawPath(path, fill);
                break;
            case SETTINGS:
                for (int i = 0; i < 8; i++) {
                    c.save();
                    c.rotate(45 * i, 12, 12);
                    c.drawRect(10.2f, 1.5f, 13.8f, 6, fill);
                    c.restore();
                }
                path.setFillType(Path.FillType.EVEN_ODD);
                path.addCircle(12, 12, 7.5f, Path.Direction.CW);
                path.addCircle(12, 12, 3, Path.Direction.CW);
                c.drawPath(path, fill);
                break;
            case PLAY:
                c.drawCircle(12, 12, 10.5f, line);
                path.moveTo(9.8f, 7.5f);
                path.lineTo(17, 12);
                path.lineTo(9.8f, 16.5f);
                path.close();
                c.drawPath(path, fill);
                break;
            case LIBRARY:
                c.drawRect(3, 4, 7.5f, 20, line);
                c.drawRect(10, 4, 14.5f, 20, line);
                c.save();
                c.rotate(-15, 19, 20);
                c.drawRect(16.5f, 4.5f, 21, 20, line);
                c.restore();
                break;
            case INPUT:
                r.set(2, 4, 22, 17);
                c.drawRoundRect(r, 1.5f, 1.5f, line);
                c.drawLine(7.5f, 20.5f, 16.5f, 20.5f, line);
                c.drawLine(7, 10.5f, 15, 10.5f, line);
                c.drawLine(12, 7.5f, 15, 10.5f, line);
                c.drawLine(12, 13.5f, 15, 10.5f, line);
                break;
            default:
                break;
        }
        c.restoreToCount(save);
    }

    @Override
    public void setAlpha(int alpha) {
        fill.setAlpha(alpha);
        line.setAlpha(alpha);
        invalidateSelf();
    }

    @Override
    public void setColorFilter(ColorFilter cf) {
        fill.setColorFilter(cf);
        line.setColorFilter(cf);
        invalidateSelf();
    }

    @Override
    public int getOpacity() {
        return PixelFormat.TRANSLUCENT;
    }
}
