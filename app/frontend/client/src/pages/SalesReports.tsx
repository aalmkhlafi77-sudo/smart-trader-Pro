import EnglishDatePicker from "@/components/EnglishDatePicker";
import { normalizeEnglishNumberInput, toEnglishDigits } from "@/lib/englishDisplay";
import { useMemo, useState, useDeferredValue } from "react";
import { Search, RotateCcw, Download, ArrowDownUp, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { downloadSalesWorkbook } from "@/lib/salesPricingExcel";
import { buildSalesReport, initialSalesReportFilters, salesReportFiltersValid, salesReportSheets, type SalesReportFilters, type SalesReportRow, type SalesReportSort } from "@/lib/salesPricingReport";
import { salesCategories, type SalesRecordTable, type SalesDeleteTarget } from "@/lib/salesPricingDeletion";
import type { SalesPricingData } from "@/lib/salesPricing";

type Row=SalesPricingData[SalesRecordTable][number];
type Props={data:SalesPricingData;today:string;busy:boolean;onOpen:(table:SalesRecordTable,row:Row)=>void;onDelete:(target:SalesDeleteTarget)=>void};
const fmt=(n:number|null)=>n===null?"—":(n/100).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const control="w-full min-w-0 min-h-10 rounded-md border border-border bg-background px-3 py-2 text-sm";
const sorts:SalesReportSort[]=["product","code","category","branch","region","type","date","cost","base","net","profit","margin"];
const PAGE_SIZE=50;
export default function SalesReports({data,today,busy,onOpen,onDelete}:Props){
 const {t}=useLanguage();
 const label=(k:string)=>t("sales."+k);
 const [filters,setFilters]=useState(()=>initialSalesReportFilters(today));
 const [page,setPage]=useState(1);
 const deferredQuery=useDeferredValue(filters.query);
 const applied=useMemo(()=>({...filters,query:deferredQuery}),[filters,deferredQuery]);
 const rows=useMemo(()=>buildSalesReport(data,applied),[data,applied]);
 const valid=salesReportFiltersValid(filters);
 const pending=deferredQuery!==filters.query;
 const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE)),current=Math.min(page,pages);
 const visible=rows.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
 function change<K extends keyof SalesReportFilters>(key:K,value:SalesReportFilters[K]){
  setPage(1);
  setFilters(f=>({...f,[key]:value,...(key==="region"?{branch:""}:{}),...(key==="mode"?{status:""}:{})}));
 }
 const options=(values:string[])=>values.map(v=>({value:v,label:v}));
 const select=<K extends keyof SalesReportFilters>(key:K,title:string,items:{value:string;label:string}[],all=true)=><label className="grid gap-1.5 text-sm font-medium min-w-0">{label(title)}<select className={control} value={String(filters[key])} onChange={e=>change(key,e.target.value as SalesReportFilters[K])}>{all&&<option value="">{label("all")}</option>}{items.map(o=><option key={o.value} value={o.value}>{toEnglishDigits(o.label)}</option>)}</select></label>;
 const input=(key:"date"|"from"|"to"|"quantity"|"minPrice"|"maxPrice",title:string,type:"date"|"number")=><label className="grid gap-1.5 text-sm font-medium min-w-0">{label(title)}{type==="date"?<EnglishDatePicker value={filters[key]} onChange={value=>change(key,value)} ariaLabel={label(title)} className={control} allowClear={key!=="date"}/>:<input className={control} type="text" inputMode="decimal" dir="ltr" lang="en-US" value={normalizeEnglishNumberInput(filters[key])} onChange={e=>change(key,normalizeEnglishNumberInput(e.target.value))}/>}</label>;
 const link=(table:SalesRecordTable,row:Row,name:string)=><button type="button" className="text-start text-primary font-medium hover:underline underline-offset-2 break-words" onClick={()=>onOpen(table,row)}>{toEnglishDigits(name)}</button>;
 const deletePrice=(r:SalesReportRow)=>r.price&&<Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} aria-label={label("deleteRecord")+" "+r.product.code+" "+r.price.effectiveDate} onClick={()=>onDelete({table:"prices",id:r.price!.id})}><Trash2 className="size-4"/>{label("deleteRecord")}</Button>;
 const profitClass=(r:SalesReportRow)=>r.profit===null?"text-muted-foreground":r.profit<0?"text-red-600 dark:text-red-400":r.profit>0?"text-emerald-700 dark:text-emerald-400":"";
 const exportRows=()=>downloadSalesWorkbook(salesReportSheets(rows,applied),"sales-report-"+today);
 return <section className="space-y-4 min-w-0">
  <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div><h2 className="text-xl font-bold">{label("reports")}</h2><p className="text-sm text-muted-foreground mt-1">{label("reportHint")}</p></div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{setFilters(initialSalesReportFilters(today));setPage(1);}}><RotateCcw className="size-4"/>{label("reset")}</Button><Button disabled={!valid||pending||!rows.length} onClick={exportRows}><Download className="size-4"/>{label("exportReport")}</Button></div>
   </div>
   <div className="relative"><Search className="absolute start-3 top-3 size-4 text-muted-foreground pointer-events-none"/><input type="search" aria-label={label("advancedSearch")} placeholder={label("searchHint")} className={control+" ps-10 min-h-12"} value={filters.query} onChange={e=>change("query",e.target.value)}/></div>
   <div className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4 gap-3">
    {select("mode","reportMode",[{value:"current",label:label("currentReport")},{value:"history",label:label("historyReport")}],false)}
    {filters.mode==="current"?<>{input("date","pricingDate","date")}{input("quantity","discountQuantity","number")}</>:<>{input("from","fromDate","date")}{input("to","toDate","date")}</>}
    {select("region","region",data.regions.map(r=>({value:r.id,label:r.name})))}
    {select("branch","branch",data.branches.filter(b=>!filters.region||b.regionId===filters.region).map(b=>({value:b.id,label:b.number+" — "+b.name})))}
    {select("product","product",data.products.map(p=>({value:p.id,label:p.code+" — "+p.name})))}
    {select("category","category",options(salesCategories(data)))}
    {select("unit","unit",options(Array.from(new Set(data.products.map(p=>p.unit.trim()).filter(Boolean))).sort()))}
    {select("type","priceType",data.types.map(t=>({value:t.id,label:t.name})))}
    {select("branchStatus","branchStatus",["active","inactive"].map(v=>({value:v,label:label(v)})))}
    {select("status","status",["loss","profit","breakEven","missingCost",...(filters.mode==="current"?["missingPrice","offer"]:[])].map(v=>({value:v,label:label(v)})))}
    {input("minPrice","minPrice","number")}{input("maxPrice","maxPrice","number")}
    {select("sort","sortBy",sorts.map(v=>({value:v,label:label("sort_"+v)})),false)}
    <label className="grid gap-1.5 text-sm font-medium">{label("sortDirection")}<Button type="button" variant="outline" className="justify-start min-h-10" onClick={()=>change("descending",!filters.descending)}><ArrowDownUp className="size-4"/>{label(filters.descending?"descending":"ascending")}</Button></label>
   </div>
   {!valid&&<p role="alert" className="text-sm text-destructive">{label("invalidFilters")}</p>}
  </div>
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[[label("result"),rows.length],[label("loss"),rows.filter(r=>r.profit!==null&&r.profit<0).length],[label("missingPrice"),rows.filter(r=>!r.price).length],[label("missingCost"),rows.filter(r=>r.product.costMinor===null).length]].map(([name,n])=><div key={name} className="rounded-xl border bg-card p-3 sm:p-4"><p className="text-xs text-muted-foreground">{name}</p><p className="mt-1 font-bold text-2xl tabular-nums">{n}</p></div>)}</div>
  <div className="rounded-xl border bg-card overflow-hidden min-w-0">
   <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2"><strong>{label(filters.mode==="current"?"currentReport":"historyReport")}</strong><span className="text-xs text-muted-foreground">{label("currentCostBasis")}</span></div>
   {!rows.length?<p className="p-8 text-center text-muted-foreground">{label("emptyReport")}</p>:<>
   <div className="hidden lg:block overflow-x-auto"><table className="w-full text-sm whitespace-nowrap"><thead className="bg-muted"><tr>{["product","category","region","branch","priceType","effectiveDate","currentCost","basePrice","netPrice","unitProfit","margin","offers","remark","action"].map(k=><th key={k} scope="col" className="p-3 text-start">{label(k)}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={r.id} className="border-b hover:bg-muted/30"><td className="p-3">{link("products",r.product,r.product.code+" — "+r.product.name)}</td><td className="p-3">{r.product.category||"—"}</td><td className="p-3">{r.regionName||"—"}</td><td className="p-3">{link("branches",r.branch,r.branch.number+" — "+r.branch.name)}</td><td className="p-3">{link("types",r.type,r.type.name)}</td><td className="p-3"><span dir="ltr">{toEnglishDigits(r.price?.effectiveDate||"—")}</span></td><td className="p-3 tabular-nums">{fmt(r.product.costMinor)}</td><td className="p-3">{r.price?link("prices",r.price,fmt(r.base)):"—"}</td><td className="p-3 tabular-nums">{fmt(r.net)}</td><td className={"p-3 tabular-nums "+profitClass(r)}>{fmt(r.profit)}</td><td className={"p-3 "+profitClass(r)}>{r.margin===null?"—":r.margin.toFixed(2)+"%"}</td><td className="p-3">{r.offer?link("offers",r.offer,label("activeOffer")):"—"}</td><td className="p-3 text-muted-foreground">{r.issue?label(r.issue):"—"}</td><td className="p-3">{deletePrice(r)}</td></tr>)}</tbody></table></div>
   <div className="lg:hidden divide-y">{visible.map(r=><article key={r.id} className="p-4 space-y-3 min-w-0"><div className="flex flex-wrap justify-between items-start gap-2"><div>{link("products",r.product,r.product.code+" — "+r.product.name)}<p className="text-xs text-muted-foreground">{[r.product.category,r.product.unit,r.regionName].filter(Boolean).join(" · ")}</p></div><div className="text-xs">{r.price?.effectiveDate||"—"}</div></div><div className="flex flex-wrap gap-3 text-sm">{link("branches",r.branch,r.branch.number+" — "+r.branch.name)}{link("types",r.type,r.type.name)}</div><dl className="grid grid-cols-2 gap-2 text-sm">{[[label("currentCost"),fmt(r.product.costMinor)],[label("basePrice"),r.price?link("prices",r.price,fmt(r.base)):"—"],[label("netPrice"),fmt(r.net)],[label("unitProfit"),<span className={profitClass(r)}>{fmt(r.profit)}</span>],[label("margin"),<span className={profitClass(r)}>{r.margin===null?"—":r.margin.toFixed(2)+"%"}</span>]].map(([k,v])=><div key={String(k)} className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold mt-1">{v}</dd></div>)}</dl><div className="flex items-center justify-between flex-wrap gap-2"><span className="text-xs text-muted-foreground">{r.issue?label(r.issue):""}{r.offer&&link("offers",r.offer,label("activeOffer"))}</span>{deletePrice(r)}</div></article>)}</div>
   <div className="p-3 border-t flex items-center justify-between gap-2 flex-wrap"><Button variant="outline" size="sm" disabled={current<=1} onClick={()=>setPage(current-1)}>{label("previous")}</Button><span className="text-sm tabular-nums">{label("page")} {current} / {pages} · {rows.length} {label("result")}</span><Button variant="outline" size="sm" disabled={current>=pages} onClick={()=>setPage(current+1)}>{label("nextPage")}</Button></div>
   </>}
  </div>
 </section>;
}
