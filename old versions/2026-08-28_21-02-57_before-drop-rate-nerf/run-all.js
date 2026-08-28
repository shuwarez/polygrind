/* Прогон всей регрессии одной командой: node run-all.js
   Ожидаемые числа зафиксированы — если счёт разошёлся, что-то сломано. */
const {execSync} = require('child_process');
const fs = require('fs');

/* Проверка комплектности до запуска: если набора нет на диске, честно сказать
   какого именно, а не падать на первом же execSync с невнятной ошибкой. */
const CORE = ['harness.js', 'sim.js', 'run.js', 'orderscan.js', 'PolyGrind.html'];
const SUITES = [
  ['packunit',    25, 'пачки элиты: 18 аффиксов, роли, потолок лечения'],
  ['elitevariantunit',41, 'разновидности Бегунов/Ядер: спрайты, выбор, защита и контактные эффекты'],
  ['elitevariant2unit',51, 'разновидности Призм/Бастионов: снаряды, рывки, стаки, ожоги и кислота'],
  ['amuunit',     21, 'амулеты: 14 штук'],
  ['itemunit',    18, 'перчатки, ботинки, кольца, реликвии'],
  ['it2unit',     29, 'вторая волна предметов: 24 штуки'],
  ['it3unit',     15, 'талисманы разгона, стрела, мешки'],
  ['shopunit',    20, 'покупка, сохранение прокрутки, полный возврат одного/всех бонусов и наследование свитой'],
  ['scaleunit',    2, 'рост урона и скорость врагов'],
  ['elementunit', 20, 'стихии: потолок 25%, gated-урон, ослабленные статусы и ТЕСЛА'],
  ['qolunit',     20, 'раскладки клавиатуры, ВОР, рывок, сбор, журнал смерти и боссы'],
  ['damagefeedbackunit',29, 'урон, лечение и барьер игрока: feedback, delayed HP, два бара и combat text'],
  ['layerunit',     13, 'фиксированные Canvas-слои: телеграфы, персонажи, HUD, combat text и виньетка'],
  ['telegraphunit', 20, 'единые телеграфы: три последствия, четыре формы, тайминги и следы'],
  ['bosshudunit',   33, 'компактный Canvas Boss HUD: от одного до четырёх боссов, delayed HP, rare и маркеры'],
  ['bossfloorunit', 60, 'босс-этажи X3/X6/X9/X0: формулы, аффиксы, позиции, призывы и завершение'],
  ['spawnmenuunit',52, 'Spawn Menu: обычные, 12 отдельных элит, пачка, боссы и progression'],
  ['totunit',     15, 'тотемы: ранги, книги-условия и дроп'],
  ['minallunit',  44, 'свита: урон, эффекты, Лорд Смерти, Костяной вызов и естественная смерть'],
  ['btunit',      12, 'кровные узы'],
  ['frenzyunit',   9, 'буйство демонов'],
  ['blinkunit',   12, 'внезапный взрыв и астральный набег'],
  ['clawunit',     9, 'резкие когти и вихрь когтей'],
  ['bb2unit',     11, 'кровавая баня и кипящая кровь'],
  ['b7unit',      16, 'ужасающий вампир, щит, классовое ограничение и книга крови'],
  ['constunit',    27, 'созвездия: счётчики, награды и анимированные актуальные спрайты'],
  ['doubleunit',   10, 'двойное и смертоносное попадание: потолок, анлок и урон'],
  ['graveunit',     7, 'кладбище: миграция, последние 10 смертей и полная сводка'],
  ['spriteunit',    18, 'PNG-враги и снаряды Призмы/Лучника/Мага: кадры, маршруты, масштаб и палитра'],
  ['bossunit',      59, 'четырнадцать уникальных боссов: листы, умения, редкость и награды'],
  ['locunit',       8, 'локализация: EN по умолчанию, полнота каталогов и CSS-флаги'],
  ['bladeunit',    11, 'Воин: спрайт и круговая волна каждого третьего взмаха'],
  ['herospriteunit',21, 'герои: листы 32 px, медленная ходьба, без атак, направление и автономность HTML'],
  ['warriorunit',  20, 'три подкласса Воина: формулы, пороги, барьер и контроль'],
  ['mageunit',       8, 'три подкласса Мага: рост раз в 15 уровней и запрет карточки снарядов'],
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
