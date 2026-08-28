/* Постоянный QoL-сбор, журналы смерти и ускорение после боссов. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(46) + (det || ''));

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, base=c.__api.D.pickup;
  ok('карточка радиуса автоподбора удалена',
    !c.__api.MODS.some(m=>m.id==='loot.pickup_radius' || m.stat==='pickup'));
  ok('карточка притягивания лута удалена',
    !c.__api.MODS.some(m=>m.id==='loot.magnet' || m.stat==='magnet'));
  G.bag.add('pickup','inc',999); c.recalc();
  ok('старый стат карточки больше не влияет на героя', c.__api.D.pickup===base,
     base+' → '+c.__api.D.pickup); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, p=G.player;
  G.enemies.length=0; G.spawnQueue=1; G.spawnT=999;
  const orb={x:p.x+500,y:p.y,v:1}; G.orbs=[orb];
  G.bag.add('magnet','flag',1); c.recalc();
  const before=orb.x; c.update(0.1); const moved=before-orb.x;
  ok('старый флаг magnet больше не ускоряет притягивание', Math.abs(moved-7.5)<0.01,
    moved.toFixed(1)+' единицы за 0,1 сек'); }

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

{ const c = loadGame('./PolyGrind.html');
  c.__api.STORE.data.shop = {dodge:40, sgold:100};
  c.newGame('bow','keys','thief');
  let G = c.__api.G; G.lvl = 25; c.recalc();
  const thiefDodge = c.__api.D.dodge, thiefMove = c.__api.D.mspd;
  ok('ВОР: уклонение только из магазина, скорость сохранена', thiefDodge === 40 &&
     Math.abs(thiefMove/235 - 1.25) < 0.001, 'уворот ' + thiefDodge + '% · бег ×' + (thiefMove/235).toFixed(2));
  ok('ВОР: +2% ко всему золоту за уровень', Math.abs(c.__api.D.goldGainMult - 1.50) < 0.001,
     'уровень 25 · множитель ×' + c.__api.D.goldGainMult.toFixed(2));
  const thiefDesc = c.__api.SUBCLASSES.bow.find(s=>s.id==='thief').desc;
  ok('ВОР: описание соответствует механике', thiefDesc.includes('+2%') &&
     thiefDesc.includes('отдельным множителем') && thiefDesc.includes('+1% скорости') &&
     thiefDesc.includes('Бонуса к уклонению нет'));
  G.floor = 10; G.enemies.length = 0; G.spawnQueue = 0; G.orbs.length = 0;
  const oldRandom = Math.random;
  try {
    Math.random = () => 0.5;
    const e = c.spawnEnemy(); e.kind = 'norm'; e.typeKey = 'blob';
    c.killEnemy(e, G.enemies.indexOf(e));
  } finally { Math.random = oldRandom; }
  const dropped = G.orbs.filter(o => o.gold).reduce((s,o) => s+o.v, 0);
  const expectedDrop = Math.round((5+G.floor*0.3) * c.__api.D.goldFind * c.__api.D.goldGainMult * 1.025);
  ok('ВОР: множитель стоит поверх золота с врагов', dropped === expectedDrop,
     dropped + ' золота · ожидалось ' + expectedDrop);
  G.orbs.length = 0; G.enemies.length = 0; G.spawnQueue = 0; G.gold = 0;
  const floor = G.floor, p = G.player;
  G.portal = {x:p.x,y:p.y,r:28,t:1}; c.update(0.01);
  const expectedFloor = Math.round((12+floor*6) * c.__api.D.goldFind * c.__api.D.goldGainMult);
  ok('ВОР: множитель усиливает награду за этаж', G.gold === expectedFloor,
     G.gold + ' золота · ожидалось ' + expectedFloor); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow', 'keys');
  const G = c.__api.G, totalAffixes = c.__api.AFFIXES.length;
  const inspect = f => {
    G.floor = f; c.buildFloor();
    const bosses = G.enemies.filter(e => e.kind === 'boss');
    return {f, bosses, text:f + ':' + bosses.length + 'x' + (bosses[0] ? bosses[0].aff.length : 0)};
  };
  const early = [3,6,9,10,13,16,19,20].map(inspect);
  ok('сетка X3/X6/X9/X0 создаёт 1/2/3/4 боссов',
     early.map(x => x.bosses.length).join(',') === '1,2,3,4,1,2,3,4',
     early.map(x => x.text).join(' · '));
  ok('аффиксы растут по десяткам, а 30-й этаж делает скачок к четырём',
     [23,26,29,30,40].map(inspect).map(x => x.text).join(',') ===
       '23:1x3,26:2x3,29:3x3,30:4x4,40:4x5');
  const end = inspect(80);
  ok('80-й этаж: четыре босса получают весь каталог', end.bosses.length === 4 &&
     end.bosses.every(b => b.aff.length === totalAffixes && new Set(b.aff.map(a => a.id)).size === totalAffixes),
     totalAffixes + ' аффиксов у каждого');
  const plateau = inspect(100);
  ok('после 80-го потолок остаётся восемь аффиксов', plateau.bosses.length === 4 &&
     plateau.bosses.every(b => b.aff.length === totalAffixes), plateau.text); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow', 'keys');
  const G = c.__api.G, boss = c.spawnEnemy('boss');
  c.killEnemy(boss, G.enemies.indexOf(boss));
  const e = c.spawnEnemy(), kind = e.kind === 'elite' ? 0.9 : 1;
  ok('победа над боссом: следующие враги +2% скорости', G.bossKills === 1 &&
     Math.abs(e.spd / (e.t.spd * kind) - 1.02) < 0.0001,
     'множитель ' + (e.spd / (e.t.spd * kind)).toFixed(4)); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow', 'keys');
  c.hurt(1e6, false, false, 'ТЕСТОВЫЙ ИСТОЧНИК');
  ok('смерть хранит источник и полученный урон', c.__api.G.over &&
     c.__api.G.player.deathLog.cause === 'ТЕСТОВЫЙ ИСТОЧНИК' && c.__api.G.player.deathLog.dmg > 0); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow', 'keys');
  const ru = [['KeyW','ц','w'],['KeyA','ф','a'],['KeyS','ы','s'],['KeyD','в','d']];
  ok('русская ЦФЫВ раскладка преобразуется в WASD',
    ru.every(([code,key,want]) => c.inputKey({code,key})===want));
  const G=c.__api.G, D=c.__api.D, p=G.player;
  G.enemies.length=0; G.spawnQueue=1; G.spawnT=999;
  G.keys={[c.inputKey({code:'KeyW',key:'ц'})]:true};
  const y=p.y; c.update(0.1);
  ok('физическая клавиша W движет вверх при русской раскладке',
    Math.abs((y-p.y)-D.mspd*0.1)<0.01, (y-p.y).toFixed(2)+' за 0.1 сек');
  ok('служебные C/V/L/P тоже не зависят от раскладки',
    c.inputKey({code:'KeyC',key:'с'})==='c' && c.inputKey({code:'KeyV',key:'м'})==='v' &&
    c.inputKey({code:'KeyL',key:'д'})==='l' && c.inputKey({code:'KeyP',key:'з'})==='p'); }
