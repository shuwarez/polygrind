/* ---------- 1a. ЛОКАЛИЗАЦИЯ EN / RU ----------
   Русская строка остаётся каноническим ключом, чтобы старые сохранения и тесты
   не зависели от языка. Любой новый видимый текст добавляется сразу парой. */
const LANGUAGE_KEY = 'polygrind_language';
const SKILL_TIPS_KEY = 'polygrind_skill_tooltips';
const MENU_MUSIC_KEY = 'polygrind_menu_music';
const SFX_VOLUME_KEY = 'polygrind_sfx_volume';
const SFX_MUTED_KEY = 'polygrind_sfx_muted';
/* Банки попаданий по базовым типам: элита наследует банк через свой typeKey.
   Исходные OGG всех четырёх семейств устанавливаются без перекодирования. */
const MONSTER_HIT_SOUND_DATA = {
  blob:[
    'assets/audio/monster-hit-sound-data-74cd85da75.ogg',
    'assets/audio/monster-hit-sound-data-002-e1a65c6042.ogg',
    'assets/audio/monster-hit-sound-data-003-dc7ccc35d2.ogg'
  ],
  tank:[
    'assets/audio/monster-hit-sound-data-004-a2c6c3bc41.ogg',
    'assets/audio/monster-hit-sound-data-005-90f2e6b73e.ogg',
    'assets/audio/monster-hit-sound-data-006-7e26035ce5.ogg'
  ],
  shooter:[
    'assets/audio/monster-hit-sound-data-007-8021f6023d.ogg',
    'assets/audio/monster-hit-sound-data-008-7239440526.ogg',
    'assets/audio/monster-hit-sound-data-009-55b3e34eec.ogg'
  ],
  runner:[
    'assets/audio/monster-hit-sound-data-010-2ea87653e4.ogg',
    'assets/audio/monster-hit-sound-data-011-32ff555993.ogg',
    'assets/audio/monster-hit-sound-data-012-1953b319d1.ogg'
  ]
};
/* Звуки смерти обычных и элитных врагов выбираются по базовому typeKey. */
const MONSTER_DEATH_SOUND_DATA = {
  blob:[
    'assets/audio/monster-death-sound-data-de8cd0c3db.ogg',
    'assets/audio/monster-death-sound-data-002-71f9e8ba95.ogg',
    'assets/audio/monster-death-sound-data-003-f99b4fc554.ogg'
  ],
  tank:[
    'assets/audio/monster-death-sound-data-004-0d30931b3d.ogg',
    'assets/audio/monster-death-sound-data-005-b7f8f2efef.ogg',
    'assets/audio/monster-death-sound-data-006-f9b36d2de5.ogg'
  ],
  shooter:[
    'assets/audio/monster-death-sound-data-007-a507da1b3e.ogg',
    'assets/audio/monster-death-sound-data-008-ba69122f65.ogg',
    'assets/audio/monster-death-sound-data-009-5e440c38c6.ogg'
  ],
  runner:[
    'assets/audio/monster-death-sound-data-010-7fe093fbee.ogg',
    'assets/audio/monster-death-sound-data-011-5012e71971.ogg',
    'assets/audio/monster-death-sound-data-012-a765ffb6a9.ogg'
  ]
};
/* Четыре коротких выстрела Лучника хранятся без перекодирования: исходные OGG
   занимают меньше 19 КБ вместе. Каждый залп выбирает одну вариацию случайно. */
const ARCHER_SHOT_SOUND_DATA = [
  'assets/audio/archer-shot-sound-data-e83fb0ac21.ogg',
  'assets/audio/archer-shot-sound-data-002-ec935773bc.ogg',
  'assets/audio/archer-shot-sound-data-003-24f9c4859d.ogg',
  'assets/audio/archer-shot-sound-data-004-b2dec10673.ogg'
];
/* Четыре вариации взмаха Воина хранятся отдельными компактными OGG. */
const WARRIOR_ATTACK_SOUND_DATA = [
  'assets/audio/warrior-attack-sound-data-f3151e1df0.ogg',
  'assets/audio/warrior-attack-sound-data-002-2fc1f197d7.ogg',
  'assets/audio/warrior-attack-sound-data-003-d0f22b1f6e.ogg',
  'assets/audio/warrior-attack-sound-data-004-5782807b2b.ogg'
];
/* Четыре магических импульса выбираются случайно один раз на основную атаку. */
const MAGE_ATTACK_SOUND_DATA = [
  'assets/audio/mage-attack-sound-data-83413af1e3.ogg',
  'assets/audio/mage-attack-sound-data-002-2e91b225d9.ogg',
  'assets/audio/mage-attack-sound-data-003-73e74c2676.ogg',
  'assets/audio/mage-attack-sound-data-004-07aa6cd881.ogg'
];
/* Hover UI после обрезки тихого хвоста и нормализации занимает около 1,4 КБ. */
const HOVER_SOUND_DATA = 'assets/audio/hover-sound-data-2c140998b3.ogg';
/* Короткий звук подтверждения хранится отдельным компактным OGG/Opus. */
const CONFIRM_SOUND_DATA = 'assets/audio/confirm-sound-data-82a2741879.ogg';
/* Новый сигнал повышения уровня хранится без перекодирования и заменяет
   прежний двухнотный синтез через Web Audio. */
const LEVEL_UP_SOUND_DATA = 'assets/audio/level-up-sound-data-912afe17e5.ogg';
/* Музыка главного меню загружается из локального OGG-файла. */
const MENU_MUSIC_DATA = 'assets/audio/menu-music-data-f0eaed2ffc.ogg';
let LANGUAGE = (() => {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return saved === 'ru' ? 'ru' : 'en';
  } catch (e) { return 'en'; }
})();
let SKILL_TIPS_ENABLED = (() => {
  try { return localStorage.getItem(SKILL_TIPS_KEY) !== 'off'; }
  catch (e) { return true; }
})();
let MENU_MUSIC_ENABLED = (() => {
  try { return localStorage.getItem(MENU_MUSIC_KEY) !== 'off'; }
  catch (e) { return true; }
})();
let SFX_VOLUME = (() => {
  try {
    const saved=Number(localStorage.getItem(SFX_VOLUME_KEY));
    return Number.isFinite(saved) && localStorage.getItem(SFX_VOLUME_KEY) !== null
      ? Math.max(0,Math.min(100,Math.round(saved))) : 50;
  } catch (e) { return 50; }
})();
let SFX_MUTED = (() => {
  try { return localStorage.getItem(SFX_MUTED_KEY) === 'on'; }
  catch (e) { return false; }
})();

const EN_ITEMS = [
  ["СЕРДЦЕ СЕКУНДЫ", "HEART OF THE SECOND"], ["каждая секунда без движения даёт +10% скорости атаки, максимум +60% · движение отнимает 25% заряда в секунду · пока есть заряд, скорость бега снижена на 25% · рывок полностью очищает заряд", "each second without moving grants +10% Attack Speed, up to +60% · moving drains 25% charge per second · while charged, Movement Speed is reduced by 25% · Dashing clears all charge"],
  ["РУКИ ТИТАНА", "TITAN'S HANDS"], ["только Воину · скорость ближней атаки уменьшается на 35%, но каждый взмах выпускает волну на 60% фактически прошедшего урона основной цели · основная цель исключается · каждый сосед применяет защиту · волна не критует и не создаёт новую волну", "Warrior only · melee Attack Speed is reduced by 35%, but every swing releases a wave for 60% of the actual damage dealt to the primary target · the primary target is excluded · each neighbor applies its own defense · the wave cannot Critical Hit or create another wave"],
  ["ШАГ ЗА ГРАНЬ", "STEP BEYOND"], ["после рывка следующая обычная атака повторяется через 0,1 сек с силой 100% · восстановление зарядов рывка на 50% медленнее · эхо не критует, не накладывает статусы и не запускает предметы или другое эхо", "after Dashing, the next basic attack repeats after 0.1 sec at 100% power · Dash charges recover 50% slower · the echo cannot Critical Hit, apply statuses, trigger items, or create another echo"],
  ["МАРШ МЁРТВЫХ", "MARCH OF THE DEAD"], ["только Некроманту · скорость героя снижена на 30%, но свита получает +80% скорости движения и не может быть замедлена · не снимает оглушение и не ускоряет атаки · бонус существует только пока предмет найден в текущем забеге", "Necromancer only · hero Movement Speed is reduced by 30%, but minions gain +80% Movement Speed and cannot be Slowed · does not remove Stun or increase Attack Speed · the bonus exists only while the item is owned in the current run"],
  ["КОЛЬЦО НУЛЕВОЙ ДИСТАНЦИИ", "RING OF ZERO DISTANCE"], ["только Магу · все сферы, включая мини-сферы, детонируют сразу вокруг героя · уникальный множитель радиуса взрыва ×1,6, урон взрыва +35% · прямое попадание снаряда исчезает полностью, дальний полёт и самонаведение не работают · притяжение применяется от позиции героя", "Mage only · all orbs, including mini-orbs, detonate immediately around the hero · unique explosion-radius multiplier ×1.6 and +35% explosion damage · the projectile's direct hit is removed entirely, long flight and homing do not function · pull originates from the hero's position"],
  ["ПЕРЕВЁРНУТАЯ КОРОНА", "INVERTED CROWN"], ["каждая элитная пачка получает ещё трёх элитных врагов · шанс предмета с элит и боссов повышается на 40%, а 20% предметов получают редкость на ступень выше · все враги получают +15% максимального HP · легендарную редкость повысить нельзя · дополнительные элитные враги выдают обычную награду", "each elite pack gains three additional elite enemies · item chance from elites and bosses is increased by 40%, and 20% of items are upgraded by one rarity step · all enemies gain +15% maximum HP · Legendary rarity cannot be upgraded · additional elite enemies grant normal rewards"],
  ["АРХИВАРИУС", "THE ARCHIVIST"], ["каждая найденная книга немедленно получает дополнительный тир · вес выпадения книг и тотемов после находки реликвии уменьшается вдвое", "each book found immediately gains an additional tier · the drop weight of books and totems is halved after finding the relic"],
  ["Сердце секунды", "Heart of the Second"], ["заряда", "charge"],
  ["ПЕЧАТЬ ПУСТОГО ТРОНА", "SEAL OF THE EMPTY THRONE"], ["только Воину · если 0,8 сек рядом нет врага в радиусе обычного взмаха, следующий взмах получает +80 дальности и +35% урона · герой не телепортируется · внутренний откат 2 сек · круговая волна наследует только обычный исходный урон", "Warrior only · if no enemy is within normal swing range for 0.8 sec, the next swing gains +80 reach and +35% damage · the hero does not teleport · 2 sec internal cooldown · the circular wave inherits only the normal source damage"],
  ["РУКА ХИРУРГА", "SURGEON'S HAND"], ["последовательные прямые попадания по одной цели уменьшают её броню на 2% за удар, максимум на 80% · стаки исчезают после 2 сек без прямого попадания · на боссах сила каждого стака вдвое меньше · предметный урон не копит стаки", "consecutive direct hits against one target reduce its Armor by 2% per hit, up to 80% · stacks expire after 2 sec without a direct hit · each stack is half as strong against bosses · item damage cannot build stacks"],
  ["САПОГИ МЕЖДУ МИРАМИ", "BOOTS BETWEEN WORLDS"], ["рывок оставляет на 1 сек неподвижную тень; ближайшие обычные враги временно выбирают её целью · тень не имеет HP и не взрывается · внутренний откат 3 сек · элиты получают половину длительности, боссы игнорируют", "a Dash leaves an immobile shadow for 1 sec; nearby normal enemies temporarily target it · the shadow has no HP and does not explode · 3 sec internal cooldown · elites receive half duration, bosses ignore it"],
  ["КОЛЬЦО НЕЗАЖИВШЕЙ РАНЫ", "RING OF THE UNHEALED WOUND"], ["прямой удар продлевает один самый близкий к завершению наносящий урон статус цели на 1 сек · нельзя превысить исходную длительность статуса больше чем на 2 сек · сила тиков не пересчитывается", "a direct hit extends one damaging status on the target that is closest to expiring by 1 sec · a status cannot exceed its original duration by more than 2 sec · tick strength is not recalculated"],
  ["ЧАСЫ МЁРТВОГО БОГА", "CLOCK OF THE DEAD GOD"], ["если герой теряет не меньше 30% максимального HP за 2 сек, его позиция и текущее HP возвращаются к состоянию двухсекундной давности · откат 45 сек · не воскресает после уже обработанной смерти и не возвращает потраченные предметы, заряды или убитых врагов", "if the hero loses at least 30% of maximum HP within 2 sec, their position and current HP return to the state from two seconds ago · 45 sec cooldown · cannot resurrect after death has already been processed and does not restore spent items, charges, or slain enemies"],
  ["Медный Хронометр", "Copper Chronometer"], ["после 2 сек без обычной атаки следующая обычная атака наносит на 25% больше урона; заряд тратится первым прямым попаданием и не усиливает DoT, предметы или вторичные цепи", "after 2 sec without a basic attack, your next basic attack deals 25% more damage; the charge is consumed by its first direct hit and does not affect DoT, items, or secondary chains"],
  ["Шнурованный Оберег", "Knotted Charm"], ["фактически полученный урон восстанавливает 15% одного заряда рывка · внутренний откат 1.5 сек · не создаёт заряд сверх максимума", "damage actually taken restores 15% of one Dash charge · 1.5 sec internal cooldown · cannot grant charges beyond the maximum"],
  ["Перчатки Счёта", "Tally Gloves"], ["каждый двенадцатый прямой удар героя даёт +20% скорости атаки на 1.5 сек · свита, DoT и предметы не двигают счётчик", "every twelfth direct hero hit grants +20% Attack Speed for 1.5 sec · minions, DoT, and item hits do not advance the counter"],
  ["Кузнечный Напальчник", "Smith's Thumbstall"], ["атаки игнорируют 20 брони противника · не снижает броню постоянно и не действует на волны, шипы или предметный урон", "attacks ignore 20 enemy Armor · does not permanently reduce Armor and does not affect waves, Thorns, or item damage"],
  ["Перчатки Сквозняка", "Draft Gloves"], ["только Лучнику · исчезнувшая без попаданий стрела с шансом 1% усиливает следующую стрелу: +40% самонаведения и +20% скорости · возвратные и предметные стрелы не заряжают эффект", "Archer only · an arrow that disappears without hitting has a 1% chance to empower the next arrow with +40% homing and +20% speed · returning and item arrows cannot charge it"],
  ["Сатиновые Перчатки", "Satin Gloves"], ["только Магу · исчезнувшая без попаданий сфера с шансом 1% даёт следующей сфере +20% радиуса взрыва · мини-сферы Мультипликации не заряжают и не расходуют эффект", "Mage only · an orb that disappears without hitting has a 1% chance to grant the next orb +20% explosion radius · Multiplication mini-orbs neither charge nor consume it"],
  ["Шипованные Подошвы", "Hobnailed Soles"], ["после 0.8 сек без движения герой получает +20 брони и не смещается от обычного отбрасывания · движение или рывок немедленно снимают стойку", "after 0.8 sec without moving, gain +20 Armor and resist ordinary knockback displacement · moving or Dashing immediately removes the stance"],
  ["Сапоги Короткого Разряда", "Short-Circuit Boots"], ["рывок сквозь врага замедляет его на 40% на 0.6 сек · одна цель срабатывает один раз за рывок · на боссах замедление вдвое слабее", "Dashing through an enemy Slows it by 40% for 0.6 sec · each target can trigger once per Dash · the Slow is half as strong against bosses"],
  ["Следопыты", "Trailfinders"], ["после 5 сек без фактического урона скорость передвижения повышается на 10% · следующий фактический урон снимает бонус, а уклонение — нет", "after 5 sec without taking actual damage, gain +10% Movement Speed · the next actual damage removes the bonus, while a Dodge does not"],
  ["Костяные Шпоры", "Bone Spurs"], ["только Некроманту · пока герой движется, приспешники в радиусе 300 получают +25% скорости передвижения · скорость атаки не меняется", "Necromancer only · while the hero is moving, minions within 300 range gain +25% Movement Speed · Attack Speed is unaffected"],
  ["Кольцо Первого Следа", "Ring of the First Trace"], ["первое прямое попадание по врагу с полным HP наносит +10% урона · один раз на врага · DoT, предметы и волны не получают и не расходуют бонус", "the first direct hit against an enemy at full HP deals +10% damage · once per enemy · DoT, items, and waves neither gain nor consume the bonus"],
  ["Кольцо Близкой Жатвы", "Ring of the Close Harvest"], ["убийство врага в радиусе 100 восстанавливает 1% максимального HP · внутренний откат 1 сек · враги без награды не считаются", "killing an enemy within 100 range restores 1% of maximum HP · 1 sec internal cooldown · enemies with no rewards do not count"],
  ["Медный Хронометр +25% урона", "Copper Chronometer +25% damage"],
  ["Шипованные Подошвы - +20 к броне", "Hobnailed Soles - +20 Armor"],
  ["Следопыта +10% скорости перемещения", "Trailfinders +10% Movement Speed"],
  ["Печать Охоты", "Seal of the Hunt"], ["первое попадание по элите или боссу ставит одну метку на 8 сек; каждый пятый прямой удар по метке получает +25% урона", "the first hit against an elite or boss places one mark for 8 sec; every fifth direct hit against the mark gains +25% damage"],
  ["Зуб Мотылька", "Moth Fang"], ["убийство охлаждённого врага поджигает двух ближайших противников на 15% фактически прошедшего добивающего удара за 2 сек", "killing a Chilled enemy Ignites the two nearest enemies for 15% of the finishing hit's actual damage over 2 sec"],
  ["Глаз Кометы", "Comet Eye"], ["взрыв обычной или мини-сферы, задевший ровно одного врага, наносит ему +30% урона; прямое попадание не усиливается", "a normal or mini-orb explosion that hits exactly one enemy deals +30% damage to it; the direct hit is not empowered"],
  ["Печать Стаи", "Seal of the Pack"], ["каждый различный живой тип приспешника даёт всей свите +8% урона, максимум четыре типа и +32%", "each distinct living minion type grants the entire army +8% damage, up to four types and +32%"],
  ["Кисти Затмения", "Eclipse Brushes"], ["взрыв обычной сферы по четырём или более врагам даёт следующей сфере +25% радиуса и −10% урона; бонус не складывается", "a normal-orb explosion hitting four or more enemies grants the next orb +25% radius and −10% damage; the bonus does not stack"],
  ["Сапоги Искрового Шага", "Sparkstep Boots"], ["рывок оставляет сигил; через 0,4 сек он поражает ближайшего врага на 45% среднего урона автоатаки", "a Dash leaves a sigil that strikes the nearest enemy after 0.4 sec for 45% of average basic-attack damage"],
  ["Маршевые Поножи", "Marching Greaves"], ["после 2 сек непрерывного движения живая свита получает +20% скорости бега и +10% скорости атаки; остановка сразу снимает эффект", "after 2 sec of continuous movement, living minions gain +20% Movement Speed and +10% Attack Speed; stopping removes the effect immediately"],
  ["Кольцо Второго Дыхания", "Ring of Second Wind"], ["каждые 40 наградных убийств восстанавливают один полный заряд рывка; переполнение невозможно", "every 40 rewarding kills restore one full Dash charge; charges cannot overflow"],
  ["Кольцо Остывающего Пепла", "Ring of Cooling Ash"], ["убийство горящего врага охлаждает двух ближайших противников на 0,6 сек; на боссах длительность вдвое меньше", "killing a burning enemy Chills the two nearest enemies for 0.6 sec; duration is halved against bosses"],
  ["Кольцо Тесноты", "Ring of Confinement"], ["+3% ко всему урону за каждого обычного врага в радиусе 160, максимум десять врагов и +30%; число фиксируется на атаку", "+3% to all damage per normal enemy within 160 range, up to ten enemies and +30%; the count is snapshotted per attack"],
  ["Кольцо Реакции", "Ring of Reaction"], ["успешное уклонение делает следующее прямое попадание героя в течение 2 сек гарантированным критом; внутренний откат 3 сек", "a successful Dodge makes the hero's next direct hit within 2 sec a guaranteed Critical Hit; 3 sec internal cooldown"],
  ["Кольцо Проводника", "Conductor Ring"], ["разряд шока может перескочить ещё на три цели; каждый дополнительный переход наносит на 30% меньше предыдущего", "a Shock discharge can jump to three additional targets; each additional transition deals 30% less than the previous one"],
  ["Книга Долгов", "Ledger of Debts"], ["каждый новый предмет после этой реликвии даёт герою +3% урона и повышает HP текущих и будущих врагов на 2%; максимум 20 стаков", "each new item found after this relic grants the hero +3% damage and raises current and future enemy HP by 2%; maximum 20 stacks"],
  ["Стеклянный Колокол", "Glass Bell"], ["раз в 10 сек вражеский снаряд в радиусе 100 разрушается и оглушает стрелявшего на 0,4 сек; босс получает 0,2 сек", "once every 10 sec, an enemy projectile within 100 range is destroyed and Stuns its shooter for 0.4 sec; bosses receive 0.2 sec"],
  ["Свита +20% скорости передвижения, +10% скорости атаки", "Minions +20% Movement Speed, +10% Attack Speed"],
  ["убийств", "kills"], ["ко всему урону", "to all damage"], ["урона героя", "hero damage"], ["врагов", "enemies"],
  ["ЧЁРНОЕ ЗЕРКАЛО", "BLACK MIRROR"], ["после получения урона рядом встаёт ваша копия на 3 сек и повторяет ваши атаки · откат 10 сек", "when you take damage, a copy of you appears nearby for 3 sec and repeats your attacks · 10 sec cooldown"],
  ["СЕРДЦЕ ГОЛЕМА", "GOLEM HEART"], ["+50 к броне · раз в 10 сек следующий удар по вам гасится полностью", "+50 Armor · once every 10 sec, the next hit against you is completely negated"],
  ["КЛЫК ВАМПИРА", "VAMPIRE FANG"], ["+4% вампиризма · убийство элиты или босса лечит на 15% здоровья", "+4% Life Steal · killing an elite or boss restores 15% health"],
  ["СЕРДЦЕ БУРИ", "HEART OF THE STORM"], ["раз в 8 сек молния бьёт ближайшего врага втройне и шокирует его", "every 8 sec, lightning strikes the nearest enemy for triple damage and Shocks it"],
  ["ПЕПЕЛЬНОЕ СЕРДЦЕ", "ASHEN HEART"], ["+35% к урону огнём · смерть горящего врага лечит на 1% здоровья", "+35% Fire damage · the death of a burning enemy restores 1% health"],
  ["ЛЕДЯНОЙ КРИСТАЛЛ", "ICE CRYSTAL"], ["+35% к урону холодом · заморозка держится на 40% дольше", "+35% Cold damage · Freeze lasts 40% longer"],
  ["ЧУМНОЙ ЗУБ", "PLAGUE TOOTH"], ["+35% к урону ядом · 10% шанс, что с трупа яд перепрыгнет на соседа и продлится на 2 сек", "+35% Poison damage · 10% chance for Poison to jump from a corpse to a nearby enemy and last 2 sec longer"],
  ["ЧАСОВОЙ МЕХАНИЗМ", "CLOCKWORK"], ["+10% к скорости атаки · раз в 30 сек всё вокруг вас замерзает на 1 сек", "+10% Attack Speed · once every 30 sec, everything around you is Frozen for 1 sec"],
  ["ЗЕРКАЛЬНЫЙ ОСКОЛОК", "MIRROR SHARD"], ["10% шанс отбить вражеский снаряд обратно — он летит дальше уже как ваш", "10% chance to reflect an enemy projectile; it continues as your own projectile"],
  ["КОСТЬ УДАЧИ", "LUCKY BONE"], ["каждый двадцатый ваш удар — гарантированный крит", "every twentieth hit you deal is guaranteed to be a critical hit"],
  ["ЧЁРНАЯ СВЕЧА", "BLACK CANDLE"], ["+20% врагов в волнах и +15% к получаемому опыту — сделка, а не подарок", "+20% enemies in waves and +15% experience gained—a bargain, not a gift"],
  ["ТАЛИСМАН ПОКОЯ", "TALISMAN OF STILLNESS"], ["простояли 2 сек — получаете барьер на 10% здоровья · после расхода откат 5 сек", "stand still for 2 sec to gain a barrier equal to 10% of your health · 5 sec cooldown after the barrier is consumed"],
  ["ТАЛИСМАН БЕГУНА", "RUNNER'S TALISMAN"], ["+20% скорости в движении · +20% урона, если стоите дольше секунды", "+20% speed while moving · +20% damage after standing still for more than 1 sec"],
  ["КУКЛА СМЕРТИ", "DEATH DOLL"], ["один раз на этаже отменяет смертельный удар целиком и даёт полторы секунды неуязвимости", "once per floor, completely negates a fatal hit and grants 1.5 sec of invulnerability"],
  ["КОГТИ БЕРСЕРКА", "BERSERKER CLAWS"], ["+20% к скорости атаки · +1% к урону за каждые 10% потерянного здоровья", "+20% Attack Speed · +1% damage for every 10% of health missing"],
  ["ПЕРЧАТКИ ГРОМА", "THUNDER GLOVES"], ["каждый двенадцатый удар шокирует цель и бьёт разрядом по округе", "every twelfth hit Shocks the target and releases a lightning discharge nearby"],
  ["ПЕРЧАТКИ РИКОШЕТА", "RICOCHET GLOVES"], ["+1 отскок · каждый отскок усиливает снаряд на 10% вместо обычного затухания", "+1 Chain · each chain increases projectile damage by 10% instead of its usual damage loss"],
  ["ПЕРЧАТКИ ГРОМИЛЫ", "BRUISER GLOVES"], ["+50% к шансу отбрасывания и в полтора раза сильнее толчок · −10% к скорости атаки", "+50% Knockback Chance and 50% stronger knockback · −10% Attack Speed"],
  ["БОТИНКИ ЛАВЫ", "LAVA BOOTS"], ["за вами тянется горящий след · его урон растёт от вашей скорости бега", "you leave a burning trail behind you · its damage scales with your Movement Speed"],
  ["БОТИНКИ МОРОЗИЛКИ", "FROST BOOTS"], ["за вами тянется ледяной след, охлаждающий всех, кто в него зашёл", "you leave an icy trail that Chills every enemy that crosses it"],
  ["КОЛЬЦО ИМПУЛЬСА", "PULSE RING"], ["каждый восьмой удар выпускает ударную волну по площади", "every eighth hit releases an area shockwave"],
  ["КОЛЬЦО ДОБИВАНИЯ", "EXECUTION RING"], ["+50% к урону по врагам, у которых осталось меньше пятой части здоровья", "+50% damage to enemies below 20% health"],
  ["КОЛЬЦО ДУЭЛИ", "DUEL RING"], ["если в радиусе 300 остался ровно один враг, урон по нему множится на 1.75", "when exactly one enemy remains within 300 range, damage against it is multiplied by 1.75"],
  ["КОЛЬЦО СМЕРТИ", "DEATH RING"], ["каждые 100 убийств следующий удар убивает цель мгновенно, кем бы она ни была", "every 100 kills, your next hit instantly kills its target, no matter what it is"],
  ["ЧАША КРОВИ", "BLOOD CHALICE"], ["каждые 50 убийств полностью восстанавливают здоровье", "every 50 kills fully restore your health"],
  ["КОРОНА ПЕПЛА", "CROWN OF ASH"], ["+50% ко всему урону стихиями: огонь, холод, молния и яд разом", "+50% to all elemental damage: Fire, Cold, Lightning, and Poison"],
  ["МАСКА БОССА", "BOSS MASK"], ["каждая пачка элиты получает лишний аффикс, но с её последнего бойца находка гарантирована", "each elite pack gains an extra affix, but its last member always drops a find"],
  ["РАЗГОН", "MOMENTUM"], ["+4% урона за каждые 2 сек непрерывного бега, до +40%. Любая остановка обнуляет разгон", "+4% damage for every 2 sec of continuous movement, up to +40%. Stopping resets all Momentum"],
  ["ОСАДНЫЙ ОГОНЬ", "SIEGE FIRE"], ["простояли 1.5 сек — +70% урона, но вдвое медленнее ходите. Сделка для тех, кто умеет выбирать место", "after standing still for 1.5 sec, gain +70% damage but move at half speed. A trade-off for those who choose their ground well"],
  ["САПОГИ МАРАФОНЦА", "MARATHON BOOTS"], ["+3% к скорости бега за каждые 3 сек без остановки, до +30%", "+3% Movement Speed for every 3 sec without stopping, up to +30%"],
  ["ПАНИКА", "PANIC"], ["здоровья меньше трети — +60% к скорости бега", "while below one-third health, gain +60% Movement Speed"],
  ["ПОСЛЕДНИЙ РЫВОК", "FINAL SPRINT"], ["каждое убийство даёт +40% к скорости бега на 2 сек", "each kill grants +40% Movement Speed for 2 sec"],
  ["КОНТРУДАР", "RIPOSTE"], ["получили удар — ваш следующий бьёт на 150% сильнее", "after taking a hit, your next hit deals 150% more damage"],
  ["РУКА ПАЛАЧА", "EXECUTIONER'S HAND"], ["по врагам ниже 15% здоровья урон удваивается. Множитель поверх всей формулы", "damage is doubled against enemies below 15% health. This multiplier is applied on top of the entire formula"],
  ["ГЛАЗ ХИЩНИКА", "PREDATOR'S EYE"], ["+20% урона на 2 сек после убийства, каждое следующее продлевает", "+20% damage for 2 sec after a kill; each subsequent kill refreshes the duration"],
  ["Глаз хищника", "Predator's Eye"],
  ["ОСКОЛОК БОССА", "BOSS SHARD"], ["+5% урона за каждого элитного врага в радиусе 250, до +50%. Чем страшнее комната, тем сильнее вы", "+5% damage for each elite enemy within 250 range, up to +50%. The deadlier the room, the stronger you become"],
  ["ТРИЕДИНСТВО", "TRINITY"], ["цель горит, охлаждена и отравлена одновременно — следующий удар по ней гарантированный крит", "when a target is simultaneously Burning, Chilled, and Poisoned, your next hit against it is guaranteed to be critical"],
  ["ПЕРЕГРУЗКА", "OVERLOAD"], ["поджог шокированного врага вызывает разряд по округе", "Igniting a Shocked enemy releases a lightning discharge nearby"],
  ["КРИТИЧЕСКАЯ МАССА", "CRITICAL MASS"], ["каждый крит выпускает волну радиусом 55 на половину его урона. Радиус растёт от «Радиуса области»", "each critical hit releases a wave with 55 radius for half its damage. Radius scales with Area of Effect Radius"],
  ["ЦЕПЬ КРИТОВ", "CRITICAL CHAIN"], ["после крита следующий удар получает +10% шанса крита, до трёх раз подряд", "after a critical hit, your next hit gains +10% Critical Chance, up to three times in a row"],
  ["КРИТИЧЕСКИЙ ПРИЦЕЛ", "CRITICAL AIM"], ["простояли секунду — +25% к шансу крита", "stand still for 1 sec to gain +25% Critical Chance"],
  ["ПАНЦИРЬ ЦЕЛОГО", "UNBROKEN SHELL"], ["пока здоровье полное, получаемый урон на 35% меньше", "while at full health, take 35% less damage"],
  ["ПОСЛЕДНЯЯ БРОНЯ", "LAST ARMOR"], ["здоровья меньше пятой части — получаемый урон на 40% меньше", "while below 20% health, take 40% less damage"],
  ["СТАЛЬНАЯ ВОЛЯ", "STEEL WILL"], ["один удар не может снять больше 80% вашего запаса. Срабатывает раз в 10 сек", "a single hit cannot remove more than 80% of your maximum health. Can trigger once every 10 sec"],
  ["ПОСЛЕДНИЙ ВЗДОХ", "LAST BREATH"], ["смертельный удар оставляет 1 здоровья и даёт 2 сек неуязвимости. Откат 120 сек", "a fatal hit leaves you at 1 health and grants 2 sec of invulnerability. 120 sec cooldown"],
  ["ПУЛЬС ЖИЗНИ", "LIFE PULSE"], ["каждые 15 сек восстанавливает 5% запаса", "restores 5% of maximum health every 15 sec"],
  ["ВАКУУМ", "VACUUM"], ["каждое убийство коротко подтягивает соседей к месту смерти", "each kill briefly pulls nearby enemies toward the place of death"],
  ["ГРАВИТАЦИОННЫЙ КОЛОДЕЦ", "GRAVITY WELL"], ["раз в 12 сек рядом открывается воронка: секунду тянет врагов к себе, потом взрывается", "every 12 sec, a vortex opens nearby, pulling enemies in for 1 sec before exploding"],
  ["ТАРАННАЯ ПЕРЧАТКА", "RAMMING GLOVE"], ["каждый восьмой удар отбрасывает врага втрое сильнее обычного", "every eighth hit knocks the enemy back with triple force"],
  ["ОХОТНИК ЗА ЛУТОМ", "LOOT HUNTER"], ["радиус подбора опыта и золота впятеро больше", "experience and gold pickup radius is five times larger"],
  ["БОЕВЫЕ СКЕЛЕТЫ", "BATTLE SKELETONS"], ["скелеты бьют на 25% чаще. Големов и бомбардиров не касается", "Skeletons attack 25% faster. Does not affect Golems or Bombardiers"],
  ["ТАЛИСМАН СКОРОСТИ", "TALISMAN OF SPEED"], ["убийство элиты или босса даёт +20% к скорости атаки и бега на 5 сек. Свита разгоняется вместе с вами", "killing an elite or boss grants +20% Attack and Movement Speed for 5 sec. Your minions speed up with you"],
  ["ТАЛИСМАН ВЫЖИВАНИЯ", "TALISMAN OF SURVIVAL"], ["пока здоровья меньше трети — +20% к скорости атаки и бега. Свите достаётся тоже", "while below one-third health, gain +20% Attack and Movement Speed. Your minions gain it too"],
  ["СТРЕЛА ИЗ КОЛЕНА", "ARROW TO THE KNEE"], ["+50% к скорости снарядов. Дальность не меняется — снаряд просто долетает быстрее", "+50% Projectile Speed. Range is unchanged; projectiles simply reach their destination faster"],
  ["БЕСКОНЕЧНЫЙ МЕШОК ЗОЛОТА", "BOTTOMLESS BAG OF GOLD"], ["+50% золота с элитных монстров и боссов. Рядовые платят как обычно", "+50% gold from elites and bosses. Normal enemies pay the usual amount"],
  ["БЕСКОНЕЧНЫЙ МЕШОК ОПЫТА", "BOTTOMLESS BAG OF EXPERIENCE"], ["+50% опыта с элитных монстров и боссов. Рядовые платят как обычно", "+50% experience from elites and bosses. Normal enemies grant the usual amount"],
];

const EN_WORLD = [
  /* Созвездия и типы врагов */
  ["БЕГУН", "RUNNER"], ["треугольные охотники", "triangular hunters"],
  ["ЯДРО", "CORE"], ["круглые сгустки", "round blobs"],
  ["БАСТИОН", "BASTION"], ["квадратные тяжёлые", "square heavyweights"],
  ["ПРИЗМА", "PRISM"], ["ромбовидные стрелки", "diamond-shaped shooters"],
  ["ЭЛИТА", "ELITES"], ["усиленные противники", "empowered enemies"],
  ["Морозный волк", "Frost Wolf"], ["Токсичный бегун", "Toxic Runner"],
  ["Проклятый кинжальщик", "Cursed Rogue"], ["Воин-скелет", "Skeleton Warrior"],
  ["Громила", "Blight Grunt"], ["Костяная гаргулья", "Bone Gargoyle"],
  ["БОСС", "BOSS"], ["боссы этажей X3/X6/X9/X0", "bosses of X3/X6/X9/X0 floors"],
  ["Ядро", "Core"], ["Бегун", "Runner"], ["Бастион", "Bastion"], ["Призма", "Prism"],
  ["ИЗУМРУДНЫЙ ЛИЧ", "EMERALD LICH LORD"],
  ["раз в 2 сек выпускает огромную сферу на 15% максимального здоровья и замедляет на 50% на 1 секунду", "every 2 sec, fires a huge orb for 15% of maximum health and slows by 50% for 1 second"],
  ["БЕЗДОННЫЙ КОЗЛИНЫЙ ДЕМОН", "ABYSSAL GOAT DEMON"],
  ["движется со скоростью игрока и раз в 3 сек бьёт по земле на 25% максимального здоровья", "matches the player's speed and slams the ground every 3 sec for 25% of maximum health"],
  ["ЧУМНАЯ МЕРЗОСТЬ", "PLAGUE ABOMINATION"],
["раз в секунду плюётся слизью на 7.5% максимального здоровья и замедляет на 50% на 1 секунду; после смерти оставляет кислоту", "spits slime every second for 7.5% of maximum health and slows by 50% for 1 second; leaves acid on death"],
  ["АЛЧНЫЙ ГРОМИЛА", "GREED HULK"],
  ["редкий босс: призывает Бегунов, бросает смертельные копья и гарантирует две находки", "rare boss: summons Runners, throws deadly spears, and guarantees two finds"],
  ["КОРОЛЬ ПАЛАЧЕЙ", "KING OF EXECUTION"],
  ["раз в 3 сек бросает вращающийся топор к отмеченной точке и обратно; попадание наносит 35% максимального здоровья и замедляет на 70%", "every 3 sec, throws a spinning axe to a marked point and back; a hit deals 35% of maximum health and slows by 70%"],
  ["РОГАТЫЙ ТИРАН", "HORNED TYRANT"],
  ["редкий босс: оставляет огонь и каждую секунду рубит конусом, поджигая игрока; гарантирует одну находку", "rare boss: leaves fire and slashes a cone every second, igniting the player; guarantees one find"],
  ["КОРОЛЬ МОГИЛ", "GRAVE KING"],
  ["каждую секунду призывает обычное Ядро текущего уровня сложности", "summons a normal Core at the current floor's difficulty every second"],
  ["БЕЗДОННЫЙ БЕГЕМОТ", "ABYSSAL BEHEMOTH"],
  ["раз в 3 сек прыгает к отмеченной позиции игрока", "leaps toward the player's marked position every 3 sec"],
  ["ВАМПИРСКИЙ ЛОРД", "VAMPIRE LORD"],
  ["через каждые 2 секунды ставит Кровавую метку на 1 секунду; попадание крестом лечит босса", "every 2 seconds, places a Blood Mark for 1 second; hitting with the cross heals the boss"],
  ["ГНЕВ ПУСТОТЫ", "VOID WRATH"],
  ["создаёт 3–5 разломов: через секунду они отнимают 40% максимального здоровья и замедляют", "creates 3–5 rifts that erupt after one second for 40% maximum health and slow the player"],
  ["УЖАСАЮЩИЙ МИНОТАВР", "DREAD MINOTAUR"],
  ["редкий босс: рывок со скоростью 2800, затем уязвим и неподвижен 1,2 секунды, после чего бросает три копья по 15% max HP; новый рывок через 1,5 секунды; броня 80%; гарантирует две находки", "rare boss: charges at 2800 speed, then remains vulnerable and immobile for 1.2 seconds before throwing three spears for 15% max HP each; the next charge starts after 1.5 seconds; 80% armor; guarantees two finds"],
  ["ПАДШИЙ СЕРАФИМ", "FALLEN SERAPH"],
  ["трижды подряд отмечает игрока и поражает Святым Копьём на 20% максимального здоровья", "marks the player three times in succession and strikes with a Holy Spear for 20% maximum health"],
  ["ЧУМНАЯ МАТРИАРХ", "PLAGUE MATRIARCH"],
  ["каждую секунду выплёвывает двух Бегунов, пока их меньше 36", "spits out two Runners every second while fewer than 36 are alive"],
  ["ДЕМОНИЧЕСКАЯ КОРОЛЕВА", "DEMON QUEEN"],
  ["оборачивается Демоническим сгустком, отмечает место и через секунду обрушивается, нанося 35% максимального здоровья и замедляя", "becomes a Demonic Blob, marks a location, and crashes down one second later for 35% maximum health and a slow"],
  ["КОЛОСС ПОГРЕБАЛЬНОГО КОЛОКОЛА","FUNERAL BELL COLOSSUS"],
  ["замирает и выпускает три волны по 8% max HP; третья замедляет на 70% на 2,5 секунды","stops and releases three waves for 8% max HP each; the third slows by 70% for 2.5 seconds"],
  ["ПОЖИРАТЕЛЬ СОЗВЕЗДИЙ","STAR DEVOURER"],
  ["отмечает точку и роняет метеор на 18% max HP с горением 5% в секунду на 3 секунды","marks a point and drops a meteor for 18% max HP, burning for 5% per second for 3 seconds"],
  ["ЧУМНОЙ АРХИМАНДРИТ","PLAGUE ARCHIMANDRITE"],
  ["широкий круг наносит 12% max HP и отравляет на 3% в секунду на 4 секунды","a wide circle deals 12% max HP and poisons for 3% per second for 4 seconds"],
  ["БАГРОВАЯ ПОРТНИХА","CRIMSON SEAMSTRESS"],
  ["прошивает арену крестом на 15% max HP и замедляет на 35% на 2 секунды","stitches a cross through the arena for 15% max HP and slows by 35% for 2 seconds"],
  ["СТЕКЛЯННЫЙ ТИТАН","GLASS TITAN"],
  ["взрыв вокруг босса на 16% max HP и восемь осколков по 6%","an explosion around the boss for 16% max HP and eight shards for 6% each"],
  ["КОРОЛЬ РЖАВЧИНЫ","RUST KING"],
  ["конус на 10% max HP замедляет и накладывает коррозию 2% в секунду на 3 секунды","a cone for 10% max HP slows and applies corrosion for 2% per second for 3 seconds"],
  ["МАТЕРЬ ПУСТЫХ МАСОК","MOTHER OF EMPTY MASKS"],
  ["три маски последовательно проводят лучи по 10% max HP","three masks fire sequential beams for 10% max HP each"],
  ["ЛЕДЯНОЙ ПСАЛМОПЕВЕЦ","ICE PSALMIST"],
  ["последовательно замораживает три широких сектора по 12% max HP","freezes three wide sectors in sequence for 12% max HP each"],
  ["СОБИРАТЕЛЬ СЕРДЕЦ","HEART COLLECTOR"],
  ["три кольца вокруг отмеченной точки срабатывают в порядке внутреннее, внешнее, среднее по 12%","three rings around a marked point trigger inner, outer, then middle for 12% each"],
  ["ЧЕРНИЛЬНЫЙ ЛЕВИАФАН","INK LEVIATHAN"],
  ["создаёт пять чернильных луж: 11% при контакте, затем 6% в секунду и замедление","creates five ink pools: 11% on contact, then 6% per second and a slow"],
  ["СУДЬЯ ЦЕПЕЙ","JUDGE OF CHAINS"],
  ["дальняя цепь наносит 9% max HP и мощно притягивает, затем молот бьёт на 14%","the long-range chain deals 9% max HP and pulls hard, then the hammer strikes for 14%"],
  ["ПЕПЕЛЬНЫЙ СЕРАФИМ","ASHEN SERAPH"],
  ["выпускает шесть огненных комет по 7% max HP с горением","launches six fire comets for 7% max HP each with burning"],
  ["КОСТЯНОЙ АСТРОЛЯБ","BONE ASTROLABE"],
  ["ближнее и дальнее кольца наносят по 14% max HP; дальнее сильно замедляет","near and far rings deal 14% max HP each; the far ring heavily slows"],
  ["МЕДНЫЙ ОРАКУЛ","COPPER ORACLE"],
  ["пять последовательных взрывов вдоль отмеченной линии наносят по 6% max HP","five sequential explosions along a marked line deal 6% max HP each"],
  ["КНЯЗЬ ГОЛОДНЫХ ВОРОН","PRINCE OF HUNGRY RAVENS"],
  ["широкий вылет ворон наносит 10% max HP и кровотечение; возвратный строй — 14%","a wide raven sweep deals 10% max HP and bleeding; the returning formation deals 14%"],
  ["ЛУННЫЙ МЯСНИК","LUNAR BUTCHER"],
  ["дальний серп наносит 13% max HP, следом ближний — 15%","the far crescent deals 13% max HP, followed by a near crescent for 15%"],
  ["ХРАНИТЕЛЬ ПОСЛЕДНЕЙ СВЕЧИ","KEEPER OF THE LAST CANDLE"],
  ["четыре секунды безопасно только внутри движущегося круга света","for four seconds, only the moving circle of light is safe"],
  ["ПЕСОЧНЫЙ ГРОБОВЩИК","SAND GRAVEDIGGER"],
  ["полоса наносит 16% max HP и остаётся на 4 секунды, замедляя и истощая","a strip deals 16% max HP and remains for 4 seconds, slowing and draining"],
  ["БЕЗДОННАЯ МНЕМА","BOTTOMLESS MNEMA"],
  ["теневая копия пронзает отмеченную линию на 14% max HP и оставляет тёмное горение","a shadow double pierces the marked line for 14% max HP and leaves a dark burn"],
  ["ИМПЕРАТРИЦА ЖЕЛЕЗНЫХ РОЗ","EMPRESS OF IRON ROSES"],
  ["три расширяющихся кольца по 9% max HP; третье вызывает кровотечение","three expanding rings deal 9% max HP each; the third causes bleeding"],
  /* Короткие постоянные метки нового Canvas Boss HUD. */
  ["ОГРОМНАЯ СФЕРА", "GIANT ORB"], ["УДАР ПО ЗЕМЛЕ", "GROUND SLAM"],
  ["КИСЛОТА", "ACID"], ["КОПЬЁ 50%", "SPEAR 50%"],
  ["ВОЗВРАТНЫЙ ТОПОР", "RETURNING AXE"], ["ОГНЕННЫЙ СЛЕД", "FIRE TRAIL"],
  ["ПРИЗЫВ ЯДЕР", "CORE SUMMONS"], ["ПРЫЖОК", "LEAP"],
  ["КРОВАВАЯ МЕТКА", "BLOOD MARK"], ["РАЗЛОМЫ ПУСТОТЫ", "VOID RIFTS"],
  ["БРОНЯ 80%", "ARMOR 80%"], ["СВЯТОЕ КОПЬЁ", "HOLY SPEAR"],
  ["РОЙ БЕГУНОВ", "RUNNER SWARM"], ["ДЕМОНИЧЕСКИЙ СГУСТОК", "DEMONIC BLOB"],
  ["ПОМИНАЛЬНЫЙ ЗВОН","FUNERAL TOLL"], ["ГАСНУЩЕЕ НЕБО","FADING SKY"],
  ["КАДИЛЬНИЦА МОРА","CENSER OF PLAGUE"], ["ШОВ ПЛОТИ","FLESH STITCH"],
  ["ОСКОЛОЧНЫЙ ПРИГОВОР","SHARD VERDICT"], ["ОКИСЛИТЕЛЬНЫЙ ПРИЛИВ","OXIDIZING TIDE"],
  ["ХОР ЛИЦ","CHOIR OF FACES"], ["НЕМАЯ ЛИТУРГИЯ","SILENT LITURGY"],
  ["ЧУЖОЙ ПУЛЬС","ALIEN PULSE"], ["РАЗЛИВ БЕЗДНЫ","ABYSSAL SPILL"],
  ["ПРИГОВОР ПРИТЯЖЕНИЯ","PULLING VERDICT"], ["ШЕСТЬ УГЛЕЙ","SIX EMBERS"],
  ["ОРБИТА МЁРТВЫХ","ORBIT OF THE DEAD"], ["ПЕРЕМОТКА УДАРА","STRIKE REWIND"],
  ["ЧЁРНАЯ ЖАТВА","BLACK HARVEST"], ["ПОЛУМЕСЯЦ БОЙНИ","CRESCENT SLAUGHTER"],
  ["ПОГАСШИЙ СВЕТ","EXTINGUISHED LIGHT"], ["ПЕСОЧНАЯ МОГИЛА","SAND GRAVE"],
  ["УКРАДЕННАЯ ТЕНЬ","STOLEN SHADOW"], ["ЦВЕТЕНИЕ ШИПОВ","BLOOM OF THORNS"],

  /* Магазин */
  ["БЫСТРОЕ ЛЕЧЕНИЕ", "QUICK HEALING"], ["+1 HP раз в 5 секунд за уровень, пока здоровье ниже 50% максимума. Потолок 50 уровней.", "+1 HP every 5 seconds per level while health is below 50% of maximum. Capped at 50 levels."],
  ["Быстрое лечение", "Quick Healing"], ["до 50% HP", "up to 50% HP"],
  ["БРОНЯ", "ARMOR"], ["+1 к броне за уровень, потолок 30.", "+1 Armor per level, capped at 30."],
  ["ПАНЦИРЬ ОТ РОЯ", "SWARM SHELL"], ["Вычитает 1 урона из каждого попадания за уровень, максимум 100. Самая дешёвая защитная ветка магазина.", "Subtracts 1 damage from every hit per level, up to 100. The store's cheapest defensive branch."],
  ["УВОРОТ", "EVASION"], ["+1% шанса уворота за уровень, потолок магазинного бонуса 25%.", "+1% Evasion Chance per level, with the shop bonus capped at 25%."],
  ["ЗАРЯДЫ РЫВКА", "DASH CHARGES"], ["Дополнительный заряд рывка. Базовый один, максимум три; каждый заряд восстанавливается 5 секунд.", "Adds a Dash charge. You start with one and can have up to three; each charge takes 5 seconds to recover."],
  ["ВОССТАНОВЛЕНИЕ РЫВКА", "DASH RECOVERY"], ["+5% к скорости восстановления заряда за уровень, максимум +50%. На максимуме базовые 5 секунд сокращаются до 3,33 секунды.", "+5% Dash charge recovery speed per level, up to +50%. At maximum, the base 5 seconds are reduced to 3.33 seconds."],
  ["ДЛИННЫЙ РЫВОК", "LONG DASH"], ["+5% к дистанции рывка за уровень, максимум +25%. Длительность неуязвимости не меняется.", "+5% Dash distance per level, up to +25%. Invulnerability duration is unchanged."],
  ["БЫСТРЫЙ СБОР", "QUICK PICKUP"], ["+20% к радиусу и скорости притяжения опыта и золота за ранг. На 10-м ранге они летят к вам с тройной скоростью из втрое большей дальности.", "+20% experience and gold attraction radius and speed per rank. At rank 10, they fly toward you three times faster from three times farther away."],
  ["ИСКАТЕЛЬ РЕЛИКВИЙ", "RELIC SEEKER"], ["Повышает шанс любой случайной находки примерно на 0,38 процентного пункта за ранг. На максимуме: обычный враг 0,15% → 3,99%, элита 0,77% → 4,60%, босс 6,13% → 9,97%. Дорогая QoL-ветка, не добавляет силу напрямую.", "Increases the chance of any random find by about 0.38 percentage points per rank. At maximum rank: normal enemy 0.15% → 3.99%, elite 0.77% → 4.60%, boss 6.13% → 9.97%. An expensive quality-of-life branch that grants no direct power."],
  ["ПЕРВЫЙ ШАГ", "FIRST STEP"], ["В начале каждой новой партии даёт одно дополнительное повышение уровня за ранг. На максимуме выбираете пять модификаторов до первого боя.", "At the start of every new run, grants one additional level-up per rank. At maximum rank, you choose five modifiers before the first fight."],
  ["ЧЕТВЁРТАЯ КАРТА", "FOURTH CARD"], ["При повышении уровня показывать четыре модификатора вместо трёх. Действует всю партию, на каждом уровне.", "Shows four modifiers instead of three whenever you level up. Active for the entire run at every level."],
  ["ВЕСЬ УРОН", "ALL DAMAGE"], ["+1% ко всему урону: оружие, стихии, свита, поджог, яд, кровотечение. Складывается в общий процент вместе с карточками.", "+1% to all damage: weapons, elements, minions, Ignite, Poison, and Bleeding. Added to the same increased-damage total as cards."],
  ["СКОРОСТЬ АТАКИ", "ATTACK SPEED"], ["+1% к скорости атаки. Тот же процент, что и на карточках, — суммируется с ними в один множитель.", "+1% Attack Speed. This is the same bonus type as cards and is added into the same multiplier."],
  ["ЗДОРОВЬЕ ПЛЮСОМ", "FLAT HEALTH"], ["+1 к максимальному здоровью. Прибавляется ДО процентов, поэтому каждый процент здоровья делает его дороже по эффекту.", "+1 maximum health. Added BEFORE percentage bonuses, so each health percentage makes it more effective."],
  ["ЗДОРОВЬЕ В ПРОЦЕНТАХ", "PERCENT HEALTH"], ["+1% к максимальному здоровью. Дорогая ветка: процент усиливает и базовое здоровье, и все постоянные прибавки здоровья.", "+1% maximum health. An expensive branch: the percentage increases both base health and all permanent flat health bonuses."],
  ["СКОРОСТЬ БЕГА", "MOVEMENT SPEED"], ["+1% к скорости передвижения за уровень, максимум +10%. Все десять уровней вместе стоят 50 000 золота.", "+1% Movement Speed per level, up to +10%. All ten levels cost 50,000 gold in total."],
  ["+1% к снижению получаемого урона. Считается ОТДЕЛЬНЫМ множителем после защиты из карточек, поэтому даже 70% плюс 60% с билда не дают неуязвимости — только 88% суммарно.", "+1% reduced damage taken. Applied as a SEPARATE multiplier after card defenses, so even 70% here plus 60% from your build yields 88% total reduction, not invulnerability."],
  ["ОПЫТ", "EXPERIENCE"], ["+1% к получаемому опыту. Быстрее уровни — больше карточек за партию, то есть покупка не силы, а скорости сборки билда.", "+1% experience gained. Faster levels mean more cards per run, so this buys build speed rather than direct power."],
  ["ЗОЛОТО", "GOLD"], ["+1% к найденному золоту. Единственная покупка, которая окупает сама себя, поэтому берётся первой почти всегда.", "+1% gold found. The only purchase that pays for itself, so it is almost always bought first."],
  ["ПЛОТНОСТЬ ВРАГОВ", "ENEMY DENSITY"], ["+1% врагов на этаже. Сделка, а не подарок: больше опыта, золота и находок, но и этаж дольше, и толпа плотнее.", "+1% enemies per floor. A trade-off, not a gift: more experience, gold, and finds, but longer floors and denser crowds."],

  /* Аффиксы боссов */
  ["панцирь", "bulwark"], ["мелкие частые удары почти не проходят, крупные — проходят", "small rapid hits barely get through, while heavy hits do"],
  ["оберег", "ward"], ["одна стихия срезается на 60% — цвет ауры выдаёт какая", "one element is reduced by 60%; the aura color reveals which one"],
  ["залп", "volley"], ["раз в 3 сек веер снарядов по кругу — бегать надо по дуге, не по прямой", "every 3 sec, fires a fan of projectiles; run in an arc, not in a straight line"],
  ["волна", "wave"], ["раз в 5 сек расходится кольцо — безопасно только вплотную или далеко", "every 5 sec, releases an expanding ring; only very close or far away is safe"],
  ["смола", "tar"], ["оставляет за собой лужи — стоять на месте нельзя", "leaves pools behind; standing still is dangerous"],
  ["таран", "charge"], ["раз в 3 сек: замах 0.7 сек, затем рывок по прямой с отбрасыванием", "every 3 sec: winds up for 0.7 sec, then charges in a straight line with knockback"],
  ["зов", "summoning"], ["раз в 6 сек поднимает свежих врагов вокруг себя", "every 6 sec, summons fresh enemies around itself"],
  ["знамя", "banner"], ["пока жив, вся комната на 30% быстрее и на 20% злее", "while alive, the entire room moves 30% faster and deals 20% more damage"],

  /* Аффиксы элитных пачек */
  ["берсеркеры", "berserkers"], ["чем меньше здоровья осталось, тем быстрее и сильнее бьют", "the less health they have, the faster and harder they strike"],
  ["бронированные", "armored"], ["−50% получаемого урона, пока выше половины здоровья", "take 50% less damage while above half health"],
  ["регенераторы", "regenerators"], ["2.5% здоровья в секунду, пока по ним не попадают", "recover 2.5% health per second while not being hit"],
  ["вампиры", "vampires"], ["урон, прошедший по игроку, лечит всю пачку — доля делится на всех", "damage dealt to the player heals the entire pack, with the share divided among its members"],
  ["мстители", "avengers"], ["смерть одного разгоняет соседей: +30% скорости и урона на 6 сек", "when one dies, nearby allies gain +30% speed and damage for 6 sec"],
  ["прыгуны", "jumpers"], ["раз в 3.5 сек один прыгает игроку под ноги", "every 3.5 sec, one jumps to the player's position"],
  ["охотники", "hunters"], ["один монстр не отвлекается на свиту и бежит к игроку на 50% быстрее", "one enemy ignores minions and runs toward the player 50% faster"],
  ["размножение", "breeding"], ["каждый погибший оставляет двух уменьшенных копий", "each slain enemy leaves two smaller copies"],
  ["улей", "hive"], ["пока матка жива, вся пачка восстанавливает 1.2% здоровья в секунду", "while the queen lives, the entire pack recovers 1.2% health per second"],
  ["связанные", "linked"], ["−30% получаемого урона, пока рядом стоит свой", "take 30% less damage while near an ally"],
  ["кровная связь", "blood bond"], ["80% урона по одному растекается на остальных — общий урон тот же, но убить кого-то одного нельзя", "80% of damage to one member is spread among the others; total damage is unchanged, but focusing down one target is impossible"],
  ["маяк", "beacon"], ["носитель даёт своим в радиусе 180 половину урона сверху — его выгодно убить первым", "the bearer grants allies within 180 range 50% more damage, making it the best target to kill first"],
  ["авангард", "vanguard"], ["у передового вдвое больше здоровья, и он перехватывает треть попаданий по своим", "the vanguard has twice as much health and intercepts one third of hits aimed at its allies"],
  ["командир", "commander"], ["пока командир жив, пачка на 30% быстрее двигается и бьёт", "while the commander lives, the pack moves and attacks 30% faster"],
  ["священный круг", "sanctuary"], ["вокруг носителя круг радиусом 150: свои внутри лечатся на 1.5% в секунду", "a 150-radius circle surrounds the bearer; allies inside recover 1.5% health per second"],
  ["последнее слово", "last word"], ["после смерти выпускает три снаряда в сторону игрока", "fires three projectiles toward the player on death"],
  ["разделяющиеся", "splitters"], ["на половине здоровья монстр делится надвое, у каждой половины 40% исходного запаса", "at half health, the enemy splits into two, each with 40% of the original maximum health"],
  ["безумные", "mad"], ["каждые 2 сек заново бросают кости: скорость, размер, урон, курс и способ атаки", "every 2 sec, reroll their speed, size, damage, direction, and attack behavior"],

  /* Виды свиты */
  ["Скелет", "Skeleton"], ["Бомбардир", "Bombardier"],
  ["Голем крови", "Blood Golem"], ["Костяной голем", "Bone Golem"],
];
const EN_UI_PAIRS = [
  ["P — пауза", "P — Pause"], ["HP/5 сек", "HP/5 sec"], ["с удара", "per hit"],
  ["ОРУЖИЕ", "WEAPON"], ["Реген/сек", "Regen/sec"], ["Средний удар", "Average Hit"],
  ["/сек", "/sec"], ["(до ", "(up to "],
  /* Бой, HUD и всплывающие сообщения */
  ["Ур.", "Lv."], ["ЭТАЖ", "FLOOR"], ["ЭТАЖ ", "FLOOR "],
  ["ПАЧКА", "PACK"], ["ЖИВЫХ", "ALIVE"], ["врагов:", "enemies:"], ["золота", "gold"],
  ["ТРИАДА", "TRINITY"], ["КОНТРУДАР", "RIPOSTE"], ["СМЕРТЬ", "DEATH"],
  ["КОЛЬЦО СМЕРТИ ГОТОВО", "DEATH RING READY"], ["ЧАША ПОЛНА", "CHALICE FILLED"],
  ["ЧУМА", "PLAGUE"], ["КРОВЬ", "BLOOD"], ["ВРАГ", "ENEMY"],
  ["ЗАБЛОКИРОВАНО", "BLOCKED"], ["уворот", "evaded"], ["КУКЛА РАССЫПАЛАСЬ", "DOLL SHATTERED"],
  ["СПАСЕНИЕ", "SAVED"], ["СОБСТВЕННЫЙ ВЗРЫВ", "SELF EXPLOSION"], ["НЕИЗВЕСТНЫЙ УРОН", "UNKNOWN DAMAGE"],
  ["автолечение", "automatic healing"], ["снаряд", "projectile"], ["контакт", "contact"], ["отбито", "reflected"],
  ["ВРАЖЕСКИЙ СНАРЯД", "ENEMY PROJECTILE"], ["ЛУЖА СМОЛЫ", "TAR POOL"],
  ["УДАРНАЯ ВОЛНА БОССА", "BOSS SHOCKWAVE"], ["ПОРТАЛ ОТКРЫТ", "PORTAL OPEN"],
  ["РЕДКИЙ", "RARE"], ["изумрудная сфера", "emerald orb"],
  ["удар по земле", "ground slam"], ["сгусток слизи", "slime glob"],
  ["КИСЛОТА ЧУМНОЙ МЕРЗОСТИ", "PLAGUE ABOMINATION ACID"], ["копьё жадности", "greed spear"],
  ["вращающийся топор", "spinning axe"], ["ЗАМЕДЛЕН", "SLOWED"], ["ВЫЗОВ", "CHALLENGED"],
  ["взмах меча", "sword slash"], ["ОГОНЬ РОГАТОГО ТИРАНА", "HORNED TYRANT FIRE"],
  ["ГОРЕНИЕ РОГАТОГО ТИРАНА", "HORNED TYRANT BURN"], ["ГОРИТ", "BURNING"],
  ["свита ≈", "minions ≈"], ["урон/сек ≈", "damage/sec ≈"], [" урона/сек", " damage/sec"],
  [" · рывки ", " · Dashes "], [" · заряд через ", " · charge in "], [" · свита ", " · minions "],
  ["цел", "intact"], ["разбит", "broken"],

  /* Находки, книги и тотемы */
  ["тотем · ранг", "totem · rank"], ["из 4 · растёт от каждой следующей находки", "of 4 · each new find raises its rank"],
  ["Весь ваш урон по", "All your damage against"], ["целям увеличен на", "targets is increased by"],
  ["Действует и на удары свиты.", "Also affects minion hits."], ["Ранги:", "Ranks:"],
  ["ДРУГИЕ ТОТЕМЫ", "OTHER TOTEMS"], ["ПРОДОЛЖИТЬ", "CONTINUE"],
  ["ОБЫЧНЫЙ", "COMMON"], ["РЕДКИЙ", "RARE"], ["ЭПИЧЕСКИЙ", "EPIC"], ["ЛЕГЕНДАРНЫЙ", "LEGENDARY"],
  ["находится один раз за партию", "can be found once per run"], ["УЖЕ НАДЕТО", "ALREADY EQUIPPED"],
  ["список прокручивается", "scroll to see the full list"], ["было +", "was +"], ["срабатывание", "proc chance"],
  ["Флэт-урон огнём", "Flat Fire damage"], ["Флэт-урон холодом", "Flat Cold damage"],
  ["Флэт-урон молнией", "Flat Lightning damage"],
  ["Отравление за прок", "Poison per proc"], ["Кровотечение за прок", "Bleeding per proc"],
  ["Плотность волн", "Wave density"], ["Получаемый опыт", "Experience gained"],
  ["тир", "tier"], ["повышена с", "upgraded from"], ["первая находка", "first find"],
  ["СИЛА", "POWER"], ["ШАНС СРАБАТЫВАНИЯ", "PROC CHANCE"], ["потолок достигнут", "maximum reached"],
  ["+10% за следующую", "+10% on the next find"], ["ВСЕ КНИГИ СУММАРНО", "ALL BOOKS COMBINED"],

  /* Типы карточек и подсказки */
  ["к урону плюсом", "added as flat damage"], ["суммируется в процентах", "additive percentage"],
  ["общий more-множитель", "shared more multiplier"], ["шанс", "chance"], ["свойство", "property"],
  ["В этой карточке:", "This card grants:"], ["сейчас:", "current:"], ["ДЕЙСТВУЕТ И НА СВИТУ", "ALSO AFFECTS MINIONS"],
  ["ПЕРЕБРОСИТЬ", "REROLL"], ["ПРОБЕЛ", "SPACE"], ["ПОДРОБНЫЕ ПОДСКАЗКИ: ВКЛ", "DETAILED TOOLTIPS: ON"],
  ["ПОДРОБНЫЕ ПОДСКАЗКИ: ВЫКЛ", "DETAILED TOOLTIPS: OFF"],
  ["КЛАВИШИ 1–3 — ВЫБОР КАРТОЧКИ", "KEYS 1–3 — SELECT A CARD"],
  ["КЛАВИШИ 1–4 — ВЫБОР КАРТОЧКИ", "KEYS 1–4 — SELECT A CARD"],
  ["СВЯЗАННЫЕ НАВЫКИ", "RELATED SKILLS"], ["наведите для подробностей", "hover for details"],
  ["ОТКРОЕТСЯ", "UNLOCKS"], ["ОТКРЫТО", "UNLOCKED"],
  ["Связанный навык:", "Related skill:"], ["откроется при", "unlocks at"],
  ["ДОБЫЧА ЭТАЖА", "FLOOR LOOT"], ["Все находки автоматически доставлены. Ничего не потеряно.", "All finds were delivered automatically. Nothing was lost."],
  ["ПОЛУЧЕНО НАХОДОК:", "FINDS RECEIVED:"],
  ["сейчас", "current"],

  /* Экран характеристик и инвентарь */
  ["Подкласс", "Subclass"], ["ИЗ МАГАЗИНА", "FROM THE STORE"], ["ОСНОВНОЕ", "CORE STATS"],
  ["Макс. здоровье", "Maximum Health"], ["Регенерация", "Regeneration"], ["Урон атаки", "Attack Damage"],
  ["Скорость атаки", "Attack Speed"], ["Шанс крита", "Critical Chance"], ["Множитель крита", "Critical Multiplier"],
  ["Скорость бега", "Movement Speed"], ["Получаемое золото", "Gold Gained"],
  ["СТИХИИ", "ELEMENTS"], ["Броня", "Armor"], ["гасит", "mitigates"], ["входящего урона", "incoming damage"],
  ["магазин", "store"], ["Уворот", "Evasion"],
  ["От обычных монстров", "From normal enemies"], ["От элиты и боссов", "From elites and bosses"], ["Вампиризм", "Life Steal"],
  ["ГЕОМЕТРИЯ", "ATTACK SHAPE"], ["Снарядов", "Projectiles"], ["Пробитие", "Pierce"], ["Отскоки", "Chains"],
  ["Радиус AoE", "AoE Radius"], ["Радиус чумы / сфера", "Plague / orb radius"], ["Разлёт молний", "Lightning discharge"],
  ["целей", "targets"], ["Перекидывание поджога", "Ignite spread"], ["Аура замедления", "Slowing Aura"],
  ["Круговые орбы", "Orbiting Orbs"], ["за касание", "per contact"], ["Чумный взрыв трупа", "Corpse Plague Explosion"],
  ["МЕГА-чума", "MEGA Plague"], ["радиус ×2", "radius ×2"], ["Всего приспешников", "Total Minions"],
  ["Скелеты", "Skeletons"], ["Бомбардиры", "Bombardiers"], ["ур.", "rank"],
  ["за удар", "per hit"], ["уд/сек", "hits/sec"], ["кровь", "Bleeding"], ["за стак", "per stack"],
  ["Урон скелета", "Skeleton Damage"], ["Здоровье скелета", "Skeleton Health"], ["Атак/сек", "Attacks/sec"],
  ["Крит свиты", "Minion Critical Chance"], ["Шансы эффектов свиты", "Minion Ailment Chances"], ["25% от ваших", "25% of yours"],
  ["Лорд Смерти", "Death Lord"], ["0,1% фактического урона свиты лечит героя", "0.1% of actual minion damage heals the hero"],
  ["Наследование статов", "Stat Inheritance"], ["урон, здоровье, крит", "damage, health, critical chance"],
  ["Скорость свиты", "Minion Speed"], ["атака", "attack"], ["бег", "movement"], ["Воскрешение", "Revival"],
  ["Срок жизни бойца", "Minion Lifetime"], ["смерть запускает эффекты", "death triggers effects"],
  ["Перехват урона", "Damage Interception"], ["ветка на потолке", "branch capped"], ["Кровные узы", "Blood Ties"],
  ["x2 урона свиты на 3 сек после удара", "×2 minion damage for 3 sec after you are hit"],
  ["Вампиры хозяина", "Master's Vampires"], ["урона свиты уходит ей в здоровье", "of minion damage is recovered as minion health"],
  ["Буйство демонов", "Demon Frenzy"], ["взрыв радиусом", "explosion radius"], ["Астральный набег", "Astral Raid"],
  ["Внезапный взрыв", "Sudden Blast"], ["раз в", "every"], ["% удара", "% of a hit"], ["радиус", "radius"],
  ["Резкие когти", "Razor Claws"], ["каждый 5-й удар · +30% мощности", "every 5th hit · +30% power"],
  ["Вихрь когтей", "Claw Whirlwind"], ["каждый 10-й удар · 20% по радиусу", "every 10th hit · 20% area damage"],
  ["Кровавая баня", "Bloodbath"], ["10% ударов свиты", "10% of minion hits"], ["Кипящая кровь", "Boiling Blood"],
  ["5% на лужу радиусом", "5% chance for a pool with radius"], ["5% текущего здоровья в секунду", "5% current health per second"],
  ["Кислота веномансера", "Venomancer Acid"], ["2 сек · 5% текущего здоровья/сек", "2 sec · 5% current health/sec"],
  ["Трупов на земле", "Corpses on the Ground"], ["ТОТЕМЫ", "TOTEMS"], ["следующий ранг", "next rank"], ["максимум", "maximum"],
  ["ПРЕДМЕТЫ:", "ITEMS:"], ["НАЙДЕННЫЕ КНИГИ", "BOOKS FOUND"], ["срабатывает", "procs at"],
  ["ВЗЯТО МОДИФИКАТОРОВ:", "MODIFIERS TAKEN:"], ["Пока ничего не найдено.", "Nothing found yet."],
  ["шанс срабатывания", "proc chance"], ["Сила:", "Power:"], ["обычный", "common"], ["редкий", "rare"],
  ["эпический", "epic"], ["легендарный", "legendary"], ["Следующая находка повышает ранг, пока не достигнут великий тотем.", "Each new find raises the rank until the Grand Totem is reached."],
  ["Постоянный модификатор этого забега.", "A permanent modifier for this run."], ["ИНВЕНТАРЬ", "INVENTORY"],
  ["TAB или ESC — закрыть и продолжить", "TAB or ESC — close and continue"], ["БРОНЯ:", "ARMOR:"],
  ["Гасит", "Mitigates"], ["каждого обычного входящего удара.", "of each regular incoming hit."],
  ["После брони отдельно применяются блок, плоское и процентное снижение урона.", "After Armor, Block, flat reduction, and percentage damage reduction are applied separately."],
  ["КНИГИ", "BOOKS"], ["АМУЛЕТЫ И СНАРЯЖЕНИЕ", "AMULETS AND EQUIPMENT"], ["МОДИФИКАТОРЫ УРОВНЕЙ", "LEVEL MODIFIERS"],

  /* QA-панель и итоги */
  ["постоянное свойство", "permanent property"], ["% множитель", "% multiplier"], ["ВЗЯТО", "TAKEN"], ["ВЫДАТЬ", "GRANT"],
  ["Ничего не найдено.", "Nothing found."], ["ТЕСТОВАЯ ВЫДАЧА НАВЫКОВ", "TEST SKILL GRANT"],
  ["Поиск по названию, категории или ID · значения бросаются в обычном диапазоне", "Search by name, category, or ID · values roll within their normal range"],
  ["Например: чума, crit, скорость, min.", "For example: plague, crit, speed, min."],
  ["Завершить забег и сохранить", "End the run and save"], ["золота в банк?", "gold to the bank?"],
  ["ЗАБЕГ ЗАВЕРШЁН", "RUN ENDED"], ["ВЫ ПАЛИ", "YOU HAVE FALLEN"], ["итоги забега", "run summary"],
  ["этаж", "floor"], ["уровень", "level"], ["время", "time"], ["ПРИЧИНА СМЕРТИ:", "CAUSE OF DEATH:"],
  ["неизвестна", "unknown"], ["получено", "taken"], ["урона", "damage"], ["золота в банк · всего", "gold banked · total"],
  ["рекорд: этаж", "record: floor"], ["УБИТО ВСЕГО", "TOTAL KILLS"], ["ОБЫЧНЫЕ / ЭЛИТЫ / БОССЫ", "NORMAL / ELITE / BOSS"],
  ["НАНЕСЕНО УРОНА", "DAMAGE DEALT"], ["САМЫЙ СИЛЬНЫЙ УДАР", "STRONGEST HIT"], ["КРИТИЧЕСКИХ УДАРОВ", "CRITICAL HITS"],
  ["ПОЛУЧЕНО УРОНА", "DAMAGE TAKEN"], ["ВОССТАНОВЛЕНО HP", "HP RESTORED"], ["ПРОЙДЕНО РАССТОЯНИЕ", "DISTANCE TRAVELED"],
  ["МОДИФИКАТОРОВ", "MODIFIERS"], ["КНИГИ / ТИРЫ КНИГ", "BOOKS / BOOK TIERS"], ["СНАРЯЖЕНИЕ / ТОТЕМЫ", "EQUIPMENT / TOTEMS"],
  ["ЗАЧИЩЕННЫХ ЭТАЖЕЙ", "FLOORS CLEARED"], ["В МЕНЮ", "MAIN MENU"],

  /* Кладбище */
  ["КЛАДБИЩЕ", "GRAVEYARD"], ["ПОСЛЕДНИЕ 10 ПАВШИХ ГЕРОЕВ", "LAST 10 FALLEN HEROES"],
  ["ПОКА ЗДЕСЬ ПУСТО", "NO GRAVES YET"], ["Павшие герои появятся здесь после окончания забега смертью.", "Fallen heroes appear here after a run ends in death."],
  ["ЭТАЖ СМЕРТИ", "DEATH FLOOR"], ["НАЗАД К КЛАДБИЩУ", "BACK TO GRAVEYARD"],
  ["ПОКА ПУСТО", "EMPTY"], ["последних записей:", "recent records:"],

  /* Магазин и созвездия */
  ["АТАКА", "ATTACK"], ["урон и темп", "damage and tempo"], ["ЗДОРОВЬЕ", "HEALTH"], ["запас HP", "maximum HP"],
  ["ЗАЩИТА", "DEFENSE"], ["выживаемость", "survivability"], ["ФАРМ", "FARMING"], ["опыт, золото, плотность", "experience, gold, density"],
  ["КАЧЕСТВО ЖИЗНИ", "QUALITY OF LIFE"], ["старт, движение и сбор", "starting power, movement, and pickup"],
  ["ЛАВКА ВЕЧНЫХ УЛУЧШЕНИЙ", "FORGE OF ETERNAL UPGRADES"], ["ПОСТОЯННОЕ УЛУЧШЕНИЕ", "PERMANENT UPGRADE"],
  ["МАКСИМУМ", "MAXIMUM"], ["ур.", "lv."], ["МАГАЗИН", "STORE"], ["ПОКУПКА", "BUY"], ["ВОЗВРАТ", "REFUND"], ["НЕТ ПОКУПОК", "NOT PURCHASED"],
  ["ВСЁ", "ALL"], ["ВЕРНУТЬ ВСЕ ПОКУПКИ", "REFUND ALL PURCHASES"],
  ["постоянные бонусы для всех будущих забегов · наведите на карточку для подробностей", "permanent bonuses for all future runs · hover over a card for details"],
  ["В БАНКЕ:", "IN THE BANK:"], ["вложено сейчас:", "currently invested:"], ["НАЗАД", "BACK"],
  ["Достигнут максимум.", "Maximum reached."], ["Следующий ранг:", "Next rank:"], ["цена", "cost"],
  ["Текущий эффект:", "Current effect:"], ["на следующем ранге", "at the next rank"], ["Вернуть последний ранг:", "Refund last rank:"],
  ["СОЗВЕЗДИЕ ЗАВЕРШЕНО", "CONSTELLATION COMPLETE"], ["ОТКРЫТЬ РАНГ", "UNLOCK RANK"],
  ["МУЗЫКА: ВКЛ", "MUSIC: ON"], ["МУЗЫКА: ВЫКЛ", "MUSIC: OFF"],
  ["НАСТРОЙКИ", "SETTINGS"], ["ИГРА НА ПАУЗЕ", "GAME PAUSED"],
  ["Настройки звука", "Sound settings"], ["ГРОМКОСТЬ ЗВУКОВ", "SOUND VOLUME"], ["Громкость звуков", "Sound volume"],
  ["ЗВУКИ: ВКЛ", "SOUNDS: ON"], ["ЗВУКИ: ВЫКЛ", "SOUNDS: OFF"],
  ["ДО НОВОЙ ЗВЕЗДЫ:", "UNTIL THE NEXT STAR:"], ["РАНГ / 10", "RANK / 10"],
  ["к урону, опыту и золоту за этот тип врагов", "to damage, experience, and gold for this enemy type"],
  ["УБИТО:", "KILLED:"], ["ЦЕЛЬ:", "TARGET:"], ["СОЗВЕЗДИЯ", "CONSTELLATIONS"],
  ["вечная охота · убийства не расходуются · каждый открытый узел даёт +5%", "eternal hunt · kills are never spent · each unlocked node grants +5%"],
  ["КАРТА ВЕЧНОЙ ОХОТЫ", "MAP OF THE ETERNAL HUNT"], ["ШЕСТЬ ПУТЕЙ · ДЕСЯТЬ ЗВЁЗД В КАЖДОМ", "SIX PATHS · TEN STARS IN EACH"],
  ["Ранг", "Rank"], ["убийств", "kills"], ["УБРАТЬ БОНУСЫ", "REMOVE BONUSES"],
  ["АРХИВ ВЕЧНОЙ ОХОТЫ", "ARCHIVE OF THE ETERNAL HUNT"], ["КАРТА СОЗВЕЗДИЙ", "CONSTELLATION MAP"],
  ["ОТКРЫТО ЗВЁЗД", "STARS UNLOCKED"], ["ГОТОВО К ОТКРЫТИЮ", "READY TO UNLOCK"],
  ["УБИЙСТВ ЗАПИСАНО", "KILLS RECORDED"], ["ПУТИ ОХОТЫ", "HUNTING PATHS"],
  ["ИЗБРАННЫЙ ПУТЬ", "SELECTED PATH"], ["РАНГ", "RANK"], ["ДОСТУПНО ОТКРЫТИЕ", "UNLOCK AVAILABLE"],
  ["Убийства сохранятся — доступные узлы можно открыть заново.", "Kills are preserved—available nodes can be unlocked again."],

  /* Главное меню и управление */
  ["выберите один из четырёх классов — он определяет, вокруг чего строить билд", "choose one of four classes—it determines the foundation of your build"],
  ["ДОСТУПНО ОТКРЫТИЙ:", "UNLOCKS AVAILABLE:"], ["Каждое повышение уровня — выбор из", "Each level-up offers a choice of"],
  ["ДОСТУПНО:", "AVAILABLE TO:"],
  ["четырёх", "four"], ["трёх", "three"], ["модификаторов реального каталога.", "modifiers from the actual catalog."],
  ["flat складывается · inc суммируется в один процент · more складывается в отдельную общую корзину.", "flat values add together · inc values combine into one percentage · more bonuses add within a separate shared bucket."],
  ["выберите подкласс · его бонусы растут с каждым уровнем", "choose a subclass · its bonuses grow with every level"],
  ["подкласс", "subclass"], ["НАЗАД К ВЫБОРУ КЛАССА", "BACK TO CLASS SELECTION"],
  ["КЛАВИАТУРА", "KEYBOARD"], ["Движение на WASD или стрелках. Точный контроль остановки — удобно для билдов на стрельбу с места.", "Move with WASD or the arrow keys. Precise stopping control is ideal for stationary-ranged builds."],
  ["МЫШЬ", "MOUSE"], ["Персонаж непрерывно бежит к курсору. Чтобы встать, наведите курсор на себя — вокруг персонажа есть зона покоя.", "The character continuously runs toward the cursor. To stop, move the cursor over the character; a dead zone surrounds them."],
  ["чем управлять? · сменить можно в любой момент на C", "choose your control scheme · press C to switch at any time"],
  ["управление", "controls"], ["Атака автоматическая в обеих схемах · ПРОБЕЛ — рывок · ESC или P — пауза", "Attacks are automatic in both schemes · SPACE — Dash · ESC or P — Pause"],
  ["УПРАВЛЕНИЕ:", "CONTROLS:"], ["МЫШЬ — движение к курсору, наведите на себя чтобы встать", "MOUSE — move toward cursor; hover over yourself to stop"],
  ["WASD — движение", "WASD — move"], ["атака автоматическая", "attacks are automatic"], ["ПРОБЕЛ — рывок", "SPACE — Dash"],
  ["C — сменить управление", "C — switch controls"], ["TAB — инвентарь", "TAB — Inventory"],
  ["P — быстрая пауза", "P — Quick Pause"], ["ESC — настройки паузы", "ESC — Pause Settings"], ["ESC — настройки", "ESC — Settings"],
  ["ПАУЗА", "PAUSED"], ["ESC или P — продолжить", "ESC or P — continue"],
  ["ЗАВЕРШИТЬ ЗАБЕГ · СОХРАНИТЬ ЗОЛОТО", "END RUN · SAVE GOLD"],
];

const EN_TEXT = Object.freeze(Object.fromEntries([
  /* Общие категории и термины */
  ["Здоровье", "Health"], ["Кейстоун", "Keystone"], ["Защита", "Defense"],
  ["Урон", "Damage"], ["Криты", "Critical Hits"], ["Скорость", "Speed"],
  ["Передвижение", "Movement"], ["Геометрия", "Attack Shape"], ["Огонь", "Fire"],
  ["Холод", "Cold"], ["Молния", "Lightning"], ["Яд", "Poison"],
  ["Эффекты", "Ailments"], ["Условные", "Conditional"], ["Уклонение", "Evasion"],
  ["Смерть", "Death"], ["Контроль", "Crowd Control"], ["Экзотика", "Exotic"],
  ["Триггеры", "Triggers"], ["Прогрессия", "Progression"], ["Лут", "Loot"],
  ["Свита", "Minions"], ["Големы", "Golems"],

  /* Карточки: здоровье, урон, крит, скорость */
  ["Здоровье за убийство", "Health on Kill"],
  ["За выбор даёт только целые +1, +2 или +3 HP за убийство.", "Each pick grants only a whole +1, +2, or +3 HP per kill."],
  ["Здоровье за попадание", "Health on Hit"],
  ["За выбор даёт только целые +1, +2 или +3 HP за попадание.", "Each pick grants only a whole +1, +2, or +3 HP per hit."],
  ["Здоровье за крит", "Health on Critical Hit"],
  ["За выбор даёт только целые +3, +4, +5 или +6 HP за крит. Срабатывает не чаще раза в секунду.", "Each pick grants only a whole +3, +4, +5, or +6 HP per critical hit. Triggers at most once per second."],
  ["УЖАСАЮЩИЙ ВАМПИР", "DREAD VAMPIRE"],
  ["0.5% фактически нанесённого урона восстанавливается за 3 сек, не быстрее 8% максимального HP в секунду. При полном HP восстановление копится красным щитом до 15% максимального HP. Всё остальное лечение отключается", "0.5% of actual damage dealt is recovered over 3 sec, capped at 8% of Maximum HP per second. At full HP, recovery builds a red shield up to 15% of Maximum HP. All other healing is disabled"],
  ["МГНОВЕННЫЙ ВАМПИРИЗМ", "INSTANT LIFE STEAL"],
  ["обычное вытягивание перестаёт течь во времени и лечит целиком в момент удара; трёхсекундный поток Ужасающего вампира не меняется", "normal life steal no longer recovers health over time and heals the full amount on hit; Dread Vampire's three-second recovery stream is unchanged"],
  ["Снижение урона от обычных монстров", "Damage Reduction from Normal Enemies"],
  ["−4…−8% входящего урона от обычных врагов за выбор; суммируется до −25%.", "Grants 4–8% less incoming damage from normal enemies per pick; stacks up to 25%."],
  ["Снижение урона от элиты и боссов", "Damage Reduction from Elites and Bosses"],
  ["Случайно −5…−15% входящего урона от элитных врагов и боссов за выбор; суммируется до −25%.", "Grants 5–15% less incoming damage from elites and bosses per pick; stacks up to 25%."],
  ["+N ко всему урону", "+N to All Damage"], ["+% ко всему урону", "+% to All Damage"],
  ["Множитель урона", "Damage Multiplier"],
  ["бонусы more складываются в общей корзине, которая применяется один раз после обычных процентов", "more bonuses add in a shared bucket that is applied once after regular percentages"],
  ["Урон по площади", "Area Damage"], ["Урон снарядов", "Projectile Damage"],
  ["За выбор даёт целые +7–13%; суммируется без потолка.", "Each pick grants an integer +7–13%; stacks without a cap."],
  ["Только для Лучника. За выбор даёт целые +5–10%; суммируется без потолка.", "Archer only. Each pick grants an integer +5–10%; stacks without a cap."],
  ["Урон ближнего боя", "Melee Damage"], ["Шипы", "Thorns"],
  ["выпадает только Воину", "available only to the Warrior"],
  ["ТЕРНОВЫЙ КРУГ", "THORN RING"],
  ["Урон в размере % от HP врага", "Damage Equal to % of Enemy HP"],
  ["работает от текущего HP врага; суммарный потолок 10%", "based on the enemy's current HP; total cap 10%"],
  ["ДОБИВАНИЕ", "EXECUTE"],
  ["любое прямое попадание мгновенно убивает обычного монстра с 10% HP или меньше · одна фиолетовая карточка", "any direct hit instantly kills a normal monster at 10% HP or less · one purple card"],
  ["<b>Когда срабатывает:</b> после любого прямого попадания героя или свиты по обычному монстру.<br><b>Условие:</b> после урона у цели осталось 10% максимального HP или меньше; ровно 10% уже подходит.<br><b>Эффект:</b> оставшееся здоровье мгновенно снимается независимо от силы самого удара.<br><b>Пример:</b> у обычного монстра 1000 максимального HP. Слабый удар оставил ему 100 HP — «ДОБИВАНИЕ» немедленно убивает его.<br><b>Не действует:</b> на элиту и боссов. Карточка уникальная и повторно не выпадает.", "<b>Trigger:</b> after any direct hit by the hero or a minion against a normal monster.<br><b>Condition:</b> the target has 10% of maximum HP or less after the damage; exactly 10% qualifies.<br><b>Effect:</b> all remaining health is removed instantly, regardless of how weak the triggering hit was.<br><b>Example:</b> a normal monster has 1,000 maximum HP. A weak hit leaves it at 100 HP, and EXECUTE kills it immediately.<br><b>Does not affect:</b> elites or bosses. This card is unique and cannot appear again."],
  ["Надёжный удар", "Reliable Hit"],
  ["минимальный урон приближается к максимальному; максимум не снижается", "minimum damage moves toward maximum damage; maximum damage is unchanged"],
  ["Урон считается дважды, берётся лучшее", "Roll Damage Twice, Keep the Better Roll"],
  ["+N% к шансу крита", "+N% Critical Hit Chance"], ["+% к шансу крита", "+% Critical Hit Chance"],
  ["Множитель критического урона", "Critical Damage Multiplier"], ["СВЕРХКРИТ", "SUPER CRITICAL"],
  ["крит внутри крита: урон ×2 и кровотечение на 3% от удара в секунду — стакается без предела", "a critical hit within a critical hit: ×2 damage and bleeding for 3% of the hit per second; stacks without limit"],
  ["Ударная волна при крите", "Critical Shockwave"], ["волна по соседям на 20% фактически нанесённого критом урона; защита применяется отдельно", "a wave hits nearby enemies for 20% of the critical damage actually dealt; each target applies its own defenses"],
  ["Скорость атаки", "Attack Speed"], ["Скорость действий (глобально)", "Global Action Speed"],
  ["Скорость передвижения", "Movement Speed"], ["Ускорение после убийства", "Speed after Kill"],
  ["+25% скорости на 0,8 сек", "+25% speed for 0.8 sec"],

  /* Карточки: геометрия и стихии */
  ["Доп. снаряды", "Additional Projectiles"], ["один из сильнейших модификаторов", "one of the strongest modifiers"],
  ["Пробитие насквозь (N целей)", "Pierce (N Targets)"],
  ["+1 или +2 цели; максимум 4. Без СВЕРХПРОБИТИЯ каждый следующий враг получает на 20% меньше урона. На потолке открывает СВЕРХПРОБИТИЕ.", "+1 or +2 targets; maximum 4. Without SUPER PIERCE, each subsequent enemy takes 20% less damage. At the cap, unlocks SUPER PIERCE."],
  ["Отскоки на другие цели", "Chains to Other Targets"],
  ["Самонаведение", "Homing"], ["Скорость снарядов", "Projectile Speed"],
  ["Сверхдавление", "Overpressure"],
  ["каждая дополнительная цель одного уронного взрыва даёт ему +5% урона · учитывается до 5 дополнительных целей · одна синяя карточка",
   "each additional target caught in one damaging explosion grants it +5% damage · up to 5 additional targets count · one blue card"],
  ["<b>Условие появления:</b> доступна, когда у героя уже есть источник уронного взрыва; у Мага таким источником сразу считается взрыв сферы.<br><b>Формула:</b> одна цель получает обычный урон; каждая следующая цель в том же взрыве добавляет +5% урона всем его целям. Учитывается максимум 6 целей: 1 = ×1,00; 2 = ×1,05; 3 = ×1,10; 4 = ×1,15; 5 = ×1,20; 6 и больше = ×1,25.<br><b>Работает:</b> со взрывом сферы Мага, вспышкой при убийстве, ответным взрывом Воина, Гравитационным колодцем, взрывом приспешника при смерти, Буйством демонов, Внезапным взрывом и Астральным набегом.<br><b>Не работает:</b> с ударными волнами, молниевыми разрядами, круговой волной Воина, вихрем когтей, лужами и чумным взрывом: чумная версия только заражает и не наносит мгновенный урон.<br><b>Важно:</b> у сферы усиливается только урон взрыва, а не прямое попадание снаряда. Карточка синяя, уникальная и повторно не выпадает.",
   "<b>Availability:</b> enters the pool once the hero has a damaging-explosion source; a Mage's orb explosion qualifies immediately.<br><b>Formula:</b> one target takes normal damage; every additional target caught in the same explosion grants +5% damage to every target hit by it. At most 6 targets count: 1 = ×1.00; 2 = ×1.05; 3 = ×1.10; 4 = ×1.15; 5 = ×1.20; 6 or more = ×1.25.<br><b>Works with:</b> Mage orb explosions, Explosion on Kill, Warrior retaliation blasts, Gravity Well, Minion Death Explosion, Demon Frenzy, Sudden Blast, and Astral Raid.<br><b>Does not work with:</b> shockwaves, lightning discharges, the Warrior's circular wave, Claw Whirlwind, pools, or Plague explosions: the Plague version only infects and deals no immediate damage.<br><b>Important:</b> for an orb, only its explosion damage is increased, not the projectile's direct hit. This blue card is unique and cannot appear again."],
  ["Арканная иллюзия", "Arcane Illusion"],
  ["взрыв сферы слегка притягивает задетых врагов к центру · каждая карточка даёт +20–30% силы · потолок 100%",
   "orb explosions lightly pull affected enemies toward their center · each card grants +20–30% strength · capped at 100%"],
  ["<b>Класс:</b> выпадает только Магу.<br><b>Эффект:</b> каждый взрыв обычной или мини-сферы слегка притягивает всех задетых живых врагов к своему центру.<br><b>Сила:</b> каждая карточка даёт целые 20–30%; значения складываются до потолка 100%.<br><b>Сопротивление:</b> Бегуны получают 70% импульса, элита 50%, боссы 10%.<br><b>Не влияет:</b> на урон, радиус взрыва и другие взрывные эффекты.",
   "<b>Class:</b> available only to the Mage.<br><b>Effect:</b> every normal or mini-orb explosion lightly pulls all affected living enemies toward its center.<br><b>Strength:</b> each card grants a whole 20–30%; values stack up to a 100% cap.<br><b>Resistance:</b> Runners receive 70% of the impulse, elites 50%, and bosses 10%.<br><b>Does not affect:</b> damage, explosion radius, or any other explosion effects."],
  ["Радиус области действия", "Area of Effect Radius"], ["Дуга рассекающего удара", "Cleave Arc"],
  ["Шанс чумного взрыва трупа", "Chance for Corpse Plague Explosion"],
  ["заражает ближайшую толпу чумой · суммарный потолок 25%", "infects the nearby crowd with plague · total cap 25%"],
  ["Шанс МЕГА-чумного взрыва", "Chance for MEGA Plague Explosion"],
  ["вдвое больший радиус чумы; заражает всю задетую толпу", "double plague radius; infects the entire crowd caught in the blast"],
  ["Шанс двойного попадания", "Double Hit Chance"], ["СМЕРТОНОСНОЕ ПОПАДАНИЕ", "DEADLY HIT"],
  ["суммарный потолок 25%", "total cap 25%"],
  ["каждая атака имеет 1% шанс снять 25% текущего HP цели", "each attack has a 1% chance to remove 25% of the target's current HP"],
  ["ДРОБОВИК", "SHOTGUN"], ["снаряды летят тугим пучком — весь залп ложится в одну цель", "projectiles fly in a tight cluster, allowing the entire volley to hit one target"],
  ["ЭКО-ОТСКОКИ", "ECHO CHAINS"], ["отскоки перестают терять 25% урона на каждом прыжке", "chained hits no longer lose 25% damage with each jump"],
  ["СВЕРХПРОБИТИЕ", "SUPER PIERCE"], ["+20% урона за каждую уже пробитую цель", "+20% damage for each target already pierced"],
  ["РАДИУС В УРОН", "RADIUS INTO DAMAGE"], ["каждый процент радиуса области даёт 0.6% урона", "each 1% of area radius grants 0.6% damage"],
  ["Круговой орб", "Orbiting Orb"], ["только для Воина · кружок вращается вокруг вас на базовом радиусе 88,8 и бьёт всё, чего коснётся, на 25% от автоатаки — со всеми модификаторами и шансами. До 10 штук", "Warrior only · an orb circles you at a base radius of 88.8 and hits everything it touches for 25% of your basic attack, including all modifiers and proc chances. Up to 10 orbs"],
  ["Осколочный рикошет", "Shard Ricochet"],
  ["при первом попадании снаряд выпускает осколок в ближайшего незадетого врага · осколок наносит 45% урона · максимум 3",
   "on its first hit, the projectile releases a shard at the nearest untouched enemy · the shard deals 45% damage · maximum 3"],
  ["+N к урону: Огонь", "+N Fire Damage"], ["+% к урону: Огонь", "+% Fire Damage"],
  ["Шанс наложить: Поджог", "Chance to Ignite"], ["поджог наносит 20% полного удара в секунду в течение 3 секунд", "Ignite deals 20% of the full hit per second for 3 seconds"],
  ["ИНФЕРНО", "INFERNO"], ["горящие враги поджигают всех вокруг себя на 3 секунды — пожар идёт по толпе сам", "burning enemies ignite everything around them for 3 seconds, letting the fire spread through the crowd"],
  ["+N к урону: Холод", "+N Cold Damage"], ["+% к урону: Холод", "+% Cold Damage"],
  ["Шанс наложить: Охлаждение", "Chance to Chill"], ["на 0,5 сек: −15% скорости, +10% в общую корзину входящего урона и дополнительный удар на 10%; соседи замедляются на 5%", "for 0.5 sec: −15% speed, +10% to the shared damage-taken bucket, and an extra hit for 10%; nearby enemies are slowed by 5%"],
  ["ЗАМОРОЗКА", "FREEZE"], ["каждое охлаждение имеет 1% шанс полностью остановить цель на 1 секунду; заморозка добавляет +10% в общую корзину входящего урона", "each Chill has a 1% chance to stop the target completely for 1 second; Freeze adds +10% to the shared damage-taken bucket"],
  ["+N к урону: Молния", "+N Lightning Damage"], ["широкий разброс", "wide damage range"], ["+% к урону: Молния", "+% Lightning Damage"],
  ["Шанс разряда молнии", "Lightning Discharge Chance"], ["разряд бьёт до 5 соседей на 15% удара, а Шок на 1 секунду добавляет +10% в общую корзину входящего урона", "the discharge strikes up to 5 nearby enemies for 15% of the hit, while Shock adds +10% to the shared damage-taken bucket for 1 second"],
  ["ТЕСЛА", "TESLA"], ["разряд бьёт до 20 соседей на 25% силы удара", "the discharge strikes up to 20 nearby enemies for 25% of the hit"],
  ["+N к урону: Яд", "+N Poison Damage"], ["+% к урону: Яд", "+% Poison Damage"],
  ["Шанс наложить: Отравление", "Chance to Poison"], ["стакается, не тратит время боя", "stacks without consuming attack time"],
  ["РАДИАЦИЯ", "RADIATION"], ["удваивает урон каждого прока яда: 30% полного удара в секунду вместо 15%", "doubles the damage of every Poison proc: 30% of the full hit per second instead of 15%"],
  ["Сила всех негативных эффектов", "All Ailment Effect"],
  ["<b>Формула:</b> урон эффекта × (1 + бонус / 100). Усиливает урон поджога, яда, кровотечения, дополнительный урон охлаждения, разряд шока и огненный след.<br><b>Пример:</b> +36% превращает 100 урона/сек в 136 урона/сек.<br><b>Не влияет:</b> на шанс наложения, длительность, радиус, прямой урон атаки, силу замедления и кислоту Веномансера.", "<b>Formula:</b> ailment damage × (1 + bonus / 100). Increases damage from Ignite, Poison, Bleeding, Chill's extra hit, Shock discharge, and the burning trail.<br><b>Example:</b> +36% turns 100 damage/sec into 136 damage/sec.<br><b>Does not affect:</b> application chance, duration, radius, direct attack damage, slow strength, or Venomancer acid."],
  ["Длительность всех эффектов", "All Ailment Duration"],
  ["<b>Формула:</b> длительность × (1 + бонус / 100). Продлевает поджог, яд, кровотечение, охлаждение, заморозку, шок, оглушение и головокружение.<br><b>Пример:</b> +50% превращает обычный поджог 3 сек в 4,5 сек, яд 4 сек — в 6 сек, кровотечение 6 сек — в 9 сек.<br><b>Не продлевает:</b> кислоту Веномансера, лужи, снаряды и время действия предметов.", "<b>Formula:</b> duration × (1 + bonus / 100). Extends Ignite, Poison, Bleeding, Chill, Freeze, Shock, Stun, and Daze.<br><b>Example:</b> +50% turns a 3-sec Ignite into 4.5 sec, a 4-sec Poison into 6 sec, and a 6-sec Bleed into 9 sec.<br><b>Does not extend:</b> Venomancer acid, pools, projectiles, or item effect durations."],

  /* Карточки: условия, защита, контроль, прогрессия */
  ["Урон по раненым врагам", "Damage to Injured Enemies"],
  ["цель имеет 60% HP или меньше · каждая карточка даёт 3–7% · без потолка", "target has 60% HP or less · each card grants 3–7% · no cap"],
  ["<b>Раненая цель:</b> враг с 60% максимального HP или меньше. Например, враг с запасом 1000 HP считается раненым при 600 HP и ниже.<br><b>Эффект:</b> все подходящие попадания по раненой цели получают выбранный бонус.<br><b>Диапазон:</b> каждая карточка даёт целые 3–7%.<br><b>Накопление:</b> значения складываются без потолка; например, 4% + 6% + 7% = +17% урона.", "<b>Injured target:</b> an enemy at 60% of maximum HP or less. For example, an enemy with 1,000 maximum HP is Injured at 600 HP or below.<br><b>Effect:</b> all eligible hits against an Injured target gain the rolled bonus.<br><b>Range:</b> each card grants a whole 3–7%.<br><b>Stacking:</b> values add with no cap; for example, 4% + 6% + 7% = +17% damage."],
  ["Урон по врагам на полном HP", "Damage to Enemies at Full HP"],
  ["каждая карточка даёт 7–12% · значения складываются без потолка · действует только пока цель на полном HP", "each card grants 7–12% · values stack with no cap · active only while the target is at Full HP"],
  ["<b>Условие:</b> цель находится на полном HP непосредственно перед попаданием.<br><b>Эффект:</b> это попадание получает накопленный процент урона; после потери здоровья бонус отключается, пока цель снова не восстановится полностью.<br><b>Диапазон:</b> каждая карточка даёт целые 7–12%.<br><b>Накопление:</b> значения складываются без потолка; например, 8% + 11% = +19%.<br><b>Пример:</b> без других бонусов +9% превращает первый удар на 100 в 109 урона.", "<b>Condition:</b> the target is at Full HP immediately before the hit.<br><b>Effect:</b> that hit gains the accumulated damage percentage; after the target loses health, the bonus turns off until the target fully recovers.<br><b>Range:</b> each card grants a whole 7–12%.<br><b>Stacking:</b> values add with no cap; for example, 8% + 11% = +19%.<br><b>Example:</b> without other bonuses, +9% turns the first 100-damage hit into 109 damage."],
  ["Урон по боссам и элите", "Damage to Bosses and Elites"], ["каждая карточка даёт 5–15% урона", "each card grants 5–15% damage"],
  ["Урон в движении", "Damage while Moving"],
  ["каждая карточка даёт 7–12% · складывается без потолка · действует только в движении", "each card grants 7–12% · stacks with no cap · active only while moving"],
  ["Урон при стоянии на месте", "Damage while Stationary"],
  ["каждая карточка даёт 10–15% · складывается без потолка · турель-архетип", "each card grants 10–15% · stacks with no cap · turret archetype"],
  ["Урон за каждого врага рядом", "Damage per Nearby Enemy"], ["считает до 8 целей в радиусе 220 — в толпе даёт максимум", "counts up to 8 targets within 220 range, reaching its maximum in a crowd"],
  ["Урон после недавнего убийства", "Damage after a Recent Kill"],
  ["каждая карточка даёт 3–7% · после убийства действует 1 секунду · значения складываются без потолка", "each card grants 3–7% · active for 1 second after a kill · values stack with no cap"],
  ["<b>Когда срабатывает:</b> сразу после убийства любого врага.<br><b>Эффект:</b> весь подходящий урон получает накопленный процент бонуса ровно на 1 секунду.<br><b>Диапазон:</b> каждая карточка даёт целые 3–7%.<br><b>Накопление:</b> значения складываются без потолка; например, 4% + 6% = +10% урона на следующую секунду.<br><b>Обновление:</b> новое убийство снова выставляет таймер на 1 секунду; длительности не складываются.", "<b>Trigger:</b> immediately after killing any enemy.<br><b>Effect:</b> all eligible damage gains the accumulated percentage bonus for exactly 1 second.<br><b>Range:</b> each card grants a whole 3–7%.<br><b>Stacking:</b> values add with no cap; for example, 4% + 6% = +10% damage for the next second.<br><b>Refresh:</b> another kill resets the timer to 1 second; durations do not stack."],
  ["каждая карточка даёт 3–5% шанса · потолок 50% · базовое оглушение 0,5 секунды", "each card grants 3–5% chance · capped at 50% · base Stun lasts 0.5 seconds"],
  ["<b>Формула:</b> выбранное значение × прошедшее время боя в секундах, пока на арене есть хотя бы один живой враг. Бонус прибавляется к обычным процентам урона и растёт плавно, включая доли секунды.<br><b>Пример:</b> +2% даёт +20% через 10 сек и достигает потолка +40% через 20 сек.<br><b>Сброс:</b> сразу после зачистки, когда живых врагов не остаётся. Работает и на урон свиты.", "<b>Formula:</b> rolled value × elapsed combat time in seconds while at least one enemy is alive in the arena. The bonus is added to regular increased damage and grows smoothly, including fractions of a second.<br><b>Example:</b> +2% grants +20% after 10 sec and reaches the +40% cap after 20 sec.<br><b>Reset:</b> immediately after the room is cleared. Also affects minion damage."],
  ["БРОНЯ В УРОН", "ARMOR INTO DAMAGE"], ["каждые 100 брони превращаются в +12 к урону", "every 100 Armor grants +12 Damage"],
  ["ПРОХОД СКВОЗЬ ВРАГОВ", "PHASE THROUGH ENEMIES"], ["в движении вы проходите сквозь тела и не получаете контактный урон — но не стоя на месте", "while moving, you phase through enemies and take no contact damage; this does not work while stationary"],
  ["ТАРАННЫЙ РЫВОК", "RAMMING DASH"], ["рывок сносит всех на пути (120% урона) и вызывает головокружение", "Dash plows through enemies in its path for 120% damage and Dazes them"],
  ["ОБМАН СМЕРТИ", "CHEAT DEATH"],
  ["100% спасает от смертельного удара, оставляя 1 HP · неуязвимость на 1 сек · +50% скорости передвижения на 1 сек · откат 60 сек",
   "100% prevents a fatal hit, leaving 1 HP · 1 sec invulnerability · +50% movement speed for 1 sec · 60 sec cooldown"],
  ["Шанс отбрасывания", "Knockback Chance"], ["сила толчка: Бегуны −30% · элита −50% · боссы −90%", "knockback force: Runners −30% · elites −50% · bosses −90%"],
  ["ГОЛОВОКРУЖЕНИЕ", "DAZE"], ["после отбрасывания враг ковыляет на 50% медленнее 2 секунды", "after being knocked back, the enemy moves 50% slower for 2 seconds"],
  ["Шанс оглушения", "Stun Chance"],
  ["Урон по замедленным", "Damage to Slowed Enemies"],
  ["каждая карточка даёт 5–10% урона · без потолка · открывается после получения источника замедления", "each card grants 5–10% damage · no cap · unlocked after obtaining a source of slowing"],
  ["<b>Условие появления:</b> сначала получите хотя бы один источник замедления: Охлаждение, Книгу льда, Ботинки морозилки, Бомбардиров, Головокружение или ауру замедления.<br><b>Что считается замедлением:</b> прямое Охлаждение, ледяная аура вокруг охлаждённого врага, Головокружение и аура замедления героя.<br><b>Эффект:</b> каждая карточка даёт целые 5–10% урона по такой цели.<br><b>Накопление:</b> значения складываются без потолка; например, 6% + 9% = +15% урона.<br><b>Не считается:</b> одно только оглушение или заморозка без Охлаждения.", "<b>Unlock condition:</b> first obtain at least one source of slowing: Chill, the Book of Ice, Frost Boots, Bombardiers, Daze, or the slowing aura.<br><b>What counts as slowed:</b> direct Chill, the icy aura around a Chilled enemy, Daze, and the hero's slowing aura.<br><b>Effect:</b> each card grants a whole 5–10% damage against such a target.<br><b>Stacking:</b> values add with no cap; for example, 6% + 9% = +15% damage.<br><b>Does not count:</b> Stun or Freeze by itself without Chill."],
  ["Холодный раскол", "Cold Shatter"],
  ["убийство замедлённого врага охлаждает остальных в радиусе 180 на 0,7 секунды · радиус растёт от области", "killing a slowed enemy Chills others within 180 range for 0.7 sec · radius scales with area"],
  ["<b>Условие появления:</b> сначала получите хотя бы один источник замедления.<br><b>Когда срабатывает:</b> при убийстве врага под прямым Охлаждением, ледяной аурой, Головокружением или аурой замедления.<br><b>Эффект:</b> все остальные живые враги в радиусе 180 получают Охлаждение на базовые 0,7 секунды.<br><b>Масштабирование:</b> радиус растёт от «Радиуса области действия», длительность — от «Длительности всех эффектов».<br><b>Ограничение:</b> синяя уникальная карточка; после выбора дубли больше не выпадают.", "<b>Unlock condition:</b> first obtain at least one source of slowing.<br><b>Trigger:</b> killing an enemy affected by direct Chill, the icy aura, Daze, or the slowing aura.<br><b>Effect:</b> every other living enemy within 180 range is Chilled for a base duration of 0.7 sec.<br><b>Scaling:</b> radius scales with Area of Effect Radius and duration scales with All Ailment Duration.<br><b>Limit:</b> a unique blue card; duplicates cannot appear after it is taken."],
  ["Аура замедления врагов", "Enemy-Slowing Aura"],
  ["−25% скорости всем в радиусе 260", "−25% speed to all enemies within 260 range"],
  ["Взрыв при убийстве (вспышка)", "Explosion on Kill"],
  ["каждая карточка даёт 6–12% шанса · потолок 50% · урон равен среднему урону автоатаки и проходит через защиту цели", "each card grants 6–12% chance · capped at 50% · damage equals average basic-attack damage and is reduced by the target's defenses"],
  ["<b>Когда проверяется:</b> после каждого убийства.<br><b>Шанс:</b> каждая карточка даёт целые 6–12 процентных пунктов; суммарный шанс ограничен 50%.<br><b>Урон:</b> 100% среднего урона автоатаки, после чего применяются броня и остальные защиты каждой задетой цели.<br><b>Цепь:</b> враг, погибший от вспышки, сам может запустить следующую вспышку.<br><b>Развитие:</b> на потолке 50% открывается красная карточка «СИЛЬНЫЙ ВЗРЫВ ПРИ УБИЙСТВЕ».", "<b>Roll:</b> after every kill.<br><b>Chance:</b> each card grants a whole 6–12 percentage points; total chance is capped at 50%.<br><b>Damage:</b> 100% of average basic-attack damage, then Armor and every other defense of each affected target are applied.<br><b>Chain:</b> an enemy killed by the blast can trigger another blast.<br><b>Upgrade:</b> at the 50% cap, unlocks the red STRONG EXPLOSION ON KILL card."],
  ["СИЛЬНЫЙ ВЗРЫВ ПРИ УБИЙСТВЕ", "STRONG EXPLOSION ON KILL"],
  ["шанс становится 65% · урон вспышки 125% среднего удара · слегка расталкивает врагов", "chance becomes 65% · blast deals 125% of average hit damage · lightly knocks enemies away"],
  ["<b>Требование:</b> достигнуть потолка 50% обычного взрыва при убийстве.<br><b>Шанс:</b> вместо 50% становится 65%.<br><b>Урон:</b> вспышка наносит 125% среднего урона автоатаки с учётом защиты каждой цели.<br><b>Отбрасывание:</b> лёгкий импульс от центра взрыва; Бегуны, элита и боссы сохраняют своё сопротивление отбрасыванию.<br><b>Цепь:</b> убийства этой вспышкой по-прежнему могут создавать следующие вспышки.", "<b>Requirement:</b> reach the regular Explosion on Kill cap of 50%.<br><b>Chance:</b> increases from 50% to 65%.<br><b>Damage:</b> the blast deals 125% of average basic-attack damage after applying each target's defenses.<br><b>Knockback:</b> a light impulse away from the blast center; Runners, elites, and bosses retain their knockback resistance.<br><b>Chain:</b> kills caused by this blast can still trigger further blasts."],
  ["Ответный удар при получении урона", "Retaliation when Hit"],
  ["Автолечение при малом здоровье", "Automatic Healing at Low Health"], ["25% HP, откат 20 сек", "25% HP, 20 sec cooldown"],
  ["+% к получаемому опыту", "+% Experience Gained"], ["Находимое золото", "Gold Find"],

  /* Карточки: свита и кейстоуны */
  ["Ещё один скелет", "Additional Skeleton"], ["потолок скелетов — 6", "maximum 6 Skeletons"],
  ["Костяной слуга", "Bone Servant"],
  ["Максимум скелетов:", "Maximum Skeletons:"], ["Сейчас:", "Current:"], ["Ранг:", "Rank:"],
  ["Каждый ранг повышает максимум скелетов на 1. Максимум 3 ранга.", "Each rank raises the Skeleton limit by 1. Maximum 3 ranks."],
  ["СВИТА БОМБАРДИРОВ", "BOMBARDIER RETINUE"], ["до шести бомбардиров: каждый снаряд взрывается в небольшом радиусе, наносит 25% урона скелета и гарантированно накладывает поджог, отравление, обморожение или электрошок", "up to six Bombardiers: every projectile explodes in a small radius, deals 25% of a Skeleton hit, and always applies Ignite, Poison, Chill, or Shock"],
  ["ГОЛЕМ КРОВИ", "BLOOD GOLEM"], ["танк с провокацией. Первый уровень: вдвое реже скелета, втрое сильнее. Дальше растёт урон и понемногу темп; на десятом — запас как у 3.5 скелетов", "a taunting tank. At rank 1 it attacks half as often as a Skeleton but hits three times harder. Further ranks increase damage and gradually improve attack speed; at rank 10 it has the health of 3.5 Skeletons"],
  ["КОСТЯНОЙ ГОЛЕМ", "BONE GOLEM"], ["прямого урона не наносит вовсе: вешает кровотечение и сразу бежит к следующему, разнося стаки по всей толпе. Бьёт чаще всех в свите; на десятом уровне запас как у двух скелетов", "deals no direct damage: it applies Bleeding, then immediately seeks a new target to spread stacks through the crowd. It attacks faster than any other minion; at rank 10 it has the health of two Skeletons"],
  ["Урон приспешников", "Minion Damage"], ["на +50% суммарно открывается БУЙСТВО ДЕМОНОВ. Потолка у ветки нет, качается дальше", "at +50% total, unlocks DEMON FRENZY. This branch has no cap and can be upgraded further"],
  ["Поле костей", "Bone Field"], ["Одноразовая. +5% урона свиты за каждый труп в радиусе 400, максимум +45% от девяти трупов.", "One-time. +5% minion damage for each corpse within 400 units, up to +45% from nine corpses."],
  ["урона свиты", "minion damage"],
  ["КРОВАВАЯ БАНЯ", "BLOODBATH"], ["каждый десятый удар свиты вызывает кровотечение — то же самое, что ставит книга крови, и в тот же стак", "every tenth minion hit causes the same Bleeding as the Book of Blood and adds it to the same stack"],
  ["КИПЯЩАЯ КРОВЬ", "BOILING BLOOD"], ["удар по приспешнику с шансом 5% оставляет под ним кипящую лужу на 3 сек: каждую секунду она снимает 5% ТЕКУЩЕГО здоровья всем, кто в ней стоит", "when a minion is hit, it has a 5% chance to leave a boiling pool beneath it for 3 sec. Each second, the pool removes 5% of the CURRENT health of everything standing in it"],
  ["БУЙСТВО ДЕМОНОВ", "DEMON FRENZY"], ["каждый удар свиты добавляет взрыв по площади. Взрыв бьёт на полный урон удара и разносит все ваши эффекты. Радиус растёт от «Радиуса области действия»", "every minion hit triggers an area explosion. The explosion deals the hit's full damage and applies all your effects. Its radius scales with Area of Effect Radius"],
  ["Скорость атаки приспешников", "Minion Attack Speed"], ["на +50% открываются РЕЗКИЕ КОГТИ, на +100% — ВИХРЬ КОГТЕЙ. Потолка у ветки нет", "at +50%, unlocks RAZOR CLAWS; at +100%, unlocks CLAW WHIRLWIND. This branch has no cap"],
  ["РЕЗКИЕ КОГТИ", "RAZOR CLAWS"], ["каждый пятый удар приспешника добавляет второй, на 30% мощности. Считается отдельно у каждого бойца", "every fifth hit by a minion adds a second hit at 30% power. Counted separately for each minion"],
  ["ВИХРЬ КОГТЕЙ", "CLAW WHIRLWIND"], ["каждый десятый удар приспешника рассекает всё вокруг него на 20% мощности", "every tenth hit by a minion cleaves everything around it at 20% power"],
  ["Скорость передвижения свиты", "Minion Movement Speed"], ["каждая карточка даёт +5–13% скорости. На +40% открывается ВНЕЗАПНЫЙ ВЗРЫВ, на +80% — АСТРАЛЬНЫЙ НАБЕГ. Потолка у ветки нет", "each card grants +5–13% Movement Speed. At +40%, unlocks SUDDEN BLAST; at +80%, unlocks ASTRAL RAID. This branch has no cap"],
  ["ВНЕЗАПНЫЙ ВЗРЫВ", "SUDDEN BLAST"], ["раз в 10 сек приспешник переносится к своей цели и взрывается на 30% удара. Взрыв идёт как обычная атака — со всеми вашими эффектами", "every 10 sec, a minion teleports to its target and explodes for 30% of a hit. The explosion counts as a regular attack and applies all your effects"],
  ["АСТРАЛЬНЫЙ НАБЕГ", "ASTRAL RAID"], ["перенос раз в 4 сек, взрыв шире и на 50% удара. Заменяет собой ВНЕЗАПНЫЙ ВЗРЫВ, а не складывается с ним", "teleports every 4 sec, with a wider explosion dealing 50% of a hit. Replaces SUDDEN BLAST instead of stacking with it"],
  ["Крит приспешников", "Minion Critical Chance"], ["Взрыв приспешника при смерти", "Minion Death Explosion"],
  ["КОСТЯНОЙ ВЫЗОВ", "BONE DEFIANCE"], ["каждый удар свиты с шансом 1% заставляет атакованного монстра переключиться на ударившего приспешника, пока тот жив", "each minion hit has a 1% chance to make the struck monster target that minion while it remains alive"],
  ["ЛОРД СМЕРТИ", "DEATH LORD"], ["0,1% всего фактически нанесённого свитой урона восстанавливает здоровье Некроманта", "0.1% of all damage actually dealt by minions restores the Necromancer's health"],
  ["Часть урона по вам идёт приспешнику", "Part of Damage Taken Is Redirected to a Minion"], ["потолок ветки — 50%. На пятидесяти открываются КРОВНЫЕ УЗЫ", "this branch is capped at 50%. At 50%, unlocks BLOOD TIES"],
  ["КРОВНЫЕ УЗЫ", "BLOOD TIES"], ["каждое попадание по вам приводит свиту в ярость: вдвое больше урона следующие 3 секунды", "each hit you take enrages your minions, doubling their damage for the next 3 seconds"],
  ["Свита наследует % ваших статов", "Minions Inherit % of Your Stats"], ["добавляет процентные пункты к общей корзине урона свиты, а также усиливает наследование здоровья и критического шанса", "adds percentage points to the shared Minion Damage bucket and also improves inherited Health and Critical Chance"],
  ["Повышение ранга призываемых", "Upgrade Summoned Minions"], ["+60% здоровья и +45% урона всей свите", "+60% health and +45% damage to all minions"],
  ["Некромантская связь", "Necromantic Bond"], ["40% урона по вам уходит свите, но свита бьёт в полтора раза сильнее", "40% of damage taken is redirected to your minions, but minions deal 50% more damage"],
  ["Стеклянная пушка", "Glass Cannon"], ["+60% урона (more), но −40% макс. здоровья", "60% more damage, but −40% maximum health"],
  ["Выверенная техника", "Measured Technique"], ["криты невозможны, но +50% урона (more)", "critical hits are disabled, but you deal 50% more damage"],
  ["Тяжёлый удар", "Heavy Strike"], ["вдвое медленнее, но вчетверо сильнее", "attacks are twice as slow but four times as strong"],
  ["Шквал", "Flurry"], ["вдвое быстрее, но вдвое слабее", "attacks are twice as fast but deal half damage"],
  ["Акробатика", "Acrobatics"], ["уклонение удвоено, +15% скорости", "Evasion is doubled and Movement Speed is increased by 15%"],
  ["Чумная смерть", "Plague Death"], ["каждый труп гарантированно даёт чумный взрыв, но радиус чумы уменьшается на 35%", "every corpse always causes a plague explosion, but plague radius is reduced by 35%"],
  ["Налегке", "Unburdened"], ["вся броня из магазина, талантов, навыков и предметов обнуляется; Стальная толпа больше не выпадает; +35% скорости и +25% скорости атаки", "All Armor from the shop, talents, skills, and items is set to zero; Steel Crowd no longer appears; gain +35% Movement Speed and +25% Attack Speed"],

  /* Классы, подклассы, книги, тотемы */
  ["ВОИН", "WARRIOR"], ["Ближний бой. Каждый третий взмах выпускает круговую волну и отбрасывает врагов.", "Close combat. Every third swing releases a circular wave that knocks enemies back."],
  ["ЛУЧНИК", "ARCHER"], ["Быстрый дальний бой. Особенно силён с дополнительными стрелами, пробитием и отскоками.", "Fast ranged combat. Excels with additional arrows, Pierce, and Chains."],
  ["МАГ", "MAGE"], ["Магические сферы взрываются по площади и несут силу стихий.", "Magical orbs explode over an area and carry elemental power."],
  ["НЕКРОМАНТ", "NECROMANCER"], ["Не атакует сам. Поднимает павших врагов скелетами и сражается силами свиты.", "Does not attack directly. Raises fallen enemies as Skeletons and fights through minions."],
  ["ВОР", "THIEF"], ["+2% ко всему получаемому золоту за уровень и +1% к скорости передвижения за уровень.", "+2% to all gold gained per level and +1% Movement Speed per level."],
  ["ОХОТНИК", "HUNTER"], ["+1% скорости атаки каждые 5 уровней.", "+1% Attack Speed every 5 levels."],
  ["БОЕВОЙ ТАНЦОР", "BATTLE DANCER"], ["+1 рывок, +1 к увороту за каждый уровень и +1% к максимальному здоровью каждые 5 уровней.", "+1 Dash charge, +1 Dodge per level, and +1% Maximum Health every 5 levels."],
  ["БЕРСЕРК", "BERSERKER"], ["+1% к урону за уровень. +2 здоровья за попадание каждые 5 уровней.", "+1% Damage per level. +2 Health per hit every 5 levels."],
  ["СТРАЖ", "GUARDIAN"], ["+1% максимального здоровья за уровень. Круговая волна, задевшая хотя бы двух врагов, даёт барьер на 8% здоровья; перезарядка 3 сек. Каждые 5 уровней восстанавливает ещё 5 здоровья раз в 5 сек.", "+1% Maximum Health per level. A circular wave that hits at least two enemies grants a barrier equal to 8% of Maximum Health; 3 sec cooldown. Every 5 levels, restores 5 more Health every 5 sec."],
  ["МАСТЕР МЕЧА", "SWORDMASTER"], ["+3% к радиусу круговой волны и +3% к силе её отбрасывания каждые 2 уровня, до +50% и +80%. С 20-го уровня волна оглушает обычных и элитных врагов на 0,4 сек.", "+3% circular wave radius and +3% wave knockback force every 2 levels, capped at +50% and +80%. From level 20, the wave Stuns normal and elite enemies for 0.4 sec."],
  ["Длинное лезвие", "Long Blade"], ["+10–25% к дальности обычного взмаха. Складывается до +60%. Не увеличивает радиус круговой волны.", "+10–25% normal swing reach. Stacks up to +60%. Does not increase circular wave radius."],
  ["СМЕРТЕЛЬНЫЙ РАДИУС", "DEADLY RADIUS"], ["Увеличивает радиус круговой волны на 80%.", "Increases circular wave radius by 80%."],
  ["Стальная толпа", "Steel Crowd"], ["+2–3 брони за каждого врага в радиусе 300. Учитывается максимум 6 врагов. Значения карточек складываются до 10 брони за врага.", "+2–3 Armor per enemy within 300 range. Up to 6 enemies count. Card values stack up to 10 Armor per enemy."],
  ["ГЛУХАЯ ОБОРОНА", "HOLD THE LINE"], ["Весь входящий урон дополнительно уменьшается на 2% за каждого врага в радиусе 300, максимум на 10%.", "All incoming damage is further reduced by 2% per enemy within 300 range, up to 10%."],
  ["Ответный темп", "Retaliatory Tempo"], ["После реально полученного контактного удара даёт скорость атаки на 2 сек. Бонус каждого удара складывается до +200%, а время прибавляется к остатку.", "After actually taking contact damage, grants Attack Speed for 2 sec. Each hit's bonus stacks up to +200%, and its duration is added to the remaining time."],
  ["Техника трёх шагов", "Three-Step Technique"], ["Первый, второй и третий взмахи получают соответственно +10%, +15% и +20% радиуса и дальности. После третьего удара цикл начинается заново.", "The first, second, and third swings gain +10%, +15%, and +20% radius and reach respectively. The cycle restarts after the third attack."],
  ["Железная ярость", "Iron Fury"], ["Каждый полученный прямой удар даёт +5% урона на 3 секунды и обновляет время. Складывается до +25%.", "Each direct hit taken grants +5% damage for 3 seconds and refreshes the duration. Stacks up to +25%."],
  ["Землелом", "Groundbreaker"], ["Каждая третья круговая волна оставляет трещину на 2 секунды, наносящую 12% удара каждые 0,5 секунды.", "Every third circular wave leaves a crack for 2 seconds, dealing 12% of the hit every 0.5 seconds."],
  ["<b>Класс:</b> выпадает только Воину; фиолетовая одноразовая карта.<br><b>Период:</b> каждая третья круговая волна, то есть каждый девятый обычный взмах, оставляет трещину в месте героя.<br><b>Трещина:</b> повторяет радиус породившей волны, живёт 2 секунды и наносит четыре тика — через 0,5, 1,0, 1,5 и 2,0 секунды.<br><b>Урон:</b> каждый тик наносит всем врагам в трещине 12% обычного удара круговой волны; защита каждой цели применяется отдельно. Тики непрямые, не двигают счётчики прямых ударов и не создают двойное попадание.<br><b>Индикатор:</b> слева снизу показывает число волн до Землелома, а перед готовой волной — «Землелом — ВОЛНА!». Карточка уникальная.", "<b>Class:</b> Warrior only; a purple one-time card.<br><b>Period:</b> every third circular wave—every ninth normal swing—leaves a crack at the hero's position.<br><b>Crack:</b> copies the radius of the wave that created it, lasts 2 seconds, and deals four ticks at 0.5, 1.0, 1.5, and 2.0 seconds.<br><b>Damage:</b> each tick deals 12% of a normal circular-wave hit to every enemy inside; each target applies its own defenses. Ticks are indirect, do not advance direct-hit counters, and cannot create a Double Hit.<br><b>Indicator:</b> the lower-left display shows the waves remaining until Groundbreaker, then reads “Groundbreaker — WAVE!” before the ready wave. This card is unique."],
  ["Землелом через", "Groundbreaker in"], ["Землелом — ВОЛНА!", "Groundbreaker — WAVE!"], ["волны", "waves"],
  ["После прямого вражеского удара атакующий получает текущий процент фактически потерянного героем HP плюс тот же процент среднего урона обычной атаки. Складывается по 25% до 100%.", "After a direct enemy hit, the attacker takes the current percentage of Health actually lost by the hero plus the same percentage of average normal Attack Damage. Stacks by 25% up to 100%."],
  ["Когда Шипы наносят урон, остальные враги в радиусе 180 получают 50% фактически отражённого урона.", "When Thorns deal damage, all other enemies within 180 range take 50% of the damage actually reflected."],
  ["урон увеличен на", "damage increased by"],
  ["Передышка", "Respite"], ["Если герой 4 секунды не получает урон, он начинает восстанавливать 5% максимального HP раз в 3 секунды, но не выше 60% максимального HP. Не работает при открытом портале.", "After taking no damage for 4 seconds, the hero starts recovering 5% of Maximum HP every 3 seconds, but cannot recover above 60% of Maximum HP. Does not work while the portal is open."],
  ["Критическая масса", "Critical Mass"], ["Каждый некритический прямой удар даёт +1% к шансу крита следующего прямого удара. Критический удар обнуляет накопленный бонус.", "Every non-critical direct hit grants +1% Critical Chance to the next direct hit. A critical hit resets the accumulated bonus."],
  ["Запас прочности", "Durability Reserve"], ["20% избыточного урона при убийстве превращается во временный барьер. Потолок — 12% максимального HP; новые убийства складывают барьер и обновляют его 4 секунды.", "20% of overkill damage becomes a temporary barrier. Capped at 12% of Maximum HP; new kills add to the barrier and refresh its 4-second duration."],
  ["Эхо атаки", "Attack Echo"], ["Каждый четвёртый прямой удар повторяется через 0,18 секунды с силой 30%. Эхо не создаёт другое эхо и не вызывает двойное попадание.", "Every fourth direct hit repeats after 0.18 seconds at 30% power. An echo cannot create another echo or trigger Double Hit."],
  ["Элементальная перегрузка", "Elemental Overload"], ["Прямой удар по цели с Поджогом, Охлаждением, Отравлением и/или Шоком поглощает их, если активны хотя бы три, и наносит соседям в радиусе 200 80% фактически прошедшего удара. Защита соседей применяется отдельно.", "A direct hit against a target affected by Ignite, Chill, Poison, and/or Shock consumes them if at least three are active, then deals 80% of the hit's actual damage to enemies within 200 range. Each nearby enemy applies its own defenses."],
  ["<b>Условие появления:</b> текущие шансы Поджога, Охлаждения, Отравления и Шока должны быть выше нуля как минимум у трёх эффектов.<br><b>Срабатывание:</b> прямой удар героя или свиты по цели, на которой одновременно активны хотя бы три из этих четырёх эффектов.<br><b>Эффект:</b> все активные эффекты этой четвёрки поглощаются; остальные враги в фиксированном радиусе 200 получают 80% HP, фактически снятого основным ударом.<br><b>Защита:</b> броня, панцирь, защита пачки и особая защита каждого соседа применяются отдельно. Основная цель исключена из взрыва. Карточка уникальная.", "<b>Availability:</b> at least three of your current Ignite, Chill, Poison, and Shock chances must be above zero.<br><b>Trigger:</b> a direct hit by the hero or a minion against a target simultaneously affected by at least three of those four ailments.<br><b>Effect:</b> all active ailments from that group are consumed; every other enemy within the fixed 200 radius takes 80% of the Health actually removed by the triggering hit.<br><b>Defense:</b> each neighbor applies its own Armor, Bulwark, pack defense, and special protection. The primary target is excluded from the blast. This card is unique."],
  ["Идеальный ритм", "Perfect Rhythm"], ["Каждый седьмой прямой удар гарантированно критует. Герой и вся свита ведут два отдельных общих счётчика.", "Every seventh direct hit is guaranteed to critically strike. The hero and the entire minion army use two separate shared counters."],
  ["<b>Срабатывание:</b> каждый седьмой прямой удар гарантированно становится критическим.<br><b>Счётчики:</b> герой ведёт один счётчик; все приспешники вместе ведут второй общий счётчик. Удары одной группы не двигают счётчик другой.<br><b>Индикатор:</b> слева снизу показывает число атак до гарантированного крита, а перед готовой атакой — «Идеальный ритм — КРИТ!». У Некроманта индикатор использует общий счётчик свиты.<br><b>Не считается:</b> урон со временем, лужи и другие непрямые эффекты. При «Выверенной технике» карта не появляется, потому что этот кейстоун полностью запрещает криты. Карточка уникальная.", "<b>Trigger:</b> every seventh direct hit is guaranteed to be critical.<br><b>Counters:</b> the hero has one counter; all minions together share a second counter. Hits from one group do not advance the other group's counter.<br><b>Indicator:</b> the lower-left display shows the number of attacks remaining until the guaranteed critical hit, then reads “Perfect Rhythm — CRIT!” before the ready attack. For the Necromancer, the indicator uses the minion army's shared counter.<br><b>Not counted:</b> damage over time, pools, and other indirect effects. This card cannot appear with Measured Technique because that keystone disables critical hits entirely. This card is unique."],
  ["крит через", "critical hit in"], ["атак", "attacks"], ["Идеальный ритм — КРИТ!", "Perfect Rhythm — CRIT!"],
  ["Последний свидетель", "Last Witness"], ["Когда в радиусе 350 от героя остаётся ровно один живой враг, герой наносит ему на 35% больше урона.", "When exactly one living enemy remains within 350 range of the hero, the hero deals 35% more damage to it."],
  ["<b>Условие:</b> в радиусе 350 от героя находится ровно один живой враг, и удар направлен именно в него.<br><b>Эффект:</b> герой наносит этой цели на 35% больше урона отдельным множителем ×1,35.<br><b>Не действует:</b> если рядом нет врагов, их два или больше, цель находится за пределами радиуса либо удар наносит свита. Карточка уникальная.", "<b>Condition:</b> exactly one living enemy is within 350 range of the hero, and that enemy is the target.<br><b>Effect:</b> the hero deals 35% more damage to that target as a separate ×1.35 multiplier.<br><b>Does not apply:</b> when there are no nearby enemies, two or more are nearby, the target is outside the radius, or a minion deals the hit. This card is unique."],
  ["Долг времени", "Time Debt"], ["Каждый прямой атакующий удар по монстру даёт +6% скорости атаки на 5 секунд, до +60%; таймер обновляется новым ударом. При достижении как минимум +40% начинается Остывание на 5 секунд: бонус больше не обновляется, а все заряды рывка обнуляются и восстанавливаются заново.", "Every direct attack hit against a monster grants +6% Attack Speed for 5 seconds, up to +60%; a new hit refreshes the timer. Upon reaching at least +40%, Cooling begins for 5 seconds: the bonus can no longer refresh, and all Dash charges are emptied and must recharge from scratch."],
  ["<b>Доступность:</b> кейстоун для всех четырёх классов; карточка одноразовая.<br><b>Накопление:</b> каждый фактически прошедший прямой атакующий удар героя или свиты даёт +6% скорости атаки на 5 секунд и обновляет таймер. Периодический и другой непрямой урон не считается. Формальный потолок — +60%.<br><b>Порог:</b> при достижении не менее +40% начинается «Остывание» на 5 секунд. Из-за шага 6% оно обычно запускается на +42%.<br><b>Остывание:</b> текущий бонус продолжает действовать, но новые удары не добавляют стаки и не обновляют время. Все заряды рывка сразу становятся равны нулю, первый заряд начинает полный обычный откат; дополнительные заряды затем восстанавливаются последовательно.<br><b>Сброс:</b> через 5 секунд бонус и Остывание заканчиваются, после чего накопление начинается заново. Все состояния постоянно показаны индикатором слева снизу.", "<b>Availability:</b> a keystone for all four classes; this card is unique.<br><b>Build-up:</b> every direct attack hit by the hero or a minion that actually deals damage grants +6% Attack Speed for 5 seconds and refreshes the timer. Damage over time and other indirect damage do not count. The formal cap is +60%.<br><b>Threshold:</b> reaching at least +40% starts 5 seconds of Cooling. With 6% steps, it normally begins at +42%.<br><b>Cooling:</b> the current bonus remains active, but new hits cannot add stacks or refresh its duration. All Dash charges immediately become zero, the first charge starts a full normal cooldown, and additional charges then recover sequentially.<br><b>Reset:</b> after 5 seconds, both the bonus and Cooling end and build-up can begin again. Every state is always shown in the lower-left indicator."],
  ["Живая крепость", "Living Fortress"], ["Броня усиливается на 30%, Шипы получают ×2, каждый третий взмах даёт барьер 3% максимального HP. Скорость передвижения снижается на 30%, скорость атаки — на 20%, Уворот становится равен нулю.", "Armor is increased by 30%, Thorns are doubled, and every third swing grants a barrier equal to 3% of Maximum Health. Movement Speed is reduced by 30%, Attack Speed by 20%, and Evasion becomes zero."],
  ["<b>Класс:</b> кейстоун выпадает только Воину; карточка одноразовая.<br><b>Защита:</b> вся числовая броня, включая «Стальную толпу», умножается на 1,3; итоговая сила Шипов умножается на 2.<br><b>Барьер:</b> каждый третий взмах, то есть штатная круговая волна, поднимает барьер минимум до 3% максимального HP. Более крупный уже активный барьер не уменьшается.<br><b>Цена:</b> ×0,70 к скорости передвижения, ×0,80 к скорости атаки и полный запрет Уворота.<br><b>Совместимость:</b> если также взят «Клинок без ножен», его жёсткое обнуление брони имеет приоритет.", "<b>Class:</b> Warrior-only keystone; this card is unique.<br><b>Defense:</b> all numerical Armor, including Steel Crowd, is multiplied by 1.3; final Thorns strength is doubled.<br><b>Barrier:</b> every third swing—the standard circular wave—raises the barrier to at least 3% of Maximum Health. A larger active barrier is not reduced.<br><b>Price:</b> ×0.70 Movement Speed, ×0.80 Attack Speed, and Evasion is completely disabled.<br><b>Compatibility:</b> if Unsheathed Blade is also taken, its hard Armor removal takes priority."],
  ["Клинок без ножен", "Unsheathed Blade"], ["Дальность и дуга ближней атаки умножаются на 1,5, урон ближнего боя — на 1,4. Вся броня из бонусов, карточек и магазина становится равна нулю; Панцирь от роя сохраняется.", "Melee reach and arc are multiplied by 1.5, and melee damage by 1.4. All Armor from bonuses, cards, and the Store becomes zero; Swarm Carapace is preserved."],
  ["<b>Класс:</b> кейстоун выпадает только Воину; карточка одноразовая.<br><b>Атака:</b> итоговые дальность и дуга ближней атаки умножаются на 1,5; весь урон воинских ближних атак и способностей получает отдельный множитель ×1,4.<br><b>Цена:</b> числовая броня из уровней, подкласса, карточек, предметов и плоской покупки магазина становится равна нулю. Отдельная процентная покупка магазина «Броня» также отключается.<br><b>Сохраняется:</b> «Панцирь от роя» продолжает вычитать своё плоское значение из каждого входящего удара.<br><b>Совместимость:</b> обнуление брони имеет приоритет над усилением «Живой крепости».", "<b>Class:</b> Warrior-only keystone; this card is unique.<br><b>Attack:</b> final melee reach and arc are multiplied by 1.5; all Warrior melee attacks and abilities gain a separate ×1.4 multiplier.<br><b>Price:</b> numerical Armor from levels, subclass, cards, items, and the flat Store upgrade becomes zero. The separate percentage Store Armor upgrade is also disabled.<br><b>Preserved:</b> Swarm Carapace continues subtracting its flat value from every incoming hit.<br><b>Compatibility:</b> Armor removal takes priority over Living Fortress's Armor bonus."],
  ["Остывание", "Cooling"], ["готово", "ready"], ["рывки", "Dashes"], ["заряд через", "charge in"],
  ["Открытая рана", "Open Wound"], ["Повторный прямой ближний удар по той же цели в течение 1 сек получает дополнительный урон. До 5 стаков на каждой цели.", "A repeated direct melee hit against the same target within 1 sec gains additional damage. Up to 5 stacks on each target."],
  ["брони", "Armor"], ["Глухая оборона", "Hold the Line"], ["урон уменьшен на", "damage reduced by"],
  ["скорости атаки", "Attack Speed"], ["с осталось", "s remaining"], ["Стоит на месте", "Standing Still"], ["Враги рядом", "Nearby Enemies"],
  ["В движении", "Moving"], ["Недавнее убийство", "Recent Kill"], ["урон", "damage"],
  ["Критический прицел", "Critical Aim"], ["к шансу критического удара", "Critical Hit Chance"],
  ["восстановление 5% HP через", "5% HP recovery in"], ["шанса критического удара", "Critical Hit Chance"],
  ["барьер на", "barrier"],
  ["скорости", "Speed"],
  ["Разгон", "Momentum"],
  ["Дальний полёт", "Long Flight"], ["+8–14% времени жизни и максимальной дальности стрел. Без потолка. Радиус автозахвата увеличивается вместе с фактической дальностью стрелы.", "+8–14% arrow lifetime and maximum range. No cap. Target acquisition range increases with the arrow's actual range."],
  ["Разогнанные стрелы", "Accelerated Arrows"], ["Стрела, летевшая не меньше 0,35 сек, наносит +6–11% урона. Значения складываются без потолка; близкие попадания бонуса не получают.", "An arrow that has flown for at least 0.35 sec deals +6–11% damage. Values stack without a cap; close-range hits gain no bonus."],
  ["СТРЕМИТЕЛЬНЫЕ СТРЕЛЫ", "SWIFT ARROWS"], ["Стрела, летевшая не меньше 0,40 сек, гарантированно отбрасывает противника и наносит +20% дополнительного урона.", "An arrow that has flown for at least 0.40 sec is guaranteed to knock the enemy back and deals +20% additional damage."],
  ["Чистая траектория", "Clean Trajectory"], ["Первое попадание исходной стрелы наносит +5–9% урона. Отскоки, пробитые и повторные цели бонуса не получают. Без потолка.", "The original arrow's first hit deals +5–9% damage. Bounces, pierced targets, and repeated targets gain no bonus. No cap."],
  ["ЭЛЕМЕНТАЛЬНОЕ ПРОБИТИЕ", "ELEMENTAL PENETRATION"], ["Первое попадание исходной стрелы имеет удвоенные текущие шансы поджога, охлаждения, отравления и разряда.", "The original arrow's first hit has double the current chances to Ignite, Chill, Poison, and Shock."],
  ["Оперение охотника", "Hunter Fletching"], ["+7–12% скорости стрел и +3–5% силы самонаведения. Оба значения складываются без потолка.", "+7–12% arrow speed and +3–5% homing strength. Both values stack without a cap."],
  ["Раздвоенная стрела", "Split Arrow"], ["После первого попадания исходная стрела выпускает две боковые стрелы с силой 22% обычной атаки. Они не пробивают, не отскакивают и не делятся снова.", "After its first hit, the original arrow releases two side arrows at 22% of normal Attack Damage. They cannot Pierce, Chain, or split again."],
  ["Возвратный выстрел", "Returning Shot"], ["Каждая тринадцатая стрела после завершения прямого пути возвращается к герою и наносит задетым врагам 30% урона обычной атаки. Обратный путь не повторяет отскоки и может накладывать стихийные состояния.", "Every thirteenth arrow returns to the hero after completing its outward path and deals 30% of normal Attack Damage to enemies it touches. The return path cannot repeat Chains and can apply elemental ailments."],
  ["Метка охотника", "Hunter's Mark"], ["Каждая шестая стрела помечает цель на 4 секунды. Лучник наносит отмеченной цели +15% урона, а шансы поджечь, охладить, отравить и шокировать её удваиваются. Одновременно действуют не более двух меток.", "Every sixth arrow marks its target for 4 seconds. The Archer deals +15% damage to marked targets, and the chances to Ignite, Chill, Poison, and Shock them are doubled. No more than two marks can be active at once."],
  ["Зеркальный залп", "Mirror Volley"], ["Каждый пятый залп повторяется через 0,1 секунды призрачными стрелами с 45% урона. Призрачные стрелы наследуют направления исходного залпа, но не создают новый Зеркальный залп.", "Every fifth volley repeats after 0.1 seconds with spectral arrows dealing 45% damage. Spectral arrows inherit the original volley's directions but cannot create another Mirror Volley."],
  ["<b>Класс:</b> выпадает только Лучнику; фиолетовая одноразовая карта.<br><b>Период:</b> каждый пятый залп героя. Количество стрел и их направления запоминаются в момент выстрела.<br><b>Повтор:</b> через 0,1 секунды из текущей позиции героя вылетает по одной призрачной стреле в каждом сохранённом направлении. Каждая наносит 45% урона обычной стрелы.<br><b>Механика:</b> призрачные стрелы остаются снарядами Лучника и используют его текущие свойства стрел.<br><b>Ограничение:</b> повтор не считается новым залпом, не двигает счётчик и не может создать ещё один Зеркальный залп. Карточка уникальная.", "<b>Class:</b> Archer only; a purple one-time card.<br><b>Period:</b> every fifth hero volley. Its arrow count and directions are captured when fired.<br><b>Repeat:</b> after 0.1 seconds, one spectral arrow launches from the hero's current position along each saved direction. Each deals 45% of a normal arrow's damage.<br><b>Mechanics:</b> spectral arrows remain Archer projectiles and use the Archer's current arrow properties.<br><b>Limit:</b> the repeat is not a new volley, does not advance the counter, and cannot create another Mirror Volley. This card is unique."],
  ["Техника одной стрелы", "One Arrow Technique"], ["Единственная стрела получает ×2,4 урона, +3 пробития и не теряет урон на отскоках. Число снарядов всегда равно 1; «Дробовик» и «Раздвоенная стрела» отключаются.", "The single arrow gains ×2.4 damage, +3 Pierce, and does not lose damage on Chains. Projectile count is always 1; Shotgun and Split Arrow are disabled."],
  ["<b>Класс:</b> выпадает только Лучнику; оранжевый одноразовый кейстоун.<br><b>Единственная стрела:</b> итоговое число снарядов каждой атаки всегда равно 1, даже если дополнительные стрелы уже были собраны.<br><b>Урон:</b> стрела получает отдельный множитель ×2,4. Зеркальный залп и возвратный выстрел сохраняются и наносят свои 45% и 30% уже от усиленной стрелы.<br><b>Пробитие:</b> к итоговому числу пробиваемых целей добавляется 3.<br><b>Отскоки:</b> обычные отскоки больше не уменьшают урон на 25%; Перчатки рикошета по-прежнему могут усиливать его.<br><b>Отключается:</b> «Дробовик» и «Раздвоенная стрела» не действуют; карточки дополнительных снарядов и раздвоения после выбора кейстоуна больше не предлагаются.", "<b>Class:</b> Archer only; an orange one-time keystone.<br><b>Single arrow:</b> the final projectile count of every attack is always 1, even if additional arrows were already collected.<br><b>Damage:</b> the arrow gains a separate ×2.4 multiplier. Mirror Volley and Return Shot remain active and deal their 45% and 30% of the empowered arrow.<br><b>Pierce:</b> 3 is added to the final number of targets the arrow can pierce.<br><b>Chains:</b> normal Chains no longer reduce damage by 25%; Ricochet Gloves can still increase it.<br><b>Disabled:</b> Shotgun and Split Arrow have no effect; additional-projectile and Split Arrow cards are no longer offered after taking the keystone."],
  ["МЕТКА", "MARK"],
  ["Сердце взрыва", "Heart of the Blast"], ["Враги во внутренней половине радиуса сферы получают +5–9% урона взрыва. Значения складываются без потолка; прямое попадание не усиливается.", "Enemies within the inner half of the orb radius take +5–9% explosion damage. Values stack without a cap; the direct hit is not increased."],
  ["ЭЛЕМЕНТАЛЬНЫЙ ВЗРЫВ", "ELEMENTAL EXPLOSION"], ["Взрыв сферы имеет удвоенные текущие шансы поджечь, охладить или заморозить, отравить и шокировать каждого задетого врага. Прямое попадание не усиливается.", "The orb explosion has double your current chances to Ignite, Chill or Freeze, Poison, and Shock each affected enemy. The direct hit is not increased."],
  ["Остаточная аркана", "Residual Arcana"], ["После взрыва его область остаётся активной на 0,5 сек и один раз наносит каждому находящемуся или вошедшему врагу 3–5% урона сферы. Без потолка.", "After the explosion, its area remains active for 0.5 sec and deals 3–5% of the orb's damage once to each enemy already there or entering it. No cap."],
  ["Перегретая сфера", "Overheated Orb"], ["Взрыв, задевший минимум 3 врагов, добавляет скорость атаки на 1,5 сек. Бонус повторных взрывов складывается до +300%, новый прок обновляет таймер.", "An explosion that hits at least 3 enemies adds Attack Speed for 1.5 sec. Repeated explosions stack the bonus up to +300%, and a new proc refreshes the timer."],
  ["Дальний подрыв", "Remote Detonation"], ["Только после изучения этого навыка сфера, пролетевшая больше 250 единиц, становится фиолетовой и получает +6–10% урона взрыва. Без навыка дальние сферы остаются синими. Значения складываются без потолка; мини-сфера считает собственный путь.", "Only after learning this skill, an orb that has traveled more than 250 units turns purple and gains +6–10% explosion damage. Without the skill, long-traveled orbs remain blue. Values stack without a cap; each mini-orb tracks its own distance."],
  ["Арканная мина", "Arcane Mine"], ["Сфера, никого не задевшая до конца полёта, оставляет на 3 секунды Арканную мину. Первый вошедший враг взрывает её: радиус равен обычному взрыву этой сферы, а урон — 45% от него. Мина срабатывает один раз, применяет защиту каждой цели и обычные шансы поджога, охлаждения, отравления и шока.", "An orb that hits nobody before the end of its flight leaves an Arcane Mine for 3 seconds. The first enemy to enter detonates it: its radius matches that orb's normal explosion and it deals 45% of that explosion's damage. The mine triggers once, applies each target's defenses, and uses the normal Ignite, Chill, Poison, and Shock chances."],
  ["Повторная детонация", "Repeat Detonation"], ["Через 0,25 секунды после взрыва сферы происходит второй взрыв радиусом 70%. Каждая цель, задетая первым взрывом и оставшаяся в уменьшенной области, получает 20% фактически снятого у неё первым взрывом HP. Второй взрыв не повторяется.", "0.25 seconds after an orb explodes, a second explosion occurs at 70% radius. Each target hit by the first explosion and still inside the smaller area takes 20% of the Health actually removed from it by the first explosion. The second explosion cannot repeat."],
  ["секунд", "seconds"],
  ["Стихии", "Elements"],
  ["БАРЬЕР СТРАЖА", "GUARDIAN BARRIER"],
  ["МАГ РАЗРУШЕНИЯ", "DESTRUCTION MAGE"], ["+1% ко всем радиусам за уровень. Как и любой Маг, получает +1 снаряд каждые 15 уровней.", "+1% to all radii per level. Like every Mage, gains +1 projectile every 15 levels."],
  ["МАГ МУЛЬТИПЛИКАЦИИ", "MULTIPLICATION MAGE"], ["Каждая обычная сфера имеет 35% шанс через 0,1 сек выпустить вслед за собой мини-сферу с −80% урона и радиусом взрыва 60% от обычного. Как и любой Маг, получает +1 снаряд каждые 15 уровней.", "Each normal orb has a 35% chance to release a trailing mini-orb 0.1 sec later, with 80% less damage and 60% of the normal explosion radius. Like every Mage, gains +1 projectile every 15 levels."],
  ["МАГ ЭЛЕМЕНТАЛИСТ", "ELEMENTALIST MAGE"], ["+3% к урону огнём, холодом, молнией и ядом за уровень. Как и любой Маг, получает +1 снаряд каждые 15 уровней.", "+3% Fire, Cold, Lightning, and Poison damage per level. Like every Mage, gains +1 projectile every 15 levels."],
  ["ГРАБИТЕЛЬ МОГИЛ", "GRAVE ROBBER"], ["+1% скорости персонажа и свиты за уровень.", "+1% character and minion speed per level."],
  ["АНИМАТОР", "ANIMATOR"], ["+1 дополнительный скелет каждые 20 уровней.", "+1 additional Skeleton every 20 levels."],
  ["ВЕНОМАНСЕР", "VENOMANCER"], ["Павший миньон оставляет кислоту на 2 сек: 5% текущего HP цели в секунду.", "A fallen minion leaves acid for 2 sec, dealing 5% of the target's current HP per second."],
  ["КНИГА ОГНЯ", "BOOK OF FIRE"], ["+N урона огнём всем атакам — вашим и свиты. При срабатывании поджигает: 20% от удара в секунду, 3 сек, стакается", "+N Fire damage to all your and your minions' attacks. On proc, Ignites for 20% of the hit per second for 3 sec; stacks"],
  ["КНИГА ЛЬДА", "BOOK OF ICE"], ["+N урона холодом всем атакам. При срабатывании охлаждает на 0,5 сек и наносит ещё 10% удара", "+N Cold damage to all attacks. On proc, Chills for 0.5 sec and deals another 10% of the hit"],
  ["КНИГА МОЛНИИ", "BOOK OF LIGHTNING"], ["+N урона молнией всем атакам — вашим и свиты. При срабатывании накладывает Шок на 1 секунду и выпускает обычный электрический разряд", "+N Lightning damage to all your and your minions' attacks. On proc, applies Shock for 1 second and releases a normal lightning discharge"],
  ["КНИГА ЯДА", "BOOK OF POISON"], ["При срабатывании травит: N урона каждые 0.25 сек, 3 сек, стакается. Масштабируется процентами к яду и к урону", "On proc, Poisons for N damage every 0.25 sec for 3 sec; stacks. Scales with increased Poison and all Damage"],
  ["КНИГА КРОВИ", "BOOK OF BLOOD"], ["При срабатывании вызывает кровотечение: N% от автоатаки в секунду, 4 сек, стакается", "On proc, causes Bleeding for N% of the basic attack per second for 4 sec; stacks"],
  ["КНИГА МОНСТРОВ", "BOOK OF MONSTERS"], ["+N% врагов в последующих волнах. Больше целей — больше опыта, золота и книг. Стакается без предела", "+N% enemies in future waves. More targets mean more experience, gold, and books. Stacks without limit"],
  ["КНИГА ОПЫТА", "BOOK OF EXPERIENCE"], ["+N% к получаемому опыту. Стакается без предела", "+N% experience gained. Stacks without limit"],
  ["АМУЛЕТ", "AMULET"], ["ПЕРЧАТКИ", "GLOVES"], ["БОТИНКИ", "BOOTS"], ["КОЛЬЦО", "RING"], ["РЕЛИКВИЯ", "RELIC"],
  ["МАЛЫЙ", "MINOR"], ["СРЕДНИЙ", "MEDIUM"], ["БОЛЬШОЙ", "MAJOR"], ["ВЕЛИКИЙ", "GRAND"],
  ["ТОТЕМ ОГНЯ", "TOTEM OF FIRE"], ["горящим", "burning"], ["ТОТЕМ ЗАМОРОЗКИ", "TOTEM OF FREEZING"], ["замороженным", "frozen"],
  ["ТОТЕМ ОТРАВЛЕНИЯ", "TOTEM OF POISONING"], ["отравленным", "poisoned"], ["ТОТЕМ КРОВИ", "TOTEM OF BLOOD"], ["кровоточащим", "bleeding"],
  ["ТОТЕМ МОЛНИИ", "TOTEM OF LIGHTNING"], ["шокированным", "shocked"],
].concat(EN_ITEMS, EN_WORLD, EN_UI_PAIRS)));

function tr(value){
  if (LANGUAGE === 'ru' || typeof value !== 'string' || !/[А-Яа-яЁё]/.test(value)) return value;
  const exact = EN_TEXT[value];
  if (exact) return exact;
  let out = value;
  for (const pair of EN_PARTS) out = out.split(pair[0]).join(pair[1]);
  return out;
}

const EN_PARTS = Object.entries(EN_TEXT)
  .filter(pair => pair[0].length <= 80 && /[А-Яа-яЁё]/.test(pair[0]))
  .sort((a,b) => b[0].length - a[0].length);

function localizeTree(root){
  if (LANGUAGE !== 'en' || !root || typeof document === 'undefined') return;
  const visit = node => {
    if (node.nodeType === 3){
      const translated = tr(node.nodeValue);
      if (translated !== node.nodeValue) node.nodeValue = translated;
      return;
    }
    if (node.nodeType !== 1) return;
    for (const attr of ['title','placeholder','aria-label']){
      if (node.hasAttribute && node.hasAttribute(attr)){
        const before = node.getAttribute(attr), after = tr(before);
        if (after !== before) node.setAttribute(attr, after);
      }
    }
    for (const child of [...node.childNodes]) visit(child);
  };
  visit(root);
}

function setLanguage(next){
  LANGUAGE = next === 'ru' ? 'ru' : 'en';
  try{ localStorage.setItem(LANGUAGE_KEY, LANGUAGE); }catch(e){}
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = LANGUAGE;
  // Переключатель доступен только в главном меню. Перезагрузка восстанавливает
  // исходные русские DOM-узлы перед применением выбранного языка и не затрагивает забег.
  if (typeof location !== 'undefined' && location.reload) location.reload();
  else { startScreen(); localizeTree(document.body); }
}

function languageSwitchHtml(){
  return '<div class="language-switch" role="group" aria-label="Language">' +
    '<button type="button" data-language="en" class="' + (LANGUAGE === 'en' ? 'active' : '') + '" aria-label="English"><i class="language-flag flag-en"></i><b>EN</b></button>' +
    '<button type="button" data-language="ru" class="' + (LANGUAGE === 'ru' ? 'active' : '') + '" aria-label="Русский"><i class="language-flag flag-ru"></i><b>RU</b></button></div>';
}

function bindLanguageSwitch(){
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-language]').forEach(el => el.onclick = () => setLanguage(el.dataset.language));
}

/* Английская карточка сохраняет формулу и ограничения, но строится из уже
   переведённых декларативных данных. Так новая карточка получает понятную
   подсказку сразу после добавления nm/nt/tip в билингвальный реестр. */
function englishSkillTip(m, card){
  const shown = card && card.val ? card.val : (m.kind === 'flag' ? 'property' : 'value');
  const exclusive = ['shape.pierce','shape.chain','shape.ricochet'].includes(m.id)
    ? '<div class="tt-exclusive">Choosing one of Pierce, Chains, or Shard Ricochet permanently removes the other two branches from this run.</div>' : '';
  const unburdened = m.id === 'key.no_defense_speed'
    ? '<div class="tt-exclusive">Warning: all Armor from the shop, talents, skills, and items becomes zero. Steel Crowd can no longer appear.</div>' : '';
  const specific = m.tip || m.nt;
  const effect = specific ? '<b>Effect:</b> ' + tr(specific) + '<br>' : '';
  const formula = {
    flat:'<b>Stacking:</b> the value is added directly before percentage bonuses.',
    inc:'<b>Stacking:</b> added to other increased percentages, then applied to the base value.',
    more:'<b>Stacking:</b> added to a shared more bucket, which is applied once after increased percentages.',
    chance:'<b>Roll:</b> an independent chance on every eligible event.',
    flag:'<b>Duration:</b> this unique property remains active until the end of the current run.'
  }[m.kind] || '';
  const limits = m.cap !== undefined ? '<br><b>Limit:</b> capped at ' + m.cap + '%; the card then leaves the pool.' :
    (m.hide ? '<br><b>Limit:</b> the card leaves the pool when its mechanical cap is reached.' : '');
  const minions = m.req === 'min' ? '<br><b>Class:</b> available only to a minion-based class.' :
    (m.noMin ? '<br><b>Minions:</b> does not affect minions.' : '');
  return unburdened + exclusive + effect + '<b>This card:</b> ' + shown + '<br>' + formula + limits + minions;
}

function localizationMissing(){
  const rows = [];
  const add = value => { if (typeof value === 'string' && /[А-Яа-яЁё]/.test(value) && !EN_TEXT[value]) rows.push(value); };
  const scan = list => (list || []).forEach(item => ['cat','nm','nt','desc','tip','st','sub'].forEach(field => add(item && item[field])));
  scan(typeof MODS === 'undefined' ? [] : MODS);
  scan(typeof WEAPONS === 'undefined' ? [] : Object.values(WEAPONS));
  scan(typeof SUBCLASSES === 'undefined' ? [] : Object.values(SUBCLASSES).flat());
  scan(typeof BOOKS === 'undefined' ? [] : Object.values(BOOKS));
  scan(typeof AMULETS === 'undefined' ? [] : Object.values(AMULETS));
  scan(typeof TOTEMS === 'undefined' ? [] : Object.values(TOTEMS));
  scan(typeof CONSTELLATIONS === 'undefined' ? [] : CONSTELLATIONS);
  scan(typeof SHOP === 'undefined' ? [] : SHOP);
  scan(typeof ETYPES === 'undefined' ? [] : Object.values(ETYPES));
  scan(typeof BOSS_TYPES === 'undefined' ? [] : Object.values(BOSS_TYPES));
  scan(typeof BOSS_AFFIXES === 'undefined' ? [] : BOSS_AFFIXES);
  scan(typeof PACK_AFFIXES === 'undefined' ? [] : PACK_AFFIXES);
  scan(typeof MKIND === 'undefined' ? [] : Object.values(MKIND));
  scan(typeof CONTROLS === 'undefined' ? [] : Object.values(CONTROLS));
  return [...new Set(rows)];
}

if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = LANGUAGE;
if (typeof MutationObserver !== 'undefined'){
  const languageObserver = new MutationObserver(records => {
    if (LANGUAGE !== 'en') return;
    for (const record of records){
      if (record.type === 'characterData') localizeTree(record.target);
      else for (const node of record.addedNodes) localizeTree(node);
    }
  });
  languageObserver.observe(document.body, {subtree:true, childList:true, characterData:true});
  localizeTree(document.body);
}

/* ==================================================================
   Grim Grind — top-down action RPG (рабочее название проекта: PolyGrind)
   Смесь Diablo 2 (лут-система заменена на модификаторы) и аренного гриндера.
   Вся прокачка построена на каталоге из 947 модификаторов:
   каждая карточка при повышении уровня — реальная запись из stats.csv
   со своим id, категорией и типом (flat / inc / more / chance / flag).
   ================================================================== */
