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
  ['epicitemunit',34, 'пять эпических предметов: взмах, броня, тень, статусы и возврат времени'],
  ['legendaryitemunit',44, 'семь легендарных предметов: стойка, волна, эхо, свита, сферы и экономика'],
  ['shopunit',    59, 'цены, баланс, возвраты, читаемая витрина и сгенерированные иконки магазина'],
  ['scaleunit',    2, 'рост урона и скорость врагов'],
  ['reliableunit',73, 'баланс карточек: урон, пробитие, таймер недавнего убийства, критическая волна, защита, оглушение и добивание'],
  ['skillframeunit',10, 'пять цветных 9-slice рамок карточек навыков без потери исходников'],
  ['novakillunit',12, 'взрыв при убийстве: шанс, защита цели, красное усиление, отбрасывание и цепь'],
  ['overpressureunit',17, 'синее Сверхдавление: источники взрывов, +5% за цель и потолок +25%'],
  ['arcaneunit',   17, 'синяя Арканная иллюзия: пул Мага, 20–30%, потолок и притяжение сфер'],
  ['classiconunit',21, 'классовые пиктограммы карточек: точный пул, магический радиус области, SVG, локализация и доступность'],
  ['slowunit',     15, 'урон по замедленным и синий Холодный раскол: источники, условия, радиус и длительность'],
  ['tooltipimpactunit',39, 'динамические подсказки и связанные навыки в меню уровня'],
  ['ricochetunit',10, 'синий Осколочный рикошет: потолок, 45% урона, цели и запрет рекурсии'],
  ['projectilegridunit',11, 'пространственная сетка снарядов: границы, порядок, пробитие, цепь и самонаведение'],
  ['auragridunit',26, 'пространственная сетка аур: эквивалентность, движение источников и следы ботинок'],
  ['areagridunit',31, 'площадные эффекты: Инферно, лужи, мины, взрывы, следы и строгие границы'],
  ['targetsearchunit',30, 'поиск целей: стабильный top-k, строгие границы, шок, рикошет и предметы'],
  ['warriortargetunit',24, 'массовые атаки Воина: кэш дистанций, порядок, радиус и сектор'],
  ['minionperfunit',35, 'полный цикл свиты: угрозы, ленивые цели, общая сетка и снимки урона'],
  ['aggrounit',27, 'агро Некроманта: игрок, Голем крови и 1% Костяной вызов'],
  ['damagecontextunit',30, 'контекст атаки: Осколок, Дуэль, соседи и gated-замедление'],
  ['fxperfunit',36, 'временные эффекты: pools, caps, объединение и линейное уплотнение'],
  ['framescratchunit',39, 'буферы кадра: сетки, цели свиты, множители и единый enemy-проход'],
  ['longrununit',23, 'долгий стресс: 500 врагов, полная свита, ауры, pools и память'],
  ['elementunit', 24, 'стихии: потолок 25%, gated-урон, книги молнии, ослабленные статусы и ТЕСЛА'],
  ['qolunit',     39, 'раскладки, выбор карт цифрами и переброс пробелом, ВОР, рывок, сбор, удалённые карточки, журнал смерти и боссы'],
  ['quickpauseunit',16, 'быстрая P-пауза: прозрачный PAUSED, перехват ввода и отдельный Escape'],
  ['generalskillunit',43,'общие синие и фиолетовые одноразовые навыки и их индикаторы'],
  ['floortransitionunit',46, 'завершение этажа: автосбор, защищённый портал, энергия, указатель и телепорт'],
  ['floorvariationunit',23, '10 бесшовных полов 512 px: палитра, яркость, отдельный RNG, fallback и единый pattern этажа'],
  ['damagefeedbackunit',34, 'урон, лечение и барьер игрока: feedback, delayed HP, два бара, combat text и HUD-кэш'],
  ['cameraunit',   19, 'камера: фиксированный центр, zoom 0.95, мышь, culling и экранные слои'],
  ['cullingunit', 24, 'консервативное отсечение рендера: края, ауры, боссы, снаряды, эффекты и телеграфы'],
  ['bloodunit',     22, 'кровь этажа: фактический HP, атласы, критические брызги, декали, DoT, лимиты и слои'],
  ['corpseunit',    31, 'трупы всех монстров и классов: масштаб 50%, чистая alpha-кромка, 50% луж, слои и culling'],
  ['cheatdeathunit',12, 'оранжевый Обман смерти: гарантия, 1 HP, неуязвимость, скорость и минутный откат'],
  ['layerunit',     15, 'фиксированные Canvas-слои: кровь, телеграфы, персонажи, HUD, combat text и виньетка'],
  ['telegraphunit', 20, 'единые телеграфы: три последствия, круг, прицел, коридор и следы'],
  ['bosshudunit',   33, 'компактный Canvas Boss HUD: от одного до четырёх боссов, delayed HP, rare и маркеры'],
  ['bossfloorunit', 61, 'босс-этажи X3/X6/X9/X0: формулы, аффиксы, позиции, урон волны, призывы и завершение'],
  ['spawnmenuunit',64, 'Spawn Menu: существа, предметы, книги, тотемы и progression'],
  ['devzoneunit',  18, 'DEV_ZONE: пустая арена, спавнер, отсутствие портала и meta-наград'],
  ['totunit',     20, 'тотемы: ранги, книги-условия и дроп'],
  ['minallunit',  67, 'свита: Костяной слуга, Бомбардиры, урон, эффекты, Поле костей, кейстоуны и естественная смерть'],
  ['btunit',      12, 'кровные узы'],
  ['frenzyunit',   9, 'буйство демонов'],
  ['blinkunit',   12, 'внезапный взрыв и астральный набег'],
  ['clawunit',     9, 'резкие когти и вихрь когтей'],
  ['bb2unit',     11, 'кровавая баня и кипящая кровь'],
  ['b7unit',      16, 'ужасающий вампир, щит, классовое ограничение и книга крови'],
  ['constunit',    44, 'астральная обсерватория: пути, профиль, фон, прогресс, награды, адаптивность и производительность'],
  ['doubleunit',   14, 'двойное попадание и чумный взрыв: потолки, анлоки и урон'],
  ['graveunit',     7, 'кладбище: миграция, последние 10 смертей и полная сводка'],
  ['spriteunit',    60, 'PNG-враги, лужи, портал, звуки, добыча, предметы 128/24 px, усиленный pickup, свита и эффекты Мага'],
  ['bossunit',      80, 'четырнадцать прежних боссов: снаряды, умения, редкость, циклы и награды'],
  ['legacybossartunit',17, 'визуальное обновление прежних боссов: базовые/атакующие листы и эффекты'],
  ['boss20unit',     25, 'двадцать новых боссов: листы, события, телеграфы, зоны и Spawn Menu'],
  ['locunit',       9, 'локализация: EN по умолчанию, полнота каталогов, примеры и CSS-флаги'],
  ['bladeunit',    11, 'Воин: спрайт и круговая волна каждого третьего взмаха'],
  ['herospriteunit',81, 'герои и 8-кадровые подклассы 36 px вправо, детальные превью и классическое меню'],
  ['warriorunit',  66, 'подклассы, классовый пул и новые ветки Воина'],
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
