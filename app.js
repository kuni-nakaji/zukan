// もののなまえ はじまり図鑑 - メインロジック
// 音声入力・音声読み上げ・タイムトラベル演出・クイズ・AI拡張

let currentItem = null;
let isSpeaking = false;
let recognition = null;
let currentCategory = 'all';

// カタカナ⇔ひらがな変換（「ぱん」で検索しても「パン」がヒットするように）
function toHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}
function toKatakana(str) {
  return str.replace(/[\u3041-\u3096]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}
function normalizeQuery(str) {
  return toHiragana(str).toLowerCase().trim();
}

// DOM要素
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const micBtn = document.getElementById('mic-btn');
const itemGrid = document.getElementById('item-grid');
const warpOverlay = document.getElementById('warp-overlay');
const warpText = document.getElementById('warp-text');
const homeView = document.getElementById('home-view');
const detailView = document.getElementById('detail-view');
const backBtn = document.getElementById('back-btn');
const speakBtn = document.getElementById('speak-btn');
const catTabs = document.querySelectorAll('.cat-tab');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  renderGrid(ZUKAN_DATA);
  setupSpeechRecognition();
  setupEventListeners();
  loadApiKey();
});

// イベントリスナー設定
function setupEventListeners() {
  // 検索フォーム送信
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

  // 設定モーダル関連
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const closeKeyBtn = document.getElementById('close-key-btn');
  const apiKeyInput = document.getElementById('api-key-input');

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
}

// アイテムグリッド描画
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
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-card-icon">${item.icon}</div>
      <div class="item-card-name">${item.name}</div>
      <div class="item-card-badge">${item.origin.country || 'にほん'}</div>
    `;
    card.addEventListener('click', () => {
      openDetailWithWarp(item);
    });
    itemGrid.appendChild(card);
  });
}

// フィルタリング処理
function filterAndRenderGrid() {
  const query = normalizeQuery(searchInput.value);
  const filtered = ZUKAN_DATA.filter(item => {
    const matchCategory = (currentCategory === 'all') || 
      (currentCategory === 'school' && item.category.includes('がっこう')) ||
      (currentCategory === 'food' && item.category.includes('たべもの')) ||
      (currentCategory === 'house' && item.category.includes('いえのなか')) ||
      (currentCategory === 'music' && item.category.includes('がっき')) ||
      (currentCategory === 'town' && (item.category.includes('まち') || item.category.includes('のりもの')));

    const normName = normalizeQuery(item.name);
    const normReading = normalizeQuery(item.reading);
    const matchQuery = !query || 
      normName.includes(query) || 
      normReading.includes(query) ||
      query.includes(normName) ||
      (item.origin.original_word && normalizeQuery(item.origin.original_word).includes(query));

    return matchCategory && matchQuery;
  });

  renderGrid(filtered);
}

// 検索ハンドラー
async function handleSearch(query) {
  if (!query) return;

  // ひらがな・カタカナ正規化
  const normQuery = normalizeQuery(query);

  // プリセット内を検索
  const match = ZUKAN_DATA.find(item => {
    const normName = normalizeQuery(item.name);
    const normReading = normalizeQuery(item.reading);
    return normName === normQuery || 
      normReading === normQuery ||
      normName.includes(normQuery) ||
      normQuery.includes(normName);
  });

  if (match) {
    openDetailWithWarp(match);
  } else {
    // プリセットにない場合：Gemini APIキーがあればAI生成、なければ案内
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

// タイムマシン（ワープ）演出して詳細へ
function openDetailWithWarp(item) {
  stopSpeech();
  playPopSound();
  currentItem = item;

  const eraText = item.history_steps && item.history_steps[0] ? item.history_steps[0].era : '大むかし';
  warpText.innerHTML = `<span>🌀</span><br>${item.name}の はじまりへ…<br><span style="font-size: 20px; color: #fef08a;">${eraText}に タイムスリップ！</span>`;
  warpOverlay.classList.add('active');

  setTimeout(() => {
    warpOverlay.classList.remove('active');
    showDetail(item);
  }, 1100);
}

// 詳細画面を表示
function showDetail(item) {
  homeView.style.display = 'none';
  detailView.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // ヒーローヘッダー
  document.getElementById('detail-icon').textContent = item.icon;
  document.getElementById('detail-name').innerHTML = `<ruby>${item.name}<rt>${item.reading}</rt></ruby>`;
  document.getElementById('detail-badge').textContent = item.badge || `${item.origin.country}から きたよ`;

  // 起源セクション
  document.getElementById('origin-country').innerHTML = `${item.origin.country_flag || '🌍'} ${item.origin.country}`;
  document.getElementById('origin-word').textContent = item.origin.original_word || '-';
  document.getElementById('origin-meaning').textContent = item.origin.meaning || '-';
  document.getElementById('origin-story').textContent = item.origin.story;

  // タイムライン
  const timelineEl = document.getElementById('detail-timeline');
  timelineEl.innerHTML = '';
  item.history_steps.forEach((step, idx) => {
    const isCurrent = idx === item.history_steps.length - 1;
    const stepDiv = document.createElement('div');
    stepDiv.className = `timeline-step ${isCurrent ? 'current' : ''}`;
    stepDiv.innerHTML = `
      <div class="step-header">
        <span class="step-era">${step.era}</span>
        <span class="step-badge">${step.badge}</span>
      </div>
      <div class="step-body">
        <div class="step-img">${step.image || item.icon}</div>
        <div class="step-content">
          <h4>${step.title}</h4>
          <p>${step.text}</p>
        </div>
      </div>
    `;
    timelineEl.appendChild(stepDiv);
  });

  // まめちしき
  const triviaEl = document.getElementById('detail-trivia');
  triviaEl.innerHTML = '';
  item.trivia.forEach((t, i) => {
    const card = document.createElement('div');
    card.className = 'trivia-card';
    card.innerHTML = `
      <div class="trivia-icon">${i % 2 === 0 ? '💡' : '👑'}</div>
      <div class="trivia-text">${t}</div>
    `;
    triviaEl.appendChild(card);
  });

  // クイズ
  const quizBox = document.getElementById('detail-quiz');
  if (item.quiz) {
    quizBox.style.display = 'block';
    document.getElementById('quiz-question').textContent = item.quiz.question;
    const optContainer = document.getElementById('quiz-options');
    optContainer.innerHTML = '';
    const feedback = document.getElementById('quiz-feedback');
    feedback.className = 'quiz-feedback';
    feedback.style.display = 'none';

    item.quiz.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt-btn';
      btn.textContent = `${idx + 1}. ${opt}`;
      btn.addEventListener('click', () => {
        // 解答判定
        const allBtns = optContainer.querySelectorAll('.quiz-opt-btn');
        allBtns.forEach(b => b.disabled = true);

        if (idx === item.quiz.answer) {
          btn.classList.add('correct');
          feedback.className = 'quiz-feedback show correct-msg';
          feedback.innerHTML = `🎉 <strong>せいかい！</strong><br>${item.quiz.explanation}`;
          playPositiveSound();
          launchConfetti();
        } else {
          btn.classList.add('wrong');
          allBtns[item.quiz.answer].classList.add('correct');
          feedback.className = 'quiz-feedback show wrong-msg';
          feedback.innerHTML = `😢 <strong>おしい！</strong><br>${item.quiz.explanation}`;
        }
      });
      optContainer.appendChild(btn);
    });
  } else {
    quizBox.style.display = 'none';
  }

  // おとな向け解説
  const parentNote = document.getElementById('parent-note-content');
  if (item.parent_note) {
    document.getElementById('parent-accordion').style.display = 'block';
    parentNote.textContent = item.parent_note;
  } else {
    document.getElementById('parent-accordion').style.display = 'none';
  }
}

// ホームへ戻る
function goHome() {
  stopSpeech();
  playPopSound();
  detailView.classList.remove('active');
  homeView.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 音声読み上げ（SpeechSynthesis）
function toggleSpeech() {
  if (isSpeaking) {
    stopSpeech();
  } else {
    startSpeech();
  }
}

function startSpeech() {
  if (!currentItem || !('speechSynthesis' in window)) {
    alert('お使いのブラウザは 音声よみあげに たいおうしていません。');
    return;
  }

  window.speechSynthesis.cancel();

  // 読み上げテキストの構築（子供が聞きやすいようにゆっくりと）
  const textParts = [
    `${currentItem.name}。`,
    `${currentItem.origin.country}から きたよ。`,
    `${currentItem.origin.story}`,
    `むかしは どうだったかな？`,
    currentItem.history_steps.map(s => `${s.era}。${s.title}。${s.text}`).join('。'),
    `びっくり まめちしき！`,
    currentItem.trivia.join('。')
  ];

  const fullText = textParts.join(' ');
  const utterance = new SpeechSynthesisUtterance(fullText);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.92; // 小学1年生が聞き取りやすい優しいスピード
  utterance.pitch = 1.1; // 少し明るめの声

  utterance.onstart = () => {
    isSpeaking = true;
    speakBtn.classList.add('speaking');
    speakBtn.innerHTML = '<span>⏹️</span> とめる';
  };

  utterance.onend = () => {
    stopSpeech();
  };

  utterance.onerror = () => {
    stopSpeech();
  };

  window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  isSpeaking = false;
  speakBtn.classList.remove('speaking');
  speakBtn.innerHTML = '<span>🔊</span> こえで きく';
}

// 音声認識（SpeechRecognition）
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = 'none';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const spokenWord = event.results[0][0].transcript.replace(/[。、！？]/g, '');
    searchInput.value = spokenWord;
    micBtn.classList.remove('listening');
    handleSearch(spokenWord);
  };

  recognition.onerror = (e) => {
    micBtn.classList.remove('listening');
    console.log('音声認識エラー:', e);
  };

  recognition.onend = () => {
    micBtn.classList.remove('listening');
  };
}

function toggleVoiceInput() {
  if (!recognition) {
    alert('マイクが つかえないよ。もじを 入力して さがしてね！');
    return;
  }

  if (micBtn.classList.contains('listening')) {
    recognition.stop();
    micBtn.classList.remove('listening');
  } else {
    try {
      recognition.start();
      micBtn.classList.add('listening');
    } catch (err) {
      console.error(err);
    }
  }
}

// Gemini APIによる動的図鑑生成（未知の言葉）
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
    "answer": 0, // 正解のインデックス（0〜2）
    "explanation": "正解の易しい解説"
  },
  "parent_note": "保護者や大人が一緒に読んだときに詳しく補足説明できる学術的・歴史的背景（大人の日本語で1〜2段落）"
}
`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
      })
    });

    const data = await res.json();
    if (!data.candidates || !data.candidates[0].content.parts[0].text) {
      throw new Error('AIからの お返事が とどきませんでした。');
    }

    const rawText = data.candidates[0].content.parts[0].text;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
    const generatedItem = JSON.parse(jsonMatch[1]);

    // プリセット一覧にも一時追加
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

// 効果音（Web Audio APIによるシンセ音）
function playPositiveSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) {
    // AudioContext未許可等は無視
  }
}

function loadApiKey() {
  const savedKey = localStorage.getItem('zukan_gemini_key');
  if (savedKey) {
    const settingsBtn = document.getElementById('settings-btn');
    settingsBtn.innerHTML = '⚙️ AIモード有効';
    settingsBtn.style.borderColor = '#10b981';
    settingsBtn.style.color = '#059669';
  }
}

// ポコッという心地よいタップ音（Web Audio API）
function playPopSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch (e) {
    // 無視
  }
}

// クイズ正解時の紙吹雪アニメーション
function launchConfetti() {
  const colors = ['#f97316', '#fbbf24', '#0ea5e9', '#10b981', '#ec4899', '#8b5cf6'];
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  for (let i = 0; i < 48; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.animationDuration = `${1.6 + Math.random() * 0.8}s`;
    piece.style.width = `${8 + Math.random() * 8}px`;
    piece.style.height = `${8 + Math.random() * 8}px`;
    container.appendChild(piece);
  }

  setTimeout(() => {
    container.remove();
  }, 2600);
}
