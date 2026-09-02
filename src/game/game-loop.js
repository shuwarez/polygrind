/* ---------- 8. ГЛАВНЫЙ ЦИКЛ ---------- */
let last = performance.now();
function loop(now){
  /* Следующий кадр ставится в очередь заранее. Даже неожиданная ошибка update или
     render теперь попадёт в диагностику, но не оборвёт RAF-цепочку навсегда. */
  requestAnimationFrame(loop);
  try {
  /* Некоторые WebView после тяжёлой первичной загрузки один раз
     присылают RAF-метку чуть меньше performance.now(). Отрицательный dt разворачивал
     анимацию кольца призыва внутрь и Canvas отвергал отрицательный радиус. */
  const rawFrameMs = Math.max(0, now-last);
  const dt = Math.min(0.05, rawFrameMs/1000); last = now;
  diagTick(rawFrameMs,now);
  if (G){
    tickPlayerDamageFeedback(dt);
    if (G.hitStop > 0) G.hitStop=Math.max(0,G.hitStop-dt);
    else if (!G.paused && !G.over && !G.pending) update(dt);
  }
  if (G) render();
  if (menuMode) menuTick(dt);
  } catch(error){ diagFrameError(error,'main_loop'); }
}

function update(dt){
  const p = G.player, b = G.bag, k = G.keys;
  G.time += dt;
  tickDelayedPlayerShots();
  tickAttackEchoes();
  tickStepBeyondEchoes();

  /* --- Движение игрока: две схемы управления --- */
  let mx = 0, my = 0;
  if (G.control === 'mouse'){
    // Персонаж всё время бежит к курсору. Мёртвая зона вокруг него нужна,
    // чтобы можно было осознанно стоять на месте — иначе «стойка» недостижима,
    // а от неё зависит cond.while_still и прицельная стрельба.
    const mouseWorld=screenToWorld(G.mouse.x,G.mouse.y,p);
    const dx = mouseWorld.x-p.x, dy = mouseWorld.y-p.y;
    const d = Math.hypot(dx, dy);
    if (d > MOUSE_DEADZONE){ mx = dx/d; my = dy/d; }
  } else {
    mx = (k['d']||k['arrowright']?1:0) - (k['a']||k['arrowleft']?1:0);
    my = (k['s']||k['arrowdown'] ?1:0) - (k['w']||k['arrowup']  ?1:0);
    const len = Math.hypot(mx,my) || 1; mx/=len; my/=len;
  }
  p.moving = (mx || my) !== 0;
  if (amu('heartSecond')){
    const rate=p.moving?-0.25:0.10;
    p.heartSecondCharge=clamp((p.heartSecondCharge||0)+rate*dt,0,0.60);
  } else p.heartSecondCharge=0;
  if (p.moving){
    p.faceX = mx; p.faceY = my;                         // запоминаем направление для рывка
    if (mx) p.spriteFace = mx < 0 ? -1 : 1;             // спрайт только зеркалится, не кувыркается за целью
  }
  p.stillT = p.moving ? 0 : p.stillT + dt;
  p.moveT  = p.moving ? p.moveT + dt : 0;            // РАЗГОН и МАРАФОНЕЦ считают непрерывный бег
  const marchingWas=!!p.marchingActive;
  p.marchingActive=!!(amu('marchingGreaves') && p.moving && p.moveT>=2);
  if (p.marchingActive!==marchingWas) recalc();
  if (amu('copperChronometer') && !p.copperReady){
    p.copperNoAttackT=(p.copperNoAttackT||0)+dt;
    if (p.copperNoAttackT>=2) p.copperReady=true;
  } else if (!amu('copperChronometer')){
    p.copperNoAttackT=0; p.copperReady=false;
  }
  if (p.tallyT>0){
    p.tallyT=Math.max(0,p.tallyT-dt);
    if (p.tallyT===0) recalc();
  }
  const hobnailedWas=!!p.hobnailedActive;
  p.hobnailedActive=!!(amu('hobnailedSoles') && !p.moving && p.dash<=0 && p.stillT>=0.8);
  if (p.hobnailedActive!==hobnailedWas) recalc();
  if (amu('trailfinders') && !p.trailfinderActive){
    p.trailfinderT=Math.min(5,(p.trailfinderT||0)+dt);
    if (p.trailfinderT>=5){ p.trailfinderActive=true; recalc(); }
  } else if (!amu('trailfinders')){
    if (p.trailfinderActive){ p.trailfinderActive=false; recalc(); }
    p.trailfinderT=0;
  }
  p.killT = Math.max(0, p.killT - dt);
  p.cheatCd = Math.max(0, p.cheatCd - dt);
  p.healCd  = Math.max(0, p.healCd  - dt);
  p.guardianCd = Math.max(0, p.guardianCd - dt);
  if (p.reserveBarrierT>0){
    p.reserveBarrierT=Math.max(0,p.reserveBarrierT-dt);
    if (p.reserveBarrierT===0) p.reserveBarrier=0;
  }
  p.bossSlowT = Math.max(0, (p.bossSlowT||0) - dt);
  if (p.bossSlowT <= 0) p.bossSlowMul=1;
  p.bossTrailCd = Math.max(0, (p.bossTrailCd||0) - dt);
  if (p.bossBurnT > 0){
    const burnBefore = p.bossBurnT;
    p.bossBurnT = Math.max(0, p.bossBurnT - dt);
    p.bossBurnTick -= dt;
    while (p.bossBurnTick <= 0 && burnBefore > 0){
      p.bossBurnTick += 1;
      hurt(D.life*0.05, false, false, p.bossBurnCause || 'ГОРЕНИЕ РОГАТОГО ТИРАНА', 'boss');
    }
  }
  tickBoss20Dots(dt);
  tickElitePlayerEffects(dt);
  /* Всё, что разгоняет по условию, живёт в D.mspd и D.aspd, а условия меняются
     в кадре. Пересчёт зовём только на ПЕРЕКЛЮЧЕНИИ, а не каждый кадр: recalc()
     тяжёлый, и гонять его шестьдесят раз в секунду ради пары множителей незачем. */
  const wasKill = p.spdKill > 0, wasSprint = p.sprintT > 0, wasCheatSpeed = p.cheatSpeedT > 0, wasMove = p.dashMoving,
        wasSwift = p.swiftT > 0, wasLow = p.lowHp;
  p.spdKill = Math.max(0, (p.spdKill||0) - dt);
  p.sprintT = Math.max(0, (p.sprintT||0) - dt);
  p.cheatSpeedT = Math.max(0, (p.cheatSpeedT||0) - dt);
  p.swiftT  = Math.max(0, (p.swiftT||0)  - dt);
  p.dashMoving = p.moving;
  p.lowHp   = p.hp/D.life < 0.30;
  if ((p.spdKill > 0) !== wasKill || (p.sprintT > 0) !== wasSprint || (p.cheatSpeedT > 0) !== wasCheatSpeed || (amu('runner') && p.moving !== wasMove) ||
      (p.swiftT > 0) !== wasSwift || p.lowHp !== wasLow) recalc();
  p.predT   = Math.max(0, (p.predT||0)   - dt);      // ГЛАЗ ХИЩНИКА

  if (D.timeDebt && (p.timeDebtT>0 || p.timeDebtCoolingT>0)){
    const timeDebtWasActive=p.timeDebtT>0;
    p.timeDebtT=Math.max(0,p.timeDebtT-dt);
    p.timeDebtCoolingT=Math.max(0,p.timeDebtCoolingT-dt);
    if (p.timeDebtT===0) p.timeDebtPct=0;
    if (timeDebtWasActive && p.timeDebtT===0) recalc();
  }

  let sp = D.mspd;                                   // разгон уже внутри, см. recalc()
  if (amu('heartSecond') && p.heartSecondCharge>1e-9) sp*=0.75;
  if (p.bossSlowT > 0) sp *= p.bossSlowMul || 0.30;
  if (p.eliteGuardSlowT > 0) sp *= Math.max(0.10,1-0.10*(p.eliteGuardSlowStacks||0));
  if (amu('marathon')) sp *= 1 + Math.min(0.30, Math.floor(p.moveT/3)*0.03);
  if (amu('panic') && p.hp/D.life < 0.30) sp *= 1.60;
  if (amu('siege') && p.stillT > 1.5) sp *= 0.5;     // цена осадного огня
  const dashing=p.dash>0;
  let dashDamageConditions=null;
  if (dashing){
    sp *= D.dashSpeedMul; p.dash -= dt;
    if (!p.moving){ mx = p.faceX; my = p.faceY; }     // рывок с места — в последнюю сторону                                       // рывок = кратковременный разгон
    if (D.dashDmg) for (const e of G.enemies){                     // ТАРАННЫЙ РЫВОК
      if (p.dashHits.includes(e) || dist(e,p) > p.r + e.r + 12) continue;
      if (!dashDamageConditions) dashDamageConditions=damageConditionSnapshot(p);
      p.dashHits.push(e); damage(e, {mul:1.2,...dashDamageConditions}); e.ail.dizzy = 2*D.ailDur;
      burst(e.x, e.y, 6, '#ffb340', 200, 3, 0.4);
    }
  }
  p.inv = Math.max(0, p.inv - dt);
  if (p.counterTempoT > 0){
    p.counterTempoT=Math.max(0,p.counterTempoT-dt);
    if (p.counterTempoT===0){ p.counterTempoPct=0; recalc(); }
  }
  if (p.ironFuryT > 0){
    p.ironFuryT=Math.max(0,p.ironFuryT-dt);
    if (p.ironFuryT===0){ p.ironFuryPct=0; recalc(); }
  }
  if (p.overheatedT > 0){
    p.overheatedT=Math.max(0,p.overheatedT-dt);
    if (p.overheatedT===0){ p.overheatedPct=0; recalc(); }
  }
  if (p.dashN < D.dashMax){
    p.dashCd = Math.max(0, p.dashCd - dt);
    if (p.dashCd <= 0){
      p.dashN++;
      p.dashCd = p.dashN < D.dashMax ? D.dashCd : 0;
    }
  } else p.dashCd = 0;

  const oldX = p.x, oldY = p.y;
  const playerKbX=D.hobnailedActive?0:(p.vx||0), playerKbY=D.hobnailedActive?0:(p.vy||0);
  p.x = clamp(p.x + (mx*sp+playerKbX)*dt, -ARENA, ARENA);
  p.y = clamp(p.y + (my*sp+playerKbY)*dt, -ARENA, ARENA);
  if (D.hobnailedActive){ p.vx=0; p.vy=0; }
  const playerKbDecay=Math.pow(0.015,dt);
  p.vx=(p.vx||0)*playerKbDecay; p.vy=(p.vy||0)*playerKbDecay;
  if (Math.abs(p.vx)<0.5) p.vx=0; if (Math.abs(p.vy)<0.5) p.vy=0;
  const heroMoved = Math.hypot(p.x-oldX, p.y-oldY);
  recordDeadGodState();
  if (dashing && amu('shortCircuitBoots')) for (const e of G.enemies){
    if ((p.shortCircuitHits||[]).includes(e)) continue;
    const sx=p.x-oldX,sy=p.y-oldY,len2=sx*sx+sy*sy;
    const t=len2?clamp(((e.x-oldX)*sx+(e.y-oldY)*sy)/len2,0,1):0;
    const cx=oldX+sx*t,cy=oldY+sy*t;
    if (Math.hypot(e.x-cx,e.y-cy)>p.r+e.r+12) continue;
    p.shortCircuitHits.push(e);
    e.shortCircuitT=Math.max(e.shortCircuitT||0,0.6);
    e.shortCircuitSlow=e.kind==='boss'?0.80:0.60;
    statusText(e,tr('Сапоги Короткого Разряда'),'#62c9d0');
  }
  G.stats.distance += heroMoved;
  // 36 единиц пути на кадр: походка читается спокойно и не дёргается.
  /* Восемь фаз V3 проходят ту же дистанцию, что прежние четыре кадра:
     базовые герои берут каждый второй кадр, подклассы — все восемь. */
  if (heroMoved > 0.01) p.heroWalkT = ((p.heroWalkT||0) + heroMoved/18) % 8;

  /* --- Восстановление --- */
  // Магазинное «Быстрое лечение» срабатывает дискретно раз в пять секунд и не
  // восстанавливает героя выше половины здоровья. Последний тик обрезается точно
  // по границе, поэтому высокая прокачка не может перескочить потолок.
  const fastHealLimit = D.life * 0.5;
  if (D.regen){
    p.fastHealT -= dt;
    while (p.fastHealT <= 0){
      if (p.hp < fastHealLimit) heal(Math.min(D.regen, fastHealLimit - p.hp));
      p.fastHealT += 5;
    }
  } else p.fastHealT = 5;
  if (D.guardianHeal > 0){
    p.guardianHealT -= dt;
    while (p.guardianHealT <= 0){ heal(D.guardianHeal); p.guardianHealT += 5; }
  } else p.guardianHealT = 5;
  if (D.respite && !G.portal){
    const respiteLimit=D.life*0.60;
    const wasActive=p.respiteT>=4;
    p.respiteT=Math.min(4,(p.respiteT||0)+dt);
    if (p.respiteT>=4){
      if (!wasActive) p.respiteHealT=3;
      else if (p.hp<respiteLimit) {
        p.respiteHealT-=dt;
        while (p.respiteHealT<=0 && p.hp<respiteLimit){
          heal(Math.min(D.life*0.05,respiteLimit-p.hp)); p.respiteHealT+=3;
        }
        if (p.hp>=respiteLimit) p.respiteHealT=3;
      } else p.respiteHealT=3;
    }
  } else {
    p.respiteT=0; p.respiteHealT=3;
  }
  if (G.bloodT > 0) G.bloodT = Math.max(0, G.bloodT - dt);         // КРОВНЫЕ УЗЫ
  if (D.dread) tickDreadLeech(dt);
  else if (p.leechPool > 0){                                       // обычное вытягивание течёт ~2 сек
    const v = Math.min(p.leechPool, Math.max(6, p.leechPool*1.2) * dt);
    heal(v);
    p.leechPool -= v;
  }
  if (b.has('autoHeal') && p.hp/D.life < 0.3 && p.healCd <= 0){
    heal(D.life*0.25); p.healCd = 20;
    G.fx.push({t:'txt', x:p.x, y:p.y-30, s:'автолечение', life:1, col:'#4fd1c5'});
  }

  updateOrbits(dt);
  if (G.arcaneTraces.length) tickArcaneTraces(dt);
  if (G.arcaneMines.length) tickArcaneMines(dt);
  if (G.repeatDetonations.length) tickRepeatDetonations(dt);
  if (G.groundbreakerCracks.length) tickGroundbreakerCracks(dt);
  if (G.sparkSigils.length) tickSparkSigils(dt);

  /* --- Атака --- */
  p.atkCd -= dt;
  tickEmptyThrone(dt);
  G.target = findTarget(attackRange());                            // цель обновляем каждый кадр
  if (G.target){
    p.aim = Math.atan2(G.target.y - p.y, G.target.x - p.x);        // корпус доворачивается к цели
    p.spriteFace = Math.cos(p.aim) < 0 ? -1 : 1;
    if (p.atkCd <= 0 && !G.weapon.noAttack) attack();
  }

  /* --- Амулеты: всё, что живёт на таймере --- */
  if (hasAnyAmulet()) tickAmulets(dt);
  if (amu('lava') || amu('frost')) tickTrail(dt);
  if (G.boils.length) tickBoils(dt);
  if (G.acidPools.length) tickAcidPools(dt);
  if (G.eliteAcidPools.length) tickEliteAcidPools(dt);

  /* --- Появление врагов волнами --- */
  G.spawnT -= dt;
  // Потолок одновременно живых: 500. Раньше было 64, и он упирался начиная
  // примерно с 15 этажа — комната на 60-м выглядела так же, как на 20-м,
  // а вся глубина уходила в продолжительность, а не в давление.
  // Порог проверяется ДО подсыпки пачки, поэтому фактический пик чуть выше.
  // Пачку подняли до 6-14: набирать пятьсот по шесть штук игрок не дождётся.
  if (!regularEnemySpawnsSuppressed() && G.spawnQueue > 0 && G.spawnT <= 0 && G.enemies.length < 500){
    // Пачка поменьше при вчетверо более частых волнах: 8-16 за раз вываливали
    // весь этаж за полторы секунды, и «поток» превращался в один хлопок.
    const batch = Math.min(G.spawnQueue, rndi(4,9));
    for (let i = 0; i < batch; i++) spawnEnemy();
    G.spawnQueue -= batch;
    // Пауза между волнами: было max(0.35, 2.0 - этаж*0.05), то есть на первых
    // этажах почти две секунды простоя. Стало вчетверо плотнее — этаж больше
    // не «подаётся порциями», а идёт сплошным потоком. Дальняя точка появления
    // это компенсирует: враги успевают дойти, а не сваливаются на голову.
    G.spawnT = Math.max(0.15, 0.55 - G.floor*0.015);
  }

  /* --- Логика врагов --- */
  const slowAura = D.slowAura;
  /* Один проход без временного filter(): одновременно собираем источники
     охлаждения, проверяем Инферно и Знамя. Буфер очищается после enemy-фазы. */
  const frameScratch=scanEnemyLogicFrame();
  // Пачки: аффиксы, которые распоряжаются группой целиком (прыжок одного из своих)
  for (const pk of G.packs) if (pk.members.length)
    for (const a of pk.aff) if (a.packTick) a.packTick(pk, dt);
  // packTick уже закончил возможные прыжки: сетка начинается с актуальных позиций.
  buildEnemyLogicFrame(frameScratch);
  const chillGrid=frameScratch.activeChillGrid;
  const enemyLogicGrid=frameScratch.activeInfernoGrid;
  ACTIVE_ENEMY_LOGIC_GRID=enemyLogicGrid;
  for (let i = G.enemies.length-1; i >= 0; i--){
    const e = G.enemies[i];
    e.hit = Math.max(0, e.hit - dt); e.rot += dt*0.8;
    e.noDmgT += dt; e.rage = Math.max(0, e.rage - dt);
    e.shortCircuitT=Math.max(0,(e.shortCircuitT||0)-dt);

    // Тики негативных эффектов
    for (const key in e.ail) if (e.ail[key] > 0) e.ail[key] -= dt;
    // ЧУМА: три дискретных тика через 1, 2 и 3 секунды. Урон вычисляется из
    // текущего HP непосредственно перед каждым тиком, а не из запаса на момент
    // заражения: 1000 → 850 → 722,5 → 614,1 при трёх успешных тиках.
    if (e.plague){
      const pl = e.plague;
      pl.life -= dt; pl.tick -= dt;
      while (pl.tick <= 0 && pl.hits < 3+(pl.unhealedExtra||0)){
        pl.tick += 1; pl.hits++;
        const pv = e.hp * PLAGUE_PCT;
        applyDamage(e, pv, false, true);
        pushDamageNumber(e,pv,false,'#b6df55',0,-16,'plague',0.7);
      }
      if (pl.hits >= 3+(pl.unhealedExtra||0) || pl.life <= 0) e.plague = null;
    }
    tickMothBurns(e,dt);
    // Все три типа урона со временем тикают и утекают по одной формуле
    for (const type in e.dots){
      const d = e.dots[type];
      if (d.dps <= 0) continue;
      const v = d.dps * dt;
      const minionShare = d.dps > 0 ? clamp((d.minionDps || 0)/d.dps, 0, 1) : 0;
      applyDamage(e, v, false, true, minionShare);
      e.dotAcc[type] += v;
      d.life=Math.max(0,(d.life||0)-dt);
      if ((d.unhealedPause||0)>0) d.unhealedPause=Math.max(0,d.unhealedPause-dt);
      else {
        const k = Math.min(1, dt / d.dur);            // утечка стаков
        d.dps -= d.dps * k; d.minionDps = Math.max(0, (d.minionDps || 0) * (1-k)); d.n -= d.n * k;
      }
      if (d.dps < 0.02){ d.dps = 0; d.minionDps = 0; d.n = 0; d.life=0; d.unhealedExtra=0; d.unhealedPause=0; }
    }
    // Урон со временем копится и всплывает раз в 0.4 сек своим цветом:
    // огонь красным, яд зелёным, кровотечение багровым
    e.dotT -= dt;
    if (e.dotT <= 0){
      e.dotT = 0.4;
      if (e.dotAcc.fire>=1) pushDamageNumber(e,e.dotAcc.fire,false,'#ff4a2f',-14,-4,'dotFire',0.7);
      if (e.dotAcc.poison>=1) pushDamageNumber(e,e.dotAcc.poison,false,'#8be04e',14,-4,'dotPoison',0.7);
      if (e.dotAcc.bleed>=1) pushDamageNumber(e,e.dotAcc.bleed,false,'#e0405a',0,-4,'dotBleed',0.7);
      e.dotAcc.fire = e.dotAcc.poison = e.dotAcc.bleed = 0;
    }
    // ИНФЕРНО: горящий враг раз в полсекунды поджигает соседей
    if (D.inferno && e.dots.fire.dps > 0){
      e.infT -= dt;
      if (e.infT <= 0){
        e.infT = 0.5;
        for (const o2 of enemyAreaCandidates(enemyLogicGrid,e.x,e.y,D.infernoR)){
          if (o2 === e || o2.dots.fire.dps > 0) continue;
          if (dist(o2,e) > D.infernoR + o2.r) continue;
          addDot(o2, 'fire', e.dots.fire.dps*0.5, 3*D.ailDur,
            e.dots.fire.dps > 0 ? e.dots.fire.minionDps/e.dots.fire.dps : 0);
          burst(o2.x, o2.y, 4, '#ff7a2f', 90, 3, 0.4);
        }
      }
    }

    if (e.hp <= 0){ killEnemy(e, i); continue; }
    tickEnemyAttackVisual(e,dt);
    // РАЗДЕЛЯЮЩИЕСЯ: порог половины здоровья проверяем тут же, до всего остального
    if (e.pack && e.pack.has.split && !e.didSplit && e.hp <= e.maxHp*0.5) packSplit(e);

    // Скорость с учётом охлаждения, ауры замедления и оглушения
    let spd = e.spd;
    if (e.kind === 'boss' && e.bossId === 'goat') spd = D.mspd;
    // Под знаменем вся комната быстрее и злее — это и есть повод убивать босса первым
    const flag = G.banner && e.kind !== 'boss';
    if (flag) spd *= 1.30;
    let edmg = e.dmg * (flag ? 1.20 : 1);
    let aspdMul = 1;
    if (e.pack){ const pm=packMods(e,frameScratch.packMods);spd*=pm.spd;edmg*=pm.dmg;aspdMul*=pm.aspd; }
    if (e.rage > 0){ spd *= 1.3; edmg *= 1.3; }        // след мстителей: чужая смерть разогнала
    if (e.shortCircuitT>0) spd*=e.shortCircuitSlow||0.60;
    if (e.ail.chill > 0) spd *= 1 - CHILL_SLOW;
    // АУРА ОХЛАЖДЕНИЯ: соседи охлаждённого тоже вязнут.
    // Аура только замедляет и сам статус не накладывает. Если бы накладывала,
    // один прок расползся бы по всей комнате цепочкой (A морозит B, B морозит C),
    // и каждый враг получил бы +10% к принимаемому урону бесплатно и навсегда.
    e.frost = false;
    if (e.ail.chill <= 0 && chillGrid){
      e.frost=chillAuraAffectsEnemy(e,chillGrid);
      if (e.frost) spd *= 1 - CHILL_AURA_SLOW;
    }
    if (slowAura && dist(e,p) < D.slowAuraR) spd *= 0.75;
    if (e.ail.dizzy > 0) spd *= 0.5;                     // головокружение после отбрасывания
    if (e.ail.stun > 0 || e.ail.freeze > 0) spd = 0;      // оглушение и заморозка держат на месте

    // Успешная провокация Голема крови или Костяной вызов удерживают конкретного
    // монстра на ударившем приспешнике. Без фактического срабатывания цель — игрок.
    let tgt = p, forcedMinion = e.tauntMinion;
    if (forcedMinion && (forcedMinion.hp <= 0 || G.minions.indexOf(forcedMinion)<0)){
      e.tauntMinion = null; forcedMinion = null;
    }
    if (forcedMinion) tgt = forcedMinion;
    // Тень не провоцирует всю комнату магически: её выбирают только обычные
    // враги и элиты, для которых она действительно ближе текущей цели.
    const shadow=G.worldShadow;
    const shadowCanTaunt=shadow && (e.kind==='norm' || (e.kind==='elite' && G.time<shadow.eliteUntil));
    if (shadowCanTaunt && dist(e,shadow)<dist(e,tgt)) tgt=shadow;

    // Аффиксы работают до обычного шага: таран забирает движение себе
    const moveX0 = e.x, moveY0 = e.y;
    const bossLock = e.kind === 'boss' ? tickBossSkill(e, dt) : false;
    const eliteLock = e.kind === 'elite' ? tickEliteAbility(e,dt,tgt) : false;
    // Во время замаха Демона его уникальная остановка важнее тарана или другого
    // двигательного аффикса; таймер аффикса продолжится после удара.
    let affLock = bossLock || eliteLock ? true : (e.aff.length ? tickAffixes(e, dt, tgt, edmg) : false);
    if (e.pack && packTick(e, dt, tgt, edmg)) affLock = true;   // прыжок тоже забирает движение

    let a = Math.atan2(tgt.y-e.y, tgt.x-e.x);
    if (e.madA) a += e.madA;                       // безумный идёт криво, а не по прямой
    const ranged = e.t.ranged || !!e.madRanged;
    if (affLock){ /* движением распоряжается аффикс */ }
    else if (ranged){
      // Призма держит дистанцию 260 и стреляет
      const d = dist(e,tgt);
      const dir = d > 300 ? 1 : d < 220 ? -1 : 0;
      e.x += Math.cos(a)*spd*dir*dt; e.y += Math.sin(a)*spd*dir*dt;
      e.cd -= dt;
      const attackDuration=Math.max(0.16,0.48/aspdMul);
      if (e.kind!=='boss' && e.cd>0 && e.cd<=attackDuration*0.55 && d<460 && e.ail.stun<=0)
        ensureEnemyAttackVisual(e,attackDuration);
      if (e.cd <= 0 && d < 460 && e.ail.stun <= 0){
        e.cd = 2.2 / aspdMul;
        strikeEnemyAttackVisual(e,attackDuration,0.55);
        if (e.kind==='elite' && e.eliteVariant) fireEliteRanged(e,a,edmg);
        else G.eshots.push({x:e.x, y:e.y, vx:Math.cos(a)*230, vy:Math.sin(a)*230,
          r:6, life:2.6, dmg:edmg*0.8, pk:e.pack, shotType:'shooter',
          sourceKind:e.kind,cause:enemyCause(e,'снаряд'),owner:e});
      }
    } else {
      e.x += Math.cos(a)*spd*dt; e.y += Math.sin(a)*spd*dt;
    }
    // Отбрасывание затухает
    e.x += e.kb.x*dt; e.y += e.kb.y*dt;
    e.kb.x *= 0.86; e.kb.y *= 0.86;
    // Следующие враги кадра должны видеть источник уже в его новой позиции.
    if (chillGrid && chillGrid.order.has(e)) updateEnemySpatialGridPosition(chillGrid,e);
    if (enemyLogicGrid && enemyLogicGrid.order.has(e)) updateEnemySpatialGridPosition(enemyLogicGrid,e);
    // Анимация зависит от реально пройденного пути: оглушённый враг замирает,
    // быстрый Бегун перебирает кадры чаще Ядра. Разворот только по горизонтали.
    const movedX=e.x-moveX0, movedY=e.y-moveY0, moved=Math.hypot(movedX,movedY);
    if (moved > 0.001){
      const spriteMeta=enemySpriteMeta(e);
      e.animT = (e.animT||0) + moved / (spriteMeta ? spriteMeta.stride : 18);
      if (Math.abs(movedX) > 0.01) e.spriteFace = movedX < 0 ? -1 : 1;
    }

    // Ближняя атака начинает замах на последних шагах, но кадр удара всё равно
    // переключается только в момент фактической проверки контактного урона.
    const contactD=dist(e,tgt),contactR=e.r+tgt.r;
    if (!ranged && !affLock && e.kind!=='boss' && e.ail.stun<=0 && e.ail.freeze<=0 &&
        (e.cd2||0)<=0 && contactD<contactR+Math.max(12,spd*0.16/aspdMul))
      ensureEnemyAttackVisual(e,Math.max(0.16,0.44/aspdMul));
    // Контактный урон по текущей цели
    if (!(e.bossId === 'demonqueen' && e.bossT && e.bossT.hidden) && contactD < contactR){
      e.cd2 = (e.cd2||0) - dt;
      if (e.cd2 <= 0){
        e.cd2 = 0.5 / aspdMul;
        strikeEnemyAttackVisual(e,Math.max(0.16,0.44/aspdMul),0.55);
        if (tgt === p){
          if (!(D.phasing && p.moving)){
            hurt(edmg, false, false, enemyCause(e, 'контакт'), e.kind, e);
            packDealt(e.pack, edmg);
            applyEliteContact(e);
          }
        }
        else if (tgt!==G.worldShadow) {
          // Големы каменные: 60% входящего гасится. Иначе провокация их же и убивает.
          const mit = tgt.kind.startsWith('golem') ? 0.4 : 1;
          tgt.hp -= edmg * mit; tgt.hit = 0.12;
          boilRoll(tgt);                                   // КИПЯЩАЯ КРОВЬ
          if (tgt.hp <= 0) killMinion(G.minions.indexOf(tgt));
        }
      }
    }
  }
  ACTIVE_ENEMY_LOGIC_GRID=null;
  releaseEnemyLogicFrame(frameScratch);

  // После движения врагов их позиции неизменны до конца кадра. Сетка строится
  // лениво первым фактическим взрывом свиты или снарядом и затем переиспользуется.
  frameScratch.postMoveReady=false;

  /* --- Свита: трупы, подъём и бой --- */
  if (D.hasMin){
    for (let i = G.corpses.length-1; i >= 0; i--){
      G.corpses[i].life -= dt;
      if (G.corpses[i].life <= 0) G.corpses.splice(i,1);
    }
    // Пока свита неполная — поднимаем из ближайшего трупа, а без трупов ждём таймер
    const neededKind=needKind();
    if (neededKind){
      G.raiseT += dt;
      // Оба пути подъёма идут за одно и то же время: из трупа поднимается на месте
      // трупа, без трупа — рядом с хозяином. Разного ожидания больше нет.
      if (G.raiseT >= D.minRevive){
        if (G.corpses.length){ const c = G.corpses.shift(); spawnMinion(c.x, c.y, neededKind); }
        else spawnMinion(undefined, undefined, neededKind);
        G.raiseT = 0;
      }
    } else G.raiseT = 0;

    /* Большую часть времени бойцы держат прежние живые цели. Если поиск всё же
       нужен, общий список собирается в переиспользуемые записи без 500 объектов. */
    frameScratch.minionCandidatesReady=false;
    /* Кто кем уже занят. Свита должна разбирать толпу по одному, а не наваливаться
       вдесятером на одного: занятая цель штрафуется так, будто она дальше. */
    const claims=frameScratch.minionClaims;claims.clear();
    for (const mm of G.minions){
      if (mm.tgt && !mm.tgt.dead && dist(mm.tgt,p)<=MINION_LEASH) claimMinionTarget(claims,mm.tgt);
      else mm.tgt = null;
    }

    for (let i = G.minions.length-1; i >= 0; i--){
      const m = G.minions[i];
      m.deathT = (m.deathT === undefined ? rnd(MINION_LIFE_MIN, MINION_LIFE_MAX) : m.deathT) - dt;
      if (m.deathT <= 0){ killMinion(i,getPostMoveEnemyGrid); continue; }
      m.hit = Math.max(0, m.hit - dt); m.rot += dt*2.4; m.cd -= dt; m.born += dt;
      m.slowT=Math.max(0,(m.slowT||0)-dt); m.stunT=Math.max(0,(m.stunT||0)-dt);
      const minionMoveX0 = m.x, minionMoveY0 = m.y;
      const mode = MKIND[m.kind].mode;
      const minionSlow=m.slowT>0&&!D.minSlowImmune?clamp(m.slowMul||1,0,1):1;
      const minionSpd=D.minSpd*(amu('boneSpurs') && p.moving && dist(m,p)<=300 ? 1.25 : 1)
        *minionSlow*(m.stunT>0?0:1);

      /* Цель держится между кадрами, пока жива и не убежала от хозяина: без этой
         липкости приспешник перевыбирал бы цель каждый кадр и дёргался на месте
         вместо того, чтобы добежать. */
      let best = m.tgt && !m.tgt.dead ? m.tgt : null;
      let bd=Infinity;
      if (!best){
        let bs = Infinity;
        for (const c of frameMinionCandidates()){
          const e = c.e;
          /* Порядок слагаемых и есть вся логика:
             1) кто ближе к ИГРОКУ — того и бьём, свита защищает хозяина;
             2) занятые цели отодвигаются, чтобы толпа разбиралась параллельно;
             3) расстояние до самого приспешника входит с малым весом — только
                чтобы из двух равных он выбрал того, до кого ближе бежать. */
          const dm=dist(e,m);
          let score = c.dp + (claims.get(e) || 0) * MINION_CLAIM_PENALTY + dm*0.3;
          // Костяной голем поверх этого избегает тех, на ком стаки крови уже висят
          if (mode === 'golemN') score += e.dots.bleed.n * 500;
          if (score < bs){ bs = score; best = e; bd=dm; }
        }
        if (best){ m.tgt=best;claimMinionTarget(claims,best); }
      }
      if (best && bd===Infinity) bd=dist(best,m);

      if (best && mode === 'bombardier'){                    // БОМБАРДИР: держит дистанцию и кладёт зонный дебаф
        const want = 290;
        const a2 = Math.atan2(best.y-m.y, best.x-m.x);
        const dir = bd > want+40 ? 1 : bd < want-60 ? -1 : 0;
        m.x += Math.cos(a2)*minionSpd*dir*dt; m.y += Math.sin(a2)*minionSpd*dir*dt;
        if (D.minBlink && bd > 560) minionBlink(m, best, dt, getPostMoveEnemyGrid);
        if (m.stunT<=0 && m.cd <= 0 && bd < 500){
          m.cd = 0.96 / D.minAspd;
          minionShot(m, best, pick(BOMBARDIER_DEBUFFS));
        }
      } else if (best){                                      // ближний бой: скелеты и големы
        const reach = m.r + best.r + 3;
        if (D.minBlink && bd > reach) minionBlink(m, best, dt, getPostMoveEnemyGrid);   // перенос вместо долгой беготни
        const slow = m.kind === 'golemB' ? 0.65 : m.kind === 'golemN' ? 1.25 : 1;
        if (bd > reach){
          const a2 = Math.atan2(best.y-m.y, best.x-m.x);
          m.x += Math.cos(a2)*minionSpd*slow*dt; m.y += Math.sin(a2)*minionSpd*slow*dt;
        } else if (m.stunT<=0 && m.cd <= 0){
          if (m.kind === 'golemB'){ m.cd = D.golemBCd / D.minAspd; minionHit(best, m, getPostMoveEnemyGrid); }
          else if (m.kind === 'golemN'){ m.cd = 0.35 / D.minAspd; boneGolemHit(best, m); }
          else { m.cd = 0.50 / (D.minAspd*D.skelAspd); minionHit(best, m, getPostMoveEnemyGrid); }   // скелет: два удара в секунду
        }
      } else {                                               // без врагов держатся у хозяина
        m.tgt = null;
        const d = dist(m,p);
        if (d > 74){
          const a2 = Math.atan2(p.y-m.y, p.x-m.x);
          m.x += Math.cos(a2)*minionSpd*dt; m.y += Math.sin(a2)*minionSpd*dt;
        }
      }
      const minionMovedX = m.x-minionMoveX0, minionMovedY = m.y-minionMoveY0;
      const minionMoved = Math.hypot(minionMovedX,minionMovedY);
      if (minionMoved > 0.001){
        const meta = MINION_SPRITE_META[m.kind];
        m.animT = (m.animT||0) + minionMoved/(meta ? meta.stride : 12);
        if (Math.abs(minionMovedX) > 0.01) m.spriteFace = minionMovedX < 0 ? -1 : 1;
      }
      if (m.hp <= 0) killMinion(i,getPostMoveEnemyGrid);
    }
    releaseFrameMinionScratch();
  }

  /* --- Снаряды игрока --- */
  const enemyGrid=G.shots.length ? getPostMoveEnemyGrid() : null;
  for (let i = G.shots.length-1; i >= 0; i--){
    const s = G.shots[i];
    let shotDamageSnapshot=null;
    s.life -= dt; s.age=(s.age||0)+dt;
    const shotHoming=Math.min(1,D.homing+(s.homingBonus||0));
    if (s.returningArrow){
      const dx=p.x-s.x,dy=p.y-s.y,d=Math.max(0.0001,Math.hypot(dx,dy)),speed=Math.max(1,Math.hypot(s.vx,s.vy));
      if (d<=speed*dt+p.r+s.r+4){ G.shots.splice(i,1); continue; }
      s.a=Math.atan2(dy,dx); s.vx=dx/d*speed; s.vy=dy/d*speed;
    }
    // Самонаведение подкручивает вектор к ближайшей цели
    else if (shotHoming > 0){
      let best = null, bd2 = 400*400;
      for (const e of enemySpatialCandidates(enemyGrid,s.x,s.y,400)){
        const d2=distSq(e,s); if (d2 < bd2){ bd2=d2; best=e; }
      }
      if (best){
        const ta = Math.atan2(best.y-s.y, best.x-s.x);
        const cur = Math.atan2(s.vy, s.vx);
        let da = Math.atan2(Math.sin(ta-cur), Math.cos(ta-cur));
        const na = cur + da * Math.min(1, shotHoming*dt*4);
        const sp2 = Math.hypot(s.vx, s.vy);
        s.vx = Math.cos(na)*sp2; s.vy = Math.sin(na)*sp2; s.a = na;
      }
    }
    const stepX=s.vx*dt, stepY=s.vy*dt;
    s.x += stepX; s.y += stepY;
    s.travel=(s.travel||0)+Math.hypot(stepX,stepY);
    let dead = s.life <= 0 || Math.abs(s.x) > ARENA+50 || Math.abs(s.y) > ARENA+50;
    if (dead && beginReturningArrow(s)) dead=false;

    if (!dead){
      const collisionRange=s.r+enemyGrid.maxRadius;
      for (const e of enemySpatialCandidates(enemyGrid,s.x,s.y,collisionRange)){
        if (s.hitSet.includes(e)) continue;
        const hitRange=e.r+s.r;
        if (distSq(e,s) > hitRange*hitRange) continue;
        const firstArrow=s.playerArrow && !s.ricochetShard && s.hitSet.length===0;
        const rangedInc=(s.playerArrow && s.age>=ACCELERATED_ARROW_TIME?D.acceleratedArrow:0)
                      +(s.playerArrow && s.age>=0.40 && D.swiftArrows?20:0)
                      +(firstArrow?D.cleanTrajectory:0);
        // Обычное пробитие теряет 20% исходной мощности за каждую уже
        // пройденную цель. СВЕРХПРОБИТИЕ разворачивает тот же шаг в усиление.
        const pierceMul=Math.max(0,1+(D.pierceBonus?0.2:-0.2)*s.pierced);
        const hitMul=s.mul*pierceMul;
        if (!shotDamageSnapshot) shotDamageSnapshot=s.minion
          ? minionDamageSnapshot(s.minion) : damageConditionSnapshot(p);
        if (s.bombardier){
          bombardierImpact(s,e,enemyGrid); s.hitSet.push(e); dead=true; break;
        }
        damage(e, {mul:hitMul, attackMul:s.attackMul, minion:s.minion, direct:true, rangedInc,
          hunterMarkShot:!!s.hunterMarkShot, elementChanceMul:firstArrow&&D.elementalPierce?2:1,
          heroDirect:!!s.heroDirect,weaponAttack:!!s.weaponAttack,
          primaryBasicHit:!!s.primaryBasic&&s.hitSet.length===0,copperCharged:!!s.copperCharged,
          confinementPct:s.confinementPct,noProcs:!!s.noProcs,noAilments:!!s.noAilments,
          noEcho:!!s.stepBeyondEcho,
          ...shotDamageSnapshot});
        s.hunterMarkShot=false;
        if (s.playerArrow && s.age>=0.40 && D.swiftArrows){
          const a=Math.atan2(e.y-s.y,e.x-s.x), force=260*D.knockPow*knockbackScale(e);
          e.kb.x+=Math.cos(a)*force; e.kb.y+=Math.sin(a)*force;
        }
        s.hitSet.push(e);
        releaseSplitArrows(s);
        releaseRicochetShards(s,hitMul,s.attackMul,enemyGrid);
        if (s.orb){
          explodePlayerOrb(s,enemyGrid);
          dead = true; break;
        }
        if (s.returningArrow){
          dead=false;                                                // обратная стрела проходит через всех задетых
        } else if (s.chain > 0){                                     // отскок на новую цель
          s.chain--;
          // Перчатки рикошета переворачивают знак: отскок не гасит снаряд, а разгоняет
          if (amu('ricochet')) s.mul *= 1.10;
          else if (!D.chainKeep) s.mul *= 0.75;                      // без эко-отскоков урон затухает
          let next=null, nextD2=Infinity;
          for (const x of G.enemies){
            if (s.hitSet.includes(x)) continue;
            const d2=distSq(x,s); if (d2<nextD2){ nextD2=d2; next=x; }
          }
          if (next){ const na = Math.atan2(next.y-s.y, next.x-s.x), sp2 = Math.hypot(s.vx,s.vy);
                     s.vx = Math.cos(na)*sp2; s.vy = Math.sin(na)*sp2; s.a=na; s.life = Math.max(s.life,0.5); }
          else dead = true;
        } else if (s.pierce > 0){ s.pierce--; s.pierced++; }
        else dead = true;
        break;
      }
    }
    if (dead && beginReturningArrow(s)) dead=false;
    if (dead && s.orb && D.arcaneMine && s.hitSet.length===0) plantArcaneMine(s);
    if (dead){ rollMissedShotItems(s); G.shots.splice(i,1); }
  }
  releasePostMoveEnemyGrid();

  /* --- Снаряды врагов --- */
  for (let i = G.eshots.length-1; i >= 0; i--){
    const s = G.eshots[i];
    s.life -= dt;
    let returned = false;
    if (s.shotType === 'axe'){
      s.spin = (s.spin||0) + dt*13;
      if (s.owner && s.owner.dead){
        returned = true;
      } else if (!s.returning){
        const step = Math.min(s.outLeft, s.axeSpeed*dt);
        s.x += s.vx/s.axeSpeed*step; s.y += s.vy/s.axeSpeed*step; s.outLeft -= step;
        if (s.outLeft <= 0.001){
          s.x=s.targetX; s.y=s.targetY; s.returning=true;
        }
      } else {
        const owner=s.owner, dx=owner.x-s.x, dy=owner.y-s.y, d=Math.hypot(dx,dy);
        if (d <= s.axeSpeed*dt + owner.r*0.35) returned=true;
        else { s.vx=dx/d*s.axeSpeed; s.vy=dy/d*s.axeSpeed; s.x+=s.vx*dt; s.y+=s.vy*dt; }
      }
    } else {
      s.x += s.vx*dt; s.y += s.vy*dt;
    }
    if (returned){ G.eshots.splice(i,1); continue; }
    if (amu('glassBell') && G.amuT.glassBell<=0 && dist(s,p)<=100){
      G.amuT.glassBell=10;
      const shooter=s.owner;
      if (shooter && !shooter.dead && shooter.hp>0)
        shooter.ail.stun=Math.max(shooter.ail.stun,shooter.kind==='boss'?0.2:0.4);
      G.fx.push({t:'ring',x:s.x,y:s.y,r:6,max:42,life:0.3,col:'#b9e8ef'});
      G.fx.push({t:'txt',x:p.x,y:p.y-28,s:tr('Стеклянный Колокол'),life:0.7,col:'#b9e8ef'});
      spawnBoss20ProjectileImpact(s);
      G.eshots.splice(i,1); continue;
    }
    // ЗЕРКАЛЬНЫЙ ОСКОЛОК: снаряд не гасится, а разворачивается и летит уже как ваш
    if (s.shotType !== 'axe' && dist(s,p) < s.r + p.r && amu('shard') && Math.random() < 0.10){
      const sp2 = Math.hypot(s.vx, s.vy) * 1.4;
      const a2 = Math.atan2(-s.vy, -s.vx);
      G.shots.push({x:p.x + Math.cos(a2)*(p.r+8), y:p.y + Math.sin(a2)*(p.r+8), a:a2,
        vx:Math.cos(a2)*sp2, vy:Math.sin(a2)*sp2, r:6*D.projSize, life:2.2,
        pierce:D.pierce, chain:0, ric:0, hitSet:[], orb:false, mul:1, pierced:0});
      G.fx.push({t:'txt', x:p.x, y:p.y-24, s:'отбито', life:0.5, col:'#6fb3ff'});
      G.eshots.splice(i,1); continue;
    }
    if (dist(s,p) < s.r + p.r){
      const shotDamage = s.maxHpPct ? D.life*s.maxHpPct : s.dmg;
      if (s.shotType === 'axe'){
        if (!s.hitDone){
          hurt(shotDamage, false, false, s.cause || 'ВРАЖЕСКИЙ СНАРЯД', s.sourceKind, s.owner);
          s.hitDone=true; applyBossSlow(0.30,1.5);
        }
      } else {
        hurt(shotDamage, false, false, s.cause || 'ВРАЖЕСКИЙ СНАРЯД', s.sourceKind, s.owner);
        if (s.shotType === 'slime' || s.shotType === 'lich') applyBossSlow(0.50,1);
        if (s.bossDot) applyBoss20Dot(s.bossDot.key,s.bossDot.pct,s.bossDot.duration,
          (s.cause||'БОСС')+' · '+s.bossDot.label,s.bossDot.col);
        applyEliteProjectileHit(s);
        packDealt(s.pk, shotDamage); spawnBoss20ProjectileImpact(s); G.eshots.splice(i,1); continue;
      }
    }
    if (s.life <= 0){spawnBoss20ProjectileImpact(s);G.eshots.splice(i,1);}
  }

  /* --- Сферы опыта --- */
  for (let i = G.orbs.length-1; i >= 0; i--){
    const o = G.orbs[i], d = dist(o,p);
    const a = Math.atan2(p.y-o.y, p.x-o.x);
    // Опыт и золото летят к игроку с полной скоростью на всём пути. Для книг,
    // амулетов и тотемов сохраняется прежний радиусный разгон и медленный дрейф.
    const loot = o.gold || o.v !== undefined;
    const pull = loot ? D.lootPull : d < D.pickup ? 340 : 75;
    o.x += Math.cos(a)*pull*dt; o.y += Math.sin(a)*pull*dt;
    if (d < p.r + ((o.book || o.amu || o.totem) ? 14 : 6)){
      if (o.amu) takeAmulet(o.amu);
      else if (o.totem) takeTotem(o.totem);
      else if (o.book) takeBook(o.book);
      else if (o.gold) G.gold += o.v;
      else gainXp(o.v);
      G.orbs.splice(i,1);
    }
  }

  /* --- Частицы: разлёт с трением --- */
  updateParticles(dt);

  /* --- Лужи смолы --- */
  // Урон тикает раз в полсекунды общим таймером, а не каждый кадр и не на каждую
  // лужу: иначе hurt() съедал бы шанс уворота шестьдесят раз в секунду.
  let poolDmg = 0, poolKind = '';
  for (let i = G.pools.length-1; i >= 0; i--){
    const pl = G.pools[i]; pl.life -= dt;
    if (pl.life <= 0){ G.pools.splice(i,1); continue; }
    if (pl.arm > 0){ pl.arm -= dt; continue; }                   // лужа ещё растекается
    if (dist(pl, p) < pl.r + p.r && pl.dmg >= poolDmg){ poolDmg = pl.dmg; poolKind = pl.sourceKind || ''; }
  }
  p.poolCd = Math.max(0, (p.poolCd||0) - dt);
  if (poolDmg > 0 && p.poolCd <= 0){ p.poolCd = 0.5; hurt(poolDmg*0.5, false, false, 'ЛУЖА СМОЛЫ', poolKind); }

  /* --- Кислота Чумной Мерзости --- */
  for (let i = G.bossPools.length-1; i >= 0; i--){
    const pl = G.bossPools[i]; pl.life -= dt; pl.tick -= dt;
    if (pl.life <= 0){ G.bossPools.splice(i,1); continue; }
    if (pl.tick <= 0){
      pl.tick += 1;
      if (dist(pl,p) < pl.r + p.r)
        hurt(D.life*pl.maxHpPct, false, false, 'КИСЛОТА ЧУМНОЙ МЕРЗОСТИ', 'boss');
    }
  }

  /* --- Огненный след Рогатого Тирана --- */
  let inTyrantFire = false;
  for (let i = G.bossTrails.length-1; i >= 0; i--){
    const tr = G.bossTrails[i]; tr.life -= dt;
    if (tr.life <= 0){ G.bossTrails.splice(i,1); continue; }
    if (dist(tr,p) < tr.r + p.r) inTyrantFire = true;
  }
  if (inTyrantFire && p.bossTrailCd <= 0){
    p.bossTrailCd = 0.4;
    applyTyrantBurn('ОГОНЬ РОГАТОГО ТИРАНА');
  }

  /* --- Длительные зоны новых боссов --- */
  for(let i=G.bossHazards.length-1;i>=0;i--){
    const h=G.bossHazards[i];h.life=Math.max(0,h.life-dt);h.tick-=dt;
    if(h.kind==='safe'){
      const u=clamp(1-h.life/h.max,0,1);
      h.spec.x=h.spec.startX===undefined?h.spec.x:h.spec.startX+(h.endX-h.spec.startX)*u;
      h.spec.y=h.spec.startY===undefined?h.spec.y:h.spec.startY+(h.endY-h.spec.startY)*u;
      if(h.spec.startX===undefined){h.spec.startX=h.spec.x;h.spec.startY=h.spec.y;}
    }
    const inside=boss20ShapeHits(h.spec,p),danger=h.kind==='safe'?!inside:inside;
    if(h.firstPct && inside && !h.entered){h.entered=true;hurt(D.life*h.firstPct,false,false,h.cause,'boss',h.owner);}
    while(h.tick<=0 && h.life>0){
      h.tick+=.5;
      if(danger && h.tickPct){
        hurt(D.life*h.tickPct,false,false,h.cause,'boss',h.owner);
        if(h.slow) applyBossSlow(h.slow.mult,h.slow.duration);
      }
      if(G.over) break;
    }
    if(h.life<=0){
      G.bossHazards.splice(i,1);
    }
  }

  /* --- Эффекты --- */
  updateBloodFx(dt);
  updateTransientEffects(dt);

  /* --- Портал на следующий этаж --- */
  if (!G.portal && floorCombatComplete()){
    collectFloorLoot();
    const portalPos=floorPortalSpawnPosition(p);
    G.portal = {x:portalPos.x,y:portalPos.y,r:34,t:0};
    spawnFloorPortalArrivalFx(G.portal);
    toast('ПОРТАЛ ОТКРЫТ · ЛУТ СОБРАН');
  }
  if (G.portal){
    G.portal.t += dt;
    if (dist(G.portal, p) < G.portal.r + p.r && floorPortalReady(G.portal)){
      G.gold += Math.round((12 + G.floor*6) * D.goldFind); // премия за зачистку
      G.floor++;
      // Трупы принадлежат комнате, где погибли враги: новый этаж всегда
      // начинается с чистого поля и без частично накопленного подъёма.
      G.corpses.length = 0; G.raiseT = 0;
      // Новый заряд только на рубежах: при «за этаж» к 20-му этажу копился 21 переброс
      // и раздача превращалась в поиск идеальной карточки вместо выбора из предложенных.
      if (G.floor % 5 === 0) G.rerolls++;
      heal(D.life*0.10);
      G.amuT.doll = 1;                                             // кукла смерти чинится на новом этаже
      p.x = 0; p.y = 0; p.dash = 0;                              // новый этаж начинается из центра
      buildFloor();
    }
  }
  tickBossHudHealth(dt);
}

/* Всё, что амулеты делают сами по себе: таймеры, копия, барьер.
   Отдельной функцией, потому что в update() это был бы ещё один экран кода
   посреди и без того длинного кадра. */
function tickAmulets(dt){
  const p = G.player;
  for (const k in G.amuT) if (k !== 'doll') G.amuT[k] = Math.max(0, G.amuT[k] - dt);

  if (G.worldShadow){
    G.worldShadow.life=Math.max(0,G.worldShadow.life-dt);
    if (G.worldShadow.life<=0) G.worldShadow=null;
  }

  // ЧЁРНОЕ ЗЕРКАЛО: копия стоит на месте и лупит по своей цели
  if (G.clone){
    const c = G.clone;
    c.life -= dt; c.cd -= dt;
    const t = findTargetFrom(c, attackRange(false));
    if (t){
      c.aim = Math.atan2(t.y - c.y, t.x - c.x);
      if (c.cd <= 0 && !G.weapon.noAttack){ c.cd = D.atkCd; attack(c); }
    }
    if (Math.random() < 0.3) burst(c.x, c.y, 1, '#c08cff', 40, 2, 0.3);
    if (c.life <= 0) G.clone = null;
  }

  // СЕРДЦЕ БУРИ
  if (amu('storm') && G.amuT.storm <= 0){
    const t = findTargetFrom(p, 700);
    if (t){
      G.amuT.storm = 8;
      G.fx.push({t:'bolt', x:p.x, y:p.y, x2:t.x, y2:t.y, life:0.22, col:'#ffe14a'});
      damage(t, {mul:3});
      t.ail.shock = Math.max(t.ail.shock, SHOCK_DURATION*D.ailDur);
      burst(t.x, t.y, 14, '#ffe14a', 220, 3, 0.5);
    }
  }

  // ЧАСОВОЙ МЕХАНИЗМ: радиус считается через «Радиус области действия», как всё площадное
  if (amu('clock') && G.amuT.clock <= 0){
    G.amuT.clock = 30;
    const R = 240 * D.aoeR;
    G.fx.push({t:'ring', x:p.x, y:p.y, r:10, max:R, life:0.6, col:'#4fd1c5'});
    for (const e of G.enemies){
      if (dist(e,p) > R) continue;
      if (e.ail.freeze <= 0) statusText(e, 'FROZEN', '#7fd6ff');
      e.ail.freeze = Math.max(e.ail.freeze, 1.0*D.freezeDur);
    }
  }

  // ПУЛЬС ЖИЗНИ
  if (amu('pulse') && G.amuT.pulse <= 0){
    G.amuT.pulse = 15; heal(D.life*0.05);
    G.fx.push({t:'ring', x:p.x, y:p.y, r:p.r, max:60, life:0.5, col:'#e0405a'});
  }
  // ГРАВИТАЦИОННЫЙ КОЛОДЕЦ: секунду тянет, потом взрывается
  if (amu('gravity') && G.amuT.gravity <= 0 && G.enemies.length){
    G.amuT.gravity = 12;
    const t = findTargetFrom(p, 520) || p;
    G.well = {x:t.x, y:t.y, t:1, r:170*D.aoeR};
    G.fx.push({t:'ring', x:G.well.x, y:G.well.y, r:G.well.r, max:12, life:1, col:'#c08cff'});
  }
  if (G.well){
    G.well.t -= dt;
    for (const o of G.enemies){
      const d = dist(o, G.well);
      if (d > G.well.r || d < 1) continue;
      const a = Math.atan2(G.well.y-o.y, G.well.x-o.x);
      o.kb.x += Math.cos(a)*260*dt*6; o.kb.y += Math.sin(a)*260*dt*6;
    }
    if (G.well.t <= 0){
      nova(G.well.x, G.well.y, G.well.r, avgHit()*1.6, '#c08cff', {overpressure:true});
      G.well = null;
    }
  }
  // ТАЛИСМАН ПОКОЯ
  if (amu('calm') && p.stillT > 2 && p.barrier <= 0 && G.amuT.calm <= 0){
    p.barrier = D.life*0.10;
    G.fx.push({t:'ring', x:p.x, y:p.y, r:p.r, max:p.r+22, life:0.5, col:'#5ec2e0'});
  }
}

/* След от ботинок. Узлы кладутся по времени, а не по кадрам: иначе на 240 Гц
   след был бы вчетверо гуще, чем на 60, и урон зависел бы от монитора. */
const TRAIL_STEP = 0.11, TRAIL_LIFE = 2.6, TRAIL_R = 30;
function tickTrail(dt){
  const p = G.player;
  p.trailT = (p.trailT || 0) - dt;
  if (p.moving && p.trailT <= 0){
    p.trailT = TRAIL_STEP;
    // Огонь и лёд кладутся одним узлом с двумя флагами: два отдельных следа
    // друг друга перекрывали бы и считались бы дважды на одном враге
    G.trails.push({x:p.x, y:p.y, r:TRAIL_R*D.aoeR, life:TRAIL_LIFE,
                   fire:amu('lava'), cold:amu('frost')});
    if (G.trails.length > 40) G.trails.shift();       // потолок держит кадр
  }
  // Урон следа растёт от скорости бега: медленный игрок оставляет тлеющий след,
  // быстрый — сплошную полосу огня. Отсчёт от базовых 235.
  const dps = avgHit() * 0.5 * (D.mspd/235) * D.ailEff;
  for (let i = G.trails.length-1; i >= 0; i--){
    G.trails[i].life -= dt;
    if (G.trails[i].life <= 0) G.trails.splice(i,1);
  }
  const trailGrid=G.trails.length?buildEnemySpatialGrid(G.trails):null;
  // Считаем по врагу, а не по узлу: узлы лежат внахлёст, и урон «за каждый узел»
  // работал ровно наоборот замыслу — стоящий на месте игрок наваливал их горкой
  // и жёг втрое сильнее бегущего. Замер до правки: 254 урона при скорости 235
  // и 208 при 470, то есть быстрые ботинки жгли ХУЖЕ медленных.
  for (const e of G.enemies){
    let f = false, cd = false;
    const nearbyTrails=trailGrid?enemySpatialCandidates(trailGrid,e.x,e.y,trailGrid.maxRadius+e.r):[];
    for (const tr of nearbyTrails){
      if (dist(e, tr) > tr.r + e.r) continue;
      if (tr.fire) f = true;
      if (tr.cold) cd = true;
      if (f && cd) break;
    }
    if (f) applyDamage(e, dps*dt, false, true);
    if (cd){
      if (e.ail.chill <= 0) statusText(e, 'SLOWED', '#ffe14a');
      e.ail.chill = Math.max(e.ail.chill, CHILL_DURATION*D.ailDur);
    }
  }
}

/* Ближайшая цель от произвольной точки — нужна копии и молнии.
   findTarget() считает только от игрока и остаётся как есть. */
function findTargetFrom(o, range){
  let best = null, bd = Infinity;
  for (const e of G.enemies){
    const d = dist(e,o) - e.r;
    if (d < range && d < bd){ bd = d; best = e; }
  }
  return best;
}

/* Опыт и повышение уровня */
function gainXp(v){
  G.xp += v * D.xpGain;
  while (G.xp >= G.xpNext){
    G.xp -= G.xpNext; G.lvl++;
    G.xpNext = Math.round(14 * Math.pow(1.17, G.lvl-1));
    G.pending++;
    diagEvent('level_up',{level:G.lvl,floor:G.floor,pending:G.pending});
    levelUpSfx();
  }
  if (G.pending) showLevelUp();
}

/* Автосбор начисляет находки сразу, но уведомления нельзя рисовать поверх
   level-up: оба экрана используют #ov. Поэтому складываем снимки результатов
   и показываем одну сводку после всех ожидающих выборов карточек. */
function showFloorFindSummary(){
  if (G.floorFindSummaryOpen) return true;
  if (!G.floorFinds.length) return false;
  hideSkillTip();
  const shown = G.floorFinds.slice();
  G.floorFindSummaryOpen = true; G.paused = true;
  $('#ov').style.display = 'flex';
  $('#ov').innerHTML =
    '<h1 style="color:var(--amber)">ДОБЫЧА ЭТАЖА</h1>' +
    '<h2>Все находки автоматически доставлены. Наведите на находку, чтобы прочитать её описание.</h2>' +
    '<div class="k" style="font-size:14px">ПОЛУЧЕНО НАХОДОК: ' + shown.length + '</div>' +
    '<div class="floor-find-list">' + shown.map((f,i) =>
      '<div class="floor-find-row" data-floor-find="' + i + '" tabindex="0" aria-describedby="skilltip" style="--fc:' + f.col + '">' +
        '<div class="floor-find-icon">' + f.ico + '</div><div><b>' + f.name + '</b><span>' + f.detail + '</span></div>' +
      '</div>').join('') + '</div><button id="findok" aria-keyshortcuts="Space">ПРОДОЛЖИТЬ <kbd>ПРОБЕЛ</kbd></button>';
  document.querySelectorAll('[data-floor-find]').forEach(el => {
    const f = shown[+el.dataset.floorFind];
    el.onmouseenter = ev => showFloorFindTip(ev, f, el);
    el.onmousemove = ev => showFloorFindTip(ev, f, el);
    el.onmouseleave = hideSkillTip;
    el.onfocus = () => showFloorFindTip(null, f, el);
    el.onblur = hideSkillTip;
  });
  $('#findok').onclick = () => {
    hideSkillTip();
    G.floorFinds.splice(0, shown.length); G.floorFindSummaryOpen = false; G.paused = false;
    $('#ov').style.display = 'none'; $('#ov').innerHTML = ''; last = performance.now();
    if (G.pending) showLevelUp();
  };
  return true;
}

/* Завершение комнаты — жёсткая граница для лута. Как только бой закончен,
   портал забирает всё, что осталось на арене: опыт, золото и находки. Обычный
   ручной подбор по-прежнему показывает каждое окно отдельно. */
function collectFloorLoot(){
  if (!G.orbs.length) return {xp:0, gold:0, finds:0};
  const drops = G.orbs.splice(0);
  let xp = 0, gold = 0, finds = 0;
  for (const o of drops){
    if (o.amu){
      const A = AMULETS[o.amu]; takeAmulet(o.amu, true); finds++;
      G.floorFinds.push({ico:rareItemSpriteHTML(o.amu,'summary'), col:A.col, name:A.nm,
        detail:SLOTS[A.slot].toUpperCase() + ' · ' + ['ОБЫЧНЫЙ','РЕДКИЙ','ЭПИЧЕСКИЙ','ЛЕГЕНДАРНЫЙ'][A.rar], tip:A.nt});
    }
    else if (o.totem){
      const T = TOTEMS[o.totem]; takeTotem(o.totem, true); finds++;
      const tier = totemTier(o.totem);
      G.floorFinds.push({ico:totemSpriteHTML(o.totem,tier,'summary'), col:T.col, name:TOTEM_RANKS[tier-1] + ' ' + T.nm,
        detail:'ТОТЕМ · ранг ' + tier + ' из 4 · +' + TOTEM_VALS[tier-1] + '% урона по ' + T.st,
        tip:'Весь ваш урон по ' + T.st + ' целям увеличен на <b>+' + TOTEM_VALS[tier-1] + '%</b>. Действует и на удары свиты.' +
          (tier < 4 ? '<br>Следующая находка повысит тотем до <b>+' + TOTEM_VALS[tier] + '%</b>.' : '<br>Достигнут максимальный ранг.')});
    }
    else if (o.book){
      const B = BOOKS[o.book], before = G.items[o.book] ? G.items[o.book].val : 0;
      takeBook(o.book, true); finds++;
      const it = G.items[o.book], unit = (B.pct || o.book === 'monster' || o.book === 'xp') ? '%' : '';
      G.floorFinds.push({ico:lootSpriteHTML(o.book,'summary'), col:B.col, name:B.nm,
        detail:'КНИГА · тир ' + it.tier + ' · +' + it.val + unit + (before ? ' · было +' + before + unit : ''),
        tip:B.desc.replace(/N/g, it.val + unit) + (B.proc ? '<br>Текущий шанс срабатывания: <b>' + bookChance(o.book) + '%</b>.' : '')});
    }
    else if (o.gold) gold += o.v || 0;
    else xp += o.v || 0;
  }
  if (gold) G.gold += gold;
  if (xp) gainXp(xp);
  if (!G.pending) showFloorFindSummary();
  return {xp, gold, finds};
}
