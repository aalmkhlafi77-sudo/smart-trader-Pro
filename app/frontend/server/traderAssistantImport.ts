import { unzipSync } from "fflate";
import { read, utils } from "xlsx";
import { TraderAssistantError } from "./traderAssistantBatch";
import type { TraderFormat } from "../shared/traderAssistantImport";

export function readTraderAttachment(file: Buffer, format: TraderFormat) {
  if (format === "pdf" && file.subarray(0, 5).toString() === "%PDF-") {
    return { inlineData: { mimeType: "application/pdf", data: file.toString("base64") } };
  }
  if (format === "pdf" || file.readUInt16LE(0) !== 0x4b50) {
    throw new TraderAssistantError(422, "صيغة الملف لا تطابق محتواه.");
  }
  try {
    let expanded = 0;
    const entries = unzipSync(file, { filter: entry => {
      expanded += entry.originalSize;
      if (expanded > 25 * 1024 * 1024) throw new Error("Archive too large");
      return format === "docx" && entry.name === "word/document.xml";
    } });
    let text: string;
    if (format === "docx") {
      if (!entries["word/document.xml"]) throw new Error("Missing document");
      text = Buffer.from(entries["word/document.xml"]).toString("utf8")
        .replace(/<\/w:tc>/g, "\t").replace(/<\/w:(p|tr)>/g, "\n").replace(/<[^>]+>/g, "")
        .replace(/&(?:amp|lt|gt|quot|apos);/g, value =>
          ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[value] ?? value);
    } else {
      const workbook = read(file, { type: "buffer", sheetRows: 301 });
      if (workbook.SheetNames.length > 12 || workbook.SheetNames.some(name => {
        const range = workbook.Sheets[name]["!fullref"] || workbook.Sheets[name]["!ref"];
        if (!range) return false;
        const bounds = utils.decode_range(range);
        return bounds.e.r - bounds.s.r >= 300 || bounds.e.c - bounds.s.c >= 80;
      })) throw new Error("Workbook too large");
      text = workbook.SheetNames.map(name => name + "\n" + utils.sheet_to_csv(workbook.Sheets[name])).join("\n\n");
    }
    if (!text.trim() || text.length > 100_000) throw new Error("Empty or large text");
    return { text };
  } catch {
    throw new TraderAssistantError(422, "تعذّرت قراءة الملف. تأكد من الصيغة أو قسّم الملف إلى ملفات أصغر.");
  }
}
