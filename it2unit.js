/* Проверка 24 новых предметов. */
const {loadGame} = require('./sim');
const DT = 1/60;
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(44) + (det||''));
function mk(amus, mods){
  const c = loadGame('./PolyGrind.html');
  c.newGame('necro','keys');
  const G = c.__api.G;
  G.lvl = 25;
  for (const a of [].concat(amus||[])) G.amu[a] = true;
  for (const [k,v,kind] of mods||[]) G.bag.add(k, kind||'flat', v);
  c.recalc();
  G.floor = 12; c.buildFloor();
  G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0; G.portal = null;
  const p = G.player; p.hp = c.__api.D.life;
  return {c, G, D:c.__api.D, p};
}
function foe(o, dx, dy, hp){
  const e = o.c.spawnEnemy();
  e.maxHp = e.hp = hp || 1e9; e.spd = 0; e.dmg = 0;
  e.x = o.p.x + dx; e.y = o.p.y + dy;
  e.kind = 'norm'; e.armor = 0; e.ward = null; e.bulwark = 0;
  return e;
}
function avgHit(o, e, n, setup){
  let s = 0;
  for (let i=0;i<(n||1500);i++){ if (setup) setup(); const h = e.hp; o.c.damage(e, {}); s += h - e.hp; }
  return s/(n||1500);
}

console.log('РИТМ БОЯ');
{ const o = mk('momentum'); const e = foe(o,40,0);
  o.p.moveT = 0; const a = o.c.conditionalInc(e, {});
  o.p.moveT = 20; const b = o.c.conditionalInc(e, {});
  ok('разгон: +40% на пределе', b-a === 40, '+' + (b-a) + '% за 20 сек бега'); }
{ const o=mk('momentum');
  o.p.moveT=1.99; const early=o.c.activeCombatBuffs(o.p,0,0);
  o.p.moveT=6.2; o.c.setLanguage('ru'); const ru=o.c.activeCombatBuffs(o.p,0,0);
  o.p.moveT=30; const capped=o.c.activeCombatBuffs(o.p,0,0);
  o.c.setLanguage('en'); o.p.moveT=2; const en=o.c.activeCombatBuffs(o.p,0,0);
  o.p.moveT=0; const stopped=o.c.activeCombatBuffs(o.p,0,0);
  ok('разгон: HUD повторяет ступени, потолок и сброс',
    !early.some(x=>x.includes('Разгон')) && ru.includes('Разгон +12% урона') &&
    capped.includes('Разгон +40% урона') && en.includes('Momentum +4% damage') &&
    !stopped.some(x=>x.includes('Momentum'))); }
{ const o = mk('siege'); const e = foe(o,40,0);
  o.p.stillT = 0; const a = o.c.conditionalInc(e, {});
  o.p.stillT = 2; const b = o.c.conditionalInc(e, {});
  ok('осадный огонь: +70% с места', b-a === 70); }
{ const o = mk('marathon');
  const G = o.G, p = o.p;
  p.moveT = 40; for (const k in G.keys) G.keys[k] = false; G.keys['d'] = true;   // потолок берётся на 30 сек
  const x0 = p.x; o.c.update(DT);
  const fast = p.x - x0;
  const o2 = mk([]); o2.G.keys['d'] = true; const x1 = o2.p.x; o2.c.update(DT);
  ok('марафонец: +30% скорости', Math.abs(fast/(o2.p.x-x1) - 1.3) < 0.05,
     'x' + (fast/(o2.p.x-x1)).toFixed(2)); }
{ const o = mk('panic');
  o.p.hp = o.D.life*0.2; o.G.keys['d'] = true;
  const x0 = o.p.x; o.c.update(DT); const fast = o.p.x - x0;
  const o2 = mk([]); o2.G.keys['d'] = true; const x1 = o2.p.x; o2.c.update(DT);
  ok('паника: +60% при малом здоровье', Math.abs(fast/(o2.p.x-x1) - 1.6) < 0.05); }
{ const o = mk([], [['spdKill',1,'flag']]), base=o.D.mspd, e = foe(o,9e5,0);
  o.c.killEnemy(e, o.G.enemies.indexOf(e)); const active=o.D.mspd;
  o.c.update(0.81);
  ok('карточка убийства: сразу +25% на 0,8 сек',
    Math.abs(active/base-1.25)<1e-9 && o.p.spdKill===0 && Math.abs(o.D.mspd-base)<1e-9); }
{ const o = mk([], [['spdKill',1,'flag']]), e = foe(o,9e5,0);
  const idle=o.c.activeCombatBuffs(o.p,0,0); o.c.killEnemy(e,o.G.enemies.indexOf(e));
  o.p.spdKill=0.76; o.c.setLanguage('ru'); const ru=o.c.activeCombatBuffs(o.p,0,0);
  o.c.setLanguage('en'); const en=o.c.activeCombatBuffs(o.p,0,0); o.p.spdKill=0;
  const expired=o.c.activeCombatBuffs(o.p,0,0);
  ok('карточка убийства: HUD показывает бонус и оставшееся время',
    !idle.some(x=>x.includes('Недавнее убийство')) &&
    ru.includes('Недавнее убийство +25% скорости - 0.8 секунд') &&
    en.includes('Recent Kill +25% Speed - 0.8 seconds') &&
    !expired.some(x=>x.includes('Recent Kill'))); }
{ const o = mk('sprint'), base=o.D.mspd, e = foe(o,9e5,0);
  o.c.killEnemy(e, o.G.enemies.indexOf(e)); const active=o.D.mspd;
  o.c.update(2.01);
  ok('последний рывок: сразу +40% на 2 сек',
    Math.abs(active/base-1.40)<1e-9 && o.p.sprintT===0 && Math.abs(o.D.mspd-base)<1e-9); }
{ const o = mk('sprint', [['spdKill',1,'flag']]), base=o.D.mspd, e = foe(o,9e5,0);
  o.c.killEnemy(e, o.G.enemies.indexOf(e));
  ok('карточка и Последний рывок работают независимо', Math.abs(o.D.mspd/base-1.75)<1e-9); }

console.log('РЕАКЦИЯ И ДОБИВАНИЕ');
{ const o = mk('riposte'); const e = foe(o,40,0);
  const base = avgHit(o, e, 800);
  o.p.inv = 0; o.c.hurt(10);
  const h = e.hp; o.c.damage(e, {}); const hit = h - e.hp;
  ok('контрудар: следующий удар x2.5', hit > base*1.8,
     Math.round(base) + ' \u2192 ' + Math.round(hit)); }
{ const o = mk('headsman'); const e = foe(o,40,0, 1000);
  const full = avgHit(o, e, 800, ()=>{ e.hp = 900; });
  const low  = avgHit(o, e, 800, ()=>{ e.hp = 100; });
  ok('рука палача: x2 ниже 15%', Math.abs(low/full - 2) < 0.15,
     'x' + (low/full).toFixed(2)); }
{ const o = mk('predator'); const e = foe(o,40,0);
  o.p.predT = 0; const a = o.c.conditionalInc(e, {});
  o.p.predT = 2; const b = o.c.conditionalInc(e, {});
  ok('глаз хищника: +20%', b-a === 20);
  const e2 = foe(o,9e5,0); o.c.killEnemy(e2, o.G.enemies.indexOf(e2));
  ok('убийство заряжает и продлевает', o.p.predT === 2); }
{ const o = mk('bossShard'); const e = foe(o,40,0);
  const a = o.c.conditionalInc(e, {});
  for (let i=0;i<4;i++){ const el = foe(o, 60+i*10, 20); el.kind = 'elite'; }
  const b = o.c.conditionalInc(e, {});
  ok('осколок босса: +5% за элиту', b-a === 20, '4 элиты \u2192 +' + (b-a) + '%'); }

console.log('СТИХИИ И КРИТЫ');
{ const o = mk('trinity'); const e = foe(o,40,0);
  e.dots.fire.dps = 5; e.ail.chill = 2; e.dots.poison.dps = 5;
  const withT = avgHit(o, e, 600);
  const o2 = mk([]); const e2 = foe(o2,40,0);
  e2.dots.fire.dps = 5; e2.ail.chill = 2; e2.dots.poison.dps = 5;
  const without = avgHit(o2, e2, 600);
  ok('триединство: крит без броска', withT > without*1.4,
     Math.round(without) + ' \u2192 ' + Math.round(withT)); }
{ const o = mk('overload', [['igniteCh',25]]);
  const e = foe(o,40,0); e.ail.shock = 3;
  const other = foe(o,80,0);
  const h = other.hp;
  for (let i=0;i<200 && other.hp===h;i++) o.c.damage(e, {});
  ok('перегрузка: разряд по округе', other.hp < h, 'соседу ' + Math.round(h-other.hp)); }
{ const o = mk('critmass', [['critCh',100]]);
  const e = foe(o,40,0), other = foe(o,40,40);
  const h = other.hp; o.c.damage(e, {});
  ok('критическая масса: волна от крита', other.hp < h); }
{ const o = mk('critchain', [['critCh',100]]);
  const e = foe(o,40,0);
  o.c.damage(e, {}); o.c.damage(e, {}); o.c.damage(e, {}); o.c.damage(e, {});
  ok('цепь критов: копится до 3', o.p.critChain === 3, 'стаков ' + o.p.critChain); }
{ const o = mk('critaim');
  const e = foe(o,40,0);
  o.p.stillT = 2;
  let crits = 0;
  for (let i=0;i<3000;i++){ const n0 = o.G.fx.length; o.c.damage(e, {});
    if (o.G.fx.some(f=>f.t==='num'&&f.crit)) crits++; o.G.fx.length = 0; }
  ok('критический прицел: +25% шанса', crits/3000 > 0.20 && crits/3000 < 0.32,
     (crits/30).toFixed(1) + '% критов'); }
{ const o = mk('critaim');
  o.p.stillT=1; const early=o.c.activeCombatBuffs(o.p,0,0);
  o.p.stillT=1.01; o.c.setLanguage('ru'); const ru=o.c.activeCombatBuffs(o.p,0,0);
  o.c.setLanguage('en'); const en=o.c.activeCombatBuffs(o.p,0,0);
  ok('критический прицел: HUD появляется только после секунды неподвижности',
    !early.some(x=>x.includes('Критический прицел')) &&
    ru.includes('Критический прицел - +25% к шансу критического удара') &&
    en.includes('Critical Aim - +25% Critical Hit Chance')); }

console.log('ЗАЩИТА');
{ const o = mk('fullplate');
  o.p.hp = o.D.life; o.c.hurt(100);
  const full = o.D.life - o.p.hp;
  o.p.inv = 0; o.p.hp = o.D.life*0.9; const before = o.p.hp; o.c.hurt(100);
  ok('панцирь целого: -35% при полном', Math.abs(full/(before-o.p.hp) - 0.65) < 0.02,
     Math.round(full) + ' против ' + Math.round(before-o.p.hp)); }
{ const o = mk('lastplate');
  o.p.hp = o.D.life*0.15; let b0 = o.p.hp; o.c.hurt(50);
  const low = b0 - o.p.hp;
  o.p.inv = 0; o.p.hp = o.D.life; b0 = o.p.hp; o.c.hurt(50);
  ok('последняя броня: -40% ниже 20%', Math.abs(low/(b0-o.p.hp) - 0.60) < 0.02); }
{ const o = mk('steel');
  o.G.amuT.steel = 0; o.p.hp = o.D.life;
  o.c.hurt(o.D.life*5);
  ok('стальная воля: не больше 80% за удар', o.p.hp > 0 && Math.abs(o.p.hp/o.D.life - 0.2) < 0.01,
     'осталось ' + Math.round(o.p.hp/o.D.life*100) + '%');
  ok('уходит в откат на 10 сек', o.G.amuT.steel === 10); }
{ const o = mk('breath');
  o.p.hp = 10; o.c.hurt(99999);
  ok('последний вздох: 1 здоровья и неуязвимость', o.p.hp === 1 && o.p.inv === 2);
  ok('откат 120 сек', o.G.amuT.breath === 120); }
{ const o = mk('pulse');
  o.p.hp = o.D.life*0.5; const b = o.p.hp;
  o.G.amuT.pulse = 0; o.c.tickAmulets(DT);
  ok('пульс жизни: +5% запаса', Math.abs(o.p.hp-b-o.D.life*0.05) < 0.5); }

console.log('КОНТРОЛЬ И УТИЛИТА');
{ const o = mk('vacuum');
  const e = foe(o,9e5,0), near = o.c.spawnEnemy();
  near.x = e.x+60; near.y = e.y; near.kb.x = 0; near.kb.y = 0;
  o.c.killEnemy(e, o.G.enemies.indexOf(e));
  ok('вакуум: подтягивает соседей', near.kb.x !== 0 || near.kb.y !== 0); }
{ const o = mk('gravity');
  foe(o, 200, 0);
  o.G.amuT.gravity = 0; o.c.tickAmulets(DT);
  ok('колодец: воронка открылась', !!o.G.well, o.G.well ? 'радиус ' + Math.round(o.G.well.r) : '');
  for (let i=0;i<70;i++) o.c.tickAmulets(DT);
  ok('колодец: схлопнулся через секунду', !o.G.well); }
{ const o = mk('shove');
  const e = foe(o,40,0);
  o.p.hitN = 7; e.kb.x = 0; e.kb.y = 0;
  o.c.damage(e, {});
  ok('таранная перчатка: каждый 8-й толчок', Math.abs(e.kb.x) > 500,
     'импульс ' + Math.round(Math.abs(e.kb.x))); }
{ const a = mk([]), b = mk('looter');
  ok('охотник за лутом: радиус x5', Math.abs(b.D.pickup/a.D.pickup - 5) < 0.01,
     Math.round(a.D.pickup) + ' \u2192 ' + Math.round(b.D.pickup)); }
{ const a = mk([]), b = mk('warskel');
  ok('боевые скелеты: +25% темпа', b.D.skelAspd === 1.25 && a.D.skelAspd === 1); }
{ const c = loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G = c.__api.G;
  let seen = false;
  for (let i=0;i<20000 && !seen;i++){ G.orbs.length = 0; G.amu = {}; c.dropItem({x:0,y:0});
    if (G.orbs[0] && G.orbs[0].amu === 'warskel') seen = true; }
  ok('боевые скелеты не выпадают не-некроманту', !seen); }
