// ==UserScript==
// @name         YouTube to MP3 Studio Downloader & Audio Equalizer
// @namespace    http://localhost:5000/
// @version      1.1.0
// @description  Unduh MP3 berkualitas tinggi dan Equalizer Audio 6-Band Aktif langsung di bawah video YouTube
// @author       YouTube to MP3 Studio
// @match        *://*.youtube.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-idle
// @icon         http://localhost:5000/static/extension/icons/icon48.png
// ==/UserScript==

(function() {
  'use strict';

  const SERVER_URL = 'http://localhost:5000';
  let preferredQuality = (typeof GM_getValue !== 'undefined') ? (GM_getValue('quality', '320')) : '320';
  let playlistBehavior = (typeof GM_getValue !== 'undefined') ? (GM_getValue('playlistBehavior', 'ask')) : 'ask';

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
  let currentEqPreset = 'bass'; // Bass Boost default
  let currentEqGains = [6, 4.5, 2, 0, 0, -1];
  let currentVolumeBoost = 1.0;

  // Load saved EQ settings
  if (typeof GM_getValue !== 'undefined') {
    isEqActive = GM_getValue('isEqActive', true);
    currentEqPreset = GM_getValue('eqPreset', 'bass');
    const savedGains = GM_getValue('eqGains', null);
    if (savedGains) {
      try { currentEqGains = JSON.parse(savedGains); } catch(e) {}
    }
    currentVolumeBoost = GM_getValue('volumeBoost', 1.0);
  }

  function saveEqSettings() {
    if (typeof GM_setValue !== 'undefined') {
      GM_setValue('isEqActive', isEqActive);
      GM_setValue('eqPreset', currentEqPreset);
      GM_setValue('eqGains', JSON.stringify(currentEqGains));
      GM_setValue('volumeBoost', currentVolumeBoost);
    }
  }

  // Inject CSS Styles
  const style = document.createElement('style');
  style.textContent = `
    .yt-mp3-studio-btn-wrap {
      display: inline-flex;
      align-items: center;
      position: relative;
      margin-left: 8px;
      vertical-align: middle;
      font-family: "Roboto", "Segoe UI", Arial, sans-serif;
      z-index: 99;
    }
    .yt-mp3-studio-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
      color: #ffffff !important;
      font-size: 13px;
      font-weight: 600;
      line-height: 1;
      padding: 0 16px;
      height: 36px;
      border-radius: 18px;
      border: none;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.35);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none;
      user-select: none;
    }
    .yt-mp3-studio-btn:hover {
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.5);
      transform: translateY(-1px);
    }
    .yt-mp3-studio-btn svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
    .yt-mp3-studio-btn .yt-mp3-arrow {
      margin-left: 2px;
      font-size: 10px;
      transition: transform 0.2s ease;
    }
    .yt-mp3-studio-btn-wrap.open .yt-mp3-arrow {
      transform: rotate(180deg);
    }
    .yt-mp3-dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      min-width: 220px;
      background: #1e2430;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
      padding: 8px;
      display: none;
      flex-direction: column;
      gap: 4px;
      z-index: 99999;
      backdrop-filter: blur(12px);
    }
    .yt-mp3-studio-btn-wrap.open .yt-mp3-dropdown-menu {
      display: flex;
    }
    .yt-mp3-dropdown-header {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      padding: 4px 8px 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 4px;
    }
    .yt-mp3-quality-opt {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      border-radius: 8px;
      color: #f1f5f9;
      font-size: 12.5px;
      cursor: pointer;
      background: transparent;
      border: none;
      width: 100%;
      text-align: left;
    }
    .yt-mp3-quality-opt:hover {
      background: rgba(239, 68, 68, 0.15);
      color: #ffffff;
    }
    .yt-mp3-quality-opt .badge-rec {
      background: #ef4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .yt-mp3-dropdown-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      margin-top: 4px;
      padding-top: 6px;
    }
    .yt-mp3-btn-open-studio {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 6px 10px;
      border-radius: 8px;
      color: #38bdf8;
      font-size: 12px;
      text-decoration: none;
      cursor: pointer;
      background: transparent;
      border: none;
    }
    .yt-mp3-btn-open-studio:hover {
      background: rgba(56, 189, 248, 0.12);
    }
    .yt-mp3-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99998;
      display: flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 28px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(239, 68, 68, 0.4);
      font-family: "Roboto", "Segoe UI", Arial, sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .yt-mp3-fab svg { width: 18px; height: 18px; fill: currentColor; }

    /* EQUALIZER STYLES */
    .yt-mp3-eq-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #27272a;
      color: #f4f4f5 !important;
      font-size: 13px;
      font-weight: 600;
      line-height: 1;
      padding: 0 14px;
      height: 36px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      cursor: pointer;
      margin-left: 6px;
      transition: all 0.2s ease;
      user-select: none;
      vertical-align: middle;
    }
    .yt-mp3-eq-btn:hover {
      background: #3f3f46;
      transform: translateY(-1px);
    }
    .yt-mp3-eq-btn.active {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff !important;
      border-color: #818cf8;
      box-shadow: 0 2px 10px rgba(99, 102, 241, 0.4);
    }
    .yt-mp3-eq-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
      display: inline-block;
    }
    #yt-mp3-eq-panel {
      position: fixed;
      bottom: 80px;
      right: 24px;
      width: 360px;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85), 0 0 25px rgba(99, 102, 241, 0.25);
      padding: 16px;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 999999;
      display: none;
      flex-direction: column;
      gap: 12px;
      backdrop-filter: blur(16px);
    }
    #yt-mp3-eq-panel.open { display: flex; }
    .yt-mp3-eq-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 10px;
    }
    .yt-mp3-eq-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 13.5px;
      color: #fff;
    }
    .yt-mp3-eq-title-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: #4f46e5;
      color: #fff;
    }
    .yt-mp3-eq-power-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .yt-mp3-eq-power-status {
      font-size: 11px;
      font-weight: 600;
      color: #10b981;
    }
    .yt-mp3-eq-power-status.off { color: #94a3b8; }
    .yt-mp3-switch-input {
      position: relative;
      width: 34px;
      height: 18px;
      appearance: none;
      -webkit-appearance: none;
      background: #334155;
      outline: none;
      border-radius: 18px;
      transition: 0.2s;
      cursor: pointer;
      margin: 0;
    }
    .yt-mp3-switch-input:checked { background: #10b981; }
    .yt-mp3-switch-input:before {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      top: 2px;
      left: 2px;
      background: #fff;
      transition: 0.2s;
    }
    .yt-mp3-switch-input:checked:before { left: 16px; }
    .yt-mp3-eq-preset-row { display: flex; align-items: center; gap: 8px; }
    .yt-mp3-eq-preset-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
    .yt-mp3-eq-preset-select {
      flex: 1;
      background: #1e293b;
      border: 1px solid #334155;
      color: #f1f5f9;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 12px;
      outline: none;
      cursor: pointer;
    }
    .yt-mp3-eq-sliders {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 6px;
      padding: 12px 6px;
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 12px;
    }
    .yt-mp3-eq-band-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .yt-mp3-eq-gain-val {
      font-size: 10px;
      font-weight: 700;
      color: #38bdf8;
      min-height: 14px;
    }
    .yt-mp3-eq-slider-v {
      -webkit-appearance: slider-vertical;
      writing-mode: bt-lr;
      width: 16px;
      height: 95px;
      cursor: pointer;
      accent-color: #6366f1;
    }
    .yt-mp3-eq-freq-label {
      font-size: 9.5px;
      color: #94a3b8;
      font-weight: 600;
      margin-top: 2px;
    }
    .yt-mp3-eq-boost-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 6px 0;
      border-top: 1px solid #1e293b;
    }
    .yt-mp3-eq-boost-label {
      font-size: 11px;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
    }
    .yt-mp3-eq-boost-slider {
      flex: 1;
      accent-color: #6366f1;
      cursor: pointer;
    }
    .yt-mp3-eq-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border-top: 1px solid #1e293b;
      padding-top: 8px;
    }
    .yt-mp3-eq-btn-action {
      font-size: 11px;
      padding: 5px 12px;
      border-radius: 6px;
      cursor: pointer;
      border: none;
      background: #1e293b;
      color: #cbd5e1;
      transition: all 0.15s;
    }
    .yt-mp3-eq-btn-action:hover { background: #334155; color: #fff; }

    /* TOAST STYLES */
    #yt-mp3-toast-container {
      position: fixed;
      bottom: 80px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      font-family: "Roboto", "Segoe UI", Arial, sans-serif;
    }
    .yt-mp3-toast {
      pointer-events: auto;
      min-width: 290px;
      max-width: 380px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
      padding: 12px 14px;
      color: #f3f4f6;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .yt-mp3-toast-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .yt-mp3-toast-title { font-weight: 600; }
    .yt-mp3-toast-title.success { color: #34d399; }
    .yt-mp3-toast-title.error { color: #f87171; }
    .yt-mp3-toast-close { background: transparent; border: none; color: #9ca3af; cursor: pointer; }
    .yt-mp3-toast-body { font-size: 12px; color: #cbd5e1; }
    .yt-mp3-progress-bar-wrap { width: 100%; height: 5px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden; }
    .yt-mp3-progress-bar { height: 100%; width: 0%; background: linear-gradient(90deg, #ef4444, #f97316); transition: width 0.3s; }
    .yt-mp3-toast-actions { display: flex; justify-content: flex-end; margin-top: 2px; }
    .yt-mp3-toast-btn { font-size: 11.5px; font-weight: 600; padding: 5px 12px; border-radius: 6px; cursor: pointer; text-decoration: none; border: none; background: #ef4444; color: #fff; }

    /* Playlist Confirmation Dialog */
    .yt-mp3-playlist-dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: ytMp3FadeIn 0.2s ease-out;
    }
    .yt-mp3-playlist-dialog-card {
      width: 440px;
      max-width: 90vw;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 22px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.15);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .yt-mp3-playlist-dialog-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .yt-mp3-playlist-dialog-header h3 {
      font-size: 15px;
      font-weight: 700;
      color: #f8fafc;
      margin: 0;
    }
    .yt-mp3-playlist-dialog-desc {
      font-size: 12.5px;
      color: #94a3b8;
      line-height: 1.45;
      margin: 0;
    }
    .yt-mp3-playlist-dialog-desc strong {
      color: #fbbf24;
    }
    .yt-mp3-playlist-choices {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 4px 0;
    }
    .yt-mp3-choice-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 12px;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease;
      border: 1px solid transparent;
    }
    .yt-mp3-choice-btn.primary {
      background: #1e293b;
      border-color: #3b82f6;
      color: #f8fafc;
    }
    .yt-mp3-choice-btn.primary:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: #60a5fa;
      transform: translateY(-1px);
    }
    .yt-mp3-choice-btn.secondary {
      background: #1e293b;
      border-color: #334155;
      color: #cbd5e1;
    }
    .yt-mp3-choice-btn.secondary:hover {
      background: rgba(245, 158, 11, 0.15);
      border-color: #f59e0b;
      color: #f8fafc;
      transform: translateY(-1px);
    }
    .yt-mp3-choice-icon {
      font-size: 20px;
      flex-shrink: 0;
    }
    .yt-mp3-choice-text {
      flex: 1;
    }
    .yt-mp3-choice-text strong {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .yt-mp3-choice-text small {
      display: block;
      font-size: 11px;
      color: #94a3b8;
    }
    .yt-mp3-playlist-remember {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11.5px;
      color: #cbd5e1;
      cursor: pointer;
      user-select: none;
      padding-top: 4px;
      border-top: 1px solid #1e293b;
    }
    .yt-mp3-playlist-remember input {
      cursor: pointer;
      accent-color: #ef4444;
      width: 15px;
      height: 15px;
    }
    .yt-mp3-playlist-dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 2px;
    }
    .yt-mp3-btn-cancel {
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .yt-mp3-btn-cancel:hover {
      background: #334155;
      color: #fff;
    }
  `;
  document.head.appendChild(style);

  // Hook Web Audio API to YouTube Video
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
      console.log('[YouTube Userscript] Equalizer Audio AKTIF.');
    } catch(e) {
      console.warn('[YouTube Userscript] Audio hook notice:', e);
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

    const eqBtn = document.getElementById('yt-mp3-eq-btn');
    if (eqBtn) {
      eqBtn.classList.toggle('active', isEqActive);
      const dot = eqBtn.querySelector('.yt-mp3-eq-dot');
      if (dot) dot.style.display = isEqActive ? 'inline-block' : 'none';
    }

    updateEqPanelUI();
    saveEqSettings();
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
          <input type="checkbox" id="yt-mp3-eq-power-switch" class="yt-mp3-switch-input" ${isEqActive ? 'checked' : ''}>
          <button id="yt-mp3-eq-close-btn" class="yt-mp3-toast-close" title="Tutup">&times;</button>
        </div>
      </div>

      <div class="yt-mp3-eq-preset-row">
        <span class="yt-mp3-eq-preset-label">Preset:</span>
        <select id="yt-mp3-eq-preset-select" class="yt-mp3-eq-preset-select">
          <option value="custom" ${currentEqPreset === 'custom' ? 'selected' : ''}>🛠️ Kustom (Custom Pengguna)</option>
          <option value="flat">Datar (Flat)</option>
          <option value="dangdut">Dangdut / Kendang Mantap 🔥</option>
          <option value="bass" ${currentEqPreset === 'bass' ? 'selected' : ''}>Bass Boost 🔊</option>
          <option value="vocal">Vocal Booster 🎤</option>
          <option value="rock">Rock 🎸</option>
          <option value="pop">Pop 🎧</option>
          <option value="electronic">Electronic / EDM ⚡</option>
          <option value="jazz">Jazz 🎷</option>
          <option value="acoustic">Akustik 🎶</option>
          <option value="treble">Treble Boost ✨</option>
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
        <a href="${SERVER_URL}" target="_blank" class="yt-mp3-btn-open-studio" style="font-size: 11px;">🎧 Buka Web Studio</a>
      </div>
    `;

    document.body.appendChild(panel);

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
      saveEqSettings();
      showToast({
        title: 'Pengaturan Kustom',
        message: 'Equalizer kustom berhasil disimpan!',
        type: 'success',
        duration: 3000
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

  function getToastContainer() {
    let el = document.getElementById('yt-mp3-toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'yt-mp3-toast-container';
      document.body.appendChild(el);
    }
    return el;
  }

  function showToast({ title, message, type = 'info', progress = null, duration = 6000 }) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = 'yt-mp3-toast';
    toast.innerHTML = `
      <div class="yt-mp3-toast-header">
        <div class="yt-mp3-toast-title ${type}">
          <span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : '🎵')}</span>
          <span>${title}</span>
        </div>
        <button class="yt-mp3-toast-close">&times;</button>
      </div>
      <div class="yt-mp3-toast-body">${message}</div>
      ${progress !== null ? `
        <div class="yt-mp3-progress-bar-wrap">
          <div class="yt-mp3-progress-bar" style="width: ${progress}%"></div>
        </div>
      ` : ''}
      <div class="yt-mp3-toast-actions">
        <a href="${SERVER_URL}" target="_blank" class="yt-mp3-toast-btn">🎧 Buka Studio</a>
      </div>
    `;

    toast.querySelector('.yt-mp3-toast-close').addEventListener('click', () => toast.remove());
    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => toast.remove(), duration);
    }

    return {
      update: ({ title: t, message: m, progress: p, type: ty }) => {
        if (t) toast.querySelector('.yt-mp3-toast-title span:last-child').textContent = t;
        if (m) toast.querySelector('.yt-mp3-toast-body').textContent = m;
        if (p !== undefined && p !== null) {
          const pb = toast.querySelector('.yt-mp3-progress-bar');
          if (pb) pb.style.width = `${p}%`;
        }
        if (ty) toast.querySelector('.yt-mp3-toast-title').className = `yt-mp3-toast-title ${ty}`;
      },
      close: (delay = 0) => setTimeout(() => toast.remove(), delay)
    };
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
              <small>Hanya unduh lagu yang sedang diputar (Rekomendasi). Cepat & bebas antrean panjang.</small>
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
        if (typeof GM_setValue !== 'undefined') GM_setValue('playlistBehavior', 'single');
      }
      overlay.remove();
      const cleanUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : originalUrl;
      triggerDownload(cleanUrl, quality, true);
    });

    overlay.querySelector('#yt-choice-all').addEventListener('click', () => {
      const remember = overlay.querySelector('#yt-chk-remember-choice').checked;
      if (remember) {
        playlistBehavior = 'all';
        if (typeof GM_setValue !== 'undefined') GM_setValue('playlistBehavior', 'all');
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

  async function triggerDownload(url, quality = '320', noPlaylist = true) {
    const isSingleNotice = noPlaylist && url.includes('watch?v=');
    const activeToast = showToast({
      title: 'YouTube to MP3 Studio',
      message: isSingleNotice
        ? `Mengirim 1 video ke server (${quality} kbps)...`
        : `Mengirim tugas ke server (${quality} kbps)...`,
      type: 'info',
      progress: 10,
      duration: 0
    });

    try {
      const payload = JSON.stringify({ urls: [url], quality: quality, no_playlist: noPlaylist });
      let data;

      if (typeof GM_xmlhttpRequest !== 'undefined') {
        data = await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: 'POST',
            url: `${SERVER_URL}/api/download`,
            headers: { 'Content-Type': 'application/json' },
            data: payload,
            onload: (res) => {
              try {
                const json = JSON.parse(res.responseText);
                if (res.status >= 200 && res.status < 300 && json.success) resolve(json);
                else reject(new Error(json.error || `HTTP ${res.status}`));
              } catch(e) { reject(e); }
            },
            onerror: reject
          });
        });
      } else {
        const resp = await fetch(`${SERVER_URL}/api/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });
        data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.error || `HTTP ${resp.status}`);
      }

      const taskId = data.task_ids[0];
      activeToast.update({
        title: 'Berhasil Masuk Antrean!',
        message: 'Mengunduh audio dari YouTube...',
        progress: 25,
        type: 'info'
      });

      // Poll progress
      let interval = setInterval(async () => {
        try {
          let tasksData;
          if (typeof GM_xmlhttpRequest !== 'undefined') {
            tasksData = await new Promise((resolve) => {
              GM_xmlhttpRequest({
                method: 'GET',
                url: `${SERVER_URL}/api/tasks`,
                onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch(e){ resolve({}); } }
              });
            });
          } else {
            const r = await fetch(`${SERVER_URL}/api/tasks`);
            tasksData = await r.json();
          }

          const t = (tasksData.tasks || []).find(item => item.id === taskId);
          if (!t) return;

          if (t.status === 'downloading') {
            activeToast.update({
              title: 'Sedang Mengunduh...',
              message: `${t.title ? t.title.substring(0, 35) + '...' : ''} (${t.speed || ''})`,
              progress: Math.min(85, Math.max(25, t.progress || 25))
            });
          } else if (t.status === 'converting') {
            activeToast.update({
              title: 'Mengekstrak MP3...',
              message: 'Mengonversi ke audio HQ (FFmpeg)...',
              progress: 92
            });
          } else if (t.status === 'completed') {
            clearInterval(interval);
            activeToast.update({
              title: 'Unduhan Selesai! 🎵',
              message: `File '${t.filename}' siap diputar di Studio.`,
              progress: 100,
              type: 'success'
            });
            activeToast.close(6000);
          } else if (t.status === 'error') {
            clearInterval(interval);
            activeToast.update({
              title: 'Gagal',
              message: t.error || 'Terjadi kesalahan.',
              type: 'error'
            });
            activeToast.close(8000);
          }
        } catch(e) {}
      }, 1500);

      setTimeout(() => clearInterval(interval), 300000);

    } catch (err) {
      activeToast.update({
        title: 'Gagal Terhubung',
        message: `Tidak dapat terhubung ke ${SERVER_URL}. Pastikan server Docker/apps.py aktif!`,
        type: 'error'
      });
      activeToast.close(8000);
    }
  }

  function createButtonGroup() {
    const container = document.createElement('div');
    container.id = 'yt-mp3-injected-container';
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.verticalAlign = 'middle';

    const wrap = document.createElement('div');
    wrap.className = 'yt-mp3-studio-btn-wrap';
    wrap.innerHTML = `
      <button class="yt-mp3-studio-btn" id="yt-mp3-main-btn" title="Unduh MP3">
        ${MUSIC_ICON_SVG}
        <span>Unduh MP3</span>
        <span class="yt-mp3-arrow">▼</span>
      </button>
      <div class="yt-mp3-dropdown-menu">
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
          <a href="${SERVER_URL}" target="_blank" class="yt-mp3-btn-open-studio">
            <span>🎧 Buka Web Studio</span>
          </a>
        </div>
      </div>
    `;

    wrap.querySelector('#yt-mp3-main-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.classList.toggle('open');
    });

    wrap.querySelectorAll('.yt-mp3-quality-opt').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        wrap.classList.remove('open');
        const q = opt.dataset.quality || '320';
        preferredQuality = q;
        if (typeof GM_setValue !== 'undefined') GM_setValue('quality', q);
        handleDownloadRequest(window.location.href, q);
      });
    });

    document.addEventListener('click', () => wrap.classList.remove('open'));

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

  function ensureFloatingButton() {
    let fab = document.getElementById('yt-mp3-fab-btn');
    const isVideo = window.location.pathname.includes('/watch') || window.location.pathname.includes('/shorts/');
    if (!isVideo) {
      if (fab) fab.style.display = 'none';
      return;
    }
    if (!fab) {
      fab = document.createElement('div');
      fab.id = 'yt-mp3-fab-btn';
      fab.className = 'yt-mp3-fab';
      fab.title = 'Unduh MP3 ke YouTube to MP3 Studio';
      fab.innerHTML = `${MUSIC_ICON_SVG}<span>Unduh MP3</span>`;
      fab.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDownloadRequest(window.location.href, preferredQuality);
      });
      document.body.appendChild(fab);
    } else {
      fab.style.display = 'flex';
    }
  }

  function tryInject() {
    hookYouTubeAudio();

    if (!window.location.pathname.includes('/watch') && !window.location.pathname.includes('/shorts/')) {
      const ex = document.getElementById('yt-mp3-injected-container');
      if (ex) ex.remove();
      ensureFloatingButton();
      return;
    }

    ensureFloatingButton();
    ensureEqualizerPanel();

    if (document.getElementById('yt-mp3-injected-container')) return;

    const targets = [
      '#above-the-fold #top-level-buttons-computed',
      '#top-level-buttons-computed',
      '#actions #actions-inner #menu ytd-menu-renderer #top-level-buttons-computed',
      '#owner #subscribe-button',
      '#actions #actions-inner'
    ];

    for (const sel of targets) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        const btnGroup = createButtonGroup();
        if (el.id === 'subscribe-button') {
          el.parentNode.insertBefore(btnGroup, el.nextSibling);
        } else {
          el.appendChild(btnGroup);
        }
        break;
      }
    }
  }

  window.addEventListener('yt-navigate-finish', () => {
    hookYouTubeAudio();
    setTimeout(tryInject, 300);
    setTimeout(tryInject, 1200);
  });
  window.addEventListener('spfdone', () => {
    hookYouTubeAudio();
    setTimeout(tryInject, 300);
  });
  window.addEventListener('popstate', () => {
    hookYouTubeAudio();
    setTimeout(tryInject, 300);
  });

  setInterval(tryInject, 2000);
  tryInject();
})();
