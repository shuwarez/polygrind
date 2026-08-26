/* Полный прогон партии: бот играет, карточки берутся автоматически.
   Отличия от step() из sim.js: бот идёт в портал (иначе этаж не сменится)
   и НЕ обнуляет G.pending — иначе билд не растёт весь прогон. */
const {loadGame, DT} = require('./sim');

function pickCard(c){
  const G = c.__api.G;
  let guard = 0;
  while (G.pending > 0 && guard++ < 50){
    const cards = c.rollCards();
    if (!cards.length){ G.pending = 0; break; }
    const m = cards[Math.floor(Math.random()*cards.length)];
    const v = m.r[0] === m.r[1] ? m.r[0] : m.r[0] + Math.random()*(m.r[1]-m.r[0]);
    G.bag.add(m.stat, m.kind, v);
    G.picks.push({id:m.id, nm:m.nm, val:'', cat:m.cat});
    c.recalc();
    G.pending--;
  }
}

function botStep(c, immortal){
  const G = c.__api.G, D = c.__api.D, p = G.player;
  const k = G.keys;
  for (const key in k) k[key] = false;
  let tgt = null;
  // 1. Лужи и волны — уходим
  let sx=0, sy=0, n=0;
  for (const pl of (G.pools||[])){
    if (Math.hypot(pl.x-p.x, pl.y-p.y) < pl.r + p.r + 60){ sx+=pl.x; sy+=pl.y; n++; }
  }
  let flee = n ? {x:sx/n, y:sy/n} : null;
  if (!flee) for (const f of G.fx){
    if (f.t !== 'wave' || f.hit) continue;
    const d = Math.hypot(f.x-p.x, f.y-p.y);
    if (d > f.r && d - f.r < 150){ flee = {x:f.x, y:f.y}; break; }
  }
  if (flee){
    const ax = p.x - flee.x, ay = p.y - flee.y;
    if (ax >  8) k['d'] = true; if (ax < -8) k['a'] = true;
    if (ay >  8) k['s'] = true; if (ay < -8) k['w'] = true;
    if (!k['a'] && !k['d'] && !k['w'] && !k['s']) k['d'] = true;
  } else if (G.portal && !G.enemies.length){
    tgt = G.portal;                                   // этаж зачищен — идём в портал
    const dx = tgt.x - p.x, dy = tgt.y - p.y;
    if (dx >  6) k['d'] = true; if (dx < -6) k['a'] = true;
    if (dy >  6) k['s'] = true; if (dy < -6) k['w'] = true;
  } else {
    let near = null, bd = 1e9;
    for (const e of G.enemies){ const d = Math.hypot(e.x-p.x, e.y-p.y); if (d < bd){ bd=d; near=e; } }
    const melee = G.weapon.type === 'melee';
    if (melee && near && bd > 60){
      const dx = near.x - p.x, dy = near.y - p.y;
      if (dx >  15) k['d'] = true; if (dx < -15) k['a'] = true;
      if (dy >  15) k['s'] = true; if (dy < -15) k['w'] = true;
    } else if (!melee && near && bd < 300){
      const ax = p.x - near.x, ay = p.y - near.y;
      if (ax >  20) k['d'] = true; if (ax < -20) k['a'] = true;
      if (ay >  20) k['s'] = true; if (ay < -20) k['w'] = true;
      if (p.x >  1350){ k['d']=false; k['a']=true; }
      if (p.x < -1350){ k['a']=false; k['d']=true; }
      if (p.y >  1350){ k['s']=false; k['w']=true; }
      if (p.y < -1350){ k['w']=false; k['s']=true; }
    } else if (!near && G.enemies.length === 0 && !G.portal){
      k['d'] = true;                                  // ждём волну, не стоим столбом
    }
  }
  const before = p.hp;
  c.update(DT);
  if (immortal) p.hp = D.life;
  return Math.max(0, before - p.hp);
}

function play(c, wep, {maxSec=1200, immortal=false, maxFloor=1e9}={}){
  c.newGame(wep, 'keys');
  const G = c.__api.G, p = G.player;
  const perFloor = [];
  let gPrev = 0, t = 0, tF = 0, fPrev = 1, dead = false;
  while (t < maxSec && G.floor <= maxFloor){
    botStep(c, immortal);
    if (p.hp <= 0){ dead = true; break; }
    pickCard(c);
    t += DT;
    if (G.floor !== fPrev){
      perFloor.push({f:fPrev, gold:Math.round(G.gold - gPrev), sec:+(t - tF).toFixed(1), lvl:G.lvl});
      gPrev = G.gold; tF = t; fPrev = G.floor;
    }
    if (!isFinite(p.hp) || isNaN(p.hp)) throw new Error('NaN hp, этаж ' + G.floor);
    if (!isFinite(G.gold) || isNaN(G.gold)) throw new Error('NaN gold, этаж ' + G.floor);
  }
  return {floor:G.floor, lvl:G.lvl, gold:Math.floor(G.gold), t, dead, perFloor};
}
module.exports = {play, pickCard, botStep};

if (require.main === module){
  const file = process.argv[2] || './PolyGrind.html';
  const N = +(process.argv[3] || 6);
  for (const w of ['bow','wand','necro','blade']){
    const res = [];
    for (let i=0;i<N;i++){ const c = loadGame(file); res.push(play(c, w, {maxSec:900})); }
    const avg = k => res.reduce((s,r)=>s+r[k],0)/res.length;
    const fl = res.map(r=>r.floor).sort((a,b)=>a-b);
    const gd = res.map(r=>r.gold).sort((a,b)=>a-b);
    console.log(w.padEnd(6),
      'этаж', avg('floor').toFixed(1), '[' + fl[0] + '..' + fl[fl.length-1] + ']',
      '| ур', avg('lvl').toFixed(1),
      '| золото', Math.round(avg('gold')), '[' + gd[0] + '..' + gd[gd.length-1] + ']',
      '| время', avg('t').toFixed(0) + 'с',
      '| смертей', res.filter(r=>r.dead).length + '/' + N);
  }
}
