/* Быстрая пауза P: только прозрачный слой PAUSED; Escape сохраняет настройки. */
const fs=require('fs');
const {loadGame}=require('./harness');
let n=0,fail=0;
function ok(name,yes,got=''){n++;if(!yes)fail++;console.log((yes?'  \u2713 ':'  \u2717 ')+name.padEnd(69)+got);}
const html=fs.readFileSync('./GrimGrind.html','utf8');
const key=(code,value)=>({code,key:value,repeat:false,preventDefault(){this.prevented=true;}});

ok('разметка содержит отдельный минимальный слой только с PAUSED',
  /<div id="quickpause">PAUSED<\/div>/.test(html));
ok('quick-pause прозрачна и не перехватывает мышь',
  /#quickpause\{[^}]*pointer-events:none;background:transparent/.test(html));
ok('quick-pause не содержит панелей, кнопок или затемняющего inline-style',
  !/<div id="quickpause"[^>]*(?:background|opacity)/.test(html)&&!/<div id="quickpause">[\s\S]*?<button/.test(html.slice(html.indexOf('<div id="quickpause">'),html.indexOf('<div class="overlay" id="pauseov"'))));

{const c=loadGame('./GrimGrind.html');c.newGame('bow','keys');const G=c.__api.G;
  ok('новый забег начинается без quick-pause',!G.quickPaused&&!G.paused);
  ok('setQuickPause(true) останавливает игру отдельным флагом',c.setQuickPause(true)&&G.quickPaused&&G.paused);
  ok('setQuickPause(false) полностью продолжает игру',!c.setQuickPause(false)&&!G.quickPaused&&!G.paused);
  c.setQuickPause(true);c.setPauseSettings(true);
  ok('полное меню Escape всегда убирает минимальную quick-pause',!G.quickPaused&&G.paused);
  c.setPauseSettings(false);c.handleGameKeyDown(key('KeyP','p'));
  ok('первое нажатие P включает только быструю паузу',G.quickPaused&&G.paused);
  c.handleGameKeyDown(key('KeyK','k'));
  ok('во время quick-pause игровые и QA-клавиши перехватываются',G.quickPaused&&!G.spawnOpen);
  c.handleGameKeyDown(key('KeyP','p'));
  ok('повторное P продолжает игру',!G.quickPaused&&!G.paused);
  c.handleGameKeyDown(key('KeyP','p'));c.handleGameKeyDown(key('Escape','Escape'));
  ok('Escape из quick-pause открывает полную паузу вместо двух слоёв',!G.quickPaused&&G.paused);
  // harness использует один DOM-элемент для всех id; в браузере #ov и #pauseov раздельны.
  c.document.getElementById('ov').style.display='none';
  c.handleGameKeyDown(key('KeyP','p'));
  ok('P из полного меню паузы продолжает игру',!G.quickPaused&&!G.paused);
  c.handleGameKeyDown(key('Escape','Escape'));
  ok('обычный Escape по-прежнему открывает полноценную паузу',!G.quickPaused&&G.paused);}

ok('обработчик P и Escape использует разные режимы паузы',
  /if \(k === 'p'[\s\S]{0,420}setQuickPause\(true\)[\s\S]{0,180}if \(k === 'escape'/.test(html));
ok('подсказки различают быструю P-паузу и настройки Escape',
  html.includes('P — быстрая пауза · ESC — настройки паузы'));
ok('главный цикл останавливает механику общим проверенным флагом G.paused',
  /else if \(!G\.paused && !G\.over && !G\.pending\) update\(dt\)/.test(html));

console.log(JSON.stringify({n,fail}));process.exitCode=fail?1:0;
