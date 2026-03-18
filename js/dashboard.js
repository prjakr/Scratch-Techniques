// ============================================================
// dashboard.js - Dashboard Logic
// ============================================================

let currentCategory = 'すべて';
let searchQuery = '';

async function onSignIn() {
  showLoading(true);
  try {
    await loadTechniques();
    document.getElementById('auth-screen')?.classList.remove('visible');
    document.getElementById('app-content')?.classList.remove('hidden');
    renderCategoryBar();
    renderCards();
    updateCountDisplay();
  } catch (e) {
    console.error('Sign-in setup failed:', e);
    showToast('データの読み込みに失敗しました: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

function onSignOut() {
  document.getElementById('app-content')?.classList.add('hidden');
  document.getElementById('auth-screen')?.classList.add('visible');
}

// ============================================================
// RENDER
// ============================================================
function renderCategoryBar() {
  const list = document.getElementById('category-list');
  if (!list) return;
  list.innerHTML = buildCategoryList(
    CATEGORIES.indexOf(currentCategory) >= 0 ? CATEGORIES.indexOf(currentCategory) : 0
  );
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    currentCategory = btn.dataset.cat;
    list.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCards();
    updateCountDisplay();
  });
}

function getFilteredTechniques() {
  let list = appState.techniques;
  if (currentCategory !== 'すべて') {
    list = list.filter(t => t.category === currentCategory);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(q)) ||
      t.category?.toLowerCase().includes(q)
    );
  }
  return list;
}

function renderCards() {
  const grid = document.getElementById('cards-grid');
  if (!grid) return;
  const techs = getFilteredTechniques();

  if (!techs.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🎮</span>
        <h3>${searchQuery ? '検索結果なし' : 'テクニックがありません'}</h3>
        <p>${searchQuery ? `「${escapeHtml(searchQuery)}」に一致するテクニックは見つかりませんでした。` : 'まだテクニックが登録されていません。'}</p>
        ${!searchQuery ? '<a href="add.html" class="btn btn-primary btn-lg">➕ テクニックを追加する</a>' : ''}
      </div>`;
    return;
  }

  grid.innerHTML = techs.map(t => cardHTML(t)).join('');
  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `detail.html?id=${card.dataset.id}`;
    });
  });
}

function cardHTML(t) {
  const scratchId = getScratchProjectId(t.scratchUrl || '');
  const thumbHTML = `<span class="card-thumb-placeholder">${CATEGORY_EMOJI[t.category] || '🎮'}</span>`;

  const tagsHTML = (t.tags || []).slice(0, 3).map(tag =>
    `<span class="tag">${escapeHtml(tag)}</span>`
  ).join('') + (t.tags?.length > 3 ? `<span class="tag">+${t.tags.length - 3}</span>` : '');

  return `
    <div class="card" data-id="${t.id}" data-cat="${escapeHtml(t.category || '')}">
      <div class="card-thumb">
        ${thumbHTML}
        <div class="card-overlay">
          <span class="card-overlay-text">▶ 詳細を見る</span>
        </div>
        <span class="card-category">${escapeHtml(t.category || 'その他')}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(t.title)}</h3>
        ${tagsHTML ? `<div class="card-tags">${tagsHTML}</div>` : ''}
        <div class="card-footer">
          <span class="card-date">📅 ${formatDate(t.createdAt)}</span>
          ${scratchId ? '<span class="card-badge">🐱 Scratch</span>' : ''}
          ${t.sb3FileId ? '<span class="card-badge">📦 sb3</span>' : ''}
        </div>
      </div>
    </div>`;
}

function updateCountDisplay() {
  const count = document.getElementById('count-display');
  if (!count) return;
  const techs = getFilteredTechniques();
  const cat = currentCategory === 'すべて' ? '全テクニック' : currentCategory;
  count.innerHTML = `<span>${techs.length}</span> 件の${cat}`;
}

// ============================================================
// SEARCH
// ============================================================
function initSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchQuery = input.value.trim();
      renderCards();
      updateCountDisplay();
    }, 250);
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Build category bar placeholder
  const catList = document.getElementById('category-list');
  if (catList) catList.innerHTML = buildCategoryList(0);

  initSearch();

  // Sign in button
  document.getElementById('signin-btn')?.addEventListener('click', signIn);

  showLoading(true);
  // Wait for Google Identity Services to load
  const tryInit = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      const ok = initGoogleAuth();
      if (!ok) {
        showLoading(false);
        document.getElementById('auth-screen')?.classList.add('visible');
        return;
      }
      // Try silent sign-in
      const clientId = localStorage.getItem('google_client_id');
      if (clientId && appState.dataFileId) {
        // セッションが残っていればGoogle窓を出さずに復元
        if (tryRestoreSession()) { onSignIn(); return; }
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
