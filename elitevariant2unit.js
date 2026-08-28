/* Вторая пачка разновидностей элиты: Призмы и Бастионы. */
const fs=require('fs');
const {loadGame}=require('./harness');
const html=fs.readFileSync('./PolyGrind.html','utf8');
const ids=['fallenPyromancer','beholderSlave','skeletonCrossbow','forgottenGuard','abyssalExecutioner','plagueOgre'];
const expectedBase={fallenPyromancer:'shooter',beholderSlave:'shooter',skeletonCrossbow:'shooter',
  forgottenGuard:'tank',abyssalExecutioner:'tank',plagueOgre:'tank'};
let n=0,fail=0;
function ok(name,yes,detail=''){
  n++; if(!yes) fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ')+name.padEnd(68)+detail);
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

ok('каталог содержит шесть ranged/tank разновидностей',ids.every(id=>new RegExp('\\b'+id+':\\s*\\{').test(html)));
ok('Призма и Бастион получают по три разновидности',
  /shooter:\['fallenPyromancer','beholderSlave','skeletonCrossbow'\]/.test(html)&&
  /tank:\['forgottenGuard','abyssalExecutioner','plagueOgre'\]/.test(html));

const sheets=ids.map(payload),infos=sheets.map(pngInfo);
ok('все шесть новых листов встроены в автономный HTML',sheets.every(Boolean));
ok('каждый новый лист имеет четыре кадра 48×48',infos.every(x=>x.w===192&&x.h===48));
ok('новые листы индексированы четырьмя битами',infos.every(x=>x.bits===4&&x.color===3));
ok('каждый новый лист сохраняет прозрачный индекс',sheets.every(b=>b.includes(Buffer.from('tRNS'))));
ok('каждый новый PNG весит меньше 3.5 КБ',sheets.every(b=>b.length<3500),sheets.map(b=>b.length).join('/')+' Б');
ok('шесть новых разновидностей используют разные растры',new Set(sheets.map(b=>b.toString('base64'))).size===6);
ok('runtime листает четыре отдельных кадра 48 px',ids.every(id=>{
  const c=loadGame('./PolyGrind.html');
  return [0,1,2,3].every(i=>c.enemySpriteFrame({kind:'elite',eliteVariant:id,animT:i}).frame.w===48);
}));
ok('пути новых исходных PNG не попали в runtime HTML',
  !/pyromancer_cultist\.png|beholder_slave\.png|acid_carrier\.png|D:\\DL\\CHROME/.test(html));

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); const G=c.__api.G; G.floor=5;G.enemies.length=0;
  const all=ids.map(id=>c.spawnEnemy('pack',null,id));
  ok('явный QA-spawn создаёт все шесть как элиту',all.every(e=>e.kind==='elite'));
  ok('QA-spawn сохраняет запрошенные id',all.every((e,i)=>e.eliteVariant===ids[i]));
  ok('варианты сохраняют коллизию Призмы или Бастиона',all.every(e=>e.typeKey===expectedBase[e.eliteVariant]));
  ok('каждая разновидность получает собственное имя',all.every(e=>e.t.nm!==c.__api.ETYPES[e.typeKey].nm)); }

{ const {c,G,e}=fresh('fallenPyromancer'); c.fireEliteRanged(e,0,e.dmg); const s=G.eshots[0];
  ok('Падший пиромант выпускает процедурный огненный шар',s.shotType==='eliteFireball');
  ok('огненный шар имеет небольшой радиус 5 px',s.r===5);
  ok('огненный шар помечен источником элиты и точной причиной',s.sourceKind==='elite'&&/Падший пиромант.*огненный шар/.test(s.cause)); }

{ const {c,D,p,e}=fresh('fallenPyromancer'); noDefense(D); const s={eliteVariant:e.eliteVariant};
  c.applyEliteProjectileHit(s);
  ok('попадание пироманта запускает один ожог на 4 секунды',p.elitePyroBurnT===4&&p.elitePyroBurnTick===0.5);
  c.applyEliteProjectileHit(s); const before=p.hp; c.tickElitePlayerEffects(0.5);
  ok('повторное попадание не добавляет второй стак ожога',Math.abs(before-p.hp-D.life*0.03)<1e-8); }

{ const {c,D,p,e}=fresh('fallenPyromancer'); noDefense(D); c.applyEliteProjectileHit({eliteVariant:e.eliteVariant}); const before=p.hp;
  for(let i=0;i<8;i++) c.tickElitePlayerEffects(0.5);
  ok('ожог пироманта делает восемь тиков по 3% за 4 секунды',Math.abs(before-p.hp-D.life*0.24)<1e-8);
  ok('после восьмого тика ожог пироманта очищается',p.elitePyroBurnT===0&&p.elitePyroBurnTick===0); }

{ const a=fresh('beholderSlave'),wolf=a.c.spawnEnemy('pack',null,'frostWolf'); a.c.fireEliteRanged(a.e,0,a.e.dmg);
  ok('Слуга бехолдера использует прежнюю розовую энергию Призмы',a.G.eshots[0].shotType==='shooter');
  ok('Слуга бехолдера движется со скоростью элитного Бегуна',Math.abs(a.e.spd-wolf.spd)<1e-9); }

{ const {c,G,p,e}=fresh('skeletonCrossbow'); c.fireEliteRanged(e,0,e.dmg); const s=G.eshots[0];
  ok('Скелет-арбалетчик выпускает отдельный Canvas-болт',s.shotType==='eliteBolt'&&s.r===5);
  c.applyEliteProjectileHit(s);
  ok('болт замедляет игрока на 30% ровно на секунду',p.bossSlowMul===0.70&&p.bossSlowT===1); }

{ const a=fresh('forgottenGuard'),base=a.c.spawnEnemy('pack',null,'plagueOgre');
  ok('Забытый страж наносит на 30% меньше урона',Math.abs(a.e.dmg/base.dmg-0.70)<1e-9);
  ok('таймер первого рывка стража равен двум секундам',a.e.eliteDashCd===2&&a.e.eliteDashT===0);
  a.e.x=0;a.e.y=0;a.p.x=300;a.p.y=0;
  ok('страж не рывкует раньше двух секунд',!a.c.tickEliteAbility(a.e,1.99,a.p)&&a.e.x===0);
  const lock=a.c.tickEliteAbility(a.e,0.02,a.p);
  ok('после двух секунд страж начинает короткий рывок к герою',lock&&a.e.eliteDashT>0&&a.e.x>0); }

{ const {c,p,e}=fresh('forgottenGuard'); c.applyEliteContact(e);
  ok('первый удар стража даёт 10% замедления на 6 секунд',p.eliteGuardSlowStacks===1&&p.eliteGuardSlowT===6);
  c.tickElitePlayerEffects(5); c.applyEliteContact(e);
  ok('повторный удар добавляет стак и обновляет таймер до 6 секунд',p.eliteGuardSlowStacks===2&&p.eliteGuardSlowT===6);
  for(let i=0;i<20;i++) c.applyEliteContact(e);
  ok('замедление стража ограничено девятью стаками / 90%',p.eliteGuardSlowStacks===9);
  c.tickElitePlayerEffects(6);
  ok('через 6 секунд стаки стража полностью очищаются',p.eliteGuardSlowT===0&&p.eliteGuardSlowStacks===0); }
ok('скорость игрока учитывает стаки стража с нижним пределом 10%',
  /Math\.max\(0\.10,1-0\.10\*\(p\.eliteGuardSlowStacks\|\|0\)\)/.test(html));

{ const a=fresh('abyssalExecutioner'),base=a.c.spawnEnemy('pack',null,'plagueOgre');
  ok('Палач бездны наносит на 20% больше урона',Math.abs(a.e.dmg/base.dmg-1.20)<1e-9);
  ok('Палач бездны на 20% медленнее средней элиты-танка',Math.abs(a.e.spd/base.spd-0.80)<1e-9); }

{ const {c,D,p,e}=fresh('abyssalExecutioner'); noDefense(D); c.applyEliteContact(e);
  ok('удар Палача запускает ожог на 1 секунду с шагом 0.25',p.eliteAbyssBurnT===1&&p.eliteAbyssBurnTick===0.25);
  c.applyEliteContact(e); const before=p.hp; c.tickElitePlayerEffects(0.25);
  ok('повторный удар Палача не добавляет второй стак',Math.abs(before-p.hp-D.life*0.05)<1e-8); }

{ const {c,D,p,e}=fresh('abyssalExecutioner'); noDefense(D); c.applyEliteContact(e); const before=p.hp;
  for(let i=0;i<4;i++) c.tickElitePlayerEffects(0.25);
  ok('ожог Палача делает четыре тика по 5% за секунду',Math.abs(before-p.hp-D.life*0.20)<1e-8);
  ok('после четвёртого тика ожог Палача очищается',p.eliteAbyssBurnT===0&&p.eliteAbyssBurnTick===0); }

{ const {c,G,p,e}=fresh('plagueOgre'); p.x=12;p.y=34;c.applyEliteContact(e); const pl=G.eliteAcidPools[0];
  ok('каждый контакт Огра создаёт лужу под текущей точкой игрока',pl.x===12&&pl.y===34&&pl.r===54);
  ok('обычная лужа Огра существует ровно 2 секунды',pl.life===2&&pl.max===2&&pl.tick===0.5); }

{ const {c,G,D,p}=fresh('plagueOgre'); noDefense(D); p.x=0;p.y=0;c.dropEliteAcid(0,0,54,false); const before=p.hp;
  c.tickEliteAcidPools(0.5);
  ok('кислота Огра снимает 10% max HP каждые 0.5 секунды',Math.abs(before-p.hp-D.life*0.10)<1e-8);
  c.tickEliteAcidPools(0.5);c.tickEliteAcidPools(0.5);c.tickEliteAcidPools(0.5);
  ok('за две секунды кислота успевает сделать четыре тика',Math.abs(before-p.hp-D.life*0.40)<1e-8);
  ok('после двух секунд лужа удаляется',G.eliteAcidPools.length===0); }

{ const {c,G,e}=fresh('plagueOgre'); e.x=77;e.y=-21;c.killEnemy(e,G.enemies.indexOf(e)); const pl=G.eliteAcidPools[0];
  ok('погибший Огр оставляет увеличенную кислотную лужу',!!pl&&pl.deathPool&&pl.r===88&&pl.x===77&&pl.y===-21);
  ok('предсмертная лужа также живёт две секунды и наносит 10%',pl.life===2&&pl.maxHpPct===0.10); }

{ const {c,G}=fresh('plagueOgre'); G.eliteAcidPools.length=0;
  for(let i=0;i<30;i++) c.dropEliteAcid(i,0,54,false);
  ok('число элитных кислотных луж ограничено 24',G.eliteAcidPools.length===24&&G.eliteAcidPools[0].x===6); }

ok('огненный шар и болт отрисовываются Canvas без PNG атак',
  /s\.shotType === 'eliteFireball'/.test(html)&&/s\.shotType === 'eliteBolt'/.test(html));
ok('элитная кислота находится в слое floorEffects',
  /for \(const pl of G\.eliteAcidPools\)/.test(html)&&/pass==='floorEffects'/.test(html));
ok('три новых дебаффа имеют постоянные мировые индикаторы',
  /p\.elitePyroBurnT > 0/.test(html)&&/p\.eliteAbyssBurnT > 0/.test(html)&&/p\.eliteGuardSlowT > 0/.test(html));

console.log('  '+n+' проверок ranged/tank элиты');
process.exitCode=fail?1:0;
