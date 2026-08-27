/* Свита обязана триггерить всё то же, что и удар игрока. */
const {loadGame} = require('./sim');
const DT = 1/60;
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(48) + (det||''));
function mk(mods, amus){
  const c = loadGame('./PolyGrind.html');
  c.newGame('necro','keys');
  const G = c.__api.G;
  G.lvl = 25;
  for (const [k,v,kind] of mods||[]) G.bag.add(k, kind||'flat', v);
  for (const a of amus||[]) G.amu[a] = true;
  c.recalc();
  G.floor = 12; c.buildFloor();
  G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0;
  const p = G.player; p.hp = c.__api.D.life;
  const e = c.spawnEnemy(); e.maxHp = e.hp = 1e9; e.spd = 0; e.x = p.x+40; e.y = p.y;
  c.spawnMinion();
  const m = G.minions[0]; m.x = e.x; m.y = e.y;
  return {c, G, D:c.__api.D, p, e, m};
}
const hit = o => o.c.minionHit(o.e, o.m);

console.log('СТАТУСЫ ОТ УДАРА СВИТЫ');
{ const o = mk([['igniteCh',100]]); hit(o);
  ok('поджог', o.e.dots.fire.dps > 0, Math.round(o.e.dots.fire.dps) + ' урона/сек'); }
{ const o = mk([['chillCh',100]]); hit(o);
  ok('охлаждение', o.e.ail.chill > 0); }
{ const o = mk([['chillCh',100],['freeze',1]]); hit(o);
  ok('заморозка', o.e.ail.freeze > 0); }
{ const o = mk([['shockCh',100]]);
  const other = o.c.spawnEnemy(); other.maxHp = other.hp = 1e9; other.x = o.e.x+60; other.y = o.e.y;
  const h0 = other.hp; hit(o);
  ok('шок и разряд по округе', o.e.ail.shock > 0 && other.hp < h0,
     'соседу прилетело ' + Math.round(h0-other.hp)); }
{ const o = mk([['poiCh',100]]); hit(o);
  ok('яд', o.e.dots.poison.dps > 0); }
{ const o = mk([['stun',100]]); hit(o);
  ok('оглушение', o.e.ail.stun > 0); }
{ const impulse = (typeKey, kind) => {
    const o = mk([['knock',100]]);
    o.e.typeKey = typeKey; o.e.kind = kind; o.e.kb.x = o.e.kb.y = 0; hit(o);
    return Math.hypot(o.e.kb.x, o.e.kb.y);
  };
  const normal = impulse('blob','norm');
  const runner = impulse('runner','norm');
  const elite = impulse('blob','elite');
  const eliteRunner = impulse('runner','elite');
  const boss = impulse('tank','boss');
  ok('обычное отбрасывание: полная сила', Math.abs(normal - 260) < 0.01, normal.toFixed(1));
  ok('Бегун: сила отбрасывания −30%', Math.abs(runner/normal - 0.70) < 0.001, runner.toFixed(1));
  ok('любая элита: сила отбрасывания −50%', Math.abs(elite/normal - 0.50) < 0.001, elite.toFixed(1));
  ok('элитный Бегун использует элитные −50%', Math.abs(eliteRunner/normal - 0.50) < 0.001, eliteRunner.toFixed(1));
  ok('босс: сила отбрасывания −90%', Math.abs(boss/normal - 0.10) < 0.001, boss.toFixed(1)); }
{ const o = mk([['execute',90]]);
  // Тип врага случайный: элите добивание не положено (только kind==='norm'),
  // из-за чего проверка мигала примерно в каждом четвёртом запуске
  o.e.kind = 'norm'; o.e.maxHp = 1000; o.e.hp = 100; hit(o);
  ok('добивание', o.e.hp <= 0); }

console.log('ЕСТЕСТВЕННАЯ СМЕРТЬ СВИТЫ');
{ const c = loadGame('./PolyGrind.html'); c.newGame('necro','keys');
  const G = c.__api.G; G.minions.length = 0;
  for (let i=0;i<8;i++) c.spawnMinion(undefined,undefined,'skeleton');
  const timers = G.minions.map(m => m.deathT);
  ok('каждый боец получает независимые 10–15 секунд', timers.every(t => t >= 10 && t <= 15) &&
     new Set(timers.map(t => t.toFixed(6))).size > 1,
     Math.min(...timers).toFixed(2) + '–' + Math.max(...timers).toFixed(2) + ' сек'); }
{ const c = loadGame('./PolyGrind.html'); c.newGame('necro','keys','venomancer');
  const G = c.__api.G; G.bag.add('minBoom','flag',1); c.recalc();
  G.floor = 12; c.buildFloor(); G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0;
  const m = G.minions[0], beforeCount = G.minions.length;
  const e = c.spawnEnemy(); e.kind = 'norm'; e.maxHp = e.hp = 1e9; e.armor = 0; e.ward = null; e.bulwark = 0;
  e.spd = 0; e.dmg = 0; e.x = m.x+80; e.y = m.y;
  const hp0 = e.hp; m.deathT = 0.001; c.update(1/60);
  ok('таймер убивает через общий посмертный путь', G.minions.length === beforeCount-1 && e.hp < hp0,
     'свита ' + beforeCount + ' → ' + G.minions.length + ' · взрыв ' + Math.round(hp0-e.hp));
  ok('естественная смерть создаёт кислоту веномансера', G.acidPools.length === 1,
     'луж: ' + G.acidPools.length);
  G.enemies.length = 0; G.spawnQueue = 0; G.portal = null; G.corpses.length = 0; G.raiseT = 0;
  const deadCount = G.minions.length; c.update(0.24); const beforeRevive = G.minions.length; c.update(0.02);
  ok('погибший возвращается по правилу 0.25 секунды', beforeRevive === deadCount && G.minions.length === deadCount+1,
     'до: ' + beforeRevive + ' · после: ' + G.minions.length); }

console.log('ПРЕДМЕТЫ И КНИГИ');
{ const o = mk([], ['thunder']);
  o.p.hitN = 11; hit(o);
  ok('перчатки грома от удара свиты', o.e.ail.shock > 0, 'счётчик стал ' + o.p.hitN); }
{ const o = mk([], ['pulse']);
  const other = o.c.spawnEnemy(); other.maxHp = other.hp = 1e9; other.x = o.e.x+50; other.y = o.e.y;
  o.p.hitN = 7; const h0 = other.hp; hit(o);
  ok('кольцо импульса от удара свиты', other.hp < h0); }
{ const o = mk([], ['bone']);
  o.p.hitN = 19; const crits0 = o.G.stats.crits; hit(o);
  ok('кость удачи: 20-й удар свиты — крит', o.p.hitN === 20 && o.G.stats.crits === crits0 + 1,
     'счётчик ' + o.p.hitN + ', критов +' + (o.G.stats.crits-crits0)); }
{ // Усредняем: одиночный удар шумит на разбросе базы сильнее, чем множитель 1.75
  const o = mk([], ['duel']);
  o.e.kind = 'norm'; o.e.armor = 0; o.e.ward = null; o.e.bulwark = 0;
  const avg = () => { let s = 0; for (let i=0;i<1200;i++){ const h = o.e.hp; hit(o); s += h - o.e.hp; } return s/1200; };
  const solo = avg();
  const other = o.c.spawnEnemy(); other.x = o.p.x+50; other.y = o.p.y;
  const pair = avg();
  ok('кольцо дуэли действует на удар свиты', solo > pair*1.5,
     pair.toFixed(1) + ' \u2192 ' + solo.toFixed(1)); }
{ const o = mk([]);
  o.G.items = {fire:{tier:3,val:12}}; o.c.recalc();
  let procs = 0;
  for (let i=0;i<200;i++){ o.e.dots.fire.dps = 0; hit(o); if (o.e.dots.fire.dps > 0) procs++; }
  ok('книга огня срабатывает от свиты', procs > 0, procs + ' проков на 200 ударов'); }

console.log('ВАМПИРЫ ХОЗЯИНА');
{ const o = mk([['minLife',50,'inc'],['minVamp',1]]);
  o.m.hp = o.m.max*0.5; const before = o.m.hp;
  const hp0 = o.p.hp = o.D.life*0.5;
  hit(o);
  ok('приспешник лечит себя', o.m.hp > before, '+' + Math.round(o.m.hp-before));
  ok('хозяину не достаётся', o.p.hp === hp0); }
{ const o = mk([['minLife',50,'inc'],['minVamp',1]]);
  o.m.hp = o.m.max; hit(o);
  ok('не лечит выше максимума', o.m.hp === o.m.max); }
{ const o = mk([['minLife',40,'inc']]);
  ok('до +50% здоровья карточка закрыта',
     !o.c.__api.MODS.find(m=>m.id==='min.vampires').show()); }

console.log('ПРОЧЕЕ');
{ // Одиночный удар слишком шумит: и разброс базы, и случайный тип цели.
  // Усредняем по одной и той же цели с обнулённой бронёй.
  const avg = (crit) => {
    const o = mk(crit ? [['minCrit',100,'inc']] : []);
    o.e.kind = 'norm'; o.e.armor = 0; o.e.ward = null; o.e.bulwark = 0;
    let s = 0;
    for (let i=0;i<1500;i++){ const h = o.e.hp; hit(o); s += h - o.e.hp; }
    return s/1500;
  };
  const noCrit = avg(false), withCrit = avg(true);
  ok('крит свиты считается по D.minCrit', withCrit > noCrit*1.3,
     noCrit.toFixed(1) + ' \u2192 ' + withCrit.toFixed(1)); }
{ const o = mk([['minLeech',20]]);
  o.p.hp = o.D.life*0.5; const hp0 = o.p.hp; hit(o);
  ok('вампиризм свиты хозяину по-прежнему работает', o.p.hp > hp0); }
