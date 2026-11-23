---
phase: 4
plan: "01"
wave: 1
depends_on: []
files_modified:
  - css/app.css
  - js/model.js
  - index.html
autonomous: true
gap_closure: false
must_haves:
  truths:
    - "Application stylesheet is extracted into css/app.css and linked in index.html via external stylesheet tag"
    - "Financial data model, state management, calculation formulas, income, loan, and fund domain logic are extracted into js/model.js"
    - "js/model.js exports all core financial symbols as ES modules with zero DOM dependencies in calculation utilities"
  artifacts:
    - "css/app.css exists with responsive theme styles, CSS custom properties, and animations"
    - "js/model.js exists with pure financial models, state initialization, and helper functions"
    - "index.html references ./css/app.css via <link rel=\"stylesheet\" href=\"./css/app.css\">"
---

# Plan 4.01: Stylesheet Extraction & Financial Model Modularization

## Objective
Extract the monolithic inline CSS stylesheet into `css/app.css` and isolate all pure financial calculation logic, state persistence, income tracking, loan amortisation, and sinking/emergency fund algorithms into `js/model.js` (REQ-10). This establishes the presentation and domain logic layers of the modular architecture.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- index.html
- tests/helpers/test-env.js

## Tasks

<task type="auto">
  <name>Extract Inline CSS to css/app.css and Link in index.html</name>
  <files>
    css/app.css
    index.html
  </files>
  <action>
    Extract the ~280 lines of inline styles from `index.html` into a standalone, well-organized CSS file:

    1. Create `css/app.css` and copy the complete contents of `<style>...</style>` from `index.html` (lines 23-303):
       - Root design variables (`:root`, light and dark color schemes, theme tokens, category colors, gradients, shadows, easing curves).
       - Global resets, typography, and sticky header styling.
       - Card, grid, flexbox, and input/select form component styles.
       - Hero and greeting banner components.
       - Category blocks, progress tracks, and chevron animations.
       - Expense, income, loan, and fund card/item layouts.
       - P2P sync badge, status dots, and pulse animations.
       - Month navigation, segmented controls, modal backgrounds, dialog sheets, and toast notifications.
    2. In `index.html`, remove the `<style>...</style>` block completely and replace it with:
       ```html
       <link rel="stylesheet" href="./css/app.css">
       ```
    3. Ensure all responsive `@media (prefers-color-scheme: dark)` overrides and animations (`@keyframes fadeUp`, `@keyframes pulse`) are preserved exactly in `css/app.css`.

    AVOID: Altering class names, CSS variable names, or specificity rules to prevent visual layout regressions.
    USE: Clean standalone `css/app.css` linked in the `<head>` of `index.html`.
  </action>
  <verify>
    node --input-type=module -e "import fs from 'node:fs'; if (!fs.existsSync('css/app.css')) throw new Error('css/app.css missing'); const css = fs.readFileSync('css/app.css', 'utf8'); if (!css.includes('--needs:') || !css.includes('--savings:')) throw new Error('CSS variables missing'); const html = fs.readFileSync('index.html', 'utf8'); if (!html.includes('<link rel=\"stylesheet\" href=\"./css/app.css\">')) throw new Error('Stylesheet link missing in index.html'); if (html.includes('<style>')) throw new Error('Inline <style> tag still present in index.html'); console.log('Task 1 verified: css/app.css created and linked in index.html');"
  </verify>
  <done>
    `css/app.css` contains all application styles, `index.html` has no inline `<style>` tag and links `./css/app.css`, and visual styling definitions are intact.
  </done>
</task>

<task type="auto">
  <name>Extract Financial Data Model & Domain Logic to js/model.js</name>
  <files>
    js/model.js
  </files>
  <action>
    Extract all pure financial calculation logic, data structures, state management, date math, income rebalancing, loan amortization, and fund lifecycle functions from `index.html` into `js/model.js`:

    1. Create `js/model.js` as an ES module containing:
       - Constants: `IC`, `CATS`, `DEFAULT_SUBS`, `KEY` ('fintraq_v1'), `DEFAULT_RATIO`, `PRESETS`.
       - Category expansion state: `catExpand` (`{needs: false, wants: false, savings: false}`).
       - State initialization & persistence: `blankState()`, `load()`, `save(customState)`, and active module-level `state`.
       - Subcategory budgeting: `subKey(cat, sub)`, `subBudget(cat, sub)`, `setSubBudget(cat, sub, amt)`, `spentSub(cat, sub)`, `catAllocated(cat)`, `toggleCat(cat)`, `applyRatioToBudgets()`.
       - Date math & formatting: `monthKey(d)`, `startOfDay(d)`, `startOfWeekMon(d)`, `startOfMonth(d)`, `endOfMonth(d)`, `fmt(n)`, `checkMonthReset()`.
       - Spending aggregations & view-month navigation: `spentByCat(from, to)`, `totalSpent(from, to)`, `vmDate()`, `vmStart()`, `vmEnd()`, `vmIsCurrent()`, `vmLabel()`, `earliestMonthDate()`, `setViewMonth(d)`, `shiftMonth(dir)`, `jumpToCurrent()`, `weeksOfMonth()`.
       - Income tracking: `getMonthlyIncome(from, to)`, `saveIncome(data)`, `delIncome(id)`, `applySalaryEdit(amt)`.
       - Loans & EMI schedule: `saveLoan(data)`, `payLoanEMI(id)`, `delLoan(id)`.
       - Dedicated Target & Emergency funds: `saveFund(data)`, `depositFund(id, amt, note)`, `withdrawFund(id, amt, note)`, `delFund(id)`, `getFundProgress(fund)`.
    2. Ensure functions accept data arguments or cleanly read/mutate `state`. Provide backward-compatible DOM fallback inspection where needed or accept parameter objects so functions work both headlessly (in tests/node) and in browser contexts.
    3. Export all symbols via named ES module exports (`export { IC, CATS, state, blankState, load, save, fmt, ... }`). Also assign to `globalThis.__fintraqModel = { ... }` when in a browser environment to allow transitional script access.

    AVOID: Coupling pure mathematical formulas or storage serializers to UI rendering code.
    USE: Named ES module exports with clean function signatures.
  </action>
  <verify>
    node --input-type=module -e "import * as Model from './js/model.js'; if (!Model.CATS || Model.CATS.length !== 3) throw new Error('CATS constant missing'); if (typeof Model.blankState !== 'function') throw new Error('blankState missing'); if (typeof Model.fmt !== 'function') throw new Error('fmt missing'); if (typeof Model.getFundProgress !== 'function') throw new Error('getFundProgress missing'); if (typeof Model.reconcileStates === 'function') throw new Error('reconcileStates should belong in sync.js'); console.log('Task 2 verified: js/model.js exports all financial model and calculation functions');"
  </verify>
  <done>
    `js/model.js` is created as a clean ES module exporting all financial calculations, models, and state functions, passing syntax verification and export assertions.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Application stylesheet is extracted into css/app.css and linked in index.html via external stylesheet tag
- [ ] Financial data model, state management, calculation formulas, income, loan, and fund domain logic are extracted into js/model.js
- [ ] js/model.js exports all core financial symbols as ES modules with zero DOM dependencies in calculation utilities

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] No syntax errors in css/app.css or js/model.js
