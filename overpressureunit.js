/* Синее «Сверхдавление»: источники, единая формула и границы настоящих взрывов. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(66) + (det||''));
const near = (a,b,eps=1e-6) => Math.abs(a-b)<eps;

function build(weapon='bow', mods=[], amus=[]){
  const c=loadGame('./GrimGrind.html',{random:()=>0}); c.newGame(weapon,'keys',null);
  const G=c.__api.G; G.enemies.length=0; G.spawnQueue=0; G.packs.length=0;
  for (const [stat,kind,value] of mods) G.bag.add(stat,kind,value);
  for (const id of amus) G.amu[id]=true;
  c.recalc();
  return {c,G,D:c.__api.D,mod:c.__api.MODS.find(m=>m.id==='shape.overpressure')};
}
function foe(o,x,y=0,hp=1e9){
  const e=o.c.spawnEnemy('norm');
  e.typeKey='blob'; e.kind='norm'; e.x=x; e.y=y; e.hp=e.maxHp=hp;
  e.armor=0; e.bulwark=0; e.pack=null; e.noLoot=true; e.spd=0; e.dmg=0;
  return e;
}
function novaDamage(count, enabled=true, tagged=true){
  const o=build('bow',enabled?[['overpressure','flag',1]]:[]);
  const targets=[];
  for(let i=0;i<count;i++) targets.push(foe(o,20+i*2));
  const before=targets.map(e=>e.hp);
  o.c.nova(0,0,100,100,'#fff',tagged?{overpressure:true,skipDead:true}:{skipDead:true});
  return targets.map((e,i)=>before[i]-e.hp);
}

console.log('Сверхдавление');
{ const o=build('wand');
  ok('карточка синяя, уникальная и хранится как флаг',
    o.mod && o.mod.rar===1 && o.mod.kind==='flag' && o.mod.stat==='overpressure'); }
{ const mage=build('wand'), bow=build('bow');
  ok('Маг видит карточку сразу благодаря базовому взрыву сферы', mage.mod.show()===true);
  ok('без источника уронного взрыва карточка не засоряет пул', bow.mod.show()===false); }
{ const kill=build('bow',[['novaKill','chance',6]]), retal=build('blade',[['retal','flag',1]]),
        minion=build('necro',[['minBoom','flag',1]]), well=build('bow',[],['gravity']);
  ok('карточку открывают взрыв при убийстве, ответный взрыв, свита и колодец',
    kill.mod.show() && retal.mod.show() && minion.mod.show() && well.mod.show()); }
{ const o=build('wand'); o.G.picks.push({id:o.mod.id});
  let duplicate=false;
  for(let i=0;i<100;i++) if(o.c.rollCards().some(m=>m.id===o.mod.id)) duplicate=true;
  ok('после выбора уникальный флаг больше не выпадает', !duplicate); }
{ const d1=novaDamage(1)[0], d2=novaDamage(2), d6=novaDamage(6), d9=novaDamage(9);
  ok('одна цель не получает бонус', near(d1,100), Math.round(d1)+' урона');
  ok('две цели получают по +5%', d2.every(v=>near(v,105)), d2.map(Math.round).join(' / '));
  ok('шесть целей получают предельные +25%', d6.every(v=>near(v,125)), Math.round(d6[0])+' урона');
  ok('после шести целей множитель остаётся ×1,25', d9.every(v=>near(v,125)), Math.round(d9[0])+' урона'); }
{ const o=build('bow',[['overpressure','flag',1]]), inside=foe(o,20), outside=foe(o,500);
  const a=inside.hp,b=outside.hp;
  o.c.nova(0,0,100,100,'#fff',{overpressure:true,skipDead:true});
  ok('враг за радиусом не считается дополнительной целью', near(a-inside.hp,100) && near(b-outside.hp,0)); }
{ const plain=novaDamage(6,true,false);
  ok('ударная волна без метки взрыва бонуса не получает', plain.every(v=>near(v,100))); }
{ const off=novaDamage(6,false,true);
  ok('без карточки помеченный взрыв сохраняет прежний урон', off.every(v=>near(v,100))); }
{ const orbBlast = enabled => {
    const o=build('wand',enabled?[['overpressure','flag',1]]:[]), p=o.G.player;
    const primary=foe(o,0), secondary=foe(o,24);
    for(let i=0;i<4;i++) foe(o,30+i*6);
    o.G.shots=[{x:0,y:0,vx:0,vy:0,r:9,life:1,mul:1,attackMul:1,hitSet:[],orb:true,chain:0,pierce:0,pierced:0}];
    const before=secondary.hp; o.c.update(0);
    return {loss:before-secondary.hp, direct:primary.maxHp-primary.hp, avg:o.c.avgHit()};
  };
  const base=orbBlast(false), boosted=orbBlast(true);
  ok('реальный взрыв сферы получает ×1,25 при шести целях', near(boosted.loss/base.loss,1.25),
    base.loss.toFixed(1)+' → '+boosted.loss.toFixed(1));
  ok('прямое попадание сферы не умножается Сверхдавлением', near(boosted.direct-base.direct,base.loss*0.25),
    'разница — только усиленная взрывная часть'); }
{ const blinkDamage = count => {
    const o=build('necro',[['minBlink','flag',1],['overpressure','flag',1]]);
    const m={x:0,y:0,r:10,hp:100,max:100,blinkT:0,kind:'skeleton',hitN:0}; o.G.minions=[m];
    const targets=[]; for(let i=0;i<count;i++) targets.push(foe(o,400,Math.max(0,i)*12));
    const before=targets[0].hp; o.c.minionBlink(m,targets[0],1/60);
    return before-targets[0].hp;
  };
  const one=blinkDamage(1), two=blinkDamage(2);
  ok('Внезапный взрыв свиты использует ту же формулу целей', near(two/one,1.05),
    one.toFixed(1)+' → '+two.toFixed(1)); }
{ const frenzyDamage = count => {
    const o=build('necro',[['minFrenzy','flag',1],['overpressure','flag',1]]);
    const m={x:0,y:0,r:10,hp:100,max:100,kind:'skeleton',hitN:0}; o.G.minions=[m];
    const primary=foe(o,20), targets=[];
    for(let i=0;i<count;i++) targets.push(foe(o,24+i*10));
    const before=targets[0].hp; o.c.minionHit(primary,m);
    return before-targets[0].hp;
  };
  const one=frenzyDamage(1), two=frenzyDamage(2);
  ok('Буйство демонов считает только реально задетые взрывом цели', near(two/one,1.05),
    one.toFixed(1)+' → '+two.toFixed(1)); }
{ const o=build('wand'); o.c.setLanguage('ru');
  ok('подсказка перечисляет формулу, предел и исключения',
    o.mod.tip.includes('6 и больше = ×1,25') && o.mod.tip.includes('Внезапным взрывом') &&
    o.mod.tip.includes('ударными волнами') && o.mod.tip.includes('чумным взрывом')); }
