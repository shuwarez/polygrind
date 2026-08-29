/* Синяя магическая ветка «Арканная иллюзия»: пул, потолок и притяжение сфер. */
const {loadGame} = require('./sim');
const ok = (nm,cond,det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(68) + (det||''));
const near = (a,b,eps=1e-6) => Math.abs(a-b)<eps;

function build(strength=0){
  const c=loadGame('./PolyGrind.html',{random:()=>0.5}); c.newGame('wand','keys','multiplier');
  const G=c.__api.G; G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.shots.length=0;
  if (strength) G.bag.add('arcanePull','inc',strength);
  c.recalc();
  return {c,G,D:c.__api.D,mod:c.__api.MODS.find(m=>m.id==='shape.arcane_illusion')};
}
function foe(o,x,kind='norm',typeKey='blob'){
  const e=o.c.spawnEnemy('norm');
  e.x=x; e.y=0; e.kind=kind; e.typeKey=typeKey; e.hp=e.maxHp=1e9;
  e.armor=0; e.bulwark=0; e.spd=0; e.dmg=0; e.pack=null; e.noLoot=true;
  e.kb={x:0,y:0};
  return e;
}
function directPull(kind='norm',typeKey='blob'){
  const o=build(), e=foe(o,50,kind,typeKey);
  o.c.nova(0,0,100,0,'#fff',{pull:250,skipDead:true});
  return e.kb.x;
}
function orbResult(strength,mini=false){
  const o=build(strength), primary=foe(o,100), secondary=foe(o,130);
  o.c.spawnPlayerShot(o.G.player,0,o.G.weapon,mini);
  const shot=o.G.shots[0]; shot.x=primary.x; shot.y=0; shot.vx=shot.vy=0;
  const hp=secondary.hp; o.c.update(0);
  return {kb:secondary.kb.x,damage:hp-secondary.hp};
}

console.log('АРКАННАЯ ИЛЛЮЗИЯ');
{ const c=loadGame('./PolyGrind.html');
  ok('старая карточка размера снарядов отсутствует',
    !c.__api.MODS.some(m=>m.id==='shape.proj_size' || m.nm==='Размер снарядов')); }
{ const o=build();
  ok('новая карточка синяя, процентная и бросает целые 20–30%',
    o.mod && o.mod.rar===1 && o.mod.kind==='inc' && o.mod.stat==='arcanePull' &&
    o.mod.int===true && o.mod.r[0]===20 && o.mod.r[1]===30 && o.mod.cap===100); }
{ const o=build();
  const classes=Array.from(o.c.allowedClassesForMod(o.mod));
  ok('Арканная иллюзия доступна только Магу', classes.join(',')==='wand', classes.join(',')); }
{ const o=build();
  ok('без карточки сила притяжения равна нулю', o.D.arcanePull===0); }
{ const o=build(); o.G.bag.add('arcanePull','inc',25); o.G.bag.add('arcanePull','inc',30); o.c.recalc();
  ok('значения разных карточек складываются', o.D.arcanePull===55, o.D.arcanePull+'%'); }
{ const o=build(140);
  ok('фактическая сила жёстко ограничена 100%', o.D.arcanePull===100, o.D.arcanePull+'%'); }
{ const o=build(95), rolled=o.c.rollModValue(o.mod,()=>0.999999);
  ok('последний выбор обрезается ровно до остатка потолка', near(rolled,5), rolled+'%'); }
{ const below=build(99), capped=build(100);
  ok('на потолке карточка уходит из пула', !below.mod.hide() && capped.mod.hide()); }
ok('обычный враг получает полный импульс к центру', near(directPull(),-250), directPull().toFixed(0));
ok('Бегун сохраняет 30% сопротивления притяжению', near(directPull('norm','runner'),-175), directPull('norm','runner').toFixed(0));
ok('элита получает половину импульса', near(directPull('elite'),-125), directPull('elite').toFixed(0));
ok('босс получает только десятую часть импульса', near(directPull('boss'),-25), directPull('boss').toFixed(0));
{ const hit=orbResult(100,false);
  ok('реальный взрыв обычной сферы притягивает задетую цель', near(hit.kb,-250), hit.kb.toFixed(0)); }
{ const hit=orbResult(100,true);
  ok('взрыв мини-сферы Мультипликации тоже притягивает', near(hit.kb,-250), hit.kb.toFixed(0)); }
{ const base=orbResult(0,false), pulled=orbResult(100,false);
  ok('притяжение не меняет урон сферы', near(base.kb,0) && near(base.damage,pulled.damage),
    base.damage.toFixed(1)+' / '+pulled.damage.toFixed(1)); }
{ const o=build(100), e=foe(o,50);
  o.c.nova(0,0,100,0,'#fff',{overpressure:true,skipDead:true});
  ok('другие взрывы без явной метки не получают притяжение', near(e.kb.x,0)); }
{ const o=build();
  ok('описание фиксирует обе сферы, диапазон, потолок и сопротивления',
    o.mod.tip.includes('обычной или мини-сферы') && o.mod.tip.includes('20–30%') &&
    o.mod.tip.includes('100%') && o.mod.tip.includes('боссы 10%') && !/[А-Яа-яЁё]/.test(o.c.tr(o.mod.tip))); }
