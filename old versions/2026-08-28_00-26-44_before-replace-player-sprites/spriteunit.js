/* Четырёхкадровые PNG-враги: листы, кадры, движение и горизонтальный разворот. */
const fs = require('fs');
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(52) + (det||''));
const html=fs.readFileSync('./PolyGrind.html','utf8');
const embeddedPng = key => {
  const match=html.match(new RegExp(key+":'data:image/png;base64,([^']+)'"));
  return match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
};
const pngInfo = b => {
  if (b.length < 26) return {png:false,w:0,h:0,color:-1};
  return {png:b.subarray(0,8).toString('hex')==='89504e470d0a1a0a', w:b.readUInt32BE(16), h:b.readUInt32BE(20), color:b[25]};
};

const spr=pngInfo(embeddedPng('runner')), core=pngInfo(embeddedPng('blob')),
      bastion=pngInfo(embeddedPng('tank'));
ok('три листа встроены как прозрачные PNG ожидаемого размера',
  spr.png && spr.w===2172 && spr.h===724 && spr.color===6 && core.png && core.w===1881 && core.h===836 && core.color===6 &&
  bastion.png && bastion.w===1717 && bastion.h===916 && bastion.color===6);

const c=loadGame('./PolyGrind.html');
const frames=[0,1,2,3,0].map(animT => c.enemySpriteFrame({typeKey:'runner',animT}).index);
ok('Бегун циклически использует все четыре кадра', JSON.stringify(frames)==='[0,1,2,3,0]');
const runnerMeta=c.enemySpriteFrame({typeKey:'runner',animT:0}).meta;
ok('Бегун уменьшен на 35% и листает кадры реже',
  Math.abs(runnerMeta.scale-2.99)<1e-9 && runnerMeta.stride===20);
ok('Ядро имеет четыре отдельных прямоугольника листа',
  [0,1,2,3].every(i => c.enemySpriteFrame({typeKey:'blob',animT:i}).frame.w>0));
ok('Бастион получил 4 кадра, геометрической осталась Призма',
  [0,1,2,3].every(i => c.enemySpriteFrame({typeKey:'tank',animT:i}).frame.w>0) && c.enemySpriteFrame({typeKey:'shooter',animT:0})===null);
const blank={hit:0,kind:'norm',dots:{fire:{dps:0}},plague:null,ail:{chill:0,shock:0,freeze:0},frost:false,pack:null,rage:0};
ok('обычный PNG-враг не получает старую контурную метку', c.enemySpriteMarks(blank).length===0);
const marked={...blank,kind:'elite',ail:{chill:1,shock:1,freeze:0},frost:true};
const marks=c.enemySpriteMarks(marked);
ok('элита и статусы заменены уникальными цветными ромбами',
  marks.includes('#ffd24a') && marks.includes('#7fd6ff') && marks.includes('#ffe14a') && new Set(marks).size===marks.length);
ok('круговой прицел PNG-врага заменён стрелками',
  c.enemyTargetMarkerKind({typeKey:'blob',animT:0})==='chevron' && c.enemyTargetMarkerKind({typeKey:'tank',animT:0})==='chevron' &&
  c.enemyTargetMarkerKind({typeKey:'shooter',animT:0})==='arcs');

c.newGame('bow','keys','hunter');
const G=c.__api.G, p=G.player, e=c.spawnEnemy();
G.enemies=[e]; G.spawnQueue=0; e.t=c.__api.ETYPES.runner; e.typeKey='runner'; e.spd=170; e.kb={x:0,y:0};
p.x=0; p.y=0; e.x=-100; e.y=0; e.spriteFace=-1;
const before=e.animT; c.update(0.1); G.pending=0;
ok('движение вправо листает кадры и поворачивает вправо', e.animT>before && e.spriteFace===1);

e.x=100; e.y=0; e.spriteFace=1; c.update(0.1); G.pending=0;
ok('движение влево только зеркалит спрайт', e.spriteFace===-1);

e.x=0; e.y=100; e.spriteFace=-1; e.ail.stun=0; c.update(0.1); G.pending=0;
const verticalFace=e.spriteFace; e.ail.stun=1; const stopped=e.animT; c.update(0.1); G.pending=0;
ok('вертикальный ход не кувыркает, оглушение стопорит цикл', verticalFace===-1 && Math.abs(e.animT-stopped)<1e-9);
