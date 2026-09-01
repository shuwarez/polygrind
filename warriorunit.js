/* Три подкласса Воина: формулы роста и боевые ограничения. */
const fs = require('fs');
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(54) + (det||''));

function mk(subclass, lvl=20){
  const c=loadGame('./GrimGrind.html'); c.newGame('blade','keys',subclass);
  const G=c.__api.G; G.lvl=lvl; c.recalc();
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.portal=null;
  const p=G.player; p.hp=c.__api.D.life; p.aim=0; p.bladeN=0;
  return {c,G,D:c.__api.D,p};
}
function foe(o,x=-70,y=0,kind='norm'){
  const e=o.c.spawnEnemy(); e.maxHp=e.hp=1e9; e.spd=e.dmg=0;
  e.x=x; e.y=y; e.kind=kind; e.typeKey='blob'; e.armor=0; e.ward=null; e.bulwark=0;
  return e;
}
function fixedDamage(o, marked){
  const e=foe(o,70,0), D=o.D;
  D.baseMin=D.baseMax=100; D.elem={fire:0,cold:0,lit:0,poi:0};
  D.incAll=0; D.moreAll=1; D.critCh=0; D.superCh=0;
  const hp=e.hp; o.c.damage(e, marked?{warriorMelee:true}:{}); return hp-e.hp;
}
function orbitHit({subclass=null,lvl=1,inc=0,more=1,element=0,crit=0,double=0,ignite=0}={}){
  const c=loadGame('./GrimGrind.html',{random:()=>0}); c.newGame('blade','keys',subclass);
  const G=c.__api.G, D=c.__api.D, p=G.player;
  G.lvl=lvl; G.bag.add('orbit','flat',1); c.recalc();
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.portal=null;
  p.x=p.y=0; G.orbitA=0;
  D.baseMin=D.baseMax=100; D.elem={fire:element,cold:0,lit:0,poi:0};
  D.incAll=inc; D.moreAll=more; D.critCh=crit; D.critMul=200; D.superCh=0;
  D.dblHit=double; D.deadlyHit=false; D.igniteCh=ignite;
  D.chillCh=D.shockCh=D.poiCh=D.knock=0; D.ailEff=D.ailDur=1;
  const e=foe({c,G,D,p}); Object.assign(e,c.orbitPos(0)); e.orbCd=0;
  const hp=e.hp; c.updateOrbits(0);
  return {damage:hp-e.hp, e};
}

{
  const c=loadGame('./GrimGrind.html'), s=c.__api.SUBCLASSES.blade;
  ok('каталог содержит три подкласса Воина', s.length===3 && s.map(x=>x.id).join(',')==='berserker,guardian,swordmaster' && s.map(x=>x.nm).join(',')==='БЕРСЕРК,СТРАЖ,МАСТЕР МЕЧА');
  const html=fs.readFileSync('./GrimGrind.html','utf8');
  ok('Воин возвращён в список игровых классов', html.includes("const PLAYABLE_CLASSES = ['bow','wand','necro','blade']"));
  ok('у новых строк есть английские пары', c.__api.localizationMissing().length===0);
}

{
  const c=loadGame('./GrimGrind.html'), card=c.__api.MODS.find(x=>x.id==='shape.orbit');
  ok('Круговой орб остаётся синим и доступен только Воину', card.rar===1 && card.wep.length===1 && card.wep[0]==='melee' && /25%/.test(card.nt));
  let leaked=false;
  for (const cls of ['bow','wand','necro']){
    c.newGame(cls,'keys',null);
    for (let i=0;i<200;i++) if (c.rollCards().some(x=>x.id==='shape.orbit')) leaked=true;
  }
  ok('другим трём классам орб не попадает в раздачу', !leaked);

  const plain=orbitHit();
  ok('касание орба наносит ровно 25% базовой автоатаки', Math.abs(plain.damage-25)<1e-9, plain.damage+' урона');
  const radiusGame=loadGame('./GrimGrind.html'); radiusGame.newGame('blade','keys');
  radiusGame.__api.G.bag.add('orbit','flat',1); radiusGame.recalc();
  radiusGame.__api.G.player.x=radiusGame.__api.G.player.y=0; radiusGame.__api.G.orbitA=0;
  const radiusPos=radiusGame.orbitPos(0);
  ok('радиус вращения орба увеличен на 20%: 74 → 88,8',
    Math.abs(Math.hypot(radiusPos.x,radiusPos.y)-88.8)<1e-9);
  const scaled=orbitHit({subclass:'berserker',lvl:20,inc:40,more:1.5,element:40});
  ok('орб наследует стихии, общие и классовые модификаторы', Math.abs(scaled.damage-84)<1e-9, scaled.damage+' урона');
  const procs=orbitHit({crit:100,double:100,ignite:100});
  ok('орб бросает крит, двойное попадание и шанс статуса', Math.abs(procs.damage-80)<1e-9 && procs.e.dots.fire.dps>0,
     procs.damage+' урона · поджог '+procs.e.dots.fire.dps.toFixed(1));
}

{
  const c=loadGame('./GrimGrind.html'), card=c.__api.MODS.find(x=>x.id==='trig.on_damaged');
  ok('Ответный удар доступен только оружию Воина',
    card.kind==='flag' && card.stat==='retal' && card.wep.length===1 && card.wep[0]==='melee');
  let leaked=false;
  for (const cls of ['bow','wand','necro']){
    c.newGame(cls,'keys',null);
    for (let i=0;i<200;i++) if (c.rollCards().some(x=>x.id==='trig.on_damaged')) leaked=true;
  }
  ok('другим трём классам Ответный удар не попадает в раздачу', !leaked);
}

{
  const c=loadGame('./GrimGrind.html'), thorns=c.__api.MODS.find(x=>x.id==='dmg.thorns'),
    circle=c.__api.MODS.find(x=>x.id==='dmg.thorn_circle'),
    steps=c.__api.MODS.find(x=>x.id==='warrior.three_step'), fury=c.__api.MODS.find(x=>x.id==='warrior.iron_fury');
  ok('четыре новые карты имеют правильные тиры и доступны только Воину',
    thorns.kind==='inc' && thorns.r.join(',')==='25,25' && thorns.cap===100 &&
    circle.kind==='flag' && circle.rar===2 && circle.unlock &&
    steps.kind==='flag' && steps.rar===1 && fury.kind==='flag' && fury.rar===1 &&
    [thorns,circle,steps,fury].every(x=>c.allowedClassesForMod(x).join(',')==='blade'));
}

{
  const o=mk(null,1); o.G.bag.add('thorns','inc',25); o.c.recalc();
  o.D.baseMin=o.D.baseMax=100; o.D.elem={fire:0,cold:0,lit:0,poi:0};
  o.D.incAll=0; o.D.moreAll=1; o.D.critCh=0; o.D.warriorMeleeInc=0;
  const source=foe(o,70,0), hp=source.hp;
  o.c.hurt(40,true,false,'ВРАГ · снаряд','norm',source);
  const quarter=hp-source.hp, beforeNoSource=source.hp;
  o.c.hurt(40,true,false,'ВРАГ · яд','norm');

  const full=mk(null,1); full.G.bag.add('thorns','inc',125); full.G.bag.add('thornCircle','flag',1); full.c.recalc();
  full.D.baseMin=full.D.baseMax=100; full.D.elem={fire:0,cold:0,lit:0,poi:0};
  full.D.incAll=0; full.D.moreAll=1; full.D.critCh=0; full.D.warriorMeleeInc=0;
  const attacker=foe(full,70,0), neighbor=foe(full,120,0), distant=foe(full,400,0);
  const ah=attacker.hp, nh=neighbor.hp, dh=distant.hp;
  full.c.hurt(40,true,false,'ВРАГ · контакт','norm',attacker);

  const ranged=loadGame('./GrimGrind.html'); ranged.newGame('bow','keys');
  ranged.__api.G.bag.add('thorns','inc',100); ranged.recalc();
  ok('Шипы отражают обе доли от ближних и дальних ударов, а круг бьёт соседей',
    Math.abs(quarter-35)<1e-9 && source.hp===beforeNoSource && full.D.thorns===100 &&
    Math.abs((ah-attacker.hp)-140)<1e-9 && Math.abs((nh-neighbor.hp)-70)<1e-9 && distant.hp===dh &&
    ranged.__api.D.thorns===0 && full.c.__api.MODS.find(x=>x.id==='dmg.thorn_circle').show(),
    '25%='+quarter+' · 100%='+(ah-attacker.hp)+' · круг='+(nh-neighbor.hp));
}

{
  const o=mk(null,1); o.G.bag.add('threeStep','flag',1); o.c.recalc();
  const base=o.G.weapon.reach*o.D.arc;
  const targetRanges=[0,1,2].map(n=>{o.p.bladeN=n; return o.c.attackRange();});
  o.p.bladeN=0; o.G.fx.length=0;
  o.c.attack(); const first=o.G.fx.filter(x=>x.t==='arc').at(-1).r;
  o.c.attack(); const second=o.G.fx.filter(x=>x.t==='arc').at(-1).r;
  o.c.attack(); const third=o.G.fx.filter(x=>x.t==='ring').at(-1).max;
  o.c.attack(); const fourth=o.G.fx.filter(x=>x.t==='arc').at(-1).r;
  ok('Техника трёх шагов даёт 10/15/20% дальности и повторяет цикл',
    targetRanges.every((v,i)=>Math.abs(v-base*(1.10+i*0.05))<1e-9) &&
    Math.abs(first-base*1.10)<1e-9 && Math.abs(second-base*1.15)<1e-9 &&
    Math.abs(third-base*1.45*1.20)<1e-9 && Math.abs(fourth-base*1.10)<1e-9 && o.p.bladeN===4,
    targetRanges.map(x=>x.toFixed(1)).join('/')+' · волна '+third.toFixed(1));
}

{
  const o=mk(null,1); o.G.bag.add('ironFury','flag',1); o.c.recalc();
  const baseInc=o.D.incAll, source=foe(o,70,0);
  for(let i=0;i<6;i++) o.c.hurt(1,true,false,'ВРАГ · снаряд','norm',source);
  o.p.ironFuryT=1.2;
  o.c.hurt(1,true,false,'ВРАГ · контакт','norm',source);
  const refreshedT=o.p.ironFuryT;
  const activeInc=o.D.incAll;
  o.c.setLanguage('ru'); const ru=o.c.activeCombatBuffs(o.p,0,0).join(' | ');
  o.c.setLanguage('en'); const en=o.c.activeCombatBuffs(o.p,0,0).join(' | ');
  o.G.enemies.length=0; o.G.spawnQueue=0; o.c.update(3.1);
  ok('Железная ярость копится до 25%, обновляет 3 сек и показывается в HUD',
    ru.includes('Железная ярость - урон увеличен на 25% - 3.0 секунд') &&
    en.includes('Iron Fury - damage increased by 25% - 3.0 seconds') &&
    Math.abs(activeInc-baseInc-25)<1e-9 && refreshedT===3 &&
    o.p.ironFuryPct===0 && o.p.ironFuryT===0 && Math.abs(o.D.incAll-baseInc)<1e-9,
    ru);
}

{
  const o=mk('berserker',20);
  ok('Берсерк: +1% ближнего урона за уровень', o.D.warriorMeleeInc===20, o.D.warriorMeleeInc+'%');
  const base=fixedDamage(mk(null,20),true), boosted=fixedDamage(mk('berserker',20),true);
  ok('Берсерк усиливает прямой взмах на 20-м уровне', Math.abs(boosted/base-1.20)<1e-9, base+' → '+boosted);
  const standalone=fixedDamage(mk('berserker',20),false);
  ok('самостоятельный эффект бонус Берсерка не получает', Math.abs(standalone-base)<1e-9, standalone+' урона');
  o.p.berserkLow=false; o.p.hp=o.D.life; o.c.recalc(); const full=o.D.aspd;
  o.p.berserkLow=true; o.p.hp=o.D.life*0.39; o.c.recalc();
  ok('ниже 40% здоровья скорость атаки умножается на 1.20', Math.abs(o.D.aspd/full-1.20)<1e-9, full.toFixed(2)+' → '+o.D.aspd.toFixed(2));
  const high=mk('berserker',20); high.p.berserkLow=false; high.p.hp=high.D.life*0.40; high.c.recalc();
  ok('на 40% здоровья ускорение ещё не действует', Math.abs(high.D.aspd-1)<1e-9, high.D.aspd.toFixed(2));
}

{
  const base=mk(null,20), guard=mk('guardian',20);
  ok('Страж: +0,75% здоровья за уровень', Math.abs(guard.D.life/base.D.life-1.15)<1e-9, Math.round(base.D.life)+' → '+Math.round(guard.D.life));
  for(let i=0;i<3;i++) foe(guard,-70+i*15,0);
  guard.c.attack(); guard.c.attack(); guard.c.attack();
  ok('волна по трём целям даёт барьер 6%', Math.abs(guard.p.barrier/guard.D.life-0.06)<1e-9, Math.round(guard.p.barrier)+' HP');
  ok('барьер запускает перезарядку 4 секунды', guard.p.guardianCd===4, guard.p.guardianCd+'с');

  const two=mk('guardian',20); foe(two,-70,0); foe(two,-55,0);
  two.c.attack(); two.c.attack(); two.c.attack();
  ok('двух целей для барьера недостаточно', two.p.barrier===0);

  guard.p.barrier=0; guard.c.attack(); guard.c.attack(); guard.c.attack();
  ok('до конца перезарядки барьер не обновляется', guard.p.barrier===0);

  const larger=mk('guardian',20); for(let i=0;i<3;i++) foe(larger,-70+i*15,0);
  larger.p.barrier=larger.D.life*0.10; larger.c.attack(); larger.c.attack(); larger.c.attack();
  ok('волна не уменьшает уже больший барьер', Math.abs(larger.p.barrier/larger.D.life-0.10)<1e-9);
  larger.G.enemies.length=0; larger.G.spawnQueue=0; larger.c.update(0.5);
  ok('перезарядка Стража уменьшается во времени', Math.abs(larger.p.guardianCd-3.5)<1e-9, larger.p.guardianCd.toFixed(1)+'с');
}

{
  const o=mk('swordmaster',20);
  ok('Мастер меча: рост на 20-м уровне', Math.abs(o.D.warriorWaveRadius-1.20)<1e-9 && Math.abs(o.D.warriorWaveKnock-1.30)<1e-9,
     'радиус ×'+o.D.warriorWaveRadius.toFixed(2)+', толчок ×'+o.D.warriorWaveKnock.toFixed(2));
  const cap=mk('swordmaster',100);
  ok('радиус и отбрасывание имеют потолки +60%/+90%', cap.D.warriorWaveRadius===1.60 && cap.D.warriorWaveKnock===1.90);
  const pushed=foe(o); o.c.attack(); o.c.attack(); o.c.attack();
  ok('усиление применяется к реальному импульсу волны', Math.abs(pushed.kb.x+676)<1e-6, Math.round(pushed.kb.x));

  const lv30=mk('swordmaster',30), normal=foe(lv30,-70,0,'norm'), elite=foe(lv30,-55,0,'elite');
  lv30.c.attack(); lv30.c.attack(); lv30.c.attack();
  ok('с 30-го уровня обычный враг оглушается на 0,35 сек', Math.abs(normal.ail.stun-0.35)<1e-9, normal.ail.stun.toFixed(2)+'с');
  const lv29=mk('swordmaster',29), early=foe(lv29);
  lv29.c.attack(); lv29.c.attack(); lv29.c.attack();
  ok('до 30-го уровня и на элите оглушения нет', early.ail.stun===0 && elite.ail.stun===0);
}

{
  const o=mk(null,1), cards=o.c.__api.MODS;
  for (const [id,stat,cap] of [
    ['warrior.long_blade','longBlade',60],['warrior.steel_crowd','steelCrowd',10],
    ['warrior.counter_tempo','counterTempo',50]
  ]){
    const m=cards.find(x=>x.id===id);
    ok(id+' имеет воинский потолок', m.stat===stat && m.cap===cap && m.wep.join(',')==='melee');
  }
  const long=cards.find(x=>x.id==='warrior.long_blade'), deadly=cards.find(x=>x.id==='warrior.deadly_radius');
  const steel=cards.find(x=>x.id==='warrior.steel_crowd'), hold=cards.find(x=>x.id==='warrior.hold_line');
  o.G.bag.add('longBlade','inc',60); o.G.bag.add('steelCrowd','flat',10); o.c.recalc();
  ok('Смертельный радиус открывается на +60% лезвия', deadly.show() && long.hide());
  ok('Глухая оборона открывается на 10 брони за врага', hold.show() && steel.hide());
}

{
  const o=mk(null,1); o.G.bag.add('longBlade','inc',60); o.c.recalc();
  const base=o.G.weapon.reach*o.D.arc, swing=foe(o,base*1.4,0);
  o.c.attack();
  ok('Длинное лезвие увеличивает только обычный взмах', swing.hp<1e9);
  o.G.enemies.length=0; const auto=foe(o,base+20,0), edge=Math.hypot(auto.x-o.p.x,auto.y-o.p.y)-auto.r;
  o.p.atkCd=0; o.c.update(0);
  ok('Длинное лезвие расширяет автозахват до дальности взмаха',
     edge>base && edge<base*o.D.longBladeRange && o.G.target===auto && auto.hp<1e9,
     edge.toFixed(1)+' при базе '+base.toFixed(1));
  o.G.enemies.length=0; const outsideWave=foe(o,base*1.9,0);
  o.c.attack(); o.c.attack();
  ok('Длинное лезвие не увеличивает круговую волну', outsideWave.hp===1e9);

  const red=mk(null,1); red.G.bag.add('deadlyRadius','flag',1); red.c.recalc();
  const expanded=foe(red,red.G.weapon.reach*2.2,0);
  red.c.attack(); red.c.attack(); red.c.attack();
  ok('Смертельный радиус умножает волну на 1.8', expanded.hp<1e9);
}

{
  const base=mk(null,1); base.D.baseMin=base.D.baseMax=100; base.D.dodge=0;
  for(let i=0;i<6;i++) foe(base,20+i*5,0);
  base.G.bag.add('steelCrowd','flat',10); base.c.recalc(); base.D.baseMin=base.D.baseMax=100;
  const hp0=base.p.hp; base.c.hurt(100,false,false,'ВРАГ · снаряд','norm');
  ok('Стальная толпа даёт до 60 динамической брони', Math.abs((hp0-base.p.hp)-60)<1e-9, (hp0-base.p.hp).toFixed(1)+' урона');

  const red=mk(null,1); for(let i=0;i<5;i++) foe(red,20+i*5,0);
  red.G.bag.add('holdLine','flag',1); red.c.recalc(); const hp1=red.p.hp;
  red.c.hurt(100,false,false,'ВРАГ · снаряд','norm');
  ok('Глухая оборона дополнительно срезает максимум 10%', Math.abs((hp1-red.p.hp)-90)<1e-9, (hp1-red.p.hp).toFixed(1)+' урона');
}

{
  const o=mk(null,1); o.G.bag.add('counterTempo','inc',50); o.c.recalc();
  o.c.hurt(1,false,false,'ВРАГ · контакт','norm');
  ok('Ответный темп даёт +50% на 2 секунды', o.p.counterTempoPct===50 && o.p.counterTempoT===2 && Math.abs(o.D.aspd-1.5)<1e-9);
  o.c.hurt(1,false,false,'ВРАГ · контакт','norm');
  ok('повторный контакт складывает бонус и добавляет время', o.p.counterTempoPct===100 && o.p.counterTempoT===4 && Math.abs(o.D.aspd-2)<1e-9);
  o.c.hurt(1,false,false,'ВРАГ · снаряд','norm');
  ok('неконтактный урон Ответный темп не запускает', o.p.counterTempoPct===100 && o.p.counterTempoT===4);
  o.G.enemies.length=0; o.c.update(4.1);
  ok('после суммарного таймера темп полностью сбрасывается', o.p.counterTempoPct===0 && o.p.counterTempoT===0 && Math.abs(o.D.aspd-1)<1e-9);
}

{
  const o=mk(null,1); o.G.bag.add('openWound','inc',6); o.c.recalc();
  o.D.baseMin=o.D.baseMax=100; o.D.elem={fire:0,cold:0,lit:0,poi:0}; o.D.incAll=0; o.D.moreAll=1; o.D.critCh=0;
  const e=foe(o,20,0), hits=[];
  for(let i=0;i<6;i++){ const hp=e.hp; o.c.damage(e,{warriorMelee:true,directMelee:true}); hits.push(hp-e.hp); }
  ok('Открытая рана растёт со второго удара до пяти стаков', hits.every((v,i)=>Math.abs(v-(100+Math.min(5,i)*6))<1e-9), hits.map(Math.round).join('/'));
  const other=foe(o,30,0), hp=other.hp; o.c.damage(other,{warriorMelee:true,directMelee:true});
  ok('стаки Открытой раны независимы для каждой цели', Math.abs((hp-other.hp)-100)<1e-9);
  o.G.time+=1.01; const before=e.hp; o.c.damage(e,{warriorMelee:true,directMelee:true});
  ok('после окна в 1 секунду рана начинается заново', Math.abs((before-e.hp)-100)<1e-9);
}

{
  const o=mk(null,1), card=o.c.__api.MODS.find(x=>x.id==='warrior.groundbreaker');
  ok('Землелом — фиолетовая одноразовая карта только Воина',
    card && card.kind==='flag' && card.rar===2 && card.stat==='groundbreaker' &&
    o.c.allowedClassesForMod(card).join(',')==='blade');
  o.G.picks.push({id:card.id,nm:card.nm,val:'',cat:card.cat});
  ok('после выбора Землелом полностью уходит из раздачи',
    Array.from({length:100},()=>o.c.rollCards()).flat().every(x=>x.id!==card.id));
}

{
  const o=mk(null,1); o.G.bag.add('groundbreaker','flag',1); o.c.recalc();
  for(let i=0;i<6;i++) o.c.attack();
  ok('первые две круговые волны только двигают счётчик Землелома',
    o.p.groundbreakerWaveN===2 && o.G.groundbreakerCracks.length===0);
  o.c.attack(); o.c.attack(); o.c.attack();
  const crack=o.G.groundbreakerCracks[0], expected=o.G.weapon.reach*o.D.arc*1.45*o.D.warriorWaveRadius;
  ok('третья круговая волна оставляет двухсекундную трещину своего радиуса',
    o.p.groundbreakerWaveN===3 && crack && crack.life===2 && crack.tick===0.5 && Math.abs(crack.r-expected)<1e-9,
    crack ? 'радиус '+crack.r.toFixed(1) : 'трещины нет');

  o.D.baseMin=o.D.baseMax=100; o.D.elem={fire:0,cold:0,lit:0,poi:0};
  o.D.incAll=0; o.D.moreAll=1; o.D.critCh=0; o.D.superCh=0; o.D.dblHit=0; o.D.deadlyHit=false;
  o.D.igniteCh=o.D.chillCh=o.D.shockCh=o.D.poiCh=0; o.p.atkCd=999;
  const plain=foe(o,0,0), armored=foe(o,40,0), outside=foe(o,crack.r+40,0);
  armored.armor=60;
  const hpPlain=plain.hp, hpArmored=armored.hp, hpOutside=outside.hp;
  o.c.update(0.49); const beforeTick=plain.hp; o.c.update(0.01);
  ok('первый тик приходит через 0,5 сек и отдельно применяет защиту целей',
    beforeTick===hpPlain && Math.abs((hpPlain-plain.hp)-12)<1e-9 &&
    Math.abs((hpArmored-armored.hp)-6)<1e-9 && outside.hp===hpOutside && o.p.perfectRhythmHeroN===0,
    (hpPlain-plain.hp).toFixed(1)+'/'+(hpArmored-armored.hp).toFixed(1));
  o.c.update(1.5);
  ok('за 2 секунды трещина наносит ровно четыре тика и исчезает',
    Math.abs((hpPlain-plain.hp)-48)<1e-9 && Math.abs((hpArmored-armored.hp)-24)<1e-9 &&
    outside.hp===hpOutside && o.G.groundbreakerCracks.length===0,
    (hpPlain-plain.hp).toFixed(1)+'/'+(hpArmored-armored.hp).toFixed(1));
}

{
  const o=mk(null,1); o.G.bag.add('groundbreaker','flag',1); o.c.recalc();
  o.c.setLanguage('ru');
  o.p.groundbreakerWaveN=0; const ru3=o.c.activeCombatBuffs(o.p,0,0);
  o.p.groundbreakerWaveN=1; const ru2=o.c.activeCombatBuffs(o.p,0,0);
  o.p.groundbreakerWaveN=2; const ready=o.c.activeCombatBuffs(o.p,0,0);
  o.c.setLanguage('en'); const en=o.c.activeCombatBuffs(o.p,0,0);
  ok('нижний индикатор показывает отсчёт и готовую волну на RU/EN',
    ru3.includes('Землелом через 3 волны') && ru2.includes('Землелом через 2 волны') &&
    ready.includes('Землелом — ВОЛНА!') && en.includes('Groundbreaker — WAVE!'));
}

{
  const o=mk(null,1), ids=['key.living_fortress','key.unsheathed_blade'];
  const cards=ids.map(id=>o.c.__api.MODS.find(x=>x.id===id));
  ok('Живая крепость и Клинок без ножен — кейстоуны только Воина',
    cards.every(x=>x&&x.rar===3&&x.kind==='flag'&&o.c.allowedClassesForMod(x).join(',')==='blade'));
  o.G.picks.push(...cards.map(x=>({id:x.id,nm:x.nm,val:'',cat:x.cat})));
  ok('оба выбранных воинских кейстоуна полностью уходят из раздачи',
    Array.from({length:100},()=>o.c.rollCards()).flat().every(x=>!ids.includes(x.id)));
}

{
  const base=mk(null,1), live=mk(null,1);
  for(const o of [base,live]){
    o.G.bag.add('armor','flat',40); o.G.bag.add('thorns','inc',25); o.G.bag.add('dodge','flat',30);
  }
  live.G.bag.add('kLivingFortress','flag',1); base.c.recalc(); live.c.recalc();
  ok('Живая крепость даёт ×1,3 брони, ×2 Шипов и обнуляет Уворот',
    Math.abs(live.D.armor-base.D.armor*1.3)<1e-9&&live.D.thornsRaw===25&&live.D.thorns===50&&live.D.dodge===0);
  ok('Живая крепость применяет ×0,70 движения и ×0,80 скорости атаки',
    Math.abs(live.D.mspd-base.D.mspd*0.70)<1e-9&&Math.abs(live.D.aspd-base.D.aspd*0.80)<1e-9,
    live.D.mspd.toFixed(1)+' скорости · '+live.D.aspd.toFixed(2)+' атак/сек');
}

{
  const o=mk(null,1); o.G.bag.add('kLivingFortress','flag',1); o.G.bag.add('steelCrowd','flat',10); o.c.recalc();
  for(let i=0;i<6;i++) foe(o,20+i*5,0);
  const hp=o.p.hp; o.c.hurt(100,false,false,'ВРАГ · снаряд','norm');
  const expected=100*(1-78/(78+90));
  ok('Живая крепость усиливает и динамическую броню Стальной толпы',
    Math.abs((hp-o.p.hp)-expected)<1e-9,(hp-o.p.hp).toFixed(2)+' урона');
}

{
  const o=mk(null,1); o.G.bag.add('kLivingFortress','flag',1); o.c.recalc();
  o.c.attack(); o.c.attack(); const before=o.p.barrier; o.c.attack(); const granted=o.p.barrier;
  o.p.barrier=o.D.life*0.05; o.c.attack(); o.c.attack(); o.c.attack();
  ok('каждый третий взмах Живой крепости даёт минимум 3% max HP барьера',
    before===0&&Math.abs(granted-o.D.life*0.03)<1e-9&&Math.abs(o.p.barrier-o.D.life*0.05)<1e-9,
    granted.toFixed(2)+' HP');
}

{
  const base=mk(null,1), blade=mk(null,1); blade.G.bag.add('kUnsheathedBlade','flag',1); blade.c.recalc();
  const baseRange=base.c.attackRange(), bladeRange=blade.c.attackRange();
  const baseDamage=fixedDamage(base,true), bladeDamage=fixedDamage(blade,true);
  ok('Клинок без ножен умножает дальность, дугу и ближний урон на 1,5/1,5/1,4',
    Math.abs(blade.D.arc/base.D.arc-1.5)<1e-9&&Math.abs(bladeRange/baseRange-1.5)<1e-9&&
    Math.abs(bladeDamage/baseDamage-1.4)<1e-9,
    bladeRange.toFixed(1)+' дальности · '+bladeDamage.toFixed(1)+' урона');
}

{
  const o=mk(null,1); o.c.__api.STORE.data.shop.sarmor=40;
  o.G.bag.add('armor','flat',30); o.G.bag.add('drFlat','flat',7); o.G.bag.add('kUnsheathedBlade','flag',1); o.c.recalc();
  const hp=o.p.hp; o.c.hurt(20,false,false,'ВРАГ · снаряд','norm');
  ok('Клинок обнуляет обычную и магазинную броню, сохраняя Панцирь от роя',
    o.D.armor===0&&o.D.drShop===0&&o.D.drFlat===7&&Math.abs((hp-o.p.hp)-13)<1e-9,
    'броня '+o.D.armor+' · магазин '+o.D.drShop+' · панцирь '+o.D.drFlat);
}

{
  const base=mk(null,1), both=mk(null,1);
  both.G.bag.add('armor','flat',40); both.G.bag.add('thorns','inc',25);
  both.G.bag.add('kLivingFortress','flag',1); both.G.bag.add('kUnsheathedBlade','flag',1); both.c.recalc();
  ok('два воинских кейстоуна сочетаются, но обнуление брони имеет приоритет',
    both.D.armor===0&&both.D.thorns===50&&Math.abs(both.D.mspd-base.D.mspd*0.7)<1e-9&&
    Math.abs(both.D.aspd-base.D.aspd*0.8)<1e-9&&both.D.warriorMeleeMore===1.4&&Math.abs(both.D.arc/base.D.arc-1.5)<1e-9);
}
