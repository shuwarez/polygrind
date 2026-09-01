/* Взрыв при убийстве: шанс, защита цели, красное развитие и цепные убийства. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(66) + (det||''));
const near = (a,b,eps=1e-6) => Math.abs(a-b)<eps;

function build(random=()=>0, chance=0, strong=false){
  const c=loadGame('./GrimGrind.html',{random}); c.newGame('bow','keys');
  const G=c.__api.G; G.enemies.length=0;
  if (chance) G.bag.add('novaKill','chance',chance);
  if (strong) G.bag.add('novaKillStrong','flag',1);
  c.recalc();
  return {c,G,D:c.__api.D,base:c.__api.MODS.find(x=>x.id==='trig.on_kill'),
    strong:c.__api.MODS.find(x=>x.id==='trig.on_kill_strong')};
}
function foe(o,x,y=0,hp=1e9){
  const e=o.c.spawnEnemy('norm');
  e.typeKey='blob'; e.kind='norm'; e.x=x; e.y=y; e.hp=e.maxHp=hp;
  e.armor=0; e.bulwark=0; e.pack=null; e.noLoot=true;
  return e;
}
function blast(o,targetSetup){
  const source=foe(o,0,0,1), target=foe(o,50,0);
  if (targetSetup) targetSetup(target);
  const before=target.hp;
  o.c.killEnemy(source,o.G.enemies.indexOf(source));
  return {source,target,loss:before-target.hp};
}

console.log('Взрыв при убийстве');
{ const o=build();
  ok('базовая фиолетовая карточка даёт целые 6–12% с потолком 50%',
    o.base.kind==='chance' && o.base.rar===2 && o.base.int===true &&
    o.base.r[0]===6 && o.base.r[1]===12 && o.base.cap===50); }
{ const o=build();
  ok('бросок базовой карточки достигает обеих границ',
    o.c.rollModValue(o.base,()=>0)===6 && o.c.rollModValue(o.base,()=>0.999999)===12); }
{ const o=build(()=>0,47), v=o.c.rollModValue(o.base,()=>0.999999);
  ok('последняя базовая карточка обрезается ровно до 50%',
    v===3 && o.D.novaKillBase===47, 'выпало +'+v+'% при текущих 47%'); }
{ const a=build(()=>0,49), b=build(()=>0,50);
  ok('на 50% базовая карточка уходит, а красная открывается',
    !a.strong.show() && b.base.hide() && b.strong.show() &&
    b.strong.kind==='flag' && b.strong.rar===4 && b.strong.unlock===true); }
{ const o=build(()=>0,50);
  ok('новая красная ветка принудительно попадает в ближайшую раздачу',
    o.c.rollCards().some(m=>m.id==='trig.on_kill_strong')); }
{ const o=build(()=>0,50,true);
  ok('красная карточка выставляет 65% шанса и множитель урона 125%',
    o.D.novaKillBase===50 && o.D.novaKillChance===65 && near(o.D.novaKillDamage,1.25)); }
{ const proc=build(()=>0.499,50), miss=build(()=>0.5,50);
  const hit=blast(proc).loss, noHit=blast(miss).loss;
  ok('50% проверяются на каждом убийстве как независимая вероятность',
    hit>0 && near(noHit,0), '49,9 → '+Math.round(hit)+' урона · 50,0 → '+Math.round(noHit)); }
{ const o=build(()=>0,50);
  const got=blast(o,e=>{ e.armor=60; }).loss;
  const armored=o.c.mitigate(Object.assign(foe(o,900,0),{armor:60}),o.c.avgHit());
  ok('обычная вспышка наносит 100% среднего удара с защитой цели',
    near(got,armored) && near(armored,o.c.avgHit()*0.5),
    Math.round(o.c.avgHit())+' до брони → '+Math.round(got)+' после'); }
{ const o=build(()=>0,50,true), got=blast(o).loss;
  ok('сильная вспышка возвращает ровно 25% добавочного урона',
    near(got,o.c.avgHit()*1.25), Math.round(got)+' урона'); }
{ const o=build(()=>0,50,true);
  const source=foe(o,0,0,1), normal=foe(o,50,0), boss=foe(o,0,50);
  boss.kind='boss'; boss.bossId=null;
  o.c.killEnemy(source,o.G.enemies.indexOf(source));
  ok('сильный взрыв слегка расталкивает с сопротивлением класса цели',
    near(normal.kb.x,120) && near(normal.kb.y,0) && near(boss.kb.x,0) && near(boss.kb.y,12),
    'обычный '+Math.round(normal.kb.x)+' · босс '+Math.round(boss.kb.y)); }
{ const o=build(()=>0,50), hit=o.c.avgHit();
  const source=foe(o,0,0,1), middle=foe(o,100,0,hit*0.5), end=foe(o,190,0,hit*0.5);
  o.c.killEnemy(source,o.G.enemies.indexOf(source));
  const firstOnly=end.hp===end.maxHp && middle.hp<=0;
  o.c.killEnemy(middle,o.G.enemies.indexOf(middle));
  ok('убийство вспышкой может создать следующую вспышку',
    firstOnly && end.hp<=0, 'первая убила середину, вторая — дальнюю цель'); }
{ const o=build(); o.c.setLanguage('ru');
  ok('подсказки раскрывают шанс, защиту, цепь и красное развитие',
    o.base.tip.includes('6–12') && o.base.tip.includes('защиты') && o.base.tip.includes('следующую вспышку') &&
    o.strong.tip.includes('65%') && o.strong.tip.includes('125%') && o.strong.tip.includes('Отбрасывание')); }
