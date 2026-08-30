/**
 * 和菓子屋の女将さん ～ Web Audio API 和風サウンドエンジン
 * 琴、笛、太鼓、拍子木、各種効果音をリアルタイム合成
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.bgmGain = null;
    this.seGain = null;
    this.isMuted = false;
    this.bgmPlaying = false;
    this.currentBgmType = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
  }

  // ユーザー操作時にオーディオコンテキストを初期化
  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // マスター音量設定
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);

      this.seGain = this.ctx.createGain();
      this.seGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.seGain.connect(this.masterGain);

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // =========================================================================
  // 効果音 (SE) シンセサイザー
  // =========================================================================

  // ジャンプ音 (軽やかなピョン)
  playJump() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.12);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    osc.connect(gain);
    gain.connect(this.seGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // 2段ジャンプ音 (鈴・チャイムのようなキラキラ音)
  playDoubleJump() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.03;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(gain);
      gain.connect(this.seGain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  // 和菓子取得音 (シャリーン＋和のポコッ)
  playCollectItem() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 高音の和風チャイム
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.seGain);
    osc.start(now);
    osc.stop(now + 0.13);

    // 木魚風のポコッというアタック
    const woodOsc = this.ctx.createOscillator();
    const woodGain = this.ctx.createGain();
    woodOsc.type = 'triangle';
    woodOsc.frequency.setValueAtTime(440, now);
    woodOsc.frequency.exponentialRampToValueAtTime(180, now + 0.05);

    woodGain.gain.setValueAtTime(0.5, now);
    woodGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    woodOsc.connect(woodGain);
    woodGain.connect(this.seGain);
    woodOsc.start(now);
    woodOsc.stop(now + 0.07);
  }

  // パワーアップ発動音 (太鼓のドン＋華やかなファンファーレ)
  playPowerup() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 太鼓のドン
    const drum = this.ctx.createOscillator();
    const drumGain = this.ctx.createGain();
    drum.type = 'sine';
    drum.frequency.setValueAtTime(180, now);
    drum.frequency.exponentialRampToValueAtTime(45, now + 0.35);

    drumGain.gain.setValueAtTime(0.8, now);
    drumGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    drum.connect(drumGain);
    drumGain.connect(this.seGain);
    drum.start(now);
    drum.stop(now + 0.36);

    // 華やかな和音
    [440, 554.37, 659.25, 880].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.05);

      gain.gain.setValueAtTime(0.35, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

      osc.connect(gain);
      gain.connect(this.seGain);
      osc.start(now + 0.05);
      osc.stop(now + 0.46);
    });
  }

  // 和菓子シュート音 (シュパッ)
  playShoot() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.09);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.seGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // 敵満足・浄化音 (ポワワ〜ン♪＋鈴)
  playEnemySatisfied() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    [659.25, 880, 987.77, 1318.5].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.04;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

      osc.connect(gain);
      gain.connect(this.seGain);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  // 餅つき臼の大ジャンプ (ボヨヨ〜ン)
  playSpring() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.25);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.seGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // 被弾ダメージ音 (ペシッ・鈍い衝撃音)
  playDamage() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(this.seGain);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  // お茶会フィーバー突入音 (拍子木＋ドラ風の華やかな響き)
  playFeverStart() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 拍子木 (カチッ・カチッ)
    [0, 0.08].forEach((offset) => {
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800, t);
      osc.frequency.exponentialRampToValueAtTime(900, t + 0.03);

      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

      osc.connect(gain);
      gain.connect(this.seGain);
      osc.start(t);
      osc.stop(t + 0.05);
    });

    // 銅鑼の余韻
    const gong = this.ctx.createOscillator();
    const gongGain = this.ctx.createGain();
    gong.type = 'sawtooth';
    gong.frequency.setValueAtTime(220, now + 0.16);
    gong.frequency.exponentialRampToValueAtTime(80, now + 0.9);

    gongGain.gain.setValueAtTime(0.6, now + 0.16);
    gongGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    gong.connect(gongGain);
    gongGain.connect(this.seGain);
    gong.start(now + 0.16);
    gong.stop(now + 1.0);
  }

  // =========================================================================
  // 和風 BGM シンセサイザー (琴・笛・太鼓の自動演奏)
  // =========================================================================

  playBGM(type = 'game') {
    if (!this.ctx) this.init();
    if (this.currentBgmType === type && this.bgmPlaying) return;

    this.stopBGM();
    this.currentBgmType = type;
    this.bgmPlaying = true;
    this.bgmStep = 0;

    // 音階定義 (和風ペンタトニック: A, C, D, E, G / 都節: D, Eb, G, A, Bb)
    // 陽音階: C4, D4, F4, G4, A4, C5 (261.6, 293.7, 349.2, 392.0, 440.0, 523.3)
    const scale = [261.63, 293.66, 349.23, 392.00, 440.00, 523.25, 587.33, 698.46, 783.99, 880.00];

    // メロディパターン
    const gameMelody = [
      0, 2, 3, 5,  4, 3, 2, 0,
      2, 3, 5, 7,  6, 5, 3, 2,
      5, 7, 8, 9,  8, 7, 5, 3,
      4, 3, 2, 3,  2, 0, 2, 3
    ];

    const feverMelody = [
      5, 7, 8, 9,  9, 8, 7, 5,
      8, 9, 10, 11, 10, 9, 8, 7,
      5, 8, 7, 5,  3, 5, 7, 8,
      9, 8, 9, 10, 9, 7, 5, 3
    ];

    const tempo = type === 'fever' ? 125 : 155; // ms per step

    this.bgmTimer = setInterval(() => {
      if (!this.ctx || this.isMuted || !this.bgmPlaying) return;

      const now = this.ctx.currentTime;
      const melody = type === 'fever' ? feverMelody : gameMelody;
      const noteIdx = melody[this.bgmStep % melody.length];
      const freq = scale[noteIdx % scale.length];

      // 1. 琴 (Koto) 風のプラック音
      if (this.bgmStep % 2 === 0 || type === 'fever') {
        const kotoOsc = this.ctx.createOscillator();
        const kotoGain = this.ctx.createGain();
        kotoOsc.type = 'triangle';
        kotoOsc.frequency.setValueAtTime(freq, now);

        kotoGain.gain.setValueAtTime(0.2, now);
        kotoGain.gain.exponentialRampToValueAtTime(0.005, now + 0.22);

        kotoOsc.connect(kotoGain);
        kotoGain.connect(this.bgmGain);
        kotoOsc.start(now);
        kotoOsc.stop(now + 0.25);
      }

      // 2. 篠笛 (Flute) 風の滑らかなリード (長音)
      if (this.bgmStep % 4 === 0) {
        const fluteOsc = this.ctx.createOscillator();
        const fluteGain = this.ctx.createGain();
        fluteOsc.type = 'sine';
        fluteOsc.frequency.setValueAtTime(freq * 1.5, now);

        fluteGain.gain.setValueAtTime(0.01, now);
        fluteGain.gain.linearRampToValueAtTime(0.12, now + 0.08);
        fluteGain.gain.exponentialRampToValueAtTime(0.005, now + 0.45);

        fluteOsc.connect(fluteGain);
        fluteGain.connect(this.bgmGain);
        fluteOsc.start(now);
        fluteOsc.stop(now + 0.48);
      }

      // 3. 和太鼓・拍子木リズム (Taiko & Hyoshigi)
      if (this.bgmStep % 4 === 0) {
        // 太鼓ドン
        const taikoOsc = this.ctx.createOscillator();
        const taikoGain = this.ctx.createGain();
        taikoOsc.type = 'sine';
        taikoOsc.frequency.setValueAtTime(120, now);
        taikoOsc.frequency.exponentialRampToValueAtTime(40, now + 0.18);

        taikoGain.gain.setValueAtTime(0.4, now);
        taikoGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

        taikoOsc.connect(taikoGain);
        taikoGain.connect(this.bgmGain);
        taikoOsc.start(now);
        taikoOsc.stop(now + 0.2);
      } else if (this.bgmStep % 4 === 2) {
        // 拍子木カン
        const hyoOsc = this.ctx.createOscillator();
        const hyoGain = this.ctx.createGain();
        hyoOsc.type = 'triangle';
        hyoOsc.frequency.setValueAtTime(1600, now);
        hyoOsc.frequency.exponentialRampToValueAtTime(700, now + 0.04);

        hyoGain.gain.setValueAtTime(0.25, now);
        hyoGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        hyoOsc.connect(hyoGain);
        hyoGain.connect(this.bgmGain);
        hyoOsc.start(now);
        hyoOsc.stop(now + 0.06);
      }

      this.bgmStep++;
    }, tempo);
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

// シングルトンインスタンス
const soundEngine = new SoundEngine();
