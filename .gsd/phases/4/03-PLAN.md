---
phase: 4
plan: "03"
wave: 3
depends_on:
  - "02"
files_modified:
  - sw.js
  - tests/helpers/test-env.js
  - tests/hygiene.test.js
autonomous: true
gap_closure: false
must_haves:
  truths:
    - "Service Worker precache manifest in sw.js includes all modular assets (css/app.css, js/model.js, js/sync.js, js/app.js)"
    - "CACHE_VERSION in sw.js is bumped to fintraq-v16-modular for seamless cache invalidation"
    - "tests/helpers/test-env.js sources directly from modular files (js/model.js, js/sync.js) instead of string-slicing index.html"
    - "tests/hygiene.test.js verifies modular architecture, asset existence, and precache integrity"
    - "All 111+ tests pass cleanly via npm test with zero regressions"
  artifacts:
    - "sw.js contains CACHE_VERSION = 'fintraq-v16-modular' and updated ASSETS array"
    - "tests/helpers/test-env.js cleanly evaluates modular source files in sandbox"
    - "tests/hygiene.test.js contains automated checks for modular architecture and bundle integrity"
---

# Plan 4.03: Service Worker Precache Update, Test Harness Refactoring, & Architecture Verification

## Objective
Update the Service Worker precache manifest in `sw.js` to cache the new modular CSS and JS files, bump `CACHE_VERSION` to `'fintraq-v16-modular'`, refactor the test execution sandbox in `tests/helpers/test-env.js` to evaluate `js/model.js` and `js/sync.js` directly, update architecture validation tests in `tests/hygiene.test.js`, and verify that all 111+ tests pass cleanly with zero regressions (REQ-10).

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- sw.js
- tests/helpers/test-env.js
- tests/hygiene.test.js
- js/model.js
- js/sync.js
- js/app.js

## Tasks

<task type="auto">
  <name>Update Service Worker Precache Manifest & Bump Cache Version in sw.js</name>
  <files>
    sw.js
  </files>
  <action>
    Update `sw.js` to precache the modular assets for 100% offline functionality and bump cache version:

    1. In `sw.js`, locate `CACHE_VERSION` and update it to:
       ```javascript
       const CACHE_VERSION = 'fintraq-v16-modular';
       ```
    2. Update the `ASSETS` array to include all modular assets:
       ```javascript
       const ASSETS = [
         './',
         './index.html',
         './peerjs.min.js',
         './css/app.css',
         './js/model.js',
         './js/sync.js',
         './js/app.js',
         './manifest.webmanifest',
         './icon-192.png',
         './icon-512.png',
         './icon-maskable-512.png'
       ];
       ```
    3. Verify that every single asset in `ASSETS` exists on disk.
    4. Confirm that the fetch caching strategy properly supports ES module loading and CSS caching offline.

    AVOID: Leaving out any of `./css/app.css`, `./js/model.js`, `./js/sync.js`, or `./js/app.js` which would cause offline PWA launch failures.
    USE: Explicit version string `'fintraq-v16-modular'` to evict outdated bundles on client update.
  </action>
  <verify>
    node --input-type=module -e "import fs from 'node:fs'; const sw = fs.readFileSync('sw.js', 'utf8'); if (!sw.includes(\"CACHE_VERSION = 'fintraq-v16-modular'\")) throw new Error('CACHE_VERSION not bumped'); const match = sw.match(/const ASSETS = \[([\s\S]*?)\];/); if (!match) throw new Error('ASSETS array not found'); const assets = eval('[' + match[1] + ']'); const required = ['./css/app.css', './js/model.js', './js/sync.js', './js/app.js']; for (const r of required) { if (!assets.includes(r)) throw new Error('Missing precache asset: ' + r); } for (const a of assets) { const p = a.replace(/^\.\//, ''); if (p !== '' && !fs.existsSync(p)) throw new Error('Precache asset missing on disk: ' + p); } console.log('Task 1 verified: sw.js updated with modular ASSETS and CACHE_VERSION');"
  </verify>
  <done>
    `sw.js` contains `CACHE_VERSION = 'fintraq-v16-modular'`, precaches all modular files, and all assets are verified to exist on disk.
  </done>
</task>

<task type="auto">
  <name>Refactor test-env.js, Update hygiene.test.js, and Execute Full Test Suite</name>
  <files>
    tests/helpers/test-env.js
    tests/hygiene.test.js
  </files>
  <action>
    Modernize the test environment harness and test suite for the modular codebase:

    1. In `tests/helpers/test-env.js`:
       - Remove fragile marker slicing of `index.html` (`b1StartMarker`, `b2StartMarker`, etc.).
       - Read and compile `js/model.js` and `js/sync.js` directly:
         ```javascript
         const modelCode = fs.readFileSync(path.resolve(__dirname, '../../js/model.js'), 'utf8');
         const syncCode = fs.readFileSync(path.resolve(__dirname, '../../js/sync.js'), 'utf8');
         ```
       - Strip or bridge `export` statements when evaluating in Node's VM context, or wrap in a module runner, preserving the exact `createTestContext(initialStateOverrides)` API surface and spy bindings (`toasts`, `renders`, `syncBroadcasts`, `closeModalCalls`, `openModalCalls`, `localStorage`, `document`, `setElement`, `resetSpies`).
    2. In `tests/hygiene.test.js`:
       - Update tests to validate the modular architecture:
         - Test 1: `index.html` references `./css/app.css`, `./peerjs.min.js`, and `./js/app.js` (`type="module"`), without inline style or monolithic application script blocks.
         - Test 2: `index.html` file size is reduced to a lean shell (< 40KB).
         - Test 3: Standalone modular assets (`css/app.css`, `js/model.js`, `js/sync.js`, `js/app.js`, `peerjs.min.js`) exist on disk with valid file size and syntax.
         - Test 4: `sw.js` defines `CACHE_VERSION = 'fintraq-v16-modular'` and all 11 precache assets exist on disk.
         - Test 5: `createTestContext()` executes from modular code and verifies domain model, state, and sync calculation integrity.
    3. Run the full test suite via `npm test` and confirm all 111+ tests pass with zero failures and zero regressions.

    AVOID: Changing the public interface of `createTestContext()` used by the 105 existing tests.
    USE: Direct sourcing from `js/model.js` and `js/sync.js` in `test-env.js`.
  </action>
  <verify>
    npm test
  </verify>
  <done>
    `test-env.js` sources from modular files, `tests/hygiene.test.js` tests modular architecture, and all 111+ tests pass cleanly via `npm test`.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] Service Worker precache manifest in sw.js includes all modular assets (css/app.css, js/model.js, js/sync.js, js/app.js)
- [ ] CACHE_VERSION in sw.js is bumped to fintraq-v16-modular for seamless cache invalidation
- [ ] tests/helpers/test-env.js sources directly from modular files (js/model.js, js/sync.js) instead of string-slicing index.html
- [ ] tests/hygiene.test.js verifies modular architecture, asset existence, and precache integrity
- [ ] All 111+ tests pass cleanly via npm test with zero regressions

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] 100% test pass rate across all test suites
