import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-env.js';

describe('FinTraQ Dedicated Target & Emergency Funds Engine (REQ-13)', () => {
  describe('Fund Lifecycle (Creation, Update, Soft-Delete)', () => {
    it('creates a new fund with zero initial balance and valid defaults', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({
        name: 'Emergency Fund',
        target: 100000,
        category: 'emergency',
        color: '#10b981',
        icon: 'shield'
      });

      assert.ok(fund, 'Fund should be returned');
      assert.ok(fund.id.startsWith('fund_'), 'Fund ID should start with fund_');
      assert.equal(fund.name, 'Emergency Fund');
      assert.equal(fund.target, 100000);
      assert.equal(fund.balance, 0);
      assert.equal(fund.category, 'emergency');
      assert.equal(fund.color, '#10b981');
      assert.equal(fund.icon, 'shield');
      assert.equal(fund.deleted, false);
      assert.equal(fund.history.length, 0);
      assert.equal(ctx.state.funds.length, 1);
      assert.equal(ctx.renders, 1);
      assert.equal(ctx.syncBroadcasts, 1);
      assert.ok(ctx.toasts.includes('Fund created ✓'));
    });

    it('creates a fund with an optional initial balance and initial history record', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({
        name: 'Europe Trip',
        target: 200000,
        initialBalance: 25000,
        category: 'trip',
        color: '#3b82f6',
        icon: 'plane'
      });

      assert.ok(fund);
      assert.equal(fund.balance, 25000);
      assert.equal(fund.history.length, 1);
      assert.equal(fund.history[0].type, 'deposit');
      assert.equal(fund.history[0].amount, 25000);
      assert.equal(fund.history[0].note, 'Initial deposit');
    });

    it('updates an existing fund name, target, and metadata without clearing balance or history', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({
        name: 'Old Fund',
        target: 50000
      });
      ctx.depositFund(fund.id, 10000, 'Seed');

      const updated = ctx.saveFund({
        id: fund.id,
        name: 'Emergency Reserve',
        target: 150000,
        color: '#059669',
        icon: 'lock'
      });

      assert.equal(updated.id, fund.id);
      assert.equal(updated.name, 'Emergency Reserve');
      assert.equal(updated.target, 150000);
      assert.equal(updated.balance, 10000);
      assert.equal(updated.history.length, 1);
      assert.equal(updated.color, '#059669');
      assert.equal(updated.icon, 'lock');
      assert.ok(ctx.toasts.includes('Fund updated ✓'));
    });

    it('rejects fund creation when name is empty or target is non-positive', () => {
      const ctx = createTestContext();
      const emptyNameFund = ctx.saveFund({ name: '   ', target: 50000 });
      assert.equal(emptyNameFund, null);
      assert.equal(ctx.state.funds.length, 0);

      const zeroTargetFund = ctx.saveFund({ name: 'Valid Name', target: 0 });
      assert.equal(zeroTargetFund, null);
      assert.equal(ctx.state.funds.length, 0);

      const negTargetFund = ctx.saveFund({ name: 'Valid Name', target: -500 });
      assert.equal(negTargetFund, null);
      assert.equal(ctx.state.funds.length, 0);
    });

    it('soft-deletes a fund and marks deleted: true with timestamp update', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({ name: 'Gadget Fund', target: 80000 });
      const origUpdatedAt = fund.updatedAt;

      const deleted = ctx.delFund(fund.id);
      assert.equal(deleted, true);
      assert.equal(fund.deleted, true);
      assert.ok(fund.updatedAt >= origUpdatedAt);
      assert.ok(ctx.toasts.includes('Fund deleted'));
      assert.equal(ctx.syncBroadcasts, 2); // 1 create + 1 delete
    });
  });

  describe('Deposit & Withdrawal Transactions', () => {
    it('deposits funds incrementally and logs timestamped transaction history', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({ name: 'Rainy Day', target: 50000 });
      assert.equal(fund.balance, 0);

      // First deposit
      const dep1 = ctx.depositFund(fund.id, 10000, 'Bonus credit');
      assert.equal(dep1, true);
      assert.equal(fund.balance, 10000);
      assert.equal(fund.history.length, 1);
      assert.equal(fund.history[0].type, 'deposit');
      assert.equal(fund.history[0].amount, 10000);
      assert.equal(fund.history[0].note, 'Bonus credit');
      assert.ok(fund.history[0].ts > 0);
      assert.ok(fund.history[0].id.startsWith('tx_'));

      // Subsequent deposit
      const dep2 = ctx.depositFund(fund.id, 15000, 'Freelance payment');
      assert.equal(dep2, true);
      assert.equal(fund.balance, 25000);
      assert.equal(fund.history.length, 2);
      assert.equal(fund.history[1].amount, 15000);
      assert.equal(fund.history[1].note, 'Freelance payment');
    });

    it('rejects non-positive deposit amounts', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({ name: 'Goal', target: 20000 });

      const zeroDep = ctx.depositFund(fund.id, 0);
      assert.equal(zeroDep, false);
      assert.equal(fund.balance, 0);
      assert.equal(fund.history.length, 0);

      const negDep = ctx.depositFund(fund.id, -1000);
      assert.equal(negDep, false);
      assert.equal(fund.balance, 0);
      assert.equal(fund.history.length, 0);

      const nanDep = ctx.depositFund(fund.id, 'invalid');
      assert.equal(nanDep, false);
      assert.equal(fund.balance, 0);
    });

    it('withdraws funds and logs withdrawal history', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({ name: 'Bike Fund', target: 60000 });
      ctx.depositFund(fund.id, 25000, 'Savings');

      const withRes = ctx.withdrawFund(fund.id, 5000, 'Helmet purchase');
      assert.equal(withRes, true);
      assert.equal(fund.balance, 20000);
      assert.equal(fund.history.length, 2);

      const lastTx = fund.history[1];
      assert.equal(lastTx.type, 'withdraw');
      assert.equal(lastTx.amount, 5000);
      assert.equal(lastTx.note, 'Helmet purchase');
      assert.ok(lastTx.ts > 0);
    });

    it('rejects overdrafts and preserves existing balance and history', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({ name: 'Emergency', target: 100000 });
      ctx.depositFund(fund.id, 20000, 'Emergency buffer');

      // Attempting to withdraw ₹25,000 when balance is ₹20,000
      const overdraft = ctx.withdrawFund(fund.id, 25000, 'Major repair');
      assert.equal(overdraft, false);
      assert.equal(fund.balance, 20000, 'Balance must remain unchanged after overdraft attempt');
      assert.equal(fund.history.length, 1, 'No withdrawal transaction should be logged on overdraft');
      assert.ok(ctx.toasts.some(t => t.includes('Cannot withdraw more than available balance')));
    });

    it('rejects non-positive withdrawal amounts', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({ name: 'Emergency', target: 50000 });
      ctx.depositFund(fund.id, 10000);

      const zeroWith = ctx.withdrawFund(fund.id, 0);
      assert.equal(zeroWith, false);
      assert.equal(fund.balance, 10000);

      const negWith = ctx.withdrawFund(fund.id, -2000);
      assert.equal(negWith, false);
      assert.equal(fund.balance, 10000);
    });
  });

  describe('Progress & Target Calculations (getFundProgress)', () => {
    it('calculates correct percentage and remaining amount for standard progress', () => {
      const ctx = createTestContext();
      const fund = {
        target: 100000,
        balance: 25000
      };

      const prog = ctx.getFundProgress(fund);
      assert.equal(prog.percent, 25);
      assert.equal(prog.percentage, 25);
      assert.equal(prog.remaining, 75000);
    });

    it('caps progress percentage at 100% and sets remaining to 0 when overfunded', () => {
      const ctx = createTestContext();
      const fund = {
        target: 100000,
        balance: 120000
      };

      const prog = ctx.getFundProgress(fund);
      assert.equal(prog.percent, 100);
      assert.equal(prog.percentage, 100);
      assert.equal(prog.remaining, 0);
    });

    it('handles zero balance with 0% progress and full remaining target', () => {
      const ctx = createTestContext();
      const fund = {
        target: 50000,
        balance: 0
      };

      const prog = ctx.getFundProgress(fund);
      assert.equal(prog.percent, 0);
      assert.equal(prog.remaining, 50000);
    });

    it('handles null, undefined, or zero target funds gracefully', () => {
      const ctx = createTestContext();
      const nullProg = ctx.getFundProgress(null);
      assert.equal(nullProg.percent, 0);
      assert.equal(nullProg.percentage, 0);
      assert.equal(nullProg.remaining, 0);

      const zeroTarget = ctx.getFundProgress({ target: 0, balance: 500 });
      assert.equal(zeroTarget.percent, 100);
      assert.equal(zeroTarget.remaining, 0);
    });
  });

  describe('P2P LWW Sync Reconciliation for Funds', () => {
    it('inserts disjoint remote funds into local state', () => {
      const ctx = createTestContext();
      const local = { funds: [] };
      const remote = {
        funds: [
          {
            id: 'fund-1',
            name: 'Emergency Fund',
            target: 100000,
            balance: 30000,
            category: 'emergency',
            updatedAt: 1000,
            deleted: false,
            history: []
          }
        ]
      };

      const changed = ctx.reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.funds.length, 1);
      assert.equal(local.funds[0].id, 'fund-1');
      assert.equal(local.funds[0].name, 'Emergency Fund');
      assert.equal(local.funds[0].balance, 30000);
    });

    it('replaces local fund when remote record has strictly newer updatedAt', () => {
      const ctx = createTestContext();
      const local = {
        funds: [
          {
            id: 'fund-1',
            name: 'Trip',
            target: 50000,
            balance: 10000,
            updatedAt: 1000,
            deleted: false,
            history: []
          }
        ]
      };
      const remote = {
        funds: [
          {
            id: 'fund-1',
            name: 'Europe Trip 2026',
            target: 70000,
            balance: 25000,
            updatedAt: 2000,
            deleted: false,
            history: [{ id: 'tx-1', type: 'deposit', amount: 15000, ts: 1500 }]
          }
        ]
      };

      const changed = ctx.reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.funds.length, 1);
      assert.equal(local.funds[0].name, 'Europe Trip 2026');
      assert.equal(local.funds[0].target, 70000);
      assert.equal(local.funds[0].balance, 25000);
      assert.equal(local.funds[0].history.length, 1);
    });

    it('preserves local fund when local updatedAt is newer or equal', () => {
      const ctx = createTestContext();
      const local = {
        funds: [
          {
            id: 'fund-1',
            name: 'Local Newer',
            target: 100000,
            balance: 50000,
            updatedAt: 3000,
            deleted: false,
            history: []
          }
        ]
      };
      const remoteOlder = {
        funds: [
          {
            id: 'fund-1',
            name: 'Remote Stale',
            target: 100000,
            balance: 20000,
            updatedAt: 1500,
            deleted: false,
            history: []
          }
        ]
      };

      let changed = ctx.reconcileStates(local, remoteOlder);
      assert.equal(changed, false);
      assert.equal(local.funds[0].name, 'Local Newer');
      assert.equal(local.funds[0].balance, 50000);

      const remoteEqual = {
        funds: [
          {
            id: 'fund-1',
            name: 'Remote Equal',
            target: 100000,
            balance: 30000,
            updatedAt: 3000,
            deleted: false,
            history: []
          }
        ]
      };
      changed = ctx.reconcileStates(local, remoteEqual);
      assert.equal(changed, false);
      assert.equal(local.funds[0].name, 'Local Newer');
    });

    it('propagates soft-deleted fund tombstones across peers on sync', () => {
      const ctx = createTestContext();
      const local = {
        funds: [
          {
            id: 'fund-1',
            name: 'Active Fund',
            target: 50000,
            balance: 20000,
            updatedAt: 1000,
            deleted: false,
            history: []
          }
        ]
      };
      const remoteTombstone = {
        funds: [
          {
            id: 'fund-1',
            name: 'Active Fund',
            target: 50000,
            balance: 20000,
            updatedAt: 2000,
            deleted: true,
            history: []
          }
        ]
      };

      const changed = ctx.reconcileStates(local, remoteTombstone);
      assert.equal(changed, true);
      assert.equal(local.funds[0].deleted, true);
      assert.equal(local.funds[0].updatedAt, 2000);
    });

    it('reconciles state exported via createSyncPayload end-to-end between peer instances', async () => {
      const peerA = createTestContext();
      const peerB = createTestContext();

      // Peer A creates an emergency fund and deposits ₹15,000
      const fund = peerA.saveFund({
        name: 'Peer A Emergency',
        target: 100000,
        category: 'emergency'
      });
      peerA.depositFund(fund.id, 15000, 'Initial deposit');

      // Export payload from Peer A and reconcile onto Peer B
      const payloadA = peerA.createSyncPayload();
      assert.ok(payloadA.funds, 'createSyncPayload should include funds');
      assert.equal(payloadA.funds.length, 1);

      const changedB = peerB.reconcileStates(peerB.state, payloadA);
      assert.equal(changedB, true);
      assert.equal(peerB.state.funds.length, 1);
      assert.equal(peerB.state.funds[0].name, 'Peer A Emergency');
      assert.equal(peerB.state.funds[0].balance, 15000);
      assert.equal(peerB.state.funds[0].history.length, 1);

      // Wait a short tick so that Peer B's subsequent withdrawal has a strictly newer timestamp
      await new Promise(resolve => setTimeout(resolve, 5));

      // Now Peer B withdraws ₹5,000 and syncs back to Peer A
      peerB.withdrawFund(fund.id, 5000, 'Medical expense');
      const payloadB = peerB.createSyncPayload();

      const changedA = peerA.reconcileStates(peerA.state, payloadB);
      assert.equal(changedA, true);
      assert.equal(peerA.state.funds[0].balance, 10000);
      assert.equal(peerA.state.funds[0].history.length, 2);
    });
  });

  describe('Funds UI Modals & Interaction Handlers', () => {
    it('openFundModal populates fields for create and triggers openModal', () => {
      const ctx = createTestContext();
      ctx.openFundModal();
      assert.ok(ctx.openModalCalls.includes('fundModal'));
      assert.equal(ctx.document.getElementById('fundEditId').value, '');
      assert.equal(ctx.document.getElementById('fundModalTitle').textContent, 'Add Target / Emergency Fund');
      assert.equal(ctx.document.getElementById('fundName').value, '');
      assert.equal(ctx.document.getElementById('fundTarget').value, '');
    });

    it('openFundModal populates existing fund fields for editing', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({
        name: 'Japan Trip',
        target: 250000,
        category: 'trip',
        color: '#3b82f6',
        icon: 'plane'
      });
      ctx.resetSpies();

      ctx.openFundModal(fund.id);
      assert.ok(ctx.openModalCalls.includes('fundModal'));
      assert.equal(ctx.document.getElementById('fundEditId').value, fund.id);
      assert.equal(ctx.document.getElementById('fundModalTitle').textContent, 'Edit Fund');
      assert.equal(ctx.document.getElementById('fundName').value, 'Japan Trip');
      assert.equal(ctx.document.getElementById('fundTarget').value, 250000);
      assert.equal(ctx.document.getElementById('fundIconSelect').value, 'plane');
    });

    it('saveFund() without arguments reads inputs from DOM and creates fund', () => {
      const ctx = createTestContext();
      ctx.setElement('fundEditId', { value: '' });
      ctx.setElement('fundName', { value: 'New Laptop Fund' });
      ctx.setElement('fundTarget', { value: '120000' });
      ctx.setElement('fundInitBal', { value: '10000' });
      ctx.setElement('fundIconSelect', { value: 'laptop' });
      ctx.setElement('fundColorSelect', { value: '#8b5cf6' });

      const fund = ctx.saveFund();
      assert.ok(fund);
      assert.equal(fund.name, 'New Laptop Fund');
      assert.equal(fund.target, 120000);
      assert.equal(fund.balance, 10000);
      assert.equal(fund.category, 'gadget');
      assert.equal(fund.icon, 'laptop');
      assert.ok(ctx.closeModalCalls.includes('fundModal'));
    });

    it('openDepositModal and handleDepositSubmit deposit amount and close modal', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({ name: 'Emergency Fund', target: 50000 });
      ctx.resetSpies();

      ctx.openDepositModal(fund.id);
      assert.ok(ctx.openModalCalls.includes('fundDepositModal'));
      assert.equal(ctx.document.getElementById('depositFundId').value, fund.id);
      assert.ok(ctx.document.getElementById('depositFundTitle').textContent.includes('Emergency Fund'));

      // Submit deposit via modal handler
      ctx.setElement('depositAmount', { value: '5000' });
      ctx.setElement('depositNote', { value: 'Freelance cut' });
      ctx.handleDepositSubmit();

      assert.equal(fund.balance, 5000);
      assert.ok(ctx.closeModalCalls.includes('fundDepositModal'));
      assert.ok(ctx.toasts.some(t => t.includes('Deposited')));
    });

    it('openWithdrawModal and handleWithdrawSubmit withdraw amount and close modal', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({ name: 'Emergency Fund', target: 50000, initialBalance: 20000 });
      ctx.resetSpies();

      ctx.openWithdrawModal(fund.id);
      assert.ok(ctx.openModalCalls.includes('fundWithdrawModal'));
      assert.equal(ctx.document.getElementById('withdrawFundId').value, fund.id);
      assert.ok(ctx.document.getElementById('withdrawFundBalance').textContent.includes('20,000'));

      // Submit withdrawal via modal handler
      ctx.setElement('withdrawAmount', { value: '4000' });
      ctx.setElement('withdrawNote', { value: 'Car battery repair' });
      ctx.handleWithdrawSubmit();

      assert.equal(fund.balance, 16000);
      assert.ok(ctx.closeModalCalls.includes('fundWithdrawModal'));
      assert.ok(ctx.toasts.some(t => t.includes('Withdrew')));
    });

    it('openFundHistoryModal displays deposit and withdrawal entries in innerHTML', () => {
      const ctx = createTestContext();
      const fund = ctx.saveFund({ name: 'Travel Fund', target: 80000 });
      ctx.depositFund(fund.id, 15000, 'Salary savings');
      ctx.withdrawFund(fund.id, 3000, 'Passport renewal');
      ctx.resetSpies();

      ctx.openFundHistoryModal(fund.id);
      assert.ok(ctx.openModalCalls.includes('fundHistoryModal'));
      const listHtml = ctx.document.getElementById('fundHistoryList').innerHTML;
      assert.ok(listHtml.includes('Salary savings'));
      assert.ok(listHtml.includes('Passport renewal'));
      assert.ok(listHtml.includes('+ Deposit'));
      assert.ok(listHtml.includes('- Withdraw'));
    });
  });
});
