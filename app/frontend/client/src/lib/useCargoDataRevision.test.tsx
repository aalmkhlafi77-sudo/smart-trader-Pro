/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { invalidateCargoData } from "./db/cargoDataEvents";
import { useCargoDataRevision } from "./useCargoDataRevision";

describe("useCargoDataRevision", () => {
  it("updates on invalidation and stops observing after unmount", () => {
    const { result, unmount } = renderHook(() => useCargoDataRevision());
    const before = result.current;

    act(() => invalidateCargoData());
    expect(result.current).toBe(before + 1);

    unmount();
    expect(() => act(() => invalidateCargoData())).not.toThrow();
  });
});
