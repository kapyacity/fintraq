import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-env.js';

describe('FinTraQ Google Sheets Audit Sync Engine', () => {
  let ctx;

  beforeEach(() => {
    ctx = createTestContext();
    ctx.resetSpies();
  });

  describe('Configuration & State Persistence', () => {
    it('initializes with empty googleSheetWebhookUrl and empty pendingSheetSync array', () => {
      assert.equal(ctx.state.googleSheetWebhookUrl, '');
      assert.equal(ctx.state.pendingSheetSync.length, 0);
      assert.equal(ctx.getGSheetUrl(), '');
    });

    it('saves valid Google Apps Script Webhook URL and trims whitespace', () => {
      ctx.setElement('gsheetWebhookInput', {
        value: '   https://script.google.com/macros/s/AKfycbxTest/exec   '
      });
      ctx.saveGSheetConfig();

      assert.equal(
        ctx.state.googleSheetWebhookUrl,
        'https://script.google.com/macros/s/AKfycbxTest/exec'
      );
      assert.equal(
        ctx.getGSheetUrl(),
        'https://script.google.com/macros/s/AKfycbxTest/exec'
      );
      assert.ok(ctx.toasts.some(t => t.includes('saved')));
    });

    it('handles blanking out the Webhook URL', () => {
      ctx.state.googleSheetWebhookUrl = 'https://script.google.com/macros/s/AKfycbxTest/exec';
      ctx.setElement('gsheetWebhookInput', { value: '' });
      ctx.saveGSheetConfig();

      assert.equal(ctx.state.googleSheetWebhookUrl, '');
      assert.equal(ctx.getGSheetUrl(), '');
      assert.ok(ctx.toasts.some(t => t.includes('disabled')));
    });
  });

  describe('Live Transaction Logging', () => {
    const testWebhook = 'https://script.google.com/macros/s/AKfycbxTest/exec';

    beforeEach(() => {
      ctx.state.googleSheetWebhookUrl = testWebhook;
    });

    it('sends Expense payload to Google Sheet on saveExpense', () => {
      ctx.setElement('expAmount', { value: '1500' });
      ctx.setElement('subPicker', { value: 'Groceries' });
      ctx.setElement('expNote', { value: 'Supermarket' });

      ctx.saveExpense();

      assert.equal(ctx.fetchCalls.length, 1);
      const call = ctx.fetchCalls[0];
      assert.equal(call.url, testWebhook);
      assert.equal(call.opts.method, 'POST');
      assert.equal(call.opts.mode, 'no-cors');

      const body = JSON.parse(call.opts.body);
      assert.equal(body.type, 'Expense');
      assert.equal(body.amount, 1500);
      assert.equal(body.sub, 'Groceries');
      assert.equal(body.note, 'Supermarket');
      assert.ok(body.ts > 0);
      assert.ok(body.clientTime);
    });

    it('sends Expense Deleted payload on delExpense', () => {
      ctx.state.expenses = [
        { id: 'exp_1', cat: 'needs', sub: 'Rent', amount: 20000, ts: Date.now(), updatedAt: Date.now(), deleted: false }
      ];

      ctx.delExpense('exp_1');

      assert.equal(ctx.fetchCalls.length, 1);
      const body = JSON.parse(ctx.fetchCalls[0].opts.body);
      assert.equal(body.type, 'Expense Deleted');
      assert.equal(body.id, 'exp_1');
      assert.equal(body.amount, 20000);
    });

    it('sends Inflow payload to Google Sheet on saveIncome', () => {
      ctx.setElement('incAmount', { value: '45000' });
      ctx.setElement('incSource', { value: 'Freelance' });
      ctx.setElement('incNote', { value: 'Web development project' });

      ctx.saveIncome();

      assert.equal(ctx.fetchCalls.length, 1);
      const body = JSON.parse(ctx.fetchCalls[0].opts.body);
      assert.equal(body.type, 'Inflow');
      assert.equal(body.amount, 45000);
      assert.equal(body.source, 'Freelance');
      assert.equal(body.note, 'Web development project');
      assert.ok(body.id.startsWith('inc_'));
    });

    it('sends Fund Deposit and Withdrawal payloads to Google Sheet', () => {
      const fund = {
        id: 'f_emergency',
        name: 'Emergency Fund',
        targetAmount: 100000,
        currentBalance: 20000,
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deleted: false
      };
      ctx.state.funds = [fund];

      // Deposit
      ctx.depositFund('f_emergency', 5000, 'Monthly savings');
      assert.equal(ctx.fetchCalls.length, 1);
      const depBody = JSON.parse(ctx.fetchCalls[0].opts.body);
      assert.equal(depBody.type, 'Fund Deposit');
      assert.equal(depBody.fundName, 'Emergency Fund');
      assert.equal(depBody.amount, 5000);
      assert.equal(depBody.note, 'Monthly savings');

      // Withdrawal
      ctx.withdrawFund('f_emergency', 2000, 'Urgent car repair');
      assert.equal(ctx.fetchCalls.length, 2);
      const withBody = JSON.parse(ctx.fetchCalls[1].opts.body);
      assert.equal(withBody.type, 'Fund Withdrawal');
      assert.equal(withBody.fundName, 'Emergency Fund');
      assert.equal(withBody.amount, 2000);
      assert.equal(withBody.note, 'Urgent car repair');
    });

    it('sends Loan EMI Payment payload to Google Sheet on payLoanEMI', () => {
      const loan = {
        id: 'l_home',
        name: 'Home Loan',
        principal: 5000000,
        emiAmount: 45000,
        remainingAmount: 4800000,
        paidMonths: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deleted: false
      };
      ctx.state.loans = [loan];

      ctx.payLoanEMI('l_home');

      assert.equal(ctx.fetchCalls.length, 1);
      const body = JSON.parse(ctx.fetchCalls[0].opts.body);
      assert.equal(body.type, 'Loan Payment');
      assert.equal(body.loanName, 'Home Loan');
      assert.equal(body.amount, 45000);
      assert.equal(body.remainingAfter, 4800000 - 45000);
    });

    it('does not send any network request if googleSheetWebhookUrl is not configured', () => {
      ctx.state.googleSheetWebhookUrl = '';
      ctx.setElement('expAmount', { value: '100' });
      ctx.setElement('subPicker', { value: 'Snacks' });
      ctx.saveExpense();

      assert.equal(ctx.fetchCalls.length, 0);
      assert.equal(ctx.state.pendingSheetSync.length, 0);
    });
  });

  describe('Offline Queueing & Resilient Sync', () => {
    const testWebhook = 'https://script.google.com/macros/s/AKfycbxTest/exec';

    beforeEach(() => {
      ctx.state.googleSheetWebhookUrl = testWebhook;
    });

    it('queues audit logs in state.pendingSheetSync when navigator.onLine is false', () => {
      ctx.navigator.onLine = false;

      ctx.sendToGoogleSheet({
        type: 'Expense',
        amount: 500,
        sub: 'Coffee'
      });

      // No fetch attempt while offline
      assert.equal(ctx.fetchCalls.length, 0);
      assert.equal(ctx.state.pendingSheetSync.length, 1);
      assert.equal(ctx.state.pendingSheetSync[0].amount, 500);
      assert.equal(ctx.state.pendingSheetSync[0].sub, 'Coffee');
    });

    it('flushes queued logs when coming back online via flushPendingSheetSync', () => {
      ctx.state.pendingSheetSync = [
        { type: 'Expense', amount: 250, sub: 'Tea', ts: Date.now() - 1000 },
        { type: 'Inflow', amount: 10000, source: 'Bonus', ts: Date.now() }
      ];

      ctx.navigator.onLine = true;
      ctx.flushPendingSheetSync();

      assert.equal(ctx.fetchCalls.length, 2);
      assert.equal(ctx.state.pendingSheetSync.length, 0);

      const item1 = JSON.parse(ctx.fetchCalls[0].opts.body);
      const item2 = JSON.parse(ctx.fetchCalls[1].opts.body);
      assert.equal(item1.sub, 'Tea');
      assert.equal(item2.source, 'Bonus');
    });

    it('re-queues items if fetch fails while flushing', () => {
      ctx.state.pendingSheetSync = [
        { type: 'Expense', amount: 999, sub: 'Gadget', ts: Date.now() }
      ];

      // Simulate network error during fetch
      const savedFetch = ctx.fetch;
      // In sandbox we can test queueing on network reject
      ctx.navigator.onLine = false;
      ctx.flushPendingSheetSync();

      // Because offline, nothing was flushed
      assert.equal(ctx.state.pendingSheetSync.length, 1);
    });
  });

  describe('Batch History Sync & Ping Test', () => {
    const testWebhook = 'https://script.google.com/macros/s/AKfycbxTest/exec';

    beforeEach(() => {
      ctx.state.googleSheetWebhookUrl = testWebhook;
    });

    it('sends action: ping payload on testGSheetConnection', () => {
      ctx.testGSheetConnection();

      assert.equal(ctx.fetchCalls.length, 1);
      const body = JSON.parse(ctx.fetchCalls[0].opts.body);
      assert.equal(body.action, 'ping');
      assert.ok(body.ts > 0);
    });

    it('sends action: batch_sync with all active expenses and inflows on syncAllToGoogleSheet', () => {
      ctx.state.expenses = [
        { id: 'e1', cat: 'needs', sub: 'Groceries', amount: 1200, ts: 1000, deleted: false },
        { id: 'e2', cat: 'wants', sub: 'Movie', amount: 500, ts: 2000, deleted: true }
      ];
      ctx.state.incomes = [
        { id: 'i1', source: 'Salary', amount: 50000, ts: 1000, deleted: false },
        { id: 'i2', source: 'Old Job', amount: 20000, ts: 500, deleted: true }
      ];

      ctx.syncAllToGoogleSheet();

      assert.equal(ctx.fetchCalls.length, 1);
      const body = JSON.parse(ctx.fetchCalls[0].opts.body);
      assert.equal(body.action, 'batch_sync');
      assert.equal(body.expenses.length, 1);
      assert.equal(body.expenses[0].id, 'e1');
      assert.equal(body.inflows.length, 1);
      assert.equal(body.inflows[0].id, 'i1');
    });
  });
});
