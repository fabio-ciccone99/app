package it.fitandgo.verticalvideotv;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class UploadServer {
    private final int port; private final File dir; private final Runnable changed;
    private volatile boolean running; private ServerSocket socket;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    UploadServer(int port, File dir, Runnable changed) { this.port=port; this.dir=dir; this.changed=changed; }
    void start() throws IOException { socket = new ServerSocket(port); running=true; pool.execute(() -> { while(running) try { Socket s=socket.accept(); pool.execute(() -> handle(s)); } catch(IOException ignored){} }); }
    void stop() { running=false; try { socket.close(); } catch(Exception ignored){} pool.shutdownNow(); }

    static List<File> orderedVideos(File dir) {
        File[] f=dir.listFiles(x -> x.isFile() && (x.getName().toLowerCase().endsWith(".mp4") || x.getName().toLowerCase().endsWith(".mkv") || x.getName().toLowerCase().endsWith(".webm")));
        List<File> out=f==null?new ArrayList<>():new ArrayList<>(Arrays.asList(f));
        out.sort(Comparator.comparing(File::getName)); return out;
    }

    private void handle(Socket s) {
        try (Socket c=s; InputStream in=new BufferedInputStream(c.getInputStream()); OutputStream out=c.getOutputStream()) {
            String first=readLine(in); if(first==null)return; String[] p=first.split(" "); if(p.length<2)return;
            String method=p[0], path=URLDecoder.decode(p[1],"UTF-8"); Map<String,String> h=new HashMap<>(); String line;
            while((line=readLine(in))!=null&&!line.isEmpty()){ int k=line.indexOf(':'); if(k>0)h.put(line.substring(0,k).toLowerCase(),line.substring(k+1).trim()); }
            if("GET".equals(method)&&"/".equals(path)) respond(out,200,"text/html; charset=utf-8",page());
            else if("POST".equals(method)&&"/upload".equals(path)) { upload(in,h); redirect(out); changed.run(); }
            else if("POST".equals(method)&&path.startsWith("/delete/")) { new File(dir,safe(path.substring(8))).delete(); redirect(out); changed.run(); }
            else respond(out,404,"text/plain","Non trovato");
        } catch(Exception ignored) {}
    }

    private void upload(InputStream in, Map<String,String> h) throws IOException {
        int len=Integer.parseInt(h.getOrDefault("content-length","0")); if(len<=0||len>2_000_000_000)return;
        byte[] body=readExactly(in,len); String ct=h.getOrDefault("content-type",""); int bi=ct.indexOf("boundary="); if(bi<0)return;
        String boundary="--"+ct.substring(bi+9).replace("\"",""); byte[] sep=("\r\n"+boundary).getBytes(StandardCharsets.ISO_8859_1);
        int pos=0;
        while((pos=indexOf(body,boundary.getBytes(StandardCharsets.ISO_8859_1),pos))>=0){
            int hs=indexOf(body,"\r\n\r\n".getBytes(StandardCharsets.ISO_8859_1),pos); if(hs<0)break;
            String head=new String(body,pos,hs-pos,StandardCharsets.ISO_8859_1); int fn=head.indexOf("filename=\"");
            int end=indexOf(body,sep,hs+4); if(end<0)break;
            if(fn>=0){ int fe=head.indexOf('"',fn+10); String name=safe(head.substring(fn+10,fe)); if(!name.isEmpty()) try(FileOutputStream f=new FileOutputStream(new File(dir,unique(name)))){f.write(body,hs+4,end-(hs+4));} }
            pos=end+2;
        }
    }

    private String unique(String name){ File f=new File(dir,name); if(!f.exists())return name; int dot=name.lastIndexOf('.'); String a=dot>0?name.substring(0,dot):name,b=dot>0?name.substring(dot):""; int i=2; while(new File(dir,a+"_"+i+b).exists())i++; return a+"_"+i+b; }
    private String safe(String s){ return new File(s).getName().replaceAll("[^a-zA-Z0-9._ -]","_"); }
    private byte[] readExactly(InputStream in,int n)throws IOException{ByteArrayOutputStream b=new ByteArrayOutputStream(Math.min(n,8_000_000));byte[] x=new byte[65536];int left=n,r;while(left>0&&(r=in.read(x,0,Math.min(x.length,left)))>0){b.write(x,0,r);left-=r;}return b.toByteArray();}
    private int indexOf(byte[] a,byte[] b,int from){outer:for(int i=Math.max(0,from);i<=a.length-b.length;i++){for(int j=0;j<b.length;j++)if(a[i+j]!=b[j])continue outer;return i;}return -1;}
    private String readLine(InputStream in)throws IOException{ByteArrayOutputStream b=new ByteArrayOutputStream();int x,prev=-1;while((x=in.read())!=-1){if(prev=='\r'&&x=='\n'){byte[] z=b.toByteArray();return new String(z,0,Math.max(0,z.length-1),StandardCharsets.ISO_8859_1);}b.write(x);prev=x;}return b.size()==0?null:b.toString("ISO-8859-1");}
    private void redirect(OutputStream o)throws IOException{o.write("HTTP/1.1 303 See Other\r\nLocation: /\r\nConnection: close\r\n\r\n".getBytes(StandardCharsets.UTF_8));}
    private void respond(OutputStream o,int code,String type,String body)throws IOException{byte[] b=body.getBytes(StandardCharsets.UTF_8);String h="HTTP/1.1 "+code+" OK\r\nContent-Type: "+type+"\r\nContent-Length: "+b.length+"\r\nConnection: close\r\n\r\n";o.write(h.getBytes(StandardCharsets.UTF_8));o.write(b);}

    private String page(){
        StringBuilder rows=new StringBuilder(); for(File f:orderedVideos(dir))rows.append("<li><span>").append(esc(f.getName())).append(" <small>").append(f.length()/1024/1024).append(" MB</small></span><form method=post action='/delete/").append(enc(f.getName())).append("'><button class=del>Elimina</button></form></li>");
        return "<!doctype html><html lang=it><meta name=viewport content='width=device-width'><title>Video TV</title><style>body{font:16px system-ui;background:#0b1220;color:#fff;max-width:850px;margin:40px auto;padding:20px}h1{font-size:34px}.box,li{background:#172033;padding:20px;border-radius:16px;margin:12px 0}input{display:block;margin:18px 0}button{background:#22c55e;border:0;border-radius:10px;padding:12px 18px;font-weight:700}.del{background:#ef4444;color:#fff}li{display:flex;justify-content:space-between;align-items:center}small{color:#94a3b8}</style><h1>Video TV Verticale</h1><div class=box><form method=post action=/upload enctype=multipart/form-data><b>Carica video</b><input type=file name=video accept='video/mp4,video/webm,video/x-matroska' multiple required><button>Carica sulla TV</button></form></div><h2>Playlist (ordine alfabetico)</h2><ol>"+rows+"</ol><p>I video partono automaticamente e vengono riprodotti in ciclo.</p></html>";
    }
    private String esc(String s){return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;");}
    private String enc(String s){try{return URLEncoder.encode(s,"UTF-8").replace("+","%20");}catch(Exception e){return s;}}
}
