import * as XLSX from "xlsx";
import { zipSync, strToU8 } from "fflate";
import { newId } from "./id";
import { moneyMinor, normalizeSalesKey, priceKey, validateSalesPricing, type SalesPricingData, type SalesPrice } from "./salesPricing";

type Cell = string | number;
type Sheet = {name:string; headers:string[]; rows:Cell[][]; money?:number[]; percent?:number[]};
const key=normalizeSalesKey;
const split=(v:string)=>v.split("|").map(x=>x.trim()).filter(Boolean);
const clean=(v:unknown)=>String(v??"").trim();
const headers={
  regions:["اسم المنطقة"],
  branches:["رقم الفرع","اسم الفرع","المنطقة","الحالة"],
  products:["كود الصنف","اسم الصنف","التصنيف","الوحدة","التكلفة","أرقام الفروع","ملاحظات"],
  types:["كود نوع السعر","نوع السعر"],
  prices:["كود الصنف","رقم الفرع","كود نوع السعر","تاريخ السريان","السعر","ملاحظات"],
};
const names={regions:"المناطق",branches:"الفروع",products:"الأصناف",types:"أنواع الأسعار",prices:"أسعار البيع"};
export type SalesImportPreview={data:SalesPricingData;errors:string[];inserted:number;updated:number;unchanged:number};
export function previewSalesExcel(buffer:ArrayBuffer, current:SalesPricingData):SalesImportPreview{
  const wb=XLSX.read(buffer,{type:"array",cellDates:true,dateNF:"yyyy-mm-dd"});
  const next=structuredClone(current);
  const result:SalesImportPreview={data:next,errors:[],inserted:0,updated:0,unchanged:0};
  const seen=new Map<string,string>();
  if(wb.SheetNames.length>30)throw Error("عدد أوراق الملف يتجاوز الحد المسموح");
  function process<T extends {id:string}>(sheet:string, rows:T[], identity:(r:T)=>string, build:(r:Record<string,string>,rows:T[])=>T){
    const ws=wb.Sheets[sheet];if(!ws)return;
    const source=XLSX.utils.sheet_to_json<Record<string,unknown>>(ws,{defval:"",raw:false,dateNF:"yyyy-mm-dd"});
    if(source.length>20000){result.errors.push(sheet+": عدد الصفوف يتجاوز 20000");return;}
    source.forEach((raw,i)=>{
      try{
        const row=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k.trim(),clean(v)]));
        const candidate=build(row,rows);
        const k=identity(candidate), old=rows.find(r=>identity(r)===k);
        if(!k)throw Error("المعرف مطلوب");
        const merged={...candidate,id:old?.id??candidate.id};
        const serial=JSON.stringify(merged);
        const seenKey=sheet+":"+k;
        if(seen.has(seenKey)){if(seen.get(seenKey)!==serial)throw Error("سجلات متعارضة لنفس المعرف");return;}
        seen.set(seenKey,serial);
        if(!old){rows.push(merged);result.inserted++;}
        else if(JSON.stringify(old)===serial)result.unchanged++;
        else{rows[rows.indexOf(old)]=merged;result.updated++;}
      }catch(e){result.errors.push(sheet+" — صف "+(i+2)+": "+(e instanceof Error?e.message:String(e)));}
    });
  }
  const required=(v:string|undefined)=>{if(!v)throw Error("حقل إلزامي فارغ");return v;};
  function resolve<T>(rows:T[], fn:(r:T)=>string, value:string){const matches=rows.filter(r=>key(fn(r))===key(required(value)));if(matches.length!==1)throw Error("مرجع غير معروف أو متعارض: "+value);return matches[0];}
  process(names.regions,next.regions,r=>key(r.name),(r,rows)=>({id:rows.find(x=>key(x.name)===key(r["اسم المنطقة"]??""))?.id??newId("sr"),name:required(r["اسم المنطقة"])}));
  process(names.branches,next.branches,r=>key(r.number),(r,rows)=>{
    const number=required(r["رقم الفرع"]),old=rows.find(x=>key(x.number)===key(number));
    const status=r["الحالة"];if(status&&!["نشط","موقوف"].includes(status))throw Error("الحالة غير صالحة");
    return {id:old?.id??newId("sb"),number,name:required(r["اسم الفرع"]||old?.name),regionId:r["المنطقة"]?resolve(next.regions,x=>x.name,r["المنطقة"]).id:old?.regionId??null,active:status?status==="نشط":old?.active??true};
  });
  process(names.products,next.products,r=>key(r.code),(r,rows)=>{
    const code=required(r["كود الصنف"]),old=rows.find(x=>key(x.code)===key(code));
    return {id:old?.id??newId("sp"),code,name:required(r["اسم الصنف"]||old?.name),category:r["التصنيف"]||old?.category||"",unit:r["الوحدة"]||old?.unit||"",costMinor:r["التكلفة"]?moneyMinor(r["التكلفة"]):old?.costMinor??null,branchIds:r["أرقام الفروع"]?Array.from(new Set(split(r["أرقام الفروع"]).map(v=>resolve(next.branches,x=>x.number,v).id))):old?.branchIds??[],notes:r["ملاحظات"]||old?.notes||""};
  });
  process(names.types,next.types,r=>key(r.code),(r,rows)=>{const code=required(r["كود نوع السعر"]),old=rows.find(x=>key(x.code)===key(code));return {id:old?.id??newId("st"),code,name:required(r["نوع السعر"]||old?.name)};});
  process(names.prices,next.prices,priceKey,(r,rows)=>{
    const product=resolve(next.products,x=>x.code,r["كود الصنف"]);
    const branch=resolve(next.branches,x=>x.number,r["رقم الفرع"]);
    const type=resolve(next.types,x=>x.code,r["كود نوع السعر"]);
    const p:SalesPrice={id:newId("spr"),productId:product.id,branchId:branch.id,typeId:type.id,effectiveDate:required(r["تاريخ السريان"]),amountMinor:moneyMinor(required(r["السعر"])),notes:r["ملاحظات"]||""};
    const old=rows.find(x=>priceKey(x)===priceKey(p));return {...p,id:old?.id??p.id,notes:p.notes||old?.notes||""};
  });
  if(!Object.values(names).some(n=>wb.SheetNames.includes(n)))result.errors.push("الملف لا يحتوي على أوراق القالب المعتمدة");
  try{validateSalesPricing(next);}catch(e){result.errors.push(e instanceof Error?e.message:String(e));}
  return result;
}
const xml=(s:unknown)=>String(s??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const pkg="http://schemas.openxmlformats.org/package/2006/relationships";
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
/** Minimal styled OOXML writer; identifiers remain inline text, no formula injection. */
export function buildSalesWorkbook(sheets:Sheet[]):Uint8Array{
  const files:Record<string,Uint8Array>={};
  const put=(p:string,s:string)=>{files[p]=strToU8(declaration+s);};
  put("[Content_Types].xml",'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("")+'</Types>');
  put("_rels/.rels",'<Relationships xmlns="'+pkg+'"><Relationship Id="rId1" Type="'+rel+'/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  put("xl/workbook.xml",'<workbook xmlns="'+ns+'" xmlns:r="'+rel+'"><bookViews><workbookView/></bookViews><sheets>'+sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join("")+'</sheets></workbook>');
  put("xl/_rels/workbook.xml.rels",'<Relationships xmlns="'+pkg+'">'+sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+rel+'/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join("")+'<Relationship Id="rIdStyles" Type="'+rel+'/styles" Target="styles.xml"/></Relationships>');
  put("xl/styles.xml",'<styleSheet xmlns="'+ns+'"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9E2EC"/></left><right style="thin"><color rgb="FFD9E2EC"/></right><top style="thin"><color rgb="FFD9E2EC"/></top><bottom style="thin"><color rgb="FFD9E2EC"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="1" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  sheets.forEach((s,i)=>{
    const all:Cell[][]=[s.headers,...s.rows];
    const last=XLSX.utils.encode_col(s.headers.length-1);
    const cols=s.headers.map((h,j)=>'<col min="'+(j+1)+'" max="'+(j+1)+'" width="'+Math.min(46,Math.max(14,h.length+5,...s.rows.map(r=>String(r[j]??"").length+3)))+'" customWidth="1"/>').join("");
    const rows=all.map((r,k)=>'<row r="'+(k+1)+'"'+(k===0?' ht="30" customHeight="1"':'')+'>'+r.map((v,j)=>{
      const a=XLSX.utils.encode_cell({r:k,c:j}),style=k===0?1:typeof v==="string"?4:s.money?.includes(j)?2:s.percent?.includes(j)?3:0;
      return typeof v==="number"&&Number.isFinite(v)?'<c r="'+a+'" s="'+style+'"><v>'+v+'</v></c>':'<c r="'+a+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>';
    }).join("")+'</row>').join("");
    put("xl/worksheets/sheet"+(i+1)+".xml",'<worksheet xmlns="'+ns+'"><dimension ref="A1:'+last+all.length+'"/><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="19"/><cols>'+cols+'</cols><sheetData>'+rows+'</sheetData><autoFilter ref="A1:'+last+all.length+'"/></worksheet>');
  });
  return zipSync(files);
}
export function salesTemplateSheets(data?:SalesPricingData):Sheet[]{
 const d=data;
 return [
 {name:names.regions,headers:headers.regions,rows:d?.regions.map(r=>[r.name])??[]},
 {name:names.branches,headers:headers.branches,rows:d?.branches.map(b=>[b.number,b.name,d.regions.find(r=>r.id===b.regionId)?.name??"",b.active?"نشط":"موقوف"])??[]},
 {name:names.products,headers:headers.products,money:[4],rows:d?.products.map(p=>[p.code,p.name,p.category,p.unit,p.costMinor===null?"":p.costMinor/100,p.branchIds.map(id=>d.branches.find(b=>b.id===id)?.number??"").join("|"),p.notes])??[]},
 {name:names.types,headers:headers.types,rows:d?.types.map(t=>[t.code,t.name])??[]},
 {name:names.prices,headers:headers.prices,money:[4],rows:d?.prices.map(p=>[d.products.find(x=>x.id===p.productId)?.code??"",d.branches.find(x=>x.id===p.branchId)?.number??"",d.types.find(x=>x.id===p.typeId)?.code??"",p.effectiveDate,p.amountMinor/100,p.notes])??[]}
 ];
}
export function downloadSalesWorkbook(sheets:Sheet[],name:string){
 const bytes=buildSalesWorkbook(sheets);
 const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
 const a=document.createElement("a");a.href=url;a.download=name+".xlsx";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
