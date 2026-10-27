package com.dccreativity.metrohome;

/**
 * Everything you are likely to want to change lives here. Rebuild and reinstall with
 * tools/build-and-install.sh after an edit. Package names that are not installed on the TV are skipped.
 */
final class Config {
    private Config() {}

    /** Header, top left. */
    static final String TITLE = "Home";
    static final String SUBTITLE = "Lumio Arc 5";

    /**
     * The coloured app tiles right of the featured panel, in order: four on the first row, four on the
     * second, one on the third (next to Live TV and All Apps). Missing apps are skipped and the free
     * slots are filled with your other apps, alphabetically.
     */
    static final String[] TILE_APPS = {
            "com.google.android.youtube.tv",          // YouTube
            "com.netflix.ninja",                      // Netflix
            "com.amazon.amazonvideo.livingroom",      // Prime Video
            "in.startv.hotstar",                      // JioHotstar
            "com.sonyliv",                            // Sony LIV
            "com.graymatrix.did",                     // ZEE5
            "com.crunchyroll.crunchyroid",            // Crunchyroll
            "com.spotify.tv.android",                 // Spotify
            "com.apple.atve.androidtv.appletv",       // Apple TV
    };

    /**
     * Tile colours. A package not listed here takes the colour of its own banner's edge, which is
     * usually the brand colour. Format: package, #RRGGBB.
     */
    static final String[][] TILE_COLORS = {
            {"com.google.android.youtube.tv", "#E01E1E"},
            {"com.netflix.ninja", "#000000"},
            {"com.amazon.amazonvideo.livingroom", "#1AA3E0"},
            {"in.startv.hotstar", "#0F1D36"},
            {"com.sonyliv", "#4C1FAE"},
            {"com.graymatrix.did", "#2A1A3E"},
            {"com.crunchyroll.crunchyroid", "#F47521"},
            {"com.spotify.tv.android", "#1DB954"},
            {"com.apple.atve.androidtv.appletv", "#151515"},
    };

    /**
     * The tuner / Live TV app: MediaTek's TV center on the Lumio Arc 5 (SDMC, MediaTek). If it is not
     * installed, Live TV opens the Inputs list instead.
     */
    static final String LIVE_TV_PACKAGE = "com.mediatek.wwtv.tvcenter";

    /** Sidebar and bottom-bar shortcuts: the first installed app of each list opens. */
    static final String[] MOVIES_APPS = {"com.amazon.amazonvideo.livingroom", "com.netflix.ninja", "in.startv.hotstar"};
    static final String[] TV_SHOWS_APPS = {"in.startv.hotstar", "com.sonyliv", "com.netflix.ninja"};
    static final String[] LIBRARY_APPS = {"com.android.vending"};

    /** Never shown as a tile (the Live TV entry and the Inputs list already cover the tuner app). */
    static final String[] HIDDEN_APPS = {LIVE_TV_PACKAGE};

    /** Text under the title in the featured panel. */
    static final String FEATURED_SUBTITLE = "Pick up where you left off.";
    /** Shown in the featured panel until you have opened an app from this launcher. */
    static final String FEATURED_DEFAULT_PACKAGE = "com.netflix.ninja";
}
