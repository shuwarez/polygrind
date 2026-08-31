/* Цветные рамки карточек навыков: точные исходники и адаптивный CSS 9-slice. */
const fs = require('fs');
const crypto = require('crypto');

const html = fs.readFileSync('./PolyGrind.html', 'utf8');
const optimizer = fs.readFileSync('./optimize_graphics.py', 'utf8');
const expected = {
  common:'2eab5929745b6f85b243502858d277f434b34fd65c8ed0de79ab241a23d759f4',
  rare:'3d87b3d1b08ab572c1f14f85391a702099f6621d9f182acb9f3fb9319e50ad0f',
  epic:'91408d0448ab5e93c2b85634e87750647a34c758e7b1f7f8cbdc408976393606',
  key:'744ac5e0d75a0214231860aedf116f89e774ce25f5567761de632442cead6138',
  blood:'a1b0dedc5cdf3a5cbd2b7f192727e256c7a5bb24809555047b585669169669b0',
};
const objectMatch = html.match(/const SKILL_CARD_FRAME_DATA = \{([\s\S]*?)\n\};/);
const entries = Object.fromEntries(Array.from(
  (objectMatch ? objectMatch[1] : '').matchAll(/^\s*(\w+):'data:image\/png;base64,([^']+)',\s*$/gm),
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
ok('каждый PNG остался RGBA 304x194',
  Object.values(buffers).every(data => data.readUInt32BE(16) === 304 &&
    data.readUInt32BE(20) === 194 && data[25] === 6));
ok('исходные PNG встроены побайтно без перекодирования',
  Object.entries(buffers).every(([key, data]) => crypto.createHash('sha256').update(data).digest('hex') === expected[key]));
ok('пять уникальных рамок занимают исходные 89539 байт',
  new Set(Object.values(entries)).size === 5 &&
    Object.values(buffers).reduce((sum, data) => sum + data.length, 0) === 89539);
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
ok('установщик сверяет hash/размер/alpha и запрещает ресэмплинг',
  optimizer.includes('SKILL_CARD_FRAME_SOURCES = {') &&
  optimizer.includes('image.size != (304, 194) or image.mode != "RGBA"') &&
  optimizer.includes('payload[rarity] = base64.b64encode(data).decode("ascii")') &&
  optimizer.includes('"resampled": False') && optimizer.includes('"nineSlice": True'));

console.log(JSON.stringify({n,fail}));
process.exitCode = fail ? 1 : 0;
