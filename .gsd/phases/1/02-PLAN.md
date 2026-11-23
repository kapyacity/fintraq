---
phase: 1
plan: "02"
wave: 2
depends_on:
  - "01"
files_modified:
  - tests/loans.test.js
  - tests/rollover-income.test.js
autonomous: true
user_setup: []
gap_closure: false

must_haves:
  truths:
    - "Loan EMI payments reduce remaining balance and are clamped at zero"
    - "Duplicate EMI payment within the same month is rejected"
    - "Paying an EMI automatically logs an expense under category 'needs' with subcategory 'Loan / EMI'"
    - "Multi-stream income correctly aggregates base salary and active extra income records"
    - "Monthly reset calculates previous month unspent leftovers without deleting expense history"
  artifacts:
    - tests/loans.test.js
    - tests/rollover-income.test.js
---

# Plan 1.02: Loan/EMI Auto-Logging & Monthly Rollover Verification

## Objective
Build automated unit tests verifying loan balance amortization, monthly EMI payment deduplication, automated expense logging into the Needs budget category, multi-stream income aggregation, and month-boundary rollover calculations.

## Context
Load for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- index.html (lines 651–750, 824–938)
- tests/helpers/test-env.js

## Tasks

<task type="auto">
  <name>Implement Loan & EMI schedule and auto-logging tests</name>
  <files>
    tests/loans.test.js
  </files>
  <action>
    Create `tests/loans.test.js` using `node:test` and `node:assert/strict` importing `createTestContext` from `./helpers/test-env.js`.
    Cover the following test scenarios:
    1. Loan creation and updates:
       - Initializing a loan: `totalAmount: 500000`, `remainingAmount: 500000`, `emiAmount: 15000`, `dueDay: 10`, `paidMonths: []`.
       - Soft deletion: `delLoan(id)` sets `deleted: true` and updates `updatedAt`.
    2. Single EMI Payment (`payLoanEMI`):
       - Reduces `remainingAmount` by `emiAmount` (500,000 -> 485,000).
       - Records current month key (`monthKey(new Date())`) in `loan.paidMonths`.
       - Sets `loan.updatedAt` to current timestamp.
       - Confirms state persistence (`save()`) and sync broadcast (`broadcastSync()`).
    3. Automatic Expense Logging:
       - Verifies an expense entry is appended to `state.expenses`:
         - `cat === 'needs'`
         - `sub === 'Loan / EMI'`
         - `amount === loan.emiAmount`
         - `note === loan.name + ' EMI'`
         - `deleted === false`
       - Verifies that this expense immediately impacts Needs spending calculations (`spentByCat().needs`).
    4. Duplicate payment prevention:
       - Calling `payLoanEMI` when `paidMonths` already contains the current month key does NOT reduce `remainingAmount`, does NOT add a second expense, and logs a warning toast (`'EMI already paid this month'`).
    5. Loan payoff & balance clamping:
       - When `remainingAmount` is less than `emiAmount` (e.g. remaining: 8,000, EMI: 15,000), `payLoanEMI` sets `remainingAmount` to 0 via `Math.max(0, ...)`.

    AVOID: Modifying live system clock without restoring it; test monthKey with real dates or isolated mock state.
    USE: Exact assertions on `loan.remainingAmount`, `loan.paidMonths`, and `state.expenses` array length and properties.
  </action>
  <verify>
    node --test tests/loans.test.js
  </verify>
  <done>
    All loan balance reduction, duplicate prevention, and automated Needs expense logging tests pass cleanly.
  </done>
</task>

<task type="auto">
  <name>Implement Multi-Stream Inflows and Monthly Rollover tests</name>
  <files>
    tests/rollover-income.test.js
  </files>
  <action>
    Create `tests/rollover-income.test.js` using `node:test` and `node:assert/strict` with test suites covering:
    1. Multi-stream income calculation (`getMonthlyIncome`):
       - Base salary alone: `{ base: 80000, extra: 0, total: 80000 }`.
       - Inflows within current month: Adds freelance (₹25,000) and dividend (₹5,000) within range `[from, to)` -> `{ base: 80000, extra: 30000, total: 110000 }`.
       - Timestamp filtering: Excludes inflows outside the specified timestamp range.
       - Soft deletion filtering: Excludes records where `deleted === true`.
    2. Date and month boundary helpers:
       - `monthKey(d)` matches `YYYY-MM` format (e.g., `'2026-11'`).
       - `startOfMonth(d)` returns midnight timestamp on the 1st of the month.
       - `endOfMonth(d)` returns midnight timestamp on the 1st of the subsequent month.
       - `startOfWeekMon(d)` computes Monday of the containing week.
       - `fmt(n)` outputs currency with Indian Rupee symbol `'₹'` and thousands formatting.
    3. Monthly reset and unspent leftover rollover (`checkMonthReset`):
       - Same month check: When `state.lastMonthKey` equals current month key, no reset occurs and `lastMonthLeftover` is unchanged.
       - Month rollover transition: When `state.lastMonthKey` is prior month (e.g. `'2026-10'`):
         - Calculates leftover per category: `state.budgets[c.id] - spent` for the previous month.
         - Stores result in `state.lastMonthLeftover = { month: '2026-10', left: { needs, wants, savings } }`.
         - Updates `state.lastMonthKey` to current month key.
         - CRITICAL: Asserts that all past expenses remain present in `state.expenses` (zero data loss across monthly resets).

    AVOID: Mutating shared state across tests; use fresh context from `createTestContext()`.
    USE: Explicit timestamps corresponding to distinct months (e.g. 2026-10 vs 2026-11) to test rollover boundaries deterministically.
  </action>
  <verify>
    node --test tests/rollover-income.test.js
  </verify>
  <done>
    All multi-stream income calculations, date range filters, and monthly rollover tests pass.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] `tests/loans.test.js` passes all tests verifying EMI balance calculation and auto-logging into Needs
- [ ] `tests/rollover-income.test.js` passes all tests verifying multi-stream income and month rollover
- [ ] Zero expense records are purged or lost during monthly rollover resets

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] `node --test tests/loans.test.js tests/rollover-income.test.js` exits 0
