/* DEV_ZONE: кнопка главного меню, пустая QA-арена и изоляция meta-прогрессии. */
const fs=require('fs');
const {loadGame}=require('./harness');
let n=0,fail=0;
function ok(name,yes,got=''){n++;if(!yes)fail++;console.log((yes?'  \u2713 ':'  \u2717 ')+name.padEnd(68)+got);}
const html=fs.readFileSync('./PolyGrind.html','utf8');

ok('главное меню содержит отдельную кнопку DEV_ZONE',
  html.includes('id="devzoneb"')&&html.includes('<b>DEV_ZONE</b>')&&html.includes('ПУСТАЯ АРЕНА · K — SPAWN'));
ok('DEV_ZONE закреплена абсолютным позиционированием слева сверху',
  /\.dev-zone-entry\{position:absolute;left:16px;top:16px/.test(html));
ok('кнопка подключена к прямому входу в тестовую арену',
  /\$\('#devzoneb'\)\.onclick = startDevZone/.test(html)&&/newGame\('bow','keys',null,true\)/.test(html));

{const c=loadGame('./PolyGrind.html');c.startDevZone();const G=c.__api.G;
  ok('DEV_ZONE запускает базового Лучника с клавиатурой без стартовой раздачи',
    G.devZone&&G.weapon.id==='wpn.bow'&&G.control==='keys'&&G.pending===0&&!G.paused&&!G.over);
  ok('при входе арена полностью пуста',
    !G.enemies.length&&!G.packs.length&&!G.orbs.length&&G.spawnQueue===0&&G.spawnT===0&&G.portal===null);
  ok('обычные волны в DEV_ZONE всегда подавлены',c.regularEnemySpawnsSuppressed());
  ok('пустая DEV_ZONE никогда не считается завершённым этажом',!c.floorCombatComplete());
  c.update(1);
  ok('игровой цикл не создаёт волну или портал в пустой DEV_ZONE',
    !G.enemies.length&&G.spawnQueue===0&&G.portal===null);
  ok('физическая J распознаётся независимо от русской раскладки',c.inputKey({code:'KeyJ',key:'о'})==='j');
  const baseSpeed=c.__api.D.mspd;G.player.hp=1;
  ok('J-режим в DEV_ZONE изначально выключен',!G.devGodMode);
  ok('J включает god mode, восстанавливает HP и даёт ровно +100% скорости',
    c.toggleDevGodMode()&&G.devGodMode&&G.player.hp===c.__api.D.life&&Math.abs(c.__api.D.mspd-baseSpeed*2)<1e-9);
  const safeHp=G.player.hp;c.hurt(99999,true,true,'DEV TEST');
  ok('god mode блокирует весь входящий урон через общий hurt()',G.player.hp===safeHp);
  ok('повторный J выключает режим и возвращает исходную скорость',
    !c.toggleDevGodMode()&&!G.devGodMode&&Math.abs(c.__api.D.mspd-baseSpeed)<1e-9);
  c.openSpawnMenu();
  ok('Spawn Menu по K-логике доступно и ставит DEV_ZONE на паузу',G.spawnOpen&&G.paused);
  c.closeSpawnMenu();const e=c.debugSpawnEnemy('blob');
  ok('канонический спавнер создаёт врага внутри DEV_ZONE',e&&G.enemies.includes(e));
  ok('Clear Enemies разрешён при нулевой очереди и не открывает портал',
    c.debugClearEnemies()&&!G.enemies.length&&G.portal===null);
  G.floor=10;c.buildFloor();
  ok('повторная сборка этажа сохраняет DEV_ZONE пустой даже на boss-floor',
    !G.enemies.length&&!G.packs.length&&G.spawnQueue===0&&G.portal===null&&!c.floorCombatComplete());}

{const c=loadGame('./PolyGrind.html');const S=c.__api.STORE;
  S.data.gold=1234;S.data.best=17;S.data.graveyard=[{stamp:1}];S.data.constellations={kills:{blob:77},ranks:{}};
  c.startDevZone();const G=c.__api.G,e=c.debugSpawnEnemy('blob');c.killEnemy(e,G.enemies.indexOf(e));
  ok('убийства из спавнера не продвигают постоянные созвездия',S.data.constellations.kills.blob===77);
  G.gold=999;G.floor=80;c.gameOver(false);
  ok('смерть в DEV_ZONE не переносит тестовое золото в банк',S.data.gold===1234&&G.earned===0);
  ok('DEV_ZONE не меняет рекорд и не создаёт запись кладбища',S.data.best===17&&S.data.graveyard.length===1);}

{const c=loadGame('./PolyGrind.html');c.newGame('bow','keys');const G=c.__api.G;
  ok('обычный новый забег не получает флаг DEV_ZONE и сохраняет волны',!G.devZone&&G.spawnQueue>0);
  ok('в обычном забеге тестовый god mode нельзя включить',!c.toggleDevGodMode()&&!G.devGodMode);
  G.spawnQueue=0;G.enemies.length=0;
  ok('обычная пустая комната по-прежнему завершается штатно',c.floorCombatComplete());}

ok('HUD и подсказка явно обозначают тестовый режим',
  /G\.devZone\?'DEV':G\.floor/.test(html)&&html.includes('DEV_ZONE: K — SPAWN MENU · J — GOD +100% SPEED'));

console.log(JSON.stringify({n,fail}));process.exitCode=fail?1:0;
