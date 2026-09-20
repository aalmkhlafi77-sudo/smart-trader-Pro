import { describe, expect, it, vi } from "vitest";
import {
  getCargoDataRevision,
  invalidateCargoData,
  subscribeCargoData,
  withCargoDataBatch,
} from "./cargoDataEvents";

describe("cargo data invalidation store", () => {
  it("notifies a subscribed listener and advances the revision", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCargoData(listener);
    const before = getCargoDataRevision();

    invalidateCargoData();

    expect(getCargoDataRevision()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("coalesces nested asynchronous batches into one notification", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCargoData(listener);

    await withCargoDataBatch(async () => {
      invalidateCargoData();
      await withCargoDataBatch(async () => {
        invalidateCargoData();
      });
    });

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("flushes after a batch fails after marking data changed", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCargoData(listener);

    await expect(
      withCargoDataBatch(async () => {
        invalidateCargoData();
        throw new Error("write failed after mutation");
      })
    ).rejects.toThrow("write failed after mutation");

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("makes unsubscribe idempotent and removes the listener", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCargoData(listener);

    unsubscribe();
    unsubscribe();
    invalidateCargoData();

    expect(listener).not.toHaveBeenCalled();
  });
});
