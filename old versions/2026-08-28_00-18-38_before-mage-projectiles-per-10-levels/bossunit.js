/* Восемь уникальных боссов: встроенные листы, редкость, умения и награды. */
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

const sheets=['lich','goat','plague','greed','executioner','tyrant','grave','behemoth'].map(k => embeddedPng(k));
ok('восемь листов боссов встроены в единственный HTML', sheets.every(b => b.length>0));
ok('листы оптимизированы до 512×192 и индексированной палитры',
  sheets.every(b => {const p=pngInfo(b); return p.w===512 && p.h===192 && p.color===3;}));
ok('все восемь листов вместе весят меньше 165 КБ', sheets.reduce((s,b)=>s+b.length,0)<165000,
  sheets.reduce((s,b)=>s+b.length,0)+' байт');

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const ids=['lich','goat','plague','greed','executioner','tyrant','grave','behemoth'];
  const bosses=ids.map(id=>c.spawnEnemy('boss',id));
  ok('каждый идентификатор создаёт собственного босса', bosses.every((b,i)=>b.bossId===ids[i] && c.bossType(b)));
  ok('у каждого из восьми боссов четыре кадра отдельного листа', bosses.every(b =>
    [0,1,2,3].every(animT => c.enemySpriteFrame({...b,animT}).frame.w===128)));
  const tank={kind:'norm',typeKey:'tank',animT:0,r:c.__api.ETYPES.tank.r};
  const bossHeight=bosses[0].r*c.enemySpriteFrame(bosses[0]).meta.scale;
  const tankHeight=tank.r*c.enemySpriteFrame(tank).meta.scale;
  ok('модель босса примерно в 1.5–1.7 раза выше Бастиона', bossHeight/tankHeight>=1.5 && bossHeight/tankHeight<=1.7,
    '×'+(bossHeight/tankHeight).toFixed(2)); }

{ const common=loadGame('./PolyGrind.html',{random:()=>0});
  const greedRoll=loadGame('./PolyGrind.html',{random:()=>0.475});
  const tyrantRoll=loadGame('./PolyGrind.html',{random:()=>0.675});
  common.newGame('bow','keys'); greedRoll.newGame('bow','keys'); tyrantRoll.newGame('bow','keys');
  ok('в начале шкалы выбирается обычный Изумрудный Лич', common.rollBossType()==='lich');
  ok('Greed Boss занимает собственный редкий сектор', greedRoll.rollBossType()==='greed');
  ok('Horned Tyrant занимает второй редкий сектор', tyrantRoll.rollBossType()==='tyrant');
  ok('два босса на этаже выбираются без повторения',
    tyrantRoll.rollBossType(['lich','goat','plague','greed','executioner','tyrant','grave'])==='behemoth'); }

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

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, D=c.__api.D, p=G.player, e=c.spawnEnemy('boss','executioner');
  G.enemies=[e]; G.eshots.length=0; G.spawnQueue=1; G.spawnT=999;
  e.aff=[]; e.spd=0; e.x=0; e.y=0; p.x=180; p.y=0; p.hp=D.life;
  c.tickBossSkill(e,2.99); const early=G.eshots.length; c.tickBossSkill(e,0.02);
  const axe=G.eshots[0];
  ok('King of Execution бросает топор раз в 3 секунды', early===0 && axe && axe.shotType==='axe');
  ok('топор запоминает точку броска, радиус 30 и урон 35% max HP',
    axe.targetX===180 && axe.targetY===0 && axe.r===30 && axe.maxHpPct===0.35);
  c.update(0.5);
  ok('касание топора наносит 35% и замедляет на 1.5 секунды',
    Math.abs(p.hp-D.life*0.65)<0.001 && p.bossSlowT===1.5,
    p.hp.toFixed(1)+' HP, '+p.bossSlowT.toFixed(1)+' сек');
  G.keys.d=true; const px=p.x; c.update(0.1);
  ok('замедление Палача снижает скорость движения на 70%',
    Math.abs((p.x-px)-D.mspd*0.30*0.1)<0.01, (p.x-px).toFixed(2)+' за 0.1 сек');
  G.keys.d=false; p.x=500; c.update(0.6);
  ok('вращающийся топор возвращается к владельцу и исчезает', !G.eshots.includes(axe)); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, D=c.__api.D, p=G.player, e=c.spawnEnemy('boss','tyrant');
  G.enemies=[e]; G.spawnQueue=1; G.spawnT=999; e.aff=[]; e.spd=0; e.x=0; e.y=0; p.x=100; p.y=0; p.hp=D.life;
  ok('Horned Tyrant помечен редким боссом', c.bossType(e).rare===true);
  c.tickBossSkill(e,0.34);
  ok('Тиран оставляет за собой ограниченный огненный след',
    G.bossTrails.length===1 && G.bossTrails[0].life===3.4);
  e.bossT.slash=0; c.tickBossSkill(e,0.01);
  ok('взмах в конусе наносит 10% max HP и поджигает на 3 секунды',
    Math.abs(p.hp-D.life*0.90)<0.001 && p.bossBurnT===3);
  G.enemies.length=0; G.spawnT=999; G.bossTrails.length=0; c.update(1);
  ok('горение Тирана тикает на 5% max HP каждую секунду',
    Math.abs(p.hp-D.life*0.85)<0.001, p.hp.toFixed(1)+'/'+D.life.toFixed(1));
  G.orbs.length=0; c.killEnemy(e,-1);
  const finds=G.orbs.filter(o=>o.book||o.amu||o.totem);
  ok('Horned Tyrant гарантированно оставляет ровно одну находку', finds.length===1, finds.length+' находка'); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, e=c.spawnEnemy('boss','grave');
  G.enemies=[e]; e.x=0; e.y=0; c.tickBossSkill(e,1);
  const core=G.enemies.find(x=>x.summonedByGrave);
  ok('Grave King призывает Core каждую секунду', !!core && core.typeKey==='blob');
  ok('призванный Core остаётся обычным монстром текущего этажа',
    core && core.kind==='norm' && core.xp>0 && !core.noLoot);
  ok('Core выходит непосредственно из модели Grave King',
    core && Math.hypot(core.x-e.x,core.y-e.y)<=e.r+core.r+11); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, p=G.player, e=c.spawnEnemy('boss','behemoth');
  G.enemies=[e]; e.aff=[]; e.x=-300; e.y=0; p.x=120; p.y=40;
  c.tickBossSkill(e,2.19); const early=!!e.bossT.jumpWarn; c.tickBossSkill(e,0.02);
  ok('Бегемот начинает предупреждение в трёхсекундном цикле', !early && e.bossT.jumpWarn>0);
  const tx=e.bossT.jumpX, ty=e.bossT.jumpY; p.x=500; p.y=500;
  c.tickBossSkill(e,0.45);
  ok('прыжок использует позицию игрока, зафиксированную в начале', e.bossT.jumpT>0 && tx===120 && ty===40);
  c.tickBossSkill(e,0.35);
  ok('Бегемот завершает прыжок в отмеченной точке', Math.abs(e.x-tx)<0.01 && Math.abs(e.y-ty)<0.01); }

console.log(JSON.stringify({n,fail}));
process.exitCode=fail?1:0;
