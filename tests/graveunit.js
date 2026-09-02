/* Кладбище: миграция, запись реальных смертей, предел истории и экраны. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(52) + (det||''));
const c = loadGame('./index.html'), S = c.__api.STORE;

S.data = {gold:77, spent:0, best:3, unlocks:{}, shop:{}, economy:3, constellations:{kills:{},ranks:{}}};
c.normalizeMeta(S.data);
ok('старое сохранение получает пустое кладбище', Array.isArray(S.data.graveyard) && S.data.graveyard.length===0);

S.data.graveyard = Array.from({length:13},(_,i)=>({floor:i+1,lvl:i+2,sprite:i===0?'bad':'mage',cause:'ТЕСТ'}));
c.normalizeGraveyard(S.data);
ok('повреждённые данные безопасны, история не длиннее 10',
  S.data.graveyard.length===10 && S.data.graveyard[0].sprite==='archer' && S.data.graveyard[9].floor===10);

S.data.graveyard=[]; S.data.gold=100; S.data.best=3;
c.newGame('blade','keys','guardian');
let G=c.__api.G;
G.floor=7; G.lvl=12; G.time=125; G.gold=42.9; G.player.kills=31;
Object.assign(G.stats,{normals:25,elites:4,bosses:2,damage:12345,maxHit:777,crits:19,taken:888,healing:222,distance:5432});
G.picks.push({id:'a'},{id:'b'}); G.items.fire={tier:3}; G.amu.fang=true; G.totems.fire=2;
G.player.deathLog={cause:'БЕГУН',dmg:91};
c.gameOver(false);
let r=S.data.graveyard[0];
ok('реальная смерть сохраняет героя, этаж, уровень и время',
  S.data.graveyard.length===1 && r.weaponName==='ВОИН' && r.subclassName==='СТРАЖ' && r.sprite==='warrior' && r.floor===7 && r.lvl===12 && r.duration===125);
ok('могила содержит полную сводку экрана смерти',
  r.earned===42 && r.bankAfter===142 && r.bestAfter===7 && r.cause==='БЕГУН' && r.deathDmg===91 &&
  r.kills===31 && r.normals===25 && r.elites===4 && r.bosses===2 && r.damage===12345 && r.maxHit===777 &&
  r.crits===19 && r.taken===888 && r.healing===222 && r.distance===5432 && r.modifiers===2 &&
  r.books===1 && r.bookTiers===3 && r.amulets===1 && r.totems===1 && r.cleared===6);

c.newGame('bow','keys','hunter'); G=c.__api.G; G.gold=5; G.floor=2;
c.gameOver(true);
ok('досрочно завершённый забег не становится могилой', S.data.graveyard.length===1 && S.data.graveyard[0].floor===7);

S.data.graveyard=[];
for(let floor=1;floor<=12;floor++) c.addGraveyardRecord({floor,lvl:floor,sprite:'archer',weaponName:'ЛУЧНИК',subclassName:'ОХОТНИК'});
ok('новые смерти идут первыми, сохраняются последние 10',
  S.data.graveyard.length===10 && S.data.graveyard[0].floor===12 && S.data.graveyard[9].floor===3);

c.graveyardScreen();
let html=c.document.getElementById('ov').innerHTML;
const listOk=(html.match(/class="grave-run"/g)||[]).length===10 && html.includes('ЭТАЖ СМЕРТИ') && html.includes('уровень 12');
c.graveyardDetail(0); html=c.document.getElementById('ov').innerHTML;
const detailOk=(html.match(/class="summary-cell"/g)||[]).length===12 && html.includes('НАЗАД К КЛАДБИЩУ');
c.startScreen(); const menu=c.document.getElementById('ov').innerHTML;
ok('меню, список и раскрытая сводка кладбища отрисовываются',
  listOk && detailOk && menu.includes('id="graveb"') && menu.includes('последних записей: 10'));
