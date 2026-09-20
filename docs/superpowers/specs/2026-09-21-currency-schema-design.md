# Currency Schema Initialization Design

## Goal

Make a fresh local IndexedDB installation initialize successfully, preserve the
existing currency-code contract, and prove that every table in `TABLES` uses a
key path compatible with the records written to it.

## Scope

This phase covers only the currency schema and initialization path. It must not
modify cargo pricing formulas or the later report-invalidation and connection-
lifecycle phases.

## Verified constraints

- `CurrencyRow` uses `code` as its stable identifier and application records
  store values such as `currency: "USD"`.
- The current generic object-store creation uses `keyPath: "id"`.
- `DEFAULT_CURRENCIES` contains `code` but no `id`.
- `UnitRow` and `DEFAULT_UNITS` both contain `id`; `units` is not changed unless
  the complete table audit finds a separate mismatch.
- Backup import writes currency rows through the same repository `put` path, so
  the corrected `currencies` store key path must cover both seeding and import.

## Design

1. Add a table/key-path audit test covering every `TABLES` entry and the actual
   records or seed rows written to it. The test must explicitly report that
   `units` is valid and must fail before the schema fix because `currencies`
   has no `id`.
2. Bump `SCHEMA_VERSION` from 11 to 12. During upgrade, if `currencies`
   exists with the old `id` key path, delete and recreate only that reference
   store with `keyPath: "code"`; then seed the default currency rows.
3. Keep backup import compatible with old payloads that have no `currencies`
   table. Import must not require that table and must write any present currency
   rows using `code`.
4. Add a fresh-install regression test that starts with an empty database,
   calls `db.init()`, and asserts successful initialization plus all default
   currency rows. The existing cascade test must also run without the previous
   initialization `DataError`.

## Safety and migration

The `currencies` table is reference data seeded by the application, not user
business data. Recreating that one store is safe under the approved scope. No
other store is deleted or rewritten. Existing currency fields in entities,
items, prices, and cargo rows remain ISO-code strings.

## Acceptance evidence

- The fresh-install regression is observed failing before the implementation
  with the documented `DataError`, then passing after the implementation.
- The full gate passes:

  `pnpm check && pnpm test && pnpm i18n-check && pnpm build`

- A backup import fixture without a `currencies` table succeeds.
- The report states explicitly whether the old backup error is closed by this
  fix or requires a separate cause/follow-up.
