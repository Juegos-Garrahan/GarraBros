
(() => {

'use strict';

/* =========================
   ELEMENTOS
========================= */

const cvs = document.getElementById('canvas');
const ctx = cvs.getContext('2d');

const preview = document.getElementById('previewCanvas');
const previewCtx = preview.getContext('2d');

const gameEl = document.getElementById('game');
const overlay = document.getElementById('overlay');

const startBtn = document.getElementById('startBtn');
const menuBtn = document.getElementById('menuBtn');

const scoreEl = document.getElementById('score');
const recordLabel = document.getElementById('recordLabel');
const lifeFill = document.getElementById('lifeFill');
const lifeText = document.getElementById('lifeText');
const levelEl = document.getElementById('level');
const startRecord = document.getElementById('startRecord');

const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

const W = cvs.width;
const H = cvs.height;

/* =========================
   ESTADO
========================= */

const GAME = {

  running: false,
  paused: false,
  started: false,
  gameOver: false,

  score: 0,
  life: 100,
  time: 0,

  level: 1,

  record: Number(
    localStorage.getItem('virusRecord') || 0
  )

};

const player = {

  x: W * .5,
  y: H - 105,

  w: 62,
  h: 82,

  speed: 420,

  moveLeft: false,
  moveRight: false,

  animTime: 0,
  hitTimer: 0,
  bounce: 0,

  facing: 1

};

const TYPES = {

  HEART: 'heart',
  VIRUS: 'virus'

};

const pool = [];
const particles = [];

const diff = {

  fallSpeedBase: 145,
  fallSpeedGain: 15,

  spawnBase: .85,
  spawnMin: .28,
  spawnGain: .055,

  heartChance: .44

};

let spawnTimer = 0;
let flashT = 0;
let shakeT = 0;
let last = 0;

/* =========================
   UTILIDADES
========================= */

const clamp = (v, a, b) =>
  Math.max(a, Math.min(b, v));

const rand = (a, b) =>
  Math.random() * (b - a) + a;

const lerp = (a, b, t) =>
  a + (b - a) * t;

/* =========================
   MENU
========================= */

menuBtn.addEventListener('click', () => {

  window.location.href = '../index.html';

});

/* =========================
   HUD
========================= */

function updateHUD() {

  scoreEl.textContent =
    `⭐ ${GAME.score}`;

  recordLabel.textContent =
    `Récord: ${GAME.record}`;

  lifeText.textContent =
    `${Math.ceil(GAME.life)}%`;

  lifeFill.style.width =
    `${clamp(GAME.life, 0, 100)}%`;

  const g = GAME.life / 100;

  lifeFill.style.background =
    `linear-gradient(
      90deg,
      hsl(${120 * g}, 70%, 45%),
      hsl(${110 * g}, 70%, 38%)
    )`;

  levelEl.textContent = GAME.level;

}

/* =========================
   REINICIAR
========================= */

function resetGame() {

  GAME.running = true;
  GAME.paused = false;
  GAME.started = true;
  GAME.gameOver = false;

  GAME.score = 0;
  GAME.life = 100;
  GAME.time = 0;
  GAME.level = 1;

  player.x = W * .5;
  player.animTime = 0;
  player.hitTimer = 0;
  player.bounce = 0;

  pool.length = 0;
  particles.length = 0;

  spawnTimer = .3;

  hideOverlay();
  updateHUD();

}

/* =========================
   DIFICULTAD
========================= */

function currentFallSpeed() {

  return diff.fallSpeedBase +
    Math.floor(GAME.time / 10) *
    diff.fallSpeedGain;

}

function currentSpawnInterval() {

  return Math.max(
    diff.spawnMin,
    diff.spawnBase -
    Math.floor(GAME.time / 10) *
    diff.spawnGain
  );

}

function updateLevel() {

  GAME.level =
    Math.floor(GAME.time / 20) + 1;

}

/* =========================
   FONDO
========================= */

function drawBackground() {

  const gradient = ctx.createLinearGradient(
    0, 0, 0, H
  );

  gradient.addColorStop(0, '#0b1730');
  gradient.addColorStop(.55, '#08111f');
  gradient.addColorStop(1, '#020617');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  /* Luna */

  ctx.save();

  ctx.globalAlpha = .22;
  ctx.fillStyle = '#bae6fd';

  ctx.beginPath();
  ctx.arc(W - 65, 125, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  /* Estrellas */

  ctx.save();

  for (let i = 0; i < 65; i++) {

    const x = (i * 83) % W;

    const y =
      (i * 47 + Math.sin(GAME.time * .3 + i) * 5)
      % (H - 120);

    const alpha =
      .15 + Math.sin(GAME.time * 1.5 + i) * .08;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#e0f2fe';

    ctx.beginPath();
    ctx.arc(x, y, i % 3 === 0 ? 2 : 1, 0, Math.PI * 2);
    ctx.fill();

  }

  ctx.restore();

  /* Piso */

  const floor = ctx.createLinearGradient(
    0, H - 100, 0, H
  );

  floor.addColorStop(0, '#0f2741');
  floor.addColorStop(1, '#06101e');

  ctx.fillStyle = floor;
  ctx.fillRect(0, H - 75, W, 75);

  ctx.strokeStyle = '#38bdf825';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, H - 75);
  ctx.lineTo(W, H - 75);
  ctx.stroke();

}

/* =========================
   PERSONAJE
========================= */

function drawPlayer(targetCtx = ctx, scale = 1) {

  const c = targetCtx;

  const {
    x, y, w, h
  } = player;

  c.save();

  if (targetCtx === ctx) {

    c.translate(
      x,
      y + Math.sin(player.animTime * 7) * 1.5
    );

    if (player.hitTimer > 0) {

      c.globalAlpha =
        Math.sin(player.hitTimer * 40) > 0
        ? .4
        : 1;

    }

  } else {

    c.translate(60, 67);

  }

  c.scale(scale * player.facing, scale);

  const run =
    Math.sin(player.animTime * 12) *
    (player.moveLeft || player.moveRight ? 5 : 0);

  const bob =
    Math.abs(Math.sin(player.animTime * 12)) *
    (player.moveLeft || player.moveRight ? 2 : 0);

  /* Sombra */

  c.save();

  c.scale(1, .35);
  c.fillStyle = '#00000055';

  c.beginPath();
  c.ellipse(0, h * .55, w * .36, 12, 0, 0, Math.PI * 2);
  c.fill();

  c.restore();

  /* Piernas */

  c.lineCap = 'round';
  c.lineJoin = 'round';

  c.strokeStyle = '#1e293b';
  c.lineWidth = 11;

  c.beginPath();

  c.moveTo(-14, 22);
  c.lineTo(-16 + run, 48);

  c.moveTo(14, 22);
  c.lineTo(16 - run, 48);

  c.stroke();

  /* Zapatillas */

  c.fillStyle = '#f8fafc';

  roundRect(
    c,
    -28 + run,
    42,
    25,
    12,
    6,
    true
  );

  roundRect(
    c,
    3 - run,
    42,
    25,
    12,
    6,
    true
  );

  c.fillStyle = '#38bdf8';

  c.fillRect(-26 + run, 48, 20, 3);
  c.fillRect(5 - run, 48, 20, 3);

  /* Cuerpo */

  c.fillStyle = '#2563eb';

  roundRect(
    c,
    -29,
    -20 + bob,
    58,
    53,
    15,
    true
  );

  /* Campera / remera */

  c.fillStyle = '#60a5fa';

  roundRect(
    c,
    -22,
    -14 + bob,
    44,
    35,
    9,
    true
  );

  /* Detalle de la ropa */

  c.fillStyle = '#dbeafe';

  roundRect(
    c,
    -6,
    -5 + bob,
    12,
    22,
    4,
    true
  );

  c.fillStyle = '#1d4ed8';

  c.fillRect(-5, 2 + bob, 10, 3);

  /* Brazos */

  c.strokeStyle = '#f3c7a2';
  c.lineWidth = 11;

  c.beginPath();

  c.moveTo(-25, -10 + bob);
  c.lineTo(-38, 9 + run);

  c.moveTo(25, -10 + bob);
  c.lineTo(38, 9 - run);

  c.stroke();

  /* Manos */

  c.fillStyle = '#f3c7a2';

  c.beginPath();
  c.arc(-39, 11 + run, 7, 0, Math.PI * 2);
  c.fill();

  c.beginPath();
  c.arc(39, 11 - run, 7, 0, Math.PI * 2);
  c.fill();

  /* Cuello */

  c.fillStyle = '#eab68e';

  c.fillRect(-9, -31 + bob, 18, 14);

  /* Cabeza */

  c.fillStyle = '#f3c7a2';

  c.beginPath();
  c.arc(0, -48 + bob, 27, 0, Math.PI * 2);
  c.fill();

  /* Orejas */

  c.beginPath();
  c.arc(-26, -47 + bob, 7, 0, Math.PI * 2);
  c.fill();

  c.beginPath();
  c.arc(26, -47 + bob, 7, 0, Math.PI * 2);
  c.fill();

  /* Pelo */

  c.fillStyle = '#78350f';

  c.beginPath();

  c.moveTo(-27, -53 + bob);

  c.quadraticCurveTo(
    -29, -79 + bob,
    -8, -76 + bob
  );

  c.quadraticCurveTo(
    5, -86 + bob,
    16, -73 + bob
  );

  c.quadraticCurveTo(
    32, -71 + bob,
    27, -51 + bob
  );

  c.lineTo(19, -58 + bob);
  c.lineTo(10, -66 + bob);
  c.lineTo(2, -58 + bob);
  c.lineTo(-7, -66 + bob);
  c.lineTo(-17, -56 + bob);

  c.closePath();
  c.fill();

  /* Gorra */

  c.fillStyle = '#16a34a';

  c.beginPath();
  c.arc(0, -69 + bob, 25, Math.PI, Math.PI * 2);
  c.fill();

  c.fillStyle = '#22c55e';

  c.beginPath();
  c.ellipse(
    8,
    -68 + bob,
    30,
    7,
    -.12,
    0,
    Math.PI * 2
  );

  c.fill();

  /* Logo de gorra */

  c.fillStyle = '#dcfce7';

  c.beginPath();
  c.arc(-1, -71 + bob, 7, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = '#16a34a';

  c.font = 'bold 10px system-ui';
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  c.fillText('+', -1, -71 + bob);

  /* Ojos */

  c.fillStyle = '#1e293b';

  c.beginPath();
  c.ellipse(-10, -49 + bob, 3.5, 5, 0, 0, Math.PI * 2);
  c.fill();

  c.beginPath();
  c.ellipse(10, -49 + bob, 3.5, 5, 0, 0, Math.PI * 2);
  c.fill();

  /* Brillo ojos */

  c.fillStyle = '#ffffff';

  c.beginPath();
  c.arc(-9, -51 + bob, 1.3, 0, Math.PI * 2);
  c.fill();

  c.beginPath();
  c.arc(11, -51 + bob, 1.3, 0, Math.PI * 2);
  c.fill();

  /* Nariz */

  c.fillStyle = '#d49b75';

  c.beginPath();
  c.arc(0, -43 + bob, 2, 0, Math.PI * 2);
  c.fill();

  /* Sonrisa */

  c.strokeStyle = '#92400e';
  c.lineWidth = 2;
  c.beginPath();

  c.arc(0, -40 + bob, 8, 0.2, Math.PI - .2);
  c.stroke();

  /* Mejillas */

  c.fillStyle = '#fb718555';

  c.beginPath();
  c.arc(-19, -41 + bob, 5, 0, Math.PI * 2);
  c.fill();

  c.beginPath();
  c.arc(19, -41 + bob, 5, 0, Math.PI * 2);
  c.fill();

  c.restore();

}

/* =========================
   OBJETOS
========================= */

function drawObject(o) {

  ctx.save();

  ctx.translate(o.x, o.y);
  ctx.rotate(o.rotation);

  const pulse =
    1 + Math.sin(GAME.time * 5 + o.x) * .06;

  ctx.scale(pulse, pulse);

  if (o.type === TYPES.HEART) {

    drawHeart(o.r);

  } else {

    drawVirus(o.r);

  }

  ctx.restore();

}

function drawHeart(r) {

  ctx.shadowColor = '#fb718c';
  ctx.shadowBlur = 12;

  ctx.fillStyle = '#fb416d';

  ctx.beginPath();

  ctx.moveTo(0, r * .9);

  ctx.bezierCurveTo(
    -r * 1.5,
    -r * .1,
    -r * .8,
    -r * 1.1,
    0,
    -r * .45
  );

  ctx.bezierCurveTo(
    r * .8,
    -r * 1.1,
    r * 1.5,
    -.1 * r,
    0,
    r * .9
  );

  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff99';

  ctx.beginPath();

  ctx.ellipse(
    -r * .38,
    -r * .5,
    r * .27,
    r * .15,
    -.5,
    0,
    Math.PI * 2
  );

  ctx.fill();

}

function drawVirus(r) {

  ctx.shadowColor = '#22c55e88';
  ctx.shadowBlur = 10;

  /* Púas */

  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 4;

  for (let i = 0; i < 12; i++) {

    const a = i / 12 * Math.PI * 2;

    const x1 = Math.cos(a) * r * .8;
    const y1 = Math.sin(a) * r * .8;

    const x2 = Math.cos(a) * r * 1.3;
    const y2 = Math.sin(a) * r * 1.3;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.fillStyle = '#22c55e';

    ctx.beginPath();
    ctx.arc(x2, y2, 4, 0, Math.PI * 2);
    ctx.fill();

  }

  /* Cuerpo */

  ctx.fillStyle = '#22c55e';
  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  /* Cara */

  ctx.fillStyle = '#052e16';

  ctx.beginPath();
  ctx.ellipse(-r * .3, -r * .15, r * .14, r * .2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(r * .3, -r * .15, r * .14, r * .2, 0, 0, Math.PI * 2);
  ctx.fill();

  /* Boca */

  ctx.strokeStyle = '#052e16';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(0, r * .1, r * .35, 0, Math.PI);
  ctx.stroke();

  /* Reflejo */

  ctx.fillStyle = '#bbf7d0aa';

  ctx.beginPath();
  ctx.arc(-r * .35, -r * .45, r * .16, 0, Math.PI * 2);
  ctx.fill();

}

/* =========================
   SPAWN
========================= */

function spawnObject() {

  const type =
    Math.random() < diff.heartChance
    ? TYPES.HEART
    : TYPES.VIRUS;

  const r =
    type === TYPES.HEART
    ? rand(14, 21)
    : rand(18, 25);

  const x = rand(r + 10, W - r - 10);

  pool.push({

    x,
    y: -r - 10,
    r,
    type,

    speed:
      currentFallSpeed() * rand(.9, 1.2),

    rotation: rand(-.2, .2)

  });

}

/* =========================
   UPDATE
========================= */

function update(dt) {

  if (!GAME.running || GAME.paused) {
    return;
  }

  GAME.time += dt;

  updateLevel();

  player.animTime += dt;

  if (player.hitTimer > 0) {
    player.hitTimer -= dt;
  }

  if (player.bounce > 0) {
    player.bounce -= dt;
  }

  /* Spawn */

  spawnTimer -= dt;

  if (spawnTimer <= 0) {

    spawnObject();

    spawnTimer =
      currentSpawnInterval() *
      rand(.75, 1.25);

  }

  /* Movimiento */

  let dir = 0;

  if (player.moveLeft) dir -= 1;
  if (player.moveRight) dir += 1;

  if (dir !== 0) {

    player.facing = dir;

  }

  player.x += dir * player.speed * dt;

  player.x = clamp(
    player.x,
    player.w * .5 + 10,
    W - player.w * .5 - 10
  );

  /* Objetos */

  for (let i = pool.length - 1; i >= 0; i--) {

    const o = pool[i];

    o.y += o.speed * dt;

    o.rotation +=
      (o.type === TYPES.VIRUS ? .9 : .6) * dt;

    /* Colisión */

    if (
      circleRectOverlap(
        o.x,
        o.y,
        o.r,
        player.x - player.w / 2,
        player.y - player.h / 2,
        player.w,
        player.h * .8
      )
    ) {

      if (o.type === TYPES.HEART) {

        GAME.score += 10;

        createParticles(
          o.x,
          o.y,
          '#fb7185',
          10
        );

        player.bounce = .15;

      } else {

        GAME.life -= 25;

        player.hitTimer = .4;

        screenFlash();
        shakeT = .18;

        createParticles(
          o.x,
          o.y,
          '#4ade80',
          14
        );

      }

      if (GAME.score > GAME.record) {

        GAME.record = GAME.score;

        localStorage.setItem(
          'virusRecord',
          GAME.record
        );

      }

      updateHUD();

      pool.splice(i, 1);

      continue;

    }

    if (o.y - o.r > H + 30) {

      pool.splice(i, 1);

    }

  }

  /* Partículas */

  for (let i = particles.length - 1; i >= 0; i--) {

    const p = particles[i];

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.vy += 100 * dt;

    p.life -= dt;

    if (p.life <= 0) {

      particles.splice(i, 1);

    }

  }

  if (GAME.life <= 0 && !GAME.gameOver) {

    GAME.life = 0;

    updateHUD();
    showGameOver();

  }

}

/* =========================
   PARTICULAS
========================= */

function createParticles(x, y, color, count) {

  for (let i = 0; i < count; i++) {

    particles.push({

      x,
      y,

      vx: rand(-100, 100),
      vy: rand(-160, -40),

      life: rand(.3, .7),
      maxLife: .7,

      size: rand(2, 5),
      color

    });

  }

}

function drawParticles() {

  for (const p of particles) {

    ctx.globalAlpha =
      clamp(p.life / p.maxLife, 0, 1);

    ctx.fillStyle = p.color;

    ctx.beginPath();

    ctx.arc(
      p.x,
      p.y,
      p.size,
      0,
      Math.PI * 2
    );

    ctx.fill();

  }

  ctx.globalAlpha = 1;

}

/* =========================
   RENDER
========================= */

function render() {

  ctx.clearRect(0, 0, W, H);

  drawBackground();

  for (const o of pool) {

    drawObject(o);

  }

  drawParticles();

  ctx.save();

  if (shakeT > 0) {

    ctx.translate(
      rand(-3, 3),
      rand(-3, 3)
    );

  }

  drawPlayer();

  ctx.restore();

  if (shakeT > 0) {

    shakeT -= .016;

  }

  drawFlash();

}

/* =========================
   FLASH
========================= */

function screenFlash() {

  flashT = .2;

}

function drawFlash() {

  if (flashT <= 0) return;

  flashT -= .016;

  ctx.fillStyle =
    `rgba(239,68,68,${flashT * 1.5})`;

  ctx.fillRect(0, 0, W, H);

}

/* =========================
   COLISIÓN
========================= */

function circleRectOverlap(
  cx,
  cy,
  cr,
  rx,
  ry,
  rw,
  rh
) {

  const nearestX =
    clamp(cx, rx, rx + rw);

  const nearestY =
    clamp(cy, ry, ry + rh);

  const dx = cx - nearestX;
  const dy = cy - nearestY;

  return dx * dx + dy * dy <= cr * cr;

}

/* =========================
   RECTÁNGULO
========================= */

function roundRect(
  c,
  x,
  y,
  w,
  h,
  r,
  fill = true
) {

  r = Math.min(r, w / 2, h / 2);

  c.beginPath();

  c.moveTo(x + r, y);

  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);

  c.closePath();

  if (fill) c.fill();

}

/* =========================
   OVERLAY
========================= */

function hideOverlay() {

  overlay.style.display = 'none';

}

function showOverlay() {

  overlay.style.display = 'grid';

}

function showGameOver() {

  GAME.running = false;
  GAME.gameOver = true;

  overlay.innerHTML = `

    <div class="card">

      <div class="character-preview">
        <canvas
          id="gameOverPreview"
          width="120"
          height="120">
        </canvas>
      </div>

      <h1>💥 Game Over</h1>

      <p>
        Los virus superaron tus defensas.
      </p>

      <div class="big-score">
        ⭐ ${GAME.score} puntos
      </div>

      <p>
        Récord: ${GAME.record}
        <br>
        Nivel alcanzado: ${GAME.level}
      </p>

      <button class="btn" id="restartBtn">
        🔄 JUGAR DE NUEVO
      </button>

      <button class="btn secondary" id="gameOverMenuBtn">
        🏠 Volver al menú
      </button>

      <div class="hint">
        ¡Intentá superar tu récord!
      </div>

    </div>

  `;

  showOverlay();

  document
    .getElementById('restartBtn')
    .addEventListener('click', resetGame);

  document
    .getElementById('gameOverMenuBtn')
    .addEventListener('click', () => {

      window.location.href = '../index.html';

    });

}

/* =========================
   PAUSA
========================= */

function showPause() {

  overlay.innerHTML = `

    <div class="card">

      <div class="character-preview">
        <canvas
          id="pausePreview"
          width="120"
          height="120">
        </canvas>
      </div>

      <h1>⏸️ Pausa</h1>

      <p>
        Tu partida está pausada.
      </p>

      <div class="big-score">
        ⭐ ${GAME.score} puntos
      </div>

      <button class="btn" id="continueBtn">
        ▶ CONTINUAR
      </button>

      <button class="btn secondary" id="pauseRestartBtn">
        🔄 REINICIAR
      </button>

      <button class="btn secondary" id="pauseMenuBtn">
        🏠 MENÚ
      </button>

      <div class="hint">
        También podés presionar P.
      </div>

    </div>

  `;

  showOverlay();

  document
    .getElementById('continueBtn')
    .addEventListener('click', () => {

      GAME.paused = false;
      hideOverlay();

    });

  document
    .getElementById('pauseRestartBtn')
    .addEventListener('click', resetGame);

  document
    .getElementById('pauseMenuBtn')
    .addEventListener('click', () => {

      window.location.href = '../index.html';

    });

}

/* =========================
   PREVIEW
========================= */

function drawPreview() {

  previewCtx.clearRect(0, 0, 120, 120);

  previewCtx.save();

  previewCtx.translate(0, 4);

  drawPlayer(previewCtx, 1.05);

  previewCtx.restore();

}

/* =========================
   CONTROLES TECLADO
========================= */

const key = {};

function setMoves() {

  player.moveLeft =
    !!(key.ArrowLeft || key.a || key.A);

  player.moveRight =
    !!(key.ArrowRight || key.d || key.D);

}

window.addEventListener('keydown', e => {

  if (
    [
      'ArrowLeft',
      'ArrowRight',
      'a',
      'A',
      'd',
      'D',
      ' ',
      'Enter'
    ].includes(e.key)
  ) {

    e.preventDefault();

  }

  key[e.key] = true;

  setMoves();

  if (
    !GAME.started &&
    (e.key === ' ' || e.key === 'Enter')
  ) {

    startBtn.click();

  }

  if (e.key === 'p' || e.key === 'P') {

    if (GAME.started && !GAME.gameOver) {

      GAME.paused = !GAME.paused;

      if (GAME.paused) {

        showPause();

      } else {

        hideOverlay();

      }

    }

  }

  if (e.key === 'r' || e.key === 'R') {

    if (GAME.started) {

      resetGame();

    }

  }

});

window.addEventListener('keyup', e => {

  key[e.key] = false;

  setMoves();

});

/* =========================
   CONTROLES TÁCTILES
========================= */

function bindHoldButton(button, direction) {

  const start = e => {

    e.preventDefault();

    if (direction === 'left') {

      player.moveLeft = true;

    } else {

      player.moveRight = true;

    }

  };

  const stop = e => {

    e.preventDefault();

    if (direction === 'left') {

      player.moveLeft = false;

    } else {

      player.moveRight = false;

    }

  };

  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('pointerleave', stop);

}

bindHoldButton(leftBtn, 'left');
bindHoldButton(rightBtn, 'right');

/* =========================
   ARRASTRE
========================= */

let pointerActive = false;

gameEl.addEventListener('pointerdown', e => {

  if (e.target.closest('button')) return;

  pointerActive = true;

  moveByPointer(e);

});

gameEl.addEventListener('pointermove', e => {

  if (pointerActive) {

    moveByPointer(e);

  }

});

window.addEventListener('pointerup', () => {

  pointerActive = false;

});

function moveByPointer(e) {

  if (e.target.closest('button')) return;

  const rect = cvs.getBoundingClientRect();

  const px =
    (e.clientX - rect.left) /
    rect.width * W;

  player.x = clamp(
    px,
    player.w / 2 + 10,
    W - player.w / 2 - 10
  );

}

/* =========================
   INICIAR
========================= */

startBtn.addEventListener('click', resetGame);

startRecord.textContent = GAME.record;

updateHUD();

drawPreview();

/* =========================
   BUCLE PRINCIPAL
========================= */

function loop(ts) {

  const t = ts / 1000;

  const dt =
    Math.min(.033, last ? t - last : .016);

  last = t;

  update(dt);
  render();

  requestAnimationFrame(loop);

}

requestAnimationFrame(loop);

})();
