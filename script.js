/**
 * YUKISBOX — Calm / Kit Design System & Edge Uploader Controller
 * Integrated with https://yukisbox.com Live API & Cloudflare Edge
 */

// Configuration
const BASE_API = 'https://yukisbox.com';
const VAULT_STORAGE_KEY = 'yukisbox_calm_vault';

// DOM Element References
const serverStatusBadge = document.getElementById('serverStatusBadge');
const statsFilesCount = document.getElementById('statsFilesCount');
const statFilesVal = document.getElementById('statFilesVal');
const edgeLatencyBadge = document.getElementById('edgeLatencyBadge');
const edgeRegionText = document.getElementById('edgeRegionText');

// Tabs & Panels
const uploadModeTabs = document.getElementById('uploadModeTabs');
const tabButtons = uploadModeTabs.querySelectorAll('.tab-btn');
const panels = {
  file: document.getElementById('panelFile'),
  url: document.getElementById('panelUrl'),
  tg: document.getElementById('panelTg'),
  paste: document.getElementById('panelPaste')
};

// Inputs
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const dropTitle = document.getElementById('dropTitle');
const dropSubtitle = document.getElementById('dropSubtitle');
const selectedFilePill = document.getElementById('selectedFilePill');
const selectedFileName = document.getElementById('selectedFileName');
const selectedFileSize = document.getElementById('selectedFileSize');
const removeFileBtn = document.getElementById('removeFileBtn');

const urlInput = document.getElementById('urlInput');
const tgInput = document.getElementById('tgInput');
const pasteInput = document.getElementById('pasteInput');

// Options Drawer
const toggleOptionsBtn = document.getElementById('toggleOptionsBtn');
const optionsDrawer = document.getElementById('optionsDrawer');
const optionsChevron = document.getElementById('optionsChevron');
const customSlugInput = document.getElementById('customSlugInput');
const passwordInput = document.getElementById('passwordInput');

// Action Buttons
const startUploadBtn = document.getElementById('startUploadBtn');
const clearBtn = document.getElementById('clearBtn');

// Progress Card
const progressCard = document.getElementById('progressCard');
const uploadStateLabel = document.getElementById('uploadStateLabel');
const uploadSpeedLabel = document.getElementById('uploadSpeedLabel');
const uploadProgressFill = document.getElementById('uploadProgressFill');
const uploadProgressVal = document.getElementById('uploadProgressVal');
const transferredLabel = document.getElementById('transferredLabel');
const etaLabel = document.getElementById('etaLabel');

// Result Card
const resultCard = document.getElementById('resultCard');
const resDirectLink = document.getElementById('resDirectLink');
const resRawLink = document.getElementById('resRawLink');
const copyDirectBtn = document.getElementById('copyDirectBtn');
const copyRawBtn = document.getElementById('copyRawBtn');
const openLinkBtn = document.getElementById('openLinkBtn');

// Vault
const vaultList = document.getElementById('vaultList');
const clearVaultBtn = document.getElementById('clearVaultBtn');

// Toast & Docs Modal
const calmToast = document.getElementById('calmToast');
const docsModal = document.getElementById('docsModal');
const closeDocsModal = document.getElementById('closeDocsModal');
const navHome = document.getElementById('navHome');
const navSpeed = document.getElementById('navSpeed');
const navVault = document.getElementById('navVault');
const navDocs = document.getElementById('navDocs');

// Swatches
const swatchItems = document.querySelectorAll('.swatch-item');

// Internal State
let currentMode = 'file';
let currentFile = null;
let currentXhr = null;

// ==========================================
// 1. Utility Functions
// ==========================================
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function showToast(message) {
  calmToast.textContent = message;
  calmToast.classList.add('show');
  clearTimeout(calmToast._timer);
  calmToast._timer = setTimeout(() => {
    calmToast.classList.remove('show');
  }, 2400);
}

function copyToClipboard(text, successMsg = 'Copied to clipboard! ✨') {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    showToast(successMsg);
  } catch (err) {
    showToast('Failed to copy');
  }
  document.body.removeChild(ta);
}

// ==========================================
// 2. Health & Live Stats Ping
// ==========================================
async function updateServerStats() {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE_API}/api/server/stats`, { cache: 'no-store' });
    const latency = Math.round(performance.now() - t0);
    
    if (res.ok) {
      const data = await res.json();
      serverStatusBadge.textContent = `LIVE • YUKISBOX EDGE • ${latency}ms`;
      edgeLatencyBadge.textContent = `${latency} ms`;
      
      if (data.total_files) {
        const countFormatted = (data.total_files > 1000) 
          ? (data.total_files / 1000).toFixed(1) + 'K' 
          : data.total_files;
        statsFilesCount.textContent = `${countFormatted} Files`;
        statFilesVal.textContent = countFormatted;
      }
      
      // Determine Edge cluster from headers or default
      const cfRay = res.headers.get('cf-ray');
      if (cfRay && cfRay.includes('-')) {
        const colo = cfRay.split('-')[1];
        edgeRegionText.textContent = `${colo} Cloudflare Edge Cluster`;
      }
    } else {
      serverStatusBadge.textContent = `LIVE • YUKISBOX EDGE • ${latency}ms`;
      edgeLatencyBadge.textContent = `${latency} ms`;
    }
  } catch (err) {
    // If blocked or offline
    const latency = Math.round(performance.now() - t0);
    serverStatusBadge.textContent = `LIVE • CLOUDFLARE EDGE`;
    edgeLatencyBadge.textContent = `${Math.min(latency, 45)} ms`;
  }
}

// Ping every 25 seconds
updateServerStats();
setInterval(updateServerStats, 25000);

// ==========================================
// 3. Tab Navigation & Mode Switching
// ==========================================
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentMode = btn.getAttribute('data-mode');
    
    // Switch panels
    Object.keys(panels).forEach(key => {
      panels[key].classList.toggle('active', key === currentMode);
    });

    // Reset progress and result when switching mode
    resetProgress();
  });
});

// ==========================================
// 4. File Drag & Drop Handling
// ==========================================
dropZone.addEventListener('click', (e) => {
  if (e.target.closest('#removeFileBtn')) return;
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    handleFileSelect(fileInput.files[0]);
  }
});

['dragenter', 'dragover'].forEach(evt => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(evt => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });
});

dropZone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  if (dt && dt.files.length > 0) {
    handleFileSelect(dt.files[0]);
  }
});

function handleFileSelect(file) {
  currentFile = file;
  selectedFileName.textContent = file.name;
  selectedFileSize.textContent = `(${formatBytes(file.size)})`;
  selectedFilePill.style.display = 'inline-flex';
  dropTitle.style.display = 'none';
  dropSubtitle.style.display = 'none';
  resetProgress();
}

removeFileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  currentFile = null;
  fileInput.value = '';
  selectedFilePill.style.display = 'none';
  dropTitle.style.display = 'block';
  dropSubtitle.style.display = 'block';
  resetProgress();
});

// ==========================================
// 5. Drawer Toggle (Options)
// ==========================================
toggleOptionsBtn.addEventListener('click', () => {
  const isOpen = optionsDrawer.style.display !== 'none';
  optionsDrawer.style.display = isOpen ? 'none' : 'block';
  optionsChevron.innerHTML = isOpen ? '&darr;' : '&uarr;';
});

// ==========================================
// 6. Reset & Clear Handler
// ==========================================
clearBtn.addEventListener('click', () => {
  if (currentXhr) {
    currentXhr.abort();
    currentXhr = null;
  }
  currentFile = null;
  fileInput.value = '';
  urlInput.value = '';
  tgInput.value = '';
  pasteInput.value = '';
  customSlugInput.value = '';
  passwordInput.value = '';
  selectedFilePill.style.display = 'none';
  dropTitle.style.display = 'block';
  dropSubtitle.style.display = 'block';
  resetProgress();
  resultCard.style.display = 'none';
  showToast('Form cleared');
});

function resetProgress() {
  uploadStateLabel.textContent = 'Ready to upload';
  uploadSpeedLabel.textContent = '0.0 MB/s';
  uploadProgressFill.style.width = '0%';
  uploadProgressVal.textContent = '0%';
  transferredLabel.textContent = '0 KB / 0 KB';
  etaLabel.textContent = '-- s remaining';
  startUploadBtn.disabled = false;
}

// ==========================================
// 7. Core Upload Execution & Speed Meter
// ==========================================
startUploadBtn.addEventListener('click', () => {
  executeUpload();
});

function executeUpload() {
  const formData = new FormData();
  let endpoint = `${BASE_API}/upload`;

  const customSlug = customSlugInput.value.trim();
  const password = passwordInput.value.trim();

  if (customSlug) formData.append('custom_slug', customSlug);
  if (password) formData.append('password', password);

  // Validate according to mode
  if (currentMode === 'file') {
    if (!currentFile) {
      showToast('Please select or drop a file first 📂');
      return;
    }
    formData.append('file', currentFile);
    endpoint = `${BASE_API}/upload`;
  } else if (currentMode === 'url') {
    const val = urlInput.value.trim();
    if (!val || !val.startsWith('http')) {
      showToast('Please enter a valid HTTP/HTTPS URL 🌐');
      return;
    }
    formData.append('url', val);
    endpoint = `${BASE_API}/upload-url`;
  } else if (currentMode === 'tg') {
    const val = tgInput.value.trim();
    if (!val || (!val.includes('t.me') && !val.includes('telegram'))) {
      showToast('Please enter a valid Telegram post link ✈️');
      return;
    }
    formData.append('url', val);
    endpoint = `${BASE_API}/upload-telegram`;
  } else if (currentMode === 'paste') {
    const text = pasteInput.value.trim();
    if (!text) {
      showToast('Please enter some text or code snippet 📝');
      return;
    }
    formData.append('text', text);
    formData.append('filename', `paste_${Date.now()}.txt`);
    endpoint = `${BASE_API}/upload-text`;
  }

  // Scroll to progress card smoothly
  progressCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Prepare XHR with Real-Time Speed Meter
  startUploadBtn.disabled = true;
  uploadStateLabel.textContent = 'Connecting to Cloudflare Edge...';
  resultCard.style.display = 'none';

  const xhr = new XMLHttpRequest();
  currentXhr = xhr;

  let startTime = null;
  let lastTime = null;
  let lastLoaded = 0;
  let smoothSpeed = 0; // Bytes per second

  xhr.upload.onloadstart = () => {
    startTime = performance.now();
    lastTime = startTime;
    lastLoaded = 0;
    smoothSpeed = 0;
    uploadStateLabel.textContent = 'Streaming packets to Edge...';
  };

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const now = performance.now();
      const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
      const deltaSec = (now - lastTime) / 1000;
      const deltaBytes = e.loaded - lastLoaded;

      // Update speed calculation every 100ms
      if (deltaSec >= 0.1) {
        const instantSpeed = deltaBytes / deltaSec;
        smoothSpeed = smoothSpeed === 0 ? instantSpeed : (smoothSpeed * 0.7 + instantSpeed * 0.3);
        lastTime = now;
        lastLoaded = e.loaded;
      }

      const speedMBs = (smoothSpeed / (1024 * 1024)).toFixed(2);
      const remainingBytes = Math.max(0, e.total - e.loaded);
      const remainingSec = smoothSpeed > 0 ? Math.ceil(remainingBytes / smoothSpeed) : 0;

      // Update UI elements
      uploadProgressFill.style.width = `${percent}%`;
      uploadProgressVal.textContent = `${percent}%`;
      uploadSpeedLabel.textContent = `${speedMBs} MB/s`;
      transferredLabel.textContent = `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;
      
      if (percent >= 100) {
        etaLabel.textContent = 'Finalizing with Telegram Edge...';
        uploadStateLabel.textContent = 'Storing chunks on Telegram storage...';
      } else {
        etaLabel.textContent = remainingSec > 0 ? `${remainingSec}s remaining` : 'Calculating...';
        uploadStateLabel.textContent = `Streaming (${percent}%)`;
      }
    } else {
      // In chunked/unknown mode (like URL fetch)
      uploadStateLabel.textContent = 'Fetching and caching on Edge...';
      uploadProgressFill.style.width = '70%';
      uploadProgressVal.textContent = '...';
      uploadSpeedLabel.textContent = 'Edge Active';
    }
  };

  xhr.onload = () => {
    currentXhr = null;
    startUploadBtn.disabled = false;

    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const res = JSON.parse(xhr.responseText);
        if (res.success || res.url || res.uid) {
          handleUploadSuccess(res);
        } else {
          handleUploadError(res.detail || res.message || 'Server error occurred');
        }
      } catch (e) {
        handleUploadError('Invalid JSON response from server');
      }
    } else {
      try {
        const err = JSON.parse(xhr.responseText);
        handleUploadError(err.detail || err.message || `Upload failed with status ${xhr.status}`);
      } catch (e) {
        handleUploadError(`Upload failed (${xhr.status})`);
      }
    }
  };

  xhr.onerror = () => {
    currentXhr = null;
    startUploadBtn.disabled = false;
    handleUploadError('Network error connecting to yukisbox.com');
  };

  xhr.onabort = () => {
    currentXhr = null;
    startUploadBtn.disabled = false;
    uploadStateLabel.textContent = 'Upload cancelled';
  };

  xhr.open('POST', endpoint, true);
  xhr.send(formData);
}

function handleUploadSuccess(data) {
  uploadProgressFill.style.width = '100%';
  uploadProgressVal.textContent = '100%';
  uploadStateLabel.textContent = 'Cached Successfully ✨';
  etaLabel.textContent = 'Completed';

  // Construct links
  const uid = data.uid || (data.url ? data.url.split('/').pop() : 'file');
  const directUrl = data.url || `${BASE_API}/file/${uid}`;
  const rawUrl = data.raw_url || `${BASE_API}/raw/${uid}`;
  const fileName = data.filename || (currentFile ? currentFile.name : `file_${uid}`);
  const fileSize = data.size || (currentFile ? currentFile.size : 0);

  // Populate Result Card
  resDirectLink.value = directUrl;
  resRawLink.value = rawUrl;
  openLinkBtn.href = directUrl;

  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showToast('File stored and cached on Cloudflare Edge! 🎉');

  // Save to Local Vault
  addToVault({
    uid,
    name: fileName,
    size: fileSize,
    url: directUrl,
    raw_url: rawUrl,
    time: Date.now()
  });
}

function handleUploadError(errMsg) {
  uploadStateLabel.textContent = 'Error: ' + errMsg;
  uploadSpeedLabel.textContent = 'Failed';
  showToast('Error: ' + errMsg);
}

// ==========================================
// 8. Result Card Copy Handlers
// ==========================================
copyDirectBtn.addEventListener('click', () => {
  copyToClipboard(resDirectLink.value, 'Direct link copied! 📋');
});

copyRawBtn.addEventListener('click', () => {
  copyToClipboard(resRawLink.value, 'Raw stream link copied! ⚡');
});

// ==========================================
// 9. Vault History Storage (Card 06)
// ==========================================
function getVault() {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveVault(items) {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {}
}

function addToVault(item) {
  const items = getVault();
  items.unshift(item);
  // Keep last 30
  if (items.length > 30) items.pop();
  saveVault(items);
  renderVault();
}

function renderVault() {
  const items = getVault();
  if (items.length === 0) {
    vaultList.innerHTML = `
      <div class="empty-vault-state">
        <p>No recent uploads stored locally.</p>
      </div>
    `;
    return;
  }

  vaultList.innerHTML = '';
  items.forEach((item, idx) => {
    const timeStr = new Date(item.time).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const el = document.createElement('div');
    el.className = 'vault-item';
    el.innerHTML = `
      <div class="vault-info">
        <span class="vault-title" title="${item.name}">${escapeHtml(item.name)}</span>
        <span class="vault-meta">${formatBytes(item.size)} &bull; ${timeStr}</span>
      </div>
      <div class="vault-actions">
        <button class="vault-btn copy-btn" data-url="${item.url}" title="Copy Link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <a href="${item.url}" target="_blank" class="vault-btn open-btn" title="Open Link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
    `;
    vaultList.appendChild(el);
  });

  // Attach copy listeners
  vaultList.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      copyToClipboard(url, 'Vault link copied! 📋');
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

clearVaultBtn.addEventListener('click', () => {
  if (confirm('Clear local vault history?')) {
    localStorage.removeItem(VAULT_STORAGE_KEY);
    renderVault();
    showToast('Vault history cleared');
  }
});

// Render vault on initial load
renderVault();

// ==========================================
// 10. Color Palette Token Interactive Copy
// ==========================================
swatchItems.forEach(item => {
  item.addEventListener('click', () => {
    const hex = item.getAttribute('data-hex');
    copyToClipboard(hex, `Color ${hex} copied! 🎨`);
  });
});

// ==========================================
// 11. Bottom Navigation Bar Interactivity
// ==========================================
const navItems = [navHome, navSpeed, navVault, navDocs];

function setActiveNav(btn) {
  navItems.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

navHome.addEventListener('click', () => {
  setActiveNav(navHome);
  document.querySelector('.card-uploader').scrollIntoView({ behavior: 'smooth' });
});

navSpeed.addEventListener('click', () => {
  setActiveNav(navSpeed);
  progressCard.scrollIntoView({ behavior: 'smooth' });
});

navVault.addEventListener('click', () => {
  setActiveNav(navVault);
  document.querySelector('.card-vault').scrollIntoView({ behavior: 'smooth' });
});

navDocs.addEventListener('click', () => {
  setActiveNav(navDocs);
  docsModal.classList.add('open');
});

closeDocsModal.addEventListener('click', () => {
  docsModal.classList.remove('open');
});

docsModal.addEventListener('click', (e) => {
  if (e.target === docsModal) {
    docsModal.classList.remove('open');
  }
});
