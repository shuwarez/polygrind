/* Три подкласса Воина: формулы роста и боевые ограничения. */
const fs = require('fs');
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(54) + (det||''));

function mk(subclass, lvl=20){
  const c=loadGame('./PolyGrind.html'); c.newGame('blade','keys',subclass);
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
  const c=loadGame('./PolyGrind.html',{random:()=>0}); c.newGame('blade','keys',subclass);
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
  const c=loadGame('./PolyGrind.html'), s=c.__api.SUBCLASSES.blade;
  ok('каталог содержит три подкласса Воина', s.length===3 && s.map(x=>x.id).join(',')==='berserker,guardian,swordmaster' && s.map(x=>x.nm).join(',')==='БЕРСЕРК,СТРАЖ,МАСТЕР МЕЧА');
  const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('Воин возвращён в список игровых классов', html.includes("const PLAYABLE_CLASSES = ['bow','wand','necro','blade']"));
  ok('у новых строк есть английские пары', c.__api.localizationMissing().length===0);
}

{
  const c=loadGame('./PolyGrind.html'), card=c.__api.MODS.find(x=>x.id==='shape.orbit');
  ok('Круговой орб остаётся синим и доступен только Воину', card.rar===1 && card.wep.length===1 && card.wep[0]==='melee' && /25%/.test(card.nt));
  let leaked=false;
  for (const cls of ['bow','wand','necro']){
    c.newGame(cls,'keys',null);
    for (let i=0;i<200;i++) if (c.rollCards().some(x=>x.id==='shape.orbit')) leaked=true;
  }
  ok('другим трём классам орб не попадает в раздачу', !leaked);

  const plain=orbitHit();
  ok('касание орба наносит ровно 25% базовой автоатаки', Math.abs(plain.damage-25)<1e-9, plain.damage+' урона');
  const scaled=orbitHit({subclass:'berserker',lvl:20,inc:40,more:1.5,element:40});
  ok('орб наследует стихии, общие и классовые модификаторы', Math.abs(scaled.damage-84)<1e-9, scaled.damage+' урона');
  const procs=orbitHit({crit:100,double:100,ignite:100});
  ok('орб бросает крит, двойное попадание и шанс статуса', Math.abs(procs.damage-80)<1e-9 && procs.e.dots.fire.dps>0,
     procs.damage+' урона · поджог '+procs.e.dots.fire.dps.toFixed(1));
}

{
  const c=loadGame('./PolyGrind.html'), card=c.__api.MODS.find(x=>x.id==='trig.on_damaged');
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
  const c=loadGame('./PolyGrind.html'), card=c.__api.MODS.find(x=>x.id==='cond.long_range');
  ok('Урон издалека ограничен дальними типами оружия',
    card.wep.length===2 && card.wep.includes('proj') && card.wep.includes('orb') && !card.wep.includes('melee'));
  c.newGame('blade','keys',null);
  let leaked=false;
  for (let i=0;i<500;i++) if (c.rollCards().some(x=>x.id==='cond.long_range')) leaked=true;
  ok('Воину Урон издалека не попадает в раздачу', !leaked);
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
