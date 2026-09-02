/* ---------- 10. ИНТЕРФЕЙС ---------- */
const $ = s => document.querySelector(s);
function totalPlayerBarrier(p){ return Math.max(0,p.barrier||0)+Math.max(0,p.reserveBarrier||0); }
function playerHealthText(p){
  const barrier=Math.ceil(totalPlayerBarrier(p));
  const shield=Math.ceil(Math.max(0,p.dreadShield||0));
  return Math.ceil(Math.max(0,p.hp))+' / '+Math.round(D.life)+
    (barrier?' +'+barrier+(LANGUAGE==='en'?' barrier':' барьер'):'')+
    (shield?' (+'+shield+(LANGUAGE==='en'?' shield)':' щита)'):'');
}
function nearbyWarriorEnemyCount(){
  if (!G || !G.player || !G.enemies) return 0;
  let n=0;
  for (const e of G.enemies) if (!e.dead && dist(e,G.player)<=300) n++;
  return n;
}
function nearbyDamageEnemyCount(from=G && G.player){
  if (!G || !from || !G.enemies) return 0;
  let n=0;
  for (const e of G.enemies) if (!e.dead && dist(e,from)<220 && ++n>=8) return 8;
  return n;
}
function activeCombatBuffs(p, nearby=nearbyWarriorEnemyCount(), damageNearby=nearbyDamageEnemyCount(p)){
  const buffs=[], bag=G && G.bag, stillPct=bag ? bag.sum('whStill') : 0,
    movingPct=bag ? bag.sum('whMove') : 0, perNear=bag ? bag.sum('perNear') : 0,
    recentKillPct=bag ? bag.sum('afterKill') : 0;
  if (amu('heartSecond')) buffs.push(tr('Сердце секунды')+' · '+Math.round((p.heartSecondCharge||0)*100)+'% '+tr('заряда')+
    ' · +'+Math.round((p.heartSecondCharge||0)*100)+'% '+tr('скорости атаки'));
  if (amu('copperChronometer') && p.copperReady) buffs.push(tr('Медный Хронометр +25% урона'));
  if (amu('hobnailedSoles') && p.hobnailedActive) buffs.push(tr('Шипованные Подошвы - +20 к броне'));
  if (amu('trailfinders') && p.trailfinderActive) buffs.push(tr('Следопыта +10% скорости перемещения'));
  if (amu('sealPack')) buffs.push(tr('Печать Стаи')+' - +'+sealPackDamagePct()+'% '+tr('урона'));
  if (amu('marchingGreaves') && p.marchingActive)
    buffs.push(tr('Маршевые Поножи')+' - '+tr('Свита +20% скорости передвижения, +10% скорости атаки'));
  if (amu('secondWindRing')) buffs.push(tr('Кольцо Второго Дыхания')+' - '+(p.secondWindKills||0)+'/40 '+tr('убийств'));
  if (amu('confinementRing')) buffs.push(tr('Кольцо Тесноты')+' - +'+confinementDamagePct()+'% '+tr('ко всему урону'));
  if (amu('ledgerDebts')) buffs.push(tr('Книга Долгов')+' - '+ledgerStacks()+'/20 · +'+(ledgerStacks()*3)+'% '+
    tr('урона героя')+' · +'+(ledgerStacks()*2)+'% HP '+tr('врагов'));
  if (stillPct>0 && p.stillT>0.6) buffs.push(tr('Стоит на месте')+' - +'+stillPct+'% '+tr('урона'));
  if (movingPct>0 && p.moving) buffs.push(tr('В движении')+' - '+tr('урон')+' +'+movingPct+'%');
  if (perNear>0 && damageNearby>0) buffs.push(tr('Враги рядом')+' +'+Math.round(perNear*damageNearby)+'% '+tr('урона'));
  if (recentKillPct>0 && p.killT>0) buffs.push(tr('Недавнее убийство')+' - '+tr('урон')+' +'+recentKillPct+'% · '+impactNumber(Math.max(0,p.killT))+' '+tr('с осталось'));
  if (p.spdKill>0) buffs.push(tr('Недавнее убийство')+' +25% '+tr('скорости')+' - '+p.spdKill.toFixed(1)+' '+tr('секунд'));
  if (amu('predator') && p.predT>0) buffs.push(tr('Глаз хищника')+' - +20% '+tr('урона')+' - '+p.predT.toFixed(1)+' '+tr('секунд'));
  const momentumPct=momentumDamageInc(p);
  if (momentumPct>0) buffs.push(tr('Разгон')+' +'+momentumPct+'% '+tr('урона'));
  if (amu('critaim') && p.stillT>1) buffs.push(tr('Критический прицел')+' - +25% '+tr('к шансу критического удара'));
  if (D.steelCrowd>0) buffs.push(tr('Стальная толпа')+' +'+(D.steelCrowd*Math.min(6,nearby))+' '+tr('брони'));
  if (D.holdLine) buffs.push(tr('Глухая оборона')+' · '+tr('урон уменьшен на')+' '+(Math.min(5,nearby)*2)+'%');
  if (D.groundbreaker){
    const waves=3-((p.groundbreakerWaveN||0)%3);
    buffs.push(waves===1 ? tr('Землелом — ВОЛНА!') : tr('Землелом через')+' '+waves+' '+tr('волны'));
  }
  if (D.perfectRhythm && !D.noCrit){
    /* Некромант не атакует лично: для него полезен общий счётчик свиты.
       Остальные классы видят собственный ритм прямых атак. */
    const rhythmN=G.weapon && G.weapon.minions ? p.perfectRhythmMinionN : p.perfectRhythmHeroN;
    const attacksLeft=7-(Math.max(0,rhythmN||0)%7);
    buffs.push(attacksLeft===1
      ? tr('Идеальный ритм — КРИТ!')
      : tr('Идеальный ритм')+' - '+tr('крит через')+' '+attacksLeft+' '+tr('атак'));
  }
  if (D.timeDebt){
    const pct=Math.round(p.timeDebtPct||0);
    if (p.timeDebtCoolingT>0){
      let state=tr('Долг времени')+' +'+pct+'% '+tr('скорости атаки')+' · '+tr('Остывание')+' '+
        p.timeDebtCoolingT.toFixed(1)+' '+tr('с осталось')+' · '+tr('рывки')+' '+p.dashN+'/'+D.dashMax;
      if (p.dashN<D.dashMax) state+=' · '+tr('заряд через')+' '+p.dashCd.toFixed(1)+' '+tr('с осталось');
      buffs.push(state);
    } else if (p.timeDebtT>0){
      buffs.push(tr('Долг времени')+' +'+pct+'% '+tr('скорости атаки')+' · '+p.timeDebtT.toFixed(1)+' '+tr('с осталось'));
    } else buffs.push(tr('Долг времени')+' · '+tr('готово'));
  }
  if (p.counterTempoT>0) buffs.push(tr('Ответный темп')+' +'+Math.round(p.counterTempoPct)+'% '+tr('скорости атаки')+' · '+p.counterTempoT.toFixed(1)+' '+tr('с осталось'));
  if (p.ironFuryT>0) buffs.push(tr('Железная ярость')+' - '+tr('урон увеличен на')+' '+Math.round(p.ironFuryPct)+'% - '+p.ironFuryT.toFixed(1)+' '+tr('секунд'));
  if (p.overheatedT>0) buffs.push(tr('Перегретая сфера')+' +'+Math.round(p.overheatedPct)+'% '+tr('скорости атаки')+' · '+p.overheatedT.toFixed(1)+' '+tr('секунд'));
  if (D.boneField>0) buffs.push(tr('Поле костей')+' +'+impactNumber(boneFieldDamageInc(p))+'% '+tr('урона свиты'));
  if (D.respite && !G.portal && p.respiteT>=4 && p.hp<D.life*0.60)
    buffs.push(tr('Передышка')+' - '+tr('восстановление 5% HP через')+' '+Math.max(0,p.respiteHealT).toFixed(1)+' '+tr('секунд'));
  if (D.criticalMass && !D.noCrit)
    buffs.push(tr('Критическая масса')+' - +'+Math.round(p.criticalMass||0)+'% '+tr('шанса критического удара'));
  if (p.reserveBarrier>0 && p.reserveBarrierT>0)
    buffs.push(tr('Запас прочности')+' - '+tr('барьер на')+' '+Math.ceil(p.reserveBarrier)+' HP - '+p.reserveBarrierT.toFixed(1)+' '+tr('секунд'));
  return buffs;
}
/* HUD живёт в DOM поверх Canvas. Сами значения дешёвые, но
   повторные querySelector/innerHTML каждый RAF запускали style/layout и
   создавали мусор. Ссылки и последние записанные значения храним
   здесь; новый объект G автоматически сбрасывает кэш между забегами. */
const HUD_DOM={hpbar:null,hp:null,hpLag:null,hpText:null,xp:null,lvl:null,floor:null,left:null,
  gold:null,buffs:null,pack:null,books:null,dps:null};
const HUD_STATE={run:null,values:Object.create(null),buffTick:-1,buffLanguage:'',inventorySignature:''};
function resetHudState(run){
  HUD_STATE.run=run; HUD_STATE.values=Object.create(null);
  HUD_STATE.buffTick=-1; HUD_STATE.buffLanguage=''; HUD_STATE.inventorySignature='';
}
function hudElements(){
  if (!HUD_DOM.hpbar || HUD_DOM.hpbar.isConnected===false){
    const hpbar=$('#hpbar');
    HUD_DOM.hpbar=hpbar; HUD_DOM.hp=$('#hpbar i'); HUD_DOM.hpLag=$('#hpbar b');
    HUD_DOM.hpText=$('#hpbar span'); HUD_DOM.xp=$('#xpbar i'); HUD_DOM.lvl=$('#lvl');
    HUD_DOM.floor=$('#floor'); HUD_DOM.left=$('#left'); HUD_DOM.gold=$('#goldbox');
    HUD_DOM.buffs=$('#warriorbuffs'); HUD_DOM.pack=$('#packbar'); HUD_DOM.books=$('#books');
    HUD_DOM.dps=$('#dpsinfo'); resetHudState(G);
  }
  return HUD_DOM;
}
function hudWrite(key,node,prop,value){
  if (!node || HUD_STATE.values[key]===value) return false;
  node[prop]=value; HUD_STATE.values[key]=value; return true;
}
function hudStyle(key,node,prop,value){
  if (!node || HUD_STATE.values[key]===value) return false;
  node.style[prop]=value; HUD_STATE.values[key]=value; return true;
}
function hudInventorySignature(){
  let sig=LANGUAGE;
  for (const k of BOOK_KEYS){
    const it=G.items[k]; if (it) sig+='|b:'+k+':'+it.val+':'+it.tier+':'+(BOOKS[k].proc?bookChance(k):'');
  }
  for (const k of TOTEM_KEYS){ const tier=totemTier(k); if (tier) sig+='|t:'+k+':'+tier+':'+totemVal(k); }
  for (const k of AMU_KEYS) if (G.amu[k]){
    const cd=G.amuT[k],state=k==='doll'?(G.amuT.doll>0?'whole':'broken'):
      (cd===undefined?'ready':cd<=0?'ready':Math.ceil(cd));
    sig+='|a:'+k+':'+state;
  }
  return sig;
}
function hudInventoryHtml(){
  return BOOK_KEYS.filter(k => G.items[k]).map(k => {
    const B = BOOKS[k], it = G.items[k];
    const val = (B.pct || k === 'monster' || k === 'xp') ? '+' + it.val + '%' : '+' + it.val;
    return '<div class="bk" style="border-color:' + B.col + ';color:' + B.col + '" title="' + B.nm + '">' +
      '<span class="ic">' + lootSpriteHTML(k,'hud') + '</span>' +
      '<span class="vl">' + val + '</span>' +
      (B.proc ? '<span class="tr">' + bookChance(k) + '%</span>' : '') +
      '<span class="tr">T' + it.tier + '</span></div>';
  }).join('') +
  // Амулеты рядом с книгами: у них нет тира, зато у части есть откат — его и показываем
  TOTEM_KEYS.filter(k => totemTier(k)).map(k => {
    const T = TOTEMS[k];
    return '<div class="bk" style="border-color:' + T.col + ';color:' + T.col + '" title="' +
      TOTEM_RANKS[totemTier(k)-1] + ' ' + T.nm + '">' +
      '<span class="ic">' + totemSpriteHTML(k,totemTier(k),'hud') + '</span><span class="tr">+' + totemVal(k) + '%</span></div>';
  }).join('') +
  AMU_KEYS.filter(k => G.amu[k]).map(k => {
    const A = AMULETS[k];
    const cd = G.amuT[k];
    const rdy = k === 'doll' ? (G.amuT.doll > 0) : (cd !== undefined ? cd <= 0 : true);
    return '<div class="bk" style="border-color:' + A.col + ';color:' + A.col +
      (rdy ? '' : ';opacity:.45') + '" title="' + A.nm + '">' +
      '<span class="ic">' + rareItemSpriteHTML(k,'hud') + '</span>' +
      (cd !== undefined && k !== 'doll' && cd > 0 ? '<span class="tr">' + Math.ceil(cd) + 'с</span>' : '') +
      (k === 'doll' ? '<span class="tr">' + (G.amuT.doll > 0 ? 'цел' : 'разбит') + '</span>' : '') +
      '</div>';
  }).join('');
}
function updateHud(){
  const p=G.player,h=hudElements();
  if (HUD_STATE.run!==G) resetHudState(G);
  const hpPct=clamp(p.hp/D.life*100,0,100),hpWidth=hpPct+'%',
        hpLagWidth=Math.max(hpPct,clamp((p.hpLag||0)*100,0,100))+'%';
  hudStyle('hpWidth',h.hp,'width',hpWidth);
  hudStyle('hpLagWidth',h.hpLag,'width',hpLagWidth);
  const hurt=p.hpFlash>0;
  if (HUD_STATE.values.hpHurt!==hurt){ h.hpbar.classList.toggle('hurt',hurt); HUD_STATE.values.hpHurt=hurt; }
  hudWrite('hpText',h.hpText,'textContent',playerHealthText(p));
  hudStyle('xpWidth',h.xp,'width',clamp(G.xp/G.xpNext*100,0,100)+'%');
  hudWrite('level',h.lvl,'textContent',G.lvl);
  hudWrite('floor',h.floor,'textContent',G.devZone?'DEV':G.floor);
  hudWrite('enemiesLeft',h.left,'textContent','врагов: '+(G.enemies.length+G.spawnQueue));
  hudWrite('gold',h.gold,'innerHTML',Math.floor(G.gold)+' <span class="k">золота</span>');

  // Таймеры в тексте баффов имеют точность 0,1 с, поэтому чаще их
  // пересобирать нет смысла. Смена языка обходит таймер.
  const buffTick=Math.floor(G.time*10);
  if (HUD_STATE.buffTick!==buffTick || HUD_STATE.buffLanguage!==LANGUAGE){
    HUD_STATE.buffTick=buffTick; HUD_STATE.buffLanguage=LANGUAGE;
    const buffs=activeCombatBuffs(p),buffHtml=buffs.map(x=>'<div>'+x+'</div>').join('');
    hudStyle('buffDisplay',h.buffs,'display',buffs.length?'block':'none');
    hudWrite('buffHtml',h.buffs,'innerHTML',buffHtml);
  }

  // Панель пачки меняется только при смене живой пачки или числа её участников.
  const pkAlive=G.packs.find(x=>x.members.length);
  if (pkAlive){
    const packSignature=pkAlive.members.length+'|'+pkAlive.aff.map(a=>a.id+':'+a.nm+':'+a.col).join('|');
    hudStyle('packDisplay',h.pack,'display','block');
    if (HUD_STATE.values.packSignature!==packSignature){
      const tags=pkAlive.aff.map(a=>'<span style="color:'+a.col+'">'+a.nm+'</span>')
        .join('<span class="psep">\u00B7</span>');
      hudWrite('packHtml',h.pack,'innerHTML','<div class="pt">ПАЧКА \u00B7 ЖИВЫХ '+pkAlive.members.length+'</div>'+
        '<div class="pa">'+tags+'</div>');
      HUD_STATE.values.packSignature=packSignature;
    }
  } else hudStyle('packDisplay',h.pack,'display','none');

  // Книги, тотемы и амулеты пересобираются лишь при смене состава или
  // отображаемой целой секунды отката.
  const inventorySignature=hudInventorySignature();
  if (HUD_STATE.inventorySignature!==inventorySignature){
    HUD_STATE.inventorySignature=inventorySignature;
    hudWrite('inventoryHtml',h.books,'innerHTML',hudInventoryHtml());
  }
  // У некроманта в строке показываем урон свиты: своего у него нет
  const dpsText=G.weapon.noAttack
    ? 'свита ≈ ' + Math.round(avgHit()*D.minDmgMul*MINION_DAMAGE_MULT*(D.minAspd/0.5)*Math.max(1, G.minions.length)) + ' урона/сек'
    : 'урон/сек ≈ ' + Math.round(attackAvgHit()/currentAttackCooldown()*(G.weapon.type==='proj'?D.projN:1))
    + ' · рывки ' + G.player.dashN + '/' + D.dashMax
    + (G.player.dashN < D.dashMax ? ' · заряд через ' + G.player.dashCd.toFixed(1) + 'с' : '')
    + (D.hasMin ? ' · свита ' + G.minions.length + '/' + D.minMax : '');
  hudWrite('dpsText',h.dps,'textContent',dpsText);
}

let toastT = null;
function toast(s){
  const el = $('#toast'); el.textContent = s; el.style.opacity = 1;
  clearTimeout(toastT); toastT = setTimeout(()=> el.style.opacity = 0, 1400);
}

/* Крупное объявление посреди экрана, без паузы. Заголовок и подпись под ним. */
let pickupT = null;
function pickupBanner(title, sub, col){
  const el = $('#pickup');
  el.innerHTML = '<div class="pn" style="color:' + col + '">' + title + '</div>' +
                 (sub ? '<div class="pv">' + sub + '</div>' : '');
  el.style.opacity = 1;
  clearTimeout(pickupT); pickupT = setTimeout(()=> el.style.opacity = 0, 1600);
}

/* Статы, чей бонус доходит до свиты. Держать этот список руками приходится
   потому, что «доходит» означает разные вещи: одни статы входят в avgHit(),
   другие срабатывают внутри damage() на ударе приспешника, третьи (скорости)
   не меняют силу удара, а меняют их количество. Автоматически такое не выведешь.
   Каждая строка проверена замером удара приспешника — см. minallunit.js.
   ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ: вся защита (броня, уклонение, блок, реген,
   вампиризм) — свита считает живучесть только от базового D.minLife; геометрия снарядов
   (число, пробитие, отскок, дробовик) — у приспешников свои выстрелы; лут и
   опыт — это про хозяина. */
const MINION_STATS = new Set([
  // Урон и его проценты: удар свиты считается от avgHit(), туда входит всё это
  'dmg','dmgAoe','dmgProj','dmgMelee','lucky','pctHp','execute',
  'dFire','iFire','dCold','iCold','dLit','iLit','dPoi','iPoi',
  'dblHit','deadlyHit',
  // Статусы и эффекты — накладываются внутри damage() на ударе приспешника
  'igniteCh','chillCh','freeze','shockCh','tesla','poiCh','radiation','ailEff','ailDur',
  'knock','dizzy','stun','inferno',
  // Условные проценты; ближайшие враги считаются вокруг самого приспешника
  'vsLow','vsFull','vsBoss','vsSlowed','whMove','whStill','perNear','afterKill',
  // Криты: шанс наследуется целиком, множитель и надстройки общие
  'critCh','critMul','superCh','critWave',
  // Прирост скоростей хозяина входит в общую additive-корзину скоростей свиты
  'aspd','mspd',
  // Площадь: радиус взрыва приспешника при смерти и «Буйства демонов»
  'aoeR',
  // Снаряды бомбардиров: скорость и размер наследуются от героя.
  'projSpd','pierce','chain',
  // Срабатывает на убийстве — неважно, чьём
  'explode','explodeMega','novaKill','novaKillStrong','overpressure','coldShatter','onKill',
  // Сужение разброса и «Радиус в урон» правят базу и D.incAll, а их свита читает
  'narrow','aoeToDmg',
  // Кейстоуны, идущие через общий множитель урона или через скорости
  'kGlass','kNoCrit','kHeavy','kFlurry','kAcro','kUnburd','kBond',
]);
/* Что уже накоплено по этому стату — чтобы игрок видел, к чему прибавляет.
   Читаем сумку напрямую: она и есть источник правды, никаких вторых счётчиков.
   Флаги пропускаем: у них нет «текущего значения», они либо взяты, либо нет,
   а взятые из раздачи и так вырезаны. */
function currentOf(m){
  if (m.kind === 'flag') return null;
  if (m.id === 'spd.action') return '×' + D.attackSpeedMore.toFixed(2);
  const e = G.bag.s[m.stat];
  if (!e) return m.kind === 'more' ? '×1.00' : '0';
  if (m.kind === 'more')   return '×' + e.more.toFixed(2);
  if (m.kind === 'inc')    return (e.inc ? '+' : '') + Math.round(e.inc) + '%';
  if (m.kind === 'chance') return Math.round(m.cap === undefined ? e.flat : Math.min(e.flat, m.cap)) + '%';
  return (e.flat ? '+' : '') + (e.flat < 10 ? +e.flat.toFixed(1) : Math.round(e.flat));
}

/* Карточка лимита скелетов показывает не абстрактный flat-стат, а весь
   понятный переход: новый предел и номер из трёх доступных рангов. */
function levelCardBodyHtml(card){
  const m=card.m;
  if (m.id==='min.count'){
    const rank=Math.min(SKELETON_CARD_RANKS,skeletonCardRank()+1);
    const now=D.maxSkel, next=now+1;
    return '<div class="nt skeleton-card-progress">' +
      '<div>' + tr('Максимум скелетов:') + ' +1</div>' +
      '<div>' + tr('Сейчас:') + ' ' + now + ' → ' + next + '</div>' +
      '<div>' + tr('Ранг:') + ' ' + rank + '/' + SKELETON_CARD_RANKS + '</div></div>';
  }
  return '<div class="vl">' + card.val +
    (currentOf(m)!==null?'<span class="cur">'+tr('сейчас')+' '+currentOf(m)+'</span>':'') + '</div>' +
    cardInlineExample(m,card) + '<div class="nt">' + (m.nt||'') + '</div>';
}

/* Числовой прогноз карточки для текущего билда. Это не второй калькулятор:
   на время создаём ровно тот же модификатор в сумке, запускаем канонический
   recalc(), снимаем показатели и полностью возвращаем прежнее состояние.
   Благодаря этому подсказка автоматически учитывает класс, уровень, магазин,
   книги, предметы, кейстоуны и уже выбранные карточки. */
function skillImpactSnapshot(m){
  const hit = attackAvgHit(), aps = 1/Math.max(0.0001,D.atkCd);
  const minionHit = avgHit() * (D.minDmgMul||0) * MINION_DAMAGE_MULT;
  const minionCount = Math.max(1, G.minions ? G.minions.length : 0);
  return {
    hit, aps, dps:hit*aps,
    projN:D.projN, volley:hit*D.projN, volleyDps:hit*aps*D.projN,
    minionHit, minionDps:minionHit*((D.minAspd||0)/0.5)*minionCount,
    life:D.life, regen:D.regen, armor:D.armor, dodge:D.dodge,
    leech:D.leechBase, critCh:D.critCh, critMul:D.critMul, mspd:D.mspd,
    pierce:D.pierce, chain:D.chain, ricochet:D.ricochet,
    projSpd:D.projSpd, projSize:(D.projSize-1)*100, arcanePull:D.arcanePull, aoeR:(D.aoeR-1)*100,
    arc:(D.arc-1)*100, orbitN:D.orbitN, orbitTouch:hit*0.25*D.orbitN,
    explode:D.explodeBase, dblHit:D.dblHit,
    igniteCh:D.igniteCh, chillCh:D.chillCh, shockCh:D.shockCh, poiCh:D.poiCh,
    knock:D.knock, stun:D.stun, superCh:D.superCh,
    xpGain:(D.xpGain-1)*100, goldFind:(D.goldFind-1)*100,
    minCount:D.minMax, minAspd:D.minAspd, minSpd:D.minSpd,
    pctHp:D.pctHp,
  };
}

function projectedSkillImpact(m, v){
  const b=G.bag, p=G.player, had=Object.prototype.hasOwnProperty.call(b.s,m.stat);
  const old=had ? {flat:b.s[m.stat].flat,inc:b.s[m.stat].inc,more:b.s[m.stat].more} : null;
  const playerState=p ? {hp:p.hp,dreadShield:p.dreadShield} : null;
  const before=skillImpactSnapshot(m); let after=before;
  try{
    b.add(m.stat,m.kind,v); recalc(); after=skillImpactSnapshot(m);
  } finally {
    if (had) b.s[m.stat]=old; else delete b.s[m.stat];
    recalc();
    if (p && playerState){ p.hp=playerState.hp; p.dreadShield=playerState.dreadShield; }
  }
  return {before,after};
}

const impactText=(ru,en)=>LANGUAGE==='en'?en:ru;
function impactRow(rows,key,ru,en,before,after,unit='',points=false){
  if (!Number.isFinite(before) || !Number.isFinite(after) || Math.abs(after-before)<1e-8) return;
  rows.push({key,label:impactText(ru,en),before,after,unit,points});
}

/* Структурированные строки вынесены отдельно от HTML: тесты проверяют сами
   числа, а не ищут удачную подстроку в разметке. */
function cardImpactData(m, card){
  const v=Number(card && card.v !== undefined ? card.v : 0), rows=[], notes=[];
  if (!Number.isFinite(v)) return {rows,notes};
  const conditional={
    vsLow:['conditionalHit','Средний удар по раненой цели','Average hit vs an Injured target',1],
    vsFull:['conditionalHit','Первый средний удар по полной цели','First average hit vs a Full-HP target',1],
    vsBoss:['conditionalHit','Средний удар по элите или боссу','Average hit vs an elite or boss',1],
    whMove:['conditionalHit','Средний удар в движении','Average hit while moving',1],
    whStill:['conditionalHit','Средний удар без движения','Average hit while stationary',1],
    afterKill:['conditionalHit','Средний удар в течение 1 сек после убийства','Average hit for 1 sec after a kill',1],
    perNear:['conditionalHit','Средний удар при 8 врагах рядом','Average hit with 8 nearby enemies',8],
  }[m.stat];
  if (conditional){
    const snap=skillImpactSnapshot(m), current=G.bag.sum(m.stat);
    let oldBonus=current*conditional[3], newBonus=(current+v)*conditional[3];
    const normal=G.weapon.noAttack?snap.minionHit:snap.hit;
    const denom=1+D.incAll/100, raw=Math.abs(denom)>1e-8?normal/denom:normal;
    const oldHit=raw*(1+(D.incAll+oldBonus)/100), newHit=raw*(1+(D.incAll+newBonus)/100);
    impactRow(rows,conditional[0],conditional[1],conditional[2],oldHit,newHit,impactText(' урона',' damage'));
    notes.push(impactText('Показано при выполнении указанного условия; другие временные условия не добавлены.',
      'Shown while this condition is met; other temporary conditions are not included.'));
    notes.push(impactText('Это урон до брони и особых сопротивлений конкретного врага.',
      'This is damage before the specific enemy\'s Armor and special resistances.'));
    return {rows,notes};
  }

  const {before:a,after:z}=projectedSkillImpact(m,v);
  if (!G.weapon.noAttack){
    impactRow(rows,'hit','Средний урон одного попадания','Average damage per hit',a.hit,z.hit,impactText(' урона',' damage'));
    impactRow(rows,'dps','Ориентир урона/сек по одной цели','Single-target damage/sec estimate',a.dps,z.dps,impactText(' урона/с',' damage/sec'));
  }
  if (G.weapon.minions && (G.weapon.noAttack || m.req==='min' || affectsMinions(m))){
    impactRow(rows,'minionHit','Средний удар базового приспешника','Average basic minion hit',a.minionHit,z.minionHit,impactText(' урона',' damage'));
    impactRow(rows,'minionDps','Ориентир DPS текущей свиты','Current army DPS estimate',a.minionDps,z.minionDps,impactText(' урона/с',' damage/sec'));
  }
  if (m.stat==='projN'){
    impactRow(rows,'projectiles','Снарядов за атаку','Projectiles per attack',a.projN,z.projN);
    impactRow(rows,'volley','Максимальный урон залпа','Maximum volley damage',a.volley,z.volley,impactText(' урона',' damage'));
    notes.push(impactText('Урон залпа — максимум, если все снаряды попадут в одну цель.',
      'Volley damage is the maximum if every projectile hits one target.'));
  }
  if (m.stat==='kOneArrow'){
    impactRow(rows,'projectiles','Снарядов за атаку','Projectiles per attack',a.projN,z.projN);
    impactRow(rows,'volley','Максимальный урон залпа','Maximum volley damage',a.volley,z.volley,impactText(' урона',' damage'));
    impactRow(rows,'pierce','Целей пробивается насквозь','Targets pierced',a.pierce,z.pierce);
    notes.push(impactText('Отскоки сохраняют полный урон; Дробовик и Раздвоенная стрела отключаются.',
      'Chains retain full damage; Shotgun and Split Arrow are disabled.'));
  }
  if (m.stat==='dblHit'){
    const ad=a.dps*(1+0.6*a.dblHit/100), zd=z.dps*(1+0.6*z.dblHit/100);
    impactRow(rows,'doubleChance','Шанс второго попадания','Second-hit chance',a.dblHit,z.dblHit,'%',true);
    impactRow(rows,'doubleDps','Средний DPS с учётом второго удара','Average DPS including the second hit',ad,zd,impactText(' урона/с',' damage/sec'));
  }
  if (m.stat==='pctHp')
    impactRow(rows,'enemyHpBonus','Добавка за удар по врагу с 1000 текущего HP','Bonus per hit vs an enemy with 1,000 current HP',a.pctHp*10,z.pctHp*10,impactText(' урона',' damage'));
  if (m.stat==='orbit'){
    impactRow(rows,'orbits','Круговых орбов','Orbiting orbs',a.orbitN,z.orbitN);
    impactRow(rows,'orbitTouch','Суммарный урон касания всех орбов','Combined touch damage from all orbs',a.orbitTouch,z.orbitTouch,impactText(' урона',' damage'));
  }

  const stats={
    life:['life','Максимальное здоровье','Maximum Health',' HP',false],
    regen:['regen','Быстрое лечение','Quick Healing',impactText(' HP/5 сек',' HP/5 sec'),false],
    armor:['armor','Броня','Armor','',false], dodge:['dodge','Шанс уклонения','Evasion Chance','%',true],
    leech:['leech','Вампиризм','Life Steal','%',true], critCh:['critCh','Шанс крита','Critical Hit Chance','%',true],
    critMul:['critMul','Урон критического удара','Critical Hit Damage','%',true],
    aspd:['aps','Атак в секунду','Attacks per second',impactText(' /с',' /sec'),false],
    mspd:['mspd','Скорость передвижения','Movement Speed','',false],
    pierce:['pierce','Целей пробивается насквозь','Targets pierced','',false],
    chain:['chain','Переходов на новую цель','Chains to another target','',false],
    ricochet:['ricochet','Осколков рикошета','Ricochet shards','',false],
    projSpd:['projSpd','Множитель скорости снаряда','Projectile Speed multiplier','×',false],
    arcanePull:['arcanePull','Сила арканного притяжения','Arcane Pull Strength','%',true],
    projSize:['projSize','Размер снаряда','Projectile Size','%',true], aoeR:['aoeR','Радиус области','Area Radius','%',true],
    arc:['arc','Ширина дуги удара','Cleave Arc width','%',true],
    explode:['explode','Шанс чумного взрыва','Corpse Plague Explosion chance','%',true],
    igniteCh:['igniteCh','Шанс поджога','Ignite Chance','%',true], chillCh:['chillCh','Шанс охлаждения','Chill Chance','%',true],
    shockCh:['shockCh','Шанс разряда','Lightning Discharge Chance','%',true], poiCh:['poiCh','Шанс отравления','Poison Chance','%',true],
    knock:['knock','Шанс отбрасывания','Knockback Chance','%',true], stun:['stun','Шанс оглушения','Stun Chance','%',true],
    superCh:['superCh','Шанс сверхкрита','Super-Crit Chance','%',true],
    xpGain:['xpGain','Бонус получаемого опыта','Experience Gain bonus','%',true], goldFind:['goldFind','Бонус находимого золота','Gold Find bonus','%',true],
    minCount:['minCount','Максимум приспешников','Maximum minions','',false], minSpd:['minSpd','Скорость свиты','Minion Movement Speed','',false],
  };
  const spec=stats[m.stat];
  if (spec) impactRow(rows,'stat:'+m.stat,spec[1],spec[2],a[spec[0]],z[spec[0]],spec[3],spec[4]);
  if (rows.length) notes.push(impactText(
    'Расчёт использует текущий билд и средний крит. Броня врага, промахи и особые сопротивления не учтены.',
    'Uses the current build and average Critical Hits. Enemy Armor, misses, and special resistances are not included.'));
  return {rows:rows.slice(0,5),notes:[...new Set(notes)]};
}

function impactNumber(v){
  const n=Math.abs(v)>=100?Math.round(v):Math.round(v*10)/10;
  return n.toLocaleString(LANGUAGE==='en'?'en-US':'ru-RU',{maximumFractionDigits:1});
}
function cardImpactPreview(m,card){
  const data=cardImpactData(m,card); if (!data.rows.length) return '';
  const rows=data.rows.map(r=>{
    const diff=r.after-r.before, sign=diff>0?'+':'', rel=Math.abs(r.before)>1e-8?diff/r.before*100:null;
    const delta=r.points
      ? sign+impactNumber(diff)+impactText(' п.п.',' pp')
      : sign+impactNumber(diff)+(rel===null?'':' ('+sign+impactNumber(rel)+'%)');
    return '<div class="tt-impact-row'+(diff<0?' loss':'')+'"><span>'+r.label+'</span><b>'+impactNumber(r.before)+r.unit+' → '+impactNumber(r.after)+r.unit+'</b><em>'+delta+'</em></div>';
  }).join('');
  return '<div class="tt-impact"><div class="tt-impact-head">'+impactText('ЕСЛИ ВЫБРАТЬ СЕЙЧАС','IF YOU PICK THIS NOW')+'</div>'+rows+
    data.notes.map(x=>'<div class="tt-impact-note">'+x+'</div>').join('')+'</div>';
}

/* Для процентного шанса крита одной подписи «+N%» недостаточно: игроку
   нужен итоговый фактический шанс прямо на карточке, без открытия тултипа. */
function cardInlineExample(m,card){
  if (!m || m.id!=='crit.chance_inc') return '';
  const chance=cardImpactData(m,card).rows.find(r=>r.key==='stat:critCh');
  if (!chance) return '';
  return '<div class="card-example"><b>'+impactText('ПРИМЕР','EXAMPLE')+'</b>'+
    impactNumber(chance.before)+'% '+impactText('крита','Crit')+' +'+Math.round(card.v)+'% = '+
    impactNumber(chance.after)+'% '+impactText('крита','Crit')+'</div>';
}

const affectsMinions = m => {
  if (!G.weapon.minions || m.req === 'min') return false;
  return MINION_STATS.has(m.stat);
};

/* Тип сложения на карточке словами: «inc» ничего не говорит игроку */
const KIND_HINT = {
  flat:  'к урону плюсом',
  inc:   'суммируется в процентах',
  more:  'общий more-множитель',
  chance:'шанс',
  flag:  'свойство',
};

/* Полные описания для карточек прокачки. Тут намеренно нет «усиливает параметр»:
   игрок должен видеть три вещи — когда срабатывает эффект, что именно меняется
   и какие есть пределы/исключения. Для новой сложной карточки добавляем строку
   сюда либо поле tip прямо в MODS. */
const SKILL_TIPS = {
  'life.on_kill':'<b>Когда срабатывает:</b> сразу после смерти любого врага от вашего урона или урона свиты.<br><b>Эффект:</b> восстанавливает указанное число HP. Лечение не может поднять здоровье выше максимума.<br><b>Важно:</b> не срабатывает, если взят кейстоун «УЖАСАЮЩИЙ ВАМПИР» — он отключает все обычные источники лечения.',
  'life.on_hit':'<b>Когда срабатывает:</b> при каждом вашем успешном попадании по врагу.<br><b>Эффект:</b> каждая карточка даёт только целые +1, +2 или +3 HP за каждую задетую цель. Быстрые атаки, пробитие и несколько снарядов дают больше срабатываний.<br><b>Важно:</b> не лечит от промаха и не превышает максимум HP.',
  'life.on_crit':'<b>Когда срабатывает:</b> только когда ваше попадание становится критическим.<br><b>Эффект:</b> каждая карточка даёт только целые +3, +4, +5 или +6 HP.<br><b>Ограничение:</b> лечение за крит может сработать не чаще одного раза в секунду, даже если за это время прошло несколько критов.<br><b>Важно:</b> не является вампиризмом: лечение не зависит от величины нанесённого урона.',
  'key.no_defense_speed':'<div class="tt-exclusive">Внимание: вся броня из магазина, талантов, навыков и предметов станет равна нулю. «Стальная толпа» больше не будет выпадать.</div><b>Цена:</b> вся числовая броня обнуляется, включая уже собранную; динамическая броня «Стальной толпы» также отключается.<br><b>Сохраняется:</b> «Панцирь от роя» является отдельным плоским вычитанием урона, а не бронёй.<br><b>Взамен:</b> +35% скорости передвижения и +25% скорости атаки.',
  'key.dread_vampire':'<b>Цена кейстоуна:</b> всё обычное лечение и вампиризм отключаются.<br><b>Взамен:</b> 0,5% фактически нанесённого урона восстанавливается равномерно примерно за 3 секунды.<br><b>Мягкий потолок:</b> не больше 8% максимального HP в секунду; лишнее восстановление остаётся в очереди и приходит позже.<br><b>Щит:</b> при полном здоровье восстановление копится красным щитом до 15% максимального HP. Щит принимает урон раньше здоровья.<br><b>Пример:</b> 10 000 урона создают поток на 50 HP.',
  'life.leech_instant':'<b>Требование:</b> появляется после накопления 25% базового вампиризма.<br><b>Эффект:</b> обычный вампиризм от удара приходит сразу, а не растягивается во времени.<br><b>Не влияет:</b> на трёхсекундный поток «УЖАСАЮЩЕГО ВАМПИРА» и не обходит его потолок 8% максимального HP в секунду.',
  'def.normal_reduction':'<b>Что защищает:</b> контакт, снаряды, таран и опасные лужи, созданные <b>обычными</b> врагами.<br><b>Формула:</b> каждый выбор даёт −4…−8%; значения складываются, но итог ограничен −25%.<br><b>Не действует:</b> на элиту, боссов, собственные взрывы и урон от иных источников.',
  'def.major_reduction':'<b>Что защищает:</b> контакт, снаряды, таран, лужи и особые атаки <b>элитных врагов и боссов</b>.<br><b>Формула:</b> каждый выбор случайно даёт −5…−15%; значения складываются, но итог ограничен −25%.<br><b>Не действует:</b> на обычных врагов, собственные взрывы и урон от иных источников.',
  'dmg.thorns':'<b>Класс:</b> выпадает только Воину.<br><b>Когда срабатывает:</b> после прямого удара врага вплотную или с расстояния, если герой фактически потерял HP.<br><b>Эффект каждой карты:</b> атакующий получает 25% потерянного героем HP плюс 25% среднего урона обычной атаки.<br><b>Предел:</b> четыре карты дают 100% обеих частей и открывают «Терновый круг».<br><b>Не срабатывает:</b> от уклонения, полностью поглощённого удара, периодического урона и луж.',
  'dmg.thorn_circle':'<b>Класс:</b> выпадает только Воину.<br><b>Требование:</b> 100% Шипов.<br><b>Когда срабатывает:</b> каждый раз, когда Шипы фактически наносят урон атакующему.<br><b>Эффект:</b> все остальные враги в радиусе 180 получают 50% реально нанесённого атакующему урона. Радиус растёт от бонусов к области действия.',
  'warrior.three_step':'<b>Класс:</b> выпадает только Воину; синяя одноразовая карта.<br><b>Цикл:</b> первый взмах получает +10%, второй +15%, третий +20% радиуса и дальности. После третьего удара цикл начинается заново.<br><b>Важно:</b> третий взмах остаётся штатной круговой волной Воина.',
  'warrior.iron_fury':'<b>Класс:</b> выпадает только Воину; синяя одноразовая карта.<br><b>Когда срабатывает:</b> после любого прямого вражеского удара, который фактически снял HP.<br><b>Эффект:</b> +5% ко всему урону на 3 секунды; каждый новый удар добавляет стек и обновляет таймер.<br><b>Предел:</b> пять стаков, +25% урона.',
  'archer.split_arrow':'<b>Класс:</b> выпадает только Лучнику; синяя одноразовая карта.<br><b>Когда срабатывает:</b> после первого попадания каждой исходной стрелы.<br><b>Эффект:</b> из точки удара под углами ±30° вылетают две боковые стрелы, каждая наносит 22% урона обычной атаки.<br><b>Ограничения:</b> боковые стрелы не пробивают, не отскакивают, не создают новые боковые стрелы и не запускают Осколочный рикошет.',
  'archer.return_shot':'<b>Класс:</b> выпадает только Лучнику; синяя одноразовая карта.<br><b>Период:</b> каждая 13-я исходная стрела после завершения обычного полёта разворачивается и летит к герою.<br><b>Эффект:</b> обратный пролёт проходит сквозь задетых врагов и наносит каждому 30% урона обычной атаки.<br><b>Стихии:</b> каждый обратный удар независимо бросает текущие шансы поджога, охлаждения, отравления и шока.<br><b>Ограничение:</b> обратная стрела не повторяет пробития, отскоки, деление и Осколочный рикошет.',
  'archer.hunter_mark':'<b>Класс:</b> выпадает только Лучнику; синяя одноразовая карта.<br><b>Период:</b> первая цель каждой 6-й исходной стрелы получает метку на 4 секунды; метящий удар уже пользуется бонусом.<br><b>Эффект:</b> Лучник наносит отмеченной цели +15% урона, а текущие шансы поджога, охлаждения, отравления и шока удваиваются.<br><b>Предел:</b> одновременно две цели. Новая третья метка заменяет ту, у которой раньше закончится время.<br><b>Индикация:</b> небольшой красный прицел поверх цели.',
  'dmg.pct_enemy_hp':'<b>Когда срабатывает:</b> при вашем попадании по врагу.<br><b>Эффект:</b> добавляет урон, равный указанному проценту от текущего HP цели перед этим попаданием.<br><b>Предел:</b> все карточки складываются максимум до 10%, после чего навык уходит из пула.<br><b>Практически:</b> особенно силён против врагов и боссов с большим запасом HP; по раненой цели добавка становится меньше.',
  'dmg.range_narrow':'<b>Что меняет:</b> подтягивает минимальный урон к максимальному на указанный процент, не уменьшая верхнюю границу.<br><b>Пример:</b> диапазон 6–10 при +50% становится 8–10, поэтому средний урон растёт с 8 до 9.<br><b>Предел:</b> одна карточка даёт 5–15%; суммарный бонус не превышает 50%, после чего карточка уходит из пула.',
  'dmg.lucky':'<b>Когда срабатывает:</b> при каждом вашем ударе.<br><b>Эффект:</b> игра дважды бросает случайный урон в диапазоне оружия и выбирает больший результат.<br><b>Важно:</b> не создаёт второй удар и не удваивает урон; это выбор лучшего из двух бросков.',
  'crit.chance_flat':'<b>Что меняет:</b> прибавляет указанное число процентных пунктов к шансу критического удара.<br><b>Пример:</b> 20% крита + 8% с карточки = 28% крита.<br><b>Предел:</b> шанс не может стать выше 100%.',
  'crit.chance_inc':'<b>Что меняет:</b> усиливает уже имеющийся шанс крита на случайные 10–20%.<br><b>Пример:</b> при 20% базового шанса +20% даст 24%, а не 40%.<br><b>Предел:</b> итоговый шанс не превышает 100%.',
  'crit.multi':'<b>Когда срабатывает:</b> только на критическом попадании.<br><b>Эффект:</b> добавляет указанное число процентов к множителю критического урона.<br><b>Пример:</b> крит ×2,0 с бонусом +5 становится ×2,05: обычный удар на 100 нанесёт критом 205.',
  'crit.super_chance':'<b>Требование:</b> открывается при 100% обычного крита.<br><b>Когда срабатывает:</b> после критического удара бросается отдельный шанс сверхкрита.<br><b>Эффект:</b> сверхкрит удваивает уже критический урон и накладывает кровотечение на 3% силы удара в секунду; кровотечения складываются без предела.',
  'crit.on_crit_shockwave':'<b>Когда срабатывает:</b> каждый раз, когда ваш удар критует.<br><b>База волны:</b> 20% урона, который крит фактически снял с основной цели после её защиты; лишний урон сверх оставшегося HP не учитывается.<br><b>Цели:</b> только другие враги в радиусе 90; первоначальная цель исключается.<br><b>Защита соседей:</b> каждый отдельно применяет свою броню, панцирь, защиту пачки и особую защиту босса.<br><b>Важно:</b> волна сама не критует и не создаёт следующую критическую волну; радиус растёт от бонусов к области действия.',
  'spd.attack':'<b>Что меняет:</b> уменьшает задержку между автоатаками на указанный процент.<br><b>Пример:</b> +20% скорости атаки означает примерно в 1,2 раза больше атак за то же время.<br><b>Влияет:</b> на основную атаку и частоту ударов свиты там, где применяется её собственная скорость.',
  'spd.action':'<b>Что меняет:</b> добавляет процент к общей корзине more для скорости атаки.<br><b>Пример:</b> «×1,15», +10% Охотника и +20% обычного предмета вместе дают ×1,45, а не ×1,518.<br><b>В одной корзине:</b> сюда входят повторяемые more-карточки, обычные бонусы предметов, подкласса и временные стаки. Кейстоуны и штрафы применяются отдельно.',
  'mov.speed':'<b>Что меняет:</b> увеличивает скорость движения героя во все стороны.<br><b>Пример:</b> +10% означает, что одинаковая дистанция проходится примерно за 90% прежнего времени.<br><b>Не влияет:</b> на скорость снарядов, атаки, рывок и скорость свиты.',
  'mov.speed_on_kill':'<b>Когда срабатывает:</b> сразу после каждого убийства.<br><b>Эффект:</b> герой получает +25% скорости передвижения на 0,8 секунды.<br><b>Обновление:</b> новое убийство сразу обновляет время действия.',
  'shape.proj_count':'<b>Что меняет:</b> каждая атака Лучника выпускает ещё один снаряд.<br><b>Эффект:</b> дополнительный снаряд наносит полный урон и может отдельно критовать, пробивать и накладывать эффекты.<br><b>Важно:</b> карточка доступна только Лучнику; Маг получает дополнительные основные снаряды только от общего классового роста.',
  'shape.pierce':'<div class="tt-exclusive">Выбор пробития, отскоков или Осколочного рикошета навсегда закрывает две другие ветки в этом забеге.</div><b>Класс:</b> выпадает только Лучнику.<br><b>Что меняет:</b> снаряд не исчезает после первой цели и может пройти ещё через указанное число врагов.<br><b>Диапазон:</b> каждая карточка даёт целые +1 или +2 цели.<br><b>Затухание:</b> без «СВЕРХПРОБИТИЯ» первая цель получает 100% урона, вторая 80%, третья 60%, четвёртая 40%, пятая 20%.<br><b>Предел:</b> базовое пробитие не превышает 4 целей; если осталось одно место, последняя карточка обрезается до +1. После достижения 4 эта карточка уходит из пула и открывается «СВЕРХПРОБИТИЕ».<br><b>Важно:</b> один и тот же враг не получает повторный урон от того же пролёта; специальные прибавки предметов и навыков считаются отдельно.',
  'shape.chain':'<div class="tt-exclusive">Выбор пробития, отскоков или Осколочного рикошета навсегда закрывает две другие ветки в этом забеге.</div><b>Класс:</b> выпадает только Лучнику.<br><b>Когда срабатывает:</b> после попадания снаряда по врагу.<br><b>Эффект:</b> снаряд прыгает к указанному числу других ближайших целей.<br><b>Важно:</b> без «ЭКО-ОТСКОКОВ» каждый следующий прыжок теряет 25% урона.',
  'shape.homing':'<b>Что меняет:</b> силу поворота летящего снаряда к ближайшему врагу.<br><b>Диапазон:</b> каждая карточка даёт 35–70%.<br><b>Предел:</b> суммарная сила не превышает 100%; последний выбор обрезается ровно до остатка, после чего карточка уходит из пула.<br><b>Не добавляет:</b> урон, скорость полёта или дальность.',
  'shape.proj_speed':'<b>Что меняет:</b> скорость полёта стрел и магических сфер.<br><b>Практически:</b> цель достигается быстрее, а движущемуся врагу сложнее уйти с траектории.<br><b>Не влияет:</b> на частоту выстрелов и скорость движения героя.',
  'shape.aoe_radius':'<b>Что меняет:</b> радиус взрывов, волн, луж и других эффектов по площади.<br><b>Пример:</b> +25% превращает радиус 100 в 125, а площадь покрытия становится заметно больше.<br><b>Не увеличивает:</b> размер обычной стрелы и дальность её полёта.',
  'shape.cleave_arc':'<b>Что меняет:</b> угол дугового удара клинком.<br><b>Эффект:</b> за один взмах можно задеть больше врагов, стоящих перед героем.<br><b>Не увеличивает:</b> дальность удара и урон по одной цели.',
  'shape.explode_on_kill':'<b>Когда срабатывает:</b> после смерти врага от вашей атаки или эффекта.<br><b>Эффект:</b> с указанным шансом труп даёт чумный взрыв малого радиуса и заражает всех задетых врагов.<br><b>Чума:</b> ровно 3 секунды; на 1-й, 2-й и 3-й секунде снимает 15% от <b>текущего</b> HP цели. Не наносит мгновенный прямой урон.<br><b>Диапазон:</b> каждая карточка даёт целые 3–7%.<br><b>Предел:</b> 25%; последняя карточка обрезается до остатка и затем уходит из пула.',
  'shape.explode_mega':'<b>Требование:</b> открывается при 25% обычных чумных взрывов.<br><b>Когда срабатывает:</b> один из чумных взрывов становится мега-версией.<br><b>Эффект:</b> радиус заражения вдвое больше; сама чума остаётся прежней — 15% текущего HP в секунду в течение 3 секунд.',
  'shape.double_hit':'<b>Когда срабатывает:</b> при вашем успешном попадании.<br><b>Эффект:</b> с указанным шансом создаётся второе попадание по той же цели с силой 60% исходного.<br><b>Диапазон:</b> каждая карточка даёт случайно 1–5%.<br><b>Предел:</b> 25%; последняя карточка обрезается до остатка.',
  'shape.deadly_hit':'<b>Требование:</b> достигнуть предела 25% шанса двойного попадания.<br><b>Когда срабатывает:</b> при каждом фактическом ударе героя или свиты с шансом 1%.<br><b>Эффект:</b> отдельно снимает 25% от текущего HP цели после обычного урона.<br><b>Не срабатывает:</b> от DoT, чумы и луж.',
  'shape.shotgun':'<b>Требование:</b> не менее 5 дополнительных снарядов.<br><b>Эффект:</b> весь залп летит плотным пучком, а не широким веером.<br><b>Практически:</b> гораздо сильнее по одной крупной цели, но хуже покрывает толпу.',
  'shape.chain_retention':'<b>Требование:</b> не менее 4 отскоков.<br><b>Эффект:</b> отскоки перестают терять 25% урона на каждом прыжке.<br><b>Практически:</b> последний враг в цепи получает столько же урона, сколько первый.',
  'shape.pierce_bonus':'<b>Требование:</b> не менее 4 пробитий.<br><b>Эффект:</b> снаряд получает +20% урона за каждую уже пробитую им цель.<br><b>Пример:</b> после трёх врагов следующий получит +60% урона от этого эффекта.',
  'conv.aoe_to_damage':'<b>Требование:</b> появляется после развития радиуса области.<br><b>Формула:</b> каждый 1% радиуса области добавляет 0,6% общего урона.<br><b>Пример:</b> +50% радиуса превращается в +30% урона.',
  'shape.orbit':'<b>Класс:</b> выпадает только Воину.<br><b>Что создаёт:</b> один вращающийся орб вокруг героя.<br><b>Радиус:</b> базовый радиус вращения — 88,8; он масштабируется радиусом области.<br><b>Эффект:</b> при касании врага орб наносит 25% силы автоатаки; применяются все её модификаторы и шансы срабатывания.<br><b>Предел:</b> максимум 10 орбов; каждый новый — отдельный источник попаданий.',
  'shape.ricochet':'<div class="tt-exclusive">Выбор пробития, отскоков или Осколочного рикошета навсегда закрывает две другие ветки в этом забеге.</div><b>Класс:</b> выпадает только Лучнику.<br><b>Когда срабатывает:</b> при первом попадании основной стрелы.<br><b>Эффект:</b> выпускает указанное число осколков в ближайших ещё не задетых врагов в радиусе 450. Каждый осколок наносит 45% урона исходного попадания и может накладывать его эффекты.<br><b>Предел:</b> максимум 3 осколка. Они не пробивают цели, не переходят в обычный отскок и не создают новые осколки.',
  'death.cheat':'<b>Когда срабатывает:</b> смертельный удар при готовой перезарядке.<br><b>Эффект:</b> гарантированно оставляет 1 HP, даёт полную неуязвимость и +50% скорости передвижения ровно на 1 секунду.<br><b>Перезарядка:</b> 60 секунд; пока она идёт, следующий смертельный удар убивает как обычно.<br><b>Редкость:</b> оранжевая уникальная карточка, выбирается только один раз.',
};

function detailedSkillTip(m, card){
  if (LANGUAGE === 'en') return englishSkillTip(m, card);
  if (m.tip) return m.tip;
  if (SKILL_TIPS[m.id]) return (m.id === 'shape.explode_on_kill' ? '<b>Класс:</b> только Некромант.<br>' : '') + SKILL_TIPS[m.id];
  const v = card.v, shown = card.val || v;
  if (m.id === 'trig.on_damaged') return '<b>Класс:</b> выпадает только Воину.<br><b>Когда срабатывает:</b> когда герой действительно получает урон после уклонения и защит.<br><b>Эффект:</b> вокруг героя происходит ответная атака по ближайшим врагам.<br><b>Не срабатывает:</b> от полностью уклонённого удара.';
  if (m.id === 'trig.on_low_life') return '<b>Когда срабатывает:</b> здоровье героя опускается до опасного уровня.<br><b>Эффект:</b> восстанавливает 25% максимального HP.<br><b>Ограничение:</b> повторное срабатывание возможно только через 20 секунд.';
  if (m.id === 'dmg.flat_all') return '<b>Что меняет:</b> добавляет <b>' + shown + '</b> к базовому урону каждого вашего подходящего удара.<br><b>Как считается:</b> сначала прибавляется это число, затем применяются проценты и множители.<br><b>Влияет:</b> на все типы урона, включая атаки свиты, когда они наследуют ваши характеристики.';
  if (m.id === 'dmg.inc_all') return '<b>Что меняет:</b> добавляет <b>' + shown + '</b> к сумме общего процентного урона.<br><b>Пример:</b> +20% и +30% общего урона вместе дают +50% к базовому урону.<br><b>Влияет:</b> на все типы атак, но не заменяет отдельные множители «more».';
  if (m.id === 'dmg.more_all') return '<b>Что меняет:</b> добавляет свой процент к общей корзине more для урона: <b>' + shown + '</b>.<br><b>Пример:</b> «×1,20» и «×1,15» вместе дают общий множитель ×1,35, а не ×1,38.<br><b>Важно:</b> собранная корзина применяется один раз после обычных процентных бонусов.';
  if (m.id === 'dmg.aoe') return '<b>Условие:</b> урон должен быть нанесён по площади — взрывом, волной, лужей или сферой мага.<br><b>За карточку:</b> случайно выпадает целое значение от <b>7% до 13%</b>.<br><b>Сложение:</b> все выбранные значения суммируются без потолка; например, 8% + 12% = +20%.<br><b>Не действует:</b> на одиночное прямое попадание стрелы.';
  if (m.id === 'dmg.projectile') return '<b>Класс:</b> карточка доступна только Лучнику.<br><b>Условие:</b> урон должен прийти от летящей стрелы.<br><b>За карточку:</b> случайно выпадает целое значение от <b>5% до 10%</b>.<br><b>Сложение:</b> все выбранные значения суммируются без потолка; например, 6% + 9% = +15%.<br><b>Не действует:</b> на атаки других классов и свиты.';
  if (m.id === 'dmg.melee') return '<b>Условие:</b> урон должен быть нанесён ближней атакой воина.<br><b>Эффект:</b> такой удар получает указанный процент урона.<br><b>Не действует:</b> на стрелы, сферы и самостоятельные эффекты по площади.';
  if (m.id === 'min.crit') return '<b>Что меняет:</b> увеличивает шанс критического удара именно у приспешников.<br><b>Эффект:</b> каждый их удар отдельно проверяет этот шанс и использует их критический множитель.<br><b>Не влияет:</b> на шанс крита самого героя.';
  if (m.id === 'min.explode') return '<b>Когда срабатывает:</b> когда приспешник погибает.<br><b>Эффект:</b> он взрывается и наносит урон окружающим врагам.<br><b>Практически:</b> превращает гибель скелета в часть урона по плотной толпе.';
  if (m.id === 'key.death_lord') return '<b>Только для Некроманта.</b><br><b>Эффект:</b> 0,1% всего фактически нанесённого свитой урона восстанавливает здоровье героя.<br><b>Учитывает:</b> удары всех приспешников, их дополнительные атаки, негативные эффекты, взрыв при смерти и классовые лужи.<br><b>Пример:</b> 10 000 реально нанесённого урона возвращают 10 HP.';
  if (m.id === 'key.bone_challenge') return '<b>Только для Некроманта.</b><br><b>Шанс:</b> 1% при каждом прямом ударе свиты.<br><b>Эффект:</b> атакованный монстр переключается на ударившего приспешника и преследует его, пока тот жив. После смерти приспешника агро возвращается к обычному выбору цели.';
  if (m.id === 'cond.vs_boss') return '<b>Условие:</b> цель является элитным врагом или боссом.<br><b>Эффект:</b> каждая карточка добавляет 5–15% урона; выбранные значения суммируются.<br><b>Не действует:</b> на обычных монстров.';
  if (m.id === 'cond.while_moving') return '<b>Условие:</b> герой в данный момент движется клавишами или мышью.<br><b>Эффект:</b> пока есть движение, все подходящие атаки получают накопленный процент урона.<br><b>Диапазон:</b> каждая карточка даёт целые 7–12%.<br><b>Накопление:</b> значения складываются без потолка; например, 8% + 11% = +19% урона.<br><b>Важно:</b> остановились — бонус сразу исчезает.';
  if (m.id === 'cond.while_still') return '<b>Условие:</b> герой не двигается дольше 0,6 секунды.<br><b>Эффект:</b> все подходящие атаки получают накопленный процент урона, пока персонаж стоит.<br><b>Диапазон:</b> каждая карточка даёт целые 10–15%.<br><b>Накопление:</b> значения складываются без потолка; например, 11% + 14% = +25% урона.<br><b>Цена:</b> любое движение сразу отключает бонус и начинает отсчёт заново.';
  if (m.id === 'cond.per_enemy_near') return '<b>Условие:</b> враги находятся в радиусе 220 вокруг героя.<br><b>Формула:</b> указанный бонус × число таких врагов, учитывается максимум 8.<br><b>Пример:</b> +5% и 8 врагов рядом = +40% урона.';
  if (/^dt\.(fire|cold|lightning|poison)\.flat$/.test(m.id)) return '<b>Условие появления:</b> сначала нужно взять хотя бы 1% шанса соответствующего статуса.<br><b>Что меняет:</b> добавляет <b>' + shown + '</b> плоского урона стихии к каждому подходящему попаданию.<br><b>Важно:</b> открытие только добавляет редкую синюю карточку в случайный пул и не гарантирует её в следующей раздаче.';
  if (/^dt\.(fire|cold|lightning|poison)\.inc$/.test(m.id)) return '<b>Условие появления:</b> сначала нужно взять хотя бы 1% шанса соответствующего статуса.<br><b>Что меняет:</b> усиливает весь урон этой стихии на <b>' + shown + '</b>.<br><b>Важно:</b> обычная карточка лишь открывается в случайном пуле и не выдаётся гарантированно.';
  if (m.id === 'ail.ignite.chance') return '<b>Когда проверяется:</b> при каждом подходящем попадании.<br><b>Эффект:</b> поджог наносит 20% полного удара в секунду в течение 3 секунд.<br><b>Предел:</b> одна карточка даёт 5–10 процентных пунктов; суммарный шанс не превышает 25%.';
  if (m.id === 'ail.chill.chance') return '<b>Когда проверяется:</b> при каждом подходящем попадании.<br><b>Эффект на 0,5 сек:</b> −15% скорости цели, +10% в общую корзину входящего урона и отдельный урон в размере 10% атаки; соседи замедляются на 5%.<br><b>Сложение:</b> Охлаждение, Шок и Заморозка вместе дают +30%, а не ×1,10³.<br><b>Предел:</b> одна карточка даёт 5–10 п.п.; суммарный шанс не превышает 25%.';
  if (m.id === 'ail.shock.chance') return '<b>Когда проверяется:</b> при каждом подходящем попадании.<br><b>Эффект:</b> Шок на 1 секунду добавляет +10% в общую корзину входящего урона; базовый разряд бьёт до 5 соседей на 15% удара.<br><b>Сложение:</b> Охлаждение, Шок и Заморозка вместе дают +30%, а не ×1,10³.<br><b>Предел:</b> одна карточка даёт 5–10 п.п.; суммарный шанс не превышает 25%. На потолке открывается «ТЕСЛА».';
  if (m.id === 'ail.poison.chance') return '<b>Когда проверяется:</b> при каждом подходящем попадании.<br><b>Эффект:</b> яд наносит 15% полного удара в секунду в течение 4 секунд и стакается.<br><b>Предел:</b> одна карточка даёт 5–10 п.п.; суммарный шанс не превышает 25%.';
  if (m.id === 'cc.knockback') return '<b>Когда проверяется:</b> при каждом вашем попадании.<br><b>Эффект:</b> с этим шансом враг отбрасывается от героя.<br><b>Диапазон:</b> каждая карточка даёт случайно 5–15%.<br><b>Сопротивление:</b> сила толчка по Бегунам снижена на 30%, по любой элите — на 50%, по боссам — на 90%.<br><b>Предел:</b> 75%; последняя карточка обрезается до остатка, затем открывается «ГОЛОВОКРУЖЕНИЕ».';
  if (m.id === 'cc.stun_chance') return '<b>Когда проверяется:</b> при каждом вашем попадании.<br><b>Эффект:</b> с этим шансом враг полностью перестаёт двигаться и атаковать. Базовая длительность оглушения — 0,5 секунды.<br><b>Карточка:</b> каждый выбор даёт целые 3–5 процентных пунктов; например, 4% + 5% = 9% шанса.<br><b>Предел:</b> суммарный шанс не превышает 50%; после этого карточка уходит из пула.<br><b>Длительность:</b> «Длительность всех эффектов» продолжает оглушение; например, +50% превращает 0,5 секунды в 0,75 секунды.';
  if (m.id === 'prog.xp') return '<b>Что меняет:</b> увеличивает опыт, получаемый за убийство врагов.<br><b>Пример:</b> +25% превращает награду 10 опыта в 12,5 опыта.<br><b>Не влияет:</b> на уже набранный опыт и на размер наград золотом.';
  if (m.id === 'loot.gold') return '<b>Что меняет:</b> увеличивает количество золота, выпадающего в забеге.<br><b>Пример:</b> +40% превращает выпадение 10 золота в 14.<br><b>Важно:</b> не добавляет золото мгновенно — усиливает будущие выпадения.';
  if (m.nt) return '<b>Как работает:</b> ' + m.nt + '<br><b>Длительность:</b> свойство остаётся активным до конца текущего забега.<br><b>Важно:</b> повторно эта уникальная карточка не усиливается.';
  if (m.kind === 'chance') return '<b>Что означает число:</b> это независимый шанс при каждом подходящем событии.<br><b>Пример:</b> ' + shown + ' означает, что примерно столько раз из 100 эффект сработает.<br><b>Важно:</b> шанс не гарантирует срабатывание по счёту; точный потолок указан в описании ветки.';
  if (m.kind === 'flag') return '<b>Эффект:</b> открывает это постоянное свойство до конца забега.<br><b>Когда работает:</b> условия и детали указаны в названии и категории карточки.<br><b>Важно:</b> повторный выбор той же карточки не усиливает свойство.';
  if (m.kind === 'flat') return '<b>Что меняет:</b> добавляет <b>' + shown + '</b> напрямую к этому параметру.<br><b>Как считается:</b> плоское значение прибавляется к базе до процентных усилений.<br><b>Важно:</b> это не процент — эффект одинаковый при любом текущем значении.';
  if (m.kind === 'more') return '<b>Что меняет:</b> добавляет свой процент к общей корзине more: <b>' + shown + '</b>.<br><b>Важно:</b> бонусы more складываются между собой, а вся корзина применяется один раз после обычных процентов.<br><b>Не путать:</b> more остаётся отдельным от обычной корзины increased.';
  return '<b>Что меняет:</b> добавляет <b>' + shown + '</b> к сумме процентных бонусов этого параметра.<br><b>Как считается:</b> все такие проценты складываются, затем усиливают базовое значение.<br><b>Пример:</b> +20% и +30% дают вместе +50%, а не ×1,2 ×1,3.';
}

function hideSkillTip(){ $('#skilltip').style.display = 'none'; }
function skillTipsEnabled(){ return SKILL_TIPS_ENABLED; }
function skillTipsToggleText(){ return SKILL_TIPS_ENABLED ? 'ПОДРОБНЫЕ ПОДСКАЗКИ: ВКЛ' : 'ПОДРОБНЫЕ ПОДСКАЗКИ: ВЫКЛ'; }
function updateSkillTipsButton(){
  const btn = $('#skilltips-toggle');
  if (!btn) return;
  btn.textContent = tr(skillTipsToggleText());
  btn.setAttribute('aria-pressed', String(SKILL_TIPS_ENABLED));
  btn.classList.toggle('tips-off', !SKILL_TIPS_ENABLED);
}
function setSkillTipsEnabled(next){
  SKILL_TIPS_ENABLED = !!next;
  try { localStorage.setItem(SKILL_TIPS_KEY, SKILL_TIPS_ENABLED ? 'on' : 'off'); } catch (e) {}
  hideSkillTip(); updateSkillTipsButton();
}
function moveSkillTip(ev){
  const tip = $('#skilltip'), gap = 18;
  let x = ev.clientX + gap, y = ev.clientY + gap;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  if (x + w > innerWidth - 10) x = Math.max(10, ev.clientX - w - gap);
  if (y + h > innerHeight - 10) y = Math.max(10, innerHeight - h - gap);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function anchorSkillTip(anchor){
  if (!anchor) return;
  const tip = $('#skilltip'), r = anchor.getBoundingClientRect(), gap = 12;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = Math.max(10, Math.min(innerWidth-w-10, r.left+(r.width-w)/2));
  let y = r.top-h-gap;
  if (y < 10) y = Math.min(innerHeight-h-10, r.bottom+gap);
  tip.style.left = x + 'px'; tip.style.top = Math.max(10,y) + 'px';
}
function showFloorFindTip(ev, find, anchor){
  if (!find) return;
  const tip = $('#skilltip');
  tip.innerHTML = '<div class="tt-title" style="color:' + find.col + '">' + find.ico + ' ' + find.name + '</div>' +
    '<b>' + find.detail + '</b><div class="tt-note">' + (find.tip || 'Находка добавлена в текущий забег.') + '</div>';
  tip.style.display = 'block';
  if (anchor){
    const r = anchor.getBoundingClientRect();
    const gap = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    const x = Math.max(10, Math.min(innerWidth-w-10, r.right-w));
    let y = r.top-h-gap;
    if (y < 10) y = Math.min(innerHeight-h-10, r.bottom+gap);
    tip.style.left = x + 'px'; tip.style.top = Math.max(10,y) + 'px';
  } else if (ev && Number.isFinite(ev.clientX)) moveSkillTip(ev);
}
function showSkillTip(ev, card, options={}){
  if (!SKILL_TIPS_ENABLED){ hideSkillTip(); return; }
  const m = card.m, tip = $('#skilltip');
  const detail = detailedSkillTip(m, card);
  const note = options.note || ('В этой карточке: <b>' + (card.val || 'свойство') + '</b>' +
    (currentOf(m) !== null ? ' · сейчас: ' + currentOf(m) : ''));
  tip.innerHTML = '<div class="tt-title">' + m.nm + '</div>' + cardImpactPreview(m,card) + detail +
    '<div class="tt-note">' + note + '</div>';
  tip.style.display = 'block';
  if (options.anchor) anchorSkillTip(options.anchor);
  else if (ev && Number.isFinite(ev.clientX)) moveSkillTip(ev);
}

/* Шанс, что начатая ветка круговых орбов займёт место в раздаче.
   Замер: при 0.30 до десяти орбов игрок доходил за 28 уровней, при 0.52 — за 16. */
const ORBIT_PRIORITY = 0.52;

/* Единая карта классов для level-up UI. Ограничения не дублируются списками id:
   значки вычисляются из тех же полей каталога, по которым карточка реально
   допускается в пул. Поэтому новая wep/req/noMin-карточка получает их сама. */
const CARD_CLASS_ORDER = ['blade','bow','wand','necro'];
const CARD_CLASS_STYLE = Object.freeze({
  blade:{slug:'warrior', icon:'<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#e8eef5" d="M11 1h4v4L7 13 3 9z"/><path fill="currentColor" d="M10 2h3v3L6 12 4 10zM2 9l5 5-2 2-5-5z"/><path fill="#6c4225" d="M1 14h3v2H1z"/></svg>'},
  bow:{slug:'archer', icon:'<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M4 1c7 3 7 11 0 14M4 1v14"/><path fill="#d9e6ef" d="M2 7h11v2H2zM11 5l4 3-4 3z"/></svg>'},
  wand:{slug:'mage', icon:'<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#dfe9f2" d="M2 12l2 2L12 4l-2-2z"/><path fill="currentColor" d="M11 0l1 2 3 1-2 2v3l-2-2-3 1 1-3-2-2h3z"/><path fill="#5ed5e8" d="M11 2h2v2h-2z"/></svg>'},
  necro:{slug:'necromancer', icon:'<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#e7dfc6" d="M3 3h2V1h6v2h2v2h2v6h-3v4H4v-4H1V5h2z"/><path fill="#15231d" d="M4 6h3v3H4zM9 6h3v3H9zM7 10h2v2H7zM5 13h2v2H5zM9 13h2v2H9z"/><path fill="currentColor" d="M2 4h2V2h2V1H4v1H2zM12 3h2v2h-2z"/></svg>'}
});

function modFitsWeapon(m, weapon){
  return (!m.wep || m.wep.includes(weapon.type))
      && (!m.req || weapon.minions)
      && !(m.noMin && weapon.minions);
}
function allowedClassesForMod(m){
  return CARD_CLASS_ORDER.filter(key => modFitsWeapon(m, WEAPONS[key]));
}
function classAvailabilityHtml(m){
  const keys = allowedClassesForMod(m);
  if (!keys.length || keys.length === CARD_CLASS_ORDER.length) return '';
  const names = keys.map(key => tr(WEAPONS[key].nm));
  const label = tr('ДОСТУПНО:') + ' ' + names.join(', ');
  return '<div class="class-access" role="group" aria-label="' + label + '" title="' + label + '">' +
    '<span class="class-access-label">' + tr('ДОСТУПНО:') + '</span>' +
    keys.map(key => {
      const cls = CARD_CLASS_STYLE[key], name = tr(WEAPONS[key].nm);
      return '<span class="class-icon class-icon-' + cls.slug + '" role="img" aria-label="' + name + '" title="' + name + '">' + cls.icon + '</span>';
    }).join('') + '</div>';
}

/* Связи «карточка → навык на пороге» живут отдельно от текста карточек.
   UI читает тот же каталог MODS, поэтому название, редкость, описание и
   классовые ограничения будущего навыка не приходится дублировать. */
const LEVEL_SKILL_LINKS = Object.freeze([
  {source:'archer.accelerated', target:'archer.swift_arrows', at:50, current:()=>D.acceleratedArrow, unit:'%'},
  {source:'archer.clean_trajectory', target:'archer.elemental_pierce', at:50, current:()=>D.cleanTrajectory, unit:'%'},
  {source:'mage.blast_heart', target:'mage.elemental_explosion', at:50, current:()=>D.blastHeart, unit:'%'},
  {source:'warrior.long_blade', target:'warrior.deadly_radius', at:60, current:()=>D.longBlade, unit:'%'},
  {source:'warrior.steel_crowd', target:'warrior.hold_line', at:10, current:()=>D.steelCrowd},
  {source:'dmg.thorns', target:'dmg.thorn_circle', at:100, current:()=>D.thornsRaw, unit:'%'},
  {source:'crit.chance_flat', target:'crit.super_chance', at:100, current:()=>D.critCh, unit:'%'},
  {source:'crit.chance_inc', target:'crit.super_chance', at:100, current:()=>D.critCh, unit:'%'},
  {source:'shape.explode_on_kill', target:'shape.explode_mega', at:25, current:()=>D.explode, unit:'%'},
  {source:'shape.double_hit', target:'shape.deadly_hit', at:25, current:()=>D.dblHit, unit:'%'},
  {source:'shape.proj_count', target:'shape.shotgun', at:5, current:()=>D.projN},
  {source:'shape.chain', target:'shape.chain_retention', at:4, current:()=>D.chainBase, available:()=>!D.oneArrowTechnique&&D.pierceBase===0&&D.ricochet===0},
  {source:'shape.pierce', target:'shape.pierce_bonus', at:4, current:()=>D.pierceBase, available:()=>D.chainBase===0&&D.ricochet===0},
  {source:'shape.aoe_radius', target:'conv.aoe_to_damage', at:100, current:()=>Math.max(0,(D.aoeR-1)*100), unit:'%'},
  {source:'ail.ignite.chance', target:'ail.ignite.spread', at:25, current:()=>D.igniteCh, unit:'%'},
  {source:'ail.chill.chance', target:'ail.freeze.chance', at:25, current:()=>D.chillCh, unit:'%'},
  {source:'ail.shock.chance', target:'ail.shock.tesla', at:25, current:()=>D.shockCh, unit:'%'},
  {source:'ail.poison.chance', target:'ail.poison.radiation', at:25, current:()=>D.poiCh, unit:'%'},
  {source:'cc.knockback', target:'cc.dizzy', at:75, current:()=>D.knock, unit:'%'},
  {source:'trig.on_kill', target:'trig.on_kill_strong', at:50, current:()=>D.novaKillBase, unit:'%'},
  {source:'min.count', target:'min.bombardiers', at:6, current:()=>SKELETON_BASE_LIMIT+skeletonCardRank()},
  {source:'min.golem_blood', target:'min.golem_bone', at:10, current:()=>D.golemB},
  {source:'min.damage', target:'min.frenzy', at:50, current:()=>D.minDmgRaw, unit:'%'},
  {source:'min.damage', target:'min.bloodbath', at:75, current:()=>D.minDmgRaw, unit:'%'},
  {source:'min.damage', target:'min.boiling', at:100, current:()=>D.minDmgRaw, unit:'%'},
  {source:'min.attack_speed', target:'min.claws', at:50, current:()=>D.minAspdRaw, unit:'%'},
  {source:'min.attack_speed', target:'min.whirl', at:100, current:()=>D.minAspdRaw, unit:'%'},
  {source:'min.move_speed', target:'min.blink', at:MINION_BLINK_UNLOCK, current:()=>D.minSpdRaw, unit:'%'},
  {source:'min.move_speed', target:'min.raid', at:MINION_RAID_UNLOCK, current:()=>D.minSpdRaw, unit:'%'},
  {source:'min.bond', target:'min.blood_ties', at:50, current:()=>D.minBondRaw, unit:'%'}
]);

function linkedTargetTaken(target){
  if (target.kind !== 'flag') return false;
  if (G && Array.isArray(G.picks) && G.picks.some(p => p.id === target.id)) return true;
  return !!(G && G.bag && typeof G.bag.has === 'function' && G.bag.has(target.stat));
}
function linkedUnlocksForCards(cards){
  const sourceOrder = new Map((cards || []).map((card,i) => [(card.m || card).id,i]));
  const seen = new Set(), out = [];
  LEVEL_SKILL_LINKS
    .filter(link => sourceOrder.has(link.source) && (!link.available || link.available()))
    .sort((a,b) => sourceOrder.get(a.source)-sourceOrder.get(b.source) || a.at-b.at)
    .forEach(link => {
      if (seen.has(link.target)) return;
      const source = MODS.find(m => m.id === link.source), target = MODS.find(m => m.id === link.target);
      if (!source || !target || linkedTargetTaken(target)) return;
      seen.add(link.target);
      out.push({...link, sourceMod:source, targetMod:target, value:Math.max(0,Number(link.current()) || 0)});
    });
  return out;
}
function linkedProgressNumber(value){
  const rounded = Math.round(value*10)/10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
function levelUnlockPanelHtml(cards, links=linkedUnlocksForCards(cards)){
  const sourceIds = new Set((cards || []).map(card => (card.m || card).id));
  const visible = links.map((link,index) => ({link,index})).filter(x => sourceIds.has(x.link.source));
  if (!visible.length) return '';
  const rarityClass = r => ['','r-rare','r-epic','r-key','r-blood'][r||0];
  return '<section class="level-unlocks" data-source-card="' + [...sourceIds].join(' ') + '" aria-label="СВЯЗАННЫЕ НАВЫКИ">' +
    '<div class="level-unlocks-head"><b>СВЯЗАННЫЕ НАВЫКИ</b><span>наведите для подробностей</span></div>' +
    '<div class="level-unlocks-list">' + visible.map(({link,index}) => {
      const open = link.value >= link.at;
      const progress = open ? 'ОТКРЫТО' : linkedProgressNumber(link.value) + ' / ' + linkedProgressNumber(link.at) + (link.unit || '');
      return '<div class="level-unlock ' + rarityClass(link.targetMod.rar) + '" tabindex="0" role="note" aria-describedby="skilltip" data-linked-skill="' + index + '" aria-label="' + link.sourceMod.nm + ': ' + link.targetMod.nm + ', ' + progress + '">' +
        '<span class="level-unlock-source">' + link.sourceMod.nm + '</span><span class="level-unlock-arrow">→</span>' +
        '<span class="level-unlock-target">' + link.targetMod.nm + '</span><span class="level-unlock-progress">' + progress + '</span></div>';
    }).join('') + '</div></section>';
}
function linkedSkillPreviewCard(target){
  const v = target.kind === 'flag' ? 1 : target.r[0];
  const val = target.kind === 'flag' ? 'свойство' : target.kind === 'chance' ? linkedProgressNumber(v) + '%' : '+' + linkedProgressNumber(v);
  return {m:target, v, val};
}
function bindLevelUnlockPanel(links){
  document.querySelectorAll('#ov .level-unlock').forEach(el => {
    const link = links[+el.dataset.linkedSkill];
    if (!link) return;
    const preview = linkedSkillPreviewCard(link.targetMod);
    const note = 'Связанный навык: <b>' + link.sourceMod.nm + '</b> · откроется при <b>' + linkedProgressNumber(link.at) + (link.unit || '') + '</b>';
    el.onmouseenter = ev => showSkillTip(ev, preview, {note});
    el.onmousemove = ev => { if (SKILL_TIPS_ENABLED) moveSkillTip(ev); };
    el.onmouseleave = hideSkillTip;
    el.onfocus = () => showSkillTip(null, preview, {anchor:el, note});
    el.onblur = hideSkillTip;
  });
}

/* Карточки свиты у некроманта. Первое место в раздаче отдаётся им ВСЕГДА,
   второе — с шансом MINION_PRIORITY_2. Работает только у некроманта: карточки
   с req:'min' и так показываются только ему.
   Зачем: у него две прокачки в одной партии — своя и свиты, а мест в раздаче
   столько же, сколько у остальных. Замер до правок: карточка свиты попадалась
   в 31.7% роллов и занимала 11.7% мест, то есть некромант качал свиту втрое
   реже, чем себя, и к 30 уровню приходил с базовыми тремя скелетами. */
const MINION_PRIORITY = 1.0, MINION_PRIORITY_2 = 0.55;

/* Вес одной доступной карточки по редкости: обычная, синяя, фиолетовая,
   оранжевая и красная. Это именно веса внутри текущего классового пула,
   а не прямые проценты. Синие и фиолетовые намеренно редки: стандартная
   раздача из трёх карт должна показывать их примерно в 25–30% и 8% случаев. */
const SKILL_RARITY_WEIGHTS = [100, 14, 7, 3, 3];

/* Выбор трёх карточек модификаторов по редкости */
function rollCards(){
  const taken = new Set(G.picks.map(x => x.id));
  const out = [];
  const weight = m => m.w !== undefined ? m.w : SKILL_RARITY_WEIGHTS[m.rar || 0];
  // Карта должна что-то делать этому классу: дуга удара бесполезна лучнику,
  // пробитие — жезлу (сфера взрывается на первой цели), свита — всем кроме некроманта.
  /* noMin — карточка не показывается классам со свитой. Некромант не стоит
     на месте: он бегает, пока армия дерётся, и «турель-архетип» ему прямо
     противопоказан. Отдельный флаг, а не список исключений по id, чтобы
     следующую такую карточку можно было пометить одним словом. */
  const fits = m => modFitsWeapon(m, G.weapon);
  const pool = MODS.filter(m => (!m.show || m.show()) && !(m.hide && m.hide())) // условные ветки прокачки
                   .filter(fits)
                   // Взятый флаг больше не показываем. Флаг — это переключатель
                   // («есть/нет»), второй раз он перезаписывает ту же единицу и не
                   // даёт ровно ничего. Раньше отсеивались только кейстоуны, и
                   // остальные 24 флага (вспышка при убийстве, дробовик, фазовое
                   // движение, магнит добычи и прочие) продолжали выпадать пустышками.
                   // Правило общее, а не список исключений: любой новый флаг
                   // подхватится сам, и про него не придётся помнить отдельно.
                   .filter(m => !(m.kind === 'flag' && taken.has(m.id)))
                   .filter(m => !(m.rar === 3 && G.lvl < 4));         // кейстоуны с 4 уровня
  const need = cardCount();          // 3, либо 4 если открыта покупка в магазине

  /* Круговой орб — воинская ветка, которая работает только собранной: один орб
     бьёт на 25% автоатаки, десять держат оборону. Наравне со всеми он выпадает редко:
     игрок берёт первый и до второго не доживает. Поэтому начатая ветка получает
     место в раздаче с шансом 52%, пока не упрётся в потолок.
     Сделано отдельным броском, а НЕ повышенным весом в общей рулетке: вес пришлось
     бы подгонять под размер пула, а пул зависит от класса и от уже взятого.
     Замер веса 130 давал 6% вместо 30% — цифру пришлось бы искать заново
     после каждой новой карточки в каталоге. Бросок даёт ровно то, что написано. */
  /* Приоритетные места. Общее правило: сколько бы приоритетов ни сработало,
     хотя бы одно место в раздаче обязано остаться свободным — иначе выбора
     не существует, а показывать игроку заранее известные карточки незачем. */
  const freeSlots = () => need - 1 - out.length;

  /* СВИТА: некромант качает две вещи сразу — себя и свиту, — а мест у него
     столько же, сколько у остальных. Поэтому первое место всегда его свиты,
     второе — в половине случаев. Внутри категории тянем по обычным весам,
     иначе редкие ветки (големы, бомбардиры, повышение ранга) выпадали бы наравне
     с рядовыми процентами и перестали бы быть событием. */
  if (G.weapon.minions){
    const mins = pool.filter(m => m.req === 'min' && !(m.kind === 'flag' && taken.has(m.id)));
    const drawMin = () => {
      const left = mins.filter(m => !out.includes(m));
      if (!left.length) return false;
      const tw = left.reduce((s2,m)=> s2 + weight(m), 0);
      let t2 = Math.random()*tw, chosen = left[0];
      for (const m of left){ t2 -= weight(m); if (t2 <= 0){ chosen = m; break; } }
      out.push(chosen); return true;
    };
    if (freeSlots() > 0 && Math.random() < MINION_PRIORITY) drawMin();
    if (freeSlots() > 0 && Math.random() < MINION_PRIORITY_2) drawMin();
  }

  const orbHooked = G.picks.some(x => x.id === 'shape.orbit') && D.orbitN < 10;
  if (orbHooked && freeSlots() > 0 && Math.random() < ORBIT_PRIORITY){
    const orb = pool.find(m => m.id === 'shape.orbit');
    if (orb && !out.includes(orb)) out.push(orb);
  }
  let guard = 0;
  while (out.length < need && pool.length && guard++ < 200){
    const total = pool.reduce((s,m)=> s + weight(m), 0);
    let t = Math.random()*total, chosen = pool[0];
    for (const m of pool){ t -= weight(m); if (t <= 0){ chosen = m; break; } }
    if (!out.includes(chosen)) out.push(chosen);
    if (out.length >= pool.length) break;
  }
  // Только что открывшаяся ветка обязана показаться сразу — иначе игрок
  // может не узнать, что его 100% взрыва вообще что-то разблокировали.
  const fresh = MODS.find(m => m.unlock && !taken.has(m.id)
                            && (!m.show || m.show()) && !(m.hide && m.hide()) && fits(m));
  if (fresh && !out.includes(fresh)) out.splice(0, 0, fresh), out.length = need;

  return out;
}

/* Единое место броска числа карточки. int даёт честный целый процент,
   cap обрезает последнюю карточку ровно до остатка. Так в сумке тоже нет
   скрытого перекапа, а UI показывает ровно то, что игрок получит. */
function rollModValue(m, random=Math.random){
  if (m.kind === 'flag') return 1;
  let v;
  if (m.r[0] === m.r[1]) v = m.r[0];
  else if (m.int) v = Math.floor(m.r[0] + random()*(m.r[1]-m.r[0]+1));
  else v = m.r[0] + random()*(m.r[1]-m.r[0]);
  if (m.cap !== undefined){
    const e = G.bag.s[m.stat];
    const current = !e ? 0 : m.kind === 'inc' ? e.inc : m.kind === 'more' ? (e.more-1)*100 : e.flat;
    v = Math.min(v, Math.max(0, m.cap-current));
  }
  return v;
}

function showLevelUp(){
  hideSkillTip();
  const cards = rollCards();
  const rc = r => ['','r-rare','r-epic','r-key','r-blood'][r||0];
  const fmt = m => {
    const v = rollModValue(m);
    const val = m.kind === 'flag' ? '' :
                m.kind === 'more' ? '×' + (1+v/100).toFixed(2) :
                m.kind === 'inc'  ? '+' + Math.round(v) + '%' :
                m.kind === 'chance'? Math.round(v) + '%' :
                '+' + (m.int ? Math.round(v) : v < 10 ? v.toFixed(1) : Math.round(v));
    return {v, val};
  };
  const rolled = cards.map(m => ({m, ...fmt(m)}));
  const linkedUnlocks = linkedUnlocksForCards(rolled);
  G.levelUpCards = rolled;

  $('#ov').style.display = 'flex';
  $('#ov').innerHTML =
    '<h1>УРОВЕНЬ ' + G.lvl + '</h1><h2>выберите модификатор · осталось повышений: ' + G.pending + '</h2>' +
    '<div class="cards level-card-grid" style="--level-columns:' + rolled.length + '">' + rolled.map((c,i) =>
      '<div class="level-card-column" style="--level-column:' + (i+1) + '"><div class="card ' + rc(c.m.rar) + '" data-i="' + i + '" aria-keyshortcuts="' + (i+1) + '">' +
        '<div class="card-top"><div class="level-key-group"><kbd class="level-key" aria-hidden="true">' + (i+1) + '</kbd><div class="cat">' + c.m.cat + ' · ' + KIND_HINT[c.m.kind] + '</div></div>' + classAvailabilityHtml(c.m) + '</div>' +
        '<div class="nm">' + c.m.nm + '</div>' +
        levelCardBodyHtml(c) +
        (affectsMinions(c.m) ? '<div class="mn">ДЕЙСТВУЕТ И НА СВИТУ</div>' : '') +
        '<div class="id">' + c.m.id + '</div>' +
      '</div>' + levelUnlockPanelHtml([c], linkedUnlocks) + '</div>').join('') + '</div>' +
    '<div class="level-actions"><div class="level-key-hint">КЛАВИШИ 1–' + rolled.length + ' — ВЫБОР КАРТОЧКИ</div><button id="rr" aria-keyshortcuts="Space"' + (G.rerolls ? '' : ' disabled') + '><span>ПЕРЕБРОСИТЬ</span> (' + G.rerolls + ') <kbd class="reroll-key">ПРОБЕЛ</kbd></button>' +
    '<button id="skilltips-toggle" type="button" aria-pressed="' + SKILL_TIPS_ENABLED + '"' + (SKILL_TIPS_ENABLED ? '' : ' class="tips-off"') + '>' + skillTipsToggleText() + '</button></div>';

  document.querySelectorAll('#ov .card').forEach(el => {
    const c = rolled[+el.dataset.i];
    el.onmouseenter = ev => showSkillTip(ev, c);
    el.onmousemove = moveSkillTip;
    el.onmouseleave = hideSkillTip;
    el.onclick = () => chooseLevelUpCard(+el.dataset.i);
  });
  bindLevelUnlockPanel(linkedUnlocks);
  const rr = $('#rr');
  if (rr) rr.onclick = rerollLevelUp;
  const tipsToggle = $('#skilltips-toggle');
  if (tipsToggle) tipsToggle.onclick = () => setSkillTipsEnabled(!SKILL_TIPS_ENABLED);
}

function rerollLevelUp(){
  if (!G || G.pending <= 0 || G.rerolls <= 0 || !Array.isArray(G.levelUpCards)) return false;
  G.rerolls--;
  showLevelUp();
  return true;
}

function chooseLevelUpCard(index){
  if (!G || G.pending <= 0 || !Array.isArray(G.levelUpCards)) return false;
  const c = G.levelUpCards[index];
  if (!c) return false;
  // Сразу закрываем текущий набор: один keydown/click не может выбрать две карты.
  G.levelUpCards = null;
  hideSkillTip();
  G.bag.add(c.m.stat, c.m.kind, c.v);
  G.picks.push({id:c.m.id, nm:c.m.nm, val:c.val, v:c.v, cat:c.m.cat});
  recalc();
  G.pending--;
  continueAfterLevelUp();
  renderSheet();
  return true;
}

function continueAfterLevelUp(){
  if (G.pending > 0){ showLevelUp(); return; }
  if (showFloorFindSummary()) return;
  $('#ov').style.display = 'none'; $('#ov').innerHTML = ''; last = performance.now();
}

function renderSheet(){
  const b = G.bag;
  const r = (n,v) => '<div class="row"><span>' + n + '</span><b>' + v + '</b></div>';
  const subclass = Object.values(SUBCLASSES).flat().find(s => s.id === G.subclass);
  $('#sheet').innerHTML =
    '<h3>ОРУЖИЕ</h3>' + r(G.weapon.nm, G.weapon.id) +
    (subclass ? r('Подкласс', subclass.nm) : '') +
    (SHOP.some(it => shopLvl(it.id)) ?
      '<h3>ИЗ МАГАЗИНА</h3>' + SHOP.filter(it => shopLvl(it.id)).map(it =>
        r(it.nm, it.fmt ? it.fmt(shopLvl(it.id)) : '+' + shopLvl(it.id) + (it.unit || ''))).join('')
    : '') +
    '<h3>ОСНОВНОЕ</h3>' +
      r('Здоровье', Math.round(D.life)) +
      r('Быстрое лечение', D.regen.toFixed(1) + ' HP/5 сек · до 50% HP') +
      r('Урон за удар', Math.round(D.baseMin) + '–' + Math.round(D.baseMax)) +
      r('Средний удар', Math.round(attackAvgHit())) +
      r('Скорость атаки', (1/currentAttackCooldown()).toFixed(2) + '/сек') +
      r('Шанс крита', D.critCh.toFixed(1) + '%') +
      r('Множитель крита', Math.round(D.critMul) + '%') +
      r('Скорость бега', Math.round(D.mspd)) +
      r('Получаемое золото', '×' + D.goldFind.toFixed(2)) +
    '<h3>СТИХИИ</h3>' +
      r('Огонь', D.elem.fire.toFixed(1)) + r('Холод', D.elem.cold.toFixed(1)) +
      r('Молния', D.elem.lit.toFixed(1)) + r('Яд', D.elem.poi.toFixed(1)) +
    '<h3>ЗАЩИТА</h3>' +
      r('Броня', Math.round(D.armor) + ' · гасит ' + armorReduction(D.armor).toFixed(1) + '% входящего урона') +
      (D.drShop ? r('Броня из магазина', '−' + D.drShop + '%') : '') + r('Уворот', D.dodge + '%') +
      (D.normalDr ? r('От обычных монстров', '−' + D.normalDr + '%') : '') +
      (D.majorDr ? r('От элиты и боссов', '−' + D.majorDr + '%') : '') +
      r('Вампиризм', D.leech.toFixed(1) + '%') +
    '<h3>ГЕОМЕТРИЯ</h3>' +
      r('Снарядов', D.projN) + r('Пробитие', D.pierce) + r('Отскоки', D.chain) +
      r('Радиус AoE', '×' + D.aoeR.toFixed(2)) +
      // Радиусы показываем числами: множитель ×1.40 ничего не говорит о том,
      // достанет ли молния до соседней кучи
      r('Радиус чумы / сфера', Math.round(PLAGUE_RADIUS*D.aoeR*D.plagueRadius) + ' / ' + Math.round((G.weapon.aoe||0)*D.aoeR)) +
      r('Разлёт молний', Math.round(D.shockR) + ' (до ' + shockTargets() + ' целей · ' + Math.round(shockShare()*100) + '% удара)') +
      (D.inferno ? r('Перекидывание поджога', Math.round(D.infernoR)) : '') +
      (b.has('slowAura') ? r('Аура замедления', Math.round(D.slowAuraR)) : '') +
      (D.orbitN ? r('Круговые орбы', D.orbitN + ' / 10 · ' + Math.round(attackAvgHit()*0.25) + ' за касание') : '') +
      r('Чумный взрыв трупа', Math.round(D.explode) + '%') +
      (D.explodeMega ? r('МЕГА-чума', Math.round(D.explodeMega) + '%  (радиус ×2)') : '') +
    (D.hasMin ?
      '<h3>СВИТА</h3>' +
      r('Всего приспешников', G.minions.length + ' / ' + D.minMax) +
      r('Скелеты:', mCount('skeleton') + '/' + skeletonDisplayCap()) +
      (D.maxBomb ? r('Бомбардиры', mCount('bombardier') + ' / ' + D.maxBomb + ' · 25% урона · радиус ' + Math.round(BOMBARDIER_BLAST_RADIUS*D.aoeR)) : '') +
      (D.golemB ? r('Голем крови', 'ур. ' + D.golemB + '/10 · ' +
        Math.round(D.minLife*0.35*D.golemB) + ' HP · ' + Math.round(avgHit()*D.golemBMul*MINION_DAMAGE_MULT) + ' за удар · ' +
        (D.minAspd/D.golemBCd).toFixed(2) + ' уд/сек') : '') +
      (D.golemN ? r('Костяной голем', 'ур. ' + D.golemN + '/10 · ' +
        Math.round(D.minLife*0.20*D.golemN) + ' HP · кровь ' +
        (avgHit()*0.03*D.golemN*D.ailEff).toFixed(1) + '/сек за стак') : '') +
      r('Урон скелета', Math.round(avgHit()*D.minDmgMul*MINION_DAMAGE_MULT)) +
      r('Здоровье скелета', Math.round(D.minLife)) +
      r('Атак/сек', (D.minAspd/0.78).toFixed(2)) +
      r('Крит свиты', D.minCrit.toFixed(1) + '%') +
      r('Шансы эффектов свиты', '25% от ваших') +
      (D.deathLord ? r('Лорд Смерти', '0,1% фактического урона свиты лечит героя') : '') +
      r('Наследование статов', Math.round(D.minInherit*100) + '% (урон, здоровье, крит)') +
      r('Скорость свиты', 'атака ' + (D.minAspd/0.5).toFixed(1) + '/сек · бег ' + Math.round(D.minSpd)) +
      r('Воскрешение', D.minRevive.toFixed(2) + ' сек') +
      r('Срок жизни бойца', MINION_LIFE_MIN + '–' + MINION_LIFE_MAX + ' сек · смерть запускает эффекты') +
      r('Перехват урона', Math.round(D.minBond) + '%' +
        (D.minBondRaw >= 50 ? ' (ветка на потолке)' : ''))
      + (D.bloodTies ? r('Кровные узы', 'x2 урона свиты на 3 сек после удара') : '')
      + (D.minFrenzy ? r('Буйство демонов', 'взрыв радиусом ' + Math.round(FRENZY_R*D.aoeR)) : '')
      + (D.minBlink ? r(b.has('minRaid') ? 'Астральный набег' : 'Внезапный взрыв',
          'раз в ' + D.minBlink.cd + ' сек · ' + Math.round(D.minBlink.mul*100) + '% удара · радиус ' +
          Math.round(D.minBlink.r*D.aoeR)) : '')
      + (D.minClaws ? r('Резкие когти', 'каждый 5-й удар · +30% мощности') : '')
      + (D.minWhirl ? r('Вихрь когтей', 'каждый 10-й удар · 20% по радиусу ' +
          Math.round(WHIRL_R*D.aoeR)) : '')
      + (D.minBath ? r('Кровавая баня', '10% ударов свиты · ' +
          Math.round(bookBleedDps() || avgHit()*0.15*D.ailEff) + ' урона/сек за стак') : '')
      + (D.minBoil ? r('Кипящая кровь', '5% на лужу радиусом ' + Math.round(BOIL_R*D.aoeR) +
          ' · 5% текущего здоровья в секунду') : '')
      + (D.venomancer ? r('Кислота веномансера', '2 сек · 5% текущего здоровья/сек') : '') +
      r('Трупов на земле', G.corpses.length)
    : '') +
    (Object.keys(G.totems).length ?
      '<h3>ТОТЕМЫ</h3>' +
      TOTEM_KEYS.filter(k => totemTier(k)).map(k =>
        '<div class="pick" style="border-left:2px solid ' + TOTEMS[k].col + ';padding-left:7px">' +
        totemSpriteHTML(k,totemTier(k),'tiny') + TOTEM_RANKS[totemTier(k)-1] + ' ' + TOTEMS[k].nm +
        '<br><i>+' + totemVal(k) + '% урона по ' + TOTEMS[k].st + ' целям' +
        (totemTier(k) < 4 ? ' · следующий ранг +' + TOTEM_VALS[totemTier(k)] + '%' : ' · максимум') +
        '</i></div>').join('')
    : '') +
    (Object.keys(G.amu).length ?
      '<h3>ПРЕДМЕТЫ: ' + Object.keys(G.amu).length + ' из ' + AMU_KEYS.length + '</h3>' +
      Object.keys(SLOTS).map(sl => {
        const got = AMU_KEYS.filter(k => G.amu[k] && AMULETS[k].slot === sl);
        if (!got.length) return '';
        return '<div class="k" style="font-size:12px;letter-spacing:2px;margin-top:7px">' +
          SLOTS[sl] + '</div>' +
          got.map(k => '<div class="pick" style="border-left:2px solid ' + AMULETS[k].col +
            ';padding-left:7px">' + rareItemSpriteHTML(k,'tiny') + AMULETS[k].nm +
            '<br><i>' + AMULETS[k].nt + '</i></div>').join('');
      }).join('')
    : '') +
    (Object.keys(G.items).length ?
      '<h3>НАЙДЕННЫЕ КНИГИ</h3>' +
      BOOK_KEYS.filter(k=>G.items[k]).map(k =>
        '<div class="pick" style="border-left:2px solid ' + BOOKS[k].col + ';padding-left:7px">' +
        BOOKS[k].nm + ' · тир ' + G.items[k].tier + ' <b style="color:' + BOOKS[k].col + '">+' +
        G.items[k].val + ((BOOKS[k].pct||k==='monster'||k==='xp') ? '%' : '') + '</b>' +
        (BOOKS[k].proc ? ' · срабатывает <b>' + bookChance(k) + '%</b>' : '') +
        (k==='poison' ? '<br><i>' + Math.round(D.bookPoiDps) + ' урона/сек за прок</i>' : '') +
        (k==='bleed'  ? '<br><i>' + Math.round(bookBleedDps()) + ' урона/сек за прок</i>' : '') +
        '</div>').join('')
    : '') +
    '<h3>ВЗЯТО МОДИФИКАТОРОВ: ' + G.picks.length + '</h3>' +
      G.picks.map(p => '<div class="pick">' + p.val + ' ' + p.nm + '<br><i>' + p.id + '</i></div>').join('');
}

/* Полный инвентарь: читабельная версия всех находок и взятых модификаторов.
   Он не меняет билд — только даёт спокойно перечитать, что уже найдено. */
function renderInventory(){
  const inv = $('#inventory');
  const none = '<div class="invempty">Пока ничего не найдено.</div>';
  const bookKeys = Object.keys(G.items);
  const amuKeys = AMU_KEYS.filter(k => G.amu[k]);
  const totemKeys = TOTEM_KEYS.filter(k => totemTier(k));
  const item = (color, title, detail, note) =>
    '<div class="invitem" style="border-left-color:' + color + '"><b>' + title + '</b><span>' + detail + '</span>' +
    (note ? '<i>' + note + '</i>' : '') + '</div>';
  const books = bookKeys.length ? bookKeys.map(k => {
    const B = BOOKS[k], it = G.items[k], unit = (B.pct || k === 'monster' || k === 'xp') ? '%' : '';
    const proc = B.proc ? ' · шанс срабатывания ' + bookChance(k) + '%' : '';
    return item(B.col, lootSpriteHTML(k,'inventory') + B.nm + ' · тир ' + it.tier,
      'Сила: +' + it.val + unit + proc, B.desc.replace(/N/g, it.val + unit));
  }).join('') : none;
  const amulets = amuKeys.length ? amuKeys.map(k => {
    const A = AMULETS[k], rar = ['обычный','редкий','эпический','легендарный'][A.rar];
    return item(A.col, rareItemSpriteHTML(k,'inventory') + A.nm, SLOTS[A.slot].toLowerCase() + ' · ' + rar, A.nt);
  }).join('') : none;
  const totems = totemKeys.length ? totemKeys.map(k => {
    const T = TOTEMS[k], tier = totemTier(k);
    return item(T.col, totemSpriteHTML(k,tier,'inventory') + TOTEM_RANKS[tier-1] + ' ' + T.nm,
      '+' + totemVal(k) + '% урона по ' + T.st + ' целям · ранг ' + tier + '/4',
      'Следующая находка повышает ранг, пока не достигнут великий тотем.');
  }).join('') : none;
  const mods = G.picks.length ? G.picks.map(p => {
    const M = MODS.find(m => m.id === p.id);
    return item('#6fb3ff', p.val + ' ' + p.nm, p.cat + ' · ' + p.id, M && M.nt ? M.nt : 'Постоянный модификатор этого забега.');
  }).join('') : none;
  inv.innerHTML =
    '<h1>ИНВЕНТАРЬ</h1><div class="k">TAB или ESC — закрыть и продолжить</div>' +
    item('#9aa7b4', 'БРОНЯ: ' + Math.round(D.armor), 'Гасит ' + armorReduction(D.armor).toFixed(1) + '% каждого обычного входящего удара.',
      'После брони отдельно применяются блок, плоское и процентное снижение урона.') +
    '<h3>КНИГИ · ' + bookKeys.length + '</h3>' + books +
    '<h3>АМУЛЕТЫ И СНАРЯЖЕНИЕ · ' + amuKeys.length + '</h3>' + amulets +
    '<h3>ТОТЕМЫ · ' + totemKeys.length + '</h3>' + totems +
    '<h3>МОДИФИКАТОРЫ УРОВНЕЙ · ' + G.picks.length + '</h3>' + mods;
}

function toggleInventory(){
  if (G.pending || G.over || $('#ov').style.display === 'flex') return;
  G.inventoryOpen = !G.inventoryOpen;
  G.quickPaused=false; $('#quickpause').style.display='none';
  G.paused = G.inventoryOpen;
  $('#inventory').style.display = G.inventoryOpen ? 'block' : 'none';
  $('#sheet').style.display = G.inventoryOpen ? 'block' : 'none';
  if (G.inventoryOpen){ renderSheet(); renderInventory(); }
  $('#pauseov').style.display = 'none';
  last = performance.now();
}
