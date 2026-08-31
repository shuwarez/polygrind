/* Шаг 11: воспроизводимый долгий профиль 500 врагов и полной свиты.
   Запуск: node --expose-gc stressprofile.js [frames] */
const {loadGame}=require('./sim');
const {performance}=require('perf_hooks');

const FRAMES=Math.max(300,Number(process.argv[2])||1800),ONLY_MODE=process.argv[3]||'',DT=1/60;
const percentile=(a,p)=>a.slice().sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
const mb=n=>Math.round(n/1048576*100)/100;
function seeded(seed=0x51f15e){
  let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
}
function setup(mode){
  const c=loadGame('./PolyGrind.html',{random:seeded()});c.newGame('necro','keys');
  const G=c.__api.G,D=c.__api.D,p=G.player;
  G.enemies=[];G.minions=[];G.spawnQueue=0;G.spawnT=1e9;G.packs=[];G.corpses=[];
  G.shots=[];G.eshots=[];G.fx=[];G.parts=[];G.bloodFx=[];G.visualCorpses=[];
  G.items=[];G.orbs=[];G.pools=[];G.boils=[];G.acidPools=[];G.trails=[];
  G.weapon.noAttack=true;p.x=p.y=0;p.inv=1e9;p.hp=D.life;
  D.maxSkel=6;D.maxHunt=6;D.maxWarl=6;D.golemB=10;D.golemN=10;D.minMax=20;
  D.inferno=true;
  for(let i=0;i<500;i++){
    const e=c.spawnEnemy('blob'),a=i*2.399963229728653,r=170+(i%22)*21;
    e.x=Math.cos(a)*r;e.y=Math.sin(a)*r;e.spd=42+(i%5)*8;e.dmg=0;
    e.hp=e.maxHp=1e12;e.armor=0;e.ward=null;e.bulwark=0;e.dead=false;e.kind='norm';
    e.ail.chill=i%9===0?1e6:0;
    if(i%17===0){e.dots.fire.dps=0.01;e.dots.fire.life=1e6;e.dots.fire.dur=1e6;e.infT=(i%5)*0.1;}
  }
  if(mode!=='enemy-only'){
    const kinds=['golemB','golemN',...Array(6).fill('skeleton'),...Array(6).fill('hunter'),...Array(6).fill('warlock')];
    for(let i=0;i<kinds.length;i++){
      c.spawnMinion(Math.cos(i)*55,Math.sin(i)*55,kinds[i]);
      const m=G.minions[G.minions.length-1];m.deathT=1e9;m.hp=m.max=Math.max(1,m.max||m.hp||1);
    }
  } else D.hasMin=false;
  G.fx=[];G.parts=[];
  return{c,G,D};
}
function run(mode){
  const {c,G}=setup(mode);
  for(let i=0;i<180;i++){
    if(mode==='retarget')for(const m of G.minions)m.tgt=null;
    c.update(DT);
  }
  if(global.gc)global.gc();
  const heap0=process.memoryUsage().heapUsed,times=[],heapSamples=[];
  for(let i=0;i<FRAMES;i++){
    if(mode==='retarget')for(const m of G.minions)m.tgt=null;
    const t=performance.now();c.update(DT);times.push(performance.now()-t);
    if(i%120===119)heapSamples.push(process.memoryUsage().heapUsed);
  }
  const heapBeforeGc=process.memoryUsage().heapUsed;
  if(global.gc)global.gc();
  const heapAfterGc=process.memoryUsage().heapUsed;
  return{
    mode,frames:FRAMES,simSeconds:+(FRAMES*DT).toFixed(1),
    frameMs:{mean:+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(3),p50:+percentile(times,0.50).toFixed(3),p95:+percentile(times,0.95).toFixed(3),p99:+percentile(times,0.99).toFixed(3),max:+Math.max(...times).toFixed(3)},
    heapMb:{start:mb(heap0),peakSample:mb(Math.max(heap0,...heapSamples,heapBeforeGc)),beforeGc:mb(heapBeforeGc),afterGc:mb(heapAfterGc),retainedDelta:mb(heapAfterGc-heap0)},
    live:{enemies:G.enemies.length,minions:G.minions.length,shots:G.shots.length,fx:G.fx.length,parts:G.parts.length,cells:(G.frameScratch.postMoveGrid&&G.frameScratch.postMoveGrid.cellPool.length)||0}
  };
}

const modes=['enemy-only','full-retinue','retarget'];
for(const mode of (ONLY_MODE?[ONLY_MODE]:modes)){
  if(!modes.includes(mode))throw new Error('unknown mode: '+mode);
  console.log(JSON.stringify(run(mode)));
}
