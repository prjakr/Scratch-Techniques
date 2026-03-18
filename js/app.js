// ============================================================
// app.js - Core: Auth, Google Drive API, Data Management
// ============================================================

const APP_VERSION = 'v1.4.0';
const CHANGELOG = [
  { ver: 'v1.4.0', date: '2026-03-18', note: 'AIモデルを gemini-2.5-flash に更新・バージョン管理追加' },
  { ver: 'v1.3.0', date: '2026-03-17', note: 'スマホ用QRコード設定転送機能追加' },
  { ver: 'v1.2.0', date: '2026-03-16', note: 'AIをGemini API(完全無料)に移行・Dark/Light切替' },
  { ver: 'v1.1.0', date: '2026-03-15', note: 'UIリニューアル（グラスモーフィズム・カテゴリカラー）' },
  { ver: 'v1.0.0', date: '2026-03-14', note: '初回リリース' },
];

// ============================================================
// デフォルト設定（自動入力）- localStorageが空のとき使われる
// ============================================================
const DEFAULT_CLIENT_ID  = '909131026-gdchr152acqnusc2mq3ue51341g5o71i.apps.googleusercontent.com';
const DEFAULT_GEMINI_KEY = 'AIzaSyBclzhxuoVrKAe6w4wbCQG8Iq4NtwxcGt0';

function getClientId()  { return localStorage.getItem('google_client_id')  || DEFAULT_CLIENT_ID;  }
function getGeminiKey() { return localStorage.getItem('gemini_api_key')     || DEFAULT_GEMINI_KEY; }

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const ROOT_FOLDER_NAME = 'Scratch Techniques';
const DATA_FILE_NAME = 'techniques.json';

const CATEGORIES = [
  'すべて',
  'アクションゲーム',
  'リズムゲーム',
  'RPG',
  'パズルゲーム',
  'シューティング',
  'プラットフォームゲーム',
  '音楽・アート',
  'シミュレーション',
  'その他',
];

const CATEGORY_EMOJI = {
  'すべて': '🎮',
  'アクションゲーム': '🏃',
  'リズムゲーム': '🎵',
  'RPG': '⚔️',
  'パズルゲーム': '🧩',
  'シューティング': '🚀',
  'プラットフォームゲーム': '🍄',
  '音楽・アート': '🎨',
  'シミュレーション': '🌍',
  'その他': '✨',
};

// ============================================================
// STATE
// ============================================================
const appState = {
  accessToken: null,
  isSignedIn: false,
  tokenExpiresAt: 0,
  rootFolderId: localStorage.getItem('root_folder_id') || null,
  sb3FolderId: localStorage.getItem('sb3_folder_id') || null,
  dataFileId: localStorage.getItem('data_file_id') || null,
  techniques: [],
  user: null,
};

// ============================================================
// GOOGLE OAUTH
// ============================================================
let tokenClient = null;

function initGoogleAuth() {
  const clientId = getClientId();
  if (!clientId || typeof google === 'undefined') return false;
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: handleTokenResponse,
    });
    return true;
  } catch (e) {
    console.error('initGoogleAuth error:', e);
    return false;
  }
}

function handleTokenResponse(response) {
  if (response.error) {
    console.error('OAuth error:', response.error);
    showToast('ログインに失敗しました: ' + response.error, 'error');
    return;
  }
  appState.accessToken = response.access_token;
  appState.isSignedIn = true;
  appState.tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000;
  sessionStorage.setItem('st_token', appState.accessToken);
  sessionStorage.setItem('st_expires', String(appState.tokenExpiresAt));
  if (typeof onSignIn === 'function') onSignIn();
}

function signIn() {
  if (!tokenClient) {
    const ok = initGoogleAuth();
    if (!ok) {
      showToast('Google Client IDが設定されていません', 'error');
      setTimeout(() => { window.location.href = 'settings.html'; }, 1500);
      return;
    }
  }
  tokenClient.requestAccessToken({ prompt: '' });
}

function signOut() {
  if (appState.accessToken) {
    google.accounts.oauth2.revoke(appState.accessToken, () => {});
  }
  appState.accessToken = null;
  appState.isSignedIn = false;
  sessionStorage.removeItem('st_token');
  sessionStorage.removeItem('st_expires');
  // Clear cached folder IDs
  localStorage.removeItem('root_folder_id');
  localStorage.removeItem('screenshots_folder_id');
  localStorage.removeItem('sb3_folder_id');
  localStorage.removeItem('data_file_id');
  Object.assign(appState, {
    rootFolderId: null, sb3FolderId: null, dataFileId: null, techniques: [],
  });
  if (typeof onSignOut === 'function') onSignOut();
}

function isTokenValid() {
  return appState.accessToken && Date.now() < appState.tokenExpiresAt - 30000;
}

// ============================================================
// SESSION RESTORE (prevents Google popup on back navigation)
// ============================================================
function tryRestoreSession() {
  const token = sessionStorage.getItem('st_token');
  const expires = Number(sessionStorage.getItem('st_expires') || '0');
  if (token && Date.now() < expires - 30000) {
    appState.accessToken = token;
    appState.isSignedIn = true;
    appState.tokenExpiresAt = expires;
    return true;
  }
  return false;
}

async function ensureToken() {
  if (isTokenValid()) return;
  // Try silent refresh with timeout
  return new Promise((resolve, reject) => {
    if (!tokenClient) initGoogleAuth();
    if (!tokenClient) {
      reject(new Error('Google Client IDが設定されていません'));
      return;
    }
    const timer = setTimeout(() => {
      tokenClient.callback = orig;
      reject(new Error('認証がタイムアウトしました。ページを再読み込みしてください。'));
    }, 15000);
    const orig = tokenClient.callback;
    tokenClient.callback = (resp) => {
      clearTimeout(timer);
      tokenClient.callback = orig;
      if (resp.error) {
        reject(new Error('認証エラー: ' + resp.error));
        return;
      }
      handleTokenResponse(resp);
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

// ============================================================
// DRIVE API HELPERS
// ============================================================
async function driveAPI(method, path, body = null, params = {}, isUpload = false) {
  await ensureToken();
  const base = isUpload
    ? 'https://www.googleapis.com/upload/drive/v3'
    : 'https://www.googleapis.com/drive/v3';
  const url = new URL(base + path);
  if (isUpload) url.searchParams.set('uploadType', 'multipart');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const headers = { Authorization: `Bearer ${appState.accessToken}` };
  const opts = { method, headers };

  if (body instanceof FormData) {
    opts.body = body;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), opts);
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Drive ${method} ${path} → ${res.status}: ${err}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function findFolder(name, parentId) {
  let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;
  const r = await driveAPI('GET', '/files', null, { q, fields: 'files(id)', spaces: 'drive' });
  return r.files?.[0]?.id || null;
}

async function createFolder(name, parentId) {
  const meta = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) meta.parents = [parentId];
  const r = await driveAPI('POST', '/files', meta, { fields: 'id' });
  return r.id;
}

async function findOrCreateFolder(name, parentId = null) {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  return createFolder(name, parentId);
}

async function setupDriveFolders() {
  if (!appState.rootFolderId) {
    appState.rootFolderId = await findOrCreateFolder(ROOT_FOLDER_NAME);
    localStorage.setItem('root_folder_id', appState.rootFolderId);
  }
  if (!appState.sb3FolderId) {
    appState.sb3FolderId = await findOrCreateFolder('sb3files', appState.rootFolderId);
    localStorage.setItem('sb3_folder_id', appState.sb3FolderId);
  }
}

// ============================================================
// DATA FILE (techniques.json)
// ============================================================
async function loadTechniques() {
  await setupDriveFolders();

  if (!appState.dataFileId) {
    const r = await driveAPI('GET', '/files', null, {
      q: `name='${DATA_FILE_NAME}' and '${appState.rootFolderId}' in parents and trashed=false`,
      fields: 'files(id)', spaces: 'drive',
    });
    if (r.files?.length) {
      appState.dataFileId = r.files[0].id;
      localStorage.setItem('data_file_id', appState.dataFileId);
    }
  }

  if (appState.dataFileId) {
    await ensureToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${appState.dataFileId}?alt=media`,
      { headers: { Authorization: `Bearer ${appState.accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json().catch(() => ({ techniques: [] }));
      appState.techniques = data.techniques || [];
      return;
    }
  }
  appState.techniques = [];
}

async function saveTechniques() {
  const json = JSON.stringify({ techniques: appState.techniques }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  await ensureToken();

  const metaBlob = new Blob(
    [JSON.stringify({ name: DATA_FILE_NAME, parents: appState.dataFileId ? undefined : [appState.rootFolderId] })],
    { type: 'application/json' }
  );

  const fd = new FormData();
  fd.append('metadata', metaBlob);
  fd.append('file', blob);

  if (appState.dataFileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${appState.dataFileId}?uploadType=multipart&fields=id`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${appState.accessToken}` }, body: fd }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      // dataFileId が無効な場合はリセットして再作成
      if (res.status === 404) {
        appState.dataFileId = null;
        localStorage.removeItem('data_file_id');
        return saveTechniques(); // 再帰呼び出しで新規作成
      }
      throw new Error(`データ保存失敗 (${res.status}): ${errText}`);
    }
    return res.json();
  } else {
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      { method: 'POST', headers: { Authorization: `Bearer ${appState.accessToken}` }, body: fd }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`データ作成失敗 (${res.status}): ${errText}`);
    }
    const r = await res.json();
    appState.dataFileId = r.id;
    localStorage.setItem('data_file_id', r.id);
    return r;
  }
}

// ============================================================
// FILE UPLOAD
// ============================================================
async function uploadFileToDrive(file, folderId, customName = null) {
  await ensureToken();
  if (!folderId) throw new Error('アップロード先フォルダが見つかりません。ページを再読み込みしてください。');
  const meta = { name: customName || file.name, parents: [folderId] };
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  fd.append('file', file);
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    { method: 'POST', headers: { Authorization: `Bearer ${appState.accessToken}` }, body: fd }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ファイルアップロード失敗 (${res.status}): ${errText}`);
  }
  return res.json();
}

async function deleteFile(fileId) {
  await driveAPI('DELETE', `/files/${fileId}`);
}

function getDriveImageUrl(fileId) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}

// ============================================================
// TECHNIQUE CRUD
// ============================================================
function getTechniqueById(id) {
  return appState.techniques.find(t => t.id === id) || null;
}

async function addTechnique(data) {
  const tech = {
    id: generateId(),
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  appState.techniques.unshift(tech);
  await saveTechniques();
  return tech;
}

async function updateTechnique(id, data) {
  const idx = appState.techniques.findIndex(t => t.id === id);
  if (idx < 0) throw new Error('Technique not found');
  appState.techniques[idx] = {
    ...appState.techniques[idx],
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };
  await saveTechniques();
  return appState.techniques[idx];
}

async function deleteTechnique(id) {
  const t = getTechniqueById(id);
  if (!t) return;
  // Delete files from Drive
  if (t.screenshotFileId) await deleteFile(t.screenshotFileId).catch(() => {});
  if (t.sb3FileId) await deleteFile(t.sb3FileId).catch(() => {});
  appState.techniques = appState.techniques.filter(x => x.id !== id);
  await saveTechniques();
}

// ============================================================
// UTILITIES
// ============================================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function getScratchProjectId(url) {
  if (!url) return null;
  const m = url.match(/scratch\.mit\.edu\/projects\/(\d+)/);
  return m ? m[1] : null;
}

function getScratchEmbedUrl(urlOrId) {
  const id = /^\d+$/.test(urlOrId) ? urlOrId : getScratchProjectId(urlOrId);
  if (!id) return null;
  return `https://scratch.mit.edu/projects/${id}/embed`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Minimal Markdown renderer
function renderMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupb])(.+)$/gm, (m, c) => c.trim() ? `<p>${c}</p>` : '')
    .replace(/<p><\/p>/g, '');
}

function showToast(msg, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3000);
}

function showLoading(show = true) {
  const el = document.getElementById('loading');
  if (el) el.classList.toggle('hidden', !show);
}

function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ============================================================
// DARK MODE
// ============================================================
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon();
}

function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.title = isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
  });
}

document.addEventListener('DOMContentLoaded', updateThemeIcon);

// Build category pills HTML
function buildCategoryList(activeIndex = 0) {
  return CATEGORIES.map((cat, i) => `
    <li>
      <button class="cat-btn ${i === activeIndex ? 'active' : ''}" data-index="${i}" data-cat="${cat}">
        ${CATEGORY_EMOJI[cat] || '🎮'} ${cat}
      </button>
    </li>
  `).join('');
}
