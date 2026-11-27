import EnglishDatePicker from "@/components/EnglishDatePicker";
import { normalizeEnglishNumberInput, toEnglishDigits } from "@/lib/englishDisplay";
import { useLanguage } from "@/contexts/LanguageContext";
import { salesArabic as a, localizeSalesMessage } from "@/lib/i18n/salesPricingText";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Trash2, BarChart3 } from "lucide-react";
import SalesReports from "./SalesReports";
import { planSalesDeletion, salesCategories, type SalesDeleteTarget } from "@/lib/salesPricingDeletion";
import { searchSalesText } from "@/lib/salesPricingReport";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { currentSalesPrice, editSalesData, emptySalesSnapshot, moneyMinor, normalizeSalesKey, priceKey, quoteSalesPrice, validSalesDate, validateSalesPricing, type SalesPricingData, type SalesPricingSnapshot, type SalesPrice } from "@/lib/salesPricing";
import { downloadSalesWorkbook, previewSalesExcel, salesTemplateSheets, type SalesImportPreview } from "@/lib/salesPricingExcel";

type Table = keyof SalesPricingData;
type Tab = "report" | Table | "bulk" | "excel" | "categories" | "reports";
type Row = SalesPricingData[Table][number];
type Draft = {table:Table;id:string;values:Record<string,string>;original:string};
const tabs:Tab[]=["report","reports","products","categories","regions","branches","types","prices","offers","bulk","excel"];
const today=()=>{const parts=new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());return ["year","month","day"].map(k=>parts.find(p=>p.type===k)?.value??"").join("-");};
const fmt=(n:number|null|undefined)=>n==null?"—":(n/100).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const rawMoney=(n:number|null|undefined)=>n==null?"":(n/100).toFixed(2);
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
const css="w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm";
const split=(s:string)=>s.split("|").filter(Boolean);
const opt=(id:string,name:string)=>({id,name});
type Option={id:string;name:string};
function Field({label,value,onChange,options,multiple=false,type="text",required=false}:{label:string;value:string;onChange:(s:string)=>void;options?:Option[];multiple?:boolean;type?:string;required?:boolean}){
 const {t}=useLanguage();
 return <label className="grid gap-1.5 text-sm font-medium min-w-0">{label}
 {options? multiple?<select className={css+" min-h-28"} multiple value={split(value)} onChange={e=>onChange(Array.from(e.target.selectedOptions,o=>o.value).join("|"))}>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>:<select className={css} value={value} required={required} onChange={e=>onChange(e.target.value)}><option value="">{t("sales.choose")}</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>:type==="textarea"?<textarea className={css+" min-h-20"} value={value} onChange={e=>onChange(e.target.value)}/>:type==="date"?<EnglishDatePicker value={value} onChange={onChange} ariaLabel={label} className={css+" min-h-10"} allowClear={!required}/>:<input className={css} type={type==="number"?"text":type} value={type==="number"?normalizeEnglishNumberInput(value):value} required={required} onChange={e=>onChange(type==="number"?normalizeEnglishNumberInput(e.target.value):e.target.value)} inputMode={type==="number"?"decimal":undefined} dir={type==="number"?"ltr":undefined} lang={type==="number"?"en-US":undefined} pattern={type==="number"?"[0-9]+([.][0-9]+)?":undefined}/>}
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
 const {t,direction}=useLanguage();
 const labels:Record<Tab,string>={report:t("sales.pricingControl"),reports:t("sales.reports"),categories:t("sales.categories"),products:t("sales.productsCost"),regions:t("sales.regions"),branches:t("sales.branches"),types:t("sales.priceTypes"),prices:t("sales.salesHistory"),offers:t("sales.offers"),bulk:t("sales.bulk"),excel:"Excel"};
 const [snapshot,setSnapshot]=useState<SalesPricingSnapshot>(emptySalesSnapshot);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [tab,setTab]=useState<Tab>("report"),[draft,setDraft]=useState<Draft|null>(null);
 const [deletion,setDeletion]=useState<{target:SalesDeleteTarget;revision:number;plan:ReturnType<typeof planSalesDeletion>;name:string}|null>(null);
 const [query,setQuery]=useState(""),[date,setDate]=useState(today),[branch,setBranch]=useState(""),[type,setType]=useState(""),[region,setRegion]=useState(""),[quantity,setQuantity]=useState("1");
 const [importPlan,setImportPlan]=useState<(SalesImportPreview&{revision:number;fileName:string})|null>(null);
 const [bulk,setBulk]=useState({mode:"amount",value:"",date:today(),branch:"",type:"",product:""});
 const [bulkPlan,setBulkPlan]=useState<{data:SalesPricingData;revision:number;changes:{name:string;old:number;next:number}[]}|null>(null);
 const data=snapshot.data;
 const reload=async()=>{setDeletion(null);setLoading(true);setError("");try{await db.init();setSnapshot(await db.getSalesPricing());setImportPlan(null);setBulkPlan(null);}catch(e){setError(localizeSalesMessage(t,message(e)));}finally{setLoading(false);}};
 useEffect(()=>{void reload();},[]);
 const dirty=!!draft&&JSON.stringify(draft.values)!==draft.original;
 useEffect(()=>{const listener=(e:BeforeUnloadEvent)=>{if(dirty||importPlan||bulkPlan||deletion){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",listener);return()=>window.removeEventListener("beforeunload",listener);},[dirty,importPlan,bulkPlan,deletion]);
 const save=async(next:SalesPricingData,revision=snapshot.revision)=>{if(busy)return false;setBusy(true);setError("");try{setSnapshot(await db.saveSalesPricing(next,revision));setImportPlan(null);setBulkPlan(null);toast.success(t("sales.saved"));return true;}catch(e){toast.error(localizeSalesMessage(t,message(e)));setError(localizeSalesMessage(t,message(e)));return false;}finally{setBusy(false);}};
 const open=(table:Table,row?:Row)=>{const values=defaults(table,row);setDraft({table,id:row?.id??newId("sales"),values,original:JSON.stringify(values)});};
 const close=()=>{if(busy)return;if(!dirty||window.confirm(t("sales.discard")))setDraft(null);};
 const submit=async(e:FormEvent)=>{e.preventDefault();if(!draft)return;try{let row=draftRow(draft);
 if(draft.table==="prices"){
  const old=data.prices.find(p=>p.id===draft.id);
  const candidate=row as SalesPrice;
  if(old && priceKey(old)!==priceKey(candidate)){
   if(!window.confirm(t("sales.newVersionConfirm")))return;
   row={...candidate,id:newId("sales")};
  }else if(old && old.amountMinor!==candidate.amountMinor && !window.confirm(t("sales.correctPriceConfirm")))return;
 }
 const next=editSalesData(data,draft.table,row,"save");if(await save(next))setDraft(null);}catch(e){toast.error(localizeSalesMessage(t,message(e)));}};
 const requestDelete=(target:SalesDeleteTarget)=>{
   if(busy)return;
   try{
     const plan=planSalesDeletion(data,target);
     const row=target.table==="categories"?null:(data[target.table] as Row[]).find(r=>r.id===target.id);
     const name=target.table==="categories"?target.id:row?rowCells(target.table,row).slice(0,2).join(" — "):target.id;
     if(draft&&dirty&&!window.confirm(t("sales.discard")))return;
     setDraft(null);
     setDeletion({target,revision:snapshot.revision,plan,name});
   }catch(e){toast.error(localizeSalesMessage(t,message(e)));}
 };
 const remove=()=>{if(draft)requestDelete({table:draft.table,id:draft.id});};
 const confirmDelete=async()=>{
   if(!deletion||busy)return;
   if(await save(deletion.plan.data,deletion.revision)){setDeletion(null);toast.success(t("sales.deleted"));}
 };
 const deleteButton=(target:SalesDeleteTarget,label:string)=><Button type="button" size="sm" variant="outline" disabled={busy} className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" aria-label={t("sales.deleteRecord")+" — "+label} onClick={()=>requestDelete(target)}><Trash2 className="size-4"/>{t("sales.deleteRecord")}</Button>;
 const categoryList=salesCategories(data);
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
  for(const p of data.products){if(query&&!normalizeSalesKey(p.name+" "+p.code+" "+p.category).includes(normalizeSalesKey(query)))continue;for(const b of data.branches){if(!b.active||!p.branchIds.includes(b.id)||(branch&&b.id!==branch)||(region&&b.regionId!==region))continue;for(const t of data.types){if(type&&t.id!==type)continue;const price=currentSalesPrice(data,p.id,b.id,t.id,date);try{const q=quoteSalesPrice(data,p.id,b.id,t.id,date,Number(quantity));result.push({product:p,branch:b,type:t,price,net:q?.netMinor??null,profit:q?.profitMinor??null,margin:q?.marginPercent??null,issue:!q?a("sales.missingPrice"):q.costMinor===null?a("sales.missingCost"):q.profitMinor!==null&&q.profitMinor<0?a("sales.belowCost"):""});}catch(e){result.push({product:p,branch:b,type:t,price,net:null,profit:null,margin:null,issue:message(e)});}}}}
  return result;
 },[data,query,date,branch,type,region,quantity]);
 const tableHeaders:Record<Table,string[]>={regions:[t("sales.region")],branches:[t("sales.branchNumber"),t("sales.branchName"),t("sales.region"),t("sales.status")],products:[t("sales.code"),t("sales.product"),t("sales.category"),t("sales.unit"),t("sales.currentCost"),t("sales.branches"),t("sales.notes")],types:[t("sales.code"),t("sales.priceType")],prices:[t("sales.product"),t("sales.branch"),t("sales.priceType"),t("sales.effectiveDate"),t("sales.price"),t("sales.notes")],offers:[t("sales.products"),t("sales.branches"),t("sales.priceType"),t("sales.start"),t("sales.end"),t("sales.method"),t("sales.value"),t("sales.minimum")]};
 function rowCells(table:Table,row:Row,source:SalesPricingData=data):string[]{
 const names={region:(id:string|null)=>source.regions.find(r=>r.id===id)?.name??"—",branch:(id:string)=>{const b=source.branches.find(r=>r.id===id);return b?b.number+" — "+b.name:"—";},product:(id:string)=>{const p=source.products.find(r=>r.id===id);return p?p.code+" — "+p.name:"—";},type:(id:string)=>source.types.find(r=>r.id===id)?.name??"—"};
  switch(table){
   case "regions":return [(row as SalesPricingData["regions"][number]).name];
   case "branches":{const r=row as SalesPricingData["branches"][number];return [r.number,r.name,names.region(r.regionId),r.active?t("sales.active"):t("sales.inactive")];}
   case "products":{const r=row as SalesPricingData["products"][number];return [r.code,r.name,r.category,r.unit,fmt(r.costMinor),r.branchIds.map(names.branch).join(t("sales.separator")),r.notes];}
   case "types":{const r=row as SalesPricingData["types"][number];return [r.code,r.name];}
   case "prices":{const r=row as SalesPrice;return [names.product(r.productId),names.branch(r.branchId),names.type(r.typeId),r.effectiveDate,fmt(r.amountMinor),r.notes];}
   case "offers":{const r=row as SalesPricingData["offers"][number];return [r.productIds.map(names.product).join(t("sales.separator")),r.branchIds.length?r.branchIds.map(names.branch).join(t("sales.separator")):t("sales.allBranches"),names.type(r.typeId),r.startDate,r.endDate,r.mode==="fixed"?t("sales.fixedPrice"):r.mode==="percent"?t("sales.percent"):t("sales.amount"),fmt(r.value)+(r.mode==="percent"?"%":""),String(r.minimumQuantity)];}
  }
 }
 const reportExport=()=>downloadSalesWorkbook([{name:a("sales.pricingControl"),headers:[a("sales.reportDate"),a("sales.productCode"),a("sales.product"),a("sales.branchNumber"),a("sales.branchName"),a("sales.priceType"),a("sales.currentCost"),a("sales.basePrice"),a("sales.net"),a("sales.unitProfit"),a("sales.margin"),a("sales.remark")],rows:report.map(r=>[date,r.product.code,r.product.name,r.branch.number,r.branch.name,r.type.name,r.product.costMinor==null?"":r.product.costMinor/100,r.price?r.price.amountMinor/100:"",r.net==null?"":r.net/100,r.profit==null?"":r.profit/100,r.margin==null?"":r.margin/100,r.issue]),money:[6,7,8,9],percent:[10]}],a("sales.reportFile")+date);
 const readFile=async(file:File)=>{setImportPlan(null);try{if(file.size>20*1024*1024)throw Error(t("sales.fileTooLarge"));const plan=previewSalesExcel(await file.arrayBuffer(),data);setImportPlan({...plan,revision:snapshot.revision,fileName:file.name});}catch(e){toast.error(localizeSalesMessage(t,message(e)));}};
 const makeBulk=()=>{setBulkPlan(null);try{
  if(!validSalesDate(bulk.date)||!bulk.value.trim())throw Error(t("sales.dateValue"));
  const amount=moneyMinor(bulk.value),next=structuredClone(data),changes:{name:string;old:number;next:number}[]=[];
  if(bulk.mode==="percentDown" && amount>10000)throw Error(t("sales.percentLimit"));
  if(bulk.mode==="cost"){
    for(const p of next.products.filter(p=>!bulk.product||p.id===bulk.product)){if(p.costMinor===amount)continue;changes.push({name:p.name,old:p.costMinor??0,next:amount});p.costMinor=amount;}
  }else{
    for(const p of data.products.filter(p=>!bulk.product||p.id===bulk.product))for(const b of data.branches.filter(b=>b.active&&p.branchIds.includes(b.id)&&(!bulk.branch||b.id===bulk.branch)))for(const priceType of data.types.filter(t=>!bulk.type||t.id===bulk.type)){
      const old=currentSalesPrice(data,p.id,b.id,priceType.id,bulk.date);if(!old)continue;
      let value=bulk.mode==="fixed"?amount:bulk.mode==="amount"?old.amountMinor+amount:bulk.mode==="subtract"?old.amountMinor-amount:Number((BigInt(old.amountMinor)*BigInt(10000+(bulk.mode==="percentDown"?-amount:amount))+BigInt(5000))/BigInt(10000));
      if(value<0||!Number.isSafeInteger(value))throw Error(t("sales.invalidResult"));
      if(value===old.amountMinor)continue;
      const candidate:SalesPrice={id:newId("sales"),productId:p.id,branchId:b.id,typeId:priceType.id,effectiveDate:bulk.date,amountMinor:value,notes:t("sales.bulkNote")};
      const exists=next.prices.find(x=>priceKey(x)===priceKey(candidate));if(exists)throw Error(t("sales.sameDate"));
      next.prices.push(candidate);changes.push({name:p.name+" / "+b.name+" / "+priceType.name,old:old.amountMinor,next:value});
    }
  }
  validateSalesPricing(next);if(!changes.length)throw Error(t("sales.noChanges"));setBulkPlan({data:next,revision:snapshot.revision,changes});
 }catch(e){toast.error(localizeSalesMessage(t,message(e)));}};
 const link=(table:Table,row:Row,label:string)=><button type="button" className="text-start text-primary underline-offset-2 hover:underline font-medium" onClick={()=>open(table,row)}>{toEnglishDigits(label)}</button>;
 const field=(label:string,k:string,options?:Option[],multiple=false,type?:string,required=false)=>draft?<Field key={k} label={label} value={draft.values[k]??""} onChange={v=>setDraft(d=>d?{...d,values:{...d.values,[k]:v}}:d)} options={options} multiple={multiple} type={type} required={required}/>:null;
 const editing=!!draft&&data[draft.table].some(r=>r.id===draft.id);
 return <AppLayout title={t("sales.title")} subtitle={t("sales.subtitle")}>
  <section dir={direction} className="space-y-5">
   <div className="rounded-xl border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap justify-between items-center gap-3"><div><h1 className="text-2xl font-bold">{t("sales.center")}</h1><p className="text-sm text-muted-foreground mt-1">{t("sales.intro")}</p></div><Button variant="outline" disabled={busy||loading||!!deletion} onClick={()=>void reload()}>{t("sales.reload")}</Button></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">{[[t("sales.products"),data.products.length],[t("sales.branches"),data.branches.length],[t("sales.priceRecords"),data.prices.length],[t("sales.productsWithoutCost"),data.products.filter(p=>p.costMinor===null).length]].map(([label,n])=><div key={label} className="rounded-lg border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold tabular-nums mt-1">{n}</div></div>)}</div>
   </div>
   <nav aria-label={t("sales.sections")} className="flex flex-wrap gap-2">{tabs.map(t=><Button key={t} size="sm" variant={tab===t?"default":"outline"} onClick={()=>{setTab(t);setQuery("");}}>{labels[t]}</Button>)}</nav>
   {error&&<p role="alert" className="rounded-md border border-destructive/40 p-3 text-destructive">{error}</p>}
   {loading?<p>{t("sales.loading")}</p>:tab==="report"?<div className="rounded-xl border bg-card p-4 space-y-4">
    <div className="flex justify-between gap-2 flex-wrap"><h2 className="font-bold text-lg">{t("sales.currentPrices")}</h2><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={reportExport}>{t("sales.exportReport")}</Button><Button onClick={()=>setTab("reports")}><BarChart3 className="size-4"/>{t("sales.reports")}</Button></div></div>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3"><Field label={t("sales.search")} value={query} onChange={setQuery}/><Field label={t("sales.pricingDate")} type="date" value={date} onChange={setDate} required/><Field label={t("sales.region")} value={region} onChange={setRegion} options={regions}/><Field label={t("sales.branch")} value={branch} onChange={setBranch} options={branches}/><Field label={t("sales.priceType")} value={type} onChange={setType} options={types}/><Field label={t("sales.discountQuantity")} type="number" value={quantity} onChange={setQuantity}/></div>
    <div className="flex flex-wrap gap-4 text-sm"><span>{report.length} {t("sales.result")}</span><span className="text-red-600">{t("sales.belowCostCount")} {report.filter(r=>r.profit!==null&&r.profit<0).length}</span><span>{t("sales.missingPrices")} {report.filter(r=>!r.price).length}</span></div>
    <div className="overflow-x-auto"><table className="w-full text-sm text-start whitespace-nowrap"><thead className="bg-muted"><tr>{[t("sales.product"),t("sales.branch"),t("sales.priceType"),t("sales.currentCost"),t("sales.basePrice"),t("sales.netPrice"),t("sales.unitProfit"),t("sales.margin"),t("sales.remark")].map(h=><th key={h} className="p-3 text-start">{h}</th>)}</tr></thead><tbody>{report.map(r=><tr key={r.product.id+"|"+r.branch.id+"|"+r.type.id} className="border-b hover:bg-muted/40"><td className="p-3">{link("products",r.product,r.product.code+" — "+r.product.name)}</td><td className="p-3">{link("branches",r.branch,r.branch.number+" — "+r.branch.name)}</td><td className="p-3">{link("types",r.type,r.type.name)}</td><td className="p-3">{fmt(r.product.costMinor)}</td><td className="p-3">{r.price?link("prices",r.price,fmt(r.price.amountMinor)):<button className="underline text-primary" onClick={()=>{const values={...defaults("prices"),productId:r.product.id,branchId:r.branch.id,typeId:r.type.id,effectiveDate:date};setDraft({table:"prices",id:newId("sales"),values,original:JSON.stringify(values)});}}>{t("sales.addPrice")}</button>}</td><td className="p-3">{fmt(r.net)}</td><td className={"p-3 "+(r.profit!==null&&r.profit<0?"text-red-600":"")}>{fmt(r.profit)}</td><td className="p-3">{r.margin==null?"—":r.margin.toFixed(2)+"%"}</td><td className="p-3 text-muted-foreground">{localizeSalesMessage(t,r.issue)}</td></tr>)}</tbody></table>{!report.length&&<p className="p-6 text-center text-muted-foreground">{t("sales.emptyReport")}</p>}</div>
   </div>:tab==="reports"?<SalesReports data={data} today={today()} busy={busy} onOpen={open} onDelete={requestDelete}/>:tab==="categories"?<div className="rounded-xl border bg-card p-4 space-y-4"><div><h2 className="font-bold text-lg">{t("sales.categories")}</h2><p className="text-sm text-muted-foreground mt-1">{t("sales.categoryHint")}</p></div><Field label={t("sales.searchRecords")} value={query} onChange={setQuery}/><div className="divide-y rounded-md border">{categoryList.filter(name=>searchSalesText(name).includes(searchSalesText(query))).map(name=><div key={name} className="p-3 flex flex-wrap gap-3 items-center justify-between"><div><p className="font-medium">{toEnglishDigits(name)}</p><p className="text-sm text-muted-foreground">{data.products.filter(p=>normalizeSalesKey(p.category)===normalizeSalesKey(name)).length} {t("sales.products")}</p></div>{deleteButton({table:"categories",id:name},name)}</div>)}{!categoryList.length&&<p className="p-5 text-center text-muted-foreground">{t("sales.empty")}</p>}</div></div>:tab==="excel"?<div className="rounded-xl border bg-card p-4 space-y-4"><h2 className="font-bold text-lg">{t("sales.excel")}</h2><p className="text-sm text-muted-foreground">{t("sales.importHint")}</p><div className="flex gap-2 flex-wrap"><Button variant="outline" onClick={()=>downloadSalesWorkbook(salesTemplateSheets(),t("sales.templateFile"))}>{t("sales.downloadTemplate")}</Button><Button variant="outline" onClick={()=>downloadSalesWorkbook(salesTemplateSheets(data),t("sales.dataFile"))}>{t("sales.exportData")}</Button></div><label className="block">{t("sales.chooseFile")}<input className={css} type="file" accept=".xlsx,.xls" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void readFile(f);e.target.value="";}}/></label>{importPlan&&<div className="space-y-3 border rounded-lg p-4"><p className="font-bold">{importPlan.fileName}</p><p>{t("sales.inserted")} {importPlan.inserted} {t("sales.updated")} {importPlan.updated} {t("sales.unchanged")} {importPlan.unchanged} {t("sales.errors")} {importPlan.errors.length}</p>{importPlan.inserted+importPlan.updated>0&&<details className="rounded-md border p-3" open><summary className="cursor-pointer font-medium">{t("sales.previewDetail")}</summary><div className="max-h-72 overflow-auto space-y-2 mt-3">{(Object.keys(data) as Table[]).flatMap(table=>importPlan.data[table].flatMap(row=>{const previous=(data[table] as Row[]).find(r=>r.id===row.id);if(previous&&JSON.stringify(previous)===JSON.stringify(row))return [];const before=previous?rowCells(table,previous,data):[];const after=rowCells(table,row,importPlan.data);return [<div key={table+row.id} className="border rounded p-2 text-sm"><div className="font-medium">{labels[table]} · {previous?t("sales.edit"):t("sales.add")} · {after.slice(0,2).join(" / ")}</div>{after.map((value,index)=>!previous||before[index]!==value?<div key={index} className="flex flex-wrap gap-1"><span className="text-muted-foreground">{tableHeaders[table][index]}:</span>{previous&&<span className="line-through text-muted-foreground">{before[index]||"—"}</span>}<span>{value||"—"}</span></div>:null)}</div>];}))}</div></details>}{importPlan.errors.length>0&&<ul className="text-red-600 max-h-48 overflow-auto list-disc ps-5">{importPlan.errors.map((e,i)=><li key={i}>{localizeSalesMessage(t,e)}</li>)}</ul>}<div className="flex flex-wrap gap-2"><Button disabled={busy||importPlan.errors.length>0||importPlan.inserted+importPlan.updated===0} onClick={()=>void save(importPlan.data,importPlan.revision)}>{t("sales.applyImport")}</Button><Button variant="outline" onClick={()=>setImportPlan(null)}>{t("sales.cancel")}</Button></div></div>}</div>:tab==="bulk"?<div className="rounded-xl border bg-card p-4 space-y-4"><h2 className="font-bold text-lg">{t("sales.bulk")}</h2><p className="text-sm text-muted-foreground">{t("sales.bulkHint")}</p><div className="grid grid-cols-2 lg:grid-cols-3 gap-3"><Field label={t("sales.operation")} value={bulk.mode} onChange={v=>{setBulk({...bulk,mode:v});setBulkPlan(null);}} options={[opt("fixed",t("sales.setPrice")),opt("amount",t("sales.increaseAmount")),opt("subtract",t("sales.decreaseAmount")),opt("percentUp",t("sales.increasePercent")),opt("percentDown",t("sales.decreasePercent")),opt("cost",t("sales.setCost"))]}/>{(["value","date","branch","type","product"] as const).filter(k=>bulk.mode!=="cost"||k==="value"||k==="product").map(k=><Field key={k} label={{value:t("sales.value"),date:t("sales.effectiveDate"),branch:t("sales.branch"),type:t("sales.priceType"),product:t("sales.product")}[k]} value={bulk[k]} onChange={v=>{setBulk({...bulk,[k]:v});setBulkPlan(null);}} type={k==="date"?"date":k==="value"?"number":undefined} options={k==="branch"?branches:k==="type"?types:k==="product"?products:undefined}/>)}</div><Button onClick={makeBulk}>{t("sales.previewChanges")}</Button>{bulkPlan&&<div className="space-y-3"><p>{bulkPlan.changes.length} {t("sales.edit")}</p><div className="overflow-auto max-h-72"><table className="w-full text-sm"><thead><tr><th>{t("sales.record")}</th><th>{t("sales.previous")}</th><th>{t("sales.new")}</th></tr></thead><tbody>{bulkPlan.changes.map((r,i)=><tr key={i} className="border-b"><td className="p-2">{r.name}</td><td>{fmt(r.old)}</td><td>{fmt(r.next)}</td></tr>)}</tbody></table></div><Button disabled={busy} onClick={()=>void save(bulkPlan.data,bulkPlan.revision)}>{t("sales.confirmSave")}</Button></div>}</div>:<div className="rounded-xl border bg-card p-4 space-y-4"><div className="flex justify-between flex-wrap gap-2"><h2 className="font-bold text-lg">{labels[tab]}</h2><Button onClick={()=>open(tab)}>{t("sales.addRecord")}</Button></div><Field label={t("sales.searchRecords")} value={query} onChange={setQuery}/><div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-sm"><thead className="bg-muted"><tr>{tableHeaders[tab].map(h=><th key={h} className="text-start p-3">{h}</th>)}<th className="p-3">{t("sales.action")}</th></tr></thead><tbody>{data[tab].filter(r=>searchSalesText(query).split(/\s+/).filter(Boolean).every(token=>searchSalesText(rowCells(tab,r).join(" ")).includes(token))).map(r=><tr key={r.id} className="border-b hover:bg-muted/30">{rowCells(tab,r).map((v,i)=><td key={i} className="p-3">{i===0?link(tab,r,toEnglishDigits(v)):toEnglishDigits(v)||"—"}</td>)}<td className="p-3"><div className="flex gap-2 items-center flex-wrap"><Button size="sm" variant="outline" disabled={busy} onClick={()=>open(tab,r)}>{t("sales.openEdit")}</Button>{deleteButton({table:tab,id:r.id},rowCells(tab,r).slice(0,2).join(" — "))}</div></td></tr>)}</tbody></table>{data[tab].length===0&&<p className="text-muted-foreground text-center p-6">{t("sales.empty")}</p>}</div></div>}
   <Dialog open={!!deletion} onOpenChange={open=>{if(!open&&!busy)setDeletion(null);}}><DialogContent dir={direction} className="max-w-lg max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle className="text-destructive">{t("sales.deleteRecord")}</DialogTitle></DialogHeader>{deletion&&<div className="space-y-4"><p className="font-semibold break-words">{labels[deletion.target.table]} — {deletion.name}</p><p className="text-sm text-muted-foreground">{t("sales.deleteImpactHint")}</p><div className="rounded-md border divide-y">{(Object.entries(deletion.plan.impact.removed) as [Table,number][]).filter(([,count])=>count>0).map(([table,count])=><div key={table} className="p-3 flex justify-between gap-2 text-sm"><span>{t("sales.removeCount")} — {labels[table]}</span><strong className="text-destructive">{count}</strong></div>)}{[["products",deletion.plan.impact.changedProducts],["branches",deletion.plan.impact.changedBranches],["offers",deletion.plan.impact.changedOffers]].filter(([,count])=>Number(count)>0).map(([table,count])=><div key={table} className="p-3 flex justify-between gap-2 text-sm"><span>{t("sales.unlinkCount")} — {labels[table as Table]}</span><strong>{count}</strong></div>)}</div>{deletion.target.table==="categories"&&<p className="text-sm">{t("sales.categoryHint")}</p>}{deletion.target.table==="regions"&&<p className="text-sm">{t("sales.regionDeleteHint")}</p>}<div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy} onClick={()=>void confirmDelete()}><Trash2 className="size-4"/>{t("sales.confirmDelete")}</Button><Button variant="outline" disabled={busy} onClick={()=>setDeletion(null)}>{t("sales.cancel")}</Button></div></div>}</DialogContent></Dialog>
   <Dialog open={!!draft} onOpenChange={v=>{if(!v)close();}}><DialogContent dir={direction} className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{draft?(editing?t("sales.edit"):t("sales.add"))+" — "+labels[draft.table]:""}</DialogTitle></DialogHeader>{draft&&<form className="space-y-4" onSubmit={submit}><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
   {draft.table==="regions"&&field(t("sales.regionName"),"name",undefined,false,undefined,true)}
   {draft.table==="branches"&&<>{field(t("sales.branchExample"),"number",undefined,false,undefined,true)}{field(t("sales.branchName"),"name",undefined,false,undefined,true)}{field(t("sales.region"),"regionId",regions)}{field(t("sales.status"),"active",[opt("true",t("sales.active")),opt("false",t("sales.inactive"))])}</>}
   {draft.table==="products"&&<>{field(t("sales.productCode"),"code",undefined,false,undefined,true)}{field(t("sales.productName"),"name",undefined,false,undefined,true)}{field(t("sales.category"),"category")}{field(t("sales.unit"),"unit")}{field(t("sales.currentCost"),"costMinor",undefined,false,"number")}{field(t("sales.linkedBranches"),"branchIds",branches,true)}{field(t("sales.notes"),"notes",undefined,false,"textarea")}</>}
   {draft.table==="types"&&<>{field(t("sales.typeCode"),"code",undefined,false,undefined,true)}{field(t("sales.priceType"),"name",undefined,false,undefined,true)}</>}
   {draft.table==="prices"&&<>{field(t("sales.product"),"productId",products,false,undefined,true)}{field(t("sales.branch"),"branchId",branches.filter(b=>data.products.find(p=>p.id===draft.values.productId)?.branchIds.includes(b.id)),false,undefined,true)}{field(t("sales.priceType"),"typeId",types,false,undefined,true)}{field(t("sales.effectiveDate"),"effectiveDate",undefined,false,"date",true)}{field(t("sales.salePrice"),"amountMinor",undefined,false,"number",true)}{field(t("sales.notes"),"notes",undefined,false,"textarea")}</>}
   {draft.table==="offers"&&<>{field(t("sales.products"),"productIds",products,true)}{field(t("sales.branchesOptional"),"branchIds",branches,true)}{field(t("sales.priceType"),"typeId",types,false,undefined,true)}{field(t("sales.fromDate"),"startDate",undefined,false,"date",true)}{field(t("sales.toDate"),"endDate",undefined,false,"date",true)}{field(t("sales.method"),"mode",[opt("amount",t("sales.discountAmount")),opt("percent",t("sales.discountPercent")),opt("fixed",t("sales.temporaryPrice"))])}{field(t("sales.discountValue"),"value",undefined,false,"number",true)}{field(t("sales.minQuantity"),"minimumQuantity",undefined,false,"number")}{field(t("sales.notes"),"notes",undefined,false,"textarea")}</>}
   </div><div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{t("sales.saveRecord")}</Button>{editing&&<Button type="button" variant="destructive" disabled={busy} onClick={remove}>{t("sales.deleteRecord")}</Button>}<Button type="button" variant="outline" onClick={close} disabled={busy}>{t("sales.cancel")}</Button></div></form>}</DialogContent></Dialog>
  </section>
 </AppLayout>;
}
export default SalesPricingPage;
