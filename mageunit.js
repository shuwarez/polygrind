/* Общий рост числа снарядов всех подклассов Мага. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(58) + (det||''));

function mage(subclass, level, flat=0){
  const c = loadGame('./PolyGrind.html');
  c.newGame('wand','keys',subclass);
  const G = c.__api.G;
  G.lvl = level;
  if (flat) G.bag.add('projN','flat',flat);
  c.recalc();
  return {c,G,D:c.__api.D};
}

console.log('ОБЩИЕ СНАРЯДЫ МАГА');
{ const c=loadGame('./PolyGrind.html');
  const all=c.__api.SUBCLASSES.wand;
  ok('описания всех трёх подклассов сообщают общий бонус',
     all.length===3 && all.every(s=>s.desc.includes('+1 снаряд каждые 15 уровней'))); }

for (const [id,nm] of [['destroyer','Разрушитель'],['multiplier','Мультипликатор'],['elementalist','Элементалист']]){
  const n14=mage(id,14).D.projN, n15=mage(id,15).D.projN;
  ok(nm + ': общий бонус начинается ровно на 15-м уровне', n14===1 && n15===2,
     n14 + ' → ' + n15);
}

{ const d=mage('destroyer',30).D.projN, e=mage('elementalist',30).D.projN;
  ok('на 30-м Разрушитель и Элементалист получают общие +2', d===3 && e===3,
     d + ' / ' + e + ' снаряда'); }
{ const m=mage('multiplier',20).D.projN;
  ok('Мультипликатор больше не получает личный снаряд от уровня', m===2,
     m + ' снаряда на 20-м уровне'); }
{ const desc=loadGame('./PolyGrind.html').__api.SUBCLASSES.wand.find(s=>s.id==='multiplier').desc;
  ok('описание Мультипликации фиксирует задержку, шанс, урон и радиус',
     desc.includes('35% шанс') && desc.includes('через 0,1 сек') && desc.includes('−80% урона') && desc.includes('радиусом взрыва 60%')); }
{ const o=mage('multiplier',15), p=o.G.player; p.aim=0; o.G.shots.length=0;
  o.G.enemies.length=0; o.G.spawnQueue=0;
  const oldRandom=o.c.Math.random; o.c.Math.random=()=>0;
  o.c.attack(); o.c.Math.random=oldRandom;
  const mini=o.G.shots.filter(s=>s.miniOrb), normal=o.G.shots.filter(s=>!s.miniOrb);
  ok('35% proc после каждого шара только ставит мини-сферы в очередь',
     normal.length===2 && mini.length===0 && o.G.delayedShots.length===2,
     normal.length+' обычных + '+o.G.delayedShots.length+' в очереди');
  o.c.update(0.099);
  ok('до истечения 100 мс мини-сферы не существуют',
     !o.G.shots.some(s=>s.miniOrb) && o.G.delayedShots.length===2);
  o.c.update(0.001);
  const fired=o.G.shots.filter(s=>s.miniOrb);
  ok('ровно через 100 мс вылетают ослабленные мини-сферы',
     fired.length===2 && !o.G.delayedShots.length && fired.every(s=>s.attackMul===0.20 && s.aoeScale===0.60 && Math.abs(s.r/normal[0].r-0.60)<1e-9),
     fired.length+' мини · '+Math.round(o.D.multiplierMiniDelay*1000)+' мс'); }
{ const o=mage('multiplier',1), p=o.G.player; p.aim=0.73; o.G.shots.length=0; o.G.enemies.length=0;
  const oldRandom=o.c.Math.random; o.c.Math.random=()=>0; o.c.attack(); o.c.Math.random=oldRandom;
  p.x+=18; p.y-=7; o.c.update(0.1);
  const mini=o.G.shots.find(s=>s.miniOrb);
  ok('отложенная сфера сохраняет направление и вылетает из текущей позиции Мага',
     mini && Math.abs(mini.a-0.73)<1e-9 && Math.abs(mini.x-(p.x+mini.vx*0.1))<1e-6 && Math.abs(mini.y-(p.y+mini.vy*0.1))<1e-6); }
{ const miss=mage('multiplier',1), other=mage('elementalist',1);
  miss.G.player.aim=other.G.player.aim=0; miss.G.shots.length=other.G.shots.length=0;
  const oldRandom=miss.c.Math.random;
  miss.c.Math.random=()=>0.35; miss.c.attack();
  miss.c.Math.random=()=>0; other.c.attack(); miss.c.Math.random=oldRandom;
  ok('граница 35% и другие подклассы не создают мини-сферу',
     !miss.G.shots.some(s=>s.miniOrb) && !other.G.shots.some(s=>s.miniOrb) &&
     !miss.G.delayedShots.length && !other.G.delayedShots.length); }
{ const impact=miniOrb=>{
    const c=loadGame('./PolyGrind.html',{random:()=>0.05}); c.newGame('wand','keys','multiplier');
    const G=c.__api.G, D=c.__api.D, p=G.player;
    G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.shots.length=0; p.aim=0;
    c.attack();
    let shot=G.shots.find(s=>!!s.miniOrb===miniOrb);
    if (miniOrb){ G.shots.length=0; c.update(0.1); shot=G.shots.find(s=>s.miniOrb); }
    G.shots=[shot];
    const e=c.spawnEnemy(); e.maxHp=e.hp=1e9; e.spd=0; e.dmg=0;
    e.x=p.x+100; e.y=p.y; shot.x=e.x; shot.y=e.y; shot.vx=shot.vy=0; G.fx.length=0;
    const before=e.hp; c.update(0);
    const ring=G.fx.find(f=>f.t==='ring');
    return {damage:before-e.hp,radius:ring&&ring.max,baseRadius:G.weapon.aoe*D.aoeR};
  };
  const normal=impact(false), mini=impact(true);
  ok('мини-сфера реально наносит 20% урона и взрывается на 60% радиуса',
     Math.abs(mini.damage/normal.damage-0.20)<1e-6 && Math.abs(mini.radius/normal.radius-0.60)<1e-9,
     (mini.damage/normal.damage*100).toFixed(0)+'% урона · '+(mini.radius/normal.radius*100).toFixed(0)+'% радиуса'); }
{ const c=loadGame('./PolyGrind.html');
  const mod=c.__api.MODS.find(m=>m.id==='shape.proj_count');
  ok('карточка дополнительных снарядов исключена из пула Мага',
     JSON.stringify(mod.wep)==='["proj"]' && mod.noMin===true,
     'доступ: ' + JSON.stringify(mod.wep)); }
{ const c=loadGame('./PolyGrind.html');
  const mod=c.__api.MODS.find(m=>m.id==='shape.proj_size');
  ok('карточка размера снарядов полностью удалена из каталога', !mod); }
{ let seed=0x51a2b3c4;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const seenSize={}, seenIllusion={};
  for (const cls of ['wand','bow','necro','blade']){
    const c=loadGame('./PolyGrind.html',{random}); c.newGame(cls,'keys',null);
    seenSize[cls]=false; seenIllusion[cls]=false;
    for(let i=0;i<300;i++) for (const m of c.rollCards()){
      if(m.id==='shape.proj_size') seenSize[cls]=true;
      if(m.id==='shape.arcane_illusion') seenIllusion[cls]=true;
    }
  }
  ok('в раздачах размер исчез, а Арканная иллюзия появляется только у Мага',
     !Object.values(seenSize).some(Boolean) && seenIllusion.wand && !seenIllusion.bow && !seenIllusion.necro && !seenIllusion.blade,
     JSON.stringify({size:seenSize,illusion:seenIllusion})); }
{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys','hunter');
  c.__api.G.lvl=20; c.recalc();
  ok('общий бонус не распространяется на другие классы', c.__api.D.projN===1,
     c.__api.D.projN + ' снаряд у Лучника без карточек'); }

console.log('НОВЫЕ ВЕТКИ МАГА');
function arena(random=()=>0.99){
  const c=loadGame('./PolyGrind.html',{random}); c.newGame('wand','keys','elementalist');
  const G=c.__api.G;
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.shots.length=0; G.fx.length=0; G.arcaneTraces.length=0;
  return {c,G,get D(){return c.__api.D}};
}
function add(o,stat,kind,value){ o.G.bag.add(stat,kind,value); o.c.recalc(); }
function foe(o,x,y){
  const e=o.c.spawnEnemy(); e.maxHp=e.hp=1e9; e.spd=0; e.dmg=0; e.x=x; e.y=y; return e;
}
function orbAt(o,x=0,y=0,travel=0,attackMul=1){
  return {x,y,travel,attackMul,aoeScale:1,orb:true};
}

{ const c=loadGame('./PolyGrind.html'), ids=['mage.blast_heart','mage.elemental_explosion','mage.residual_arcana','mage.overheated_orb','mage.remote_detonation'];
  const mods=ids.map(id=>c.__api.MODS.find(m=>m.id===id));
  ok('каталог содержит все пять новых карточек Мага', mods.every(Boolean) && mods.every(m=>m.wep[0]==='orb' && m.noMin));
  ok('четыре базовые карты обычные, Элементальный взрыв красный',
     mods.filter(m=>m.id!=='mage.elemental_explosion').every(m=>!m.rar) && mods[1].rar===2 && mods[1].unlock===true); }
{ const o=arena(), red=o.c.__api.MODS.find(m=>m.id==='mage.elemental_explosion');
  add(o,'blastHeart','inc',49); const before=red.show(); add(o,'blastHeart','inc',1); const at=red.show();
  ok('Элементальный взрыв открывается ровно на 50% Сердца', !before && at, '49% → 50%'); }
{ const o=arena(), radius=o.G.weapon.aoe*o.D.aoeR;
  add(o,'blastHeart','inc',50);
  const inner=foe(o,radius*0.25,0), outer=foe(o,radius*0.75,0);
  o.c.explodePlayerOrb(orbAt(o));
  const di=1e9-inner.hp, dout=1e9-outer.hp;
  ok('Сердце усиливает только внутреннюю половину взрыва', Math.abs(di/dout-1.5)<1e-6,
     (di/dout).toFixed(2)+'×'); }
{ const plain=arena(), heart=arena(); add(heart,'blastHeart','inc',80);
  const ep=foe(plain,0,0), eh=foe(heart,0,0);
  plain.c.damage(ep,{mul:1}); heart.c.damage(eh,{mul:1});
  ok('Сердце взрыва не усиливает прямое попадание', Math.abs(ep.hp-eh.hp)<1e-9); }
{ const base=arena(()=>0.15), red=arena(()=>0.15);
  for (const o of [base,red]) for (const stat of ['igniteCh','chillCh','shockCh','poiCh']) add(o,stat,'flat',10);
  add(red,'elementalExplosion','flag',1);
  const eb=foe(base,0,0), er=foe(red,0,0);
  base.c.explodePlayerOrb(orbAt(base)); red.c.explodePlayerOrb(orbAt(red));
  const active=e=>e.dots.fire.dps>0 && e.ail.chill>0 && e.ail.shock>0 && e.dots.poison.dps>0;
  ok('Элементальный взрыв удваивает четыре текущих шанса только у взрыва', !active(eb) && active(er)); }
{ const o=arena(); add(o,'residualArcana','inc',10);
  const e=foe(o,0,0); o.c.explodePlayerOrb(orbAt(o)); const trace=o.G.arcaneTraces[0];
  ok('Остаточная аркана создаёт след на 0,5 сек с долей урона сферы',
     trace && trace.life===0.5 && Math.abs(trace.dmg-o.c.avgHit()*0.10)<1e-9 && trace.hitSet.includes(e));
  const hp=e.hp; o.c.tickArcaneTraces(0.1); o.c.tickArcaneTraces(0.1);
  ok('один след не наносит одной цели повторный тик', e.hp===hp);
  const late=foe(o,trace.r+100,0), before=late.hp; late.x=trace.r*0.5; o.c.tickArcaneTraces(0.1); const once=before-late.hp;
  late.x=trace.r+100; o.c.tickArcaneTraces(0.05); late.x=0; o.c.tickArcaneTraces(0.05);
  ok('вошедший в след враг получает ровно один отложенный тик', Math.abs(once-trace.dmg)<1e-6 && Math.abs((before-late.hp)-once)<1e-6);
  o.c.tickArcaneTraces(0.2);
  ok('след удаляется после суммарных 0,5 секунды', o.G.arcaneTraces.length===0); }
{ const two=arena(); add(two,'overheatedOrb','inc',10); const r=two.G.weapon.aoe*two.D.aoeR;
  foe(two,r*0.2,0); foe(two,-r*0.2,0); two.c.explodePlayerOrb(orbAt(two));
  ok('два врага не запускают Перегретую сферу', two.G.player.overheatedPct===0 && two.G.player.overheatedT===0); }
{ const o=arena(); add(o,'overheatedOrb','inc',10); const base=o.D.aspd, r=o.G.weapon.aoe*o.D.aoeR;
  foe(o,r*0.2,0); foe(o,-r*0.2,0); foe(o,0,r*0.2); o.c.explodePlayerOrb(orbAt(o));
  ok('три врага дают карточный бонус на 1,5 секунды', o.G.player.overheatedPct===10 && o.G.player.overheatedT===1.5 && Math.abs(o.D.aspd/base-1.1)<1e-9);
  o.G.player.overheatedT=0.2; o.c.explodePlayerOrb(orbAt(o));
  ok('повторный взрыв складывает скорость и обновляет, не прибавляет таймер', o.G.player.overheatedPct===20 && o.G.player.overheatedT===1.5);
  for(let i=0;i<40;i++) o.c.triggerOverheatedOrb();
  ok('боевой стек Перегретой сферы ограничен +300%', o.G.player.overheatedPct===300);
  o.G.enemies.length=0; o.G.shots.length=0; o.c.update(1.5);
  ok('по окончании таймера стек и множитель скорости сбрасываются', o.G.player.overheatedPct===0 && o.G.player.overheatedT===0 && Math.abs(o.D.aspd-base)<1e-9); }
{ const near=arena(), far=arena(); add(near,'remoteBlast','inc',20); add(far,'remoteBlast','inc',20);
  const en=foe(near,0,0), ef=foe(far,0,0);
  near.c.explodePlayerOrb(orbAt(near,0,0,250)); far.c.explodePlayerOrb(orbAt(far,0,0,250.001));
  const dn=1e9-en.hp, df=1e9-ef.hp;
  ok('Дальний подрыв и фиолетовая отрисовка делят строгую границу «больше 250»',
     !near.c.remoteOrbActive(orbAt(near,0,0,250)) && far.c.remoteOrbActive(orbAt(far,0,0,250.001)) && Math.abs(df/dn-1.2)<1e-6,
     (df/dn).toFixed(2)+'×'); }
{ const o=arena(), farOrb=orbAt(o,0,0,400);
  ok('без Дальнего подрыва даже дальняя сфера остаётся синей',
     o.D.remoteBlast===0 && !o.c.remoteOrbActive(farOrb)); }
{ const o=arena(); o.G.player.aim=0; o.c.attack(); const s=o.G.shots[0], speed=Math.hypot(s.vx,s.vy); o.c.update(0.2);
  ok('сфера накапливает фактически пройденный путь', Math.abs(s.travel-speed*0.2)<1e-6, s.travel.toFixed(1)); }
{ const o=mage('multiplier',1), p=o.G.player; p.aim=0; o.G.shots.length=0; o.G.enemies.length=0; o.G.spawnQueue=0;
  const oldRandom=o.c.Math.random; o.c.Math.random=()=>0; o.c.attack(); o.c.Math.random=oldRandom;
  const parent=o.G.shots.find(s=>!s.miniOrb); parent.travel=400; o.c.update(0.1);
  const mini=o.G.shots.find(s=>s.miniOrb);
  ok('мини-сфера начинает собственный счётчик дистанции с нуля', mini && mini.travel>0 && mini.travel<250 && parent.travel>400,
     mini && mini.travel.toFixed(1)); }
