/* Фиксированный порядок Canvas-проходов и изоляция ключевых типов отрисовки. */
const fs=require('fs');
const {loadGame}=require('./sim');
const html=fs.readFileSync('./PolyGrind.html','utf8');
const ok=(nm,cond,det)=>console.log((cond?'  ✓ ':'  ✗ ')+nm.padEnd(56)+(det||''));

const c=loadGame('./PolyGrind.html'); c.newGame('bow','keys');
const calls=[];
c.renderCanvasPass=pass=>calls.push(pass);
c.updateHud=()=>calls.push('domHud');
c.render();
const expected=['ground','telegraphs','floorEffects','itemsProjectiles','entities','impactEffects','worldHud','combatText','bossHud','domHud'];
ok('render вызывает проходы в фиксированном порядке',calls.join(',')===expected.join(','),calls.join(' → '));
ok('фон и пол идут первыми',calls[0]==='ground');
ok('телеграфы находятся под напольными опасностями',calls.indexOf('telegraphs')<calls.indexOf('floorEffects'));
ok('предметы и снаряды рисуются до персонажей',calls.indexOf('itemsProjectiles')<calls.indexOf('entities'));
ok('impact effects рисуются после тел персонажей',calls.indexOf('entities')<calls.indexOf('impactEffects'));
ok('мировой HUD гарантированно выше частиц',calls.indexOf('impactEffects')<calls.indexOf('worldHud'));
ok('combat text гарантированно выше мирового HUD',calls.indexOf('worldHud')<calls.indexOf('combatText'));
ok('Boss HUD композится после мира и до DOM HUD',calls.indexOf('combatText')<calls.indexOf('bossHud') && calls.indexOf('bossHud')<calls.indexOf('domHud'));
ok('DOM HUD обновляется после всех Canvas-проходов',calls.at(-1)==='domHud');

ok('очистка Canvas разрешена только ground-проходу',/pass==='ground' && !floorCoversView/.test(html));
ok('предупреждения боссов изолированы в telegraphs',/if \(pass==='telegraphs'\)\{[\s\S]{0,400}\/\/ Все активные замахи/.test(html));
ok('таран элиты также перенесён в telegraphs',/pass==='telegraphs' && e\.affT\.warn > 0/.test(html));
ok('частицы и числа разделены по разным проходам',/pass==='impactEffects'\)\{\s*for \(const q of G\.parts\)/.test(html) &&
   /pass==='combatText'\)\{\s*for \(const f of G\.fx\)/.test(html));
