/* Универсальные трупы и шесть производительных вариантов кровавых луж. */
const fs=require('fs');
const {loadGame}=require('./sim');
const {imageInfo,embeddedObjectImage}=require('./asset_test_utils');
const html=fs.readFileSync('./index.html','utf8');
const optimizer=fs.readFileSync('./optimize_graphics.py','utf8');
const ok=(nm,cond,det='')=>console.log((cond?'  ✓ ':'  ✗ ')+nm.padEnd(66)+det);
const objectBlock=name=>(html.match(new RegExp('const '+name+' = \\{([\\s\\S]*?)\\n\\};'))||[])[1]||'';
function payload(name,key){
  const image=embeddedObjectImage(html,name,key);return image?image.buffer:Buffer.alloc(0);
}
const imageSize=data=>{const info=imageInfo(data);return[info.w,info.h];};
const corpseKeys=['blob','runner','tank','shooter','frostWolf','toxicRunner','cursedRogue','skeletonWarrior',
  'blightGrunt','boneGargoyle','fallenPyromancer','beholderSlave','skeletonCrossbow','forgottenGuard',
  'abyssalExecutioner','plagueOgre','lich','goat','plague','greed','executioner','tyrant','grave','behemoth',
  'vampire','voidwrath','minotaur','seraph','matriarch','demonqueen'];
const corpseEntries=[...objectBlock('CORPSE_SPRITE_DATA').matchAll(/^\s*(\w+):'data:image\/webp;base64,/gm)].map(m=>m[1]);
ok('в автономный HTML встроены ровно 30 отдельных трупов',corpseEntries.length===30 && corpseKeys.every(k=>corpseEntries.includes(k)),`n=${corpseEntries.length}`);

const normalSizes={blob:[48,27],runner:[48,23],tank:[48,26],shooter:[42,32]};
ok('четыре обычных трупа уменьшены ровно до половины handoff',Object.entries(normalSizes).every(([k,s])=>imageSize(payload('CORPSE_SPRITE_DATA',k)).join()===s.join()));
ok('все обычные трупы остаются прозрачными lossless WebP',Object.keys(normalSizes).every(k=>{const i=imageInfo(payload('CORPSE_SPRITE_DATA',k));return i.alpha&&i.lossless;}));
ok('очищенный alpha-контур сохраняется lossless-перекодированием',corpseKeys.every(k=>imageInfo(payload('CORPSE_SPRITE_DATA',k)).lossless));

const eliteKeys=corpseKeys.slice(4,16),bossKeys=corpseKeys.slice(16);
ok('двенадцать элитных трупов уменьшены со 112 до 56 px',eliteKeys.every(k=>imageSize(payload('CORPSE_SPRITE_DATA',k))[0]===56));
ok('четырнадцать трупов боссов уменьшены со 144 до 72 px',bossKeys.every(k=>imageSize(payload('CORPSE_SPRITE_DATA',k))[0]===72));
ok('все элитные и boss-спрайты остаются прозрачными RGBA',eliteKeys.concat(bossKeys).every(k=>imageInfo(payload('CORPSE_SPRITE_DATA',k)).alpha));
ok('установщик проверяет 30 источников, чистит matte и уменьшает до 50%',/CORPSE_SPRITE_SOURCES = \{/.test(optimizer) && /def corpse_bright_edge_cleanup/.test(optimizer) && /def corpse_half_size_png/.test(optimizer) && /"scale": 0\.5/.test(optimizer));

const atlas=payload('CORPSE_PUDDLE_DATA','atlas');
ok('шесть луж собраны в один атлас 384×64',imageSize(atlas).join()==='384,64',imageSize(atlas).join('×'));
ok('атлас луж упакован в прозрачный lossless WebP',imageInfo(atlas).lossless&&imageInfo(atlas).alpha&&atlas.length<7000,`${atlas.length} B`);
ok('встроен один проверенный финальный атлас луж',(objectBlock('CORPSE_PUDDLE_DATA').match(/data:image\/webp;base64,/g)||[]).length===1);
ok('установщик фиксирует шесть вариантов луж в нужном порядке',
  /"installed": \["small", "medium", "large", "flowing", "bones", "gore"\]/.test(optimizer));
ok('установщик проверяет размер, палитру и непустые кадры 64×64',
  /image\.size != \(384, 64\)/.test(optimizer) && /image\.mode != "P"/.test(optimizer) &&
  /index \* 64, 0, \(index \+ 1\) \* 64, 64/.test(optimizer) && /for index in range\(6\)/.test(optimizer));

const c=loadGame('./index.html'); c.newGame('bow','keys');
let G=c.__api.G;
ok('декоративные и некромантские трупы хранятся раздельно',Array.isArray(G.visualCorpses) && Array.isArray(G.corpses) && G.visualCorpses!==G.corpses);
ok('новый забег начинает с чистого декоративного слоя',G.visualCorpses.length===0);

let allClasses=true;
for (const weapon of ['bow','wand','necro','blade']){
  c.newGame(weapon,'keys'); G=c.__api.G;
  const e=c.spawnEnemy('blob'); c.killEnemy(e,G.enemies.indexOf(e));
  allClasses=allClasses && G.visualCorpses.length===1;
}
ok('труп после убийства видят все четыре класса',allClasses);

c.newGame('bow','keys'); G=c.__api.G;
let e=c.spawnEnemy('blob'); c.killEnemy(e,G.enemies.indexOf(e));
const bowResource=G.corpses.length,bowVisual=G.visualCorpses.length;
c.newGame('necro','keys'); G=c.__api.G;
e=c.spawnEnemy('blob'); c.killEnemy(e,G.enemies.indexOf(e));
ok('боевой ресурс трупов по-прежнему создаётся только Некроманту',bowResource===0 && G.corpses.length===1 && bowVisual===1 && G.visualCorpses.length===1);
ok('визуальный труп не имеет life и не исчезает через 14 секунд',!('life' in G.visualCorpses[0]) && G.corpses[0].life===14);

ok('normal-труп выбирается по typeKey',c.__api.corpseSpriteKey({typeKey:'runner'})==='runner');
ok('elite-труп выбирается по eliteVariant раньше typeKey',c.__api.corpseSpriteKey({typeKey:'runner',eliteVariant:'frostWolf'})==='frostWolf');
ok('boss-труп выбирается по bossId раньше остальных ключей',c.__api.corpseSpriteKey({typeKey:'tank',eliteVariant:'plagueOgre',bossId:'lich'})==='lich');

G.corpseRng=0x12345678;
const counts=Array(6).fill(0); let noPuddle=0;
for (let i=0;i<20000;i++){
  const v=c.__api.corpsePuddleVariant();
  if (v<0) noPuddle++; else counts[v]++;
}
ok('вероятность новой лужи крови статистически равна 50%',noPuddle>9700 && noPuddle<10300,`без лужи ${noPuddle}/20000`);
ok('постоянный слой крови реально выбирает все шесть прежних вариантов',counts.every(n=>n>1500 && n<1850),counts.join('/'));
ok('косметический RNG не сдвигает игровой Math.random',!/Math\.random\s*\(/.test(c.corpseRandom.toString()) && !/Math\.random\s*\(/.test(c.corpsePuddleVariant.toString()));

c.newGame('bow','keys'); G=c.__api.G;
G.visualCorpses.push({x:0,y:0,typeKey:'blob'}); c.buildFloor();
ok('смена этажа очищает декоративные трупы',G.visualCorpses.length===0);
ok('слой трупов стоит над кровью пола и под телеграфами',/\['ground','bloodGround','corpses','telegraphs'/.test(html));
ok('атлас шести луж теперь штампуется постоянным слоем, а не скрывается внутри трупа',
  c.stampBloodPuddle.toString().includes('CORPSE_PUDDLE_ATLAS') &&
  !c.drawVisualCorpses.toString().includes('CORPSE_PUDDLE_ATLAS'));

G.visualCorpses=[{x:0,y:0,typeKey:'blob'},{x:5000,y:5000,typeKey:'blob'}];
ok('отрисовка отсекает трупы вне камеры',c.drawVisualCorpses(-100,-100,100,100)===1);
ok('кадровая функция не создаёт Image и не вращает спрайты',!c.drawVisualCorpses.toString().includes('new Image') && !c.drawVisualCorpses.toString().includes('rotate('));
ok('старые кресты G.corpses удалены из itemsProjectiles',!html.includes('for (const c of G.corpses){\n    const k = clamp(c.life/3'));
const killSource=c.killEnemy.toString();
ok('каждое убийство оставляет тело до классовой проверки D.hasMin',killSource.indexOf('leaveVisualCorpse(e)')>0 && killSource.indexOf('leaveVisualCorpse(e)')<killSource.indexOf('if (D.hasMin)'));
