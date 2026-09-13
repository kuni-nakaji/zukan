// ===== wave.js =====
// ThreeUI 3D Card Wave アニメーション
// （アイテム選択 UI として図鑑ホームに直接統合）

// ---- 状態変数 ----

let waveCards = [];
let waveState = {
  phase:             2,
  targetPhase:       2,
  basePhase:         2,
  orientation:       window.innerWidth < 680 ? 1 : 0,
  targetOrientation: window.innerWidth < 680 ? 1 : 0,
  pointerX:          0,
  pointerY:          0,
  tiltX:             0,
  tiltY:             0,
  active:            false,
  manualOrientation: false,
  lastInput:         performance.now(),
  currentItems:      []
};
let waveAnimationActive  = false;
let waveAnimationFrameId = null;
let wavePreviousTime     = performance.now();
let waveListenersAttached = false;

// スワイプ＆タッチ状態
let isWaveDragging = false;
let dragStartX     = 0;
let dragStartY     = 0;
let dragStartTime  = 0;
let dragStartPhase = 0;
let hasDraggedFar  = false;

// ---- 数学ヘルパー ----

function wrappedDelta(index, phase, count) {
  let delta = index - phase;
  while (delta >  count / 2) delta -= count;
  while (delta < -count / 2) delta += count;
  return delta;
}

function nearestWaveIndex(count) {
  if (count <= 0) return 0;
  return (Math.round(waveState.phase) % count + count) % count;
}

// ---- カード選択・送り操作 ----

function selectWaveCard(index, count) {
  const current = nearestWaveIndex(count);
  let delta = index - current;
  if (delta >  count / 2) delta -= count;
  if (delta < -count / 2) delta += count;
  waveState.basePhase  += delta;
  waveState.targetPhase = waveState.basePhase;
  waveState.lastInput   = performance.now();
  updateWaveIndicator();
}

function nextWaveCard() {
  playPopSound();
  waveState.basePhase  += 1;
  waveState.targetPhase = waveState.basePhase;
  waveState.lastInput   = performance.now();
  updateWaveIndicator();
}

function prevWaveCard() {
  playPopSound();
  waveState.basePhase  -= 1;
  waveState.targetPhase = waveState.basePhase;
  waveState.lastInput   = performance.now();
  updateWaveIndicator();
}

function toggleWaveOrientation() {
  waveState.manualOrientation = true;
  waveState.targetOrientation = waveState.targetOrientation > 0.5 ? 0 : 1;
  waveState.targetPhase       = waveState.basePhase;
  waveState.lastInput         = performance.now();
}

// ---- インジケーター ----

function updateWaveIndicator() {
  const nameEl  = document.getElementById('wave-current-name');
  const countEl = document.getElementById('wave-current-count');
  if (!nameEl || !countEl || waveCards.length === 0) return;

  const count     = waveCards.length;
  const activeIdx = nearestWaveIndex(count);
  const item      = waveState.currentItems[activeIdx];
  if (item) {
    nameEl.textContent  = `${item.icon} ${item.name}`;
    countEl.textContent = `${activeIdx + 1} / ${count}`;
  }
}

// ---- ポインターイベント（スワイプ / ドラッグ / マウスホバー） ----

function handleWavePointerDown(event, stage) {
  isWaveDragging = true;
  hasDraggedFar  = false;
  dragStartX     = event.clientX;
  dragStartY     = event.clientY;
  dragStartTime  = performance.now();
  dragStartPhase = waveState.basePhase;
  waveState.active    = true;
  waveState.lastInput = performance.now();
  try { stage.setPointerCapture(event.pointerId); } catch (_) {}
}

function handleWavePointerMove(event, stage) {
  if (isWaveDragging) {
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) hasDraggedFar = true;

    const step       = window.innerWidth < 680 ? 110 : 150;
    const deltaPhase = -(waveState.targetOrientation > 0.5 ? dy : dx) / step;
    waveState.targetPhase = dragStartPhase + deltaPhase;
    waveState.phase       = waveState.targetPhase;
    waveState.tiltX       = Math.max(-1, Math.min(1, dx / 120));
    waveState.tiltY       = Math.max(-1, Math.min(1, dy / 120));
    waveState.lastInput   = performance.now();
  } else {
    // マウスホバー時のチルト演出
    const rect = stage.getBoundingClientRect();
    const nx   = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width  - 0.5) * 2));
    const ny   = Math.max(-1, Math.min(1, ((event.clientY - rect.top)  / rect.height - 0.5) * 2));
    waveState.pointerX = nx;
    waveState.pointerY = ny;
    waveState.tiltX    = nx;
    waveState.tiltY    = ny;
  }
}

function handleWavePointerUp(event, stage) {
  if (!isWaveDragging) return;

  const totalDx    = event.clientX - dragStartX;
  const totalDy    = event.clientY - dragStartY;
  const dt         = Math.max(1, performance.now() - dragStartTime);
  const primaryDist = waveState.targetOrientation > 0.5 ? totalDy : totalDx;

  // スワイプ / フリック判定（iPad・スマホで確実にページ送り）
  if (Math.abs(primaryDist) > 35 || (Math.abs(primaryDist) > 15 && dt < 300)) {
    const dir = primaryDist < 0 ? 1 : -1;
    waveState.basePhase = Math.round(dragStartPhase + dir);
  } else {
    waveState.basePhase = Math.round(waveState.targetPhase);
  }

  waveState.targetPhase = waveState.basePhase;
  isWaveDragging        = false;
  waveState.active      = false;
  waveState.pointerX    = 0;
  waveState.pointerY    = 0;

  try { stage.releasePointerCapture(event.pointerId); } catch (_) {}
  updateWaveIndicator();
}

// ---- アニメーションループ ----

let lastAnnouncedIndex = -1;

function renderWaveLoop(time) {
  if (!waveAnimationActive || waveCards.length === 0) return;

  const count       = waveCards.length;
  const deltaTime   = Math.min(32, time - wavePreviousTime);
  wavePreviousTime  = time;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease        = reducedMotion ? 1 : 1 - Math.pow(0.0007, deltaTime / 1000);

  // アイドル時の自動浮遊
  if (!waveState.active && !waveState.manualOrientation && time - waveState.lastInput > 4200) {
    const idle = time - waveState.lastInput - 4200;
    waveState.targetPhase       = waveState.basePhase + Math.sin(idle * 0.00034) * 1.9;
    waveState.targetOrientation = (Math.sin(idle * 0.00019 - Math.PI / 2) + 1) / 2;
  }

  waveState.phase        += (waveState.targetPhase       - waveState.phase)        * ease;
  waveState.orientation  += (waveState.targetOrientation - waveState.orientation)  * ease * 0.72;
  waveState.tiltX        += ((waveState.active ? waveState.pointerX : 0) - waveState.tiltX) * ease * 0.72;
  waveState.tiltY        += ((waveState.active ? waveState.pointerY : 0) - waveState.tiltY) * ease * 0.72;

  const horizontalSpacing = Math.min(160, Math.max(110, window.innerWidth  * 0.11));
  const verticalSpacing   = Math.min(145, Math.max(105, window.innerHeight * 0.15));
  const activeIndex       = nearestWaveIndex(count);

  if (activeIndex !== lastAnnouncedIndex) {
    lastAnnouncedIndex = activeIndex;
    updateWaveIndicator();
  }

  waveCards.forEach((card, index) => {
    const delta    = wrappedDelta(index, waveState.phase, count);
    const distance = Math.abs(delta);
    const focus    = Math.exp(-Math.pow(distance, 2) * 1.05);
    const side     = Math.max(0, 1 - distance / 5);

    const horizontalX = delta * horizontalSpacing;
    const horizontalY = Math.sin(delta * 0.65) * 26 + Math.abs(delta) * 7;
    const verticalX   = Math.sin(delta * 0.65) * 26 + Math.abs(delta) * 7;
    const verticalY   = delta * verticalSpacing;

    const x       = horizontalX * (1 - waveState.orientation) + verticalX * waveState.orientation;
    const y       = horizontalY * (1 - waveState.orientation) + verticalY * waveState.orientation;
    const z       = focus * 95 - distance * 78;
    const scale   = 0.58 + side * 0.16 + focus * 0.38;
    const rotateX = -waveState.tiltY * focus * 6 + delta * 2.2 *  waveState.orientation;
    const rotateY =  waveState.tiltX * focus * 8 - delta * 8.5 * (1 - waveState.orientation);
    const rotateZ =  delta * 2.25 * (1 - waveState.orientation) - delta * 1.4 * waveState.orientation;

    card.style.setProperty('--focus', focus.toFixed(4));
    card.style.zIndex   = String(Math.round(1000 - distance * 100));
    card.style.opacity  = String(Math.max(0.18, side * 0.82 + focus * 0.18));
    card.style.filter   = `blur(${Math.max(0, distance - 1.35) * 0.45}px) saturate(${0.75 + focus * 0.25})`;
    card.style.transform = [
      'translate(-50%, -50%)',
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px)`,
      `rotateX(${rotateX.toFixed(2)}deg)`,
      `rotateY(${rotateY.toFixed(2)}deg)`,
      `rotateZ(${rotateZ.toFixed(2)}deg)`,
      `scale(${scale.toFixed(4)})`
    ].join(' ');
    card.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
  });

  waveAnimationFrameId = requestAnimationFrame(renderWaveLoop);
}

// ---- Wave 描画（カード生成 + イベント登録） ----

function renderWave(items) {
  const deck  = document.getElementById('deck');
  const stage = document.getElementById('stage');
  if (!deck || !stage) return;

  deck.innerHTML      = '';
  waveCards           = [];
  waveState.currentItems = items;

  if (items.length === 0) {
    deck.innerHTML = `
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#94a3b8;font-weight:700;font-size:18px;text-align:center;">
        みつからなかったよ。<br>べつの ことばで さがしてみてね！
      </div>`;
    updateWaveIndicator();
    return;
  }

  const count = items.length;
  waveCards = items.map((item, index) => {
    const card     = document.createElement('button');
    card.className = 'card';
    card.type      = 'button';
    card.dataset.index = String(index);
    card.setAttribute('aria-label', `${item.name}の なまえの はじまりを しらべる`);
    card.style.setProperty('--card-color', getItemCardColor(item, index));
    card.innerHTML = `
      <span class="portrait" aria-hidden="true">${item.icon}</span>
      <span class="identity">
        <span class="name">${item.name}</span>
        <span class="role">生まれ: ${item.origin.country || 'にほん'}</span>
        <span class="follow" aria-hidden="true">しらべる 🚀</span>
      </span>
    `;

    card.addEventListener('click', () => {
      if (hasDraggedFar) return;
      const activeIdx = nearestWaveIndex(count);
      if (activeIdx === index) {
        playPopSound();
        openDetailWithWarp(item);
      } else {
        playPopSound();
        selectWaveCard(index, count);
      }
    });

    const followBtn = card.querySelector('.follow');
    if (followBtn) {
      followBtn.addEventListener('click', (e) => {
        if (hasDraggedFar) return;
        e.stopPropagation();
        playPopSound();
        openDetailWithWarp(item);
      });
    }

    deck.appendChild(card);
    return card;
  });

  updateWaveIndicator();

  // ポインター・ホイール・キーボードのリスナーは1回だけ登録
  if (!waveListenersAttached) {
    waveListenersAttached = true;

    stage.addEventListener('pointerdown',   (e) => handleWavePointerDown(e, stage));
    stage.addEventListener('pointermove',   (e) => handleWavePointerMove(e, stage));
    stage.addEventListener('pointerup',     (e) => handleWavePointerUp(e, stage));
    stage.addEventListener('pointercancel', (e) => handleWavePointerUp(e, stage));

    const prevBtn       = document.getElementById('wave-prev-btn');
    const nextBtn       = document.getElementById('wave-next-btn');
    const prevBottomBtn = document.getElementById('wave-prev-bottom-btn');
    const nextBottomBtn = document.getElementById('wave-next-bottom-btn');
    if (prevBtn)       prevBtn.addEventListener('click', prevWaveCard);
    if (nextBtn)       nextBtn.addEventListener('click', nextWaveCard);
    if (prevBottomBtn) prevBottomBtn.addEventListener('click', prevWaveCard);
    if (nextBottomBtn) nextBottomBtn.addEventListener('click', nextWaveCard);

    stage.addEventListener('dblclick', toggleWaveOrientation);

    stage.addEventListener('wheel', (event) => {
      event.preventDefault();
      const direction = Math.sign(Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX);
      if (!direction) return;
      waveState.basePhase  += direction;
      waveState.targetPhase = waveState.basePhase;
      waveState.active      = false;
      waveState.lastInput   = performance.now();
      updateWaveIndicator();
    }, { passive: false });

    window.addEventListener('keydown', (event) => {
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', ' '].includes(event.key)) {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        event.preventDefault();
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextWaveCard();
      if (event.key === 'ArrowLeft'  || event.key === 'ArrowUp')   prevWaveCard();
      if (event.key === ' ') toggleWaveOrientation();
      if (event.key === 'Enter') {
        const activeIdx = nearestWaveIndex(waveCards.length);
        if (waveState.currentItems[activeIdx]) openDetailWithWarp(waveState.currentItems[activeIdx]);
      }
    });

    window.addEventListener('resize', () => {
      if (!waveState.manualOrientation) {
        waveState.targetOrientation = window.innerWidth < 680 ? 1 : 0;
      }
    });
  }

  if (!waveAnimationActive) {
    waveAnimationActive = true;
    wavePreviousTime    = performance.now();
    requestAnimationFrame(renderWaveLoop);
  }
}
