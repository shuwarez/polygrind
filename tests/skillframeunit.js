/* Цветные рамки карточек навыков: точные исходники и адаптивный CSS 9-slice. */
const {imageInfo}=require('./asset_test_utils');

const html = require('./harness').loadInspectionSource('./index.html');
const objectMatch = html.match(/const SKILL_CARD_FRAME_DATA = \{([\s\S]*?)\n\};/);
const entries = Object.fromEntries(Array.from(
  (objectMatch ? objectMatch[1] : '').matchAll(/^\s*(\w+):'data:image\/webp;base64,([^']+)',\s*$/gm),
  match => [match[1], match[2]]));
const buffers = Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, Buffer.from(value, 'base64')]));
let n=0, fail=0;
function ok(name, yes, got=''){
  n++; if (!yes) fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ') + name.padEnd(76) + got);
}

console.log('Рамки карточек навыков');
ok('встроены ровно пять канонических редкостей',
  Object.keys(entries).join(',') === 'common,rare,epic,key,blood', Object.keys(entries).join(','));
ok('каждый lossless WebP сохраняет RGBA-геометрию 304x194',
  Object.values(buffers).every(data => {const info=imageInfo(data);return info.format==='webp'&&info.lossless&&info.alpha&&info.w===304&&info.h===194;}));
ok('lossless-перекодирование сохраняет пять самостоятельных рамок',
  Object.values(buffers).every(data=>imageInfo(data).lossless));
ok('пять уникальных рамок занимают меньше 60 КБ',
  new Set(Object.values(entries)).size === 5 &&
    Object.values(buffers).reduce((sum, data) => sum + data.length, 0) < 60000);
ok('каждый data URI хранится в HTML ровно один раз',
  Object.values(entries).every(value => html.split(value).length === 2));
ok('пять редкостей один раз назначаются пяти CSS-переменным',
  /common:'--skill-frame-common',rare:'--skill-frame-blue',epic:'--skill-frame-purple'/.test(html) &&
  /key:'--skill-frame-orange',blood:'--skill-frame-red'/.test(html) &&
  html.includes("Object.keys(SKILL_CARD_FRAME_CSS_VARS)"));
ok('цветовая карта ограничена карточками экрана уровня',
  html.includes('.level-card-grid .card{--skill-card-frame:var(--skill-frame-common)') &&
  ['blue','purple','orange','red'].every(color => html.includes(`--skill-card-frame:var(--skill-frame-${color})`)));
const pseudo = html.match(/\.level-card-grid \.card::before\{([\s\S]*?)\}/);
ok('рамка использует 9-slice с неподвижными углами',
  !!pseudo && pseudo[1].includes('border-image-slice:20') &&
  pseudo[1].includes('border-image-width:12px') && pseudo[1].includes('border-image-repeat:stretch'));
ok('слой рамки не перехватывает ввод и не создаёт анимацию',
  !!pseudo && pseudo[1].includes('pointer-events:none') &&
  !/animation|filter|transition/.test(pseudo[1]) && html.includes('.level-card-grid .card>*{position:relative;z-index:2}'));
console.log(JSON.stringify({n,fail}));
process.exitCode = fail ? 1 : 0;
