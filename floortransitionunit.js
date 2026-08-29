/* Завершение этажа: весь лут уходит игроку при открытии портала, новый этаж начинается в центре. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(54) + (det || ''));
// Переход этажа проверяет очередь интерфейса, а не распределение случайных
// боссов и находок. Фиксированный поток не даёт редкому боссу подмешать в
// заранее собранную добычу собственную гарантированную находку.
const fresh = () => loadGame('./PolyGrind.html', {random:() => 0.5});

{ const c = fresh(); c.newGame('bow', 'keys');
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
  ok('каждая находка сохраняет полное описание',
    G.floorFinds.every(f => typeof f.tip === 'string' && f.tip.length > 20));
  const mirrorFind = G.floorFinds.find(f => f.name === c.__api.AMULETS.mirror.nm);
  ok('амулет берёт каноническое описание из каталога',
    mirrorFind && mirrorFind.tip === c.__api.AMULETS.mirror.nt);
  const fireFinds = G.floorFinds.filter(f => f.name === c.__api.BOOKS.fire.nm);
  const totemFind = G.floorFinds.find(f => f.detail.startsWith('ТОТЕМ'));
  ok('книга и тотем показывают фактическую силу находки',
    fireFinds.length === 2 && fireFinds[1].tip.includes(String(G.items.fire.val)) &&
    totemFind && totemFind.tip.includes('+2%'));
  ok('строки добычи доступны с клавиатуры',
    (ov.innerHTML.match(/data-floor-find=/g) || []).length === 4 && ov.innerHTML.includes('tabindex="0"'));
  ok('кнопка сводки показывает доступное закрытие пробелом',
    ov.innerHTML.includes('aria-keyshortcuts="Space"') && ov.innerHTML.includes('<kbd>ПРОБЕЛ</kbd>'));
  const summarySource = c.showFloorFindSummary.toString();
  ok('подсказка привязана к наведению и фокусу',
    summarySource.includes('el.onmouseenter') && summarySource.includes('el.onfocus') && summarySource.includes('el.onblur'));
  c.innerWidth=1280; c.innerHeight=720;
  c.showFloorFindTip({clientX:100,clientY:100}, mirrorFind, null);
  ok('всплывающая панель выводит имя, тип и эффект предмета',
    ov.style.display === 'block' && ov.innerHTML.includes(mirrorFind.name) && ov.innerHTML.includes(mirrorFind.detail) &&
    ov.innerHTML.includes(mirrorFind.tip));
  const dashBefore=G.player.dashN; let prevented=false;
  c.handleGameKeyDown({code:'Space',key:' ',repeat:false,preventDefault(){prevented=true;}});
  ok('пробел закрывает сводку без рывка и возвращает игру',
    prevented && G.paused === false && G.floorFinds.length === 0 && G.player.dashN===dashBefore);

  const floor = G.floor;
  p.x = G.portal.x; p.y = G.portal.y; p.dash = 0.2; G.portal.t = 1;
  c.update(0.01);
  ok('касание портала переводит на следующий этаж', G.floor === floor + 1,
    floor + ' → ' + G.floor);
  ok('на новом этаже игрок находится точно в центре', p.x === 0 && p.y === 0,
    '(' + p.x + ', ' + p.y + ')');
  ok('рывок не переносит импульс через портал', p.dash === 0, String(p.dash)); }

{ const c = fresh(); c.newGame('bow', 'keys');
  const G = c.__api.G;
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.portal=null;
  G.xp=13; G.xpNext=14; G.orbs=[{x:900,y:900,r:9,amu:'mirror'}];
  const boss=c.spawnEnemy('boss'); boss.bossId=null; boss.noLoot=true; boss.xp=1;
  c.killEnemy(boss,G.enemies.indexOf(boss)); c.update(0.01);
  const ov=c.document.getElementById('ov');
  ok('последний босс одновременно открывает портал и level-up', !!G.portal && G.pending===1 && ov.innerHTML.includes('УРОВЕНЬ 2'));
  ok('уведомление о находке ждёт и не перезаписывает level-up', G.floorFinds.length===1 && !ov.innerHTML.includes('ДОБЫЧА ЭТАЖА'));
  G.pending=0; c.continueAfterLevelUp();
  ok('после выбора карточки автоматически открывается добыча этажа', G.paused===true && ov.innerHTML.includes('ДОБЫЧА ЭТАЖА'));
  ok('в отложенной сводке указано имя полученного предмета', ov.innerHTML.includes('ЧЁРНОЕ ЗЕРКАЛО'));
  c.document.querySelector('#findok').onclick();
  ok('после подтверждения находка не остаётся в скрытой очереди', !G.paused && G.floorFinds.length===0); }

{ const c = fresh(); c.newGame('bow', 'keys');
  const G = c.__api.G, p = G.player;
  p.x = 321; p.y = -456; G.floor = 2; c.buildFloor();
  ok('служебная генерация этажа не двигает игрока', p.x === 321 && p.y === -456,
    '(' + p.x + ', ' + p.y + ')'); }

{ const c = fresh(); c.newGame('bow', 'keys');
  const G = c.__api.G;
  c.takeBook('fire');
  ok('обычный ручной подбор книги сохраняет окно', G.paused === true);
  G.paused = false; c.takeAmulet('mirror');
  ok('обычный ручной подбор амулета сохраняет окно', G.paused === true); }
