# 🎵 YouTube to MP3 Studio (Web & Docker)

Aplikasi web modern berbasis Docker untuk mengunduh audio YouTube dan mengonversinya langsung ke format MP3 berkualitas tinggi dengan antarmuka gelap yang elegan, pemutar musik terintegrasi, dan manajemen unduhan yang lengkap.

---

## ✨ Fitur Utama

### 1. 📥 Pengunduhan Fleksibel (Single & Batch)
- **Mode Satu Lagu**:
  - Tempelkan URL YouTube, otomatis menampilkan pratinjau (*preview*) judul lagu, nama channel, durasi, dan thumbnail video.
  - Pilihan kualitas audio: **320 kbps (Ultra HQ)**, **256 kbps (HQ)**, **192 kbps (Standar)**, **128 kbps (Hemat Kuota)**.
- **Mode Banyak Lagu (Batch)**:
  - Input puluhan hingga ratusan URL YouTube sekaligus (satu URL per baris).
  - **Upload File `.txt`**: Unggah langsung file daftar URL dari komputer/HP Anda dengan 1 klik.
  - **Drag & Drop**: Tarik dan lepaskan file `.txt` langsung ke dalam kotak input.
  - **Impor dari `urls.txt`**: Muat daftar URL yang tersimpan di server secara instan.
  - Indikator otomatis jumlah URL valid yang terdeteksi.

### 2. ⚡ Antrean & Pemantauan Progres Realtime
- Multi-threaded background downloader (yt-dlp + FFmpeg).
- Pemantauan progres unduhan realtime dengan *live progress bar*, kecepatan transfer (Speed), estimasi waktu selesai (ETA), dan status ekstraksi audio.
- Riwayat tugas unduhan sukses atau gagal, dilengkapi tombol **Bersihkan Riwayat**.

### 3. 🎶 Koleksi Musik & Web Audio Player
- **In-Browser Audio Player**: Putar lagu langsung di web tanpa aplikasi pihak ketiga.
  - Kontrol: Play/Pause, Next Track, Previous Track, Seekbar scrub, Pengatur Volume & Mute.
- **🎚️ 6-Band Audio Equalizer**:
  - Berbasis **Web Audio API** (`BiquadFilterNode`) dengan kontrol frekuensi 6-Band: 60Hz (Sub-Bass), 170Hz (Bass), 350Hz (Low-Mid), 1kHz (Mid/Vokal), 3.5kHz (Presence), dan 12kHz (Treble).
  - Rentang gain `-12 dB` s/d `+12 dB` dengan indikator dB dinamis.
  - **10 Preset Audio Siap Pakai**: Datar (Flat), Dangdut / Kendang Mantap 🔥, Bass Boost 🔊, Vocal Booster 🎤, Rock 🎸, Pop 🎧, Electronic / EDM ⚡, Jazz 🎷, Akustik 🎶, dan Treble Boost ✨.
  - Sakelar Power/Bypass untuk pengujian komparasi audio secara instan.
  - Pengaturan equalizer tersimpan otomatis di browser (`localStorage`).
- **Pilih Dulu Baru Dihapus (Bulk / Multi-Select Delete)**:
  - Kotak centang (*checkbox*) di setiap item lagu.
  - Tombol **"Pilih Semua"** untuk mencentang seluruh lagu yang tampil sekaligus.
  - Counter lagu terpilih realtime.
  - Tombol **"Hapus Terpilih"** dengan dialog konfirmasi keamanan agar tidak salah hapus.
- **Download Langsung**:
  - Unduh per file ke perangkat Anda.
  - Tombol **"Download Semua (.ZIP)"** untuk mengemas seluruh koleksi lagu ke dalam 1 file zip.
- **Pencarian Cepat**: Filter lagu berdasarkan judul atau nama file secara langsung (*instant search*).

### 4. 📝 Kelola File `urls.txt` Terintegrasi
- Editor teks terintegrasi di browser untuk melihat dan mengedit file `urls.txt` yang tersimpan di server.
- Tombol **Simpan File** dan **Unduh Semua Baris Ini** langsung dari tab editor.

### 5. 📱 Desain Responsif & Dark Mode
- Menggunakan Tailwind CSS dan FontAwesome dengan palet dark mode premium.
- Tampilan optimal di PC desktop, laptop, tablet, maupun smartphone.

### 6. 🧩 Ekstensi Browser & Launcher YouTube (Unduh Mirip Ekstensi)
- **Unduh Langsung dari Halaman YouTube**:
  - Tombol merah **"🎵 Unduh MP3"** disisipkan otomatis tepat di bawah video YouTube (sebelah tombol Like/Share).
  - Pilihan kualitas audio langsung di dropdown: 320 kbps (Ultra HQ), 256 kbps, 192 kbps, 128 kbps.
  - Toast notifikasi live progress unduhan langsung di layar YouTube.
- **Ekstensi Browser (Manifest V3)**:
  - Tersedia di folder `extension/` (Google Chrome, Brave Browser, Microsoft Edge, Opera, Vivaldi).
  - Toolbar Popup dengan deteksi otomatis video YouTube yang sedang aktif dan status server.
  - Menu Klik Kanan (Context Menu) pada link video YouTube: *"🎵 Unduh MP3 ke Studio"*.
- **Userscript Tampermonkey / Violentmonkey**:
  - 1-Klik install via `http://localhost:5000/extension/youtube-to-mp3-studio.user.js`.
- **Launcher Otomatis Host**:
  - Buka browser favorit langsung ke YouTube via skrip:
    ```bash
    ./open_youtube.sh
    # atau
    python3 open_youtube.py
    ```
  - Atau klik tombol **"Buka YouTube"** di antarmuka Web Studio.

---

## 🚀 Cara Menjalankan

### Persyaratan Sistem
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)
- *(Opsional jika tanpa Docker)*: Python 3.10+, FFmpeg

---

### 1. Menjalankan dengan Docker Compose (Sangat Direkomendasikan)

1. Jalankan container di background:
   ```bash
   docker compose up -d
   ```

2. Buka browser dan akses antarmuka web:
   ```
   http://localhost:5000
   ```
   > 💡 **Akses dari HP / Perangkat Lain**: Pastikan berada di jaringan Wi-Fi yang sama, lalu buka `http://<IP-KOMPUTER-ANDA>:5000` (contoh: `http://192.168.1.10:5000`).

3. Melihat log aktivitas container:
   ```bash
   docker compose logs -f
   ```

4. Menghentikan container:
   ```bash
   docker compose down
   ```

5. Me-restart container jika mengubah konfigurasi:
   ```bash
   docker compose restart
   ```

---

### 2. Menjalankan Tanpa Docker (Lokal / Mode Virtualenv)

1. Pastikan **FFmpeg** sudah terpasang di sistem:
   ```bash
   # Ubuntu / Debian
   sudo apt update && sudo apt install ffmpeg -y
   ```

2. Buat virtual environment dan pasang dependensi:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. Jalankan aplikasi:
   ```bash
   # Mode Web UI (Default)
   python apps.py

   # Atau Mode CLI Tradisional (Membaca file urls.txt di terminal)
   python apps.py --cli
   ```

---

## 📂 Struktur Proyek

```
youtube_to_mp3/
├── apps.py                  # Server backend Flask & pengelola unduhan yt-dlp
├── docker-compose.yml       # Konfigurasi orkestrasi container Docker
├── Dockerfile               # Konfigurasi image Docker (Alpine/Python + FFmpeg)
├── requirements.txt         # Dependensi Python (Flask, yt-dlp)
├── urls.txt                 # File daftar URL YouTube default
├── .gitignore               # Aturan file yang diabaikan oleh Git
├── .dockerignore            # File yang diabaikan saat build Docker
├── downloads/               # Direktori penyimpanan hasil konversi MP3
│   └── .gitkeep             # File penanda agar folder tetap terlacak di Git
├── static/
│   └── app.js               # Logika frontend, audio player, batch selection & AJAX
└── templates/
    └── index.html           # Tampilan antarmuka web responsif
```

---

## ⚙️ Konfigurasi Lingkungan (Environment Variables)

Aplikasi mendukung konfigurasi melalui environment variable yang dapat disesuaikan pada `docker-compose.yml`:

| Variabel | Default | Keterangan |
| :--- | :--- | :--- |
| `DOWNLOAD_DIR` | `./downloads` | Path folder tempat file MP3 disimpan |
| `URLS_FILE` | `./urls.txt` | Path file daftar URL yang dikelola server |

---

## 📡 Dokumentasi REST API

Aplikasi menyediakan berbagai endpoint API yang dapat diintegrasikan dengan aplikasi lain:

### 🎯 Unduhan & Tugas
- `POST /api/info`
  - **Body**: `{"url": "https://youtu.be/..."}`
  - Mengambil preview judul, durasi, channel, dan thumbnail YouTube.
- `POST /api/download`
  - **Body**: `{"urls": ["..."], "quality": "320"}`
  - Menambahkan satu atau banyak lagu ke antrean unduhan.
- `GET /api/tasks`
  - Mendapatkan daftar status antrean unduhan saat ini.
- `POST /api/tasks/clear`
  - Membersihkan riwayat antrean yang sudah selesai atau error.

### 🎵 Koleksi Lagu & File
- `GET /api/files`
  - Menampilkan seluruh file MP3 hasil unduhan beserta ukuran dan waktu pembuatan.
- `GET /api/files/<filename>/stream`
  - Streaming audio MP3 langsung untuk pemutar musik web.
- `GET /api/files/<filename>/download`
  - Mengunduh file MP3 satuan ke perangkat pengguna.
- `GET/POST /api/files/download-zip`
  - Mengunduh koleksi MP3 dalam satu file arsip `.zip`.
  - Mendukung unduhan seluruh file (tanpa parameter) atau hanya file terpilih (`POST` dengan body `{"filenames": [...]}` atau `GET` dengan query `?files=lagu1.mp3,lagu2.mp3`).
- `DELETE /api/files/<filename>`
  - Menghapus satu file MP3 dari server.
- `POST /api/files/batch-delete`
  - **Body**: `{"filenames": ["lagu1.mp3", "lagu2.mp3"]}`
  - Menghapus beberapa file terpilih sekaligus secara aman.

### 📝 Manajemen `urls.txt`
- `GET /api/urls-txt`
  - Mengambil isi file `urls.txt` di server.
- `POST /api/urls-txt`
  - **Body**: `{"content": "..."}`
  - Memperbarui isi file `urls.txt` di server.

---

## 🛡️ Catatan & Lisensi
- Proyek ini ditujukan untuk penggunaan pribadi dan edukasi.
- Harap perhatikan hak cipta konten dan ketentuan layanan dari platform sumber audio.
