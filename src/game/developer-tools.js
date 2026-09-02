/* ---------- 11b. ЛЁГКОЕ DEBUG-МЕНЮ СПАВНА ----------
   Все кнопки вызывают канонические spawnEnemy()/spawnPack(). Меню лишь
   переставляет уже готовое существо поближе к игроку и не касается очереди,
   таймера волны, номера этажа или счётчиков убийств. */
function debugSpawnPoint(radius, ignored=[], minDist=100, maxDist=250){
  const p = G.player, margin = Math.max(40, radius + 8);
  const occupied = G.enemies.filter(e => !ignored.includes(e));
  let best = null, bestClearance = -Infinity;
  for (let i = 0; i < 24; i++){
    const a = rnd(0, Math.PI*2), wanted = rnd(minDist, maxDist);
    const x = clamp(p.x + Math.cos(a)*wanted, -ARENA+margin, ARENA-margin);
    const y = clamp(p.y + Math.sin(a)*wanted, -ARENA+margin, ARENA-margin);
    const d = Math.hypot(x-p.x, y-p.y);
    if (d < minDist || d > maxDist) continue;
    let clearance = Infinity;
    for (const e of occupied)
      clearance = Math.min(clearance, Math.hypot(x-e.x, y-e.y) - radius - e.r);
    if (clearance >= 18) return {x,y};
    if (clearance > bestClearance){ bestClearance = clearance; best = {x,y}; }
  }
  if (best) return best;
  const a = Math.atan2(-p.y, -p.x) + rnd(-0.45, 0.45);
  const wanted = (minDist + maxDist) * 0.5;
  return {
    x:clamp(p.x + Math.cos(a)*wanted, -ARENA+margin, ARENA-margin),
    y:clamp(p.y + Math.sin(a)*wanted, -ARENA+margin, ARENA-margin)
  };
}
function debugPlaceEnemy(e){
  const pt = debugSpawnPoint(e.r, [e]);
  e.x = pt.x; e.y = pt.y;
  e.spriteFace = e.x < G.player.x ? 1 : -1;
  return e;
}
function debugSpawnEnemy(typeKey){
  if (!G || !ETYPES[typeKey]) return null;
  return debugPlaceEnemy(spawnEnemy(typeKey));
}
function debugSpawnEliteVariant(variantId){
  if (!G || !ELITE_VARIANTS[variantId]) return null;
  return debugPlaceEnemy(spawnEnemy('pack',null,variantId));
}
function debugSpawnBoss(bossId){
  if (!G || !BOSS_TYPES[bossId]) return null;
  return debugPlaceEnemy(spawnEnemy('boss', bossId));
}
function debugSpawnElitePack(){
  if (!G) return null;
  // До пятого этажа стандартная elite-event логика ещё не даёт аффикс.
  // Debug-кнопка поднимает только уровень каталога пачки до первого валидного,
  // но здоровье/урон участников spawnEnemy() всё равно считает по G.floor.
  const pk = spawnPack(Math.max(5, G.floor));
  const pt = debugSpawnPoint(46, pk.members, 140, 210);
  const n = pk.members.length;
  for (let i = 0; i < n; i++){
    const a = Math.PI*2*i/n, spread = n === 1 ? 0 : 30;
    const e = pk.members[i], margin = Math.max(40, e.r+8);
    e.x = clamp(pt.x + Math.cos(a)*spread, -ARENA+margin, ARENA-margin);
    e.y = clamp(pt.y + Math.sin(a)*spread, -ARENA+margin, ARENA-margin);
    e.spriteFace = e.x < G.player.x ? 1 : -1;
  }
  return pk;
}
function debugSpawnRandomEnemy(){
  const keys = Object.keys(ETYPES);
  return debugSpawnEnemy(keys[Math.floor(Math.random()*keys.length)]);
}
function debugSpawnRandomBoss(){ return debugSpawnBoss(BOSS_KEYS[Math.floor(Math.random()*BOSS_KEYS.length)]); }
/* Находки кладутся на землю, а не выдаются напрямую. Минимальная дистанция
   не даёт предмету возникнуть под ногами, максимальная строго соблюдает
   100-единичный радиус из QA-контракта. У края арены запасной вариант всегда
   направлен к центру, поэтому clamp не может вытолкнуть находку за радиус. */
function debugFindPoint(){
  const p=G.player, margin=18;
  for (let i=0;i<24;i++){
    const a=rnd(0,Math.PI*2), wanted=rnd(56,100);
    const x=clamp(p.x+Math.cos(a)*wanted,-ARENA+margin,ARENA-margin);
    const y=clamp(p.y+Math.sin(a)*wanted,-ARENA+margin,ARENA-margin);
    const d=Math.hypot(x-p.x,y-p.y);
    if (d>=56&&d<=100) return {x,y};
  }
  const a=Math.atan2(-p.y,-p.x), wanted=78;
  return {
    x:clamp(p.x+Math.cos(a)*wanted,-ARENA+margin,ARENA-margin),
    y:clamp(p.y+Math.sin(a)*wanted,-ARENA+margin,ARENA-margin)
  };
}
function debugSpawnFind(kind,key){
  if (!G||!G.player) return null;
  if (kind==='amu'&&!AMULETS[key]||kind==='book'&&!BOOKS[key]||kind==='totem'&&!TOTEMS[key]) return null;
  if (kind!=='amu'&&kind!=='book'&&kind!=='totem') return null;
  const pt=debugFindPoint(), orb={x:pt.x,y:pt.y,r:9};
  orb[kind]=key;
  G.orbs.push(orb);
  playLootDrop();
  return orb;
}
function debugSpawnItem(key){ return debugSpawnFind('amu',key); }
function debugSpawnBook(key){ return debugSpawnFind('book',key); }
function debugSpawnTotem(key){ return debugSpawnFind('totem',key); }
function spawnDebugText(ru,en){ return LANGUAGE === 'en' ? en : ru; }
function setSpawnStatus(text){ const el=$('#spawnstatus'); if (el) el.textContent=text; }
function debugClearEnemies(){
  if (!G) return false;
  /* При пустой очереди удаление последнего врага открыло бы портал на следующем
     кадре. В таком состоянии кнопка честно отказывается работать: это сохраняет
     progression без специального флага в основном игровом цикле. */
  if (!G.devZone && G.spawnQueue === 0 && !G.portal){
    setSpawnStatus(spawnDebugText('Clear Enemies недоступна: это открыло бы портал и изменило прогрессию.',
      'Clear Enemies is unavailable: it would open the portal and change progression.'));
    return false;
  }
  G.enemies.length = 0; G.eshots.length = 0;
  G.pools.length = 0; G.eliteAcidPools.length = 0; G.bossPools.length = 0; G.bossTrails.length = 0; G.bossHazards.length = 0;
  G.packs.length = 0; G.banner = false;
  setSpawnStatus(spawnDebugText('Враги и их опасные зоны очищены; очередь и таймер волны сохранены.',
    'Enemies and their hazards cleared; wave queue and timer preserved.'));
  return true;
}
function spawnMenuRow(key, name, attr){
  return '<div class="spawnrow"><span>' + tr(name) + ' <span class="k">[' + key + ']</span></span><button ' + attr + '="' + key + '">Spawn</button></div>';
}
function spawnMenuSection(title, rows){
  return '<div class="spawnsection"><h2><button type="button" class="spawnsectiontoggle" aria-expanded="false">' +
    '<span>' + title + '</span><span class="spawnchevron" aria-hidden="true">&#9656;</span></button></h2>' +
    '<div class="spawngrid" hidden>' + rows + '</div></div>';
}
function renderSpawnMenu(){
  const enemies = Object.keys(ETYPES).map(k => spawnMenuRow(k, ETYPES[k].nm, 'data-spawn-enemy')).join('');
  const elites = Object.keys(ELITE_VARIANTS).map(k => spawnMenuRow(k, ELITE_VARIANTS[k].nm, 'data-spawn-elite')).join('');
  const bosses = BOSS_KEYS.map(k => spawnMenuRow(k, BOSS_TYPES[k].nm, 'data-spawn-boss')).join('');
  const items = AMU_KEYS.map(k => spawnMenuRow(k, AMULETS[k].nm, 'data-spawn-item')).join('');
  const books = BOOK_KEYS.map(k => spawnMenuRow(k, BOOKS[k].nm, 'data-spawn-book')).join('');
  const totems = TOTEM_KEYS.map(k => {
    const tier=Math.min(4,totemTier(k)+1), rank=tr(TOTEM_RANKS[tier-1])+' ';
    return spawnMenuRow(k,rank+tr(TOTEMS[k].nm),'data-spawn-totem');
  }).join('');
  const hint=spawnDebugText('K или Escape — закрыть · игра приостановлена','K or Escape — close · game paused');
  const normalTitle=spawnDebugText('ОБЫЧНЫЕ ВРАГИ','NORMAL ENEMIES');
  const eliteTitle=spawnDebugText('ЭЛИТА / ОСОБЫЕ','ELITES / SPECIAL');
  const bossTitle=spawnDebugText('БОССЫ','BOSSES');
  const itemTitle=spawnDebugText('ПРЕДМЕТЫ','ITEMS');
  const bookTitle=spawnDebugText('КНИГИ','BOOKS');
  const totemTitle=spawnDebugText('ТОТЕМЫ · СЛЕДУЮЩИЙ РАНГ','TOTEMS · NEXT RANK');
  const eliteName=spawnDebugText('Элитная пачка со стандартными аффиксами','Elite pack with standard affixes');
  $('#ov').innerHTML = '<div id="spawnpanel"><h1>Spawn Menu</h1><div class="k">' + hint + '</div>' +
    spawnMenuSection(normalTitle,enemies) +
    spawnMenuSection(eliteTitle,elites + '<div class="spawnrow"><span>' + eliteName + '</span><button id="spawnelite">Spawn</button></div>') +
    spawnMenuSection(bossTitle,bosses) +
    spawnMenuSection(itemTitle,items) +
    spawnMenuSection(bookTitle,books) +
    spawnMenuSection(totemTitle,totems) +
    '<div class="spawnactions"><button id="spawnrandomenemy">Spawn Random Enemy</button><button id="spawnrandomboss">Spawn Random Boss</button><button id="spawnclear">Clear Enemies</button></div>' +
    '<div id="spawnstatus">' + spawnDebugText('Существа: 100–250; находки: не дальше 100 единиц от игрока.','Creatures: 100–250; finds: within 100 units of the player.') + '</div></div>';
  document.querySelectorAll('#spawnpanel .spawnsectiontoggle').forEach(toggle => toggle.onclick = () => {
    const grid=toggle.closest('.spawnsection').querySelector('.spawngrid');
    const expanded=toggle.getAttribute('aria-expanded')==='true';
    toggle.setAttribute('aria-expanded',String(!expanded));
    grid.hidden=expanded;
  });
  document.querySelectorAll('[data-spawn-enemy]').forEach(el => el.onclick = () => {
    const e=debugSpawnEnemy(el.dataset.spawnEnemy); setSpawnStatus(e ? spawnDebugText('Создан: ','Spawned: ') + tr(e.t.nm) : spawnDebugText('Неизвестный тип врага.','Unknown enemy type.'));
  });
  document.querySelectorAll('[data-spawn-elite]').forEach(el => el.onclick = () => {
    const e=debugSpawnEliteVariant(el.dataset.spawnElite); setSpawnStatus(e ? spawnDebugText('Создана элита: ','Spawned elite: ') + tr(e.t.nm) : spawnDebugText('Неизвестная разновидность элиты.','Unknown elite variant.'));
  });
  document.querySelectorAll('[data-spawn-boss]').forEach(el => el.onclick = () => {
    const e=debugSpawnBoss(el.dataset.spawnBoss); setSpawnStatus(e ? spawnDebugText('Создан босс: ','Spawned boss: ') + tr(e.t.nm) : spawnDebugText('Неизвестный тип босса.','Unknown boss type.'));
  });
  document.querySelectorAll('[data-spawn-item]').forEach(el => el.onclick = () => {
    const key=el.dataset.spawnItem, o=debugSpawnItem(key); setSpawnStatus(o ? spawnDebugText('Предмет появился рядом: ','Item spawned nearby: ')+tr(AMULETS[key].nm) : spawnDebugText('Неизвестный предмет.','Unknown item.'));
  });
  document.querySelectorAll('[data-spawn-book]').forEach(el => el.onclick = () => {
    const key=el.dataset.spawnBook, o=debugSpawnBook(key); setSpawnStatus(o ? spawnDebugText('Книга появилась рядом: ','Book spawned nearby: ')+tr(BOOKS[key].nm) : spawnDebugText('Неизвестная книга.','Unknown book.'));
  });
  document.querySelectorAll('[data-spawn-totem]').forEach(el => el.onclick = () => {
    const key=el.dataset.spawnTotem, o=debugSpawnTotem(key); setSpawnStatus(o ? spawnDebugText('Тотем появился рядом: ','Totem spawned nearby: ')+tr(TOTEMS[key].nm) : spawnDebugText('Неизвестный тотем.','Unknown totem.'));
  });
  $('#spawnelite').onclick = () => { const pk=debugSpawnElitePack(); setSpawnStatus(pk ? spawnDebugText('Создана элитная пачка: ','Spawned elite pack: ') + tr(pk.nm) : spawnDebugText('Пачка не создана.','Pack was not spawned.')); };
  $('#spawnrandomenemy').onclick = () => { const e=debugSpawnRandomEnemy(); setSpawnStatus(e ? spawnDebugText('Случайный враг: ','Random enemy: ') + tr(e.t.nm) : spawnDebugText('Враг не создан.','Enemy was not spawned.')); };
  $('#spawnrandomboss').onclick = () => { const e=debugSpawnRandomBoss(); setSpawnStatus(e ? spawnDebugText('Случайный босс: ','Random boss: ') + tr(e.t.nm) : spawnDebugText('Босс не создан.','Boss was not spawned.')); };
  $('#spawnclear').onclick = debugClearEnemies;
}
function closeSpawnMenu(){
  if (!G || !G.spawnOpen) return;
  G.spawnOpen = false; G.paused = !!G.spawnWasPaused;
  $('#ov').style.display = 'none'; $('#ov').innerHTML = '';
  $('#pauseov').style.display = G.paused ? 'flex' : 'none';
  last = performance.now();
}
function openSpawnMenu(){
  if (!G || G.over || G.pending || G.inventoryOpen || G.testOpen || $('#ov').style.display === 'flex') return;
  G.spawnOpen = true; G.spawnWasPaused = G.paused; G.paused = true;
  $('#pauseov').style.display = 'none';
  $('#ov').style.display = 'flex'; $('#ov').classList.remove('menu');
  renderSpawnMenu();
}

/* Скрытая от обычного игрока панель для быстрой проверки баланса. Карточки
   берутся из того же MODS, что и обычный level-up, и используют те же броски
   значений. Поиск намеренно работает и по читаемому имени, и по id каталога. */
function testValue(m){
  const v = rollModValue(m);
  const shown = m.kind === 'flag' ? 'свойство' : m.kind === 'more' ? '×' + (1+v/100).toFixed(2) :
    m.kind === 'chance' ? Math.round(v) + '%' : m.kind === 'inc' ? '+' + Math.round(v) + '%' : '+' + (Math.round(v*10)/10);
  return {v, shown};
}
function testPreview(m){
  const rolls = G.testRolls || (G.testRolls = {});
  return rolls[m.id] || (rolls[m.id] = testValue(m));
}
function testSkillMatches(m, q){
  const bothLanguages = m.nm + ' ' + tr(m.nm) + ' ' + m.id + ' ' + m.cat + ' ' + tr(m.cat);
  return !q || bothLanguages.toLowerCase().includes(q);
}
function renderTestPanel(){
  const input = $('#testsearch'), q = input ? input.value.trim().toLowerCase() : '';
  const compatible = m => modFitsWeapon(m, G.weapon);
  const list = MODS.filter(m => compatible(m) && testSkillMatches(m, q)).slice(0, 80);
  $('#testresults').innerHTML = list.length ? list.map(m => {
    const preview = testPreview(m);
    const range = m.kind === 'flag' ? 'постоянное свойство' : m.r[0] === m.r[1] ? preview.shown :
      (m.kind === 'inc' ? '+' : '') + m.r[0] + '…' + m.r[1] + (m.kind === 'more' ? '% множитель' : m.kind === 'flat' ? '' : '%');
    const taken = m.kind === 'flag' && G.bag.has(m.stat);
    return '<div class="testskill" data-test-tip="' + m.id + '"><div class="tsbody"><div class="tsname">' + m.nm + '</div><div class="tsmeta">' + m.cat + ' · ' + range + ' · ' + m.id + '</div>' + classAvailabilityHtml(m) + '</div>' +
      '<button data-test-id="' + m.id + '"' + (taken ? ' disabled' : '') + '>' + (taken ? 'ВЗЯТО' : 'ВЫДАТЬ') + '</button></div>';
  }).join('') : '<div class="k" style="padding:14px">Ничего не найдено.</div>';
  document.querySelectorAll('[data-test-id]').forEach(el => el.onclick = () => grantTestSkill(el.dataset.testId));
  document.querySelectorAll('[data-test-tip]').forEach(el => {
    const m = MODS.find(x => x.id === el.dataset.testTip), preview = testPreview(m);
    const card = {m, v:preview.v, val:preview.shown};
    el.onmouseenter = ev => showSkillTip(ev, card);
    el.onmousemove = moveSkillTip;
    el.onmouseleave = hideSkillTip;
  });
}
function grantTestSkill(id){
  const m = MODS.find(x => x.id === id); if (!m) return;
  if (m.kind === 'flag' && G.bag.has(m.stat)) return;
  const t = testPreview(m);
  delete G.testRolls[m.id];
  G.bag.add(m.stat, m.kind, t.v);
  G.picks.push({id:m.id, nm:m.nm, val:t.shown, v:t.v, cat:m.cat});
  recalc();
  // При тестировании свиты новые лимиты сразу заполняются, чтобы не ждать
  // смерти следующего врага и видеть результат карточки моментально.
  if (D.hasMin) while (G.minions.length < D.minMax) spawnMinion();
  renderSheet(); renderTestPanel();
  $('#testsearch').focus();
}
function closeTestPanel(){
  if (!G || !G.testOpen) return;
  G.testOpen = false; G.paused = false;
  hideSkillTip();
  $('#ov').style.display = 'none'; $('#ov').innerHTML = '';
  last = performance.now();
}
function openTestPanel(){
  if (!G || G.over || G.pending || G.inventoryOpen || $('#ov').style.display === 'flex') return;
  G.testOpen = true; G.testRolls = {}; G.paused = true;
  $('#pauseov').style.display = 'none';
  $('#ov').style.display = 'flex'; $('#ov').classList.remove('menu');
  $('#ov').innerHTML = '<div id="testpanel"><h1>ТЕСТОВАЯ ВЫДАЧА НАВЫКОВ</h1><div class="k">Поиск по названию, категории или ID · значения бросаются в обычном диапазоне</div>' +
    '<input id="testsearch" autocomplete="off" placeholder="Например: чума, crit, скорость, min."><div id="testresults"></div><button id="testclose">ПРОДОЛЖИТЬ</button></div>';
  $('#testsearch').oninput = renderTestPanel;
  $('#testclose').onclick = closeTestPanel;
  renderTestPanel(); $('#testsearch').focus();
}

function gameOver(endedEarly){
  G.over = true;
  G.paused = true;
  G.endedEarly = !!endedEarly;
  const earned = G.devZone?0:Math.floor(G.gold);
  G.earned = earned;
  if (!G.devZone){
    Store.data.gold += earned;                                     // золото обычного забега уносится в банк
    Store.data.best = Math.max(Store.data.best || 0, G.floor);
  }
  G.runRecord = runRecordFromGame();
  diagEvent('game_over',{endedEarly:!!endedEarly,floor:G.floor,level:G.lvl,earned});
  // Досрочно завершённый забег остаётся обычным итогом, но не могилой: в
  // кладбище попадают только герои, действительно павшие от входящего урона.
  if (!G.devZone&&!G.endedEarly) addGraveyardRecord(G.runRecord);
  if (!G.devZone) Store.save();
  G.inventoryOpen = false;
  $('#pauseov').style.display = 'none';
  $('#quickpause').style.display = 'none'; G.quickPaused=false;
  $('#sheet').style.display = 'none';
  $('#inventory').style.display = 'none';
  deathScreen();
}

function endRun(){
  if (!G || G.over) return;
  const question=G.devZone?'Выйти из DEV_ZONE без сохранения тестовых результатов?':
    'Завершить забег и сохранить '+Math.floor(G.gold)+' золота в банк?';
  if (!confirm(question)) return;
  $('#pauseov').style.display = 'none';
  gameOver(true);
}

function summaryEsc(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function summaryFmt(n){ return Math.round(Number(n) || 0).toLocaleString(LANGUAGE === 'ru' ? 'ru-RU' : 'en-US'); }
function summaryTime(seconds){
  const duration = Math.floor(Number(seconds) || 0), mins = Math.floor(duration/60), secs = duration%60;
  return mins + ':' + String(secs).padStart(2, '0');
}
function summaryCell(label, value){ return '<div class="summary-cell"><span>' + label + '</span><b>' + value + '</b></div>'; }
function runSummaryGrid(r){
  return '<div class="summary-grid">' +
    summaryCell('УБИТО ВСЕГО', summaryFmt(r.kills)) + summaryCell('ОБЫЧНЫЕ / ЭЛИТЫ / БОССЫ', summaryFmt(r.normals) + ' / ' + summaryFmt(r.elites) + ' / ' + summaryFmt(r.bosses)) +
    summaryCell('НАНЕСЕНО УРОНА', summaryFmt(r.damage)) + summaryCell('САМЫЙ СИЛЬНЫЙ УДАР', summaryFmt(r.maxHit)) +
    summaryCell('КРИТИЧЕСКИХ УДАРОВ', summaryFmt(r.crits)) + summaryCell('ПОЛУЧЕНО УРОНА', summaryFmt(r.taken)) +
    summaryCell('ВОССТАНОВЛЕНО HP', summaryFmt(r.healing)) + summaryCell('ПРОЙДЕНО РАССТОЯНИЕ', summaryFmt(r.distance)) +
    summaryCell('МОДИФИКАТОРОВ', summaryFmt(r.modifiers)) + summaryCell('КНИГИ / ТИРЫ КНИГ', summaryFmt(r.books) + ' / ' + summaryFmt(r.bookTiers)) +
    summaryCell('СНАРЯЖЕНИЕ / ТОТЕМЫ', summaryFmt(r.amulets) + ' / ' + summaryFmt(r.totems)) + summaryCell('ЗАЧИЩЕННЫХ ЭТАЖЕЙ', summaryFmt(r.cleared)) +
    '</div>';
}
function runRecordFromGame(){
  const s = G.stats || {}, death = G.player.deathLog || null;
  const weaponKey = Object.keys(WEAPONS).find(k => WEAPONS[k] === G.weapon || WEAPONS[k].id === G.weapon.id) || 'bow';
  const subclass = (SUBCLASSES[weaponKey] || []).find(it => it.id === G.subclass);
  return {
    stamp:Date.now(), weaponId:G.weapon.id, weaponName:G.weapon.nm,
    subclassName:subclass ? subclass.nm : '', sprite:{bow:'archer',wand:'mage',necro:'necromancer',blade:'warrior'}[weaponKey] || 'archer',
    floor:G.floor, lvl:G.lvl, duration:Math.floor(G.time), earned:G.earned || 0,
    bankAfter:Store.data.gold, bestAfter:Store.data.best || G.floor,
    cause:death ? death.cause : 'неизвестна', deathDmg:death ? death.dmg : 0,
    kills:G.player.kills, normals:s.normals, elites:s.elites, bosses:s.bosses,
    damage:s.damage, maxHit:s.maxHit, crits:s.crits, taken:s.taken, healing:s.healing, distance:s.distance,
    modifiers:G.picks.length, books:Object.keys(G.items).length,
    bookTiers:Object.values(G.items).reduce((n, it) => n + it.tier, 0),
    amulets:AMU_KEYS.filter(k => G.amu[k]).length,
    totems:TOTEM_KEYS.filter(k => totemTier(k)).length,
    cleared:Math.max(0, G.floor-1),
  };
}
function addGraveyardRecord(record){
  const rows = normalizeGraveyard(Store.data);
  Store.data.graveyard = [record].concat(rows).slice(0,10);
  normalizeGraveyard(Store.data);
  return Store.data.graveyard;
}

/* Отрисовка экрана смерти отделена от начисления золота: сохранённый снимок
   одновременно служит источником данных для кладбища и не меняется задним числом. */
function deathScreen(){
  const r = G.runRecord || runRecordFromGame();
  $('#ov').style.display = 'flex';
  menuMode = false; $('#ov').classList.remove('menu');
  $('#ov').innerHTML =
    '<h1 style="color:' + (G.endedEarly ? '#f0c040' : '#e0405a') + '">' + (G.endedEarly ? 'ЗАБЕГ ЗАВЕРШЁН' : 'ВЫ ПАЛИ') + '</h1>' +
    '<h2>итоги забега · этаж ' + r.floor + ' · уровень ' + r.lvl + ' · время ' + summaryTime(r.duration) + '</h2>' +
    (!G.endedEarly ? '<div style="max-width:640px;color:#ff9a8a;font-size:16px;line-height:1.55">ПРИЧИНА СМЕРТИ: ' +
      summaryEsc(r.cause || 'неизвестна') + (r.deathDmg ? ' · получено ' + summaryFmt(r.deathDmg) + ' урона' : '') + '</div>' : '') +
    '<div style="color:#f0c040;font-size:20px;letter-spacing:1px">+' + summaryFmt(r.earned) +
      ' золота в банк · всего ' + summaryFmt(r.bankAfter) +
      '<span style="color:#7d8b9a;font-size:13.8px"> · рекорд: этаж ' + summaryFmt(r.bestAfter) + '</span></div>' +
    runSummaryGrid(r) +
    '<button id="tomenu" style="margin-top:6px">В МЕНЮ</button>';
  $('#tomenu').onclick = () => runConfirmedMenuAction(startScreen);
}
