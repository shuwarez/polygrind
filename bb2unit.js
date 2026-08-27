/* Кровавая баня и Кипящая кровь. */
const {loadGame} = require('./sim');
const DT = 1/60;
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(48) + (det||''));
function mk(mods, items){
  const c = loadGame('./PolyGrind.html');
  c.newGame('necro','keys');
  const G = c.__api.G;
  G.lvl = 25;
  for (const [k,v,kind] of mods||[]) G.bag.add(k, kind||'flat', v);
  if (items) G.items = items;
  c.recalc();
  G.floor = 12; c.buildFloor();
  G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0; G.boils.length = 0;
  const p = G.player; p.hp = c.__api.D.life;
  return {c, G, D:c.__api.D, p};
}
function foe(o, dx, dy, hp){
  const e = o.c.spawnEnemy();
  e.maxHp = e.hp = hp || 1e9; e.spd = 0; e.dmg = 0;
  e.x = o.p.x + (dx||40); e.y = o.p.y + (dy||0);
  e.kind = 'norm'; e.armor = 0; e.ward = null; e.bulwark = 0;
  return e;
}

console.log('КРОВАВАЯ БАНЯ');
{ const o = mk([['minBath',1]]);
  const e = foe(o); o.G.minions.length = 0; o.c.spawnMinion();
  const m = o.G.minions[0]; m.x = e.x; m.y = e.y;
  let procs = 0;
  for (let i=0;i<4000;i++){ e.dots.bleed.dps = 0; e.dots.bleed.n = 0; o.c.minionHit(e, m); if (e.dots.bleed.dps > 0) procs++; }
  ok('срабатывает в 2.5% ударов свиты', Math.abs(procs/4000 - 0.025) < 0.01, (procs/40).toFixed(1) + '%'); }
{ const o = mk([['minBath',1]]);
  const e = foe(o); o.G.minions.length = 0; o.c.spawnMinion();
  const m = o.G.minions[0]; m.x = e.x; m.y = e.y;
  let dps = 0;
  for (let i=0;i<3000 && !dps;i++){ e.dots.bleed.dps = 0; o.c.minionHit(e, m); dps = e.dots.bleed.dps; }
  ok('без книги крови: базовые 15% и штраф урона ×0.5',
     Math.abs(dps/(o.c.avgHit()*0.15*o.D.ailEff*0.5) - 1) < 0.35, Math.round(dps) + ' урона/сек'); }
{ const o = mk([['minBath',1]], {bleed:{tier:3, val:25}});
  const e = foe(o); o.G.minions.length = 0; o.c.spawnMinion();
  const m = o.G.minions[0]; m.x = e.x; m.y = e.y; let dps = 0;
  // Книга крови может сработать тем же ударом раньше Кровавой бани. Старый
  // тест хватал первый любой bleed и мигал от случайности. Ждём именно подпись
  // механики и один стак: тогда замерен стак Бани без примеси книжного прока.
  for (let i=0;i<10000 && !dps;i++){
    e.dots.bleed.dps = 0; e.dots.bleed.n = 0; o.G.fx.length = 0;
    o.c.minionHit(e, m);
    if (e.dots.bleed.n === 1 && o.G.fx.some(f=>f.t==='txt' && f.s==='КРОВЬ')) dps=e.dots.bleed.dps;
  }
  ok('с книгой берётся её сила и штраф урона ×0.5', Math.abs(dps/(o.c.bookBleedDps()*0.5)-1)<0.001,
     Math.round(o.c.bookBleedDps()) + ' → ' + Math.round(dps) + ' урона/сек'); }
{ const o = mk([]);
  const e = foe(o); o.G.minions.length = 0; o.c.spawnMinion();
  const m = o.G.minions[0]; m.x = e.x; m.y = e.y;
  let procs = 0;
  for (let i=0;i<2000;i++){ e.dots.bleed.dps = 0; o.c.minionHit(e, m); if (e.dots.bleed.dps > 0) procs++; }
  ok('без карточки не срабатывает', procs === 0); }

console.log('КИПЯЩАЯ КРОВЬ');
{ const o = mk([['minBoil',1]]);
  o.G.minions.length = 0; o.c.spawnMinion();
  const m = o.G.minions[0];
  let n = 0;
  for (let i=0;i<4000;i++){ o.G.boils.length = 0; o.c.boilRoll(m); if (o.G.boils.length) n++; }
  ok('шанс лужи 5%', Math.abs(n/4000 - 0.05) < 0.015, (n/40).toFixed(1) + '%'); }
{ const o = mk([['minBoil',1]]);
  const e = foe(o, 0, 0, 10000);
  o.G.boils.push({x:e.x, y:e.y, r:60, life:3, t:1});
  const hp0 = e.hp;
  for (let i=0;i<60*3.2;i++) o.c.tickBoils(DT);
  const left = e.hp/hp0;
  ok('три тика по 5% текущего здоровья', Math.abs(left - 0.857) < 0.02,
     Math.round(hp0) + ' \u2192 ' + Math.round(e.hp) + ' (осталось ' + Math.round(left*100) + '%)'); }
{ const o = mk([['minBoil',1]]);
  const e = foe(o, 0, 0, 1e9);
  o.G.boils.push({x:e.x, y:e.y, r:60, life:3, t:1});
  const hp0 = e.hp;
  for (let i=0;i<60*3.2;i++) o.c.tickBoils(DT);
  ok('доля не зависит от размера цели', Math.abs(e.hp/hp0 - 0.857) < 0.02,
     'у цели с миллиардом осталось ' + Math.round(e.hp/hp0*100) + '%'); }
{ const o = mk([['minBoil',1]]);
  const e = foe(o, 500, 0);
  o.G.boils.push({x:o.p.x, y:o.p.y, r:60, life:3, t:1});
  const hp0 = e.hp;
  for (let i=0;i<60*3.2;i++) o.c.tickBoils(DT);
  ok('вне лужи урона нет', e.hp === hp0); }
{ const o = mk([['minBoil',1]]);
  o.G.boils.push({x:0, y:0, r:60, life:3, t:1});
  for (let i=0;i<60*3.2;i++) o.c.tickBoils(DT);
  ok('лужа исчезает через 3 сек', o.G.boils.length === 0); }
{ const o = mk([['minBoil',1]]);
  o.G.minions.length = 0; o.c.spawnMinion();
  const m = o.G.minions[0];
  for (let i=0;i<3000;i++) o.c.boilRoll(m);
  ok('потолок на число луж держит', o.G.boils.length <= 24, 'луж ' + o.G.boils.length); }
{ const o = mk([]);
  o.G.minions.length = 0; o.c.spawnMinion();
  for (let i=0;i<3000;i++) o.c.boilRoll(o.G.minions[0]);
  ok('без карточки луж не появляется', o.G.boils.length === 0); }
