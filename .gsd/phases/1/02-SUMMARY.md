# Phase 1 Plan 02 Summary: Loan EMI Auto-Logging & Monthly Rollover Verification

## Objective
Implemented automated unit tests verifying loan balance amortization, monthly EMI payment deduplication, automatic expense logging into the Needs budget category, multi-stream income aggregation, date boundary helpers, and monthly rollover resets with complete expense history preservation.

## Completed Tasks
| Task | Summary | Commit |
|------|---------|--------|
| Task 1 | Implement Loan & EMI schedule and auto-logging tests | `64f0428` |
| Task 2 | Implement Multi-Stream Inflows and Monthly Rollover tests | `0029918` |

## Key Changes
- **`tests/loans.test.js`**: Created test suite covering 12 test cases:
  1. Loan creation (with full amount default or custom remaining amount) and field validation (title, total, EMI, clamped dueDay between 1-31).
  2. Soft-deletion marking `deleted: true` and updating timestamps.
  3. Single EMI payment reducing `remainingAmount`, recording month key (`YYYY-MM`) in `paidMonths`, persisting state, and broadcasting sync.
  4. Automatic expense logging appending an expense entry with `cat: 'needs'`, `sub: 'Loan / EMI'`, `amount: loan.emiAmount`, `note: loan.name + ' EMI'`, and verifying immediate reflection in `spentByCat().needs`.
  5. Duplicate payment prevention within the same calendar month preventing repeat balance reduction or duplicate expense logging.
  6. Payoff balance clamping ensuring `remainingAmount` is clamped at 0 (`Math.max(0, ...)`) when remaining balance is less than the EMI amount.
- **`tests/rollover-income.test.js`**: Created test suite covering 15 test cases:
  1. Multi-stream income aggregation (`getMonthlyIncome`) combining base salary and active inflow records (freelance, dividends, bonuses).
  2. Timestamp window filtering (`[from, to)`) and soft-deleted record exclusion.
  3. Date helpers: `monthKey` (zero-padded `YYYY-MM`), `startOfMonth` (midnight on 1st), `endOfMonth` (midnight on 1st of next month), `startOfWeekMon` (Monday boundary), and `fmt` currency formatter with Indian Rupee symbol (`₹`).
  4. Monthly rollover reset (`checkMonthReset`): verifies same-month idempotency, computes unspent leftovers per category from the prior month, updates `lastMonthKey`, and strictly asserts zero data loss (all historical expenses remain intact).

## Verification Evidence
```
> node --test tests/loans.test.js tests/rollover-income.test.js

▶ FinTraQ Loans & EMI Tracker
  ✔ Loan Creation, Updating, and Deletion (6 tests)
  ✔ Single EMI Payment Execution (2 tests)
  ✔ Duplicate Payment Prevention (2 tests)
  ✔ Loan Payoff and Balance Clamping (2 tests)
✔ FinTraQ Loans & EMI Tracker (12 tests passed)

▶ FinTraQ Multi-Stream Inflows & Monthly Rollover Engine
  ✔ Multi-Stream Income Calculation (getMonthlyIncome) (6 tests)
  ✔ Date & Month Boundary Helpers (5 tests)
  ✔ Monthly Reset & Unspent Leftover Rollover (checkMonthReset) (4 tests)
✔ FinTraQ Multi-Stream Inflows & Monthly Rollover Engine (15 tests passed)

ℹ tests 27
ℹ suites 9
ℹ pass 27
ℹ fail 0
```

Combined with Plan 01 tests:
```
> node --test tests/budget.test.js tests/loans.test.js tests/rollover-income.test.js
ℹ tests 50
ℹ suites 15
ℹ pass 50
ℹ fail 0
```

## Deviations
- Adapted assert comparisons for vm-sandboxed objects to avoid realm prototype identity divergence between `vm` context and `node:assert/strict`.

## Next Step
Ready for Phase 1 Plan 03: P2P LWW sync reconciliation & baseline test suite validation.
