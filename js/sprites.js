/**
 * 和菓子屋の女将さん ～ スプライト・ビジュアルレンダラー
 * 女将さんスプライト、和菓子アイテム、敵キャラクター、背景、エフェクト描画
 */

class SpriteManager {
  constructor() {
    this.loaded = false;
    this.images = {};
    
    // スプライトシート定義 (検出メタデータ)
    this.okamiFrames = {
      idle: [
        { x: 87, y: 69, w: 103, h: 191 },
        { x: 260, y: 70, w: 113, h: 190 },
        { x: 408, y: 70, w: 109, h: 190 },
        { x: 554, y: 70, w: 105, h: 190 },
        { x: 679, y: 70, w: 103, h: 190 }
      ],
      walk: [
        { x: 44, y: 314, w: 93, h: 166 },
        { x: 165, y: 314, w: 92, h: 166 },
        { x: 283, y: 314, w: 94, h: 166 },
        { x: 404, y: 301, w: 96, h: 179 },
        { x: 522, y: 301, w: 93, h: 179 },
        { x: 641, y: 314, w: 93, h: 166 },
        { x: 761, y: 314, w: 92, h: 166 },
        { x: 881, y: 314, w: 92, h: 166 }
      ],
      run: [
        { x: 48, y: 538, w: 98, h: 172 },
        { x: 168, y: 538, w: 97, h: 172 },
        { x: 286, y: 538, w: 98, h: 172 },
        { x: 403, y: 521, w: 101, h: 189 },
        { x: 523, y: 521, w: 100, h: 189 },
        { x: 644, y: 538, w: 100, h: 172 },
        { x: 764, y: 538, w: 97, h: 172 },
        { x: 883, y: 539, w: 98, h: 171 }
      ],
      jump: [
        { x: 31, y: 783, w: 130, h: 184 }, // 上昇
        { x: 163, y: 739, w: 107, h: 209 }, // 頂点
        { x: 290, y: 808, w: 115, h: 176 }  // 下降
      ],
      hit: [
        { x: 629, y: 756, w: 128, h: 227 }
      ],
      defeat: [
        { x: 783, y: 751, w: 210, h: 232 }
      ]
    };

    // アイテム定義
    this.itemFrames = {
      dango: { x: 60, y: 190, w: 280, h: 290 },
      daifuku: { x: 370, y: 210, w: 260, h: 240 },
      dorayaki: { x: 650, y: 220, w: 280, h: 230 },
      sakuramochi: { x: 370, y: 520, w: 270, h: 260 },
      konpeito: { x: 660, y: 530, w: 260, h: 250 }
    };

    // 敵定義
    this.enemyFrames = {
      tanuki: { x: 35, y: 290, w: 450, h: 420 },
      crow: { x: 540, y: 150, w: 380, h: 330 },
      barrel: { x: 550, y: 530, w: 360, h: 300 }
    };

    // 桜の花びらパーティクル
    this.petals = [];
    for (let i = 0; i < 35; i++) {
      this.petals.push({
        x: Math.random() * 500,
        y: Math.random() * 800,
        size: 5 + Math.random() * 7,
        speedX: 0.8 + Math.random() * 1.5,
        speedY: 1.2 + Math.random() * 2.0,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: (Math.random() - 0.5) * 0.05,
        opacity: 0.4 + Math.random() * 0.5
      });
    }

    // 夜桜のホタル（光粒）パーティクル
    this.fireflies = [];
    for (let i = 0; i < 22; i++) {
      this.fireflies.push({
        x: Math.random() * 480,
        y: 180 + Math.random() * 480,
        phase: Math.random() * Math.PI * 2,
        speedX: (Math.random() - 0.5) * 0.45,
        speedY: (Math.random() - 0.5) * 0.35,
        radius: 2 + Math.random() * 2.5
      });
    }

    // 春雨（しとしと雨粒）パーティクル
    this.raindrops = [];
    for (let i = 0; i < 55; i++) {
      this.raindrops.push({
        x: Math.random() * 500,
        y: Math.random() * 800,
        length: 12 + Math.random() * 12,
        speedY: 9 + Math.random() * 5,
        speedX: -2.2 - Math.random() * 1.2,
        opacity: 0.28 + Math.random() * 0.32
      });
    }

    // 夜空の星（固定シード配置）
    this.stars = [];
    for (let i = 0; i < 32; i++) {
      this.stars.push({
        x: (i * 73 + 29) % 450,
        y: 25 + ((i * 53 + 17) % 260),
        size: 1 + (i % 3) * 0.6,
        twinkleOffset: i * 0.9
      });
    }
  }

  // アセットの非同期プリロード
  async loadAssets() {
    const assetList = [
      { key: 'okami', src: 'assets/okami_sprites.png' },
      { key: 'gameBg', src: 'assets/game_bg.jpg' },
      { key: 'titleBg', src: 'assets/title_bg.jpg' },
      { key: 'items', src: 'assets/items.png' },
      { key: 'enemies', src: 'assets/enemies.png' }
    ];

    const promises = assetList.map(asset => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.images[asset.key] = img;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load ${asset.src}, continuing with fallback`);
          resolve();
        };
        img.src = asset.src;
      });
    });

    await Promise.all(promises);
    this.loaded = true;
  }

  // =========================================================================
  // 背景パララックス描画（時間帯・天候変化：春の昼 → 夕焼け → 夜桜提灯 → 春雨）
  // =========================================================================
  renderBackground(ctx, cameraX, width, height, isFever = false, env = null) {
    const bgImg = this.images['gameBg'];
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      // プレイ背景（パララックススクロール）
      const scrollFactor = 0.35;
      const bgWidth = height * (bgImg.naturalWidth / bgImg.naturalHeight);
      let offset = -(cameraX * scrollFactor) % bgWidth;
      if (offset > 0) offset -= bgWidth;

      // 継ぎ目なく描画
      ctx.drawImage(bgImg, offset, 0, bgWidth, height);
      if (offset + bgWidth < width) {
        ctx.drawImage(bgImg, offset + bgWidth - 1, 0, bgWidth, height);
      }
      if (offset + bgWidth * 2 < width) {
        ctx.drawImage(bgImg, offset + bgWidth * 2 - 2, 0, bgWidth, height);
      }
    } else {
      // フォールバック背景（美しい和風グラデーション）
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#8bc34a');
      grad.addColorStop(0.5, '#e0f7fa');
      grad.addColorStop(1, '#fffde7');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 時間帯・天候オーバーレイ（夕焼け・夜桜・春雨）
    if (env) {
      const { sunsetWeight = 0, nightWeight = 0, rainWeight = 0 } = env;

      // 1. 夕焼け（茜色〜琥珀色のグラデーション）
      if (sunsetWeight > 0.01) {
        ctx.save();
        const sGrad = ctx.createLinearGradient(0, 0, 0, height);
        sGrad.addColorStop(0, `rgba(180, 52, 48, ${0.42 * sunsetWeight})`);
        sGrad.addColorStop(0.45, `rgba(255, 132, 58, ${0.34 * sunsetWeight})`);
        sGrad.addColorStop(1, `rgba(255, 198, 110, ${0.18 * sunsetWeight})`);
        ctx.fillStyle = sGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      // 2. 夜桜と提灯（藍色の夜空＋星＋三日月＋沿道の提灯ぼんぼり）
      if (nightWeight > 0.01) {
        ctx.save();
        const nGrad = ctx.createLinearGradient(0, 0, 0, height);
        nGrad.addColorStop(0, `rgba(10, 16, 48, ${0.68 * nightWeight})`);
        nGrad.addColorStop(0.55, `rgba(22, 26, 68, ${0.56 * nightWeight})`);
        nGrad.addColorStop(1, `rgba(38, 28, 56, ${0.45 * nightWeight})`);
        ctx.fillStyle = nGrad;
        ctx.fillRect(0, 0, width, height);

        // 瞬く星空
        const now = Date.now() * 0.003;
        this.stars.forEach(s => {
          const twinkle = 0.45 + 0.55 * Math.sin(now + s.twinkleOffset);
          ctx.fillStyle = `rgba(255, 248, 215, ${twinkle * nightWeight * 0.85})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        });

        // 柔らかな満月
        const moonX = width - 78;
        const moonY = 128;
        const moonGlow = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 54);
        moonGlow.addColorStop(0, `rgba(255, 246, 200, ${0.55 * nightWeight})`);
        moonGlow.addColorStop(1, 'rgba(255, 246, 200, 0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 54, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 248, 218, ${0.9 * nightWeight})`;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
        ctx.fill();

        // 街道沿いの提灯（パララックス連動で背景にほのかに灯る）
        const lanternSpacing = 175;
        const lanternOffset = -(cameraX * 0.55) % lanternSpacing;
        for (let lx = lanternOffset - lanternSpacing; lx < width + lanternSpacing; lx += lanternSpacing) {
          const ly = 545 + Math.sin(lx * 0.02) * 8;
          // 提灯の温かい光輪
          const lGlow = ctx.createRadialGradient(lx, ly, 4, lx, ly, 46);
          lGlow.addColorStop(0, `rgba(255, 190, 95, ${0.5 * nightWeight})`);
          lGlow.addColorStop(0.5, `rgba(255, 130, 80, ${0.2 * nightWeight})`);
          lGlow.addColorStop(1, 'rgba(255, 130, 80, 0)');
          ctx.fillStyle = lGlow;
          ctx.beginPath();
          ctx.arc(lx, ly, 46, 0, Math.PI * 2);
          ctx.fill();

          // 提灯の支柱と本体
          ctx.strokeStyle = `rgba(50, 32, 22, ${0.75 * nightWeight})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(lx, ly + 12);
          ctx.lineTo(lx, height);
          ctx.stroke();

          ctx.fillStyle = `rgba(255, 210, 145, ${0.92 * nightWeight})`;
          ctx.strokeStyle = `rgba(180, 52, 42, ${0.9 * nightWeight})`;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 9, 13, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3. 春雨の朝霧（しっとり薄青の霧オーバーレイ）
      if (rainWeight > 0.01) {
        ctx.save();
        const rGrad = ctx.createLinearGradient(0, 0, 0, height);
        rGrad.addColorStop(0, `rgba(58, 86, 118, ${0.38 * rainWeight})`);
        rGrad.addColorStop(0.6, `rgba(110, 142, 165, ${0.24 * rainWeight})`);
        rGrad.addColorStop(1, `rgba(175, 200, 215, ${0.22 * rainWeight})`);
        ctx.fillStyle = rGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    }

    // フィーバー時の華やかな桜色オーバーレイ
    if (isFever) {
      ctx.fillStyle = 'rgba(255, 105, 180, 0.16)';
      ctx.fillRect(0, 0, width, height);
    }
  }

  // =========================================================================
  // 桜の花びら＆天候（ホタル・春雨）パーティクル描画
  // =========================================================================
  renderPetals(ctx, width, height, speedMultiplier = 1.0, env = null, inWindZone = false) {
    const nightWeight = env ? (env.nightWeight || 0) : 0;
    const rainWeight = env ? (env.rainWeight || 0) : 0;

    // 1. 桜の花びら（追い風ゾーン中は一気に右へ吹き抜ける！）
    ctx.save();
    this.petals.forEach(p => {
      const vxBoost = inWindZone ? 5.5 : 0;
      p.x += p.speedX * speedMultiplier + vxBoost;
      p.y += p.speedY * (inWindZone ? 0.5 : speedMultiplier);
      p.angle += p.angularSpeed * (inWindZone ? 2.5 : 1);

      if (p.y > height + 20) {
        p.y = -20;
        p.x = Math.random() * width;
      }
      if (p.x > width + 20) {
        p.x = -20;
        p.y = Math.random() * height;
      }

      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      const alpha = p.opacity * (1 - rainWeight * 0.45);
      ctx.fillStyle = nightWeight > 0.4
        ? `rgba(255, 210, 225, ${alpha})`
        : `rgba(255, 183, 197, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(-p.angle);
      ctx.translate(-p.x, -p.y);
    });
    ctx.restore();

    // 2. 夜桜のホタル（夜間にふわふわ輝く金色の光粒）
    if (nightWeight > 0.15) {
      ctx.save();
      this.fireflies.forEach(f => {
        f.phase += 0.055;
        f.x += f.speedX + Math.sin(f.phase * 0.7) * 0.35;
        f.y += f.speedY + Math.cos(f.phase * 0.6) * 0.25;
        if (f.x < -15) f.x = width + 15;
        if (f.x > width + 15) f.x = -15;
        if (f.y < 140) f.y = height - 120;
        if (f.y > height - 100) f.y = 160;

        const glowAlpha = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f.phase))) * nightWeight;
        const grad = ctx.createRadialGradient(f.x, f.y, 0.5, f.x, f.y, f.radius * 4);
        grad.addColorStop(0, `rgba(255, 250, 175, ${glowAlpha})`);
        grad.addColorStop(0.5, `rgba(220, 255, 130, ${glowAlpha * 0.45})`);
        grad.addColorStop(1, 'rgba(220, 255, 130, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius * 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // 3. 春雨（しとしと斜めに降る銀色の雨粒）
    if (rainWeight > 0.1) {
      ctx.save();
      ctx.lineCap = 'round';
      this.raindrops.forEach(r => {
        r.x += r.speedX + (inWindZone ? 5.0 : 0);
        r.y += r.speedY;
        if (r.y > height + 20) {
          r.y = -20;
          r.x = Math.random() * (width + 80);
        }
        if (r.x < -20) r.x = width + 20;
        if (r.x > width + 40) r.x = -10;

        ctx.strokeStyle = `rgba(215, 238, 255, ${r.opacity * rainWeight})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + (inWindZone ? 6 : -3), r.y + r.length);
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  // =========================================================================
  // 女将さん（プレイヤー）描画
  // =========================================================================
  renderPlayer(ctx, player) {
    const img = this.images['okami'];
    if (!img) return;

    let frames = this.okamiFrames[player.state] || this.okamiFrames.idle;
    let frameIdx = 0;

    if (player.state === 'walk' || player.state === 'run' || player.state === 'idle') {
      frameIdx = Math.floor(player.animTimer) % frames.length;
    } else if (player.state === 'jump') {
      // ジャンプ状態（上昇、頂点、下降）
      if (player.vy < -3) {
        frameIdx = 0; // 上昇
      } else if (Math.abs(player.vy) <= 3) {
        frameIdx = 1; // 頂点
      } else {
        frameIdx = 2; // 下降
      }
      frameIdx = Math.min(frameIdx, frames.length - 1);
    } else if (player.state === 'hit') {
      frameIdx = 0;
    } else if (player.state === 'defeat') {
      frameIdx = 0;
    }

    const frame = frames[frameIdx] || frames[0];

    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);

    // 向き反転 (左向きの場合)
    if (!player.facingRight) {
      ctx.scale(-1, 1);
    }

    // 無敵点滅 / 被弾エフェクト
    if (player.invincible && Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // ダッシュ時のスピード残像オーラ（終了間際は赤系に点滅して予告！）
    if (player.hasDash) {
      const isEnding = (player.dashTimer !== undefined && player.dashTimer <= 90);
      if (isEnding && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.shadowColor = '#ff5c5c';
        ctx.shadowBlur = 24;
      } else {
        ctx.shadowColor = '#ffc857';
        ctx.shadowBlur = 22;
      }
    } else if (player.isFever) {
      ctx.shadowColor = '#ff85a2';
      ctx.shadowBlur = 18;
    }

    // ふわふわ滞空ボーナス中のやわらか光輪
    if (player.floatTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 215, 102, 0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.ellipse(0, player.height * 0.45, player.width * 0.55, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 抹茶シールド（桜の回転バリア）
    if (player.hasShield) {
      ctx.save();
      ctx.strokeStyle = '#67923d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, player.height * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(103, 146, 61, 0.15)';
      ctx.fill();
      ctx.restore();
    }

    // スプライト描画
    const isDefeat = (player.state === 'defeat');
    const renderW = isDefeat ? player.width * 1.85 : player.width * 1.35;
    const renderH = isDefeat ? player.height * 1.45 : player.height * 1.25;
    const offsetY = isDefeat ? 6 : 0;

    ctx.drawImage(
      img,
      frame.x, frame.y, frame.w, frame.h,
      -renderW / 2, -renderH / 2 + offsetY,
      renderW, renderH
    );

    ctx.restore();
  }

  // =========================================================================
  // 和菓子アイテム描画
  // =========================================================================
  renderItem(ctx, item) {
    const img = this.images['items'];
    const frame = this.itemFrames[item.type] || this.itemFrames.dango;

    ctx.save();
    ctx.translate(item.x + item.width / 2, item.y + item.height / 2);

    // ふわふわ上下浮遊アニメーション
    const floatY = Math.sin(Date.now() / 200 + item.x) * 4;
    ctx.translate(0, floatY);

    // キラキラ光るエフェクト
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 12;

    if (img && img.complete) {
      ctx.drawImage(
        img,
        frame.x, frame.y, frame.w, frame.h,
        -item.width / 2, -item.height / 2,
        item.width, item.height
      );
    } else {
      // フォールバック絵文字
      ctx.font = `${item.width * 0.8}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const emojis = { dango: '🍡', daifuku: '🍵', dorayaki: '🥮', sakuramochi: '🌸', konpeito: '⭐' };
      ctx.fillText(emojis[item.type] || '🍡', 0, 0);
    }

    ctx.restore();
  }

  // =========================================================================
  // 敵キャラクター・障害物描画
  // =========================================================================
  renderEnemy(ctx, enemy) {
    const img = this.images['enemies'];
    const frame = this.enemyFrames[enemy.type] || this.enemyFrames.tanuki;

    ctx.save();
    ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);

    // 満足・退場アニメーション（笑顔で天に昇る/去る）
    if (enemy.isSatisfied) {
      ctx.globalAlpha = Math.max(0, 1 - (Date.now() - enemy.satisfiedTime) / 800);
      ctx.translate(0, -((Date.now() - enemy.satisfiedTime) / 10));
      ctx.scale(1.1, 1.1);

      ctx.font = '16px serif';
      ctx.fillStyle = '#ff69b4';
      ctx.fillText('🌸 美味しい！', -20, -enemy.height / 2 - 10);
    }

    // 樽の転がり回転
    if (enemy.type === 'barrel') {
      ctx.rotate(enemy.rotation || 0);
    } else if (enemy.vx < 0) {
      ctx.scale(-1, 1);
    }

    // タヌキのぴょん跳ね時の軽い伸縮表現
    if (enemy.type === 'tanuki' && enemy.hopVy !== undefined && enemy.hopOffsetY < -1) {
      ctx.scale(0.94, 1.07);
    }

    if (img && img.complete) {
      ctx.drawImage(
        img,
        frame.x, frame.y, frame.w, frame.h,
        -enemy.width / 2, -enemy.height / 2,
        enemy.width, enemy.height
      );
    } else {
      // フォールバック
      ctx.font = `${enemy.width * 0.8}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const emojis = { tanuki: '🦝', crow: '🦅', barrel: '🪵' };
      ctx.fillText(emojis[enemy.type] || '👾', 0, 0);
    }

    ctx.restore();
  }

  // =========================================================================
  // 投擲した和菓子（シュート弾）描画
  // =========================================================================
  renderProjectile(ctx, proj) {
    const img = this.images['items'];
    const frame = this.itemFrames['sakuramochi'];

    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.rotate(proj.rotation || 0);

    if (img && img.complete) {
      ctx.drawImage(
        img,
        frame.x, frame.y, frame.w, frame.h,
        -proj.size / 2, -proj.size / 2,
        proj.size, proj.size
      );
    } else {
      ctx.font = `${proj.size}px serif`;
      ctx.fillText('🌸', -proj.size / 2, proj.size / 2);
    }
    ctx.restore();
  }

  // =========================================================================
  // 足場（江戸宿場町・町家瓦屋根庇）描画
  // =========================================================================
  renderPlatform(ctx, plat) {
    const { x, y, width, height } = plat;
    if (width <= 0 || height <= 0) return;

    ctx.save();

    // 0. ドロップシャドウ（足場下の陰影）
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // 1. 木組みの持ち送り（両端下部の斜め支え梁）
    const bracketW = 14;
    const bracketH = 16;
    ctx.fillStyle = '#3e2718';
    ctx.strokeStyle = '#23150c';
    ctx.lineWidth = 1;

    // 左側持ち送り
    ctx.beginPath();
    ctx.moveTo(x + 10, y + height);
    ctx.lineTo(x + 10 + bracketW, y + height);
    ctx.lineTo(x + 6, y + height + bracketH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 右側持ち送り
    ctx.beginPath();
    ctx.moveTo(x + width - 10, y + height);
    ctx.lineTo(x + width - 10 - bracketW, y + height);
    ctx.lineTo(x + width - 6, y + height + bracketH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 持ち送りの飾り鋲（金）
    ctx.fillStyle = '#e5a93b';
    ctx.beginPath();
    ctx.arc(x + 10, y + height + 6, 2, 0, Math.PI * 2);
    ctx.arc(x + width - 10, y + height + 6, 2, 0, Math.PI * 2);
    ctx.fill();

    // 影のリセット
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 2. 軒裏（木製の垂木構造・幕板）
    const woodTop = y + height - 7;
    const woodH = 7;
    const woodGrad = ctx.createLinearGradient(x, woodTop, x, woodTop + woodH);
    woodGrad.addColorStop(0, '#5a3d28');
    woodGrad.addColorStop(1, '#2c1a0f');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(x + 4, woodTop, width - 8, woodH);

    // 垂木（等間隔に並ぶ木の角材断面）
    const rafterSpacing = 16;
    ctx.fillStyle = '#7a5438';
    ctx.strokeStyle = '#24140a';
    ctx.lineWidth = 0.8;
    for (let rx = x + 12; rx < x + width - 12; rx += rafterSpacing) {
      ctx.fillRect(rx - 3, woodTop + 1, 6, woodH - 1);
      ctx.strokeRect(rx - 3, woodTop + 1, 6, woodH - 1);
    }

    // 3. 瓦屋根本体（反り上がりのある本瓦・いぶし瓦）
    const roofH = height - 3;
    const curveOffset = 3.5; // 端の反り上がり量

    // 屋根ベースのパス（両端が少し反り上がった優美な和瓦形状）
    ctx.beginPath();
    ctx.moveTo(x - 4, y - curveOffset); // 左端反り
    ctx.quadraticCurveTo(x + width * 0.15, y, x + width * 0.5, y); // 中央へ
    ctx.quadraticCurveTo(x + width * 0.85, y, x + width + 4, y - curveOffset); // 右端反り
    ctx.lineTo(x + width + 3, y + roofH);
    ctx.lineTo(x - 3, y + roofH);
    ctx.closePath();

    // 瓦のベースグラデーション（いぶし銀・黒藍の重厚な質感）
    const tileGrad = ctx.createLinearGradient(x, y - curveOffset, x, y + roofH);
    tileGrad.addColorStop(0, '#4e5b66');   // 最上部ハイライト
    tileGrad.addColorStop(0.2, '#38434d'); // 瓦の光沢
    tileGrad.addColorStop(0.7, '#242b32'); // 本瓦の黒藍
    tileGrad.addColorStop(1, '#15191d');   // 軒先シャドウ
    ctx.fillStyle = tileGrad;
    ctx.fill();

    // 瓦の縦筋（男瓦・女瓦の立体的なリブと光沢）
    const tileWidth = 16;
    const numTiles = Math.floor(width / tileWidth);
    const startTileX = x + (width % tileWidth) / 2;

    ctx.save();
    // 屋根内部にクリップして瓦を描画
    ctx.clip();

    for (let tx = startTileX; tx < x + width; tx += tileWidth) {
      // 女瓦の影（窪み）
      ctx.fillStyle = 'rgba(10, 15, 20, 0.6)';
      ctx.fillRect(tx, y - 5, 3, roofH + 10);

      // 男瓦（丸瓦の盛り上がりグラデーション）
      const ridgeGrad = ctx.createLinearGradient(tx + 3, y, tx + tileWidth, y);
      ridgeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)'); // 左側ハイライト
      ridgeGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)');
      ridgeGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.2)');
      ridgeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');      // 右側シャドウ
      ctx.fillStyle = ridgeGrad;
      ctx.fillRect(tx + 3, y - 5, tileWidth - 3, roofH + 10);
    }
    ctx.restore();

    // 4. 軒丸瓦（巴瓦・軒先の半円装飾）
    ctx.fillStyle = '#1c2227';
    ctx.strokeStyle = '#3d4852';
    ctx.lineWidth = 1;
    for (let tx = startTileX + 8; tx < x + width - 4; tx += tileWidth) {
      ctx.beginPath();
      ctx.arc(tx, y + roofH - 1, 4.5, 0, Math.PI);
      ctx.fill();
      ctx.stroke();

      // 巴瓦の芯（小さな真鍮ゴールドの鋲）
      ctx.fillStyle = '#d4a340';
      ctx.beginPath();
      ctx.arc(tx, y + roofH + 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c2227';
    }

    // 5. 軒先の金縁・真鍮幕板（視認性と高級感）
    ctx.strokeStyle = '#e5a93b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 3, y + roofH);
    ctx.lineTo(x + width + 3, y + roofH);
    ctx.stroke();

    // 6. 屋根上面の足場エッジ（着地判定ライン・月の光彩）
    ctx.strokeStyle = 'rgba(255, 220, 140, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - curveOffset);
    ctx.quadraticCurveTo(x + width * 0.15, y, x + width * 0.5, y);
    ctx.quadraticCurveTo(x + width * 0.85, y, x + width + 4, y - curveOffset);
    ctx.stroke();

    // 7. 左右の端部（鬼板・漆塗りと飾り金物）
    const renderEndCap = (capX, isLeft) => {
      ctx.fillStyle = '#181d22';
      ctx.strokeStyle = '#e5a93b';
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      const dir = isLeft ? -1 : 1;
      ctx.moveTo(capX, y - curveOffset - 3);
      ctx.lineTo(capX + dir * 5, y - curveOffset + 1);
      ctx.lineTo(capX + dir * 3, y + roofH + 1);
      ctx.lineTo(capX, y + roofH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 端の金飾り鋲
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(capX + dir * 2, y - curveOffset + 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
    };

    renderEndCap(x - 3, true);
    renderEndCap(x + width + 3, false);

    // 8. 舞い落ちた桜の花びら（風情あるアクセント）
    ctx.save();
    // 瓦の上にそっと乗った桜の花びら（位置は足場のX座標に基づいて安定決定）
    const petalOffsetX = 18 + ((Math.abs(Math.sin((plat.baseX || x) * 12.9898)) * (width - 40)));
    const petalY = y + 1;
    ctx.translate(x + petalOffsetX, petalY);
    ctx.rotate(0.35 + Math.sin(x) * 0.4);
    ctx.fillStyle = '#ffb7c5';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff85a2';
    ctx.beginPath();
    ctx.ellipse(1, 0, 2, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 9. 動く足場（左右に揺れる瓦屋根）専用の和風装飾（風鈴・金房）
    if (plat.isMoving) {
      const swingAngle = Math.sin(plat.movePhase || 0) * 0.35;

      const drawWindChime = (chimeX) => {
        ctx.save();
        ctx.translate(chimeX, y + height + 2);
        ctx.rotate(swingAngle);

        // 吊り紐（朱色）
        ctx.strokeStyle = '#e63946';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 6);
        ctx.stroke();

        // 鈴（真鍮ゴールド）
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#c7921a';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, 8, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 短冊・飾り房（桜色・風になびく）
        ctx.fillStyle = '#ffb7c5';
        ctx.strokeStyle = '#e63946';
        ctx.lineWidth = 0.6;
        ctx.fillRect(-2, 11, 4, 10);
        ctx.strokeRect(-2, 11, 4, 10);

        ctx.restore();
      };

      drawWindChime(x + 10);
      drawWindChime(x + width - 10);
    }

    ctx.restore();
  }

  // =========================================================================
  // ギミック（餅つきの大臼トランポリン）描画
  // =========================================================================
  renderSpring(ctx, spring) {
    ctx.save();
    ctx.translate(spring.x + spring.width / 2, spring.y + spring.height / 2);

    // 臼の本体（木目調）
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath();
    ctx.roundRect(-spring.width / 2, -spring.height / 2, spring.width, spring.height, 8);
    ctx.fill();
    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 臼の中の餅
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, -spring.height / 4, spring.width * 0.35, spring.height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // 文字
    ctx.font = 'bold 12px "Noto Serif JP", serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('大臼', 0, spring.height / 3);

    ctx.restore();
  }

  // =========================================================================
  // 画面右端の敵接近アラート（予兆テレグラフ）描画
  // =========================================================================
  renderWarning(ctx, y, type, canvasWidth) {
    const clampedY = Math.max(150, Math.min(640, y));
    const pulse = 0.88 + Math.sin(Date.now() / 75) * 0.12;
    const badgeX = canvasWidth - 26;

    ctx.save();
    ctx.translate(badgeX, clampedY);
    ctx.scale(pulse, pulse);

    // 外枠バッジ（和風の朱色＆金縁）
    ctx.fillStyle = type === 'crow' ? 'rgba(199, 55, 47, 0.9)' : 'rgba(214, 118, 28, 0.92)';
    ctx.strokeStyle = '#ffdf9e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 左向き三角矢印（右から来ることを示す）
    ctx.fillStyle = '#ffdf9e';
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(-17, -6);
    ctx.lineTo(-17, 6);
    ctx.closePath();
    ctx.fill();

    // ラベル
    ctx.font = 'bold 12px "Zen Maru Gothic", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type === 'crow' ? '鴉!' : '樽!', 0, 1);

    ctx.restore();
  }

  // =========================================================================
  // 季節のギミック1: 崩れる古橋（古びた木橋・乗ると揺れて崩落！）描画
  // =========================================================================
  renderCrumblingBridge(ctx, bridge) {
    if (bridge.state === 'broken') return;

    const shakeX = bridge.state === 'shaking' ? (Math.random() - 0.5) * 5.5 : 0;
    const shakeY = bridge.state === 'shaking' ? (Math.random() - 0.5) * 3.0 : 0;
    const bx = bridge.x + shakeX;
    const by = bridge.y + shakeY;
    const { width, height } = bridge;

    ctx.save();
    if (bridge.state === 'falling') {
      ctx.globalAlpha = Math.max(0.15, 1 - (bridge.fallDistance || 0) / 160);
    }

    // 橋下の丸い木梁（アーチ状にわずかに反った太鼓橋風）
    ctx.strokeStyle = '#4a311e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx + 6, by + height + 3);
    ctx.quadraticCurveTo(bx + width / 2, by + height - 6, bx + width - 6, by + height + 3);
    ctx.stroke();

    // 踏み板（年季の入った木の板を並べて表現）
    const plankCount = Math.max(4, Math.floor(width / 18));
    const plankW = width / plankCount;
    for (let i = 0; i < plankCount; i++) {
      const px = bx + i * plankW;
      const crackDrop = (bridge.state === 'shaking' && i % 2 === 1) ? 2 : 0;
      const grad = ctx.createLinearGradient(px, by, px, by + height);
      grad.addColorStop(0, bridge.state === 'shaking' ? '#b8834d' : '#9c6e42');
      grad.addColorStop(1, '#5a3a1e');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(px + 1, by + crackDrop, plankW - 2, height, 4);
      ctx.fill();

      ctx.strokeStyle = '#3b2412';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 古びた縄の結び目（両端と中央）
      if (i === 0 || i === plankCount - 1 || i === Math.floor(plankCount / 2)) {
        ctx.strokeStyle = '#d4b483';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + plankW * 0.5, by);
        ctx.lineTo(px + plankW * 0.5, by + height);
        ctx.stroke();
      }
    }

    // ぐらつき中は上部に警告のヒビ＆砂埃サイン
    if (bridge.state === 'shaking') {
      ctx.font = 'bold 12px "Zen Maru Gothic", sans-serif';
      ctx.fillStyle = '#ffe082';
      ctx.strokeStyle = '#3b1e08';
      ctx.lineWidth = 2.5;
      ctx.textAlign = 'center';
      ctx.strokeText('グラッ!', bx + width / 2, by - 7);
      ctx.fillText('グラッ!', bx + width / 2, by - 7);
    }

    ctx.restore();
  }

  // =========================================================================
  // 季節のギミック2: 春一番の追い風ゾーン（桜吹雪の突風エリア）描画
  // =========================================================================
  renderWindZone(ctx, zone) {
    const { x, y, width, height } = zone;
    const t = Date.now() * 0.006;

    ctx.save();

    // 淡く爽やかな追い風エアカーテン
    const grad = ctx.createLinearGradient(x, y, x + width, y);
    grad.addColorStop(0, 'rgba(255, 220, 232, 0.02)');
    grad.addColorStop(0.2, 'rgba(255, 232, 240, 0.16)');
    grad.addColorStop(0.8, 'rgba(255, 232, 240, 0.16)');
    grad.addColorStop(1, 'rgba(255, 220, 232, 0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 18);
    ctx.fill();

    // 右向きに勢いよく流れる風の流線（ストリームライン）
    ctx.lineCap = 'round';
    for (let row = 0; row < 5; row++) {
      const lineY = y + 26 + row * ((height - 50) / 4);
      const speed = 110 + (row % 3) * 35;
      const offset = ((t * speed + row * 70) % (width + 60)) - 40;
      const segStartX = Math.max(x + 8, x + offset);
      const segEndX = Math.min(x + width - 8, x + offset + 58);

      if (segEndX > segStartX + 8) {
        const waveY = Math.sin(t * 2 + row) * 4;
        ctx.strokeStyle = row % 2 === 0 ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 183, 197, 0.65)';
        ctx.lineWidth = row % 2 === 0 ? 2.4 : 1.8;
        ctx.beginPath();
        ctx.moveTo(segStartX, lineY + waveY);
        ctx.quadraticCurveTo((segStartX + segEndX) / 2, lineY - waveY, segEndX, lineY + waveY * 0.5);
        ctx.stroke();

        // 流線の先端に小さな風矢印
        ctx.beginPath();
        ctx.moveTo(segEndX - 5, lineY + waveY * 0.5 - 3.5);
        ctx.lineTo(segEndX, lineY + waveY * 0.5);
        ctx.lineTo(segEndX - 5, lineY + waveY * 0.5 + 3.5);
        ctx.stroke();
      }
    }

    // ゾーン入口上部の小さな和風ラベル
    ctx.font = 'bold 11px "Zen Maru Gothic", sans-serif';
    ctx.fillStyle = 'rgba(255, 245, 250, 0.9)';
    ctx.strokeStyle = 'rgba(130, 45, 70, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.textAlign = 'center';
    ctx.strokeText('🌬️ 春一番 追い風 >>>', x + width / 2, y + 14);
    ctx.fillText('🌬️ 春一番 追い風 >>>', x + width / 2, y + 14);

    ctx.restore();
  }
}

// シングルトンインスタンス
const spriteManager = new SpriteManager();
