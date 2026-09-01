/* Массовые атаки Воина: одна дистанция на цель, прежние границы и порядок. */
const {loadGame}=require('./sim');
const fs=require('fs');
let n=0,fail=0;
const ok=(name,cond,detail='')=>{n++;if(!cond)fail++;console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(72)+detail);};
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=(x,y,r=10)=>({x,y,r,hp:1000,maxHp:1000,dead:false});
function fresh(){const c=loadGame('./GrimGrind.html');c.newGame('blade','keys');const G=c.__api.G;G.enemies=[];G.spawnQueue=0;G.packs=[];return{c,G,D:c.__api.D,p:G.player};}
function foe(c,x,y,r=10){const e=c.spawnEnemy('blob');e.x=x;e.y=y;e.r=r;e.spd=0;e.hp=e.maxHp=1000;e.dead=false;return e;}
function sectorAccept(o,reach,arc,ang){return(e,dist)=>{if(dist>reach+e.r)return false;let da=Math.atan2(e.y-o.y,e.x-o.x)-ang;da=Math.atan2(Math.sin(da),Math.cos(da));return Math.abs(da)<arc/2;};}

{
  const {c,G}=fresh(),o=point(0,0),a=point(30,0),b=point(10,0),x=point(20,0);
  G.enemies=[a,b,x];
  ok('пустой набор массовых целей остаётся пустым',c.sortedEnemyTargets(o,[]).length===0);
  const all=c.sortedEnemyTargets(o);
  ok('по умолчанию обрабатывается весь G.enemies',all.length===3);
  ok('массовые цели сортируются по расстоянию',all[0]===b&&all[1]===x&&all[2]===a);
  const subset=c.sortedEnemyTargets(o,[a,x]);
  ok('явный набор кандидатов строго соблюдается',subset.length===2&&subset[0]===x&&subset[1]===a);
  const filtered=c.sortedEnemyTargets(o,G.enemies,(e,dist)=>e!==x&&dist<=30);
  ok('предикат получает цель и сохранённую дистанцию',filtered.length===2&&filtered[0]===b&&filtered[1]===a);
  let calls=0;c.sortedEnemyTargets(o,G.enemies,()=>{calls++;return true;});
  ok('предикат вызывается ровно один раз на кандидата',calls===G.enemies.length);
  const t1=point(10,0),t2=point(-10,0),t3=point(0,10);G.enemies=[t1,t2,t3];
  const ties=c.sortedEnemyTargets(o);
  ok('равная дистанция сохраняет порядок G.enemies',ties[0]===t1&&ties[1]===t2&&ties[2]===t3);
  ok('сортировка не изменяет исходный массив',G.enemies[0]===t1&&G.enemies[1]===t2&&G.enemies[2]===t3);
}

{
  const {c,G}=fresh();G.enemies=Array.from({length:500},(_,i)=>point((i*73)%2800-1400,(i*151)%2800-1400,6+i%15));
  let waveSame=true,sectorSame=true;
  for(let q=0;q<160;q++){
    const o=point((q*97)%2200-1100,(q*181)%2200-1100),range=70+(q%11)*25;
    const oldWave=G.enemies.map((e,i)=>[d(e,o),i,e]).filter(x=>x[0]<=range+x[2].r).sort((a,b)=>a[0]-b[0]).map(x=>x[2]);
    const fastWave=c.sortedEnemyTargets(o,G.enemies,(e,dist)=>dist<=range+e.r);
    if(oldWave.length!==fastWave.length||oldWave.some((e,i)=>e!==fastWave[i]))waveSame=false;
    const arc=0.7+(q%7)*0.2,ang=(q%12)*Math.PI/6-Math.PI;
    const accept=sectorAccept(o,range,arc,ang);
    const oldSector=G.enemies.map((e,i)=>[d(e,o),i,e]).filter(x=>accept(x[2],x[0])).sort((a,b)=>a[0]-b[0]).map(x=>x[2]);
    const fastSector=c.sortedEnemyTargets(o,G.enemies,accept);
    if(oldSector.length!==fastSector.length||oldSector.some((e,i)=>e!==fastSector[i]))sectorSame=false;
  }
  ok('160 круговых волн по 500 врагам совпадают со старым алгоритмом',waveSame);
  ok('160 секторных ударов по 500 врагам совпадают со старым алгоритмом',sectorSame);
}

{
  const {c,G}=fresh(),o=point(0,0),reach=100,edge=point(110,0,10),outside=point(110.001,0,10);
  G.enemies=[edge,outside];
  let got=c.sortedEnemyTargets(o,G.enemies,(e,dist)=>dist<=reach+e.r);
  ok('круговая волна сохраняет включительную внешнюю границу',got.length===1&&got[0]===edge);
  ok('круговая волна не задевает цель за границей на 0,001',!got.includes(outside));
  got=c.sortedEnemyTargets(o,G.enemies,sectorAccept(o,reach,Math.PI/2,0));
  ok('сектор сохраняет включительную радиальную границу',got.length===1&&got[0]===edge);
  ok('сектор не задевает цель за радиальной границей',!got.includes(outside));
  const angleEdge=point(0,50),angleInside=point(Math.cos(Math.PI/2-1e-6)*50,Math.sin(Math.PI/2-1e-6)*50);
  G.enemies=[angleEdge,angleInside];got=c.sortedEnemyTargets(o,G.enemies,sectorAccept(o,100,Math.PI,0));
  ok('угловая граница сектора остаётся строгой',!got.includes(angleEdge));
  ok('цель непосредственно внутри угла попадает',got.includes(angleInside));
  const wrap=point(Math.cos(-Math.PI+0.01)*50,Math.sin(-Math.PI+0.01)*50);G.enemies=[wrap];
  got=c.sortedEnemyTargets(o,G.enemies,sectorAccept(o,100,0.1,Math.PI-0.01));
  ok('нормализация угла через ±π сохранена',got[0]===wrap);
  const a=point(Math.cos(-0.5)*50,Math.sin(-0.5)*50),b=point(Math.cos(0.5)*50,Math.sin(0.5)*50);G.enemies=[a,b];
  got=c.sortedEnemyTargets(o,G.enemies,sectorAccept(o,100,1.5,0));
  ok('равноудалённые цели сектора сохраняют исходный порядок',got[0]===a&&got[1]===b);
  got=c.sortedEnemyTargets(o,G.enemies,(e,dist)=>dist<=100+e.r);
  ok('равноудалённые цели волны сохраняют исходный порядок',got[0]===a&&got[1]===b);
}

{
  const {c,G,p}=fresh(),front=foe(c,50,0),back=foe(c,-50,0);p.x=p.y=0;p.aim=0;p.bladeN=2;c.attack();
  ok('реальная третья волна по-прежнему поражает цель спереди и сзади',front.hp<1000&&back.hp<1000);
}

{
  const {c,G,p}=fresh(),front=foe(c,50,0),back=foe(c,-50,0);p.x=p.y=0;p.aim=0;p.bladeN=0;c.attack();
  ok('реальный сектор по-прежнему поражает только цель перед Воином',front.hp<1000&&back.hp===1000);
}

{
  const html=fs.readFileSync('./GrimGrind.html','utf8');
  ok('helper сохраняет дистанцию рядом с целью до сортировки',/found\.push\(\[d,e\]\)[\s\S]{0,80}found\.sort\(\(a,b\)=>a\[0\]-b\[0\]\)/.test(html));
  ok('круговая волна использует единый кэшированный путь',/waveTargets=sortedEnemyTargets\(o,G\.enemies,\(e,d\)=>d<=waveR\+e\.r\)/.test(html));
  ok('сектор больше не пересчитывает дистанцию в comparator',/swingTargets=sortedEnemyTargets\(o,G\.enemies,\(e,d\)=>\{/.test(html)&&!/swingTargets\.sort/.test(html));
}

console.log(JSON.stringify({n,fail}));
if(fail)process.exitCode=1;
