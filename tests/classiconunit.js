/* Классовые пиктограммы карточек: точное совпадение с реальным фильтром пула. */
const fs = require('fs');
const {loadGame} = require('./harness');
const c = loadGame('./index.html');
const mods = c.__api.MODS;
const byId = id => mods.find(m => m.id === id);
const keys = id => Array.from(c.allowedClassesForMod(byId(id)));
let n=0, fail=0;
function ok(name, yes, got=''){
  n++; if (!yes) fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ') + name.padEnd(70) + got);
}

console.log('Классовые пиктограммы карточек');
const html = require('./harness').loadInspectionSource('./index.html');
ok('единый порядок значков: меч, лук, жезл, череп',
  html.includes("const CARD_CLASS_ORDER = ['blade','bow','wand','necro']"));
ok('универсальная карточка допускает все четыре класса',
  keys('spd.attack').join(',') === 'blade,bow,wand,necro', keys('spd.attack').join(','));
ok('урон ближнего боя помечен только мечом Воина',
  keys('dmg.melee').join(',') === 'blade', keys('dmg.melee').join(','));
ok('шипы помечены только мечом Воина',
  keys('dmg.thorns').join(',') === 'blade', keys('dmg.thorns').join(','));
ok('Арканная иллюзия помечена только жезлом Мага',
  keys('shape.arcane_illusion').join(',') === 'wand', keys('shape.arcane_illusion').join(','));
ok('Радиус области действия доступен только Магу',
  keys('shape.aoe_radius').join(',') === 'wand', keys('shape.aoe_radius').join(','));
ok('карточка свиты помечена только черепом Некроманта',
  keys('min.damage').join(',') === 'necro', keys('min.damage').join(','));
ok('чумной взрыв трупа доступен только Некроманту',
  keys('shape.explode_on_kill').join(',') === 'necro', keys('shape.explode_on_kill').join(','));
ok('дополнительный снаряд с noMin помечен только луком Лучника',
  keys('shape.proj_count').join(',') === 'bow', keys('shape.proj_count').join(','));
ok('обычные отскоки полностью исключены из пула Некроманта',
  keys('shape.chain').join(',') === 'bow', keys('shape.chain').join(','));
ok('пробитие, Сверхпробитие и Осколочный рикошет доступны только Лучнику',
  keys('shape.pierce').join(',') === 'bow' && keys('shape.pierce_bonus').join(',') === 'bow' &&
  keys('shape.ricochet').join(',') === 'bow',
  keys('shape.pierce').join(',') + ' / ' + keys('shape.pierce_bonus').join(',') + ' / ' + keys('shape.ricochet').join(','));
ok('ЭКО-ОТСКОКИ также не возвращают ветку Некроманту',
  keys('shape.chain_retention').join(',') === 'bow', keys('shape.chain_retention').join(','));
ok('скорость снарядов доступна Лучнику и Магу, но не Некроманту',
  keys('shape.proj_speed').join(',') === 'bow,wand', keys('shape.proj_speed').join(','));
ok('урон снарядов помечен только луком Лучника',
  keys('dmg.projectile').join(',') === 'bow', keys('dmg.projectile').join(','));
ok('noMin-карточка без wep показывает всех, кроме Некроманта',
  keys('cond.while_still').join(',') === 'blade,bow,wand', keys('cond.while_still').join(','));

const mageHtml = c.classAvailabilityHtml(byId('shape.arcane_illusion'));
ok('одноклассовая плашка содержит подпись и доступное имя для скринридера',
  mageHtml.includes('class-access-label') && mageHtml.includes('aria-label="MAGE"'));
ok('одноклассовая плашка содержит только нужный SVG-жезл',
  mageHtml.includes('class-icon-mage') && !mageHtml.includes('class-icon-warrior') &&
  !mageHtml.includes('class-icon-archer') && !mageHtml.includes('class-icon-necromancer'));
ok('универсальная карточка не получает визуальный шум',
  c.classAvailabilityHtml(byId('spd.attack')) === '');
c.setLanguage('ru');
const ruHtml = c.classAvailabilityHtml(byId('dmg.melee'));
ok('подпись и tooltip локализуются на русский',
  ruHtml.includes('ДОСТУПНО:') && ruHtml.includes('ВОИН'));
ok('четыре знака являются разными встроенными SVG без внешних файлов',
  ['warrior','archer','mage','necromancer'].every(slug => html.includes("slug:'" + slug + "', icon:'<svg")) &&
  !html.includes('class-icon.png'));

ok('обычная раздача и тестовая панель используют единый фильтр класса',
  html.includes('const fits = m => modFitsWeapon(m, G.weapon)') &&
  html.includes('const compatible = m => modFitsWeapon(m, G.weapon)'));
ok('иконки выводятся и на выпавшей карточке, и в тестовой выдаче',
  c.showLevelUp.toString().includes('classAvailabilityHtml(c.m)') &&
  c.renderTestPanel.toString().includes('classAvailabilityHtml(m)'));

console.log(JSON.stringify({n,fail}));
process.exitCode = fail ? 1 : 0;
