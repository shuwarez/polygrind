/* Пространственная сетка снарядов: полнота кандидатов и прежний порядок попаданий. */
const {loadGame}=require('./sim');
let n=0,fail=0;
function ok(name,cond,detail=''){
  n++; if(!cond)fail++;
  console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(64)+detail);
}

function setup(){
  const c=loadGame('./GrimGrind.html',{random:()=>0.99});
  c.newGame('bow','keys','hunter');
  const G=c.__api.G,D=c.__api.D,p=G.player;
  G.enemies.length=0;G.shots.length=0;G.spawnQueue=0;G.packs.length=0;G.pending=0;
  p.x=p.y=-1000;p.atkCd=99;
  D.baseMin=D.baseMax=100;D.elem={fire:0,cold:0,lit:0,poi:0};D.incAll=0;D.moreAll=1;
  D.critCh=D.superCh=D.dblHit=D.knock=D.ricochet=D.homing=0;
  return {c,G,D,p};
}
function foe(o,x,y,r=20){
  const e=o.c.spawnEnemy();
  e.x=x;e.y=y;e.r=r;e.spd=e.dmg=0;e.hp=e.maxHp=1e6;
  e.kind='norm';e.typeKey='blob';e.armor=0;e.ward=null;e.bulwark=0;
  return e;
}
function shot(extra={}){
  return Object.assign({x:0,y:0,vx:0,vy:0,r:5,life:1,mul:1,attackMul:1,
    hitSet:[],orb:false,chain:0,pierce:0,pierced:0},extra);
}

{
  const o=setup();
  const enemies=Array.from({length:500},(_,i)=>({x:(i%25)*110-1320,y:Math.floor(i/25)*110-1045,r:20}));
  const grid=o.c.buildEnemySpatialGrid(enemies);
  const local=o.c.enemySpatialCandidates(grid,enemies[250].x,enemies[250].y,25);
  ok('сетка индексирует все 500 врагов один раз',grid.order.size===500&&grid.maxRadius===20,
    grid.order.size+' записей');
  ok('локальный запрос не возвращает всю толпу',local.length>0&&local.length<10,
    local.length+' кандидатов из 500');
}

{
  const o=setup(),first={x:260,y:0,r:10},second={x:-260,y:0,r:10};
  const result=o.c.enemySpatialCandidates(o.c.buildEnemySpatialGrid([first,second]),0,0,300);
  ok('кандидаты сохраняют исходный порядок G.enemies между ячейками',
    result.length===2&&result[0]===first&&result[1]===second);
}

{
  const o=setup(),boss=foe(o,140,0,140),s=shot();o.G.shots.push(s);const hp=boss.hp;
  o.c.update(0);
  ok('радиус крупного босса пересекает соседнюю ячейку без пропуска',boss.hp<hp&&s.hitSet[0]===boss);
}

{
  const o=setup(),first=foe(o,4,0),second=foe(o,0,0),s=shot();o.G.shots.push(s);
  const hp1=first.hp,hp2=second.hp;o.c.update(0);
  ok('при двух пересечениях первым остаётся ранний элемент G.enemies',
    first.hp<hp1&&second.hp===hp2&&s.hitSet[0]===first);
}

{
  const o=setup(),used=foe(o,0,0),fresh=foe(o,0,0),s=shot({hitSet:[used]});o.G.shots.push(s);
  const hp=fresh.hp;o.c.update(0);
  ok('уже задетая цель исключается до проверки следующего кандидата',fresh.hp<hp&&s.hitSet.at(-1)===fresh);
}

{
  const o=setup(),first=foe(o,0,0),second=foe(o,0,0),s=shot({pierce:1});o.G.shots.push(s);
  const hp1=first.hp,hp2=second.hp;o.c.update(0);
  ok('пробитие по-прежнему обрабатывает одну новую цель за кадр',
    first.hp<hp1&&second.hp===hp2&&o.G.shots.includes(s)&&s.pierce===0&&s.pierced===1);
  o.c.update(0);
  ok('на следующем кадре пробитие переходит к следующей цели',second.hp<hp2&&!o.G.shots.includes(s));
}

{
  const o=setup(),near=foe(o,0,180),far=foe(o,300,0),s=shot({vx:100,homingBonus:1});
  o.G.shots.push(s);o.c.update(0.1);
  ok('самонаведение выбирает ближайшего кандидата в радиусе 400',
    near!==far&&s.vy>0&&s.vx>0,'вектор '+s.vx.toFixed(1)+'/'+s.vy.toFixed(1));
}

{
  const o=setup(),hit=foe(o,0,0),near=foe(o,-80,0),far=foe(o,140,0),s=shot({vx:100,chain:1});
  o.G.shots.push(s);o.c.update(0);
  ok('цепной снаряд линейно выбирает ближайшую незадетую цель без сортировки',
    s.hitSet[0]===hit&&near!==far&&s.vx<0&&o.G.shots.includes(s));
}

{
  const o=setup(),distant=foe(o,200,0,10),s=shot();o.G.shots.push(s);const hp=distant.hp;
  o.c.update(0);
  ok('соседняя ячейка не создаёт ложного столкновения',distant.hp===hp&&o.G.shots.includes(s));
}

if(fail)process.exitCode=1;
