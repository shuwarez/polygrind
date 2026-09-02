/* Десять бесшовных вариантов пола и независимый выбор на каждом buildFloor(). */
const crypto=require('crypto');
const {loadGame}=require('./harness');
const {imageInfo,runtimeAssetBuffer}=require('./asset_test_utils');
let n=0,fail=0;
function ok(name,yes,got=''){n++;if(!yes)fail++;console.log((yes?'  \u2713 ':'  \u2717 ')+name.padEnd(72)+got);}

const html=require('./harness').loadInspectionSource('./index.html');
let randomCalls=0;
const c=loadGame('./index.html',{random:()=>{randomCalls++;return 0.25;}}),floor=c.__api.FLOOR_TEXTURES;
const expectedNames=['slate','cracked','damp','temple','basalt','iron','ash','crystal','forge','frost'];
const buffers=floor.data.map(reference=>runtimeAssetBuffer(reference));
const embeddedInfo=buffers.map(imageInfo);

ok('подключено ровно десять runtime-вариантов пола',floor.data.length===10,String(floor.data.length));
ok('пять handoff-вариантов и пять авторских имеют стабильные имена',JSON.stringify(floor.names)===JSON.stringify(expectedNames));
ok('все десять runtime-файлов являются WebP',floor.data.every(x=>/^assets\/images\/.*\.webp$/.test(x)));
ok('все изображения уникальны',new Set(buffers.map(x=>crypto.createHash('sha256').update(x).digest('hex'))).size===10);
ok('каждая runtime-текстура имеет точный размер 512x512',embeddedInfo.every(x=>x.w===512&&x.h===512));
ok('runtime-текстуры используют сжатый lossy WebP',embeddedInfo.every(x=>x.format==='webp'&&!x.lossless));
ok('каждый runtime WebP меньше 80 КБ',buffers.every(x=>x.length<80*1024),String(Math.max(...buffers.map(x=>x.length))));

const before=randomCalls;
for(let i=0;i<10;i++){c.__api.selectFloorTexture(i);if(c.__api.FLOOR_TEXTURES.index!==i)fail++;}
ok('принудительный тестовый выбор покрывает индексы 0..9',c.__api.FLOOR_TEXTURES.index===9);
ok('выбор пола не расходует игровой Math.random',randomCalls===before,String(randomCalls-before));
c.__api.selectFloorTexture(-1);
ok('индекс пола безопасно нормализуется по модулю',c.__api.FLOOR_TEXTURES.index===9,String(c.__api.FLOOR_TEXTURES.index));

ok('buildFloor выбирает поверхность ровно один раз в начале',/function buildFloor\(\)\{\s*\/\/[\s\S]{0,180}?selectRandomFloorPattern\(\);/.test(html));
const renderBlock=(html.match(/function renderCanvasPass[\s\S]*?\nfunction render\(/)||[''])[0];
ok('render-pass не пересчитывает выбор поверхности',!renderBlock.includes('selectRandomFloorPattern'));
ok('готовый pattern создаётся только при загрузке изображения',(html.match(/ctx\.createPattern\(/g)||[]).length===1&&/image\.onload = \(\) => \{\s*FLOOR_PATTERNS\[i\] = createFloorPattern\(image\)/.test(html));
ok('при незагруженном выбранном тайле используется первый готовый pattern',/FLOOR_PATTERNS\.findIndex\(Boolean\)/.test(html));
ok('масштабирование тайла сохраняет pixel-perfect режим',/function createFloorPattern[\s\S]{0,420}?imageSmoothingEnabled = false/.test(html));

console.log(JSON.stringify({n,fail}));
process.exitCode=fail?1:0;
