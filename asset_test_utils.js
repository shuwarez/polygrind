/* Общие проверки встроенных растров после перевода автономного HTML на WebP. */
'use strict';

function imageInfo(buf){
  if(!Buffer.isBuffer(buf)||buf.length<24)return{format:'',w:0,h:0,alpha:false,lossless:false};
  if(buf.subarray(0,8).toString('hex')==='89504e470d0a1a0a'){
    return{format:'png',w:buf.readUInt32BE(16),h:buf.readUInt32BE(20),alpha:[4,6].includes(buf[25]),
      lossless:true,color:buf[25],depth:buf[24]};
  }
  if(buf.subarray(0,4).toString()==='RIFF'&&buf.subarray(8,12).toString()==='WEBP'){
    const chunk=buf.subarray(12,16).toString();
    if(chunk==='VP8L'&&buf.length>=25&&buf[20]===0x2f){
      const b1=buf[21],b2=buf[22],b3=buf[23],b4=buf[24];
      return{format:'webp',chunk,w:1+(b1|((b2&0x3f)<<8)),h:1+(((b2&0xc0)>>6)|(b3<<2)|((b4&0x0f)<<10)),
        alpha:!!(b4&0x10),lossless:true};
    }
    if(chunk==='VP8X'&&buf.length>=30){
      const u24=i=>buf[i]|(buf[i+1]<<8)|(buf[i+2]<<16);
      return{format:'webp',chunk,w:1+u24(24),h:1+u24(27),alpha:!!(buf[20]&0x10),lossless:false};
    }
    if(chunk==='VP8 '&&buf.length>=30){
      return{format:'webp',chunk,w:buf.readUInt16LE(26)&0x3fff,h:buf.readUInt16LE(28)&0x3fff,alpha:false,lossless:false};
    }
  }
  return{format:'',w:0,h:0,alpha:false,lossless:false};
}

function embeddedImage(source,key){
  const escaped=String(key).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=source.match(new RegExp('\\b'+escaped+"\\s*[:=]\\s*'data:image\\/(png|webp);base64,([^']+)'"));
  return match?{mime:match[1],buffer:Buffer.from(match[2],'base64')}:null;
}

function embeddedObjectImage(source,objectName,key){
  const block=source.match(new RegExp('const '+objectName+' = \\{([\\s\\S]*?)\\n\\};'));
  return block?embeddedImage(block[1],key):null;
}

module.exports={imageInfo,embeddedImage,embeddedObjectImage};
