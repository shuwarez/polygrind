/* Полный прогон партии: бот играет, карточки берутся автоматически.
   Отличия от step() из sim.js: бот идёт в портал (иначе этаж не сменится)
   и НЕ обнуляет G.pending — иначе билд не растёт весь прогон. */
const {loadGame, DT} = require('./sim');

const COMMON_GOOD = new Set(['dmg','aspd','life','armor','mspd','critCh','critMul','dblHit','deadlyHit',
  'onHit','onKill','regen','dr','drFlat','block','dodge','normalDr','majorDr','cheat']);
const RANGED_GOOD = new Set(['dmgProj','projN','pierce','chain','ricochet','projSize','projSpd','far','homing']);
const BLADE_GOOD = new Set(['dmgMelee','arc','close','perNear','knock','stun','dizzy','phasing','thorns','reflect']);
const NECRO_GOOD = new Set(['minDmg','minAspd','minLife','minSpd','minCrit','minCount','minTier','minInherit',
  'minBond','kBoneChallenge','minVamp','minBoom','minClaws','minFrenzy','minBath','minBoil','minBlink','minRaid']);
function cardScore(c, m){
  const w = c.__api.G.weapon, stat = m.stat;
  let score = COMMON_GOOD.has(stat) ? 5 : 1;
  if (w.minions) score += NECRO_GOOD.has(stat) ? 12 : (RANGED_GOOD.has(stat) || stat === 'dmgMelee' ? -8 : 0);
  else if (w.type === 'melee') score += BLADE_GOOD.has(stat) ? 9 : (RANGED_GOOD.has(stat) ? -8 : 0);
  else score += RANGED_GOOD.has(stat) ? 7 : (BLADE_GOOD.has(stat) ? -5 : 0);
  if (w.type === 'orb' && ['aoeR','dmgAoe','aoeToDmg'].includes(stat)) score += 8;
  if (m.kind === 'more') score += 4;
  score += (m.rar || 0) * 0.5;
  return score;
}

function pickCard(c, random=Math.random, strategy='random'){
  const G = c.__api.G;
  let guard = 0;
  while (G.pending > 0 && guard++ < 50){
    const cards = c.rollCards();
    if (!cards.length){ G.pending = 0; break; }
    const m = strategy === 'smart'
      ? cards.map((m,i)=>({m,i,s:cardScore(c,m)})).sort((a,b)=>b.s-a.s || a.i-b.i)[0].m
      : cards[Math.floor(random()*cards.length)];
    const v = c.rollModValue(m, random);
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
  let tgt = null, near = null, bd = 1e9;
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
  for (const e of G.enemies){ const d = Math.hypot(e.x-p.x, e.y-p.y); if (d < bd){ bd=d; near=e; } }
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
  // Бот обязан использовать базовый рывок: без него замер проверял персонажа,
  // который игнорирует одну из двух доступных игроку боевых кнопок. Рывок
  // тратится только при реальной угрозе контакта или во время выхода из зоны.
  if (p.dashN > 0 && p.dash <= 0 && ((near && bd < (G.weapon.type === 'melee' ? 52 : 72)) || flee))
    c.tryDash();
  if (immortal) p.hp = 1e12;                         // не вызываем gameOver в замере контрольных этажей
  const before = immortal ? D.life : p.hp;
  c.update(DT);
  if (immortal) p.hp = D.life;
  return immortal ? 0 : Math.max(0, before - p.hp);
}

function play(c, wep, {maxSec=1200, immortal=false, maxFloor=1e9, subclass=null,
  random=Math.random, strategy='random'}={}){
  c.newGame(wep, 'keys', subclass);
  const G = c.__api.G, D = c.__api.D, p = G.player;
  const perFloor = [];
  let gPrev = 0, dmgPrev = 0, takenPrev = 0, t = 0, tF = 0, fPrev = 1, dead = false;
  while (t < maxSec && G.floor <= maxFloor){
    botStep(c, immortal);
    if (p.hp <= 0){ dead = true; break; }
    pickCard(c, random, strategy);
    t += DT;
    if (G.floor !== fPrev){
      const sec = t - tF, damage = G.stats.damage - dmgPrev;
      perFloor.push({f:fPrev, gold:Math.round(G.gold - gPrev), sec:+sec.toFixed(1), lvl:G.lvl,
        damage:Math.round(damage), dps:+(damage/Math.max(DT,sec)).toFixed(1),
        taken:Math.round(G.stats.taken-takenPrev), life:Math.round(D.life)});
      gPrev = G.gold; dmgPrev = G.stats.damage; takenPrev = G.stats.taken; tF = t; fPrev = G.floor;
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
