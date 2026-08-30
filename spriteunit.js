/* Четырёхкадровые PNG-враги: листы, кадры, движение и горизонтальный разворот. */
const fs = require('fs');
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(52) + (det||''));
const html=fs.readFileSync('./PolyGrind.html','utf8');
const embeddedPng = key => {
  const match=html.match(new RegExp(key+"\\s*[:=]\\s*'data:image/png;base64,([^']+)'"));
  return match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
};
const embeddedObjectPng = (objectName,key) => {
  const object=(html.match(new RegExp('const '+objectName+' = \\{([\\s\\S]*?)\\n\\};'))||[])[1]||'';
  const match=object.match(new RegExp('^\\s*'+key+":'data:image/png;base64,([^']+)'",'m'));
  return match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
};
const pngInfo = b => {
  if (b.length < 26) return {png:false,w:0,h:0,color:-1};
  return {png:b.subarray(0,8).toString('hex')==='89504e470d0a1a0a', w:b.readUInt32BE(16), h:b.readUInt32BE(20), color:b[25]};
};

const spr=pngInfo(embeddedPng('runner')), core=pngInfo(embeddedPng('blob')),
      bastion=pngInfo(embeddedPng('tank')), shooter=pngInfo(embeddedPng('shooter'));
ok('четыре листа встроены как индексированные PNG 40/48 px на кадр',
  spr.png && spr.w===160 && spr.h===40 && spr.color===3 && core.png && core.w===160 && core.h===40 && core.color===3 &&
  bastion.png && bastion.w===192 && bastion.h===48 && bastion.color===3 &&
  shooter.png && shooter.w===160 && shooter.h===40 && shooter.color===3);
const shooterShotBytes=embeddedPng('SHOOTER_PROJECTILE_DATA'), shooterShot=pngInfo(shooterShotBytes);
ok('снаряд Призмы упакован в индексированный лист 32×8 меньше 400 байт',
  shooterShot.png && shooterShot.w===32 && shooterShot.h===8 && shooterShot.color===3 && shooterShotBytes.length<400,
  shooterShotBytes.length+' байт');
const arrowBytes=embeddedPng('archerProjectile'), arrow=pngInfo(arrowBytes);
const mageShotBytes=embeddedPng('mageProjectile'), mageShot=pngInfo(mageShotBytes);
ok('стрела и сфера игрока — индексированные PNG в бюджете 12 px',
  arrow.png && arrow.w===12 && arrow.h===6 && arrow.color===3 && arrowBytes.length<250 &&
  mageShot.png && mageShot.w===32 && mageShot.h===8 && mageShot.color===3 && mageShotBytes.length<400,
  arrowBytes.length+' / '+mageShotBytes.length+' байт');
const minionKeys=['skeleton','hunter','warlock','golemB','golemN'];
const minionBytes=minionKeys.map(key=>embeddedObjectPng('MINION_SPRITE_DATA',key));
const minionPng=minionBytes.map(pngInfo);
ok('пять листов свиты встроены как индексированные четырёхкадровые PNG',
  minionPng.every(info=>info.png && info.color===3) &&
  JSON.stringify(minionPng.map(info=>[info.w,info.h]))===JSON.stringify([[96,24],[96,24],[96,24],[96,24],[72,18]]));
ok('вся текстура свиты укладывается в 6 КБ',
  minionBytes.reduce((sum,data)=>sum+data.length,0)<6000,
  minionBytes.reduce((sum,data)=>sum+data.length,0)+' байт');

const lootKeys=['pickupXp','pickupGold','fire','cold','shock','poison','bleed','xp','monster'];
const lootBytes=lootKeys.map(embeddedPng), lootPng=lootBytes.map(pngInfo);
ok('опыт, золото и семь книг встроены как индексированные PNG-листы по четыре кадра',
  lootPng.every(info=>info.png && info.color===3) &&
  JSON.stringify(lootPng.map(info=>[info.w,info.h]))===
    JSON.stringify([[64,16],[64,16],[96,24],[96,24],[96,24],[96,24],[96,24],[96,24],[96,24]]));
ok('все девять листов добычи вместе укладываются в 10 КБ',
  lootBytes.reduce((sum,data)=>sum+data.length,0)<10000,
  lootBytes.reduce((sum,data)=>sum+data.length,0)+' байт');

const mageEffectKeys=['normal','remote','mini','residual','elemental','heart'];
const mageEffectBytes=mageEffectKeys.map(embeddedPng), mageEffectPng=mageEffectBytes.map(pngInfo);
ok('шесть эффектов Мага встроены как индексированные PNG-листы по 64 px',
  mageEffectPng.every(info=>info.png && info.color===3 && info.h===64) &&
  JSON.stringify(mageEffectPng.map(info=>[info.w,info.h]))===
    JSON.stringify([[384,64],[384,64],[384,64],[256,64],[512,64],[256,64]]));
ok('все шесть эффектов Мага вместе укладываются в 18 КБ',
  mageEffectBytes.reduce((sum,data)=>sum+data.length,0)<18000,
  mageEffectBytes.reduce((sum,data)=>sum+data.length,0)+' байт');
const statusIconBytes=embeddedPng('ENEMY_STATUS_ICON_DATA'), statusIconPng=pngInfo(statusIconBytes);
ok('семь элементальных индикаторов встроены одним индексированным листом 112×16',
  statusIconPng.png && statusIconPng.w===112 && statusIconPng.h===16 && statusIconPng.color===3 &&
  statusIconBytes.length<1000, statusIconBytes.length+' байт');
const portalBytes=embeddedPng('FLOOR_PORTAL_SPRITE_DATA'), portalPng=pngInfo(portalBytes);
ok('портал этажа встроен индексированным листом 8×64 без изменения кадров',
  portalPng.png && portalPng.w===512 && portalPng.h===64 && portalPng.color===3 &&
  portalBytes.length<10000, portalBytes.length+' байт');

const groundPoolKeys=['tar','ogreAcid','bossAcid','boilingBlood','lavaTrail','frostTrail','venomAcid','tyrantFire'];
const groundPoolObject=(html.match(/const GROUND_POOL_SPRITE_DATA = \{([\s\S]*?)\n\};/)||[])[1]||'';
const groundPoolBytes=groundPoolKeys.map(key => {
  const match=groundPoolObject.match(new RegExp('^\\s*'+key+":'data:image/png;base64,([^']+)'",'m'));
  return match ? Buffer.from(match[1],'base64') : Buffer.alloc(0);
});
const groundPoolPng=groundPoolBytes.map(pngInfo);
ok('восемь луж и следов встроены индексированными четырёхкадровыми PNG',
  groundPoolPng.every(info=>info.png && info.color===3) &&
  JSON.stringify(groundPoolPng.map(info=>[info.w,info.h]))===
    JSON.stringify([[128,32],[128,32],[256,64],[128,32],[128,32],[128,32],[128,32],[128,32]]));
ok('листы наземных эффектов различаются и вместе укладываются в 18 КБ',
  new Set(groundPoolBytes.map(data=>data.toString('base64'))).size===groundPoolKeys.length &&
  groundPoolBytes.reduce((sum,data)=>sum+data.length,0)<18000,
  groundPoolBytes.reduce((sum,data)=>sum+data.length,0)+' байт');

const c=loadGame('./PolyGrind.html');
c.newGame('bow','keys','hunter');
const poolG=c.__api.G;
poolG.time=0; const poolFrame0=groundPoolKeys.map(key=>c.groundPoolSpriteFrame(key).index);
poolG.time=0.48; const poolFrameLater=groundPoolKeys.map(key=>c.groundPoolSpriteFrame(key).index);
ok('лужи используют общий G.time и заданный независимый темп кадров',
  poolFrame0.every(index=>index===0) && poolFrameLater.join(',')==='2,2,1,2,3,2,2,3' &&
  c.groundPoolSpriteFrame('bossAcid').meta.frameW===64 && c.groundPoolSpriteFrame('__missing__')===null);
ok('рендер масштабирует спрайты по механическому радиусу и сохраняет телеграф/слои следа',
  groundPoolKeys.every(key=>new RegExp("drawGroundPoolSprite\\('"+key+"'").test(html)) &&
  /const diameter=o\.r\*2;[\s\S]*?imageSmoothingEnabled=false/.test(html) &&
  /if \(arming\) continue;[\s\S]{0,180}drawGroundPoolSprite\('tar'/.test(html) &&
  html.indexOf("drawGroundPoolSprite('lavaTrail'")<html.indexOf("drawGroundPoolSprite('frostTrail'") &&
  /frostTrail',tr,TRAIL_LIFE,tr\.fire\?0\.46:0\.62/.test(html));
const rareItemKeys=['mirror','golem','fang','storm','ash','ice','plague','clock','shard','candle','doll','chalice','crown','bmask','bossShard','bone'];
const newAmuletIconKeys=['calm','runner','pulse','predator','fullplate','lastplate','steel','swift','survive'];
const newGloveIconKeys=['claws','thunder','ricochet','brute','riposte','critmass','critchain','shove'];
const newBootIconKeys=['lava','frost','momentum','marathon','panic','sprint'];
const newRingIconKeys=['exec','duel','reaper','siege','headsman','critaim','vacuum','looter','arrow'];
const newRelicIconKeys=['trinity','overload','breath','gravity','warskel','goldbag','xpbag'];
const commonItemIconKeys=['copperChronometer','knottedCharm','tallyGloves','smithThumbstall','draftGloves','satinGloves',
  'hobnailedSoles','shortCircuitBoots','trailfinders','boneSpurs','firstTraceRing','closeHarvestRing'];
const rareItemSetIconKeys=['sealHunt','mothFang','cometEye','sealPack','eclipseBrushes','sparkstepBoots','marchingGreaves',
  'secondWindRing','coolingAshRing','confinementRing','reactionRing','conductorRing','ledgerDebts','glassBell'];
const epicItemIconKeys=['emptyThroneSeal','surgeonsHand','betweenWorldsBoots','unhealedWoundRing','deadGodClock'];
const legendaryItemIconKeys=['heartSecond','titansHands','stepBeyond','marchDead','zeroDistanceRing','invertedCrown','archivist'];
const supportedRareItemKeys=rareItemKeys.concat(newAmuletIconKeys,newGloveIconKeys,newBootIconKeys,newRingIconKeys,newRelicIconKeys,
  commonItemIconKeys,rareItemSetIconKeys,epicItemIconKeys,legendaryItemIconKeys);
const rareItemObject=(html.match(/const RARE_ITEM_SPRITE_DATA = \{([\s\S]*?)\n\};/)||[])[1]||'';
const embeddedRareItemPng = key => {
  const match=rareItemObject.match(new RegExp('^\\s*'+key+":'data:image/png;base64,([^']+)'",'m'));
  return match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
};
const rareItemBytes=supportedRareItemKeys.map(embeddedRareItemPng), rareItemPng=rareItemBytes.map(pngInfo);
ok('93 предмета и элемента экипировки встроены как индексированные PNG 24×24',
  rareItemPng.every(info=>info.png && info.w===24 && info.h===24 && info.color===3));
ok('все 93 иконки различаются и вместе укладываются в 33 КБ',
  new Set(rareItemBytes.map(data=>data.toString('base64'))).size===supportedRareItemKeys.length &&
  rareItemBytes.reduce((sum,data)=>sum+data.length,0)<33000,
  rareItemBytes.reduce((sum,data)=>sum+data.length,0)+' байт');
ok('вся экипировка берёт общий PNG на земле и во всех элементах интерфейса',
  supportedRareItemKeys.every(key=>c.rareItemSpriteHTML(key,'hud').includes('rare-item-icon hud') &&
    c.rareItemSpriteHTML(key,'hud').includes(rareItemBytes[supportedRareItemKeys.indexOf(key)].toString('base64'))) &&
  Object.keys(c.__api.AMULETS).every(key=>supportedRareItemKeys.includes(key)) &&
  c.rareItemSpriteHTML('__missing__','hud')==='');
const totemTypes=['fire','freeze','poison','blood','lightning'];
const totemObject=(html.match(/const TOTEM_SPRITE_DATA = \{([\s\S]*?)\n\};/)||[])[1]||'';
const totemBytes=totemTypes.flatMap(key => {
  const row=(totemObject.match(new RegExp('^\\s*'+key+":\\[([^\\]]+)\\]",'m'))||[])[1]||'';
  return [...row.matchAll(/'data:image\/png;base64,([^']+)'/g)].map(match=>Buffer.from(match[1],'base64'));
});
const totemPng=totemBytes.map(pngInfo);
ok('пять тотемов по четыре ранга встроены как индексированные PNG 24×24',
  totemBytes.length===20 && totemPng.every(info=>info.png && info.w===24 && info.h===24 && info.color===3));
ok('все 20 рангов различаются, укладываются в 10 КБ и используются в UI',
  new Set(totemBytes.map(data=>data.toString('base64'))).size===20 &&
  totemBytes.reduce((sum,data)=>sum+data.length,0)<10000 &&
  totemTypes.every(key=>[1,2,3,4].every(tier=>c.totemSpriteHTML(key,tier,'hud').includes('totem-icon hud'))) &&
  c.totemSpriteEntry('fire',0).rank===1 && c.totemSpriteEntry('fire',9).rank===4 &&
  /function drawTotemSprite[\s\S]*?totemTier\(o\.totem\)\+1[\s\S]*?imageSmoothingEnabled=false/.test(html),
  totemBytes.reduce((sum,data)=>sum+data.length,0)+' байт');
ok('эффекты Мага используют полные циклы 6/4/8 кадров',
  ['normal','remote','mini'].every(key=>[0,.2,.4,.6,.8,.999].map(p=>c.mageAbilitySpriteFrame(key,p).index).join(',')==='0,1,2,3,4,5') &&
  ['residual','heart'].every(key=>[0,.25,.5,.999].map(p=>c.mageAbilitySpriteFrame(key,p).index).join(',')==='0,1,2,3') &&
  [0,.125,.25,.375,.5,.625,.75,.999].map(p=>c.mageAbilitySpriteFrame('elemental',p).index).join(',')==='0,1,2,3,4,5,6,7');
const frames=[0,1,2,3,0].map(animT => c.enemySpriteFrame({typeKey:'runner',animT}).index);
ok('Бегун циклически использует все четыре кадра', JSON.stringify(frames)==='[0,1,2,3,0]');
const runnerMeta=c.enemySpriteFrame({typeKey:'runner',animT:0}).meta;
ok('Бегун выводится высотой 40 px и листает кадры реже',
  Math.abs(c.__api.ETYPES.runner.r*runnerMeta.scale-40)<1e-6 && runnerMeta.stride===24);
ok('Ядро имеет четыре отдельных прямоугольника листа',
  [0,1,2,3].every(i => c.enemySpriteFrame({typeKey:'blob',animT:i}).frame.w===40));
ok('Бастион и Призма получили по четыре отдельных кадра',
  [0,1,2,3].every(i => c.enemySpriteFrame({typeKey:'tank',animT:i}).frame.w===48 &&
    c.enemySpriteFrame({typeKey:'shooter',animT:i}).frame.w===40));
ok('все виды свиты циклически используют четыре кадра',
  minionKeys.every(kind=>[0,1,2,3,4].map(animT=>c.minionSpriteFrame({kind,animT}).index).join(',')==='0,1,2,3,0'));
ok('экранные размеры свиты отделены от механических радиусов',
  c.minionSpriteFrame({kind:'skeleton',animT:0}).meta.drawW===24 &&
  c.minionSpriteFrame({kind:'golemB',animT:0}).meta.drawW===24 &&
  c.minionSpriteFrame({kind:'golemN',animT:0}).meta.drawW===18);
const blank={hit:1,kind:'elite',dots:{fire:{dps:0,n:0},poison:{dps:0,n:0},bleed:{dps:0,n:0}},
  plague:null,ail:{chill:0,shock:0,freeze:0},frost:false,pack:{col:'#ff00ff'},rage:9};
ok('попадание, элита, ярость и пачка больше не создают меток над врагом',
  c.enemyStatusIcons(blank).length===0 && !/function enemySpriteMarks/.test(html) && !/function drawEnemySpriteMarks/.test(html));
const marked={...blank,dots:{fire:{dps:4,n:2},poison:{dps:3,n:3},bleed:{dps:2,n:4}},
  plague:{dps:1},ail:{chill:1,shock:1,freeze:1},frost:true};
const statuses=c.enemyStatusIcons(marked);
ok('индикаторы врага содержат только семь элементальных состояний в стабильном порядке',
  statuses.map(status=>status.key).join(',')==='burning,poison,plague,chilled,frozen,shocked,bleeding' &&
  statuses.map(status=>status.frame.index).join(',')==='0,1,2,3,4,5,6' &&
  statuses.map(status=>status.stacks).join(',')==='2,3,0,0,0,0,4');
ok('портал проигрывает бесшовный цикл 8 кадров по 100 мс с нижней привязкой',
  [0,.1,.2,.3,.4,.5,.6,.7,.8].map(t=>c.floorPortalSpriteFrame({t}).index).join(',')===
    '0,1,2,3,4,5,6,7,0' &&
  c.floorPortalSpriteFrame({t:0}).meta.anchorX===0.5 &&
  c.floorPortalSpriteFrame({t:0}).meta.anchorY===1 &&
  /function drawFloorPortalSprite[\s\S]*?imageSmoothingEnabled=false[\s\S]*?drawImage\(FLOOR_PORTAL_SPRITE/.test(html));
ok('круговой прицел PNG-врага заменён стрелками',
  c.enemyTargetMarkerKind({typeKey:'blob',animT:0})==='chevron' && c.enemyTargetMarkerKind({typeKey:'tank',animT:0})==='chevron' &&
  c.enemyTargetMarkerKind({typeKey:'shooter',animT:0})==='chevron');

c.newGame('bow','keys','hunter');
const G=c.__api.G, p=G.player, e=c.spawnEnemy();
const lootFrames=[];
for (const t of [0,.125,.25,.375,.5]){ G.time=t; lootFrames.push(c.lootSpriteFrame({book:'shock'}).index); }
const bookModal=loadGame('./PolyGrind.html'); bookModal.newGame('wand','keys'); bookModal.takeBook('cold');
const bookModalHtml=bookModal.document.getElementById('ov').innerHTML;
ok('добыча и окно первой книги используют общий четырёхкадровый лист',
  lootFrames.join(',')==='0,1,2,3,0' &&
  c.lootSpriteFrame({v:1}).key==='pickupXp' && c.lootSpriteFrame({gold:true,v:1}).key==='pickupGold' &&
  c.lootSpriteFrame({book:'fire'}).meta.drawW===24 && c.lootSpriteFrame({amu:'ash'})===null &&
  bookModalHtml.includes('loot-item-icon modal') && bookModalHtml.includes('data:image/png;base64') &&
  !bookModalHtml.includes(bookModal.__api.BOOKS.cold.ico));

let lootAudio;
class FakeAudioParam {
  constructor(){ this.events=[]; }
  setValueAtTime(value,time){ this.events.push(['set',value,time]); }
  exponentialRampToValueAtTime(value,time){ this.events.push(['ramp',value,time]); }
}
class FakeOscillator {
  constructor(){ this.type='sine'; this.frequency=new FakeAudioParam(); }
  connect(node){ return node; }
  start(time){ this.started=time; }
  stop(time){ this.stopped=time; }
}
class FakeGain {
  constructor(){ this.gain=new FakeAudioParam(); }
  connect(node){ return node; }
}
class FakeAudioContext {
  constructor(){ this.currentTime=10; this.state='running'; this.destination={}; this.oscillators=[]; this.gains=[]; this.filters=[]; lootAudio=this; }
  resume(){ this.state='running'; }
  createOscillator(){ const node=new FakeOscillator(); this.oscillators.push(node); return node; }
  createGain(){ const node=new FakeGain(); this.gains.push(node); return node; }
  createBiquadFilter(){ const node=new FakeGain(); node.type='lowpass'; node.frequency=new FakeAudioParam(); this.filters.push(node); return node; }
}
const soundGame=loadGame('./PolyGrind.html',{random:()=>0});
soundGame.window.AudioContext=FakeAudioContext; soundGame.unlockSound(); soundGame.newGame('bow','keys');
const soundG=soundGame.__api.G, soundAt={x:12,y:34};
const itemKey=Object.keys(soundGame.__api.AMULETS)[0];
soundGame.dropItem(soundAt,{pool:[itemKey],tot:[]},{itemShare:1,totemShare:0});
ok('звук находки сохраняет частоты, типы и громкость исходного синтеза',
  lootAudio.oscillators.length===3 &&
  lootAudio.oscillators.map(o=>o.frequency.events[0][1]).join(',')==='659.25,1046.5,2093' &&
  lootAudio.oscillators.map(o=>o.type).join(',')==='sine,sine,triangle' &&
  lootAudio.gains.map(g=>g.gain.events[0][1]).join(',')==='0.04,0.04,0.05');
soundGame.dropItem(soundAt,{pool:[],tot:['fire']},{itemShare:0,totemShare:1});
ok('две одновременные находки дают один сигнал без сложения громкости',
  soundG.orbs.length===2 && soundG.orbs[0].amu===itemKey && soundG.orbs[1].totem==='fire' && lootAudio.oscillators.length===3);
lootAudio.currentTime+=0.41;
soundGame.dropItem(soundAt,{pool:[],tot:[]},{itemShare:0,totemShare:0});
lootAudio.currentTime+=0.41;
soundGame.dropItem(soundAt,{pool:[],tot:['fire']},{itemShare:0,totemShare:1});
ok('экипировка, книга и тотем проходят через общий звук выпадения',
  soundG.orbs.some(o=>o.amu) && soundG.orbs.some(o=>o.book) && soundG.orbs.some(o=>o.totem) && lootAudio.oscillators.length===9);
lootAudio.currentTime+=0.41;
const hitOscBefore=lootAudio.oscillators.length, hitGainBefore=lootAudio.gains.length;
soundGame.playHitSound();
const hitOsc=lootAudio.oscillators.at(-1), hitGain=lootAudio.gains.at(-1), hitFilter=lootAudio.filters.at(-1);
ok('звук удара сохраняет осциллятор, фильтр и огибающую исходного HTML',
  lootAudio.oscillators.length===hitOscBefore+1 && lootAudio.gains.length===hitGainBefore+1 &&
  hitOsc.type==='triangle' && hitOsc.frequency.events.map(x=>x[1]).join(',')==='420,110' &&
  hitFilter.type==='lowpass' && hitFilter.frequency.events[0][1]===1200 &&
  hitGain.gain.events.map(x=>x[1]).join(',')==='0.04,0.0001' && Math.abs(hitOsc.stopped-hitOsc.started-0.025)<1e-9);
soundGame.playHitSound();
ok('одновременные попадания не складывают громкость hit marker', lootAudio.oscillators.length===hitOscBefore+1);
lootAudio.currentTime+=0.03;
const hitEnemy=soundGame.spawnEnemy(); hitEnemy.hp=hitEnemy.maxHp=100; hitEnemy.armor=0; hitEnemy.ward=null; hitEnemy.bulwark=0;
const dealt=soundGame.applyDamage(hitEnemy,10,false,false);
ok('фактический урон запускает звук и одноразовую вспышку PNG-врага',
  dealt===10 && hitEnemy.hit===0.12 && lootAudio.oscillators.length===hitOscBefore+2 &&
  /if \(e\.hit > 0\)[\s\S]*?ctx\.filter='brightness\(0\) saturate\(100%\) invert\(100%\)'/.test(html));
ok('Escape-меню содержит общий ползунок 0–100 и кнопку отключения звуков',
  /id="pauseov"[\s\S]*?НАСТРОЙКИ[\s\S]*?id="sfxvolume"[^>]*min="0"[^>]*max="100"[^>]*value="50"[\s\S]*?id="sfxmute"/.test(html));
ok('громкость эффектов по умолчанию равна 50 процентам',
  soundGame.__api.SFX_SETTINGS.volume===50 && !soundGame.__api.SFX_SETTINGS.muted && soundGame.__api.SFX_SETTINGS.audible);
const soundSaved=new Map(), soundStorage={
  getItem:key=>soundSaved.has(key)?soundSaved.get(key):null,
  setItem:(key,value)=>soundSaved.set(key,String(value)),
};
const settingsGame=loadGame('./PolyGrind.html',{random:()=>0,localStorage:soundStorage});
let settingsAudio;
class SettingsAudioContext extends FakeAudioContext { constructor(){ super(); settingsAudio=this; } }
settingsGame.window.AudioContext=SettingsAudioContext; settingsGame.unlockSound(); settingsGame.newGame('bow','keys');
settingsGame.setSfxVolume(80);
ok('ползунок меняет общую громкость и сохраняет выбранное значение',
  settingsGame.__api.SFX_SETTINGS.volume===80 && soundSaved.get('polygrind_sfx_volume')==='80' &&
  soundSaved.get('polygrind_sfx_muted')==='off');
settingsGame.toggleSfxMute();
const mutedOscillators=settingsAudio.oscillators.length;
settingsGame.playHitSound(); settingsGame.levelUpSfx();
ok('кнопка отключения глушит каждый синтезированный игровой эффект',
  settingsGame.__api.SFX_SETTINGS.muted && !settingsGame.__api.SFX_SETTINGS.audible &&
  soundSaved.get('polygrind_sfx_muted')==='on' && settingsAudio.oscillators.length===mutedOscillators);
const restoredSettings=loadGame('./PolyGrind.html',{random:()=>0,localStorage:soundStorage});
ok('громкость и выключение звуков восстанавливаются после перезапуска',
  restoredSettings.__api.SFX_SETTINGS.volume===80 && restoredSettings.__api.SFX_SETTINGS.muted &&
  !restoredSettings.__api.SFX_SETTINGS.audible);
restoredSettings.startScreen();
ok('на главном экране есть отдельная кнопка НАСТРОЙКИ',
  restoredSettings.document.getElementById('ov').innerHTML.includes('id="settingsb"') &&
  restoredSettings.document.getElementById('ov').innerHTML.includes('НАСТРОЙКИ'));
restoredSettings.menuSettingsScreen();
const mainSettingsHtml=restoredSettings.document.getElementById('ov').innerHTML;
ok('кнопка открывает те же сохранённые настройки звука в главном меню',
  mainSettingsHtml.includes('id="menusfxvolume"') && mainSettingsHtml.includes('id="menusfxmute"') &&
  restoredSettings.document.getElementById('menusfxvolume').value==='80');
ok('настройки главного меню используют общие обработчики и возвращают на главный экран',
  /\$\('#menusfxvolume'\)\.oninput=event=>setSfxVolume\(event\.target\.value\)/.test(html) &&
  /\$\('#menusfxmute'\)\.onclick=toggleSfxMute/.test(html) &&
  /\$\('#settingsback'\)\.onclick=\(\)=>runConfirmedMenuAction\(startScreen\)/.test(html));
const escapeGame=loadGame('./PolyGrind.html',{random:()=>0});
escapeGame.newGame('bow','keys');
escapeGame.handleGameKeyDown({key:'Escape',code:'Escape',repeat:false,preventDefault(){}});
ok('Escape открывает настройки и автоповтор клавиши не переключает паузу',
  escapeGame.__api.G.paused && /if \(\(k === 'p' \|\| k === 'escape'\) && !e\.repeat\)/.test(html));
G.time=0; const projectileFrames=[];
for (const t of [0,0.1,0.2,0.3]){ G.time=t; projectileFrames.push(c.enemyProjectileSpriteFrame({shotType:'shooter'}).index); }
ok('текстура снаряда циклически использует четыре кадра без своего таймера',
  JSON.stringify(projectileFrames)==='[0,1,2,3]' && c.enemyProjectileSpriteFrame({shotType:'spear'}).w===64 &&
  c.enemyProjectileSpriteFrame({shotType:'axe',spin:0}).w===56 &&
  c.enemyProjectileSpriteFrame({shotType:'minotaurSpear'}).w===64 &&
  c.enemyProjectileSpriteFrame({shotType:'eliteFireball'})===null);
G.time=0; const mageFrames=[];
for (const t of [0,0.1,0.2,0.3]){ G.time=t; mageFrames.push(c.playerProjectileSpriteFrame({spriteType:'mage'}).index); }
ok('сфера Мага использует общий четырёхкадровый цикл, стрела статична',
  JSON.stringify(mageFrames)==='[0,1,2,3]' && c.playerProjectileSpriteFrame({spriteType:'arrow'}).index===0 &&
  c.playerProjectileSpriteFrame({spriteType:'reflected'})===null);

const playerShotType = key => {
  const game=loadGame('./PolyGrind.html'); game.newGame(key,'keys');
  const state=game.__api.G, target=game.spawnEnemy(); state.enemies=[target]; state.pending=0; state.spawnQueue=0;
  state.player.x=0; state.player.y=0; target.x=100; target.y=0; target.spd=0; game.attack();
  return state.shots[0] && state.shots[0].spriteType;
};
ok('штатные атаки Лучника и Мага получают свои sprite-маркеры',
  playerShotType('bow')==='arrow' && playerShotType('wand')==='mage');
const minionGame=loadGame('./PolyGrind.html'); minionGame.newGame('bow','keys');
minionGame.minionShot({x:0,y:0},{x:100,y:0},false);
minionGame.minionShot({x:0,y:0},{x:100,y:0},true);
ok('охотник и колдун свиты используют те же канонические текстуры',
  minionGame.__api.G.shots[0].spriteType==='arrow' && minionGame.__api.G.shots[1].spriteType==='mage');
const mageFx=loadGame('./PolyGrind.html'); mageFx.newGame('wand','keys');
const MFG=mageFx.__api.G, MFD=mageFx.__api.D;
MFG.enemies=[]; MFG.fx=[];
mageFx.explodePlayerOrb({x:10,y:20,orb:true,travel:0,hitSet:[]});
const normalFx=MFG.fx.find(f=>f.t==='mageOrbExplosion');
MFD.remoteBlast=10;
mageFx.explodePlayerOrb({x:30,y:40,orb:true,travel:999,hitSet:[]});
const remoteFx=MFG.fx.filter(f=>f.t==='mageOrbExplosion').at(-1);
MFD.blastHeart=10; MFD.elementalExplosion=true;
mageFx.explodePlayerOrb({x:50,y:60,orb:true,miniOrb:true,travel:0,hitSet:[]});
const miniFx=MFG.fx.filter(f=>f.t==='mageOrbExplosion').at(-1);
ok('все взрывы Мага маршрутизируются в свои листы и рисуются на 50% прозрачнее',
  normalFx && normalFx.variant==='normal' && !normalFx.heart && !normalFx.elemental &&
  remoteFx && remoteFx.variant==='remote' &&
  miniFx && miniFx.variant==='mini' && miniFx.heart && miniFx.elemental &&
  !MFG.fx.some(f=>f.t==='ring') &&
  /const MAGE_EXPLOSION_ALPHA = 0\.5/.test(html) &&
  /ctx\.globalAlpha=alpha\*MAGE_EXPLOSION_ALPHA/.test(html) &&
  /ctx\.save\(\); ctx\.globalAlpha=MAGE_EXPLOSION_ALPHA/.test(html) &&
  /col:'#8f7dff',alpha:MAGE_EXPLOSION_ALPHA/.test(html));
const prism=c.spawnEnemy('shooter'); G.enemies=[prism]; G.spawnQueue=1; G.eshots.length=0;
p.x=0; p.y=0; prism.x=250; prism.y=0; prism.cd=0; prism.spd=0; prism.aff=[]; prism.kb={x:0,y:0};
c.update(0.01); G.pending=0;
ok('штатный выстрел Призмы помечается для нового sprite renderer',
  G.eshots.length===1 && G.eshots[0].shotType==='shooter');
G.enemies=[e]; G.spawnQueue=0; e.t=c.__api.ETYPES.runner; e.typeKey='runner'; e.spd=170; e.kb={x:0,y:0};
p.x=0; p.y=0; e.x=-100; e.y=0; e.spriteFace=-1;
const before=e.animT; c.update(0.1); G.pending=0;
ok('движение вправо листает кадры и поворачивает вправо', e.animT>before && e.spriteFace===1);

e.x=100; e.y=0; e.spriteFace=1; c.update(0.1); G.pending=0;
ok('движение влево только зеркалит спрайт', e.spriteFace===-1);

e.x=0; e.y=100; e.spriteFace=-1; e.ail.stun=0; c.update(0.1); G.pending=0;
const verticalFace=e.spriteFace; e.ail.stun=1; const stopped=e.animT; c.update(0.1); G.pending=0;
ok('вертикальный ход не кувыркает, оглушение стопорит цикл', verticalFace===-1 && Math.abs(e.animT-stopped)<1e-9);
