import {describe, expect, it} from "vitest";
import * as XLSX from "xlsx";
import {planSalesDeletion, salesCategories} from "./salesPricingDeletion";
import {buildSalesReport, initialSalesReportFilters, salesReportSheets, salesReportFiltersValid, searchSalesText} from "./salesPricingReport";
import {buildSalesWorkbook} from "./salesPricingExcel";
import {emptySalesPricing, validateSalesPricing, type SalesPricingData} from "./salesPricing";

const data:SalesPricingData={
 ...emptySalesPricing(),
 regions:[{id:"r",name:"الوسطى"}],
 branches:[{id:"b1",number:"001",name:"الرياض",regionId:"r",active:true},{id:"b2",number:"002",name:"جدة",regionId:null,active:false}],
 products:[
 {id:"p1",code:"0007",name:"أثاث",category:"منزل",unit:"قطعة",costMinor:1000,branchIds:["b1","b2"],notes:"فاخر"},
 {id:"p2",code:"0010",name:"موكيت",category:"سجاد",unit:"متر",costMinor:3000,branchIds:["b1"],notes:""},
 {id:"p3",code:"0011",name:"ستائر",category:"منزل",unit:"قطعة",costMinor:null,branchIds:["b1"],notes:""}
 ],
 types:[{id:"cash",code:"cash",name:"نقدي"}],
 prices:[
 {id:"old",productId:"p1",branchId:"b1",typeId:"cash",effectiveDate:"2026-01-01",amountMinor:1500,notes:""},
 {id:"new",productId:"p1",branchId:"b1",typeId:"cash",effectiveDate:"2026-02-01",amountMinor:2000,notes:""},
 {id:"b2price",productId:"p1",branchId:"b2",typeId:"cash",effectiveDate:"2026-02-01",amountMinor:2200,notes:""},
 {id:"loss",productId:"p2",branchId:"b1",typeId:"cash",effectiveDate:"2026-02-01",amountMinor:2500,notes:""}
 ],
 offers:[
 {id:"limited",productIds:["p1"],branchIds:["b1"],typeId:"cash",startDate:"2026-03-01",endDate:"2026-03-31",mode:"amount",value:50,minimumQuantity:1,notes:""},
 {id:"global",productIds:["p2"],branchIds:[],typeId:"cash",startDate:"2026-03-01",endDate:"2026-03-31",mode:"amount",value:25,minimumQuantity:1,notes:""}
 ]
};
describe("sales deletion",()=>{
 it("deletes a branch with explicit dependencies, without widening an offer",()=>{
  validateSalesPricing(data);
  const {data:next,impact}=planSalesDeletion(data,{table:"branches",id:"b1"});
  expect(next.branches.map(b=>b.id)).toEqual(["b2"]);
  expect(next.prices.map(p=>p.id)).toEqual(["b2price"]);
  expect(next.offers.map(o=>o.id)).toEqual(["global"]);
  expect(next.products[0].branchIds).toEqual(["b2"]);
  expect(impact.removed.prices).toBe(3);
  expect(impact.changedProducts).toBe(3);
  expect(data.branches).toHaveLength(2);
  validateSalesPricing(next);
 });
 it("deletes product and price type dependents; direct price deletion retains remaining history",()=>{
  const p=planSalesDeletion(data,{table:"products",id:"p1"});
  expect(p.data.prices.map(r=>r.id)).toEqual(["loss"]);
  expect(p.impact.removed.offers).toBe(1);
  const t=planSalesDeletion(data,{table:"types",id:"cash"});
  expect(t.data.prices).toHaveLength(0);
  expect(t.data.offers).toHaveLength(0);
  const r=planSalesDeletion(data,{table:"prices",id:"new"});
  expect(r.data.prices.find(p=>p.id==="old")).toBeDefined();
 });
 it("deletes category or region without destroying products and historical prices",()=>{
  const c=planSalesDeletion(data,{table:"categories",id:"منزل"});
  expect(c.data.products.filter(p=>p.category==="")).toHaveLength(2);
  expect(c.data.prices).toEqual(data.prices);
  expect(salesCategories(c.data)).toEqual(["سجاد"]);
  const r=planSalesDeletion(data,{table:"regions",id:"r"});
  expect(r.data.branches[0].regionId).toBeNull();
  expect(r.data.prices).toEqual(data.prices);
  expect(r.impact.changedBranches).toBe(1);
 });
});
describe("sales reports",()=>{
 const f=initialSalesReportFilters("2026-03-15");
 it("filters current prices, discounts, Arabic tokens and identifiers",()=>{
  const r=buildSalesReport(data,{...f,query:"اثاث ٠٠١ فاخر"});
  expect(r).toHaveLength(1);
  expect(r[0].net).toBe(1950);
  expect(r[0].profit).toBe(950);
  expect(buildSalesReport(data,{...f,status:"loss"}).map(r=>r.price?.id)).toEqual(["loss"]);
  expect(buildSalesReport(data,{...f,category:"منزل",branchStatus:"inactive"}).map(r=>r.price?.id)).toEqual(["b2price"]);
  expect(buildSalesReport(data,{...f,status:"missingPrice"}).map(r=>r.product.id)).toEqual(["p3"]);
  expect(searchSalesText("أَثَاث ٠٠٧")).toBe("اثاث 007");
 });
 it("sorts numeric margins with missing values last and validates price range",()=>{
  const r=buildSalesReport(data,{...f,sort:"net",descending:true});
  expect(r.map(x=>x.net)).toEqual([2475,2200,1950,null]);
  expect(buildSalesReport(data,{...f,minPrice:"20",maxPrice:"23"}).map(x=>x.net)).toEqual([2200]);
  expect(salesReportFiltersValid({...f,minPrice:"30",maxPrice:"20"})).toBe(false);
 });
 it("reports history independently of offers and exports exactly the selected ordered records",()=>{
  const filters={...f,mode:"history" as const,from:"2026-02-01",to:"2026-02-28",sort:"base" as const,descending:true};
  const r=buildSalesReport(data,filters);
  expect(r.map(x=>x.price?.id)).toEqual(["loss","b2price","new"]);
  expect(r.every(x=>x.base===x.net&&!x.offer)).toBe(true);
  const sheets=salesReportSheets(r,filters);
  const wb=XLSX.read(buildSalesWorkbook(sheets),{type:"array"});
  const values=XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true});
  expect(values.slice(1).map(row=>row[11])).toEqual([25,22,20]);
  expect(values[2][7]).toBe("002");
  expect(wb.SheetNames).toHaveLength(2);
 });
});
