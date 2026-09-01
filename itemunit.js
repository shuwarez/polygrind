/* Поштучная проверка 13 новых предметов. */
const {loadGame} = require('./sim');
const DT = 1/60;
function mk(ids, floor){
  const c = loadGame('./GrimGrind.html');
  c.newGame('bow','keys');
  const G = c.__api.G;
  for (const i of [].concat(ids)) G.amu[i] = true;
  G.lvl = 25; c.recalc();
  G.floor = floor || 10; c.buildFloor();
  G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0; G.portal = null;
  G.player.hp = c.__api.D.life;
  return {c, G, D:c.__api.D, p:G.player};
}
function foe(c, x, y, hp){
  const e = c.spawnEnemy(); e.x = x; e.y = y; e.spd = 0;
  if (hp){ e.maxHp = e.hp = hp; }
  return e;
}
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(40) + (det||''));

console.log('ПЕРЧАТКИ');
{ const a = mk([]), b = mk(['claws']);
  ok('когти: +20% скорости атаки', Math.abs(b.D.aspd/a.D.aspd-1.2)<0.001);
  const {c,D,p} = b; const e = foe(c, p.x+80, p.y);
  p.hp = D.life; const full = c.conditionalInc(e);
  p.hp = D.life*0.35; const low = c.conditionalInc(e);
  ok('когти: +1% за каждые 10% потери', Math.abs(low-full-6)<0.01,
     'на 65% потерянного здоровья +' + (low-full) + '% урона'); }
{ const {c,G,D,p} = mk(['thunder']);
  const e = foe(c, p.x+80, p.y, 1e9); foe(c, p.x+120, p.y, 1e9);
  let shocks = 0;
  for (let i=1;i<=120;i++){ e.ail.shock = 0; c.damage(e, {}); if (e.ail.shock > 0) shocks++; }
  ok('перчатки грома: шок каждый 12-й удар', shocks === 10, 'проков ' + shocks + ' на 120 ударов'); }
{ const a = mk([]), b = mk(['ricochet']);
  ok('перчатки рикошета: +1 отскок', b.D.chain - a.D.chain === 1, a.D.chain + ' \u2192 ' + b.D.chain); }
{ const a = mk([]), b = mk(['brute']);
  ok('громила: −10% скорости атаки', Math.abs(b.D.aspd/a.D.aspd-0.9)<0.001);
  ok('громила: +50 к шансу отбрасывания', b.D.knock - a.D.knock === 50, 'шанс ' + b.D.knock + '%');
  ok('громила: толчок в 1.5 раза сильнее', b.D.knockPow === 1.5); }

console.log('БОТИНКИ');
{ const {c,G,D,p} = mk(['lava']);
  p.moving = true;
  for (const k in G.keys) G.keys[k] = false; G.keys['d'] = true;
  const e = foe(c, p.x+20, p.y, 1e6);
  const hp0 = e.hp;
  for (let i=0;i<60;i++){ G.keys['d'] = true; c.update(DT); G.pending = 0; e.x = p.x - 10; e.y = p.y; }
  ok('ботинки лавы: след жжёт врага', e.hp < hp0 && G.trails.length > 0,
     'узлов ' + G.trails.length + ', снято ' + Math.round(hp0-e.hp)); }
{ // Урон следа зависит от скорости бега. Зовём tickTrail напрямую, без update():
  // иначе в замер попадает автоатака по тому же врагу и топит эффект в шуме.
  const run = (inc) => {
    const o = mk(['lava']);
    const {c,G,D,p} = o;
    if (inc){ G.bag.add('mspd','inc',inc); c.recalc(); }
    const e = foe(c, p.x, p.y, 1e9); const hp0 = e.hp;
    p.moving = true;
    for (let i=0;i<180;i++){ c.tickTrail(DT); e.x = p.x; e.y = p.y; }
    return hp0 - e.hp;
  };
  const slow = run(0), fast = run(100);
  ok('ботинки лавы: урон растёт от скорости', Math.abs(fast/slow - 2) < 0.15,
     Math.round(slow) + ' при 235 \u2192 ' + Math.round(fast) + ' при 470 (x' + (fast/slow).toFixed(2) + ')'); }

{ const {c,G,D,p} = mk(['frost']);
  const e = foe(c, p.x, p.y, 1e6);
  for (let i=0;i<30;i++){ G.keys['d'] = true; c.update(DT); G.pending = 0; e.x = p.x-8; e.y = p.y; }
  ok('ботинки морозилки: след охлаждает', e.ail.chill > 0, 'охлаждение ' + e.ail.chill.toFixed(2) + ' сек'); }

console.log('КОЛЬЦА');
{ const {c,G,D,p} = mk(['pulse']);
  const e = foe(c, p.x+80, p.y, 1e9), o = foe(c, p.x+110, p.y, 1e9);
  let waves = 0;
  for (let i=1;i<=80;i++){ const h0 = o.hp; c.damage(e, {}); if (o.hp < h0) waves++; }
  ok('кольцо импульса: волна каждый 8-й удар', waves === 10, 'волн ' + waves + ' на 80 ударов'); }
{ const {c,G,D,p} = mk(['exec']);
  const e = foe(c, p.x+80, p.y, 1000);
  e.hp = 1000; const full = c.conditionalInc(e);
  e.hp = 150;  const low  = c.conditionalInc(e);
  ok('кольцо добивания: +50% ниже 20%', Math.abs(low-full-50)<0.01); }
{ const {c,G,D,p} = mk(['duel']);
  const e = foe(c, p.x+80, p.y, 1e9);
  const one = (n) => { let s = 0; for (let i=0;i<n;i++){ const h = e.hp; c.damage(e,{}); s += h-e.hp; } return s/n; };
  const solo = one(400);
  foe(c, p.x+120, p.y, 1e9);                      // второй враг рядом — множитель гаснет
  const pair = one(400);
  ok('кольцо дуэли: x1.75 один на один', Math.abs(solo/pair-1.75)<0.08,
     Math.round(pair) + ' \u2192 ' + Math.round(solo) + ' (x' + (solo/pair).toFixed(2) + ')'); }
{ const {c,G,D,p} = mk(['reaper']);
  p.kills = 99;
  const e = foe(c, p.x+80, p.y, 1e9);
  c.killEnemy(foe(c, p.x+200, p.y, 1), 1);        // сотое убийство
  const armed = p.reaper;
  c.damage(e, {});
  ok('кольцо смерти: сотое убийство заряжает и убивает', armed && e.hp <= 0,
     'запас цели был 1 000 000 000'); }

console.log('РЕЛИКВИИ');
{ const {c,G,D,p} = mk(['chalice']);
  p.kills = 49; p.hp = 1;
  c.killEnemy(foe(c, p.x+100, p.y, 1), 0);
  ok('чаша крови: 50-е убийство лечит полностью', Math.abs(p.hp-D.life)<0.01,
     '1 \u2192 ' + Math.round(p.hp)); }
{ const a = mk([]), b = mk(['crown']);
  a.G.bag.add('dFire','flat',10); a.G.bag.add('dLit','flat',10); a.c.recalc();
  b.G.bag.add('dFire','flat',10); b.G.bag.add('dLit','flat',10); b.c.recalc();
  ok('корона пепла: +50% всем стихиям',
     Math.abs(b.D.elem.fire/a.D.elem.fire-1.5)<0.001 && Math.abs(b.D.elem.lit/a.D.elem.lit-1.5)<0.001,
     'огонь ' + a.D.elem.fire + ' \u2192 ' + b.D.elem.fire + ', молния тоже'); }
{ const {c,G,D,p} = mk(['bmask'], 12);
  ok('маска босса: +1 аффикс пачке', c.packAffixCount(12) === 3, 'этаж 12: 2 \u2192 3');
  G.packs.length = 0; G.enemies.length = 0;
  const pk = c.spawnPack(12);
  G.orbs.length = 0;
  // Аффиксы размножения и разделения добавляют бойцов в пачку по ходу дела,
  // поэтому добиваем циклом, пока список не опустеет, а не одним проходом.
  // Находкой может оказаться и тотем — он из того же пула.
  let guard = 0;
  while (pk.members.length && guard++ < 200){
    const m = pk.members[0];
    c.killEnemy(m, G.enemies.indexOf(m));
  }
  ok('маска босса: с последнего бойца находка', G.orbs.some(o=>o.book||o.amu||o.totem),
     'выпало находок ' + G.orbs.filter(o=>o.book||o.amu).length); }
