/* Ваншот-метрика: самый сильный удар в комнате против запаса игрока. */
const {loadGame, autoLevel} = require('./sim');
const {pickCard} = require('./run');
function probe(file, floor, runs){
  const a = [];
  for (let r = 0; r < runs; r++){
    const c = loadGame(file);
    c.newGame('bow','keys');
    const G = c.__api.G, D = c.__api.D;
    // билд, типичный для этажа: уровень по замерам прогонов ~2.2 этажа
    G.lvl = 1;
    while (G.lvl < Math.round(floor*2.2)+4){ G.lvl++; G.pending++; }
    pickCard(c); c.recalc();
    G.floor = floor; c.buildFloor();
    for (let i=0;i<60*25;i++){ c.update(1/60); G.pending = 0; G.player.hp = D.life; }
    let worst = 0, nEl = 0;
    for (const e of G.enemies){
      worst = Math.max(worst, e.dmg * (e.kind==='boss'?1:1));
      if (e.kind !== 'norm') nEl++;
    }
    a.push({life:D.life, worst, n:G.enemies.length + G.spawnQueue, lvl:G.lvl});
  }
  const med = k => { const v = a.map(x=>x[k]).sort((x,y)=>x-y); return v[Math.floor(v.length/2)]; };
  return {life:med('life'), worst:med('worst'), n:med('n'), lvl:med('lvl')};
}
const file = process.argv[2] || './GrimGrind.html';
const N = +(process.argv[3] || 7);
console.log('этаж | ур | здоровье | сильнейший удар | ударов до смерти | врагов на этаже');
for (const f of [10,15,20,25,30,35,40,50]){
  const p = probe(file, f, N);
  const hits = p.life/p.worst;
  console.log(String(f).padStart(4), '|', String(p.lvl).padStart(2), '|',
    String(Math.round(p.life)).padStart(8), '|', String(Math.round(p.worst)).padStart(15), '|',
    (hits < 1 ? 'ВАНШОТ' : hits.toFixed(1)).padStart(16), '|', p.n);
}
