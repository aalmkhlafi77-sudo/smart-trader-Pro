# Cargo Data Invalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every mounted cargo consumer reload fresh IndexedDB data after cargo mutations, with one coalesced notification for compound writes and no stale deleted runs in reports, dashboard, or search.

**Architecture:** Add a framework-independent revision store with subscriptions, batching, and a `useSyncExternalStore` adapter. Publish invalidations at the IndexedDB repository boundary, wrap compound persistence/import/delete paths in a batch, and add the revision to the existing cancellable loaders in each affected consumer. No polling, database-schema change, new dependency, pricing-formula change, or persistent IndexedDB connection is introduced.

**Tech Stack:** React 19, TypeScript, IndexedDB repository, `useSyncExternalStore`, Vitest, Testing Library, fake-indexeddb, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-21-cargo-invalidation-design.md`

## Global Constraints

- Build on the completed item 1 commit `7a30b0e` in the isolated branch `codex/cargo-invalidation`.
- Do not modify `app/frontend/client/src/lib/cargoPricing.ts`, `app/frontend/client/src/lib/pricing.ts`, or `app/frontend/client/src/lib/cargoDecisionReports.ts`.
- Do not change the IndexedDB schema, migration version, or connection-lifecycle design from item 1; item 3 owns persistent-connection work.
- Do not add polling, timers, cross-tab synchronization, or a new application screen.
- Keep the existing loader data shapes, filters, sorting, user selections, and report-building functions unchanged.
- Publish an event only for cargo-data writes; reads and a failed write before any data change publish nothing.
- A compound operation must publish at most one revision after its final write; if it fails after writing, publish once in `finally` so consumers discard stale state.
- Every React subscription must be removed on unmount, and every asynchronous loader must ignore results after cancellation.
- Add no runtime dependency; `useSyncExternalStore` comes from the existing React version.
- Acceptance commands are `pnpm check`, `pnpm test`, `pnpm i18n-check`, and `pnpm build`; preserve the known unrelated i18n baseline result without touching forbidden files.

## Review Focus

1. A direct cargo save/delete: one successful mutation increments the revision and refreshes consumers once.
2. A compound `persistRun`: intermediate writes do not refresh reports with partial children; one revision arrives after the final allocation.
3. A cascading run deletion: the parent and all descendants are gone before the one notification, while a surviving run remains visible.
4. Subscriber lifecycle: repeated mount/unmount does not accumulate listeners, and an old async loader cannot overwrite newer state.
5. Import/clear and failures: completed restore/clear invalidates cargo consumers; a read or a write that fails before changing data does not emit a false refresh.

---

### Task 1: Implement the framework-independent cargo revision store

**Files:**
- Create: `app/frontend/client/src/lib/db/cargoDataEvents.ts`
- Create: `app/frontend/client/src/lib/db/cargoDataEvents.test.ts`

**Interfaces:**
- Consumes: no earlier runtime interface; the module is a plain TypeScript dependency for the repository and the React adapter.
- Produces: `CargoDataListener`, `getCargoDataRevision(): number`, `subscribeCargoData(listener): () => void`, `invalidateCargoData(): void`, and `withCargoDataBatch<T>(work: () => Promise<T>): Promise<T>`.

- [ ] **Step 1: Write the failing event-store tests**

  In `cargoDataEvents.test.ts`, write real tests for these behaviors:

  ```ts
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
  ```

  Add a test that calling the returned unsubscribe twice is harmless and that no later invalidation calls the removed listener.

- [ ] **Step 2: Run the tests to confirm the expected RED state**

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/cargoDataEvents.test.ts
  ```

  Expected: FAIL because `./cargoDataEvents` does not exist yet; the test file itself must transform and collect without any other error.

- [ ] **Step 3: Implement the minimal revision store**

  Implement the module with one revision number, one `Set<CargoDataListener>`, a batch depth, and a pending flag:

  ```ts
  let revision = 0;
  let batchDepth = 0;
  let pending = false;
  const listeners = new Set<CargoDataListener>();

  function flush() {
    if (!pending) return;
    pending = false;
    revision += 1;
    for (const listener of [...listeners]) listener();
  }

  export function invalidateCargoData() {
    pending = true;
    if (batchDepth === 0) flush();
  }

  export async function withCargoDataBatch<T>(work: () => Promise<T>) {
    batchDepth += 1;
    try {
      return await work();
    } finally {
      batchDepth -= 1;
      if (batchDepth === 0) flush();
    }
  }
  ```

  Export `getCargoDataRevision` and `subscribeCargoData` around the same state. Do not import React here.

- [ ] **Step 4: Run the event-store tests to confirm GREEN**

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/cargoDataEvents.test.ts
  ```

  Expected: all event-store tests pass, including the failure-after-write notification and idempotent unsubscribe cases.

- [ ] **Step 5: Commit the isolated event contract**

  ```powershell
  git add app/frontend/client/src/lib/db/cargoDataEvents.ts app/frontend/client/src/lib/db/cargoDataEvents.test.ts
  git commit -m "feat: add cargo data invalidation store"
  ```

### Task 2: Publish repository mutations and coalesce compound writes

**Files:**
- Modify: `app/frontend/client/src/lib/db/indexedDbRepository.ts` (cargo save/delete/import/clear methods)
- Modify: `app/frontend/client/src/pages/cargo/cargoPersistence.ts` (`persistRun` batch boundary)
- Modify: `app/frontend/client/src/lib/db/deleteCascade.test.ts` (notification count for cascading deletion)
- Modify: `app/frontend/client/src/pages/cargo/cargoPersistence.test.ts` (one notification after compound persistence)
- Create: `app/frontend/client/src/lib/db/cargoInvalidationRepository.test.ts`

**Interfaces:**
- Consumes: `invalidateCargoData()` and `withCargoDataBatch()` from Task 1.
- Produces: repository mutations that publish cargo changes only after their write path, and compound operations that publish one coalesced revision.

- [ ] **Step 1: Write failing repository notification tests**

  In `cargoInvalidationRepository.test.ts`, use `fake-indexeddb/auto`, the real `db`, and the event-store subscription. Cover:

  ```ts
  it("publishes once after a direct cargo save", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCargoData(listener);
    await db.init();

    await db.saveCargoCostRun(makeRun("run-1"));

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("publishes once after a cascading run delete", async () => {
    await db.init();
    await seedRunWithItemLineAndAllocation("run-delete");
    let notifications = 0;
    const unsubscribe = subscribeCargoData(() => {
      notifications += 1;
    });

    await db.deleteCargoCostRun("run-delete");

    expect(await db.listCargoCostItems("run-delete")).toEqual([]);
    expect(await db.listCargoCostLines("run-delete")).toEqual([]);
    expect(await db.listCargoCostAllocations("run-delete")).toEqual([]);
    expect(notifications).toBe(1);
    unsubscribe();
  });
  ```

  Define `seedRunWithItemLineAndAllocation` in the test with the same complete row shapes used by `deleteCascade.test.ts`. Extend `cargoPersistence.test.ts` to subscribe around its existing successful `persistRun` fixture, assert exactly one notification, and read back the run, all saved items, all saved lines, and all allocations from inside the listener. Do not change pricing expectations.

- [ ] **Step 2: Run the notification tests to confirm RED**

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/cargoInvalidationRepository.test.ts client/src/pages/cargo/cargoPersistence.test.ts client/src/lib/db/deleteCascade.test.ts
  ```

  Expected: the existing cascade/persistence behavior remains functionally green, but the new notification assertions fail because the repository does not publish cargo events yet. A failure in the existing cascade assertions is a regression that must be diagnosed before implementation continues.

- [ ] **Step 3: Add invalidation to direct repository writes**

  In `indexedDbRepository.ts`, convert the cargo save properties to `async` methods that call `invalidateCargoData()` after `put()` resolves:

  ```ts
  async saveCargoCostRun(row) {
    await put(TABLES.cargoCostRuns, row);
    invalidateCargoData();
  }
  ```

  Apply the same order to `saveCargoCostItem`, `saveCargoCostLine`, and `saveCargoCostAllocation`. A rejected `put()` must skip invalidation.

- [ ] **Step 4: Batch cascading delete and child-delete methods**

  Wrap `deleteCargoCostRun`, `deleteCargoCostItems`, `deleteCargoCostLines`, and `deleteCargoCostAllocations` with `withCargoDataBatch`. Mark the batch dirty immediately after the first successful deletion and before descendant cleanup, so a later child-delete failure still flushes one revision:

  ```ts
  async deleteCargoCostRun(id) {
    return withCargoDataBatch(async () => {
      await remove(TABLES.cargoCostRuns, id);
      invalidateCargoData();
      // Existing descendant discovery and deletion stays unchanged.
    });
  }
  ```

  Preserve the current cascade order and survivor behavior. Do not change `deleteCascade` data semantics.

- [ ] **Step 5: Batch compound persistence, backup import, and clear-all**

  Wrap the existing write section of `persistRun()` in `withCargoDataBatch()` so all repository-level invalidations coalesce until the final allocation write. Keep validation and calculation behavior unchanged.

  Extract the existing `importBackup` body to a private `importBackupImpl` function if needed, then expose:

  ```ts
  importBackup: (payload, mode) =>
    withCargoDataBatch(() => importBackupImpl(payload, mode)),
  ```

  Wrap `clearAll()` the same way and call `invalidateCargoData()` after clearing begins. Do not emit events from read methods, settings-only methods, or unrelated pricing-run writes.

- [ ] **Step 6: Run repository tests to confirm GREEN**

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/cargoDataEvents.test.ts client/src/lib/db/cargoInvalidationRepository.test.ts client/src/lib/db/deleteCascade.test.ts client/src/pages/cargo/cargoPersistence.test.ts
  ```

  Expected: all tests pass; direct saves notify, cascading deletes notify once after descendants are gone, compound persistence notifies once after complete data exists, and existing pricing/cascade assertions remain unchanged.

- [ ] **Step 7: Commit repository invalidation integration**

  ```powershell
  git add app/frontend/client/src/lib/db/indexedDbRepository.ts app/frontend/client/src/pages/cargo/cargoPersistence.ts app/frontend/client/src/lib/db/cargoInvalidationRepository.test.ts app/frontend/client/src/lib/db/deleteCascade.test.ts app/frontend/client/src/pages/cargo/cargoPersistence.test.ts
  git commit -m "feat: publish cargo repository invalidations"
  ```

### Task 3: Connect React consumers to the revision store

**Files:**
- Create: `app/frontend/client/src/lib/useCargoDataRevision.ts`
- Create: `app/frontend/client/src/lib/useCargoDataRevision.test.tsx`
- Modify: `app/frontend/client/src/pages/cargo/useCargoData.ts`
- Modify: `app/frontend/client/src/pages/Reports.tsx`
- Modify: `app/frontend/client/src/components/CargoDecisionReports.tsx`
- Modify: `app/frontend/client/src/pages/Home.tsx`
- Modify: `app/frontend/client/src/pages/home/GlobalSearch.tsx`
- Modify: `app/frontend/client/src/pages/cargo/Runs.tsx`

**Interfaces:**
- Consumes: `subscribeCargoData` and `getCargoDataRevision` from Task 1; repository notifications from Task 2.
- Produces: a React revision hook and cancellable loaders that rerun on cargo changes without changing their loaded data shapes or UI controls.

- [ ] **Step 1: Write the failing Hook lifecycle test**

  In `useCargoDataRevision.test.tsx`, use Testing Library’s `renderHook` and `act`:

  ```tsx
  it("updates on invalidation and stops observing after unmount", () => {
    const { result, unmount } = renderHook(() => useCargoDataRevision());
    const before = result.current;

    act(() => invalidateCargoData());
    expect(result.current).toBe(before + 1);

    unmount();
    expect(() => act(() => invalidateCargoData())).not.toThrow();
  });
  ```

  The test must import the real event store; do not mock the subscription.

- [ ] **Step 2: Run the Hook test to confirm RED**

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/useCargoDataRevision.test.tsx
  ```

  Expected: FAIL because the Hook module does not exist yet.

- [ ] **Step 3: Implement the Hook**

  Add the exact adapter:

  ```tsx
  import { useSyncExternalStore } from "react";
  import {
    getCargoDataRevision,
    subscribeCargoData,
  } from "./db/cargoDataEvents";

  export function useCargoDataRevision() {
    return useSyncExternalStore(
      subscribeCargoData,
      getCargoDataRevision,
      () => 0
    );
  }
  ```

- [ ] **Step 4: Add revision dependencies without changing loader semantics**

  Import and call `useCargoDataRevision()` in all six consumers. For loaders currently declared inline, either wrap the loader in `useCallback` with stable dependencies or keep the existing async body and add only the numeric revision to the effect dependency list. The resulting dependencies must be:

  ```text
  useCargoData: [cargoRevision]
  Reports: [cargoRevision]
  CargoDecisionReports: [cargoRevision]
  Home: [cargoRevision]
  GlobalSearch: [open, cargoRevision]
  Runs: [cargoRevision]
  ```

  Retain each existing cancellation flag. Do not reset filters, search text, selected operation, open panels, or the active draft when revision changes. The `GlobalSearch` loader must remain gated by `open`.

- [ ] **Step 5: Run consumer and Hook tests**

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/useCargoDataRevision.test.tsx client/src/pages/cargo/Runs.test.tsx client/src/pages/cargo/cargoPersistence.test.ts client/src/lib/cargoDecisionReports.test.ts
  ```

  Expected: Hook lifecycle, run-page behavior, persistence behavior, and pure decision-report tests pass. No pricing formula test changes are accepted.

- [ ] **Step 6: Commit the React consumer wiring**

  ```powershell
  git add app/frontend/client/src/lib/useCargoDataRevision.ts app/frontend/client/src/lib/useCargoDataRevision.test.tsx app/frontend/client/src/pages/cargo/useCargoData.ts app/frontend/client/src/pages/Reports.tsx app/frontend/client/src/components/CargoDecisionReports.tsx app/frontend/client/src/pages/Home.tsx app/frontend/client/src/pages/home/GlobalSearch.tsx app/frontend/client/src/pages/cargo/Runs.tsx
  git commit -m "feat: refresh cargo consumers on invalidation"
  ```

### Task 4: Verify the cross-consumer behavior and publish the item 2 report

**Files:**
- Create: `app/frontend/client/src/pages/cargo/cargoInvalidation.integration.test.tsx`
- Create: `reports/independent-cargo-invalidation.md`
- Test: all event-store, repository, persistence, Hook, Runs, Reports, and existing cargo tests

**Interfaces:**
- Consumes: the completed event store, repository integration, and React consumer wiring.
- Produces: evidence that stale cargo data is invalidated without changing unrelated behavior, plus an independent item 2 report.

- [ ] **Step 1: Add a mounted-consumer regression test for stale deletion**

  Mount the existing `Runs` page with Testing Library, the real fake IndexedDB repository, and the same language/router wrapper used by `Runs.test.tsx`. Seed a survivor and a deletable run, render the page, delete the deletable run through `db.deleteCargoCostRun`, then assert the deleted run disappears after React processes the invalidation while the survivor remains. Do not replace the repository with a mock.

- [ ] **Step 2: Run the targeted cross-consumer test**

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/pages/cargo/cargoInvalidation.integration.test.tsx client/src/lib/db/cargoDataEvents.test.ts client/src/lib/db/cargoInvalidationRepository.test.ts client/src/lib/useCargoDataRevision.test.tsx
  ```

  Expected: PASS with the deleted run absent, the survivor present, and no listener leak or partial-state assertion.

- [ ] **Step 3: Run the complete acceptance gate**

  ```powershell
  pnpm check
  pnpm test
  pnpm i18n-check
  pnpm build
  ```

  `check`, `test`, and `build` must pass. Record `i18n-check` against the item 1 baseline and do not modify the forbidden files to suppress its findings.

- [ ] **Step 4: Verify scope and the final diff**

  ```powershell
  git diff 7a30b0e --name-only
  git diff --check
  git status --short --branch
  git log --oneline --decorate -6
  ```

  Confirm there is no schema migration, no pricing/report-model change, no connection-lifecycle change, and no uncommitted application file outside the planned event, repository, consumer, test, and report paths.

- [ ] **Step 5: Write the independent item 2 report**

  Include the original stale-data diagnosis, the event/batch contract, direct and compound mutation evidence, subscriber cleanup evidence, consumer coverage, raw gate outputs, the i18n baseline result, changed-file scope, commit hashes, and an explicit statement that the separate IndexedDB connection-lifecycle work remains item 3.

- [ ] **Step 6: Commit the report and stop before item 3**

  ```powershell
  git add reports/independent-cargo-invalidation.md app/frontend/client/src/pages/cargo/cargoInvalidation.integration.test.tsx
  git commit -m "docs: report cargo invalidation verification"
  ```

  Stop and wait for explicit confirmation before beginning item 3.

## Self-review completed

- Spec coverage: event store, React adapter, repository publication, compound-operation batching, all affected consumers, cancellation, tests, acceptance gate, scope limits, report, and item 3 stop point are mapped to tasks.
- Placeholder scan: every action has a concrete file, interface, test command, expected result, or commit command.
- Type consistency: the plan uses the same event functions and Hook names across Tasks 1–4, and the repository batch signature matches the persistence callers.
- Review focus coverage: each listed failure mode has a named test in its owning task.
