/* Новые ветки Лучника: дальность, разгон, первое попадание и оперение. */
const {loadGame}=require('./sim');
let n=0,fail=0;
function ok(name,cond,detail=''){ n++; if(!cond)fail++; console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(58)+detail); }
function setup(random=()=>0.99){
  const c=loadGame('./PolyGrind.html',{random}); c.newGame('bow','keys','hunter');
  const G=c.__api.G,D=c.__api.D,p=G.player;
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.portal=null;
  p.x=p.y=0; p.atkCd=99;
  D.baseMin=D.baseMax=100; D.elem={fire:0,cold:0,lit:0,poi:0}; D.incAll=0; D.moreAll=1;
  D.critCh=D.superCh=D.dblHit=D.knock=0;
  return {c,G,D,p};
}
function foe(o,x=0,y=0){
  const e=o.c.spawnEnemy(); e.x=x;e.y=y;e.maxHp=e.hp=1e9;e.spd=e.dmg=0;e.kind='norm';e.typeKey='blob';e.armor=0;e.ward=null;e.bulwark=0; return e;
}
function arrowHit(o,age,{first=true}={}){
  const e=foe(o,100,0); o.c.spawnPlayerShot(o.p,0,o.G.weapon,false);
  const s=o.G.shots[o.G.shots.length-1]; s.x=e.x;s.y=e.y;s.age=age;s.vx=s.vy=0;
  if(!first)s.hitSet.push({});
  const hp=e.hp;o.c.update(0);return {damage:hp-e.hp,e,s};
}

{
  const o=setup(),mods=o.c.__api.MODS,ids=['archer.long_flight','archer.accelerated','archer.swift_arrows','archer.clean_trajectory','archer.elemental_pierce','archer.fletching'];
  ok('в каталоге есть все шесть новых навыков Лучника',ids.every(id=>mods.some(m=>m.id===id)));
  ok('все шесть навыков доступны только Лучнику',ids.every(id=>o.c.allowedClassesForMod(mods.find(m=>m.id===id)).join(',')==='bow'));
  ok('обычные ветки не имеют потолка',ids.filter(id=>!id.includes('swift')&&!id.includes('elemental')).every(id=>mods.find(m=>m.id===id).cap===undefined));
  o.G.bag.add('acceleratedArrow','inc',50);o.G.bag.add('cleanTrajectory','inc',50);o.c.recalc();
  ok('Стремительные стрелы открываются на 50% разгона',mods.find(m=>m.id==='archer.swift_arrows').show());
  ok('Элементальное пробитие открывается на 50% траектории',mods.find(m=>m.id==='archer.elemental_pierce').show());
  ok('у новых строк есть английские пары',o.c.__api.localizationMissing().length===0);
  const homing=mods.find(m=>m.id==='shape.homing');
  ok('обычная карточка Самонаведения удалена из пула Лучника',
    o.c.allowedClassesForMod(homing).join(',')==='wand',o.c.allowedClassesForMod(homing).join(','));
}

{
  const o=setup();const baseLife=o.G.weapon.life,baseRange=o.c.attackRange();
  o.G.bag.add('arrowFlight','inc',40);o.c.recalc();o.c.spawnPlayerShot(o.p,0,o.G.weapon,false);
  ok('Дальний полёт увеличивает время жизни стрелы на 40%',Math.abs(o.G.shots[0].life/baseLife-1.4)<1e-9,o.G.shots[0].life.toFixed(2)+'с');
  ok('автозахват растёт сверх фактической дальности',Math.abs(o.c.attackRange()-(o.G.weapon.speed*o.D.projSpd*o.G.weapon.life*1.4+60))<1e-9,
    Math.round(baseRange)+' → '+Math.round(o.c.attackRange()));
}

{
  const near=setup();near.G.bag.add('acceleratedArrow','inc',50);near.c.recalc();near.D.baseMin=near.D.baseMax=100;near.D.elem={fire:0,cold:0,lit:0,poi:0};
  const nHit=arrowHit(near,0.349).damage;
  const far=setup();far.G.bag.add('acceleratedArrow','inc',50);far.c.recalc();far.D.baseMin=far.D.baseMax=100;far.D.elem={fire:0,cold:0,lit:0,poi:0};
  const fHit=arrowHit(far,0.35).damage;
  ok('близкая стрела не получает Разогнанные стрелы',Math.abs(nHit-100)<1e-9,nHit+' урона');
  ok('с 0,35 сек применяется весь накопленный бонус',Math.abs(fHit-150)<1e-9,fHit+' урона');
}

{
  const o=setup();o.c.spawnPlayerShot(o.p,0,o.G.weapon,false);
  const s=o.G.shots[0];s.age=0.35;
  ok('без Разогнанных стрел синий след не включается',!o.c.acceleratedArrowTrailActive(s));
  o.G.bag.add('acceleratedArrow','inc',8);o.c.recalc();s.age=0.349;
  const early=!o.c.acceleratedArrowTrailActive(s);s.age=0.35;
  ok('синий след включается ровно с порога бонусного урона',early&&o.c.acceleratedArrowTrailActive(s));
  ok('след ограничен стрелами игрока и рисуется позади снаряда',
    !o.c.acceleratedArrowTrailActive({...s,playerArrow:false}) &&
    /drawAcceleratedArrowTrail\(s\);[\s\S]{0,100}drawPlayerProjectileSprite/.test(require('fs').readFileSync('./PolyGrind.html','utf8')));
}

{
  const o=setup();o.G.bag.add('swiftArrows','flag',1);o.c.recalc();o.D.baseMin=o.D.baseMax=100;o.D.elem={fire:0,cold:0,lit:0,poi:0};
  const early=arrowHit(o,0.399);
  ok('до 0,40 сек Стремительные стрелы не действуют',Math.abs(early.damage-100)<1e-9 && early.e.kb.x===0);
  o.G.enemies.length=0;
  const late=arrowHit(o,0.40);
  ok('с 0,40 сек даются +20% и гарантированный толчок',Math.abs(late.damage-120)<1e-9 && Math.hypot(late.e.kb.x,late.e.kb.y)>0,
    late.damage+' урона');
}

{
  const first=setup();first.G.bag.add('cleanTrajectory','inc',50);first.c.recalc();first.D.baseMin=first.D.baseMax=100;first.D.elem={fire:0,cold:0,lit:0,poi:0};
  const a=arrowHit(first,0,true).damage;
  const repeat=setup();repeat.G.bag.add('cleanTrajectory','inc',50);repeat.c.recalc();repeat.D.baseMin=repeat.D.baseMax=100;repeat.D.elem={fire:0,cold:0,lit:0,poi:0};
  const b=arrowHit(repeat,0,{first:false}).damage;
  ok('Чистая траектория усиливает первое попадание',Math.abs(a-150)<1e-9,a+' урона');
  ok('повторная или пробитая цель бонус не получает',Math.abs(b-100)<1e-9,b+' урона');
}

{
  const first=setup(()=>0.4);first.G.bag.add('elementalPierce','flag',1);first.c.recalc();
  first.D.baseMin=first.D.baseMax=100;first.D.elem={fire:0,cold:0,lit:0,poi:0};
  first.D.igniteCh=first.D.chillCh=first.D.shockCh=first.D.poiCh=25;first.D.ailEff=first.D.ailDur=1;
  const hit=arrowHit(first,0,true).e;
  ok('Элементальное пробитие удваивает четыре шанса первого попадания',hit.dots.fire.dps>0&&hit.ail.chill>0&&hit.ail.shock>0&&hit.dots.poison.dps>0);
  const repeat=setup(()=>0.4);repeat.G.bag.add('elementalPierce','flag',1);repeat.c.recalc();
  repeat.D.baseMin=repeat.D.baseMax=100;repeat.D.elem={fire:0,cold:0,lit:0,poi:0};repeat.D.igniteCh=repeat.D.chillCh=repeat.D.shockCh=repeat.D.poiCh=25;
  const miss=arrowHit(repeat,0,{first:false}).e;
  ok('последующие цели не удваивают стихийные шансы',miss.dots.fire.dps===0&&miss.ail.chill===0&&miss.ail.shock===0&&miss.dots.poison.dps===0);
}

{
  const o=setup();o.G.bag.add('featherSpeed','inc',12);o.G.picks.push({id:'archer.fletching',v:12});o.c.recalc();
  ok('Оперение даёт выбранные +12% скорости стрел',o.D.featherSpeed===12&&Math.abs(o.D.projSpd-1.12)<1e-9);
  ok('ролл +12% скорости связан с +5% самонаведения',o.D.featherHoming===5&&Math.abs(o.D.homing-0.05)<1e-9);
  o.G.bag.add('featherSpeed','inc',7);o.G.picks.push({id:'archer.fletching',v:7});o.c.recalc();
  ok('оба значения Оперения складываются без потолка',o.D.featherSpeed===19&&o.D.featherHoming===8);
}

{
  const o=setup(()=>0);o.D.dblHit=100;
  const e=foe(o),hp=e.hp;o.c.damage(e,{rangedInc:50});
  ok('двойное попадание сохраняет процентные бонусы стрелы',Math.abs((hp-e.hp)-240)<1e-9,
    (hp-e.hp)+' урона: 150 + 90');
}

{
  const o=setup(()=>0.15);o.D.dblHit=100;o.D.igniteCh=10;o.D.ailEff=o.D.ailDur=1;
  const e=foe(o);o.c.damage(e,{elementChanceMul:2});
  ok('второй удар сохраняет удвоенный стихийный шанс первой стрелы',e.dots.fire.n===2,
    e.dots.fire.n+' срабатывания поджога');
}

console.log(JSON.stringify({n,fail}));if(fail)process.exitCode=1;
