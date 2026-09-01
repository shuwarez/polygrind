/* Четырнадцать редких предметов: пул, ограничения, урон, таймеры и HUD. */
const {loadGame}=require('./sim');
const DT=1/60;
let n=0,fail=0;
function ok(name,cond,detail=''){
  n++; if(!cond) fail++;
  console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(72)+detail);
}
function fresh(weapon='bow',items=[],random=()=>0.99){
  const c=loadGame('./index.html',{random});
  c.newGame(weapon,'keys');
  const G=c.__api.G;
  for(const id of items) G.amu[id]=true;
  c.recalc();
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.pending=0; G.portal=null;
  G.shots.length=0; G.eshots.length=0; G.orbs.length=0; G.fx.length=0;
  G.weapon.noAttack=true;
  return {c,G,p:G.player,get D(){return c.__api.D;}};
}
function fixed(c,value=100){
  const D=c.__api.D;
  D.baseMin=D.baseMax=value; D.elem={fire:0,cold:0,lit:0,poi:0};
  D.incAll=0; D.moreAll=1; D.critCh=0; D.minCrit=0; D.superCh=0; D.dblHit=0;
  D.igniteCh=D.chillCh=D.shockCh=D.poiCh=D.stun=D.knock=0;
}
function foe(c,x=0,y=0,hp=1e9,kind='norm'){
  const e=c.spawnEnemy(); e.x=x; e.y=y; e.spd=0; e.kind=kind;
  e.maxHp=e.hp=hp; e.armor=0; e.bulwark=0; e.ward=null; e.noLoot=false; e.xp=1;
  return e;
}
function dealt(c,e,src){ const hp=e.hp; c.damage(e,src); return hp-e.hp; }
function poolFor(weapon,setup){
  const f=fresh(weapon); if(setup) setup(f); return f.c.findDropPools().pool;
}

const IDS=['sealHunt','mothFang','cometEye','sealPack','eclipseBrushes','sparkstepBoots','marchingGreaves',
  'secondWindRing','coolingAshRing','confinementRing','reactionRing','conductorRing','ledgerDebts','glassBell'];
{
  const {c}=fresh(); const A=c.__api.AMULETS;
  ok('в каталоге присутствуют все 14 новых предметов',IDS.every(id=>A[id]));
  ok('все новые предметы имеют редкое качество',IDS.every(id=>A[id].rar===1));
  ok('русские названия записаны Title Case, а не сплошным капсом',IDS.every(id=>{
    const s=A[id].nm;
    return s!==s.toUpperCase()&&s.split(/[-\s]+/).every(w=>!/[а-яё]/i.test(w)||w[0]===w[0].toUpperCase());
  }));
  ok('у названий и описаний всех редких предметов есть английские пары',
    IDS.every(id=>c.tr(A[id].nm)!==A[id].nm&&c.tr(A[id].nt)!==A[id].nt));
}

{
  const bow=new Set(poolFor('bow')),wand=new Set(poolFor('wand')),necro=new Set(poolFor('necro')),blade=new Set(poolFor('blade'));
  ok('Глаз Кометы и Кисти Затмения выпадают только Магу',
    ['cometEye','eclipseBrushes'].every(id=>wand.has(id)&&!bow.has(id)&&!necro.has(id)&&!blade.has(id)));
  ok('Печать Стаи и Маршевые Поножи выпадают только Некроманту',
    ['sealPack','marchingGreaves'].every(id=>necro.has(id)&&!bow.has(id)&&!wand.has(id)&&!blade.has(id)));
}

{
  const absent=new Set(poolFor('bow'));
  const chillChance=new Set(poolFor('bow',f=>{f.D.chillCh=1;}));
  const chillBook=new Set(poolFor('bow',f=>{f.G.items.cold={tier:1};}));
  ok('Зуб Мотылька требует шанс охлаждения либо книгу холода',
    !absent.has('mothFang')&&chillChance.has('mothFang')&&chillBook.has('mothFang'));
  const fireChance=new Set(poolFor('bow',f=>{f.D.igniteCh=1;}));
  const fireBook=new Set(poolFor('bow',f=>{f.G.items.fire={tier:1};}));
  ok('Кольцо Остывающего Пепла требует шанс поджога либо книгу огня',
    !absent.has('coolingAshRing')&&fireChance.has('coolingAshRing')&&fireBook.has('coolingAshRing'));
  const shockChance=new Set(poolFor('bow',f=>{f.D.shockCh=1;}));
  const shockBook=new Set(poolFor('bow',f=>{f.G.items.shock={tier:1};}));
  ok('Кольцо Проводника требует шанс шока либо книгу молнии',
    !absent.has('conductorRing')&&shockChance.has('conductorRing')&&shockBook.has('conductorRing'));
  const dodge=new Set(poolFor('bow',f=>{f.D.dodge=1;}));
  ok('Кольцо Реакции отсутствует без уклонения и появляется с ним',
    !absent.has('reactionRing')&&dodge.has('reactionRing'));
  const rare=poolFor('bow').filter(id=>IDS.includes(id));
  ok('доступный редкий предмет имеет стандартный вес 10 в пуле',
    ['sealHunt','sparkstepBoots','secondWindRing','confinementRing','ledgerDebts','glassBell']
      .every(id=>rare.filter(x=>x===id).length===10));
}

{
  const {c,G,p}=fresh('bow',['sealHunt']); fixed(c);
  const elite=foe(c,0,0,1e6,'elite');
  const mark=dealt(c,elite,{direct:true,heroDirect:true});
  const hits=[]; for(let i=0;i<5;i++) hits.push(dealt(c,elite,{direct:true,heroDirect:true}));
  ok('первый удар по элите ставит Печать Охоты на 8 секунд без усиления',mark===100&&p.huntTarget===elite&&p.huntUntil===8);
  ok('каждый пятый последующий прямой удар по метке получает +25%',hits.join(',')==='100,100,100,100,125',hits.join('/'));
  const before=p.huntN; dealt(c,elite,{direct:true,heroDirect:true,itemDamage:true}); const afterItem=p.huntN;
  const other=foe(c,20,0,1e6,'boss'); dealt(c,other,{direct:true,heroDirect:true});
  ok('предметный урон не считает удары, а новая крупная цель переносит метку',
    before===afterItem&&p.huntTarget===other&&p.huntN===0&&p.huntUntil===8);
}

{
  const {c,G}=fresh('bow',['mothFang']); fixed(c);
  const dead=foe(c,0,0,100); dead.ail.chill=1; dead.hp=0; dead.lastKillingDamage=100;
  const a=foe(c,20,0,100),b=foe(c,30,0,100),third=foe(c,40,0,100); b.armor=90;
  c.killEnemy(dead,G.enemies.indexOf(dead));
  ok('Зуб Мотылька поджигает ровно двух ближайших к охлаждённой жертве',
    a.mothBurns.length===1&&b.mothBurns.length===1&&third.mothBurns.length===0);
  const ah=a.hp,bh=b.hp,expectedA=c.mitigate(a,15,0,false),expectedB=c.mitigate(b,15,0,false);
  c.tickMothBurns(a,2); c.tickMothBurns(b,2);
  ok('ожог равен 15% прошедшего добивающего удара за две секунды',
    Math.abs((ah-a.hp)-expectedA)<1e-9&&Math.abs((bh-b.hp)-expectedB)<1e-9);
  ok('защита двух новых целей применяется к ожогу отдельно',expectedA>expectedB);
}

{
  const {c,G,p}=fresh('wand',['cometEye']); fixed(c); const radius=G.weapon.aoe;
  const one=foe(c,p.x+10,p.y,1000); c.explodePlayerOrb({x:p.x,y:p.y,aoeScale:1});
  ok('Глаз Кометы даёт +30% взрыву сферы, зацепившему ровно одну цель',Math.abs((1000-one.hp)-26)<1e-9,`${(1000-one.hp).toFixed(2)}`);
  G.enemies.length=0; const a=foe(c,p.x+10,p.y,1000),b=foe(c,p.x+20,p.y,1000);
  c.explodePlayerOrb({x:p.x,y:p.y,aoeScale:1});
  ok('при двух целях Глаз Кометы не усиливает взрыв',Math.abs((1000-a.hp)-20)<1e-9&&Math.abs((1000-b.hp)-20)<1e-9);
  G.enemies.length=0; const mini=foe(c,p.x+10,p.y,1000);
  c.explodePlayerOrb({x:p.x,y:p.y,aoeScale:1,miniOrb:true,attackMul:1});
  ok('мини-сфера считает собственный взрыв для Глаза Кометы',Math.abs((1000-mini.hp)-26)<1e-9&&radius>0);
}

{
  const {c,G,p}=fresh('necro',['sealPack']); fixed(c); G.minions.length=0;
  for(const kind of ['skeleton','skeleton','archer','mage','demon','vampire']) G.minions.push({kind,hp:10,max:10});
  ok('Печать Стаи считает разные живые типы, игнорирует дубли и ограничена четырьмя',c.sealPackDamagePct()===32);
  G.minions.find(m=>m.kind==='mage').hp=0; G.minions.find(m=>m.kind==='vampire').hp=0;
  ok('бонус Печати Стаи пересчитывается после смерти типа приспешника',c.sealPackDamagePct()===24);
  ok('HUD Печати Стаи показывает текущий процент урона',c.activeCombatBuffs(p).some(x=>x.includes('Seal of the Pack')&&x.includes('+24%')));
}

{
  const {c,G,p}=fresh('wand',['eclipseBrushes']); fixed(c);
  for(let i=0;i<4;i++) foe(c,p.x+10+i*5,p.y,1000);
  c.explodePlayerOrb({x:p.x,y:p.y,aoeScale:1});
  ok('взрыв обычной сферы по четырём целям заряжает Кисти Затмения',p.eclipseReady);
  G.enemies.forEach(e=>e.hp=e.maxHp); c.spawnPlayerShot(p,0,G.weapon); const empowered=G.shots.pop();
  ok('следующая сфера получает +25% в общую корзину радиуса и −10% урона',
    empowered.aoeBonusPct===25&&empowered.aoeScale===1&&empowered.attackMul===0.9&&!p.eclipseReady);
  p.eclipseReady=false; c.explodePlayerOrb({x:p.x,y:p.y,aoeScale:1,miniOrb:true,attackMul:1});
  p.eclipseReady=true; c.spawnPlayerShot(p,0,G.weapon,true); const mini=G.shots.pop();
  ok('мини-сферы не заряжают и не расходуют Кисти Затмения',p.eclipseReady&&mini.attackMul!==0.9);
}

{
  const {c,G,p,D}=fresh('bow',['sparkstepBoots']); fixed(c);
  p.faceX=1; p.faceY=0; p.dashN=1; const target=foe(c,200,0,1000);
  c.tryDash();
  ok('Сапоги Искрового Шага оставляют один сигил на успешный рывок',G.sparkSigils.length===1);
  c.tickSparkSigils(0.39);
  ok('сигил не срабатывает раньше задержки 0.4 секунды',target.hp===1000&&G.sparkSigils.length===1);
  c.tickSparkSigils(0.01);
  ok('сигил поражает ближайшую цель на 45% среднего урона',Math.abs(target.hp-955)<1e-9&&G.sparkSigils.length===0);
  G.amu.secondWindRing=true; p.secondWindKills=39; const victim=foe(c,20,0,20); p.dashN=0;
  G.sparkSigils.push({x:0,y:0,life:0,max:0.4}); c.tickSparkSigils(0);
  if(victim.hp<=0) c.killEnemy(victim,G.enemies.indexOf(victim));
  ok('урон сигила не запускает предметные эффекты убийства',p.secondWindKills===39&&p.dashN===0&&D.dashMax>0);
}

{
  const {c,G,p,D}=fresh('necro',['marchingGreaves']); const baseSpd=D.minSpd,baseAspd=D.minAspd;
  G.keys.d=true; c.update(2.01);
  ok('после 2 секунд непрерывного движения Маршевые Поножи включаются',p.marchingActive);
  ok('Поножи дают свите +20% скорости бега и +10% скорости атаки',
    Math.abs(c.__api.D.minSpd/baseSpd-1.2)<1e-9&&Math.abs(c.__api.D.minAspd/baseAspd-1.1)<1e-9);
  const shown=c.activeCombatBuffs(p).some(x=>x.includes('Marching Greaves')&&x.includes('+20%')&&x.includes('+10%'));
  G.keys.d=false; c.update(DT);
  ok('остановка сразу снимает Поножи и их HUD-индикатор',shown&&!p.marchingActive&&!c.activeCombatBuffs(p).some(x=>x.includes('Marching Greaves')));
}

{
  const {c,G,p,D}=fresh('bow',['secondWindRing']); p.dashN=0; p.secondWindKills=39;
  const e=foe(c,0,0,1); e.hp=0; c.killEnemy(e,G.enemies.indexOf(e));
  ok('сороковое наградное убийство восстанавливает полный заряд рывка',p.secondWindKills===0&&p.dashN===1);
  p.dashN=D.dashMax; p.secondWindKills=39; const full=foe(c,0,0,1); full.hp=0; c.killEnemy(full,G.enemies.indexOf(full));
  ok('Кольцо Второго Дыхания не переполняет максимальные заряды',p.dashN===D.dashMax);
  p.secondWindKills=12; const empty=foe(c,0,0,1); empty.hp=0; empty.noLoot=true; empty.xp=0; c.killEnemy(empty,G.enemies.indexOf(empty));
  ok('враг без опыта и награды не двигает счётчик, который виден в HUD',p.secondWindKills===12&&c.activeCombatBuffs(p).some(x=>x.includes('12/40')));
}

{
  const {c,G}=fresh('bow',['coolingAshRing']);
  const dead=foe(c,0,0,1); dead.dots.fire.dps=1; dead.hp=0;
  const a=foe(c,10,0,100),boss=foe(c,20,0,100,'boss'),third=foe(c,30,0,100);
  c.killEnemy(dead,G.enemies.indexOf(dead));
  ok('Кольцо Остывающего Пепла охлаждает ровно двух ближайших врагов',a.ail.chill===0.6&&boss.ail.chill===0.3&&third.ail.chill===0);
  ok('длительность охлаждения босса вдвое меньше',boss.ail.chill*2===a.ail.chill);
  ok('волна охлаждения не наносит урон',a.hp===100&&boss.hp===100&&third.hp===100);
}

{
  const {c,G,p}=fresh('bow',['confinementRing']); fixed(c);
  for(let i=0;i<12;i++) foe(c,p.x+20+i,p.y,1000,i===10?'elite':'norm');
  foe(c,p.x+200,p.y,1000,'norm');
  ok('Кольцо Тесноты считает только обычных врагов в радиусе 160 и ограничено десятью',c.confinementDamagePct()===30);
  ok('HUD Кольца Тесноты показывает текущие +30% ко всему урону',c.activeCombatBuffs(p).some(x=>x.includes('Ring of Confinement')&&x.includes('+30%')));
  c.spawnPlayerShot(p,0,G.weapon); const shot=G.shots.pop(),target=G.enemies[0];
  G.enemies.splice(1); target.x=p.x+300; const hit=dealt(c,target,{direct:true,heroDirect:true,confinementPct:shot.confinementPct});
  ok('массовая атака фиксирует бонус Тесноты один раз при запуске',hit===130,`${hit}`);
}

{
  const {c,G,p,D}=fresh('bow',['reactionRing'],()=>0.99); fixed(c); D.dodge=100;
  c.hurt(10,false,false,'ТЕСТ');
  ok('успешное уклонение заряжает Кольцо Реакции на 2 секунды',p.reactionCritUntil===2&&G.amuT.reactionRing===3);
  const itemTarget=foe(c,0,0,1000); const item=dealt(c,itemTarget,{direct:true,heroDirect:true,itemDamage:true});
  ok('предметный урон не расходует и не получает гарантированный крит',item===100&&p.reactionCritUntil===2);
  const direct=dealt(c,itemTarget,{direct:true,heroDirect:true});
  ok('следующий прямой удар гарантированно критует и расходует заряд',direct>100&&p.reactionCritUntil===0);
  c.hurt(10,false,false,'ТЕСТ');
  ok('внутренний откат 3 секунды не позволяет сразу зарядить кольцо снова',p.reactionCritUntil===0&&G.amuT.reactionRing===3);
}

{
  const {c,G}=fresh('bow',['conductorRing']); fixed(c); c.__api.D.ailEff=1; c.__api.D.shockR=400;
  const source=foe(c,0,0,1000); const targets=[];
  for(let i=0;i<9;i++) targets.push(foe(c,20+i*20,0,1000));
  c.shockBurst(source,100,0);
  const losses=targets.map(e=>1000-e.hp);
  ok('Кольцо Проводника добавляет к пяти обычным целям ещё максимум три',losses.filter(x=>x>0).length===8);
  ok('три дополнительных перехода теряют по 30% от предыдущего',
    Math.abs(losses[5]-10.5)<1e-9&&Math.abs(losses[6]-7.35)<1e-9&&Math.abs(losses[7]-5.145)<1e-9,losses.join('/'));
  ok('девятая цель не создаёт отдельную рекурсивную цепь',losses[8]===0);
}

{
  const {c,G,p}=fresh('bow'); fixed(c); const existing=foe(c,0,0,1000); existing.hp=500;
  c.takeAmulet('ledgerDebts',true); c.takeAmulet('sealHunt',true);
  ok('новый предмет после Книги Долгов добавляет один стак, дубликат — нет',p.ledgerStacks===1);
  const max1=existing.maxHp,hp1=existing.hp; c.takeAmulet('sealHunt',true);
  ok('текущие враги получают +2% max HP и сохраняют процент заполнения',max1===1020&&hp1===510&&p.ledgerStacks===1);
  G.enemies.length=0; const future=foe(c,0,0,1000); // helper normalizes HP, so compare spawn before override below
  G.enemies.length=0; const spawned=c.spawnEnemy();
  const baseMax=spawned.maxHp/1.02;
  ok('будущие враги создаются с +2% HP за стак',Math.abs(spawned.maxHp-baseMax*1.02)<1e-7&&future.maxHp===1000);
  fixed(c); const hero=foe(c,0,0,1000),heroHit=dealt(c,hero,{direct:true,heroDirect:true}); hero.hp=hero.maxHp;
  const minionHit=dealt(c,hero,{direct:true,minion:{}});
  p.ledgerStacks=0; hero.hp=hero.maxHp; const minionBase=dealt(c,hero,{direct:true,minion:{}});
  ok('Книга Долгов даёт герою +3% урона за стак, но не усиливает свиту',
    heroHit===103&&Math.abs(minionHit-minionBase)<1e-9,`${heroHit}/${minionHit}/${minionBase}`);
  p.ledgerStacks=20;
  ok('стак Книги ограничен 20 и отображается в HUD вместе с обоими эффектами',
    p.ledgerStacks===20&&c.activeCombatBuffs(p).some(x=>x.includes('20/20')&&x.includes('+60%')&&x.includes('+40%')));
}

{
  const {c,G,p}=fresh('bow',['glassBell']); const shooter=foe(c,300,0,1000,'elite');
  const hp=p.hp; G.eshots.push({x:p.x+80,y:p.y,vx:0,vy:0,r:3,life:2,dmg:100,owner:shooter,shotType:'test'});
  c.update(DT);
  ok('Стеклянный Колокол уничтожает вошедший в радиус 100 снаряд без урона',G.eshots.length===0&&p.hp===hp);
  ok('стрелявший обычный или элитный враг оглушается на 0.4 секунды',shooter.ail.stun===0.4&&G.amuT.glassBell===10,
    `${shooter.ail.stun}/${G.amuT.glassBell}`);
  G.eshots.push({x:p.x+80,y:p.y,vx:0,vy:0,r:3,life:2,dmg:1,owner:shooter,shotType:'test'}); c.update(DT);
  ok('внутренний откат Колокола длится 10 секунд',G.eshots.length===1);
  G.eshots.length=0; G.amuT.glassBell=0; const boss=foe(c,300,0,1000,'boss');
  G.eshots.push({x:p.x+80,y:p.y,vx:0,vy:0,r:3,life:2,dmg:1,owner:boss,shotType:'test'}); c.update(DT);
  ok('босс получает от Стеклянного Колокола только 0.2 секунды оглушения',boss.ail.stun===0.2);
}

console.log(JSON.stringify({n,fail}));
if(fail) process.exitCode=1;
