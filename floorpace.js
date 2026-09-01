/* Темп этажа: сколько длится, сколько врагов, сколько опыта и золота даёт. */
const {loadGame} = require('./sim');
const {botStep, pickCard} = require('./run');
const DT = 1/60;
function pace(file, floor, runs){
  const a = [];
  for (let r = 0; r < runs; r++){
    const c = loadGame(file);
    c.newGame('bow','keys');
    const G = c.__api.G, D = c.__api.D, p = G.player;
    G.lvl = Math.round(floor*2.2)+4;
    G.bag.add('dmg','inc',60*Math.log2(floor)); G.bag.add('aspd','inc',60);
    G.bag.add('life','inc',120); c.recalc(); p.hp = D.life;
    G.floor = floor; c.buildFloor();
    const g0 = G.gold, x0 = G.xp + G.lvl*1000;
    let t = 0, peak = 0, taken = 0;
    while (t < 300){
      const b = p.hp;
      botStep(c, true); G.pending = 0;
      taken += Math.max(0, b - p.hp);
      peak = Math.max(peak, G.enemies.length);
      t += DT;
      if (!G.enemies.length && !G.spawnQueue) break;
    }
    a.push({t, peak, gold:G.gold-g0, taken});
  }
  const med = k => { const v = a.map(x=>x[k]).sort((x,y)=>x-y); return v[Math.floor(v.length/2)]; };
  return {t:med('t'), peak:med('peak'), gold:med('gold'), taken:med('taken')};
}
const N = +(process.argv[2] || 5);
console.log('этаж | сек на зачистку | пик врагов | золота с этажа | урона получено');
for (const f of [10,20,30,40,50]){
  const A = pace('/tmp/pg_before_scale2.html', f, N), B = pace('./GrimGrind.html', f, N);
  console.log(String(f).padStart(4),
    '| было', A.t.toFixed(0).padStart(3) + 'с  стало', B.t.toFixed(0).padStart(3) + 'с',
    '| было', String(A.peak).padStart(2), ' стало', String(B.peak).padStart(2),
    '| было', String(Math.round(A.gold)).padStart(5), ' стало', String(Math.round(B.gold)).padStart(5),
    '| было', String(Math.round(A.taken)).padStart(5), ' стало', String(Math.round(B.taken)).padStart(5));
}
