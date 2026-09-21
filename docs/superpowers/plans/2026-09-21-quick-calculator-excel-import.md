# Quick Calculator and Excel Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone quick cost calculator based on the supplied workbook, export its inputs and results to Excel, and add a preview-first Excel import workflow for entities, items, supplier prices, specifications, and cargo-linked expenses without changing existing sales-price behavior.

**Architecture:** The calculator uses a pure adapter over the existing `calculateCargoPricing` engine so cost and suggested-sale semantics remain consistent with cargo files. A separate IndexedDB table stores calculator drafts and is included in portable backups. Excel import is parsed into a validated plan before a single IndexedDB transaction writes the affected reference and cargo-linked records.

**Tech Stack:** React, TypeScript, Wouter, IndexedDB repository, Vitest, SheetJS `xlsx`, existing UI patterns and export helpers.

**Spec:** User-approved workbook-driven calculator and option-three Excel import scope from the current conversation; source workbook: `C:\Users\هواوي\Desktop\التاجر الذكي\نموذج حاسبة سريعة .xlsx`.

## Global Constraints

- Preserve the existing separation between supplier price levels/history and sale-price lists.
- Excel import is preview-first; no file is written until the user confirms.
- Duplicate matching uses stable codes/references; names alone never overwrite existing records.
- Cargo-linked expenses require an existing cargo reference and never become global expenses.
- The calculator labels the workbook's percentage as markup on cost and stores it as a decimal rate.
- No automatic `--fix`, merge, push, main-branch cleanup, or external deployment.

## Review Focus

- An external expense marked taxable must affect the customs base exactly once and remain in total cost.
- A supplier-price import must update supplier levels/history only and never create a sale-price list.
- An Excel row with an unknown item/entity/cargo code must be rejected in preview and must not partially write.
- A duplicate code must follow the selected add/update/skip policy and must not silently create a second master record.
- Existing JSON backup/restore and cargo pricing tests must continue to pass with the new schema store.

### Task 1: Calculator domain model and persistence

**Files:**
- Create: `app/frontend/client/src/lib/quickCalculator.ts`
- Create: `app/frontend/client/src/lib/quickCalculator.test.ts`
- Modify: `app/frontend/client/src/lib/db/schema.ts`
- Modify: `app/frontend/client/src/lib/db/repository.ts`
- Modify: `app/frontend/client/src/lib/db/indexedDbRepository.ts`
- Modify: `app/frontend/client/src/lib/db/schemaIntegrity.test.ts`

**Interfaces:**
- Produces `QuickCalculatorInput`, `QuickExpense`, `QuickCalculatorResult`, `calculateQuickCalculator`, and `QuickCalculationRow`.
- Produces repository methods `listQuickCalculations`, `saveQuickCalculation`, and `deleteQuickCalculation`.

- [ ] Write a failing test for the workbook-style calculation and the taxable-expense rule.
- [ ] Run the focused test and verify it fails because the calculator module does not exist.
- [ ] Implement the pure adapter and add the new IndexedDB table/schema/backup types without altering existing tables.
- [ ] Run the focused test, schema integrity test, and verify they pass.
- [ ] Commit as `feat: add quick calculator domain model`.

### Task 2: Calculator screen and export

**Files:**
- Create: `app/frontend/client/src/pages/QuickCalculator.tsx`
- Create: `app/frontend/client/src/lib/quickCalculatorExport.ts`
- Create: `app/frontend/client/src/lib/quickCalculatorExport.test.ts`
- Modify: `app/frontend/client/src/App.tsx`
- Modify: `app/frontend/client/src/components/layout/navGroups.ts`
- Modify: `app/frontend/client/src/lib/i18n/ar/nav.ts`
- Modify: `app/frontend/client/src/lib/i18n/en/nav.ts`
- Modify: `app/frontend/client/src/lib/i18n/tr/nav.ts`

**Interfaces:**
- Consumes `calculateQuickCalculator`, `db.listEntities`, `db.listItems`, `db.getSettings`, and `exportWorkbook`.
- Produces `/quick-calculator`, with load/save draft and two-sheet Excel export.

- [ ] Write a failing export test asserting an inputs sheet and a results sheet with the calculator totals.
- [ ] Run it and verify the missing exporter fails.
- [ ] Implement multi-sheet export and the RTL calculator UI using existing form/card patterns.
- [ ] Add route/navigation and preserve existing routes unchanged.
- [ ] Run calculator, export, component, type-check, and build tests.
- [ ] Commit as `feat: add quick calculator screen and export`.

### Task 3: Excel workbook parser and validation plan

**Files:**
- Create: `app/frontend/client/src/lib/excelImport.ts`
- Create: `app/frontend/client/src/lib/excelImport.test.ts`
- Modify: `app/frontend/client/src/lib/exporters.ts`

**Interfaces:**
- Produces `parseExcelWorkbook`, `buildExcelImportPlan`, `ExcelImportPlan`, `ExcelImportPreview`, and row-level errors.
- Recognizes official sheets `الجهات`, `الأصناف`, `أسعار الموردين`, `المواصفات`, `المصاريف` plus English aliases.

- [ ] Write failing tests for valid rows, unknown references, duplicate policy, supplier-price isolation, and cargo-linked expense validation.
- [ ] Run focused tests and verify the parser/plan APIs are absent.
- [ ] Implement header normalization, numeric/date parsing, stable-code matching, and no-write preview planning.
- [ ] Implement multi-sheet template export with the same official headers.
- [ ] Run focused parser/export tests and the full unit suite.
- [ ] Commit as `feat: add validated excel import plan`.

### Task 4: Atomic Excel import UI and repository write

**Files:**
- Create: `app/frontend/client/src/lib/db/excelImportRepository.ts`
- Create: `app/frontend/client/src/lib/db/excelImportRepository.test.ts`
- Modify: `app/frontend/client/src/lib/db/repository.ts`
- Modify: `app/frontend/client/src/lib/db/indexedDbRepository.ts`
- Modify: `app/frontend/client/src/pages/settings/Data.tsx`

**Interfaces:**
- Consumes `ExcelImportPlan` and writes entities, items, supplier prices/history, specs, and cargo-linked expense lines in one transaction.
- Produces preview counts/errors, add/update/skip controls, and a downloadable error report.

- [ ] Write a failing atomicity test proving an invalid plan writes zero rows.
- [ ] Run it and verify the repository method is absent or fails before implementation.
- [ ] Implement one IndexedDB read-write transaction over all affected stores and explicit add/update/skip resolution.
- [ ] Add the upload, preview, validation summary, confirmation, and result log to Settings > Data.
- [ ] Run repository, import UI, schema, full test suite, check, and build.
- [ ] Commit as `feat: add preview-first excel import`.

### Task 5: Integration verification and documentation

**Files:**
- Modify: `app/frontend/README.md`
- Create: `app/frontend/client/src/lib/quickCalculator.integration.test.ts`
- Create: `app/frontend/client/src/lib/excelImport.integration.test.ts`

- [ ] Add end-to-end domain tests for calculator → save → backup and Excel preview → import → supplier history.
- [ ] Run focused integration tests and fix only failures proven by those tests.
- [ ] Run `pnpm check`, `pnpm test`, `pnpm build`, and `pnpm i18n-check` from `app/frontend`.
- [ ] Review the complete diff for accidental changes to sale prices, cargo deletion, report columns, and backup replace/merge behavior.
- [ ] Commit as `test: verify calculator and excel workflows`.

