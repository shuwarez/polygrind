/* Заглушка DOM: вырезаем JS из HTML и исполняем в vm. */
const fs = require('fs'), vm = require('vm');

function loadGame(file){
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
             'affectsMinions:(m)=>affectsMinions(m), get MINION_STATS(){return MINION_STATS}, ' +
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
    localStorage:undefined, console, Math, Date, JSON,
  };
  c.window.window = c.window;
  vm.createContext(c);
  vm.runInContext(js, c);
  return c;
}
module.exports = { loadGame };
