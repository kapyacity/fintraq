import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-env.js';

describe('FinTraQ Master Code PIN Lock & Weekly Backup Engine', () => {
  let ctx;

  beforeEach(() => {
    ctx = createTestContext();
    ctx.resetSpies();
    ctx.sessionStorage.clear();
  });

  describe('Master Code PIN Lock Initialization & Keypad', () => {
    it('defaults to 093377 as Master Code and pinEnabled: true', () => {
      assert.equal(ctx.state.pinCode, '093377');
      assert.equal(ctx.state.pinEnabled, true);
    });

    it('requires Master Code on startup when session is locked', () => {
      const overlay = ctx.setElement('appLockOverlay', { style: {} });
      ctx.checkAppLock();
      assert.equal(overlay.style.display, 'flex');
    });

    it('bypasses lock overlay if session is already unlocked', () => {
      ctx.sessionStorage.setItem('fintraq_session_unlocked', '1');
      const overlay = ctx.setElement('appLockOverlay', { style: {} });
      ctx.checkAppLock();
      assert.equal(overlay.style.display, 'none');
    });

    it('unlocks app when user enters 093377', () => {
      const overlay = ctx.setElement('appLockOverlay', { style: {} });
      ctx.checkAppLock();

      '093377'.split('').forEach(digit => ctx.pressPin(digit));

      assert.equal(overlay.style.display, 'none');
      assert.equal(ctx.sessionStorage.getItem('fintraq_session_unlocked'), '1');
      assert.ok(ctx.toasts.some(t => t.includes('Welcome')));
    });

    it('shows error and rejects unlock when user enters incorrect PIN', () => {
      const overlay = ctx.setElement('appLockOverlay', { style: {} });
      const errMsg = ctx.setElement('pinErrorMsg', { style: {} });
      ctx.checkAppLock();

      '123456'.split('').forEach(digit => ctx.pressPin(digit));

      assert.notEqual(overlay.style.display, 'none');
      assert.notEqual(ctx.sessionStorage.getItem('fintraq_session_unlocked'), '1');
      assert.equal(errMsg.style.display, 'block');
    });

    it('supports clearPin and backspacePin', () => {
      ctx.pressPin('1');
      ctx.pressPin('2');
      ctx.backspacePin();
      ctx.pressPin('3');
      ctx.clearPin();
      // After clear, entering full PIN should work
      '093377'.split('').forEach(digit => ctx.pressPin(digit));
      assert.equal(ctx.sessionStorage.getItem('fintraq_session_unlocked'), '1');
    });

    it('relocks app on lockAppNow() and removes session unlock flag', () => {
      ctx.sessionStorage.setItem('fintraq_session_unlocked', '1');
      const overlay = ctx.setElement('appLockOverlay', { style: {} });

      ctx.lockAppNow();

      assert.equal(ctx.sessionStorage.getItem('fintraq_session_unlocked'), null);
      assert.equal(overlay.style.display, 'flex');
      assert.ok(ctx.toasts.some(t => t.includes('Locked')));
    });

    it('updates Master Code when user enters valid 6 digits in settings', () => {
      ctx.setElement('pinCodeInput', { value: '654321' });
      ctx.savePinConfig();

      assert.equal(ctx.state.pinCode, '654321');
      assert.equal(ctx.state.pinEnabled, true);
      assert.ok(ctx.toasts.some(t => t.includes('updated')));
    });

    it('rejects invalid PIN formats (e.g. non-digits or not 6 digits)', () => {
      ctx.setElement('pinCodeInput', { value: '1234' });
      ctx.savePinConfig();
      assert.equal(ctx.state.pinCode, '093377'); // unchanged
      assert.ok(ctx.toasts.some(t => t.includes('must be exactly 6 digits')));

      ctx.setElement('pinCodeInput', { value: 'abcdef' });
      ctx.savePinConfig();
      assert.equal(ctx.state.pinCode, '093377'); // unchanged
    });

    it('toggles lock enabled and disabled', () => {
      ctx.togglePinEnabled();
      assert.equal(ctx.state.pinEnabled, false);

      const overlay = ctx.setElement('appLockOverlay', { style: {} });
      ctx.checkAppLock();
      assert.equal(overlay.style.display, 'none'); // bypasses when disabled

      ctx.togglePinEnabled();
      assert.equal(ctx.state.pinEnabled, true);
    });
  });

  describe('Automated Weekly Google Sheet Backup', () => {
    const testWebhook = 'https://script.google.com/macros/s/AKfycbxTest/exec';

    beforeEach(() => {
      ctx.state.googleSheetWebhookUrl = testWebhook;
      ctx.state.lastGSheetBackupAt = 0;
    });

    it('triggers weekly backup when never backed up before', () => {
      ctx.checkWeeklyGSheetBackup();

      assert.equal(ctx.fetchCalls.length, 1);
      const call = ctx.fetchCalls[0];
      const body = JSON.parse(call.opts.body);
      assert.equal(body.action, 'weekly_backup');
      assert.ok(Array.isArray(body.expenses));
      assert.ok(Array.isArray(body.inflows));
      assert.ok(Array.isArray(body.funds));
      assert.ok(Array.isArray(body.loans));
      assert.ok(ctx.state.lastGSheetBackupAt > 0);
    });

    it('triggers weekly backup when 7+ days have elapsed since last backup', () => {
      const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
      ctx.state.lastGSheetBackupAt = eightDaysAgo;

      ctx.checkWeeklyGSheetBackup();

      assert.equal(ctx.fetchCalls.length, 1);
      assert.ok(ctx.state.lastGSheetBackupAt > eightDaysAgo);
    });

    it('skips auto-backup if less than 7 days have elapsed', () => {
      const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
      ctx.state.lastGSheetBackupAt = twoDaysAgo;

      ctx.checkWeeklyGSheetBackup();

      assert.equal(ctx.fetchCalls.length, 0);
      assert.equal(ctx.state.lastGSheetBackupAt, twoDaysAgo);
    });

    it('allows manual immediate backup via runWeeklyGSheetBackup()', () => {
      const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
      ctx.state.lastGSheetBackupAt = twoDaysAgo;

      ctx.runWeeklyGSheetBackup(false);

      assert.equal(ctx.fetchCalls.length, 1);
      const body = JSON.parse(ctx.fetchCalls[0].opts.body);
      assert.equal(body.action, 'weekly_backup');
      assert.ok(ctx.state.lastGSheetBackupAt > twoDaysAgo);
      assert.ok(ctx.toasts.some(t => t.includes('Weekly backup sent')));
    });
  });
});
