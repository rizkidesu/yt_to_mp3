// YouTube to MP3 Studio - Content Script with Active Audio Equalizer
(function() {
  'use strict';

  let DEFAULT_SERVER_URL = 'http://localhost:5000';
  let preferredQuality = '320';

  // --- Equalizer Configuration & State ---
  const EQ_BANDS = [
    { f: 60, type: 'lowshelf', label: '60Hz' },
    { f: 170, type: 'peaking', Q: 1.4, label: '170Hz' },
    { f: 350, type: 'peaking', Q: 1.4, label: '350Hz' },
    { f: 1000, type: 'peaking', Q: 1.4, label: '1kHz' },
    { f: 3500, type: 'peaking', Q: 1.4, label: '3.5kHz' },
    { f: 12000, type: 'highshelf', label: '12kHz' }
  ];

  const EQ_PRESETS = {
    custom: [0, 0, 0, 0, 0, 0],
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

  let audioCtx = null;
  let eqFilters = [];
  let eqGainNode = null;
  let isEqActive = true; // EQUALIZER AKTIF SECARA DEFAULT!
  let currentEqPreset = 'bass'; // Default preset: Bass Boost 🔊
  let currentEqGains = [6, 4.5, 2, 0, 0, -1];
  let currentVolumeBoost = 1.0;

  let playlistBehavior = 'ask'; // 'ask', 'single', 'all'

  // Load settings from storage
  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['serverUrl', 'quality', 'isEqActive', 'eqPreset', 'eqGains', 'volumeBoost', 'playlistBehavior'], function(result) {
        if (result.serverUrl) DEFAULT_SERVER_URL = result.serverUrl.replace(/\/$/, '');
        if (result.quality) preferredQuality = result.quality;
        if (result.isEqActive !== undefined) isEqActive = result.isEqActive;
        else isEqActive = true; // default aktif
        if (result.eqPreset) currentEqPreset = result.eqPreset;
        if (result.eqGains) currentEqGains = result.eqGains;
        if (result.volumeBoost) currentVolumeBoost = result.volumeBoost;
        if (result.playlistBehavior) playlistBehavior = result.playlistBehavior;
        applyEqSettings();
      });
    } else {
      try {
        const saved = localStorage.getItem('yt_to_mp3_eq_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.isEqActive !== undefined) isEqActive = parsed.isEqActive;
          if (parsed.eqPreset) currentEqPreset = parsed.eqPreset;
          if (parsed.eqGains) currentEqGains = parsed.eqGains;
          if (parsed.volumeBoost) currentVolumeBoost = parsed.volumeBoost;
          if (parsed.playlistBehavior) playlistBehavior = parsed.playlistBehavior;
        }
      } catch (e) {}
      applyEqSettings();
    }
  }

  function saveSettings() {
    const data = {
      isEqActive: isEqActive,
      eqPreset: currentEqPreset,
      eqGains: currentEqGains,
      volumeBoost: currentVolumeBoost,
      playlistBehavior: playlistBehavior
    };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(data);
    }
    try {
      localStorage.setItem('yt_to_mp3_eq_settings', JSON.stringify(data));
    } catch (e) {}
  }

  // Hook Web Audio API Equalizer into YouTube Video Element
  function hookYouTubeAudio() {
    const video = document.querySelector('video.video-stream') || document.querySelector('video');
    if (!video) return;

    if (video._ytAudioHooked) return;
    video._ytAudioHooked = true;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx) {
        audioCtx = new AudioContextClass();
      }

      const source = audioCtx.createMediaElementSource(video);
      eqGainNode = audioCtx.createGain();
      eqGainNode.gain.value = isEqActive ? currentVolumeBoost : 1.0;

      eqFilters = EQ_BANDS.map((band, idx) => {
        const filter = audioCtx.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.f;
        if (band.Q) filter.Q.value = band.Q;
        filter.gain.value = isEqActive ? currentEqGains[idx] : 0;
        return filter;
      });

      // Chain: source -> filter[0] -> ... -> filter[5] -> eqGainNode -> destination
      let prevNode = source;
      for (const f of eqFilters) {
        prevNode.connect(f);
        prevNode = f;
      }
      prevNode.connect(eqGainNode);
      eqGainNode.connect(audioCtx.destination);

      const resumeAudio = () => {
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      };

      video.addEventListener('play', resumeAudio);
      video.addEventListener('playing', resumeAudio);
      video.addEventListener('canplay', resumeAudio);
      document.addEventListener('click', resumeAudio, { once: true });

      if (!video.paused) {
        resumeAudio();
      }
      console.log('[YouTube to MP3 Studio] Equalizer Audio AKTIF & Terhubung.');
    } catch (e) {
      console.warn('[YouTube to MP3 Studio] Audio hook notice:', e);
    }
  }

  function applyEqSettings() {
    if (eqFilters && eqFilters.length === 6) {
      eqFilters.forEach((filter, idx) => {
        filter.gain.value = isEqActive ? currentEqGains[idx] : 0;
      });
    }
    if (eqGainNode) {
      eqGainNode.gain.value = isEqActive ? currentVolumeBoost : 1.0;
    }

    // Update Button Active state
    const eqBtn = document.getElementById('yt-mp3-eq-btn');
    if (eqBtn) {
      eqBtn.classList.toggle('active', isEqActive);
      const dot = eqBtn.querySelector('.yt-mp3-eq-dot');
      if (dot) dot.style.display = isEqActive ? 'inline-block' : 'none';
    }

    // Update Floating Panel UI
    updateEqPanelUI();
    saveSettings();
  }

  function updateEqPanelUI() {
    const panel = document.getElementById('yt-mp3-eq-panel');
    if (!panel) return;

    const powerSwitch = panel.querySelector('#yt-mp3-eq-power-switch');
    const powerText = panel.querySelector('#yt-mp3-eq-power-text');
    if (powerSwitch) powerSwitch.checked = isEqActive;
    if (powerText) {
      powerText.textContent = isEqActive ? 'Aktif' : 'Bypass';
      powerText.className = isEqActive ? 'yt-mp3-eq-power-status' : 'yt-mp3-eq-power-status off';
    }

    const presetSelect = panel.querySelector('#yt-mp3-eq-preset-select');
    if (presetSelect && currentEqPreset) {
      presetSelect.value = currentEqPreset;
    }

    EQ_BANDS.forEach((band, idx) => {
      const slider = panel.querySelector(`#yt-mp3-eq-slider-${idx}`);
      const valLabel = panel.querySelector(`#yt-mp3-eq-gain-${idx}`);
      if (slider) slider.value = currentEqGains[idx];
      if (valLabel) {
        const val = currentEqGains[idx];
        valLabel.textContent = (val > 0 ? '+' : '') + val + 'dB';
      }
    });

    const boostSlider = panel.querySelector('#yt-mp3-eq-boost-slider');
    const boostVal = panel.querySelector('#yt-mp3-eq-boost-val');
    if (boostSlider) boostSlider.value = currentVolumeBoost;
    if (boostVal) boostVal.textContent = `${Math.round(currentVolumeBoost * 100)}%`;
  }

  // Create or Get Equalizer Floating Panel
  function ensureEqualizerPanel() {
    let panel = document.getElementById('yt-mp3-eq-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'yt-mp3-eq-panel';
    panel.innerHTML = `
      <div class="yt-mp3-eq-header">
        <div class="yt-mp3-eq-title">
          <span>🎚️ Equalizer Audio</span>
          <span class="yt-mp3-eq-title-badge">AKTIF</span>
        </div>
        <div class="yt-mp3-eq-power-wrap">
          <span id="yt-mp3-eq-power-text" class="yt-mp3-eq-power-status">${isEqActive ? 'Aktif' : 'Bypass'}</span>
          <input type="checkbox" id="yt-mp3-eq-power-switch" class="yt-mp3-switch-input" ${isEqActive ? 'checked' : ''} title="Aktifkan/Bypass Equalizer">
          <button id="yt-mp3-eq-close-btn" class="yt-mp3-toast-close" title="Tutup">&times;</button>
        </div>
      </div>

      <div class="yt-mp3-eq-preset-row">
        <span class="yt-mp3-eq-preset-label">Preset:</span>
        <select id="yt-mp3-eq-preset-select" class="yt-mp3-eq-preset-select">
          <option value="custom" ${currentEqPreset === 'custom' ? 'selected' : ''}>🛠️ Kustom (Custom Pengguna)</option>
          <option value="flat" ${currentEqPreset === 'flat' ? 'selected' : ''}>Datar (Flat)</option>
          <option value="dangdut" ${currentEqPreset === 'dangdut' ? 'selected' : ''}>Dangdut / Kendang Mantap 🔥</option>
          <option value="bass" ${currentEqPreset === 'bass' ? 'selected' : ''}>Bass Boost 🔊</option>
          <option value="vocal" ${currentEqPreset === 'vocal' ? 'selected' : ''}>Vocal Booster 🎤</option>
          <option value="rock" ${currentEqPreset === 'rock' ? 'selected' : ''}>Rock 🎸</option>
          <option value="pop" ${currentEqPreset === 'pop' ? 'selected' : ''}>Pop 🎧</option>
          <option value="electronic" ${currentEqPreset === 'electronic' ? 'selected' : ''}>Electronic / EDM ⚡</option>
          <option value="jazz" ${currentEqPreset === 'jazz' ? 'selected' : ''}>Jazz 🎷</option>
          <option value="acoustic" ${currentEqPreset === 'acoustic' ? 'selected' : ''}>Akustik 🎶</option>
          <option value="treble" ${currentEqPreset === 'treble' ? 'selected' : ''}>Treble Boost ✨</option>
        </select>
      </div>

      <!-- Quick Custom Adjustment Buttons -->
      <div class="yt-mp3-eq-quick-btns">
        <button type="button" class="yt-mp3-eq-quick-btn" id="btn-quick-bass" title="Tambah Bass +3dB">+Bass</button>
        <button type="button" class="yt-mp3-eq-quick-btn" id="btn-quick-vocal" title="Tambah Vocal +3dB">+Vokal</button>
        <button type="button" class="yt-mp3-eq-quick-btn" id="btn-quick-treble" title="Tambah Treble +3dB">+Treble</button>
        <button type="button" class="yt-mp3-eq-quick-btn" id="btn-quick-loudness" title="Mode Loudness V-Curve">Loudness</button>
      </div>

      <div class="yt-mp3-eq-sliders">
        ${EQ_BANDS.map((band, idx) => `
          <div class="yt-mp3-eq-band-col">
            <span class="yt-mp3-eq-gain-val" id="yt-mp3-eq-gain-${idx}">${currentEqGains[idx] > 0 ? '+' : ''}${currentEqGains[idx]}dB</span>
            <input type="range" class="yt-mp3-eq-slider-v" id="yt-mp3-eq-slider-${idx}" min="-12" max="12" step="0.5" value="${currentEqGains[idx]}" orient="vertical">
            <span class="yt-mp3-eq-freq-label">${band.label}</span>
          </div>
        `).join('')}
      </div>

      <div class="yt-mp3-eq-boost-row">
        <span class="yt-mp3-eq-boost-label">
          <span>🔊 Volume Boost:</span>
          <strong id="yt-mp3-eq-boost-val" style="color: #818cf8; font-family: monospace;">${Math.round(currentVolumeBoost * 100)}%</strong>
        </span>
        <input type="range" id="yt-mp3-eq-boost-slider" class="yt-mp3-eq-boost-slider" min="1.0" max="3.0" step="0.1" value="${currentVolumeBoost}">
      </div>

      <div class="yt-mp3-eq-footer">
        <button id="yt-mp3-eq-reset-btn" class="yt-mp3-eq-btn-action">↺ Reset</button>
        <button id="yt-mp3-eq-save-btn" class="yt-mp3-eq-btn-action" style="background:#4f46e5; color:#fff; font-weight:600;">💾 Simpan Kustom</button>
        <a href="${DEFAULT_SERVER_URL}" target="_blank" class="yt-mp3-btn-open-studio" style="font-size: 11px;">🎧 Web Studio</a>
      </div>
    `;

    document.body.appendChild(panel);

    // Event listeners for Panel
    const powerSwitch = panel.querySelector('#yt-mp3-eq-power-switch');
    powerSwitch.addEventListener('change', (e) => {
      isEqActive = e.target.checked;
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      applyEqSettings();
    });

    const presetSelect = panel.querySelector('#yt-mp3-eq-preset-select');
    presetSelect.addEventListener('change', (e) => {
      const p = e.target.value;
      if (EQ_PRESETS[p]) {
        currentEqPreset = p;
        currentEqGains = [...EQ_PRESETS[p]];
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        applyEqSettings();
      }
    });

    // Quick adjustment buttons
    panel.querySelector('#btn-quick-bass').addEventListener('click', () => {
      currentEqGains[0] = Math.min(12, Math.round((currentEqGains[0] + 3) * 2) / 2);
      currentEqGains[1] = Math.min(12, Math.round((currentEqGains[1] + 2) * 2) / 2);
      currentEqPreset = 'custom';
      EQ_PRESETS.custom = [...currentEqGains];
      presetSelect.value = 'custom';
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      applyEqSettings();
    });

    panel.querySelector('#btn-quick-vocal').addEventListener('click', () => {
      currentEqGains[3] = Math.min(12, Math.round((currentEqGains[3] + 3) * 2) / 2);
      currentEqPreset = 'custom';
      EQ_PRESETS.custom = [...currentEqGains];
      presetSelect.value = 'custom';
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      applyEqSettings();
    });

    panel.querySelector('#btn-quick-treble').addEventListener('click', () => {
      currentEqGains[4] = Math.min(12, Math.round((currentEqGains[4] + 2) * 2) / 2);
      currentEqGains[5] = Math.min(12, Math.round((currentEqGains[5] + 3) * 2) / 2);
      currentEqPreset = 'custom';
      EQ_PRESETS.custom = [...currentEqGains];
      presetSelect.value = 'custom';
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      applyEqSettings();
    });

    panel.querySelector('#btn-quick-loudness').addEventListener('click', () => {
      currentEqGains = [6, 4, -1, 0, 3, 5];
      currentEqPreset = 'custom';
      EQ_PRESETS.custom = [...currentEqGains];
      presetSelect.value = 'custom';
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      applyEqSettings();
    });

    EQ_BANDS.forEach((band, idx) => {
      const slider = panel.querySelector(`#yt-mp3-eq-slider-${idx}`);
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        currentEqGains[idx] = val;
        currentEqPreset = 'custom';
        EQ_PRESETS.custom = [...currentEqGains];
        presetSelect.value = 'custom';
        const label = panel.querySelector(`#yt-mp3-eq-gain-${idx}`);
        if (label) label.textContent = (val > 0 ? '+' : '') + val + 'dB';
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        applyEqSettings();
      });
    });

    const boostSlider = panel.querySelector('#yt-mp3-eq-boost-slider');
    boostSlider.addEventListener('input', (e) => {
      currentVolumeBoost = parseFloat(e.target.value);
      const valLabel = panel.querySelector('#yt-mp3-eq-boost-val');
      if (valLabel) valLabel.textContent = `${Math.round(currentVolumeBoost * 100)}%`;
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      applyEqSettings();
    });

    panel.querySelector('#yt-mp3-eq-save-btn').addEventListener('click', () => {
      currentEqPreset = 'custom';
      EQ_PRESETS.custom = [...currentEqGains];
      saveSettings();
      showToast({
        title: 'Pengaturan Kustom',
        message: 'Equalizer kustom Anda berhasil disimpan!',
        type: 'success',
        duration: 3000,
        showStudioBtn: false
      });
    });

    panel.querySelector('#yt-mp3-eq-reset-btn').addEventListener('click', () => {
      currentEqPreset = 'flat';
      currentEqGains = [0, 0, 0, 0, 0, 0];
      currentVolumeBoost = 1.0;
      presetSelect.value = 'flat';
      boostSlider.value = 1.0;
      panel.querySelector('#yt-mp3-eq-boost-val').textContent = '100%';
      applyEqSettings();
    });

    panel.querySelector('#yt-mp3-eq-close-btn').addEventListener('click', () => {
      panel.classList.remove('open');
    });

    return panel;
  }

  const MUSIC_ICON_SVG = `
    <svg viewBox="0 0 24 24">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
    </svg>
  `;

  // Toast notifications management
  function getToastContainer() {
    let container = document.getElementById('yt-mp3-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'yt-mp3-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast({ title, message, type = 'info', progress = null, duration = 6000, showStudioBtn = true }) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = 'yt-mp3-toast';

    toast.innerHTML = `
      <div class="yt-mp3-toast-header">
        <div class="yt-mp3-toast-title ${type}">
          <span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : '🎵')}</span>
          <span>${title}</span>
        </div>
        <button class="yt-mp3-toast-close" title="Tutup">&times;</button>
      </div>
      <div class="yt-mp3-toast-body">${message}</div>
      ${progress !== null ? `
        <div class="yt-mp3-progress-bar-wrap">
          <div class="yt-mp3-progress-bar" style="width: ${progress}%"></div>
        </div>
      ` : ''}
      <div class="yt-mp3-toast-actions">
        ${showStudioBtn ? `<a href="${DEFAULT_SERVER_URL}" target="_blank" class="yt-mp3-toast-btn primary">🎧 Buka Studio</a>` : ''}
      </div>
    `;

    const closeBtn = toast.querySelector('.yt-mp3-toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));
    container.appendChild(toast);

    let autoCloseTimer = null;
    if (duration > 0) {
      autoCloseTimer = setTimeout(() => removeToast(toast), duration);
    }

    return {
      element: toast,
      update: function({ title: newTitle, message: newMsg, progress: newProg, type: newType }) {
        if (newTitle) {
          const tEl = toast.querySelector('.yt-mp3-toast-title span:last-child');
          if (tEl) tEl.textContent = newTitle;
        }
        if (newMsg) {
          const bEl = toast.querySelector('.yt-mp3-toast-body');
          if (bEl) bEl.textContent = newMsg;
        }
        if (newProg !== undefined && newProg !== null) {
          const pEl = toast.querySelector('.yt-mp3-progress-bar');
          if (pEl) pEl.style.width = `${newProg}%`;
        }
        if (newType) {
          const tEl = toast.querySelector('.yt-mp3-toast-title');
          if (tEl) {
            tEl.className = `yt-mp3-toast-title ${newType}`;
            tEl.querySelector('span:first-child').textContent = newType === 'success' ? '✅' : (newType === 'error' ? '❌' : '🎵');
          }
        }
      },
      close: function(delay = 0) {
        if (autoCloseTimer) clearTimeout(autoCloseTimer);
        if (delay > 0) {
          setTimeout(() => removeToast(toast), delay);
        } else {
          removeToast(toast);
        }
      }
    };
  }

  function removeToast(toast) {
    if (!toast || !toast.parentElement) return;
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }

  function extractYtVideoId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11})/);
    return m ? m[1] : null;
  }

  function handleDownloadRequest(url, quality) {
    const hasList = url && (url.includes('list=') || url.includes('/playlist'));
    const videoId = extractYtVideoId(url);

    // Jika URL berada di dalam playlist atau merupakan link playlist:
    if (hasList) {
      if (playlistBehavior === 'single') {
        const cleanUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
        triggerDownload(cleanUrl, quality, true);
        return;
      } else if (playlistBehavior === 'all') {
        triggerDownload(url, quality, false);
        return;
      } else {
        // Tampilkan dialog pilihan playlist
        showPlaylistConfirmDialog(url, videoId, quality);
        return;
      }
    }

    triggerDownload(url, quality, true);
  }

  function showPlaylistConfirmDialog(originalUrl, videoId, quality) {
    const oldDialog = document.getElementById('yt-mp3-playlist-dialog');
    if (oldDialog) oldDialog.remove();

    const overlay = document.createElement('div');
    overlay.id = 'yt-mp3-playlist-dialog';
    overlay.className = 'yt-mp3-playlist-dialog-overlay';

    overlay.innerHTML = `
      <div class="yt-mp3-playlist-dialog-card" onclick="event.stopPropagation()">
        <div class="yt-mp3-playlist-dialog-header">
          <span style="font-size: 22px;">🎵</span>
          <h3>Pilihan Unduhan Playlist YouTube</h3>
        </div>

        <p class="yt-mp3-playlist-dialog-desc">
          Video yang sedang Anda tonton merupakan bagian dari <strong>Playlist</strong>.
          Apakah Anda ingin mengunduh hanya 1 lagu ini saja atau seluruh playlist?
        </p>

        <div class="yt-mp3-playlist-choices">
          <div id="yt-choice-single" class="yt-mp3-choice-btn primary">
            <span class="yt-mp3-choice-icon">🎯</span>
            <div class="yt-mp3-choice-text">
              <strong>Jangan Unduh 1 Playlist Langsung (Hanya Video Ini)</strong>
              <small>Abaikan sisa playlist. Hanya unduh lagu yang sedang diputar (Rekomendasi).</small>
            </div>
          </div>

          <div id="yt-choice-all" class="yt-mp3-choice-btn secondary">
            <span class="yt-mp3-choice-icon">📑</span>
            <div class="yt-mp3-choice-text">
              <strong>Unduh Seluruh Playlist</strong>
              <small>Mengunduh semua video dalam daftar putar ini sekaligus ke server.</small>
            </div>
          </div>
        </div>

        <label class="yt-mp3-playlist-remember">
          <input type="checkbox" id="yt-chk-remember-choice" checked>
          <span>Ingat pilihan saya (jangan tanya lagi untuk link playlist)</span>
        </label>

        <div class="yt-mp3-playlist-dialog-footer">
          <button type="button" id="yt-btn-cancel-dialog" class="yt-mp3-btn-cancel">Batal</button>
        </div>
      </div>
    `;

    overlay.querySelector('#yt-choice-single').addEventListener('click', () => {
      const remember = overlay.querySelector('#yt-chk-remember-choice').checked;
      if (remember) {
        playlistBehavior = 'single';
        saveSettings();
      }
      overlay.remove();
      const cleanUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : originalUrl;
      triggerDownload(cleanUrl, quality, true);
    });

    overlay.querySelector('#yt-choice-all').addEventListener('click', () => {
      const remember = overlay.querySelector('#yt-chk-remember-choice').checked;
      if (remember) {
        playlistBehavior = 'all';
        saveSettings();
      }
      overlay.remove();
      triggerDownload(originalUrl, quality, false);
    });

    overlay.querySelector('#yt-btn-cancel-dialog').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.addEventListener('click', () => {
      overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  // Trigger Download API
  async function triggerDownload(url, quality = '320', noPlaylist = true) {
    const isSingleNotice = noPlaylist && url.includes('watch?v=');
    const activeToast = showToast({
      title: 'YouTube to MP3 Studio',
      message: isSingleNotice
        ? `Mengirim 1 video ke server (${quality} kbps)...`
        : `Mengirim tugas ke server (${quality} kbps)...`,
      type: 'info',
      progress: 5,
      duration: 0
    });

    try {
      const resp = await fetch(`${DEFAULT_SERVER_URL}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          urls: [url],
          quality: quality,
          no_playlist: noPlaylist
        })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Server HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (!data.success || !data.task_ids || data.task_ids.length === 0) {
        throw new Error(data.error || 'Gagal memulai unduhan di server.');
      }

      const taskId = data.task_ids[0];
      activeToast.update({
        title: 'Berhasil Masuk Antrean!',
        message: 'Mengunduh audio dari YouTube...',
        type: 'info',
        progress: 15
      });

      // Poll task progress
      pollTaskProgress(taskId, activeToast);

    } catch (err) {
      console.error('[YT to MP3 Studio] Error:', err);
      let errMsg = err.message || '';
      if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
        errMsg = `Tidak dapat terhubung ke ${DEFAULT_SERVER_URL}. Pastikan Docker / server aplikasi Anda sedang berjalan!`;
      }
      activeToast.update({
        title: 'Gagal Mengunduh',
        message: errMsg,
        type: 'error',
        progress: 0
      });
      activeToast.close(8000);
    }
  }

  function pollTaskProgress(taskId, activeToast) {
    let pollInterval = setInterval(async () => {
      try {
        const resp = await fetch(`${DEFAULT_SERVER_URL}/api/tasks`);
        if (!resp.ok) return;
        const data = await resp.json();
        const task = (data.tasks || []).find(t => t.id === taskId);
        
        if (!task) return;

        if (task.status === 'downloading') {
          activeToast.update({
            title: 'Sedang Mengunduh...',
            message: `${task.title ? task.title.substring(0, 35) + '...' : ''} (${task.speed || ''} ${task.eta ? 'ETA: ' + task.eta : ''})`,
            progress: Math.min(85, Math.max(15, task.progress || 20)),
            type: 'info'
          });
        } else if (task.status === 'converting') {
          activeToast.update({
            title: 'Mengekstrak MP3...',
            message: 'Mengonversi ke audio berkualitas tinggi...',
            progress: 92,
            type: 'info'
          });
        } else if (task.status === 'completed') {
          clearInterval(pollInterval);
          activeToast.update({
            title: 'Unduhan Selesai! 🎵',
            message: `File: ${task.filename || 'Lagu berhasil diunduh'} siap diputar di Studio.`,
            progress: 100,
            type: 'success'
          });
          activeToast.close(7000);
        } else if (task.status === 'error') {
          clearInterval(pollInterval);
          activeToast.update({
            title: 'Gagal Konversi',
            message: task.error || 'Terjadi kesalahan saat memproses audio.',
            progress: 0,
            type: 'error'
          });
          activeToast.close(9000);
        }
      } catch (e) {}
    }, 1500);

    setTimeout(() => clearInterval(pollInterval), 600000);
  }

  // Create Injected Button & Equalizer Pill
  function createButtonGroup() {
    const container = document.createElement('div');
    container.id = 'yt-mp3-injected-container';
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.verticalAlign = 'middle';

    const wrap = document.createElement('div');
    wrap.className = 'yt-mp3-studio-btn-wrap';

    wrap.innerHTML = `
      <button class="yt-mp3-studio-btn" id="yt-mp3-main-btn" title="Unduh Audio MP3 ke Studio">
        ${MUSIC_ICON_SVG}
        <span>Unduh MP3</span>
        <span class="yt-mp3-arrow">▼</span>
      </button>

      <div class="yt-mp3-dropdown-menu" id="yt-mp3-dropdown">
        <div class="yt-mp3-dropdown-header">Pilih Kualitas Audio</div>
        <button class="yt-mp3-quality-opt" data-quality="320">
          <span>🎵 320 kbps (Ultra HQ)</span>
          <span class="badge-rec">REKOMENDASI</span>
        </button>
        <button class="yt-mp3-quality-opt" data-quality="256">
          <span>🎧 256 kbps (HQ)</span>
        </button>
        <button class="yt-mp3-quality-opt" data-quality="192">
          <span>📻 192 kbps (Standar)</span>
        </button>
        <button class="yt-mp3-quality-opt" data-quality="128">
          <span>⚡ 128 kbps (Hemat)</span>
        </button>
        <div class="yt-mp3-dropdown-footer">
          <button id="yt-mp3-btn-open-eq-menu" class="yt-mp3-btn-open-studio" style="color: #818cf8;">
            <span>🎚️ Buka Equalizer Audio</span>
          </button>
          <a href="${DEFAULT_SERVER_URL}" target="_blank" class="yt-mp3-btn-open-studio">
            <span>🎧 Buka Web Studio</span>
          </a>
        </div>
      </div>
    `;

    const mainBtn = wrap.querySelector('#yt-mp3-main-btn');
    mainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.classList.toggle('open');
    });

    wrap.querySelectorAll('.yt-mp3-quality-opt').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        wrap.classList.remove('open');
        const q = opt.getAttribute('data-quality') || '320';
        preferredQuality = q;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ quality: q });
        }
        handleDownloadRequest(window.location.href, q);
      });
    });

    const openEqInMenu = wrap.querySelector('#yt-mp3-btn-open-eq-menu');
    if (openEqInMenu) {
      openEqInMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        wrap.classList.remove('open');
        const p = ensureEqualizerPanel();
        p.classList.toggle('open');
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      });
    }

    document.addEventListener('click', () => {
      wrap.classList.remove('open');
    });

    // Equalizer Button Pill
    const eqBtn = document.createElement('button');
    eqBtn.className = `yt-mp3-eq-btn ${isEqActive ? 'active' : ''}`;
    eqBtn.id = 'yt-mp3-eq-btn';
    eqBtn.title = 'Buka Pengaturan Equalizer Audio YouTube';
    eqBtn.innerHTML = `
      <span>🎚️ Equalizer</span>
      <span class="yt-mp3-eq-dot" style="${isEqActive ? 'display: inline-block;' : 'display: none;'}"></span>
    `;

    eqBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = ensureEqualizerPanel();
      p.classList.toggle('open');
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    });

    container.appendChild(wrap);
    container.appendChild(eqBtn);

    return container;
  }

  // Floating Action Button (FAB)
  function ensureFloatingButton() {
    let fab = document.getElementById('yt-mp3-fab-btn');
    const isVideoPage = window.location.pathname.includes('/watch') || window.location.pathname.includes('/shorts/');
    
    if (!isVideoPage) {
      if (fab) fab.style.display = 'none';
      return;
    }

    if (!fab) {
      fab = document.createElement('div');
      fab.id = 'yt-mp3-fab-btn';
      fab.className = 'yt-mp3-fab';
      fab.title = 'Unduh MP3 ke YouTube to MP3 Studio';
      fab.innerHTML = `
        ${MUSIC_ICON_SVG}
        <span>Unduh MP3</span>
      `;

      fab.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDownloadRequest(window.location.href, preferredQuality);
      });

      document.body.appendChild(fab);
    } else {
      fab.style.display = 'flex';
    }
  }

  // Inject into YouTube DOM
  function tryInject() {
    hookYouTubeAudio();

    if (!window.location.pathname.includes('/watch') && !window.location.pathname.includes('/shorts/')) {
      const existing = document.getElementById('yt-mp3-injected-container');
      if (existing) existing.remove();
      ensureFloatingButton();
      return;
    }

    ensureFloatingButton();
    ensureEqualizerPanel();

    if (document.getElementById('yt-mp3-injected-container')) {
      return; // Already injected
    }

    const targetSelectors = [
      '#above-the-fold #top-level-buttons-computed',
      '#top-level-buttons-computed',
      '#actions #actions-inner #menu ytd-menu-renderer #top-level-buttons-computed',
      '#actions #actions-inner #menu ytd-menu-renderer',
      '#owner #subscribe-button',
      '#actions #actions-inner',
      'ytd-reel-player-header-renderer'
    ];

    let targetEl = null;
    for (const sel of targetSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        targetEl = el;
        break;
      }
    }

    if (targetEl) {
      const btnGroup = createButtonGroup();
      if (targetEl.id === 'subscribe-button') {
        targetEl.parentNode.insertBefore(btnGroup, targetEl.nextSibling);
      } else {
        targetEl.appendChild(btnGroup);
      }
    }
  }

  // Observe page navigation & changes
  let observer = null;
  function initObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      tryInject();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener('yt-navigate-finish', () => {
    hookYouTubeAudio();
    setTimeout(tryInject, 300);
    setTimeout(tryInject, 1000);
  });

  window.addEventListener('spfdone', () => {
    hookYouTubeAudio();
    setTimeout(tryInject, 300);
  });

  window.addEventListener('popstate', () => {
    hookYouTubeAudio();
    setTimeout(tryInject, 300);
  });

  // Start initialization
  loadSettings();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      tryInject();
      initObserver();
    });
  } else {
    tryInject();
    initObserver();
  }

  setInterval(tryInject, 2000);

  // Runtime message listener (from background & popup)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.action === 'notify') {
        showToast({
          title: msg.title || 'YouTube to MP3 Studio',
          message: msg.message || '',
          type: msg.type || 'info',
          duration: 6000
        });
      } else if (msg && msg.action === 'get_eq') {
        sendResponse({
          isEqActive,
          currentEqPreset,
          currentEqGains,
          currentVolumeBoost
        });
      } else if (msg && msg.action === 'set_eq') {
        if (msg.isEqActive !== undefined) isEqActive = msg.isEqActive;
        if (msg.eqPreset) currentEqPreset = msg.eqPreset;
        if (msg.eqGains) currentEqGains = msg.eqGains;
        if (msg.volumeBoost !== undefined) currentVolumeBoost = msg.volumeBoost;
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        applyEqSettings();
        sendResponse({ success: true });
      }
    });
  }

})();
