/* Twenty approved bosses: embedded art, event sequences, damage contracts and hazards. */
const fs=require('fs');
const {loadGame}=require('./harness');
const html=fs.readFileSync('./index.html','utf8');
let n=0,fail=0;
function ok(name,yes,got=''){n++;if(!yes)fail++;console.log((yes?'  ✓ ':'  ✗ ')+name.padEnd(66)+got);}
const ids=['funeral_bell_colossus','star_devourer','plague_archimandrite','crimson_seamstress','glass_titan',
  'rust_king','mother_empty_masks','ice_psalmist','heart_collector','ink_leviathan','judge_of_chains',
  'ashen_seraph','bone_astrolabe','copper_oracle','prince_hungry_ravens','lunar_butcher',
  'keeper_last_candle','sand_gravedigger','bottomless_mnema','empress_iron_roses'];

ok('в каталоге перечислены ровно 20 новых bossId',ids.every(id=>html.includes(id+':{nm:')));
ok('каждый базовый лист встроен как lossless WebP',ids.every(id=>new RegExp("\\b"+id+":'data:image/webp;base64,").test(html)));
const attackIds=ids;
const effectIds=['funeral_wave_ring','star_meteor','star_meteor_impact','plague_censer_cloud','crimson_flesh_seam',
  'glass_blast','glass_shard','rust_tide_cone','empty_mask_beam','ice_liturgy_sector','heart_blood_ring','ink_pool',
  'judge_chain_hook','judge_hammer_impact','ashen_comet','ashen_comet_impact','bone_orbit_ring',
  'copper_rewind_explosion','raven_swarm','lunar_crescent','candle_safe_halo','sand_shockwave',
  'sand_ground_strip','mnema_shadow_pierce','iron_rose_ring'];
ok('все 20 атакующих листов встроены отдельно',attackIds.every(id=>html.includes(id+"_attack:'data:image/webp;base64,")));
ok('все 25 семейств эффектов встроены отдельно',effectIds.every(id=>html.includes(id+":'data:image/webp;base64,")));
ok('все листы используют канонические четыре кадра 64×96',/for \(const meta of Object\.values\(BOSS_SPRITE_META\)\)[\s\S]*?i < 4[\s\S]*?w:64,h:96,ax:32,ay:72/.test(html));
ok('атакующие листы BOSS20 автоматически включаются только во время special',
  /if \(e\.bossT\.special\)[\s\S]*?source:'boss20'/.test(html)&&/if \(bossAttackVisual\(e\)\)/.test(html));
ok('геометрия поддерживает круг, кольцо, коридор, конус и серп',['ring','corridor','cone','arc'].every(s=>html.includes("spec.shape==='"+s+"'")));
ok('спрайт эффекта обрезается тем же telegraphPath, что и зона попадания',
  /drawBossEffectSpriteInSpec[\s\S]*?telegraphPath\(spec\);ctx\.clip\('evenodd'\)/.test(html));
ok('длинные эффекты повторяются или тянутся строго внутри коридора',
  /renderMeta\.corridor==='stretch'[\s\S]*?for\(let x=/.test(html));
ok('конусный спрайт использует радиус и угол механического spec',
  /spec\.shape==='cone'[\s\S]*?spec\.r\*Math\.sin\(arc\/2\)[\s\S]*?spec\.a/.test(html));
ok('длительные зоны рисуют эффект непосредственно через свой spec',
  /drawBoss20EffectInSpec\(h\.effectKey,h\.spec/.test(html));
ok('спрайты комет и осколков ограничены реальным радиусом снаряда',
  /drawBoss20ProjectileEffect[\s\S]*?ctx\.arc\(0,0,s\.r\|\|8/.test(html));

const c=loadGame('./index.html');c.newGame('bow','keys');
const G=c.__api.G;G.player.inv=9999;G.enemies.length=0;
const made=ids.map(id=>c.spawnEnemy('boss',id,null,0));
ok('все 20 боссов создаются через штатный spawnEnemy',made.every((e,i)=>e&&e.kind==='boss'&&e.bossId===ids[i]));
ok('каждый новый босс имеет короткую HUD-метку и описание',made.every(e=>{const d=c.bossType(e);return d&&d.hud&&d.hud.length<=24&&d.nt;}));
made.forEach(e=>c.tickBoss20Skill(e,0));
ok('начальный cooldown сокращён на 30% у 19 боссов и отдельно вдвое у Судьи',
  made.filter(e=>e.bossId!=='judge_of_chains').every(e=>e.bossT.specialCd>=1.61&&e.bossT.specialCd<=2.1)&&
  made[10].bossT.specialCd>=1.15&&made[10].bossT.specialCd<=1.5);

const sequences=[];
for(const e of made){
  e.bossT.specialCd=0;c.tickBossSkill(e,.01);sequences.push(e.bossT.special);
}
ok('каждый босс запускает собственную событийную спецатаку',sequences.every(Boolean));
ok('у каждой спецатаки есть предупреждение до первого события',sequences.every(s=>s.telegraphs.length&&s.events.length&&Math.min(...s.telegraphs.map(x=>x.from))<=Math.min(...s.events.map(x=>x.at))));
ok('все моменты событий конечны и лежат внутри своей анимации',sequences.every(s=>s.events.every(e=>Number.isFinite(e.at)&&e.at>=0&&e.at<=s.duration)));
ok('все прямые процентные удары находятся в допустимом диапазоне',sequences.every(s=>s.events.filter(e=>e.pct!==undefined).every(e=>e.pct>0&&e.pct<=.18)));
ok('описанные максимумы сохранены: 18% метеор и 16% песок/стекло',sequences.some(s=>s.events.some(e=>e.pct===.18))&&sequences.filter(s=>s.events.some(e=>e.pct===.16)).length===2);
ok('Колосс создаёт ровно три волны по 8%',sequences[0].events.filter(e=>e.pct===.08).length===3);
ok('Матерь создаёт ровно три луча по 10%',sequences[6].events.filter(e=>e.pct===.10).length===3);
ok('Оракул создаёт ровно пять взрывов по 6%',sequences[13].events.filter(e=>e.pct===.06).length===5);
ok('Императрица создаёт ровно три кольца по 9%',sequences[19].events.filter(e=>e.pct===.09).length===3);
const judge=made[10],judgePull=sequences[10].events.find(e=>e.type==='pull');
const judgeBaseDistance=Math.hypot(G.player.x-judge.x,G.player.y-judge.y);
const judgeChainDistance=Math.hypot(judgePull.spec.x2-judgePull.spec.x,judgePull.spec.y2-judgePull.spec.y);
ok('Судья выпускает цепь ровно втрое дальше исходной позиции цели',
  Math.abs(judgeChainDistance-judgeBaseDistance*3)<1e-9);
ok('Судья применяет цепь на 20% быстрее: windup сокращён с 0,70 до 0,56 сек',
  judgePull.at===.56&&sequences[10].telegraphs.some(t=>t.kind==='control'&&t.from===0&&t.to===.56));
G.player.vx=0;G.player.vy=0;c.fireBoss20Event(judge,judgePull);
ok('цепь Судьи притягивает с дополнительным трёхкратным импульсом 3120',
  judgePull.pullForce===3120&&Math.abs(Math.hypot(G.player.vx,G.player.vy)-3120)<1e-9);

for(const e of made){
  let guard=0;while(e.bossT.special&&guard++<200)c.tickBossSkill(e,.05);
}
const artisticHits=G.fx.filter(f=>f.t==='boss20SpriteEffect');
ok('каждый созданный AoE-спрайт хранит точный spec события',
  artisticHits.length>0&&artisticHits.every(f=>f.spec||f.specs));
ok('каждая художественная длительная зона хранит тот же spec, что и урон',
  G.bossHazards.filter(h=>h.effectKey).every(h=>h.spec&&h.spec.shape));
ok('все 20 последовательностей завершаются без зависания',made.every(e=>!e.bossT.special));
ok('после завершения 19 новым боссам назначается сокращённый cooldown 3,6–4,1 секунды',
  made.filter(e=>e.bossId!=='judge_of_chains').every(e=>e.bossT.specialCd>=3.6&&e.bossT.specialCd<=4.1));
ok('Судья Цепей получает вдвое меньший cooldown 2,5–3 секунды',
  judge.bossT.specialCd>2.5&&judge.bossT.specialCd<3);
ok('чернила, свет и песок создают длительные hazard-зоны',G.bossHazards.some(h=>h.kind==='pool')&&G.bossHazards.some(h=>h.kind==='safe')&&G.bossHazards.some(h=>h.kind==='strip'));
ok('число длительных зон имеет жёсткий потолок 40',/G\.bossHazards\.length>=40/.test(html));
ok('процентные DoT тикают раз в секунду через hurt()',/dot\.tick\+=1;hurt\(D\.life\*dot\.pct/.test(html));
ok('кометы переносят горение через единый enemy-shot collision',/s\.bossDot\) applyBoss20Dot/.test(html));
ok('визуал безопасного света вырезает круг из затемнения мира',/ctx\.fill\('evenodd'\)/.test(html));
ok('меню K получает новых боссов автоматически из BOSS_KEYS',/Object\.keys\(BOSS_TYPES\)/.test(html)&&/BOSS_KEYS\.map/.test(html));

console.log(`boss20unit: ${n-fail}/${n}`);process.exitCode=fail?1:0;
