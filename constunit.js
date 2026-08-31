/* Постоянная мета-прогрессия созвездий: счётчики, ранги и три награды. */
const {loadGame} = require('./sim');
const fs = require('fs');
const crypto = require('crypto');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(50) + (det||''));
const c = loadGame('./PolyGrind.html'), C = c.__api.CONSTELLATIONS, S = c.__api.STORE;
const source = fs.readFileSync('./PolyGrind.html','utf8');
const ids = ['runner','blob','tank','shooter','elite','boss'];

ok('каталог: шесть согласованных созвездий',
  JSON.stringify(C.map(x=>[x.id,x.nm])) === JSON.stringify([
    ['runner','БЕГУН'],['blob','ЯДРО'],['tank','БАСТИОН'],['shooter','ПРИЗМА'],['elite','ЭЛИТА'],['boss','БОСС']
  ]));
ok('пороги рядовых: 100 → 60 000',
  JSON.stringify(C[0].req) === '[100,250,500,1000,2000,4000,8000,15000,30000,60000]');
ok('пороги элиты: 25 → 15 000',
  JSON.stringify(C.find(x=>x.id==='elite').req) === '[25,60,125,250,500,1000,2000,4000,8000,15000]');
ok('пороги боссов: 5 → 2 500',
  JSON.stringify(C.find(x=>x.id==='boss').req) === '[5,10,20,40,75,150,300,600,1200,2500]');

S.data = {gold:777, spent:12, best:9, shop:{dmg:4}, economy:3};
c.normalizeConstellations(S.data);
ok('миграция сохраняет золото, рекорд и магазин',
  S.data.gold===777 && S.data.best===9 && S.data.shop.dmg===4);
ok('миграция создаёт нулевые счётчики и ранги',
  ids.every(id=>S.data.constellations.kills[id]===0 && S.data.constellations.ranks[id]===0));

c.newGame('bow','keys');
const G = c.__api.G, cs = S.data.constellations;
function victim(typeKey, kind){
  const e = c.spawnEnemy(kind==='boss'?'boss':undefined);
  e.kind=kind; e.typeKey=typeKey; e.maxHp=e.hp=1; e.armor=0; e.ward=null; e.bulwark=0;
  return e;
}
{ const e=victim('runner','norm'); c.killEnemy(e,G.enemies.indexOf(e));
  ok('рядовой продвигает только созвездие формы', cs.kills.runner===1 && cs.kills.elite===0 && cs.kills.boss===0); }
{ const e=victim('runner','elite'); c.killEnemy(e,G.enemies.indexOf(e));
  ok('элита не входит в счётчик рядовой формы', cs.kills.runner===1 && cs.kills.elite===1); }
{ const e=victim('tank','boss'); c.killEnemy(e,G.enemies.indexOf(e));
  ok('босс продвигает только созвездие боссов', cs.kills.tank===0 && cs.kills.boss===1); }

cs.kills.runner=99;
ok('ранг нельзя открыть раньше требования', !c.constellationUnlock('runner',()=>{}) && cs.ranks.runner===0);
cs.kills.runner=100;
ok('первый ранг открывается на 100 убийствах', c.constellationUnlock('runner',()=>{}) && cs.ranks.runner===1);
ok('открытие бесплатно и убийства не списываются', S.data.gold===777 && cs.kills.runner===100);
cs.kills.runner=249;
ok('следующий ранг ждёт свой полный порог', !c.constellationUnlock('runner',()=>{}) && cs.ranks.runner===1);
cs.kills.runner=250;
ok('второй ранг открывается на 250 убийствах', c.constellationUnlock('runner',()=>{}) && cs.ranks.runner===2);
cs.ranks.runner=9; cs.kills.runner=60000;
ok('десятый ранг открывается и остаётся потолком',
  c.constellationUnlock('runner',()=>{}) && cs.ranks.runner===10 && !c.constellationUnlock('runner',()=>{}));

cs.ranks.runner=1; cs.ranks.elite=2; cs.ranks.boss=10;
ok('рядовой ранг даёт отдельный множитель ×1.05', Math.abs(c.__api.constellationMultiplier({kind:'norm',typeKey:'runner'})-1.05)<1e-9);
ok('два ранга элиты дают множитель ×1.10', Math.abs(c.__api.constellationMultiplier({kind:'elite',typeKey:'runner'})-1.10)<1e-9);
ok('десять рангов босса дают потолок ×1.50', Math.abs(c.__api.constellationMultiplier({kind:'boss',typeKey:'tank'})-1.50)<1e-9);

{ const e=victim('runner','norm'); e.maxHp=e.hp=1000; const before=G.stats.damage;
  c.applyDamage(e,100,false,true);
  ok('множитель применяется ко всему урону', Math.abs(e.hp-895)<1e-9 && Math.abs(G.stats.damage-before-105)<1e-9); }

const oldRandom=Math.random; Math.random=()=>0.5;
try{
  cs.ranks.runner=1;
  const e=victim('runner','norm'), xp=e.xp;
  c.killEnemy(e,G.enemies.indexOf(e));
  const xpOrb=G.orbs.find(o=>!o.gold && o.v!==undefined && Math.abs(o.v-xp*1.05)<1e-9);
  const gold=G.orbs.filter(o=>o.gold).slice(-1)[0];
  const expectedGold=Math.round((5+G.floor*0.3)*c.__api.D.goldFind*1.05*1.025);
  ok('множитель применяется к опыту за тип', !!xpOrb, xpOrb ? xpOrb.v.toFixed(2) : 'нет сферы');
  ok('множитель применяется к золоту за тип', !!gold && gold.v===expectedGold, gold ? gold.v+' золота' : 'нет монеты');
} finally { Math.random=oldRandom; }

for (const id of ids){ cs.kills[id]=0; cs.ranks[id]=0; }
c.constellationScreen(()=>{});
let html=c.document.getElementById('ov').innerHTML;
ok('обсерватория показывает шесть путей и десять узлов выбранного пути',
  (html.match(/<button class="const-path/g)||[]).length===6 && (html.match(/<span class="const-node/g)||[]).length===10);
ok('выбранный путь получает крупный спрайт и отдельную сцену',
  html.includes('class="const-focus"') && html.includes('class="const-focus-icon" data-const-icon="runner" width="104" height="104"'));
ok('только один путь отмечен выбранным для клавиатуры и скринридера',
  (html.match(/aria-pressed="true"/g)||[]).length===1 && (html.match(/aria-pressed="false"/g)||[]).length===5);
ok('шапка показывает открытые, готовые и накопленные звёздные данные',
  html.includes('ОТКРЫТО ЗВЁЗД') && html.includes('ГОТОВО К ОТКРЫТИЮ') && html.includes('УБИЙСТВ ЗАПИСАНО'));
ok('переключатель пути открывает крупный профиль Босса',
  c.constellationSelect('boss',()=>{}) && c.document.getElementById('ov').innerHTML.includes('<h3>БОСС</h3>'));
ok('неизвестный путь отклоняется и не ломает выбранный профиль',
  !c.constellationSelect('missing',()=>{}) && c.document.getElementById('ov').innerHTML.includes('<h3>БОСС</h3>'));
c.constellationScreen(()=>{}); html=c.document.getElementById('ov').innerHTML;
ok('выбранный путь сохраняется после перестроения экрана', html.includes('<h3>БОСС</h3>'));
c.constellationSelect('runner',()=>{});
cs.kills.runner=100; c.constellationScreen(()=>{}); html=c.document.getElementById('ov').innerHTML;
ok('готовый ранг показывает кнопку открытия', html.includes('data-const-id="runner"') && html.includes('>ОТКРЫТЬ РАНГ</button>'));
{
  cs.ranks.runner=0; cs.kills.runner=100;
  const originalQuery=c.document.querySelector.bind(c.document), before={scrollTop:437}, after={scrollTop:0};
  let reads=0;
  c.document.querySelector=selector => selector==='#constellations' ? (reads++===0 ? before : after) : originalQuery(selector);
  const unlocked=c.constellationUnlock('runner',()=>{});
  c.document.querySelector=originalQuery;
  ok('прокачка сохраняет позицию списка созвездий', unlocked && after.scrollTop===437,
    after.scrollTop+' / 437');
}
cs.ranks.runner=10; c.constellationScreen(()=>{}); html=c.document.getElementById('ov').innerHTML;
ok('максимальный ранг показывает полный бонус', html.includes('СОЗВЕЗДИЕ ЗАВЕРШЕНО · +50%'));

{
  const savedKills=Object.fromEntries(ids.map((id,i)=>[id,(i+1)*1000]));
  const savedRanks={runner:3,blob:2,tank:1,shooter:4,elite:2,boss:5};
  Object.assign(cs.kills,savedKills); Object.assign(cs.ranks,savedRanks);
  const beforeGold=S.data.gold, beforeShop=JSON.stringify(S.data.shop);
  const removed=c.constellationResetBonuses(()=>{});
  ok('убрать бонусы возвращает число снятых узлов и обнуляет ранги',
    removed===17 && ids.every(id=>cs.ranks[id]===0), removed+' узлов');
  ok('сброс бонусов сохраняет убийства и остальную мета-прогрессию',
    ids.every(id=>cs.kills[id]===savedKills[id]) && S.data.gold===beforeGold && JSON.stringify(S.data.shop)===beforeShop);
  ok('сохранённые убийства позволяют сразу открыть бонус заново',
    c.constellationUnlock('runner',()=>{}) && cs.ranks.runner===1 && cs.kills.runner===savedKills.runner);
}
for (const id of ids) cs.ranks[id]=0;
c.constellationScreen(()=>{}); html=c.document.getElementById('ov').innerHTML;
ok('dev-кнопка видна и отключается без активных бонусов',
  html.includes('id="constreset" disabled') && html.includes('>УБРАТЬ БОНУСЫ</button>') &&
  html.includes('Убийства сохранятся — доступные узлы можно открыть заново.'));

const constellationPng = key => {
  const m=source.match(new RegExp(key+":'data:image/png;base64,([^']+)'"));
  const b=m ? Buffer.from(m[1],'base64') : Buffer.alloc(0);
  return b.length>=26 ? {bytes:b.length,w:b.readUInt32BE(16),h:b.readUInt32BE(20),color:b[25]} : {bytes:0};
};
const elitePng=constellationPng('elite'), bossPng=constellationPng('boss');
ok('элита и босс получили отдельные прозрачные листы 4×48',
  elitePng.w===192 && elitePng.h===48 && bossPng.w===192 && bossPng.h===48);
ok('листы созвездий индексированы в 16 цветов и весят меньше 6 КБ',
  elitePng.color===3 && bossPng.color===3 && elitePng.bytes+bossPng.bytes<6000,
  (elitePng.bytes+bossPng.bytes)+' байт');
ok('рядовые созвездия переиспользуют игровые листы и анимируют четыре кадра',
  source.includes('const regular = ENEMY_SPRITE_META[it.id]') && source.includes('Math.floor(t*6') && source.includes('g.drawImage(sprite,frame*frameSize'));

const backdropMatch=source.match(/#constellations\{[\s\S]*?url\("data:image\/webp;base64,([A-Za-z0-9+/=]+)"\)/);
const backdrop=backdropMatch ? Buffer.from(backdropMatch[1],'base64') : Buffer.alloc(0);
ok('новая обсерватория встроена одним компактным WebP 1280x853',
  backdrop.length===53110 && crypto.createHash('sha256').update(backdrop).digest('hex')==='16430e2fa4221af9bc0c9cf1f3242e0beff5a479715ad83be1f5d0775a48f133',
  backdrop.length+' байт');
ok('runtime не зависит от внешнего PNG-концепта',
  !source.includes('assets/generated/constellation-observatory-v1.png') &&
  backdropMatch && source.split(backdropMatch[1]).length===2);
const optimizer=fs.readFileSync('./optimize_graphics.py','utf8');
ok('упаковщик воспроизводит размер, качество и оба SHA-256 обсерватории',
  optimizer.includes('CONSTELLATION_OBSERVATORY_SOURCE_SHA256') &&
  optimizer.includes('CONSTELLATION_OBSERVATORY_WEBP_SHA256') &&
  optimizer.includes('source.resize((1280, 853), Image.Resampling.LANCZOS)') &&
  optimizer.includes('runtime.save(encoded, "WEBP", quality=62, method=6)'));
ok('арт обновляется максимум восемь раз в секунду и без кадровых массивов',
  source.includes('const CONSTELLATION_DUST = Array.from({length:54}') &&
  source.includes('const artFrame = Math.floor(t*8)') && source.includes('if (artFrame === constellationArtFrame) return'));
ok('один renderer масштабирует существующие спрайты для списка и крупного профиля',
  source.includes('const drawSize = Math.max(8,Math.min(w,h)-6)') &&
  source.includes('g.imageSmoothingEnabled=false') && source.includes("data-const-icon=\"' + selected.id + '\""));
ok('адаптив переводит пути в 3 колонки, а звёзды в сетку 5x2',
  source.includes('.const-paths{display:grid;grid-template-columns:repeat(3,1fr)') &&
  source.includes('.const-nodes{grid-template-columns:repeat(5,1fr);row-gap:13px}'));
