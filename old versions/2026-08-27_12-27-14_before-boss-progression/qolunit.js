/* Постоянный QoL-сбор, журналы смерти и ускорение после боссов. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(46) + (det || ''));

{ const c = loadGame('./PolyGrind.html');
  c.__api.STORE.data.shop.vacuum = 10;
  c.newGame('bow', 'keys');
  const D = c.__api.D;
  ok('быстрый сбор: максимум даёт ×3 радиус', D.lootPickup === D.pickup * 3,
     D.pickup + ' → ' + D.lootPickup);
  ok('быстрый сбор: максимум даёт ×3 скорость', D.lootPull === 1020, '340 → ' + D.lootPull); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow', 'keys');
  const G = c.__api.G, boss = c.spawnEnemy('boss');
  c.killEnemy(boss, G.enemies.indexOf(boss));
  const e = c.spawnEnemy(), kind = e.kind === 'boss' ? 1.15 : e.kind === 'elite' ? 0.9 : 1;
  ok('победа над боссом: следующие враги +2% скорости', G.bossKills === 1 &&
     Math.abs(e.spd / (e.t.spd * kind) - 1.265 * 1.155 * 1.02) < 0.0001,
     'множитель ' + (e.spd / (e.t.spd * kind)).toFixed(4)); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow', 'keys');
  c.hurt(1e6, false, false, 'ТЕСТОВЫЙ ИСТОЧНИК');
  ok('смерть хранит источник и полученный урон', c.__api.G.over &&
     c.__api.G.player.deathLog.cause === 'ТЕСТОВЫЙ ИСТОЧНИК' && c.__api.G.player.deathLog.dmg > 0); }
