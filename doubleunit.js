/* Ветка двойного и смертоносного попадания: диапазон, потолок, анлок и процентный урон. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(58) + (det||''));

function mk(dbl=0, deadly=false){
  const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys','hunter');
  const G=c.__api.G;
  if (dbl) G.bag.add('dblHit','chance',dbl);
  if (deadly) G.bag.add('deadlyHit','flag',1);
  c.recalc();
  return {c,G,D:c.__api.D};
}

function plague(chance=0){
  const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys','hunter');
  const G=c.__api.G;
  if (chance) G.bag.add('explode','chance',chance);
  c.recalc();
  return {c,G,D:c.__api.D};
}

function neutralHit(deadly=true){
  const o=mk(25,deadly), {c,G,D}=o;
  const e=c.spawnEnemy(); G.enemies=[e]; G.spawnQueue=0;
  e.kind='norm'; e.armor=0; e.ward=null; e.bulwark=0; e.hp=e.maxHp=1000;
  D.baseMin=D.baseMax=100; D.elem={fire:0,cold:0,lit:0,poi:0};
  D.incAll=0; D.moreAll=1; D.critCh=0; D.minCrit=0; D.superCh=0;
  D.igniteCh=0; D.chillCh=0; D.poiCh=0; D.knock=0; D.onHit=0; D.onCrit=0; D.leech=0;
  G.stats.damage=0; G.stats.maxHit=0;
  return {...o,e};
}

{ const {c}=mk(), m=c.__api.MODS.find(x=>x.id==='shape.double_hit');
  ok('синяя карточка: 5–15%, целые значения, потолок 25%',
    m.rar===1 && m.r[0]===5 && m.r[1]===15 && m.int===true && m.cap===25); }

{ const {c}=mk(), m=c.__api.MODS.find(x=>x.id==='shape.double_hit');
  ok('бросок карточки достигает обоих границ',
    c.rollModValue(m,()=>0)===5 && c.rollModValue(m,()=>0.999999)===15); }

{ const {c,G}=mk(24), m=c.__api.MODS.find(x=>x.id==='shape.double_hit');
  ok('последняя карточка обрезается ровно до остатка',
    c.rollModValue(m,()=>0.999999)===1 && G.bag.flat('dblHit')===24); }

{ const {c,D}=mk(40), m=c.__api.MODS.find(x=>x.id==='shape.double_hit');
  ok('механический потолок 25%, после него карта уходит', D.dblHit===25 && m.hide()); }

{ const a=mk(24), b=mk(25);
  const da=a.c.__api.MODS.find(x=>x.id==='shape.deadly_hit');
  const db=b.c.__api.MODS.find(x=>x.id==='shape.deadly_hit');
  ok('смертоносное попадание открывается ровно на 25%',
    !da.show() && db.show() && db.kind==='flag' && db.rar===2 && db.unlock===true &&
    !b.c.__api.MODS.some(x=>x.id==='shape.triple_hit')); }

{ const {c}=mk(25);
  ok('свежий анлок гарантированно показан в следующей раздаче',
    c.rollCards().some(x=>x.id==='shape.deadly_hit')); }

{ const {c,G,e}=neutralHit(); const old=Math.random;
  try { Math.random=()=>0; c.damage(e,{noDouble:true}); }
  finally { Math.random=old; }
  ok('срабатывание: 100 урона, затем 25% от оставшихся 900 HP',
    Math.abs(e.hp-675)<1e-9 && Math.abs(G.stats.damage-325)<1e-9, 'HP '+e.hp); }

{ const {c,G,e}=neutralHit(); const old=Math.random;
  try { Math.random=()=>0.5; c.damage(e,{noDouble:true}); }
  finally { Math.random=old; }
  ok('без 1%-прока остаётся только обычный урон', e.hp===900 && G.stats.damage===100); }

{ const {c,G,e}=neutralHit(); c.applyDamage(e,100,false,false,0);
  ok('DoT-путь applyDamage() не бросает смертоносный шанс',
    e.hp===900 && G.stats.damage===100); }

{ const {c,e}=neutralHit(); const old=Math.random;
  try { Math.random=()=>0; c.damage(e,{noDouble:true,minion:{x:0,y:0,hp:100,max:100}}); }
  finally { Math.random=old; }
  // Удар свиты наносит 50 из-за MINION_DAMAGE_MULT, затем снимает 25% от 950.
  ok('каждая атака свиты тоже получает 1%-бросок', Math.abs(e.hp-712.5)<1e-9, 'HP '+e.hp); }

console.log('ЧУМНЫЙ ВЗРЫВ');
{ const {c}=plague(), m=c.__api.MODS.find(x=>x.id==='shape.explode_on_kill');
  ok('синяя карточка: 3–7%, целые значения, потолок 25%',
    m.rar===1 && m.r[0]===3 && m.r[1]===7 && m.int===true && m.cap===25); }
{ const {c,G}=plague(23), m=c.__api.MODS.find(x=>x.id==='shape.explode_on_kill');
  ok('последняя карточка чумы обрезается до остатка',
    c.rollModValue(m,()=>0.999999)===2 && G.bag.flat('explode')===23); }
{ const {c,D}=plague(100), m=c.__api.MODS.find(x=>x.id==='shape.explode_on_kill');
  ok('механический потолок чумного взрыва 25%, затем карта уходит', D.explode===25 && D.explodeBase===25 && m.hide()); }
{ const a=plague(24), b=plague(25);
  const ma=a.c.__api.MODS.find(x=>x.id==='shape.explode_mega');
  const mb=b.c.__api.MODS.find(x=>x.id==='shape.explode_mega');
  ok('МЕГА-чумной взрыв открывается на новом потолке 25%', !ma.show() && mb.show()); }
