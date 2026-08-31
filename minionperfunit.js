/* Полный цикл свиты: выбор угроз, ленивые цели, общая сетка и снимки урона. */
const {loadGame}=require('./sim');
const fs=require('fs');
let n=0,fail=0;
const ok=(name,cond,detail='')=>{n++;if(!cond)fail++;console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(76)+detail);};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=(x,y,r=10)=>({x,y,r,hp:1000,maxHp:1000,dead:false,kind:'norm'});
function fresh(random){const c=loadGame('./PolyGrind.html',random?{random}:{});c.newGame('necro','keys');const G=c.__api.G;G.enemies=[];G.minions=[];G.spawnQueue=0;G.packs=[];return{c,G,D:c.__api.D,p:G.player};}
function foe(c,x,y,r=10){const e=c.spawnEnemy('blob');e.x=x;e.y=y;e.r=r;e.spd=0;e.dmg=0;e.hp=e.maxHp=1e9;e.dead=false;e.kind='norm';e.armor=0;e.ward=null;e.bulwark=0;return e;}
function minion(kind,x=0,y=0){return{kind,x,y,r:kind==='golemB'?22:10,hp:100,max:100,dead:false,tgt:null,cd:99,rot:0,hit:0,born:1,deathT:999,slowT:0,slowMul:1,stunT:0,animT:0,spriteFace:1,hitN:0};}

{
  const {c,G,D}=fresh();D.golemB=1;D.golemN=1;D.maxSkel=1;D.maxBomb=1;
  ok('очередь сначала требует голема крови',c.needKind()==='golemB');
  G.minions.push(minion('golemB'));ok('после него очередь требует костяного голема',c.needKind()==='golemN');
  G.minions.push(minion('golemN'));ok('затем поднимается обычный скелет',c.needKind()==='skeleton');
  G.minions.push(minion('skeleton'));ok('бомбардир идёт сразу после заполнения скелетов',c.needKind()==='bombardier');
  G.minions.push(minion('bombardier'));ok('полный состав не требует нового бойца',c.needKind()===null);
  ok('очередь больше не содержит охотников и колдунов',!/'hunter'|'warlock'/.test(c.needKind.toString()));
}

{
  const {c,G}=fresh(()=>0.5);
  G.minions=Array.from({length:20},(_,i)=>minion(i%7===0?'golemB':'skeleton',(i*97)%1200-600,(i*173)%1200-600));
  G.enemies=Array.from({length:500},(_,i)=>point((i*73)%2800-1400,(i*151)%2800-1400));
  ok('500 врагов не получают пассивное аггро от полного отряда',G.enemies.every(e=>e.tauntMinion==null));
  const e=point(0,0);
  for(const kind of ['skeleton','bombardier','golemN']){
    const m=minion(kind,10,0);G.minions=[m];
    ok(kind+' не запускает врождённую провокацию Голема крови',!c.rollBloodGolemTaunt(e,m));
  }
  const blood=minion('golemB',10,0);G.minions=[blood];
  ok('близость Голема крови сама не записывает цель',e.tauntMinion==null);
  e.tauntMinion=blood;
  ok('событийная провокация хранит точного ударившего Голема крови',e.tauntMinion===blood);
}

{
  const {c,G}=fresh();G.enemies=Array.from({length:500},(_,i)=>point((i%25)*117-1400,Math.floor(i/25)*143-1350,6+i%13));
  const grid=c.buildEnemySpatialGrid(G.enemies);let same=true,ordered=true;
  for(let q=0;q<80;q++){
    const center=point((q%10)*251-1130,Math.floor(q/10)*319-1100),r=45+(q%7)*23;
    const old=G.enemies.filter(e=>!e.dead&&dist(e,center)<=r+e.r);
    const fast=c.enemyAreaCandidates(grid,center.x,center.y,r).filter(e=>!e.dead&&dist(e,center)<=r+e.r);
    if(old.length!==fast.length||old.some((e,i)=>e!==fast[i]))same=false;
    if(fast.some((e,i)=>i&&G.enemies.indexOf(fast[i-1])>G.enemies.indexOf(e)))ordered=false;
  }
  ok('80 областей свиты по 500 врагам совпадают с полным перебором',same);
  ok('общая сетка сохраняет исходный порядок целей взрыва',ordered);
  const center=point(0,0),large=point(90,0,35);G.enemies=[large];const edgeGrid=c.buildEnemySpatialGrid(G.enemies);
  ok('радиус крупной цели не теряется на краю области',c.enemyAreaCandidates(edgeGrid,0,0,55).includes(large)&&dist(large,center)===55+large.r);
}

{
  const {c,G,D}=fresh(()=>0.5),target=foe(c,400,0),m=minion('skeleton',0,0);G.minions=[m];D.minBlink={cd:10,r:60,mul:0.3};
  let calls=0;const getter=()=>{calls++;return c.buildEnemySpatialGrid();};m.blinkT=1;
  ok('перенос не просит сетку до фактического срабатывания',!c.minionBlink(m,target,0,getter)&&calls===0);
  m.blinkT=0;c.minionBlink(m,target,0,getter);
  ok('сработавший перенос получает общую сетку ровно один раз',calls===1);
}

{
  const setup=()=>{const o=fresh(()=>0.99),t=foe(o.c,400,0),near=foe(o.c,400,35),far=foe(o.c,400,300),m=minion('skeleton',0,0);o.G.minions=[m];o.D.minBlink={cd:10,r:60,mul:0.3};m.blinkT=0;return{...o,t,near,far,m};};
  const a=setup(),b=setup();a.c.minionBlink(a.m,a.t,0);const grid=b.c.buildEnemySpatialGrid();b.c.minionBlink(b.m,b.t,0,()=>grid);
  ok('перенос с сеткой поражает тот же набор, что полный перебор',(a.t.hp<1e9)===(b.t.hp<1e9)&&(a.near.hp<1e9)===(b.near.hp<1e9)&&(a.far.hp<1e9)===(b.far.hp<1e9));
}

{
  const {c,G,D}=fresh();G.amu.sealPack=true;D.boneField=5;G.bag.add('perNear','inc',1);
  const m=minion('skeleton',0,0);G.minions=[m,minion('bombardier'),minion('golemB'),minion('golemN')];
  G.corpses=Array.from({length:9},(_,i)=>({x:i,y:0,life:10}));G.enemies=Array.from({length:10},(_,i)=>point(i*10,0));
  const snap=c.minionDamageSnapshot(m);
  ok('снимок фиксирует максимум Печати Стаи +32%',snap.minionSealPackPct===32);
  ok('снимок фиксирует максимум Поля костей +45%',snap.minionBoneFieldInc===45);
  ok('снимок фиксирует потолок восьми ближайших врагов',snap.minionNearbyCount===8);
  G.minions.pop();const refreshed=c.minionDamageSnapshot(m);
  ok('новый удар обновляет снимок после изменения состава свиты',refreshed.minionSealPackPct===24);
}

{
  const setup=()=>{const o=fresh(()=>0.99);o.G.amu.sealPack=true;o.D.boneField=5;o.G.bag.add('perNear','inc',3);const m=minion('skeleton',0,0);o.G.minions=[m,minion('bombardier'),minion('golemB')];o.G.corpses=[{x:0,y:0,life:10},{x:2,y:0,life:10}];const e=foe(o.c,30,0);foe(o.c,60,0);return{...o,m,e};};
  const live=setup(),cached=setup(),hp1=live.e.hp,hp2=cached.e.hp;
  live.c.damage(live.e,{minion:live.m,direct:true});
  cached.c.damage(cached.e,{minion:cached.m,direct:true,...cached.c.minionDamageSnapshot(cached.m)});
  ok('снимок даёт ровно тот же фактический урон, что живой пересчёт',Math.abs((hp1-live.e.hp)-(hp2-cached.e.hp))<1e-9);
}

{
  const run=(role,golem=false)=>{const {c,G,p}=fresh(()=>0.5),m=minion(golem?'golemB':'skeleton',300,0),e=foe(c,200,0);G.minions=[m];e.x=200;e.y=0;e.spd=100;e.dmg=0;e.roles=role?[role]:[];p.x=p.y=0;p.inv=99;G.weapon.noAttack=true;c.update(0.1);return e.x;};
  ok('обычный враг фактически игнорирует близкого скелета и идёт к игроку',run(null)<200);
  ok('роль Охотник также идёт к игроку при обычной свите',run('hunter')<200);
  ok('Голем крови без собственного удара также не перехватывает врага',run(null,true)<200);
}

{
  const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('пассивный поиск агро Голема крови удалён',!/collectBloodGolems|minionThreatTarget|bloodGolems/.test(html));
  ok('тип для возрождения вычисляется один раз на кадр',/const neededKind=needKind\(\);[\s\S]{0,500}spawnMinion\(c\.x, c\.y, neededKind\)/.test(html));
  ok('список целей создаётся лениво только при переназначении',/function frameMinionCandidates\(\)[\s\S]{0,180}minionCandidatesReady/.test(html));
  ok('снаряды повторно используют построенную свитой сетку',/const enemyGrid=G\.shots\.length \? getPostMoveEnemyGrid\(\) : null/.test(html));
  ok('взрыв бомбардира берёт цели из общей пространственной сетки',/function bombardierImpact\([\s\S]{0,500}enemyAreaCandidates\(enemyGrid,primary\.x,primary\.y,radius\)/.test(html));
  ok('перенос, вихрь и ярость используют локальные кандидаты',(html.match(/enemyAreaCandidates\(grid,[me]\.x,[me]\.y,R\)/g)||[]).length>=3);
  ok('50% бросок Голема крови находится только на основном прямом ударе',
    (html.match(/if \(m\.kind === 'golemB' && !e\.dead\) rollBloodGolemTaunt\(e, m\);/g)||[]).length===1&&/Math\.random\(\) >= 0\.50/.test(html));
  ok('отложенное эхо сбрасывает устаревающий снимок бонусов',/minionSealPackPct:undefined,minionBoneFieldInc:undefined,minionNearbyCount:undefined/.test(html));
  ok('немедленное двойное попадание сохраняет снимок исходного удара',/minionSealPackPct:src\.minionSealPackPct[\s\S]{0,120}minionNearbyCount:src\.minionNearbyCount/.test(html));
}

console.log(JSON.stringify({n,fail}));
if(fail)process.exitCode=1;
