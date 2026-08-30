/* Свита наследует эффекты хозяина с отдельным балансом урона и шансов. */
const {loadGame} = require('./sim');
const DT = 1/60;
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(48) + (det||''));
function mk(mods, amus, options){
  const c = loadGame('./PolyGrind.html', options);
  c.newGame('necro','keys');
  const G = c.__api.G;
  G.lvl = 25;
  for (const [k,v,kind] of mods||[]) G.bag.add(k, kind||'flat', v);
  for (const a of amus||[]) G.amu[a] = true;
  c.recalc();
  G.floor = 12; c.buildFloor();
  G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0;
  const p = G.player; p.hp = c.__api.D.life;
  const e = c.spawnEnemy(); e.maxHp = e.hp = 1e9; e.spd = 0; e.x = p.x+40; e.y = p.y;
  c.spawnMinion();
  const m = G.minions[0]; m.x = e.x; m.y = e.y;
  return {c, G, D:c.__api.D, p, e, m};
}
const hit = o => o.c.minionHit(o.e, o.m);
const procRate = (o, reset, active, n=600) => {
  let procs = 0;
  for (let i=0;i<n;i++){
    reset(); hit(o);
    if (active()) procs++;
  }
  return procs/n;
};
const quarter = v => v > 0.17 && v < 0.33;
const quarterOfCap = v => v > 0.02 && v < 0.11;
const quarterOfStunCap = v => v > 0.07 && v < 0.18;

console.log('КОСТЯНОЙ СЛУГА');
{ const c=loadGame('./PolyGrind.html'),m=c.__api.MODS.find(x=>x.id==='min.count');
  ok('карточка переименована и имеет ровно три фиксированных ранга',m.nm==='Костяной слуга'&&
    m.kind==='flat'&&m.stat==='minCount'&&m.r[0]===1&&m.r[1]===1); }
{ const c=loadGame('./PolyGrind.html'); c.newGame('necro','keys'); const G=c.__api.G;
  ok('Некромант начинает сразу с трёх скелетов',c.__api.D.maxSkel===3&&
    G.minions.length===3&&G.minions.every(m=>m.kind==='skeleton'),'живых '+G.minions.length+' · лимит '+c.__api.D.maxSkel); }
{ const c=loadGame('./PolyGrind.html'); c.newGame('necro','keys'); c.setLanguage('ru');
  const m=c.__api.MODS.find(x=>x.id==='min.count'),html=c.levelCardBodyHtml({m,v:1,val:'+1.0'});
  ok('первый ранг карточки показывает полный переход 3 → 4',html.includes('Максимум скелетов: +1')&&
    html.includes('Сейчас: 3 → 4')&&html.includes('Ранг: 1/3'),html.replace(/<[^>]+>/g,' · ')); }
{ const c=loadGame('./PolyGrind.html'); c.newGame('necro','keys');
  const m=c.__api.MODS.find(x=>x.id==='min.count'),html=c.levelCardBodyHtml({m,v:1,val:'+1.0'});
  ok('английская карточка сохраняет те же числа и подписи',html.includes('Maximum Skeletons: +1')&&
    html.includes('Current: 3 → 4')&&html.includes('Rank: 1/3')); }
{ const c=loadGame('./PolyGrind.html'); c.newGame('necro','keys'); const G=c.__api.G,m=c.__api.MODS.find(x=>x.id==='min.count'),limits=[];
  for(let i=0;i<3;i++){ G.bag.add('minCount','flat',1); c.recalc(); limits.push(c.__api.D.maxSkel); }
  ok('три выбора повышают предел строго 4 → 5 → 6',limits.join(',')==='4,5,6',limits.join(' → '));
  ok('после третьего ранга карточка сообщает максимум и скрывается',G.bag.flat('minCount')===3&&m.hide());
  ok('достигшая шести карточка полностью исчезает из случайной выдачи',
    Array.from({length:40},()=>c.rollCards()).flat().every(x=>x.id!=='min.count')); }
{ const c=loadGame('./PolyGrind.html'); c.newGame('necro','keys'); c.setLanguage('ru'); c.renderSheet();
  const html=c.document.getElementById('sheet').innerHTML;
  ok('интерфейс показывает стартовый счётчик «Скелеты: 3/6»',
    html.includes('Скелеты:</span><b>3/6'),html.match(/Скелеты[^<]*<\/span><b>[^<]*/)?.[0]||'нет'); }

console.log('СТАТУСЫ ОТ УДАРА СВИТЫ');
{ const o = mk([['igniteCh',25]]);
  const r = procRate(o, ()=>{ o.e.dots.fire.dps=0; o.e.dots.fire.n=0; }, ()=>o.e.dots.fire.dps>0);
  ok('поджог: 25% хозяина → около 6,25% у свиты', quarterOfCap(r), Math.round(r*100) + '%'); }
{ const o = mk([['chillCh',25]]);
  const r = procRate(o, ()=>{ o.e.ail.chill=0; }, ()=>o.e.ail.chill>0);
  ok('охлаждение: 25% хозяина → около 6,25%', quarterOfCap(r), Math.round(r*100) + '%'); }
{ const o = mk([['chillCh',25],['freeze',1]]);
  const r = procRate(o, ()=>{ o.e.ail.chill=0; o.e.ail.freeze=0; }, ()=>o.e.ail.freeze>0);
  ok('заморозка: отдельный 1% после редкого охлаждения свиты', r < 0.01, (r*100).toFixed(2) + '%'); }
{ const o = mk([['shockCh',25]]);
  const other = o.c.spawnEnemy(); other.maxHp = other.hp = 1e9; other.x = o.e.x+60; other.y = o.e.y;
  const r = procRate(o, ()=>{ o.e.ail.shock=0; }, ()=>o.e.ail.shock>0);
  ok('шок: 25% хозяина → около 6,25%', quarterOfCap(r) && other.hp < other.maxHp, Math.round(r*100) + '%'); }
{ const o = mk([['poiCh',25]]);
  const r = procRate(o, ()=>{ o.e.dots.poison.dps=0; o.e.dots.poison.n=0; }, ()=>o.e.dots.poison.dps>0);
  ok('яд: 25% хозяина → около 6,25%', quarterOfCap(r), Math.round(r*100) + '%'); }
{ const o = mk([['stun',100]]);
  const r = procRate(o, ()=>{ o.e.ail.stun=0; }, ()=>o.e.ail.stun>0);
  ok('оглушение: потолок 50% хозяина → около 12,5% у свиты', quarterOfStunCap(r), Math.round(r*100) + '%'); }
{ const impulse = (typeKey, kind) => {
    const o = mk([['knock',100]]);
    o.e.typeKey = typeKey; o.e.kind = kind;
    let force = 0, procs = 0;
    for (let i=0;i<600;i++){
      o.e.kb.x = o.e.kb.y = 0; hit(o);
      const f = Math.hypot(o.e.kb.x, o.e.kb.y);
      if (f > 0){ procs++; force = f; }
    }
    return {force, rate:procs/600};
  };
  const normal = impulse('blob','norm');
  const runner = impulse('runner','norm');
  const elite = impulse('blob','elite');
  const eliteRunner = impulse('runner','elite');
  const boss = impulse('tank','boss');
  ok('отбрасывание свиты: полная сила, 25% от потолка 75%', Math.abs(normal.force - 260) < 0.01 && normal.rate>0.13 && normal.rate<0.25,
     normal.force.toFixed(1) + ' · ' + Math.round(normal.rate*100) + '%');
  ok('Бегун: сила отбрасывания −30%', Math.abs(runner.force/normal.force - 0.70) < 0.001, runner.force.toFixed(1));
  ok('любая элита: сила отбрасывания −50%', Math.abs(elite.force/normal.force - 0.50) < 0.001, elite.force.toFixed(1));
  ok('элитный Бегун использует элитные −50%', Math.abs(eliteRunner.force/normal.force - 0.50) < 0.001, eliteRunner.force.toFixed(1));
  ok('босс: сила отбрасывания −90%', Math.abs(boss.force/normal.force - 0.10) < 0.001, boss.force.toFixed(1)); }
{ const o = mk([['execute',90]]);
  // Тип врага случайный: элите добивание не положено (только kind==='norm'),
  // из-за чего проверка мигала примерно в каждом четвёртом запуске
  o.e.kind = 'norm'; o.e.maxHp = 1000; o.e.hp = 100; hit(o);
  ok('добивание', o.e.hp <= 0); }

console.log('БАЛАНС ВСЕЙ СВИТЫ');
{ const o = mk([]);
  // Сравниваем один и тот же детерминированный удар: две независимые случайные
  // выборки базы и критов давали ложный разброс отношения вплоть до 0.57.
  o.D.baseMin=o.D.baseMax=100; o.D.elem={fire:0,cold:0,lit:0,poi:0};
  o.D.incAll=0; o.D.moreAll=1; o.D.critCh=o.D.minCrit=o.D.superCh=o.D.dblHit=0;
  const avg = minion => {
    let sum = 0;
    for (let i=0;i<20;i++){
      const hp = o.e.hp;
      o.c.damage(o.e, {mul:o.D.minDmgMul, minion:minion ? o.m : null, noDouble:true});
      sum += hp-o.e.hp;
    }
    return sum/20;
  };
  const ownerPath = avg(false), minionPath = avg(true);
  ok('весь прямой урон свиты уменьшен на 50%', Math.abs(minionPath/ownerPath-0.5) < 0.03,
     ownerPath.toFixed(1) + ' → ' + minionPath.toFixed(1)); }
{ const o = mk([]); o.G.shots.length = 0; o.c.minionShot(o.m, o.e, null);
  const s = o.G.shots[0];
  ok('стрелы охотников сохраняют метку свиты', s && s.minion === o.m && s.mul === 0.20); }
{ const o = mk([]); let procs = 0, dps = 0;
  for (let i=0;i<600;i++){
    o.e.dots.fire.dps=0; o.e.dots.fire.n=0;
    if (o.c.applyMinionSpell(o.e, 'fire')){ procs++; dps = o.e.dots.fire.dps; }
  }
  const expected = o.c.avgHit()*0.20*0.5*0.20*o.D.ailEff;
  ok('колдун: шанс эффекта 25% и половина урона', procs > 102 && procs < 198 && Math.abs(dps/expected-1)<0.001,
     Math.round(procs/6) + '% · ' + dps.toFixed(2) + ' урона/сек'); }
{ const o = mk([]); o.D.golemN = 1; let procs = 0, dps = 0;
  for (let i=0;i<600;i++){
    o.e.dots.bleed.dps=0; o.e.dots.bleed.n=0; o.c.boneGolemHit(o.e);
    if (o.e.dots.bleed.dps > 0){ procs++; dps = o.e.dots.bleed.dps; }
  }
  const expected = o.c.avgHit()*0.03*o.D.ailEff*0.5;
  ok('костяной голем: шанс 25% и половина урона', procs > 102 && procs < 198 && Math.abs(dps/expected-1)<0.001,
     Math.round(procs/6) + '% · ' + dps.toFixed(2) + ' урона/сек'); }
{ const o = mk([]); o.m.kind = 'golemB'; o.e.kind = 'norm'; o.e.typeKey = 'blob'; let procs = 0, force = 0;
  for (let i=0;i<600;i++){
    o.e.kb.x=o.e.kb.y=0; hit(o); const f=Math.hypot(o.e.kb.x,o.e.kb.y);
    if (f>0){ procs++; force=f; }
  }
  ok('голем крови: врождённое отбрасывание с шансом 25%', procs > 102 && procs < 198 && Math.abs(force-200)<0.01,
     Math.round(procs/6) + '% · сила ' + force.toFixed(0)); }

console.log('ПОЛЕ КОСТЕЙ');
{ const c = loadGame('./PolyGrind.html');
  const m = c.__api.MODS.find(x=>x.id==='min.bone_field');
  ok('фиксированная одноразовая карточка доступна только Некроманту', !!m && m.kind==='flag' && m.stat==='boneField' &&
     m.r[0]===1 && m.r[1]===1 && m.rar===undefined && m.cap===undefined &&
     c.allowedClassesForMod(m).join(',')==='necro'); }
{ const c=loadGame('./PolyGrind.html'); c.newGame('necro','keys'); const G=c.__api.G,m=c.__api.MODS.find(x=>x.id==='min.bone_field');
  const before=Array.from({length:80},()=>c.rollCards()).flat().some(x=>x.id===m.id);
  G.bag.add('boneField','flag',1); G.picks.push({id:m.id}); c.recalc();
  const after=Array.from({length:80},()=>c.rollCards()).flat().some(x=>x.id===m.id);
  ok('после выбора Поле костей исчезает из выдачи',before&&!after); }
{ const o = mk([['boneField',1,'flag']]);
  o.G.corpses=[{x:o.p.x+400,y:o.p.y,life:10}]; const edge=o.c.nearbyBoneFieldCorpseCount();
  o.G.corpses=[{x:o.p.x+401,y:o.p.y,life:10}]; const outside=o.c.nearbyBoneFieldCorpseCount();
  o.G.corpses=Array.from({length:10},()=>({x:o.p.x+10,y:o.p.y,life:10})); const capped=o.c.nearbyBoneFieldCorpseCount();
  ok('радиус 400 включителен, максимум — 9 трупов', edge===1 && outside===0 && capped===9,
     'граница '+edge+' · снаружи '+outside+' · потолок '+capped); }
{ const o = mk([['boneField',1,'flag']]);
  o.D.baseMin=o.D.baseMax=100; o.D.elem={fire:0,cold:0,lit:0,poi:0};
  o.D.incAll=0; o.D.moreAll=1; o.D.critCh=o.D.minCrit=o.D.superCh=o.D.dblHit=0;
  o.e.kind='norm'; o.e.armor=0; o.e.ward=null; o.e.bulwark=0; o.e.pack=null;
  const strike=()=>{ const hp=o.e.hp; o.c.minionHit(o.e,o.m); return hp-o.e.hp; };
  o.G.corpses=[]; const base=strike();
  o.G.corpses=Array.from({length:9},()=>({x:o.p.x+20,y:o.p.y,life:10})); const boosted=strike();
  o.G.corpses=Array.from({length:10},()=>({x:o.p.x+20,y:o.p.y,life:10})); const capped=strike();
  o.G.corpses=Array.from({length:9},()=>({x:o.p.x+401,y:o.p.y,life:10})); const far=strike();
  ok('9 трупов по 5% дают свите ровно +45% урона', Math.abs(boosted/base-1.45)<1e-6 &&
     Math.abs(capped-boosted)<1e-6 && Math.abs(far-base)<1e-6,
     base.toFixed(1)+' → '+boosted.toFixed(1)+' · 10-й '+capped.toFixed(1)); }
{ const o = mk([['boneField',1,'flag']]); o.c.setLanguage('ru');
  o.G.corpses=Array.from({length:3},()=>({x:o.p.x+20,y:o.p.y,life:10}));
  const active=o.c.activeCombatBuffs(o.p,0,0).find(x=>x.startsWith('Поле костей'));
  o.G.corpses=[]; const empty=o.c.activeCombatBuffs(o.p,0,0).find(x=>x.startsWith('Поле костей'));
  ok('HUD показывает текущий бонус, включая нулевой', active==='Поле костей +15% урона свиты' &&
     empty==='Поле костей +0% урона свиты', (active||'нет')+' · '+(empty||'нет')); }

console.log('ЕСТЕСТВЕННАЯ СМЕРТЬ СВИТЫ');
{ const c = loadGame('./PolyGrind.html'); c.newGame('necro','keys');
  const G = c.__api.G; G.minions.length = 0;
  for (let i=0;i<8;i++) c.spawnMinion(undefined,undefined,'skeleton');
  const timers = G.minions.map(m => m.deathT);
  ok('каждый боец получает независимые 10–15 секунд', timers.every(t => t >= 10 && t <= 15) &&
     new Set(timers.map(t => t.toFixed(6))).size > 1,
     Math.min(...timers).toFixed(2) + '–' + Math.max(...timers).toFixed(2) + ' сек'); }
{ const c = loadGame('./PolyGrind.html'); c.newGame('necro','keys','venomancer');
  const G = c.__api.G; G.bag.add('minBoom','flag',1); c.recalc();
  G.floor = 12; c.buildFloor(); G.enemies.length = 0; G.spawnQueue = 0; G.packs.length = 0;
  const m = G.minions[0], beforeCount = G.minions.length;
  const e = c.spawnEnemy(); e.kind = 'norm'; e.maxHp = e.hp = 1e9; e.armor = 0; e.ward = null; e.bulwark = 0;
  e.spd = 0; e.dmg = 0; e.x = m.x+80; e.y = m.y;
  const hp0 = e.hp; m.deathT = 0.001; c.update(1/60);
  ok('таймер убивает через общий посмертный путь', G.minions.length === beforeCount-1 && e.hp < hp0,
     'свита ' + beforeCount + ' → ' + G.minions.length + ' · взрыв ' + Math.round(hp0-e.hp));
  ok('естественная смерть создаёт кислоту веномансера', G.acidPools.length === 1,
     'луж: ' + G.acidPools.length);
  G.enemies.length = 0; G.spawnQueue = 0; G.portal = null; G.corpses.length = 0; G.raiseT = 0;
  const deadCount = G.minions.length; c.update(0.24); const beforeRevive = G.minions.length; c.update(0.02);
  ok('погибший возвращается по правилу 0.25 секунды', beforeRevive === deadCount && G.minions.length === deadCount+1,
     'до: ' + beforeRevive + ' · после: ' + G.minions.length); }

console.log('ПРЕДМЕТЫ И КНИГИ');
{ const o = mk([], ['thunder']);
  o.p.hitN = 11; hit(o);
  ok('перчатки грома от удара свиты', o.e.ail.shock > 0, 'счётчик стал ' + o.p.hitN); }
{ const o = mk([], ['pulse']);
  const other = o.c.spawnEnemy(); other.maxHp = other.hp = 1e9; other.x = o.e.x+50; other.y = o.e.y;
  o.p.hitN = 7; const h0 = other.hp; hit(o);
  ok('кольцо импульса от удара свиты', other.hp < h0); }
{ const o = mk([], ['bone']);
  o.p.hitN = 19; const crits0 = o.G.stats.crits; hit(o);
  ok('кость удачи: 20-й удар свиты — крит', o.p.hitN === 20 && o.G.stats.crits === crits0 + 1,
     'счётчик ' + o.p.hitN + ', критов +' + (o.G.stats.crits-crits0)); }
{ // Усредняем: одиночный удар шумит на разбросе базы сильнее, чем множитель 1.75
  const o = mk([], ['duel']);
  o.e.kind = 'norm'; o.e.armor = 0; o.e.ward = null; o.e.bulwark = 0;
  const avg = () => { let s = 0; for (let i=0;i<1200;i++){ const h = o.e.hp; hit(o); s += h - o.e.hp; } return s/1200; };
  const solo = avg();
  const other = o.c.spawnEnemy(); other.x = o.p.x+50; other.y = o.p.y;
  const pair = avg();
  ok('кольцо дуэли действует на удар свиты', solo > pair*1.5,
     pair.toFixed(1) + ' \u2192 ' + solo.toFixed(1)); }
{ const o = mk([]);
  o.G.items = {fire:{tier:3,val:12}}; o.c.recalc();
  let procs = 0;
  for (let i=0;i<1200;i++){ o.e.dots.fire.dps = 0; o.e.dots.fire.n = 0; hit(o); if (o.e.dots.fire.dps > 0) procs++; }
  const expected = 30 * 0.25; // книга третьего тира: 30% у хозяина, 7.5% у свиты
  ok('шанс книги от свиты также уменьшен на 75%', procs/12 > expected*0.65 && procs/12 < expected*1.35,
     Math.round(procs/12) + '% при цели ' + expected.toFixed(1) + '%'); }
{ const o = mk([]); o.G.items = {poison:{tier:3,val:12}}; o.c.recalc(); let dps = 0;
  for (let i=0;i<600 && !dps;i++){
    o.e.dots.poison.dps=0; o.e.dots.poison.n=0; hit(o); dps=o.e.dots.poison.dps;
  }
  ok('фиксированный урон книги от свиты тоже ×0.5', dps > 0 && Math.abs(dps/(o.D.bookPoiDps*0.5)-1)<0.001,
     dps.toFixed(2) + ' при базе ' + o.D.bookPoiDps.toFixed(2)); }

console.log('ВАМПИРЫ ХОЗЯИНА');
{ const o = mk([['minLife',50,'inc'],['minVamp',1]]);
  o.m.hp = o.m.max*0.5; const before = o.m.hp;
  const hp0 = o.p.hp = o.D.life*0.5;
  hit(o);
  ok('приспешник лечит себя', o.m.hp > before, '+' + Math.round(o.m.hp-before));
  ok('хозяину не достаётся', o.p.hp === hp0); }
{ const o = mk([['minLife',50,'inc'],['minVamp',1]]);
  o.m.hp = o.m.max; hit(o);
  ok('не лечит выше максимума', o.m.hp === o.m.max); }
{ const o = mk([['minLife',40,'inc']]);
  ok('до +50% здоровья карточка закрыта',
     !o.c.__api.MODS.find(m=>m.id==='min.vampires').show()); }

console.log('ЛОРД СМЕРТИ');
{ const c = loadGame('./PolyGrind.html');
  ok('синяя карточка вампиризма свиты удалена', !c.__api.MODS.some(m=>m.id==='min.leech_to_owner'));
  const lord = c.__api.MODS.find(m=>m.id==='key.death_lord');
  ok('Лорд Смерти — оранжевый кейстоун Некроманта', !!lord && lord.rar===3 && lord.req==='min' && lord.kind==='flag'); }
{ const o = mk([['kDeathLord',1],['minDmg',10000,'inc']]);
  o.p.hp = o.D.life*0.25; o.e.maxHp = o.e.hp = 10;
  const hp0=o.p.hp, enemy0=o.e.hp; hit(o); const dealt=enemy0-Math.max(0,o.e.hp);
  ok('лечит на 0.1% фактического урона без оверкилла', o.D.deathLord && Math.abs((o.p.hp-hp0)-dealt*0.001)<1e-9,
     dealt.toFixed(1) + ' урона → +' + (o.p.hp-hp0).toFixed(3) + ' HP'); }
{ const o = mk([['kDeathLord',1]]);
  o.G.minions.length=0; o.D.hasMin=false; o.G.spawnQueue=0; o.G.portal=null;
  o.e.x=o.p.x+1000; o.e.y=o.p.y; o.e.spd=0; o.e.dmg=0;
  o.p.hp=o.D.life*0.25; const hp0=o.p.hp, enemy0=o.e.hp;
  o.c.addDot(o.e,'fire',100,3,1); o.c.update(0.2);
  const dealt=enemy0-o.e.hp;
  ok('учитывает урон со временем от свиты', dealt>0 && Math.abs((o.p.hp-hp0)-dealt*0.001)<1e-9,
     dealt.toFixed(1) + ' урона → +' + (o.p.hp-hp0).toFixed(3) + ' HP'); }
{ const o = mk([['kDeathLord',1]]);
  o.p.hp=o.D.life*0.25; o.e.maxHp=o.e.hp=10000; const hp0=o.p.hp, enemy0=o.e.hp;
  o.G.acidPools=[{x:o.e.x,y:o.e.y,r:60,life:3,max:3,t:0}]; o.c.tickAcidPools(0.01);
  const dealt=enemy0-o.e.hp;
  ok('учитывает кислоту павшего приспешника', dealt>0 && Math.abs((o.p.hp-hp0)-dealt*0.001)<1e-9,
     Math.round(dealt) + ' урона → +' + (o.p.hp-hp0).toFixed(2) + ' HP'); }
{ const o = mk([], ['fang']); o.p.hp=o.D.life*0.25; const hp0=o.p.hp; hit(o);
  ok('обычный вампиризм больше не лечит от ударов свиты', o.D.leech>0 && o.p.hp===hp0); }

console.log('КОСТЯНОЙ ВЫЗОВ');
{ const c = loadGame('./PolyGrind.html');
  const old = c.__api.MODS.find(m=>m.id==='min.taunt');
  const key = c.__api.MODS.find(m=>m.id==='key.bone_challenge');
  ok('старая карточка удалена, новая — оранжевый кейстоун', !old && !!key && key.rar===3 && key.req==='min' && key.kind==='flag'); }
{ let roll=0.5; const o=mk([['kBoneChallenge',1]], [], {random:()=>roll});
  roll=0.009999; o.e.tauntMinion=null;
  ok('граница 1%: значение ниже 0.01 срабатывает', o.c.rollBoneChallenge(o.e,o.m) && o.e.tauntMinion===o.m);
  roll=0.01; o.e.tauntMinion=null;
  ok('граница 1%: значение 0.01 уже не срабатывает', !o.c.rollBoneChallenge(o.e,o.m) && !o.e.tauntMinion); }
{ let roll=0.5; const o=mk([['kBoneChallenge',1]], [], {random:()=>roll});
  roll=0; o.e.tauntMinion=null; hit(o);
  ok('обычный прямой удар свиты бросает провокацию', o.e.tauntMinion===o.m); }
{ const o=mk([['kBoneChallenge',1]]);
  o.G.enemies=[o.e]; o.G.minions=[o.m]; o.G.spawnQueue=0; o.G.portal=null;
  o.p.x=500; o.p.y=0; o.e.x=0; o.e.y=0; o.e.spd=100; o.e.dmg=0;
  o.e.t=Object.assign({},o.e.t,{ranged:false}); o.e.roles=[]; o.e.aff=[]; o.e.pack=null;
  o.e.kb.x=o.e.kb.y=0; o.m.x=-500; o.m.y=0; o.m.hp=o.m.max; o.e.tauntMinion=o.m;
  o.c.update(0.1);
  ok('сработавший эффект ведёт монстра к ударившему бойцу', o.e.x<0, 'x=' + o.e.x.toFixed(1));
  o.G.minions.length=0; o.e.x=0; o.e.y=0; o.e.kb.x=o.e.kb.y=0; o.c.update(0.1);
  ok('после смерти бойца агро возвращается к игроку', o.e.x>0 && o.e.tauntMinion===null, 'x=' + o.e.x.toFixed(1)); }

console.log('ПРОЧЕЕ');
{ // Одиночный удар слишком шумит: и разброс базы, и случайный тип цели.
  // Усредняем по одной и той же цели с обнулённой бронёй.
  const avg = (crit) => {
    const o = mk(crit ? [['minCrit',100,'inc']] : []);
    o.e.kind = 'norm'; o.e.armor = 0; o.e.ward = null; o.e.bulwark = 0;
    let s = 0;
    for (let i=0;i<1500;i++){ const h = o.e.hp; hit(o); s += h - o.e.hp; }
    return s/1500;
  };
  const noCrit = avg(false), withCrit = avg(true);
  ok('крит свиты считается по D.minCrit', withCrit > noCrit*1.3,
     noCrit.toFixed(1) + ' \u2192 ' + withCrit.toFixed(1)); }
