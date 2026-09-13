// ===== detail.js =====
// 詳細（図鑑たんけん）画面の描画とタイムマシン（ワープ）演出

// ---- ワープ演出 → 詳細表示 ----

function openDetailWithWarp(item) {
  stopSpeech();
  playPopSound();
  currentItem = item;

  const eraText = item.history_steps && item.history_steps[0]
    ? item.history_steps[0].era
    : '大むかし';

  warpText.innerHTML = `<span>🌀</span><br>${item.name}の はじまりへ…<br><span style="font-size: 20px; color: #fef08a;">${eraText}に タイムスリップ！</span>`;
  warpOverlay.classList.add('active');

  setTimeout(() => {
    warpOverlay.classList.remove('active');
    showDetail(item);
  }, 1100);
}

// ---- 詳細画面レンダリング ----

function showDetail(item) {
  waveAnimationActive = false;
  homeView.style.display = 'none';
  detailView.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // ヒーローヘッダー
  document.getElementById('detail-icon').textContent    = item.icon;
  document.getElementById('detail-name').innerHTML      = `<ruby>${item.name}<rt>${item.reading}</rt></ruby>`;
  document.getElementById('detail-badge').textContent   = item.badge || `${item.origin.country}から きたよ`;

  // 起源セクション
  document.getElementById('origin-country').innerHTML   = `${item.origin.country_flag || '🌍'} ${item.origin.country}`;
  document.getElementById('origin-word').textContent    = item.origin.original_word || '-';
  document.getElementById('origin-meaning').textContent = item.origin.meaning || '-';
  document.getElementById('origin-story').textContent   = item.origin.story;

  // タイムライン
  const timelineEl = document.getElementById('detail-timeline');
  timelineEl.innerHTML = '';
  item.history_steps.forEach((step, idx) => {
    const isCurrent = idx === item.history_steps.length - 1;
    const stepDiv   = document.createElement('div');
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
    const card     = document.createElement('div');
    card.className = 'trivia-card';
    card.innerHTML = `
      <div class="trivia-icon">${i % 2 === 0 ? '💡' : '👑'}</div>
      <div class="trivia-text">${t}</div>
    `;
    triviaEl.appendChild(card);
  });

  // 3択クイズ
  const quizBox = document.getElementById('detail-quiz');
  if (item.quiz) {
    quizBox.style.display = 'block';
    document.getElementById('quiz-question').textContent = item.quiz.question;

    const optContainer = document.getElementById('quiz-options');
    optContainer.innerHTML = '';
    const feedback = document.getElementById('quiz-feedback');
    feedback.className    = 'quiz-feedback';
    feedback.style.display = 'none';

    item.quiz.options.forEach((opt, idx) => {
      const btn     = document.createElement('button');
      btn.className = 'quiz-opt-btn';
      btn.textContent = `${idx + 1}. ${opt}`;
      btn.addEventListener('click', () => {
        const allBtns = optContainer.querySelectorAll('.quiz-opt-btn');
        allBtns.forEach(b => b.disabled = true);

        if (idx === item.quiz.answer) {
          btn.classList.add('correct');
          feedback.className = 'quiz-feedback show correct-msg';
          feedback.innerHTML = `🎉 <strong>せいかい！</strong><br>${item.quiz.explanation}`;
          playPositiveSound();
          const rect = btn.getBoundingClientRect();
          launchConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        } else {
          btn.classList.add('wrong');
          allBtns[item.quiz.answer].classList.add('correct');
          feedback.className = 'quiz-feedback show wrong-msg';
          feedback.innerHTML = `😢 <strong>おしい！</strong><br>${item.quiz.explanation}`;
          playGentleThudSound();
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
