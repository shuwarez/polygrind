/* Первая пачка разновидностей элиты: Бегуны и Ядра. */
const fs=require('fs');
const {loadGame}=require('./harness');
const html=fs.readFileSync('./PolyGrind.html','utf8');
const ids=['frostWolf','toxicRunner','cursedRogue','skeletonWarrior','blightGrunt','boneGargoyle'];
const expectedBase={frostWolf:'runner',toxicRunner:'runner',cursedRogue:'runner',
  skeletonWarrior:'blob',blightGrunt:'blob',boneGargoyle:'blob'};
let n=0,fail=0;
function ok(name,yes,detail=''){
  n++; if(!yes) fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ')+name.padEnd(66)+detail);
}
function payload(id){
  const m=html.match(new RegExp('\\b'+id+":'data:image/png;base64,([^']+)'"));
  return m&&Buffer.from(m[1],'base64');
}
function pngInfo(buf){ return {w:buf.readUInt32BE(16),h:buf.readUInt32BE(20),bits:buf[24],color:buf[25]}; }
function fresh(id){
  const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G; G.floor=5; G.enemies.length=0; G.spawnQueue=0;
  const e=c.spawnEnemy('pack',null,id);
  return {c,G,D:c.__api.D,p:G.player,e};
}
function noDefense(D){ Object.assign(D,{dodge:0,block:0,armor:0,drFlat:0,dr:0,drShop:0,normalDr:0,majorDr:0}); }

ok('каталог содержит ровно шесть заявленных разновидностей',
  ids.every(id=>new RegExp('\\b'+id+':\\s*\\{').test(html)));
ok('Бегун и Ядро получают по три разновидности',
  /runner:\['frostWolf','toxicRunner','cursedRogue'\]/.test(html) &&
  /blob:\['skeletonWarrior','blightGrunt','boneGargoyle'\]/.test(html));
ok('разновидности этого пака не назначаются Бастиону и Призме',
  ids.every(id=>new RegExp(id+":\\s*\\{base:'(?:runner|blob)'").test(html)));

const sheets=ids.map(payload),infos=sheets.map(pngInfo);
ok('все шесть листов встроены в автономный HTML',sheets.every(Boolean));
ok('каждый лист имеет четыре кадра 48×48',infos.every(x=>x.w===192&&x.h===48));
ok('листы индексированы четырьмя битами — максимум 16 цветов',infos.every(x=>x.bits===4&&x.color===3));
ok('каждый лист сохраняет прозрачный индекс',sheets.every(b=>b.includes(Buffer.from('tRNS'))));
ok('каждый оптимизированный PNG весит меньше 3.5 КБ',sheets.every(b=>b.length<3500),
  sheets.map(b=>b.length).join('/')+' Б');
ok('шесть разновидностей не дублируют один и тот же растр',new Set(sheets.map(b=>b.toString('base64'))).size===6);
ok('runtime-метаданные листают четыре отдельных кадра 48 px',ids.every(id=>{
  const c=loadGame('./PolyGrind.html');
  return [0,1,2,3].every(i=>c.enemySpriteFrame({kind:'elite',eliteVariant:id,animT:i}).frame.w===48);
}));
{ const c=loadGame('./PolyGrind.html');
  const elite=c.enemySpriteFrame({kind:'elite',eliteVariant:'frostWolf',typeKey:'runner',animT:0}).meta;
  const normal=c.enemySpriteFrame({kind:'norm',typeKey:'runner',animT:0}).meta;
  ok('элитная разновидность выбирает отдельный sprite meta',elite!==normal&&elite.scale===3.15);
  ok('обычный Бегун продолжает использовать прежний лист',normal.frames[0].w===40&&normal.scale>3.3); }
ok('пути исходных PNG не попали в runtime HTML',
  !/D:\\DL\\CHROME|ice_wolf\.png|toxic_runner\.png|skeleton warrior\.png/.test(html));

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); const G=c.__api.G; G.floor=5; G.enemies.length=0;
  const all=ids.map(id=>c.spawnEnemy('pack',null,id));
  ok('явный QA-spawn создаёт все шесть именно как элиту',all.every(e=>e.kind==='elite'));
  ok('явный QA-spawn сохраняет запрошенный id',all.every((e,i)=>e.eliteVariant===ids[i]));
  ok('каждая разновидность сохраняет базовую коллизию Бегуна или Ядра',all.every(e=>e.typeKey===expectedBase[e.eliteVariant]));
  ok('каждая разновидность получает собственное имя',all.every(e=>e.t.nm!==c.__api.ETYPES[e.typeKey].nm)); }

{ const {c,G}=fresh('frostWolf'); const wolf=G.enemies[0],rogue=c.spawnEnemy('pack',null,'cursedRogue');
  ok('Проклятый кинжальщик ровно на 10% быстрее элитного Бегуна',Math.abs(rogue.spd/wolf.spd-1.10)<1e-9); }

{ const {c,p,e}=fresh('frostWolf'); c.applyEliteContact(e);
  ok('Морозный волк замедляет движение до 70%',p.bossSlowMul===0.70);
  ok('замедление Морозного волка длится 0.5 секунды',p.bossSlowT===0.5); }

{ const {c,p,e}=fresh('toxicRunner'); c.applyEliteContact(e);
  ok('первое попадание Токсичного бегуна создаёт один стак на 4 секунды',
    p.elitePoisonStacks===1&&p.elitePoisonT===4&&p.elitePoisonTick===1);
  for(let i=0;i<8;i++) c.applyEliteContact(e);
  ok('яд Токсичного бегуна ограничен пятью стаками',p.elitePoisonStacks===5); }

{ const {c,D,p,e}=fresh('toxicRunner'); noDefense(D); c.applyEliteContact(e); const before=p.hp;
  c.tickElitePlayerEffects(1);
  ok('один стак яда снимает 3% max HP раз в секунду',Math.abs(before-p.hp-D.life*0.03)<1e-8); }

{ const {c,D,p,e}=fresh('toxicRunner'); noDefense(D); c.applyEliteContact(e); const before=p.hp;
  for(let i=0;i<4;i++) c.tickElitePlayerEffects(1);
  ok('один стак яда делает четыре тика за четыре секунды',Math.abs(before-p.hp-D.life*0.12)<1e-8);
  ok('по окончании яда таймер и стаки очищаются',p.elitePoisonT===0&&p.elitePoisonStacks===0&&p.elitePoisonTick===0); }

{ const {c,p,e}=fresh('toxicRunner'); c.applyEliteContact(e); c.tickElitePlayerEffects(2); c.applyEliteContact(e);
  ok('новое попадание добавляет стак и обновляет длительность яда',p.elitePoisonStacks===2&&p.elitePoisonT===4); }

{ const {c,p,e}=fresh('boneGargoyle'); c.applyEliteContact(e);
  ok('первый удар Гаргульи создаёт порез на 4 секунды',p.eliteCutT===4&&p.eliteCutTick===0.5); }

{ const {c,D,p,e}=fresh('boneGargoyle'); noDefense(D); c.applyEliteContact(e); c.applyEliteContact(e); const before=p.hp;
  c.tickElitePlayerEffects(0.5);
  ok('повторный удар Гаргульи не добавляет второй стак',Math.abs(before-p.hp-D.life*0.03)<1e-8); }

{ const {c,D,p,e}=fresh('boneGargoyle'); noDefense(D); c.applyEliteContact(e); const before=p.hp;
  for(let i=0;i<8;i++) c.tickElitePlayerEffects(0.5);
  ok('порез делает восемь тиков по 3% за четыре секунды',Math.abs(before-p.hp-D.life*0.24)<1e-8);
  ok('по окончании пореза его таймер очищается',p.eliteCutT===0&&p.eliteCutTick===0); }

{ const {c,p,e}=fresh('blightGrunt'); e.x=0;e.y=0;p.x=10;p.y=0;c.applyEliteContact(e);
  ok('Громила замедляет игрока на 20% на 0.5 секунды',p.bossSlowMul===0.80&&p.bossSlowT===0.5);
  ok('Громила создаёт небольшой импульс отбрасывания от себя',p.vx===120&&Math.abs(p.vy)<1e-9); }

{ const a=fresh('skeletonWarrior'),b=fresh('blightGrunt'); a.e.armor=b.e.armor=12;
  const playerA=a.c.mitigate(a.e,100,0),playerB=b.c.mitigate(b.e,100,0);
  const minionA=a.c.mitigate(a.e,100,1),minionB=b.c.mitigate(b.e,100,1);
  ok('Воин-скелет получает от игрока дополнительно на 15% меньше',Math.abs(playerA/playerB-0.85)<1e-9);
  ok('снижение Воина-скелета не режет урон свиты',Math.abs(minionA/minionB-1)<1e-9); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); const G=c.__api.G; G.floor=20;G.enemies.length=0;
  const sample=[]; for(let i=0;i<120;i++) sample.push(c.spawnEnemy('pack'));
  ok('случайная элита каждого базового типа получает разновидность',sample.every(e=>!!e.eliteVariant));
  ok('случайная выборка достигает Бегунов и Ядер',sample.some(e=>e.typeKey==='runner'&&e.eliteVariant)&&sample.some(e=>e.typeKey==='blob'&&e.eliteVariant)); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); const G=c.__api.G;G.floor=20;G.enemies.length=0;G.packs.length=0;
  const pk=c.spawnPack(20);
  ok('разновидности сосуществуют с прежними аффиксами пачки',pk.aff.length===4&&pk.members.every(e=>e.pack===pk&&e.kind==='elite'));
  const source=c.spawnEnemy('pack',null,'toxicRunner'),copy=c.packClone(source,{hp:0.4,r:0.8,dmg:0.75});
  ok('рядовая копия элиты не наследует особую контактную атаку',copy.kind==='norm'&&!copy.eliteVariant&&copy.t===c.__api.ETYPES.runner); }

{ const {c,p,e}=fresh('cursedRogue');
  ok('разновидность без контактного эффекта не меняет статусы игрока',!c.applyEliteContact(e)&&!p.elitePoisonT&&!p.eliteCutT&&!p.bossSlowT);
  ok('причина урона использует имя конкретной разновидности',c.enemyCause(e,'контакт').includes('Проклятый кинжальщик')); }

ok('яд и порез имеют постоянную мировую индикацию рядом с игроком',
  /p\.elitePoisonT > 0/.test(html)&&/p\.eliteCutT > 0/.test(html)&&/×'\+p\.elitePoisonStacks/.test(html));

console.log('  '+n+' проверок разновидностей элиты');
process.exitCode=fail?1:0;
