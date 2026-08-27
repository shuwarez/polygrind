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
  const G = c.__api.G, D = c.__api.D, p = G.player, DT = 1/60;
  G.enemies.length = 0; G.spawnQueue = 0; G.keys = {d:true};
  ok('рывок: полный заряд на старте и откат 5 секунд', p.dashN === D.dashMax && D.dashCd === 5,
     p.dashN + '/' + D.dashMax + ' · ' + D.dashCd.toFixed(1) + 'с');
  const started = c.tryDash();
  ok('рывок: откат начинается при расходовании', started && p.dashN === D.dashMax-1 &&
     Math.abs(p.dashCd-5) < 0.001 && Math.abs(p.dash-0.22) < 0.001,
     'КД ' + p.dashCd.toFixed(1) + 'с');
  const x0 = p.x, y0 = p.y;
  let guard = 0; while (p.dash > 0 && guard++ < 60) c.update(DT);
  const dashDist = Math.hypot(p.x-x0,p.y-y0);
  ok('рывок: дистанция увеличена примерно вдвое', dashDist > 220 && dashDist < 260,
     dashDist.toFixed(1) + ' единиц');
  G.keys = {}; p.dash = 0; p.dashN = 0; p.dashCd = 5;
  for (let i=0;i<299;i++) c.update(DT);
  const early = p.dashN;
  for (let i=0;i<2;i++) c.update(DT);
  ok('рывок: заряд не возвращается раньше пяти секунд', early === 0 && p.dashN === 1,
     'до: ' + early + ' · после: ' + p.dashN); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow', 'keys');
  const G = c.__api.G, totalAffixes = c.__api.AFFIXES.length;
  const inspect = f => {
    G.floor = f; c.buildFloor();
    const bosses = G.enemies.filter(e => e.kind === 'boss');
    return {f, bosses, text:f + ':' + bosses.length + 'x' + (bosses[0] ? bosses[0].aff.length : 0)};
  };
  const early = [5,10,15,20,25,30].map(inspect);
  ok('боссы 5–30: 1x1, 2x1, 1x2, 2x2, 1x3, 2x3',
     early.map(x => x.text).join(',') === '5:1x1,10:2x1,15:1x2,20:2x2,25:1x3,30:2x3',
     early.map(x => x.text).join(' · '));
  const late = [35,40,45,50,55,60,65,70,75,80].map(inspect);
  ok('прогрессия продолжается парами до восьми аффиксов',
     late.map(x => x.text).join(',') === '35:1x4,40:2x4,45:1x5,50:2x5,55:1x6,60:2x6,65:1x7,70:2x7,75:1x8,80:2x8',
     late.map(x => x.text).join(' · '));
  const end = late[late.length-1];
  ok('80-й этаж: оба босса получают весь каталог', end.bosses.length === 2 &&
     end.bosses.every(b => b.aff.length === totalAffixes && new Set(b.aff.map(a => a.id)).size === totalAffixes),
     totalAffixes + ' аффиксов у каждого');
  const plateau = inspect(85);
  ok('после 80-го остаются два босса со всеми аффиксами', plateau.bosses.length === 2 &&
     plateau.bosses.every(b => b.aff.length === totalAffixes), plateau.text); }

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
