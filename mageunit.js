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
  ok('Мультипликатор сохраняет собственный бонус поверх общего', m===3,
     m + ' снаряда на 20-м уровне'); }
{ const c=loadGame('./PolyGrind.html');
  const mod=c.__api.MODS.find(m=>m.id==='shape.proj_count');
  ok('карточка дополнительных снарядов исключена из пула Мага',
     JSON.stringify(mod.wep)==='["proj"]' && mod.noMin===true,
     'доступ: ' + JSON.stringify(mod.wep)); }
{ const c=loadGame('./PolyGrind.html');
  const mod=c.__api.MODS.find(m=>m.id==='shape.proj_size');
  ok('карточка размера снарядов совместима только с Магом',
     JSON.stringify(mod.wep)==='["orb"]' && mod.nt==='только для Мага',
     'доступ: ' + JSON.stringify(mod.wep)); }
{ let seed=0x51a2b3c4;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const seen={};
  for (const cls of ['wand','bow','necro','blade']){
    const c=loadGame('./PolyGrind.html',{random}); c.newGame(cls,'keys',null);
    seen[cls]=false;
    for(let i=0;i<300;i++) if(c.rollCards().some(m=>m.id==='shape.proj_size')) seen[cls]=true;
  }
  ok('в раздачах размер снарядов появляется только у Мага',
     seen.wand && !seen.bow && !seen.necro && !seen.blade,
     JSON.stringify(seen)); }
{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys','hunter');
  c.__api.G.lvl=20; c.recalc();
  ok('общий бонус не распространяется на другие классы', c.__api.D.projN===1,
     c.__api.D.projN + ' снаряд у Лучника без карточек'); }
