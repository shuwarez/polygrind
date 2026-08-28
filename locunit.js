/* Билингвальный контракт: английский по умолчанию, полный каталог EN/RU и
   переключатель с двумя встроенными CSS-флагами. */
const fs = require('fs');
const {loadGame} = require('./harness');
const file = process.argv[2] || './PolyGrind.html';
const c = loadGame(file);
let n = 0, fail = 0;
function ok(name, yes, got=''){
  n++;
  if (!yes) fail++;
  console.log(yes ? '✓' : '✗', name, got);
}

ok('английский язык используется по умолчанию', c.__api.LANGUAGE === 'en', c.__api.LANGUAGE);
ok('название карточки переводится по канонической русской строке', c.tr('УЖАСАЮЩИЙ ВАМПИР') === 'DREAD VAMPIRE');
ok('длинное описание предмета переведено полностью',
  !/[А-Яа-яЁё]/.test(c.tr('каждые 100 убийств следующий удар убивает цель мгновенно, кем бы она ни была')));
const missing = c.localizationMissing();
ok('у всех полей каталогов есть английская пара', missing.length === 0, missing.slice(0,5).join(' | '));
const sw = c.languageSwitchHtml();
ok('переключатель содержит EN и RU', sw.includes('data-language="en"') && sw.includes('data-language="ru"'));
ok('флаги встроены CSS-геометрией, без внешних ассетов', sw.includes('flag-en') && sw.includes('flag-ru') && !sw.includes('<img'));
const html = fs.readFileSync(file, 'utf8');
ok('выбор языка сохраняется отдельно от мета-прогресса', html.includes("polygrind_language") && html.includes('localStorage.setItem(LANGUAGE_KEY'));
ok('английские подсказки карточек не используют русский подробный текст', html.includes("LANGUAGE === 'en') return englishSkillTip"));
const fullHp = c.__api.MODS.find(m => m.id === 'cond.vs_full_hp');
ok('карточка урона по полному HP содержит локализованный числовой пример',
  fullHp.nt.includes('+30%') && fullHp.nt.includes('100') && fullHp.nt.includes('130') &&
  !/[А-Яа-яЁё]/.test(c.tr(fullHp.nt)));

console.log(JSON.stringify({n, fail}));
process.exitCode = fail ? 1 : 0;
