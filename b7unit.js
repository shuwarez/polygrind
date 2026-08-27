/* Проверка пакета правок. */
const {loadGame} = require('./sim');
const DT = 1/60;
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(44) + (det||''));
function mk(mods){
  const c = loadGame('./PolyGrind.html');
  c.newGame('bow','keys');
  const G = c.__api.G;
  G.lvl = 20;
  for (const [k,v,kind] of mods||[]) G.bag.add(k, kind||'flat', v);
  c.recalc(); G.player.hp = c.__api.D.life;
  return {c, G, D:c.__api.D, p:G.player};
}

console.log('УЖАСАЮЩИЙ ВАМПИР');
{ const {D} = mk([['kDread',1]]);
  ok('вампиризм ровно 0.3%', D.leech === 0.3, D.leech + '%'); }
{ const {c,D,p} = mk([['leech',20],['kDread',1]]);
  ok('перебивает вампиризм с карточек', D.leech === 0.3, 'было бы ' + D.leechBase + '%'); }
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
  // Комнату чистим: иначе игрок бьёт врагов, а 0.3% вытягивания — разрешённый канал,
  // и здоровье растёт не от регенерации, которую мы как раз проверяем
  G.enemies.length = 0; G.spawnQueue = 0;
  p.hp = 100;
  for (let i=0;i<180;i++){ c.update(DT); G.pending = 0; }
  ok('регенерация погашена', p.hp === 100, 'реген ' + D.regen.toFixed(1) + '/сек, здоровье ' + p.hp); }
{ const {c,G,D,p} = mk([['kDread',1]]);
  p.hp = 100; p.leechPool = 200;
  for (let i=0;i<180;i++){ c.update(DT); G.pending = 0; }
  ok('вытягивание работает', p.hp > 100, '100 \u2192 ' + Math.round(p.hp)); }
{ const {c,G,D,p} = mk([]);
  p.hp = 100; c.heal(50);
  ok('без кейстоуна лечение обычное', p.hp === 150); }
{ const c = loadGame('./PolyGrind.html');
  ok('карточка «Вампиризм %» убрана из каталога',
     !c.__api.MODS.some(m => m.id === 'life.leech'));
  const k = c.__api.MODS.find(m => m.id === 'key.dread_vampire');
  ok('кейстоун в каталоге, редкость 3', !!k && k.rar === 3 && k.cat === 'Кейстоун' && k.noMin); }
{ const c = loadGame('./PolyGrind.html'); c.newGame('necro','keys');
  c.__api.G.bag.add('kDread','flag',1); c.recalc();
  ok('Ужасающий вампир не действует у Некроманта', !c.__api.D.dread && c.__api.D.leech !== 0.3); }

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
  const expect = base * 1.265 * 1.155 * (e.kind === 'elite' ? 0.9 : 1);
  ok('враги быстрее ещё на 5% (итого 1.461075×)', Math.abs(e.spd - expect) < 0.01,
     Math.round(base) + ' \u2192 ' + Math.round(e.spd)); }
