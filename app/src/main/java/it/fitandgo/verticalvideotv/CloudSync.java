package it.fitandgo.verticalvideotv;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

class CloudSync {
    private static final String API = "https://video-tv-cloud.fabcic-7616.chatgpt.site/api/videos";
    private final File dir;
    private final Runnable changed;
    private final Consumer<String> status;
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();

    CloudSync(File dir, Runnable changed, Consumer<String> status) {
        this.dir = dir; this.changed = changed; this.status = status;
    }

    void start() { executor.scheduleWithFixedDelay(this::syncSafe, 0, 60, TimeUnit.SECONDS); }
    void stop() { executor.shutdownNow(); }

    private void syncSafe() {
        try { sync(); }
        catch (Exception e) { status.accept("Connessione assente.\nI video già scaricati continuano a funzionare.\n\nNuovo tentativo automatico tra un minuto."); }
    }

    private void sync() throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(API).openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(20000); c.setRequestProperty("Cache-Control", "no-cache");
        if (c.getResponseCode() != 200) throw new IOException("Playlist non disponibile");
        String json = readText(c.getInputStream());
        JSONArray list = new JSONArray(json);
        Set<String> wanted = new HashSet<>();
        boolean updated = false;
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.getJSONObject(i);
            String key = item.getString("key");
            String name = String.format(Locale.US, "%04d_%s", i, safe(item.optString("name", "video.mp4")));
            wanted.add(name);
            File target = new File(dir, name);
            if (!target.exists() || target.length() != item.optLong("size", -1)) {
                status.accept("Scaricamento video " + (i + 1) + " di " + list.length() + "…");
                download(item.getString("url"), target);
                updated = true;
            }
        }
        File[] local = dir.listFiles();
        if (local != null) for (File f : local) if (f.isFile() && !wanted.contains(f.getName())) { if (f.delete()) updated = true; }
        if (updated || list.length() > 0) changed.run();
        if (list.length() == 0) status.accept("Nessun video caricato.\n\nApri dal PC:\nhttps://video-tv-cloud.fabcic-7616.chatgpt.site");
    }

    private void download(String address, File target) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(address).openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(120000);
        if (c.getResponseCode() != 200) throw new IOException("Download non riuscito");
        File temp = new File(target.getParentFile(), target.getName() + ".download");
        try (InputStream in = new BufferedInputStream(c.getInputStream()); OutputStream out = new BufferedOutputStream(new FileOutputStream(temp))) {
            byte[] buffer = new byte[65536]; int n; while ((n = in.read(buffer)) >= 0) out.write(buffer, 0, n);
        }
        if (target.exists()) target.delete();
        if (!temp.renameTo(target)) throw new IOException("Salvataggio non riuscito");
    }

    private String readText(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] b = new byte[8192]; int n;
        while ((n = in.read(b)) >= 0) out.write(b, 0, n);
        return out.toString("UTF-8");
    }
    private String safe(String value) { return new File(value).getName().replaceAll("[^a-zA-Z0-9._ -]", "_"); }
}
