/* «Первый шаг»: дорогая постоянная покупка выдаёт обычные выборы навыков
   до первого боя. Проверяем сам каталог, рост цены и число стартовых выборов. */
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(44) + (det || ''));

const c = loadGame('./PolyGrind.html');
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

{ const base = loadGame('./PolyGrind.html'); base.newGame('necro', 'keys');
  const boosted = loadGame('./PolyGrind.html');
  boosted.__api.STORE.data.shop = {dmg:100, aspd:50}; boosted.newGame('necro', 'keys');
  ok('урон магазина доходит до свиты', Math.abs(boosted.avgHit() / base.avgHit() - 2) < 0.001,
     base.avgHit().toFixed(1) + ' → ' + boosted.avgHit().toFixed(1));
  ok('скорость атаки магазина доходит до свиты', Math.abs(boosted.__api.D.minAspd / base.__api.D.minAspd - 1.5) < 0.001,
     base.__api.D.minAspd.toFixed(2) + ' → ' + boosted.__api.D.minAspd.toFixed(2)); }

{ const r = c.__api.SHOP.find(x => x.id === 'regen');
  ok('регенерация: потолок 50 HP/сек', !!r && r.max === 50 && r.fmt(r.max) === '+50 HP/сек',
     r ? r.fmt(r.max) : 'товар не найден');
  ok('регенерация: базовая цена удвоена', !!r && r.base === 3000 && c.shopCost(r,0) === 3000,
     r ? c.shopCost(r,0).toLocaleString('ru-RU') + ' золота' : 'товар не найден');
  c.__api.STORE.data.shop.regen = 49;
  const batch = c.shopBatch(r, 10);
  ok('пакетная покупка останавливается на 50', batch.cnt === 1,
     'доступно уровней: ' + batch.cnt); }

{ const legacy = loadGame('./PolyGrind.html');
  legacy.__api.STORE.data.shop.regen = 100; legacy.newGame('bow','keys');
  ok('старое сохранение не превышает новый потолок', legacy.__api.D.regen === 50,
     legacy.__api.D.regen.toFixed(0) + ' HP/сек'); }

{ const refund = loadGame('./PolyGrind.html'), item = refund.__api.SHOP.find(x => x.id === 'armor');
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
