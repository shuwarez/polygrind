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
