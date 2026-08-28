/* Новые листы героев: ходьба, атака/призыв, встраивание и направление. */
const fs = require('fs'), crypto = require('crypto');
const {loadGame} = require('./sim');
const html = fs.readFileSync('./PolyGrind.html','utf8');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(54) + (det||''));

const expected = {
  archer:['7BDFA0FF50B9D3353B3D9EAC971347766DD957CDFB0E5EE7605503C6ADA2FE27',117720],
  mage:['F065E8649E117D5F9146A48322B341DEA3508FD9E6D641E594B5EAD5EA3E43A6',105448],
  warrior:['8F583D11B2589A8FB1D6A5B19AA9B6BD44B62EBF75490DE4F21E68351E3BC945',121969],
  necromancer:['5C43E1603F7F1892391F27D0BA7F72DAE16410CE9ECC184E715BE980AAD2F921',123322],
};
for (const [key,[wantedHash,wantedBytes]] of Object.entries(expected)){
  const m=html.match(new RegExp(key+":'data:image/png;base64,([^']+)'"));
  const png=m && Buffer.from(m[1],'base64');
  const dims=png && png.readUInt32BE(16)+'x'+png.readUInt32BE(20);
  const hash=png && crypto.createHash('sha256').update(png).digest('hex').toUpperCase();
  ok(key+': компактный лист 4×2 встроен', !!png && dims==='512x256' && png.length===wantedBytes,
    (dims||'нет')+' · '+(png?png.length:0)+' Б');
  ok(key+': точные новые пиксели', hash===wantedHash, hash||'нет данных');
}

ok('метаданные задают четыре листа по 128×128',
  (html.match(/frameW:128,frameH:128,drawW:72,drawH:72/g)||[]).length===4);
ok('рендер выбирает верхний ряд ходьбы и нижний действия',
  html.includes("acting ? meta.frameH : 0") && html.includes("frame*meta.frameW"));
ok('превью меню берёт один кадр без копии PNG',
  html.includes("heroPreviewHTML(spriteKey, 'class-sprite')") && html.includes('background-size:400% 200%'));

function game(key){
  const c=loadGame('./PolyGrind.html'); c.newGame(key,'keys');
  const G=c.__api.G; G.pending=0; G.spawnQueue=0; G.enemies.length=0;
  return {c,G,p:G.player};
}
for (const key of ['bow','wand','blade']){
  const o=game(key); o.c.attack();
  ok(key+': автоатака запускает четыре кадра атаки', o.p.heroAttackT>0 && o.p.heroAttackDur>=0.22,
    o.p.heroAttackDur.toFixed(2)+'с');
}
{
  const o=game('bow'); o.G.keys.d=true; o.c.update(0.1);
  ok('движение продвигает четырёхкадровый цикл ходьбы', o.p.moving && o.p.heroWalkT>0 && o.p.heroWalkT<4,
    o.p.heroWalkT.toFixed(2));
}
{
  const o=game('wand'); o.c.attack(); const before=o.p.heroAttackT; o.c.update(0.05);
  ok('таймер атаки заканчивается в игровом update', o.p.heroAttackT<before && o.p.heroAttackT>=0);
}
{
  const o=game('blade'), e=o.c.spawnEnemy(); e.x=-80; e.y=0; e.spd=0; e.dmg=0; o.c.update(1/60);
  ok('герой зеркалится к цели слева', o.p.spriteFace===-1);
}
{
  const o=game('necro'); o.p.heroSummonT=0; o.c.spawnMinion(undefined,undefined,'skeleton');
  const first=o.p.heroSummonT;
  ok('Некромант начинает анимацию при призыве свиты', first===0.48 && o.p.heroSummonDur===0.48);
  o.c.spawnMinion(undefined,undefined,'skeleton');
  ok('серия призывов не сбрасывает цикл на первый кадр', o.p.heroSummonT===first);
}
ok('новые герои не требуют внешних runtime-assets',
  !/\b(?:src|href)=["'](?:\.\/|assets\/).*\.(?:png|webp|jpg)/i.test(html));
ok('отрицательный RAF-delta не ломает кольцо призыва',
  html.includes('Math.max(0, Math.min(0.05, (now - last)/1000))'));
