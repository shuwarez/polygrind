/* Семь легендарных предметов: стойка, волна, эхо, свита, сферы и экономика находок. */
const {loadGame}=require('./sim');
const DT=1/60;
let n=0,fail=0;
function ok(name,cond,detail=''){
  n++; if(!cond) fail++;
  console.log((cond?'  \u2713 ':'  \u2717 ')+name.padEnd(68)+detail);
}
function mk(items=[],weapon='blade',random=()=>0.5){
  const c=loadGame('./PolyGrind.html',{random});
  c.newGame(weapon,'keys');
  const G=c.__api.G,D=c.__api.D,p=G.player;
  G.pending=0;G.enemies.length=0;G.spawnQueue=1;G.packs.length=0;
  for(const key of [].concat(items||[])) G.amu[key]=true;
  c.recalc();p.hp=D.life;p.atkCd=999;
  return {c,G,D,p};
}
function foe(o,{kind='norm',x=50,y=0,armor=0,hp=1e9}={}){
  const e=o.c.spawnEnemy();e.kind=kind;e.x=x;e.y=y;e.spd=0;e.dmg=0;e.armor=armor;
  e.maxHp=e.hp=hp;e.aff=[];e.roles=[];e.pack=null;return e;
}

console.log('СЕРДЦЕ СЕКУНДЫ');
{
  const o=mk('heartSecond');
  for(let i=0;i<60;i++) o.c.update(DT);
  ok('секунда без движения даёт ровно +10% скорости атаки',Math.abs(o.p.heartSecondCharge-0.10)<1e-8);
  for(let i=0;i<360;i++) o.c.update(DT);
  ok('заряд стойки ограничен +60%',Math.abs(o.p.heartSecondCharge-0.60)<1e-8);
  ok('заряд ускоряет фактический откат атаки на накопленный процент',
    Math.abs(o.c.currentAttackCooldown()-o.D.atkCd/1.60)<1e-9);
  o.G.keys.d=true;for(let i=0;i<60;i++)o.c.update(DT);
  ok('движение отнимает 25% заряда в секунду',Math.abs(o.p.heartSecondCharge-0.35)<1e-7);
  const before=o.p.x; o.c.update(0.05);
  ok('при любом заряде скорость бега снижена на 25%',Math.abs((o.p.x-before)/0.05-o.D.mspd*0.75)<1e-6);
  o.p.dashN=1;o.p.dash=0;o.c.tryDash();
  ok('рывок полностью очищает заряд',o.p.heartSecondCharge===0);
  ok('Сердце всегда присутствует в разделе индикаторов',o.c.activeCombatBuffs(o.p).some(x=>/Сердце секунды|Heart of the Second/.test(x)));
}

console.log('РУКИ ТИТАНА');
{
  const plain=mk([], 'blade'), titan=mk('titansHands','blade');
  ok('Руки Титана входят только в пул Воина',plain.c.findDropPools().pool.includes('titansHands')&&!mk([],'bow').c.findDropPools().pool.includes('titansHands'));
  ok('скорость ближней атаки уменьшается ровно на 35%',Math.abs(titan.D.aspd/plain.D.aspd-0.65)<1e-9);
}
{
  const o=mk('titansHands');o.D.critCh=0;o.p.aim=0;
  const main=foe(o,{x:50}),near=foe(o,{x:50,y:70,armor:90});
  const mh=main.hp,nh=near.hp;o.c.attack();
  const dealt=mh-main.hp,wave=nh-near.hp,expected=o.c.mitigate(near,dealt*0.60);
  ok('каждый взмах выпускает волну на 60% прошедшего урона основной цели',Math.abs(wave-expected)<1e-7,dealt.toFixed(2)+' / '+wave.toFixed(2));
  ok('основная цель исключена из собственной волны',Math.abs(dealt-(mh-main.hp))<1e-9);
  ok('соседняя цель отдельно применяет свою броню',wave<dealt*0.60);
  ok('волна не создаёт рекурсивную новую волну',o.G.fx.filter(x=>x.t==='ring'&&x.col==='#ff8b3d').length===1);
}

console.log('ШАГ ЗА ГРАНЬ');
{
  const base=mk(),o=mk('stepBeyond');
  ok('восстановление заряда рывка работает на 50% медленнее',Math.abs(o.D.dashCd/base.D.dashCd-2)<1e-9);
  o.p.dashN=1;o.c.tryDash();
  ok('успешный рывок заряжает следующую обычную атаку',o.p.stepBeyondReady);
  const e=foe(o);o.p.aim=0;o.p.dash=0;const hp=e.hp;o.c.attack();const first=hp-e.hp;
  ok('обычная атака расходует заряд и ставит эхо на 0,1 сек',!o.p.stepBeyondReady&&o.G.stepBeyondEchoes.length===1);
  o.c.update(0.09);const before=e.hp;o.c.update(0.02);const echo=before-e.hp;
  ok('эхо не приходит раньше 0,1 сек и повторяет 100% урона',before===hp-first&&Math.abs(echo-first)<1e-7,first.toFixed(2)+' / '+echo.toFixed(2));
  ok('эхо не создаёт другое эхо',o.G.stepBeyondEchoes.length===0);
}
{
  const o=mk('stepBeyond');o.D.critCh=100;o.D.igniteCh=100;o.p.dashN=1;o.c.tryDash();o.p.dash=0;
  const e=foe(o);o.p.aim=0;o.c.attack();const crits=o.G.stats.crits,hits=o.p.hitN;
  Object.assign(e.dots.fire,{dps:0,minionDps:0,n:0});
  o.c.update(0.11);
  ok('эхо не критует и не двигает предметный счётчик попаданий',o.G.stats.crits===crits&&o.p.hitN===hits);
  ok('эхо не накладывает и не усиливает статусы',e.dots.fire.dps===0);
}

console.log('МАРШ МЁРТВЫХ');
{
  const base=mk([],'necro'),o=mk('marchDead','necro');
  ok('Марш Мёртвых входит только в пул Некроманта',base.c.findDropPools().pool.includes('marchDead')&&!mk().c.findDropPools().pool.includes('marchDead'));
  ok('скорость героя снижена ровно на 30%',Math.abs(o.D.mspd/base.D.mspd-0.70)<1e-9);
  ok('скорость движения свиты повышена ровно на 80%',Math.abs(o.D.minSpd/base.D.minSpd-1.80)<1e-9);
  ok('скорость атаки свиты не меняется',Math.abs(o.D.minAspd/base.D.minAspd-1)<1e-9);
  ok('свита помечена невосприимчивой к замедлению',o.D.minSlowImmune===true);
  if(!o.G.minions.length)o.c.spawnMinion();const m=o.G.minions[0];m.stunT=1;o.c.recalc();
  ok('Марш не снимает оглушение со свиты',m.stunT===1);
}

console.log('КОЛЬЦО НУЛЕВОЙ ДИСТАНЦИИ');
{
  const mage=mk([],'wand'),warrior=mk();
  ok('Кольцо Нулевой Дистанции входит только в пул Мага',mage.c.findDropPools().pool.includes('zeroDistanceRing')&&!warrior.c.findDropPools().pool.includes('zeroDistanceRing'));
}
{
  const o=mk('zeroDistanceRing','wand');o.p.aim=0;
  const radius=o.G.weapon.aoe*o.D.aoeR*1.60,e=foe(o,{x:radius-2});const hp=e.hp;
  o.c.attack();
  ok('обычная сфера сразу взрывается вокруг героя',e.hp<hp&&o.G.shots.length===0);
  ok('радиус взрыва увеличен ровно на 60%',o.G.fx.some(f=>f.t==='mageOrbExplosion'&&Math.abs(f.r-radius)<1e-9));
}
{
  const base=mk([],'wand'),ring=mk('zeroDistanceRing','wand');
  const eb=foe(base,{x:10}),er=foe(ring,{x:10});
  const hb=eb.hp,hr=er.hp;base.c.explodePlayerOrb({x:0,y:0,orb:true,hitSet:[]});ring.c.spawnPlayerShot(ring.p,0,ring.G.weapon,false);
  ok('урон взрыва увеличен ровно на 35%',Math.abs((hr-er.hp)/(hb-eb.hp)-1.35)<1e-7);
  const mini=foe(ring,{x:20}),before=mini.hp;ring.c.spawnPlayerShot(ring.p,0,ring.G.weapon,true);
  ok('мини-сферы также детонируют немедленно без снаряда',mini.hp<before&&ring.G.shots.length===0);
  ring.D.arcanePull=100;const pulled=foe(ring,{x:100});ring.c.spawnPlayerShot(ring.p,0,ring.G.weapon,false);
  ok('притяжение исходит от позиции героя',pulled.kb.x<0);
}

console.log('ПЕРЕВЁРНУТАЯ КОРОНА');
{
  const base=mk(),o=mk('invertedCrown');
  const pb=base.c.spawnPack(10),pc=o.c.spawnPack(10);
  ok('каждая элитная пачка получает ещё трёх врагов',pc.members.length===pb.members.length+3);
  ok('дополнительные элиты сохраняют обычные награды',pc.members.every(e=>e.kind==='elite'&&e.xp>0&&!e.noLoot));
  const eb=base.c.spawnEnemy(),ec=o.c.spawnEnemy();
  ok('будущие враги получают +15% max HP',ec.maxHp===Math.round(eb.maxHp*1.15),eb.maxHp+' / '+ec.maxHp);
}
{
  const o=mk();const e=foe(o,{hp:1000});e.maxHp=1000;e.hp=400;o.c.takeAmulet('invertedCrown',true);
  ok('текущие враги получают +15% HP с сохранением заполнения',e.maxHp===1150&&e.hp===460);
  const pools=o.c.findDropPools(),normal=o.c.findDropBalance(pools,{kind:'norm'}),major=o.c.findDropBalance(pools,{kind:'elite'});
  ok('фактический вес предметов с элит повышен ровно на 40%',Math.abs(major.rate*major.itemShare/(normal.rate*normal.itemShare)-1.40)<1e-9);
  const common=[...new Set(pools.pool)].find(k=>o.c.__api.AMULETS[k].rar===0);
  const upgraded=o.c.upgradeInvertedCrownDrop(common,pools.pool,0);
  ok('20%-прок заменяет предмет на доступный предмет следующей редкости',o.c.__api.AMULETS[upgraded].rar===1);
  ok('легендарную редкость повысить нельзя',o.c.upgradeInvertedCrownDrop('archivist',pools.pool,0)==='archivist');
}

console.log('АРХИВАРИУС');
{
  const o=mk('archivist');o.c.takeBook('fire',true);
  ok('первая найденная книга сразу получает второй тир',o.G.items.fire.tier===2);
  o.c.takeBook('fire',true);
  ok('каждая следующая находка книги также добавляет два тира',o.G.items.fire.tier===4);
}
{
  const base=mk(),o=mk('archivist');base.G.items.fire={tier:1,val:1};o.G.items.fire={tier:1,val:1};base.c.recalc();o.c.recalc();
  const pb=base.c.findDropPools(),po=o.c.findDropPools(),bb=base.c.findDropBalance(pb),bo=o.c.findDropBalance(po);
  const actual=(b)=>({item:b.rate*b.itemShare,totem:b.rate*b.totemShare,book:b.rate*(1-b.itemShare-b.totemShare)});
  const a=actual(bb),z=actual(bo);
  ok('вес выпадения книг после Архивариуса уменьшается вдвое',Math.abs(z.book/a.book-0.5)<1e-9);
  ok('вес выпадения тотемов после Архивариуса уменьшается вдвое',Math.abs(z.totem/a.totem-0.5)<1e-9);
  ok('вес предметов Архивариус не изменяет',Math.abs(z.item/a.item-1)<1e-9);
}

console.log(JSON.stringify({n,fail}));
if(fail)process.exitCode=1;
