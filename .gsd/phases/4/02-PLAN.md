---
phase: 4
plan: "02"
wave: 2
depends_on:
  - "01"
files_modified:
  - js/sync.js
  - js/app.js
  - index.html
autonomous: true
gap_closure: false
must_haves:
  truths:
    - "P2P WebRTC PeerJS and BroadcastChannel sync engine is extracted into js/sync.js"
    - "DOM rendering, SVG charts, modals, UI event handlers, and PWA lifecycle are extracted into js/app.js"
    - "index.html is reduced to a lean, clean HTML shell (< 40KB) loading css/app.css, peerjs.min.js, and js/app.js"
    - "Interactive event handlers remain fully wired to window scope for seamless inline HTML attribute compatibility"
  artifacts:
    - "js/sync.js exists with reconcileStates, createSyncPayload, and WebRTC slot negotiation"
    - "js/app.js exists with rendering engines, chart plotting, and modal controllers"
    - "index.html contains <script type=\"module\" src=\"./js/app.js\"></script> and no inline JS application blocks"
---

# Plan 4.02: Sync Engine Extraction & DOM/Chart Modularization

## Objective
Extract the P2P WebRTC synchronization engine into `js/sync.js` and move all DOM view rendering, SVG chart visualization, modal interactions, and application lifecycle logic into `js/app.js` (REQ-10). Transform `index.html` into a lean, semantic HTML shell that imports its modular stylesheet and scripts with zero loss of interactive functionality.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- index.html
- js/model.js
- tests/helpers/test-env.js

## Tasks

<task type="auto">
  <name>Extract WebRTC PeerJS & BroadcastChannel Sync Engine to js/sync.js</name>
  <files>
    js/sync.js
  </files>
  <action>
    Extract all synchronization logic from `index.html` into a dedicated `js/sync.js` module:

    1. Create `js/sync.js` as an ES module containing:
       - State reconciliation: `reconcileStates(local, remote)` with Last-Write-Wins (LWW) conflict resolution for expenses, loans, incomes, funds, and settings.
       - Payload generation: `createSyncPayload(state)`.
       - Passphrase utilities: `normalizeSyncKey(k)`.
       - UI status helpers: `updateSyncStatusUI(status, count, customMsg)` and `goToSyncSettings()`.
       - Connection lifecycle: `closeExistingPeer()`, `setupConnection(conn)`, `tryConnectToOtherSlots(cleanKey, mySlot)`, `initSyncSlot(cleanKey, slotIndex)`, `initSync()`, and `broadcastSync()`.
       - User trigger functions: `generateSyncKey()`, `onSyncKeyInput()`, `saveAndConnectSync()`, and `manualSyncNow()`.
    2. Import necessary dependencies from `./model.js` (`state`, `save`, `KEY`) or accept injected references.
    3. Export all public sync functions via named exports:
       ```javascript
       export {
         reconcileStates,
         createSyncPayload,
         normalizeSyncKey,
         updateSyncStatusUI,
         goToSyncSettings,
         generateSyncKey,
         onSyncKeyInput,
         saveAndConnectSync,
         manualSyncNow,
         initSync,
         broadcastSync,
         closeExistingPeer
       };
       ```
    4. Ensure graceful degradation in environments where `Peer` or `BroadcastChannel` is not defined (e.g., Node.js test runner).

    AVOID: Modifying reconciliation timestamp comparison logic or slot array sequencing `['a', 'b', 'c', 'd', 'e']`.
    USE: Modular exports with safe runtime checks (`typeof Peer !== 'undefined'`, `typeof BroadcastChannel !== 'undefined'`).
  </action>
  <verify>
    node --input-type=module -e "import * as Sync from './js/sync.js'; if (typeof Sync.reconcileStates !== 'function') throw new Error('reconcileStates missing'); if (typeof Sync.createSyncPayload !== 'function') throw new Error('createSyncPayload missing'); if (typeof Sync.normalizeSyncKey !== 'function') throw new Error('normalizeSyncKey missing'); console.log('Task 1 verified: js/sync.js exports all sync engine functions');"
  </verify>
  <done>
    `js/sync.js` is created as an ES module containing all sync and reconciliation logic, exporting all required symbols with proper fallback handling.
  </done>
</task>

<task type="auto">
  <name>Extract UI Controllers & Charts to js/app.js and Streamline index.html</name>
  <files>
    js/app.js
    index.html
  </files>
  <action>
    Extract all DOM view rendering, SVG chart generation, modal handlers, and application initialization into `js/app.js`, and turn `index.html` into a clean shell:

    1. Create `js/app.js` importing from `./model.js` and `./sync.js`:
       - View renderers: `render()`, `renderCatBudgets()`, `renderMonthNav()`, `renderExpenses()`, `renderCharts()`, `renderPie()`, `renderBar()`, `renderWeekChart()`, `renderMonthChart()`, `renderTopSubs()`, `renderLoans()`, `renderIncomes()`, `renderFunds()`, `renderFundHistory()`, `renderSplitEditor()`, `renderRatioEditor()`, `renderSubManager()`, `renderBackupUI()`.
       - SVG charts: Native SVG pie/donut, weekly comparison bars, month-by-month bars, budget vs spent bars.
       - Modal controllers: `openExpense()`, `saveExpense()`, `delExpense()`, `openIncomeModal()`, `onIncAmt()`, `openLoanModal()`, `openSalary()`, `applySalaryEdit()`, `openFundModal()`, `openDepositModal()`, `handleDepositSubmit()`, `openWithdrawModal()`, `handleWithdrawSubmit()`, `openFundHistoryModal()`, `closeModal()`.
       - Tab navigation: `go(btn)`, `setExpFilter(btn)`, `setSplitMode(btn)`, `resetRatio()`, `applyRatio()`, `resetSplit()`, `saveSplit()`, `toggleCat(id)`.
       - Backup & Data: `backupBlob()`, `exportData()`, `copyBackup()`, `importData(ev)`, `hardReset()`, `snoozeBackup()`, `markBackedUp()`, `backupOverdue()`, `ensurePersistence()`.
       - Notification & Lifecycle: `toast(msg)`, `showUpdateBar(reg)`, service worker registration, and online/offline event listeners.
    2. In `js/app.js`, attach all interactive functions called by HTML `onclick`, `oninput`, and `onchange` attributes to `window` (e.g., `Object.assign(window, { openExpense, saveExpense, delExpense, openIncomeModal, saveIncome, delIncome, openLoanModal, saveLoan, payLoanEMI, delLoan, openFundModal, saveFund, openDepositModal, handleDepositSubmit, openWithdrawModal, handleWithdrawSubmit, openFundHistoryModal, delFund, closeModal, go, setExpFilter, setSplitMode, resetRatio, applyRatio, resetSplit, saveSplit, toggleCat, exportData, copyBackup, importData, hardReset, snoozeBackup, generateSyncKey, onSyncKeyInput, saveAndConnectSync, manualSyncNow, goToSyncSettings, applySalaryEdit, openSalary, onIncAmt, onAmt })`).
    3. In `index.html`:
       - Remove the entire monolithic inline `<script>` block (which was ~1,800 lines).
       - Keep `<script src="./peerjs.min.js"></script>`.
       - Add `<script type="module" src="./js/app.js"></script>`.
    4. Verify that `index.html` is now a lean shell (< 40KB, ~400-500 lines of pure HTML view markup).

    AVOID: Breaking inline event attributes in HTML; ensure all handlers are attached to `window`.
    USE: Clean ES module imports in `js/app.js` with declarative window bindings for HTML event compatibility.
  </action>
  <verify>
    node --input-type=module -e "import fs from 'node:fs'; if (!fs.existsSync('js/app.js')) throw new Error('js/app.js missing'); const html = fs.readFileSync('index.html', 'utf8'); if (!html.includes('<script type=\"module\" src=\"./js/app.js\"></script>')) throw new Error('Missing js/app.js module script tag in index.html'); if (html.includes('/* ---------------- Data model ---------------- */')) throw new Error('Data model script block still in index.html'); const stat = fs.statSync('index.html'); if (stat.size > 45000) throw new Error('index.html size not reduced: ' + stat.size); console.log('Task 2 verified: js/app.js created and index.html reduced to lean shell (' + stat.size + ' bytes)');"
  </verify>
  <done>
    `js/app.js` contains all rendering and UI controllers, `index.html` loads it via `<script type="module" src="./js/app.js"></script>`, inline script blocks are removed, and `index.html` size is under 40KB.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] P2P WebRTC PeerJS and BroadcastChannel sync engine is extracted into js/sync.js
- [ ] DOM rendering, SVG charts, modals, UI event handlers, and PWA lifecycle are extracted into js/app.js
- [ ] index.html is reduced to a lean, clean HTML shell (< 40KB) loading css/app.css, peerjs.min.js, and js/app.js
- [ ] Interactive event handlers remain fully wired to window scope for seamless inline HTML attribute compatibility

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] index.html reduced to clean shell under 40KB
