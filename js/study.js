// ============================================================
// study.js - べんきょうアプリ レッスン一覧
// ============================================================

const SUBJECTS = [
  { id: 'all',        label: 'ぜんぶ',  emoji: '🎯', color: '#6366f1' },
  { id: 'きほん',     label: 'きほん',  emoji: '⭐', color: '#6366f1' },
  { id: 'うごき',     label: 'うごき',  emoji: '🏃', color: '#f97316' },
  { id: 'みため',     label: 'みため',  emoji: '👀', color: '#ec4899' },
  { id: 'おと・音楽', label: 'おと',    emoji: '🎵', color: '#8b5cf6' },
  { id: 'せいぎょ',   label: 'せいぎょ',emoji: '🔄', color: '#10b981' },
  { id: 'ゲーム作り', label: 'ゲーム',  emoji: '🎮', color: '#3b82f6' },
  { id: 'アート・アニメ', label: 'アート', emoji: '🎨', color: '#f59e0b' },
];
const DIFFS = [
  { id: 'all',     label: 'ぜんぶ' },
  { id: 'かんたん', label: '⭐ かんたん' },
  { id: 'ふつう',  label: '⭐⭐ ふつう' },
  { id: 'むずかしい', label: '⭐⭐⭐ むずかしい' },
];

let currentSubject = 'all';
let currentDiff = 'all';

function renderSubjects() {
  const list = document.getElementById('subject-list');
  if (!list) return;
  list.innerHTML = SUBJECTS.map(s => `
    <button class="study-subject-btn ${s.id === currentSubject ? 'active' : ''}"
      style="--s-color:${s.color}" onclick="selectSubject('${s.id}')">
      <span class="subj-emoji">${s.emoji}</span>
      <span class="subj-label">${s.label}</span>
    </button>
  `).join('');
}

function renderDiffs() {
  const list = document.getElementById('difficulty-list');
  if (!list) return;
  list.innerHTML = DIFFS.map(d => `
    <button class="grade-btn ${d.id === currentDiff ? 'active' : ''}"
      onclick="selectDiff('${d.id}')">${d.label}</button>
  `).join('');
}

function selectSubject(s) { currentSubject = s; renderSubjects(); renderCards(); }
function selectDiff(d) { currentDiff = d; renderDiffs(); renderCards(); }

function getFiltered() {
  let items = appState.lessons || [];
  if (currentSubject !== 'all') items = items.filter(l => l.category === currentSubject);
  if (currentDiff !== 'all') items = items.filter(l => l.difficulty === currentDiff);
  return items;
}

function diffStars(d) {
  return { 'かんたん': '⭐', 'ふつう': '⭐⭐', 'むずかしい': '⭐⭐⭐' }[d] || '';
}

function renderCards() {
  const items = getFiltered();
  const grid = document.getElementById('study-grid');
  const countEl = document.getElementById('study-count');
  if (!grid) return;

  if (items.length === 0) {
    if (countEl) countEl.textContent = '';
    grid.innerHTML = `
      <div class="study-empty">
        <div class="study-empty-icon">📝</div>
        <p>まだレッスンがありません</p>
        <p style="font-size:0.82rem;color:var(--text-light);margin-bottom:20px">
          ＋ボタンからレッスンを追加しよう！<br>
          スライドとScratchをセットで登録できます。
        </p>
        <a href="study-add.html" class="btn btn-primary">＋ レッスンを追加</a>
      </div>
    `;
    return;
  }

  if (countEl) countEl.textContent = `${items.length} レッスン`;
  const color = c => STUDY_COLORS[c] || '#6366f1';
  const emoji = c => ({ 'きほん':'⭐','うごき':'🏃','みため':'👀','おと・音楽':'🎵','せいぎょ':'🔄','ゲーム作り':'🎮','アート・アニメ':'🎨' }[c] || '📚');

  grid.innerHTML = items.map(l => {
    const thumb = l.slides?.[0]
      ? `<img src="${getDriveImageUrl(l.slides[0].fileId)}" alt="" loading="lazy">`
      : `<span>${emoji(l.category)}</span>`;
    return `
      <div class="study-card" style="--card-color:${color(l.category)}">
        <div class="study-card-thumb">${thumb}</div>
        <div class="study-card-top">
          <span class="study-card-emoji">${emoji(l.category)}</span>
          <span class="study-card-cat">${escapeHtml(l.category || '')}</span>
        </div>
        <h3 class="study-card-title">${escapeHtml(l.title)}</h3>
        <div class="study-diff">${diffStars(l.difficulty)}</div>
        <a href="study-lesson.html?id=${l.id}" class="study-play-btn">▶ はじめる</a>
      </div>
    `;
  }).join('');
}

async function onSignIn() {
  showLoading(true);
  try {
    await loadLessons();
    document.getElementById('auth-screen')?.classList.remove('visible');
    document.getElementById('app-content')?.classList.remove('hidden');
    document.getElementById('fab-add').style.display = '';
    renderSubjects();
    renderDiffs();
    renderCards();
  } catch (e) {
    showToast('読み込みに失敗しました: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

function onSignOut() {
  document.getElementById('app-content')?.classList.add('hidden');
  document.getElementById('auth-screen')?.classList.add('visible');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('signin-btn')?.addEventListener('click', signIn);
  renderSubjects();
  renderDiffs();
  updateThemeIcon();

  showLoading(true);
  const tryInit = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      const ok = initGoogleAuth();
      if (!ok) { showLoading(false); document.getElementById('auth-screen')?.classList.add('visible'); return; }
      if (tryRestoreSession()) { onSignIn(); return; }
      const clientId = localStorage.getItem('google_client_id');
      if (clientId && appState.studyDataFileId) {
        tokenClient.requestAccessToken({ prompt: '' });
      } else if (clientId) {
        tokenClient.requestAccessToken({ prompt: '' });
      } else {
        showLoading(false);
        document.getElementById('auth-screen')?.classList.add('visible');
      }
    } else { setTimeout(tryInit, 200); }
  };
  tryInit();
});
