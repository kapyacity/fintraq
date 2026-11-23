---
phase: 1
plan: "03"
wave: 3
depends_on:
  - "01"
  - "02"
files_modified:
  - tests/sync.test.js
  - package.json
  - .gsd/phases/1/test-baseline.json
autonomous: true
user_setup: []
gap_closure: false

must_haves:
  truths:
    - "P2P sync reconciliation accurately merges expenses, loans, and incomes by ID using Last-Write-Wins timestamp resolution"
    - "Soft-deleted tombstones propagate across peers during sync reconciliation"
    - "Settings (salary, budgets, ratios, subcategories) update only when remote settings timestamp is strictly newer"
    - "All unit test suites execute and pass via npm test with zero external dependencies"
  artifacts:
    - tests/sync.test.js
    - .gsd/phases/1/test-baseline.json
---

# Plan 1.03: P2P LWW Sync Reconciliation & Baseline Validation

## Objective
Verify peer-to-peer Last-Write-Wins (LWW) conflict resolution across expenses, loans, incomes, and settings, and establish a validated baseline test suite running cleanly under `npm test`.

## Context
Load for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- index.html (lines 1599–1678)
- tests/helpers/test-env.js
- tests/budget.test.js
- tests/loans.test.js
- tests/rollover-income.test.js

## Tasks

<task type="auto">
  <name>Implement P2P LWW state reconciliation unit tests</name>
  <files>
    tests/sync.test.js
  </files>
  <action>
    Create `tests/sync.test.js` using `node:test` and `node:assert/strict` testing `reconcileStates(local, remote)`:
    1. Expenses LWW merge:
       - Disjoint sets: Remote expenses not present locally are inserted into local state.
       - Conflicting IDs with newer remote: When `remote.updatedAt > local.updatedAt`, the remote expense replaces the local record.
       - Conflicting IDs with newer local: When `local.updatedAt >= remote.updatedAt`, the local record is preserved.
       - Tombstone propagation: When remote expense has `deleted: true` and `remote.updatedAt > local.updatedAt`, local expense becomes `deleted: true`.
    2. Loans LWW merge:
       - Merges by ID using `updatedAt`.
       - Updates `remainingAmount` and `paidMonths` from newer remote record.
       - Tombstone propagation for deleted loans.
    3. Incomes LWW merge:
       - Merges by ID using `updatedAt`.
       - Soft-delete updates propagate.
    4. Settings LWW merge:
       - When `remote.settingsUpdatedAt > local.settingsUpdatedAt`: Updates `salary`, `baseSalary`, `budgets`, `ratios`, `subs`, and `subBudgets`, and sets `local.settingsUpdatedAt = remote.settingsUpdatedAt`.
       - When `remote.settingsUpdatedAt <= local.settingsUpdatedAt`: Local settings remain completely untouched.
    5. Return value & idempotency:
       - Returns `true` when any changes were applied to `local`.
       - Returns `false` when reconciling identical states or when remote has no newer data.
    6. Malformed and edge case payloads:
       - Reconciling with `null`, `undefined`, or non-object remote returns `false` without throwing.
       - Handles missing collections (`remote.expenses` or `local.expenses` is undefined) safely without crash.

    AVOID: Shallow cloning issues where mutating remote also affects local in test fixtures; use `JSON.parse(JSON.stringify(...))` for clean fixtures.
    USE: Deterministic timestamp offsets (e.g. `t0 = 1000`, `t1 = 2000`) to test LWW ordering reliably.
  </action>
  <verify>
    node --test tests/sync.test.js
  </verify>
  <done>
    All sync reconciliation tests pass, proving LWW conflict resolution for expenses, loans, incomes, and settings.
  </done>
</task>

<task type="auto">
  <name>Validate full test suite and establish test baseline metrics</name>
  <files>
    package.json
    .gsd/phases/1/test-baseline.json
  </files>
  <action>
    1. Confirm `package.json` specifies `"test": "node --test tests/**/*.test.js"` and contains zero npm package dependencies in `dependencies` or `devDependencies`.
    2. Execute `npm test` to run all four test suites:
       - `tests/budget.test.js`
       - `tests/loans.test.js`
       - `tests/rollover-income.test.js`
       - `tests/sync.test.js`
    3. Record baseline execution results into `.gsd/phases/1/test-baseline.json` including:
       - Total test files
       - Total tests executed and passed
       - Zero failures / zero cancellations
       - Node.js version used
       - Assertion summary across all 4 feature areas (budgeting, loans, rollover, sync)
       - Confirmation of zero npm dependencies.

    AVOID: Relying on global binaries or non-portable shell commands.
    USE: Native `npm test` which invokes `node --test tests/**/*.test.js`.
  </action>
  <verify>
    npm test
  </verify>
  <done>
    `npm test` runs all four suites with 100% passing tests, and `.gsd/phases/1/test-baseline.json` is successfully written.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] `tests/sync.test.js` passes all tests verifying LWW conflict resolution and tombstone propagation
- [ ] `npm test` runs all 4 test suites (`budget`, `loans`, `rollover-income`, `sync`) cleanly
- [ ] `.gsd/phases/1/test-baseline.json` documents baseline test coverage metrics
- [ ] Project maintains zero npm dependencies

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] `npm test` exits 0 across entire test suite
