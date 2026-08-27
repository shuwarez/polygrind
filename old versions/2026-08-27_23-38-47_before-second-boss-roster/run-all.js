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
  ['shopunit',    10, 'Первый шаг, регенерация и наследование магазина свитой'],
  ['scaleunit',    2, 'рост урона и скорость врагов'],
  ['qolunit',     17, 'ВОР, рывок, быстрый сбор, журнал смерти и боссы'],
  ['totunit',     15, 'тотемы: ранги, книги-условия и дроп'],
  ['minallunit',  38, 'свита: урон, эффекты, Лорд Смерти и естественная смерть'],
  ['btunit',      12, 'кровные узы'],
  ['frenzyunit',   9, 'буйство демонов'],
  ['blinkunit',   12, 'внезапный взрыв и астральный набег'],
  ['clawunit',     9, 'резкие когти и вихрь когтей'],
  ['bb2unit',     11, 'кровавая баня и кипящая кровь'],
  ['b7unit',      16, 'ужасающий вампир, щит, классовое ограничение и книга крови'],
  ['constunit',    24, 'созвездия: счётчики, ранги, награды и экран'],
  ['doubleunit',   10, 'двойное и смертоносное попадание: потолок, анлок и урон'],
  ['graveunit',     7, 'кладбище: миграция, последние 10 смертей и полная сводка'],
  ['spriteunit',    11, 'встроенные PNG-враги: четыре кадра, разворот, масштаб и метки'],
  ['bossunit',      20, 'четыре уникальных босса: листы, умения, редкость и награды'],
  ['locunit',       8, 'локализация: EN по умолчанию, полнота каталогов и CSS-флаги'],
  ['bladeunit',    11, 'Воин: спрайт и круговая волна каждого третьего взмаха'],
  ['warriorunit',  20, 'три подкласса Воина: формулы, пороги, барьер и контроль'],
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
const node = JSON.stringify(process.execPath); // тот же runtime, даже если `node` отсутствует в PATH
for (const [file, want, what] of SUITES){
  const out = execSync(node + ' ' + JSON.stringify(file + '.js'), {encoding:'utf8'});
  const got = (out.match(/\u2713/g) || []).length;
  const fail = (out.match(/\u2717/g) || []).length;
  total += got;
  const okk = got === want && fail === 0;
  if (!okk){ bad++; console.log(out); }
  console.log((okk ? '  OK   ' : '  FAIL ') + file.padEnd(13) + got + '/' + want + '   ' + what);
}
console.log('\nвсего проверок: ' + total + (bad ? '   ПРОВАЛОВ: ' + bad : '   всё зелёное'));
try { console.log(execSync(node + ' "orderscan.js"', {encoding:'utf8'}).trim()); } catch(e){}
process.exit(bad ? 1 : 0);
