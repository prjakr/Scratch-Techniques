// ============================================================
// detail.js - Technique Detail Page
// ============================================================

let currentTechnique = null;

async function onSignIn() {
  showLoading(true);
  try {
    await loadTechniques();
    const id = getUrlParam('id');
    if (!id) { window.location.href = 'index.html'; return; }
    currentTechnique = getTechniqueById(id);
    if (!currentTechnique) {
      showToast('テクニックが見つかりません', 'error');
      setTimeout(() => { window.location.href = 'index.html'; }, 1500);
      return;
    }
    renderDetail(currentTechnique);
    setClaudeContext(currentTechnique);
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
// RENDER
// ============================================================
function renderDetail(t) {
  document.title = `${t.title} - Scratch Techniques`;

  // Header
  document.getElementById('detail-title').textContent = t.title;

  // Scratch section
  renderScratchSection(t);

  // Description
  const descEl = document.getElementById('description-content');
  if (descEl) {
    descEl.innerHTML = t.description
      ? renderMarkdown(t.description)
      : '<p style="color:var(--text-muted)">解説はまだありません。</p>';
  }

  // Metadata
  renderMeta(t);

  // SB3 section
  renderSb3Section(t);
}

function renderScratchSection(t) {
  const scratchId = getScratchProjectId(t.scratchUrl || '');
  const container = document.getElementById('scratch-container');
  if (!container) return;

  if (scratchId) {
    container.innerHTML = `
      <div class="scratch-scale-wrap" id="scratch-scale">
        <iframe
          src="https://scratch.mit.edu/projects/${scratchId}/embed"
          allowtransparency="true" allowfullscreen
          id="scratch-iframe"
          title="${escapeHtml(t.title)}">
        </iframe>
      </div>
      <div class="scratch-player-controls">
        <span style="font-size:0.76rem;color:#94a3b8;flex:1">📋 ID: ${scratchId}</span>
        <button class="scratch-ctrl-btn" onclick="scratchFullscreen()">⛶ 全画面</button>
        <a href="${escapeHtml(t.scratchUrl)}" target="_blank" rel="noopener" class="scratch-ctrl-btn">🔗 Scratchで開く</a>
      </div>`;
    requestAnimationFrame(scaleScratch);
    window.addEventListener('resize', scaleScratch, { passive: true });
  } else if (t.scratchUrl) {
    container.innerHTML = `
      <div class="scratch-no-url">
        <span style="font-size:64px;animation:float 3s ease-in-out infinite">🐱</span>
        <h4 style="font-size:1rem;font-weight:700;color:var(--text)">${escapeHtml(t.title)}</h4>
        <p style="color:var(--text-muted);font-size:0.875rem">Scratchでプロジェクトを開きます</p>
        <a href="${escapeHtml(t.scratchUrl)}" target="_blank" rel="noopener" class="btn btn-primary btn-lg">
          🔗 Scratchで開く
        </a>
      </div>`;
  } else {
    container.innerHTML = `
      <div class="scratch-no-url">
        <span style="font-size:48px;opacity:0.3">🐱</span>
        <p style="color:var(--text-muted)">ScratchプロジェクトのURLが登録されていません</p>
      </div>`;
  }
}

// スマホ対応：Scratchを画面幅に合わせてスケーリング
function scaleScratch() {
  const wrap = document.getElementById('scratch-scale');
  if (!wrap) return;
  const iframe = document.getElementById('scratch-iframe');
  if (!iframe) return;
  const w = wrap.offsetWidth || wrap.parentElement?.offsetWidth || 480;
  const scale = Math.min(1, w / 480);
  iframe.style.width = '480px';
  iframe.style.height = '360px';
  iframe.style.transform = `scale(${scale})`;
  iframe.style.transformOrigin = 'top left';
  wrap.style.height = `${Math.round(360 * scale)}px`;
}

// 全画面ボタン
window.scratchFullscreen = function() {
  const el = document.getElementById('scratch-iframe');
  if (!el) return;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
  if (fn) fn.call(el);
};

function renderMeta(t) {
  const el = document.getElementById('meta-list');
  if (!el) return;

  const scratchId = getScratchProjectId(t.scratchUrl || '');
  el.innerHTML = `
    <div class="meta-item">
      <span class="meta-label">カテゴリ</span>
      <span class="meta-value">
        <span class="badge badge-category">${CATEGORY_EMOJI[t.category] || '🎮'} ${escapeHtml(t.category || 'その他')}</span>
      </span>
    </div>
    ${(t.tags?.length) ? `
    <div class="meta-item">
      <span class="meta-label">タグ</span>
      <div class="card-tags" style="flex-wrap:wrap;gap:6px">
        ${t.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
    </div>` : ''}
    ${t.scratchUrl ? `
    <div class="meta-item">
      <span class="meta-label">Scratch</span>
      <span class="meta-value">
        <a href="${escapeHtml(t.scratchUrl)}" target="_blank" rel="noopener"
          style="color:var(--primary);text-decoration:none;font-size:0.85rem">
          🔗 プロジェクトを開く ↗
        </a>
      </span>
    </div>` : ''}
    <div class="meta-item">
      <span class="meta-label">作成日</span>
      <span class="meta-value">${formatDate(t.createdAt)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">更新日</span>
      <span class="meta-value">${formatDate(t.updatedAt)}</span>
    </div>`;
}

function renderSb3Section(t) {
  const panel = document.getElementById('sb3-panel');
  if (!panel) return;
  if (t.sb3FileId) {
    panel.innerHTML = `
      <div class="sb3-info">
        <span class="sb3-icon">📦</span>
        <div>
          <h4>${escapeHtml(t.sb3FileName || 'project.sb3')}</h4>
          <p>Scratchプロジェクトファイル</p>
        </div>
      </div>
      <a href="https://drive.google.com/uc?export=download&id=${t.sb3FileId}"
        download class="btn btn-success">
        ⬇️ ダウンロード
      </a>`;
  } else {
    panel.innerHTML = `
      <div class="sb3-info">
        <span class="sb3-icon" style="opacity:0.3">📦</span>
        <div>
          <p style="color:var(--text-muted);font-size:0.85rem">sb3ファイルは登録されていません</p>
        </div>
      </div>`;
  }
}

// ============================================================
// DELETE
// ============================================================
function confirmDelete() {
  document.getElementById('delete-modal')?.classList.add('visible');
}

function closeDeleteModal() {
  document.getElementById('delete-modal')?.classList.remove('visible');
}

async function doDelete() {
  if (!currentTechnique) return;
  showLoading(true);
  try {
    await deleteTechnique(currentTechnique.id);
    showToast('削除しました', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
  } catch (e) {
    console.error(e);
    showToast('削除に失敗しました: ' + e.message, 'error');
    showLoading(false);
    closeDeleteModal();
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('back-btn')?.addEventListener('click', () => {
    window.history.length > 1 ? history.back() : window.location.href = 'index.html';
  });
  document.getElementById('edit-btn')?.addEventListener('click', () => {
    if (currentTechnique) window.location.href = `add.html?id=${currentTechnique.id}`;
  });
  document.getElementById('delete-btn')?.addEventListener('click', confirmDelete);
  document.getElementById('modal-cancel')?.addEventListener('click', closeDeleteModal);
  document.getElementById('modal-delete')?.addEventListener('click', doDelete);

  showLoading(true);
  const tryInit = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      const ok = initGoogleAuth();
      if (!ok) {
        window.location.href = 'settings.html';
        return;
      }
      // セッションが残っていればGoogle窓を出さずに復元
      if (tryRestoreSession()) { onSignIn(); return; }
      // セッションなし → index へ（サブページでは popup を出さない）
      window.location.href = 'index.html';
    } else {
      setTimeout(tryInit, 200);
    }
  };
  tryInit();
});
