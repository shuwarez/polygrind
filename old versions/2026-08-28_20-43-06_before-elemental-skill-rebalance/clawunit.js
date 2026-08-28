/* Резкие когти и Вихрь когтей. */
const {loadGame} = require('./sim');
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
  e.x = o.p.x + (dx||40); e.y = o.p.y + (dy||0);
  e.kind = 'norm'; e.armor = 0; e.ward = null; e.bulwark = 0;
  return e;
}

{ // средний удар за серию: 5-й добавляет 30%, значит серия из 5 весит 5.3 удара
  const avg = (mods, n) => {
    const o = mk(mods); const e = foe(o); o.m.x = e.x; o.m.y = e.y;
    let s = 0;
    for (let i=0;i<n;i++){ const h = e.hp; o.c.minionHit(e, o.m); s += h - e.hp; }
    return s/n;
  };
  const base = avg([], 4000), claws = avg([['minClaws',1]], 4000);
  ok('резкие когти: +6% к среднему удару', Math.abs(claws/base - 1.06) < 0.02,
     base.toFixed(1) + ' \u2192 ' + claws.toFixed(1) + ' (x' + (claws/base).toFixed(3) + ')'); }
{ // Усредняем по многим сериям: у одного удара разброс базы больше, чем +30%
  const o = mk([['minClaws',1]]);
  const e = foe(o); o.m.x = e.x; o.m.y = e.y;
  const sum = new Array(5).fill(0);
  for (let s2=0;s2<800;s2++)
    for (let i=0;i<5;i++){ const h = e.hp; o.c.minionHit(e, o.m); sum[i] += h - e.hp; }
  const fifth = sum[4]/800, other = (sum[0]+sum[1]+sum[2]+sum[3])/3200;
  ok('срабатывает именно на пятом ударе', Math.abs(fifth/other - 1.30) < 0.06,
     'обычный ' + other.toFixed(1) + ', пятый ' + fifth.toFixed(1) + ' (x' + (fifth/other).toFixed(2) + ')'); }
{ const o = mk([['minWhirl',1]]);
  const e = foe(o), near = foe(o, 40, 40), far = foe(o, 40, 300);
  o.m.x = e.x; o.m.y = e.y;
  const h1 = near.hp, h2 = far.hp;
  for (let i=0;i<10;i++) o.c.minionHit(e, o.m);
  ok('вихрь: задевает соседа на 10-м ударе', near.hp < h1, 'снято ' + Math.round(h1-near.hp));
  ok('дальнего не задевает', far.hp === h2, 'радиус ' + Math.round(55*o.D.aoeR)); }
{ const o = mk([['minWhirl',1]]);
  const e = foe(o), near = foe(o, 40, 40);
  o.m.x = e.x; o.m.y = e.y;
  const h1 = near.hp;
  for (let i=0;i<9;i++) o.c.minionHit(e, o.m);
  ok('до десятого удара вихря нет', near.hp === h1); }
{ const o = mk([['minWhirl',1],['aoeR',100,'inc']]);
  const e = foe(o), far = foe(o, 40, 100);
  o.m.x = e.x; o.m.y = e.y;
  const h = far.hp;
  for (let i=0;i<10;i++) o.c.minionHit(e, o.m);
  ok('радиус растёт от «Радиуса области»', far.hp < h, 'радиус ' + Math.round(55*o.D.aoeR)); }
{ // счётчик у каждого свой
  const o = mk([['minClaws',1]]);
  o.c.spawnMinion(undefined, undefined, 'skeleton');
  const e = foe(o);
  const [m1, m2] = o.G.minions;
  m1.x = m2.x = e.x; m1.y = m2.y = e.y;
  for (let i=0;i<5;i++) o.c.minionHit(e, m1);
  ok('счётчик у каждого приспешника свой', m1.hitN === 5 && m2.hitN === 0,
     'первый ' + m1.hitN + ', второй ' + m2.hitN); }
{ const o = mk([['minClaws',1],['igniteCh',100]]);
  const e = foe(o); o.m.x = e.x; o.m.y = e.y;
  let procs = 0;
  for (let i=0;i<1200;i++){
    o.m.hitN = 4; e.dots.fire.dps = 0; e.dots.fire.n = 0;
    o.c.minionHit(e, o.m);
    if (e.dots.fire.dps > 0) procs++;
  }
  const rate = procs/1200; // два независимых броска по 25%: 1 - 0.75² = 43.75%
  ok('добавочный удар несёт эффекты', rate > 0.36 && rate < 0.51,
     Math.round(rate*100) + '% при цели 43.8%'); }
{ const o = mk([]);
  const e = foe(o); o.m.x = e.x; o.m.y = e.y;
  for (let i=0;i<12;i++) o.c.minionHit(e, o.m);
  ok('без карточек счётчик не ведётся', !o.m.hitN); }
