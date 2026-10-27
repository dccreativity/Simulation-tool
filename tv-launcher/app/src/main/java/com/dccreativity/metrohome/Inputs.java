package com.dccreativity.metrohome;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.media.tv.TvContract;
import android.media.tv.TvInputInfo;
import android.media.tv.TvInputManager;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

/** The Inputs list (HDMI, AV, Live TV), switching through the TV input framework like the stock launcher. */
final class Inputs {
    private Inputs() {}

    static void show(Activity a, List<Apps.Entry> apps) {
        List<CharSequence> labels = new ArrayList<>();
        List<Runnable> actions = new ArrayList<>();

        Apps.Entry live = Apps.find(apps, Config.LIVE_TV_PACKAGE);
        if (live != null) {
            labels.add("Live TV");
            actions.add(() -> Apps.open(a, live));
        }

        TvInputManager tim = (TvInputManager) a.getSystemService(Context.TV_INPUT_SERVICE);
        if (tim != null) {
            for (TvInputInfo info : tim.getTvInputList()) {
                if (!info.isPassthroughInput() || info.isHidden(a)) continue;
                CharSequence name = info.loadCustomLabel(a);
                if (name == null || name.length() == 0) name = info.loadLabel(a);
                labels.add(name);
                String id = info.getId();
                actions.add(() -> {
                    Intent i = new Intent(Intent.ACTION_VIEW, TvContract.buildChannelUriForPassthroughInput(id))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    try {
                        a.startActivity(i);
                    } catch (ActivityNotFoundException | SecurityException e) {
                        Toast.makeText(a, "The TV app did not accept this input", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        }

        if (labels.isEmpty()) {
            Toast.makeText(a, "This TV lists no inputs", Toast.LENGTH_SHORT).show();
            return;
        }
        new AlertDialog.Builder(a, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("Inputs")
                .setItems(labels.toArray(new CharSequence[0]), (d, which) -> actions.get(which).run())
                .show();
    }
}
