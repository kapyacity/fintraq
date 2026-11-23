import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-env.js';

describe('FinTraQ Automated Weekly Google Sheet Backup Engine', () => {
  let ctx;

  beforeEach(() => {
    ctx = createTestContext();
    ctx.resetSpies();
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
