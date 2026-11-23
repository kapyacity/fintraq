---
phase: 2
plan: "02"
wave: 2
depends_on:
  - "01"
files_modified:
  - index.html
  - tests/helpers/test-env.js
  - tests/funds.test.js
autonomous: true
gap_closure: false
must_haves:
  truths:
    - "Users can create, edit, and soft-delete dedicated funds (Emergency, Trips, Gadgets/Sinking)"
    - "Depositing into a fund increases balance and logs a deposit record with timestamp and note"
    - "Withdrawing from a fund decreases balance, logs a withdrawal record, and prevents overdrafts"
    - "Fund records sync seamlessly across devices via P2P WebRTC with LWW conflict resolution and tombstone propagation"
  artifacts:
    - "tests/funds.test.js exists and validates fund lifecycle, deposit/withdrawal math, and P2P sync"
---

# Plan 2.02: Target & Emergency Funds Core Engine & Sync

## Objective
Implement the core data model, state persistence, deposit/withdrawal transaction logging, validation logic, and P2P WebRTC synchronization for Dedicated Target & Emergency Funds (REQ-13). Users can track dedicated sinking funds, emergency reserves, and trip goals with auditable transaction histories and cross-device sync.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- index.html
- tests/helpers/test-env.js
- tests/sync.test.js

## Tasks

<task type="auto">
  <name>Implement Funds Data Model, Operations & P2P Sync Reconciliation</name>
  <files>
    index.html
  </files>
  <action>
    Implement the Funds data model and core operations in `index.html` (placed before `function renderLoans()` so `tests/helpers/test-env.js` captures them):

    1. State initialization and migration:
       - Update `blankState()`: add `funds: []`.
       - Update `load()`: sanitize `state.funds = (s.funds || []).map(f => ({ ...f, balance: Number(f.balance) || 0, target: Number(f.target) || 0, history: (f.history || []).map(h => ({ ...h, ts: h.ts || Date.now() })), updatedAt: f.updatedAt || f.createdAt || Date.now(), deleted: !!f.deleted }));`.

    2. Core Fund operations:
       - `saveFund(fundData)`: Validates name and target (> 0). Creates new fund `{ id: 'fund_' + Date.now() + Math.random().toString(36).slice(2, 6), name, target, balance: initialBalance || 0, category: category || 'emergency', color: color || '#10b981', icon: icon || 'shield', createdAt: Date.now(), updatedAt: Date.now(), deleted: false, history: [] }` or updates existing fund by id. Saves, renders, and broadcasts sync.
       - `depositFund(fundId, amount, note)`: Validates `amount > 0`. Adds to `fund.balance`. Appends `{ id: 'tx_' + Date.now() + Math.random().toString(36).slice(2, 6), type: 'deposit', amount, note: note || 'Deposit', ts: Date.now() }` to `fund.history`. Updates `fund.updatedAt = Date.now()`. Saves, renders, broadcasts sync, and shows toast.
       - `withdrawFund(fundId, amount, note)`: Validates `amount > 0` and `amount <= fund.balance` (prevent overdraft). Decrements `fund.balance -= amount`. Appends `{ id: 'tx_' + Date.now() + Math.random().toString(36).slice(2, 6), type: 'withdraw', amount, note: note || 'Withdrawal', ts: Date.now() }` to `fund.history`. Updates `fund.updatedAt = Date.now()`. Saves, renders, broadcasts sync, and shows toast.
       - `delFund(fundId)`: Soft-deletes fund (`fund.deleted = true`, `fund.updatedAt = Date.now()`), saves, renders, broadcasts sync, and shows toast.
       - `getFundProgress(fund)`: Computes percentage `fund.target > 0 ? Math.min(100, Math.round((fund.balance / fund.target) * 100)) : 100` and remaining needed `Math.max(0, fund.target - fund.balance)`.

    3. P2P WebRTC Sync & Backup reconciliation:
       - In `reconcileStates(local, remote)`: Add Section 5 for Funds LWW merge:
         Union by `id`. If remote fund is absent in local, add it. If present in both, compare `rFund.updatedAt` vs `lFund.updatedAt`; if remote is newer, replace local fund. If merged, return `changed = true`.
       - In `createSyncPayload()`: Add `funds: state.funds`.
       - In `exportData()` and `importData()`: Ensure `funds` are included in JSON export and restored during JSON import.

    AVOID: Modifying fund balances without logging an atomic history record.
    USE: Consistent LWW timestamping (`updatedAt`) and soft deletion (`deleted: true`) to ensure seamless conflict resolution across devices.
  </action>
  <verify>
    node --test tests/**/*.test.js
  </verify>
  <done>
    Funds data structure, deposit/withdraw operations, overdraft protection, history tracking, and P2P sync reconciliation are fully implemented.
  </done>
</task>

<task type="auto">
  <name>Comprehensive Automated Test Suite for Funds Engine & Sync</name>
  <files>
    tests/helpers/test-env.js
    tests/funds.test.js
  </files>
  <action>
    Expose fund methods in the test runner and build a comprehensive test suite in `tests/funds.test.js`:

    1. In `tests/helpers/test-env.js`:
       - Add `saveFund`, `depositFund`, `withdrawFund`, `delFund`, and `getFundProgress` to `bridgeCode` exports on `globalThis.__fintraq`.
       - Add stubs for fund UI renders (`renderFunds`, `renderFundHistory`) to prevent sandbox errors.

    2. Create `tests/funds.test.js` using `node:test` and `node:assert/strict`:
       - Fund lifecycle:
         - Create a new fund (Emergency Fund, target ₹1,00,000, balance 0).
         - Edit fund title and target.
         - Soft-delete fund and verify `deleted: true`.
       - Deposit & Withdrawal math:
         - Deposit ₹10,000: balance becomes ₹10,000, 1 history deposit record created with note and timestamp.
         - Subsequent deposit ₹15,000: balance becomes ₹25,000, 2 history records exist.
         - Reject non-positive deposits (0 or negative amount).
         - Withdraw ₹5,000: balance becomes ₹20,000, withdrawal record created in history.
         - Overdraft rejection: attempting to withdraw ₹25,000 when balance is ₹20,000 fails and leaves balance unchanged.
       - Progress calculation:
         - Calculates correct percentage (e.g. ₹25,000 of ₹1,00,000 is 25%).
         - Overfunded handling (e.g. ₹1,20,000 of ₹1,00,000 caps progress at 100%).
       - P2P LWW Sync reconciliation:
         - Merges remote funds not present locally.
         - Updates local fund when remote has strictly newer `updatedAt`.
         - Preserves local fund when local `updatedAt` is newer or equal.
         - Propagates deleted tombstone to local fund on sync.

    AVOID: External testing dependencies; stick to `node:test` and `node:assert`.
    USE: Isolated instances via `createTestContext()` for each test case.
  </action>
  <verify>
    node --test tests/funds.test.js
  </verify>
  <done>
    `tests/funds.test.js` passes completely, covering fund creation, deposits, withdrawals, history logging, and P2P LWW reconciliation.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Users can create, update, and soft-delete dedicated funds with targets.
- [ ] Deposits and withdrawals update balance accurately and append timestamped history records.
- [ ] Overdrafts (withdrawing more than current balance) are rejected.
- [ ] P2P LWW sync merges funds and propagates deletions across peers.
- [ ] `node --test tests/funds.test.js` passes with zero failures.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] Zero regressions in existing tests
