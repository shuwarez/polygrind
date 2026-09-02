/* ---------- 6. НАНЕСЕНИЕ УРОНА ---------- */
/* Собирает все условные модификаторы в один процент и применяет формулу */
function momentumDamageInc(p=G && G.player){
  return p && amu('momentum') ? Math.min(40,Math.floor(p.moveT/2)*4) : 0;
}
/* src — кто бьёт. Условия про состояние хозяина (движение, здоровье, недавнее
   убийство) остаются про хозяина: это его состояние, свита им пользуется.
   Число врагов рядом считается вокруг непосредственного источника удара. */
function conditionalInc(e, src, damageConditions=null){
  const b = G.bag, p = G.player, from = (src && src.minion) || p; let inc = 0;
  if (e.hp / e.maxHp <= INJURED_HP_THRESHOLD) inc += b.sum('vsLow');
  if (e.hp >= e.maxHp)       inc += b.sum('vsFull');
  if (e.kind !== 'norm')     inc += b.sum('vsBoss');
  const vsSlowed=b.sum('vsSlowed');
  if (vsSlowed&&isEnemySlowed(e)) inc += vsSlowed;
  if (p.moving)              inc += b.sum('whMove');
  if (p.stillT > 0.6)        inc += b.sum('whStill');
  if (amu('runner') && p.stillT > 1) inc += 20;         // талисман бегуна: награда за остановку
  // КОГТИ БЕРСЕРКА: по одному проценту за каждые полные 10% потерянного здоровья
  if (amu('claws')) inc += Math.floor((1 - p.hp/D.life) * 10);
  // КОЛЬЦО ДОБИВАНИЯ
  if (amu('exec') && e.hp/e.maxHp < 0.20) inc += 50;
  /* ТОТЕМЫ. Стоят здесь, а не в D.incAll, ровно потому, что процент условный:
     он смотрит на состояние цели. Заодно это значит, что тотемы работают
     и на удары свиты — conditionalInc общий для всех источников урона. */
  if (G.totems){
    if (enemyBurning(e))         inc += totemVal('fire');
    if (e.ail.freeze      > 0) inc += totemVal('freeze');
    if (e.dots.poison.dps > 0) inc += totemVal('poison');
    if (e.dots.bleed.dps  > 0) inc += totemVal('blood');
    if (e.ail.shock        > 0) inc += totemVal('lightning');
  }
  // РАЗГОН: считаем полные двухсекундные отрезки непрерывного бега
  inc += momentumDamageInc(p);
  // ОСАДНЫЙ ОГОНЬ: платой за +70% идёт половина скорости, см. движение игрока
  if (amu('siege') && p.stillT > 1.5) inc += 70;
  // ГЛАЗ ХИЩНИКА
  if (amu('predator') && p.predT > 0) inc += 20;
  // ОСКОЛОК БОССА: потолок в десять элит поставлен мной — без него комната
  // с элитной пачкой давала бы +100% и больше на ровном месте
  if (amu('bossShard')) inc += damageConditions
    ? damageConditions.damageBossShardInc : bossShardDamageInc();
  if (p.killT > 0)           inc += b.sum('afterKill');
  const near = b.sum('perNear');
  if (near) inc += near * (damageConditions
    ? damageConditions.damageNearbyCount
    : src && src.damageNearbyCount!==undefined ? src.damageNearbyCount
    : src && src.minionNearbyCount!==undefined ? src.minionNearbyCount
    : nearbyDamageEnemyCount(from));
  return inc;
}

/* Сопротивление именно обычному отбрасыванию от навыка. Шанс срабатывания
   не режется — уменьшается сила импульса. Более высокий класс врага важнее
   геометрии: элитный Бегун получает элитные 50%, а не обычные 70%. */
function knockbackScale(e){
  if (e.kind === 'boss') return 0.10;
  if (e.kind === 'elite') return 0.50;
  if (e.typeKey === 'runner') return 0.70;
  return 1;
}

/* КОСТЯНОЙ ВЫЗОВ: бросок делается на каждый фактический прямой удар свиты.
   Цель запоминает именно ударившего бойца и держит агро, пока тот остаётся жив.
   Снаряд погибшего приспешника не может создать уже недостижимую цель. */
function rollBoneChallenge(e, m){
  if (!D.boneChallenge || !e || e.dead || !m || m.hp <= 0 || G.minions.indexOf(m) < 0)
    return false;
  if (Math.random() >= 0.01) return false;
  e.tauntMinion = m;
  statusText(e, 'ВЫЗОВ', '#ff9b32');
  G.fx.push({t:'ring', x:m.x, y:m.y, r:m.r, max:m.r+24, life:0.3, col:'#ff9b32'});
  return true;
}

/* ГОЛЕМ КРОВИ: провоцирует только того монстра, которого сам фактически ударил.
   Бросок один на основной удар; добавочные когти, вихрь и взрывы его не дублируют.
   Успешная цель держит агро, пока ударивший Голем крови остаётся жив в свите. */
function rollBloodGolemTaunt(e, m){
  if (!e || e.dead || !m || m.kind !== 'golemB' || m.hp <= 0 || G.minions.indexOf(m) < 0)
    return false;
  if (Math.random() >= 0.50) return false;
  e.tauntMinion = m;
  statusText(e, 'ПРОВОКАЦИЯ', '#d4506a');
  G.fx.push({t:'ring', x:m.x, y:m.y, r:m.r, max:m.r+24, life:0.3, col:'#d4506a'});
  return true;
}

/* ПОЛЕ КОСТЕЙ: условный процент считается от позиции хозяина, а не каждого
   приспешника. Так весь отряд получает один понятный бонус, совпадающий с HUD.
   Труп на самой границе радиуса учитывается; девять трупов дают потолок +45%. */
function nearbyBoneFieldCorpseCount(from=G && G.player){
  if (!G || !from || !G.corpses) return 0;
  let n=0;
  for (const c of G.corpses) if (dist(c,from)<=400 && ++n>=9) return 9;
  return n;
}
function boneFieldDamageInc(from=G && G.player){
  return D && D.boneField>0 ? Math.min(45,D.boneField*nearbyBoneFieldCorpseCount(from)) : 0;
}
function boneFieldDamageMul(from=G && G.player){ return 1+boneFieldDamageInc(from)/100; }

function queueAttackEcho(e, src){
  const echoSrc=Object.assign({},src,{
    direct:true, noEcho:true, noDouble:true,
    primaryBasicHit:false,
    echoMul:(src.echoMul===undefined?1:src.echoMul)*0.30,
    // Эхо срабатывает позже и обязано заново прочитать актуальную свиту/трупы.
    minionSealPackPct:undefined,minionBoneFieldInc:undefined,minionNearbyCount:undefined,
    damageBossShardInc:undefined,damageDuelActive:undefined,damageNearbyCount:undefined,
  });
  G.attackEchoes.push({fireAt:G.time+0.18,target:e,src:echoSrc});
}

function hunterMarkActive(e){
  return !!(D.hunterMark && e && !e.dead && e.hp>0 && (e.hunterMarkUntil||0)>G.time);
}
function markHunterTarget(e){
  if (!D.hunterMark || !e || e.dead || e.hp<=0) return false;
  if (!hunterMarkActive(e)){
    let activeN=0,oldest=null,oldestUntil=Infinity;
    for (const x of G.enemies) if (x!==e && hunterMarkActive(x)){
      activeN++;
      const until=x.hunterMarkUntil||0;
      if (until<oldestUntil){ oldest=x; oldestUntil=until; }
    }
    if (activeN>=HUNTER_MARK_CAP && oldest) oldest.hunterMarkUntil=0;
  }
  e.hunterMarkUntil=G.time+HUNTER_MARK_DURATION;
  statusText(e,tr('МЕТКА'),'#ff3b4f');
  return true;
}

function sealHuntMultiplier(e,src){
  if (!amu('sealHunt') || !src || !src.direct || src.itemDamage) return 1;
  const p=G.player, active=p.huntTarget && p.huntTarget.hp>0 && !p.huntTarget.dead && p.huntUntil>G.time;
  if (e.kind!=='norm' && (!active || p.huntTarget!==e)){
    p.huntTarget=e; p.huntUntil=G.time+8; p.huntN=0;
    statusText(e,tr('Печать Охоты'),'#d6a84f');
    return 1;
  }
  if (!active || p.huntTarget!==e) return 1;
  p.huntN=(p.huntN||0)+1;
  if (p.huntN%5!==0) return 1;
  statusText(e,'x5','#d6a84f');
  return 1.25;
}

function elementalAilmentChanceCount(){
  return [D.igniteCh,D.chillCh,D.shockCh,D.poiCh].reduce((n,v)=>n+(v>0?1:0),0);
}

const TIME_DEBT_STEP=6, TIME_DEBT_CAP=60, TIME_DEBT_TIME=5;
const TIME_DEBT_COOL_THRESHOLD=40, TIME_DEBT_COOL_TIME=5;
/* ДОЛГ ВРЕМЕНИ считает именно фактически прошедшие прямые атакующие удары.
   Поэтому удар свиты подходит, а DoT, взрыв и отражение — нет. Каждая цель
   многозарядной или круговой атаки проходит через damage() отдельно. */
function triggerTimeDebt(src, dealt){
  if (!D.timeDebt || !src || !src.direct || !(dealt>0)) return false;
  const p=G.player;
  if (p.timeDebtCoolingT>0) return false;
  p.timeDebtPct=Math.min(TIME_DEBT_CAP,(p.timeDebtPct||0)+TIME_DEBT_STEP);
  p.timeDebtT=TIME_DEBT_TIME;
  if (p.timeDebtPct>=TIME_DEBT_COOL_THRESHOLD){
    p.timeDebtCoolingT=TIME_DEBT_COOL_TIME;
    p.dashN=0;
    p.dashCd=D.dashCd;
  }
  recalc();
  return true;
}

/* ПОСЛЕДНИЙ СВИДЕТЕЛЬ проверяет круг вокруг героя, а не вокруг цели или
   источника удара. Свита исключена прямо здесь: её позиция и количество не
   должны превращать заявленный бонус героя в скрытое наследование. */
function isLastWitnessTarget(e, src){
  if (!D.lastWitness || !e || e.dead || e.hp<=0 || (src && src.minion)) return false;
  let only=null;
  for (const x of G.enemies){
    if (x.dead || x.hp<=0 || dist(x,G.player)>350) continue;
    if (only) return false;
    only=x;
  }
  return only===e;
}

/* ЭЛЕМЕНТАЛЬНАЯ ПЕРЕГРУЗКА считает только четыре эффекта из условия карты.
   Взрыв берёт уже снятый с основной цели HP, поэтому исходящие множители и её
   защита не применяются повторно; каждый сосед проходит свою защиту отдельно. */
function consumeElementalOverload(e, dealt, minionShare=0){
  if (!D.elementalOverload || !e || !(dealt>0)) return false;
  const fire=enemyBurning(e), chill=e.ail.chill>0;
  const poison=e.dots.poison.dps>0, shock=e.ail.shock>0;
  if ((fire?1:0)+(chill?1:0)+(poison?1:0)+(shock?1:0)<3) return false;
  if (fire) Object.assign(e.dots.fire,{dps:0,minionDps:0,n:0});
  if (poison) Object.assign(e.dots.poison,{dps:0,minionDps:0,n:0});
  if (chill){ e.ail.chill=0; e.ail.freeze=0; }
  if (shock) e.ail.shock=0;
  statusText(e,tr('Элементальная перегрузка').toUpperCase(),'#c08cff');
  nova(e.x,e.y,200,dealt*0.80,'#a974ff',{
    minionShare,mitigate:true,exclude:e,skipDead:true,skipConstellation:true,
  });
  return true;
}

function damage(e, src){
  const b = G.bag, p = G.player;
  const noProcs=!!src.noProcs;
  e = packRedirect(e);            // авангард может принять удар на себя вместо своего
  if (!noProcs && src.hunterMarkShot) markHunterTarget(e);
  const hunterMarked=!src.minion && G.weapon.id==='wpn.bow' && hunterMarkActive(e);
  // Один массовый удар свиты использует один снимок этих трёх условий. Между
  // его целями состав свиты, трупы и позиции не меняются, поэтому повторный
  // обход массивов давал ту же цифру, но стоил O(цели × бойцы/трупы/враги).
  const minionBoneFieldInc=src.minion
    ? (src.minionBoneFieldInc===undefined?boneFieldDamageInc():src.minionBoneFieldInc) : 0;
  const minionSealPackPct=src.minion
    ? (src.minionSealPackPct===undefined?sealPackDamagePct():src.minionSealPackPct) : 0;
  const damageConditions=src.damageBossShardInc!==undefined&&src.damageDuelActive!==undefined&&
    src.damageNearbyCount!==undefined ? src : damageConditionSnapshot(src.minion||p);
  let perfectRhythmCrit=false;
  if (!noProcs && src.direct && D.perfectRhythm){
    const counter=src.minion?'perfectRhythmMinionN':'perfectRhythmHeroN';
    p[counter]=(p[counter]||0)+1;
    perfectRhythmCrit=p[counter]%7===0;
  }
  if (!noProcs && src.direct && D.attackEcho && !src.noEcho){
    p.attackEchoN=(p.attackEchoN||0)+1;
    if (p.attackEchoN%4===0) queueAttackEcho(e,src);
  }
  let base = rnd(D.baseMin, D.baseMax) * (src.mul || 1);
  if (b.has('lucky')) base = Math.max(base, rnd(D.baseMin, D.baseMax) * (src.mul||1));

  const el = D.elem;
  // ОБЕРЕГ: одна стихия срезается на 60% до всех умножений — то есть бьёт
  // ровно по флэту, который в этой системе и есть главный источник урона стихией
  const wd = e.ward ? 0.4 : 1;
  let total = (base
    + el.fire * (e.ward==='fire'?wd:1) + el.cold * (e.ward==='cold'?wd:1)
    + el.lit  * (e.ward==='lit' ?wd:1) + el.poi  * (e.ward==='poi' ?wd:1));
  // attackMul масштабирует всю автоатаку целиком, включая плоские стихии.
  // Обычный mul исторически относится только к базе и оставлен для других эффектов.
  if (src.attackMul !== undefined) total *= src.attackMul;
  if (src.echoMul !== undefined) total *= src.echoMul;
  let woundInc=0;
  if (!noProcs && src.directMelee && D.openWound > 0){
    const active=(e.openWoundUntil||0)>G.time;
    e.openWoundStacks=active?Math.min(5,(e.openWoundStacks||0)+1):0;
    e.openWoundUntil=G.time+1;
    woundInc=e.openWoundStacks*D.openWound;
  }
  const confinementPct=src.confinementPct===undefined?confinementDamagePct():src.confinementPct;
  total *= (1 + (D.incAll + conditionalInc(e, src, damageConditions) + confinementPct + (!src.minion?ledgerStacks()*3:0) +
    (src.warriorMelee ? D.warriorMeleeInc : 0) + woundInc +
    (hunterMarked ? HUNTER_MARK_DAMAGE_INC : 0) +
    (src.rangedInc||0) + minionBoneFieldInc)/100) * D.moreAll;
  if (src.warriorMelee) total*=D.warriorMeleeMore||1;
  if (isLastWitnessTarget(e,src)) total*=1.35;
  if (!noProcs) total*=sealHuntMultiplier(e,src);
  if (src.minion) total *= MINION_DAMAGE_MULT*(1+minionSealPackPct/100); // режет удар и затем даёт бонус разных типов стаи
  const copperHit=!!(!noProcs && amu('copperChronometer') && p.copperReady && src.primaryBasicHit && src.copperCharged && !src.minion);
  if (copperHit) total*=1.25;
  const firstTraceHit=!!(!noProcs && amu('firstTraceRing') && src.direct && src.weaponAttack && !src.minion &&
    !e.firstTraceSpent && e.hp>=e.maxHp-1e-9);
  if (firstTraceHit) total*=1.10;

  // Крит: один бросок базового шанса, сверхкрит сверху.
  // У свиты свой шанс (D.minCrit), в который уже вложена доля наследования
  const massDirect=!noProcs && D.criticalMass && !D.noCrit && src.direct;
  const critCh = noProcs?0:Math.min(100,(src.minion ? D.minCrit : D.critCh)+(massDirect?(p.criticalMass||0):0));
  const reactionCrit=!!(!noProcs && amu('reactionRing') && !D.noCrit && src.direct && !src.minion && !src.itemDamage &&
    (p.reactionCritUntil||0)>G.time);
  let isCrit = false;
  if (critCh > 0) isCrit = Math.random()*100 < critCh;
  // КРИТИЧЕСКИЙ ПРИЦЕЛ и ЦЕПЬ КРИТОВ добавляют шанс поверх собранного
  let critBonus = 0;
  if (!noProcs && amu('critaim') && p.stillT > 1) critBonus += 25;
  if (!noProcs && amu('critchain')) critBonus += 10 * (p.critChain || 0);
  if (critBonus && !isCrit) isCrit = Math.random()*100 < critBonus;
  if (perfectRhythmCrit){ isCrit=true; statusText(e,'x7','#c08cff'); }
  if (reactionCrit){ isCrit=true; statusText(e,tr('Кольцо Реакции'),'#d7cf78'); }
  // ТРИЕДИНСТВО: три стихии на одной цели — крит без броска
  if (!noProcs && amu('trinity') && enemyBurning(e) && e.ail.chill > 0 && e.dots.poison.dps > 0){
    isCrit = true; statusText(e, 'ТРИАДА', '#c08cff');
  }
  // Счётчик ударов один на всех: три предмета считают «каждый N-й», и если бы
  // каждый вёл свой счёт, их периоды зависели бы от того, в каком порядке найдены
  if (!noProcs) p.hitN = (p.hitN || 0) + 1;
  if (!noProcs && amu('bone') && p.hitN % 20 === 0){ isCrit = true; statusText(e, 'x20', '#ffd24a'); }
  if (massDirect) p.criticalMass=isCrit?0:(p.criticalMass||0)+1;
  if (isCrit){
    G.stats.crits++;
    total *= D.critMul/100;
    if (Math.random()*100 < D.superCh){                          // СВЕРХКРИТ
      total *= 2;
      addBleed(e, total*0.03*D.ailEff, src.minion ? 1 : 0);      // 3% от удара в секунду, стакается
      burst(e.x, e.y, 8, '#e0405a', 200, 3, 0.5);
    }
    if (D.onCrit && G.time >= (p.onCritHealReadyAt||0)){
      heal(D.onCrit);
      p.onCritHealReadyAt=G.time+1;
    }
    // КРИТИЧЕСКАЯ МАССА
    if (amu('critmass')) nova(e.x, e.y, 55*D.aoeR, total*0.5, '#ff9a2f', {minionShare:src.minion?1:0});
    if (amu('critchain')) p.critChain = Math.min(3, (p.critChain||0) + 1);
  } else if (!noProcs && amu('critchain')) p.critChain = 0;   // цепь рвётся на первом же некрите
  // Процентная добавка берётся от текущего HP перед этим попаданием. Общий
  // ранг уже ограничен 10% в recalc(), включая старые переполненные сохранения.
  if (D.pctHp) total += e.hp * D.pctHp/100;
  // Одинаковые +% входящего урона от стихийных статусов складываются, после чего
  // общая damage-taken корзина применяется один раз. Сильные уникальные условия
  // ниже (Палач, Контрудар, Дуэль) остаются самостоятельными множителями.
  const statusTakenInc=(e.ail.shock>0?SHOCK_TAKEN_INC:0)
    +(e.ail.chill>0?CHILL_TAKEN_INC:0)+(e.ail.freeze>0?FREEZE_TAKEN_INC:0);
  if(statusTakenInc) total*=1+statusTakenInc;
  // РУКА ПАЛАЧА: множитель поверх формулы, иначе удвоение растворилось бы
  if (amu('headsman') && e.hp/e.maxHp < 0.15) total *= 2;
  // КОНТРУДАР: заряд тратится на первый же удар игрока, свите не достаётся
  if (!noProcs && amu('riposte') && p.riposte && !src.minion){
    p.riposte = false; total *= 2.5;
    statusText(e, 'КОНТРУДАР', '#e0405a');
  }
  // КОЛЬЦО ДУЭЛИ: множитель именно more — он идёт поверх всей формулы,
  // иначе «x1.75» растворилось бы среди сотен процентов у собранного билда
  if (damageConditions.damageDuelActive) total *= 1.75;
  // Броня и панцирь: единый путь снижения для игрока и свиты
  const armorIgnore=amu('smithThumbstall') && src.weaponAttack && !src.minion ? 20 : 0;
  total = mitigate(e, total, src.minion ? 1 : 0, false, armorIgnore);
  // КОЛЬЦО СМЕРТИ: заряд копится убийствами и тратится на первую же цель
  if (!noProcs && amu('reaper') && p.reaper){
    p.reaper = false;
    statusText(e, 'СМЕРТЬ', '#9aa7b4');
    G.fx.push({t:'ring', x:e.x, y:e.y, r:e.r, max:e.r*3.4, life:0.45, col:'#9aa7b4'});
    total += e.hp;
  }

  let dealt = applyDamage(e, total, isCrit, false, src.minion ? 1 : 0, false,
    {bloodSource:src.minion||src,bloodKind:'hit'});
  if (noProcs) return dealt;
  if (dealt>0 && copperHit){
    p.copperReady=false;
    statusText(e,tr('Медный Хронометр'),'#c99052');
  }
  if (dealt>0 && firstTraceHit) e.firstTraceSpent=true;
  if (dealt>0 && reactionCrit) p.reactionCritUntil=0;
  if (dealt>0 && src.direct && src.heroDirect && !src.minion && !src.itemDamage && amu('tallyGloves')){
    p.tallyN=(p.tallyN||0)+1;
    if (p.tallyN%12===0){
      p.tallyT=1.5;
      recalc();
      statusText(e,tr('Перчатки Счёта'),'#b9a46d');
    }
  }
  triggerTimeDebt(src,dealt);
  if (src.direct) consumeElementalOverload(e,dealt,src.minion?1:0);
  /* Ударная волна берёт ровно 20% фактически снятого критом HP: переполнение
     урона не раздувает её. Основная цель исключается, а каждый сосед повторно
     проходит свою входящую защиту. Исходящие множители не накладываются второй
     раз, потому что они уже учтены в dealt. */
  if (isCrit && b.has('critWave') && dealt > 0)
    nova(e.x, e.y, 90*D.aoeR, dealt*0.20, '#ffb340', {
      minionShare:src.minion?1:0, mitigate:true, exclude:e, skipConstellation:true,
    });
  if (src.minion && !e.dead) rollBoneChallenge(e, src.minion);

  /* СМЕРТОНОСНОЕ ПОПАДАНИЕ: бросок делает каждый фактический удар damage().
     Процент считается после обычного урона от оставшегося HP и идёт напрямую,
     без брони и повторного запуска эффектов. applyDamage() напрямую не бросает шанс,
     поэтому DoT, лужи и чума его не размножают. */
  if (D.deadlyHit && e.hp > 0 && Math.random() < 0.01){
    const deadly = applyDamage(e, e.hp*0.25, false, false, src.minion ? 1 : 0);
    dealt += deadly;
    statusText(e, 'DEADLY HIT', '#e0405a');
    G.fx.push({t:'ring', x:e.x, y:e.y, r:e.r, max:e.r*2.8, life:0.35, col:'#e0405a'});
  }

  // Вампиризм и здоровье за попадание
  if (D.leech && !src.minion){                                   // обычный вампиризм — только от атак героя
    const lv = dealt * D.leech/100;
    if (D.dread) queueDreadLeech(lv);
    else if (D.leechInstant) heal(lv);
    else p.leechPool = (p.leechPool||0) + lv;
  }
  if (D.berserkerHitHeal && dealt>0 && src.direct && src.heroDirect && !src.minion && !src.itemDamage)
    heal(D.berserkerHitHeal);
  if (D.onHit) heal(D.onHit);
  applyBookAilments(e, total,
    (src.minion ? MINION_AILMENT_CHANCE_MULT : 1) * (hunterMarked?2:1),
    src.minion ? MINION_DAMAGE_MULT*(1+minionBoneFieldInc/100) : 1,
    src.minion ? 1 : 0);

  // Наложение негативных эффектов
  const ailmentChanceMul = (src.minion ? MINION_AILMENT_CHANCE_MULT : 1) * (src.elementChanceMul||1) * (hunterMarked?2:1);
  const roll = v => Math.random()*100 < v * ailmentChanceMul;
  if (roll(D.igniteCh)){
    addDot(e, 'fire', total*IGNITE_DPS_SHARE*D.ailEff, 3*D.ailDur, src.minion ? 1 : 0);
    // ПЕРЕГРУЗКА: огонь по шокированному замыкает разряд
    if (amu('overload') && e.ail.shock > 0){
      shockBurst(e, total, src.minion ? 1 : 0);
      G.fx.push({t:'ring', x:e.x, y:e.y, r:6, max:120*D.aoeR, life:0.3, col:'#ffe14a'});
    }
  }
  if (roll(D.chillCh)){
    if (e.ail.chill <= 0) statusText(e, 'SLOWED', '#ffe14a');
    e.ail.chill = Math.max(e.ail.chill, CHILL_DURATION*D.ailDur);
    // Охлаждение наносит отдельные 10% уже рассчитанного удара; это эффект,
    // поэтому «Сила всех негативных эффектов» продолжает его усиливать.
    applyDamage(e, total*CHILL_DAMAGE_SHARE*D.ailEff, false, false, src.minion ? 1 : 0);
    if (D.freeze && Math.random() < FREEZE_CHANCE){                       // ЗАМОРОЗКА
      if (e.ail.freeze <= 0) statusText(e, 'FROZEN', '#7fd6ff');
      e.ail.freeze = Math.max(e.ail.freeze, FREEZE_DURATION*D.ailDur*D.freezeDur);
    }
  }
  if (roll(D.shockCh)){
    e.ail.shock = Math.max(e.ail.shock, SHOCK_DURATION*D.ailDur);
    shockBurst(e, total, src.minion ? 1 : 0); // базовый разряд 5×15%, ТЕСЛА 20×25%
  }
  if (roll(D.poiCh))                                                      // РАДИАЦИЯ: двойной урон тика
    addDot(e, 'poison', total*POISON_DPS_SHARE*D.ailEff*(D.radiation?2:1), 4*D.ailDur, src.minion ? 1 : 0);
  if (roll(D.stun)) e.ail.stun = STUN_DURATION * D.ailDur;
  // ТАРАННАЯ ПЕРЧАТКА: свой толчок мимо шанса отбрасывания, каждый восьмой удар
  if (amu('shove') && p.hitN % 8 === 0){
    const from = src.minion || p;
    const a = Math.atan2(e.y-from.y, e.x-from.x);
    e.kb.x += Math.cos(a)*780; e.kb.y += Math.sin(a)*780;
    burst(e.x, e.y, 6, '#c08a3a', 220, 3, 0.4);
  }
  if (roll(D.knock)){
    const from = src.minion || p;               // толкает тот, кто ударил
    const a = Math.atan2(e.y-from.y, e.x-from.x);
    const force = 260 * D.knockPow * knockbackScale(e);
    e.kb.x += Math.cos(a)*force; e.kb.y += Math.sin(a)*force;
    if (D.dizzy){                                                         // ГОЛОВОКРУЖЕНИЕ
      if (e.ail.dizzy <= 0) statusText(e, 'SLOWED', '#ffe14a');
      e.ail.dizzy = 2*D.ailDur;
    }
  }
  if (dealt>0 && e.hp>0){
    triggerSurgeonsHand(e,src,dealt);
    extendClosestDamagingStatus(e,src,dealt);
  }
  // ДОБИВАНИЕ: один фиолетовый флаг, фиксированный включительный порог 10%.
  if (b.has('execute') && e.kind==='norm' && e.hp > 0 && e.hp/e.maxHp <= EXECUTE_HP_THRESHOLD)
    applyDamage(e, e.hp, false, false, src.minion ? 1 : 0);
  // ПЕРЧАТКИ ГРОМА: свой период, но общий счётчик ударов
  if (amu('thunder') && p.hitN % 12 === 0){
    e.ail.shock = Math.max(e.ail.shock, SHOCK_DURATION*D.ailDur);
    shockBurst(e, total, src.minion ? 1 : 0);
    G.fx.push({t:'bolt', x:p.x, y:p.y, x2:e.x, y2:e.y, life:0.18, col:'#ffe14a'});
  }
  // КОЛЬЦО ИМПУЛЬСА
  if (amu('pulse') && p.hitN % 8 === 0)
    nova(e.x, e.y, 130*D.aoeR, avgHit()*0.9, '#4fd1c5', {minionShare:src.minion?1:0});
  // Двойное попадание
  if (!src.noDouble){
    // Метку приспешника обязательно тащим в добавочные удары: иначе двойной
    // удар свиты считался бы по криту игрока и лечил бы не того
    if (Math.random()*100 < D.dblHit){
      // Для доли полной автоатаки 60% режут тот же полный удар, а не только базу.
      const again = src.attackMul === undefined
        ? {mul:(src.mul||1)*0.6}
        : {mul:src.mul, attackMul:src.attackMul*0.6};
      // Второй удар — 60% того же попадания, поэтому сохраняет уже вычисленные
      // условные бонусы стрелы и её множитель стихийных шансов. Без этих полей
      // дальняя/первая стрела усиливала только основную часть двойного попадания.
      damage(e, Object.assign(again,{noDouble:true, minion:src.minion,
        direct:src.direct, directMelee:src.directMelee, warriorMelee:src.warriorMelee, rangedInc:src.rangedInc,
        elementChanceMul:src.elementChanceMul, weaponAttack:src.weaponAttack,
        primaryBasicHit:false, itemDamage:src.itemDamage,
        minionSealPackPct:src.minionSealPackPct,minionBoneFieldInc:src.minionBoneFieldInc,
        minionNearbyCount:src.minionNearbyCount,
        damageBossShardInc:damageConditions.damageBossShardInc,
        damageDuelActive:damageConditions.damageDuelActive,
        damageNearbyCount:damageConditions.damageNearbyCount}));
    }
  }
  return dealt;
}

function grantReserveBarrier(overkill){
  if (!D.durabilityReserve || overkill<=0) return 0;
  const p=G.player, before=p.reserveBarrier||0, cap=D.life*0.12;
  p.reserveBarrier=Math.min(cap,before+overkill*0.20);
  p.reserveBarrierT=4;
  if (p.reserveBarrier>before){
    G.fx.push({t:'ring',x:p.x,y:p.y,r:p.r+7,max:p.r+24,life:0.3,col:'#6fb3ff'});
    G.fx.push({t:'txt',x:p.x,y:p.y-30,s:'ЗАПАС ПРОЧНОСТИ',life:0.8,col:'#6fb3ff'});
  }
  return p.reserveBarrier-before;
}

function applyDamage(e, amount, crit, silent, minionShare=0, skipConstellation=false, opt=null){
  /* Созвездие — отдельный множитель по типу цели. Так заявленные +5% остаются
     настоящими пятью процентами даже у билда, уже собравшего сотни inc-процентов.
     Точка общая для ударов, стихий, DoT и свиты, поэтому бонус ничего не обходит. */
  if (!skipConstellation) amount *= constellationMultiplier(e);
  const hpBefore=e.hp;
  if (D.durabilityReserve && e.hp>0 && amount>e.hp) grantReserveBarrier(amount-e.hp);
  const dealt = Math.max(0, Math.min(amount, e.hp));
  G.stats.damage += dealt;
  G.stats.maxHit = Math.max(G.stats.maxHit, dealt);
  e.hp -= amount;
  if (dealt>0) maybeStampHealthBloodPuddle(e,hpBefore,e.hp);
  if (dealt>0) emitBloodHit(e,dealt,{
    source:opt&&opt.bloodSource,
    crit:!!crit,
    killed:hpBefore>0 && amount>=hpBefore,
    dot:!!silent || !!(opt&&opt.bloodKind==='dot'),
  });
  if (dealt > 0 && !silent){ e.hit = 0.12; playHitSound(e); }
  e.noDmgT = 0;                   // регенераторы считают время с последнего попадания
  if (dealt>0 && hpBefore>0 && amount>=hpBefore){
    e.lastKillingDamage=dealt;
    e.lastKillingMinionShare=minionShare;
    e.lastKillNoMoth=!!(opt&&opt.noMothFang);
    e.lastKillNoItems=!!(opt&&opt.noItemTriggers);
  }
  if (minionShare > 0 && D.deathLord) heal(dealt * minionShare * 0.001);
  if (!silent){
    pushDamageNumber(e,amount,crit);
    burst(e.x, e.y, crit ? 9 : 3, crit ? '#ffd24a' : e.t.col, crit ? 220 : 110, 3, 0.35);
  }
  return dealt;
}

/* Одна проверка на случайную находку, затем выбор категории. До нерфа база
   была 0,4% с рядового, ×5 с элиты и ×40 с босса. Теперь общий шанс умножен
   на FIND_RATE_SCALE, составленный из отдельных нерфов трёх категорий. */
function tryDropBook(e){
  const mult = e.kind === 'boss' ? 40 : e.kind === 'elite' ? 5 : 1;
  const pools = findDropPools(), balance = findDropBalance(pools,e);
  // Нерф применяется и к «Искателю реликвий», иначе на высоком ранге предметы
  // стали бы выпадать даже чаще прежнего из-за изменившихся долей категорий.
  const chance = Math.min(100, (0.4 * mult + shopLvl('itemDrop')) * balance.rate);
  if (Math.random()*100 >= chance) return;
  dropItem(e, pools, balance);
}

function findDropPools(){
  const pool = [];
  for (const k of AMU_KEYS){
    if (G.amu[k]) continue;
    if (AMULETS[k].minOnly && !G.weapon.minions) continue;
    if (AMULETS[k].warriorOnly && G.weapon.id !== 'wpn.sword') continue;
    if (AMULETS[k].archerOnly && G.weapon.id !== 'wpn.bow') continue;
    if (AMULETS[k].mageOnly && G.weapon.id !== 'wpn.wand') continue;
    if (AMULETS[k].needChill && !(D.chillCh>0 || (G.items && G.items.cold))) continue;
    if (AMULETS[k].needIgnite && !(D.igniteCh>0 || (G.items && G.items.fire))) continue;
    if (AMULETS[k].needShock && !(D.shockCh>0 || (G.items && G.items.shock))) continue;
    if (AMULETS[k].needDodge && !(D.dodge>0)) continue;
    const w = [16, 10, 5, 2][AMULETS[k].rar];
    for (let i = 0; i < w; i++) pool.push(k);
  }
  const tot = TOTEM_KEYS.filter(k => totemTier(k) < 4 && G.items && G.items[TOTEMS[k].book]);
  return {pool, tot};
}

/* Сначала воспроизводим старый fallback отсутствующих категорий, затем режем
   фактическую долю каждой оставшейся категории. Поэтому после сбора всех
   предметов их бывшая доля не превращается в лишние книги или тотемы. */
function findDropBalance(pools,source=null){
  const hasItems = pools.pool.length > 0, hasTotems = pools.tot.length > 0;
  const itemBase = hasItems ? AMU_SHARE : 0;
  const totemBase = hasTotems ? TOTEM_SHARE + (hasItems ? 0 : AMU_SHARE) : 0;
  const bookBase = 1 - itemBase - totemBase;
  const major=source && (source.kind==='elite'||source.kind==='boss');
  const archiveMul=amu('archivist')?0.50:1;
  const itemWeight = itemBase * ITEM_DROP_SCALE * (amu('invertedCrown')&&major?1.40:1);
  const totemWeight = totemBase * TOTEM_DROP_SCALE * archiveMul;
  const bookWeight = bookBase * BOOK_DROP_SCALE * archiveMul;
  const rate = itemWeight + totemWeight + bookWeight;
  return {rate, itemShare:itemWeight/rate, totemShare:totemWeight/rate};
}

/* Выбор категории находки. Отдельной функцией, потому что «Маска босса»
   вызывает её мимо ролла на шанс. */
function upgradeInvertedCrownDrop(key,pool,roll=Math.random()){
  if (!amu('invertedCrown') || AMULETS[key].rar>=3 || roll>=0.20) return key;
  const next=[...new Set(pool)].filter(k=>AMULETS[k].rar===AMULETS[key].rar+1);
  return next.length?pick(next):key;
}

function dropItem(e, preparedPools, preparedBalance){
  const pools = preparedPools || findDropPools();
  const balance = preparedBalance || findDropBalance(pools,e);
  const pool = pools.pool, tot = pools.tot;
  const r = Math.random();
  if (pool.length && r < balance.itemShare){
    const base=pick(pool);
    G.orbs.push({x:e.x, y:e.y, r:9, amu:upgradeInvertedCrownDrop(base,pool)});
  }
  else if (tot.length && r < balance.itemShare + balance.totemShare)
    G.orbs.push({x:e.x, y:e.y, r:9, totem:pick(tot)});
  else
    G.orbs.push({x:e.x, y:e.y, r:9, book:pick(BOOK_KEYS)});
  playLootDrop();
}

function takeTotem(key, silent=false){
  const T = TOTEMS[key];
  const tier = Math.min(4, totemTier(key) + 1);
  const prev = totemVal(key);
  G.totems[key] = tier;
  recalc();
  const p = G.player;
  G.fx.push({t:'ring', x:p.x, y:p.y, r:10, max:150, life:0.6, col:T.col});
  burst(p.x, p.y, 40, T.col, 280, 4, 1.0);
  renderSheet();
  // Первый тотем объясняем окном, дальнейшие ранги — надписью без паузы:
  // ровно как с книгами, чтобы подъём не рвал темп боя.
  if (silent) return;
  if (tier === 1) showTotemModal(key, prev);
  else pickupBanner(totemSpriteHTML(key,tier,'banner') + TOTEM_RANKS[tier-1] + ' ' + T.nm,
    '+' + TOTEM_VALS[tier-1] + '% урона по ' + T.st + '  ·  было +' + prev + '%', T.col);
}

/* Все полноэкранные окна ручной находки используют одну и ту же точку выхода.
   Это важно, когда находка и level-up пришли в одном кадре: сначала снимается
   пауза находки, и только затем ожидающая карточка получает #ov. */
function closePickupModal(){
  hideSkillTip();
  G.paused = false;
  $('#ov').style.display = 'none'; $('#ov').innerHTML = '';
  last = performance.now();
  if (G.pending) showLevelUp();
}

function showTotemModal(key, prev){
  const T = TOTEMS[key], tier = totemTier(key);
  hideSkillTip();
  G.paused = true;
  const owned = TOTEM_KEYS.filter(k => totemTier(k) && k !== key);
  $('#ov').style.display = 'flex';
  $('#ov').innerHTML =
    pickupRevealHTML(totemSpriteHTML(key,tier,'modal'), T.col) +
    '<h1 style="color:' + T.col + ';letter-spacing:4px">' + TOTEM_RANKS[tier-1] + ' ' + T.nm + '</h1>' +
    '<h2>тотем · ранг ' + tier + ' из 4 · растёт от каждой следующей находки</h2>' +
    '<div style="max-width:640px;text-align:center;font-size:18.8px;line-height:1.6">' +
      'Весь ваш урон по ' + T.st + ' целям увеличен на <b style="color:' + T.col + '">+' +
      TOTEM_VALS[tier-1] + '%</b>. Действует и на удары свиты.<br>' +
      'Ранги: ' + TOTEM_VALS.map((v,i) => TOTEM_RANKS[i].toLowerCase() + ' +' + v + '%').join(' · ') +
    '</div>' +
    (owned.length ?
      '<div id="amuown"><div class="k" style="font-size:15px;letter-spacing:2px;margin-bottom:6px">ДРУГИЕ ТОТЕМЫ</div>' +
        '<div id="amulist">' + owned.map(k =>
          '<div class="pick" style="border-left:2px solid ' + TOTEMS[k].col + ';padding-left:7px">' +
          totemSpriteHTML(k,totemTier(k),'tiny') + TOTEM_RANKS[totemTier(k)-1] + ' ' + TOTEMS[k].nm +
          ' · +' + totemVal(k) + '%</div>').join('') + '</div></div>' : '') +
    '<button id="amok">ПРОДОЛЖИТЬ</button>';
  $('#amok').onclick = closePickupModal;
}

function takeAmulet(key, silent=false){
  const isNew=!G.amu[key];
  G.amu[key] = true;
  if (isNew && key==='invertedCrown') for (const e of G.enemies){
    const ratio=e.maxHp>0?Math.max(0,e.hp/e.maxHp):0;
    e.maxHp*=1.15; e.hp=e.maxHp*ratio;
  }
  if (isNew && key!=='ledgerDebts' && amu('ledgerDebts') && ledgerStacks()<20){
    const p=G.player, old=ledgerStacks();
    p.ledgerStacks=old+1;
    const hpMul=(1+p.ledgerStacks*0.02)/(1+old*0.02);
    for (const e of G.enemies){
      const ratio=e.maxHp>0?Math.max(0,e.hp/e.maxHp):0;
      e.maxHp*=hpMul; e.hp=e.maxHp*ratio;
    }
  }
  recalc();
  const A = AMULETS[key], p = G.player;
  G.fx.push({t:'ring', x:p.x, y:p.y, r:10, max:180, life:0.7, col:A.col});
  burst(p.x, p.y, 60, A.col, 320, 5, 1.2);
  renderSheet();
  if (!silent) showAmuletModal(key);
}

function showAmuletModal(key){
  const A = AMULETS[key];
  const rarNm = ['ОБЫЧНЫЙ','РЕДКИЙ','ЭПИЧЕСКИЙ','ЛЕГЕНДАРНЫЙ'][A.rar];
  hideSkillTip();
  G.paused = true;                                   // находка разовая, пауза обязательна
  const owned = AMU_KEYS.filter(k => G.amu[k] && k !== key);
  $('#ov').style.display = 'flex';
  $('#ov').innerHTML =
    pickupRevealHTML(rareItemSpriteHTML(key,'modal'), A.col, true) +
    '<h1 style="color:' + A.col + ';letter-spacing:4px">' + A.nm + '</h1>' +
    '<h2>' + SLOTS[A.slot].toLowerCase() + ' · ' + rarNm + ' · находится один раз за партию</h2>' +
    '<div style="max-width:640px;text-align:center;font-size:18.8px;line-height:1.6">' + A.nt + '</div>' +
    (owned.length ?
      '<div id="amuown">' +
        '<div class="k" style="font-size:15px;letter-spacing:2px;margin-bottom:6px">' +
          'УЖЕ НАДЕТО · ' + owned.length + ' из ' + (AMU_KEYS.length-1) +
          (owned.length > 6 ? '<span style="color:#4a5561;letter-spacing:0"> · список прокручивается</span>' : '') +
        '</div>' +
        '<div id="amulist" class="' + (owned.length > 6 ? 'two' : '') + '">' +
          owned.map(k => '<div class="pick" style="border-left:2px solid ' + AMULETS[k].col +
            ';padding-left:7px">' + rareItemSpriteHTML(k,'tiny') + AMULETS[k].nm + '</div>').join('') +
        '</div>' +
      '</div>' : '') +
    '<button id="amok">ПРОДОЛЖИТЬ</button>';
  $('#amok').onclick = closePickupModal;
}

function takeBook(key, silent=false){
  const B = BOOKS[key], first = !G.items[key], prev = first ? 0 : G.items[key].val;
  let cur=G.items[key]||null, tier=cur?cur.tier:0, val=cur?cur.val:0;
  const advances=amu('archivist')?2:1;
  for(let step=0;step<advances;step++){
    tier++;
    if (tier <= B.tiers.length){                    // первые тиры берутся из таблицы
      const [lo, hi] = B.tiers[tier-1];
      const rolled=lo===hi?lo:Math.round(rnd(lo,hi));
      val=cur?Math.max(rolled,val+2):rolled;
    } else val=val+Math.round(rnd(B.step[0],B.step[1]));
    cur={tier,val};
  }
  G.items[key] = {tier, val};
  recalc();
  const p = G.player;
  G.fx.push({t:'ring', x:p.x, y:p.y, r:10, max:160, life:0.6, col:B.col});
  burst(p.x, p.y, 50, B.col, 300, 5, 1.1);
  renderSheet();
  // Первая находка книги — полноценное окно с паузой: игрок должен прочитать,
  // что это вообще такое. Повторные — только объявление, бой не прерывается.
  if (silent) return;
  if (first) showBookModal(key, prev);
  else {
    const unit = (B.pct || key === 'monster' || key === 'xp') ? '%' : '';
    pickupBanner(B.nm + ' ' + tier, '+' + val + unit +
      (prev ? '  ·  было +' + prev + unit : '') +
      (B.proc ? '  ·  срабатывание ' + bookChance(key) + '%' : ''), B.col);
  }
}

/* Сводка по всем книгам — что суммарно даёт коллекция */
function bookTotals(){
  const t = [];
  const bk = k => G.items[k] ? G.items[k].val : 0;
  if (bk('fire'))  t.push(['Флэт-урон огнём',  '+' + bk('fire')  + ' (в бою ' + D.elem.fire.toFixed(1) + ' после процентов)']);
  if (bk('cold'))  t.push(['Флэт-урон холодом','+' + bk('cold')  + ' (в бою ' + D.elem.cold.toFixed(1) + ')']);
  if (bk('shock')) t.push(['Флэт-урон молнией','+' + bk('shock') + ' (в бою ' + D.elem.lit.toFixed(1) + ')']);
  if (bk('poison'))t.push(['Отравление за прок', Math.round(D.bookPoiDps) + ' урона/сек, 3 сек']);
  if (bk('bleed')) t.push(['Кровотечение за прок', Math.round(bookBleedDps()) + ' урона/сек, 4 сек']);
  if (bk('monster'))t.push(['Плотность волн', '+' + bk('monster') + '% врагов']);
  if (bk('xp'))    t.push(['Получаемый опыт', '+' + bk('xp') + '%']);
  return t;
}

function showBookModal(key, prev){
  const B = BOOKS[key], it = G.items[key];
  const unit = (B.pct || key === 'monster' || key === 'xp') ? '%' : '';
  hideSkillTip();
  G.paused = true;                                    // игра замирает: находка важная
  const rows = bookTotals().map(([a,b2]) =>
    '<div class="row" style="font-size:17.5px"><span>' + a + '</span><b>' + b2 + '</b></div>').join('');
  $('#ov').style.display = 'flex';
  $('#ov').innerHTML =
    pickupRevealHTML(lootSpriteHTML(key,'modal'), B.col) +
    '<h1 style="color:' + B.col + ';letter-spacing:4px">' + B.nm + '</h1>' +
    '<h2>тир ' + it.tier + (prev ? ' — повышена с +' + prev + unit : ' — первая находка') + '</h2>' +
    '<div style="max-width:620px;text-align:center;font-size:18.8px;line-height:1.6">' + B.desc.replace(/N/g, it.val + unit) + '</div>' +
    '<div style="display:flex;gap:34px;text-align:center">' +
      '<div><div class="k" style="font-size:15px">СИЛА</div>' +
        '<div style="font-size:37.5px;color:' + B.col + '">+' + it.val + unit + '</div>' +
        (prev ? '<div class="k" style="font-size:15px">было +' + prev + unit + '</div>' : '') + '</div>' +
      (B.proc ? '<div><div class="k" style="font-size:15px">ШАНС СРАБАТЫВАНИЯ</div>' +
        '<div style="font-size:37.5px;color:' + B.col + '">' + bookChance(key) + '%</div>' +
        '<div class="k" style="font-size:15px">' + (bookChance(key) >= 100 ? 'потолок достигнут' : '+10% за следующую') + '</div></div>' : '') +
    '</div>' +
    '<div style="width:min(620px,90vw);border-top:1px solid var(--line);padding-top:14px">' +
      '<div class="k" style="font-size:15px;letter-spacing:2px;margin-bottom:6px">ВСЕ КНИГИ СУММАРНО</div>' + rows + '</div>' +
    '<button id="bkok">ПРОДОЛЖИТЬ</button>';
  $('#bkok').onclick = closePickupModal;
}

function nearestLivingEnemies(from,count){
  return nearestEnemies(from,count,e=>e!==from&&!e.dead&&e.hp>0);
}
function addMothBurn(e,rawTotal,minionShare=0){
  if (!e || e.dead || e.hp<=0 || !(rawTotal>0)) return false;
  if (!e.mothBurns) e.mothBurns=[];
  e.mothBurns.push({rawLeft:rawTotal,rawDps:rawTotal/2,life:2,minionShare});
  statusText(e,tr('Зуб Мотылька'),'#d9c96f');
  G.fx.push({t:'ring',x:e.x,y:e.y,r:e.r,max:e.r+22,life:0.35,col:'#d9c96f'});
  return true;
}
function tickMothBurns(e,dt){
  if (!e.mothBurns || !e.mothBurns.length) return 0;
  let actual=0;
  for (let i=e.mothBurns.length-1;i>=0;i--){
    const burn=e.mothBurns[i],raw=Math.min(burn.rawLeft,burn.rawDps*dt);
    if (raw>0 && e.hp>0){
      const passed=mitigate(e,raw,burn.minionShare,false);
      const dealt=applyDamage(e,passed,false,true,burn.minionShare,false,{noMothFang:true});
      e.dotAcc.fire+=dealt; actual+=dealt; burn.rawLeft-=raw;
    }
    burn.life-=dt;
    if (burn.life<=1e-9 || burn.rawLeft<=1e-9 || e.hp<=0) e.mothBurns.splice(i,1);
  }
  return actual;
}

function killEnemy(e, i){
  const b = G.bag, p = G.player;
  const coldShatter = D.coldShatter && isEnemySlowed(e);
  const chilled=e.ail.chill>0, burning=enemyBurning(e), itemKillBlocked=!!e.lastKillNoItems;
  e.dead = true;                   // свита держит цель между кадрами и должна знать, что она мертва
  leaveVisualCorpse(e);            // любой монстр оставляет видимое тело для любого класса
  enemyDeathSfx(e);
  if (e.kind === 'boss'){
    G.bossKills++; G.stats.bosses++;
    diagEvent('boss_killed',{bossId:e.bossId||e.typeKey||'boss',floor:G.floor,level:G.lvl});
    if (e.bossId === 'plague') dropPlagueBossAcid(e);
  }
  else if (e.kind === 'elite'){
    G.stats.elites++;
    if (e.eliteVariant==='plagueOgre') dropEliteAcid(e.x,e.y,88,true);
  }
  else G.stats.normals++;
  // Элита и боссы имеют собственные созвездия и не продвигают созвездие формы.
  const constId = e.kind === 'boss' ? 'boss' : e.kind === 'elite' ? 'elite' : e.typeKey;
  const cs = constellationState();
  if (!G.devZone&&CONST_IDS.includes(constId)) cs.kills[constId]++;
  if (e.pack) packDeath(e);        // до всего прочего: аффиксы пачки могут поднять новых врагов
  if (e.bossId === 'greed' || e.bossId === 'tyrant' || e.bossId === 'minotaur'){
    // Редкие боссы заменяют обычный шанс гарантированными находками:
    // Алчный Громила даёт две, Рогатый Тиран — одну.
    const guaranteed = e.bossId === 'tyrant' ? 1 : 2;
    for (let n = 0; n < guaranteed; n++){
      const before = G.orbs.length; dropItem(e);
      if (G.orbs.length > before) G.orbs[G.orbs.length-1].x += n ? 14 : -14;
    }
  } else if (!e.noLoot) tryDropBook(e);
  // МЕШОК ОПЫТА: надбавка только за элиту и боссов
  const constMul = constellationMultiplier(e);
  const xpv = e.xp * constMul * (amu('xpbag') && e.kind !== 'norm' ? 1.5 : 1);
  if (xpv > 0) G.orbs.push({x:e.x, y:e.y, v:xpv, r:4});           // сфера опыта
  // Золото: монеты падают отдельно от опыта, крупные враги роняют горстью
  /* Золото за врага. Коэффициент при этаже срезан с 0.9 до 0.3, база поднята
     с 2 до 5. Причина: после смены скейлов игрок доходит до 60 этажа вместо 10,
     а населения на этаже вчетверо больше — доход за партию вырос с ~4 000 до
     700 000, и магазин на 322 млн выкупался за 400 партий вместо тысяч.
     Срезать один коэффициент было мало: он же кормит и ранние этажи, где
     игрок как раз и умирает. Поднятая база держит первые десять этажей почти
     на прежнем уровне (4 438 против 3 900), а глубина падает вдвое. */
  const gv = (5 + G.floor*0.3) * (e.kind === 'boss' ? 22 : e.kind === 'elite' ? 4.5 : 1) * D.goldFind * constMul
           * (amu('goldbag') && e.kind !== 'norm' ? 1.5 : 1);   // МЕШОК ЗОЛОТА: только крупные
  const coins = e.kind === 'boss' ? 6 : e.kind === 'elite' ? 2 : 1;
  if (!e.noLoot) for (let ci = 0; ci < coins; ci++)
    G.orbs.push({x:e.x + rnd(-12,12), y:e.y + rnd(-12,12), v:Math.max(1, Math.round(gv/coins*rnd(0.75,1.3))), r:4, gold:true});
  if (D.hasMin){
    G.corpses.push({x:e.x, y:e.y, life:14, big:e.kind !== 'norm'}); // труп — ресурс для призыва
  }
  if (!itemKillBlocked && amu('mothFang') && chilled && !e.lastKillNoMoth && e.lastKillingDamage>0){
    for (const target of nearestLivingEnemies(e,2))
      addMothBurn(target,e.lastKillingDamage*0.15,e.lastKillingMinionShare||0);
  }
  if (!itemKillBlocked && amu('coolingAshRing') && burning){
    for (const target of nearestLivingEnemies(e,2)){
      const duration=target.kind==='boss'?0.3:0.6;
      target.ail.chill=Math.max(target.ail.chill,duration);
      statusText(target,tr('Кольцо Остывающего Пепла'),'#86cce7');
    }
  }
  if (!itemKillBlocked && amu('secondWindRing') && !e.noLoot && e.xp>0){
    p.secondWindKills=((p.secondWindKills||0)+1)%40;
    if (p.secondWindKills===0 && p.dashN<D.dashMax){
      p.dashN++;
      p.dashCd=p.dashN<D.dashMax?D.dashCd:0;
      G.fx.push({t:'txt',x:p.x,y:p.y-30,s:tr('Кольцо Второго Дыхания'),life:1,col:'#72c8a7'});
    }
  }
  if (!itemKillBlocked && amu('closeHarvestRing') && !e.noLoot && dist(e,p)<=100 && G.amuT.closeHarvestRing<=0){
    heal(D.life*0.01);
    G.amuT.closeHarvestRing=1;
  }
  // Счётчик убийств: на нём висят кольцо смерти и чаша крови
  p.kills = (p.kills || 0) + 1;
  if (!itemKillBlocked && amu('reaper') && p.kills % 100 === 0){
    p.reaper = true;
    G.fx.push({t:'txt', x:p.x, y:p.y-32, s:'КОЛЬЦО СМЕРТИ ГОТОВО', life:1.4, col:'#9aa7b4'});
  }
  if (!itemKillBlocked && amu('chalice') && p.kills % 50 === 0){
    heal(D.life);
    G.fx.push({t:'ring', x:p.x, y:p.y, r:10, max:150, life:0.6, col:'#e0405a'});
    G.fx.push({t:'txt', x:p.x, y:p.y-32, s:'ЧАША ПОЛНА', life:1.2, col:'#e0405a'});
  }
  // МАСКА БОССА: последний боец пачки роняет находку гарантированно.
  // Сундуков в игре нет, поэтому «дополнительный chest» — это принудительный дроп
  // из того же пула, что и обычные находки.
  if (!itemKillBlocked && amu('bmask') && e.pack && e.pack.members.length === 0) dropItem(e);
  if (D.onKill){
    heal(D.onKill);
    /* Свита лечится ТОЙ ЖЕ ДОЛЕЙ своего запаса, а не теми же очками.
       Плоские 5 хп для игрока с запасом 460 — это 1.1%, а для приспешника
       с 3544 — 0.14%, то есть карточка формально работала бы, а по факту
       не значила бы ничего. Доля переносит смысл карточки, а не её число. */
    const share = D.onKill / D.life;
    for (const mn of G.minions) mn.hp = Math.min(mn.max, mn.hp + mn.max*share);
  }
  // КЛЫК ВАМПИРА: крупная цель окупает подход вплотную
  if (!itemKillBlocked && amu('fang') && e.kind !== 'norm') heal(D.life*0.15);
  // ПЕПЕЛЬНОЕ СЕРДЦЕ: платит только за горящих, то есть за собранный билд огня
  if (!itemKillBlocked && amu('ash') && enemyBurning(e)) heal(D.life*0.01);
  // ЧУМНОЙ ЗУБ: яд не пропадает с трупом, а перепрыгивает на соседа
  if (!itemKillBlocked && amu('plague') && e.dots.poison.dps > 0 && Math.random() < 0.10){
    let best = null, bd = 260;
    for (const o of G.enemies){ if (o === e) continue; const d = dist(o,e); if (d < bd){ bd = d; best = o; } }
    if (best){
      addDot(best, 'poison', e.dots.poison.dps, e.dots.poison.dur + 2,
        e.dots.poison.dps > 0 ? e.dots.poison.minionDps/e.dots.poison.dps : 0);
      G.fx.push({t:'ring', x:best.x, y:best.y, r:6, max:34, life:0.35, col:'#8be04e'});
    }
  }
  // Карточка и «Последний рывок» имеют разные силу и длительность, поэтому
  // держат отдельные таймеры. recalc() нужен именно при включении: без него
  // бонус впервые проявлялся только после закрытия следующего level-up.
  let speedChanged = false;
  if (b.has('spdKill')){
    if (!(p.spdKill > 0)) speedChanged = true;
    p.spdKill = 0.8;
  }
  if (!itemKillBlocked && amu('sprint')){
    if (!(p.sprintT > 0)) speedChanged = true;
    p.sprintT = 2;
  }
  if (speedChanged) recalc();
  if (!itemKillBlocked && amu('predator')) p.predT = 2; // ГЛАЗ ХИЩНИКА, продлевается каждым убийством
  // ТАЛИСМАН СКОРОСТИ: платит только за крупную цель
  if (!itemKillBlocked && amu('swift') && e.kind !== 'norm'){
    p.swiftT = 5; recalc();
    G.fx.push({t:'ring', x:p.x, y:p.y, r:p.r, max:64, life:0.4, col:'#4fd1c5'});
  }
  // ВАКУУМ: короткий подсос соседей к месту смерти
  if (!itemKillBlocked && amu('vacuum')){
    G.fx.push({t:'ring', x:e.x, y:e.y, r:110*D.aoeR, max:8, life:0.3, col:'#5ec2e0'});
    for (const o of G.enemies){
      const d = dist(o, e);
      if (d > 110*D.aoeR || d < 1) continue;
      const a = Math.atan2(e.y-o.y, e.x-o.x);
      o.kb.x += Math.cos(a)*190; o.kb.y += Math.sin(a)*190;
    }
  }
  p.killT = RECENT_KILL_DAMAGE_DURATION;
  if (coldShatter) coldShatterBurst(e);
  /* Вспышка бросает шанс на каждое убийство, включая убийства другой вспышкой.
     Урон основан на среднем ударе, но проходит через полноценную защиту каждой
     цели. Красное развитие поднимает шанс/урон и добавляет небольшой импульс. */
  if (D.novaKillChance > 0 && Math.random()*100 < D.novaKillChance)
    nova(e.x, e.y, 110*D.aoeR, avgHit()*D.novaKillDamage,
      D.novaKillStrong ? '#ff5a4e' : '#ffb340',
      {mitigate:true, skipDead:true, knock:D.novaKillStrong ? 120 : 0, overpressure:true});
  if (Math.random()*100 < D.explode){
    // Мега-чума — отдельный ролл поверх сработавшего обычного взрыва: меняет
    // только охват, не силу и не длительность болезни.
    const mega = D.explodeMega > 0 && Math.random()*100 < D.explodeMega;
    const rad  = PLAGUE_RADIUS * D.aoeR * D.plagueRadius * (mega ? 2 : 1);
    plagueBurst(e.x, e.y, rad);
    if (mega){                                                  // отдельная подача: гуще и ярче
      G.fx.push({t:'ring', x:e.x, y:e.y, r:8, max:rad*0.6, life:0.4, col:'#ffd24a'});
      burst(e.x, e.y, 30, '#9dca4a', 340, 5, 0.9);
      burst(e.x, e.y, 12, '#ffd24a', 260, 4, 0.7);
      pushScreenShake(0.12,5);
    }
  }
  G.fx.push({t:'ring', x:e.x, y:e.y, r:e.r, max:e.r*2.4, life:0.3, col:e.t.col});
  // Смерть: удвоенная плотность ошмётков, масштабированная размером врага.
  const grade = e.kind === 'boss' ? 3 : e.kind === 'elite' ? 1.7 : 1;
  burst(e.x, e.y, Math.round(28*grade), e.t.col, 190*grade, 4, 0.75);
  burst(e.x, e.y, Math.round(10*grade), '#e8eef5', 120*grade, 3, 0.5);
  if (enemyBurning(e)) burst(e.x, e.y, 10, '#ff7a2f', 160, 3, 0.6);
  if (e.ail.chill  > 0) burst(e.x, e.y, 10, '#7fd6ff', 160, 3, 0.6);
  if (ACTIVE_ENEMY_LOGIC_GRID) removeEnemyFromSpatialGrid(ACTIVE_ENEMY_LOGIC_GRID,e);
  G.enemies.splice(i,1);
}

/* ---------- ЧАСТИЦЫ ----------
   Декоративный поток прореживается вдвое, но удвоенный лимит сохраняет густые
   смертельные выбросы в большой толпе без бесконтрольного роста массива. */
const PARTICLE_CAP=640, PARTICLE_POOL_CAP=640, TRANSIENT_FX_POOL_CAP=512;
const DAMAGE_NUMBER_MERGE_TIME=0.08, DAMAGE_NUMBER_MERGE_SCAN=32;
// В сверхплотных high-level сценах один AoE-кадр способен породить тысячи
// чисел и подписей. Это исключительно визуальная обратная связь: ограничиваем
// её отдельным бюджетом, не затрагивая урон, статусы, телеграфы и boss waves.
const DAMAGE_NUMBER_ACTIVE_CAP=1024, STATUS_TEXT_ACTIVE_CAP=512;
function takeParticle(){ return G.partPool.length?G.partPool.pop():{}; }
function recycleParticle(q){ if (G.partPool.length<PARTICLE_POOL_CAP) G.partPool.push(q); }
function pushParticle(x,y,vx,vy,life,max,sz,col){
  if (G.parts.length>=PARTICLE_CAP) return false;
  const q=takeParticle();q.x=x;q.y=y;q.vx=vx;q.vy=vy;q.life=life;q.max=max;q.sz=sz;q.col=col;
  G.parts.push(q);return true;
}
function updateParticles(dt){
  const parts=G.parts,friction=Math.pow(0.12,dt);let write=0;
  for (let read=0;read<parts.length;read++){
    const q=parts[read];q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=friction;q.vy*=friction;
    if (q.life<=0){ recycleParticle(q);continue; }
    parts[write++]=q;
  }
  parts.length=write;
}
function takeTransientFx(type){
  const f=G.fxPool.length?G.fxPool.pop():{};f.t=type;f.budgetKind='';return f;
}
function recycleTransientFx(f){ if (G.fxPool.length<TRANSIENT_FX_POOL_CAP) G.fxPool.push(f); }
function pushDamageNumber(e,amount,crit=false,col=null,dx=0,dy=-6,kind='hit',life=0.65){
  const fx=G.fx,start=Math.max(0,fx.length-DAMAGE_NUMBER_MERGE_SCAN);
  // Криты остаются отдельными золотыми числами: это значимая обратная связь.
  for (let i=fx.length-1;!crit&&i>=start;i--){
    const f=fx[i];
    if (f.t!=='num'||f.numberOwner!==e||f.numberKind!==kind||f.crit!==!!crit||f.col!==col||f.mergeUntil<G.time) continue;
    f.amount+=amount;f.v=Math.round(f.amount);f.x=e.x+dx;f.y=e.y-e.r+dy;f.life=life;
    f.mergeUntil=G.time+DAMAGE_NUMBER_MERGE_TIME;return f;
  }
  if (G.transientFxCounts.num>=DAMAGE_NUMBER_ACTIVE_CAP) return null;
  const f=takeTransientFx('num');
  f.x=e.x+dx;f.y=e.y-e.r+dy;f.amount=amount;f.v=Math.round(amount);f.life=life;f.crit=!!crit;f.col=col;
  f.numberOwner=e;f.numberKind=kind;f.mergeUntil=G.time+DAMAGE_NUMBER_MERGE_TIME;f.budgetKind='num';
  G.transientFxCounts.num++;fx.push(f);return f;
}
function pushScreenShake(life,amp){
  for (let i=G.fx.length-1;i>=0;i--){
    const f=G.fx[i];if (f.t!=='shake') continue;
    f.life=Math.max(f.life,life);f.amp=Math.max(f.amp||5,amp||5);return f;
  }
  const f=takeTransientFx('shake');f.life=life;f.amp=amp;G.fx.push(f);return f;
}
function updateTransientEffects(dt){
  const fx=G.fx,p=G.player,initialLength=fx.length;let write=0,traces=null,numCount=0,statusCount=0;
  for (let read=0;read<initialLength;read++){
    const f=fx[read];f.life-=dt;
    if (f.t==='num') f.y-=26*dt;
    if (f.t==='hurtNum'||f.t==='healNum') f.y-=50*dt;
    if (f.t==='txt') f.y-=34*dt;
    if (f.t==='ring') f.r+=(f.max-f.r)*Math.min(1,dt*14);
    if (f.t==='wave'){
      f.r+=f.spd*dt;
      if (!f.hit&&Math.abs(dist(f,p)-f.r)<26+p.r){f.hit=true;hurt(f.dmg,false,false,'УДАРНАЯ ВОЛНА БОССА');}
    }
    if (f.life<=0){
      if (f.t==='telegraph'){
        const {t,life,max,...spec}=f;(traces||(traces=[])).push(spec);
      }
      recycleTransientFx(f);continue;
    }
    if(f.budgetKind==='num')numCount++;else if(f.budgetKind==='status')statusCount++;
    fx[write++]=f;
  }
  // hurt() от волны может добавить feedback во время прохода. Как и прежде,
  // новые объекты начинают отсчёт только со следующего кадра.
  for (let i=initialLength,end=fx.length;i<end;i++){
    const f=fx[i];if(f.budgetKind==='num')numCount++;else if(f.budgetKind==='status')statusCount++;
    fx[write++]=f;
  }
  fx.length=write;
  G.transientFxCounts.num=numCount;G.transientFxCounts.status=statusCount;
  if (traces) for (const spec of traces) pushTelegraphTrace(spec);
}
function burst(x, y, n, col, spd, size, life){
  n = Math.max(1, Math.ceil(n*0.5));
  if (G.parts.length > 600) n = Math.min(n, 2);
  n=Math.max(0,Math.min(n,PARTICLE_CAP-G.parts.length));
  for (let i = 0; i < n; i++){
    const a = rnd(0, 6.283), v = rnd(spd*0.2, spd);
    pushParticle(x+rnd(-3,3),y+rnd(-3,3),Math.cos(a)*v,Math.sin(a)*v,
      rnd(life*0.45,life),life,rndi(2,size),col);
  }
}

/* Базовый разряд намеренно мал; ТЕСЛА возвращает большой цепной удар только
   после развития шанса до потолка 25%. Радиус остаётся общим для обеих версий. */
const SHOCK_BASE_TARGETS = 5, SHOCK_TESLA_TARGETS = 20, SHOCK_RANGE = 400;
const SHOCK_BASE_SHARE = 0.15, SHOCK_TESLA_SHARE = 0.25, SHOCK_DURATION = 1;
/* Общая формула радиуса игрока. Все обычные +% — постоянные и сохранённые
   на конкретном ударе — сначала складываются. Только уникальные изменения
   формы способности (мини-сфера, МЕГА-чума, Нулевая дистанция и т.п.)
   применяются после корзины отдельным множителем. */
function playerAreaRadius(base, localBonusPct=0, uniqueMul=1){
  const globalPct=Number.isFinite(D.aoeRadiusPct) ? D.aoeRadiusPct : (D.aoeR-1)*100;
  const localPct=Number.isFinite(localBonusPct) ? localBonusPct : 0;
  const special=Number.isFinite(uniqueMul) ? uniqueMul : 1;
  return base*(1+(globalPct+localPct)/100)*special;
}
/* Базы площадных радиусов игрока. Если область принадлежит игроку, общая
   корзина радиуса её растит; фиксированные механические дистанции врагов,
   подбора и условий боя сюда не входят. */
const SLOW_AURA_BASE = 260, INFERNO_BASE = 110;
/* Охлаждение — короткий ослабленный удар контроля: 15% прямого замедления,
   5% соседям, x1.10 входящего урона и 10% дополнительного урона от атаки. */
const CHILL_AURA_R = 96, CHILL_SLOW = 0.15, CHILL_AURA_SLOW = 0.05, CHILL_TAKEN_INC = 0.10;
const CHILL_DURATION = 0.5, CHILL_DAMAGE_SHARE = 0.10;
const COLD_SHATTER_RADIUS = 180, COLD_SHATTER_DURATION = 0.7;
const SHOCK_TAKEN_INC = 0.10, FREEZE_TAKEN_INC = 0.10;
const FREEZE_CHANCE = 0.01, FREEZE_DURATION = 1;
const IGNITE_DPS_SHARE = 0.20, POISON_DPS_SHARE = 0.15;
const OVERPRESSURE_BONUS = 0.05, OVERPRESSURE_EXTRA_CAP = 5;
const shockTargets = () => D.tesla ? SHOCK_TESLA_TARGETS : SHOCK_BASE_TARGETS;
const shockShare = () => D.tesla ? SHOCK_TESLA_SHARE : SHOCK_BASE_SHARE;
/* Карточка не должна быть пустой: Маг начинает со взрыва сферы, остальные классы
   увидят её только после получения хотя бы одного настоящего уронного взрыва. */
function hasDamageExplosionSource(){
  if (!G || !G.weapon || !G.bag) return false;
  return G.weapon.type === 'orb' || D.novaKillChance > 0 || G.bag.has('retal') ||
    D.minBoom || D.minFrenzy || !!D.minBlink || amu('gravity');
}
function overpressureMultiplier(targetCount){
  if (!D.overpressure) return 1;
  return 1 + Math.min(OVERPRESSURE_EXTRA_CAP, Math.max(0, targetCount - 1)) * OVERPRESSURE_BONUS;
}
/* Источник открывает обе новые карточки, но сам бонус урона смотрит на фактическое
   состояние конкретной цели. Бомбардир считается источником, потому что его случайное
   заклинание холода накладывает то же Охлаждение, что и игрок или Книга льда. */
function hasSlowSource(){
  if (!G || !G.bag) return false;
  return D.chillCh > 0 || !!(G.items && G.items.cold) || amu('frost') ||
    D.maxBomb > 0 || D.dizzy || D.slowAura;
}
function isEnemySlowed(e){
  if (!e) return false;
  if (e.ail.chill > 0 || e.ail.dizzy > 0) return true;
  if (D.slowAura && dist(e,G.player) < D.slowAuraR) return true;
  for (const src of G.enemies){
    if (src === e || src.dead || src.ail.chill <= 0) continue;
    if (dist(src,e) <= D.chillAuraR + e.r) return true;
  }
  return false;
}
function coldShatterBurst(src){
  const radius=COLD_SHATTER_RADIUS*D.aoeR, duration=COLD_SHATTER_DURATION*D.ailDur;
  G.fx.push({t:'ring',x:src.x,y:src.y,r:8,max:radius,life:0.32,col:'#7fd6ff'});
  for (const e of G.enemies){
    if (e === src || e.dead || dist(e,src) >= radius + e.r) continue;
    if (e.ail.chill <= 0) statusText(e,'SLOWED','#7fd6ff');
    e.ail.chill=Math.max(e.ail.chill,duration);
  }
  burst(src.x,src.y,10,'#7fd6ff',180,3,0.5);
}
function shockBurst(src, hitDamage, minionShare=0){
  const list=nearestEnemies(src,shockTargets(),
    (x,d)=>x!==src&&!x.dead&&x.hp>0&&d<D.shockR);
  const used=new Set([src]),baseDamage=hitDamage*shockShare()*D.ailEff;
  let last=src;
  for (const t of list){
    applyDamage(t, baseDamage, false, false, minionShare);
    G.fx.push({t:'bolt', x:src.x, y:src.y, x2:t.x, y2:t.y, life:0.2});
    burst(t.x, t.y, 3, '#ffe14a', 130, 3, 0.3);
    used.add(t); last=t;
  }
  if (amu('conductorRing')) for (let jump=1;jump<=3;jump++){
    const next=nearestEnemies(last,1,
      (x,d)=>!used.has(x)&&!x.dead&&x.hp>0&&d<D.shockR)[0];
    if (!next) break;
    applyDamage(next,baseDamage*Math.pow(0.70,jump),false,false,minionShare);
    G.fx.push({t:'bolt',x:last.x,y:last.y,x2:next.x,y2:next.y,life:0.2,col:'#80baff'});
    burst(next.x,next.y,3,'#80baff',130,3,0.3);
    used.add(next); last=next;
  }
}

/* На полной силе Арканная иллюзия сдвигает обычную цель примерно на 30 px.
   Это контроль построения толпы, а не жёсткая стяжка уровня колодца. */
const ARCANE_PULL_FORCE = 250;

/* Волна урона по площади вокруг точки */
function nova(x, y, r, dmg, col, opt){
  if (!(opt && opt.noRing)) G.fx.push({t:'ring', x, y, r:8, max:r, life:0.28, col});
  const candidates=enemyAreaCandidates(opt&&opt.grid,x,y,r);
  const targets = candidates.filter(e => e !== (opt && opt.exclude) &&
    !((opt && opt.skipDead) && e.dead) && dist(e,{x,y}) < r + e.r);
  const blastDamage = dmg * (opt && opt.overpressure ? overpressureMultiplier(targets.length) : 1);
  for (const e of targets){
    const minionShare = opt && opt.minionShare || 0;
    const skipConstellation = !!(opt && opt.skipConstellation);
    const targetDamage = blastDamage * (opt && opt.damageMul ? opt.damageMul(e) : 1);
    const dealt = opt && opt.mitigate ? mitigate(e, targetDamage, minionShare, skipConstellation) : targetDamage;
    const actual = applyDamage(e, dealt, false, false, minionShare, skipConstellation);
    if (opt && opt.onDamage) opt.onDamage(e, actual);
    if (opt && opt.onTarget) opt.onTarget(e, dealt);
    if (opt && opt.knock){
      const dx=e.x-x, dy=e.y-y, d=Math.hypot(dx,dy);
      if (d > 0){
        const force=opt.knock*knockbackScale(e);
        e.kb.x += dx/d*force; e.kb.y += dy/d*force;
      }
    }
    if (opt && opt.pull && !e.dead){
      const dx=e.x-x, dy=e.y-y, d=Math.hypot(dx,dy);
      if (d > 0){
        const force=opt.pull*knockbackScale(e);
        e.kb.x -= dx/d*force; e.kb.y -= dy/d*force;
      }
    }
    if (opt && opt.ignite) addDot(e, 'fire', opt.ignite, 3*D.ailDur, minionShare); // мега-взрыв поджигает задетых
  }
  return targets;
}

/* Красная ветка Мага относится именно к взрыву: прямой контакт сферы уже прошёл
   через damage() и сюда не попадает. Шансы берутся из текущих карточек игрока;
   книги остаются отдельными источниками и не удваиваются второй раз. */
function applyOrbExplosionAilments(e, total){
  if (!D.elementalExplosion) return;
  const roll = v => Math.random()*100 < v*2;
  if (roll(D.igniteCh))
    addDot(e, 'fire', total*IGNITE_DPS_SHARE*D.ailEff, 3*D.ailDur);
  if (roll(D.chillCh)){
    if (e.ail.chill <= 0) statusText(e, 'SLOWED', '#ffe14a');
    e.ail.chill = Math.max(e.ail.chill, CHILL_DURATION*D.ailDur);
    applyDamage(e, total*CHILL_DAMAGE_SHARE*D.ailEff, false, false);
    if (D.freeze && Math.random() < FREEZE_CHANCE){
      if (e.ail.freeze <= 0) statusText(e, 'FROZEN', '#7fd6ff');
      e.ail.freeze = Math.max(e.ail.freeze, FREEZE_DURATION*D.ailDur*D.freezeDur);
    }
  }
  if (roll(D.shockCh)){
    e.ail.shock = Math.max(e.ail.shock, SHOCK_DURATION*D.ailDur);
    shockBurst(e, total, 0);
  }
  if (roll(D.poiCh))
    addDot(e, 'poison', total*POISON_DPS_SHARE*D.ailEff*(D.radiation?2:1), 4*D.ailDur);
}

function hitArcaneTrace(trace,enemyGrid=null){
  for (const e of enemyAreaCandidates(enemyGrid,trace.x,trace.y,trace.r)){
    if (e.hp <= 0 || trace.hitSet.includes(e) || dist(e,trace) >= trace.r + e.r) continue;
    trace.hitSet.push(e);
    applyDamage(e, trace.dmg, false, false);
  }
}
function spawnArcaneTrace(x, y, r, dmg){
  const trace={x,y,r,life:0.5,max:0.5,dmg,hitSet:[]};
  G.arcaneTraces.push(trace);
  hitArcaneTrace(trace);                 // уже стоящие в области получают свой единственный тик сразу
}
function tickArcaneTraces(dt){
  const enemyGrid=buildEnemySpatialGrid();
  for (let i=G.arcaneTraces.length-1; i>=0; i--){
    const trace=G.arcaneTraces[i];
    hitArcaneTrace(trace,enemyGrid);
    trace.life-=dt;
    if (trace.life <= 0) G.arcaneTraces.splice(i,1);
  }
}
function triggerOverheatedOrb(){
  const p=G.player;
  p.overheatedPct=Math.min(300,(p.overheatedPct||0)+D.overheatedPerExplosion);
  p.overheatedT=1.5;                       // обновляется, но не прибавляется к остатку
  recalc();
}
function remoteOrbActive(s){ return !!(D.remoteBlast>0 && s && s.orb && (s.travel||0)>250); }

/* Промахнувшаяся сфера фиксирует силу и радиус в момент завершения полёта.
   Поэтому прокачка, взятая пока мина лежит на земле, задним числом её не меняет. */
function plantArcaneMine(s){
  if (!D.arcaneMine || !s || !s.orb || (s.hitSet && s.hitSet.length)) return null;
  const aoeScale=s.aoeScale || 1, attackMul=s.attackMul === undefined ? 1 : s.attackMul;
  const margin=ARCANE_MINE_DRAW_SIZE/2;
  const mine={
    x:clamp(s.x,-ARENA+margin,ARENA-margin),
    y:clamp(s.y,-ARENA+margin,ARENA-margin),
    r:playerAreaRadius(G.weapon.aoe,s.aoeBonusPct,aoeScale),
    dmg:avgHit()*attackMul*MAGE_ORB_EXPLOSION_DAMAGE_SHARE*ARCANE_MINE_DAMAGE_SHARE,
    life:ARCANE_MINE_DURATION,max:ARCANE_MINE_DURATION,
  };
  G.arcaneMines.push(mine);
  return mine;
}

/* Это ровно базовые шансы автоатаки, без удвоения красной карты
   «Элементальный взрыв»: каждый задетый враг делает четыре своих броска. */
function applyArcaneMineAilments(e, total){
  const roll=v=>Math.random()*100 < v;
  if (roll(D.igniteCh))
    addDot(e,'fire',total*IGNITE_DPS_SHARE*D.ailEff,3*D.ailDur);
  if (roll(D.chillCh)){
    if (e.ail.chill<=0) statusText(e,'SLOWED','#ffe14a');
    e.ail.chill=Math.max(e.ail.chill,CHILL_DURATION*D.ailDur);
    applyDamage(e,total*CHILL_DAMAGE_SHARE*D.ailEff,false,false);
    if (D.freeze && Math.random()<FREEZE_CHANCE){
      if (e.ail.freeze<=0) statusText(e,'FROZEN','#7fd6ff');
      e.ail.freeze=Math.max(e.ail.freeze,FREEZE_DURATION*D.ailDur*D.freezeDur);
    }
  }
  if (roll(D.shockCh)){
    e.ail.shock=Math.max(e.ail.shock,SHOCK_DURATION*D.ailDur);
    shockBurst(e,total,0);
  }
  if (roll(D.poiCh))
    addDot(e,'poison',total*POISON_DPS_SHARE*D.ailEff*(D.radiation?2:1),4*D.ailDur);
}

function detonateArcaneMine(mine,enemyGrid=null){
  const targets=nova(mine.x,mine.y,mine.r,mine.dmg,'#63dcff',{
    mitigate:true,overpressure:true,noRing:true,grid:enemyGrid,
    onTarget:(e,total)=>applyArcaneMineAilments(e,total),
  });
  G.fx.push({t:'arcaneMineExplosion',x:mine.x,y:mine.y,r:mine.r,
             life:ARCANE_MINE_EXPLOSION_TIME,max:ARCANE_MINE_EXPLOSION_TIME});
  return targets;
}

function tickArcaneMines(dt){
  const enemyGrid=buildEnemySpatialGrid();
  for (let i=G.arcaneMines.length-1;i>=0;i--){
    const mine=G.arcaneMines[i];
    const triggered=enemyAreaCandidates(enemyGrid,mine.x,mine.y,mine.r)
      .some(e=>e.hp>0 && !e.dead && dist(e,mine)<mine.r+e.r);
    if (triggered){
      G.arcaneMines.splice(i,1);
      detonateArcaneMine(mine,enemyGrid);
      continue;
    }
    mine.life-=dt;
    if (mine.life<=0) G.arcaneMines.splice(i,1);
  }
}

const REPEAT_DETONATION_DELAY = 0.25;
const REPEAT_DETONATION_DAMAGE = 0.20;
const REPEAT_DETONATION_RADIUS = 0.70;

/* Второй взрыв хранит фактически снятый первым HP отдельно для каждой цели.
   Защита уже учтена в этой величине и второй раз не применяется. Новая цель,
   которой первый взрыв ничего не наносил, не имеет базы для повторного урона. */
function scheduleRepeatDetonation(x,y,r,hits){
  const blast={x,y,r:r*REPEAT_DETONATION_RADIUS,life:REPEAT_DETONATION_DELAY,
               max:REPEAT_DETONATION_DELAY,hits:hits.slice()};
  G.repeatDetonations.push(blast);
  return blast;
}
function detonateRepeatedOrb(blast){
  G.fx.push({t:'ring',x:blast.x,y:blast.y,r:8,max:blast.r,life:0.28,
             col:'#8f7dff',alpha:MAGE_EXPLOSION_ALPHA});
  let hitCount=0;
  for (const hit of blast.hits){
    const e=hit.enemy;
    if (!e || e.dead || e.hp<=0 || !G.enemies.includes(e) || dist(e,blast)>=blast.r+e.r) continue;
    applyDamage(e,hit.dealt*REPEAT_DETONATION_DAMAGE,false,false);
    hitCount++;
  }
  return hitCount;
}
function tickRepeatDetonations(dt){
  for (let i=G.repeatDetonations.length-1;i>=0;i--){
    const blast=G.repeatDetonations[i];
    blast.life-=dt;
    if (blast.life<=0){
      G.repeatDetonations.splice(i,1);
      detonateRepeatedOrb(blast);
    }
  }
}

const GROUNDBREAKER_CRACK_LIFE = 2;
const GROUNDBREAKER_CRACK_TICK = 0.5;
const GROUNDBREAKER_DAMAGE_SHARE = 0.12;
const GROUNDBREAKER_CRACK_MAX = 8;

/* Трещина — отдельный непрямой источник: каждый её тик заново проходит через
   damage(), поэтому броня и прочая защита рассчитываются для каждого врага,
   но счётчики прямых ударов и двойное попадание не запускаются. */
function spawnGroundbreakerCrack(x,y,r){
  if (G.groundbreakerCracks.length >= GROUNDBREAKER_CRACK_MAX) G.groundbreakerCracks.shift();
  const crack={x,y,r,life:GROUNDBREAKER_CRACK_LIFE,tick:GROUNDBREAKER_CRACK_TICK,hits:0,
               seed:G.time*1.73+G.groundbreakerCracks.length*0.91};
  G.groundbreakerCracks.push(crack);
  G.fx.push({t:'ring',x,y,r:12,max:r,life:0.35,col:'#d5a64a',alpha:0.65});
  return crack;
}
function tickGroundbreakerCracks(dt){
  let enemyGrid=null;
  for (let i=G.groundbreakerCracks.length-1;i>=0;i--){
    const crack=G.groundbreakerCracks[i];
    crack.life-=dt; crack.tick-=dt;
    while (crack.tick<=1e-9 && crack.hits<4){
      crack.tick+=GROUNDBREAKER_CRACK_TICK; crack.hits++;
      const confinementPct=confinementDamagePct();
      const damageConditions=damageConditionSnapshot(G.player);
      if (!enemyGrid) enemyGrid=buildEnemySpatialGrid();
      for (const e of enemyAreaCandidates(enemyGrid,crack.x,crack.y,crack.r)){
        if (e.dead || e.hp<=0 || dist(e,crack)>crack.r+e.r) continue;
        damage(e,{attackMul:GROUNDBREAKER_DAMAGE_SHARE,warriorMelee:true,noDouble:true,
          confinementPct,...damageConditions});
      }
      G.fx.push({t:'ring',x:crack.x,y:crack.y,r:crack.r*0.82,max:crack.r,life:0.16,col:'#d5a64a',alpha:0.32});
    }
    if (crack.life<=1e-9 || crack.hits>=4) G.groundbreakerCracks.splice(i,1);
  }
}

function explodePlayerOrb(s,enemyGrid=null){
  const aoeScale=s.aoeScale || 1, attackMul=s.attackMul === undefined ? 1 : s.attackMul;
  const radius=playerAreaRadius(G.weapon.aoe,s.aoeBonusPct,aoeScale);
  const fixedTargets=enemyAreaCandidates(enemyGrid,s.x,s.y,radius)
    .filter(e=>!e.dead&&e.hp>0&&dist(e,s)<radius+e.r);
  const cometMul=!s.noProcs&&amu('cometEye')&&fixedTargets.length===1?1.30:1;
  const sphereDamage=avgHit()*attackMul*(1+(s.confinementPct||0)/100);
  const remote=remoteOrbActive(s), point={x:s.x,y:s.y};
  const repeatHits=D.repeatDetonation ? [] : null;
  const targets=nova(s.x, s.y, radius, sphereDamage*MAGE_ORB_EXPLOSION_DAMAGE_SHARE, remote?'#b56cff':'#c08cff', {
    overpressure:true,noRing:true,grid:enemyGrid,
    pull:ARCANE_PULL_FORCE*D.arcanePull/100,
    skipDead:true,
    damageMul:e=>cometMul*(1 + (remote?D.remoteBlast:0)/100 + (dist(e,point)<=radius*0.5?D.blastHeart:0)/100),
    onDamage:repeatHits ? (e,dealt)=>repeatHits.push({enemy:e,dealt}) : null,
    onTarget:s.noAilments?null:(e,total)=>applyOrbExplosionAilments(e,total),
  });
  G.fx.push({t:'mageOrbExplosion',x:s.x,y:s.y,r:radius,
    variant:s.miniOrb?'mini':remote?'remote':'normal',
    heart:D.blastHeart>0,elemental:!!D.elementalExplosion,
    life:MAGE_ORB_EXPLOSION_TIME,max:MAGE_ORB_EXPLOSION_TIME});
  if (D.repeatDetonation) scheduleRepeatDetonation(s.x,s.y,radius,repeatHits);
  if (D.residualArcana>0)
    spawnArcaneTrace(s.x,s.y,radius,sphereDamage*D.residualArcana/100);
  if (targets.length>=3 && D.overheatedPerExplosion>0) triggerOverheatedOrb();
  if (!s.noProcs && !s.miniOrb && amu('eclipseBrushes') && fixedTargets.length>=4) G.player.eclipseReady=true;
}

const DREAD_LEECH_TIME = 3;
const DREAD_RECOVERY_CAP = 0.08;
const DREAD_SHIELD_CAP = 0.15;
const PLAYER_HEAL_FEEDBACK_LIFE = 0.4;
const PLAYER_HEAL_FEEDBACK_MERGE_TIME = 0.12;

/* Лечение использует тот же крупный combat text, что и входящий урон.
   Внутренний расчёт остаётся дробным, но на экране показывается ближайшее целое
   (минимум 1 для реально прошедшего лечения). Частые тики за короткое окно
   складываются в одну цифру: так регенерация остаётся видимой, но не создаёт
   новый текст каждый кадр. */
function playerHealFeedbackText(amount){
  return '+'+Math.max(1,Math.round(amount)).toLocaleString(LANGUAGE==='en'?'en-US':'ru-RU');
}
function playerHealFeedback(restored){
  if (!(restored > 0)) return;
  const p=G.player;
  const now=G.time||0;
  for (let i=G.fx.length-1;i>=0;i--){
    const f=G.fx[i];
    if (f.t!=='healNum' || f.mergeUntil<now || !(f.life>0)) continue;
    f.amount+=restored; f.v=playerHealFeedbackText(f.amount);
    return;
  }
  const f=takeTransientFx('healNum');
  f.x=p.x+rnd(-7,7);f.y=p.y-p.r-15;f.amount=restored;f.v=playerHealFeedbackText(restored);
  f.mergeUntil=now+PLAYER_HEAL_FEEDBACK_MERGE_TIME;
  f.life=PLAYER_HEAL_FEEDBACK_LIFE;f.max=PLAYER_HEAL_FEEDBACK_LIFE;G.fx.push(f);
}

/* Каждый удар создаёт отдельный трёхсекундный поток. Когда суммарный поток
   превышает 8% максимального HP в секунду, лишнее не теряется, а остаётся
   в очереди дольше — поэтому потолок мягкий, а не обрезающий. */
function queueDreadLeech(v){
  if (!(v > 0)) return;
  const p = G.player;
  p.leechFlows.push({left:v, rate:v/DREAD_LEECH_TIME});
  p.leechPool += v;
}

/* Разрешённый канал Ужасающего вампира: сначала заполняет здоровье, затем
   превращает остаток в отдельный красный щит до 15% максимального HP. */
function dreadRecover(v){
  const p = G.player;
  const restored = Math.max(0, Math.min(v, D.life - p.hp));
  G.stats.healing += restored;
  p.hp += restored;
  /* Поток приходит дробными тиками каждый кадр. Не округляем каждый такой тик
     до ложного +1: копим только визуальный остаток и показываем число после
     фактического восстановления очередного целого HP. */
  p.dreadHealFeedbackCarry = (p.dreadHealFeedbackCarry||0) + restored;
  const feedback = Math.floor(p.dreadHealFeedbackCarry + 1e-9);
  if (feedback > 0){
    p.dreadHealFeedbackCarry -= feedback;
    playerHealFeedback(feedback);
  }
  const overflow = Math.max(0, v - restored);
  if (overflow > 0) p.dreadShield = Math.min(D.life*DREAD_SHIELD_CAP, p.dreadShield + overflow);
}

function tickDreadLeech(dt){
  const p = G.player, flows = p.leechFlows;
  if (!flows.length){ p.leechPool = 0; return; }
  let wanted = 0;
  for (const f of flows) wanted += Math.min(f.left, f.rate*dt);
  const granted = Math.min(wanted, D.life*DREAD_RECOVERY_CAP*dt);
  const share = wanted > 0 ? granted/wanted : 0;
  for (const f of flows) f.left -= Math.min(f.left, f.rate*dt)*share;
  for (let i=flows.length-1; i>=0; i--) if (flows[i].left < 1e-7) flows.splice(i,1);
  p.leechPool = Math.max(0, p.leechPool - granted);
  dreadRecover(granted);
}

/* Единственная дверь для обычного восстановления здоровья в игре.
   УЖАСАЮЩИЙ ВАМПИР закрывает её целиком; его собственный поток проходит
   через dreadRecover(), поэтому другие источники лечения сюда не пролезают. */
function heal(v){
  const p = G.player;
  if (D.dread) return;
  const restored = Math.max(0, Math.min(v, D.life - p.hp));
  G.stats.healing += restored;
  p.hp += restored;
  playerHealFeedback(restored);
}

/* Всплывающее слово над врагом — статус должен читаться мгновенно */
function statusText(e, txt, col){
  if(G.transientFxCounts.status>=STATUS_TEXT_ACTIVE_CAP)return null;
  const f=takeTransientFx('txt');f.x=e.x;f.y=e.y-e.r-14;f.s=txt;f.life=0.55;f.col=col;f.budgetKind='status';
  G.transientFxCounts.status++;G.fx.push(f);return f;
}

/* Эффекты книг. Вызывается и из атак игрока, и из ударов свиты —
   книги работают на всех, как и задумано. */
function applyBookAilments(e, total, chanceMul=1, fixedDamageMul=1, minionShare=0){
  const it = G.items; if (!it) return;
  const proc = k => it[k] && Math.random()*100 < bookChance(k) * chanceMul;
  if (proc('fire'))  addDot(e, 'fire', total * IGNITE_DPS_SHARE * D.ailEff, 3 * D.ailDur, minionShare);
  if (proc('poison')) addDot(e, 'poison', D.bookPoiDps * fixedDamageMul, 3 * D.ailDur, minionShare);
  if (proc('bleed'))  addDot(e, 'bleed', bookBleedDps() * fixedDamageMul, 4 * D.ailDur, minionShare);
  if (proc('cold')){
    if (e.ail.chill <= 0) statusText(e, 'SLOWED', '#ffe14a');
    e.ail.chill = Math.max(e.ail.chill, CHILL_DURATION * D.ailDur);
    applyDamage(e, total * CHILL_DAMAGE_SHARE * D.ailEff, false, false, minionShare);
    if (D.freeze && Math.random() < FREEZE_CHANCE){
      if (e.ail.freeze <= 0) statusText(e, 'FROZEN', '#7fd6ff');
      e.ail.freeze = Math.max(e.ail.freeze, FREEZE_DURATION * D.ailDur * D.freezeDur);
    }
  }
  if (proc('shock')){
    if (e.ail.shock <= 0) statusText(e, 'SHOCKED', '#ffe14a');
    e.ail.shock = Math.max(e.ail.shock, SHOCK_DURATION * D.ailDur);
    shockBurst(e, total, minionShare);
  }
}

/* ---------- УРОН СО ВРЕМЕНЕМ: СТАКИ ----------
   Каждое срабатывание добавляет свой урон в общий котёл, а котёл непрерывно
   утекает со скоростью dps/длительность. Математически это тождественно тому,
   как если бы каждый стак жил отдельным таймером и истекал сам, но стоит O(1)
   памяти вместо списка из сотен объектов.
   Установившийся уровень = частота проков x урон за прок x длительность. */
function addDot(e, type, dps, dur, minionShare=0){
  // Оберег гасит и урон со временем своей стихии, иначе поджог обходил бы защиту
  if (e.ward && ((e.ward === 'fire' && type === 'fire') || (e.ward === 'poi' && type === 'poison')))
    dps *= 0.4;
  const d = e.dots[type];
  const wasActive=d.dps>0;
  // Длительность у котла одна на все источники. Раньше здесь стояло d.dur = dur,
  // поэтому последний прок мог обрезать уже накопленный котёл.
  // Берём средневзвешенную по урону. Это не приближение: суммарный урон котла равен
  // dps × dur, и при таком слиянии он в точности равен сумме вкладов обоих проков.
  const tot = d.dps + dps;
  d.dur = tot > 0 ? (d.dps*d.dur + dps*dur) / tot : dur;
  d.dps = tot; d.minionDps = (d.minionDps || 0) + dps*minionShare; d.n += 1;
  d.life=Math.max(wasActive?(d.life||0):0,dur);
  if (!wasActive){ d.unhealedExtra=0; d.unhealedPause=0; }
}
/* Совместимость: кровотечение теперь просто один из типов DoT */
function addBleed(e, dps, minionShare=0){ addDot(e, 'bleed', dps, 6 * D.ailDur, minionShare); }

/* Чумной взрыв не наносит мгновенный урон. Он заражает всех выживших в малом
   радиусе; чума всегда делает три тика: на 1-й, 2-й и 3-й секунде. Каждый тик
   берёт 15% от ТЕКУЩЕГО, а не максимального HP цели, поэтому не может убить
   одним срабатыванием и естественно слабеет на раненых врагах. */
const PLAGUE_RADIUS = 82, PLAGUE_LIFE = 3, PLAGUE_PCT = 0.15;
function infectWithPlague(e){
  e.plague = {life:PLAGUE_LIFE, tick:1, hits:0, unhealedExtra:0};  // обновляет чуму, а не складывает бесконечно
  statusText(e, 'ЧУМА', '#b6df55');
  G.fx.push({t:'ring', x:e.x, y:e.y, r:e.r+3, max:e.r+15, life:0.22, col:'#b6df55'});
}

/* КОЛЬЦО НЕЗАЖИВШЕЙ РАНЫ продлевает только время уже рассчитанного эффекта.
   Для непрерывного DoT это секунда без утечки котла; для дискретной чумы —
   ещё один тик. Ни dps, ни доля урона свиты при этом не пересчитываются. */
function extendClosestDamagingStatus(e, src, dealt){
  if (!amu('unhealedWoundRing') || !e || !(dealt>0) || !src || !src.direct || src.itemDamage) return false;
  const candidates=[];
  for (const key of ['fire','poison','bleed']){
    const d=e.dots && e.dots[key];
    if (d && d.dps>0 && (d.unhealedExtra||0)<2)
      candidates.push({kind:'dot',key,remaining:Math.max(0,d.life||d.dur||0)});
  }
  if (e.plague && (e.plague.unhealedExtra||0)<2)
    candidates.push({kind:'plague',remaining:Math.max(0,e.plague.life||0)});
  if (!candidates.length) return false;
  candidates.sort((a,b)=>a.remaining-b.remaining);
  const chosen=candidates[0];
  if (chosen.kind==='plague'){
    e.plague.unhealedExtra=(e.plague.unhealedExtra||0)+1;
    e.plague.life+=1;
  } else {
    const d=e.dots[chosen.key];
    d.unhealedExtra=(d.unhealedExtra||0)+1;
    d.unhealedPause=(d.unhealedPause||0)+1;
    d.life=(d.life||0)+1;
  }
  statusText(e,tr('КОЛЬЦО НЕЗАЖИВШЕЙ РАНЫ'),'#b56ee8');
  return true;
}
function plagueBurst(x, y, radius){
  G.fx.push({t:'ring', x, y, r:8, max:radius, life:0.34, col:'#9dca4a'});
  burst(x, y, 18, '#9dca4a', 240, 4, 0.65);
  for (const e of G.enemies){
    if (e.dead || dist(e, {x,y}) >= radius + e.r) continue;
    infectWithPlague(e);
  }
}

/* Виды приспешников. mode задаёт поведение, остальное — внешний вид. */
const MKIND = {
  skeleton:{nm:'Скелет',          sides:3, col:'#8fd4b0', mode:'melee'},
  bombardier:{nm:'Бомбардир',     sides:5, col:'#b98fd4', mode:'bombardier'},
  golemB:  {nm:'Голем крови',     sides:6, col:'#d4506a', mode:'golemB'},
  golemN:  {nm:'Костяной голем',  sides:5, col:'#e6e2d6', mode:'golemN'},
};
const mCount = k => G.minions.reduce((n,m)=> n + (m.kind === k ? 1 : 0), 0);

/* Здоровье и размер зависят от вида: големы считаются от статов игрока напрямую */
function minionHp(kind){
  /* Запас голема считается от запаса свиты, а не от вашего. Ваше здоровье
     растёт линейно по уровню, а свита — по этажу через hpScale: привязка
     к игроку делала танка тем бесполезнее, чем глубже забег. Замер до правки
     на 35 этаже: голем десятого уровня имел 2% от запаса обычного скелета. */
  if (kind === 'golemB') return D.minLife * 0.35 * D.golemB;   // 10 уровней → 3.5 скелета
  /* Та же правка, что и у голема крови: запас считается от свиты, а не от вас.
     Замер до неё на 35 этаже — 1.1% от запаса обычного скелета, при том что
     костяной по своей роли лезет в самую гущу и стягивает удары.
     Доля вдвое ниже, чем у голема крови (0.35): этот не танк, а бегун. */
  if (kind === 'golemN') return D.minLife * 0.20 * D.golemN;   // 10 уровней → 2 скелета
  if (kind === 'bombardier') return D.minLife * 0.7;
  return D.minLife;
}
function minionR(kind){
  return kind === 'golemB' ? 22 : kind === 'golemN' ? 17
       : kind === 'bombardier' ? 11 : (D.minTier ? 13 : 10);
}
/* Кого поднимать следующим. Големы идут первыми: каждый стоит до десяти карт,
   и держать их в конце очереди за восемнадцатью рядовыми — значит обесценить вложение. */
function needKind(){
  let skeleton=0,bombardier=0,golemB=0,golemN=0;
  for (const m of G.minions){
    if (m.kind==='skeleton') skeleton++;
    else if (m.kind==='bombardier') bombardier++;
    else if (m.kind==='golemB') golemB++;
    else if (m.kind==='golemN') golemN++;
  }
  if (D.golemB > 0 && !golemB) return 'golemB';
  if (D.golemN > 0 && !golemN) return 'golemN';
  if (skeleton < D.maxSkel) return 'skeleton';
  if (bombardier < D.maxBomb) return 'bombardier';
  return null;
}
