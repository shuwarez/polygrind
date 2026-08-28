/* Новая бесконечная сетка босс-этажей: X3/X6/X9/X0. */
const {loadGame}=require('./harness');
let n=0,fail=0;
function ok(name,yes,got=''){
  n++; if(!yes) fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ')+name.padEnd(68)+got);
}

const expected=[
  [1,0,0,false],[2,0,0,false],[3,1,1,false],[6,2,1,false],[9,3,1,false],[10,4,1,true],
  [13,1,2,false],[16,2,2,false],[19,3,2,false],[20,4,2,true],
  [23,1,3,false],[26,2,3,false],[29,3,3,false],[30,4,4,true],
  [33,1,4,false],[36,2,4,false],[39,3,4,false],[40,4,5,true],
  [70,4,8,true],[73,1,8,false],[79,3,8,false],[80,4,8,true],[100,4,8,true]
];

{ const c=loadGame('./PolyGrind.html');
  for(const [floor,bosses,affixes,suppress] of expected){
    const p=c.bossFloorPlan(floor);
    ok('план этажа '+floor,
      p.isBossFloor===(bosses>0) && p.bossCount===bosses && p.affixCount===affixes &&
      p.suppressRegularEnemies===suppress,
      JSON.stringify(p));
  }
  ok('совместимые функции bossCount/affixCount используют общий план',
    expected.every(([f,b,a])=>c.bossCount(f)===b && c.affixCount(f)===a));
}

{ const c=loadGame('./PolyGrind.html',{random:()=>0.5}); c.newGame('bow','keys');
  const G=c.__api.G;
  const built=[];
  for(const [floor,bosses,affixes,suppress] of expected){
    G.floor=floor; c.buildFloor();
    const list=G.enemies.filter(e=>e.kind==='boss');
    built.push(list.length===bosses && list.every(e=>e.aff.length===affixes &&
      new Set(e.aff.map(a=>a.id)).size===affixes) && G.spawnQueue===(suppress?0:G.spawnQueue));
  }
  ok('buildFloor соблюдает число боссов и точное число уникальных аффиксов на всей таблице',built.every(Boolean));

  for(const floor of [6,9,10,20,30,40,70,80,100]){
    G.floor=floor; c.buildFloor();
    const bosses=G.enemies.filter(e=>e.kind==='boss');
    ok('типы боссов не повторяются на этаже '+floor,
      new Set(bosses.map(e=>e.bossId)).size===bosses.length,bosses.map(e=>e.bossId).join(','));
  }

  G.floor=10; c.buildFloor();
  const bosses=G.enemies.filter(e=>e.kind==='boss'),p=G.player;
  let playerGap=Infinity,pairGap=Infinity;
  for(let i=0;i<bosses.length;i++){
    playerGap=Math.min(playerGap,Math.hypot(bosses[i].x-p.x,bosses[i].y-p.y)-bosses[i].r-p.r);
    for(let j=0;j<i;j++) pairGap=Math.min(pairGap,
      Math.hypot(bosses[i].x-bosses[j].x,bosses[i].y-bosses[j].y)-bosses[i].r-bosses[j].r);
  }
  ok('четыре босса появляются далеко от игрока',playerGap>=300,playerGap.toFixed(1));
  ok('четыре крупные модели появляются без перекрытия',pairGap>=120,pairGap.toFixed(1));
  let cornersSafe=true;
  for(const [px,py] of [[1400,1400],[-1400,1400],[1400,-1400],[-1400,-1400]]){
    p.x=px; p.y=py; G.floor=10; c.buildFloor();
    const list=G.enemies.filter(e=>e.kind==='boss');
    for(let i=0;i<list.length;i++){
      if(Math.hypot(list[i].x-p.x,list[i].y-p.y)-list[i].r-p.r<300) cornersSafe=false;
      for(let j=0;j<i;j++) if(Math.hypot(list[i].x-list[j].x,list[i].y-list[j].y)-list[i].r-list[j].r<120) cornersSafe=false;
    }
  }
  ok('безопасные дистанции сохраняются во всех четырёх углах арены',cornersSafe);
}

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); const G=c.__api.G;
  for(const floor of [3,6,9,13,16,19]){
    G.floor=floor; c.buildFloor();
    ok('на этаже '+floor+' обычные волны сохранены',G.spawnQueue>0,String(G.spawnQueue));
  }
  for(const floor of [10,20,30,40,70,80,100]){
    G.floor=floor; c.buildFloor();
    ok('на этаже '+floor+' системная очередь полностью подавлена',G.spawnQueue===0,String(G.spawnQueue));
  }
  G.floor=10; c.buildFloor(); const before=G.enemies.length;
  G.spawnQueue=9; G.spawnT=0; c.update(0.01);
  ok('защитный guard не выпускает системную волну на X0',G.enemies.length===before,String(G.enemies.length));
}

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); const G=c.__api.G;
  G.floor=10; c.buildFloor();
  const grave=c.spawnEnemy('boss','grave'),core=c.summonGraveCore(grave);
  ok('умение босса продолжает призывать миньона на X0',core&&core.summonedByGrave&&core.kind==='norm');
  G.floor=70; c.buildFloor();
  const boss=G.enemies.find(e=>e.kind==='boss'),summon=boss.aff.find(a=>a.id==='summon');
  const before=G.enemies.length; boss.affT.sum=0; summon.tick(boss,0.01,G.player,1);
  ok('аффикс «Зов» продолжает призывать миньонов на X0',G.enemies.length===before+3,String(G.enemies.length-before));
}

for(const floor of [6,9]){
  const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); const G=c.__api.G;
  G.floor=floor; c.buildFloor(); G.spawnQueue=0;
  const bosses=G.enemies.filter(e=>e.kind==='boss');
  G.enemies.splice(G.enemies.indexOf(bosses[0]),1);
  ok('этаж '+floor+' не завершён, пока жив хотя бы один босс',!c.floorCombatComplete());
  G.enemies.length=0;
  ok('этаж '+floor+' завершается после смерти всех '+bosses.length+' боссов',c.floorCombatComplete());
}

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); const G=c.__api.G;
  G.floor=10; c.buildFloor();
  const bosses=G.enemies.filter(e=>e.kind==='boss');
  const minion=c.spawnEnemy('runner'); minion.summonedByGrave=true;
  for(let i=0;i<bosses.length-1;i++) G.enemies.splice(G.enemies.indexOf(bosses[i]),1);
  ok('X0 не завершён после смерти только трёх из четырёх боссов',!c.floorCombatComplete());
  G.enemies.splice(G.enemies.indexOf(bosses[3]),1);
  ok('X0 завершается после четвёртого босса, даже если его миньон ещё жив',c.floorCombatComplete());
  c.update(0.01);
  ok('после смерти четырёх боссов X0 действительно открывает портал',!!G.portal);
}

console.log(JSON.stringify({n,fail}));
process.exitCode=fail?1:0;
