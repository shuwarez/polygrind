/* Legacy boss visual upgrade: canonical sheets, action-state routing and impact effects. */
const fs=require('fs');
const {loadGame}=require('./harness');
const html=fs.readFileSync('./PolyGrind.html','utf8');
let n=0,fail=0;
function ok(name,yes,got=''){n++;if(!yes)fail++;console.log((yes?'  ✓ ':'  ✗ ')+name.padEnd(70)+got);}
const ids=['lich','goat','plague','greed','executioner','tyrant','grave','behemoth',
  'vampire','voidwrath','minotaur','seraph','matriarch','demonqueen'];
const effects=['goat_slam','behemoth_impact','minotaur_crash','tyrant_slash','vampire_cross','summon_sigil'];

ok('все 14 прежних боссов получили новые базовые lossless WebP-листы',
  ids.every(id=>new RegExp("\\b"+id+":'data:image/webp;base64,").test(html)));
ok('все 14 прежних боссов получили отдельные атакующие листы',
  ids.every(id=>html.includes(id+"_attack:'data:image/webp;base64,")));
ok('все шесть недостающих эффектов встроены отдельными листами',
  effects.every(id=>html.includes(id+":'data:image/webp;base64,")));
ok('базовые и атакующие листы имеют четыре кадра 64×96',
  /BOSS_ATTACK_SPRITE_META[\s\S]*?for \(const meta of Object\.values\(BOSS_ATTACK_SPRITE_META\)\)[\s\S]*?i<4[\s\S]*?w:64,h:96/.test(html));
ok('эффектные листы имеют четыре кадра 96×96',
  /LEGACY_BOSS_EFFECT_SPRITE_META[\s\S]*?frameW:96,frameH:96,frames:4/.test(html));

const c=loadGame('./PolyGrind.html');c.newGame('bow','keys');
const G=c.__api.G,p=G.player;G.enemies.length=0;p.x=0;p.y=0;p.inv=9999;
const bosses=ids.map(id=>c.spawnEnemy('boss',id,null,0));
ok('все 14 обновлённых моделей создаются штатным spawnEnemy',bosses.every((e,i)=>e.bossId===ids[i]));
ok('спокойная модель каждого босса использует базовый четырёхкадровый лист',
  bosses.every(e=>[0,1,2,3].every(t=>{e.animT=t;return c.enemySpriteFrame(e).index===t;})));
for(const e of bosses)c.startLegacyBossVisual(e,.8);
ok('активное действие каждого босса переключает модель на атакующий лист',
  bosses.every(e=>c.bossAttackVisual(e)?.source==='legacy'&&c.enemySpriteFrame(e).index===0));
for(const e of bosses){e.bossT.visualAction.life=.39;}
ok('прогресс действия синхронно выбирает средние кадры атаки',bosses.every(e=>c.enemySpriteFrame(e).index===2));

const triggers={
  lich:{cast:0},goat:{slamCd:0},plague:{spit:0},greed:{summon:9,spear:0},executioner:{axe:0},
  tyrant:{trail:9,slash:0},grave:{summon:0},behemoth:{jumpCd:0},vampire:{markCd:0},
  voidwrath:{riftCd:0},minotaur:{chargeCd:0},seraph:{judgeCd:0},matriarch:{spawn:0},demonqueen:{leapCd:0}
};
for(const e of bosses){e.bossT=Object.assign({},triggers[e.bossId]);e.x=-320;e.y=0;c.tickBossSkill(e,.01);}
ok('каждая реальная фирменная способность запускает визуальное действие',bosses.every(e=>e.bossT.visualAction&&e.bossT.visualAction.life>0));
const queen=bosses[13];
ok('скрытая Королева во время превращения сохраняет атакующий лист',queen.bossT.hidden&&c.bossAttackVisual(queen)?.source==='legacy');

G.fx.length=0;
const goat=bosses[1];goat.bossT={slamWarn:.01};goat.x=goat.y=0;c.tickBossSkill(goat,.02);
const tyrant=bosses[5];tyrant.bossT={trail:9,slash:0};tyrant.x=-80;tyrant.y=0;c.tickBossSkill(tyrant,.02);
const behemoth=bosses[7];behemoth.bossT={jumpT:.01,jumpSX:0,jumpSY:0,jumpX:30,jumpY:20};c.tickBossSkill(behemoth,.02);
const vampire=bosses[8];vampire.bossT={markWarn:.01,markX:70,markY:40};c.tickBossSkill(vampire,.02);
const minotaur=bosses[10];minotaur.bossT={chargeLeft:.01,chargeA:0,chargeHit:true};c.tickBossSkill(minotaur,.02);
ok('земляной удар, рубящий серп, приземление, крест и таран создают свои эффекты',
  ['goat_slam','tyrant_slash','behemoth_impact','vampire_cross','minotaur_crash'].every(key=>G.fx.some(f=>f.t==='legacyBossEffect'&&f.key===key)));

G.fx.length=0;
for(const id of ['greed','grave','matriarch']){
  const e=bosses[ids.indexOf(id)];e.bossT={summon:0,spawn:0,spear:9};c.tickBossSkill(e,.01);
}
ok('три призыва получают анимированную руну с индивидуальным оттенком',G.fx.filter(f=>f.key==='summon_sigil').length===3);
ok('новые эффекты проходят отдельный culling по экранному размеру',
  /f\.t==='legacyBossEffect'[\s\S]*?f\.size/.test(html));
ok('эффектная анимация выбирает кадр из нормализованного progress',
  /drawLegacyBossEffect[\s\S]*?Math\.floor\(progress\*meta\.frames\)/.test(html));
ok('геометрические телеграфы сохранены поверх художественных эффектов',
  /if \(pass==='telegraphs'\)/.test(html)&&/drawTelegraph\(/.test(html));

for(const e of bosses){e.bossT.visualAction={life:.02,max:.8};c.tickBossSkill(e,.03);}
ok('все визуальные действия завершаются и освобождают состояние',bosses.every(e=>!e.bossT.visualAction));

console.log(`legacybossartunit: ${n-fail}/${n}`);process.exitCode=fail?1:0;
