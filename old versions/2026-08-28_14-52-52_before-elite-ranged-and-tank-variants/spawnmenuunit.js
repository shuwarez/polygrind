/* Spawn Menu: K, полный каталог существ, близкая позиция и изоляция progression. */
const fs = require('fs');
const {loadGame} = require('./harness');
let n=0, fail=0;
function ok(name, yes, got=''){
  n++; if(!yes) fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ') + name.padEnd(64) + got);
}
const html=fs.readFileSync('./PolyGrind.html','utf8');

ok('интерфейс содержит компактный Spawn Menu и три раздела',
  html.includes('<h1>Spawn Menu</h1>') && html.includes('ОБЫЧНЫЕ ВРАГИ') &&
  html.includes('ЭЛИТА / ОСОБЫЕ') && html.includes('БОССЫ'));
ok('интерфейс содержит обе случайные кнопки и безопасную очистку',
  html.includes('Spawn Random Enemy') && html.includes('Spawn Random Boss') && html.includes('Clear Enemies'));
ok('меню не обновляется из update() и строится только при открытии',
  !/function update\(dt\)[\s\S]*?function [^(]+\([^)]*\)\s*\{/.exec(html)?.[0].includes('renderSpawnMenu') &&
  (html.match(/renderSpawnMenu\(\)/g)||[]).length===2);

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G;
  ok('физическая K работает при русской раскладке', c.inputKey({code:'KeyK',key:'л'})==='k');
  ok('старая физическая L по-прежнему распознаётся', c.inputKey({code:'KeyL',key:'д'})==='l');
  c.openSpawnMenu();
  ok('openSpawnMenu открывает отдельный флаг и ставит игру на паузу', G.spawnOpen && G.paused);
  c.closeSpawnMenu();
  ok('closeSpawnMenu закрывает окно и продолжает шедшую игру', !G.spawnOpen && !G.paused);
  G.paused=true; c.openSpawnMenu(); c.closeSpawnMenu();
  ok('закрытие Spawn Menu восстанавливает уже включённую паузу', G.paused);
  ok('старое меню L и его отдельные open/close handlers сохранены',
    html.includes("if (k === 'l' && !e.repeat)") && html.includes('function openTestPanel()') &&
    html.includes('function closeTestPanel()')); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, keys=Object.keys(c.__api.ETYPES), made=[];
  for (const key of keys){
    const e=c.debugSpawnEnemy(key); made.push(e);
    ok('обычный враг '+key+' создаётся своим каноническим типом', e && e.typeKey===key && e.kind==='norm');
  }
  ok('все обычные враги появляются в 100–250 px и внутри арены', made.every(e => {
    const d=Math.hypot(e.x-G.player.x,e.y-G.player.y);
    return d>=100 && d<=250 && Math.abs(e.x)<=1500-e.r && Math.abs(e.y)<=1500-e.r;
  })); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, ids=['lich','goat','plague','greed','executioner','tyrant','grave','behemoth',
    'vampire','voidwrath','minotaur','seraph','matriarch','demonqueen'], made=[];
  for (const id of ids){
    const e=c.debugSpawnBoss(id); made.push(e);
    ok('босс '+id+' создаётся с правильным bossId', e && e.kind==='boss' && e.bossId===id && c.bossType(e));
  }
  ok('каждый debug-босс получает штатные HP, атаку, AI-state и аффиксы', made.every(e =>
    e.hp===e.maxHp && e.maxHp>0 && e.dmg>0 && e.spd>0 && e.bossT && Array.isArray(e.aff) && e.aff.length>0));
  ok('все боссы появляются в 100–250 px и не выходят за арену', made.every(e => {
    const d=Math.hypot(e.x-G.player.x,e.y-G.player.y);
    return d>=100 && d<=250 && Math.abs(e.x)<=1500-e.r && Math.abs(e.y)<=1500-e.r;
  })); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G; G.floor=1;
  const pk=c.debugSpawnElitePack();
  ok('элита создаётся штатной spawnPack с участниками и аффиксом', pk && G.packs.includes(pk) &&
    pk.members.length===4 && pk.aff.length===1 && pk.members.every(e=>e.kind==='elite' && e.pack===pk));
  ok('вся элитная пачка расположена рядом, но не внутри игрока', pk.members.every(e=>{
    const d=Math.hypot(e.x-G.player.x,e.y-G.player.y); return d>=100 && d<=250;
  })); }

{ const c=loadGame('./PolyGrind.html',{random:()=>0.999}); c.newGame('bow','keys');
  const G=c.__api.G, before={floor:G.floor, queue:G.spawnQueue, timer:G.spawnT, portal:G.portal};
  const normal=c.debugSpawnRandomEnemy(), boss=c.debugSpawnRandomBoss(), pack=c.debugSpawnElitePack();
  ok('Random Enemy и Random Boss выбирают существующие каталожные типы',
    normal && c.__api.ETYPES[normal.typeKey] && boss && c.bossType(boss));
  ok('обычный, boss и elite debug-spawn не меняют wave progression',
    G.floor===before.floor && G.spawnQueue===before.queue && G.spawnT===before.timer && G.portal===before.portal && pack); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G; G.spawnQueue=3; G.spawnT=7;
  c.debugSpawnBoss('plague'); G.eshots.push({}); G.pools.push({}); G.bossPools.push({}); G.bossTrails.push({});
  const cleared=c.debugClearEnemies();
  ok('Clear Enemies очищает существ и угрозы, сохраняя очередь/таймер', cleared &&
    !G.enemies.length && !G.eshots.length && !G.pools.length && !G.bossPools.length && !G.bossTrails.length &&
    G.spawnQueue===3 && G.spawnT===7);
  const e=c.debugSpawnEnemy('blob'); G.spawnQueue=0; G.portal=null;
  const refused=c.debugClearEnemies();
  ok('Clear Enemies отказывается открывать портал и менять progression', !refused && G.enemies.includes(e) && G.portal===null); }

console.log(JSON.stringify({n,fail}));
process.exitCode=fail?1:0;
