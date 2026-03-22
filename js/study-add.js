// ============================================================
// study-add.js - レッスン追加ページ
// ============================================================

let selectedFiles = []; // { file, previewUrl }
let selectedDiff = 'かんたん';

function onSignIn() { /* already signed in via session */ }
function onSignOut() { window.location.href = 'study.html'; }

document.addEventListener('DOMContentLoaded', () => {
  updateThemeIcon();

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

  // Slide file input
  const dropArea = document.getElementById('slide-drop-area');
  const fileInput = document.getElementById('slide-files');

  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => addFiles(e.target.files));
  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('dragover'); });
  dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
  });

  // Scratch URL preview
  document.getElementById('scratch-url').addEventListener('input', e => {
    const id = getScratchProjectId(e.target.value);
    const preview = document.getElementById('scratch-preview');
    if (id) {
      preview.innerHTML = `<div style="background:var(--primary-50);border:1.5px solid var(--primary-light);border-radius:10px;padding:10px 14px;font-size:0.82rem;color:var(--primary)">✅ プロジェクトID: <strong>${id}</strong></div>`;
    } else {
      preview.innerHTML = '';
    }
  });

  // Save buttons
  document.getElementById('save-btn').addEventListener('click', saveLesson);
  document.getElementById('save-btn2').addEventListener('click', saveLesson);

  // Auth
  showLoading(true);
  const tryInit = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      const ok = initGoogleAuth();
      if (!ok) { showLoading(false); window.location.href = 'study.html'; return; }
      if (tryRestoreSession()) { showLoading(false); return; }
      tokenClient.requestAccessToken({ prompt: '' });
    } else { setTimeout(tryInit, 200); }
  };
  showLoading(false);
  tryInit();
});

function addFiles(fileList) {
  Array.from(fileList).forEach(f => {
    if (!f.type.startsWith('image/')) return;
    const url = URL.createObjectURL(f);
    selectedFiles.push({ file: f, previewUrl: url });
  });
  renderSlidePreviews();
}

function removeSlide(idx) {
  selectedFiles.splice(idx, 1);
  renderSlidePreviews();
}

function renderSlidePreviews() {
  const grid = document.getElementById('slide-preview-grid');
  grid.innerHTML = selectedFiles.map((s, i) => `
    <div class="slide-thumb-item">
      <img src="${s.previewUrl}" alt="slide ${i+1}">
      <button class="slide-thumb-remove" onclick="removeSlide(${i})">✕</button>
    </div>
  `).join('');
}

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

    // Upload slide images
    const slides = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      showToast(`スライドをアップロード中... (${i+1}/${selectedFiles.length})`, 'info');
      const result = await uploadFileToDrive(
        selectedFiles[i].file,
        appState.studySlidesFolderId,
        `slide_${Date.now()}_${i}.${selectedFiles[i].file.name.split('.').pop()}`
      );
      slides.push({ fileId: result.id, name: result.name });
    }

    // Build lesson object
    const scratchUrl = document.getElementById('scratch-url').value.trim();
    const lesson = {
      id: 'lesson_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
      title,
      category: document.getElementById('category').value,
      difficulty: selectedDiff,
      scratchUrl,
      scratchProjectId: getScratchProjectId(scratchUrl) || '',
      slides,
      description: document.getElementById('description').value.trim(),
      createdAt: new Date().toISOString(),
    };

    // Load existing lessons then append
    await loadLessons();
    appState.lessons.push(lesson);
    await saveLessons();

    showToast('レッスンを保存しました！', 'success');
    setTimeout(() => { window.location.href = 'study.html'; }, 800);
  } catch (e) {
    showToast('保存に失敗しました: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}
