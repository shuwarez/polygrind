/* Оранжевый «Обман смерти»: гарантированное спасение, баффы и минутный откат. */
const fs = require('fs');
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(60) + (det||''));

function fresh(random=()=>0.999999){
  const c=loadGame('./PolyGrind.html',{random}); c.newGame('bow','keys',null);
  const G=c.__api.G, p=G.player;
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.portal=null;
  const baseSpeed=c.__api.D.mspd;
  G.bag.add('cheat','flag',1); c.recalc();
  p.hp=c.__api.D.life;
  return {c,G,p,get D(){return c.__api.D},baseSpeed};
}
function trigger(o,ignoreDefense=true,selfBlast=false){
  o.p.hp=10; o.c.hurt(o.D.life*10,ignoreDefense,selfBlast,'ТЕСТОВЫЙ СМЕРТЕЛЬНЫЙ УДАР');
  return o;
}

{
  const c=loadGame('./PolyGrind.html'), m=c.__api.MODS.find(x=>x.id==='death.cheat');
  ok('каталог: оранжевый уникальный флаг «ОБМАН СМЕРТИ»',
    m.nm==='ОБМАН СМЕРТИ' && m.kind==='flag' && m.stat==='cheat' && m.rar===3 && m.r[0]===1 && m.r[1]===1);
  const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('оранжевый тир карточки связан с CSS r-key',
    /\.card\.r-key[^\n]*#b55a2a/.test(html) && /const rc = r => \['','r-rare','r-epic','r-key'/.test(html));
}

{
  const o=fresh(), m=o.c.__api.MODS.find(x=>x.id==='death.cheat');
  o.G.lvl=20; o.G.picks.push({id:m.id});
  let repeated=false;
  for(let i=0;i<300;i++) if(o.c.rollCards().some(x=>x.id===m.id)) repeated=true;
  ok('после выбора уникальная карточка больше не выпадает', !repeated);
}

{
  const o=trigger(fresh(()=>0.999999));
  ok('смертельный удар гарантированно оставляет ровно 1 HP', o.p.hp===1 && !o.G.over, o.p.hp+' HP');
  ok('срабатывание ставит 60 сек отката и 1 сек неуязвимости', o.p.cheatCd===60 && o.p.inv===1,
    o.p.cheatCd+'с / '+o.p.inv+'с');
}

{
  const variants=[[true,false],[false,false],[true,true]];
  const good=variants.every(([ignore,self])=>{ const o=trigger(fresh(),ignore,self); return o.p.hp===1 && o.p.cheatCd===60; });
  ok('спасение работает с защитой, без защиты и от своего урона', good);
}

{
  const o=fresh(); o.c.hurt(5,true,false,'НЕСМЕРТЕЛЬНЫЙ УДАР');
  ok('несмертельный урон не расходует способность', o.p.cheatCd===0 && o.p.cheatSpeedT===0 && o.p.hp===o.D.life-5);
}

{
  const o=trigger(fresh()), hp=o.p.hp; o.c.hurt(o.D.life*10,true,false,'ПОВТОРНЫЙ УДАР');
  ok('следующий удар полностью блокируется секундной неуязвимостью', o.p.hp===hp && !o.G.over);
}

{
  const o=trigger(fresh());
  ok('при срабатывании скорость движения увеличивается ровно на 50%',
    Math.abs(o.D.mspd/o.baseSpeed-1.5)<1e-9 && o.p.cheatSpeedT===1,
    o.baseSpeed.toFixed(1)+' → '+o.D.mspd.toFixed(1));
  o.c.update(0.5);
  const halfway=o.p.inv>0 && o.p.cheatSpeedT>0 && Math.abs(o.D.mspd/o.baseSpeed-1.5)<1e-9;
  o.c.update(0.5);
  ok('неуязвимость и ускорение заканчиваются ровно через секунду',
    halfway && o.p.inv===0 && o.p.cheatSpeedT===0 && Math.abs(o.D.mspd-o.baseSpeed)<1e-9);
}

{
  const o=trigger(fresh()); o.p.inv=0; o.p.hp=1;
  o.c.hurt(2,true,false,'УДАР НА ОТКАТЕ');
  ok('на перезарядке следующий смертельный удар убивает обычно', o.G.over && o.p.hp<=0);
}

{
  const o=trigger(fresh());
  for(let i=0;i<599;i++) o.c.update(0.1);
  const early=o.p.cheatCd>0;
  for(let i=0;i<2;i++) o.c.update(0.1);
  ok('повторное спасение становится готово только через минуту', early && o.p.cheatCd===0,
    'готовность после 60.1с');
}
