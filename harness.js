/* Заглушка DOM: вырезаем JS из HTML и исполняем в vm. */
const fs = require('fs'), vm = require('vm');

function loadGame(file, options={}){
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('не нашёл <script>');
  // let/const в vm НЕ попадают в глобальный объект — пробрасываем мостом.
  const js = m[1] + '\n;this.__api = { get G(){return G}, get D(){return D}, ' +
             'get MODS(){return MODS}, get BOOKS(){return BOOKS}, get AMULETS(){return AMULETS}, ' +
             'get TOTEMS(){return TOTEMS}, get BOSS_TYPES(){return BOSS_TYPES}, get BOSS_KEYS(){return BOSS_KEYS}, ' +
             'get WEAPONS(){return WEAPONS}, get SUBCLASSES(){return SUBCLASSES}, get ETYPES(){return ETYPES}, ' +
             'get STORE(){return Store}, get PACKS(){return PACK_AFFIXES}, ' +
             'get SFX_SETTINGS(){return {volume:SFX_VOLUME,muted:SFX_MUTED,audible:sfxAudible()}}, ' +
             'get CONSTELLATIONS(){return typeof CONSTELLATIONS!=="undefined"?CONSTELLATIONS:null}, ' +
             'get LANGUAGE(){return LANGUAGE}, localizationMissing:()=>localizationMissing(), ' +
             'constellationMultiplier:(e)=>constellationMultiplier(e), ' +
             'applyBookAilments:(e,total,chanceMul,fixedDamageMul,minionShare)=>applyBookAilments(e,total,chanceMul,fixedDamageMul,minionShare), ' +
             'affectsMinions:(m)=>affectsMinions(m), get MINION_STATS(){return MINION_STATS}, ' +
             'get ELEMENTAL_BALANCE(){return {igniteDps:IGNITE_DPS_SHARE,poisonDps:POISON_DPS_SHARE,' +
             'chillDuration:CHILL_DURATION,chillDamage:CHILL_DAMAGE_SHARE,chillTaken:CHILL_TAKEN_INC,chillSlow:CHILL_SLOW,chillAuraSlow:CHILL_AURA_SLOW,' +
             'freezeChance:FREEZE_CHANCE,freezeDuration:FREEZE_DURATION,freezeTaken:FREEZE_TAKEN_INC,' +
             'shockDuration:SHOCK_DURATION,shockTaken:SHOCK_TAKEN_INC,shockTargets:shockTargets(),shockShare:shockShare()}} , ' +
             'get DROP_BALANCE(){return {itemScale:ITEM_DROP_SCALE,bookScale:BOOK_DROP_SCALE,totemScale:TOTEM_DROP_SCALE,' +
             'findRateScale:FIND_RATE_SCALE,itemShare:AMU_SHARE*ITEM_DROP_SCALE/FIND_RATE_SCALE,' +
             'totemShare:TOTEM_SHARE*TOTEM_DROP_SCALE/FIND_RATE_SCALE}}, ' +
             'get SHOP(){return typeof SHOP!=="undefined"?SHOP:null}, ' +
             'get AFFIXES(){return typeof BOSS_AFFIXES!=="undefined"?BOSS_AFFIXES:null}, ' +
             'get FLOOR_TEXTURES(){return {data:FLOOR_TILE_DATA,names:FLOOR_TILE_NAMES,index:floorTextureIndex,patternIndex:floorPatternIndex}}, ' +
             'selectFloorTexture:(i)=>selectRandomFloorPattern(i), ' +
             'get CORPSE_SPRITE_DATA(){return CORPSE_SPRITE_DATA}, get CORPSE_PUDDLE_DATA(){return CORPSE_PUDDLE_DATA}, ' +
             'corpseSpriteKey:(c)=>corpseSpriteKey(c), corpsePuddleVariant:()=>corpsePuddleVariant(), ' +
             'leaveVisualCorpse:(e)=>leaveVisualCorpse(e), drawVisualCorpses:(l,t,r,b)=>drawVisualCorpses(l,t,r,b), ' +
             'killEnemy:(e,i)=>killEnemy(e,i), buildFloor:()=>buildFloor() };\n';

  const noop = () => {};
  const gradient = () => ({addColorStop:noop});
  const canvasContext = () => new Proxy({
    createLinearGradient:gradient, createRadialGradient:gradient, createConicGradient:gradient,
    createPattern:()=>({setTransform:noop}), measureText:text=>({width:String(text||'').length*8}),
    getImageData:(x=0,y=0,w=1,h=1)=>({data:new Uint8ClampedArray(Math.max(0,w*h*4)),width:w,height:h}),
    isPointInPath:()=>false, isPointInStroke:()=>false,
  }, {get:(t,k)=> k in t ? t[k] : noop, set:(t,k,v)=>{t[k]=v;return true;}});
  const el = new Proxy({style:{}, dataset:{}, innerHTML:'', textContent:'',
    clientWidth:1280, clientHeight:720, width:1280, height:720,
    getContext:canvasContext,
    addEventListener:noop, getBoundingClientRect:()=>({left:0,top:0}),
    classList:{add:noop, remove:noop, toggle:noop}},
    {get:(t,k)=> k in t ? t[k] : noop, set:(t,k,v)=>{ t[k]=v; return true; }});

  const c = {
    document:{getElementById:()=>el, querySelector:()=>el, querySelectorAll:()=>[],
              addEventListener:noop, body:el},
    window:{devicePixelRatio:1, addEventListener:noop, localStorage:options.localStorage},
    addEventListener:noop, requestAnimationFrame:noop,
    performance:{now:()=>0}, setTimeout:noop, clearTimeout:noop,
    localStorage:options.localStorage, Audio:options.Audio, console,
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
