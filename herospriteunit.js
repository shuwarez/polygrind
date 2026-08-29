/* Компактные листы героев: только медленная ходьба, встраивание и направление. */
const fs = require('fs'), crypto = require('crypto');
const {loadGame} = require('./sim');
const html = fs.readFileSync('./PolyGrind.html','utf8');
const optimizer = fs.readFileSync('./optimize_graphics.py','utf8');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(54) + (det||''));

const expected = {
  archer:['EBC31320BC2160D8BB806CEACD77D5E267255DBCFE439A208C3059A0D8025523',1232],
  mage:['DF2C27081F547F9056BF9CD21E1658FD1B9E3C6C286EFE1ECA602F91FEFD5B1B',1211],
  warrior:['362E76C130E2F217EFB68F8E0C2B8E6844653240472A5B546461F1A89757E31E',1300],
  necromancer:['AC7E6339EFD6B73FA75D5EFAA469CAAE0F53DD62720692E324DBEF3A52FE90C7',1197],
};
for (const [key,[wantedHash,wantedBytes]] of Object.entries(expected)){
  const m=html.match(new RegExp(key+":'data:image/png;base64,([^']+)'"));
  const png=m && Buffer.from(m[1],'base64');
  const dims=png && png.readUInt32BE(16)+'x'+png.readUInt32BE(20);
  const hash=png && crypto.createHash('sha256').update(png).digest('hex').toUpperCase();
  ok(key+': индексированный лист 4×1 по 32 px встроен', !!png && dims==='128x32' && png.length===wantedBytes,
    (dims||'нет')+' · '+(png?png.length:0)+' Б');
  ok(key+': точные новые пиксели', hash===wantedHash, hash||'нет данных');
}

ok('метаданные задают четыре листа по 32×32 и вывод 48×48',
  (html.match(/frameW:32,frameH:32,drawW:48,drawH:48/g)||[]).length===4);
ok('рендер использует только один ряд ходьбы без действий',
  html.includes("frame*meta.frameW, 0") && !html.includes('heroAttackT') && !html.includes('heroSummonT'));
ok('превью меню берёт один кадр без копии PNG',
  html.includes("heroPreviewHTML(spriteKey, 'class-sprite')") && html.includes('background-size:400% 100%'));

const logoMatch=html.match(/GRIM_GRIND_LOGO_STRIP\.src = 'data:image\/png;base64,([^']+)'/);
const logoPng=logoMatch && Buffer.from(logoMatch[1],'base64');
const logoHash=logoPng && crypto.createHash('sha256').update(logoPng).digest('hex').toUpperCase();
const torchMatch=html.match(/GRIM_GRIND_TORCH_STRIP\.src = 'data:image\/png;base64,([^']+)'/);
const torchPng=torchMatch && Buffer.from(torchMatch[1],'base64');
const torchHash=torchPng && crypto.createHash('sha256').update(torchPng).digest('hex').toUpperCase();
ok('официальное имя Grim Grind стоит в title и доступном имени логотипа',
  html.includes('<title>Grim Grind</title>') && html.includes('aria-label="Grim Grind"') &&
  !html.includes("fillText('PolyGrind'"));
ok('оптимизированный прозрачный лист нового логотипа встроен в HTML',
  !!logoPng && logoPng.length===20355 && logoHash==='806942D5DDCC55DE543A22D35AEE5F9A5B0A2722AD997A18AB35081477EB1624',
  (logoPng?logoPng.length:0)+' Б · '+(logoHash||'нет'));
ok('лист логотипа сжат до 2048×96 и восьми кадров 256×96',
  !!logoPng && logoPng.readUInt32BE(16)===2048 && logoPng.readUInt32BE(20)===96 &&
  html.includes("{w:256,h:96,count:8,fps:5}"));
ok('лист факела сжат до 576×192, прозрачен и встроен один раз',
  !!torchPng && torchPng.length===6469 && torchHash==='F3FF6456E62B5452FE2B56B67258C9F56F0F2F80DC66C681B8558CB9524BDB55' &&
  torchPng.readUInt32BE(16)===576 && torchPng.readUInt32BE(20)===192 &&
  html.includes("{w:72,h:192,count:8,fps:8}"),
  (torchPng?torchPng.length:0)+' Б · '+(torchHash||'нет'));
ok('меню анимирует свет неподвижного логотипа и огонь двух факелов',
  html.includes('Math.floor(tm*GRIM_GRIND_LOGO_FRAME.fps) % GRIM_GRIND_LOGO_FRAME.count') &&
  html.includes('Math.floor(tm*GRIM_GRIND_TORCH_FRAME.fps) % GRIM_GRIND_TORCH_FRAME.count') &&
  html.includes('drawBrandTitle(t);') && html.includes('drawBrandTorches(t);') &&
  html.includes('id="brandtorchl"') && html.includes('id="brandtorchr"') &&
  html.includes('#brandnm{display:block;width:clamp(390px,45vw,510px)') &&
  html.includes('.brandtorch{display:block;width:clamp(38.4px,4vw,51.2px)') &&
  html.includes('#brandtorchr{transform:scaleX(-1)}') &&
  (html.match(/__brandFrame === frame/g)||[]).length===2 &&
  (html.match(/globalCompositeOperation ?= ?['"]copy['"]/g)||[]).length===2 &&
  optimizer.includes('def stable_logo_frames') && optimizer.includes('def stable_torch_frames') &&
  optimizer.includes('body = master.copy()') && optimizer.includes('compact_stable_sheet'));
ok('системное отключение анимаций оставляет первые кадры вывески',
  html.includes("matchMedia('(prefers-reduced-motion: reduce)').matches") &&
  (html.match(/const frame = reducedMenuMotion\(\) \? 0 :/g)||[]).length===2);

{
  const c=loadGame('./PolyGrind.html'); c.startScreen();
  const menu=c.document.getElementById('ov').innerHTML;
  ok('меню показывает четыре чистые карточки без служебных пояснений',
    (menu.match(/class="card class-card"/g)||[]).length===4 && !menu.includes('wpn.') &&
    !menu.includes('<div class="cat">') && !menu.includes('<div class="vl">') &&
    !menu.includes('choose one of four classes') && !menu.includes('Each level-up offers a choice of') &&
    !menu.includes('flat values add together'));
}
ok('в карточке сначала название, затем крупная модель и короткое описание',
  /'<div class="nm">' \+ w\.nm \+ '<\/div>' \+\s*heroPreviewHTML\(spriteKey, 'class-sprite'\) \+\s*'<div class="nt">' \+ w\.desc \+ '<\/div>'/.test(html));
ok('название, модель и описание героя центрируются стилями витрины',
  /\.card\.class-card\{[^}]*align-items:center;[^}]*text-align:center/.test(html) &&
  /\.class-card \.class-sprite\{position:relative;width:150px;height:150px/.test(html));
ok('описания классов короткие и не содержат внутренних имён параметров',
  Object.values(loadGame('./PolyGrind.html').__api.WEAPONS).every(w=>w.desc.length<110 && !/wpn\.|min\.\*/.test(w.desc)));

function game(key){
  const c=loadGame('./PolyGrind.html'); c.newGame(key,'keys');
  const G=c.__api.G; G.pending=0; G.spawnQueue=0; G.enemies.length=0;
  return {c,G,p:G.player};
}
for (const key of ['bow','wand','blade']){
  const o=game(key); o.c.attack();
  ok(key+': автоатака не создаёт таймер анимации', o.p.heroAttackT===undefined && o.p.heroAttackDur===undefined);
}
{
  const o=game('bow'); o.G.keys.d=true; o.c.update(0.1);
  ok('движение продвигает замедленный четырёхкадровый цикл', o.p.moving && o.p.heroWalkT>0 && o.p.heroWalkT<2,
    o.p.heroWalkT.toFixed(2));
}
{
  const o=game('wand');
  ok('скорость ходьбы уменьшена вдвое до 36 единиц на кадр', html.includes('heroMoved/36'));
}
{
  const o=game('blade'), e=o.c.spawnEnemy(); e.x=-80; e.y=0; e.spd=0; e.dmg=0; o.c.update(1/60);
  ok('герой зеркалится к цели слева', o.p.spriteFace===-1);
}
{
  const o=game('necro'); o.c.spawnMinion(undefined,undefined,'skeleton');
  ok('Некромант не создаёт таймер анимации призыва', o.p.heroSummonT===undefined && o.p.heroSummonDur===undefined);
  o.c.spawnMinion(undefined,undefined,'skeleton');
  ok('серия призывов не добавляет скрытых таймеров', o.p.heroSummonT===undefined && o.p.heroSummonDur===undefined);
}
ok('новые герои не требуют внешних runtime-assets',
  !/\b(?:src|href)=["'](?:\.\/|assets\/).*\.(?:png|webp|jpg)/i.test(html));
ok('отрицательный RAF-delta не ломает кольцо призыва',
  html.includes('Math.max(0, Math.min(0.05, (now - last)/1000))'));
