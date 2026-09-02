/* ---------- 12. ВВОД ---------- */
/* e.key зависит от активной раскладки: физическая W при русской раскладке
   приходит как «ц». e.code описывает именно положение клавиши, поэтому
   приводим игровые кнопки к каноническим именам до записи в G.keys.
   Fallback на e.key сохраняет совместимость с тестами и старыми браузерами. */
const PHYSICAL_KEYS = {
  KeyW:'w', KeyA:'a', KeyS:'s', KeyD:'d',
  KeyC:'c', KeyV:'v', KeyJ:'j', KeyK:'k', KeyL:'l', KeyP:'p',
  F3:'f3',
  Digit1:'1', Digit2:'2', Digit3:'3', Digit4:'4',
  Numpad1:'1', Numpad2:'2', Numpad3:'3', Numpad4:'4',
  ArrowUp:'arrowup', ArrowDown:'arrowdown', ArrowLeft:'arrowleft', ArrowRight:'arrowright',
  Space:' ', Tab:'tab', Escape:'escape'
};
function inputKey(e){
  return PHYSICAL_KEYS[e.code] || String(e.key || '').toLowerCase();
}
/* Модалка может открыться, пока пробел от только что выполненного рывка всё ещё
   удерживается. Тогда браузер присылает только keydown с repeat=true. Принимаем
   первый такой сигнал, но блокируем остаток удержания до физического keyup. */
function continueModalWithSpace(e, buttonId){
  e.preventDefault();
  if (G.modalSpaceHeld) return false;
  G.modalSpaceHeld = true;
  const button = $('#' + buttonId);
  if (button && typeof button.onclick === 'function') button.onclick();
  return true;
}
function handleGameKeyDown(e){
  unlockSound();
  const k = inputKey(e);
  if (!e.repeat&&k==='f3'){ e.preventDefault(); toggleDiagnostics(); return; }
  if (Diagnostics.open){
    if (!e.repeat&&k==='escape'){ e.preventDefault(); closeDiagnostics(); }
    return;
  }
  if (!G) return;
  if (G.over) return;
  // Быстрая P-пауза перехватывает весь ввод. P продолжает игру, а Escape
  // заменяет минимальную надпись полноценным экраном настроек паузы.
  if (G.quickPaused){
    if (!e.repeat&&k==='p'){e.preventDefault();setQuickPause(false);}
    else if (!e.repeat&&k==='escape'){e.preventDefault();setQuickPause(false);setPauseSettings(true);}
    return;
  }
  // Новый физический нажим также лечит пропущенный keyup после потери фокуса.
  if (k === ' ' && !e.repeat) G.modalSpaceHeld = false;
  // Spawn Menu так же перехватывает ввод целиком: K/Escape закрывают окно,
  // остальные клавиши не доходят до движения и боевых действий.
  if (G.spawnOpen){
    if (!e.repeat && (k === 'k' || k === 'escape')){ e.preventDefault(); closeSpawnMenu(); }
    return;
  }
  // Тестовая панель полностью перехватывает клавиатуру, чтобы поиск не двигал
  // героя и не тратил рывок. L либо Escape закрывают её и продолжают бой.
  if (G.testOpen){
    if (!e.repeat && (k === 'l' || k === 'escape')){ e.preventDefault(); closeTestPanel(); }
    return;
  }
  // Сводка добычи перехватывает ввод целиком. Пробел повторяет «Продолжить»,
  // но не проходит дальше к перебросу карточек или рывку героя.
  if (G.floorFindSummaryOpen){
    if (k === ' ') continueModalWithSpace(e, 'findok');
    return;
  }
  // Окно ручной находки имеет приоритет над ожидающим level-up. Раньше пробел
  // открывал карточки прямо поверх книги, оставляя G.paused=true после выбора.
  const overlay = $('#ov');
  const pickupContinueId = overlay && overlay.style.display === 'flex'
    ? (overlay.innerHTML.includes('id="bkok"') ? 'bkok' : overlay.innerHTML.includes('id="amok"') ? 'amok' : '')
    : '';
  if (pickupContinueId){
    if (k === ' ') continueModalWithSpace(e, pickupContinueId);
    return;
  }
  // После подтверждения окна то же удержание не должно тут же перебросить
  // карточки или выполнить рывок. Новый пробел станет доступен после keyup.
  if (k === ' ' && G.modalSpaceHeld){ e.preventDefault(); return; }
  // В окне повышения уровня пробел принадлежит перебросу, а не рывку.
  // Повторный keydown от удержания не должен сжигать весь запас перебросов.
  if (G.pending > 0 && k === ' '){
    e.preventDefault();
    if (!e.repeat) rerollLevelUp();
    return;
  }
  if (G.pending > 0 && ['1','2','3','4'].includes(k)){
    e.preventDefault();
    if (!e.repeat) chooseLevelUpCard(Number(k)-1);
    return;
  }
  if (k === 'j' && !e.repeat && G.devZone){ e.preventDefault(); toggleDevGodMode(); return; }
  if (k === 'k' && !e.repeat){ e.preventDefault(); openSpawnMenu(); return; }
  if (k === 'l' && !e.repeat){ e.preventDefault(); openTestPanel(); return; }
  // Инвентарь — безопасная пауза: пока он открыт, действия персонажа не должны
  // тратить рывки, менять управление или срабатывать от случайных клавиш.
  if (G.inventoryOpen && !['tab','escape','p'].includes(k)) return;
  G.keys[k] = true;
  if (k === ' '){                                                   // рывок
    e.preventDefault();
    tryDash();
  }
  // e.repeat: браузер шлёт keydown повторно, пока клавиша зажата.
  // Без этой проверки удержание C дёргало бы схему по десять раз в секунду.
  if (k === 'c' && !e.repeat) toggleControl();
  if (k === 'tab' && !e.repeat){
    e.preventDefault();                            // иначе Tab уводит фокус со страницы
    toggleInventory();
  }
  if (k === 'v' && !e.repeat && !G.inventoryOpen){
    const sh = $('#sheet');
    sh.style.display = sh.style.display === 'block' ? 'none' : 'block';
    renderSheet();
  }
  if (k === 'p' && !e.repeat){
    if (G.inventoryOpen){ toggleInventory(); return; }
    if (G.pending || G.over || $('#ov').style.display === 'flex') return;  // модалки паузу не трогают
    e.preventDefault();
    if (G.paused) setPauseSettings(false);
    else setQuickPause(true);
    return;
  }
  if (k === 'escape' && !e.repeat){
    if (G.inventoryOpen){ toggleInventory(); return; }
    if (G.pending || G.over || $('#ov').style.display === 'flex') return;
    setPauseSettings(!G.paused);
  }
}
addEventListener('keydown', handleGameKeyDown);
function handleGameKeyUp(e){
  if (!G) return;
  const k = inputKey(e);
  G.keys[k] = false;
  if (k === ' ') G.modalSpaceHeld = false;
}
addEventListener('keyup', handleGameKeyUp);
addEventListener('pointerdown', unlockSound, {passive:true});
addEventListener('pointerover', handleMenuHover, {passive:true});
$('#endrun').onclick = endRun;
$('#resumegame').onclick = () => setPauseSettings(false);
$('#sfxmute').onclick = toggleSfxMute;
$('#sfxvolume').oninput = event => setSfxVolume(event.target.value);
cv.addEventListener('mousemove', e => {
  if (!G) return;
  const r = cv.getBoundingClientRect();
  G.mouse.x = e.clientX - r.left; G.mouse.y = e.clientY - r.top;
});
cv.addEventListener('contextmenu', e => e.preventDefault());

/* Подставляется на сборке. Если осталось как есть — файл открыт напрямую. */
const BUILD = '__BUILD__';
$('#build').textContent = BUILD.indexOf('BUILD') >= 0 ? 'dev' : BUILD;

diagInit();
resize();
Store.load().then(() => { startScreen(); requestAnimationFrame(loop); });
