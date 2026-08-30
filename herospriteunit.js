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
ok('рендер использует только один ряд ходьбы без действий',
  html.includes("frame*meta.frameW, 0") && !html.includes('heroAttackT') && !html.includes('heroSummonT'));
ok('превью меню берёт общий четырёхкадровый лист без копии PNG',
  html.includes("heroPreviewHTML(spriteKey, 'class-sprite')") &&
  html.includes('data-hero-preview="1"') && html.includes('background-size:400% 100%'));

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
  thief:[1639,'0D41142A3CE95CD0AFD2DED46DF8725E09D7F3F443C5A8EBD843A5B9CB13F8CB'],
  hunter:[1432,'6EC80CEF6FC002A2A7832D690AB4AE682999F2866124E7DFAF387024DEBFB35F'],
  dancer:[1495,'29DFF041FA2CCC593DDDE33FDAB12CB7FCA30168FD5A789AD3338A777E1ECCB3'],
  destroyer:[1531,'2165FB363A659355B1CB69003E1FFADDD5CDBDEBABB03408AC9F3AB28E942BF1'],
  multiplier:[1333,'6C9BF2AE8CD0F7C1E864B0E9289DD265B14599CD44438D61759CE96EE6E8E73A'],
  elementalist:[1660,'57FF07D24A9A6399B439FE5AEDA8A75D656118D832BBD86D3F0172725979F516'],
  graverobber:[1539,'3668CDC935759AAC8EAA179FF34626D6AB39956047BCE65680778C7DA6870D90'],
  animator:[1623,'45EA989633631A621C46DF3BC20E7158FAA5E8D7E84576897A0D30596618AB5E'],
  venomancer:[1615,'D9019BFEF4115A909B93AE222C1F3B4F3C05B04887F16CAA764AD90C698486B7'],
  berserker:[1467,'20F5AC623F299830AD37F8D046B3CA9F491291DE71EE04ECA1D65E29BC95B86E'],
  guardian:[1640,'6D862CDF3B16D9E2BDA9E52E18F0DD1C5F6F187AE15543D212C32A00159D7333'],
  swordmaster:[1374,'14A1F6CBD767E82529BB9048AA1659C42F9ED4CAB08EA4F57C090211FF5957F2'],
};
const subclassSpriteBlock=(html.match(/const SUBCLASS_HERO_SPRITE_DATA = \{(.*?)\n\};/s)||[])[1]||'';
const subclassSprites=Object.fromEntries(
  [...subclassSpriteBlock.matchAll(/^\s*(\w+):'data:image\/png;base64,([^']+)',\s*$/gm)]
    .map(match=>[match[1],Buffer.from(match[2],'base64')])
);
const subclassIds=Object.values(loadGame('./PolyGrind.html').__api.SUBCLASSES).flat().map(s=>s.id);
ok('12 моделей сопоставлены один-к-одному с id каталога SUBCLASSES',
  JSON.stringify(Object.keys(subclassSprites))===JSON.stringify(Object.keys(subclassSpriteExpected)) &&
  Object.keys(subclassSpriteExpected).every(id=>subclassIds.includes(id)) && subclassIds.length===12);
ok('все модели — точные P-mode PNG 128×32, палитра до 16 и прозрачный индекс 0',
  Object.entries(subclassSpriteExpected).every(([id,[bytes,hash]])=>{
    const png=subclassSprites[id], palette=png&&pngChunkData(png,'PLTE'), transparency=png&&pngChunkData(png,'tRNS');
    return !!png && png.length===bytes && png.readUInt32BE(16)===128 && png.readUInt32BE(20)===32 &&
      png[25]===3 && !!palette && palette.length/3<=256 && !!transparency && transparency[0]===0 &&
      crypto.createHash('sha256').update(png).digest('hex').toUpperCase()===hash;
  }), Object.values(subclassSprites).reduce((sum,png)=>sum+png.length,0)+' Б');
ok('оптимизатор валидирует handoff и встраивает листы без ресэмплинга',
  optimizer.includes('SUBCLASS_HERO_SPRITE_SOURCES = {') &&
  optimizer.includes('--install-subclass-hero-sprites') && optimizer.includes('transparency != 0') &&
  optimizer.includes('payload[subclass_name] = base64.b64encode(data)') &&
  !optimizer.includes('subclass_hero_sprite_sheet'));
ok('runtime загружает 12 моделей один раз и сохраняет базовый fallback',
  html.includes('const SUBCLASS_HERO_SPRITES = {};') &&
  html.includes('for (const key of Object.keys(SUBCLASS_HERO_SPRITE_DATA))') &&
  html.includes('heroSpriteFor(spriteKey, G.subclass)') &&
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
ok('рамка — прозрачный некликабельный overlay над каждой карточкой',
  html.includes('CLASS_FRAME_DATA[spriteKey]') &&
  html.includes('class="class-card-frame"') && html.includes('alt="" aria-hidden="true"') &&
  /\.class-card-frame\{[^}]*position:absolute;[^}]*inset:0;[^}]*z-index:2;[^}]*pointer-events:none;/.test(html) &&
  /\.overlay\.menu \.card\.class-card\{[^}]*overflow:visible;[^}]*border-color:transparent;[^}]*isolation:isolate;[^}]*padding:48px 40px 40px/.test(html) &&
  /\.overlay\.menu \.class-card>\.nt\{[^}]*z-index:3/.test(html) &&
  /image-rendering:pixelated;image-rendering:crisp-edges/.test(html));

const subclassFrameBlock=(html.match(/const SUBCLASS_FRAME_DATA = \{(.*?)\n\};/s)||[])[1]||'';
const subclassFrames=Object.fromEntries(
  [...subclassFrameBlock.matchAll(/^\s*(\w+):'data:image\/png;base64,([^']+)',\s*$/gm)]
    .map(match=>[match[1],Buffer.from(match[2],'base64')])
);
ok('12 рамок подклассов — индексированные PNG до 128 цветов и 170 КБ',
  Object.keys(subclassFrames).length===12 &&
  Object.values(subclassFrames).every(png=>indexedFrameOk(png,270,304)) &&
  Object.values(subclassFrames).reduce((sum,png)=>sum+png.length,0)<170000 &&
  optimizer.includes('SUBCLASS_FRAME_SOURCES = {') && optimizer.includes('--install-subclass-frames'),
  Object.values(subclassFrames).reduce((sum,png)=>sum+png.length,0)+' Б');
ok('геометрия всех рамок фиксирована, слой прозрачен для мыши',
  /\.overlay\.menu \.card\.subclass-card\{[^}]*width:270px;height:304px;min-height:304px;max-height:304px;/.test(html) &&
  /\.subclass-card__frame\{[^}]*position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;/.test(html) &&
  /\.subclass-card__content\{[^}]*z-index:2;[^}]*padding:46px 34px 32px/.test(html) &&
  html.includes('image-rendering:pixelated;image-rendering:crisp-edges;object-fit:fill'));
ok('длинные описания Мага и Воина уплотнены внутри рамок',
  /\.subclass-card\[data-s="multiplier"\] \.nt,\s*\.overlay\.menu \.subclass-card\[data-s="guardian"\] \.nt,\s*\.overlay\.menu \.subclass-card\[data-s="swordmaster"\] \.nt\{[^}]*font-size:12\.4px;line-height:1\.18/.test(html));
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
ok('превью остаются 48×48, а подкласс в бою рисуется 64×64 без смены p.r',
  /\.class-card \.class-sprite\{position:relative;width:48px;height:48px/.test(html) &&
  /\.subclass-card \.subclass-sprite\{\s*width:48px;height:48px/.test(html) &&
  !/\.class-card \.class-sprite\{[^}]*width:(?:120|140|150)px/.test(html) &&
  html.includes('const SUBCLASS_HERO_DRAW_SIZE = 64;') &&
  html.includes('sprite === subclassSprite ? SUBCLASS_HERO_DRAW_SIZE : meta.drawW') &&
  html.includes('-drawW/2, -drawH/2, drawW, drawH') &&
  !/SUBCLASS_HERO_DRAW_SIZE[^;]*p\.r/.test(html));
ok('общий menuTick анимирует модели без отдельных таймеров',
  html.includes("document.querySelectorAll('[data-hero-preview]').forEach") &&
  html.includes('const position = (frame * 100 / 3)') && html.includes('drawHeroPreviews(t);') &&
  !/function drawHeroPreviews[\s\S]*?(?:setInterval|setTimeout)/.test(html));

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
  (html.match(/const frame = reducedMenuMotion\(\) \? 0 :/g)||[]).length===3);

{
  const c=loadGame('./PolyGrind.html'); c.startScreen();
  const menu=c.document.getElementById('ov').innerHTML;
  ok('меню показывает четыре чистые карточки без служебных пояснений',
    (menu.match(/class="card class-card"/g)||[]).length===4 && !menu.includes('wpn.') &&
    !menu.includes('<div class="cat">') && !menu.includes('<div class="vl">') &&
    !menu.includes('choose one of four classes') && !menu.includes('Each level-up offers a choice of') &&
    !menu.includes('flat values add together'));
}
ok('в карточке сначала название, затем модель игрового размера и описание',
  /'<div class="nm">' \+ w\.nm \+ '<\/div>' \+\s*heroPreviewHTML\(spriteKey, 'class-sprite'\) \+\s*'<div class="nt">' \+ w\.desc \+ '<\/div>'/.test(html));
ok('название, модель и описание героя центрируются стилями витрины',
  /\.card\.class-card\{[^}]*align-items:center;[^}]*text-align:center/.test(html) &&
  /\.class-card \.class-sprite\{position:relative;width:48px;height:48px/.test(html));
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
  ok('движение продвигает замедленный четырёхкадровый цикл', o.p.moving && o.p.heroWalkT>0 && o.p.heroWalkT<2,
    o.p.heroWalkT.toFixed(2));
}
{
  const o=game('wand');
  ok('скорость ходьбы уменьшена вдвое до 36 единиц на кадр', html.includes('heroMoved/36'));
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
