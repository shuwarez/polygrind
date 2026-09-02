/* ---------- 9. ОТРИСОВКА ---------- */
function drawPoly(x, y, r, sides, rot){
  ctx.beginPath();
  for (let i = 0; i < sides; i++){
    const a = rot + i*Math.PI*2/sides;
    const px = x + Math.cos(a)*r, py = y + Math.sin(a)*r;
    i ? ctx.lineTo(px,py) : ctx.moveTo(px,py);
  }
  ctx.closePath();
}
function drawShape(sh, x, y, r, rot){
  if (sh === 'circle'){ ctx.beginPath(); ctx.arc(x,y,r,0,6.29); }
  else if (sh === 'triangle') drawPoly(x,y,r,3,rot);
  else if (sh === 'square')   drawPoly(x,y,r,4,rot+0.785);
  else if (sh === 'diamond')  drawPoly(x,y,r,4,rot);
  else drawPoly(x,y,r,6,rot);
}
function drawDemonicBlobSprite(x,y,progress,size,alpha=1){
  if (!DEMON_QUEEN_BLOB || !DEMON_QUEEN_BLOB.complete || !DEMON_QUEEN_BLOB.naturalWidth) return false;
  const frame=DEMON_QUEEN_BLOB_FRAMES[Math.min(3,Math.floor(clamp(progress,0,0.999999)*4))];
  ctx.save();ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.clip();
  ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
  ctx.drawImage(DEMON_QUEEN_BLOB,frame.x,frame.y,frame.w,frame.h,x-size/2,y-size/2,size,size);
  ctx.restore(); return true;
}
/* Художественный эффект никогда не задаёт область удара сам. Его кадр рисуется
   только внутри telegraphPath(spec) — той же геометрии, которую проверяет
   boss20ShapeHits(). Длинные кадры либо повторяются без потери масштаба, либо
   растягиваются вдоль оси, но в обоих случаях Canvas clip не выпускает ни
   одного пикселя за механическую границу. */
const BOSS_EFFECT_RENDER_META=Object.freeze({
  crimson_flesh_seam:{corridor:'tile'},empty_mask_beam:{corridor:'stretch'},
  judge_chain_hook:{corridor:'stretch'},raven_swarm:{corridor:'tile',cone:'horizontal'},
  sand_ground_strip:{corridor:'tile'},mnema_shadow_pierce:{corridor:'stretch'},
  vampire_cross:{corridor:'cross'}
});
function drawBossEffectSpriteInSpec(image,meta,key,spec,index,alpha=1,options=null){
  if (!spec || !image || !image.complete || !image.naturalWidth) return false;
  const opt=options||{},renderMeta=BOSS_EFFECT_RENDER_META[key]||{};
  ctx.save();telegraphPath(spec);ctx.clip('evenodd');ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
  if (opt.filter) ctx.filter=opt.filter;
  if (spec.shape==='corridor'){
    const dx=spec.x2-spec.x,dy=spec.y2-spec.y,len=Math.hypot(dx,dy)||1,width=spec.width||46;
    if (renderMeta.corridor==='cross'){
      const size=opt.size||Math.max(len,width);
      ctx.drawImage(image,index*meta.frameW,0,meta.frameW,meta.frameH,
        (opt.x||0)-size/2,(opt.y||0)-size/2,size,size);
    } else {
      ctx.translate(spec.x,spec.y);ctx.rotate(Math.atan2(dy,dx));
      if (renderMeta.corridor==='stretch'){
        ctx.drawImage(image,index*meta.frameW,0,meta.frameW,meta.frameH,0,-width,len,width*2);
      } else {
        const tile=Math.max(48,Math.min(112,width*1.8)),step=tile*.72;
        for(let x=-tile*.15;x<len+tile*.15;x+=step)
          ctx.drawImage(image,index*meta.frameW,0,meta.frameW,meta.frameH,x,-tile/2,tile,tile);
      }
    }
  } else if (spec.shape==='cone'){
    const arc=spec.arc||Math.PI/2,halfW=Math.max(1,spec.r*Math.sin(arc/2));
    ctx.translate(spec.x,spec.y);
    if(renderMeta.cone==='horizontal'){
      ctx.rotate(spec.a||0);
      ctx.drawImage(image,index*meta.frameW,0,meta.frameW,meta.frameH,0,-halfW,spec.r,halfW*2);
    } else {
      ctx.rotate((spec.a||0)-Math.PI/2);
      ctx.drawImage(image,index*meta.frameW,0,meta.frameW,meta.frameH,-halfW,0,halfW*2,spec.r);
    }
  } else {
    const half=spec.shape==='ring'||spec.shape==='arc'?(spec.width||36)/2:0;
    const diameter=Math.max(2,(spec.r+half)*2);
    ctx.translate(spec.x,spec.y);ctx.rotate(opt.a||0);
    ctx.drawImage(image,index*meta.frameW,0,meta.frameW,meta.frameH,-diameter/2,-diameter/2,diameter,diameter);
  }
  ctx.restore();return true;
}
function drawBossEffectSprite(image,meta,key,f,progress,alpha){
  const index=Math.min(meta.frames-1,Math.floor(clamp(progress,0,.999999)*meta.frames));
  const specs=f.specs||(f.spec?[f.spec]:null);
  if (specs){let drawn=false;for(const spec of specs)drawn=drawBossEffectSpriteInSpec(image,meta,key,spec,index,alpha,f)||drawn;return drawn;}
  const size=f.size||160;
  ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.a||0);ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
  if (f.filter) ctx.filter=f.filter;
  ctx.drawImage(image,index*meta.frameW,0,meta.frameW,meta.frameH,-size/2,-size/2,size,size);
  ctx.restore();return true;
}
function drawLegacyBossEffect(f){
  const meta=f&&LEGACY_BOSS_EFFECT_SPRITE_META[f.key],image=meta&&LEGACY_BOSS_EFFECT_SPRITES[f.key];
  if (!meta || !image || !image.complete || !image.naturalWidth) return false;
  const progress=clamp(1-f.life/Math.max(.001,f.max||f.life),0,.999999);
  const alpha=clamp(Math.min(progress*5,f.life*5),0,1)*(f.alpha===undefined?1:f.alpha);
  return drawBossEffectSprite(image,meta,f.key,f,progress,alpha);
}
function drawBoss20EffectFrame(key,x,y,sizeX,sizeY,a,progress,alpha=1){
  const meta=BOSS20_EFFECT_SPRITE_META[key],image=meta&&BOSS20_EFFECT_SPRITES[key];
  if (!meta || !image || !image.complete || !image.naturalWidth) return false;
  const index=Math.min(meta.frames-1,Math.floor(clamp(progress,0,.999999)*meta.frames));
  ctx.save();ctx.translate(x,y);ctx.rotate(a||0);ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,index*meta.frameW,0,meta.frameW,meta.frameH,
    -(sizeX||96)/2,-(sizeY||sizeX||96)/2,sizeX||96,sizeY||sizeX||96);
  ctx.restore();return true;
}
function drawBoss20EffectInSpec(key,spec,progress,alpha=1,options=null){
  const meta=BOSS20_EFFECT_SPRITE_META[key],image=meta&&BOSS20_EFFECT_SPRITES[key];
  if (!meta || !image || !image.complete || !image.naturalWidth || !spec) return false;
  const index=Math.min(meta.frames-1,Math.floor(clamp(progress,0,.999999)*meta.frames));
  return drawBossEffectSpriteInSpec(image,meta,key,spec,index,alpha,options);
}
function drawBoss20ProjectileEffect(s){
  if (!s || !s.effectKey) return false;
  const diameter=Math.max(2,(s.r||8)*2),height=s.effectKey==='ashen_comet'?diameter*.72:diameter;
  ctx.save();ctx.beginPath();ctx.arc(0,0,s.r||8,0,Math.PI*2);ctx.clip();
  const drawn=drawBoss20EffectFrame(s.effectKey,0,0,diameter,height,Math.atan2(s.vy,s.vx),(G.time*10%4)/4,1);
  ctx.restore();return drawn;
}
function drawBoss20SpriteEffect(f){
  if (!f) return false;
  const meta=BOSS20_EFFECT_SPRITE_META[f.key],image=meta&&BOSS20_EFFECT_SPRITES[f.key];
  if (!meta || !image || !image.complete || !image.naturalWidth) return false;
  const progress=clamp(1-f.life/Math.max(.001,f.max||f.life),0,.999999);
  const alpha=clamp(Math.min(progress*6,f.life*6),0,1)*(f.alpha===undefined?1:f.alpha);
  if (f.spec || f.specs) return drawBossEffectSprite(image,meta,f.key,f,progress,alpha);
  return drawBoss20EffectFrame(f.key,f.x,f.y,f.sizeX||f.size||160,f.sizeY||f.size||160,f.a||0,progress,alpha);
}
function drawFloorPortalSprite(portal,view=null){
  const frame=floorPortalSpriteFrame(portal), meta=frame.meta;
  const sprite=frame.sheet==='appear'?FLOOR_PORTAL_APPEAR_SPRITE:FLOOR_PORTAL_SPRITE;
  if (!portal || !sprite || !sprite.complete || !sprite.naturalWidth) return false;
  if (view && !renderCircleVisible(portal.x,portal.y,meta.drawW*0.72,view)) return false;
  // Оба листа имеют одну baseline и один полный кадр 128×128. Рост уже запечён
  // в appearance-лист, а у loop-листа неподвижны камень, кости и шипы.
  const baselineY=portal.y+meta.drawH/2;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.drawImage(sprite,frame.x,frame.y,frame.w,frame.h,
                portal.x-meta.drawW*meta.anchorX,baselineY-meta.drawH*meta.anchorY,
                meta.drawW,meta.drawH);
  ctx.restore(); return true;
}
function safeCanvasRadius(value){ return Number.isFinite(value)?Math.max(0,value):0; }
function drawFloorPortalEnergy(portal,view=null){
  if (!portal) return 0;
  const meta=FLOOR_PORTAL_SPRITE_META,radius=meta.drawW*0.92;
  if (view && !renderCircleVisible(portal.x,portal.y,radius+18,view)) return 0;
  const portalTime=Number.isFinite(portal.t)?Math.max(0,portal.t):0;
  const open=clamp(portalTime/meta.appearDuration,0,1);
  const time=Number.isFinite(G.time)?G.time:portalTime,smokeN=18,emberN=30;
  ctx.save();
  try {
  // Кровь лежит на земле отдельным слоем и выходит за границы самого спрайта.
  ctx.globalCompositeOperation='source-over';
  const pools=[[-52,54,38],[-22,61,46],[18,60,52],[52,55,34],[0,66,58]];
  for (let i=0;i<pools.length;i++){
    const [ox,oy,r]=pools[i];
    ctx.globalAlpha=open*(.17+(i%2)*.05);ctx.fillStyle=i%2?'#5c070b':'#280206';
    ctx.beginPath();ctx.arc(portal.x+ox,portal.y+oy,safeCanvasRadius(r*open),0,Math.PI*2);ctx.fill();
  }
  const streams=[[-8,49,-71,76],[7,50,79,74],[-2,53,-18,89]];
  ctx.lineCap='round';
  for (let i=0;i<streams.length;i++){
    const s=streams[i],flow=(time*.42+i*.31)%1;
    ctx.globalAlpha=open*.72;ctx.strokeStyle='#430207';ctx.lineWidth=6-i;
    ctx.beginPath();ctx.moveTo(portal.x+s[0],portal.y+s[1]);
    ctx.lineTo(portal.x+s[2],portal.y+s[3]);ctx.stroke();
    const x=portal.x+s[0]+(s[2]-s[0])*flow,y=portal.y+s[1]+(s[3]-s[1])*flow;
    ctx.globalAlpha=open*.84;ctx.fillStyle='#b31616';
    ctx.beginPath();ctx.arc(x,y,2.1,0,Math.PI*2);ctx.fill();
  }
  // Дым поднимается вертикально, угли вылетают вверх: никаких волшебных орбит.
  for (let i=0;i<smokeN;i++){
    const seed=((i*67)%97)/97,travel=(time*(.11+(i%4)*.018)+seed)%1;
    const x=portal.x+(seed-.5)*54+Math.sin(time*.7+i*2.4)*7;
    const y=portal.y+38-travel*112,size=6+(i%5)*3+travel*7;
    ctx.globalAlpha=open*(.08+(1-travel)*.12);ctx.fillStyle=i%3?'#160508':'#35080a';
    ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
  }
  ctx.globalCompositeOperation='lighter';
  for (let i=0;i<emberN;i++){
    const seed=((i*73)%101)/101,travel=(time*(.31+(i%5)*.025)+seed)%1;
    const x=portal.x+(seed-.5)*48+Math.sin(time*2+i)*5;
    const y=portal.y+46-travel*104,size=1+(i%3);
    ctx.globalAlpha=open*(1-travel)*(.28+(i%4)*.08);
    ctx.fillStyle=i%4===0?'#ff8a22':'#b71912';ctx.fillRect(Math.round(x),Math.round(y),size,size);
  }
  return smokeN+emberN;
  } catch(error){
    diagFrameError(error,'floor_portal_energy'); return 0;
  } finally { ctx.restore(); }
}
function drawFloorPortalIndicator(portal,player){
  if (!portal || !player) return false;
  const dx=portal.x-player.x,dy=portal.y-player.y,distance=Math.hypot(dx,dy);
  if (distance<70) return false;
  const angle=Math.atan2(dy,dx),offset=player.r+42;
  const x=player.x+Math.cos(angle)*offset,y=player.y+Math.sin(angle)*offset;
  const open=clamp(portal.t/0.35,0,1),pulse=1+Math.sin((G.time||portal.t)*5)*0.09;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(pulse,pulse);ctx.globalAlpha=open;
  ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(20,2,4,.88)';
  ctx.strokeStyle='#711016';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.globalCompositeOperation='lighter';ctx.shadowColor='#8d1116';ctx.shadowBlur=14;
  ctx.fillStyle='#b51b18';ctx.strokeStyle='#3c0508';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(-8,-9);ctx.lineTo(-3,0);ctx.lineTo(-8,9);ctx.closePath();
  ctx.fill();ctx.stroke();ctx.restore();return true;
}
function groundPoolSpriteReady(key){
  const sprite=GROUND_POOL_SPRITES[key];
  return !!(sprite && sprite.complete && sprite.naturalWidth);
}
function drawGroundPoolSprite(key,o,maxLife,opacity=1){
  const f=groundPoolSpriteFrame(key), sprite=f && GROUND_POOL_SPRITES[key];
  if (!o || !f || !groundPoolSpriteReady(key)) return false;
  const elapsed=Math.max(0,maxLife-o.life);
  const fade=clamp(Math.min(elapsed/0.10,o.life/0.28),0,1);
  const diameter=o.r*2;
  ctx.save();ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.clip();
  ctx.globalAlpha=opacity*fade; ctx.imageSmoothingEnabled=false;
  ctx.drawImage(sprite,f.x,f.y,f.w,f.h,
                o.x-diameter/2,o.y-diameter/2,diameter,diameter);
  ctx.restore(); return true;
}
function drawLootSprite(o){
  const f=lootSpriteFrame(o), sprite=f && LOOT_SPRITES[f.key];
  if (!f || !sprite || !sprite.complete || !sprite.naturalWidth) return false;
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.drawImage(sprite,f.x,f.y,f.w,f.h,
                o.x-f.meta.drawW/2,o.y-f.meta.drawH/2,f.meta.drawW,f.meta.drawH);
  ctx.restore(); return true;
}
function drawRareItemSprite(o){
  const sprite=o && o.amu && RARE_ITEM_FLOOR_SPRITES[o.amu];
  if (!sprite || !sprite.complete || !sprite.naturalWidth) return false;
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.drawImage(sprite,o.x-12,o.y-12,24,24);
  ctx.restore(); return true;
}
function drawBookFloorSprite(o){
  const sprite=o && o.book && BOOK_FLOOR_SPRITES[o.book];
  if (!sprite || !sprite.complete || !sprite.naturalWidth) return false;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.drawImage(sprite,o.x-12,o.y-12,24,24);
  ctx.restore();return true;
}
function drawTotemSprite(o){
  if (!o || !o.totem) return false;
  // На земле показываем ранг, который предмет выдаст после подъёма.
  const tier=Math.min(4,totemTier(o.totem)+1), entry=totemSpriteEntry(o.totem,tier), sprite=entry.sprite;
  if (!sprite || !sprite.complete || !sprite.naturalWidth) return false;
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.drawImage(sprite,o.x-64,o.y-64,128,128);
  ctx.restore(); return true;
}

function enemySpriteReady(e){
  if (e.bossId==='demonqueen' && e.bossT && e.bossT.hidden && !bossAttackVisual(e)) return true;
  const sf=enemySpriteFrame(e), sprite=sf && enemySpriteImage(e);
  return !!(sf && sprite && sprite.complete && sprite.naturalWidth);
}
function drawEnemySprite(e){
  if (e.bossId === 'demonqueen' && e.bossT && e.bossT.hidden && !bossAttackVisual(e)) return true;
  const sf=enemySpriteFrame(e), sprite=sf && enemySpriteImage(e);
  if (!sf || !sprite || !sprite.complete || !sprite.naturalWidth) return false;
  const f=sf.frame, k=e.r*sf.meta.scale/f.h;
  ctx.save(); ctx.translate(e.x,e.y); ctx.scale(e.spriteFace < 0 ? -1 : 1,1);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(sprite,f.x,f.y,f.w,f.h,-f.ax*k,-f.ay*k,f.w*k,f.h*k);
  if (e.hit > 0){
    ctx.globalAlpha=0.82*clamp(e.hit/0.12,0,1);
    ctx.filter='brightness(0) saturate(100%) invert(100%)';
    ctx.drawImage(sprite,f.x,f.y,f.w,f.h,-f.ax*k,-f.ay*k,f.w*k,f.h*k);
  }
  ctx.restore(); return true;
}
function drawEnemyProjectileSprite(s, frameIndex){
  let sprite=null, f=null;
  if (s.shotType === 'slime'){
    sprite=PLAGUE_SLIME_PROJECTILE; f=PLAGUE_SLIME_PROJECTILE_FRAMES[frameIndex];
  } else if (s.shotType === 'lich'){
    sprite=EMERALD_ORB_PROJECTILE; f=EMERALD_ORB_PROJECTILE_FRAMES[frameIndex];
  } else if (s.shotType === 'spear'){
    sprite=GREED_SPEAR_PROJECTILE; f=GREED_SPEAR_PROJECTILE_FRAMES[frameIndex];
  } else if (s.shotType === 'axe'){
    sprite=EXECUTIONER_AXE_PROJECTILE; f=enemyProjectileSpriteFrame(s);
  } else if (s.shotType === 'minotaurSpear'){
    sprite=MINOTAUR_SPEAR_PROJECTILE; f=MINOTAUR_SPEAR_PROJECTILE_FRAMES[frameIndex];
  } else if (s.shotType === 'shooter'){
    sprite=SHOOTER_PROJECTILE; f=SHOOTER_PROJECTILE_FRAMES[frameIndex];
  }
  if (!sprite || !sprite.complete || !sprite.naturalWidth || !f) return false;
  ctx.save();ctx.beginPath();ctx.arc(0,0,s.r,0,Math.PI*2);ctx.clip();ctx.imageSmoothingEnabled=false;
  let drawW=f.drawW || f.draw, drawH=f.drawH || f.draw;
  if (s.sourceKind==='boss'){
    const fit=Math.min(1,(s.r*2)/Math.max(drawW,drawH));drawW*=fit;drawH*=fit;
  }
  if (s.shotType === 'spear' || s.shotType === 'minotaurSpear') ctx.rotate(Math.atan2(s.vy,s.vx));
  ctx.drawImage(sprite,f.x,f.y,f.w,f.h,-drawW/2,-drawH/2,drawW,drawH);
  ctx.restore();
  return true;
}
function drawPlayerProjectileSprite(s, mageFrameIndex){
  const sprite=PLAYER_PROJECTILES[s.spriteType];
  if (!sprite || !sprite.complete || !sprite.naturalWidth) return false;
  const f=s.spriteType === 'mage' ? PLAYER_MAGE_FRAMES[mageFrameIndex] : PLAYER_ARROW_FRAME;
  ctx.imageSmoothingEnabled=false;
  if (s.spriteType === 'mage'){
    const size=s.r*2;
    ctx.save();
    if (remoteOrbActive(s)) ctx.filter='hue-rotate(65deg) saturate(1.45) brightness(1.08)';
    ctx.drawImage(sprite,f.x,f.y,f.w,f.h,s.x-size/2,s.y-size/2,size,size);
    ctx.restore();
  } else {
    const scale=s.r/5, width=12*scale, height=6*scale;
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.a);
    if (s.mirrorGhost){ ctx.globalAlpha=0.58; ctx.filter='hue-rotate(205deg) saturate(1.6) brightness(1.45)'; }
    ctx.drawImage(sprite,0,0,12,6,-width/2,-height/2,width,height);
    ctx.restore();
  }
  return true;
}
function enemyVisualTop(e){
  const sf=enemySpriteFrame(e);
  return sf ? sf.frame.ay * (e.r*sf.meta.scale/sf.frame.h) : e.r;
}
function enemyStatusIcons(e){
  const dots=e.dots||{}, fire=dots.fire||{}, poison=dots.poison||{}, bleed=dots.bleed||{};
  const ail=e.ail||{}, result=[];
  const add=(key,active,stacks=0) => {
    if (active) result.push({key,frame:ENEMY_STATUS_ICON_FRAMES[key],stacks:Math.max(0,Math.round(stacks||0))});
  };
  add('burning', fire.dps>0 || fire.n>=0.5, fire.n);
  add('poison', poison.dps>0 || poison.n>=0.5, poison.n);
  add('plague', !!e.plague);
  add('chilled', ail.chill>0 || !!e.frost);
  add('frozen', ail.freeze>0);
  add('shocked', ail.shock>0);
  add('bleeding', bleed.dps>0 || bleed.n>=0.5, bleed.n);
  return result;
}
function drawEnemyStatusIcons(e){
  const icons=enemyStatusIcons(e);
  if (!icons.length || !ENEMY_STATUS_ICONS || !ENEMY_STATUS_ICONS.complete || !ENEMY_STATUS_ICONS.naturalWidth) return;
  const size=12,gap=13,top=e.y-enemyVisualTop(e)-27;
  ctx.save(); ctx.imageSmoothingEnabled=false;
  icons.forEach((status,index) => {
    const x=e.x+(index-(icons.length-1)/2)*gap, f=status.frame;
    ctx.drawImage(ENEMY_STATUS_ICONS,f.x,f.y,f.w,f.h,x-size/2,top,size,size);
    if (status.stacks>1){
      const label=String(status.stacks);
      ctx.font='bold 8px ui-monospace,monospace'; ctx.textAlign='right';
      ctx.lineWidth=2; ctx.strokeStyle='#05070ddd'; ctx.strokeText(label,x+7,top+8);
      ctx.fillStyle='#ffffff'; ctx.fillText(label,x+7,top+8);
    }
  });
  ctx.restore();
}
function enemyTargetMarkerKind(e){ return enemySpriteFrame(e) ? 'chevron' : 'arcs'; }
function drawEnemyTargetMarker(e){
  ctx.strokeStyle='#ffb340cc'; ctx.lineWidth=2;
  if (enemyTargetMarkerKind(e) === 'chevron'){
    const y=e.y-e.r-13;
    ctx.beginPath();
    ctx.moveTo(e.x-7,y-4); ctx.lineTo(e.x,y+2); ctx.lineTo(e.x+7,y-4);
    ctx.moveTo(e.x-5,y-9); ctx.lineTo(e.x,y-5); ctx.lineTo(e.x+5,y-9);
    ctx.stroke(); return;
  }
  const rr=e.r+7;
  for (let q=0;q<4;q++){
    const a0=q*Math.PI/2+0.35;
    ctx.beginPath(); ctx.arc(e.x,e.y,rr,a0,a0+0.55); ctx.stroke();
  }
}
function drawHunterMark(e){
  if (!hunterMarkActive(e)) return false;
  const pulse=0.82+0.18*Math.sin(G.time*8),r=9;
  ctx.save();ctx.globalAlpha=pulse;ctx.strokeStyle='#ff3b4f';ctx.fillStyle='#ff3b4f';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(e.x,e.y,r,0,6.29);ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(e.x-r-5,e.y);ctx.lineTo(e.x-r+1,e.y);
  ctx.moveTo(e.x+r-1,e.y);ctx.lineTo(e.x+r+5,e.y);
  ctx.moveTo(e.x,e.y-r-5);ctx.lineTo(e.x,e.y-r+1);
  ctx.moveTo(e.x,e.y+r-1);ctx.lineTo(e.x,e.y+r+5);ctx.stroke();
  ctx.fillRect(e.x-1,e.y-1,2,2);ctx.restore();return true;
}

/* Герой смотрит вправо в локальных координатах, затем весь силуэт поворачивается
   к текущей цели. Хитбокс остаётся кругом p.r: выразительность не должна менять
   дистанцию, с которой враг достаёт класс. */
function drawHero(p){
  const w = G.weapon, outline = p.inv > 0 ? '#ffffff' :
    w.id === 'wpn.wand' ? '#c08cff' : w.id === 'wpn.scythe' ? '#8be04e' : '#ffb340';
  const spriteKey = w.id === 'wpn.bow' ? 'archer' : w.id === 'wpn.wand' ? 'mage' :
                    w.id === 'wpn.scythe' ? 'necromancer' : w.id === 'wpn.sword' ? 'warrior' : null;
  const sprite = spriteKey && heroSpriteFor(spriteKey, G.subclass);
  if (sprite && sprite.complete && sprite.naturalWidth){
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.spriteFace < 0 ? -1 : 1, 1);
    ctx.imageSmoothingEnabled = false;
    const meta = HERO_SPRITE_META[spriteKey];
    if (meta){
      const subclassSprite = G.subclass && SUBCLASS_HERO_SPRITES[G.subclass];
      const subclassActive = sprite === subclassSprite;
      const frame = p.moving ? (subclassActive ? Math.floor(p.heroWalkT||0)%SUBCLASS_HERO_FRAME_COUNT :
        Math.floor((p.heroWalkT||0)/2)%4) : 0;
      const frameW = subclassActive ? SUBCLASS_HERO_FRAME_SIZE : meta.frameW;
      const frameH = subclassActive ? SUBCLASS_HERO_FRAME_SIZE : meta.frameH;
      const drawW = subclassActive ? SUBCLASS_HERO_DRAW_SIZE : meta.drawW;
      const drawH = subclassActive ? SUBCLASS_HERO_DRAW_SIZE : meta.drawH;
      ctx.drawImage(sprite, frame*frameW, 0, frameW, frameH,
        -drawW/2, -drawH/2, drawW, drawH);
      if (p.hitFlash > 0){
        ctx.globalAlpha=0.82; ctx.filter='brightness(0) saturate(100%) invert(20%) sepia(99%) saturate(6500%) hue-rotate(348deg) brightness(120%) contrast(120%)';
        ctx.drawImage(sprite, frame*frameW, 0, frameW, frameH,
          -drawW/2, -drawH/2, drawW, drawH);
      }
    } else ctx.drawImage(sprite, -24, -24, 48, 48);
    ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.aim);
  ctx.lineWidth = 2.5; ctx.strokeStyle = outline;

  if (w.id === 'wpn.bow'){
    // Лучник: колчан сзади, короткий плащ и настоящий лук впереди силуэта.
    ctx.fillStyle = '#704326'; ctx.fillRect(-12,-8,5,15); ctx.strokeRect(-12,-8,5,15);
    ctx.fillStyle = '#ffb34033'; ctx.beginPath();
    ctx.moveTo(-8,10); ctx.lineTo(-7,-6); ctx.lineTo(2,-11); ctx.lineTo(9,5); ctx.lineTo(4,11); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe4b0'; ctx.beginPath(); ctx.arc(3,-7,4,0,6.29); ctx.fill();
    ctx.strokeStyle = '#ffe4b0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(8,-13); ctx.quadraticCurveTo(20,0,8,13); ctx.moveTo(8,-13); ctx.lineTo(8,13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3,0); ctx.lineTo(20,0); ctx.lineTo(16,-3); ctx.moveTo(20,0); ctx.lineTo(16,3); ctx.stroke();
  } else if (w.id === 'wpn.wand'){
    // Маг: широкая мантия, посох и кристалл впереди — силуэт читается даже в толпе.
    ctx.fillStyle = '#c08cff33'; ctx.beginPath();
    ctx.moveTo(-10,11); ctx.lineTo(-5,-6); ctx.lineTo(4,-11); ctx.lineTo(10,11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#241534'; ctx.beginPath(); ctx.arc(1,-7,5,0,6.29); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#a876d8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-5,12); ctx.lineTo(8,-14); ctx.stroke();
    ctx.fillStyle = '#e4c5ff'; ctx.beginPath(); ctx.arc(9,-16,4,0,6.29); ctx.fill();
    ctx.strokeStyle = '#e4c5ff88'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(9,-16,8,0,6.29); ctx.stroke();
  } else if (w.id === 'wpn.scythe'){
    // Некромант: капюшон, рваная мантия и коса; зелёный круг отличает его от свиты.
    ctx.strokeStyle = '#8be04e44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0,0,p.r+6,0,6.29); ctx.stroke();
    ctx.strokeStyle = outline; ctx.lineWidth = 2.5; ctx.fillStyle = '#18301d'; ctx.beginPath();
    ctx.moveTo(-11,11); ctx.lineTo(-6,-5); ctx.lineTo(1,-12); ctx.lineTo(9,11); ctx.lineTo(3,8); ctx.lineTo(-2,12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0b1410'; ctx.beginPath(); ctx.arc(0,-7,5,0,6.29); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#9aa7b4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8,13); ctx.lineTo(13,-15); ctx.stroke();
    ctx.strokeStyle = '#d8f7c5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(14,-10,9,1.9,4.55); ctx.stroke();
  } else {
    // Запасной силуэт Воина используется только если внешний PNG не загрузился.
    ctx.fillStyle = '#ffb34033'; ctx.lineWidth = 3; drawPoly(0,0,p.r,4,0.785); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(p.r+11,0); ctx.stroke();
  }
  ctx.restore();
}

/* Компактный мировой HP-бар остаётся привязан к ногам героя. Белая подложка
   повторяет короткий «хвост» верхнего HUD, поэтому потерю здоровья видно даже
   в толпе, не переводя взгляд к краю экрана. */
function drawPlayerHealthBar(p){
  const w=34,h=4,x=Math.round(p.x-w/2),y=Math.round(p.y+28);
  const hp=clamp(p.hp/D.life,0,1), lag=Math.max(hp,clamp(p.hpLag||0,0,1));
  const barrier=clamp(totalPlayerBarrier(p)/D.life,0,1);
  ctx.fillStyle='#05070ddd'; ctx.fillRect(x-2,y-2,w+4,h+4);
  ctx.fillStyle='#ffffffaa'; ctx.fillRect(x,y,w*lag,h);
  ctx.fillStyle=p.hpFlash>0?'#ff1938':'#e0405a'; ctx.fillRect(x,y,w*hp,h);
  // Голубая двухпиксельная полоса имеет ту же шкалу max HP и не закрывает
  // красное здоровье целиком: 6% барьера занимают ровно 6% ширины.
  if (barrier>0){ ctx.fillStyle='#5ec2e0'; ctx.fillRect(x,y+h-2,w*barrier,2); }
  ctx.strokeStyle='#e8eef588'; ctx.lineWidth=1; ctx.strokeRect(x-0.5,y-0.5,w+1,h+1);
}

/* Компактный Boss HUD живёт в Canvas и использует фиксированный массив на
   четыре ссылки. Список и DOM не пересобираются каждый кадр. */
const BOSS_HUD_MARKERS=[
  {col:'#f6c344',shape:'diamond'}, {col:'#5ec2e0',shape:'square'},
  {col:'#b56cff',shape:'triangle'}, {col:'#78d66b',shape:'circle'}
];
const BOSS_HUD_HP_LAG_TIME=0.4;
const BOSS_HUD_TARGETS=[null,null,null,null];
let BOSS_HUD_COUNT=0;
function tickBossHudHealth(dt){
  for (let i=0;i<G.enemies.length;i++){
    const e=G.enemies[i];
    if (e.kind!=='boss' || e.dead) continue;
    const hp=clamp(e.hp/Math.max(1,e.maxHp),0,1);
    if (!Number.isFinite(e.hudHpLag)) e.hudHpLag=hp;
    if (!Number.isFinite(e.hudHpLast)) e.hudHpLast=hp;
    let hit=false;
    if (hp<e.hudHpLast){
      e.hudHpLag=Math.max(e.hudHpLag,e.hudHpLast);
      e.hudHpFrom=e.hudHpLag;
      e.hudHpTimer=BOSS_HUD_HP_LAG_TIME;
      hit=true;
    } else if (hp>e.hudHpLast){
      // Лечение не должно оставлять светлую полосу позади настоящего HP.
      e.hudHpLag=e.hudHpFrom=hp; e.hudHpTimer=0;
    }
    e.hudHpLast=hp;
    if (!hit && e.hudHpTimer>0){
      e.hudHpTimer=Math.max(0,e.hudHpTimer-dt);
      const t=1-e.hudHpTimer/BOSS_HUD_HP_LAG_TIME;
      e.hudHpLag=e.hudHpFrom+(hp-e.hudHpFrom)*t;
    } else if (!hit && e.hudHpLag<hp){
      e.hudHpLag=hp;
    }
  }
}
function collectBossHudTargets(){
  BOSS_HUD_COUNT=0;
  for (let i=0;i<BOSS_HUD_TARGETS.length;i++) BOSS_HUD_TARGETS[i]=null;
  for (let i=0;i<G.enemies.length;i++){
    const e=G.enemies[i];
    if (e.kind!=='boss' || e.dead) continue;
    BOSS_HUD_TARGETS[BOSS_HUD_COUNT++]=e;
    if (BOSS_HUD_COUNT===BOSS_HUD_TARGETS.length) break;
  }
  return BOSS_HUD_COUNT;
}
function bossHudTargetSlot(e){
  for (let i=0;i<BOSS_HUD_COUNT;i++) if (BOSS_HUD_TARGETS[i]===e) return i;
  return -1;
}
function bossHudInfo(e){
  const def=bossType(e); let info='',n=0;
  if (def && def.rare){ info=tr('РЕДКИЙ'); n=1; }
  if (def && def.hud && n<2){ info+=(info?' · ':'')+tr(def.hud).toUpperCase(); n++; }
  if (n<2 && e.aff && e.aff.length){ info+=(info?' · ':'')+tr(e.aff[0].nm).toUpperCase(); }
  return info;
}
function drawBossHudMarker(x,y,slot,size=5){
  const m=BOSS_HUD_MARKERS[slot]||BOSS_HUD_MARKERS[0];
  ctx.save(); ctx.fillStyle=m.col; ctx.strokeStyle='#020408'; ctx.lineWidth=2; ctx.beginPath();
  if (m.shape==='diamond'){
    ctx.moveTo(x,y-size);ctx.lineTo(x+size,y);ctx.lineTo(x,y+size);ctx.lineTo(x-size,y);ctx.closePath();
  } else if (m.shape==='triangle'){
    ctx.moveTo(x,y-size);ctx.lineTo(x+size,y+size);ctx.lineTo(x-size,y+size);ctx.closePath();
  } else if (m.shape==='circle') ctx.arc(x,y,size,0,Math.PI*2);
  else ctx.rect(x-size,y-size,size*2,size*2);
  ctx.fill(); ctx.stroke(); ctx.restore();
}
function drawBossHudEntry(e,cx,width,slot,two,y){
  const def=bossType(e),rare=!!(def&&def.rare),name=tr(e.t.nm).toUpperCase();
  const hp=clamp(e.hp/Math.max(1,e.maxHp),0,1);
  const hpLag=Math.max(hp,clamp(Number.isFinite(e.hudHpLag)?e.hudHpLag:hp,0,1));
  const left=Math.round(cx-width/2),barY=y+17;
  ctx.save(); ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.font='bold '+(name.length>22?11:12)+'px ui-monospace,monospace';
  ctx.lineWidth=3; ctx.strokeStyle='#020408'; ctx.strokeText(name,cx,y+11);
  ctx.fillStyle=rare?'#f6c344':'#eef3f8'; ctx.fillText(name,cx,y+11);
  if (two){
    const tm=ctx.measureText(name),nameW=tm&&Number.isFinite(tm.width)?tm.width:name.length*7;
    drawBossHudMarker(cx-nameW/2-10,y+6,slot,4);
  }
  ctx.fillStyle='#03060bdd'; ctx.fillRect(left,barY,width,8);
  ctx.fillStyle='#f2e8dcbb'; ctx.fillRect(left+1,barY+1,Math.round((width-2)*hpLag),6);
  ctx.fillStyle='#ff3b45'; ctx.fillRect(left+1,barY+1,Math.round((width-2)*hp),6);
  ctx.strokeStyle=rare?'#f6c344':'#7d3540'; ctx.lineWidth=1; ctx.strokeRect(left-0.5,barY-0.5,width+1,9);
  ctx.font='bold 10px ui-monospace,monospace'; ctx.fillStyle=rare?'#d9bc69':'#aebbc8';
  ctx.fillText(bossHudInfo(e),cx,y+39); ctx.restore();
}
function drawBossHud(){
  if (!BOSS_HUD_COUNT) return 0;
  if (BOSS_HUD_COUNT===1){
    drawBossHudEntry(BOSS_HUD_TARGETS[0],W/2,Math.min(440,Math.max(240,W*0.48)),0,false,9);
    return 1;
  }
  const width=Math.min(340,Math.max(180,W*0.28)),y=W<1180?76:9;
  if (BOSS_HUD_COUNT===2){
    drawBossHudEntry(BOSS_HUD_TARGETS[0],W*0.36,width,0,true,y);
    drawBossHudEntry(BOSS_HUD_TARGETS[1],W*0.64,width,1,true,y);
    return 2;
  }
  const gridWidth=Math.min(300,Math.max(160,W*0.25));
  for (let i=0;i<BOSS_HUD_COUNT;i++){
    const row=Math.floor(i/2), lone=i===BOSS_HUD_COUNT-1 && BOSS_HUD_COUNT%2===1;
    const cx=lone?W/2:(i%2?W*0.66:W*0.34);
    drawBossHudEntry(BOSS_HUD_TARGETS[i],cx,gridWidth,i,true,y+row*48);
  }
  return BOSS_HUD_COUNT;
}

const CANVAS_RENDER_PASSES=['ground','bloodGround','corpses','telegraphs','floorEffects','itemsProjectiles',
                            'entities','bloodFx','impactEffects','worldHud','combatText','bossHud'];

/* Видимость считается по полной визуальной геометрии, а не по центру объекта.
   Равенство границе считается видимым: объект исчезает только когда целиком
   вышел за экран. Неизвестные эффекты намеренно не отсекаются — новая механика
   сначала остаётся безопасной, пока для неё не описана точная граница. */
const RENDER_VIEW={ready:false,left:0,top:0,right:0,bottom:0,scale:1,centerX:0,centerY:0,
  enemyBodies:[],enemyHud:[],orbs:[],enemyShots:[],playerShots:[],mines:[],parts:[],
  impactFx:[],combatFx:[],telegraphs:[],arcaneTraces:[]};
function renderCircleVisible(x,y,r=0,view=RENDER_VIEW){
  if (!view || !view.ready) return true;
  r=Math.max(0,Number(r)||0);
  return x+r>=view.left && x-r<=view.right && y+r>=view.top && y-r<=view.bottom;
}
function renderAabbVisible(x1,y1,x2,y2,padding=0,view=RENDER_VIEW){
  if (!view || !view.ready) return true;
  padding=Math.max(0,Number(padding)||0);
  return Math.max(x1,x2)+padding>=view.left && Math.min(x1,x2)-padding<=view.right &&
         Math.max(y1,y2)+padding>=view.top && Math.min(y1,y2)-padding<=view.bottom;
}
function renderTelegraphVisible(spec,view=RENDER_VIEW){
  if (!spec) return false;
  if (spec.shape==='corridor')
    return renderAabbVisible(spec.x,spec.y,spec.x2,spec.y2,(spec.width||24)/2+5,view);
  return renderCircleVisible(spec.x,spec.y,(spec.r||0)+5,view);
}
function enemyBodyRenderRadius(e){
  const sf=enemySpriteFrame(e);
  if (!sf) return (e.r||0)+5;
  const f=sf.frame,k=e.r*sf.meta.scale/f.h;
  return Math.max(f.ax*k,(f.w-f.ax)*k,f.ay*k,(f.h-f.ay)*k)+5;
}
function enemyHudRenderRadius(e){
  let r=Math.max(enemyBodyRenderRadius(e),enemyVisualTop(e)+42,52);
  if (e.ail && e.ail.chill>0) r=Math.max(r,D.chillAuraR+5);
  if (e.pack && e.roles && e.roles.length){
    if (e.roles.includes('beacon')) r=Math.max(r,185);
    if (e.roles.includes('circle')) r=Math.max(r,155);
  }
  if (e.aff && e.aff.length) r=Math.max(r,e.r+15+(e.aff.length-1)*6);
  return r;
}
function enemyShotRenderRadius(s){
  if (s.shotType==='spear' || s.shotType==='minotaurSpear') return 36;
  if (s.shotType==='axe') return 40;
  if (s.shotType==='lich') return 23;
  if (s.shotType==='slime') return 15;
  if (s.shotType==='eliteBolt') return 14;
  if (s.shotType==='eliteFireball') return 11;
  return Math.max(10,(s.r||0)+5);
}
function playerShotRenderRadius(s){
  const body=Math.max(10,(s.r||0)*1.5);
  return acceleratedArrowTrailActive(s)?Math.max(body,ACCELERATED_ARROW_TRAIL_LENGTH+(s.r||0)):body;
}
function renderEffectVisible(f,view=RENDER_VIEW){
  if (!f) return false;
  if (f.t==='telegraph' || f.t==='telegraphTrace') return renderTelegraphVisible(f,view);
  if (f.t==='bolt') return renderAabbVisible(f.x,f.y,f.x2,f.y2,14,view);
  if (f.t==='matriarchPlagueProjectile'){
    const progress=clamp(1-f.life/(f.max||0.32),0,1);
    return renderCircleVisible(f.x+(f.x2-f.x)*progress,f.y+(f.y2-f.y)*progress,23,view);
  }
  if (f.t==='ring' || f.t==='wave' || f.t==='arc' || f.t==='cross')
    return renderCircleVisible(f.x,f.y,(f.r||0)+8,view);
  if (f.t==='voidRiftBurst') return renderCircleVisible(f.x,f.y,(f.r||0)*Math.SQRT2+3,view);
  if (f.t==='arcaneMineExplosion' || f.t==='mageOrbExplosion')
    return renderCircleVisible(f.x,f.y,(f.r||0)*Math.SQRT2+3,view);
  if (f.t==='demonicBlob') return renderCircleVisible(f.x,f.y,(f.r||115)+4,view);
  if (f.t==='holySpear') return renderCircleVisible(f.x,f.y,Math.max(56,(f.r||0)+4),view);
  if (f.t==='legacyBossEffect' || f.t==='boss20SpriteEffect'){
    const specs=f.specs||(f.spec?[f.spec]:null);
    if (specs) return specs.some(spec=>renderTelegraphVisible(spec,view));
    return renderCircleVisible(f.x,f.y,Math.max(f.sizeX||0,f.sizeY||0,f.size||160)*0.72,view);
  }
  return true;
}
function currentRenderShake(){
  let best=null;
  for (const f of G.fx) if (f.t==='shake' && (!best || (f.amp||5)>(best.amp||5))) best=f;
  return best;
}
function prepareRenderView(p,sx=0,sy=0,camera=null){
  camera=camera||prepareCameraFrame(p,sx,sy);
  const view=RENDER_VIEW;
  const visibleCenterX=camera.centerX-camera.shakeX/camera.scale;
  const visibleCenterY=camera.centerY-camera.shakeY/camera.scale;
  const halfW=W/(2*camera.scale),halfH=H/(2*camera.scale);
  view.left=visibleCenterX-halfW; view.top=visibleCenterY-halfH;
  view.right=visibleCenterX+halfW; view.bottom=visibleCenterY+halfH;
  view.scale=camera.scale; view.centerX=visibleCenterX; view.centerY=visibleCenterY; view.ready=true;
  for (const key of ['enemyBodies','enemyHud','orbs','enemyShots','playerShots','mines','parts',
                     'impactFx','combatFx','telegraphs','arcaneTraces']) view[key].length=0;
  for (const e of G.enemies){
    if (renderCircleVisible(e.x,e.y,enemyBodyRenderRadius(e),view)) view.enemyBodies.push(e);
    if (renderCircleVisible(e.x,e.y,enemyHudRenderRadius(e),view)) view.enemyHud.push(e);
  }
  for (const o of G.orbs) if (renderCircleVisible(o.x,o.y,76,view)) view.orbs.push(o);
  for (const s of G.eshots) if (renderCircleVisible(s.x,s.y,enemyShotRenderRadius(s),view)) view.enemyShots.push(s);
  for (const s of G.shots) if (renderCircleVisible(s.x,s.y,playerShotRenderRadius(s),view)) view.playerShots.push(s);
  for (const mine of G.arcaneMines) if (renderCircleVisible(mine.x,mine.y,ARCANE_MINE_DRAW_SIZE/Math.SQRT2+2,view)) view.mines.push(mine);
  for (const q of G.parts) if (renderCircleVisible(q.x,q.y,(q.sz||0)*Math.SQRT2+2,view)) view.parts.push(q);
  for (const trace of G.arcaneTraces) if (renderCircleVisible(trace.x,trace.y,(trace.r||0)*Math.SQRT2+3,view)) view.arcaneTraces.push(trace);
  for (const f of G.fx){
    if (f.t==='shake') continue;
    if (f.t==='telegraph'){
      if (renderTelegraphVisible(f,view)) view.telegraphs.push(f);
    } else if (f.t==='num' || f.t==='txt' || f.t==='hurtNum' || f.t==='healNum'){
      if (renderCircleVisible(f.x,f.y,72,view)) view.combatFx.push(f);
    } else if (renderEffectVisible(f,view)) view.impactFx.push(f);
  }
  return view;
}

function render(){
  const p = G.player;
  collectBossHudTargets();
  let sx = 0, sy = 0;
  const shake=currentRenderShake();
  if (shake){ const amp=shake.amp||5; sx=rnd(-amp,amp); sy=rnd(-amp,amp); }
  const camera=prepareCameraFrame(p,sx,sy);
  const view=prepareRenderView(p,sx,sy,camera);

  for (const pass of CANVAS_RENDER_PASSES) renderCanvasPass(pass,p,sx,sy,view,camera);

  // Экранная реакция всегда композится после всех мировых слоёв.
  if (G.hurtVignette > 0){
    const fade=clamp(G.hurtVignette/Math.max(0.001,G.hurtVignetteMax),0,1);
    const r0=Math.min(W,H)*0.20, r1=Math.hypot(W,H)*0.58;
    const vg=ctx.createRadialGradient(W/2,H/2,r0,W/2,H/2,r1);
    vg.addColorStop(0,'rgba(70,0,8,0)');
    vg.addColorStop(0.62,'rgba(90,0,10,'+(G.hurtVignetteOpacity*fade*0.18)+')');
    vg.addColorStop(1,'rgba(95,0,12,'+(G.hurtVignetteOpacity*fade)+')');
    ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
  }
  updateHud();                                               // DOM HUD — последний проход
}

function renderCanvasPass(pass,p,sx,sy,view=RENDER_VIEW,camera=prepareCameraFrame(p,sx,sy)){

  if (pass==='bossHud'){
    ctx.save(); drawBossHud(); ctx.restore(); return;
  }

  // Видимые границы в координатах мира. Внутри арены непрозрачный пол сам очищает кадр,
  // поэтому отдельная полноэкранная заливка нужна только у края или до загрузки тайла.
  const viewLeft=view.left,viewTop=view.top,viewRight=view.right,viewBottom=view.bottom;
  const floorLeft = Math.max(-ARENA, viewLeft), floorTop = Math.max(-ARENA, viewTop);
  const floorRight = Math.min(ARENA, viewRight), floorBottom = Math.min(ARENA, viewBottom);
  const floorCoversView = floorPattern && floorLeft <= viewLeft && floorTop <= viewTop &&
                          floorRight >= viewRight && floorBottom >= viewBottom;
  if (pass==='ground' && !floorCoversView){ ctx.fillStyle='#0d1014'; ctx.fillRect(0,0,W,H); }
  ctx.save();
  ctx.translate(W/2+camera.shakeX,H/2+camera.shakeY);
  ctx.scale(camera.scale,camera.scale);                            // масштабируется только игровой мир
  ctx.translate(-camera.centerX,-camera.centerY);                  // герой всегда строго в центре

  if (pass==='ground' && floorPattern){
    // Рисуем только видимый фрагмент: размер операции теперь W×H, а не 3000×3000.
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = floorPattern;
    if (floorRight > floorLeft && floorBottom > floorTop){
      ctx.fillRect(floorLeft, floorTop, floorRight-floorLeft, floorBottom-floorTop);
    }
  } else if (pass==='ground'){
    // Без Image (в том числе в Node-харнессе) остаётся прежняя лёгкая сетка.
    const step = 80;
    ctx.strokeStyle = '#171d24'; ctx.lineWidth = 1;
    const x0=Math.floor(viewLeft/step)*step,y0=Math.floor(viewTop/step)*step;
    ctx.beginPath();
    for (let x=x0;x<viewRight+step;x+=step){ctx.moveTo(x,y0-step);ctx.lineTo(x,viewBottom+step);}
    for (let y=y0;y<viewBottom+step;y+=step){ctx.moveTo(x0-step,y);ctx.lineTo(viewRight+step,y);}
    ctx.stroke();
  }

  if (pass==='ground'){
    // Граница арены
    ctx.strokeStyle='#2c3742'; ctx.lineWidth=3;
    ctx.strokeRect(-ARENA,-ARENA,ARENA*2,ARENA*2);
  }

  if (pass==='bloodGround') drawBloodGround(floorLeft,floorTop,floorRight,floorBottom);
  if (pass==='corpses') drawVisualCorpses(viewLeft,viewTop,viewRight,viewBottom);
  if (pass==='bloodFx') drawBloodFx(view);

  // Аура замедления
  if (pass==='worldHud' && G.bag.has('slowAura')){
    ctx.strokeStyle = '#5ec2e022'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, D.slowAuraR, 0, 6.29); ctx.stroke();
  }
  if (pass==='worldHud' && G.portal) drawFloorPortalIndicator(G.portal,p);

  // Портал
  if (pass==='itemsProjectiles' && G.portal){
    drawFloorPortalEnergy(G.portal,view);
    if (!drawFloorPortalSprite(G.portal,view) && renderCircleVisible(G.portal.x,G.portal.y,70,view)){
      const t = G.portal.t;
      ctx.strokeStyle = '#8f1418'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++){
        const rr = G.portal.r * (0.5 + i*0.28) + Math.sin(t*3 + i)*4;
        drawPoly(G.portal.x, G.portal.y, rr, 8, 0); ctx.stroke();
      }
    }
  }

  // Сферы опыта (бирюзовые круги) и золото (янтарные ромбы)
  if (pass==='itemsProjectiles'){
  for (const o of view.orbs){
    if (o.book){
      // Книга — важнейшая находка, поэтому подсвечена нарочито громко:
      // радужный ореол, пульсирующие кольца и искры.
      const puls = 1 + Math.sin(G.time*4)*0.18;
      const R = 62 * puls;
      const hue = (G.time*150) % 360;

      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, R);
      g.addColorStop(0,    'hsla(' + hue + ',100%,72%,0.55)');
      g.addColorStop(0.45, 'hsla(' + ((hue+80)%360) + ',100%,62%,0.22)');
      g.addColorStop(1,    'hsla(' + ((hue+160)%360) + ',100%,60%,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(o.x, o.y, R, 0, 6.29); ctx.fill();

      ctx.lineWidth = 2;                                  // три кольца, крутятся в разные стороны
      for (let ri = 0; ri < 3; ri++){
        ctx.strokeStyle = 'hsla(' + ((hue + ri*120) % 360) + ',100%,68%,' + (0.75 - ri*0.18) + ')';
        drawPoly(o.x, o.y, (18 + ri*11) * puls, 6, G.time*(ri%2 ? 1.6 : -1.2) + ri);
        ctx.stroke();
      }
      drawBookFloorSprite(o);

      if (Math.random() < 0.30)                           // непрерывный сноп искр
        burst(o.x, o.y, 1, 'hsl(' + ((hue+rnd(0,360))%360) + ',100%,70%)', 90, 3, 0.7);
    }
    else if (o.amu){                                   // редкий предмет: PNG и прежний сигнальный круг
      const A = AMULETS[o.amu], pu = 0.65 + 0.35*Math.sin(G.time*5);
      drawRareItemSprite(o);
      ctx.globalAlpha = 1; ctx.strokeStyle = A.col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(o.x, o.y, 17 + 4*pu, 0, 6.29); ctx.stroke();
    }
    else if (o.totem){                                 // тотем: ранговый PNG и сигнальный круг
      const T = TOTEMS[o.totem], pu = 0.7 + 0.3*Math.sin(G.time*4);
      drawTotemSprite(o);
      ctx.globalAlpha = 1; ctx.strokeStyle = T.col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(o.x, o.y, 16 + 3*pu, 0, 6.29); ctx.stroke();
    }
    else if (o.gold){
      if (!drawLootSprite(o)){ ctx.fillStyle = '#f0c040'; drawPoly(o.x, o.y, 4.5, 4, G.time*2); ctx.fill(); }
    }
    else if (!drawLootSprite(o)){ ctx.fillStyle = '#4fd1c5'; ctx.beginPath(); ctx.arc(o.x,o.y,4,0,6.29); ctx.fill(); }
  }
  }

  if (pass==='floorEffects'){
  // Воронка гравитационного колодца — под всеми
  if (G.well && renderCircleVisible(G.well.x,G.well.y,G.well.r+3,view)){
    ctx.globalAlpha = 0.18 + 0.12*Math.sin(G.time*10);
    ctx.fillStyle = '#c08cff';
    ctx.beginPath(); ctx.arc(G.well.x, G.well.y, G.well.r*(0.4 + 0.6*G.well.t), 0, 6.29); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#c08cff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(G.well.x, G.well.y, G.well.r, 0, 6.29); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Землелом: стабильный рисунок радиальных разломов, который не мерцает между кадрами.
  for (const crack of G.groundbreakerCracks){
    if (!renderCircleVisible(crack.x,crack.y,crack.r+4,view)) continue;
    const k=clamp(crack.life/GROUNDBREAKER_CRACK_LIFE,0,1);
    ctx.save();
    ctx.globalAlpha=0.24+0.56*k; ctx.strokeStyle='#d5a64a'; ctx.lineWidth=2;
    for (let i=0;i<9;i++){
      const a=crack.seed+i*Math.PI*2/9, bend=Math.sin(crack.seed*7+i*2.1)*0.18;
      ctx.beginPath();
      ctx.moveTo(crack.x+Math.cos(a)*12,crack.y+Math.sin(a)*12);
      ctx.lineTo(crack.x+Math.cos(a+bend)*crack.r*0.48,crack.y+Math.sin(a+bend)*crack.r*0.48);
      ctx.lineTo(crack.x+Math.cos(a-bend*0.4)*crack.r,crack.y+Math.sin(a-bend*0.4)*crack.r);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Кипящая кровь — под всеми, это часть пола
  for (const b2 of G.boils){
    if (!renderCircleVisible(b2.x,b2.y,b2.r*Math.SQRT2+4,view)) continue;
    if (drawGroundPoolSprite('boilingBlood',b2,BOIL_LIFE,0.72)) continue;
    const k = clamp(b2.life/BOIL_LIFE, 0, 1);
    ctx.globalAlpha = 0.22*k + 0.10*Math.abs(Math.sin(G.time*6));
    ctx.fillStyle = '#e0405a';
    ctx.beginPath(); ctx.arc(b2.x, b2.y, b2.r, 0, 6.29); ctx.fill();
    ctx.globalAlpha = 0.5*k; ctx.strokeStyle = '#e0405a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // След от ботинок — под всеми, это часть пола
  for (const tr of G.trails){
    if (!renderCircleVisible(tr.x,tr.y,tr.r*Math.SQRT2+4,view)) continue;
    let spriteDrawn=true;
    if (tr.fire) spriteDrawn=drawGroundPoolSprite('lavaTrail',tr,TRAIL_LIFE,0.64) && spriteDrawn;
    if (tr.cold) spriteDrawn=drawGroundPoolSprite('frostTrail',tr,TRAIL_LIFE,tr.fire?0.46:0.62) && spriteDrawn;
    if (spriteDrawn) continue;
    const k = clamp(tr.life/TRAIL_LIFE, 0, 1);
    ctx.globalAlpha = 0.30*k;
    ctx.fillStyle = tr.fire ? '#ff7a2f' : '#7fd6ff';
    ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r*(0.55 + 0.45*k), 0, 6.29); ctx.fill();
    if (tr.fire && tr.cold){                      // оба следа сразу: ледяная кайма поверх
      ctx.globalAlpha = 0.22*k; ctx.strokeStyle = '#7fd6ff'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // Лужи смолы — под всеми, это часть пола
  for (const pl of G.pools){
    if (!renderCircleVisible(pl.x,pl.y,pl.r*Math.SQRT2+4,view)) continue;
    const k = clamp(pl.life/pl.max, 0, 1);
    const arming = pl.arm > 0;
    if (arming) continue;                                       // замах уже нарисован общим красным телеграфом
    if (drawGroundPoolSprite('tar',pl,pl.max,0.72)) continue;
    ctx.globalAlpha = 0.22 + 0.18*k;
    ctx.fillStyle = '#6b4a12'; ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r, 0, 6.29); ctx.fill();
    ctx.globalAlpha = 0.5 + 0.4*k;
    ctx.strokeStyle = '#c08a3a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Кислота Чумоносного огра: обычная лужа компактна, предсмертная — заметно больше.
  for (const pl of G.eliteAcidPools){
    if (!renderCircleVisible(pl.x,pl.y,pl.r*Math.SQRT2+4,view)) continue;
    if (drawGroundPoolSprite('ogreAcid',pl,pl.max,0.68)) continue;
    const k=clamp(pl.life/pl.max,0,1),pulse=0.72+0.28*Math.sin(G.time*12+pl.x*0.01);
    ctx.globalAlpha=(0.25+0.20*k)*pulse;
    ctx.fillStyle=pl.deathPool?'#668f16':'#527914';
    ctx.beginPath(); ctx.arc(pl.x,pl.y,pl.r,0,6.29); ctx.fill();
    ctx.globalAlpha=0.58+0.24*k; ctx.strokeStyle='#b8ee42';
    ctx.lineWidth=pl.deathPool?4:2; ctx.stroke(); ctx.globalAlpha=1;
  }
  // Предсмертная кислота Чумной Мерзости — крупнее смолы и тикает ровно раз в секунду.
  for (const pl of G.bossPools){
    if (!renderCircleVisible(pl.x,pl.y,pl.r*Math.SQRT2+5,view)) continue;
    if (drawGroundPoolSprite('bossAcid',pl,pl.max,0.72)) continue;
    const k = clamp(pl.life/pl.max, 0, 1), pulse = 0.75 + 0.25*Math.sin(G.time*7);
    ctx.globalAlpha = (0.24 + 0.18*k) * pulse;
    ctx.fillStyle = '#638f19'; ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r, 0, 6.29); ctx.fill();
    ctx.globalAlpha = 0.55 + 0.30*k;
    ctx.strokeStyle = '#b8ee42'; ctx.lineWidth = 4; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // След Тирана короткий и ограничен 48 пятнами: заметен, но не превращается
  // в сотни полупрозрачных кругов, которые снова уронят FPS.
  for (const tr of G.bossTrails){
    if (!renderCircleVisible(tr.x,tr.y,tr.r*Math.SQRT2+4,view)) continue;
    if (drawGroundPoolSprite('tyrantFire',tr,tr.max,0.66)) continue;
    const k=clamp(tr.life/tr.max,0,1), pulse=0.72+0.28*Math.sin(G.time*15+tr.x*0.02);
    ctx.globalAlpha=(0.20+0.22*k)*pulse; ctx.fillStyle='#d52d18';
    ctx.beginPath(); ctx.arc(tr.x,tr.y,tr.r*(0.75+0.25*k),0,6.29); ctx.fill();
    ctx.globalAlpha=0.55*k; ctx.strokeStyle='#ff8a32'; ctx.lineWidth=2; ctx.stroke();
    ctx.globalAlpha=1;
  }
  for(const h of G.bossHazards){
    if(h.kind==='safe'){
      ctx.save();ctx.fillStyle='rgba(2,3,7,0.78)';ctx.beginPath();
      ctx.rect(viewLeft-4,viewTop-4,viewRight-viewLeft+8,viewBottom-viewTop+8);
      ctx.arc(h.spec.x,h.spec.y,h.spec.r,0,Math.PI*2,true);ctx.fill('evenodd');
      ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.28+.12*Math.sin(G.time*8);
      ctx.fillStyle=h.col;ctx.beginPath();ctx.arc(h.spec.x,h.spec.y,h.spec.r,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=.95;ctx.strokeStyle='#ffe28a';ctx.lineWidth=4;ctx.stroke();ctx.restore();
      drawBoss20EffectInSpec(h.effectKey,h.spec,(G.time*7%4)/4,.82);
      continue;
    }
    const visible=h.spec.shape==='corridor'
      ?renderAabbVisible(h.spec.x,h.spec.y,h.spec.x2,h.spec.y2,(h.spec.width||50)/2+4,view)
      :renderCircleVisible(h.spec.x,h.spec.y,(h.spec.r||0)+5,view);
    if(!visible) continue;
    if(h.effectKey) drawBoss20EffectInSpec(h.effectKey,h.spec,(G.time*7%4)/4,.76);
    ctx.save();telegraphPath(h.spec);const k=clamp(h.life/h.max,0,1),pulse=.75+.25*Math.sin(G.time*9+h.spec.x*.01);
    ctx.globalAlpha=(.18+.16*k)*pulse;ctx.fillStyle=h.col;ctx.fill();
    ctx.globalAlpha=.62*k;ctx.strokeStyle=h.col;ctx.lineWidth=3;ctx.stroke();ctx.restore();
  }
  }

  if (pass==='telegraphs'){
  // Короткоживущие маркеры снарядов используют ту же временную шкалу.
  for (const f of view.telegraphs) drawTelegraph(Object.assign({},f,{remaining:f.life}));
  // Все активные замахи проходят через одну геометрию, палитру и временную шкалу.
  for (const e of G.enemies){
    if (e.kind !== 'boss' || !e.bossT) continue;
    const T=e.bossT;
    if (e.bossId === 'behemoth' && T.jumpWarn > 0)
      drawTelegraph({shape:'target',kind:'warning',x:T.jumpX,y:T.jumpY,r:e.r+20,remaining:T.jumpWarn,total:BOSS_BEHEMOTH_WARN});
    if (e.bossId === 'vampire' && T.markWarn > 0){
      drawTelegraph({shape:'corridor',kind:'damage',x:T.markX-105,y:T.markY,x2:T.markX+105,y2:T.markY,
        width:44,remaining:T.markWarn,total:BOSS_VAMPIRE_WARN});
      drawTelegraph({shape:'corridor',kind:'damage',x:T.markX,y:T.markY-105,x2:T.markX,y2:T.markY+105,
        width:44,remaining:T.markWarn,total:BOSS_VAMPIRE_WARN});
    }
    if (e.bossId === 'voidwrath' && T.rifts){
      for (const r of T.rifts)
        if (renderCircleVisible(r.x,r.y,r.r*Math.SQRT2+3,view)) drawVoidGroundRift(r.x,r.y,r.r,1-r.warn/BOSS_VOID_WARN,0.72);
    }
    if (e.bossId === 'minotaur' && T.chargeWarn > 0){
      const len=minotaurEdgeDistance(e,T.chargeA), ex=e.x+Math.cos(T.chargeA)*len, ey=e.y+Math.sin(T.chargeA)*len;
      drawTelegraph({shape:'corridor',kind:'damage',x:e.x,y:e.y,x2:ex,y2:ey,width:e.r*2+16,
        remaining:T.chargeWarn,total:BOSS_MINOTAUR_WARN});
    }
    if (e.bossId === 'seraph' && T.judgeWarn > 0)
      drawTelegraph({shape:'target',kind:'damage',x:T.judgeX,y:T.judgeY,r:68,remaining:T.judgeWarn,total:BOSS_SERAPH_WARN});
    if (e.bossId === 'demonqueen' && T.leapWarn > 0){
      drawTelegraph({shape:'target',kind:'control',x:T.leapX,y:T.leapY,r:115,remaining:T.leapWarn,total:BOSS_QUEEN_WARN});
      if (renderCircleVisible(T.leapX,T.leapY,48,view))
        drawDemonicBlobSprite(T.leapX,T.leapY,1-T.leapWarn/BOSS_QUEEN_WARN,230,0.72);
    }
    if (e.bossId === 'goat' && T.slamWarn > 0)
      drawTelegraph({shape:'circle',kind:'damage',x:e.x,y:e.y,r:BOSS_GOAT_AOE,remaining:T.slamWarn,total:BOSS_GOAT_WARN});
    if (T.special){
      const S=T.special;
      for(const tg of S.telegraphs) if(S.t>=tg.from && S.t<tg.to)
        drawTelegraph(Object.assign({},tg.spec,{kind:tg.kind,remaining:tg.to-S.t,total:tg.to-tg.from}));
    }
  }
  }

  if (pass==='floorEffects'){
  // Кислота веномансера: зелёная лужа остаётся там, где погиб приспешник.
  for (const a of G.acidPools){
    if (!renderCircleVisible(a.x,a.y,a.r*Math.SQRT2+4,view)) continue;
    if (drawGroundPoolSprite('venomAcid',a,a.max,0.68)) continue;
    const k = clamp(a.life/a.max, 0, 1);
    ctx.globalAlpha = 0.22 + 0.20*k;
    ctx.fillStyle = '#466f28'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.29); ctx.fill();
    ctx.globalAlpha = 0.60*k;
    ctx.strokeStyle = '#a9e85a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  }

  // Враги
  if (pass==='entities' || pass==='worldHud' || pass==='telegraphs'){
  const renderEnemies=pass==='entities'?view.enemyBodies:pass==='worldHud'?view.enemyHud:G.enemies;
  for (const e of renderEnemies){
    if (pass==='entities'){
      ctx.lineWidth=e.kind==='norm'?2:3;
      ctx.strokeStyle=e.hit>0?'#ffffff':(e.kind==='boss'?'#ff5a4e':e.kind==='elite'?'#ffd24a':e.t.col);
      ctx.fillStyle=e.hit>0?'#ffffff44':e.t.col+'22';
      if (!drawEnemySprite(e)){ drawShape(e.t.shape,e.x,e.y,e.r,e.rot); ctx.fill(); ctx.stroke(); }
      const special=e.bossT&&e.bossT.special,clone=special&&special.clone;
      if(clone && special.t>=clone.from && special.t<=clone.to){
        const u=clamp((special.t-clone.from)/(clone.to-clone.from),0,1),meta=BOSS_SPRITE_META[e.bossId],sprite=BOSS_SPRITES[e.bossId];
        if(meta&&sprite&&sprite.complete&&sprite.naturalWidth){
          const f=meta.frames[Math.floor(G.time*12)%4],k=e.r*meta.scale/f.h,cx=clone.x+(clone.x2-clone.x)*u,cy=clone.y+(clone.y2-clone.y)*u;
          ctx.save();ctx.translate(cx,cy);ctx.globalAlpha=.38;ctx.filter='hue-rotate(245deg) saturate(1.8) brightness(.7)';ctx.imageSmoothingEnabled=false;
          ctx.drawImage(sprite,f.x,f.y,f.w,f.h,-f.ax*k,-f.ay*k,f.w*k,f.h*k);ctx.restore();
        }
      }
    }
    // Статусы противника показываются только семью элементальными PNG-иконками.
    // Попадание, элита, ярость и принадлежность к пачке отдельных меток не имеют.

    if (pass==='worldHud'){
    // Радиус ауры — телеграф механики, а не дополнительная метка состояния.
    if (e.ail.chill  > 0){
      ctx.strokeStyle = '#7fd6ff';
      // Радиус ауры виден, иначе игрок не поймёт, почему соседи вязнут
      ctx.globalAlpha = 0.13 + 0.07*Math.sin(G.time*3);
      ctx.beginPath(); ctx.arc(e.x, e.y, D.chillAuraR, 0, 6.29); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawEnemyStatusIcons(e);
    }

    // У пачки остаются только необходимые метки активных ролей и телеграфы.
    // Отдельная цветная метка принадлежности к пачке удалена.
    if (e.pack){
      if (e.roles.length){
        // Круги ролей рисуем по земле: игроку нужно видеть их границы, а не догадываться
        const bc = e.roles.indexOf('beacon')  >= 0 ? 180 : 0;
        const sc = e.roles.indexOf('circle')  >= 0 ? 150 : 0;
        if (pass==='telegraphs'){
          ctx.globalAlpha=0.10+0.05*Math.sin(G.time*3);
           if (bc && renderCircleVisible(e.x,e.y,bc+3,view)){ ctx.strokeStyle='#ffe14a'; ctx.beginPath(); ctx.arc(e.x,e.y,bc,0,6.29); ctx.stroke(); }
           if (sc && renderCircleVisible(e.x,e.y,sc+3,view)){ ctx.strokeStyle='#6fd98f'; ctx.beginPath(); ctx.arc(e.x,e.y,sc,0,6.29); ctx.stroke(); }
          ctx.globalAlpha=1;
        }
        if (pass==='worldHud'){
          const marks=e.roles.map(rl=>{ const a=PACK_AFFIXES.find(x=>x.role===rl); return a?[a.mark,a.col]:null; }).filter(Boolean);
          ctx.font='bold 15px ui-monospace,monospace'; ctx.textAlign='center';
          marks.forEach(([mk,col],mi)=>{ ctx.fillStyle=col; ctx.fillText(mk,e.x+(mi-(marks.length-1)/2)*16,e.y-e.r-13); });
        }
      }
      if (pass==='telegraphs' && e.jumpTo && e.jumpT > 0){ // замах прыжка: видно, что сейчас прыгнет
        drawTelegraph({shape:'target',kind:'warning',x:e.jumpTo.x,y:e.jumpTo.y,r:54,remaining:e.jumpT,total:0.5});
      }
    }
    if (pass==='worldHud') drawHunterMark(e);

    // Аффиксы мини-босса: по кольцу на каждый, плюс телеграф тарана
    if (e.aff.length){
      const puls = 0.6 + 0.4*Math.sin(G.time*4);
      if (pass==='worldHud') e.aff.forEach((a, ai) => {
        ctx.strokeStyle = a.id === 'ward' ? e.wardCol : a.col;
        ctx.globalAlpha = puls; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 11 + ai*6, 0, 6.29); ctx.stroke();
        ctx.globalAlpha = 1;
      });
      if (pass==='telegraphs' && e.affT.warn > 0){ // замах тарана: линия по будущей траектории
        drawTelegraph({shape:'corridor',kind:'damage',x:e.x,y:e.y,
          x2:e.x+Math.cos(e.affT.ca)*430,y2:e.y+Math.sin(e.affT.ca)*430,width:e.r*2+12,
          remaining:e.affT.warn,total:0.7});
      }
    }

    // Боссовое здоровье живёт только в верхнем Boss HUD; рядовым оставляем мини-бар.
    if (pass==='worldHud' && e.kind !== 'boss' && e.hp < e.maxHp){
      const w = e.r*2, hpw = w * clamp(e.hp/e.maxHp,0,1), top = enemyVisualTop(e);
      ctx.fillStyle = '#000a'; ctx.fillRect(e.x-w/2, e.y-top-9, w, 3);
      ctx.fillStyle = '#e0405a'; ctx.fillRect(e.x-w/2, e.y-top-9, hpw, 3);
    }
    // При нескольких боссах фигура связывает модель с её верхним HP-баром.
    const bossHudSlot=pass==='worldHud' && BOSS_HUD_COUNT>1 ? bossHudTargetSlot(e) : -1;
    if (bossHudSlot>=0){
      const top = enemyVisualTop(e);
      drawBossHudMarker(e.x,e.y-top-18,bossHudSlot,6);
    }
  }
  }

  // Снаряды врагов: уникальные атаки боссов читаются по форме и цвету.
  if (pass==='itemsProjectiles'){
  const shooterProjectileFrame = Math.floor(G.time*10) % 4;
  for (const s of view.enemyShots){
    ctx.save(); ctx.translate(s.x,s.y);
    if (drawEnemyProjectileSprite(s, shooterProjectileFrame)){
      // Один drawImage 8×8→12×12 заменяет процедурный розовый круг Призмы.
    } else if (s.shotType === 'axe'){
      ctx.rotate(s.spin||0); ctx.fillStyle='#9f3529'; ctx.strokeStyle='#ffd0b8'; ctx.lineWidth=2;
      ctx.beginPath();
      for (let k=0;k<8;k++){
        const a=k*Math.PI/4, rr=k%2?11:27;
        const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
        if (!k) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#3d2924'; ctx.fillRect(-5,-18,10,36);
    } else if (s.shotType === 'eliteFireball'){
      const pulse=0.82+0.18*Math.sin(G.time*24);
      ctx.globalAlpha=0.35; ctx.fillStyle='#ff2e12'; ctx.beginPath(); ctx.arc(0,0,10*pulse,0,6.29); ctx.fill();
      ctx.globalAlpha=1; ctx.fillStyle='#ff7a1f'; ctx.beginPath(); ctx.arc(0,0,6*pulse,0,6.29); ctx.fill();
      ctx.fillStyle='#fff1a8'; ctx.beginPath(); ctx.arc(-1,-1,2.4,0,6.29); ctx.fill();
    } else if (s.shotType === 'eliteBolt'){
      ctx.rotate(Math.atan2(s.vy,s.vx)); ctx.fillStyle='#c9b080'; ctx.strokeStyle='#fff2cf'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(3,-3); ctx.lineTo(-10,-2); ctx.lineTo(-10,2); ctx.lineTo(3,3); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (s.shotType === 'spear'){
      ctx.rotate(Math.atan2(s.vy,s.vx)); ctx.fillStyle = s.col || '#e6a52d'; ctx.strokeStyle = '#fff1a8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(30,0); ctx.lineTo(8,-8); ctx.lineTo(-25,-5); ctx.lineTo(-25,5); ctx.lineTo(8,8); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (s.shotType === 'minotaurSpear'){
      ctx.rotate(Math.atan2(s.vy,s.vx)); ctx.fillStyle='#8b4d2c'; ctx.strokeStyle='#e8a65d'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(24,0); ctx.lineTo(6,-11); ctx.lineTo(-20,-5); ctx.lineTo(-12,0); ctx.lineTo(-20,5); ctx.lineTo(6,11); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if(s.shotType==='boss20' && drawBoss20ProjectileEffect(s)){
      // Стеклянные осколки и пепельные кометы используют собственные листы.
    } else if(s.shotType==='boss20' && s.bossDot){
      ctx.rotate(Math.atan2(s.vy,s.vx));ctx.fillStyle='#ffefad';ctx.strokeStyle=s.col||'#e26a31';ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-8,-5);ctx.lineTo(-15,0);ctx.lineTo(-8,5);ctx.closePath();ctx.fill();ctx.stroke();
    } else if(s.shotType==='boss20'){
      ctx.rotate(Math.atan2(s.vy,s.vx));ctx.fillStyle=s.col||'#b9f3ff';ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-7,-5);ctx.lineTo(-3,0);ctx.lineTo(-7,5);ctx.closePath();ctx.fill();ctx.stroke();
    } else {
      ctx.fillStyle = s.col || '#d95ec2'; ctx.strokeStyle = s.shotType === 'lich' ? '#bffff8' : '#d8ff76'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0,0,s.r,0,6.29); ctx.fill();
      if (s.shotType) ctx.stroke();
    }
    ctx.restore();
  }

  // Снаряды игрока: общий кадр сферы вычисляется один раз на весь render-pass.
  const mageProjectileFrame = Math.floor(G.time*10)%4;
  for (const s of view.playerShots){
    drawAcceleratedArrowTrail(s);
    if (!drawPlayerProjectileSprite(s,mageProjectileFrame)){
      ctx.save();
      if (s.mirrorGhost) ctx.globalAlpha=0.62;
      ctx.fillStyle = s.orb ? (remoteOrbActive(s)?'#b56cff':'#5ec2e0') : s.mirrorGhost ? '#c08cff' : '#ffb340';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.29); ctx.fill();
      ctx.restore();
    }
  }
  for (const mine of view.mines){
    if (!ARCANE_MINE_SPRITE || !ARCANE_MINE_SPRITE.complete) continue;
    const d=ARCANE_MINE_DRAW_SIZE;
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(ARCANE_MINE_SPRITE,mine.x-d/2,mine.y-d/2,d,d);
  }
  }

  // Эффекты
  if (pass==='impactEffects'){
  for (const trace of view.arcaneTraces){
    const fade=clamp(trace.life/trace.max,0,1);
    const image=MAGE_ABILITY_SPRITES.residual;
    if (image && image.complete && image.naturalWidth){
      const frame=mageAbilitySpriteFrame('residual',1-fade),d=trace.r*2;
      ctx.save(); ctx.globalAlpha=0.35+fade*0.45; ctx.imageSmoothingEnabled=false;
      ctx.drawImage(image,frame.x,frame.y,frame.w,frame.h,trace.x-d/2,trace.y-d/2,d,d);
      ctx.restore();
    } else {
      ctx.globalAlpha=0.10+fade*0.16; ctx.fillStyle='#b56cff';
      ctx.beginPath(); ctx.arc(trace.x,trace.y,trace.r,0,6.29); ctx.fill();
      ctx.globalAlpha=0.25+fade*0.45; ctx.strokeStyle='#d7a7ff'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(trace.x,trace.y,trace.r,0,6.29); ctx.stroke(); ctx.globalAlpha=1;
    }
  }
  for (const f of view.impactFx){
    if (f.t === 'arcaneMineExplosion'){
      if (ARCANE_MINE_EXPLOSION && ARCANE_MINE_EXPLOSION.complete){
        const progress=clamp(1-f.life/f.max,0,0.999999);
        const frame=ARCANE_MINE_EXPLOSION_FRAMES[Math.min(7,Math.floor(progress*8))];
        const d=f.r*2;
        ctx.save(); ctx.globalAlpha=MAGE_EXPLOSION_ALPHA; ctx.imageSmoothingEnabled=false;
        ctx.drawImage(ARCANE_MINE_EXPLOSION,frame.x,frame.y,frame.w,frame.h,
                      f.x-d/2,f.y-d/2,d,d);
        ctx.restore();
      }
    } else if (f.t === 'mageOrbExplosion'){
      const progress=clamp(1-f.life/f.max,0,0.999999),d=f.r*2;
      const drawMageEffect=(key,size,alpha)=>{
        const image=MAGE_ABILITY_SPRITES[key],frame=mageAbilitySpriteFrame(key,progress);
        if (!image || !image.complete || !image.naturalWidth || !frame) return false;
        ctx.save(); ctx.globalAlpha=alpha*MAGE_EXPLOSION_ALPHA; ctx.imageSmoothingEnabled=false;
        ctx.drawImage(image,frame.x,frame.y,frame.w,frame.h,
                      f.x-size/2,f.y-size/2,size,size); ctx.restore(); return true;
      };
      const baseDrawn=drawMageEffect(f.variant,d,1);
      if (f.elemental) drawMageEffect('elemental',d,0.48);
      if (f.heart) drawMageEffect('heart',f.r,0.88);
      if (!baseDrawn){
        ctx.strokeStyle=f.variant==='remote'?'#b56cff':'#63dcff';
        ctx.globalAlpha=clamp(f.life*3,0,1)*MAGE_EXPLOSION_ALPHA; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,6.29); ctx.stroke(); ctx.globalAlpha=1;
      }
    } else if (f.t === 'legacyBossEffect'){
      drawLegacyBossEffect(f);
    } else if (f.t === 'boss20SpriteEffect'){
      drawBoss20SpriteEffect(f);
    } else if (f.t === 'telegraphTrace'){
      drawTelegraphTrace(f);
    } else if (f.t === 'bolt'){
      ctx.strokeStyle = '#ffe14a'; ctx.globalAlpha = clamp(f.life*5,0,1); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(f.x, f.y);
      const seg = 5;                                       // ломаем линию, чтобы читалась как разряд
      for (let k = 1; k <= seg; k++){
        const t2 = k/seg, jitter = k === seg ? 0 : 12;
        ctx.lineTo(f.x + (f.x2-f.x)*t2 + rnd(-jitter,jitter),
                   f.y + (f.y2-f.y)*t2 + rnd(-jitter,jitter));
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.t === 'wave'){
      ctx.strokeStyle = f.col; ctx.globalAlpha = clamp(f.life*0.8, 0, 0.9); ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.29); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.t === 'ring'){
      ctx.strokeStyle = f.col;
      ctx.globalAlpha = clamp(f.life*3,0,1)*(f.alpha===undefined?1:f.alpha); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,6.29); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.t === 'arc'){
      ctx.strokeStyle = f.col || '#ffb340'; ctx.globalAlpha = clamp(f.life*7,0,1); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(f.x,f.y,f.r,f.a-f.arc/2,f.a+f.arc/2); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.t === 'cross'){
      ctx.strokeStyle=f.col; ctx.globalAlpha=clamp(f.life*4,0,1); ctx.lineWidth=12;
      ctx.beginPath(); ctx.moveTo(f.x-f.r,f.y); ctx.lineTo(f.x+f.r,f.y);
      ctx.moveTo(f.x,f.y-f.r); ctx.lineTo(f.x,f.y+f.r); ctx.stroke(); ctx.globalAlpha=1;
    } else if (f.t === 'demonicBlob'){
      const progress=clamp(1-f.life/(f.max||0.38),0,0.999999);
      if (!drawDemonicBlobSprite(f.x,f.y,progress,(f.r||115)*2,clamp(f.life*3,0,1))){
        ctx.globalAlpha=clamp(f.life*2,0,0.55); ctx.fillStyle='#d51e42';
        ctx.beginPath(); ctx.arc(f.x,f.y,f.r||115,0,6.29); ctx.fill(); ctx.globalAlpha=1;
      }
    } else if (f.t === 'matriarchPlagueProjectile'){
      const progress=clamp(1-f.life/(f.max||0.32),0,0.999999);
      const frame=MATRIARCH_PLAGUE_PROJECTILE_FRAMES[Math.min(3,Math.floor(progress*4))];
      const x=f.x+(f.x2-f.x)*progress, y=f.y+(f.y2-f.y)*progress;
      if (MATRIARCH_PLAGUE_PROJECTILE && MATRIARCH_PLAGUE_PROJECTILE.complete && MATRIARCH_PLAGUE_PROJECTILE.naturalWidth){
        ctx.save(); ctx.imageSmoothingEnabled=false;
        ctx.drawImage(MATRIARCH_PLAGUE_PROJECTILE,frame.x,frame.y,frame.w,frame.h,x-16,y-16,32,32);
        ctx.restore();
      } else {
        ctx.fillStyle='#9fc917'; ctx.beginPath(); ctx.arc(x,y,12,0,6.29); ctx.fill();
      }
    } else if (f.t === 'voidRiftBurst'){
      const progress=clamp(1-f.life/(f.max||0.20),0,0.999999);
      drawVoidGroundRift(f.x,f.y,f.r,progress,clamp(f.life*5,0,0.85));
    } else if (f.t === 'holySpear'){
      const progress=clamp(1-f.life/(f.max||0.38),0,0.999999);
      const frame=SERAPH_HOLY_SPEAR_FRAMES[Math.min(3,Math.floor(progress*4))];
      ctx.save();ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.clip();
      ctx.translate(f.x,f.y); ctx.rotate(f.a||0); ctx.imageSmoothingEnabled=false;
      if (SERAPH_HOLY_SPEAR && SERAPH_HOLY_SPEAR.complete && SERAPH_HOLY_SPEAR.naturalWidth)
        ctx.drawImage(SERAPH_HOLY_SPEAR,frame.x,frame.y,frame.w,frame.h,
                      -frame.drawW/2,-frame.drawH/2,frame.drawW,frame.drawH);
      else {
        ctx.fillStyle=f.col; ctx.globalAlpha=clamp(f.life*3,0,0.75);
        ctx.fillRect(-48,-9,96,18);
      }
      ctx.restore(); ctx.globalAlpha=clamp(f.life*2,0,0.42); ctx.fillStyle=f.col;
      ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,6.29); ctx.fill(); ctx.globalAlpha=1;
    }
  }
  }

  if (pass==='combatText'){
  for (const f of view.combatFx){
    if (f.t === 'hurtNum' || f.t === 'healNum'){
      ctx.globalAlpha=clamp(f.life/(f.max||0.4)*1.5,0,1);
      ctx.font='bold 23px ui-monospace,monospace'; ctx.textAlign='center';
      const healing=f.t==='healNum';
      ctx.lineWidth=4; ctx.strokeStyle=healing?'#06260d':'#250108'; ctx.strokeText(f.v,f.x,f.y);
      ctx.fillStyle=healing?'#53e36f':'#ff304f'; ctx.fillText(f.v,f.x,f.y); ctx.globalAlpha=1;
    } else if (f.t === 'num'){
      ctx.globalAlpha = clamp(f.life*2,0,1);
      ctx.fillStyle = f.col || (f.crit ? '#ffd24a' : '#e8eef5');
      ctx.font = (f.crit ? 'bold 19px ' : 'bold 15px ') + 'ui-monospace,monospace';
      ctx.textAlign = 'center'; ctx.fillText(f.v, f.x, f.y); ctx.globalAlpha = 1;
    } else if (f.t === 'txt'){
      ctx.globalAlpha = clamp(f.life*2.5,0,1); ctx.fillStyle = f.col;
      ctx.font = 'bold 17px ui-monospace,monospace'; ctx.textAlign = 'center';
      ctx.fillText(f.s, f.x, f.y); ctx.globalAlpha = 1;
    }
  }
  }

  // Частицы: рисуем квадратами по целым координатам — отсюда «пиксельность»
  if (pass==='impactEffects'){
  for (const q of view.parts){
    ctx.globalAlpha = clamp(q.life/q.max, 0, 1);
    ctx.fillStyle = q.col;
    ctx.fillRect(Math.round(q.x), Math.round(q.y), q.sz, q.sz);
  }
  ctx.globalAlpha = 1;
  }

  // Круговые орбы
  if (pass==='itemsProjectiles' && D.orbitN){
    const size = ORBIT_SIZE * D.projSize;
    ctx.strokeStyle = '#6fb3ff22'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, ORBIT_R*D.aoeR, 0, 6.29); ctx.stroke();
    for (let i = 0; i < D.orbitN; i++){
      const o = orbitPos(i);
      ctx.fillStyle = '#6fb3ff44'; ctx.strokeStyle = '#6fb3ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(o.x, o.y, size, 0, 6.29); ctx.fill(); ctx.stroke();
    }
  }

  // Свита: присланные четырёхкадровые листы с тонкой ниткой к хозяину
  if (pass==='entities' || pass==='worldHud'){
  for (const m of G.minions){
    const K = MKIND[m.kind], golem = m.kind.startsWith('golem');
    // Хитбокс механики остаётся m.r; обычная свита теперь рисуется 24×24.
    const visualR = golem ? (m.kind === 'golemB' ? 12 : 9) : 12;
    if (pass==='entities'){
    ctx.strokeStyle = K.col + '22'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m.x,m.y); ctx.lineTo(p.x,p.y); ctx.stroke();
    const spriteFrame = minionSpriteFrame(m), sprite = MINION_SPRITES[m.kind];
    if (spriteFrame && sprite && sprite.complete && sprite.naturalWidth){
      const meta = spriteFrame.meta;
      ctx.save(); ctx.translate(m.x,m.y); ctx.scale(m.spriteFace||1,1);
      if (m.hit > 0){ ctx.globalAlpha = 0.82; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 5; }
      ctx.drawImage(sprite, spriteFrame.x, spriteFrame.y, spriteFrame.w, spriteFrame.h,
        -meta.drawW/2, -meta.drawH/2, meta.drawW, meta.drawH);
      ctx.restore();
    } else {
      ctx.lineWidth = golem ? 3 : 2;
      ctx.strokeStyle = m.hit > 0 ? '#ffffff' : K.col;
      ctx.fillStyle = K.col + (golem ? '33' : '22');
      drawPoly(m.x, m.y, visualR, K.sides, m.rot); ctx.fill(); ctx.stroke();
    }
    }
    if (pass==='worldHud'){
    // КРОВНЫЕ УЗЫ: пока идёт ярость, свита в красном ореоле — игрок должен
    // видеть окно удвоенного урона, а не считать секунды в уме
    if (G.bloodT > 0){
      ctx.strokeStyle = '#ff2a2a';
      ctx.globalAlpha = 0.35 + 0.35*Math.min(1, G.bloodT/3) * (0.6 + 0.4*Math.sin(G.time*11));
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, visualR + 4, 0, 6.29); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (m.kind === 'golemB'){                       // метка провокации
      ctx.strokeStyle = K.col + '44'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(m.x, m.y, 34, 0, 6.29); ctx.stroke();
    }
    if (m.hp < m.max){
      const w = visualR*2;
      ctx.fillStyle = '#000a'; ctx.fillRect(m.x-w/2, m.y-visualR-7, w, 2);
      ctx.fillStyle = K.col;   ctx.fillRect(m.x-w/2, m.y-visualR-7, w*clamp(m.hp/m.max,0,1), 2);
    }
    }
  }
  }

  // Отметка текущей цели — чтобы было видно, куда бьёт автоатака
  if (pass==='worldHud' && G.target){
    drawEnemyTargetMarker(G.target);
  }

  // Управление мышью: кольцо покоя вокруг игрока и метка курсора
  if (pass==='worldHud' && G.control === 'mouse'){
    const cursor=screenToWorld(G.mouse.x,G.mouse.y,p,sx,sy,camera);
    const stableCursor=screenToWorld(G.mouse.x,G.mouse.y,p);
    const mwx=cursor.x,mwy=cursor.y;
    const inZone=Math.hypot(stableCursor.x-p.x,stableCursor.y-p.y)<=MOUSE_DEADZONE;
    ctx.strokeStyle = inZone ? '#ffb34066' : '#ffb34022'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, MOUSE_DEADZONE, 0, 6.29); ctx.stroke();
    ctx.strokeStyle = '#ffb340aa'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mwx-7, mwy); ctx.lineTo(mwx+7, mwy);
    ctx.moveTo(mwx, mwy-7); ctx.lineTo(mwx, mwy+7); ctx.stroke();
  }

  // Копия от «Чёрного зеркала»: тот же силуэт, но полупрозрачный и фиолетовый
  if (pass==='entities' && G.clone){
    const c = G.clone;
    ctx.globalAlpha = 0.35 + 0.25*Math.sin(G.time*9);
    ctx.strokeStyle = '#c08cff'; ctx.fillStyle = '#c08cff22'; ctx.lineWidth = 3;
    drawPoly(c.x, c.y, p.r, 4, 0.785); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(c.aim)*(p.r+11), c.y + Math.sin(c.aim)*(p.r+11)); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Тень между мирами — только силуэт и координата цели: у неё намеренно нет
  // полосы HP, реакции на попадание и посмертного эффекта.
  if (pass==='entities' && G.worldShadow){
    const s=G.worldShadow;
    ctx.globalAlpha=0.18+0.18*Math.sin(G.time*14);
    ctx.strokeStyle='#9f7aea'; ctx.fillStyle='#6b46c133'; ctx.lineWidth=2;
    drawPoly(s.x,s.y,s.r,4,0.785); ctx.fill(); ctx.stroke();
    ctx.globalAlpha=1;
  }
  // Барьер «Талисмана покоя»: толщина кольца показывает остаток
  if (pass==='worldHud' && totalPlayerBarrier(p) > 0){
    ctx.strokeStyle = '#5ec2e0'; ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2 + 4*clamp(totalPlayerBarrier(p)/(D.life*0.12), 0, 1);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r+9, 0, 6.29); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Щит УЖАСАЮЩЕГО ВАМПИРА: красное кольцо становится толще по мере наполнения.
  if (pass==='worldHud' && p.dreadShield > 0){
    ctx.strokeStyle = '#cf2135'; ctx.globalAlpha = 0.82;
    ctx.lineWidth = 2 + 5*clamp(p.dreadShield/(D.life*DREAD_SHIELD_CAP), 0, 1);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r+16, 0, 6.29); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Заряд «Сердца голема» готов — тусклое серое кольцо
  if (pass==='worldHud' && amu('golem') && G.amuT.golem <= 0){
    ctx.strokeStyle = '#9aa7b4'; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r+14, 0, 6.29); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (pass==='worldHud' && p.bossSlowT > 0){
    ctx.strokeStyle='#c56a52'; ctx.globalAlpha=0.7; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+12+2*Math.sin(G.time*10),0,6.29); ctx.stroke(); ctx.globalAlpha=1;
  }
  if (pass==='worldHud' && p.bossBurnT > 0){
    ctx.strokeStyle='#ff5a28'; ctx.globalAlpha=0.65+0.25*Math.sin(G.time*16); ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+7,0,6.29); ctx.stroke(); ctx.globalAlpha=1;
  }
  if (pass==='worldHud' && p.elitePoisonT > 0){
    ctx.strokeStyle='#8bd346'; ctx.globalAlpha=0.72; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+18,0,Math.PI*2*clamp(p.elitePoisonT/4,0,1)); ctx.stroke();
    ctx.globalAlpha=1; ctx.fillStyle='#b9ee72'; ctx.font='bold 9px ui-monospace,monospace';
    ctx.textAlign='center'; ctx.fillText('×'+p.elitePoisonStacks,p.x,p.y+p.r+23);
  }
  if (pass==='worldHud' && p.eliteCutT > 0){
    ctx.strokeStyle='#ef5b62'; ctx.globalAlpha=0.78; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+14,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(p.eliteCutT/4,0,1)); ctx.stroke();
    ctx.globalAlpha=1;
  }
  if (pass==='worldHud' && p.elitePyroBurnT > 0){
    ctx.strokeStyle='#ff8a32'; ctx.globalAlpha=0.72+0.20*Math.sin(G.time*18); ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+10,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(p.elitePyroBurnT/4,0,1)); ctx.stroke(); ctx.globalAlpha=1;
  }
  if (pass==='worldHud' && p.eliteAbyssBurnT > 0){
    ctx.strokeStyle='#ff3b20'; ctx.globalAlpha=0.78; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(p.eliteAbyssBurnT,0,1)); ctx.stroke(); ctx.globalAlpha=1;
  }
  if (pass==='worldHud' && p.eliteGuardSlowT > 0){
    ctx.strokeStyle='#9aa7b4'; ctx.globalAlpha=0.76; ctx.lineWidth=2+p.eliteGuardSlowStacks*0.25;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+22,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(p.eliteGuardSlowT/6,0,1)); ctx.stroke();
    ctx.globalAlpha=1; ctx.fillStyle='#c4ccd4'; ctx.font='bold 9px ui-monospace,monospace'; ctx.textAlign='center';
    ctx.fillText('×'+p.eliteGuardSlowStacks,p.x,p.y+p.r+30);
  }

  if (pass==='entities') drawHero(p);
  if (pass==='worldHud') drawPlayerHealthBar(p);

  ctx.restore();
}
