/* Spawn Menu: K, каталоги существ и находок, близкая позиция и изоляция progression. */
const fs = require('fs');
const {loadGame} = require('./harness');
let n=0, fail=0;
function ok(name, yes, got=''){
  n++; if(!yes) fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ') + name.padEnd(64) + got);
}
const html=fs.readFileSync('./GrimGrind.html','utf8');

ok('интерфейс содержит компактный Spawn Menu и три раздела',
  html.includes('<h1>Spawn Menu</h1>') && html.includes('ОБЫЧНЫЕ ВРАГИ') &&
  html.includes('ЭЛИТА / ОСОБЫЕ') && html.includes('БОССЫ'));
ok('все каталожные категории Spawn Menu изначально свёрнуты',
  /function spawnMenuSection[\s\S]*?aria-expanded="false"[\s\S]*?<div class="spawngrid" hidden>/.test(html));
ok('заголовок категории одним кликом переключает aria-expanded и содержимое',
  /querySelectorAll\('#spawnpanel \.spawnsectiontoggle'\)[\s\S]*?toggle\.setAttribute\('aria-expanded',String\(!expanded\)\)[\s\S]*?grid\.hidden=expanded/.test(html));
ok('интерфейс содержит обе случайные кнопки и безопасную очистку',
  html.includes('Spawn Random Enemy') && html.includes('Spawn Random Boss') && html.includes('Clear Enemies'));
ok('меню не обновляется из update() и строится только при открытии',
  !/function update\(dt\)[\s\S]*?function [^(]+\([^)]*\)\s*\{/.exec(html)?.[0].includes('renderSpawnMenu') &&
  (html.match(/renderSpawnMenu\(\)/g)||[]).length===2);
ok('Spawn Menu строит отдельную строку для каждой разновидности элиты',
  /Object\.keys\(ELITE_VARIANTS\).*data-spawn-elite/.test(html));
ok('кнопки отдельных элит подключены к debugSpawnEliteVariant',
  /querySelectorAll\('\[data-spawn-elite\]'\)/.test(html) && /debugSpawnEliteVariant\(el\.dataset\.spawnElite\)/.test(html));
ok('Spawn Menu строит каталожные разделы предметов, книг и тотемов',
  html.includes("AMU_KEYS.map(k => spawnMenuRow(k, AMULETS[k].nm, 'data-spawn-item'))") &&
  html.includes("BOOK_KEYS.map(k => spawnMenuRow(k, BOOKS[k].nm, 'data-spawn-book'))") &&
  /TOTEM_KEYS\.map\([\s\S]*?data-spawn-totem/.test(html) && html.includes('ТОТЕМЫ · СЛЕДУЮЩИЙ РАНГ'));
ok('кнопки находок подключены к отдельным безопасным debug-spawn функциям',
  /querySelectorAll\('\[data-spawn-item\]'\)/.test(html) && /debugSpawnItem\(key\)/.test(html) &&
  /querySelectorAll\('\[data-spawn-book\]'\)/.test(html) && /debugSpawnBook\(key\)/.test(html) &&
  /querySelectorAll\('\[data-spawn-totem\]'\)/.test(html) && /debugSpawnTotem\(key\)/.test(html));

{ const c=loadGame('./GrimGrind.html'); c.newGame('bow','keys');
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

{ const c=loadGame('./GrimGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, keys=Object.keys(c.__api.ETYPES), made=[];
  for (const key of keys){
    const e=c.debugSpawnEnemy(key); made.push(e);
    ok('обычный враг '+key+' создаётся своим каноническим типом', e && e.typeKey===key && e.kind==='norm');
  }
  ok('все обычные враги появляются в 100–250 px и внутри арены', made.every(e => {
    const d=Math.hypot(e.x-G.player.x,e.y-G.player.y);
    return d>=100 && d<=250 && Math.abs(e.x)<=1500-e.r && Math.abs(e.y)<=1500-e.r;
  })); }

{ const c=loadGame('./GrimGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, ids=['frostWolf','toxicRunner','cursedRogue','skeletonWarrior','blightGrunt','boneGargoyle',
    'fallenPyromancer','beholderSlave','skeletonCrossbow','forgottenGuard','abyssalExecutioner','plagueOgre'];
  const expected={frostWolf:'runner',toxicRunner:'runner',cursedRogue:'runner',skeletonWarrior:'blob',blightGrunt:'blob',boneGargoyle:'blob',
    fallenPyromancer:'shooter',beholderSlave:'shooter',skeletonCrossbow:'shooter',forgottenGuard:'tank',abyssalExecutioner:'tank',plagueOgre:'tank'};
  const made=[];
  for (const id of ids){
    const e=c.debugSpawnEliteVariant(id); made.push(e);
    ok('отдельная элита '+id+' создаётся точной разновидностью',e&&e.kind==='elite'&&e.eliteVariant===id&&e.typeKey===expected[id]&&!e.pack);
  }
  ok('все отдельные элиты появляются в 100–250 px и внутри арены',made.every(e=>{
    const d=Math.hypot(e.x-G.player.x,e.y-G.player.y);
    return d>=100&&d<=250&&Math.abs(e.x)<=1500-e.r&&Math.abs(e.y)<=1500-e.r;
  }));
  ok('неизвестный id отдельной элиты безопасно отклоняется',c.debugSpawnEliteVariant('missingElite')===null); }

{ const c=loadGame('./GrimGrind.html'); c.newGame('bow','keys');
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

{ const c=loadGame('./GrimGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G; G.floor=1;
  const pk=c.debugSpawnElitePack();
  ok('элита создаётся штатной spawnPack с участниками и аффиксом', pk && G.packs.includes(pk) &&
    pk.members.length===4 && pk.aff.length===1 && pk.members.every(e=>e.kind==='elite' && e.pack===pk));
  ok('вся элитная пачка расположена рядом, но не внутри игрока', pk.members.every(e=>{
    const d=Math.hypot(e.x-G.player.x,e.y-G.player.y); return d>=100 && d<=250;
  })); }

{ const c=loadGame('./GrimGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, itemKeys=Object.keys(c.__api.AMULETS), bookKeys=Object.keys(c.__api.BOOKS);
  const totemKeys=['fire','freeze','poison','blood','lightning'];
  const before={floor:G.floor,queue:G.spawnQueue,timer:G.spawnT,portal:G.portal,amu:Object.keys(G.amu).length,
    books:Object.keys(G.items).length,totems:Object.keys(G.totems).length};
  const items=itemKeys.map(k=>c.debugSpawnItem(k));
  const books=bookKeys.map(k=>c.debugSpawnBook(k));
  const totems=totemKeys.map(k=>c.debugSpawnTotem(k));
  const made=items.concat(books,totems);
  ok('все 93 каталожных предмета можно положить на землю через K',
    itemKeys.length===93&&items.every((o,i)=>o&&o.amu===itemKeys[i]));
  ok('все семь книг можно положить на землю через K',
    bookKeys.length===7&&books.every((o,i)=>o&&o.book===bookKeys[i]));
  ok('все пять типов тотемов можно положить на землю через K',
    totems.every((o,i)=>o&&o.totem===totemKeys[i]));
  ok('каждый debug-spawn находки добавляет ровно один канонический ground orb',
    made.length===105&&made.every(o=>G.orbs.includes(o)&&o.r===9));
  ok('все находки возникают на расстоянии 56–100 единиц от персонажа',made.every(o=>{
    const d=Math.hypot(o.x-G.player.x,o.y-G.player.y); return d>=56&&d<=100;
  }));
  ok('все debug-находки остаются внутри арены',
    made.every(o=>Math.abs(o.x)<=1500-18&&Math.abs(o.y)<=1500-18));
  ok('создание находок не выдаёт их в инвентарь до фактического подбора',
    Object.keys(G.amu).length===before.amu&&Object.keys(G.items).length===before.books&&Object.keys(G.totems).length===before.totems);
  ok('создание находок не меняет wave progression',
    G.floor===before.floor&&G.spawnQueue===before.queue&&G.spawnT===before.timer&&G.portal===before.portal);
  const count=G.orbs.length;
  ok('неизвестные ключи находок безопасно отклоняются',
    c.debugSpawnItem('missing')===null&&c.debugSpawnBook('missing')===null&&c.debugSpawnTotem('missing')===null&&G.orbs.length===count); }

{ const c=loadGame('./GrimGrind.html',{random:()=>0.125}); c.newGame('bow','keys');
  const G=c.__api.G; G.player.x=1480; G.player.y=1480;
  const o=c.debugSpawnItem(Object.keys(c.__api.AMULETS)[0]), d=Math.hypot(o.x-G.player.x,o.y-G.player.y);
  ok('у края арены находка остаётся внутри радиуса 100 и границ мира',
    d>=56&&d<=100&&Math.abs(o.x)<=1500-18&&Math.abs(o.y)<=1500-18); }

{ const c=loadGame('./GrimGrind.html',{random:()=>0.999}); c.newGame('bow','keys');
  const G=c.__api.G, before={floor:G.floor, queue:G.spawnQueue, timer:G.spawnT, portal:G.portal};
  const normal=c.debugSpawnRandomEnemy(), boss=c.debugSpawnRandomBoss(), pack=c.debugSpawnElitePack();
  ok('Random Enemy и Random Boss выбирают существующие каталожные типы',
    normal && c.__api.ETYPES[normal.typeKey] && boss && c.bossType(boss));
  ok('обычный, boss и elite debug-spawn не меняют wave progression',
    G.floor===before.floor && G.spawnQueue===before.queue && G.spawnT===before.timer && G.portal===before.portal && pack); }

{ const c=loadGame('./GrimGrind.html'); c.newGame('bow','keys');
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
