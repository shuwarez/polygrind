/* Пять эпических предметов: условия, канонические пути и жёсткие потолки. */
const {loadGame} = require('./sim');
const DT=1/60;
let n=0,fail=0;
function ok(name,cond,detail=''){
  n++; if(!cond) fail++;
  console.log((cond?'  \u2713 ':'  \u2717 ')+name.padEnd(62)+detail);
}
function mk(items=[],weapon='blade'){
  const c=loadGame('./GrimGrind.html',{random:()=>0.5});
  c.newGame(weapon,'keys');
  const G=c.__api.G,D=c.__api.D,p=G.player;
  G.pending=0; G.enemies.length=0; G.spawnQueue=1; G.packs.length=0;
  for(const key of [].concat(items||[])) G.amu[key]=true;
  c.recalc(); p.hp=D.life; p.atkCd=999;
  return {c,G,D,p};
}
function foe(o,{kind='norm',x=60,y=0,armor=0,hp=1e9}={}){
  const e=o.c.spawnEnemy();
  e.kind=kind; e.x=x; e.y=y; e.spd=0; e.dmg=0; e.armor=armor;
  e.maxHp=e.hp=hp; e.aff=[]; e.roles=[]; e.pack=null;
  return e;
}
function hit(o,e,extra={}){
  const before=e.hp;
  o.c.damage(e,Object.assign({direct:true,heroDirect:true,weaponAttack:true,noDouble:true},extra));
  return before-e.hp;
}

console.log('ПЕЧАТЬ ПУСТОГО ТРОНА');
{
  const warrior=mk(), archer=mk([],'bow');
  ok('предмет входит в пул только Воина',
    warrior.c.findDropPools().pool.includes('emptyThroneSeal') &&
    !archer.c.findDropPools().pool.includes('emptyThroneSeal'));
}
{
  const o=mk('emptyThroneSeal');
  for(let i=0;i<48;i++) o.c.update(DT);
  ok('0,8 сек без врага заряжают следующий взмах',o.p.emptyThroneReady);
  const normal=o.c.ordinaryWarriorSwingRange();
  ok('заряд добавляет ровно 80 дальности',Math.abs(o.c.attackRange()-normal-80)<1e-9,
    normal.toFixed(1)+' \u2192 '+o.c.attackRange().toFixed(1));
  const e=foe(o,{x:normal+55}); o.p.aim=0; o.p.atkCd=0;
  const x=o.p.x,y=o.p.y,before=e.hp; o.c.attack();
  ok('усиленный взмах достаёт цель за обычной границей',e.hp<before);
  ok('герой не телепортируется',o.p.x===x&&o.p.y===y);
  ok('после расхода начинается внутренний откат 2 сек',!o.p.emptyThroneReady&&o.G.amuT.emptyThroneSeal===2);
}
{
  const swing=ready=>{const o=mk('emptyThroneSeal'),e=foe(o,{x:50});o.p.aim=0;o.p.emptyThroneReady=ready;
    const v=hitViaAttack(o,e);return v;};
  function hitViaAttack(o,e){const hp=e.hp;o.c.attack();return hp-e.hp;}
  const plain=swing(false),boost=swing(true);
  ok('обычный усиленный взмах получает +35% урона',Math.abs(boost/plain-1.35)<1e-8,plain.toFixed(2)+' \u2192 '+boost.toFixed(2));
}
{
  const wave=ready=>{const o=mk('emptyThroneSeal'),e=foe(o,{x:-50});o.p.aim=0;o.p.bladeN=2;o.p.emptyThroneReady=ready;
    const hp=e.hp;o.c.attack();return hp-e.hp;};
  const plain=wave(false),charged=wave(true);
  ok('круговая волна наследует только обычный исходный урон',Math.abs(plain-charged)<1e-9,plain.toFixed(2)+' / '+charged.toFixed(2));
}

console.log('РУКА ХИРУРГА');
{
  const o=mk('surgeonsHand'),e=foe(o,{armor:100});
  const first=hit(o,e),second=hit(o,e);
  ok('первое прямое попадание создаёт 2% снижения брони',e.surgeonArmorPct===4&&second>first,
    first.toFixed(2)+' \u2192 '+second.toFixed(2));
  for(let i=0;i<38;i++) hit(o,e);
  ok('снижение брони ограничено 80%',e.surgeonArmorPct===80);
  const other=foe(o,{x:100,armor:100}); hit(o,other);
  ok('попадание по другой цели обрывает прежнюю последовательность',e.surgeonArmorPct===0&&other.surgeonArmorPct===2);
  o.G.time+=2.01;
  const mitigated=o.c.mitigate(other,100);
  ok('после 2 сек без попадания стаки перестают действовать',Math.abs(mitigated-37.5)<1e-9,mitigated.toFixed(2));
}
{
  const o=mk('surgeonsHand'),boss=foe(o,{kind:'boss',armor:100});
  hit(o,boss);
  ok('на боссе один стак снижает броню только на 1%',boss.surgeonArmorPct===1);
  const before=boss.surgeonArmorPct; hit(o,boss,{itemDamage:true});
  ok('предметный урон не копит стаки',boss.surgeonArmorPct===before);
}

console.log('САПОГИ МЕЖДУ МИРАМИ');
{
  const o=mk('betweenWorldsBoots'); o.p.dashN=2; o.p.x=12; o.p.y=34;
  o.c.tryDash();
  ok('рывок оставляет неподвижную тень на исходной позиции',o.G.worldShadow&&o.G.worldShadow.x===12&&o.G.worldShadow.y===34);
  ok('тень не имеет HP и не может взорваться',!Object.prototype.hasOwnProperty.call(o.G.worldShadow,'hp'));
  ok('создание тени включает откат 3 сек',o.G.amuT.betweenWorldsBoots===3);
  const first=o.G.worldShadow; o.p.dash=0; o.p.dashN=1; o.p.x=100; o.c.tryDash();
  ok('новый рывок на откате не заменяет тень',o.G.worldShadow===first);
}
{
  const o=mk('betweenWorldsBoots'); o.G.worldShadow={x:0,y:0,r:13,life:1,eliteUntil:0.5};o.p.x=200;
  const normal=foe(o,{x:50});normal.spd=100;o.c.update(DT);
  ok('ближайший обычный враг идёт к тени',normal.x<50,normal.x.toFixed(2));
  const elite=foe(o,{kind:'elite',x:50});elite.spd=100;o.G.time=0.2;o.G.worldShadow.eliteUntil=0.7;o.c.update(DT);
  const toward=elite.x<50; elite.x=50;o.G.time=0.71;o.c.update(DT);
  ok('элита видит тень только первые 0,5 сек',toward&&elite.x>50);
  const boss=foe(o,{kind:'boss',x:50});boss.spd=100;boss.bossId='';boss.bossT={};o.G.time=0.2;o.c.update(DT);
  ok('босс полностью игнорирует тень',boss.x>50);
  for(let i=0;i<70;i++) o.c.tickAmulets(DT);
  ok('через 1 сек тень исчезает без посмертного эффекта',o.G.worldShadow===null);
}

console.log('КОЛЬЦО НЕЗАЖИВШЕЙ РАНЫ');
{
  const o=mk('unhealedWoundRing'),e=foe(o);
  o.c.addDot(e,'fire',10,3);o.c.addDot(e,'poison',20,1);
  const poisonDps=e.dots.poison.dps;
  o.c.extendClosestDamagingStatus(e,{direct:true},1);
  ok('продлевается статус, ближайший к завершению',e.dots.poison.unhealedExtra===1&&!(e.dots.fire.unhealedExtra>0));
  ok('сила тиков при продлении не пересчитывается',e.dots.poison.dps===poisonDps);
  o.c.extendClosestDamagingStatus(e,{direct:true},1);
  o.c.extendClosestDamagingStatus(e,{direct:true},1);
  ok('один статус получает не больше +2 сек',e.dots.poison.unhealedExtra===2&&e.dots.fire.unhealedExtra===1);
  const before=e.dots.fire.unhealedExtra;
  o.c.extendClosestDamagingStatus(e,{direct:true,itemDamage:true},1);
  ok('предметный урон не продлевает статус',e.dots.fire.unhealedExtra===before);
}
{
  const o=mk('unhealedWoundRing'),e=foe(o);o.c.infectWithPlague(e);
  o.c.extendClosestDamagingStatus(e,{direct:true},1);
  ok('дискретная чума получает ещё одну секунду и один тик',e.plague.life===4&&e.plague.unhealedExtra===1);
}

console.log('ЧАСЫ МЁРТВОГО БОГА');
{
  const o=mk('deadGodClock');
  o.G.time=2.1;o.p.deadGodHistory=[{t:0,x:10,y:20,hp:o.D.life*0.9}];o.p.deadGodDamage=[];
  o.p.x=100;o.p.y=110;o.p.hp=o.D.life;o.p.dashN=1;const survivor=foe(o,{hp:777});
  o.c.hurt(o.D.life*0.30,true,false,'TEST');
  ok('потеря 30% max HP возвращает позицию двухсекундной давности',o.p.x===10&&o.p.y===20);
  ok('Часы возвращают записанное текущее HP',Math.abs(o.p.hp-o.D.life*0.9)<1e-9);
  ok('после срабатывания начинается откат 45 сек',o.G.amuT.deadGodClock===45);
  ok('заряды и убитые/живые враги не откатываются',o.p.dashN===1&&survivor.hp===777);
}
{
  const o=mk('deadGodClock');o.G.time=2.1;o.p.deadGodHistory=[{t:0,x:0,y:0,hp:o.D.life}];o.p.hp=o.D.life;
  o.c.hurt(o.D.life*0.29,true,false,'TEST');
  ok('потеря меньше 30% не запускает Часы',o.G.amuT.deadGodClock===0&&o.p.hp<o.D.life);
}
{
  const o=mk('deadGodClock');o.G.time=2.1;o.p.deadGodHistory=[{t:0,x:3,y:4,hp:o.D.life}];o.p.hp=o.D.life;
  o.c.hurt(o.D.life*0.15,true,false,'TEST');o.p.inv=0;o.G.time=3;o.c.hurt(o.D.life*0.15,true,false,'TEST');
  ok('несколько потерь внутри окна 2 сек суммируются',o.G.amuT.deadGodClock===45&&o.p.x===3&&o.p.y===4);
}
{
  const o=mk('deadGodClock');o.G.time=2.1;o.p.deadGodHistory=[{t:0,x:3,y:4,hp:o.D.life}];o.G.over=true;
  const hp=o.p.hp,x=o.p.x;
  ok('после уже обработанной смерти Часы не воскрешают',!o.c.triggerDeadGodClock(o.D.life)&&o.p.hp===hp&&o.p.x===x);
}

console.log(JSON.stringify({n,fail}));
if(fail) process.exitCode=1;
