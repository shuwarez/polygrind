/* Компактные листы героев: только медленная ходьба, встраивание и направление. */
const fs = require('fs'), crypto = require('crypto');
const {loadGame} = require('./sim');
const html = fs.readFileSync('./PolyGrind.html','utf8');
const optimizer = fs.readFileSync('./optimize_graphics.py','utf8');
const ok = (nm, cond, det) => console.log((cond?'  \u2713 ':'  \u2717 ') + nm.padEnd(54) + (det||''));

const menuBackgroundMatch=html.match(/url\("data:image\/webp;base64,([^"]+)"\) center\/cover no-repeat/);
const menuBackground=menuBackgroundMatch&&Buffer.from(menuBackgroundMatch[1],'base64');
const menuBackgroundHash=menuBackground&&crypto.createHash('sha256').update(menuBackground).digest('hex').toUpperCase();
ok('тёмная стена кузницы сжата в WebP и встроена без runtime-файла',
  !!menuBackground && menuBackground.subarray(0,4).toString()==='RIFF' &&
  menuBackground.subarray(8,12).toString()==='WEBP' && menuBackground.subarray(12,16).toString()==='VP8 ' &&
  (menuBackground.readUInt16LE(26)&0x3fff)===1672 && (menuBackground.readUInt16LE(28)&0x3fff)===941 &&
  menuBackground.length===14556 && menuBackgroundHash==='571683AB685F6ABBB3356031C5DCFBD4EC22D8753CB8AE8D3AB6A7DBE65D3C92' &&
  !html.includes('assets/menu-forge-background.png') &&
  html.includes('radial-gradient(ellipse 70% 62% at 50% 42%') &&
  optimizer.includes('MENU_BACKGROUND_WEBP_SHA256 = "571683ab685f6abbb3356031c5dcfbd4ec22d8753cb8ae8d3ab6a7dbe65d3c92"') &&
  optimizer.includes('--install-menu-background'),
  (menuBackground?menuBackground.length:0)+' Б');

const musicMatch=html.match(/const MENU_MUSIC_DATA = 'data:audio\/ogg;base64,([^']+)'/);
const musicOgg=musicMatch&&Buffer.from(musicMatch[1],'base64');
const musicHash=musicOgg&&crypto.createHash('sha256').update(musicOgg).digest('hex').toUpperCase();
ok('музыка главного меню встроена точным OGG/Vorbis без внешнего файла',
  !!musicOgg && musicOgg.subarray(0,4).toString()==='OggS' && musicOgg.includes(Buffer.from('vorbis')) &&
  musicOgg.length===203349 && musicHash==='077F237A32911F2CE4564CB39991CD2EC96D553E2ECE6F87B8048DBA4C0B9E2B',
  (musicOgg?musicOgg.length:0)+' Б');
const confirmMatch=html.match(/const CONFIRM_SOUND_DATA = 'data:audio\/ogg;codecs=opus;base64,([^']+)'/);
const confirmOgg=confirmMatch&&Buffer.from(confirmMatch[1],'base64');
const confirmHash=confirmOgg&&crypto.createHash('sha256').update(confirmOgg).digest('hex').toUpperCase();
ok('подтверждение встроено точным компактным OGG/Opus без внешнего файла',
  !!confirmOgg && confirmOgg.subarray(0,4).toString()==='OggS' && confirmOgg.includes(Buffer.from('OpusHead')) &&
  confirmOgg.length===1865 && confirmHash==='300084B049183CA0E8DA0938208A6DB95AD9EE67254FE81B2138A28CBDC2D62E',
  (confirmOgg?confirmOgg.length:0)+' Б');
ok('оптимизатор проверяет хеш и автономно встраивает подтверждение',
  optimizer.includes('CONFIRM_SOUND_SHA256 = "300084b049183ca0e8da0938208a6db95ad9ee67254fe81b2138a28cbdc2d62e"') &&
  optimizer.includes('--install-confirm-sound') && optimizer.includes('grim-grind-confirm-click.opus'));
const hoverMatch=html.match(/const HOVER_SOUND_DATA = 'data:audio\/ogg;codecs=opus;base64,([^']+)'/);
const hoverOgg=hoverMatch&&Buffer.from(hoverMatch[1],'base64');
const hoverHash=hoverOgg&&crypto.createHash('sha256').update(hoverOgg).digest('hex').toUpperCase();
ok('новый Hover UI встроен точным компактным OGG/Opus без внешнего файла',
  !!hoverOgg && hoverOgg.subarray(0,4).toString()==='OggS' && hoverOgg.includes(Buffer.from('OpusHead')) &&
  hoverOgg.length===1358 && hoverHash==='64B6E293A63D3E76658572C83F875F874A8B61842ED799238D41A1441A817F18',
  (hoverOgg?hoverOgg.length:0)+' Б');
ok('оптимизатор проверяет хеш и автономно встраивает Hover UI',
  optimizer.includes('HOVER_SOUND_SHA256 = "64b6e293a63d3e76658572c83f875f874a8b61842ed799238d41a1441a817f18"') &&
  optimizer.includes('--install-hover-sound') && optimizer.includes('grim-grind-hover-ui.opus'));

const archerSoundBlock=(html.match(/const ARCHER_SHOT_SOUND_DATA = \[([\s\S]*?)\];/)||[])[1]||'';
const archerSoundMatches=[...archerSoundBlock.matchAll(/'data:audio\/ogg;base64,([^']+)'/g)];
const archerSoundExpected=[
  [4645,'2BFD7A9CF697ECFB5730D38BB20A20494B2E584AA8D0622C9EA2FDBAF869AD80'],
  [4668,'A537C616742C4D4FA3919A61CAF2C53EAD11C3D1754AA3940CE28F9B0101CC9E'],
  [4687,'1BED32779ACA31427B20BCF2A5D264437C618E1778DB384FFCE677114A5BCF40'],
  [4544,'469400E38347E51F95DF933F5C58EDD6D3537CCD8129AE77BDFBF47E74B97231'],
];
const archerSoundBuffers=archerSoundMatches.map(match=>Buffer.from(match[1],'base64'));
ok('четыре оригинальных OGG/Vorbis выстрела Лучника встроены без потерь',
  archerSoundBuffers.length===4 && archerSoundBuffers.every((data,index)=>
    data.subarray(0,4).toString()==='OggS' && data.includes(Buffer.from('vorbis')) &&
    data.length===archerSoundExpected[index][0] &&
    crypto.createHash('sha256').update(data).digest('hex').toUpperCase()===archerSoundExpected[index][1]),
  archerSoundBuffers.reduce((sum,data)=>sum+data.length,0)+' Б');
ok('оптимизатор проверяет четыре хеша и автономно встраивает выстрелы',
  optimizer.includes('ARCHER_SHOT_SOUND_SHA256 = (') &&
  archerSoundExpected.every(([,hash])=>optimizer.includes(hash.toLowerCase())) &&
  optimizer.includes('--install-archer-shot-sounds'));

const warriorSoundBlock=(html.match(/const WARRIOR_ATTACK_SOUND_DATA = \[([\s\S]*?)\];/)||[])[1]||'';
const warriorSoundMatches=[...warriorSoundBlock.matchAll(/'data:audio\/ogg;base64,([^']+)'/g)];
const warriorSoundExpected=[
  [4466,'3A72D4A60FA8D79D98001586F89084EE391ED9766D80BB97B2271AFC57B0D5C5'],
  [4551,'3EF1FE28C3797BD4427AA0766F6D8F51DD4C4A4F8AA31216A89B1C550B75F82B'],
  [4856,'609857AAC108498A369327CD6BF3F73E8C2A51840F452E644AFEB65844EDCE41'],
  [4905,'14348E52D7E875EA1E05F27655B232EF63BDEE975438C3390E45611BC903D315'],
];
const warriorSoundBuffers=warriorSoundMatches.map(match=>Buffer.from(match[1],'base64'));
ok('четыре оригинальных OGG/Vorbis атаки Воина встроены без потерь',
  warriorSoundBuffers.length===4 && warriorSoundBuffers.every((data,index)=>
    data.subarray(0,4).toString()==='OggS' && data.includes(Buffer.from('vorbis')) &&
    data.length===warriorSoundExpected[index][0] &&
    crypto.createHash('sha256').update(data).digest('hex').toUpperCase()===warriorSoundExpected[index][1]),
  warriorSoundBuffers.reduce((sum,data)=>sum+data.length,0)+' Б');
ok('оптимизатор проверяет четыре хеша и автономно встраивает атаки Воина',
  optimizer.includes('WARRIOR_ATTACK_SOUND_SHA256 = (') &&
  warriorSoundExpected.every(([,hash])=>optimizer.includes(hash.toLowerCase())) &&
  optimizer.includes('--install-warrior-attack-sounds'));

const mageSoundBlock=(html.match(/const MAGE_ATTACK_SOUND_DATA = \[([\s\S]*?)\];/)||[])[1]||'';
const mageSoundMatches=[...mageSoundBlock.matchAll(/'data:audio\/ogg;base64,([^']+)'/g)];
const mageSoundExpected=[
  [5233,'3B6BAF3457EB7FC4BC3D0EDCBCCC9B670F5A3019E6566F18EA91493C3A14BAEE'],
  [5261,'2F705E4EB6720AEC80E4480B7D1FD7E2B5B37A71CED16B7CB6C052ECBCF6390F'],
  [5199,'442AFD04D92987BB9EB4D90F1FD06B8DC93A62AFCB673CDB6BCF98B19319EBED'],
  [5217,'013D99D1BFDB688AD9E6F85E10C2BF579BBB9740F66855BACAD76CBFBA9C2417'],
];
const mageSoundBuffers=mageSoundMatches.map(match=>Buffer.from(match[1],'base64'));
ok('четыре оригинальных OGG/Vorbis атаки Мага встроены без потерь',
  mageSoundBuffers.length===4 && mageSoundBuffers.every((data,index)=>
    data.subarray(0,4).toString()==='OggS' && data.includes(Buffer.from('vorbis')) &&
    data.length===mageSoundExpected[index][0] &&
    crypto.createHash('sha256').update(data).digest('hex').toUpperCase()===mageSoundExpected[index][1]),
  mageSoundBuffers.reduce((sum,data)=>sum+data.length,0)+' Б');
ok('оптимизатор проверяет четыре хеша и автономно встраивает атаки Мага',
  optimizer.includes('MAGE_ATTACK_SOUND_SHA256 = (') &&
  mageSoundExpected.every(([,hash])=>optimizer.includes(hash.toLowerCase())) &&
  optimizer.includes('--install-mage-attack-sounds'));

class FakeMenuAudio {
  static instances=[];
  constructor(src){ this.src=src; this.loop=false; this.volume=1; this.preload=''; this.currentTime=12; this.plays=0; this.pauses=0; FakeMenuAudio.instances.push(this); }
  play(){ this.plays++; return {catch:()=>{}}; }
  pause(){ this.pauses++; }
}
const randomSoundSelections=[0,.26,.51,.999].map((random,index)=>{
  const before=FakeMenuAudio.instances.length;
  const game=loadGame('./PolyGrind.html',{Audio:FakeMenuAudio,random:()=>random});
  const sounds=FakeMenuAudio.instances.slice(before,before+4);
  game.playArcherShotSound();
  return sounds.length===4 && sounds.every((sound,soundIndex)=>sound.plays===(soundIndex===index?1:0)) &&
    sounds[index].currentTime===0 && sounds[index].volume===.1275 && sounds[index].preload==='auto';
});
ok('каждый выстрел случайно выбирает одну из четырёх вариаций без очереди',
  randomSoundSelections.every(Boolean));
const routedBefore=FakeMenuAudio.instances.length;
const routedGame=loadGame('./PolyGrind.html',{Audio:FakeMenuAudio,random:()=>.51});
const routedSounds=FakeMenuAudio.instances.slice(routedBefore,routedBefore+4);
routedGame.newGame('bow','keys','hunter');
routedGame.__api.D.projN=4;
routedGame.attack();
const afterBow=routedSounds.reduce((sum,sound)=>sum+sound.plays,0);
routedGame.toggleSfxMute(); routedGame.attack();
ok('один залп Лучника даёт один звук и общий mute полностью его глушит',
  routedGame.__api.G.shots.length===8 && afterBow===1 &&
  routedSounds.reduce((sum,sound)=>sum+sound.plays,0)===1 &&
  /if \(w\.id==='wpn\.bow' && \(!src \|\| stepEcho\)\) playArcherShotSound\(\);/.test(html));
const randomWarriorSelections=[0,.26,.51,.999].map((random,index)=>{
  const before=FakeMenuAudio.instances.length;
  const game=loadGame('./PolyGrind.html',{Audio:FakeMenuAudio,random:()=>random});
  const sounds=FakeMenuAudio.instances.slice(before+4,before+8);
  game.playWarriorAttackSound();
  return sounds.length===4 && sounds.every((sound,soundIndex)=>sound.plays===(soundIndex===index?1:0)) &&
    sounds[index].currentTime===0 && sounds[index].volume===.1275 && sounds[index].preload==='auto';
});
ok('каждая атака Воина случайно выбирает одну из четырёх вариаций без очереди',
  randomWarriorSelections.every(Boolean));
const warriorRouteBefore=FakeMenuAudio.instances.length;
const warriorRouteGame=loadGame('./PolyGrind.html',{Audio:FakeMenuAudio,random:()=>.999});
const warriorRouteSounds=FakeMenuAudio.instances.slice(warriorRouteBefore+4,warriorRouteBefore+8);
warriorRouteGame.newGame('blade','keys','guardian');
warriorRouteGame.__api.G.player.bladeN=2;
warriorRouteGame.attack();
const afterSword=warriorRouteSounds.reduce((sum,sound)=>sum+sound.plays,0);
warriorRouteGame.toggleSfxMute(); warriorRouteGame.attack();
ok('один взмах Воина даёт один звук, волна не дублирует его, mute глушит',
  afterSword===1 && warriorRouteSounds.reduce((sum,sound)=>sum+sound.plays,0)===1 &&
  /if \(w\.id==='wpn\.sword' && \(!src \|\| stepEcho\)\) playWarriorAttackSound\(\);/.test(html));
const randomMageSelections=[0,.26,.51,.999].map((random,index)=>{
  const before=FakeMenuAudio.instances.length;
  const game=loadGame('./PolyGrind.html',{Audio:FakeMenuAudio,random:()=>random});
  const sounds=FakeMenuAudio.instances.slice(before+8,before+12);
  game.playMageAttackSound();
  return sounds.length===4 && sounds.every((sound,soundIndex)=>sound.plays===(soundIndex===index?1:0)) &&
    sounds[index].currentTime===0 && sounds[index].volume===.1275 && sounds[index].preload==='auto';
});
ok('каждая атака Мага случайно выбирает одну из четырёх вариаций без очереди',
  randomMageSelections.every(Boolean));
const mageRouteBefore=FakeMenuAudio.instances.length;
const mageRouteGame=loadGame('./PolyGrind.html',{Audio:FakeMenuAudio,random:()=>.26});
const mageRouteSounds=FakeMenuAudio.instances.slice(mageRouteBefore+8,mageRouteBefore+12);
mageRouteGame.newGame('wand','keys','destroyer');
mageRouteGame.__api.D.projN=4;
mageRouteGame.attack();
const afterWand=mageRouteSounds.reduce((sum,sound)=>sum+sound.plays,0);
mageRouteGame.toggleSfxMute(); mageRouteGame.attack();
ok('одна атака Мага даёт один звук, дополнительные сферы молчат, mute глушит',
  mageRouteGame.__api.G.shots.length===8 && afterWand===1 &&
  mageRouteSounds.reduce((sum,sound)=>sum+sound.plays,0)===1 &&
  /if \(w\.id==='wpn\.wand' && \(!src \|\| stepEcho\)\) playMageAttackSound\(\);/.test(html));
class FakeAttackFilterParam {
  constructor(){ this.events=[]; }
  setValueAtTime(value,time){ this.events.push([value,time]); }
}
class FakeAttackFilterContext {
  static last=null;
  constructor(){ this.state='running'; this.currentTime=7; this.destination={}; this.sources=[]; this.filters=[]; FakeAttackFilterContext.last=this; }
  resume(){ this.state='running'; }
  createMediaElementSource(sound){
    const node={sound,connected:null,connect(target){this.connected=target;return target;}};
    this.sources.push(node); return node;
  }
  createBiquadFilter(){
    const node={type:'lowpass',frequency:new FakeAttackFilterParam(),Q:new FakeAttackFilterParam(),connected:null,
      connect(target){this.connected=target;return target;}};
    this.filters.push(node); return node;
  }
}
const filterGame=loadGame('./PolyGrind.html',{Audio:FakeMenuAudio});
filterGame.window.AudioContext=FakeAttackFilterContext;
filterGame.unlockSound(); filterGame.unlockSound();
const attackFilterCtx=FakeAttackFilterContext.last;
ok('все 12 атак дополнительно тише на 15% и проходят через high-pass 230 Hz',
  attackFilterCtx.sources.length===12 && attackFilterCtx.filters.length===12 &&
  attackFilterCtx.filters.every(filter=>filter.type==='highpass' &&
    filter.frequency.events[0][0]===230 && Math.abs(filter.Q.events[0][0]-Math.SQRT1_2)<1e-12 &&
    filter.connected===attackFilterCtx.destination) &&
  html.includes('const ATTACK_SOUND_LEVEL=0.255;') && html.includes('const ATTACK_SOUND_HIGH_PASS_HZ=230;'));
const savedMusic=new Map(), musicStorage={
  getItem:key=>savedMusic.has(key)?savedMusic.get(key):null,
  setItem:(key,value)=>savedMusic.set(key,String(value)),
};
const musicGame=loadGame('./PolyGrind.html',{Audio:FakeMenuAudio,localStorage:musicStorage});
const menuAudio=FakeMenuAudio.instances.at(-1);
const confirmAudio=FakeMenuAudio.instances.at(-2);
const hoverAudio=FakeMenuAudio.instances.at(-3);
ok('музыка по умолчанию циклична, загружается заранее и играет на 50%',
  menuAudio && menuAudio.loop===true && menuAudio.volume===0.5 && menuAudio.preload==='auto' &&
  menuAudio.src.startsWith('data:audio/ogg;base64,'));
musicGame.startScreen();
ok('главный экран показывает доступную кнопку и запускает включённую музыку',
  menuAudio.plays===1 && musicGame.document.getElementById('ov').innerHTML.includes('id="menumusicb"') &&
  musicGame.document.getElementById('ov').innerHTML.includes('aria-pressed="true"'));
ok('нажатие выключает музыку и сохраняет off в localStorage',
  musicGame.toggleMenuMusic()===false && menuAudio.pauses===1 && savedMusic.get('polygrind_menu_music')==='off');
const topSfxOn=musicGame.menuSfxButtonHtml();
musicGame.toggleSfxMute();
const topSfxOff=musicGame.menuSfxButtonHtml();
musicGame.toggleSfxMute();
ok('верхняя панель главного меню содержит сохраняемый переключатель всех звуков',
  topSfxOn.includes('id="menusfxtoggle"') && topSfxOn.includes('SOUNDS: ON') && topSfxOn.includes('aria-pressed="true"') &&
  topSfxOff.includes('SOUNDS: OFF') && topSfxOff.includes('aria-pressed="false"') &&
  savedMusic.get('polygrind_sfx_muted')==='off' &&
  html.includes('languageSwitchHtml() + menuMusicButtonHtml() + menuSfxButtonHtml()') &&
  /function bindMenuSfxButton\(\)\{\s*const button=\$\('#menusfxtoggle'\); if \(button\) button\.onclick=toggleSfxMute;/.test(html));
const mutedGame=loadGame('./PolyGrind.html',{Audio:FakeMenuAudio,localStorage:musicStorage}), mutedAudio=FakeMenuAudio.instances.at(-1);
mutedGame.startScreen();
ok('после повторной загрузки сохранённое выключение не запускает музыку',
  mutedAudio.plays===0 && mutedGame.document.getElementById('ov').innerHTML.includes('aria-pressed="false"') &&
  mutedGame.document.getElementById('ov').innerHTML.includes('MUSIC: OFF'));
mutedGame.toggleMenuMusic(); mutedAudio.currentTime=9; mutedGame.newGame('bow','keys');
ok('включение снова запускает трек, а старт забега останавливает и перематывает его',
  mutedAudio.plays===1 && mutedAudio.pauses===1 && mutedAudio.currentTime===0 && savedMusic.get('polygrind_menu_music')==='on');
musicGame.playConfirmSound();
ok('подтверждение загружается заранее и дополнительно приглушено на 20%',
  confirmAudio && confirmAudio.preload==='auto' && confirmAudio.currentTime===0 &&
  confirmAudio.volume===0.4 && confirmAudio.plays===1 && confirmAudio.src.startsWith('data:audio/ogg;codecs=opus;base64,'));
const hoverClickable={contains:node=>node==='inside'};
const hoverRoot={contains:node=>node===hoverClickable};
const hoverTarget={closest:selector=>selector==='#ov.menu'?hoverRoot:hoverClickable};
const hoverPlayed=musicGame.handleMenuHover({pointerType:'mouse',target:hoverTarget,relatedTarget:null});
const hoverChildIgnored=musicGame.handleMenuHover({pointerType:'mouse',target:hoverTarget,relatedTarget:'inside'});
const hoverTouchIgnored=musicGame.handleMenuHover({pointerType:'touch',target:hoverTarget,relatedTarget:null});
ok('Hover UI дополнительно тише на 20% и не наслаивается внутри элемента',
  hoverPlayed && !hoverChildIgnored && hoverAudio.preload==='auto' && hoverAudio.currentTime===0 &&
  Math.abs(hoverAudio.volume-0.08)<1e-12 && hoverAudio.plays===1 && hoverAudio.src.startsWith('data:audio/ogg;codecs=opus;base64,') &&
  html.includes('const MENU_SFX_LEVEL=0.80;'));
const hoverPausesBeforeClick=hoverAudio.pauses;
musicGame.playConfirmSound();
ok('клик немедленно останавливает и перематывает активный Hover UI',
  confirmAudio.plays===2 && hoverAudio.pauses===hoverPausesBeforeClick+1 && hoverAudio.currentTime===0 &&
  html.includes('function stopHoverSound()') && /function playConfirmSound\(\)\{\s*stopHoverSound\(\);/.test(html));
ok('делегирование охватывает кнопки, карточки и ползунки только мышью',
  !hoverTouchIgnored && html.includes("target.closest('button,[role=\"button\"],.card,input[type=\"range\"]')") &&
  html.includes("addEventListener('pointerover', handleMenuHover, {passive:true})"));
musicGame.toggleSfxMute(); musicGame.playConfirmSound();
ok('отключение игровых звуков полностью глушит подтверждение',
  confirmAudio.plays===2 && savedMusic.get('polygrind_sfx_muted')==='on');
musicGame.playHoverSound();
ok('отключение игровых звуков также полностью глушит Hover UI',
  hoverAudio.plays===1 && savedMusic.get('polygrind_sfx_muted')==='on');
ok('подтверждение назначено входам и всем возвратам мета-меню',
  /openClass = \(\) => \{ playConfirmSound\(\); subclassScreen/.test(html) &&
  /shopb'\)\.onclick = \(\) => \{ playConfirmSound\(\); shopScreen/.test(html) &&
  /constb'\)\.onclick = \(\) => \{ playConfirmSound\(\); constellationScreen/.test(html) &&
  /el\.onclick = \(\) => \{\s*playConfirmSound\(\);\s*controlScreen\(wk, el\.dataset\.s\)/.test(html) &&
  /graveb'\)\.onclick = \(\) => runConfirmedMenuAction\(graveyardScreen\)/.test(html) &&
  /settingsb'\)\.onclick = \(\) => runConfirmedMenuAction\(menuSettingsScreen\)/.test(html) &&
  /settingsback'\)\.onclick=\(\)=>runConfirmedMenuAction\(startScreen\)/.test(html) &&
  /constback'\)\.onclick = \(\) => runConfirmedMenuAction\(back\)/.test(html) &&
  /shopback'\)\.onclick = \(\) => \{\s*\$\('#ov'\)\.classList\.remove\('shop-menu'\); menuMode=false;\s*runConfirmedMenuAction\(back\)/.test(html) &&
  (html.match(/graveback'\)\.onclick = \(\) => runConfirmedMenuAction/g)||[]).length===2 &&
  /tomenu'\)\.onclick = \(\) => runConfirmedMenuAction\(startScreen\)/.test(html) &&
  /back'\)\.onclick = \(\) => runConfirmedMenuAction\(startScreen\)/.test(html) &&
  /back'\)\.onclick = \(\) => runConfirmedMenuAction\(\(\) => subclassScreen\(wk\)\)/.test(html));

const heroSpriteBlock=(html.match(/const HERO_SPRITE_DATA = \{(.*?)\};/s)||[])[1]||'';
const expected = {
  archer:['EBC31320BC2160D8BB806CEACD77D5E267255DBCFE439A208C3059A0D8025523',1232],
  mage:['DF2C27081F547F9056BF9CD21E1658FD1B9E3C6C286EFE1ECA602F91FEFD5B1B',1211],
  warrior:['362E76C130E2F217EFB68F8E0C2B8E6844653240472A5B546461F1A89757E31E',1300],
  necromancer:['AC7E6339EFD6B73FA75D5EFAA469CAAE0F53DD62720692E324DBEF3A52FE90C7',1197],
};
for (const [key,[wantedHash,wantedBytes]] of Object.entries(expected)){
  const m=heroSpriteBlock.match(new RegExp(key+":'data:image/png;base64,([^']+)'"));
  const png=m && Buffer.from(m[1],'base64');
  const dims=png && png.readUInt32BE(16)+'x'+png.readUInt32BE(20);
  const hash=png && crypto.createHash('sha256').update(png).digest('hex').toUpperCase();
  ok(key+': индексированный лист 4×1 по 32 px встроен', !!png && dims==='128x32' && png.length===wantedBytes,
    (dims||'нет')+' · '+(png?png.length:0)+' Б');
  ok(key+': точные новые пиксели', hash===wantedHash, hash||'нет данных');
}

ok('метаданные задают четыре листа по 32×32 и вывод 48×48',
  (html.match(/frameW:32,frameH:32,drawW:48,drawH:48/g)||[]).length===4);
ok('рендер использует один ряд ходьбы: 8 кадров подкласса и 4 базового героя',
  html.includes('const frame = p.moving ? (subclassActive ? Math.floor(p.heroWalkT||0)%SUBCLASS_HERO_FRAME_COUNT :') &&
  html.includes('Math.floor((p.heroWalkT||0)/2)%4) : 0;') &&
  html.includes('frame*frameW, 0, frameW, frameH') &&
  !html.includes('heroAttackT') && !html.includes('heroSummonT'));
ok('восьмикадровые листы моделей доступны превью подклассов',
  html.includes("heroPreviewHTML(HERO_SPRITE_KEY_BY_WEAPON[wk], 'subclass-sprite', s.id)") &&
  html.includes('data-subclass-preview="1"') && html.includes('background-size:800% 100%'));

const classIconBlock=(html.match(/const CLASS_ICON_SHEET_DATA = \{(.*?)\n\};/s)||[])[1]||'';
const classIcons=Object.fromEntries(
  [...classIconBlock.matchAll(/^\s*(\w+):'data:image\/png;base64,([^']+)',\s*$/gm)]
    .map(match=>[match[1],Buffer.from(match[2],'base64')])
);
ok('устаревшие тяжёлые эмблемы классов удалены из runtime',
  Object.keys(classIcons).length===0 && !html.includes('data-class-icon="1"') &&
  !html.includes('.class-icon.sheet{'));
ok('служебный импорт эмблем сохранён только как автономный инструмент',
  optimizer.includes('CLASS_ICON_SHEET_SOURCES = {') &&
  optimizer.includes('--install-class-icon-sheets') && optimizer.includes('--class-icon-docx') &&
  optimizer.includes('def class_icon_sheet') && optimizer.includes('frame.resize((128, 128), Image.Resampling.LANCZOS)'));

const classFrameBlock=(html.match(/const CLASS_FRAME_DATA = \{(.*?)\n\};/s)||[])[1]||'';
const pngChunkLength=(png,wanted)=>{
  for(let offset=8;offset+12<=png.length;){
    const length=png.readUInt32BE(offset), type=png.subarray(offset+4,offset+8).toString('ascii');
    if(type===wanted) return length;
    offset+=12+length;
  }
  return -1;
};
const indexedFrameOk=(png,w,h)=>!!png && png.subarray(1,4).toString()==='PNG' &&
  png.readUInt32BE(16)===w && png.readUInt32BE(20)===h && png[25]===3 &&
  pngChunkLength(png,'PLTE')>0 && pngChunkLength(png,'PLTE')/3<=256 &&
  pngChunkLength(png,'tRNS')>0 && pngChunkLength(png,'tRNS')<=128;
const pngChunkData=(png,wanted)=>{
  for(let offset=8;offset+12<=png.length;){
    const length=png.readUInt32BE(offset), type=png.subarray(offset+4,offset+8).toString('ascii');
    if(type===wanted) return png.subarray(offset+8,offset+8+length);
    offset+=12+length;
  }
  return null;
};
const subclassSpriteExpected={
  thief:[3923,'C8618541A7146D630673DD553AF7C2F509BB51D708601B185C072E764CA6CFF5'],
  hunter:[4388,'9D549D76BF41E498372DD4CFB2B942999ECA4095B347E62E76E2C7C94DE25B18'],
  dancer:[3939,'C0BD26B4F3275181623667F3F79E28297C01E8FE36CE255F938723F8AB225258'],
  destroyer:[4279,'E7302047110866E912865B23E0316FFC484C8D3181B33BA7BB8328C127CC8FF0'],
  multiplier:[4049,'13210A1BB4E33BB0E83AAD4D69B9F9CBC3295E9AEAC93BAA146BD4668F0D123C'],
  elementalist:[3861,'FEAB017D267DBEE08D5BC37A8E58930E1137DA84FC6ED4C4FEE446C8A6871D9F'],
  graverobber:[3936,'BFF9CF5ECF69AC81D7DD590309EE1B57C58FAD1136DEADC6B3CD3533B68AD1F4'],
  animator:[3895,'B08D0A2F7B9153809DDA2EFC46574619DC91DEFADCCFB1455307D960745DD490'],
  venomancer:[4015,'55E30CF7C5F81A66EA6A4983EA23549CF7BB0B0E641912DFD91C24EC08EB71BE'],
  berserker:[4206,'9DC847439B05FF7D02C71D969563247050F7767AFD54D87FD6F3B44D4057300C'],
  guardian:[3896,'91379C86271516C8E0D0F8E6AFC68B53EE91717054ABACE97145F783C8F1A34D'],
  swordmaster:[4265,'85FF4EC6E73AD9462530A4B2B8F428B91FBC783EAA29402C16B927DB86D791F8'],
};
const subclassSpriteBlock=(html.match(/const SUBCLASS_HERO_SPRITE_DATA = \{(.*?)\n\};/s)||[])[1]||'';
const subclassSprites=Object.fromEntries(
  [...subclassSpriteBlock.matchAll(/^\s*(\w+):'data:image\/png;base64,([^']+)',\s*$/gm)]
    .map(match=>[match[1],Buffer.from(match[2],'base64')])
);
const subclassIds=Object.values(loadGame('./PolyGrind.html').__api.SUBCLASSES).flat().map(s=>s.id);
ok('12 моделей сопоставлены один-к-одному с id каталога SUBCLASSES',
  JSON.stringify(Object.keys(subclassSprites).sort())===JSON.stringify(Object.keys(subclassSpriteExpected).sort()) &&
  Object.keys(subclassSpriteExpected).every(id=>subclassIds.includes(id)) && subclassIds.length===12);
ok('все модели — детальные P-mode PNG 288×36: восемь кадров 36×36',
  Object.entries(subclassSpriteExpected).every(([id,[bytes,hash]])=>{
    const png=subclassSprites[id], palette=png&&pngChunkData(png,'PLTE'), transparency=png&&pngChunkData(png,'tRNS');
    return !!png && png.length===bytes && png.readUInt32BE(16)===288 && png.readUInt32BE(20)===36 &&
      png[25]===3 && !!palette && palette.length/3<=256 && !!transparency && transparency.includes(0) &&
      crypto.createHash('sha256').update(png).digest('hex').toUpperCase()===hash;
  }), Object.values(subclassSprites).reduce((sum,png)=>sum+png.length,0)+' Б');
ok('оптимизатор валидирует handoff и встраивает листы без ресэмплинга',
  optimizer.includes('SUBCLASS_HERO_SPRITE_SOURCES = {') &&
  optimizer.includes('--install-subclass-hero-sprites') && optimizer.includes('--subclass-hero-asset-dir') &&
  optimizer.includes('image.size != (288, 36)') && optimizer.includes('len(colors) > 192') &&
  optimizer.includes('alpha.crop((frame * 36, 0, (frame + 1) * 36, 36))') &&
  optimizer.includes('payload[subclass_name] = base64.b64encode(data)') &&
  !optimizer.includes('subclass_hero_sprite_sheet'));
ok('runtime загружает 12 моделей один раз; меню не получает ухудшенную копию',
  html.includes('const SUBCLASS_HERO_SPRITES = {};') &&
  html.includes('for (const key of Object.keys(SUBCLASS_HERO_SPRITE_DATA))') &&
  html.includes('heroSpriteFor(spriteKey, G.subclass)') &&
  html.includes("preview.style.backgroundImage='url('+SUBCLASS_HERO_SPRITE_DATA[choice.id]+')'") &&
  !html.includes('SUBCLASS_MENU_SPRITE_DATA') &&
  /return subclassSprite && subclassSprite\.complete && subclassSprite\.naturalWidth \?\s*subclassSprite : HERO_SPRITES\[key\]/.test(html));
const classFrames=Object.fromEntries(
  [...classFrameBlock.matchAll(/^\s*(\w+):'data:image\/png;base64,([^']+)',\s*$/gm)]
    .map(match=>[match[1],Buffer.from(match[2],'base64')])
);
ok('четыре рамки V2 — индексированные PNG до 128 цветов и 70 КБ',
  Object.keys(classFrames).length===4 &&
  Object.values(classFrames).every(png=>indexedFrameOk(png,280,390)) &&
  Object.values(classFrames).reduce((sum,png)=>sum+png.length,0)<70000 &&
  optimizer.includes('CLASS_FRAME_SOURCES = {') && optimizer.includes('--install-class-frames') &&
  optimizer.includes('FRAME_PALETTE_COLORS = 128') && optimizer.includes('def indexed_rgba_png') &&
  optimizer.includes('--optimize-embedded-frames'),
  Object.values(classFrames).reduce((sum,png)=>sum+png.length,0)+' Б');
ok('четыре классические классовые рамки снова используются на главном экране',
  html.includes('CLASS_FRAME_DATA[spriteKey]') && html.includes('class="class-card-frame"') &&
  html.includes('.class-card-frame{'));

const subclassFrameBlock=(html.match(/const SUBCLASS_FRAME_DATA = \{(.*?)\n\};/s)||[])[1]||'';
const subclassFrames=Object.fromEntries(
  [...subclassFrameBlock.matchAll(/^\s*(\w+):'data:image\/png;base64,([^']+)',\s*$/gm)]
    .map(match=>[match[1],Buffer.from(match[2],'base64')])
);
ok('12 просторных рамок подклассов — индексированные PNG 320×400 до 190 КБ',
  Object.keys(subclassFrames).length===12 &&
  Object.values(subclassFrames).every(png=>indexedFrameOk(png,320,400)) &&
  Object.values(subclassFrames).reduce((sum,png)=>sum+png.length,0)<190000 &&
  optimizer.includes('SUBCLASS_FRAME_SOURCES = {') && optimizer.includes('--install-subclass-frames') &&
  optimizer.includes('--subclass-frame-asset-dir'),
  Object.values(subclassFrames).reduce((sum,png)=>sum+png.length,0)+' Б');
ok('геометрия всех рамок фиксирована, слой прозрачен для мыши',
  /\.overlay\.menu \.card\.subclass-card\{[^}]*width:320px;height:400px;min-height:400px;max-height:400px;/.test(html) &&
  /\.subclass-card__frame\{[^}]*position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;/.test(html) &&
  /\.subclass-card__content\{[^}]*z-index:2;[^}]*padding:54px 42px 34px;[^}]*gap:6px/.test(html) &&
  html.includes('image-rendering:pixelated;image-rendering:crisp-edges;object-fit:fill'));
ok('длинные описания Мага и Воина уплотнены внутри рамок',
  /\.subclass-card\[data-s="multiplier"\] \.nt,\s*\.overlay\.menu \.subclass-card\[data-s="guardian"\] \.nt,\s*\.overlay\.menu \.subclass-card\[data-s="swordmaster"\] \.nt\{[^}]*font-size:13px;line-height:1\.24/.test(html));
ok('каждый экран класса получает ровно три правильные рамки подклассов',
  Object.entries({bow:['thief','hunter','dancer'],wand:['destroyer','multiplier','elementalist'],
    necro:['graverobber','animator','venomancer'],blade:['berserker','guardian','swordmaster']}).every(([wk,ids])=>{
      const game=loadGame('./PolyGrind.html'); game.subclassScreen(wk);
      const screen=game.document.getElementById('ov').innerHTML;
      return (screen.match(/class="card subclass-card"/g)||[]).length===3 &&
        (screen.match(/class="subclass-card__frame"/g)||[]).length===3 &&
        (screen.match(/class="hero-preview sheet subclass-sprite"/g)||[]).length===3 &&
        !screen.includes('<div class="cat">подкласс</div>') && ids.every(id=>screen.includes('data-s="'+id+'"'));
    }) && html.includes("document.querySelectorAll('#ov .card').forEach(el => el.onclick"));
ok('детальные превью классов и подклассов — ровно 3× до 108 px',
  /\.overlay\.menu \.class-subclass-preview\{[^}]*width:108px;height:108px/.test(html) &&
  /\.subclass-card \.subclass-sprite\{\s*width:108px;height:108px/.test(html) &&
  html.includes('const SUBCLASS_HERO_DRAW_SIZE = 64;') &&
  html.includes('const SUBCLASS_HERO_FRAME_SIZE = 36;') &&
  html.includes('const SUBCLASS_HERO_FRAME_COUNT = 8;') &&
  html.includes('const frameW = subclassActive ? SUBCLASS_HERO_FRAME_SIZE : meta.frameW') &&
  html.includes('-drawW/2, -drawH/2, drawW, drawH') &&
  !/SUBCLASS_HERO_DRAW_SIZE[^;]*p\.r/.test(html));
ok('общий menuTick анимирует модели без отдельных таймеров',
  html.includes("document.querySelectorAll('[data-hero-preview]').forEach") &&
  html.includes("const count=subclass?SUBCLASS_HERO_FRAME_COUNT:4;") &&
  html.includes('const position=(frame*100/(count-1))') && html.includes('drawHeroPreviews(t);') &&
  !/function drawHeroPreviews[\s\S]*?(?:setInterval|setTimeout)/.test(html));
ok('главное меню медленно меняет три неподвижных подкласса без таймеров',
  html.includes("document.querySelectorAll('[data-class-subclass-preview]').forEach") &&
  html.includes('const subclassIndex=still?0:Math.floor(t/4)%3;') &&
  html.includes("const position='0 0';") &&
  !/function drawClassSubclassPreviews[\s\S]*?Math\.floor\(t\*10\)/.test(html) &&
  html.includes('drawClassSubclassPreviews(t);') &&
  !/function drawClassSubclassPreviews[\s\S]*?(?:setInterval|setTimeout)/.test(html));

const logoMatch=html.match(/GRIM_GRIND_LOGO_STRIP\.src = 'data:image\/png;base64,([^']+)'/);
const logoPng=logoMatch && Buffer.from(logoMatch[1],'base64');
const logoHash=logoPng && crypto.createHash('sha256').update(logoPng).digest('hex').toUpperCase();
const torchMatch=html.match(/GRIM_GRIND_TORCH_STRIP\.src = 'data:image\/png;base64,([^']+)'/);
const torchPng=torchMatch && Buffer.from(torchMatch[1],'base64');
const torchHash=torchPng && crypto.createHash('sha256').update(torchPng).digest('hex').toUpperCase();
const constStarMatch=html.match(/CONSTELLATION_STAR_STRIP\.src = 'data:image\/png;base64,([^']+)'/);
const constStarPng=constStarMatch && Buffer.from(constStarMatch[1],'base64');
const constStarHash=constStarPng && crypto.createHash('sha256').update(constStarPng).digest('hex').toUpperCase();
ok('официальное имя Grim Grind стоит в title и доступном имени логотипа',
  html.includes('<title>Grim Grind</title>') && html.includes('aria-label="Grim Grind"') &&
  !html.includes("fillText('PolyGrind'"));
ok('оптимизированный прозрачный лист нового логотипа встроен в HTML',
  !!logoPng && logoPng.length===101980 && logoHash==='16073A42607471FF463693693FFEB70D978F9AFF11F60281EC64C70D40CE665D',
  (logoPng?logoPng.length:0)+' Б · '+(logoHash||'нет'));
ok('лист логотипа сохраняет детали: 4096×144 и восемь кадров 512×144',
  !!logoPng && logoPng.readUInt32BE(16)===4096 && logoPng.readUInt32BE(20)===144 &&
  html.includes("{w:512,h:144,count:8,fps:5}") &&
  optimizer.includes('opaque_colors=63, transparent_index=63, bits=8'));
ok('лист факела сжат до 576×192, прозрачен и встроен один раз',
  !!torchPng && torchPng.length===6469 && torchHash==='F3FF6456E62B5452FE2B56B67258C9F56F0F2F80DC66C681B8558CB9524BDB55' &&
  torchPng.readUInt32BE(16)===576 && torchPng.readUInt32BE(20)===192 &&
  html.includes("{w:72,h:192,count:8,fps:8}"),
  (torchPng?torchPng.length:0)+' Б · '+(torchHash||'нет'));
ok('мерцающая звезда Созвездий встроена как восемь кадров 32×32',
  !!constStarPng && constStarPng.length===1019 && constStarHash==='E2D70F5B42BFE602F7DEE47F34BE6F332D24AE4080C95F6422905D42A9E47B40' &&
  constStarPng.readUInt32BE(16)===256 && constStarPng.readUInt32BE(20)===32,
  (constStarPng?constStarPng.length:0)+' Б · '+(constStarHash||'нет'));
ok('две звезды стоят по сторонам текста Созвездий вместо прежней иконки',
  html.includes('id="conststarl" class="conststar"') &&
  html.includes('</small></span><canvas id="conststarr" class="conststar"></canvas>') &&
  !html.includes('id="constsigil"') && html.includes('.const-entry .conststar{width:32px;height:32px'));
ok('звёзды мерцают в противофазе и собираются штатным конвейером меню',
  html.includes('CONSTELLATION_STAR_FPS = 8') &&
  html.includes('t*CONSTELLATION_STAR_FPS + i*4') &&
  html.includes('constellationStarTick(t);') &&
  html.includes('reducedMenuMotion() ? 2 :') &&
  optimizer.includes('def menu_constellation_star_sheet') &&
  optimizer.includes('"constellationStar": "CONSTELLATION_STAR_STRIP"'));
ok('меню анимирует свет неподвижного логотипа и огонь двух факелов',
  html.includes('Math.floor(tm*GRIM_GRIND_LOGO_FRAME.fps) % GRIM_GRIND_LOGO_FRAME.count') &&
  html.includes('Math.floor(tm*GRIM_GRIND_TORCH_FRAME.fps) % GRIM_GRIND_TORCH_FRAME.count') &&
  html.includes('drawBrandTitle(t);') && html.includes('drawBrandTorches(t);') &&
  html.includes('id="brandtorchl"') && html.includes('id="brandtorchr"') &&
  html.includes('#brandnm{display:block;width:clamp(382px,44.1vw,500px)') &&
  html.includes('.overlay.menu #brandnm{width:min(40.2vw,304px)}') &&
  html.includes('.overlay.menu #brandnm{width:clamp(333px,34.3vw,382px)}') &&
  html.includes('aspect-ratio:32/9') && html.includes('id="brandnm" width="512" height="144"') &&
  html.includes('.brandtorch{display:block;width:clamp(38.4px,4vw,51.2px)') &&
  html.includes('#brandtorchr{transform:scaleX(-1)}') &&
  (html.match(/__brandFrame === frame/g)||[]).length===2 &&
  (html.match(/globalCompositeOperation ?= ?['"]copy['"]/g)||[]).length===2 &&
  optimizer.includes('def stable_logo_frames') && optimizer.includes('def stable_torch_frames') &&
  optimizer.includes('body = master.copy()') && optimizer.includes('compact_stable_sheet'));
ok('системное отключение анимаций оставляет первые кадры вывески',
  html.includes("matchMedia('(prefers-reduced-motion: reduce)').matches") &&
  (html.match(/reducedMenuMotion\(\)\?0:/g)||[]).length>=1 &&
  html.includes('const still=reducedMenuMotion(),frame=0;') &&
  html.includes('const subclassIndex=still?0:Math.floor(t/4)%3;'));

{
  const c=loadGame('./PolyGrind.html'); c.startScreen();
  const menu=c.document.getElementById('ov').innerHTML;
  ok('меню показывает четыре чистые карточки без служебных пояснений',
    (menu.match(/class="card class-card"/g)||[]).length===4 && !menu.includes('wpn.') &&
    !menu.includes('<div class="cat">') && !menu.includes('<div class="vl">') &&
    !menu.includes('choose one of four classes') && !menu.includes('Each level-up offers a choice of') &&
    !menu.includes('flat values add together'));
}
ok('главное меню показывает классовую рамку, статичного подкласса, название и описание',
  /'<img class="class-card-frame" src="' \+ CLASS_FRAME_DATA\[spriteKey\]/.test(html) &&
  html.includes('data-class-subclass-preview="1"') && html.includes('data-class-subclass-label="1"') &&
  /'<div class="nt">' \+ w\.desc \+ '<\/div><\/div>'/.test(html));
ok('главный выбор — четыре рамки в ряд, 2×2 на планшете и столбец на телефоне',
  /\.overlay\.menu \.cards\.class-cards\{[^}]*display:grid;grid-template-columns:repeat\(4,280px\)/.test(html) &&
  /@media\(max-width:1180px\) and \(min-width:761px\)[\s\S]*?grid-template-columns:repeat\(2,245px\)/.test(html) &&
  /@media\(max-width:760px\)[\s\S]*?\.overlay\.menu \.cards\.class-cards\{grid-template-columns:245px/.test(html));
ok('описания классов короткие и не содержат внутренних имён параметров',
  Object.values(loadGame('./PolyGrind.html').__api.WEAPONS).every(w=>w.desc.length<110 && !/wpn\.|min\.\*/.test(w.desc)));

function game(key){
  const c=loadGame('./PolyGrind.html'); c.newGame(key,'keys');
  const G=c.__api.G; G.pending=0; G.spawnQueue=0; G.enemies.length=0;
  return {c,G,p:G.player};
}
for (const key of ['bow','wand','blade']){
  const o=game(key); o.c.attack();
  ok(key+': автоатака не создаёт таймер анимации', o.p.heroAttackT===undefined && o.p.heroAttackDur===undefined);
}
{
  const o=game('bow'); o.G.keys.d=true; o.c.update(0.1);
  ok('движение продвигает плавный восьмикадровый цикл', o.p.moving && o.p.heroWalkT>0 && o.p.heroWalkT<4,
    o.p.heroWalkT.toFixed(2));
}
{
  const o=game('wand');
  ok('восемь кадров сохраняют прежнюю длину полного шага', html.includes('heroMoved/18') &&
    html.includes('Math.floor((p.heroWalkT||0)/2)%4'));
}
{
  const o=game('blade'), e=o.c.spawnEnemy(); e.x=-80; e.y=0; e.spd=0; e.dmg=0; o.c.update(1/60);
  ok('герой зеркалится к цели слева', o.p.spriteFace===-1);
}
{
  const o=game('necro'); o.c.spawnMinion(undefined,undefined,'skeleton');
  ok('Некромант не создаёт таймер анимации призыва', o.p.heroSummonT===undefined && o.p.heroSummonDur===undefined);
  o.c.spawnMinion(undefined,undefined,'skeleton');
  ok('серия призывов не добавляет скрытых таймеров', o.p.heroSummonT===undefined && o.p.heroSummonDur===undefined);
}
ok('новые герои не требуют внешних runtime-assets',
  !/\b(?:src|href)=["'](?:\.\/|assets\/).*\.(?:png|webp|jpg)/i.test(html));
ok('отрицательный RAF-delta не ломает кольцо призыва',
  html.includes('Math.max(0, Math.min(0.05, (now - last)/1000))'));
