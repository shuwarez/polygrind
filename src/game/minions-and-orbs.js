/* ---------- 6b. ПРИСПЕШНИКИ ----------
   Скелет — самостоятельная сущность: ищет ближайшего врага в радиусе,
   добегает и бьёт. Его урон считается от вашего среднего удара,
   поэтому вся прокачка урона косвенно усиливает и свиту.            */
const MINION_LIFE_MIN = 10, MINION_LIFE_MAX = 15;
function spawnMinion(x, y, kind){
  kind = kind || needKind();
  if (!kind) return false;
  const hp = minionHp(kind), px = x !== undefined ? x : G.player.x, py = y !== undefined ? y : G.player.y;
  G.minions.push({
    kind, x: px + rnd(-20,20), y: py + rnd(-20,20),
    r: minionR(kind), hp, max: hp,
    cd: rnd(0, 0.4), rot: rnd(0,6.28), hit:0, born:0, tgt:null, blinkT:undefined, hitN:0,
    slowT:0, slowMul:1, stunT:0,
    animT:0, spriteFace:1,
    deathT: rnd(MINION_LIFE_MIN, MINION_LIFE_MAX), // независимая естественная смерть запускает общие посмертные эффекты
  });
  G.fx.push({t:'ring', x:px, y:py, r:4, max:26, life:0.25, col:MKIND[kind].col});
  return true;
}

/* Урон приспешника: отдельный, более простой путь — без условных бонусов,
   но с учётом брони цели, шока и крита свиты. */
/* Удар приспешника идёт по ТОМУ ЖЕ пути, что и удар игрока: damage() с меткой
   src.minion. Раньше здесь была своя укороченная копия формулы, и мимо свиты
   проходило почти всё — поджог, охлаждение, шок с разрядом, яд, оглушение,
   отбрасывание, добивание, сверхкриты, кольца, перчатки, счётчики «каждый N-й»
   и двойные удары. Некромант получал половину каталога вхолостую.
   Отличия свиты отмечены через src.minion: свой шанс крита и вампиризм,
   отбрасывание от позиции бойца, а также ×0.25 к шансам негативных эффектов.
   Общий урон всех типов свиты отдельно уменьшен вдвое. */
const FRENZY_R = 70;               // база радиуса взрыва «Буйства демонов»
const WHIRL_R  = 55;               // база радиуса «Вихря когтей»
/* КИПЯЩАЯ КРОВЬ. Лужа бьёт долей ТЕКУЩЕГО здоровья, поэтому урон не растёт
   с этажом и не убивает сам по себе: три тика по 5% снимают около 14% запаса
   у кого угодно. Ценность в том, что доля не зависит ни от брони, ни от
   множителей врага — это ответ на жирные цели, а не источник дпс.
   Потолок на число луж стоит от спама: свита получает удары десятками в секунду. */
const BOIL_R = 60, BOIL_LIFE = 3, BOIL_PCT = 0.05, BOIL_MAX = 24;
function boilRoll(m){
  if (!D.minBoil || Math.random() >= 0.05) return;
  if (G.boils.length >= BOIL_MAX) G.boils.shift();
  G.boils.push({x:m.x, y:m.y, r:BOIL_R*D.aoeR, life:BOIL_LIFE, t:1});
  G.fx.push({t:'ring', x:m.x, y:m.y, r:6, max:BOIL_R*D.aoeR, life:0.3, col:'#e0405a'});
}
function tickBoils(dt){
  let enemyGrid=null;
  for (let i = G.boils.length-1; i >= 0; i--){
    const b2 = G.boils[i];
    b2.life -= dt; b2.t -= dt;
    if (b2.life <= 0){ G.boils.splice(i,1); continue; }
    if (b2.t > 0) continue;
    b2.t = 1;                                        // тик раз в секунду, а не каждый кадр
    if (!enemyGrid) enemyGrid=buildEnemySpatialGrid();
    for (const e of enemyAreaCandidates(enemyGrid,b2.x,b2.y,b2.r)){
      if (dist(e, b2) > b2.r + e.r) continue;
      applyDamage(e, e.hp*BOIL_PCT, false, true, 1);
      burst(e.x, e.y, 2, '#e0405a', 90, 2, 0.3);
    }
  }
}
/* ВЕНОМАНСЕР: смерть любого приспешника оставляет кислоту. Два тика по 5%
   текущего здоровья идут сразу и через одну секунду. */
const ACID_R = 58, ACID_LIFE = 2, ACID_PCT = 0.05, ACID_MAX = 30;
function dropAcidPool(m){
  if (G.acidPools.length >= ACID_MAX) G.acidPools.shift();
  G.acidPools.push({x:m.x, y:m.y, r:ACID_R*D.aoeR, life:ACID_LIFE, max:ACID_LIFE, t:0});
  G.fx.push({t:'ring', x:m.x, y:m.y, r:6, max:ACID_R*D.aoeR, life:0.3, col:'#8be04e'});
}
function tickAcidPools(dt){
  let enemyGrid=null;
  for (let i = G.acidPools.length-1; i >= 0; i--){
    const a = G.acidPools[i];
    a.life -= dt; a.t -= dt;
    if (a.life <= 0){ G.acidPools.splice(i,1); continue; }
    if (a.t > 0) continue;
    a.t = 1;
    if (!enemyGrid) enemyGrid=buildEnemySpatialGrid();
    for (const e of enemyAreaCandidates(enemyGrid,a.x,a.y,a.r)){
      if (e.dead || dist(e, a) > a.r + e.r) continue;
      applyDamage(e, e.hp*ACID_PCT, false, true, 1);
      burst(e.x, e.y, 3, '#8be04e', 100, 3, 0.35);
    }
  }
}
/* Поводок свиты: дальше этого от ХОЗЯИНА цели не берутся вовсе. Раньше каждый
   приспешник искал ближайшего к себе, и стая всем составом уносилась за одним
   убегающим врагом через всю комнату, оставляя игрока голым. */
const MINION_LEASH = 640;
/* Штраф за занятую цель, в единицах расстояния. 500 означает «занятый враг
   считается на 500 дальше»: свита разбирает толпу параллельно, но если врагов
   меньше, чем бойцов, они всё равно добивают вместе, а не стоят без дела. */
const MINION_CLAIM_PENALTY = 500;

function getPostMoveEnemyGrid(){
  const scratch=G.frameScratch;
  if (!scratch.postMoveReady){
    scratch.postMoveGrid=buildEnemySpatialGrid(G.enemies,false,scratch.postMoveGrid);
    scratch.postMoveReady=true;
  }
  return scratch.postMoveGrid;
}
function releasePostMoveEnemyGrid(){
  const scratch=G.frameScratch;
  if (scratch.postMoveReady) clearEnemySpatialGrid(scratch.postMoveGrid);
  scratch.postMoveReady=false;
}
function frameMinionCandidates(){
  const scratch=G.frameScratch;
  if (scratch.minionCandidatesReady) return scratch.minionCandidates;
  const view=scratch.minionCandidates,pool=scratch.minionCandidatePool,p=G.player;
  view.length=0;
  for (const e of G.enemies){
    const dp=dist(e,p);if (dp>MINION_LEASH) continue;
    const at=view.length,entry=pool[at]||(pool[at]={e:null,dp:0});entry.e=e;entry.dp=dp;view.push(entry);
  }
  scratch.minionCandidatesReady=true;return view;
}
function releaseFrameMinionScratch(){
  const scratch=G.frameScratch;
  for (const entry of scratch.minionCandidates) entry.e=null;
  scratch.minionCandidates.length=0;scratch.minionCandidatesReady=false;scratch.minionClaims.clear();
}
function claimMinionTarget(claims,e){ claims.set(e,(claims.get(e)||0)+1); }

/* Сигналы enemy-фазы собираются одним проходом. Возвращается сам постоянный
   scratch, поэтому даже служебный результат не создаёт объект каждый кадр. */
function scanEnemyLogicFrame(){
  const scratch=G.frameScratch,sources=scratch.chillSources;
  sources.length=0;G.banner=false;let infernoActive=false;
  for (const e of G.enemies){
    if (e.ail.chill>0) sources.push(e);
    if (D.inferno&&e.dots.fire.dps>0) infernoActive=true;
    if (!G.banner&&e.kind==='boss'&&e.aff.length)
      for (const a of e.aff) if (a.id==='banner'){G.banner=true;break;}
  }
  scratch.infernoActive=infernoActive;
  return scratch;
}
function buildEnemyLogicFrame(scratch=G.frameScratch){
  scratch.activeChillGrid=scratch.chillSources.length
    ?(scratch.chillGrid=buildEnemySpatialGrid(scratch.chillSources,true,scratch.chillGrid)):null;
  scratch.activeInfernoGrid=scratch.infernoActive
    ?(scratch.infernoGrid=buildEnemySpatialGrid(G.enemies,true,scratch.infernoGrid)):null;
  return scratch;
}
function releaseEnemyLogicFrame(scratch=G.frameScratch){
  if (scratch.activeChillGrid) clearEnemySpatialGrid(scratch.activeChillGrid);
  if (scratch.activeInfernoGrid) clearEnemySpatialGrid(scratch.activeInfernoGrid);
  scratch.activeChillGrid=scratch.activeInfernoGrid=null;
  scratch.chillSources.length=0;scratch.infernoActive=false;
}

function minionDamageSnapshot(m){
  const damageConditions=damageConditionSnapshot(m);
  return {
    ...damageConditions,
    minionSealPackPct:sealPackDamagePct(),
    minionBoneFieldInc:boneFieldDamageInc(),
    // Старое имя оставлено для совместимости с существующими тестами и
    // внешними источниками удара; значение берётся из общего прохода.
    minionNearbyCount:damageConditions.damageNearbyCount,
  };
}

/* Перенос приспешника к цели со взрывом. Взрыв идёт через damage() с меткой
   приспешника, то есть по тому же пути, что и обычный удар: книги, статусы,
   кольца, счётчики «каждый N-й» — всё срабатывает.
   Единственное, чего он НЕ вызывает, — «Буйство демонов» и «Кровавую баню»:
   они висят на minionHit, и цепочка «взрыв рождает взрыв» была бы лавиной. */
function minionBlink(m, e, dt, getEnemyGrid=null){
  const B = D.minBlink;
  m.blinkT = (m.blinkT === undefined ? rnd(0, B.cd) : m.blinkT) - dt;
  if (m.blinkT > 0) return false;
  m.blinkT = B.cd;
  const a = rnd(0, Math.PI*2), off = e.r + m.r + 4;
  G.fx.push({t:'ring', x:m.x, y:m.y, r:m.r, max:4, life:0.25, col:'#c08cff'});
  m.x = clamp(e.x + Math.cos(a)*off, -ARENA, ARENA);
  m.y = clamp(e.y + Math.sin(a)*off, -ARENA, ARENA);
  const R = B.r * D.aoeR;
  G.fx.push({t:'ring', x:m.x, y:m.y, r:6, max:R, life:0.3, col:'#c08cff'});
  burst(m.x, m.y, 10, '#c08cff', 220, 3, 0.45);
  const mul = D.minDmgMul * B.mul * (G.bloodT > 0 ? 2 : 1);
  const grid=getEnemyGrid?getEnemyGrid():null;
  const targets=enemyAreaCandidates(grid,m.x,m.y,R)
    .filter(o=>!o.dead&&dist(o,m)<=R+o.r);
  const blastMul = mul * overpressureMultiplier(targets.length);
  const snap=minionDamageSnapshot(m);
  for (const o of targets) damage(o, {mul:blastMul, minion:m, noDouble:true,...snap});
  return true;
}

function minionHit(e, m, getEnemyGrid=null){
  // Голем крови масштабируется от вас напрямую, остальные — через множитель свиты
  const rage = G.bloodT > 0 ? 2 : 1;                 // КРОВНЫЕ УЗЫ: ярость от вашей крови
  const mul = (m.kind === 'golemB' ? D.golemBMul : D.minDmgMul) * rage;
  const confinementPct=confinementDamagePct();
  const snap=minionDamageSnapshot(m);
  damage(e, {mul, minion:m, direct:true,confinementPct,...snap});
  if (m.kind === 'golemB' && !e.dead) rollBloodGolemTaunt(e, m);

  /* КОГТИ. Счётчик у каждого приспешника свой: общий на всю свиту означал бы,
     что десять бойцов выбивают «каждый пятый» пять раз в секунду на всех вместе,
     и период перестал бы что-либо значить для отдельного скелета.
     Добавочные удары идут с noDouble: иначе двойное попадание игрока плодило бы
     их дальше, и один взмах разрастался бы в очередь. */
  if (D.minClaws || D.minWhirl){
    m.hitN = (m.hitN || 0) + 1;
    if (D.minClaws && m.hitN % 5 === 0){
      damage(e, {mul:mul*0.30, minion:m, noDouble:true,confinementPct,...snap});
      burst(e.x, e.y, 4, '#e6e2d6', 160, 2, 0.3);
    }
    if (D.minWhirl && m.hitN % 10 === 0){
      const R = WHIRL_R * D.aoeR;
      G.fx.push({t:'ring', x:m.x, y:m.y, r:8, max:R, life:0.24, col:'#e6e2d6'});
      const grid=getEnemyGrid?getEnemyGrid():null;
      for (const o of enemyAreaCandidates(grid,m.x,m.y,R)){
        if (o.dead || dist(o, m) > R + o.r) continue;
        damage(o, {mul:mul*0.20, minion:m, noDouble:true,confinementPct,...snap});
      }
    }
  }
  /* БУЙСТВО ДЕМОНОВ: взрыв вокруг цели тем же ударом и по тому же пути,
     то есть со всеми эффектами игрока — книгами, статусами, кольцами.
     Цель исключена: по ней удар уже прошёл, иначе получилось бы двойное
     попадание в упор. Рекурсии нет — взрыв зовёт damage() напрямую, а не
     minionHit(), поэтому сам себя не порождает. */
  /* КРОВАВАЯ БАНЯ. Сила стака берётся с книги крови, если она найдена, иначе
     считается по базовой доле в 15% от удара — той же, что у книги первого ранга.
     Так карточка работает и в связке с книгой, и сама по себе, а стаки при этом
     сливаются в один эффект по общему правилу усреднения кровотечения. */
  if (D.minBath && Math.random() < 0.10 * MINION_AILMENT_CHANCE_MULT){
    addBleed(e, (bookBleedDps()*MINION_DAMAGE_MULT || avgHit()*0.15*D.ailEff*MINION_DAMAGE_MULT)*boneFieldDamageMul(), 1);
    statusText(e, 'КРОВЬ', '#e0405a');
  }
  if (D.minFrenzy){
    const R = FRENZY_R * D.aoeR;
    G.fx.push({t:'ring', x:e.x, y:e.y, r:8, max:R, life:0.28, col:'#ff5a4e'});
    const grid=getEnemyGrid?getEnemyGrid():null;
    const targets=enemyAreaCandidates(grid,e.x,e.y,R)
      .filter(o=>o!==e&&!o.dead&&dist(o,e)<=R+o.r);
    const blastMul = mul * overpressureMultiplier(targets.length);
    for (const o of targets) damage(o, {mul:blastMul, minion:m, noDouble:true,confinementPct,...snap});
  }
  if (m.kind === 'golemB' && Math.random() < MINION_AILMENT_CHANCE_MULT){ // врождённое отбрасывание: 100% → 25%
    const a = Math.atan2(e.y-m.y, e.x-m.x);
    e.kb.x += Math.cos(a)*200; e.kb.y += Math.sin(a)*200;
    burst(e.x, e.y, 8, '#d4506a', 200, 4, 0.5);
  }
}

/* Костяной голем: прямого урона нет вовсе — только кровотечение,
   после чего он сразу уходит к следующей цели. Добить никого не может. */
function boneGolemHit(e, m){
  rollBoneChallenge(e, m);
  if (Math.random() >= MINION_AILMENT_CHANCE_MULT) return;
  addBleed(e, avgHit() * 0.03 * D.golemN * D.ailEff * MINION_DAMAGE_MULT * boneFieldDamageMul(), 1);
  burst(e.x, e.y, 7, '#e0405a', 170, 3, 0.5);
}

/* Бомбардир наносит четверть полного удара скелета каждой цели в небольшой
   области. Стихия выбирается один раз для снаряда и гарантированно применяется
   ко всем пережившим взрыв целям. */
const BOMBARDIER_DAMAGE_SHARE=0.25, BOMBARDIER_BLAST_RADIUS=60;
const BOMBARDIER_DEBUFFS=Object.freeze(['fire','poison','cold','shock']);

/* Выстрел приспешника использует общий снаряд, но бомба не наследует пробитие
   и отскоки: первое касание завершает полёт и создаёт ровно один взрыв. */
function minionShot(m, e, spell){
  const a = Math.atan2(e.y-m.y, e.x-m.x);
  const bombardier=m.kind==='bombardier';
  // Снаряды бомбардиров наследуют вашу скорость и размер снаряда.
  // Дальность держим постоянной: скорость умножается, а время жизни делится,
  // иначе +100% к скорости вдвое удлиняли бы и выстрел, а это уже другая карточка.
  G.shots.push({
    x:m.x, y:m.y, a,
    vx:Math.cos(a)*470*D.projSpd, vy:Math.sin(a)*470*D.projSpd,
    r: (spell ? 7 : 4) * D.projSize, life:1.1/D.projSpd,
    pierce:bombardier?0:D.pierce, chain:bombardier?0:D.chain, ric:0, hitSet:[], orb:false,
    mul:bombardier?D.minDmgMul:0.20, attackMul:bombardier?BOMBARDIER_DAMAGE_SHARE:undefined,
    pierced:0, spell, bombardier, minion:m, confinementPct:confinementDamagePct(), spriteType:spell ? 'mage' : 'arrow',
  });
}

function applyBombardierDebuff(e, spell, base){
  if (!e || e.dead || !spell) return false;
  if (spell === 'fire'){
    addDot(e, 'fire', base*IGNITE_DPS_SHARE*D.ailEff, 3*D.ailDur, 1);
    burst(e.x,e.y,5,'#ff7a2f',120,3,0.4);
  }
  if (spell === 'cold'){
    if (e.ail.chill<=0) statusText(e,'SLOWED','#ffe14a');
    e.ail.chill = CHILL_DURATION*D.ailDur;
    applyDamage(e, base*CHILL_DAMAGE_SHARE*D.ailEff, false, false, 1);
    if (D.freeze && Math.random() < FREEZE_CHANCE){
      if(e.ail.freeze<=0) statusText(e,'FROZEN','#7fd6ff');
      e.ail.freeze = Math.max(e.ail.freeze, FREEZE_DURATION*D.ailDur*D.freezeDur);
    }
    burst(e.x,e.y,5,'#7fd6ff',120,3,0.4);
  }
  if (spell === 'poison'){
    addDot(e, 'poison', base*POISON_DPS_SHARE*D.ailEff*(D.radiation?2:1), 4*D.ailDur, 1);
    burst(e.x,e.y,5,'#8be04e',120,3,0.4);
  }
  if (spell === 'shock'){
    e.ail.shock=Math.max(e.ail.shock,SHOCK_DURATION*D.ailDur);
    shockBurst(e,base,1);
    burst(e.x,e.y,5,'#ffe14a',140,3,0.4);
  }
  return true;
}

function bombardierImpact(s, primary, enemyGrid=null){
  if (!s || !s.bombardier || !s.minion || !primary) return 0;
  const radius=BOMBARDIER_BLAST_RADIUS*D.aoeR,spell=s.spell;
  const col=spell==='fire'?'#ff7a2f':spell==='poison'?'#8be04e':spell==='cold'?'#7fd6ff':'#ffe14a';
  const targets=enemyAreaCandidates(enemyGrid,primary.x,primary.y,radius)
    .filter(e=>!e.dead&&e.hp>0&&dist(e,primary)<=radius+e.r);
  const snap=minionDamageSnapshot(s.minion);
  const base=avgHit()*D.minDmgMul*BOMBARDIER_DAMAGE_SHARE*MINION_DAMAGE_MULT*boneFieldDamageMul();
  G.fx.push({t:'ring',x:primary.x,y:primary.y,r:6,max:radius,life:0.25,col});
  burst(primary.x,primary.y,10,col,190,3,0.45);
  for (const e of targets){
    damage(e,{mul:D.minDmgMul,attackMul:BOMBARDIER_DAMAGE_SHARE,minion:s.minion,
      direct:true,noDouble:true,confinementPct:s.confinementPct,...snap});
    applyBombardierDebuff(e,spell,base);
  }
  return targets.length;
}

function killMinion(i,getEnemyGrid=null){
  if (i < 0 || i >= G.minions.length) return;   // защита от индекса -1 у уже убитого
  const m = G.minions[i];
  if (D.venomancer) dropAcidPool(m);
  if (D.minBoom) nova(m.x, m.y, 95*D.aoeR, avgHit()*D.minDmgMul*MINION_DAMAGE_MULT*boneFieldDamageMul()*1.2*(G.bloodT>0?2:1), MKIND[m.kind].col,
    {minionShare:1, overpressure:true, grid:getEnemyGrid?getEnemyGrid():null});
  G.fx.push({t:'ring', x:m.x, y:m.y, r:m.r, max:m.r*2.2, life:0.25, col:MKIND[m.kind].col});
  burst(m.x, m.y, m.kind.startsWith('golem') ? 26 : 12, MKIND[m.kind].col, 190, 4, 0.7);
  G.minions.splice(i,1);
}

function enemyCause(e, attack){
  const rank = e.kind === 'boss' ? 'БОСС' : e.kind === 'elite' ? 'ЭЛИТА' : 'ВРАГ';
  return rank + ' · ' + e.t.nm + (e.affNm ? ' · ' + e.affNm : '') + ' · ' + attack;
}

/* Единая визуальная реакция на фактически потерянное здоровье. Интенсивность
   считается после всей защиты и щитов: заблокированный удар не должен трясти
   экран, а способность босса на долю max HP обязана ощущаться тяжелее контакта. */
const PLAYER_HP_LAG_TIME=0.4;
function playerDamageFeedback(damage, hpBefore){
  if (!(damage > 0)) return;
  const p=G.player, ratio=damage/Math.max(1,D.life);
  const tier=ratio < 0.05 ? 0 : ratio < 0.15 ? 1 : ratio < 0.30 ? 2 : 3;
  const shakeAmp=[2.5,3,5.5,7.5][tier], shakeLife=[0.08,0.10,0.135,0.15][tier];
  p.hitFlash=Math.max(p.hitFlash,0.06+tier*0.013);
  p.hpFlash=Math.max(p.hpFlash,0.15);
  const before=clamp(hpBefore/D.life,0,1);
  p.hpLag=Math.max(Number.isFinite(p.hpLag)?p.hpLag:before,before);
  p.hpLagFrom=p.hpLag; p.hpLagTimer=PLAYER_HP_LAG_TIME;
  G.hurtVignette=Math.max(G.hurtVignette,0.10+tier*0.025);
  G.hurtVignetteMax=G.hurtVignette;
  G.hurtVignetteOpacity=Math.max(G.hurtVignetteOpacity,0.12+0.48*clamp(ratio/0.30,0,1));
  pushScreenShake(shakeLife,shakeAmp);
  const hurtNumber=takeTransientFx('hurtNum');
  hurtNumber.x=p.x+rnd(-7,7);hurtNumber.y=p.y-p.r-15;hurtNumber.v='-'+Math.max(1,Math.round(damage));
  hurtNumber.life=0.4;hurtNumber.max=0.4;G.fx.push(hurtNumber);
  const partN=[4,5,6,6][tier];
  for (let i=0;i<partN;i++){
    const a=rnd(0,Math.PI*2), speed=rnd(45,135+tier*22), life=rnd(0.10,0.20);
    pushParticle(p.x+rnd(-2,2),p.y+rnd(-2,2),Math.cos(a)*speed,Math.sin(a)*speed,
      life,life,rndi(2,3),'#ff304f');
  }
  if (ratio >= 0.15) G.hitStop=Math.max(G.hitStop,tier === 3 ? 0.04 : 0.03);
}

/* Эти таймеры идут по реальному кадру, даже пока игровой action заморожен
   hit-stop'ом. Иначе 30 мс паузы искусственно растягивали бы flash и виньетку. */
function tickPlayerDamageFeedback(dt){
  if (!G) return;
  const p=G.player;
  p.hitFlash=Math.max(0,(p.hitFlash||0)-dt);
  p.hpFlash=Math.max(0,(p.hpFlash||0)-dt);
  G.hurtVignette=Math.max(0,(G.hurtVignette||0)-dt);
  if (G.hurtVignette <= 0){ G.hurtVignetteMax=0; G.hurtVignetteOpacity=0; }
  const hpNow=clamp(p.hp/D.life,0,1);
  if (hpNow>=p.hpLag){
    // Лечение, поднявшее настоящий HP выше хвоста, синхронизирует его сразу.
    p.hpLag=p.hpLagFrom=hpNow; p.hpLagTimer=0;
  } else if (p.hpLagTimer>0){
    p.hpLagTimer=Math.max(0,p.hpLagTimer-dt);
    const t=1-p.hpLagTimer/PLAYER_HP_LAG_TIME;
    p.hpLag=p.hpLagFrom+(hpNow-p.hpLagFrom)*t;
  } else p.hpLag=hpNow;
}
function triggerWarriorThorns(sourceEnemy, taken){
  if (!sourceEnemy || sourceEnemy.dead || sourceEnemy.hp<=0 || taken<=0 || D.thorns<=0) return 0;
  // Каждая карта даёт одинаковую долю от двух понятных опор: реально прошедшего
  // в HP удара и средней обычной атаки. Поэтому 25/50/75/100% масштабируют обе
  // части вместе, а защита героя уже честно учтена в taken.
  const reflected=(taken+attackAvgHit())*D.thorns/100;
  const dealt=applyDamage(sourceEnemy,reflected,false,false);
  statusText(sourceEnemy,'ШИПЫ','#9ad06f');
  if (D.thornCircle && dealt>0)
    nova(sourceEnemy.x,sourceEnemy.y,180*D.aoeR,dealt*0.50,'#8fcf65',
      {exclude:sourceEnemy,skipConstellation:true});
  return dealt;
}

function recordDeadGodState(){
  const p=G.player;
  if (!amu('deadGodClock')){ p.deadGodHistory.length=0; p.deadGodDamage.length=0; return; }
  const h=p.deadGodHistory;
  h.push({t:G.time,x:p.x,y:p.y,hp:p.hp});
  // Оставляем один опорный снимок до границы и все более новые: он нужен для
  // ближайшего состояния, которое существовало не позднее чем две секунды назад.
  const keepAfter=G.time-2.1;
  while (h.length>2 && h[1].t<keepAfter) h.shift();
  const dmg=p.deadGodDamage;
  while (dmg.length && dmg[0].t<G.time-2) dmg.shift();
}
function triggerDeadGodClock(taken){
  const p=G.player;
  if (!amu('deadGodClock') || G.over || G.amuT.deadGodClock>0 || !(taken>0)) return false;
  p.deadGodDamage.push({t:G.time,v:taken});
  while (p.deadGodDamage.length && p.deadGodDamage[0].t<G.time-2) p.deadGodDamage.shift();
  const lost=p.deadGodDamage.reduce((sum,x)=>sum+x.v,0);
  if (lost+1e-9<D.life*0.30) return false;
  const targetTime=G.time-2;
  let snap=null;
  for (let i=p.deadGodHistory.length-1;i>=0;i--){
    if (p.deadGodHistory[i].t<=targetTime+1e-9){ snap=p.deadGodHistory[i]; break; }
  }
  if (!snap) return false;
  p.x=clamp(snap.x,-ARENA,ARENA); p.y=clamp(snap.y,-ARENA,ARENA);
  p.hp=clamp(snap.hp,0,D.life);
  p.deadGodDamage.length=0;
  p.deadGodHistory=[{t:G.time,x:p.x,y:p.y,hp:p.hp}];
  G.amuT.deadGodClock=45;
  const hpRatio=clamp(p.hp/D.life,0,1);
  p.hpLag=p.hpLagFrom=hpRatio; p.hpLagTimer=0;
  G.fx.push({t:'txt',x:p.x,y:p.y-34,s:tr('ЧАСЫ МЁРТВОГО БОГА'),life:1.4,col:'#8d6bd6'});
  G.fx.push({t:'ring',x:p.x,y:p.y,r:8,max:150,life:0.65,col:'#8d6bd6'});
  return true;
}

function hurt(v, ignoreDefense, selfBlast, cause, sourceKind, sourceEnemy){
  const p = G.player, b = G.bag;
  // DEV_ZONE god mode перехватывает любой входящий урон в единой точке:
  // контакт, снаряды, лужи, DoT и собственные взрывы не обходят защиту.
  if (G.devZone && G.devGodMode) return;
  // Старые вызовы передают только подпись причины, поэтому ранг берём и из неё.
  // Новые опасности (лужи) передают sourceKind явно, не теряя владельца эффекта.
  const enemyRank = sourceKind || (cause && cause.startsWith('ВРАГ') ? 'norm' :
    cause && (cause.startsWith('ЭЛИТА') || cause.startsWith('БОСС') || cause.includes('БОСС')) ? 'elite' : '');
  if (p.inv > 0) return;                                          // i-frames рывка
  // СЕРДЦЕ ГОЛЕМА: заряд копится сам, тратится на первый же удар после готовности
  if (amu('golem') && G.amuT.golem <= 0 && !selfBlast){
    G.amuT.golem = 10;
    G.fx.push({t:'txt', x:p.x, y:p.y-30, s:'ЗАБЛОКИРОВАНО', life:0.9, col:'#9aa7b4'});
    G.fx.push({t:'ring', x:p.x, y:p.y, r:p.r, max:44, life:0.3, col:'#9aa7b4'});
    return;
  }
  if (!ignoreDefense){
    if (Math.random()*100 < D.dodge){
      G.fx.push({t:'txt',x:p.x,y:p.y-24,s:'уворот',life:.5,col:'#8be04e'});
      if (amu('reactionRing') && G.amuT.reactionRing<=0){
        p.reactionCritUntil=G.time+2; G.amuT.reactionRing=3;
        G.fx.push({t:'txt',x:p.x,y:p.y-42,s:tr('Кольцо Реакции'),life:.7,col:'#d7cf78'});
      }
      return;
    }
    const closeEnemies=nearbyWarriorEnemyCount();
    const crowdArmor=D.unburdened||D.unsheathedBlade ? 0 : D.steelCrowd*Math.min(6,closeEnemies)*(D.livingFortress?1.30:1);
    const armor=D.armor+crowdArmor;
    v *= 1 - armor/(armor + 90);
    v = Math.max(1, v - D.drFlat);
    if (D.drShop) v *= 1 - D.drShop/100;      // магазинная броня поверх, отдельным множителем
    if (enemyRank === 'norm') v *= 1 - D.normalDr/100;
    if (enemyRank === 'elite' || enemyRank === 'boss') v *= 1 - D.majorDr/100;
    if (D.holdLine) v *= 1-Math.min(5,closeEnemies)*0.02;
  }
  // ПАНЦИРЬ ЦЕЛОГО и ПОСЛЕДНЯЯ БРОНЯ: два взаимоисключающих порога
  if (amu('fullplate') && p.hp >= D.life) v *= 0.65;
  if (amu('lastplate') && p.hp/D.life < 0.20) v *= 0.60;
  // СТАЛЬНАЯ ВОЛЯ: потолок на один удар, не чаще раза в 10 сек
  if (amu('steel') && G.amuT.steel <= 0 && v > D.life*0.8){
    v = D.life*0.8; G.amuT.steel = 10;
    G.fx.push({t:'txt', x:p.x, y:p.y-30, s:'СТАЛЬНАЯ ВОЛЯ', life:1.1, col:'#6fb3ff'});
  }
  // Временный «Запас прочности» расходуется раньше постоянных барьеров:
  // у него есть срок жизни, поэтому держать его за бессрочным щитом было бы
  // скрытым штрафом. Полностью поглощённый удар не сбивает «Передышку».
  if (p.reserveBarrier > 0){
    const eaten=Math.min(p.reserveBarrier,v);
    p.reserveBarrier-=eaten; v-=eaten;
    G.fx.push({t:'ring',x:p.x,y:p.y,r:p.r+9,max:p.r+18,life:0.2,col:'#6fb3ff'});
    if (p.reserveBarrier<=0){ p.reserveBarrier=0; p.reserveBarrierT=0; }
    if (v<=0) return;
  }
  // ТАЛИСМАН ПОКОЯ: барьер съедает урон раньше здоровья
  if (p.barrier > 0){
    const eaten = Math.min(p.barrier, v);
    p.barrier -= eaten; v -= eaten;
    G.fx.push({t:'ring', x:p.x, y:p.y, r:p.r+6, max:p.r+16, life:0.2, col:'#5ec2e0'});
    if (p.barrier <= 0) G.amuT.calm = 5;              // откат считается от момента расхода
    if (v <= 0) return;
  }
  // Красный щит УЖАСАЮЩЕГО ВАМПИРА — запас здоровья поверх основного HP.
  if (p.dreadShield > 0){
    const eaten = Math.min(p.dreadShield, v);
    p.dreadShield -= eaten; v -= eaten;
    G.fx.push({t:'ring', x:p.x, y:p.y, r:p.r+11, max:p.r+21, life:0.22, col:'#cf2135'});
    if (v <= 0) return;
  }
  // ПОСЛЕДНИЙ ВЗДОХ: оставляет единицу здоровья и две секунды неуязвимости
  if (p.hp - v <= 0 && amu('breath') && G.amuT.breath <= 0){
    const hpBefore=p.hp;
    G.amuT.breath = 120; p.hp = 1; p.inv = 2;
    playerDamageFeedback(Math.max(0,hpBefore-p.hp),hpBefore);
    G.fx.push({t:'txt', x:p.x, y:p.y-30, s:'ПОСЛЕДНИЙ ВЗДОХ', life:1.6, col:'#ff5a4e'});
    G.fx.push({t:'ring', x:p.x, y:p.y, r:8, max:170, life:0.7, col:'#ff5a4e'});
    return;
  }
  // КУКЛА СМЕРТИ: один заряд на этаж, гасит удар целиком
  if (p.hp - v <= 0 && amu('doll') && G.amuT.doll > 0){
    G.amuT.doll = 0; p.inv = 1.5;
    G.fx.push({t:'txt', x:p.x, y:p.y-30, s:'КУКЛА РАССЫПАЛАСЬ', life:1.4, col:'#ff5a4e'});
    G.fx.push({t:'ring', x:p.x, y:p.y, r:8, max:150, life:0.6, col:'#ff5a4e'});
    burst(p.x, p.y, 40, '#ff5a4e', 280, 4, 0.9);
    return;
  }
  // ОБМАН СМЕРТИ: гарантированное спасение без скрытого лечения. Единый hurt()
  // охватывает контакт, снаряды, лужи, боссов и собственный опасный взрыв.
  if (p.hp - v <= 0 && b.has('cheat') && p.cheatCd <= 0){
    const hpBefore=p.hp;
    p.cheatCd = 60; p.hp = 1; p.inv = 1; p.cheatSpeedT = 1; recalc();
    playerDamageFeedback(Math.max(0,hpBefore-p.hp),hpBefore);
    G.fx.push({t:'txt', x:p.x, y:p.y-30, s:'ОБМАН СМЕРТИ', life:1.2, col:'#ff8a3d'});
    G.fx.push({t:'ring', x:p.x, y:p.y, r:8, max:160, life:0.65, col:'#ff8a3d'});
    burst(p.x,p.y,24,'#ff8a3d',250,4,0.7); return;
  }
  // min.bond / кейстоун «Некромантская связь»: часть урона принимает свита.
  // Свой же взрыв трупа сюда не попадает: перекладывать его на скелетов значит
  // убивать собственную армию за то, что билд работает как задумано.
  // КРОВНЫЕ УЗЫ: отсчёт идёт от ЛЮБОГО попадания по игроку, даже если перехват
  // съел его целиком — свиту злит сам факт удара, а не остаток урона
  if (D.bloodTies && !selfBlast){
    G.bloodT = 3;
    G.fx.push({t:'ring', x:p.x, y:p.y, r:p.r, max:70, life:0.35, col:'#ff2a2a'});
  }
  if (D.minBond && G.minions.length && !selfBlast){
    const share = v * D.minBond/100; v -= share;
    const m = pick(G.minions); m.hp -= share; m.hit = 0.12;
    boilRoll(m);                                       // перехваченный удар тоже считается ударом
    if (m.hp <= 0) killMinion(G.minions.indexOf(m));   // индекс проверяется внутри killMinion
  }
  const hpBefore=p.hp;
  G.stats.taken += v;
  if (v>0){
    p.respiteT=0; p.respiteHealT=3;
    if (p.trailfinderActive){ p.trailfinderActive=false; p.trailfinderT=0; recalc(); }
    else p.trailfinderT=0;
    if (amu('knottedCharm') && G.amuT.knottedCharm<=0 && p.dashN<D.dashMax){
      if (!(p.dashCd>0)) p.dashCd=D.dashCd;
      p.dashCd=Math.max(0,p.dashCd-D.dashCd*0.15);
      if (p.dashCd<=0){
        p.dashN++;
        p.dashCd=p.dashN<D.dashMax?D.dashCd:0;
      }
      G.amuT.knottedCharm=1.5;
    }
  }
  p.hp -= v;
  if (v>0) triggerWarriorThorns(sourceEnemy,v);
  if (v>0 && sourceEnemy && D.ironFury){
    p.ironFuryPct=Math.min(25,(p.ironFuryPct||0)+5);
    p.ironFuryT=3;
    recalc();
  }
  if (v > 0 && D.counterTempoPerHit > 0 && cause && cause.includes('контакт')){
    p.counterTempoPct=Math.min(200,(p.counterTempoPct||0)+D.counterTempoPerHit);
    p.counterTempoT=(p.counterTempoT||0)+2;
    recalc();
  }
  playerDamageFeedback(v,hpBefore);
  if (v>0) triggerDeadGodClock(v);
  if (v > 0) p.deathLog = {cause:cause || (selfBlast ? 'СОБСТВЕННЫЙ ВЗРЫВ' : 'НЕИЗВЕСТНЫЙ УРОН'), dmg:Math.ceil(v)};
  if (b.has('retal')) nova(p.x, p.y, 130*D.aoeR, avgHit()*0.5, '#e0405a', {overpressure:true});
  if (amu('riposte')) p.riposte = true;          // КОНТРУДАР заряжается от любого попадания
  // ЧЁРНОЕ ЗЕРКАЛО: копия встаёт от удара, а не по таймеру — это реакция, не аура
  if (amu('mirror') && G.amuT.mirror <= 0 && !selfBlast){
    G.amuT.mirror = 10;
    G.clone = {x:p.x + rnd(-40,40), y:p.y + rnd(-40,40), aim:p.aim, cd:0, life:3};
    G.fx.push({t:'ring', x:G.clone.x, y:G.clone.y, r:8, max:60, life:0.4, col:'#c08cff'});
  }
  if (p.hp <= 0) gameOver();
}

/* ---------- 6c. КРУГОВЫЕ ОРБЫ ----------
   Орбы висят на общем кольце вокруг игрока и равномерно расставлены по нему.
   Урон идёт через обычный damage(), поэтому криты, стихии, книги и статусы
   работают на них так же, как на автоатаке. */
const ORBIT_R = 88.8, ORBIT_SIZE = 7, ORBIT_SPD = 1.7; // прежний радиус 74 + 20%

function orbitPos(i){
  const a = G.orbitA + i * Math.PI*2 / D.orbitN;
  const r = ORBIT_R * D.aoeR;                       // радиус кольца растёт от модификаторов области
  return {x: G.player.x + Math.cos(a)*r, y: G.player.y + Math.sin(a)*r};
}

function updateOrbits(dt){
  if (!D.orbitN) return;
  // Кольцо крутится тем быстрее, чем выше скорость атаки: орб — это оружие,
  // и логично, что «быстрее бьёшь» означает «быстрее обходишь цели».
  // Учти, что на большом числе орбов прибавка съедается откатом e.orbCd:
  // при десяти орбах цель и так задевается каждые 0.37 сек против отката 0.45.
  G.orbitA += ORBIT_SPD * D.aspd * dt;
  const size = ORBIT_SIZE * D.projSize;
  let damageConditions=null;
  for (const e of G.enemies){
    e.orbCd -= dt;
    if (e.orbCd > 0) continue;                      // откат на цель, иначе орб бьёт 60 раз в секунду
    for (let i = 0; i < D.orbitN; i++){
      const o = orbitPos(i);
      if (dist(o, e) > e.r + size) continue;
      if (!damageConditions) damageConditions=damageConditionSnapshot(G.player);
      damage(e, {attackMul:0.25, warriorMelee:true,...damageConditions});// 25% всей воинской автоатаки: модификаторы и шансы общие
      burst(o.x, o.y, 3, '#6fb3ff', 120, 3, 0.3);
      e.orbCd = 0.45;
      break;
    }
  }
}
