/* Заглушка DOM: собираем подключённые JS-файлы и исполняем их в vm. */
const fs = require('fs'), path = require('path'), vm = require('vm');

const MIME_BY_EXTENSION = {
  '.png':'image/png', '.webp':'image/webp', '.ogg':'audio/ogg', '.woff2':'font/woff2',
};

function inlineInspectionAssets(source, sourceFile, projectRoot){
  return source.replace(/(?:\.\.\/)*assets\/[A-Za-z0-9_./-]+\.(?:png|webp|ogg|woff2)/g, reference => {
    const normalized = reference.replace(/\\/g, '/');
    const absolute = normalized.startsWith('assets/')
      ? path.resolve(projectRoot, normalized)
      : path.resolve(path.dirname(sourceFile), normalized);
    const mime = MIME_BY_EXTENSION[path.extname(absolute).toLowerCase()];
    if (!mime || !fs.existsSync(absolute)) throw new Error('missing runtime asset: ' + absolute);
    const codecs = mime === 'audio/ogg' && /(?:hover|confirm)-sound/.test(absolute) ? ';codecs=opus' : '';
    return `data:${mime}${codecs};base64,${fs.readFileSync(absolute).toString('base64')}`;
  });
}

/* Совместимое представление для старых source-level регрессий. Оно собирается
   только в памяти тестового процесса; runtime и репозиторий остаются многофайловыми. */
function loadInspectionSource(file){
  const absoluteHtml = path.resolve(file);
  const projectRoot = path.dirname(absoluteHtml);
  let html = fs.readFileSync(absoluteHtml, 'utf8');
  html = html.replace(/<link\b([^>]*\brel=["']stylesheet["'][^>]*)>/gi, whole => {
    const href = whole.match(/\bhref=["']([^"']+)["']/i);
    if (!href) return whole;
    const cssFile = path.resolve(projectRoot, href[1]);
    const css = inlineInspectionAssets(fs.readFileSync(cssFile, 'utf8'), cssFile, projectRoot);
    return `<style>\n${css}\n</style>`;
  });
  html = html.replace(/<script\b([^>]*)><\/script>/gi, (whole, attributes) => {
    const src = attributes.match(/\bsrc=["']([^"']+)["']/i);
    if (!src) return whole;
    const jsFile = path.resolve(projectRoot, src[1]);
    const js = inlineInspectionAssets(fs.readFileSync(jsFile, 'utf8'), jsFile, projectRoot);
    return `<script>\n${js}\n</script>`;
  });
  return html;
}

function loadGameSource(file){
  const html = fs.readFileSync(file, 'utf8');
  const base = path.dirname(path.resolve(file));
  const blocks = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const src = match[1].match(/\bsrc=["']([^"']+)["']/i);
    if (!src){
      if (match[2].trim()) blocks.push(match[2]);
      continue;
    }
    if (/^(?:[a-z]+:)?\/\//i.test(src[1])) throw new Error('remote script is not supported by harness: ' + src[1]);
    blocks.push(fs.readFileSync(path.resolve(base, src[1]), 'utf8'));
  }
  if (!blocks.length) throw new Error('не нашёл подключённых <script>');
  return blocks.join('\n\n');
}

function loadGame(file, options={}){
  // let/const в vm НЕ попадают в глобальный объект — пробрасываем мостом.
  const js = loadGameSource(file) + '\n;this.__api = { get G(){return G}, get D(){return D}, ' +
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
             'get ASSETS(){return {enemyAttack:ENEMY_ATTACK_SPRITE_DATA,eliteAttack:ELITE_ATTACK_SPRITE_DATA,' +
             'rareItems:RARE_ITEM_SPRITE_DATA,rareItemsFloor:RARE_ITEM_FLOOR_SPRITE_DATA,' +
             'loot:LOOT_SPRITE_DATA,booksFloor:BOOK_FLOOR_SPRITE_DATA}}, ' +
             'get AUDIO_ASSETS(){return {menu:MENU_MUSIC_DATA,confirm:CONFIRM_SOUND_DATA,hover:HOVER_SOUND_DATA,' +
             'monsterHit:MONSTER_HIT_SOUND_DATA,monsterDeath:MONSTER_DEATH_SOUND_DATA}}, ' +
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
module.exports = { loadGame, loadGameSource, loadInspectionSource };
