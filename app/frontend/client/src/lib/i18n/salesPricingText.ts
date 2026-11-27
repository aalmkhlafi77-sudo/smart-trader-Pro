import arabic from "./ar/salesPricing";
export const salesArabic=(key:string)=>arabic[key]??key;
export function localizeSalesMessage(t:(key:string)=>string,value:string):string{
 const entries=Object.entries(arabic).sort((a,b)=>b[1].length-a[1].length);
 const exact=entries.find(([,label])=>label===value);
 if(exact)return t(exact[0]);
 // Excel errors include Arabic sheet names and row references; preserve contract details.
 const prefix=entries.find(([,label])=>label.endsWith(" ")&&value.startsWith(label));
 return prefix?t(prefix[0])+value.slice(prefix[1].length):value;
}
