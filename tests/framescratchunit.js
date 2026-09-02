/* Буферы кадра: повторное использование сеток, записей целей и малых результатов. */
const {loadGame}=require('./sim');
const fs=require('fs'),vm=require('vm'),{performance}=require('perf_hooks');
let n=0,fail=0;
const ok=(name,cond,detail='')=>{n++;if(!cond)fail++;console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(82)+detail);};
function fresh(hero='necro'){
  const c=loadGame('./index.html',{random:()=>0.5});c.newGame(hero,'keys');
  const G=c.__api.G;G.enemies=[];G.minions=[];G.spawnQueue=0;G.packs=[];
  return{c,G,D:c.__api.D,p:G.player};
}
function point(x,y,r=10){return{x,y,r,hp:1000,maxHp:1000,dead:false,kind:'norm'};}
function foe(o,x,y){const e=o.c.spawnEnemy('blob');e.x=x;e.y=y;e.spd=0;e.dmg=0;e.hp=e.maxHp=1e9;e.dead=false;return e;}
const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];

{
  const {G}=fresh(),s=G.frameScratch;
  ok('новая партия получает отдельный frameScratch',!!s&&typeof s==='object');
  ok('источники охлаждения и кандидаты свиты начинают пустыми',s.chillSources.length===0&&s.minionCandidates.length===0);
  ok('пулы записей, ячеек и карта занятых целей готовы к повторному использованию',Array.isArray(s.minionCandidatePool)&&typeof s.minionClaims.set==='function'&&typeof s.minionClaims.clear==='function'&&s.packMods.spd===1);
}

{
  const o=fresh(),a=foe(o,10,0),b=foe(o,20,0),boss=foe(o,30,0);
  a.ail.chill=2;b.dots.fire.dps=4;boss.kind='boss';boss.aff=[{id:'banner'}];o.D.inferno=true;
  o.G.enemies=[b,a,boss];const s=o.c.scanEnemyLogicFrame();
  ok('сканирование возвращает постоянный scratch, а не новый объект',s===o.G.frameScratch);
  ok('источники охлаждения сохраняют порядок G.enemies',s.chillSources.length===1&&s.chillSources[0]===a);
  ok('единый проход обнаруживает активное Инферно',s.infernoActive===true);
  ok('единый проход обнаруживает Знамя босса',o.G.banner===true);
  o.c.buildEnemyLogicFrame(s);
  ok('нужные динамические сетки строятся после сканирования',!!s.activeChillGrid&&!!s.activeInfernoGrid);
  ok('сетка Инферно индексирует всех врагов',s.activeInfernoGrid.order.size===3);
  const chillGrid=s.activeChillGrid,infernoGrid=s.activeInfernoGrid;
  o.c.releaseEnemyLogicFrame(s);
  ok('освобождение фазы очищает активные ссылки и сигналы',s.activeChillGrid===null&&s.activeInfernoGrid===null&&!s.infernoActive&&s.chillSources.length===0);
  ok('очищенные сетки не удерживают врагов в Map',chillGrid.cells.size===0&&chillGrid.order.size===0&&infernoGrid.cells.size===0&&infernoGrid.order.size===0);
}

{
  const {c}=fresh(),a=point(10,20),b=point(280,20),grid=c.buildEnemySpatialGrid([a],true);
  const firstCell=[...grid.cells.values()][0];c.clearEnemySpatialGrid(grid);
  const reused=c.buildEnemySpatialGrid([b],true,grid),secondCell=[...reused.cells.values()][0];
  ok('повторная сборка сохраняет сам объект сетки',reused===grid);
  ok('пустая ячейка сетки повторно используется по идентичности',secondCell===firstCell);
  b.x=20;c.updateEnemySpatialGridPosition(grid,b);
  ok('переиспользованная динамическая сетка отслеживает движение',c.enemySpatialCandidates(grid,0,0,50).includes(b));
  c.removeEnemyFromSpatialGrid(grid,b);const added=point(5,0);c.addEnemyToSpatialGrid(grid,added);
  ok('удаление и добавление не оставляют старого врага в сетке',!grid.order.has(b)&&grid.order.has(added)&&c.enemySpatialCandidates(grid,0,0,50)[0]===added);
}

{
  const {c,G}=fresh();const edge=point(640,0),outside=point(640.001,0),near=point(40,0);G.enemies=[edge,outside,near];
  const first=c.frameMinionCandidates();
  ok('поводок свиты сохраняет включительную границу 640',first.some(x=>x.e===edge));
  ok('кандидаты сохраняют порядок и исключают 640,001',first.length===2&&first[0].e===edge&&first[1].e===near&&!first.some(x=>x.e===outside));
  ok('повторный запрос кадра возвращает тот же массив без пересчёта',c.frameMinionCandidates()===first);
  const entry=first[0];c.releaseFrameMinionScratch();
  ok('освобождение списка обнуляет ссылки на врагов',entry.e===null&&first.length===0&&!G.frameScratch.minionCandidatesReady);
  G.enemies=[near];const second=c.frameMinionCandidates();
  ok('запись кандидата повторно используется на следующем кадре',second[0]===entry&&entry.e===near);
  const claims=G.frameScratch.minionClaims;c.claimMinionTarget(claims,near);c.claimMinionTarget(claims,near);c.releaseFrameMinionScratch();
  ok('карта распределения целей переиспользуется и очищается',G.frameScratch.minionClaims===claims&&claims.size===0);
}

{
  const {c,G}=fresh();G.enemies=[point(0,0),point(300,0)];const s=G.frameScratch;
  ok('после движения сетка снарядов изначально остаётся ленивой',s.postMoveReady===false&&s.postMoveGrid===null);
  const first=c.getPostMoveEnemyGrid();
  ok('два потребителя одной фазы получают одну сетку',c.getPostMoveEnemyGrid()===first&&first.order.size===2);
  c.releasePostMoveEnemyGrid();
  ok('конец фазы очищает сетку и не удерживает врагов',!s.postMoveReady&&first.cells.size===0&&first.order.size===0);
  G.enemies=[point(10,0)];const second=c.getPostMoveEnemyGrid();
  ok('следующий кадр повторно использует объект post-move сетки',second===first&&second.order.size===1);
  c.releasePostMoveEnemyGrid();
}

{
  const {c,G}=fresh(),e={pack:{aff:[{spd:()=>2,dmg:()=>3,aspd:()=>4}]}};
  const a=c.packMods(e),b=c.packMods(e);
  ok('внешний packMods сохраняет независимые результаты',a!==b&&a.spd===2&&a.dmg===3&&a.aspd===4);
  const scratch=G.frameScratch.packMods,x=c.packMods(e,scratch);e.pack.aff=[];const y=c.packMods(e,scratch);
  ok('горячий путь packMods возвращает переданный объект',x===scratch&&y===scratch);
  ok('переиспользованный результат packMods сбрасывает старые множители',y.spd===1&&y.dmg===1&&y.aspd===1);
}

{
  const {c,G}=fresh();
  ok('проверка амулетов не требует временного массива ключей',c.hasAnyAmulet()===false);
  G.amu.test=true;ok('проверка амулетов находит первое поле',c.hasAnyAmulet()===true);
}

{
  const o=fresh('bow'),source=foe(o,100,0),target=foe(o,140,0);source.ail.chill=10;
  o.G.enemies=[target,source];o.G.weapon.noAttack=true;o.p.inv=999;o.c.update(0.016);
  const grid=o.G.frameScratch.chillGrid,cell=grid.cellPool[0];o.c.update(0.016);
  ok('полный update повторно использует сетку охлаждения между кадрами',o.G.frameScratch.chillGrid===grid);
  ok('после каждого update сетка не удерживает активных врагов',grid.cells.size===0&&grid.order.size===0&&grid.cellPool.includes(cell));
}

{
  const html=require('./harness').loadInspectionSource('./index.html');
  ok('enemy-фаза больше не создаёт filter-массив охлаждённых',!/G\.enemies\.filter\(x\s*=>\s*x\.ail\.chill/.test(html));
  ok('горячая проверка амулетов больше не создаёт Object.keys',/if \(hasAnyAmulet\(\)\) tickAmulets\(dt\)/.test(html));
  ok('цветные DoT-числа не создают локальную emit-функцию',!/const emit\s*=\s*\(kind/.test(html));
  ok('цикл пачек использует постоянный результат множителей',/packMods\(e,frameScratch\.packMods\)/.test(html));
  ok('все три scratch-фазы явно освобождаются в update',/releaseEnemyLogicFrame\(frameScratch\)/.test(html)&&/releaseFrameMinionScratch\(\)/.test(html)&&/releasePostMoveEnemyGrid\(\)/.test(html));
}

{
  const o=fresh(),enemies=[];o.D.inferno=true;
  for(let i=0;i<500;i++){
    const e=foe(o,(i%25)*40,Math.floor(i/25)*40);e.ail.chill=i%7===0?1:0;e.dots.fire.dps=i%11===0?2:0;
    if(i===499){e.kind='boss';e.aff=[{id:'banner'}];}enemies.push(e);
  }
  o.G.enemies=enemies;
  const oldScan=vm.runInContext(`()=>{const chill=G.enemies.filter(e=>e.ail.chill>0);const inferno=D.inferno&&G.enemies.some(e=>e.dots.fire.dps>0);let banner=false;for(const e of G.enemies)if(e.kind==='boss'&&e.aff.length&&e.aff.some(a=>a.id==='banner')){banner=true;break;}return chill.length+'|'+inferno+'|'+banner}`,o.c);
  const newScan=vm.runInContext(`()=>{const s=scanEnemyLogicFrame();const r=s.chillSources.length+'|'+s.infernoActive+'|'+G.banner;releaseEnemyLogicFrame(s);return r}`,o.c);
  ok('единый проход даёт те же сигналы, что три прежних прохода',newScan()===oldScan());
  for(let i=0;i<1000;i++){oldScan();newScan();}
  const oldTimes=[],newTimes=[],runs=7000;
  for(let round=0;round<5;round++){
    let t=performance.now();for(let i=0;i<runs;i++)oldScan();oldTimes.push(performance.now()-t);
    t=performance.now();for(let i=0;i<runs;i++)newScan();newTimes.push(performance.now()-t);
  }
  const oldMs=median(oldTimes),newMs=median(newTimes),gain=(1-newMs/oldMs)*100;
  /* Микробенчмарк чувствителен к планировщику и энергосбережению Windows.
     Ловим значимую регрессию, но не падаем из-за единичного шума в несколько процентов. */
  ok('единый проход не медленнее прежних filter/some/scan более чем на 10%',newMs<=oldMs*1.10,`старый ${oldMs.toFixed(1)} мс · новый ${newMs.toFixed(1)} мс`);
  console.log('BENCH '+JSON.stringify({enemies:500,frames:runs,oldMs:+oldMs.toFixed(2),newMs:+newMs.toFixed(2),reductionPct:+gain.toFixed(1)}));
}

console.log(JSON.stringify({n,fail}));
if(fail)process.exitCode=1;
