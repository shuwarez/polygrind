/* Буйство демонов: открытие, взрыв, эффекты, отсутствие рекурсии. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(48) + (det||''));
function mk(mods, amus){
  const c = loadGame('./PolyGrind.html');
  c.newGame('necro','keys');
  const G = c.__api.G;
  G.lvl = 25;
  for (const [k,v,kind] of mods||[]) G.bag.add(k, kind||'flat', v);
  for (const a of amus||[]) G.amu[a] = true;
  G.floor = 12; c.buildFloor();
  G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0;
  const p = G.player; p.hp = c.__api.D.life;
  c.spawnMinion();
  return {c, G, D:c.__api.D, p, m:G.minions[0]};
}
function foe(o, dx, dy){
  const e = o.c.spawnEnemy();
  e.maxHp = e.hp = 1e9; e.spd = 0; e.x = o.p.x + dx; e.y = o.p.y + dy;
  // Тип врага выпадает случайно, а вместе с ним броня и оберег: без выравнивания
  // сравнение «по цели против по соседу» мерило бы разницу типов, а не взрыв
  e.kind = 'norm'; e.armor = 0; e.ward = null; e.bulwark = 0;
  return e;
}

{ const o = mk([['minDmg',40,'inc']]);
  ok('до +50% урона карточка закрыта', !o.c.__api.MODS.find(m=>m.id==='min.frenzy').show()); }
{ const o = mk([['minDmg',50,'inc']]);
  const m = o.c.__api.MODS.find(x=>x.id==='min.frenzy');
  ok('на +50% открывается, редкость красная', m.show() && m.rar === 4);
  ok('потолок ветки урона не появился',
     (() => { const c2 = mk([['minDmg',300,'inc']]); return c2.D.minDmgRaw === 300; })(),
     'вложено 300% → ' + mk([['minDmg',300,'inc']]).D.minDmgRaw + '%'); }

{ const o = mk([['minDmg',50,'inc'],['minFrenzy',1]]);
  const tgt = foe(o, 40, 0), near = foe(o, 40, 50), far = foe(o, 40, 400);
  o.m.x = tgt.x; o.m.y = tgt.y;
  const h1 = near.hp, h2 = far.hp;
  o.c.minionHit(tgt, o.m);
  ok('взрыв задевает соседа', near.hp < h1, 'снято ' + Math.round(h1-near.hp));
  ok('дальнего не задевает', far.hp === h2, 'радиус ' + Math.round(70*o.D.aoeR)); }

{ const a = mk([['minDmg',50,'inc'],['minFrenzy',1]]);
  const b = mk([['minDmg',50,'inc'],['minFrenzy',1],['aoeR',100,'inc']]);
  ok('радиус растёт от «Радиуса области»',
     Math.abs((70*b.D.aoeR)/(70*a.D.aoeR) - 2) < 0.01,
     Math.round(70*a.D.aoeR) + ' \u2192 ' + Math.round(70*b.D.aoeR)); }

{ const o = mk([['minDmg',50,'inc'],['minFrenzy',1],['igniteCh',100]]);
  const tgt = foe(o, 40, 0), near = foe(o, 40, 50);
  o.m.x = tgt.x; o.m.y = tgt.y;
  let procs = 0;
  for (let i=0;i<600;i++){
    near.dots.fire.dps = 0; near.dots.fire.n = 0;
    o.c.minionHit(tgt, o.m);
    if (near.dots.fire.dps > 0) procs++;
  }
  const rate = procs/600;
  ok('взрыв разносит эффекты с шансом свиты', rate > 0.17 && rate < 0.33,
     Math.round(rate*100) + '%'); }

{ // урон взрыва равен удару
  const avg = (frenzy) => {
    const o = mk(frenzy ? [['minDmg',50,'inc'],['minFrenzy',1]] : [['minDmg',50,'inc']]);
    const tgt = foe(o, 40, 0), near = foe(o, 40, 50);
    o.m.x = tgt.x; o.m.y = tgt.y;
    let sT = 0, sN = 0;
    for (let i=0;i<1500;i++){
      const a = tgt.hp, b = near.hp;
      o.c.minionHit(tgt, o.m);
      sT += a - tgt.hp; sN += b - near.hp;
    }
    return {tgt:sT/1500, near:sN/1500};
  };
  const f = avg(true);
  ok('взрыв бьёт на полный урон удара', Math.abs(f.near/f.tgt - 1) < 0.12,
     'по цели ' + f.tgt.toFixed(1) + ', по соседу ' + f.near.toFixed(1)); }

{ // рекурсии нет: два врага рядом не устраивают цепную лавину
  const o = mk([['minDmg',50,'inc'],['minFrenzy',1]]);
  const a2 = foe(o, 40, 0), b2 = foe(o, 40, 40), c2 = foe(o, 40, 80);
  o.m.x = a2.x; o.m.y = a2.y;
  const before = [a2.hp, b2.hp, c2.hp];
  o.c.minionHit(a2, o.m);
  const dmg = [before[0]-a2.hp, before[1]-b2.hp, before[2]-c2.hp];
  ok('цепной лавины нет', dmg[1] < dmg[0]*2.2 && dmg[2] < dmg[0]*2.2,
     dmg.map(x=>Math.round(x)).join(' / ')); }
