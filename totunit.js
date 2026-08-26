/* Тотемы: ранги, проценты, условие статуса, дроп и потолок. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(46) + (det||''));
function mk(totems){
  const c = loadGame('./PolyGrind.html');
  c.newGame('necro','keys');
  const G = c.__api.G;
  G.lvl = 25;
  Object.assign(G.totems, totems || {});
  c.recalc();
  G.floor = 12; c.buildFloor();
  G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0;
  const p = G.player; p.hp = c.__api.D.life;
  return {c, G, D:c.__api.D, p};
}
function foe(o){
  const e = o.c.spawnEnemy();
  e.maxHp = e.hp = 1e12; e.spd = 0; e.dmg = 0; e.x = o.p.x+40; e.y = o.p.y;
  e.kind = 'norm'; e.armor = 0; e.ward = null; e.bulwark = 0;
  return e;
}

console.log('РАНГИ И ПРОЦЕНТЫ');
{ const o = mk({});
  const vals = [1,2,3,4].map(t => { const x = mk({fire:t}); const e = foe(x); e.dots.fire.dps = 5;
    const base = x.c.conditionalInc(e, {}); e.dots.fire.dps = 0;
    return base - x.c.conditionalInc(e, {}); });
  ok('огонь: 2 / 4 / 6 / 10 по рангам', vals.join(',') === '2,4,6,10', vals.join(' \u2192 ')); }
{ const o = mk({freeze:4}); const e = foe(o);
  e.ail.freeze = 2; const on = o.c.conditionalInc(e, {});
  e.ail.freeze = 0; const off = o.c.conditionalInc(e, {});
  ok('заморозка: только по замороженным', on-off === 10); }
{ const o = mk({poison:3}); const e = foe(o);
  e.dots.poison.dps = 4; const on = o.c.conditionalInc(e, {});
  e.dots.poison.dps = 0; const off = o.c.conditionalInc(e, {});
  ok('отравление: только по отравленным', on-off === 6); }
{ const o = mk({blood:2}); const e = foe(o);
  e.dots.bleed.dps = 4; const on = o.c.conditionalInc(e, {});
  e.dots.bleed.dps = 0; const off = o.c.conditionalInc(e, {});
  ok('кровь: только по кровоточащим', on-off === 4); }
{ const o = mk({fire:4, poison:4}); const e = foe(o);
  e.dots.fire.dps = 5; e.dots.poison.dps = 5;
  const both = o.c.conditionalInc(e, {});
  e.dots.fire.dps = 0; e.dots.poison.dps = 0;
  ok('тотемы складываются', both - o.c.conditionalInc(e, {}) === 20, '+20% за огонь и яд'); }

console.log('НА УДАРЕ');
{ const avg = (tot, burn) => {
    const o = mk(tot); const e = foe(o); o.c.spawnMinion();
    let s = 0;
    for (let i=0;i<2000;i++){ e.dots.fire.dps = burn ? 5 : 0; const h = e.hp; o.c.damage(e, {}); s += h - e.hp; }
    return s/2000;
  };
  const off = avg({fire:4}, false), on = avg({fire:4}, true);
  ok('великий тотем даёт +10% на ударе', Math.abs(on/off - 1.10) < 0.03,
     off.toFixed(1) + ' \u2192 ' + on.toFixed(1)); }
{ const avgM = (burn) => {
    const o = mk({fire:4}); const e = foe(o);
    o.G.minions.length = 0; o.c.spawnMinion();
    const m = o.G.minions[0]; m.x = e.x; m.y = e.y;
    let s = 0;
    for (let i=0;i<2000;i++){ e.dots.fire.dps = burn ? 5 : 0; const h = e.hp; o.c.minionHit(e, m); s += h - e.hp; }
    return s/2000;
  };
  const off = avgM(false), on = avgM(true);
  ok('тотем действует и на удар свиты', Math.abs(on/off - 1.10) < 0.04,
     off.toFixed(1) + ' \u2192 ' + on.toFixed(1)); }

console.log('ДРОП');
{ const c = loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G = c.__api.G;
  let tot = 0, amu = 0, book = 0;
  for (let i=0;i<40000;i++){
    G.orbs.length = 0; G.amu = {}; G.totems = {};
    c.dropItem({x:0,y:0});
    const o = G.orbs[0];
    if (o.totem) tot++; else if (o.amu) amu++; else book++;
  }
  ok('доля тотемов среди находок ~25%', Math.abs(tot/40000 - 0.25) < 0.02,
     'тотемы ' + (tot/400).toFixed(1) + '% · предметы ' + (amu/400).toFixed(1) + '% · книги ' + (book/400).toFixed(1) + '%'); }
{ const c = loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G = c.__api.G;
  G.totems = {fire:4, freeze:4, poison:4, blood:4};
  let tot = 0;
  for (let i=0;i<8000;i++){ G.orbs.length = 0; G.amu = {}; c.dropItem({x:0,y:0}); if (G.orbs[0].totem) tot++; }
  ok('великие тотемы больше не выпадают', tot === 0); }
{ const c = loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G = c.__api.G;
  G.totems = {fire:4};
  let seen = new Set();
  for (let i=0;i<8000;i++){ G.orbs.length = 0; G.amu = {}; c.dropItem({x:0,y:0}); if (G.orbs[0].totem) seen.add(G.orbs[0].totem); }
  ok('выпавший до предела тип выбывает из пула', !seen.has('fire') && seen.size === 3,
     'в пуле: ' + [...seen].join(', ')); }
