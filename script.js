/* ============================================
   Operação WiFi Seguro - Lógica Principal
   ============================================ */

const CONFIG = {
  TIMER_SECONDS: 20,
  POINTS_CORRECT: 10,
  POINTS_WRONG: 5,
  POINTS_BONUS_FAST: 5,
  FAST_ANSWER_THRESHOLD: 10,
  QUESTIONS_PER_QUIZ: 5,
  SOCCER_OPTIONS_COUNT: 3,
  RANKING_KEY: 'tiririca_wifi_ranking',
  MAX_RANKING: 20,
  CERTIFICATE_THRESHOLD: 0.8,
  TEST_TIMER_SECONDS: 60,
  TEST_MODE_KEY: 'tiririca_test_mode',
  MAX_NAME_LENGTH: 30,
  MAX_COURSE_LENGTH: 30
};

let testMode = false;

let questionBank = [];
let soccerGame3D = null;
let currentSoccerOptions = [];
let soccerTimer = null;

const state = {
  player: { name: '', age: '', course: '' },
  questions: [],
  currentIndex: 0,
  score: 0,
  correctCount: 0,
  wrongCount: 0,
  timer: null,
  questionDeadline: 0,
  questionStartTime: 0,
  quizStartTime: 0,
  answered: false,
  lastAnswerFast: false
};

const soccerState = {
  questions: [],
  currentIndex: 0,
  score: 0,
  correctCount: 0,
  wrongCount: 0,
  answered: false,
  lastAnswerFast: false,
  questionStartTime: 0,
  questionDeadline: 0,
  quizStartTime: 0
};

const screens = {
  welcome: document.getElementById('screen-welcome'),
  quiz: document.getElementById('screen-quiz'),
  feedback: document.getElementById('screen-feedback'),
  results: document.getElementById('screen-results'),
  ranking: document.getElementById('screen-ranking'),
  soccer: document.getElementById('screen-soccer'),
  soccerEnd: document.getElementById('screen-soccer-end'),
  presentation: document.getElementById('screen-presentation')
};

let feedbackMode = 'quiz';

function showScreen(screenName) {
  Object.values(screens).forEach(s => s && s.classList.remove('active'));
  if (screens[screenName]) screens[screenName].classList.add('active');
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Modo chute: 1 correta + 2 erradas (tela pequena) */
function pickSoccerOptions(options) {
  const indexed = options.map((opt, i) => ({ ...opt, originalIndex: i }));
  const correct = indexed.find((o) => o.correct);
  const wrong = indexed.filter((o) => !o.correct);
  const pickedWrong = shuffleArray(wrong).slice(0, CONFIG.SOCCER_OPTIONS_COUNT - 1);
  return shuffleArray([correct, ...pickedWrong]);
}

function getQuestionMedia(question) {
  const mapped = window.QUESTION_IMAGE_MAP?.[question.question];
  if (mapped?.url) return mapped;
  return window.QUESTION_IMAGE_FALLBACK || {
    url: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=800&q=80',
    alt: 'Segurança digital e Wi-Fi'
  };
}

function setQuestionImage(imgEl, wrapEl, question) {
  if (!imgEl) return;
  const media = getQuestionMedia(question);
  const fallback = window.QUESTION_IMAGE_FALLBACK?.url || media.url;

  imgEl.onerror = () => {
    if (imgEl.dataset.fallbackApplied === '1') return;
    imgEl.dataset.fallbackApplied = '1';
    imgEl.src = fallback;
  };

  imgEl.dataset.fallbackApplied = '0';
  imgEl.src = media.url;
  imgEl.alt = media.alt || question.question;

  if (wrapEl) wrapEl.classList.remove('hidden');
}

function loadQuestions() {
  const btn = document.getElementById('btn-start-quiz');
  const btnIcon = document.getElementById('btn-start-icon');
  const btnText = document.getElementById('btn-start-text');
  const data = window.QUESTIONS_DATA;

  if (!data) {
    btn.disabled = true;
    btnIcon.className = 'fas fa-exclamation-triangle';
    btnText.textContent = 'Erro ao carregar perguntas';
    return;
  }

  questionBank = data.questions || data;

  if (!Array.isArray(questionBank) || questionBank.length === 0) {
    btn.disabled = true;
    btnIcon.className = 'fas fa-exclamation-triangle';
    btnText.textContent = 'Nenhuma pergunta encontrada';
    return;
  }

  btn.disabled = false;
  btnIcon.className = 'fas fa-play';
  btnText.textContent = 'Começar Quiz';
}

function selectQuizQuestions() {
  const shuffled = shuffleArray(questionBank);
  const count = Math.min(CONFIG.QUESTIONS_PER_QUIZ, shuffled.length);
  return shuffled.slice(0, count);
}

const audioFiles = { acertou: 'faustao-acertou', errou: 'faustao-errou', aplausos: 'aplausos' };
const speechMessages = { acertou: 'Acertou!', errou: 'Errou!', aplausos: '' };

function playSound(type) {
  const filename = audioFiles[type];
  if (!filename) return;
  const extensions = ['mp3', 'wav'];
  function tryExtension(index) {
    if (index >= extensions.length) {
      if ('speechSynthesis' in window && speechMessages[type]) {
        const u = new SpeechSynthesisUtterance(speechMessages[type]);
        u.lang = 'pt-BR';
        speechSynthesis.speak(u);
      }
      return;
    }
    new Audio(`audio/${filename}.${extensions[index]}`).play().catch(() => tryExtension(index + 1));
  }
  tryExtension(0);
}

function isTestMode() {
  return testMode;
}

function getTimerSeconds() {
  return testMode ? CONFIG.TEST_TIMER_SECONDS : CONFIG.TIMER_SECONDS;
}

function loadTestMode() {
  try {
    testMode = sessionStorage.getItem(CONFIG.TEST_MODE_KEY) === '1';
  } catch {
    testMode = false;
  }
  updateTestModeUI();
}

function setTestMode(enabled) {
  testMode = !!enabled;
  try {
    sessionStorage.setItem(CONFIG.TEST_MODE_KEY, testMode ? '1' : '0');
  } catch { /* ignore */ }
  updateTestModeUI();
}

function updateTestModeUI() {
  const chk = document.getElementById('chk-test-mode');
  if (chk) chk.checked = testMode;
  document.body.classList.toggle('test-mode-active', testMode);
  document.querySelectorAll('.test-mode-badge').forEach((el) => {
    el.classList.toggle('hidden', !testMode);
  });
}

function clearRanking() {
  if (!confirm('Zerar todo o ranking? Esta ação não pode ser desfeita.')) return;
  try {
    localStorage.removeItem(CONFIG.RANKING_KEY);
  } catch { /* ignore */ }
  renderRanking();
}

function validateForm() {
  if (isTestMode()) return true;

  const name = document.getElementById('input-name').value.trim();
  const age = document.getElementById('input-age').value.trim();
  const course = document.getElementById('input-course').value.trim();
  let valid = true;

  [
    { id: 'input-name', errorId: 'error-name', value: name, message: 'Informe seu nome.' },
    { id: 'input-age', errorId: 'error-age', value: age, message: 'Informe sua idade.' },
    { id: 'input-course', errorId: 'error-course', value: course, message: 'Informe seu curso.' }
  ].forEach(({ id, errorId, value, message }) => {
    const input = document.getElementById(id);
    const errorEl = document.getElementById(errorId);
    if (!value) {
      input.classList.add('invalid');
      errorEl.textContent = message;
      valid = false;
    } else {
      input.classList.remove('invalid');
      errorEl.textContent = '';
    }
  });

  if (age && (isNaN(age) || parseInt(age) < 1 || parseInt(age) > 120)) {
    document.getElementById('input-age').classList.add('invalid');
    document.getElementById('error-age').textContent = 'Idade inválida (1 a 120).';
    valid = false;
  }

  if (name && name.length > CONFIG.MAX_NAME_LENGTH) {
    document.getElementById('input-name').classList.add('invalid');
    document.getElementById('error-name').textContent =
      `O nome deve ter no máximo ${CONFIG.MAX_NAME_LENGTH} caracteres.`;
    valid = false;
  }

  if (course && course.length > CONFIG.MAX_COURSE_LENGTH) {
    document.getElementById('input-course').classList.add('invalid');
    document.getElementById('error-course').textContent =
      `O curso deve ter no máximo ${CONFIG.MAX_COURSE_LENGTH} caracteres.`;
    valid = false;
  }

  return valid;
}

function getPlayerData() {
  const name = document.getElementById('input-name').value.trim();
  const age = document.getElementById('input-age').value.trim();
  const course = document.getElementById('input-course').value.trim();

  if (isTestMode() && (!name || !age || !course)) {
    return {
      name: (name || 'Participante Teste').slice(0, CONFIG.MAX_NAME_LENGTH),
      age: age || '18',
      course: (course || 'Modo Teste').slice(0, CONFIG.MAX_COURSE_LENGTH)
    };
  }

  return {
    name: name.slice(0, CONFIG.MAX_NAME_LENGTH),
    age,
    course: course.slice(0, CONFIG.MAX_COURSE_LENGTH)
  };
}

// ========== QUIZ (múltipla escolha) ==========

function startQuiz() {
  if (questionBank.length === 0) return;
  state.player = getPlayerData();
  state.questions = selectQuizQuestions();
  state.currentIndex = 0;
  state.score = 0;
  state.correctCount = 0;
  state.wrongCount = 0;
  state.quizStartTime = Date.now();

  document.getElementById('quiz-player-name').textContent = state.player.name;
  document.getElementById('total-questions').textContent = state.questions.length;
  document.getElementById('quiz-score').textContent = '0';

  showScreen('quiz');
  renderQuestion();
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];
  state.answered = false;
  state.questionDeadline = Date.now() + getTimerSeconds() * 1000;
  state.questionStartTime = Date.now();

  document.getElementById('current-question').textContent = state.currentIndex + 1;
  document.getElementById('question-text').textContent = question.question;
  setQuestionImage(
    document.getElementById('question-image'),
    document.querySelector('#screen-quiz .question-image-wrap'),
    question
  );
  document.getElementById('progress-fill').style.width =
    `${(state.currentIndex / state.questions.length) * 100}%`;

  const shuffledOptions = shuffleArray(question.options.map((opt, i) => ({ ...opt, originalIndex: i })));
  const container = document.getElementById('options-container');
  container.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  shuffledOptions.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-letter">${letters[i]}</span><span>${opt.text}</span>`;
    btn.addEventListener('click', () => handleAnswer(opt, btn, shuffledOptions));
    if (isTestMode() && opt.correct) btn.classList.add('option-btn-test-hint');
    container.appendChild(btn);
  });

  startTimer();
}

function getQuestionTimeLeftMs(deadline) {
  return Math.max(0, deadline - Date.now());
}

function formatQuestionTimer(msLeft) {
  const ms = Math.max(0, msLeft);
  const secs = Math.floor(ms / 1000);
  const millis = ms % 1000;
  return `${secs}.${String(millis).padStart(3, '0')}`;
}

function updateTimerWarningClass(displayEl, msLeft) {
  if (!displayEl) return;
  displayEl.classList.toggle('warning', msLeft <= 5000 && msLeft > 0);
  displayEl.classList.toggle('critical', msLeft <= 2000 && msLeft > 0);
}

function startTimer() {
  clearInterval(state.timer);
  tickQuizTimer();
  state.timer = setInterval(tickQuizTimer, 50);
}

function tickQuizTimer() {
  const msLeft = getQuestionTimeLeftMs(state.questionDeadline);
  document.getElementById('timer-value').textContent = formatQuestionTimer(msLeft);
  updateTimerWarningClass(document.getElementById('timer-display'), msLeft);

  if (msLeft <= 0) {
    clearInterval(state.timer);
    if (!state.answered) handleTimeout();
  }
}

function updateTimerDisplay() {
  const msLeft = getQuestionTimeLeftMs(state.questionDeadline);
  document.getElementById('timer-value').textContent = formatQuestionTimer(msLeft);
  updateTimerWarningClass(document.getElementById('timer-display'), msLeft);
}

function handleAnswer(selectedOption, clickedBtn, allOptions) {
  if (state.answered) return;
  state.answered = true;
  clearInterval(state.timer);

  const isCorrect = selectedOption.correct;
  state.lastAnswerFast = getQuestionTimeLeftMs(state.questionDeadline) >= CONFIG.FAST_ANSWER_THRESHOLD * 1000;

  document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);

  if (isCorrect) {
    clickedBtn.classList.add('correct');
    state.correctCount++;
    let points = CONFIG.POINTS_CORRECT;
    if (state.lastAnswerFast) points += CONFIG.POINTS_BONUS_FAST;
    state.score += points;
    document.getElementById('quiz-score').textContent = state.score;
    playSound('acertou');
  } else {
    clickedBtn.classList.add('wrong');
    state.wrongCount++;
    allOptions.forEach((opt, i) => {
      if (opt.correct) document.querySelectorAll('.option-btn')[i].classList.add('correct');
    });
    playSound('errou');
  }

  feedbackMode = 'quiz';
  setTimeout(() => showFeedback(isCorrect), 600);
}

function handleTimeout() {
  state.answered = true;
  state.wrongCount++;
  state.lastAnswerFast = false;

  document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);
  const question = state.questions[state.currentIndex];
  const correct = question.options.find(o => o.correct);
  document.querySelectorAll('.option-btn').forEach(btn => {
    if (btn.querySelector('span:last-child').textContent === correct.text) btn.classList.add('correct');
  });

  playSound('errou');
  feedbackMode = 'quiz';
  setTimeout(() => showFeedback(false, true), 600);
}

function showFeedback(isCorrect, timedOut = false) {
  const question = feedbackMode === 'quiz'
    ? state.questions[state.currentIndex]
    : soccerState.questions[soccerState.currentIndex];

  const card = document.getElementById('feedback-card');
  const icon = document.getElementById('feedback-icon');
  const title = document.getElementById('feedback-title');
  const message = document.getElementById('feedback-message');
  const explanation = document.getElementById('feedback-explanation');
  const bonusBadge = document.getElementById('bonus-badge');
  const lastFast = feedbackMode === 'quiz' ? state.lastAnswerFast : soccerState.lastAnswerFast;

  card.className = 'card glass feedback-card ' + (isCorrect ? 'success' : 'error');

  if (isCorrect) {
    icon.innerHTML = '<i class="fas fa-check-circle"></i>';
    title.textContent = feedbackMode === 'soccer' ? 'GOL!' : 'Correto!';
    message.textContent = feedbackMode === 'soccer'
      ? 'Boa mira! Você chutou na resposta certa.'
      : 'Parabéns! Você aplicou corretamente um conceito importante de segurança digital.';
  } else {
    icon.innerHTML = '<i class="fas fa-times-circle"></i>';
    title.textContent = timedOut ? 'Tempo Esgotado!' : (feedbackMode === 'soccer' ? 'Errou o alvo!' : 'Incorreto');
    message.textContent = timedOut
      ? 'O tempo acabou! Veja a explicação abaixo.'
      : feedbackMode === 'soccer'
        ? 'Chutou no alvo errado. Veja a explicação!'
        : 'Não foi dessa vez, mas aprender com os erros é parte do processo!';
  }

  explanation.textContent = question.explanation;
  bonusBadge.classList.toggle('hidden', !(isCorrect && lastFast));

  setQuestionImage(
    document.getElementById('feedback-question-image'),
    document.getElementById('feedback-image-wrap'),
    question
  );

  const nextBtn = document.getElementById('btn-next-question');
  const isLastQuestion = feedbackMode === 'quiz'
    ? state.currentIndex >= state.questions.length - 1
    : soccerState.currentIndex >= soccerState.questions.length - 1;

  if (isLastQuestion) {
    nextBtn.innerHTML = 'Finalizar <i class="fas fa-flag-checkered"></i>';
  } else {
    nextBtn.innerHTML = 'Próxima Pergunta <i class="fas fa-arrow-right"></i>';
  }

  showScreen('feedback');
}

function nextQuestion() {
  if (feedbackMode === 'quiz') {
    state.currentIndex++;
    if (state.currentIndex < state.questions.length) {
      showScreen('quiz');
      renderQuestion();
    } else {
      finishQuiz();
    }
  } else {
    soccerState.currentIndex++;
    if (soccerState.currentIndex < soccerState.questions.length) {
      showScreen('soccer');
      startSoccerQuestion();
    } else {
      finishSoccerMode();
    }
  }
}

function finishQuiz() {
  const finishTimeMs = Date.now() - state.quizStartTime;
  const totalQuestions = state.questions.length;
  const percent = Math.round((state.correctCount / totalQuestions) * 100);

  const rankPosition = isTestMode() ? 0 : saveToRanking({
    name: state.player.name,
    course: state.player.course,
    age: state.player.age,
    score: state.score,
    finishTimeMs,
    mode: 'quiz',
    date: new Date().toISOString()
  });

  document.getElementById('result-score').textContent = state.score;
  document.getElementById('result-correct').textContent = state.correctCount;
  document.getElementById('result-wrong').textContent = state.wrongCount;
  document.getElementById('result-time').textContent = formatElapsedTime(finishTimeMs);
  document.getElementById('result-rank').textContent = isTestMode()
    ? 'Modo teste'
    : (rankPosition > 0 ? `${rankPosition}º` : '-');
  document.getElementById('result-percent').textContent = `${percent}%`;
  document.getElementById('results-motivation').textContent = getMotivationalMessage(percent);

  const certificate = document.getElementById('certificate');
  const pixHint = document.getElementById('pix-winner-hint');

  if (percent > CONFIG.CERTIFICATE_THRESHOLD * 100) {
    certificate.classList.remove('hidden');
    launchConfetti();
    playSound('aplausos');
  } else {
    certificate.classList.add('hidden');
  }

  showPixRankHint(isTestMode() ? 0 : rankPosition, pixHint);

  document.getElementById('progress-fill').style.width = '100%';
  showScreen('results');
}

// ========== MODO CHUTE 3D ==========

function startSoccerMode() {
  if (questionBank.length === 0) return;
  if (typeof THREE === 'undefined' || typeof SoccerGame3D === 'undefined') {
    alert('Não foi possível carregar o motor 3D. Verifique sua conexão e recarregue a página.');
    return;
  }

  state.player = getPlayerData();
  soccerState.questions = selectQuizQuestions();
  soccerState.currentIndex = 0;
  soccerState.score = 0;
  soccerState.correctCount = 0;
  soccerState.wrongCount = 0;
  soccerState.quizStartTime = Date.now();

  document.getElementById('soccer-player-name').textContent = state.player.name;
  document.getElementById('soccer-total-questions').textContent = soccerState.questions.length;
  document.getElementById('soccer-score').textContent = '0';

  // Mostrar tela ANTES de criar o canvas (evita largura 0)
  showScreen('soccer');
  initSoccerCrowdControls();
  window.SoccerAudio?.startCrowd();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initSoccerGame3D();
      startSoccerQuestion();
    });
  });
}

function updateKickPowerDisplay(power, visible) {
  const wrap = document.getElementById('kick-power-wrap');
  const fill = document.getElementById('kick-power-fill');
  if (!wrap || !fill) return;
  if (visible) {
    wrap.classList.remove('hidden');
    wrap.setAttribute('aria-hidden', 'false');
    fill.style.width = `${Math.round(power * 100)}%`;
  } else {
    wrap.classList.add('hidden');
    wrap.setAttribute('aria-hidden', 'true');
    fill.style.width = '0%';
  }
}

function initSoccerGame3D() {
  const container = document.getElementById('game-3d-container');
  if (soccerGame3D) soccerGame3D.destroy();
  container.innerHTML = '';
  soccerGame3D = new SoccerGame3D(container, {
    onHit: (option) => handleSoccerHit(option),
    onKick: () => window.SoccerAudio?.playKick(),
    onPowerChange: (power, visible) => updateKickPowerDisplay(power, visible)
  });

  requestAnimationFrame(() => soccerGame3D?.resize());

  const zoomIn = document.getElementById('btn-camera-zoom-in');
  const zoomOut = document.getElementById('btn-camera-zoom-out');
  if (zoomIn) zoomIn.onclick = () => soccerGame3D?.zoomIn();
  if (zoomOut) zoomOut.onclick = () => soccerGame3D?.zoomOut();
}

function initSoccerCrowdControls() {
  window.SoccerAudio?.init();
  window.SoccerAudio?.loadSavedVolume();

  const volDown = document.getElementById('btn-crowd-volume-down');
  const volUp = document.getElementById('btn-crowd-volume-up');
  if (volDown) volDown.onclick = () => window.SoccerAudio?.adjustVolume(-0.1);
  if (volUp) volUp.onclick = () => window.SoccerAudio?.adjustVolume(0.1);
}

function startSoccerQuestion() {
  const question = soccerState.questions[soccerState.currentIndex];
  soccerState.answered = false;
  soccerState.questionDeadline = Date.now() + getTimerSeconds() * 1000;
  soccerState.questionStartTime = Date.now();

  document.getElementById('soccer-current-question').textContent = soccerState.currentIndex + 1;
  document.getElementById('soccer-question-text').textContent = question.question;
  setQuestionImage(
    document.getElementById('soccer-question-image'),
    document.querySelector('#soccer-question-image')?.closest('.question-image-wrap'),
    question
  );
  document.getElementById('soccer-progress-fill').style.width =
    `${(soccerState.currentIndex / soccerState.questions.length) * 100}%`;

  currentSoccerOptions = pickSoccerOptions(question.options);

  if (soccerGame3D) {
    requestAnimationFrame(() => {
      soccerGame3D.resize();
      soccerGame3D.loadQuestion(currentSoccerOptions, { testMode: isTestMode() });
    });
  }
  startSoccerTimer();
}

function startSoccerTimer() {
  clearInterval(soccerTimer);
  tickSoccerTimer();
  soccerTimer = setInterval(tickSoccerTimer, 50);
}

function tickSoccerTimer() {
  const msLeft = getQuestionTimeLeftMs(soccerState.questionDeadline);
  document.getElementById('soccer-timer-value').textContent = formatQuestionTimer(msLeft);
  updateTimerWarningClass(document.getElementById('soccer-timer-display'), msLeft);

  if (msLeft <= 0) {
    clearInterval(soccerTimer);
    if (!soccerState.answered) handleSoccerTimeout();
  }
}

function updateSoccerTimerDisplay() {
  const msLeft = getQuestionTimeLeftMs(soccerState.questionDeadline);
  document.getElementById('soccer-timer-value').textContent = formatQuestionTimer(msLeft);
  updateTimerWarningClass(document.getElementById('soccer-timer-display'), msLeft);
}

function showSoccerPopup(text, isPositive) {
  const popup = document.getElementById('soccer-score-popup');
  document.getElementById('soccer-score-popup-text').textContent = text;
  popup.className = 'game-score-popup ' + (isPositive ? 'popup-win' : 'popup-lose');
  popup.classList.remove('hidden');
  setTimeout(() => popup.classList.add('hidden'), 1400);
}

function handleSoccerHit(option) {
  if (soccerState.answered) return;
  soccerState.answered = true;
  clearInterval(soccerTimer);

  const isCorrect = option.correct;
  soccerState.lastAnswerFast = getQuestionTimeLeftMs(soccerState.questionDeadline) >= CONFIG.FAST_ANSWER_THRESHOLD * 1000;

  if (isCorrect) {
    soccerState.correctCount++;
    let points = CONFIG.POINTS_CORRECT;
    if (soccerState.lastAnswerFast) points += CONFIG.POINTS_BONUS_FAST;
    soccerState.score += points;
    document.getElementById('soccer-score').textContent = soccerState.score;
    showSoccerPopup(`GOL! +${points} pontos`, true);
    window.SoccerAudio?.playGoalNarration();
  } else {
    soccerState.wrongCount++;
    if (!isTestMode()) {
      soccerState.score = Math.max(0, soccerState.score - CONFIG.POINTS_WRONG);
    }
    document.getElementById('soccer-score').textContent = soccerState.score;
    showSoccerPopup(`-${CONFIG.POINTS_WRONG} pontos`, false);
    window.SoccerAudio?.playMissNarration();
  }

  feedbackMode = 'soccer';
  setTimeout(() => showFeedback(isCorrect), 1600);
}

function handleSoccerTimeout() {
  if (soccerState.answered) return;
  soccerState.answered = true;
  soccerState.wrongCount++;
  soccerState.lastAnswerFast = false;
  if (!isTestMode()) {
    soccerState.score = Math.max(0, soccerState.score - CONFIG.POINTS_WRONG);
  }
  document.getElementById('soccer-score').textContent = soccerState.score;

  if (soccerGame3D) {
    soccerGame3D.setAnswered();
    soccerGame3D.highlightResults(null);
  }

  showSoccerPopup(`-${CONFIG.POINTS_WRONG} pontos! Tempo esgotado`, false);
  window.SoccerAudio?.playTimeoutNarration();
  feedbackMode = 'soccer';
  setTimeout(() => showFeedback(false, true), 1600);
}

function finishSoccerMode() {
  window.SoccerAudio?.stopCrowd();
  if (soccerGame3D) {
    soccerGame3D.destroy();
    soccerGame3D = null;
  }
  clearInterval(soccerTimer);

  const totalQuestions = soccerState.questions.length;
  const percent = totalQuestions > 0
    ? Math.round((soccerState.correctCount / totalQuestions) * 100)
    : 0;

  const finishTimeMs = Date.now() - soccerState.quizStartTime;

  const rankPosition = isTestMode() ? 0 : saveToRanking({
    name: state.player.name,
    course: state.player.course,
    age: state.player.age,
    score: soccerState.score,
    finishTimeMs,
    mode: 'soccer',
    date: new Date().toISOString()
  });

  document.getElementById('soccer-result-score').textContent = soccerState.score;
  document.getElementById('soccer-result-correct').textContent = soccerState.correctCount;
  document.getElementById('soccer-result-wrong').textContent = soccerState.wrongCount;
  document.getElementById('soccer-result-rank').textContent = isTestMode()
    ? 'Modo teste'
    : (rankPosition > 0 ? `${rankPosition}º` : '-');
  document.getElementById('soccer-result-percent').textContent = `${percent}%`;
  document.getElementById('soccer-results-motivation').textContent = getMotivationalMessage(percent);

  showPixRankHint(isTestMode() ? 0 : rankPosition, document.getElementById('soccer-pix-winner-hint'));

  if (totalQuestions > 0 && soccerState.correctCount === totalQuestions) {
    window.SoccerAudio?.playAllPerfectEnd();
  } else if (totalQuestions > 0 && soccerState.wrongCount === totalQuestions) {
    window.SoccerAudio?.playAllWrongEnd();
  }

  showScreen('soccerEnd');
}

function exitSoccerMode() {
  goToHome();
}

// ========== Utilitários ==========

function formatElapsedTime(ms) {
  const totalMs = Math.max(0, Math.round(ms));
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  const msStr = String(millis).padStart(3, '0');
  if (mins > 0) return `${mins}m ${secs}s ${msStr}ms`;
  return `${secs}s ${msStr}ms`;
}

function formatRankingTime(finishTimeMs) {
  if (typeof finishTimeMs !== 'number' || finishTimeMs < 0) return '—';
  return formatElapsedTime(finishTimeMs);
}

function compareRankingEntries(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  const timeA = typeof a.finishTimeMs === 'number' ? a.finishTimeMs : Number.MAX_SAFE_INTEGER;
  const timeB = typeof b.finishTimeMs === 'number' ? b.finishTimeMs : Number.MAX_SAFE_INTEGER;
  return timeA - timeB;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function getMotivationalMessage(percent) {
  if (percent >= 90) return 'Arrasou! Você é o craque da segurança digital nesta Copa!';
  if (percent >= 80) return 'Grande jogo! Você está entre os melhores pontuadores da segurança Wi-Fi!';
  if (percent >= 60) return 'Bom desempenho! Treine mais e dispute o Pix de R$ 50!';
  if (percent >= 40) return 'Você está no caminho! A Copa exige foco — tente de novo!';
  return 'Não desista! Todo campeão erra antes de levantar a taça!';
}

function getRanking() {
  try {
    const data = localStorage.getItem(CONFIG.RANKING_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveToRanking(entry) {
  const ranking = getRanking();
  ranking.push(entry);
  ranking.sort(compareRankingEntries);
  const trimmed = ranking.slice(0, CONFIG.MAX_RANKING);
  localStorage.setItem(CONFIG.RANKING_KEY, JSON.stringify(trimmed));
  const idx = trimmed.findIndex((r) =>
    r.date === entry.date &&
    r.name === entry.name &&
    r.score === entry.score &&
    r.finishTimeMs === entry.finishTimeMs
  );
  return idx >= 0 ? idx + 1 : 0;
}

function showPixRankHint(rankPosition, hintEl) {
  if (!hintEl) return;
  if (rankPosition === 1) {
    hintEl.classList.remove('hidden');
    hintEl.querySelector('span').innerHTML =
      '🏆 <strong>CAMPEÃO!</strong> Você está em 1º lugar e concorre ao <strong>Pix de R$ 50</strong>!';
    launchConfetti();
  } else if (rankPosition > 0 && rankPosition <= 3) {
    hintEl.classList.remove('hidden');
    hintEl.querySelector('span').innerHTML =
      `Você ficou em <strong>${rankPosition}º lugar</strong>! O 1º lugar leva o <strong>Pix de R$ 50</strong> — jogue de novo!`;
  } else {
    hintEl.classList.add('hidden');
  }
}

function renderRanking() {
  const ranking = getRanking();
  const tbody = document.getElementById('ranking-body');
  const emptyMsg = document.getElementById('empty-ranking');
  tbody.innerHTML = '';

  if (ranking.length === 0) {
    emptyMsg.classList.remove('hidden');
    document.querySelector('.table-wrapper').classList.add('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');
  document.querySelector('.table-wrapper').classList.remove('hidden');

  ranking.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i === 0) tr.classList.add('rank-champion');
    const pixTag = i === 0 ? '<span class="champion-pix-tag"><i class="fas fa-qrcode"></i> Pix R$50</span>' : '';
    tr.innerHTML = `
      <td class="rank-position">${i + 1}º</td>
      <td>${escapeHtml(entry.name)}${pixTag}</td>
      <td>${escapeHtml(entry.course)}</td>
      <td class="rank-score">${entry.score} pts</td>
      <td class="rank-time">${formatRankingTime(entry.finishTimeMs)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#009739', '#FFDF00', '#32BCAD', '#002776', '#FFFFFF', '#F59E0B'];
  const particles = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    w: Math.random() * 10 + 5,
    h: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    speedY: Math.random() * 3 + 2,
    speedX: Math.random() * 2 - 1,
    rotation: Math.random() * 360,
    rotationSpeed: Math.random() * 10 - 5
  }));

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;
    particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (frame < 180) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

function resetGame() {
  goToHome();
  document.getElementById('form-start').reset();
  document.querySelectorAll('.form-group input').forEach(i => i.classList.remove('invalid'));
  document.querySelectorAll('.error-msg').forEach(el => { el.textContent = ''; });
}

function goToHome() {
  const presentationScreen = document.getElementById('screen-presentation');
  if (presentationScreen?.classList.contains('active') && typeof exitPresentation === 'function') {
    exitPresentation();
    return;
  }
  clearInterval(state.timer);
  clearInterval(soccerTimer);
  window.SoccerAudio?.stopCrowd();
  if (soccerGame3D) {
    soccerGame3D.destroy();
    soccerGame3D = null;
  }
  document.body.classList.remove('presentation-active');
  showScreen('welcome');
}

// --- Event Listeners ---
document.getElementById('form-start').addEventListener('submit', (e) => {
  e.preventDefault();
  if (validateForm()) startQuiz();
});

document.getElementById('btn-start-soccer').addEventListener('click', () => {
  if (validateForm()) startSoccerMode();
});

document.getElementById('btn-next-question').addEventListener('click', nextQuestion);
document.getElementById('btn-play-again').addEventListener('click', resetGame);
document.getElementById('btn-exit-soccer').addEventListener('click', exitSoccerMode);
document.getElementById('btn-soccer-play-again').addEventListener('click', () => {
  if (validateForm()) startSoccerMode();
});
document.getElementById('btn-soccer-home').addEventListener('click', exitSoccerMode);

document.getElementById('btn-view-ranking-soccer').addEventListener('click', () => {
  renderRanking();
  showScreen('ranking');
});

document.getElementById('btn-view-ranking-welcome').addEventListener('click', () => {
  renderRanking();
  showScreen('ranking');
});
document.getElementById('btn-view-ranking-results').addEventListener('click', () => {
  renderRanking();
  showScreen('ranking');
});
document.getElementById('btn-back-home').addEventListener('click', goToHome);
document.getElementById('btn-header-home')?.addEventListener('click', goToHome);

window.addEventListener('resize', () => {
  const canvas = document.getElementById('confetti-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (soccerGame3D && screens.soccer.classList.contains('active')) {
    soccerGame3D.resize();
    soccerGame3D.loadQuestion(currentSoccerOptions, { testMode: isTestMode() });
  }
});

document.getElementById('btn-clear-ranking')?.addEventListener('click', clearRanking);
document.getElementById('chk-test-mode')?.addEventListener('change', (e) => {
  setTestMode(e.target.checked);
});

loadQuestions();
loadTestMode();
initSoccerCrowdControls();
