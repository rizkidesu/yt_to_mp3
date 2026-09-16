import os
import sys
import time
import uuid
import queue
import threading
import zipfile
import io
import json
import re
import urllib.request
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory, abort
from yt_dlp import YoutubeDL

app = Flask(__name__)

DOWNLOAD_DIR = os.path.abspath(os.environ.get('DOWNLOAD_DIR', './downloads'))
URLS_FILE = os.path.abspath(os.environ.get('URLS_FILE', './urls.txt'))
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def extract_yt_id(url):
    if not url:
        return None
    m = re.search(r'(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11})', url)
    return m.group(1) if m else None

def format_size(size_bytes):
    if not size_bytes or size_bytes < 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(size_bytes)
    while size >= 1024 and i < len(units) - 1:
        size /= 1024.0
        i += 1
    return f"{size:.2f} {units[i]}"

def format_duration(seconds):
    if not seconds:
        return "--:--"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"

class DownloadManager:
    def __init__(self, max_workers=2):
        self.max_workers = max_workers
        self.queue = queue.Queue()
        self.tasks = {}
        self.lock = threading.Lock()
        self.workers = []
        for _ in range(max_workers):
            t = threading.Thread(target=self._worker_loop, daemon=True)
            t.start()
            self.workers.append(t)

    def add_task(self, url, quality="192", no_playlist=True):
        task_id = str(uuid.uuid4())[:8]
        yt_id = extract_yt_id(url)
        initial_thumb = f"https://i.ytimg.com/vi/{yt_id}/mqdefault.jpg" if yt_id else None

        # Jika memilih untuk TIDAK mengunduh playlist langsung dan URL memiliki ID video tunggal,
        # bersihkan URL agar hanya mengunduh 1 video tersebut
        if no_playlist and yt_id and ('list=' in url or 'index=' in url):
            url = f"https://www.youtube.com/watch?v={yt_id}"

        task_info = {
            "id": task_id,
            "url": url,
            "quality": quality,
            "no_playlist": no_playlist,
            "title": "Memuat informasi...",
            "thumbnail": initial_thumb,
            "duration": None,
            "duration_formatted": None,
            "status": "queued",  # queued, downloading, converting, completed, error
            "progress": 0,
            "speed": "",
            "eta": "",
            "total_bytes": 0,
            "downloaded_bytes": 0,
            "filename": None,
            "error": None,
            "created_at": time.time(),
            "completed_at": None,
        }
        with self.lock:
            self.tasks[task_id] = task_info
        self.queue.put(task_id)
        return task_info

    def get_task(self, task_id):
        with self.lock:
            return self.tasks.get(task_id)

    def get_all_tasks(self):
        with self.lock:
            return sorted(self.tasks.values(), key=lambda x: x["created_at"], reverse=True)

    def clear_finished(self):
        with self.lock:
            keys_to_delete = [
                tid for tid, t in self.tasks.items()
                if t["status"] in ("completed", "error")
            ]
            for tid in keys_to_delete:
                del self.tasks[tid]
            return len(keys_to_delete)

    def _worker_loop(self):
        while True:
            try:
                task_id = self.queue.get()
                self._process_task(task_id)
            except Exception as e:
                print(f"[Worker Error] {e}")
            finally:
                self.queue.task_done()

    def _process_task(self, task_id):
        with self.lock:
            task = self.tasks.get(task_id)
            if not task:
                return
            task["status"] = "downloading"
            task["progress"] = 1

        url = task["url"]
        quality = task.get("quality", "192")
        no_playlist = task.get("no_playlist", True)

        def ytdl_progress_hook(d):
            status = d.get("status")
            with self.lock:
                if task_id not in self.tasks:
                    return
                t = self.tasks[task_id]
                if status == "downloading":
                    t["status"] = "downloading"
                    total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                    downloaded = d.get("downloaded_bytes") or 0
                    t["total_bytes"] = total
                    t["downloaded_bytes"] = downloaded
                    if total > 0:
                        t["progress"] = round((downloaded / total) * 100, 1)
                    else:
                        p_str = d.get("_percent_str", "").replace("%", "").strip()
                        try:
                            t["progress"] = float(p_str)
                        except Exception:
                            pass
                    t["speed"] = d.get("_speed_str", "").strip()
                    t["eta"] = d.get("_eta_str", "").strip()
                elif status == "finished":
                    t["status"] = "converting"
                    t["progress"] = 96.0
                    t["speed"] = ""
                    t["eta"] = "Konversi audio..."

        def ytdl_postprocessor_hook(d):
            with self.lock:
                if task_id not in self.tasks:
                    return
                t = self.tasks[task_id]
                if d.get("status") == "started":
                    t["status"] = "converting"
                    t["eta"] = "Mengekstrak MP3 (FFmpeg)..."
                elif d.get("status") == "finished":
                    t["progress"] = 100.0

        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": os.path.join(DOWNLOAD_DIR, "%(title)s.%(ext)s"),
            "noplaylist": True if no_playlist else False,
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": quality,
            }],
            "progress_hooks": [ytdl_progress_hook],
            "postprocessor_hooks": [ytdl_postprocessor_hook],
            "quiet": True,
            "no_warnings": True,
            "ignoreerrors": False,
        }
        if no_playlist:
            ydl_opts["playlist_items"] = "1"

        try:
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                # Jika input adalah playlist namun diunduh 1 video (noplaylist)
                if 'entries' in info:
                    entries = [e for e in info['entries'] if e]
                    if entries:
                        entry = entries[0]
                        title = entry.get("title") or info.get("title", "Unknown Title")
                        duration = entry.get("duration") or info.get("duration")
                        thumbnail = entry.get("thumbnail") or info.get("thumbnail")
                        try:
                            raw_filename = ydl.prepare_filename(entry)
                            base, _ = os.path.splitext(os.path.basename(raw_filename))
                            filename = f"{base}.mp3"
                        except Exception:
                            filename = None
                    else:
                        title = info.get("title", "Unknown Title")
                        duration = info.get("duration")
                        thumbnail = info.get("thumbnail")
                        filename = None
                else:
                    title = info.get("title", "Unknown Title")
                    duration = info.get("duration")
                    thumbnail = info.get("thumbnail")
                    filename = None
                    try:
                        raw_filename = ydl.prepare_filename(info)
                        base, _ = os.path.splitext(os.path.basename(raw_filename))
                        filename = f"{base}.mp3"
                    except Exception:
                        pass

                with self.lock:
                    if task_id in self.tasks:
                        t = self.tasks[task_id]
                        t["title"] = title
                        t["duration"] = duration
                        t["duration_formatted"] = format_duration(duration)
                        t["thumbnail"] = thumbnail
                        t["filename"] = filename
                        t["status"] = "completed"
                        t["progress"] = 100
                        t["speed"] = ""
                        t["eta"] = "Selesai"
                        t["completed_at"] = time.time()
        except Exception as e:
            err_msg = str(e)
            with self.lock:
                if task_id in self.tasks:
                    t = self.tasks[task_id]
                    t["status"] = "error"
                    t["error"] = err_msg
                    t["completed_at"] = time.time()
            print(f"[Download Error] {url}: {err_msg}")

download_manager = DownloadManager(max_workers=2)

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        res = app.make_default_options_response()
        res.headers["Access-Control-Allow-Origin"] = "*"
        res.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        res.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        return res

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    return response

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    icon_dir = os.path.join(app.root_path, 'static', 'extension', 'icons')
    return send_from_directory(icon_dir, 'icon48.png', mimetype='image/png')

@app.route('/api/info', methods=['GET'])
def get_video_info():
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({"error": "URL YouTube tidak boleh kosong."}), 400

    yt_id = extract_yt_id(url)

    # 1. Jalur super cepat: YouTube oEmbed API (respons < 200ms)
    if yt_id and 'list=' not in url:
        try:
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={yt_id}&format=json"
            req = urllib.request.Request(oembed_url, headers={'User-Agent': 'Mozilla/5.0 (compatible; YouTubeMP3/1.0)'})
            with urllib.request.urlopen(req, timeout=3) as res:
                data = json.loads(res.read().decode('utf-8'))
                return jsonify({
                    "is_playlist": False,
                    "title": data.get('title'),
                    "duration": None,
                    "duration_formatted": "Video",
                    "thumbnail": f"https://i.ytimg.com/vi/{yt_id}/hqdefault.jpg",
                    "uploader": data.get('author_name') or 'YouTube',
                })
        except Exception:
            pass

    # 2. Fallback ke yt-dlp (untuk playlist atau sumber selain video tunggal)
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'extract_flat': 'in_playlist',
        'socket_timeout': 6,
        'extractor_retries': 1,
    }
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if 'entries' in info:
                # Playlist
                raw_entries = [e for e in info['entries'] if e]
                first_thumb = raw_entries[0].get('thumbnail') if raw_entries else None
                entries_list = []
                for idx, e in enumerate(raw_entries[:150]):
                    eid = e.get('id')
                    entries_list.append({
                        "index": idx + 1,
                        "id": eid,
                        "title": e.get('title') or f"Video {idx+1}",
                        "duration": e.get('duration'),
                        "duration_formatted": format_duration(e.get('duration')),
                        "url": f"https://www.youtube.com/watch?v={eid}" if eid else None,
                        "thumbnail": e.get('thumbnail') or (f"https://i.ytimg.com/vi/{eid}/mqdefault.jpg" if eid else None),
                        "is_current": (eid == yt_id) if yt_id else False
                    })

                single_thumb = f"https://i.ytimg.com/vi/{yt_id}/hqdefault.jpg" if yt_id else None
                return jsonify({
                    "is_playlist": True,
                    "title": info.get('title', 'Playlist YouTube'),
                    "count": len(raw_entries),
                    "thumbnail": single_thumb or first_thumb,
                    "uploader": info.get('uploader') or info.get('channel') or 'YouTube',
                    "has_single_video": bool(yt_id),
                    "single_video_id": yt_id,
                    "single_video_url": f"https://www.youtube.com/watch?v={yt_id}" if yt_id else None,
                    "entries": entries_list
                })
            else:
                thumb = info.get('thumbnail')
                if not thumb and yt_id:
                    thumb = f"https://i.ytimg.com/vi/{yt_id}/hqdefault.jpg"
                return jsonify({
                    "is_playlist": False,
                    "title": info.get('title'),
                    "duration": info.get('duration'),
                    "duration_formatted": format_duration(info.get('duration')),
                    "thumbnail": thumb,
                    "uploader": info.get('uploader') or info.get('channel'),
                })
    except Exception as e:
        # Jika gagal atau diblokir bot check tapi kita memiliki ID YouTube, tetap berikan thumbnail & info dasar
        if yt_id:
            return jsonify({
                "is_playlist": ('list=' in url),
                "has_single_video": True,
                "single_video_id": yt_id,
                "single_video_url": f"https://www.youtube.com/watch?v={yt_id}",
                "title": f"YouTube Video ({yt_id})",
                "duration": None,
                "duration_formatted": "Video",
                "thumbnail": f"https://i.ytimg.com/vi/{yt_id}/hqdefault.jpg",
                "uploader": "YouTube",
                "count": 1 if ('list=' in url) else None,
                "entries": []
            })
        return jsonify({"error": str(e)}), 400

@app.route('/api/download', methods=['POST'])
def start_download():
    data = request.get_json() or {}
    urls = data.get('urls', [])
    quality = str(data.get('quality', '192'))

    # Opsi playlist: default True (tidak download playlist utuh, hanya 1 video)
    no_playlist = data.get('no_playlist', True)
    if 'download_playlist' in data:
        no_playlist = not bool(data.get('download_playlist'))

    if isinstance(urls, str):
        urls = [urls]

    # Bersihkan URL
    cleaned_urls = []
    for u in urls:
        if not u:
            continue
        lines = str(u).splitlines()
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#'):
                cleaned_urls.append(line)

    if not cleaned_urls:
        return jsonify({"error": "Tidak ada URL valid yang diberikan."}), 400

    task_ids = []
    for u in cleaned_urls:
        t = download_manager.add_task(u, quality=quality, no_playlist=no_playlist)
        task_ids.append(t["id"])

    return jsonify({
        "success": True,
        "count": len(task_ids),
        "task_ids": task_ids
    })

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = download_manager.get_all_tasks()
    active_count = sum(1 for t in tasks if t["status"] in ("queued", "downloading", "converting"))
    return jsonify({
        "tasks": tasks,
        "active_count": active_count,
        "total_count": len(tasks)
    })

@app.route('/api/tasks/clear', methods=['POST'])
def clear_tasks():
    removed = download_manager.clear_finished()
    return jsonify({"success": True, "removed": removed})

@app.route('/api/files', methods=['GET'])
def list_files():
    search = request.args.get('q', '').lower()
    files = []
    total_size = 0

    if os.path.exists(DOWNLOAD_DIR):
        for entry in os.scandir(DOWNLOAD_DIR):
            if entry.is_file() and entry.name.lower().endswith(('.mp3', '.m4a', '.webm', '.wav')):
                try:
                    stat = entry.stat()
                    total_size += stat.st_size
                    if search and search not in entry.name.lower():
                        continue
                    mtime_dt = datetime.fromtimestamp(stat.st_mtime)
                    files.append({
                        "name": entry.name,
                        "size": stat.st_size,
                        "size_formatted": format_size(stat.st_size),
                        "mtime": stat.st_mtime,
                        "mtime_formatted": mtime_dt.strftime("%Y-%m-%d %H:%M"),
                        "stream_url": f"/api/files/{entry.name}/stream",
                        "download_url": f"/api/files/{entry.name}/download"
                    })
                except Exception:
                    pass

    files.sort(key=lambda x: x["mtime"], reverse=True)
    return jsonify({
        "files": files,
        "total_files": len(files),
        "total_size": total_size,
        "total_size_formatted": format_size(total_size)
    })

@app.route('/api/files/<path:filename>/stream')
def stream_file(filename):
    file_path = os.path.abspath(os.path.join(DOWNLOAD_DIR, filename))
    if not file_path.startswith(DOWNLOAD_DIR) or not os.path.exists(file_path):
        abort(404)
    response = send_from_directory(DOWNLOAD_DIR, filename, mimetype="audio/mpeg", conditional=True)
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

@app.route('/api/files/<path:filename>/download')
def download_file(filename):
    file_path = os.path.abspath(os.path.join(DOWNLOAD_DIR, filename))
    if not file_path.startswith(DOWNLOAD_DIR) or not os.path.exists(file_path):
        abort(404)
    return send_from_directory(DOWNLOAD_DIR, filename, as_attachment=True)

@app.route('/api/files/batch-delete', methods=['POST'])
def batch_delete_files():
    data = request.get_json() or {}
    filenames = data.get('filenames', [])
    if not filenames or not isinstance(filenames, list):
        return jsonify({"error": "Daftar file tidak valid."}), 400

    deleted = []
    errors = []
    for fn in filenames:
        safe_name = os.path.basename(fn)
        file_path = os.path.abspath(os.path.join(DOWNLOAD_DIR, safe_name))
        if not file_path.startswith(DOWNLOAD_DIR) or not os.path.isfile(file_path):
            errors.append(f"{safe_name}: File tidak ditemukan")
            continue
        try:
            os.remove(file_path)
            deleted.append(safe_name)
        except Exception as e:
            errors.append(f"{safe_name}: {str(e)}")

    return jsonify({
        "success": True,
        "deleted_count": len(deleted),
        "errors": errors,
        "message": f"Berhasil menghapus {len(deleted)} file."
    })

@app.route('/api/files/<path:filename>', methods=['DELETE'])
def delete_file(filename):
    file_path = os.path.abspath(os.path.join(DOWNLOAD_DIR, filename))
    if not file_path.startswith(DOWNLOAD_DIR) or not os.path.exists(file_path):
        return jsonify({"error": "File tidak ditemukan."}), 404
    try:
        os.remove(file_path)
        return jsonify({"success": True, "message": f"File '{filename}' berhasil dihapus."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/files/download-zip', methods=['GET', 'POST'])
def download_zip():
    target_files = []
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        target_files = data.get('filenames', [])
        if not target_files:
            return jsonify({"error": "Tidak ada file yang dipilih untuk di-download."}), 400
    else:
        files_arg = request.args.get('files')
        if files_arg:
            target_files = [f.strip() for f in files_arg.split(',') if f.strip()]
        elif request.args.getlist('file'):
            target_files = request.args.getlist('file')

    memory_file = io.BytesIO()
    file_count = 0
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        if os.path.exists(DOWNLOAD_DIR):
            if target_files:
                for fname in target_files:
                    safe_name = os.path.basename(fname)
                    file_path = os.path.abspath(os.path.join(DOWNLOAD_DIR, safe_name))
                    if file_path.startswith(DOWNLOAD_DIR) and os.path.isfile(file_path):
                        zf.write(file_path, arcname=safe_name)
                        file_count += 1
            else:
                for entry in os.scandir(DOWNLOAD_DIR):
                    if entry.is_file() and entry.name.lower().endswith(('.mp3', '.m4a', '.webm', '.wav')):
                        zf.write(entry.path, arcname=entry.name)
                        file_count += 1

    if file_count == 0:
        return jsonify({"error": "Tidak ada file audio yang ditemukan untuk di-download."}), 404

    memory_file.seek(0)
    prefix = "youtube_mp3_selected" if target_files else "youtube_mp3_collection"
    zip_name = f"{prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return send_file(memory_file, download_name=zip_name, as_attachment=True, mimetype="application/zip")

@app.route('/api/urls-txt', methods=['GET'])
def get_urls_txt():
    if not os.path.exists(URLS_FILE):
        return jsonify({"content": "", "urls": []})
    try:
        with open(URLS_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
        urls = [line.strip() for line in content.splitlines() if line.strip() and not line.strip().startswith('#')]
        return jsonify({"content": content, "urls": urls})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/urls-txt', methods=['POST'])
def save_urls_txt():
    data = request.get_json() or {}
    content = data.get('content', '')
    try:
        with open(URLS_FILE, 'w', encoding='utf-8') as f:
            f.write(content)
        urls = [line.strip() for line in content.splitlines() if line.strip() and not line.strip().startswith('#')]
        return jsonify({"success": True, "message": "urls.txt berhasil disimpan.", "urls_count": len(urls)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/open-browser', methods=['GET', 'POST'])
def open_browser():
    data = request.get_json(silent=True) or {}
    target_url = data.get('url') or request.args.get('url') or 'https://www.youtube.com'
    browser_type = data.get('browser') or request.args.get('browser') or 'default'

    opened = False
    error = None

    try:
        import subprocess
        import webbrowser

        # Jika server berjalan langsung di host dengan DISPLAY
        if os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY'):
            if browser_type == 'chrome' and os.path.exists('/usr/bin/google-chrome'):
                subprocess.Popen(['google-chrome', target_url])
                opened = True
            elif browser_type == 'brave' and os.path.exists('/usr/bin/brave-browser'):
                subprocess.Popen(['brave-browser', target_url])
                opened = True
            elif browser_type == 'firefox' and os.path.exists('/usr/bin/firefox'):
                subprocess.Popen(['firefox', target_url])
                opened = True
            else:
                try:
                    subprocess.Popen(['xdg-open', target_url])
                    opened = True
                except Exception:
                    opened = webbrowser.open(target_url)
        else:
            # Di dalam docker atau environment tanpa display langsung
            opened = webbrowser.open(target_url)
    except Exception as e:
        error = str(e)

    return jsonify({
        "success": True,
        "url": target_url,
        "opened_on_server": opened,
        "error": error
    })

@app.route('/api/extension/download-zip', methods=['GET'])
def download_extension_zip():
    # Cari direktori ekstensi (bisa di ./extension atau ./static/extension)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ext_dir = os.path.join(base_dir, 'extension')
    if not os.path.exists(ext_dir):
        ext_dir = os.path.join(base_dir, 'static', 'extension')

    if not os.path.exists(ext_dir):
        return jsonify({"error": "Direktori extension tidak ditemukan"}), 404

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(ext_dir):
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, ext_dir)
                zf.write(file_path, arcname=rel_path)

    memory_file.seek(0)
    return send_file(
        memory_file,
        download_name='youtube-to-mp3-studio-extension.zip',
        as_attachment=True,
        mimetype='application/zip'
    )

@app.route('/extension/youtube-to-mp3-studio.user.js', methods=['GET'])
def serve_userscript():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.join(base_dir, 'static', 'extension', 'youtube-to-mp3-studio.user.js')
    if not os.path.exists(script_path):
        script_path = os.path.join(base_dir, 'extension', 'youtube-to-mp3-studio.user.js')
    if not os.path.exists(script_path):
        return jsonify({"error": "Userscript tidak ditemukan"}), 404
    return send_file(script_path, mimetype='text/javascript; charset=utf-8')

@app.route('/extension/<path:filename>', methods=['GET'])
def serve_extension_file(filename):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ext_dir = os.path.join(base_dir, 'extension')
    if not os.path.exists(ext_dir):
        ext_dir = os.path.join(base_dir, 'static', 'extension')
    return send_from_directory(ext_dir, filename)

def download_from_txt():
    """Fungsi fallback mode CLI untuk kompatibilitas lama"""
    txt_file = URLS_FILE
    output_dir = DOWNLOAD_DIR
    os.makedirs(output_dir, exist_ok=True)
    
    if not os.path.exists(txt_file):
        print(f"Error: File {txt_file} tidak ditemukan!")
        return

    with open(txt_file, 'r', encoding='utf-8') as f:
        urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]

    if not urls:
        print("File urls.txt kosong. Silakan isi dengan URL YouTube terlebih dahulu.")
        return

    print(f"Menemukan {len(urls)} URL untuk diunduh.\n")

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
        'noplaylist': True,
        'playlist_items': '1',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': False,
        'no_warnings': False,
    }

    with YoutubeDL(ydl_opts) as ydl:
        for index, url in enumerate(urls, start=1):
            print(f"[{index}/{len(urls)}] Memproses: {url}")
            try:
                ydl.download([url])
                print(f"-> Sukses!\n")
            except Exception as e:
                print(f"-> Gagal mengunduh {url}. Error: {e}\n")

    print("Semua proses selesai! Silakan cek folder 'downloads'.")

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--cli':
        download_from_txt()
    else:
        port = int(os.environ.get('PORT', 5000))
        print(f"==================================================")
        print(f"  YouTube to MP3 Web Server Running")
        print(f"  Akses di browser: http://localhost:{port}")
        print(f"==================================================")
        app.run(host='0.0.0.0', port=port, threaded=True)
