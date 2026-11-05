import type { Repository } from "./repository";
import { indexedDbRepository } from "./indexedDbRepository";
import { queuePrivateStorageSync } from "./privateStorageClient";

const MUTATING_METHODS = new Set<keyof Repository>([
  "saveEntity", "deleteEntity",
  "saveCategory", "deleteCategory",
  "saveSpecTemplate", "deleteSpecTemplate",
  "saveItem", "deleteItem",
  "saveSpec", "deleteSpec", "deleteSpecsByItem",
  "savePrice", "deletePriceByItem",
  "savePriceHistory",
  "saveAttachment", "deleteAttachment",
  "saveNote", "deleteNote",
  "saveTask", "deleteTask",
  "saveBackupLog",
  "savePricingRun", "deletePricingRun",
  "saveQuickCalculation", "deleteQuickCalculation",
  "saveCalculatorTemplate", "deleteCalculatorTemplate",
  "saveQuickEntryDraft", "deleteQuickEntryDraft",
  "importExcel",
  "saveCargoCostRun", "deleteCargoCostRun",
  "saveCargoCostItem", "deleteCargoCostItems",
  "saveCargoCostLine", "deleteCargoCostLines",
  "saveCargoCostAllocation", "deleteCargoCostAllocations",
  "saveLogisticsLocation", "deleteLogisticsLocation",
  "saveLogisticsRate", "deleteLogisticsRate",
  "saveLogisticsRouteTemplate", "deleteLogisticsRouteTemplate",
  "savePriceList", "deletePriceList",
  "savePriceListItem", "deletePriceListItems",
  "saveSettings",
  "saveCurrency",
  "saveUnit",
  "saveEntityContact", "deleteEntityContact",
  "saveMeta",
  "importBackup",
  "clearAll",
]);

export const hybridRepository: Repository = new Proxy(indexedDbRepository, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof value !== "function") return value;
    const key = property as keyof Repository;
    return async (...args: unknown[]) => {
      const result = await (value as (...params: unknown[]) => Promise<unknown>)(
        ...args
      );
      if (MUTATING_METHODS.has(key)) queuePrivateStorageSync();
      return result;
    };
  },
}) as Repository;
