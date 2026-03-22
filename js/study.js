// ============================================================
// study.js - 小学生べんきょうアプリ
// ============================================================

const SUBJECTS = [
  { id: 'all',       label: 'ぜんぶ',    emoji: '🎯', color: '#6366f1' },
  { id: 'きほん',    label: 'きほん',    emoji: '⭐', color: '#6366f1' },
  { id: 'うごき',    label: 'うごき',    emoji: '🏃', color: '#f97316' },
  { id: 'みため',    label: 'みため',    emoji: '👀', color: '#ec4899' },
  { id: 'おと・音楽', label: 'おと',     emoji: '🎵', color: '#8b5cf6' },
  { id: 'せいぎょ',  label: 'せいぎょ',  emoji: '🔄', color: '#10b981' },
  { id: 'ゲーム作り', label: 'ゲーム',   emoji: '🎮', color: '#3b82f6' },
  { id: 'アート・アニメ', label: 'アート', emoji: '🎨', color: '#f59e0b' },
];

const GRADES = [
  { id: 'all',    label: 'ぜんぶ' },
  { id: 'かんたん', label: 'かんたん' },
  { id: 'ふつう',  label: 'ふつう'  },
  { id: 'むずかしい', label: 'むずかしい' },
];

let currentSubject = 'all';
let currentGrade = 'all';

function renderSubjects() {
  const list = document.getElementById('subject-list');
  if (!list) return;
  list.innerHTML = SUBJECTS.map(s => `
    <button class="study-subject-btn ${s.id === currentSubject ? 'active' : ''}"
      data-subj="${s.id}" style="--s-color:${s.color}"
      onclick="selectSubject('${s.id}')">
      <span class="subj-emoji">${s.emoji}</span>
      <span class="subj-label">${s.label}</span>
    </button>
  `).join('');
}

function renderGrades() {
  const list = document.getElementById('grade-list');
  if (!list) return;
  list.innerHTML = GRADES.map(g => `
    <button class="grade-btn ${g.id === currentGrade ? 'active' : ''}"
      data-grade="${g.id}" onclick="selectGrade('${g.id}')">
      ${g.label}
    </button>
  `).join('');
}

function selectSubject(subj) {
  currentSubject = subj;
  renderSubjects();
  renderCards();
}

function selectGrade(grade) {
  currentGrade = grade;
  renderGrades();
  renderCards();
}

function getFilteredItems() {
  let items = appState.techniques.filter(t => STUDY_CATEGORIES.includes(t.category));
  if (currentSubject !== 'all') {
    items = items.filter(t => t.category === currentSubject);
  }
  if (currentGrade !== 'all') {
    items = items.filter(t => (t.tags || []).includes(currentGrade));
  }
  return items;
}

function renderCards() {
  const items = getFilteredItems();
  const grid = document.getElementById('study-grid');
  const countEl = document.getElementById('study-count');
  if (!grid) return;

  if (items.length === 0) {
    if (countEl) countEl.textContent = '';
    grid.innerHTML = `
      <div class="study-empty">
        <div class="study-empty-icon">📝</div>
        <p>まだコンテンツがありません</p>
        <p style="font-size:0.82rem;color:var(--text-light);margin-bottom:20px">
          「追加」ボタンから勉強コンテンツを登録しよう！<br>
          カテゴリに「算数」「国語」などを選ぶと表示されます。
        </p>
        <a href="add.html" class="btn btn-primary">＋ 追加する</a>
      </div>
    `;
    return;
  }

  if (countEl) countEl.textContent = `${items.length} こ あります`;
  grid.innerHTML = items.map(t => {
    const color = STUDY_COLORS[t.category] || '#6366f1';
    const emoji = CATEGORY_EMOJI[t.category] || '📚';
    const tags = (t.tags || []);
    return `
      <div class="study-card" style="--card-color:${color}">
        <div class="study-card-top">
          <span class="study-card-emoji">${emoji}</span>
          <span class="study-card-cat">${escapeHtml(t.category)}</span>
        </div>
        <h3 class="study-card-title">${escapeHtml(t.title)}</h3>
        ${tags.length ? `<div class="study-card-tags">${tags.map(tag => `<span class="study-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        <a href="detail.html?id=${t.id}" class="study-play-btn">▶ あそぶ！</a>
      </div>
    `;
  }).join('');
}

async function onSignIn() {
  showLoading(true);
  try {
    await loadTechniques();
    document.getElementById('auth-screen')?.classList.remove('visible');
    document.getElementById('app-content')?.classList.remove('hidden');
    renderSubjects();
    renderGrades();
    renderCards();
  } catch (e) {
    showToast('データの読み込みに失敗しました: ' + e.message, 'error');
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
  renderGrades();
  updateThemeIcon();

  showLoading(true);
  const tryInit = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      const ok = initGoogleAuth();
      if (!ok) {
        showLoading(false);
        document.getElementById('auth-screen')?.classList.add('visible');
        return;
      }
      if (tryRestoreSession()) { onSignIn(); return; }
      const clientId = localStorage.getItem('google_client_id');
      if (clientId && appState.dataFileId) {
        tokenClient.requestAccessToken({ prompt: '' });
      } else {
        showLoading(false);
        document.getElementById('auth-screen')?.classList.add('visible');
      }
    } else {
      setTimeout(tryInit, 200);
    }
  };
  tryInit();
});
