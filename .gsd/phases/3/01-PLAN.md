---
phase: 3
plan: "01"
wave: 1
depends_on: []
files_modified:
  - index.html
  - sw.js
  - tests/hygiene.test.js
autonomous: true
gap_closure: false
must_haves:
  truths:
    - "PeerJS library is deduplicated: loaded via external script tag in index.html instead of ~90KB inlined block"
    - "index.html file size is reduced by ~90KB (< 130KB) while maintaining full application functionality"
    - "Service Worker precaches peerjs.min.js and all listed ASSETS exist on disk"
    - "Service Worker CACHE_VERSION is bumped to fintraq-v15-dedup for seamless PWA cache eviction"
    - "All existing unit tests and new hygiene tests pass cleanly via npm test with zero regressions"
  artifacts:
    - "index.html contains <script src=\"./peerjs.min.js\"></script> and no inlined PeerJS code"
    - "peerjs.min.js exists at root as a standalone file"
    - "sw.js contains CACHE_VERSION = 'fintraq-v15-dedup' and valid ASSETS list"
    - "tests/hygiene.test.js contains automated checks for deduplication, bundle size, and precache integrity"
---

# Plan 3.01: Codebase Hygiene & Bundle Optimization

## Objective
Deduplicate the PeerJS library bundle and streamline the Service Worker precache (REQ-11). Extract the ~90KB inlined minified library block from `index.html` in favor of a clean `<script src="./peerjs.min.js"></script>` reference to the existing standalone file, bump `sw.js` `CACHE_VERSION` to `fintraq-v15-dedup` with verified precache asset integrity, and add an automated hygiene test suite ensuring zero bundle or test regressions.

## Context
Load these files for context:
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- index.html
- sw.js
- peerjs.min.js
- tests/helpers/test-env.js

## Tasks

<task type="auto">
  <name>Deduplicate PeerJS Library Bundle in index.html</name>
  <files>
    index.html
  </files>
  <action>
    Extract and remove the ~90KB inlined PeerJS library from `index.html` and replace it with an external script reference:

    1. In `index.html`, locate the script block containing the inlined PeerJS code (approximately lines 687-698):
       ```html
       <script>
       /* Inlined PeerJS WebRTC Library (Zero external network dependencies) */
       (()=>{function e(e,t,n,r){...
       ...
       //# sourceMappingURL=peerjs.min.js.map

       </script>
       ```
    2. Replace this entire `<script>...</script>` block with:
       ```html
       <script src="./peerjs.min.js"></script>
       ```
    3. Ensure the subsequent application script tag starting with:
       ```html
       <script>
       /* ---------------- Data model ---------------- */
       ```
       remains intact, unshifted in semantic structure, with all markers (`/* ---------------- Data model ---------------- */`, `function renderLoans()`, `function reconcileStates(local, remote)`, `function closeExistingPeer()`) preserved so `tests/helpers/test-env.js` continues to extract core modules seamlessly.
    4. Verify that `./peerjs.min.js` at the root is preserved and intact (~92KB).
    5. Check that the resulting `index.html` file size drops from ~185KB to under 130KB (~95KB).

    AVOID: Deleting `peerjs.min.js` from the repository root.
    AVOID: Altering the data model or sync function markers used by `tests/helpers/test-env.js`.
    USE: Single external script tag `<script src="./peerjs.min.js"></script>` loaded immediately prior to the application logic.
  </action>
  <verify>
    node --input-type=module -e "import fs from 'node:fs'; const html = fs.readFileSync('index.html', 'utf8'); if (!html.includes('<script src=\"./peerjs.min.js\"></script>')) throw new Error('Missing script src tag'); if (html.includes('Inlined PeerJS WebRTC Library')) throw new Error('Inlined PeerJS still present'); const stat = fs.statSync('index.html'); if (stat.size > 135000) throw new Error('File size not reduced: ' + stat.size); if (!fs.existsSync('peerjs.min.js')) throw new Error('peerjs.min.js missing'); console.log('Task 1 verified: script src tag present, inlined block removed, index.html size:', stat.size);"
  </verify>
  <done>
    `index.html` loads PeerJS via `<script src="./peerjs.min.js"></script>`, the inlined minified library code is completely removed, `index.html` file size is under 130KB, and `./peerjs.min.js` is preserved intact.
  </done>
</task>

<task type="auto">
  <name>Streamline Service Worker Precache Manifest & Bump Cache Version in sw.js</name>
  <files>
    sw.js
  </files>
  <action>
    Update Service Worker cache version and audit the precache manifest for strict parity with disk assets:

    1. In `sw.js`, locate `CACHE_VERSION` and update it from `'fintraq-v13-funds'` to:
       ```javascript
       const CACHE_VERSION = 'fintraq-v15-dedup';
       ```
    2. Review the `ASSETS` array:
       ```javascript
       const ASSETS = [
         './',
         './index.html',
         './peerjs.min.js',
         './manifest.webmanifest',
         './icon-192.png',
         './icon-512.png',
         './icon-maskable-512.png'
       ];
       ```
       Confirm that every asset listed exists on disk and is required for offline operation.
    3. Ensure `./peerjs.min.js` is precached so P2P sync works 100% offline without network round-trips.

    AVOID: Omitting `./peerjs.min.js` from `ASSETS` or referencing missing icon paths.
    USE: Clear version string `'fintraq-v15-dedup'` to trigger immediate cache invalidation and client claim on activate.
  </action>
  <verify>
    node --input-type=module -e "import fs from 'node:fs'; const sw = fs.readFileSync('sw.js', 'utf8'); if (!sw.includes(\"CACHE_VERSION = 'fintraq-v15-dedup'\")) throw new Error('CACHE_VERSION not bumped'); const match = sw.match(/const ASSETS = \[([\s\S]*?)\];/); if (!match) throw new Error('ASSETS array not found'); const assets = eval('[' + match[1] + ']'); for (const a of assets) { const p = a.replace(/^\.\//, ''); if (p !== '' && !fs.existsSync(p)) throw new Error('Asset missing: ' + p); } console.log('Task 2 verified: CACHE_VERSION updated, all assets exist:', assets);"
  </verify>
  <done>
    `CACHE_VERSION` in `sw.js` is bumped to `'fintraq-v15-dedup'`, and all 7 precache assets in `ASSETS` are verified to exist on disk.
  </done>
</task>

<task type="auto">
  <name>Automated Hygiene Test Suite & Zero-Regression Test Execution</name>
  <files>
    tests/hygiene.test.js
  </files>
  <action>
    Create a dedicated test suite for codebase hygiene, bundle audit, and precache validation, and verify all existing tests pass:

    1. Create `tests/hygiene.test.js` using `node:test` and `node:assert/strict`:
       - Suite: `FinTraQ Codebase Hygiene & Bundle Optimization (REQ-11)`
       - Test 1: `index.html` loads `./peerjs.min.js` via `<script src="./peerjs.min.js"></script>` and does not contain inlined PeerJS code (`Inlined PeerJS WebRTC Library`).
       - Test 2: `index.html` file size is reduced below 130KB (documenting ~90KB reduction), while `peerjs.min.js` exists at root with size > 80KB.
       - Test 3: `sw.js` defines `CACHE_VERSION = 'fintraq-v15-dedup'` and all precache assets declared in `ASSETS` exist on disk.
       - Test 4: `tests/helpers/test-env.js` successfully extracts data model and sync blocks from `index.html` and executes without errors in `node:vm`.
    2. Run the complete test suite:
       ```bash
       npm test
       ```
    3. Confirm that all 105 existing tests (across `budget.test.js`, `loans.test.js`, `rollover-income.test.js`, `sync.test.js`, `funds.test.js`) plus the new hygiene tests pass with 0 failures and 0 external dependencies.

    AVOID: Relying on brittle line number offsets; assert semantic tags, content markers, and file existence.
    USE: Native `node:test` and `node:assert/strict` with zero npm runtime dependencies.
  </action>
  <verify>
    npm test
  </verify>
  <done>
    `tests/hygiene.test.js` is created and passing, all 105+ existing tests continue to pass without error, and total test count increases with 0 regressions.
  </done>
</task>

## Must-Haves
After all tasks complete, verify:
- [ ] PeerJS library is deduplicated: loaded via external script tag in index.html instead of ~90KB inlined block
- [ ] index.html file size is reduced by ~90KB (< 130KB) while maintaining full application functionality
- [ ] Service Worker precaches peerjs.min.js and all listed ASSETS exist on disk
- [ ] Service Worker CACHE_VERSION is bumped to fintraq-v15-dedup for seamless PWA cache eviction
- [ ] All existing unit tests and new hygiene tests pass cleanly via npm test with zero regressions

## Success Criteria
- [ ] All tasks verified passing
- [ ] Must-haves confirmed
- [ ] No regressions in tests
