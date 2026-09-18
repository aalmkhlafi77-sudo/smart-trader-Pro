import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageShell, SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import {
  db,
  type ItemPriceRow,
  type ItemRow,
  type ItemSpecRow,
  type PriceHistoryRow,
} from "@/lib/db";
import { newId, nowIso, todayInput } from "@/lib/id";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { PriceLevelsForm, type PriceDraft } from "./prices/PriceLevelsForm";
import { PriceTable } from "./prices/PriceTable";
import { handleExportExcelAction, handleExportPdfAction } from "./prices/priceExports";

const createEmptyDrafts = (): PriceDraft[] =>
  Array.from({ length: 4 }, () => ({ price: "", date: todayInput(), source: "" }));

const toNum = (v: string) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export default function Prices() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [prices, setPrices] = useState<ItemPriceRow[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);
  const [allSpecsByItem, setAllSpecsByItem] = useState<Record<string, ItemSpecRow[]>>({});

  const [selectedId, setSelectedId, clearSelectedDraft] = useSessionDraft<string>(
    "smart-trader:draft:prices-item",
    ""
  );
  const [drafts, setDrafts, clearPriceDrafts] = useSessionDraft<PriceDraft[]>(
    "smart-trader:draft:prices-values",
    createEmptyDrafts()
  );
  const [notes, setNotes, clearNotesDraft] = useSessionDraft("smart-trader:draft:prices-notes", "");
  const [customsRate, setCustomsRate, clearCustomsRateDraft] = useSessionDraft(
    "smart-trader:draft:prices-customs-rate",
    ""
  );

  const load = async () => {
    await db.init();
    const [itemList, priceList, historyList] = await Promise.all([
      db.listItems(),
      db.listPrices(),
      db.listPriceHistory(),
    ]);
    const sorted = [...itemList].sort((a, b) => a.name.localeCompare(b.name, "ar"));
    setItems(sorted);
    setPrices(priceList);
    setPriceHistory(historyList);

    const allMap: Record<string, ItemSpecRow[]> = {};
    for (const it of sorted) allMap[it.id] = await db.listSpecsByItem(it.id);
    setAllSpecsByItem(allMap);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDrafts(createEmptyDrafts());
      setNotes("");
      setCustomsRate("");
      return;
    }
    let cancelled = false;
    (async () => {
      const row = await db.getPriceByItem(selectedId);
      if (cancelled) return;
      const item = items.find(c => c.id === selectedId);
      setCustomsRate(item?.customsRate == null ? "" : String(item.customsRate * 100));
      if (!row) {
        setDrafts(createEmptyDrafts());
        setNotes("");
        return;
      }
      setDrafts([
        { price: row.price1?.toString() ?? "", date: row.price1Date || todayInput(), source: "" },
        { price: row.price2?.toString() ?? "", date: row.price2Date || todayInput(), source: "" },
        { price: row.price3?.toString() ?? "", date: row.price3Date || todayInput(), source: "" },
        { price: row.price4?.toString() ?? "", date: row.price4Date || todayInput(), source: "" },
      ]);
      setNotes(row.notes);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, items]);

  const newWork = () => {
    clearSelectedDraft();
    clearPriceDrafts();
    clearNotesDraft();
    clearCustomsRateDraft();
    setDrafts(createEmptyDrafts());
    toast.info(t("prices.draftCleared"));
  };

  const selectedItem = items.find(i => i.id === selectedId) ?? null;

  const save = async () => {
    if (!selectedItem) {
      toast.error(t("prices.selectFirst"));
      return;
    }
    const customsRateValue = customsRate.trim() === "" ? null : toNum(customsRate);
    if (customsRate.trim() !== "" && (customsRateValue == null || customsRateValue < 0)) {
      toast.error(t("export.validCustomsOrEmpty"));
      return;
    }
    const existing = await db.getPriceByItem(selectedItem.id);
    const row: ItemPriceRow = {
      id: existing?.id ?? newId("prc"),
      itemId: selectedItem.id,
      price1: toNum(drafts[0].price),
      price1Date: drafts[0].date || todayInput(),
      price2: toNum(drafts[1].price),
      price2Date: drafts[1].date || todayInput(),
      price3: toNum(drafts[2].price),
      price3Date: drafts[2].date || todayInput(),
      price4: toNum(drafts[3].price),
      price4Date: drafts[3].date || todayInput(),
      currency: existing?.currency || selectedItem.currency,
      notes: notes.trim(),
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    await db.savePrice(row);
    await db.saveItem({
      ...selectedItem,
      customsRate: customsRateValue == null ? null : customsRateValue / 100,
      updatedAt: nowIso(),
    });

    const before = [existing?.price1, existing?.price2, existing?.price3, existing?.price4];
    const beforeDates = [existing?.price1Date ?? "", existing?.price2Date ?? "", existing?.price3Date ?? "", existing?.price4Date ?? ""];
    const after = [row.price1, row.price2, row.price3, row.price4];
    const afterDates = [row.price1Date, row.price2Date, row.price3Date, row.price4Date];

    await Promise.all(
      after.map((value, idx) => {
        if (value == null || (before[idx] === value && beforeDates[idx] === afterDates[idx])) {
          return Promise.resolve();
        }
        return db.savePriceHistory({
          id: newId("hist"),
          itemId: selectedItem.id,
          priceLevel: (idx + 1) as 1 | 2 | 3 | 4,
          price: value,
          effectiveDate: afterDates[idx] || nowIso().slice(0, 10),
          currency: row.currency,
          notes: drafts[idx]?.source || "",
          createdAt: nowIso(),
        });
      })
    );
    toast.success(t("prices.saved"));
    await load();
  };

  const handleExportExcel = () => {
    if (items.length === 0) {
      toast.info(t("prices.noItemsExport"));
      return;
    }
    handleExportExcelAction(items, prices, allSpecsByItem, t);
    toast.success(t("prices.excelExported"));
  };

  const handleExportPdf = () => {
    if (items.length === 0) {
      toast.info(t("prices.noItemsExport"));
      return;
    }
    const ok = handleExportPdfAction(items, prices, allSpecsByItem, t);
    if (!ok) {
      toast.error(t("prices.printFailed"));
      return;
    }
    toast.success(t("prices.pdfReady"));
  };

  const currentHistory = priceHistory.filter(h => h.itemId === selectedId);

  return (
    <AppLayout title={t("prices.title")} subtitle={t("prices.subtitle")}>
      <PageShell
        title={t("prices.title")}
        description={t("prices.subtitle")}
        crumbs={[{ label: t("nav.dashboard"), href: "/" }, { label: t("prices.title") }]}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr] items-start">
          <SectionCard
            title={selectedItem ? `${t("prices.editPrices")}: ${selectedItem.name}` : t("prices.title")}
            description={t("prices.subtitle")}
            stamp={t("prices.sheetName")}
            actions={
              <Button size="sm" variant="outline" className="bg-card" onClick={newWork}>
                <Plus className="h-4 w-4" />
                {t("common.newWork")}
              </Button>
            }
          >
            <PriceLevelsForm
              items={items}
              selectedId={selectedId}
              onSelectId={setSelectedId}
              rowCurrency={prices.find(p => p.itemId === selectedId)?.currency}
              drafts={drafts}
              setDrafts={setDrafts}
              notes={notes}
              setNotes={setNotes}
              customsRate={customsRate}
              setCustomsRate={setCustomsRate}
              history={currentHistory}
              onSave={save}
              onNewWork={newWork}
            />
          </SectionCard>

          <SectionCard
            title={`${t("prices.record")} (${items.length})`}
            description={t("common.savedonthisdevice")}
            stamp={t("prices.sheetName")}
          >
            <PriceTable
              items={items}
              prices={prices}
              onSelect={item => setSelectedId(item.id)}
              onExportExcel={handleExportExcel}
              onExportPdf={handleExportPdf}
            />
          </SectionCard>
        </div>
      </PageShell>
    </AppLayout>
  );
}
