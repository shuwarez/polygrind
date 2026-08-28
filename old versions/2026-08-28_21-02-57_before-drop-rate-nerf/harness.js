/* Заглушка DOM: вырезаем JS из HTML и исполняем в vm. */
const fs = require('fs'), vm = require('vm');

function loadGame(file, options={}){
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('не нашёл <script>');
  // let/const в vm НЕ попадают в глобальный объект — пробрасываем мостом.
  const js = m[1] + '\n;this.__api = { get G(){return G}, get D(){return D}, ' +
             'get MODS(){return MODS}, get BOOKS(){return BOOKS}, ' +
             'get WEAPONS(){return WEAPONS}, get SUBCLASSES(){return SUBCLASSES}, get ETYPES(){return ETYPES}, ' +
             'get STORE(){return Store}, get PACKS(){return PACK_AFFIXES}, ' +
             'get CONSTELLATIONS(){return typeof CONSTELLATIONS!=="undefined"?CONSTELLATIONS:null}, ' +
             'get LANGUAGE(){return LANGUAGE}, localizationMissing:()=>localizationMissing(), ' +
             'constellationMultiplier:(e)=>constellationMultiplier(e), ' +
             'applyBookAilments:(e,total,chanceMul,fixedDamageMul,minionShare)=>applyBookAilments(e,total,chanceMul,fixedDamageMul,minionShare), ' +
             'affectsMinions:(m)=>affectsMinions(m), get MINION_STATS(){return MINION_STATS}, ' +
             'get ELEMENTAL_BALANCE(){return {igniteDps:IGNITE_DPS_SHARE,poisonDps:POISON_DPS_SHARE,' +
             'chillDuration:CHILL_DURATION,chillDamage:CHILL_DAMAGE_SHARE,chillTaken:CHILL_TAKEN,chillSlow:CHILL_SLOW,chillAuraSlow:CHILL_AURA_SLOW,' +
             'freezeChance:FREEZE_CHANCE,freezeDuration:FREEZE_DURATION,freezeTaken:FREEZE_TAKEN,' +
             'shockDuration:SHOCK_DURATION,shockTaken:SHOCK_TAKEN,shockTargets:shockTargets(),shockShare:shockShare()}} , ' +
             'get SHOP(){return typeof SHOP!=="undefined"?SHOP:null}, ' +
             'get AFFIXES(){return typeof BOSS_AFFIXES!=="undefined"?BOSS_AFFIXES:null} };\n';

  const noop = () => {};
  const el = new Proxy({style:{}, dataset:{}, innerHTML:'', textContent:'',
    clientWidth:1280, clientHeight:720, width:1280, height:720,
    getContext:()=>new Proxy({}, {get:()=>noop, set:()=>true}),
    addEventListener:noop, getBoundingClientRect:()=>({left:0,top:0}),
    classList:{add:noop, remove:noop, toggle:noop}},
    {get:(t,k)=> k in t ? t[k] : noop, set:(t,k,v)=>{ t[k]=v; return true; }});

  const c = {
    document:{getElementById:()=>el, querySelector:()=>el, querySelectorAll:()=>[],
              addEventListener:noop, body:el},
    window:{devicePixelRatio:1, addEventListener:noop, localStorage:undefined},
    addEventListener:noop, requestAnimationFrame:noop,
    performance:{now:()=>0}, setTimeout:noop, clearTimeout:noop,
    localStorage:undefined, console,
    // Баланс-аудит подставляет общий seeded random и в игру, и в выбор карточек.
    // Без этого два прогона одного seed расходятся уже на первой пачке врагов.
    Math: options.random ? Object.assign(Object.create(Math), {random:options.random}) : Math,
    Date, JSON,
  };
  c.window.window = c.window;
  vm.createContext(c);
  vm.runInContext(js, c);
  return c;
}
module.exports = { loadGame };
