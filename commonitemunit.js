/* Двенадцать обычных предметов: пул, источники, таймеры и HUD. */
const {loadGame}=require('./sim');
const DT=1/60;
let n=0,fail=0;
function ok(name,cond,detail=''){
  n++; if(!cond) fail++;
  console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(66)+detail);
}
function fresh(weapon='bow',items=[],random=()=>0.99){
  const c=loadGame('./index.html',{random});
  c.newGame(weapon,'keys');
  const G=c.__api.G;
  for(const id of items) G.amu[id]=true;
  c.recalc();
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.pending=0; G.portal=null;
  G.weapon.noAttack=true;
  return {c,G,p:G.player,get D(){return c.__api.D;}};
}
function fixed(c,value=100){
  const D=c.__api.D;
  D.baseMin=D.baseMax=value; D.elem={fire:0,cold:0,lit:0,poi:0};
  D.incAll=0; D.moreAll=1; D.critCh=0; D.minCrit=0; D.superCh=0; D.dblHit=0;
  D.igniteCh=D.chillCh=D.shockCh=D.poiCh=D.stun=D.knock=0;
}
function foe(c,x=1e5,y=1e5,hp=1e9,kind='norm'){
  const e=c.spawnEnemy(); e.x=x; e.y=y; e.spd=0; e.kind=kind;
  e.maxHp=e.hp=hp; e.armor=0; e.bulwark=0; e.ward=null;
  return e;
}
function dealt(c,e,src){ const hp=e.hp; c.damage(e,src); return hp-e.hp; }

const IDS=['copperChronometer','knottedCharm','tallyGloves','smithThumbstall','draftGloves','satinGloves',
  'hobnailedSoles','shortCircuitBoots','trailfinders','boneSpurs','firstTraceRing','closeHarvestRing'];
{
  const {c}=fresh(); const A=c.__api.AMULETS;
  ok('в каталоге есть 12 новых предметов обычного качества',IDS.every(id=>A[id]&&A[id].rar===0));
  ok('новые русские названия записаны не капсом и начинаются с заглавной',IDS.every(id=>{
    const s=A[id].nm; return s!==s.toUpperCase()&&s.split(/[-\s]+/).every(w=>!/[а-яё]/i.test(w)||w[0]===w[0].toUpperCase());
  }));
  ok('у названий, описаний и трёх индикаторов есть английские пары',IDS.every(id=>c.tr(A[id].nm)!==A[id].nm&&c.tr(A[id].nt)!==A[id].nt)&&
    c.tr('Медный Хронометр +25% урона')==='Copper Chronometer +25% damage'&&
    c.tr('Шипованные Подошвы - +20 к броне')==='Hobnailed Soles - +20 Armor'&&
    c.tr('Следопыта +10% скорости перемещения')==='Trailfinders +10% Movement Speed');
}

{
  const pool=w=>new Set(fresh(w).c.findDropPools().pool);
  const bow=pool('bow'),wand=pool('wand'),necro=pool('necro'),blade=pool('blade');
  ok('Перчатки Сквозняка попадают только в пул Лучника',bow.has('draftGloves')&&!wand.has('draftGloves')&&!necro.has('draftGloves')&&!blade.has('draftGloves'));
  ok('Сатиновые Перчатки попадают только в пул Мага',wand.has('satinGloves')&&!bow.has('satinGloves')&&!necro.has('satinGloves')&&!blade.has('satinGloves'));
  ok('Костяные Шпоры попадают только в пул Некроманта',necro.has('boneSpurs')&&!bow.has('boneSpurs')&&!wand.has('boneSpurs')&&!blade.has('boneSpurs'));
}

{
  const {c,G,p}=fresh('bow',['copperChronometer']); fixed(c);
  for(let i=0;i<121;i++) c.update(DT);
  ok('Медный Хронометр заряжается через 2 сек и появляется в HUD',p.copperReady&&c.activeCombatBuffs(p).includes('Copper Chronometer +25% damage'));
  const e=foe(c);
  const secondary=dealt(c,e,{direct:true,heroDirect:true,weaponAttack:true,primaryBasicHit:false,copperCharged:true});
  const primary=dealt(c,e,{direct:true,heroDirect:true,weaponAttack:true,primaryBasicHit:true,copperCharged:true});
  const after=dealt(c,e,{direct:true,heroDirect:true,weaponAttack:true,primaryBasicHit:true,copperCharged:true});
  ok('вторичная цепь не расходует заряд, первое прямое попадание получает +25%',secondary===100&&primary===125&&after===100&&!p.copperReady,`${secondary}/${primary}/${after}`);
}

{
  const {c,G,p,D}=fresh('bow',['knottedCharm']);
  p.hp=D.life; p.dashN=0; p.dashCd=D.dashCd;
  c.hurt(10,true,false,'ТЕСТ'); const first=p.dashCd;
  c.hurt(10,true,false,'ТЕСТ'); const second=p.dashCd;
  ok('Шнурованный Оберег восстанавливает 15% заряда и включает откат 1.5 сек',Math.abs(first-D.dashCd*0.85)<1e-9&&second===first&&G.amuT.knottedCharm===1.5);
  c.tickAmulets(1.5); c.hurt(10,true,false,'ТЕСТ');
  ok('после внутреннего отката Оберег снова восстанавливает заряд',p.dashCd<second);
  p.dashN=D.dashMax; p.dashCd=0; G.amuT.knottedCharm=0; c.hurt(1,true,false,'ТЕСТ');
  ok('Оберег не создаёт заряд сверх максимума',p.dashN===D.dashMax&&p.dashCd===0&&G.amuT.knottedCharm===0);
}

{
  const {c,p,D}=fresh('bow',['tallyGloves']); fixed(c); const base=D.aspd,e=foe(c);
  for(let i=0;i<11;i++) c.damage(e,{direct:true,heroDirect:true});
  c.damage(e,{direct:true,minion:{}}); c.damage(e,{direct:true,heroDirect:true,itemDamage:true});
  const before=p.tallyN; c.damage(e,{direct:true,heroDirect:true});
  ok('Перчатки Счёта считают только прямые удары героя и срабатывают на 12-м',before===11&&p.tallyN===12&&Math.abs(c.__api.D.aspd/base-1.2)<1e-9);
  c.update(1.5);
  ok('бонус Перчаток Счёта полностью спадает через 1.5 сек',p.tallyT===0&&Math.abs(c.__api.D.aspd-base)<1e-9);
}

{
  const {c}=fresh('bow',['smithThumbstall']); fixed(c); const attack=foe(c),wave=foe(c); attack.armor=wave.armor=60;
  const through=dealt(c,attack,{direct:true,heroDirect:true,weaponAttack:true});
  const blocked=dealt(c,wave,{direct:true,heroDirect:true});
  ok('Кузнечный Напальчник игнорирует 20 брони только у атак',Math.abs(through-60)<1e-9&&Math.abs(blocked-50)<1e-9,`${through.toFixed(0)}/${blocked.toFixed(0)}`);
  ok('Напальчник не меняет броню врага постоянно',attack.armor===60&&wave.armor===60);
}

{
  const {c,G,p,D}=fresh('bow',['draftGloves'],()=>0); fixed(c);
  c.spawnPlayerShot(p,0,G.weapon); G.shots[0].life=0; c.update(DT);
  const armed=p.draftReady; c.spawnPlayerShot(p,0,G.weapon); const boosted=G.shots[G.shots.length-1];
  ok('промах стрелы с успешным 1% роллом заряжает Перчатки Сквозняка',armed&&!p.draftReady);
  ok('следующая стрела получает +20% скорости и +40% самонаведения',Math.abs(Math.hypot(boosted.vx,boosted.vy)-G.weapon.speed*D.projSpd*1.2)<1e-7&&boosted.homingBonus===0.40);
  p.draftReady=false; const returning={hitSet:[],draftEligible:true,returnShot:true,returningArrow:false,secondaryArrow:false,
    x:0,y:0,vx:1,vy:0,a:0,oneArrowMul:1}; c.beginReturningArrow(returning); c.rollMissedShotItems(returning);
  ok('возвратная стрела не может зарядить Перчатки Сквозняка',!p.draftReady&&!returning.draftEligible);
}

{
  const {c,G,p}=fresh('wand',['satinGloves'],()=>0); fixed(c);
  c.spawnPlayerShot(p,0,G.weapon); G.shots[0].life=0; c.update(DT);
  const armed=p.satinReady; c.spawnPlayerShot(p,0,G.weapon); const boosted=G.shots[G.shots.length-1];
  ok('промах сферы с успешным 1% роллом заряжает Сатиновые Перчатки',armed&&!p.satinReady);
  ok('следующая обычная сфера получает ровно +20% в общую корзину радиуса',
    boosted.aoeBonusPct===20&&boosted.aoeScale===1&&boosted.r===9*c.__api.D.projSize);
  p.satinReady=true; c.spawnPlayerShot(p,0,G.weapon,true); const mini=G.shots[G.shots.length-1];
  ok('мини-сфера Мультипликации не расходует бонус Сатиновых Перчаток',
    p.satinReady&&mini.aoeBonusPct===0&&mini.aoeScale===c.__api.D.multiplierMiniArea);
}

{
  const {c,G,p,D}=fresh('bow',['hobnailedSoles']); const base=D.armor;
  for(let i=0;i<49;i++) c.update(DT);
  ok('Шипованные Подошвы дают +20 брони после 0.8 сек покоя и видны в HUD',p.hobnailedActive&&c.__api.D.armor===base+20&&c.activeCombatBuffs(p).includes('Hobnailed Soles - +20 Armor'));
  const x=p.x; p.vx=200; c.update(DT);
  ok('стойка Шипованных Подошв гасит обычное отбрасывание',Math.abs(p.x-x)<1e-9&&p.vx===0);
  G.keys.d=true; c.update(DT);
  ok('любое движение немедленно снимает стойку Подошв',!p.hobnailedActive&&c.__api.D.armor===base);
}

{
  const {c,G,p,D}=fresh('bow',['shortCircuitBoots']); const a=foe(c,25,0),boss=foe(c,40,0,1e9,'boss');
  p.faceX=1; p.faceY=0; p.dashN=1; c.tryDash(); c.update(0.05);
  ok('Сапоги Короткого Разряда замедляют каждую пересечённую цель один раз',p.shortCircuitHits.length===2&&a.shortCircuitT>0&&boss.shortCircuitT>0);
  ok('обычная цель замедляется на 40%, босс — на 20%',a.shortCircuitSlow===0.60&&boss.shortCircuitSlow===0.80);
}

{
  const {c,p,D}=fresh('bow',['trailfinders']); const base=D.mspd;
  for(let i=0;i<301;i++) c.update(DT);
  ok('Следопыты дают +10% скорости после 5 сек без урона и видны в HUD',p.trailfinderActive&&Math.abs(c.__api.D.mspd/base-1.1)<1e-9&&c.activeCombatBuffs(p).includes('Trailfinders +10% Movement Speed'));
  c.__api.D.dodge=100; c.hurt(10,false,false,'ТЕСТ');
  ok('уклонение не снимает бонус Следопытов',p.trailfinderActive);
  c.hurt(10,true,false,'ТЕСТ');
  ok('фактически полученный урон снимает Следопыты и начинает отсчёт заново',!p.trailfinderActive&&p.trailfinderT===0&&Math.abs(c.__api.D.mspd-base)<1e-9);
}

{
  function move(item,x){
    const {c,G,p}=fresh('necro',item?['boneSpurs']:[]); G.minions.length=0; c.spawnMinion(x,0,'skeleton');
    const m=G.minions[0]; G.keys.d=true; const before=m.x; c.update(0.05); return m.x-before;
  }
  const normal=move(false,-100),boosted=move(true,-100),farBase=move(false,-400),far=move(true,-400);
  ok('Костяные Шпоры ускоряют движение близкой свиты на 25%',Math.abs(boosted/normal-1.25)<0.02,`${normal.toFixed(1)} → ${boosted.toFixed(1)}`);
  ok('приспешник за пределами радиуса 300 бонус Шпор не получает',Math.abs(far-farBase)<0.02,`${farBase.toFixed(1)}/${far.toFixed(1)}`);
}

{
  const {c}=fresh('bow',['firstTraceRing']); fixed(c); const e=foe(c);
  const first=dealt(c,e,{direct:true,heroDirect:true,weaponAttack:true});
  const second=dealt(c,e,{direct:true,heroDirect:true,weaponAttack:true});
  ok('Кольцо Первого Следа даёт +10% один раз по цели с полным HP',first===110&&second===100&&e.firstTraceSpent,`${first}/${second}`);
  const wave=foe(c); const waveHit=dealt(c,wave,{direct:true,heroDirect:true}); wave.hp=wave.maxHp;
  const afterWave=dealt(c,wave,{direct:true,heroDirect:true,weaponAttack:true});
  ok('волна не получает и не расходует Кольцо Первого Следа',waveHit===100&&afterWave===110);
}

{
  const {c,G,p,D}=fresh('bow',['closeHarvestRing']); p.hp=D.life*0.5;
  const near=foe(c,50,0,1); c.killEnemy(near,G.enemies.indexOf(near)); const first=p.hp;
  const second=foe(c,50,0,1); c.killEnemy(second,G.enemies.indexOf(second)); const during=p.hp;
  c.tickAmulets(1); const third=foe(c,50,0,1); c.killEnemy(third,G.enemies.indexOf(third)); const after=p.hp;
  ok('Кольцо Близкой Жатвы лечит на 1% max HP с откатом 1 сек',Math.abs(first-D.life*0.51)<1e-9&&during===first&&Math.abs(after-D.life*0.52)<1e-9);
  c.tickAmulets(1); const noLoot=foe(c,50,0,1); noLoot.noLoot=true; c.killEnemy(noLoot,G.enemies.indexOf(noLoot));
  ok('враг без награды не запускает Кольцо Близкой Жатвы',p.hp===after&&G.amuT.closeHarvestRing===0);
  p.hp=D.life-0.25; const final=foe(c,50,0,1); c.killEnemy(final,G.enemies.indexOf(final));
  ok('перелечение Кольца обрезается на max HP и не создаёт барьер',p.hp===D.life&&p.barrier===0&&p.reserveBarrier===0);
}

console.log(JSON.stringify({n,fail}));
if(fail) process.exitCode=1;
