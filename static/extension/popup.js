// YouTube to MP3 Studio - Extension Popup Script with Equalizer Controls
document.addEventListener('DOMContentLoaded', async () => {
  let serverUrl = 'http://localhost:5000';
  let selectedQuality = '320';
  let currentTabUrl = '';
  let activeTabId = null;

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

  let isEqActive = true;
  let eqPreset = 'bass';
  let eqGains = [6, 4.5, 2, 0, 0, -1];
  let volumeBoost = 1.0;

  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const ytDetectedBox = document.getElementById('yt-detected-box');
  const notYtBox = document.getElementById('not-yt-box');
  const videoThumb = document.getElementById('video-thumb');
  const videoTitle = document.getElementById('video-title');
  const videoUrlEl = document.getElementById('video-url');
  const btnDownloadNow = document.getElementById('btn-download-now');
  const btnOpenYouTube = document.getElementById('btn-open-youtube');
  const linkOpenStudio = document.getElementById('link-open-studio');
  const alertBox = document.getElementById('alert-box');
  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const inputServerUrl = document.getElementById('input-server-url');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const qualityBtns = document.querySelectorAll('.quality-btn');

  // Equalizer Elements
  const popupEqPower = document.getElementById('popup-eq-power');
  const popupEqStatusBadge = document.getElementById('popup-eq-status-badge');
  const popupEqPreset = document.getElementById('popup-eq-preset');
  const popupVolumeBoost = document.getElementById('popup-volume-boost');
  const popupBoostLabel = document.getElementById('popup-boost-label');
  const btnToggleCustomEq = document.getElementById('btn-toggle-custom-eq');
  const popupCustomSlidersBox = document.getElementById('popup-custom-sliders-box');
  const customEqArrow = document.getElementById('custom-eq-arrow');

  // Playlist Elements
  let popupPlaylistMode = 'single';
  const popupPlaylistBox = document.getElementById('popup-playlist-box');
  const popupOptSingle = document.getElementById('popup-opt-single');
  const popupOptAll = document.getElementById('popup-opt-all');
  const popupChkAlwaysSingle = document.getElementById('popup-chk-always-single');

  // Load saved settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const saved = await chrome.storage.local.get([
      'serverUrl', 'quality', 'isEqActive', 'eqPreset', 'eqGains', 'volumeBoost', 'alwaysSingleVideo'
    ]);
    if (saved.serverUrl) {
      serverUrl = saved.serverUrl.replace(/\/$/, '');
      inputServerUrl.value = serverUrl;
    }
    if (saved.quality) {
      selectedQuality = saved.quality;
      qualityBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.quality === selectedQuality);
      });
    }
    if (saved.isEqActive !== undefined) isEqActive = saved.isEqActive;
    if (saved.eqPreset) eqPreset = saved.eqPreset;
    if (saved.eqGains) eqGains = saved.eqGains;
    if (saved.volumeBoost) volumeBoost = saved.volumeBoost;
    if (saved.alwaysSingleVideo !== undefined && popupChkAlwaysSingle) {
      popupChkAlwaysSingle.checked = saved.alwaysSingleVideo;
    }
  }

  // Update Equalizer UI in Popup
  function updateEqPopupUI() {
    if (popupEqPower) popupEqPower.checked = isEqActive;
    if (popupEqStatusBadge) {
      popupEqStatusBadge.textContent = isEqActive ? 'AKTIF' : 'BYPASS';
      popupEqStatusBadge.className = isEqActive ? 'eq-badge' : 'eq-badge off';
    }
    if (popupEqPreset && eqPreset) popupEqPreset.value = eqPreset;
    if (popupVolumeBoost) popupVolumeBoost.value = volumeBoost;
    if (popupBoostLabel) popupBoostLabel.textContent = `${Math.round(volumeBoost * 100)}%`;

    // Update 6 custom sliders
    for (let idx = 0; idx < 6; idx++) {
      const slider = document.getElementById(`popup-band-${idx}`);
      const valLabel = document.getElementById(`popup-band-val-${idx}`);
      if (slider && eqGains[idx] !== undefined) slider.value = eqGains[idx];
      if (valLabel && eqGains[idx] !== undefined) {
        valLabel.textContent = (eqGains[idx] > 0 ? '+' : '') + eqGains[idx] + 'dB';
      }
    }
  }

  updateEqPopupUI();

  // Send Equalizer changes to active YouTube tab
  function broadcastEqState() {
    updateEqPopupUI();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        isEqActive,
        eqPreset,
        eqGains,
        volumeBoost
      });
    }

    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, {
        action: 'set_eq',
        isEqActive,
        eqPreset,
        eqGains,
        volumeBoost
      }).catch(() => {});
    }
  }

  // Toggle Custom Sliders Section
  if (btnToggleCustomEq && popupCustomSlidersBox) {
    btnToggleCustomEq.addEventListener('click', () => {
      const isOpen = popupCustomSlidersBox.style.display !== 'none';
      popupCustomSlidersBox.style.display = isOpen ? 'none' : 'flex';
      if (customEqArrow) customEqArrow.textContent = isOpen ? '▼' : '▲';
    });
  }

  // Bind 6 Custom Band Sliders
  for (let idx = 0; idx < 6; idx++) {
    const slider = document.getElementById(`popup-band-${idx}`);
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        eqGains[idx] = val;
        eqPreset = 'custom';
        EQ_PRESETS.custom = [...eqGains];
        broadcastEqState();
      });
    }
  }

  // Quick Preset Buttons in Popup
  const btnQuickBass = document.getElementById('popup-quick-bass');
  if (btnQuickBass) {
    btnQuickBass.addEventListener('click', () => {
      eqGains[0] = Math.min(12, Math.round((eqGains[0] + 3) * 2) / 2);
      eqGains[1] = Math.min(12, Math.round((eqGains[1] + 2) * 2) / 2);
      eqPreset = 'custom';
      EQ_PRESETS.custom = [...eqGains];
      broadcastEqState();
    });
  }

  const btnQuickVocal = document.getElementById('popup-quick-vocal');
  if (btnQuickVocal) {
    btnQuickVocal.addEventListener('click', () => {
      eqGains[3] = Math.min(12, Math.round((eqGains[3] + 3) * 2) / 2);
      eqPreset = 'custom';
      EQ_PRESETS.custom = [...eqGains];
      broadcastEqState();
    });
  }

  const btnQuickTreble = document.getElementById('popup-quick-treble');
  if (btnQuickTreble) {
    btnQuickTreble.addEventListener('click', () => {
      eqGains[4] = Math.min(12, Math.round((eqGains[4] + 2) * 2) / 2);
      eqGains[5] = Math.min(12, Math.round((eqGains[5] + 3) * 2) / 2);
      eqPreset = 'custom';
      EQ_PRESETS.custom = [...eqGains];
      broadcastEqState();
    });
  }

  const btnQuickReset = document.getElementById('popup-quick-reset');
  if (btnQuickReset) {
    btnQuickReset.addEventListener('click', () => {
      eqGains = [0, 0, 0, 0, 0, 0];
      eqPreset = 'flat';
      volumeBoost = 1.0;
      broadcastEqState();
    });
  }

  // Equalizer Event Listeners
  if (popupEqPower) {
    popupEqPower.addEventListener('change', (e) => {
      isEqActive = e.target.checked;
      broadcastEqState();
    });
  }

  if (popupEqPreset) {
    popupEqPreset.addEventListener('change', (e) => {
      eqPreset = e.target.value;
      if (EQ_PRESETS[eqPreset]) {
        eqGains = [...EQ_PRESETS[eqPreset]];
      }
      broadcastEqState();
    });
  }

  if (popupVolumeBoost) {
    popupVolumeBoost.addEventListener('input', (e) => {
      volumeBoost = parseFloat(e.target.value);
      if (popupBoostLabel) popupBoostLabel.textContent = `${Math.round(volumeBoost * 100)}%`;
      broadcastEqState();
    });
  }

  // Check Server Status
  async function checkServer() {
    try {
      const res = await fetch(`${serverUrl}/api/tasks`, { cache: 'no-store' });
      if (res.ok) {
        statusBadge.className = 'status-badge online';
        statusText.textContent = 'Terhubung';
        return true;
      }
    } catch (e) {}
    statusBadge.className = 'status-badge offline';
    statusText.textContent = 'Server Offline';
    return false;
  }

  checkServer();

  // Extract YouTube ID
  function extractYtId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11})/);
    return m ? m[1] : null;
  }

  // Detect Current Tab
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        const tab = tabs[0];
        activeTabId = tab.id;
        currentTabUrl = tab.url || '';
        const ytId = extractYtId(currentTabUrl);

        if (ytId || currentTabUrl.includes('youtube.com/watch') || currentTabUrl.includes('youtube.com/shorts/')) {
          ytDetectedBox.style.display = 'block';
          notYtBox.style.display = 'none';

          videoTitle.textContent = tab.title ? tab.title.replace(' - YouTube', '') : 'Video YouTube';
          videoUrlEl.textContent = currentTabUrl;
          if (ytId) {
            videoThumb.src = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
          } else {
            videoThumb.style.display = 'none';
          }

          // Check for playlist
          if (currentTabUrl.includes('list=') && popupPlaylistBox) {
            popupPlaylistBox.style.display = 'block';
            const alwaysSingle = popupChkAlwaysSingle ? popupChkAlwaysSingle.checked : true;
            popupPlaylistMode = alwaysSingle ? 'single' : 'all';
            if (popupOptSingle && popupOptAll) {
              popupOptSingle.classList.toggle('active', popupPlaylistMode === 'single');
              popupOptAll.classList.toggle('active', popupPlaylistMode === 'all');
            }
          } else if (popupPlaylistBox) {
            popupPlaylistBox.style.display = 'none';
          }

          // Query live Equalizer status from YouTube tab
          chrome.tabs.sendMessage(activeTabId, { action: 'get_eq' }, (resp) => {
            if (chrome.runtime.lastError || !resp) return;
            if (resp.isEqActive !== undefined) isEqActive = resp.isEqActive;
            if (resp.currentEqPreset) eqPreset = resp.currentEqPreset;
            if (resp.currentEqGains) eqGains = resp.currentEqGains;
            if (resp.currentVolumeBoost) volumeBoost = resp.currentVolumeBoost;
            updateEqPopupUI();
          });

        } else {
          ytDetectedBox.style.display = 'none';
          notYtBox.style.display = 'block';
        }
      }
    });
  }

  // Handle Playlist Mode Selection
  if (popupOptSingle) {
    popupOptSingle.addEventListener('click', () => {
      popupPlaylistMode = 'single';
      popupOptSingle.classList.add('active');
      if (popupOptAll) popupOptAll.classList.remove('active');
    });
  }
  if (popupOptAll) {
    popupOptAll.addEventListener('click', () => {
      popupPlaylistMode = 'all';
      popupOptAll.classList.add('active');
      if (popupOptSingle) popupOptSingle.classList.remove('active');
    });
  }

  // Handle Quality Selection
  qualityBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      qualityBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedQuality = btn.dataset.quality || '320';
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ quality: selectedQuality });
      }
    });
  });

  // Handle Download Button
  btnDownloadNow.addEventListener('click', async () => {
    if (!currentTabUrl) return;

    btnDownloadNow.disabled = true;
    btnDownloadNow.innerHTML = '<span>⏳ Mengirim unduhan...</span>';
    alertBox.className = 'alert-box';
    alertBox.style.display = 'none';

    let downloadUrl = currentTabUrl;
    let noPlaylist = true;
    const ytId = extractYtId(currentTabUrl);

    if (currentTabUrl.includes('list=')) {
      if (popupPlaylistMode === 'all') {
        noPlaylist = false;
        downloadUrl = currentTabUrl;
      } else {
        noPlaylist = true;
        if (ytId) downloadUrl = `https://www.youtube.com/watch?v=${ytId}`;
      }
    }

    try {
      const resp = await fetch(`${serverUrl}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [downloadUrl],
          quality: selectedQuality,
          no_playlist: noPlaylist
        })
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }

      alertBox.className = 'alert-box success';
      const msg = noPlaylist 
        ? '✅ <strong>Berhasil!</strong> Lagu telah ditambahkan ke antrean unduhan.'
        : `✅ <strong>Berhasil!</strong> Playlist (${data.count} tugas) telah ditambahkan ke antrean.`;
      alertBox.innerHTML = msg;
      btnDownloadNow.innerHTML = '<span>✅ Sudah Ditambahkan</span>';

      setTimeout(() => {
        btnDownloadNow.disabled = false;
        btnDownloadNow.innerHTML = '<span>📥 Unduh Lagi</span>';
      }, 3000);

    } catch (err) {
      alertBox.className = 'alert-box error';
      let msg = err.message || '';
      if (msg.includes('Failed to fetch')) {
        msg = `Gagal terhubung ke ${serverUrl}. Pastikan Docker / server sudah aktif.`;
      }
      alertBox.innerHTML = `⚠️ <strong>Gagal:</strong> ${msg}`;
      btnDownloadNow.disabled = false;
      btnDownloadNow.innerHTML = '<span>📥 Coba Lagi</span>';
    }
  });

  // Open YouTube Button
  btnOpenYouTube.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: 'https://www.youtube.com' });
    } else {
      window.open('https://www.youtube.com', '_blank');
    }
  });

  // Open Studio Link
  linkOpenStudio.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: serverUrl });
    } else {
      window.open(serverUrl, '_blank');
    }
  });

  // Toggle Settings Panel
  btnToggleSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
  });

  // Save Settings
  btnSaveSettings.addEventListener('click', async () => {
    const val = inputServerUrl.value.trim().replace(/\/$/, '');
    if (!val) return;
    serverUrl = val;
    const alwaysSingle = popupChkAlwaysSingle ? popupChkAlwaysSingle.checked : true;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ 
        serverUrl: val,
        alwaysSingleVideo: alwaysSingle,
        playlistBehavior: alwaysSingle ? 'single' : 'ask'
      });
    }
    settingsPanel.classList.remove('open');
    checkServer();
  });
});
