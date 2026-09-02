/* ---------- КРОВЬ ЭТАЖА ----------
   Быстрые брызги живут отдельным ограниченным массивом, а следы оседают на
   одном offscreen-холсте 3000×3000. Поэтому стоимость постоянной грязи не
   растёт вместе с числом ранений и убийств на длинном этаже. */
const BLOOD_CFG=Object.freeze({enabled:true,density:2,maxFx:600,maxDrawFx:320,dotCooldown:0.18,
  decalAlpha:0.78,maxStamps:1800,splashFps:18});
const BLOOD_FX_POOL_CAP=BLOOD_CFG.maxFx;
const VISUAL_CORPSE_CAP=192;
const BLOOD_SPRITE_META=Object.freeze({
  splash:{frame:64,frames:4},mist:{frame:64,frames:4},critSpray:{frame:32,frames:4},
});
const BLOOD_MATERIALS=Object.freeze({
  blood:{col:'#b80f24',filter:'none'},
  ichor:{col:'#5f345f',filter:'hue-rotate(225deg) saturate(.78) brightness(.76)'},
  bone:{col:'#a69272',filter:'grayscale(1) sepia(.48) brightness(1.18)'},
});

function bloodMaterialForEnemy(e){
  if (!e) return 'blood';
  if (e.eliteVariant==='skeletonWarrior' || e.eliteVariant==='skeletonCrossbow' ||
      e.eliteVariant==='boneGargoyle' || e.bossId==='grave') return 'bone';
  if (e.bossId==='lich' || e.bossId==='voidwrath' || e.eliteVariant==='beholderSlave') return 'ichor';
  return 'blood';
}

/* Декоративные трупы не смешиваются с G.corpses: второй массив остаётся
   временным боевым ресурсом Некроманта, а этот видят все классы до смены этажа. */
function corpseSpriteKey(c){
  if (!c) return '';
  if (c.bossId && CORPSE_SPRITE_DATA[c.bossId]) return c.bossId;
  if (c.eliteVariant && CORPSE_SPRITE_DATA[c.eliteVariant]) return c.eliteVariant;
  return c.typeKey && CORPSE_SPRITE_DATA[c.typeKey] ? c.typeKey : '';
}
function corpseRandom(){
  // Отдельный xorshift не сдвигает игровой Math.random и потому не меняет
  // дроп, урон и поведение врагов из-за чисто косметического выбора лужи.
  let x=(G && G.corpseRng)>>>0 || 0x6d2b79f5;
  x^=x<<13; x^=x>>>17; x^=x<<5;
  if (G) G.corpseRng=x>>>0;
  return (x>>>0)/4294967296;
}
/* Один косметический бросок: 50% без лужи, иначе один из шести кадров
   прежнего атласа. Игровой Math.random намеренно не затрагивается. */
function corpsePuddleVariant(){
  return corpseRandom()<0.5 ? Math.floor(corpseRandom()*6) : -1;
}
function leaveVisualCorpse(e){
  if (!G || !e) return null;
  if (!Array.isArray(G.visualCorpses)) G.visualCorpses=[];
  const corpses=G.visualCorpses;
  let c;
  if (corpses.length<VISUAL_CORPSE_CAP){
    if (!corpses.length) G.visualCorpseHead=0;
    c={}; corpses.push(c);
  } else {
    const head=(G.visualCorpseHead||0)%VISUAL_CORPSE_CAP;
    c=corpses[head]||{}; corpses[head]=c;
    G.visualCorpseHead=(head+1)%VISUAL_CORPSE_CAP;
  }
  c.x=e.x;c.y=e.y;c.typeKey=e.typeKey||'';c.eliteVariant=e.eliteVariant||'';
  c.bossId=e.bossId||'';
  return c;
}
function drawVisualCorpses(left,top,right,bottom){
  if (!G || !Array.isArray(G.visualCorpses)) return 0;
  const corpses=G.visualCorpses,len=corpses.length;
  const start=len===VISUAL_CORPSE_CAP?(G.visualCorpseHead||0)%len:0;
  let drawn=0;
  ctx.imageSmoothingEnabled=false;
  for (let offset=0;offset<len;offset++){
    const c=corpses[(start+offset)%len];
    // После offline-уменьшения самый широкий corpse — 72 px.
    if (c.x+40<left || c.x-40>right || c.y+34<top || c.y-34>bottom) continue;
    const key=corpseSpriteKey(c),image=key && CORPSE_SPRITES[key];
    if (image && image.complete && image.naturalWidth){
      ctx.drawImage(image,Math.round(c.x-image.naturalWidth/2),Math.round(c.y-image.naturalHeight/2));
    } else {
      // Единственный fallback: серый крест нужен только пока PNG ещё грузится.
      ctx.strokeStyle='#4a5560'; ctx.lineWidth=2; ctx.globalAlpha=0.72;
      ctx.beginPath(); ctx.moveTo(c.x-7,c.y-7); ctx.lineTo(c.x+7,c.y+7);
      ctx.moveTo(c.x+7,c.y-7); ctx.lineTo(c.x-7,c.y+7); ctx.stroke();
      ctx.globalAlpha=1;
    }
    drawn++;
  }
  return drawn;
}
function createBloodFloorCanvas(){
  const side=ARENA*2;
  let canvas=null;
  if (typeof OffscreenCanvas!=='undefined') canvas=new OffscreenCanvas(side,side);
  else if (typeof document!=='undefined' && typeof document.createElement==='function'){
    canvas=document.createElement('canvas'); canvas.width=side; canvas.height=side;
  }
  if (canvas && (canvas.width!==side || canvas.height!==side)){
    canvas.width=side; canvas.height=side;
  }
  return canvas;
}
function initBloodFloor(){
  if (!G) return null;
  if (!G.bloodGroundCanvas) G.bloodGroundCanvas=createBloodFloorCanvas();
  if (G.bloodGroundCanvas && !G.bloodGroundCtx)
    G.bloodGroundCtx=G.bloodGroundCanvas.getContext('2d',{alpha:true});
  return G.bloodGroundCtx;
}
function clearBloodFloor(){
  if (!G) return;
  const g=initBloodFloor();
  if (g) g.clearRect(0,0,ARENA*2,ARENA*2);
  if (!Array.isArray(G.bloodFx)) G.bloodFx=[];
  else {
    for (const fx of G.bloodFx) recycleBloodFx(fx);
    G.bloodFx.length=0;
  }
  G.bloodStampN=0;
}
function bloodFilter(material){
  return (BLOOD_MATERIALS[material]||BLOOD_MATERIALS.blood).filter;
}
function stampBloodDecal(x,y,size=44,material='blood',alpha=BLOOD_CFG.decalAlpha,tile=-1,angle=null){
  if (!G || !BLOOD_CFG.enabled || x<-ARENA || x>ARENA || y<-ARENA || y>ARENA) return false;
  const stampN=G.bloodStampN||0;
  if (stampN>=BLOOD_CFG.maxStamps) return false;
  const g=initBloodFloor();
  if (!g) return false;
  G.bloodStampN=stampN+1;
  const fade=1;
  const image=BLOOD_SPRITES.decals,cell=tile<0?rndi(0,7):tile%8;
  g.save(); g.translate(Math.round(x+ARENA),Math.round(y+ARENA));
  g.rotate(angle===null?rnd(0,Math.PI*2):angle);
  g.globalAlpha=alpha*fade; g.filter=bloodFilter(material); g.imageSmoothingEnabled=false;
  if (image && image.complete && image.naturalWidth){
    g.drawImage(image,(cell%4)*64,Math.floor(cell/4)*64,64,64,-size/2,-size/2,size,size);
  } else {
    g.fillStyle=(BLOOD_MATERIALS[material]||BLOOD_MATERIALS.blood).col;
    g.beginPath(); g.ellipse(0,0,size*0.42,size*0.22,0,0,Math.PI*2); g.fill();
  }
  g.restore(); return true;
}
const BLOOD_PUDDLE_SIZE=72;
function stampBloodPuddle(x,y,size=BLOOD_PUDDLE_SIZE,material='blood',variant=0,angle=null){
  if (!G || !BLOOD_CFG.enabled || x<-ARENA || x>ARENA || y<-ARENA || y>ARENA) return false;
  const stampN=G.bloodStampN||0;
  if (stampN>=BLOOD_CFG.maxStamps) return false;
  const g=initBloodFloor();
  if (!g) return false;
  G.bloodStampN=stampN+1;
  const fade=1;
  const cell=((variant%6)+6)%6;
  g.save(); g.translate(Math.round(x+ARENA),Math.round(y+ARENA));
  g.rotate(angle===null?corpseRandom()*Math.PI*2:angle);
  g.globalAlpha=0.92*fade; g.filter=bloodFilter(material); g.imageSmoothingEnabled=false;
  if (CORPSE_PUDDLE_ATLAS && CORPSE_PUDDLE_ATLAS.complete && CORPSE_PUDDLE_ATLAS.naturalWidth){
    g.drawImage(CORPSE_PUDDLE_ATLAS,cell*64,0,64,64,-size/2,-size/2,size,size);
  } else {
    g.fillStyle=(BLOOD_MATERIALS[material]||BLOOD_MATERIALS.blood).col;
    g.beginPath(); g.ellipse(0,0,size*0.5,size*0.32,0,0,Math.PI*2); g.fill();
  }
  g.restore(); return true;
}
function maybeStampHealthBloodPuddle(e,hpBefore,hpAfter){
  if (!G || !e || !(e.maxHp>0) || !(hpBefore>0) || e.bloodPuddleRolled) return 0;
  const half=e.maxHp*0.5;
  if (!(hpBefore>=half && hpAfter<half)) return 0;
  e.bloodPuddleRolled=true;
  const variant=corpsePuddleVariant();
  if (variant<0) return 0;
  const oneShot=hpAfter<=0 && hpBefore>=e.maxHp-1e-9;
  const size=BLOOD_PUDDLE_SIZE*(oneShot?1.5:1);
  e.bloodPuddleVariant=variant; e.bloodPuddleSize=size;
  stampBloodPuddle(e.x,e.y,size,bloodMaterialForEnemy(e),variant);
  return size;
}
function takeBloodFx(type){
  if (!G) return {t:type};
  if (!Array.isArray(G.bloodFxPool)) G.bloodFxPool=[];
  const fx=G.bloodFxPool.length?G.bloodFxPool.pop():{};
  fx.t=type; return fx;
}
function recycleBloodFx(fx){
  if (!G || !fx) return;
  if (!Array.isArray(G.bloodFxPool)) G.bloodFxPool=[];
  if (G.bloodFxPool.length<BLOOD_FX_POOL_CAP) G.bloodFxPool.push(fx);
}
function pushBloodFx(fx){
  if (!G || !BLOOD_CFG.enabled) return false;
  if (!Array.isArray(G.bloodFx)) G.bloodFx=[];
  if (G.bloodFx.length>=BLOOD_CFG.maxFx){
    // Переполнение — это уже невидимая декорация. Раньше каждый отклонённый
    // объект штамповался на 3000×3000 canvas: плотный DoT создавал тысячи
    // drawImage в секунду и провоцировал фризы вместо экономии.
    recycleBloodFx(fx);
    return false;
  }
  G.bloodFx.push(fx); return true;
}
function spawnBloodSplash(x,y,angle,strength,material='blood',mist=false){
  const size=(mist?42:50)+Math.sqrt(strength/0.18)*34;
  const max=mist?rnd(0.32,0.55):rnd(0.18,0.34);
  const fx=takeBloodFx(mist?'mist':'splash');
  fx.x=x;fx.y=y;fx.a=angle;fx.size=size;fx.life=max;fx.max=max;fx.material=material;
  return pushBloodFx(fx);
}
function spawnCriticalBloodSpray(x,y,angle,strength,material='blood'){
  /* Один компактный лист заменяет отдельные мелкие частицы. Плотность задаётся
     числом слоёв в emitBloodHit(), а каждый слой остаётся одним drawImage. */
  const size=clamp(34+Math.sqrt(strength/0.18)*16,36,56),max=rnd(0.18,0.27);
  const fx=takeBloodFx('critSpray');
  fx.x=x;fx.y=y;fx.a=angle;fx.size=size;fx.life=max;fx.max=max;fx.material=material;
  return pushBloodFx(fx);
}
function spawnBloodDrops(x,y,angle,count,strength,material='blood'){
  let made=0;
  for (let i=0;i<count;i++){
    const a=angle+rnd(-0.7,0.7),speed=rnd(65,185)*(0.65+Math.sqrt(strength/0.18));
    const max=rnd(0.26,0.55);
    const fx=takeBloodFx('drop');
    fx.x=x;fx.y=y;fx.z=rnd(4,15);fx.vx=Math.cos(a)*speed;fx.vy=Math.sin(a)*speed;
    fx.vz=rnd(45,115);fx.size=rnd(3,7);fx.life=max;fx.max=max;fx.material=material;
    if (pushBloodFx(fx)) made++;
  }
  return made;
}
function emitBloodHitValues(e,dealt,source,crit=false,killed=false,dot=false,superCrit=false){
  if (!BLOOD_CFG.enabled || !G || !e || !(dealt>0) || !(e.maxHp>0)) return 0;
  const isDot=!!dot;
  if (isDot && G.time-(e.bloodDotFxT===undefined?-Infinity:e.bloodDotFxT)<BLOOD_CFG.dotCooldown) return 0;
  if (isDot) e.bloodDotFxT=G.time;
  source=source || G.player || e;
  let dx=e.x-(Number.isFinite(source.x)?source.x:e.x),dy=e.y-(Number.isFinite(source.y)?source.y:e.y);
  if (Math.abs(dx)+Math.abs(dy)<0.001){
    const fallback=Number.isFinite(e.spriteFace)?(e.spriteFace>0?Math.PI:0):rnd(0,Math.PI*2);
    dx=Math.cos(fallback); dy=Math.sin(fallback);
  }
  const angle=Math.atan2(dy,dx),material=bloodMaterialForEnemy(e);
  let strength=clamp(dealt/e.maxHp,0.002,0.18);
  if (crit) strength*=1.35;
  if (superCrit) strength*=1.9;
  if (killed) strength*=1.65;
  const density=BLOOD_CFG.density;
  const drops=(killed?rndi(6,12):crit?rndi(5,9):rndi(2,5))*density;
  let made=0;
  for (let layer=0;layer<density;layer++){
    const layerAngle=angle+(layer-(density-1)*0.5)*0.16;
    made+=spawnBloodSplash(e.x,e.y,layerAngle,strength,material,false)?1:0;
    if (crit || killed) made+=spawnBloodSplash(e.x,e.y,layerAngle,strength,material,true)?1:0;
    if (crit) made+=spawnCriticalBloodSpray(e.x,e.y,layerAngle,strength,material)?1:0;
  }
  made+=spawnBloodDrops(e.x,e.y,angle,drops,strength,material);
  if (killed) stampBloodDecal(e.x,e.y,clamp(52+e.r*1.5,60,128),material,0.88,-1,angle);
  return made;
}
function emitBloodHit(e,dealt,meta={}){
  return emitBloodHitValues(e,dealt,meta.source,!!meta.crit,!!meta.killed,!!meta.dot,!!meta.superCrit);
}
function updateBloodFx(dt){
  if (!G || !Array.isArray(G.bloodFx)) return;
  const fx=G.bloodFx; let write=0;
  for (let read=0;read<fx.length;read++){
    const f=fx[read]; f.life-=dt;
    let alive=f.life>0;
    if (f.t==='drop'){
      f.x+=f.vx*dt; f.y+=f.vy*dt; f.z+=f.vz*dt; f.vz-=420*dt;
      f.vx*=Math.max(0,1-dt*2.4); f.vy*=Math.max(0,1-dt*2.4);
      if (f.z<=0){ stampBloodDecal(f.x,f.y,Math.max(10,f.size*3),f.material,0.46); alive=false; }
    }
    if (alive) fx[write++]=f; else recycleBloodFx(f);
  }
  fx.length=write;
}
function drawBloodGround(left,top,right,bottom){
  if (!G || !G.bloodGroundCanvas || right<=left || bottom<=top) return false;
  const sx=Math.floor(left+ARENA),sy=Math.floor(top+ARENA);
  const sw=Math.ceil(right-left),sh=Math.ceil(bottom-top);
  ctx.save(); ctx.globalAlpha=1; ctx.imageSmoothingEnabled=false;
  ctx.drawImage(G.bloodGroundCanvas,sx,sy,sw,sh,left,top,sw,sh); ctx.restore(); return true;
}
function drawBloodFx(view=null){
  if (!G || !Array.isArray(G.bloodFx)) return;
  // При перегрузе первыми скрываются старые, почти погасшие брызги. Свежий
  // hit-feedback остаётся, а число дорогих save/filter/drawImage ограничено.
  const start=Math.max(0,G.bloodFx.length-BLOOD_CFG.maxDrawFx);
  for (let i=start;i<G.bloodFx.length;i++){
    const f=G.bloodFx[i];
    const fy=f.t==='drop'?f.y-(f.z||0):f.y;
    const radius=f.t==='drop'?(f.size||0)+3:(f.size||0)*Math.SQRT1_2+4;
    if (view && !renderCircleVisible(f.x,fy,radius,view)) continue;
    const fade=clamp(f.life/f.max,0,1),image=BLOOD_SPRITES[f.t],spriteMeta=BLOOD_SPRITE_META[f.t];
    ctx.save(); ctx.globalAlpha=fade*(f.t==='mist'?0.58:0.92); ctx.filter=bloodFilter(f.material);
    if (f.t==='drop'){
      ctx.fillStyle=(BLOOD_MATERIALS[f.material]||BLOOD_MATERIALS.blood).col;
      ctx.fillRect(Math.round(f.x-f.size/2),Math.round(f.y-f.z-f.size/2),f.size,f.size);
    } else if (image && image.complete && image.naturalWidth && spriteMeta){
      const progress=clamp(1-f.life/f.max,0,0.999999),frame=Math.floor(progress*spriteMeta.frames);
      ctx.translate(f.x,f.y); ctx.rotate(f.a); ctx.imageSmoothingEnabled=false;
      ctx.drawImage(image,frame*spriteMeta.frame,0,spriteMeta.frame,spriteMeta.frame,
        -f.size/2,-f.size/2,f.size,f.size);
    } else {
      ctx.strokeStyle=(BLOOD_MATERIALS[f.material]||BLOOD_MATERIALS.blood).col;
      ctx.lineWidth=Math.max(2,f.size*0.09); ctx.beginPath(); ctx.moveTo(f.x,f.y);
      ctx.lineTo(f.x+Math.cos(f.a)*f.size*0.5,f.y+Math.sin(f.a)*f.size*0.5); ctx.stroke();
    }
    ctx.restore();
  }
}
const SHOOTER_PROJECTILE = typeof Image !== 'undefined' ? new Image() : null;
if (SHOOTER_PROJECTILE) SHOOTER_PROJECTILE.src = SHOOTER_PROJECTILE_DATA;
const SHOOTER_PROJECTILE_FRAMES = [0,1,2,3].map(index => ({index,x:index*8,y:0,w:8,h:8,draw:12}));
const PLAGUE_SLIME_PROJECTILE = typeof Image !== 'undefined' ? new Image() : null;
if (PLAGUE_SLIME_PROJECTILE) PLAGUE_SLIME_PROJECTILE.src = PLAGUE_SLIME_PROJECTILE_DATA;
const PLAGUE_SLIME_PROJECTILE_FRAMES = [0,1,2,3].map(index =>
  ({index,x:index*20,y:0,w:20,h:20,draw:20}));
const EMERALD_ORB_PROJECTILE = typeof Image !== 'undefined' ? new Image() : null;
if (EMERALD_ORB_PROJECTILE) EMERALD_ORB_PROJECTILE.src = EMERALD_ORB_PROJECTILE_DATA;
const EMERALD_ORB_PROJECTILE_FRAMES = [0,1,2,3].map(index =>
  ({index,x:index*32,y:0,w:32,h:32,draw:32}));
const GREED_SPEAR_PROJECTILE = typeof Image !== 'undefined' ? new Image() : null;
if (GREED_SPEAR_PROJECTILE) GREED_SPEAR_PROJECTILE.src = GREED_SPEAR_PROJECTILE_DATA;
const GREED_SPEAR_PROJECTILE_FRAMES = [0,1,2,3].map(index =>
  ({index,x:index*64,y:0,w:64,h:20,drawW:64,drawH:20}));
const EXECUTIONER_AXE_PROJECTILE = typeof Image !== 'undefined' ? new Image() : null;
if (EXECUTIONER_AXE_PROJECTILE) EXECUTIONER_AXE_PROJECTILE.src = EXECUTIONER_AXE_PROJECTILE_DATA;
const EXECUTIONER_AXE_PROJECTILE_FRAMES = [0,1,2,3,4,5,6,7].map(index =>
  ({index,x:index*56,y:0,w:56,h:56,draw:56}));
const MINOTAUR_SPEAR_PROJECTILE = typeof Image !== 'undefined' ? new Image() : null;
if (MINOTAUR_SPEAR_PROJECTILE) MINOTAUR_SPEAR_PROJECTILE.src = MINOTAUR_SPEAR_PROJECTILE_DATA;
const MINOTAUR_SPEAR_PROJECTILE_FRAMES = [0,1,2,3].map(index =>
  ({index,x:index*64,y:0,w:64,h:20,drawW:64,drawH:20}));
const SERAPH_HOLY_SPEAR = typeof Image !== 'undefined' ? new Image() : null;
if (SERAPH_HOLY_SPEAR) SERAPH_HOLY_SPEAR.src = SERAPH_HOLY_SPEAR_DATA;
const SERAPH_HOLY_SPEAR_FRAMES = [0,1,2,3].map(index =>
  ({index,x:index*96,y:0,w:96,h:32,drawW:96,drawH:32}));
const DEMON_QUEEN_BLOB = typeof Image !== 'undefined' ? new Image() : null;
if (DEMON_QUEEN_BLOB) DEMON_QUEEN_BLOB.src = DEMON_QUEEN_BLOB_DATA;
const DEMON_QUEEN_BLOB_FRAMES = [0,1,2,3].map(index =>
  ({index,x:index*32,y:0,w:32,h:32,draw:32}));
const MATRIARCH_PLAGUE_PROJECTILE = typeof Image !== 'undefined' ? new Image() : null;
if (MATRIARCH_PLAGUE_PROJECTILE) MATRIARCH_PLAGUE_PROJECTILE.src = MATRIARCH_PLAGUE_PROJECTILE_DATA;
const MATRIARCH_PLAGUE_PROJECTILE_FRAMES = [0,1,2,3].map(index =>
  ({index,x:index*32,y:0,w:32,h:32,draw:32}));
const VOID_GROUND_RIFT = typeof Image !== 'undefined' ? new Image() : null;
if (VOID_GROUND_RIFT) VOID_GROUND_RIFT.src = VOID_GROUND_RIFT_DATA;
const VOID_GROUND_RIFT_FRAMES = [0,1,2,3].map(index =>
  ({index,x:index*64,y:0,w:64,h:64,draw:64}));
const PLAYER_PROJECTILES = {};
if (typeof Image !== 'undefined'){
  for (const [key,dataKey] of [['arrow','archerProjectile'],['mage','mageProjectile']]){
    const img = new Image(); img.src = PLAYER_PROJECTILE_DATA[dataKey]; PLAYER_PROJECTILES[key] = img;
  }
}
const PLAYER_ARROW_FRAME = {index:0,x:0,y:0,w:12,h:6};
const PLAYER_MAGE_FRAMES = [0,1,2,3].map(index => ({index,x:index*8,y:0,w:8,h:8}));
const ARCANE_MINE_SPRITE = typeof Image !== 'undefined' ? new Image() : null;
const ARCANE_MINE_EXPLOSION = typeof Image !== 'undefined' ? new Image() : null;
if (ARCANE_MINE_SPRITE) ARCANE_MINE_SPRITE.src = ARCANE_MINE_SPRITE_DATA;
if (ARCANE_MINE_EXPLOSION) ARCANE_MINE_EXPLOSION.src = ARCANE_MINE_EXPLOSION_DATA;
const ARCANE_MINE_EXPLOSION_FRAMES = [0,1,2,3,4,5,6,7].map(index =>
  ({index,x:index*64,y:0,w:64,h:64}));
const MAGE_ABILITY_SPRITE_META = {
  normal:{frames:6}, remote:{frames:6}, mini:{frames:6},
  residual:{frames:4}, elemental:{frames:8}, heart:{frames:4},
};
const MAGE_ABILITY_SPRITES = {};
if (typeof Image !== 'undefined'){
  for (const key of Object.keys(MAGE_ABILITY_SPRITE_META)){
    const img=new Image(); img.src=MAGE_ABILITY_SPRITE_DATA[key]; MAGE_ABILITY_SPRITES[key]=img;
  }
}
const MAGE_ORB_EXPLOSION_TIME = 0.42;
const MAGE_EXPLOSION_ALPHA = 0.5;
const MAGE_ORB_EXPLOSION_DAMAGE_SHARE = 0.20;
function mageAbilitySpriteFrame(key, progress){
  const meta=MAGE_ABILITY_SPRITE_META[key];
  if (!meta) return null;
  const index=Math.min(meta.frames-1,Math.floor(clamp(progress,0,0.999999)*meta.frames));
  return {index,x:index*64,y:0,w:64,h:64,frames:meta.frames};
}
const ARCANE_MINE_DURATION = 3;
const ARCANE_MINE_DAMAGE_SHARE = 0.45;
const ARCANE_MINE_EXPLOSION_TIME = 0.48;
const ARCANE_MINE_DRAW_SIZE = 24;
const LEGACY_BOSS_KEYS = new Set([
  'lich','goat','plague','greed','executioner','tyrant','grave','behemoth',
  'vampire','voidwrath','minotaur','seraph','matriarch','demonqueen'
]);
function bossAttackVisual(e){
  if (!e || e.kind!=='boss' || !e.bossT || !BOSS_ATTACK_SPRITE_META[e.bossId]) return null;
  if (e.bossT.special){
    const special=e.bossT.special;
    return {progress:clamp(special.t/Math.max(0.001,special.duration),0,0.999999),source:'boss20'};
  }
  const visual=e.bossT.visualAction;
  if (LEGACY_BOSS_KEYS.has(e.bossId) && visual && visual.life>0)
    return {progress:clamp(1-visual.life/Math.max(0.001,visual.max),0,0.999999),source:'legacy'};
  return null;
}
function enemyAttackVisual(e){
  if (!e || e.kind==='boss' || !e.attackVisual) return null;
  const meta=e.kind==='elite' && e.eliteVariant
    ? ELITE_ATTACK_SPRITE_META[e.eliteVariant]
    : ENEMY_ATTACK_SPRITE_META[e.typeKey];
  if (!meta) return null;
  const visual=e.attackVisual,duration=Math.max(0.001,Number(visual.duration)||0.001);
  return {progress:clamp((Number(visual.t)||0)/duration,0,0.999999),source:'enemy'};
}
function startEnemyAttackVisual(e,duration,progress=0){
  if (!e || e.kind==='boss') return false;
  const meta=e.kind==='elite' && e.eliteVariant
    ? ELITE_ATTACK_SPRITE_META[e.eliteVariant]
    : ENEMY_ATTACK_SPRITE_META[e.typeKey];
  if (!meta) return false;
  duration=Math.max(0.08,Number(duration)||0.48);
  e.attackVisual={t:clamp(Number(progress)||0,0,0.999999)*duration,duration};
  return true;
}
function ensureEnemyAttackVisual(e,duration){
  return enemyAttackVisual(e) ? false : startEnemyAttackVisual(e,duration,0);
}
function strikeEnemyAttackVisual(e,duration,progress=0.55){
  if (!enemyAttackVisual(e) && !startEnemyAttackVisual(e,duration,progress)) return false;
  const visual=e.attackVisual;
  visual.t=Math.max(visual.t,visual.duration*clamp(Number(progress)||0.55,0,0.999999));
  return true;
}
function tickEnemyAttackVisual(e,dt){
  if (!e || !e.attackVisual) return;
  e.attackVisual.t+=Math.max(0,Number(dt)||0);
  if (e.attackVisual.t>=e.attackVisual.duration) e.attackVisual=null;
}
function enemySpriteMeta(e){
  if (!e) return null;
  if (bossAttackVisual(e))
    return BOSS_ATTACK_SPRITE_META[e.bossId];
  if (enemyAttackVisual(e))
    return e.kind==='elite' && e.eliteVariant
      ? ELITE_ATTACK_SPRITE_META[e.eliteVariant]
      : ENEMY_ATTACK_SPRITE_META[e.typeKey];
  if (e.kind==='boss' && e.bossId) return BOSS_SPRITE_META[e.bossId];
  if (e.kind==='elite' && e.eliteVariant) return ELITE_SPRITE_META[e.eliteVariant];
  return ENEMY_SPRITE_META[e.typeKey];
}
function enemySpriteImage(e){
  if (!e) return null;
  if (bossAttackVisual(e) && BOSS_ATTACK_SPRITES[e.bossId])
    return BOSS_ATTACK_SPRITES[e.bossId];
  if (enemyAttackVisual(e))
    return e.kind==='elite' && e.eliteVariant
      ? ELITE_ATTACK_SPRITES[e.eliteVariant]
      : ENEMY_ATTACK_SPRITES[e.typeKey];
  if (e.kind==='boss') return BOSS_SPRITES[e.bossId];
  if (e.kind==='elite' && e.eliteVariant) return ELITE_SPRITES[e.eliteVariant];
  return ENEMY_SPRITES[e.typeKey];
}
function enemySpriteFrame(e){
  const meta = enemySpriteMeta(e);
  if (!meta) return null;
  const attackVisual=bossAttackVisual(e)||enemyAttackVisual(e);
  const index = attackVisual
    ? Math.min(meta.frames.length-1,Math.floor(attackVisual.progress*meta.frames.length))
    : Math.floor(Math.max(0, Number(e.animT)||0) % meta.frames.length);
  return {meta, frame:meta.frames[index], index};
}
function enemyProjectileSpriteFrame(s){
  if (!s) return null;
  if (s.shotType === 'axe'){
    const turn=((Number(s.spin)||0)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
    return EXECUTIONER_AXE_PROJECTILE_FRAMES[Math.floor(turn/(Math.PI*2)*8)%8];
  }
  const index = Math.floor((G ? G.time : 0)*10) % 4;
  if (s.shotType === 'slime') return PLAGUE_SLIME_PROJECTILE_FRAMES[index];
  if (s.shotType === 'lich') return EMERALD_ORB_PROJECTILE_FRAMES[index];
  if (s.shotType === 'spear') return GREED_SPEAR_PROJECTILE_FRAMES[index];
  if (s.shotType === 'minotaurSpear') return MINOTAUR_SPEAR_PROJECTILE_FRAMES[index];
  if (s.shotType !== 'shooter') return null;
  return SHOOTER_PROJECTILE_FRAMES[index];
}
function playerProjectileSpriteFrame(s){
  if (!s) return null;
  if (s.spriteType === 'arrow') return PLAYER_ARROW_FRAME;
  if (s.spriteType !== 'mage') return null;
  return PLAYER_MAGE_FRAMES[Math.floor((G ? G.time : 0)*10) % 4];
}

/* Короткие служебные сигналы и смерть босса синтезируются в браузере.
   Контекст разрешается только жестом игрока — иначе Chrome/Safari молча
   блокируют звук. Частотный лимит не даёт толпе слиться в треск. */
let audioCtx = null, lastDeathSfx = -Infinity, lastLootDropSfx = -Infinity, lastEnemyHitSfx = -Infinity,
    lastHoverUiSfx = -Infinity;
const ATTACK_SOUND_HIGH_PASS_HZ=230;
const ATTACK_SOUND_LEVEL=0.255;
const ARCHER_ATTACK_SOUND_LEVEL=ATTACK_SOUND_LEVEL*0.75;
const MENU_SFX_LEVEL=0.80;
const ARCHER_SHOT_SOUNDS = typeof Audio !== 'undefined' ? ARCHER_SHOT_SOUND_DATA.map(source => {
  const sound=new Audio(source); sound.preload='auto'; sound.volume=sfxLevel(ARCHER_ATTACK_SOUND_LEVEL); return sound;
}) : [];
function playArcherShotSound(){
  if (!ARCHER_SHOT_SOUNDS.length || !sfxAudible()) return false;
  const sound=ARCHER_SHOT_SOUNDS[Math.min(ARCHER_SHOT_SOUNDS.length-1,
    Math.floor(Math.random()*ARCHER_SHOT_SOUNDS.length))];
  sound.volume=sfxLevel(ARCHER_ATTACK_SOUND_LEVEL);
  try {
    sound.currentTime=0;
    const pending=sound.play();
    if (pending && typeof pending.catch === 'function') pending.catch(()=>{});
    return true;
  } catch (e) { return false; }
}
const WARRIOR_ATTACK_SOUNDS = typeof Audio !== 'undefined' ? WARRIOR_ATTACK_SOUND_DATA.map(source => {
  const sound=new Audio(source); sound.preload='auto'; sound.volume=sfxLevel(ATTACK_SOUND_LEVEL); return sound;
}) : [];
function playWarriorAttackSound(){
  if (!WARRIOR_ATTACK_SOUNDS.length || !sfxAudible()) return false;
  const sound=WARRIOR_ATTACK_SOUNDS[Math.min(WARRIOR_ATTACK_SOUNDS.length-1,
    Math.floor(Math.random()*WARRIOR_ATTACK_SOUNDS.length))];
  sound.volume=sfxLevel(ATTACK_SOUND_LEVEL);
  try {
    sound.currentTime=0;
    const pending=sound.play();
    if (pending && typeof pending.catch === 'function') pending.catch(()=>{});
    return true;
  } catch (e) { return false; }
}
const MAGE_ATTACK_SOUNDS = typeof Audio !== 'undefined' ? MAGE_ATTACK_SOUND_DATA.map(source => {
  const sound=new Audio(source); sound.preload='auto'; sound.volume=sfxLevel(ATTACK_SOUND_LEVEL); return sound;
}) : [];
function playMageAttackSound(){
  if (!MAGE_ATTACK_SOUNDS.length || !sfxAudible()) return false;
  const sound=MAGE_ATTACK_SOUNDS[Math.min(MAGE_ATTACK_SOUNDS.length-1,
    Math.floor(Math.random()*MAGE_ATTACK_SOUNDS.length))];
  sound.volume=sfxLevel(ATTACK_SOUND_LEVEL);
  try {
    sound.currentTime=0;
    const pending=sound.play();
    if (pending && typeof pending.catch === 'function') pending.catch(()=>{});
    return true;
  } catch (e) { return false; }
}
const MONSTER_HIT_SOUND_LEVEL=0.38;
const MONSTER_HIT_SOUNDS = typeof Audio !== 'undefined' ? Object.fromEntries(
  Object.entries(MONSTER_HIT_SOUND_DATA).map(([key,sources]) => [key,sources.map(source => {
    const sound=new Audio(source); sound.preload='auto'; sound.volume=sfxLevel(MONSTER_HIT_SOUND_LEVEL); return sound;
  })])
) : {};
const MONSTER_DEATH_SOUND_LEVEL=0.46;
const MONSTER_DEATH_SOUNDS = typeof Audio !== 'undefined' ? Object.fromEntries(
  Object.entries(MONSTER_DEATH_SOUND_DATA).map(([key,sources]) => [key,sources.map(source => {
    const sound=new Audio(source); sound.preload='auto'; sound.volume=sfxLevel(MONSTER_DEATH_SOUND_LEVEL); return sound;
  })])
) : {};
const ALL_ATTACK_SOUNDS=[...ARCHER_SHOT_SOUNDS,...WARRIOR_ATTACK_SOUNDS,...MAGE_ATTACK_SOUNDS];
const ATTACK_SOUND_FILTER_ROUTES=new WeakMap();
function routeAttackSoundsThroughHighPass(){
  if (!audioCtx || typeof audioCtx.createMediaElementSource !== 'function' ||
      typeof audioCtx.createBiquadFilter !== 'function') return 0;
  let connected=0;
  for (const sound of ALL_ATTACK_SOUNDS){
    if (ATTACK_SOUND_FILTER_ROUTES.has(sound)) continue;
    try {
      const source=audioCtx.createMediaElementSource(sound);
      const filter=audioCtx.createBiquadFilter();
      filter.type='highpass';
      filter.frequency.setValueAtTime(ATTACK_SOUND_HIGH_PASS_HZ,audioCtx.currentTime);
      if (filter.Q && typeof filter.Q.setValueAtTime === 'function')
        filter.Q.setValueAtTime(Math.SQRT1_2,audioCtx.currentTime);
      source.connect(filter); filter.connect(audioCtx.destination);
      ATTACK_SOUND_FILTER_ROUTES.set(sound,{source,filter});
      connected++;
    } catch (e) {}
  }
  return connected;
}
const HOVER_SOUND = typeof Audio !== 'undefined' ? new Audio(HOVER_SOUND_DATA) : null;
if (HOVER_SOUND){
  HOVER_SOUND.preload='auto';
  HOVER_SOUND.volume=sfxLevel(0.2*MENU_SFX_LEVEL);
}
const CONFIRM_SOUND = typeof Audio !== 'undefined' ? new Audio(CONFIRM_SOUND_DATA) : null;
if (CONFIRM_SOUND){
  CONFIRM_SOUND.preload='auto';
  CONFIRM_SOUND.volume=sfxLevel(MENU_SFX_LEVEL);
}
const LEVEL_UP_SOUND_LEVEL=0.65;
const LEVEL_UP_SOUND = typeof Audio !== 'undefined' ? new Audio(LEVEL_UP_SOUND_DATA) : null;
if (LEVEL_UP_SOUND){
  LEVEL_UP_SOUND.preload='auto';
  LEVEL_UP_SOUND.volume=sfxLevel(LEVEL_UP_SOUND_LEVEL);
}
const MENU_MUSIC = typeof Audio !== 'undefined' ? new Audio(MENU_MUSIC_DATA) : null;
const MENU_MUSIC_REPLAY_DELAY_MS = 15000;
let menuMusicReplayTimer = null;
if (MENU_MUSIC){
  MENU_MUSIC.loop = false;
  MENU_MUSIC.volume = 0.5;
  MENU_MUSIC.preload = 'auto';
  if (typeof MENU_MUSIC.addEventListener === 'function')
    MENU_MUSIC.addEventListener('ended', scheduleMenuMusicReplay);
}
function cancelMenuMusicReplay(){
  if (menuMusicReplayTimer !== null) clearTimeout(menuMusicReplayTimer);
  menuMusicReplayTimer = null;
}
function scheduleMenuMusicReplay(){
  cancelMenuMusicReplay();
  if (!MENU_MUSIC || !MENU_MUSIC_ENABLED || !menuMode) return false;
  menuMusicReplayTimer = setTimeout(()=>{
    menuMusicReplayTimer = null;
    if (!MENU_MUSIC_ENABLED || !menuMode) return;
    try { MENU_MUSIC.currentTime=0; } catch (e) {}
    tryStartMenuMusic();
  }, MENU_MUSIC_REPLAY_DELAY_MS);
  return true;
}
function tryStartMenuMusic(){
  if (!MENU_MUSIC || !MENU_MUSIC_ENABLED || !menuMode || menuMusicReplayTimer !== null) return false;
  try {
    if (MENU_MUSIC.ended) MENU_MUSIC.currentTime=0;
    const pending=MENU_MUSIC.play();
    if (pending && typeof pending.catch === 'function') pending.catch(()=>{});
    return true;
  } catch (e) { return false; }
}
function stopMenuMusic(reset=false){
  if (!MENU_MUSIC) return;
  cancelMenuMusicReplay();
  MENU_MUSIC.pause();
  if (reset) try { MENU_MUSIC.currentTime=0; } catch (e) {}
}
function menuMusicLabel(){ return tr(MENU_MUSIC_ENABLED ? 'МУЗЫКА: ВКЛ' : 'МУЗЫКА: ВЫКЛ'); }
function menuMusicButtonHtml(){
  const label=menuMusicLabel();
  return '<button id="menumusicb" class="menu-music-toggle" type="button" aria-pressed="' +
    (MENU_MUSIC_ENABLED?'true':'false') + '" aria-label="' + label + '"><span aria-hidden="true">' +
    (MENU_MUSIC_ENABLED?'♫':'♪') + '</span><b>' + label + '</b></button>';
}
function refreshMenuMusicButton(){
  const button=$('#menumusicb'); if (!button) return;
  const label=menuMusicLabel();
  button.setAttribute('aria-pressed',MENU_MUSIC_ENABLED?'true':'false');
  button.setAttribute('aria-label',label);
  button.innerHTML='<span aria-hidden="true">' + (MENU_MUSIC_ENABLED?'♫':'♪') + '</span><b>' + label + '</b>';
}
function toggleMenuMusic(){
  MENU_MUSIC_ENABLED=!MENU_MUSIC_ENABLED;
  try { localStorage.setItem(MENU_MUSIC_KEY,MENU_MUSIC_ENABLED?'on':'off'); } catch (e) {}
  if (MENU_MUSIC_ENABLED) tryStartMenuMusic(); else stopMenuMusic(false);
  refreshMenuMusicButton();
  return MENU_MUSIC_ENABLED;
}
function bindMenuMusicButton(){
  const button=$('#menumusicb'); if (button) button.onclick=toggleMenuMusic;
}
function menuSfxButtonHtml(){
  const enabled=sfxAudible(), label=tr(enabled ? 'ЗВУКИ: ВКЛ' : 'ЗВУКИ: ВЫКЛ');
  return '<button id="menusfxtoggle" class="menu-sfx-toggle" type="button" aria-pressed="' +
    (enabled?'true':'false') + '" aria-label="' + label + '"><b>' + label + '</b></button>';
}
function bindMenuSfxButton(){
  const button=$('#menusfxtoggle'); if (button) button.onclick=toggleSfxMute;
}
function stopHoverSound(){
  if (!HOVER_SOUND) return false;
  try {
    HOVER_SOUND.pause();
    HOVER_SOUND.currentTime=0;
    return true;
  } catch (e) { return false; }
}
function playConfirmSound(){
  stopHoverSound();
  if (!CONFIRM_SOUND || !sfxAudible()) return false;
  CONFIRM_SOUND.volume=sfxLevel(MENU_SFX_LEVEL);
  try {
    CONFIRM_SOUND.currentTime=0;
    const pending=CONFIRM_SOUND.play();
    if (pending && typeof pending.catch === 'function') pending.catch(()=>{});
    return true;
  } catch (e) { return false; }
}
function runConfirmedMenuAction(action){
  playConfirmSound();
  return action();
}
function playHoverSound(){
  if (!HOVER_SOUND || !sfxAudible()) return false;
  const now=performance.now();
  if (now-lastHoverUiSfx < 35) return false;
  lastHoverUiSfx=now;
  HOVER_SOUND.volume=sfxLevel(0.2*MENU_SFX_LEVEL);
  try {
    HOVER_SOUND.currentTime=0;
    const pending=HOVER_SOUND.play();
    if (pending && typeof pending.catch === 'function') pending.catch(()=>{});
    return true;
  } catch (e) { return false; }
}
function handleMenuHover(event){
  if (event.pointerType && event.pointerType !== 'mouse') return false;
  const target=event.target;
  if (!target || typeof target.closest !== 'function') return false;
  const root=target.closest('#ov.menu');
  const clickable=target.closest('button,[role="button"],.card,input[type="range"]');
  if (!root || !clickable || !root.contains(clickable)) return false;
  if (event.relatedTarget && clickable.contains(event.relatedTarget)) return false;
  return playHoverSound();
}
function sfxAudible(){ return !SFX_MUTED && SFX_VOLUME > 0; }
function sfxLevel(volume){ return sfxAudible() ? volume * SFX_VOLUME / 100 : 0; }
function refreshSfxSettings(){
  for (const prefix of ['', 'menu']){
    const slider=$('#' + prefix + 'sfxvolume'), value=$('#' + prefix + 'sfxvolumevalue'), mute=$('#' + prefix + 'sfxmute');
    if (slider) slider.value=String(SFX_VOLUME);
    if (value) value.textContent=SFX_VOLUME + '%';
    if (mute){
      const off=!sfxAudible(), label=tr(off ? 'ЗВУКИ: ВЫКЛ' : 'ЗВУКИ: ВКЛ');
      mute.setAttribute('aria-pressed',off?'true':'false');
      mute.setAttribute('aria-label',label);
      mute.textContent=label;
    }
  }
  const menuToggle=$('#menusfxtoggle');
  if (menuToggle && menuToggle.id==='menusfxtoggle'){
    const enabled=sfxAudible(), label=tr(enabled ? 'ЗВУКИ: ВКЛ' : 'ЗВУКИ: ВЫКЛ');
    menuToggle.setAttribute('aria-pressed',enabled?'true':'false');
    menuToggle.setAttribute('aria-label',label);
    menuToggle.innerHTML='<b>' + label + '</b>';
  }
}
function setSfxVolume(value){
  SFX_VOLUME=Math.max(0,Math.min(100,Math.round(Number(value)||0)));
  if (SFX_VOLUME > 0) SFX_MUTED=false;
  try {
    localStorage.setItem(SFX_VOLUME_KEY,String(SFX_VOLUME));
    localStorage.setItem(SFX_MUTED_KEY,SFX_MUTED?'on':'off');
  } catch (e) {}
  refreshSfxSettings();
  return SFX_VOLUME;
}
function toggleSfxMute(){
  if (sfxAudible()) SFX_MUTED=true;
  else {
    SFX_MUTED=false;
    if (SFX_VOLUME <= 0) SFX_VOLUME=50;
  }
  try {
    localStorage.setItem(SFX_VOLUME_KEY,String(SFX_VOLUME));
    localStorage.setItem(SFX_MUTED_KEY,SFX_MUTED?'on':'off');
  } catch (e) {}
  refreshSfxSettings();
  return !SFX_MUTED;
}
function setPauseSettings(open){
  if (!G) return false;
  G.quickPaused=false;
  $('#quickpause').style.display='none';
  G.paused=!!open;
  $('#pauseov').style.display=open?'flex':'none';
  if (open) refreshSfxSettings();
  last=performance.now();
  return G.paused;
}
function setQuickPause(open){
  if (!G) return false;
  G.quickPaused=!!open;
  G.paused=G.quickPaused;
  $('#quickpause').style.display=G.quickPaused?'flex':'none';
  if (G.quickPaused) $('#pauseov').style.display='none';
  last=performance.now();
  return G.quickPaused;
}
function unlockSound(event){
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (AudioCtx){
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    routeAttackSoundsThroughHighPass();
  }
  const target=event && event.target;
  if (!target || typeof target.closest !== 'function' || !target.closest('#menumusicb')) tryStartMenuMusic();
}
function tone(freq, dur, vol, type, delay){
  if (!audioCtx || audioCtx.state !== 'running') return;
  const audibleVolume=sfxLevel(vol);
  if (audibleVolume <= 0) return;
  const at = audioCtx.currentTime + (delay || 0);
  const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
  osc.type = type || 'sine'; osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(audibleVolume, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(at); osc.stop(at + dur + 0.01);
}
function enemyDeathSfx(e){
  if (!e || !sfxAudible()) return false;
  const now = audioCtx && Number.isFinite(audioCtx.currentTime) ? audioCtx.currentTime : performance.now()/1000;
  if (now - lastDeathSfx < 0.035) return false;
  if (e.kind === 'boss'){
    if (!audioCtx || audioCtx.state !== 'running') return false;
    lastDeathSfx = now;
    tone(110, 0.035, 0.018, 'square');
    return true;
  }
  const sounds=MONSTER_DEATH_SOUNDS[e.typeKey];
  if (!sounds || !sounds.length) return false;
  lastDeathSfx = now;
  const sound=sounds[Math.min(sounds.length-1,Math.floor(Math.random()*sounds.length))];
  sound.volume=sfxLevel(MONSTER_DEATH_SOUND_LEVEL);
  try {
    sound.currentTime=0;
    const pending=sound.play();
    if (pending && typeof pending.catch === 'function') pending.catch(()=>{});
    return true;
  } catch (err) { return false; }
}
function levelUpSfx(){
  if (!LEVEL_UP_SOUND || !sfxAudible()) return false;
  LEVEL_UP_SOUND.volume=sfxLevel(LEVEL_UP_SOUND_LEVEL);
  try {
    LEVEL_UP_SOUND.currentTime=0;
    const pending=LEVEL_UP_SOUND.play();
    if (pending && typeof pending.catch === 'function') pending.catch(()=>{});
    return true;
  } catch (error) { return false; }
}
/* У каждого базового типа свой банк попаданий; элита наследует его через
   typeKey. Пока для семейства нет присланных файлов, общий fallback намеренно
   не звучит. Лимит защищает плотную толпу от сложения громкости. */
function playHitSound(e){
  if (!e || !sfxAudible()) return false;
  const sounds=MONSTER_HIT_SOUNDS[e.typeKey];
  if (!sounds || !sounds.length) return false;
  const now = audioCtx && Number.isFinite(audioCtx.currentTime) ? audioCtx.currentTime : performance.now()/1000;
  if (now - lastEnemyHitSfx < 0.025) return false;
  lastEnemyHitSfx = now;
  const sound=sounds[Math.min(sounds.length-1,Math.floor(Math.random()*sounds.length))];
  sound.volume=sfxLevel(MONSTER_HIT_SOUND_LEVEL);
  try {
    sound.currentTime=0;
    const pending=sound.play();
    if (pending && typeof pending.catch === 'function') pending.catch(()=>{});
    return true;
  } catch (error) { return false; }
}
/* Канонический синтез из gemini-code-1788105559696.html. Защита длиной во
   весь 0,4-секундный звон не позволяет двум одновременным находкам складывать
   громкость, но каждая следующая отдельная находка снова запускает сигнал. */
function playLootDrop(){
  if (!audioCtx || audioCtx.state !== 'running' || !sfxAudible()) return;
  const now = audioCtx.currentTime;
  if (now - lastLootDropSfx < 0.4) return;
  lastLootDropSfx = now;

  [659.25, 1046.50].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(freq, now + i * 0.03);
    gain.gain.setValueAtTime(sfxLevel(0.08), now + i * 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.08);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + i * 0.03);
    osc.stop(now + i * 0.03 + 0.08);
  });

  const bell = audioCtx.createOscillator();
  const bellGain = audioCtx.createGain();
  bell.type = 'triangle';
  bell.frequency.setValueAtTime(2093, now + 0.06);
  bellGain.gain.setValueAtTime(sfxLevel(0.1), now + 0.06);
  bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  bell.connect(bellGain).connect(audioCtx.destination);
  bell.start(now + 0.06);
  bell.stop(now + 0.4);
}
