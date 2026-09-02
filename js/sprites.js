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
  // 背景パララックス描画
  // =========================================================================
  renderBackground(ctx, cameraX, width, height, isFever = false) {
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

    // フィーバー時の華やかな桜色オーバーレイ
    if (isFever) {
      ctx.fillStyle = 'rgba(255, 105, 180, 0.15)';
      ctx.fillRect(0, 0, width, height);
    }
  }

  // =========================================================================
  // 桜の花びらパーティクル描画
  // =========================================================================
  renderPetals(ctx, width, height, speedMultiplier = 1.0) {
    ctx.save();
    this.petals.forEach(p => {
      p.x += p.speedX * speedMultiplier;
      p.y += p.speedY * speedMultiplier;
      p.angle += p.angularSpeed;

      if (p.y > height + 20) {
        p.y = -20;
        p.x = Math.random() * width;
      }
      if (p.x > width + 20) {
        p.x = -20;
      }

      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      ctx.fillStyle = `rgba(255, 183, 197, ${p.opacity})`;
      ctx.beginPath();
      // 花びらの形（楕円）
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(-p.angle);
      ctx.translate(-p.x, -p.y);
    });
    ctx.restore();
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

    // ダッシュ時のスピード残像オーラ
    if (player.hasDash) {
      ctx.shadowColor = '#ffc857';
      ctx.shadowBlur = 20;
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
}

// シングルトンインスタンス
const spriteManager = new SpriteManager();
