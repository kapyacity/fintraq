---
phase: 1
plan: "01"
wave: 1
depends_on: []
files_modified:
  - package.json
  - tests/helpers/test-env.js
  - tests/budget.test.js
autonomous: true
user_setup: []
gap_closure: false

must_haves:
  truths:
    - "Test runner executes with zero external npm dependencies via Node built-in test module"
    - "50/30/20 budget allocations calculate correct Needs, Wants, and Savings amounts"
    - "Rounding correction absorbs odd salary remainders so sum of category budgets exactly equals total salary"
    - "Subcategory allocations update properly and reflect in category totals"
  artifacts:
    - package.json
    - tests/helpers/test-env.js
    - tests/budget.test.js
---

# Plan 1.01: Test Harness & Budgeting Engine Verification

## Objective
Establish a zero-dependency automated test runner harness using Node.js built-in `node:test` and `node:assert`, and implement unit tests verifying 50/30/20 budget allocations, ratio presets, remainder rounding correction, and subcategory limits.

## Context
Load for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- .gsd/ARCHITECTURE.md
- index.html (lines 560–650)

## Tasks

<task type="auto">
  <name>Setup Node test harness and environment loader</name>
  <files>
    package.json
    tests/helpers/test-env.js
  </files>
  <action>
    1. Create `package.json` with `"type": "module"` and `"scripts": { "test": "node --test tests/**/*.test.js" }`. Ensure zero runtime or dev dependencies are declared (native Node `node:test` and `node:assert` only).
    2. Create `tests/helpers/test-env.js` to extract and execute FinTraQ's core logic from `index.html` within an isolated sandbox.
    3. In `test-env.js`:
       - Read `index.html` using `node:fs`.
       - Extract the JavaScript logic section (lines 560–938 and 1599–1662) or evaluate inside a sandboxed `node:vm` context.
       - Provide mock implementations for browser primitives:
         - `localStorage`: In-memory key-value store (`getItem`, `setItem`, `removeItem`, `clear`).
         - `toast`: Spy function recording toasts into an array.
         - `render`: Spy function tracking call count.
         - `broadcastSync`: Spy function tracking broadcast calls.
         - `closeModal`: No-op spy function.
         - `escapeHtml`: Simple passthrough `(str) => String(str)`.
         - Minimal stub for `document` and `window`.
       - Export `createTestContext(initialStateOverrides)` returning a fresh sandbox with isolated `state`, category constants (`CATS`), presets (`PRESETS`, `DEFAULT_RATIO`), and core functions (`applyRatioToBudgets`, `subBudget`, `setSubBudget`, `catAllocated`, `spentSub`, `checkMonthReset`, `getMonthlyIncome`, `saveIncome`, `delIncome`, `saveLoan`, `payLoanEMI`, `delLoan`, `reconcileStates`, `createSyncPayload`, `monthKey`, `startOfMonth`, `endOfMonth`, `fmt`).

    AVOID: Installing third-party libraries (jest, mocha, vitest, jsdom) because FinTraQ is committed to zero external dependencies and zero server overhead.
    USE: Node's standard library modules (`node:fs`, `node:vm`, `node:path`) to isolate and evaluate the code.
  </action>
  <verify>
    node -e "import('./tests/helpers/test-env.js').then(m => { const ctx = m.createTestContext(); if (!ctx.CATS || ctx.CATS.length !== 3) throw new Error('CATS not loaded'); console.log('Test env initialized with', ctx.CATS.length, 'categories'); })"
  </verify>
  <done>
    `createTestContext()` runs cleanly in Node, returns an isolated context with `CATS`, `state`, and mock primitives ready for test suites.
  </done>
</task>

<task type="auto">
  <name>Implement 50/30/20 budgeting and rounding tests</name>
  <files>
    tests/budget.test.js
  </files>
  <action>
    Create `tests/budget.test.js` using `node:test` and `node:assert/strict` with test suites covering:
    1. Standard 50/30/20 splits:
       - Salary ₹50,000 -> Needs: ₹25,000, Wants: ₹15,000, Savings: ₹10,000.
       - Salary ₹100,000 -> Needs: ₹50,000, Wants: ₹30,000, Savings: ₹20,000.
    2. Preset ratios:
       - 60/20/20 preset on ₹50,000 -> Needs: ₹30,000, Wants: ₹10,000, Savings: ₹10,000.
       - 70/20/10 preset on ₹100,000 -> Needs: ₹70,000, Wants: ₹20,000, Savings: ₹10,000.
       - 40/30/30 preset on ₹60,000 -> Needs: ₹24,000, Wants: ₹18,000, Savings: ₹18,000.
    3. Remainder rounding correction:
       - Salaries producing rounding remainders (e.g., ₹10,001, ₹33,333, ₹99,999, ₹1,003).
       - Verify `state.budgets.needs + state.budgets.wants + state.budgets.savings === state.salary` holds true for all inputs when ratios sum to 100%.
       - Verify that `state.budgets.savings` absorbs the rounding difference (`state.budgets.savings === state.salary - (needs + wants)`).
    4. Non-100% ratios:
       - Custom ratios totaling other than 100% (e.g., 50/30/10 = 90%) calculate direct rounded percentages without remainder correction.
    5. Subcategory budget allocation:
       - `setSubBudget('needs', 'Rent', 15000)` records `subBudgets['needs::Rent'] = 15000`.
       - `subBudget('needs', 'Rent')` retrieves `15000`.
       - Setting value <= 0 deletes the key.
       - `catAllocated('needs')` calculates sum of configured subcategories under that category.
       - State modifications call `save()` and `broadcastSync()`.

    AVOID: Hardcoded dates or assumptions about global state; always initialize a fresh context via `createTestContext()`.
    USE: `assert.equal`, `assert.deepEqual`, and parameterized test loops for multiple salary test vectors.
  </action>
  <verify>
    node --test tests/budget.test.js
  </verify>
  <done>
    All budgeting, preset, rounding correction, and subcategory allocation tests pass with zero assertions failing.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] `package.json` is configured for ES modules and `node --test` with zero dependencies
- [ ] `tests/helpers/test-env.js` successfully extracts core logic from `index.html`
- [ ] `tests/budget.test.js` passes all tests verifying 50/30/20 math and rounding correction

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] `node --test tests/budget.test.js` exits 0
