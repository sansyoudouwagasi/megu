/**
 * 和菓子屋の女将さん ～ メインゲームループ & ゲームロジック
 * 手動スクロール、精密な被弾・ダメージ判定、適切なアイテム出現バランス
 */

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = 450;
    this.height = 800;

    // ゲーム状態
    this.state = 'TITLE'; // 'TITLE', 'PLAYING', 'GAMEOVER'
    this.score = 0;
    this.distance = 0;
    this.itemsCollected = 0;
    this.lives = 3;
    this.combo = 0;
    this.comboTimer = 0;
    this.feverGauge = 0;
    this.isFever = false;
    this.feverTimer = 0;

    // カメラ＆街道設定 (プレイヤーのworldXにカメラが追従)
    this.cameraX = 0;
    this.lastGeneratedX = 0;
    this.baseGroundY = 670; // 基準地面の高さ
    this.groundY = 670;     // 後方互換用（敵生成などで参照）

    // プレイヤー定義
    this.player = {
      worldX: 120, // ワールド内X座標
      y: 570,      // Y座標
      width: 60,
      height: 95,
      vx: 0,
      vy: 0,
      baseSpeed: 4.8,
      isGrounded: true,
      canDoubleJump: false,
      state: 'idle',
      facingRight: true,
      animTimer: 0,
      invincible: false,
      invincibleTimer: 0,
      // パワーアップ
      hasDash: false,
      dashTimer: 0,
      hasShield: false,
      hasDoubleJump: false,
      sakuramochiStock: 2
    };

    // ゲームオブジェクト配列
    this.platforms = [];
    this.items = [];
    this.enemies = [];
    this.projectiles = [];
    this.springs = [];
    this.effects = [];
    this.terrainSegments = []; // 地形セグメント（地面の高低差）
    this.walls = [];           // 壁型障害物（石垣・土塀）

    // 入力状態
    this.keys = {
      left: false,
      right: false,
      jump: false,
      shoot: false
    };

    this.initInputs();
  }

  // =========================================================================
  // 入力イベント（キーボード・タッチ・ボタン）
  // =========================================================================
  initInputs() {
    // キーボード
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'PLAYING') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        if (!this.keys.jump) this.handleJump();
        this.keys.jump = true;
      }
      if (e.code === 'KeyZ' || e.code === 'KeyJ' || e.code === 'Enter') {
        if (!this.keys.shoot) this.handleShoot();
        this.keys.shoot = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') this.keys.jump = false;
      if (e.code === 'KeyZ' || e.code === 'KeyJ' || e.code === 'Enter') this.keys.shoot = false;
    });

    // オンスクリーンボタン
    const bindBtn = (id, keyName, triggerAction = null) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      const handlePress = (e) => {
        e.preventDefault();
        this.keys[keyName] = true;
        btn.classList.add('active');
        if (triggerAction) triggerAction();
      };

      const handleRelease = (e) => {
        e.preventDefault();
        this.keys[keyName] = false;
        btn.classList.remove('active');
      };

      btn.addEventListener('touchstart', handlePress, { passive: false });
      btn.addEventListener('touchend', handleRelease, { passive: false });
      btn.addEventListener('touchcancel', handleRelease, { passive: false });
      btn.addEventListener('mousedown', handlePress);
      btn.addEventListener('mouseup', handleRelease);
      btn.addEventListener('mouseleave', handleRelease);
    };

    bindBtn('btn-left', 'left');
    bindBtn('btn-right', 'right');
    bindBtn('btn-jump', 'jump', () => this.handleJump());
    bindBtn('btn-shoot', 'shoot', () => this.handleShoot());

    // キャンバスタップでのジャンプ
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.state === 'PLAYING') {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const y = touch.clientY - rect.top;
        if (y < rect.height * 0.65) {
          this.handleJump();
        }
      }
    }, { passive: true });
  }

  handleJump() {
    if (this.state !== 'PLAYING') return;

    if (this.player.isGrounded) {
      this.player.vy = -14.5;
      this.player.isGrounded = false;
      this.player.canDoubleJump = this.player.hasDoubleJump;
      soundEngine.playJump();
    } else if (this.player.canDoubleJump) {
      this.player.vy = -13.5;
      this.player.canDoubleJump = false;
      soundEngine.playDoubleJump();
      this.addEffect(this.player.worldX + this.player.width / 2, this.player.y + this.player.height, 'sparkle');
    }
  }

  handleShoot() {
    if (this.state !== 'PLAYING') return;
    if (this.player.sakuramochiStock <= 0) return;

    this.player.sakuramochiStock--;
    soundEngine.playShoot();

    this.projectiles.push({
      x: this.player.worldX + (this.player.facingRight ? this.player.width : -10),
      y: this.player.y + this.player.height * 0.45,
      vx: this.player.facingRight ? 11 : -11,
      vy: -2.0,
      size: 36,
      rotation: 0
    });
  }

  // =========================================================================
  // ゲーム開始
  // =========================================================================
  startGame() {
    this.state = 'PLAYING';
    this.score = 0;
    this.distance = 0;
    this.itemsCollected = 0;
    this.lives = 3;
    this.combo = 0;
    this.comboTimer = 0;
    this.feverGauge = 0;
    this.isFever = false;
    this.feverTimer = 0;

    // プレイヤー初期化
    this.player.worldX = 120;
    this.player.y = this.baseGroundY - this.player.height;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.isGrounded = true;
    this.player.state = 'idle';
    this.player.facingRight = true;
    this.player.animTimer = 0;
    this.player.invincible = false;
    this.player.invincibleTimer = 0;
    this.player.hasDash = false;
    this.player.dashTimer = 0;
    this.player.hasShield = false;
    this.player.hasDoubleJump = false;
    this.player.sakuramochiStock = 2;

    this.cameraX = 0;
    this.lastGeneratedX = 350;
    this.lastTerrainEndX = 0;
    this.currentTerrainY = this.baseGroundY;

    // 配列初期化
    this.platforms = [];
    this.items = [];
    this.enemies = [];
    this.projectiles = [];
    this.springs = [];
    this.effects = [];
    this.terrainSegments = [];
    this.walls = [];

    // 初期の平坦な地面セグメント
    this.terrainSegments.push({
      x: 0,
      width: 600,
      y: this.baseGroundY,
      type: 'flat'
    });
    this.lastTerrainEndX = 600;
    this.currentTerrainY = this.baseGroundY;

    // 初期街道生成
    this.generateStageAhead(1600);

    uiManager.showGame();
  }

  // =========================================================================
  // 地面の高さ取得（terrainSegmentsから該当するセグメントを検索）
  // =========================================================================
  getGroundYAt(worldX) {
    // 該当する地形セグメントを後方から検索（最新のものが優先）
    for (let i = this.terrainSegments.length - 1; i >= 0; i--) {
      const seg = this.terrainSegments[i];
      if (worldX >= seg.x && worldX < seg.x + seg.width) {
        if (seg.type === 'gap') {
          return null; // 穴 — 地面なし
        }
        if (seg.type === 'slope_up') {
          // 上り坂: 左端がseg.yFrom、右端がseg.yTo
          const t = (worldX - seg.x) / seg.width;
          return seg.yFrom + (seg.yTo - seg.yFrom) * t;
        }
        if (seg.type === 'slope_down') {
          const t = (worldX - seg.x) / seg.width;
          return seg.yFrom + (seg.yTo - seg.yFrom) * t;
        }
        return seg.y; // 'flat', 'raised', 'lowered'
      }
    }
    return this.baseGroundY; // デフォルト
  }

  // =========================================================================
  // 地形の前方生成（コースに高低差を付ける）
  // =========================================================================
  generateTerrainAhead(targetX) {
    while (this.lastTerrainEndX < targetX) {
      const roll = Math.random();
      const prevY = this.currentTerrainY;
      // 距離に応じて難易度UP: 距離が進むほど穴や高低差が出やすくなる
      const difficulty = Math.min(1.0, this.distance / 500);

      if (roll < 0.10 + difficulty * 0.08) {
        // ===== 穴（ギャップ）: ジャンプで飛び越える =====
        const gapWidth = 80 + Math.random() * 60 + difficulty * 30;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: gapWidth,
          y: prevY,
          type: 'gap'
        });
        // 穴の上に金平糖を誘導配置
        this.items.push({
          x: this.lastTerrainEndX + gapWidth / 2 - 16,
          y: prevY - 120,
          width: 32,
          height: 32,
          type: 'konpeito'
        });
        this.lastTerrainEndX += gapWidth;
        // 穴の先は平坦な着地帯
        const landingW = 200 + Math.random() * 150;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: landingW,
          y: prevY,
          type: 'flat'
        });
        this.lastTerrainEndX += landingW;

      } else if (roll < 0.22 + difficulty * 0.06) {
        // ===== 上り坂 → 高台 =====
        const riseAmount = 50 + Math.random() * 60;
        const slopeW = 120 + Math.random() * 80;
        const newY = Math.max(480, prevY - riseAmount); // 画面上限制限
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: slopeW,
          yFrom: prevY,
          yTo: newY,
          y: newY,
          type: 'slope_up'
        });
        this.lastTerrainEndX += slopeW;
        // 高台の平坦部分
        const flatW = 250 + Math.random() * 200;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: flatW,
          y: newY,
          type: 'raised'
        });
        this.lastTerrainEndX += flatW;
        this.currentTerrainY = newY;

      } else if (roll < 0.34 + difficulty * 0.04) {
        // ===== 下り坂 → 谷 =====
        const dropAmount = 40 + Math.random() * 50;
        const slopeW = 100 + Math.random() * 80;
        const newY = Math.min(this.baseGroundY, prevY + dropAmount);
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: slopeW,
          yFrom: prevY,
          yTo: newY,
          y: newY,
          type: 'slope_down'
        });
        this.lastTerrainEndX += slopeW;
        const flatW = 200 + Math.random() * 150;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: flatW,
          y: newY,
          type: 'lowered'
        });
        this.lastTerrainEndX += flatW;
        this.currentTerrainY = newY;

      } else if (roll < 0.42 + difficulty * 0.05) {
        // ===== 階段状の段差（3段の上り階段） =====
        const stepW = 90;
        const stepH = 35;
        let stepY = prevY;
        for (let s = 0; s < 3; s++) {
          stepY -= stepH;
          this.terrainSegments.push({
            x: this.lastTerrainEndX,
            width: stepW,
            y: stepY,
            type: 'raised'
          });
          // 各段に金平糖を時々配置
          if (Math.random() < 0.4) {
            this.items.push({
              x: this.lastTerrainEndX + stepW / 2 - 16,
              y: stepY - 42,
              width: 32,
              height: 32,
              type: 'konpeito'
            });
          }
          this.lastTerrainEndX += stepW;
        }
        // 階段の頂上の平坦部分
        const topW = 180 + Math.random() * 120;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: topW,
          y: stepY,
          type: 'raised'
        });
        this.lastTerrainEndX += topW;
        this.currentTerrainY = stepY;

      } else if (roll < 0.50 + difficulty * 0.04) {
        // ===== 地面に石垣の壁（ジャンプで越える） =====
        const wallH = 70 + Math.random() * 40;
        this.walls.push({
          x: this.lastTerrainEndX + 50,
          y: prevY - wallH,
          width: 30,
          height: wallH
        });
        // 壁の先の平坦地面
        const segW = 350 + Math.random() * 200;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: segW,
          y: prevY,
          type: 'flat'
        });
        this.lastTerrainEndX += segW;

      } else if (roll < 0.56 + difficulty * 0.05) {
        // ===== 高台→穴→高台（浮島風） =====
        const riseH = 60 + Math.random() * 40;
        const newY = Math.max(500, prevY - riseH);
        // 上り坂
        const slopeW = 80;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: slopeW,
          yFrom: prevY,
          yTo: newY,
          y: newY,
          type: 'slope_up'
        });
        this.lastTerrainEndX += slopeW;
        // 高台部分
        const platW = 120 + Math.random() * 80;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: platW,
          y: newY,
          type: 'raised'
        });
        this.lastTerrainEndX += platW;
        // 穴
        const gapW = 100 + Math.random() * 50;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: gapW,
          y: newY,
          type: 'gap'
        });
        // 穴の向こう側に着地プラットフォーム
        this.platforms.push({
          x: this.lastTerrainEndX + gapW,
          y: newY,
          width: 120,
          height: 18
        });
        this.lastTerrainEndX += gapW;
        // 下り坂で基準に戻る
        const downW = 80;
        this.terrainSegments.push({
          x: this.lastTerrainEndX + 120,
          width: downW,
          yFrom: newY,
          yTo: this.baseGroundY,
          y: this.baseGroundY,
          type: 'slope_down'
        });
        this.lastTerrainEndX += 120 + downW;
        this.currentTerrainY = this.baseGroundY;

      } else {
        // ===== 通常の平坦地面（基準Yに戻す傾向あり） =====
        // 高すぎたら下り坂で基準Yに向かう
        if (prevY < this.baseGroundY - 40) {
          const slopeW = 100 + Math.random() * 60;
          const returnY = prevY + 40 + Math.random() * 30;
          const newY = Math.min(this.baseGroundY, returnY);
          this.terrainSegments.push({
            x: this.lastTerrainEndX,
            width: slopeW,
            yFrom: prevY,
            yTo: newY,
            y: newY,
            type: 'slope_down'
          });
          this.lastTerrainEndX += slopeW;
          this.currentTerrainY = newY;
        }
        const flatW = 300 + Math.random() * 250;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: flatW,
          y: this.currentTerrainY,
          type: 'flat'
        });
        this.lastTerrainEndX += flatW;
      }
    }
  }

  // =========================================================================
  // 街道・ステージの前方生成（アイテム出現率を適正に抑えたバランス調整）
  // =========================================================================
  generateStageAhead(targetX) {
    // まず地形を先行生成
    this.generateTerrainAhead(targetX + 400);

    const rareWagashi = ['dango', 'daifuku', 'dorayaki', 'sakuramochi'];

    while (this.lastGeneratedX < targetX) {
      // セクションごとの間隔を 350px〜550px に設定し、過密を防ぐ
      const sectionDist = 380 + Math.random() * 200;
      this.lastGeneratedX += sectionDist;
      const x = this.lastGeneratedX;
      const localGroundY = this.getGroundYAt(x) || this.baseGroundY;
      const pattern = Math.random();

      if (pattern < 0.28) {
        // パターン1: 高台の瓦屋根 + 敵（タヌキ）+ 屋根の上に貴重な和菓子1個
        const platW = 140 + Math.random() * 60;
        const platY = localGroundY - (110 + Math.random() * 50);
        this.platforms.push({
          x: x,
          y: platY,
          width: platW,
          height: 18
        });

        // 屋根の上にたまにパワーアップ和菓子
        if (Math.random() < 0.6) {
          this.items.push({
            x: x + platW / 2 - 18,
            y: platY - 42,
            width: 38,
            height: 38,
            type: rareWagashi[Math.floor(Math.random() * rareWagashi.length)]
          });
        }

        // 地上にいたずらタヌキ（地上を巡回）
        const tanukiGroundY = this.getGroundYAt(x + platW + 80) || localGroundY;
        this.enemies.push({
          x: x + platW + 40,
          y: tanukiGroundY - 55,
          width: 52,
          height: 52,
          minX: x + platW,
          maxX: x + platW + 120,
          vx: -0.8,
          type: 'tanuki',
          isSatisfied: false
        });
      } else if (pattern < 0.50) {
        // パターン2: 転がる酒樽障害物 + 金平糖1〜2個
        const barrelGroundY = this.getGroundYAt(x + 100) || localGroundY;
        this.enemies.push({
          x: x + 100,
          y: barrelGroundY - 46,
          width: 46,
          height: 46,
          vx: -2.4,
          type: 'barrel',
          rotation: 0,
          isSatisfied: false
        });

        // 控えめに金平糖を1個配置
        if (Math.random() < 0.5) {
          this.items.push({
            x: x + 20,
            y: localGroundY - 45,
            width: 32,
            height: 32,
            type: 'konpeito'
          });
        }
      } else if (pattern < 0.70) {
        // パターン3: 急降下カラス + 空中に金平糖
        this.enemies.push({
          x: x + 120,
          y: localGroundY - 170,
          baseY: localGroundY - 170,
          width: 50,
          height: 44,
          vx: -1.8,
          type: 'crow',
          animPhase: Math.random() * Math.PI * 2,
          isSatisfied: false
        });

        if (Math.random() < 0.45) {
          this.items.push({
            x: x + 40,
            y: localGroundY - 120,
            width: 34,
            height: 34,
            type: Math.random() < 0.3 ? rareWagashi[Math.floor(Math.random() * rareWagashi.length)] : 'konpeito'
          });
        }
      } else if (pattern < 0.82) {
        // パターン4: 壁＋タヌキ の複合（壁を超えるとタヌキが待っている）
        const wallH = 65 + Math.random() * 35;
        this.walls.push({
          x: x,
          y: localGroundY - wallH,
          width: 28,
          height: wallH
        });
        // 壁の向こう側にタヌキ
        const tanukiX = x + 60;
        const tanukiGroundY = this.getGroundYAt(tanukiX) || localGroundY;
        if (tanukiGroundY !== null) {
          this.enemies.push({
            x: tanukiX,
            y: tanukiGroundY - 55,
            width: 52,
            height: 52,
            minX: tanukiX - 40,
            maxX: tanukiX + 80,
            vx: -0.8,
            type: 'tanuki',
            isSatisfied: false
          });
        }
        // 壁の上に和菓子
        if (Math.random() < 0.5) {
          this.items.push({
            x: x - 4,
            y: localGroundY - wallH - 42,
            width: 36,
            height: 36,
            type: rareWagashi[Math.floor(Math.random() * rareWagashi.length)]
          });
        }
      } else {
        // パターン5: 餅つきの大臼（トランポリン） + 高空の和菓子
        this.springs.push({
          x: x,
          y: localGroundY - 36,
          width: 52,
          height: 36
        });

        // 大臼で跳んだ高空に貴重な和菓子
        this.items.push({
          x: x + 8,
          y: localGroundY - 210,
          width: 40,
          height: 40,
          type: rareWagashi[Math.floor(Math.random() * rareWagashi.length)]
        });
      }
    }
  }

  // =========================================================================
  // パワーアップ適用
  // =========================================================================
  applyPowerup(type) {
    this.score += 250;
    this.itemsCollected++;
    this.combo++;
    this.comboTimer = 240; // 約4秒

    // フィーバーゲージ蓄積（程よい上昇速度に調整）
    this.feverGauge = Math.min(100, this.feverGauge + (type === 'konpeito' ? 8 : 15));
    if (this.feverGauge >= 100 && !this.isFever) {
      this.startFever();
    }

    soundEngine.playCollectItem();

    switch (type) {
      case 'dango':
        this.player.hasDash = true;
        this.player.dashTimer = 360; // 6秒間
        this.player.invincible = true;
        this.player.invincibleTimer = 360;
        soundEngine.playPowerup();
        this.addFloatingText(this.player.worldX, this.player.y - 20, '🍡 団子ダッシュ!!', '#ffc857');
        break;

      case 'daifuku':
        this.lives = Math.min(3, this.lives + 1);
        this.player.hasShield = true;
        soundEngine.playPowerup();
        this.addFloatingText(this.player.worldX, this.player.y - 20, '🍵 お茶の加護 (シールド)', '#67923d');
        break;

      case 'dorayaki':
        this.player.hasDoubleJump = true;
        soundEngine.playPowerup();
        this.addFloatingText(this.player.worldX, this.player.y - 20, '🥮 2段ジャンプ解禁!!', '#ffaa00');
        break;

      case 'sakuramochi':
        this.player.sakuramochiStock = Math.min(6, this.player.sakuramochiStock + 3);
        soundEngine.playPowerup();
        this.addFloatingText(this.player.worldX, this.player.y - 20, '🌸 桜餅シュート+3', '#ff758c');
        break;

      case 'konpeito':
        this.score += 300 * (this.isFever ? 2 : 1);
        this.addFloatingText(this.player.worldX, this.player.y - 20, '+300点!', '#ffebbe');
        break;
    }
  }

  startFever() {
    this.isFever = true;
    this.feverTimer = 480; // 約8秒
    soundEngine.playFeverStart();
    soundEngine.playBGM('fever');
    uiManager.triggerFeverBanner();
  }

  endFever() {
    this.isFever = false;
    this.feverGauge = 0;
    soundEngine.playBGM('game');
  }

  // =========================================================================
  // 被弾ダメージ処理（確実にダメージ＆ノックバック＆ライフ減少）
  // =========================================================================
  takeDamage() {
    if (this.player.invincible) return;

    if (this.player.hasShield) {
      // 抹茶シールドで1回ダメージガード
      this.player.hasShield = false;
      this.player.invincible = true;
      this.player.invincibleTimer = 90;
      soundEngine.playDamage();
      this.addFloatingText(this.player.worldX, this.player.y - 20, '🛡️ シールド破損!', '#67923d');
      return;
    }

    // ライフを1減らす
    this.lives = Math.max(0, this.lives - 1);
    soundEngine.playDamage();
    
    // ノックバック＆被弾状態
    this.player.state = 'hit';
    this.player.vy = -7.5;
    this.player.vx = this.player.facingRight ? -4.5 : 4.5;
    this.player.invincible = true;
    this.player.invincibleTimer = 110; // 約1.8秒間無敵点滅
    this.combo = 0;

    this.addFloatingText(this.player.worldX, this.player.y - 20, '💥 被弾! 痛っ!', '#ff4444');

    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.player.state = 'defeat';
    this.player.vy = -8.5;
    this.player.vx = 0;
    uiManager.showGameOver({
      score: this.score,
      distance: this.distance,
      itemsCollected: this.itemsCollected
    });
  }

  addFloatingText(worldX, y, text, color = '#ffffff') {
    this.effects.push({
      type: 'text',
      worldX: worldX,
      y: y,
      text: text,
      color: color,
      life: 60,
      maxLife: 60
    });
  }

  addEffect(worldX, y, type) {
    this.effects.push({
      type: type,
      worldX: worldX,
      y: y,
      life: 30,
      maxLife: 30
    });
  }

  // =========================================================================
  // メインループ更新 (Update)
  // =========================================================================
  update() {
    if (this.state !== 'PLAYING') {
      // ゲームオーバー中の落下物理
      if (this.state === 'GAMEOVER') {
        this.player.vy += 0.6;
        this.player.y += this.player.vy;
        if (this.player.y >= this.groundY - this.player.height + 25) {
          this.player.y = this.groundY - this.player.height + 25;
          this.player.vy = 0;
        }
      }
      return;
    }

    // プレイヤーの左右入力移動
    let moveDir = 0;
    if (this.keys.left) moveDir -= 1;
    if (this.keys.right) moveDir += 1;

    const currentSpeed = this.player.hasDash ? this.player.baseSpeed * 1.85 : this.player.baseSpeed;

    if (moveDir !== 0) {
      this.player.vx = moveDir * currentSpeed;
      this.player.facingRight = moveDir > 0;
    } else {
      // 摩擦で停止
      this.player.vx *= 0.75;
      if (Math.abs(this.player.vx) < 0.2) this.player.vx = 0;
    }

    // プレイヤー座標更新
    this.player.worldX += this.player.vx;
    // スタート地点より左へは行けない
    if (this.player.worldX < 50) {
      this.player.worldX = 50;
      this.player.vx = 0;
    }

    // 走破距離の更新（最大到達地点に連動）
    const currentDistM = Math.max(0, (this.player.worldX - 120) * 0.1);
    if (currentDistM > this.distance) {
      this.score += Math.floor((currentDistM - this.distance) * 5) * (this.isFever ? 2 : 1);
      this.distance = currentDistM;
    }

    // カメラ位置の更新（主人公の進行に合わせて追従。止まれば背景も止まる）
    const targetCameraX = Math.max(0, this.player.worldX - this.width * 0.32);
    this.cameraX += (targetCameraX - this.cameraX) * 0.14;

    // 前方の街道を先行生成
    this.generateStageAhead(this.cameraX + 1200);

    // 重力・垂直物理
    this.player.vy += 0.68;
    this.player.y += this.player.vy;

    // 地面判定（地形セグメントベース）
    const playerCenterX = this.player.worldX + this.player.width / 2;
    const localGround = this.getGroundYAt(playerCenterX);

    if (localGround === null) {
      // 穴の上: 地面なし → 落下し続ける
      // 画面外まで落下したらダメージ＆復帰
      if (this.player.y > this.baseGroundY + 100) {
        this.takeDamage();
        // 最後に安全だった地面に復帰
        const safeX = this.player.worldX - 150;
        const safeGround = this.getGroundYAt(safeX) || this.baseGroundY;
        this.player.worldX = safeX;
        this.player.y = safeGround - this.player.height - 20;
        this.player.vy = 0;
        this.player.vx = 0;
        this.player.isGrounded = false;
      }
    } else {
      // 通常の地面判定
      if (this.player.y >= localGround - this.player.height) {
        this.player.y = localGround - this.player.height;
        this.player.vy = 0;
        this.player.isGrounded = true;
        this.player.canDoubleJump = this.player.hasDoubleJump;
      }
    }

    // 壁との衝突判定（横方向の当たり判定）
    this.walls.forEach(wall => {
      const pLeft = this.player.worldX + 8;
      const pRight = this.player.worldX + this.player.width - 8;
      const pTop = this.player.y + 10;
      const pBottom = this.player.y + this.player.height;

      if (
        pRight > wall.x &&
        pLeft < wall.x + wall.width &&
        pBottom > wall.y &&
        pTop < wall.y + wall.height
      ) {
        // 上から乗っている場合 → 足場として着地
        if (this.player.vy >= 0 && pBottom <= wall.y + 20) {
          this.player.y = wall.y - this.player.height;
          this.player.vy = 0;
          this.player.isGrounded = true;
          this.player.canDoubleJump = this.player.hasDoubleJump;
        } else {
          // 横からぶつかった → 押し戻す
          if (this.player.vx > 0) {
            this.player.worldX = wall.x - this.player.width + 8;
          } else if (this.player.vx < 0) {
            this.player.worldX = wall.x + wall.width - 8;
          }
          this.player.vx = 0;
        }
      }
    });

    // 足場（プラットフォーム）着地判定
    this.platforms.forEach(plat => {
      if (
        this.player.worldX + this.player.width * 0.8 > plat.x &&
        this.player.worldX + this.player.width * 0.2 < plat.x + plat.width &&
        this.player.y + this.player.height >= plat.y &&
        this.player.y + this.player.height <= plat.y + 20 &&
        this.player.vy >= 0
      ) {
        this.player.y = plat.y - this.player.height;
        this.player.vy = 0;
        this.player.isGrounded = true;
        this.player.canDoubleJump = this.player.hasDoubleJump;
      }
    });

    // プレイヤーのアニメーション状態決定
    if (!this.player.isGrounded) {
      this.player.state = 'jump';
    } else if (Math.abs(this.player.vx) > 0.3) {
      this.player.state = this.player.hasDash ? 'run' : 'walk';
      this.player.animTimer += this.player.hasDash ? 0.32 : 0.20;
    } else {
      // 静止時は Idle（待機モーション）
      this.player.state = 'idle';
      this.player.animTimer += 0.08;
    }

    // タイマー更新
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    if (this.isFever) {
      this.feverTimer--;
      this.feverGauge = (this.feverTimer / 480) * 100;
      if (this.feverTimer <= 0) this.endFever();
    }

    if (this.player.hasDash) {
      this.player.dashTimer--;
      if (this.player.dashTimer <= 0) this.player.hasDash = false;
    }

    if (this.player.invincible) {
      this.player.invincibleTimer--;
      if (this.player.invincibleTimer <= 0) this.player.invincible = false;
    }

    // 大臼（トランポリン）判定
    this.springs.forEach(spring => {
      if (
        this.player.worldX + this.player.width > spring.x &&
        this.player.worldX < spring.x + spring.width &&
        this.player.y + this.player.height >= spring.y &&
        this.player.y + this.player.height <= spring.y + 24 &&
        this.player.vy >= 0
      ) {
        this.player.vy = -19.0; // スーパージャンプ
        this.player.isGrounded = false;
        soundEngine.playSpring();
        this.addEffect(spring.x + spring.width / 2, spring.y, 'sparkle');
      }
    });

    // アイテム判定＆マグネット
    this.items.forEach((item, idx) => {
      // フィーバー時のマグネット効果
      if (this.isFever) {
        const dx = (this.player.worldX + this.player.width / 2) - (item.x + item.width / 2);
        const dy = (this.player.y + this.player.height / 2) - (item.y + item.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 320) {
          item.x += (dx / dist) * 7.5;
          item.y += (dy / dist) * 7.5;
        }
      }

      // 取得判定
      if (
        this.player.worldX + this.player.width > item.x &&
        this.player.worldX < item.x + item.width &&
        this.player.y + this.player.height > item.y &&
        this.player.y < item.y + item.height
      ) {
        this.applyPowerup(item.type);
        this.items.splice(idx, 1);
      }
    });

    // 和菓子シュート（投擲弾）更新
    this.projectiles.forEach((proj, pIdx) => {
      proj.x += proj.vx;
      proj.y += proj.vy;
      proj.vy += 0.14;
      proj.rotation += 0.15;

      this.enemies.forEach((enemy) => {
        if (
          !enemy.isSatisfied &&
          proj.x > enemy.x &&
          proj.x < enemy.x + enemy.width &&
          proj.y > enemy.y &&
          proj.y < enemy.y + enemy.height
        ) {
          enemy.isSatisfied = true;
          enemy.satisfiedTime = Date.now();
          this.score += 500;
          soundEngine.playEnemySatisfied();
          this.projectiles.splice(pIdx, 1);
          this.addFloatingText(enemy.x, enemy.y - 20, '🌸 美味しい！+500点', '#ff69b4');
        }
      });

      if (proj.x > this.cameraX + this.width + 100 || proj.x < this.cameraX - 100 || proj.y > this.height) {
        this.projectiles.splice(pIdx, 1);
      }
    });

    // 敵キャラクター更新＆精密な当たり判定
    this.enemies.forEach((enemy) => {
      // 敵の固有動作
      if (enemy.type === 'tanuki') {
        enemy.x += enemy.vx;
        if (enemy.minX && enemy.maxX) {
          if (enemy.x < enemy.minX || enemy.x > enemy.maxX) {
            enemy.vx = -enemy.vx;
          }
        }
      } else if (enemy.type === 'barrel') {
        enemy.x += enemy.vx;
        enemy.rotation = (enemy.rotation || 0) + 0.14;
      } else if (enemy.type === 'crow') {
        enemy.x += enemy.vx;
        enemy.animPhase = (enemy.animPhase || 0) + 0.05;
        enemy.y = (enemy.baseY || 450) + Math.sin(enemy.animPhase) * 35;
      }

      if (!enemy.isSatisfied) {
        // 矩形交差判定（少しマージンを設けて正確に判定）
        const pLeft = this.player.worldX + 10;
        const pRight = this.player.worldX + this.player.width - 10;
        const pTop = this.player.y + 8;
        const pBottom = this.player.y + this.player.height - 4;

        const eLeft = enemy.x + 8;
        const eRight = enemy.x + enemy.width - 8;
        const eTop = enemy.y + 8;
        const eBottom = enemy.y + enemy.height - 4;

        const isColliding = (pRight > eLeft && pLeft < eRight && pBottom > eTop && pTop < eBottom);

        if (isColliding) {
          // 1. だんごダッシュ中の体当たり突破
          if (this.player.hasDash) {
            enemy.isSatisfied = true;
            enemy.satisfiedTime = Date.now();
            this.score += 400;
            soundEngine.playEnemySatisfied();
            this.addFloatingText(enemy.x, enemy.y - 20, '💥 突進突破! +400点', '#ffc857');
          }
          // 2. 上からの明確な踏みつけ判定（落下中かつ足元が敵の上半分）
          else if (this.player.vy > 1.2 && pBottom <= eTop + (eBottom - eTop) * 0.5) {
            enemy.isSatisfied = true;
            enemy.satisfiedTime = Date.now();
            this.player.vy = -11.0; // バウンド跳躍
            this.score += 350;
            soundEngine.playEnemySatisfied();
            this.addFloatingText(enemy.x, enemy.y - 20, '🌸 ふみふみ! +350点', '#ffdf9e');
          }
          // 3. 通常の接触は確実にプレイヤー被弾！
          else {
            this.takeDamage();
          }
        }
      }
    });

    // ガベージコレクション
    this.platforms = this.platforms.filter(p => p.x > this.cameraX - 400);
    this.items = this.items.filter(i => i.x > this.cameraX - 400);
    this.enemies = this.enemies.filter(e => e.x > this.cameraX - 400 && (!e.isSatisfied || Date.now() - e.satisfiedTime < 800));
    this.springs = this.springs.filter(s => s.x > this.cameraX - 400);
    this.terrainSegments = this.terrainSegments.filter(t => t.x + t.width > this.cameraX - 600);
    this.walls = this.walls.filter(w => w.x > this.cameraX - 400);

    // エフェクト更新
    this.effects.forEach((eff, idx) => {
      eff.life--;
      if (eff.type === 'text') eff.y -= 0.8;
      if (eff.life <= 0) this.effects.splice(idx, 1);
    });

    // HUD更新
    uiManager.updateHUD({
      score: this.score,
      distance: this.distance,
      lives: this.lives,
      combo: this.combo,
      feverGauge: this.feverGauge,
      isFever: this.isFever,
      hasDash: this.player.hasDash,
      dashTimer: this.player.dashTimer,
      hasShield: this.player.hasShield,
      hasDoubleJump: this.player.hasDoubleJump,
      sakuramochiStock: this.player.sakuramochiStock
    });
  }

  // =========================================================================
  // レンダリング (Render)
  // =========================================================================
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. 背景パララックス描画（カメラ位置に応じてスクロール）
    spriteManager.renderBackground(this.ctx, this.cameraX, this.width, this.height, this.isFever);

    // 2. 地形セグメント（地面の高低差）描画
    this.terrainSegments.forEach(seg => {
      if (seg.type === 'gap') return; // 穴は描画しない
      const sX = seg.x - this.cameraX;
      if (sX > this.width + 50 || sX + seg.width < -50) return; // 画面外スキップ

      this.ctx.save();

      if (seg.type === 'slope_up' || seg.type === 'slope_down') {
        // 坂道の描画
        const topLeftY = seg.yFrom;
        const topRightY = seg.yTo;
        // 地面の表面
        this.ctx.fillStyle = '#8B7355';
        this.ctx.beginPath();
        this.ctx.moveTo(sX, topLeftY);
        this.ctx.lineTo(sX + seg.width, topRightY);
        this.ctx.lineTo(sX + seg.width, this.height);
        this.ctx.lineTo(sX, this.height);
        this.ctx.closePath();
        this.ctx.fill();

        // 土の層
        this.ctx.fillStyle = '#6B4E2E';
        this.ctx.beginPath();
        this.ctx.moveTo(sX, topLeftY + 12);
        this.ctx.lineTo(sX + seg.width, topRightY + 12);
        this.ctx.lineTo(sX + seg.width, this.height);
        this.ctx.lineTo(sX, this.height);
        this.ctx.closePath();
        this.ctx.fill();

        // 草の線
        this.ctx.strokeStyle = '#5A7A3A';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(sX, topLeftY);
        this.ctx.lineTo(sX + seg.width, topRightY);
        this.ctx.stroke();
      } else {
        // 平坦・高台・低地の描画
        const topY = seg.y;

        // 地面の表面（土色の層）
        this.ctx.fillStyle = '#8B7355';
        this.ctx.fillRect(sX, topY, seg.width, 12);

        // 土の層
        this.ctx.fillStyle = '#6B4E2E';
        this.ctx.fillRect(sX, topY + 12, seg.width, this.height - topY - 12);

        // 段差がある場合の側面を描画
        if (seg.type === 'raised') {
          this.ctx.fillStyle = '#5A4128';
          this.ctx.fillRect(sX, topY, 3, this.height - topY);
        }

        // 草の線
        this.ctx.strokeStyle = '#5A7A3A';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(sX, topY);
        this.ctx.lineTo(sX + seg.width, topY);
        this.ctx.stroke();

        // 地面の装飾（小石・草のディテール）
        this.ctx.fillStyle = '#A89070';
        for (let dx = 20; dx < seg.width - 10; dx += 60 + Math.sin(seg.x + dx) * 20) {
          const stoneX = sX + dx;
          if (stoneX > -10 && stoneX < this.width + 10) {
            this.ctx.beginPath();
            this.ctx.ellipse(stoneX, topY + 6, 4, 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
      }
      this.ctx.restore();
    });

    // 2b. 壁型障害物（石垣）の描画
    this.walls.forEach(wall => {
      const wX = wall.x - this.cameraX;
      if (wX > this.width + 30 || wX + wall.width < -30) return;

      this.ctx.save();
      // 石垣のベース
      this.ctx.fillStyle = '#7A6C5D';
      this.ctx.fillRect(wX, wall.y, wall.width, wall.height);

      // 石積み模様
      this.ctx.strokeStyle = '#5A4A3A';
      this.ctx.lineWidth = 1;
      const blockH = 14;
      for (let row = 0; row < Math.ceil(wall.height / blockH); row++) {
        const y = wall.y + row * blockH;
        this.ctx.beginPath();
        this.ctx.moveTo(wX, y);
        this.ctx.lineTo(wX + wall.width, y);
        this.ctx.stroke();
        // 互い違いの縦線
        const offset = (row % 2 === 0) ? wall.width * 0.5 : wall.width * 0.3;
        this.ctx.beginPath();
        this.ctx.moveTo(wX + offset, y);
        this.ctx.lineTo(wX + offset, y + blockH);
        this.ctx.stroke();
      }

      // 上端の装飾（瓦風）
      this.ctx.fillStyle = '#4A3F35';
      this.ctx.fillRect(wX - 3, wall.y - 4, wall.width + 6, 6);
      this.ctx.strokeStyle = '#E5A93B';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(wX - 3, wall.y - 4, wall.width + 6, 6);

      this.ctx.restore();
    });

    // 3. 足場（屋根・高台）
    this.platforms.forEach(plat => {
      const pX = plat.x - this.cameraX;
      this.ctx.save();
      this.ctx.fillStyle = '#4a3f35';
      this.ctx.beginPath();
      this.ctx.roundRect(pX, plat.y, plat.width, plat.height, 4);
      this.ctx.fill();
      this.ctx.strokeStyle = '#e5a93b';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.strokeStyle = '#2b231d';
      this.ctx.beginPath();
      this.ctx.moveTo(pX, plat.y + 4);
      this.ctx.lineTo(pX + plat.width, plat.y + 4);
      this.ctx.stroke();
      this.ctx.restore();
    });

    // 4. 大臼（トランポリン）
    this.springs.forEach(s => {
      spriteManager.renderSpring(this.ctx, {
        x: s.x - this.cameraX,
        y: s.y,
        width: s.width,
        height: s.height
      });
    });

    // 5. 和菓子アイテム
    this.items.forEach(item => {
      spriteManager.renderItem(this.ctx, {
        x: item.x - this.cameraX,
        y: item.y,
        width: item.width,
        height: item.height,
        type: item.type
      });
    });

    // 6. 投擲弾
    this.projectiles.forEach(proj => {
      spriteManager.renderProjectile(this.ctx, {
        x: proj.x - this.cameraX,
        y: proj.y,
        size: proj.size,
        rotation: proj.rotation
      });
    });

    // 7. 敵キャラクター
    this.enemies.forEach(enemy => {
      spriteManager.renderEnemy(this.ctx, {
        x: enemy.x - this.cameraX,
        y: enemy.y,
        width: enemy.width,
        height: enemy.height,
        type: enemy.type,
        vx: enemy.vx,
        rotation: enemy.rotation,
        isSatisfied: enemy.isSatisfied,
        satisfiedTime: enemy.satisfiedTime
      });
    });

    // 8. 女将さん（プレイヤー）
    spriteManager.renderPlayer(this.ctx, {
      x: this.player.worldX - this.cameraX,
      y: this.player.y,
      width: this.player.width,
      height: this.player.height,
      state: this.player.state,
      facingRight: this.player.facingRight,
      animTimer: this.player.animTimer,
      invincible: this.player.invincible,
      hasDash: this.player.hasDash,
      hasShield: this.player.hasShield,
      vy: this.player.vy
    });

    // 9. 桜の花びらパーティクル（風になびく速度はプレイヤーの移動速度にも連動）
    const petalSpeed = (this.isFever ? 2.5 : 1.0) + Math.abs(this.player.vx) * 0.15;
    spriteManager.renderPetals(this.ctx, this.width, this.height, petalSpeed);

    // 10. フローティングテキスト
    this.effects.forEach(eff => {
      if (eff.type === 'text') {
        const screenX = eff.worldX - this.cameraX;
        this.ctx.save();
        this.ctx.font = 'bold 15px "Zen Maru Gothic", sans-serif';
        this.ctx.fillStyle = eff.color;
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.textAlign = 'center';
        this.ctx.globalAlpha = eff.life / eff.maxLife;
        this.ctx.strokeText(eff.text, screenX, eff.y);
        this.ctx.fillText(eff.text, screenX, eff.y);
        this.ctx.restore();
      }
    });
  }

  async start() {
    await spriteManager.loadAssets();
    uiManager.showTitle();

    const loop = () => {
      this.update();
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.game = new Game();
window.addEventListener('DOMContentLoaded', () => {
  window.game.start();
});
