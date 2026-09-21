# Video TV Verticale

App Android/Android TV per digital signage locale.

## Funzioni

- avvio automatico all'accensione (receiver + modalità launcher HOME);
- pagina web locale per caricare video dal PC;
- salvataggio dei video nella memoria della TV;
- playlist alfabetica, riproduzione automatica e loop continuo;
- rotazione video di 90° antioraria per TV montata con il lato sinistro in basso;
- schermo sempre acceso e interfaccia a tutto schermo;
- nessuna connessione Internet o server esterno richiesti.

## Compilazione

Aprire questa cartella con Android Studio (JDK 17), attendere la sincronizzazione e scegliere **Build > Build APK(s)**. Il file sarà in `app/build/outputs/apk/debug/app-debug.apk`.

## Installazione e prima configurazione

1. Installare l'APK sulla TV (chiavetta USB oppure `adb install app-debug.apk`).
2. Aprire **Video TV Verticale**.
3. Quando Android chiede quale app usare come schermata Home, selezionare questa app e **Sempre**. È il metodo più affidabile per farla partire a ogni accensione; il receiver di avvio resta come seconda protezione.
4. Collegare PC e TV alla stessa rete Wi-Fi/LAN.
5. Sullo schermo appare l'indirizzo da aprire sul PC, per esempio `http://192.168.1.50:8080`.
6. Caricare video MP4 (consigliato H.264 + AAC). La riproduzione parte da sola.

I file vengono eseguiti in ordine alfabetico: per scegliere l'ordine, rinominarli `01_intro.mp4`, `02_promo.mp4`, ecc.

## Nota sull'avvio automatico

Alcuni produttori bloccano l'apertura di normali app subito dopo il boot. Impostare l'app come launcher HOME evita questa limitazione. Per tornare temporaneamente alle impostazioni Android usare il tasto Impostazioni del telecomando; per ripristinare il launcher originale, cambiare l'app Home predefinita nelle impostazioni della TV.
