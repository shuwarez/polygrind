/* «Первый шаг»: дорогая постоянная покупка выдаёт обычные выборы навыков
   до первого боя. Проверяем сам каталог, рост цены и число стартовых выборов. */
const {loadGame} = require('./sim');
const fs = require('fs');
const {imageInfo,embeddedImage}=require('./asset_test_utils');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(44) + (det || ''));

const c = loadGame('./index.html');
const it = c.__api.SHOP.find(x => x.id === 'startSkill');
ok('«Первый шаг»: пять рангов', !!it && it.max === 5,
   it ? 'потолок ' + it.max : 'товар не найден');

const first = c.shopCost(it, 0), last = c.shopCost(it, 4);
ok('цена заметно растёт по рангам', first === 24000 && last > first * 30,
   first.toLocaleString('ru-RU') + ' → ' + last.toLocaleString('ru-RU'));

for (const rank of [1, 5]){
  c.__api.STORE.data.shop.startSkill = rank;
  c.newGame('bow', 'keys');
  ok('ранг ' + rank + ': столько же стартовых навыков', c.__api.G.pending === rank,
     'ожидается и выдано ' + c.__api.G.pending);
}

{ const base = loadGame('./index.html'); base.newGame('necro', 'keys');
  const boosted = loadGame('./index.html');
  boosted.__api.STORE.data.shop = {dmg:100, aspd:50}; boosted.newGame('necro', 'keys');
  ok('урон магазина доходит до свиты', Math.abs(boosted.avgHit() / base.avgHit() - 2) < 0.001,
     base.avgHit().toFixed(1) + ' → ' + boosted.avgHit().toFixed(1));
  ok('скорость атаки магазина доходит до свиты', Math.abs(boosted.__api.D.minAspd / base.__api.D.minAspd - 1.5) < 0.001,
     base.__api.D.minAspd.toFixed(2) + ' → ' + boosted.__api.D.minAspd.toFixed(2)); }

{ const r = c.__api.SHOP.find(x => x.id === 'regen');
  ok('быстрое лечение: 50 уровней по 1 HP/сек', !!r && r.nm === 'БЫСТРОЕ ЛЕЧЕНИЕ' &&
     r.max === 50 && r.fmt(r.max) === '+50 HP/сек' && /ниже 50%/.test(r.nt),
     r ? r.fmt(r.max) : 'товар не найден');
  ok('быстрое лечение: прежняя средняя цена', !!r && r.base === 3300 && c.shopCost(r,0) === 3300,
     r ? c.shopCost(r,0).toLocaleString('ru-RU') + ' золота' : 'товар не найден');
  c.__api.STORE.data.shop.regen = 49;
  const batch = c.shopBatch(r, 10);
  ok('пакетная покупка останавливается на 50', batch.cnt === 1,
     'доступно уровней: ' + batch.cnt); }

{ const fast=loadGame('./index.html'); fast.__api.STORE.data.shop.regen=10;
  fast.newGame('bow','keys'); const G=fast.__api.G,D=fast.__api.D,p=G.player;
  G.enemies.length=0; G.spawnQueue=0; G.packs.length=0; G.pending=0;
  p.hp=D.life*0.35; const before=p.hp; fast.update(1);
  ok('быстрое лечение ниже половины даёт 1 HP/сек за уровень',
     Math.abs(p.hp-before-10)<1e-9, before.toFixed(1)+' → '+p.hp.toFixed(1));
  p.hp=D.life*0.5-2; fast.update(1); const atHalf=p.hp; fast.update(1);
  ok('быстрое лечение останавливается ровно на 50% здоровья',
     Math.abs(atHalf-D.life*0.5)<1e-9 && p.hp===atHalf,
     p.hp.toFixed(1)+' / '+D.life.toFixed(1)+' HP'); }

{ const speed = c.__api.SHOP.find(x => x.id === 'mspd');
  c.__api.STORE.data.shop.mspd = 0;
  const full = c.shopBatch(speed, 10);
  c.__api.STORE.data.gold=1e9; c.shopScreen(()=>{});
  const shopHtml=c.document.getElementById('ov').innerHTML;
  ok('скорость бега: потолок ровно +10%', !!speed && speed.max===10 && speed.fmt===undefined && speed.unit==='%',
     speed ? 'потолок +'+speed.max+'%' : 'товар не найден');
  ok('десять уровней скорости стоят ровно 50 000', full.cnt===10 && full.sum===50000 && c.shopCost(speed,0)===1000 &&
     /data-id="mspd" data-n="10"/.test(shopHtml),
     c.shopCost(speed,0).toLocaleString('ru-RU')+' → '+full.sum.toLocaleString('ru-RU')+' золота');
  c.__api.STORE.data.shop.mspd=9; const last=c.shopBatch(speed,10);
  ok('пакетная покупка останавливается на десятом уровне', last.cnt===1 && last.sum===c.shopCost(speed,9),
     'доступно уровней: '+last.cnt); }

{ const legacySpeed=loadGame('./index.html'), old={base:1000,grow:1.11};
  const expected=Array.from({length:7},(_,i)=>legacySpeed.shopCost(old,i+10)).reduce((a,b)=>a+b,0);
  legacySpeed.__api.STORE.data.gold=100; legacySpeed.__api.STORE.data.spent=expected+50;
  legacySpeed.__api.STORE.data.shop={mspd:17}; legacySpeed.__api.STORE.save();
  const gold=legacySpeed.__api.STORE.data.gold;
  legacySpeed.__api.STORE.save();
  ok('лишние старые уровни возвращаются по прежним ценам один раз',
     legacySpeed.__api.STORE.data.shop.mspd===10 && gold===100+expected &&
     legacySpeed.__api.STORE.data.gold===gold && legacySpeed.__api.STORE.data.spent===50,
     '+17% → +10% · возврат '+expected.toLocaleString('ru-RU')); }

{ const recharge=c.__api.SHOP.find(x=>x.id==='dashRecharge'), length=c.__api.SHOP.find(x=>x.id==='dashLength');
  ok('восстановление рывка: 10 уровней по 5%', !!recharge && recharge.cat==='defense' &&
     recharge.max===10 && recharge.fmt(10)==='+50%', recharge ? recharge.fmt(recharge.max) : 'товар не найден');
  ok('длинный рывок: 5 уровней по 5%', !!length && length.cat==='defense' &&
     length.max===5 && length.fmt(5)==='+25%', length ? length.fmt(length.max) : 'товар не найден');
  c.__api.STORE.data.shop.dashRecharge=0; c.__api.STORE.data.shop.dashLength=0;
  const recPrice=c.shopBatch(recharge,10).sum, lenPrice=c.shopBatch(length,5).sum;
  ok('новые ветки используют средний ценовой диапазон', c.shopCost(recharge,0)===3000 && recPrice===52640 &&
     c.shopCost(length,0)===4500 && lenPrice===32190,
     recPrice.toLocaleString('ru-RU')+' · '+lenPrice.toLocaleString('ru-RU')+' золота'); }

{ const fast=loadGame('./index.html'); fast.__api.STORE.data.shop={dashRecharge:10,dashLength:5};
  fast.newGame('bow','keys'); const G=fast.__api.G,D=fast.__api.D,p=G.player,DT=1/60;
  G.enemies.length=0; G.spawnQueue=0; G.keys={d:true}; fast.tryDash(); p.dash=0; G.keys={};
  for(let i=0;i<199;i++) fast.update(DT); const early=p.dashN;
  fast.update(DT); fast.update(DT);
  ok('+50% восстановления сокращает 5 секунд до 3,33', Math.abs(D.dashCd-5/1.5)<1e-9 &&
     early===0 && p.dashN===1, D.dashCd.toFixed(2)+' сек');
  const dashDistance=ctx=>{ const g=ctx.__api.G,pp=g.player; g.enemies.length=0;g.spawnQueue=0;g.keys={d:true};
    pp.x=pp.y=0;pp.dash=0;pp.dashN=ctx.__api.D.dashMax;ctx.tryDash();let n=0;while(pp.dash>0&&n++<60)ctx.update(DT);
    return Math.hypot(pp.x,pp.y); };
  const normal=loadGame('./index.html');normal.newGame('bow','keys');
  const long=dashDistance(fast), base=dashDistance(normal);
  ok('+25% дистанции даёт фактический рывок ×1,25', Math.abs(long/base-1.25)<1e-9,
     base.toFixed(1)+' → '+long.toFixed(1)); }

{ const armor = c.__api.SHOP.find(x => x.id === 'armor');
  ok('броня: магазинный потолок 30', !!armor && armor.max === 30 && armor.fmt(armor.max) === '+30',
     armor ? 'потолок ' + armor.max : 'товар не найден');
  ok('броня: базовая цена утроена', !!armor && armor.base === 3600 && armor.grow === 1.04 &&
     c.shopCost(armor, 0) === 3600,
     armor ? c.shopCost(armor,0).toLocaleString('ru-RU') + ' золота за первый ранг' : 'товар не найден');
  c.__api.STORE.data.shop.armor = 29;
  const batch = c.shopBatch(armor, 10);
  ok('пакетная покупка брони останавливается на 30', batch.cnt === 1,
     'доступно уровней: ' + batch.cnt); }

{ const legacy = loadGame('./index.html');
  legacy.__api.STORE.data.shop.regen = 100; legacy.newGame('bow','keys');
  ok('старое сохранение быстрого лечения не превышает потолок', legacy.__api.D.regen === 50,
     legacy.__api.D.regen.toFixed(0) + ' HP/сек'); }

{ const legacyArmor = loadGame('./index.html');
  legacyArmor.__api.STORE.data.shop.armor = 200; legacyArmor.newGame('bow','keys');
  ok('старая броня не превышает новый потолок', legacyArmor.__api.D.armor === 30,
     legacyArmor.__api.D.armor.toFixed(0) + ' брони'); }

{ const refund = loadGame('./index.html'), item = refund.__api.SHOP.find(x => x.id === 'armor');
  refund.__api.STORE.data.shop.armor = 3;
  const expected = refund.shopCost(item,2) + refund.shopCost(item,1);
  const batch = refund.shopRefundBatch(item,2);
  ok('возврат считает точную цену последних уровней', batch.cnt === 2 && batch.sum === expected,
     batch.sum.toLocaleString('ru-RU') + ' золота');
  refund.__api.STORE.data.gold = 100; refund.__api.STORE.data.spent = expected + 50;
  refund.shopRefund(item,2,()=>{});
  ok('возврат уменьшает ранг и возвращает золото', refund.__api.STORE.data.shop.armor === 1 && refund.__api.STORE.data.gold === 100 + expected);
  ok('текущие вложения уменьшаются на сумму возврата', refund.__api.STORE.data.spent === 50);
  refund.shopRefund(item,100,()=>{}); refund.shopRefund(item,1,()=>{});
  ok('повторный возврат не уходит ниже нулевого ранга', !refund.__api.STORE.data.shop.armor); }

{ const refund = loadGame('./index.html'), item = refund.__api.SHOP.find(x => x.id === 'dmg');
  refund.__api.STORE.data.shop.dmg = 7;
  const expected = refund.shopRefundBatch(item,7).sum;
  refund.__api.STORE.data.gold = 25; refund.__api.STORE.data.spent = expected;
  refund.shopRefund(item,7,()=>{});
  ok('кнопка «ВСЁ» возвращает весь отдельный бонус', !refund.__api.STORE.data.shop.dmg &&
    refund.__api.STORE.data.gold === 25 + expected && refund.__api.STORE.data.spent === 0); }

{ const refund = loadGame('./index.html');
  refund.__api.STORE.data.shop = {armor:3,dmg:4,regen:2,legacyUnknown:9};
  const expected = refund.shopRefundTotal();
  refund.__api.STORE.data.gold = 100; refund.__api.STORE.data.spent = expected.sum;
  const result = refund.shopRefundAll(()=>{});
  ok('общий возврат считает и отдаёт золото всех бонусов', result.cnt===9 && result.sum===expected.sum &&
    refund.__api.STORE.data.gold===100+expected.sum && refund.__api.STORE.data.spent===0);
  ok('общий возврат очищает канонические бонусы, не трогая неизвестные данные',
    !refund.__api.STORE.data.shop.armor && !refund.__api.STORE.data.shop.dmg &&
    !refund.__api.STORE.data.shop.regen && refund.__api.STORE.data.shop.legacyUnknown===9);
  const gold=refund.__api.STORE.data.gold;
  ok('повторный общий возврат не выдаёт золото повторно',refund.shopRefundAll(()=>{})===false && refund.__api.STORE.data.gold===gold); }

{ const scroll = loadGame('./index.html'), item=scroll.__api.SHOP.find(x=>x.id==='armor');
  scroll.__api.STORE.data.gold=1e9; scroll.shopScreen(()=>{});
  scroll.document.getElementById('shop').scrollTop=437;
  scroll.shopBuy(item,1,()=>{});
  ok('покупка сохраняет точную позицию прокрутки магазина',scroll.document.getElementById('shop').scrollTop===437,
    String(scroll.document.getElementById('shop').scrollTop)); }

{ const html=fs.readFileSync('./index.html','utf8');
  ok('интерфейс содержит полный возврат бонуса и всего магазина',
    /class="refund-all"[\s\S]*?ВСЁ/.test(html) && /id="shoprefundall"[\s\S]*?ВЕРНУТЬ ВСЕ ПОКУПКИ/.test(html)); }

{ const html=fs.readFileSync('./index.html','utf8'), design=loadGame('./index.html');
  design.shopScreen(()=>{}); const screen=design.document.getElementById('ov').innerHTML;
  const atlasImage=embeddedImage(html,'SHOP_ICON_ATLAS_DATA');
  const atlas=atlasImage&&atlasImage.buffer,atlasInfo=imageInfo(atlas);
  ok('магазин оформлен как кузнечная dark-fantasy лавка',
    screen.includes('class="shop-header"') && screen.includes('class="shop-crest"') &&
    screen.includes('class="shop-seal"') && screen.includes('ЛАВКА ВЕЧНЫХ УЛУЧШЕНИЙ') &&
    /classList\.add\('menu','shop-menu'\)/.test(html));
  ok('все товары получили иконки, описания и шкалы постоянного ранга',
    (screen.match(/class="shop-rune"/g)||[]).length===18 &&
    (screen.match(/class="shop-rankbar"/g)||[]).length===18 &&
    (screen.match(/class="snt"/g)||[]).length===18 && !/\.srow \.snt\{display:none/.test(html));
  ok('пять разделов различаются цветом, знаком и адаптивной сеткой',
    ['attack','health','defense','farm','qol'].every(id=>screen.includes('data-cat="'+id+'"')) &&
    (screen.match(/class="shopcat-mark"/g)||[]).length===5 &&
    html.includes('@media(max-width:650px)') && html.includes('.overlay.shop-menu'));
  ok('сгенерированный атлас 5×4 сжат и встроен одной lossless WebP-копией',
    !!atlas && atlas.length<22000 && atlasInfo.w===240 && atlasInfo.h===192 && atlasInfo.lossless && atlasInfo.alpha &&
    (screen.match(/class="shop-icon-style"/g)||[]).length===1 && !html.includes('const SHOP_RUNES ='),
    (atlas?atlas.length:0)+' Б');
  ok('все 18 товаров и пять разделов используют предметные спрайты',
    Object.keys(design.__api.SHOP.reduce((out,it)=>(out[it.id]=1,out),{})).length===18 &&
    (screen.match(/class="shop-icon/g)||[]).length>=25 &&
    ['dmg','hpPct','armor','sgold','itemDrop'].every(id=>html.includes(id+':[')));
  ok('нехватка золота не скрывает цену покупки',
    (screen.match(/class="insufficient" disabled/g)||[]).length>0 && screen.includes('shop-price-coin') &&
    /\.srow \.sbuy button\.insufficient:disabled\{opacity:1;/.test(html) &&
    /\.srow \.sbuy button\.insufficient:disabled b\{color:#ff9d70;font-size:12\.5px/.test(html));
  ok('краткие описания крупнее, контрастнее и не обрезаются по двум строкам',
    html.includes('const SHOP_SHORT_NT = Object.freeze({') &&
    /\.srow \.snt\{min-height:58px;color:#d2c8ba;font:500 14\.2px\/1\.38 Georgia/.test(html) &&
    !/\.srow \.snt\{[^}]*line-clamp/.test(html) && /\.srow\{[^}]*min-height:218px/.test(html) &&
    !screen.includes('НЕТ ПОКУПОК'));
}

{ const shop=c.__api.SHOP;
  ok('блок полностью удалён из каталога', !shop.some(x=>x.id==='block'));
  ok('общее снижение урона удалено из каталога', !shop.some(x=>x.id==='dr'));
  ok('дубликат брони и быстрый сбор удалены из каталога',
    !shop.some(x=>x.id==='sarmor') && !shop.some(x=>x.id==='vacuum'));
  const armorItems=shop.filter(x=>x.nm==='БРОНЯ');
  ok('в каталоге осталась ровно одна основная броня',
    armorItems.length===1 && armorItems[0].id==='armor' && armorItems[0].base===3600);
  const sxp=shop.find(x=>x.id==='sxp'), sgold=shop.find(x=>x.id==='sgold');
  ok('опыт подорожал втрое', !!sxp && sxp.base===1500 && c.shopCost(sxp,0)===1500,
    sxp ? sxp.base.toLocaleString('ru-RU')+' золота' : 'товар не найден');
  ok('золото подорожало в полтора раза', !!sgold && sgold.base===750 && c.shopCost(sgold,0)===750,
    sgold ? sgold.base.toLocaleString('ru-RU')+' золота' : 'товар не найден');
  const dmg=shop.find(x=>x.id==='dmg'), aspd=shop.find(x=>x.id==='aspd');
  ok('весь урон подорожал в 2,5 раза', !!dmg && dmg.base===6250 && c.shopCost(dmg,0)===6250,
    dmg ? dmg.base.toLocaleString('ru-RU')+' золота' : 'товар не найден');
  ok('скорость атаки подорожала втрое', !!aspd && aspd.base===7500 && c.shopCost(aspd,0)===7500,
    aspd ? aspd.base.toLocaleString('ru-RU')+' золота' : 'товар не найден');
  const dodge=shop.find(x=>x.id==='dodge');
  ok('уворот подорожал ровно на 20%', !!dodge && dodge.base===4200 && c.shopCost(dodge,0)===4200,
    dodge ? dodge.base.toLocaleString('ru-RU')+' золота' : 'товар не найден');
  const shell=shop.find(x=>x.id==='drFlat');
  ok('«Панцирь от роя»: потолок 100', !!shell && shell.max===100,
    shell ? 'потолок '+shell.max : 'товар не найден');
  ok('«Панцирь от роя»: супер дешёвая кривая', !!shell && shell.base===250 && shell.grow===1.03 &&
    shop.filter(x=>x.cat==='defense' && x.id!=='drFlat').every(x=>c.shopCost(shell,0)<c.shopCost(x,0)),
    shell ? c.shopCost(shell,0).toLocaleString('ru-RU')+' золота за первый ранг' : 'товар не найден'); }

{ const defense=loadGame('./index.html');
  defense.__api.STORE.data.shop={drFlat:100,block:60,dr:60,sarmor:70,vacuum:10};
  defense.newGame('bow','keys');
  ok('старые блок и снижение урона не дают характеристик', !('block' in defense.__api.D) && !('dr' in defense.__api.D));
  ok('удалённые броня и быстрый сбор не дают характеристик',
    defense.__api.D.drShop===0 && defense.__api.D.lootVacuum===1);
  ok('100 рангов панциря входят в новый забег', defense.__api.D.drFlat===100,
    '−'+defense.__api.D.drFlat+' с каждого попадания'); }

{ const legacy=loadGame('./index.html');
  const oldDr={base:3000,grow:1.075}, oldBlock={base:2500,grow:1.07}, oldVacuum={base:3000,grow:1.55};
  const expected=[0,1,2].reduce((s,i)=>s+legacy.shopCost(oldDr,i),0)+
    [0,1].reduce((s,i)=>s+legacy.shopCost(oldBlock,i),0)+
    [0,1,2,3].reduce((s,i)=>s+legacy.shopCost(oldDr,i),0)+
    [0,1].reduce((s,i)=>s+legacy.shopCost(oldVacuum,i),0);
  legacy.__api.STORE.data.gold=100;
  legacy.__api.STORE.data.spent=expected+50;
  legacy.__api.STORE.data.shop={dr:3,block:2,sarmor:4,vacuum:2,armor:1};
  legacy.__api.STORE.save();
  ok('старые покупки удалённых защит возвращаются золотом', legacy.__api.STORE.data.gold===100+expected &&
    legacy.__api.STORE.data.spent===50, '+'+expected.toLocaleString('ru-RU')+' золота');
  ok('миграция удаляет только снятые с продажи товары', !('dr' in legacy.__api.STORE.data.shop) &&
    !('block' in legacy.__api.STORE.data.shop) && !('sarmor' in legacy.__api.STORE.data.shop) &&
    !('vacuum' in legacy.__api.STORE.data.shop) && legacy.__api.STORE.data.shop.armor===1);
  const gold=legacy.__api.STORE.data.gold;
  legacy.__api.STORE.save();
  ok('повторная миграция не выдаёт золото снова', legacy.__api.STORE.data.gold===gold); }
