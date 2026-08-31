/* Шаг 11: точность безаллокционной ауры и устойчивость 500 врагов + 20 бойцов. */
const {loadGame}=require('./sim');
const fs=require('fs'),{performance}=require('perf_hooks');
let n=0,fail=0;
const ok=(name,cond,detail='')=>{n++;if(!cond)fail++;console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(84)+detail);};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fresh(){const c=loadGame('./PolyGrind.html',{random:()=>0.5});c.newGame('necro','keys');const G=c.__api.G;G.enemies=[];G.minions=[];G.spawnQueue=0;G.packs=[];return{c,G,D:c.__api.D,p:G.player};}
function foe(o,x,y){const e=o.c.spawnEnemy('blob');e.x=x;e.y=y;e.spd=0;e.dmg=0;e.hp=e.maxHp=1e12;e.dead=false;e.armor=0;e.ward=null;e.bulwark=0;return e;}

{
  const o=fresh(),sources=[];
  for(let i=0;i<500;i++){const e=foe(o,(i%25)*103-1236,Math.floor(i/25)*117-1110);if(i%7===0){e.ail.chill=10;sources.push(e);}}
  const grid=o.c.buildEnemySpatialGrid(sources,true),old=e=>sources.some(s=>s!==e&&dist(s,e)<=o.D.chillAuraR+e.r);
  let same=true;for(const e of o.G.enemies)if(o.c.chillAuraAffectsEnemy(e,grid)!==old(e)){same=false;break;}
  ok('500 целей получают тот же результат ауры, что при полном переборе',same);
  for(let i=0;i<sources.length;i+=3){sources[i].x+=211;sources[i].y-=149;o.c.updateEnemySpatialGridPosition(grid,sources[i]);}
  same=true;for(const e of o.G.enemies)if(o.c.chillAuraAffectsEnemy(e,grid)!==old(e)){same=false;break;}
  ok('после перемещения источников безаллокционный поиск остаётся эквивалентным',same);
  const target=foe(o,0,0),edge=foe(o,o.D.chillAuraR+target.r,0),outside=foe(o,o.D.chillAuraR+target.r+0.001,0);
  edge.ail.chill=outside.ail.chill=10;let one=o.c.buildEnemySpatialGrid([edge],true);
  ok('точное касание внешней границы ауры включительно',o.c.chillAuraAffectsEnemy(target,one)===true);
  one=o.c.buildEnemySpatialGrid([outside],true,one);
  ok('выход за границу на 0,001 исключается',o.c.chillAuraAffectsEnemy(target,one)===false);
  one=o.c.buildEnemySpatialGrid([target],true,one);
  ok('единственный источник не считает соседом самого себя',o.c.chillAuraAffectsEnemy(target,one)===false);
  const cells=one.cells.size,order=one.order.size,pool=one.cellPool.length;
  for(let i=0;i<10000;i++)o.c.chillAuraAffectsEnemy(target,one);
  ok('10 000 запросов не меняют структуру пространственной сетки',one.cells.size===cells&&one.order.size===order&&one.cellPool.length===pool);
}

{
  const html=fs.readFileSync('./PolyGrind.html','utf8'),body=(html.match(/function chillAuraAffectsEnemy\(e,chillGrid\)\{[\s\S]*?\n\}/)||[''])[0];
  ok('горячая проверка ауры больше не вызывает enemySpatialCandidates',body.length>0&&!body.includes('enemySpatialCandidates'));
  ok('горячая проверка ауры не создаёт временных массивов и сортировок',!body.includes('[]')&&!body.includes('.sort(')&&!body.includes('.filter('));
}

{
  const o=fresh(),{c,G,D,p}=o;G.weapon.noAttack=true;p.inv=1e9;p.x=p.y=0;
  D.maxSkel=6;D.maxHunt=6;D.maxWarl=6;D.golemB=10;D.golemN=10;D.minMax=20;D.inferno=false;
  for(let i=0;i<500;i++){const a=i*2.399963229728653,r=170+(i%22)*21,e=foe(o,Math.cos(a)*r,Math.sin(a)*r);e.spd=42+(i%5)*8;e.ail.chill=i%9===0?1e6:0;}
  const kinds=['golemB','golemN',...Array(6).fill('skeleton'),...Array(6).fill('hunter'),...Array(6).fill('warlock')];
  for(let i=0;i<kinds.length;i++){c.spawnMinion(Math.cos(i)*55,Math.sin(i)*55,kinds[i]);const m=G.minions.at(-1);m.deathT=1e9;m.hp=m.max=Math.max(1,m.max||m.hp||1);}
  G.fx=[];G.parts=[];
  for(let i=0;i<120;i++){for(const m of G.minions)m.tgt=null;c.update(1/60);}
  if(!G.frameScratch.postMoveGrid){c.getPostMoveEnemyGrid();c.releasePostMoveEnemyGrid();}
  const scratch=G.frameScratch,chillGrid=scratch.chillGrid,postGrid=scratch.postMoveGrid;
  const chillCells=chillGrid.cellPool.slice(),candidateEntries=scratch.minionCandidatePool.slice(),heap0=global.gc?(global.gc(),process.memoryUsage().heapUsed):0;
  const times=[];
  for(let i=0;i<480;i++){
    for(const m of G.minions)m.tgt=null;
    const t=performance.now();c.update(1/60);times.push(performance.now()-t);
  }
  const heap1=global.gc?(global.gc(),process.memoryUsage().heapUsed):0;
  const sorted=times.slice().sort((a,b)=>a-b),mean=times.reduce((a,b)=>a+b,0)/times.length,p95=sorted[Math.floor(sorted.length*0.95)];
  ok('долгий сценарий сохраняет все 500 живых врагов',G.enemies.length===500&&G.enemies.every(e=>!e.dead));
  ok('полная свита сохраняет двадцать бойцов',G.minions.length===20);
  ok('в составе остаются все пять типов приспешников',new Set(G.minions.map(m=>m.kind)).size===5);
  ok('объект сетки охлаждения повторно используется весь прогон',scratch.chillGrid===chillGrid);
  ok('сетка охлаждения очищена после последнего кадра',chillGrid.cells.size===0&&chillGrid.order.size===0);
  ok('ранее созданные ячейки охлаждения остаются в пуле',chillCells.every(cell=>chillGrid.cellPool.includes(cell)));
  ok('пул кандидатов свиты не растёт выше числа врагов',scratch.minionCandidatePool.length<=500);
  ok('записи целей переиспользуются по идентичности',candidateEntries.every((entry,i)=>scratch.minionCandidatePool[i]===entry));
  ok('освобождённые записи целей не удерживают врагов',scratch.minionCandidatePool.every(entry=>entry.e===null));
  ok('карта распределения целей очищена после кадра',scratch.minionClaims.size===0);
  ok('post-move сетка повторно используется свитой и снарядами',scratch.postMoveGrid===postGrid);
  ok('post-move сетка не удерживает врагов после кадра',postGrid.cells.size===0&&postGrid.order.size===0&&!scratch.postMoveReady);
  ok('лимиты временных эффектов выдержаны под нагрузкой',G.parts.length<=320&&G.partPool.length<=320&&G.fxPool.length<=512);
  ok('после GC долгий прогон не удерживает заметно растущий heap',!global.gc||heap1-heap0<8*1048576,global.gc?'дельта '+((heap1-heap0)/1048576).toFixed(2)+' МБ':'проверяется в отдельном --expose-gc прогоне');
  ok('480 тяжёлых кадров рассчитаны без патологической задержки',Number.isFinite(mean)&&mean<30,`среднее ${mean.toFixed(2)} мс · p95 ${p95.toFixed(2)} мс`);
  console.log('STRESS '+JSON.stringify({frames:480,enemies:G.enemies.length,minions:G.minions.length,meanMs:+mean.toFixed(3),p95Ms:+p95.toFixed(3),heapDeltaMb:global.gc?+((heap1-heap0)/1048576).toFixed(2):null}));
}

console.log(JSON.stringify({n,fail}));
if(fail)process.exitCode=1;
