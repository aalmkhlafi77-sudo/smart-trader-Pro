/** Independent sales price control domain. Monetary values are integer minor units. */
export interface SalesRegion { id: string; name: string }
export interface SalesBranch { id: string; number: string; name: string; regionId: string | null; active: boolean }
export interface SalesProduct { id: string; code: string; name: string; category: string; unit: string; costMinor: number | null; branchIds: string[]; notes: string }
export interface SalesPriceType { id: string; code: string; name: string }
export interface SalesPrice { id: string; productId: string; branchId: string; typeId: string; effectiveDate: string; amountMinor: number; notes: string }
export interface SalesOffer { id: string; productIds: string[]; branchIds: string[]; typeId: string; startDate: string; endDate: string; mode: "fixed" | "percent" | "amount"; value: number; minimumQuantity: number; notes: string }
export interface SalesPricingSnapshot { id: "sales-pricing"; revision: number; data: SalesPricingData }
export interface SalesPricingData { regions: SalesRegion[]; branches: SalesBranch[]; products: SalesProduct[]; types: SalesPriceType[]; prices: SalesPrice[]; offers: SalesOffer[] }
export const emptySalesPricing = (): SalesPricingData => ({regions:[],branches:[],products:[],types:[],prices:[],offers:[]});
export const emptySalesSnapshot = (): SalesPricingSnapshot => ({id:"sales-pricing",revision:0,data:emptySalesPricing()});
export const normalizeSalesKey = (value: string) => value.normalize("NFC").trim().toLowerCase();
export function validSalesDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
}
export function moneyMinor(value: string): number {
  const s = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error("قيمة مالية غير صالحة");
  const [whole, fraction = ""] = s.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2,"0"));
  if (!Number.isSafeInteger(result)) throw new Error("قيمة مالية خارج النطاق");
  return result;
}
export const priceKey = (p: Pick<SalesPrice,"productId"|"branchId"|"typeId"|"effectiveDate">) => JSON.stringify([p.productId,p.branchId,p.typeId,p.effectiveDate]);
const validMoney = (n: number) => Number.isSafeInteger(n) && n >= 0;
export function validateSalesPricing(data: SalesPricingData): void {
  function unique<T>(rows: T[], key: (r:T)=>string, label:string) {
    const seen = new Set<string>();
    for (const row of rows) { const k=key(row); if (!k || seen.has(k)) throw new Error("معرف فارغ أو مكرر: "+label); seen.add(k); }
  }
  for (const rows of [data.regions,data.branches,data.products,data.types,data.prices,data.offers]) unique(rows as {id:string}[],r=>r.id,"ID");
  unique(data.branches,r=>normalizeSalesKey(r.number),"رقم الفرع");
  unique(data.products,r=>normalizeSalesKey(r.code),"كود الصنف");
  unique(data.types,r=>normalizeSalesKey(r.code),"نوع السعر");
  unique(data.prices,priceKey,"السعر وتاريخ السريان");
  unique(data.regions,r=>normalizeSalesKey(r.name),"اسم المنطقة");
  const regionIds=new Set(data.regions.map(r=>r.id)), branchIds=new Set(data.branches.map(r=>r.id)), typeIds=new Set(data.types.map(r=>r.id));
  const products=new Map(data.products.map(r=>[r.id,r]));
  for (const r of [...data.regions,...data.branches,...data.products,...data.types]) if (!r.name.trim()) throw new Error("الاسم مطلوب");
  for(const b of data.branches) if(b.regionId!==null&&!regionIds.has(b.regionId)) throw new Error("منطقة غير موجودة");
  for(const p of data.products) if ((p.costMinor!==null&&!validMoney(p.costMinor)) || p.branchIds.some(id=>!branchIds.has(id)) || new Set(p.branchIds).size!==p.branchIds.length) throw new Error("تكلفة أو فروع غير صالحة");
  for(const p of data.prices) if(!products.get(p.productId)?.branchIds.includes(p.branchId)||!typeIds.has(p.typeId)||!validSalesDate(p.effectiveDate)||!validMoney(p.amountMinor)) throw new Error("سجل سعر غير صالح");
  for(const o of data.offers) if(!typeIds.has(o.typeId)||!o.productIds.length||o.productIds.some(id=>!products.has(id))||o.branchIds.some(id=>!branchIds.has(id))||!validSalesDate(o.startDate)||!validSalesDate(o.endDate)||o.startDate>o.endDate||!validMoney(o.value)||!Number.isFinite(o.minimumQuantity)||o.minimumQuantity<0||!["fixed","percent","amount"].includes(o.mode)||(o.mode==="percent"&&o.value>10000)) throw new Error("عرض غير صالح");
  for (const [i,a] of data.offers.entries()) for (const b of data.offers.slice(i+1)) if(a.typeId===b.typeId && a.startDate<=b.endDate && b.startDate<=a.endDate && a.productIds.some(id=>b.productIds.includes(id)) && (!a.branchIds.length||!b.branchIds.length||a.branchIds.some(id=>b.branchIds.includes(id)))) throw new Error("تداخل عروض لنفس الصنف والفرع والفترة");
}
export function currentSalesPrice(data: SalesPricingData, productId:string, branchId:string, typeId:string, date:string): SalesPrice | undefined {
  if(!validSalesDate(date)) throw new Error("تاريخ غير صالح");
  return data.prices.filter(p=>p.productId===productId&&p.branchId===branchId&&p.typeId===typeId&&p.effectiveDate<=date).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate))[0];
}
export function quoteSalesPrice(data:SalesPricingData, productId:string,branchId:string,typeId:string,date:string,quantity:number) {
  if(!Number.isFinite(quantity)||quantity<0) throw new Error("كمية غير صالحة");
  const price=currentSalesPrice(data,productId,branchId,typeId,date);
  if(!price) return null;
  const product=data.products.find(p=>p.id===productId);
  const offers=data.offers.filter(o=>o.productIds.includes(productId)&&(!o.branchIds.length||o.branchIds.includes(branchId))&&o.typeId===typeId&&o.startDate<=date&&o.endDate>=date&&quantity>=o.minimumQuantity);
  if(offers.length>1) throw new Error("عروض متعارضة؛ يلزم تحديد عرض واحد");
  const offer=offers[0];
  let net=price.amountMinor;
  if(offer) net=offer.mode==="fixed"?offer.value:offer.mode==="amount"?Math.max(0,net-offer.value):Number((BigInt(net)*BigInt(10000-offer.value)+BigInt(5000))/BigInt(10000));
  const cost=product?.costMinor??null;
  return {price,offer,netMinor:net,costMinor:cost,profitMinor:cost===null?null:net-cost,marginPercent:cost===null||net===0?null:(net-cost)/net*100};
}
/** Explicit save/delete: caller persists only after validation. Linked deletions are rejected. */
export function editSalesData<K extends keyof SalesPricingData>(data:SalesPricingData, table:K, row:SalesPricingData[K][number] | {id:string}, action:"save"|"delete"):SalesPricingData {
  const next={...data,[table]: (data[table] as {id:string}[]).filter(r=>r.id!==row.id).concat(action==="save"?[row]:[]) } as SalesPricingData;
  validateSalesPricing(next);
  return next;
}
