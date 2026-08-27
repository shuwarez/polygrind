/* Прогон всей регрессии одной командой: node run-all.js
   Ожидаемые числа зафиксированы — если счёт разошёлся, что-то сломано. */
const {execSync} = require('child_process');
const fs = require('fs');

/* Проверка комплектности до запуска: если набора нет на диске, честно сказать
   какого именно, а не падать на первом же execSync с невнятной ошибкой. */
const CORE = ['harness.js', 'sim.js', 'run.js', 'orderscan.js', 'PolyGrind.html'];
const SUITES = [
  ['packunit',    25, 'пачки элиты: 18 аффиксов, роли, потолок лечения'],
  ['amuunit',     21, 'амулеты: 14 штук'],
  ['itemunit',    18, 'перчатки, ботинки, кольца, реликвии'],
  ['it2unit',     29, 'вторая волна предметов: 24 штуки'],
  ['it3unit',     15, 'талисманы разгона, стрела, мешки'],
  ['shopunit',     6, 'Первый шаг и наследование магазина свитой'],
  ['scaleunit',    2, 'рост урона и скорость врагов'],
  ['qolunit',      8, 'быстрый сбор, журнал смерти и прогрессия боссов'],
  ['totunit',     15, 'тотемы: ранги, книги-условия и дроп'],
  ['minallunit',  23, 'свита триггерит весь каталог и сопротивление отбрасыванию'],
  ['btunit',      12, 'кровные узы'],
  ['frenzyunit',   9, 'буйство демонов'],
  ['blinkunit',   12, 'внезапный взрыв и астральный набег'],
  ['clawunit',     9, 'резкие когти и вихрь когтей'],
  ['bb2unit',     11, 'кровавая баня и кипящая кровь'],
  ['b7unit',      12, 'ужасающий вампир, книга крови, скорость врагов'],
  ['constunit',    24, 'созвездия: счётчики, ранги, награды и экран'],
];
const missing = CORE.concat(SUITES.map(x => x[0] + '.js')).filter(f => !fs.existsSync(f));
if (missing.length){
  console.log('НЕ ХВАТАЕТ ФАЙЛОВ (' + missing.length + '):');
  for (const f of missing) console.log('  ' + f);
  console.log('\nВсе они лежат в папке harness/ рядом с HANDOFF.md.');
  console.log('Для запуска нужны Node 18+ и один каталог, куда положены');
  console.log('PolyGrind.html и содержимое harness/ без вложенности.');
  process.exit(2);
}

let bad = 0, total = 0;
for (const [file, want, what] of SUITES){
  const out = execSync('node ' + file + '.js', {encoding:'utf8'});
  const got = (out.match(/\u2713/g) || []).length;
  const fail = (out.match(/\u2717/g) || []).length;
  total += got;
  const okk = got === want && fail === 0;
  if (!okk){ bad++; console.log(out); }
  console.log((okk ? '  OK   ' : '  FAIL ') + file.padEnd(13) + got + '/' + want + '   ' + what);
}
console.log('\nвсего проверок: ' + total + (bad ? '   ПРОВАЛОВ: ' + bad : '   всё зелёное'));
try { console.log(execSync('node orderscan.js', {encoding:'utf8'}).trim()); } catch(e){}
process.exit(bad ? 1 : 0);
