/* Базовые кривые врагов: проверяем прямо по созданному врагу, чтобы смена
   константы не спряталась за случайным выбором типа, элитой или боссом. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(46) + (det || ''));

function enemy(floor){
  const c = loadGame('./PolyGrind.html');
  c.newGame('bow', 'keys');
  const G = c.__api.G;
  G.floor = floor;
  const e = c.spawnEnemy();
  return e;
}

{ const e = enemy(2);
  const hpKind = e.kind === 'boss' ? 14 : e.kind === 'elite' ? 3.2 : 1;
  const dmgKind = e.kind === 'boss' ? 1.9 : e.kind === 'elite' ? 1.3 : 1;
  const hpOk = e.hp === Math.round(e.t.hp * hpKind * 1.16);
  const dmgOk = Math.abs(e.dmg - e.t.dmg * dmgKind * 1.15) < 0.0001;
  ok('HP +16%, урон +15% за этаж', hpOk && dmgOk,
     'HP ' + e.t.hp.toFixed(0) + ' → ' + e.hp.toFixed(0) + ', урон ' + e.t.dmg.toFixed(2) + ' → ' + e.dmg.toFixed(2)); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const T=c.__api.ETYPES, e=c.spawnEnemy(), boss=c.spawnEnemy('boss');
  ok('итоговые скорости: Бегун 170, Ядро 120, Призма 75, Бастион 65',
    T.runner.spd===170 && T.blob.spd===120 && T.shooter.spd===75 && T.tank.spd===65 &&
    e.spd===e.t.spd && Math.abs(boss.spd-80.7)<1e-9,
    e.t.nm+' '+e.spd.toFixed(1)+' · босс '+boss.spd.toFixed(1)); }
