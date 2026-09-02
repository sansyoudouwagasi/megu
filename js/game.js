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

    this.gameOverTimer = 0;

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
      y: this.player.y + this.player.height * 0.35,
      vx: this.player.facingRight ? 7.2 : -7.2,
      vy: -7.0,
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
    this.gameOverTimer = 0;

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
        // 穴の向こう側に着地プラットフォーム（静止または左右に揺れる足場）
        const isPlatMoving = Math.random() < 0.45;
        this.platforms.push({
          baseX: this.lastTerrainEndX + gapW,
          x: this.lastTerrainEndX + gapW,
          y: newY,
          width: 120,
          height: 18,
          isMoving: isPlatMoving,
          moveRange: isPlatMoving ? 45 + Math.random() * 25 : 0,
          moveSpeed: 0.03 + Math.random() * 0.015,
          movePhase: Math.random() * Math.PI * 2,
          dx: 0
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

      } else if (roll < 0.72 + difficulty * 0.05) {
        // ===== 大臼スーパージャンプ大峡谷（通常ジャンプ不可の大穴 ＋ 直前に大臼 ＋ 空中和菓子アーチ） =====
        // 手前の助走地面
        const approachW = 150;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: approachW,
          y: prevY,
          type: 'flat'
        });

        // 大穴の直前（縁から約55px手前）に必ず餅つきの大臼（トランポリン）を設置
        const springX = this.lastTerrainEndX + approachW - 55;
        this.springs.push({
          x: springX,
          y: prevY - 36,
          width: 52,
          height: 36
        });
        this.lastTerrainEndX += approachW;

        // 通常ジャンプでは絶対に飛び越えられない巨大な穴（大峡谷: 幅 290px〜340px）
        const giantGapW = 290 + Math.random() * 50;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: giantGapW,
          y: prevY,
          type: 'gap'
        });

        // 大ジャンプの放物線軌道に沿って空中にお宝アーチ（貴重な和菓子＋金平糖）を配置
        const rareWagashiList = ['dango', 'daifuku', 'dorayaki', 'sakuramochi'];
        const numItems = 4;
        for (let i = 0; i < numItems; i++) {
          const t = (i + 1) / (numItems + 1); // 0.2, 0.4, 0.6, 0.8
          const itemX = this.lastTerrainEndX + giantGapW * t - 18;
          // 放物線の美しい弧（頂点: prevY - 210）
          const arcY = prevY - 55 - Math.sin(t * Math.PI) * 165;
          const isRare = (i === 1 || i === 2); // アーチの頂点付近に名物和菓子
          this.items.push({
            x: itemX,
            y: arcY,
            width: isRare ? 38 : 32,
            height: isRare ? 38 : 32,
            type: isRare ? rareWagashiList[Math.floor(Math.random() * rareWagashiList.length)] : 'konpeito'
          });
        }

        this.lastTerrainEndX += giantGapW;

        // 対岸の広い平坦着地帯
        const landingW = 260 + Math.random() * 100;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: landingW,
          y: prevY,
          type: 'flat'
        });
        this.lastTerrainEndX += landingW;

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
  // 街道・ステージの前方生成（歯ごたえある敵配置＆スリリングな街道アクション）
  // =========================================================================
  generateStageAhead(targetX) {
    // まず地形を先行生成
    this.generateTerrainAhead(targetX + 400);

    const rareWagashi = ['dango', 'daifuku', 'dorayaki', 'sakuramochi'];
    const difficulty = Math.min(1.0, this.distance / 1200); // 走行距離に応じた難易度

    while (this.lastGeneratedX < targetX) {
      // テンポよく敵と遭遇できるよう間隔を 220px〜340px に短縮（距離でさらに高密度化）
      const baseDist = Math.max(200, 270 - difficulty * 60);
      const sectionDist = baseDist + Math.random() * 100;
      this.lastGeneratedX += sectionDist;
      const x = this.lastGeneratedX;
      const localGroundY = this.getGroundYAt(x) || this.baseGroundY;
      const pattern = Math.random();

      if (pattern < 0.20) {
        // パターン1: 高台の瓦屋根（動かない足場 or 左右に揺れる動く足場）+ 敵（タヌキ）+ 和菓子
        const platW = 130 + Math.random() * 50;
        const platY = localGroundY - (105 + Math.random() * 45);
        const isMoving = Math.random() < 0.50; // 約50%の確率で左右に揺れる動く足場
        const moveRange = isMoving ? 50 + Math.random() * 30 : 0;
        const plat = {
          baseX: x,
          x: x,
          y: platY,
          width: platW,
          height: 18,
          isMoving: isMoving,
          moveRange: moveRange,
          moveSpeed: 0.03 + Math.random() * 0.015,
          movePhase: Math.random() * Math.PI * 2,
          dx: 0
        };
        this.platforms.push(plat);

        // 屋根の上にたまにパワーアップ和菓子（動く足場の場合は連動）
        if (Math.random() < 0.65) {
          this.items.push({
            x: x + platW / 2 - 18,
            y: platY - 42,
            width: 38,
            height: 38,
            type: rareWagashi[Math.floor(Math.random() * rareWagashi.length)],
            platformRef: isMoving ? plat : null
          });
        }

        // 地上にいたずらタヌキ（地上を巡回）
        const tanukiX = x + platW + 30;
        const tanukiGroundY = this.getGroundYAt(tanukiX + 26);
        if (tanukiGroundY !== null) {
          this.enemies.push({
            x: tanukiX,
            y: tanukiGroundY - 52,
            width: 52,
            height: 52,
            minX: x + platW - 20,
            maxX: x + platW + 150,
            vx: -1.1 - difficulty * 0.3,
            type: 'tanuki',
            isSatisfied: false
          });
        }
      } else if (pattern < 0.44) {
        // パターン2: 転がる酒樽（単発または連続2連樽）+ 金平糖
        const barrelSpeed = -2.8 - difficulty * 0.4;
        const barrelX = x + 60;
        const barrelGroundY = this.getGroundYAt(barrelX + 23) || localGroundY;
        if (barrelGroundY !== null) {
          this.enemies.push({
            x: barrelX,
            y: barrelGroundY - 46,
            width: 46,
            height: 46,
            vx: barrelSpeed,
            type: 'barrel',
            rotation: 0,
            isSatisfied: false
          });
        }

        // 難易度や確率に応じて2連樽！
        if (Math.random() < 0.35 + difficulty * 0.25) {
          const barrel2X = barrelX + 75;
          const barrel2GroundY = this.getGroundYAt(barrel2X + 23) || localGroundY;
          if (barrel2GroundY !== null) {
            this.enemies.push({
              x: barrel2X,
              y: barrel2GroundY - 46,
              width: 46,
              height: 46,
              vx: barrelSpeed,
              type: 'barrel',
              rotation: 0,
              isSatisfied: false
            });
          }
        }

        // 金平糖を配置
        if (Math.random() < 0.6) {
          this.items.push({
            x: x - 10,
            y: localGroundY - 45,
            width: 32,
            height: 32,
            type: 'konpeito'
          });
        }
      } else if (pattern < 0.65) {
        // パターン3: 急降下カラス（単羽または高低2羽編隊）+ 和菓子
        const crowGroundY = this.getGroundYAt(x + 100 + 25) || localGroundY;
        this.enemies.push({
          x: x + 100,
          y: crowGroundY - 165,
          baseY: crowGroundY - 165,
          width: 50,
          height: 44,
          vx: -2.3 - difficulty * 0.4,
          type: 'crow',
          animPhase: Math.random() * Math.PI * 2,
          isSatisfied: false
        });

        // 2羽目のカラス（少し後方・高度違い）
        if (Math.random() < 0.3 + difficulty * 0.25) {
          this.enemies.push({
            x: x + 180,
            y: crowGroundY - 120,
            baseY: crowGroundY - 120,
            width: 50,
            height: 44,
            vx: -2.1 - difficulty * 0.3,
            type: 'crow',
            animPhase: Math.random() * Math.PI * 2 + 1.5,
            isSatisfied: false
          });
        }

        if (Math.random() < 0.5) {
          this.items.push({
            x: x + 30,
            y: localGroundY - 110,
            width: 34,
            height: 34,
            type: Math.random() < 0.35 ? rareWagashi[Math.floor(Math.random() * rareWagashi.length)] : 'konpeito'
          });
        }
      } else if (pattern < 0.82) {
        // パターン4: 塀（石垣）＋ 転がる樽 or タヌキ の複合罠
        const wallH = 65 + Math.random() * 30;
        this.walls.push({
          x: x,
          y: localGroundY - wallH,
          width: 28,
          height: wallH
        });

        // 塀の手前に樽、または奥にタヌキ
        if (Math.random() < 0.5) {
          // 塀の手前で跳ね返る樽
          const barrelX = x + 80;
          const barrelGroundY = this.getGroundYAt(barrelX + 23) || localGroundY;
          if (barrelGroundY !== null) {
            this.enemies.push({
              x: barrelX,
              y: barrelGroundY - 46,
              width: 46,
              height: 46,
              vx: -2.8,
              type: 'barrel',
              rotation: 0,
              isSatisfied: false
            });
          }
        } else {
          // 塀の向こう側にタヌキ
          const tanukiX = x + 60;
          const tanukiGroundY = this.getGroundYAt(tanukiX + 26) || localGroundY;
          if (tanukiGroundY !== null) {
            this.enemies.push({
              x: tanukiX,
              y: tanukiGroundY - 52,
              width: 52,
              height: 52,
              minX: tanukiX - 40,
              maxX: tanukiX + 90,
              vx: -1.1,
              type: 'tanuki',
              isSatisfied: false
            });
          }
        }

        // 塀の上に和菓子
        if (Math.random() < 0.55) {
          this.items.push({
            x: x - 4,
            y: localGroundY - wallH - 42,
            width: 36,
            height: 36,
            type: rareWagashi[Math.floor(Math.random() * rareWagashi.length)]
          });
        }
      } else if (pattern < 0.88) {
        // パターン5: 空中瓦渡り（左右に揺れる動く足場 ＋ 静止足場の連携）+ 高空の和菓子
        const plat1W = 100 + Math.random() * 30;
        const plat1Y = localGroundY - 110;
        const plat1 = {
          baseX: x,
          x: x,
          y: plat1Y,
          width: plat1W,
          height: 18,
          isMoving: true, // 左右に揺れる動く足場
          moveRange: 55,
          moveSpeed: 0.038,
          movePhase: 0,
          dx: 0
        };
        this.platforms.push(plat1);

        const plat2W = 110 + Math.random() * 30;
        const plat2Y = localGroundY - 170;
        const plat2 = {
          baseX: x + 130,
          x: x + 130,
          y: plat2Y,
          width: plat2W,
          height: 18,
          isMoving: false, // 静止した足場
          moveRange: 0,
          moveSpeed: 0,
          movePhase: 0,
          dx: 0
        };
        this.platforms.push(plat2);

        // 2つ目の足場の上に貴重な和菓子
        this.items.push({
          x: x + 130 + plat2W / 2 - 18,
          y: plat2Y - 42,
          width: 38,
          height: 38,
          type: rareWagashi[Math.floor(Math.random() * rareWagashi.length)]
        });

        // 1つ目の動く足場の上に金平糖（足場と同期して揺れる）
        this.items.push({
          x: x + plat1W / 2 - 16,
          y: plat1Y - 40,
          width: 32,
          height: 32,
          type: 'konpeito',
          platformRef: plat1
        });

        // 地上には転がる樽
        const barrelGroundY = this.getGroundYAt(x + 100) || localGroundY;
        this.enemies.push({
          x: x + 100,
          y: barrelGroundY - 46,
          width: 46,
          height: 46,
          vx: -2.6,
          type: 'barrel',
          rotation: 0,
          isSatisfied: false
        });
      } else if (pattern < 0.95) {
        // パターン6: 立体連携（地上樽 ＋ 上空カラスの上下挟み撃ち）
        const barrelGroundY = this.getGroundYAt(x + 50) || localGroundY;
        this.enemies.push({
          x: x + 50,
          y: barrelGroundY - 46,
          width: 46,
          height: 46,
          vx: -2.6,
          type: 'barrel',
          rotation: 0,
          isSatisfied: false
        });

        const crowGroundY = this.getGroundYAt(x + 130) || localGroundY;
        this.enemies.push({
          x: x + 130,
          y: crowGroundY - 170,
          baseY: crowGroundY - 170,
          width: 50,
          height: 44,
          vx: -2.0,
          type: 'crow',
          animPhase: Math.random() * Math.PI * 2,
          isSatisfied: false
        });

        // 金平糖
        this.items.push({
          x: x - 20,
          y: localGroundY - 50,
          width: 32,
          height: 32,
          type: 'konpeito'
        });
      } else {
        // パターン7: 餅つきの大臼（トランポリン） + 高空の貴重な和菓子 + 上空カラス
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

        // 高空にカラスがいて、大ジャンプで踏みつけ撃破できるチャンス！
        if (Math.random() < 0.6) {
          this.enemies.push({
            x: x + 40,
            y: localGroundY - 210,
            baseY: localGroundY - 210,
            width: 50,
            height: 44,
            vx: -1.6,
            type: 'crow',
            animPhase: 0,
            isSatisfied: false
          });
        }
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
    if (this.state === 'GAMEOVER') return;
    this.state = 'GAMEOVER';
    this.gameOverTimer = 0;
    this.player.state = 'defeat';
    this.player.vy = -7.5;
    this.player.vx = this.player.facingRight ? -1.0 : 1.0;
    this.player.invincible = false;
    this.player.hasDash = false;
    this.player.hasShield = false;

    soundEngine.stopBGM();
    soundEngine.playGameOver();

    this.addFloatingText(this.player.worldX + this.player.width / 2, this.player.y - 25, '💤 おやすみ女将さん...', '#ffb7c5');

    for (let i = 0; i < 8; i++) {
      this.addEffect(this.player.worldX + (Math.random() - 0.5) * 50, this.player.y + (Math.random() - 0.5) * 30, 'sparkle');
    }
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
      life: type === 'sleep' ? 50 : 30,
      maxLife: type === 'sleep' ? 50 : 30
    });
  }

  // =========================================================================
  // メインループ更新 (Update)
  // =========================================================================
  update() {
    if (this.state !== 'PLAYING') {
      // ゲームオーバー中の演出更新
      if (this.state === 'GAMEOVER') {
        this.gameOverTimer = (this.gameOverTimer || 0) + 1;

        // 女将さんのダウン物理
        this.player.vy += 0.5;
        this.player.y += this.player.vy;
        this.player.worldX += this.player.vx;
        this.player.vx *= 0.92;

        const groundY = this.getGroundYAt(this.player.worldX + this.player.width / 2) || this.baseGroundY;
        const targetGroundY = groundY - this.player.height + 15;

        if (this.player.y >= targetGroundY) {
          if (this.player.vy > 2.0) {
            // 初回着地時の土煙・きらめき
            for (let i = 0; i < 6; i++) {
              this.addEffect(this.player.worldX + this.player.width / 2 + (Math.random() - 0.5) * 30, groundY - 5, 'sparkle');
            }
          }
          this.player.y = targetGroundY;
          this.player.vy = 0;
          this.player.vx = 0;
        }

        // 定期的に頭上から「💤」がふわふわ浮遊
        if (this.gameOverTimer % 24 === 0 && this.gameOverTimer < 115) {
          this.addEffect(
            this.player.worldX + (this.player.facingRight ? this.player.width * 0.25 : this.player.width * 0.75),
            this.player.y - 8,
            'sleep'
          );
        }

        // エフェクト更新（ゲームオーバー中もアニメーションを維持）
        this.effects.forEach((eff, idx) => {
          eff.life--;
          if (eff.type === 'text' || eff.type === 'sleep' || eff.type === 'sparkle') {
            eff.y -= (eff.type === 'sleep' ? 1.0 : 0.8);
            if (eff.type === 'sleep') {
              eff.worldX += Math.sin(eff.life * 0.15) * 0.6;
            }
          }
          if (eff.life <= 0) this.effects.splice(idx, 1);
        });

        // 演出完了後にリザルト画面表示（約2.3秒 / 140フレーム後）
        if (this.gameOverTimer === 140) {
          uiManager.showGameOver({
            score: this.score,
            distance: this.distance,
            itemsCollected: this.itemsCollected
          });
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

    // プラットフォーム（瓦屋根足場）の更新（動く足場の左右揺動＆乗っているアイテムの同期）
    this.platforms.forEach(plat => {
      if (plat.isMoving) {
        const prevX = plat.x;
        plat.movePhase = (plat.movePhase || 0) + (plat.moveSpeed || 0.035);
        plat.x = plat.baseX + Math.sin(plat.movePhase) * plat.moveRange;
        plat.dx = plat.x - prevX;
      } else {
        plat.dx = 0;
      }
    });

    // 動く足場に乗っているアイテムの同期
    this.items.forEach(item => {
      if (item.platformRef && item.platformRef.dx) {
        item.x += item.platformRef.dx;
      }
    });

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
        // 最後に安全だった地面に復帰
        const safeX = this.player.worldX - 150;
        const safeGround = this.getGroundYAt(safeX) || this.baseGroundY;
        this.player.worldX = safeX;
        this.player.y = safeGround - this.player.height - 20;
        this.player.vy = 0;
        this.player.vx = 0;
        this.player.isGrounded = false;
        this.takeDamage();
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
        // 動く足場に乗っているときはプレイヤーも一緒に左右移動
        if (plat.isMoving && plat.dx) {
          this.player.worldX += plat.dx;
        }
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
        this.player.vy = -20.5; // スーパージャンプ（大峡谷を飛び越える超跳躍）
        this.player.vx = Math.max(this.player.vx, 6.2); // 前進推進力アシスト
        this.player.isGrounded = false;
        this.player.canDoubleJump = this.player.hasDoubleJump;
        soundEngine.playSpring();
        this.addEffect(spring.x + spring.width / 2, spring.y, 'sparkle');
        this.addFloatingText(spring.x + spring.width / 2, spring.y - 25, '✨ 大跳躍！', '#ffd166');
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
    for (let pIdx = this.projectiles.length - 1; pIdx >= 0; pIdx--) {
      const proj = this.projectiles[pIdx];
      proj.x += proj.vx;
      proj.y += proj.vy;
      proj.vy += 0.35; // 弧を描く重力加速度
      proj.rotation += (proj.vx >= 0 ? 1 : -1) * 0.18;

      let hit = false;

      // 敵キャラクターとの当たり判定
      const pRadius = proj.size * 0.4;
      for (let eIdx = 0; eIdx < this.enemies.length; eIdx++) {
        const enemy = this.enemies[eIdx];
        if (
          !enemy.isSatisfied &&
          proj.x + pRadius > enemy.x &&
          proj.x - pRadius < enemy.x + enemy.width &&
          proj.y + pRadius > enemy.y &&
          proj.y - pRadius < enemy.y + enemy.height
        ) {
          enemy.isSatisfied = true;
          enemy.satisfiedTime = Date.now();
          this.score += 500;
          soundEngine.playEnemySatisfied();
          this.addFloatingText(enemy.x, enemy.y - 20, '🌸 美味しい！+500点', '#ff69b4');
          this.addEffect(proj.x, proj.y, 'sparkle');
          hit = true;
          break;
        }
      }

      // 壁との衝突判定
      if (!hit) {
        for (let wIdx = 0; wIdx < this.walls.length; wIdx++) {
          const wall = this.walls[wIdx];
          if (
            proj.x + pRadius > wall.x &&
            proj.x - pRadius < wall.x + wall.width &&
            proj.y + pRadius > wall.y &&
            proj.y - pRadius < wall.y + wall.height
          ) {
            this.addEffect(proj.x, proj.y, 'sparkle');
            hit = true;
            break;
          }
        }
      }

      // 地面への着地判定
      if (!hit && proj.vy > 0) {
        const groundY = this.getGroundYAt(proj.x);
        if (groundY !== null && proj.y + pRadius >= groundY) {
          this.addEffect(proj.x, groundY - 5, 'sparkle');
          hit = true;
        }
      }

      // 画面外または衝突による削除
      if (hit || proj.x > this.cameraX + this.width + 150 || proj.x < this.cameraX - 150 || proj.y > this.height + 50) {
        this.projectiles.splice(pIdx, 1);
      }
    }

    // 敵キャラクター更新＆精密な当たり判定
    this.enemies.forEach((enemy) => {
      // 満足（浄化済み）の場合は退場アニメーション中なので通常移動・接地物理はスキップ
      if (enemy.isSatisfied) return;

      // 画面の視界近く（カメラ右端+140px以内）に入るまでは待機（画面外での先行逃亡・反転を防止）
      if (!enemy.activated) {
        if (enemy.x <= this.cameraX + this.width + 140) {
          enemy.activated = true;
        } else {
          // 画面外待機中は地面の高さのみ同期してスタンバイ
          const groundY = this.getGroundYAt(enemy.x + enemy.width / 2);
          if (groundY !== null && enemy.type !== 'crow') {
            enemy.y = groundY - enemy.height;
          }
          return;
        }
      }

      // 敵の固有動作と地形・高低差追従
      if (enemy.type === 'tanuki') {
        const nextX = enemy.x + enemy.vx;
        const frontX = nextX + (enemy.vx > 0 ? enemy.width + 10 : -10);
        const centerNextX = nextX + enemy.width / 2;
        const frontGroundY = this.getGroundYAt(frontX);
        const nextGroundY = this.getGroundYAt(centerNextX);
        const currentGroundY = this.getGroundYAt(enemy.x + enemy.width / 2);

        // パトロール反転条件:
        let shouldTurn = false;

        // 1. 指定された巡回範囲外
        if (enemy.minX && enemy.maxX) {
          if (nextX < enemy.minX || nextX > enemy.maxX) {
            shouldTurn = true;
          }
        }
        // 2. 前方が穴（崖）の場合、落ちないように反転（すでに穴に落ちている場合を除く）
        if (currentGroundY !== null && (frontGroundY === null || nextGroundY === null)) {
          shouldTurn = true;
        }
        // 3. 前方に高すぎる段差（登れない崖）がある場合反転
        if (frontGroundY !== null && currentGroundY !== null && (currentGroundY - frontGroundY > 40)) {
          shouldTurn = true;
        }
        // 4. 壁（石垣）に衝突した場合反転
        this.walls.forEach(wall => {
          if (
            nextX + enemy.width > wall.x &&
            nextX < wall.x + wall.width &&
            enemy.y + enemy.height > wall.y &&
            enemy.y < wall.y + wall.height
          ) {
            shouldTurn = true;
          }
        });

        if (shouldTurn) {
          enemy.vx = -enemy.vx;
          enemy.x += enemy.vx;
        } else {
          enemy.x = nextX;
        }

        // 接地・高度更新
        const finalGroundY = this.getGroundYAt(enemy.x + enemy.width / 2);
        if (finalGroundY !== null) {
          enemy.y = finalGroundY - enemy.height;
          enemy.vy = 0;
        } else {
          // 足元が穴の場合は落下
          enemy.vy = (enemy.vy || 0) + 0.6;
          enemy.y += enemy.vy;
        }

      } else if (enemy.type === 'barrel') {
        const nextX = enemy.x + enemy.vx;
        let hitWall = false;

        // 1. 壁（塀・石垣）との衝突判定
        this.walls.forEach(wall => {
          if (
            nextX + enemy.width > wall.x &&
            nextX < wall.x + wall.width &&
            enemy.y + enemy.height > wall.y &&
            enemy.y < wall.y + wall.height
          ) {
            hitWall = true;
            if (enemy.vx < 0) {
              enemy.x = wall.x + wall.width;
            } else if (enemy.vx > 0) {
              enemy.x = wall.x - enemy.width;
            }
          }
        });

        // 2. 前方に登れない急な段差（崖）がある場合も反転
        const frontX = nextX + (enemy.vx > 0 ? enemy.width + 5 : -5);
        const frontGroundY = this.getGroundYAt(frontX);
        const currentGroundY = this.getGroundYAt(enemy.x + enemy.width / 2);
        if (frontGroundY !== null && currentGroundY !== null && (currentGroundY - frontGroundY > 35)) {
          hitWall = true;
        }

        if (hitWall) {
          enemy.vx = -enemy.vx;
          enemy.x += enemy.vx;
        } else {
          enemy.x = nextX;
        }

        const centerX = enemy.x + enemy.width / 2;
        const groundY = this.getGroundYAt(centerX);

        if (groundY !== null) {
          // 地面に接地して転がる
          enemy.y = groundY - enemy.height;
          enemy.vy = 0;
          // 移動速度に同期した自然な回転（向きに合わせて時計回り/反時計回り）
          enemy.rotation = (enemy.rotation || 0) + (enemy.vx / (enemy.width / 2));
        } else {
          // 穴の上に来たら重力で落下！
          enemy.vy = (enemy.vy || 0) + 0.65;
          enemy.y += enemy.vy;
          enemy.rotation = (enemy.rotation || 0) + (enemy.vx >= 0 ? 0.15 : -0.15);
        }

      } else if (enemy.type === 'crow') {
        enemy.x += enemy.vx;
        const centerX = enemy.x + enemy.width / 2;
        const currentGroundY = this.getGroundYAt(centerX) || this.baseGroundY;

        // カラスの基準飛行高度をコースの起伏（高台や谷）に合わせてスムーズに追従
        const targetBaseY = currentGroundY - 170;
        if (enemy.baseY === undefined) {
          enemy.baseY = targetBaseY;
        } else {
          enemy.baseY += (targetBaseY - enemy.baseY) * 0.08;
        }

        enemy.animPhase = (enemy.animPhase || 0) + 0.05;
        enemy.y = enemy.baseY + Math.sin(enemy.animPhase) * 35;
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
    this.enemies = this.enemies.filter(e => e.x > this.cameraX - 400 && e.x < this.cameraX + this.width + 1200 && e.y < this.height + 150 && (!e.isSatisfied || Date.now() - e.satisfiedTime < 800));
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
      if (pX > this.width + 100 || pX + plat.width < -100) return;
      spriteManager.renderPlatform(this.ctx, {
        x: pX,
        y: plat.y,
        width: plat.width,
        height: plat.height,
        isMoving: plat.isMoving,
        movePhase: plat.movePhase,
        baseX: (plat.baseX !== undefined ? plat.baseX : plat.x) - this.cameraX
      });
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

    // 10. フローティングテキスト＆エフェクト
    this.effects.forEach(eff => {
      const screenX = eff.worldX - this.cameraX;
      if (eff.type === 'text') {
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
      } else if (eff.type === 'sleep') {
        this.ctx.save();
        this.ctx.font = 'bold 20px "Zen Maru Gothic", sans-serif';
        this.ctx.fillStyle = '#bde0fe';
        this.ctx.strokeStyle = '#1d3557';
        this.ctx.lineWidth = 2.5;
        this.ctx.textAlign = 'center';
        this.ctx.globalAlpha = Math.sin((eff.life / eff.maxLife) * Math.PI);
        this.ctx.strokeText('💤', screenX, eff.y);
        this.ctx.fillText('💤', screenX, eff.y);
        this.ctx.restore();
      } else if (eff.type === 'sparkle') {
        this.ctx.save();
        this.ctx.fillStyle = '#ffd166';
        this.ctx.globalAlpha = eff.life / eff.maxLife;
        this.ctx.beginPath();
        this.ctx.arc(screenX, eff.y, (1 - eff.life / eff.maxLife) * 6 + 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    });

    // 11. ゲームオーバー演出オーバーレイ（周辺減光＆おやすみテロップ）
    if (this.state === 'GAMEOVER') {
      const progress = Math.min(1, (this.gameOverTimer || 0) / 45);
      
      this.ctx.save();
      // 周辺減光（ヴィネット暗転）
      const pScreenX = this.player.worldX - this.cameraX + this.player.width / 2;
      const pScreenY = this.player.y + this.player.height / 2;
      const grad = this.ctx.createRadialGradient(
        pScreenX, pScreenY, 30,
        pScreenX, pScreenY, Math.max(this.width, this.height) * 0.8
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
      grad.addColorStop(0.45, `rgba(20, 10, 30, ${0.45 * progress})`);
      grad.addColorStop(1, `rgba(10, 5, 15, ${0.75 * progress})`);
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.width, this.height);

      // 女将さんの真上にスポットライト風の柔らかな光
      if (progress > 0.3) {
        const spotAlpha = (progress - 0.3) * 0.4;
        const spotGrad = this.ctx.createRadialGradient(pScreenX, pScreenY, 5, pScreenX, pScreenY, 80);
        spotGrad.addColorStop(0, `rgba(255, 245, 200, ${spotAlpha})`);
        spotGrad.addColorStop(1, 'rgba(255, 245, 200, 0)');
        this.ctx.fillStyle = spotGrad;
        this.ctx.beginPath();
        this.ctx.arc(pScreenX, pScreenY, 80, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // 「無念...！」和風テロップ
      if (this.gameOverTimer > 25) {
        const textAlpha = Math.min(1, (this.gameOverTimer - 25) / 25);
        this.ctx.globalAlpha = textAlpha;
        this.ctx.font = '900 28px "Noto Serif JP", serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#ffdf9e';
        this.ctx.strokeStyle = '#2b1d0c';
        this.ctx.lineWidth = 6;
        this.ctx.strokeText('無念... おやすみ女将さん', this.width / 2, 220);
        this.ctx.fillText('無念... おやすみ女将さん', this.width / 2, 220);

        this.ctx.font = 'bold 15px "Zen Maru Gothic", sans-serif';
        this.ctx.fillStyle = '#ffccd5';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.strokeText('🌸 街道の旅は一休み 🌸', this.width / 2, 255);
        this.ctx.fillText('🌸 街道の旅は一休み 🌸', this.width / 2, 255);
      }
      this.ctx.restore();
    }
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
