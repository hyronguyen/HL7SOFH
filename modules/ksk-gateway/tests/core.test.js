import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {generateKeyPairSync,createVerify} from 'node:crypto';
import {catalogServiceCodes,buildAdult,xmlString,normalizeCls,mapLisCls,selectCls,validId,dateText,truncateBytes,envelope,sha256Hex,clsQuery,childCatalogQuery,hospitalQuery,gatewayLoginToken} from '../core.js';
const require=createRequire(import.meta.url),{targetPolicy}=require('../server.cjs');
const dto={id:1,maHoSo:'HS_TEST',tenNb:'Người & <Test>',coSoKcbId:1,maGln:'GLN_TEST',ngaySinh:'1990-01-01T00:00:00+07:00',gioiTinh:1,dsDoiTuongKsk:[13,17],tienSu:{tsbtMaBenh:'A00'},khamLamSang:{khongKinhMatPhai:'0.8'},tuVan:{phanLoaiSk:1},huyetApTamThu:120,huyetApTamTruong:80};
const row={ma_dich_vu:'23.0051.1494',ma_chi_so:'040CreS',ket_qua:'0.68',don_vi_do:'Lần',nhom_chi_phi_bh:1};
test('adult schema, enums, escaping and current CLS semantics',()=>{const cls=normalizeCls([row],s=>s);const doc=buildAdult(dto,{ma:'TEST',maGln:'GLN_TEST'},{loai:30},cls);const xml=xmlString(doc);
 assert.match(xml,/<TYPE>Adult<\/TYPE>/);assert.match(xml,/<HO_TEN>Người &amp; &lt;Test&gt;<\/HO_TEN>/);assert.match(xml,/<MA_CHI_SO>040CreS<\/MA_CHI_SO>/);assert.match(xml,/<DON_VI_DO>Lần<\/DON_VI_DO>/);assert.match(xml,/<KET_LUAN>\.<\/KET_LUAN>/);assert.match(xml,/<KHONG_KINH_MAT_PHAI>8<\/KHONG_KINH_MAT_PHAI>/);assert.match(xml,/<DOI_TUONG>16<\/DOI_TUONG>/);assert.equal((xml.match(/<FILEHOSO>/g)||[]).length,8);assert.equal(doc.THONGTINHOSO.DANHSACHHOSO.HOSO.FILEHOSO[4].NOIDUNGFILE.TIEN_SU_BENH_TAT.TSBT_MAC_BENH,1);});
test('saved CLS are retained unless operator chooses refresh',()=>{const d={khamCanLamSang:{dsCls:[{maChiSo:'OLD'}]}};assert.equal(selectCls(d,[{maChiSo:'NEW'}])[0].maChiSo,'OLD');assert.equal(selectCls(d,[{maChiSo:'NEW'}],'live')[0].maChiSo,'NEW');});
test('no silently wrong generation for child record; IDs and byte limits',()=>{assert.throws(()=>buildAdult(dto,{}, {loai:10},[]));assert.throws(()=>validId('1 OR 1=1'));assert.throws(()=>validId('0'));assert.equal(truncateBytes('ấab',4),'ấa');assert.equal(dateText('2026-10-06T18:00:00Z',12),'202610070100');});
for(const type of ['pkcs8','pkcs1'])test('UTF8 base64 and cryptographically correct RSA envelope '+type,async()=>{const pair=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type,format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});const xml='<KHAMSUCKHOE>Tiếng Việt</KHAMSUCKHOE>';const p=await envelope(xml,{sender:'GLN_TEST'},pair.privateKey);assert.equal(Buffer.from(p.data,'base64').toString('utf8'),xml);const input=await sha256Hex(JSON.stringify(p.header))+'.'+await sha256Hex(p.data);const verify=createVerify('RSA-SHA256');verify.update(input);assert.ok(verify.verify(pair.publicKey,p.signature,'base64'));});
test('helper only allows KSK reads and explicit gateway operations',()=>{assert.ok(targetPolicy('https://his.test/api/his/v1/dm-mau-du-lieu/db/query','POST',JSON.stringify([clsQuery(1)])));assert.ok(targetPolicy('https://his.test/api/his/v1/dm-mau-du-lieu/db/query','POST',JSON.stringify([hospitalQuery(1)])));assert.throws(()=>targetPolicy('https://his.test/api/his/v1/nb-kham-ksk/1','PATCH','{}'));assert.throws(()=>targetPolicy('https://his.test/api/his/v1/nb-kham-ksk/day-phieu-ksk-dinh-ky/1','POST','{}'));assert.throws(()=>targetPolicy('https://his.test/api/his/v1/dm-mau-du-lieu/db/query','POST','["SELECT pg_sleep(10)"]'));assert.throws(()=>targetPolicy('https://his.test/api/his/v1/dm-mau-du-lieu/db/query','POST','["SELECT * FROM tai_khoan"]'));assert.throws(()=>targetPolicy('https://u:pass@his.test/api/auth/login','POST','{}'));});
test('bridge HTTP preserves gateway response and denies cross-origin requests',async t=>{
 const {start}=require('../server.cjs'),{once}=require('node:events');const helper=start(18769);t.after(()=>helper.close());await once(helper,'listening');const base='http://127.0.0.1:18769';const session=await (await fetch(base+'/__ksk/session')).json();
 const denied=await fetch(base+'/__ksk/proxy',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.test','X-KSK-CSRF':session.csrf},body:'{}'});assert.equal(denied.status,403);
 const upstream=require('node:http').createServer((req,res)=>{assert.equal(req.url,'/api/platform/data-sync/push');assert.equal(req.headers.authorization,'Bearer TEST_ONLY');res.writeHead(422,{'Content-Type':'application/json'});res.end('{"header":{"res_code":"TEST_VALIDATION","res_msg":"mock"}}');});upstream.listen(0,'127.0.0.1');t.after(()=>upstream.close());await once(upstream,'listening');
 const r=await fetch(base+'/__ksk/proxy',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-KSK-CSRF':session.csrf},body:JSON.stringify({url:`http://127.0.0.1:${upstream.address().port}/api/platform/data-sync/push`,method:'POST',headers:{Authorization:'Bearer TEST_ONLY','Content-Type':'application/json'},body:'{}'})});assert.equal(r.status,422);assert.equal((await r.json()).header.res_code,'TEST_VALIDATION');
});

test('catalog comparison preserves gateway XML and exposes ambiguous saved mappings',()=>{
 const rows=[{...row,nb_dich_vu_id:1,dich_vu_id:101,ma_dm_dich_vu:'XN001'},{...row,nb_dich_vu_id:2,dich_vu_id:102,ma_dm_dich_vu:'XN002'}];
 const cls=normalizeCls(rows,s=>s);
 assert.deepEqual(catalogServiceCodes(cls[0],rows),['XN001']);
 assert.deepEqual(catalogServiceCodes({maDichVu:row.ma_dich_vu},rows),['XN001','XN002']);
 assert.deepEqual(catalogServiceCodes({maDichVu:''},rows),[]);
 assert.equal(xmlString(buildAdult(dto,{}, {loai:30},normalizeCls([row],s=>s))),xmlString(buildAdult(dto,{}, {loai:30},[cls[0]])));
 assert.match(clsQuery(1),/LEFT JOIN dm_dich_vu dv ON dv.id = cls.dich_vu_id/);
});

const lisRow={...row,nb_chi_so_con_id:99,dich_vu_id:101,ma_lis:'040CreS',don_vi_lis:'mg/dL',ma_chi_so:'OLD_FROM_VIEW'};
const catalogRow={id:5,dich_vu_id:101,ma_ket_noi:'040CreS',ma_tuong_duong:'S05',don_vi:'µmol/L',active:true};
test('gateway login accepts access tokens and identifies success without access token',()=>{
 const response=data=>({ok:true,http:200,json:{header:{success:true,res_code:'CM_SUCCESS',res_msg:'Success'},data}});
 assert.equal(gatewayLoginToken(response({token:'TOKEN_TEST'})),'TOKEN_TEST');
 assert.equal(gatewayLoginToken(response({access_token:'ACCESS_TEST',refresh_token:'REFRESH_TEST'})),'ACCESS_TEST');
 assert.equal(gatewayLoginToken(response({token:' ',access_token:' Bearer ACCESS_TEST '})),'ACCESS_TEST');
 for(const data of [{refresh_token:'REFRESH_TEST'},{token:'',refresh_token:'REFRESH_TEST'},{token:'Bearer '},{token:' Bearer '},{token:123},null]){
  assert.throws(()=>gatewayLoginToken(response(data)),error=>error.message.includes('không trả token truy cập')&&!error.message.includes('REFRESH_TEST'));
 }
 assert.throws(()=>gatewayLoginToken({...response({token:'TOKEN_TEST'}),ok:false,http:401}),/HTTP 401/);
 assert.throws(()=>gatewayLoginToken({ok:true,http:200,json:{header:{success:false},data:{token:'TOKEN_TEST'}}}),/Đăng nhập cổng thất bại/);
});
test('LIS mapping uses raw child code within the same service and keeps result unchanged',()=>{
 const live=normalizeCls([lisRow],s=>s),before=structuredClone(live);
 const mapped=mapLisCls(live,[{...catalogRow,dich_vu_id:102,ma_tuong_duong:'WRONG'},catalogRow]);
 assert.equal(mapped[0].maChiSo,'S05');assert.equal(mapped[0].donViDo,'µmol/L');assert.equal(mapped[0].giaTri,'0.68');
 assert.equal(mapped[0].moTa,'0.68');assert.equal(mapped[0].mapping.originalCode,'OLD_FROM_VIEW');assert.equal(mapped[0].mapping.status,'mapped');
 assert.deepEqual(live,before);
 const xml=xmlString(buildAdult(dto,{}, {loai:30},mapped));
 assert.match(xml,/<MA_CHI_SO>S05<\/MA_CHI_SO>/);assert.match(xml,/<DON_VI_DO>µmol\/L<\/DON_VI_DO>/);assert.match(xml,/<GIA_TRI>0.68<\/GIA_TRI>/);
 assert.doesNotMatch(xml,/<mapping>|<originalCode>|<maLis>/);
 assert.match(clsQuery(1),/lis.ma_chi_so_con AS ma_lis/);
 assert.ok(targetPolicy('https://his.test/api/his/v1/dm-mau-du-lieu/db/query','POST',JSON.stringify([childCatalogQuery(1)])));
 assert.throws(()=>childCatalogQuery('1 OR 1=1'));
});
test('duplicate, inactive, missing and case-different catalog matches never pick arbitrary mappings',()=>{
 const live=normalizeCls([lisRow],s=>s);
 for(const catalog of [[],[{...catalogRow,dich_vu_id:102}],[{...catalogRow,active:false}],[{...catalogRow,ma_ket_noi:'040CRES'}]]){
  const mapped=mapLisCls(live,catalog);assert.equal(mapped[0].mapping.status,'unmatched');assert.equal(mapped[0].maChiSo,'OLD_FROM_VIEW');assert.equal(mapped[0].donViDo,'Lần');
 }
 const duplicate=mapLisCls(live,[catalogRow,{...catalogRow,id:6}]);assert.equal(duplicate.length,1);assert.equal(duplicate[0].mapping.status,'ambiguous');assert.equal(duplicate[0].maChiSo,'OLD_FROM_VIEW');assert.equal(duplicate[0].mapping.candidates.length,2);
 const active=mapLisCls(live,[{...catalogRow,active:'TRUE',ma_ket_noi:' 040CreS '},{...catalogRow,id:6,active:0}]);assert.equal(active[0].maChiSo,'S05');
 assert.throws(()=>mapLisCls(live,undefined),/Query lại/);
});
test('blank catalog units are emitted blank, missing equivalent codes are flagged and parent rows are retained',()=>{
 const live=normalizeCls([lisRow],s=>s);
 const noUnit=mapLisCls(live,[{...catalogRow,don_vi:null}]);assert.equal(noUnit[0].donViDo,'');assert.match(xmlString(buildAdult(dto,{}, {loai:30},noUnit)),/<DON_VI_DO\/>/);
 const noCode=mapLisCls(live,[{...catalogRow,ma_tuong_duong:' '}]);assert.equal(noCode[0].maChiSo,'OLD_FROM_VIEW');assert.equal(noCode[0].mapping.status,'missing-equivalent');
 const noLis=mapLisCls(normalizeCls([{...lisRow,ma_lis:null}],s=>s),[catalogRow]);assert.equal(noLis[0].mapping.status,'missing-source');
 const parent=mapLisCls(normalizeCls([{...lisRow,nb_chi_so_con_id:null}],s=>s),[catalogRow]);assert.equal(parent[0].mapping.status,'not-child');assert.equal(parent[0].maChiSo,'OLD_FROM_VIEW');assert.equal(parent[0].donViDo,'Lần');
 assert.equal(selectCls({khamCanLamSang:{dsCls:[{maChiSo:'SAVED'}]}},noUnit,'saved')[0].maChiSo,'SAVED');
});
