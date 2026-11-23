---
phase: 2
plan: "03"
wave: 3
depends_on:
  - "02"
files_modified:
  - index.html
  - sw.js
autonomous: true
gap_closure: false
must_haves:
  truths:
    - "Target & Emergency Funds card is displayed on the Home page with visual progress bars and action buttons"
    - "Users can tap +Deposit and -Withdraw to launch quick-action modals that update balances and history immediately"
    - "Users can view transaction history for each fund showing past deposits and withdrawals with dates and notes"
    - "Insights page displays a visual breakdown of all active goal funds and their target progress"
    - "Service Worker CACHE_VERSION is incremented to ensure returning users receive the updated PWA bundle"
  artifacts:
    - "index.html contains fund UI cards, modals, and styles"
    - "sw.js contains bumped CACHE_VERSION"
---

# Plan 2.03: Funds UI, Insights Visuals & Service Worker Cache Bump

## Objective
Deliver the complete user-facing UI for Target & Emergency Funds across the Home and Insights pages (interactive cards, progress bars, deposit/withdraw modals, transaction history drawer/modal), bump the Service Worker cache version in `sw.js` for seamless PWA updates, and run end-to-end verification across the entire test suite.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- index.html
- sw.js
- tests/helpers/test-env.js
- tests/funds.test.js

## Tasks

<task type="auto">
  <name>Implement Funds UI on Home & Insights Pages with Deposit/Withdraw & History Modals</name>
  <files>
    index.html
  </files>
  <action>
    Build the UI markup, CSS styles, and interaction handlers for Target & Emergency Funds in `index.html`:

    1. CSS Styling:
       - Add styles for `.fund-item`, `.fund-head`, `.fund-title`, `.fund-meta`, `.fund-bar`, `.fund-actions`, `.fund-badge`, and `.fund-history-row`.
       - Support visual category icons (Emergency: shield, Trips: plane, Gadgets: laptop, Savings: piggy-bank).
       - Ensure progress bars feature smooth width transitions and color coding (green for complete/on track, amber for mid-progress).

    2. Home Page markup & rendering:
       - In `#page-home`, add `<div class="card" id="fundsCard">`:
         - Title: `Target & Emergency Funds <span class="r" onclick="openFundModal()">+ New Fund</span>`
         - Subtitle or summary badge showing total saved across all active funds (e.g. `Total Saved: ₹X`).
         - Container `<div id="fundList"></div>`.
       - Implement `renderFunds()`:
         - Filters active funds `state.funds.filter(f => !f.deleted)`.
         - If empty, displays an inviting empty state card encouraging the user to create their first fund with 1-tap presets (Emergency Fund, Goa Trip, Gadget Fund).
         - For each active fund: displays icon, title, balance of target (e.g. `₹30,000 of ₹1,00,000`), progress bar with percentage, and actions: `+ Deposit`, `- Withdraw`, `History`, and `Edit`.
         - Wire `renderFunds()` into the central `render()` function.

    3. Modals & Handlers:
       - `fundModal`: Modal to create or edit a fund (inputs for Title, Target Amount, Category Icon, Color). Connected to `openFundModal(editId)` and form submit calling `saveFund()`.
       - `fundDepositModal`: Quick-action deposit modal (shows fund title, amount input, note input). Validates input and calls `depositFund(fundId, amount, note)`.
       - `fundWithdrawModal`: Quick-action withdrawal modal (shows current balance, amount input, note input). Validates balance and calls `withdrawFund(fundId, amount, note)`.
       - `fundHistoryModal`: Displays the chronological timeline of deposits and withdrawals for the selected fund with green (+deposit) and red (-withdraw) indicators, formatted dates, and notes.

    4. Insights Page integration:
       - In `#page-insights`, add a dedicated section `<div class="card" id="insightsFundsCard">` showing goals progress, total funds balance vs total targets, and individual fund progress meters.
       - Wire fund chart/meter rendering into `renderCharts()`.

    AVOID: Unresponsive modal layouts on mobile screens; ensure input elements use `inputmode="numeric"` and touch targets meet 44px min tap area.
    USE: Consistent FinTraQ design language, CSS custom variables (`var(--surface)`, `var(--text)`, `var(--savings)`), and `escapeHtml()` for user inputs.
  </action>
  <verify>
    node --test tests/**/*.test.js
  </verify>
  <done>
    Fund cards, modals, progress bars, and history timelines render properly on Home and Insights pages, and all tests continue to pass.
  </done>
</task>

<task type="auto">
  <name>Service Worker Cache Version Bump & Full Verification Harness</name>
  <files>
    sw.js
  </files>
  <action>
    Finalize the PWA update and verify the full test suite:

    1. In `sw.js`:
       - Bump `CACHE_VERSION` from `fintraq-v12-logo-fix` to `fintraq-v13-funds`.
       - Verify that `ASSETS` cache list contains all necessary resources (`./`, `./index.html`, `./peerjs.min.js`, `./manifest.webmanifest`, and icons).

    2. Run the complete automated test harness:
       - Execute `node --test tests/**/*.test.js`.
       - Verify that all test suites pass without any failures or regressions:
         - `tests/budget.test.js` (including REQ-12 dynamic inflows)
         - `tests/funds.test.js` (REQ-13 funds engine, deposits, withdrawals, and sync)
         - `tests/loans.test.js` (EMI tracking and auto-deduction)
         - `tests/sync.test.js` (P2P LWW merge engine)
         - `tests/storage.test.js` (Data persistence and migration)

    AVOID: Forgetting to bump `CACHE_VERSION`, which prevents installed PWAs from receiving frontend updates.
    USE: Node's native test runner to confirm zero regression across all requirements.
  </action>
  <verify>
    node --test tests/**/*.test.js
  </verify>
  <done>
    `CACHE_VERSION` is bumped to `fintraq-v13-funds`, Service Worker precache is updated, and 100% of test suites pass cleanly.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Fund cards are visible on Home page with Target, Balance, and visual progress bar.
- [ ] Deposit, Withdraw, and History modals are accessible and functional.
- [ ] Insights page displays visual status of active target goals.
- [ ] `sw.js` has updated `CACHE_VERSION = 'fintraq-v13-funds'`.
- [ ] All test suites (`node --test tests/**/*.test.js`) pass with zero errors.

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] Full test suite passes cleanly
