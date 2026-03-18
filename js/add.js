// ============================================================
// add.js - Add / Edit Technique
// ============================================================

let editId = null;
let sb3File = null;
let existingSb3Id = null;
let currentTags = [];

async function onSignIn() {
  showLoading(true);
  try {
    await loadTechniques();
    editId = getUrlParam('id');
    if (editId) {
      const tech = getTechniqueById(editId);
      if (tech) populateForm(tech);
    }
  } catch (e) {
    console.error(e);
    showToast('読み込みに失敗しました', 'error');
  } finally {
    showLoading(false);
  }
}

function onSignOut() {
  window.location.href = 'index.html';
}

// ============================================================
// FORM POPULATE (edit mode)
// ============================================================
function populateForm(tech) {
  document.querySelector('h2').textContent = '✏️ テクニックを編集';
  document.title = 'テクニックを編集 - Scratch Techniques';

  document.getElementById('title').value = tech.title || '';
  document.getElementById('category').value = tech.category || '';
  document.getElementById('description').value = tech.description || '';
  document.getElementById('scratch-url').value = tech.scratchUrl || '';

  currentTags = [...(tech.tags || [])];
  renderTags();

  if (tech.sb3FileId) {
    existingSb3Id = tech.sb3FileId;
    showSb3FileInfo(tech.sb3FileName || 'project.sb3');
  }

  updateScratchPreview();
}

// ============================================================
// TAGS INPUT
// ============================================================
function renderTags() {
  const wrap = document.getElementById('tags-wrap');
  if (!wrap) return;
  const input = document.getElementById('tag-input');
  wrap.innerHTML = currentTags
    .map((tag, i) => `
      <span class="tag-item">
        ${escapeHtml(tag)}
        <button class="tag-remove" data-i="${i}" type="button">✕</button>
      </span>`)
    .join('');
  wrap.appendChild(input);

  wrap.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTags.splice(Number(btn.dataset.i), 1);
      renderTags();
    });
  });
}

function initTagsInput() {
  const input = document.getElementById('tag-input');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addTag(input.value.trim());
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && currentTags.length) {
      currentTags.pop();
      renderTags();
    }
  });
  input.addEventListener('blur', () => {
    if (input.value.trim()) {
      addTag(input.value.trim());
      input.value = '';
    }
  });

  document.getElementById('tags-wrap')?.addEventListener('click', () => input.focus());
}

function addTag(tag) {
  tag = tag.replace(/,/g, '').trim();
  if (tag && !currentTags.includes(tag) && currentTags.length < 10) {
    currentTags.push(tag);
    renderTags();
  }
}

// ============================================================
// SCRATCH URL PREVIEW
// ============================================================
function updateScratchPreview() {
  const url = document.getElementById('scratch-url')?.value || '';
  const id = getScratchProjectId(url);
  const preview = document.getElementById('scratch-url-preview');
  if (!preview) return;

  if (id) {
    preview.innerHTML = `
      <div class="scratch-preview-wrap">
        <div class="panel-header">
          <span class="panel-title">🐱 プレビュー (Project ID: ${id})</span>
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="btn btn-sm btn-ghost">↗ 開く</a>
        </div>
      </div>`;
    document.getElementById('scratch-url')?.classList.add('input-valid');
    document.getElementById('scratch-url')?.classList.remove('input-error');
  } else if (url) {
    document.getElementById('scratch-url')?.classList.add('input-error');
    document.getElementById('scratch-url')?.classList.remove('input-valid');
    preview.innerHTML = '<p class="field-error">有効なScratch URLを入力してください (例: https://scratch.mit.edu/projects/123456789)</p>';
  } else {
    preview.innerHTML = '';
    document.getElementById('scratch-url')?.classList.remove('input-valid', 'input-error');
  }
}

// ============================================================
// FILE HANDLING
// ============================================================
function initSb3Upload() {
  const input = document.getElementById('sb3-file');
  if (!input) return;
  input.addEventListener('change', () => {
    if (input.files[0]) {
      sb3File = input.files[0];
      showSb3FileInfo(input.files[0].name);
    }
  });
}

function showSb3FileInfo(name) {
  const container = document.getElementById('sb3-info');
  if (!container) return;
  container.innerHTML = `
    <div class="upload-file-info">
      <span>📦</span>
      <span>${escapeHtml(name)}</span>
      <button class="remove-file" type="button" id="remove-sb3">✕</button>
    </div>`;
  document.getElementById('remove-sb3')?.addEventListener('click', () => {
    sb3File = null;
    existingSb3Id = null;
    container.innerHTML = '';
    if (document.getElementById('sb3-file')) {
      document.getElementById('sb3-file').value = '';
    }
  });
}

// ============================================================
// MARKDOWN PREVIEW TAB
// ============================================================
function initMarkdownTabs() {
  document.getElementById('tab-write')?.addEventListener('click', () => {
    setTab('write');
  });
  document.getElementById('tab-preview')?.addEventListener('click', () => {
    const md = document.getElementById('description')?.value || '';
    const el = document.getElementById('preview-area');
    if (el) el.innerHTML = renderMarkdown(md) || '<span style="color:var(--text-muted)">（入力なし）</span>';
    setTab('preview');
  });
}

function setTab(tab) {
  document.getElementById('tab-write')?.classList.toggle('active', tab === 'write');
  document.getElementById('tab-preview')?.classList.toggle('active', tab === 'preview');
  document.getElementById('panel-write')?.classList.toggle('active', tab === 'write');
  document.getElementById('panel-preview')?.classList.toggle('active', tab === 'preview');
}

// ============================================================
// SAVE
// ============================================================
async function saveForm(e) {
  e.preventDefault();

  const title = document.getElementById('title')?.value.trim();
  const category = document.getElementById('category')?.value;
  const description = document.getElementById('description')?.value.trim();
  const scratchUrl = document.getElementById('scratch-url')?.value.trim();

  // Validate
  let valid = true;
  if (!title) {
    document.getElementById('title-error').textContent = 'タイトルは必須です';
    valid = false;
  } else {
    document.getElementById('title-error').textContent = '';
  }

  if (!valid) return;

  // トークン切れの場合はリダイレクト（ハング防止）
  if (!isTokenValid()) {
    showToast('セッションが切れました。再度サインインしてください。', 'error');
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    return;
  }

  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';
  showLoading(true);

  try {
    // フォルダIDが未設定の場合は再セットアップ
    if (!appState.rootFolderId || !appState.sb3FolderId) {
      await setupDriveFolders();
    }

    let sb3FileId = existingSb3Id;
    let sb3FileName = null;

    // Upload sb3
    if (sb3File) {
      const r = await uploadFileToDrive(
        sb3File,
        appState.sb3FolderId,
        `sb3_${Date.now()}.sb3`
      );
      sb3FileId = r.id;
      sb3FileName = sb3File.name;
      // Delete old if exists
      if (existingSb3Id && existingSb3Id !== sb3FileId) {
        await deleteFile(existingSb3Id).catch(() => {});
      }
    } else if (existingSb3Id) {
      const tech = editId ? getTechniqueById(editId) : null;
      sb3FileName = tech?.sb3FileName;
    }

    const data = {
      title,
      category: category || 'その他',
      description,
      scratchUrl: scratchUrl || null,
      tags: currentTags,
      sb3FileId: sb3FileId || null,
      sb3FileName: sb3FileName || null,
    };

    if (editId) {
      await updateTechnique(editId, data);
      showToast('更新しました ✓', 'success');
      setTimeout(() => { window.location.href = `detail.html?id=${editId}`; }, 800);
    } else {
      const tech = await addTechnique(data);
      showToast('追加しました ✓', 'success');
      setTimeout(() => { window.location.href = `detail.html?id=${tech.id}`; }, 800);
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast('保存に失敗しました: ' + err.message, 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = editId ? '更新する' : '追加する';
    showLoading(false);
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cancel-btn')?.addEventListener('click', () => {
    window.history.length > 1 ? history.back() : window.location.href = 'index.html';
  });

  document.getElementById('technique-form')?.addEventListener('submit', saveForm);

  document.getElementById('scratch-url')?.addEventListener('input', () => {
    clearTimeout(window._scratchDebounce);
    window._scratchDebounce = setTimeout(updateScratchPreview, 500);
  });

  initTagsInput();
  initSb3Upload();
  initMarkdownTabs();
  setTab('write');

  // Build category options
  const sel = document.getElementById('category');
  if (sel) {
    CATEGORIES.filter(c => c !== 'すべて').forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = `${CATEGORY_EMOJI[cat] || ''} ${cat}`;
      sel.appendChild(opt);
    });
  }

  showLoading(true);
  const tryInit = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      const ok = initGoogleAuth();
      if (!ok) {
        // Client ID未設定 → settings へ
        window.location.href = 'settings.html';
        return;
      }
      // セッションが残っていればGoogle窓を出さずに復元
      if (tryRestoreSession()) { onSignIn(); return; }
      // セッションなし → index へ戻してサインインし直す（サブページでは popup を出さない）
      window.location.href = 'index.html';
    } else {
      setTimeout(tryInit, 200);
    }
  };
  tryInit();
});
