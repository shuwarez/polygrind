/* Унифицированные цвета, формы, тайминги и следы телеграфов. */
const fs=require('fs');
const {loadGame}=require('./harness');
const html=fs.readFileSync('./PolyGrind.html','utf8');
let n=0,fail=0;
function ok(name,yes,got=''){
  n++; if(!yes) fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ')+name.padEnd(62)+got);
}

const c=loadGame('./PolyGrind.html');
ok('три типа последствий имеют фиксированную палитру',
  /warning:'#f6c344', damage:'#ff3b45', control:'#b56cff'/.test(html));
ok('общее заполнение длится ровно 0.8 секунды',/TELEGRAPH_FILL_TIME=0\.8/.test(html));
ok('белая граница включается только на последних 50 мс',/TELEGRAPH_EDGE_FLASH=0\.05/.test(html));
ok('след длится 130 мс — внутри диапазона 100–150 мс',/TELEGRAPH_TRACE_TIME=0\.13/.test(html));
ok('длинный замах сначала остаётся пустым',c.telegraphFill(2)===0);
ok('на границе окна 0.8 секунды заполнение ещё нулевое',c.telegraphFill(0.8)===0);
ok('через половину окна заполнена ровно половина',Math.abs(c.telegraphFill(0.4)-0.5)<1e-9);
ok('непосредственно перед ударом заполнение достигает единицы',c.telegraphFill(0)===1);
ok('геометрия поддерживает круг и коридор',
  /spec\.shape==='corridor'/.test(html) && /ctx\.arc\(spec\.x,spec\.y,spec\.r/.test(html));
ok('геометрия поддерживает прицел и разлом',
  /spec\.shape!=='target'/.test(html) && /spec\.shape==='rift'/.test(html));
ok('Козлиный демон использует круг урона',
  /shape:'circle',kind:'damage'.*BOSS_GOAT_AOE.*slamWarn/s.test(html));
ok('Бегемот использует жёлтый прицел приземления',
  /shape:'target',kind:'warning'.*jumpX.*jumpWarn/s.test(html));
ok('Вампир использует два красных коридора',
  (html.match(/shape:'corridor',kind:'damage',x:T\.markX/g)||[]).length>=2);
ok('Гнев Пустоты использует фиолетовые разломы',
  /shape:'rift',kind:'control'.*r\.warn/s.test(html));
ok('Минотавр использует красный коридор натиска',
  /shape:'corridor',kind:'damage',x:e\.x,y:e\.y,x2:ex,y2:ey/.test(html));
ok('Сераф использует красный прицел луча',
  /shape:'target',kind:'damage',x:T\.judgeX/.test(html));
ok('Королева использует фиолетовый прицел контроля',
  /shape:'target',kind:'control',x:T\.leapX/.test(html));
ok('прыгун, таран, смола и прицел Палача используют общую систему',
  /shape:'target',kind:'warning',x:e\.jumpTo\.x/.test(html) &&
  /remaining:e\.affT\.warn,total:0\.7/.test(html) &&
  /shape:'circle',kind:'damage',x:px,y:py,r:46/.test(html) &&
  /pushTimedTelegraph\(\{shape:'target',kind:'damage',x:p\.x/.test(html));
ok('следы срабатываний рисуются общим обработчиком',
  /f\.t === 'telegraphTrace'/.test(html) && /drawTelegraphTrace\(f\)/.test(html));

{ c.newGame('bow','keys');
  const G=c.__api.G,e=c.spawnEnemy('boss','goat');
  G.enemies=[e]; e.x=0; e.y=0; G.player.x=900; G.player.y=900;
  e.bossT={slamWarn:0.01,slamCd:0};
  c.tickBossSkill(e,0.02);
  const tr=G.fx.find(f=>f.t==='telegraphTrace');
  const bossTraceOk=!!tr && tr.shape==='circle' && tr.kind==='damage' && tr.life===0.13;
  c.pushTimedTelegraph({shape:'target',kind:'damage',x:10,y:20,r:34},0.55);
  c.update(0.56);
  const timed=G.fx.find(f=>f.t==='telegraphTrace' && f.shape==='target');
  ok('срабатывание способности реально создаёт короткий общий след',
    bossTraceOk && !!timed && timed.life===0.13);
}

process.exitCode=fail?1:0;
