// ============================================================
// claude.js - AI Chat Panel (Google Gemini API - 完全無料)
// モデル: gemini-2.5-flash  無料枠: 1日1500回・毎分15回
// ============================================================

const claudeState = {
  isOpen: false,
  messages: [],   // {role: 'user'|'assistant', content}
  isLoading: false,
  context: null,
};

// ============================================================
// PANEL HTML
// ============================================================
function createClaudePanel() {
  const panel = document.createElement('div');
  panel.className = 'claude-panel';
  panel.id = 'claude-panel';
  panel.innerHTML = `
    <div class="claude-panel-header">
      <div class="claude-avatar">✨</div>
      <div class="claude-header-text">
        <h3>AI アシスタント</h3>
        <p>Gemini 1.5 Flash・完全無料</p>
      </div>
      <button class="claude-close" id="claude-close" title="閉じる">✕</button>
    </div>
    <div class="claude-messages" id="claude-messages">
      <div class="chat-msg assistant" id="claude-welcome">
        こんにちは！Scratchプログラミングについてなんでも聞いてください 🐱<br><br>
        💡 例えば：<br>
        • 「スクロール背景の作り方を教えて」<br>
        • 「当たり判定を実装するには？」<br>
        • 「ジャンプのコードを解説して」
      </div>
    </div>
    <div class="claude-quick" id="claude-quick">
      <button class="quick-btn" data-q="Scratchでジャンプを実装するには？">ジャンプ</button>
      <button class="quick-btn" data-q="Scratchでスコアを表示するには？">スコア表示</button>
      <button class="quick-btn" data-q="Scratchでクローンを使うには？">クローン</button>
      <button class="quick-btn" data-q="Scratchで音楽に合わせたゲームを作るには？">音楽同期</button>
    </div>
    <div class="claude-input-wrap">
      <textarea class="claude-input" id="claude-input"
        placeholder="Scratchについて質問する..." rows="1"
        maxlength="2000"></textarea>
      <button class="claude-send" id="claude-send" title="送信">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>
    <div id="claude-no-key" class="claude-no-key" style="display:none">
      ⚠️ Gemini APIキーが設定されていません。<br>
      <a href="settings.html">設定ページ</a>で無料で取得できます。
    </div>
  `;
  document.body.appendChild(panel);

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'claude-overlay';
  overlay.addEventListener('click', closeClaudePanel);
  document.body.appendChild(overlay);

  // FAB
  const fab = document.createElement('button');
  fab.className = 'fab fab-claude';
  fab.id = 'fab-claude';
  fab.title = 'AIアシスタントに質問する';
  fab.innerHTML = '✨';
  fab.addEventListener('click', toggleClaudePanel);
  document.body.appendChild(fab);

  // Event bindings
  document.getElementById('claude-close').addEventListener('click', closeClaudePanel);
  document.getElementById('claude-send').addEventListener('click', sendMessage);
  document.getElementById('claude-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('claude-input').addEventListener('input', autoResize);
  document.getElementById('claude-quick').addEventListener('click', (e) => {
    const btn = e.target.closest('.quick-btn');
    if (!btn) return;
    document.getElementById('claude-input').value = btn.dataset.q;
    sendMessage();
  });

  checkApiKey();
}

function checkApiKey() {
  const key = getGeminiKey();
  const noKey = document.getElementById('claude-no-key');
  const inputWrap = document.querySelector('.claude-input-wrap');
  const quick = document.getElementById('claude-quick');
  const hasKey = !!key;
  if (noKey)    noKey.style.display    = hasKey ? 'none' : 'block';
  if (inputWrap) inputWrap.style.display = hasKey ? 'flex' : 'none';
  if (quick)    quick.style.display    = hasKey ? 'flex' : 'none';
}

// ============================================================
// OPEN / CLOSE
// ============================================================
function openClaudePanel() {
  claudeState.isOpen = true;
  document.getElementById('claude-panel')?.classList.add('open');
  document.getElementById('claude-overlay')?.classList.add('visible');
  document.getElementById('claude-input')?.focus();
}
function closeClaudePanel() {
  claudeState.isOpen = false;
  document.getElementById('claude-panel')?.classList.remove('open');
  document.getElementById('claude-overlay')?.classList.remove('visible');
}
function toggleClaudePanel() {
  claudeState.isOpen ? closeClaudePanel() : openClaudePanel();
}

// ============================================================
// CONTEXT (テクニック詳細ページから設定)
// ============================================================
function setClaudeContext(technique) {
  claudeState.context = technique;
  if (!technique) return;
  const quick = document.getElementById('claude-quick');
  if (!quick) return;
  quick.innerHTML = `
    <button class="quick-btn" data-q="このテクニック「${technique.title}」をもっと詳しく説明して">詳しく解説</button>
    <button class="quick-btn" data-q="このテクニック「${technique.title}」の応用例は？">応用例</button>
    <button class="quick-btn" data-q="このテクニック「${technique.title}」に似た別の方法はある？">別の方法</button>
    <button class="quick-btn" data-q="このテクニック「${technique.title}」を初心者向けに説明して">初心者向け</button>
  `;
  quick.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('claude-input').value = btn.dataset.q;
      sendMessage();
    });
  });
}

// ============================================================
// CHAT
// ============================================================
function autoResize() {
  const el = document.getElementById('claude-input');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function appendMsg(role, content) {
  const msgs = document.getElementById('claude-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = role === 'assistant' ? renderChatMd(content) : escapeHtml(content);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function showTyping() {
  const msgs = document.getElementById('claude-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'chat-typing'; div.id = 'ai-typing';
  div.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}
function removeTyping() { document.getElementById('ai-typing')?.remove(); }

async function sendMessage() {
  if (claudeState.isLoading) return;
  const input = document.getElementById('claude-input');
  const sendBtn = document.getElementById('claude-send');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const apiKey = getGeminiKey();
  if (!apiKey) { checkApiKey(); return; }

  input.value = '';
  input.style.height = 'auto';
  appendMsg('user', text);
  claudeState.messages.push({ role: 'user', content: text });
  claudeState.isLoading = true;
  if (sendBtn) sendBtn.disabled = true;
  showTyping();

  try {
    const reply = await callGemini(apiKey, claudeState.messages.slice(-20));
    removeTyping();
    appendMsg('assistant', reply);
    claudeState.messages.push({ role: 'assistant', content: reply });
    if (claudeState.messages.length > 40) claudeState.messages = claudeState.messages.slice(-40);
  } catch (e) {
    removeTyping();
    console.error('Gemini error:', e);
    const msg = e.message?.includes('429') ? 'レート制限中です。少し待ってから再試行してください。'
      : e.message?.includes('400') ? 'APIキーが無効です。設定を確認してください。'
      : `エラー: ${e.message}`;
    appendMsg('assistant', '❌ ' + msg);
  } finally {
    claudeState.isLoading = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

// ============================================================
// GEMINI API (完全無料)
// ============================================================
async function callGemini(apiKey, messages) {
  const systemPrompt = buildSystemPrompt();

  // Gemini形式に変換 (user/model)
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.75,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    ],
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('応答が空でした');
  return text;
}

function buildSystemPrompt() {
  let p = `あなたはScratchプログラミングの専門家アシスタントです。
日本語で回答してください。
Scratchのブロックプログラミング、ゲーム開発テクニック、アルゴリズム、デバッグについて詳しく説明できます。
回答は簡潔で実践的にしてください。コード例を示す場合はScratchのブロック名を日本語で記述してください。
箇条書きや見出しを使って読みやすく整理してください。`;

  if (claudeState.context) {
    const t = claudeState.context;
    p += `\n\n現在ユーザーは以下のScratchテクニックを閲覧しています。
タイトル: ${t.title}
カテゴリ: ${t.category}
タグ: ${(t.tags || []).join(', ')}
${t.description ? `説明（抜粋）: ${t.description.slice(0, 400)}` : ''}
このテクニックに関連した質問に対して具体的にアドバイスしてください。`;
  }
  return p;
}

function renderChatMd(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong>$1</strong>')
    .replace(/^[-*]\s+(.+)$/gm, '• $1')
    .replace(/\n/g, '<br>');
}

// Init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createClaudePanel);
} else {
  createClaudePanel();
}
