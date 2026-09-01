/* Проверка пакета правок. */
const {loadGame} = require('./sim');
const DT = 1/60;
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(44) + (det||''));
function mk(mods){
  const c = loadGame('./GrimGrind.html');
  c.newGame('bow','keys');
  const G = c.__api.G;
  G.lvl = 20;
  for (const [k,v,kind] of mods||[]) G.bag.add(k, kind||'flat', v);
  c.recalc(); G.player.hp = c.__api.D.life;
  return {c, G, D:c.__api.D, p:G.player};
}

console.log('УЖАСАЮЩИЙ ВАМПИР');
{ const {D} = mk([['kDread',1]]);
  ok('вампиризм ровно 0.5%', D.leech === 0.5, D.leech + '%'); }
{ const {c,D,p} = mk([['leech',20],['kDread',1]]);
  ok('перебивает вампиризм с карточек', D.leech === 0.5, 'было бы ' + D.leechBase + '%'); }
{ const {c,G,D,p} = mk([['kDread',1]]);
  p.hp = 100; c.heal(9999);
  ok('прямое лечение не работает', p.hp === 100); }
{ const {c,G,D,p} = mk([['kDread',1]]);
  G.amu.fang = true; c.recalc();
  const e = c.spawnEnemy(); e.kind = 'elite'; e.x = 9e5; e.y = 9e5;
  p.hp = 100; c.killEnemy(e, G.enemies.indexOf(e));
  ok('клык вампира погашен', p.hp === 100); }
{ const {c,G,D,p} = mk([['kDread',1]]);
  G.amu.chalice = true; c.recalc();
  p.kills = 49; const e = c.spawnEnemy(); e.x = 9e5; e.y = 9e5;
  p.hp = 100; c.killEnemy(e, G.enemies.indexOf(e));
  ok('чаша крови погашена', p.hp === 100); }
{ const {c,G,D,p} = mk([['kDread',1],['regen',50]]);
  // Комнату чистим: иначе игрок бьёт врагов, а вытягивание — разрешённый канал,
  // и здоровье растёт не от регенерации, которую мы как раз проверяем
  G.enemies.length = 0; G.spawnQueue = 0;
  p.hp = 100;
  for (let i=0;i<180;i++){ c.update(DT); G.pending = 0; }
  ok('регенерация погашена', p.hp === 100, 'реген ' + D.regen.toFixed(1) + '/сек, здоровье ' + p.hp); }
{ const {c,G,D,p} = mk([['kDread',1]]);
  G.enemies.length = 0; G.spawnQueue = 0; p.hp = 50;
  c.queueDreadLeech(30);
  for (let i=0;i<90;i++){ c.update(DT); G.pending = 0; }
  const half = p.hp;
  for (let i=0;i<90;i++){ c.update(DT); G.pending = 0; }
  ok('поток равномерно приходит за 3 секунды', Math.abs(half-65)<0.05 && Math.abs(p.hp-80)<0.05 && p.leechPool<0.001,
     '50 → ' + half.toFixed(1) + ' → ' + p.hp.toFixed(1)); }
{ const {c,G,D,p} = mk([['kDread',1]]);
  G.enemies.length = 0; G.spawnQueue = 0; p.hp = 1;
  c.queueDreadLeech(1000);
  for (let i=0;i<60;i++){ c.update(DT); G.pending = 0; }
  const gained = p.hp-1;
  ok('мягкий потолок 8% максимального HP/сек', Math.abs(gained-D.life*0.08)<0.05 && p.leechPool>900,
     gained.toFixed(2) + ' HP/сек, очередь ' + Math.round(p.leechPool)); }
{ const {c,G,D,p} = mk([['kDread',1]]);
  G.enemies.length = 0; G.spawnQueue = 0; p.hp = D.life;
  c.queueDreadLeech(1000);
  for (let i=0;i<180;i++){ c.update(DT); G.pending = 0; }
  ok('переполнение даёт щит максимум 15% HP', Math.abs(p.dreadShield-D.life*0.15)<0.05,
     p.dreadShield.toFixed(1) + ' / ' + D.life); }
{ const {c,D,p} = mk([['kDread',1]]);
  p.dreadShield = 20; const before = p.hp;
  c.hurt(30, true, false, 'ТЕСТ');
  ok('красный щит принимает урон раньше здоровья', Math.abs(p.dreadShield)<0.001 && Math.abs(p.hp-(before-10))<0.001,
     'щит 20 + HP ' + before + ' против 30 урона'); }
{ const {c,G,D,p} = mk([]);
  p.hp = 100; c.heal(50);
  ok('без кейстоуна лечение обычное', p.hp === 150); }
{ const c = loadGame('./GrimGrind.html');
  ok('карточка «Вампиризм %» убрана из каталога',
     !c.__api.MODS.some(m => m.id === 'life.leech'));
  const k = c.__api.MODS.find(m => m.id === 'key.dread_vampire');
  ok('кейстоун в каталоге, редкость 3', !!k && k.rar === 3 && k.cat === 'Кейстоун' && k.noMin); }
{ const c = loadGame('./GrimGrind.html'); c.newGame('necro','keys');
  c.__api.G.bag.add('kDread','flag',1); c.recalc();
  ok('Ужасающий вампир не действует у Некроманта', !c.__api.D.dread && c.__api.D.leech !== 0.5); }

console.log('ПРОЧЕЕ');
{ const {c,G} = mk([]), bleed = c.__api.BOOKS.bleed;
  G.items = {bleed:{tier:3, val:bleed.tiers[2][0]}}; c.recalc();
  const dps = c.bookBleedDps(), fullDps = c.avgHit() * 0.50 * c.__api.D.ailEff;
  ok('книга крови вдвое слабее', JSON.stringify(bleed.tiers) === '[[15,15],[20,20],[25,25]]' &&
     JSON.stringify(bleed.step) === '[5,5]' && Math.abs(dps - fullDps*0.5) < 0.0001,
     'тир 3: 50% \u2192 ' + bleed.tiers[2][0] + '%, ' + Math.round(fullDps) + ' \u2192 ' + Math.round(dps) + ' урона/сек'); }
{ const {c,G} = mk([]);
  G.floor = 1; c.buildFloor();
  const e = c.spawnEnemy();
  const base = c.__api.ETYPES[e.t.shape === 'circle' ? 'blob' : e.t.shape === 'triangle' ? 'runner' :
               e.t.shape === 'square' ? 'tank' : 'shooter'].spd;
  const expect = base * (e.kind === 'elite' ? 0.9 : 1);
  ok('скорость берётся из итогового значения типа', Math.abs(e.spd - expect) < 0.01,
     Math.round(base) + ' \u2192 ' + Math.round(e.spd)); }
