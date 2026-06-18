/* ============================================
   Modo Apresentação — Slides educativos
   ============================================ */

const PRESENTATION_SLIDES = [
  {
    layout: 'title',
    icon: 'fa-wifi',
    title: 'Copa WiFi Seguro nas Escolas',
    subtitle: 'Segurança no Uso do Wi-Fi Escolar',
    meta: 'Faculdade Edufor · Práticas de Extensão Universitária V · Edição Copa 2026',
    image: 'assets/presentation/slide-sala-aula.png'
  },
  {
    layout: 'content',
    title: 'Por que isso importa?',
    image: 'assets/presentation/slide-sala-aula.png',
    bullets: [
      'Escolas usam Wi-Fi para aulas, pesquisas e plataformas digitais.',
      'Uma rede mal protegida pode expor dados de alunos e professores.',
      'Pequenos hábitos seguros evitam golpes, vazamentos e invasões.',
      'Segurança digital é responsabilidade de todos na comunidade escolar.'
    ]
  },
  {
    layout: 'content',
    title: 'Redes Wi-Fi: aberta x protegida',
    image: 'assets/presentation/slide-wifi-aberta.jpg',
    bullets: [
      'Rede aberta: qualquer pessoa conecta sem senha — maior risco.',
      'Rede escolar com senha: só quem é autorizado deve entrar.',
      'Não compartilhe a senha da escola com colegas ou visitantes.',
      'Prefira protocolos modernos: WPA2 e WPA3.'
    ]
  },
  {
    layout: 'content',
    title: 'Senhas fortes e únicas',
    image: 'assets/presentation/slide-senha.jpg',
    bullets: [
      'Evite senhas fáceis como 12345678 ou nome da escola.',
      'Use letras, números e símbolos em combinações longas.',
      'Não reutilize a mesma senha em vários sites.',
      'Autenticação em dois fatores (2FA) aumenta muito a proteção.'
    ]
  },
  {
    layout: 'content',
    title: 'Sites seguros: HTTPS e o cadeado',
    image: 'assets/presentation/slide-https.jpg',
    bullets: [
      'O cadeado na barra do navegador indica conexão criptografada.',
      'HTTPS protege login, senhas e dados enviados ao site.',
      'Desconfie de endereços estranhos ou com erros de escrita.',
      'Ao acessar a plataforma da escola, verifique se o site é oficial.'
    ]
  },
  {
    layout: 'content',
    title: 'Phishing e engenharia social',
    image: 'assets/presentation/slide-phishing.jpg',
    bullets: [
      'Phishing: mensagens falsas que pedem senha ou dados pessoais.',
      'Golpistas exploram urgência, medo e curiosidade.',
      'Nunca clique em links suspeitos de e-mail ou WhatsApp.',
      'Escolas e bancos não pedem senha por mensagem.'
    ]
  },
  {
    layout: 'content',
    title: 'Wi-Fi público: cuidado redobrado',
    image: 'assets/presentation/slide-wifi-publico.jpg',
    bullets: [
      'Em redes públicas, outros usuários podem interceptar dados.',
      'Evite acessos bancários e compras em Wi-Fi aberto.',
      'Desative “conectar automaticamente” em redes desconhecidas.',
      'VPN ajuda a proteger o tráfego quando necessário.'
    ]
  },
  {
    layout: 'content',
    title: 'Proteja seus dispositivos',
    image: 'assets/presentation/slide-celular.jpg',
    bullets: [
      'Mantenha sistema e aplicativos sempre atualizados.',
      'Use bloqueio por senha, PIN ou biometria no celular.',
      'Baixe apps apenas de lojas oficiais.',
      'Não conecte pen drives desconhecidos no laboratório.'
    ]
  },
  {
    layout: 'content',
    title: 'Na escola: boas práticas',
    image: 'assets/presentation/slide-laboratorio.jpg',
    bullets: [
      'Saia da sua conta ao terminar no computador compartilhado.',
      'Não poste documentos, senhas ou dados sensíveis nas redes.',
      'Denuncie ciberbullying e avise um adulto responsável.',
      'Reporte problemas de segurança à equipe de TI da escola.'
    ]
  },
  {
    layout: 'topics',
    title: 'O que o quiz aborda',
    intro: 'São 67 perguntas no banco — cada partida sorteia 5 questões sobre:',
    topics: [
      'Wi-Fi aberto e redes escolares',
      'Senhas, 2FA e gerenciadores',
      'HTTPS, phishing e golpes online',
      'Malware, ransomware e backups',
      'Privacidade, redes sociais e IoT',
      'Laboratório, USB e uso ético',
      'Ciberbullying e pegada digital'
    ]
  },
  {
    layout: 'content',
    title: 'Exemplos de perguntas do quiz',
    image: 'assets/presentation/slide-quiz-exemplo.jpg',
    bullets: [
      'O que significa uma rede Wi-Fi aberta?',
      'Qual símbolo indica conexão segura em um site?',
      'O que é phishing?',
      'Por que a rede Wi-Fi da escola deve ter senha?',
      'O que fazer ao encontrar um pen drive desconhecido?'
    ],
    note: 'Cada resposta traz uma explicação para aprender na hora.'
  },
  {
    layout: 'play',
    title: 'Como participar da atividade',
    image: 'assets/presentation/slide-premio-pix.png',
    bullets: [
      'Preencha nome, idade e curso na página inicial.',
      'Responda 5 perguntas no quiz — 20 segundos cada.',
      'Ganhe pontos por acerto (+10) e bônus por resposta rápida.',
      'Entre no ranking: 1º lugar concorre ao Pix de R$ 50!',
      'Modo Chute 3D é opcional — diversão com as mesmas questões.'
    ]
  },
  {
    layout: 'end',
    title: 'Prontos para jogar?',
    subtitle: 'Volte à página inicial e comece o quiz com a turma!',
    icon: 'fa-futbol'
  }
];

const PRESENTATION_IMAGE_FALLBACK = 'assets/presentation/slide-sala-aula.png';
const PRESENTATION_DURATION_SECONDS = 5 * 60;

const presentationState = {
  index: 0,
  active: false,
  timeLeft: PRESENTATION_DURATION_SECONDS
};

let presentationTimer = null;

function formatPresentationTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updatePresentationTimerDisplay() {
  const el = document.getElementById('presentation-timer-value');
  const display = document.getElementById('presentation-timer-display');
  const timeFill = document.getElementById('presentation-time-fill');
  if (!el || !display) return;

  el.textContent = formatPresentationTime(presentationState.timeLeft);
  const pct = (presentationState.timeLeft / PRESENTATION_DURATION_SECONDS) * 100;
  if (timeFill) timeFill.style.width = `${pct}%`;

  display.classList.toggle('warning', presentationState.timeLeft <= 60);
  display.classList.toggle('critical', presentationState.timeLeft <= 30);
}

function clearPresentationTimer() {
  if (presentationTimer) {
    clearInterval(presentationTimer);
    presentationTimer = null;
  }
}

function startPresentationTimer() {
  clearPresentationTimer();
  presentationState.timeLeft = PRESENTATION_DURATION_SECONDS;
  updatePresentationTimerDisplay();

  presentationTimer = setInterval(() => {
    presentationState.timeLeft--;
    updatePresentationTimerDisplay();

    if (presentationState.timeLeft <= 0) {
      clearPresentationTimer();
      exitPresentation();
    }
  }, 1000);
}

function escapeHtmlPresentation(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function slideImgTag(src, alt) {
  const safeAlt = escapeHtmlPresentation(alt || 'Ilustração');
  const safeSrc = escapeHtmlPresentation(src);
  const fallback = escapeHtmlPresentation(PRESENTATION_IMAGE_FALLBACK);
  return `<img src="${safeSrc}" alt="${safeAlt}" loading="eager" onerror="this.onerror=null;this.src='${fallback}'">`;
}

function renderPresentationSlide() {
  const slide = PRESENTATION_SLIDES[presentationState.index];
  const container = document.getElementById('presentation-slide');
  const total = PRESENTATION_SLIDES.length;
  const current = presentationState.index + 1;

  document.getElementById('slide-counter').textContent = `${current} / ${total}`;
  document.getElementById('slide-progress-fill').style.width = `${(current / total) * 100}%`;

  const prevBtn = document.getElementById('btn-slide-prev');
  const nextBtn = document.getElementById('btn-slide-next');
  const isFirst = presentationState.index === 0;
  const isLast = presentationState.index === total - 1;

  prevBtn.disabled = isFirst;
  nextBtn.innerHTML = isLast
    ? 'Voltar ao início <i class="fas fa-home"></i>'
    : 'Próximo <i class="fas fa-arrow-right"></i>';

  let html = '';

  if (slide.layout === 'title') {
    html = `
      <div class="slide-layout slide-title">
        ${slide.image ? `<div class="slide-visual">${slideImgTag(slide.image, slide.title)}</div>` : ''}
        <div class="slide-body">
          <span class="slide-icon"><i class="fas ${slide.icon}"></i></span>
          <h1>${escapeHtmlPresentation(slide.title)}</h1>
          <p class="slide-subtitle">${escapeHtmlPresentation(slide.subtitle)}</p>
          <p class="slide-meta">${escapeHtmlPresentation(slide.meta)}</p>
        </div>
      </div>`;
  } else if (slide.layout === 'topics') {
    html = `
      <div class="slide-layout slide-topics">
        <div class="slide-body slide-body-full">
          <h2>${escapeHtmlPresentation(slide.title)}</h2>
          <p class="slide-intro">${escapeHtmlPresentation(slide.intro)}</p>
          <ul class="slide-topic-grid">
            ${slide.topics.map((t) => `<li><i class="fas fa-check-circle"></i> ${escapeHtmlPresentation(t)}</li>`).join('')}
          </ul>
        </div>
      </div>`;
  } else if (slide.layout === 'end') {
    html = `
      <div class="slide-layout slide-end">
        <span class="slide-icon slide-icon-large"><i class="fas ${slide.icon}"></i></span>
        <h2>${escapeHtmlPresentation(slide.title)}</h2>
        <p class="slide-subtitle">${escapeHtmlPresentation(slide.subtitle)}</p>
        <button type="button" class="btn btn-primary btn-slide-finish" id="btn-slide-finish">
          <i class="fas fa-home"></i> Voltar à página inicial
        </button>
      </div>`;
  } else if (slide.layout === 'play') {
    html = `
      <div class="slide-layout slide-content slide-play">
        <div class="slide-body">
          <h2>${escapeHtmlPresentation(slide.title)}</h2>
          <ul class="slide-bullets">
            ${slide.bullets.map((b) => `<li>${escapeHtmlPresentation(b)}</li>`).join('')}
          </ul>
        </div>
        ${slide.image ? `<div class="slide-visual slide-visual-prize">${slideImgTag(slide.image, 'Prêmio Pix')}</div>` : ''}
      </div>`;
  } else {
    html = `
      <div class="slide-layout slide-content">
        ${slide.image ? `<div class="slide-visual">${slideImgTag(slide.image, slide.title)}</div>` : ''}
        <div class="slide-body">
          <h2>${escapeHtmlPresentation(slide.title)}</h2>
          <ul class="slide-bullets">
            ${slide.bullets.map((b) => `<li>${escapeHtmlPresentation(b)}</li>`).join('')}
          </ul>
          ${slide.note ? `<p class="slide-note"><i class="fas fa-lightbulb"></i> ${escapeHtmlPresentation(slide.note)}</p>` : ''}
        </div>
      </div>`;
  }

  container.innerHTML = html;
  container.className = `presentation-slide slide-${slide.layout}`;

  const finishBtn = document.getElementById('btn-slide-finish');
  if (finishBtn) finishBtn.addEventListener('click', exitPresentation);
}

function startPresentation() {
  presentationState.index = 0;
  presentationState.active = true;
  document.body.classList.add('presentation-active');
  showScreen('presentation');
  startPresentationTimer();
  renderPresentationSlide();
}

function exitPresentation(targetScreen = 'welcome') {
  presentationState.active = false;
  clearPresentationTimer();
  document.body.classList.remove('presentation-active');
  showScreen(targetScreen);
}

function nextPresentationSlide() {
  if (presentationState.index < PRESENTATION_SLIDES.length - 1) {
    presentationState.index++;
    renderPresentationSlide();
  } else {
    exitPresentation();
  }
}

function prevPresentationSlide() {
  if (presentationState.index > 0) {
    presentationState.index--;
    renderPresentationSlide();
  }
}

function handlePresentationKeydown(e) {
  if (!presentationState.active) return;
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault();
    nextPresentationSlide();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    prevPresentationSlide();
  } else if (e.key === 'Escape') {
    exitPresentation();
  }
}

document.addEventListener('keydown', handlePresentationKeydown);

function initPresentationControls() {
  const startBtn = document.getElementById('btn-start-presentation');
  if (startBtn) startBtn.addEventListener('click', startPresentation);

  const prevBtn = document.getElementById('btn-slide-prev');
  if (prevBtn) prevBtn.addEventListener('click', prevPresentationSlide);

  const nextBtn = document.getElementById('btn-slide-next');
  if (nextBtn) nextBtn.addEventListener('click', nextPresentationSlide);

  const exitBtn = document.getElementById('btn-slide-exit');
  if (exitBtn) exitBtn.addEventListener('click', exitPresentation);
}

initPresentationControls();
