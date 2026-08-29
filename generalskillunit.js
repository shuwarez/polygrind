/* Четыре универсальные синие одноразовые карточки. */
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

{ const c=fresh(), ids=['def.respite','crit.critical_mass','def.durability_reserve','trig.attack_echo'];
  const mods=ids.map(id=>c.__api.MODS.find(m=>m.id===id));
  ok('четыре карточки существуют как синие одноразовые флаги для всех',
    mods.every(m=>m&&m.rar===1&&m.kind==='flag'&&c.allowedClassesForMod(m).length===4),mods.map(m=>m&&m.nm).join(' · '));
  c.__api.G.picks.push(...mods.map(m=>({id:m.id,nm:m.nm,val:'',cat:m.cat})));
  ok('после выбора одноразовые карточки полностью уходят из раздачи',
    Array.from({length:80},()=>c.rollCards()).flat().every(m=>!ids.includes(m.id))); }

{ const c=fresh(),G=c.__api.G,D=c.__api.D,p=G.player; take(c,'respite');
  const e=target(c); p.hp=D.life*0.30; const before=p.hp; c.update(4);
  const hud=c.activeCombatBuffs(p).join(' | ');
  ok('Передышка активируется после 4 секунд без лечения раньше срока',
    p.hp===before&&p.respiteT===4&&p.respiteHealT===3&&hud.includes('Respite')&&hud.includes('3.0'),hud);
  c.update(3); const first=p.hp;
  ok('первый тик Передышки восстанавливает ровно 5% max HP',Math.abs(first-before-D.life*0.05)<1e-9,before.toFixed(1)+' → '+first.toFixed(1));
  c.update(3);
  ok('Передышка повторяет 5% лечения каждые 3 секунды',Math.abs(p.hp-first-D.life*0.05)<1e-9,first.toFixed(1)+' → '+p.hp.toFixed(1));
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
