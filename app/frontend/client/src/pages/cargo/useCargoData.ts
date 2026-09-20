import { useEffect, useState } from "react";
import { db,
  type EntityRow,
  type ItemPriceRow,
  type ItemRow,
  type LogisticsRateRow,
  type LogisticsLocationRow,
  type LogisticsRouteTemplateRow,
  type SettingsRow,
} from "@/lib/db";

/** عملتا العرض الاحتياطيتان (رمزا ISO منذ S5). */
const CURRENCY_FALLBACKS = { local: "SAR", foreign: "USD" };

export function useCargoData() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [priceRows, setPriceRows] = useState<Record<string, ItemPriceRow>>({});
  const [locations, setLocations] = useState<LogisticsLocationRow[]>([]);
  const [rates, setRates] = useState<LogisticsRateRow[]>([]);
  const [templates, setTemplates] = useState<LogisticsRouteTemplateRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);

  const load = async () => {
    await db.init();
    const [
      itemList,
      settingsRow,
      priceList,
      locationList,
      rateList,
      templateList,
      entityList,
    ] = await Promise.all([
      db.listItems(),
      db.getSettings(),
      db.listPrices(),
      db.listLogisticsLocations(),
      db.listLogisticsRates(),
      db.listLogisticsRouteTemplates(),
      db.listEntities(),
    ]);
    setItems([...itemList].sort((a, b) => a.name.localeCompare(b.name, "ar")));
    setSettings(settingsRow);
    setPriceRows(Object.fromEntries(priceList.map(row => [row.itemId, row])));
    setLocations(locationList.filter(row => row.active === 1));
    setRates(rateList.filter(row => row.active === 1));
    setTemplates(templateList.filter(row => row.active === 1));
    setEntities(entityList);
    return settingsRow;
  };

  useEffect(() => {
    void load();
  }, []);

  return {
    items,
    settings,
    priceRows,
    locations,
    rates,
    templates,
    entities,
    localCurrency: settings?.localCurrency ?? CURRENCY_FALLBACKS.local,
    foreignCurrency: settings?.foreignCurrency ?? CURRENCY_FALLBACKS.foreign,
    reload: load,
  };
}
