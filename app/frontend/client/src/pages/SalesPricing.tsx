import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { currentSalesPrice, editSalesData, emptySalesSnapshot, moneyMinor, normalizeSalesKey, priceKey, quoteSalesPrice, validSalesDate, validateSalesPricing, type SalesPricingData, type SalesPricingSnapshot, type SalesPrice } from "@/lib/salesPricing";
import { downloadSalesWorkbook, previewSalesExcel, salesTemplateSheets, type SalesImportPreview } from "@/lib/salesPricingExcel";

type Table = keyof SalesPricingData;
type Tab = "report" | Table | "bulk" | "excel";
type Row = SalesPricingData[Table][number];
type Draft = {table:Table;id:string;values:Record<string,string>;original:string};
const labels:Record<Tab,string>={report:"الرقابة السعرية",products:"الأصناف والتكلفة",regions:"المناطق",branches:"الفروع",types:"أنواع الأسعار",prices:"سجل أسعار البيع",offers:"العروض والخصومات",bulk:"التعديل الجماعي",excel:"Excel"};
const tabs:Tab[]=["report","products","regions","branches","types","prices","offers","bulk","excel"];
const today=()=>{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());return ["year","month","day"].map(k=>parts.find(p=>p.type===k)?.value??"").join("-");};
const fmt=(n:number|null|undefined)=>n==null?"—":(n/100).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const rawMoney=(n:number|null|undefined)=>n==null?"":(n/100).toFixed(2);
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
const css="w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm";
const split=(s:string)=>s.split("|").filter(Boolean);
const opt=(id:string,name:string)=>({id,name});
type Option={id:string;name:string};
function Field({label,value,onChange,options,multiple=false,type="text",required=false}:{label:string;value:string;onChange:(s:string)=>void;options?:Option[];multiple?:boolean;type?:string;required?:boolean}){
 return <label className="grid gap-1.5 text-sm font-medium min-w-0">{label}
 {options? multiple?<select className={css+" min-h-28"} multiple value={split(value)} onChange={e=>onChange(Array.from(e.target.selectedOptions,o=>o.value).join("|"))}>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>:<select className={css} value={value} required={required} onChange={e=>onChange(e.target.value)}><option value="">— اختر —</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>:type==="textarea"?<textarea className={css+" min-h-20"} value={value} onChange={e=>onChange(e.target.value)}/>:<input className={css} type={type} value={value} required={required} onChange={e=>onChange(e.target.value)} inputMode={type==="number"?"decimal":undefined} step={type==="number"?"any":undefined}/>}
 </label>;
}
function defaults(table:Table,row?:Row):Record<string,string>{
 const v:Record<string,string>={};
 if(row)for(const [k,x] of Object.entries(row)){if(k!=="id")v[k]=Array.isArray(x)?x.join("|"):x==null?"":String(x);}
 if(table==="branches")v.active=v.active??"true";
 if(table==="products")v.costMinor=rawMoney(row&&"costMinor" in row?row.costMinor:null);
 if(table==="prices"){v.amountMinor=rawMoney(row&&"amountMinor" in row?row.amountMinor:null);v.effectiveDate=v.effectiveDate??today();}
 if(table==="offers"){v.mode=v.mode??"amount";v.value=rawMoney(row&&"value" in row?row.value:null);v.minimumQuantity=v.minimumQuantity??"0";v.startDate=v.startDate??today();v.endDate=v.endDate??today();}
 return v;
}
function draftRow(d:Draft):Row{
 const v=d.values, s=(k:string)=>(v[k]??"").trim(),id=d.id;
 switch(d.table){
 case "regions":return {id,name:s("name")};
 case "branches":return {id,number:s("number"),name:s("name"),regionId:s("regionId")||null,active:s("active")!=="false"};
 case "products":return {id,code:s("code"),name:s("name"),category:s("category"),unit:s("unit"),costMinor:s("costMinor")?moneyMinor(s("costMinor")):null,branchIds:split(s("branchIds")),notes:s("notes")};
 case "types":return {id,code:s("code"),name:s("name")};
 case "prices":return {id,productId:s("productId"),branchId:s("branchId"),typeId:s("typeId"),effectiveDate:s("effectiveDate"),amountMinor:moneyMinor(s("amountMinor")),notes:s("notes")};
 case "offers":return {id,productIds:split(s("productIds")),branchIds:split(s("branchIds")),typeId:s("typeId"),startDate:s("startDate"),endDate:s("endDate"),mode:s("mode") as "amount"|"percent"|"fixed",value:moneyMinor(s("value")),minimumQuantity:Number(s("minimumQuantity")||0),notes:s("notes")};
 }
}
function SalesPricingPage(){
 const [snapshot,setSnapshot]=useState<SalesPricingSnapshot>(emptySalesSnapshot);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [tab,setTab]=useState<Tab>("report"),[draft,setDraft]=useState<Draft|null>(null);
 const [query,setQuery]=useState(""),[date,setDate]=useState(today),[branch,setBranch]=useState(""),[type,setType]=useState(""),[region,setRegion]=useState(""),[quantity,setQuantity]=useState("1");
 const [importPlan,setImportPlan]=useState<(SalesImportPreview&{revision:number;fileName:string})|null>(null);
 const [bulk,setBulk]=useState({mode:"amount",value:"",date:today(),branch:"",type:"",product:""});
 const [bulkPlan,setBulkPlan]=useState<{data:SalesPricingData;revision:number;changes:{name:string;old:number;next:number}[]}|null>(null);
 const data=snapshot.data;
 const reload=async()=>{setLoading(true);setError("");try{await db.init();setSnapshot(await db.getSalesPricing());setImportPlan(null);setBulkPlan(null);}catch(e){setError(message(e));}finally{setLoading(false);}};
 useEffect(()=>{void reload();},[]);
 const dirty=!!draft&&JSON.stringify(draft.values)!==draft.original;
 useEffect(()=>{const listener=(e:BeforeUnloadEvent)=>{if(dirty||importPlan||bulkPlan){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",listener);return()=>window.removeEventListener("beforeunload",listener);},[dirty,importPlan,bulkPlan]);
 const save=async(next:SalesPricingData,revision=snapshot.revision)=>{if(busy)return false;setBusy(true);setError("");try{setSnapshot(await db.saveSalesPricing(next,revision));setImportPlan(null);setBulkPlan(null);toast.success("تم الحفظ");return true;}catch(e){toast.error(message(e));setError(message(e));return false;}finally{setBusy(false);}};
 const open=(table:Table,row?:Row)=>{const values=defaults(table,row);setDraft({table,id:row?.id??newId("sales"),values,original:JSON.stringify(values)});};
 const close=()=>{if(busy)return;if(!dirty||window.confirm("إلغاء التعديلات غير المحفوظة؟"))setDraft(null);};
 const submit=async(e:FormEvent)=>{e.preventDefault();if(!draft)return;try{const next=editSalesData(data,draft.table,draftRow(draft),"save");if(await save(next))setDraft(null);}catch(e){toast.error(message(e));}};
 const remove=async()=>{if(!draft||!window.confirm("تأكيد حذف السجل؟"))return;try{const next=editSalesData(data,draft.table,{id:draft.id},"delete");if(await save(next))setDraft(null);}catch(e){toast.error(message(e));}};
 const names={
 region:(id:string|null)=>data.regions.find(r=>r.id===id)?.name??"—",
 branch:(id:string)=>data.branches.find(r=>r.id===id)?.name??"—",
 product:(id:string)=>data.products.find(r=>r.id===id)?.name??"—",
 type:(id:string)=>data.types.find(r=>r.id===id)?.name??"—"
 };
 const branches=data.branches.map(b=>opt(b.id,b.number+" — "+b.name)),products=data.products.map(p=>opt(p.id,p.code+" — "+p.name)),types=data.types.map(t=>opt(t.id,t.name)),regions=data.regions.map(r=>opt(r.id,r.name));
 const report=useMemo(()=>{
  const result:{product:SalesPricingData["products"][number];branch:SalesPricingData["branches"][number];type:SalesPricingData["types"][number];price:SalesPrice|undefined;net:number|null;profit:number|null;margin:number|null;issue:string}[]=[];
  if(!validSalesDate(date)||!Number.isFinite(Number(quantity))||Number(quantity)<0)return result;
  for(const p of data.products){if(query&&!normalizeSalesKey(p.name+" "+p.code+" "+p.category).includes(normalizeSalesKey(query)))continue;for(const b of data.branches){if(!b.active||!p.branchIds.includes(b.id)||(branch&&b.id!==branch)||(region&&b.regionId!==region))continue;for(const t of data.types){if(type&&t.id!==type)continue;const price=currentSalesPrice(data,p.id,b.id,t.id,date);try{const q=quoteSalesPrice(data,p.id,b.id,t.id,date,Number(quantity));result.push({product:p,branch:b,type:t,price,net:q?.netMinor??null,profit:q?.profitMinor??null,margin:q?.marginPercent??null,issue:!q?"سعر مفقود":q.costMinor===null?"تكلفة غير محددة":q.profitMinor!==null&&q.profitMinor<0?"أقل من التكلفة":""});}catch(e){result.push({product:p,branch:b,type:t,price,net:null,profit:null,margin:null,issue:message(e)});}}}}
  return result;
 },[data,query,date,branch,type,region,quantity]);
 const tableHeaders:Record<Table,string[]>={regions:["المنطقة"],branches:["رقم الفرع","اسم الفرع","المنطقة","الحالة"],products:["الكود","الصنف","التصنيف","الوحدة","التكلفة الحالية","الفروع"],types:["الكود","نوع السعر"],prices:["الصنف","الفرع","نوع السعر","تاريخ السريان","السعر","ملاحظات"],offers:["الأصناف","الفروع","نوع السعر","البداية","النهاية","الطريقة","القيمة","الحد الأدنى"]};
 function rowCells(table:Table,row:Row):string[]{
  switch(table){
   case "regions":return [(row as SalesPricingData["regions"][number]).name];
   case "branches":{const r=row as SalesPricingData["branches"][number];return [r.number,r.name,names.region(r.regionId),r.active?"نشط":"موقوف"];}
   case "products":{const r=row as SalesPricingData["products"][number];return [r.code,r.name,r.category,r.unit,fmt(r.costMinor),r.branchIds.map(names.branch).join("، ")];}
   case "types":{const r=row as SalesPricingData["types"][number];return [r.code,r.name];}
   case "prices":{const r=row as SalesPrice;return [names.product(r.productId),names.branch(r.branchId),names.type(r.typeId),r.effectiveDate,fmt(r.amountMinor),r.notes];}
   case "offers":{const r=row as SalesPricingData["offers"][number];return [r.productIds.map(names.product).join("، "),r.branchIds.length?r.branchIds.map(names.branch).join("، "):"جميع الفروع",names.type(r.typeId),r.startDate,r.endDate,r.mode==="fixed"?"سعر ثابت":r.mode==="percent"?"نسبة":"مبلغ",fmt(r.value)+(r.mode==="percent"?"%":""),String(r.minimumQuantity)];}
  }
 }
 const reportExport=()=>downloadSalesWorkbook([{name:"الرقابة السعرية",headers:["تاريخ التقرير","كود الصنف","الصنف","رقم الفرع","اسم الفرع","نوع السعر","التكلفة الحالية","السعر الأساسي","الصافي","ربح الوحدة","الهامش","الملاحظة"],rows:report.map(r=>[date,r.product.code,r.product.name,r.branch.number,r.branch.name,r.type.name,r.product.costMinor==null?"":r.product.costMinor/100,r.price?r.price.amountMinor/100:"",r.net==null?"":r.net/100,r.profit==null?"":r.profit/100,r.margin==null?"":r.margin/100,r.issue]),money:[6,7,8,9],percent:[10]}],"تقرير-الرقابة-"+date);
 const readFile=async(file:File)=>{setImportPlan(null);try{if(file.size>20*1024*1024)throw Error("حجم الملف يتجاوز 20 ميجابايت");const plan=previewSalesExcel(await file.arrayBuffer(),data);setImportPlan({...plan,revision:snapshot.revision,fileName:file.name});}catch(e){toast.error(message(e));}};
 const makeBulk=()=>{setBulkPlan(null);try{
  if(!validSalesDate(bulk.date)||!bulk.value.trim())throw Error("حدد التاريخ وقيمة التعديل");
  const amount=moneyMinor(bulk.value),next=structuredClone(data),changes:{name:string;old:number;next:number}[]=[];
  if(bulk.mode==="percentDown" && amount>10000)throw Error("نسبة الخصم تتجاوز 100%");
  if(bulk.mode==="cost"){
    for(const p of next.products.filter(p=>!bulk.product||p.id===bulk.product)){if(p.costMinor===amount)continue;changes.push({name:p.name,old:p.costMinor??0,next:amount});p.costMinor=amount;}
  }else{
    for(const p of data.products.filter(p=>!bulk.product||p.id===bulk.product))for(const b of data.branches.filter(b=>b.active&&p.branchIds.includes(b.id)&&(!bulk.branch||b.id===bulk.branch)))for(const t of data.types.filter(t=>!bulk.type||t.id===bulk.type)){
      const old=currentSalesPrice(data,p.id,b.id,t.id,bulk.date);if(!old)continue;
      let value=bulk.mode==="fixed"?amount:bulk.mode==="amount"?old.amountMinor+amount:bulk.mode==="subtract"?old.amountMinor-amount:Number((BigInt(old.amountMinor)*BigInt(10000+(bulk.mode==="percentDown"?-amount:amount))+BigInt(5000))/BigInt(10000));
      if(value<0||!Number.isSafeInteger(value))throw Error("نتيجة سعر غير صالحة");
      if(value===old.amountMinor)continue;
      const candidate:SalesPrice={id:newId("sales"),productId:p.id,branchId:b.id,typeId:t.id,effectiveDate:bulk.date,amountMinor:value,notes:"تعديل جماعي"};
      const exists=next.prices.find(x=>priceKey(x)===priceKey(candidate));if(exists)throw Error("يوجد سعر مسجل بالفعل بنفس تاريخ السريان؛ عدله من سجل الأسعار");
      next.prices.push(candidate);changes.push({name:p.name+" / "+b.name+" / "+t.name,old:old.amountMinor,next:value});
    }
  }
  validateSalesPricing(next);if(!changes.length)throw Error("لا توجد تغييرات قابلة للتطبيق");setBulkPlan({data:next,revision:snapshot.revision,changes});
 }catch(e){toast.error(message(e));}};
 const link=(table:Table,row:Row,label:string)=><button type="button" className="text-start text-primary underline-offset-2 hover:underline font-medium" onClick={()=>open(table,row)}>{label}</button>;
 const field=(label:string,k:string,options?:Option[],multiple=false,type?:string,required=false)=>draft?<Field key={k} label={label} value={draft.values[k]??""} onChange={v=>setDraft(d=>d?{...d,values:{...d.values,[k]:v}}:d)} options={options} multiple={multiple} type={type} required={required}/>:null;
 const editing=!!draft&&data[draft.table].some(r=>r.id===draft.id);
 return <AppLayout title="إدارة ورقابة أسعار البيع" subtitle="قسم مستقل · تكلفة حالية واحدة · تاريخ أسعار البيع">
  <section dir="rtl" className="space-y-5">
   <div className="rounded-xl border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap justify-between items-center gap-3"><div><h1 className="text-2xl font-bold">مركز الرقابة السعرية</h1><p className="text-sm text-muted-foreground mt-1">مرجع مستقل للأسعار والتكاليف والفروع. الربحية مقارنة بالتكلفة الحالية فقط.</p></div><Button variant="outline" disabled={busy||loading} onClick={()=>void reload()}>تحديث البيانات</Button></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">{[["الأصناف",data.products.length],["الفروع",data.branches.length],["سجلات الأسعار",data.prices.length],["أصناف دون تكلفة",data.products.filter(p=>p.costMinor===null).length]].map(([label,n])=><div key={label} className="rounded-lg border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold tabular-nums mt-1">{n}</div></div>)}</div>
   </div>
   <nav aria-label="أقسام الرقابة السعرية" className="flex flex-wrap gap-2">{tabs.map(t=><Button key={t} size="sm" variant={tab===t?"default":"outline"} onClick={()=>{setTab(t);setQuery("");}}>{labels[t]}</Button>)}</nav>
   {error&&<p role="alert" className="rounded-md border border-destructive/40 p-3 text-destructive">{error}</p>}
   {loading?<p>جاري تحميل بيانات القسم...</p>:tab==="report"?<div className="rounded-xl border bg-card p-4 space-y-4">
    <div className="flex justify-between gap-2 flex-wrap"><h2 className="font-bold text-lg">الأسعار السارية والربحية</h2><Button variant="outline" onClick={reportExport}>تصدير التقرير Excel</Button></div>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3"><Field label="بحث" value={query} onChange={setQuery}/><Field label="تاريخ التسعير" type="date" value={date} onChange={setDate}/><Field label="المنطقة" value={region} onChange={setRegion} options={regions}/><Field label="الفرع" value={branch} onChange={setBranch} options={branches}/><Field label="نوع السعر" value={type} onChange={setType} options={types}/><Field label="كمية اختبار الخصم" type="number" value={quantity} onChange={setQuantity}/></div>
    <div className="flex flex-wrap gap-4 text-sm"><span>{report.length} نتيجة</span><span className="text-red-600">أقل من التكلفة: {report.filter(r=>r.profit!==null&&r.profit<0).length}</span><span>أسعار مفقودة: {report.filter(r=>!r.price).length}</span></div>
    <div className="overflow-x-auto"><table className="w-full text-sm text-start whitespace-nowrap"><thead className="bg-muted"><tr>{["الصنف","الفرع","نوع السعر","التكلفة الحالية","السعر الأساسي","السعر الصافي","ربح الوحدة","الهامش","الملاحظة"].map(h=><th key={h} className="p-3 text-start">{h}</th>)}</tr></thead><tbody>{report.map(r=><tr key={r.product.id+"|"+r.branch.id+"|"+r.type.id} className="border-b hover:bg-muted/40"><td className="p-3">{link("products",r.product,r.product.code+" — "+r.product.name)}</td><td className="p-3">{link("branches",r.branch,r.branch.number+" — "+r.branch.name)}</td><td className="p-3">{link("types",r.type,r.type.name)}</td><td className="p-3">{fmt(r.product.costMinor)}</td><td className="p-3">{r.price?link("prices",r.price,fmt(r.price.amountMinor)):<button className="underline text-primary" onClick={()=>{const values={...defaults("prices"),productId:r.product.id,branchId:r.branch.id,typeId:r.type.id,effectiveDate:date};setDraft({table:"prices",id:newId("sales"),values,original:JSON.stringify(values)});}}>إضافة سعر</button>}</td><td className="p-3">{fmt(r.net)}</td><td className={"p-3 "+(r.profit!==null&&r.profit<0?"text-red-600":"")}>{fmt(r.profit)}</td><td className="p-3">{r.margin==null?"—":r.margin.toFixed(2)+"%"}</td><td className="p-3 text-muted-foreground">{r.issue}</td></tr>)}</tbody></table>{!report.length&&<p className="p-6 text-center text-muted-foreground">أضف الفروع والأصناف وأنواع الأسعار أو عدل عوامل التصفية.</p>}</div>
   </div>:tab==="excel"?<div className="rounded-xl border bg-card p-4 space-y-4"><h2 className="font-bold text-lg">استيراد وتصدير البيانات</h2><p className="text-sm text-muted-foreground">رقم الفرع وكود الصنف ونوع السعر والتاريخ مفاتيح المطابقة. الخلايا الفارغة لا تمسح البيانات القديمة. لا يتم حفظ أي بيانات قبل الاعتماد.</p><div className="flex gap-2 flex-wrap"><Button variant="outline" onClick={()=>downloadSalesWorkbook(salesTemplateSheets(),"قالب-أسعار-البيع")}>تنزيل القالب</Button><Button variant="outline" onClick={()=>downloadSalesWorkbook(salesTemplateSheets(data),"بيانات-أسعار-البيع")}>تصدير البيانات الحالية</Button></div><label className="block">اختيار ملف Excel<input className={css} type="file" accept=".xlsx,.xls" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void readFile(f);e.target.value="";}}/></label>{importPlan&&<div className="space-y-3 border rounded-lg p-4"><p className="font-bold">{importPlan.fileName}</p><p>إضافات: {importPlan.inserted} · تحديثات: {importPlan.updated} · دون تغيير: {importPlan.unchanged} · أخطاء: {importPlan.errors.length}</p>{importPlan.errors.length>0&&<ul className="text-red-600 max-h-48 overflow-auto list-disc ps-5">{importPlan.errors.map((e,i)=><li key={i}>{e}</li>)}</ul>}<div className="flex flex-wrap gap-2"><Button disabled={busy||importPlan.errors.length>0||importPlan.inserted+importPlan.updated===0} onClick={()=>void save(importPlan.data,importPlan.revision)}>اعتماد وحفظ الاستيراد</Button><Button variant="outline" onClick={()=>setImportPlan(null)}>إلغاء</Button></div></div>}</div>:tab==="bulk"?<div className="rounded-xl border bg-card p-4 space-y-4"><h2 className="font-bold text-lg">التعديل الجماعي</h2><p className="text-sm text-muted-foreground">التعديلات السعرية تُضاف بتاريخ جديد ولا تمس الأسعار السابقة. تعديل التكلفة يستبدل القيمة الحالية فقط.</p><div className="grid grid-cols-2 lg:grid-cols-3 gap-3"><Field label="العملية" value={bulk.mode} onChange={v=>{setBulk({...bulk,mode:v});setBulkPlan(null);}} options={[opt("fixed","تعيين سعر"),opt("amount","زيادة مبلغ"),opt("subtract","تخفيض مبلغ"),opt("percentUp","زيادة %"),opt("percentDown","تخفيض %"),opt("cost","تعيين التكلفة الحالية")]}/>{(["value","date","branch","type","product"] as const).filter(k=>bulk.mode!=="cost"||k==="value"||k==="product").map(k=><Field key={k} label={{value:"القيمة",date:"تاريخ السريان",branch:"الفرع",type:"نوع السعر",product:"الصنف"}[k]} value={bulk[k]} onChange={v=>{setBulk({...bulk,[k]:v});setBulkPlan(null);}} type={k==="date"?"date":k==="value"?"number":undefined} options={k==="branch"?branches:k==="type"?types:k==="product"?products:undefined}/>)}</div><Button onClick={makeBulk}>معاينة التعديلات</Button>{bulkPlan&&<div className="space-y-3"><p>{bulkPlan.changes.length} تعديل</p><div className="overflow-auto max-h-72"><table className="w-full text-sm"><thead><tr><th>السجل</th><th>السابق</th><th>الجديد</th></tr></thead><tbody>{bulkPlan.changes.map((r,i)=><tr key={i} className="border-b"><td className="p-2">{r.name}</td><td>{fmt(r.old)}</td><td>{fmt(r.next)}</td></tr>)}</tbody></table></div><Button disabled={busy} onClick={()=>void save(bulkPlan.data,bulkPlan.revision)}>اعتماد وحفظ</Button></div>}</div>:<div className="rounded-xl border bg-card p-4 space-y-4"><div className="flex justify-between flex-wrap gap-2"><h2 className="font-bold text-lg">{labels[tab]}</h2><Button onClick={()=>open(tab)}>إضافة سجل</Button></div><Field label="بحث في السجلات" value={query} onChange={setQuery}/><div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-sm"><thead className="bg-muted"><tr>{tableHeaders[tab].map(h=><th key={h} className="text-start p-3">{h}</th>)}<th className="p-3">الإجراء</th></tr></thead><tbody>{data[tab].filter(r=>normalizeSalesKey(rowCells(tab,r).join(" ")).includes(normalizeSalesKey(query))).map(r=><tr key={r.id} className="border-b hover:bg-muted/30">{rowCells(tab,r).map((v,i)=><td key={i} className="p-3">{i===0?link(tab,r,v):v||"—"}</td>)}<td className="p-3"><Button size="sm" variant="outline" onClick={()=>open(tab,r)}>فتح / تعديل</Button></td></tr>)}</tbody></table>{data[tab].length===0&&<p className="text-muted-foreground text-center p-6">لا توجد سجلات بعد.</p>}</div></div>}
   <Dialog open={!!draft} onOpenChange={v=>{if(!v)close();}}><DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{draft?(editing?"تعديل":"إضافة")+" — "+labels[draft.table]:""}</DialogTitle></DialogHeader>{draft&&<form className="space-y-4" onSubmit={submit}><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
   {draft.table==="regions"&&field("اسم المنطقة","name",undefined,false,undefined,true)}
   {draft.table==="branches"&&<>{field("رقم الفرع (مثل 001)","number",undefined,false,undefined,true)}{field("اسم الفرع","name",undefined,false,undefined,true)}{field("المنطقة","regionId",regions)}{field("الحالة","active",[opt("true","نشط"),opt("false","موقوف")])}</>}
   {draft.table==="products"&&<>{field("كود الصنف","code",undefined,false,undefined,true)}{field("اسم الصنف","name",undefined,false,undefined,true)}{field("التصنيف","category")}{field("الوحدة","unit")}{field("التكلفة الحالية","costMinor",undefined,false,"number")}{field("الفروع المرتبطة (اختيار متعدد)","branchIds",branches,true)}{field("ملاحظات","notes",undefined,false,"textarea")}</>}
   {draft.table==="types"&&<>{field("كود نوع السعر","code",undefined,false,undefined,true)}{field("نوع السعر","name",undefined,false,undefined,true)}</>}
   {draft.table==="prices"&&<>{field("الصنف","productId",products,false,undefined,true)}{field("الفرع","branchId",branches.filter(b=>data.products.find(p=>p.id===draft.values.productId)?.branchIds.includes(b.id)),false,undefined,true)}{field("نوع السعر","typeId",types,false,undefined,true)}{field("تاريخ السريان","effectiveDate",undefined,false,"date",true)}{field("سعر البيع","amountMinor",undefined,false,"number",true)}{field("ملاحظات","notes",undefined,false,"textarea")}</>}
   {draft.table==="offers"&&<>{field("الأصناف","productIds",products,true)}{field("الفروع (فارغ = الكل)","branchIds",branches,true)}{field("نوع السعر","typeId",types,false,undefined,true)}{field("من تاريخ","startDate",undefined,false,"date",true)}{field("إلى تاريخ","endDate",undefined,false,"date",true)}{field("الطريقة","mode",[opt("amount","خصم مبلغ لكل وحدة"),opt("percent","خصم نسبة %"),opt("fixed","سعر مؤقت ثابت")])}{field("القيمة (ريال أو نسبة)","value",undefined,false,"number",true)}{field("أقل كمية","minimumQuantity",undefined,false,"number")}{field("ملاحظات","notes",undefined,false,"textarea")}</>}
   </div><div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>حفظ السجل</Button>{editing&&<Button type="button" variant="destructive" disabled={busy} onClick={()=>void remove()}>حذف السجل</Button>}<Button type="button" variant="outline" onClick={close} disabled={busy}>إلغاء</Button></div></form>}</DialogContent></Dialog>
  </section>
 </AppLayout>;
}
export default SalesPricingPage;
