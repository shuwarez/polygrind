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
  const o=setup(),mods=o.c.__api.MODS,ids=['archer.long_flight','archer.accelerated','archer.swift_arrows','archer.clean_trajectory','archer.elemental_pierce','archer.fletching','archer.split_arrow','archer.return_shot','archer.hunter_mark'];
  ok('в каталоге есть все девять новых навыков Лучника',ids.every(id=>mods.some(m=>m.id===id)));
  ok('все девять навыков доступны только Лучнику',ids.every(id=>o.c.allowedClassesForMod(mods.find(m=>m.id===id)).join(',')==='bow'));
  ok('числовые ветки не имеют потолка',ids.filter(id=>mods.find(m=>m.id===id).kind!=='flag').every(id=>mods.find(m=>m.id===id).cap===undefined));
  ok('три новые синие карты одноразовые',ids.slice(-3).every(id=>{const m=mods.find(x=>x.id===id);return m.kind==='flag'&&m.rar===1;}));
  o.G.bag.add('acceleratedArrow','inc',50);o.G.bag.add('cleanTrajectory','inc',50);o.c.recalc();
  ok('Стремительные стрелы открываются на 50% разгона',mods.find(m=>m.id==='archer.swift_arrows').show());
  ok('Элементальное пробитие открывается на 50% траектории',mods.find(m=>m.id==='archer.elemental_pierce').show());
  ok('у новых строк есть английские пары',o.c.__api.localizationMissing().length===0);
  const homing=mods.find(m=>m.id==='shape.homing');
  o.G.bag.add('homing','inc',61); o.c.recalc();
  const last=o.c.rollModValue(homing,()=>0.999999);
  o.G.bag.add('homing','inc',last); o.c.recalc();
  o.G.bag.add('homing','inc',50); o.c.recalc();
  ok('Самонаведение доступно только Магу и имеет точный потолок 100%',
    o.c.allowedClassesForMod(homing).join(',')==='wand' && homing.cap===100 &&
    last===39 && o.D.homing===1 && homing.hide(),
    o.c.allowedClassesForMod(homing).join(',')+' · последний выбор +'+last+'%');
}
function fixed(o){o.D.baseMin=o.D.baseMax=100;o.D.elem={fire:0,cold:0,lit:0,poi:0};o.D.incAll=0;o.D.moreAll=1;o.D.critCh=o.D.superCh=o.D.dblHit=o.D.knock=0;return o;}

{
  const o=setup();o.G.bag.add('splitArrow','flag',1);o.c.recalc();fixed(o);
  const first=foe(o,100,0);o.c.spawnPlayerShot(o.p,0,o.G.weapon,false);
  const original=o.G.shots[0];original.x=first.x;original.y=first.y;original.vx=620;original.vy=0;original.a=0;o.c.update(0);
  const shards=o.G.shots.filter(s=>s.splitShard);
  ok('Раздвоенная стрела выпускает ровно два боковых снаряда под ±30°',
    shards.length===2&&shards.every(s=>Math.abs(Math.abs(s.a)-Math.PI/6)<1e-9&&s.attackMul===0.22&&s.pierce===0&&s.chain===0),
    shards.map(s=>(s.a*180/Math.PI).toFixed(0)+'°').join('/'));
  const target=foe(o,200,0),shard=shards[0],hp=target.hp;o.G.shots=[shard];o.D.ricochet=3;
  shard.x=target.x;shard.y=target.y;shard.vx=shard.vy=0;o.c.update(0);
  ok('боковая стрела наносит 22% и не делится/не рикошетит повторно',
    Math.abs((hp-target.hp)-22)<1e-9&&o.G.shots.length===0,hp-target.hp+' урона');
}

{
  const o=setup();o.G.bag.add('returnShot','flag',1);o.c.recalc();const flags=[];
  for(let i=0;i<13;i++){o.c.spawnPlayerShot(o.p,0,o.G.weapon,false);flags.push(o.G.shots.at(-1).returnShot);o.G.shots.length=0;}
  ok('Возвратным становится только каждый тринадцатый выстрел',flags.slice(0,12).every(x=>!x)&&flags[12]&&o.p.returnShotN===13);
}

{
  const o=setup();o.G.bag.add('returnShot','flag',1);o.c.recalc();fixed(o);
  for(let i=0;i<13;i++)o.c.spawnPlayerShot(o.p,0,o.G.weapon,false);
  const s=o.G.shots.at(-1);o.G.shots=[s];const began=o.c.beginReturningArrow(s);
  const a=foe(o,120,0),b=foe(o,180,0),ah=a.hp,bh=b.hp;
  s.x=a.x;s.y=a.y;o.c.update(0);s.x=b.x;s.y=b.y;o.c.update(0);
  ok('обратная стрела проходит через несколько целей по 30% без отскоков',
    began&&s.returningArrow&&s.chain===0&&s.pierce===0&&s.attackMul===0.30&&
    Math.abs((ah-a.hp)-30)<1e-9&&Math.abs((bh-b.hp)-30)<1e-9&&o.G.shots.includes(s),
    (ah-a.hp)+'/'+(bh-b.hp)+' урона');
}

{
  const o=setup(()=>0.05);o.G.bag.add('returnShot','flag',1);o.c.recalc();fixed(o);
  o.D.igniteCh=o.D.chillCh=o.D.shockCh=o.D.poiCh=10;o.D.ailEff=o.D.ailDur=1;
  for(let i=0;i<13;i++)o.c.spawnPlayerShot(o.p,0,o.G.weapon,false);
  const s=o.G.shots.at(-1);o.G.shots=[s];o.c.beginReturningArrow(s);const e=foe(o,120,0);s.x=e.x;s.y=e.y;o.c.update(0);
  ok('обратный путь самостоятельно накладывает все четыре стихийных состояния',
    e.dots.fire.dps>0&&e.ail.chill>0&&e.ail.shock>0&&e.dots.poison.dps>0);
}

{
  const o=setup();o.G.bag.add('hunterMark','flag',1);o.c.recalc();const flags=[];
  for(let i=0;i<6;i++){o.c.spawnPlayerShot(o.p,0,o.G.weapon,false);flags.push(o.G.shots.at(-1).hunterMarkShot);o.G.shots.length=0;}
  ok('Метка охотника назначается только каждой шестой стреле',flags.slice(0,5).every(x=>!x)&&flags[5]&&o.p.hunterMarkN===6);
}

{
  const o=setup();o.G.bag.add('hunterMark','flag',1);o.c.recalc();fixed(o);
  for(let i=0;i<6;i++)o.c.spawnPlayerShot(o.p,0,o.G.weapon,false);
  const s=o.G.shots.at(-1);o.G.shots=[s];const e=foe(o,100,0),hp=e.hp;s.x=e.x;s.y=e.y;s.vx=s.vy=0;o.c.update(0);
  ok('метящий удар сразу получает +15% и ставит метку на 4 секунды',
    Math.abs((hp-e.hp)-115)<1e-9&&Math.abs(e.hunterMarkUntil-o.G.time-4)<1e-9&&o.c.hunterMarkActive(e),hp-e.hp+' урона');
}

{
  const o=setup(()=>0.15);o.G.bag.add('hunterMark','flag',1);o.c.recalc();fixed(o);
  o.D.igniteCh=o.D.chillCh=o.D.shockCh=o.D.poiCh=10;o.D.ailEff=o.D.ailDur=1;
  const e=foe(o);o.c.markHunterTarget(e);o.c.damage(e,{});
  ok('по отмеченной цели вдвое выше все четыре стихийных шанса',
    e.dots.fire.dps>0&&e.ail.chill>0&&e.ail.shock>0&&e.dots.poison.dps>0);
}

{
  const o=setup();o.G.bag.add('hunterMark','flag',1);o.c.recalc();const a=foe(o),b=foe(o),c=foe(o);
  o.G.time=0;o.c.markHunterTarget(a);o.G.time=1;o.c.markHunterTarget(b);o.G.time=2;o.c.markHunterTarget(c);
  const html=require('fs').readFileSync('./PolyGrind.html','utf8');
  ok('одновременно живут две метки, третья заменяет старейшую и рисует красный прицел',
    !o.c.hunterMarkActive(a)&&o.c.hunterMarkActive(b)&&o.c.hunterMarkActive(c)&&
    html.includes("ctx.strokeStyle='#ff3b4f'")&&html.includes("if (pass==='worldHud') drawHunterMark(e);"));
}

{
  const o=setup();o.G.bag.add('hunterMark','flag',1);o.c.recalc();fixed(o);const e=foe(o),hp=e.hp;
  o.c.markHunterTarget(e);o.G.time=4.01;o.c.damage(e,{});
  ok('через четыре секунды метка и её +15% полностью исчезают',!o.c.hunterMarkActive(e)&&Math.abs((hp-e.hp)-100)<1e-9,hp-e.hp+' урона');
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
