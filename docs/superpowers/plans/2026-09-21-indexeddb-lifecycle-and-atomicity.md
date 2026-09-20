# IndexedDB Lifecycle and Atomic Cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining IndexedDB connection-lifecycle risk and make cargo-run deletion atomic across the parent and its three descendant stores, without changing the schema or user-facing data behavior.

**Architecture:** Cache one open IndexedDB connection per repository runtime, reuse it for all transactions, close and invalidate it on `versionchange`, and expose one explicit connection-close helper for test/restore lifecycle boundaries. Replace the four independent cascade deletes with one readwrite transaction covering `cargo_cost_runs`, `cargo_cost_items`, `cargo_cost_lines`, and `cargo_cost_allocations`; publish the existing cargo invalidation only after the transaction commits.

**Tech Stack:** React 19, TypeScript, IndexedDB, Vitest, Testing Library, fake-indexeddb, pnpm.

**Spec:** User-provided `C:\Users\هواوي\Downloads\إصلاح_ثلاثي_عملات_وإبطال_واتصالات.md`, section ثالثاً — تسرب اتصالات IndexedDB وعدم ذرّية المعاملات.

## Global Constraints

- Start from the merged item 2 commit `ebe9a3b` on `codex/currency-schema-fix`; create a new isolated branch/worktree for item 3.
- Do not modify the IndexedDB schema, `SCHEMA_VERSION`, key paths, seed data, or migration semantics.
- Do not modify `app/frontend/client/src/lib/cargoPricing.ts`, `app/frontend/client/src/lib/pricing.ts`, or `app/frontend/client/src/lib/cargoDecisionReports.ts`.
- Do not add polling, timers, cross-tab synchronization, new runtime dependencies, or a new screen.
- Do not reset or inspect a protected/production database; all lifecycle and atomicity tests use `fake-indexeddb` only.
- Preserve the item 2 invalidation contract: a successful compound cargo mutation produces at most one revision after its final committed write.
- A failed transaction that commits no data must not publish a false cargo refresh; a batch that has already committed a mutation must preserve the existing failure-notification behavior.
- Preserve existing survivor behavior, session-draft invalidation, sorting, filters, and all non-cargo repository methods.
- Run the focused test gate after every task, then run `pnpm check`, `pnpm test`, `pnpm i18n-check`, and `pnpm build` at the end.
- Keep the known 22-item i18n baseline documented in item 2; do not edit unrelated translation findings.

## Review Focus

1. Repeated `db.init()` and read/write calls reuse one connection instead of opening a new connection for every transaction; pin with the lifecycle open-call test in Task 1.
2. A close/reopen boundary releases the connection so `indexedDB.deleteDatabase()` is not blocked; pin with the explicit-close test in Task 1.
3. A cascade uses one readwrite transaction containing all four cargo stores; pin with the multi-store transaction assertion and survivor test in Task 2.
4. A transaction abort leaves the parent and descendants in their pre-delete state and emits no false revision; pin with the rollback test in Task 2.
5. Item 2 behavior remains intact after connection reuse: mounted consumers refresh once after a committed delete and no listener accumulates; rerun the existing invalidation and mounted tests in Task 3.

---

### Task 1: Establish one reusable IndexedDB connection with explicit lifecycle control

**Files:**
- Create: `app/frontend/client/src/lib/db/connectionLifecycle.test.ts`
- Modify: `app/frontend/client/src/lib/db/indexedDbRepository.ts`

**Interfaces:**
- Consumes: existing `openDb()`, `withStore()`, `db.init()`, and `fake-indexeddb` test setup.
- Produces: an internal cached connection, plus `closeIndexedDbConnection(): void` exported from `indexedDbRepository.ts` for tests and explicit lifecycle boundaries. This helper is not added to the `Repository` UI-facing interface.

- [ ] **Step 1: Write the failing lifecycle tests**

  Create a fake-IndexedDB test that proves the current per-operation opening behavior is not acceptable and that the close boundary is explicit:

  ```ts
  import "fake-indexeddb/auto";

  import { afterEach, describe, expect, it, vi } from "vitest";
  import { db } from "./index";
  import { closeIndexedDbConnection } from "./indexedDbRepository";
  import { DB_NAME } from "./schema";

  function deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onblocked = () => reject(new Error("database deletion blocked"));
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  describe("IndexedDB connection lifecycle", () => {
    afterEach(async () => {
      closeIndexedDbConnection();
      await deleteDatabase();
    });

    it("reuses the initialized connection for subsequent repository calls", async () => {
      await db.init();
      const openSpy = vi.spyOn(indexedDB, "open");

      await Promise.all([
        db.listCargoCostRuns(),
        db.listCargoCostItems("missing-run"),
        db.getSettings(),
      ]);

      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it("closes the cached connection before a database replacement boundary", async () => {
      await db.init();
      closeIndexedDbConnection();

      await deleteDatabase();
      expect(true).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run the lifecycle tests and capture RED**

  Run:

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/connectionLifecycle.test.ts
  ```

  Expected before implementation: collection fails because `closeIndexedDbConnection` is not exported, and the open-call assertion cannot pass against the current per-operation `openDb()` behavior. Do not change production code before this RED result is recorded.

- [ ] **Step 3: Implement cached connection ownership**

  In `indexedDbRepository.ts`:

  1. Add `let cachedDb: IDBDatabase | null = null` and `let openingDb: Promise<IDBDatabase> | null = null`.
  2. Make `openDb()` return `cachedDb` immediately, return `openingDb` while an open request is pending, and assign the successful request result to `cachedDb`.
  3. Attach `versionchange` to the cached database. The handler must close the connection and clear both cached state variables so a later repository call opens the new version.
  4. Add:

     ```ts
     export function closeIndexedDbConnection(): void {
       cachedDb?.close();
       cachedDb = null;
       openingDb = null;
     }
     ```

  5. Update `withStore()` so it no longer closes the database on every transaction completion. It must reject on request error, transaction error, and transaction abort, while the cached connection remains available for later calls.
  6. Update `init()` to use the cached connection without opening and immediately closing a second connection. Keep all existing migration and seed ordering unchanged.

- [ ] **Step 4: Run the lifecycle tests GREEN and run the focused regression set**

  Run:

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/connectionLifecycle.test.ts client/src/lib/db/currencyInitialization.test.ts client/src/lib/db/schemaIntegrity.test.ts
  pnpm --dir app/frontend check
  ```

  Expected: lifecycle, initialization, schema-integrity, and TypeScript checks pass. The existing schema and seed counts must remain unchanged.

- [ ] **Step 5: Commit the lifecycle change**

  ```powershell
  git add app/frontend/client/src/lib/db/indexedDbRepository.ts app/frontend/client/src/lib/db/connectionLifecycle.test.ts
  git commit -m "fix: reuse indexeddb repository connection"
  ```

### Task 2: Make cargo-run cascade deletion one atomic transaction

**Files:**
- Create: `app/frontend/client/src/lib/db/cargoCascadeAtomicity.test.ts`
- Modify: `app/frontend/client/src/lib/db/indexedDbRepository.ts`
- Modify: `app/frontend/client/src/lib/db/deleteCascade.test.ts`

**Interfaces:**
- Consumes: cached `openDb()`, `withCargoDataBatch()`, `invalidateCargoData()`, and the existing cargo row types.
- Produces: `deleteCargoCostRun(id)` that deletes the parent and all descendants in one IndexedDB readwrite transaction, then publishes one cargo invalidation after commit.

- [ ] **Step 1: Write the failing atomicity tests**

  Add a real fake-IndexedDB test that seeds a deletable run and a survivor, spies on `IDBDatabase.prototype.transaction`, and requires one transaction containing all four stores:

  ```ts
  it("deletes the parent and descendants in one multi-store transaction", async () => {
    await db.init();
    await seedRunWithItemLineAndAllocation("run-delete");
    await db.saveCargoCostRun(makeRun("run-keep"));
    const transactionSpy = vi.spyOn(IDBDatabase.prototype, "transaction");

    await db.deleteCargoCostRun("run-delete");

    const cargoCascadeTransaction = transactionSpy.mock.calls.find(
      ([stores, mode]) =>
        mode === "readwrite" &&
        Array.isArray(stores) &&
        [
          TABLES.cargoCostRuns,
          TABLES.cargoCostItems,
          TABLES.cargoCostLines,
          TABLES.cargoCostAllocations,
        ].every(store => stores.includes(store))
    );
    expect(cargoCascadeTransaction).toBeDefined();
    expect(await db.getCargoCostRun("run-delete")).toBeNull();
    expect(await db.getCargoCostRun("run-keep")).toEqual(makeRun("run-keep"));
  });
  ```

  Add a rollback test using the transaction spy to abort the first matching multi-store transaction before completion, then assert that the parent and all descendants still exist and the invalidation listener was not called. Keep this test in fake IndexedDB; do not use a production database.

- [ ] **Step 2: Run the atomicity tests and capture RED**

  Run:

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/cargoCascadeAtomicity.test.ts client/src/lib/db/deleteCascade.test.ts
  ```

  Expected before implementation: the current cascade opens separate single-store transactions, so the four-store transaction assertion fails. Existing survivor/deletion assertions must remain green; if they do not, diagnose that regression before continuing.

- [ ] **Step 3: Implement one transaction for the cascade**

  Add a private helper in `indexedDbRepository.ts` with this contract:

  ```ts
  async function deleteCargoCostRunAtomic(id: string): Promise<void>
  ```

  The helper must:

  1. Call `openDb()` once.
  2. Open one `readwrite` transaction over `TABLES.cargoCostRuns`, `TABLES.cargoCostItems`, `TABLES.cargoCostLines`, and `TABLES.cargoCostAllocations`.
  3. Delete the parent by id.
  4. Iterate each child object store inside the same transaction and delete only rows whose `runId` equals `id`.
  5. Resolve only on `transaction.oncomplete`; reject on `onerror` or `onabort`.

  Change `deleteCargoCostRun()` to call the helper inside the existing `withCargoDataBatch()` boundary. Call `invalidateCargoData()` only after the atomic helper resolves, so a rolled-back transaction does not refresh consumers with a false change. Preserve the existing descendant row shapes and survivor semantics.

- [ ] **Step 4: Run the atomicity and item 2 regression tests GREEN**

  Run:

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/cargoCascadeAtomicity.test.ts client/src/lib/db/deleteCascade.test.ts client/src/lib/db/cargoInvalidationRepository.test.ts client/src/pages/cargo/cargoPersistence.test.ts client/src/pages/cargo/cargoInvalidation.integration.test.tsx
  pnpm --dir app/frontend check
  ```

  Expected: one committed invalidation after cascade deletion, no invalidation after rollback, deleted descendants absent, survivor present, and all item 2 tests still green.

- [ ] **Step 5: Commit the atomic cascade change**

  ```powershell
  git add app/frontend/client/src/lib/db/indexedDbRepository.ts app/frontend/client/src/lib/db/cargoCascadeAtomicity.test.ts app/frontend/client/src/lib/db/deleteCascade.test.ts
  git commit -m "fix: make cargo cascade deletion atomic"
  ```

### Task 3: Full acceptance, independent report, and local integration

**Files:**
- Create: `reports/independent-indexeddb-lifecycle.md`
- Modify: `app/frontend/client/src/lib/db/connectionLifecycle.test.ts` only if a focused gate exposes a lifecycle regression.

**Interfaces:**
- Consumes: the completed lifecycle and atomic-cascade commits, plus all item 1 and item 2 tests.
- Produces: raw gate evidence, a scope audit, an independent item 3 report, and a branch ready for local merge. No item 4 is created.

- [ ] **Step 1: Run the focused final gate**

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/connectionLifecycle.test.ts client/src/lib/db/cargoCascadeAtomicity.test.ts client/src/lib/db/deleteCascade.test.ts client/src/lib/db/cargoInvalidationRepository.test.ts client/src/pages/cargo/cargoInvalidation.integration.test.tsx
  ```

  Record the raw result. The expected result is all listed files passing with no blocked-delete timeout.

- [ ] **Step 2: Run the complete acceptance gate**

  ```powershell
  pnpm check
  pnpm test
  pnpm i18n-check
  pnpm build
  ```

  `check`, `test`, and `build` must pass. Record `i18n-check` against the existing 22-item baseline and do not modify unrelated files to suppress it.

- [ ] **Step 3: Audit the final scope**

  ```powershell
  git diff ebe9a3b --name-only
  git diff --check
  git status --short --branch
  git log --oneline --decorate -8
  ```

  Confirm that the diff contains only connection lifecycle code, atomic cascade code, their tests, and the item 3 report. Confirm no schema/migration, pricing, report-model, invalidation-consumer, or main-worktree user file was changed.

- [ ] **Step 4: Write the independent item 3 report**

  Include:

  - the original connection-leak and non-atomic-cascade diagnosis;
  - the RED output for lifecycle reuse and multi-store atomicity;
  - the cached-connection/versionchange/explicit-close contract;
  - the transaction store list and rollback evidence;
  - focused and full raw gate outputs;
  - the unchanged 22-item i18n baseline;
  - changed-file scope, commit hashes, and residual risks;
  - an explicit statement that items 1 and 2 remain intact and no schema version changed.

- [ ] **Step 5: Commit the report and finish the branch**

  ```powershell
  git add reports/independent-indexeddb-lifecycle.md
  git commit -m "docs: report indexeddb lifecycle verification"
  ```

  Then run the finishing-development-branch flow: verify the merged-result tests, present the local merge / PR / keep-branch choices, and do not push unless explicitly selected.

## Self-review checklist

- Spec coverage: singleton reuse, explicit close boundary, versionchange handling, multi-store atomic cascade, rollback behavior, full gate, report, and local integration are mapped to Tasks 1–3.
- Placeholder scan: every implementation step names an exact file, interface, test, command, expected result, or commit.
- Type consistency: `closeIndexedDbConnection(): void`, `deleteCargoCostRunAtomic(id: string): Promise<void>`, and the existing event-store functions are used consistently.
- Safety: no production database reset, no schema migration, no connection lifecycle change outside the item 3 branch, and no modification to the already merged item 1/2 user-facing behavior.
- Continuity: once approved, execute Tasks 1–3 in sequence without asking for an intermediate confirmation; pause only for a failed acceptance gate, a merge conflict, or a destructive ambiguity requiring user authority.
