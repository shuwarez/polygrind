/* Динамические подсказки: точный прогноз «текущий билд → после карточки» без мутации игры. */
const fs = require('fs');
const {loadGame} = require('./sim');
const ok = (nm, cond, det) => console.log((cond ? '  ✓ ' : '  ✗ ') + nm.padEnd(60) + (det || ''));
const near = (a,b,eps=1e-8) => Math.abs(a-b)<eps;
const card = (c,id,v) => { const m=c.__api.MODS.find(x=>x.id===id); return {m,v,val:(m.kind==='flag'?'':'+')+v}; };
const row = (data,key) => data.rows.find(x=>x.key===key);

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const x=card(c,'dmg.flat_all',5), data=c.cardImpactData(x.m,x);
  ok('плоский урон показывает средний удар до и после', row(data,'hit') && row(data,'hit').after>row(data,'hit').before,
    row(data,'hit').before.toFixed(2)+' → '+row(data,'hit').after.toFixed(2));
  ok('плоский урон показывает ориентир DPS', row(data,'dps') && row(data,'dps').after>row(data,'dps').before,
    row(data,'dps').before.toFixed(2)+' → '+row(data,'dps').after.toFixed(2));
  const predicted=row(data,'hit').after;
  c.__api.G.bag.add(x.m.stat,x.m.kind,x.v); c.recalc();
  ok('прогноз совпадает с каноническим recalc после выбора', near(predicted,c.attackAvgHit()),
    predicted.toFixed(5)+' / '+c.attackAvgHit().toFixed(5)); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, x=card(c,'dmg.inc_all',20), bag=JSON.stringify(G.bag.s), hp=G.player.hp;
  const hit=c.attackAvgHit(), dps=hit/c.__api.D.atkCd;
  c.cardImpactData(x.m,x);
  ok('расчёт не изменяет сумку игрока', JSON.stringify(G.bag.s)===bag);
  ok('расчёт не изменяет HP и текущие показатели', G.player.hp===hp && near(c.attackAvgHit(),hit) && near(c.attackAvgHit()/c.__api.D.atkCd,dps)); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const G=c.__api.G, x=card(c,'key.glass_cannon',1), hp=G.player.hp, life=c.__api.D.life;
  c.cardImpactData(x.m,x);
  ok('проекция кейстоуна возвращает здоровье после временного recalc', G.player.hp===hp && c.__api.D.life===life,
    G.player.hp+' / '+hp); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const x=card(c,'spd.attack',8), data=c.cardImpactData(x.m,x);
  ok('скорость атаки показывает DPS и атаки/сек, но не выдумывает силу удара',
    !row(data,'hit') && row(data,'dps') && row(data,'stat:aspd') && row(data,'dps').after>row(data,'dps').before); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const x=card(c,'crit.chance_flat',6), data=c.cardImpactData(x.m,x), chance=row(data,'stat:critCh');
  ok('крит показывает шанс 5% → 11% и рост среднего удара', chance && chance.before===5 && chance.after===11 && row(data,'hit').after>row(data,'hit').before,
    chance.before+'% → '+chance.after+'%'); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); c.setLanguage('ru');
  c.__api.G.bag.add('critCh','flat',5); c.recalc();
  const x=card(c,'crit.chance_inc',40), html=c.cardInlineExample(x.m,x);
  ok('процентный крит прямо на карточке показывает текущий шанс, бонус и итог',
    html.includes('10% крита +40% = 14% крита') && html.includes('ПРИМЕР'));
  ok('встроенный пример выводится только на процентной карточке крита',
    c.cardInlineExample(card(c,'crit.chance_flat',6).m,card(c,'crit.chance_flat',6))===''); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const x=card(c,'cond.vs_low_hp',5); c.__api.G.bag.add('vsLow','inc',10);
  const data=c.cardImpactData(x.m,x), r=row(data,'conditionalHit');
  const raw=c.attackAvgHit()/(1+c.__api.D.incAll/100), want=raw*0.05;
  ok('условная карточка учитывает уже собранный бонус и точную прибавку', r && near(r.after-r.before,want),
    '+'+(r.after-r.before).toFixed(4)+' / +'+want.toFixed(4));
  const nearCard=card(c,'cond.per_enemy_near',5), crowd=row(c.cardImpactData(nearCard.m,nearCard),'conditionalHit');
  ok('урон за врагов показывает наглядный сценарий с восемью целями', crowd && near(crowd.after-crowd.before,want*8),
    '+'+(crowd.after-crowd.before).toFixed(4)); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const x=card(c,'shape.proj_count',1), data=c.cardImpactData(x.m,x);
  ok('дополнительный снаряд показывает 1 → 2 и удвоенный максимум залпа',
    row(data,'projectiles').before===1 && row(data,'projectiles').after===2 &&
    near(row(data,'volley').after,row(data,'volley').before*2));
  ok('подсказка залпа предупреждает про попадание всех снарядов', data.notes.some(x=>/every projectile|все снаряд/i.test(x))); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('necro','keys');
  const x=card(c,'min.damage',30), data=c.cardImpactData(x.m,x);
  ok('карточка свиты показывает удар приспешника и DPS армии',
    row(data,'minionHit') && row(data,'minionDps') && row(data,'minionHit').after>row(data,'minionHit').before); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const x=card(c,'shape.double_hit',5), data=c.cardImpactData(x.m,x);
  ok('двойное попадание показывает шанс и ожидаемый DPS',
    row(data,'doubleChance') && row(data,'doubleDps') && row(data,'doubleDps').after>row(data,'doubleDps').before); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const x=card(c,'dmg.pct_enemy_hp',2), r=row(c.cardImpactData(x.m,x),'enemyHpBonus');
  ok('% от HP врага переводится в урон на примере 1000 max HP', r && r.before===0 && r.after===20,
    r.before+' → '+r.after); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('blade','keys');
  const x=card(c,'shape.orbit',1), data=c.cardImpactData(x.m,x);
  ok('Круговой орб показывает число орбов и конкретный урон касания',
    row(data,'orbits') && row(data,'orbitTouch') && row(data,'orbitTouch').after>0); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); c.setLanguage('ru');
  c.innerWidth=1280; c.innerHeight=720;
  const x=card(c,'dmg.flat_all',5), html=c.cardImpactPreview(x.m,x);
  ok('русская подсказка содержит заметный блок, стрелку и текущие цифры',
    html.includes('ЕСЛИ ВЫБРАТЬ СЕЙЧАС') && html.includes('→') && html.includes('Средний урон'));
  c.showSkillTip({clientX:10,clientY:10},x);
  ok('динамический расчёт встроен в настоящий тултип карточки', c.document.getElementById('skilltip').innerHTML.includes('tt-impact-row')); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const x=card(c,'dmg.flat_all',5), html=c.cardImpactPreview(x.m,x);
  ok('английская динамическая подсказка не содержит русского текста',
    html.includes('IF YOU PICK THIS NOW') && !/[А-Яа-яЁё]/.test(html));
  const execute=card(c,'dmg.execute',1);
  ok('уникальное правило без числового роста не получает ложный DPS', c.cardImpactData(execute.m,execute).rows.length===0); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const x=card(c,'dmg.flat_all',5), ov=c.document.getElementById('ov'), tip=c.document.getElementById('skilltip');
  c.innerWidth=1280; c.innerHeight=720;
  ok('подробные подсказки включены по умолчанию', c.skillTipsEnabled()===true);
  c.showLevelUp();
  ok('переключатель расположен под кнопкой переброса',
    ov.innerHTML.indexOf('id="rr"')>=0 && ov.innerHTML.indexOf('id="skilltips-toggle"')>ov.innerHTML.indexOf('id="rr"') &&
    ov.innerHTML.includes('ПОДРОБНЫЕ ПОДСКАЗКИ: ВКЛ'));
  c.setSkillTipsEnabled(false); c.showSkillTip({clientX:10,clientY:10},x);
  ok('отключение сразу скрывает и блокирует большой тултип', c.skillTipsEnabled()===false && tip.style.display==='none');
  c.setSkillTipsEnabled(true); c.showSkillTip({clientX:10,clientY:10},x);
  ok('повторное включение возвращает подробный тултип', c.skillTipsEnabled()===true && tip.style.display==='block');
  ok('надписи переключателя имеют английский перевод',
    c.tr('ПОДРОБНЫЕ ПОДСКАЗКИ: ВКЛ')==='DETAILED TOOLTIPS: ON' &&
    c.tr('ПОДРОБНЫЕ ПОДСКАЗКИ: ВЫКЛ')==='DETAILED TOOLTIPS: OFF'); }

{ const html=fs.readFileSync('./PolyGrind.html','utf8');
  ok('настройка подсказок сохраняется отдельно от прогресса',
    html.includes("localStorage.getItem(SKILL_TIPS_KEY)") && html.includes("localStorage.setItem(SKILL_TIPS_KEY")); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const source=c.__api.MODS.find(m=>m.id==='shape.double_hit');
  const links=c.linkedUnlocksForCards([source]);
  ok('карточка потолка находит свой связанный навык',
    links.length===1 && links[0].targetMod.id==='shape.deadly_hit' && links[0].at===25); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); c.setLanguage('ru');
  c.__api.G.bag.add('dblHit','chance',24); c.recalc();
  const source=c.__api.MODS.find(m=>m.id==='shape.double_hit');
  const links=c.linkedUnlocksForCards([{m:source}]);
  const html=c.levelUnlockPanelHtml([{m:source}],links);
  ok('панель показывает текущий прогресс до порога', links[0].value===24 && html.includes('24 / 25%'), html.match(/24 \/ 25%/)?.[0]);
  ok('панель находится между карточками и кнопками уровня',
    fs.readFileSync('./PolyGrind.html','utf8').includes("</div>' + levelUnlockPanelHtml(rolled, linkedUnlocks) +\n    '<div class=\"level-actions\"")); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('necro','keys');
  const source=c.__api.MODS.find(m=>m.id==='min.damage');
  const links=c.linkedUnlocksForCards([source]);
  ok('одна ветка показывает все три последовательных открытия свиты',
    links.map(x=>x.targetMod.id).join(',')==='min.frenzy,min.bloodbath,min.boiling' && links.map(x=>x.at).join(',')==='50,75,100'); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const flat=c.__api.MODS.find(m=>m.id==='crit.chance_flat'), inc=c.__api.MODS.find(m=>m.id==='crit.chance_inc');
  const links=c.linkedUnlocksForCards([flat,inc]);
  ok('одинаковое открытие от двух карточек не дублируется', links.length===1 && links[0].targetMod.id==='crit.super_chance'); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
  const source=c.__api.MODS.find(m=>m.id==='shape.double_hit');
  c.__api.G.bag.add('deadlyHit','flag',1); c.__api.G.picks.push({id:'shape.deadly_hit'}); c.recalc();
  ok('уже взятый одноразовый связанный навык скрывается', c.linkedUnlocksForCards([source]).length===0); }

{ const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys'); c.setLanguage('ru');
  c.innerWidth=1280; c.innerHeight=720;
  const source=c.__api.MODS.find(m=>m.id==='shape.double_hit'), links=c.linkedUnlocksForCards([source]);
  const html=c.levelUnlockPanelHtml([source],links), ov=c.document.getElementById('ov'), tip=c.document.getElementById('skilltip');
  ok('связанный навык доступен мыши и клавиатурному фокусу',
    html.includes('data-linked-skill="0"') && html.includes('tabindex="0"') && html.includes('aria-describedby="skilltip"'));
  ov.innerHTML=html;
  const el=c.document.querySelector('#ov .level-unlock'), preview=c.linkedSkillPreviewCard(links[0].targetMod);
  c.showSkillTip({clientX:30,clientY:30},preview,{note:'Связанный навык'});
  ok('наведение открывает подробную подсказку будущего навыка',
    !!el && tip.style.display==='block' && tip.innerHTML.includes('СМЕРТОНОСНОЕ ПОПАДАНИЕ') &&
    fs.readFileSync('./PolyGrind.html','utf8').includes('el.onmouseenter = ev => showSkillTip(ev, preview, {note})'));
  c.setSkillTipsEnabled(false);
  if (el && el.onfocus) el.onfocus();
  ok('выключенные подробные подсказки блокируют панельный тултип', tip.style.display==='none'); }

{ const c=loadGame('./PolyGrind.html');
  ok('новые подписи панели имеют английский перевод',
    c.tr('СВЯЗАННЫЕ НАВЫКИ')==='RELATED SKILLS' && c.tr('наведите для подробностей')==='hover for details' && c.tr('ОТКРЫТО')==='UNLOCKED'); }
