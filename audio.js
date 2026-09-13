// ===== audio.js =====
// Web Audio API による効果音 + クイズ正解時の紙吹雪アニメーション

// ---- 効果音 ----

// 正解ファンファーレ（三角波ドミソド上昇）
function playPositiveSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(523.25, now);       // C5
    osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.3);// C6

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) {
    // AudioContext 未許可等は無視
  }
}

// 不正解のボヨン音（下降サイン波）
function playGentleThudSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.start(now);
    osc.stop(now + 0.18);
  } catch (e) {
    // 無視
  }
}

// タップ時のポコッ音（上昇サイン波）
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

// ---- 紙吹雪 ----

// クイズ正解時の放射状バーストパーティクル（Emil Kowalski Delight 原則）
function launchConfetti(originX, originY) {
  const colors  = ['#f97316', '#fbbf24', '#0ea5e9', '#10b981', '#ec4899', '#8b5cf6', '#eab308'];
  const symbols = ['★', '✦', '✧', '●', '■'];
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  const startX = originX || (window.innerWidth / 2);
  const startY = originY || (window.innerHeight * 0.6);
  const count  = 52;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';

    const isSymbol = Math.random() > 0.4;
    const color    = colors[Math.floor(Math.random() * colors.length)];

    if (isSymbol) {
      piece.textContent    = symbols[Math.floor(Math.random() * symbols.length)];
      piece.style.fontSize = `${16 + Math.random() * 16}px`;
      piece.style.color    = color;
      piece.style.lineHeight = '1';
    } else {
      const size = 8 + Math.random() * 8;
      piece.style.width           = `${size}px`;
      piece.style.height          = `${size * (Math.random() > 0.5 ? 1.4 : 1)}px`;
      piece.style.backgroundColor = color;
      piece.style.borderRadius    = Math.random() > 0.5 ? '50%' : '3px';
    }

    // 放射状の初速と放物線軌道
    const angle    = (Math.PI * 2 * (i / count)) + ((Math.random() - 0.5) * 0.4);
    const burstDist = 100 + Math.random() * 180;
    const txMid    = Math.cos(angle) * burstDist;
    const tyMid    = Math.sin(angle) * burstDist - (80 + Math.random() * 90);
    const txEnd    = txMid + (Math.random() - 0.5) * 160;
    const tyEnd    = window.innerHeight - startY + 80;
    const rotMid   = (Math.random() - 0.5) * 360;
    const rotEnd   = rotMid + (Math.random() - 0.5) * 720;
    const duration = 1.6 + Math.random() * 0.8;
    const delay    = Math.random() * 0.08;

    piece.style.left = `${startX}px`;
    piece.style.top  = `${startY}px`;
    piece.style.setProperty('--tx-mid',       `${txMid}px`);
    piece.style.setProperty('--ty-mid',       `${tyMid}px`);
    piece.style.setProperty('--tx-end',       `${txEnd}px`);
    piece.style.setProperty('--ty-end',       `${tyEnd}px`);
    piece.style.setProperty('--rot-mid',      `${rotMid}deg`);
    piece.style.setProperty('--rot-end',      `${rotEnd}deg`);
    piece.style.setProperty('--fall-duration',`${duration}s`);
    piece.style.animationDelay = `${delay}s`;

    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 2600);
}
