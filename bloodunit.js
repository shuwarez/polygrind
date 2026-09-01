/* Двухслойная кровь: фактический урон, лимиты, материалы и жизнь одного этажа. */
const fs=require('fs');
const {loadGame}=require('./sim');
const {imageInfo,embeddedObjectImage}=require('./asset_test_utils');
const html=fs.readFileSync('./PolyGrind.html','utf8');
const ok=(nm,cond,det='')=>console.log((cond?'  ✓ ':'  ✗ ')+nm.padEnd(62)+det);
const block=(html.match(/const BLOOD_SPRITE_DATA = \{([\s\S]*?)\n\};/)||[])[1]||'';
function asset(key){
  const image=embeddedObjectImage(html,'BLOOD_SPRITE_DATA',key);return image?image.buffer:Buffer.alloc(0);
}
const expected={
  splash:[256,64],mist:[256,64],critSpray:[128,32],decals:[256,128],
};
for (const [key,[w,h]] of Object.entries(expected)){
  const data=asset(key),info=imageInfo(data);
  ok('встроен lossless WebP-лист крови '+key,data.length>0 && info.w===w && info.h===h && info.lossless && info.alpha,
    `${data.length} B ${info.w}×${info.h}`);
}

const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
const G=c.__api.G,e=c.spawnEnemy('blob');
ok('новая партия создаёт пустое состояние крови',Array.isArray(G.bloodFx) && G.bloodFx.length===0 && G.bloodStampN===0);
ok('все двенадцать функций системы доступны',[
  'initBloodFloor','clearBloodFloor','emitBloodHit','spawnBloodSplash','spawnCriticalBloodSpray','spawnBloodDrops',
  'stampBloodDecal','stampBloodPuddle','maybeStampHealthBloodPuddle','updateBloodFx','drawBloodGround','drawBloodFx'
].every(key=>typeof c[key]==='function'));

const hp0=e.hp,fx0=G.bloodFx.length;
const dealt=c.applyDamage(e,5,false,false);
ok('кровь запускает только фактически снятый HP',dealt===5 && e.hp===hp0-5 && G.bloodFx.length>=fx0+6,
  `dealt=${dealt} fx=${G.bloodFx.length}`);
const afterHit=G.bloodFx.length;
c.applyDamage(e,0,false,false);
ok('нулевой урон не создаёт кровь',G.bloodFx.length===afterHit);

G.bloodFx.length=0;
c.applyDamage(e,1,true,false);
const firstCritSprays=G.bloodFx.filter(f=>f.t==='critSpray').length;
c.applyDamage(e,1,true,false);
ok('каждый крит добавляет два спрайтовых разлёта мелких брызг',
  firstCritSprays===2 && G.bloodFx.filter(f=>f.t==='critSpray').length===4);
ok('каждый слой критического разлёта остаётся одним компактным объектом',
  G.bloodFx.filter(f=>f.t==='critSpray').every(f=>f.max<=0.27 && f.size<=56));

G.bloodFx.length=0; e.bloodDotFxT=undefined;
c.applyDamage(e,1,false,true);
const firstDot=G.bloodFx.length;
c.applyDamage(e,1,false,true);
ok('частые DoT-тиki ограничены на одной цели',firstDot>=6 && G.bloodFx.length===firstDot,`fx=${firstDot}`);
G.time+=0.19; c.applyDamage(e,1,false,true);
ok('DoT снова виден после 0.18 секунды',G.bloodFx.length>firstDot);

G.bloodFx.length=0; G.bloodStampN=0;
const seedForPuddle=want=>{
  for(let seed=1;seed<10000;seed++){
    G.corpseRng=seed;
    if((c.__api.corpsePuddleVariant()>=0)===want) return seed;
  }
  return 0;
};
const puddleSeed=seedForPuddle(true),noPuddleSeed=seedForPuddle(false);
const wounded=c.spawnEnemy('tank'); wounded.maxHp=wounded.hp=100; G.corpseRng=puddleSeed;
const halfStampStart=G.bloodStampN;
c.applyDamage(wounded,51,false,false);
const halfPoolWorks=wounded.hp===49 && wounded.bloodPuddleRolled && wounded.bloodPuddleSize===72 &&
  wounded.bloodPuddleVariant>=0 && wounded.bloodPuddleVariant<6 && G.bloodStampN===halfStampStart+1;
const halfStampAfter=G.bloodStampN; G.corpseRng=puddleSeed; c.applyDamage(wounded,1,false,false);
const noSecondRoll=G.bloodStampN===halfStampAfter && wounded.bloodPuddleSize===72;
const missed=c.spawnEnemy('blob'); missed.maxHp=100; missed.hp=60; G.corpseRng=noPuddleSeed;
const missedStampStart=G.bloodStampN; c.applyDamage(missed,11,false,false); G.corpseRng=puddleSeed; c.applyDamage(missed,1,false,false);
const failedRollStaysFinal=missed.bloodPuddleRolled && missed.bloodPuddleSize===0 && G.bloodStampN===missedStampStart;
const victim=c.spawnEnemy('runner'); victim.maxHp=victim.hp=100; G.corpseRng=puddleSeed;
const oneShotStampStart=G.bloodStampN; c.applyDamage(victim,110,true,false);
const oneShotPoolWorks=victim.hp<=0 && victim.bloodPuddleSize===108 && G.bloodStampN===oneShotStampStart+2;
ok('ниже 50% лужа бросается один раз, а ваншот увеличивает её ровно в полтора раза',
  puddleSeed>0 && noPuddleSeed>0 && halfPoolWorks && noSecondRoll && failedRollStaysFinal && oneShotPoolWorks,
  `half=${wounded.bloodPuddleSize} oneShot=${victim.bloodPuddleSize}`);

const skeleton=c.spawnEnemy('pack',null,'skeletonWarrior');
const lich=c.spawnEnemy('boss','lich');
ok('скелеты и нежить получают не человеческую палитру',c.bloodMaterialForEnemy(skeleton)==='bone' && c.bloodMaterialForEnemy(lich)==='ichor');

G.bloodFx=Array.from({length:600},()=>({t:'drop',x:0,y:0,z:2,vx:0,vy:0,vz:0,size:3,life:1,max:1,material:'blood'}));
const capStamp=G.bloodStampN;
c.emitBloodHit(e,1,{});
ok('лимит временных частиц жёстко равен 600',G.bloodFx.length===600 && G.bloodStampN>capStamp,
  `fx=${G.bloodFx.length}`);

G.bloodFx=[{t:'drop',x:20,y:20,z:0,vx:0,vy:0,vz:-1,size:4,life:1,max:1,material:'blood'}];
const landStamp=G.bloodStampN;
c.updateBloodFx(1/60);
ok('приземлившаяся капля переносится в постоянный слой',G.bloodFx.length===0 && G.bloodStampN===landStamp+1);

G.bloodFx=[{t:'splash',x:0,y:0,a:0,size:20,life:1,max:1,material:'blood'}]; G.bloodStampN=77;
c.updateBloodFx(0.1);
ok('обычный кадр не очищает кровь этажа',G.bloodFx.length===1 && G.bloodStampN===77);
c.buildFloor();
ok('buildFloor очищает временную и постоянную кровь',G.bloodFx.length===0 && G.bloodStampN===0);

ok('постоянный слой рисует только видимую вырезку',/drawBloodGround\(floorLeft,floorTop,floorRight,floorBottom\)/.test(html) &&
  /drawImage\(G\.bloodGroundCanvas,sx,sy,sw,sh,left,top,sw,sh\)/.test(html));
ok('изображения крови не создаются внутри кадровых функций',
  !c.drawBloodGround.toString().includes('new Image') && !c.drawBloodFx.toString().includes('new Image'));
ok('критический разлёт рисуется одним кадром компактного листа',
  /critSpray:\{frame:32,frames:4\}/.test(html) &&
  /drawImage\(image,frame\*spriteMeta\.frame/.test(html));
ok('кровь вызывается после вычисления реального dealt',/const dealt = Math\.max\(0, Math\.min\(amount, e\.hp\)\);[\s\S]{0,300}emitBloodHit\(e,dealt/.test(html));
