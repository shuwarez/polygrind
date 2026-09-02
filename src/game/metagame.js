/* ---------- 10b. МАГАЗИН ----------
   back — чем рисовать экран, с которого пришли: стартовый или экран смерти. */
const SHOP_ICON_ATLAS_DATA = 'assets/images/items/shop-icon-atlas-data-73f2b95278.webp';
const SHOP_ICON_POS = Object.freeze({
  dmg:[0,0],aspd:[1,0],hpFlat:[2,0],hpPct:[3,0],regen:[4,0],
  armor:[0,1],drFlat:[1,1],dodge:[2,1],dashRecharge:[3,1],dashLength:[4,1],
  dashN:[0,2],sarmor:[1,2],sxp:[2,2],sgold:[3,2],smon:[4,2],
  vacuum:[0,3],itemDrop:[1,3],startSkill:[2,3],card4:[3,3],mspd:[4,3],
});
const SHOP_CATEGORY_ICONS = Object.freeze({attack:'dmg',health:'hpPct',defense:'armor',farm:'sgold',qol:'itemDrop'});
const SHOP_SHORT_NT = Object.freeze({
  regen:['+1 HP раз в 5 секунд ниже 50% здоровья за ранг. Максимум: +50 HP/5 сек.','+1 HP every 5 sec below 50% health per rank. Maximum: +50 HP/5 sec.'],
  armor:['+1 к броне за ранг. Максимум: +30.','+1 Armor per rank. Maximum: +30.'],
  drFlat:['Каждый ранг вычитает 1 урон из каждого попадания. Максимум: 100.','Each rank subtracts 1 damage from every hit. Maximum: 100.'],
  dodge:['+1% шанса уворота за ранг. Максимум из магазина: 25%.','+1% Dodge Chance per rank. Shop maximum: 25%.'],
  dashRecharge:['+5% восстановления рывка за ранг. Максимум: +50%.','+5% Dash recharge per rank. Maximum: +50%.'],
  dashLength:['+5% дистанции рывка за ранг. Максимум: +25%.','+5% Dash distance per rank. Maximum: +25%.'],
  dashN:['+1 заряд рывка за ранг. Всего можно получить 3 заряда.','+1 Dash charge per rank, up to 3 total charges.'],
  itemDrop:['Около +0,38 п.п. к шансу находки за ранг. Максимум: +3,84 п.п.','About +0.38 pp Find Chance per rank. Maximum: +3.84 pp.'],
  startSkill:['+1 выбор навыка перед первым боем за ранг. Максимум: 5.','+1 skill choice before the first fight per rank. Maximum: 5.'],
  card4:['Всегда показывает 4 карточки вместо 3 при повышении уровня.','Always shows 4 cards instead of 3 when leveling up.'],
  dmg:['+1% ко всему наносимому урону за ранг.','+1% to all damage dealt per rank.'],
  aspd:['+1% к скорости атаки за ранг.','+1% Attack Speed per rank.'],
  hpFlat:['+1 к максимальному HP до процентных множителей за ранг.','+1 Maximum HP before percentage multipliers per rank.'],
  hpPct:['+1% к максимальному HP за ранг.','+1% Maximum HP per rank.'],
  mspd:['+1% к скорости передвижения за ранг. Максимум: +10%.','+1% Movement Speed per rank. Maximum: +10%.'],
  sxp:['+1% ко всему получаемому опыту за ранг.','+1% to all experience gained per rank.'],
  sgold:['+1% ко всему получаемому золоту за ранг.','+1% to all gold gained per rank.'],
  smon:['+1% врагов на этаже за ранг: больше наград и опасности.','+1% enemies per floor per rank: more rewards and danger.'],
});
function shopIconHTML(id, extraClass=''){
  const pos=SHOP_ICON_POS[id] || SHOP_ICON_POS.itemDrop;
  return '<span class="shop-icon' + (extraClass ? ' ' + extraClass : '') + '" style="--icon-x:' +
    (pos[0]*25) + '%;--icon-y:' + (pos[1]*100/3) + '%" aria-hidden="true"></span>';
}
const shopCrestHTML = () =>
  '<div class="shop-crest" aria-hidden="true"><svg viewBox="0 0 72 72">' +
    '<circle class="crest-ring" cx="36" cy="36" r="31"/><circle class="crest-ring" cx="36" cy="36" r="26"/>' +
    '<path class="crest-iron" d="M19 41h34l-5 7H24zm8-10h25v6l-7 4H23l-5-5h9zM29 48h14l4 9H25z"/>' +
    '<path class="crest-iron" d="M22 15l5-3 8 12-5 4zm10 10L49 9l5 5-18 16z"/>' +
    '<path class="crest-hot" d="M18 57h36M14 36h7M51 36h7"/></svg></div>';
function shopScreen(back, restoreScrollTop=0){
  $('#sheet').style.display = 'none';
  $('#inventory').style.display = 'none';
  $('#ov').style.display = 'flex';
  menuMode = true; $('#ov').classList.add('menu','shop-menu');
  const money = n => Math.round(n).toLocaleString(LANGUAGE === 'ru' ? 'ru-RU' : 'en-US');
  const catOf = it => it.cat || (['dmg','aspd'].includes(it.id) ? 'attack' :
    ['sxp','sgold','smon'].includes(it.id) ? 'farm' : 'qol');
  const cats = [
    ['attack','АТАКА', 'урон и темп'],
    ['health','ЗДОРОВЬЕ', 'запас HP'],
    ['defense','ЗАЩИТА', 'выживаемость'],
    ['farm','ФАРМ', 'опыт, золото, плотность'],
    ['qol','КАЧЕСТВО ЖИЗНИ', 'старт, движение и сбор'],
  ];
  const allRefund=shopRefundTotal();

  const row = it => {
    const lvl = shopLvl(it.id), maxed = lvl >= it.max;
    // Пачки: ×10 и ×100 показываем только там, где потолок их оправдывает,
    // иначе на «четвёртой карте» висели бы две мёртвые кнопки.
    const packs = [1, 10, 100].filter(n => n === 1 || (it.id === 'mspd' && n === 10) || it.max >= n * 2);
    const btns = maxed
      ? '<button disabled>МАКСИМУМ</button>'
      : packs.map(n => {
          const b = shopBatch(it, n);
          const can = b.cnt > 0 && Store.data.gold >= b.sum;
          return '<button data-id="' + it.id + '" data-n="' + n + '"' +
            (can ? '' : ' class="insufficient" disabled') + '>' +
            '+' + b.cnt + '<b>' + shopIconHTML('sgold','shop-price-coin') + money(b.sum) + '</b></button>';
        }).join('');
    const refundPacks = [1, 10, 100].filter(n => n === 1 || lvl >= n);
    const refunds = lvl
      ? refundPacks.map(n => {
          const b = shopRefundBatch(it, n);
          return '<button data-act="refund" data-id="' + it.id + '" data-n="' + n + '">' +
            '−' + b.cnt + '<b>' + shopIconHTML('sgold','shop-price-coin') + '+' + money(b.sum) + '</b></button>';
        }).join('') + '<button class="refund-all" data-act="refund" data-id="' + it.id + '" data-n="' + lvl + '">' +
        'ВСЁ<b>' + shopIconHTML('sgold','shop-price-coin') + '+' + money(shopRefundBatch(it,lvl).sum) + '</b></button>'
      : '';
    const val = it.fmt ? it.fmt(lvl) : '+' + lvl + (it.unit || '');
    const progress = maxed ? 100 : clamp(lvl / Math.max(1,it.max) * 100,0,100);
    return '<article class="srow' + (maxed ? ' done' : '') + '" data-shop-id="' + it.id + '" style="--rank:' + progress.toFixed(2) + '%">' +
      '<div class="shop-card-top"><div class="shop-rune" aria-hidden="true">' + shopIconHTML(it.id) + '</div>' +
      '<div class="sinfo"><span class="shop-item-kind">ПОСТОЯННОЕ УЛУЧШЕНИЕ</span><div class="snm">' + it.nm + '</div></div>' +
      '<div class="sval">' + val + '</div></div>' +
      '<div class="shop-rankline"><span>ур. <b>' + lvl + '</b> / ' + it.max + '</span><span>' + Math.round(progress) + '%</span></div>' +
      '<div class="shop-rankbar" aria-hidden="true"><i></i></div><div class="snt">' + SHOP_SHORT_NT[it.id][LANGUAGE === 'en' ? 1 : 0] + '</div>' +
      '<div class="strade"><div class="saction"><span>ПОКУПКА</span><div class="sbuy">' + btns + '</div></div>' +
      (lvl ? '<div class="saction"><span>ВОЗВРАТ</span><div class="srefund">' + refunds + '</div></div>' : '') +
      '</div></article>';
  };

  $('#ov').innerHTML =
    '<style class="shop-icon-style">.shop-icon{background-image:url("' + SHOP_ICON_ATLAS_DATA + '")}</style>' +
    '<div class="shop-header">' + shopCrestHTML() + '<div class="shop-heading"><small>ЛАВКА ВЕЧНЫХ УЛУЧШЕНИЙ</small>' +
      '<h1>МАГАЗИН</h1><p>постоянные бонусы для всех будущих забегов · наведите на карточку для подробностей</p></div>' +
      '<div class="shop-seal" aria-hidden="true"><span>GG</span></div></div>' +
    '<div class="shopbankrow"><div id="bank">В БАНКЕ: ' + money(Store.data.gold) + ' золота' +
      '<span> · вложено сейчас: ' + money(Store.data.spent || 0) + '</span></div>' +
      '<button id="shoprefundall" class="shop-refund-all"' + (allRefund.cnt ? '' : ' disabled') +
      '>ВЕРНУТЬ ВСЕ ПОКУПКИ<b>+' + money(allRefund.sum) + '</b></button></div>' +
    '<div id="shop">' + cats.map(([id,nm,nt],index) => {
      const rows = SHOP.filter(it => catOf(it) === id).map(row).join('');
      return rows ? '<section class="shopcat" data-cat="' + id + '"><div class="shopcat-head"><span class="shopcat-mark" aria-hidden="true"><span>' +
        shopIconHTML(SHOP_CATEGORY_ICONS[id]) + '</span></span><b>' + nm + '</b><span>' + nt + '</span><span class="shopcat-index">0' + (index+1) + '</span></div><div class="shopgrid">' + rows + '</div></section>' : '';
    }).join('') + '</div>' +
    '<button id="shopback">НАЗАД</button>';

  localizeTree($('#ov'));
  document.querySelectorAll('#shop button').forEach(el => el.onclick = () => {
    const it = SHOP.find(x => x.id === el.dataset.id);
    if (it && el.dataset.act === 'refund') shopRefund(it, +el.dataset.n, back);
    else if (it) shopBuy(it, +el.dataset.n, back);
  });
  $('#shoprefundall').onclick = () => shopRefundAll(back);
  document.querySelectorAll('[data-shop-id]').forEach(el => {
    const it = SHOP.find(x => x.id === el.dataset.shopId);
    el.onmouseenter = ev => {
      const lvl = shopLvl(it.id), maxed = lvl >= it.max;
      const cur = it.fmt ? it.fmt(lvl) : '+' + lvl + (it.unit || '');
      const nextVal = it.fmt ? it.fmt(lvl+1) : '+' + (lvl+1) + (it.unit || '');
      const next = maxed ? 'Достигнут максимум.' : 'Следующий ранг: <b>' + nextVal + '</b> · цена <b>' + money(shopCost(it, lvl)) + '</b> золота.';
      const refund = lvl ? '<br>Вернуть последний ранг: <b>+' + money(shopCost(it, lvl-1)) + '</b> золота.' : '';
      const armor = it.id === 'armor' ? '<br><b>Броня:</b> гасит ' + armorReduction(lvl).toFixed(1) + '% урона' + (maxed ? '.' : '; на следующем ранге — ' + armorReduction(lvl+1).toFixed(1) + '%.') : '';
      const tip = $('#skilltip');
      tip.innerHTML = '<div class="tt-title">' + it.nm + '</div><b>Текущий эффект:</b> ' + cur + '<br>' + it.nt + armor + '<div class="tt-note">' + next + refund + '</div>';
      tip.style.display = 'block'; moveSkillTip(ev);
    };
    el.onmousemove = moveSkillTip;
    el.onmouseleave = hideSkillTip;
  });
  const shop=$('#shop');
  if (shop) shop.scrollTop=Math.max(0,Number(restoreScrollTop)||0);
  $('#shopback').onclick = () => {
    $('#ov').classList.remove('shop-menu'); menuMode=false;
    runConfirmedMenuAction(back);
  };
}

function refreshShop(back){
  const shop=$('#shop'),scrollTop=shop?Math.max(0,Number(shop.scrollTop)||0):0;
  shopScreen(back,scrollTop);
}

/* Покупка пачкой. Идём по одному уровню: цена растёт после каждого,
   поэтому «купить 10» может закончиться на седьмом — это не ошибка, а честный расчёт. */
function shopBuy(it, n, back){
  const sh = Store.data.shop || (Store.data.shop = {});
  let bought = 0, paid = 0;
  for (let i = 0; i < n; i++){
    const lvl = shopLvl(it.id);
    if (lvl >= it.max) break;
    const c = shopCost(it, lvl);
    if (Store.data.gold < c) break;
    Store.data.gold -= c;
    Store.data.spent = (Store.data.spent || 0) + c;
    sh[it.id] = lvl + 1;
    bought++; paid += c;
  }
  if (!bought) return;
  Store.save();
  // Если магазин открыли посреди партии (а это возможно только с экрана смерти),
  // билд уже собран — покупки вступят в силу со следующей партии.
  refreshShop(back);
}

/* Откат покупки возвращает полную цену отменяемых уровней. Нельзя уйти ниже
   нулевого ранга или получить золото повторно из уже пустой ветки. */
function shopRefund(it, n, back){
  const sh = Store.data.shop || (Store.data.shop = {});
  const refund = shopRefundBatch(it, n);
  if (!refund.cnt) return;
  const nextLvl = shopLvl(it.id) - refund.cnt;
  if (nextLvl > 0) sh[it.id] = nextLvl;
  else delete sh[it.id];
  Store.data.gold += refund.sum;
  Store.data.spent = Math.max(0, (Store.data.spent || 0) - refund.sum);
  Store.save();
  refreshShop(back);
}

/* Один общий откат очищает только канонические магазинные бонусы и возвращает
   точную сумму всех их фактически купленных рангов. */
function shopRefundAll(back){
  const refund=shopRefundTotal();
  if (!refund.cnt) return false;
  const sh=Store.data.shop || (Store.data.shop={});
  for (const it of SHOP) delete sh[it.id];
  Store.data.gold+=refund.sum;
  Store.data.spent=0;
  Store.save();
  refreshShop(back);
  return refund;
}

/* ---------- 10c. СОЗВЕЗДИЯ ----------
   Убийства — условие, не валюта: они никогда не списываются. Каждый клик
   открывает ровно один ранг, чтобы игрок видел, как загорается новый узел. */
function constellationReadyCount(){
  let n = 0;
  for (const it of CONSTELLATIONS){
    const rank = constellationRank(it.id);
    if (rank < 10 && constellationKills(it.id) >= it.req[rank]) n++;
  }
  return n;
}

function constellationUnlock(id, back){
  const it = CONSTELLATIONS.find(x => x.id === id); if (!it) return false;
  const cs = constellationState(), rank = cs.ranks[id];
  if (rank >= 10 || cs.kills[id] < it.req[rank]) return false;
  const list = $('#constellations');
  const scrollTop = list ? Math.max(0, Number(list.scrollTop) || 0) : 0;
  cs.ranks[id] = rank + 1;
  Store.save();
  tone(520, 0.08, 0.035, 'triangle'); tone(780, 0.15, 0.04, 'triangle', 0.07);
  constellationScreen(back, scrollTop);
  return true;
}

/* Временный инструмент разработки: снимает только активные ранги. Накопленные
   убийства остаются условием доступа, поэтому те же узлы можно включить снова. */
function constellationResetBonuses(back){
  const cs = constellationState();
  const removed = CONST_IDS.reduce((sum,id) => sum + cs.ranks[id], 0);
  if (!removed) return false;
  const list = $('#constellations');
  const scrollTop = list ? Math.max(0, Number(list.scrollTop) || 0) : 0;
  for (const id of CONST_IDS) cs.ranks[id] = 0;
  Store.save();
  tone(190, 0.12, 0.035, 'sawtooth');
  constellationScreen(back, scrollTop);
  return removed;
}

let constellationSelectedId = 'runner';

function constellationUiState(it){
  const rank = constellationRank(it.id), kills = constellationKills(it.id), maxed = rank >= 10;
  const next = maxed ? it.req[9] : it.req[rank], prev = rank ? it.req[rank-1] : 0;
  return {rank,kills,maxed,next,prev,ready:!maxed && kills >= next,
    pct:maxed ? 100 : clamp((kills-prev) / Math.max(1,next-prev) * 100, 0, 100)};
}

function constellationSelect(id, back){
  if (!CONST_IDS.includes(id)) return false;
  const list = $('#constellations');
  constellationSelectedId = id;
  constellationScreen(back, list ? Math.max(0, Number(list.scrollTop) || 0) : 0);
  return true;
}

function constellationScreen(back, restoreScrollTop=0){
  $('#sheet').style.display = 'none'; $('#inventory').style.display = 'none';
  $('#ov').style.display = 'flex'; $('#ov').classList.add('menu'); menuMode = true;
  const fmt = n => Math.round(n).toLocaleString(LANGUAGE === 'ru' ? 'ru-RU' : 'en-US');
  const invested = CONST_IDS.reduce((sum,id) => sum + constellationRank(id), 0);
  const readyCount = constellationReadyCount();
  const totalKills = CONST_IDS.reduce((sum,id) => sum + constellationKills(id), 0);
  if (!CONST_IDS.includes(constellationSelectedId)) constellationSelectedId = CONST_IDS[0];
  const selected = CONSTELLATIONS.find(it => it.id === constellationSelectedId) || CONSTELLATIONS[0];
  const focus = constellationUiState(selected);
  const paths = CONSTELLATIONS.map(it => {
    const state = constellationUiState(it);
    return '<button class="const-path' + (it.id === selected.id ? ' selected' : '') + (state.ready ? ' ready' : '') + '" style="--cc:' + it.col + '" data-const-select="' + it.id + '" aria-pressed="' + (it.id === selected.id) + '">' +
      '<canvas class="const-path-icon" data-const-icon="' + it.id + '" width="48" height="48" aria-hidden="true"></canvas>' +
      '<span class="const-path-copy"><b>' + it.nm + '</b><small>' + it.sub + '</small></span>' +
      '<span class="const-path-rank"><b>' + state.rank + '/10</b><small>РАНГ</small></span>' +
      (state.ready ? '<i class="const-path-ready" title="ДОСТУПНО ОТКРЫТИЕ"></i>' : '') + '</button>';
  }).join('');
  const nodes = selected.req.map((req,i) => '<span class="const-node' +
    (i < focus.rank ? ' done' : i === focus.rank && focus.ready ? ' ready' : '') +
    '" title="Ранг ' + (i+1) + ': ' + fmt(req) + ' убийств"><em>' + (i+1) + '</em></span>').join('');
  const action = focus.maxed
    ? '<div class="const-locked const-max">СОЗВЕЗДИЕ ЗАВЕРШЕНО · +50%</div>'
    : focus.ready
      ? '<button class="const-unlock" data-const-id="' + selected.id + '">ОТКРЫТЬ РАНГ</button>'
      : '<div class="const-locked">ДО НОВОЙ ЗВЕЗДЫ: ' + fmt(Math.max(0,focus.next-focus.kills)) + '</div>';
  const rankProgress = Math.max(0, Math.min(9, focus.rank - 1 + (focus.ready ? .5 : 0)));
  $('#ov').innerHTML =
    '<h1 style="color:#d9c7ff">СОЗВЕЗДИЯ</h1>' +
    '<h2>вечная охота · убийства не расходуются · каждый открытый узел даёт +5%</h2>' +
    '<div id="constellations" style="--cc:' + selected.col + '"><canvas id="constsky" aria-hidden="true"></canvas>' +
      '<header class="const-atlas-head"><div><div class="const-atlas-kicker">АРХИВ ВЕЧНОЙ ОХОТЫ</div>' +
        '<div class="const-atlas-title">КАРТА СОЗВЕЗДИЙ</div><div class="const-atlas-sub">ШЕСТЬ ПУТЕЙ · ДЕСЯТЬ ЗВЁЗД В КАЖДОМ</div></div>' +
        '<div class="const-summary"><span><b>' + invested + '</b><small>ОТКРЫТО ЗВЁЗД</small></span><span><b>' + readyCount + '</b><small>ГОТОВО К ОТКРЫТИЮ</small></span><span><b>' + fmt(totalKills) + '</b><small>УБИЙСТВ ЗАПИСАНО</small></span></div></header>' +
      '<div class="const-layout"><nav class="const-paths" aria-label="ПУТИ ОХОТЫ">' + paths + '</nav>' +
        '<section class="const-focus" style="--cc:' + selected.col + '" aria-live="polite">' +
          '<div class="const-focus-head"><div class="const-sigil"><canvas class="const-focus-icon" data-const-icon="' + selected.id + '" width="104" height="104" aria-hidden="true"></canvas></div>' +
            '<div class="const-focus-copy"><div class="const-focus-label">ИЗБРАННЫЙ ПУТЬ</div><h3>' + selected.nm + '</h3><p>' + selected.sub + '</p></div>' +
            '<div class="const-rank-seal"><span><b>' + focus.rank + '/10</b><small>РАНГ</small></span></div></div>' +
          '<div class="const-effect"><b>+' + (focus.rank*5) + '%</b><span>к урону, опыту и золоту за этот тип врагов</span></div>' +
          '<div class="const-nodes" style="--rank-progress:' + rankProgress.toFixed(2) + '">' + nodes + '</div>' +
          '<div class="const-record"><div class="const-progress-line"><span>УБИТО: <b>' + fmt(focus.kills) + '</b></span><span>' + (focus.maxed ? 'МАКСИМУМ' : 'ЦЕЛЬ: <b>' + fmt(focus.next) + '</b>') + '</span></div>' +
            '<div class="const-progress"><i style="width:' + focus.pct.toFixed(2) + '%"></i></div><div class="const-action-slot">' + action + '</div></div>' +
        '</section></div></div>' +
    '<div class="const-actions"><button id="constreset"' + (invested ? '' : ' disabled') + '>УБРАТЬ БОНУСЫ</button><button id="constback">НАЗАД</button></div>' +
    '<div class="k">Убийства сохранятся — доступные узлы можно открыть заново.</div>';
  localizeTree($('#ov'));
  document.querySelectorAll('[data-const-select]').forEach(el => el.onclick = () => constellationSelect(el.dataset.constSelect, back));
  document.querySelectorAll('[data-const-id]').forEach(el => el.onclick = () => constellationUnlock(el.dataset.constId, back));
  $('#constreset').onclick = () => constellationResetBonuses(back);
  $('#constback').onclick = () => runConfirmedMenuAction(back);
  const list = $('#constellations');
  if (list) list.scrollTop = Math.max(0, Number(restoreScrollTop) || 0);
  constellationArtFrame = -1;
  drawConstellationArt(performance.now()/1000);
}

function constellationPath(g, shape, x, y, r){
  g.beginPath();
  if (shape === 'circle') g.arc(x,y,r,0,Math.PI*2);
  else if (shape === 'triangle'){ g.moveTo(x,y-r); g.lineTo(x+r*.92,y+r*.75); g.lineTo(x-r*.92,y+r*.75); g.closePath(); }
  else if (shape === 'square') g.rect(x-r*.78,y-r*.78,r*1.56,r*1.56);
  else if (shape === 'diamond'){ g.moveTo(x,y-r); g.lineTo(x+r,y); g.lineTo(x,y+r); g.lineTo(x-r,y); g.closePath(); }
  else {
    const points = shape === 'boss' ? 12 : 8;
    for (let i=0;i<points;i++){
      const rr = i%2 ? r*.48 : r, a = -Math.PI/2 + i*Math.PI*2/points;
      if (!i) g.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr); else g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);
    }
    g.closePath();
  }
}

function drawConstellationIcon(cv2, it, t){
  if (!cv2 || !cv2.getContext) return;
  const g = cv2.getContext('2d'), w=cv2.width, h=cv2.height, pulse=0.82+Math.sin(t*2+CONST_IDS.indexOf(it.id))*0.12;
  g.clearRect(0,0,w,h);
  const regular = ENEMY_SPRITE_META[it.id], custom = CONSTELLATION_SPRITES[it.id];
  const sprite = regular ? ENEMY_SPRITES[it.id] : custom;
  if (it.sprite !== false && sprite && sprite.complete && sprite.naturalWidth){
    const frameSize = regular ? (it.id === 'tank' ? 48 : 40) : 48;
    const frame = Math.floor(t*6 + Math.max(0,CONST_IDS.indexOf(it.id))) % 4;
    const drawSize = Math.max(8,Math.min(w,h)-6), dx=(w-drawSize)/2, dy=(h-drawSize)/2;
    g.save(); g.imageSmoothingEnabled=false; g.shadowColor=it.col; g.shadowBlur=8*pulse;
    g.drawImage(sprite,frame*frameSize,0,frameSize,frameSize,dx,dy,drawSize,drawSize); g.restore();
    return;
  }
  g.save(); g.shadowColor=it.col; g.shadowBlur=12*pulse;
  g.strokeStyle=it.col; g.fillStyle=it.col+'22'; g.lineWidth=2;
  constellationPath(g,it.shape,w/2,h/2,Math.min(w,h)*.31); g.fill(); g.stroke();
  g.fillStyle='#f5efff'; g.shadowBlur=7; g.beginPath(); g.arc(w/2,h/2,2.2,0,Math.PI*2); g.fill(); g.restore();
}

const CONSTELLATION_DUST = Array.from({length:54},(_,i) => Object.freeze({
  x:((i*97+31)%997)/997,y:((i*i*29+i*17+13)%389)/389,p:i%11===0?2:1,s:.7+(i%5)*.11
}));
let constellationArtFrame = -1;
function drawConstellationArt(t){
  const artFrame = Math.floor(t*8);
  if (artFrame === constellationArtFrame) return;
  constellationArtFrame = artFrame;
  const sky = $('#constsky');
  if (sky && sky.getContext){
    const d=window.devicePixelRatio||1, w=sky.clientWidth||1180, h=sky.clientHeight||620;
    if (sky.width!==Math.round(w*d)||sky.height!==Math.round(h*d)){ sky.width=Math.round(w*d); sky.height=Math.round(h*d); }
    const g=sky.getContext('2d'); g.setTransform(d,0,0,d,0,0); g.clearRect(0,0,w,h);
    for (let i=0;i<CONSTELLATION_DUST.length;i++){
      const p=CONSTELLATION_DUST[i], a=.09+.25*(.5+.5*Math.sin(t*p.s+i));
      g.fillStyle='rgba(226,218,255,'+a.toFixed(3)+')'; g.fillRect(p.x*w,p.y*h,p.p,p.p);
    }
    const cx=w*.69, cy=h*.55, pulse=.08+.025*Math.sin(t*.9);
    g.strokeStyle='rgba(176,139,214,'+pulse.toFixed(3)+')'; g.lineWidth=1;
    g.beginPath(); g.ellipse(cx,cy,Math.min(245,w*.23),Math.min(180,h*.3),0,0,Math.PI*2); g.stroke();
    g.beginPath(); g.ellipse(cx,cy,Math.min(185,w*.18),Math.min(125,h*.21),0,0,Math.PI*2); g.stroke();
  }
  document.querySelectorAll('[data-const-icon]').forEach(cv2 => {
    const it=CONSTELLATIONS.find(x=>x.id===cv2.dataset.constIcon); if(it) drawConstellationIcon(cv2,it,t);
  });
}

/* Маленькое надгробие в главном меню рисуется той же пиксельной сеткой, что и
   факелы вывески: никакой внешней картинки и никакого размытия при увеличении. */
function drawGraveIcon(t){
  const cv4 = $('#graveicon'); if (!cv4 || !cv4.getContext) return;
  const d = window.devicePixelRatio || 1;
  if (cv4.width !== 46*d || cv4.height !== 46*d){ cv4.width=46*d; cv4.height=46*d; }
  const g=cv4.getContext('2d'), tm=Number.isFinite(t)?t:performance.now()/1000;
  g.setTransform(d,0,0,d,0,0); g.clearRect(0,0,46,46); g.imageSmoothingEnabled=false;
  const glow=.11+.04*Math.sin(tm*2.2);
  g.fillStyle='rgba(174,195,169,'+glow.toFixed(3)+')'; g.fillRect(5,6,36,35);
  g.fillStyle='#172019'; g.fillRect(6,38,35,5); g.fillRect(2,42,42,3);
  g.fillStyle='#536057'; g.fillRect(10,15,27,25); g.fillRect(13,10,21,5); g.fillRect(17,7,13,3);
  g.fillStyle='#8e9b90'; g.fillRect(13,15,21,22); g.fillRect(16,11,15,4); g.fillRect(19,9,9,2);
  g.fillStyle='#354139'; g.fillRect(13,36,21,3); g.fillRect(30,17,4,19);
  g.fillStyle='#303a33'; g.fillRect(21,17,5,14); g.fillRect(17,21,13,5);
  g.fillStyle='#aeb9ae'; g.fillRect(22,18,2,11); g.fillRect(18,22,10,2);
  g.fillStyle='#65746a'; g.fillRect(9,39,29,2);
  g.fillStyle='#6e8b61'; g.fillRect(3,39,3,5); g.fillRect(39,38,3,6); g.fillRect(6,41,2,3); g.fillRect(35,41,2,3);
}

function graveyardRows(){ return normalizeGraveyard(Store.data); }
function graveyardScreen(){
  $('#sheet').style.display = 'none'; $('#inventory').style.display = 'none';
  $('#ov').style.display = 'flex'; $('#ov').classList.add('menu'); menuMode = true;
  const rows = graveyardRows();
  const list = rows.length ? '<div class="grave-list">' + rows.map((r,i) =>
    '<button class="grave-run" data-grave-index="' + i + '">' +
      heroPreviewHTML(r.sprite, '') +
      '<span><b class="gr-class">' + summaryEsc(r.weaponName) + '</b><span class="gr-sub">' + summaryEsc(r.subclassName || '—') + '</span></span>' +
      '<span class="gr-place"><b class="gr-floor">' + summaryFmt(r.floor) + '</b><span class="gr-sub">ЭТАЖ СМЕРТИ</span><span class="gr-level">уровень ' + summaryFmt(r.lvl) + '</span></span>' +
    '</button>').join('') + '</div>' :
    '<div class="grave-empty"><b>ПОКА ЗДЕСЬ ПУСТО</b><br>Павшие герои появятся здесь после окончания забега смертью.</div>';
  $('#ov').innerHTML = brandHtml() + '<h1 style="color:#c8d3c7">КЛАДБИЩЕ</h1>' +
    '<h2>ПОСЛЕДНИЕ 10 ПАВШИХ ГЕРОЕВ</h2><div id="graveyard">' + list + '</div><button id="graveback">В МЕНЮ</button>';
  drawBrandTitle(); localizeTree($('#ov'));
  document.querySelectorAll('[data-grave-index]').forEach(el => el.onclick = () => graveyardDetail(Number(el.dataset.graveIndex)));
  $('#graveback').onclick = () => runConfirmedMenuAction(startScreen);
}
function graveyardDetail(index){
  const r = graveyardRows()[index]; if (!r) return graveyardScreen();
  $('#ov').style.display = 'flex'; $('#ov').classList.remove('menu'); menuMode = false;
  $('#ov').innerHTML =
    '<div class="grave-detail-head">' + heroPreviewHTML(r.sprite, '') + '<div><h1 style="color:#d48755">' + summaryEsc(r.weaponName) + '</h1>' +
      '<h2>' + summaryEsc(r.subclassName || '—') + '</h2></div></div>' +
    '<h2>итоги забега · этаж ' + summaryFmt(r.floor) + ' · уровень ' + summaryFmt(r.lvl) + ' · время ' + summaryTime(r.duration) + '</h2>' +
    '<div style="max-width:640px;color:#ff9a8a;font-size:16px;line-height:1.55">ПРИЧИНА СМЕРТИ: ' + summaryEsc(r.cause || 'неизвестна') +
      (r.deathDmg ? ' · получено ' + summaryFmt(r.deathDmg) + ' урона' : '') + '</div>' +
    '<div style="color:#f0c040;font-size:20px;letter-spacing:1px">+' + summaryFmt(r.earned) + ' золота в банк · всего ' + summaryFmt(r.bankAfter) +
      '<span style="color:#7d8b9a;font-size:13.8px"> · рекорд: этаж ' + summaryFmt(r.bestAfter) + '</span></div>' +
    runSummaryGrid(r) + '<button id="graveback">НАЗАД К КЛАДБИЩУ</button>';
  localizeTree($('#ov')); $('#graveback').onclick = () => runConfirmedMenuAction(graveyardScreen);
}

/* ---------- 10d. АНИМАЦИЯ МЕТА-МЕНЮ ---------- */
let menuMode = false;                 // меню открыто: обновляем его Canvas-элементы из общего цикла
const COIN_STRIP = typeof Image !== 'undefined' ? new Image() : null;
if (COIN_STRIP) COIN_STRIP.src = 'assets/images/items/coin-strip-93484ab798.webp';
const SHOP_COINS = [{c:null,g:null}, {c:null,g:null}];
const SHOP_COIN_FPS = 16;
const CONSTELLATION_STAR_STRIP = typeof Image !== 'undefined' ? new Image() : null;
if (CONSTELLATION_STAR_STRIP) CONSTELLATION_STAR_STRIP.src = 'assets/images/ui/constellation-star-strip-bc07bd99ce.webp';
const CONSTELLATION_MENU_STARS = [{c:null,g:null}, {c:null,g:null}];
const CONSTELLATION_STAR_FPS = 8;

function coinInit(){
  const ids = ['#coinl','#coinr'];
  for (let i = 0; i < 2; i++){
    const cv2 = $(ids[i]); if (!cv2) return false;
    const d = window.devicePixelRatio || 1;
    if (SHOP_COINS[i].c !== cv2 || cv2.width !== 24*d){
      cv2.width = cv2.height = 24*d;
      SHOP_COINS[i].c = cv2; SHOP_COINS[i].g = cv2.getContext('2d');
      SHOP_COINS[i].g.setTransform(d,0,0,d,0,0);
    }
  }
  return true;
}
function coinTick(t){
  if (!coinInit() || !COIN_STRIP || !COIN_STRIP.complete || !COIN_STRIP.naturalWidth) return;
  const button=$('#shopb');
  const animate=!!(button && typeof button.matches==='function' && button.matches(':hover')) && !reducedMenuMotion();
  for (let i = 0; i < 2; i++){
    const g = SHOP_COINS[i].g, frame = animate ? Math.floor((t*SHOP_COIN_FPS + i*2) % 4) : i*2;
    g.clearRect(0,0,24,24); g.imageSmoothingEnabled = false;
    g.drawImage(COIN_STRIP, frame*8, 0, 8, 8, 0, 0, 24, 24);
  }
}

function constellationStarInit(){
  const ids = ['#conststarl','#conststarr'];
  for (let i = 0; i < 2; i++){
    const cv2 = $(ids[i]); if (!cv2) return false;
    const d = window.devicePixelRatio || 1;
    if (CONSTELLATION_MENU_STARS[i].c !== cv2 || cv2.width !== 32*d){
      cv2.width = cv2.height = 32*d;
      CONSTELLATION_MENU_STARS[i].c = cv2;
      CONSTELLATION_MENU_STARS[i].g = cv2.getContext('2d');
      CONSTELLATION_MENU_STARS[i].g.setTransform(d,0,0,d,0,0);
    }
  }
  return true;
}
function constellationStarTick(t){
  if (!constellationStarInit() || !CONSTELLATION_STAR_STRIP ||
      !CONSTELLATION_STAR_STRIP.complete || !CONSTELLATION_STAR_STRIP.naturalWidth) return;
  const button=$('#constb');
  const animate=!!(button && typeof button.matches==='function' && button.matches(':hover')) && !reducedMenuMotion();
  for (let i = 0; i < 2; i++){
    const g = CONSTELLATION_MENU_STARS[i].g;
    const frame = animate ? Math.floor((t*CONSTELLATION_STAR_FPS + i*4) % 8) : 2+i*4;
    g.clearRect(0,0,32,32); g.imageSmoothingEnabled = false;
    g.drawImage(CONSTELLATION_STAR_STRIP, frame*32, 0, 32, 32, 0, 0, 32, 32);
  }
}

const GRIM_GRIND_LOGO_FRAME = {w:512,h:144,count:8,fps:5};
const GRIM_GRIND_LOGO_STRIP = typeof Image !== 'undefined' ? new Image() : null;
if (GRIM_GRIND_LOGO_STRIP) GRIM_GRIND_LOGO_STRIP.src = 'assets/images/ui/grim-grind-logo-strip-940a477add.webp';

const GRIM_GRIND_TORCH_FRAME = {w:72,h:192,count:8,fps:8};
const GRIM_GRIND_TORCH_STRIP = typeof Image !== 'undefined' ? new Image() : null;
if (GRIM_GRIND_TORCH_STRIP) GRIM_GRIND_TORCH_STRIP.src = 'assets/images/ui/grim-grind-torch-strip-74f7a52a4b.webp';

function reducedMenuMotion(){
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function drawBrandTitle(t){
  const cv3 = $('#brandnm');
  if (!cv3 || !GRIM_GRIND_LOGO_STRIP || !GRIM_GRIND_LOGO_STRIP.complete || !GRIM_GRIND_LOGO_STRIP.naturalWidth) return;
  const tm = Number.isFinite(t) ? t : performance.now()/1000;
  const frame = reducedMenuMotion() ? 0 : Math.floor(tm*GRIM_GRIND_LOGO_FRAME.fps) % GRIM_GRIND_LOGO_FRAME.count;
  if (cv3.__brandFrame === frame) return;
  const g = cv3.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.globalCompositeOperation = 'copy';
  g.drawImage(GRIM_GRIND_LOGO_STRIP,
    frame*GRIM_GRIND_LOGO_FRAME.w, 0,
    GRIM_GRIND_LOGO_FRAME.w, GRIM_GRIND_LOGO_FRAME.h,
    0, 0, GRIM_GRIND_LOGO_FRAME.w, GRIM_GRIND_LOGO_FRAME.h);
  g.globalCompositeOperation = 'source-over';
  cv3.__brandFrame = frame;
}
function drawBrandTorches(t){
  if (!GRIM_GRIND_TORCH_STRIP || !GRIM_GRIND_TORCH_STRIP.complete || !GRIM_GRIND_TORCH_STRIP.naturalWidth) return;
  const tm = Number.isFinite(t) ? t : performance.now()/1000;
  const frame = reducedMenuMotion() ? 0 : Math.floor(tm*GRIM_GRIND_TORCH_FRAME.fps) % GRIM_GRIND_TORCH_FRAME.count;
  for (const id of ['#brandtorchl','#brandtorchr']){
    const torch=$(id); if (!torch || !torch.getContext) continue;
    if (torch.__brandFrame === frame) continue;
    const g=torch.getContext('2d');
    g.imageSmoothingEnabled=false;
    g.globalCompositeOperation='copy';
    g.drawImage(GRIM_GRIND_TORCH_STRIP,frame*GRIM_GRIND_TORCH_FRAME.w,0,
      GRIM_GRIND_TORCH_FRAME.w,GRIM_GRIND_TORCH_FRAME.h,
      0,0,GRIM_GRIND_TORCH_FRAME.w,GRIM_GRIND_TORCH_FRAME.h);
    g.globalCompositeOperation='source-over';
    torch.__brandFrame=frame;
  }
}

/* Все превью используют общий RAF меню. Базовые герои сохраняют четыре кадра,
   новые подклассы проигрывают полный восьмикадровый цикл. */
function drawHeroPreviews(t){
  document.querySelectorAll('[data-hero-preview]').forEach(preview => {
    const subclass=preview.dataset.subclassPreview==='1';
    const count=subclass?SUBCLASS_HERO_FRAME_COUNT:4;
    const frame=reducedMenuMotion()?0:Math.floor(t*(subclass?10:5))%count;
    const position=(frame*100/(count-1))+'% 0';
    if (preview.__heroFrame === frame) return;
    preview.style.backgroundPosition = position;
    preview.__heroFrame = frame;
  });
}

/* В классической рамке каждый подкласс показывается статично первым кадром и
   неспешно сменяется следующим. Меню использует тот же детальный PNG, что и
   бой: отдельной ухудшенной preview-копии нет. Всё обновляет существующий RAF. */
function drawClassSubclassPreviews(t){
  const still=reducedMenuMotion(),frame=0;
  const subclassIndex=still?0:Math.floor(t/4)%3;
  const position='0 0';
  document.querySelectorAll('[data-class-subclass-preview]').forEach(preview => {
    const choices=SUBCLASSES[preview.dataset.classKey]||[],choice=choices[subclassIndex%choices.length];
    if (!choice) return;
    if (preview.__subclassId!==choice.id){
      preview.style.backgroundImage='url('+SUBCLASS_HERO_SPRITE_DATA[choice.id]+')';
      preview.__subclassId=choice.id;
      const label=preview.parentElement && preview.parentElement.querySelector('[data-class-subclass-label]');
      if (label) label.textContent=choice.nm;
    }
    if (preview.__heroFrame===frame) return;
    preview.style.backgroundPosition=position;
    preview.__heroFrame=frame;
  });
}

/* Один тик меню: интерактивные вывески двигаются только под курсором. */
function menuTick(){
  const t = performance.now()/1000;
  drawBrandTitle(t);
  drawBrandTorches(t);
  drawHeroPreviews(t);
  drawClassSubclassPreviews(t);
  coinTick(t);
  constellationStarTick(t);
  drawConstellationArt(t);
  drawGraveIcon(t);
}

/* Вывеска главного меню */
const brandHtml = () =>
  '<div id="brand"><canvas id="brandtorchl" class="brandtorch" width="72" height="192" aria-hidden="true"></canvas>' +
  '<canvas id="brandnm" width="512" height="144" role="img" aria-label="Grim Grind">Grim Grind</canvas>' +
  '<canvas id="brandtorchr" class="brandtorch" width="72" height="192" aria-hidden="true"></canvas></div>';

function menuSettingsScreen(){
  menuMode=true;
  $('#ov').style.display='flex';
  $('#ov').classList.add('menu');
  $('#ov').innerHTML = brandHtml() +
    '<h1>НАСТРОЙКИ</h1>' +
    '<div class="settings-panel menu-settings-panel" role="group" aria-label="Настройки звука">' +
      '<div class="settings-row"><label for="menusfxvolume">ГРОМКОСТЬ ЗВУКОВ</label><output id="menusfxvolumevalue" for="menusfxvolume">50%</output></div>' +
      '<input id="menusfxvolume" type="range" min="0" max="100" step="1" value="50" aria-label="Громкость звуков">' +
      '<button id="menusfxmute" type="button" aria-pressed="false">ЗВУКИ: ВКЛ</button>' +
    '</div>' +
    '<button id="settingsback" type="button">В МЕНЮ</button>';
  drawBrandTitle();
  localizeTree($('#ov'));
  refreshSfxSettings();
  tryStartMenuMusic();
  $('#menusfxvolume').oninput=event=>setSfxVolume(event.target.value);
  $('#menusfxmute').onclick=toggleSfxMute;
  $('#settingsback').onclick=()=>runConfirmedMenuAction(startScreen);
}
