/*
  Разовый углублённый аудит высокоуровневых сборок.

  Этот файл намеренно НЕ входит в run-all.js: полный прогон перебирает десятки
  тысяч сочетаний и сотни боевых сцен. Запуск:

    node --expose-gc deep_loadout_audit.js
    node --expose-gc deep_loadout_audit.js --quick

  Результат сохраняется в outputs/deep-loadout-audit/results.json.
*/
'use strict';

const fs = require('fs');
const path = require('path');
const {performance} = require('perf_hooks');
const {loadGame} = require('./harness');

const QUICK = process.argv.includes('--quick');
const ONLY_ARG = process.argv.find(arg=>arg.startsWith('--only='));
const ONLY_SCENARIO = ONLY_ARG ? ONLY_ARG.slice('--only='.length) : '';
const SKIP_STATIC = process.argv.includes('--skip-static') || !!ONLY_SCENARIO;
const DT = 1 / 60;
const ROOT_SEED = 0x5e71c0de;
const OUTPUT_DIR = path.join(__dirname, 'outputs', 'deep-loadout-audit');
const OUTPUT_FILE = path.join(OUTPUT_DIR, QUICK ? 'results-quick.json' : 'results.json');
const WEAPONS = ['bow', 'wand', 'necro', 'blade'];

function makeRng(seed){
  let x = seed >>> 0;
  const random = () => {
    x += 0x6D2B79F5;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  random.int = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
  random.pick = a => a[Math.floor(random() * a.length)];
  random.shuffle = a => {
    const out = a.slice();
    for (let i = out.length - 1; i > 0; i--){
      const j = random.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  random.state = () => x >>> 0;
  return random;
}

function percentile(values, p){
  if (!values.length) return 0;
  const a = values.slice().sort((x,y) => x-y);
  return a[Math.min(a.length-1, Math.floor((a.length-1)*p))];
}
function finiteMax(values){
  let max=0;
  for(const value of values)if(Number.isFinite(value)&&value>max)max=value;
  return max;
}
function finite(value){ return typeof value !== 'number' || Number.isFinite(value); }
function modFits(m, weapon){
  return (!m.wep || m.wep.includes(weapon.type)) && (!m.req || weapon.minions) && !(m.noMin && weapon.minions);
}
function itemFits(a, weaponKey, weapon){
  return (!a.minOnly || weapon.minions) && (!a.warriorOnly || weaponKey === 'blade') &&
    (!a.archerOnly || weaponKey === 'bow') && (!a.mageOnly || weaponKey === 'wand');
}

const report = {
  startedAt: new Date().toISOString(), quick: QUICK, rootSeed: ROOT_SEED,
  build: null, catalog: {}, coverage: {
    staticScenarios:0, itemPairs:0, skillPairs:0, itemSkillPairs:0,
    combatScenarios:0, combatFrames:0, bossAppearances:{}, bossCountScenarios:{1:0,2:0,3:0,4:0},
    classScenarios:Object.fromEntries(WEAPONS.map(k=>[k,0])), itemCounts:{}, skillCounts:{},
  },
  performance:{scenarioMs:[], frameMs:[], heapSamplesMb:[]},
  maxima:{}, failures:[], warnings:[], slowest:[], scenarioSamples:[],
  targeted:[], fixes:[
    {id:'AUDIT-MAX-001',scope:'test',summary:'Streaming maximum replaces spread over the full frame sample.'},
    {id:'HARNESS-CANVAS-001',scope:'test',summary:'Canvas gradients, patterns and image-data stubs cover every render pass.'},
    {id:'FX-BUDGET-001',scope:'game',summary:'Damage numbers and status labels use independent visual-only active caps.'},
    {id:'CORPSE-ASSET-001',scope:'game',summary:'Legacy boss corpses restored to verified half-size lossless WebP.'},
    {id:'HUNTER-FRAME-001',scope:'game',summary:'Missing Hunter subclass frame restored as lossless WebP.'},
  ],
};

function fail(kind, detail, context={}){
  const rec = {kind, detail, context};
  report.failures.push(rec);
  if (report.failures.length <= 20) console.error('FAIL', kind, detail, JSON.stringify(context));
}
function warn(kind, detail, context={}){
  report.warnings.push({kind, detail, context});
}
function bump(obj, key, n=1){ obj[key] = (obj[key] || 0) + n; }
function maxMetric(key, value){
  if (Number.isFinite(value)) report.maxima[key] = Math.max(report.maxima[key] || 0, value);
}

function validateDerived(c, context){
  const D = c.__api.D, G = c.__api.G;
  for (const [key,value] of Object.entries(D)){
    if (!finite(value)) fail('non_finite_derived', `D.${key}=${String(value)}`, context);
  }
  const requiredPositive = ['life','mspd','aspd','atkCd'];
  for (const key of requiredPositive){
    if (!(Number.isFinite(D[key]) && D[key] > 0)) fail('invalid_positive_derived', `D.${key}=${String(D[key])}`, context);
  }
  if (!Number.isFinite(D.minMax) || D.minMax < 0 || D.minMax > 40)
    fail('invalid_minion_cap', `D.minMax=${String(D.minMax)}`, context);
  if (G.player){
    for (const key of ['x','y','vx','vy','hp','inv','dash','atkCd']){
      if (!finite(G.player[key])) fail('non_finite_player', `player.${key}=${String(G.player[key])}`, context);
    }
  }
}

const ENTITY_NUMERIC_KEYS = ['x','y','vx','vy','hp','maxHp','max','r','spd','dmg','life','maxLife','t','cd','atk','atkCd','a'];
function validateCombat(c, context){
  validateDerived(c, context);
  const G = c.__api.G, D = c.__api.D;
  const groups = ['enemies','minions','shots','delayedShots','attackEchoes','stepBeyondEchoes','eshots','orbs','fx','parts',
    'bloodFx','arcaneTraces','arcaneMines','repeatDetonations','groundbreakerCracks','sparkSigils','pools','trails','boils',
    'acidPools','eliteAcidPools','bossPools','bossTrails','bossHazards','visualCorpses'];
  for (const name of groups){
    const list = G[name];
    if (!Array.isArray(list)){ fail('missing_array', `G.${name} is not an array`, context); continue; }
    maxMetric(name, list.length);
    for (let i=0;i<list.length;i++){
      const obj=list[i]; if (!obj || typeof obj!=='object') continue;
      for (const key of ENTITY_NUMERIC_KEYS){
        if (key in obj && !finite(obj[key])) fail('non_finite_entity', `G.${name}[${i}].${key}=${String(obj[key])}`, context);
      }
    }
  }
  if (G.bossHazards.length > 40) fail('boss_hazard_cap', `${G.bossHazards.length}>40`, context);
  if (G.parts.length > 640 || G.partPool.length > 640) fail('particle_cap', `parts=${G.parts.length}, pool=${G.partPool.length}`, context);
  if (G.fxPool.length > 512) fail('fx_pool_cap', `${G.fxPool.length}>512`, context);
  if (!G.transientFxCounts || G.transientFxCounts.num > 1024 || G.transientFxCounts.status > 512)
    fail('transient_feedback_cap', JSON.stringify(G.transientFxCounts), context);
  if (G.shots.length > 5000 || G.eshots.length > 5000) fail('projectile_runaway', `shots=${G.shots.length}, eshots=${G.eshots.length}`, context);
  if (G.fx.length > 10000){
    const byType={};for(const f of G.fx)bump(byType,f&&f.t||'(none)');
    const topTypes=Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,8);
    fail('fx_runaway', `fx=${G.fx.length}`, {...context,topFxTypes:topTypes});
  }
  if (G.minions.length > D.minMax) fail('minion_over_cap', `${G.minions.length}>${D.minMax}`, context);
  if (G.over) fail('unexpected_game_over', 'immortal stress actor reached game over', context);
}

function compatibleMods(c, weaponKey){
  c.newGame(weaponKey,'keys',null,true);
  const weapon=c.__api.G.weapon;
  return c.__api.MODS.filter(m=>modFits(m,weapon));
}
function compatibleItems(c, weaponKey){
  c.newGame(weaponKey,'keys',null,true);
  const weapon=c.__api.G.weapon;
  return Object.keys(c.__api.AMULETS).filter(k=>itemFits(c.__api.AMULETS[k],weaponKey,weapon));
}
function resetStatic(c, weaponKey, subclass, level){
  c.newGame(weaponKey,'keys',subclass,true);
  const G=c.__api.G;
  G.lvl=level;G.bag.s={};G.picks=[];G.amu={};G.items={};G.totems={};G.pending=0;
  G.player.ledgerStacks=0;c.recalc();
  return G;
}
function addMod(c,m,value){
  c.__api.G.bag.add(m.stat,m.kind,value);
  c.__api.G.picks.push({id:m.id,nm:m.nm,val:'',cat:m.cat});
}
function representativeValue(c,m,high=false,rng=null){
  if (m.kind==='flag') return 1;
  if (high) return m.r[1];
  if (rng) return c.rollModValue(m,rng);
  return (m.r[0]+m.r[1])/2;
}

function runStaticCompatibility(){
  console.log('STATIC compatibility sweep');
  const rng=makeRng(ROOT_SEED^0x11111111);
  for (const weaponKey of WEAPONS){
    const c=loadGame('./GrimGrind.html',{random:rng});
    const mods=compatibleMods(c,weaponKey),items=compatibleItems(c,weaponKey);
    const subclass=c.__api.SUBCLASSES[weaponKey][0].id;
    const G=resetStatic(c,weaponKey,subclass,120);
    report.catalog[weaponKey]={mods:mods.length,items:items.length};

    // Каждый навык и предмет по отдельности.
    for (const m of mods){
      G.bag.s={};G.picks=[];G.amu={};addMod(c,m,representativeValue(c,m,true));c.recalc();
      validateDerived(c,{phase:'single_skill',weaponKey,id:m.id});report.coverage.staticScenarios++;
    }
    for (const item of items){
      G.bag.s={};G.picks=[];G.amu={[item]:true};c.recalc();
      validateDerived(c,{phase:'single_item',weaponKey,id:item});report.coverage.staticScenarios++;
    }

    // Все допустимые пары предметов и навыков внутри класса.
    for (let i=0;i<items.length;i++) for (let j=i+1;j<items.length;j++){
      G.bag.s={};G.picks=[];G.amu={[items[i]]:true,[items[j]]:true};c.recalc();
      validateDerived(c,{phase:'item_pair',weaponKey,a:items[i],b:items[j]});
      report.coverage.staticScenarios++;report.coverage.itemPairs++;
    }
    for (let i=0;i<mods.length;i++) for (let j=i+1;j<mods.length;j++){
      G.bag.s={};G.picks=[];G.amu={};
      addMod(c,mods[i],representativeValue(c,mods[i],true));
      addMod(c,mods[j],representativeValue(c,mods[j],true));c.recalc();
      validateDerived(c,{phase:'skill_pair',weaponKey,a:mods[i].id,b:mods[j].id});
      report.coverage.staticScenarios++;report.coverage.skillPairs++;
    }
    for (const item of items) for (const m of mods){
      G.bag.s={};G.picks=[];G.amu={[item]:true};addMod(c,m,representativeValue(c,m,true));c.recalc();
      validateDerived(c,{phase:'item_skill_pair',weaponKey,item,skill:m.id});
      report.coverage.staticScenarios++;report.coverage.itemSkillPairs++;
    }

    // Один намеренно предельный, но конечный набор: все классово допустимые
    // карточки и предметы вместе. Числовые навыки берутся по верхней границе.
    G.bag.s={};G.picks=[];G.amu=Object.fromEntries(items.map(k=>[k,true]));
    for (const m of mods) addMod(c,m,representativeValue(c,m,true));
    for (const [key] of Object.entries(c.__api.BOOKS)) G.items[key]={tier:12,val:60};
    for (const key of Object.keys(c.__api.TOTEMS)) G.totems[key]=4;
    c.recalc();validateDerived(c,{phase:'all_compatible',weaponKey});report.coverage.staticScenarios++;
  }
}

function grantLegalSkills(c,count,rng){
  const G=c.__api.G;
  let granted=0,guard=0;
  while (granted<count && guard++<count*20+100){
    const cards=c.rollCards();
    if (!cards.length) break;
    const start=rng.int(0,cards.length-1);
    let chosen=null,value=0;
    for(let off=0;off<cards.length;off++){
      const m=cards[(start+off)%cards.length];
      const v=c.rollModValue(m,rng);
      if (v>0){chosen=m;value=v;break;}
    }
    if(!chosen)break;
    addMod(c,chosen,value);c.recalc();granted++;
  }
  return granted;
}
function grantItems(c,count,rng){
  const G=c.__api.G,weaponKey=Object.keys(c.__api.WEAPONS).find(k=>c.__api.WEAPONS[k]===G.weapon);
  const keys=Object.keys(c.__api.AMULETS).filter(k=>itemFits(c.__api.AMULETS[k],weaponKey,G.weapon));
  const chosen=rng.shuffle(keys).slice(0,Math.min(count,keys.length));
  for(const key of chosen)c.takeAmulet(key,true);
  return chosen;
}
function grantBooksAndTotems(c,rng,intensity){
  const G=c.__api.G;
  const bookKeys=Object.keys(c.__api.BOOKS),takeN=intensity==='none'?0:intensity==='low'?rng.int(0,3):bookKeys.length;
  for(const key of rng.shuffle(bookKeys).slice(0,takeN)){
    const repeats=intensity==='high'?rng.int(4,12):rng.int(1,3);
    for(let i=0;i<repeats;i++)c.takeBook(key,true);
  }
  if(intensity!=='none') for(const key of Object.keys(c.__api.TOTEMS)){
    if(!G.items[c.__api.TOTEMS[key].book])continue;
    const rank=intensity==='high'?rng.int(1,4):rng.int(0,2);
    for(let i=0;i<rank;i++)c.takeTotem(key,true);
  }
}
function forceFullRetinue(c){
  const G=c.__api.G,D=c.__api.D;
  G.minions.length=0;
  const kinds=[...Array(D.maxSkel).fill('skeleton'),...Array(D.maxBomb).fill('bombardier')];
  if(D.golemB)kinds.push('golemB');if(D.golemN)kinds.push('golemN');
  for(let i=0;i<kinds.length;i++){
    c.spawnMinion(Math.cos(i*2.399)*58,Math.sin(i*2.399)*58,kinds[i]);
    const m=G.minions[G.minions.length-1];
    if(m){m.deathT=1e9;m.hp=m.max=Math.max(1,m.max||m.hp||1);}
  }
  return kinds.length;
}
function forceRetinueSkills(c){
  const byId=new Map(c.__api.MODS.map(m=>[m.id,m]));
  const ranks=[['min.count',3],['min.bombardiers',6],['min.golem_blood',10],['min.golem_bone',10],
    ['min.damage',120],['min.attack_speed',100],['min.move_speed',80],['min.crit',50],['min.inherit',70],
    ['min.tier_up',1],['min.bone_field',1],['min.frenzy',1],['min.bloodbath',1],['min.boiling',1],
    ['min.claws',1],['min.whirl',1],['min.blink',1],['min.raid',1],['min.explode',1]];
  for(const [id,value] of ranks){const m=byId.get(id);if(m)addMod(c,m,m.kind==='flag'?1:value);}
  c.recalc();
}

function clearArena(c){
  const G=c.__api.G;
  for(const key of ['enemies','shots','delayedShots','attackEchoes','stepBeyondEchoes','eshots','orbs','fx','parts','bloodFx',
    'arcaneTraces','arcaneMines','repeatDetonations','groundbreakerCracks','sparkSigils','pools','trails','boils','acidPools',
    'eliteAcidPools','bossPools','bossTrails','bossHazards','packs','visualCorpses']) if(Array.isArray(G[key]))G[key].length=0;
  G.spawnQueue=0;G.spawnT=1e9;G.portal=null;G.pending=0;G.paused=false;G.quickPaused=false;G.over=false;
}
function spawnBossSet(c,ids,rng){
  const G=c.__api.G,created=[];
  ids.forEach((id,i)=>{
    const e=c.spawnEnemy('boss',id,null,rng.int(0,3));
    const a=i*Math.PI*2/ids.length+0.37,r=260+(i%2)*90;
    e.x=Math.cos(a)*r;e.y=Math.sin(a)*r;
    e.hp=e.maxHp=Math.max(e.maxHp,1e15);e.dead=false;created.push(e);
    bump(report.coverage.bossAppearances,id);
  });
  bump(report.coverage.bossCountScenarios,String(ids.length));
  return created;
}
function spawnFodder(c,rng,count=12){
  const G=c.__api.G;
  for(let i=0;i<count;i++){
    const e=c.spawnEnemy(i%5===0?'runner':'blob'),a=i*2.399963+rng()*0.2,r=105+(i%4)*42;
    e.x=Math.cos(a)*r;e.y=Math.sin(a)*r;e.dmg=0;e.spd=25;
    e.hp=e.maxHp=Math.max(30,Math.min(1e9,c.avgHit()*rng.int(1,4)));e.dead=false;
  }
  return G.enemies.length;
}
function chooseBosses(all,count,rng,required=null){
  const out=[];
  if(required)out.push(required);
  for(const id of rng.shuffle(all)){
    if(out.length>=count)break;if(!out.includes(id))out.push(id);
  }
  return out;
}

function runCombatScenario(c,spec,rng){
  const start=performance.now();
  c.newGame(spec.weapon,'keys',spec.subclass,true);
  const G=c.__api.G;
  G.lvl=spec.level;G.xp=0;G.xpNext=1e12;c.recalc();
  let grantedSkills=grantLegalSkills(c,spec.acquireDuring?0:spec.skills,rng);
  if(spec.fullRetinue)forceRetinueSkills(c);
  const items=grantItems(c,spec.acquireDuring?0:spec.items,rng);
  const weaponKey=spec.weapon,lateItemKeys=spec.acquireDuring
    ? rng.shuffle(Object.keys(c.__api.AMULETS).filter(k=>itemFits(c.__api.AMULETS[k],weaponKey,G.weapon))).slice(0,spec.items)
    : [];
  let lateItemIndex=0;
  grantBooksAndTotems(c,rng,spec.books||'low');
  c.recalc();
  if(spec.fullRetinue)forceFullRetinue(c);
  clearArena(c);
  // clearArena не трогает свиту. Модели приспешников остаются частью сцены.
  const bossIds=chooseBosses(c.__api.BOSS_KEYS,spec.bosses,rng,spec.requiredBoss);
  spawnBossSet(c,bossIds,rng);spawnFodder(c,rng,spec.fodder===undefined?12:spec.fodder);
  G.player.x=G.player.y=0;G.player.hp=c.__api.D.life*100;G.player.inv=0;G.player.atkCd=0;
  G.weapon.noAttack=false;
  const context={phase:'combat',name:spec.name,weapon:spec.weapon,subclass:spec.subclass,level:spec.level,
    skillsTarget:spec.skills,itemsTarget:spec.items,bosses:bossIds,acquireDuring:!!spec.acquireDuring};
  validateCombat(c,context);
  let peakEnemies=G.enemies.length,peakMinions=G.minions.length,peakShots=0,peakFx=0;
  const frameTimes=[];
  for(let frame=0;frame<spec.frames;frame++){
    const keys=G.keys;for(const k in keys)keys[k]=false;
    const phase=Math.floor(frame/90)%4;
    keys[phase===0?'d':phase===1?'s':phase===2?'a':'w']=true;
    if(frame%180===20 && G.player.dashN>0 && G.player.dash<=0)c.tryDash();
    if(spec.acquireDuring && frame%Math.max(2,spec.acquireEvery||4)===0){
      if(lateItemIndex<lateItemKeys.length){c.takeAmulet(lateItemKeys[lateItemIndex++],true);items.push(lateItemKeys[lateItemIndex-1]);}
      if(grantedSkills<spec.skills)grantedSkills+=grantLegalSkills(c,1,rng);
    }
    const lowHealthPhase=spec.healthCycle && frame%240>=120 && frame%240<180;
    if(lowHealthPhase){G.player.hp=c.__api.D.life*0.15;G.player.inv=0.2;}
    else {G.player.hp=Math.max(G.player.hp,c.__api.D.life*100);G.player.inv=0;}
    const t=performance.now();
    try{c.update(DT);c.render();}catch(error){fail('combat_exception',error.stack||String(error),{...context,frame});break;}
    const elapsed=performance.now()-t;frameTimes.push(elapsed);report.performance.frameMs.push(elapsed);
    if(!lowHealthPhase)G.player.hp=Math.max(G.player.hp,c.__api.D.life*100);G.pending=0;
    if(frame>0 && frame%120===0){
      const normals=G.enemies.filter(e=>e.kind==='norm').length;
      if(normals<8)spawnFodder(c,rng,8-normals);
    }
    if(frame%30===0)validateCombat(c,{...context,frame});
    peakEnemies=Math.max(peakEnemies,G.enemies.length);peakMinions=Math.max(peakMinions,G.minions.length);
    peakShots=Math.max(peakShots,G.shots.length+G.eshots.length);peakFx=Math.max(peakFx,G.fx.length+G.parts.length);
  }
  validateCombat(c,{...context,frame:spec.frames});
  const elapsed=performance.now()-start,mean=frameTimes.reduce((a,b)=>a+b,0)/Math.max(1,frameTimes.length),p95=percentile(frameTimes,.95);
  context.skills=grantedSkills;context.items=items.length;
  const result={...context,frames:spec.frames,seconds:+(spec.frames*DT).toFixed(1),elapsedMs:+elapsed.toFixed(2),
    meanFrameMs:+mean.toFixed(4),p95FrameMs:+p95.toFixed(4),maxFrameMs:+finiteMax(frameTimes).toFixed(4),
    peakEnemies,peakMinions,peakShots,peakFx,endEnemies:G.enemies.length,endMinions:G.minions.length};
  report.coverage.combatScenarios++;report.coverage.combatFrames+=spec.frames;bump(report.coverage.classScenarios,spec.weapon);
  bump(report.coverage.itemCounts,String(items.length));bump(report.coverage.skillCounts,String(grantedSkills));
  report.performance.scenarioMs.push(elapsed);
  report.slowest.push(result);report.slowest.sort((a,b)=>b.p95FrameMs-a.p95FrameMs);report.slowest.length=20;
  if(report.scenarioSamples.length<40 || spec.targeted)report.scenarioSamples.push(result);
  if(spec.targeted)report.targeted.push(result);
  return result;
}

function combatSpecs(c,rng){
  const specs=[];
  const baseFrames=QUICK?120:360;
  // Каждый из 34 боссов обязан встретиться отдельно со всеми четырьмя классами.
  for(const boss of c.__api.BOSS_KEYS)for(const weapon of WEAPONS){
    const subclasses=c.__api.SUBCLASSES[weapon];
    specs.push({name:`boss-${boss}-${weapon}`,weapon,subclass:rng.pick(subclasses).id,level:70,
      skills:30,items:30,bosses:1,requiredBoss:boss,books:'high',frames:baseFrames});
  }
  // Случайные малые, средние и экстремальные сборки; 1-4 босса.
  const randomN=QUICK?24:192;
  const levels=[20,40,70,100,140],skills=[0,5,15,30,60,100],items=[0,1,5,15,30,60,93];
  for(let i=0;i<randomN;i++){
    const weapon=WEAPONS[i%WEAPONS.length],subs=c.__api.SUBCLASSES[weapon];
    specs.push({name:`random-${i}`,weapon,subclass:rng.pick(subs).id,level:rng.pick(levels),skills:rng.pick(skills),
      items:rng.pick(items),bosses:1+(i%4),books:rng.pick(['none','low','high']),frames:baseFrames});
  }
  // Требуемые заказчиком варианты Некроманта 70 уровня: полная свита,
  // 30/60 предметов, разные объёмы навыков и 1-4 босса.
  for(const subclass of c.__api.SUBCLASSES.necro.map(s=>s.id))
    for(const itemCount of [30,60])for(const skillCount of [15,30,69])for(const bosses of [1,2,3,4])
      specs.push({name:`necro70-${subclass}-${itemCount}items-${skillCount}skills-${bosses}boss`,weapon:'necro',subclass,
        level:70,skills:skillCount,items:itemCount,bosses,books:'high',fullRetinue:true,frames:QUICK?180:600,targeted:true});

  // Максимальные soak-сцены: все предметы, большой пул карточек, четыре босса.
  for(const weapon of WEAPONS)for(const subclass of c.__api.SUBCLASSES[weapon].map(s=>s.id))
    specs.push({name:`extreme-${weapon}-${subclass}`,weapon,subclass,level:140,skills:120,items:93,bosses:4,
      books:'high',fullRetinue:weapon==='necro',healthCycle:true,frames:QUICK?240:1800,targeted:true});
  // Отдельно проверяем получение предметов и навыков уже во время боя:
  // Перевёрнутая корона, Книга долгов и таймерные предметы имеют side effects
  // на существующих противников и состояние героя.
  for(const weapon of WEAPONS){
    const subclass=c.__api.SUBCLASSES[weapon][1].id;
    specs.push({name:`live-acquisition-${weapon}`,weapon,subclass,level:140,skills:100,items:93,bosses:4,
      books:'high',fullRetinue:weapon==='necro',healthCycle:true,acquireDuring:true,acquireEvery:4,
      frames:QUICK?480:1200,targeted:true});
  }
  // Долгий временной горизонт: 150 игровых секунд нужен для предметов и эффектов
  // с редкими 45-120-секундными таймерами, которые короткие бои не успевают активировать.
  for(const weapon of WEAPONS){
    const subclass=c.__api.SUBCLASSES[weapon][2].id;
    specs.push({name:`time-horizon-${weapon}`,weapon,subclass,level:200,skills:120,items:93,bosses:4,
      books:'high',fullRetinue:weapon==='necro',healthCycle:true,frames:QUICK?600:9000,targeted:true});
  }
  // Массовые сцены одновременно нагружают поиск целей, AoE, свиту, предметные
  // триггеры, четыре набора босс-механик, culling и все Canvas-проходы.
  for(const weapon of ['wand','necro']){
    const subclass=c.__api.SUBCLASSES[weapon][weapon==='necro'?0:1].id;
    specs.push({name:`crowd-500-${weapon}`,weapon,subclass,level:200,skills:120,items:93,bosses:4,
      books:'high',fullRetinue:weapon==='necro',healthCycle:true,fodder:QUICK?150:500,
      frames:QUICK?240:1200,targeted:true});
  }
  return specs;
}

function runCombatMatrix(){
  console.log('COMBAT matrix');
  const rng=makeRng(ROOT_SEED^0x22222222);
  const catalog=loadGame('./GrimGrind.html',{random:rng});catalog.newGame('bow','keys',null,true);
  const allSpecs=combatSpecs(catalog,rng);
  const specs=ONLY_SCENARIO?allSpecs.filter(spec=>spec.name===ONLY_SCENARIO):allSpecs;
  if(ONLY_SCENARIO&&!specs.length)throw new Error(`Unknown --only scenario: ${ONLY_SCENARIO}`);
  const contexts=new Map();
  for(let i=0;i<specs.length;i++){
    const spec=specs[i],key=spec.weapon+'|'+spec.subclass;
    let c=contexts.get(key);
    if(!c){c=loadGame('./GrimGrind.html',{random:rng});contexts.set(key,c);}
    runCombatScenario(c,spec,rng);
    if((i+1)%25===0)console.log(`  ${i+1}/${specs.length} scenarios, failures=${report.failures.length}`);
    if(global.gc && (i+1)%40===0){global.gc();report.performance.heapSamplesMb.push(process.memoryUsage().heapUsed/1048576);}
  }
}

function finalize(){
  report.finishedAt=new Date().toISOString();
  report.performance.frameSummary={
    mean:+(report.performance.frameMs.reduce((a,b)=>a+b,0)/Math.max(1,report.performance.frameMs.length)).toFixed(4),
    p50:+percentile(report.performance.frameMs,.5).toFixed(4),p95:+percentile(report.performance.frameMs,.95).toFixed(4),
    p99:+percentile(report.performance.frameMs,.99).toFixed(4),max:+finiteMax(report.performance.frameMs).toFixed(4),
  };
  report.performance.scenarioSummary={mean:+(report.performance.scenarioMs.reduce((a,b)=>a+b,0)/Math.max(1,report.performance.scenarioMs.length)).toFixed(2),
    p95:+percentile(report.performance.scenarioMs,.95).toFixed(2),max:+finiteMax(report.performance.scenarioMs).toFixed(2)};
  delete report.performance.frameMs;delete report.performance.scenarioMs;
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});fs.writeFileSync(OUTPUT_FILE,JSON.stringify(report,null,2));
  console.log(JSON.stringify({output:OUTPUT_FILE,staticScenarios:report.coverage.staticScenarios,combatScenarios:report.coverage.combatScenarios,
    combatFrames:report.coverage.combatFrames,failures:report.failures.length,warnings:report.warnings.length,
    frame:report.performance.frameSummary,maxima:report.maxima},null,2));
  if(report.failures.length)process.exitCode=1;
}

try{
  const probe=loadGame('./GrimGrind.html',{random:makeRng(ROOT_SEED)});probe.newGame('bow','keys',null,true);
  report.build={htmlBytes:fs.statSync('./GrimGrind.html').size,bosses:probe.__api.BOSS_KEYS.length,
    mods:probe.__api.MODS.length,items:Object.keys(probe.__api.AMULETS).length,books:Object.keys(probe.__api.BOOKS).length,
    totems:Object.keys(probe.__api.TOTEMS).length};
  if(!SKIP_STATIC)runStaticCompatibility();runCombatMatrix();
}catch(error){fail('audit_exception',error.stack||String(error),{rng:ROOT_SEED});}
finalize();
