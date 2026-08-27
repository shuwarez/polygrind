/* Четыре уникальных босса: встроенные листы, редкость, умения и награды. */
const fs = require('fs');
const {loadGame} = require('./harness');
let n=0, fail=0;
function ok(name, yes, got=''){
  n++; if(!yes) fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ') + name.padEnd(58) + got);
}
const html=fs.readFileSync('./PolyGrind.html','utf8');
const embeddedPng = key => {
  const m=html.match(new RegExp(key+":'data:image/png;base64,([^']+)'"));
  return m ? Buffer.from(m[1], 'base64') : Buffer.alloc(0);
};
const pngInfo = b => b.length < 26 ? {w:0,h:0,color:-1} :
  ({w:b.readUInt32BE(16),h:b.readUInt32BE(20),color:b[25]});

const sheets=['lich','goat','plague','greed'].map(k => embeddedPng(k));
ok('четыре листа боссов встроены в единственный HTML', sheets.every(b => b.length>0));
ok('листы оптимизированы до 512×192 и индексированной палитры',
  sheets.every(b => {const p=pngInfo(b); return p.w===512 && p.h===192 && p.color===3;}));
ok('все четыре листа вместе весят меньше 100 КБ', sheets.reduce((s,b)=>s+b.length,0)<100000,
  sheets.reduce((s,b)=>s+b.length,0)+' байт');

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const ids=['lich','goat','plague','greed'];
  const bosses=ids.map(id=>c.spawnEnemy('boss',id));
  ok('каждый идентификатор создаёт собственного босса', bosses.every((b,i)=>b.bossId===ids[i] && c.bossType(b)));
  ok('у каждого босса четыре кадра отдельного листа', bosses.every(b =>
    [0,1,2,3].every(animT => c.enemySpriteFrame({...b,animT}).frame.w===128)));
  const tank={kind:'norm',typeKey:'tank',animT:0,r:c.__api.ETYPES.tank.r};
  const bossHeight=bosses[0].r*c.enemySpriteFrame(bosses[0]).meta.scale;
  const tankHeight=tank.r*c.enemySpriteFrame(tank).meta.scale;
  ok('модель босса примерно в 1.5–1.7 раза выше Бастиона', bossHeight/tankHeight>=1.5 && bossHeight/tankHeight<=1.7,
    '×'+(bossHeight/tankHeight).toFixed(2)); }

{ const common=loadGame('./PolyGrind.html',{random:()=>0});
  const rare=loadGame('./PolyGrind.html',{random:()=>0.999999});
  common.newGame('bow','keys'); rare.newGame('bow','keys');
  ok('в начале шкалы выбирается обычный Изумрудный Лич', common.rollBossType()==='lich');
  ok('верхние 10% шкалы отданы редкому Greed Boss', rare.rollBossType()==='greed');
  ok('два босса на этаже выбираются без повторения', rare.rollBossType(['greed','plague','goat'])==='lich'); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, p=G.player, e=c.spawnEnemy('boss','lich'); G.eshots.length=0;
  e.x=-200; e.y=0; p.x=0; p.y=0;
  c.tickBossSkill(e,1.99); const early=G.eshots.length; c.tickBossSkill(e,0.02);
  const s=G.eshots[0];
  ok('Лич стреляет не раньше двух секунд', early===0 && G.eshots.length===1);
  ok('сфера Лича размером с игрока и несёт 15% max HP', s.r===p.r && s.maxHpPct===0.15); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, D=c.__api.D, p=G.player, e=c.spawnEnemy('boss','goat');
  G.enemies=[e]; G.spawnQueue=0; e.aff=[]; e.x=-500; e.y=0; p.x=0; p.y=0; e.spd=1;
  const x=e.x; c.update(0.1);
  ok('Демон действительно движется со скоростью игрока', Math.abs((e.x-x)-D.mspd*0.1)<0.01,
    (e.x-x).toFixed(2)+' за 0.1 сек');
  e.x=0; e.y=0; p.x=0; p.y=0; p.hp=D.life; e.bossT={};
  c.tickBossSkill(e,3-0.75); const warned=e.bossT.slamWarn>0; c.tickBossSkill(e,0.75);
  ok('Демон предупреждает, останавливается и наносит 25% max HP', warned && Math.abs(p.hp-D.life*0.75)<0.001,
    p.hp.toFixed(1)+'/'+D.life.toFixed(1)); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, D=c.__api.D, p=G.player, e=c.spawnEnemy('boss','plague');
  G.eshots.length=0; e.x=-150; e.y=0; p.x=0; p.y=0;
  c.tickBossSkill(e,1);
  ok('Мерзость плюётся раз в секунду на 7.5% max HP', G.eshots.length===1 && G.eshots[0].maxHpPct===0.075);
  c.killEnemy(e,G.enemies.indexOf(e));
  ok('смерть Мерзости оставляет кислоту радиусом 135 на 10 сек',
    G.bossPools.length===1 && G.bossPools[0].r===135 && G.bossPools[0].life===10);
  G.enemies.length=0; G.spawnQueue=0; p.x=G.bossPools[0].x; p.y=G.bossPools[0].y; p.hp=D.life;
  c.update(1);
  ok('кислота тикает раз в секунду на 10% max HP', Math.abs(p.hp-D.life*0.9)<0.001); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, D=c.__api.D, e=c.spawnEnemy('boss','greed');
  G.enemies=[e]; G.eshots.length=0; e.x=-200; e.y=0; G.player.x=0; G.player.y=0;
  ok('Greed Boss помечен редким и имеет собственную низкую скорость', c.bossType(e).rare===true && e.spd===55);
  c.tickBossSkill(e,1);
  ok('Greed Boss создаёт Бегуна каждую секунду', G.enemies.some(x=>x.summonedByGreed && x.typeKey==='runner'));
  e.bossT.spear=0; c.tickBossSkill(e,0.01);
  const spear=G.eshots.find(s=>s.shotType==='spear');
  ok('копьё летит вдвое медленнее игрока и наносит 50% max HP', spear &&
    Math.abs(Math.hypot(spear.vx,spear.vy)-D.mspd*0.5)<0.001 && spear.maxHpPct===0.50);
  G.orbs.length=0; c.killEnemy(e,G.enemies.indexOf(e));
  const finds=G.orbs.filter(o=>o.book||o.amu||o.totem);
  ok('Greed Boss гарантированно оставляет ровно две находки', finds.length===2, finds.length+' находки'); }

console.log(JSON.stringify({n,fail}));
process.exitCode=fail?1:0;
