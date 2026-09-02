/* Четырёхкадровые PNG-враги: листы, кадры, движение и горизонтальный разворот. */
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const {loadGame} = require('./sim');
const {imageInfo}=require('./asset_test_utils');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(52) + (det||''));
const html=require('./harness').loadInspectionSource('./index.html');
const embeddedPng = key => {
  const match=html.match(new RegExp(key+"\\s*[:=]\\s*'data:image/(?:png|webp);base64,([^']+)'"));
  return match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
};
const embeddedObjectPng = (objectName,key) => {
  const object=(html.match(new RegExp('const '+objectName+' = \\{([\\s\\S]*?)\\n\\};'))||[])[1]||'';
  const match=object.match(new RegExp('^\\s*'+key+":'data:image/(?:png|webp);base64,([^']+)'",'m'));
  return match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
};
const embeddedAudioList = (objectName,key) => {
  const object=(html.match(new RegExp('const '+objectName+' = \\{([\\s\\S]*?)\\n\\};'))||[])[1]||'';
  const list=(object.match(new RegExp('\\b'+key+':\\[([\\s\\S]*?)\\n  \\]'))||[])[1]||'';
  return [...list.matchAll(/data:audio\/ogg;base64,([^']+)/g)].map(m=>Buffer.from(m[1],'base64'));
};
const pngInfo = b => {
  const info=imageInfo(b);if(!info.format)return{png:false,w:0,h:0,color:-1};
  return {...info,png:true,color:info.format==='png'?info.color:(info.alpha&&info.w===128&&info.h===128?6:3)};
};
const pngRgbaStats = b => {
  const info=pngInfo(b);
  if(info.format==='webp')return{valid:info.lossless&&info.alpha,colors:32,binaryAlpha:true};
  if (!info.png || b[24]!==8 || b[25]!==6 || b[28]!==0) return {valid:false,colors:0,binaryAlpha:false};
  const chunks=[];
  for (let p=8;p+12<=b.length;){
    const length=b.readUInt32BE(p), type=b.subarray(p+4,p+8).toString('ascii');
    if (type==='IDAT') chunks.push(b.subarray(p+8,p+8+length));
    p+=length+12;
  }
  const raw=zlib.inflateSync(Buffer.concat(chunks)), stride=info.w*4, previous=Buffer.alloc(stride);
  const colors=new Set(), alpha=new Set(); let offset=0;
  const paeth=(a,b2,c2)=>{ const p=a+b2-c2, pa=Math.abs(p-a), pb=Math.abs(p-b2), pc=Math.abs(p-c2); return pa<=pb&&pa<=pc?a:pb<=pc?b2:c2; };
  for (let y=0;y<info.h;y++){
    const filter=raw[offset++], source=raw.subarray(offset,offset+stride), row=Buffer.alloc(stride); offset+=stride;
    for (let x=0;x<stride;x++){
      const value=source[x], left=x>=4?row[x-4]:0, up=previous[x], upperLeft=x>=4?previous[x-4]:0;
      row[x]=(value+(filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):filter===4?paeth(left,up,upperLeft):NaN))&255;
    }
    if (filter<0 || filter>4) return {valid:false,colors:0,binaryAlpha:false};
    for (let x=0;x<stride;x+=4){ colors.add(row.readUInt32BE(x)); alpha.add(row[x+3]); }
    row.copy(previous);
  }
  return {valid:offset===raw.length,colors:colors.size,binaryAlpha:[...alpha].every(v=>v===0||v===255)};
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
const minionKeys=['skeleton','bombardier','golemB','golemN'];
const minionAssetKeys=['skeleton','bombardier','golemB','golemN'];
const minionBytes=minionAssetKeys.map(key=>embeddedObjectPng('MINION_SPRITE_DATA',key));
const minionPng=minionBytes.map(pngInfo);
ok('четыре листа актуальной свиты встроены как индексированные четырёхкадровые PNG',
  minionPng.every(info=>info.png && info.color===3) &&
  JSON.stringify(minionPng.map(info=>[info.w,info.h]))===JSON.stringify([[96,24],[96,24],[96,24],[72,18]]));
ok('вся текстура свиты укладывается в 6 КБ',
  minionBytes.reduce((sum,data)=>sum+data.length,0)<6000,
  minionBytes.reduce((sum,data)=>sum+data.length,0)+' байт');

const pickupKeys=['pickupXp','pickupGold'], bookKeys=['fire','cold','shock','poison','bleed','xp','monster'];
const pickupBytes=pickupKeys.map(key=>embeddedObjectPng('LOOT_SPRITE_DATA',key));
const bookBytes=bookKeys.map(key=>embeddedObjectPng('LOOT_SPRITE_DATA',key));
const bookFloorBytes=bookKeys.map(key=>embeddedObjectPng('BOOK_FLOOR_SPRITE_DATA',key));
const pickupPng=pickupBytes.map(pngInfo), bookPng=bookBytes.map(pngInfo), bookStats=bookBytes.map(pngRgbaStats),
      bookFloorPng=bookFloorBytes.map(pngInfo);
ok('опыт и золото сохраняют компактные индексированные четырёхкадровые листы',
  pickupPng.every(info=>info.png && info.w===64 && info.h===16 && info.color===3));
ok('семь книг встроены отдельными статичными RGBA PNG 128×128',
  bookPng.every(info=>info.png && info.w===128 && info.h===128 && info.color===6) &&
  bookStats.every(info=>info.valid && info.colors<=32 && info.binaryAlpha));

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
const portalAppearBytes=embeddedPng('FLOOR_PORTAL_APPEAR_SPRITE_DATA'),portalAppearPng=pngInfo(portalAppearBytes);
ok('инфернальный портал встроен двумя 16-кадровыми листами 2048×128',
  [portalPng,portalAppearPng].every(p=>p.png&&p.w===2048&&p.h===128&&p.color===3&&p.lossless) &&
  [portalBytes,portalAppearBytes].every(b=>b.includes(Buffer.from('tRNS'))) &&
  portalBytes.length<70000 && portalAppearBytes.length<70000,
  portalBytes.length+' + '+portalAppearBytes.length+' байт');

const groundPoolKeys=['tar','ogreAcid','bossAcid','boilingBlood','lavaTrail','frostTrail','venomAcid','tyrantFire'];
const groundPoolObject=(html.match(/const GROUND_POOL_SPRITE_DATA = \{([\s\S]*?)\n\};/)||[])[1]||'';
const groundPoolBytes=groundPoolKeys.map(key => {
  const match=groundPoolObject.match(new RegExp('^\\s*'+key+":'data:image/(?:png|webp);base64,([^']+)'",'m'));
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

const c=loadGame('./index.html');
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
  const match=rareItemObject.match(new RegExp('^\\s*'+key+":'data:image/(?:png|webp);base64,([^']+)'",'m'));
  return match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
};
const rareItemBytes=supportedRareItemKeys.map(embeddedRareItemPng), rareItemPng=rareItemBytes.map(pngInfo);
const rareItemStats=rareItemBytes.map(pngRgbaStats);
const floorItemObject=(html.match(/const RARE_ITEM_FLOOR_SPRITE_DATA = \{([\s\S]*?)\n\};/)||[])[1]||'';
const embeddedFloorItemPng = key => {
  const match=floorItemObject.match(new RegExp('^\\s*'+key+":'data:image/(?:png|webp);base64,([^']+)'",'m'));
  return match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
};
const floorItemBytes=supportedRareItemKeys.map(embeddedFloorItemPng), floorItemPng=floorItemBytes.map(pngInfo);
ok('93 предмета встроены отдельными RGBA PNG 128×128 с жёстким бюджетом',
  rareItemPng.every(info=>info.png && info.w===128 && info.h===128 && info.color===6) &&
  rareItemStats.every(info=>info.valid && info.colors<=32 && info.binaryAlpha));
ok('все 93 новые иконки различаются, старые 24/64 px отсутствуют',
  new Set(rareItemBytes.map(data=>data.toString('base64'))).size===supportedRareItemKeys.length &&
  rareItemPng.every(info=>![24,64].includes(info.w) && ![24,64].includes(info.h)),
  rareItemBytes.reduce((sum,data)=>sum+data.length,0)+' байт');
ok('меню находки и все UI-элементы сохраняют канонический PNG 128×128',
  supportedRareItemKeys.every(key=>c.rareItemSpriteHTML(key,'hud').includes('rare-item-icon hud') &&
    c.rareItemSpriteHTML(key,'hud').includes(c.__api.ASSETS.rareItems[key])) &&
  Object.keys(c.__api.AMULETS).every(key=>supportedRareItemKeys.includes(key)) &&
  c.rareItemSpriteHTML('__missing__','hud')==='');
ok('для всех 93 предметов встроены отдельные уникальные наземные PNG 24×24',
  floorItemPng.every(info=>info.png&&info.w===24&&info.h===24&&info.color===3) &&
  new Set(floorItemBytes.map(data=>data.toString('base64'))).size===supportedRareItemKeys.length &&
  floorItemBytes.every((data,index)=>!data.equals(rareItemBytes[index])),
  floorItemBytes.reduce((sum,data)=>sum+data.length,0)+' байт');
ok('на полу используется только каталог 24×24, а pickup modal — исходный 128×128',
  /const sprite=o && o\.amu && RARE_ITEM_FLOOR_SPRITES\[o\.amu\]/.test(html) &&
  /ctx\.drawImage\(sprite,o\.x-12,o\.y-12,24,24\)/.test(html) &&
  /pickupRevealHTML\(rareItemSpriteHTML\(key,'modal'\), A\.col, true\)/.test(html));
const totemTypes=['fire','freeze','poison','blood','lightning'];
const totemObject=(html.match(/const TOTEM_SPRITE_DATA = \{([\s\S]*?)\n\};/)||[])[1]||'';
const totemBytes=totemTypes.flatMap(key => {
  const row=(totemObject.match(new RegExp('^\\s*'+key+":\\[([^\\]]+)\\]",'m'))||[])[1]||'';
  return [...row.matchAll(/'data:image\/(?:png|webp);base64,([^']+)'/g)].map(match=>Buffer.from(match[1],'base64'));
});
const totemPng=totemBytes.map(pngInfo);
const totemStats=totemBytes.map(pngRgbaStats);
ok('пять тотемов по четыре ранга встроены отдельными RGBA PNG 128×128',
  totemBytes.length===20 && totemPng.every(info=>info.png && info.w===128 && info.h===128 && info.color===6) &&
  totemStats.every(info=>info.valid && info.colors<=32 && info.binaryAlpha));
ok('все 20 рангов различаются и используют один источник в мире и UI',
  new Set(totemBytes.map(data=>data.toString('base64'))).size===20 &&
  totemTypes.every(key=>[1,2,3,4].every(tier=>c.totemSpriteHTML(key,tier,'hud').includes('totem-icon hud'))) &&
  c.totemSpriteEntry('fire',0).rank===1 && c.totemSpriteEntry('fire',9).rank===4 &&
  /function drawTotemSprite[\s\S]*?totemTier\(o\.totem\)\+1[\s\S]*?drawImage\(sprite,o\.x-64,o\.y-64,128,128\)/.test(html),
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
ok('портал проигрывает 16 кадров роста, затем бесшовный неподвижный цикл',
  [0,.08,.16,.24,.32,.4,.48,.56,.64,.72,.8,.88,.96,1.04,1.12,1.2].map(t=>c.floorPortalSpriteFrame({t}).index).join(',')===
    '0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15' &&
  c.floorPortalSpriteFrame({t:1.2}).sheet==='appear' && c.floorPortalSpriteFrame({t:1.28}).sheet==='loop' &&
  [1.28,1.37,2.63,2.72].map(t=>c.floorPortalSpriteFrame({t}).index).join(',')==='0,1,15,0' &&
  c.floorPortalSpriteFrame({t:0}).meta.anchorX===0.5 &&
  c.floorPortalSpriteFrame({t:0}).meta.anchorY===1 &&
  c.floorPortalSpriteFrame({t:0}).w===128 && c.floorPortalSpriteFrame({t:0}).h===128 &&
  c.floorPortalSpriteFrame({t:1.2}).x===1920 && c.floorPortalSpriteFrame({t:0}).meta.drawW===166 &&
  !c.floorPortalReady({t:1.27}) && c.floorPortalReady({t:1.28}) &&
  html.includes('x:index*meta.frameW') && html.includes('w:meta.frameW,h:meta.frameH') &&
  /function drawFloorPortalSprite[\s\S]*?frame\.sheet==='appear'[\s\S]*?imageSmoothingEnabled=false[\s\S]*?drawImage\(sprite/.test(html));
ok('круговой прицел PNG-врага заменён стрелками',
  c.enemyTargetMarkerKind({typeKey:'blob',animT:0})==='chevron' && c.enemyTargetMarkerKind({typeKey:'tank',animT:0})==='chevron' &&
  c.enemyTargetMarkerKind({typeKey:'shooter',animT:0})==='chevron');

c.newGame('bow','keys','hunter');
const G=c.__api.G, p=G.player, e=c.spawnEnemy();
const lootFrames=[];
for (const t of [0,.125,.25,.375,.5]){ G.time=t; lootFrames.push(c.lootSpriteFrame({book:'shock'}).index); }
const bookModal=loadGame('./index.html'); bookModal.newGame('wand','keys'); bookModal.takeBook('cold');
const bookModalHtml=bookModal.document.getElementById('ov').innerHTML;
ok('книги используют уникальные 24×24 PNG на полу и канонические 128×128 в UI',
  lootFrames.join(',')==='0,0,0,0,0' &&
  c.lootSpriteFrame({v:1}).key==='pickupXp' && c.lootSpriteFrame({gold:true,v:1}).key==='pickupGold' &&
  c.lootSpriteFrame({book:'fire'}).meta.drawW===128 && c.lootSpriteFrame({book:'fire'}).w===128 &&
  c.lootSpriteFrame({amu:'ash'})===null &&
  bookFloorPng.every(info=>info.png&&info.w===24&&info.h===24&&info.color===3) &&
  new Set(bookFloorBytes.map(data=>data.toString('base64'))).size===bookKeys.length &&
  bookFloorBytes.every((data,index)=>!data.equals(bookBytes[index])) &&
  bookModalHtml.includes('loot-item-icon modal') && bookModalHtml.includes(bookModal.__api.ASSETS.loot.cold) &&
  !bookModalHtml.includes(bookModal.__api.ASSETS.booksFloor.cold) &&
  !bookModalHtml.includes(bookModal.__api.BOOKS.cold.ico) &&
  /const sprite=o && o\.book && BOOK_FLOOR_SPRITES\[o\.book\]/.test(html) &&
  /function drawBookFloorSprite[\s\S]*?drawImage\(sprite,o\.x-12,o\.y-12,24,24\)/.test(html) &&
  /if \(o\.book\)\{[\s\S]{0,1800}drawBookFloorSprite\(o\)/.test(html) &&
  !/\.loot-item-icon\{[^}]*background-size/.test(html) &&
  !/fillText\((?:B|A)\.ico/.test(html) && html.includes("lootSpriteHTML(k,'hud')") &&
  html.includes("lootSpriteHTML(k,'inventory')"));
const itemModal=loadGame('./index.html'); itemModal.newGame('bow','keys'); itemModal.takeAmulet('mirror');
const itemModalHtml=itemModal.document.getElementById('ov').innerHTML;
const totemModal=loadGame('./index.html'); totemModal.newGame('wand','keys');
totemModal.__api.G.items.fire={tier:1,val:3}; totemModal.takeTotem('fire');
const totemModalHtml=totemModal.document.getElementById('ov').innerHTML;
ok('предметное окно получает ровно в пять раз больше искристых частиц',
  [bookModalHtml,totemModalHtml].every(markup=>(markup.match(/pickup-reveal__spark/g)||[]).length===14) &&
  (itemModalHtml.match(/pickup-reveal__spark/g)||[]).length===70 &&
  itemModalHtml.includes('class="pickup-reveal boosted"'));
ok('предмет увеличен в 1,5 раза и окружён пятью отдельными эффектами',
  (itemModalHtml.match(/pickup-reveal__effect/g)||[]).length===5 &&
  !bookModalHtml.includes('pickup-reveal__effect')&&!totemModalHtml.includes('pickup-reveal__effect') &&
  html.includes('@keyframes pickupIconPulse')&&html.includes('@keyframes pickupSpark')&&html.includes('@keyframes pickupEffect') &&
  /\.rare-item-icon\.modal\{width:clamp\(144px,27vh,216px\)/.test(html));

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
let hitRandom=0;
const playedMonsterHits=[];
class FakeAudio {
  constructor(src){ this.src=src; this.currentTime=0; this.volume=0; this.preload=''; }
  pause(){}
  play(){ playedMonsterHits.push(this.src); return {catch:()=>{}}; }
}
const coreHitBytes=embeddedAudioList('MONSTER_HIT_SOUND_DATA','blob');
const coreHitUris=c.__api.AUDIO_ASSETS.monsterHit.blob;
const bastionHitBytes=embeddedAudioList('MONSTER_HIT_SOUND_DATA','tank');
const bastionHitUris=c.__api.AUDIO_ASSETS.monsterHit.tank;
const prismHitBytes=embeddedAudioList('MONSTER_HIT_SOUND_DATA','shooter');
const prismHitUris=c.__api.AUDIO_ASSETS.monsterHit.shooter;
const runnerHitBytes=embeddedAudioList('MONSTER_HIT_SOUND_DATA','runner');
const runnerHitUris=c.__api.AUDIO_ASSETS.monsterHit.runner;
const deathBytes=Object.fromEntries(['blob','tank','shooter','runner'].map(key=>
  [key,embeddedAudioList('MONSTER_DEATH_SOUND_DATA',key)]));
const deathUris=c.__api.AUDIO_ASSETS.monsterDeath;
const deathHashes={
  blob:[
    '421699278a2a96484b17a10fee89c3389abe1894a21e7eae660547f50bce6ec0',
    'abe286fec84839209237dec066e661f7c70099a956922077949fb284e0250a89',
    '58f48bd0a53dc152764e70058cc684438374e67afe29352e8d08fdd7ed97a92d',
  ],
  tank:[
    '8fdd1512dbd6f0feccf9136aad65f95ce0a0fe847e73474a74bd70089953c177',
    '5c37fa3d8eb9a2f6007cc3d9ff0491d1c3d5d6380a293e13a1ae8854b6e8d5c7',
    '5a5353c94448e36e9c959383ac66e9de1a05734dc8336e7f14a8b629ee957d7d',
  ],
  shooter:[
    'd864a7b420dc2ddfa98130ba0bd6d87522d6c4dceb1a4e3e71dd1c822429799a',
    'f46aae1dc1dac30061eda6abc1c5aedd3f8ba9812b44fb1d4415780fbb18ce85',
    '18fd66c181b58820bb70789d1b546c1e288c38e7345192c6253043842805adea',
  ],
  runner:[
    'bef988b2d7bd6841009cf645e45e167dcba97954a1e7c0704ec51ea00c5a42bd',
    '9b603a481623683e9026b3d52c03cb688e72f915a54232a8a83ecb407a2a9ac7',
    '03fa60484b3da6f6060a17356dac0038d37cd5f7eb910f7c729922868c51c849',
  ],
};
const soundGame=loadGame('./index.html',{random:()=>hitRandom,Audio:FakeAudio});
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
const coreHitAssetsValid=
  coreHitBytes.length===3 && coreHitBytes.every(data=>data.subarray(0,4).toString()==='OggS' && data.length<6000) &&
  coreHitBytes.map(data=>crypto.createHash('sha256').update(data).digest('hex')).join(',')===
    'ca674316e9968568d7e5d654b3e345ad148fb854d715232fce1d0d57735f51bc,'+
    'b6c112ad757537c3d8244bafdcd3f8abe88ddcd1bf5a64cea26da68f21ceaa26,'+
    '51d42e8d3ee876ea00434124902907a29909cee860761eb116ee00337af44247';
const bastionHitAssetsValid=
  bastionHitBytes.length===3 && bastionHitBytes.every(data=>data.subarray(0,4).toString()==='OggS' && data.length<6100) &&
  bastionHitBytes.map(data=>crypto.createHash('sha256').update(data).digest('hex')).join(',')===
    '42d0419c1e8d2be375196c5e77604a5630814d1ade1fe81188cd15b8685f8af0,'+
    '6bad456ddff0a716e2b05e08e77646b32217d4d5278f94ac5f09d83204a8c1ff,'+
    'a721688b3f10d64f76449b8cd03cbf5795d7a8e96924298499663814c3d537d4';
const prismHitAssetsValid=
  prismHitBytes.length===3 && prismHitBytes.every(data=>data.subarray(0,4).toString()==='OggS' && data.length<5100) &&
  prismHitBytes.map(data=>crypto.createHash('sha256').update(data).digest('hex')).join(',')===
    '1eaa3e719f18cb7f395e490d42d91885cda05efdf1678998d8a987fd1ec70a71,'+
    '0a4db1f01d047e38ee1ce43190f3969e868a57d859510299b7f88b0f17068369,'+
    'a13a5c2e5b1be3c137afb927f8d9106d785a811ef7c5ae97678e6e81ad19c7af';
const runnerHitAssetsValid=
  runnerHitBytes.length===3 && runnerHitBytes.every(data=>data.subarray(0,4).toString()==='OggS' && data.length<5500) &&
  runnerHitBytes.map(data=>crypto.createHash('sha256').update(data).digest('hex')).join(',')===
    'adf8a3016eb3e4738852ae94912cf34c42cd58475d879677773229a3cd3256bd,'+
    '561788a5d210af84aad6fb8fc0f035728e180f620a098c9ce108d5fba9ce8d09,'+
    '314157e93177df2ac565f0a31e906e2a00844fb7b8708dd990d453dd3658394b';
const corePicksStart=playedMonsterHits.length;
hitRandom=0; soundGame.playHitSound({typeKey:'blob'}); lootAudio.currentTime+=0.03;
hitRandom=0.5; soundGame.playHitSound({typeKey:'blob'}); lootAudio.currentTime+=0.03;
hitRandom=0.999999; soundGame.playHitSound({typeKey:'blob'});
lootAudio.currentTime+=0.03;
const coreElite=soundGame.spawnEnemy('pack',null,'skeletonWarrior');
const eliteHitPlayCount=playedMonsterHits.length;
soundGame.playHitSound(coreElite);
const coreHitBankWorks=playedMonsterHits.slice(corePicksStart,corePicksStart+3).join('|')===coreHitUris.join('|') &&
  coreElite.kind==='elite' && coreElite.typeKey==='blob' && playedMonsterHits.length===eliteHitPlayCount+1;
lootAudio.currentTime+=0.03;
const bastionPicksStart=playedMonsterHits.length;
hitRandom=0; soundGame.playHitSound({typeKey:'tank'}); lootAudio.currentTime+=0.03;
hitRandom=0.5; soundGame.playHitSound({typeKey:'tank'}); lootAudio.currentTime+=0.03;
hitRandom=0.999999; soundGame.playHitSound({typeKey:'tank'});
lootAudio.currentTime+=0.03;
const bastionElite=soundGame.spawnEnemy('pack',null,'forgottenGuard');
const bastionElitePlayCount=playedMonsterHits.length;
soundGame.playHitSound(bastionElite);
const bastionHitBankWorks=playedMonsterHits.slice(bastionPicksStart,bastionPicksStart+3).join('|')===bastionHitUris.join('|') &&
  bastionElite.kind==='elite' && bastionElite.typeKey==='tank' && playedMonsterHits.length===bastionElitePlayCount+1;
lootAudio.currentTime+=0.03;
const prismPicksStart=playedMonsterHits.length;
hitRandom=0; soundGame.playHitSound({typeKey:'shooter'}); lootAudio.currentTime+=0.03;
hitRandom=0.5; soundGame.playHitSound({typeKey:'shooter'}); lootAudio.currentTime+=0.03;
hitRandom=0.999999; soundGame.playHitSound({typeKey:'shooter'});
lootAudio.currentTime+=0.03;
const prismElite=soundGame.spawnEnemy('pack',null,'fallenPyromancer');
const prismElitePlayCount=playedMonsterHits.length;
soundGame.playHitSound(prismElite);
const prismHitBankWorks=playedMonsterHits.slice(prismPicksStart,prismPicksStart+3).join('|')===prismHitUris.join('|') &&
  prismElite.kind==='elite' && prismElite.typeKey==='shooter' && playedMonsterHits.length===prismElitePlayCount+1;
lootAudio.currentTime+=0.03;
const runnerPicksStart=playedMonsterHits.length;
hitRandom=0; soundGame.playHitSound({typeKey:'runner'}); lootAudio.currentTime+=0.03;
hitRandom=0.5; soundGame.playHitSound({typeKey:'runner'}); lootAudio.currentTime+=0.03;
hitRandom=0.999999; soundGame.playHitSound({typeKey:'runner'});
lootAudio.currentTime+=0.03;
const runnerElite=soundGame.spawnEnemy('pack',null,'frostWolf');
const runnerElitePlayCount=playedMonsterHits.length;
soundGame.playHitSound(runnerElite);
ok('три OGG всех четырёх семейств встроены точно, случайны и наследуются элитой',
  coreHitAssetsValid && coreHitBankWorks && bastionHitAssetsValid &&
  bastionHitBankWorks && prismHitAssetsValid && prismHitBankWorks && runnerHitAssetsValid &&
  playedMonsterHits.slice(runnerPicksStart,runnerPicksStart+3).join('|')===runnerHitUris.join('|') &&
  runnerElite.kind==='elite' && runnerElite.typeKey==='runner' && playedMonsterHits.length===runnerElitePlayCount+1 &&
  !soundGame.playHitSound({typeKey:'missing'}));
const hitPlayCount=playedMonsterHits.length;
soundGame.playHitSound({typeKey:'blob'});
ok('одновременные попадания не складывают громкость нового банка', playedMonsterHits.length===hitPlayCount);
lootAudio.currentTime+=0.03;
const hitEnemy=soundGame.spawnEnemy('blob'); hitEnemy.hp=hitEnemy.maxHp=100; hitEnemy.armor=0; hitEnemy.ward=null; hitEnemy.bulwark=0;
const dealt=soundGame.applyDamage(hitEnemy,10,false,false);
const hitDamageSoundWorked=dealt===10 && hitEnemy.typeKey==='blob' && hitEnemy.hit===0.12 &&
  playedMonsterHits.length===hitPlayCount+1;
const deathAssetsValid=Object.entries(deathBytes).every(([key,list])=>
  list.length===3 && list.every(data=>data.subarray(0,4).toString()==='OggS' && data.length<6100) &&
  list.map(data=>crypto.createHash('sha256').update(data).digest('hex')).join(',')===deathHashes[key].join(','));
const deathElites={blob:coreElite,tank:bastionElite,shooter:prismElite,runner:runnerElite};
let deathBanksWork=true;
for (const key of ['blob','tank','shooter','runner']){
  const start=playedMonsterHits.length;
  for (const random of [0,0.5,0.999999]){
    hitRandom=random;
    soundGame.enemyDeathSfx({kind:'norm',typeKey:key});
    lootAudio.currentTime+=0.04;
  }
  const eliteStart=playedMonsterHits.length;
  soundGame.enemyDeathSfx(deathElites[key]);
  lootAudio.currentTime+=0.04;
  deathBanksWork=deathBanksWork &&
    playedMonsterHits.slice(start,start+3).join('|')===deathUris[key].join('|') &&
    playedMonsterHits.length===eliteStart+1;
}
const killedEnemy=soundGame.spawnEnemy('blob'); killedEnemy.hp=0;
const killedEnemyIndex=soundG.enemies.indexOf(killedEnemy), killSoundStart=playedMonsterHits.length;
soundGame.killEnemy(killedEnemy,killedEnemyIndex);
const actualDeathHookWorks=killedEnemy.dead && playedMonsterHits.length===killSoundStart+1;
lootAudio.currentTime+=0.04;
const bossAudioStart=playedMonsterHits.length, bossToneStart=lootAudio.oscillators.length;
soundGame.enemyDeathSfx({kind:'boss',typeKey:'tank'});
const bossSoundPreserved=playedMonsterHits.length===bossAudioStart && lootAudio.oscillators.length===bossToneStart+1;
lootAudio.currentTime+=0.04;
const unknownDeathStart=playedMonsterHits.length;
const unknownDeathSilent=!soundGame.enemyDeathSfx({kind:'norm',typeKey:'missing'}) && playedMonsterHits.length===unknownDeathStart;
ok('фактический урон и смерть запускают свои звуки и одноразовую вспышку PNG-врага',
  hitDamageSoundWorked && deathAssetsValid && deathBanksWork && actualDeathHookWorks &&
  bossSoundPreserved && unknownDeathSilent &&
  /if \(e\.hit > 0\)[\s\S]*?ctx\.filter='brightness\(0\) saturate\(100%\) invert\(100%\)'/.test(html));
ok('Escape-меню содержит общий ползунок 0–100 и кнопку отключения звуков',
  /id="pauseov"[\s\S]*?НАСТРОЙКИ[\s\S]*?id="sfxvolume"[^>]*min="0"[^>]*max="100"[^>]*value="50"[\s\S]*?id="sfxmute"/.test(html));
ok('громкость эффектов по умолчанию равна 50 процентам',
  soundGame.__api.SFX_SETTINGS.volume===50 && !soundGame.__api.SFX_SETTINGS.muted && soundGame.__api.SFX_SETTINGS.audible);
const soundSaved=new Map(), soundStorage={
  getItem:key=>soundSaved.has(key)?soundSaved.get(key):null,
  setItem:(key,value)=>soundSaved.set(key,String(value)),
};
const settingsGame=loadGame('./index.html',{random:()=>0,localStorage:soundStorage});
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
const restoredSettings=loadGame('./index.html',{random:()=>0,localStorage:soundStorage});
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
const escapeGame=loadGame('./index.html',{random:()=>0});
escapeGame.newGame('bow','keys');
escapeGame.handleGameKeyDown({key:'Escape',code:'Escape',repeat:false,preventDefault(){}});
escapeGame.handleGameKeyDown({key:'Escape',code:'Escape',repeat:true,preventDefault(){}});
ok('Escape открывает настройки и автоповтор клавиши не переключает паузу',
  escapeGame.__api.G.paused && /if \(k === 'escape' && !e\.repeat\)/.test(html));
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
  const game=loadGame('./index.html'); game.newGame(key,'keys');
  const state=game.__api.G, target=game.spawnEnemy(); state.enemies=[target]; state.pending=0; state.spawnQueue=0;
  state.player.x=0; state.player.y=0; target.x=100; target.y=0; target.spd=0; game.attack();
  return state.shots[0] && state.shots[0].spriteType;
};
ok('штатные атаки Лучника и Мага получают свои sprite-маркеры',
  playerShotType('bow')==='arrow' && playerShotType('wand')==='mage');
const minionGame=loadGame('./index.html'); minionGame.newGame('bow','keys');
minionGame.minionShot({x:0,y:0},{x:100,y:0},false);
minionGame.minionShot({x:0,y:0},{x:100,y:0},true);
ok('охотник и колдун свиты используют те же канонические текстуры',
  minionGame.__api.G.shots[0].spriteType==='arrow' && minionGame.__api.G.shots[1].spriteType==='mage');
const mageFx=loadGame('./index.html'); mageFx.newGame('wand','keys');
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
