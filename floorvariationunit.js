/* Десять бесшовных вариантов пола и независимый выбор на каждом buildFloor(). */
const fs=require('fs'),crypto=require('crypto'),zlib=require('zlib');
const {loadGame}=require('./harness');
let n=0,fail=0;
function ok(name,yes,got=''){n++;if(!yes)fail++;console.log((yes?'  \u2713 ':'  \u2717 ')+name.padEnd(72)+got);}

function decodeIndexedPng(buffer){
  let off=8,ihdr=null,palette=null;const idat=[];
  while(off<buffer.length){
    const len=buffer.readUInt32BE(off),type=buffer.toString('ascii',off+4,off+8),data=buffer.subarray(off+8,off+8+len);
    if(type==='IHDR')ihdr={w:data.readUInt32BE(0),h:data.readUInt32BE(4),depth:data[8],color:data[9],interlace:data[12]};
    else if(type==='PLTE')palette=data;
    else if(type==='IDAT')idat.push(data);
    off+=12+len;
    if(type==='IEND')break;
  }
  if(!ihdr||ihdr.depth!==8||ihdr.color!==3||!palette)throw new Error('expected 8-bit indexed PNG');
  const packed=zlib.inflateSync(Buffer.concat(idat)),rows=[],stride=ihdr.w,bpp=1;
  let pos=0,prev=Buffer.alloc(stride);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<ihdr.h;y++){
    const filter=packed[pos++],src=packed.subarray(pos,pos+stride),row=Buffer.alloc(stride);pos+=stride;
    for(let x=0;x<stride;x++){
      const a=x>=bpp?row[x-bpp]:0,b=prev[x],c=x>=bpp?prev[x-bpp]:0;
      const add=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):NaN;
      if(!Number.isFinite(add))throw new Error('unsupported filter '+filter);
      row[x]=(src[x]+add)&255;
    }
    rows.push(row);prev=row;
  }
  return {...ihdr,palette,rows};
}
function edgeError(png){
  let error=0;
  for(const row of png.rows)error=Math.max(error,Math.abs(row[0]-row[png.w-1]));
  for(let x=0;x<png.w;x++)error=Math.max(error,Math.abs(png.rows[0][x]-png.rows[png.h-1][x]));
  return error;
}
function luma(png){
  let total=0,count=0;
  for(const row of png.rows)for(const index of row){
    const at=index*3,r=png.palette[at],g=png.palette[at+1],b=png.palette[at+2];
    total+=0.2126*r+0.7152*g+0.0722*b;count++;
  }
  return total/count;
}

const html=fs.readFileSync('./PolyGrind.html','utf8');
let randomCalls=0;
const c=loadGame('./PolyGrind.html',{random:()=>{randomCalls++;return 0.25;}}),floor=c.__api.FLOOR_TEXTURES;
const expectedNames=['slate','cracked','damp','temple','basalt','iron','ash','crystal','forge','frost'];
const buffers=floor.data.map(uri=>Buffer.from(uri.slice(uri.indexOf(',')+1),'base64'));
const decoded=buffers.map(decodeIndexedPng);

ok('в HTML встроено ровно десять вариантов пола',floor.data.length===10,String(floor.data.length));
ok('пять handoff-вариантов и пять авторских имеют стабильные имена',JSON.stringify(floor.names)===JSON.stringify(expectedNames));
ok('все десять data URI являются PNG',floor.data.every(x=>x.startsWith('data:image/png;base64,')));
ok('все изображения уникальны',new Set(buffers.map(x=>crypto.createHash('sha256').update(x).digest('hex'))).size===10);
ok('каждая текстура имеет точный размер 512x512',decoded.every(x=>x.w===512&&x.h===512));
ok('каждая текстура хранится как индексированный PNG',decoded.every(x=>x.color===3));
ok('индексы палитры имеют глубину 8 бит',decoded.every(x=>x.depth===8));
ok('PNG не используют interlace',decoded.every(x=>x.interlace===0));
ok('каждый встроенный PNG меньше 220 КБ',buffers.every(x=>x.length<220*1024),String(Math.max(...buffers.map(x=>x.length))));
const lumas=decoded.map(luma);
ok('яркость десяти полов выровнена',Math.min(...lumas)>40&&Math.max(...lumas)<43,lumas.map(x=>x.toFixed(1)).join(','));
ok('левый и правый края всех тайлов совпадают',decoded.every(x=>x.rows.every(row=>row[0]===row[x.w-1])));
ok('верхний и нижний края всех тайлов совпадают',decoded.every(x=>x.rows[0].equals(x.rows[x.h-1])));
ok('общая проверка шва даёт нулевую ошибку',decoded.every(x=>edgeError(x)===0));

const files=fs.readdirSync('./floor_textures').filter(x=>x.endsWith('.png')).sort();
ok('в floor_textures сохранены все десять рабочих PNG',files.length===10,String(files.length));
ok('рабочие PNG побайтно совпадают со встроенными data URI',files.every((name,i)=>fs.readFileSync('./floor_textures/'+name).equals(buffers[i])));

const before=randomCalls;
for(let i=0;i<10;i++){c.__api.selectFloorTexture(i);if(c.__api.FLOOR_TEXTURES.index!==i)fail++;}
ok('принудительный тестовый выбор покрывает индексы 0..9',c.__api.FLOOR_TEXTURES.index===9);
ok('выбор пола не расходует игровой Math.random',randomCalls===before,String(randomCalls-before));
c.__api.selectFloorTexture(-1);
ok('индекс пола безопасно нормализуется по модулю',c.__api.FLOOR_TEXTURES.index===9,String(c.__api.FLOOR_TEXTURES.index));

ok('buildFloor выбирает поверхность ровно один раз в начале',/function buildFloor\(\)\{\s*\/\/[\s\S]{0,180}?selectRandomFloorPattern\(\);/.test(html));
const renderBlock=(html.match(/function renderCanvasPass[\s\S]*?\nfunction render\(/)||[''])[0];
ok('render-pass не пересчитывает выбор поверхности',!renderBlock.includes('selectRandomFloorPattern'));
ok('готовый pattern создаётся только при загрузке изображения',(html.match(/ctx\.createPattern\(/g)||[]).length===1&&/image\.onload = \(\) => \{\s*FLOOR_PATTERNS\[i\] = createFloorPattern\(image\)/.test(html));
ok('при незагруженном выбранном тайле используется первый готовый pattern',/FLOOR_PATTERNS\.findIndex\(Boolean\)/.test(html));
ok('масштабирование тайла сохраняет pixel-perfect режим',/function createFloorPattern[\s\S]{0,420}?imageSmoothingEnabled = false/.test(html));

console.log(JSON.stringify({n,fail}));
process.exitCode=fail?1:0;
