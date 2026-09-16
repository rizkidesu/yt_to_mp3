#!/usr/bin/env bash
# YouTube to MP3 Studio - Browser Launcher Shell Script
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=================================================="
echo "  🎵 YouTube to MP3 Studio - Browser Launcher"
echo "=================================================="

# Cek container docker
if command -v docker >/dev/null 2>&1; then
    if ! docker ps --filter "name=youtube_mp3_container" --format '{{.Names}}' | grep -q "youtube_mp3_container"; then
        echo "🚀 Menjalankan container Docker..."
        docker compose up -d
    else
        echo "🟢 Docker container youtube_mp3_container sudah aktif."
    fi
fi

TARGET_URL="https://www.youtube.com"

# Cari browser favorit yang tersedia
if command -v google-chrome >/dev/null 2>&1; then
    echo "✅ Membuka Google Chrome..."
    nohup google-chrome "$TARGET_URL" >/dev/null 2>&1 &
elif command -v brave-browser >/dev/null 2>&1; then
    echo "✅ Membuka Brave Browser..."
    nohup brave-browser "$TARGET_URL" >/dev/null 2>&1 &
elif command -v firefox >/dev/null 2>&1; then
    echo "✅ Membuka Firefox..."
    nohup firefox "$TARGET_URL" >/dev/null 2>&1 &
elif command -v xdg-open >/dev/null 2>&1; then
    echo "✅ Membuka browser default..."
    nohup xdg-open "$TARGET_URL" >/dev/null 2>&1 &
fi

echo "✨ YouTube berhasil dibuka di browser Anda."
echo "🎧 Web Studio aktif di: http://localhost:5000"
