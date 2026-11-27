import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { unzipSync, strFromU8 } from "fflate";
import { indexedDbRepository as db } from "./db/indexedDbRepository";
import { emptySalesPricing, editSalesData, moneyMinor, currentSalesPrice, quoteSalesPrice, validateSalesPricing, type SalesPricingData } from "./salesPricing";
import { buildSalesWorkbook, previewSalesExcel, salesTemplateSheets } from "./salesPricingExcel";
const data:SalesPricingData={
 ...emptySalesPricing(),
 regions:[{id:"r",name:"الوسطى"}],
 branches:[{id:"b",number:"001",name:"الرياض",regionId:"r",active:true}],
 products:[{id:"p",code:"0007",name:"موكيت",category:"",unit:"متر",costMinor:2400,branchIds:["b"],notes:""}],
 types:[{id:"t",code:"cash",name:"نقدي"}],
 prices:[
 {id:"old",productId:"p",branchId:"b",typeId:"t",effectiveDate:"2026-01-01",amountMinor:3000,notes:""},
 {id:"new",productId:"p",branchId:"b",typeId:"t",effectiveDate:"2026-02-01",amountMinor:3500,notes:""}
 ],
 offers:[{id:"o",productIds:["p"],branchIds:[],typeId:"t",startDate:"2026-03-01",endDate:"2026-03-31",mode:"amount",value:25,minimumQuantity:10,notes:""}]
};
const buffer=(bytes:Uint8Array)=>new Uint8Array(bytes).buffer;
describe("independent sales pricing",()=>{
 it("selects effective date and applies exact minor-unit discounts only during the offer",()=>{
  validateSalesPricing(data);
  expect(moneyMinor("0.25")).toBe(25);
  expect(()=>moneyMinor("0.001")).toThrow();
  expect(currentSalesPrice(data,"p","b","t","2026-01-15")?.amountMinor).toBe(3000);
  expect(quoteSalesPrice(data,"p","b","t","2026-03-15",10)?.netMinor).toBe(3475);
  expect(quoteSalesPrice(data,"p","b","t","2026-03-15",9)?.netMinor).toBe(3500);
  expect(quoteSalesPrice(data,"p","b","t","2026-04-01",10)?.netMinor).toBe(3500);
  expect(quoteSalesPrice(data,"p","b","t","2026-03-15",10)?.profitMinor).toBe(1075);
 });
 it("keeps historical sales prices after updating the single current cost",()=>{
  const next=editSalesData(data,"products",{...data.products[0],costMinor:2600},"save");
  expect(next.prices).toEqual(data.prices);
  expect(next.products[0].costMinor).toBe(2600);
  expect(data.products[0].costMinor).toBe(2400);
 });
 it("rejects duplicate keys, orphaned references and overlapping offers",()=>{
  expect(()=>editSalesData(data,"branches",{...data.branches[0],id:"dup"},"save")).toThrow();
  expect(()=>editSalesData(data,"branches",{id:"b"},"delete")).toThrow();
  expect(()=>editSalesData(data,"prices",{...data.prices[0],id:"dup"},"save")).toThrow();
  expect(()=>editSalesData(data,"offers",{...data.offers[0],id:"dup"},"save")).toThrow();
 });
 it("round trips Arabic RTL workbook and preserves leading zero identifiers",()=>{
  const bytes=buildSalesWorkbook(salesTemplateSheets(data));
  const zip=unzipSync(bytes);
  expect(strFromU8(zip["xl/worksheets/sheet2.xml"])).toContain('rightToLeft="1"');
  expect(strFromU8(zip["xl/worksheets/sheet2.xml"])).toContain('state="frozen"');
  expect(strFromU8(zip["xl/worksheets/sheet2.xml"])).toContain("autoFilter");
  const parsed=previewSalesExcel(buffer(bytes),data);
  expect(parsed.errors).toEqual([]);
  expect(parsed.inserted+parsed.updated).toBe(0);
  expect(parsed.data.branches[0].number).toBe("001");
  expect(parsed.data.products[0].code).toBe("0007");
 });
 it("round trips monetary amounts formatted with a thousands separator",()=>{
  const large=structuredClone(data);
  large.products[0].costMinor=123456;
  large.prices[0].amountMinor=150025;
  const parsed=previewSalesExcel(buffer(buildSalesWorkbook(salesTemplateSheets(large))),large);
  expect(parsed.errors).toEqual([]);
  expect(parsed.updated+parsed.inserted).toBe(0);
  expect(parsed.data.products[0].costMinor).toBe(123456);
  expect(parsed.data.prices[0].amountMinor).toBe(150025);
 });
 it("blocks conflicting duplicate branch rows before saving",()=>{
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["رقم الفرع","اسم الفرع"],["002","جدة"],["002","مكة"]]),"الفروع");
  const plan=previewSalesExcel(XLSX.write(wb,{type:"array",bookType:"xlsx"}),data);
  expect(plan.errors.length).toBeGreaterThan(0);
  expect(data.branches).toHaveLength(1);
 });
 it("commits a complete plan atomically, rejects stale revision, and restores sales backup",async()=>{
  await db.init();
  const before=await db.getSalesPricing();
  const saved=await db.saveSalesPricing(data,before.revision);
  expect(saved.data).toEqual(data);
  await expect(db.saveSalesPricing(emptySalesPricing(),before.revision)).rejects.toThrow();
  expect((await db.getSalesPricing()).data).toEqual(data);
  const backup=await db.exportBackup();
  expect(backup.tables.sales_pricing?.[0].data).toEqual(data);
  await db.clearAll();
  expect((await db.getSalesPricing()).data.products).toEqual([]);
  await db.importBackup(backup,"replace");
  expect((await db.getSalesPricing()).data).toEqual(data);
 });
});
