/* Пространственная сетка аур: эквивалентность полному перебору и движение в том же кадре. */
const {loadGame}=require('./sim');
const fs=require('fs');
const ok=(nm,cond,det='')=>console.log((cond?'  ✓ ':'  ✗ ')+nm.padEnd(66)+det);
function fresh(){const c=loadGame('./GrimGrind.html');c.newGame('bow','keys');return c;}
function unit(x,y,r=10){return {x,y,r,ail:{chill:1}};}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

{ const c=fresh(), a=unit(0,0), b=unit(200,0), list=[a,b];
  const fixed=c.buildEnemySpatialGrid(list), moving=c.buildEnemySpatialGrid(list,true);
  ok('обычная сетка не платит за отслеживание перемещений',fixed.keys===null);
  ok('динамическая сетка запоминает ячейку каждого источника',moving.keys.size===2);
  ok('движение внутри одной ячейки не перестраивает сетку',!c.updateEnemySpatialGridPosition(moving,a));
  b.x=400;
  ok('переход через границу ячейки обновляет набор кандидатов',
    c.updateEnemySpatialGridPosition(moving,b)&&!c.enemySpatialCandidates(moving,200,0,20).includes(b)&&
    c.enemySpatialCandidates(moving,400,0,20).includes(b)); }

{ const c=fresh(), a=unit(0,0), b=unit(300,0), d=unit(600,0), grid=c.buildEnemySpatialGrid([a,b,d],true);
  d.x=10; c.updateEnemySpatialGridPosition(grid,d);
  const local=c.enemySpatialCandidates(grid,0,0,30);
  ok('перемещённый источник сохраняет исходный порядок внутри ячейки',
    local.length===2&&local[0]===a&&local[1]===d);
  b.x=120; c.updateEnemySpatialGridPosition(grid,b);
  const merged=c.enemySpatialCandidates(grid,60,0,180);
  ok('кандидаты из нескольких ячеек возвращаются в исходном порядке',
    merged.length===3&&merged[0]===a&&merged[1]===b&&merged[2]===d);
  ok('запрос пустой области не создаёт ложных кандидатов',c.enemySpatialCandidates(grid,-900,-900,10).length===0); }

{ const c=fresh(), D=c.__api.D, target=unit(0,0,12), src=unit(D.chillAuraR+target.r,0), grid=c.buildEnemySpatialGrid([src],true);
  ok('без сетки аура безопасно считается отсутствующей',!c.chillAuraAffectsEnemy(target,null));
  ok('равенство внешней границе ауры остаётся попаданием',c.chillAuraAffectsEnemy(target,grid));
  src.x+=0.001; c.updateEnemySpatialGridPosition(grid,src);
  ok('за границей на 0,001 аура уже не действует',!c.chillAuraAffectsEnemy(target,grid));
  const selfGrid=c.buildEnemySpatialGrid([target],true);
  ok('враг не считается соседом самому себе',!c.chillAuraAffectsEnemy(target,selfGrid));
  src.x=20; src.dead=true; c.updateEnemySpatialGridPosition(grid,src);
  ok('снимок источников кадра сохраняет прежнюю семантику смерти',c.chillAuraAffectsEnemy(target,grid));
  const large=unit(D.chillAuraR+39,0,40);
  ok('радиус крупной цели расширяет область проверки',c.chillAuraAffectsEnemy(large,c.buildEnemySpatialGrid([target],true))); }

{ const c=fresh(), G=c.__api.G, D=c.__api.D;
  G.enemies=Array.from({length:500},(_,i)=>unit((i%25)*117-1400,Math.floor(i/25)*143-1350,8+(i%4)));
  G.enemies.forEach((e,i)=>e.ail.chill=i%3===0?1:0);
  const sources=G.enemies.filter(e=>e.ail.chill>0),grid=c.buildEnemySpatialGrid(sources,true);
  let same=true;
  for(const e of G.enemies){
    const old=sources.some(src=>src!==e&&distance(src,e)<=D.chillAuraR+e.r);
    if(old!==c.chillAuraAffectsEnemy(e,grid)){same=false;break;}
  }
  ok('500 целей дают тот же результат, что полный перебор',same);
  const moved=sources[0]; moved.x+=400; moved.y-=260; c.updateEnemySpatialGridPosition(grid,moved);
  const probe=unit(moved.x+D.chillAuraR, moved.y, 0);
  ok('после перемещения результат совпадает с новым положением источника',
    c.chillAuraAffectsEnemy(probe,grid)===sources.some(src=>src!==probe&&distance(src,probe)<=D.chillAuraR)); }

{ const c=fresh(), G=c.__api.G, D=c.__api.D, p=G.player, e=c.spawnEnemy('blob');
  p.moving=false; G.enemies=[e]; e.x=0;e.y=0;e.hp=e.maxHp=10000;
  const dps=c.avgHit()*0.5*(D.mspd/235)*D.ailEff,dt=0.02;
  G.trails=[{x:0,y:0,r:30,life:2,fire:true,cold:false}]; const hp=e.hp;c.tickTrail(dt);
  ok('огненный след наносит прежний единственный тик',Math.abs((hp-e.hp)-dps*dt)<1e-9);
  e.hp=10000;e.x=100;
  c.tickTrail(dt);
  ok('враг вне следа не получает урон',e.hp===10000);
  e.x=0;e.ail.chill=0;G.trails=[{x:0,y:0,r:30,life:2,fire:false,cold:true}];c.tickTrail(dt);
  ok('ледяной след по-прежнему накладывает охлаждение',e.ail.chill===0.5*D.ailDur);
  e.ail.chill=0;e.x=30+e.r;G.trails=[{x:0,y:0,r:30,life:2,fire:false,cold:true}];c.tickTrail(dt);
  ok('касание внешней границы следа остаётся попаданием',e.ail.chill>0);
  e.x=0;e.hp=10000;G.trails=[{x:0,y:0,r:30,life:2,fire:true,cold:false},{x:0,y:0,r:30,life:2,fire:true,cold:false}];
  c.tickTrail(dt);
  ok('перекрывающиеся огненные узлы не умножают тик',Math.abs((10000-e.hp)-dps*dt)<1e-9);
  e.hp=10000;G.trails=[{x:0,y:0,r:30,life:0.001,fire:true,cold:false}];c.tickTrail(dt);
  ok('истёкший след удаляется до пространственного запроса',G.trails.length===0&&e.hp===10000); }

{ const c=fresh(),G=c.__api.G,p=G.player,target=c.spawnEnemy('blob'),source=c.spawnEnemy('blob');
  G.spawnQueue=0;G.spawnT=999;G.weapon.noAttack=true;p.inv=999;
  target.x=100;target.y=0;target.spd=0;target.dmg=0;target.ail.chill=0;
  source.x=150;source.y=0;source.spd=0;source.dmg=0;source.ail.chill=10;
  G.enemies=[target,source];c.update(0.02);
  ok('полный update сохраняет ауру у неподвижных соседей',target.frost===true);
  target.frost=false;target.x=100;target.ail.chill=0;source.x=390;source.spd=13000;source.ail.chill=10;
  G.enemies=[target,source];c.update(0.02);
  ok('источник, вошедший в радиус после движения, виден в том же кадре',target.frost===true,'x='+source.x.toFixed(0)); }

{ const html=fs.readFileSync('./GrimGrind.html','utf8');
  ok('сетка ауры строится после возможных прыжков пачки',
    /packTick\(pk, dt\);[\s\S]{0,180}buildEnemyLogicFrame\(frameScratch\)/.test(html));
  ok('булева проверка ауры не создаёт и не сортирует массив кандидатов',
    /function chillAuraAffectsEnemy\(e,chillGrid\)[\s\S]{0,500}for\(const src of cell\)/.test(html)&&
    !/function chillAuraAffectsEnemy\(e,chillGrid\)[\s\S]{0,300}enemySpatialCandidates/.test(html));
  ok('следы используют локальных кандидатов вместо полного вложенного цикла',
    /const trailGrid=G\.trails\.length\?buildEnemySpatialGrid\(G\.trails\):null/.test(html)&&
    /enemySpatialCandidates\(trailGrid,e\.x,e\.y,trailGrid\.maxRadius\+e\.r\)/.test(html)); }
