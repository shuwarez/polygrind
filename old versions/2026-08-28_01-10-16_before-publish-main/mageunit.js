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
     all.length===3 && all.every(s=>s.desc.includes('+1 снаряд каждые 10 уровней'))); }

for (const [id,nm] of [['destroyer','Разрушитель'],['multiplier','Мультипликатор'],['elementalist','Элементалист']]){
  const n9=mage(id,9).D.projN, n10=mage(id,10).D.projN;
  ok(nm + ': общий бонус начинается ровно на 10-м уровне', n9===1 && n10===2,
     n9 + ' → ' + n10);
}

{ const d=mage('destroyer',20).D.projN, e=mage('elementalist',20).D.projN;
  ok('на 20-м Разрушитель и Элементалист получают общие +2', d===3 && e===3,
     d + ' / ' + e + ' снаряда'); }
{ const m=mage('multiplier',20).D.projN;
  ok('Мультипликатор сохраняет собственный бонус поверх общего', m===4,
     m + ' снаряда на 20-м уровне'); }
{ const m=mage('multiplier',20,2).D.projN;
  ok('карточки дополнительных снарядов также складываются сверху', m===6,
     m + ' снарядов с +2 от карточек'); }
{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys','hunter');
  c.__api.G.lvl=20; c.recalc();
  ok('общий бонус не распространяется на другие классы', c.__api.D.projN===1,
     c.__api.D.projN + ' снаряд у Лучника без карточек'); }
