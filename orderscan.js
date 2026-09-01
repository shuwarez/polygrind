/* Ищем в recalc() другие чтения D.x до присвоения D.x — та же ловушка,
   что была с ядом: D живёт между вызовами, поэтому баг молчит. */
const fs = require('fs');
const src = fs.readFileSync('./index.html','utf8');
const body = src.match(/function recalc\(\)\{([\s\S]*?)\n\}/)[1];
const assigned = new Set();
let bad = [];
body.split('\n').forEach((ln, i) => {
  const reads = [...ln.matchAll(/D\.([A-Za-z_]\w*)/g)].map(m => m[1]);
  const asg   = [...ln.matchAll(/D\.([A-Za-z_]\w*)\s*=[^=]/g)].map(m => m[1]);
  for (const r of reads){
    if (asg.includes(r)) continue;                 // само присвоение
    if (!assigned.has(r)) bad.push([i+1, r, ln.trim().slice(0,80)]);
  }
  for (const a of asg) assigned.add(a);
});
if (!bad.length) console.log('чисто: в recalc() нет чтений D.x до присвоения');
else for (const [ln, name, txt] of bad) console.log('строка', ln, '· читает D.' + name + ' до присвоения ·', txt);
