/* Встроенный контроль пространства Воина и его спрайт. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(50) + (det||''));
function mk(){
  const c=loadGame('./index.html'); c.newGame('blade','keys');
  const G=c.__api.G, p=G.player;
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; p.aim=0;
  return {c,G,p};
}
function foe(o,x,y){
  const e=o.c.spawnEnemy(); e.maxHp=e.hp=1e9; e.spd=e.dmg=0;
  e.x=x; e.y=y; e.kind='norm'; e.armor=0; e.ward=null; e.bulwark=0;
  return e;
}
{
  const o=mk(), front=foe(o,70,0), back=foe(o,-70,0), hFront=front.hp, hBack=back.hp;
  o.c.attack();
  ok('первый взмах остаётся передней дугой', front.hp<hFront && back.hp===hBack);
  o.c.attack();
  ok('второй взмах остаётся передней дугой', back.hp===hBack);
  o.c.attack();
  ok('третий взмах задевает цель за спиной', back.hp<hBack, 'снято '+Math.round(hBack-back.hp));
  ok('третья волна гарантированно отбрасывает', back.kb.x<0, 'импульс '+Math.round(back.kb.x));
  ok('третья волна кратко замедляет', back.ail.dizzy>0, back.ail.dizzy.toFixed(2)+'с');
  ok('счётчик хранит период в три атаки', o.p.bladeN===3, 'счётчик '+o.p.bladeN);
}
{
  const o=mk(), far=foe(o,-180,0), hp=far.hp;
  o.c.attack(); o.c.attack(); o.c.attack();
  ok('волна не бьёт за пределами радиуса', far.hp===hp);
}

{
  const fs=require('fs'), html=fs.readFileSync('./index.html','utf8');
  const {imageInfo,embeddedObjectImage}=require('./asset_test_utils');
  const image=embeddedObjectImage(html,'HERO_SPRITE_DATA','warrior'),data=image&&image.buffer,info=imageInfo(data);
  const c=loadGame('./index.html');
  ok('класс называется ВОИН', c.__api.WEAPONS.blade.nm==='ВОИН');
  ok('лист Воина встроен внутрь HTML', !!data && info.w===128 && info.h===32);
  ok('встроен прозрачный lossless WebP-лист Воина',info.lossless&&info.alpha&&data.length<1500,data?data.length+' Б':'нет данных');
  ok('рендер связывает меч с новым спрайтом', html.includes("w.id === 'wpn.sword' ? 'warrior'") && html.includes("blade:'warrior'"));
}
