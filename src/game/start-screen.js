/* ---------- 11. СТАРТОВЫЙ ЭКРАН ---------- */
function startDevZone(){
  playConfirmSound();
  newGame('bow','keys',null,true);
  menuMode=false; $('#ov').classList.remove('menu');
  cv.classList.remove('mouse-mode');
  setHint(); renderSheet(); last=performance.now();
  $('#ov').style.display='none'; $('#ov').innerHTML='';
}
function startScreen(){
  $('#sheet').style.display = 'none';
  $('#inventory').style.display = 'none';
  $('#quickpause').style.display = 'none';
  $('#ov').style.display = 'flex';
  $('#ov').classList.add('menu');
  $('#ov').classList.remove('shop-menu');
  menuMode = true;
  const constReady = constellationReadyCount();
  const graveCount = graveyardRows().length;
  $('#ov').innerHTML =
    '<button id="devzoneb" class="dev-zone-entry"><b>DEV_ZONE</b><small>' +
      spawnDebugText('ПУСТАЯ АРЕНА · K — SPAWN','EMPTY ARENA · K — SPAWN') + '</small></button>' +
    brandHtml() + '<div class="menu-utility">' + languageSwitchHtml() + menuMusicButtonHtml() + menuSfxButtonHtml() + '</div>' +
    '<div class="cards class-cards">' + PLAYABLE_CLASSES.map(k => {
      const w = WEAPONS[k], spriteKey = HERO_SPRITE_KEY_BY_WEAPON[k], first = SUBCLASSES[k][0];
      return '<div class="card class-card" data-w="' + k + '" role="button" tabindex="0">' +
        '<img class="class-card-frame" src="' + CLASS_FRAME_DATA[spriteKey] + '" alt="" aria-hidden="true">' +
        '<div class="class-card-content"><div class="nm">' + w.nm + '</div>' +
        '<span class="class-subclass-preview" data-class-subclass-preview="1" data-class-key="' + k +
          '" aria-hidden="true" style="background-image:url(' + SUBCLASS_HERO_SPRITE_DATA[first.id] + ')"></span>' +
        '<div class="class-subclass-name" data-class-subclass-label="1">' + first.nm + '</div>' +
        '<div class="nt">' + w.desc + '</div></div>' +
      '</div>';
    }).join('') + '</div>' +
    '<div class="meta-actions">' +
      '<button id="shopb" class="shop-entry"><canvas id="coinl" class="shopcoin"></canvas>МАГАЗИН<canvas id="coinr" class="shopcoin"></canvas></button>' +
      '<button id="constb" class="const-entry"><canvas id="conststarl" class="conststar"></canvas><span class="const-entry-copy">СОЗВЕЗДИЯ<small class="' + (constReady ? 'ready' : '') + '">' +
        (constReady ? 'ДОСТУПНО ОТКРЫТИЙ: ' + constReady : 'КАРТА ВЕЧНОЙ ОХОТЫ') + '</small></span><canvas id="conststarr" class="conststar"></canvas></button>' +
      '<button id="graveb" class="grave-entry"><canvas id="graveicon" width="46" height="46"></canvas><span class="grave-entry-copy">КЛАДБИЩЕ<small>' +
        (graveCount ? 'последних записей: ' + graveCount : 'ПОКА ПУСТО') + '</small></span></button>' +
      '<button id="settingsb" class="settings-entry"><span class="settings-entry-icon" aria-hidden="true">⚙</span><span>НАСТРОЙКИ</span></button></div>' +
    '<span id="bank">В БАНКЕ: ' + Math.round(Store.data.gold).toLocaleString(LANGUAGE === 'ru' ? 'ru-RU' : 'en-US') + ' золота</span>';
  drawBrandTitle();
  drawGraveIcon();
  bindLanguageSwitch();
  bindMenuMusicButton();
  bindMenuSfxButton();
  tryStartMenuMusic();
  localizeTree($('#ov'));
  document.querySelectorAll('#ov .class-card').forEach(el => {
    const openClass = () => { playConfirmSound(); subclassScreen(el.dataset.w); };
    el.onclick = openClass;
    el.onkeydown = e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openClass();
    };
  });
  $('#shopb').onclick = () => { playConfirmSound(); shopScreen(startScreen); };
  $('#constb').onclick = () => { playConfirmSound(); constellationScreen(startScreen); };
  $('#graveb').onclick = () => runConfirmedMenuAction(graveyardScreen);
  $('#settingsb').onclick = () => runConfirmedMenuAction(menuSettingsScreen);
  $('#devzoneb').onclick = startDevZone;
}

/* Второй шаг: класс задаёт стиль атаки, подкласс — постоянный рост забега. */
function subclassScreen(wk){
  const W = WEAPONS[wk], choices = SUBCLASSES[wk] || [];
  menuMode = true; $('#ov').classList.add('menu');
  $('#ov').innerHTML =
    brandHtml() +
    '<h2 class="menu-screen-title">' + W.nm + '</h2>' +
    '<h2 class="menu-screen-note">выберите подкласс · его бонусы растут с каждым уровнем</h2>' +
    '<div class="cards">' + choices.map(s =>
      '<div class="card subclass-card" data-s="' + s.id + '">' +
        '<img class="subclass-card__frame" src="' + SUBCLASS_FRAME_DATA[s.id] + '" alt="" aria-hidden="true">' +
        '<div class="subclass-card__content"><div class="nm">' + s.nm + '</div>' +
        heroPreviewHTML(HERO_SPRITE_KEY_BY_WEAPON[wk], 'subclass-sprite', s.id) +
        '<div class="nt">' + s.desc + '</div></div>' +
      '</div>').join('') + '</div>' +
    '<button id="back">НАЗАД К ВЫБОРУ КЛАССА</button>';
  drawBrandTitle();
  document.querySelectorAll('#ov .card').forEach(el => el.onclick = () => {
    playConfirmSound();
    controlScreen(wk, el.dataset.s);
  });
  $('#back').onclick = () => runConfirmedMenuAction(startScreen);
}

/* Второй шаг стартового экрана: чем играть */
const CONTROLS = {
  keys: {nm:'КЛАВИАТУРА', ico:'WASD',
         desc:'Движение на WASD или стрелках. Точный контроль остановки — удобно для билдов на стрельбу с места.'},
  mouse:{nm:'МЫШЬ', ico:'\u2316',
         desc:'Персонаж непрерывно бежит к курсору. Чтобы встать, наведите курсор на себя — вокруг персонажа есть зона покоя.'},
};
function controlScreen(wk, subclassKey){
  const subclass = (SUBCLASSES[wk] || []).find(s => s.id === subclassKey);
  menuMode = true; $('#ov').classList.add('menu');
  $('#ov').innerHTML =
    brandHtml() +
    '<h2 class="menu-screen-title">' + WEAPONS[wk].nm + '</h2>' +
    '<div class="k" style="font-size:14px">подкласс: ' + (subclass ? subclass.nm : '—') + '</div>' +
    '<h2 class="menu-screen-note">чем управлять? · сменить можно в любой момент на C</h2>' +
    '<div class="cards">' + Object.keys(CONTROLS).map(ck => {
      const C = CONTROLS[ck];
      return '<div class="card" data-c="' + ck + '">' +
        '<div class="cat">управление</div>' +
        '<div class="nm">' + C.nm + '</div>' +
        '<div class="vl">' + C.ico + '</div>' +
        '<div class="nt">' + C.desc + '</div></div>';
    }).join('') + '</div>' +
    '<div class="k" style="font-size:13px">Атака автоматическая в обеих схемах · ПРОБЕЛ — рывок · P — быстрая пауза · ESC — настройки паузы</div>' +
    '<button id="back">НАЗАД К ВЫБОРУ КЛАССА</button>';
  drawBrandTitle();
  document.querySelectorAll('#ov .card').forEach(el => el.onclick = () => {
    newGame(wk, el.dataset.c, subclassKey);
    menuMode = false; $('#ov').classList.remove('menu');
    cv.classList.toggle('mouse-mode', el.dataset.c === 'mouse');
    setHint(); renderSheet(); last = performance.now();
    // Покупка «Первый шаг» выдаёт именно выборы из обычной раздачи: все фильтры,
    // приоритеты и правила классов остаются одними и теми же уже с первого боя.
    if (G.pending) showLevelUp();
    else { $('#ov').style.display = 'none'; $('#ov').innerHTML = ''; }
  });
  $('#back').onclick = () => runConfirmedMenuAction(() => subclassScreen(wk));
}

/* Подсказка внизу экрана зависит от выбранной схемы */
/* Смена схемы управления на лету. Обе схемы уже полностью поддержаны в update(),
   так что переключение — это ровно смена флага плюс уборка за прошлой схемой. */
function toggleControl(){
  G.control = G.control === 'mouse' ? 'keys' : 'mouse';
  if (G.control === 'mouse'){
    // Курсор с прошлого раза мог остаться где угодно, а мышиная схема гонит
    // персонажа к нему постоянно. Ставим цель в фактическую экранную позицию
    // героя с учётом масштаба и текущей экранной тряски.
    const playerScreen=worldToScreen(G.player.x,G.player.y,G.player);
    G.mouse.x=playerScreen.x; G.mouse.y=playerScreen.y;
  }
  // Зажатая WASD осталась бы в G.keys как нажатая: keyup по ней уже не придёт
  // в том смысле, в каком его ждёт схема. Гасим всё, что удерживалось.
  for (const k in G.keys) G.keys[k] = false;
  const p = G.player; p.moving = false;
  setHint();
  toast('УПРАВЛЕНИЕ: ' + CONTROLS[G.control].nm);
  G.fx.push({t:'ring', x:p.x, y:p.y, r:8, max:70, life:0.4, col:'#4fd1c5'});
}

function setHint(){
  $('#hint').textContent = (G.control === 'mouse'
      ? 'МЫШЬ — движение к курсору, наведите на себя чтобы встать'
      : 'WASD / ЦФЫВ — движение')
    + ' · атака автоматическая · ПРОБЕЛ — рывок · C — сменить управление · TAB — инвентарь · P — быстрая пауза · ESC — настройки паузы' +
    (G.devZone?' · DEV_ZONE: K — SPAWN MENU · J — GOD +100% SPEED' + (G.devGodMode?' [ON]':' [OFF]'):'');
}

function toggleDevGodMode(){
  if (!G || !G.devZone) return false;
  G.devGodMode=!G.devGodMode;
  recalc();
  if (G.devGodMode){
    G.player.hp=D.life;
    G.player.inv=0;
  }
  setHint();
  toast(G.devGodMode ? 'DEV GOD MODE · +100% SPEED: ON' : 'DEV GOD MODE · +100% SPEED: OFF');
  return G.devGodMode;
}

function leaveSparkSigil(){
  if (!amu('sparkstepBoots')) return false;
  const p=G.player,sigil={x:p.x,y:p.y,life:0.4,max:0.4};
  G.sparkSigils.push(sigil);
  G.fx.push({t:'ring',x:sigil.x,y:sigil.y,r:8,max:34,life:0.4,col:'#67d8dc'});
  return true;
}
function leaveWorldShadow(){
  if (!amu('betweenWorldsBoots') || G.amuT.betweenWorldsBoots>0) return false;
  const p=G.player;
  G.worldShadow={x:p.x,y:p.y,r:p.r,life:1,eliteUntil:G.time+0.5};
  G.amuT.betweenWorldsBoots=3;
  G.fx.push({t:'ring',x:p.x,y:p.y,r:6,max:42,life:0.35,col:'#9f7aea'});
  return true;
}
function tickSparkSigils(dt){
  for (let i=G.sparkSigils.length-1;i>=0;i--){
    const sigil=G.sparkSigils[i]; sigil.life-=dt;
    if (sigil.life>1e-9) continue;
    G.sparkSigils.splice(i,1);
    const target=nearestEnemies(sigil,1,e=>!e.dead&&e.hp>0)[0];
    if (!target) continue;
    const raw=avgHit()*0.45,passed=mitigate(target,raw,0,false);
    applyDamage(target,passed,false,false,0,false,{noItemTriggers:true});
    G.fx.push({t:'bolt',x:sigil.x,y:sigil.y,x2:target.x,y2:target.y,life:0.2,col:'#67d8dc'});
  }
}

function tryDash(){
  const p = G.player;
  if (p.dashN <= 0 || p.dash > 0) return false;
  p.dashN--;
  if (p.dashCd <= 0) p.dashCd = D.dashCd;            // откат начинается в момент расходования
  p.dash = DASH_DURATION;
  p.inv = D.iframe;
  p.dashHits = [];
  p.shortCircuitHits = [];
  p.stillT=0;
  p.heartSecondCharge=0;
  if (amu('stepBeyond')) p.stepBeyondReady=true;
  if (p.hobnailedActive){ p.hobnailedActive=false; recalc(); }
  leaveWorldShadow();
  leaveSparkSigil();
  return true;
}
