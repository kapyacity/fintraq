import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestContext } from './helpers/test-env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const indexPath = path.resolve(rootDir, 'index.html');
const swPath = path.resolve(rootDir, 'sw.js');
const peerjsPath = path.resolve(rootDir, 'peerjs.min.js');

describe('FinTraQ Codebase Hygiene & Bundle Optimization (REQ-11)', () => {
  describe('PeerJS Bundle Deduplication in index.html', () => {
    it('loads peerjs.min.js via external script tag instead of inlined library block', () => {
      const html = fs.readFileSync(indexPath, 'utf8');

      // Verify external script tag is present
      assert.ok(
        html.includes('<script src="./peerjs.min.js"></script>'),
        'index.html must reference standalone peerjs.min.js via script src tag'
      );

      // Verify inlined PeerJS code is completely removed
      assert.ok(
        !html.includes('Inlined PeerJS WebRTC Library'),
        'index.html must not contain inlined PeerJS header comment'
      );
      assert.ok(
        !html.includes('(()=>{function e(e,t,n,r){Object.defineProperty'),
        'index.html must not contain minified PeerJS bundle code'
      );

      // Verify that script tag precedes application data model script
      const scriptTagIndex = html.indexOf('<script src="./peerjs.min.js"></script>');
      const dataModelIndex = html.indexOf('/* ---------------- Data model ---------------- */');
      assert.ok(scriptTagIndex !== -1, 'Script tag must exist');
      assert.ok(dataModelIndex !== -1, 'Data model marker must exist');
      assert.ok(
        scriptTagIndex < dataModelIndex,
        'PeerJS external script tag must be loaded prior to data model script'
      );
    });

    it('preserves standalone peerjs.min.js asset at repository root with intact size', () => {
      assert.ok(fs.existsSync(peerjsPath), 'peerjs.min.js must exist at root');
      const stat = fs.statSync(peerjsPath);
      assert.ok(
        stat.size > 80 * 1024,
        `peerjs.min.js size should be > 80KB (actual: ${stat.size} bytes)`
      );
    });

    it('verifies index.html file size reduction documenting ~90KB deduplication', () => {
      const stat = fs.statSync(indexPath);

      // 130 KiB = 133,120 bytes; after 92.9KB PeerJS dedup, index.html is ~132.4KB (< 130KiB binary)
      assert.ok(
        stat.size < 135000,
        `index.html size must be reduced below 135KB (actual: ${stat.size} bytes)`
      );
      assert.ok(
        stat.size < 130 * 1024,
        `index.html size in binary KiB must be under 130 KiB (actual: ${(stat.size / 1024).toFixed(2)} KiB)`
      );
    });
  });

  describe('Service Worker Precache Manifest & Versioning in sw.js', () => {
    it('defines CACHE_VERSION as fintraq-v15-dedup or newer for cache eviction', () => {
      const sw = fs.readFileSync(swPath, 'utf8');
      assert.ok(
        /const CACHE_VERSION = 'fintraq-v(1[5-9]|20)/.test(sw),
        "sw.js must define CACHE_VERSION"
      );
    });

    it('precaches peerjs.min.js and verifies all declared precache assets exist on disk', () => {
      const sw = fs.readFileSync(swPath, 'utf8');
      const match = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
      assert.ok(match, 'sw.js must define an ASSETS array');

      // Parse assets from declaration
      const assetEntries = match[1]
        .split(',')
        .map(entry => entry.trim().replace(/^['"]|['"]$/g, ''))
        .filter(entry => entry.length > 0);

      assert.ok(
        assetEntries.includes('./peerjs.min.js'),
        'ASSETS array must precache ./peerjs.min.js for 100% offline P2P sync'
      );
      assert.ok(
        assetEntries.includes('./index.html'),
        'ASSETS array must precache ./index.html'
      );
      assert.ok(
        assetEntries.includes('./manifest.webmanifest'),
        'ASSETS array must precache ./manifest.webmanifest'
      );

      // Verify every file declared in ASSETS exists on disk
      for (const asset of assetEntries) {
        const relativePath = asset.replace(/^\.\//, '');
        const targetPath = relativePath === '' ? indexPath : path.resolve(rootDir, relativePath);
        assert.ok(
          fs.existsSync(targetPath),
          `Asset declared in sw.js ASSETS must exist on disk: ${asset} -> ${targetPath}`
        );
      }
    });
  });

  describe('Test Harness Extraction and Core Module Execution Integrity', () => {
    it('successfully extracts data model and sync blocks from index.html without errors', () => {
      const ctx = createTestContext();

      // Verify core symbols are extracted and functional
      assert.ok(ctx.state, 'state must be initialized');
      assert.ok(Array.isArray(ctx.state.expenses), 'expenses array must exist');
      assert.ok(Array.isArray(ctx.state.loans), 'loans array must exist');
      assert.ok(Array.isArray(ctx.state.incomes), 'incomes array must exist');
      assert.ok(Array.isArray(ctx.state.funds), 'funds array must exist');
      assert.equal(typeof ctx.fmt, 'function', 'fmt helper must be defined');
      assert.equal(typeof ctx.reconcileStates, 'function', 'reconcileStates must be defined');
      assert.equal(typeof ctx.createSyncPayload, 'function', 'createSyncPayload must be defined');

      // Verify helper execution
      assert.equal(ctx.fmt(50000), '₹50,000');
      assert.equal(ctx.subKey('needs', 'Rent'), 'needs::Rent');
    });
  });
});
