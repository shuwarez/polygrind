/* Общие утилиты симуляции для замеров. */
const {loadGame} = require('./harness');
const DT = 1/60;

function autoLevel(c, target){
  const G = c.__api.G;
  while (G.lvl < target){
    G.lvl++;
    G.xpNext = Math.round(14 * Math.pow(1.17, G.lvl-1));
    const cards = c.rollCards();
    if (!cards.length) continue;
    const m = cards[Math.floor(Math.random()*cards.length)];
    const v = c.rollModValue(m);
    G.bag.add(m.stat, m.kind, v);
    G.picks.push({id:m.id, nm:m.nm, val:'', cat:m.cat});
    c.recalc();
  }
  G.pending = 0;
  G.player.hp = c.__api.D.life;
}

function step(c, {immortal=true, dodge=false}={}){
  const G = c.__api.G, D = c.__api.D, p = G.player;
  let near = null, bd = 1e9;
  let flee = null;
  if (dodge){
    let sx=0, sy=0, n=0;
    for (const pl of (G.pools||[])){
      if (Math.hypot(pl.x-p.x, pl.y-p.y) < pl.r + p.r + 60){ sx+=pl.x; sy+=pl.y; n++; }
    }
    if (n) flee = {x:sx/n, y:sy/n};
    if (!flee) for (const f of G.fx){
      if (f.t !== 'wave' || f.hit) continue;
      const d = Math.hypot(f.x-p.x, f.y-p.y);
      if (d > f.r && d - f.r < 150){ flee = {x:f.x, y:f.y}; break; }
    }
  }
  for (const e of G.enemies){ const d = Math.hypot(e.x-p.x, e.y-p.y); if (d < bd){ bd=d; near=e; } }
  const k = G.keys;
  for (const key in k) k[key] = false;
  if (flee){
    const ax = p.x - flee.x, ay = p.y - flee.y;
    if (ax >  8) k['d'] = true; if (ax < -8) k['a'] = true;
    if (ay >  8) k['s'] = true; if (ay < -8) k['w'] = true;
    if (!k['a'] && !k['d'] && !k['w'] && !k['s']) k['d'] = true;
    const hp0 = p.hp; c.update(DT);
    const tk = Math.max(0, hp0 - p.hp);
    if (immortal) p.hp = D.life;
    G.pending = 0; return tk;
  }
  const melee = G.weapon.type === 'melee';
  if (melee && near){
    const dx = near.x - p.x, dy = near.y - p.y;
    if (bd > 60){
      if (dx >  15) k['d'] = true; if (dx < -15) k['a'] = true;
      if (dy >  15) k['s'] = true; if (dy < -15) k['w'] = true;
    }
  }
  else if (near && bd < 300){
    const ax = p.x - near.x, ay = p.y - near.y;
    if (ax >  20) k['d'] = true; if (ax < -20) k['a'] = true;
    if (ay >  20) k['s'] = true; if (ay < -20) k['w'] = true;
    if (p.x >  1350){ k['d']=false; k['a']=true; }
    if (p.x < -1350){ k['a']=false; k['d']=true; }
    if (p.y >  1350){ k['s']=false; k['w']=true; }
    if (p.y < -1350){ k['w']=false; k['s']=true; }
  }
  const before = p.hp;
  c.update(DT);
  const taken = Math.max(0, before - p.hp);
  if (immortal) p.hp = D.life;
  G.pending = 0;
  return taken;
}

module.exports = { loadGame, autoLevel, step, DT };
