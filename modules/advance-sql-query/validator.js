(function(root){
 'use strict';
 function validate(input){
  if(input.length>200000)throw Error('SQL quá dài (tối đa 200.000 ký tự).');
  const tokens=[];let i=0;
  while(i<input.length){
   const c=input[i];if(/\s/.test(c)){i++;continue;}
   if(input.startsWith('--',i)){const end=input.indexOf('\n',i);i=end<0?input.length:end+1;continue;}
   if(input.startsWith('/*',i)){let depth=1;i+=2;while(i<input.length&&depth){if(input.startsWith('/*',i)){depth++;i+=2;}else if(input.startsWith('*/',i)){depth--;i+=2;}else i++;}if(depth)throw Error('Comment chưa đóng.');continue;}
   if(c==="'"||c==='"'){const quote=c;let value='',closed=false;i++;while(i<input.length){if(input[i]===quote){if(input[i+1]===quote){value+=quote;i+=2;}else{i++;closed=true;break;}}else{if(input[i]==='\\'&&quote==="'")throw Error('Không hỗ trợ escape backslash trong chuỗi; dùng hai dấu nháy đơn.');value+=input[i++];}}if(!closed)throw Error('Chuỗi/identifier chưa đóng.');tokens.push({type:quote==='"'?'quoted':'string',value});continue;}
   if(c==='$')throw Error('Không hỗ trợ dollar quote / tham số $ trong console này.');
   const word=input.slice(i).match(/^[a-zA-Z_][a-zA-Z_0-9$]*/);if(word){tokens.push({type:'word',value:word[0].toLowerCase()});i+=word[0].length;continue;}
   tokens.push({type:'symbol',value:c});i++;
  }
  if(tokens.at(-1)?.value===';'&&tokens.at(-1)?.type==='symbol')tokens.pop();
  if(!tokens.length||tokens[0].type!=='word'||!['select','with'].includes(tokens[0].value))throw Error('Chỉ cho phép SELECT hoặc WITH … SELECT.');
  const denied=new Set('insert update delete merge truncate create alter drop reindex vacuum grant revoke call do copy into lock execute prepare deallocate set reset analyze refresh'.split(' '));
  let depth=0,topSelect=false;
  tokens.forEach((t,n)=>{
   if(t.type==='symbol'&&t.value===';')throw Error('Chỉ chạy một câu SQL.');
   if(t.type==='word'&&denied.has(t.value))throw Error('Không cho phép từ khóa '+t.value.toUpperCase()+'.');
   if(t.type==='word'&&t.value==='for'&&['update','share','no','key'].includes(tokens[n+1]?.value))throw Error('Không cho phép khóa bản ghi.');
   if(t.type==='word'&&t.value==='select'&&depth===0)topSelect=true;
   if(t.value==='('&&t.type==='symbol'){
    // Function permissions and semantics are validated by the HIS service.
    depth++;
   }if(t.value===')'&&t.type==='symbol'){depth--;if(depth<0)throw Error('Ngoặc không cân bằng.');}
  });
  if(depth||!topSelect)throw Error('Cần SELECT cấp ngoài và ngoặc cân bằng.');
  // Remove only the optional terminal semicolon; trailing comments are kept.
  let sql=input.trim();
  // Tokenize position independently is unnecessary: replacing final delimiter before comments is safe after validation.
  sql=sql.replace(/;(?=\s*(?:(?:--[^\n]*(?:\n|$))|(?:\/\*[\s\S]*?\*\/)|\s)*$)/,'');
  return sql;
 }
 root.SqlReadOnly={validate};if(typeof module!=='undefined')module.exports=root.SqlReadOnly;
})(typeof window==='undefined'?globalThis:window);
