/* Универсальные стихийные ветки: пул карт, потолки, статусы и эпические открытия. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(62) + (det||''));
const near = (a,b,eps=1e-6) => Math.abs(a-b) < eps;

function build(mods=[], random=()=>0){
  const c=loadGame('./PolyGrind.html',{random});
  c.newGame('bow','keys','hunter');
  const G=c.__api.G;
  for (const [stat,value,kind] of mods) G.bag.add(stat,kind||'chance',value);
  c.recalc();
  const D=c.__api.D;
  D.baseMin=D.baseMax=100; D.elem={fire:0,cold:0,lit:0,poi:0};
  D.incAll=0; D.moreAll=1; D.critCh=0; D.superCh=0; D.dblHit=0;
  D.onHit=0; D.onCrit=0; D.leech=0; D.knock=0;
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0;
  return {c,G,D};
}
function foe(o,x=80,y=0,hp=10000){
  const e=o.c.spawnEnemy();
  e.x=o.G.player.x+x; e.y=o.G.player.y+y; e.spd=0; e.dmg=0;
  e.kind='norm'; e.armor=0; e.ward=null; e.bulwark=0; e.maxHp=e.hp=hp;
  return e;
}
const modsById = o => Object.fromEntries(o.c.__api.MODS.map(m=>[m.id,m]));

console.log('СТИХИЙНЫЕ КАРТОЧКИ');
{ const o=build(), M=modsById(o);
  const ids=['ail.ignite.chance','ail.chill.chance','ail.shock.chance','ail.poison.chance'];
  ok('все четыре шанса обычные, целые 1–5% с потолком 25%', ids.every(id=>{
    const m=M[id]; return m.rar===undefined && m.int===true && m.r[0]===1 && m.r[1]===5 && m.cap===25;
  })); }
{ const o=build([['igniteCh',23]]), m=modsById(o)['ail.ignite.chance'];
  const v=o.c.rollModValue(m,()=>0.999);
  ok('последняя карточка обрезается ровно до потолка', v===2, 'выпало +' + v + '% при текущих 23%'); }
{ const o=build([['igniteCh',100],['chillCh',100],['shockCh',100],['poiCh',100]]);
  ok('recalc жёстко ограничивает все четыре шанса значением 25%',
    ['igniteCh','chillCh','shockCh','poiCh'].every(k=>o.D[k]===25)); }
{ const o=build(), M=modsById(o);
  const ids=['dt.fire.flat','dt.fire.inc','dt.cold.flat','dt.cold.inc','dt.lightning.flat','dt.lightning.inc','dt.poison.flat','dt.poison.inc'];
  ok('без карточки шанса весь соответствующий элементальный урон закрыт', ids.every(id=>M[id].show()===false)); }
{ const rows=[
    ['igniteCh','dt.fire.flat','dt.fire.inc'], ['chillCh','dt.cold.flat','dt.cold.inc'],
    ['shockCh','dt.lightning.flat','dt.lightning.inc'], ['poiCh','dt.poison.flat','dt.poison.inc']];
  const good=rows.every(([stat,flat,inc])=>{
    const o=build([[stat,1]]), M=modsById(o);
    return M[flat].show()===true && M[inc].show()===true;
  });
  ok('каждый шанс открывает только свою пару плоского и процентного урона', good); }
{ const o=build(), M=modsById(o);
  const flat=['dt.fire.flat','dt.cold.flat','dt.lightning.flat','dt.poison.flat'];
  const inc=['dt.fire.inc','dt.cold.inc','dt.lightning.inc','dt.poison.inc'];
  ok('плоский урон синий, процентный остаётся обычным',
    flat.every(id=>M[id].rar===1) && inc.every(id=>M[id].rar===undefined)); }
{ const o=build([['igniteCh',24],['chillCh',24],['shockCh',24],['poiCh',24]]), M=modsById(o);
  const ids=['ail.ignite.spread','ail.freeze.chance','ail.shock.tesla','ail.poison.radiation'];
  ok('четыре стихийных эпика ещё закрыты на 24%', ids.every(id=>M[id].show()===false)); }
{ const o=build([['igniteCh',25],['chillCh',25],['shockCh',25],['poiCh',25]]), M=modsById(o);
  const ids=['ail.ignite.spread','ail.freeze.chance','ail.shock.tesla','ail.poison.radiation'];
  ok('на 25% эпики лишь входят в случайный пул без гарантии',
    ids.every(id=>M[id].show()===true && M[id].rar===2 && M[id].unlock!==true)); }

console.log('ДЕЙСТВИЕ СТАТУСОВ');
{ const B=build().c.__api.ELEMENTAL_BALANCE;
  ok('базы охлаждения: 15% / 0,5 сек / 10% урона / 5% соседям',
    near(B.chillSlow,.15) && near(B.chillDuration,.5) && near(B.chillDamage,.10) && near(B.chillAuraSlow,.05)); }
{ const o=build([['igniteCh',25]]), e=foe(o); o.c.damage(e,{});
  ok('поджог: 20% полного удара в секунду на 3 секунды',
    near(e.dots.fire.dps,20) && near(e.dots.fire.dur,3), e.dots.fire.dps.toFixed(1) + '/сек'); }
{ const o=build(), e=foe(o), hp=e.hp;
  o.G.items.fire={tier:1,val:3}; o.G.items.cold={tier:1,val:3};
  o.c.__api.applyBookAilments(e,100,1,1,0);
  ok('книги огня и льда подчиняются общим правилам Поджога и Охлаждения',
    near(e.dots.fire.dps,20) && near(e.dots.fire.dur,3) && near(e.ail.chill,.5) && near(hp-e.hp,10)); }
{ const o=build([['chillCh',25]]), e=foe(o), hp=e.hp; o.c.damage(e,{});
  ok('охлаждение наносит отдельные 10% атаки и держится 0,5 сек',
    near(hp-e.hp,110) && near(e.ail.chill,.5), 'снято ' + (hp-e.hp).toFixed(1)); }
{ const o=build(), e=foe(o); e.ail.chill=1; const hp=e.hp; o.c.damage(e,{});
  ok('охлаждённая цель получает на 10% больше урона', near(hp-e.hp,110), 'снято ' + (hp-e.hp).toFixed(1)); }
{ const yes=build([['chillCh',25],['freeze',1,'flag']],()=>0.005), ey=foe(yes); yes.c.damage(ey,{});
  const no=build([['chillCh',25],['freeze',1,'flag']],()=>0.02), en=foe(no); no.c.damage(en,{});
  ok('ЗАМОРОЗКА делает отдельный 1% бросок и останавливает на 1 секунду',
    near(ey.ail.freeze,1) && en.ail.freeze===0, ey.ail.freeze + ' / ' + en.ail.freeze + ' сек'); }
{ const o=build(), e=foe(o); e.ail.chill=1; e.ail.freeze=1; const hp=e.hp; o.c.damage(e,{});
  ok('заморозка добавляет ещё ×1,10 поверх охлаждения', near(hp-e.hp,121), 'снято ' + (hp-e.hp).toFixed(1)); }
{ const o=build([['shockCh',25]]), main=foe(o,60,0), others=[];
  for(let i=0;i<20;i++) others.push(foe(o,90+i*8,(i%2)*20));
  o.c.damage(main,{});
  const hit=others.filter(e=>e.hp<e.maxHp), losses=hit.map(e=>e.maxHp-e.hp);
  ok('базовый разряд: максимум 5 соседей по 15% удара',
    hit.length===5 && losses.every(v=>near(v,15)), hit.length + ' целей'); }
{ const o=build([['shockCh',25]]), e=foe(o); o.c.damage(e,{});
  const dur=e.ail.shock; o.D.shockCh=0; const hp=e.hp; o.c.damage(e,{});
  ok('Шок держится 1 секунду и даёт цели +10% входящего урона', near(dur,1) && near(hp-e.hp,110)); }
{ const o=build([['shockCh',25],['tesla',1,'flag']]), main=foe(o,60,0), others=[];
  for(let i=0;i<24;i++) others.push(foe(o,90+i*8,(i%2)*20));
  o.c.damage(main,{});
  const hit=others.filter(e=>e.hp<e.maxHp), losses=hit.map(e=>e.maxHp-e.hp);
  ok('ТЕСЛА: максимум 20 соседей по 25% удара',
    hit.length===20 && losses.every(v=>near(v,25)), hit.length + ' целей'); }
{ const o=build([['poiCh',25]]), e=foe(o); o.c.damage(e,{});
  ok('обычный яд без изменений: 15% удара в секунду на 4 секунды',
    near(e.dots.poison.dps,15) && near(e.dots.poison.dur,4)); }
{ const o=build([['poiCh',25],['radiation',1,'flag']]), e=foe(o); o.c.damage(e,{});
  ok('РАДИАЦИЯ удваивает тик яда с 15% до 30%', near(e.dots.poison.dps,30), e.dots.poison.dps.toFixed(1) + '/сек'); }
