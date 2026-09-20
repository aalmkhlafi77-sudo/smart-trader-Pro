import { useEffect, useState } from "react";
import {
  db,
  type CargoCostRunRow,
  type EntityRow,
  type ItemPriceRow,
  type ItemRow,
  type LogisticsRateRow,
  type LogisticsLocationRow,
  type LogisticsRouteTemplateRow,
  type SettingsRow,
} from "@/lib/db";
import { useCargoDataRevision } from "@/lib/useCargoDataRevision";

/** عملتا العرض الاحتياطيتان (رمزا ISO منذ S5). */
const CURRENCY_FALLBACKS = { local: "SAR", foreign: "USD" };

export function useCargoData() {
  const cargoRevision = useCargoDataRevision();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [priceRows, setPriceRows] = useState<Record<string, ItemPriceRow>>({});
  const [locations, setLocations] = useState<LogisticsLocationRow[]>([]);
  const [rates, setRates] = useState<LogisticsRateRow[]>([]);
  const [templates, setTemplates] = useState<LogisticsRouteTemplateRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [runs, setRuns] = useState<CargoCostRunRow[]>([]);

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
      runList,
    ] = await Promise.all([
      db.listItems(),
      db.getSettings(),
      db.listPrices(),
      db.listLogisticsLocations(),
      db.listLogisticsRates(),
      db.listLogisticsRouteTemplates(),
      db.listEntities(),
      db.listCargoCostRuns(),
    ]);
    setItems([...itemList].sort((a, b) => a.name.localeCompare(b.name, "ar")));
    setSettings(settingsRow);
    setPriceRows(Object.fromEntries(priceList.map(row => [row.itemId, row])));
    setLocations(locationList.filter(row => row.active === 1));
    setRates(rateList.filter(row => row.active === 1));
    setTemplates(templateList.filter(row => row.active === 1));
    setEntities(entityList);
    setRuns(
      [...runList].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    );
    return settingsRow;
  };

  useEffect(() => {
    void load();
  }, [cargoRevision]);

  return {
    items,
    settings,
    priceRows,
    locations,
    rates,
    templates,
    entities,
    runs,
    localCurrency: settings?.localCurrency ?? CURRENCY_FALLBACKS.local,
    foreignCurrency: settings?.foreignCurrency ?? CURRENCY_FALLBACKS.foreign,
    reload: load,
  };
}
