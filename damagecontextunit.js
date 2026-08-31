/* Снимок условий одной атаки: Осколок, Дуэль, соседи и gated-замедление. */
const {loadGame}=require('./sim');
const fs=require('fs');
const vm=require('vm');
let n=0,fail=0;
const ok=(name,cond,detail='')=>{n++;if(!cond)fail++;console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(78)+detail);};
function fresh(amus=[],random=()=>0.99){
  const c=loadGame('./PolyGrind.html',{random});c.newGame('bow','keys');
  const G=c.__api.G;G.enemies=[];G.spawnQueue=0;G.packs=[];
  for(const key of amus)G.amu[key]=true;
  c.recalc();return{c,G,D:c.__api.D,p:G.player};
}
function foe(o,x,y,kind='norm',dead=false){
  const e=o.c.spawnEnemy('blob');e.x=x;e.y=y;e.kind=kind;e.dead=dead;
  e.hp=e.maxHp=1e12;e.armor=0;e.ward=null;e.bulwark=0;e.spd=0;e.dmg=0;return e;
}
function countIterations(G){
  let iterations=0;const source=G.enemies;
  G.enemies=new Proxy(source,{get(target,key,receiver){
    if(key===Symbol.iterator)return function*(){iterations++;yield* target;};
    return Reflect.get(target,key,receiver);
  }});
  return()=>iterations;
}

{
  const o=fresh(),s=o.c.damageConditionSnapshot(o.p);
  ok('без подходящих эффектов снимок полностью нулевой',s.damageBossShardInc===0&&!s.damageDuelActive&&s.damageNearbyCount===0);
}

{
  const o=fresh(['bossShard','duel']);o.G.bag.add('perNear','inc',3);o.c.recalc();
  foe(o,100,0,'elite');foe(o,180,0);foe(o,260,0);
  const s=o.c.damageConditionSnapshot(o.p);
  ok('единый снимок считает Осколок босса',s.damageBossShardInc===5,'+'+s.damageBossShardInc+'%');
  ok('единый снимок считает соседей в радиусе 220',s.damageNearbyCount===2,'соседей '+s.damageNearbyCount);
  ok('Дуэль выключена при нескольких врагах в радиусе 300',s.damageDuelActive===false);
}

{
  const o=fresh(['duel']);foe(o,299.999,0);
  ok('граница Дуэли остаётся строгой: 299,999 входит',o.c.damageConditionSnapshot(o.p).damageDuelActive);
  o.G.enemies[0].x=300;
  ok('граница Дуэли остаётся строгой: ровно 300 не входит',!o.c.damageConditionSnapshot(o.p).damageDuelActive);
}

{
  const o=fresh(['bossShard']);foe(o,249.999,0,'elite');
  ok('граница Осколка остаётся строгой: 249,999 входит',o.c.damageConditionSnapshot(o.p).damageBossShardInc===5);
  o.G.enemies[0].x=250;
  ok('граница Осколка остаётся строгой: ровно 250 не входит',o.c.damageConditionSnapshot(o.p).damageBossShardInc===0);
}

{
  const o=fresh();o.G.bag.add('perNear','inc',1);o.c.recalc();foe(o,219.999,0);
  ok('граница соседей остаётся строгой: 219,999 входит',o.c.damageConditionSnapshot(o.p).damageNearbyCount===1);
  o.G.enemies[0].x=220;
  ok('граница соседей остаётся строгой: ровно 220 не входит',o.c.damageConditionSnapshot(o.p).damageNearbyCount===0);
}

{
  const o=fresh(['bossShard']);for(let i=0;i<14;i++)foe(o,20+i,0,'elite');
  ok('Осколок сохраняет потолок десяти элит',o.c.damageConditionSnapshot(o.p).damageBossShardInc===50);
}

{
  const o=fresh();o.G.bag.add('perNear','inc',1);o.c.recalc();for(let i=0;i<12;i++)foe(o,i,0);
  ok('бонус соседей сохраняет потолок восьми целей',o.c.damageConditionSnapshot(o.p).damageNearbyCount===8);
}

{
  const o=fresh(['bossShard','duel']);o.G.bag.add('perNear','inc',1);o.c.recalc();
  const dead=foe(o,40,0,'elite',true),s=o.c.damageConditionSnapshot(o.p);
  ok('Осколок по-прежнему учитывает ещё не удалённую мёртвую элиту',s.damageBossShardInc===5);
  ok('Дуэль по-прежнему видит ещё не удалённого врага',s.damageDuelActive===true);
  ok('бонус соседей по-прежнему исключает dead-цель',s.damageNearbyCount===0);
  dead.dead=false;dead.hp=0;
  ok('соседи сохраняют историческую проверку dead, а не hp',o.c.damageConditionSnapshot(o.p).damageNearbyCount===1);
}

{
  const o=fresh();o.G.bag.add('perNear','inc',2);o.c.recalc();
  const m={x:1000,y:0},near=foe(o,1050,0),far=foe(o,0,0);
  const s=o.c.damageConditionSnapshot(m);
  ok('снимок свиты считает соседей вокруг непосредственного бойца',s.damageNearbyCount===1&&near!==far);
}

{
  const o=fresh(['bossShard','duel']);o.G.bag.add('perNear','inc',2);o.c.recalc();
  foe(o,40,0,'elite');foe(o,500,0);const iterations=countIterations(o.G);
  o.c.damageConditionSnapshot(o.p);
  ok('три глобальных условия собираются одним обходом массива',iterations()===1,'обходов '+iterations());
}

{
  const o=fresh(),e=foe(o,50,0),iterations=countIterations(o.G);
  o.c.conditionalInc(e,{});
  ok('без карты урона по замедленным conditionalInc не обходит врагов',iterations()===0,'обходов '+iterations());
}

{
  const o=fresh();o.G.bag.add('vsSlowed','inc',7);o.c.recalc();const e=foe(o,50,0),src=foe(o,70,0);src.ail.chill=1;
  const iterations=countIterations(o.G),inc=o.c.conditionalInc(e,{});
  ok('с активной картой ледяная аура проверяется и даёт прежний бонус',inc===7&&iterations()===1,'обходов '+iterations());
}

{
  const setup=()=>{const o=fresh(['bossShard','duel']);o.G.bag.add('perNear','inc',3);o.c.recalc();const e=foe(o,80,0,'elite');return{...o,e};};
  const a=setup(),b=setup(),ha=a.e.hp,hb=b.e.hp;
  a.c.damage(a.e,{noProcs:true,noDouble:true});
  b.c.damage(b.e,{noProcs:true,noDouble:true,...b.c.damageConditionSnapshot(b.p)});
  ok('живой и переданный снимок дают идентичный фактический урон',Math.abs((ha-a.e.hp)-(hb-b.e.hp))<1e-9);
}

{
  const o=fresh(['bossShard','duel']);o.G.bag.add('perNear','inc',1);o.c.recalc();const e=foe(o,80,0,'elite');
  const iterations=countIterations(o.G);o.c.damage(e,{noProcs:true,noDouble:true});
  ok('одиночный damage консолидирует свои глобальные условия в один обход',iterations()===1,'обходов '+iterations());
}

{
  const o=fresh(['bossShard','duel'],()=>0);o.G.bag.add('perNear','inc',1);o.c.recalc();o.D.dblHit=100;
  const e=foe(o,80,0,'elite'),iterations=countIterations(o.G);o.c.damage(e,{direct:true});
  ok('немедленное двойное попадание повторно использует снимок',iterations()===1,'обходов '+iterations());
}

{
  const o=fresh(['duel']),e=foe(o,80,0),s=o.c.damageConditionSnapshot(o.p);
  foe(o,120,0);
  ok('новая атака обновляет Дуэль после изменения окружения',s.damageDuelActive&&!o.c.damageConditionSnapshot(o.p).damageDuelActive);
}

{
  const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('Последний свидетель остаётся живой проверкой каждой конкретной цели',/if \(isLastWitnessTarget\(e,src\)\)/.test(html));
  ok('отложенное Эхо сбрасывает снимок изменяемого окружения',/damageBossShardInc:undefined,damageDuelActive:undefined,damageNearbyCount:undefined/.test(html));
  ok('двойное попадание переносит уже разрешённый снимок',/damageBossShardInc:damageConditions\.damageBossShardInc[\s\S]{0,160}damageNearbyCount:damageConditions\.damageNearbyCount/.test(html));
  ok('массовые удары Воина получают один снимок на взмах',(html.match(/\.\.\.damageConditions/g)||[]).length>=5);
  ok('снаряд получает снимок лениво только при первом столкновении',/if \(!shotDamageSnapshot\) shotDamageSnapshot=s\.minion[\s\S]{0,100}damageConditionSnapshot\(p\)/.test(html));
  ok('снимок снаряда передаётся всем попаданиям текущего кадра',/noEcho:!!s\.stepBeyondEcho,[\s\S]{0,80}\.\.\.shotDamageSnapshot/.test(html));
}

/* Замер выполняется внутри того же vm, что и игра: вызов функции через мост
   Node/vm сам по себе заметно дороже короткого игрового прохода и исказил бы результат. */
{
  const o=fresh(['bossShard','duel']);o.G.bag.add('perNear','inc',2);o.c.recalc();
  for(let i=0;i<500;i++)foe(o,(i%25)*20-240,Math.floor(i/25)*20-190,i%7===0?'elite':'norm');
  const bench=vm.runInContext(`(()=>{
    const oldConditions=()=>{
      for(const src of G.enemies){ if(src.dead||src.ail.chill<=0) continue; }
      let elites=0; for(const e of G.enemies) if(e.kind!=='norm'&&dist(e,G.player)<250&&++elites>=10) break;
      let duel=0; for(const e of G.enemies) if(dist(e,G.player)<300&&++duel>1) break;
      let nearby=0; for(const e of G.enemies) if(!e.dead&&dist(e,G.player)<220&&++nearby>=8) break;
      return elites+duel+nearby;
    };
    const currentConditions=()=>damageConditionSnapshot(G.player);
    const time=fn=>{let value;const start=Date.now();for(let i=0;i<100000;i++)value=fn();return Date.now()-start;};
    time(oldConditions);time(currentConditions);
    const median=fn=>Array.from({length:5},()=>time(fn)).sort((a,b)=>a-b)[2];
    const oldMs=median(oldConditions),newMs=median(currentConditions);
    return {queries:100000,oldMs,newMs,speedup:oldMs/newMs,reductionPct:(1-newMs/oldMs)*100};
  })()`,o.c);
  console.log('BENCH '+JSON.stringify(bench));
}

console.log(JSON.stringify({n,fail}));
if(fail)process.exitCode=1;
