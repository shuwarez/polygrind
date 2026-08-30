/* Двухслойная кровь: фактический урон, лимиты, материалы и жизнь одного этажа. */
const fs=require('fs'),crypto=require('crypto');
const {loadGame}=require('./sim');
const html=fs.readFileSync('./PolyGrind.html','utf8');
const ok=(nm,cond,det='')=>console.log((cond?'  ✓ ':'  ✗ ')+nm.padEnd(62)+det);
const block=(html.match(/const BLOOD_SPRITE_DATA = \{([\s\S]*?)\n\};/)||[])[1]||'';
function asset(key){
  const m=block.match(new RegExp(key+":'data:image/png;base64,([^']+)'"));
  return m?Buffer.from(m[1],'base64'):Buffer.alloc(0);
}
function size(png){ return png.length>=24?[png.readUInt32BE(16),png.readUInt32BE(20)]:[0,0]; }
const expected={
  splash:['0c46d1b3fcfa342fa716f0dddad2883ec2330693d9c9dcbe22afcaae4a1a15c7',256,64],
  mist:['20373938f43fbb76cc12cb561dda6608d79fc55a3c5f7f15187bf350308bd645',256,64],
  decals:['cd0ef52397dfed2e376f05545221fe14b136b678d106128ce0d1e11bafcbf174',256,128],
};
for (const [key,[hash,w,h]] of Object.entries(expected)){
  const png=asset(key),[aw,ah]=size(png);
  ok('встроен исходный лист крови '+key,png.length>0 && aw===w && ah===h &&
    crypto.createHash('sha256').update(png).digest('hex')===hash,`${png.length} B ${aw}×${ah}`);
}

const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
const G=c.__api.G,e=c.spawnEnemy('blob');
ok('новая партия создаёт пустое состояние крови',Array.isArray(G.bloodFx) && G.bloodFx.length===0 && G.bloodStampN===0);
ok('все восемь функций системы доступны',[
  'initBloodFloor','clearBloodFloor','emitBloodHit','spawnBloodSplash','spawnBloodDrops',
  'stampBloodDecal','updateBloodFx','drawBloodGround','drawBloodFx'
].every(key=>typeof c[key]==='function'));

const hp0=e.hp,fx0=G.bloodFx.length;
const dealt=c.applyDamage(e,5,false,false);
ok('кровь запускает только фактически снятый HP',dealt===5 && e.hp===hp0-5 && G.bloodFx.length>=fx0+3,
  `dealt=${dealt} fx=${G.bloodFx.length}`);
const afterHit=G.bloodFx.length;
c.applyDamage(e,0,false,false);
ok('нулевой урон не создаёт кровь',G.bloodFx.length===afterHit);

G.bloodFx.length=0; e.bloodDotFxT=undefined;
c.applyDamage(e,1,false,true);
const firstDot=G.bloodFx.length;
c.applyDamage(e,1,false,true);
ok('частые DoT-тиki ограничены на одной цели',firstDot>=3 && G.bloodFx.length===firstDot,`fx=${firstDot}`);
G.time+=0.19; c.applyDamage(e,1,false,true);
ok('DoT снова виден после 0.18 секунды',G.bloodFx.length>firstDot);

G.bloodFx.length=0; G.bloodStampN=0;
const victim=c.spawnEnemy('runner');
c.applyDamage(victim,victim.hp+10,true,false);
ok('смертельный удар сразу оставляет крупную декаль',victim.hp<=0 && G.bloodStampN>=1 && G.bloodFx.length>=2,
  `stamps=${G.bloodStampN} fx=${G.bloodFx.length}`);

const skeleton=c.spawnEnemy('pack',null,'skeletonWarrior');
const lich=c.spawnEnemy('boss','lich');
ok('скелеты и нежить получают не человеческую палитру',c.bloodMaterialForEnemy(skeleton)==='bone' && c.bloodMaterialForEnemy(lich)==='ichor');

G.bloodFx=Array.from({length:150},()=>({t:'drop',x:0,y:0,z:2,vx:0,vy:0,vz:0,size:3,life:1,max:1,material:'blood'}));
const capStamp=G.bloodStampN;
c.emitBloodHit(e,1,{});
ok('лимит временных частиц жёстко равен 150',G.bloodFx.length===150 && G.bloodStampN>capStamp,
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
ok('кровь вызывается после вычисления реального dealt',/const dealt = Math\.max\(0, Math\.min\(amount, e\.hp\)\);[\s\S]{0,300}emitBloodHit\(e,dealt/.test(html));
