/** Display/input helpers. Never rewrite stored identifiers or user-authored text. */
export const ENGLISH_GREGORIAN_LOCALE = "en-US-u-ca-gregory-nu-latn";
export function toEnglishDigits(value:string):string {
  return value.replace(/[\u0660-\u0669]/g,c=>String(c.charCodeAt(0)-0x660))
    .replace(/[\u06f0-\u06f9]/g,c=>String(c.charCodeAt(0)-0x6f0));
}
export function normalizeEnglishNumberInput(value:string):string {
  return toEnglishDigits(value).replace(/\u066B/g,".").replace(/\u066C/g,"");
}
export function parseEnglishCalendarDate(value:string):Date|undefined {
  const match=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2})?)?$/.exec(toEnglishDigits(value));
  if(!match)return undefined;
  const [,year,month,day,hour="00",minute="00"]=match;
  const d=new Date(0);
  d.setFullYear(Number(year),Number(month)-1,Number(day));
  d.setHours(Number(hour),Number(minute),0,0);
  return d.getFullYear()===Number(year)&&d.getMonth()===Number(month)-1&&d.getDate()===Number(day)&&d.getHours()===Number(hour)&&d.getMinutes()===Number(minute)?d:undefined;
}
export const formatEnglishCalendarDate=(date:Date)=>String(date.getFullYear()).padStart(4,"0")+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
