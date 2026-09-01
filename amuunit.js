/* Поштучная проверка амулетов: делает ли каждый ровно то, что написано. */
const {loadGame} = require('./sim');
const DT = 1/60;

function mk(ids, floor){
  const c = loadGame('./index.html');
  c.newGame('bow','keys');
  const G = c.__api.G;
  for (const i of [].concat(ids)) G.amu[i] = true;
  G.lvl = 20; c.recalc();
  G.floor = floor || 10; c.buildFloor();
  G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0; G.portal = null;
  G.player.hp = c.__api.D.life;
  return {c, G, D:c.__api.D, p:G.player};
}
function addEnemy(c, x, y){
  const G = c.__api.G, n = G.enemies.length;
  const e = c.spawnEnemy();
  e.x = x; e.y = y; return e;
}
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(38) + (det||''));

console.log('ХАРАКТЕРИСТИКИ');
{ const c = loadGame('./index.html'), A = c.__api.AMULETS;
  ok('два осколка имеют разные ключи и эффекты',
    A.shard.nm === 'ЗЕРКАЛЬНЫЙ ОСКОЛОК' && A.bossShard.nm === 'ОСКОЛОК БОССА' && A.shard !== A.bossShard); }
{ const a = mk([]), b = mk(['golem']);
  ok('сердце голема: +50 брони', b.D.armor - a.D.armor === 50, a.D.armor + ' \u2192 ' + b.D.armor); }
{ const c1 = loadGame('./index.html'); c1.newGame('bow','keys');
  c1.__api.G.bag.add('leech','flat',40); c1.recalc();        // уже за потолком 25%
  const before = c1.__api.D.leech;
  c1.__api.G.amu.fang = true; c1.recalc();
  ok('клык вампира: +4% поверх потолка', Math.abs(c1.__api.D.leech - before - 4) < 0.01,
     before + '% \u2192 ' + c1.__api.D.leech + '%'); }
{ const a = mk([]), b = mk(['clock']);
  ok('часовой механизм: +10% скорости атаки', Math.abs(b.D.aspd/a.D.aspd - 1.1) < 0.001,
     a.D.atkCd.toFixed(3) + ' \u2192 ' + b.D.atkCd.toFixed(3) + ' сек между ударами'); }
{ const a = mk([]), b = mk(['candle']);
  ok('чёрная свеча: +20% врагов, +15% опыта',
     Math.abs(b.D.monsterMore/a.D.monsterMore-1.2)<0.001 && Math.abs(b.D.xpGain-a.D.xpGain-0.15)<0.001); }
{ const a = mk([]), b = mk(['ice']);
  ok('ледяной кристалл: заморозка +40%', Math.abs(b.D.freezeDur-1.4)<0.001); }

console.log('РЕАКЦИИ НА УРОН');
{ const {c,G,D,p} = mk(['golem']);
  G.amuT.golem = 0;
  const hp0 = p.hp; c.hurt(500);
  const blocked = p.hp === hp0;
  const hp1 = p.hp; c.hurt(500);                     // второй удар уже проходит
  ok('сердце голема: гасит удар и уходит в откат', blocked && p.hp < hp1,
     'откат ' + G.amuT.golem + ' сек'); }
{ const {c,G,D,p} = mk(['calm']);
  p.stillT = 3; c.tickAmulets(DT);
  const bar = p.barrier;
  const hp0 = p.hp; c.hurt(bar*0.5);
  ok('талисман покоя: барьер 10% и съедает урон',
     Math.abs(bar - D.life*0.1) < 0.01 && p.hp === hp0,
     'барьер ' + Math.round(bar) + ' из ' + Math.round(D.life)); }
{ const {c,G,D,p} = mk(['doll']);
  p.hp = 10; c.hurt(99999);
  const saved = p.hp === 10 && G.amuT.doll === 0;
  p.inv = 0; p.hp = 10; c.hurt(99999);
  ok('кукла смерти: один заряд, потом смерть', saved && p.hp <= 0); }
{ const {c,G,D,p} = mk(['doll']);
  p.hp = 10; c.hurt(99999); G.portal = {x:p.x, y:p.y, r:34, t:9};
  p.inv = 0; c.update(DT);
  ok('кукла смерти: чинится на новом этаже', G.amuT.doll === 1, 'этаж ' + G.floor); }
{ const {c,G,D,p} = mk(['mirror']);
  G.amuT.mirror = 0; c.hurt(10);
  ok('чёрное зеркало: копия появилась', !!G.clone, G.clone ? 'жизнь ' + G.clone.life + ' сек' : '');
  p.inv = 0; G.clone = null; c.hurt(10);
  ok('чёрное зеркало: второй раз только по откату', !G.clone); }
{ const {c,G,D,p} = mk(['mirror']);
  addEnemy(c, p.x+150, p.y);
  G.amuT.mirror = 0; c.hurt(10);
  const before = G.shots.length;
  for (let i=0;i<60*1;i++) c.tickAmulets(DT);
  ok('копия стреляет сама', G.shots.length > before, 'выстрелов ' + (G.shots.length-before));
  for (let i=0;i<60*4;i++) c.tickAmulets(DT);
  ok('копия исчезает через 3 сек', !G.clone); }
{ const {c,G,D,p} = mk(['shard']);
  let reflected = 0;
  for (let i=0;i<2000;i++){
    G.eshots.length = 0; G.shots.length = 0; p.inv = 0; p.hp = D.life;
    G.eshots.push({x:p.x, y:p.y, vx:-200, vy:0, r:6, life:2, dmg:1});
    c.update(DT);
    if (G.shots.length) reflected++;
  }
  ok('зеркальный осколок: отбивает ~10%', Math.abs(reflected/2000-0.10) < 0.02,
     (reflected/20).toFixed(1) + '%'); }

console.log('УБИЙСТВА И ЛЕЧЕНИЕ');
{ const {c,G,D,p} = mk(['fang']);
  const e = addEnemy(c, p.x+100, p.y); e.kind = 'elite';
  p.hp = D.life*0.5; const hp0 = p.hp;
  c.killEnemy(e, G.enemies.indexOf(e));
  ok('клык вампира: элита лечит 15%', Math.abs(p.hp-hp0-D.life*0.15) < 0.01,
     '+' + Math.round(p.hp-hp0) + ' из ' + Math.round(D.life)); }
{ const {c,G,D,p} = mk(['ash']);
  const e = addEnemy(c, p.x+100, p.y); e.dots.fire.dps = 5;
  p.hp = D.life*0.5; const hp0 = p.hp;
  c.killEnemy(e, G.enemies.indexOf(e));
  ok('пепельное сердце: горящий лечит 1%', Math.abs(p.hp-hp0-D.life*0.01) < 0.01); }
{ const {c,G,D,p} = mk(['plague']);
  let jumps = 0;
  for (let i=0;i<2000;i++){
    G.enemies.length = 0;
    const e = addEnemy(c, 0, 0), o = addEnemy(c, 60, 0);
    e.dots.poison.dps = 50; e.dots.poison.dur = 4; o.dots.poison.dps = 0;
    c.killEnemy(e, G.enemies.indexOf(e));
    if (o.dots.poison.dps > 0) jumps++;
  }
  ok('чумной зуб: яд прыгает в 10% случаев', Math.abs(jumps/2000-0.10) < 0.025,
     (jumps/20).toFixed(1) + '%'); }

console.log('ТАЙМЕРЫ');
{ const {c,G,D,p} = mk(['storm']);
  const e = addEnemy(c, p.x+200, p.y); const hp0 = e.hp;
  G.amuT.storm = 0; c.tickAmulets(DT);
  ok('сердце бури: бьёт и шокирует', e.hp < hp0 && e.ail.shock > 0,
     'снято ' + Math.round(hp0-e.hp) + ' из ' + Math.round(hp0) + ', откат ' + G.amuT.storm); }
{ const {c,G,D,p} = mk(['clock']);
  const e = addEnemy(c, p.x+150, p.y), far = addEnemy(c, p.x+900, p.y);
  G.amuT.clock = 0; c.tickAmulets(DT);
  ok('часовой механизм: морозит вокруг', e.ail.freeze > 0 && far.ail.freeze <= 0,
     'заморозка ' + e.ail.freeze.toFixed(2) + ' сек, радиус ' + Math.round(240*D.aoeR)); }
{ const {c,G,D,p} = mk(['bone']);
  const e = addEnemy(c, p.x+80, p.y); e.maxHp = e.hp = 1e9;
  let crits = 0;
  const fx0 = () => G.fx.filter(f=>f.t==='num'&&f.crit).length;
  for (let i=0;i<200;i++){ const b0 = fx0(); c.damage(e, {}); if (fx0() > b0) crits++; }
  ok('кость удачи: минимум каждый 20-й крит', crits >= 10, 'критов ' + crits + ' из 200'); }
{ const {c,G,D,p} = mk(['runner']);
  p.stillT = 2; const e = addEnemy(c, p.x+80, p.y);
  const inc = c.conditionalInc(e);
  p.stillT = 0; p.moving = true;
  ok('талисман бегуна: +20% урона с места', Math.abs(inc - c.conditionalInc(e) - 20) < 0.01); }
