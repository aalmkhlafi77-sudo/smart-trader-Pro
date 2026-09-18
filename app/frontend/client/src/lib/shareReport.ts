import { toast } from "sonner";

/**
 * مشاركة تقرير: Web Share API عند توفرها، وإلا نسخ النص للحافظة.
 * يعمل على الشاشات والملفات المحلية دون أي إرسال شبكي.
 */
export async function shareReport(
  title: string,
  text: string,
  t: (key: string) => string
): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string }) => Promise<void>;
      canShare?: (data: { title?: string; text?: string }) => boolean;
    };
    if (nav.share && (!nav.canShare || nav.canShare({ title, text }))) {
      await nav.share({ title, text });
      return;
    }
    throw new Error("no-share");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    try {
      await navigator.clipboard.writeText(`${title}\n${text}`);
      toast.success(t("reports.shared"));
    } catch {
      toast.error(t("reports.shareFailed"));
    }
  }
}
