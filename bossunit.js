/* Четырнадцать уникальных боссов: встроенные листы, редкость, умения и награды. */
const fs = require('fs');
const {loadGame} = require('./harness');
let n=0, fail=0;
function ok(name, yes, got=''){
  n++; if(!yes) fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ') + name.padEnd(58) + got);
}
const html=fs.readFileSync('./PolyGrind.html','utf8');
const bossSpriteBlock=html.slice(html.indexOf('const BOSS_SPRITE_DATA = {'), html.indexOf('const BOSS_SPRITE_META = {'));
const embeddedWebp = (block,key) => {
  const m=block.match(new RegExp("\\b"+key+":'data:image/webp;base64,([^']+)'"));
  return m ? Buffer.from(m[1], 'base64') : Buffer.alloc(0);
};
const isWebp=b=>b.length>12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
const constantWebp=key=>{
  const m=html.match(new RegExp(key+"\\s*=\\s*'data:image/webp;base64,([^']+)'"));
  return m?Buffer.from(m[1],'base64'):Buffer.alloc(0);
};

const bossIds=['lich','goat','plague','greed','executioner','tyrant','grave','behemoth',
  'vampire','voidwrath','minotaur','seraph','matriarch','demonqueen'];
const sheets=bossIds.map(k=>embeddedWebp(bossSpriteBlock,k));
const attackBlock=html.slice(html.indexOf('const BOSS_ATTACK_SPRITE_DATA = {'),html.indexOf('const BOSS_ATTACK_SPRITES = {};'));
const attackSheets=bossIds.map(k=>embeddedWebp(attackBlock,k+'_attack'));
ok('четырнадцать базовых lossless WebP-листов встроены в HTML',sheets.every(isWebp));
ok('четырнадцать отдельных атакующих WebP-листов встроены в HTML',attackSheets.every(isWebp));
ok('базовые и атакующие листы используют канонические кадры 64×96',
  /for \(const meta of Object\.values\(BOSS_SPRITE_META\)\)[\s\S]*?w:64,h:96/.test(html)&&
  /for \(const meta of Object\.values\(BOSS_ATTACK_SPRITE_META\)\)[\s\S]*?w:64,h:96/.test(html));
ok('все 28 листов боссов укладываются в 450 КБ',
  sheets.concat(attackSheets).reduce((sum,b)=>sum+b.length,0)<450*1024,
  sheets.concat(attackSheets).reduce((sum,b)=>sum+b.length,0)+' байт');
const projectileKeys=['PLAGUE_SLIME_PROJECTILE_DATA','EMERALD_ORB_PROJECTILE_DATA','GREED_SPEAR_PROJECTILE_DATA',
  'EXECUTIONER_AXE_PROJECTILE_DATA','MINOTAUR_SPEAR_PROJECTILE_DATA','SERAPH_HOLY_SPEAR_DATA',
  'DEMON_QUEEN_BLOB_DATA','MATRIARCH_PLAGUE_PROJECTILE_DATA','VOID_GROUND_RIFT_DATA'];
ok('девять прежних специальных эффектов сохранены как WebP',projectileKeys.every(k=>isWebp(constantWebp(k))));
const effectBlock=html.slice(html.indexOf('const LEGACY_BOSS_EFFECT_SPRITE_DATA = {'),html.indexOf('/* LEGACY_BOSS_EFFECT_ASSETS_END */'));
const effectKeys=['goat_slam','behemoth_impact','minotaur_crash','tyrant_slash','vampire_cross','summon_sigil'];
ok('шесть недостающих четырёхкадровых эффектов встроены отдельно',effectKeys.every(k=>isWebp(embeddedWebp(effectBlock,k))));

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const bosses=bossIds.map(id=>c.spawnEnemy('boss',id));
  ok('каждый идентификатор создаёт собственного босса', bosses.every((b,i)=>b.bossId===bossIds[i] && c.bossType(b)));
  ok('у каждого из четырнадцати боссов четыре кадра отдельного листа', bosses.every(b =>
    [0,1,2,3].every(animT => c.enemySpriteFrame({...b,animT}).frame.w===64)));
  const bossHeight=bosses[0].r*c.enemySpriteFrame(bosses[0]).meta.scale;
  const heroHeight=48;
  ok('модель босса не меньше чем в 2.5 раза выше героя', bossHeight/heroHeight>=2.5,
    '×'+(bossHeight/heroHeight).toFixed(2)); }

{ const common=loadGame('./PolyGrind.html',{random:()=>0}); common.newGame('bow','keys');
  ok('в начале шкалы выбирается обычный Изумрудный Лич', common.rollBossType()==='lich');
  const defs=bossIds.map(id=>common.bossType(common.spawnEnemy('boss',id)));
  ok('обычные боссы имеют стандартный вес 30', defs.filter(d=>!d.rare).every(d=>d.weight===30));
  ok('три редких босса имеют низкий вес 10', defs.filter(d=>d.rare).length===3 && defs.filter(d=>d.rare).every(d=>d.weight===10));
  ok('два босса на этаже выбираются без повторения',
    common.rollBossType(bossIds.slice(0,-1))==='demonqueen'); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, p=G.player, e=c.spawnEnemy('boss','lich'); G.eshots.length=0;
  e.x=-200; e.y=0; p.x=0; p.y=0;
  c.tickBossSkill(e,1.99); const early=G.eshots.length; c.tickBossSkill(e,0.02);
  const s=G.eshots[0];
  ok('Лич стреляет не раньше двух секунд', early===0 && G.eshots.length===1);
  ok('сфера Лича размером с игрока и несёт 15% max HP', s.r===p.r && s.maxHpPct===0.15);
  const emeraldFrames=[];
  for (const t of [0,0.1,0.2,0.3]){ G.time=t; emeraldFrames.push(c.enemyProjectileSpriteFrame(s).index); }
  ok('Изумрудная сфера проигрывает все четыре кадра общим циклом', emeraldFrames.join(',')==='0,1,2,3');
  G.enemies=[e]; G.spawnQueue=1; e.aff=[]; e.spd=0; p.hp=c.__api.D.life; p.inv=0;
  c.__api.D.dodge=c.__api.D.armor=c.__api.D.drFlat=c.__api.D.drShop=0;
  c.__api.D.normalDr=c.__api.D.majorDr=0; c.update(0.8);
  ok('попадание Изумрудной сферы замедляет на 50% ровно на секунду',
    p.bossSlowT===1 && p.bossSlowMul===0.5, p.bossSlowT.toFixed(1)+' сек · ×'+p.bossSlowMul);
  G.keys.d=true; const slowedX=p.x; c.update(0.1); G.keys.d=false;
  ok('Изумрудная сфера действительно уменьшает скорость движения вдвое',
    Math.abs((p.x-slowedX)-c.__api.D.mspd*0.5*0.1)<0.01, (p.x-slowedX).toFixed(2)+' за 0.1 сек'); }

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

{ const c=loadGame('./PolyGrind.html',{random:()=>0.99}); c.newGame('bow','keys');
  const G=c.__api.G, D=c.__api.D, p=G.player, e=c.spawnEnemy('boss','plague');
  G.enemies=[e]; G.spawnQueue=1; G.eshots.length=0; e.aff=[]; e.spd=0;
  e.x=-150; e.y=0; p.x=0; p.y=0;
  c.tickBossSkill(e,1);
  ok('Мерзость плюётся раз в секунду на 7.5% max HP', G.eshots.length===1 && G.eshots[0].maxHpPct===0.075);
  const slimeFrames=[];
  for (const t of [0,0.1,0.2,0.3]){ G.time=t; slimeFrames.push(c.enemyProjectileSpriteFrame(G.eshots[0]).index); }
  ok('сгусток проигрывает все четыре кадра общим циклом', slimeFrames.join(',')==='0,1,2,3');
  D.dodge=D.armor=D.drFlat=D.drShop=D.normalDr=D.majorDr=0; p.inv=0; p.hp=D.life;
  c.update(0.55);
  ok('попадание сгустка замедляет игрока на 50% ровно на секунду',
    p.bossSlowT===1 && p.bossSlowMul===0.5, p.bossSlowT.toFixed(1)+' сек · ×'+p.bossSlowMul);
  G.keys.d=true; const slowedX=p.x; c.update(0.1); G.keys.d=false;
  ok('сгусток действительно уменьшает скорость движения вдвое',
    Math.abs((p.x-slowedX)-D.mspd*0.5*0.1)<0.01, (p.x-slowedX).toFixed(2)+' за 0.1 сек');
  c.killEnemy(e,G.enemies.indexOf(e));
  ok('смерть Мерзости оставляет кислоту радиусом 135 на 10 сек',
    G.bossPools.length===1 && G.bossPools[0].r===135 && G.bossPools[0].life===10);
  G.enemies.length=0; G.spawnQueue=0; p.x=G.bossPools[0].x; p.y=G.bossPools[0].y; p.hp=D.life;
  D.dodge=0; D.armor=0; D.drFlat=0; D.drShop=0;
  D.normalDr=0; D.majorDr=0; p.inv=0;
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
  const spearFrames=[];
  for (const t of [0,0.1,0.2,0.3]){ G.time=t; spearFrames.push(c.enemyProjectileSpriteFrame(spear).index); }
  ok('Копьё жадности проигрывает все четыре кадра общим циклом', spearFrames.join(',')==='0,1,2,3');
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
  const axeFrames=[0,1,2,3,4,5,6,7].map(i =>
    c.enemyProjectileSpriteFrame({...axe,spin:i*Math.PI/4+1e-6}).index);
  ok('угол вращения топора выбирает все восемь фаз листа', axeFrames.join(',')==='0,1,2,3,4,5,6,7');
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

{ const c=loadGame('./PolyGrind.html',{random:()=>0.99}); c.newGame('bow','keys');
  const G=c.__api.G, D=c.__api.D, p=G.player, e=c.spawnEnemy('boss','vampire');
  D.dodge=D.armor=D.drFlat=D.drShop=D.normalDr=D.majorDr=0;
  e.x=-200; e.y=0; p.x=80; p.y=20; e.hp=e.maxHp*0.25;
  c.tickBossSkill(e,2.01);
  ok('Vampire Lord готовит крест вдвое быстрее — ровно 1 секунду', e.bossT.markWarn===1);
  const mark={x:e.bossT.markX,y:e.bossT.markY}; p.x=400; p.y=400;
  c.tickBossSkill(e,1.01);
  ok('Vampire Lord фиксирует позицию в момент Кровавой метки', mark.x===80 && mark.y===20 && e.x===80 && e.y===20);
  ok('уклонение от зафиксированной позиции не лечит Вампира', Math.abs(e.hp-e.maxHp*0.25)<0.001);
  const exactCooldown=e.bossT.markCd===2; c.tickBossSkill(e,1.99);
  const before=e.bossT.markWarn||0; c.tickBossSkill(e,0.02);
  ok('между крестами пауза 2 секунды, затем начинается новая метка',
    exactCooldown && before===0 && e.bossT.markWarn===1);
  p.x=0; p.y=0; p.hp=D.life; p.inv=0; e.x=-100; e.y=0; e.hp=e.maxHp*0.25;
  e.bossT={markWarn:0.01,markX:0,markY:0}; c.tickBossSkill(e,0.02);
  ok('крестовой рывок наносит 30% max HP', Math.abs(p.hp-D.life*0.70)<0.001);
  ok('Vampiric Bite восстанавливает 50% HP босса', Math.abs(e.hp-e.maxHp*0.75)<0.001); }

{ const c=loadGame('./PolyGrind.html',{random:()=>0.5}); c.newGame('bow','keys');
  const G=c.__api.G, D=c.__api.D, p=G.player, e=c.spawnEnemy('boss','voidwrath');
  D.dodge=D.armor=D.drFlat=D.drShop=D.normalDr=D.majorDr=0;
  p.x=0; p.y=0; p.hp=D.life; p.inv=0; e.bossT={riftCd:0}; c.tickBossSkill(e,0.01);
  ok('Void Wrath создаёт от трёх до пяти разломов', e.bossT.rifts.length>=3 && e.bossT.rifts.length<=5);
  e.bossT.rifts=[{x:0,y:0,r:52,warn:0.01},{x:200,y:0,r:52,warn:0.01},{x:-200,y:0,r:52,warn:0.01}];
  c.tickBossSkill(e,0.02);
  ok('взрыв Разлома Пустоты наносит 40% max HP только один раз', Math.abs(p.hp-D.life*0.60)<0.001);
  ok('Разлом замедляет на 60% ровно на секунду', p.bossSlowT===1 && p.bossSlowMul===0.40);
  ok('каждый разлом и его вспышка используют только четырёхкадровый PNG',
    G.fx.filter(f=>f.t==='voidRiftBurst' && f.max===0.20).length===3 &&
    /VOID_GROUND_RIFT_FRAMES\s*=\s*\[0,1,2,3\]/.test(html) &&
    !/pushTelegraphTrace\(\{shape:'rift'/.test(html) &&
    !/fillStyle='#8e45e8'/.test(html)); }

{ const c=loadGame('./PolyGrind.html',{random:()=>0.99}); c.newGame('bow','keys');
  const G=c.__api.G, e=c.spawnEnemy('boss','minotaur'); e.armor=0;
  ok('Dread Minotaur — редкий босс', c.bossType(e).rare===true);
  e.bossT={}; ok('защита Минотавра постоянно срезает 80% урона', Math.abs(c.mitigate(e,100)-20)<0.001);
  e.bossT.vulnerable=1; ok('после промаха Минотавр получает +40% входящего урона', Math.abs(c.mitigate(e,100)-140)<0.001);
  e.bossT={chargeCd:0}; c.tickBossSkill(e,0.01);
  ok('подготовка натиска ускорена вдвое до 0,45 сек', Math.abs(e.bossT.chargeWarn-0.45)<1e-9);
  e.x=0; e.y=0; e.bossT={chargeLeft:1000,chargeA:0,chargeHit:true}; c.tickBossSkill(e,0.1);
  ok('скорость натиска равна 2800 ед/с', Math.abs(e.x-280)<1e-9 && Math.abs(e.bossT.chargeLeft-720)<1e-9,
    e.x.toFixed(0)+' ед за 0,1 сек');
  e.x=0; e.y=0; G.player.x=0; G.player.y=500; e.bossT={chargeWarn:0.01,chargeA:0};
  c.tickBossSkill(e,0.02); c.tickBossSkill(e,1);
  ok('после натиска Минотавр уязвим и неподвижен 1,2 сек',
    Math.abs(e.x-(1500-e.r))<0.01 && e.bossT.vulnerable===1.2 && e.bossT.crash===1.2 && e.bossT.spearsPending===true);
  G.eshots.length=0; c.tickBossSkill(e,1.2); c.tickBossSkill(e,0.01);
  const spears=G.eshots.filter(s=>s.shotType==='minotaurSpear');
  ok('после уязвимости летят три копья по 15% max HP',
    spears.length===3 && spears.every(s=>s.maxHpPct===0.15));
  const spearFrames=[];
  for (const t of [0,0.1,0.2,0.3]){ G.time=t; spearFrames.push(c.enemyProjectileSpriteFrame(spears[0]).index); }
  ok('Копьё Минотавра проигрывает все четыре кадра общим циклом', spearFrames.join(',')==='0,1,2,3');
  c.tickBossSkill(e,1.49); const before=e.bossT.chargeWarn||0; c.tickBossSkill(e,0.02);
  ok('через 1,5 секунды после копий начинается новый натиск', before===0 && Math.abs(e.bossT.chargeWarn-0.45)<1e-9);
  G.orbs.length=0; c.killEnemy(e,G.enemies.indexOf(e));
  ok('Dread Minotaur гарантирует две случайные находки', G.orbs.filter(o=>o.book||o.amu||o.totem).length===2); }

{ const c=loadGame('./PolyGrind.html',{random:()=>0.99}); c.newGame('bow','keys');
  const G=c.__api.G, D=c.__api.D, p=G.player, e=c.spawnEnemy('boss','seraph');
  D.dodge=D.armor=D.drFlat=D.drShop=D.normalDr=D.majorDr=0;
  p.x=10; p.y=20; p.hp=D.life; p.inv=0; e.bossT={judgeCd:0}; c.tickBossSkill(e,0.01);
  ok('Fallen Seraph начинает серию из трёх отмеченных Святых Копий', e.bossT.judgeLeft===3 && e.bossT.judgeWarn>0);
  c.tickBossSkill(e,0.81);
  ok('первое Святое Копьё наносит 20% max HP', Math.abs(p.hp-D.life*0.80)<0.001);
  ok('удар создаёт четырёхкадровый эффект Святого Копья',
    G.fx.some(f=>f.t==='holySpear' && f.max===0.38) && /SERAPH_HOLY_SPEAR_FRAMES\s*=\s*\[0,1,2,3\]/.test(html));
  p.inv=0; c.tickBossSkill(e,0.81); p.inv=0; c.tickBossSkill(e,0.81);
  ok('Святое Копьё делает три удара и уходит в откат на 3 сек', e.bossT.judgeLeft===0 && e.bossT.judgeCd===3); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, e=c.spawnEnemy('boss','matriarch'); G.enemies=[e]; e.x=0; e.y=0;
  c.tickBossSkill(e,1);
  const runners=G.enemies.filter(x=>x.summonedByMatriarch);
  ok('Plague Matriarch выплёвывает двух Бегунов каждую секунду', runners.length===2 && runners.every(x=>x.typeKey==='runner'));
  ok('порождённые Бегуны не фармят опыт и предметы', runners.every(x=>x.noLoot && x.xp===0));
  ok('каждый призыв сопровождает четырёхкадровый Чумной снаряд',
    G.fx.filter(f=>f.t==='matriarchPlagueProjectile' && f.max===0.32).length===2 &&
    /MATRIARCH_PLAGUE_PROJECTILE_FRAMES\s*=\s*\[0,1,2,3\]/.test(html)); }

{ const c=loadGame('./PolyGrind.html',{random:()=>0.99}); c.newGame('bow','keys');
  const G=c.__api.G, D=c.__api.D, p=G.player, e=c.spawnEnemy('boss','demonqueen');
  D.dodge=D.armor=D.drFlat=D.drShop=D.normalDr=D.majorDr=0;
  e.x=-200; e.y=0; p.x=40; p.y=50; p.hp=D.life; e.bossT={leapCd:0}; c.tickBossSkill(e,0.01);
  ok('Demon Queen становится сгустком и фиксирует круг на секунду', e.bossT.hidden && e.bossT.leapX===40 && e.bossT.leapY===50);
  p.x=400; p.y=400; c.tickBossSkill(e,1.01);
  ok('сгусток приземляется в зафиксированную точку, а не преследует игрока', e.x===40 && e.y===50 && p.hp===D.life && !e.bossT.hidden);
  p.x=0; p.y=0; p.hp=D.life; p.inv=0; e.bossT={hidden:true,leapWarn:0.01,leapX:0,leapY:0}; c.tickBossSkill(e,0.02);
  ok('попадание Демонического сгустка наносит 35% max HP', Math.abs(p.hp-D.life*0.65)<0.001);
  ok('приземление создаёт четырёхкадровый эффект Демонического сгустка',
    G.fx.some(f=>f.t==='demonicBlob' && f.max===0.38) && /DEMON_QUEEN_BLOB_FRAMES\s*=\s*\[0,1,2,3\]/.test(html));
  ok('сгусток замедляет на 50% на 2 секунды и уходит в откат на 5', p.bossSlowT===2 && p.bossSlowMul===0.5 && e.bossT.leapCd===5); }

console.log(JSON.stringify({n,fail}));
process.exitCode=fail?1:0;
