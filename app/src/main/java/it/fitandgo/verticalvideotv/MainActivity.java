package it.fitandgo.verticalvideotv;

import android.app.Activity;
import android.graphics.Color;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.VideoView;

import java.io.File;
import java.net.Inet4Address;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

public class MainActivity extends Activity {
    private VideoView player;
    private TextView status;
    private File videoDir;
    private List<File> playlist = new ArrayList<>();
    private int index = 0;
    private UploadServer server;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(5894 | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        videoDir = new File(getFilesDir(), "videos");
        if (!videoDir.exists()) videoDir.mkdirs();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        player = new VideoView(this);
        player.setRotation(-90f);
        root.addView(player, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));
        status = new TextView(this);
        status.setTextColor(Color.WHITE); status.setTextSize(24); status.setGravity(Gravity.CENTER);
        status.setBackgroundColor(Color.rgb(17,24,39)); status.setPadding(40,40,40,40);
        root.addView(status, new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);

        player.setOnPreparedListener(mp -> { mp.setLooping(false); fitRotatedVideo(mp); status.setVisibility(View.GONE); player.start(); });
        player.setOnCompletionListener(mp -> { index++; playCurrent(); });
        player.setOnErrorListener((mp, what, extra) -> { index++; player.postDelayed(this::playCurrent, 800); return true; });

        try { server = new UploadServer(8080, videoDir, this::reloadPlaylist); server.start(); }
        catch (Exception e) { status.setText("Server non avviato: " + e.getMessage()); }
        reloadPlaylist();
    }

    private void reloadPlaylist() {
        runOnUiThread(() -> {
            File current = playlist.isEmpty() ? null : playlist.get(Math.min(index, playlist.size()-1));
            playlist = UploadServer.orderedVideos(videoDir);
            if (playlist.isEmpty()) {
                player.stopPlayback(); status.setVisibility(View.VISIBLE);
                status.setText("VIDEO TV VERTICALE\n\nDal PC collegato allo stesso Wi-Fi apri:\nhttp://" + localIp() + ":8080\n\nCarica uno o più video MP4");
            } else {
                index = current == null ? 0 : Math.max(0, playlist.indexOf(current));
                playCurrent();
            }
        });
    }

    private void playCurrent() {
        if (playlist.isEmpty()) { reloadPlaylist(); return; }
        if (index >= playlist.size()) index = 0;
        player.setVideoURI(Uri.fromFile(playlist.get(index)));
        player.start();
    }

    private void fitRotatedVideo(MediaPlayer mp) {
        int vw = mp.getVideoWidth(), vh = mp.getVideoHeight();
        int sw = getResources().getDisplayMetrics().widthPixels, sh = getResources().getDisplayMetrics().heightPixels;
        if (vw <= 0 || vh <= 0) return;
        float scale = Math.min((float) sw / vh, (float) sh / vw);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(Math.round(vw * scale), Math.round(vh * scale), Gravity.CENTER);
        player.setLayoutParams(lp);
    }

    private String localIp() {
        try {
            Enumeration<NetworkInterface> nets = NetworkInterface.getNetworkInterfaces();
            for (NetworkInterface n : Collections.list(nets)) for (java.net.InetAddress a : Collections.list(n.getInetAddresses()))
                if (!a.isLoopbackAddress() && a instanceof Inet4Address) return a.getHostAddress();
        } catch (Exception ignored) {}
        return "IP-DELLA-TV";
    }

    @Override public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getAction() == KeyEvent.ACTION_DOWN && e.getKeyCode() == KeyEvent.KEYCODE_MENU) { reloadPlaylist(); return true; }
        return super.dispatchKeyEvent(e);
    }

    @Override protected void onDestroy() { if (server != null) server.stop(); super.onDestroy(); }
}
