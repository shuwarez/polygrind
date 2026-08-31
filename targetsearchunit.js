/* Поиск ближайших целей: короткий top-k без полной сортировки толпы. */
const {loadGame}=require('./sim');
const fs=require('fs');
let n=0,fail=0;
const ok=(name,cond,detail='')=>{n++;if(!cond)fail++;console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(72)+detail);};
function fresh(){const c=loadGame('./PolyGrind.html');c.newGame('bow','keys','hunter');const G=c.__api.G;G.enemies=[];G.shots=[];G.spawnQueue=0;return{c,G,D:c.__api.D};}
function point(x,y,hp=100){return{x,y,r:10,hp,maxHp:hp,dead:false};}
function foe(c,x,y,hp=1000){const e=c.spawnEnemy('blob');e.x=x;e.y=y;e.r=10;e.spd=0;e.hp=e.maxHp=hp;e.dead=false;return e;}
function shot(hitSet=[]){return{x:0,y:0,vx:600,vy:0,r:5,life:1,hitSet:hitSet.slice(),mul:1,pierced:0,ricochetReleased:false,spriteType:'arrow'};}

{
  const {c,G}=fresh(),from=point(0,0),a=point(30,0),b=point(10,0),d=point(20,0);
  G.enemies=[a,b,d];
  ok('нулевой top-k возвращает пустой список',c.nearestEnemies(from,0).length===0);
  ok('отрицательный top-k возвращает пустой список',c.nearestEnemies(from,-3).length===0);
  ok('запрос больше списка возвращает все цели',c.nearestEnemies(from,9).length===3);
  const sorted=c.nearestEnemies(from,3);
  ok('цели отсортированы по возрастанию расстояния',sorted[0]===b&&sorted[1]===d&&sorted[2]===a);
  ok('top-1 возвращает только абсолютного ближайшего',c.nearestEnemies(from,1)[0]===b);
  const filtered=c.nearestEnemies(from,3,e=>e!==d);
  ok('предикат исключает неподходящие цели',filtered.length===2&&filtered[0]===b&&filtered[1]===a);
  const subset=c.nearestEnemies(from,3,null,[a,d]);
  ok('явный набор кандидатов ограничивает поиск',subset.length===2&&subset[0]===d&&subset[1]===a);
}

{
  const {c,G}=fresh(),from=point(0,0),a=point(10,0),b=point(-10,0),d=point(0,10);
  G.enemies=[a,b,d];
  const got=c.nearestEnemies(from,2);
  ok('равная дистанция сохраняет исходный порядок врагов',got[0]===a&&got[1]===b);
  ok('ограничение top-k не вытесняет раннюю цель при равенстве',!got.includes(d));
}

{
  const {c,G}=fresh();
  G.enemies=Array.from({length:500},(_,i)=>point((i*73)%2800-1400,(i*151)%2800-1400,i%13===0?0:100));
  let same=true;
  for(let q=0;q<120;q++){
    const from=point((q*97)%2400-1200,(q*181)%2400-1200),count=1+q%20;
    const accept=(e,d)=>e.hp>0&&d<(150+q%9*70);
    const old=G.enemies.map((e,i)=>[Math.hypot(e.x-from.x,e.y-from.y),i,e]).filter(x=>accept(x[2],x[0]))
      .sort((a,b)=>a[0]-b[0]).slice(0,count).map(x=>x[2]);
    const fast=c.nearestEnemies(from,count,accept);
    if(old.length!==fast.length||old.some((e,i)=>e!==fast[i])){same=false;break;}
  }
  ok('120 запросов по 500 врагам совпадают со стабильной полной сортировкой',same);
}

{
  const {c,G}=fresh(),from=point(0,0);
  G.enemies=Array.from({length:500},(_,i)=>point((i%25)*115-1380,Math.floor(i/25)*135-1280));
  const grid=c.buildEnemySpatialGrid(G.enemies,true),range=450;
  const local=c.enemyAreaCandidates(grid,from.x,from.y,range);
  const accept=(e,d)=>d<=range;
  const full=c.nearestEnemies(from,3,accept),fast=c.nearestEnemies(from,3,accept,local);
  ok('локальная сетка даёт тот же top-3, что полный список',full.length===fast.length&&full.every((e,i)=>e===fast[i]));
  ok('локальный набор действительно меньше полной толпы',local.length<G.enemies.length);
  const added=point(1,0);G.enemies.push(added);c.addEnemyToSpatialGrid(grid,added);
  ok('динамически добавленная цель сразу становится ближайшей',c.nearestEnemies(from,1,accept,c.enemyAreaCandidates(grid,0,0,range))[0]===added);
}

{
  const {c,G}=fresh(),src=point(0,0),dead=point(1,0),zero=point(2,0,0),a=point(10,0),b=point(-10,0),far=point(30,0);
  dead.dead=true;G.enemies=[src,dead,zero,a,b,far];
  const got=c.nearestLivingEnemies(src,2);
  ok('nearestLiving исключает исходную цель',!got.includes(src));
  ok('nearestLiving исключает помеченную мёртвую цель',!got.includes(dead));
  ok('nearestLiving исключает цель с нулевым HP',!got.includes(zero));
  ok('nearestLiving выбирает ровно требуемые две цели',got.length===2&&got[0]===a&&got[1]===b);
}

{
  const {c,G,D}=fresh(),src=foe(c,0,0),inside=foe(c,399.999,0),edge=foe(c,400,0);
  D.shockR=400;D.ailEff=1;
  c.shockBurst(src,100,0);
  ok('разряд сохраняет строгую границу: цель на 400 не попадает',edge.hp===1000);
  ok('разряд поражает цель непосредственно внутри границы',inside.hp<1000);
}

{
  const {c,G,D}=fresh(),src=foe(c,0,0),targets=[];D.shockR=400;D.ailEff=1;
  for(let i=0;i<6;i++)targets.push(foe(c,20+i*20,0));
  c.shockBurst(src,100,0);
  ok('обычный разряд по-прежнему ограничен пятью целями',targets.filter(e=>e.hp<1000).length===5);
}

{
  const {c,G,D}=fresh(),src=foe(c,0,0),ties=[];D.shockR=400;D.ailEff=1;
  for(let i=0;i<6;i++)ties.push(foe(c,100*Math.cos(i*Math.PI/3),100*Math.sin(i*Math.PI/3)));
  c.shockBurst(src,100,0);
  ok('при равной дальности шок сохраняет порядок G.enemies',ties.slice(0,5).every(e=>e.hp<1000)&&ties[5].hp===1000);
}

{
  const {c,G}=fresh();G.bag.add('ricochet','flat',3);c.recalc();
  const hit=foe(c,0,0),a=foe(c,100,0),b=foe(c,-100,0),d=foe(c,0,100),edge=foe(c,450,0),outside=foe(c,450.001,0),s=shot([hit]);
  const grid=c.buildEnemySpatialGrid(),made=c.releaseRicochetShards(s,1,1,grid);
  ok('рикошет с сеткой выпускает не больше трёх осколков',made===3&&G.shots.length===3);
  ok('равные цели рикошета сохраняют исходный порядок',G.shots[0].shardTarget===a&&G.shots[1].shardTarget===b&&G.shots[2].shardTarget===d);
  ok('грубая сетка не выбирает цель за точной границей',!G.shots.some(x=>x.shardTarget===outside));
  const s2=shot([hit,a,b,d]);G.shots=[];c.releaseRicochetShards(s2,1,1,grid);
  ok('точная граница рикошета 450 остаётся включительной',G.shots[0]&&G.shots[0].shardTarget===edge);
}

{
  const {c,G}=fresh(),a=foe(c,10,0),b=foe(c,-10,0);G.sparkSigils=[{x:0,y:0,life:0,max:0.4}];
  c.tickSparkSigils(0);
  ok('сигил при равной дальности поражает первую цель',a.hp<1000&&b.hp===1000);
}

{
  const {c,G,D}=fresh();G.bag.add('hunterMark','flag',1);c.recalc();G.time=10;
  const a=foe(c,0,0),b=foe(c,10,0),next=foe(c,20,0);a.hunterMarkUntil=12;b.hunterMarkUntil=13;
  c.markHunterTarget(next);
  ok('третья метка линейно снимает действительно старейшую',a.hunterMarkUntil===0&&b.hunterMarkUntil===13&&next.hunterMarkUntil===14);
  a.hunterMarkUntil=12;b.hunterMarkUntil=12;next.hunterMarkUntil=0;c.markHunterTarget(next);
  ok('при одинаковом сроке меток снимается первая в G.enemies',a.hunterMarkUntil===0&&b.hunterMarkUntil===12);
}

{
  const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('поиски top-k больше не сортируют полный список врагов',!/nearestLivingEnemies[\s\S]{0,180}\.sort|shockBurst[\s\S]{0,700}\.sort|tickSparkSigils[\s\S]{0,350}\.sort/.test(html));
  ok('главный цикл передаёт готовую сетку рикошету',/releaseRicochetShards\(s,hitMul,s\.attackMul,enemyGrid\)/.test(html));
}

console.log(JSON.stringify({n,fail}));
if(fail)process.exitCode=1;
