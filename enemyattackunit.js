/* Атакующие листы всех обычных и элитных монстров: ассеты, маршрутизация и реальные триггеры. */
'use strict';
const fs=require('fs');
const crypto=require('crypto');
const {loadGame}=require('./harness');
const {imageInfo,embeddedObjectImage}=require('./asset_test_utils');
const html=fs.readFileSync('./GrimGrind.html','utf8');
const normal=['runner','blob','tank','shooter'];
const elite=['frostWolf','toxicRunner','cursedRogue','skeletonWarrior','blightGrunt','boneGargoyle',
  'fallenPyromancer','beholderSlave','skeletonCrossbow','forgottenGuard','abyssalExecutioner','plagueOgre'];
let n=0,fail=0;
function ok(name,yes,detail=''){
  n++;if(!yes)fail++;
  console.log((yes?'  \u2713 ':'  \u2717 ')+name.padEnd(72)+detail);
}
const payload=(objectName,key)=>{
  const entry=embeddedObjectImage(html,objectName,key);return entry&&entry.buffer;
};
const normalSheets=normal.map(key=>payload('ENEMY_ATTACK_SPRITE_DATA',key));
const eliteSheets=elite.map(key=>payload('ELITE_ATTACK_SPRITE_DATA',key));
const sheets=[...normalSheets,...eliteSheets],infos=sheets.map(imageInfo);

ok('в автономный HTML встроены все 4 обычных и 12 элитных attack-листов',sheets.every(Boolean));
ok('обычные листы содержат ровно четыре кадра правильного размера',
  normalSheets.every((b,i)=>{const x=imageInfo(b),size=normal[i]==='tank'?48:40;return x.w===size*4&&x.h===size;}));
ok('элитные листы содержат ровно четыре кадра 48×48',
  eliteSheets.every(b=>{const x=imageInfo(b);return x.w===192&&x.h===48;}));
ok('все атакующие листы упакованы в lossless WebP',infos.every(x=>x.format==='webp'&&x.lossless));
ok('все атакующие листы сохраняют прозрачность',infos.every(x=>x.alpha));
ok('16 атакующих листов имеют разные растры',
  new Set(sheets.map(b=>crypto.createHash('sha256').update(b).digest('hex'))).size===16);

const c=loadGame('./GrimGrind.html');
const baseNormal=normal.map(key=>c.enemySpriteMeta({kind:'norm',typeKey:key,animT:0}));
const baseElite=elite.map(key=>c.enemySpriteMeta({kind:'elite',eliteVariant:key,animT:0}));
ok('спокойные обычные монстры продолжают использовать прежние листы',
  baseNormal.every((m,i)=>m&&!m.src.endsWith(normalSheets[i].toString('base64'))));
ok('спокойная элита продолжает использовать прежние листы',
  baseElite.every((m,i)=>m&&!m.src.endsWith(eliteSheets[i].toString('base64'))));
ok('обычная attack-meta разбита на четыре точных прямоугольника',normal.every(key=>{
  const e={kind:'norm',typeKey:key,animT:0};c.startEnemyAttackVisual(e,0.4);
  const m=c.enemySpriteMeta(e),size=key==='tank'?48:40;
  return m.frames.length===4&&m.frames.every((f,i)=>f.x===i*size&&f.w===size&&f.h===size);
}));
ok('элитная attack-meta разбита на четыре точных прямоугольника 48 px',elite.every(key=>{
  const e={kind:'elite',eliteVariant:key,animT:0};c.startEnemyAttackVisual(e,0.4);
  const m=c.enemySpriteMeta(e);return m.frames.length===4&&m.frames.every((f,i)=>f.x===i*48&&f.w===48&&f.h===48);
}));
ok('все четыре обычных типа переключаются на соответствующий attack-лист',normal.every((key,i)=>{
  const e={kind:'norm',typeKey:key,animT:0};c.startEnemyAttackVisual(e,0.4);
  return c.enemySpriteMeta(e).src.endsWith(normalSheets[i].toString('base64'));
}));
ok('все двенадцать элитных типов переключаются на свой attack-лист',elite.every((key,i)=>{
  const e={kind:'elite',eliteVariant:key,animT:0};c.startEnemyAttackVisual(e,0.4);
  return c.enemySpriteMeta(e).src.endsWith(eliteSheets[i].toString('base64'));
}));

const probe={kind:'norm',typeKey:'runner',animT:3};
c.startEnemyAttackVisual(probe,0.4);
ok('начало замаха выбирает первый кадр',c.enemySpriteFrame(probe).index===0);
c.tickEnemyAttackVisual(probe,0.12);
ok('подготовка последовательно доходит до второго кадра',c.enemySpriteFrame(probe).index===1);
c.strikeEnemyAttackVisual(probe,0.4,0.55);
ok('фактический удар или выстрел выбирает третий кадр',c.enemySpriteFrame(probe).index===2);
c.tickEnemyAttackVisual(probe,0.12);
ok('после удара показывается четвёртый кадр отдачи',c.enemySpriteFrame(probe).index===3);
c.tickEnemyAttackVisual(probe,0.2);
ok('после отдачи состояние очищается и возвращается ходьба',!probe.attackVisual&&c.enemySpriteFrame(probe).index===3);
const boss={kind:'boss',bossId:'lich',bossT:{},animT:0};
ok('обычные attack-листы не могут подменить систему боссов',!c.startEnemyAttackVisual(boss,0.4)&&!boss.attackVisual);

const live=loadGame('./GrimGrind.html');live.newGame('bow','keys');
const G=live.__api.G,p=G.player;G.pending=0;G.enemies.length=0;G.spawnQueue=0;
const spawned=[...normal.map(key=>live.spawnEnemy(key)),...elite.map(key=>live.spawnEnemy('pack',null,key))];
ok('spawnEnemy инициализирует чистое состояние атаки у всех 16 типов',spawned.every(e=>e.attackVisual===null));

G.enemies.length=0;G.eshots.length=0;
const shooter=live.spawnEnemy('shooter');shooter.x=p.x+250;shooter.y=p.y;shooter.cd=0.001;shooter.ail.stun=0;
live.update(0.01);
ok('реальный выстрел Призмы запускает третий кадр attack-листа',
  G.eshots.some(s=>s.owner===shooter)&&shooter.attackVisual&&live.enemySpriteFrame(shooter).index===2);

G.enemies.length=0;
const runner=live.spawnEnemy('runner');runner.x=p.x+runner.r+p.r-1;runner.y=p.y;runner.cd2=0;
live.update(0.01);
ok('реальная контактная атака Бегуна запускает третий кадр attack-листа',
  runner.attackVisual&&live.enemySpriteFrame(runner).index===2);

G.enemies.length=0;
const guard=live.spawnEnemy('pack',null,'forgottenGuard');guard.x=p.x+250;guard.y=p.y;guard.eliteDashCd=0;guard.eliteDashT=0;
live.tickEliteAbility(guard,0.01,p);
ok('реальный рывок Забытого стража запускает его attack-лист',
  guard.eliteDashT>0&&guard.attackVisual&&live.enemySpriteMeta(guard).src.endsWith(eliteSheets[elite.indexOf('forgottenGuard')].toString('base64')));

ok('runtime предзагружает оба каталога attack-изображений',
  /Object\.keys\(ENEMY_ATTACK_SPRITE_META\)/.test(html)&&/Object\.keys\(ELITE_ATTACK_SPRITE_META\)/.test(html));

console.log('  '+n+' проверок атакующих листов врагов');
if(fail){console.error('enemyattackunit: провалено '+fail+' из '+n);process.exit(1);}
