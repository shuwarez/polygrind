/* «Надёжный удар»: диапазон карточки, потолок, выход из пула и формула урона. */
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
function defense(normalDr=0){
  const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G;
  if (normalDr) G.bag.add('normalDr','inc',normalDr);
  c.recalc();
  return {c,G,D:c.__api.D,m:c.__api.MODS.find(x=>x.id==='def.normal_reduction')};
}

console.log('Надёжный удар');
{ const o=build();
  ok('обычная карточка даёт целые 5–15% с потолком 50%',
    o.m.nm==='Надёжный удар' && o.m.rar===undefined && o.m.int===true && o.m.r[0]===5 && o.m.r[1]===15 && o.m.cap===50); }
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
{ const o=build(), flat=o.c.__api.MODS.find(x=>x.id==='dmg.flat_all'), inc=o.c.__api.MODS.find(x=>x.id==='dmg.inc_all');
  ok('обе карточки урона ко всему имеют синюю редкость',
    flat.rar===1 && inc.rar===1 && flat.r[0]===3 && flat.r[1]===7); }
{ const o=build(), crit=o.c.__api.MODS.find(x=>x.id==='crit.multi');
  ok('синий множитель критического урона даёт от 2 до 7 к модификатору',
    crit.rar===1 && crit.r[0]===2 && crit.r[1]===7); }
{ const o=build(), speed=o.c.__api.MODS.find(x=>x.id==='spd.attack');
  ok('карточка скорости атаки даёт не меньше 5% и не больше 10%',
    speed.r[0]===5 && speed.r[1]===10); }
{ const o=build(), boss=o.c.__api.MODS.find(x=>x.id==='cond.vs_boss');
  ok('урон по боссам и элите даёт 5–15% за карточку',
    boss.r[0]===5 && boss.r[1]===15 && boss.nt.includes('5–15%')); }
{ const o=build(), boss=o.c.__api.MODS.find(x=>x.id==='cond.vs_boss');
  ok('бросок урона по боссам достигает обеих границ',
    o.c.rollModValue(boss,()=>0)===5 && o.c.rollModValue(boss,()=>1)===15); }
{ const o=build(), blast=o.c.__api.MODS.find(x=>x.id==='trig.on_kill');
  ok('Взрыв при убийстве переведён в фиолетовую редкость',
    blast.kind==='flag' && blast.rar===2 && blast.stat==='novaKill'); }

console.log('Урон при стоянии на месте');
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.while_still');
  ok('карточка даёт целые 10–15% без потолка',
    m.r[0]===10 && m.r[1]===15 && m.int===true && m.cap===undefined && !m.hide && m.noMin===true); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.while_still');
  ok('бросок урона с места достигает обеих границ',
    o.c.rollModValue(m,()=>0)===10 && o.c.rollModValue(m,()=>0.999999)===15); }
{ const o=build(), e=o.c.spawnEnemy(); o.G.bag.add('whStill','inc',137);
  o.G.player.stillT=0.6; const early=o.c.conditionalInc(e,{});
  o.G.player.stillT=0.61; const active=o.c.conditionalInc(e,{});
  ok('после 0,6 секунды весь накопленный бонус работает без потолка', early===0 && active===137,
    '0,60 сек: +'+early+'% · 0,61 сек: +'+active+'%'); }
{ const o=build(); o.c.setLanguage('ru');
  const m=o.c.__api.MODS.find(x=>x.id==='cond.while_still'), tip=o.c.detailedSkillTip(m,{m,val:'+12%'});
  ok('тултип объясняет задержку, диапазон и сложение',
    tip.includes('0,6 секунды') && tip.includes('10–15%') && tip.includes('без потолка') && tip.includes('11% + 14% = +25%')); }

console.log('Урон в движении');
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.while_moving');
  ok('карточка даёт целые 7–12% без потолка',
    m.r[0]===7 && m.r[1]===12 && m.int===true && m.cap===undefined && !m.hide); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.while_moving');
  ok('бросок урона в движении достигает обеих границ',
    o.c.rollModValue(m,()=>0)===7 && o.c.rollModValue(m,()=>0.999999)===12); }
{ const o=build(), e=o.c.spawnEnemy(); o.G.bag.add('whMove','inc',137);
  o.G.player.moving=false; const stopped=o.c.conditionalInc(e,{});
  o.G.player.moving=true; const moving=o.c.conditionalInc(e,{});
  ok('в движении весь накопленный бонус работает без потолка', stopped===0 && moving===137,
    'стоим: +'+stopped+'% · движемся: +'+moving+'%'); }
{ const o=build(); o.c.setLanguage('ru');
  const m=o.c.__api.MODS.find(x=>x.id==='cond.while_moving'), tip=o.c.detailedSkillTip(m,{m,val:'+9%'});
  ok('тултип объясняет условие, диапазон и сложение',
    tip.includes('клавишами или мышью') && tip.includes('7–12%') && tip.includes('без потолка') && tip.includes('8% + 11% = +19%')); }

console.log('Урон по раненым врагам');
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.vs_low_hp');
  ok('карточка даёт целые 3–7% без потолка',
    m.r[0]===3 && m.r[1]===7 && m.int===true && m.cap===undefined && !m.hide); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.vs_low_hp');
  ok('бросок урона по раненым достигает обеих границ',
    o.c.rollModValue(m,()=>0)===3 && o.c.rollModValue(m,()=>0.999999)===7); }
{ const o=build(), e=o.c.spawnEnemy();
  e.maxHp=1000; o.G.bag.add('vsLow','inc',17);
  e.hp=601; const above=o.c.conditionalInc(e,{});
  e.hp=600; const edge=o.c.conditionalInc(e,{});
  ok('ровно 60% HP уже считается раненым', above===0 && edge===17,
    '601 HP: +' + above + '% · 600 HP: +' + edge + '%'); }
{ const o=build(), e=o.c.spawnEnemy();
  e.maxHp=1000; e.hp=1; o.G.bag.add('vsLow','inc',137);
  ok('накопленный бонус выше 100% не ограничивается', o.c.conditionalInc(e,{})===137,
    '+' + o.c.conditionalInc(e,{}) + '%'); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.vs_low_hp');
  ok('тултип наглядно объясняет порог, диапазон и сложение',
    m.tip.includes('1000 HP') && m.tip.includes('600 HP') && m.tip.includes('3–7%') &&
    m.tip.includes('без потолка') && m.tip.includes('4% + 6% + 7% = +17%')); }

console.log('Урон по врагам на полном HP');
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.vs_full_hp');
  ok('карточка даёт целые 7–12% без потолка',
    m.r[0]===7 && m.r[1]===12 && m.int===true && m.cap===undefined && !m.hide); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.vs_full_hp');
  ok('бросок урона по полному HP достигает обеих границ',
    o.c.rollModValue(m,()=>0)===7 && o.c.rollModValue(m,()=>0.999999)===12); }
{ const o=build(), e=o.c.spawnEnemy();
  e.maxHp=e.hp=1000; o.G.bag.add('vsFull','inc',137);
  const full=o.c.conditionalInc(e,{}); e.hp=999; const damaged=o.c.conditionalInc(e,{});
  ok('накопление не ограничено, но после потери HP выключается', full===137 && damaged===0,
    'полное HP: +' + full + '% · 999 HP: +' + damaged + '%'); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.vs_full_hp');
  ok('тултип объясняет диапазон, сложение и первый удар',
    m.tip.includes('7–12%') && m.tip.includes('без потолка') &&
    m.tip.includes('8% + 11% = +19%') && m.tip.includes('100 в 109')); }

console.log('Урон после недавнего убийства');
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.recently_killed');
  ok('карточка даёт целые 3–7% без потолка',
    m.r[0]===3 && m.r[1]===7 && m.int===true && m.cap===undefined && !m.hide); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cond.recently_killed');
  ok('бросок бонуса после убийства достигает обеих границ',
    o.c.rollModValue(m,()=>0)===3 && o.c.rollModValue(m,()=>0.999999)===7); }
{ const o=build(), e=o.c.spawnEnemy();
  o.G.bag.add('afterKill','inc',137); o.G.player.killT=0.5;
  const active=o.c.conditionalInc(e,{}); o.G.player.killT=0;
  ok('активный накопленный бонус выше 100% не ограничивается', active===137 && o.c.conditionalInc(e,{})===0,
    '+' + active + '%'); }
{ const o=build(), p=o.G.player, e=o.c.spawnEnemy();
  o.c.killEnemy(e,o.G.enemies.indexOf(e)); const fresh=p.killT;
  o.G.enemies.length=0; o.G.spawnQueue=1; o.c.update(0.6); const active=p.killT;
  o.c.update(0.41);
  ok('убийство включает эффект ровно на одну секунду', fresh===1 && active>0.39 && active<0.41 && p.killT===0,
    fresh.toFixed(2)+' → '+active.toFixed(2)+' → '+p.killT.toFixed(2)); }
{ const o=build(), p=o.G.player, m=o.c.__api.MODS.find(x=>x.id==='cond.recently_killed');
  p.killT=0.15; const e=o.c.spawnEnemy(); o.c.killEnemy(e,o.G.enemies.indexOf(e));
  ok('повторное убийство обновляет таймер и тултип это объясняет', p.killT===1 &&
    m.tip.includes('3–7%') && m.tip.includes('без потолка') &&
    m.tip.includes('4% + 6% = +10%') && m.tip.includes('длительности не складываются')); }

console.log('Уникальное добивание');
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='dmg.execute');
  ok('ДОБИВАНИЕ — одна фиолетовая карточка-флаг',
    m.nm==='ДОБИВАНИЕ' && m.kind==='flag' && m.rar===2 && m.r[0]===1 && m.r[1]===1); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='dmg.execute');
  o.G.picks.push({id:m.id});
  let repeated=false;
  for (let i=0;i<100;i++) if (o.c.rollCards().some(x=>x.id===m.id)){ repeated=true; break; }
  ok('после выбора карточка больше не выпадает', !repeated); }
{ const exact=build(); exact.G.bag.add('execute','flag',1); exact.c.recalc();
  exact.D.baseMin=exact.D.baseMax=1;
  const e=exact.c.spawnEnemy(); e.kind='norm'; e.armor=0; e.maxHp=1000; e.hp=101;
  exact.c.damage(e,{noDouble:true});
  const above=build(); above.G.bag.add('execute','flag',1); above.c.recalc();
  above.D.baseMin=above.D.baseMax=1;
  const e2=above.c.spawnEnemy(); e2.kind='norm'; e2.armor=0; e2.maxHp=1000; e2.hp=102;
  above.c.damage(e2,{noDouble:true});
  ok('ровно 10% после слабого удара добивается, 10.1% живёт', e.hp<=0 && e2.hp>0,
    '100 HP: ' + (e.hp<=0?'добит':'жив') + ' · 101 HP: ' + (e2.hp<=0?'добит':'жив')); }
{ const o=build(); o.G.bag.add('execute','flag',1); o.c.recalc(); o.D.baseMin=o.D.baseMax=1;
  const elite=o.c.spawnEnemy(); elite.kind='elite'; elite.armor=0; elite.maxHp=1000; elite.hp=101;
  o.c.damage(elite,{noDouble:true});
  const boss=o.c.spawnEnemy('boss'); boss.armor=0; boss.maxHp=1000; boss.hp=101;
  o.c.damage(boss,{noDouble:true});
  ok('элита и боссы не добиваются на 10% HP', !elite.dead && !boss.dead,
    'элита ' + elite.hp.toFixed(0) + ' HP · босс ' + boss.hp.toFixed(0) + ' HP'); }
{ const o=build(); o.G.bag.add('execute','flag',1); o.c.recalc(); o.D.baseMin=o.D.baseMax=2;
  const e=o.c.spawnEnemy(); e.kind='norm'; e.armor=0; e.maxHp=1000; e.hp=101;
  o.c.damage(e,{minion:{},noDouble:true});
  ok('прямой удар свиты тоже запускает добивание', e.hp<=0); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='dmg.execute');
  ok('тултип объясняет 10%, обычных врагов и уникальность',
    m.tip.includes('ровно 10%') && m.tip.includes('1000') && m.tip.includes('100 HP') &&
    m.tip.includes('элиту и боссов') && m.tip.includes('повторно не выпадает')); }

console.log('Снижение урона от обычных монстров');
{ const o=defense();
  ok('карточка даёт целые 4–8% с потолком 25% без слова «случайно»',
    o.m.r[0]===4 && o.m.r[1]===8 && o.m.int===true && o.m.cap===25 && !o.m.nt.includes('Случайно')); }
{ const o=defense();
  ok('бросок карточки достигает 4% и 8%',
    o.c.rollModValue(o.m,()=>0)===4 && o.c.rollModValue(o.m,()=>0.999999)===8); }
{ const o=defense(23);
  ok('последняя карточка обрезается до остатка потолка', o.c.rollModValue(o.m,()=>0.999999)===2); }
{ const o=defense(40);
  ok('итог остаётся на потолке 25%, затем карта уходит', o.D.normalDr===25 && o.m.hide()===true); }

console.log('Шанс оглушения');
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cc.stun_chance');
  ok('синяя карточка даёт целые 3–5% с потолком 50%',
    m.rar===1 && m.r[0]===3 && m.r[1]===5 && m.int===true && m.cap===50); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cc.stun_chance');
  ok('бросок шанса оглушения достигает обеих границ',
    o.c.rollModValue(m,()=>0)===3 && o.c.rollModValue(m,()=>0.999999)===5); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cc.stun_chance');
  o.G.bag.add('stun','chance',48); o.c.recalc();
  ok('последняя карточка обрезается ровно до 50%', o.c.rollModValue(m,()=>0.999999)===2); }
{ const o=build(), m=o.c.__api.MODS.find(x=>x.id==='cc.stun_chance');
  o.G.bag.add('stun','chance',137); o.c.recalc();
  ok('механический шанс ограничен 50%, затем карта уходит', o.D.stun===50 && m.hide()===true); }
{ const c=loadGame('./PolyGrind.html',{random:()=>0}); c.newGame('bow','keys');
  const G=c.__api.G, D=c.__api.D, e=c.spawnEnemy();
  G.bag.add('stun','chance',50); c.recalc(); D.baseMin=D.baseMax=1; e.armor=0; e.maxHp=e.hp=1000;
  c.damage(e,{noDouble:true}); const base=e.ail.stun;
  G.bag.add('ailDur','inc',50); c.recalc(); e.ail.stun=0; c.damage(e,{noDouble:true});
  ok('оглушение длится 0,5 сек и масштабируется длительностью эффектов',
    near(base,0.5) && near(e.ail.stun,0.75), base.toFixed(2)+'с → '+e.ail.stun.toFixed(2)+'с'); }
{ const o=build(); o.c.setLanguage('ru');
  const m=o.c.__api.MODS.find(x=>x.id==='cc.stun_chance'), tip=o.c.detailedSkillTip(m,{m,v:4,val:'4%'});
  ok('тултип объясняет диапазон, длительность, потолок и пример',
    tip.includes('3–5') && tip.includes('0,5 секунды') && tip.includes('50%') &&
    tip.includes('4% + 5% = 9%') && tip.includes('0,75 секунды')); }
{ const o=build(); o.G.bag.add('stun','chance',13); o.c.recalc();
  const m=o.c.__api.MODS.find(x=>x.id==='cc.stun_chance'), data=o.c.cardImpactData(m,{m,v:4,val:'4%'});
  const row=data.rows.find(x=>x.key==='stat:stun');
  ok('динамическая подсказка показывает текущий и новый шанс',
    row && row.before===13 && row.after===17, row ? row.before+'% → '+row.after+'%' : 'нет строки'); }
