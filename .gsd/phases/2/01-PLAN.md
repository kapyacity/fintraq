---
phase: 2
plan: "01"
wave: 1
depends_on: []
files_modified:
  - index.html
  - tests/helpers/test-env.js
  - tests/budget.test.js
autonomous: true
gap_closure: false
must_haves:
  truths:
    - "Users without a fixed base salary can log split inflows as they arrive"
    - "Logged inflows cumulatively expand monthly salary and auto-expand 50/30/20 category budgets in real time"
    - "Deleting or removing an inflow dynamically contracts category budgets"
    - "Home page and budget card are not hidden or blocked by 'Set monthly income' prompts when base salary is zero"
  artifacts:
    - "tests/budget.test.js contains unit test suite for dynamic split inflows and budget auto-expansion"
---

# Plan 2.01: Dynamic Inflow Logging & Auto-Expanding Budget

## Objective
Enable cumulative split inflow logging without requiring a fixed base monthly salary (REQ-12). Users can log income as client, freelance, or split payments arrive; category budgets (50% Needs, 30% Wants, 20% Savings or custom ratio) expand dynamically in real time without blocking prompt cards or hiding budget views.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- index.html
- tests/helpers/test-env.js
- tests/budget.test.js

## Tasks

<task type="auto">
  <name>Implement Zero-Base Salary Support & Real-Time Auto-Expanding Budget Engine</name>
  <files>
    index.html
  </files>
  <action>
    Refactor the multi-stream income and salary calculation logic in index.html to support zero-base salaries and real-time auto-expanding budgets:

    1. In state initialization (`blankState` and `load`):
       - Ensure `state.baseSalary` defaults to 0 and is not overwritten with `state.salary` if `baseSalary` was intentionally 0.
       - Allow users to operate purely on logged inflows without any static job base.

    2. In `render()`:
       - Compute active month income using `const mIncome = getMonthlyIncome(startOfMonth(now), endOfMonth(now));`.
       - If `state.salary !== mIncome.total`, update `state.salary = mIncome.total` and call `applyRatioToBudgets()`. When `mIncome.total === 0`, `state.salary` correctly resets to 0 and category budgets reset to 0 without stale leftovers.
       - Hero section: When `state.salary === 0`, update hero text to display "₹0 spent today" and "Log an inflow or expense to get started" instead of demanding "Set your salary below to get started."

    3. In `renderCatBudgets()` and Home page markup:
       - Keep `budgetCard` visible even when `state.salary === 0`. Display a friendly hint explaining that category budgets auto-expand as inflows are logged (e.g. "Budgets auto-expand as inflows arrive · 50% Needs, 30% Wants, 20% Savings").
       - Update `salaryEmpty` vs `salarySet`: Remove the blocking "Enter your base job monthly salary to begin" prompt. Present "+ Add Inflow" front-and-center. Provide an optional "Set Base Job Salary" button/input for users who have a fixed salary, without blocking users who do not.

    4. In `saveIncome()` and `delIncome()`:
       - Ensure adding or deleting an inflow recalculates `getMonthlyIncome()`, updates `state.salary`, applies the active ratios to category budgets, updates `state.settingsUpdatedAt`, saves, and broadcasts sync.

    AVOID: Forcing users through a mandatory salary setup modal or hiding budget cards when salary is 0.
    USE: Cumulative calculation where `salary = baseSalary + sum(active month inflows)` and category budgets expand and contract dynamically.
  </action>
  <verify>
    node --test tests/budget.test.js
  </verify>
  <done>
    Inflow additions and deletions immediately expand and contract category budgets, zero-base income is supported without blocking prompts, and budget cards display cleanly at ₹0.
  </done>
</task>

<task type="auto">
  <name>Unit & Regression Test Suite for Dynamic Split Inflows</name>
  <files>
    tests/helpers/test-env.js
    tests/budget.test.js
  </files>
  <action>
    Create a dedicated test suite verifying dynamic inflow logging and budget auto-expansion under REQ-12:

    1. In `tests/helpers/test-env.js`:
       - Verify that `getMonthlyIncome`, `saveIncome`, `delIncome`, and `applyRatioToBudgets` are exposed on the sandbox test context and behave predictably with zero base salary.

    2. In `tests/budget.test.js`:
       - Add a new describe block `describe('Dynamic Inflow Logging & Auto-Expanding Budget (REQ-12)', () => { ... })`:
         - Test 1: Zero base salary starts with ₹0 total income and ₹0 across Needs, Wants, and Savings budgets.
         - Test 2: Logging an initial inflow of ₹30,000 auto-expands `state.salary` to ₹30,000 and allocates ₹15,000 Needs, ₹9,000 Wants, ₹6,000 Savings under 50/30/20.
         - Test 3: Logging a second split inflow of ₹20,000 cumulatively expands `state.salary` to ₹50,000 and updates budgets to ₹25,000 Needs, ₹15,000 Wants, ₹10,000 Savings.
         - Test 4: Deleting one inflow dynamically contracts the budget back to the remaining inflow total.
         - Test 5: Custom budget presets (e.g. 60/20/20 or 70/20/10) dynamically expand correctly with split inflows.
         - Test 6: Combining an optional base salary (e.g. ₹40,000) with freelance inflows (e.g. ₹15,000) yields ₹55,000 total and splits accurately.

    AVOID: Relying on real browser timers or window objects; use the established `createTestContext()` sandbox pattern.
    USE: Node's native `describe`, `it`, and `assert` for deterministic, zero-dependency testing.
  </action>
  <verify>
    node --test tests/budget.test.js
  </verify>
  <done>
    All unit tests for dynamic cumulative inflow logging and real-time budget auto-expansion pass without errors or regressions.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Category budgets start at ₹0 when no base salary or inflows exist without breaking the UI.
- [ ] Logging an inflow dynamically updates total monthly income and expands 50/30/20 allocations in real time.
- [ ] Deleting an inflow contracts category allocations proportionally.
- [ ] Unit tests in `tests/budget.test.js` pass with 100% success.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] No regressions in existing test suites (`node --test tests/**/*.test.js`)
