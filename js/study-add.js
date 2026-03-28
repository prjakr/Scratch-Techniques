// ============================================================
// study-add.js - 演習追加・編集ページ
// ============================================================

let selectedFiles = [];   // { file, previewUrl } 新規スライド
let existingSlides = [];  // 既存スライド { fileId, name }
let selectedThumb = null; // { file, previewUrl } 新規サムネイル
let existingThumbFileId = null; // 既存サムネイルのfileId
let selectedDiff = 'かんたん';
let editId = null; // 編集モード時のレッスンID

function onSignIn() {}
function onSignOut() { window.location.href = 'study.html'; }

document.addEventListener('DOMContentLoaded', () => {
  const vb = document.getElementById('ver-badge');
  if (vb && typeof APP_VERSION !== 'undefined') vb.textContent = APP_VERSION;
  updateThemeIcon();

  // 編集モード判定
  const params = new URLSearchParams(location.search);
  editId = params.get('edit') || null;

  // Build category select
  const sel = document.getElementById('category');
  STUDY_CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = `${CATEGORY_EMOJI[cat] || ''} ${cat}`;
    sel.appendChild(opt);
  });

  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDiff = btn.dataset.diff;
    });
  });

  // Thumbnail input
  const thumbDrop = document.getElementById('thumb-drop-area');
  const thumbInput = document.getElementById('thumb-file');
  thumbDrop.addEventListener('click', () => thumbInput.click());
  thumbInput.addEventListener('change', e => {
    const f = e.target.files[0];
    if (f && f.type.startsWith('image/')) setThumb(f);
  });
  thumbDrop.addEventListener('dragover', e => { e.preventDefault(); thumbDrop.classList.add('dragover'); });
  thumbDrop.addEventListener('dragleave', () => thumbDrop.classList.remove('dragover'));
  thumbDrop.addEventListener('drop', e => {
    e.preventDefault(); thumbDrop.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) setThumb(f);
  });

  // Slide file input
  const dropArea = document.getElementById('slide-drop-area');
  const fileInput = document.getElementById('slide-files');
  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => addFiles(e.target.files));
  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('dragover'); });
  dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
  dropArea.addEventListener('drop', e => {
    e.preventDefault(); dropArea.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
  });

  // Scratch URL preview
  document.getElementById('scratch-url').addEventListener('input', e => {
    const id = getScratchProjectId(e.target.value);
    const preview = document.getElementById('scratch-preview');
    preview.innerHTML = id
      ? `<div style="background:var(--primary-50);border:1.5px solid var(--primary-light);border-radius:10px;padding:10px 14px;font-size:0.82rem;color:var(--primary)">✅ プロジェクトID: <strong>${id}</strong></div>`
      : '';
  });

  // Save buttons
  document.getElementById('save-btn').addEventListener('click', saveLesson);
  document.getElementById('save-btn2').addEventListener('click', saveLesson);

  // Auth → load if edit mode
  showLoading(true);
  const tryInit = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      const ok = initGoogleAuth();
      if (!ok) { showLoading(false); window.location.href = 'study.html'; return; }
      if (tryRestoreSession()) {
        if (editId) loadEditData();
        else showLoading(false);
        return;
      }
      tokenClient.requestAccessToken({ prompt: '' });
    } else { setTimeout(tryInit, 200); }
  };
  tryInit();
});

// ── サムネイル ───────────────────────────────────────────────
function setThumb(file) {
  selectedThumb = { file, previewUrl: URL.createObjectURL(file) };
  document.getElementById('thumb-preview').style.display = '';
  document.getElementById('thumb-img').src = selectedThumb.previewUrl;
  document.getElementById('thumb-drop-area').style.display = 'none';
}
function removeThumb() {
  selectedThumb = null;
  existingThumbFileId = null;
  document.getElementById('thumb-preview').style.display = 'none';
  document.getElementById('thumb-img').src = '';
  document.getElementById('thumb-drop-area').style.display = '';
}

// ── ファイルタイプ判定 ────────────────────────────────────────
function getFileType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  if (file.name.match(/\.pptx?$/i)) return 'pptx';
  return 'image';
}
function fileTypeIcon(type) {
  return { image: '🖼️', pdf: '📄', pptx: '📊' }[type] || '📎';
}

// ── スライド ─────────────────────────────────────────────────
function addFiles(fileList) {
  Array.from(fileList).forEach(f => {
    const type = getFileType(f);
    const previewUrl = type === 'image' ? URL.createObjectURL(f) : null;
    selectedFiles.push({ file: f, previewUrl, fileType: type });
  });
  renderSlidePreviews();
}
function removeSlide(idx) {
  selectedFiles.splice(idx, 1);
  renderSlidePreviews();
}
function removeExistingSlide(idx) {
  existingSlides.splice(idx, 1);
  renderSlidePreviews();
}
function slideThumbHtml(s, label, color, removeCall) {
  const inner = s.previewUrl
    ? `<img src="${s.previewUrl}" alt="">`
    : `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:22px;color:var(--text-muted);gap:4px">
        <span>${fileTypeIcon(s.fileType)}</span>
        <span style="font-size:8px;padding:0 4px;text-align:center;overflow:hidden;word-break:break-all">${escapeHtml((s.name||s.file?.name||'').slice(0,20))}</span>
       </div>`;
  return `<div class="slide-thumb-item">
    ${inner}
    <span style="position:absolute;bottom:3px;left:4px;font-size:9px;color:white;background:${color};padding:1px 4px;border-radius:4px">${label}</span>
    <button class="slide-thumb-remove" onclick="${removeCall}">✕</button>
  </div>`;
}
function renderSlidePreviews() {
  const grid = document.getElementById('slide-preview-grid');
  const existingHtml = existingSlides.map((s, i) =>
    slideThumbHtml(
      { previewUrl: s.fileType === 'image' ? getDriveImageUrl(s.fileId) : null, name: s.name, fileType: s.fileType || 'image' },
      '保存済', 'rgba(0,0,0,0.5)', `removeExistingSlide(${i})`
    )
  ).join('');
  const newHtml = selectedFiles.map((s, i) =>
    slideThumbHtml(s, '新規', 'rgba(99,102,241,0.7)', `removeSlide(${i})`)
  ).join('');
  grid.innerHTML = existingHtml + newHtml;
}

// ── 編集モード：既存データ読み込み ────────────────────────────
async function loadEditData() {
  try {
    await loadLessons();
    const lesson = appState.lessons.find(l => l.id === editId);
    if (!lesson) { showToast('演習が見つかりません', 'error'); showLoading(false); return; }

    // UI更新
    document.getElementById('page-title').textContent = '✏️ 演習を編集';
    document.getElementById('form-title').textContent = '✏️ 演習を編集';
    document.title = '演習を編集 - Scratch演習';
    document.getElementById('title').value = lesson.title || '';
    document.getElementById('category').value = lesson.category || '';
    document.getElementById('scratch-url').value = lesson.scratchUrl || '';
    document.getElementById('description').value = lesson.description || '';
    // Difficulty
    selectedDiff = lesson.difficulty || 'かんたん';
    document.querySelectorAll('.diff-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.diff === selectedDiff);
    });
    // Scratch preview
    const pid = getScratchProjectId(lesson.scratchUrl || '');
    if (pid) {
      document.getElementById('scratch-preview').innerHTML =
        `<div style="background:var(--primary-50);border:1.5px solid var(--primary-light);border-radius:10px;padding:10px 14px;font-size:0.82rem;color:var(--primary)">✅ プロジェクトID: <strong>${pid}</strong></div>`;
    }
    // Thumbnail
    if (lesson.thumbnailFileId) {
      existingThumbFileId = lesson.thumbnailFileId;
      document.getElementById('thumb-preview').style.display = '';
      document.getElementById('thumb-img').src = getDriveImageUrl(lesson.thumbnailFileId);
      document.getElementById('thumb-drop-area').style.display = 'none';
    }
    // Existing slides
    existingSlides = lesson.slides ? [...lesson.slides] : [];
    renderSlidePreviews();
  } catch (e) {
    showToast('読み込みに失敗: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── 保存 ─────────────────────────────────────────────────────
async function saveLesson() {
  const title = document.getElementById('title').value.trim();
  if (!title) {
    document.getElementById('title-error').textContent = 'タイトルを入力してください';
    document.getElementById('title').focus();
    return;
  }
  document.getElementById('title-error').textContent = '';

  showLoading(true);
  try {
    await setupStudyFolders();

    // Upload thumbnail
    let thumbnailFileId = existingThumbFileId || null;
    if (selectedThumb) {
      showToast('サムネイルをアップロード中...', 'info');
      const r = await uploadFileToDrive(
        selectedThumb.file, appState.studySlidesFolderId,
        `thumb_${Date.now()}.${selectedThumb.file.name.split('.').pop()}`
      );
      thumbnailFileId = r.id;
    }

    // Upload new slides
    const slides = [...existingSlides];
    for (let i = 0; i < selectedFiles.length; i++) {
      showToast(`スライドをアップロード中... (${i+1}/${selectedFiles.length})`, 'info');
      const r = await uploadFileToDrive(
        selectedFiles[i].file, appState.studySlidesFolderId,
        `slide_${Date.now()}_${i}.${selectedFiles[i].file.name.split('.').pop()}`
      );
      slides.push({ fileId: r.id, name: r.name, fileType: selectedFiles[i].fileType || 'image' });
    }

    const scratchUrl = document.getElementById('scratch-url').value.trim();

    if (editId) {
      // 編集：既存レッスンを更新
      await loadLessons();
      const idx = appState.lessons.findIndex(l => l.id === editId);
      if (idx !== -1) {
        appState.lessons[idx] = {
          ...appState.lessons[idx],
          title,
          category: document.getElementById('category').value,
          difficulty: selectedDiff,
          scratchUrl,
          scratchProjectId: getScratchProjectId(scratchUrl) || '',
          thumbnailFileId,
          slides,
          description: document.getElementById('description').value.trim(),
          updatedAt: new Date().toISOString(),
        };
      }
    } else {
      // 新規追加
      await loadLessons();
      appState.lessons.push({
        id: 'lesson_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
        title,
        category: document.getElementById('category').value,
        difficulty: selectedDiff,
        scratchUrl,
        scratchProjectId: getScratchProjectId(scratchUrl) || '',
        thumbnailFileId,
        slides,
        description: document.getElementById('description').value.trim(),
        createdAt: new Date().toISOString(),
      });
    }

    await saveLessons();
    showToast(editId ? '演習を更新しました！' : '演習を追加しました！', 'success');
    setTimeout(() => { window.location.href = 'study.html'; }, 800);
  } catch (e) {
    showToast('保存に失敗しました: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}
