/* ---------- 4. СОСТОЯНИЕ ИГРЫ ---------- */
let G = null;                                        // глобальный объект партии

/* ---------- 4a. АВАРИЙНАЯ ДИАГНОСТИКА ----------
   Отчёты намеренно компактны и локальны: игра остаётся одним HTML, ничего не
   отправляет по сети и пишет только несколько последних снимков браузера. */
const DIAG_REPORTS_KEY='polygrind_diagnostic_reports_v1';
const DIAG_SESSION_KEY='polygrind_diagnostic_session_v1';
const DIAG_MAX_REPORTS=5, DIAG_MAX_EVENTS=200, DIAG_SESSION_EVENT_COUNT=80;
const Diagnostics={
  sessionId:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
  startedAt:new Date().toISOString(),events:[],reports:[],open:false,recovered:false,
  wasPaused:false,worker:null,lastWorkerBeat:0,lastPersist:0,lastPanelRender:0,lastSample:0,
  lastLongFrame:-Infinity,lastSevereReport:-Infinity,lastFrameErrorAt:-Infinity,lastFrameErrorKey:'',
  frameSamples:[],fps:0,fpsFrames:0,fpsSince:performance.now(),
  skipNextFrame:true,warmupUntil:performance.now()+6000,
};
function diagSafeDetail(value){
  try{
    return JSON.parse(JSON.stringify(value,(key,item)=>{
      if (typeof item==='number'&&!Number.isFinite(item)) return String(item);
      if (typeof item==='bigint') return String(item);
      if (item instanceof Error) return {name:item.name,message:item.message,stack:item.stack||''};
      return item;
    }));
  }catch(error){ return {unserializable:String(value),error:String(error)}; }
}
function diagArrayLength(value){ return Array.isArray(value)?value.length:0; }
function diagBuildLabel(){
  try { return BUILD.indexOf('BUILD')>=0?'dev':BUILD; } catch(error){ return 'dev'; }
}
function diagFrameStats(){
  const values=Diagnostics.frameSamples;
  if (!values.length) return {fps:Diagnostics.fps,avgMs:0,p95Ms:0,maxMs:0};
  const sorted=values.slice().sort((a,b)=>a-b), sum=values.reduce((a,b)=>a+b,0);
  return {
    fps:Math.round(Diagnostics.fps*10)/10,
    avgMs:Math.round(sum/values.length*10)/10,
    p95Ms:Math.round(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]*10)/10,
    maxMs:Math.round(sorted[sorted.length-1]*10)/10,
  };
}
function diagSnapshot(){
  const memory=performance.memory&&Number.isFinite(performance.memory.usedJSHeapSize)
    ? Math.round(performance.memory.usedJSHeapSize/1048576*10)/10:null;
  const base={
    capturedAt:new Date().toISOString(),build:diagBuildLabel(),visibility:document.visibilityState||'unknown',
    viewport:{width:typeof innerWidth==='number'?innerWidth:(window.innerWidth||1280),
      height:typeof innerHeight==='number'?innerHeight:(window.innerHeight||720),
      dpr:typeof devicePixelRatio==='number'?(devicePixelRatio||1):(window.devicePixelRatio||1),
      renderDpr:typeof RENDER_DPR==='number'?RENDER_DPR:1},frames:diagFrameStats(),
    heapMiB:memory,
  };
  if (!G) return Object.assign(base,{screen:'menu',game:null});
  const p=G.player||{};
  return Object.assign(base,{screen:G.over?'game-over':G.paused?'paused':'game',game:{
    floor:G.floor,level:G.lvl,time:Math.round((G.time||0)*10)/10,devZone:!!G.devZone,
    weapon:G.weapon&&G.weapon.id||'',subclass:G.subclass||'',control:G.control||'',
    paused:!!G.paused,quickPaused:!!G.quickPaused,pending:G.pending||0,over:!!G.over,
    player:{x:Math.round(p.x||0),y:Math.round(p.y||0),hp:Math.round((p.hp||0)*10)/10,
      maxHp:Number.isFinite(D.life)?Math.round(D.life*10)/10:null,barrier:Math.round((p.barrier||0)*10)/10,
      dash:p.dash||0,dashCharges:p.dashN||0},
    counts:{
      enemies:diagArrayLength(G.enemies),shots:diagArrayLength(G.shots),enemyShots:diagArrayLength(G.eshots),
      delayedShots:diagArrayLength(G.delayedShots),orbs:diagArrayLength(G.orbs),effects:diagArrayLength(G.fx),
      particles:diagArrayLength(G.parts),bloodEffects:diagArrayLength(G.bloodFx),minions:diagArrayLength(G.minions),
      corpses:diagArrayLength(G.corpses),visualCorpses:diagArrayLength(G.visualCorpses),
      pools:diagArrayLength(G.pools)+diagArrayLength(G.acidPools)+diagArrayLength(G.eliteAcidPools)+diagArrayLength(G.bossPools),
      trails:diagArrayLength(G.trails)+diagArrayLength(G.bossTrails),packs:diagArrayLength(G.packs),
      spawnQueue:G.spawnQueue||0,
    },
    bosses:(G.enemies||[]).filter(e=>e&&e.kind==='boss').slice(0,4).map(e=>e.bossId||e.typeKey||'boss'),
  }});
}
function diagCompactSample(){
  const snap=diagSnapshot();
  return {at:snap.capturedAt,frames:snap.frames,heapMiB:snap.heapMiB,
    game:snap.game?{floor:snap.game.floor,level:snap.game.level,time:snap.game.time,
      hp:snap.game.player.hp,counts:snap.game.counts,bosses:snap.game.bosses}:null};
}
function diagEvent(type,detail){
  const event={at:new Date().toISOString(),type:String(type),detail:diagSafeDetail(detail||{})};
  Diagnostics.events.push(event);
  if (Diagnostics.events.length>DIAG_MAX_EVENTS) Diagnostics.events.splice(0,Diagnostics.events.length-DIAG_MAX_EVENTS);
  return event;
}
function diagReadJson(key,fallback){
  try { const value=localStorage.getItem(key); return value?JSON.parse(value):fallback; }
  catch(error){ return fallback; }
}
function diagWriteJson(key,value){
  try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch(error){ return false; }
}
function diagSaveReports(){ return diagWriteJson(DIAG_REPORTS_KEY,{version:1,reports:Diagnostics.reports}); }
function diagReportId(){ return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7); }
function diagStoreReport(report){
  Diagnostics.reports.unshift(report);
  if (Diagnostics.reports.length>DIAG_MAX_REPORTS) Diagnostics.reports.length=DIAG_MAX_REPORTS;
  diagSaveReports(); diagRefreshPanel(); diagRefreshBadge();
  return report;
}
function diagCreateReport(kind,detail,source){
  const report={
    version:1,id:diagReportId(),kind:String(kind),createdAt:new Date().toISOString(),
    sessionId:source&&source.sessionId||Diagnostics.sessionId,sessionStartedAt:source&&source.startedAt||Diagnostics.startedAt,
    build:source&&source.build||diagBuildLabel(),userAgent:typeof navigator!=='undefined'?navigator.userAgent:'',
    detail:diagSafeDetail(detail||{}),snapshot:source&&source.snapshot||diagSnapshot(),
    events:(source&&Array.isArray(source.events)?source.events:Diagnostics.events).slice(-DIAG_MAX_EVENTS),
  };
  return diagStoreReport(report);
}
function diagSessionPayload(active,reason){
  return {version:1,active:!!active,reason:reason||'',sessionId:Diagnostics.sessionId,
    startedAt:Diagnostics.startedAt,lastSeen:new Date().toISOString(),build:diagBuildLabel(),
    snapshot:diagSnapshot(),events:Diagnostics.events.slice(-DIAG_SESSION_EVENT_COUNT)};
}
function diagPersistSession(force=false){
  const now=Date.now();
  if (!force&&now-Diagnostics.lastPersist<3000) return false;
  Diagnostics.lastPersist=now;
  return diagWriteJson(DIAG_SESSION_KEY,diagSessionPayload(true,'heartbeat'));
}
function diagMarkClean(reason){
  try { diagWriteJson(DIAG_SESSION_KEY,diagSessionPayload(false,reason||'pagehide')); } catch(error){}
}
function diagErrorDetail(event){
  const error=event&&event.error;
  return {message:event&&event.message||error&&error.message||'Unknown error',
    filename:event&&event.filename||'',line:event&&event.lineno||0,column:event&&event.colno||0,
    name:error&&error.name||'',stack:error&&error.stack||''};
}
function diagFrameError(error,stage){
  const detail={stage:String(stage||'frame'),message:error&&error.message||String(error),
    name:error&&error.name||'',stack:error&&error.stack||''};
  const key=detail.stage+'|'+detail.name+'|'+detail.message;
  const now=performance.now();
  diagEvent('frame_error',detail);
  /* Одинаковый дефект может повторяться каждый RAF. В событиях оставляем след,
     но тяжёлый отчёт пишем только при новом сообщении либо раз в 15 секунд. */
  if (key!==Diagnostics.lastFrameErrorKey||now-Diagnostics.lastFrameErrorAt>=15000){
    Diagnostics.lastFrameErrorKey=key;Diagnostics.lastFrameErrorAt=now;
    diagCreateReport('frame_error',detail);
  }
  try { console.error('[PolyGrind frame error]',detail.stage,error); } catch(ignore){}
  return detail;
}
function diagStartWatchdog(){
  if (typeof Worker==='undefined'||typeof Blob==='undefined'||typeof URL==='undefined'){
    diagEvent('watchdog_unavailable',{}); return false;
  }
  try{
    const source=`let last=Date.now(),visible=true,reported=false;
onmessage=e=>{const m=e.data||{};if(m.type==='beat'){last=Date.now();visible=m.visible!==false;if(reported)reported=false;}else if(m.type==='visibility'){visible=!!m.visible;last=Date.now();if(!visible)reported=false;}};
setInterval(()=>{const gap=Date.now()-last;if(visible&&gap>=7000&&!reported){reported=true;postMessage({type:'hang',gap});}},1000);`;
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    Diagnostics.worker=new Worker(url); URL.revokeObjectURL(url);
    Diagnostics.worker.onmessage=event=>{
      if (!event.data||event.data.type!=='hang') return;
      const gap=Math.max(0,Number(event.data.gap)||0);
      diagEvent('watchdog_hang',{gapMs:gap});
      diagCreateReport('hang',{message:'Main thread stopped answering the watchdog',gapMs:gap});
    };
    Diagnostics.worker.onerror=event=>diagEvent('watchdog_error',{message:event.message||'Worker error'});
    return true;
  }catch(error){ diagEvent('watchdog_unavailable',{message:String(error)}); return false; }
}
function diagTick(rawFrameMs,now){
  const frame=Math.max(0,Number(rawFrameMs)||0);
  const ignoreStall=Diagnostics.skipNextFrame||document.hidden||now<Diagnostics.warmupUntil;
  Diagnostics.skipNextFrame=false;
  if (ignoreStall){
    Diagnostics.frameSamples.length=0; Diagnostics.fpsFrames=0; Diagnostics.fpsSince=now;
  }else{
    Diagnostics.frameSamples.push(frame);
    if (Diagnostics.frameSamples.length>300) Diagnostics.frameSamples.shift();
  }
  Diagnostics.fpsFrames++;
  const fpsWindow=now-Diagnostics.fpsSince;
  if (fpsWindow>=1000){
    Diagnostics.fps=Diagnostics.fpsFrames*1000/fpsWindow;
    Diagnostics.fpsFrames=0; Diagnostics.fpsSince=now;
  }
  if (!ignoreStall&&frame>=250&&now-Diagnostics.lastLongFrame>=500){
    Diagnostics.lastLongFrame=now;
    diagEvent(frame>=1000?'severe_stall':'long_frame',{frameMs:Math.round(frame)});
  }
  if (!ignoreStall&&frame>=2000&&now-Diagnostics.lastSevereReport>=15000){
    Diagnostics.lastSevereReport=now;
    diagCreateReport('severe_stall',{message:'A rendered frame exceeded two seconds',frameMs:Math.round(frame)});
  }
  if (now-Diagnostics.lastSample>=5000){ Diagnostics.lastSample=now; diagEvent('sample',diagCompactSample()); }
  if (Diagnostics.worker&&now-Diagnostics.lastWorkerBeat>=1000){
    Diagnostics.lastWorkerBeat=now;
    try { Diagnostics.worker.postMessage({type:'beat',visible:!document.hidden}); } catch(error){}
  }
  diagPersistSession(false);
  if (Diagnostics.open&&now-Diagnostics.lastPanelRender>=500){ Diagnostics.lastPanelRender=now; diagRenderLive(); }
}
function diagSelectedReport(){
  const select=document.getElementById('diagreportselect');
  const id=select&&select.value;
  return Diagnostics.reports.find(report=>report.id===id)||Diagnostics.reports[0]||null;
}
function diagReportTitle(report){
  if (!report) return 'Нет сохранённых отчётов';
  return report.createdAt.replace('T',' ').replace('Z','')+' · '+report.kind+' · '+report.id;
}
function diagReportText(report){
  if (!report) return 'POLYGRIND DIAGNOSTICS\nNo saved report.';
  return 'POLYGRIND DIAGNOSTICS\n'+
    'Kind: '+report.kind+'\nCreated: '+report.createdAt+'\nBuild: '+report.build+'\nSession: '+report.sessionId+'\n\n'+
    JSON.stringify(report,null,2);
}
function diagRenderLive(){
  const target=document.getElementById('diaglive'); if (!target) return;
  const snap=diagSnapshot(), game=snap.game, frames=snap.frames;
  const lines=[
    'BUILD       '+snap.build,
    'SESSION     '+Diagnostics.sessionId,
    'FPS         '+frames.fps,
    'FRAME MS    avg '+frames.avgMs+' · p95 '+frames.p95Ms+' · max '+frames.maxMs,
    'HEAP        '+(snap.heapMiB===null?'unavailable':snap.heapMiB+' MiB'),
    'VISIBILITY  '+snap.visibility,
  ];
  if (game){
    lines.push('RUN          floor '+game.floor+' · level '+game.level+' · '+game.weapon+' / '+(game.subclass||'base'));
    lines.push('PLAYER       HP '+game.player.hp+' / '+game.player.maxHp+' · x '+game.player.x+' · y '+game.player.y);
    lines.push('OBJECTS      enemies '+game.counts.enemies+' · shots '+(game.counts.shots+game.counts.enemyShots)+' · FX '+game.counts.effects+' · particles '+game.counts.particles);
    lines.push('WORLD        minions '+game.counts.minions+' · corpses '+game.counts.visualCorpses+' · pools '+game.counts.pools+' · queue '+game.counts.spawnQueue);
  }else lines.push('RUN          main menu');
  lines.push('EVENTS       '+Diagnostics.events.length+' / '+DIAG_MAX_EVENTS);
  lines.push('REPORTS      '+Diagnostics.reports.length+' / '+DIAG_MAX_REPORTS);
  target.textContent=lines.join('\n');
}
function diagRefreshPanel(){
  const select=document.getElementById('diagreportselect'), preview=document.getElementById('diagpreview');
  if (!select||!preview||typeof document.createElement!=='function') return;
  const previous=select.value;
  select.textContent='';
  if (!Diagnostics.reports.length){
    const option=document.createElement('option'); option.value=''; option.textContent='Нет сохранённых отчётов'; select.appendChild(option);
  }else for (const report of Diagnostics.reports){
    const option=document.createElement('option'); option.value=report.id; option.textContent=diagReportTitle(report); select.appendChild(option);
  }
  if (Diagnostics.reports.some(report=>report.id===previous)) select.value=previous;
  preview.textContent=diagReportText(diagSelectedReport());
  diagRenderLive();
}
function diagRefreshBadge(){
  const badge=document.getElementById('diagbadge'); if (!badge) return;
  badge.style.display=Diagnostics.reports.length?'block':'none';
  badge.textContent=Diagnostics.recovered?'LAST SESSION CRASHED · F3':Diagnostics.reports.length+' REPORT'+(Diagnostics.reports.length===1?'':'S')+' · F3';
}
function openDiagnostics(){
  if (Diagnostics.open) return true;
  Diagnostics.open=true; Diagnostics.wasPaused=!!(G&&G.paused);
  if (G) G.paused=true;
  document.getElementById('diagpanel').style.display='flex';
  diagRefreshPanel(); return true;
}
function closeDiagnostics(){
  if (!Diagnostics.open) return false;
  Diagnostics.open=false; document.getElementById('diagpanel').style.display='none';
  if (G&&!Diagnostics.wasPaused&&!G.quickPaused&&!G.spawnOpen&&!G.testOpen&&!G.inventoryOpen&&!G.over&&!G.pending) G.paused=false;
  return false;
}
function toggleDiagnostics(){ return Diagnostics.open?closeDiagnostics():openDiagnostics(); }
function diagDownloadSelected(){
  let report=diagSelectedReport();
  if (!report) report=diagCreateReport('manual_snapshot',{message:'Manual diagnostic snapshot'});
  const blob=new Blob([diagReportText(report)],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url; link.download='polygrind_'+report.kind+'_'+report.createdAt.replace(/[:.]/g,'-')+'.txt';
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function diagCopySelected(){
  let report=diagSelectedReport();
  if (!report) report=diagCreateReport('manual_snapshot',{message:'Manual diagnostic snapshot'});
  const text=diagReportText(report);
  try { await navigator.clipboard.writeText(text); }
  catch(error){
    const box=document.createElement('textarea'); box.value=text; document.body.appendChild(box); box.select();
    try { document.execCommand('copy'); } catch(ignore){} box.remove();
  }
}
function diagClearReports(){
  Diagnostics.reports=[]; Diagnostics.recovered=false; diagSaveReports(); diagRefreshPanel(); diagRefreshBadge();
}
function diagInit(){
  const stored=diagReadJson(DIAG_REPORTS_KEY,{reports:[]});
  Diagnostics.reports=Array.isArray(stored&&stored.reports)?stored.reports.slice(0,DIAG_MAX_REPORTS):[];
  const previous=diagReadJson(DIAG_SESSION_KEY,null);
  const navigation=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
  const ordinaryReload=!!(navigation&&navigation.type==='reload');
  if (previous&&previous.active&&previous.sessionId&&previous.sessionId!==Diagnostics.sessionId&&!ordinaryReload){
    Diagnostics.recovered=true;
    const alreadyCaptured=Diagnostics.reports.some(report=>report&&report.sessionId===previous.sessionId&&
      ['javascript_error','unhandled_rejection','frame_error','hang','severe_stall','resource_error'].includes(report.kind));
    if (!alreadyCaptured)
      diagCreateReport('unclean_exit',{message:'Previous session did not record a clean pagehide',lastSeen:previous.lastSeen||''},previous);
  }else if (previous&&previous.active&&ordinaryReload){
    diagEvent('ordinary_reload',{previousSessionId:previous.sessionId||''});
  }
  addEventListener('error',event=>{
    if (event.target&&event.target!==window){
      const target=event.target;
      diagCreateReport('resource_error',{tag:target.tagName||'',source:target.currentSrc||target.src||target.href||''});
    }else diagCreateReport('javascript_error',diagErrorDetail(event));
  },true);
  addEventListener('unhandledrejection',event=>{
    const reason=event.reason;
    diagCreateReport('unhandled_rejection',{message:reason&&reason.message||String(reason),stack:reason&&reason.stack||''});
  });
  addEventListener('visibilitychange',()=>{
    if (document.hidden) Diagnostics.skipNextFrame=true;
    if (Diagnostics.worker) try { Diagnostics.worker.postMessage({type:'visibility',visible:!document.hidden}); } catch(error){}
    diagEvent('visibility',{state:document.visibilityState}); diagPersistSession(true);
  });
  addEventListener('pagehide',()=>diagMarkClean('pagehide'));
  addEventListener('beforeunload',()=>diagMarkClean('beforeunload'));
  document.getElementById('diagbadge').onclick=openDiagnostics;
  document.getElementById('diagclose').onclick=closeDiagnostics;
  document.getElementById('diagcapture').onclick=()=>{diagCreateReport('manual_snapshot',{message:'Manual diagnostic snapshot'});diagRefreshPanel();};
  document.getElementById('diagdownload').onclick=diagDownloadSelected;
  document.getElementById('diagcopy').onclick=diagCopySelected;
  document.getElementById('diagclear').onclick=diagClearReports;
  document.getElementById('diagreportselect').onchange=()=>{
    document.getElementById('diagpreview').textContent=diagReportText(diagSelectedReport());
  };
  diagEvent('session_start',{build:diagBuildLabel()});
  diagStartWatchdog(); diagPersistSession(true); diagRefreshPanel(); diagRefreshBadge();
}

function newGame(weaponKey, control, subclassKey, devZone=false){
  stopMenuMusic(true);
  const subclasses = SUBCLASSES[weaponKey] || [];
  const subclass = subclasses.find(s => s.id === subclassKey);
  G = {
    weapon: WEAPONS[weaponKey],
    subclass: subclass ? subclass.id : null,
    devZone:!!devZone,                         // пустая QA-арена без волн, портала и meta-наград
    devGodMode:false,                          // J: бессмертие и +100% скорости только внутри DEV_ZONE
    control: control || 'keys',              // 'keys' — WASD, 'mouse' — бег за курсором
    mouse: {x:0, y:0},
    bag: new Bag(),
    picks: [],                                       // взятые модификаторы (для панели C)
    lvl:1, xp:0, xpNext:14, gold:0,
    items:{},                                // найденные книги: {fire:{tier,val}, ...}
    amu:{},                                  // найденные амулеты: {id:true}, каждый не более раза
    totems:{},                               // найденные тотемы: {fire:2, ...} — ранг 1..4
    floorFinds:[], floorFindSummaryOpen:false, // автосбор хранит уведомления до закрытия всех level-up
    amuT:{golem:10, storm:8, clock:30, mirror:0, calm:0, doll:1,
          pulse:15, gravity:12, steel:0, breath:0, knottedCharm:0, closeHarvestRing:0,
          reactionRing:0, glassBell:0, emptyThroneSeal:0, betweenWorldsBoots:0,
          deadGodClock:0}, // таймеры и заряды предметов
    well:null,                               // воронка «Гравитационного колодца»
    clone:null,                              // копия игрока от «Чёрного зеркала»
    worldShadow:null,                        // неуязвимая приманка «Сапог между мирами»
    // Один переброс — аварийный выход из совсем плохой раздачи, а не четвёртая карта на каждом уровне.
    floor:1, pending:devZone?0:shopLvl('startSkill'), rerolls:1, bossKills:0,
    stats:{damage:0, maxHit:0, crits:0, taken:0, healing:0, distance:0, normals:0, elites:0, bosses:0},
    inventoryOpen:false,
    player:{x:0,y:0,vx:0,vy:0,r:13,hp:100,inv:0,dash:0,dashCd:0,dashN:0,
            atkCd:0, aim:0, dashHits:[], leechPool:0, leechFlows:[], dreadShield:0, barrier:0, reserveBarrier:0, reserveBarrierT:0,
            respiteT:0, respiteHealT:3, criticalMass:0, attackEchoN:0, perfectRhythmHeroN:0, perfectRhythmMinionN:0,
            hitN:0, bladeN:0, groundbreakerWaveN:0, guardianCd:0, guardianHealT:5,
            returnShotN:0, hunterMarkN:0, mirrorVolleyN:0,
            copperNoAttackT:0, copperReady:false, tallyN:0, tallyT:0, draftReady:false, satinReady:false,
            eclipseReady:false, marchingActive:false, secondWindKills:0, reactionCritUntil:0, ledgerStacks:0,
            emptyThroneT:0, emptyThroneReady:false, surgeonTarget:null, surgeonLastHit:0,
            heartSecondCharge:0, stepBeyondReady:false,
            deadGodHistory:[], deadGodDamage:[],
            huntTarget:null, huntUntil:0, huntN:0,
            hobnailedActive:false, trailfinderT:0, trailfinderActive:false, shortCircuitHits:[],
            counterTempoPct:0, counterTempoT:0, ironFuryPct:0, ironFuryT:0, overheatedPct:0, overheatedT:0,
            timeDebtPct:0, timeDebtT:0, timeDebtCoolingT:0,
            kills:0, reaper:false, trailT:0, bossSlowT:0, bossSlowMul:1, bossBurnT:0, bossBurnTick:0, bossBurnCause:'', bossTrailCd:0,bossDots:{},
            elitePoisonT:0, elitePoisonTick:0, elitePoisonStacks:0, eliteCutT:0, eliteCutTick:0,
            elitePyroBurnT:0, elitePyroBurnTick:0, eliteAbyssBurnT:0, eliteAbyssBurnTick:0,
            eliteGuardSlowT:0, eliteGuardSlowStacks:0,
            moveT:0, predT:0, critChain:0, riposte:false, swiftT:0, spdKill:0, sprintT:0, lowHp:false, moving:false, faceX:1, faceY:0, spriteFace:1, heroWalkT:0,
            stillT:0, killT:0, cheatCd:0, cheatSpeedT:0, healCd:0, fastHealT:5, onCritHealReadyAt:0,
            hitFlash:0, hpFlash:0, hpLag:1, hpLagFrom:1, hpLagTimer:0},
    enemies:[], shots:[], delayedShots:[], attackEchoes:[], stepBeyondEchoes:[], eshots:[], orbs:[], fx:[], fxPool:[], transientFxCounts:{num:0,status:0}, bloodFx:[], bloodFxPool:[], bloodGroundCanvas:null, bloodGroundCtx:null, bloodStampN:0, bloodBurstTime:-Infinity, bloodBurstN:0, arcaneTraces:[], arcaneMines:[], repeatDetonations:[], groundbreakerCracks:[], sparkSigils:[],
    parts:[], partPool:[],                    // пиксельные частицы и их переиспользуемые объекты
    frameScratch:{
      chillSources:[],chillGrid:null,infernoGrid:null,postMoveGrid:null,postMoveReady:false,
      activeChillGrid:null,activeInfernoGrid:null,
      minionCandidates:[],minionCandidatePool:[],minionCandidatesReady:false,minionClaims:new Map(),
      packMods:{spd:1,dmg:1,aspd:1},
    },
    minions:[], corpses:[], raiseT:0,        // свита, временный ресурс Некроманта и таймер подъёма
    visualCorpses:[], visualCorpseHead:0, corpseRng:(Date.now()^0x6d2b79f5)>>>0, // постоянные трупы всех классов и отдельный cosmetic RNG
    spawnQueue:0, spawnT:0, portal:null,
    pools:[], banner:false,                  // лужи смолы и флаг знаменосца
    trails:[],                               // огненный и ледяной след от ботинок
    boils:[],                                // лужи «Кипящей крови»
    acidPools:[],                            // кислота веномансера от павших приспешников
    eliteAcidPools:[],                       // двухсекундные лужи Чумоносного огра
    bossPools:[],                            // десятисекундная кислота Чумной Мерзости
    bossTrails:[],                           // короткий огненный след Рогатого Тирана
    bossHazards:[],                          // длительные зоны новых боссов: чернила, песок и безопасный свет
    packs:[],                                // живые пачки элиты на этаже
    time:0, orbitA:0, paused:false, quickPaused:false, over:false, testOpen:false, spawnOpen:false, spawnWasPaused:false, target:null, keys:{},
    hitStop:0, hurtVignette:0, hurtVignetteMax:0, hurtVignetteOpacity:0,
    bloodT:0,                                // остаток ярости КРОВНЫХ УЗ, секунды
  };
  shopApply(G.bag);        // покупки магазина входят в сумку до первого пересчёта
  recalc();
  G.player.hp = D.life;
  G.player.deadGodHistory=[{t:0,x:G.player.x,y:G.player.y,hp:G.player.hp}];
  G.player.dashN = D.dashMax;                       // забег начинается с полным запасом рывков
  // Некромант начинает именно с полной базовой тройкой, без ожидания первого
  // тика воскрешения. Последующие лимиты по-прежнему заполняет общий raiseT.
  if (D.hasMin) for (let i=0;i<Math.min(SKELETON_BASE_LIMIT,D.maxSkel);i++) spawnMinion();
  diagEvent('run_start',{weapon:weaponKey,subclass:G.subclass||'',devZone:!!devZone});
  buildFloor();
}

/* D — производные характеристики. Пересчитываются только при изменении билда. */
let D = {};
function recalc(){
  const b = G.bag, w = G.weapon;
  const glass  = b.has('kGlass'),  noCrit = b.has('kNoCrit'), heavy = b.has('kHeavy');
  const flurry = b.has('kFlurry'), acro   = b.has('kAcro');
  const unburd = b.has('kUnburd');
  const timeDebt = b.has('kTimeDebt');
  const livingFortress = w.type === 'melee' && b.has('kLivingFortress');
  const unsheathedBlade = w.type === 'melee' && b.has('kUnsheathedBlade');
  const oneArrowTechnique = w.id === 'wpn.bow' && b.has('kOneArrow');
  D.timeDebt=timeDebt; D.livingFortress=livingFortress; D.unsheathedBlade=unsheathedBlade;
  D.unburdened=unburd;
  D.oneArrowTechnique=oneArrowTechnique;
  const sub = G.subclass;
  const thief = sub === 'thief', hunter = sub === 'hunter', dancer = sub === 'dancer';
  const destroyer = sub === 'destroyer', multiplier = sub === 'multiplier', elementalist = sub === 'elementalist';
  const graverobber = sub === 'graverobber', animator = sub === 'animator';
  const berserker = sub === 'berserker', guardian = sub === 'guardian', swordmaster = sub === 'swordmaster';
  const thiefMove = thief ? 1 + G.lvl/100 : 1;
  const graveMove = graverobber ? 1 + G.lvl/100 : 1;
  const subclassLifeInc = guardian ? G.lvl
    : dancer ? Math.floor(G.lvl/5) : 0;

  // --- Живучесть ---
  const lifeEntry = b.s.life;
  D.life   = (100 + G.lvl*4 + (lifeEntry ? lifeEntry.flat : 0))
           * (1 + ((lifeEntry ? lifeEntry.inc : 0) + subclassLifeInc)/100)
           * (lifeEntry ? lifeEntry.more : 1) * (glass ? 0.6 : 1);
  D.regen  = b.calc('regen', 0) + D.life * b.flat('regenPct')/100;
  D.guardianHeal = guardian ? Math.floor(G.lvl/5)*5 : 0;
  D.respite = b.has('respite');
  D.durabilityReserve = b.has('durabilityReserve');
  if (G.player){
    G.player.reserveBarrier = D.durabilityReserve ? Math.min(G.player.reserveBarrier||0,D.life*0.12) : 0;
    if (!D.durabilityReserve) G.player.reserveBarrierT=0;
  }
  D.hobnailedActive=!!(amu('hobnailedSoles') && G.player && G.player.hobnailedActive);
  D.trailfindersActive=!!(amu('trailfinders') && G.player && G.player.trailfinderActive);
  const armorBase = unburd ? 0 : b.calc('armor', 0) + (amu('golem') ? 50 : 0)
    + (D.hobnailedActive ? 20 : 0);
  D.armor  = unsheathedBlade ? 0 : armorBase * (livingFortress ? 1.30 : 1);
  // Две отдельные ветки защиты от рангов врагов. Это множители после общей
  // защиты: −25% означает, что от соответствующего врага проходит 75% урона.
  D.normalDr = clamp(b.sum('normalDr'), 0, 25);
  D.majorDr  = clamp(b.sum('majorDr'), 0, 25);
  D.drShop = 0;
  D.drFlat = b.flat('drFlat');
  D.dodge  = livingFortress ? 0 : clamp((b.flat('dodge') + (dancer ? G.lvl : 0)) * (acro ? 2 : 1), 0, 70);
  D.thornsRaw = w.type === 'melee' ? clamp(b.sum('thorns'), 0, 100) : 0;
  D.thorns = D.thornsRaw * (livingFortress ? 2 : 1);
  D.thornCircle = w.type === 'melee' && b.has('thornCircle');
  D.ironFury = w.type === 'melee' && b.has('ironFury');
  // «Налегке» запрещает и динамическую броню: Стальная толпа не должна
  // обходить обнуление, применяясь отдельно уже в hurt().
  D.steelCrowd = w.type === 'melee' && !unburd ? clamp(b.flat('steelCrowd'), 0, 10) : 0;
  D.holdLine = w.type === 'melee' && b.has('holdLine');
  // Клык вампира прибавляется ПОСЛЕ потолка: иначе амулет не делал бы ничего
  // тому, кто уже упёрся в 25%, а это ровно тот билд, который его и ищет
  D.leechBase   = clamp(b.flat('leech'), 0, 25) + (amu('fang') ? 4 : 0);
  D.leech       = D.leechBase;
  /* УЖАСАЮЩИЙ ВАМПИР перекрывает обычный вампиризм и лечение одним флагом.
     Его собственное восстановление идёт отдельным потоком через dreadRecover():
     так новый источник обычного лечения не сможет случайно обойти кейстоун. */
  D.dread       = b.has('kDread') && !w.minions; // старый кейстоун недоступен и не действует у Некроманта
  if (D.dread) D.leech = 0.5;
  if (G.player) G.player.dreadShield = D.dread ? Math.min(G.player.dreadShield||0, D.life*0.15) : 0;
  D.leechInstant= b.has('leechInstant');
  D.onKill = b.flat('onKill'); D.onHit = b.flat('onHit'); D.onCrit = b.flat('onCrit');
  D.pctHp = clamp(b.flat('pctHp'),0,10);

  // --- Урон: база оружия + стихии, всё по формуле каталога ---
  D.incAll = (b.s.dmg ? b.s.dmg.inc : 0) + (w.type==='melee'? b.sum('dmgMelee') : 0)
           + (w.type!=='melee'? b.sum('dmgProj') : 0) + (w.type==='orb'? b.sum('dmgAoe') : 0)
           + (D.ironFury && G.player && G.player.ironFuryT>0 ? G.player.ironFuryPct||0 : 0);
  // Новый Берсерк получает общий процент урона: формулировка больше не
  // ограничивает бонус только прямым взмахом Воина.
  if (berserker) D.incAll += G.lvl;
  D.warriorMeleeInc = 0;
  D.berserkerHitHeal = berserker ? Math.floor(G.lvl/5)*2 : 0;
  D.warriorMeleeMore = unsheathedBlade ? 1.40 : 1;
  D.moreAll = (b.s.dmg ? b.s.dmg.more : 1) * (glass?1.6:1) * (noCrit?1.5:1) * (heavy?4:1) * (flurry?0.5:1);

  // Уровень и этаж сами по себе не усиливают удар: рост урона приходит только
  // из выбранных карточек, предметов и явно заявленных особенностей подкласса.
  const phys = w.dmg[0] + b.flat('dmg');
  const physMax = w.dmg[1] + b.flat('dmg');
  D.baseMin = phys;  D.baseMax = physMax;
  // «Надёжный удар» поднимает только нижнюю границу к верхней. Максимум не
  // уменьшается, поэтому карточка действительно повышает средний урон.
  if (b.has('armorDmg')){ D.baseMin += D.armor*0.12; D.baseMax += D.armor*0.12; }  // conv.armor_damage
  D.narrow = clamp(b.sum('narrow'),0,50);
  D.baseMin += (D.baseMax-D.baseMin)*(D.narrow/100);

  // Книги — отдельный источник флэт-урона: сумка их не хранит, чтобы тир можно было поднимать
  const bk = k => (G.items && G.items[k]) ? G.items[k].val : 0;
  // Амулеты стихий кладутся в тот же процент, что и карточки: «+35% к огню»
  // с амулета и с карточки обязаны быть неотличимы, иначе появится вторая формула
  // Корона пепла бьёт по всем четырём стихиям сразу, поэтому кладётся в каждую
  const aAll  = amu('crown') ? 50 : 0;
  const aFire = (amu('ash') ? 35 : 0) + aAll, aCold = (amu('ice') ? 35 : 0) + aAll,
        aPoi  = (amu('plague') ? 35 : 0) + aAll, aLit = aAll;
  const subElement = elementalist ? G.lvl*3 : 0;
  D.elem = {                                          // каждая стихия считается отдельно
    fire: (b.flat('dFire') + bk('fire')) * (1 + (b.sum('iFire')+aFire+subElement)/100),
    cold: (b.flat('dCold') + bk('cold')) * (1 + (b.sum('iCold')+aCold+subElement)/100),
    lit:  (b.flat('dLit')  + bk('shock'))* (1 + (b.sum('iLit') +aLit +subElement)/100),
    poi:   b.flat('dPoi')               * (1 + (b.sum('iPoi') +aPoi +subElement)/100),
  };

  // --- Криты ---
  D.noCrit = noCrit;
  D.critCh  = noCrit ? 0 : clamp(b.calc('critCh', 5), 0, 100);
  D.criticalMass = b.has('criticalMass');
  D.perfectRhythm = b.has('perfectRhythm') && !noCrit;
  D.superCh = clamp(b.flat('superCh'), 0, 100);
  D.critMul = 150 + b.flat('critMul');

  // --- Скорости ---
  /* Два талисмана разгона. Считаются здесь, вместе с прочими множителями
     скорости, а не отдельной поправкой в бою: свита наследует обе скорости
     хозяина целиком, и это единственный способ разогнать её заодно,
     не дублируя одно и то же правило в трёх местах. */
  const P = G.player;
  const timeDebtSpeed = timeDebt && P && P.timeDebtT > 0 ? 1 + (P.timeDebtPct||0)/100 : 1;
  const rush = (amu('swift') && P && P.swiftT > 0 ? 1.20 : 1)
             * (amu('survive') && P && P.hp/Math.max(1, D.life) < 0.30 ? 1.20 : 1);
  /* Разгон движения: считается ЗДЕСЬ, а не множителем в кадре. Раньше три
     источника (карточка после убийства, «Последний рывок», «Талисман бегуна»)
     умножались прямо в шаге игрока, а свита берёт долю от скорости хозяина —
     то есть от значения ДО них, и не разгонялась вообще. Теперь всё в одном месте,
     и приспешники едут вместе с хозяином без отдельного правила. */
  const dash = (P && P.spdKill > 0 ? 1.25 : 1)
             * (P && P.sprintT > 0 ? 1.40 : 1)
             * (P && P.cheatSpeedT > 0 ? 1.50 : 1)
             * (amu('runner') && P && P.moving ? 1.20 : 1);
  D.counterTempoPerHit = w.type === 'melee' ? clamp(b.sum('counterTempo'),0,50) : 0;
  /* Обычные положительные множители скорости атаки живут в одной корзине.
     Карточка more, Охотник, предметы и временные стаки добавляют процентные
     пункты, а не перемножают друг друга. Кейстоуны и штрафы остаются отдельными:
     они меняют правило билда, а не являются ещё одним накопительным бонусом. */
  const aspdEntry=b.s.aspd;
  const ordinaryAttackSpeedPct = (amu('clock') ? 10 : 0) + (amu('claws') ? 20 : 0)
    + (amu('swift') && P && P.swiftT > 0 ? 20 : 0)
    + (amu('survive') && P && P.hp/Math.max(1,D.life) < 0.30 ? 20 : 0)
    + (hunter ? Math.floor(G.lvl/5) : 0)
    + (P && P.counterTempoT > 0 ? P.counterTempoPct||0 : 0)
    + (P && P.overheatedT > 0 ? P.overheatedPct||0 : 0)
    + (amu('tallyGloves') && P && P.tallyT>0 ? 20 : 0);
  D.attackSpeedMore = (aspdEntry ? aspdEntry.more : 1) + ordinaryAttackSpeedPct/100;
  D.aspd  = (1 + (aspdEntry ? aspdEntry.flat : 0))
          * (1 + (aspdEntry ? aspdEntry.inc : 0)/100) * D.attackSpeedMore
          * (heavy?0.5:1) * (flurry?2:1) * (unburd?1.25:1)
          * (amu('brute') ? 0.90 : 1) * (amu('titansHands') && w.id==='wpn.sword' ? 0.65 : 1)
          * timeDebtSpeed * (livingFortress ? 0.80 : 1);
  const marchDeadActive=amu('marchDead') && w.minions;
  D.mspd  = b.calc('mspd', 235) * (acro?1.15:1) * (unburd?1.35:1) * rush * dash
          * thiefMove * graveMove * (D.trailfindersActive ? 1.10 : 1) * (livingFortress ? 0.70 : 1)
          * (marchDeadActive ? 0.70 : 1) * (G.devZone && G.devGodMode ? 2 : 1);

  // --- Геометрия ---
  /* Все подклассы Мага получают общий +1 снаряд за каждые 15 уровней.
     Мультипликация больше не добавляет гарантированные шары от уровня: каждый
     обычный шар отдельно бросает 35% шанс на мини-копию с 20% урона и 60% AoE.
     Карточка projN оставлена только Лучнику: для Мага она слишком сильно
     умножала урон сферы поверх уже встроенного классового роста. */
  const mageProjectiles = w.id === 'wpn.wand' ? Math.floor(G.lvl/15) : 0;
  D.projN   = oneArrowTechnique ? 1 : 1 + Math.round(b.flat('projN')) + mageProjectiles;
  D.multiplierMiniChance = multiplier ? 0.35 : 0;
  D.multiplierMiniDamage = 0.20;
  D.multiplierMiniArea = 0.60;
  D.multiplierMiniDelay = 0.10;
  D.pierceBase = clamp(Math.round(b.flat('pierce')), 0, 4);
  D.pierce  = D.pierceBase + (oneArrowTechnique ? 3 : 0);
  D.chainBase = Math.round(b.flat('chain'));
  D.chain   = D.chainBase + (amu('ricochet') ? 1 : 0);
  D.ricochet= clamp(Math.round(b.flat('ricochet')), 0, RICOCHET_SHARD_CAP);
  D.featherSpeed = w.id === 'wpn.bow' ? b.sum('featherSpeed') : 0;
  D.featherHoming = w.id === 'wpn.bow' ? G.picks.filter(x=>x.id==='archer.fletching').reduce((sum,x)=>{
    const v=Number.isFinite(x.v)?x.v:7; return sum+Math.round(3+(v-7)*0.4);
  },0) : 0;
  D.homing  = Math.min(100,b.sum('homing')+D.featherHoming)/100;
  D.projSpd = (1 + (b.sum('projSpd')+D.featherSpeed)/100) * (amu('arrow') ? 1.5 : 1);
  D.arrowFlight = w.id === 'wpn.bow' ? 1+b.sum('arrowFlight')/100 : 1;
  D.acceleratedArrow = w.id === 'wpn.bow' ? b.sum('acceleratedArrow') : 0;
  D.swiftArrows = w.id === 'wpn.bow' && b.has('swiftArrows');
  D.cleanTrajectory = w.id === 'wpn.bow' ? b.sum('cleanTrajectory') : 0;
  D.elementalPierce = w.id === 'wpn.bow' && b.has('elementalPierce');
  D.oneArrowDamage = oneArrowTechnique ? 2.40 : 1;
  D.splitArrow = w.id === 'wpn.bow' && b.has('splitArrow') && !oneArrowTechnique;
  D.returnShot = w.id === 'wpn.bow' && b.has('returnShot');
  D.hunterMark = w.id === 'wpn.bow' && b.has('hunterMark');
  D.mirrorVolley = w.id === 'wpn.bow' && b.has('mirrorVolley');
  D.projSize= 1 + b.sum('projSize')/100;
  D.overpressure = b.has('overpressure');
  D.arcanePull = clamp(b.sum('arcanePull'), 0, 100);
  D.blastHeart = w.type === 'orb' ? b.sum('blastHeart') : 0;
  D.elementalExplosion = w.type === 'orb' && b.has('elementalExplosion');
  D.residualArcana = w.type === 'orb' ? b.sum('residualArcana') : 0;
  D.overheatedPerExplosion = w.type === 'orb' ? b.sum('overheatedOrb') : 0;
  D.remoteBlast = w.type === 'orb' ? b.sum('remoteBlast') : 0;
  D.arcaneMine = w.type === 'orb' && b.has('arcaneMine');
  D.repeatDetonation = w.type === 'orb' && b.has('repeatDetonation');
  // Все регулярно накапливаемые +% радиуса живут в одной корзине. Локальные
  // бонусы конкретного удара добавляются к ней через playerAreaRadius();
  // уникальные изменения формы способности остаются отдельным множителем.
  D.aoeRadiusPct = b.sum('aoeR') + (destroyer ? G.lvl : 0);
  D.aoeR    = 1 + D.aoeRadiusPct/100;
  if (b.has('aoeToDmg')) D.incAll += (D.aoeR-1)*60;      // conv.aoe_to_damage
  // Площадные радиусы: считаются здесь один раз на смену билда, а не в кадре
  D.shockR     = SHOCK_RANGE    * D.aoeR;   // разлёт молний при шоке
  D.chillAuraR = CHILL_AURA_R   * D.aoeR;   // вязкость вокруг охлаждённого
  D.slowAuraR  = SLOW_AURA_BASE * D.aoeR;   // аура замедления врагов
  D.infernoR   = INFERNO_BASE   * D.aoeR;   // перекидывание поджога
  D.arc     = (1 + b.sum('arc')/100) * (unsheathedBlade ? 1.50 : 1);
  D.longBlade = w.type === 'melee' ? clamp(b.sum('longBlade'),0,60) : 0;
  D.longBladeRange = 1 + D.longBlade/100;
  D.deadlyRadius = w.type === 'melee' && b.has('deadlyRadius');
  D.threeStep = w.type === 'melee' && b.has('threeStep');
  D.groundbreaker = w.type === 'melee' && b.has('groundbreaker');
  D.openWound = w.type === 'melee' ? b.sum('openWound') : 0;
  D.berserker = berserker; D.guardian = guardian; D.swordmaster = swordmaster;
  const swordmasterStep = Math.floor(G.lvl/2)*3;
  D.warriorWaveRadius = swordmaster ? 1 + Math.min(50, swordmasterStep)/100 : 1;
  D.warriorWaveKnock  = swordmaster ? 1 + Math.min(80, swordmasterStep)/100 : 1;
  D.orbitN      = clamp(Math.round(b.flat('orbit')), 0, 10);   // круговые орбы, потолок 10
  D.novaKillBase = clamp(b.flat('novaKill'), 0, 50);
  D.novaKillStrong = b.has('novaKillStrong');
  D.novaKillChance = D.novaKillStrong ? 65 : D.novaKillBase;
  D.novaKillDamage = D.novaKillStrong ? 1.25 : 1;
  D.explodeBase = clamp(b.flat('explode'), 0, 25);
  D.explode     = b.has('kVolat') ? 100 : D.explodeBase;
  D.explodeMega = clamp(b.flat('explodeMega'), 0, 100);
  D.plagueRadius= b.has('kVolat') ? 0.65 : 1;
  D.dblHit   = clamp(b.flat('dblHit'), 0, 25);
  D.attackEcho = b.has('attackEcho');
  D.elementalOverload = b.has('elementalOverload');
  D.lastWitness = b.has('lastWitness');
  D.deadlyHit= b.has('deadlyHit');
  D.shotgun = b.has('shotgun') && !oneArrowTechnique;
  D.chainKeep = b.has('chainKeep') || oneArrowTechnique;
  D.pierceBonus = b.has('pierceBonus');

  // --- Прочее ---
  // Радиус больше не раздаётся карточкой: остаются только фиксированная база
  // и отдельный предмет «Охотник за лутом».
  D.pickup  = 70 * (amu('looter') ? 5 : 1);
  D.lootVacuum = 1;
  D.lootPickup = D.pickup * D.lootVacuum;
  // Бегун движется со скоростью 170: опыт и золото притягиваются в 2,5 раза быстрее.
  D.lootPull   = 425 * D.lootVacuum;
  D.xpGain  = 1 + b.sum('xpGain')/100;
  // ВОР добавляет свои +2% за уровень в общий процент золота вместе с магазином,
  // карточками и книгами. Отдельного перемножения поверх готовой награды нет.
  D.goldFind= 1 + (b.sum('goldFind') + (thief ? G.lvl*2 : 0))/100;
  D.goldGainMult = 1; // совместимость со старыми диагностическими сценариями
  // Книга крови: N% от автоатаки в секунду. avgHit уже содержит все проценты,
  // поэтому отдельно домножать не нужно — иначе получится двойной скейл.
  D.bookBleedDps = 0;                                  // считается ниже, после avgHit
  D.monsterMore  = (1 + ((G.items && G.items.monster) ? G.items.monster.val : 0)/100)
                 * (amu('candle') ? 1.20 : 1)
                 * (1 + shopLvl('smon')/100);
  if (G.items && G.items.xp) D.xpGain += G.items.xp.val/100;
  if (amu('candle')) D.xpGain += 0.15;
  D.dashMax = clamp(1 + Math.round(b.flat('dashN')) + (dancer ? 1 : 0), 1, 3);
  D.dashDmg = b.has('dashDmg'); D.phasing = b.has('phasing');
  D.dashRecovery = b.sum('dashRecharge');
  D.dashLength = b.sum('dashLength');
  D.dashCd  = DASH_COOLDOWN / (1 + D.dashRecovery/100) * (amu('stepBeyond') ? 2 : 1);
  D.dashSpeedMul = DASH_SPEED_MULT * (1 + D.dashLength/100);
  D.iframe  = 0.22 * (1 + b.sum('iframe')/100);
  // Четыре универсальные стихийные ветки ограничены 25%: ранний забег больше
  // нельзя превратить в гарантированную цепочку статусов несколькими картами.
  D.igniteCh = clamp(b.flat('igniteCh'), 0, 25);
  D.chillCh  = clamp(b.flat('chillCh'),  0, 25);
  D.shockCh  = clamp(b.flat('shockCh'),  0, 25);
  D.poiCh    = clamp(b.flat('poiCh'),    0, 25);
  D.knock    = clamp(b.flat('knock') + (amu('brute') ? 50 : 0), 0, 75);
  D.stun     = clamp(b.flat('stun'), 0, 50);
  D.knockPow = amu('brute') ? 1.5 : 1;                 // сила толчка отдельно от шанса
  D.inferno  = b.has('inferno'); D.freeze = b.has('freeze');
  D.tesla    = b.has('tesla'); D.radiation= b.has('radiation'); D.dizzy = b.has('dizzy');
  D.slowAura = b.has('slowAura'); D.coldShatter = b.has('coldShatter');
  D.ailEff  = 1 + b.sum('ailEff')/100;
  D.ailDur  = 1 + b.sum('ailDur')/100;
  D.freezeDur = amu('ice') ? 1.4 : 1;        // ледяной кристалл продлевает только заморозку
  // Яд из книги обязан оставаться актуальным на любом этаже, поэтому скейлится полностью.
  // Стоит ИМЕННО ЗДЕСЬ, а не выше среди прочего: D — объект живучий, и расчёт,
  // стоявший до присвоения D.ailEff, брал значение с прошлого пересчёта. «+100% к силе
  // эффектов» с книгой яда давало 12 урона в секунду вместо 24, и выправлялось только
  // следующей взятой карточкой. Любую новую строку с D.ailEff/D.ailDur держать ниже этой.
  D.bookPoiDps = (G.items && G.items.poison)
    ? G.items.poison.val * 4 * (1 + (b.sum('iPoi')+aPoi+subElement)/100) * (1 + D.incAll/100) * D.moreAll * D.ailEff
    : 0;
  D.atkCd   = w.cd / D.aspd;

  // --- Свита: считается по той же формуле, наследование берёт % от ваших статов ---
  D.hasMin    = !!w.minions;
  D.minInherit= b.flat('minInherit')/100;
  D.minTier   = b.has('minTier');
  const skeletonRanks=Math.min(SKELETON_CARD_RANKS,Math.max(0,Math.round(b.flat('minCount'))));
  D.maxSkel   = D.hasMin ? SKELETON_BASE_LIMIT + skeletonRanks + (animator ? Math.floor(G.lvl/20) : 0) : 0;
  D.maxBomb   = D.hasMin ? clamp(Math.round(b.flat('minBomb')), 0, 6) : 0;
  D.golemB    = D.hasMin ? clamp(Math.round(b.flat('golemBlood')), 0, 10) : 0;
  D.golemN    = D.hasMin ? clamp(Math.round(b.flat('golemBone')),  0, 10) : 0;
  D.minMax    = D.maxSkel + D.maxBomb + (D.golemB?1:0) + (D.golemN?1:0);
  /* Свита получает весь уже собранный прирост урона хозяина, но её собственный
     +% урона и карточка наследования добавляются к этому приросту, а не ещё раз
     умножают готовый удар. Уникальные Кровные узы и старший ранг остаются more. */
  const minionReferenceHit=Math.max(1e-9,(D.baseMin+D.baseMax)/2+D.elem.fire+D.elem.cold+D.elem.lit+D.elem.poi);
  const ownerAverageHit=Math.max(1e-9,avgHit());
  const ownerDamageFactor=ownerAverageHit/minionReferenceHit;
  const minionDamageFactor=ownerDamageFactor+b.sum('minDmg')/100+D.minInherit;
  D.minDmgMul = 0.42 * (minionReferenceHit/ownerAverageHit) * minionDamageFactor
                * (b.has('kBond') ? 1.5 : 1) * (D.minTier ? 1.45 : 1);
  /* ГОЛЕМ КРОВИ. На первом уровне бьёт вдвое реже скелета и втрое сильнее,
     дальше растёт урон и понемногу темп. Считается от D.minDmgMul, поэтому
     вбирает все карточки урона свиты, наследование и «Кровные узы».
     Раньше урон был 0.08 * уровень от avgHit() мимо множителя свиты — на
     десятом уровне это давало 0.92 от одного скелета, то есть десять карточек
     были слабее одного бесплатного приспешника. */
  D.golemBMul = D.golemB ? 3 * D.minDmgMul * (1 + 0.35*(D.golemB-1)) : 0;
  D.golemBCd  = D.golemB ? 1.0 / (1 + 0.05*(D.golemB-1)) : 1.0;
  D.minDmgRaw  = b.sum('minDmg');             // порог для «Буйства демонов»
  D.boneField  = D.hasMin && b.has('boneField') ? 5 : 0;
  D.minFrenzy  = b.has('minFrenzy');
  D.minSpdRaw  = b.sum('minSpd');             // порог для карточек переноса
  D.minAspdRaw = b.sum('minAspd');            // порог для карточек когтей
  D.minClaws   = b.has('minClaws');
  D.minWhirl   = b.has('minWhirl');
  /* Перенос свиты. Астральный набег ЗАМЕНЯЕТ внезапный взрыв, а не складывается
     с ним: два независимых таймера означали бы, что приспешник телепортируется
     дважды подряд и половина переносов уходит впустую. Поэтому одна механика
     с тремя числами, которые задаёт старшая из взятых карточек. */
  D.minBlink   = b.has('minRaid') ? {cd:4,  mul:0.50, r:100}
               : b.has('minBlink') ? {cd:10, mul:0.30, r:60}
               : null;
  D.minBath    = b.has('minBath');
  D.venomancer = sub === 'venomancer';
  D.minBoil    = b.has('minBoil');
  /* Здоровье свиты растёт по этажу тем же множителем, что и у врагов.
     Замер до правки: на 5 этаже жило 5.7 приспешника из 6, на 10-м — 0.1,
     дальше ноль. Линейный рост (30 + уровень*2.6) против здоровья врагов
     на 14% за этаж означал, что армия перестаёт существовать между пятым
     и десятым этажом, и весь класс держался на одном хозяине. */
  D.minLife   = (30 + G.lvl*2.6) * hpScale(G.floor) * (D.minTier ? 1.6 : 1)
                + D.life * D.minInherit * 0.25;
  /* База скорости свиты. Бег: было 305 против 235 у игрока — приспешник еле
     обгонял хозяина и в бою плёлся сзади, не успевая добежать до цели и вернуться.
     Скорость атаки — чистый множитель к откатам ниже, а сами откаты приведены
     к тому, что скелет бьёт ровно дважды в секунду на старте. Множитель 1.5,
     которым это делалось раньше, убран: числа в цикле теперь честные секунды,
     и «0.5» читается как полсекунды, а не как «0.78, делённое на полтора». */
  /* Свита наследует весь итоговый прирост/штраф скорости хозяина, но складывает
     его со своими процентами от базового темпа. Поэтому +100% хозяина и +100%
     свиты дают ×3, а не ×4. Кейстоуны хозяина по-прежнему входят через D.aspd. */
  const marchingActive=!!(amu('marchingGreaves') && P && P.marchingActive);
  D.minAspd   = Math.max(0.05,D.aspd + b.sum('minAspd')/100 + (marchingActive?0.10:0));
  D.skelAspd  = amu('warskel') ? 1.25 : 1;      // БОЕВЫЕ СКЕЛЕТЫ: только рядовые скелеты
  const ownerMoveFactor=(D.mspd/235)/thiefMove/(marchDeadActive?0.70:1);
  D.minSpd    = 610 * Math.max(0.05,ownerMoveFactor + b.sum('minSpd')/100 + (marchingActive?0.20:0))
              * (marchDeadActive ? 1.80 : 1);
  D.minSlowImmune=!!marchDeadActive;
  /* Шанс крита свиты. Раньше твой собственный шанс доходил до приспешников
     только через карточку наследования, то есть обе критовые ветки при её
     отсутствии не давали свите ровно ничего — а у некроманта свита и есть
     основной урон. Теперь твой шанс наследуется ЦЕЛИКОМ, как обе скорости,
     а карточка наследования сверх этого добавляет свою долю. */
  D.minCrit   = clamp(b.sum('minCrit') + D.critCh * (1 + D.minInherit), 0, 100);
  /* Воскрешение фиксированное для всех: скелетов, бомбардиров и големов.
     Раньше было 5 секунд с карточкой на ускорение, и карточка почти не работала:
     подъём из трупа шёл за 0.4 сек мимо неё, а «пустой» подъём нужен ровно тогда,
     когда убивать некого. Замер показывал разницу только на пятом этаже,
     дальше свиту выкашивали быстрее, чем она вставала при любой скорости. */
  D.minRevive = 0.25;
  D.minBoom   = b.has('minBoom');
  D.boneChallenge = D.hasMin && b.has('kBoneChallenge');
  D.deathLord = D.hasMin && b.has('kDeathLord');
  /* Ветка перехвата качается до 50% — своим потолком, отдельно от кейстоуна.
     Раньше был общий потолок 75 без своего: из-за диапазона 20-35 за карточку
     ветка закрывалась двумя-тремя взятиями и никакой прокачки не получалось.
     Теперь шаг 8-14, то есть на 50% уходит четыре-пять карточек. */
  D.minBondRaw = clamp(b.flat('minBond'), 0, 50);
  D.minBond   = clamp(D.minBondRaw + (b.has('kBond') ? 40 : 0), 0, 75);
  D.bloodTies = b.has('bloodTies');

  if (G.player) G.player.hp = Math.min(G.player.hp, D.life);
}

/* Урон кровотечения из книги. Отдельной функцией, потому что зависит от avgHit(),
   а тот сам читает D — прямой расчёт внутри recalc дал бы циклическую ссылку. */
function bookBleedDps(){
  return (G.items && G.items.bleed) ? avgHit() * (G.items.bleed.val/100) * D.ailEff : 0;
}

/* Оценка среднего урона за удар — для строки ДПС в интерфейсе */
function avgHit(){
  const base = (D.baseMin+D.baseMax)/2;
  const el = D.elem.fire+D.elem.cold+D.elem.lit+D.elem.poi;
  const raw = (base+el) * (1 + D.incAll/100) * D.moreAll;
  const crit = 1 + (D.critCh/100) * (D.critMul/100 - 1);
  return raw * crit;
}
// Только интерфейс: реальный бонус Берсерка применяется в damage(), чтобы не
// усиливать эффекты, которые лишь используют avgHit() как расчётную базу.
function attackAvgHit(){
  return avgHit() * (1 + (D.warriorMeleeInc||0)/100) * (D.warriorMeleeMore||1) * (D.oneArrowDamage||1);
}

function heartSecondAttackMul(){
  return amu('heartSecond') ? 1+clamp(G.player.heartSecondCharge||0,0,0.60) : 1;
}
function currentAttackCooldown(){ return D.atkCd/heartSecondAttackMul(); }
