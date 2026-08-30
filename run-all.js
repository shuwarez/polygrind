/* Прогон всей регрессии одной командой: node run-all.js
   Ожидаемые числа зафиксированы — если счёт разошёлся, что-то сломано. */
const {spawn} = require('child_process');
const fs = require('fs');
const os = require('os');

/* Проверка комплектности до запуска: если набора нет на диске, честно сказать
   какого именно, а не падать на первом же execSync с невнятной ошибкой. */
const CORE = ['harness.js', 'sim.js', 'run.js', 'orderscan.js', 'PolyGrind.html'];
const SUITES = [
  ['packunit',    25, 'пачки элиты: 18 аффиксов, роли, потолок лечения'],
  ['elitevariantunit',41, 'разновидности Бегунов/Ядер: спрайты, выбор, защита и контактные эффекты'],
  ['elitevariant2unit',51, 'разновидности Призм/Бастионов: снаряды, рывки, стаки, ожоги и кислота'],
  ['amuunit',     22, 'амулеты: механики и раздельные осколки'],
  ['itemunit',    18, 'перчатки, ботинки, кольца, реликвии'],
  ['commonitemunit',36, '12 обычных предметов: пул, источники, таймеры и HUD'],
  ['rareitemunit',58, '14 редких предметов: ограничения, механики, таймеры и HUD'],
  ['it2unit',     35, 'вторая волна предметов: 24 штуки и HUD-трекеры их условных эффектов'],
  ['it3unit',     15, 'талисманы разгона, стрела, мешки'],
  ['shopunit',    45, 'цены, быстрое лечение, потолки брони, скорости и рывка, миграция, возвраты и прокрутка'],
  ['scaleunit',    2, 'рост урона и скорость врагов'],
  ['reliableunit',69, 'баланс карточек: урон, таймер недавнего убийства, критическая волна, защита, оглушение и добивание'],
  ['novakillunit',12, 'взрыв при убийстве: шанс, защита цели, красное усиление, отбрасывание и цепь'],
  ['overpressureunit',17, 'синее Сверхдавление: источники взрывов, +5% за цель и потолок +25%'],
  ['arcaneunit',   17, 'синяя Арканная иллюзия: пул Мага, 20–30%, потолок и притяжение сфер'],
  ['classiconunit',18, 'классовые пиктограммы карточек: точный пул, магический радиус области, SVG, локализация и доступность'],
  ['slowunit',     15, 'урон по замедленным и синий Холодный раскол: источники, условия, радиус и длительность'],
  ['tooltipimpactunit',38, 'динамические подсказки и связанные навыки в меню уровня'],
  ['ricochetunit',10, 'синий Осколочный рикошет: потолок, 45% урона, цели и запрет рекурсии'],
  ['elementunit', 23, 'стихии: потолок 25%, gated-урон, книги молнии, ослабленные статусы и ТЕСЛА'],
  ['qolunit',     39, 'раскладки, выбор карт цифрами и переброс пробелом, ВОР, рывок, сбор, удалённые карточки, журнал смерти и боссы'],
  ['generalskillunit',39,'общие синие и фиолетовые одноразовые навыки'],
  ['floortransitionunit',40, 'завершение этажа: автосбор, пробел в сводке, очередь level-up/находок и телепорт'],
  ['damagefeedbackunit',30, 'урон, лечение и барьер игрока: feedback, delayed HP, два бара и combat text'],
  ['cheatdeathunit',12, 'оранжевый Обман смерти: гарантия, 1 HP, неуязвимость, скорость и минутный откат'],
  ['layerunit',     13, 'фиксированные Canvas-слои: телеграфы, персонажи, HUD, combat text и виньетка'],
  ['telegraphunit', 20, 'единые телеграфы: три последствия, круг, прицел, коридор и следы'],
  ['bosshudunit',   33, 'компактный Canvas Boss HUD: от одного до четырёх боссов, delayed HP, rare и маркеры'],
  ['bossfloorunit', 61, 'босс-этажи X3/X6/X9/X0: формулы, аффиксы, позиции, урон волны, призывы и завершение'],
  ['spawnmenuunit',52, 'Spawn Menu: обычные, 12 отдельных элит, пачка, боссы и progression'],
  ['totunit',     20, 'тотемы: ранги, книги-условия и дроп'],
  ['minallunit',  57, 'свита: Костяной слуга, урон, эффекты, Поле костей, кейстоуны и естественная смерть'],
  ['btunit',      12, 'кровные узы'],
  ['frenzyunit',   9, 'буйство демонов'],
  ['blinkunit',   12, 'внезапный взрыв и астральный набег'],
  ['clawunit',     9, 'резкие когти и вихрь когтей'],
  ['bb2unit',     11, 'кровавая баня и кипящая кровь'],
  ['b7unit',      16, 'ужасающий вампир, щит, классовое ограничение и книга крови'],
  ['constunit',    32, 'созвездия: счётчики, сброс бонусов, награды, прокрутка и анимированные актуальные спрайты'],
  ['doubleunit',   14, 'двойное попадание и чумный взрыв: потолки, анлоки и урон'],
  ['graveunit',     7, 'кладбище: миграция, последние 10 смертей и полная сводка'],
  ['spriteunit',    37, 'PNG-враги, портал, элементальные состояния, добыча, предметы, тотемы, свита, снаряды и эффекты Мага'],
  ['bossunit',      86, 'четырнадцать уникальных боссов: листы, снаряды, умения, редкость, циклы и награды'],
  ['locunit',       9, 'локализация: EN по умолчанию, полнота каталогов, примеры и CSS-флаги'],
  ['bladeunit',    11, 'Воин: спрайт и круговая волна каждого третьего взмаха'],
  ['herospriteunit',31, 'герои, оптимизированная анимированная вывеска Grim Grind и витрина выбора класса'],
  ['warriorunit',  65, 'подклассы, классовый пул и новые ветки Воина'],
  ['archerunit',   54, 'ветки Лучника: траектория, возврат, Зеркальный залп и Техника одной стрелы'],
  ['mageunit',      55, 'три подкласса и семь новых веток Мага, включая Мину и Повторную детонацию'],
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

/* Каждый suite уже изолирован в отдельном процессе и загружает собственный VM,
   поэтому их безопасно выполнять параллельно. Ограниченный пул не устраивает
   всплеск из сорока процессов и сохраняет порядок итогового отчёта. */
const available = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
const requested = Number.parseInt(process.env.RUN_ALL_JOBS || '', 10);
const jobs = Math.max(1, Math.min(SUITES.length,
  Number.isFinite(requested) && requested > 0 ? requested : Math.min(8, available)));

function runFile(file){
  return new Promise(resolve => {
    const child = spawn(process.execPath, [file], {stdio:['ignore', 'pipe', 'pipe']});
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => resolve({stdout, stderr:stderr + error.stack + '\n', code:-1}));
    child.on('close', code => resolve({stdout, stderr, code}));
  });
}

async function main(){
  const results = new Array(SUITES.length);
  let next = 0;
  const workers = Array.from({length:jobs}, async () => {
    while (true){
      const index = next++;
      if (index >= SUITES.length) return;
      results[index] = await runFile(SUITES[index][0] + '.js');
    }
  });
  const orderScanPromise = runFile('orderscan.js');
  await Promise.all(workers);

  let bad = 0, total = 0;
  for (let i=0; i<SUITES.length; i++){
    const [file, want, what] = SUITES[i];
    const {stdout, stderr, code} = results[i];
    const got = (stdout.match(/\u2713/g) || []).length;
    const fail = (stdout.match(/\u2717/g) || []).length;
    total += got;
    const okk = got === want && fail === 0 && code === 0;
    if (!okk){
      bad++;
      if (stdout) process.stdout.write(stdout.endsWith('\n') ? stdout : stdout + '\n');
      if (stderr) process.stderr.write(stderr.endsWith('\n') ? stderr : stderr + '\n');
    }
    console.log((okk ? '  OK   ' : '  FAIL ') + file.padEnd(13) + got + '/' + want + '   ' + what);
  }
  console.log('\nвсего проверок: ' + total + (bad ? '   ПРОВАЛОВ: ' + bad : '   всё зелёное') + '   jobs=' + jobs);
  const orderScan = await orderScanPromise;
  if (orderScan.stdout.trim()) console.log(orderScan.stdout.trim());
  if (orderScan.stderr.trim()) console.error(orderScan.stderr.trim());
  process.exitCode = bad ? 1 : 0;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
