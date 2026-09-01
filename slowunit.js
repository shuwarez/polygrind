/* Новая ветка замедления: условный урон и уникальный Холодный раскол. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(68) + (det||''));
const near = (a,b,eps=1e-9) => Math.abs(a-b)<eps;

function build(hero='bow'){
  const c=loadGame('./GrimGrind.html',{random:()=>0.37}); c.newGame(hero,'keys');
  const G=c.__api.G; G.enemies.length=0;
  return {c,G,D:c.__api.D,
    dmg:c.__api.MODS.find(x=>x.id==='cond.vs_slowed'),
    shatter:c.__api.MODS.find(x=>x.id==='cc.cold_shatter')};
}
function foe(o,x=0,y=0,hp=1e9){
  const e=o.c.spawnEnemy('norm'); e.typeKey='blob'; e.kind='norm';
  e.x=x; e.y=y; e.hp=e.maxHp=hp; e.armor=0; e.noLoot=true;
  return e;
}
function sourceBuild(kind){
  const o=build(kind==='bombardier'?'necro':'bow');
  if (kind==='chill') o.G.bag.add('chillCh','chance',1);
  if (kind==='book') o.G.items.cold={tier:1,val:3};
  if (kind==='boots') o.G.amu.frost=true;
  if (kind==='dizzy') o.G.bag.add('dizzy','flag',1);
  if (kind==='aura') o.G.bag.add('slowAura','flag',1);
  if (kind==='bombardier') o.G.bag.add('minBomb','flat',1);
  o.c.recalc(); return o;
}

console.log('Урон по замедленным');
{ const o=build();
  ok('старая «Сила замедления» удалена и заменена новой карточкой',
    !o.c.__api.MODS.some(x=>x.id==='cc.slow' || x.stat==='slowMag') &&
    o.dmg.nm==='Урон по замедленным'); }
{ const o=build();
  ok('карточка даёт целые 5–10% без потолка',
    o.dmg.kind==='inc' && o.dmg.stat==='vsSlowed' && o.dmg.int===true &&
    o.dmg.r[0]===5 && o.dmg.r[1]===10 && o.dmg.cap===undefined && !o.dmg.hide); }
{ const o=build();
  ok('бросок урона достигает обеих границ',
    o.c.rollModValue(o.dmg,()=>0)===5 && o.c.rollModValue(o.dmg,()=>0.999999)===10); }
{ const o=build();
  ok('без источника замедления обе новые карточки закрыты',
    !o.dmg.show() && !o.shatter.show()); }
{ const sources=['chill','book','boots','bombardier','dizzy','aura'];
  const opened=sources.every(kind=>{ const o=sourceBuild(kind); return o.dmg.show() && o.shatter.show(); });
  ok('карточки открывают все шесть заявленных источников замедления',opened,sources.join(', ')); }
{ const o=sourceBuild('chill'), e=foe(o); o.G.bag.add('vsSlowed','inc',137); o.c.recalc(); e.ail.chill=1;
  ok('прямое Охлаждение включает весь накопленный бонус без потолка',
    o.c.conditionalInc(e,{})===137, '+'+o.c.conditionalInc(e,{})+'%'); }
{ const o=sourceBuild('chill'), chilled=foe(o,0,0), target=foe(o,50,0), far=foe(o,500,0);
  o.G.bag.add('vsSlowed','inc',17); o.c.recalc(); chilled.ail.chill=1;
  ok('ледяная аура охлаждённого включает бонус только поблизости',
    o.c.conditionalInc(target,{})===17 && o.c.conditionalInc(far,{})===0); }
{ const o=sourceBuild('dizzy'), e=foe(o); o.G.bag.add('vsSlowed','inc',17); o.c.recalc(); e.ail.dizzy=1;
  ok('Головокружение считается замедлением',o.c.conditionalInc(e,{})===17); }
{ const o=sourceBuild('aura'), inside=foe(o,100,0), outside=foe(o,500,0);
  o.G.bag.add('vsSlowed','inc',17); o.c.recalc();
  ok('аура героя включает бонус только внутри своего радиуса',
    o.c.conditionalInc(inside,{})===17 && o.c.conditionalInc(outside,{})===0); }
{ const o=sourceBuild('chill'), e=foe(o); o.G.bag.add('vsSlowed','inc',17); o.c.recalc();
  e.ail.stun=1; e.ail.freeze=1;
  ok('оглушение и заморозка без Охлаждения не считаются замедлением',
    o.c.conditionalInc(e,{})===0); }

console.log('Холодный раскол');
{ const o=sourceBuild('chill');
  ok('Холодный раскол — синяя одноразовая карточка-флаг',
    o.shatter.nm==='Холодный раскол' && o.shatter.kind==='flag' && o.shatter.rar===1 && o.shatter.stat==='coldShatter'); }
{ const o=sourceBuild('chill'); o.G.picks.push({id:o.shatter.id});
  let repeated=false; for(let i=0;i<100;i++) if(o.c.rollCards().some(x=>x.id===o.shatter.id)){ repeated=true; break; }
  ok('после выбора Холодный раскол больше не выпадает',!repeated); }
{ const o=sourceBuild('chill'); o.G.bag.add('coldShatter','flag',1); o.c.recalc();
  const killed=foe(o,0,0,1), nearEnemy=foe(o,170,0), farEnemy=foe(o,220,0); killed.ail.chill=1;
  o.c.killEnemy(killed,o.G.enemies.indexOf(killed));
  ok('убийство замедлённого охлаждает живых врагов в радиусе 180',
    near(nearEnemy.ail.chill,0.7) && farEnemy.ail.chill===0,
    'ближний '+nearEnemy.ail.chill.toFixed(1)+'с · дальний '+farEnemy.ail.chill.toFixed(1)+'с'); }
{ const o=sourceBuild('aura'); o.G.bag.add('coldShatter','flag',1); o.c.recalc();
  const killed=foe(o,100,0,1), target=foe(o,200,0); o.c.killEnemy(killed,o.G.enemies.indexOf(killed));
  ok('убийство внутри ауры замедления тоже запускает раскол',near(target.ail.chill,0.7)); }
{ const o=sourceBuild('chill'); o.G.bag.add('coldShatter','flag',1); o.G.bag.add('ailDur','inc',100); o.c.recalc();
  const chilled=foe(o,0,0), killed=foe(o,50,0,1), target=foe(o,150,0); chilled.ail.chill=1;
  o.c.killEnemy(killed,o.G.enemies.indexOf(killed));
  ok('ледяная аура может запустить раскол, а длительность масштабирует 0,7 сек',
    near(target.ail.chill,1.4),target.ail.chill.toFixed(1)+'с'); }
