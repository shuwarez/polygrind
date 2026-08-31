/* Площадные эффекты: локальные кандидаты без изменения порядка, границ и повторных тиков. */
const {loadGame}=require('./sim');
const fs=require('fs');
const ok=(nm,cond,det='')=>console.log((cond?'  ✓ ':'  ✗ ')+nm.padEnd(68)+det);
function fresh(){const c=loadGame('./PolyGrind.html');c.newGame('bow','keys');return c;}
function point(x,y,r=10){return{x,y,r};}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

{ const c=fresh(),G=c.__api.G,a=point(0,0,8),b=point(150,0,40),d=point(400,0,8);
  G.enemies=[a,b,d];
  ok('без сетки helper возвращает исходный полный массив',c.enemyAreaCandidates(null,0,0,50)===G.enemies);
  const grid=c.buildEnemySpatialGrid(G.enemies,true),local=c.enemyAreaCandidates(grid,100,0,10);
  ok('максимальный радиус цели расширяет грубый запрос',local.includes(b));
  ok('далёкая ячейка не попадает в локальный набор',!local.includes(d));
  ok('локальный набор сохраняет порядок G.enemies',local.indexOf(a)<local.indexOf(b));
  const n=point(20,0,12);
  ok('новый враг добавляется в активную динамическую сетку',c.addEnemyToSpatialGrid(grid,n));
  const afterAdd=c.enemyAreaCandidates(grid,0,0,30);
  ok('добавленный враг получает место после исходных элементов',afterAdd[afterAdd.length-1]===n);
  ok('удаление врага синхронизирует индекс',c.removeEnemyFromSpatialGrid(grid,a));
  ok('удалённый враг больше не возвращается запросом',!c.enemyAreaCandidates(grid,0,0,30).includes(a)); }

{ const c=fresh(),enemies=Array.from({length:500},(_,i)=>point((i%25)*117-1400,Math.floor(i/25)*143-1350,8+i%5));
  const grid=c.buildEnemySpatialGrid(enemies); let same=true;
  for(let q=0;q<80;q++){
    const o=point((q%10)*251-1130,Math.floor(q/10)*319-1100),r=45+(q%7)*23;
    const fast=c.enemyAreaCandidates(grid,o.x,o.y,r).filter(e=>distance(e,o)<=r+e.r);
    const old=enemies.filter(e=>distance(e,o)<=r+e.r);
    if(fast.length!==old.length||fast.some((e,i)=>e!==old[i])){same=false;break;}
  }
  ok('80 областей по 500 врагам совпадают с полным перебором',same); }

{ const c=fresh(),G=c.__api.G,e=c.spawnEnemy('blob');G.enemies=[e];e.hp=e.maxHp=10000;e.x=70;e.y=0;e.r=10;
  G.boils=[{x:0,y:0,r:60,life:3,t:0}];c.tickBoils(0);
  ok('кипящая лужа сохраняет включительную внешнюю границу',Math.abs(e.hp-9500)<1e-9);
  e.hp=10000;e.x=70.001;G.boils=[{x:0,y:0,r:60,life:3,t:0}];c.tickBoils(0);
  ok('за границей кипящей лужи урона нет',e.hp===10000);
  e.x=0;e.hp=10000;G.boils=[{x:0,y:0,r:60,life:3,t:0},{x:0,y:0,r:60,life:3,t:0}];c.tickBoils(0);
  ok('две лужи последовательно снимают 5% текущего HP каждая',Math.abs(e.hp-9025)<1e-9); }

{ const c=fresh(),G=c.__api.G,e=c.spawnEnemy('blob');G.enemies=[e];e.hp=e.maxHp=10000;e.x=68;e.y=0;e.r=10;e.dead=false;
  G.acidPools=[{x:0,y:0,r:58,life:3,max:3,t:0}];c.tickAcidPools(0);
  ok('кислотная лужа сохраняет включительную границу',Math.abs(e.hp-8500)<1e-9);
  e.hp=10000;e.dead=true;G.acidPools=[{x:0,y:0,r:58,life:3,max:3,t:0}];c.tickAcidPools(0);
  ok('кислота по-прежнему исключает помеченную мёртвую цель',e.hp===10000);
  e.dead=false;e.x=68.001;G.acidPools=[{x:0,y:0,r:58,life:3,max:3,t:0}];c.tickAcidPools(0);
  ok('кислота не задевает цель за границей на 0,001',e.hp===10000); }

{ const c=fresh(),G=c.__api.G,e=c.spawnEnemy('blob');G.enemies=[e];e.hp=e.maxHp=1000;e.r=10;e.x=60;e.y=0;
  const trace={x:0,y:0,r:50,dmg:100,hitSet:[]},grid=c.buildEnemySpatialGrid();c.hitArcaneTrace(trace,grid);
  ok('Остаточная аркана сохраняет строгую границу: равенство не попадает',e.hp===1000);
  e.x=59.999;c.hitArcaneTrace(trace,grid);const after=e.hp;c.hitArcaneTrace(trace,grid);
  ok('внутри след бьёт ровно один раз',after<1000&&e.hp===after);
  e.hp=1000;e.x=60;G.arcaneMines=[{x:0,y:0,r:50,dmg:100,life:3,max:3}];c.tickArcaneMines(0);
  ok('Арканная мина не срабатывает на строгой границе',G.arcaneMines.length===1&&e.hp===1000);
  e.x=59.999;c.tickArcaneMines(0);
  ok('вход внутрь взрывает мину единожды',G.arcaneMines.length===0&&e.hp<1000); }

{ const c=fresh(),G=c.__api.G,a=c.spawnEnemy('blob'),b=c.spawnEnemy('blob'),d=c.spawnEnemy('blob');
  for(const e of [a,b,d]){e.hp=e.maxHp=1000;e.r=10;e.y=0;}
  a.x=60;b.x=59.999;d.x=20;G.enemies=[a,b,d];const grid=c.buildEnemySpatialGrid();
  c.nova(0,0,50,100,'#fff',{noRing:true,grid});
  ok('nova сохраняет строгую границу: равенство исключено',a.hp===1000);
  ok('nova поражает цель внутри границы',b.hp<1000);
  const order=[];c.nova(0,0,50,0,'#fff',{noRing:true,grid,onTarget:e=>order.push(e)});
  ok('nova передаёт цели обработчикам в исходном порядке',order.length===2&&order[0]===b&&order[1]===d); }

{ const c=fresh(),G=c.__api.G,D=c.__api.D,p=G.player,e=c.spawnEnemy('blob');
  G.enemies=[e];G.weapon.noAttack=true;G.spawnQueue=0;p.inv=999;e.hp=e.maxHp=1e9;e.r=10;e.y=0;
  e.x=110;G.groundbreakerCracks=[{x:0,y:0,r:100,life:2,tick:0,hits:0,seed:0}];const hp=e.hp;c.tickGroundbreakerCracks(0);
  ok('Землелом сохраняет включительную внешнюю границу',e.hp<hp);
  e.hp=1e9;e.x=110.001;G.groundbreakerCracks=[{x:0,y:0,r:100,life:2,tick:0,hits:0,seed:0}];c.tickGroundbreakerCracks(0);
  ok('Землелом не бьёт за границей на 0,001',e.hp===1e9); }

{ const c=fresh(),G=c.__api.G,D=c.__api.D,p=G.player,far=c.spawnEnemy('blob'),mid=c.spawnEnemy('blob'),src=c.spawnEnemy('blob');
  G.spawnQueue=0;G.spawnT=999;G.weapon.noAttack=true;p.inv=999;D.inferno=true;D.infernoR=110;
  for(const e of [far,mid,src]){e.hp=e.maxHp=1e9;e.spd=0;e.dmg=0;e.infT=0;e.y=500;e.dots.fire.dps=0;}
  src.x=0;mid.x=70;far.x=140;src.dots.fire.dps=10;src.dots.fire.n=1;src.dots.fire.life=99;G.enemies=[far,mid,src];
  c.update(0.01);
  ok('Инферно зажигает непосредственного соседа',mid.dots.fire.dps>0);
  ok('новый огонь сохраняет цепное распространение в том же кадре',far.dots.fire.dps>0);
  const remote=c.spawnEnemy('blob');remote.hp=remote.maxHp=1e9;remote.x=900;remote.y=500;remote.spd=0;remote.dmg=0;remote.infT=0;remote.dots.fire.dps=0;
  G.enemies.unshift(remote);src.infT=0;mid.infT=0;far.infT=0;c.update(0.01);
  ok('далёкая цель не получает Инферно из-за грубого кандидата',remote.dots.fire.dps===0); }

{ const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('появление и смерть синхронизируют активную сетку Инферно',
    /ACTIVE_ENEMY_LOGIC_GRID\) addEnemyToSpatialGrid/.test(html)&&
    /ACTIVE_ENEMY_LOGIC_GRID\) removeEnemyFromSpatialGrid/.test(html));
  ok('взрыв сферы повторно использует сетку снарядов',/explodePlayerOrb\(s,enemyGrid\)/.test(html));
  ok('сетки луж и Землелома строятся лениво только перед тиком',
    (html.match(/if \(!enemyGrid\) enemyGrid=buildEnemySpatialGrid\(\);/g)||[]).length>=3);
  ok('гравитационный колодец намеренно оставлен одним линейным проходом',
    /if \(G\.well\)\{[\s\S]{0,100}for \(const o of G\.enemies\)/.test(html)); }
