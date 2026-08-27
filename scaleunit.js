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
  const kind = e.kind === 'boss' ? 1.9 : e.kind === 'elite' ? 1.3 : 1;
  ok('урон врага растёт на 14% за этаж', Math.abs(e.dmg - e.t.dmg * kind * 1.14) < 0.0001,
     e.t.dmg.toFixed(2) + ' → ' + e.dmg.toFixed(2)); }

{ const e = enemy(1);
  const kind = e.kind === 'boss' ? 1.15 : e.kind === 'elite' ? 0.9 : 1;
  ok('все враги ускорены ещё на 5%', Math.abs(e.spd - e.t.spd * 1.265 * 1.155 * kind) < 0.0001,
     e.t.spd.toFixed(0) + ' → ' + e.spd.toFixed(1)); }
