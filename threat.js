/* Настоящая угроза комнаты: неподвижный бессмертный игрок, урон в секунду по нему. */
const {loadGame} = require('./sim');
const DT = 1/60;
function threat(file, floor, runs){
  const a = [];
  for (let r = 0; r < runs; r++){
    const c = loadGame(file);
    c.newGame('bow','keys');
    const G = c.__api.G, D = c.__api.D, p = G.player;
    G.lvl = Math.round(floor*2.2)+4; G.bag.add('life','inc',120); c.recalc();
    G.floor = floor; c.buildFloor();
    let taken = 0, t = 0, worst = 0;
    for (let i=0;i<60*45;i++){                       // 45 сек: даём волнам набежать
      for (const k in G.keys) G.keys[k] = false;
      const b = p.hp;
      c.update(DT); G.pending = 0;
      const d = Math.max(0, b - p.hp);
      taken += d; worst = Math.max(worst, d);
      p.hp = D.life; t += DT;
    }
    a.push({dps:taken/t, worst, life:D.life});
  }
  const med = k => { const v = a.map(x=>x[k]).sort((x,y)=>x-y); return v[Math.floor(v.length/2)]; };
  return {dps:med('dps'), worst:med('worst'), life:med('life')};
}
const N = +(process.argv[2] || 5);
console.log('неподвижный игрок в толпе, 45 сек · медиана по ' + N);
console.log('этаж | урон/сек: было → стало | сильнейший удар: было → стало | секунд жизни: было → стало');
for (const f of [10,20,30,40,50]){
  const A = threat('/tmp/pg_before_scale.html', f, N), B = threat('./index.html', f, N);
  const sa = A.life/A.dps, sb = B.life/B.dps;
  console.log(String(f).padStart(4),
    '|', Math.round(A.dps).toString().padStart(5), '→', Math.round(B.dps).toString().padStart(5),
    '|', Math.round(A.worst).toString().padStart(6), '→', Math.round(B.worst).toString().padStart(5),
    '|', sa.toFixed(1).padStart(5), '→', sb.toFixed(1));
}
