/* Встроенный контроль пространства Воина и его спрайт. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(50) + (det||''));
function mk(){
  const c=loadGame('./PolyGrind.html'); c.newGame('blade','keys');
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
  const fs=require('fs'), crypto=require('crypto'), html=fs.readFileSync('./PolyGrind.html','utf8');
  const m=html.match(/warrior:'data:image\/png;base64,([^']+)'/);
  const hash=m && crypto.createHash('sha256').update(Buffer.from(m[1],'base64')).digest('hex').toUpperCase();
  const c=loadGame('./PolyGrind.html');
  ok('класс называется ВОИН', c.__api.WEAPONS.blade.nm==='ВОИН');
  ok('спрайт Воина встроен внутрь HTML', !!m && Buffer.from(m[1],'base64').length===3002);
  ok('встроен именно присланный PNG', hash==='1E84968E35AC49C88A3C0D883E4A09B0DB2003E420C36846CEBCED52BE6895D6', hash||'нет данных');
  ok('рендер связывает меч с новым спрайтом', html.includes("w.id === 'wpn.sword' ? 'warrior'") && html.includes("blade:'warrior'"));
}