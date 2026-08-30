/* Универсальные одноразовые карточки: четыре синие и три фиолетовые. */
const {loadGame}=require('./sim');
const ok=(nm,cond,det)=>console.log((cond?'  ✓ ':'  ✗ ')+nm.padEnd(58)+(det||''));

function fresh(weapon='bow',random=()=>0.99){
  const c=loadGame('./PolyGrind.html',{random}); c.newGame(weapon,'keys');
  const G=c.__api.G; G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.pending=0;
  return c;
}
function take(c,stat){ c.__api.G.bag.add(stat,'flag',1); c.recalc(); }
function fixedHit(c,n=100){
  const D=c.__api.D; D.baseMin=D.baseMax=n; D.elem={fire:0,cold:0,lit:0,poi:0};
  D.incAll=0; D.moreAll=1; D.critCh=0; D.minCrit=0; D.superCh=0; D.dblHit=0;
  D.igniteCh=D.chillCh=D.shockCh=D.poiCh=D.stun=D.knock=0;
}
function target(c,hp=1e9){
  const e=c.spawnEnemy(); e.x=e.y=9e5; e.hp=e.maxHp=hp; e.armor=0; e.bulwark=0; e.ward=null; e.kind='norm';
  return e;
}
function elementalStatuses(e,n=4){
  if(n>=1) Object.assign(e.dots.fire,{dps:10,minionDps:0,n:1,dur:3});
  if(n>=2) e.ail.chill=1;
  if(n>=3) Object.assign(e.dots.poison,{dps:10,minionDps:0,n:1,dur:4});
  if(n>=4) e.ail.shock=1;
}

{ const c=fresh(), ids=['def.respite','crit.critical_mass','def.durability_reserve','trig.attack_echo'];
  const mods=ids.map(id=>c.__api.MODS.find(m=>m.id===id));
  ok('четыре карточки существуют как синие одноразовые флаги для всех',
    mods.every(m=>m&&m.rar===1&&m.kind==='flag'&&c.allowedClassesForMod(m).length===4),mods.map(m=>m&&m.nm).join(' · '));
  c.__api.G.picks.push(...mods.map(m=>({id:m.id,nm:m.nm,val:'',cat:m.cat})));
  ok('после выбора одноразовые карточки полностью уходят из раздачи',
    Array.from({length:80},()=>c.rollCards()).flat().every(m=>!ids.includes(m.id))); }

{ const c=fresh(), ids=['ail.elemental_overload','crit.perfect_rhythm','cond.last_witness'];
  const mods=ids.map(id=>c.__api.MODS.find(m=>m.id===id));
  ok('три новые карточки существуют как фиолетовые одноразовые флаги для всех',
    mods.every(m=>m&&m.rar===2&&m.kind==='flag'&&c.allowedClassesForMod(m).length===4),mods.map(m=>m&&m.nm).join(' · '));
  c.__api.G.picks.push(...mods.map(m=>({id:m.id,nm:m.nm,val:'',cat:m.cat})));
  ok('выбранные фиолетовые карточки полностью уходят из раздачи',
    Array.from({length:80},()=>c.rollCards()).flat().every(m=>!ids.includes(m.id))); }

{ const c=fresh(),D=c.__api.D,m=c.__api.MODS.find(x=>x.id==='ail.elemental_overload');
  D.igniteCh=1; D.chillCh=1; D.shockCh=0; D.poiCh=0; const two=!m.show();
  D.poiCh=1; const three=m.show();
  ok('Элементальная перегрузка открывается только от трёх шансов эффектов',two&&three); }

{ const c=fresh(),G=c.__api.G; take(c,'elementalOverload'); fixedHit(c);
  const e=target(c),near=target(c),far=target(c); e.x=e.y=0; near.x=100; near.y=0; far.x=250; far.y=0;
  near.armor=60; elementalStatuses(e,4); e.ail.freeze=1;
  const eh=e.hp,nh=near.hp,fh=far.hp; c.damage(e,{direct:true});
  const primary=eh-e.hp,expected=c.mitigate(near,primary*0.80,0,true);
  ok('Перегрузка поглощает все четыре подходящих эффекта и связанную заморозку',
    e.dots.fire.dps===0&&e.ail.chill===0&&e.dots.poison.dps===0&&e.ail.shock===0&&e.ail.freeze===0);
  ok('взрыв исключает основную цель и берёт ровно 80% фактически прошедшего удара',
    primary>0&&Math.abs((nh-near.hp)-expected)<1e-9,'основа '+primary.toFixed(1)+' · сосед '+(nh-near.hp).toFixed(1));
  ok('радиус Перегрузки фиксирован на 200, а защита соседа применяется отдельно',
    expected<80&&far.hp===fh&&G.fx.some(x=>x.t==='ring'&&x.max===200)); }

{ const c=fresh(); take(c,'elementalOverload'); fixedHit(c);
  const two=target(c),n1=target(c); two.x=0; two.y=0; n1.x=100; n1.y=0; elementalStatuses(two,2); const h1=n1.hp; c.damage(two,{direct:true});
  const indirect=target(c),n2=target(c); indirect.x=1000; indirect.y=0; n2.x=1100; n2.y=0; elementalStatuses(indirect,3); const h2=n2.hp; c.damage(indirect,{});
  ok('Перегрузка не срабатывает от двух эффектов или непрямого урона',
    n1.hp===h1&&two.dots.fire.dps>0&&two.ail.chill>0&&n2.hp===h2&&indirect.dots.poison.dps>0); }

{ const c=fresh(),G=c.__api.G,p=G.player; take(c,'perfectRhythm'); fixedHit(c); const e=target(c),hp=e.hp;
  c.damage(e,{}); for(let i=0;i<6;i++) c.damage(e,{direct:true}); const before=G.stats.crits; c.damage(e,{direct:true});
  ok('Идеальный ритм не считает непрямой урон и гарантирует седьмой крит героя',
    p.perfectRhythmHeroN===7&&before===0&&G.stats.crits===1&&Math.abs(hp-e.hp-850)<1e-9); }

{ const c=fresh(),G=c.__api.G,p=G.player; take(c,'perfectRhythm'); fixedHit(c); const e=target(c);
  const start=c.activeCombatBuffs(p).join(' | ');
  for(let i=0;i<6;i++) c.damage(e,{direct:true});
  const ready=c.activeCombatBuffs(p).join(' | ');
  c.damage(e,{direct:true}); const reset=c.activeCombatBuffs(p).join(' | ');
  ok('HUD Идеального ритма считает атаки, показывает готовый крит и начинает новый цикл',
    start.includes('Perfect Rhythm - critical hit in 7 attacks')&&ready.includes('Perfect Rhythm — CRIT!')&&
    reset.includes('Perfect Rhythm - critical hit in 7 attacks'),start+' · '+ready+' · '+reset); }

{ const c=fresh('necro'),G=c.__api.G,p=G.player; take(c,'perfectRhythm'); fixedHit(c); const e=target(c),a=G.minions[0],b=G.minions[1];
  for(let i=0;i<6;i++) c.damage(e,{direct:true,minion:i%2?a:b});
  const readyHud=c.activeCombatBuffs(p).join(' | ');
  for(let i=0;i<6;i++) c.damage(e,{direct:true});
  const before=G.stats.crits; c.damage(e,{direct:true,minion:b}); const afterMin=G.stats.crits; c.damage(e,{direct:true});
  ok('вся свита делит один отдельный счётчик Идеального ритма',
    before===0&&afterMin===1&&G.stats.crits===2&&p.perfectRhythmMinionN===7&&p.perfectRhythmHeroN===7);
  ok('у Некроманта HUD использует общий счётчик атак свиты',readyHud.includes('Perfect Rhythm — CRIT!'),readyHud); }

{ const c=fresh(),G=c.__api.G,p=G.player; take(c,'lastWitness'); fixedHit(c); p.x=p.y=0;
  const e=target(c),other=target(c); e.x=100; e.y=0; other.x=500; other.y=0; const hp=e.hp; c.damage(e,{direct:true});
  ok('Последний свидетель даёт герою отдельный множитель ×1,35 по единственной цели',Math.abs(hp-e.hp-135)<1e-9,(hp-e.hp).toFixed(1));
  other.x=200; const crowded=e.hp; c.damage(e,{direct:true});
  ok('Последний свидетель отключается при двух живых врагах в радиусе 350',Math.abs(crowded-e.hp-100)<1e-9,(crowded-e.hp).toFixed(1));
  other.x=500; e.x=400; const outside=e.hp; c.damage(e,{direct:true});
  ok('цель за пределами 350 не получает бонус Последнего свидетеля',Math.abs(outside-e.hp-100)<1e-9,(outside-e.hp).toFixed(1)); }

{ const c=fresh('necro'),G=c.__api.G,p=G.player; take(c,'lastWitness'); fixedHit(c); p.x=p.y=0;
  const e=target(c),m=G.minions[0]; e.x=100; e.y=0; const solo=e.hp; c.damage(e,{direct:true,minion:m}); const soloLoss=solo-e.hp;
  const other=target(c); other.x=200; other.y=0; const crowded=e.hp; c.damage(e,{direct:true,minion:m});
  ok('Последний свидетель не усиливает удары свиты',Math.abs(soloLoss-(crowded-e.hp))<1e-9,soloLoss.toFixed(1)); }

{ const c=fresh(),G=c.__api.G,D=c.__api.D,p=G.player; take(c,'respite');
  const e=target(c); p.hp=D.life*0.30; const before=p.hp; c.update(4);
  const hud=c.activeCombatBuffs(p).join(' | ');
  ok('Передышка активируется после 4 секунд без лечения раньше срока',
    p.hp===before&&p.respiteT===4&&p.respiteHealT===3&&hud.includes('Respite')&&hud.includes('3.0'),hud);
  c.update(3); const first=p.hp;
  ok('первый тик Передышки восстанавливает ровно 5% max HP',Math.abs(first-before-D.life*0.05)<1e-9,before.toFixed(1)+' → '+first.toFixed(1));
  c.update(3);
  ok('Передышка повторяет 5% лечения каждые 3 секунды',Math.abs(p.hp-first-D.life*0.05)<1e-9,first.toFixed(1)+' → '+p.hp.toFixed(1));
  p.hp=D.life*0.58; p.respiteT=4; p.respiteHealT=0.1; c.update(1);
  ok('тик Передышки обрезается точно на 60% max HP',Math.abs(p.hp-D.life*0.60)<1e-9,p.hp.toFixed(1));
  p.respiteHealT=0.1; c.update(3);
  ok('на 60% Передышка прекращает лечение и скрывает HUD-таймер',Math.abs(p.hp-D.life*0.60)<1e-9&&p.respiteHealT===3&&
    !c.activeCombatBuffs(p).some(x=>x.includes('Respite')));
  c.hurt(1,true,false,'ТЕСТ');
  ok('реально полученный урон сбрасывает ожидание Передышки',p.respiteT===0&&p.respiteHealT===3);
  p.hp=D.life*0.30; p.respiteT=4; p.respiteHealT=0.1; G.portal={x:0,y:0}; const hp=p.hp; c.update(1);
  ok('открытый портал полностью отключает и сбрасывает Передышку',p.hp===hp&&p.respiteT===0&&p.respiteHealT===3&&
    !c.activeCombatBuffs(p).some(x=>x.includes('Respite'))); e.hp=0; }

{ const c=fresh(),G=c.__api.G,D=c.__api.D,p=G.player; take(c,'criticalMass'); fixedHit(c); const e=target(c);
  c.damage(e,{});
  ok('непрямой эффект не заряжает Критическую массу',p.criticalMass===0);
  c.damage(e,{direct:true}); const hud=c.activeCombatBuffs(p).join(' | ');
  ok('некритический прямой удар даёт +1% и отображается в HUD',p.criticalMass===1&&hud.includes('Critical Mass')&&hud.includes('+1%'),hud);
  p.criticalMass=100; const crits=G.stats.crits; c.damage(e,{direct:true});
  ok('накопленный шанс применяется к следующему удару и крит сбрасывает его',G.stats.crits===crits+1&&p.criticalMass===0);
  const n=fresh('necro'); take(n,'criticalMass'); fixedHit(n); const ne=target(n),m=n.__api.G.minions[0]; n.minionHit(ne,m);
  ok('прямой удар свиты Некроманта тоже заряжает Критическую массу',n.__api.G.player.criticalMass===1); }

{ const c=fresh(),G=c.__api.G,D=c.__api.D,p=G.player; take(c,'durabilityReserve'); fixedHit(c);
  let e=target(c,90); c.damage(e,{direct:true});
  ok('Запас прочности превращает ровно 20% overkill в барьер',Math.abs(p.reserveBarrier-2)<1e-9,p.reserveBarrier.toFixed(2)+' HP');
  p.reserveBarrier=0; e=target(c,1); c.damage(e,{direct:true}); const cap=D.life*0.12,hud=c.activeCombatBuffs(p).join(' | ');
  ok('барьер ограничен 12% max HP, живёт 4 секунды и виден в HUD',Math.abs(p.reserveBarrier-cap)<1e-9&&p.reserveBarrierT===4&&
    hud.includes('Durability Reserve')&&hud.includes('4.0'),hud);
  const hp=p.hp,before=p.reserveBarrier; c.hurt(5,true,false,'ТЕСТ');
  ok('временный барьер принимает урон раньше здоровья',p.hp===hp&&Math.abs(p.reserveBarrier-(before-5))<1e-9);
  p.reserveBarrier=0; p.reserveBarrierT=0; e=target(c,100); c.damage(e,{direct:true}); const exact=p.reserveBarrier; c.grantReserveBarrier(50); c.update(4);
  ok('точное убийство не даёт overkill, а временный барьер исчезает через 4 сек',exact===0&&p.reserveBarrier===0&&p.reserveBarrierT===0); }

{ const c=fresh(),G=c.__api.G,D=c.__api.D,p=G.player; take(c,'attackEcho'); fixedHit(c); const e=target(c),hp=e.hp;
  for(let i=0;i<3;i++) c.damage(e,{direct:true}); const beforeFourth=G.attackEchoes.length; c.damage(e,{direct:true});
  ok('Эхо атаки ставится в очередь только каждым четвёртым прямым ударом',beforeFourth===0&&G.attackEchoes.length===1&&p.attackEchoN===4);
  const afterFour=e.hp; c.update(0.17); const early=e.hp; c.update(0.01);
  ok('Эхо приходит через 0,18 сек и наносит ровно 30% удара',early===afterFour&&Math.abs((early-e.hp)-30)<1e-9,
    'основа '+(hp-afterFour).toFixed(0)+' · эхо '+(early-e.hp).toFixed(0));
  p.attackEchoN=3; D.dblHit=100; const e2=target(c); c.damage(e2,{direct:true}); c.update(0.18);
  ok('само эхо не создаёт новое эхо и не бросает двойное попадание',G.attackEchoes.length===0&&p.attackEchoN===5&&Math.abs(1e9-e2.hp-190)<1e-9,
    (1e9-e2.hp).toFixed(0)+' суммарного урона');
  const n=fresh('necro'); take(n,'attackEcho'); fixedHit(n); const ne=target(n),m=n.__api.G.minions[0]; n.__api.G.player.attackEchoN=3; n.minionHit(ne,m);
  ok('четвёртый прямой удар свиты также ставит Эхо атаки',n.__api.G.attackEchoes.length===1); }

{ const c=fresh(),card=c.__api.MODS.find(x=>x.id==='key.time_debt');
  ok('Долг времени — фиолетовый одноразовый кейстоун для всех классов',
    card&&card.rar===3&&card.kind==='flag'&&card.stat==='kTimeDebt'&&c.allowedClassesForMod(card).length===4);
  c.__api.G.picks.push({id:card.id,nm:card.nm,val:'',cat:card.cat});
  ok('после выбора Долг времени полностью уходит из раздачи',
    Array.from({length:100},()=>c.rollCards()).flat().every(x=>x.id!==card.id)); }

{ const c=fresh(),G=c.__api.G,p=G.player; take(c,'kTimeDebt'); const baseAspd=c.__api.D.aspd,e=target(c);
  c.damage(e,{direct:true}); const hud=c.activeCombatBuffs(p).join(' | ');
  ok('прямой удар даёт +6% скорости на 5 секунд и показывает бонус в HUD',
    p.timeDebtPct===6&&p.timeDebtT===5&&Math.abs(c.__api.D.aspd-baseAspd*1.06)<1e-9&&
    hud.includes('Time Debt')&&hud.includes('+6%')&&hud.includes('5.0'),hud); }

{ const c=fresh('necro'),G=c.__api.G,p=G.player; take(c,'kTimeDebt'); const e=target(c),m=G.minions[0];
  c.damage(e,{}); const afterIndirect=p.timeDebtPct; c.damage(e,{direct:true,minion:m});
  ok('непрямой урон не считается, а прямой удар свиты накапливает Долг времени',
    afterIndirect===0&&p.timeDebtPct===6&&p.timeDebtT===5); }

{ const c=fresh(),G=c.__api.G,p=G.player; take(c,'kTimeDebt'); const e=target(c);
  p.dashN=c.__api.D.dashMax;
  for(let i=0;i<7;i++) c.damage(e,{direct:true});
  const hud=c.activeCombatBuffs(p).join(' | '),fullCd=c.__api.D.dashCd;
  ok('на +42% начинается Остывание, а все рывки получают полный откат',
    p.timeDebtPct===42&&p.timeDebtT===5&&p.timeDebtCoolingT===5&&p.dashN===0&&p.dashCd===fullCd&&
    hud.includes('Cooling')&&hud.includes('+42%')&&hud.includes('Dashes 0/'),hud);
  const pct=p.timeDebtPct; c.damage(e,{direct:true}); c.update(1);
  ok('во время Остывания удары не добавляют стаки и не обновляют таймер',
    p.timeDebtPct===pct&&p.timeDebtT===4&&p.timeDebtCoolingT===4);
  c.update(5); const resetHud=c.activeCombatBuffs(p).join(' | '),baseAspd=c.__api.D.aspd;
  c.damage(e,{direct:true});
  ok('после Остывания бонус сбрасывается, HUD готов и накопление начинается заново',
    resetHud.includes('Time Debt · ready')&&p.timeDebtPct===6&&p.timeDebtCoolingT===0&&
    Math.abs(c.__api.D.aspd-baseAspd*1.06)<1e-9,resetHud); }
