/* ---------- 3. СУМКА МОДИФИКАТОРОВ И РАСЧЁТ ХАРАКТЕРИСТИК ---------- */
/* Общее правило стаков: одинаково сформулированные накопительные бонусы одного
   стата складываются в одну корзину. Отдельный множитель разрешён только для
   уникального изменения правил, заметного условия или явного штрафа. */
/* Сумка хранит по каждому стату три накопителя: flat, inc, more.
   Итог = (База + Σflat) × (1 + Σinc/100) × (1 + Σmore/100)          */
function Bag(){ this.s = {}; }
Bag.prototype.get = function(k){ return this.s[k] || (this.s[k] = {flat:0, inc:0, more:1}); };
Bag.prototype.add = function(k, kind, v){
  const e = this.get(k);
  if (kind === 'more') e.more += v/100;             // more складывается в отдельную общую корзину
  else if (kind === 'inc') e.inc += v;              // inc складывается в один множитель
  else e.flat += v;                                  // flat и chance просто суммируются
};
Bag.prototype.calc = function(k, base){             // финальная формула из каталога
  const e = this.s[k]; if (!e) return base;
  return (base + e.flat) * (1 + e.inc/100) * e.more;
};
Bag.prototype.flat = function(k){ return this.s[k] ? this.s[k].flat : 0; };
/* sum() — для статов, которые в каталоге объявлены только как inc (или только flat):
   движку нужно одно число, а не разделение на базу и процент. */
Bag.prototype.sum  = function(k){ const e = this.s[k]; return e ? e.flat + e.inc : 0; };
Bag.prototype.has  = function(k){ return this.flat(k) > 0; };

/* ---------- 3a. ПРЕДМЕТЫ ----------
   Книги падают редко и дают ФЛЭТ-урон стихией. Это самый скейлящийся тип в системе:
   он проходит через «+% к стихии», потом через «+% ко всему урону», потом через more.
   Дубликат не складывается, а поднимает тир — так потолок остаётся управляемым.  */
const BOOKS = {
  fire:  {nm:'КНИГА ОГНЯ',  col:'#ff7a2f', el:'dFire', ico:'\u25C6', proc:true,
          tiers:[[3,5],[6,8],[9,12]], step:[3,5],
          desc:'+N урона огнём всем атакам — вашим и свиты. При срабатывании поджигает: 20% от удара в секунду, 3 сек, стакается'},
  cold:  {nm:'КНИГА ЛЬДА',  col:'#7fd6ff', el:'dCold', ico:'\u2744', proc:true,
          tiers:[[3,5],[6,8],[9,12]], step:[3,5],
          desc:'+N урона холодом всем атакам. При срабатывании охлаждает на 0,5 сек и наносит ещё 10% удара'},
  shock: {nm:'КНИГА МОЛНИИ', col:'#ffe14a', el:'dLit', ico:'\u26A1', proc:true,
          tiers:[[3,5],[6,8],[9,12]], step:[3,5],
          desc:'+N урона молнией всем атакам — вашим и свиты. При срабатывании накладывает Шок на 1 секунду и выпускает обычный электрический разряд'},
  poison:{nm:'КНИГА ЯДА',   col:'#8be04e', ico:'\u2620', proc:true,
          tiers:[[3,3],[5,5],[8,8]], step:[3,3],
          desc:'При срабатывании травит: N урона каждые 0.25 сек, 3 сек, стакается. Масштабируется процентами к яду и к урону'},
  bleed: {nm:'КНИГА КРОВИ', col:'#e0405a', ico:'\u2716', proc:true, pct:true,
          // Занерфлена вдвое: было 30/40/50 и шаг 10
          tiers:[[15,15],[20,20],[25,25]], step:[5,5],
          desc:'При срабатывании вызывает кровотечение: N% от автоатаки в секунду, 4 сек, стакается'},
  monster:{nm:'КНИГА МОНСТРОВ', col:'#d95ec2', ico:'\u25B2',
          tiers:[[5,5],[10,10],[15,15]], step:[5,5],
          desc:'+N% врагов в последующих волнах. Больше целей — больше опыта, золота и книг. Стакается без предела'},
  xp:    {nm:'КНИГА ОПЫТА', col:'#4fd1c5', ico:'\u2726',
          tiers:[[5,5],[10,10],[15,15]], step:[5,5],
          desc:'+N% к получаемому опыту. Стакается без предела'},
};
/* ---------- 3a-bis. АМУЛЕТЫ ----------
   Второй тип находки в том же пуле дропа, что и книги. Разница принципиальная:
   книга при повторной находке растит тир, амулет находится РОВНО ОДИН РАЗ за партию.
   Поэтому амулет — не источник цифр, а разовое изменение правил боя, и почти каждый
   висит на своём таймере или условии.

     rar   — 1 редкий, 2 эпический, 3 легендарный; влияет только на вес в дропе
     ico   — значок в интерфейсе
     nt    — что делает, человеческим языком

   Механики живут не здесь, а в точках врезки (recalc, hurt, killEnemy, update):
   амулет — это флаг, который эти точки читают через amu('id'). */
/* Слот — только подпись и группировка в панели: правило «один предмет каждого
   вида за партию» и без того держится по ключу, а ограничений «одно кольцо
   на руку» в игре нет и не планируется. */
const SLOTS = {amu:'АМУЛЕТ', glove:'ПЕРЧАТКИ', boot:'БОТИНКИ', ring:'КОЛЬЦО', rel:'РЕЛИКВИЯ'};

/* ---------- ТОТЕМЫ ----------
   Третий тип находки. Каждый тип входит в пул дропа только после того, как игрок
   нашёл хотя бы одну соответствующую книгу. Ведут себя как книги: тот же тотем
   при повторной находке растёт в ранге, а на четвёртом выпадать перестаёт. Дают процент урона по целям
   с нужным статусом — то есть работают только у того, кто этот статус вообще
   накладывает, и потому не являются «просто прибавкой к урону всем подряд».
   Проверка статуса живёт в conditionalInc, значит тотемы действуют и на свиту. */
const TOTEM_RANKS = ['МАЛЫЙ', 'СРЕДНИЙ', 'БОЛЬШОЙ', 'ВЕЛИКИЙ'];
const TOTEM_VALS  = [2, 4, 6, 10];
const TOTEMS = {
  fire:  {nm:'ТОТЕМ ОГНЯ',      col:'#ff7a2f', ico:'\u25B2', st:'горящим',       book:'fire'},
  freeze:{nm:'ТОТЕМ ЗАМОРОЗКИ', col:'#7fd6ff', ico:'\u2744', st:'замороженным',  book:'cold'},
  poison:{nm:'ТОТЕМ ОТРАВЛЕНИЯ',col:'#8be04e', ico:'\u2623', st:'отравленным',   book:'poison'},
  blood: {nm:'ТОТЕМ КРОВИ',     col:'#e0405a', ico:'\u2620', st:'кровоточащим', book:'bleed'},
  lightning:{nm:'ТОТЕМ МОЛНИИ', col:'#6fb3ff', ico:'\u26A1', st:'шокированным',  book:'shock'},
};
const TOTEM_KEYS = Object.keys(TOTEMS);
/* Ранг тотема: 0 — нет, 1..4 — от малого до великого */
const totemTier = k => (G.totems && G.totems[k]) || 0;
const totemVal  = k => totemTier(k) ? TOTEM_VALS[totemTier(k)-1] : 0;
/* Исходная доля тотемов в общем пуле до индивидуальных множителей частоты. */
const TOTEM_SHARE = 0.25;
const AMULETS = {
  /* --- Легендарные предметы --- */
  heartSecond:{nm:'СЕРДЦЕ СЕКУНДЫ',col:'#ffad42',ico:'\u2665',slot:'amu',rar:3,
    nt:'каждая секунда без движения даёт +10% скорости атаки, максимум +60% · движение отнимает 25% заряда в секунду · пока есть заряд, скорость бега снижена на 25% · рывок полностью очищает заряд'},
  titansHands:{nm:'РУКИ ТИТАНА',col:'#ff8b3d',ico:'\u270A',slot:'glove',rar:3,warriorOnly:true,
    nt:'только Воину · скорость ближней атаки уменьшается на 35%, но каждый взмах выпускает волну на 60% фактически прошедшего урона основной цели · основная цель исключается · каждый сосед применяет защиту · волна не критует и не создаёт новую волну'},
  stepBeyond:{nm:'ШАГ ЗА ГРАНЬ',col:'#f28cff',ico:'\u27EB',slot:'boot',rar:3,
    nt:'после рывка следующая обычная атака повторяется через 0,1 сек с силой 100% · восстановление зарядов рывка на 50% медленнее · эхо не критует, не накладывает статусы и не запускает предметы или другое эхо'},
  marchDead:{nm:'МАРШ МЁРТВЫХ',col:'#8fe36b',ico:'\u2620',slot:'boot',rar:3,minOnly:true,
    nt:'только Некроманту · скорость героя снижена на 30%, но свита получает +80% скорости движения и не может быть замедлена · не снимает оглушение и не ускоряет атаки · бонус существует только пока предмет найден в текущем забеге'},
  zeroDistanceRing:{nm:'КОЛЬЦО НУЛЕВОЙ ДИСТАНЦИИ',col:'#ff6bd6',ico:'\u2299',slot:'ring',rar:3,mageOnly:true,
    nt:'только Магу · все сферы, включая мини-сферы, детонируют сразу вокруг героя · уникальный множитель радиуса взрыва ×1,6, урон взрыва +35% · прямое попадание снаряда исчезает полностью, дальний полёт и самонаведение не работают · притяжение применяется от позиции героя'},
  invertedCrown:{nm:'ПЕРЕВЁРНУТАЯ КОРОНА',col:'#ffcf55',ico:'\u265B',slot:'rel',rar:3,
    nt:'каждая элитная пачка получает ещё трёх элитных врагов · шанс предмета с элит и боссов повышается на 40%, а 20% предметов получают редкость на ступень выше · все враги получают +15% максимального HP · легендарную редкость повысить нельзя · дополнительные элитные враги выдают обычную награду'},
  archivist:{nm:'АРХИВАРИУС',col:'#f0b35a',ico:'\u2263',slot:'rel',rar:3,
    nt:'каждая найденная книга немедленно получает дополнительный тир · вес выпадения книг и тотемов после находки реликвии уменьшается вдвое'},

  /* --- Эпические предметы --- */
  emptyThroneSeal:{nm:'ПЕЧАТЬ ПУСТОГО ТРОНА',col:'#b884ff',ico:'\u265C',slot:'rel',rar:2,warriorOnly:true,
    nt:'только Воину · если 0,8 сек рядом нет врага в радиусе обычного взмаха, следующий взмах получает +80 дальности и +35% урона · герой не телепортируется · внутренний откат 2 сек · круговая волна наследует только обычный исходный урон'},
  surgeonsHand:{nm:'РУКА ХИРУРГА',col:'#c08cff',ico:'\u2695',slot:'glove',rar:2,
    nt:'последовательные прямые попадания по одной цели уменьшают её броню на 2% за удар, максимум на 80% · стаки исчезают после 2 сек без прямого попадания · на боссах сила каждого стака вдвое меньше · предметный урон не копит стаки'},
  betweenWorldsBoots:{nm:'САПОГИ МЕЖДУ МИРАМИ',col:'#9f7aea',ico:'\u25D0',slot:'boot',rar:2,
    nt:'рывок оставляет на 1 сек неподвижную тень; ближайшие обычные враги временно выбирают её целью · тень не имеет HP и не взрывается · внутренний откат 3 сек · элиты получают половину длительности, боссы игнорируют'},
  unhealedWoundRing:{nm:'КОЛЬЦО НЕЗАЖИВШЕЙ РАНЫ',col:'#b56ee8',ico:'\u2298',slot:'ring',rar:2,
    nt:'прямой удар продлевает один самый близкий к завершению наносящий урон статус цели на 1 сек · нельзя превысить исходную длительность статуса больше чем на 2 сек · сила тиков не пересчитывается'},
  deadGodClock:{nm:'ЧАСЫ МЁРТВОГО БОГА',col:'#8d6bd6',ico:'\u231B',slot:'rel',rar:2,
    nt:'если герой теряет не меньше 30% максимального HP за 2 сек, его позиция и текущее HP возвращаются к состоянию двухсекундной давности · откат 45 сек · не воскресает после уже обработанной смерти и не возвращает потраченные предметы, заряды или убитых врагов'},

  /* --- Обычные предметы --- */
  copperChronometer:{nm:'Медный Хронометр',col:'#c99052',ico:'\u23F1',slot:'rel',rar:0,
    nt:'после 2 сек без обычной атаки следующая обычная атака наносит на 25% больше урона; заряд тратится первым прямым попаданием и не усиливает DoT, предметы или вторичные цепи'},
  knottedCharm:{nm:'Шнурованный Оберег',col:'#b79b72',ico:'\u221E',slot:'amu',rar:0,
    nt:'фактически полученный урон восстанавливает 15% одного заряда рывка · внутренний откат 1.5 сек · не создаёт заряд сверх максимума'},
  tallyGloves:{nm:'Перчатки Счёта',col:'#b9a46d',ico:'\u216B',slot:'glove',rar:0,
    nt:'каждый двенадцатый прямой удар героя даёт +20% скорости атаки на 1.5 сек · свита, DoT и предметы не двигают счётчик'},
  smithThumbstall:{nm:'Кузнечный Напальчник',col:'#9da5ae',ico:'\u2692',slot:'glove',rar:0,
    nt:'атаки игнорируют 20 брони противника · не снижает броню постоянно и не действует на волны, шипы или предметный урон'},
  draftGloves:{nm:'Перчатки Сквозняка',col:'#89bddd',ico:'\u27B6',slot:'glove',rar:0,archerOnly:true,
    nt:'только Лучнику · исчезнувшая без попаданий стрела с шансом 1% усиливает следующую стрелу: +40% самонаведения и +20% скорости · возвратные и предметные стрелы не заряжают эффект'},
  satinGloves:{nm:'Сатиновые Перчатки',col:'#b98dde',ico:'\u25C9',slot:'glove',rar:0,mageOnly:true,
    nt:'только Магу · исчезнувшая без попаданий сфера с шансом 1% даёт следующей сфере +20% радиуса взрыва · мини-сферы Мультипликации не заряжают и не расходуют эффект'},
  hobnailedSoles:{nm:'Шипованные Подошвы',col:'#9da5ae',ico:'\u25B1',slot:'boot',rar:0,
    nt:'после 0.8 сек без движения герой получает +20 брони и не смещается от обычного отбрасывания · движение или рывок немедленно снимают стойку'},
  shortCircuitBoots:{nm:'Сапоги Короткого Разряда',col:'#62c9d0',ico:'\u26A1',slot:'boot',rar:0,
    nt:'рывок сквозь врага замедляет его на 40% на 0.6 сек · одна цель срабатывает один раз за рывок · на боссах замедление вдвое слабее'},
  trailfinders:{nm:'Следопыты',col:'#88b879',ico:'\u27A4',slot:'boot',rar:0,
    nt:'после 5 сек без фактического урона скорость передвижения повышается на 10% · следующий фактический урон снимает бонус, а уклонение — нет'},
  boneSpurs:{nm:'Костяные Шпоры',col:'#d2c8a7',ico:'\u22B9',slot:'boot',rar:0,minOnly:true,
    nt:'только Некроманту · пока герой движется, приспешники в радиусе 300 получают +25% скорости передвижения · скорость атаки не меняется'},
  firstTraceRing:{nm:'Кольцо Первого Следа',col:'#ad9c74',ico:'\u25CC',slot:'ring',rar:0,
    nt:'первое прямое попадание по врагу с полным HP наносит +10% урона · один раз на врага · DoT, предметы и волны не получают и не расходуют бонус'},
  closeHarvestRing:{nm:'Кольцо Близкой Жатвы',col:'#a07167',ico:'\u25CE',slot:'ring',rar:0,
    nt:'убийство врага в радиусе 100 восстанавливает 1% максимального HP · внутренний откат 1 сек · враги без награды не считаются'},

  /* --- Редкие предметы --- */
  sealHunt:{nm:'Печать Охоты',col:'#d6a84f',ico:'\u2316',slot:'rel',rar:1,
    nt:'первое попадание по элите или боссу ставит одну метку на 8 сек; каждый пятый прямой удар по метке получает +25% урона'},
  mothFang:{nm:'Зуб Мотылька',col:'#d9c96f',ico:'\u22B1',slot:'amu',rar:1,needChill:true,
    nt:'убийство охлаждённого врага поджигает двух ближайших противников на 15% фактически прошедшего добивающего удара за 2 сек'},
  cometEye:{nm:'Глаз Кометы',col:'#9dc7ff',ico:'\u2604',slot:'amu',rar:1,mageOnly:true,
    nt:'взрыв обычной или мини-сферы, задевший ровно одного врага, наносит ему +30% урона; прямое попадание не усиливается'},
  sealPack:{nm:'Печать Стаи',col:'#a9d38b',ico:'\u2725',slot:'rel',rar:1,minOnly:true,
    nt:'каждый различный живой тип приспешника даёт всей свите +8% урона, максимум четыре типа и +32%'},
  eclipseBrushes:{nm:'Кисти Затмения',col:'#a98be8',ico:'\u224B',slot:'glove',rar:1,mageOnly:true,
    nt:'взрыв обычной сферы по четырём или более врагам даёт следующей сфере +25% радиуса и −10% урона; бонус не складывается'},
  sparkstepBoots:{nm:'Сапоги Искрового Шага',col:'#67d8dc',ico:'\u273A',slot:'boot',rar:1,
    nt:'рывок оставляет сигил; через 0,4 сек он поражает ближайшего врага на 45% среднего урона автоатаки'},
  marchingGreaves:{nm:'Маршевые Поножи',col:'#8fb48c',ico:'\u27B2',slot:'boot',rar:1,minOnly:true,
    nt:'после 2 сек непрерывного движения живая свита получает +20% скорости бега и +10% скорости атаки; остановка сразу снимает эффект'},
  secondWindRing:{nm:'Кольцо Второго Дыхания',col:'#72c8a7',ico:'\u21BB',slot:'ring',rar:1,
    nt:'каждые 40 наградных убийств восстанавливают один полный заряд рывка; переполнение невозможно'},
  coolingAshRing:{nm:'Кольцо Остывающего Пепла',col:'#86cce7',ico:'\u2746',slot:'ring',rar:1,needIgnite:true,
    nt:'убийство горящего врага охлаждает двух ближайших противников на 0,6 сек; на боссах длительность вдвое меньше'},
  confinementRing:{nm:'Кольцо Тесноты',col:'#cf9c69',ico:'\u2299',slot:'ring',rar:1,
    nt:'+3% ко всему урону за каждого обычного врага в радиусе 160, максимум десять врагов и +30%; число фиксируется на атаку'},
  reactionRing:{nm:'Кольцо Реакции',col:'#d7cf78',ico:'\u27F2',slot:'ring',rar:1,needDodge:true,
    nt:'успешное уклонение делает следующее прямое попадание героя в течение 2 сек гарантированным критом; внутренний откат 3 сек'},
  conductorRing:{nm:'Кольцо Проводника',col:'#80baff',ico:'\u26A1',slot:'ring',rar:1,needShock:true,
    nt:'разряд шока может перескочить ещё на три цели; каждый дополнительный переход наносит на 30% меньше предыдущего'},
  ledgerDebts:{nm:'Книга Долгов',col:'#c49a70',ico:'\u2263',slot:'rel',rar:1,
    nt:'каждый новый предмет после этой реликвии даёт герою +3% урона и повышает HP текущих и будущих врагов на 2%; максимум 20 стаков'},
  glassBell:{nm:'Стеклянный Колокол',col:'#b9e8ef',ico:'\u25C7',slot:'rel',rar:1,
    nt:'раз в 10 сек вражеский снаряд в радиусе 100 разрушается и оглушает стрелявшего на 0,4 сек; босс получает 0,2 сек'},

  mirror: {nm:'ЧЁРНОЕ ЗЕРКАЛО', col:'#c08cff', ico:'\u25D1', slot:'amu', rar:2,
    nt:'после получения урона рядом встаёт ваша копия на 3 сек и повторяет ваши атаки · откат 10 сек'},
  golem:  {nm:'СЕРДЦЕ ГОЛЕМА',  col:'#9aa7b4', ico:'\u2B1B', slot:'amu', rar:1,
    nt:'+50 к броне · раз в 10 сек следующий удар по вам гасится полностью'},
  fang:   {nm:'КЛЫК ВАМПИРА',   col:'#e0405a', ico:'\u25BC', slot:'amu', rar:1,
    nt:'+4% вампиризма · убийство элиты или босса лечит на 15% здоровья'},
  storm:  {nm:'СЕРДЦЕ БУРИ',    col:'#ffe14a', ico:'\u26A1', slot:'amu', rar:1,
    nt:'раз в 8 сек молния бьёт ближайшего врага втройне и шокирует его'},
  ash:    {nm:'ПЕПЕЛЬНОЕ СЕРДЦЕ',col:'#ff7a2f',ico:'\u25C6', slot:'amu', rar:1,
    nt:'+35% к урону огнём · смерть горящего врага лечит на 1% здоровья'},
  ice:    {nm:'ЛЕДЯНОЙ КРИСТАЛЛ',col:'#7fd6ff',ico:'\u2744', slot:'amu', rar:1,
    nt:'+35% к урону холодом · заморозка держится на 40% дольше'},
  plague: {nm:'ЧУМНОЙ ЗУБ',     col:'#8be04e', ico:'\u2620', slot:'amu', rar:1,
    nt:'+35% к урону ядом · 10% шанс, что с трупа яд перепрыгнет на соседа и продлится на 2 сек'},
  clock:  {nm:'ЧАСОВОЙ МЕХАНИЗМ',col:'#4fd1c5',ico:'\u23F1', slot:'amu', rar:2,
    nt:'+10% к скорости атаки · раз в 30 сек всё вокруг вас замерзает на 1 сек'},
  shard:  {nm:'ЗЕРКАЛЬНЫЙ ОСКОЛОК',col:'#6fb3ff',ico:'\u25E7', slot:'amu', rar:1,
    nt:'10% шанс отбить вражеский снаряд обратно — он летит дальше уже как ваш'},
  bone:   {nm:'КОСТЬ УДАЧИ',    col:'#ffd24a', ico:'\u2680', slot:'amu', rar:1,
    nt:'каждый двадцатый ваш удар — гарантированный крит'},
  candle: {nm:'ЧЁРНАЯ СВЕЧА',   col:'#d95ec2', ico:'\u2721', slot:'amu', rar:1,
    nt:'+20% врагов в волнах и +15% к получаемому опыту — сделка, а не подарок'},
  calm:   {nm:'ТАЛИСМАН ПОКОЯ', col:'#5ec2e0', ico:'\u25CB', slot:'amu', rar:1,
    nt:'простояли 2 сек — получаете барьер на 10% здоровья · после расхода откат 5 сек'},
  runner: {nm:'ТАЛИСМАН БЕГУНА',col:'#8be04e', ico:'\u27A4', slot:'amu', rar:1,
    nt:'+20% скорости в движении · +20% урона, если стоите дольше секунды'},
  doll:   {nm:'КУКЛА СМЕРТИ',   col:'#ff5a4e', ico:'\u2694', slot:'amu', rar:3,
    nt:'один раз на этаже отменяет смертельный удар целиком и даёт полторы секунды неуязвимости'},

  /* --- Перчатки --- */
  claws:  {nm:'КОГТИ БЕРСЕРКА', col:'#e0405a', ico:'\u2042', slot:'glove', rar:1,
    nt:'+20% к скорости атаки · +1% к урону за каждые 10% потерянного здоровья'},
  thunder:{nm:'ПЕРЧАТКИ ГРОМА', col:'#ffe14a', ico:'\u26A1', slot:'glove', rar:1,
    nt:'каждый двенадцатый удар шокирует цель и бьёт разрядом по округе'},
  ricochet:{nm:'ПЕРЧАТКИ РИКОШЕТА', col:'#6fb3ff', ico:'\u21BB', slot:'glove', rar:1,
    nt:'+1 отскок · каждый отскок усиливает снаряд на 10% вместо обычного затухания'},
  brute:  {nm:'ПЕРЧАТКИ ГРОМИЛЫ', col:'#c08a3a', ico:'\u270A', slot:'glove', rar:0,
    nt:'+50% к шансу отбрасывания и в полтора раза сильнее толчок · −10% к скорости атаки'},

  /* --- Ботинки --- */
  lava:   {nm:'БОТИНКИ ЛАВЫ',   col:'#ff7a2f', ico:'\u25B2', slot:'boot', rar:2,
    nt:'за вами тянется горящий след · его урон растёт от вашей скорости бега'},
  frost:  {nm:'БОТИНКИ МОРОЗИЛКИ', col:'#7fd6ff', ico:'\u2603', slot:'boot', rar:1,
    nt:'за вами тянется ледяной след, охлаждающий всех, кто в него зашёл'},

  /* --- Кольца --- */
  pulse:  {nm:'КОЛЬЦО ИМПУЛЬСА', col:'#4fd1c5', ico:'\u25CE', slot:'ring', rar:0,
    nt:'каждый восьмой удар выпускает ударную волну по площади'},
  exec:   {nm:'КОЛЬЦО ДОБИВАНИЯ', col:'#ff5a4e', ico:'\u2620', slot:'ring', rar:1,
    nt:'+50% к урону по врагам, у которых осталось меньше пятой части здоровья'},
  duel:   {nm:'КОЛЬЦО ДУЭЛИ',   col:'#c08cff', ico:'\u2694', slot:'ring', rar:2,
    nt:'если в радиусе 300 остался ровно один враг, урон по нему множится на 1.75'},
  reaper: {nm:'КОЛЬЦО СМЕРТИ',  col:'#9aa7b4', ico:'\u2625', slot:'ring', rar:2,
    nt:'каждые 100 убийств следующий удар убивает цель мгновенно, кем бы она ни была'},

  /* --- Реликвии --- */
  chalice:{nm:'ЧАША КРОВИ',     col:'#e0405a', ico:'\u222A', slot:'rel', rar:2,
    nt:'каждые 50 убийств полностью восстанавливают здоровье'},
  crown:  {nm:'КОРОНА ПЕПЛА',   col:'#ffb340', ico:'\u265B', slot:'rel', rar:2,
    nt:'+50% ко всему урону стихиями: огонь, холод, молния и яд разом'},
  bmask:  {nm:'МАСКА БОССА',    col:'#d95ec2', ico:'\u2620', slot:'rel', rar:2,
    nt:'каждая пачка элиты получает лишний аффикс, но с её последнего бойца находка гарантирована'},

  /* --- Ритм боя: движение против стойки --- */
  momentum:{nm:'РАЗГОН',        col:'#8be04e', ico:'\u21D2', slot:'boot', rar:1,
    nt:'+4% урона за каждые 2 сек непрерывного бега, до +40%. Любая остановка обнуляет разгон'},
  siege:  {nm:'ОСАДНЫЙ ОГОНЬ',  col:'#ff7a2f', ico:'\u25A3', slot:'ring', rar:2,
    nt:'простояли 1.5 сек — +70% урона, но вдвое медленнее ходите. Сделка для тех, кто умеет выбирать место'},
  marathon:{nm:'САПОГИ МАРАФОНЦА',col:'#6fd98f',ico:'\u27A6', slot:'boot', rar:1,
    nt:'+3% к скорости бега за каждые 3 сек без остановки, до +30%'},
  panic:  {nm:'ПАНИКА',         col:'#ff5a4e', ico:'\u2757', slot:'boot', rar:1,
    nt:'здоровья меньше трети — +60% к скорости бега'},
  sprint: {nm:'ПОСЛЕДНИЙ РЫВОК',col:'#ffd24a', ico:'\u25B6', slot:'boot', rar:1,
    nt:'каждое убийство даёт +40% к скорости бега на 2 сек'},

  /* --- Реакция и добивание --- */
  riposte:{nm:'КОНТРУДАР',      col:'#e0405a', ico:'\u21BA', slot:'glove', rar:2,
    nt:'получили удар — ваш следующий бьёт на 150% сильнее'},
  headsman:{nm:'РУКА ПАЛАЧА',   col:'#9aa7b4', ico:'\u2694', slot:'ring', rar:2,
    nt:'по врагам ниже 15% здоровья урон удваивается. Множитель поверх всей формулы'},
  predator:{nm:'ГЛАЗ ХИЩНИКА',  col:'#ffb340', ico:'\u25C9', slot:'amu', rar:1,
    nt:'+20% урона на 2 сек после убийства, каждое следующее продлевает'},
  bossShard:{nm:'ОСКОЛОК БОССА',col:'#d95ec2', ico:'\u25C7', slot:'rel', rar:2,
    nt:'+5% урона за каждого элитного врага в радиусе 250, до +50%. Чем страшнее комната, тем сильнее вы'},

  /* --- Стихийные связки --- */
  trinity:{nm:'ТРИЕДИНСТВО',    col:'#c08cff', ico:'\u2735', slot:'rel', rar:2,
    nt:'цель горит, охлаждена и отравлена одновременно — следующий удар по ней гарантированный крит'},
  overload:{nm:'ПЕРЕГРУЗКА',    col:'#ffe14a', ico:'\u26A1', slot:'rel', rar:2,
    nt:'поджог шокированного врага вызывает разряд по округе'},

  /* --- Криты --- */
  critmass:{nm:'КРИТИЧЕСКАЯ МАССА',col:'#ff9a2f',ico:'\u2739', slot:'glove', rar:2,
    nt:'каждый крит выпускает волну радиусом 55 на половину его урона. Радиус растёт от «Радиуса области»'},
  critchain:{nm:'ЦЕПЬ КРИТОВ',  col:'#ffd24a', ico:'\u26D3', slot:'glove', rar:1,
    nt:'после крита следующий удар получает +10% шанса крита, до трёх раз подряд'},
  critaim: {nm:'КРИТИЧЕСКИЙ ПРИЦЕЛ',col:'#7fd6ff',ico:'\u25CE', slot:'ring', rar:1,
    nt:'простояли секунду — +25% к шансу крита'},

  /* --- Защита --- */
  fullplate:{nm:'ПАНЦИРЬ ЦЕЛОГО',col:'#9aa7b4',ico:'\u25A0', slot:'amu', rar:1,
    nt:'пока здоровье полное, получаемый урон на 35% меньше'},
  lastplate:{nm:'ПОСЛЕДНЯЯ БРОНЯ',col:'#c08a3a',ico:'\u25A4', slot:'amu', rar:1,
    nt:'здоровья меньше пятой части — получаемый урон на 40% меньше'},
  steel:  {nm:'СТАЛЬНАЯ ВОЛЯ',  col:'#6fb3ff', ico:'\u25EC', slot:'amu', rar:2,
    nt:'один удар не может снять больше 80% вашего запаса. Срабатывает раз в 10 сек'},
  breath: {nm:'ПОСЛЕДНИЙ ВЗДОХ',col:'#ff5a4e', ico:'\u2661', slot:'rel', rar:3,
    nt:'смертельный удар оставляет 1 здоровья и даёт 2 сек неуязвимости. Откат 120 сек'},
  pulse:  {nm:'ПУЛЬС ЖИЗНИ',    col:'#e0405a', ico:'\u2665', slot:'amu', rar:1,
    nt:'каждые 15 сек восстанавливает 5% запаса'},

  /* --- Контроль и утилита --- */
  vacuum: {nm:'ВАКУУМ',         col:'#5ec2e0', ico:'\u25CC', slot:'ring', rar:1,
    nt:'каждое убийство коротко подтягивает соседей к месту смерти'},
  gravity:{nm:'ГРАВИТАЦИОННЫЙ КОЛОДЕЦ',col:'#c08cff',ico:'\u25C9', slot:'rel', rar:2,
    nt:'раз в 12 сек рядом открывается воронка: секунду тянет врагов к себе, потом взрывается'},
  shove:  {nm:'ТАРАННАЯ ПЕРЧАТКА',col:'#c08a3a',ico:'\u261B', slot:'glove', rar:1,
    nt:'каждый восьмой удар отбрасывает врага втрое сильнее обычного'},
  looter: {nm:'ОХОТНИК ЗА ЛУТОМ',col:'#f0c040',ico:'\u2726', slot:'ring', rar:1,
    nt:'радиус подбора опыта и золота впятеро больше'},

  /* --- Только некроманту --- */
  warskel:{nm:'БОЕВЫЕ СКЕЛЕТЫ', col:'#e6e2d6', ico:'\u2620', slot:'rel', rar:2, minOnly:true,
    nt:'скелеты бьют на 25% чаще. Големов и бомбардиров не касается'},

  /* --- Разгон по условию --- */
  swift:  {nm:'ТАЛИСМАН СКОРОСТИ', col:'#4fd1c5', ico:'\u27F3', slot:'amu', rar:2,
    nt:'убийство элиты или босса даёт +20% к скорости атаки и бега на 5 сек. Свита разгоняется вместе с вами'},
  survive:{nm:'ТАЛИСМАН ВЫЖИВАНИЯ', col:'#e0405a', ico:'\u2695', slot:'amu', rar:2,
    nt:'пока здоровья меньше трети — +20% к скорости атаки и бега. Свите достаётся тоже'},

  /* --- Утилита --- */
  arrow:  {nm:'СТРЕЛА ИЗ КОЛЕНА', col:'#6fb3ff', ico:'\u2197', slot:'ring', rar:1,
    nt:'+50% к скорости снарядов. Дальность не меняется — снаряд просто долетает быстрее'},
  goldbag:{nm:'БЕСКОНЕЧНЫЙ МЕШОК ЗОЛОТА', col:'#f0c040', ico:'\u25CF', slot:'rel', rar:2,
    nt:'+50% золота с элитных монстров и боссов. Рядовые платят как обычно'},
  xpbag:  {nm:'БЕСКОНЕЧНЫЙ МЕШОК ОПЫТА', col:'#4fd1c5', ico:'\u2726', slot:'rel', rar:2,
    nt:'+50% опыта с элитных монстров и боссов. Рядовые платят как обычно'},
};
const AMU_KEYS = Object.keys(AMULETS);
/* Исходные доли категорий и отдельные нерфы частоты. Категории по-прежнему
   делят один бросок: предметы выпадают вдвое реже, книги и тотемы — втрое. */
const AMU_SHARE = 0.30;
const BOOK_SHARE = 1 - AMU_SHARE - TOTEM_SHARE;
const ITEM_DROP_SCALE = 1/2, BOOK_DROP_SCALE = 1/3, TOTEM_DROP_SCALE = 1/3;
const FIND_RATE_SCALE = AMU_SHARE*ITEM_DROP_SCALE + BOOK_SHARE*BOOK_DROP_SCALE + TOTEM_SHARE*TOTEM_DROP_SCALE;
const amu = k => !!(G.amu && G.amu[k]);
function hasAnyAmulet(){ if (!G||!G.amu) return false;for (const k in G.amu) return true;return false; }
const ledgerStacks = () => G && G.player ? Math.min(20,G.player.ledgerStacks||0) : 0;
const ledgerEnemyHpMul = () => 1 + ledgerStacks()*0.02;
function sealPackDamagePct(){
  if (!G || !amu('sealPack')) return 0;
  const kinds=new Set();
  for (const m of G.minions) if (m.hp>0){
    kinds.add(m.kind);
    if (kinds.size>=4) return 32;
  }
  return kinds.size*8;
}
function confinementDamagePct(){
  if (!G || !amu('confinementRing')) return 0;
  let n=0;
  for (const e of G.enemies) if (!e.dead && e.hp>0 && e.kind==='norm' && dist(e,G.player)<=160 && ++n>=10) break;
  return n*3;
}
const EMPTY_DAMAGE_CONDITION_SNAPSHOT={damageBossShardInc:0,damageDuelActive:false,damageNearbyCount:0};
/* Условия ниже зависят от окружения источника, но не от конкретной цели удара.
   Массовая атака снимает их один раз и передаёт всем своим попаданиям. Один
   проход заменяет три отдельных обхода врагов; точные старые границы и даже
   историческое правило Дуэли/Осколка учитывать ещё не удалённых врагов сохранены. */
function damageConditionSnapshot(from=G && G.player){
  if (!G || !G.player || !G.enemies || !from) return EMPTY_DAMAGE_CONDITION_SNAPSHOT;
  const needBossShard=amu('bossShard'), needDuel=amu('duel');
  const needNearby=!!(G.bag && G.bag.sum('perNear'));
  if (!needBossShard && !needDuel && !needNearby) return EMPTY_DAMAGE_CONDITION_SNAPSHOT;
  const p=G.player, sameSource=from===p;
  let elites=0, duelNear=0, nearby=0;
  for (const e of G.enemies){
    let playerDistanceSq=-1;
    if ((needBossShard&&elites<10)||(needDuel&&duelNear<=1)||(needNearby&&sameSource&&nearby<8)){
      const dx=e.x-p.x,dy=e.y-p.y;playerDistanceSq=dx*dx+dy*dy;
    }
    if (needBossShard&&elites<10&&e.kind!=='norm'&&playerDistanceSq<250*250) elites++;
    if (needDuel&&duelNear<=1&&playerDistanceSq<300*300) duelNear++;
    if (needNearby&&nearby<8&&!e.dead&&
        (sameSource?playerDistanceSq:distSq(e,from))<220*220) nearby++;
    if ((!needBossShard||elites>=10)&&(!needDuel||duelNear>1)&&(!needNearby||nearby>=8)) break;
  }
  return {damageBossShardInc:elites*5,damageDuelActive:needDuel&&duelNear===1,damageNearbyCount:nearby};
}
function bossShardDamageInc(){
  if (!G || !amu('bossShard')) return 0;
  let elites=0;
  for (const e of G.enemies) if (e.kind!=='norm'&&dist(e,G.player)<250&&++elites>=10) break;
  return elites*5;
}
function enemyBurning(e){
  return !!(e && ((e.dots && e.dots.fire && e.dots.fire.dps>0) ||
    (e.mothBurns && e.mothBurns.some(b=>b.life>0&&b.rawLeft>0))));
}

/* Шанс срабатывания: 10% за книгу, потолок 100%. Дальше растёт только сила эффекта. */
const bookChance = k => G.items[k] ? Math.min(100, G.items[k].tier * 10) : 0;
const BOOK_KEYS = Object.keys(BOOKS);

/* ---------- 3b. ПОСТОЯННОЕ ХРАНИЛИЩЕ ----------
   Среда исполнения заранее неизвестна, поэтому пробуем три уровня по очереди:
   storage-API артефактов → localStorage → память на время вкладки.
   Игра работает в любом случае, разница только в том, переживёт ли банк перезагрузку. */
const CONST_NORMAL_REQ = [100,250,500,1000,2000,4000,8000,15000,30000,60000];
const CONST_ELITE_REQ  = [25,60,125,250,500,1000,2000,4000,8000,15000];
const CONST_BOSS_REQ   = [5,10,20,40,75,150,300,600,1200,2500];
const CONSTELLATIONS = [
  {id:'runner', nm:'БЕГУН',    sub:'треугольные охотники', shape:'triangle', col:'#8be04e', req:CONST_NORMAL_REQ},
  {id:'blob',   nm:'ЯДРО',     sub:'круглые сгустки',      shape:'circle',   col:'#5ec2e0', req:CONST_NORMAL_REQ},
  {id:'tank',   nm:'БАСТИОН',  sub:'квадратные тяжёлые',   shape:'square',   col:'#e0743c', req:CONST_NORMAL_REQ},
  {id:'shooter',nm:'ПРИЗМА',   sub:'ромбовидные стрелки',  shape:'diamond',  col:'#d95ec2', req:CONST_NORMAL_REQ},
  {id:'elite',  nm:'ЭЛИТА',    sub:'усиленные противники', shape:'elite',    col:'#ffd24a', req:CONST_ELITE_REQ},
  {id:'boss',   nm:'БОСС',     sub:'боссы этажей X3/X6/X9/X0', shape:'boss', col:'#ff5a4e', req:CONST_BOSS_REQ},
];
const CONST_IDS = CONSTELLATIONS.map(x => x.id);

/* Мягкая миграция: старые сохранения получают только пустые счётчики и ранги.
   Золото, магазин и рекорды остаются как были. Заодно нормализуем повреждённые
   значения, чтобы ручная правка localStorage не дала отрицательный ранг. */
function normalizeConstellations(data){
  const cs = data.constellations && typeof data.constellations === 'object'
    ? data.constellations : (data.constellations = {});
  const kills = cs.kills && typeof cs.kills === 'object' ? cs.kills : (cs.kills = {});
  const ranks = cs.ranks && typeof cs.ranks === 'object' ? cs.ranks : (cs.ranks = {});
  for (const id of CONST_IDS){
    kills[id] = Math.max(0, Math.floor(Number(kills[id]) || 0));
    ranks[id] = clamp(Math.floor(Number(ranks[id]) || 0), 0, 10);
  }
  return cs;
}

/* История смертей добавлена без смены ключа сохранения: старые данные просто
   получают пустой массив. Повреждённые записи отбрасываются или приводятся к
   безопасным числам, а хвост жёстко ограничивается десятью забегами. */
function normalizeGraveyard(data){
  const src = Array.isArray(data.graveyard) ? data.graveyard : [];
  const num = (v, max=1e15) => Math.min(max, Math.max(0, Number(v) || 0));
  const text = (v, fallback='') => (typeof v === 'string' ? v : fallback).slice(0, 120);
  data.graveyard = src.filter(r => r && typeof r === 'object').slice(0,10).map(r => ({
    stamp:num(r.stamp), weaponId:text(r.weaponId,'wpn.bow'), weaponName:text(r.weaponName,'ЛУЧНИК'),
    subclassName:text(r.subclassName), sprite:['archer','mage','necromancer','warrior'].includes(r.sprite) ? r.sprite : 'archer',
    floor:Math.max(1,Math.floor(num(r.floor,1e5))), lvl:Math.max(1,Math.floor(num(r.lvl,1e6))), duration:Math.floor(num(r.duration)),
    earned:Math.floor(num(r.earned)), bankAfter:Math.floor(num(r.bankAfter)), bestAfter:Math.floor(num(r.bestAfter,1e5)),
    cause:text(r.cause,'неизвестна'), deathDmg:Math.floor(num(r.deathDmg)), kills:Math.floor(num(r.kills)),
    normals:Math.floor(num(r.normals)), elites:Math.floor(num(r.elites)), bosses:Math.floor(num(r.bosses)),
    damage:num(r.damage), maxHit:num(r.maxHit), crits:Math.floor(num(r.crits)), taken:num(r.taken), healing:num(r.healing),
    distance:num(r.distance), modifiers:Math.floor(num(r.modifiers,1e5)), books:Math.floor(num(r.books,1e4)),
    bookTiers:Math.floor(num(r.bookTiers,1e4)), amulets:Math.floor(num(r.amulets,1e4)),
    totems:Math.floor(num(r.totems,1e4)), cleared:Math.floor(num(r.cleared,1e5)),
  }));
  return data.graveyard;
}

/* Удалённые товары возвращаются из старых сохранений полностью:
   игрок не теряет вложенное золото, а повторно миграция не срабатывает, потому
   что ключи сразу удаляются. Формула и старые потолки зафиксированы здесь. */
const REMOVED_SHOP_UPGRADES = [
  {id:'dr',    max:60, base:3000, grow:1.075},
  {id:'block', max:60, base:2500, grow:1.07},
  {id:'sarmor',max:70, base:3000, grow:1.075},
  {id:'vacuum',max:10, base:3000, grow:1.55},
];
function migrateRemovedShopUpgrades(data){
  const shop = data.shop && typeof data.shop === 'object' ? data.shop : (data.shop = {});
  let refund = 0;
  for (const it of REMOVED_SHOP_UPGRADES){
    const lvl = Math.min(it.max, Math.max(0, Math.floor(Number(shop[it.id]) || 0)));
    for (let i=0; i<lvl; i++) refund += shopCost(it, i);
    delete shop[it.id];
  }
  if (refund){
    data.gold = Math.max(0, Number(data.gold) || 0) + refund;
    data.spent = Math.max(0, (Number(data.spent) || 0) - refund);
  }
  return refund;
}
/* Старые уровни товаров выше новых потолков не должны ни действовать, ни
   исчезать без компенсации. Возврат считается по прежним кривым, по которым
   эти уровни действительно покупались. После первого прохода ранг обрезается,
   поэтому миграция идемпотентна. */
function migrateCappedShopUpgrades(data){
  const shop = data.shop && typeof data.shop === 'object' ? data.shop : (data.shop = {});
  let refund=0;
  const oldSpeed = {base:1000,grow:1.11}, rawSpeed = Math.max(0, Math.floor(Number(shop.mspd) || 0));
  if (rawSpeed > 10){
    for (let i=10; i<Math.min(rawSpeed,50); i++) refund+=shopCost(oldSpeed,i);
    shop.mspd=10;
  }
  // Уворот сжат с 70 до 25 рангов. Лишние ранги старого сохранения полностью
  // возвращаются по прежней кривой, чтобы смена потолка не сжигала вложенное золото.
  const oldDodge = {base:4200,grow:1.08}, rawDodge = Math.max(0, Math.floor(Number(shop.dodge) || 0));
  if (rawDodge > 25){
    for (let i=25; i<Math.min(rawDodge,70); i++) refund+=shopCost(oldDodge,i);
    shop.dodge=25;
  }
  if (refund){
    data.gold=Math.max(0,Number(data.gold)||0)+refund;
    data.spent=Math.max(0,(Number(data.spent)||0)-refund);
  }
  return refund;
}
function normalizeMeta(data){
  normalizeConstellations(data); normalizeGraveyard(data);
  return migrateRemovedShopUpgrades(data)+migrateCappedShopUpgrades(data);
}

const STORE_KEY = 'grinder_meta_reset_2026'; // полный сброс: прежний банк и все покупки больше не читаются
const Store = {
  data: {gold:0, spent:0, best:0, unlocks:{}, shop:{}, economy:3, constellations:{kills:{},ranks:{}}, graveyard:[]},
  mode: 'память',
  async load(){
    try{
      const r = await window.storage.get(STORE_KEY);
      if (r && r.value) this.data = Object.assign(this.data, JSON.parse(r.value));
      if (this.data.economy !== 3){ this.data.gold = 0; this.data.spent = 0; this.data.shop = {}; this.data.economy = 3; await this.save(); }
      const refunded = normalizeMeta(this.data);
      if (refunded) await this.save();
      this.mode = 'облако'; return;
    }catch(e){}
    try{
      const v = localStorage.getItem(STORE_KEY);
      if (v) this.data = Object.assign(this.data, JSON.parse(v));
      if (this.data.economy !== 3){ this.data.gold = 0; this.data.spent = 0; this.data.shop = {}; this.data.economy = 3; await this.save(); }
      const refunded = normalizeMeta(this.data);
      if (refunded) await this.save();
      this.mode = 'браузер'; return;
    }catch(e){}
    normalizeMeta(this.data);
  },
  async save(){
    normalizeMeta(this.data);
    const j = JSON.stringify(this.data);
    try{ await window.storage.set(STORE_KEY, j); return; }catch(e){}
    try{ localStorage.setItem(STORE_KEY, j); }catch(e){}
  },
};

const constellationState = () => normalizeConstellations(Store.data);
const constellationRank = id => constellationState().ranks[id] || 0;
const constellationKills = id => constellationState().kills[id] || 0;
const constellationMultiplier = e => 1 + constellationRank(
  e.kind === 'boss' ? 'boss' : e.kind === 'elite' ? 'elite' : e.typeKey
) * 0.05;

/* ---------- 3c. МАГАЗИН ----------
   Постоянная прокачка за золото из банка. Единственное место в игре, где золото
   тратится, поэтому катaлог держим декларативным: цена уровня n = base * grow^n,
   потолок max. Бонусы входят в игру через ту же сумку модификаторов, что и карточки
   (см. shopApply) — движок про магазин не знает вообще, формулы урона не тронуты.

   Про темп роста цены. Замер дохода бота (жезл, бессмертный, 4 прогона):
   этаж 10 — 4 100 золота, этаж 20 — 24 000, этаж 30 — 78 000. Смертный бот
   приносит 400..12 000 за партию. Отсюда база в 1000 — это «уровень за партию»
   в начале, а потолок ветки — тысячи партий. Растить цену медленнее нельзя:
   иначе ветка закрывается за неделю и золото снова некуда девать.  */
const SHOP = [
  {id:'regen',  cat:'defense', nm:'БЫСТРОЕ ЛЕЧЕНИЕ', max:50, base:3300, grow:1.06, fmt:l => '+' + l + ' HP/5 сек',
   nt:'+1 HP раз в 5 секунд за уровень, пока здоровье ниже 50% максимума. Потолок 50 уровней.'},
  {id:'armor',  cat:'defense', nm:'БРОНЯ', max:30, base:3600, grow:1.04, fmt:l => '+' + l, nt:'+1 к броне за уровень, потолок 30.'},
  {id:'drFlat', cat:'defense', nm:'ПАНЦИРЬ ОТ РОЯ', max:100, base:250, grow:1.03, fmt:l => '+' + l + ' с удара', nt:'Вычитает 1 урона из каждого попадания за уровень, максимум 100. Самая дешёвая защитная ветка магазина.'},
  // Новые 25 рангов суммарно стоят ровно столько же, сколько прежние 70:
  // 11 424 500 золота с учётом округления shopCost().
  {id:'dodge',  cat:'defense', nm:'УВОРОТ', max:25, base:4126, grow:1.3102994289, unit:'%', nt:'+1% шанса уворота за уровень, потолок магазинного бонуса 25%.'},
  {id:'dashRecharge',cat:'defense',nm:'ВОССТАНОВЛЕНИЕ РЫВКА',max:10,base:3000,grow:1.12,
   nt:'+5% к скорости восстановления заряда за уровень, максимум +50%. На максимуме базовые 5 секунд сокращаются до 3,33 секунды.',
   fmt:l => '+' + (l*5) + '%'},
  {id:'dashLength',cat:'defense',nm:'ДЛИННЫЙ РЫВОК',max:5,base:4500,grow:1.18,
   nt:'+5% к дистанции рывка за уровень, максимум +25%. Длительность неуязвимости не меняется.',
   fmt:l => '+' + (l*5) + '%'},
  {id:'dashN',  cat:'defense', nm:'ЗАРЯДЫ РЫВКА', max:2, base:20000, grow:2.2, fmt:l => '+' + l, nt:'Дополнительный заряд рывка. Базовый один, максимум три; каждый заряд восстанавливается 5 секунд.'},
  {id:'itemDrop', cat:'qol', nm:'ИСКАТЕЛЬ РЕЛИКВИЙ', max:10, base:25000, grow:1.8, unit:'%',
   nt:'Повышает шанс любой случайной находки примерно на 0,38 процентного пункта за ранг. На максимуме: обычный враг 0,15% → 3,99%, элита 0,77% → 4,60%, босс 6,13% → 9,97%. Дорогая QoL-ветка, не добавляет силу напрямую.',
   fmt:l => l ? '+' + (l*FIND_RATE_SCALE).toFixed(2).replace('.', ',') + ' п.п. к шансу находки' : '—'},
  {id:'startSkill', cat:'qol', nm:'ПЕРВЫЙ ШАГ', max:5, base:24000, grow:2.4,
   nt:'В начале каждой новой партии даёт одно дополнительное повышение уровня за ранг. На максимуме выбираете пять модификаторов до первого боя.',
   fmt:l => l ? '+' + l + ' к стартовым навыкам' : '—'},
  {id:'card4',  cat:'qol', nm:'ЧЕТВЁРТАЯ КАРТА', max:1, base:5000, grow:1,
   nt:'При повышении уровня показывать четыре модификатора вместо трёх. Действует всю партию, на каждом уровне.',
   fmt:l => l ? 'открыта' : '—'},
  {id:'dmg',    nm:'ВЕСЬ УРОН',       max:500,  base:6250, grow:1.014, unit:'%',
   nt:'+1% ко всему урону: оружие, стихии, свита, поджог, яд, кровотечение. Складывается в общий процент вместе с карточками.'},
  {id:'aspd',   nm:'СКОРОСТЬ АТАКИ',  max:100,  base:7500, grow:1.065, unit:'%',
   nt:'+1% к скорости атаки. Тот же процент, что и на карточках, — суммируется с ними в один множитель.'},
  {id:'hpFlat', cat:'health', nm:'ЗДОРОВЬЕ ПЛЮСОМ', max:1000, base:100,  grow:1.007,
   nt:'+1 к максимальному здоровью. Прибавляется ДО процентов, поэтому каждый процент здоровья делает его дороже по эффекту.',
   fmt:l => '+' + l},
  {id:'hpPct', cat:'health', nm:'ЗДОРОВЬЕ В ПРОЦЕНТАХ', max:1000, base:5000, grow:1.012, unit:'%',
   nt:'+1% к максимальному здоровью. Дорогая ветка: процент усиливает и базовое здоровье, и все постоянные прибавки здоровья.'},
  {id:'mspd', cat:'qol', nm:'СКОРОСТЬ БЕГА', max:10, base:1000, grow:1.33235, unit:'%',
   nt:'+1% к скорости передвижения за уровень, максимум +10%. Все десять уровней вместе стоят 50 000 золота.'},
  {id:'sxp',    nm:'ОПЫТ',            max:500,  base:1500, grow:1.012, unit:'%',
   nt:'+1% к получаемому опыту. Быстрее уровни — больше карточек за партию, то есть покупка не силы, а скорости сборки билда.'},
  {id:'sgold',  nm:'ЗОЛОТО',          max:500,  base:750,  grow:1.012, unit:'%',
   nt:'+1% к найденному золоту. Единственная покупка, которая окупает сама себя, поэтому берётся первой почти всегда.'},
  {id:'smon',   nm:'ПЛОТНОСТЬ ВРАГОВ',max:1000, base:500,  grow:1.007, unit:'%',
   nt:'+1% врагов на этаже. Сделка, а не подарок: больше опыта, золота и находок, но и этаж дольше, и толпа плотнее.'},
];

/* Ограничение применяется и к старым сохранениям: если прежний потолок товара
   был выше, сохранённые лишние ранги больше не проходят в характеристики. */
const shopLvl = id => {
  const raw = Math.max(0, Math.floor(Number(Store.data.shop && Store.data.shop[id]) || 0));
  const it = SHOP.find(x => x.id === id);
  return it ? Math.min(raw, it.max) : 0;
};

/* Цена следующего уровня. Округляем до трёх значащих цифр — «106 000» читается,
   «105 993» нет, а на баланс разница в четверть процента не влияет. */
function shopCost(it, lvl){
  const raw = it.base * Math.pow(it.grow, lvl);
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 2));
  return Math.round(raw / p) * p;
}
/* Цена пачки из n уровней подряд, начиная с текущего. */
function shopBatch(it, n){
  let lvl = shopLvl(it.id), sum = 0, cnt = 0;
  for (let i = 0; i < n && lvl < it.max; i++, lvl++){ sum += shopCost(it, lvl); cnt++; }
  return {sum, cnt};
}
/* Возврат идёт с последнего ранга назад: так игрок получает ровно ту сумму,
   которую заплатил за отменяемые уровни, включая округление цены. */
function shopRefundBatch(it, n){
  let lvl = shopLvl(it.id), sum = 0, cnt = 0;
  for (let i = 0; i < n && lvl > 0; i++){ lvl--; sum += shopCost(it, lvl); cnt++; }
  return {sum, cnt};
}
function shopRefundTotal(){
  let sum=0,cnt=0;
  for (const it of SHOP){
    const part=shopRefundBatch(it,shopLvl(it.id));
    sum+=part.sum; cnt+=part.cnt;
  }
  return {sum,cnt};
}

/* Единственная точка, где покупки превращаются в характеристики.
   Всё идёт через сумку: движку не нужно знать, откуда взялся процент. */
function shopApply(bag){
  if (shopLvl('hpFlat')) bag.add('life', 'flat', shopLvl('hpFlat'));
  if (shopLvl('hpPct'))  bag.add('life', 'inc',  shopLvl('hpPct'));
  if (shopLvl('dmg'))    bag.add('dmg',  'inc',  shopLvl('dmg'));
  if (shopLvl('aspd'))   bag.add('aspd', 'inc',  shopLvl('aspd'));
  if (shopLvl('mspd'))   bag.add('mspd', 'inc',  shopLvl('mspd'));
  if (shopLvl('regen'))  bag.add('regen', 'flat', shopLvl('regen'));
  if (shopLvl('armor'))  bag.add('armor', 'flat', shopLvl('armor'));
  if (shopLvl('drFlat')) bag.add('drFlat', 'flat', shopLvl('drFlat'));
  if (shopLvl('dodge'))  bag.add('dodge', 'flat', shopLvl('dodge'));
  if (shopLvl('dashRecharge')) bag.add('dashRecharge', 'inc', shopLvl('dashRecharge')*5);
  if (shopLvl('dashLength'))   bag.add('dashLength', 'inc', shopLvl('dashLength')*5);
  if (shopLvl('dashN'))  bag.add('dashN', 'flat', shopLvl('dashN'));
  // Опыт и золото — обычные статы сумки, кладём туда же, где карточки и книги
  if (shopLvl('sxp'))    bag.add('xpGain',   'inc', shopLvl('sxp'));
  if (shopLvl('sgold'))  bag.add('goldFind', 'inc', shopLvl('sgold'));
  // Броня и плотность врагов своего стата в сумке не имеют — их читает recalc()
}

/* Сколько карточек показывать при повышении уровня */
const cardCount = () => 3 + (shopLvl('card4') ? 1 : 0);
