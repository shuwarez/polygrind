/* Детерминированный аудит классов. Боевой DPS — фактически снятое здоровье
   врагов в секунду, поэтому честно учитывает площадь, свиту и избыточный урон. */
const {loadGame} = require('./harness');
const {play, pickCard, botStep} = require('./run');

const FILE = process.argv[2] || './PolyGrind.html';
const RUNS = +(process.argv[3] || 24);
const CHECK_RUNS = +(process.argv[4] || 4);
const GOAL = 30;
const CLASSES = [
  {key:'bow',   name:'Лучник',     subclass:'hunter'},
  {key:'wand',  name:'Маг',        subclass:'destroyer'},
  {key:'necro', name:'Некромант',  subclass:'animator'},
  {key:'blade', name:'Воин',     subclass:null},
];

function rng32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function quantile(values, q){
  const a = [...values].sort((x,y)=>x-y);
  if (!a.length) return 0;
  const p = (a.length-1)*q, i = Math.floor(p), f = p-i;
  return a[i] + (a[Math.min(i+1,a.length-1)]-a[i])*f;
}
const mean = a => a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
const median = a => quantile(a, .5);
function luck(floors){
  const m = mean(floors), p10 = quantile(floors,.1), p90 = quantile(floors,.9);
  const index = m ? (p90-p10)/m : 0;
  return {p10,p90,index, label:index < .25?'низкая':index < .55?'средняя':'высокая'};
}
function one(cls, seed, immortal){
  const random = rng32(seed);
  const c = loadGame(FILE, {random});
  return play(c, cls.key, {maxSec:1200, maxFloor:GOAL, immortal,
    subclass:cls.subclass, random, strategy:'smart'});
}
function benchmark(cls, seed, floor){
  const random = rng32(seed), c = loadGame(FILE, {random});
  c.newGame(cls.key, 'keys', cls.subclass);
  const G = c.__api.G, D = c.__api.D;
  const targetLevel = Math.round(floor*2.2)+4;
  while (G.lvl < targetLevel){
    G.lvl++; G.xpNext = Math.round(14*Math.pow(1.17,G.lvl-1)); G.pending++;
    pickCard(c, random, 'smart');
  }
  G.enemies=[]; G.shots=[]; G.eshots=[]; G.orbs=[]; G.fx=[]; G.parts=[];
  G.pools=[]; G.trails=[]; G.boils=[]; G.acidPools=[]; G.packs=[]; G.corpses=[];
  G.portal=null; G.spawnQueue=0; G.spawnT=0; G.over=false; G.floor=floor; G.gold=0;
  c.recalc(); G.player.hp=D.life; c.buildFloor();
  const damage0=G.stats.damage, taken0=G.stats.taken;
  let sec=0;
  while (sec < 300 && (G.enemies.length || G.spawnQueue>0)){
    botStep(c, true); G.pending=0; sec += 1/60;
  }
  const damage=G.stats.damage-damage0;
  const taken=G.stats.taken-taken0;
  return {sec, dps:damage/Math.max(1/60,sec), gold:G.gold, life:D.life,
    taken, incoming:taken/Math.max(1/60,sec), cleared:!G.enemies.length && G.spawnQueue<=0};
}
function fixed(n, salt){ return Array.from({length:n}, (_,i)=>0xC0FFEE + i*7919 + salt); }

const rows = [];
for (let ci=0; ci<CLASSES.length; ci++){
  const cls = CLASSES[ci];
  const normal = fixed(RUNS, 0).map(seed => one(cls, seed, false));
  const floors = normal.map(r=>Math.min(r.floor, GOAL+1));
  const L = luck(floors);
  const checkpoint = {};
  for (const f of [10,20,30]){
    const samples = fixed(CHECK_RUNS, 0xBAD5EED+f).map(seed=>benchmark(cls,seed,f));
    checkpoint[f] = samples.length ? {
      sec:+median(samples.map(x=>x.sec)).toFixed(1),
      gold:Math.round(median(samples.map(x=>x.gold))),
      dps:Math.round(median(samples.map(x=>x.dps))),
      incoming:Math.round(median(samples.map(x=>x.incoming))),
      life:Math.round(median(samples.map(x=>x.life))),
      cleared:samples.filter(x=>x.cleared).length,
      n:samples.length,
    } : null;
  }
  rows.push({class:cls.name, key:cls.key, subclass:cls.subclass,
    floor:+mean(floors).toFixed(2), p10:+L.p10.toFixed(1), p90:+L.p90.toFixed(1),
    gold:Math.round(mean(normal.map(r=>r.gold))),
    deaths:normal.filter(r=>r.dead && r.floor<=GOAL).length,
    runs:RUNS, luck:+L.index.toFixed(2), luckLabel:L.label, checkpoint});
}

console.log('Класс       | средний этаж | золото | смерти | раздача (P10..P90 / индекс)');
for (const r of rows) console.log(
  r.class.padEnd(11), '|', r.floor.toFixed(1).padStart(6),
  '|', String(r.gold).padStart(6), '|', (r.deaths+'/'+r.runs).padStart(7),
  '|', `${r.p10.toFixed(1)}..${r.p90.toFixed(1)} / ${r.luck.toFixed(2)} ${r.luckLabel}`);
console.log('\nКонтрольные этажи: медиана секунд / боевой DPS / входящий DPS / золото / здоровье');
for (const r of rows){
  const text = [10,20,30].map(f => {
    const x=r.checkpoint[f]; return `${f}: ${x?`${x.sec}с / ${x.dps} / ${x.incoming} / ${x.gold} / ${x.life}`:'не достигнут'}`;
  }).join(' | ');
  console.log(r.class.padEnd(11), text);
}
console.log('\nJSON ' + JSON.stringify(rows));
