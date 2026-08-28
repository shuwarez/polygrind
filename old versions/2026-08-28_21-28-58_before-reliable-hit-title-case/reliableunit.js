/* НАДЁЖНЫЙ УДАР: диапазон карточки, потолок, выход из пула и формула урона. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(62) + (det||''));
const near = (a,b,eps=1e-9) => Math.abs(a-b)<eps;

function build(hero='bow', narrow=0){
  const c=loadGame('./PolyGrind.html'); c.newGame(hero,'keys');
  const G=c.__api.G;
  if (narrow) G.bag.add('narrow','inc',narrow);
  c.recalc();
  return {c,G,D:c.__api.D,m:c.__api.MODS.find(x=>x.id==='dmg.range_narrow')};
}

console.log('НАДЁЖНЫЙ УДАР');
{ const o=build();
  ok('обычная карточка даёт целые 5–15% с потолком 50%',
    o.m.nm==='НАДЁЖНЫЙ УДАР' && o.m.rar===undefined && o.m.int===true && o.m.r[0]===5 && o.m.r[1]===15 && o.m.cap===50); }
{ const o=build('bow',47), value=o.c.rollModValue(o.m,()=>0.999);
  ok('последняя карточка обрезается ровно до остатка', value===3, 'выпало +' + value + '% при текущих 47%'); }
{ const o=build('bow',100);
  ok('recalc ограничивает бонус и карточка уходит из пула на 50%', o.D.narrow===50 && o.m.hide()===true); }
{ const heroes=['blade','bow','wand','necro'];
  const good=heroes.every(hero=>{
    const a=build(hero,0), min=a.D.baseMin, max=a.D.baseMax;
    const b=build(hero,50);
    return near(b.D.baseMax,max) && near(b.D.baseMin,min+(max-min)*.5) &&
           (b.D.baseMin+b.D.baseMax)/2 > (min+max)/2;
  });
  ok('у всех классов растёт только минимум, максимум не снижается', good); }
{ const o=build(), all=o.c.__api.MODS.find(x=>x.id==='dmg.inc_all');
  ok('+% ко всему урону имеет синюю редкость', all.rar===1); }
