/* Временные визуальные объекты: жёсткий предел декора, pools и линейное уплотнение. */
const {loadGame}=require('./sim');
const fs=require('fs'),vm=require('vm');
let n=0,fail=0;
const ok=(name,cond,detail='')=>{n++;if(!cond)fail++;console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(80)+detail);};
function fresh(random=()=>0.5){const c=loadGame('./index.html',{random});c.newGame('bow','keys');const G=c.__api.G;G.enemies=[];G.spawnQueue=0;return{c,G,p:G.player,D:c.__api.D};}
function enemy(o,x=0,y=0){const e=o.c.spawnEnemy('blob');e.x=x;e.y=y;e.hp=e.maxHp=1e9;e.dead=false;e.armor=0;e.spd=0;return e;}

{
  const {G}=fresh();
  ok('новая партия создаёт отдельный пул частиц',Array.isArray(G.partPool)&&G.partPool.length===0);
  ok('новая партия создаёт отдельный пул временных эффектов',Array.isArray(G.fxPool)&&G.fxPool.length===0);
}

{
  const {c,G}=fresh();c.burst(0,0,10,'#fff',100,3,1);
  ok('обычный burst сохраняет прежнее прореживание вдвое',G.parts.length===5,'частиц '+G.parts.length);
  for(let i=0;i<200;i++)c.burst(0,0,20,'#fff',100,3,1);
  ok('декоративные частицы имеют жёсткий предел 640',G.parts.length===640,'частиц '+G.parts.length);
  c.burst(0,0,1000,'#fff',100,3,1);
  ok('на заполненном пределе новые частицы не раздувают массив',G.parts.length===640);
  c.pushTimedTelegraph({shape:'circle',kind:'damage',x:0,y:0,r:80},1);
  ok('предел частиц не затрагивает опасные телеграфы',G.fx.some(f=>f.t==='telegraph'));
}

{
  const {c,G}=fresh(),a={x:0,y:0,vx:100,vy:20,life:1,max:1,sz:2,col:'#a'},
    dead={x:2,y:3,vx:0,vy:0,life:0.01,max:1,sz:2,col:'#b'},
    b={x:5,y:6,vx:0,vy:0,life:1,max:1,sz:2,col:'#c'};
  G.parts=[a,dead,b];c.updateParticles(0.1);
  ok('линейное уплотнение удаляет истёкшую частицу',G.parts.length===2&&!G.parts.includes(dead));
  ok('уплотнение сохраняет порядок живых частиц',G.parts[0]===a&&G.parts[1]===b);
  ok('движение и трение частицы остались прежними',Math.abs(a.x-10)<1e-9&&Math.abs(a.vx-100*Math.pow(0.12,0.1))<1e-9);
  ok('истёкший объект попадает в пул переиспользования',G.partPool.includes(dead));
  G.parts.length=0;c.pushParticle(1,2,3,4,0.5,0.7,2,'#d');
  ok('следующая частица повторно использует истёкший объект',G.parts[0]===dead&&dead.max===0.7&&dead.col==='#d');
}

{
  const {c,G}=fresh();G.parts=Array.from({length:700},()=>({x:0,y:0,vx:0,vy:0,life:0,max:1,sz:2,col:'#fff'}));
  c.updateParticles(0.1);
  ok('пул частиц сам ограничен 640 объектами',G.parts.length===0&&G.partPool.length===640,'pool '+G.partPool.length);
}

{
  const {c,G}=fresh(),a={t:'ring',x:0,y:0,r:10,max:30,life:1,col:'#a'},
    dead={t:'txt',x:0,y:0,s:'old',life:0.01,col:'#b'},b={t:'num',x:0,y:0,v:2,life:1,col:null};
  G.fx=[a,dead,b];c.updateTransientEffects(0.1);
  ok('линейное уплотнение удаляет истёкший G.fx',G.fx.length===2&&!G.fx.includes(dead));
  ok('уплотнение сохраняет порядок живых G.fx',G.fx[0]===a&&G.fx[1]===b);
  ok('кольцо сохраняет прежнюю формулу расширения',Math.abs(a.r-(10+(30-10)*1))<1e-9,'радиус '+a.r);
  ok('число урона сохраняет скорость подъёма 26 единиц/с',Math.abs(b.y+2.6)<1e-9);
  ok('истёкший G.fx попадает в пул',G.fxPool.includes(dead));
}

{
  const {c,G}=fresh();G.fx=Array.from({length:700},()=>({t:'ring',x:0,y:0,r:1,max:2,life:0}));
  c.updateTransientEffects(0.1);
  ok('пул временных эффектов ограничен 512 объектами',G.fx.length===0&&G.fxPool.length===512,'pool '+G.fxPool.length);
}

{
  const o=fresh(),e=enemy(o),first=o.c.pushDamageNumber(e,10,false);o.c.updateTransientEffects(1);
  const second=o.c.pushDamageNumber(e,7,false);
  ok('число урона повторно использует объект из пула',first===second&&second.v===7);
}

{
  const o=fresh(),e=enemy(o);o.c.pushDamageNumber(e,10,false);o.c.pushDamageNumber(e,15,false);
  const nums=o.G.fx.filter(f=>f.t==='num');
  ok('короткие повторные некриты одной цели объединяются точной суммой',nums.length===1&&nums[0].v===25,'число '+nums[0].v);
  o.G.time+=0.081;o.c.pushDamageNumber(e,5,false);
  ok('после окна 80 мс создаётся отдельное число',o.G.fx.filter(f=>f.t==='num').length===2);
  o.c.pushDamageNumber(e,3,true);o.c.pushDamageNumber(e,4,true);
  ok('криты всегда остаются отдельными золотыми числами',o.G.fx.filter(f=>f.t==='num'&&f.crit).length===2);
  const other=enemy(o,20,0);o.c.pushDamageNumber(other,8,false);
  ok('числа разных целей никогда не объединяются',o.G.fx.some(f=>f.t==='num'&&f.numberOwner===other));
  o.c.pushDamageNumber(e,2,false,'#f00',0,-4,'dotFire',0.7);
  o.c.pushDamageNumber(e,2,false,'#0f0',0,-4,'dotPoison',0.7);
  ok('огонь и яд сохраняют отдельные цветные числа',o.G.fx.filter(f=>f.numberKind==='dotFire'||f.numberKind==='dotPoison').length===2);
}

{
  const o=fresh(),e=enemy(o);
  for(let i=0;i<1400;i++)o.c.pushDamageNumber(e,1,true);
  for(let i=0;i<700;i++)o.c.statusText(e,'TEST','#fff');
  ok('числа урона имеют отдельный визуальный потолок 1024',o.G.fx.filter(f=>f.budgetKind==='num').length===1024);
  ok('подписи статусов имеют отдельный визуальный потолок 512',o.G.fx.filter(f=>f.budgetKind==='status').length===512);
  o.c.pushTimedTelegraph({shape:'circle',kind:'damage',x:0,y:0,r:80},1);
  ok('визуальные потолки не блокируют обязательные телеграфы',o.G.fx.some(f=>f.t==='telegraph'));
  o.c.updateTransientEffects(2);
  ok('счётчики визуального бюджета освобождаются после истечения',o.G.transientFxCounts.num===0&&o.G.transientFxCounts.status===0);
}

{
  const {c,G}=fresh();c.pushScreenShake(0.08,2.5);c.pushScreenShake(0.15,7.5);c.pushScreenShake(0.10,3);
  const shakes=G.fx.filter(f=>f.t==='shake');
  ok('одновременные тряски объединяются в один объект',shakes.length===1);
  ok('объединённая тряска сохраняет максимум силы и времени',shakes[0].amp===7.5&&shakes[0].life===0.15);
}

{
  const {c,G}=fresh();c.pushTimedTelegraph({shape:'target',kind:'damage',x:10,y:20,r:40},0.01);
  c.updateTransientEffects(0.02);const trace=G.fx.find(f=>f.t==='telegraphTrace');
  ok('истёкший телеграф по-прежнему создаёт обязательный след',trace&&trace.shape==='target'&&trace.life===0.13);
}

{
  const {c,G,p}=fresh();p.inv=0;G.fx.push({t:'wave',x:p.x,y:p.y,r:0,spd:0,life:1,dmg:4,hit:false});
  c.updateTransientEffects(0.01);const hurt=G.fx.find(f=>f.t==='hurtNum');
  ok('опасная волна по-прежнему наносит урон ровно при прохождении',G.fx[0].hit&&p.hp<c.__api.D.life);
  ok('feedback, созданный волной во время прохода, начинает с полной жизни',hurt&&hurt.life===0.4);
}

{
  const html=require('./harness').loadInspectionSource('./index.html');
  ok('обновление частиц больше не использует покадровый splice',/function updateParticles[\s\S]{0,500}parts\[write\+\+\]=q/.test(html)&&!/function updateParticles[\s\S]{0,500}splice\(/.test(html));
  ok('обновление G.fx больше не использует покадровый splice',/function updateTransientEffects[\s\S]{0,1000}fx\[write\+\+\]=f/.test(html)&&!/function updateTransientEffects[\s\S]{0,1000}splice\(/.test(html));
  ok('телеграфы не проходят через декоративный лимит',/function pushTimedTelegraph\(spec,life\)\{\s*G\.fx\.push/.test(html));
}

{
  const o=fresh();
  const bench=vm.runInContext(`(()=>{
    const make=()=>Array.from({length:20000},(_,i)=>({t:i%3?'ring':'num',x:0,y:0,r:1,max:2,life:i%2?1:0}));
    const oldRun=()=>{const a=make(),start=Date.now();for(let i=a.length-1;i>=0;i--){a[i].life-=0.1;if(a[i].life<=0)a.splice(i,1);}return Date.now()-start;};
    const newRun=()=>{G.fx=make();G.fxPool.length=0;const start=Date.now();updateTransientEffects(0.1);return Date.now()-start;};
    oldRun();newRun();const median=fn=>Array.from({length:7},fn).sort((a,b)=>a-b)[3];
    const oldMs=median(oldRun),newMs=median(newRun);return{objects:20000,oldMs,newMs,speedup:oldMs/Math.max(0.1,newMs)};
  })()`,o.c);
  console.log('BENCH '+JSON.stringify(bench));
}

console.log(JSON.stringify({n,fail}));
if(fail)process.exitCode=1;
