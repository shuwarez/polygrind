/* ---------- 1. ХОЛСТ И БАЗОВЫЕ УТИЛИТЫ ---------- */
const cv = document.getElementById('cv');          // сам холст
const ctx = cv.getContext('2d');                   // 2D-контекст рисования
const nativeFillText = ctx.fillText.bind(ctx);      // Canvas-текст проходит через тот же словарь
ctx.fillText = (value, ...args) => nativeFillText(tr(String(value)), ...args);
let W = 0, H = 0;                                  // размеры окна в пикселях
const MAX_GAME_DPR = 1.5;                          // retina выше 1.5 слишком дорога для полноэкранного 2D Canvas
let RENDER_DPR = 1;
function resize(){                                 // подгоняем холст под окно с учётом retina
  const rawDpr = Math.max(1, Number(window.devicePixelRatio) || 1);
  const d = RENDER_DPR = Math.min(rawDpr, MAX_GAME_DPR);
  W = cv.clientWidth; H = cv.clientHeight;
  const pixelW=Math.max(1,Math.round(W*d)),pixelH=Math.max(1,Math.round(H*d));
  if (cv.width!==pixelW) cv.width=pixelW;
  if (cv.height!==pixelH) cv.height=pixelH;
  ctx.setTransform(d,0,0,d,0,0);
}
window.addEventListener('resize', resize);

const rnd  = (a,b)=> a + Math.random()*(b-a);      // случайное число в диапазоне
const rndi = (a,b)=> Math.floor(rnd(a,b+1));       // случайное целое включительно
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp= (v,a,b)=> v<a?a:v>b?b:v;
const dist = (a,b)=> Math.hypot(a.x-b.x, a.y-b.y);
function distSq(a,b){ const dx=a.x-b.x,dy=a.y-b.y; return dx*dx+dy*dy; }
const armorReduction = armor => armor / (armor + 90) * 100;

const INJURED_HP_THRESHOLD = 0.60;                  // ровно 60% уже считается раненым
const EXECUTE_HP_THRESHOLD = 0.10;                  // ровно 10% уже достаточно для добивания
const RECENT_KILL_DAMAGE_DURATION = 1;              // убийство обновляет, но не складывает длительность
const STUN_DURATION = 0.5;                          // база; «Длительность всех эффектов» масштабирует её
const DASH_COOLDOWN = 5;                            // один заряд возвращается за пять секунд
const DASH_DURATION = 0.22;                         // было 0.14: рывок стал ощутимо длиннее
const DASH_SPEED_MULT = 4.4;                        // было ×3.4: около 240 единиц вместо 120
const MINION_DAMAGE_MULT = 0.50;                    // вся свита наносит половину прежнего урона
const MINION_AILMENT_CHANCE_MULT = 0.25;            // её шансы негативных эффектов уменьшены на 75%

const ARENA = 1500;                                // арена — квадрат ARENA×ARENA вокруг нуля
const ENEMY_GRID_CELL = 128;                        // крупнее обычного врага, но меньше радиуса самонаведения
const ENEMY_GRID_OFFSET = 32768;                    // числовой ключ без строк и лишних аллокаций
const RICOCHET_SHARD_RANGE = 450;                  // локальный поиск цели, не зависит от размера арены
const RICOCHET_SHARD_DAMAGE = 0.45;                // доля урона исходного попадания
const RICOCHET_SHARD_CAP = 3;                      // жёсткий потолок разветвления одного снаряда
const SPLIT_ARROW_DAMAGE = 0.22;
const SPLIT_ARROW_ANGLE = Math.PI/6;
const RETURN_ARROW_DAMAGE = 0.30;

function enemyGridKey(cx,cy){
  return (cy+ENEMY_GRID_OFFSET)*65536 + cx+ENEMY_GRID_OFFSET;
}

/* Враг хранится только в ячейке своего центра. Запрос расширяется на максимальный
   радиус кадра, поэтому крупный босс на границе ячейки не может быть пропущен. */
function clearEnemySpatialGrid(grid){
  if (!grid) return;
  for (const cell of grid.cells.values()){
    cell.length=0;grid.cellPool.push(cell);
  }
  grid.cells.clear();grid.order.clear();if (grid.keys) grid.keys.clear();
  grid.maxRadius=0;grid.nextOrder=0;
}
function takeEnemyGridCell(grid){
  const cell=grid.cellPool.length?grid.cellPool.pop():[];cell.length=0;return cell;
}
function buildEnemySpatialGrid(enemies=G.enemies,trackMoves=false,reuse=null){
  const grid=reuse||{cells:new Map(),order:new Map(),maxRadius:0,
    keys:trackMoves?new Map():null,nextOrder:0,cellPool:[]};
  if (reuse) clearEnemySpatialGrid(grid);
  const cells=grid.cells,order=grid.order;
  if (trackMoves&&!grid.keys) grid.keys=new Map();
  let maxRadius=0;
  for (let index=0; index<enemies.length; index++){
    const e=enemies[index];
    const cx=Math.floor(e.x/ENEMY_GRID_CELL), cy=Math.floor(e.y/ENEMY_GRID_CELL);
    const key=enemyGridKey(cx,cy), cell=cells.get(key);
    if (cell) cell.push(e); else {const fresh=takeEnemyGridCell(grid);fresh.push(e);cells.set(key,fresh);}
    order.set(e,index);
    if (grid.keys) grid.keys.set(e,key);
    maxRadius=Math.max(maxRadius,e.r||0);
  }
  grid.maxRadius=maxRadius;grid.nextOrder=enemies.length;return grid;
}

let ACTIVE_ENEMY_LOGIC_GRID=null;

function addEnemyToSpatialGrid(grid,e){
  if (!grid || !grid.keys || !e || grid.order.has(e)) return false;
  const key=enemyGridKey(Math.floor(e.x/ENEMY_GRID_CELL),Math.floor(e.y/ENEMY_GRID_CELL));
  const cell=grid.cells.get(key);
  if (cell) cell.push(e); else {const fresh=takeEnemyGridCell(grid);fresh.push(e);grid.cells.set(key,fresh);}
  grid.order.set(e,grid.nextOrder++); grid.keys.set(e,key);
  grid.maxRadius=Math.max(grid.maxRadius,e.r||0);
  return true;
}

function removeEnemyFromSpatialGrid(grid,e){
  if (!grid || !grid.keys || !grid.order.has(e)) return false;
  const key=grid.keys.get(e),cell=grid.cells.get(key),index=cell?cell.indexOf(e):-1;
  if (index>=0){ cell.splice(index,1); if (!cell.length){grid.cells.delete(key);grid.cellPool.push(cell);} }
  grid.keys.delete(e); grid.order.delete(e);
  return true;
}

/* Динамическая сетка нужна логике врагов: уже обработанный источник ауры мог
   пересечь границу ячейки. Перекладываем только его, сохраняя исходный порядок
   массива — порядок проверок и связанных эффектов остаётся прежним. */
function updateEnemySpatialGridPosition(grid,e){
  if (!grid || !grid.keys || !grid.order.has(e)) return false;
  const oldKey=grid.keys.get(e);
  const newKey=enemyGridKey(Math.floor(e.x/ENEMY_GRID_CELL),Math.floor(e.y/ENEMY_GRID_CELL));
  if (oldKey===newKey) return false;
  const oldCell=grid.cells.get(oldKey), oldIndex=oldCell?oldCell.indexOf(e):-1;
  if (oldIndex>=0){ oldCell.splice(oldIndex,1); if (!oldCell.length){grid.cells.delete(oldKey);grid.cellPool.push(oldCell);} }
  let cell=grid.cells.get(newKey);
  if (!cell){ cell=takeEnemyGridCell(grid); grid.cells.set(newKey,cell); }
  const order=grid.order.get(e);
  let at=cell.length;
  while (at>0 && grid.order.get(cell[at-1])>order) at--;
  cell.splice(at,0,e); grid.keys.set(e,newKey);
  return true;
}

/* Возвращаем кандидатов в исходном порядке G.enemies: попадания, равные дистанции
   и все завязанные на них проки обязаны оставаться детерминированными. */
function enemySpatialCandidates(grid,x,y,range){
  if (!grid || range<0) return [];
  const minX=Math.floor((x-range)/ENEMY_GRID_CELL), maxX=Math.floor((x+range)/ENEMY_GRID_CELL);
  const minY=Math.floor((y-range)/ENEMY_GRID_CELL), maxY=Math.floor((y+range)/ENEMY_GRID_CELL);
  let found=null, merged=false;
  for (let cy=minY; cy<=maxY; cy++) for (let cx=minX; cx<=maxX; cx++){
    const cell=grid.cells.get(enemyGridKey(cx,cy));
    if (!cell) continue;
    if (!found) found=cell;
    else {
      if (!merged){ found=found.slice(); merged=true; }
      found.push(...cell);
    }
  }
  if (!found) return [];
  if (merged) found.sort((a,b)=>grid.order.get(a)-grid.order.get(b));
  return found;
}

/* Быстрый список остаётся только грубым супермножеством. Каждый эффект ниже
   повторяет свою прежнюю точную проверку (< или <=, с радиусом цели), поэтому
   границы механик не зависят от размера ячейки. */
function enemyAreaCandidates(grid,x,y,radius){
  return grid?enemySpatialCandidates(grid,x,y,radius+grid.maxRadius):G.enemies;
}

/* Когда нужны только первые несколько ближайших целей, полная сортировка всех
   врагов создаёт лишний массив и многократно пересчитывает те же расстояния.
   Держим отсортированным только короткий результат. Строгое сравнение при
   вставке сохраняет исходный порядок G.enemies у целей на равной дистанции —
   это та же стабильность, которую давал Array.sort(). */
function nearestEnemies(from,count,accept=null,candidates=G.enemies){
  count=Math.max(0,Math.floor(count||0));
  if (!count) return [];
  const best=[];
  for (const e of candidates){
    const d=dist(e,from);
    if (accept && !accept(e,d)) continue;
    let at=best.length;
    while (at>0 && d<best[at-1][0]) at--;
    if (at>=count) continue;
    best.splice(at,0,[d,e]);
    if (best.length>count) best.pop();
  }
  return best.map(x=>x[1]);
}

/* Массовая атака обязана обработать все цели по расстоянию, поэтому top-k ей
   не подходит. Но старый comparator заново вызывал hypot много раз на одну
   цель. Сохраняем дистанцию при единственном проходе и сортируем числа;
   стабильная сортировка оставляет порядок G.enemies при точном равенстве. */
function sortedEnemyTargets(from,candidates=G.enemies,accept=null){
  const found=[];
  for (const e of candidates){
    const d=dist(e,from);
    if (!accept || accept(e,d)) found.push([d,e]);
  }
  found.sort((a,b)=>a[0]-b[0]);
  return found.map(x=>x[1]);
}

function chillAuraAffectsEnemy(e,chillGrid){
  if (!e || !chillGrid) return false;
  const range=D.chillAuraR+(e.r||0);
  const minX=Math.floor((e.x-range)/ENEMY_GRID_CELL),maxX=Math.floor((e.x+range)/ENEMY_GRID_CELL);
  const minY=Math.floor((e.y-range)/ENEMY_GRID_CELL),maxY=Math.floor((e.y+range)/ENEMY_GRID_CELL);
  for(let cy=minY;cy<=maxY;cy++)for(let cx=minX;cx<=maxX;cx++){
    const cell=chillGrid.cells.get(enemyGridKey(cx,cy));if(!cell)continue;
    for(const src of cell)if(src!==e&&dist(src,e)<=range)return true;
  }
  return false;
}
const RETURN_ARROW_PERIOD = 13;
const HUNTER_MARK_PERIOD = 6;
const HUNTER_MARK_DURATION = 4;
const HUNTER_MARK_DAMAGE_INC = 15;
const HUNTER_MARK_CAP = 2;
const MOUSE_DEADZONE = 34;                         // радиус покоя вокруг игрока при управлении мышью
const CAMERA_SCALE = 0.95;                         // мир отдалён на 5%; экранные слои остаются 1:1

function prepareCameraFrame(p=G&&G.player,sx=0,sy=0){
  return {scale:CAMERA_SCALE,centerX:p.x,centerY:p.y,
          shakeX:sx||0,shakeY:sy||0};
}
function screenToWorld(x,y,p=G&&G.player,sx=0,sy=0,frame=null){
  const camera=frame||prepareCameraFrame(p,sx,sy);
  return {x:camera.centerX+(x-W/2-camera.shakeX)/camera.scale,
          y:camera.centerY+(y-H/2-camera.shakeY)/camera.scale};
}
function worldToScreen(x,y,p=G&&G.player,sx=0,sy=0,frame=null){
  const camera=frame||prepareCameraFrame(p,sx,sy);
  return {x:W/2+camera.shakeX+(x-camera.centerX)*camera.scale,
          y:H/2+camera.shakeY+(y-camera.centerY)*camera.scale};
}

/* Пол хранится прямо в HTML: индексированная PNG 512×512 весит меньше 10 КБ,
   не требует assets и остаётся привязанной к мировым координатам при движении камеры.
   До готовности Image используется прежний графитовый фон с сеткой. */
const FLOOR_TILE_DATA = Object.freeze([
  /* FLOOR_TEXTURE_DATA_START */
  'assets/images/effects/found-e4460c1aaa.webp', // floor_01_slate.png
  'assets/images/heroes/image-1a8e3fc27f.webp', // floor_02_cracked.png
  'assets/images/heroes/image-002-4138fa98c5.webp', // floor_03_damp.png
  'assets/images/heroes/image-003-047de2f027.webp', // floor_04_temple.png
  'assets/images/heroes/image-004-8c734e43cb.webp', // floor_05_basalt.png
  'assets/images/heroes/image-005-14e378edf7.webp', // floor_06_iron.png
  'assets/images/heroes/image-006-4a4595906c.webp', // floor_07_ash.png
  'assets/images/heroes/image-007-977646d688.webp', // floor_08_crystal.png
  'assets/images/heroes/image-008-13f6b64a76.webp', // floor_09_forge.png
  'assets/images/heroes/image-009-41dbaa17b2.webp', // floor_10_frost.png
  /* FLOOR_TEXTURE_DATA_END */
]);
const FLOOR_TILE_NAMES = Object.freeze([
  'slate','cracked','damp','temple','basalt',
  'iron','ash','crystal','forge','frost'
]);
const FLOOR_TILE_WORLD_SIZE = 256;                 // 48px-герой больше не теряется рядом с плитами и болтами
const FLOOR_TILES = new Array(FLOOR_TILE_DATA.length).fill(null);
const FLOOR_PATTERNS = new Array(FLOOR_TILE_DATA.length).fill(null);
let floorPattern = null;
let floorTextureIndex = -1;                        // выбранный вариант текущего этажа
let floorPatternIndex = -1;                        // фактически используемый ready/fallback pattern

/* Отдельный RNG пола не расходует Math.random и потому не меняет спавн,
   награды и остальные игровые последовательности. */
let floorTextureRngState = (() => {
  let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues){
    const words = new Uint32Array(1); crypto.getRandomValues(words); seed ^= words[0];
  }
  return seed || 0x6d2b79f5;
})();
function nextFloorTextureIndex(){
  let x = floorTextureRngState;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  floorTextureRngState = (x >>> 0) || 0x6d2b79f5;
  return floorTextureRngState % FLOOR_TILE_DATA.length;
}
function createFloorPattern(image){
  // Уменьшение и затемнение выполняются один раз при загрузке, а не 60 раз/сек.
  const tile = document.createElement('canvas');
  tile.width = FLOOR_TILE_WORLD_SIZE; tile.height = FLOOR_TILE_WORLD_SIZE;
  const g = tile.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(image, 0, 0, tile.width, tile.height);
  g.fillStyle = '#070a0d18';
  g.fillRect(0, 0, tile.width, tile.height);
  return ctx.createPattern(tile, 'repeat');
}
function selectRandomFloorPattern(forcedIndex=null){
  const count = FLOOR_TILE_DATA.length;
  if (!count){ floorTextureIndex=-1; floorPatternIndex=-1; floorPattern=null; return -1; }
  const raw = Number.isInteger(forcedIndex) ? forcedIndex : nextFloorTextureIndex();
  floorTextureIndex = ((raw % count) + count) % count;
  floorPatternIndex = FLOOR_PATTERNS[floorTextureIndex]
    ? floorTextureIndex : FLOOR_PATTERNS.findIndex(Boolean);
  floorPattern = floorPatternIndex >= 0 ? FLOOR_PATTERNS[floorPatternIndex] : null;
  return floorTextureIndex;
}
if (typeof Image !== 'undefined'){
  for (let i=0; i<FLOOR_TILE_DATA.length; i++){
    const image = new Image();
    image.onload = () => {
      FLOOR_PATTERNS[i] = createFloorPattern(image);
      // До первого buildFloor либо при полном отсутствии ready-pattern разрешён
      // ровно один fallback. Поздняя загрузка не меняет уже показанный этаж.
      if (floorPatternIndex < 0){
        floorPatternIndex = FLOOR_PATTERNS[floorTextureIndex] ? floorTextureIndex : i;
        floorPattern = FLOOR_PATTERNS[floorPatternIndex];
      }
    };
    image.src = FLOOR_TILE_DATA[i];
    FLOOR_TILES[i] = image;
  }
}

/* Присланные пиксельные герои смотрят вправо. Их не вращаем за прицелом:
   персонаж может лишь зеркалиться по горизонтали, иначе при движении вверх
   превращается в нелепо перевёрнутую фигурку. В VM-харнессе Image отсутствует,
   поэтому там автоматически остаются геометрические запасные силуэты. */
const HERO_SPRITES = {};
const SUBCLASS_HERO_SPRITES = {};
const SUBCLASS_FRAME_DATA = {
  animator:'assets/images/heroes/subclass-frame-data-animator-9b930574d3.webp',
  berserker:'assets/images/heroes/subclass-frame-data-berserker-679d7d0158.webp',
  dancer:'assets/images/heroes/subclass-frame-data-dancer-fe8802855e.webp',
  destroyer:'assets/images/heroes/subclass-frame-data-destroyer-598563639c.webp',
  elementalist:'assets/images/heroes/subclass-frame-data-elementalist-8aef740136.webp',
  graverobber:'assets/images/heroes/subclass-frame-data-graverobber-272ee29e09.webp',
  guardian:'assets/images/heroes/subclass-frame-data-guardian-ce2f1ab36c.webp',
  hunter:'assets/images/heroes/subclass-frame-data-hunter-4a0fe34185.webp',
  multiplier:'assets/images/heroes/subclass-frame-data-multiplier-11dc4f7d49.webp',
  swordmaster:'assets/images/heroes/subclass-frame-data-swordmaster-d48f9b54c4.webp',
  thief:'assets/images/heroes/subclass-frame-data-thief-6547110e25.webp',
  venomancer:'assets/images/heroes/subclass-frame-data-venomancer-9c8a74d30d.webp',
};
const CLASS_ICON_SHEET_DATA = {
};

const SKILL_CARD_FRAME_DATA = {
  common:'assets/images/ui/skill-card-frame-data-common-7b600d99db.webp',
  rare:'assets/images/ui/skill-card-frame-data-rare-805bb78d11.webp',
  epic:'assets/images/ui/skill-card-frame-data-epic-89fb999079.webp',
  key:'assets/images/ui/skill-card-frame-data-key-f1e23c0a10.webp',
  blood:'assets/images/environment/skill-card-frame-data-blood-f70ca917fd.webp',
};

const SKILL_CARD_FRAME_CSS_VARS = Object.freeze({
  common:'--skill-frame-common',rare:'--skill-frame-blue',epic:'--skill-frame-purple',
  key:'--skill-frame-orange',blood:'--skill-frame-red'
});
if(document.documentElement){
  for(const rarity of Object.keys(SKILL_CARD_FRAME_CSS_VARS)){
    document.documentElement.style.setProperty(
      SKILL_CARD_FRAME_CSS_VARS[rarity], 'url("' + SKILL_CARD_FRAME_DATA[rarity] + '")');
  }
}

const CLASS_FRAME_DATA = {
  archer:'assets/images/heroes/class-frame-data-archer-55411c642f.webp',
  mage:'assets/images/heroes/class-frame-data-mage-c8d695f2be.webp',
  necromancer:'assets/images/heroes/class-frame-data-necromancer-a67204b69f.webp',
  warrior:'assets/images/heroes/class-frame-data-warrior-fd57ce24c1.webp',
};
const SUBCLASS_HERO_SPRITE_DATA = {
  animator:'assets/images/heroes/subclass-hero-sprite-data-animator-0906919621.webp',
  berserker:'assets/images/heroes/subclass-hero-sprite-data-berserker-1c1cd2de51.webp',
  dancer:'assets/images/heroes/subclass-hero-sprite-data-dancer-882892f769.webp',
  destroyer:'assets/images/heroes/subclass-hero-sprite-data-destroyer-1664df76fa.webp',
  elementalist:'assets/images/heroes/subclass-hero-sprite-data-elementalist-137b3e2d09.webp',
  graverobber:'assets/images/heroes/subclass-hero-sprite-data-graverobber-fb10f31c89.webp',
  guardian:'assets/images/heroes/subclass-hero-sprite-data-guardian-9b4cb6e450.webp',
  hunter:'assets/images/heroes/subclass-hero-sprite-data-hunter-43fb1f51d5.webp',
  multiplier:'assets/images/heroes/subclass-hero-sprite-data-multiplier-d114a66f7f.webp',
  swordmaster:'assets/images/heroes/subclass-hero-sprite-data-swordmaster-186d8b025a.webp',
  thief:'assets/images/heroes/subclass-hero-sprite-data-thief-d1d36d18ef.webp',
  venomancer:'assets/images/heroes/subclass-hero-sprite-data-venomancer-e9466dc75f.webp',
};
const HERO_SPRITE_DATA = {warrior:'assets/images/heroes/hero-sprite-data-warrior-5da2e1a767.webp', archer:'assets/images/heroes/hero-sprite-data-archer-6f0053f7ae.webp', mage:'assets/images/heroes/hero-sprite-data-mage-898570c069.webp', necromancer:'assets/images/heroes/hero-sprite-data-necromancer-ccc76a67ef.webp'};
if (typeof Image !== 'undefined'){
  for (const key of ['archer','mage','necromancer','warrior']){
    const img = new Image(); img.src = HERO_SPRITE_DATA[key]; HERO_SPRITES[key] = img;
  }
  for (const key of Object.keys(SUBCLASS_HERO_SPRITE_DATA)){
    const img = new Image(); img.src = SUBCLASS_HERO_SPRITE_DATA[key]; SUBCLASS_HERO_SPRITES[key] = img;
  }
}

/* Обычные враги упакованы в фиксированные кадры 40/48 px и палитру 16 цветов.
   Все смотрят вправо и только зеркалятся по X; одинаковые прямоугольники кадров
   уменьшают объём текстур и стоимость выбора области drawImage(). */
const ENEMY_SPRITE_DATA = {
  runner:'assets/images/enemies/enemy-sprite-data-runner-ecc8756c9e.webp',
  blob:'assets/images/enemies/enemy-sprite-data-blob-9ef4c5433d.webp',
  tank:'assets/images/enemies/enemy-sprite-data-tank-4eb69a8bf8.webp'
  ,shooter:'assets/images/enemies/enemy-sprite-data-shooter-50e42e6def.webp',
};
/* Шесть разновидностей ближней элиты упакованы в 4×48 px.
   В репозитории хранятся только готовые runtime-листы из assets. */
const ELITE_SPRITE_DATA = {
  frostWolf:'assets/images/enemies/elite-sprite-data-frost-wolf-e477c0af29.webp',
  toxicRunner:'assets/images/enemies/elite-sprite-data-toxic-runner-0e1e97b3d1.webp',
  cursedRogue:'assets/images/enemies/elite-sprite-data-cursed-rogue-0af0c48fd8.webp',
  skeletonWarrior:'assets/images/enemies/elite-sprite-data-skeleton-warrior-0059ea2706.webp',
  blightGrunt:'assets/images/enemies/elite-sprite-data-blight-grunt-26b2f2cc14.webp',
  boneGargoyle:'assets/images/enemies/elite-sprite-data-bone-gargoyle-2b91050111.webp',  fallenPyromancer:'assets/images/enemies/elite-sprite-data-fallen-pyromancer-4929c88e1e.webp',  beholderSlave:'assets/images/enemies/elite-sprite-data-beholder-slave-f967870a4d.webp',  skeletonCrossbow:'assets/images/enemies/elite-sprite-data-skeleton-crossbow-9be5075016.webp',  forgottenGuard:'assets/images/enemies/elite-sprite-data-forgotten-guard-d3a9d85225.webp',  abyssalExecutioner:'assets/images/enemies/elite-sprite-data-abyssal-executioner-10c3fd54de.webp',  plagueOgre:'assets/images/enemies/elite-sprite-data-plague-ogre-7a3662acd6.webp',
};
/* ENEMY_ATTACK_SPRITE_DATA_BEGIN */
const ENEMY_ATTACK_SPRITE_DATA = {
  runner:'assets/images/enemies/enemy-attack-sprite-data-runner-a2e2916514.webp',
  blob:'assets/images/enemies/enemy-attack-sprite-data-blob-197eeeaa25.webp',
  tank:'assets/images/enemies/enemy-attack-sprite-data-tank-6b1ec2d99d.webp',
  shooter:'assets/images/enemies/enemy-attack-sprite-data-shooter-0cc9f73be9.webp',
};
const ELITE_ATTACK_SPRITE_DATA = {
  frostWolf:'assets/images/enemies/elite-attack-sprite-data-frost-wolf-f92cc9ba02.webp',
  toxicRunner:'assets/images/enemies/elite-attack-sprite-data-toxic-runner-ce61852f56.webp',
  cursedRogue:'assets/images/enemies/elite-attack-sprite-data-cursed-rogue-043bc0e345.webp',
  skeletonWarrior:'assets/images/enemies/elite-attack-sprite-data-skeleton-warrior-cde6b5e49a.webp',
  blightGrunt:'assets/images/enemies/elite-attack-sprite-data-blight-grunt-88b1a6f08f.webp',
  boneGargoyle:'assets/images/enemies/elite-attack-sprite-data-bone-gargoyle-d5b5d53209.webp',
  fallenPyromancer:'assets/images/enemies/elite-attack-sprite-data-fallen-pyromancer-aa97192c46.webp',
  beholderSlave:'assets/images/enemies/elite-attack-sprite-data-beholder-slave-693b2618d7.webp',
  skeletonCrossbow:'assets/images/enemies/elite-attack-sprite-data-skeleton-crossbow-a98877ef12.webp',
  forgottenGuard:'assets/images/enemies/elite-attack-sprite-data-forgotten-guard-6e88a0b84e.webp',
  abyssalExecutioner:'assets/images/enemies/elite-attack-sprite-data-abyssal-executioner-9d557200ac.webp',
  plagueOgre:'assets/images/enemies/elite-attack-sprite-data-plague-ogre-292d2a20d9.webp',
};
/* ENEMY_ATTACK_SPRITE_DATA_END */
/* Снаряд Призмы — четыре кадра 8×8 в 16-цветном индексированном PNG.
   Один глобальный кадр анимации обслуживает весь поток без таймера на объект. */
const SHOOTER_PROJECTILE_DATA = 'assets/images/enemies/shooter-projectile-data-d2bf23a800.webp';
/* Четыре фазы сгустка Чумной мерзости по 20×20. Визуальный размер не меняет
   механический радиус снаряда: коллизия по-прежнему использует s.r=8. */
const PLAGUE_SLIME_PROJECTILE_DATA = 'assets/images/bosses/plague-slime-projectile-data-b735da2478.webp';
/* Четыре фазы Изумрудной сферы по 32×32. Отрисовка следует крупному радиусу
   снаряда Лича, а механическая коллизия остаётся привязанной к s.r. */
const EMERALD_ORB_PROJECTILE_DATA = 'assets/images/effects/emerald-orb-projectile-data-3962e91da2.webp';
/* Копьё жадности: четыре стабильные фазы по 64×20. Механический радиус
   остаётся s.r=15, лист меняет только визуализацию атаки Алчного громилы. */
const GREED_SPEAR_PROJECTILE_DATA = 'assets/images/bosses/greed-spear-projectile-data-d233a30838.webp';
/* Вращающийся топор Короля палачей: восемь центрированных фаз 56×56.
   Механический радиус остаётся s.r=30; фазой управляет существующий s.spin. */
const EXECUTIONER_AXE_PROJECTILE_DATA = 'assets/images/bosses/executioner-axe-projectile-data-792d81baeb.webp';
/* Копьё Ужасающего Минотавра: четыре стабильные фазы 64×20.
   Механический радиус остаётся s.r=20; лист поворачивается по вектору скорости. */
const MINOTAUR_SPEAR_PROJECTILE_DATA = 'assets/images/bosses/minotaur-spear-projectile-data-3822975cc0.webp';
/* Игровые снаряды: одна статичная стрела 12×6 и четыре кадра сферы 8×8.
   Оба PNG индексированные, а анимация сферы использует общий кадр G.time. */
const SERAPH_HOLY_SPEAR_DATA = 'assets/images/bosses/seraph-holy-spear-data-c03052a5d9.webp';

const DEMON_QUEEN_BLOB_DATA = 'assets/images/enemies/demon-queen-blob-data-375306a484.webp';

const MATRIARCH_PLAGUE_PROJECTILE_DATA = 'assets/images/bosses/matriarch-plague-projectile-data-1047d8b8d0.webp';

const VOID_GROUND_RIFT_DATA = 'assets/images/environment/void-ground-rift-data-e5c76fdeb1.webp';

const PLAYER_PROJECTILE_DATA = {
  archerProjectile:'assets/images/heroes/player-projectile-data-archer-projectile-04d16066dd.webp',
  mageProjectile:'assets/images/heroes/player-projectile-data-mage-projectile-b1c3e8a9a0.webp'
};
/* Подбираемые предметы: четыре кадра в одной строке. Готовые листы хранятся
   отдельными runtime-файлами в assets/images/items. */
const LOOT_SPRITE_DATA = {
  pickupXp:'assets/images/items/loot-sprite-data-pickup-xp-2b4b0e8ffc.webp',
  pickupGold:'assets/images/items/loot-sprite-data-pickup-gold-b26e84c3f1.webp',
  fire:'assets/images/items/loot-sprite-data-fire-20b1be7318.webp',
  cold:'assets/images/items/loot-sprite-data-cold-af5062d82e.webp',
  shock:'assets/images/items/loot-sprite-data-shock-ba645b325a.webp',
  poison:'assets/images/items/loot-sprite-data-poison-40f2eecc2d.webp',
  bleed:'assets/images/items/loot-sprite-data-bleed-0c183425d5.webp',
  monster:'assets/images/items/loot-sprite-data-monster-27ac7f4bde.webp',
  xp:'assets/images/items/loot-sprite-data-xp-ec2db4e9b5.webp',
};
/* Восемь четырёхкадровых наземных эффектов; механические радиусы не входят в текстуры. */
/* Четыре handoff-листа системы крови: две анимации 4×64, компактный критический
   разлёт 4×32 и восемь декалей 64×64.
   Изображения создаются один раз при загрузке; в кадре новых Image нет. */
const BLOOD_SPRITE_DATA = {
  splash:'assets/images/environment/blood-sprite-data-splash-37bc7d8003.webp',
  mist:'assets/images/environment/blood-sprite-data-mist-db6dd0d580.webp',
  critSpray:'assets/images/environment/blood-sprite-data-crit-spray-b95f19f710.webp',
  decals:'assets/images/environment/blood-sprite-data-decals-247252284a.webp',
};
/* Тридцать статичных трупов устанавливаются из handoff DOCX без изменения
   исходных пикселей. Ключи совпадают с typeKey, eliteVariant и bossId. */
const CORPSE_SPRITE_DATA = {
  blob:'assets/images/enemies/corpse-sprite-data-blob-54c6e4c718.webp',
  runner:'assets/images/enemies/corpse-sprite-data-runner-3c0e40764e.webp',
  tank:'assets/images/enemies/corpse-sprite-data-tank-9ff76e896d.webp',
  shooter:'assets/images/enemies/corpse-sprite-data-shooter-7e7ca9b056.webp',
  frostWolf:'assets/images/enemies/corpse-sprite-data-frost-wolf-44c53994d6.webp',
  toxicRunner:'assets/images/enemies/corpse-sprite-data-toxic-runner-26f1ddab4c.webp',
  cursedRogue:'assets/images/enemies/corpse-sprite-data-cursed-rogue-23ebf8496c.webp',
  skeletonWarrior:'assets/images/enemies/corpse-sprite-data-skeleton-warrior-987d7db6fe.webp',
  blightGrunt:'assets/images/enemies/corpse-sprite-data-blight-grunt-019a7c7ab8.webp',
  boneGargoyle:'assets/images/enemies/corpse-sprite-data-bone-gargoyle-60bf65a962.webp',
  fallenPyromancer:'assets/images/enemies/corpse-sprite-data-fallen-pyromancer-4511a621bb.webp',
  beholderSlave:'assets/images/enemies/corpse-sprite-data-beholder-slave-26c91803cf.webp',
  skeletonCrossbow:'assets/images/enemies/corpse-sprite-data-skeleton-crossbow-d3c4927c8c.webp',
  forgottenGuard:'assets/images/enemies/corpse-sprite-data-forgotten-guard-0c6511bd1e.webp',
  abyssalExecutioner:'assets/images/enemies/corpse-sprite-data-abyssal-executioner-950e319d0a.webp',
  plagueOgre:'assets/images/enemies/corpse-sprite-data-plague-ogre-6cf23a6e38.webp',
  lich:'assets/images/enemies/corpse-sprite-data-lich-1d5043c8fa.webp',
  goat:'assets/images/enemies/corpse-sprite-data-goat-ba1a9874d6.webp',
  plague:'assets/images/enemies/corpse-sprite-data-plague-668130165f.webp',
  greed:'assets/images/enemies/corpse-sprite-data-greed-78e47c0907.webp',
  executioner:'assets/images/enemies/corpse-sprite-data-executioner-1cd6ffd836.webp',
  tyrant:'assets/images/enemies/corpse-sprite-data-tyrant-17570b72b3.webp',
  grave:'assets/images/enemies/corpse-sprite-data-grave-eff0af1701.webp',
  behemoth:'assets/images/enemies/corpse-sprite-data-behemoth-91334b9c4a.webp',
  vampire:'assets/images/enemies/corpse-sprite-data-vampire-5abf4d1e76.webp',
  voidwrath:'assets/images/enemies/corpse-sprite-data-voidwrath-f3b9c17f35.webp',
  minotaur:'assets/images/enemies/corpse-sprite-data-minotaur-845fc0a82b.webp',
  seraph:'assets/images/enemies/corpse-sprite-data-seraph-a0f1e00293.webp',
  matriarch:'assets/images/enemies/corpse-sprite-data-matriarch-29b109018c.webp',
  demonqueen:'assets/images/enemies/corpse-sprite-data-demonqueen-024ecf1ddd.webp',
};
/* Шесть вариантов луж находятся в одном индексированном атласе 6×64. */
const CORPSE_PUDDLE_DATA = {
  atlas:'assets/images/enemies/corpse-puddle-data-atlas-d228ac0c8c.webp',
};
const GROUND_POOL_SPRITE_DATA = {
  tar:'assets/images/environment/ground-pool-sprite-data-tar-4e42bbb86b.webp',
  ogreAcid:'assets/images/environment/ground-pool-sprite-data-ogre-acid-96d119ad46.webp',
  bossAcid:'assets/images/bosses/ground-pool-sprite-data-boss-acid-8df3fd1cda.webp',
  boilingBlood:'assets/images/environment/ground-pool-sprite-data-boiling-blood-ddc7c67a3a.webp',
  lavaTrail:'assets/images/environment/ground-pool-sprite-data-lava-trail-e24ec68199.webp',
  frostTrail:'assets/images/environment/ground-pool-sprite-data-frost-trail-a03a1403b5.webp',
  venomAcid:'assets/images/environment/ground-pool-sprite-data-venom-acid-0970d01669.webp',
  tyrantFire:'assets/images/environment/ground-pool-sprite-data-tyrant-fire-f24ee60504.webp',
};
/* Поддерживаемые редкие предметы и экипировка: статичные палитровые PNG 24×24. */
const RARE_ITEM_SPRITE_DATA = {
  heartSecond:'assets/images/items/rare-item-sprite-data-heart-second-e2f57c0fd8.webp',
  titansHands:'assets/images/items/rare-item-sprite-data-titans-hands-9e5eaf8128.webp',
  stepBeyond:'assets/images/items/rare-item-sprite-data-step-beyond-b172b01b15.webp',
  marchDead:'assets/images/items/rare-item-sprite-data-march-dead-f834ed7a8d.webp',
  zeroDistanceRing:'assets/images/items/rare-item-sprite-data-zero-distance-ring-fcb01788d3.webp',
  invertedCrown:'assets/images/items/rare-item-sprite-data-inverted-crown-d1d49204fe.webp',
  archivist:'assets/images/items/rare-item-sprite-data-archivist-08073ac1ff.webp',
  emptyThroneSeal:'assets/images/items/rare-item-sprite-data-empty-throne-seal-fc822499ff.webp',
  surgeonsHand:'assets/images/items/rare-item-sprite-data-surgeons-hand-4b949f95e2.webp',
  betweenWorldsBoots:'assets/images/items/rare-item-sprite-data-between-worlds-boots-0bc6bdc277.webp',
  unhealedWoundRing:'assets/images/items/rare-item-sprite-data-unhealed-wound-ring-c4d2ac3189.webp',
  deadGodClock:'assets/images/items/rare-item-sprite-data-dead-god-clock-c37b9dc993.webp',
  copperChronometer:'assets/images/items/rare-item-sprite-data-copper-chronometer-cb38e57a53.webp',
  knottedCharm:'assets/images/items/rare-item-sprite-data-knotted-charm-6961f70841.webp',
  tallyGloves:'assets/images/items/rare-item-sprite-data-tally-gloves-ed017630fe.webp',
  smithThumbstall:'assets/images/items/rare-item-sprite-data-smith-thumbstall-67082c07c3.webp',
  draftGloves:'assets/images/items/rare-item-sprite-data-draft-gloves-95315ae683.webp',
  satinGloves:'assets/images/items/rare-item-sprite-data-satin-gloves-2acd889456.webp',
  hobnailedSoles:'assets/images/items/rare-item-sprite-data-hobnailed-soles-adda3feb95.webp',
  shortCircuitBoots:'assets/images/items/rare-item-sprite-data-short-circuit-boots-df092bf9e5.webp',
  trailfinders:'assets/images/items/rare-item-sprite-data-trailfinders-3f96723146.webp',
  boneSpurs:'assets/images/items/rare-item-sprite-data-bone-spurs-a85109dbed.webp',
  firstTraceRing:'assets/images/items/rare-item-sprite-data-first-trace-ring-35a38789d1.webp',
  closeHarvestRing:'assets/images/items/rare-item-sprite-data-close-harvest-ring-564d288e31.webp',
  sealHunt:'assets/images/items/rare-item-sprite-data-seal-hunt-8d9943645d.webp',
  mothFang:'assets/images/items/rare-item-sprite-data-moth-fang-79388a5b12.webp',
  cometEye:'assets/images/items/rare-item-sprite-data-comet-eye-0c041bd5e5.webp',
  sealPack:'assets/images/items/rare-item-sprite-data-seal-pack-6e9bff969c.webp',
  eclipseBrushes:'assets/images/items/rare-item-sprite-data-eclipse-brushes-003c3d4418.webp',
  sparkstepBoots:'assets/images/items/rare-item-sprite-data-sparkstep-boots-8f30465b74.webp',
  marchingGreaves:'assets/images/items/rare-item-sprite-data-marching-greaves-bd06e0beda.webp',
  secondWindRing:'assets/images/items/rare-item-sprite-data-second-wind-ring-d93b3008c1.webp',
  coolingAshRing:'assets/images/items/rare-item-sprite-data-cooling-ash-ring-d26f90c13a.webp',
  confinementRing:'assets/images/items/rare-item-sprite-data-confinement-ring-aad7900ae6.webp',
  reactionRing:'assets/images/items/rare-item-sprite-data-reaction-ring-86e7aceb13.webp',
  conductorRing:'assets/images/items/rare-item-sprite-data-conductor-ring-c68a9dd6bb.webp',
  ledgerDebts:'assets/images/items/rare-item-sprite-data-ledger-debts-dc520d5d38.webp',
  glassBell:'assets/images/items/rare-item-sprite-data-glass-bell-38270a88e1.webp',
  mirror:'assets/images/items/rare-item-sprite-data-mirror-d67bbc5e26.webp',
  golem:'assets/images/items/rare-item-sprite-data-golem-c53bc0d0f4.webp',
  fang:'assets/images/items/rare-item-sprite-data-fang-4c0ed71def.webp',
  storm:'assets/images/items/rare-item-sprite-data-storm-a6edc829d2.webp',
  ash:'assets/images/items/rare-item-sprite-data-ash-26b5ddcf3a.webp',
  ice:'assets/images/items/rare-item-sprite-data-ice-2b047ea100.webp',
  plague:'assets/images/items/rare-item-sprite-data-plague-e254adc329.webp',
  clock:'assets/images/items/rare-item-sprite-data-clock-965290b45f.webp',
  shard:'assets/images/items/rare-item-sprite-data-shard-8eeb56e1ca.webp',
  bone:'assets/images/items/rare-item-sprite-data-bone-632784d8a4.webp',
  candle:'assets/images/items/rare-item-sprite-data-candle-57b45f5c14.webp',
  calm:'assets/images/items/rare-item-sprite-data-calm-218236799d.webp',
  runner:'assets/images/enemies/rare-item-sprite-data-runner-22c0d076d9.webp',
  doll:'assets/images/items/rare-item-sprite-data-doll-eec687601a.webp',
  claws:'assets/images/items/rare-item-sprite-data-claws-4ef3643434.webp',
  thunder:'assets/images/items/rare-item-sprite-data-thunder-316895ea3e.webp',
  ricochet:'assets/images/items/rare-item-sprite-data-ricochet-5709726297.webp',
  brute:'assets/images/items/rare-item-sprite-data-brute-92fe33deba.webp',
  lava:'assets/images/items/rare-item-sprite-data-lava-4bbb255ca6.webp',
  frost:'assets/images/items/rare-item-sprite-data-frost-0155215d45.webp',
  pulse:'assets/images/items/rare-item-sprite-data-pulse-53e1fd984a.webp',
  exec:'assets/images/items/rare-item-sprite-data-exec-33b5e38ef5.webp',
  duel:'assets/images/items/rare-item-sprite-data-duel-df35fd51da.webp',
  reaper:'assets/images/items/rare-item-sprite-data-reaper-9f9b9e9cf7.webp',
  chalice:'assets/images/items/rare-item-sprite-data-chalice-3307898edf.webp',
  crown:'assets/images/items/rare-item-sprite-data-crown-e25328edbd.webp',
  bmask:'assets/images/items/rare-item-sprite-data-bmask-7203f2a23f.webp',
  momentum:'assets/images/items/rare-item-sprite-data-momentum-8ef9c1d66c.webp',
  siege:'assets/images/items/rare-item-sprite-data-siege-32b6097de3.webp',
  marathon:'assets/images/items/rare-item-sprite-data-marathon-f046f42fa4.webp',
  panic:'assets/images/items/rare-item-sprite-data-panic-d60d677cc9.webp',
  sprint:'assets/images/items/rare-item-sprite-data-sprint-0423d30313.webp',
  riposte:'assets/images/items/rare-item-sprite-data-riposte-3e049321f0.webp',
  headsman:'assets/images/items/rare-item-sprite-data-headsman-14c6731cb1.webp',
  predator:'assets/images/items/rare-item-sprite-data-predator-2a970a2823.webp',
  bossShard:'assets/images/bosses/rare-item-sprite-data-boss-shard-4aec55f825.webp',
  trinity:'assets/images/items/rare-item-sprite-data-trinity-9b623149b6.webp',
  overload:'assets/images/items/rare-item-sprite-data-overload-1e57b2e6b2.webp',
  critmass:'assets/images/items/rare-item-sprite-data-critmass-dc591e08e5.webp',
  critchain:'assets/images/items/rare-item-sprite-data-critchain-b3e98a2408.webp',
  critaim:'assets/images/items/rare-item-sprite-data-critaim-6670f16dff.webp',
  fullplate:'assets/images/items/rare-item-sprite-data-fullplate-bf02ac8026.webp',
  lastplate:'assets/images/items/rare-item-sprite-data-lastplate-efa84232c3.webp',
  steel:'assets/images/items/rare-item-sprite-data-steel-dcfae85683.webp',
  breath:'assets/images/items/rare-item-sprite-data-breath-59d18e2a52.webp',
  vacuum:'assets/images/items/rare-item-sprite-data-vacuum-5b16437172.webp',
  gravity:'assets/images/items/rare-item-sprite-data-gravity-5574ffc255.webp',
  shove:'assets/images/items/rare-item-sprite-data-shove-c43bdf57e9.webp',
  looter:'assets/images/items/rare-item-sprite-data-looter-1872dc8b74.webp',
  warskel:'assets/images/items/rare-item-sprite-data-warskel-d60bae7984.webp',
  swift:'assets/images/items/rare-item-sprite-data-swift-9fd6a55504.webp',
  survive:'assets/images/items/rare-item-sprite-data-survive-dea276899a.webp',
  arrow:'assets/images/items/rare-item-sprite-data-arrow-b80bfe9c2d.webp',
  goldbag:'assets/images/items/rare-item-sprite-data-goldbag-a2385f3b11.webp',
  xpbag:'assets/images/items/rare-item-sprite-data-xpbag-57171ead19.webp',
};
/* Арканная мина: один компактный кадр 32×32 и восемь фаз взрыва в листе 512×64.
   Оба присланных ресурса сведены к компактным runtime-файлам. */
const ARCANE_MINE_SPRITE_DATA = 'assets/images/effects/arcane-mine-sprite-data-ed0ee7d75b.webp';
const ARCANE_MINE_EXPLOSION_DATA = 'assets/images/effects/arcane-mine-explosion-data-dee01d40aa.webp';
/* Боссы хранятся внешними lossless WebP-листами: четыре кадра 64×96.
   Каноническая нижняя привязка совпадает у спокойных и атакующих листов,
   поэтому смена боевого состояния не двигает модель относительно коллизии. */
const BOSS_SPRITE_DATA = {
  lich:'assets/images/bosses/boss-sprite-data-lich-a5f0f53fd3.webp',
  goat:'assets/images/bosses/boss-sprite-data-goat-f3a0ea0f61.webp',
  plague:'assets/images/bosses/boss-sprite-data-plague-a879f0d2f2.webp',
  greed:'assets/images/bosses/boss-sprite-data-greed-cbed480758.webp',
  executioner:'assets/images/bosses/boss-sprite-data-executioner-8187648cff.webp',
  tyrant:'assets/images/bosses/boss-sprite-data-tyrant-abb3c64a32.webp',
  grave:'assets/images/bosses/boss-sprite-data-grave-b7c2f2cd17.webp',
  behemoth:'assets/images/bosses/boss-sprite-data-behemoth-e1cd419184.webp',
};
Object.assign(BOSS_SPRITE_DATA, {
  vampire:'assets/images/bosses/boss-sprite-data-vampire-dd020c896e.webp',
  voidwrath:'assets/images/bosses/boss-sprite-data-voidwrath-bb35437b80.webp',
  minotaur:'assets/images/bosses/boss-sprite-data-minotaur-b3faa54bfa.webp',
  seraph:'assets/images/bosses/boss-sprite-data-seraph-e9f858ca1a.webp',
  matriarch:'assets/images/bosses/boss-sprite-data-matriarch-49d11deaae.webp',
  demonqueen:'assets/images/bosses/boss-sprite-data-demonqueen-9d5e03a99c.webp'
});
const ENEMY_SPRITES = {}, ELITE_SPRITES = {}, BOSS_SPRITES = {};
const ENEMY_ATTACK_SPRITES = {}, ELITE_ATTACK_SPRITES = {};
/* Созвездия обычных врагов переиспользуют игровые листы ниже. Элита и босс
   получили отдельные компактные 4×48 листы из присланных рядов, без фонового свечения. */
const CONSTELLATION_SPRITE_DATA = {
  elite:'assets/images/ui/constellation-sprite-data-elite-7fad4530ab.webp',
  boss:'assets/images/bosses/constellation-sprite-data-boss-018ac65840.webp',
};
const MAGE_ABILITY_SPRITE_DATA = {
  normal:'assets/images/heroes/mage-ability-sprite-data-normal-6959fac6f7.webp',
  remote:'assets/images/heroes/mage-ability-sprite-data-remote-ccfb40604c.webp',
  mini:'assets/images/heroes/mage-ability-sprite-data-mini-2fef06468d.webp',
  residual:'assets/images/heroes/mage-ability-sprite-data-residual-764b28b7ac.webp',
  elemental:'assets/images/heroes/mage-ability-sprite-data-elemental-ae0b8e0ae5.webp',
  heart:'assets/images/heroes/mage-ability-sprite-data-heart-7f23c7702b.webp',
};
/* BOSS20_ASSETS_START */
Object.assign(BOSS_SPRITE_DATA, {
  ashen_seraph:'assets/images/heroes/mage-ability-sprite-data-ashen-seraph-ade57d70ea.webp',
  bone_astrolabe:'assets/images/heroes/mage-ability-sprite-data-bone-astrolabe-4e2a2e9db4.webp',
  bottomless_mnema:'assets/images/heroes/mage-ability-sprite-data-bottomless-mnema-9c9d3bd683.webp',
  copper_oracle:'assets/images/heroes/mage-ability-sprite-data-copper-oracle-07b46d3826.webp',
  crimson_seamstress:'assets/images/heroes/mage-ability-sprite-data-crimson-seamstress-35f851a039.webp',
  empress_iron_roses:'assets/images/heroes/mage-ability-sprite-data-empress-iron-roses-da626f8307.webp',
  funeral_bell_colossus:'assets/images/heroes/mage-ability-sprite-data-funeral-bell-colossus-a4e7b031b7.webp',
  glass_titan:'assets/images/heroes/mage-ability-sprite-data-glass-titan-47bb8cc92a.webp',
  heart_collector:'assets/images/heroes/mage-ability-sprite-data-heart-collector-25441ffa79.webp',
  ice_psalmist:'assets/images/heroes/mage-ability-sprite-data-ice-psalmist-1f390b463c.webp',
  ink_leviathan:'assets/images/heroes/mage-ability-sprite-data-ink-leviathan-5e76c40150.webp',
  judge_of_chains:'assets/images/heroes/mage-ability-sprite-data-judge-of-chains-c8e1df7c2b.webp',
  keeper_last_candle:'assets/images/heroes/mage-ability-sprite-data-keeper-last-candle-55fa2a5021.webp',
  lunar_butcher:'assets/images/heroes/mage-ability-sprite-data-lunar-butcher-8898d5fe16.webp',
  mother_empty_masks:'assets/images/heroes/mage-ability-sprite-data-mother-empty-masks-d3e70aed9c.webp',
  plague_archimandrite:'assets/images/heroes/mage-ability-sprite-data-plague-archimandrite-f1ea9648d6.webp',
  prince_hungry_ravens:'assets/images/heroes/mage-ability-sprite-data-prince-hungry-ravens-e311c118f5.webp',
  rust_king:'assets/images/heroes/mage-ability-sprite-data-rust-king-868760fe46.webp',
  sand_gravedigger:'assets/images/heroes/mage-ability-sprite-data-sand-gravedigger-510e78ba80.webp',
  star_devourer:'assets/images/heroes/mage-ability-sprite-data-star-devourer-d58a459e28.webp',
});
const BOSS_ATTACK_SPRITE_DATA = {
  /* LEGACY_BOSS_ATTACK_ASSETS_START */
  lich_attack:'assets/images/bosses/boss-attack-sprite-data-lich-attack-df8070e4db.webp',
  goat_attack:'assets/images/bosses/boss-attack-sprite-data-goat-attack-0f1c2089ba.webp',
  plague_attack:'assets/images/bosses/boss-attack-sprite-data-plague-attack-f7ef8cf884.webp',
  greed_attack:'assets/images/bosses/boss-attack-sprite-data-greed-attack-61c5e90536.webp',
  executioner_attack:'assets/images/bosses/boss-attack-sprite-data-executioner-attack-5b3c8a9c0d.webp',
  tyrant_attack:'assets/images/bosses/boss-attack-sprite-data-tyrant-attack-a0b8f62997.webp',
  grave_attack:'assets/images/bosses/boss-attack-sprite-data-grave-attack-e81c50e171.webp',
  behemoth_attack:'assets/images/bosses/boss-attack-sprite-data-behemoth-attack-7c7e86f274.webp',
  vampire_attack:'assets/images/bosses/boss-attack-sprite-data-vampire-attack-9e2c964ffb.webp',
  voidwrath_attack:'assets/images/bosses/boss-attack-sprite-data-voidwrath-attack-50fff8d298.webp',
  minotaur_attack:'assets/images/bosses/boss-attack-sprite-data-minotaur-attack-f4c8753ffd.webp',
  seraph_attack:'assets/images/bosses/boss-attack-sprite-data-seraph-attack-211d673481.webp',
  matriarch_attack:'assets/images/bosses/boss-attack-sprite-data-matriarch-attack-efcf3b26ff.webp',
  demonqueen_attack:'assets/images/bosses/boss-attack-sprite-data-demonqueen-attack-510ad1f82e.webp',
  /* LEGACY_BOSS_ATTACK_ASSETS_END */
  ashen_seraph_attack:'assets/images/bosses/boss-attack-sprite-data-ashen-seraph-attack-48f4e09cb3.webp',
  bone_astrolabe_attack:'assets/images/bosses/boss-attack-sprite-data-bone-astrolabe-attack-a7f64aef9a.webp',
  bottomless_mnema_attack:'assets/images/bosses/boss-attack-sprite-data-bottomless-mnema-attack-c44f16f96f.webp',
  copper_oracle_attack:'assets/images/bosses/boss-attack-sprite-data-copper-oracle-attack-c2233a4ceb.webp',
  crimson_seamstress_attack:'assets/images/bosses/boss-attack-sprite-data-crimson-seamstress-attack-4a96387e94.webp',
  empress_iron_roses_attack:'assets/images/bosses/boss-attack-sprite-data-empress-iron-roses-attack-79f6a0064f.webp',
  funeral_bell_colossus_attack:'assets/images/bosses/boss-attack-sprite-data-funeral-bell-colossus-attack-e66a3ca235.webp',
  glass_titan_attack:'assets/images/bosses/boss-attack-sprite-data-glass-titan-attack-dd78e23e13.webp',
  heart_collector_attack:'assets/images/bosses/boss-attack-sprite-data-heart-collector-attack-40f200251c.webp',
  ice_psalmist_attack:'assets/images/bosses/boss-attack-sprite-data-ice-psalmist-attack-ed24217363.webp',
  ink_leviathan_attack:'assets/images/bosses/boss-attack-sprite-data-ink-leviathan-attack-d90061389f.webp',
  judge_of_chains_attack:'assets/images/bosses/boss-attack-sprite-data-judge-of-chains-attack-2ab9f4324b.webp',
  keeper_last_candle_attack:'assets/images/bosses/boss-attack-sprite-data-keeper-last-candle-attack-ff1a00e7cc.webp',
  lunar_butcher_attack:'assets/images/bosses/boss-attack-sprite-data-lunar-butcher-attack-bb1d404544.webp',
  mother_empty_masks_attack:'assets/images/bosses/boss-attack-sprite-data-mother-empty-masks-attack-088ae6b8be.webp',
  plague_archimandrite_attack:'assets/images/bosses/boss-attack-sprite-data-plague-archimandrite-attack-9d23017528.webp',
  prince_hungry_ravens_attack:'assets/images/bosses/boss-attack-sprite-data-prince-hungry-ravens-attack-7f42a27322.webp',
  rust_king_attack:'assets/images/bosses/boss-attack-sprite-data-rust-king-attack-10cd6acaf2.webp',
  sand_gravedigger_attack:'assets/images/bosses/boss-attack-sprite-data-sand-gravedigger-attack-7428802cb6.webp',
  star_devourer_attack:'assets/images/bosses/boss-attack-sprite-data-star-devourer-attack-eefddc0f12.webp',
};
const BOSS_ATTACK_SPRITES = {};
/* LEGACY_BOSS_EFFECT_ASSETS_START */
const LEGACY_BOSS_EFFECT_SPRITE_DATA = {
  goat_slam:'assets/images/bosses/legacy-boss-effect-sprite-data-goat-slam-6067232715.webp',
  behemoth_impact:'assets/images/bosses/legacy-boss-effect-sprite-data-behemoth-impact-4bb82cfe26.webp',
  minotaur_crash:'assets/images/bosses/legacy-boss-effect-sprite-data-minotaur-crash-7fe9e6f65e.webp',
  tyrant_slash:'assets/images/bosses/legacy-boss-effect-sprite-data-tyrant-slash-95b9ab3a32.webp',
  vampire_cross:'assets/images/bosses/legacy-boss-effect-sprite-data-vampire-cross-29119ac196.webp',
  summon_sigil:'assets/images/bosses/legacy-boss-effect-sprite-data-summon-sigil-21f59dbc13.webp',
};
/* LEGACY_BOSS_EFFECT_ASSETS_END */
const BOSS20_EFFECT_SPRITE_DATA = {
  ashen_comet:'assets/images/bosses/boss20-effect-sprite-data-ashen-comet-7e67aacafa.webp',
  ashen_comet_impact:'assets/images/bosses/boss20-effect-sprite-data-ashen-comet-impact-5bb38b95e6.webp',
  bone_orbit_ring:'assets/images/bosses/boss20-effect-sprite-data-bone-orbit-ring-9cbb86c58e.webp',
  candle_safe_halo:'assets/images/bosses/boss20-effect-sprite-data-candle-safe-halo-366eaa2fdd.webp',
  copper_rewind_explosion:'assets/images/bosses/boss20-effect-sprite-data-copper-rewind-explosion-6f37940cc9.webp',
  crimson_flesh_seam:'assets/images/bosses/boss20-effect-sprite-data-crimson-flesh-seam-dbf011251b.webp',
  empty_mask_beam:'assets/images/bosses/boss20-effect-sprite-data-empty-mask-beam-8b7570a64e.webp',
  funeral_wave_ring:'assets/images/bosses/boss20-effect-sprite-data-funeral-wave-ring-fa2468ac9d.webp',
  glass_blast:'assets/images/bosses/boss20-effect-sprite-data-glass-blast-d726be8b17.webp',
  glass_shard:'assets/images/bosses/boss20-effect-sprite-data-glass-shard-122e94cbca.webp',
  heart_blood_ring:'assets/images/bosses/boss20-effect-sprite-data-heart-blood-ring-e535783d42.webp',
  ice_liturgy_sector:'assets/images/bosses/boss20-effect-sprite-data-ice-liturgy-sector-2f494c62b9.webp',
  ink_pool:'assets/images/bosses/boss20-effect-sprite-data-ink-pool-b525535f3a.webp',
  iron_rose_ring:'assets/images/bosses/boss20-effect-sprite-data-iron-rose-ring-7cbd917324.webp',
  judge_chain_hook:'assets/images/bosses/boss20-effect-sprite-data-judge-chain-hook-1456c7d05a.webp',
  judge_hammer_impact:'assets/images/bosses/boss20-effect-sprite-data-judge-hammer-impact-56eec193db.webp',
  lunar_crescent:'assets/images/bosses/boss20-effect-sprite-data-lunar-crescent-c6925314e0.webp',
  mnema_shadow_pierce:'assets/images/bosses/boss20-effect-sprite-data-mnema-shadow-pierce-feef702a9f.webp',
  plague_censer_cloud:'assets/images/bosses/boss20-effect-sprite-data-plague-censer-cloud-1ecd764e26.webp',
  raven_swarm:'assets/images/bosses/boss20-effect-sprite-data-raven-swarm-da47e62b7e.webp',
  rust_tide_cone:'assets/images/bosses/boss20-effect-sprite-data-rust-tide-cone-8914ee2bd7.webp',
  sand_ground_strip:'assets/images/bosses/boss20-effect-sprite-data-sand-ground-strip-15283a77d5.webp',
  sand_shockwave:'assets/images/bosses/boss20-effect-sprite-data-sand-shockwave-064df6670e.webp',
  star_meteor:'assets/images/bosses/boss20-effect-sprite-data-star-meteor-4c5f12ac9f.webp',
  star_meteor_impact:'assets/images/bosses/boss20-effect-sprite-data-star-meteor-impact-7e8f8217fb.webp',
};
const BOSS20_EFFECT_SPRITES = {};
/* BOSS20_ASSETS_END */
const MINION_SPRITE_DATA = {
  skeleton:'assets/images/enemies/minion-sprite-data-skeleton-a48ef1a292.webp',
  hunter:'assets/images/enemies/minion-sprite-data-hunter-37bcaa7c88.webp',
  bombardier:'assets/images/enemies/minion-sprite-data-bombardier-db446640a2.webp',
  golemB:'assets/images/enemies/minion-sprite-data-golem-b-7346f5316f.webp',
  golemN:'assets/images/enemies/minion-sprite-data-golem-n-47a86badb4.webp',
};
/* Лист бывшего колдуна сохранён как текущий арт Бомбардира; ресурс Охотника
   удалён из runtime вместе с карточкой и типом. */
/* Семь кадров 16×16: burning, poison, plague, chilled, frozen, shocked, bleeding.
   Elite/rage/pack/hit/hunter-mark из исходного master в runtime не входят. */
const ENEMY_STATUS_ICON_DATA = 'assets/images/enemies/enemy-status-icon-data-23cdfceeab.webp';
const ENEMY_STATUS_ICON_KEYS = Object.freeze([
  'burning','poison','plague','chilled','frozen','shocked','bleeding'
]);
const ENEMY_STATUS_ICON_FRAMES = Object.freeze(Object.fromEntries(
  ENEMY_STATUS_ICON_KEYS.map((key,index) => [key,Object.freeze({key,index,x:index*16,y:0,w:16,h:16})])
));
/* Инфернальные врата завершения этажа: отдельные 16 кадров роста из земли и
   бесшовный цикл 16×128. Несущая арка и baseline цикла строго неподвижны. */
const FLOOR_PORTAL_SPRITE_DATA = 'assets/images/environment/floor-portal-sprite-data-1d1add02f0.png';
/* Отдельный прозрачный PNG для каждого типа и ранга. Оптимизатор заменяет
   эти заглушки проверенными 24×24 master-ресурсами из пакетов художника. */
/* Отдельный сверхмалый каталог для предметов, лежащих в мире. Канонические
   128×128 PNG выше остаются единственным источником для меню находки и UI. */
const RARE_ITEM_FLOOR_SPRITE_DATA = {
  heartSecond:'assets/images/environment/rare-item-floor-sprite-data-heart-second-6a7e75e4a5.webp',
  titansHands:'assets/images/environment/rare-item-floor-sprite-data-titans-hands-6f3eb06edb.webp',
  stepBeyond:'assets/images/environment/rare-item-floor-sprite-data-step-beyond-edf6ee817d.webp',
  marchDead:'assets/images/environment/rare-item-floor-sprite-data-march-dead-afecf01e58.webp',
  zeroDistanceRing:'assets/images/environment/rare-item-floor-sprite-data-zero-distance-ring-b717d12b27.webp',
  invertedCrown:'assets/images/environment/rare-item-floor-sprite-data-inverted-crown-9bb4c81fe9.webp',
  archivist:'assets/images/environment/rare-item-floor-sprite-data-archivist-cbe003cae4.webp',
  emptyThroneSeal:'assets/images/environment/rare-item-floor-sprite-data-empty-throne-seal-6d8415c04b.webp',
  surgeonsHand:'assets/images/environment/rare-item-floor-sprite-data-surgeons-hand-43562f6b91.webp',
  betweenWorldsBoots:'assets/images/environment/rare-item-floor-sprite-data-between-worlds-boots-827b49b08b.webp',
  unhealedWoundRing:'assets/images/environment/rare-item-floor-sprite-data-unhealed-wound-ring-a2e56166c8.webp',
  deadGodClock:'assets/images/environment/rare-item-floor-sprite-data-dead-god-clock-d2bf2d634f.webp',
  copperChronometer:'assets/images/environment/rare-item-floor-sprite-data-copper-chronometer-3fa4e96063.webp',
  knottedCharm:'assets/images/environment/rare-item-floor-sprite-data-knotted-charm-d79c1907d6.webp',
  tallyGloves:'assets/images/environment/rare-item-floor-sprite-data-tally-gloves-4a5688cde6.webp',
  smithThumbstall:'assets/images/environment/rare-item-floor-sprite-data-smith-thumbstall-4c7844e9c7.webp',
  draftGloves:'assets/images/environment/rare-item-floor-sprite-data-draft-gloves-3f677ea06e.webp',
  satinGloves:'assets/images/environment/rare-item-floor-sprite-data-satin-gloves-2de0fdc597.webp',
  hobnailedSoles:'assets/images/environment/rare-item-floor-sprite-data-hobnailed-soles-9e3a0fcd3a.webp',
  shortCircuitBoots:'assets/images/environment/rare-item-floor-sprite-data-short-circuit-boots-e29f5ffc6a.webp',
  trailfinders:'assets/images/environment/rare-item-floor-sprite-data-trailfinders-7545856a30.webp',
  boneSpurs:'assets/images/environment/rare-item-floor-sprite-data-bone-spurs-d277b0b5c1.webp',
  firstTraceRing:'assets/images/environment/rare-item-floor-sprite-data-first-trace-ring-17ae77bea7.webp',
  closeHarvestRing:'assets/images/environment/rare-item-floor-sprite-data-close-harvest-ring-f6897a3b57.webp',
  sealHunt:'assets/images/environment/rare-item-floor-sprite-data-seal-hunt-3e645a4e2d.webp',
  mothFang:'assets/images/environment/rare-item-floor-sprite-data-moth-fang-a9bbd3f528.webp',
  cometEye:'assets/images/environment/rare-item-floor-sprite-data-comet-eye-9bbafda504.webp',
  sealPack:'assets/images/environment/rare-item-floor-sprite-data-seal-pack-777a86984b.webp',
  eclipseBrushes:'assets/images/environment/rare-item-floor-sprite-data-eclipse-brushes-3560fac949.webp',
  sparkstepBoots:'assets/images/environment/rare-item-floor-sprite-data-sparkstep-boots-cd042a5fc0.webp',
  marchingGreaves:'assets/images/environment/rare-item-floor-sprite-data-marching-greaves-2fb554d19f.webp',
  secondWindRing:'assets/images/environment/rare-item-floor-sprite-data-second-wind-ring-a92c449c55.webp',
  coolingAshRing:'assets/images/environment/rare-item-floor-sprite-data-cooling-ash-ring-3d433ec3dc.webp',
  confinementRing:'assets/images/environment/rare-item-floor-sprite-data-confinement-ring-ddc3f9acd6.webp',
  reactionRing:'assets/images/environment/rare-item-floor-sprite-data-reaction-ring-d959efbca9.webp',
  conductorRing:'assets/images/environment/rare-item-floor-sprite-data-conductor-ring-cfcdc4c975.webp',
  ledgerDebts:'assets/images/environment/rare-item-floor-sprite-data-ledger-debts-b50bff2489.webp',
  glassBell:'assets/images/environment/rare-item-floor-sprite-data-glass-bell-2730e431cc.webp',
  mirror:'assets/images/environment/rare-item-floor-sprite-data-mirror-17dea7d5ed.webp',
  golem:'assets/images/environment/rare-item-floor-sprite-data-golem-f3b782bc5a.webp',
  fang:'assets/images/environment/rare-item-floor-sprite-data-fang-ec019dea74.webp',
  storm:'assets/images/environment/rare-item-floor-sprite-data-storm-9badf65dbd.webp',
  ash:'assets/images/environment/rare-item-floor-sprite-data-ash-7cd1e87820.webp',
  ice:'assets/images/environment/rare-item-floor-sprite-data-ice-9f205768ed.webp',
  plague:'assets/images/environment/rare-item-floor-sprite-data-plague-6809c0d51d.webp',
  clock:'assets/images/environment/rare-item-floor-sprite-data-clock-3e97795587.webp',
  shard:'assets/images/environment/rare-item-floor-sprite-data-shard-7b3fcd0131.webp',
  bone:'assets/images/environment/rare-item-floor-sprite-data-bone-e66939fd5d.webp',
  candle:'assets/images/environment/rare-item-floor-sprite-data-candle-096326687c.webp',
  calm:'assets/images/environment/rare-item-floor-sprite-data-calm-ee63962374.webp',
  runner:'assets/images/enemies/rare-item-floor-sprite-data-runner-824d0e988e.webp',
  doll:'assets/images/environment/rare-item-floor-sprite-data-doll-d797661935.webp',
  claws:'assets/images/environment/rare-item-floor-sprite-data-claws-9ffd8d4958.webp',
  thunder:'assets/images/environment/rare-item-floor-sprite-data-thunder-db632ab1dd.webp',
  ricochet:'assets/images/environment/rare-item-floor-sprite-data-ricochet-871adde55d.webp',
  brute:'assets/images/environment/rare-item-floor-sprite-data-brute-f8a3d9ab9a.webp',
  lava:'assets/images/environment/rare-item-floor-sprite-data-lava-5d9f3414bd.webp',
  frost:'assets/images/environment/rare-item-floor-sprite-data-frost-fe40186496.webp',
  pulse:'assets/images/environment/rare-item-floor-sprite-data-pulse-14d6f05ee7.webp',
  exec:'assets/images/environment/rare-item-floor-sprite-data-exec-4e7ccc63d2.webp',
  duel:'assets/images/environment/rare-item-floor-sprite-data-duel-6f558b218c.webp',
  reaper:'assets/images/environment/rare-item-floor-sprite-data-reaper-d121a1be8b.webp',
  chalice:'assets/images/environment/rare-item-floor-sprite-data-chalice-ede3cf9f79.webp',
  crown:'assets/images/environment/rare-item-floor-sprite-data-crown-7c190609ab.webp',
  bmask:'assets/images/environment/rare-item-floor-sprite-data-bmask-305930115f.webp',
  momentum:'assets/images/environment/rare-item-floor-sprite-data-momentum-ec4cbd1bc6.webp',
  siege:'assets/images/environment/rare-item-floor-sprite-data-siege-c9907e584c.webp',
  marathon:'assets/images/environment/rare-item-floor-sprite-data-marathon-7e81167c77.webp',
  panic:'assets/images/environment/rare-item-floor-sprite-data-panic-79a7996ae6.webp',
  sprint:'assets/images/environment/rare-item-floor-sprite-data-sprint-d4f5a1dd83.webp',
  riposte:'assets/images/environment/rare-item-floor-sprite-data-riposte-9e4f08d580.webp',
  headsman:'assets/images/environment/rare-item-floor-sprite-data-headsman-e1fcd81f1b.webp',
  predator:'assets/images/environment/rare-item-floor-sprite-data-predator-637bcc6d2a.webp',
  bossShard:'assets/images/bosses/rare-item-floor-sprite-data-boss-shard-31e67d4cae.webp',
  trinity:'assets/images/environment/rare-item-floor-sprite-data-trinity-73f55d97db.webp',
  overload:'assets/images/environment/rare-item-floor-sprite-data-overload-2464bc1ee3.webp',
  critmass:'assets/images/environment/rare-item-floor-sprite-data-critmass-036346aeef.webp',
  critchain:'assets/images/environment/rare-item-floor-sprite-data-critchain-64e7847096.webp',
  critaim:'assets/images/environment/rare-item-floor-sprite-data-critaim-fda0faf61c.webp',
  fullplate:'assets/images/environment/rare-item-floor-sprite-data-fullplate-aee1952cbd.webp',
  lastplate:'assets/images/environment/rare-item-floor-sprite-data-lastplate-961c7d5743.webp',
  steel:'assets/images/environment/rare-item-floor-sprite-data-steel-c60559c0d8.webp',
  breath:'assets/images/environment/rare-item-floor-sprite-data-breath-2fb1508131.webp',
  vacuum:'assets/images/environment/rare-item-floor-sprite-data-vacuum-a8655505f0.webp',
  gravity:'assets/images/environment/rare-item-floor-sprite-data-gravity-8fc27e06a6.webp',
  shove:'assets/images/environment/rare-item-floor-sprite-data-shove-fe298b8b79.webp',
  looter:'assets/images/environment/rare-item-floor-sprite-data-looter-283c0f2c53.webp',
  warskel:'assets/images/environment/rare-item-floor-sprite-data-warskel-ef08648567.webp',
  swift:'assets/images/environment/rare-item-floor-sprite-data-swift-13be4b5ab9.webp',
  survive:'assets/images/environment/rare-item-floor-sprite-data-survive-b814c18dc6.webp',
  arrow:'assets/images/environment/rare-item-floor-sprite-data-arrow-5d2dde348e.webp',
  goldbag:'assets/images/environment/rare-item-floor-sprite-data-goldbag-f00d6abd6f.webp',
  xpbag:'assets/images/environment/rare-item-floor-sprite-data-xpbag-154d056ae2.webp',
};
/* Отдельные производные 24×24 только для книг, лежащих на полу. Крупные
   LOOT_SPRITE_DATA остаются каноническими источниками окна находки и UI. */
const BOOK_FLOOR_SPRITE_DATA = {
  fire:'assets/images/environment/book-floor-sprite-data-fire-4bf8b17905.webp',
  cold:'assets/images/environment/book-floor-sprite-data-cold-29164a4c1f.webp',
  shock:'assets/images/environment/book-floor-sprite-data-shock-c4552865d8.webp',
  poison:'assets/images/environment/book-floor-sprite-data-poison-97a3a5a96f.webp',
  bleed:'assets/images/environment/book-floor-sprite-data-bleed-79fc37621d.webp',
  xp:'assets/images/environment/book-floor-sprite-data-xp-1bb3a66377.webp',
  monster:'assets/images/environment/book-floor-sprite-data-monster-cf54f859ce.webp',
};
const TOTEM_SPRITE_DATA = {
  blood:['assets/images/items/totem-sprite-data-b376075c5b.webp','assets/images/items/totem-sprite-data-002-02134819ad.webp','assets/images/items/totem-sprite-data-003-fc99bcd4d1.webp','assets/images/items/totem-sprite-data-004-e00fd0d863.webp'],
  fire:['assets/images/items/totem-sprite-data-005-f5b81c1561.webp','assets/images/items/totem-sprite-data-006-8223f5dce1.webp','assets/images/items/totem-sprite-data-007-bbd61b3957.webp','assets/images/items/totem-sprite-data-008-b977546c6e.webp'],
  freeze:['assets/images/items/totem-sprite-data-009-4d04d542cc.webp','assets/images/items/totem-sprite-data-010-c216384077.webp','assets/images/items/totem-sprite-data-011-c1f53ac6d1.webp','assets/images/items/totem-sprite-data-012-69d6265774.webp'],
  lightning:['assets/images/items/totem-sprite-data-013-d3be6da8e0.webp','assets/images/items/totem-sprite-data-014-5205e1fd36.webp','assets/images/items/totem-sprite-data-015-7c1b0b5c3c.webp','assets/images/items/totem-sprite-data-016-dc24112ad3.webp'],
  poison:['assets/images/items/totem-sprite-data-017-9b69445c12.webp','assets/images/items/totem-sprite-data-018-a5708531e5.webp','assets/images/items/totem-sprite-data-019-63250953cb.webp','assets/images/items/totem-sprite-data-020-7a8b3bdbab.webp'],
};
const FLOOR_PORTAL_APPEAR_SPRITE_DATA = 'assets/images/environment/floor-portal-appear-sprite-data-16fcc30b9f.png';
const FLOOR_PORTAL_SPRITE_META = Object.freeze({
  frameW:128, frameH:128, frames:16, frameDuration:0.09, appearDuration:1.28, drawW:166, drawH:166,
  anchorX:0.5, anchorY:1
});
const FLOOR_PORTAL_SPAWN_MIN=350, FLOOR_PORTAL_SPAWN_MAX=520;
function floorPortalSpriteFrame(portal){
  const meta=FLOOR_PORTAL_SPRITE_META;
  const t=portal && Number.isFinite(portal.t) ? Math.max(0,portal.t) : 0;
  const appearing=t<meta.appearDuration;
  const index=appearing
    ? Math.min(meta.frames-1,Math.floor(t/meta.appearDuration*meta.frames))
    : Math.floor((t-meta.appearDuration)/meta.frameDuration+1e-9)%meta.frames;
  return {index,x:index*meta.frameW,y:0,w:meta.frameW,h:meta.frameH,
          sheet:appearing?'appear':'loop',meta};
}
function floorPortalReady(portal){
  return !!portal && portal.t>=FLOOR_PORTAL_SPRITE_META.appearDuration;
}
function floorPortalSpawnPosition(player){
  const px=Number.isFinite(player && player.x)?player.x:0;
  const py=Number.isFinite(player && player.y)?player.y:0;
  const viewW=W>0?W:(typeof innerWidth==='number'?innerWidth:1280);
  const viewH=H>0?H:(typeof innerHeight==='number'?innerHeight:720);
  const spritePad=Math.ceil(Math.max(FLOOR_PORTAL_SPRITE_META.drawW,FLOOR_PORTAL_SPRITE_META.drawH)/2)+12;
  const edge=ARENA-Math.ceil(FLOOR_PORTAL_SPRITE_META.drawW/2)-20;
  const start=rnd(0,Math.PI*2),step=Math.PI*2/48;
  /* Сначала ищем точку, где весь портал (с небольшим запасом) помещается в
     текущий экран. На совсем крошечном окне второй проход гарантирует хотя бы
     видимый центр портала, не приближая его к герою ближе 350 единиц. */
  for (const pad of [spritePad,0]){
    const halfW=Math.max(0,viewW/(2*CAMERA_SCALE)-pad);
    const halfH=Math.max(0,viewH/(2*CAMERA_SCALE)-pad);
    const minX=Math.max(-halfW,-edge-px),maxX=Math.min(halfW,edge-px);
    const minY=Math.max(-halfH,-edge-py),maxY=Math.min(halfH,edge-py);
    for (let i=0;i<48;i++){
      const angle=start+i*step,dx=Math.cos(angle),dy=Math.sin(angle);
      let limit=Infinity;
      if (dx>1e-9) limit=Math.min(limit,maxX/dx);
      else if (dx<-1e-9) limit=Math.min(limit,minX/dx);
      if (dy>1e-9) limit=Math.min(limit,maxY/dy);
      else if (dy<-1e-9) limit=Math.min(limit,minY/dy);
      if (limit+1e-6<FLOOR_PORTAL_SPAWN_MIN) continue;
      const distance=rnd(FLOOR_PORTAL_SPAWN_MIN,Math.min(FLOOR_PORTAL_SPAWN_MAX,limit));
      return {x:px+dx*distance,y:py+dy*distance,distance};
    }
  }
  /* Одновременно выполнить оба условия физически невозможно лишь когда весь
     viewport уже диаметра 700. В этом аварийном случае сохраняем дистанцию и
     направление к центру арены; на игровых размерах до fallback дело не дойдёт. */
  const angle=Math.atan2(-py,-px),distance=FLOOR_PORTAL_SPAWN_MIN;
  const x=clamp(px+Math.cos(angle)*distance,-edge,edge);
  const y=clamp(py+Math.sin(angle)*distance,-edge,edge);
  return {x,y,distance:Math.hypot(x-px,y-py)};
}
function spawnFloorPortalArrivalFx(portal){
  if (!portal) return 0;
  const before=G.parts.length;
  burst(portal.x,portal.y+38,96,'#441014',205,6,1.25);
  burst(portal.x,portal.y+34,72,'#8f1717',170,4,1.10);
  G.fx.push({t:'ring',x:portal.x,y:portal.y+42,r:8,max:112,life:0.55,col:'#190306'});
  G.fx.push({t:'ring',x:portal.x,y:portal.y+42,r:16,max:94,life:0.75,col:'#5d0a0d'});
  G.fx.push({t:'ring',x:portal.x,y:portal.y+42,r:24,max:76,life:0.95,col:'#a31a16'});
  return G.parts.length-before;
}
const CONSTELLATION_SPRITES = {};
const ENEMY_SPRITE_META = {
  runner:{src:ENEMY_SPRITE_DATA.runner, scale:3.3333333333, stride:24, frames:[]},
  blob:  {src:ENEMY_SPRITE_DATA.blob,   scale:2.8571428571, stride:24, frames:[]},
  tank:  {src:ENEMY_SPRITE_DATA.tank,   scale:2.5263157895, stride:24, frames:[]},
  shooter:{src:ENEMY_SPRITE_DATA.shooter, scale:2.8571428571, stride:24, frames:[]},
};
for (const [key,meta] of Object.entries(ENEMY_SPRITE_META)){
  const size = key === 'tank' ? 48 : 40;
  for (let i=0;i<4;i++) meta.frames.push({x:i*size,y:0,w:size,h:size,ax:size/2,ay:size/2});
}
const ELITE_SPRITE_META = {
  frostWolf:      {src:ELITE_SPRITE_DATA.frostWolf,       scale:3.15,stride:24,frames:[]},
  toxicRunner:    {src:ELITE_SPRITE_DATA.toxicRunner,     scale:3.15,stride:24,frames:[]},
  cursedRogue:    {src:ELITE_SPRITE_DATA.cursedRogue,     scale:3.15,stride:22,frames:[]},
  skeletonWarrior:{src:ELITE_SPRITE_DATA.skeletonWarrior, scale:2.90,stride:24,frames:[]},
  blightGrunt:    {src:ELITE_SPRITE_DATA.blightGrunt,     scale:2.90,stride:25,frames:[]},
  boneGargoyle:   {src:ELITE_SPRITE_DATA.boneGargoyle,    scale:3.00,stride:24,frames:[]},
  fallenPyromancer:{src:ELITE_SPRITE_DATA.fallenPyromancer,scale:3.35,stride:24,frames:[]},
  beholderSlave:  {src:ELITE_SPRITE_DATA.beholderSlave,   scale:3.35,stride:22,frames:[]},
  skeletonCrossbow:{src:ELITE_SPRITE_DATA.skeletonCrossbow,scale:3.35,stride:24,frames:[]},
  forgottenGuard: {src:ELITE_SPRITE_DATA.forgottenGuard,  scale:3.40,stride:25,frames:[]},
  abyssalExecutioner:{src:ELITE_SPRITE_DATA.abyssalExecutioner,scale:3.40,stride:27,frames:[]},
  plagueOgre:     {src:ELITE_SPRITE_DATA.plagueOgre,      scale:3.55,stride:28,frames:[]},
};
for (const meta of Object.values(ELITE_SPRITE_META))
  for (let i=0;i<4;i++) meta.frames.push({x:i*48,y:0,w:48,h:48,ax:24,ay:24});
const ENEMY_ATTACK_SPRITE_META = {};
for (const [key,base] of Object.entries(ENEMY_SPRITE_META)){
  const size=key==='tank'?48:40;
  const meta=ENEMY_ATTACK_SPRITE_META[key]={src:ENEMY_ATTACK_SPRITE_DATA[key],scale:base.scale,stride:base.stride,frames:[]};
  for (let i=0;i<4;i++) meta.frames.push({x:i*size,y:0,w:size,h:size,ax:size/2,ay:size/2});
}
const ELITE_ATTACK_SPRITE_META = {};
for (const [key,base] of Object.entries(ELITE_SPRITE_META)){
  const meta=ELITE_ATTACK_SPRITE_META[key]={src:ELITE_ATTACK_SPRITE_DATA[key],scale:base.scale,stride:base.stride,frames:[]};
  for (let i=0;i<4;i++) meta.frames.push({x:i*48,y:0,w:48,h:48,ax:24,ay:24});
}
const BOSS_SPRITE_META = {
  // Визуальная высота отделена от e.r: коллизия остаётся большой, но модель
  // выглядит примерно в 1.6 раза выше обычного Бастиона, а не в 2.6 раза.
  lich:  {src:BOSS_SPRITE_DATA.lich,   scale:2.5, stride:28, frames:[]},
  goat:  {src:BOSS_SPRITE_DATA.goat,   scale:2.5, stride:28, frames:[]},
  plague:{src:BOSS_SPRITE_DATA.plague, scale:2.5, stride:28, frames:[]},
  greed: {src:BOSS_SPRITE_DATA.greed,  scale:2.5, stride:28, frames:[]},
  executioner:{src:BOSS_SPRITE_DATA.executioner, scale:2.5, stride:28, frames:[]},
  tyrant:     {src:BOSS_SPRITE_DATA.tyrant,      scale:2.5, stride:28, frames:[]},
  grave:      {src:BOSS_SPRITE_DATA.grave,       scale:2.5, stride:28, frames:[]},
  behemoth:   {src:BOSS_SPRITE_DATA.behemoth,    scale:2.5, stride:28, frames:[]},
  vampire:    {src:BOSS_SPRITE_DATA.vampire,     scale:2.5, stride:28, frames:[]},
  voidwrath:  {src:BOSS_SPRITE_DATA.voidwrath,   scale:2.5, stride:28, frames:[]},
  minotaur:   {src:BOSS_SPRITE_DATA.minotaur,    scale:2.5, stride:28, frames:[]},
  seraph:     {src:BOSS_SPRITE_DATA.seraph,      scale:2.5, stride:28, frames:[]},
  matriarch:  {src:BOSS_SPRITE_DATA.matriarch,   scale:2.5, stride:28, frames:[]},
  demonqueen: {src:BOSS_SPRITE_DATA.demonqueen,  scale:2.5, stride:28, frames:[]},
  funeral_bell_colossus:{src:BOSS_SPRITE_DATA.funeral_bell_colossus,scale:2.5,stride:28,frames:[]},
  star_devourer:{src:BOSS_SPRITE_DATA.star_devourer,scale:2.5,stride:28,frames:[]},
  plague_archimandrite:{src:BOSS_SPRITE_DATA.plague_archimandrite,scale:2.5,stride:28,frames:[]},
  crimson_seamstress:{src:BOSS_SPRITE_DATA.crimson_seamstress,scale:2.5,stride:28,frames:[]},
  glass_titan:{src:BOSS_SPRITE_DATA.glass_titan,scale:2.5,stride:28,frames:[]},
  rust_king:{src:BOSS_SPRITE_DATA.rust_king,scale:2.5,stride:28,frames:[]},
  mother_empty_masks:{src:BOSS_SPRITE_DATA.mother_empty_masks,scale:2.5,stride:28,frames:[]},
  ice_psalmist:{src:BOSS_SPRITE_DATA.ice_psalmist,scale:2.5,stride:28,frames:[]},
  heart_collector:{src:BOSS_SPRITE_DATA.heart_collector,scale:2.5,stride:28,frames:[]},
  ink_leviathan:{src:BOSS_SPRITE_DATA.ink_leviathan,scale:2.5,stride:28,frames:[]},
  judge_of_chains:{src:BOSS_SPRITE_DATA.judge_of_chains,scale:2.5,stride:28,frames:[]},
  ashen_seraph:{src:BOSS_SPRITE_DATA.ashen_seraph,scale:2.5,stride:28,frames:[]},
  bone_astrolabe:{src:BOSS_SPRITE_DATA.bone_astrolabe,scale:2.5,stride:28,frames:[]},
  copper_oracle:{src:BOSS_SPRITE_DATA.copper_oracle,scale:2.5,stride:28,frames:[]},
  prince_hungry_ravens:{src:BOSS_SPRITE_DATA.prince_hungry_ravens,scale:2.5,stride:28,frames:[]},
  lunar_butcher:{src:BOSS_SPRITE_DATA.lunar_butcher,scale:2.5,stride:28,frames:[]},
  keeper_last_candle:{src:BOSS_SPRITE_DATA.keeper_last_candle,scale:2.5,stride:28,frames:[]},
  sand_gravedigger:{src:BOSS_SPRITE_DATA.sand_gravedigger,scale:2.5,stride:28,frames:[]},
  bottomless_mnema:{src:BOSS_SPRITE_DATA.bottomless_mnema,scale:2.5,stride:28,frames:[]},
  empress_iron_roses:{src:BOSS_SPRITE_DATA.empress_iron_roses,scale:2.5,stride:28,frames:[]},
};
for (const meta of Object.values(BOSS_SPRITE_META))
  for (let i = 0; i < 4; i++) meta.frames.push({x:i*64,y:0,w:64,h:96,ax:32,ay:72});
const BOSS_ATTACK_SPRITE_META = Object.fromEntries(
  Object.keys(BOSS_SPRITE_META)
    .filter(key => BOSS_ATTACK_SPRITE_DATA[key+'_attack'])
    .map(key => [key,{src:BOSS_ATTACK_SPRITE_DATA[key+'_attack'],scale:2.5,frames:[]}])
);
for (const meta of Object.values(BOSS_ATTACK_SPRITE_META))
  for (let i=0;i<4;i++) meta.frames.push({x:i*64,y:0,w:64,h:96,ax:32,ay:72});
const LEGACY_BOSS_EFFECT_SPRITE_META = Object.freeze(Object.fromEntries(
  Object.keys(LEGACY_BOSS_EFFECT_SPRITE_DATA).map(key => [key,Object.freeze({frameW:96,frameH:96,frames:4})])
));
const LEGACY_BOSS_EFFECT_SPRITES = {};
const BOSS20_EFFECT_SPRITE_META = Object.freeze(Object.fromEntries(
  Object.keys(BOSS20_EFFECT_SPRITE_DATA).map(key => [key,Object.freeze({frameW:96,frameH:96,frames:4})])
));
/* Листы героев содержат только четыре кадра ходьбы 32×32: анимации атак
   и призыва удалены, потому что они создавали лишние кадры и визуальный шум. */
const HERO_SPRITE_META = {
  archer:{frameW:32,frameH:32,drawW:48,drawH:48},
  mage:{frameW:32,frameH:32,drawW:48,drawH:48},
  warrior:{frameW:32,frameH:32,drawW:48,drawH:48},
  necromancer:{frameW:32,frameH:32,drawW:48,drawH:48},
};
/* Подклассы V4 используют восемь выровненных кадров ходьбы 36×36 строго вправо.
   Размер отрисовки не меняет механический p.r. */
const SUBCLASS_HERO_FRAME_SIZE = 36;
const SUBCLASS_HERO_FRAME_COUNT = 8;
const SUBCLASS_HERO_DRAW_SIZE = 64;
/* Обычная свита и голем крови отображаются в 24 px, костяной голем — в 18 px.
   Это только визуальный размер: механические m.r не меняются. */
const MINION_SPRITE_META = {
  skeleton:{frameW:24,frameH:24,drawW:24,drawH:24,stride:12},
  bombardier:{frameW:24,frameH:24,drawW:24,drawH:24,stride:12},
  golemB:  {frameW:24,frameH:24,drawW:24,drawH:24,stride:18},
  golemN:  {frameW:18,frameH:18,drawW:18,drawH:18,stride:14},
};
const MINION_SPRITES = {};
function minionSpriteFrame(m){
  const meta = m && MINION_SPRITE_META[m.kind];
  if (!meta) return null;
  const index = Math.floor(m.animT||0) % 4;
  return {index, meta, x:index*meta.frameW, y:0, w:meta.frameW, h:meta.frameH};
}
const HERO_SPRITE_KEY_BY_WEAPON = {bow:'archer',wand:'mage',necro:'necromancer',blade:'warrior'};
function heroPreviewHTML(key, className, subclassKey){
  const data = subclassKey && SUBCLASS_HERO_SPRITE_DATA[subclassKey] || HERO_SPRITE_DATA[key];
  if (!HERO_SPRITE_META[key] || !data) return '';
  return '<span class="hero-preview sheet ' + (className||'') +
    '" data-hero-preview="1"' + (subclassKey ? ' data-subclass-preview="1"' : '') +
    ' role="img" aria-label="" style="background-image:url(' + data + ')"></span>';
}
function heroSpriteFor(key, subclassKey){
  const subclassSprite = subclassKey && SUBCLASS_HERO_SPRITES[subclassKey];
  return subclassSprite && subclassSprite.complete && subclassSprite.naturalWidth ?
    subclassSprite : HERO_SPRITES[key];
}
const LOOT_SPRITE_META = {
  pickupXp:  {frameW:16,frameH:16,drawW:16,drawH:16},
  pickupGold:{frameW:16,frameH:16,drawW:16,drawH:16},
  fire:      {frameW:128,frameH:128,drawW:128,drawH:128},
  cold:      {frameW:128,frameH:128,drawW:128,drawH:128},
  shock:     {frameW:128,frameH:128,drawW:128,drawH:128},
  poison:    {frameW:128,frameH:128,drawW:128,drawH:128},
  bleed:     {frameW:128,frameH:128,drawW:128,drawH:128},
  xp:        {frameW:128,frameH:128,drawW:128,drawH:128},
  monster:   {frameW:128,frameH:128,drawW:128,drawH:128},
};
const LOOT_SPRITES = {};
function lootSpriteFrame(o){
  if (!o) return null;
  const key = o.book || (o.gold ? 'pickupGold' : o.v !== undefined ? 'pickupXp' : null);
  const meta = key && LOOT_SPRITE_META[key];
  if (!meta) return null;
  // Книги — отдельные статичные 128×128. Только опыт и золото сохраняют
  // четырёхкадровое движение; источник предмета больше не зависит от G.time.
  const index = o.book ? 0 : Math.floor(((G && G.time) || 0) * 8) % 4;
  return {key,index,meta,x:index*meta.frameW,y:0,w:meta.frameW,h:meta.frameH};
}
const GROUND_POOL_SPRITE_META = {
  tar:         {frameW:32,frameH:32,frameMs:240},
  ogreAcid:    {frameW:32,frameH:32,frameMs:190},
  bossAcid:    {frameW:64,frameH:64,frameMs:250},
  boilingBlood:{frameW:32,frameH:32,frameMs:200},
  lavaTrail:   {frameW:32,frameH:32,frameMs:160},
  frostTrail:  {frameW:32,frameH:32,frameMs:230},
  venomAcid:   {frameW:32,frameH:32,frameMs:200},
  tyrantFire:  {frameW:32,frameH:32,frameMs:140},
};
const GROUND_POOL_SPRITES = {};
function groundPoolSpriteFrame(key){
  const meta=GROUND_POOL_SPRITE_META[key];
  if (!meta) return null;
  const index=Math.floor((((G && G.time) || 0)*1000)/meta.frameMs)%4;
  return {key,index,meta,x:index*meta.frameW,y:0,w:meta.frameW,h:meta.frameH};
}
const RARE_ITEM_SPRITES = {};
const RARE_ITEM_FLOOR_SPRITES = {};
const BOOK_FLOOR_SPRITES = {};
const TOTEM_SPRITES = {};
const BLOOD_SPRITES = {};
const CORPSE_SPRITES = {};
const CORPSE_PUDDLE_ATLAS = typeof Image !== 'undefined' ? new Image() : null;
if (CORPSE_PUDDLE_ATLAS) CORPSE_PUDDLE_ATLAS.src = CORPSE_PUDDLE_DATA.atlas;
const ENEMY_STATUS_ICONS = typeof Image !== 'undefined' ? new Image() : null;
if (ENEMY_STATUS_ICONS) ENEMY_STATUS_ICONS.src = ENEMY_STATUS_ICON_DATA;
const FLOOR_PORTAL_SPRITE = typeof Image !== 'undefined' ? new Image() : null;
if (FLOOR_PORTAL_SPRITE) FLOOR_PORTAL_SPRITE.src = FLOOR_PORTAL_SPRITE_DATA;
const FLOOR_PORTAL_APPEAR_SPRITE = typeof Image !== 'undefined' ? new Image() : null;
if (FLOOR_PORTAL_APPEAR_SPRITE) FLOOR_PORTAL_APPEAR_SPRITE.src = FLOOR_PORTAL_APPEAR_SPRITE_DATA;
function rareItemSpriteHTML(key, className=''){
  const data=RARE_ITEM_SPRITE_DATA[key];
  return data ? '<img class="rare-item-icon ' + className + '" src="' + data + '" alt="">' : '';
}
function totemSpriteEntry(key, tier){
  const rank=Math.max(1,Math.min(4,Number(tier)||1));
  const data=TOTEM_SPRITE_DATA[key] && TOTEM_SPRITE_DATA[key][rank-1];
  const sprite=TOTEM_SPRITES[key] && TOTEM_SPRITES[key][rank-1];
  return {rank,data,sprite};
}
function totemSpriteHTML(key, tier, className=''){
  const entry=totemSpriteEntry(key,tier);
  return entry.data ? '<img class="totem-icon ' + className + '" src="' + entry.data + '" alt="">' : '';
}
/* UI использует канонический статичный PNG книги 128×128. Наземная производная
   24×24 загружается отдельно и никогда не попадает в HTML интерфейса. */
function lootSpriteHTML(key, className=''){
  const data=LOOT_SPRITE_DATA[key], meta=LOOT_SPRITE_META[key];
  if (!data || !meta) return '';
  return '<img class="loot-item-icon ' + className + '" src="' + data + '" alt="">';
}
function pickupRevealHTML(icon, color, boosted=false){
  const seeds=[[-72,-36],[-48,-66],[-12,-76],[28,-70],[60,-48],[76,-12],[68,30],[42,62],
    [5,76],[-34,66],[-66,42],[-78,5],[-42,-30],[44,22]], sparks=[];
  const layers=boosted?5:1;
  for (let layer=0;layer<layers;layer++){
    const angle=layer*0.23, scale=1+layer*0.12, cos=Math.cos(angle), sin=Math.sin(angle);
    for (const seed of seeds) sparks.push([
      Math.round((seed[0]*cos-seed[1]*sin)*scale),
      Math.round((seed[0]*sin+seed[1]*cos)*scale)
    ]);
  }
  const effects=boosted?Array.from({length:5},(_,i)=>'<i class="pickup-reveal__effect" style="--ring:' +
    (118+i*24) + 'px;--delay:-' + (i*0.54).toFixed(2) + 's;--turn:' + (i%2?'-360deg':'360deg') + '"></i>').join(''):'';
  return '<div id="amuico" class="pickup-reveal' + (boosted?' boosted':'') + '" style="--pickup-color:' + color + '">' +
    effects + '<div class="pickup-reveal__icon">' + icon + '</div>' +
    sparks.map((p,i)=>'<i class="pickup-reveal__spark" style="--x:' + p[0] + 'px;--y:' + p[1] +
      'px;--spark-size:' + (3+i%4) + 'px;--delay:-' + (i*0.07).toFixed(2) + 's"></i>').join('') + '</div>';
}
if (typeof Image !== 'undefined'){
  for (const key of Object.keys(ENEMY_SPRITE_META)){
    const img = new Image(); img.src = ENEMY_SPRITE_META[key].src; ENEMY_SPRITES[key] = img;
  }
  for (const key of Object.keys(ELITE_SPRITE_META)){
    const img = new Image(); img.src = ELITE_SPRITE_META[key].src; ELITE_SPRITES[key] = img;
  }
  for (const key of Object.keys(ENEMY_ATTACK_SPRITE_META)){
    const img = new Image(); img.src = ENEMY_ATTACK_SPRITE_META[key].src; ENEMY_ATTACK_SPRITES[key] = img;
  }
  for (const key of Object.keys(ELITE_ATTACK_SPRITE_META)){
    const img = new Image(); img.src = ELITE_ATTACK_SPRITE_META[key].src; ELITE_ATTACK_SPRITES[key] = img;
  }
  for (const key of Object.keys(BOSS_SPRITE_META)){
    const img = new Image(); img.src = BOSS_SPRITE_META[key].src; BOSS_SPRITES[key] = img;
  }
  for (const key of Object.keys(BOSS_ATTACK_SPRITE_META)){
    const img=new Image(); img.src=BOSS_ATTACK_SPRITE_META[key].src; BOSS_ATTACK_SPRITES[key]=img;
  }
  for (const [key,src] of Object.entries(LEGACY_BOSS_EFFECT_SPRITE_DATA)){
    const img=new Image(); img.src=src; LEGACY_BOSS_EFFECT_SPRITES[key]=img;
  }
  for (const [key,src] of Object.entries(BOSS20_EFFECT_SPRITE_DATA)){
    const img=new Image(); img.src=src; BOSS20_EFFECT_SPRITES[key]=img;
  }
  for (const key of Object.keys(CONSTELLATION_SPRITE_DATA)){
    const img = new Image(); img.src = CONSTELLATION_SPRITE_DATA[key]; CONSTELLATION_SPRITES[key] = img;
  }
  for (const key of Object.keys(MINION_SPRITE_META)){
    const img = new Image(); img.src = MINION_SPRITE_DATA[key]; MINION_SPRITES[key] = img;
  }
  for (const key of Object.keys(LOOT_SPRITE_META)){
    const img = new Image(); img.src = LOOT_SPRITE_DATA[key]; LOOT_SPRITES[key] = img;
  }
  for (const key of Object.keys(GROUND_POOL_SPRITE_META)){
    const img = new Image(); img.src = GROUND_POOL_SPRITE_DATA[key]; GROUND_POOL_SPRITES[key] = img;
  }
  for (const key of Object.keys(RARE_ITEM_SPRITE_DATA)){
    const img = new Image(); img.src = RARE_ITEM_SPRITE_DATA[key]; RARE_ITEM_SPRITES[key] = img;
  }
  for (const key of Object.keys(RARE_ITEM_FLOOR_SPRITE_DATA)){
    const img = new Image(); img.src = RARE_ITEM_FLOOR_SPRITE_DATA[key]; RARE_ITEM_FLOOR_SPRITES[key] = img;
  }
  for (const key of Object.keys(BOOK_FLOOR_SPRITE_DATA)){
    const img = new Image(); img.src = BOOK_FLOOR_SPRITE_DATA[key]; BOOK_FLOOR_SPRITES[key] = img;
  }
  for (const [key,rows] of Object.entries(TOTEM_SPRITE_DATA)){
    TOTEM_SPRITES[key] = rows.map(data => { const img=new Image(); img.src=data; return img; });
  }
  for (const [key,data] of Object.entries(BLOOD_SPRITE_DATA)){
    const img=new Image(); img.src=data; BLOOD_SPRITES[key]=img;
  }
  for (const [key,data] of Object.entries(CORPSE_SPRITE_DATA)){
    const img=new Image(); img.src=data; CORPSE_SPRITES[key]=img;
  }
}
