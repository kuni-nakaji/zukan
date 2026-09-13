// ===== speech.js =====
// 音声読み上げ（SpeechSynthesis）＆ 音声入力（SpeechRecognition）

// ---- 音声読み上げ ----

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

  // 読み上げテキスト構築（子供が聞き取りやすいゆっくりな口調）
  const textParts = [
    `${currentItem.name}。`,
    `${currentItem.origin.country}から きたよ。`,
    `${currentItem.origin.story}`,
    `むかしは どうだったかな？`,
    currentItem.history_steps.map(s => `${s.era}。${s.title}。${s.text}`).join('。'),
    `びっくり まめちしき！`,
    currentItem.trivia.join('。')
  ];

  const utterance  = new SpeechSynthesisUtterance(textParts.join(' '));
  utterance.lang   = 'ja-JP';
  utterance.rate   = 0.92; // 小学1年生が聞き取りやすいスピード
  utterance.pitch  = 1.1;  // 少し明るめの声

  utterance.onstart = () => {
    isSpeaking = true;
    speakBtn.classList.add('speaking');
    speakBtn.innerHTML = '<span>⏹️</span> とめる';
  };

  utterance.onend   = () => stopSpeech();
  utterance.onerror = () => stopSpeech();

  window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  isSpeaking = false;
  speakBtn.classList.remove('speaking');
  speakBtn.innerHTML = '<span>🔊</span> こえで きく';
}

// ---- 音声入力 ----

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = 'none';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang            = 'ja-JP';
  recognition.interimResults  = false;
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
