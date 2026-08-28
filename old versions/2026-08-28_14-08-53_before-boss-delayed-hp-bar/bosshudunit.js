/* Компактный Canvas Boss HUD: 1/2 босса, rare, маркеры и отсутствие старого banner. */
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
  /if \(f % 5 === 0\)[\s\S]*?toast\('ЭТАЖ ' \+ f\)/.test(between('function buildFloor()','const hpScale')));
ok('появление босса не меняет паузу и не создаёт overlay',
  !/paused|innerHTML|classList/.test(between("if (f % 5 === 0){","} else if (packAffixCount")));
ok('Boss HUD является отдельным последним Canvas-проходом',
  /'worldHud','combatText','bossHud'/.test(html) && /if \(pass==='bossHud'\)/.test(html));
ok('экранный Boss HUD рисуется без трансформации камеры',
  html.indexOf("if (pass==='bossHud')")<html.indexOf('ctx.translate(W/2 - p.x'));

const collectSrc=between('function collectBossHudTargets()','function bossHudInfo');
ok('активные боссы ищутся одним циклом без filter/map',
  /for \(let i=0;i<G\.enemies\.length;i\+\+\)/.test(collectSrc) && !/\.filter\(|\.map\(/.test(collectSrc));
ok('сборщик хранит ссылки максимум на два экземпляра',
  /BOSS_HUD_A=e/.test(collectSrc) && /BOSS_HUD_B=e; break/.test(collectSrc));

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const ids=['lich','goat','plague','greed','executioner','tyrant','grave','behemoth',
    'vampire','voidwrath','minotaur','seraph','matriarch','demonqueen'];
  const defs=ids.map(id=>c.bossType(c.spawnEnemy('boss',id)));
  ok('короткая постоянная метка хранится в существующем BOSS_TYPES',defs.every(d=>d&&d.hud));
  ok('метки всех четырнадцати боссов действительно короткие',defs.every(d=>d.hud.length<=24));
}

const markerSrc=between('function drawBossHudMarker','function drawBossHudEntry');
ok('два маркера различаются и цветом, и геометрией',
  /#f6c344.*diamond.*#5ec2e0.*square/.test(html));
ok('маркеры используют только Canvas-примитивы без новых изображений',
  /moveTo|ctx\.rect/.test(markerSrc) && !/drawImage|Image\(/.test(markerSrc));
ok('маркеры над моделями включаются только при двух боссах',
  /pass==='worldHud' && BOSS_HUD_B/.test(html));
ok('старые имена, аффиксы и мировые HP-бары босса удалены',
  !/fillText\(tr\(e\.affNm\)/.test(html) && /e\.kind !== 'boss' && e\.hp < e\.maxHp/.test(html));
ok('rare меняет цвет имени и рамки, но не размер HUD',
  /rare\?'#f6c344':'#eef3f8'/.test(html) && /rare\?'#f6c344':'#7d3540'/.test(html));
ok('HUD не создаёт DOM, PNG, blur или filter',
  !/innerHTML|querySelector|drawImage|filter|blur/.test(between('function drawBossHudEntry','const CANVAS_RENDER_PASSES')));

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
    calls[0][0]===normal && calls[1][0]===rare && calls[0][0].hp/calls[0][0].maxHp===0.25 && calls[1][0].hp/calls[1][0].maxHp===0.70);
  ok('rare HUD ограничен двумя короткими метками',
    c.bossHudInfo(rare).split(' · ').length===2 && /RARE|РЕДКИЙ/.test(c.bossHudInfo(rare)));
  G.enemies.splice(G.enemies.indexOf(normal),1); calls.length=0; c.collectBossHudTargets(); c.drawBossHud();
  ok('после смерти первого оставшийся HUD возвращается в центр',calls.length===1 && calls[0][0]===rare && calls[0][1]===center && calls[0][4]===false);
  G.enemies.length=0; calls.length=0; c.collectBossHudTargets(); c.drawBossHud();
  ok('после смерти последнего Boss HUD полностью исчезает',calls.length===0 && c.collectBossHudTargets()===0);
}

process.exitCode=fail?1:0;
