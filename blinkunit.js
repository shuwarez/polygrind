/* Внезапный взрыв и Астральный набег. */
const {loadGame} = require('./sim');
const DT = 1/60;
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(48) + (det||''));
function mk(mods){
  const c = loadGame('./PolyGrind.html');
  c.newGame('necro','keys');
  const G = c.__api.G;
  G.lvl = 25;
  for (const [k,v,kind] of mods||[]) G.bag.add(k, kind||'flat', v);
  c.recalc();
  G.floor = 12; c.buildFloor();
  G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0;
  const p = G.player; p.hp = c.__api.D.life;
  G.minions.length = 0; c.spawnMinion(undefined, undefined, 'skeleton');
  return {c, G, D:c.__api.D, p, m:G.minions[0]};
}
function foe(o, dx, dy){
  const e = o.c.spawnEnemy();
  e.maxHp = e.hp = 1e12; e.spd = 0; e.dmg = 0;
  e.x = o.p.x + dx; e.y = o.p.y + (dy||0);
  e.kind = 'norm'; e.armor = 0; e.ward = null; e.bulwark = 0;
  return e;
}

{ const o = mk([['minBlink',1]]);
  const e = foe(o, 400);
  o.m.blinkT = 0; o.m.x = o.p.x; o.m.y = o.p.y;
  const d0 = Math.hypot(o.m.x-e.x, o.m.y-e.y);
  o.c.minionBlink(o.m, e, DT);
  const d1 = Math.hypot(o.m.x-e.x, o.m.y-e.y);
  const landing = e.r + o.m.r + 4;
  ok('перенос: приспешник оказался у цели', Math.abs(d1 - landing) < 0.001 && d0 > 300,
     Math.round(d0) + ' \u2192 ' + Math.round(d1)); }
{ const o = mk([['minBlink',1]]);
  const e = foe(o, 400), near = foe(o, 400, 40), far = foe(o, 400, 300);
  o.m.blinkT = 0;
  const h1 = near.hp, h2 = far.hp, h0 = e.hp;
  o.c.minionBlink(o.m, e, DT);
  ok('взрыв бьёт цель и соседа', e.hp < h0 && near.hp < h1);
  ok('дальнего не задевает', far.hp === h2, 'радиус ' + Math.round(60*o.D.aoeR)); }
{ const o = mk([['minBlink',1],['igniteCh',100]]);
  const e = foe(o, 400);
  let procs = 0;
  for (let i=0;i<600;i++){
    o.m.blinkT = 0; e.dots.fire.dps = 0; e.dots.fire.n = 0;
    o.c.minionBlink(o.m, e, DT);
    if (e.dots.fire.dps > 0) procs++;
  }
  const rate = procs/600;
  ok('взрыв разносит эффекты с шансом свиты', rate > 0.17 && rate < 0.33,
     Math.round(rate*100) + '%'); }
{ const o = mk([['minBlink',1]]);
  const e = foe(o, 400);
  o.m.blinkT = 0; o.c.minionBlink(o.m, e, DT);
  ok('уходит в откат 10 сек', Math.abs(o.m.blinkT - 10) < 0.02, 'таймер ' + o.m.blinkT.toFixed(1));
  const before = {x:o.m.x, y:o.m.y};
  o.m.x = o.p.x; o.m.y = o.p.y;
  o.c.minionBlink(o.m, e, DT);
  ok('второй раз не срабатывает до отката', Math.hypot(o.m.x-e.x, o.m.y-e.y) > 300); }
{ const o = mk([['minRaid',1]]);
  const e = foe(o, 400);
  o.m.blinkT = 0; o.c.minionBlink(o.m, e, DT);
  ok('набег: откат 4 сек', Math.abs(o.m.blinkT - 4) < 0.02); }
{ const dmg = (mods) => {
    const o = mk(mods); const e = foe(o, 400);
    let s = 0;
    for (let i=0;i<800;i++){ o.m.blinkT = 0; const h = e.hp; o.c.minionBlink(o.m, e, DT); s += h - e.hp; }
    return s/800;
  };
  const base = (() => { const o = mk([]); const e = foe(o, 40); o.m.x = e.x; o.m.y = e.y;
    let s = 0; for (let i=0;i<800;i++){ const h = e.hp; o.c.minionHit(e, o.m); s += h - e.hp; } return s/800; })();
  const b1 = dmg([['minBlink',1]]), b2 = dmg([['minRaid',1]]);
  ok('взрыв на 30% удара', Math.abs(b1/base - 0.30) < 0.05, (b1/base*100).toFixed(0) + '%');
  ok('набег на 50% удара', Math.abs(b2/base - 0.50) < 0.06, (b2/base*100).toFixed(0) + '%'); }
{ const a = mk([['minBlink',1]]), b = mk([['minRaid',1]]);
  ok('радиус набега больше', b.D.minBlink.r > a.D.minBlink.r,
     Math.round(a.D.minBlink.r*a.D.aoeR) + ' \u2192 ' + Math.round(b.D.minBlink.r*b.D.aoeR)); }
{ const a = mk([['minRaid',1],['aoeR',100,'inc']]);
  ok('радиус растёт от «Радиуса области»', Math.abs(a.D.minBlink.r*a.D.aoeR - 200) < 1,
     Math.round(a.D.minBlink.r*a.D.aoeR)); }
{ const o = mk([]);
  const e = foe(o, 400);
  o.m.blinkT = 0;
  const d0 = Math.hypot(o.m.x-e.x, o.m.y-e.y);
  ok('без карточки переноса нет', o.D.minBlink === null); }
