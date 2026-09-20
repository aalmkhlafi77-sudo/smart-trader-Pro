import { useSyncExternalStore } from "react";
import { getCargoDataRevision, subscribeCargoData } from "./db/cargoDataEvents";

export function useCargoDataRevision(): number {
  return useSyncExternalStore(
    subscribeCargoData,
    getCargoDataRevision,
    () => 0
  );
}
