# Currency Schema Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the IndexedDB currency-store key schema so a fresh database initializes successfully, an existing v11 database upgrades safely, and old backups without a `currencies` table remain importable, while completing the requested audit of every `TABLES` store.

**Architecture:** Keep the existing repository API and data model. Introduce one explicit key-path map used by `openDb()` for every store, bump the schema from 11 to 12, and recreate only the incompatible `currencies` object store during upgrade with `code` as its key path. Keep the existing currency-value migration and reference-data seeding idempotent, add a minimal close of the initialization-only IndexedDB connection so tests and database replacement can release it, and leave pricing/reporting behavior untouched.

**Tech Stack:** React/Vite/TypeScript, IndexedDB, `fake-indexeddb` for Vitest, Vitest, pnpm, PowerShell, Git worktree.

**Spec:** `docs/superpowers/specs/2026-09-21-currency-schema-design.md`

## Global Constraints

- Execute item 1 only; stop after its independent report and commit until the user confirms item 2.
- Do not modify `app/frontend/client/src/lib/cargoPricing.ts`, `app/frontend/client/src/lib/pricing.ts`, or `app/frontend/client/src/lib/cargoDecisionReports.ts`.
- Before implementation, inspect every store in `TABLES` against its actual object-store key path and seed-row shape; explicitly report `units` and every other mismatch or confirm none.
- Preserve the public currency-row contract: `CurrencyRow.code` is the identity; do not add synthetic `id` values to currency seeds or change pricing logic.
- Use schema version `12`; existing v11 databases must be upgraded without deleting any store other than the incompatible `currencies` store.
- Keep old backup imports compatible when the payload has no `currencies` table; do not silently discard entities, items, prices, or legacy currency values.
- Reproduce the documented `DataError` before the fix, then show the same focused test passing after the fix.
- Run the requested acceptance commands and preserve raw outputs in the item 1 report. The pre-existing unrelated `i18n-check` failure must be reported rather than “fixed” by touching forbidden reporting/pricing files.
- Work only in `C:\Users\هواوي\.codex\worktrees\currency-schema-fix\Cost-Calculator` on `codex/currency-schema-fix`; do not modify `main`.

## Review Focus

1. Fresh empty database: `db.init()` must no longer throw `DataError`, and all eight default currency rows must exist keyed by their ISO `code`.
2. Existing v11 database with `currencies` keyed by `id`: upgrade must recreate only that store with `code`, then seed currencies and retain unrelated stores.
3. `units`: every default unit must have the existing `id` key and the upgraded database must seed units; no units code change is allowed unless the audit proves a mismatch.
4. Legacy backup without `tables.currencies`: replace-mode import must complete and restore the default currency reference rows through the normal migration path.
5. Legacy/unknown stored currency values: known Arabic values map to ISO codes, while unknown values remain unchanged; this is already covered by `currencyMigration.test.ts` and must remain green.

---

### Task 1: Complete the all-table audit and establish RED regression coverage

**Files:**
- Create: `app/frontend/client/src/lib/db/schemaIntegrity.test.ts`
- Create: `app/frontend/client/src/lib/db/currencyInitialization.test.ts`
- Create or restore: `app/frontend/client/src/lib/db/deleteCascade.test.ts`
- Modify: `app/frontend/package.json` (add the test-only `fake-indexeddb` dependency at `^6.2.5` if absent)
- Modify: `app/frontend/pnpm-lock.yaml` (lock the exact dependency resolution)
- Read-only audit targets: `app/frontend/client/src/lib/db/schema.ts`, `app/frontend/client/src/lib/db/indexedDbRepository.ts`, `app/frontend/client/src/lib/db/repository.ts`

**Interfaces:**
- Consumes: `TABLES`, `DEFAULT_CURRENCIES`, `DEFAULT_UNITS`, `SCHEMA_VERSION`, `DB_NAME`, `db.init()`, and the existing repository test conventions.
- Produces: a checked-in expected key-path contract and focused failing tests that prove the current v11 implementation fails with `DataError` before production code changes.

- [ ] **Step 1: Inspect every `TABLES` store and its writers before editing production code**

  Read the `TABLES` object, `openDb()`, all `DEFAULT_*` seed arrays, and the repository `put()`/backup paths. Use a focused search for `put(TABLES.` and each `DEFAULT_` constant. Record this concrete audit result in the item 1 report:

  ```text
  entities, categories, items, spec_templates, item_specs, item_prices,
  price_history, attachments, notes, tasks, backup_logs, pricing_runs,
  cargo_cost_runs, cargo_cost_items, cargo_cost_lines, cargo_cost_allocations,
  logistics_locations, logistics_rates, logistics_route_templates, price_lists,
  price_list_items, settings, meta, entity_contacts: id
  currencies: code (required mismatch against current IndexedDB id store)
  units: id (valid; DEFAULT_UNITS rows contain id)
  ```

  Verify whether any additional seed or writer violates that map. Do not infer `units` from its zero row count; distinguish “seed never ran because currency initialization aborted” from a units schema defect.

- [ ] **Step 2: Add the explicit audit regression test**

  In `schemaIntegrity.test.ts`, open the current database schema through `indexedDB.open(DB_NAME, SCHEMA_VERSION)` and assert the expected key path for every store, plus the key field on each default seed row:

  ```ts
  const EXPECTED_KEY_PATHS: Record<string, "id" | "code"> = {
    [TABLES.entities]: "id",
    [TABLES.categories]: "id",
    [TABLES.items]: "id",
    [TABLES.specTemplates]: "id",
    [TABLES.itemSpecs]: "id",
    [TABLES.itemPrices]: "id",
    [TABLES.priceHistory]: "id",
    [TABLES.attachments]: "id",
    [TABLES.notes]: "id",
    [TABLES.tasks]: "id",
    [TABLES.backupLogs]: "id",
    [TABLES.pricingRuns]: "id",
    [TABLES.cargoCostRuns]: "id",
    [TABLES.cargoCostItems]: "id",
    [TABLES.cargoCostLines]: "id",
    [TABLES.cargoCostAllocations]: "id",
    [TABLES.logisticsLocations]: "id",
    [TABLES.logisticsRates]: "id",
    [TABLES.logisticsRouteTemplates]: "id",
    [TABLES.priceLists]: "id",
    [TABLES.priceListItems]: "id",
    [TABLES.settings]: "id",
    [TABLES.meta]: "id",
    [TABLES.currencies]: "code",
    [TABLES.units]: "id",
    [TABLES.entityContacts]: "id",
  };
  ```

  Assert `Object.keys(EXPECTED_KEY_PATHS).sort()` equals `Object.values(TABLES).sort()`, assert every object store exists, assert `objectStore.keyPath === EXPECTED_KEY_PATHS[name]`, assert every currency has a non-empty `code`, and assert every unit has a non-empty `id`. The pre-fix run must fail because the current currency store is keyed by `id`.

- [ ] **Step 3: Add the fresh-init RED test**

  In `currencyInitialization.test.ts`, use `fake-indexeddb/auto`, call the real `db.init()`, and assert the eight default codes are readable. Run the focused test before changing production code:

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/schemaIntegrity.test.ts client/src/lib/db/currencyInitialization.test.ts
  ```

  Expected result: the test fails during `db.init()` with the documented `DataError: Data provided to an operation does not meet requirements`, not with a different assertion or a fabricated error. Capture the raw output in the report.

- [ ] **Step 4: Add the cascade regression fixture without changing cascade behavior**

  Add the existing isolated cascade scenario from the audit to `deleteCascade.test.ts`: create two runs with items/lines/allocations, delete one run through `deleteCargoCostRun`, assert all descendants of the deleted run are gone and the survivor remains. Include cleanup that closes any initialization connection created by the repository. Run it before the production fix and capture the known failure/timeout caused by the leaked initialization connection separately from the currency `DataError`.

- [ ] **Step 5: Commit only the RED tests and test dependency**

  ```powershell
  git add app/frontend/package.json app/frontend/pnpm-lock.yaml app/frontend/client/src/lib/db/schemaIntegrity.test.ts app/frontend/client/src/lib/db/currencyInitialization.test.ts app/frontend/client/src/lib/db/deleteCascade.test.ts
  git commit -m "test: cover currency schema initialization failure"
  ```

### Task 2: Repair schema creation, v11 migration, and initialization cleanup

**Files:**
- Modify: `app/frontend/client/src/lib/db/schema.ts:7` (schema version only)
- Modify: `app/frontend/client/src/lib/db/indexedDbRepository.ts:43-58, 306-440` (key-path map, upgrade, migration, initialization connection close)
- Test: `app/frontend/client/src/lib/db/schemaIntegrity.test.ts`
- Test: `app/frontend/client/src/lib/db/currencyInitialization.test.ts`
- Test: `app/frontend/client/src/lib/db/deleteCascade.test.ts`

**Interfaces:**
- Consumes: the RED tests and existing `openDb`, `migrateToV11`, `db.init`, `put`, `getById`, and `withStore` behavior.
- Produces: schema version 12; `currencies` keyed by `code`; all other stores keyed by `id`; an idempotent upgrade path; and an initialization routine that releases its one-off database connection.

- [ ] **Step 1: Define one key-path source of truth**

  Add a typed map next to `STORES`, with `TABLES.currencies` mapped to `"code"` and every other `TABLES` value mapped to `"id"`. Make `openDb()` use that map both when creating a missing store and when deciding whether the existing currency store is incompatible. Do not scatter a second currency-specific literal through seed or backup code.

- [ ] **Step 2: Implement the v11-to-v12 upgrade**

  Change `SCHEMA_VERSION` to `12`. In `onupgradeneeded`, if an existing `currencies` store has a key path other than `code`, call `db.deleteObjectStore(TABLES.currencies)` inside the version-change transaction, then let the normal creation loop recreate it with the mapped `code` key path. Do not delete or recreate any other store. If a missing store is created, use the same map so fresh installs and upgrades share behavior.

- [ ] **Step 3: Make reference-data migration run for v11 and incomplete databases**

  Rename the migration entry point to `migrateToV12` (or keep a compatibility wrapper with an exact call site) and preserve the existing currency-value conversion. Ensure that when the stored meta version is below 12, currencies and units are seeded only when their stores are empty. Also ensure a fresh database reaches this path after its initial meta row is read. Keep `DEFAULT_CURRENCIES` code-only and `DEFAULT_UNITS` id-based.

- [ ] **Step 4: Close the initialization-only connection**

  Change the current ignored `await openDb();` in `db.init()` to retain the returned `IDBDatabase` and immediately close it after the schema is ensured:

  ```ts
  const initializedDb = await openDb();
  initializedDb.close();
  ```

  Leave the broader persistent-connection/singleton redesign for item 3; this step only removes the connection leak that prevents deterministic database cleanup and caused the current cascade-test timeout.

- [ ] **Step 5: Run the focused GREEN tests**

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/schemaIntegrity.test.ts client/src/lib/db/currencyInitialization.test.ts client/src/lib/db/currencyMigration.test.ts client/src/lib/db/deleteCascade.test.ts
  ```

  Expected result: all focused tests pass; the schema audit reports `currencies: code`, `units: id`, and no other mismatch; the cascade test completes without a timeout.

- [ ] **Step 6: Commit the production repair**

  ```powershell
  git add app/frontend/client/src/lib/db/schema.ts app/frontend/client/src/lib/db/indexedDbRepository.ts
  git commit -m "fix: repair currency IndexedDB key schema"
  ```

### Task 3: Prove legacy backup compatibility and complete the item 1 gate

**Files:**
- Create: `app/frontend/client/src/lib/db/legacyBackupCurrency.test.ts`
- Modify only if the test exposes a real type/runtime gap: `app/frontend/client/src/lib/db/repository.ts`
- Test: `app/frontend/client/src/lib/db/currencyInitialization.test.ts`
- Test: `app/frontend/client/src/lib/db/schemaIntegrity.test.ts`

**Interfaces:**
- Consumes: schema version 12, `db.init()`, `exportBackup()`, `importBackup()`, `BackupPayload`, and the normal migration path from Task 2.
- Produces: evidence that old payloads missing `currencies` are accepted and that the final item 1 report can separate closed and remaining defects.

- [ ] **Step 1: Write the legacy-backup regression test**

  Construct a valid old-style payload containing at least one entity and item but no `tables.currencies` property. Import it in replace mode after initialization, then assert the import resolves, the entity/item are present, and the eight default currencies are present. Also assert that the test payload’s unknown legacy currency value remains unchanged in the migrated record.

- [ ] **Step 2: Run the regression test**

  ```powershell
  pnpm --dir app/frontend exec vitest run client/src/lib/db/legacyBackupCurrency.test.ts
  ```

  Expected result: PASS with no `DataError`; a failure here is a migration/import defect and must be fixed only in the repository’s backup/schema boundary, never in pricing code.

- [ ] **Step 3: Run the complete requested acceptance gate from `app/frontend`**

  ```powershell
  pnpm check
  pnpm test
  pnpm i18n-check
  pnpm build
  ```

  Capture raw stdout/stderr and exit codes. `check`, `test`, and `build` must pass. Compare `i18n-check` with the documented baseline: if its unrelated 22 literal-string findings remain, record that exact failure as pre-existing and do not alter the forbidden cargo reporting/pricing files merely to make the gate green.

- [ ] **Step 4: Verify scope and commit history**

  ```powershell
  git diff 30ac3af --name-only
  git log --oneline --decorate -4
  git status --short --branch
  ```

  Confirm that only schema/repository tests, the test dependency lockfiles, and the two committed design documents changed; confirm there is no change to pricing or report logic and no uncommitted unrelated file.

- [ ] **Step 5: Write the individual item 1 report**

  The report must include: the all-table key-path/seed audit with an explicit `units` verdict; the raw RED `DataError`; the raw GREEN focused output; the acceptance-gate outputs; migration/backup evidence; commit hashes; and this exact conclusion stated explicitly: whether the old backup-restore error matching the previous screenshot is closed by the currency-schema fix, or whether the reproduced cause is separate and requires a later investigation. If the old screenshot message was not available in the current workspace, say that the closure is proven only for the reproduced `DataError` signature and mark screenshot-level equivalence as unverified rather than claiming it.

- [ ] **Step 6: Commit the final item 1 evidence/report**

  ```powershell
  git add reports app/frontend/client/src/lib/db/legacyBackupCurrency.test.ts
  git commit -m "docs: report currency schema repair verification"
  ```

  Stop after this commit and wait for the user’s explicit confirmation before starting item 2.

## Self-review completed

- Spec coverage: schema audit, `units` resolution, currency key-path repair, v11 upgrade, fresh init, legacy backup import, connection cleanup, RED/GREEN evidence, full gate, scope boundaries, independent report, and item 2 stop point are all mapped above.
- Placeholder scan: every implementation step contains concrete files, commands, expected results, or code; no unspecified work remains.
- Type consistency: the plan consistently uses `TABLES.currencies`, `TABLES.units`, `CurrencyRow.code`, `UnitRow.id`, `SCHEMA_VERSION`, `db.init()`, `importBackup()`, and the repository files that define them.
- Review focus coverage: each of the five failure modes has a named test and an owning task.
