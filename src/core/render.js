/**
 * Canvas2D 像素画笔：只负责把世界状态画出来，不含任何玩法规则。
 * 和《地牢围攻》一样，核心玩法与渲染彻底分开，换画面不用碰逻辑。
 *
 * 坐标系：左上角为原点，y 向下；每个地块大小由 layout.tile 决定。
 */

import { TILE, DIRS } from './world.js';
import { getSprite } from './sprites.js';

/** 调色板：统一放在这里，换皮只要改这一块。 */
const C = {
  grass1: '#7cc14e',
  grass2: '#71b747',
  grassDark: '#5aa038',
  grassLight: '#96d466',
  soil: '#a9683c',
  soilDark: '#8a5330',
  soilLight: '#c07f4c',
  seedGreen: '#8fe06a',
  wheatGold: '#f0c34a',
  wheatDark: '#d09a2c',
  wheatLight: '#ffe08a',
  wood: '#b1743c',
  woodDark: '#7c4a24',
  woodLight: '#d69a58',
  roof: '#c8483c',
  roofDark: '#95322a',
  roofLight: '#e06a52',
  wall: '#e8d8a8',
  wallDark: '#bda878',
  stone1: '#8d949c',
  stone2: '#6f767e',
  water1: '#4aa8d8',
  water2: '#2f86b8',
  waterLight: '#8fd4ef',
  shadow: 'rgba(40, 30, 20, 0.22)',
  skin: '#f3c091',
  skinDark: '#d99a63',
  shirt: '#4f8fd6',
  shirtDark: '#356aa8',
  pants: '#3f4c66',
  boot: '#6b4526',
  hat: '#e5b95c',
  hatDark: '#b98a34',
  chicken: '#fdf6e6',
  cow: '#fbf6ee',
  cowDark: '#3a3a3a',
  black: '#2c2418',
};

/** 画一个像素方块。 */
function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** 稳定的伪随机：同一个格子每次画出来都一样。 */
function hash(x, y) {
  let h = 2166136261 ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// ------------------------------------------------------------------ 地块

/** 用 MCP 生成的 256×256 单帧贴图；未加载时返回 false，继续走像素画兜底。 */
function drawTileSprite(ctx, key, x, y, s) {
  const image = getSprite(key);
  if (!image) return false;
  ctx.drawImage(image, x, y, s, s);
  return true;
}

function drawGrass(ctx, x, y, s, tx, ty) {
  const grass = getSprite('grass');
  if (grass) {
    // 奇偶格镜像铺贴，让纹理边界自然衔接，不会形成明显网格缝。
    const flipX = tx % 2 === 1;
    const flipY = ty % 2 === 1;
    ctx.save();
    ctx.translate(flipX ? x + s : x, flipY ? y + s : y);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(grass, 0, 0, s, s);
    ctx.restore();
    return;
  }

  const checker = (tx + ty) % 2 === 0;
  px(ctx, x, y, s, s, checker ? C.grass1 : C.grass2);

  for (let i = 0; i < 4; i += 1) {
    const a = hash(tx * 13 + i, ty * 7 + i);
    const b = hash(tx * 5 + i * 3, ty * 11 + i);
    const gx = x + a * (s - 6);
    const gy = y + b * (s - 6);
    const big = a > 0.72;
    px(ctx, gx, gy, big ? 4 : 3, big ? 4 : 3, C.grassDark);
    px(ctx, gx, gy - 2, 2, 2, C.grassLight);
  }

  // 偶尔开一朵小花，让草地不那么单调。
  const flower = hash(tx * 31, ty * 17);
  if (flower > 0.9) {
    const fx = x + s * 0.55;
    const fy = y + s * 0.6;
    px(ctx, fx, fy, 3, 3, flower > 0.96 ? '#f5f0a8' : '#f7f7f7');
    px(ctx, fx + 1, fy - 2, 2, 2, '#ffffff');
  }
}

function drawSoil(ctx, x, y, s, watered = false) {
  if (drawTileSprite(ctx, 'soil', x, y, s)) {
    if (watered) {
      ctx.fillStyle = 'rgba(70, 105, 145, 0.22)';
      ctx.fillRect(x, y, s, s);
    }
    return;
  }

  px(ctx, x, y, s, s, watered ? '#8b5330' : C.soil);
  px(ctx, x, y, s, 2, C.soilLight);
  px(ctx, x, y + s - 3, s, 3, C.soilDark);

  const rows = 4;
  for (let i = 0; i < rows; i += 1) {
    const ry = y + 5 + i * ((s - 10) / rows);
    px(ctx, x + 3, ry, s - 6, 2, watered ? '#6d3f24' : C.soilDark);
    px(ctx, x + 5, ry + 2, s - 12, 1, watered ? '#9c6039' : C.soilLight);
  }
}

function drawSeedling(ctx, x, y, s, t) {
  if (drawTileSprite(ctx, 'seedling', x, y, s)) return;

  drawSoil(ctx, x, y, s, true);
  const cx = x + s / 2;
  const cy = y + s * 0.62;
  const sway = Math.sin(t * 2.4) * s * 0.02;
  px(ctx, cx - 1, cy - s * 0.18, 3, s * 0.22, '#4f8a34');
  px(ctx, cx - s * 0.16 + sway, cy - s * 0.24, s * 0.16, 4, C.seedGreen);
  px(ctx, cx + 1 + sway, cy - s * 0.2, s * 0.16, 4, C.seedGreen);
}

function drawWheat(ctx, x, y, s, t) {
  if (drawTileSprite(ctx, 'wheat', x, y, s)) return;

  px(ctx, x, y, s, s, '#b77b42');
  const stalks = 4;
  for (let i = 0; i < stalks; i += 1) {
    const col = x + 4 + i * ((s - 8) / stalks);
    const sway = Math.sin(t * 1.8 + i) * 1.6;
    px(ctx, col + sway, y + s * 0.28, 2, s * 0.5, '#7fa53a');
    // 麦穗
    px(ctx, col - 2 + sway, y + s * 0.18, 6, 3, C.wheatGold);
    px(ctx, col - 2 + sway, y + s * 0.26, 6, 3, C.wheatDark);
    px(ctx, col - 1 + sway, y + s * 0.12, 4, 3, C.wheatLight);
    // 麦芒
    px(ctx, col - 3 + sway, y + s * 0.1, 2, 3, C.wheatLight);
    px(ctx, col + 3 + sway, y + s * 0.1, 2, 3, C.wheatLight);
  }
}

function drawFenceFallbackSegment(ctx, x, y, s) {
  const post = s * 0.16;
  for (let i = 0; i < 2; i += 1) {
    const fx = x + s * (0.22 + i * 0.5) - post / 2;
    px(ctx, fx, y + s * 0.12, post, s * 0.76, C.woodDark);
    px(ctx, fx + 2, y + s * 0.12, post - 4, s * 0.7, C.wood);
  }
  px(ctx, x, y + s * 0.34, s, 5, C.wood);
  px(ctx, x, y + s * 0.56, s, 5, C.wood);
  px(ctx, x, y + s * 0.34, s, 2, C.woodLight);
  px(ctx, x, y + s * 0.56, s, 2, C.woodLight);
}

function drawFenceSegment(ctx, image, x, y, s, vertical) {
  ctx.save();
  if (vertical) {
    ctx.translate(x + s, y);
    ctx.rotate(Math.PI / 2);
    if (image) ctx.drawImage(image, 0, 0, s, s);
    else drawFenceFallbackSegment(ctx, 0, 0, s);
  } else if (image) {
    ctx.drawImage(image, x, y, s, s);
  } else {
    drawFenceFallbackSegment(ctx, x, y, s);
  }
  ctx.restore();
}

function drawFence(ctx, x, y, s, tx, ty, horizontal, vertical) {
  drawGrass(ctx, x, y, s, tx, ty);
  const image = getSprite('fence');
  if (!horizontal && !vertical) horizontal = true;
  if (horizontal) drawFenceSegment(ctx, image, x, y, s, false);
  if (vertical) drawFenceSegment(ctx, image, x, y, s, true);
}

function drawTree(ctx, x, y, s, tx, ty) {
  drawGrass(ctx, x, y, s, tx, ty);
  if (drawTileSprite(ctx, 'tree', x, y, s)) return;

  const cx = x + s / 2;
  px(ctx, cx - s * 0.09, y + s * 0.5, s * 0.18, s * 0.4, '#7a4a24');
  px(ctx, cx - s * 0.09, y + s * 0.5, s * 0.06, s * 0.4, '#9a6132');
  const leaf = '#3f8a34';
  const leafDark = '#2f6b28';
  const leafLight = '#57a743';
  px(ctx, cx - s * 0.36, y + s * 0.08, s * 0.72, s * 0.5, leafDark);
  px(ctx, cx - s * 0.44, y + s * 0.2, s * 0.88, s * 0.3, leaf);
  px(ctx, cx - s * 0.3, y + s * 0.02, s * 0.56, s * 0.24, leaf);
  px(ctx, cx - s * 0.26, y + s * 0.06, s * 0.3, s * 0.16, leafLight);
  px(ctx, cx + s * 0.02, y + s * 0.3, s * 0.2, s * 0.12, leafLight);
}

function drawRock(ctx, x, y, s, tx, ty) {
  drawGrass(ctx, x, y, s, tx, ty);
  if (drawTileSprite(ctx, 'rock', x, y, s)) return;

  px(ctx, x + s * 0.18, y + s * 0.42, s * 0.64, s * 0.42, C.stone2);
  px(ctx, x + s * 0.26, y + s * 0.26, s * 0.5, s * 0.4, C.stone1);
  px(ctx, x + s * 0.32, y + s * 0.3, s * 0.2, s * 0.12, '#b6bcc2');
  px(ctx, x + s * 0.24, y + s * 0.7, s * 0.6, s * 0.12, C.stone2);
}

function drawWater(ctx, x, y, s, t) {
  if (drawTileSprite(ctx, 'water', x, y, s)) return;

  px(ctx, x, y, s, s, C.water2);
  const ripple = Math.sin(t * 2) * 2;
  px(ctx, x + 3 + ripple, y + s * 0.28, s * 0.34, 3, C.waterLight);
  px(ctx, x + s * 0.5 - ripple, y + s * 0.5, s * 0.36, 3, C.water1);
  px(ctx, x + s * 0.2 + ripple, y + s * 0.72, s * 0.3, 3, C.waterLight);
  // 石砌边沿
  px(ctx, x, y, s, 4, C.stone1);
  px(ctx, x, y + s - 4, s, 4, C.stone2);
  px(ctx, x, y, 4, s, C.stone1);
  px(ctx, x + s - 4, y, 4, s, C.stone2);
}

function drawWell(ctx, x, y, s, tx, ty) {
  drawGrass(ctx, x, y, s, tx, ty);
  if (drawTileSprite(ctx, 'well', x, y, s)) return;

  px(ctx, x + s * 0.2, y + s * 0.48, s * 0.6, s * 0.4, C.stone2);
  px(ctx, x + s * 0.24, y + s * 0.52, s * 0.52, s * 0.3, C.water2);
  px(ctx, x + s * 0.3, y + s * 0.58, s * 0.24, 3, C.waterLight);
  px(ctx, x + s * 0.16, y + s * 0.44, s * 0.68, 5, C.stone1);
  px(ctx, x + s * 0.24, y + s * 0.2, 5, s * 0.34, C.woodDark);
  px(ctx, x + s * 0.7, y + s * 0.2, 5, s * 0.34, C.woodDark);
  px(ctx, x + s * 0.2, y + s * 0.12, s * 0.6, 6, C.roofDark);
  px(ctx, x + s * 0.26, y + s * 0.06, s * 0.48, 6, C.roof);
}

function drawHouse(ctx, x, y, s, tx, ty, drawGround = true) {
  if (drawGround) drawGrass(ctx, x, y, s, tx, ty);
  if (drawTileSprite(ctx, 'house', x, y, s)) return;

  const w = s * 0.86;
  const hx = x + s * 0.07;
  const hy = y + s * 0.34;
  px(ctx, hx, hy, w, s * 0.58, C.wall);
  px(ctx, hx, hy, w, 3, C.wallDark);
  px(ctx, hx + w * 0.1, hy + s * 0.18, s * 0.22, s * 0.22, '#8fd0e8');
  px(ctx, hx + w * 0.1, hy + s * 0.18, s * 0.22, 3, C.woodDark);
  px(ctx, hx + w * 0.56, hy + s * 0.2, s * 0.2, s * 0.38, C.woodDark);
  px(ctx, hx + w * 0.58, hy + s * 0.22, s * 0.16, s * 0.34, C.wood);
  // 红色屋顶
  px(ctx, hx, y + s * 0.24, w, 6, C.roofDark);
  px(ctx, hx + s * 0.04, y + s * 0.14, w - s * 0.08, 6, C.roof);
  px(ctx, hx + s * 0.14, y + s * 0.06, w - s * 0.28, 6, C.roofLight);
}

function drawBarn(ctx, x, y, s, tx, ty, drawGround = true) {
  if (drawGround) drawGrass(ctx, x, y, s, tx, ty);
  if (drawTileSprite(ctx, 'barn', x, y, s)) return;

  const w = s * 0.9;
  const bx = x + s * 0.05;
  px(ctx, bx, y + s * 0.32, w, s * 0.6, '#b8534a');
  px(ctx, bx + s * 0.12, y + s * 0.48, w - s * 0.24, s * 0.44, C.woodDark);
  px(ctx, bx, y + s * 0.2, w, 7, C.roofDark);
  px(ctx, bx + s * 0.05, y + s * 0.1, w - s * 0.1, 7, C.roof);
  px(ctx, bx + s * 0.2, y + s * 0.02, w - s * 0.4, 6, C.roofLight);
  px(ctx, bx + s * 0.1, y + s * 0.62, 3, s * 0.3, '#e8d8a8');
}

function drawCoop(ctx, x, y, s, tx, ty, drawGround = true) {
  if (drawGround) drawGrass(ctx, x, y, s, tx, ty);
  if (drawTileSprite(ctx, 'coop', x, y, s)) return;

  const w = s * 0.74;
  const cx = x + s * 0.13;
  px(ctx, cx, y + s * 0.4, w, s * 0.5, '#f0dca6');
  px(ctx, cx, y + s * 0.28, w, 6, C.roofDark);
  px(ctx, cx + s * 0.06, y + s * 0.18, w - s * 0.12, 6, C.roof);
  px(ctx, cx + s * 0.2, y + s * 0.5, w - s * 0.4, s * 0.4, C.woodDark);
}

/** 多格建筑按自身占位绘制；图片加载失败时退回 Canvas 像素画。 */
function drawStructure(ctx, structure, x, y, tile) {
  const size = tile * structure.width;
  const image = getSprite(structure.kind);
  if (image) {
    ctx.drawImage(image, x, y, size, tile * structure.height);
    return;
  }
  if (structure.kind === TILE.HOUSE) drawHouse(ctx, x, y, size, structure.x, structure.y, false);
  else if (structure.kind === TILE.BARN) drawBarn(ctx, x, y, size, structure.x, structure.y, false);
  else if (structure.kind === TILE.COOP) drawCoop(ctx, x, y, size, structure.x, structure.y, false);
}

// ------------------------------------------------------------------ 角色

function drawHeroFallback(ctx, x, y, s, facing, t, walking) {
  const bob = walking ? Math.sin(t * 18) * s * 0.05 : 0;
  const u = s / 12; // 一个像素单位
  const baseX = x + s * 0.5;
  const baseY = y + s * 0.86 + bob;

  // 影子
  ctx.fillStyle = C.shadow;
  ctx.beginPath();
  ctx.ellipse(baseX, y + s * 0.88, s * 0.24, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  const pxu = (ox, oy, w, h, color) => px(ctx, baseX + ox * u - (w * u) / 2, baseY + oy * u - h * u, w * u, h * u, color);

  const back = facing === 0;
  const side = facing === 1 ? 1 : facing === 3 ? -1 : 0;

  // 腿
  pxu(-0.22, 0, 0.16, 0.5, C.pants);
  pxu(0.22, 0, 0.16, 0.5, C.pants);
  pxu(-0.24, -0.3, 0.2, 0.3, C.boot);
  pxu(0.24, -0.3, 0.2, 0.3, C.boot);

  // 身体
  pxu(0, -1.15, 0.66, 0.85, C.shirtDark);
  pxu(0, -1.2, 0.58, 0.8, C.shirt);
  pxu(0, -1.0, 0.5, 0.55, '#e9f1fb');

  // 手臂
  pxu(-0.4, -1.1, 0.18, 0.6, C.shirtDark);
  pxu(0.4, -1.1, 0.18, 0.6, C.shirtDark);
  pxu(-0.4, -0.55, 0.18, 0.18, C.skin);
  pxu(0.4, -0.55, 0.18, 0.18, C.skin);

  // 头
  pxu(0, -1.85, 0.62, 0.62, C.skin);
  pxu(0, -1.85, 0.62, 0.18, C.skinDark);

  if (!back) {
    if (side === 0) {
      pxu(-0.15, -1.7, 0.1, 0.12, C.black);
      pxu(0.15, -1.7, 0.1, 0.12, C.black);
    } else {
      pxu(side * 0.18, -1.7, 0.1, 0.12, C.black);
    }
    pxu(0, -1.45, 0.2, 0.08, '#c96f5a');
  }

  // 草帽
  pxu(0, -2.0, 0.9, 0.16, C.hatDark);
  pxu(0, -2.16, 0.6, 0.2, C.hat);
  pxu(0, -2.3, 0.4, 0.16, C.hat);
}

function drawSpriteShadow(ctx, x, y, s, width = 0.32) {
  ctx.fillStyle = C.shadow;
  ctx.beginPath();
  ctx.ellipse(x + s / 2, y + s * 0.87, s * width, s * 0.075, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSprite(ctx, image, x, y, s, { width, height, bottom = 0.88, bob = 0 } = {}) {
  if (!image) return false;
  const w = s * width;
  const h = s * (height ?? width);
  ctx.drawImage(image, x + (s - w) / 2, y + s * bottom - h + bob, w, h);
  return true;
}

function drawHero(ctx, x, y, s, facing, t, walking, kind = 'boy') {
  const image = getSprite(kind === 'girl' ? 'heroGirl' : 'heroBoy');
  if (!image) {
    drawHeroFallback(ctx, x, y, s, facing, t, walking);
    return;
  }

  const frameWidth = image.naturalWidth / 4;
  const frameHeight = image.naturalHeight;
  const bob = walking ? Math.sin(t * 18) * s * 0.035 : 0;
  drawSpriteShadow(ctx, x, y, s, 0.34);

  // 四格顺序与会话层的 DIRS 一致：上、右、下、左。
  const size = s * 0.98;
  ctx.drawImage(
    image,
    facing * frameWidth, 0, frameWidth, frameHeight,
    x + (s - size) / 2, y + s - size + bob,
    size, size,
  );
}

function drawChickenFallback(ctx, x, y, s, t) {
  const bob = Math.sin(t * 3 + x) * s * 0.03;
  const cx = x + s * 0.5;
  const cy = y + s * 0.7 + bob;
  px(ctx, cx - s * 0.18, cy - s * 0.2, s * 0.36, s * 0.28, C.chicken);
  px(ctx, cx - s * 0.24, cy - s * 0.34, s * 0.3, s * 0.24, C.chicken);
  px(ctx, cx - s * 0.26, cy - s * 0.38, s * 0.1, s * 0.1, '#e04a3a');
  px(ctx, cx - s * 0.3, cy - s * 0.28, s * 0.08, s * 0.06, '#f0a63a');
  px(ctx, cx - s * 0.1, cy + s * 0.06, 3, s * 0.12, '#f0a63a');
  px(ctx, cx + s * 0.05, cy + s * 0.06, 3, s * 0.12, '#f0a63a');
  px(ctx, cx + s * 0.02, cy - s * 0.3, s * 0.06, s * 0.06, C.black);
}

function drawChicken(ctx, x, y, s, t) {
  const image = getSprite('chicken');
  if (!image) {
    drawChickenFallback(ctx, x, y, s, t);
    return;
  }
  const bob = Math.sin(t * 3 + x) * s * 0.02;
  drawSpriteShadow(ctx, x, y, s, 0.3);
  drawSprite(ctx, image, x, y, s, { width: 0.96, height: 0.96, bottom: 0.98, bob });
}

function drawCowFallback(ctx, x, y, s, t) {
  const bob = Math.sin(t * 1.4 + y) * s * 0.02;
  const cx = x + s * 0.5;
  const cy = y + s * 0.68 + bob;
  px(ctx, cx - s * 0.34, cy - s * 0.24, s * 0.68, s * 0.34, C.cow);
  px(ctx, cx + s * 0.2, cy - s * 0.42, s * 0.26, s * 0.26, C.cow);
  px(ctx, cx - s * 0.2, cy - s * 0.2, s * 0.2, s * 0.16, C.cowDark);
  px(ctx, cx + s * 0.06, cy - s * 0.12, s * 0.16, s * 0.14, C.cowDark);
  px(ctx, cx + s * 0.26, cy - s * 0.44, s * 0.08, s * 0.06, C.cowDark);
  px(ctx, cx + s * 0.22, cy - s * 0.32, s * 0.06, s * 0.06, C.black);
  px(ctx, cx - s * 0.28, cy + s * 0.06, 4, s * 0.2, C.cow);
  px(ctx, cx + s * 0.16, cy + s * 0.06, 4, s * 0.2, C.cow);
}

function drawCow(ctx, x, y, s, t) {
  const image = getSprite('cow');
  if (!image) {
    drawCowFallback(ctx, x, y, s, t);
    return;
  }
  const bob = Math.sin(t * 1.4 + y) * s * 0.012;
  drawSpriteShadow(ctx, x, y, s, 0.42);
  drawSprite(ctx, image, x, y, s, { width: 0.98, height: 0.98, bottom: 0.98, bob });
}

function drawFlag(ctx, x, y, s, t) {
  if (drawTileSprite(ctx, 'flag', x, y, s)) {
    const glow = (Math.sin(t * 4) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.35 + glow * 0.4})`;
    ctx.beginPath();
    ctx.arc(x + s * 0.5, y + s * 0.12, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const cx = x + s * 0.42;
  const cy = y + s * 0.2;
  px(ctx, cx, cy, 3, s * 0.66, C.woodDark);
  const wave = Math.sin(t * 3) * 2;
  px(ctx, cx + 3, cy + 2 + wave, s * 0.32, s * 0.2, '#4fbf63');
  px(ctx, cx + 3, cy + s * 0.14 + wave, s * 0.24, s * 0.1, '#6fd97f');
  // 闪烁提示
  const glow = (Math.sin(t * 4) + 1) / 2;
  px(ctx, cx - 2, cy - 4, 6, 3, `rgba(255,255,255,${0.35 + glow * 0.4})`);
}

function drawPendingEggs(ctx, world, layout) {
  if ((world.pendingEggs ?? 0) <= 0) return;
  const coop = (world.structures ?? []).find((structure) => structure.kind === 'coop');
  if (!coop) return;

  const { tile, ox, oy } = layout;
  const shown = Math.min(world.pendingEggs, 4);
  for (let i = 0; i < shown; i += 1) {
    const ex = ox + (coop.x + 0.35 + i * 0.42) * tile;
    const ey = oy + (coop.y + 0.76) * tile + Math.sin(world.hero.x + i) * tile * 0.02;
    ctx.fillStyle = 'rgba(65, 45, 24, 0.22)';
    ctx.beginPath();
    ctx.ellipse(ex, ey + tile * 0.08, tile * 0.13, tile * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8f0d2';
    ctx.beginPath();
    ctx.ellipse(ex, ey, tile * 0.1, tile * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a77a45';
    ctx.lineWidth = Math.max(1, tile * 0.025);
    ctx.stroke();
  }

  const bx = ox + (coop.x + coop.width - 0.08) * tile;
  const by = oy + (coop.y + 0.18) * tile;
  ctx.fillStyle = '#f8e29a';
  ctx.strokeStyle = '#6b4322';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(bx, by, tile * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3b2a17';
  ctx.font = `bold ${Math.round(tile * 0.22)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(world.pendingEggs), bx, by + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ------------------------------------------------------------------ 特效

function drawEffects(ctx, effects, now, layout) {
  for (const effect of effects) {
    const p = (now - effect.t0) / effect.dur;
    if (p < 0 || p > 1) continue;
    const x = layout.ox + effect.x * layout.tile;
    const y = layout.oy + effect.y * layout.tile;
    const s = layout.tile;

    if (effect.kind === 'dust') {
      const r = s * (0.12 + p * 0.3);
      ctx.fillStyle = `rgba(168, 122, 78, ${0.75 * (1 - p)})`;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + p * 3;
        ctx.beginPath();
        ctx.arc(x + s / 2 + Math.cos(a) * r, y + s * 0.7 + Math.sin(a) * r * 0.5, s * 0.06 * (1 - p * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (effect.kind === 'water') {
      ctx.fillStyle = `rgba(120, 200, 240, ${0.9 * (1 - p)})`;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + s / 2 + Math.cos(a) * s * 0.22, y + s * 0.4 + Math.sin(a) * s * 0.16 + p * s * 0.3, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (effect.kind === 'sparkle') {
      ctx.fillStyle = `rgba(255, 226, 120, ${1 - p})`;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + p * 4;
        const r = s * (0.2 + p * 0.35);
        ctx.fillRect(x + s / 2 + Math.cos(a) * r - 2, y + s / 2 + Math.sin(a) * r - 2, 5, 5);
      }
    } else if (effect.kind === 'grow') {
      ctx.fillStyle = `rgba(150, 230, 130, ${0.9 * (1 - p)})`;
      ctx.fillRect(x + s * 0.3, y + s * (0.6 - p * 0.4), s * 0.4, 5);
    } else if (effect.kind === 'egg') {
      const eggY = y + s * (0.72 - p * 0.35);
      ctx.fillStyle = `rgba(245, 238, 210, ${1 - p})`;
      ctx.beginPath();
      ctx.ellipse(x + s / 2, eggY, s * 0.1, s * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(126, 93, 54, ${0.8 * (1 - p)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (effect.text) {
      ctx.font = `bold ${Math.round(s * 0.36)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(40, 30, 20, ${1 - p})`;
      ctx.fillText(effect.text, x + s / 2 + 1, y - p * s * 0.8 + 1);
      ctx.fillStyle = `rgba(255, 246, 200, ${1 - p})`;
      ctx.fillText(effect.text, x + s / 2, y - p * s * 0.8);
      ctx.textAlign = 'left';
    }
  }
}

// ------------------------------------------------------------------ 主绘制

/**
 * 画一帧。
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} world
 * @param {object} layout {tile, ox, oy}
 * @param {object} anim   {heroX, heroY, effects, time, walking}
 */
export function paintFrame(ctx, world, layout, anim) {
  const { tile, ox, oy } = layout;
  const time = anim.time ?? 0;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // 农场外的背景草地
  ctx.fillStyle = '#5c9c3f';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // 地块
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const tileType = world.tiles[y][x];
      const dx = ox + x * tile;
      const dy = oy + y * tile;

      // 所有地块下面先铺草地，避免树、房子周围露出底色。
      drawGrass(ctx, dx, dy, tile, x, y);

      if (tileType === TILE.SOIL) drawSoil(ctx, dx, dy, tile, false);
      else if (tileType === TILE.SEEDLING) drawSeedling(ctx, dx, dy, tile, time);
      else if (tileType === TILE.WHEAT) drawWheat(ctx, dx, dy, tile, time);
      else if (tileType === TILE.FENCE) {
        const hasFence = (xx, yy) => (
          xx >= 0 && yy >= 0 && xx < world.width && yy < world.height
          && world.tiles[yy][xx] === TILE.FENCE
        );
        drawFence(
          ctx, dx, dy, tile, x, y,
          hasFence(x - 1, y) || hasFence(x + 1, y),
          hasFence(x, y - 1) || hasFence(x, y + 1),
        );
      }
      else if (tileType === TILE.TREE) drawTree(ctx, dx, dy, tile, x, y);
      else if (tileType === TILE.ROCK) drawRock(ctx, dx, dy, tile, x, y);
      else if (tileType === TILE.WATER) drawWater(ctx, dx, dy, tile, time);
      else if (tileType === TILE.WELL) drawWell(ctx, dx, dy, tile, x, y);
    }
  }

  // 2×2 大建筑
  for (const structure of world.structures ?? []) {
    drawStructure(ctx, structure, ox + structure.x * tile, oy + structure.y * tile, tile);
  }

  // 自由农场里已经下好、还没收走的鸡蛋
  drawPendingEggs(ctx, world, layout);

  // 目标旗子
  if (world.goalPos) {
    drawFlag(ctx, ox + world.goalPos.x * tile, oy + world.goalPos.y * tile, tile, time);
  }

  // 动物
  for (const animal of world.animals) {
    const dx = ox + animal.x * tile;
    const dy = oy + animal.y * tile;
    drawGrass(ctx, dx, dy, tile, animal.x, animal.y);
    if (animal.kind === 'chicken') drawChicken(ctx, dx, dy, tile, time);
    else drawCow(ctx, dx, dy, tile, time);
  }

  // 小农夫脚下高亮
  const heroTileX = ox + (anim.heroX ?? world.hero.x) * tile;
  const heroTileY = oy + (anim.heroY ?? world.hero.y) * tile;
  ctx.strokeStyle = 'rgba(255, 246, 180, 0.75)';
  ctx.lineWidth = 3;
  ctx.strokeRect(heroTileX + 1.5, heroTileY + 1.5, tile - 3, tile - 3);

  // 朝向指示箭头
  const dir = DIRS[world.hero.facing];
  const ax = heroTileX + tile / 2 + dir.dx * tile * 0.34;
  const ay = heroTileY + tile / 2 + dir.dy * tile * 0.34;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(ax, ay, tile * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // 小农夫
  drawHero(ctx, heroTileX, heroTileY, tile, world.hero.facing, time, anim.walking, anim.heroKind);

  // 特效
  drawEffects(ctx, anim.effects ?? [], anim.now ?? 0, layout);
}
