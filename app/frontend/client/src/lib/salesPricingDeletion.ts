import { validateSalesPricing, normalizeSalesKey, type SalesPricingData } from "./salesPricing";

export type SalesRecordTable = keyof SalesPricingData;
export type SalesDeleteTarget = { table: SalesRecordTable; id: string } | { table: "categories"; id: string };
export type SalesDeleteImpact = { removed: Record<SalesRecordTable, number>; changedProducts: number; changedBranches: number; changedOffers: number };
export const salesCategories = (data: SalesPricingData): string[] =>
  Array.from(new Map(data.products.filter(p => p.category.trim()).map(p => [normalizeSalesKey(p.category), p.category.trim()])).values()).sort((a,b) => a.localeCompare(b,"ar"));

/** Plan without mutating the current snapshot. Apply only after explicit confirmation. */
export function planSalesDeletion(data: SalesPricingData, target: SalesDeleteTarget): { data: SalesPricingData; impact: SalesDeleteImpact } {
  const next = structuredClone(data);
  const {table,id}=target;
  if (table==="categories") {
    const key=normalizeSalesKey(id);
    if (!key || !next.products.some(p=>normalizeSalesKey(p.category)===key)) throw new Error("SALES_RECORD_MISSING");
    next.products=next.products.map(p=>normalizeSalesKey(p.category)===key?{...p,category:""}:p);
  } else {
    if (!next[table].some(r=>r.id===id)) throw new Error("SALES_RECORD_MISSING");
    switch(table) {
      case "regions":
        next.regions=next.regions.filter(r=>r.id!==id);
        next.branches=next.branches.map(b=>b.regionId===id?{...b,regionId:null}:b);
        break;
      case "branches":
        next.branches=next.branches.filter(b=>b.id!==id);
        next.products=next.products.map(p=>p.branchIds.includes(id)?{...p,branchIds:p.branchIds.filter(b=>b!==id)}:p);
        next.prices=next.prices.filter(p=>p.branchId!==id);
        next.offers=next.offers.flatMap(o=>{
          if (!o.branchIds.includes(id)) return [o];
          const branchIds=o.branchIds.filter(b=>b!==id);
          // An explicitly targeted offer must never become an all-branches offer.
          return branchIds.length?[{...o,branchIds}]:[];
        });
        break;
      case "products":
        next.products=next.products.filter(p=>p.id!==id);
        next.prices=next.prices.filter(p=>p.productId!==id);
        next.offers=next.offers.flatMap(o=>{
          if (!o.productIds.includes(id)) return [o];
          const productIds=o.productIds.filter(p=>p!==id);
          return productIds.length?[{...o,productIds}]:[];
        });
        break;
      case "types":
        next.types=next.types.filter(t=>t.id!==id);
        next.prices=next.prices.filter(p=>p.typeId!==id);
        next.offers=next.offers.filter(o=>o.typeId!==id);
        break;
      case "prices": next.prices=next.prices.filter(p=>p.id!==id); break;
      case "offers": next.offers=next.offers.filter(o=>o.id!==id); break;
    }
  }
  validateSalesPricing(next);
  const removed=Object.fromEntries((Object.keys(data) as SalesRecordTable[]).map(k=>[k,data[k].length-next[k].length])) as SalesDeleteImpact["removed"];
  function countChanges<T extends {id:string}>(before:T[],after:T[]):number {
    const previous=new Map(before.map(r=>[r.id,JSON.stringify(r)]));
    return after.filter(r=>previous.get(r.id)!==JSON.stringify(r)).length;
  }
  return {data:next,impact:{removed,changedProducts:countChanges(data.products,next.products),changedBranches:countChanges(data.branches,next.branches),changedOffers:countChanges(data.offers,next.offers)}};
}
