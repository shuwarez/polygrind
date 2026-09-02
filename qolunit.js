/* Постоянный QoL-сбор, журналы смерти и ускорение после боссов. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(46) + (det || ''));

{ const c = loadGame('./index.html'); c.newGame('bow','keys');
  const G=c.__api.G, base=c.__api.D.pickup;
  ok('карточка радиуса автоподбора удалена',
    !c.__api.MODS.some(m=>m.id==='loot.pickup_radius' || m.stat==='pickup'));
  ok('карточка притягивания лута удалена',
    !c.__api.MODS.some(m=>m.id==='loot.magnet' || m.stat==='magnet'));
  ok('карточка урона при малом здоровье удалена',
    !c.__api.MODS.some(m=>m.id==='cond.while_low_hp' || m.stat==='whLow'));
  ok('карточка возврата полученного урона удалена',
    !c.__api.MODS.some(m=>m.id==='def.recoup' || m.stat==='recoup'));
  ok('карточки урона вблизи и издалека удалены',
    !c.__api.MODS.some(m=>m.id==='cond.close_range' || m.id==='cond.long_range' || m.stat==='close' || m.stat==='far'));
  ok('карточка двойного броска шанса крита удалена',
    !c.__api.MODS.some(m=>m.id==='crit.lucky' || m.stat==='critLucky'));
  ok('карточка урона за каждую секунду боя удалена',
    !c.__api.MODS.some(m=>m.id==='cond.per_second_in_combat' || m.stat==='ramp'));
  G.bag.add('pickup','inc',999); c.recalc();
  ok('старый стат карточки больше не влияет на героя', c.__api.D.pickup===base,
     base+' → '+c.__api.D.pickup); }

{ const c=loadGame('./index.html'); c.newGame('bow','keys');
  const G=c.__api.G,D=c.__api.D; G.enemies.length=0;G.spawnQueue=0;G.packs.length=0;
  G.bag.add('critLucky','flag',1);c.recalc();
  D.baseMin=D.baseMax=100;D.elem={fire:0,cold:0,lit:0,poi:0};D.incAll=0;D.moreAll=1;
  D.critCh=50;D.superCh=D.dblHit=0;
  const rolls=[0.5,0.75,0.25], oldRandom=c.Math.random;c.Math.random=()=>rolls.length?rolls.shift():0.99;
  const e=c.spawnEnemy();e.maxHp=e.hp=1e9;e.armor=0;e.ward=null;e.bulwark=0;e.kind='norm';
  const crits=G.stats.crits;c.damage(e,{noDouble:true});c.Math.random=oldRandom;
  ok('старый флаг critLucky больше не даёт второй бросок',G.stats.crits===crits); }

{ const c=loadGame('./index.html'); c.newGame('bow','keys');
  const G=c.__api.G,D=c.__api.D,p=G.player; G.enemies.length=0;G.spawnQueue=0;G.packs.length=0;
  G.bag.add('whLow','inc',999);c.recalc();
  D.baseMin=D.baseMax=100;D.elem={fire:0,cold:0,lit:0,poi:0};D.incAll=0;D.moreAll=1;D.critCh=D.superCh=D.dblHit=0;
  const e=c.spawnEnemy();e.maxHp=e.hp=1e9;e.armor=0;e.ward=null;e.bulwark=0;e.kind='norm';p.hp=D.life*0.2;
  const hp=e.hp;c.damage(e,{});
  ok('старый стат whLow больше не влияет на урон',Math.abs((hp-e.hp)-100)<1e-9,(hp-e.hp)+' урона'); }

{ const c=loadGame('./index.html'); c.newGame('bow','keys');
  const G=c.__api.G,D=c.__api.D,p=G.player; G.enemies.length=0;G.spawnQueue=0;G.packs.length=0;
  G.bag.add('close','inc',999);G.bag.add('far','inc',999);c.recalc();
  D.baseMin=D.baseMax=100;D.elem={fire:0,cold:0,lit:0,poi:0};D.incAll=0;D.moreAll=1;D.critCh=D.superCh=D.dblHit=0;
  const near=c.spawnEnemy();near.maxHp=near.hp=1e9;near.armor=0;near.ward=null;near.bulwark=0;near.kind='norm';near.x=p.x+20;near.y=p.y;
  const nearHp=near.hp;c.damage(near,{});
  const far=c.spawnEnemy();far.maxHp=far.hp=1e9;far.armor=0;far.ward=null;far.bulwark=0;far.kind='norm';far.x=p.x+500;far.y=p.y;
  const farHp=far.hp;c.damage(far,{});
  const nearDmg=nearHp-near.hp,farDmg=farHp-far.hp;
  ok('старые статы close/far больше не влияют на урон',
    Math.abs(nearDmg-100)<1e-9&&Math.abs(farDmg-100)<1e-9,
    'вблизи '+nearDmg+' · издалека '+farDmg); }

{ const c=loadGame('./index.html');c.newGame('bow','keys');
  const G=c.__api.G,D=c.__api.D,p=G.player;G.enemies.length=0;G.spawnQueue=0;G.packs.length=0;
  G.bag.add('recoup','flat',100);c.recalc();D.dodge=0;D.armor=0;p.hp=D.life;
  c.hurt(10,false,false,'ТЕСТ','norm');const afterHit=p.hp;c.update(1);
  ok('старый стат recoup больше не накапливает и не лечит',p.recoup===undefined&&p.hp===afterHit,
    afterHit.toFixed(1)+' HP'); }

{ const c = loadGame('./index.html'); c.newGame('bow','keys');
  const G=c.__api.G, p=G.player;
  G.enemies.length=0; G.spawnQueue=1; G.spawnT=999;
  const orb={x:p.x+500,y:p.y,v:1}; G.orbs=[orb];
  G.bag.add('magnet','flag',1); c.recalc();
  const before=orb.x; c.update(0.1); const moved=before-orb.x;
  ok('старый флаг magnet не меняет новую скорость притягивания', Math.abs(moved-42.5)<0.01,
    moved.toFixed(1)+' единицы за 0,1 сек'); }

{ const c = loadGame('./index.html');
  c.__api.STORE.data.shop.vacuum = 10;
  c.newGame('bow', 'keys');
  const D = c.__api.D;
  ok('удалённый быстрый сбор больше не увеличивает радиус', D.lootPickup === D.pickup,
     D.pickup + ' → ' + D.lootPickup);
  ok('удалённый быстрый сбор не меняет новую скорость притягивания', D.lootPull === 425,
     '425 → ' + D.lootPull); }

{ const c = loadGame('./index.html'); c.newGame('bow', 'keys');
  const G = c.__api.G, D = c.__api.D, p = G.player, runnerSpeed = c.__api.ETYPES.runner.spd;
  G.enemies.length = 0; G.spawnQueue = 1; G.spawnT = 999;
  const xp = {x:p.x+500,y:p.y,v:1}, gold = {x:p.x+500,y:p.y,v:1,gold:true};
  G.orbs = [xp, gold];
  const xpX = xp.x, goldX = gold.x; c.update(0.1);
  const xpMoved = xpX-xp.x, goldMoved = goldX-gold.x;
  ok('опыт и золото летят в 2,5 раза быстрее Бегуна',
     D.lootPull === runnerSpeed*2.5 && Math.abs(xpMoved-42.5)<0.01 && Math.abs(goldMoved-42.5)<0.01,
     runnerSpeed + ' → ' + D.lootPull + ' · за 0,1с: XP ' + xpMoved.toFixed(1) + ', золото ' + goldMoved.toFixed(1)); }

{ const c = loadGame('./index.html'); c.newGame('bow', 'keys');
  const G = c.__api.G, D = c.__api.D, p = G.player, DT = 1/60;
  G.enemies.length = 0; G.spawnQueue = 0; G.keys = {d:true};
  ok('рывок: полный заряд на старте и откат 5 секунд', p.dashN === D.dashMax && D.dashCd === 5,
     p.dashN + '/' + D.dashMax + ' · ' + D.dashCd.toFixed(1) + 'с');
  const started = c.tryDash();
  ok('рывок: откат начинается при расходовании', started && p.dashN === D.dashMax-1 &&
     Math.abs(p.dashCd-5) < 0.001 && Math.abs(p.dash-0.22) < 0.001,
     'КД ' + p.dashCd.toFixed(1) + 'с');
  const x0 = p.x, y0 = p.y;
  let guard = 0; while (p.dash > 0 && guard++ < 60) c.update(DT);
  const dashDist = Math.hypot(p.x-x0,p.y-y0);
  ok('рывок: дистанция увеличена примерно вдвое', dashDist > 220 && dashDist < 260,
     dashDist.toFixed(1) + ' единиц');
  G.keys = {}; p.dash = 0; p.dashN = 0; p.dashCd = 5;
  for (let i=0;i<299;i++) c.update(DT);
  const early = p.dashN;
  for (let i=0;i<2;i++) c.update(DT);
  ok('рывок: заряд не возвращается раньше пяти секунд', early === 0 && p.dashN === 1,
     'до: ' + early + ' · после: ' + p.dashN); }

{ const c = loadGame('./index.html');
  c.__api.STORE.data.shop = {dodge:25, sgold:100};
  c.newGame('bow','keys','thief');
  let G = c.__api.G; G.lvl = 25; c.recalc();
  const thiefDodge = c.__api.D.dodge, thiefMove = c.__api.D.mspd;
  ok('ВОР: уклонение только из магазина, скорость сохранена', thiefDodge === 25 &&
     Math.abs(thiefMove/235 - 1.25) < 0.001, 'уворот ' + thiefDodge + '% · бег ×' + (thiefMove/235).toFixed(2));
  ok('ВОР: +2% за уровень входит в общий процент золота', Math.abs(c.__api.D.goldFind - 2.50) < 0.001 &&
     c.__api.D.goldGainMult===1, 'магазин +100% · ВОР +50% · итог ×' + c.__api.D.goldFind.toFixed(2));
  const thiefDesc = c.__api.SUBCLASSES.bow.find(s=>s.id==='thief').desc;
  ok('ВОР: краткое описание соответствует механике',
     thiefDesc === '+2% ко всему получаемому золоту за уровень и +1% к скорости передвижения за уровень.');
  G.floor = 10; G.enemies.length = 0; G.spawnQueue = 0; G.orbs.length = 0;
  const oldRandom = Math.random;
  try {
    Math.random = () => 0.5;
    const e = c.spawnEnemy(); e.kind = 'norm'; e.typeKey = 'blob';
    c.killEnemy(e, G.enemies.indexOf(e));
  } finally { Math.random = oldRandom; }
  const dropped = G.orbs.filter(o => o.gold).reduce((s,o) => s+o.v, 0);
  const expectedDrop = Math.round((5+G.floor*0.3) * c.__api.D.goldFind * 1.025);
  ok('ВОР: общий процент применяется к золоту с врагов', dropped === expectedDrop,
     dropped + ' золота · ожидалось ' + expectedDrop);
  G.orbs.length = 0; G.enemies.length = 0; G.spawnQueue = 0; G.gold = 0;
  const floor = G.floor, p = G.player;
  G.portal = {x:p.x,y:p.y,r:28,t:2}; c.update(0.01);
  const expectedFloor = Math.round((12+floor*6) * c.__api.D.goldFind);
  ok('ВОР: общий процент усиливает награду за этаж', G.gold === expectedFloor,
     G.gold + ' золота · ожидалось ' + expectedFloor); }

{ const c = loadGame('./index.html'); c.newGame('bow', 'keys');
  const G = c.__api.G, totalAffixes = c.__api.AFFIXES.length;
  const inspect = f => {
    G.floor = f; c.buildFloor();
    const bosses = G.enemies.filter(e => e.kind === 'boss');
    return {f, bosses, text:f + ':' + bosses.length + 'x' + (bosses[0] ? bosses[0].aff.length : 0)};
  };
  const early = [3,6,9,10,13,16,19,20].map(inspect);
  ok('сетка X3/X6/X9/X0 создаёт 1/2/3/4 боссов',
     early.map(x => x.bosses.length).join(',') === '1,2,3,4,1,2,3,4',
     early.map(x => x.text).join(' · '));
  ok('аффиксы растут по десяткам, а 30-й этаж делает скачок к четырём',
     [23,26,29,30,40].map(inspect).map(x => x.text).join(',') ===
       '23:1x3,26:2x3,29:3x3,30:4x4,40:4x5');
  const end = inspect(80);
  ok('80-й этаж: четыре босса получают весь каталог', end.bosses.length === 4 &&
     end.bosses.every(b => b.aff.length === totalAffixes && new Set(b.aff.map(a => a.id)).size === totalAffixes),
     totalAffixes + ' аффиксов у каждого');
  const plateau = inspect(100);
  ok('после 80-го потолок остаётся восемь аффиксов', plateau.bosses.length === 4 &&
     plateau.bosses.every(b => b.aff.length === totalAffixes), plateau.text); }

{ const c = loadGame('./index.html'); c.newGame('bow', 'keys');
  const G = c.__api.G, boss = c.spawnEnemy('boss');
  c.killEnemy(boss, G.enemies.indexOf(boss));
  const e = c.spawnEnemy(), kind = e.kind === 'elite' ? 0.9 : 1;
  ok('победа над боссом: следующие враги +2% скорости', G.bossKills === 1 &&
     Math.abs(e.spd / (e.t.spd * kind) - 1.02) < 0.0001,
     'множитель ' + (e.spd / (e.t.spd * kind)).toFixed(4)); }

{ const c = loadGame('./index.html'); c.newGame('bow', 'keys');
  c.hurt(1e6, false, false, 'ТЕСТОВЫЙ ИСТОЧНИК');
  ok('смерть хранит источник и полученный урон', c.__api.G.over &&
     c.__api.G.player.deathLog.cause === 'ТЕСТОВЫЙ ИСТОЧНИК' && c.__api.G.player.deathLog.dmg > 0); }

{ const c = loadGame('./index.html'); c.newGame('bow', 'keys');
  const ru = [['KeyW','ц','w'],['KeyA','ф','a'],['KeyS','ы','s'],['KeyD','в','d']];
  ok('русская ЦФЫВ раскладка преобразуется в WASD',
    ru.every(([code,key,want]) => c.inputKey({code,key})===want));
  const G=c.__api.G, D=c.__api.D, p=G.player;
  G.enemies.length=0; G.spawnQueue=1; G.spawnT=999;
  G.keys={[c.inputKey({code:'KeyW',key:'ц'})]:true};
  const y=p.y; c.update(0.1);
  ok('физическая клавиша W движет вверх при русской раскладке',
    Math.abs((y-p.y)-D.mspd*0.1)<0.01, (y-p.y).toFixed(2)+' за 0.1 сек');
  ok('служебные C/V/L/P тоже не зависят от раскладки',
    c.inputKey({code:'KeyC',key:'с'})==='c' && c.inputKey({code:'KeyV',key:'м'})==='v' &&
    c.inputKey({code:'KeyL',key:'д'})==='l' && c.inputKey({code:'KeyP',key:'з'})==='p'); }

{ const c = loadGame('./index.html'); c.newGame('bow', 'keys');
  const G=c.__api.G, mods=['dmg.flat_all','dmg.inc_all','life.on_kill','dmg.more_all']
    .map(id=>c.__api.MODS.find(m=>m.id===id));
  const cards=mods.map((m,i)=>({m,v:i+1,val:'+'+(i+1)}));
  const event=(code,repeat=false)=>({code,key:'?',repeat,prevented:false,preventDefault(){this.prevented=true;}});
  ok('цифры 1–4 распознаются сверху и на цифровом блоке',
    c.inputKey({code:'Digit1',key:'!'})==='1' && c.inputKey({code:'Digit4',key:';'})==='4' &&
    c.inputKey({code:'Numpad1',key:'End'})==='1' && c.inputKey({code:'Numpad4',key:'ArrowLeft'})==='4');
  G.pending=1; G.levelUpCards=cards.slice(0,3);
  const before=G.picks.length, fourth=event('Digit4'); c.handleGameKeyDown(fourth);
  ok('клавиша 4 не выбирает карту в трёхкарточном ролле',
    fourth.prevented && G.pending===1 && G.picks.length===before);
  const second=event('Digit2'); c.handleGameKeyDown(second);
  ok('клавиша 2 выбирает вторую карточку повышения уровня',
    second.prevented && G.pending===0 && G.picks.length===before+1 && G.picks.at(-1).id===mods[1].id); }

{ const c = loadGame('./index.html'); c.newGame('bow', 'keys');
  const G=c.__api.G, mods=['dmg.flat_all','dmg.inc_all','life.on_kill','dmg.more_all']
    .map(id=>c.__api.MODS.find(m=>m.id===id));
  G.pending=1; G.levelUpCards=mods.map((m,i)=>({m,v:i+1,val:'+'+(i+1)}));
  const repeated={code:'Numpad4',key:'4',repeat:true,preventDefault(){}};
  c.handleGameKeyDown(repeated);
  const heldIgnored=G.pending===1 && G.picks.length===0;
  c.handleGameKeyDown({code:'Numpad4',key:'4',repeat:false,preventDefault(){}});
  ok('удержание игнорируется, одиночная 4 выбирает четвёртую карту',
    heldIgnored && G.pending===0 && G.picks.length===1 && G.picks[0].id===mods[3].id); }

{ const c = loadGame('./index.html'); c.newGame('bow', 'keys');
  const G=c.__api.G, p=G.player;
  const event=(repeat=false)=>({code:'Space',key:' ',repeat,prevented:false,preventDefault(){this.prevented=true;}});
  G.pending=1; G.rerolls=1; c.showLevelUp();
  const oldCards=G.levelUpCards, oldPicks=G.picks.length, oldDash=p.dashN, space=event();
  c.handleGameKeyDown(space);
  ok('пробел перебрасывает карточки активного повышения уровня',
    space.prevented && G.rerolls===0 && G.pending===1 && G.picks.length===oldPicks &&
    Array.isArray(G.levelUpCards) && G.levelUpCards!==oldCards && p.dashN===oldDash);

  G.rerolls=1;
  const heldCards=G.levelUpCards, held=event(true); c.handleGameKeyDown(held);
  const heldIgnored=held.prevented && G.rerolls===1 && G.levelUpCards===heldCards && p.dashN===oldDash;
  G.rerolls=0;
  const emptyCards=G.levelUpCards, empty=event(); c.handleGameKeyDown(empty);
  ok('удержание и нулевой запас не тратят переброс и не запускают рывок',
    heldIgnored && empty.prevented && G.rerolls===0 && G.levelUpCards===emptyCards &&
    G.pending===1 && p.dashN===oldDash); }
