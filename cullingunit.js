/* Консервативное render-culling: ни один видимый край, HUD или телеграф не пропадает. */
const {loadGame} = require('./sim');
const fs = require('fs');
const ok = (nm, cond, det='') => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(62) + det);

function fresh(){ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); return c; }
const box={ready:true,left:-100,top:-50,right:100,bottom:50};

{ const c=fresh();
  ok('круг, касающийся левой границы, остаётся видимым', c.renderCircleVisible(-110,0,10,box));
  ok('круг исчезает лишь после полного выхода за левую границу', !c.renderCircleVisible(-110.001,0,10,box));
  ok('крупный объект с центром вне экрана не отсекается', c.renderCircleVisible(135,0,40,box));
  ok('объект целиком выше экрана корректно отсекается', !c.renderCircleVisible(0,-71,20,box)); }

{ const c=fresh();
  ok('длинный коридор из-за экрана через экран остаётся видимым',
    c.renderAabbVisible(-180,0,180,0,12,box));
  ok('коридор целиком за верхней границей отсекается',
    !c.renderAabbVisible(-180,-70,180,-70,12,box));
  ok('телеграф-круг у края проверяется по радиусу, не по центру',
    c.renderTelegraphVisible({shape:'target',x:125,y:0,r:25},box));
  ok('телеграф-коридор от врага вне экрана не теряет пересечение',
    c.renderTelegraphVisible({shape:'corridor',x:180,y:0,x2:0,y2:0,width:20},box)); }

{ const c=fresh(), G=c.__api.G, p=G.player;
  const e=c.spawnEnemy('blob'); G.enemies=[e]; e.y=p.y;
  const first=c.prepareRenderView(p), right=first.right, radius=c.enemyBodyRenderRadius(e);
  e.x=right+radius;
  ok('модель врага на последнем видимом пикселе остаётся в проходе',
    c.prepareRenderView(p).enemyBodies.includes(e));
  e.x=right+radius+0.001;
  ok('модель врага отсекается только после полного выхода',
    !c.prepareRenderView(p).enemyBodies.includes(e)); }

{ const c=fresh(), G=c.__api.G, D=c.__api.D, p=G.player;
  const e=c.spawnEnemy('blob'); G.enemies=[e]; e.y=p.y;
  const right=c.prepareRenderView(p).right;
  e.ail.chill=1; e.x=right+D.chillAuraR+4.9;
  const view=c.prepareRenderView(p);
  ok('видимая охлаждающая аура сохраняет HUD врага за экраном',
    !view.enemyBodies.includes(e) && view.enemyHud.includes(e));
  e.ail.chill=0; e.pack={}; e.roles=['beacon']; e.x=right+184.9;
  ok('видимое кольцо роли пачки сохраняется при центре за экраном',
    c.prepareRenderView(p).enemyHud.includes(e)); }

{ const c=fresh(), G=c.__api.G, p=G.player;
  const boss=c.spawnEnemy('boss','vampire'); G.enemies=[boss]; boss.x=p.x;
  const initial=c.prepareRenderView(p), radius=c.enemyBodyRenderRadius(boss);
  boss.y=initial.top-radius;
  ok('крупный босс у верхней кромки остаётся видимым',
    c.prepareRenderView(p).enemyBodies.includes(boss)); }

{ const c=fresh(), G=c.__api.G, D=c.__api.D, p=G.player;
  const right=c.prepareRenderView(p).right;
  D.acceleratedArrow=1;
  const arrow={x:right+24.9,y:p.y,r:3,playerArrow:true,age:0.5,vx:500,vy:0};
  G.shots=[arrow];
  ok('хвост разогнанной стрелы у края не обрезается',
    c.prepareRenderView(p).playerShots.includes(arrow));
  arrow.x=right+c.playerShotRenderRadius(arrow)+0.001;
  ok('стрела отсекается после выхода тела и полного хвоста',
    !c.prepareRenderView(p).playerShots.includes(arrow)); }

{ const c=fresh();
  ok('квадратный PNG топора защищён радиусом по диагонали',
    c.enemyShotRenderRadius({shotType:'axe',r:15})>=Math.hypot(28,28));
  ok('PNG слизи и сферы Лича защищены по углам кадра',
    c.enemyShotRenderRadius({shotType:'slime',r:8})>=Math.hypot(10,10) &&
    c.enemyShotRenderRadius({shotType:'lich',r:12})>=Math.hypot(16,16));
  ok('квадратный спрайт взрыва проверяется по диагонали',
    c.renderEffectVisible({t:'mageOrbExplosion',x:135,y:0,r:25},box)); }

{ const c=fresh(), G=c.__api.G, p=G.player;
  const v=c.prepareRenderView(p), crossing={t:'bolt',x:v.left-200,y:p.y,x2:v.right+200,y2:p.y};
  const outside={t:'ring',x:v.right+80,y:p.y,r:30};
  const unknown={t:'futureImportantEffect',x:v.right+500,y:p.y};
  G.fx=[crossing,outside,unknown];
  const view=c.prepareRenderView(p);
  ok('молния с концами за экраном сохраняется при пересечении', view.impactFx.includes(crossing));
  ok('полностью невидимое известное кольцо отсекается', !view.impactFx.includes(outside));
  ok('неизвестный новый эффект по умолчанию не отсекается', view.impactFx.includes(unknown)); }

{ const c=fresh(), G=c.__api.G, p=G.player, base=c.spawnEnemy('blob');
  G.enemies=Array.from({length:500},(_,i)=>Object.assign({},base,{
    x:(i%25)*200-2400, y:Math.floor(i/25)*200-1900,
    ail:{chill:0,shock:0,stun:0,freeze:0,dizzy:0}, roles:[], aff:[]
  }));
  const visible=c.prepareRenderView(p).enemyBodies.length;
  ok('массовая сцена передаёт в отрисовку только видимые модели', visible>0 && visible<100,
    visible+'/500'); }

{ const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('рендер использует отдельные безопасные списки моделей и HUD',
    /pass==='entities'\?view\.enemyBodies:pass==='worldHud'\?view\.enemyHud:G\.enemies/.test(html));
  ok('телеграфы защищены собственной проверкой геометрии',
    /function drawTelegraph\(spec\)\{\s*if \(!renderTelegraphVisible\(spec\)\)/.test(html)); }
