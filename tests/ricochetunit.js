/* Осколочный рикошет: редкость, потолок, выбор целей и запрет рекурсии. */
const fs = require('fs');
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(62) + (det||''));

function mk(n=0){
  const c=loadGame('./index.html'); c.newGame('bow','keys','hunter');
  const G=c.__api.G;
  G.enemies.length=0; G.shots.length=0; G.spawnQueue=0; G.packs.length=0;
  if (n) G.bag.add('ricochet','flat',n);
  c.recalc();
  return {c,G,D:c.__api.D};
}
function foe(c,x,y,hp=1e9){
  const e=c.spawnEnemy(); e.x=x; e.y=y; e.spd=0; e.hp=e.maxHp=hp;
  return e;
}
function source(hitSet=[]){
  return {x:0,y:0,vx:620,vy:0,r:5,life:0.8,pierce:0,chain:0,
    hitSet:hitSet.slice(),orb:false,mul:1,pierced:0,ricochetReleased:false,spriteType:'arrow'};
}

{ const {c}=mk(), m=c.__api.MODS.find(x=>x.id==='shape.ricochet');
  ok('карточка синяя и всегда добавляет один осколок',
    m.rar===1 && m.r[0]===1 && m.r[1]===1 && m.noMin===true && m.wep.join(',')==='proj'); }

{ const {c}=mk(); c.setLanguage('ru');
  const ids=['shape.pierce','shape.chain','shape.ricochet'];
  const tips=ids.map(id=>{const m=c.__api.MODS.find(x=>x.id===id);return c.detailedSkillTip(m,{m,val:'свойство'});});
  const html=require('./harness').loadInspectionSource('./index.html');
  ok('три подробные подсказки показывают крупное жёлтое предупреждение',
    tips.every(t=>t.includes('class="tt-exclusive"')&&t.includes('навсегда закрывает две другие ветки')) &&
    html.includes('#skilltip .tt-exclusive{') && html.includes('color:#ffd84a') &&
    html.includes('font-size:15px') && html.includes('font-weight:900'));
}

{ const {c,G,D}=mk(9), m=c.__api.MODS.find(x=>x.id==='shape.ricochet');
  ok('механический потолок — 3, после него карта уходит из пула',
    D.ricochet===3 && m.hide()===true, 'осколков '+D.ricochet); }

{ const {c,G}=mk(2), hit=foe(c,0,0), near=foe(c,90,0), far=foe(c,180,0), s=source([hit]);
  const made=c.releaseRicochetShards(s,1);
  ok('первое попадание выпускает нужное число осколков', made===2 && G.shots.length===2);
  ok('осколки выбирают ближайшие разные незадетые цели',
    G.shots[0].shardTarget===near && G.shots[1].shardTarget===far); }

{ const {c,G}=mk(1), hit=foe(c,0,0), target=foe(c,120,0), s=source([hit]);
  c.releaseRicochetShards(s,1.6); const shard=G.shots[0];
  ok('осколок наносит 45% исходного попадания', Math.abs(shard.mul-0.72)<1e-9, 'множитель '+shard.mul);
  ok('осколок не пробивает, не цепляется, не взрывается сферой',
    shard.pierce===0 && shard.chain===0 && shard.orb===false && shard.ricochetShard===true); }

{ const {c,G}=mk(3), hit=foe(c,0,0), used=foe(c,80,0), valid=foe(c,200,0), outside=foe(c,451,0), s=source([hit,used]);
  const made=c.releaseRicochetShards(s,1);
  ok('поиск исключает задетых врагов и цели дальше 450',
    made===1 && G.shots[0].shardTarget===valid && !G.shots.some(x=>x.shardTarget===outside)); }

{ const {c,G}=mk(3), hit=foe(c,0,0), target=foe(c,100,0), s=source([hit]);
  const first=c.releaseRicochetShards(s,1), second=c.releaseRicochetShards(s,1);
  const recursive=c.releaseRicochetShards(G.shots[0],G.shots[0].mul);
  const minion=c.releaseRicochetShards(Object.assign(source([hit]),{minion:{hp:10}}),1);
  ok('один основной снаряд выпускает осколки только один раз', first===1 && second===0);
  ok('осколки и снаряды свиты не запускают новое разветвление', recursive===0 && minion===0); }

{ const {c,G}=mk(1), hit=foe(c,11,0), target=foe(c,120,0), s=source();
  G.player.atkCd=99; G.shots.push(s); c.update(1/60); G.pending=0;
  ok('главный цикл выпускает осколок при фактическом попадании',
    G.shots.length===1 && G.shots[0].ricochetShard===true && G.shots[0].shardTarget===target); }
