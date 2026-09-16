// YouTube to MP3 Studio - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  // Create Context Menu for YouTube links
  chrome.contextMenus.create({
    id: 'yt-mp3-download-link',
    title: '🎵 Unduh MP3 ke Studio (320 kbps)',
    contexts: ['link'],
    targetUrlPatterns: [
      '*://*.youtube.com/watch*',
      '*://*.youtube.com/shorts/*',
      '*://youtu.be/*'
    ]
  });

  // Create Context Menu for YouTube page
  chrome.contextMenus.create({
    id: 'yt-mp3-download-page',
    title: '🎵 Unduh Video Ini ke Studio MP3',
    contexts: ['page'],
    documentUrlPatterns: [
      '*://*.youtube.com/watch*',
      '*://*.youtube.com/shorts/*'
    ]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let targetUrl = '';
  if (info.menuItemId === 'yt-mp3-download-link' && info.linkUrl) {
    targetUrl = info.linkUrl;
  } else if (info.menuItemId === 'yt-mp3-download-page' && (info.pageUrl || tab?.url)) {
    targetUrl = info.pageUrl || tab.url;
  }

  if (!targetUrl) return;

  // Retrieve server URL
  const data = await chrome.storage.local.get(['serverUrl', 'quality']);
  const serverUrl = (data.serverUrl || 'http://localhost:5000').replace(/\/$/, '');
  const quality = data.quality || '320';

  try {
    const res = await fetch(`${serverUrl}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: [targetUrl],
        quality: quality
      })
    });

    const resData = await res.json();
    if (res.ok && resData.success) {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'notify',
          type: 'success',
          title: 'Berhasil Masuk Antrean',
          message: 'Video sedang diunduh dan dikonversi ke MP3 di Studio.'
        }).catch(() => {});
      }
    } else {
      throw new Error(resData.error || `HTTP ${res.status}`);
    }
  } catch (err) {
    console.error('Download error:', err);
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'notify',
        type: 'error',
        title: 'Gagal Mengunduh',
        message: 'Tidak dapat menghubungi server http://localhost:5000.'
      }).catch(() => {});
    }
  }
});
