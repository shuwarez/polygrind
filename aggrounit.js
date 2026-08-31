/* Агро Некроманта: Голем крови провоцирует только своим прямым ударом. */
const {loadGame}=require('./sim');
const fs=require('fs');
let n=0,fail=0;
const ok=(name,cond,detail='')=>{n++;if(!cond)fail++;console.log((cond?'  ✓ ':'  ✗ ')+name.padEnd(86)+detail);};
function fresh(random=()=>0.5){const c=loadGame('./PolyGrind.html',{random});c.newGame('necro','keys');const G=c.__api.G;G.enemies=[];G.minions=[];G.spawnQueue=0;G.packs=[];G.weapon.noAttack=true;G.player.x=G.player.y=0;G.player.inv=999;return{c,G,D:c.__api.D,p:G.player};}
function minion(kind,x=300,y=0,hp=1000){return{kind,x,y,r:kind==='golemB'?22:10,hp,max:hp,dead:false,tgt:null,cd:99,rot:0,hit:0,born:1,deathT:1e9,slowT:0,slowMul:1,stunT:0,animT:0,spriteFace:1,hitN:0};}
function foe(o,x=200,y=0){const e=o.c.spawnEnemy('blob');e.x=x;e.y=y;e.spd=100;e.dmg=0;e.hp=e.maxHp=1e9;e.dead=false;e.armor=0;e.ward=null;e.bulwark=0;e.roles=[];e.cd2=0;return e;}
function movedWithoutHit(kind,role=null,minionX=300){const o=fresh(),m=minion(kind,minionX),e=foe(o);o.G.minions=[m];e.roles=role?[role]:[];o.c.update(0.1);return{...o,m,e};}

{
  for(const kind of ['skeleton','bombardier','golemN']){
    const o=fresh(()=>0),m=minion(kind),e=foe(o);o.G.minions=[m];
    ok(kind+' не может вызвать врождённую провокацию Голема крови',!o.c.rollBloodGolemTaunt(e,m)&&e.tauntMinion===null);
  }
  const deadEnemy=fresh(()=>0),g1=minion('golemB'),e1=foe(deadEnemy);deadEnemy.G.minions=[g1];e1.dead=true;
  ok('мёртвый монстр не получает провокацию',!deadEnemy.c.rollBloodGolemTaunt(e1,g1)&&e1.tauntMinion===null);
  const deadGolem=fresh(()=>0),g2=minion('golemB',300,0,0),e2=foe(deadGolem);deadGolem.G.minions=[g2];
  ok('мёртвый Голем крови не может провоцировать',!deadGolem.c.rollBloodGolemTaunt(e2,g2)&&e2.tauntMinion===null);
  const removed=fresh(()=>0),g3=minion('golemB'),e3=foe(removed);
  ok('удалённый из свиты Голем крови не может провоцировать',!removed.c.rollBloodGolemTaunt(e3,g3)&&e3.tauntMinion===null);
}

{
  const yes=fresh(()=>0.499999),g=minion('golemB'),e=foe(yes);yes.G.minions=[g];
  ok('бросок 0,499999 срабатывает',yes.c.rollBloodGolemTaunt(e,g));
  ok('успех запоминает именно ударившего Голема крови',e.tauntMinion===g);
  ok('успех создаёт визуальное кольцо провокации',yes.G.fx.some(x=>x.t==='ring'&&x.col==='#d4506a'&&x.x===g.x));
  const no=fresh(()=>0.5),g2=minion('golemB'),e2=foe(no);no.G.minions=[g2];
  ok('ровно 0,5 уже не срабатывает: вероятность составляет 50%',!no.c.rollBloodGolemTaunt(e2,g2)&&e2.tauntMinion===null);
}

{
  ok('без удара враг идёт к игроку мимо близкого скелета',movedWithoutHit('skeleton').e.x<200);
  ok('без удара враг идёт к игроку мимо близкого бомбардира',movedWithoutHit('bombardier').e.x<200);
  ok('без удара враг идёт к игроку мимо Костяного голема',movedWithoutHit('golemN').e.x<200);
  ok('близкий Голем крови без удара не отвлекает врага',movedWithoutHit('golemB').e.x<200);
  ok('роль Охотник не создаёт пассивное аггро Голема крови',movedWithoutHit('golemB','hunter').e.x<200);
}

{
  const o=fresh(),g=minion('golemB',300),e=foe(o);o.G.minions=[g];e.tauntMinion=g;o.c.update(0.1);
  ok('после успешного удара враг идёт к Голему крови',e.x>200);
  e.x=200;g.x=900;o.c.update(0.1);
  ok('аггро после удара сохраняется без прежнего ограничения радиусом',e.x>200&&e.tauntMinion===g);
  e.x=200;g.x=300;o.c.update(0.1);
  ok('успешная провокация сохраняется между кадрами',e.x>200&&e.tauntMinion===g);
  g.hp=0;e.x=200;o.c.update(0.1);
  ok('после смерти Голема крови враг возвращается к Некроманту',e.x<200&&e.tauntMinion===null);
  const g2=minion('golemB',300);e.x=200;e.tauntMinion=g2;o.G.minions=[];o.c.update(0.1);
  ok('после удаления Голема крови враг возвращается к Некроманту',e.x<200&&e.tauntMinion===null);
}

{
  const o=fresh(),g=minion('golemB',200),e=foe(o);e.spd=0;e.dmg=100;o.G.minions=[g];const hp=g.hp;o.c.update(0.1);
  ok('контакт без состоявшейся провокации не наносит урон Голему крови',g.hp===hp);
  e.tauntMinion=g;e.cd2=0;const hp2=g.hp;o.c.update(0.1);
  ok('после провокации контактная атака попадает в Голема крови',g.hp<hp2);
}

{
  const o=fresh(()=>0),m=minion('skeleton',300),e=foe(o);o.G.minions=[m];o.D.boneChallenge=true;
  ok('Костяной вызов по-прежнему отдельно провоцирует обычным приспешником',o.c.rollBoneChallenge(e,m)&&e.tauntMinion===m);
}

{
  const yes=fresh(()=>0),g=minion('golemB'),e=foe(yes);yes.G.minions=[g];yes.c.minionHit(e,g);
  ok('фактический основной удар Голема крови запускает провокацию',e.tauntMinion===g);
  const no=fresh(()=>0.999),g2=minion('golemB'),e2=foe(no);no.G.minions=[g2];no.c.minionHit(e2,g2);
  ok('неудачный бросок прямого удара оставляет цель на Некроманте',e2.tauntMinion===null);
}

{
  const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('пассивный поиск Голема крови полностью удалён из горячего цикла',!/collectBloodGolems|minionThreatTarget|bloodGolems/.test(html));
  ok('провокация вызывается один раз сразу после основного урона Голема крови',
    (html.match(/if \(m\.kind === 'golemB' && !e\.dead\) rollBloodGolemTaunt\(e, m\);/g)||[]).length===1&&/damage\(e, \{mul, minion:m, direct:true,confinementPct,\.\.\.snap\}\);\s*if \(m\.kind === 'golemB' && !e\.dead\) rollBloodGolemTaunt\(e, m\);/.test(html));
}

console.log(JSON.stringify({n,fail}));
if(fail)process.exitCode=1;
