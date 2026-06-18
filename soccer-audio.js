/* ============================================
   Áudio do Modo Chute — torcida, chute, narrador
   ============================================ */

const SoccerAudio = {
  ctx: null,
  masterGain: null,
  volume: 0.2,
  minVolume: 0,
  maxVolume: 1,
  crowdActive: false,
  _resumeBound: false,
  _currentSfx: null,
  _crowdAudio: null,

  soccerSfxFiles: {
    crowd: 'grito-da-torcida',
    goal: 'gol-de-brasil',
    miss: 'minha-nossa',
    allPerfect: 'treta',
    allWrong: 'terminou'
  },

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);

    if (!this._resumeBound) {
      this._resumeBound = true;
      const resume = () => {
        if (this.ctx?.state === 'suspended') this.ctx.resume();
      };
      document.addEventListener('click', resume, { once: false });
      document.addEventListener('touchstart', resume, { once: false });
    }
  },

  async _ensureRunning() {
    this.init();
    if (this.ctx?.state === 'suspended') {
      try { await this.ctx.resume(); } catch (_) { /* ignore */ }
    }
  },

  setVolume(value) {
    this.volume = Math.max(this.minVolume, Math.min(this.maxVolume, value));
    if (this._crowdAudio) this._crowdAudio.volume = this._crowdAudioVolume();
    this._updateVolumeLabel();
    try {
      localStorage.setItem('tiririca_crowd_volume', String(this.volume));
    } catch (_) { /* ignore */ }
  },

  adjustVolume(delta) {
    this.setVolume(this.volume + delta);
  },

  loadSavedVolume() {
    try {
      const saved = parseFloat(localStorage.getItem('tiririca_crowd_volume'));
      if (!Number.isNaN(saved)) this.volume = saved;
    } catch (_) { /* ignore */ }
    this._updateVolumeLabel();
  },

  _updateVolumeLabel() {
    const el = document.getElementById('crowd-volume-value');
    if (el) el.textContent = `${Math.round(this.volume * 100)}%`;
  },

  _crowdAudioVolume() {
    return Math.min(0.45, 0.05 + this.volume * 0.35);
  },

  _startCrowdAudio() {
    const filename = this.soccerSfxFiles.crowd;
    const extensions = ['mp3', 'wav'];

    const playLoop = (audio) => {
      audio.loop = true;
      audio.volume = this._crowdAudioVolume();
      this._crowdAudio = audio;
      if (this.crowdActive) {
        audio.play().catch(() => {});
      }
    };

    if (this._crowdAudio) {
      this._crowdAudio.volume = this._crowdAudioVolume();
      if (this.crowdActive) {
        this._crowdAudio.play().catch(() => {});
      }
      return;
    }

    const tryExtension = (index) => {
      if (index >= extensions.length) return;
      const audio = new Audio(`audio/${filename}.${extensions[index]}`);
      audio.addEventListener('error', () => tryExtension(index + 1), { once: true });
      playLoop(audio);
    };

    tryExtension(0);
  },

  startCrowd() {
    this.loadSavedVolume();
    this.crowdActive = true;
    this._startCrowdAudio();
  },

  stopCrowd() {
    this.crowdActive = false;
    this._stopSfx();
    if (this._crowdAudio) {
      this._crowdAudio.pause();
      this._crowdAudio.currentTime = 0;
    }
  },

  playKick() {
    this._ensureRunning();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.45, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    gain.connect(this.masterGain);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);

    const click = this.ctx.createOscillator();
    click.type = 'square';
    click.frequency.value = 80;

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.2, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    click.connect(clickGain);
    clickGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
    click.start(now);
    click.stop(now + 0.05);
  },

  playGoalCheer() {
    if (!this._crowdAudio) return;
    const base = this._crowdAudioVolume();
    this._crowdAudio.volume = Math.min(0.55, base + 0.1);
    setTimeout(() => {
      if (this._crowdAudio && this.crowdActive) {
        this._crowdAudio.volume = this._crowdAudioVolume();
      }
    }, 1500);
  },

  _stopSfx() {
    if (this._currentSfx) {
      this._currentSfx.pause();
      this._currentSfx.currentTime = 0;
      this._currentSfx = null;
    }
  },

  _playSfx(filename, onFail) {
    if (!filename) {
      if (onFail) onFail();
      return;
    }

    this._stopSfx();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    const extensions = ['mp3', 'wav'];
    const tryExtension = (index) => {
      if (index >= extensions.length) {
        if (onFail) onFail();
        return;
      }

      const audio = new Audio(`audio/${filename}.${extensions[index]}`);
      audio.volume = Math.min(1, 0.55 + this.volume * 0.45);
      this._currentSfx = audio;
      audio.play().catch(() => tryExtension(index + 1));
    };

    tryExtension(0);
  },

  playGoalNarration() {
    this._playSfx(this.soccerSfxFiles.goal, () => {
      this.playGoalCheer();
      this._narrate([
        'Gooooool! É gol!',
        'Gol! Que golaço!',
        'É gol! A rede balançou!'
      ]);
    });
  },

  playMissNarration() {
    this._playSfx(this.soccerSfxFiles.miss, () => {
      this._narrate([
        'Fora! Pra fora do gol!',
        'Fora! Errou o alvo!',
        'Pra fora! Não foi dessa vez!'
      ]);
    });
  },

  playTimeoutNarration() {
    this._playSfx(this.soccerSfxFiles.miss, () => {
      this._narrate([
        'Fora! O tempo acabou!',
        'Tempo esgotado! Fora do gol!'
      ]);
    });
  },

  playAllPerfectEnd() {
    this._playSfx(this.soccerSfxFiles.allPerfect);
  },

  playAllWrongEnd() {
    this._playSfx(this.soccerSfxFiles.allWrong);
  },

  _narrate(messages) {
    if (!('speechSynthesis' in window)) return;

    const text = Array.isArray(messages)
      ? messages[Math.floor(Math.random() * messages.length)]
      : messages;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    utterance.volume = Math.min(1, 0.85 + this.volume * 0.15);

    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;

    window.speechSynthesis.speak(utterance);
  }
};

if (typeof window !== 'undefined') {
  window.SoccerAudio = SoccerAudio;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {};
  }
}
