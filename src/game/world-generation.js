/* ---------- 5. ГЕНЕРАЦИЯ ЭТАЖА ---------- */
const ETYPES = {
  blob:  {shape:'circle',  nm:'Ядро',     hp:16, spd:120, dmg:9,  r:14, col:'#5ec2e0', xp:4},
  runner:{shape:'triangle',nm:'Бегун',    hp:8,  spd:170, dmg:7,  r:12, col:'#8be04e', xp:5},
  tank:  {shape:'square',  nm:'Бастион',  hp:50, spd:65,  dmg:18, r:19, col:'#e0743c', xp:9},
  shooter:{shape:'diamond',nm:'Призма',   hp:14, spd:75,  dmg:11, r:14, col:'#d95ec2', xp:8, ranged:true},
};
/* Элита получает разновидность поверх базового типа. Командные аффиксы пачки
   остаются независимыми: пиромант может быть маяком, страж — бронированным. */
const ELITE_GUARD_DASH_COOLDOWN = 4;
const ELITE_GUARD_DASH_TIME = 0.36;
const ELITE_GUARD_DASH_SPEED_MULT = 3.4;
const ELITE_VARIANTS=Object.freeze({
  frostWolf:      {base:'runner',nm:'Морозный волк',          hit:'frost'},
  toxicRunner:    {base:'runner',nm:'Токсичный бегун',        hit:'poison'},
  cursedRogue:    {base:'runner',nm:'Проклятый кинжальщик',   spdMul:1.10},
  skeletonWarrior:{base:'blob',  nm:'Воин-скелет',            playerTaken:0.85},
  blightGrunt:    {base:'blob',  nm:'Громила',                 hit:'shove'},
  boneGargoyle:   {base:'blob',  nm:'Костяная гаргулья',      hit:'cut'},
  fallenPyromancer:{base:'shooter',nm:'Падший пиромант',      shot:'pyro'},
  beholderSlave:  {base:'shooter',nm:'Слуга бехолдера',       runnerSpeed:true},
  skeletonCrossbow:{base:'shooter',nm:'Скелет-арбалетчик',    shot:'crossbow'},
  forgottenGuard: {base:'tank',  nm:'Забытый страж',          hit:'guard',dmgMul:0.70,dash:true},
  abyssalExecutioner:{base:'tank',nm:'Палач бездны',          hit:'abyssBurn',dmgMul:1.20,spdMul:0.80},
  plagueOgre:     {base:'tank',  nm:'Чумоносный огр',         hit:'acid'},
});
const ELITE_VARIANT_POOLS=Object.freeze({
  runner:['frostWolf','toxicRunner','cursedRogue'],
  blob:['skeletonWarrior','blightGrunt','boneGargoyle'],
  shooter:['fallenPyromancer','beholderSlave','skeletonCrossbow'],
  tank:['forgottenGuard','abyssalExecutioner','plagueOgre'],
});
function eliteVariantDef(e){ return e && e.kind==='elite' && e.eliteVariant ? ELITE_VARIANTS[e.eliteVariant] : null; }
function applyEliteVariant(e, requested){
  if (!e || e.kind!=='elite') return null;
  const pool=ELITE_VARIANT_POOLS[e.typeKey];
  if (!pool) return null;
  const id=pool.indexOf(requested)>=0?requested:pick(pool),def=ELITE_VARIANTS[id];
  e.eliteVariant=id;
  e.t=Object.assign({},e.t,{nm:def.nm});
  if (def.runnerSpeed) e.spd=ETYPES.runner.spd*0.9*(1+G.bossKills*0.02);
  if (def.spdMul) e.spd*=def.spdMul;
  if (def.dmgMul) e.dmg*=def.dmgMul;
  if (def.dash){ e.eliteDashCd=ELITE_GUARD_DASH_COOLDOWN; e.eliteDashT=0; e.eliteDashA=0; }
  return id;
}
function applyEliteContact(e){
  const def=eliteVariantDef(e),p=G.player;
  if (!def || !def.hit) return false;
  if (def.hit==='frost') applyBossSlow(0.70,0.5);
  else if (def.hit==='poison'){
    const active=p.elitePoisonT>0,old=active?(p.elitePoisonStacks||0):0;
    p.elitePoisonStacks=Math.min(5,old+1); p.elitePoisonT=4;
    if (!active) p.elitePoisonTick=1;
    if (p.elitePoisonStacks>old)
      G.fx.push({t:'txt',x:p.x,y:p.y-34,s:'ЯД ×'+p.elitePoisonStacks,life:0.8,col:'#8bd346'});
    G.fx.push({t:'ring',x:p.x,y:p.y,r:p.r+5,max:p.r+19,life:0.24,col:'#8bd346'});
  } else if (def.hit==='shove'){
    const a=Math.atan2(p.y-e.y,p.x-e.x);
    p.vx+=Math.cos(a)*120; p.vy+=Math.sin(a)*120;
    applyBossSlow(0.80,0.5);
  } else if (def.hit==='cut'){
    const active=p.eliteCutT>0;
    p.eliteCutT=4; if (!active) p.eliteCutTick=0.5;
    if (!active) G.fx.push({t:'txt',x:p.x,y:p.y-34,s:'ПОРЕЗ',life:0.8,col:'#ef5b62'});
    G.fx.push({t:'ring',x:p.x,y:p.y,r:p.r+4,max:p.r+17,life:0.22,col:'#ef5b62'});
  } else if (def.hit==='guard'){
    p.eliteGuardSlowStacks=Math.min(9,(p.eliteGuardSlowT>0?p.eliteGuardSlowStacks:0)+1);
    p.eliteGuardSlowT=6;
    G.fx.push({t:'txt',x:p.x,y:p.y-34,s:'ТЯЖЕСТЬ ×'+p.eliteGuardSlowStacks,life:0.8,col:'#9aa7b4'});
    G.fx.push({t:'ring',x:p.x,y:p.y,r:p.r+5,max:p.r+20,life:0.25,col:'#9aa7b4'});
  } else if (def.hit==='abyssBurn'){
    const fresh=!(p.eliteAbyssBurnT>0); p.eliteAbyssBurnT=1;
    if (fresh) p.eliteAbyssBurnTick=0.25;
    G.fx.push({t:'txt',x:p.x,y:p.y-34,s:'ПЛАМЯ БЕЗДНЫ',life:0.75,col:'#ff642f'});
  } else if (def.hit==='acid'){
    dropEliteAcid(p.x,p.y,54,false);
  }
  return true;
}
function applyEliteProjectileHit(s){
  const p=G.player;
  if (!s || s.eliteVariant==='beholderSlave') return false;
  if (s.eliteVariant==='fallenPyromancer'){
    const fresh=!(p.elitePyroBurnT>0); p.elitePyroBurnT=4;
    if (fresh) p.elitePyroBurnTick=0.5;
    G.fx.push({t:'txt',x:p.x,y:p.y-34,s:'ГОРИТ',life:0.75,col:'#ff7a2f'});
    G.fx.push({t:'ring',x:p.x,y:p.y,r:p.r+5,max:p.r+19,life:0.24,col:'#ff7a2f'});
    return true;
  }
  if (s.eliteVariant==='skeletonCrossbow'){
    applyBossSlow(0.70,1);
    return true;
  }
  return false;
}
function tickElitePlayerEffects(dt){
  const p=G.player;
  if (p.elitePoisonT>0){
    const was=p.elitePoisonT; p.elitePoisonT=Math.max(0,was-dt); p.elitePoisonTick-=dt;
    while (p.elitePoisonTick<=0 && was>0){
      p.elitePoisonTick+=1;
      hurt(D.life*0.03*(p.elitePoisonStacks||1),false,false,'ЭЛИТА · ТОКСИЧНЫЙ БЕГУН · ЯД','elite');
      if (G.over) break;
    }
    if (p.elitePoisonT<=0){ p.elitePoisonStacks=0; p.elitePoisonTick=0; }
  }
  if (G.over) return;
  if (p.eliteCutT>0){
    const was=p.eliteCutT; p.eliteCutT=Math.max(0,was-dt); p.eliteCutTick-=dt;
    while (p.eliteCutTick<=0 && was>0){
      p.eliteCutTick+=0.5;
      hurt(D.life*0.03,false,false,'ЭЛИТА · КОСТЯНАЯ ГАРГУЛЬЯ · ПОРЕЗ','elite');
      if (G.over) break;
    }
    if (p.eliteCutT<=0) p.eliteCutTick=0;
  }
  if (G.over) return;
  if (p.elitePyroBurnT>0){
    const was=p.elitePyroBurnT; p.elitePyroBurnT=Math.max(0,was-dt); p.elitePyroBurnTick-=dt;
    while (p.elitePyroBurnTick<=0 && was>0){
      p.elitePyroBurnTick+=0.5;
      hurt(D.life*0.03,false,false,'ЭЛИТА · ПАДШИЙ ПИРОМАНТ · ГОРЕНИЕ','elite');
      if (G.over) break;
    }
    if (p.elitePyroBurnT<=0) p.elitePyroBurnTick=0;
  }
  if (G.over) return;
  if (p.eliteAbyssBurnT>0){
    const was=p.eliteAbyssBurnT; p.eliteAbyssBurnT=Math.max(0,was-dt); p.eliteAbyssBurnTick-=dt;
    while (p.eliteAbyssBurnTick<=0 && was>0){
      p.eliteAbyssBurnTick+=0.25;
      hurt(D.life*0.05,false,false,'ЭЛИТА · ПАЛАЧ БЕЗДНЫ · ГОРЕНИЕ','elite');
      if (G.over) break;
    }
    if (p.eliteAbyssBurnT<=0) p.eliteAbyssBurnTick=0;
  }
  p.eliteGuardSlowT=Math.max(0,(p.eliteGuardSlowT||0)-dt);
  if (p.eliteGuardSlowT<=0) p.eliteGuardSlowStacks=0;
}
function tickEliteAbility(e,dt,tgt){
  if (!e || e.eliteVariant!=='forgottenGuard') return false;
  tgt=G.player;                                      // страж всегда прорывается именно к герою
  e.eliteDashCd=(e.eliteDashCd===undefined?ELITE_GUARD_DASH_COOLDOWN:e.eliteDashCd)-dt;
  if (e.eliteDashCd<=0 && e.eliteDashT<=0 && dist(e,tgt)>e.r+tgt.r+8){
    e.eliteDashCd+=ELITE_GUARD_DASH_COOLDOWN; e.eliteDashT=ELITE_GUARD_DASH_TIME;
    e.eliteDashA=Math.atan2(tgt.y-e.y,tgt.x-e.x);
    startEnemyAttackVisual(e,ELITE_GUARD_DASH_TIME+0.16,0);
    G.fx.push({t:'ring',x:e.x,y:e.y,r:e.r,max:e.r+25,life:0.16,col:'#9aa7b4'});
  }
  if (e.eliteDashT>0){
    const step=e.spd*ELITE_GUARD_DASH_SPEED_MULT*dt;
    e.x=clamp(e.x+Math.cos(e.eliteDashA)*step,-ARENA+e.r,ARENA-e.r);
    e.y=clamp(e.y+Math.sin(e.eliteDashA)*step,-ARENA+e.r,ARENA-e.r);
    e.eliteDashT=Math.max(0,e.eliteDashT-dt);
    return true;
  }
  return false;
}
function fireEliteRanged(e,a,edmg){
  const def=eliteVariantDef(e),id=e.eliteVariant;
  let speed=230,r=6,shotType='shooter',col='#d95ec2';
  if (def && def.shot==='pyro'){ speed=245; r=5; shotType='eliteFireball'; col='#ff6a20'; }
  else if (def && def.shot==='crossbow'){ speed=285; r=5; shotType='eliteBolt'; col='#c9b080'; }
  G.eshots.push({x:e.x,y:e.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
    r,life:2.6,dmg:edmg*0.8,pk:e.pack,shotType,col,eliteVariant:id,sourceKind:'elite',
    cause:enemyCause(e,shotType==='eliteFireball'?'огненный шар':shotType==='eliteBolt'?'болт':'снаряд'),owner:e});
}
function dropEliteAcid(x,y,r,deathPool){
  if (G.eliteAcidPools.length>=24) G.eliteAcidPools.shift();
  G.eliteAcidPools.push({x,y,r,life:2,max:2,tick:0.5,maxHpPct:0.10,deathPool:!!deathPool});
  G.fx.push({t:'ring',x,y,r:8,max:r,life:0.30,col:'#9ddc38'});
}
function tickEliteAcidPools(dt){
  const p=G.player;
  for (let i=G.eliteAcidPools.length-1;i>=0;i--){
    const pl=G.eliteAcidPools[i],was=pl.life; pl.life=Math.max(0,pl.life-dt); pl.tick-=dt;
    while (pl.tick<=0 && was>0){
      pl.tick+=0.5;
      if (dist(pl,p)<pl.r+p.r)
        hurt(D.life*pl.maxHpPct,false,false,'ЭЛИТА · ЧУМОНОСНЫЙ ОГР · КИСЛОТА','elite');
      if (G.over) break;
    }
    if (pl.life<=0) G.eliteAcidPools.splice(i,1);
  }
}
// Босс использует спрайт Бастиона, но имеет отдельную балансную скорость.
// Пока сохраняем прежние 80,7; новое число можно задать здесь независимо от обычного танка.
const BOSS_SPEED = 80.7;
const BOSS_GOAT_AOE = 180;
const BOSS_GOAT_WARN = 0.75;
const BOSS_EXECUTIONER_CD = 3;
const BOSS_TYRANT_REACH = 165;
const BOSS_TYRANT_ARC = Math.PI * 0.62;
const BOSS_BEHEMOTH_WARN = 0.45;
const BOSS_BEHEMOTH_FLIGHT = 0.35;
const BOSS_VAMPIRE_WARN = 1;
const BOSS_VAMPIRE_COOLDOWN = 2;
const BOSS_VOID_WARN = 1;
const BOSS_MINOTAUR_WARN = 0.45;
const BOSS_MINOTAUR_CHARGE_SPEED = 2800;
const BOSS_MINOTAUR_VULNERABLE = 1.2;
const BOSS_MINOTAUR_RECHARGE = 1.5;
const BOSS_MINOTAUR_SPEAR_DAMAGE = 0.15;
const BOSS_SERAPH_WARN = 0.8;
const BOSS_QUEEN_WARN = 1;

/* Все предупреждения говорят цветом только о последствии, а не о владельце.
   Заполнение всегда занимает последние 0.8 секунды любого замаха. */
const TELEGRAPH_FILL_TIME=0.8, TELEGRAPH_EDGE_FLASH=0.05, TELEGRAPH_TRACE_TIME=0.13;
const TELEGRAPH_TYPES=Object.freeze({
  warning:'#f6c344', damage:'#ff3b45', control:'#b56cff',
});
function telegraphFill(remaining){ return clamp((TELEGRAPH_FILL_TIME-remaining)/TELEGRAPH_FILL_TIME,0,1); }
function drawVoidGroundRift(x,y,r,progress,alpha=1){
  if (!VOID_GROUND_RIFT || !VOID_GROUND_RIFT.complete || !VOID_GROUND_RIFT.naturalWidth) return false;
  const frame=VOID_GROUND_RIFT_FRAMES[Math.min(3,Math.floor(clamp(progress,0,0.999999)*4))],d=r*2;
  ctx.save(); ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
  ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
  ctx.drawImage(VOID_GROUND_RIFT,frame.x,frame.y,frame.w,frame.h,x-d/2,y-d/2,d,d);
  ctx.restore(); return true;
}
function telegraphPath(spec){
  ctx.beginPath();
  if (spec.shape==='corridor'){
    const dx=spec.x2-spec.x,dy=spec.y2-spec.y,len=Math.hypot(dx,dy)||1;
    const nx=-dy/len*(spec.width||24)/2,ny=dx/len*(spec.width||24)/2;
    ctx.moveTo(spec.x+nx,spec.y+ny); ctx.lineTo(spec.x2+nx,spec.y2+ny);
    ctx.lineTo(spec.x2-nx,spec.y2-ny); ctx.lineTo(spec.x-nx,spec.y-ny); ctx.closePath();
  } else if (spec.shape==='ring'){
    const half=(spec.width||36)/2,outer=Math.max(1,spec.r+half),inner=Math.max(0,spec.r-half);
    ctx.arc(spec.x,spec.y,outer,0,Math.PI*2);
    if (inner>0) ctx.arc(spec.x,spec.y,inner,0,Math.PI*2,true);
  } else if (spec.shape==='cone'){
    const a=spec.a||0,arc=spec.arc||Math.PI/2;
    ctx.moveTo(spec.x,spec.y);ctx.arc(spec.x,spec.y,spec.r,a-arc/2,a+arc/2);ctx.closePath();
  } else if (spec.shape==='arc'){
    const a=spec.a||0,arc=spec.arc||Math.PI/2,half=(spec.width||36)/2;
    const outer=Math.max(1,spec.r+half),inner=Math.max(0,spec.r-half);
    ctx.arc(spec.x,spec.y,outer,a-arc/2,a+arc/2);
    ctx.arc(spec.x,spec.y,inner,a+arc/2,a-arc/2,true);ctx.closePath();
  } else {
    ctx.arc(spec.x,spec.y,spec.r,0,Math.PI*2);
  }
}
function drawTelegraphTargetMarks(spec,alpha,col,width){
  if (spec.shape!=='target') return;
  const r=spec.r,cut=r*0.52;
  ctx.globalAlpha=alpha; ctx.strokeStyle=col; ctx.lineWidth=width; ctx.beginPath();
  ctx.moveTo(spec.x-r,spec.y);ctx.lineTo(spec.x-cut,spec.y);ctx.moveTo(spec.x+cut,spec.y);ctx.lineTo(spec.x+r,spec.y);
  ctx.moveTo(spec.x,spec.y-r);ctx.lineTo(spec.x,spec.y-cut);ctx.moveTo(spec.x,spec.y+cut);ctx.lineTo(spec.x,spec.y+r);
  ctx.stroke();
}
function drawTelegraph(spec){
  if (!renderTelegraphVisible(spec)) return false;
  const col=TELEGRAPH_TYPES[spec.kind]||TELEGRAPH_TYPES.warning;
  const fill=telegraphFill(spec.remaining), edge=spec.remaining<=TELEGRAPH_EDGE_FLASH;
  ctx.save(); telegraphPath(spec);
  if (fill>0){ ctx.globalAlpha=0.05+fill*0.22; ctx.fillStyle=col; ctx.fill(); }
  ctx.globalAlpha=0.72+fill*0.20; ctx.strokeStyle=edge?'#ffffff':col; ctx.lineWidth=edge?4:2; ctx.stroke();
  drawTelegraphTargetMarks(spec,ctx.globalAlpha,ctx.strokeStyle,ctx.lineWidth);
  ctx.restore();
  return true;
}
function pushTelegraphTrace(spec){
  G.fx.push(Object.assign({t:'telegraphTrace',life:TELEGRAPH_TRACE_TIME,max:TELEGRAPH_TRACE_TIME},spec));
}
function pushTimedTelegraph(spec,life){
  G.fx.push(Object.assign({t:'telegraph',life,max:life},spec));
}
function drawTelegraphTrace(spec){
  if (!renderTelegraphVisible(spec)) return false;
  const k=clamp(spec.life/(spec.max||TELEGRAPH_TRACE_TIME),0,1), col=TELEGRAPH_TYPES[spec.kind]||TELEGRAPH_TYPES.warning;
  ctx.save(); telegraphPath(spec); ctx.globalAlpha=k*0.18; ctx.fillStyle=col; ctx.fill();
  ctx.globalAlpha=k*0.85; ctx.strokeStyle=col; ctx.lineWidth=3; ctx.stroke();
  drawTelegraphTargetMarks(spec,k*0.85,col,3); ctx.restore();
  return true;
}
const BOSS_TYPES = {
  lich:  {nm:'ИЗУМРУДНЫЙ ЛИЧ', hud:'ОГРОМНАЯ СФЕРА', nt:'раз в 2 сек выпускает огромную сферу на 15% максимального здоровья и замедляет на 50% на 1 секунду', weight:30, spd:BOSS_SPEED, col:'#28f2df'},
  goat:  {nm:'БЕЗДОННЫЙ КОЗЛИНЫЙ ДЕМОН', hud:'УДАР ПО ЗЕМЛЕ', nt:'движется со скоростью игрока и раз в 3 сек бьёт по земле на 25% максимального здоровья', weight:30, spd:'player', col:'#ff5a2f'},
  plague:{nm:'ЧУМНАЯ МЕРЗОСТЬ', hud:'КИСЛОТА', nt:'раз в секунду плюётся слизью на 7.5% максимального здоровья и замедляет на 50% на 1 секунду; после смерти оставляет кислоту', weight:30, spd:BOSS_SPEED, col:'#9ddc38'},
  greed: {nm:'АЛЧНЫЙ ГРОМИЛА', hud:'КОПЬЁ 50%', nt:'редкий босс: призывает Бегунов, бросает смертельные копья и гарантирует две находки', weight:10, spd:55, col:'#e6a52d', rare:true},
  executioner:{nm:'КОРОЛЬ ПАЛАЧЕЙ', hud:'ВОЗВРАТНЫЙ ТОПОР', nt:'раз в 3 сек бросает вращающийся топор к отмеченной точке и обратно; попадание наносит 35% максимального здоровья и замедляет на 70%', weight:30, spd:72, col:'#b74735'},
  tyrant:{nm:'РОГАТЫЙ ТИРАН', hud:'ОГНЕННЫЙ СЛЕД', nt:'редкий босс: оставляет огонь и каждую секунду рубит конусом, поджигая игрока; гарантирует одну находку', weight:10, spd:70, col:'#ff4a22', rare:true},
  grave:{nm:'КОРОЛЬ МОГИЛ', hud:'ПРИЗЫВ ЯДЕР', nt:'каждую секунду призывает обычное Ядро текущего уровня сложности', weight:30, spd:68, col:'#8166b8'},
  behemoth:{nm:'БЕЗДОННЫЙ БЕГЕМОТ', hud:'ПРЫЖОК', nt:'раз в 3 сек прыгает к отмеченной позиции игрока', weight:30, spd:62, col:'#a0505b'},
  vampire:{nm:'ВАМПИРСКИЙ ЛОРД', hud:'КРЕСТ 1с/2с', nt:'через каждые 2 секунды ставит Кровавую метку на 1 секунду; попадание крестом лечит босса', weight:30, spd:78, col:'#c7253e'},
  voidwrath:{nm:'ГНЕВ ПУСТОТЫ', hud:'РАЗЛОМЫ ПУСТОТЫ', nt:'создаёт 3–5 разломов: через секунду они отнимают 40% максимального здоровья и замедляют', weight:30, spd:66, col:'#8e45e8'},
  minotaur:{nm:'УЖАСАЮЩИЙ МИНОТАВР', hud:'НАТИСК → КОПЬЯ', nt:'редкий босс: рывок со скоростью 2800, затем уязвим и неподвижен 1,2 секунды, после чего бросает три копья по 15% max HP; новый рывок через 1,5 секунды; броня 80%; гарантирует две находки', weight:10, spd:64, col:'#a95b32', rare:true},
  seraph:{nm:'ПАДШИЙ СЕРАФИМ', hud:'СВЯТОЕ КОПЬЁ', nt:'трижды подряд отмечает игрока и поражает Святым Копьём на 20% максимального здоровья', weight:30, spd:70, col:'#b83236'},
  matriarch:{nm:'ЧУМНАЯ МАТРИАРХ', hud:'РОЙ БЕГУНОВ', nt:'каждую секунду выплёвывает двух Бегунов, пока их меньше 36', weight:30, spd:60, col:'#819b31'},
  demonqueen:{nm:'ДЕМОНИЧЕСКАЯ КОРОЛЕВА', hud:'ДЕМОНИЧЕСКИЙ СГУСТОК', nt:'оборачивается Демоническим сгустком, отмечает место и через секунду обрушивается, нанося 35% максимального здоровья и замедляя', weight:30, spd:74, col:'#b1326f'},
  funeral_bell_colossus:{nm:'КОЛОСС ПОГРЕБАЛЬНОГО КОЛОКОЛА',hud:'ПОМИНАЛЬНЫЙ ЗВОН',nt:'замирает и выпускает три волны по 8% max HP; третья замедляет на 70% на 2,5 секунды',weight:30,spd:62,col:'#39d9d2'},
  star_devourer:{nm:'ПОЖИРАТЕЛЬ СОЗВЕЗДИЙ',hud:'ГАСНУЩЕЕ НЕБО',nt:'отмечает точку и роняет метеор на 18% max HP с горением 5% в секунду на 3 секунды',weight:30,spd:68,col:'#8b5cff'},
  plague_archimandrite:{nm:'ЧУМНОЙ АРХИМАНДРИТ',hud:'КАДИЛЬНИЦА МОРА',nt:'широкий круг наносит 12% max HP и отравляет на 3% в секунду на 4 секунды',weight:30,spd:64,col:'#a8c83e'},
  crimson_seamstress:{nm:'БАГРОВАЯ ПОРТНИХА',hud:'ШОВ ПЛОТИ',nt:'прошивает арену крестом на 15% max HP и замедляет на 35% на 2 секунды',weight:30,spd:76,col:'#d6484f'},
  glass_titan:{nm:'СТЕКЛЯННЫЙ ТИТАН',hud:'ОСКОЛОЧНЫЙ ПРИГОВОР',nt:'взрыв вокруг босса на 16% max HP и восемь осколков по 6%',weight:30,spd:58,col:'#a9e8f2'},
  rust_king:{nm:'КОРОЛЬ РЖАВЧИНЫ',hud:'ОКИСЛИТЕЛЬНЫЙ ПРИЛИВ',nt:'конус на 10% max HP замедляет и накладывает коррозию 2% в секунду на 3 секунды',weight:30,spd:67,col:'#b96d32'},
  mother_empty_masks:{nm:'МАТЕРЬ ПУСТЫХ МАСОК',hud:'ХОР ЛИЦ',nt:'три маски последовательно проводят лучи по 10% max HP',weight:30,spd:70,col:'#d85a67'},
  ice_psalmist:{nm:'ЛЕДЯНОЙ ПСАЛМОПЕВЕЦ',hud:'НЕМАЯ ЛИТУРГИЯ',nt:'последовательно замораживает три широких сектора по 12% max HP',weight:30,spd:65,col:'#7fcfff'},
  heart_collector:{nm:'СОБИРАТЕЛЬ СЕРДЕЦ',hud:'ЧУЖОЙ ПУЛЬС',nt:'три кольца вокруг отмеченной точки срабатывают в порядке внутреннее, внешнее, среднее по 12%',weight:30,spd:73,col:'#b62e43'},
  ink_leviathan:{nm:'ЧЕРНИЛЬНЫЙ ЛЕВИАФАН',hud:'РАЗЛИВ БЕЗДНЫ',nt:'создаёт пять чернильных луж: 11% при контакте, затем 6% в секунду и замедление',weight:30,spd:60,col:'#6452a8'},
  judge_of_chains:{nm:'СУДЬЯ ЦЕПЕЙ',hud:'ПРИГОВОР ПРИТЯЖЕНИЯ',nt:'дальняя цепь наносит 9% max HP и мощно притягивает, затем молот бьёт на 14%',weight:30,spd:64,col:'#b9a285'},
  ashen_seraph:{nm:'ПЕПЕЛЬНЫЙ СЕРАФИМ',hud:'ШЕСТЬ УГЛЕЙ',nt:'выпускает шесть огненных комет по 7% max HP с горением',weight:30,spd:72,col:'#d66b35'},
  bone_astrolabe:{nm:'КОСТЯНОЙ АСТРОЛЯБ',hud:'ОРБИТА МЁРТВЫХ',nt:'ближнее и дальнее кольца наносят по 14% max HP; дальнее сильно замедляет',weight:30,spd:63,col:'#b79a63'},
  copper_oracle:{nm:'МЕДНЫЙ ОРАКУЛ',hud:'ПЕРЕМОТКА УДАРА',nt:'пять последовательных взрывов вдоль отмеченной линии наносят по 6% max HP',weight:30,spd:69,col:'#d5903e'},
  prince_hungry_ravens:{nm:'КНЯЗЬ ГОЛОДНЫХ ВОРОН',hud:'ЧЁРНАЯ ЖАТВА',nt:'широкий вылет ворон наносит 10% max HP и кровотечение; возвратный строй — 14%',weight:30,spd:77,col:'#536a8d'},
  lunar_butcher:{nm:'ЛУННЫЙ МЯСНИК',hud:'ПОЛУМЕСЯЦ БОЙНИ',nt:'дальний серп наносит 13% max HP, следом ближний — 15%',weight:30,spd:70,col:'#b8a99d'},
  keeper_last_candle:{nm:'ХРАНИТЕЛЬ ПОСЛЕДНЕЙ СВЕЧИ',hud:'ПОГАСШИЙ СВЕТ',nt:'четыре секунды безопасно только внутри движущегося круга света',weight:30,spd:58,col:'#f2b642'},
  sand_gravedigger:{nm:'ПЕСОЧНЫЙ ГРОБОВЩИК',hud:'ПЕСОЧНАЯ МОГИЛА',nt:'полоса наносит 16% max HP и остаётся на 4 секунды, замедляя и истощая',weight:30,spd:65,col:'#c9a56b'},
  bottomless_mnema:{nm:'БЕЗДОННАЯ МНЕМА',hud:'УКРАДЕННАЯ ТЕНЬ',nt:'теневая копия пронзает отмеченную линию на 14% max HP и оставляет тёмное горение',weight:30,spd:74,col:'#7653a8'},
  empress_iron_roses:{nm:'ИМПЕРАТРИЦА ЖЕЛЕЗНЫХ РОЗ',hud:'ЦВЕТЕНИЕ ШИПОВ',nt:'три расширяющихся кольца по 9% max HP; третье вызывает кровотечение',weight:30,spd:71,col:'#b43c4d'},
};
const BOSS_KEYS = Object.keys(BOSS_TYPES);
function rollBossType(exclude=[]){
  const pool = BOSS_KEYS.filter(k => !exclude.includes(k));
  const available = pool.length ? pool : BOSS_KEYS;
  let roll = Math.random() * available.reduce((sum,k) => sum + BOSS_TYPES[k].weight, 0);
  for (const key of available){
    roll -= BOSS_TYPES[key].weight;
    if (roll < 0) return key;
  }
  return available[available.length-1];
}
function bossType(e){ return BOSS_TYPES[e && e.bossId] || null; }

/* ---------- 5b. АФФИКСЫ МИНИ-БОССОВ ----------
   Мини-босс появляется каждый пятый этаж. Сам по себе он просто крупный враг
   с большим запасом здоровья — драки не получается, потому что решение у игрока
   ровно одно: где стоять. Аффиксы существуют затем, чтобы менять ответ именно
   на этот вопрос, а не добавлять боссу цифр.

   Формат записи:
     id    — ключ, по нему же хранится таймер в e.affT
     nm    — короткая метка для имени и подписи под здоровьем
     col   — цвет ауры и телеграфа
     nt    — что делает, человеческим языком (уходит в тост)
     init  — разовая правка врага при появлении
     tick  — поведение в кадре; вернуть true, если аффикс забрал себе движение
*/
const BOSS_WAVE_DAMAGE_MULT = 0.50;
const BOSS_AFFIXES = [

  { id:'bulwark', nm:'панцирь', col:'#9aa7b4',
    nt:'мелкие частые удары почти не проходят, крупные — проходят',
    init(e){
      // Панцирь считается не как обычная броня (та режет фиксированный процент
      // независимо от размера удара), а по размеру самого удара: чем мельче
      // удар, тем большая его доля съедается. Это единственный способ сделать
      // аффикс, который душит лук и свиту, но не трогает воина с жезлом.
      e.bulwark = 9 * hpScale(G.floor);   // 16 давало x3.1 некроманту при x1.0 жезлу — слишком жёсткая контра
      e.maxHp = e.hp = Math.round(e.maxHp * 0.85);  // цена за панцирь; 0.7 делал босса слабее обычного для жезла
    } },

  { id:'ward', nm:'оберег', col:'#c08cff',
    nt:'одна стихия срезается на 60% — цвет ауры выдаёт какая',
    init(e){
      e.ward = pick(['fire','cold','lit','poi']);
      e.wardCol = {fire:'#ff7a2f', cold:'#7fd6ff', lit:'#ffe14a', poi:'#8be04e'}[e.ward];
      e.affNm = e.affNm;                            // имя соберётся ниже, тут только данные
    } },

  { id:'volley', nm:'залп', col:'#d95ec2',
    nt:'раз в 3 сек веер снарядов по кругу — бегать надо по дуге, не по прямой',
    tick(e, dt, tgt, edmg){
      const T = e.affT;
      T.volley = (T.volley === undefined ? 2.0 : T.volley) - dt;
      if (T.volley > 0) return false;
      T.volley = 3.2;
      // Два узора по очереди. Кольцо наказывает тех, кто стоит вплотную, но по
      // убегающему почти не попадает — между лучами на дистанции огромные щели.
      // Поэтому через раз идёт прицельный веер: от него уходят вбок, а не назад.
      T.vAlt = !T.vAlt;
      const shot = (a, sp) => G.eshots.push({x:e.x, y:e.y,
        vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:7, life:2.4, dmg:edmg*0.55,
        sourceKind:e.kind,cause:enemyCause(e,'залп'),owner:e});
      if (T.vAlt){
        const a0 = rnd(0, Math.PI*2);
        for (let i = 0; i < 10; i++) shot(a0 + i*Math.PI/5, 330);
      } else {
        const aim = Math.atan2(tgt.y-e.y, tgt.x-e.x);
        for (let i = -2; i <= 2; i++) shot(aim + i*0.19, 380);   // плотный веер по цели
      }
      G.fx.push({t:'ring', x:e.x, y:e.y, r:e.r, max:e.r+34, life:0.25, col:'#d95ec2'});
      return false;
    } },

  { id:'wave', nm:'волна', col:'#ff9a4a',
    nt:'раз в 5 сек расходится кольцо — безопасно только вплотную или далеко',
    tick(e, dt, tgt, edmg){
      const T = e.affT;
      T.wave = (T.wave === undefined ? 3.0 : T.wave) - dt;
      if (T.wave > 0) return false;
      T.wave = 5.0;
      // Кольцо живёт своей жизнью: бьёт один раз, когда фронт накрывает игрока
      // Скорость обязана быть ниже скорости бега игрока (235), иначе убежать
      // нельзя в принципе и весь выбор «нырнуть внутрь или уйти за край» исчезает.
      G.fx.push({t:'wave', x:e.x, y:e.y, r:e.r, spd:200, life:2.6,
                 dmg:edmg*BOSS_WAVE_DAMAGE_MULT, hit:false, col:'#ff9a4a'});
      return false;
    } },

  { id:'tar', nm:'смола', col:'#c08a3a',
    nt:'оставляет за собой лужи — стоять на месте нельзя',
    tick(e, dt, tgt, edmg){
      const T = e.affT;
      T.tar = (T.tar === undefined ? 0.8 : T.tar) - dt;
      if (T.tar > 0) return false;
      T.tar = 1.6;   // 1.1 держало на площадке три лужи внахлёст: выйти из одной значило войти в другую
      if (G.pools.length > 40) G.pools.shift();     // потолок, чтобы кадр не проседал
      // Лужа ложится не под ноги, а с упреждением по курсу цели. Под ноги —
      // это не выбор, а неизбежный урон: уйти из круга, возникшего точно на тебе,
      // нельзя. С упреждением решение появляется: держишь курс — вбежишь сам,
      // свернул — промазал, стоишь на месте — накроет ровно по замыслу аффикса.
      const lead = 150;
      const fx0 = (tgt === G.player) ? (G.player.moving ? G.player.faceX : 0) : 0;
      const fy0 = (tgt === G.player) ? (G.player.moving ? G.player.faceY : 0) : 0;
      const px = clamp(tgt.x + fx0*lead, -ARENA+40, ARENA-40);
      const py = clamp(tgt.y + fy0*lead, -ARENA+40, ARENA-40);
      G.pools.push({x:px, y:py, r:46, life:3.0, max:3.0, arm:0.55, dmg:edmg*0.40, sourceKind:e.kind});
      pushTimedTelegraph({shape:'circle',kind:'damage',x:px,y:py,r:46},0.55);
      return false;
    } },

  { id:'charge', nm:'таран', col:'#ff5a4e',
    nt:'раз в 3 сек: замах 0.7 сек, затем рывок по прямой с отбрасыванием',
    tick(e, dt, tgt, edmg){
      const T = e.affT;
      if (T.dash > 0){                              // фаза рывка: летит по прямой
        T.dash -= dt;
        e.x = clamp(e.x + Math.cos(T.ca)*640*dt, -ARENA+40, ARENA-40);
        e.y = clamp(e.y + Math.sin(T.ca)*640*dt, -ARENA+40, ARENA-40);
        if (Math.random() < 0.6) burst(e.x, e.y, 2, '#ff5a4e', 90, 3, 0.3);
        const p = G.player;
        if (!T.hitDone && dist(e, p) < e.r + p.r + 8){
          T.hitDone = true;
          hurt(edmg*1.4, false, false, enemyCause(e, 'таран'), e.kind, e);
          const a = Math.atan2(p.y-e.y, p.x-e.x);   // сносит игрока с траектории
          p.x = clamp(p.x + Math.cos(a)*70, -ARENA, ARENA);
          p.y = clamp(p.y + Math.sin(a)*70, -ARENA, ARENA);
        }
        return true;
      }
      if (T.warn > 0){                              // фаза замаха: стоит и целится
        T.warn -= dt;
        T.ca = Math.atan2(tgt.y-e.y, tgt.x-e.x);    // доворачивается до конца замаха
        if (T.warn <= 0){
          T.dash = 0.8; T.hitDone = false;          // 0.5 сек не хватало добежать до кайтящего
          pushTelegraphTrace({shape:'corridor',kind:'damage',x:e.x,y:e.y,
            x2:e.x+Math.cos(T.ca)*430,y2:e.y+Math.sin(T.ca)*430,width:e.r*2+12});
        }
        return true;
      }
      T.chg = (T.chg === undefined ? 2.0 : T.chg) - dt;   // первый рывок тоже раньше
      // Не замахиваемся впустую по цели, до которой не дотянемся
      if (T.chg <= 0 && dist(e, tgt) < 540){ T.chg = 3.0; T.warn = 0.7; T.ca = Math.atan2(tgt.y-e.y, tgt.x-e.x); return true; }   // было 6.0
      if (T.chg <= 0) T.chg = 1.0;                          // цель далеко — пробуем снова через секунду
      return false;
    } },

  { id:'summon', nm:'зов', col:'#8be04e',
    nt:'раз в 6 сек поднимает свежих врагов вокруг себя',
    tick(e, dt, tgt, edmg){
      const T = e.affT;
      T.sum = (T.sum === undefined ? 4.0 : T.sum) - dt;
      if (T.sum > 0) return false;
      T.sum = 6.0;
      if (G.enemies.length > 30) return false;      // не заваливаем экран
      for (let i = 0; i < 3; i++){
        spawnEnemy();                               // добавляется в конец — обратный цикл его не заденет
        const n = G.enemies[G.enemies.length-1];
        const a = rnd(0, Math.PI*2);
        n.x = clamp(e.x + Math.cos(a)*rnd(50,90), -ARENA+40, ARENA-40);
        n.y = clamp(e.y + Math.sin(a)*rnd(50,90), -ARENA+40, ARENA-40);
        G.fx.push({t:'ring', x:n.x, y:n.y, r:4, max:34, life:0.3, col:'#8be04e'});
      }
      return false;
    } },

  { id:'banner', nm:'знамя', col:'#ffd24a',
    nt:'пока жив, вся комната на 30% быстрее и на 20% злее',
    /* Сам по себе ничего не делает — эффект читается один раз за кадр
       через G.banner в цикле врагов. Иначе пришлось бы искать босса на каждом. */
  },
];

/* Один источник истины для бесконечной прогрессии боссовых этажей.
   X3/X6/X9 добавляют 1/2/3 боссов к обычной комнате, X0 создаёт ровно четыре
   босса и запрещает только системные волны. Призывы самих боссов и аффиксов
   остаются частью их механики. */
const MAX_BOSS_AFFIXES = 8;
function bossFloorPlan(floor){
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const digit = f % 10;
  const count = digit === 3 ? 1 : digit === 6 ? 2 : digit === 9 ? 3 : digit === 0 ? 4 : 0;
  if (!count) return {floor:f,isBossFloor:false,bossCount:0,affixCount:0,suppressRegularEnemies:false};
  const decade = Math.floor(f / 10);
  const major = digit === 0;
  // На X0 после 20-го этажа есть намеренный скачок: 30→4, 40→5 ... 70→8.
  const rawAffixes = major ? (decade >= 3 ? decade + 1 : decade) : decade + 1;
  return {floor:f,isBossFloor:true,bossCount:count,
    affixCount:Math.min(MAX_BOSS_AFFIXES,BOSS_AFFIXES.length,rawAffixes),
    suppressRegularEnemies:major};
}
function currentBossFloorPlan(){
  if (G && G.bossFloorPlan && G.bossFloorPlan.floor === G.floor) return G.bossFloorPlan;
  return bossFloorPlan(G ? G.floor : 1);
}
function regularEnemySpawnsSuppressed(){ return !!(G&&G.devZone)||currentBossFloorPlan().suppressRegularEnemies; }
function floorCombatComplete(){
  if (G&&G.devZone) return false;                         // DEV_ZONE никогда не создаёт портал сама
  const plan=currentBossFloorPlan();
  if (G.spawnQueue !== 0) return false;
  if (!plan.suppressRegularEnemies) return G.enemies.length === 0;
  // На X0 портал зависит от четырёх боссов. Их призванные миньоны разрешены,
  // но не превращаются в обязательную уборку после завершённой битвы.
  for (let i=0;i<G.enemies.length;i++)
    if (G.enemies[i].kind === 'boss' && !G.enemies[i].dead) return false;
  return true;
}
function affixCount(f){ return bossFloorPlan(f).affixCount; }
function bossCount(f){ return bossFloorPlan(f).bossCount; }

function applyAffixes(e, f, requestedCount){
  const pool = BOSS_AFFIXES.slice();
  // Прямой debug-спавн на обычном этаже по-прежнему получает хотя бы один
  // аффикс; buildFloor всегда передаёт точное значение из bossFloorPlan().
  const planned = requestedCount === undefined ? Math.max(1,affixCount(f)) : requestedCount;
  const n = Math.min(MAX_BOSS_AFFIXES,Math.max(0,planned),pool.length);
  for (let i = 0; i < n; i++){
    const a = pool.splice(Math.floor(Math.random()*pool.length), 1)[0];
    e.aff.push(a);
    if (a.init) a.init(e);
  }
  // Имя собирается из меток, а не из прилагательных: «оберег огня» согласовать
  // с «Глыбой» по роду невозможно, а список меток читается одинаково для всех.
  const EL = {fire:'огня', cold:'льда', lit:'молний', poi:'яда'};
  e.affNm = e.aff.map(a => a.id === 'ward' ? 'оберег ' + EL[e.ward] : a.nm).join(' · ');
}

/* Уникальные умения идут поверх случайных аффиксов. Процент задаёт базовый
   урон от максимального HP, но hurt() всё ещё пропускает его через обычную
   защиту, уклонение, блок и щиты — защитные билды не обесцениваются. */
function fireBossProjectile(e, {speed, radius, pct, life, shotType, col, cause}){
  const p = G.player, a = Math.atan2(p.y-e.y, p.x-e.x);
  G.eshots.push({x:e.x, y:e.y, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed,
    r:radius, life, maxHpPct:pct, sourceKind:'boss', shotType, col,
    cause:enemyCause(e, cause), owner:e});
}

function summonGreedRunner(e){
  let alive = 0;
  for (const x of G.enemies) if (x.summonedByGreed && !x.dead) alive++;
  if (alive >= 24 || G.enemies.length >= 500) return null;
  const n = spawnEnemy('runner');
  const a = rnd(0, Math.PI*2), d = e.r + 28;
  n.x = clamp(e.x + Math.cos(a)*d, -ARENA+40, ARENA-40);
  n.y = clamp(e.y + Math.sin(a)*d, -ARENA+40, ARENA-40);
  n.summonedByGreed = true; n.noLoot = true; n.xp = 0;
  G.fx.push({t:'ring', x:n.x, y:n.y, r:4, max:30, life:0.3, col:'#e6a52d'});
  return n;
}

function summonGraveCore(e){
  let alive = 0;
  for (const x of G.enemies) if (x.summonedByGrave && !x.dead) alive++;
  if (alive >= 36 || G.enemies.length >= 500) return null;
  const n = spawnEnemy('blob');
  const a = rnd(0, Math.PI*2), d = e.r + n.r + 10;
  n.x = clamp(e.x + Math.cos(a)*d, -ARENA+40, ARENA-40);
  n.y = clamp(e.y + Math.sin(a)*d, -ARENA+40, ARENA-40);
  n.summonedByGrave = true;                         // обычный враг: сохраняет опыт, золото и находки
  G.fx.push({t:'ring', x:n.x, y:n.y, r:4, max:30, life:0.3, col:'#8166b8'});
  return n;
}

function summonMatriarchRunner(e){
  let alive = 0;
  for (const x of G.enemies) if (x.summonedByMatriarch && !x.dead) alive++;
  if (alive >= 36 || G.enemies.length >= 500) return null;
  const n = spawnEnemy('runner');
  const a = rnd(0, Math.PI*2), d = e.r + n.r + 10;
  n.x = clamp(e.x + Math.cos(a)*d, -ARENA+40, ARENA-40);
  n.y = clamp(e.y + Math.sin(a)*d, -ARENA+40, ARENA-40);
  n.summonedByMatriarch = true; n.noLoot = true; n.xp = 0;
  G.fx.push({t:'matriarchPlagueProjectile',x:e.x,y:e.y,x2:n.x,y2:n.y,life:0.32,max:0.32});
  G.fx.push({t:'ring', x:n.x, y:n.y, r:4, max:30, life:0.3, col:'#819b31'});
  return n;
}

function applyBossSlow(mult, duration){
  const p=G.player;
  if (!(p.bossSlowT > 0) || mult < (p.bossSlowMul || 1)) p.bossSlowMul=mult;
  p.bossSlowT=Math.max(p.bossSlowT||0,duration);
  G.fx.push({t:'txt',x:p.x,y:p.y-28,s:'ЗАМЕДЛЕН',life:0.8,col:'#8e78d8'});
}

function minotaurEdgeDistance(e, a){
  const dx=Math.cos(a), dy=Math.sin(a), edge=ARENA-e.r;
  let d=Infinity;
  if (dx > 0.0001) d=Math.min(d,(edge-e.x)/dx);
  else if (dx < -0.0001) d=Math.min(d,(-edge-e.x)/dx);
  if (dy > 0.0001) d=Math.min(d,(edge-e.y)/dy);
  else if (dy < -0.0001) d=Math.min(d,(-edge-e.y)/dy);
  return Math.max(0,d);
}

function fireMinotaurSpears(e){
  const p=G.player, a=Math.atan2(p.y-e.y,p.x-e.x);
  e.bossT.faceA=a;
  for (const da of [-0.22,0,0.22]){
    const q=a+da;
    G.eshots.push({x:e.x,y:e.y,vx:Math.cos(q)*380,vy:Math.sin(q)*380,
      r:20,life:2.2,maxHpPct:BOSS_MINOTAUR_SPEAR_DAMAGE,sourceKind:'boss',shotType:'minotaurSpear',col:'#b86b37',
      cause:enemyCause(e,'копьё Минотавра'),owner:e});
  }
  G.fx.push({t:'arc',x:e.x,y:e.y,r:105,a,arc:1.15,life:0.25,col:'#b86b37'});
}

function applyTyrantBurn(cause){
  const p = G.player, fresh = !(p.bossBurnT > 0);
  p.bossBurnT = 3;
  p.bossBurnCause = cause || 'ГОРЕНИЕ РОГАТОГО ТИРАНА';
  if (fresh) p.bossBurnTick = 1;
  G.fx.push({t:'txt', x:p.x, y:p.y-28, s:'ГОРИТ', life:0.65, col:'#ff5a28'});
}

function leaveTyrantFire(e){
  if (G.bossTrails.length >= 48) G.bossTrails.shift();
  G.bossTrails.push({x:e.x, y:e.y, r:34, life:3.4, max:3.4});
}

function throwExecutionerAxe(e){
  const p = G.player, dx=p.x-e.x, dy=p.y-e.y, d=Math.max(1,Math.hypot(dx,dy)), speed=360;
  G.eshots.push({x:e.x, y:e.y, vx:dx/d*speed, vy:dy/d*speed,
    r:30, life:12, maxHpPct:0.35, sourceKind:'boss', shotType:'axe', col:'#b74735',
    cause:enemyCause(e, 'вращающийся топор'), owner:e, targetX:p.x, targetY:p.y,
    outLeft:d, axeSpeed:speed, returning:false, spin:0, hitDone:false});
  pushTimedTelegraph({shape:'target',kind:'damage',x:p.x,y:p.y,r:34},0.55);
}

function dropPlagueBossAcid(e){
  if (G.bossPools.length >= 8) G.bossPools.shift();
  G.bossPools.push({x:e.x, y:e.y, r:135, life:10, max:10, tick:1, maxHpPct:0.10});
  G.fx.push({t:'ring', x:e.x, y:e.y, r:12, max:135, life:0.65, col:'#9ddc38'});
}

/* Двадцать новых боссов используют один событийный каркас. В нём отдельно
   хранятся предупреждения и моменты удара: FPS не меняет ни порядок фаз, ни
   число проверок урона, а каждый удар по-прежнему проходит через hurt(). */
const BOSS20_KEYS=new Set([
  'funeral_bell_colossus','star_devourer','plague_archimandrite','crimson_seamstress','glass_titan',
  'rust_king','mother_empty_masks','ice_psalmist','heart_collector','ink_leviathan','judge_of_chains',
  'ashen_seraph','bone_astrolabe','copper_oracle','prince_hungry_ravens','lunar_butcher',
  'keeper_last_candle','sand_gravedigger','bottomless_mnema','empress_iron_roses'
]);
const boss20Circle=(x,y,r)=>({shape:'circle',x,y,r});
const boss20Ring=(x,y,r,width=42)=>({shape:'ring',x,y,r,width});
const boss20Corridor=(x,y,x2,y2,width=46)=>({shape:'corridor',x,y,x2,y2,width});
const boss20Cone=(x,y,r,a,arc)=>({shape:'cone',x,y,r,a,arc});
const boss20Arc=(x,y,r,width,a,arc)=>({shape:'arc',x,y,r,width,a,arc});
const JUDGE_CHAIN_RANGE_MULT=3;
const JUDGE_CHAIN_WINDUP=0.56;           // прежние 0,70 сек × 0,8: применение на 20% быстрее
const JUDGE_CHAIN_PULL_FORCE=3120;       // усиленные 1040 × 3, суммарно 260 × 12
const JUDGE_CHAIN_COOLDOWN_MULT=0.5;     // способность применяется вдвое чаще
const BOSS20_STANDARD_COOLDOWN_MULT=0.7; // остальные 19 новых боссов применяют навыки на 30% чаще
function boss20AngleDelta(a,b){ return Math.atan2(Math.sin(a-b),Math.cos(a-b)); }
function boss20ShapeHits(spec,p=G.player){
  if (!spec || !p) return false;
  if (spec.shape==='circle' || spec.shape==='target') return Math.hypot(p.x-spec.x,p.y-spec.y)<=spec.r+p.r;
  if (spec.shape==='ring'){
    const d=Math.hypot(p.x-spec.x,p.y-spec.y),half=(spec.width||42)/2+p.r;
    return Math.abs(d-spec.r)<=half;
  }
  if (spec.shape==='corridor'){
    const dx=spec.x2-spec.x,dy=spec.y2-spec.y,l2=dx*dx+dy*dy||1;
    const u=clamp(((p.x-spec.x)*dx+(p.y-spec.y)*dy)/l2,0,1);
    return Math.hypot(p.x-(spec.x+dx*u),p.y-(spec.y+dy*u))<=(spec.width||46)/2+p.r;
  }
  const dx=p.x-spec.x,dy=p.y-spec.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
  if (spec.shape==='cone') return d<=spec.r+p.r && Math.abs(boss20AngleDelta(a,spec.a||0))<=(spec.arc||Math.PI/2)/2;
  if (spec.shape==='arc') return Math.abs(d-spec.r)<=(spec.width||42)/2+p.r && Math.abs(boss20AngleDelta(a,spec.a||0))<=(spec.arc||Math.PI/2)/2;
  return false;
}
function applyBoss20Dot(key,pctPerSecond,duration,cause,col){
  const dots=G.player.bossDots||(G.player.bossDots={}),old=dots[key];
  dots[key]={pct:pctPerSecond,duration,life:Math.max(duration,old?old.life:0),tick:1,cause,col};
  G.fx.push({t:'txt',x:G.player.x,y:G.player.y-32,s:key==='poison'?'ОТРАВЛЕН':key==='bleed'?'КРОВОТЕЧЕНИЕ':key==='corrosion'?'КОРРОЗИЯ':'ГОРИТ',life:0.75,col});
}
function tickBoss20Dots(dt){
  const dots=G.player.bossDots||{};
  for (const [key,dot] of Object.entries(dots)){
    const was=dot.life;dot.life=Math.max(0,dot.life-dt);dot.tick-=dt;
    while(dot.tick<=0 && was>0){
      dot.tick+=1;hurt(D.life*dot.pct,false,false,dot.cause,'boss');
      if(G.over) break;
    }
    if(dot.life<=0) delete dots[key];
  }
}
function boss20Damage(e,event){
  if (event.spec && !boss20ShapeHits(event.spec)) return false;
  hurt(D.life*event.pct,false,false,enemyCause(e,event.cause),'boss',e);
  if (event.slow) applyBossSlow(event.slow.mult,event.slow.duration);
  if (event.dot) applyBoss20Dot(event.dot.key,event.dot.pct,event.dot.duration,enemyCause(e,event.cause+' · '+event.dot.label),event.dot.col);
  return true;
}
function boss20Shot(e,a,pct,cause,col,extra={}){
  const speed=extra.speed||360;
  const effectKey=e.bossId==='glass_titan'?'glass_shard':e.bossId==='ashen_seraph'?'ashen_comet':null;
  const impactEffectKey=e.bossId==='ashen_seraph'?'ashen_comet_impact':null;
  G.eshots.push(Object.assign({x:e.x,y:e.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:extra.r||9,
    life:extra.life||3,maxHpPct:pct,sourceKind:'boss',shotType:extra.shotType||'boss20',col,
    cause:enemyCause(e,cause),owner:e,effectKey,impactEffectKey},extra));
}
function spawnBoss20Hazard(e,kind,spec,duration,options={}){
  if (G.bossHazards.length>=40) G.bossHazards.shift();
  const effectKey=e.bossId==='ink_leviathan'?'ink_pool':
    e.bossId==='keeper_last_candle'?'candle_safe_halo':
    e.bossId==='sand_gravedigger'?'sand_ground_strip':null;
  G.bossHazards.push(Object.assign({kind,spec:Object.assign({},spec),life:duration,max:duration,tick:0.5,
    owner:e,cause:enemyCause(e,options.cause||'опасная зона'),col:options.col||bossType(e).col,entered:false,effectKey},options));
}
function boss20Telegraph(from,to,spec,kind='damage'){ return {from,to,spec:Object.assign({},spec),kind}; }
function boss20Event(at,type,options={}){ return Object.assign({at,type,fired:false},options); }
function buildBoss20Sequence(e){
  const p=G.player,x=e.x,y=e.y,px=p.x,py=p.y,a=Math.atan2(py-y,px-x),def=bossType(e);
  const S={t:0,duration:1,lock:true,telegraphs:[],events:[],col:def.col};
  const hit=(at,spec,pct,cause,extra={})=>S.events.push(boss20Event(at,'hit',Object.assign({spec,pct,cause},extra)));
  const warn=(from,to,spec,kind='damage')=>S.telegraphs.push(boss20Telegraph(from,to,spec,kind));
  if(e.bossId==='funeral_bell_colossus'){
    S.duration=2.12;[130,220,320].forEach((r,i)=>{const at=.9+i*.55,spec=boss20Ring(x,y,r,36);warn(Math.max(0,at-.55),at,spec,i===2?'control':'damage');hit(at,spec,.08,'поминальная волна',i===2?{slow:{mult:.30,duration:2.5}}:{});});
  } else if(e.bossId==='star_devourer'){
    S.duration=1.15;const spec=boss20Circle(clamp(px,-ARENA+100,ARENA-100),clamp(py,-ARENA+100,ARENA-100),100);warn(0,1,spec);hit(1,spec,.18,'метеор Гаснущего неба',{dot:{key:'fire',pct:.05,duration:3,label:'горение',col:'#ff743c'}});
  } else if(e.bossId==='plague_archimandrite'){
    S.duration=.95;const spec=boss20Circle(x,y,220);warn(0,.8,spec);hit(.8,spec,.12,'Кадильница мора',{dot:{key:'poison',pct:.03,duration:4,label:'яд',col:'#9ecb43'}});
  } else if(e.bossId==='crimson_seamstress'){
    S.duration=1.05;const aa=a+Math.PI/4,L=700,s1=boss20Corridor(px-Math.cos(aa)*L,py-Math.sin(aa)*L,px+Math.cos(aa)*L,py+Math.sin(aa)*L,48),bb=aa+Math.PI/2,s2=boss20Corridor(px-Math.cos(bb)*L,py-Math.sin(bb)*L,px+Math.cos(bb)*L,py+Math.sin(bb)*L,48);warn(0,.9,s1);warn(0,.9,s2);S.events.push(boss20Event(.9,'multiHit',{specs:[s1,s2],pct:.15,cause:'Шов плоти',slow:{mult:.65,duration:2}}));
  } else if(e.bossId==='glass_titan'){
    S.duration=1.18;const blast=boss20Circle(x,y,190);warn(0,1,blast);hit(1,blast,.16,'Осколочный приговор');for(let i=0;i<8;i++){const q=i*Math.PI/4+.18,c=boss20Corridor(x,y,x+Math.cos(q)*620,y+Math.sin(q)*620,28);warn(0,1,c);S.events.push(boss20Event(1,'shot',{a:q,pct:.06,cause:'стеклянный осколок',col:'#b9f3ff',extra:{speed:430,r:7,life:2.2}}));}
  } else if(e.bossId==='rust_king'){
    S.duration=1;const spec=boss20Cone(x,y,300,a,1.12);warn(0,.85,spec,'control');hit(.85,spec,.10,'Окислительный прилив',{slow:{mult:.70,duration:2},dot:{key:'corrosion',pct:.02,duration:3,label:'коррозия',col:'#bd7033'}});
  } else if(e.bossId==='mother_empty_masks'){
    S.duration=1.58;[-.30,0,.30].forEach((da,i)=>{const at=.65+i*.4,q=a+da,spec=boss20Corridor(x,y,x+Math.cos(q)*900,y+Math.sin(q)*900,44);warn(i*.4,at,spec);hit(at,spec,.10,'луч пустой маски');});
  } else if(e.bossId==='ice_psalmist'){
    S.duration=2.55;for(let i=0;i<3;i++){const at=.8+i*.82,spec=boss20Cone(0,0,ARENA*2.2,a+i*Math.PI*2/3,1.18);warn(i*.82,at,spec,'control');hit(at,spec,.12,'Немая литургия',{slow:{mult:.60,duration:2}});}
  } else if(e.bossId==='heart_collector'){
    S.duration=2.05;[[80,.6],[240,1.3],[155,2]].forEach(([r,at],i)=>{const spec=boss20Ring(px,py,r,48);warn(at-.6,at,spec);hit(at,spec,.12,'Чужой пульс');});
  } else if(e.bossId==='ink_leviathan'){
    S.duration=.92;for(let i=0;i<5;i++){const q=a+(i-2)*.28,d=115+(i%2)*75,spec=boss20Circle(clamp(x+Math.cos(q)*d,-ARENA+55,ARENA-55),clamp(y+Math.sin(q)*d,-ARENA+55,ARENA-55),55);warn(0,.75,spec,'control');S.events.push(boss20Event(.75,'hazard',{kind:'pool',spec,duration:4,options:{firstPct:.11,tickPct:.03,slow:{mult:.70,duration:.65},cause:'Разлив бездны',col:'#4d3a78'}}));}
  } else if(e.bossId==='judge_of_chains'){
    S.duration=1.55;const chainX=x+(px-x)*JUDGE_CHAIN_RANGE_MULT,chainY=y+(py-y)*JUDGE_CHAIN_RANGE_MULT,line=boss20Corridor(x,y,chainX,chainY,38),hx=x+Math.cos(a)*125,hy=y+Math.sin(a)*125,hammer=boss20Circle(hx,hy,90);warn(0,JUDGE_CHAIN_WINDUP,line,'control');S.events.push(boss20Event(JUDGE_CHAIN_WINDUP,'pull',{spec:line,pct:.09,cause:'цепь приговора',x,y,pullForce:JUDGE_CHAIN_PULL_FORCE}));warn(JUDGE_CHAIN_WINDUP,1.4,hammer);hit(1.4,hammer,.14,'молот Судьи Цепей');
  } else if(e.bossId==='ashen_seraph'){
    S.duration=2.05;for(let pair=0;pair<3;pair++){const at=.55+pair*.65;for(const side of[-1,1]){const q=a+side*(.16+pair*.06),spec=boss20Corridor(x,y,x+Math.cos(q)*800,y+Math.sin(q)*800,30);warn(pair*.65,at,spec);S.events.push(boss20Event(at,'shot',{a:q,pct:.07,cause:'угольный комет',col:'#e26a31',extra:{speed:410,r:8,life:2.4,bossDot:{key:'fire',pct:.02,duration:3,label:'горение',col:'#ff743c'}}}));}}
  } else if(e.bossId==='bone_astrolabe'){
    S.duration=1.58;const near=boss20Ring(x,y,105,46),far=boss20Ring(x,y,235,50);warn(0,.8,near);hit(.8,near,.14,'ближняя мёртвая орбита');warn(.65,1.45,far,'control');hit(1.45,far,.14,'дальняя мёртвая орбита',{slow:{mult:.45,duration:1.5}});
  } else if(e.bossId==='copper_oracle'){
    S.duration=1.62;const line=boss20Corridor(x,y,px,py,34);warn(0,.9,line);for(let i=1;i<=5;i++){const u=i/5,spec=boss20Circle(x+(px-x)*u,y+(py-y)*u,44),at=.75+i*.15;warn(0,.9,spec);hit(at,spec,.06,'взрыв Перемотки удара');}
  } else if(e.bossId==='prince_hungry_ravens'){
    S.duration=1.7;const out=boss20Cone(x,y,360,a,1.25),endX=x+Math.cos(a)*360,endY=y+Math.sin(a)*360,back=boss20Corridor(endX,endY,x,y,50);warn(0,.85,out);hit(.85,out,.10,'Чёрная жатва',{dot:{key:'bleed',pct:.05,duration:3,label:'кровотечение',col:'#d9484f'}});warn(.85,1.55,back);hit(1.55,back,.14,'возвращение ворон');
  } else if(e.bossId==='lunar_butcher'){
    S.duration=1.65;const far=boss20Arc(x,y,220,70,a,1.65),near=boss20Arc(x,y,115,70,a,1.85);warn(0,.8,far);hit(.8,far,.13,'дальний полумесяц');warn(.7,1.5,near);hit(1.5,near,.15,'ближний полумесяц');
  } else if(e.bossId==='keeper_last_candle'){
    S.duration=5.15;const sx=clamp(px,-ARENA+90,ARENA-90),sy=clamp(py,-ARENA+90,ARENA-90),q=rnd(0,Math.PI*2),ex=clamp(sx+Math.cos(q)*220,-ARENA+90,ARENA-90),ey=clamp(sy+Math.sin(q)*220,-ARENA+90,ARENA-90),safe=boss20Circle(sx,sy,88);warn(0,1,safe,'warning');S.events.push(boss20Event(1,'hazard',{kind:'safe',spec:safe,duration:4,options:{endX:ex,endY:ey,tickPct:.015,slow:{mult:.75,duration:.65},cause:'Погасший свет',col:'#f2b642'}}));
  } else if(e.bossId==='sand_gravedigger'){
    S.duration=1.05;const spec=boss20Corridor(x,y,x+Math.cos(a)*520,y+Math.sin(a)*520,92);warn(0,.9,spec,'control');hit(.9,spec,.16,'Песочная могила');S.events.push(boss20Event(.9,'hazard',{kind:'strip',spec,duration:4,options:{tickPct:.0125,slow:{mult:.65,duration:.65},cause:'песчаная полоса',col:'#b99662'}}));
  } else if(e.bossId==='bottomless_mnema'){
    S.duration=1.38;const spec=boss20Corridor(x,y,px,py,68);warn(0,1,spec,'control');hit(1,spec,.14,'Украденная тень',{dot:{key:'dark',pct:.02,duration:4,label:'тёмное горение',col:'#8d62c4'}});S.clone={x,y,x2:px,y2:py,from:1,to:1.35};
  } else if(e.bossId==='empress_iron_roses'){
    S.duration=2.25;[100,180,260].forEach((r,i)=>{const at=.7+i*.7,spec=boss20Ring(x,y,r,44);warn(i*.7,at,spec,i===2?'control':'damage');hit(at,spec,.09,'Цветение шипов',i===2?{dot:{key:'bleed',pct:.05,duration:3,label:'кровотечение',col:'#d9484f'}}:{});});
  }
  return S;
}
function fireBoss20Event(e,event){
  event.fired=true;
  if(event.type==='hit') boss20Damage(e,event);
  else if(event.type==='multiHit'){
    if(event.specs.some(spec=>boss20ShapeHits(spec))) boss20Damage(e,Object.assign({},event,{spec:null}));
  } else if(event.type==='shot') boss20Shot(e,event.a,event.pct,event.cause,event.col,event.extra);
  else if(event.type==='hazard') spawnBoss20Hazard(e,event.kind,event.spec,event.duration,event.options);
  else if(event.type==='pull' && boss20ShapeHits(event.spec)){
    boss20Damage(e,event);const p=G.player,a=Math.atan2(event.y-p.y,event.x-p.x),force=event.pullForce||260;p.vx+=Math.cos(a)*force;p.vy+=Math.sin(a)*force;
  }
  spawnBoss20EventArt(e,event);
  if(event.spec) pushTelegraphTrace(Object.assign({kind:'damage'},event.spec));
}
function boss20SpecialCooldown(e,initial=false){
  const cooldown=initial ? 2.3+rnd(0,.7) : 5.5+rnd(-.35,.35);
  return cooldown*(e.bossId==='judge_of_chains'?JUDGE_CHAIN_COOLDOWN_MULT:BOSS20_STANDARD_COOLDOWN_MULT);
}
function tickBoss20Skill(e,dt){
  if(!BOSS20_KEYS.has(e.bossId)) return null;
  const T=e.bossT;
  if(T.special){
    const S=T.special;S.t=Math.min(S.duration,S.t+dt);
    for(const event of S.events) if(!event.fired && S.t+1e-9>=event.at) fireBoss20Event(e,event);
    if(S.t>=S.duration){T.special=null;T.specialCd=boss20SpecialCooldown(e);}
    return true;
  }
  T.specialCd=(T.specialCd===undefined?boss20SpecialCooldown(e,true):T.specialCd)-dt;
  if(T.specialCd<=0){T.special=buildBoss20Sequence(e);return true;}
  return false;
}

function startLegacyBossVisual(e,duration){
  if (!e || !e.bossT || !LEGACY_BOSS_KEYS.has(e.bossId)) return null;
  const max=Math.max(0.08,duration||0.4);
  return e.bossT.visualAction={life:max,max};
}
function pushLegacyBossEffect(key,x,y,size,life=0.42,extra=null){
  if (!LEGACY_BOSS_EFFECT_SPRITE_META[key]) return null;
  const effect=Object.assign({t:'legacyBossEffect',key,x,y,size,life,max:life,a:0,alpha:1},extra||{});
  G.fx.push(effect);return effect;
}
function pushBoss20SpriteEffect(key,x,y,size,life=0.58,extra=null){
  if (!BOSS20_EFFECT_SPRITE_META[key]) return null;
  const effect=Object.assign({t:'boss20SpriteEffect',key,x,y,size,sizeX:size,sizeY:size,life,max:life,a:0,alpha:1},extra||{});
  G.fx.push(effect);return effect;
}
function spawnBoss20ProjectileImpact(s){
  if (s && s.impactEffectKey)
    pushBoss20SpriteEffect(s.impactEffectKey,s.x,s.y,112,.52,{a:Math.atan2(s.vy,s.vx)});
}
function boss20EffectPlacement(spec,e){
  if (!spec) return {x:e.x,y:e.y,sizeX:104,sizeY:104,a:0};
  if (spec.shape==='corridor'){
    const dx=spec.x2-spec.x,dy=spec.y2-spec.y;
    return {x:(spec.x+spec.x2)/2,y:(spec.y+spec.y2)/2,sizeX:Math.max(96,Math.hypot(dx,dy)),
      sizeY:Math.max(72,(spec.width||46)*2.2),a:Math.atan2(dy,dx)};
  }
  const d=Math.max(96,((spec.r||48)+(spec.width||0))*2);
  return {x:spec.x,y:spec.y,sizeX:d,sizeY:d,a:spec.a||0};
}
function spawnBoss20EventArt(e,event){
  if (!e || !event || event.type==='hazard') return;
  const place=boss20EffectPlacement(event.spec,e);
  const add=(key,override=null,spec=event.spec)=>pushBoss20SpriteEffect(key,place.x,place.y,place.sizeX,.58,
    Object.assign({sizeX:place.sizeX,sizeY:place.sizeY,a:place.a,spec:spec&&Object.assign({},spec)},override||{}));
  if (e.bossId==='funeral_bell_colossus') add('funeral_wave_ring');
  else if (e.bossId==='star_devourer'){
    add('star_meteor',{sizeX:Math.max(150,place.sizeX),sizeY:Math.max(150,place.sizeY),life:.42,max:.42});
    add('star_meteor_impact',{life:.66,max:.66});
  } else if (e.bossId==='plague_archimandrite') add('plague_censer_cloud');
  else if (e.bossId==='crimson_seamstress'){
    for (const spec of event.specs||[]){const p=boss20EffectPlacement(spec,e);pushBoss20SpriteEffect('crimson_flesh_seam',p.x,p.y,p.sizeX,.65,{sizeX:p.sizeX,sizeY:p.sizeY,a:p.a,spec:Object.assign({},spec)});}
  } else if (e.bossId==='glass_titan' && event.type==='hit') add('glass_blast');
  else if (e.bossId==='rust_king') add('rust_tide_cone');
  else if (e.bossId==='mother_empty_masks') add('empty_mask_beam');
  else if (e.bossId==='ice_psalmist') add('ice_liturgy_sector');
  else if (e.bossId==='heart_collector') add('heart_blood_ring');
  else if (e.bossId==='judge_of_chains') add(event.type==='pull'?'judge_chain_hook':'judge_hammer_impact');
  else if (e.bossId==='bone_astrolabe') add('bone_orbit_ring');
  else if (e.bossId==='copper_oracle') add('copper_rewind_explosion');
  else if (e.bossId==='prince_hungry_ravens') add('raven_swarm');
  else if (e.bossId==='lunar_butcher') add('lunar_crescent');
  else if (e.bossId==='sand_gravedigger' && event.type==='hit') add('sand_shockwave');
  else if (e.bossId==='bottomless_mnema') add('mnema_shadow_pierce');
  else if (e.bossId==='empress_iron_roses') add('iron_rose_ring');
}

function tickBossSkill(e, dt){
  const def = bossType(e);
  if (!def) return false;
  const T = e.bossT || (e.bossT = {}), p = G.player;
  if (T.visualAction){
    T.visualAction.life=Math.max(0,T.visualAction.life-dt);
    if (T.visualAction.life<=0) T.visualAction=null;
  }
  if (T.vulnerable > 0) T.vulnerable=Math.max(0,T.vulnerable-dt);
  if (T.crash > 0){ T.crash=Math.max(0,T.crash-dt); return true; }
  if(BOSS20_KEYS.has(e.bossId) && T.special) return tickBoss20Skill(e,dt);
  if (e.ail.stun > 0 || e.ail.freeze > 0)
    return (e.bossId === 'goat' && T.slamWarn > 0) ||
      (e.bossId === 'behemoth' && (T.jumpWarn > 0 || T.jumpT > 0));
  const boss20Lock=tickBoss20Skill(e,dt);
  if(boss20Lock!==null) return boss20Lock;

  if (e.bossId === 'lich'){
    T.cast = (T.cast === undefined ? 2 : T.cast) - dt;
    if (T.cast<=0.52 && !T.visualAction) startLegacyBossVisual(e,0.52);
    if (T.cast <= 0){
      T.cast += 2;
      fireBossProjectile(e, {speed:240, radius:p.r, pct:0.15, life:6,
        shotType:'lich', col:def.col, cause:'изумрудная сфера'});
      G.fx.push({t:'ring', x:e.x, y:e.y, r:8, max:42, life:0.3, col:def.col});
    }
    return false;
  }

  if (e.bossId === 'goat'){
    if (T.slamWarn > 0){
      T.slamWarn -= dt;
      if (T.slamWarn <= 0){
        T.slamWarn = 0; T.slamCd = 3 - BOSS_GOAT_WARN;
        if (dist(e,p) < BOSS_GOAT_AOE + p.r)
          hurt(D.life*0.25, false, false, enemyCause(e, 'удар по земле'), 'boss', e);
        pushTelegraphTrace({shape:'circle',kind:'damage',x:e.x,y:e.y,r:BOSS_GOAT_AOE});
        pushLegacyBossEffect('goat_slam',e.x,e.y,BOSS_GOAT_AOE*2,0.48,
          {spec:{shape:'circle',x:e.x,y:e.y,r:BOSS_GOAT_AOE}});
      }
      return true;
    }
    T.slamCd = (T.slamCd === undefined ? 3 - BOSS_GOAT_WARN : T.slamCd) - dt;
    if (T.slamCd <= 0){ T.slamWarn = BOSS_GOAT_WARN; startLegacyBossVisual(e,BOSS_GOAT_WARN+0.28); return true; }
    return false;
  }

  if (e.bossId === 'plague'){
    T.spit = (T.spit === undefined ? 1 : T.spit) - dt;
    if (T.spit<=0.46 && !T.visualAction) startLegacyBossVisual(e,0.46);
    if (T.spit <= 0){
      T.spit += 1;
      fireBossProjectile(e, {speed:260, radius:8, pct:0.075, life:5,
        shotType:'slime', col:def.col, cause:'сгусток слизи'});
    }
    return false;
  }

  if (e.bossId === 'greed'){
    T.summon = (T.summon === undefined ? 1 : T.summon) - dt;
    if (T.summon <= 0){
      T.summon += 1; summonGreedRunner(e);
      pushLegacyBossEffect('summon_sigil',e.x,e.y,74,0.46,
        {spec:{shape:'circle',x:e.x,y:e.y,r:37},filter:'hue-rotate(62deg) saturate(1.35)'});
    }
    T.spear = (T.spear === undefined ? 5 : T.spear) - dt;
    if (T.spear<=0.62 && !T.visualAction) startLegacyBossVisual(e,0.62);
    if (T.spear <= 0){
      T.spear += 5;
      fireBossProjectile(e, {speed:D.mspd*0.5, radius:15, pct:0.50, life:12,
        shotType:'spear', col:def.col, cause:'копьё жадности'});
    }
    return false;
  }

  if (e.bossId === 'executioner'){
    T.axe = (T.axe === undefined ? BOSS_EXECUTIONER_CD : T.axe) - dt;
    if (T.axe<=0.62 && !T.visualAction) startLegacyBossVisual(e,0.62);
    if (T.axe <= 0){ T.axe += BOSS_EXECUTIONER_CD; throwExecutionerAxe(e); }
    return false;
  }

  if (e.bossId === 'tyrant'){
    T.trail = (T.trail === undefined ? 0 : T.trail) - dt;
    if (T.trail <= 0){ T.trail += 0.34; leaveTyrantFire(e); }
    T.slash = (T.slash === undefined ? 1 : T.slash) - dt;
    if (T.slash<=0.38 && !T.visualAction) startLegacyBossVisual(e,0.38);
    if (T.slash <= 0){
      T.slash += 1;
      const a = Math.atan2(p.y-e.y, p.x-e.x);
      T.faceA = a;
      const pa = Math.atan2(p.y-e.y, p.x-e.x);
      const da = Math.abs(Math.atan2(Math.sin(pa-a), Math.cos(pa-a)));
      if (dist(e,p) <= BOSS_TYRANT_REACH + p.r && da <= BOSS_TYRANT_ARC/2){
        hurt(D.life*0.10, false, false, enemyCause(e, 'взмах меча'), 'boss', e);
        applyTyrantBurn(enemyCause(e, 'ГОРЕНИЕ РОГАТОГО ТИРАНА'));
      }
      G.fx.push({t:'arc', x:e.x, y:e.y, r:BOSS_TYRANT_REACH, a, arc:BOSS_TYRANT_ARC,
        life:0.28, col:'#ff5a28'});
      pushLegacyBossEffect('tyrant_slash',e.x,e.y,BOSS_TYRANT_REACH*2,0.36,
        {a,spec:{shape:'cone',x:e.x,y:e.y,r:BOSS_TYRANT_REACH,a,arc:BOSS_TYRANT_ARC}});
    }
    return false;
  }

  if (e.bossId === 'grave'){
    T.summon = (T.summon === undefined ? 1 : T.summon) - dt;
    if (T.summon<=0.52 && !T.visualAction) startLegacyBossVisual(e,0.52);
    if (T.summon <= 0){
      T.summon += 1;summonGraveCore(e);
      pushLegacyBossEffect('summon_sigil',e.x,e.y,86,0.50,
        {spec:{shape:'circle',x:e.x,y:e.y,r:43}});
    }
    return false;
  }

  if (e.bossId === 'behemoth'){
    if (T.jumpT > 0){
      T.jumpT = Math.max(0, T.jumpT-dt);
      const u = 1 - T.jumpT/BOSS_BEHEMOTH_FLIGHT;
      const ease = u < 0.5 ? 2*u*u : 1-Math.pow(-2*u+2,2)/2;
      e.x = T.jumpSX + (T.jumpX-T.jumpSX)*ease;
      e.y = T.jumpSY + (T.jumpY-T.jumpSY)*ease;
      if (T.jumpT <= 0){
        T.jumpCd = 3 - BOSS_BEHEMOTH_WARN - BOSS_BEHEMOTH_FLIGHT;
        pushTelegraphTrace({shape:'target',kind:'warning',x:e.x,y:e.y,r:e.r+20});
        pushLegacyBossEffect('behemoth_impact',e.x,e.y,(e.r+20)*2,0.52,
          {spec:{shape:'target',x:e.x,y:e.y,r:e.r+20}});
      }
      return true;
    }
    if (T.jumpWarn > 0){
      T.jumpWarn = Math.max(0, T.jumpWarn-dt);
      if (T.jumpWarn <= 0){
        T.jumpSX=e.x; T.jumpSY=e.y; T.jumpT=BOSS_BEHEMOTH_FLIGHT;
        e.spriteFace = T.jumpX < e.x ? -1 : 1;
      }
      return true;
    }
    T.jumpCd = (T.jumpCd === undefined ? 3-BOSS_BEHEMOTH_WARN-BOSS_BEHEMOTH_FLIGHT : T.jumpCd) - dt;
    if (T.jumpCd <= 0){
      T.jumpWarn=BOSS_BEHEMOTH_WARN;
      T.jumpX=clamp(p.x,-ARENA+40,ARENA-40); T.jumpY=clamp(p.y,-ARENA+40,ARENA-40);
      startLegacyBossVisual(e,BOSS_BEHEMOTH_WARN+BOSS_BEHEMOTH_FLIGHT+0.24);
      return true;
    }
  }

  if (e.bossId === 'vampire'){
    if (T.markWarn > 0){
      T.markWarn=Math.max(0,T.markWarn-dt);
      if (T.markWarn <= 0){
        e.x=T.markX; e.y=T.markY;
        const dx=Math.abs(p.x-T.markX), dy=Math.abs(p.y-T.markY);
        if ((dx <= 105 && dy <= 22) || (dy <= 105 && dx <= 22)){
          hurt(D.life*0.30,false,false,enemyCause(e,'вампирический рывок'),'boss',e);
          e.hp=Math.min(e.maxHp,e.hp+e.maxHp*0.50);
          G.fx.push({t:'txt',x:e.x,y:e.y-e.r-18,s:'+50% HP',life:0.8,col:'#ef476f'});
        }
        pushTelegraphTrace({shape:'corridor',kind:'damage',x:T.markX-105,y:T.markY,x2:T.markX+105,y2:T.markY,width:44});
        pushTelegraphTrace({shape:'corridor',kind:'damage',x:T.markX,y:T.markY-105,x2:T.markX,y2:T.markY+105,width:44});
        pushLegacyBossEffect('vampire_cross',T.markX,T.markY,250,0.46,{specs:[
          {shape:'corridor',x:T.markX-105,y:T.markY,x2:T.markX+105,y2:T.markY,width:44},
          {shape:'corridor',x:T.markX,y:T.markY-105,x2:T.markX,y2:T.markY+105,width:44}
        ]});
        T.markCd=BOSS_VAMPIRE_COOLDOWN;
      }
      return true;
    }
    T.markCd=(T.markCd === undefined ? BOSS_VAMPIRE_COOLDOWN : T.markCd)-dt;
    if (T.markCd <= 0){
      T.markWarn=BOSS_VAMPIRE_WARN;
      T.markX=clamp(p.x,-ARENA+e.r,ARENA-e.r); T.markY=clamp(p.y,-ARENA+e.r,ARENA-e.r);
      startLegacyBossVisual(e,BOSS_VAMPIRE_WARN+0.24);
      return true;
    }
    return false;
  }

  if (e.bossId === 'voidwrath'){
    if (T.rifts){
      for (const r of T.rifts) r.warn=Math.max(0,r.warn-dt);
      if (T.rifts[0].warn <= 0){
        let hit=false;
        for (const r of T.rifts){
          if (dist(r,p) <= r.r+p.r) hit=true;
          G.fx.push({t:'voidRiftBurst',x:r.x,y:r.y,r:r.r,life:0.20,max:0.20});
        }
        if (hit){
          hurt(D.life*0.40,false,false,enemyCause(e,'взрыв разлома пустоты'),'boss',e);
          applyBossSlow(0.40,1);
        }
        T.rifts=null; T.riftCd=5;
      }
      return false;
    }
    T.riftCd=(T.riftCd === undefined ? 3 : T.riftCd)-dt;
    if (T.riftCd <= 0){
      const count=Math.floor(rnd(3,6)); T.rifts=[];
      for (let i=0;i<count;i++){
        const a=rnd(0,Math.PI*2), d=i ? rnd(55,210) : 0;
        T.rifts.push({x:clamp(p.x+Math.cos(a)*d,-ARENA+55,ARENA-55),
          y:clamp(p.y+Math.sin(a)*d,-ARENA+55,ARENA-55),r:52,warn:BOSS_VOID_WARN});
      }
      startLegacyBossVisual(e,BOSS_VOID_WARN+0.30);
    }
    return false;
  }

  if (e.bossId === 'minotaur'){
    if (T.chargeLeft > 0){
      const step=Math.min(T.chargeLeft,BOSS_MINOTAUR_CHARGE_SPEED*dt);
      e.x+=Math.cos(T.chargeA)*step; e.y+=Math.sin(T.chargeA)*step; T.chargeLeft-=step;
      if (!T.chargeHit && dist(e,p) < e.r+p.r+8){
        T.chargeHit=true;
        hurt(D.life*0.35,false,false,enemyCause(e,'неостановимый натиск'),'boss',e);
      }
      if (T.chargeLeft <= 0){
        e.x=clamp(e.x,-ARENA+e.r,ARENA-e.r); e.y=clamp(e.y,-ARENA+e.r,ARENA-e.r);
        T.vulnerable=BOSS_MINOTAUR_VULNERABLE; T.crash=BOSS_MINOTAUR_VULNERABLE;
        T.spearsPending=true;
        pushLegacyBossEffect('minotaur_crash',e.x,e.y,(e.r+48)*2,0.50,
          {a:T.chargeA,spec:{shape:'target',x:e.x,y:e.y,r:e.r+48}});
        G.fx.push({t:'txt',x:e.x,y:e.y-e.r-18,s:'УЯЗВИМ',life:BOSS_MINOTAUR_VULNERABLE,col:'#ffd08a'});
      }
      return true;
    }
    if (T.chargeWarn > 0){
      T.chargeWarn=Math.max(0,T.chargeWarn-dt);
      if (T.chargeWarn <= 0){
        T.chargeLeft=minotaurEdgeDistance(e,T.chargeA); T.chargeHit=false;
        pushTelegraphTrace({shape:'corridor',kind:'damage',x:e.x,y:e.y,
          x2:e.x+Math.cos(T.chargeA)*T.chargeLeft,y2:e.y+Math.sin(T.chargeA)*T.chargeLeft,width:e.r*2+16});
      }
      return true;
    }
    if (T.spearsPending){
      T.spearsPending=false; fireMinotaurSpears(e); T.chargeCd=BOSS_MINOTAUR_RECHARGE;
      return true;
    }
    T.chargeCd=(T.chargeCd === undefined ? BOSS_MINOTAUR_RECHARGE : T.chargeCd)-dt;
    if (T.chargeCd <= 0){
      T.chargeWarn=BOSS_MINOTAUR_WARN;T.chargeA=Math.atan2(p.y-e.y,p.x-e.x);
      startLegacyBossVisual(e,BOSS_MINOTAUR_WARN+1.05);return true;
    }
    return false;
  }

  if (e.bossId === 'seraph'){
    if (T.judgeWarn > 0){
      T.judgeWarn=Math.max(0,T.judgeWarn-dt);
      if (T.judgeWarn <= 0){
        if (Math.hypot(p.x-T.judgeX,p.y-T.judgeY) <= 68+p.r)
          hurt(D.life*0.20,false,false,enemyCause(e,'Святое Копьё'),'boss',e);
        pushTelegraphTrace({shape:'target',kind:'damage',x:T.judgeX,y:T.judgeY,r:68});
        G.fx.push({t:'holySpear',x:T.judgeX,y:T.judgeY,r:68,a:Math.atan2(T.judgeY-e.y,T.judgeX-e.x),life:0.38,max:0.38,col:'#ffe36e'});
        T.judgeLeft--;
        if (T.judgeLeft > 0){ T.judgeX=clamp(p.x,-ARENA+68,ARENA-68); T.judgeY=clamp(p.y,-ARENA+68,ARENA-68); T.judgeWarn=BOSS_SERAPH_WARN; }
        else T.judgeCd=3;
      }
      return false;
    }
    T.judgeCd=(T.judgeCd === undefined ? 3 : T.judgeCd)-dt;
    if (T.judgeCd <= 0){
      T.judgeLeft=3; T.judgeX=clamp(p.x,-ARENA+68,ARENA-68); T.judgeY=clamp(p.y,-ARENA+68,ARENA-68); T.judgeWarn=BOSS_SERAPH_WARN;
      startLegacyBossVisual(e,BOSS_SERAPH_WARN*3+0.46);
    }
    return false;
  }

  if (e.bossId === 'matriarch'){
    T.spawn=(T.spawn === undefined ? 1 : T.spawn)-dt;
    if (T.spawn<=0.52 && !T.visualAction) startLegacyBossVisual(e,0.52);
    if (T.spawn <= 0){
      T.spawn+=1;
      pushLegacyBossEffect('summon_sigil',e.x,e.y,78,0.46,
        {spec:{shape:'circle',x:e.x,y:e.y,r:39},filter:'hue-rotate(300deg) saturate(1.2)'});
      summonMatriarchRunner(e);
      summonMatriarchRunner(e);
    }
    return false;
  }

  if (e.bossId === 'demonqueen'){
    if (T.leapWarn > 0){
      T.leapWarn=Math.max(0,T.leapWarn-dt);
      if (T.leapWarn <= 0){
        e.x=T.leapX; e.y=T.leapY; T.hidden=false;
        if (dist(e,p) <= 115+p.r){ hurt(D.life*0.35,false,false,enemyCause(e,'Демонический сгусток'),'boss',e); applyBossSlow(0.50,2); }
        pushTelegraphTrace({shape:'target',kind:'control',x:e.x,y:e.y,r:115});
        G.fx.push({t:'demonicBlob',x:e.x,y:e.y,r:115,life:0.38,max:0.38});
        T.leapCd=5;
      }
      return true;
    }
    T.leapCd=(T.leapCd === undefined ? 5 : T.leapCd)-dt;
    if (T.leapCd <= 0){
      T.leapX=clamp(p.x,-ARENA+115,ARENA-115); T.leapY=clamp(p.y,-ARENA+115,ARENA-115);
      T.leapWarn=BOSS_QUEEN_WARN;T.hidden=true;startLegacyBossVisual(e,BOSS_QUEEN_WARN+0.38);return true;
    }
    return false;
  }
  return false;
}

/* Общее снижение входящего урона у врага: обычная броня плюс панцирь.
   Вынесено отдельно, потому что путей урона два — игрок и свита. */
function mitigate(e, total, minionShare=0, skipConstellation=false, armorIgnore=0){
  const surgeonPct=(e.surgeonUntil||0)>G.time ? Math.min(80,e.surgeonArmorPct||0) : 0;
  const armor=Math.max(0,(e.armor||0)*(1-surgeonPct/100)-Math.max(0,armorIgnore||0));
  total *= 1 - armor/(armor + 60);
  const eliteDef=eliteVariantDef(e);
  if (eliteDef && eliteDef.playerTaken && !minionShare) total*=eliteDef.playerTaken;
  if (e.kind === 'boss' && e.bossId === 'minotaur')
    total *= e.bossT && e.bossT.vulnerable > 0 ? 1.40 : 0.20;
  if (e.bulwark) total *= total / (total + e.bulwark);
  if (e.pack) total = packTaken(e, total, minionShare, skipConstellation); // броня пачки, связь, кровная связь
  return total;
}

/* РУКА ХИРУРГА хранит одну последовательность на героя. Удар по другой цели
   немедленно обрывает прежнюю: иначе пара разлетающихся стрел незаметно
   поддерживала бы по 80% снижения брони на всей комнате. Первый удар создаёт
   стак после расчёта собственного урона, поэтому польза начинается со второго. */
function triggerSurgeonsHand(e, src, dealt){
  if (!amu('surgeonsHand') || !e || e.dead || !(dealt>0) || !src || !src.direct || src.itemDamage) return false;
  const p=G.player, same=p.surgeonTarget===e && G.time-(p.surgeonLastHit||0)<=2;
  if (p.surgeonTarget && p.surgeonTarget!==e){
    p.surgeonTarget.surgeonArmorPct=0; p.surgeonTarget.surgeonUntil=0;
  }
  if (!same) e.surgeonArmorPct=0;
  e.surgeonArmorPct=Math.min(80,(e.surgeonArmorPct||0)+(e.kind==='boss'?1:2));
  e.surgeonUntil=G.time+2; p.surgeonTarget=e; p.surgeonLastHit=G.time;
  statusText(e,'-'+Math.round(e.surgeonArmorPct)+'% '+tr('брони'),'#c08cff');
  return true;
}

/* Прогон аффиксов в кадре. true означает, что движение врага забрал аффикс. */
function tickAffixes(e, dt, tgt, edmg){
  let lock = false;
  for (const a of e.aff) if (a.tick && a.tick(e, dt, tgt, edmg)) lock = true;
  return lock;
}

/* ---------- 5c. ПАЧКИ ЭЛИТЫ ----------
   Пачка — это группа элитных монстров, которые появляются вместе и делят
   между собой набор аффиксов. Отличие от мини-босса принципиальное: у босса
   аффикс меняет поведение одной крупной цели, у пачки — задаёт порядок,
   в котором цели надо убивать. Отсюда роли: маяк, матка, командир, авангард —
   всё это ответ на вопрос «кого первым», а не «куда встать».

   Формат записи (все поля кроме id/nm/col/nt необязательны):
     role       — аффикс требует одного носителя; движок сам выберет монстра
     initRole   — разовая правка носителя роли
     init       — разовая правка каждого монстра пачки
     tick       — поведение монстра в кадре; true забирает движение себе
     packTick   — поведение пачки целиком, один раз за кадр
     spd/dmg/aspd — множители в кадре, функция (монстр, пачка)
     taken      — правка входящего урона, функция (монстр, урон) -> урон
     dealt      — урон прошёл по игроку, функция (пачка, величина)
     onDeath    — монстр пачки погиб
*/
const healEnemy = (e, v) => { if (!e.dead) e.hp = Math.min(e.maxHp, e.hp + v); };

/* Потолок на суммарное лечение пачки, доля здоровья в секунду.
   Замер на этаже 51 (10 аффиксов): три лечащих аффикса складывались в 6%/сек
   при том, что урон, растекающийся по пятерым, доходит до одного монстра
   примерно как 3%/сек — пачка становилась буквально неубиваемой (прогон
   упирался в потолок 300 сек, не сняв и половины). Со всеми аффиксами, кроме
   лечащих, тот же прогон давал ×3.8 запаса, то есть тяжело, но конечно.
   Поэтому источники складываются, а итог режется одним числом. */
const PACK_REGEN_CAP = 0.025;
/* Аффиксы не лечат напрямую, а копят проценты за кадр — иначе потолок
   пришлось бы знать каждому из них по отдельности. */
const packRegen = (e, pct) => { e.regPct = (e.regPct || 0) + pct; };
const packRole  = (pk, role) => { const m = pk.role[role]; return (m && !m.dead) ? m : null; };
const packLive  = pk => pk.members.filter(m => !m.dead);

const PACK_AFFIXES = [

  { id:'berserk', nm:'берсеркеры', col:'#ff7a2f',
    nt:'чем меньше здоровья осталось, тем быстрее и сильнее бьют',
    // Множитель растёт линейно до +60% на нуле здоровья. Больше нельзя:
    // добивание раненого и так самая опасная фаза, а пачка бьёт вчетвером.
    spd:e => 1 + (1 - e.hp/e.maxHp)*0.6,
    dmg:e => 1 + (1 - e.hp/e.maxHp)*0.6 },

  { id:'armored', nm:'бронированные', col:'#9aa7b4',
    nt:'−50% получаемого урона, пока выше половины здоровья',
    taken:(e, t) => e.hp/e.maxHp > 0.5 ? t*0.5 : t },

  { id:'regen', nm:'регенераторы', col:'#6fd98f',
    nt:'2.5% здоровья в секунду, пока по ним не попадают',
    tick(e, dt){ if (e.noDmgT > 1.5) packRegen(e, 0.025); } },

  { id:'vamp', nm:'вампиры', col:'#e0405a',
    nt:'урон, прошедший по игроку, лечит всю пачку — доля делится на всех',
    // 0.6 на каждого означало, что впятером они возвращают 300% удара за раз:
    // пачка в контакте с игроком лечилась быстрее, чем её успевали убивать.
    dealt(pk, v){
      const live = packLive(pk);
      for (const m of live) healEnemy(m, v*0.35/live.length);
    } },

  { id:'avenger', nm:'мстители', col:'#ffd24a',
    nt:'смерть одного разгоняет соседей: +30% скорости и урона на 6 сек',
    onDeath(e){
      for (const o of G.enemies) if (o !== e && dist(o, e) < 260) o.rage = 6;
      G.fx.push({t:'ring', x:e.x, y:e.y, r:10, max:260, life:0.5, col:'#ffd24a'});
    } },

  { id:'jumper', nm:'прыгуны', col:'#c08cff',
    nt:'раз в 3.5 сек один прыгает игроку под ноги',
    packTick(pk, dt){
      pk.jumpT = (pk.jumpT || 0) - dt;
      if (pk.jumpT > 0) return;
      pk.jumpT = 3.5;
      const live = packLive(pk).filter(m => !m.jumpTo);
      if (!live.length) return;
      const m = pick(live), p = G.player;
      m.jumpTo = {x:p.x, y:p.y}; m.jumpT = 0.5;              // замах: игрок успевает отойти
    },
    tick(e, dt){
      if (!e.jumpTo) return false;
      if (e.jumpT > 0){
        e.jumpT -= dt;
        if (Math.random() < 0.4) burst(e.x,e.y,2,'#c08cff',70,3,0.3);
        if (e.jumpT <= 0) pushTelegraphTrace({shape:'target',kind:'warning',x:e.jumpTo.x,y:e.jumpTo.y,r:54});
        return true;
      }
      const dx = e.jumpTo.x - e.x, dy = e.jumpTo.y - e.y, d = Math.hypot(dx,dy) || 1;
      const stp = 900*dt;
      if (d <= stp){ e.x = e.jumpTo.x; e.y = e.jumpTo.y; e.jumpTo = null; burst(e.x,e.y,8,'#c08cff',180,3,0.4); }
      else { e.x += dx/d*stp; e.y += dy/d*stp; }
      return true;
    } },

  { id:'hunter', nm:'охотники', col:'#ff5a4e', role:'hunter', mark:'\u25B2',
    nt:'один монстр не отвлекается на свиту и бежит к игроку на 50% быстрее',
    spd:(e, pk) => e.roles.indexOf('hunter') >= 0 ? 1.5 : 1 },

  { id:'breed', nm:'размножение', col:'#8be04e',
    nt:'каждый погибший оставляет двух уменьшенных копий',
    onDeath(e){
      if (e.noBreed) return;                                  // копии копий — это лавина, запрещено
      for (let i = 0; i < 2; i++) packClone(e, {hp:0.3, r:0.6, dmg:0.6});
    } },

  { id:'hive', nm:'улей', col:'#d95ec2', role:'queen', mark:'\u2739',
    nt:'пока матка жива, вся пачка восстанавливает 1.2% здоровья в секунду',
    tick(e, dt, tgt, edmg, pk){ if (packRole(pk,'queen')) packRegen(e, 0.012); } },

  { id:'linked', nm:'связанные', col:'#5ec2e0',
    nt:'−30% получаемого урона, пока рядом стоит свой',
    taken(e, t){
      for (const m of e.pack.members) if (m !== e && !m.dead && dist(m,e) < 150) return t*0.7;
      return t;
    } },

  { id:'bloodbond', nm:'кровная связь', col:'#e0405a',
    nt:'80% урона по одному растекается на остальных — общий урон тот же, но убить кого-то одного нельзя',
    taken(e, t, minionShare, skipConstellation){
      const others = e.pack.members.filter(m => m !== e && !m.dead && m.hp > 0);
      if (!others.length) return t;                            // последний в пачке получает всё сам
      const share = t*0.8/others.length;
      for (const m of others) applyDamage(m, share, false, true, minionShare, skipConstellation);
      return t*0.2;
    } },

  { id:'beacon', nm:'маяк', col:'#ffe14a', role:'beacon', mark:'\u25C8',
    nt:'носитель даёт своим в радиусе 180 половину урона сверху — его выгодно убить первым',
    dmg(e, pk){ const b = packRole(pk,'beacon'); return (b && b !== e && dist(b,e) < 180) ? 1.5 : 1; } },

  { id:'vanguard', nm:'авангард', col:'#9aa7b4', role:'vanguard', mark:'\u25A0',
    nt:'у передового вдвое больше здоровья, и он перехватывает треть попаданий по своим',
    initRole(m){ m.maxHp = Math.round(m.maxHp*2); m.hp = m.maxHp; m.r *= 1.15; m.r0 = m.r; } },

  { id:'cmd', nm:'командир', col:'#ffb340', role:'cmd', mark:'\u2691',
    nt:'пока командир жив, пачка на 30% быстрее двигается и бьёт',
    spd:(e, pk) => packRole(pk,'cmd') ? 1.3 : 1,
    aspd:(e, pk) => packRole(pk,'cmd') ? 1.3 : 1 },

  { id:'sanctuary', nm:'священный круг', col:'#6fd98f', role:'circle', mark:'\u271A',
    nt:'вокруг носителя круг радиусом 150: свои внутри лечатся на 1.5% в секунду',
    tick(e, dt, tgt, edmg, pk){
      const c = packRole(pk,'circle');
      if (c && dist(c,e) < 150) packRegen(e, 0.015);
    } },

  { id:'lastword', nm:'последнее слово', col:'#d95ec2',
    nt:'после смерти выпускает три снаряда в сторону игрока',
    onDeath(e){
      const p = G.player, a = Math.atan2(p.y-e.y, p.x-e.x);
      for (let i = -1; i <= 1; i++){
        const aa = a + i*0.22;
        G.eshots.push({x:e.x, y:e.y, vx:Math.cos(aa)*270, vy:Math.sin(aa)*270,
                       r:6, life:2.4, dmg:e.dmg*0.7, pk:e.pack,
                       sourceKind:e.kind,cause:enemyCause(e,'последнее слово'),owner:e});
      }
    } },

  { id:'split', nm:'разделяющиеся', col:'#7fd6ff',
    nt:'на половине здоровья монстр делится надвое, у каждой половины 40% исходного запаса' },

  { id:'mad', nm:'безумные', col:'#c08cff',
    nt:'каждые 2 сек заново бросают кости: скорость, размер, урон, курс и способ атаки',
    tick(e, dt){
      e.madT = (e.madT || 0) - dt;
      if (e.madT > 0) return false;
      e.madT = 2;
      e.madSpd = rnd(0.6, 1.7); e.madDmg = rnd(0.6, 1.7);
      e.r = e.r0 * rnd(0.75, 1.35);
      e.madRanged = Math.random() < 0.3;                       // «тип атаки»
      e.madA = Math.random() < 0.4 ? rnd(-1.3, 1.3) : 0;       // «направление движения»: идёт криво
      burst(e.x, e.y, 4, '#c08cff', 90, 3, 0.3);
      return false;
    },
    spd:e => e.madSpd || 1,
    dmg:e => e.madDmg || 1 },
];

/* Сколько аффиксов у пачки: по одному на каждые пять этажей. */
function packAffixCount(f){
  // Маска босса добавляет аффикс всем последующим пачкам — предмет находится
  // посреди партии, а пачка собирается на входе в этаж, значит действует со следующего
  const bonus = (G && G.amu && G.amu.bmask) ? 1 : 0;
  return Math.min(Math.floor(f/5) + bonus, PACK_AFFIXES.length);
}

const PACK_COLS = ['#d95ec2','#5ec2e0','#8be04e','#ffb340','#c08cff','#ff5a4e'];

function spawnPack(f){
  const n = 4 + (f >= 20 ? 1 : 0) + (f >= 40 ? 1 : 0) + (amu('invertedCrown') ? 3 : 0);
  const pk = {aff:[], has:{}, role:{}, members:[], nm:'', col:pick(PACK_COLS)};
  // Пачка выходит кучей из одной точки: в этом весь смысл ролей — если бы
  // монстры расползлись по арене, маяк и командир не встретились бы со своими.
  const ang = rnd(0, Math.PI*2), rad = rnd(520, 700), p = G.player;
  const cx = clamp(p.x + Math.cos(ang)*rad, -ARENA+80, ARENA-80);
  const cy = clamp(p.y + Math.sin(ang)*rad, -ARENA+80, ARENA-80);
  for (let i = 0; i < n; i++){
    const e = spawnEnemy('pack');
    e.x = clamp(cx + rnd(-46,46), -ARENA+40, ARENA-40);
    e.y = clamp(cy + rnd(-46,46), -ARENA+40, ARENA-40);
    e.pack = pk; pk.members.push(e);
  }
  applyPackAffixes(pk, f);
  G.packs.push(pk);
  return pk;
}

function applyPackAffixes(pk, f){
  const pool = PACK_AFFIXES.slice();
  const n = packAffixCount(f);
  for (let i = 0; i < n && pool.length; i++)
    pk.aff.push(pool.splice(Math.floor(Math.random()*pool.length), 1)[0]);
  for (const a of pk.aff) pk.has[a.id] = true;
  // Роли раздаём тому, у кого их меньше. Если ролей больше, чем монстров,
  // один тащит несколько — это честнее, чем молча потерять аффикс.
  for (const a of pk.aff){
    if (!a.role) continue;
    const m = pk.members.slice().sort((x,y)=> x.roles.length - y.roles.length)[0];
    if (!m) continue;
    m.roles.push(a.role); pk.role[a.role] = m;
    if (a.initRole) a.initRole(m, pk);
  }
  for (const a of pk.aff) if (a.init) for (const m of pk.members) a.init(m, pk);
  pk.nm = pk.aff.map(a => a.nm).join(' \u00B7 ');
}

/* Множители кадра. Все аффиксы собираются в одну функцию: иначе каждый лез бы
   в цикл врагов отдельной строчкой и цикл стало бы невозможно читать. */
function packMods(e,out=null){
  const pk=e.pack,m=out||{spd:1,dmg:1,aspd:1};m.spd=1;m.dmg=1;m.aspd=1;
  for (const a of pk.aff){
    if (a.spd)  m.spd  *= a.spd(e, pk);
    if (a.dmg)  m.dmg  *= a.dmg(e, pk);
    if (a.aspd) m.aspd *= a.aspd(e, pk);
  }
  return m;
}

function packTick(e, dt, tgt, edmg){
  let lock = false;
  e.regPct = 0;
  for (const a of e.pack.aff) if (a.tick && a.tick(e, dt, tgt, edmg, e.pack)) lock = true;
  if (e.regPct) healEnemy(e, e.maxHp * Math.min(e.regPct, PACK_REGEN_CAP) * dt);
  return lock;
}

/* Правка входящего урона. Зовётся из mitigate(), то есть покрывает и удары
   игрока, и удары свиты — оба пути урона идут через неё. */
function packTaken(e, total, minionShare=0, skipConstellation=false){
  for (const a of e.pack.aff) if (a.taken) total = a.taken(e, total, minionShare, skipConstellation);
  return total;
}

/* Урон прошёл по игроку — сообщаем пачке (вампиры). */
function packDealt(pk, v){ if (pk) for (const a of pk.aff) if (a.dealt) a.dealt(pk, v); }

/* АВАНГАРД: часть попаданий по пачке уходит в передового вместо цели. */
function packRedirect(e){
  if (!e.pack || !e.pack.has.vanguard) return e;
  const v = packRole(e.pack, 'vanguard');
  if (!v || v === e || Math.random() > 0.35) return e;
  G.fx.push({t:'ring', x:v.x, y:v.y, r:v.r, max:v.r+9, life:0.16, col:'#9aa7b4'});
  return v;
}

/* Копия монстра: размножение и разделение. Поля со ссылками копируем вручную —
   Object.assign отдал бы детям те же объекты статусов, что и родителю. */
function packClone(src, {hp, r, dmg}){
  const c = Object.assign({}, src);
  c.ail = {chill:0, shock:0, stun:0, freeze:0, dizzy:0};
  c.dots = {fire:{dps:0,minionDps:0,n:0,dur:3}, poison:{dps:0,minionDps:0,n:0,dur:4}, bleed:{dps:0,minionDps:0,n:0,dur:6}};
  c.dotAcc = {fire:0, poison:0, bleed:0};
  c.plague = null;
  c.hunterMarkUntil = 0;
  c.kb = {x:0, y:0}; c.roles = []; c.aff = [];
  c.dead = false; c.jumpTo = null; c.noBreed = true; c.didSplit = true;
  c.bloodPuddleRolled=false; c.bloodPuddleVariant=-1; c.bloodPuddleSize=0;
  c.maxHp = Math.max(1, Math.round(src.maxHp*hp)); c.hp = c.maxHp;
  c.r = src.r*r; c.r0 = c.r; c.dmg = src.dmg*dmg;
  // Копии считаются рядовыми: иначе «размножение» превращалось бы в станок
  // по золоту — четыре элиты рожают восемь элитных выплат из воздуха.
  c.kind = 'norm'; c.xp = Math.max(1, Math.round(src.xp*0.3)); c.armor = 0;
  c.eliteVariant = null; c.t=ETYPES[c.typeKey]||c.t; // рядовая копия не наследует особый вид и контакт
  c.x = clamp(src.x + rnd(-26,26), -ARENA+40, ARENA-40);
  c.y = clamp(src.y + rnd(-26,26), -ARENA+40, ARENA-40);
  G.enemies.push(c);
  if (ACTIVE_ENEMY_LOGIC_GRID) addEnemyToSpatialGrid(ACTIVE_ENEMY_LOGIC_GRID,c);
  if (c.pack) c.pack.members.push(c);
  return c;
}

/* РАЗДЕЛЯЮЩИЕСЯ: на половине здоровья один жирный превращается в двух тощих. */
function packSplit(e){
  e.didSplit = true;
  const half = packClone(e, {hp:0.4, r:0.78, dmg:0.75});
  half.didSplit = true;
  e.maxHp = Math.max(1, Math.round(e.maxHp*0.4)); e.hp = e.maxHp;
  e.r *= 0.78; e.r0 = e.r; e.dmg *= 0.75;
  burst(e.x, e.y, 12, '#7fd6ff', 220, 3, 0.5);
}

/* Смерть монстра пачки: снимаем с учёта и запускаем предсмертные аффиксы. */
function packDeath(e){
  e.dead = true;
  const pk = e.pack;
  const i = pk.members.indexOf(e); if (i >= 0) pk.members.splice(i,1);
  for (const a of pk.aff) if (a.onDeath) a.onDeath(e, pk);
}

/* Группа размещается совместно: сначала максимизируем дистанцию до игрока,
   затем — свободный зазор между уже поставленными боссами. Так крупные модели
   не склеиваются после clamp() у стены арены. */
function placeBossFloorGroup(bosses){
  const p=G.player, placed=[];
  for (let i=0;i<bosses.length;i++){
    const e=bosses[i]; let bestX=e.x,bestY=e.y,bestScore=-Infinity;
    for (let k=0;k<72;k++){
      const ring=540+(k%3)*120;
      const a=Math.PI*2*((k/72)+(i/Math.max(1,bosses.length)));
      const margin=Math.max(40,e.r+8);
      const x=clamp(p.x+Math.cos(a)*ring,-ARENA+margin,ARENA-margin);
      const y=clamp(p.y+Math.sin(a)*ring,-ARENA+margin,ARENA-margin);
      let score=Math.hypot(x-p.x,y-p.y)-p.r-e.r;
      for (let j=0;j<placed.length;j++){
        const o=placed[j];
        score=Math.min(score,Math.hypot(x-o.x,y-o.y)-e.r-o.r);
      }
      if (score>bestScore){ bestScore=score; bestX=x; bestY=y; }
    }
    e.x=bestX; e.y=bestY; e.spriteFace=e.x<p.x?1:-1; placed.push(e);
  }
  return bosses;
}

function buildFloor(){
  // Выбор выполняется ровно один раз на входе. Все Canvas render-pass этого
  // этажа читают один и тот же floorPattern и не пересчитывают индекс в кадре.
  selectRandomFloorPattern();
  /* Пересчёт на входе в этаж. Раньше recalc() звался только при взятии карточки
     или книги, и этого хватало: от этажа не зависело ничего. Теперь от него
     зависит здоровье свиты, и без этой строки приспешники получали бы запас
     того этажа, на котором игрок последний раз брал уровень. */
  recalc();
  // Кровь принадлежит текущему этажу: переход создаёт чистое поле, а пауза,
  // меню и смерть эту функцию не вызывают и потому не стирают следы боя.
  clearBloodFloor();
  G.visualCorpses.length = 0;                     // декоративные тела принадлежат только текущему этажу
  G.visualCorpseHead = 0;
  const f = G.floor, plan = bossFloorPlan(f);
  G.bossFloorPlan = plan;
  diagEvent('floor_build',{floor:f,bossFloor:!!plan.isBoss,devZone:!!G.devZone});
  G.enemies.length = 0; G.eshots.length = 0; G.portal = null;
  G.pools.length = 0;                                // лужи смолы не переносятся между этажами
  G.trails.length = 0;
  G.boils.length = 0;
  G.acidPools.length = 0;
  G.eliteAcidPools.length = 0;
  G.bossPools.length = 0;
  G.bossTrails.length = 0;
  G.bossHazards.length = 0;
  G.arcaneTraces.length = 0;
  G.arcaneMines.length = 0;
  G.repeatDetonations.length = 0;
  G.groundbreakerCracks.length = 0;
  G.sparkSigils.length = 0;
  G.worldShadow = null;
  G.player.huntTarget=null; G.player.huntUntil=0; G.player.huntN=0;
  G.packs.length = 0;
  G.banner = false;
  if (G.devZone){
    G.spawnQueue=0; G.spawnT=0;
    toast('DEV_ZONE · K — SPAWN MENU');
    return;
  }
  // Врагов на этаже: было 7 + этаж*2.4. Подняли до 4.0 — этаж стал длиннее,
  // а опыта, золота и находок с него больше. Это и есть замена силе удара.
  G.spawnQueue = plan.suppressRegularEnemies ? 0 :
    Math.round((7 + Math.floor(f*4.0)) * D.monsterMore);   // книга монстров густит волны
  if (plan.isBossFloor && !plan.suppressRegularEnemies) G.spawnQueue += 4;
  G.spawnT = 0;
  if (plan.isBossFloor){
    const usedBossTypes = [], bosses=[];
    for (let i = 0; i < plan.bossCount; i++){
      const key = rollBossType(usedBossTypes); usedBossTypes.push(key);
      bosses.push(spawnEnemy('boss',key,null,plan.affixCount));
    }
    placeBossFloorGroup(bosses);
    // Имя, HP, редкость и короткие особенности уже постоянно видны в Boss HUD.
    // При появлении босса остаётся только обычное компактное уведомление этажа.
    toast('ЭТАЖ ' + f);
  } else if (packAffixCount(f) > 0){
    // Пачка выходит на этажах без босса: два таких события в одной комнате
    // не читаются — игрок не поймёт, кто именно его убил.
    const pk = spawnPack(f);
    G.spawnQueue = Math.max(4, G.spawnQueue - pk.members.length);   // общее население этажа держим прежним
    toast('ЭТАЖ ' + f + '  ·  ПАЧКА  ·  ' + pk.nm);
  } else toast('ЭТАЖ ' + f);
}

/* Масштабирование сложности: бесконечное, но плавное.
   HP растёт на 18%, урон — на 11% за этаж. Обе цифры возводятся в степень
   этажа, поэтому после каждой правки обязательны замеры глубины и ваншотов. */
const hpScale  = f => Math.pow(1.18, f-1);
const dmgScale = f => Math.pow(1.11, f-1);

function spawnEnemy(kind, requestedBossType, requestedEliteVariant, requestedBossAffixCount){
  const f = G.floor;
  let t, typeKey = 'tank', elite = false, boss = false, bossId = null, bossDef = null;
  if (kind === 'boss'){
    boss = true; bossId = requestedBossType && BOSS_TYPES[requestedBossType] ? requestedBossType : rollBossType();
    bossDef = BOSS_TYPES[bossId];
    t = Object.assign({}, ETYPES.tank, {nm:bossDef.nm});
  }
  else if (kind==='pack' && requestedEliteVariant && ELITE_VARIANTS[requestedEliteVariant]){
    elite=true; typeKey=ELITE_VARIANTS[requestedEliteVariant].base; t=ETYPES[typeKey];
  }
  else if (kind && ETYPES[kind]){ typeKey = kind; t = ETYPES[typeKey]; }
  else {
    const pool = ['blob','blob','runner'];
    if (f >= 2) pool.push('shooter');
    if (f >= 3) pool.push('tank','runner');
    typeKey = pick(pool); t = ETYPES[typeKey];
    elite = kind === 'pack' || (f >= 3 && Math.random() < 0.10 + f*0.008);
  }
  const p = G.player;
  /* Точка появления. Было rnd(420,700) — на широком мониторе половина ширины
     экрана это 640, то есть враги проступали прямо на виду у игрока.
     Стало 650..950: на краю экрана и чуть за ним — видно, как подходят,
     но на голову не сваливаются. Проверенные 900..1250 давали десять секунд
     ходу и делали стрелковые классы вдвое живучее: половину волны успевали
     снять на подходе.

     Угол выбираем не случайно один раз, а лучшим из восьми: арена всего
     3000x3000, и у стены clamp() сплющивал бы все точки в край рядом с игроком.
     Берём тот из вариантов, который дальше всего от него. */
  let bx = 0, by = 0, bd = -1;
  for (let k = 0; k < 8; k++){
    const ang = rnd(0, Math.PI*2), rad = rnd(650, 950);
    const x = clamp(p.x + Math.cos(ang)*rad, -ARENA+40, ARENA-40);
    const y = clamp(p.y + Math.sin(ang)*rad, -ARENA+40, ARENA-40);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d > bd){ bd = d; bx = x; by = y; }
    if (d > 620) break;                       // достаточно далеко — не перебираем дальше
  }
  /* Страховка на угол арены. Если игрок вжат в угол, все восемь бросков могут
     уйти в ту же четверть и склеиться clamp() у него под ногами: замер ловил
     появление в 57 единицах. Тогда отправляем врага в сторону центра арены —
     это направление всегда свободно, потому что игрок стоит у края. */
  if (bd < 520){
    const a2 = Math.atan2(-p.y, -p.x) + rnd(-0.7, 0.7);
    bx = clamp(p.x + Math.cos(a2)*760, -ARENA+40, ARENA-40);
    by = clamp(p.y + Math.sin(a2)*760, -ARENA+40, ARENA-40);
  }
  const e = {
    t, typeKey, kind: boss?'boss':(elite?'elite':'norm'), bossId, bossT:{},
    x: bx, y: by,
    r: t.r * (boss?2.6:elite?1.45:1),
    hp:0, maxHp:0, spd:0, dmg:0, xp:0,
    cd: rnd(0.5,2), rot: rnd(0,6.28), hit:0, kb:{x:0,y:0}, attackVisual:null,
    spriteFace: bx < p.x ? 1 : -1, animT:rnd(0,4),
    ail:{chill:0, shock:0, stun:0, freeze:0, dizzy:0}, armor:0, infT:0,
    dots:{fire:{dps:0,minionDps:0,n:0,dur:3}, poison:{dps:0,minionDps:0,n:0,dur:4}, bleed:{dps:0,minionDps:0,n:0,dur:6}},
    dotAcc:{fire:0, poison:0, bleed:0}, dotT:0, orbCd:0,
    bloodPuddleRolled:false,bloodPuddleVariant:-1,bloodPuddleSize:0,
    plague:null,                              // отдельный процентный DoT от чумного взрыва
    aff:[], affT:{}, affNm:'', ward:null, wardCol:null, bulwark:0,   // аффиксы мини-босса
    pack:null, roles:[], dead:false, rage:0, noDmgT:0, r0:0, tauntMinion:null, // пачка / цель провокации
    jumpTo:null, jumpT:0, didSplit:false, noBreed:false, madT:0, madA:0,
  };
  const mul = boss ? 14 : elite ? 3.2 : 1;
  e.maxHp = e.hp = Math.round(t.hp * mul * hpScale(f) * ledgerEnemyHpMul() * (amu('invertedCrown')?1.15:1));
  e.mothBurns=[];
  // Boss HUD хранит прошлое здоровье в самом экземпляре: при двух боссах
  // светлые delayed-полосы обновляются независимо и не требуют DOM-состояния.
  if (boss){ e.hudHpLag=1; e.hudHpFrom=1; e.hudHpLast=1; e.hudHpTimer=0; }
  // spd в ETYPES — итоговая скорость в единицах/сек, без скрытого общего множителя.
  // Элита на 10% медленнее, а каждый ранее убитый босс добавляет всем следующим 2%.
  const bossBaseSpeed = bossDef && bossDef.spd === 'player' ? D.mspd : bossDef ? bossDef.spd : BOSS_SPEED;
  e.spd = (boss ? bossBaseSpeed : t.spd * (elite?0.9:1)) * (1 + G.bossKills*0.02);
  e.dmg = t.dmg * (boss?1.9:elite?1.3:1) * dmgScale(f);
  if (elite) applyEliteVariant(e,requestedEliteVariant);
  e.xp  = Math.round(t.xp * (boss?18:elite?4:1) * (1 + f*0.12));
  e.armor = elite||boss ? 8 + f*1.5 : 0;
  e.r0 = e.r;                            // исходный радиус: «безумные» его крутят
  if (boss) applyAffixes(e,f,requestedBossAffixCount); // панцирь режет уже готовое hp
  G.enemies.push(e);
  if (ACTIVE_ENEMY_LOGIC_GRID) addEnemyToSpatialGrid(ACTIVE_ENEMY_LOGIC_GRID,e);
  return e;
}
