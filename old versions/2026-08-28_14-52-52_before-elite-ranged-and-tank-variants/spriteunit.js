/* Четырёхкадровые PNG-враги: листы, кадры, движение и горизонтальный разворот. */
const fs = require('fs');
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(52) + (det||''));
const html=fs.readFileSync('./PolyGrind.html','utf8');
const embeddedPng = key => {
  const match=html.match(new RegExp(key+"\\s*[:=]\\s*'data:image/png;base64,([^']+)'"));
  return match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
};
const pngInfo = b => {
  if (b.length < 26) return {png:false,w:0,h:0,color:-1};
  return {png:b.subarray(0,8).toString('hex')==='89504e470d0a1a0a', w:b.readUInt32BE(16), h:b.readUInt32BE(20), color:b[25]};
};

const spr=pngInfo(embeddedPng('runner')), core=pngInfo(embeddedPng('blob')),
      bastion=pngInfo(embeddedPng('tank')), shooter=pngInfo(embeddedPng('shooter'));
ok('четыре листа встроены как индексированные PNG 40/48 px на кадр',
  spr.png && spr.w===160 && spr.h===40 && spr.color===3 && core.png && core.w===160 && core.h===40 && core.color===3 &&
  bastion.png && bastion.w===192 && bastion.h===48 && bastion.color===3 &&
  shooter.png && shooter.w===160 && shooter.h===40 && shooter.color===3);
const shooterShotBytes=embeddedPng('SHOOTER_PROJECTILE_DATA'), shooterShot=pngInfo(shooterShotBytes);
ok('снаряд Призмы упакован в индексированный лист 32×8 меньше 400 байт',
  shooterShot.png && shooterShot.w===32 && shooterShot.h===8 && shooterShot.color===3 && shooterShotBytes.length<400,
  shooterShotBytes.length+' байт');
const arrowBytes=embeddedPng('archerProjectile'), arrow=pngInfo(arrowBytes);
const mageShotBytes=embeddedPng('mageProjectile'), mageShot=pngInfo(mageShotBytes);
ok('стрела и сфера игрока — индексированные PNG в бюджете 12 px',
  arrow.png && arrow.w===12 && arrow.h===6 && arrow.color===3 && arrowBytes.length<250 &&
  mageShot.png && mageShot.w===32 && mageShot.h===8 && mageShot.color===3 && mageShotBytes.length<400,
  arrowBytes.length+' / '+mageShotBytes.length+' байт');

const c=loadGame('./PolyGrind.html');
const frames=[0,1,2,3,0].map(animT => c.enemySpriteFrame({typeKey:'runner',animT}).index);
ok('Бегун циклически использует все четыре кадра', JSON.stringify(frames)==='[0,1,2,3,0]');
const runnerMeta=c.enemySpriteFrame({typeKey:'runner',animT:0}).meta;
ok('Бегун выводится высотой 40 px и листает кадры реже',
  Math.abs(c.__api.ETYPES.runner.r*runnerMeta.scale-40)<1e-6 && runnerMeta.stride===24);
ok('Ядро имеет четыре отдельных прямоугольника листа',
  [0,1,2,3].every(i => c.enemySpriteFrame({typeKey:'blob',animT:i}).frame.w===40));
ok('Бастион и Призма получили по четыре отдельных кадра',
  [0,1,2,3].every(i => c.enemySpriteFrame({typeKey:'tank',animT:i}).frame.w===48 &&
    c.enemySpriteFrame({typeKey:'shooter',animT:i}).frame.w===40));
const blank={hit:0,kind:'norm',dots:{fire:{dps:0}},plague:null,ail:{chill:0,shock:0,freeze:0},frost:false,pack:null,rage:0};
ok('обычный PNG-враг не получает старую контурную метку', c.enemySpriteMarks(blank).length===0);
const marked={...blank,kind:'elite',ail:{chill:1,shock:1,freeze:0},frost:true};
const marks=c.enemySpriteMarks(marked);
ok('элита и статусы заменены уникальными цветными ромбами',
  marks.includes('#ffd24a') && marks.includes('#7fd6ff') && marks.includes('#ffe14a') && new Set(marks).size===marks.length);
ok('круговой прицел PNG-врага заменён стрелками',
  c.enemyTargetMarkerKind({typeKey:'blob',animT:0})==='chevron' && c.enemyTargetMarkerKind({typeKey:'tank',animT:0})==='chevron' &&
  c.enemyTargetMarkerKind({typeKey:'shooter',animT:0})==='chevron');

c.newGame('bow','keys','hunter');
const G=c.__api.G, p=G.player, e=c.spawnEnemy();
G.time=0; const projectileFrames=[];
for (const t of [0,0.1,0.2,0.3]){ G.time=t; projectileFrames.push(c.enemyProjectileSpriteFrame({shotType:'shooter'}).index); }
ok('текстура снаряда циклически использует четыре кадра без своего таймера',
  JSON.stringify(projectileFrames)==='[0,1,2,3]' && c.enemyProjectileSpriteFrame({shotType:'lich'})===null);
G.time=0; const mageFrames=[];
for (const t of [0,0.1,0.2,0.3]){ G.time=t; mageFrames.push(c.playerProjectileSpriteFrame({spriteType:'mage'}).index); }
ok('сфера Мага использует общий четырёхкадровый цикл, стрела статична',
  JSON.stringify(mageFrames)==='[0,1,2,3]' && c.playerProjectileSpriteFrame({spriteType:'arrow'}).index===0 &&
  c.playerProjectileSpriteFrame({spriteType:'reflected'})===null);

const playerShotType = key => {
  const game=loadGame('./PolyGrind.html'); game.newGame(key,'keys');
  const state=game.__api.G, target=game.spawnEnemy(); state.enemies=[target]; state.pending=0; state.spawnQueue=0;
  state.player.x=0; state.player.y=0; target.x=100; target.y=0; target.spd=0; game.attack();
  return state.shots[0] && state.shots[0].spriteType;
};
ok('штатные атаки Лучника и Мага получают свои sprite-маркеры',
  playerShotType('bow')==='arrow' && playerShotType('wand')==='mage');
const minionGame=loadGame('./PolyGrind.html'); minionGame.newGame('bow','keys');
minionGame.minionShot({x:0,y:0},{x:100,y:0},false);
minionGame.minionShot({x:0,y:0},{x:100,y:0},true);
ok('охотник и колдун свиты используют те же канонические текстуры',
  minionGame.__api.G.shots[0].spriteType==='arrow' && minionGame.__api.G.shots[1].spriteType==='mage');
const prism=c.spawnEnemy('shooter'); G.enemies=[prism]; G.spawnQueue=1; G.eshots.length=0;
p.x=0; p.y=0; prism.x=250; prism.y=0; prism.cd=0; prism.spd=0; prism.aff=[]; prism.kb={x:0,y:0};
c.update(0.01); G.pending=0;
ok('штатный выстрел Призмы помечается для нового sprite renderer',
  G.eshots.length===1 && G.eshots[0].shotType==='shooter');
G.enemies=[e]; G.spawnQueue=0; e.t=c.__api.ETYPES.runner; e.typeKey='runner'; e.spd=170; e.kb={x:0,y:0};
p.x=0; p.y=0; e.x=-100; e.y=0; e.spriteFace=-1;
const before=e.animT; c.update(0.1); G.pending=0;
ok('движение вправо листает кадры и поворачивает вправо', e.animT>before && e.spriteFace===1);

e.x=100; e.y=0; e.spriteFace=1; c.update(0.1); G.pending=0;
ok('движение влево только зеркалит спрайт', e.spriteFace===-1);

e.x=0; e.y=100; e.spriteFace=-1; e.ail.stun=0; c.update(0.1); G.pending=0;
const verticalFace=e.spriteFace; e.ail.stun=1; const stopped=e.animT; c.update(0.1); G.pending=0;
ok('вертикальный ход не кувыркает, оглушение стопорит цикл', verticalFace===-1 && Math.abs(e.animT-stopped)<1e-9);
