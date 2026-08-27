/* Свита наследует эффекты хозяина с отдельным балансом урона и шансов. */
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
const procRate = (o, reset, active, n=600) => {
  let procs = 0;
  for (let i=0;i<n;i++){
    reset(); hit(o);
    if (active()) procs++;
  }
  return procs/n;
};
const quarter = v => v > 0.17 && v < 0.33;

console.log('СТАТУСЫ ОТ УДАРА СВИТЫ');
{ const o = mk([['igniteCh',100]]);
  const r = procRate(o, ()=>{ o.e.dots.fire.dps=0; o.e.dots.fire.n=0; }, ()=>o.e.dots.fire.dps>0);
  ok('поджог: 100% хозяина → около 25% у свиты', quarter(r), Math.round(r*100) + '%'); }
{ const o = mk([['chillCh',100]]);
  const r = procRate(o, ()=>{ o.e.ail.chill=0; }, ()=>o.e.ail.chill>0);
  ok('охлаждение: 100% хозяина → около 25%', quarter(r), Math.round(r*100) + '%'); }
{ const o = mk([['chillCh',100],['freeze',1]]);
  const r = procRate(o, ()=>{ o.e.ail.chill=0; o.e.ail.freeze=0; }, ()=>o.e.ail.freeze>0);
  ok('заморозка: 100% хозяина → около 25%', quarter(r), Math.round(r*100) + '%'); }
{ const o = mk([['shockCh',100]]);
  const other = o.c.spawnEnemy(); other.maxHp = other.hp = 1e9; other.x = o.e.x+60; other.y = o.e.y;
  const r = procRate(o, ()=>{ o.e.ail.shock=0; }, ()=>o.e.ail.shock>0);
  ok('шок: 100% хозяина → около 25%', quarter(r) && other.hp < other.maxHp, Math.round(r*100) + '%'); }
{ const o = mk([['poiCh',100]]);
  const r = procRate(o, ()=>{ o.e.dots.poison.dps=0; o.e.dots.poison.n=0; }, ()=>o.e.dots.poison.dps>0);
  ok('яд: 100% хозяина → около 25%', quarter(r), Math.round(r*100) + '%'); }
{ const o = mk([['stun',100]]);
  const r = procRate(o, ()=>{ o.e.ail.stun=0; }, ()=>o.e.ail.stun>0);
  ok('оглушение: 100% хозяина → около 25%', quarter(r), Math.round(r*100) + '%'); }
{ const impulse = (typeKey, kind) => {
    const o = mk([['knock',100]]);
    o.e.typeKey = typeKey; o.e.kind = kind;
    let force = 0, procs = 0;
    for (let i=0;i<600;i++){
      o.e.kb.x = o.e.kb.y = 0; hit(o);
      const f = Math.hypot(o.e.kb.x, o.e.kb.y);
      if (f > 0){ procs++; force = f; }
    }
    return {force, rate:procs/600};
  };
  const normal = impulse('blob','norm');
  const runner = impulse('runner','norm');
  const elite = impulse('blob','elite');
  const eliteRunner = impulse('runner','elite');
  const boss = impulse('tank','boss');
  ok('отбрасывание свиты: полная сила, шанс 25%', Math.abs(normal.force - 260) < 0.01 && quarter(normal.rate),
     normal.force.toFixed(1) + ' · ' + Math.round(normal.rate*100) + '%');
  ok('Бегун: сила отбрасывания −30%', Math.abs(runner.force/normal.force - 0.70) < 0.001, runner.force.toFixed(1));
  ok('любая элита: сила отбрасывания −50%', Math.abs(elite.force/normal.force - 0.50) < 0.001, elite.force.toFixed(1));
  ok('элитный Бегун использует элитные −50%', Math.abs(eliteRunner.force/normal.force - 0.50) < 0.001, eliteRunner.force.toFixed(1));
  ok('босс: сила отбрасывания −90%', Math.abs(boss.force/normal.force - 0.10) < 0.001, boss.force.toFixed(1)); }
{ const o = mk([['execute',90]]);
  // Тип врага случайный: элите добивание не положено (только kind==='norm'),
  // из-за чего проверка мигала примерно в каждом четвёртом запуске
  o.e.kind = 'norm'; o.e.maxHp = 1000; o.e.hp = 100; hit(o);
  ok('добивание', o.e.hp <= 0); }

console.log('БАЛАНС ВСЕЙ СВИТЫ');
{ const o = mk([]);
  const avg = minion => {
    let sum = 0;
    for (let i=0;i<1800;i++){
      const hp = o.e.hp;
      o.c.damage(o.e, {mul:o.D.minDmgMul, minion:minion ? o.m : null, noDouble:true});
      sum += hp-o.e.hp;
    }
    return sum/1800;
  };
  const ownerPath = avg(false), minionPath = avg(true);
  ok('весь прямой урон свиты уменьшен на 50%', Math.abs(minionPath/ownerPath-0.5) < 0.03,
     ownerPath.toFixed(1) + ' → ' + minionPath.toFixed(1)); }
{ const o = mk([]); o.G.shots.length = 0; o.c.minionShot(o.m, o.e, null);
  const s = o.G.shots[0];
  ok('стрелы охотников сохраняют метку свиты', s && s.minion === o.m && s.mul === 0.20); }
{ const o = mk([]); let procs = 0, dps = 0;
  for (let i=0;i<600;i++){
    o.e.dots.fire.dps=0; o.e.dots.fire.n=0;
    if (o.c.applyMinionSpell(o.e, 'fire')){ procs++; dps = o.e.dots.fire.dps; }
  }
  const expected = o.c.avgHit()*0.20*0.5*0.25*o.D.ailEff;
  ok('колдун: шанс эффекта 25% и половина урона', procs > 102 && procs < 198 && Math.abs(dps/expected-1)<0.001,
     Math.round(procs/6) + '% · ' + dps.toFixed(2) + ' урона/сек'); }
{ const o = mk([]); o.D.golemN = 1; let procs = 0, dps = 0;
  for (let i=0;i<600;i++){
    o.e.dots.bleed.dps=0; o.e.dots.bleed.n=0; o.c.boneGolemHit(o.e);
    if (o.e.dots.bleed.dps > 0){ procs++; dps = o.e.dots.bleed.dps; }
  }
  const expected = o.c.avgHit()*0.03*o.D.ailEff*0.5;
  ok('костяной голем: шанс 25% и половина урона', procs > 102 && procs < 198 && Math.abs(dps/expected-1)<0.001,
     Math.round(procs/6) + '% · ' + dps.toFixed(2) + ' урона/сек'); }
{ const o = mk([]); o.m.kind = 'golemB'; o.e.kind = 'norm'; o.e.typeKey = 'blob'; let procs = 0, force = 0;
  for (let i=0;i<600;i++){
    o.e.kb.x=o.e.kb.y=0; hit(o); const f=Math.hypot(o.e.kb.x,o.e.kb.y);
    if (f>0){ procs++; force=f; }
  }
  ok('голем крови: врождённое отбрасывание с шансом 25%', procs > 102 && procs < 198 && Math.abs(force-200)<0.01,
     Math.round(procs/6) + '% · сила ' + force.toFixed(0)); }

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
  for (let i=0;i<1200;i++){ o.e.dots.fire.dps = 0; o.e.dots.fire.n = 0; hit(o); if (o.e.dots.fire.dps > 0) procs++; }
  const expected = 30 * 0.25; // книга третьего тира: 30% у хозяина, 7.5% у свиты
  ok('шанс книги от свиты также уменьшен на 75%', procs/12 > expected*0.65 && procs/12 < expected*1.35,
     Math.round(procs/12) + '% при цели ' + expected.toFixed(1) + '%'); }
{ const o = mk([]); o.G.items = {poison:{tier:3,val:12}}; o.c.recalc(); let dps = 0;
  for (let i=0;i<600 && !dps;i++){
    o.e.dots.poison.dps=0; o.e.dots.poison.n=0; hit(o); dps=o.e.dots.poison.dps;
  }
  ok('фиксированный урон книги от свиты тоже ×0.5', dps > 0 && Math.abs(dps/(o.D.bookPoiDps*0.5)-1)<0.001,
     dps.toFixed(2) + ' при базе ' + o.D.bookPoiDps.toFixed(2)); }

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
