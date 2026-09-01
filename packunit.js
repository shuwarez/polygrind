/* Поштучная проверка механики каждого аффикса: не «на сколько тяжелее»,
   а «делает ли он ровно то, что написано». Прогоны шумят, арифметика — нет. */
const {loadGame} = require('./sim');
const DT = 1/60;

function mk(affId, floor){
  const c = loadGame('./GrimGrind.html');
  c.newGame('bow','keys');
  const G = c.__api.G;
  G.floor = floor || 20; c.buildFloor();
  G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0; G.portal = null;
  const pk = c.spawnPack(G.floor);
  pk.aff.length = 0; pk.has = {}; pk.role = {};
  for (const m of pk.members) m.roles = [];
  const A = c.__api.PACKS.find(x => x.id === affId);
  pk.aff.push(A); pk.has[A.id] = true;
  if (A.role){ const m = pk.members[0]; m.roles.push(A.role); pk.role[A.role] = m;
               if (A.initRole) A.initRole(m, pk); }
  if (A.init) for (const m of pk.members) A.init(m, pk);
  // одинаковые монстры: разброс типов больше любого эффекта
  const hpS = Math.pow(1.185, G.floor-1);
  for (const m of pk.members){
    m.eliteVariant = null;                  // этот набор изолирует аффиксы пачки от новых пород элиты
    m.t = c.__api.ETYPES.blob;
    m.maxHp = m.hp = Math.round(22*3.2*hpS);
    m.r = 14*1.45; m.r0 = m.r;
  }
  if (pk.has.vanguard){ const v = pk.role.vanguard; v.maxHp = v.hp = Math.round(22*3.2*hpS*2); }
  return {c, G, pk, A};
}
const ok = (name, cond, detail) =>
  console.log((cond ? '  \u2713 ' : '  \u2717 ') + name.padEnd(34) + (detail||''));

console.log('ЗАЩИТНЫЕ');
{ const {c,pk} = mk('armored');
  const e = pk.members[0];
  const full = c.mitigate(e, 1000);
  e.hp = e.maxHp*0.3;
  const low  = c.mitigate(e, 1000);
  ok('бронированные: −50% выше половины', Math.abs(full/low - 0.5) < 0.01,
     Math.round(full) + ' против ' + Math.round(low)); }

{ const {c,pk} = mk('linked');
  const e = pk.members[0];
  for (const m of pk.members) if (m!==e){ m.x = e.x+40; m.y = e.y; }
  const near = c.mitigate(e, 1000);
  for (const m of pk.members) if (m!==e){ m.x = e.x+900; m.y = e.y+900; }
  const far  = c.mitigate(e, 1000);
  ok('связанные: −30% рядом со своими', Math.abs(near/far - 0.7) < 0.01,
     Math.round(near) + ' против ' + Math.round(far)); }

{ const {c,pk} = mk('bloodbond');
  const e = pk.members[0];
  const arm = 1 - e.armor/(e.armor+60);            // броня элиты режет до аффикса, считаем от неё
  const hp0 = pk.members.map(m=>m.hp);
  const got = c.mitigate(e, 1000);
  const spread = pk.members.slice(1).reduce((s,m,i)=> s + (hp0[i+1]-m.hp), 0);
  ok('кровная связь: 20% себе, 80% своим',
     Math.abs(got/(1000*arm)-0.2)<0.01 && Math.abs(spread/(1000*arm)-0.8)<0.01,
     'себе ' + Math.round(got/(1000*arm)*100) + '%, своим ' + Math.round(spread/(1000*arm)*100) + '%'); }

{ const {c,pk} = mk('bloodbond');
  const e = pk.members[0];
  const arm = 1 - e.armor/(e.armor+60);
  for (const m of pk.members.slice()) if (m!==e) c.killEnemy(m, c.__api.G.enemies.indexOf(m));
  ok('кровная связь: последний получает всё', Math.abs(c.mitigate(e,1000)/(1000*arm)-1)<0.01); }

{ const {c,G,pk} = mk('vanguard');
  const v = pk.role.vanguard, other = pk.members.find(m=>m!==v);
  let redirected = 0;
  for (let i=0;i<4000;i++) if (c.packRedirect(other) === v) redirected++;
  ok('авангард: перехват ~35% ударов', Math.abs(redirected/4000 - 0.35) < 0.03,
     (redirected/40).toFixed(1) + '%');
  ok('авангард: вдвое больше здоровья', v.maxHp > other.maxHp*1.9); }

console.log('ЛЕЧЕНИЕ');
for (const [id, want, nm] of [['regen',2.5,'регенераторы 2.5%/сек'],
                              ['hive',1.2,'улей 1.2%/сек'],
                              ['sanctuary',1.5,'священный круг 1.5%/сек']]){
  const {c,G,pk} = mk(id);
  const e = pk.members[0];
  if (id==='sanctuary'){ const ctr = pk.role.circle; e.x = ctr.x+10; e.y = ctr.y+10; }
  e.hp = e.maxHp*0.5;
  const before = e.hp;
  for (let i=0;i<180;i++){ e.noDmgT = 5; c.packTick(e, DT, G.player, 0); }
  const pct = (e.hp-before)/e.maxHp*100/3;
  ok(nm, Math.abs(pct-want) < 0.2, 'вышло ' + pct.toFixed(2) + '%/сек');
}
{ const {c,G,pk} = mk('regen');
  const e = pk.members[0]; e.hp = e.maxHp*0.5; e.noDmgT = 0;
  const b = e.hp;
  for (let i=0;i<60;i++) c.packTick(e, DT, G.player, 0);   // noDmgT не растёт — бьют
  ok('регенераторы молчат под огнём', e.hp === b); }

{ const {c,G,pk} = mk('vamp');
  for (const m of pk.members) m.hp = m.maxHp*0.5;
  const b = pk.members.map(m=>m.hp);
  c.packDealt(pk, 1000);
  const gain = pk.members.map((m,i)=> m.hp - b[i]);
  ok('вампиры: лечат всю пачку', gain.every(g => g > 0),
     'по ' + Math.round(gain[0]) + ' на монстра с 1000 урона'); }

console.log('ПРЕДСМЕРТНЫЕ');
{ const {c,G,pk} = mk('breed');
  const n0 = G.enemies.length, e = pk.members[0];
  c.killEnemy(e, G.enemies.indexOf(e));
  const kids = G.enemies.filter(x=>x.noBreed);
  ok('размножение: +2 копии', G.enemies.length === n0+1 && kids.length===2,
     'было ' + n0 + ', стало ' + G.enemies.length);
  const k = kids[0];
  const n1 = G.enemies.length;
  c.killEnemy(k, G.enemies.indexOf(k));
  ok('копии не плодятся дальше', G.enemies.length === n1-1);
  ok('копии считаются рядовыми', kids.every(x=>x.kind==='norm')); }

{ const {c,G,pk} = mk('lastword');
  const e = pk.members[0]; G.eshots.length = 0;
  c.killEnemy(e, G.enemies.indexOf(e));
  ok('последнее слово: 3 снаряда', G.eshots.length === 3, 'урон ' + Math.round(G.eshots[0].dmg)); }

{ const {c,G,pk} = mk('avenger');
  const e = pk.members[0];
  for (const m of pk.members) if (m!==e){ m.x = e.x+100; m.y = e.y; }
  c.killEnemy(e, G.enemies.indexOf(e));
  ok('мстители: соседи разогнаны', pk.members.every(m=>m.rage>0)); }

{ const {c,G,pk} = mk('split');
  const e = pk.members[0]; const hp0 = e.maxHp, n0 = G.enemies.length;
  e.hp = e.maxHp*0.4; c.packSplit(e);
  const half = G.enemies[G.enemies.length-1];
  ok('разделяющиеся: двое по 40%', G.enemies.length===n0+1 &&
     Math.abs(e.maxHp/hp0-0.4)<0.01 && Math.abs(half.maxHp/hp0-0.4)<0.01,
     Math.round(hp0) + ' \u2192 два по ' + Math.round(e.maxHp)); }

console.log('ПОВЕДЕНИЕ');
{ const {c,G,pk} = mk('berserk');
  const e = pk.members[0];
  e.hp = e.maxHp; const full = c.packMods(e);
  e.hp = e.maxHp*0.01; const low = c.packMods(e);
  ok('берсеркеры: до +60% на нуле', Math.abs(full.spd-1)<0.01 && Math.abs(low.spd-1.594)<0.02,
     'скорость ' + full.spd.toFixed(2) + ' \u2192 ' + low.spd.toFixed(2)); }

{ const {c,G,pk} = mk('beacon');
  const b = pk.role.beacon, e = pk.members.find(m=>m!==b);
  e.x = b.x+100; e.y = b.y; const inR = c.packMods(e).dmg;
  e.x = b.x+400; const outR = c.packMods(e).dmg;
  b.dead = true; e.x = b.x+100; const dead = c.packMods(e).dmg;
  ok('маяк: +50% в радиусе 180', Math.abs(inR-1.5)<0.01 && Math.abs(outR-1)<0.01,
     'внутри ' + inR.toFixed(2) + ', снаружи ' + outR.toFixed(2));
  ok('маяк: со смертью аура гаснет', Math.abs(dead-1)<0.01); }

{ const {c,G,pk} = mk('cmd');
  const cm = pk.role.cmd, e = pk.members.find(m=>m!==cm);
  const live = c.packMods(e); cm.dead = true; const dead = c.packMods(e);
  ok('командир: +30% скорости и атаки', Math.abs(live.spd-1.3)<0.01 && Math.abs(live.aspd-1.3)<0.01);
  ok('командир: со смертью бонус снят', Math.abs(dead.spd-1)<0.01); }

{ const {c,G,pk} = mk('hunter');
  const h = pk.role.hunter;
  ok('охотник: +50% скорости', Math.abs(c.packMods(h).spd-1.5)<0.01); }

{ const {c,G,pk} = mk('jumper');
  const p = G.player; p.x = 0; p.y = 0;
  let jumped = null;
  for (let i=0;i<60*5 && !jumped;i++){
    for (const a of pk.aff) if (a.packTick) a.packTick(pk, DT);
    for (const m of pk.members) c.packTick(m, DT, p, 0);
    jumped = pk.members.find(m => m.jumpTo === null && Math.hypot(m.x-p.x,m.y-p.y) < 30);
  }
  ok('прыгуны: кто-то оказался у игрока', !!jumped); }

{ const {c,G,pk} = mk('mad');
  const e = pk.members[0]; const seen = new Set();
  for (let i=0;i<60*30;i++){ c.packTick(e, DT, G.player, 0); seen.add(Math.round(e.r)); }
  ok('безумные: размер и статы пляшут', seen.size > 4,
     'разных радиусов ' + seen.size + ', скорость ' + (e.madSpd||1).toFixed(2)); }
