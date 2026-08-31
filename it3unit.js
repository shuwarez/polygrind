/* Пять новых предметов. */
const {loadGame} = require('./sim');
const DT = 1/60;
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(46) + (det||''));
/* Небольшой seeded RNG делает проверки дропа воспроизводимыми. Раньше тест
   создавал 1600 VM и надеялся, что среднее случайных монет попадёт в допуск. */
function seededRng(seed){
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}
function mk(amus, random){
  const c = loadGame('./PolyGrind.html', random ? {random} : undefined);
  c.newGame('necro','keys');
  const G = c.__api.G;
  G.lvl = 25;
  for (const a of [].concat(amus||[])) G.amu[a] = true;
  c.recalc();
  G.floor = 12; c.buildFloor();
  G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0;
  const p = G.player; p.hp = c.__api.D.life;
  return {c, G, D:c.__api.D, p};
}
function foe(o, kind){
  const e = o.c.spawnEnemy();
  e.maxHp = e.hp = 1e9; e.spd = 0; e.dmg = 0; e.x = 9e5; e.y = 9e5;
  e.kind = kind || 'norm'; e.xp = 100;
  return e;
}

console.log('ТАЛИСМАН СКОРОСТИ');
{ const o = mk('swift');
  const base = {a:o.D.aspd, m:o.D.mspd, ma:o.D.minAspd, ms:o.D.minSpd};
  const norm = foe(o, 'norm');
  o.c.killEnemy(norm, o.G.enemies.indexOf(norm));
  ok('рядовой не заряжает', o.p.swiftT === 0);
  const el = foe(o, 'elite');
  o.c.killEnemy(el, o.G.enemies.indexOf(el));
  ok('элита заряжает на 5 сек', o.p.swiftT === 5);
  ok('+20% скорости атаки', Math.abs(o.D.aspd/base.a - 1.2) < 0.01, base.a.toFixed(2) + ' \u2192 ' + o.D.aspd.toFixed(2));
  ok('+20% бега', Math.abs(o.D.mspd/base.m - 1.2) < 0.01, Math.round(base.m) + ' \u2192 ' + Math.round(o.D.mspd));
  ok('свита разогналась тоже', Math.abs(o.D.minAspd/base.ma - 1.2) < 0.01 && Math.abs(o.D.minSpd/base.ms - 1.2) < 0.01,
     'атака ' + base.ma.toFixed(2) + ' \u2192 ' + o.D.minAspd.toFixed(2) + ', бег ' + Math.round(base.ms) + ' \u2192 ' + Math.round(o.D.minSpd));
  for (let i=0;i<60*5.2;i++){ o.c.update(DT); o.G.pending = 0; o.p.hp = o.D.life; }
  ok('через 5 сек разгон спадает', o.p.swiftT === 0 && Math.abs(o.D.aspd - base.a) < 0.01); }

console.log('ТАЛИСМАН ВЫЖИВАНИЯ');
{ const o = mk('survive');
  const base = {a:o.D.aspd, ma:o.D.minAspd};
  o.p.hp = o.D.life*0.9; o.c.update(DT); o.G.pending = 0;
  ok('при полном здоровье не работает', Math.abs(o.D.aspd - base.a) < 0.01);
  o.p.hp = o.D.life*0.2; o.c.update(DT); o.G.pending = 0;
  ok('ниже трети: +20% атаки и свите', Math.abs(o.D.aspd/base.a - 1.2) < 0.01 &&
     Math.abs(o.D.minAspd/base.ma - 1.2) < 0.01);
  o.p.hp = o.D.life; o.c.update(DT); o.G.pending = 0;
  ok('подлечился — разгон снят', Math.abs(o.D.aspd - base.a) < 0.01); }

console.log('ПРОЧЕЕ');
{ const a = mk([]), b = mk('arrow');
  ok('стрела: +50% скорости снарядов', Math.abs(b.D.projSpd/a.D.projSpd - 1.5) < 0.01,
     a.D.projSpd.toFixed(2) + ' \u2192 ' + b.D.projSpd.toFixed(2));
  // дальность выстрела свиты не должна поехать
  const rng = (o) => { const G = o.G; G.minions.length = 0; o.c.spawnMinion(undefined,undefined,'bombardier');
    const m = G.minions[0]; G.shots.length = 0; const e = foe(o,'norm'); e.x = o.p.x+200; e.y = o.p.y;
    o.c.minionShot(m, e, 'fire'); const s = G.shots[0]; return Math.hypot(s.vx,s.vy)*s.life; };
  ok('дальность выстрела не изменилась', Math.abs(rng(a) - rng(b)) < 1,
     Math.round(rng(a)) + ' и ' + Math.round(rng(b))); }
{ const gold = (amu, kind, seed) => {
    const o = mk(amu, seededRng(seed));
    let sum = 0;
    // Один VM на вариант, но достаточно бросков, чтобы проверить округление.
    // Парные варианты получают один seed и потому видят один поток случайности.
    for (let i=0; i<64; i++){
      o.G.orbs.length = 0;
      const e = foe(o, kind);
      o.c.killEnemy(e, o.G.enemies.indexOf(e));
      sum += o.G.orbs.filter(x=>x.gold).reduce((s,x)=>s+x.v,0);
    }
    return sum;
  };
  const seed = 0x504F4C59;
  const a = gold([], 'elite', seed), b = gold('goldbag', 'elite', seed);
  const an = gold([], 'norm', seed), bn = gold('goldbag', 'norm', seed);
  ok('мешок золота: +50% с элиты', Math.abs(b/a - 1.5) < 0.06, Math.round(a) + ' \u2192 ' + Math.round(b));
  ok('с рядовых надбавки нет', Math.abs(bn/an - 1) < 0.06, Math.round(an) + ' и ' + Math.round(bn)); }
{ const xp = (amu, kind) => {
    const o = mk(amu); o.G.orbs.length = 0;
    const e = foe(o, kind);
    o.c.killEnemy(e, o.G.enemies.indexOf(e));
    return o.G.orbs.filter(x=>!x.gold && x.v).reduce((s,x)=>s+x.v,0);
  };
  ok('мешок опыта: +50% с босса', Math.abs(xp('xpbag','boss')/xp([],'boss') - 1.5) < 0.01,
     xp([],'boss') + ' \u2192 ' + xp('xpbag','boss'));
  ok('с рядовых надбавки нет', xp('xpbag','norm') === xp([],'norm')); }
