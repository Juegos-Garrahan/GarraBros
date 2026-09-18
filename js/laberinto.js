/* ==========================================================
   Juego de laberinto 2D en un solo archivo (HTML+CSS+JS)
   - Mapa y colisiones a partir de los píxeles de mapa.png
   - PAREDES VISIBLES: overlay azul generado desde el mapa
   - Personaje seleccionable (masculino/femenino)
   - Enemigos (virus) que rebotan y crecen con el tiempo
   - Caramelos coleccionables
   - Objetivo: encuentra al médico (garantizado alcanzable)
   ========================================================== */

/* ---------- Configuración general del juego ---------- */
const CONFIG = {
  desiredCanvasWidth: 960,
  desiredCanvasHeight: 600,
  player: {
    radius: 20,           // tamaño visual
    collisionRadius: 8,  // tamaño usado para atravesar puertas
    speed: 210,
    speedFemale: 230,
    maxLife: 100,
    iFrames: 0.35,
  },
  virus: {
    count: 15,
    speedMin: 90,
    speedMax: 180,
    radiusMin: 10,
    radiusMax: 18,
    growthMin: 4,   // px por minuto (se convierte a px/seg)
    growthMax: 15,
    baseDPS: 15,     // daño por segundo base (ajustado para que se pueda ganar)
  },
  candy: {
    count: 18,
    heal: 3,        // vida recuperada por caramelo
    radius: 10,
  },
  doctor: {
    radius: 20,
  },
  // Colisiones: consideramos "pared" a los píxeles oscuros o con alfa bajo
wallRule: {
  redThreshold: 120,  // mínimo rojo
  greenMax: 60,       // máximo verde
  blueMax: 60         // máximo azul
},

  pathfind: {
    step: 4,            // resolución de la cuadrícula para BFS (px)
    inflate: 10        // "radio" permitido al pasar (aprox colisión del jugador)
  }
};

// Canvases y contexto
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas oculto para leer píxeles del mapa (colisión)
const mapCanvas = document.createElement('canvas');
const mapCtx = mapCanvas.getContext('2d', { willReadFrequently: true });

// Overlay de paredes para hacerlas visibles
let wallOverlayCanvas = null;
let wallOverlayCtx = null;

// Imagen del mapa (se intentará cargar mapa.png; si falla, se generará uno)
let mapImage = null;
let collisionImageData = null; // ImageData con los píxeles del mapa
let usingExampleMap = false;

// Sprites del jugador (locales si existen; si fallan, se generan)
const spriteMale = new Image();
const spriteFemale = new Image();
let maleLoaded = false, femaleLoaded = false;

// Placeholders generados por código para virus/caramelos/médico
let imgVirus, imgCandy, imgDoctor;

// Entidades del juego
let player = null;
let viruses = [];
let candies = [];
let doctor = null;

// Estado
let keys = {
  w:false,
  a:false,
  s:false,
  d:false,
  up:false,
  down:false,
  left:false,
  right:false
};

let mouseControl = {
  active: false,
  x: 0,
  y: 0
};

let lastTime = 0;
let running = false;
let won = false;
let lost = false;

// HUD DOM
const lifeFill = document.getElementById('lifeFill');
const candiesLeft = document.getElementById('candiesLeft');
const virusCount = document.getElementById('virusCount');

// Overlays
const overlayMenu = document.getElementById('menu');
const overlayWin = document.getElementById('win');
const overlayLose = document.getElementById('lose');
const btnStart = document.getElementById('btnStart');
const btnTestMap = document.getElementById('btnTestMap');

// Elección de personaje
let chosen = null; // 'male' | 'female'
let selectedMap = 'hospital';


let startPosition = null;
let startMessageUntil = 0;


/* ---------- Carga de sprites ---------- */
function loadPlayerSprites(){
  return new Promise(resolve => {
    let done = 0;
    const check = () => { done++; if(done===2) resolve(); };

    spriteMale.onload = ()=>{ maleLoaded = true; document.getElementById('imgMale').src = spriteMale.src; check(); };
    spriteMale.onerror = ()=>{ maleLoaded = false; generateFallbackPlayer('male'); check(); };
    spriteMale.src = '../images/personaje_m.png';

    spriteFemale.onload = ()=>{ femaleLoaded = true; document.getElementById('imgFemale').src = spriteFemale.src; check(); };
    spriteFemale.onerror = ()=>{ femaleLoaded = false; generateFallbackPlayer('female'); check(); };
    spriteFemale.src = '../images/personaje_f.png';
  });
}

// Genera un sprite placeholder para el jugador (círculo con icono)
function generateFallbackPlayer(which){
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0,0,128,128);
  // círculo
  g.shadowColor = '#0008'; g.shadowBlur = 8;
  g.beginPath(); g.arc(64,64,46,0,Math.PI*2);
  g.fillStyle = which==='male' ? '#3b82f6' : '#ec4899';
  g.fill();
  // carita
  g.shadowBlur = 0;
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(48,56,6,0,Math.PI*2); g.fill();
  g.beginPath(); g.arc(80,56,6,0,Math.PI*2); g.fill();
  g.fillStyle = '#0b1020';
  g.fillRect(46,78,36,10); // boca
  const img = new Image();
  img.src = c.toDataURL();
  if(which==='male'){ document.getElementById('imgMale').src = img.src; spriteMale.src = img.src; }
  else{ document.getElementById('imgFemale').src = img.src; spriteFemale.src = img.src; }
}

// Construye imágenes de virus, caramelos y médico (placeholder bonitos)
function buildMiscSprites(){
  // Virus
  imgVirus = new Image();
  {
    const c = document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
    g.translate(32,32);
    for(let i=0;i<12;i++){
      const a=i*(Math.PI*2/12);
      const r1=16, r2=26;
      g.strokeStyle='#10b981'; g.lineWidth=4; g.lineCap='round';
      g.beginPath(); g.moveTo(Math.cos(a)*r1, Math.sin(a)*r1);
      g.lineTo(Math.cos(a)*r2, Math.sin(a)*r2); g.stroke();
      g.beginPath(); g.arc(Math.cos(a)*r2, Math.sin(a)*r2,3,0,Math.PI*2); g.fillStyle='#34d399'; g.fill();
    }
    g.beginPath(); g.arc(0,0,18,0,Math.PI*2); g.fillStyle='#22c55e'; g.fill();
    g.globalAlpha=.85; g.beginPath(); g.arc(-6,-6,8,0,Math.PI*2); g.fillStyle='#86efac'; g.fill(); g.globalAlpha=1;
    imgVirus.src = c.toDataURL();
  }
  // Candy
  imgCandy = new Image();
  {
    const c = document.createElement('canvas'); c.width=c.height=48; const g=c.getContext('2d');
    g.translate(24,24);
    g.fillStyle='#fb7185'; g.beginPath();
    g.moveTo(-22,-8); g.lineTo(-10,0); g.lineTo(-22,8); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(22,-8); g.lineTo(10,0); g.lineTo(22,8); g.closePath(); g.fill();
    g.beginPath(); g.arc(0,0,12,0,Math.PI*2); g.fillStyle='#f472b6'; g.fill();
    g.strokeStyle='#ffffffaa'; g.lineWidth=3; g.beginPath(); g.moveTo(-8,-4); g.lineTo(8,4); g.stroke();
    imgCandy.src = c.toDataURL();
  }
  // Doctor
  imgDoctor = new Image();
  {
    const c = document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
    g.translate(32,32);
    g.fillStyle='#0ea5e9'; g.beginPath(); g.moveTo(-14,20); g.lineTo(-14,-4); g.lineTo(0,-10); g.lineTo(14,-4); g.lineTo(14,20); g.closePath(); g.fill();
    g.beginPath(); g.arc(0,-16,10,0,Math.PI*2); g.fillStyle='#fde68a'; g.fill();
    g.fillStyle='#ef4444'; g.fillRect(-5,2,10,4); g.fillRect(-2, -1,4,10);
    imgDoctor.src = c.toDataURL();
  }
}

/* ---------- Utilidades ---------- */

// Ajusta las etiquetas decorativas a la posición relativa del canvas
function positionBadges(){
  const rect = canvas.getBoundingClientRect();
  const rel = (leftPerc, topPerc) => ({
    left: rect.left + window.scrollX + rect.width*leftPerc + 'px',
    top:  rect.top  + window.scrollY + rect.height*topPerc + 'px'
  });
  const set = (id,l,t)=>{ const el=document.getElementById(id); const p=rel(l,t); el.style.left=p.left; el.style.top=p.top; };
  set('badgePedi', .30, .20);
  set('badgeVac',  .75, .25);
  set('badgeGame', .20, .70);
  set('badgeLab',  .70, .70);
}
window.addEventListener('resize', ()=>{
  positionBadges();
});


function isWall(x, y){
  if(!collisionImageData) return true;
  const {width, data} = collisionImageData;
  const ix = x|0, iy = y|0;
  if(ix<0 || iy<0 || ix>=collisionImageData.width || iy>=collisionImageData.height) return true;
  const i = (iy*width + ix)*4;
  const r = data[i], g = data[i+1], b = data[i+2];

  // Detectar rojo y similares
  const isRedLike = (
    r >= (CONFIG.wallRule.redThreshold || 150) &&  // rojo fuerte
    g <= (CONFIG.wallRule.greenMax || 80) &&       // poco verde
    b <= (CONFIG.wallRule.blueMax || 80)           // poco azul
  );

  return isRedLike;
}



/* Busca una posición libre dentro del mapa (no pared) */
function findFreeSpotVirus(tries = 500) {
  const w = mapCanvas.width, h = mapCanvas.height;
  const cx = w / 2, cy = h / 2;

  for (let i = 0; i < tries; i++) {
    // Genera puntos con distribución sesgada hacia el centro
    const x = cx + (Math.random() - Math.random()) * (w * 0.4); // ±40% del ancho
    const y = cy + (Math.random() - Math.random()) * (h * 0.4); // ±40% del alto
    if (!isWall(x, y)) return { x, y };
  }

  // Si no encuentra, recorre el centro del mapa en cuadrícula
  for (let y = cy - h * 0.25; y < cy + h * 0.25; y += 5) {
    for (let x = cx - w * 0.25; x < cx + w * 0.25; x += 5) {
      if (!isWall(x, y)) return { x, y };
    }
  }

  // Último recurso: punto fijo cerca del centro
  return { x: cx, y: cy };
}

/* Busca una posición libre dentro del mapa (no pared) */
function findFreeSpot(tries=500){
  const w = mapCanvas.width, h = mapCanvas.height;
  for(let i=0;i<tries;i++){
    const x = Math.random()*w, y = Math.random()*h;
    if(!isWall(x,y)) return {x,y};
  }
  for(let y=10;y<h-10;y+=5){
    for(let x=10;x<w-10;x+=5){
      if(!isWall(x,y)) return {x,y};
    }
  }
  return {x:20,y:20};
}


/* Colisión círculo vs paredes: samplea en 10 puntos alrededor del círculo */
function circleHitsWall(cx, cy, r){
  // Más puntos = detección más precisa en puertas y esquinas
  const steps = 24;

  for(let i = 0; i < steps; i++){
    const a = (i / steps) * Math.PI * 2;

    const px = Math.round(cx + Math.cos(a) * r);
    const py = Math.round(cy + Math.sin(a) * r);

    if(isWall(px, py)){
      return true;
    }
  }

  // También comprobamos el centro de cada lado
  if(isWall(Math.round(cx + r), Math.round(cy))) return true;
  if(isWall(Math.round(cx - r), Math.round(cy))) return true;
  if(isWall(Math.round(cx), Math.round(cy + r))) return true;
  if(isWall(Math.round(cx), Math.round(cy - r))) return true;

  return false;
}


/* Mueve un círculo con rebotito (para virus) revirtiendo ejes si pega pared */
function moveBounce(ent, dt){
  // eje X
  let nx = ent.x + ent.vx * ent.speed * dt;
  if(!circleHitsWall(nx, ent.y, ent.r)){
    ent.x = nx;
  } else {
    ent.vx *= -1;
  }
  // eje Y
  let ny = ent.y + ent.vy * ent.speed * dt;
  if(!circleHitsWall(ent.x, ny, ent.r)){
    ent.y = ny;
  } else {
    ent.vy *= -1;
  }
}

/* Mueve al jugador (no atraviesa paredes) */
function movePlayer(dt){
  if(!player) return;

  let dx =
    (keys.d || keys.right ? 1 : 0) -
    (keys.a || keys.left  ? 1 : 0);

  let dy =
    (keys.s || keys.down ? 1 : 0) -
    (keys.w || keys.up   ? 1 : 0);

  // Control con mouse
  if(dx === 0 && dy === 0 && mouseControl.active){

    // mouseControl ya está expresado
    // en coordenadas internas del canvas
    const mouseX = mouseControl.x;
    const mouseY = mouseControl.y;

    dx = mouseX - player.x;
    dy = mouseY - player.y;

    const distance = Math.hypot(dx, dy);

    if(distance > 5){
      dx /= distance;
      dy /= distance;
    }else{
      dx = 0;
      dy = 0;
    }
  }

  const len = Math.hypot(dx, dy);

  if(len > 0){
    dx /= len;
    dy /= len;
  }

  const sp = player.speed;

  const moveX = dx * sp * dt;
  const moveY = dy * sp * dt;

  const nextX = player.x + moveX;

  if(!circleHitsWall(nextX, player.y, player.collisionRadius)){
    player.x = nextX;
  }

  const nextY = player.y + moveY;

  if(!circleHitsWall(player.x, nextY, player.collisionRadius)){
    player.y = nextY;
  }
}




/* Distancia sencilla */
const dist = (ax,ay,bx,by)=>Math.hypot(ax-bx, ay-by);

/* ---------- PAREDES VISIBLES: overlay azul ---------- */
function buildWallOverlay(){
  wallOverlayCanvas = document.createElement('canvas');
  wallOverlayCanvas.width = mapCanvas.width;
  wallOverlayCanvas.height = mapCanvas.height;
  wallOverlayCtx = wallOverlayCanvas.getContext('2d');

  const w = collisionImageData.width, h = collisionImageData.height;
  const out = wallOverlayCtx.createImageData(w,h);
  const src = collisionImageData.data, dst = out.data;

  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i = (y*w + x)*4;
      const r=src[i], g=src[i+1], b=src[i+2], a=src[i+3];
      const brightness = (0.2126*r + 0.7152*g + 0.0722*b);
      const isWallPix = (a < CONFIG.wallRule.minAlpha) || (brightness <= CONFIG.wallRule.maxBrightness);
      if(isWallPix){
        // azul visible
        dst[i]   = 70;   // R
        dst[i+1] = 140;  // G
        dst[i+2] = 255;  // B
        dst[i+3] = 210;  // A
      }else{
        // transparente
        dst[i] = dst[i+1] = dst[i+2] = 0;
        dst[i+3] = 0;
      }
    }
  }
  wallOverlayCtx.putImageData(out, 0, 0);

  // contorno suave (bloom)
  wallOverlayCtx.save();
  wallOverlayCtx.globalCompositeOperation = 'source-over';
  wallOverlayCtx.filter = 'blur(2px)';
  wallOverlayCtx.drawImage(wallOverlayCanvas, 0, 0);
  wallOverlayCtx.restore();
}

/* ---------- PATHFIND: garantiza que el médico sea alcanzable ---------- */
function isReachable(fromX, fromY, toX, toY){
  const STEP = CONFIG.pathfind.step;
  const INF = CONFIG.pathfind.inflate;

  const W = mapCanvas.width, H = mapCanvas.height;
  const GW = Math.floor(W/STEP), GH = Math.floor(H/STEP);

  // Función: celda libre si el círculo del jugador no toca pared (con leve margen)
  function free(gx,gy){
    if(gx<0||gy<0||gx>=GW||gy>=GH) return false;
    const x = gx*STEP + STEP/2;
    const y = gy*STEP + STEP/2;
    return !circleHitsWall(x,y, Math.max(8, Math.min(CONFIG.player.radius, INF)));
  }

  const sx = Math.max(0, Math.min(GW-1, Math.floor(fromX/STEP)));
  const sy = Math.max(0, Math.min(GH-1, Math.floor(fromY/STEP)));
  const tx = Math.max(0, Math.min(GW-1, Math.floor(toX/STEP)));
  const ty = Math.max(0, Math.min(GH-1, Math.floor(toY/STEP)));

  if(!free(sx,sy) || !free(tx,ty)) return false;

  const qx = new Int16Array(GW*GH);
  const qy = new Int16Array(GW*GH);
  let qs=0, qe=0;
  const vis = new Uint8Array(GW*GH);
  const push=(x,y)=>{ qx[qe]=x; qy[qe]=y; qe++; vis[y*GW+x]=1; };

  push(sx,sy);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

  let steps=0, limit = GW*GH;
  while(qs<qe && steps<limit){
    const x=qx[qs], y=qy[qs]; qs++; steps++;
    if(x===tx && y===ty) return true;
    for(const d of dirs){
      const nx=x+d[0], ny=y+d[1];
      if(nx<0||ny<0||nx>=GW||ny>=GH) continue;
      const idx=ny*GW+nx;
      if(vis[idx]) continue;
      if(free(nx,ny)){
        push(nx,ny);
      }
    }
  }
  return false;
}

/* ---------- Carga y preparación del mapa ---------- */

// Intenta cargar mapa.png. Si no existe, genera uno con look "hospital de niños".
function loadMap(){
  return new Promise(resolve => {


    // =====================================
    // SIN MAPA - mapa generado por defecto
    // =====================================
    if(selectedMap === 'default'){

      usingExampleMap = true;

      const gen = generateHospitalExample(
        CONFIG.desiredCanvasWidth,
        CONFIG.desiredCanvasHeight
      );

      mapImage = gen.display;
      collisionImageData = gen.collision;

      canvas.width = mapCanvas.width = gen.collision.width;
      canvas.height = mapCanvas.height = gen.collision.height;

      buildWallOverlay();

      ctx.drawImage(mapImage, 0, 0);

      positionBadges();

      resolve();
      return;
    }

    // =====================================
    // MAPAS EXTERNOS
    // =====================================

    let mapPath = '';

    if(selectedMap === 'hospital'){
      mapPath = '../images/mapa_hospital.png';
    }
    else if(selectedMap === 'hard'){
      mapPath = '../images/mapa_hospital_dificil.png';
    }

    console.log("Cargando:", mapPath);

    // IMPORTANTE:
    // Creamos img ANTES de usarlo
    const img = new Image();

    img.crossOrigin = "anonymous";

    img.onload = function(){

      console.log("Mapa cargado:", mapPath);

      usingExampleMap = false;

      mapImage = img;

      prepareMapFromImage(img);

      resolve();
    };

    img.onerror = function(){

      console.error("No se pudo cargar el mapa:", mapPath);

      // Si no encuentra la imagen,
      // usamos el mapa generado por defecto
      usingExampleMap = true;

      const gen = generateHospitalExample(
        CONFIG.desiredCanvasWidth,
        CONFIG.desiredCanvasHeight
      );

      mapImage = gen.display;
      collisionImageData = gen.collision;

      canvas.width = mapCanvas.width = gen.collision.width;
      canvas.height = mapCanvas.height = gen.collision.height;

      buildWallOverlay();

      ctx.drawImage(mapImage, 0, 0);

      positionBadges();

      resolve();
    };

    // Finalmente cargamos la imagen
    img.src = mapPath;

  });
}


/* A partir de una imagen de mapa (mapa.png), configura canvases y colisiones */
function prepareMapFromImage(img){
  // Ajusta tamaño del canvas al del mapa
  canvas.width = mapCanvas.width = img.naturalWidth || img.width;
  canvas.height = mapCanvas.height = img.naturalHeight || img.height;

  // Pinta la imagen en el canvas oculto y extrae sus píxeles
  mapCtx.clearRect(0,0,mapCanvas.width, mapCanvas.height);
  mapCtx.drawImage(img, 0, 0, mapCanvas.width, mapCanvas.height);
  collisionImageData = mapCtx.getImageData(0,0,mapCanvas.width, mapCanvas.height);

  // Prepara overlay de paredes
  buildWallOverlay();

  // Pinta en el canvas visible con tinte suave
  ctx.clearRect(0,0,canvas.width, canvas.height);
  ctx.drawImage(img,0,0);
  ctx.fillStyle = '#60a5fa12'; ctx.fillRect(0,0,canvas.width,canvas.height);
  positionBadges();
}

/* Genera un hospital de ejemplo:
   - display: imagen colorida y amable
   - collision: ImageData donde negro=pared, blanco/pasteles=pasillo
   (mapa GANABLE: todos los pasillos conectan mediante "puertas") */
function generateHospitalExample(w,h){
  const display = document.createElement('canvas');
  display.width=w; display.height=h;
  const g = display.getContext('2d');

  const coll = document.createElement('canvas');
  coll.width=w; coll.height=h;
  const gc = coll.getContext('2d');

  // --- COLISIONES: negro = pared, claro = libre ---
  gc.fillStyle='#000'; gc.fillRect(0,0,w,h);           // todo pared
  // Zona libre base (pasillos)
  const free = (x,y,ww,hh)=>{ gc.fillStyle='#ffffff'; gc.fillRect(x,y,ww,hh); };

  free(40,40,w-80, h-80);                         // marco general libre

  // paredes interiores: volvemos a pintar "negro"
  const wall = (x,y,ww,hh)=>{ gc.fillStyle='#000'; gc.fillRect(x,y,ww,hh); };

  // pasillo central (pared)
  wall(w*0.48,40, w*0.04, h-80);

  // habitaciones cuadriculadas a ambos lados, con puertas (aperturas blancas)
  for(let i=0;i<5;i++){
    wall(60, 90 + i*90, 180, 12);
    wall(w-240, 90 + i*90, 180, 12);
  }
  // puertas
  const door = (x,y,ww,hh)=>{ gc.fillStyle='#ffffff'; gc.fillRect(x,y,ww,hh); };
  for(let i=0;i<5;i++){
    door(230, 86 + i*90, 22, 20);
    door(w-252, 86 + i*90, 22, 20);
  }
  // sala inferior con pared larga y dos puertas
  wall(60, h-220, w-120, 12);
  door(w*0.25, h-226, 30, 26);
  door(w*0.75-30, h-226, 30, 26);

  // Borde exterior grueso
  wall(0,0,w,28); wall(0,h-28,w,28); wall(0,0,28,h); wall(w-28,0,28,h);

  // Guardamos ImageData de colisión
  const collisionImageData = gc.getImageData(0,0,w,h);

  // --- DISPLAY COLORIDO ---
  const grd = g.createLinearGradient(0,0,0,h);
  grd.addColorStop(0,'#0b1220'); grd.addColorStop(1,'#0a0f1d');
  g.fillStyle = grd; g.fillRect(0,0,w,h);

  // coloreamos zonas libres leyendo de collision
  const img = collisionImageData;
  const data = img.data;
  for(let y=0;y<h;y+=4){
    for(let x=0;x<w;x+=4){
      const i = (y*w + x)*4;
      const isBlack = data[i]<5 && data[i+1]<5 && data[i+2]<5;
      if(!isBlack){
        g.fillStyle = (x+y)%16===0 ? '#0ea5e933' : '#22c55e21';
        g.fillRect(x,y,4,4);
      }
    }
  }
  // dibujamos paredes con tono oscuro
  g.globalAlpha=.85;
  g.drawImage(coll,0,0);
  g.globalCompositeOperation='source-in';
  g.fillStyle='#111827'; g.fillRect(0,0,w,h);
  g.globalCompositeOperation='source-over'; g.globalAlpha=1;

  // Huellitas/estrellas
  for(let i=0;i<60;i++){
    g.globalAlpha = .25;
    g.beginPath();
    const rx = Math.random()*w, ry = Math.random()*h;
    g.arc(rx, ry, Math.random()*1.6+0.4, 0, Math.PI*2);
    g.fillStyle = Math.random()<.5 ? '#60a5fa' : '#f59e0b';
    g.fill();
  }
  g.globalAlpha = 1;

  return { display, collision: collisionImageData };
}

/* ---------- Inicialización del juego ---------- */

async function init(){
  buildMiscSprites();
  await loadPlayerSprites();

  positionBadges();

  btnStart.disabled = false;
}


function placeEntities(){
  viruses = [];
  candies = [];

  // Posición inicial del jugador
  let start;
  do {
    start = findFreeSpot(800);
  } while (
    circleHitsWall(start.x, start.y, player.collisionRadius+2) || (start.x < 350 && start.y < 210)
  );

  player.x = start.x;
  player.y = start.y;

  startPosition = {
    x: start.x,
    y: start.y
  };


  // Mostrar mensaje durante 3 segundos
  startMessageUntil = performance.now() + 3000;


  // Médico: garantizar alcanzable mediante BFS
  let candidate = null, tries = 0;
  do{
    candidate = findFreeSpot(800);
    tries++;
  } while(
    (dist(candidate.x,candidate.y, player.x,player.y) < 260 // que no aparezca pegado al jugador
     || !isReachable(player.x, player.y, candidate.x, candidate.y)) // y que sea alcanzable
    && tries < 3000
  );
  // Fallback extremo: si no encontramos, colocamos al médico cerca del jugador en una celda libre alcanzable
  if(!isReachable(player.x, player.y, candidate.x, candidate.y)){
    candidate = {x: player.x + 120, y: player.y};
    let guard=0;
    while((circleHitsWall(candidate.x, candidate.y, CONFIG.doctor.radius) || !isReachable(player.x, player.y, candidate.x, candidate.y)) && guard<200){
      candidate = findFreeSpot(500); guard++;
    }
  }
  doctor = { x:candidate.x, y:candidate.y, r: CONFIG.doctor.radius };

  // Caramelos distribuidos
  for(let i=0;i<CONFIG.candy.count;i++){
    let c; let ok=false; let guard=0;
    do{
      c = findFreeSpot(800);
      ok = dist(c.x,c.y,player.x,player.y) > 80 && dist(c.x,c.y,doctor.x,doctor.y)>80;
      guard++;
    } while((circleHitsWall(c.x,c.y,CONFIG.candy.radius) || !ok) && guard<1000);
    candies.push({ x:c.x, y:c.y, r:CONFIG.candy.radius, taken:false });
  }

  // Virus: direcciones aleatorias + crecimiento
  for(let i=0;i<CONFIG.virus.count;i++){
    let p; let guard=0;
    do{
      p = findFreeSpotVirus(800);
      guard++;
    }while((circleHitsWall(p.x,p.y,CONFIG.virus.radiusMin+2) || dist(p.x,p.y,player.x,player.y)<140) && guard<1000);

    const sp = rand(CONFIG.virus.speedMin, CONFIG.virus.speedMax);
    const ang = Math.random()*Math.PI*2;
    const r0 = rand(CONFIG.virus.radiusMin, CONFIG.virus.radiusMax);
    const growth = rand(CONFIG.virus.growthMin, CONFIG.virus.growthMax) / 60; // px/seg
    viruses.push({
      x:p.x, y:p.y, r:r0, r0,
      vx:Math.cos(ang), vy:Math.sin(ang),
      speed: sp,
      grow: growth
    });
  }

  candiesLeft.textContent = candies.filter(c=>!c.taken).length;
  virusCount.textContent = viruses.length;
}

/* ---------- Bucle principal ---------- */

function gameLoop(ts){
  if(!running) return;
  const t = ts/1000;
  const dt = Math.min(0.033, t - (lastTime||t)); // clamp ~30ms
  lastTime = t;

  update(dt);
  render();

  if(running) requestAnimationFrame(gameLoop);
}

function update(dt){
  movePlayer(dt);

  // Virus se mueven y crecen
  for(const v of viruses){
    moveBounce(v, dt);
    v.r += v.grow * dt;
  }

  // Colisiones: jugador con virus
  if(player.iTimer>0) player.iTimer -= dt;
  for(const v of viruses){
    const d = dist(player.x,player.y, v.x,v.y);
    if(d < player.r + v.r){
      if(player.iTimer<=0){
        const scale = Math.max(0.6, v.r / v.r0);
        const dmg = CONFIG.virus.baseDPS * scale * dt * 100; // ajustado
        player.life -= dmg;
        player.iTimer = CONFIG.player.iFrames;
        if(player.life <= 0){
          player.life = 0; lose();
        }
      }
    }
  }

  // Caramelos
  for(const c of candies){
    if(!c.taken && dist(player.x,player.y,c.x,c.y) < player.r + c.r){
      c.taken = true;
      player.life = Math.min(CONFIG.player.maxLife, player.life + CONFIG.candy.heal);
      candiesLeft.textContent = candies.filter(k=>!k.taken).length;
    }
  }

  // ¿llegó al médico?
  if(dist(player.x,player.y, doctor.x,doctor.y) < player.r + doctor.r){
    win();
  }

  // HUD
  const lifePct = (player.life / CONFIG.player.maxLife)*100;
  lifeFill.style.width = Math.max(0,Math.min(100, lifePct)) + '%';
  lifeFill.style.background = lifePct>60 ? 'linear-gradient(90deg,#16a34a,#22c55e)' :
                                lifePct>30 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' :
                                             'linear-gradient(90deg,#ef4444,#f87171)';
}

function render(){
  // Mapa base
  if(mapImage && !usingExampleMap){
    ctx.drawImage(mapImage, 0,0, canvas.width, canvas.height);
    ctx.fillStyle = '#60a5fa12'; ctx.fillRect(0,0,canvas.width,canvas.height);
  }else{
    ctx.drawImage(mapImage, 0,0);
  }

  // Overlay de paredes visible (azul)
  if(wallOverlayCanvas){
    ctx.save();
    ctx.globalAlpha = 0.9; // bien visible
    ctx.drawImage(wallOverlayCanvas, 0, 0);
    ctx.restore();
  }

  // "aura" bajo el jugador
  ctx.save();
  ctx.globalAlpha = .12;
  ctx.beginPath(); ctx.arc(player.x, player.y, 42, 0, Math.PI*2);
  ctx.fillStyle = '#22c55e'; ctx.fill();
  ctx.restore();

  // Caramelos
  for(const c of candies){
    if(c.taken) continue;
    ctx.drawImage(imgCandy, c.x-16, c.y-16, 32, 32);
  }

  // Médico
// Médico 👨‍⚕️
ctx.save();

const pulse = 1 + Math.sin(performance.now() / 300) * 0.08;

// Círculo verde detrás del médico
ctx.globalAlpha = 0.25;
ctx.beginPath();
ctx.arc(
  doctor.x,
  doctor.y,
  34 * pulse,
  0,
  Math.PI * 2
);
ctx.fillStyle = '#22c55e';
ctx.fill();

// Anillo verde
ctx.globalAlpha = 0.9;
ctx.beginPath();
ctx.arc(
  doctor.x,
  doctor.y,
  28 * pulse,
  0,
  Math.PI * 2
);
ctx.strokeStyle = '#86efac';
ctx.lineWidth = 3;
ctx.stroke();

// Emoji del médico
ctx.globalAlpha = 1;
ctx.font = '48px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

ctx.fillText('👨‍⚕️', doctor.x, doctor.y);

ctx.restore();


  // Virus
  for(const v of viruses){
    const s = (v.r/18)*36; // escala sprite aprox
    ctx.drawImage(imgVirus, v.x - s/2, v.y - s/2, s, s);
  }

  // Jugador (con pequeño flash si está en iFrames)
  ctx.save();
  if(player.iTimer>0){
    ctx.globalAlpha = .5 + .5*Math.sin(performance.now()/40);
  }
  const sp = player.sprite;
  const size = player.r * 3.2;
  ctx.drawImage(sp, player.x - size/2, player.y - size/2, size, size);
  ctx.restore();

  // Borde suave
  const grd = ctx.createLinearGradient(0,0,0,canvas.height);
  grd.addColorStop(0,'#0006'); grd.addColorStop(1,'#0003');
  ctx.fillStyle = grd; ctx.fillRect(0,0,canvas.width,8);
  ctx.fillRect(0,canvas.height-8,canvas.width,8);

  // ---------- Mensaje de inicio sobre el personaje ----------
  if(performance.now() < startMessageUntil && player){

    const remaining = startMessageUntil - performance.now();

    // Desaparece suavemente durante los últimos 700 ms
    const fade = Math.min(1, remaining / 700);

    ctx.save();

    // El mensaje se coloca encima del personaje
    const messageX = player.x;
    const messageY = player.y - 75;

    const boxWidth = 260;
    const boxHeight = 68;

    const boxX = messageX - boxWidth / 2;
    const boxY = messageY - boxHeight / 2;

    // Fondo del mensaje
    ctx.globalAlpha = 0.92 * fade;

    ctx.fillStyle = '#0f172a';

    ctx.beginPath();
    ctx.roundRect(
      boxX,
      boxY,
      boxWidth,
      boxHeight,
      14
    );
    ctx.fill();

    // Borde verde
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Texto principal
    ctx.globalAlpha = fade;

    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#ffffff';

    ctx.fillText(
      '🟢 ¡COMIENZAS AQUÍ!',
      messageX,
      boxY + 23
    );

    // Subtexto
    ctx.font = '14px system-ui';
    ctx.fillStyle = '#d1d5db';

    ctx.fillText(
      'Encuentra al médico 👨‍⚕️',
      messageX,
      boxY + 48
    );

    // Pequeña flecha apuntando al personaje
    ctx.fillStyle = '#22c55e';

    ctx.beginPath();
    ctx.moveTo(messageX - 8, boxY + boxHeight);
    ctx.lineTo(messageX + 8, boxY + boxHeight);
    ctx.lineTo(messageX, boxY + boxHeight + 12);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }


}

function selectMap(map){
  selectedMap = map;

  document.getElementById('mapDefault').style.borderColor = '#ffffff14';
  document.getElementById('mapHospital').style.borderColor = '#ffffff14';
  document.getElementById('mapHard').style.borderColor = '#ffffff14';

  if(map === 'default'){
    document.getElementById('mapDefault').style.borderColor = '#22c55e';
  }

  if(map === 'hospital'){
    document.getElementById('mapHospital').style.borderColor = '#22c55e';
  }

  if(map === 'hard'){
    document.getElementById('mapHard').style.borderColor = '#22c55e';
  }

  console.log('Mapa elegido:', selectedMap);
}

selectMap('hospital');


/* ---------- Estados (win/lose/restart) ---------- */
function win(){
  if(won||lost) return;
  won = true; running=false;
  overlayWin.classList.add('show');
}
function lose(){
  if(won||lost) return;
  lost = true; running=false;
  overlayLose.classList.add('show');
}
function restart(){
  // Detener la partida actual
  running = false;

  // Ocultar pantallas de resultado
  overlayWin.classList.remove('show');
  overlayLose.classList.remove('show');

  // Mostrar selección de personaje
  overlayMenu.classList.add('show');

  // Mantener el personaje seleccionado
  // para poder volver a jugar directamente
  if(chosen){
    btnStart.disabled = false;
  }else{
    btnStart.disabled = true;
  }

  // Reiniciar estados
  won = false;
  lost = false;

  // Reiniciar teclas
  keys.w = false;
  keys.a = false;
  keys.s = false;
  keys.d = false;

  keys.up = false;
  keys.down = false;
  keys.left = false;
  keys.right = false;

  // Detener control del mouse
  mouseControl.active = false;
}



/* ---------- Input ---------- */
window.addEventListener('keydown', (e)=>{
  const k = e.key.toLowerCase();

  if([
    'arrowup',
    'arrowdown',
    'arrowleft',
    'arrowright',
    'w','a','s','d'
  ].includes(k)){
    e.preventDefault();
  }

  if(k === 'w' || k === 'arrowup'){
    keys.w = true;
    keys.up = true;
  }

  if(k === 's' || k === 'arrowdown'){
    keys.s = true;
    keys.down = true;
  }

  if(k === 'a' || k === 'arrowleft'){
    keys.a = true;
    keys.left = true;
  }

  if(k === 'd' || k === 'arrowright'){
    keys.d = true;
    keys.right = true;
  }
});

window.addEventListener('keyup', (e)=>{
  const k = e.key.toLowerCase();

  if(k === 'w' || k === 'arrowup'){
    keys.w = false;
    keys.up = false;
  }

  if(k === 's' || k === 'arrowdown'){
    keys.s = false;
    keys.down = false;
  }

  if(k === 'a' || k === 'arrowleft'){
    keys.a = false;
    keys.left = false;
  }

  if(k === 'd' || k === 'arrowright'){
    keys.d = false;
    keys.right = false;
  }
});
/* ---------- Control con mouse ---------- */
canvas.addEventListener('pointerdown', (e) => {
  if(e.pointerType !== 'mouse') return;

  mouseControl.active = true;

  updatePointerPosition(e.clientX, e.clientY);

  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if(!mouseControl.active) return;

  updatePointerPosition(e.clientX, e.clientY);
});

canvas.addEventListener('pointerup', (e) => {
  mouseControl.active = false;

  if(canvas.hasPointerCapture(e.pointerId)){
    canvas.releasePointerCapture(e.pointerId);
  }
});


window.addEventListener('blur', () => {
  mouseControl.active = false;
});


/* ---------- Control táctil ---------- */
canvas.addEventListener('touchstart', (e)=>{
  e.preventDefault();

  const touch = e.touches[0];

  mouseControl.active = true;

  updatePointerPosition(
    touch.clientX,
    touch.clientY
  );
}, {passive:false});

canvas.addEventListener('touchmove', (e)=>{
  e.preventDefault();

  if(!mouseControl.active) return;

  const touch = e.touches[0];

  updatePointerPosition(
    touch.clientX,
    touch.clientY
  );
}, {passive:false});

canvas.addEventListener('touchend', (e)=>{
  e.preventDefault();
  mouseControl.active = false;
}, {passive:false});


function updatePointerPosition(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();

  const scale = Math.min(
    rect.width / canvas.width,
    rect.height / canvas.height
  );

  const displayedWidth = canvas.width * scale;
  const displayedHeight = canvas.height * scale;

  const offsetX = (rect.width - displayedWidth) / 2;
  const offsetY = (rect.height - displayedHeight) / 2;

  let x = (clientX - rect.left - offsetX) / scale;
  let y = (clientY - rect.top - offsetY) / scale;

  mouseControl.x = Math.max(0, Math.min(canvas.width, x));
  mouseControl.y = Math.max(0, Math.min(canvas.height, y));
}


/* ---------- Menú / flujo de inicio ---------- */
document.getElementById('pickMale').addEventListener('click', ()=>{
  chosen = 'male';
  document.getElementById('pickMale').style.borderColor = '#60a5fa';
  document.getElementById('pickFemale').style.borderColor = '#ffffff14';
  btnStart.disabled = false;
});
document.getElementById('pickFemale').addEventListener('click', ()=>{
  chosen = 'female';
  document.getElementById('pickFemale').style.borderColor = '#60a5fa';
  document.getElementById('pickMale').style.borderColor = '#ffffff14';
  btnStart.disabled = false;
});
document.getElementById('pickMale').addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' ') document.getElementById('pickMale').click(); });
document.getElementById('pickFemale').addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' ') document.getElementById('pickFemale').click(); });

btnStart.addEventListener('click', async ()=>{
  if(!chosen) return;
  overlayMenu.classList.remove('show');

  await loadMap();

  // Instancia de jugador
  player = {
    x: 50,
    y: 50,

    // Tamaño visual
    r: CONFIG.player.radius,

    // Tamaño usado para colisiones
    collisionRadius: CONFIG.player.collisionRadius,

    speed: chosen==='female'
      ? CONFIG.player.speedFemale
      : CONFIG.player.speed,

    life: CONFIG.player.maxLife,
    sprite: chosen==='female' ? spriteFemale : spriteMale,
    iTimer: 0
  };


  placeEntities();
  lastTime = 0; won=false; lost=false; running=true;
  requestAnimationFrame(gameLoop);
});

btnTestMap.addEventListener('click', async ()=>{
  // Fuerza el mapa de ejemplo en caso de tener mapa.png, útil para probar
  usingExampleMap = true;
  const gen = generateHospitalExample(CONFIG.desiredCanvasWidth, CONFIG.desiredCanvasHeight);
  mapImage = gen.display;
  collisionImageData = gen.collision;
  canvas.width = mapCanvas.width = gen.collision.width;
  canvas.height = mapCanvas.height = gen.collision.height;
  buildWallOverlay();
  ctx.drawImage(mapImage,0,0);
  positionBadges();
});

/* ---------- Helpers ---------- */
function rand(a,b){ return a + Math.random()*(b-a); }

/* ---------- ¡Arranque! ---------- */
init();
