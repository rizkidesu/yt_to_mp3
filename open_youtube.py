#!/usr/bin/env python3
"""
YouTube to MP3 Studio - Browser Launcher
Membuka browser favorit langsung ke YouTube dengan integrasi unduhan MP3.
"""

import sys
import os
import shutil
import subprocess
import webbrowser

YOUTUBE_URL = "https://www.youtube.com"
STUDIO_URL = "http://localhost:5000"

def check_docker_container():
    try:
        res = subprocess.run(
            ["docker", "ps", "--filter", "name=youtube_mp3_container", "--format", "{{.Status}}"],
            capture_output=True, text=True, timeout=5
        )
        if "Up" in res.stdout:
            print("🟢 Server YouTube to MP3 Studio (Docker) aktif di background.")
            return True
        else:
            print("🟡 Server Docker belum berjalan. Mencoba menjalankan container...")
            subprocess.run(["docker", "compose", "up", "-d"], check=False)
            return True
    except Exception as e:
        print(f"ℹ️ Info: Tidak dapat memeriksa status docker ({e}). Melanjutkan...")
        return False

def open_favorite_browser(url):
    print(f"\n🚀 Membuka YouTube di browser favorit ({url})...")

    # Deteksi browser favorit yang terpasang di sistem
    browsers = [
        ("Google Chrome", "google-chrome", ["google-chrome", url]),
        ("Google Chrome Stable", "google-chrome-stable", ["google-chrome-stable", url]),
        ("Brave Browser", "brave-browser", ["brave-browser", url]),
        ("Mozilla Firefox", "firefox", ["firefox", url]),
        ("Chromium", "chromium", ["chromium", url]),
        ("Chromium Browser", "chromium-browser", ["chromium-browser", url]),
    ]

    for name, bin_name, cmd in browsers:
        bin_path = shutil.which(bin_name)
        if bin_path:
            try:
                print(f"✅ Menemukan browser: {name} ({bin_path})")
                subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return True
            except Exception as e:
                print(f"⚠️ Gagal membuka {name}: {e}")

    # Fallback ke xdg-open atau webbrowser
    if shutil.which("xdg-open"):
        try:
            print("🌐 Menggunakan default browser sistem (xdg-open)...")
            subprocess.Popen(["xdg-open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except Exception:
            pass

    print("🌐 Menggunakan Python webbrowser module...")
    webbrowser.open(url)
    return True

def main():
    print("=" * 60)
    print("  🎵 YouTube to MP3 Studio - Browser Launcher")
    print("=" * 60)

    # 1. Pastikan docker/server menyala
    check_docker_container()

    # 2. Buka YouTube di browser favorit
    open_favorite_browser(YOUTUBE_URL)

    print("\n💡 Tips Penggunaan:")
    print("1. Pastikan Anda telah memasang Ekstensi Browser atau Userscript")
    print("   dari tab '🧩 Ekstensi Browser' di Web Studio (http://localhost:5000).")
    print("2. Saat memutar lagu di YouTube, klik tombol merah '🎵 Unduh MP3' di bawah video!")
    print("3. Lagu otomatis diunduh ke folder 'downloads' dan siap diputar di Studio.\n")

if __name__ == "__main__":
    main()
