// ============================================================
// study-lesson.js - 授業ビューア（Scratch + スライド）
// ============================================================

let lesson = null;
let currentSlide = 0;

function onSignIn() { /* unused - session restored */ }
function onSignOut() { window.location.href = 'study.html'; }

async function initLesson() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { window.location.href = 'study.html'; return; }

  showLoading(true);
  try {
    await loadLessons();
    lesson = appState.lessons.find(l => l.id === id);
    if (!lesson) { showToast('レッスンが見つかりません', 'error'); setTimeout(() => window.location.href = 'study.html', 1500); return; }

    renderLesson();
  } catch (e) {
    showToast('読み込みに失敗しました: ' + e.message, 'error');
  } finally {
    showLoading(false);
    document.getElementById('app-content').classList.remove('hidden');
  }
}

function renderLesson() {
  // Title & difficulty
  document.title = lesson.title + ' - べんきょうアプリ';
  document.getElementById('lesson-title').textContent = lesson.title;
  const diffMap = { 'かんたん': '⭐', 'ふつう': '⭐⭐', 'むずかしい': '⭐⭐⭐' };
  document.getElementById('lesson-diff').textContent = diffMap[lesson.difficulty] || '';

  // Scratch
  const pid = lesson.scratchProjectId || getScratchProjectId(lesson.scratchUrl || '');
  if (pid) {
    document.getElementById('scratch-iframe').src = `https://scratch.mit.edu/projects/${pid}/embed`;
    document.getElementById('scratch-open-btn').href = `https://scratch.mit.edu/projects/${pid}`;
    document.getElementById('scratch-btns').style.display = '';
    document.getElementById('scratch-no-url').style.display = 'none';
  } else {
    document.getElementById('scratch-iframe').src = 'about:blank';
    document.getElementById('scratch-btns').style.display = 'none';
    document.getElementById('scratch-no-url').style.display = '';
  }

  // Slides
  renderSlide();
}

function renderSlide() {
  const slides = lesson.slides || [];
  const img = document.getElementById('slide-img');
  const empty = document.getElementById('slide-empty');
  const counter = document.getElementById('slide-counter');
  const dots = document.getElementById('slide-dots');
  const nav = document.getElementById('slide-nav-bar');
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');

  const iframe = document.getElementById('slide-iframe');
  if (slides.length === 0) {
    img.style.display = 'none';
    iframe.style.display = 'none';
    empty.style.display = '';
    nav.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  nav.style.display = '';
  const slide = slides[currentSlide];
  if (slide.fileType === 'pdf' || slide.fileType === 'pptx') {
    img.style.display = 'none';
    iframe.style.display = '';
    iframe.src = `https://drive.google.com/file/d/${slide.fileId}/preview`;
  } else {
    iframe.style.display = 'none';
    img.style.display = '';
    img.src = getDriveImageUrl(slide.fileId);
  }
  counter.textContent = `${currentSlide + 1} / ${slides.length}`;

  // Dots
  dots.innerHTML = slides.map((_, i) => `
    <button class="slide-dot ${i === currentSlide ? 'active' : ''}" onclick="goSlide(${i})"></button>
  `).join('');

  prevBtn.disabled = currentSlide === 0;
  nextBtn.disabled = currentSlide === slides.length - 1;
  prevBtn.style.opacity = currentSlide === 0 ? '0.3' : '1';
  nextBtn.style.opacity = currentSlide === slides.length - 1 ? '0.3' : '1';
}

function prevSlide() {
  if (currentSlide > 0) { currentSlide--; renderSlide(); }
}
function nextSlide() {
  if (lesson && currentSlide < (lesson.slides?.length || 0) - 1) { currentSlide++; renderSlide(); }
}
function goSlide(i) { currentSlide = i; renderSlide(); }

// Keyboard navigation
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevSlide();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextSlide();
});

document.addEventListener('DOMContentLoaded', () => {
  updateThemeIcon();

  showLoading(true);
  const tryInit = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      const ok = initGoogleAuth();
      if (!ok) { showLoading(false); window.location.href = 'study.html'; return; }
      if (tryRestoreSession()) { initLesson(); return; }
      const clientId = localStorage.getItem('google_client_id');
      if (clientId) {
        const orig = tokenClient.callback;
        tokenClient.callback = async resp => {
          orig && orig(resp);
          if (!resp.error) await initLesson();
        };
        tokenClient.requestAccessToken({ prompt: '' });
      } else {
        showLoading(false);
        window.location.href = 'study.html';
      }
    } else { setTimeout(tryInit, 200); }
  };
  tryInit();
});
