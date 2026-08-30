/* Визуальная реакция игрока на урон: пороги, длительности и поглощение. */
const {loadGame} = require('./sim');
const fs = require('fs');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(54) + (det || ''));

function fresh(){ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); return c; }
function hit(c, amount){ c.hurt(amount,true,false,'ТЕСТОВЫЙ УДАР'); return c.__api.G; }
function shake(G){ return G.fx.find(f=>f.t==='shake'); }
function number(G){ return G.fx.find(f=>f.t==='hurtNum'); }
function healing(G){ return G.fx.find(f=>f.t==='healNum'); }

{ const c=fresh(), G=hit(c,4), p=G.player, s=shake(G);
  ok('слабый удар: flash 60 мс и shake 2.5 px', p.hitFlash===0.06 && s.amp===2.5 && s.life===0.08,
    p.hitFlash.toFixed(3)+'с · '+s.amp+'px');
  ok('слабый удар: нет hit-stop', G.hitStop===0);
  ok('слабый удар: четыре короткие Canvas-частицы', G.parts.length===4 && G.parts.every(q=>q.max>=0.10 && q.max<=0.20),
    G.parts.length+' част.'); }

{ const c=fresh(), G=hit(c,10), s=shake(G);
  ok('средний удар: shake 3 px на 100 мс', s.amp===3 && s.life===0.10,
    s.amp+'px · '+s.life.toFixed(2)+'с');
  ok('средний удар: виньетка сильнее слабой', G.hurtVignette===0.125 && G.hurtVignetteOpacity>0.25 && G.hitStop===0,
    'opacity '+G.hurtVignetteOpacity.toFixed(2)); }

{ const c=fresh(), G=hit(c,20), p=G.player, s=shake(G), n=number(G);
  ok('сильный удар: shake 5.5 px и hit-stop 30 мс', s.amp===5.5 && s.life===0.135 && G.hitStop===0.03,
    s.amp+'px · stop '+G.hitStop.toFixed(2)+'с');
  ok('сильный удар: крупная цифра живёт 400 мс', n && n.v==='-20' && n.life===0.4 && n.max===0.4,
    n && n.v);
  ok('сильный удар: шесть частиц и 150 мс HP-flash', G.parts.length===6 && p.hpFlash===0.15,
    G.parts.length+' част.');
  ok('HP-хвост хранит уровень до попадания', p.hpLag===1 && p.hp/c.__api.D.life<0.82,
    Math.round(p.hpLag*100)+'% → '+Math.round(p.hp/c.__api.D.life*100)+'%'); }

{ const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('delayed HP игрока имеет фиксированную длительность 0.4 секунды',
    /const PLAYER_HP_LAG_TIME=0\.4/.test(html)); }

{ const c=fresh(), G=hit(c,35), p=G.player;
  const hpNow=p.hp/c.__api.D.life;
  ok('удар на 35% сразу запускает полный 0.4-секундный хвост',
    p.hpLag===1 && p.hpLagFrom===1 && p.hpLagTimer===0.4);
  c.tickPlayerDamageFeedback(0.20);
  ok('через 0.2 секунды delayed HP проходит ровно половину пути',
    Math.abs(p.hpLag-(1+hpNow)/2)<1e-9 && Math.abs(p.hpLagTimer-0.20)<1e-9);
  c.tickPlayerDamageFeedback(0.20);
  ok('через 0.4 секунды светлая полоса догоняет настоящее здоровье',
    Math.abs(p.hpLag-hpNow)<1e-9 && p.hpLagTimer===0);
  hit(c,10); c.tickPlayerDamageFeedback(0.20); c.heal(40); c.tickPlayerDamageFeedback(0.01);
  ok('лечение выше delayed-полосы синхронизирует хвост сразу',
    Math.abs(p.hpLag-p.hp/c.__api.D.life)<1e-9 && p.hpLagTimer===0); }

{ const c=fresh(), G=hit(c,40), s=shake(G);
  ok('максимальный удар: shake 7.5 px и hit-stop 40 мс', s.amp===7.5 && s.life===0.15 && G.hitStop===0.04,
    s.amp+'px · stop '+G.hitStop.toFixed(2)+'с');
  const time=G.time; c.render=()=>{}; c.loop(16);
  ok('hit-stop замораживает action, но отсчитывается по RAF', G.time===time && G.hitStop<0.04,
    'action '+G.time.toFixed(3)+' · осталось '+G.hitStop.toFixed(3)+'с'); }

{ const c=fresh(), G=c.__api.G, p=G.player;
  p.barrier=20; c.hurt(10,true,false,'ПОГЛОЩЕНО');
  ok('полностью поглощённый удар не запускает feedback', p.hp===c.__api.D.life && !number(G) && !shake(G) && G.hurtVignette===0); }

{ const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('HUD содержит белый хвост и класс вспышки HP-бара', /id="hpbar"><b><\/b><i/.test(html) && /#hpbar\.hurt/.test(html));
  ok('виньетка рисуется экранным radial gradient', /hurtVignette > 0/.test(html) && /createRadialGradient\(W\/2,H\/2/.test(html));
  ok('под моделью героя рисуется компактный HP-бар', /function drawPlayerHealthBar\(p\)/.test(html) && /const w=34,h=4/.test(html));
  ok('мировой HP-бар использует HP и белый хвост HUD', /drawPlayerHealthBar\(p\);/.test(html) && /p\.hp\/D\.life/.test(html) && /p\.hpLag/.test(html)); }

{ const c=fresh(), G=c.__api.G, p=G.player;
  p.hp-=10; c.heal(1); const n=healing(G);
  ok('лечение от 1 HP создаёт зелёное число', n && n.v==='+1' && n.life===0.4 && n.max===0.4, n && n.v); }

{ const c=fresh(), G=c.__api.G, p=G.player;
  p.hp-=10; c.heal(0.8); const n=healing(G);
  ok('дробное лечение 0.8 HP создаёт зелёное число', n && n.v==='+0.8' && n.amount===0.8,
    n && n.v); }

{ const c=fresh(), G=c.__api.G, p=G.player;
  p.hp-=10; c.heal(0.4); c.heal(0.4);
  let nums=G.fx.filter(f=>f.t==='healNum');
  const merged=nums.length===1 && nums[0].v==='+0.8' && Math.abs(nums[0].amount-0.8)<1e-9;
  G.time+=0.13; c.heal(0.4); nums=G.fx.filter(f=>f.t==='healNum');
  ok('частые мелкие тики объединяются только в коротком окне',merged && nums.length===2 && nums[1].v==='+0.4',
    nums.map(x=>x.v).join(' · ')); }

{ const c=fresh(), G=c.__api.G, p=G.player;
  p.hp-=5; c.heal(100); const n=healing(G);
  ok('число показывает фактический хил без перелечения', p.hp===c.__api.D.life && n && n.v==='+5', n && n.v); }

{ const c=fresh(), G=c.__api.G;
  c.heal(100);
  ok('лечение при полном HP не создаёт число', !healing(G)); }

{ const c=fresh(), G=c.__api.G, p=G.player;
  p.hp-=2; c.dreadRecover(2); const n=healing(G);
  ok('поток Ужасающего вампира использует зелёные числа', n && n.v==='+2'); }

{ const c=fresh(), p=c.__api.G.player;
  p.barrier=6.2; const txt=c.playerHealthText(p);
  ok('главный HP-бар показывает текущий барьер числом', txt.includes('+7 barrier'), txt); }

{ const c=fresh(), p=c.__api.G.player;
  p.barrier=6.2; p.dreadShield=4.1; const txt=c.playerHealthText(p);
  ok('барьер Воина не скрывает отдельный щит вампира', txt.includes('+7 barrier') && txt.includes('(+5 shield)'), txt); }

{ const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('мини-бар рисует голубой сегмент по сумме барьеров', /barrier=clamp\(totalPlayerBarrier\(p\)\/D\.life/.test(html) &&
    /fillStyle='#5ec2e0'.*w\*barrier,2/.test(html)); }
