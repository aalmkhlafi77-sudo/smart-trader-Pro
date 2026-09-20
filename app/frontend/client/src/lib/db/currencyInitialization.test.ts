import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { db } from "./index";
import { DB_NAME, DEFAULT_CURRENCIES } from "./schema";

describe("fresh IndexedDB initialization", () => {
  it("initializes and seeds every default currency", async () => {
    await db.init();

    const currencies = await db.listCurrencies();
    expect(currencies.map(row => row.code).sort()).toEqual(
      DEFAULT_CURRENCIES.map(row => row.code).sort()
    );
  });
});
