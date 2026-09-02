/* Базовые кривые врагов: проверяем прямо по созданному врагу, чтобы смена
   константы не спряталась за случайным выбором типа, элитой или боссом. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(46) + (det || ''));

function enemy(floor){
  const c = loadGame('./index.html');
  c.newGame('bow', 'keys');
  const G = c.__api.G;
  G.floor = floor;
  const e = c.spawnEnemy();
  return e;
}

{ const stable=Object.keys({blade:1,bow:1,wand:1,necro:1}).every(key=>{
    const c=loadGame('./index.html'); c.newGame(key,'keys'); const G=c.__api.G,w=G.weapon;
    G.lvl=100; G.floor=100; c.recalc();
    return Math.abs(c.__api.D.baseMin-w.dmg[0])<1e-9&&Math.abs(c.__api.D.baseMax-w.dmg[1])<1e-9;
  });
  ok('уровень и этаж не повышают базовый урон героев',stable); }

{ const e = enemy(2);
  const hpKind = e.kind === 'boss' ? 4 : e.kind === 'elite' ? 3.2 : 1;
  const dmgKind = e.kind === 'boss' ? 1.9 : e.kind === 'elite' ? 1.3 : 1;
  const hpOk = e.hp === Math.round(e.t.hp * hpKind * 1.18);
  const dmgOk = Math.abs(e.dmg - e.t.dmg * dmgKind * 1.11) < 0.0001;
  ok('HP +16%, урон +15% за этаж', hpOk && dmgOk,
     'HP ' + e.t.hp.toFixed(0) + ' → ' + e.hp.toFixed(0) + ', урон ' + e.t.dmg.toFixed(2) + ' → ' + e.dmg.toFixed(2)); }

{ const c = loadGame('./index.html'); c.newGame('bow','keys');
  const G=c.__api.G; G.floor=1;
  const bosses=c.__api.BOSS_KEYS.map(key=>c.spawnEnemy('boss',key,undefined,0));
  ok('стартовое здоровье всех боссов равно четырём базовым запасам',
    bosses.every(e=>e.maxHp===Math.round(e.t.hp*4) && e.hp===e.maxHp),
    bosses.map(e=>e.bossId+':'+e.maxHp).join(', ')); }

{ const c = loadGame('./index.html'); c.newGame('bow','keys');
  const T=c.__api.ETYPES, e=c.spawnEnemy(), boss=c.spawnEnemy('boss','lich');
  ok('скорости рядовых фиксированы, Лич использует 80.7',
    T.runner.spd===170 && T.blob.spd===120 && T.shooter.spd===75 && T.tank.spd===65 &&
    e.spd===e.t.spd && Math.abs(boss.spd-80.7)<1e-9,
    e.t.nm+' '+e.spd.toFixed(1)+' · босс '+boss.spd.toFixed(1)); }
