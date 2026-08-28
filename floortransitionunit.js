/* Завершение этажа: весь лут уходит игроку при открытии портала, новый этаж начинается в центре. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(54) + (det || ''));

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow', 'keys');
  const G = c.__api.G, D = c.__api.D, p = G.player;
  G.enemies.length = 0; G.spawnQueue = 1; G.spawnT = 999;
  G.xp = 0; G.xpNext = 1e9; G.gold = 0;
  G.orbs.length = 0;
  G.orbs.push(
    {x:1200,y:1200,v:12,r:4},
    {x:-1200,y:1200,v:17,r:4,gold:true},
    {x:1200,y:-1200,r:9,amu:'mirror'},
    {x:-1200,y:-1200,r:9,book:'fire'},
    {x:1100,y:-1100,r:9,book:'fire'},
    {x:-1100,y:1100,r:9,totem:'fire'}
  );
  c.update(0.01);
  ok('до завершения боя портал не появляется', !G.portal);
  ok('до завершения боя дальний лут остаётся на арене', G.orbs.length === 6, String(G.orbs.length));

  const expectedXp = 12 * D.xpGain;
  G.spawnQueue = 0; c.update(0.01);
  ok('после последнего врага портал появляется', !!G.portal);
  ok('при появлении портала на арене не остаётся сфер', G.orbs.length === 0, String(G.orbs.length));
  ok('весь опыт сразу начислен игроку', Math.abs(G.xp-expectedXp) < 0.001,
    G.xp + ' / ' + expectedXp);
  ok('всё золото сразу начислено игроку', G.gold === 17, String(G.gold));
  ok('амулет сразу доставлен игроку', G.amu.mirror === true);
  ok('все одинаковые книги начислены, а не только первая', G.items.fire && G.items.fire.tier === 2,
    G.items.fire ? 'тир ' + G.items.fire.tier : 'нет');
  ok('тотем сразу доставлен игроку', G.totems.fire === 1, String(G.totems.fire || 0));
  const ov = c.document.getElementById('ov');
  ok('автосбор показывает одну сводку всех находок', G.paused === true && G.floorFinds.length === 4 &&
    ov.innerHTML.includes('ДОБЫЧА ЭТАЖА') && ov.innerHTML.includes('ЧЁРНОЕ ЗЕРКАЛО') && ov.innerHTML.includes('КНИГА ОГНЯ'));
  ok('сводка не теряет тотем и повторную книгу', ov.innerHTML.includes('ТОТЕМ ОГНЯ') && ov.innerHTML.includes('тир 2'));
  c.document.querySelector('#findok').onclick();
  ok('закрытие сводки очищает очередь и возвращает игру', G.paused === false && G.floorFinds.length === 0);

  const floor = G.floor;
  p.x = G.portal.x; p.y = G.portal.y; p.dash = 0.2; G.portal.t = 1;
  c.update(0.01);
  ok('касание портала переводит на следующий этаж', G.floor === floor + 1,
    floor + ' → ' + G.floor);
  ok('на новом этаже игрок находится точно в центре', p.x === 0 && p.y === 0,
    '(' + p.x + ', ' + p.y + ')');
  ok('рывок не переносит импульс через портал', p.dash === 0, String(p.dash)); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow', 'keys');
  const G = c.__api.G;
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.portal=null;
  G.xp=13; G.xpNext=14; G.orbs=[{x:900,y:900,r:9,amu:'mirror'}];
  const boss=c.spawnEnemy('boss'); boss.noLoot=true; boss.xp=1;
  c.killEnemy(boss,G.enemies.indexOf(boss)); c.update(0.01);
  const ov=c.document.getElementById('ov');
  ok('последний босс одновременно открывает портал и level-up', !!G.portal && G.pending===1 && ov.innerHTML.includes('УРОВЕНЬ 2'));
  ok('уведомление о находке ждёт и не перезаписывает level-up', G.floorFinds.length===1 && !ov.innerHTML.includes('ДОБЫЧА ЭТАЖА'));
  G.pending=0; c.continueAfterLevelUp();
  ok('после выбора карточки автоматически открывается добыча этажа', G.paused===true && ov.innerHTML.includes('ДОБЫЧА ЭТАЖА'));
  ok('в отложенной сводке указано имя полученного предмета', ov.innerHTML.includes('ЧЁРНОЕ ЗЕРКАЛО'));
  c.document.querySelector('#findok').onclick();
  ok('после подтверждения находка не остаётся в скрытой очереди', !G.paused && G.floorFinds.length===0); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow', 'keys');
  const G = c.__api.G, p = G.player;
  p.x = 321; p.y = -456; G.floor = 2; c.buildFloor();
  ok('служебная генерация этажа не двигает игрока', p.x === 321 && p.y === -456,
    '(' + p.x + ', ' + p.y + ')'); }

{ const c = loadGame('./PolyGrind.html'); c.newGame('bow', 'keys');
  const G = c.__api.G;
  c.takeBook('fire');
  ok('обычный ручной подбор книги сохраняет окно', G.paused === true);
  G.paused = false; c.takeAmulet('mirror');
  ok('обычный ручной подбор амулета сохраняет окно', G.paused === true); }
