import { salesArabic as a } from "./i18n/salesPricingText";
import { normalizeSalesKey, validSalesDate, type SalesPricingData, type SalesPrice, type SalesOffer, type SalesProduct, type SalesBranch, type SalesPriceType } from "./salesPricing";

export type SalesReportMode="current"|"history";
export type SalesReportStatus=""|"loss"|"profit"|"breakEven"|"missingPrice"|"missingCost"|"offer";
export type SalesReportSort="product"|"code"|"category"|"branch"|"region"|"type"|"date"|"cost"|"base"|"net"|"profit"|"margin";
export interface SalesReportFilters {
  mode:SalesReportMode; date:string; from:string; to:string; quantity:string;
  query:string; region:string; branch:string; product:string; category:string; unit:string; type:string;
  branchStatus:""|"active"|"inactive"; status:SalesReportStatus;
  minPrice:string; maxPrice:string; sort:SalesReportSort; descending:boolean;
}
export const initialSalesReportFilters=(date:string):SalesReportFilters=>({mode:"current",date,from:"",to:"",quantity:"1",query:"",region:"",branch:"",product:"",category:"",unit:"",type:"",branchStatus:"",status:"",minPrice:"",maxPrice:"",sort:"product",descending:false});
export const searchSalesText=(s:string)=>s.normalize("NFKD").replace(/[\u064B-\u065F\u0670\u0640]/g,"").replace(/[\u0622\u0623\u0625\u0671]/g,"\u0627").replace(/\u0649/g,"\u064A").replace(/\u0629/g,"\u0647").replace(/[\u0660-\u0669]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[\u06F0-\u06F9]/g,c=>String(c.charCodeAt(0)-0x6f0)).toLowerCase().trim();
export interface SalesReportRow {
  id:string; product:SalesProduct; branch:SalesBranch; regionName:string; type:SalesPriceType;
  price?:SalesPrice; offer?:SalesOffer; date:string; base:number|null; net:number|null; profit:number|null; margin:number|null; issue:string;
}
function amountFilter(s:string):number|null {
  if(!s.trim())return null;
  const n=Number(s);
  return Number.isFinite(n)&&n>=0?n*100:NaN;
}
export function salesReportFiltersValid(f:SalesReportFilters):boolean {
 const lo=amountFilter(f.minPrice),hi=amountFilter(f.maxPrice);
 return !Number.isNaN(lo)&&!Number.isNaN(hi)&&(lo===null||hi===null||lo<=hi)
  && (f.mode==="current"?validSalesDate(f.date)&&f.quantity.trim()!==""&&Number.isFinite(Number(f.quantity))&&Number(f.quantity)>=0:
    (!f.from||validSalesDate(f.from))&&(!f.to||validSalesDate(f.to))&&(!f.from||!f.to||f.from<=f.to));
}
const compareText=(x:string,y:string)=>x.localeCompare(y,"ar",{numeric:true,sensitivity:"base"});
export function buildSalesReport(data:SalesPricingData,f:SalesReportFilters):SalesReportRow[] {
  if(!salesReportFiltersValid(f))return [];
  const products=new Map(data.products.map(p=>[p.id,p]));
  const branches=new Map(data.branches.map(b=>[b.id,b]));
  const regions=new Map(data.regions.map(r=>[r.id,r.name]));
  const types=new Map(data.types.map(t=>[t.id,t]));
  const latest=new Map<string,SalesPrice>();
  const key=(p:string,b:string,t:string)=>JSON.stringify([p,b,t]);
  if(f.mode==="current")for(const price of data.prices) {
    if(price.effectiveDate>f.date)continue;
    const k=key(price.productId,price.branchId,price.typeId),prev=latest.get(k);
    if(!prev||price.effectiveDate>prev.effectiveDate)latest.set(k,price);
  }
  const tokens=searchSalesText(f.query).split(/\s+/).filter(Boolean);
  const lo=amountFilter(f.minPrice),hi=amountFilter(f.maxPrice);
  const result:SalesReportRow[]=[];
  const add=(p:SalesProduct,b:SalesBranch,t:SalesPriceType,price:SalesPrice|undefined)=>{
    if((f.product&&p.id!==f.product)||(f.region&&b.regionId!==f.region)||(f.branch&&b.id!==f.branch)||(f.type&&t.id!==f.type)
      ||(f.category&&normalizeSalesKey(p.category)!==normalizeSalesKey(f.category))||(f.unit&&p.unit.trim()!==f.unit)
      ||(f.branchStatus==="active"&&!b.active)||(f.branchStatus==="inactive"&&b.active))return;
    const date=f.mode==="history"?price?.effectiveDate??"":f.date;
    if(f.mode==="history"&&((f.from&&date<f.from)||(f.to&&date>f.to)))return;
    const regionName=b.regionId?regions.get(b.regionId)??"":"";
    const base=price?.amountMinor??null;
    // History reports show recorded sale prices, not reconstructed promotions.
    const offers=f.mode==="current"&&base!==null?data.offers.filter(o=>o.productIds.includes(p.id)&&(!o.branchIds.length||o.branchIds.includes(b.id))&&o.typeId===t.id&&o.startDate<=date&&o.endDate>=date&&Number(f.quantity)>=o.minimumQuantity):[];
    const offer=offers.length===1?offers[0]:undefined;
    let net=base;
    if(base!==null&&offer)net=offer.mode==="fixed"?offer.value:offer.mode==="amount"?Math.max(0,base-offer.value):Number((BigInt(base)*BigInt(10000-offer.value)+BigInt(5000))/BigInt(10000));
    if(offers.length>1)net=null;
    const profit=net===null||p.costMinor===null?null:net-p.costMinor;
    const margin=profit===null||!net?null:profit/net*100;
    const issue=offers.length>1?"conflictingOffers":base===null?"missingPrice":p.costMinor===null?"missingCost":profit!==null&&profit<0?"belowCost":"";
    if(f.status==="loss"&&!(profit!==null&&profit<0)||f.status==="profit"&&!(profit!==null&&profit>0)||f.status==="breakEven"&&profit!==0||f.status==="missingPrice"&&base!==null||f.status==="missingCost"&&p.costMinor!==null||f.status==="offer"&&!offer)return;
    if((lo!==null&&(net===null||net<lo))||(hi!==null&&(net===null||net>hi)))return;
    const haystack=searchSalesText([p.code,p.name,p.category,p.unit,p.notes,b.number,b.name,regionName,t.code,t.name,price?.notes,offer?.notes,date,price?.effectiveDate,base===null?"":String(base/100),net===null?"":String(net/100),issue?a("sales."+issue):"",b.active?a("sales.active"):a("sales.inactive")].join(" "));
    if(!tokens.every(token=>haystack.includes(token)))return;
    result.push({id:price?.id??key(p.id,b.id,t.id),product:p,branch:b,type:t,regionName,price,offer,date,base,net,profit,margin,issue});
  };
  if(f.mode==="history"){
    for(const price of data.prices){
      const p=products.get(price.productId),b=branches.get(price.branchId),t=types.get(price.typeId);
      if(p&&b&&t)add(p,b,t,price);
    }
  }else{
    for(const p of data.products)for(const id of p.branchIds){const b=branches.get(id);if(!b)continue;for(const t of data.types)add(p,b,t,latest.get(key(p.id,b.id,t.id)));}
  }
  const value=(r:SalesReportRow):string|number|null=>{
    switch(f.sort){
      case "product":return r.product.name;case "code":return r.product.code;case "category":return r.product.category;
      case "branch":return r.branch.number;case "region":return r.regionName;case "type":return r.type.name;case "date":return r.date;
      case "cost":return r.product.costMinor;case "base":return r.base;case "net":return r.net;case "profit":return r.profit;case "margin":return r.margin;
    }
  };
  return result.sort((x,y)=>{
    const u=value(x),v=value(y);
    if(u===null||v===null)return u===v?compareText(x.id,y.id):u===null?1:-1;
    const cmp=typeof u==="number"&&typeof v==="number"?u-v:compareText(String(u),String(v));
    return (f.descending?-cmp:cmp)||compareText(x.product.code,y.product.code)||compareText(x.branch.number,y.branch.number)||compareText(x.id,y.id);
  });
}
export function salesReportSheets(rows:SalesReportRow[],f:SalesReportFilters) {
 const ar=(key:string)=>a("sales."+key);
 const n=(x:number|null)=>x===null?"":x/100;
 const fields=[["reportMode",ar(f.mode==="current"?"currentReport":"historyReport")],["reportDate",f.mode==="current"?f.date:[f.from||"—",f.to||"—"].join(" / ")],["discountQuantity",f.mode==="current"?f.quantity:"—"],["search",f.query||"—"],["region",f.region?rows[0]?.regionName??"—":ar("all")],["branch",f.branch?rows[0]?.branch.name??"—":ar("all")],["product",f.product?rows[0]?.product.name??"—":ar("all")],["category",f.category||ar("all")],["unit",f.unit||ar("all")],["priceType",f.type?rows[0]?.type.name??"—":ar("all")],["branchStatus",f.branchStatus?ar(f.branchStatus):ar("all")],["status",f.status?ar(f.status):ar("all")],["minPrice",f.minPrice||"—"],["maxPrice",f.maxPrice||"—"],["sortBy",ar("sort_"+f.sort)],["sortDirection",ar(f.descending?"descending":"ascending")],["result",String(rows.length)]];
 return [
  {name:ar("reports"),headers:["reportDate","effectiveDate","productCode","product","category","unit","region","branchNumber","branchName","priceType","currentCost","basePrice","netPrice","unitProfit","margin","offers","remark"].map(ar),
   rows:rows.map(r=>[r.date,r.price?.effectiveDate??"",r.product.code,r.product.name,r.product.category,r.product.unit,r.regionName,r.branch.number,r.branch.name,r.type.name,n(r.product.costMinor),n(r.base),n(r.net),n(r.profit),r.margin===null?"":r.margin/100,r.offer?ar("activeOffer"):"",r.issue?ar(r.issue):""]),
   money:[10,11,12,13],percent:[14]},
  {name:ar("reportFilters"),headers:[ar("record"),ar("value")],rows:fields.map(([k,v])=>[ar(k),v])}
 ];
}
