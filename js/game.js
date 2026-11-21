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
    this.lastStationIndex = 0;
    this.stompCombo = 0;

    // 演出・手触りタイマー
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeMagnitude = 0;

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
      coyoteTimer: 0,      // 崖踏み出し猶予フレーム
      jumpBufferTimer: 0,  // ジャンプ先行入力フレーム
      springBoostTimer: 0, // 大臼ジャンプ後の前進ブースト維持フレーム
      knockbackTimer: 0,   // 被弾ノックバック演出フレーム
      lastSafeX: 120,      // 穴落下時の安全な復帰X座標
      lastSafeY: 575,      // 穴落下時の安全な復帰Y座標
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
      floatTimer: 0,       // どら焼き重複取得時のふわふわ滞空タイマー
      sakuramochiStock: 3
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
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        this.keys.jump = false;
        this.handleJumpRelease();
      }
      if (e.code === 'KeyZ' || e.code === 'KeyJ' || e.code === 'Enter') this.keys.shoot = false;
    });

    // オンスクリーンボタン
    const bindBtn = (id, keyName, triggerAction = null, releaseAction = null) => {
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
        if (releaseAction) releaseAction();
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
    bindBtn('btn-jump', 'jump', () => this.handleJump(), () => this.handleJumpRelease());
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

    if (this.player.isGrounded || this.player.coyoteTimer > 0) {
      this.player.vy = -14.6;
      this.player.isGrounded = false;
      this.player.coyoteTimer = 0;
      this.player.jumpBufferTimer = 0;
      this.player.canDoubleJump = this.player.hasDoubleJump;
      soundEngine.playJump();
    } else if (this.player.canDoubleJump) {
      this.player.vy = -13.6;
      this.player.canDoubleJump = false;
      this.player.jumpBufferTimer = 0;
      soundEngine.playDoubleJump();
      this.addEffect(this.player.worldX + this.player.width / 2, this.player.y + this.player.height, 'sparkle');
    } else {
      // 着地直前のジャンプ先行入力を記憶（8フレーム）
      this.player.jumpBufferTimer = 8;
    }
  }

  // 可変ジャンプ高さ（ジャンプボタンを早めに離すと小ジャンプになる）
  handleJumpRelease() {
    if (this.state !== 'PLAYING') return;
    if (this.player.vy < -5.5 && this.player.springBoostTimer <= 0) {
      this.player.vy *= 0.58;
    }
  }

  handleShoot() {
    if (this.state !== 'PLAYING') return;
    if (this.player.sakuramochiStock <= 0) return;

    this.player.sakuramochiStock--;
    soundEngine.playShoot();

    this.projectiles.push({
      x: this.player.worldX + (this.player.facingRight ? this.player.width : -10),
      y: this.player.y + this.player.height * 0.32,
      vx: this.player.facingRight ? 8.2 : -8.2,
      vy: -5.8,
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
    this.lastStationIndex = 0;
    this.stompCombo = 0;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeMagnitude = 0;

    // プレイヤー初期化
    this.player.worldX = 120;
    this.player.y = this.baseGroundY - this.player.height;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.isGrounded = true;
    this.player.canDoubleJump = false;
    this.player.coyoteTimer = 0;
    this.player.jumpBufferTimer = 0;
    this.player.springBoostTimer = 0;
    this.player.knockbackTimer = 0;
    this.player.lastSafeX = 120;
    this.player.lastSafeY = this.baseGroundY - this.player.height;
    this.player.state = 'idle';
    this.player.facingRight = true;
    this.player.animTimer = 0;
    this.player.invincible = false;
    this.player.invincibleTimer = 0;
    this.player.hasDash = false;
    this.player.dashTimer = 0;
    this.player.hasShield = false;
    this.player.hasDoubleJump = false;
    this.player.floatTimer = 0;
    this.player.sakuramochiStock = 3;
    this.gameOverTimer = 0;

    this.cameraX = 0;
    this.lastGeneratedX = 400;
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

    // 初期の平坦な地面セグメント（スタート直後は気持ちよく和菓子集めの導入）
    this.terrainSegments.push({
      x: 0,
      width: 720,
      y: this.baseGroundY,
      type: 'flat'
    });
    this.lastTerrainEndX = 720;
    this.currentTerrainY = this.baseGroundY;

    // スタート直後のウェルカム金平糖アーチ（最初の1歩を楽しく！）
    this.spawnKonpeitoArc(250, 410, this.baseGroundY - 45, 75, 4);

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
  // バランス＆配置ヘルパー（理不尽配置の防止・金平糖アーチ・動的レア選出）
  // =========================================================================
  isGroundSolidRange(startX, endX) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (let px = startX; px <= endX; px += 24) {
      const gy = this.getGroundYAt(px);
      if (gy === null) return false;
      if (gy < minY) minY = gy;
      if (gy > maxY) maxY = gy;
    }
    const endGy = this.getGroundYAt(endX);
    if (endGy === null) return false;
    if (endGy < minY) minY = endGy;
    if (endGy > maxY) maxY = endGy;
    return (maxY - minY) <= 55;
  }

  hasObstacleNear(x, margin = 90) {
    for (let i = 0; i < this.springs.length; i++) {
      if (Math.abs(this.springs[i].x - x) < margin) return true;
    }
    for (let i = 0; i < this.walls.length; i++) {
      if (Math.abs(this.walls[i].x - x) < margin) return true;
    }
    return false;
  }

  // レア和菓子の動的選出（体力1のピンチ時は抹茶大福が出やすい！）
  pickRareWagashi() {
    if (this.lives === 1 && !this.player.hasShield && Math.random() < 0.45) {
      return 'daifuku';
    }
    if (this.player.sakuramochiStock === 0 && Math.random() < 0.35) {
      return 'sakuramochi';
    }
    const rareWagashi = ['dango', 'daifuku', 'dorayaki', 'sakuramochi'];
    return rareWagashi[Math.floor(Math.random() * rareWagashi.length)];
  }

  // 美しい放物線アーチ状に金平糖を配置（ジャンプ軌道の自然なガイド）
  spawnKonpeitoArc(startX, endX, baseY, peakHeight, count = 3) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const ix = startX + (endX - startX) * t;
      const iy = baseY - Math.sin(t * Math.PI) * peakHeight;
      this.items.push({
        x: ix - 16,
        y: iy - 16,
        width: 32,
        height: 32,
        type: 'konpeito'
      });
    }
  }

  getComboMultiplier() {
    return 1 + Math.min(1.5, Math.floor(this.combo / 5) * 0.25);
  }

  triggerScreenShake(frames, magnitude) {
    if (magnitude >= this.shakeMagnitude || this.shakeTimer <= 0) {
      this.shakeTimer = Math.max(this.shakeTimer, frames);
      this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    }
  }

  // =========================================================================
  // 地形の前方生成（段階的に変化する高低差＆爽快な大峡谷）
  // =========================================================================
  generateTerrainAhead(targetX) {
    while (this.lastTerrainEndX < targetX) {
      const roll = Math.random();
      const prevY = this.currentTerrainY;
      // 距離に応じて緩やかに難易度UP（序盤は気持ちよく慣れる設計）
      const difficulty = Math.min(1.0, this.distance / 1200);
      const isEarly = this.distance < 150;

      if (roll < 0.11 + difficulty * 0.06) {
        // ===== 穴（ギャップ）: ジャンプで飛び越える + 金平糖ガイドアーチ =====
        const gapWidth = 75 + Math.random() * 45 + difficulty * 35; // 最大約155px（通常ジャンプで余裕＋スリル）
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: gapWidth,
          y: prevY,
          type: 'gap'
        });
        // 穴の上に金平糖3個の放物線ガイドを配置
        this.spawnKonpeitoArc(
          this.lastTerrainEndX + 10,
          this.lastTerrainEndX + gapWidth - 10,
          prevY - 58,
          62,
          3
        );
        this.lastTerrainEndX += gapWidth;
        // 穴の先は安全な平坦着地帯
        const landingW = 240 + Math.random() * 140;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: landingW,
          y: prevY,
          type: 'flat'
        });
        this.lastTerrainEndX += landingW;

      } else if (roll < 0.24 + difficulty * 0.05) {
        // ===== 上り坂 → 高台 =====
        const riseAmount = 45 + Math.random() * 55;
        const slopeW = 130 + Math.random() * 70;
        const newY = Math.max(495, prevY - riseAmount);
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: slopeW,
          yFrom: prevY,
          yTo: newY,
          y: newY,
          type: 'slope_up'
        });
        this.lastTerrainEndX += slopeW;
        const flatW = 260 + Math.random() * 180;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: flatW,
          y: newY,
          type: 'raised'
        });
        this.lastTerrainEndX += flatW;
        this.currentTerrainY = newY;

      } else if (roll < 0.36 + difficulty * 0.04) {
        // ===== 下り坂 → 谷 =====
        const dropAmount = 40 + Math.random() * 50;
        const slopeW = 110 + Math.random() * 70;
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
        const flatW = 220 + Math.random() * 150;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: flatW,
          y: newY,
          type: 'lowered'
        });
        this.lastTerrainEndX += flatW;
        this.currentTerrainY = newY;

      } else if (roll < 0.45 + difficulty * 0.04) {
        // ===== 階段状の段差（3段の上り階段＋金平糖） =====
        const stepW = 95;
        const stepH = 34;
        let stepY = prevY;
        for (let s = 0; s < 3; s++) {
          stepY = Math.max(490, stepY - stepH);
          this.terrainSegments.push({
            x: this.lastTerrainEndX,
            width: stepW,
            y: stepY,
            type: 'raised'
          });
          // 各段に金平糖をテンポよく配置
          this.items.push({
            x: this.lastTerrainEndX + stepW / 2 - 16,
            y: stepY - 46,
            width: 32,
            height: 32,
            type: 'konpeito'
          });
          this.lastTerrainEndX += stepW;
        }
        const topW = 200 + Math.random() * 120;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: topW,
          y: stepY,
          type: 'raised'
        });
        this.lastTerrainEndX += topW;
        this.currentTerrainY = stepY;

      } else if (!isEarly && roll < 0.53 + difficulty * 0.04) {
        // ===== 地面に石垣の壁（ジャンプで越える + 上に金平糖アーチ） =====
        const wallH = 58 + Math.random() * 34;
        const wallX = this.lastTerrainEndX + 80;
        this.walls.push({
          x: wallX,
          y: prevY - wallH,
          width: 30,
          height: wallH
        });
        this.spawnKonpeitoArc(wallX - 45, wallX + 75, prevY - wallH - 35, 36, 3);
        const segW = 360 + Math.random() * 180;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: segW,
          y: prevY,
          type: 'flat'
        });
        this.lastTerrainEndX += segW;

      } else if (!isEarly && roll < 0.61 + difficulty * 0.04) {
        // ===== 高台→穴→瓦足場→安全着地（浮島アクション） =====
        const riseH = 55 + Math.random() * 35;
        const newY = Math.max(510, prevY - riseH);
        const slopeW = 85;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: slopeW,
          yFrom: prevY,
          yTo: newY,
          y: newY,
          type: 'slope_up'
        });
        this.lastTerrainEndX += slopeW;

        const platW = 135 + Math.random() * 65;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: platW,
          y: newY,
          type: 'raised'
        });
        this.lastTerrainEndX += platW;

        // 浮島を挟む穴（幅を適正化し、中央の瓦足場から確実に着地できる構造へ）
        const totalGapW = 240;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: totalGapW,
          y: newY,
          type: 'gap'
        });
        const isPlatMoving = Math.random() < 0.40 + difficulty * 0.2;
        const floatPlat = {
          baseX: this.lastTerrainEndX + 58,
          x: this.lastTerrainEndX + 58,
          y: newY,
          width: 124,
          height: 18,
          isMoving: isPlatMoving,
          moveRange: isPlatMoving ? 32 : 0,
          moveSpeed: 0.028 + Math.random() * 0.012,
          movePhase: Math.random() * Math.PI * 2,
          dx: 0
        };
        this.platforms.push(floatPlat);
        this.items.push({
          x: floatPlat.x + floatPlat.width / 2 - 18,
          y: newY - 46,
          width: 38,
          height: 38,
          type: this.pickRareWagashi(),
          platformRef: isPlatMoving ? floatPlat : null
        });
        this.lastTerrainEndX += totalGapW;

        // 対岸の着地台→緩やかな下り坂で基準へ戻る
        const landW = 120;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: landW,
          y: newY,
          type: 'raised'
        });
        this.lastTerrainEndX += landW;

        const downW = 90;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: downW,
          yFrom: newY,
          yTo: this.baseGroundY,
          y: this.baseGroundY,
          type: 'slope_down'
        });
        this.lastTerrainEndX += downW;
        this.currentTerrainY = this.baseGroundY;

      } else if (!isEarly && roll < 0.74 + difficulty * 0.04) {
        // ===== 大臼スーパージャンプ大峡谷（爽快大ジャンプ＋空中お宝アーチ） =====
        const approachW = 165;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: approachW,
          y: prevY,
          type: 'flat'
        });

        // 大穴の直前（縁から52px手前）に必ず餅つきの大臼を設置
        const springX = this.lastTerrainEndX + approachW - 56;
        this.springs.push({
          x: springX,
          y: prevY - 36,
          width: 56,
          height: 36
        });
        this.lastTerrainEndX += approachW;

        // 大臼ブーストで気持ちよく確実に超えられる大峡谷（幅 255px〜300px）
        const giantGapW = 255 + Math.random() * 45;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: giantGapW,
          y: prevY,
          type: 'gap'
        });

        // 大ジャンプの放物線軌道に沿ってお宝アーチ（5個）を配置
        const numItems = 5;
        for (let i = 0; i < numItems; i++) {
          const t = (i + 1) / (numItems + 1);
          const itemX = this.lastTerrainEndX + giantGapW * t - 18;
          const arcY = prevY - 60 - Math.sin(t * Math.PI) * 175;
          const isRare = (i === 2); // アーチの頂点に名物和菓子！
          this.items.push({
            x: itemX,
            y: arcY,
            width: isRare ? 38 : 32,
            height: isRare ? 38 : 32,
            type: isRare ? this.pickRareWagashi() : 'konpeito'
          });
        }

        this.lastTerrainEndX += giantGapW;

        // 対岸の広い平坦着地帯
        const landingW = 280 + Math.random() * 100;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: landingW,
          y: prevY,
          type: 'flat'
        });
        this.lastTerrainEndX += landingW;

      } else {
        // ===== 通常の平坦地面（高すぎたら下り坂で基準Yへ緩やかに戻る） =====
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
        const flatW = 300 + Math.random() * 220;
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
  // 街道・ステージの前方生成（緩急のあるリズム・安全配置・ドキドキ感）
  // =========================================================================
  generateStageAhead(targetX) {
    // まず地形を先行生成
    this.generateTerrainAhead(targetX + 450);

    const difficulty = Math.min(1.0, this.distance / 1500); // 緩やかな難易度上昇カーブ
    const isMidOrLater = this.distance >= 260; // 品川宿手前から中盤ギミック解禁

    while (this.lastGeneratedX < targetX) {
      // 序盤はゆったり(300〜390px)、進むほどテンポアップ(225〜310px)
      const baseDist = Math.max(225, 305 - difficulty * 80);
      const sectionDist = baseDist + Math.random() * 90;
      this.lastGeneratedX += sectionDist;
      const x = this.lastGeneratedX;
      const rawGroundY = this.getGroundYAt(x);

      // 穴の上や既存の大臼・壁のすぐ近くは地上ギミックを置かない（理不尽配置の防止！）
      if (rawGroundY === null || this.hasObstacleNear(x, 115)) {
        continue;
      }

      const localGroundY = rawGroundY;
      const pattern = Math.random();

      if (pattern < 0.22) {
        // パターン1: 瓦屋根足場（静止 or 動く足場）+ 名物和菓子 + 地上タヌキ
        const platW = 135 + Math.random() * 45;
        const platY = localGroundY - (100 + Math.random() * 38);
        const isMoving = isMidOrLater && Math.random() < 0.42;
        const moveRange = isMoving ? 42 + Math.random() * 24 : 0;
        const plat = {
          baseX: x,
          x: x,
          y: platY,
          width: platW,
          height: 18,
          isMoving: isMoving,
          moveRange: moveRange,
          moveSpeed: 0.028 + Math.random() * 0.012,
          movePhase: Math.random() * Math.PI * 2,
          dx: 0
        };
        this.platforms.push(plat);

        // 屋根の上に名物和菓子＋両脇に金平糖
        if (Math.random() < 0.78) {
          this.items.push({
            x: x + platW / 2 - 19,
            y: platY - 44,
            width: 38,
            height: 38,
            type: this.pickRareWagashi(),
            platformRef: isMoving ? plat : null
          });
        } else {
          this.spawnKonpeitoArc(x + 18, x + platW - 18, platY - 36, 26, 3);
        }

        // 地上の安全な場所にいたずらタヌキを配置
        const tanukiX = x + platW + 24;
        if (this.isGroundSolidRange(tanukiX - 10, tanukiX + 70) && !this.hasObstacleNear(tanukiX, 70)) {
          const tanukiGroundY = this.getGroundYAt(tanukiX + 26);
          if (tanukiGroundY !== null) {
            this.enemies.push({
              x: tanukiX,
              y: tanukiGroundY - 52,
              width: 52,
              height: 52,
              minX: tanukiX - 45,
              maxX: tanukiX + 115,
              vx: -1.0 - difficulty * 0.35,
              hopOffsetY: 0,
              hopVy: 0,
              hopCooldown: 60 + Math.floor(Math.random() * 60),
              type: 'tanuki',
              isSatisfied: false,
              nearMissAwarded: false
            });
          }
        }
      } else if (pattern < 0.42) {
        // パターン2: 転がる酒樽（単発 or 中盤以降はテンポ良い2連樽）+ 飛び越え金平糖アーチ
        const barrelSpeed = -2.2 - difficulty * 0.85;
        const barrelX = x + 40;
        if (this.isGroundSolidRange(barrelX - 20, barrelX + 120)) {
          const barrelGroundY = this.getGroundYAt(barrelX + 23);
          if (barrelGroundY !== null) {
            this.enemies.push({
              x: barrelX,
              y: barrelGroundY - 46,
              width: 46,
              height: 46,
              vx: barrelSpeed,
              type: 'barrel',
              rotation: 0,
              isSatisfied: false,
              nearMissAwarded: false
            });
          }

          // 中盤以降、リズムよく2連樽（間隔を十分空けてジャンプ着地→再ジャンプが気持ちよく決まる距離）
          if (isMidOrLater && Math.random() < 0.25 + difficulty * 0.25) {
            const barrel2X = barrelX + 105;
            const barrel2GroundY = this.getGroundYAt(barrel2X + 23);
            if (barrel2GroundY !== null) {
              this.enemies.push({
                x: barrel2X,
                y: barrel2GroundY - 46,
                width: 46,
                height: 46,
                vx: barrelSpeed,
                type: 'barrel',
                rotation: 0,
                isSatisfied: false,
                nearMissAwarded: false
              });
            }
          }

          // 樽を飛び越える軌道に金平糖アーチ
          this.spawnKonpeitoArc(x - 10, x + 90, localGroundY - 58, 52, 3);
        }
      } else if (pattern < 0.60) {
        // パターン3: 急降下カラス（単羽 or 中盤以降は高低2羽）+ 空中和菓子
        const crowX = x + 90;
        const crowGroundY = this.getGroundYAt(crowX + 25) || localGroundY;
        this.enemies.push({
          x: crowX,
          y: crowGroundY - 155,
          baseY: crowGroundY - 155,
          width: 50,
          height: 44,
          vx: -1.9 - difficulty * 0.55,
          type: 'crow',
          animPhase: Math.random() * Math.PI * 2,
          isSatisfied: false,
          nearMissAwarded: false
        });

        // 2羽目のカラス（中盤以降、避けやすい間隔と高度差で配置）
        if (isMidOrLater && Math.random() < 0.22 + difficulty * 0.25) {
          this.enemies.push({
            x: crowX + 125,
            y: crowGroundY - 110,
            baseY: crowGroundY - 110,
            width: 50,
            height: 44,
            vx: -1.8 - difficulty * 0.45,
            type: 'crow',
            animPhase: Math.random() * Math.PI * 2 + 1.8,
            isSatisfied: false,
            nearMissAwarded: false
          });
        }

        // カラスの少し手前に和菓子
        this.items.push({
          x: x + 25,
          y: localGroundY - 115,
          width: 36,
          height: 36,
          type: Math.random() < 0.45 ? this.pickRareWagashi() : 'konpeito'
        });
      } else if (pattern < 0.74) {
        // パターン4: 石垣の塀 + 敵（安全チェック付き）+ 塀の上にご褒美和菓子
        if (this.isGroundSolidRange(x - 30, x + 130)) {
          const wallH = 62 + Math.random() * 28;
          this.walls.push({
            x: x,
            y: localGroundY - wallH,
            width: 28,
            height: wallH
          });

          // 塀の向こう側にタヌキまたは転がる樽
          if (Math.random() < 0.55) {
            const tanukiX = x + 65;
            const tanukiGroundY = this.getGroundYAt(tanukiX + 26);
            if (tanukiGroundY !== null) {
              this.enemies.push({
                x: tanukiX,
                y: tanukiGroundY - 52,
                width: 52,
                height: 52,
                minX: x + 36,
                maxX: tanukiX + 95,
                vx: -1.0 - difficulty * 0.25,
                hopOffsetY: 0,
                hopVy: 0,
                hopCooldown: 70 + Math.floor(Math.random() * 50),
                type: 'tanuki',
                isSatisfied: false,
                nearMissAwarded: false
              });
            }
          } else {
            const barrelX = x + 95;
            const barrelGroundY = this.getGroundYAt(barrelX + 23);
            if (barrelGroundY !== null) {
              this.enemies.push({
                x: barrelX,
                y: barrelGroundY - 46,
                width: 46,
                height: 46,
                vx: -2.3 - difficulty * 0.5,
                type: 'barrel',
                rotation: 0,
                isSatisfied: false,
                nearMissAwarded: false
              });
            }
          }

          // 塀の上に名物和菓子
          this.items.push({
            x: x - 5,
            y: localGroundY - wallH - 44,
            width: 38,
            height: 38,
            type: this.pickRareWagashi()
          });
        }
      } else if (pattern < 0.83) {
        // パターン5: 空中瓦渡り（2段の瓦屋根でお宝ルート）
        const plat1W = 110 + Math.random() * 25;
        const plat1Y = localGroundY - 105;
        const isPlat1Moving = isMidOrLater && Math.random() < 0.55;
        const plat1 = {
          baseX: x,
          x: x,
          y: plat1Y,
          width: plat1W,
          height: 18,
          isMoving: isPlat1Moving,
          moveRange: isPlat1Moving ? 42 : 0,
          moveSpeed: 0.032,
          movePhase: 0,
          dx: 0
        };
        this.platforms.push(plat1);

        const plat2W = 120 + Math.random() * 25;
        const plat2Y = localGroundY - 168;
        const plat2 = {
          baseX: x + 135,
          x: x + 135,
          y: plat2Y,
          width: plat2W,
          height: 18,
          isMoving: false,
          moveRange: 0,
          moveSpeed: 0,
          movePhase: 0,
          dx: 0
        };
        this.platforms.push(plat2);

        this.items.push({
          x: x + plat1W / 2 - 16,
          y: plat1Y - 40,
          width: 32,
          height: 32,
          type: 'konpeito',
          platformRef: isPlat1Moving ? plat1 : null
        });
        this.items.push({
          x: x + 135 + plat2W / 2 - 19,
          y: plat2Y - 44,
          width: 38,
          height: 38,
          type: this.pickRareWagashi()
        });

        // 地上は安全な範囲なら転がる樽
        if (this.isGroundSolidRange(x + 70, x + 160)) {
          const barrelGroundY = this.getGroundYAt(x + 110);
          if (barrelGroundY !== null) {
            this.enemies.push({
              x: x + 110,
              y: barrelGroundY - 46,
              width: 46,
              height: 46,
              vx: -2.2 - difficulty * 0.45,
              type: 'barrel',
              rotation: 0,
              isSatisfied: false,
              nearMissAwarded: false
            });
          }
        }
      } else if (pattern < 0.90 && isMidOrLater) {
        // パターン6: 立体連携（地上樽＋上空カラスのドキドキ連携）
        if (this.isGroundSolidRange(x + 20, x + 130)) {
          const barrelGroundY = this.getGroundYAt(x + 50);
          if (barrelGroundY !== null) {
            this.enemies.push({
              x: x + 50,
              y: barrelGroundY - 46,
              width: 46,
              height: 46,
              vx: -2.3 - difficulty * 0.45,
              type: 'barrel',
              rotation: 0,
              isSatisfied: false,
              nearMissAwarded: false
            });
          }

          const crowGroundY = this.getGroundYAt(x + 160) || localGroundY;
          this.enemies.push({
            x: x + 160,
            y: crowGroundY - 175,
            baseY: crowGroundY - 175,
            width: 50,
            height: 44,
            vx: -1.85 - difficulty * 0.35,
            type: 'crow',
            animPhase: Math.random() * Math.PI * 2,
            isSatisfied: false,
            nearMissAwarded: false
          });

          this.spawnKonpeitoArc(x - 15, x + 75, localGroundY - 52, 46, 3);
        }
      } else if (pattern < 0.95) {
        // パターン7: 餅つきの大臼 + 高空の名物和菓子 + 踏みつけチャンスのカラス
        if (this.isGroundSolidRange(x - 20, x + 80)) {
          this.springs.push({
            x: x,
            y: localGroundY - 36,
            width: 56,
            height: 36
          });
          this.spawnKonpeitoArc(x + 20, x + 180, localGroundY - 120, 95, 4);
          this.items.push({
            x: x + 82,
            y: localGroundY - 225,
            width: 40,
            height: 40,
            type: this.pickRareWagashi()
          });

          if (Math.random() < 0.5) {
            this.enemies.push({
              x: x + 125,
              y: localGroundY - 205,
              baseY: localGroundY - 205,
              width: 50,
              height: 44,
              vx: -1.5,
              type: 'crow',
              animPhase: 0,
              isSatisfied: false,
              nearMissAwarded: false
            });
          }
        }
      } else {
        // パターン8: ご褒美の和菓子ウェーブ街道（緊張と緩和の「ほっと一息＆コンボ回復」ゾーン！）
        this.spawnKonpeitoArc(x, x + 160, localGroundY - 46, 58, 5);
        this.items.push({
          x: x + 62,
          y: localGroundY - 120,
          width: 38,
          height: 38,
          type: this.pickRareWagashi()
        });
      }
    }
  }

  // =========================================================================
  // パワーアップ適用（コンボ倍率・重複ボーナス・フィーバー加速）
  // =========================================================================
  applyPowerup(type) {
    this.itemsCollected++;
    this.combo++;
    this.comboTimer = 260; // 約4.3秒

    const mult = this.getComboMultiplier() * (this.isFever ? 2 : 1);
    const basePts = Math.round(200 * mult);
    this.score += basePts;

    // フィーバーゲージ蓄積
    if (!this.isFever) {
      this.feverGauge = Math.min(100, this.feverGauge + (type === 'konpeito' ? 7 : 15));
      if (this.feverGauge >= 100) {
        this.startFever();
      }
    }

    soundEngine.playCollectItem();

    switch (type) {
      case 'dango':
        this.player.hasDash = true;
        this.player.dashTimer = 360; // 6秒間
        this.player.invincible = true;
        this.player.invincibleTimer = Math.max(this.player.invincibleTimer, 405); // 終了後も0.75秒の安全無敵
        soundEngine.playPowerup();
        this.addFloatingText(this.player.worldX, this.player.y - 22, '🍡 団子ダッシュ!!', '#ffc857');
        break;

      case 'daifuku': {
        const hadFullLifeAndShield = (this.lives >= 3 && this.player.hasShield);
        if (hadFullLifeAndShield) {
          const bonus = Math.round(600 * mult);
          this.score += bonus;
          if (!this.isFever) this.feverGauge = Math.min(100, this.feverGauge + 20);
          soundEngine.playPowerup();
          this.addFloatingText(this.player.worldX, this.player.y - 22, `🍵 極上抹茶! +${bonus}`, '#9ef08c');
        } else {
          this.lives = Math.min(3, this.lives + 1);
          this.player.hasShield = true;
          soundEngine.playPowerup();
          this.addFloatingText(this.player.worldX, this.player.y - 22, '🍵 お茶の加護 (回復＆盾)', '#67923d');
        }
        break;
      }

      case 'dorayaki':
        if (this.player.hasDoubleJump) {
          // 既に2段ジャンプ所持中はふわふわ滞空ボーナス＋スコアUP！
          this.player.floatTimer = 420; // 7秒間ふわふわ滞空
          const bonus = Math.round(450 * mult);
          this.score += bonus;
          soundEngine.playPowerup();
          this.addFloatingText(this.player.worldX, this.player.y - 22, `🥮 ふわふわ強化! +${bonus}`, '#ffd166');
        } else {
          this.player.hasDoubleJump = true;
          soundEngine.playPowerup();
          this.addFloatingText(this.player.worldX, this.player.y - 22, '🥮 2段ジャンプ解禁!!', '#ffaa00');
        }
        break;

      case 'sakuramochi':
        this.player.sakuramochiStock = Math.min(8, this.player.sakuramochiStock + 3);
        soundEngine.playPowerup();
        this.addFloatingText(this.player.worldX, this.player.y - 22, '🌸 桜餅シュート+3', '#ff758c');
        break;

      case 'konpeito': {
        const pts = Math.round(250 * mult);
        this.score += pts;
        this.addFloatingText(this.player.worldX, this.player.y - 18, `+${pts}`, '#ffebbe');
        break;
      }
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
    // フィーバー終了直後に一瞬だけ安全無敵を付与して事故防止
    this.player.invincible = true;
    this.player.invincibleTimer = Math.max(this.player.invincibleTimer, 45);
    soundEngine.playBGM('game');
  }

  // 宿場町到達チェック（達成感＆お茶休憩ボーナス）
  checkStationArrival() {
    const stations = uiManager.stations;
    for (let i = this.lastStationIndex + 1; i < stations.length; i++) {
      if (this.distance >= stations[i].dist) {
        this.lastStationIndex = i;
        const stationName = stations[i].name;
        this.score += 500;
        this.player.sakuramochiStock = Math.min(8, this.player.sakuramochiStock + 1);
        let bonusText = 'お茶休憩ボーナス！ 桜餅+1＆+500点';
        // 残り体力1のピンチで宿場町に辿り着いたら茶屋の癒し回復！
        if (this.lives === 1) {
          this.lives = 2;
          bonusText = '茶屋の癒し！ 体力+1＆桜餅+1＆+500点';
        }
        soundEngine.playStationArrive();
        uiManager.triggerStationBanner(stationName, bonusText);
        for (let k = 0; k < 6; k++) {
          this.addEffect(this.player.worldX + (Math.random() - 0.5) * 60, this.player.y + (Math.random() - 0.5) * 50, 'sparkle');
        }
      }
    }
  }

  // =========================================================================
  // 被弾ダメージ処理（手応えあるノックバック・ヒットストップ・画面シェイク）
  // =========================================================================
  takeDamage() {
    if (this.player.invincible) return;

    if (this.player.hasShield) {
      // 抹茶シールドで1回ダメージガード
      this.player.hasShield = false;
      this.player.invincible = true;
      this.player.invincibleTimer = 100;
      this.hitStopTimer = 3;
      this.triggerScreenShake(10, 4);
      soundEngine.playDamage();
      this.addFloatingText(this.player.worldX, this.player.y - 20, '🛡️ 抹茶シールド防衛!', '#8ce06c');
      return;
    }

    // ライフを1減らす
    this.lives = Math.max(0, this.lives - 1);
    soundEngine.playDamage();
    this.hitStopTimer = 4;
    this.triggerScreenShake(14, 6);

    // ノックバック＆被弾状態
    this.player.state = 'hit';
    this.player.vy = -7.5;
    this.player.vx = this.player.facingRight ? -4.2 : 4.2;
    this.player.knockbackTimer = 14;
    this.player.springBoostTimer = 0;
    this.player.invincible = true;
    this.player.invincibleTimer = 120; // 約2.0秒間無敵点滅
    this.combo = 0;

    this.addFloatingText(this.player.worldX, this.player.y - 20, '💥 痛っ! 気をつけて!', '#ff6b6b');

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

    // 画面シェイク減衰
    if (this.shakeTimer > 0) {
      this.shakeTimer--;
      if (this.shakeTimer <= 0) this.shakeMagnitude = 0;
    }

    // ヒットストップ（一瞬の手応え硬直）
    if (this.hitStopTimer > 0) {
      this.hitStopTimer--;
      return;
    }

    // プレイヤーの左右入力移動
    let moveDir = 0;
    if (this.keys.left) moveDir -= 1;
    if (this.keys.right) moveDir += 1;

    const currentSpeed = this.player.hasDash ? this.player.baseSpeed * 1.75 : this.player.baseSpeed;

    if (this.player.knockbackTimer > 0) {
      this.player.knockbackTimer--;
      this.player.vx *= 0.90;
    } else if (this.player.springBoostTimer > 0) {
      // 大臼ジャンプ後の前進ブースト維持（左入力時は減速調整も可）
      this.player.springBoostTimer--;
      if (moveDir < 0) {
        this.player.vx = -currentSpeed * 0.75;
        this.player.facingRight = false;
      } else {
        this.player.vx = Math.max(currentSpeed, 6.4);
        this.player.facingRight = true;
      }
    } else if (moveDir !== 0) {
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
      this.checkStationArrival();
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

    // コヨーテタイム & 先行入力タイマーの更新
    const wasGrounded = this.player.isGrounded;
    if (this.player.jumpBufferTimer > 0) this.player.jumpBufferTimer--;

    // 重力・垂直物理（ふわふわ滞空ボーナス中は落下速度が緩やかに！）
    const gravity = (this.player.floatTimer > 0 && this.player.vy > 0) ? 0.42 : 0.66;
    this.player.vy = Math.min(16, this.player.vy + gravity);
    this.player.y += this.player.vy;
    this.player.isGrounded = false;

    // 地面判定（地形セグメントベース）
    const playerCenterX = this.player.worldX + this.player.width / 2;
    const localGround = this.getGroundYAt(playerCenterX);

    if (localGround === null) {
      // 穴の上: 地面なし → 落下し続ける
      // 画面外まで落下したら最後に安全だった地面へ確実に復帰（連続落下防止）
      if (this.player.y > this.baseGroundY + 100) {
        this.player.worldX = this.player.lastSafeX;
        this.player.y = this.player.lastSafeY - 12;
        this.player.vy = 0;
        this.player.vx = 0;
        this.player.springBoostTimer = 0;
        this.player.isGrounded = false;
        this.takeDamage();
      }
    } else {
      // 通常の地面判定
      if (this.player.y >= localGround - this.player.height && this.player.vy >= 0) {
        this.player.y = localGround - this.player.height;
        this.player.vy = 0;
        this.player.isGrounded = true;
        this.player.canDoubleJump = this.player.hasDoubleJump;
        this.player.springBoostTimer = 0;
        this.stompCombo = 0;

        // 穴の縁から少し内側の安全な地面座標を記録
        if (this.getGroundYAt(playerCenterX - 36) !== null && this.getGroundYAt(playerCenterX + 36) !== null) {
          this.player.lastSafeX = this.player.worldX;
          this.player.lastSafeY = localGround - this.player.height;
        }
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
        if (this.player.vy >= 0 && pBottom <= wall.y + 22) {
          this.player.y = wall.y - this.player.height;
          this.player.vy = 0;
          this.player.isGrounded = true;
          this.player.canDoubleJump = this.player.hasDoubleJump;
          this.player.springBoostTimer = 0;
          this.stompCombo = 0;
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
        this.player.worldX + this.player.width * 0.82 > plat.x &&
        this.player.worldX + this.player.width * 0.18 < plat.x + plat.width &&
        this.player.y + this.player.height >= plat.y &&
        this.player.y + this.player.height <= plat.y + 22 &&
        this.player.vy >= 0
      ) {
        this.player.y = plat.y - this.player.height;
        this.player.vy = 0;
        this.player.isGrounded = true;
        this.player.canDoubleJump = this.player.hasDoubleJump;
        this.player.springBoostTimer = 0;
        this.stompCombo = 0;
        // 動く足場に乗っているときはプレイヤーも一緒に左右移動
        if (plat.isMoving && plat.dx) {
          this.player.worldX += plat.dx;
        }
      }
    });

    // コヨーテタイム更新＆着地時の先行ジャンプ実行
    if (this.player.isGrounded) {
      this.player.coyoteTimer = 7;
      if (this.player.jumpBufferTimer > 0) {
        this.handleJump();
      }
    } else if (wasGrounded && this.player.vy >= 0) {
      // 崖から自然に踏み出した直後はコヨーテタイム維持
      this.player.coyoteTimer = 7;
    } else if (this.player.coyoteTimer > 0) {
      this.player.coyoteTimer--;
    }

    // プレイヤーのアニメーション状態決定
    if (this.player.knockbackTimer > 0) {
      this.player.state = 'hit';
    } else if (!this.player.isGrounded) {
      this.player.state = 'jump';
    } else if (Math.abs(this.player.vx) > 0.3) {
      this.player.state = this.player.hasDash ? 'run' : 'walk';
      this.player.animTimer += this.player.hasDash ? 0.32 : 0.20;
    } else {
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
      // フィーバー中は定期的にお茶会ご褒美の金平糖が前方空からふわりと出現！
      if (this.feverTimer % 55 === 0 && this.feverTimer > 30) {
        const dropX = this.player.worldX + 160 + Math.random() * 140;
        const dropGroundY = this.getGroundYAt(dropX) || this.baseGroundY;
        this.items.push({
          x: dropX,
          y: Math.max(220, dropGroundY - 120 - Math.random() * 90),
          width: 32,
          height: 32,
          type: 'konpeito'
        });
      }
      if (this.feverTimer <= 0) this.endFever();
    }

    if (this.player.hasDash) {
      this.player.dashTimer--;
      if (this.player.dashTimer <= 0) this.player.hasDash = false;
    }

    if (this.player.floatTimer > 0) {
      this.player.floatTimer--;
    }

    if (this.player.invincible) {
      this.player.invincibleTimer--;
      if (this.player.invincibleTimer <= 0) this.player.invincible = false;
    }

    // 大臼（トランポリン）判定（上から飛び乗っても、地上から駆け込んでも気持ちよく大跳躍！）
    this.springs.forEach(spring => {
      if (
        this.player.worldX + this.player.width + 4 > spring.x &&
        this.player.worldX - 4 < spring.x + spring.width &&
        this.player.y + this.player.height >= spring.y - 6 &&
        this.player.y + this.player.height <= spring.y + spring.height + 6 &&
        this.player.vy >= 0
      ) {
        this.player.vy = -20.5; // 大峡谷を気持ちよく飛び越える超跳躍
        this.player.vx = Math.max(this.player.vx, 6.4);
        this.player.springBoostTimer = 46; // 前進ブーストを維持して確実に大峡谷突破！
        this.player.isGrounded = false;
        this.player.coyoteTimer = 0;
        this.player.canDoubleJump = this.player.hasDoubleJump;
        this.triggerScreenShake(5, 2.5);
        soundEngine.playSpring();
        this.addEffect(spring.x + spring.width / 2, spring.y, 'sparkle');
        this.addFloatingText(spring.x + spring.width / 2, spring.y - 25, '✨ 大跳躍！', '#ffd166');
      }
    });

    // アイテム判定＆マグネット（逆順ループでsplice安全処理）
    for (let idx = this.items.length - 1; idx >= 0; idx--) {
      const item = this.items[idx];
      // ドロップアイテムの軽い物理（敵満足ドロップの金平糖など）
      if (item.vx || item.vy !== undefined) {
        item.x += (item.vx || 0);
        item.vy = (item.vy || 0) + 0.35;
        item.y += item.vy;
        const gy = this.getGroundYAt(item.x + item.width / 2);
        if (gy !== null && item.y + item.height >= gy - 8) {
          item.y = gy - item.height - 8;
          item.vx = 0;
          item.vy = undefined;
        }
      }

      // フィーバー時のマグネット効果（広範囲に吸い寄せ！）
      if (this.isFever) {
        const dx = (this.player.worldX + this.player.width / 2) - (item.x + item.width / 2);
        const dy = (this.player.y + this.player.height / 2) - (item.y + item.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1 && dist < 360) {
          item.x += (dx / dist) * 8.5;
          item.y += (dy / dist) * 8.5;
        }
      }

      // 取得判定（少し広めで気持ちよく回収）
      if (
        this.player.worldX + this.player.width + 4 > item.x &&
        this.player.worldX - 4 < item.x + item.width &&
        this.player.y + this.player.height + 4 > item.y &&
        this.player.y - 4 < item.y + item.height
      ) {
        this.applyPowerup(item.type);
        this.items.splice(idx, 1);
      }
    }

    // 和菓子シュート（投擲弾）更新
    for (let pIdx = this.projectiles.length - 1; pIdx >= 0; pIdx--) {
      const proj = this.projectiles[pIdx];
      proj.x += proj.vx;
      proj.y += proj.vy;
      proj.vy += 0.26; // 当てやすい緩やかな放物線
      proj.rotation += (proj.vx >= 0 ? 1 : -1) * 0.18;

      let hit = false;

      // 敵キャラクターとの当たり判定
      const pRadius = proj.size * 0.48;
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
          const pts = Math.round(500 * this.getComboMultiplier() * (this.isFever ? 2 : 1));
          this.score += pts;
          if (!this.isFever) this.feverGauge = Math.min(100, this.feverGauge + 10);
          soundEngine.playEnemySatisfied();
          this.addFloatingText(enemy.x, enemy.y - 20, `🌸 美味しい！+${pts}`, '#ff69b4');
          this.addEffect(proj.x, proj.y, 'sparkle');
          // 満足した敵から金平糖のお返しがポンッと飛び出す！
          this.items.push({
            x: enemy.x + enemy.width / 2 - 16,
            y: enemy.y,
            width: 32,
            height: 32,
            type: 'konpeito',
            vx: proj.vx >= 0 ? 1.2 : -1.2,
            vy: -6.5
          });
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

    // 敵キャラクター更新＆精密な当たり判定＋ヒヤリ回避判定
    this.enemies.forEach((enemy) => {
      if (enemy.isSatisfied) return;

      // 画面の視界近く（カメラ右端+140px以内）に入るまでは待機
      if (!enemy.activated) {
        if (enemy.x <= this.cameraX + this.width + 140) {
          enemy.activated = true;
        } else {
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

        let shouldTurn = false;
        if (enemy.minX && enemy.maxX) {
          if (nextX < enemy.minX || nextX > enemy.maxX) shouldTurn = true;
        }
        if (currentGroundY !== null && (frontGroundY === null || nextGroundY === null)) {
          shouldTurn = true;
        }
        if (frontGroundY !== null && currentGroundY !== null && (currentGroundY - frontGroundY > 40)) {
          shouldTurn = true;
        }
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

        // タヌキの愛嬌あるぴょん跳ねアクション
        if (enemy.hopOffsetY === undefined) enemy.hopOffsetY = 0;
        if (enemy.hopVy === undefined) enemy.hopVy = 0;
        if (enemy.hopCooldown === undefined) enemy.hopCooldown = 90;

        if (enemy.hopOffsetY === 0 && enemy.hopVy === 0) {
          enemy.hopCooldown--;
          if (enemy.hopCooldown <= 0) {
            enemy.hopVy = -6.5;
            enemy.hopCooldown = 95 + Math.floor(Math.random() * 55);
          }
        } else {
          enemy.hopVy += 0.42;
          enemy.hopOffsetY += enemy.hopVy;
          if (enemy.hopOffsetY >= 0) {
            enemy.hopOffsetY = 0;
            enemy.hopVy = 0;
          }
        }

        const finalGroundY = this.getGroundYAt(enemy.x + enemy.width / 2);
        if (finalGroundY !== null) {
          enemy.y = finalGroundY - enemy.height + enemy.hopOffsetY;
          enemy.vy = 0;
        } else {
          enemy.vy = (enemy.vy || 0) + 0.6;
          enemy.y += enemy.vy;
        }

      } else if (enemy.type === 'barrel') {
        const nextX = enemy.x + enemy.vx;
        let hitWall = false;

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
          enemy.y = groundY - enemy.height;
          enemy.vy = 0;
          enemy.rotation = (enemy.rotation || 0) + (enemy.vx / (enemy.width / 2));
        } else {
          enemy.vy = (enemy.vy || 0) + 0.65;
          enemy.y += enemy.vy;
          enemy.rotation = (enemy.rotation || 0) + (enemy.vx >= 0 ? 0.15 : -0.15);
        }

      } else if (enemy.type === 'crow') {
        enemy.x += enemy.vx;
        const centerX = enemy.x + enemy.width / 2;
        const currentGroundY = this.getGroundYAt(centerX) || this.baseGroundY;

        // プレイヤーの少し手前で緩やかに高度を下げてスリリングな駆け引きを演出
        const distToPlayer = enemy.x - this.player.worldX;
        const swoopOffset = (distToPlayer > -30 && distToPlayer < 220)
          ? Math.sin(((220 - distToPlayer) / 250) * Math.PI) * 28
          : 0;

        const targetBaseY = currentGroundY - 155 + swoopOffset;
        if (enemy.baseY === undefined) {
          enemy.baseY = targetBaseY;
        } else {
          enemy.baseY += (targetBaseY - enemy.baseY) * 0.08;
        }

        enemy.animPhase = (enemy.animPhase || 0) + 0.048;
        enemy.y = enemy.baseY + Math.sin(enemy.animPhase) * 30;
      }

      if (!enemy.isSatisfied) {
        // 矩形交差判定（プレイヤーに少し優しいマージン）
        const pLeft = this.player.worldX + 12;
        const pRight = this.player.worldX + this.player.width - 12;
        const pTop = this.player.y + 10;
        const pBottom = this.player.y + this.player.height - 4;

        const eLeft = enemy.x + 8;
        const eRight = enemy.x + enemy.width - 8;
        const eTop = enemy.y + 8;
        const eBottom = enemy.y + enemy.height - 4;

        const isColliding = (pRight > eLeft && pLeft < eRight && pBottom > eTop && pTop < eBottom);

        if (isColliding) {
          // 1. だんごダッシュ中・フィーバー中のおもてなし突破！
          if (this.player.hasDash || this.isFever) {
            enemy.isSatisfied = true;
            enemy.satisfiedTime = Date.now();
            const pts = Math.round(400 * (this.isFever ? 2 : 1));
            this.score += pts;
            this.triggerScreenShake(6, 4);
            soundEngine.playEnemySatisfied();
            const label = this.player.hasDash ? `💥 突進突破! +${pts}` : `🌸 お茶会おもてなし! +${pts}`;
            this.addFloatingText(enemy.x, enemy.y - 20, label, '#ffc857');
          }
          // 2. 上からの踏みつけ判定（落下中または頂点付近かつ足元が敵の上部65%）
          else if (this.player.vy > -1.0 && pBottom <= eTop + (eBottom - eTop) * 0.65) {
            enemy.isSatisfied = true;
            enemy.satisfiedTime = Date.now();
            this.stompCombo++;
            this.player.vy = this.keys.jump ? -13.5 : -11.2; // ジャンプ押しっぱなしで大バウンド！
            this.player.canDoubleJump = this.player.hasDoubleJump; // 連続アクション用に2段ジャンプ回復
            const stompPts = (350 + (this.stompCombo - 1) * 150) * (this.isFever ? 2 : 1);
            this.score += stompPts;
            if (!this.isFever) this.feverGauge = Math.min(100, this.feverGauge + 10);
            this.hitStopTimer = 2;
            this.triggerScreenShake(6, 3);
            soundEngine.playEnemySatisfied();
            const label = this.stompCombo > 1
              ? `🌸 連続ふみふみ×${this.stompCombo}! +${stompPts}`
              : `🌸 ふみふみ! +${stompPts}`;
            this.addFloatingText(enemy.x, enemy.y - 20, label, '#ffdf9e');
          }
          // 3. 通常の接触は被弾！
          else {
            this.takeDamage();
          }
        } else if (!enemy.nearMissAwarded && !this.player.invincible && !this.player.hasDash && !this.isFever) {
          // ✨ ヒヤリ回避（紙一重ニアミス）判定：当たり判定の外側32px以内をかすめて通過！
          const margin = 32;
          const isNear = (
            pRight + margin > eLeft &&
            pLeft - margin < eRight &&
            pBottom + margin > eTop &&
            pTop - margin < eBottom
          );
          if (isNear) {
            enemy.nearMissAwarded = true;
            const bonus = Math.round(150 * this.getComboMultiplier());
            this.score += bonus;
            this.feverGauge = Math.min(100, this.feverGauge + 7);
            if (this.feverGauge >= 100 && !this.isFever) {
              this.startFever();
            }
            soundEngine.playNearMiss();
            this.addFloatingText(this.player.worldX + this.player.width / 2, this.player.y - 24, `✨ ヒヤリ回避! +${bonus}`, '#72efdd');
            this.addEffect(this.player.worldX + this.player.width / 2, this.player.y + this.player.height / 2, 'sparkle');
          }
        }
      }
    });

    // ガベージコレクション
    this.platforms = this.platforms.filter(p => p.x + p.width > this.cameraX - 400);
    this.items = this.items.filter(i => i.x > this.cameraX - 400);
    this.enemies = this.enemies.filter(e => e.x > this.cameraX - 400 && e.x < this.cameraX + this.width + 1800 && e.y < this.height + 150 && (!e.isSatisfied || Date.now() - e.satisfiedTime < 800));
    this.springs = this.springs.filter(s => s.x > this.cameraX - 400);
    this.terrainSegments = this.terrainSegments.filter(t => t.x + t.width > this.cameraX - 600);
    this.walls = this.walls.filter(w => w.x > this.cameraX - 400);

    // エフェクト更新（逆順ループでsplice安全処理）
    for (let idx = this.effects.length - 1; idx >= 0; idx--) {
      const eff = this.effects[idx];
      eff.life--;
      if (eff.type === 'text') eff.y -= 0.85;
      if (eff.life <= 0) this.effects.splice(idx, 1);
    }

    // HUD更新
    uiManager.updateHUD({
      score: this.score,
      distance: this.distance,
      lives: this.lives,
      combo: this.combo,
      comboMultiplier: this.getComboMultiplier(),
      feverGauge: this.feverGauge,
      isFever: this.isFever,
      hasDash: this.player.hasDash,
      dashTimer: this.player.dashTimer,
      hasShield: this.player.hasShield,
      hasDoubleJump: this.player.hasDoubleJump,
      floatTimer: this.player.floatTimer,
      sakuramochiStock: this.player.sakuramochiStock
    });
  }

  // =========================================================================
  // レンダリング (Render)
  // =========================================================================
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 画面シェイク（踏みつけ・被弾・大跳躍の手応え演出）
    this.ctx.save();
    if (this.shakeTimer > 0 && this.shakeMagnitude > 0) {
      const sx = (Math.random() - 0.5) * this.shakeMagnitude * 2;
      const sy = (Math.random() - 0.5) * this.shakeMagnitude * 2;
      this.ctx.translate(sx, sy);
    }

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

    // 7. 敵キャラクター（および画面右端からの接近予兆アラート）
    this.enemies.forEach(enemy => {
      const screenX = enemy.x - this.cameraX;
      // 画面右端の外側 0〜150px から迫る樽・カラスには接近予兆バッジを表示！
      if (
        this.state === 'PLAYING' &&
        !enemy.isSatisfied &&
        (enemy.type === 'barrel' || enemy.type === 'crow') &&
        enemy.vx < 0 &&
        screenX > this.width - 8 &&
        screenX < this.width + 150
      ) {
        spriteManager.renderWarning(this.ctx, enemy.y + enemy.height / 2, enemy.type, this.width);
      }
      spriteManager.renderEnemy(this.ctx, {
        x: screenX,
        y: enemy.y,
        width: enemy.width,
        height: enemy.height,
        type: enemy.type,
        vx: enemy.vx,
        hopOffsetY: enemy.hopOffsetY,
        hopVy: enemy.hopVy,
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
      dashTimer: this.player.dashTimer,
      hasShield: this.player.hasShield,
      isFever: this.isFever,
      floatTimer: this.player.floatTimer,
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

    // 10b. 残り体力1（ピンチ）のドキドキ周辺脈動オーバーレイ
    if (this.state === 'PLAYING' && this.lives === 1) {
      const pulse = 0.08 + Math.sin(Date.now() / 180) * 0.05;
      this.ctx.save();
      const pinchGrad = this.ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.width * 0.35,
        this.width / 2, this.height / 2, this.height * 0.65
      );
      pinchGrad.addColorStop(0, 'rgba(220, 40, 60, 0)');
      pinchGrad.addColorStop(1, `rgba(220, 40, 60, ${pulse})`);
      this.ctx.fillStyle = pinchGrad;
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.restore();
    }

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

    // 画面シェイク用 save() の対応 restore()
    this.ctx.restore();
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
