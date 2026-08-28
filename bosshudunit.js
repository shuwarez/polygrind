/* Компактный Canvas Boss HUD: 1–4 босса, rare, маркеры и отсутствие старого banner. */
const fs=require('fs');
const {loadGame}=require('./harness');
const html=fs.readFileSync('./PolyGrind.html','utf8');
let n=0,fail=0;
function ok(name,yes,got=''){
  n++; if(!yes) fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ')+name.padEnd(66)+got);
}
function between(a,b){ const i=html.indexOf(a),j=html.indexOf(b,i+a.length); return i>=0&&j>i?html.slice(i,j):''; }

ok('старый DOM #bossbar полностью удалён',!html.includes('id="bossbar"') && !html.includes("$('#bossbar')"));
ok('CSS большой панели босса полностью удалён',!html.includes('#bossbar') && !html.includes('.bsep'));
ok('боссовый этаж больше не показывает имена и аффиксы через toast',
  !html.includes('ДВА БОССА') && !/bosses\.map|affNm.*toast/.test(between('function buildFloor()','const hpScale')));
ok('боссовый этаж сохраняет только компактное уведомление номера этажа',
  /if \(plan\.isBossFloor\)[\s\S]*?toast\('ЭТАЖ ' \+ f\)/.test(between('function buildFloor()','const hpScale')));
ok('появление босса не меняет паузу и не создаёт overlay',
  !/paused|innerHTML|classList/.test(between('if (plan.isBossFloor){','} else if (packAffixCount')));
ok('Boss HUD является отдельным последним Canvas-проходом',
  /'worldHud','combatText','bossHud'/.test(html) && /if \(pass==='bossHud'\)/.test(html));
ok('экранный Boss HUD рисуется без трансформации камеры',
  html.indexOf("if (pass==='bossHud')")<html.indexOf('ctx.translate(W/2 - p.x'));

const collectSrc=between('function collectBossHudTargets()','function bossHudInfo');
ok('активные боссы ищутся одним циклом без filter/map',
  /for \(let i=0;i<G\.enemies\.length;i\+\+\)/.test(collectSrc) && !/\.filter\(|\.map\(/.test(collectSrc));
ok('сборщик хранит ссылки максимум на четыре экземпляра',
  /BOSS_HUD_TARGETS=\[null,null,null,null\]/.test(html) &&
  /BOSS_HUD_TARGETS\[BOSS_HUD_COUNT\+\+\]=e/.test(collectSrc));

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const ids=['lich','goat','plague','greed','executioner','tyrant','grave','behemoth',
    'vampire','voidwrath','minotaur','seraph','matriarch','demonqueen'];
  const defs=ids.map(id=>c.bossType(c.spawnEnemy('boss',id)));
  ok('короткая постоянная метка хранится в существующем BOSS_TYPES',defs.every(d=>d&&d.hud));
  ok('метки всех четырнадцати боссов действительно короткие',defs.every(d=>d.hud.length<=24));
}

const markerSrc=between('function drawBossHudMarker','function drawBossHudEntry');
ok('четыре маркера различаются цветом и геометрией',
  /#f6c344[\s\S]*diamond[\s\S]*#5ec2e0[\s\S]*square[\s\S]*#b56cff[\s\S]*triangle[\s\S]*#78d66b[\s\S]*circle/.test(html));
ok('маркеры используют только Canvas-примитивы без новых изображений',
  /moveTo|ctx\.rect|ctx\.arc/.test(markerSrc) && !/drawImage|Image\(/.test(markerSrc));
ok('маркеры над моделями включаются при нескольких боссах',
  /pass==='worldHud' && BOSS_HUD_COUNT>1/.test(html));
ok('старые имена, аффиксы и мировые HP-бары босса удалены',
  !/fillText\(tr\(e\.affNm\)/.test(html) && /e\.kind !== 'boss' && e\.hp < e\.maxHp/.test(html));
ok('rare меняет цвет имени и рамки, но не размер HUD',
  /rare\?'#f6c344':'#eef3f8'/.test(html) && /rare\?'#f6c344':'#7d3540'/.test(html));
ok('HUD не создаёт DOM, PNG, blur или filter',
  !/innerHTML|querySelector|drawImage|filter|blur/.test(between('function drawBossHudEntry','const CANVAS_RENDER_PASSES')));

ok('delayed HP босса догоняет настоящее значение ровно за 0.4 секунды',
  /const BOSS_HUD_HP_LAG_TIME=0\.4/.test(html));
ok('светлая delayed-полоса рисуется перед мгновенной красной полосой',
  html.indexOf("ctx.fillStyle='#f2e8dcbb'")<html.indexOf("ctx.fillStyle='#ff3b45'",html.indexOf('function drawBossHudEntry')));

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G; G.enemies.length=0;
  const a=c.debugSpawnBoss('vampire'),b=c.debugSpawnBoss('minotaur');
  ok('каждый новый босс получает собственное состояние delayed HP',
    a.hudHpLag===1 && b.hudHpLag===1 && a.hudHpTimer===0 && b.hudHpTimer===0);
  a.hp=a.maxHp*0.65; b.hp=b.maxHp*0.80; c.tickBossHudHealth(0.016);
  ok('красный HP падает сразу, а обе светлые полосы остаются на старом HP',
    Math.abs(a.hp/a.maxHp-0.65)<1e-9 && Math.abs(b.hp/b.maxHp-0.80)<1e-9 &&
    a.hudHpLag===1 && b.hudHpLag===1);
  c.tickBossHudHealth(0.20);
  ok('через 0.2 секунды независимые delayed-полосы проходят половину пути',
    Math.abs(a.hudHpLag-0.825)<1e-9 && Math.abs(b.hudHpLag-0.90)<1e-9);
  c.tickBossHudHealth(0.20); b.hp=b.maxHp*0.95; c.tickBossHudHealth(0.01);
  ok('через 0.4 секунды хвост догоняет HP, а лечение поднимает его сразу',
    Math.abs(a.hudHpLag-0.65)<1e-9 && Math.abs(b.hudHpLag-0.95)<1e-9 && b.hudHpTimer===0);
}

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G; G.enemies.length=0;
  const calls=[]; c.drawBossHudEntry=(...args)=>calls.push(args);
  ok('при нуле боссов HUD не рисует ни одного блока',c.collectBossHudTargets()===0 && c.drawBossHud()===0 && calls.length===0);
  const normal=c.debugSpawnBoss('vampire'); calls.length=0; c.collectBossHudTargets(); c.drawBossHud();
  const center=calls[0]&&calls[0][1];
  ok('один обычный босс получает один центральный HUD',calls.length===1 && calls[0][0]===normal && calls[0][4]===false);
  ok('обычный HUD содержит особенность и максимум один аффикс',c.bossHudInfo(normal).split(' · ').length===2);
  const rare=c.debugSpawnBoss('minotaur'); normal.hp=normal.maxHp*0.25; rare.hp=rare.maxHp*0.70;
  calls.length=0; c.collectBossHudTargets(); c.drawBossHud();
  ok('два разных босса получают два горизонтальных HUD',
    calls.length===2 && calls[0][1]<calls[1][1] && calls[0][5]===calls[1][5] && calls[0][4]&&calls[1][4]);
  ok('каждый HUD связан со своим экземпляром и независимым HP',
    calls[0][0]===normal && calls[1][0]===rare &&
    Math.abs(calls[0][0].hp/calls[0][0].maxHp-0.25)<1e-9 &&
    Math.abs(calls[1][0].hp/calls[1][0].maxHp-0.70)<1e-9);
  ok('rare HUD ограничен двумя короткими метками',
    c.bossHudInfo(rare).split(' · ').length===2 && /RARE|РЕДКИЙ/.test(c.bossHudInfo(rare)));
  const third=c.debugSpawnBoss('seraph'); calls.length=0; c.collectBossHudTargets(); c.drawBossHud();
  ok('три босса занимают два ряда, одиночный нижний HUD центрирован',
    calls.length===3 && calls[0][5]===calls[1][5] && calls[2][5]>calls[0][5] && calls[2][1]===center);
  const fourth=c.debugSpawnBoss('grave'); calls.length=0; c.collectBossHudTargets(); c.drawBossHud();
  ok('четыре босса получают сетку 2×2 и четыре разных слота маркеров',
    calls.length===4 && calls.map(x=>x[3]).join(',')==='0,1,2,3' &&
    calls[0][5]===calls[1][5] && calls[2][5]===calls[3][5] && calls[2][5]>calls[0][5]);
  G.enemies=[rare]; calls.length=0; c.collectBossHudTargets(); c.drawBossHud();
  ok('после смерти первого оставшийся HUD возвращается в центр',calls.length===1 && calls[0][0]===rare && calls[0][1]===center && calls[0][4]===false);
  G.enemies.length=0; calls.length=0; c.collectBossHudTargets(); c.drawBossHud();
  ok('после смерти последнего Boss HUD полностью исчезает',calls.length===0 && c.collectBossHudTargets()===0);
}

process.exitCode=fail?1:0;
