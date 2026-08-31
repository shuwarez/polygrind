/* Камера: фиксированный центр героя, zoom мира, culling и точная мышь. */
const fs=require('fs');
const {loadGame}=require('./harness');
let n=0,fail=0;
function ok(name,yes,got=''){
  n++;if(!yes)fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ')+name.padEnd(67)+got);
}
function fresh(options={}){const c=loadGame('./PolyGrind.html',options);c.newGame('bow','keys');return c;}
function centered(c,p){
  const frame=c.prepareCameraFrame(p),hero=c.worldToScreen(p.x,p.y,p,0,0,frame);
  return Math.abs(hero.x-640)<1e-9&&Math.abs(hero.y-360)<1e-9;
}
const html=fs.readFileSync('./PolyGrind.html','utf8');

{const c=fresh(),G=c.__api.G,p=G.player,frame=c.prepareCameraFrame(p),view=c.prepareRenderView(p,0,0,frame);
  const center=c.worldToScreen(frame.centerX,frame.centerY,p,0,0,frame),screenW=center.x*2,screenH=center.y*2;
  ok('масштаб мира равен 0.95',Math.abs(frame.scale-0.95)<1e-12,String(frame.scale));
  ok('видимая область расширена на 5.3% по обеим осям',
    Math.abs((view.right-view.left)/(screenW)-1/0.95)<1e-9&&Math.abs((view.bottom-view.top)/(screenH)-1/0.95)<1e-9);
  ok('новый забег начинается с героем точно в центре экрана',centered(c,p));}

{const c=fresh(),G=c.__api.G,p=G.player,frame=c.prepareCameraFrame(p,9,-6),view=c.prepareRenderView(p,9,-6,frame);
  ok('центр culling учитывает только героя и экранную тряску',
    Math.abs(view.centerX-(p.x-9/0.95))<1e-9&&Math.abs(view.centerY-(p.y+6/0.95))<1e-9);
  const point={x:321.25,y:-187.75},screen=c.worldToScreen(point.x,point.y,p,9,-6,frame);
  const back=c.screenToWorld(screen.x,screen.y,p,9,-6,frame);
  ok('worldToScreen и screenToWorld являются точными обратными функциями',
    Math.abs(back.x-point.x)<1e-9&&Math.abs(back.y-point.y)<1e-9);}

{const c=fresh(),G=c.__api.G,p=G.player,x0=p.x;G.keys.d=true;c.update(0.10);
  ok('обычное движение не сдвигает героя от центра экрана',p.x>x0&&centered(c,p));}

{const c=fresh(),G=c.__api.G,p=G.player;G.keys.d=true;const x0=p.x;c.tryDash();c.update(0.04);
  ok('рывок не сдвигает героя от центра экрана',p.x>x0&&centered(c,p));}

{const c=fresh(),G=c.__api.G,p=G.player,x0=p.x;p.vx=180;c.update(0.05);
  ok('отбрасывание не сдвигает героя от центра экрана',p.x>x0&&centered(c,p));}

ok('состояние, коэффициенты и обновление упреждения полностью удалены',
  !html.includes('CAMERA_LEAD')&&!html.includes('updateCameraLead')&&!html.includes('resetCameraLead')&&
  !html.includes('lookX')&&!html.includes('lookY')&&!/camera:\{/.test(html));

{const c=fresh(),G=c.__api.G,p=G.player;G.control='mouse';
  const inside=c.worldToScreen(p.x+33,p.y,p);G.mouse.x=inside.x;G.mouse.y=inside.y;c.update(0.01);
  ok('MOUSE_DEADZONE проверяется в мировых координатах камеры',!p.moving);
  const outside=c.worldToScreen(p.x+35,p.y,p);G.mouse.x=outside.x;G.mouse.y=outside.y;const x0=p.x;c.update(0.01);
  ok('мышь сразу за мировой deadzone движет героя точно к курсору',p.moving&&p.x>x0&&centered(c,p));}

{const c=fresh(),G=c.__api.G,p=G.player;
  const target={x:300,y:-170},screen=c.worldToScreen(target.x,target.y,p),world=c.screenToWorld(screen.x,screen.y,p);
  const worldAim=Math.atan2(target.y-p.y,target.x-p.x),cursorAim=Math.atan2(world.y-p.y,world.x-p.x);
  ok('направление на экранный курсор совпадает с направлением в мире',Math.abs(worldAim-cursorAim)<1e-12);
  const view=c.prepareRenderView(p),e=c.spawnEnemy('blob'),r=c.enemyBodyRenderRadius(e);G.enemies=[e];e.y=view.centerY;e.x=view.right+r;
  ok('culling сохраняет объект, касающийся zoom-границы',c.prepareRenderView(p).enemyBodies.includes(e));}

ok('каждый мировой Canvas-pass получает один и тот же camera frame',
  /for \(const pass of CANVAS_RENDER_PASSES\) renderCanvasPass\(pass,p,sx,sy,view,camera\)/.test(html));
ok('мир использует translate-scale-translate с центром строго на герое',
  /ctx\.translate\(W\/2\+camera\.shakeX,H\/2\+camera\.shakeY\);[\s\S]{0,120}ctx\.scale\(camera\.scale,camera\.scale\);[\s\S]{0,120}ctx\.translate\(-camera\.centerX,-camera\.centerY\)/.test(html)&&
  /return \{scale:CAMERA_SCALE,centerX:p\.x,centerY:p\.y,/.test(html));
ok('из параметров камеры остался только масштаб 0.95',
  /const CAMERA_SCALE = 0\.95;/.test(html)&&!html.includes('CAMERA_LEAD_RATIO')&&!html.includes('CAMERA_LEAD_RESPONSE'));
ok('Boss HUD и виньетка остаются экранными и не попадают под zoom мира',
  /if \(pass==='bossHud'\)\{\s*ctx\.save\(\); drawBossHud\(\); ctx\.restore\(\); return;\s*\}/.test(html)&&
  /for \(const pass of CANVAS_RENDER_PASSES\)[\s\S]*?if \(G\.hurtVignette > 0\)/.test(html));
ok('пол и запасная сетка строятся по масштабированным границам view',
  /Math\.floor\(viewLeft\/step\)/.test(html)&&/viewRight\+step/.test(html)&&/viewBottom\+step/.test(html));
ok('мышь и нарисованный курсор используют единое обратное преобразование',
  (html.match(/screenToWorld\(G\.mouse\.x,G\.mouse\.y,p/g)||[]).length>=3&&
  /Math\.hypot\(stableCursor\.x-p\.x,stableCursor\.y-p\.y\)<=MOUSE_DEADZONE/.test(html));

console.log(JSON.stringify({n,fail}));
process.exitCode=fail?1:0;
