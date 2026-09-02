/* ---------- 7. АТАКА ИГРОКА (автоматическая) ----------
   Игрок не целится и не жмёт кнопку: персонаж сам выбирает ближайшего врага
   в пределах дальности оружия и бьёт по готовности отката.
   Остаётся только позиционирование — то есть решение «куда встать», а не «куда кликнуть». */

/* Дальность автозахвата: ближний бой ограничен длиной дуги, дальний — полётом снаряда */
const THREE_STEP_RANGE_BONUSES=[0.10,0.15,0.20];
function warriorNextSwingStep(p=G && G.player){ return ((p && p.bladeN || 0)%3)+1; }
function warriorNextSwingRangeMul(p=G && G.player){
  return D.threeStep && G.weapon.id==='wpn.sword' ? 1+THREE_STEP_RANGE_BONUSES[warriorNextSwingStep(p)-1] : 1;
}
function ordinaryWarriorSwingRange(){
  const w=G.weapon;
  return w.reach*D.arc*D.longBladeRange*warriorNextSwingRangeMul();
}
function tickEmptyThrone(dt){
  const p=G.player;
  if (!amu('emptyThroneSeal') || G.weapon.id!=='wpn.sword'){
    p.emptyThroneT=0; p.emptyThroneReady=false; return false;
  }
  if (p.emptyThroneReady) return true;
  if (G.amuT.emptyThroneSeal>0){ p.emptyThroneT=0; return false; }
  const reach=ordinaryWarriorSwingRange();
  const nearby=G.enemies.some(e=>!e.dead&&e.hp>0&&dist(e,p)-e.r<=reach);
  p.emptyThroneT=nearby?0:Math.min(0.8,(p.emptyThroneT||0)+dt);
  if (p.emptyThroneT>=0.8){
    p.emptyThroneReady=true;
    G.fx.push({t:'txt',x:p.x,y:p.y-32,s:tr('ПЕЧАТЬ ПУСТОГО ТРОНА'),life:0.9,col:'#b884ff'});
  }
  return p.emptyThroneReady;
}
function attackRange(allowEmptyThrone=true){
  const w = G.weapon;
  // Автозахват обязан видеть ровно ту же дальность, до которой достаёт обычный
  // сектор. Иначе «Длинное лезвие» расширяет уже начатый взмах, но не даёт ему
  // начаться по цели между базовым и увеличенным радиусом.
  if (w.type === 'melee'){
    const normal=w.id==='wpn.sword' ? ordinaryWarriorSwingRange() : w.reach*D.arc*D.longBladeRange*warriorNextSwingRangeMul();
    return normal+(allowEmptyThrone&&w.id==='wpn.sword'&&G.player.emptyThroneReady?80:0);
  }
  if (w.id === 'wpn.bow') return w.speed*D.projSpd*w.life*D.arrowFlight+60;
  return w.type === 'orb' ? 430 : 520;
}

/* Ближайшая цель в радиусе. Расстояние меряем до края врага,
   иначе крупные боссы «не достаются» вплотную. */
function findTarget(range){
  const p = G.player;
  let best = null, bd = Infinity;
  for (const e of G.enemies){
    const d = dist(e,p) - e.r;
    if (d < range && d < bd){ bd = d; best = e; }
  }
  return best;
}

/* Один канонический путь для обычной и мини-сферы Мультипликации. Мини-сфера
   меньше только визуально и по AoE; скорость, дальность и модификаторы те же. */
const ACCELERATED_ARROW_TIME = 0.35;
const ACCELERATED_ARROW_TRAIL_LENGTH = 22;

function acceleratedArrowTrailActive(s){
  return !!(s && s.playerArrow && D.acceleratedArrow > 0 && s.age >= ACCELERATED_ARROW_TIME);
}

/* Синий хвост — только индикатор уже активного бонуса «Разогнанных стрел».
   Он рисуется непосредственно за текущей стрелой и не создаёт частицы в G.fx,
   поэтому сотни стрел не раздувают список эффектов. */
function drawAcceleratedArrowTrail(s){
  if (!acceleratedArrowTrailActive(s)) return false;
  const speed=Math.hypot(s.vx,s.vy);
  if (speed <= 0) return false;
  const dx=s.vx/speed, dy=s.vy/speed;
  const x1=s.x-dx*5, y1=s.y-dy*5;
  const x2=s.x-dx*ACCELERATED_ARROW_TRAIL_LENGTH, y2=s.y-dy*ACCELERATED_ARROW_TRAIL_LENGTH;
  ctx.save(); ctx.lineCap='round';
  ctx.strokeStyle='#2f8dff'; ctx.globalAlpha=0.20; ctx.lineWidth=Math.max(4,s.r*0.8);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.strokeStyle='#8bd8ff'; ctx.globalAlpha=0.72; ctx.lineWidth=Math.max(1.5,s.r*0.3);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2+dx*5,y2+dy*5); ctx.stroke();
  ctx.restore();
  return true;
}

const MIRROR_VOLLEY_PERIOD = 5;
const MIRROR_VOLLEY_DELAY = 0.10;
const MIRROR_VOLLEY_DAMAGE = 0.45;

function spawnPlayerShot(o, a, w, miniOrb=false, opts={}){
  const orb = w.type === 'orb';
  const stepEcho=!!opts.stepBeyondEcho;
  const projectileScale = miniOrb ? D.multiplierMiniArea : 1;
  let aoeScale = projectileScale, aoeBonusPct=0;
  const playerArrow=w.id==='wpn.bow';
  const oneArrowMul=playerArrow ? D.oneArrowDamage||1 : 1;
  const mirrorGhost=playerArrow && !!opts.mirrorGhost;
  const heroArrow=playerArrow && (o===G.player||stepEcho) && !miniOrb;
  const primaryHeroArrow=heroArrow && !mirrorGhost && !stepEcho;
  const satinEligible=orb && o===G.player && !miniOrb && !stepEcho;
  const eclipseEligible=orb && o===G.player && !miniOrb && !stepEcho;
  let draftBoost=false;
  if (primaryHeroArrow && amu('draftGloves') && G.player.draftReady){
    G.player.draftReady=false; draftBoost=true;
  }
  if (satinEligible && amu('satinGloves') && G.player.satinReady){
    G.player.satinReady=false; aoeBonusPct+=20;
  }
  let eclipseBoost=false;
  if (eclipseEligible && amu('eclipseBrushes') && G.player.eclipseReady){
    G.player.eclipseReady=false; eclipseBoost=true; aoeBonusPct+=25;
  }
  let returnShot=false,hunterMarkShot=false;
  if (heroArrow && !stepEcho && D.returnShot){
    G.player.returnShotN=(G.player.returnShotN||0)+1;
    returnShot=G.player.returnShotN%RETURN_ARROW_PERIOD===0;
  }
  if (heroArrow && !stepEcho && D.hunterMark){
    G.player.hunterMarkN=(G.player.hunterMarkN||0)+1;
    hunterMarkShot=G.player.hunterMarkN%HUNTER_MARK_PERIOD===0;
  }
  let shotAttackMul=mirrorGhost ? MIRROR_VOLLEY_DAMAGE*oneArrowMul :
    miniOrb ? D.multiplierMiniDamage : oneArrowMul!==1 ? oneArrowMul : undefined;
  if (eclipseBoost) shotAttackMul=(shotAttackMul===undefined?1:shotAttackMul)*0.90;
  const shot={
    x:o.x, y:o.y, a,
    vx:Math.cos(a)*w.speed*D.projSpd*(draftBoost?1.20:1), vy:Math.sin(a)*w.speed*D.projSpd*(draftBoost?1.20:1),
    r:(orb?9:5) * D.projSize * projectileScale, life:w.life*(playerArrow?D.arrowFlight:1), age:0, travel:0,
    pierce:D.pierce, chain:D.chain, hitSet:[], orb,
    mul:1, attackMul:shotAttackMul,
    aoeScale, aoeBonusPct, miniOrb, eclipseBoost, confinementPct:confinementDamagePct(), pierced:0, ricochetReleased:false,
    spriteType:orb ? 'mage' : 'arrow', playerArrow, archerArrow:playerArrow,
    secondaryArrow:false, splitReleased:false, returnShot, returningArrow:false, hunterMarkShot, mirrorGhost, oneArrowMul,
    heroDirect:o===G.player||stepEcho, weaponAttack:o===G.player||stepEcho, primaryBasic:primaryHeroArrow||satinEligible,
    copperCharged:!!(amu('copperChronometer')&&G.player.copperReady&&(primaryHeroArrow||satinEligible)),
    draftEligible:primaryHeroArrow, satinEligible, homingBonus:draftBoost?0.40:0,
    noProcs:stepEcho,noAilments:stepEcho,stepBeyondEcho:stepEcho,
  };
  if (orb && amu('zeroDistanceRing')){
    shot.x=G.player.x; shot.y=G.player.y; shot.vx=shot.vy=0; shot.travel=0;
    shot.aoeScale*=1.60;
    shot.attackMul=(shot.attackMul===undefined?1:shot.attackMul)*1.35;
    explodePlayerOrb(shot);
    return shot;
  }
  G.shots.push(shot);
  return shot;
}

/* Proc фиксируется вместе с основной сферой, но сам дочерний выстрел живёт на
   игровом времени. Поэтому пауза честно замораживает 100 мс, а setTimeout не
   может выпустить сферу поверх меню. Направление родителя сохраняется; точка
   старта берётся у Мага в момент второго выстрела, чтобы сфера выходила из него. */
function queueMultiplierMiniShot(a){
  G.delayedShots.push({fireAt:G.time + D.multiplierMiniDelay, a});
}
function queueMirrorVolley(angles){
  G.delayedShots.push({type:'mirrorVolley',fireAt:G.time+MIRROR_VOLLEY_DELAY,angles:angles.slice()});
}
function tickDelayedPlayerShots(){
  for (let i=G.delayedShots.length-1; i>=0; i--){
    const shot=G.delayedShots[i];
    if (shot.fireAt > G.time + 1e-9) continue;
    G.delayedShots.splice(i,1);
    if (shot.type==='mirrorVolley'){
      if (G.weapon.id==='wpn.bow')
        for (const a of shot.angles) spawnPlayerShot(G.player,a,G.weapon,false,{mirrorGhost:true});
    } else if (G.weapon.type === 'orb') spawnPlayerShot(G.player,shot.a,G.weapon,true);
  }
}

function tickAttackEchoes(){
  for (let i=G.attackEchoes.length-1;i>=0;i--){
    const echo=G.attackEchoes[i];
    if (echo.fireAt>G.time+1e-9) continue;
    G.attackEchoes.splice(i,1);
    const e=echo.target;
    if (!e || e.dead || e.hp<=0) continue;
    damage(e,echo.src);
    G.fx.push({t:'ring',x:e.x,y:e.y,r:e.r,max:e.r+24,life:0.22,col:'#6fb3ff'});
    statusText(e,'ЭХО','#6fb3ff');
  }
}

function queueStepBeyondEcho(src){
  G.stepBeyondEchoes.push({fireAt:G.time+0.10,x:src.x,y:src.y,aim:src.aim,
    echoBladeWave:!!src.echoBladeWave});
}
function tickStepBeyondEchoes(){
  for (let i=G.stepBeyondEchoes.length-1;i>=0;i--){
    const echo=G.stepBeyondEchoes[i];
    if (echo.fireAt>G.time+1e-9) continue;
    G.stepBeyondEchoes.splice(i,1);
    attack({x:echo.x,y:echo.y,aim:echo.aim,stepBeyondEcho:true,echoBladeWave:echo.echoBladeWave});
  }
}

function releaseTitansWave(main,dealt){
  if (!amu('titansHands') || G.weapon.id!=='wpn.sword' || !main || !(dealt>0)) return 0;
  const before=G.stats.damage;
  nova(main.x,main.y,ordinaryWarriorSwingRange(),dealt*0.60,'#ff8b3d',{
    mitigate:true,exclude:main,skipDead:true,skipConstellation:true,
  });
  return G.stats.damage-before;
}

/* src — откуда бьём. Пусто значит сам игрок; копия «Чёрного зеркала» подставляет
   себя и стреляет тем же оружием с теми же характеристиками. */
function attack(src){
  const p = G.player, w = G.weapon;
  const o = src || p;
  const stepEcho=!!(src&&src.stepBeyondEcho);
  const confinementPct=confinementDamagePct();
  const damageConditions=w.type==='melee'?damageConditionSnapshot(p):null;
  const ang = o.aim;                                              // направление задаёт автозахват
  if (!src){
    if (amu('stepBeyond') && p.stepBeyondReady){
      p.stepBeyondReady=false;
      queueStepBeyondEcho({x:p.x,y:p.y,aim:p.aim,
        echoBladeWave:w.id==='wpn.sword'&&warriorNextSwingStep(p)===3});
    }
    p.atkCd = currentAttackCooldown();
    if (amu('copperChronometer')) p.copperNoAttackT=0;
  }

  if (w.type === 'melee'){
    if (w.id==='wpn.sword' && (!src || stepEcho)) playWarriorAttackSound();
    const baseReach = w.reach * D.arc,
      bladeStep = stepEcho&&src.echoBladeWave ? 3 : !src&&w.id==='wpn.sword' ? warriorNextSwingStep(p) : 0;
    if (bladeStep) p.bladeN=(p.bladeN||0)+1;
    const stepRange = D.threeStep && bladeStep ? 1+THREE_STEP_RANGE_BONUSES[bladeStep-1] : 1;
    const bladeWave = bladeStep === 3;
    const throneCharged=!!(!src&&w.id==='wpn.sword'&&p.emptyThroneReady);
    const throneBoost=throneCharged&&!bladeWave;
    if (throneCharged){
      p.emptyThroneReady=false; p.emptyThroneT=0; G.amuT.emptyThroneSeal=2;
    }
    const reach = baseReach * D.longBladeRange * stepRange+(throneBoost?80:0), arc = w.arc * D.arc;
    if (bladeWave){
      /* Воин проигрывал не по урону: контрольная комната показывала нормальный
         DPS, но бот стабильно погибал на 1–3 этажах из-за невозможности разорвать
         контакт. Поэтому каждый третий взмах заменяет сектор круговой волной —
         урон не удваивается, зато вокруг героя снова появляется пространство. */
      const waveR = baseReach * 1.45 * D.warriorWaveRadius * (D.deadlyRadius?1.8:1) * stepRange;
      let groundbreakerWave = false;
      if (!stepEcho && D.groundbreaker){
        p.groundbreakerWaveN=(p.groundbreakerWaveN||0)+1;
        groundbreakerWave=p.groundbreakerWaveN%3===0;
      }
      let waveHits = 0, titanMain=null, titanDealt=0;
      G.fx.push({t:'ring', x:o.x, y:o.y, r:18, max:waveR, life:0.22, col:'#ffd24a'});
      const waveTargets=sortedEnemyTargets(o,G.enemies,(e,d)=>d<=waveR+e.r);
      for (let wi=0;wi<waveTargets.length;wi++){
        const e=waveTargets[wi];
        waveHits++;
        const dealt=damage(e, {warriorMelee:true,directMelee:true,direct:true,heroDirect:!src||stepEcho,
          weaponAttack:!src||stepEcho,primaryBasicHit:!src&&wi===0,copperCharged:!src&&p.copperReady,
          confinementPct,noProcs:stepEcho,noAilments:stepEcho,noEcho:stepEcho,...damageConditions});
        if (wi===0){ titanMain=e; titanDealt=dealt; }
        const a = Math.atan2(e.y-o.y, e.x-o.x), force = 520 * D.warriorWaveKnock * knockbackScale(e);
        if (!stepEcho){ e.kb.x += Math.cos(a)*force; e.kb.y += Math.sin(a)*force;
        e.ail.dizzy = Math.max(e.ail.dizzy, 0.75*D.ailDur); }
        if (!stepEcho && D.swordmaster && G.lvl >= 20 && (e.kind === 'norm' || e.kind === 'elite'))
          e.ail.stun = Math.max(e.ail.stun, 0.40*D.ailDur);
      }
      if (!src) releaseTitansWave(titanMain,titanDealt);
      if (!stepEcho && D.guardian && waveHits >= 2 && p.guardianCd <= 0){
        p.barrier = Math.max(p.barrier, D.life*0.08); p.guardianCd = 3;
        G.fx.push({t:'ring', x:p.x, y:p.y, r:p.r, max:p.r+24, life:0.45, col:'#5ec2e0'});
        G.fx.push({t:'txt', x:p.x, y:p.y-30, s:'БАРЬЕР СТРАЖА', life:0.9, col:'#5ec2e0'});
      }
      if (!stepEcho && D.livingFortress){
        p.barrier=Math.max(p.barrier,D.life*0.03);
        G.fx.push({t:'ring',x:p.x,y:p.y,r:p.r,max:p.r+20,life:0.35,col:'#9ad06f'});
        G.fx.push({t:'txt',x:p.x,y:p.y-30,s:'ЖИВАЯ КРЕПОСТЬ',life:0.8,col:'#9ad06f'});
      }
      if (!stepEcho && groundbreakerWave) spawnGroundbreakerCrack(o.x,o.y,waveR);
    } else {
      G.fx.push({t:'arc', x:o.x, y:o.y, a:ang, arc, r:reach, life:0.16});
      const swingTargets=sortedEnemyTargets(o,G.enemies,(e,d)=>{
        if (d > reach + e.r) return false;
        let da = Math.atan2(e.y-o.y, e.x-o.x) - ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));               // нормализуем угол
        return Math.abs(da) < arc/2;
      });
      let titanDealt=0;
      for (let si=0;si<swingTargets.length;si++){
          const e=swingTargets[si];
          const dealt=damage(e, {warriorMelee:true,directMelee:true,direct:true,heroDirect:!src||stepEcho,
            weaponAttack:!src||stepEcho,attackMul:throneBoost?1.35:undefined,
            primaryBasicHit:!src&&si===0,copperCharged:!src&&p.copperReady,confinementPct,
            noProcs:stepEcho,noAilments:stepEcho,noEcho:stepEcho,...damageConditions});
          if (si===0) titanDealt=dealt;
      }
      if (!src) releaseTitansWave(swingTargets[0],titanDealt);
    }
  } else {
    const n = D.projN, spread = D.shotgun ? 0.035 : 0.16;   // дробовик стягивает залп в пучок
    const mirrorAngles = [];
    if (w.id==='wpn.bow' && (!src || stepEcho)) playArcherShotSound();
    if (w.id==='wpn.wand' && (!src || stepEcho)) playMageAttackSound();
    for (let i = 0; i < n; i++){
      const a = ang + (i - (n-1)/2) * spread;
      spawnPlayerShot(o,a,w,false,{stepBeyondEcho:stepEcho});
      if (!src && w.id==='wpn.bow') mirrorAngles.push(a);
      // Только основные сферы игрока бросают proc; копии и сами мини-сферы не
      // создают рекурсию. Успех ставит отдельный выстрел через 100 мс игрового
      // времени — мини-сфера летит следом, а не появляется в том же кадре.
      if (!src && w.type === 'orb' && D.multiplierMiniChance > 0 && Math.random() < D.multiplierMiniChance)
        queueMultiplierMiniShot(a);
    }
    if (!src && w.id==='wpn.bow' && D.mirrorVolley){
      p.mirrorVolleyN=(p.mirrorVolleyN||0)+1;
      if (p.mirrorVolleyN%MIRROR_VOLLEY_PERIOD===0) queueMirrorVolley(mirrorAngles);
    }
  }
}

function releaseSplitArrows(s){
  if (!s || !D.splitArrow || !s.playerArrow || s.secondaryArrow || s.splitReleased) return 0;
  s.splitReleased=true;
  const speed=Math.max(1,Math.hypot(s.vx,s.vy)), baseA=Number.isFinite(s.a)?s.a:Math.atan2(s.vy,s.vx);
  for (const side of [-1,1]){
    const a=baseA+side*SPLIT_ARROW_ANGLE;
    G.shots.push({
      x:s.x,y:s.y,a,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
      r:Math.max(2,s.r*0.82),life:1.10,age:0,travel:0,
      pierce:0,chain:0,hitSet:s.hitSet.slice(),orb:false,mul:1,attackMul:SPLIT_ARROW_DAMAGE,pierced:0,
      spriteType:'arrow',playerArrow:false,archerArrow:true,secondaryArrow:true,splitShard:true,
      splitReleased:true,ricochetReleased:true,returnShot:false,returningArrow:false,hunterMarkShot:false,
      heroDirect:!!s.heroDirect,weaponAttack:!!s.weaponAttack,primaryBasic:false,draftEligible:false,
    });
  }
  burst(s.x,s.y,4,'#7fd6ff',120,3,0.24);
  return 2;
}

function beginReturningArrow(s){
  if (!s || !s.returnShot || s.returningArrow || s.secondaryArrow) return false;
  s.returnShot=false; s.returningArrow=true; s.secondaryArrow=true; s.playerArrow=false; s.archerArrow=true;
  s.pierce=0; s.chain=0; s.hitSet=[]; s.mul=1; s.attackMul=RETURN_ARROW_DAMAGE*(s.oneArrowMul||1);
  s.ricochetReleased=true; s.splitReleased=true; s.hunterMarkShot=false; s.life=4.5;
  s.primaryBasic=false; s.draftEligible=false;
  burst(s.x,s.y,4,'#ffb340',120,3,0.24);
  return true;
}

/* Осколочный рикошет срабатывает один раз на исходный снаряд. Он намеренно
   создаёт отдельные короткоживущие снаряды, а не перенаправляет основной:
   обычные отскоки остаются последовательной механикой, рикошет — ветвлением.
   hitSet наследуется, а chain, pierce и повторный рикошет обнулены, поэтому
   число дополнительных снарядов всегда ограничено потолком карточки. */
function releaseRicochetShards(s, sourceMul, sourceAttackMul, enemyGrid=null){
  if (!s || s.minion || s.secondaryArrow || s.ricochetShard || s.ricochetReleased || D.ricochet <= 0) return 0;
  s.ricochetReleased = true;
  const candidates=enemyGrid?enemyAreaCandidates(enemyGrid,s.x,s.y,RICOCHET_SHARD_RANGE):G.enemies;
  const targets=nearestEnemies(s,D.ricochet,
    (e,d)=>e.hp>0&&!s.hitSet.includes(e)&&d<=RICOCHET_SHARD_RANGE,candidates);
  const count=targets.length;
  const speed = Math.max(1, Math.hypot(s.vx,s.vy));
  for (let i=0; i<count; i++){
    const target=targets[i], d=dist(target,s), a=Math.atan2(target.y-s.y,target.x-s.x);
    G.shots.push({
      x:s.x, y:s.y, a,
      vx:Math.cos(a)*speed, vy:Math.sin(a)*speed,
      r:Math.max(2,s.r*0.72), life:Math.min(1.75,d/speed+0.20),
      pierce:0, chain:0, hitSet:s.hitSet.slice(), orb:false,
      mul:sourceMul*RICOCHET_SHARD_DAMAGE, attackMul:sourceAttackMul, pierced:0,
      ricochetShard:true, ricochetReleased:true, shardTarget:target,
      spriteType:s.spriteType,playerArrow:false,archerArrow:!!(s.archerArrow||s.playerArrow),secondaryArrow:true,
      splitReleased:true,returnShot:false,returningArrow:false,hunterMarkShot:false,
      heroDirect:!!s.heroDirect,weaponAttack:!!s.weaponAttack,primaryBasic:false,draftEligible:false,
    });
  }
  if (count) burst(s.x,s.y,4,'#6fb3ff',130,3,0.28);
  return count;
}

function rollMissedShotItems(s){
  if (!s || !s.hitSet || s.hitSet.length) return false;
  const p=G.player;
  if (s.draftEligible && amu('draftGloves') && !p.draftReady && Math.random()<0.01){
    p.draftReady=true;
    G.fx.push({t:'txt',x:p.x,y:p.y-30,s:tr('Перчатки Сквозняка'),life:0.9,col:'#89bddd'});
    return true;
  }
  if (s.satinEligible && amu('satinGloves') && !p.satinReady && Math.random()<0.01){
    p.satinReady=true;
    G.fx.push({t:'txt',x:p.x,y:p.y-30,s:tr('Сатиновые Перчатки'),life:0.9,col:'#b98dde'});
    return true;
  }
  return false;
}
