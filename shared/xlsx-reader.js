/* Đọc XLSX xuất bởi HIS: ZIP + XML bằng API trình duyệt, không tải thư viện ngoài. */
(function(){'use strict';
 async function readWorkbook(buffer){
  const bytes=new Uint8Array(buffer),view=new DataView(buffer);let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw Error('Không nhận diện được file Excel XLSX.');
  const count=view.getUint16(end+10,true),decoder=new TextDecoder();let cursor=view.getUint32(end+16,true);const entries=new Map();
  for(let i=0;i<count;i++){
   if(view.getUint32(cursor,true)!==0x02014b50)throw Error('ZIP không hợp lệ.');
   const method=view.getUint16(cursor+10,true),size=view.getUint32(cursor+20,true),rawSize=view.getUint32(cursor+24,true),len=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),offset=view.getUint32(cursor+42,true);
   const name=decoder.decode(bytes.subarray(cursor+46,cursor+46+len));if(rawSize>100*1024*1024)throw Error('Sheet quá lớn để đọc trên trình duyệt.');entries.set(name,{method,size,offset});cursor+=46+len+extra+comment;
  }
  async function xml(name){const e=entries.get(name);if(!e)return null;const offset=e.offset;const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);const raw=bytes.slice(start,start+e.size);let decoded;
   if(e.method===0)decoded=raw;else if(e.method===8){const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));decoded=new Uint8Array(await new Response(stream).arrayBuffer());}else throw Error('Kiểu nén XLSX chưa hỗ trợ.');
   const doc=new DOMParser().parseFromString(decoder.decode(decoded),'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('XML Excel không hợp lệ.');return doc;
  }
  const tags=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
  const ss=await xml('xl/sharedStrings.xml');const strings=ss?tags(ss,'si').map(si=>tags(si,'t').map(t=>t.textContent).join('')):[];
  const workbook=await xml('xl/workbook.xml'),rels=await xml('xl/_rels/workbook.xml.rels');if(!workbook||!rels)throw Error('Thiếu workbook XLSX.');
  const relation=new Map(tags(rels,'Relationship').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));const sheets=[];
  for(const sheet of tags(workbook,'sheet')){
   const ref=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');const target=relation.get(ref);if(!target)continue;
   const path=target.startsWith('/')?target.slice(1):new URL(target,'https://xlsx.local/xl/').pathname.slice(1);const doc=await xml(path);if(!doc)continue;
   const matrix=tags(doc,'row').map(row=>{const cells=[];for(const c of tags(row,'c')){const ref=c.getAttribute('r')||'A';let index=0;for(const char of ref.match(/^[A-Z]+/)[0])index=index*26+char.charCodeAt(0)-64;const type=c.getAttribute('t'),value=tags(c,'v')[0]?.textContent;let parsed;
    if(type==='s')parsed=strings[Number(value)]??'';else if(type==='inlineStr')parsed=tags(c,'t').map(t=>t.textContent).join('');else if(type==='b')parsed=value==='1';else if(value===undefined)parsed=null;else if(type==='str'||type==='e'||type==='d')parsed=value;else parsed=Number(value);cells[index-1]=parsed;}return cells;});
   const first=matrix.findIndex(row=>row.some(v=>v!==null&&v!==undefined&&v!==''));if(first<0){sheets.push({name:sheet.getAttribute('name'),rows:[]});continue;}
   const header=matrix[first];const seen=new Map();const keys=Array.from({length:header.length},(_,i)=>{const name=String(header[i]??`column_${i+1}`);const n=(seen.get(name)||0)+1;seen.set(name,n);return n>1?name+'_'+n:name;});
   sheets.push({name:sheet.getAttribute('name'),rows:matrix.slice(first+1).filter(r=>r.some(v=>v!==null&&v!==undefined&&v!=='')).map(row=>Object.fromEntries(keys.map((k,i)=>[k,row[i]??null])))});
  }return sheets;
 }
 window.IsofhXlsx={readWorkbook};
})();
