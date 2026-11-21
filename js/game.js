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
    this.currentEnvPhase = 'day'; // 'day', 'sunset', 'night', 'rain'

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
      windBoostTimer: 0,   // 春一番の追い風ブースト余韻フレーム
      inWindZone: false,   // 追い風ゾーン滞在フラグ
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
    this.terrainSegments = [];  // 地形セグメント（地面の高低差）
    this.walls = [];            // 壁型障害物（石垣・土塀）
    this.crumblingBridges = []; // 季節ギミック: 崩れる古橋
    this.windZones = [];        // 季節ギミック: 春一番の追い風ゾーン

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
    this.currentEnvPhase = 'day';
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
    this.player.windBoostTimer = 0;
    this.player.inWindZone = false;
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
    this.crumblingBridges = [];
    this.windZones = [];

    // 初期の平坦な地面セグメント（スタート直後は気持ちよく和菓子集めの導入）
    this.terrainSegments.push({
      x: 0,
      width: 720,
      y: this.baseGroundY,
      type: 'flat'
    });
    this.lastTerrainEndX = 720;
    this.currentTerrainY = this.baseGroundY;

    // 初期街道生成
    this.generateStageAhead(1600);

    uiManager.showGame();
  }

  // =========================================================================
  // 地面の高さ取得（坂道はコサイン補間で丸みのある滑らかな曲線物理）
  // =========================================================================
  getGroundYAt(worldX) {
    for (let i = this.terrainSegments.length - 1; i >= 0; i--) {
      const seg = this.terrainSegments[i];
      if (worldX >= seg.x && worldX < seg.x + seg.width) {
        if (seg.type === 'gap') {
          return null; // 穴 — 地面なし
        }
        if (seg.type === 'slope_up' || seg.type === 'slope_down') {
          const t = Math.max(0, Math.min(1, (worldX - seg.x) / seg.width));
          // コサイン補間で坂の入り口・出口がカクカクせず滑らかに丸く接続
          const smoothT = 0.5 - 0.5 * Math.cos(t * Math.PI);
          return seg.yFrom + (seg.yTo - seg.yFrom) * smoothT;
        }
        return seg.y; // 'flat', 'raised', 'lowered'
      }
    }
    return this.baseGroundY;
  }

  // =========================================================================
  // 街道の時間帯・天候ステート（春の昼 → 夕焼け → 夜桜提灯 → 春雨の朝霧）
  // =========================================================================
  getEnvironmentState() {
    const cycleLen = 1400; // 1周 1,400m（各時間帯 350m）
    const pos = ((this.distance % cycleLen) + cycleLen) % cycleLen;
    const blend = 70; // 境目70mでスムーズにクロスフェード

    const smoothStep = (edge0, edge1, x) => {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    };

    // 各フェーズの重み（0〜1）
    let sunsetWeight = 0;
    let nightWeight = 0;
    let rainWeight = 0;
    let phase = 'day';
    let icon = '🌸';

    if (pos < 350) {
      phase = 'day';
      icon = '🌸';
      // 350mに近づくと夕焼けへフェードイン
      sunsetWeight = smoothStep(350 - blend, 350, pos);
    } else if (pos < 700) {
      phase = 'sunset';
      icon = '🌅';
      sunsetWeight = 1 - smoothStep(700 - blend, 700, pos);
      nightWeight = smoothStep(700 - blend, 700, pos);
    } else if (pos < 1050) {
      phase = 'night';
      icon = '🌙';
      nightWeight = 1 - smoothStep(1050 - blend, 1050, pos);
      rainWeight = smoothStep(1050 - blend, 1050, pos);
    } else {
      phase = 'rain';
      icon = '🌧️';
      rainWeight = 1 - smoothStep(1400 - blend, 1400, pos);
    }

    return { phase, icon, sunsetWeight, nightWeight, rainWeight };
  }

  // =========================================================================
  // バランス＆配置ヘルパー（理不尽配置の防止・希少金平糖・動的レア選出）
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
    for (let i = 0; i < this.crumblingBridges.length; i++) {
      const b = this.crumblingBridges[i];
      if (x > b.x - margin && x < b.x + b.width + margin) return true;
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

  // 希少な金平糖を低確率（従来の約20分の1水準）で1個だけ配置
  maybeSpawnRareKonpeito(x, y, chance = 0.08, platformRef = null) {
    // 基準確率を20分の1水準（20,000pxあたり約6〜7個）に調整
    if (Math.random() < chance * 1.8) {
      this.items.push({
        x: x - 16,
        y: y - 16,
        width: 32,
        height: 32,
        type: 'konpeito',
        platformRef: platformRef
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
  // 地形の前方生成（丸みある丘＆坂・崩れる古橋・大峡谷）
  // =========================================================================
  generateTerrainAhead(targetX) {
    while (this.lastTerrainEndX < targetX) {
      const roll = Math.random();
      const prevY = this.currentTerrainY;
      const difficulty = Math.min(1.0, this.distance / 1200);
      const isEarly = this.distance < 120;

      if (roll < 0.10 + difficulty * 0.05) {
        // ===== 穴（ギャップ）: ジャンプで飛び越える =====
        const gapWidth = 75 + Math.random() * 45 + difficulty * 35;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: gapWidth,
          y: prevY,
          type: 'gap'
        });
        // まれに希少な金平糖が1個輝く
        this.maybeSpawnRareKonpeito(this.lastTerrainEndX + gapWidth / 2, prevY - 108, 0.07);
        this.lastTerrainEndX += gapWidth;
        const landingW = 240 + Math.random() * 140;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: landingW,
          y: prevY,
          type: 'flat'
        });
        this.lastTerrainEndX += landingW;

      } else if (!isEarly && roll < 0.20 + difficulty * 0.05) {
        // ===== 季節ギミック: 崩れる古橋エリア（乗ると揺れて落ちるスリル！） =====
        const approachW = 140;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: approachW,
          y: prevY,
          type: 'flat'
        });
        this.lastTerrainEndX += approachW;

        const doubleBridge = (this.distance >= 320 && Math.random() < 0.45);
        const bridgeGapW = doubleBridge ? 310 : 195;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: bridgeGapW,
          y: prevY,
          type: 'gap'
        });

        if (doubleBridge) {
          // 2連の崩れる古橋（リズムよく渡り切るドキドキ感！）
          const b1X = this.lastTerrainEndX + 26;
          const b2X = this.lastTerrainEndX + 168;
          this.crumblingBridges.push({
            x: b1X, y: prevY, baseY: prevY, width: 112, height: 18,
            state: 'idle', timer: 0, vy: 0, fallDistance: 0, respawnTimer: 0
          });
          this.crumblingBridges.push({
            x: b2X, y: prevY - 14, baseY: prevY - 14, width: 112, height: 18,
            state: 'idle', timer: 0, vy: 0, fallDistance: 0, respawnTimer: 0
          });
          // 中央上空にご褒美の名物和菓子
          if (Math.random() < 0.7) {
            this.items.push({
              x: this.lastTerrainEndX + bridgeGapW / 2 - 19,
              y: prevY - 96,
              width: 38,
              height: 38,
              type: this.pickRareWagashi()
            });
          }
        } else {
          // 単体の崩れる古橋
          const bX = this.lastTerrainEndX + 34;
          this.crumblingBridges.push({
            x: bX, y: prevY, baseY: prevY, width: 126, height: 18,
            state: 'idle', timer: 0, vy: 0, fallDistance: 0, respawnTimer: 0
          });
          if (Math.random() < 0.6) {
            this.items.push({
              x: bX + 44,
              y: prevY - 62,
              width: 38,
              height: 38,
              type: this.pickRareWagashi()
            });
          }
        }
        this.lastTerrainEndX += bridgeGapW;

        const landingW = 240 + Math.random() * 100;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: landingW,
          y: prevY,
          type: 'flat'
        });
        this.lastTerrainEndX += landingW;

      } else if (roll < 0.32 + difficulty * 0.04) {
        // ===== 上り坂 → 高台（丸みある丘） =====
        const riseAmount = 45 + Math.random() * 55;
        const slopeW = 140 + Math.random() * 70;
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

      } else if (roll < 0.43 + difficulty * 0.04) {
        // ===== 下り坂 → 谷 =====
        const dropAmount = 40 + Math.random() * 50;
        const slopeW = 120 + Math.random() * 70;
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

      } else if (roll < 0.51 + difficulty * 0.03) {
        // ===== 階段状の段差（丸みある3段の土手ステップ） =====
        const stepW = 100;
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
          this.maybeSpawnRareKonpeito(this.lastTerrainEndX + stepW / 2, stepY - 46, 0.04);
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

      } else if (!isEarly && roll < 0.58 + difficulty * 0.03) {
        // ===== 地面に石垣の壁（ジャンプで越える） =====
        const wallH = 58 + Math.random() * 34;
        const wallX = this.lastTerrainEndX + 80;
        this.walls.push({
          x: wallX,
          y: prevY - wallH,
          width: 30,
          height: wallH
        });
        this.maybeSpawnRareKonpeito(wallX + 15, prevY - wallH - 58, 0.06);
        const segW = 360 + Math.random() * 180;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: segW,
          y: prevY,
          type: 'flat'
        });
        this.lastTerrainEndX += segW;

      } else if (!isEarly && roll < 0.65 + difficulty * 0.04) {
        // ===== 高台→穴→瓦足場→安全着地（浮島アクション） =====
        const riseH = 55 + Math.random() * 35;
        const newY = Math.max(510, prevY - riseH);
        const slopeW = 95;
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
          x: floatPlat.x + floatPlat.width / 2 - 19,
          y: newY - 46,
          width: 38,
          height: 38,
          type: this.pickRareWagashi(),
          platformRef: isPlatMoving ? floatPlat : null
        });
        this.lastTerrainEndX += totalGapW;

        const landW = 120;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: landW,
          y: newY,
          type: 'raised'
        });
        this.lastTerrainEndX += landW;

        const downW = 100;
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

      } else if (!isEarly && roll < 0.76 + difficulty * 0.04) {
        // ===== 大臼スーパージャンプ大峡谷 =====
        const approachW = 165;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: approachW,
          y: prevY,
          type: 'flat'
        });

        const springX = this.lastTerrainEndX + approachW - 56;
        this.springs.push({
          x: springX,
          y: prevY - 36,
          width: 56,
          height: 36
        });
        this.lastTerrainEndX += approachW;

        const giantGapW = 255 + Math.random() * 45;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: giantGapW,
          y: prevY,
          type: 'gap'
        });

        // 大峡谷の頂点に名物和菓子を1個（金平糖は希少確率で1個のみ）
        this.items.push({
          x: this.lastTerrainEndX + giantGapW * 0.5 - 19,
          y: prevY - 225,
          width: 38,
          height: 38,
          type: this.pickRareWagashi()
        });
        this.maybeSpawnRareKonpeito(this.lastTerrainEndX + giantGapW * 0.28, prevY - 175, 0.08);

        this.lastTerrainEndX += giantGapW;

        const landingW = 280 + Math.random() * 100;
        this.terrainSegments.push({
          x: this.lastTerrainEndX,
          width: landingW,
          y: prevY,
          type: 'flat'
        });
        this.lastTerrainEndX += landingW;

      } else {
        // ===== 通常の平坦地面（高すぎたら緩やかな下り坂で基準Yへ戻る） =====
        if (prevY < this.baseGroundY - 40) {
          const slopeW = 115 + Math.random() * 60;
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
  // 街道・ステージの前方生成（緩急のリズム・春一番追い風・希少金平糖）
  // =========================================================================
  generateStageAhead(targetX) {
    this.generateTerrainAhead(targetX + 450);

    const difficulty = Math.min(1.0, this.distance / 1500);
    const isMidOrLater = this.distance >= 260;

    while (this.lastGeneratedX < targetX) {
      const baseDist = Math.max(225, 305 - difficulty * 80);
      const sectionDist = baseDist + Math.random() * 90;
      this.lastGeneratedX += sectionDist;
      const x = this.lastGeneratedX;
      const rawGroundY = this.getGroundYAt(x);

      if (rawGroundY === null || this.hasObstacleNear(x, 115)) {
        continue;
      }

      const localGroundY = rawGroundY;
      const pattern = Math.random();

      if (pattern < 0.21) {
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

        if (Math.random() < 0.72) {
          this.items.push({
            x: x + platW / 2 - 19,
            y: platY - 44,
            width: 38,
            height: 38,
            type: this.pickRareWagashi(),
            platformRef: isMoving ? plat : null
          });
        } else {
          this.maybeSpawnRareKonpeito(x + platW / 2, platY - 42, 0.12, isMoving ? plat : null);
        }

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
      } else if (pattern < 0.40) {
        // パターン2: 転がる酒樽（単発 or 中盤以降はテンポ良い2連樽）
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

          this.maybeSpawnRareKonpeito(x + 40, localGroundY - 105, 0.05);
        }
      } else if (pattern < 0.56) {
        // パターン3: 急降下カラス（単羽 or 中盤以降は高低2羽）
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

        if (Math.random() < 0.35) {
          this.items.push({
            x: x + 25,
            y: localGroundY - 115,
            width: 38,
            height: 38,
            type: this.pickRareWagashi()
          });
        } else {
          this.maybeSpawnRareKonpeito(x + 25, localGroundY - 115, 0.05);
        }
      } else if (pattern < 0.69) {
        // パターン4: 石垣の塀 + 敵 + 塀の上にご褒美和菓子
        if (this.isGroundSolidRange(x - 30, x + 130)) {
          const wallH = 62 + Math.random() * 28;
          this.walls.push({
            x: x,
            y: localGroundY - wallH,
            width: 28,
            height: wallH
          });

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

          if (Math.random() < 0.65) {
            this.items.push({
              x: x - 5,
              y: localGroundY - wallH - 44,
              width: 38,
              height: 38,
              type: this.pickRareWagashi()
            });
          }
        }
      } else if (pattern < 0.78) {
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

        this.maybeSpawnRareKonpeito(x + plat1W / 2, plat1Y - 36, 0.06, isPlat1Moving ? plat1 : null);
        this.items.push({
          x: x + 135 + plat2W / 2 - 19,
          y: plat2Y - 44,
          width: 38,
          height: 38,
          type: this.pickRareWagashi()
        });

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
      } else if (pattern < 0.88) {
        // パターン6: 季節ギミック「🌬️ 春一番の追い風ゾーン」+ 風乗り名物和菓子！
        const zoneW = 270 + Math.random() * 70;
        const zoneH = 195;
        this.windZones.push({
          x: x,
          y: localGroundY - zoneH,
          width: zoneW,
          height: zoneH,
          triggered: false
        });
        // 風に乗って跳ぶと届く高空に名物和菓子
        this.items.push({
          x: x + zoneW * 0.55 - 19,
          y: localGroundY - 165,
          width: 38,
          height: 38,
          type: this.pickRareWagashi()
        });
        this.maybeSpawnRareKonpeito(x + zoneW * 0.8, localGroundY - 135, 0.08);
        this.lastGeneratedX += 110; // 追い風ゾーンの余白を確保
      } else if (pattern < 0.94 && isMidOrLater) {
        // パターン7: 立体連携（地上樽＋上空カラスのドキドキ連携）
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
        }
      } else {
        // パターン8: 餅つきの大臼 + 高空の名物和菓子 + 踏みつけチャンスのカラス
        if (this.isGroundSolidRange(x - 20, x + 80)) {
          this.springs.push({
            x: x,
            y: localGroundY - 36,
            width: 56,
            height: 36
          });
          this.items.push({
            x: x + 82,
            y: localGroundY - 225,
            width: 40,
            height: 40,
            type: this.pickRareWagashi()
          });
          this.maybeSpawnRareKonpeito(x + 135, localGroundY - 185, 0.08);

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

    // フィーバーゲージ蓄積（めったにないご褒美になるよう適正調整。希少な金平糖は大ボーナス！）
    if (!this.isFever) {
      this.feverGauge = Math.min(100, this.feverGauge + (type === 'konpeito' ? 22 : 10));
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
        const pts = Math.round(600 * mult);
        this.score += pts;
        soundEngine.playPowerup();
        this.addFloatingText(this.player.worldX, this.player.y - 20, `🌟 希少な金平糖! +${pts}`, '#fff0a6');
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

    // 春一番の追い風ゾーン判定
    let currentlyInWind = false;
    const pCenterX = this.player.worldX + this.player.width / 2;
    const pCenterY = this.player.y + this.player.height / 2;
    this.windZones.forEach(zone => {
      if (
        pCenterX >= zone.x &&
        pCenterX <= zone.x + zone.width &&
        pCenterY >= zone.y &&
        pCenterY <= zone.y + zone.height + 20
      ) {
        currentlyInWind = true;
        this.player.windBoostTimer = 18;
        if (!zone.triggered) {
          zone.triggered = true;
          soundEngine.playWindGust();
          this.addFloatingText(this.player.worldX + this.player.width / 2, this.player.y - 26, '🌬️ 春一番！追い風！', '#ffd6e7');
        }
      }
    });
    this.player.inWindZone = currentlyInWind;
    if (this.player.windBoostTimer > 0 && !currentlyInWind) {
      this.player.windBoostTimer--;
    }

    // プレイヤーの左右入力移動
    let moveDir = 0;
    if (this.keys.left) moveDir -= 1;
    if (this.keys.right) moveDir += 1;

    const windBonus = (this.player.windBoostTimer > 0) ? 2.3 : 0;
    const currentSpeed = (this.player.hasDash ? this.player.baseSpeed * 1.75 : this.player.baseSpeed) + windBonus;

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
      // 追い風中は右移動がグッと速く、左移動は少し押し戻される風情
      const dirSpeed = moveDir > 0 ? currentSpeed : Math.max(2.6, this.player.baseSpeed - windBonus * 0.5);
      this.player.vx = moveDir * dirSpeed;
      this.player.facingRight = moveDir > 0;
    } else if (this.player.inWindZone) {
      // 追い風ゾーンで立ち止まっていてもそよ風で少し前へ押し出される
      this.player.vx = 1.6;
      this.player.facingRight = true;
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

    // 時間帯・天候フェーズ切替演出チェック
    const envState = this.getEnvironmentState();
    if (envState.phase !== this.currentEnvPhase) {
      this.currentEnvPhase = envState.phase;
      const envMessages = {
        day: { text: '🌸 爽やかな春の朝！', color: '#ffd6e7' },
        sunset: { text: '🌅 夕暮れの街道へ…', color: '#ffb76b' },
        night: { text: '🏮 夜桜と提灯の道…', color: '#ffe599' },
        rain: { text: '🌧️ しとしと春雨…', color: '#bde0fe' }
      };
      const msg = envMessages[envState.phase];
      if (msg) {
        this.addFloatingText(this.player.worldX + 40, this.player.y - 44, msg.text, msg.color);
      }
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

    // 崩れる古橋の状態更新（揺れ→崩壊→落下→一定時間後に安全再構築）
    this.crumblingBridges.forEach(bridge => {
      if (bridge.state === 'shaking') {
        bridge.timer--;
        if (bridge.timer % 15 === 0 && bridge.timer > 0) {
          this.addEffect(bridge.x + Math.random() * bridge.width, bridge.y + bridge.height, 'sparkle');
        }
        if (bridge.timer <= 0) {
          bridge.state = 'falling';
          bridge.vy = 1.5;
          bridge.fallDistance = 0;
          soundEngine.playBridgeBreak();
          this.triggerScreenShake(6, 2.5);
        }
      } else if (bridge.state === 'falling') {
        bridge.vy += 0.55;
        bridge.y += bridge.vy;
        bridge.fallDistance += bridge.vy;
        if (bridge.fallDistance > 200) {
          bridge.state = 'broken';
          bridge.respawnTimer = 150; // 2.5秒後に再構築（落下復帰しても詰まない安全設計）
        }
      } else if (bridge.state === 'broken') {
        bridge.respawnTimer--;
        if (bridge.respawnTimer <= 0) {
          bridge.state = 'idle';
          bridge.y = bridge.baseY;
          bridge.vy = 0;
          bridge.fallDistance = 0;
        }
      }
    });

    // コヨーテタイム & 先行入力タイマーの更新
    const wasGrounded = this.player.isGrounded;
    if (this.player.jumpBufferTimer > 0) this.player.jumpBufferTimer--;

    // 重力・垂直物理（ふわふわ滞空・追い風中は少し軽やかに！）
    let gravity = 0.66;
    if (this.player.floatTimer > 0 && this.player.vy > 0) {
      gravity = 0.42;
    } else if (this.player.windBoostTimer > 0) {
      gravity = 0.56;
    }
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

    // 崩れる古橋の着地判定（乗ると揺れ始めて約0.75秒後に崩落！）
    this.crumblingBridges.forEach(bridge => {
      if (bridge.state !== 'idle' && bridge.state !== 'shaking') return;
      if (
        this.player.worldX + this.player.width * 0.82 > bridge.x &&
        this.player.worldX + this.player.width * 0.18 < bridge.x + bridge.width &&
        this.player.y + this.player.height >= bridge.y &&
        this.player.y + this.player.height <= bridge.y + 24 &&
        this.player.vy >= 0
      ) {
        this.player.y = bridge.y - this.player.height;
        this.player.vy = 0;
        this.player.isGrounded = true;
        this.player.canDoubleJump = this.player.hasDoubleJump;
        this.player.springBoostTimer = 0;
        this.stompCombo = 0;
        if (bridge.state === 'idle') {
          bridge.state = 'shaking';
          bridge.timer = 45; // 約0.75秒のドキドキ猶予！
          soundEngine.playBridgeCreak();
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
          if (!this.isFever) this.feverGauge = Math.min(100, this.feverGauge + 6);
          soundEngine.playEnemySatisfied();
          this.addFloatingText(enemy.x, enemy.y - 20, `🌸 美味しい！+${pts}`, '#ff69b4');
          this.addEffect(proj.x, proj.y, 'sparkle');
          // まれ（5%）に満足した敵から希少な金平糖のお返し！
          if (Math.random() < 0.05) {
            this.items.push({
              x: enemy.x + enemy.width / 2 - 16,
              y: enemy.y,
              width: 32,
              height: 32,
              type: 'konpeito',
              vx: proj.vx >= 0 ? 1.2 : -1.2,
              vy: -6.5
            });
          }
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
            if (!this.isFever) this.feverGauge = Math.min(100, this.feverGauge + 5);
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
            this.feverGauge = Math.min(100, this.feverGauge + 5);
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
    this.crumblingBridges = this.crumblingBridges.filter(b => b.x + b.width > this.cameraX - 400);
    this.windZones = this.windZones.filter(z => z.x + z.width > this.cameraX - 400);

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
      envIcon: envState.icon,
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
  // 丸みのある美しい地形描画（坂道コサイン曲線・高台＆段差の角丸一体レンダリング）
  // =========================================================================
  renderTerrain(envState) {
    const ctx = this.ctx;
    const camX = this.cameraX;
    const viewMinX = camX - 120;
    const viewMaxX = camX + this.width + 120;

    // 連続した陸地（非ギャップ）セグメントを塊（チャンク）にまとめる
    const chunks = [];
    let currentChunk = [];
    for (let i = 0; i < this.terrainSegments.length; i++) {
      const seg = this.terrainSegments[i];
      if (seg.type === 'gap') {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
        }
      } else {
        currentChunk.push(seg);
      }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);

    chunks.forEach(chunk => {
      const chunkStart = chunk[0].x;
      const chunkEnd = chunk[chunk.length - 1].x + chunk[chunk.length - 1].width;
      if (chunkEnd < viewMinX || chunkStart > viewMaxX) return;

      // チャンクの上面輪郭点列を構築（坂道は滑らかなコサイン曲線、段差・崖肩は丸角！）
      const rawPoints = [];
      for (let sIdx = 0; sIdx < chunk.length; sIdx++) {
        const seg = chunk[sIdx];
        const x0 = seg.x - camX;
        const x1 = seg.x + seg.width - camX;

        if (seg.type === 'slope_up' || seg.type === 'slope_down') {
          const steps = Math.max(8, Math.ceil(seg.width / 12));
          for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            const smoothT = 0.5 - 0.5 * Math.cos(t * Math.PI);
            const px = x0 + seg.width * t;
            const py = seg.yFrom + (seg.yTo - seg.yFrom) * smoothT;
            if (k === 0 && rawPoints.length > 0) {
              const last = rawPoints[rawPoints.length - 1];
              if (Math.abs(last.x - px) < 1 && Math.abs(last.y - py) < 1) continue;
            }
            rawPoints.push({ x: px, y: py, sharp: false });
          }
        } else {
          // 平坦・高台・段差: コーナーを丸める対象として頂点を追加
          const py = seg.y;
          if (rawPoints.length === 0) {
            rawPoints.push({ x: x0, y: py, sharp: true });
          } else {
            const prev = rawPoints[rawPoints.length - 1];
            if (Math.abs(prev.y - py) > 2) {
              // 段差の垂直壁もわずかに斜め＆丸角にして柔らかい土手・石段シルエットに
              rawPoints.push({ x: x0, y: py, sharp: true });
            }
          }
          rawPoints.push({ x: x1, y: py, sharp: true });
        }
      }

      if (rawPoints.length < 2) return;

      // 崖の左右端にも少し丸みをつけて自然な土手端を作る
      const firstPt = rawPoints[0];
      const lastPt = rawPoints[rawPoints.length - 1];
      const cliffRadius = 15;

      // 角丸付きの滑らかな上面パスを描くヘルパー
      const traceTopContour = (offsetY = 0) => {
        ctx.moveTo(firstPt.x, this.height + 10);
        ctx.lineTo(firstPt.x, firstPt.y + offsetY + cliffRadius);
        ctx.quadraticCurveTo(firstPt.x, firstPt.y + offsetY, Math.min(firstPt.x + cliffRadius, lastPt.x), firstPt.y + offsetY);

        for (let i = 1; i < rawPoints.length - 1; i++) {
          const prev = rawPoints[i - 1];
          const curr = rawPoints[i];
          const next = rawPoints[i + 1];

          if (curr.sharp) {
            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const len1 = Math.hypot(dx1, dy1);
            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            const len2 = Math.hypot(dx2, dy2);
            const r = Math.min(16, len1 * 0.45, len2 * 0.45);
            if (r > 1.5) {
              const bx = curr.x - (dx1 / len1) * r;
              const by = curr.y - (dy1 / len1) * r + offsetY;
              const ax = curr.x + (dx2 / len2) * r;
              const ay = curr.y + (dy2 / len2) * r + offsetY;
              ctx.lineTo(bx, by);
              ctx.quadraticCurveTo(curr.x, curr.y + offsetY, ax, ay);
              continue;
            }
          }
          ctx.lineTo(curr.x, curr.y + offsetY);
        }

        ctx.lineTo(Math.max(firstPt.x, lastPt.x - cliffRadius), lastPt.y + offsetY);
        ctx.quadraticCurveTo(lastPt.x, lastPt.y + offsetY, lastPt.x, lastPt.y + offsetY + cliffRadius);
        ctx.lineTo(lastPt.x, this.height + 10);
      };

      // 上面の草の帯だけを描くオープンパス（丸角反映）
      const traceGrassCurve = (offsetY = 0) => {
        ctx.moveTo(firstPt.x, firstPt.y + offsetY + cliffRadius * 0.85);
        ctx.quadraticCurveTo(firstPt.x, firstPt.y + offsetY, Math.min(firstPt.x + cliffRadius, lastPt.x), firstPt.y + offsetY);

        for (let i = 1; i < rawPoints.length - 1; i++) {
          const prev = rawPoints[i - 1];
          const curr = rawPoints[i];
          const next = rawPoints[i + 1];

          if (curr.sharp) {
            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const len1 = Math.hypot(dx1, dy1);
            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            const len2 = Math.hypot(dx2, dy2);
            const r = Math.min(16, len1 * 0.45, len2 * 0.45);
            if (r > 1.5) {
              const bx = curr.x - (dx1 / len1) * r;
              const by = curr.y - (dy1 / len1) * r + offsetY;
              const ax = curr.x + (dx2 / len2) * r;
              const ay = curr.y + (dy2 / len2) * r + offsetY;
              ctx.lineTo(bx, by);
              ctx.quadraticCurveTo(curr.x, curr.y + offsetY, ax, ay);
              continue;
            }
          }
          ctx.lineTo(curr.x, curr.y + offsetY);
        }

        ctx.lineTo(Math.max(firstPt.x, lastPt.x - cliffRadius), lastPt.y + offsetY);
        ctx.quadraticCurveTo(lastPt.x, lastPt.y + offsetY, lastPt.x, lastPt.y + offsetY + cliffRadius * 0.85);
      };

      ctx.save();

      // 1. 表土の柔らかい層（全体シルエット）
      const minY = Math.min(...rawPoints.map(p => p.y));
      const earthGrad = ctx.createLinearGradient(0, minY, 0, this.height);
      earthGrad.addColorStop(0, '#967754');
      earthGrad.addColorStop(0.18, '#745434');
      earthGrad.addColorStop(0.65, '#593d22');
      earthGrad.addColorStop(1, '#3b2614');
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      traceTopContour(0);
      ctx.closePath();
      ctx.fill();

      // 2. 深層の土の層（上端から14px下に丸くオフセット）
      ctx.fillStyle = 'rgba(72, 46, 24, 0.55)';
      ctx.beginPath();
      traceTopContour(14);
      ctx.closePath();
      ctx.fill();

      // 3. ふっくら丸みのある草緑の縁取り（2層重ねで立体的＆柔らかく）
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 草の影
      ctx.strokeStyle = '#3c5725';
      ctx.lineWidth = 10;
      ctx.beginPath();
      traceGrassCurve(3);
      ctx.stroke();

      // メインの苔緑
      ctx.strokeStyle = '#5c8239';
      ctx.lineWidth = 7;
      ctx.beginPath();
      traceGrassCurve(1);
      ctx.stroke();

      // 若草ハイライト
      ctx.strokeStyle = '#89b856';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      traceGrassCurve(-1);
      ctx.stroke();

      // 4. 地面の丸小石ディテール
      ctx.fillStyle = 'rgba(182, 156, 122, 0.55)';
      chunk.forEach(seg => {
        const sX = seg.x - camX;
        if (sX > this.width + 20 || sX + seg.width < -20) return;
        for (let dx = 28; dx < seg.width - 20; dx += 68 + Math.sin(seg.x + dx) * 18) {
          const stoneX = sX + dx;
          if (stoneX > -10 && stoneX < this.width + 10) {
            const gy = this.getGroundYAt(seg.x + dx);
            if (gy !== null) {
              ctx.beginPath();
              ctx.ellipse(stoneX, gy + 18, 5, 2.6, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      });

      // 5. 夜間のほのかな暗み馴染ませ
      if (envState && envState.nightWeight > 0.05) {
        ctx.fillStyle = `rgba(12, 16, 40, ${0.32 * envState.nightWeight})`;
        ctx.beginPath();
        traceTopContour(0);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    });
  }

  // =========================================================================
  // レンダリング (Render)
  // =========================================================================
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    const envState = this.getEnvironmentState();

    // 画面シェイク（踏みつけ・被弾・大跳躍の手応え演出）
    this.ctx.save();
    if (this.shakeTimer > 0 && this.shakeMagnitude > 0) {
      const sx = (Math.random() - 0.5) * this.shakeMagnitude * 2;
      const sy = (Math.random() - 0.5) * this.shakeMagnitude * 2;
      this.ctx.translate(sx, sy);
    }

    // 1. 背景パララックス描画（時間帯・天候変化連動）
    spriteManager.renderBackground(this.ctx, this.cameraX, this.width, this.height, this.isFever, envState);

    // 1b. 春一番の追い風ゾーン（背景寄りレイヤーに描画）
    this.windZones.forEach(zone => {
      const zX = zone.x - this.cameraX;
      if (zX > this.width + 50 || zX + zone.width < -50) return;
      spriteManager.renderWindZone(this.ctx, {
        x: zX,
        y: zone.y,
        width: zone.width,
        height: zone.height
      });
    });

    // 2. 丸みのある地形（坂道・高台・段差）描画
    this.renderTerrain(envState);

    // 2a. 季節ギミック: 崩れる古橋の描画
    this.crumblingBridges.forEach(bridge => {
      const bX = bridge.x - this.cameraX;
      if (bX > this.width + 60 || bX + bridge.width < -60) return;
      spriteManager.renderCrumblingBridge(this.ctx, {
        x: bX,
        y: bridge.y,
        width: bridge.width,
        height: bridge.height,
        state: bridge.state,
        fallDistance: bridge.fallDistance
      });
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

    // 9. 桜の花びら＆天候（ホタル・春雨）パーティクル
    const petalSpeed = (this.isFever ? 2.5 : 1.0) + Math.abs(this.player.vx) * 0.15;
    spriteManager.renderPetals(this.ctx, this.width, this.height, petalSpeed, envState, this.player.inWindZone);

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
