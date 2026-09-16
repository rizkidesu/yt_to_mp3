# 🎵 YouTube to MP3 Studio (Web, Docker & Browser Extension)

Aplikasi web modern berbasis Docker untuk mengunduh audio YouTube dan mengonversinya langsung ke format MP3 berkualitas tinggi. Dilengkapi dengan antarmuka gelap (*dark mode*) yang elegan, pemutar musik web terintegrasi, **6-Band Graphic Equalizer vertikal**, sistem proteksi playlist, serta **Ekstensi Browser & Userscript YouTube** untuk kemudahan unduh 1-klik langsung dari YouTube.

---

## ✨ Fitur Unggulan

### 1. 📥 Pengunduhan Audio Fleksibel (Single & Batch)
- **Mode Satu Lagu (Single URL)**:
  - Tempelkan URL YouTube, sistem otomatis menampilkan pratinjau (*preview*) judul, channel, durasi, dan thumbnail video.
  - Pilihan kualitas bitrate MP3: **320 kbps (Ultra HQ)**, **256 kbps (HQ)**, **192 kbps (Standar)**, **128 kbps (Hemat Kuota)**.
- **Mode Banyak Lagu (Batch Download)**:
  - Input puluhan hingga ratusan URL YouTube sekaligus (satu baris per URL).
  - **Upload File `.txt`**: Unggah langsung file teks dari perangkat Anda.
  - **Impor dari `urls.txt`**: Muat daftar URL yang tersimpan di server secara instan.
  - Indikator penghitung otomatis jumlah URL valid.

### 2. 🛡️ Mode Aman: Opsi "Jangan Unduh 1 Playlist Langsung"
Seringkali link video YouTube yang disalin dari halaman rekomendasi atau mix mengandung parameter playlist (`&list=PL...` atau `&list=RD...`). Aplikasi ini dilengkapi perlindungan cerdas agar tidak sengaja mengunduh puluhan lagu sekaligus:
- **Di Web Studio (Mode Single & Batch & urls.txt)**:
  - Terdapat checkbox aktif: `[✓] Jangan unduh 1 playlist langsung (Hanya unduh 1 video tunggal)`.
  - Jika link playlist dimasukkan, sistem otomatis memunculkan 3 pilihan:
    1. 🎯 **Hanya 1 Video Saja (Rekomendasi - Default)**: Mengabaikan playlist dan hanya mengunduh 1 video lagu tersebut.
    2. 📝 **Pilih Lagu Tertentu**: Membuka modal daftar video agar Anda dapat mencentang lagu mana saja yang ingin diunduh.
    3. 📑 **Unduh Seluruh Playlist**: Konfirmasi ganda akan diminta sebelum proses dimulai.
- **Di YouTube Langsung (Ekstensi & Userscript)**:
  - Muncul dialog konfirmasi instan saat mengklik tombol unduh pada video yang merupakan bagian dari playlist.
  - Dilengkapi opsi *"Ingat pilihan saya"*.

### 3. 🎚️ 6-Band Graphic Equalizer Vertikal & Web Audio Player
- **In-Browser Audio Player**: Putar lagu hasil unduhan langsung di web tanpa aplikasi pihak ketiga.
  - Kontrol: Play/Pause, Next/Prev Track, Seekbar scrub, Volume & Mute.
- **Graphic Equalizer Vertikal Berbasis Web Audio API**:
  - Menggunakan fader vertikal tegak berjajar dari kiri ke kanan layaknya studio mixer audio profesional.
  - Rentang 6-Band frekuensi: **60Hz** (Sub-Bass), **170Hz** (Bass), **350Hz** (Low-Mid), **1kHz** (Mid/Vocal), **3.5kHz** (Presence), dan **12kHz** (Treble).
  - Rentang penguatan: `-12 dB` hingga `+12 dB` dengan indikator angka desibel dinamis.
  - **Volume Boost**: Penguat volume hingga 300%.
  - **10 Preset Audio Siap Pakai**: Datar (Flat), Dangdut / Kendang Mantap 🔥, Bass Boost 🔊, Vocal Booster 🎤, Rock 🎸, Pop 🎧, Electronic / EDM ⚡, Jazz 🎷, Akustik 🎶, Treble Boost ✨.
  - Sakelar Power/Bypass instan untuk membandingkan kualitas audio asli vs ter-equalize.
  - Tersedia konsisten di: **Web Player**, **Popup Ekstensi**, dan **Floating Panel YouTube**.

### 4. 🎶 Manajemen Koleksi Musik (Library)
- **Multi-Select Bulk Action**:
  - Kotak centang (*checkbox*) di setiap lagu dengan tombol *"Pilih Semua"*.
  - **Hapus Terpilih**: Menghapus beberapa lagu sekaligus dengan konfirmasi keamanan.
  - **Download Terpilih (.ZIP)**: Mengemas lagu-lagu terpilih ke dalam 1 file zip.
- **Download Semua (.ZIP)**: Unduh seluruh koleksi lagu dalam sekali klik.
- **Pencarian Cepat**: Filter lagu berdasarkan judul atau nama file secara realtime.

### 5. 🧩 Ekstensi Browser & Userscript YouTube
- **Unduh Langsung dari YouTube**:
  - Tombol merah **"🎵 Unduh MP3"** otomatis disisipkan di bawah video YouTube dan floating button di pojok kanan bawah.
  - Pilihan kualitas bitrate langsung di menu dropdown.
  - Live toast notifikasi progres unduhan langsung di layar YouTube.
- **Ekstensi Browser (Manifest V3)**:
  - Kompatibel dengan Google Chrome, Brave Browser, Microsoft Edge, Opera, dan Vivaldi.
  - Dilengkapi popup kontrol Equalizer, status server, dan tombol unduh cepat.
  - Paket ekstensi siap unduh dalam format `.zip` langsung dari Web Studio.
- **Userscript (Tampermonkey / Violentmonkey)**:
  - Pemasangan mudah 1-klik melalui URL script server lokal.
- **Browser Launcher Otomatis**:
  - Buka browser favorit langsung ke YouTube dengan server Docker siap di background:
    ```bash
    ./open_youtube.sh
    # atau
    python3 open_youtube.py
    ```

### 6. 📝 Manajemen `urls.txt` Terintegrasi
- Editor teks terintegrasi di browser untuk membaca dan mengedit file `urls.txt` di server secara langsung.
- Tombol **Simpan File** dan **Unduh Semua Baris Ini** (dilengkapi opsi abaikan playlist).

---

## 🚀 Panduan Instalasi & Menjalankan

### Persyaratan Sistem
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)
- *(Opsional jika tanpa Docker)*: Python 3.10+, FFmpeg

---

### Cara 1: Menggunakan Docker Compose (Sangat Direkomendasikan)

1. **Jalankan Container di Background**:
   ```bash
   docker compose up -d
   ```

2. **Buka Web Studio di Browser**:
   ```
   http://localhost:5000
   ```
   > 💡 **Akses dari HP / Laptop Lain di Jaringan yang Sama**: Buka `http://<IP-KOMPUTER-ANDA>:5000` (contoh: `http://192.168.1.15:5000`).

3. **Melihat Log Aktivitas**:
   ```bash
   docker compose logs -f
   ```

4. **Me-restart Container**:
   ```bash
   docker compose restart
   ```

5. **Menghentikan Container**:
   ```bash
   docker compose down
   ```

---

### Cara 2: Menjalankan Tanpa Docker (Lokal / Mode Virtualenv)

1. **Pasang FFmpeg**:
   ```bash
   # Ubuntu / Debian
   sudo apt update && sudo apt install ffmpeg -y
   ```

2. **Siapkan Virtual Environment & Pasang Dependensi**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Jalankan Server**:
   ```bash
   # Mode Web UI
   python apps.py

   # Atau Mode CLI (Unduh langsung dari urls.txt di terminal)
   python apps.py --cli
   ```

---

## 🧩 Cara Memasang Ekstensi Browser

### Opsi A: Ekstensi Browser (Google Chrome / Brave / Edge)
1. Buka Web Studio di `http://localhost:5000` dan masuk ke tab **🧩 Ekstensi Browser**.
2. Klik tombol **"Download Ekstensi (.zip)"**, lalu ekstrak file zip tersebut di komputer Anda (atau gunakan folder `extension/` dari repositori ini).
3. Buka halaman ekstensi di browser Anda:
   - Chrome / Brave: `chrome://extensions`
   - Edge: `edge://extensions`
4. Aktifkan **Developer mode** (Mode Pengembang) di pojok kanan atas.
5. Klik **Load unpacked** (Muat yang belum dibongkar), lalu pilih folder `extension/`.
6. Ikon **YouTube to MP3 Studio** akan muncul di toolbar browser Anda.

### Opsi B: Userscript (Tampermonkey / Violentmonkey)
1. Pasang ekstensi [Tampermonkey](https://www.tampermonkey.net/) atau Violentmonkey di browser Anda.
2. Akses URL berikut di browser:
   ```
   http://localhost:5000/extension/youtube-to-mp3-studio.user.js
   ```
3. Klik tombol **Install**.
4. Buka video YouTube apa pun, tombol merah **"🎵 Unduh MP3"** dan tombol **"🎚️ Equalizer"** akan otomatis muncul di bawah video.

---

## 📂 Struktur Direktori Proyek

```
youtube_to_mp3/
├── apps.py                  # Backend Flask, yt-dlp worker queue, FFmpeg extractor, REST API
├── docker-compose.yml       # Konfigurasi container Docker & volume binding
├── Dockerfile               # Spesifikasi image container (Python 3.12 + FFmpeg)
├── requirements.txt         # Dependensi Python (Flask, yt-dlp)
├── urls.txt                 # File penyimpanan daftar link YouTube lokal
├── open_youtube.py          # Python launcher browser favorit otomatis ke YouTube
├── open_youtube.sh          # Bash script launcher
├── .gitignore               # Aturan file yang diabaikan git
├── .dockerignore            # Aturan file yang diabaikan saat build Docker
├── downloads/               # Folder penyimpanan hasil konversi file audio MP3
├── templates/
│   └── index.html           # Antarmuka web modern (Tailwind CSS, FontAwesome, Audio Player)
├── static/
│   ├── app.js               # Logika frontend, audio player, batch selection, dialog playlist & AJAX
│   ├── style.css            # Custom CSS styling Web Studio
│   ├── favicon.ico          # Favicon tab browser
│   ├── favicon.png          # Favicon resolusi tinggi
│   └── extension/           # Mirror asset ekstensi yang disajikan oleh web server
└── extension/               # Source code Ekstensi Browser & Userscript
    ├── manifest.json        # Manifest V3 browser extension
    ├── background.js        # Background worker service
    ├── content.js           # In-page script YouTube & dialog konfirmasi playlist
    ├── content.css          # In-page styling tombol unduh & equalizer panel
    ├── popup.html           # Popup window ekstensi dengan 6-band graphic equalizer vertikal
    ├── popup.js             # Logika interaksi popup ekstensi
    ├── youtube-to-mp3-studio.user.js  # Tampermonkey userscript terintegrasi
    └── icons/               # Ikon ekstensi (16x16, 48x48, 128x128)
```

---

## ⚙️ Konfigurasi Environment Variables

Konfigurasi dapat disesuaikan pada file `docker-compose.yml`:

| Variabel | Default | Keterangan |
| :--- | :--- | :--- |
| `DOWNLOAD_DIR` | `./downloads` | Path folder tempat file hasil unduhan MP3 disimpan |
| `URLS_FILE` | `./urls.txt` | Path file daftar URL yang dikelola oleh server |
| `PORT` | `5000` | Port HTTP tempat server Flask berjalan |

---

## 📡 Dokumentasi REST API

Aplikasi menyediakan REST API yang dapat digunakan untuk integrasi sistem lain:

### 🎯 Unduhan & Antrean (Queue)
- **`GET /api/info?url=<URL>`**
  - Mengambil info metadata video/playlist (judul, durasi, channel, thumbnail, status playlist).
- **`POST /api/download`**
  - Menambahkan URL ke antrean unduhan.
  - **Body JSON**:
    ```json
    {
      "urls": ["https://www.youtube.com/watch?v=..."],
      "quality": "320",
      "no_playlist": true
    }
    ```
- **`GET /api/tasks`**
  - Mengambil status seluruh antrean unduhan realtime (progress %, speed, ETA, status).
- **`POST /api/tasks/clear`**
  - Menghapus riwayat antrean yang sudah selesai atau berstatus error.

### 🎵 Koleksi File & Streaming Musik
- **`GET /api/files`**
  - Menampilkan seluruh file MP3 di folder downloads beserta ukuran dan waktu pembuatan.
- **`GET /api/files/<filename>/stream`**
  - Streaming audio MP3 langsung untuk pemutar musik web.
- **`GET /api/files/<filename>/download`**
  - Mengunduh file MP3 satuan ke komputer/HP.
- **`GET /api/files/download-zip`**
  - Mengunduh seluruh koleksi lagu dalam 1 file arsip `.zip`.
- **`POST /api/files/download-zip`**
  - Mengunduh beberapa file lagu terpilih dalam format `.zip`.
  - **Body JSON**: `{"filenames": ["lagu1.mp3", "lagu2.mp3"]}`
- **`DELETE /api/files/<filename>`**
  - Menghapus 1 file lagu dari server.
- **`POST /api/files/batch-delete`**
  - Menghapus beberapa file terpilih sekaligus secara massal.
  - **Body JSON**: `{"filenames": ["lagu1.mp3", "lagu2.mp3"]}`

### 📝 Manajemen `urls.txt`
- **`GET /api/urls-txt`**
  - Mengambil isi teks dari file `urls.txt`.
- **`POST /api/urls-txt`**
  - Memperbarui isi teks file `urls.txt`.
  - **Body JSON**: `{"content": "https://..."}`

### 🧩 Ekstensi & Utilitas
- **`GET /api/extension/download-zip`**
  - Mengunduh paket ekstensi browser siap pasang dalam format `.zip`.
- **`GET /extension/youtube-to-mp3-studio.user.js`**
  - Endpoint instalasi langsung untuk Tampermonkey/Violentmonkey userscript.
- **`GET /favicon.ico`**
  - Menyajikan favicon logo studio untuk tab browser.

---

## 🛡️ Catatan & Lisensi
- Proyek ini dibuat untuk tujuan edukasi dan penggunaan personal.
- Mohon gunakan secara bijak dengan memperhatikan hak cipta konten dan kebijakan dari platform penyedia media.
