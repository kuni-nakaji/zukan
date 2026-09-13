// ===== app.js =====
// もののなまえ はじまり図鑑 — メインロジック（初期化・検索・グリッド描画・イベント管理）
// 音声: speech.js / Wave アニメーション: wave.js / 詳細: detail.js / 音声効果: audio.js / ユーティリティ: utils.js

// ---- グローバル状態 ----

let currentItem     = null;
let isSpeaking      = false;
let recognition     = null;
let currentCategory = 'all';
let currentViewMode = 'wave';

// ---- DOM 参照 ----

const searchInput = document.getElementById('search-input');
const searchBtn   = document.getElementById('search-btn');
const micBtn      = document.getElementById('mic-btn');
const itemGrid    = document.getElementById('item-grid');
const warpOverlay = document.getElementById('warp-overlay');
const warpText    = document.getElementById('warp-text');
const homeView    = document.getElementById('home-view');
const detailView  = document.getElementById('detail-view');
const backBtn     = document.getElementById('back-btn');
const speakBtn    = document.getElementById('speak-btn');
const catTabs     = document.querySelectorAll('.cat-tab');

// ---- 初期化 ----

document.addEventListener('DOMContentLoaded', () => {
  renderCatalog(ZUKAN_DATA);
  setupSpeechRecognition();
  setupEventListeners();
  loadApiKey();
});

// ---- イベントリスナー設定 ----

function setupEventListeners() {
  // 検索フォーム送信（Enter / ボタン共用）
  const searchForm = document.getElementById('search-form');
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSearch(searchInput.value.trim());
  });

  // 音声入力ボタン
  micBtn.addEventListener('click', toggleVoiceInput);

  // 戻るボタン
  backBtn.addEventListener('click', goHome);

  // 音声読み上げボタン
  speakBtn.addEventListener('click', toggleSpeech);

  // カテゴリタブ切り替え
  catTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      playPopSound();
      catTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;
      filterAndRenderGrid();
    });
  });

  // 設定モーダル
  const settingsBtn  = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const saveKeyBtn   = document.getElementById('save-key-btn');
  const closeKeyBtn  = document.getElementById('close-key-btn');
  const apiKeyInput  = document.getElementById('api-key-input');

  settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = localStorage.getItem('zukan_gemini_key') || '';
    settingsModal.classList.add('active');
  });

  closeKeyBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem('zukan_gemini_key', key);
      alert('APIキーを ほぞんしたよ！これで 新しい 言葉も AIで 調べられるよ！');
    } else {
      localStorage.removeItem('zukan_gemini_key');
      alert('APIキーを けしたよ。');
    }
    settingsModal.classList.remove('active');
  });

  // 表示形式切り替え（3D ウェーブ ↔ グリッド）
  const viewWaveBtn  = document.getElementById('view-wave-btn');
  const viewGridBtn  = document.getElementById('view-grid-btn');
  const waveWrapper  = document.getElementById('zukan-wave-wrapper');

  if (viewWaveBtn && viewGridBtn && waveWrapper && itemGrid) {
    viewWaveBtn.addEventListener('click', () => {
      playPopSound();
      viewWaveBtn.classList.add('active');
      viewWaveBtn.setAttribute('aria-selected', 'true');
      viewGridBtn.classList.remove('active');
      viewGridBtn.setAttribute('aria-selected', 'false');
      waveWrapper.style.display = 'block';
      itemGrid.style.display    = 'none';
      currentViewMode = 'wave';
      if (!waveAnimationActive) {
        waveAnimationActive = true;
        wavePreviousTime    = performance.now();
        requestAnimationFrame(renderWaveLoop);
      }
    });

    viewGridBtn.addEventListener('click', () => {
      playPopSound();
      viewGridBtn.classList.add('active');
      viewGridBtn.setAttribute('aria-selected', 'true');
      viewWaveBtn.classList.remove('active');
      viewWaveBtn.setAttribute('aria-selected', 'false');
      waveWrapper.style.display = 'none';
      itemGrid.style.display    = 'grid';
      currentViewMode = 'grid';
    });
  }
}

// ---- カードカラー判定 ----

function getItemCardColor(item, index) {
  const colors = [
    '#78350f', '#881337', '#1e3a8a', '#365314', '#164e63',
    '#581c87', '#831843', '#1f2937', '#064e3b', '#7c2d12'
  ];
  if (item.category && item.category.includes('たべもの')) return '#78350f';
  if (item.category && item.category.includes('がっこう')) return '#1e3a8a';
  if (item.category && item.category.includes('がっき'))   return '#581c87';
  if (item.category && item.category.includes('のりもの')) return '#164e63';
  return colors[index % colors.length];
}

// ---- カタログ描画 ----

function renderCatalog(items) {
  renderGrid(items);
  renderWave(items);
}

// グリッド表示
function renderGrid(items) {
  itemGrid.innerHTML = '';
  if (items.length === 0) {
    itemGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 10px; color: #64748b;">
        <p style="font-size: 32px; margin-bottom: 8px;">🔍</p>
        <p style="font-weight: 700;">みつからなかったよ。<br>べつの ことばで さがしてみてね！</p>
      </div>
    `;
    return;
  }

  items.forEach(item => {
    const card     = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-card-icon">${item.icon}</div>
      <div class="item-card-name">${item.name}</div>
      <div class="item-card-badge">${item.origin.country || 'にほん'}</div>
    `;
    card.addEventListener('click', () => openDetailWithWarp(item));
    itemGrid.appendChild(card);
  });
}

// フィルタリング
function filterAndRenderGrid() {
  const query    = normalizeQuery(searchInput.value);
  const filtered = ZUKAN_DATA.filter(item => {
    const matchCategory =
      currentCategory === 'all' ||
      (currentCategory === 'school' && item.category.includes('がっこう')) ||
      (currentCategory === 'food'   && item.category.includes('たべもの')) ||
      (currentCategory === 'house'  && item.category.includes('いえのなか')) ||
      (currentCategory === 'music'  && item.category.includes('がっき')) ||
      (currentCategory === 'town'   && (item.category.includes('まち') || item.category.includes('のりもの')));

    const normName    = normalizeQuery(item.name);
    const normReading = normalizeQuery(item.reading);
    const matchQuery  = !query ||
      normName.includes(query) ||
      normReading.includes(query) ||
      query.includes(normName) ||
      (item.origin.original_word && normalizeQuery(item.origin.original_word).includes(query));

    return matchCategory && matchQuery;
  });

  renderCatalog(filtered);
}

// ---- 検索ハンドラー ----

async function handleSearch(query) {
  if (!query) return;

  const normQuery = normalizeQuery(query);
  const match     = ZUKAN_DATA.find(item => {
    const normName    = normalizeQuery(item.name);
    const normReading = normalizeQuery(item.reading);
    return normName === normQuery ||
      normReading === normQuery ||
      normName.includes(normQuery) ||
      normQuery.includes(normName);
  });

  if (match) {
    openDetailWithWarp(match);
  } else {
    const apiKey = localStorage.getItem('zukan_gemini_key');
    if (apiKey) {
      await fetchItemWithAI(query, apiKey);
    } else {
      filterAndRenderGrid();
      if (itemGrid.children.length === 0) {
        alert(`『${query}』は まだ タイムマシンに とうろく されていないよ！\n右上の『⚙️ せってい』から Gemini APIキーを入れると、AIが 小学1年生向けに おしえてくれるよ！`);
      }
    }
  }
}

// ---- ホームへ戻る ----

function goHome() {
  stopSpeech();
  playPopSound();
  detailView.classList.remove('active');
  homeView.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (currentViewMode === 'wave' && !waveAnimationActive) {
    waveAnimationActive = true;
    wavePreviousTime    = performance.now();
    requestAnimationFrame(renderWaveLoop);
  }
}

// ---- Gemini API による動的図鑑生成 ----

async function fetchItemWithAI(keyword, apiKey) {
  warpText.innerHTML = `<span>🤖</span><br>AIタイムマシンが『${keyword}』の<br>はじまりを たんけん中…`;
  warpOverlay.classList.add('active');
  searchBtn.disabled = true;

  const prompt = `
あなたは小学1年生向けの歴史・ものの起源のやさしい先生です。
子どもから「${keyword}」の起源や名前の由来を聞かれました。
以下の条件を厳格に守り、指定のJSON形式のみを出力してください。Markdownのコードブロック（\`\`\`json ... \`\`\`）で囲んで出力してください。

【条件】
- 対象は小学1年生（6〜7歳）です。
- 原則ひらがな・カタカナを多めにし、難しい漢字は使わず、漢字を使う場合は「小学生でもわかる簡単なもの」にしてください。
- 語り口は親しみやすく、ワクワクする口調にしてください。
- 由来や歴史は史実に基づき、子どもが「へえー！」と驚くポイントを入れてください。

【JSONスキーマ】
{
  "id": "英数字の識別子",
  "name": "${keyword}",
  "reading": "ひらがなの読み",
  "category": "がっこう・ぶんぼうぐ / たべもの / いえのなか / のりもの / まちのなか のいずれか",
  "icon": "該当する絵文字1個",
  "badge": "〇〇から きたよ または 特徴の短い言葉",
  "origin": {
    "country": "発祥の国や地域名",
    "country_flag": "その国の国旗絵文字",
    "original_word": "もともとの言葉と読み",
    "meaning": "もともとの意味",
    "story": "小学1年生向けに起源を説明する2〜3文のお話"
  },
  "history_steps": [
    {
      "era": "むかしの時代（〇年前や〇〇時代など）",
      "badge": "むかしの すがた",
      "image": "絵文字",
      "title": "むかしのすがたのタイトル",
      "text": "むかしはどんな形や使われ方だったかの簡単な説明"
    },
    {
      "era": "いま",
      "badge": "いまの すがた",
      "image": "絵文字",
      "title": "いまのすがたのタイトル",
      "text": "いまはどんな形や使われ方かの簡単な説明"
    }
  ],
  "trivia": [
    "びっくりする豆知識1（1〜2文）",
    "びっくりする豆知識2（1〜2文）"
  ],
  "quiz": {
    "question": "小学1年生が答えられる3択クイズの問題",
    "options": ["選択肢1", "選択肢2", "選択肢3"],
    "answer": 0,
    "explanation": "正解の易しい解説"
  },
  "parent_note": "保護者や大人が一緒に読んだときに詳しく補足説明できる学術的・歴史的背景（大人の日本語で1〜2段落）"
}
`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 }
        })
      }
    );

    const data = await res.json();
    if (!data.candidates || !data.candidates[0].content.parts[0].text) {
      throw new Error('AIからの お返事が とどきませんでした。');
    }

    const rawText       = data.candidates[0].content.parts[0].text;
    const jsonMatch     = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
    const generatedItem = JSON.parse(jsonMatch[1]);

    ZUKAN_DATA.unshift(generatedItem);
    warpOverlay.classList.remove('active');
    showDetail(generatedItem);
  } catch (err) {
    warpOverlay.classList.remove('active');
    console.error(err);
    alert('AIタイムマシンで うまく 調べられなかったよ。APIキーが 正しいか たしかめてみてね！');
  } finally {
    searchBtn.disabled = false;
  }
}

// ---- API キー読み込み ----

function loadApiKey() {
  const savedKey = localStorage.getItem('zukan_gemini_key');
  if (savedKey) {
    const settingsBtn = document.getElementById('settings-btn');
    settingsBtn.innerHTML    = '⚙️ AIモード有効';
    settingsBtn.style.borderColor = '#10b981';
    settingsBtn.style.color       = '#059669';
  }
}
