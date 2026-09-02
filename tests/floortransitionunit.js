/* Завершение этажа: весь лут уходит игроку при открытии портала, новый этаж начинается в центре. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(54) + (det || ''));
// Переход этажа проверяет очередь интерфейса, а не распределение случайных
// боссов и находок. Фиксированный поток не даёт редкому боссу подмешать в
// заранее собранную добычу собственную гарантированную находку.
const fresh = () => loadGame('./index.html', {random:() => 0.5});

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
  const portalDistance=Math.hypot(G.portal.x-p.x,G.portal.y-p.y);
  const portalScreen=c.worldToScreen(G.portal.x,G.portal.y,p);
  const portalHalf=166*.95/2;
  ok('портал появляется не ближе 350 и целиком в поле зрения',
    portalDistance>=350&&portalDistance<=520&&
    portalScreen.x>=portalHalf&&portalScreen.x<=1280-portalHalf&&
    portalScreen.y>=portalHalf&&portalScreen.y<=720-portalHalf,
    portalDistance.toFixed(2)+' @ '+portalScreen.x.toFixed(1)+', '+portalScreen.y.toFixed(1));
  const edgePortal=c.floorPortalSpawnPosition({x:1390,y:1390});
  ok('увеличенный портал целиком остаётся внутри арены',Math.abs(G.portal.x)<=1397&&Math.abs(G.portal.y)<=1397&&
    Math.abs(edgePortal.x)<=1397&&Math.abs(edgePortal.y)<=1397&&
    Math.abs(Math.hypot(edgePortal.x-1390,edgePortal.y-1390)-edgePortal.distance)<1e-6,
    G.portal.x.toFixed(1)+', '+G.portal.y.toFixed(1));
  ok('появление портала создаёт кровавый выброс, дым и угли',G.parts.length>=84&&G.fx.filter(f=>f.t==='ring').length>=3&&
    c.drawFloorPortalEnergy(G.portal)===48,
    'частиц '+G.parts.length);
  ok('Canvas-защита отсекает отрицательные и повреждённые радиусы',
    c.safeCanvasRadius(-1.36773)===0&&c.safeCanvasRadius(NaN)===0&&c.safeCanvasRadius(12.5)===12.5);
  ok('RAF следующего кадра ставится до потенциально аварийной логики',
    c.loop.toString().indexOf('requestAnimationFrame(loop)')<c.loop.toString().indexOf('try {'));
  ok('рядом с героем доступен направленный указатель портала',
    c.drawFloorPortalIndicator(G.portal,p)===true &&
    c.drawFloorPortalIndicator.toString().includes('Math.atan2(dy,dx)'));
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
    ov.innerHTML.includes('ДОБЫЧА ЭТАЖА') && ov.innerHTML.includes('ЧЁРНОЕ ЗЕРКАЛО') && ov.innerHTML.includes('КНИГА ОГНЯ') &&
    ov.innerHTML.includes('rare-item-icon summary') && ov.innerHTML.includes('loot-item-icon summary'));
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
  const mirrorTipOk = ov.style.display === 'block' && ov.innerHTML.includes(mirrorFind.name) &&
    ov.innerHTML.includes(mirrorFind.detail) && ov.innerHTML.includes(mirrorFind.tip) &&
    ov.innerHTML.includes('rare-item-icon summary');
  c.showFloorFindTip({clientX:100,clientY:100}, fireFinds[0], null);
  ok('всплывающая панель выводит эффект предмета и спрайт книги', mirrorTipOk &&
    ov.innerHTML.includes(fireFinds[0].name) && ov.innerHTML.includes('loot-item-icon summary'));
  const dashBefore=G.player.dashN; let prevented=false;
  c.handleGameKeyDown({code:'Space',key:' ',repeat:false,preventDefault(){prevented=true;}});
  ok('пробел закрывает сводку без рывка и возвращает игру',
    prevented && G.paused === false && G.floorFinds.length === 0 && G.player.dashN===dashBefore);

  const floor = G.floor;
  G.corpses.push({x:111,y:222,life:9},{x:-333,y:444,life:4}); G.raiseT = 1.25;
  p.x = G.portal.x; p.y = G.portal.y; p.dash = 0.2; G.portal.t = 2;
  c.update(0.01);
  ok('касание портала переводит на следующий этаж', G.floor === floor + 1,
    floor + ' → ' + G.floor);
  ok('новый этаж очищает трупы и прогресс их поднятия', G.corpses.length === 0 && G.raiseT === 0,
    'трупов ' + G.corpses.length + ', таймер ' + G.raiseT);
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

/* Регрессия реального сбоя: tooltip сводки оставался после удаления строки,
   затем пробел открывал level-up сквозь окно книги и оставлял вечную паузу. */
{ const c = fresh();
  const overlay = c.document.getElementById('ov');
  const tip = {style:{},innerHTML:'',offsetWidth:420,offsetHeight:180,
    getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0})};
  const oldGet = c.document.getElementById.bind(c.document);
  const oldQuery = c.document.querySelector.bind(c.document);
  c.document.getElementById = id => id === 'skilltip' ? tip : oldGet(id);
  c.document.querySelector = selector => selector === '#skilltip' ? tip : oldQuery(selector);
  c.newGame('bow', 'keys');
  const G = c.__api.G;
  const find = {ico:'BOOK',col:'#79c9ff',name:'КНИГА МОЛНИИ',detail:'КНИГА · ТИР 1 · +3',tip:'описание книги'};
  c.innerWidth = 1280; c.innerHeight = 720;
  G.floorFinds = [find]; c.showFloorFindSummary();
  c.showFloorFindTip({clientX:100,clientY:100},find,null);
  ok('tooltip сводки действительно открыт перед закрытием', tip.style.display === 'block');
  c.handleGameKeyDown({code:'Space',key:' ',repeat:false,preventDefault(){}});
  ok('пробел закрывает сводку вместе с наведённым tooltip', tip.style.display === 'none' && !G.floorFindSummaryOpen);
  c.handleGameKeyUp({code:'Space',key:' '});

  G.pending = 1; G.rerolls = 2;
  c.takeBook('shock');
  ok('книга имеет приоритетное модальное окно перед level-up', G.paused && overlay.innerHTML.includes('id="bkok"'));
  const rerolls = G.rerolls;
  c.handleGameKeyDown({code:'Space',key:' ',repeat:false,preventDefault(){}});
  ok('пробел сначала подтверждает книгу, не тратя переброс', !G.paused && G.rerolls === rerolls &&
    G.pending === 1 && overlay.innerHTML.includes('УРОВЕНЬ'));
  c.handleGameKeyUp({code:'Space',key:' '});
  c.handleGameKeyDown({code:'Digit1',key:'1',repeat:false,preventDefault(){}});
  ok('выбор карточки снимает overlay и не оставляет вечную паузу', G.pending === 0 && !G.paused &&
    G.levelUpCards === null && overlay.style.display === 'none' && tip.style.display === 'none');
  const time = G.time; G.hitStop = 0; c.loop(20);
  ok('после последовательности игровой цикл снова обновляется', G.time > time, G.time + ' > ' + time); }

{ const c = fresh(); c.newGame('bow', 'keys');
  const G = c.__api.G, p = G.player, overlay = c.document.getElementById('ov');
  p.dashN = 0; p.dashCd = 3;
  c.takeBook('cold');
  let prevented = false;
  c.handleGameKeyDown({code:'Space',key:' ',repeat:true,preventDefault(){prevented=true;}});
  ok('повторный пробел после рывка закрывает окно книги на КД', prevented && !G.paused &&
    overlay.style.display === 'none' && p.dashN === 0 && p.dashCd === 3);
  p.dashN = 1; p.dash = 0;
  c.handleGameKeyDown({code:'Space',key:' ',repeat:true,preventDefault(){}});
  ok('остаток удержания после окна не расходует новый заряд рывка', p.dashN === 1 && G.modalSpaceHeld === true);
  c.handleGameKeyUp({code:'Space',key:' '});
  c.handleGameKeyDown({code:'Space',key:' ',repeat:false,preventDefault(){}});
  ok('после отпускания новый пробел снова выполняет рывок', !G.modalSpaceHeld && p.dashN === 0 && p.dash > 0); }
