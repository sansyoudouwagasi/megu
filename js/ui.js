/**
 * 和菓子屋の女将さん ～ UI & HUD マネージャー
 * タイトル、HUD、結果画面、和菓子図鑑、ヘルプモーダルの制御
 */

class UIManager {
  constructor() {
    // 要素参照
    this.titleScreen = document.getElementById('title-screen');
    this.gameHud = document.getElementById('game-hud');
    this.resultModal = document.getElementById('result-modal');
    this.zukanModal = document.getElementById('zukan-modal');
    this.howtoplayModal = document.getElementById('howtoplay-modal');
    this.feverBanner = document.getElementById('fever-banner');

    // HUD要素
    this.hudLivesContainer = document.getElementById('hud-lives-container');
    this.hudScore = document.getElementById('hud-score');
    this.hudDistance = document.getElementById('hud-distance');
    this.hudComboText = document.getElementById('hud-combo-text');
    this.hudFeverFill = document.getElementById('hud-fever-fill');
    this.hudPowerupBadges = document.getElementById('hud-powerup-badges');
    this.hudSoundToggle = document.getElementById('hud-sound-toggle');

    // 結果画面要素
    this.resScore = document.getElementById('res-score');
    this.resDistance = document.getElementById('res-distance');
    this.resItems = document.getElementById('res-items');
    this.resHighscore = document.getElementById('res-highscore');

    // 宿場町リスト（東海道五十三次風）
    this.stations = [
      { name: '日本橋', dist: 0 },
      { name: '品川宿', dist: 300 },
      { name: '川崎宿', dist: 700 },
      { name: '神奈川宿', dist: 1200 },
      { name: '程ヶ谷宿', dist: 1800 },
      { name: '戸塚宿', dist: 2500 },
      { name: '藤沢宿', dist: 3300 },
      { name: '平塚宿', dist: 4200 },
      { name: '大磯宿', dist: 5200 },
      { name: '小田原宿', dist: 6500 },
      { name: '箱根宿', dist: 8000 }
    ];

    this.initEvents();
  }

  initEvents() {
    // タイトルボタン
    document.getElementById('btn-start').addEventListener('click', () => {
      soundEngine.init();
      window.game.startGame();
    });

    document.getElementById('btn-open-zukan').addEventListener('click', () => {
      this.zukanModal.classList.remove('hidden');
    });

    document.getElementById('btn-close-zukan').addEventListener('click', () => {
      this.zukanModal.classList.add('hidden');
    });

    document.getElementById('btn-open-howtoplay').addEventListener('click', () => {
      this.howtoplayModal.classList.remove('hidden');
    });

    document.getElementById('btn-close-howtoplay').addEventListener('click', () => {
      this.howtoplayModal.classList.add('hidden');
    });

    // 結果画面ボタン
    document.getElementById('btn-retry').addEventListener('click', () => {
      this.resultModal.classList.add('hidden');
      window.game.startGame();
    });

    document.getElementById('btn-back-to-title').addEventListener('click', () => {
      this.resultModal.classList.add('hidden');
      this.showTitle();
    });

    // 音声切替
    this.hudSoundToggle.addEventListener('click', () => {
      const muted = soundEngine.toggleMute();
      this.hudSoundToggle.textContent = muted ? '🔇' : '🔊';
    });
  }

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.gameHud.classList.add('hidden');
    this.resultModal.classList.add('hidden');
    soundEngine.playBGM('title');
  }

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.gameHud.classList.remove('hidden');
    this.resultModal.classList.add('hidden');
    soundEngine.playBGM('game');
  }

  showGameOver(stats) {
    // ハイスコア計算＆保存
    const prevHigh = parseInt(localStorage.getItem('okami_highscore') || '0', 10);
    const newHigh = Math.max(prevHigh, stats.score);
    localStorage.setItem('okami_highscore', newHigh.toString());

    this.resScore.textContent = stats.score.toLocaleString();
    this.resDistance.textContent = `${Math.floor(stats.distance)}m (${this.getCurrentStation(stats.distance)})`;
    this.resItems.textContent = `${stats.itemsCollected}個`;
    this.resHighscore.textContent = newHigh.toLocaleString();

    this.resultModal.classList.remove('hidden');
    soundEngine.stopBGM();
  }

  getCurrentStation(dist) {
    let current = this.stations[0].name;
    for (let s of this.stations) {
      if (dist >= s.dist) {
        current = s.name;
      }
    }
    return current;
  }

  updateHUD(gameState) {
    // スコア
    this.hudScore.textContent = gameState.score.toLocaleString();

    // 距離・宿場町
    const distM = Math.floor(gameState.distance);
    const station = this.getCurrentStation(distM);
    this.hudDistance.textContent = `${station} ${distM}m`;

    // ライフ更新
    const icons = this.hudLivesContainer.children;
    for (let i = 0; i < icons.length; i++) {
      if (i < gameState.lives) {
        icons[i].classList.remove('lost');
      } else {
        icons[i].classList.add('lost');
      }
    }

    // コンボ＆フィーバーゲージ
    this.hudComboText.textContent = gameState.combo > 1 ? `🍡 連続和菓子: ${gameState.combo}連!` : '和菓子を集めよう';
    const feverPct = Math.min(100, (gameState.feverGauge / 100) * 100);
    this.hudFeverFill.style.width = `${feverPct}%`;

    // パワーアップバッジ
    let badgeHtml = '';
    if (gameState.hasDash) {
      badgeHtml += `<span class="powerup-badge">🍡 団子ダッシュ (${Math.ceil(gameState.dashTimer / 60)}s)</span>`;
    }
    if (gameState.hasShield) {
      badgeHtml += `<span class="powerup-badge">🍵 抹茶シールド</span>`;
    }
    if (gameState.hasDoubleJump) {
      badgeHtml += `<span class="powerup-badge">🥮 2段ジャンプ</span>`;
    }
    if (gameState.sakuramochiStock > 0) {
      badgeHtml += `<span class="powerup-badge">🌸 桜餅×${gameState.sakuramochiStock}</span>`;
    }
    this.hudPowerupBadges.innerHTML = badgeHtml;
  }

  triggerFeverBanner() {
    this.feverBanner.classList.add('active');
    setTimeout(() => {
      this.feverBanner.classList.remove('active');
    }, 1800);
  }
}

// シングルトンインスタンス
const uiManager = new UIManager();
