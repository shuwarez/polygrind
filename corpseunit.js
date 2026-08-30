/* Универсальные трупы и шесть производительных вариантов кровавых луж. */
const fs=require('fs'),crypto=require('crypto');
const {loadGame}=require('./sim');
const html=fs.readFileSync('./PolyGrind.html','utf8');
const optimizer=fs.readFileSync('./optimize_graphics.py','utf8');
const ok=(nm,cond,det='')=>console.log((cond?'  ✓ ':'  ✗ ')+nm.padEnd(66)+det);
const objectBlock=name=>(html.match(new RegExp('const '+name+' = \\{([\\s\\S]*?)\\n\\};'))||[])[1]||'';
function payload(name,key){
  const m=objectBlock(name).match(new RegExp('\\b'+key+":'data:image/png;base64,([^']+)'"));
  return m?Buffer.from(m[1],'base64'):Buffer.alloc(0);
}
const pngSize=data=>data.length>=24?[data.readUInt32BE(16),data.readUInt32BE(20)]:[0,0];
const corpseKeys=['blob','runner','tank','shooter','frostWolf','toxicRunner','cursedRogue','skeletonWarrior',
  'blightGrunt','boneGargoyle','fallenPyromancer','beholderSlave','skeletonCrossbow','forgottenGuard',
  'abyssalExecutioner','plagueOgre','lich','goat','plague','greed','executioner','tyrant','grave','behemoth',
  'vampire','voidwrath','minotaur','seraph','matriarch','demonqueen'];
const corpseEntries=[...objectBlock('CORPSE_SPRITE_DATA').matchAll(/^\s*(\w+):'data:image\/png;base64,/gm)].map(m=>m[1]);
ok('в автономный HTML встроены ровно 30 отдельных трупов',corpseEntries.length===30 && corpseKeys.every(k=>corpseEntries.includes(k)),`n=${corpseEntries.length}`);

const normalSizes={blob:[96,54],runner:[96,46],tank:[96,51],shooter:[84,64]};
ok('четыре обычных трупа сохраняют размеры handoff',Object.entries(normalSizes).every(([k,s])=>pngSize(payload('CORPSE_SPRITE_DATA',k)).join()===s.join()));
ok('все обычные трупы остаются прозрачными RGBA PNG',Object.keys(normalSizes).every(k=>payload('CORPSE_SPRITE_DATA',k)[25]===6));
ok('эталон blob встроен побайтно без ресэмплинга',crypto.createHash('sha256').update(payload('CORPSE_SPRITE_DATA','blob')).digest('hex')==='963811c5bc160f7f72fb9b76dfb9d10fa09ecf70afe8bf98d3206bc65140f8ff');

const eliteKeys=corpseKeys.slice(4,16),bossKeys=corpseKeys.slice(16);
ok('двенадцать элитных трупов имеют handoff-ширину 112 px',eliteKeys.every(k=>pngSize(payload('CORPSE_SPRITE_DATA',k))[0]===112));
ok('четырнадцать трупов боссов имеют handoff-ширину 144 px',bossKeys.every(k=>pngSize(payload('CORPSE_SPRITE_DATA',k))[0]===144));
ok('все элитные и boss-спрайты остаются прозрачными RGBA',eliteKeys.concat(bossKeys).every(k=>payload('CORPSE_SPRITE_DATA',k)[25]===6));
ok('установщик проверяет 30 хешей и запрещает ресэмплинг',/CORPSE_SPRITE_SOURCES = \{/.test(optimizer) && /"resampled": False/.test(optimizer) && /--install-corpse-sprites/.test(optimizer));

const atlas=payload('CORPSE_PUDDLE_DATA','atlas');
ok('шесть луж собраны в один атлас 384×64',pngSize(atlas).join()==='384,64',pngSize(atlas).join('×'));
ok('атлас луж индексированный, а не шесть полноцветных текстур',atlas[25]===3 && atlas.length<7000,`${atlas.length} B`);
ok('встроен проверенный финальный атлас луж',crypto.createHash('sha256').update(atlas).digest('hex')==='9236e97ebaf2e4cee306cf305d5eaaae47b2cdc1857b7b75c19cc9efc3f20049');
const puddleManifest=JSON.parse(fs.readFileSync('./assets/corpse-puddles/blood-puddle-manifest.json','utf8'));
ok('manifest фиксирует шесть разных вариантов в нужном порядке',puddleManifest.frames.map(f=>f.key).join(',')==='small,medium,large,flowing,bones,gore');
ok('каждый финальный вариант лужи занимает только 64×64',puddleManifest.frames.every(f=>f.size.join()==='64,64' && f.bytes<2500));

const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
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
ok('вероятность лужи статистически равна 50%',noPuddle>9700 && noPuddle<10300,`без лужи ${noPuddle}/20000`);
ok('случайный выбор реально использует все шесть вариантов',counts.every(n=>n>1500 && n<1850),counts.join('/'));
ok('косметический RNG не сдвигает игровой Math.random',!/Math\.random\s*\(/.test(c.corpseRandom.toString()) && !/Math\.random\s*\(/.test(c.corpsePuddleVariant.toString()));

c.newGame('bow','keys'); G=c.__api.G;
G.visualCorpses.push({x:0,y:0,typeKey:'blob',puddle:0}); c.buildFloor();
ok('смена этажа очищает декоративные трупы',G.visualCorpses.length===0);
ok('слой трупов стоит над кровью пола и под телеграфами',/\['ground','bloodGround','corpses','telegraphs'/.test(html));
ok('лужа рисуется перед телом тем же проходом',c.drawVisualCorpses.toString().indexOf('CORPSE_PUDDLE_ATLAS')<c.drawVisualCorpses.toString().indexOf('CORPSE_SPRITES'));

G.visualCorpses=[{x:0,y:0,typeKey:'blob',puddle:0},{x:5000,y:5000,typeKey:'blob',puddle:0}];
ok('отрисовка отсекает трупы вне камеры',c.drawVisualCorpses(-100,-100,100,100)===1);
ok('кадровая функция не создаёт Image и не вращает спрайты',!c.drawVisualCorpses.toString().includes('new Image') && !c.drawVisualCorpses.toString().includes('rotate('));
ok('старые кресты G.corpses удалены из itemsProjectiles',!html.includes('for (const c of G.corpses){\n    const k = clamp(c.life/3'));
const killSource=c.killEnemy.toString();
ok('каждое убийство оставляет тело до классовой проверки D.hasMin',killSource.indexOf('leaveVisualCorpse(e)')>0 && killSource.indexOf('leaveVisualCorpse(e)')<killSource.indexOf('if (D.hasMin)'));
