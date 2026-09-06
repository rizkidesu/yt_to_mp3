// YouTube to MP3 Studio - Client Application

let currentTab = 'download';
let downloadMode = 'single';
let tasksPollInterval = null;
let libraryFiles = [];
let currentPlaylist = [];
let currentTrackIndex = -1;
let isAudioPlaying = false;
let selectedLibraryFiles = new Set();

// Web Audio & Equalizer
let audioCtx = null;
let sourceNode = null;
let eqFilters = [];
let isEqEnabled = true;
let currentEqGains = [0, 0, 0, 0, 0, 0];

const EQ_BANDS = [
  { f: 60, type: 'lowshelf' },
  { f: 170, type: 'peaking', Q: 1.4 },
  { f: 350, type: 'peaking', Q: 1.4 },
  { f: 1000, type: 'peaking', Q: 1.4 },
  { f: 3500, type: 'peaking', Q: 1.4 },
  { f: 12000, type: 'highshelf' }
];

const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0, 0],
  dangdut: [7, 5, -1, 1, 4, 3],
  bass: [6, 4.5, 2, 0, 0, -1],
  vocal: [-2, -1, 3, 5, 3, 1],
  rock: [5, 3, -1, 1, 3.5, 4.5],
  pop: [2, 3, 4, 3, 2, 3],
  electronic: [6, 4, 0, 2, 4, 5],
  jazz: [3, 2, 1, 2, 2, 3],
  acoustic: [3, 2, 1, 3, 3.5, 2.5],
  treble: [-2, -1, 0, 2, 5, 7]
};

// Audio Element
const audioPlayer = document.getElementById('main-audio');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadVolumeSettings();
  loadEqualizerSettings();
  fetchTasks();
  fetchLibraryFiles();
  startTaskPolling();
  loadUrlsTxt();
});

function initEventListeners() {
  // Single input auto-fetch preview
  const singleInput = document.getElementById('single-url-input');
  let debounceTimer;
  singleInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const val = e.target.value.trim();
    if (val.startsWith('http://') || val.startsWith('https://')) {
      debounceTimer = setTimeout(() => fetchVideoInfo(val), 600);
    } else {
      document.getElementById('video-preview-card').classList.add('hidden');
    }
  });

  // Batch input counter & drag-and-drop
  const batchInput = document.getElementById('batch-urls-input');
  batchInput.addEventListener('input', updateBatchCount);
  batchInput.addEventListener('dragover', (e) => {
    e.preventDefault();
    batchInput.classList.add('ring-2', 'ring-brand-500', 'border-brand-500');
  });
  batchInput.addEventListener('dragleave', () => {
    batchInput.classList.remove('ring-2', 'ring-brand-500', 'border-brand-500');
  });
  batchInput.addEventListener('drop', (e) => {
    e.preventDefault();
    batchInput.classList.remove('ring-2', 'ring-brand-500', 'border-brand-500');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(ev) {
        batchInput.value = ev.target.result;
        updateBatchCount();
        const count = ev.target.result.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).length;
        showToast(`Berhasil memuat ${count} URL dari file ${file.name}!`, 'success');
      };
      reader.onerror = function() {
        showToast('Gagal membaca file .txt.', 'error');
      };
      reader.readAsText(file);
    }
  });

  // Audio Player Events
  audioPlayer.addEventListener('timeupdate', onAudioTimeUpdate);
  audioPlayer.addEventListener('loadedmetadata', onAudioLoadedMetadata);
  audioPlayer.addEventListener('ended', onAudioEnded);
  audioPlayer.addEventListener('play', () => {
    isAudioPlaying = true;
    updatePlayButtonUI(true);
    updateLibraryPlayingItem();
  });
  audioPlayer.addEventListener('pause', () => {
    isAudioPlaying = false;
    updatePlayButtonUI(false);
    updateLibraryPlayingItem();
  });

  // Seekbar
  const seekSlider = document.getElementById('player-seek-slider');
  seekSlider.addEventListener('input', () => {
    if (audioPlayer.duration) {
      audioPlayer.currentTime = (seekSlider.value / 100) * audioPlayer.duration;
    }
  });

  // Volume
  const volSlider = document.getElementById('player-volume-slider');
  volSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audioPlayer.volume = val;
    if (audioPlayer.muted && val > 0) {
      audioPlayer.muted = false;
    }
    updateVolumeIcon(audioPlayer.muted ? 0 : audioPlayer.volume);
    saveVolumeSettings();
  });
}

// --- Navigation & Tabs ---
function switchTab(tabName) {
  currentTab = tabName;
  const tabs = ['download', 'tasks', 'library', 'urls'];

  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const content = document.getElementById(`tab-${t}`);
    if (t === tabName) {
      btn.classList.add('active-tab');
      content.classList.remove('hidden');
      content.classList.add('block');
    } else {
      btn.classList.remove('active-tab');
      content.classList.add('hidden');
      content.classList.remove('block');
    }
  });

  if (tabName === 'tasks') fetchTasks();
  if (tabName === 'library') fetchLibraryFiles();
  if (tabName === 'urls') loadUrlsTxt();
}

// --- Download Mode Switcher ---
function setDownloadMode(mode) {
  downloadMode = mode;
  const singleBox = document.getElementById('single-download-box');
  const batchBox = document.getElementById('batch-download-box');
  const singleBtn = document.getElementById('mode-btn-single');
  const batchBtn = document.getElementById('mode-btn-batch');

  if (mode === 'single') {
    singleBox.classList.remove('hidden');
    batchBox.classList.add('hidden');
    singleBtn.className = 'flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition bg-brand-600 text-white shadow';
    batchBtn.className = 'flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition text-slate-400 hover:text-slate-200';
  } else {
    singleBox.classList.add('hidden');
    batchBox.classList.remove('hidden');
    batchBtn.className = 'flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition bg-brand-600 text-white shadow';
    singleBtn.className = 'flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition text-slate-400 hover:text-slate-200';
  }
}

// --- Video Metadata Preview ---
function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11})/);
  return match ? match[1] : null;
}

async function fetchVideoInfo(url) {
  const previewCard = document.getElementById('video-preview-card');
  const previewThumb = document.getElementById('preview-thumb');
  const previewLoader = document.getElementById('preview-thumb-loader');
  const previewTitle = document.getElementById('preview-title');
  const previewUploader = document.getElementById('preview-uploader');
  const previewDuration = document.getElementById('preview-duration');
  const previewType = document.getElementById('preview-type');

  try {
    previewTitle.textContent = 'Memeriksa video...';
    previewUploader.textContent = 'Memuat channel...';
    previewDuration.textContent = '--:--';
    previewCard.classList.remove('hidden');

    // Tampilkan thumbnail seketika dari ID YouTube tanpa menunggu backend
    const videoId = extractYouTubeId(url);
    if (videoId) {
      if (previewLoader) previewLoader.classList.remove('hidden');
      previewThumb.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    } else {
      previewThumb.classList.add('hidden');
      if (previewLoader) previewLoader.classList.remove('hidden');
    }

    const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (res.ok && (data.title || data.thumbnail)) {
      if (data.title) previewTitle.textContent = data.title;
      previewUploader.textContent = data.uploader || 'YouTube';
      if (data.thumbnail) {
        previewThumb.src = data.thumbnail;
      }
      if (data.is_playlist) {
        previewType.textContent = `Playlist (${data.count} Video)`;
        previewDuration.textContent = 'Playlist';
      } else {
        previewType.textContent = 'Video';
        previewDuration.textContent = data.duration_formatted || 'Video';
      }
    } else {
      if (!videoId) {
        previewCard.classList.add('hidden');
      }
    }
  } catch (err) {
    if (!extractYouTubeId(url)) {
      previewCard.classList.add('hidden');
    }
  }
}

// --- Clipboard Helper ---
async function pasteToSingleInput() {
  try {
    const text = await navigator.clipboard.readText();
    const input = document.getElementById('single-url-input');
    input.value = text.trim();
    input.dispatchEvent(new Event('input'));
  } catch (e) {
    showToast('Gagal membaca clipboard. Silakan tempel secara manual.', 'error');
  }
}

// --- Single Download Handler ---
async function startSingleDownload() {
  const urlInput = document.getElementById('single-url-input');
  const url = urlInput.value.trim();
  if (!url) {
    showToast('Silakan masukkan URL video YouTube terlebih dahulu.', 'warning');
    return;
  }

  const qualityRadio = document.querySelector('input[name="quality-single"]:checked');
  const quality = qualityRadio ? qualityRadio.value : '192';

  const btn = document.getElementById('btn-submit-single');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menambahkan ke Antrean...';

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url], quality })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast('Berhasil menambahkan lagu ke antrean unduhan!', 'success');
      urlInput.value = '';
      document.getElementById('video-preview-card').classList.add('hidden');
      switchTab('tasks');
      fetchTasks();
    } else {
      showToast(data.error || 'Gagal menambahkan tugas unduhan.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// --- Batch Download Handler ---
function updateBatchCount() {
  const text = document.getElementById('batch-urls-input').value;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  document.getElementById('batch-count').textContent = lines.length;
}

function clearBatchTextarea() {
  document.getElementById('batch-urls-input').value = '';
  updateBatchCount();
}

function handleTxtUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    const input = document.getElementById('batch-urls-input');
    input.value = content;
    updateBatchCount();
    const count = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).length;
    showToast(`Berhasil memuat ${count} URL dari file ${file.name}!`, 'success');
  };
  reader.onerror = function() {
    showToast('Gagal membaca file .txt.', 'error');
  };
  reader.readAsText(file);
  event.target.value = '';
}

async function importFromUrlsTxt() {
  try {
    const res = await fetch('/api/urls-txt');
    const data = await res.json();
    if (res.ok && data.urls && data.urls.length > 0) {
      document.getElementById('batch-urls-input').value = data.urls.join('\n');
      updateBatchCount();
      showToast(`Berhasil memuat ${data.urls.length} URL dari urls.txt!`, 'success');
    } else {
      showToast('File urls.txt kosong atau belum ada URL.', 'warning');
    }
  } catch (e) {
    showToast('Gagal memuat file urls.txt.', 'error');
  }
}

async function startBatchDownload() {
  const text = document.getElementById('batch-urls-input').value;
  const urls = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  if (!urls.length) {
    showToast('Tidak ada URL valid di kotak batch.', 'warning');
    return;
  }

  const quality = document.getElementById('quality-batch').value || '192';
  const btn = document.getElementById('btn-submit-batch');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menambahkan batch...';

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: urls, quality })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`Berhasil menambahkan ${data.count} lagu ke antrean!`, 'success');
      switchTab('tasks');
      fetchTasks();
    } else {
      showToast(data.error || 'Gagal memulai unduhan batch.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// --- Tasks / Queue & Polling ---
function startTaskPolling() {
  if (tasksPollInterval) clearInterval(tasksPollInterval);
  tasksPollInterval = setInterval(fetchTasks, 2500);
}

async function fetchTasks() {
  try {
    const res = await fetch('/api/tasks');
    const data = await res.json();
    if (!res.ok) return;

    const tasks = data.tasks || [];
    const activeCount = data.active_count || 0;

    // Update Header & Tab Badges
    const badge = document.getElementById('active-tasks-badge');
    if (activeCount > 0) {
      badge.textContent = activeCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    renderTasks(tasks);

    // Refresh library when any task just completed
    if (tasks.some(t => t.status === 'completed')) {
      fetchLibraryFiles();
    }
  } catch (e) {
    console.error('Error fetching tasks:', e);
  }
}

function renderTasks(tasks) {
  const container = document.getElementById('tasks-container');
  const emptyState = document.getElementById('tasks-empty-state');

  if (!tasks.length) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = tasks.map(t => {
    let badgeHtml = '';
    let progressBg = 'bg-brand-500';
    let isComplete = t.status === 'completed';
    let isError = t.status === 'error';
    let isConverting = t.status === 'converting';

    if (t.status === 'queued') {
      badgeHtml = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-700 text-slate-300 flex items-center gap-1.5"><i class="fa-regular fa-clock"></i> Dalam Antrean</span>`;
    } else if (t.status === 'downloading') {
      badgeHtml = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5"><i class="fa-solid fa-arrow-down fa-bounce"></i> Mengunduh (${t.progress}%)</span>`;
    } else if (isConverting) {
      badgeHtml = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5"><i class="fa-solid fa-gear fa-spin"></i> Konversi MP3</span>`;
      progressBg = 'bg-amber-500';
    } else if (isComplete) {
      badgeHtml = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5"><i class="fa-solid fa-check"></i> Selesai</span>`;
      progressBg = 'bg-emerald-500';
    } else if (isError) {
      badgeHtml = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5"><i class="fa-solid fa-triangle-exclamation"></i> Gagal</span>`;
      progressBg = 'bg-red-500';
    }

    const thumbHtml = t.thumbnail
      ? `<img src="${t.thumbnail}" class="w-16 h-12 rounded-lg object-cover bg-slate-800 border border-slate-700 shrink-0">`
      : `<div class="w-16 h-12 rounded-lg bg-dark-750 flex items-center justify-center text-slate-500 shrink-0 border border-slate-700"><i class="fa-solid fa-music"></i></div>`;

    const subInfo = isError
      ? `<p class="text-xs text-red-400 mt-1 truncate" title="${escapeHtml(t.error)}">${escapeHtml(t.error)}</p>`
      : `<div class="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
           ${t.speed ? `<span><i class="fa-solid fa-gauge-high mr-1 text-slate-500"></i>${t.speed}</span>` : ''}
           ${t.eta ? `<span><i class="fa-regular fa-hourglass-half mr-1 text-slate-500"></i>${t.eta}</span>` : ''}
           <span class="truncate max-w-[200px] text-slate-500">${escapeHtml(t.url)}</span>
         </div>`;

    let actionsHtml = '';
    if (isComplete && t.filename) {
      actionsHtml = `
        <div class="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-800/80">
          <button onclick="playSongDirectly('${escapeHtml(t.filename)}')" class="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition flex items-center gap-1.5">
            <i class="fa-solid fa-play"></i> Putar Lagu
          </button>
          <a href="/api/files/${encodeURIComponent(t.filename)}/download" class="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition flex items-center gap-1.5">
            <i class="fa-solid fa-download"></i> Unduh File
          </a>
        </div>`;
    }

    return `
      <div class="bg-dark-850 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            ${thumbHtml}
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h4 class="text-sm font-semibold text-slate-200 truncate" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</h4>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-dark-750 text-slate-400 font-mono">${t.quality}k</span>
              </div>
              ${subInfo}
            </div>
          </div>
          <div class="shrink-0">${badgeHtml}</div>
        </div>

        ${(!isComplete && !isError) ? `
          <div class="w-full bg-dark-900 rounded-full h-2 mt-3 overflow-hidden border border-slate-800">
            <div class="${progressBg} h-full transition-all duration-300" style="width: ${t.progress || 2}%"></div>
          </div>
        ` : ''}

        ${actionsHtml}
      </div>
    `;
  }).join('');
}

async function clearFinishedTasks() {
  try {
    const res = await fetch('/api/tasks/clear', { method: 'POST' });
    if (res.ok) {
      showToast('Riwayat tugas selesai telah dibersihkan.', 'success');
      fetchTasks();
    }
  } catch (e) {
    showToast('Gagal membersihkan tugas.', 'error');
  }
}

// --- Library (Koleksi File MP3) ---
async function fetchLibraryFiles() {
  try {
    const res = await fetch('/api/files');
    const data = await res.json();
    if (!res.ok) return;

    libraryFiles = data.files || [];
    currentPlaylist = [...libraryFiles];

    // Clean up selected items that no longer exist
    const currentNames = new Set(libraryFiles.map(f => f.name));
    for (const name of selectedLibraryFiles) {
      if (!currentNames.has(name)) {
        selectedLibraryFiles.delete(name);
      }
    }

    // Update Header stats
    document.getElementById('header-storage-size').textContent = data.total_size_formatted || '0 MB';
    document.getElementById('library-count-badge').textContent = data.total_files || 0;

    renderLibraryFiles(libraryFiles);
    updateSelectionUI();
  } catch (e) {
    console.error('Error loading library:', e);
  }
}

function filterLibraryFiles() {
  const query = document.getElementById('library-search-input').value.toLowerCase().trim();
  if (!query) {
    currentPlaylist = [...libraryFiles];
    renderLibraryFiles(libraryFiles);
    updateSelectionUI();
    return;
  }
  const filtered = libraryFiles.filter(f => f.name.toLowerCase().includes(query));
  currentPlaylist = filtered;
  renderLibraryFiles(filtered);
  updateSelectionUI();
}

function renderLibraryFiles(files) {
  const container = document.getElementById('library-container');
  const emptyState = document.getElementById('library-empty-state');
  const batchBar = document.getElementById('library-batch-actions');

  if (!files.length) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    if (batchBar) batchBar.classList.add('hidden');
    updateSelectionUI();
    return;
  }

  emptyState.classList.add('hidden');
  if (batchBar) batchBar.classList.remove('hidden');

  container.innerHTML = files.map((f, index) => {
    const isPlayingThis = (currentTrackIndex >= 0 && currentPlaylist[currentTrackIndex] && currentPlaylist[currentTrackIndex].name === f.name && isAudioPlaying);
    const isSelected = selectedLibraryFiles.has(f.name);

    let borderBgClass = 'border-slate-800 bg-dark-850';
    if (isSelected) {
      borderBgClass = 'border-brand-500/70 bg-brand-500/10';
    } else if (isPlayingThis) {
      borderBgClass = 'border-brand-500/50 bg-brand-500/5';
    }

    return `
      <div id="track-card-${index}" class="border ${borderBgClass} rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-700 transition">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <!-- Checkbox Select -->
          <div class="flex items-center pl-1 pr-0.5 shrink-0" onclick="event.stopPropagation()">
            <input type="checkbox" 
              class="library-item-cb w-4 h-4 rounded bg-dark-900 border-slate-750 text-brand-600 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer transition"
              ${isSelected ? 'checked' : ''}
              onchange="toggleSelectLibraryFile(${index}, this.checked)">
          </div>

          <!-- Play/Pause Button -->
          <button onclick="playTrackFromLibrary(${index})" class="w-10 h-10 rounded-xl ${isPlayingThis ? 'bg-brand-600 text-white' : 'bg-dark-800 text-slate-300 hover:bg-brand-600 hover:text-white'} flex items-center justify-center shrink-0 transition shadow">
            ${isPlayingThis ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play ml-0.5"></i>'}
          </button>

          <!-- Song Info -->
          <div class="min-w-0 flex-1">
            <h4 class="text-xs sm:text-sm font-semibold text-slate-200 truncate cursor-pointer hover:text-brand-400 transition" onclick="playTrackFromLibrary(${index})" title="${escapeHtml(f.name)}">
              ${escapeHtml(cleanFileName(f.name))}
            </h4>
            <div class="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
              <span><i class="fa-solid fa-weight-hanging mr-1"></i>${f.size_formatted}</span>
              <span><i class="fa-regular fa-calendar mr-1"></i>${f.mtime_formatted}</span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-1.5 shrink-0">
          <a href="${f.download_url}" download class="p-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-white transition" title="Unduh ke Perangkat">
            <i class="fa-solid fa-download text-xs"></i>
          </a>
          <button onclick="deleteFileByIndex(${index})" class="p-2 rounded-lg bg-dark-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition" title="Hapus File">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  updateSelectionUI();
}

function toggleSelectLibraryFile(index, isChecked) {
  const file = currentPlaylist[index];
  if (!file) return;
  if (isChecked) {
    selectedLibraryFiles.add(file.name);
  } else {
    selectedLibraryFiles.delete(file.name);
  }
  updateCardSelectionStyle(index, isChecked);
  updateSelectionUI();
}

function updateCardSelectionStyle(index, isSelected) {
  const card = document.getElementById(`track-card-${index}`);
  if (!card) return;
  const isPlayingThis = (currentTrackIndex >= 0 && currentPlaylist[currentTrackIndex] && currentPlaylist[currentTrackIndex].name === currentPlaylist[index]?.name && isAudioPlaying);

  if (isSelected) {
    card.className = 'border border-brand-500/70 bg-brand-500/10 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-700 transition';
  } else if (isPlayingThis) {
    card.className = 'border border-brand-500/50 bg-brand-500/5 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-700 transition';
  } else {
    card.className = 'border border-slate-800 bg-dark-850 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-700 transition';
  }
}

function toggleSelectAllLibrary(isChecked) {
  if (isChecked) {
    currentPlaylist.forEach(f => selectedLibraryFiles.add(f.name));
  } else {
    currentPlaylist.forEach(f => selectedLibraryFiles.delete(f.name));
  }
  document.querySelectorAll('.library-item-cb').forEach(cb => {
    cb.checked = isChecked;
  });
  currentPlaylist.forEach((_, idx) => {
    updateCardSelectionStyle(idx, isChecked);
  });
  updateSelectionUI();
}

function updateSelectionUI() {
  const count = selectedLibraryFiles.size;
  const countEl = document.getElementById('selected-files-count');
  const btnCountEl = document.getElementById('btn-delete-count');
  const btnDelete = document.getElementById('btn-delete-selected');
  const btnDownload = document.getElementById('btn-download-selected');
  const btnDownloadCount = document.getElementById('btn-download-count');
  const btnHeaderDownload = document.getElementById('btn-header-download-selected');
  const headerCountEl = document.getElementById('header-selected-count');
  const selectAllCb = document.getElementById('select-all-library');

  if (countEl) countEl.textContent = count;
  if (btnCountEl) btnCountEl.textContent = count;
  if (btnDownloadCount) btnDownloadCount.textContent = count;
  if (headerCountEl) headerCountEl.textContent = count;

  if (btnDelete) {
    if (count > 0) {
      btnDelete.disabled = false;
      btnDelete.className = 'px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition flex items-center gap-1.5 shadow-lg shadow-red-600/20 cursor-pointer';
    } else {
      btnDelete.disabled = true;
      btnDelete.className = 'px-3.5 py-1.5 rounded-lg bg-red-600/20 text-red-400/40 cursor-not-allowed font-medium transition flex items-center gap-1.5';
    }
  }

  if (btnDownload) {
    if (count > 0) {
      btnDownload.disabled = false;
      btnDownload.className = 'px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer';
    } else {
      btnDownload.disabled = true;
      btnDownload.className = 'px-3.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400/40 cursor-not-allowed font-medium transition flex items-center gap-1.5';
    }
  }

  if (btnHeaderDownload) {
    if (count > 0) {
      btnHeaderDownload.disabled = false;
      btnHeaderDownload.className = 'px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer';
    } else {
      btnHeaderDownload.disabled = true;
      btnHeaderDownload.className = 'px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600/20 text-emerald-400/40 cursor-not-allowed transition flex items-center gap-2 shadow';
    }
  }

  if (selectAllCb) {
    const totalVisible = currentPlaylist.length;
    if (totalVisible > 0 && count >= totalVisible) {
      const allSelected = currentPlaylist.every(f => selectedLibraryFiles.has(f.name));
      selectAllCb.checked = allSelected;
      selectAllCb.indeterminate = !allSelected && count > 0;
    } else if (count > 0) {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = true;
    } else {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = false;
    }
  }
}

async function downloadSelectedZip() {
  const count = selectedLibraryFiles.size;
  if (count === 0) {
    showToast('Pilih setidaknya satu lagu untuk diunduh sebagai ZIP.', 'info');
    return;
  }

  const btnBatch = document.getElementById('btn-download-selected');
  const btnHeader = document.getElementById('btn-header-download-selected');

  if (btnBatch) {
    btnBatch.disabled = true;
    btnBatch.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan ZIP...`;
  }
  if (btnHeader) {
    btnHeader.disabled = true;
    btnHeader.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan ZIP...`;
  }

  try {
    const filenames = Array.from(selectedLibraryFiles);
    const res = await fetch('/api/files/download-zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal menyiapkan file ZIP.');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;

    const disposition = res.headers.get('Content-Disposition');
    let filename = `youtube_mp3_selected_${count}_lagu.zip`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '');
      }
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showToast(`Berhasil mengunduh ZIP untuk ${count} lagu.`, 'success');
  } catch (err) {
    showToast(err.message || 'Terjadi kesalahan saat mengunduh ZIP.', 'error');
  } finally {
    if (btnBatch) {
      btnBatch.innerHTML = `<i class="fa-solid fa-file-zipper"></i> Download Terpilih (<span id="btn-download-count">${selectedLibraryFiles.size}</span>)`;
    }
    if (btnHeader) {
      btnHeader.innerHTML = `<i class="fa-solid fa-file-zipper"></i> Download Terpilih (<span id="header-selected-count">${selectedLibraryFiles.size}</span>) (.ZIP)`;
    }
    updateSelectionUI();
  }
}

async function deleteSelectedFiles() {
  const count = selectedLibraryFiles.size;
  if (count === 0) return;

  if (!confirm(`Hapus ${count} lagu terpilih dari server? Tindakan ini tidak dapat dibatalkan.`)) {
    return;
  }

  const btnDelete = document.getElementById('btn-delete-selected');
  const originalHtml = btnDelete.innerHTML;
  btnDelete.disabled = true;
  btnDelete.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menghapus...`;

  try {
    const filenames = Array.from(selectedLibraryFiles);
    const res = await fetch('/api/files/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      if (currentTrackIndex >= 0 && currentPlaylist[currentTrackIndex] && selectedLibraryFiles.has(currentPlaylist[currentTrackIndex].name)) {
        audioPlayer.pause();
        isAudioPlaying = false;
        updatePlayButtonUI(false);
        document.getElementById('player-track-name').textContent = 'Pilih lagu untuk diputar';
        document.getElementById('player-track-time').textContent = '00:00 / 00:00';
      }

      showToast(`Berhasil menghapus ${data.deleted_count} lagu.`, 'success');
      selectedLibraryFiles.clear();
      fetchLibraryFiles();
    } else {
      showToast(data.error || 'Gagal menghapus file terpilih.', 'error');
      btnDelete.disabled = false;
      btnDelete.innerHTML = originalHtml;
    }
  } catch (e) {
    showToast('Terjadi kesalahan saat menghapus file.', 'error');
    btnDelete.disabled = false;
    btnDelete.innerHTML = originalHtml;
  }
}

function deleteFileByIndex(index) {
  const file = currentPlaylist[index];
  if (!file) return;
  deleteFile(file.name);
}

function cleanFileName(filename) {
  return filename.replace(/\.mp3$/i, '');
}

async function deleteFile(filename) {
  if (!confirm(`Hapus file "${filename}" dari server?`)) return;

  try {
    const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      selectedLibraryFiles.delete(filename);
      if (currentTrackIndex >= 0 && currentPlaylist[currentTrackIndex] && currentPlaylist[currentTrackIndex].name === filename) {
        audioPlayer.pause();
        isAudioPlaying = false;
        updatePlayButtonUI(false);
        document.getElementById('player-track-name').textContent = 'Pilih lagu untuk diputar';
        document.getElementById('player-track-time').textContent = '00:00 / 00:00';
      }
      showToast(data.message || 'File berhasil dihapus.', 'success');
      fetchLibraryFiles();
    } else {
      showToast(data.error || 'Gagal menghapus file.', 'error');
    }
  } catch (e) {
    showToast('Terjadi kesalahan saat menghapus file.', 'error');
  }
}

// --- In-Browser Audio Player ---
function playSongDirectly(filename) {
  const idx = libraryFiles.findIndex(f => f.name === filename);
  if (idx !== -1) {
    currentPlaylist = [...libraryFiles];
    playTrackFromLibrary(idx);
  } else {
    // If not found yet in array, play via stream URL directly
    const track = { name: filename, stream_url: `/api/files/${encodeURIComponent(filename)}/stream`, download_url: `/api/files/${encodeURIComponent(filename)}/download` };
    loadAndPlayTrack(track);
  }
}

function playTrackFromLibrary(index) {
  if (index < 0 || index >= currentPlaylist.length) return;

  if (currentTrackIndex === index && !audioPlayer.paused) {
    audioPlayer.pause();
    return;
  }

  currentTrackIndex = index;
  const track = currentPlaylist[index];
  loadAndPlayTrack(track);
}

function loadAndPlayTrack(track) {
  document.getElementById('player-track-name').textContent = cleanFileName(track.name);
  document.getElementById('player-download-btn').href = track.download_url;

  initWebAudio();
  audioPlayer.src = track.stream_url;
  audioPlayer.play().catch(e => {
    console.warn('Playback error:', e);
  });
}

function togglePlayPause() {
  initWebAudio();
  if (!audioPlayer.src || audioPlayer.src === window.location.href) {
    if (libraryFiles.length > 0) {
      playTrackFromLibrary(0);
    }
    return;
  }
  if (audioPlayer.paused) {
    audioPlayer.play();
  } else {
    audioPlayer.pause();
  }
}

function playNextTrack() {
  if (!currentPlaylist.length) return;
  let nextIdx = currentTrackIndex + 1;
  if (nextIdx >= currentPlaylist.length) nextIdx = 0;
  playTrackFromLibrary(nextIdx);
}

function playPrevTrack() {
  if (!currentPlaylist.length) return;
  let prevIdx = currentTrackIndex - 1;
  if (prevIdx < 0) prevIdx = currentPlaylist.length - 1;
  playTrackFromLibrary(prevIdx);
}

function onAudioTimeUpdate() {
  const current = audioPlayer.currentTime;
  const total = audioPlayer.duration || 0;

  document.getElementById('player-current-time').textContent = formatSeconds(current);
  document.getElementById('player-total-duration').textContent = formatSeconds(total);
  document.getElementById('player-track-time').textContent = `${formatSeconds(current)} / ${formatSeconds(total)}`;

  if (total > 0) {
    document.getElementById('player-seek-slider').value = (current / total) * 100;
  }
}

function onAudioLoadedMetadata() {
  const total = audioPlayer.duration || 0;
  document.getElementById('player-total-duration').textContent = formatSeconds(total);
}

function onAudioEnded() {
  playNextTrack();
}

function toggleMute() {
  audioPlayer.muted = !audioPlayer.muted;
  updateVolumeIcon(audioPlayer.muted ? 0 : audioPlayer.volume);
  saveVolumeSettings();
}

function updateVolumeIcon(vol) {
  const icon = document.querySelector('#player-mute-btn i');
  if (vol === 0) {
    icon.className = 'fa-solid fa-volume-xmark text-red-400';
  } else if (vol < 0.5) {
    icon.className = 'fa-solid fa-volume-low text-slate-400';
  } else {
    icon.className = 'fa-solid fa-volume-high text-slate-400';
  }
}

function saveVolumeSettings() {
  try {
    localStorage.setItem('yt_mp3_volume', audioPlayer.volume.toString());
    localStorage.setItem('yt_mp3_muted', audioPlayer.muted.toString());
  } catch (e) {}
}

function loadVolumeSettings() {
  try {
    const savedVol = localStorage.getItem('yt_mp3_volume');
    const savedMuted = localStorage.getItem('yt_mp3_muted');
    const volSlider = document.getElementById('player-volume-slider');

    if (savedVol !== null) {
      const vol = parseFloat(savedVol);
      if (!isNaN(vol) && vol >= 0 && vol <= 1) {
        audioPlayer.volume = vol;
        if (volSlider) volSlider.value = vol;
      }
    }

    if (savedMuted === 'true') {
      audioPlayer.muted = true;
    } else {
      audioPlayer.muted = false;
    }

    updateVolumeIcon(audioPlayer.muted ? 0 : audioPlayer.volume);
  } catch (e) {}
}

function updatePlayButtonUI(isPlaying) {
  const btn = document.getElementById('player-play-btn');
  btn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play ml-0.5"></i>';
}

function updateLibraryPlayingItem() {
  renderLibraryFiles(currentPlaylist);
}

function formatSeconds(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// --- urls.txt Editor ---
async function loadUrlsTxt() {
  try {
    const res = await fetch('/api/urls-txt');
    const data = await res.json();
    if (res.ok) {
      document.getElementById('editor-urls-content').value = data.content || '';
    }
  } catch (e) {
    console.error('Error loading urls.txt:', e);
  }
}

async function saveUrlsTxt() {
  const content = document.getElementById('editor-urls-content').value;
  try {
    const res = await fetch('/api/urls-txt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'urls.txt berhasil disimpan.', 'success');
    } else {
      showToast(data.error || 'Gagal menyimpan file.', 'error');
    }
  } catch (e) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

async function downloadAllFromUrlsTxtEditor() {
  const content = document.getElementById('editor-urls-content').value;
  const urls = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  if (!urls.length) {
    showToast('Tidak ada URL valid untuk diunduh.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, quality: '192' })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Memulai unduhan untuk ${data.count} lagu!`, 'success');
      switchTab('tasks');
      fetchTasks();
    } else {
      showToast(data.error || 'Gagal memulai unduhan.', 'error');
    }
  } catch (e) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

// --- Toast Notifications ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-medium text-white transition-all transform duration-300 translate-y-2 opacity-0';

  let icon = 'fa-info-circle';
  let bg = 'bg-dark-800 border border-slate-700';

  if (type === 'success') {
    bg = 'bg-emerald-600 border border-emerald-500';
    icon = 'fa-circle-check';
  } else if (type === 'error') {
    bg = 'bg-brand-600 border border-brand-500';
    icon = 'fa-circle-exclamation';
  } else if (type === 'warning') {
    bg = 'bg-amber-600 border border-amber-500';
    icon = 'fa-triangle-exclamation';
  }

  toast.className += ` ${bg}`;
  toast.innerHTML = `<i class="fa-solid ${icon} text-sm"></i> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Equalizer & Web Audio API ---
function initWebAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  try {
    audioCtx = new AudioContext();
    sourceNode = audioCtx.createMediaElementSource(audioPlayer);

    eqFilters = EQ_BANDS.map((band, idx) => {
      const filter = audioCtx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.f;
      if (band.Q) filter.Q.value = band.Q;
      filter.gain.value = isEqEnabled ? currentEqGains[idx] : 0;
      return filter;
    });

    let prevNode = sourceNode;
    eqFilters.forEach(filter => {
      prevNode.connect(filter);
      prevNode = filter;
    });
    prevNode.connect(audioCtx.destination);
  } catch (err) {
    console.warn('Web Audio initialization error:', err);
  }
}

function toggleEqualizerModal() {
  initWebAudio();
  const modal = document.getElementById('equalizer-modal');
  if (!modal) return;
  modal.classList.toggle('hidden');
}

function closeEqualizerModal() {
  const modal = document.getElementById('equalizer-modal');
  if (modal) modal.classList.add('hidden');
}

function toggleEqualizerPower(enabled) {
  initWebAudio();
  isEqEnabled = enabled;

  const statusEl = document.getElementById('eq-power-status');
  const badgeEl = document.getElementById('eq-active-badge');
  const btnEq = document.getElementById('player-eq-btn');

  if (statusEl) {
    statusEl.textContent = enabled ? 'ON' : 'BYPASS';
    statusEl.className = enabled ? 'ml-2 text-xs font-semibold text-brand-400' : 'ml-2 text-xs font-semibold text-slate-500';
  }

  if (badgeEl) {
    if (enabled) {
      badgeEl.textContent = 'Aktif';
      badgeEl.className = 'text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-semibold border border-brand-500/30';
    } else {
      badgeEl.textContent = 'Bypass';
      badgeEl.className = 'text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold border border-slate-700';
    }
  }

  if (btnEq) {
    if (enabled) {
      btnEq.classList.add('text-brand-400', 'border-brand-500/40');
      btnEq.classList.remove('text-slate-400', 'border-slate-700');
    } else {
      btnEq.classList.remove('text-brand-400', 'border-brand-500/40');
      btnEq.classList.add('text-slate-400', 'border-slate-700');
    }
  }

  if (eqFilters && eqFilters.length) {
    eqFilters.forEach((filter, idx) => {
      filter.gain.value = enabled ? currentEqGains[idx] : 0;
    });
  }

  saveEqualizerSettings();
}

function onEqSliderChange(bandIndex, val) {
  initWebAudio();
  const numVal = parseFloat(val);
  currentEqGains[bandIndex] = numVal;

  const readout = document.getElementById(`gain-val-${bandIndex}`);
  if (readout) {
    readout.textContent = (numVal > 0 ? `+${numVal}` : `${numVal}`) + 'dB';
    readout.className = numVal === 0 ? 'text-[10px] font-mono text-slate-400' : 'text-[10px] font-mono text-brand-400 font-bold';
  }

  if (eqFilters[bandIndex] && isEqEnabled) {
    eqFilters[bandIndex].gain.value = numVal;
  }

  const presetSelect = document.getElementById('eq-preset-select');
  if (presetSelect) presetSelect.value = 'custom';

  saveEqualizerSettings('custom');
}

function applyEqualizerPreset(presetName) {
  initWebAudio();
  const gains = EQ_PRESETS[presetName];
  if (!gains) return;

  currentEqGains = [...gains];

  currentEqGains.forEach((g, idx) => {
    const slider = document.getElementById(`eq-slider-${idx}`);
    if (slider) slider.value = g;

    const readout = document.getElementById(`gain-val-${idx}`);
    if (readout) {
      readout.textContent = (g > 0 ? `+${g}` : `${g}`) + 'dB';
      readout.className = g === 0 ? 'text-[10px] font-mono text-slate-400' : 'text-[10px] font-mono text-brand-400 font-bold';
    }

    if (eqFilters[idx] && isEqEnabled) {
      eqFilters[idx].gain.value = g;
    }
  });

  saveEqualizerSettings(presetName);
}

function resetEqualizer() {
  const presetSelect = document.getElementById('eq-preset-select');
  if (presetSelect) presetSelect.value = 'flat';
  applyEqualizerPreset('flat');
  showToast('Equalizer diatur kembali ke Datar (Flat).', 'info');
}

function saveEqualizerSettings(preset = null) {
  try {
    const presetSelect = document.getElementById('eq-preset-select');
    const settings = {
      enabled: isEqEnabled,
      preset: preset || (presetSelect ? presetSelect.value : 'flat'),
      gains: currentEqGains
    };
    localStorage.setItem('yt_mp3_equalizer', JSON.stringify(settings));
  } catch (e) {}
}

function loadEqualizerSettings() {
  try {
    const saved = localStorage.getItem('yt_mp3_equalizer');
    if (!saved) return;
    const settings = JSON.parse(saved);

    // 1. Pulihkan nilai gain per band terlebih dahulu
    if (Array.isArray(settings.gains) && settings.gains.length === 6) {
      currentEqGains = settings.gains.map(g => Number(g) || 0);
      currentEqGains.forEach((g, idx) => {
        const slider = document.getElementById(`eq-slider-${idx}`);
        if (slider) slider.value = g;
        const readout = document.getElementById(`gain-val-${idx}`);
        if (readout) {
          readout.textContent = (g > 0 ? `+${g}` : `${g}`) + 'dB';
          readout.className = g === 0 ? 'text-[10px] font-mono text-slate-400' : 'text-[10px] font-mono text-brand-400 font-bold';
        }
      });
    }

    // 2. Pulihkan pilihan preset
    if (settings.preset) {
      const presetSelect = document.getElementById('eq-preset-select');
      if (presetSelect) presetSelect.value = settings.preset;
    }

    // 3. Pulihkan status ON / Bypass tanpa menimpa localStorage
    if (typeof settings.enabled === 'boolean') {
      isEqEnabled = settings.enabled;
      const toggle = document.getElementById('eq-power-toggle');
      if (toggle) toggle.checked = isEqEnabled;

      const statusEl = document.getElementById('eq-power-status');
      if (statusEl) {
        statusEl.textContent = isEqEnabled ? 'ON' : 'BYPASS';
        statusEl.className = isEqEnabled ? 'ml-2 text-xs font-semibold text-brand-400' : 'ml-2 text-xs font-semibold text-slate-500';
      }

      const badgeEl = document.getElementById('eq-active-badge');
      if (badgeEl) {
        if (isEqEnabled) {
          badgeEl.textContent = 'Aktif';
          badgeEl.className = 'text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-semibold border border-brand-500/30';
        } else {
          badgeEl.textContent = 'Bypass';
          badgeEl.className = 'text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold border border-slate-700';
        }
      }

      const btnEq = document.getElementById('player-eq-btn');
      if (btnEq) {
        if (isEqEnabled) {
          btnEq.classList.add('text-brand-400', 'border-brand-500/40');
          btnEq.classList.remove('text-slate-400', 'border-slate-700');
        } else {
          btnEq.classList.remove('text-brand-400', 'border-brand-500/40');
          btnEq.classList.add('text-slate-400', 'border-slate-700');
        }
      }
    }

    // 4. Jika filter audio sudah aktif, terapkan gain yang dipulihkan
    if (eqFilters && eqFilters.length) {
      eqFilters.forEach((filter, idx) => {
        filter.gain.value = isEqEnabled ? currentEqGains[idx] : 0;
      });
    }
  } catch (e) {
    console.error('Error loading equalizer settings:', e);
  }
}
