import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-env.js';

describe('FinTraQ P2P LWW Sync Engine', () => {
  const ctx = createTestContext();
  const { reconcileStates, createSyncPayload } = ctx;

  describe('Expenses LWW Merge & Tombstone Propagation', () => {
    it('inserts disjoint remote expenses not present in local state', () => {
      const local = {
        expenses: [
          { id: 'exp-1', title: 'Groceries', amount: 1500, cat: 'needs', updatedAt: 1000 }
        ]
      };
      const remote = {
        expenses: [
          { id: 'exp-2', title: 'Dinner', amount: 800, cat: 'wants', updatedAt: 1100 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.expenses.length, 2);
      assert.deepEqual(local.expenses.map(e => e.id).sort(), ['exp-1', 'exp-2']);
      assert.equal(local.expenses.find(e => e.id === 'exp-2').title, 'Dinner');
    });

    it('replaces local expense when remote record has strictly newer updatedAt', () => {
      const local = {
        expenses: [
          { id: 'exp-1', title: 'Old Title', amount: 1000, cat: 'needs', updatedAt: 1000 }
        ]
      };
      const remote = {
        expenses: [
          { id: 'exp-1', title: 'Updated Title', amount: 1200, cat: 'needs', updatedAt: 2000 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.expenses.length, 1);
      assert.equal(local.expenses[0].title, 'Updated Title');
      assert.equal(local.expenses[0].amount, 1200);
      assert.equal(local.expenses[0].updatedAt, 2000);
    });

    it('preserves local expense when local updatedAt is greater than or equal to remote', () => {
      const local = {
        expenses: [
          { id: 'exp-1', title: 'Local Newer', amount: 1500, cat: 'needs', updatedAt: 2000 }
        ]
      };
      const remoteOlder = {
        expenses: [
          { id: 'exp-1', title: 'Remote Stale', amount: 1000, cat: 'needs', updatedAt: 1000 }
        ]
      };

      let changed = reconcileStates(local, remoteOlder);
      assert.equal(changed, false);
      assert.equal(local.expenses[0].title, 'Local Newer');
      assert.equal(local.expenses[0].amount, 1500);

      // Equal timestamps: local wins (>= rule)
      const remoteEqual = {
        expenses: [
          { id: 'exp-1', title: 'Remote Concurrent', amount: 1100, cat: 'needs', updatedAt: 2000 }
        ]
      };
      changed = reconcileStates(local, remoteEqual);
      assert.equal(changed, false);
      assert.equal(local.expenses[0].title, 'Local Newer');
    });

    it('falls back to ts when updatedAt is undefined', () => {
      const local = {
        expenses: [
          { id: 'exp-1', title: 'Legacy Expense', amount: 500, ts: 1000 }
        ]
      };
      const remote = {
        expenses: [
          { id: 'exp-1', title: 'Newer Expense', amount: 600, ts: 2000 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.expenses[0].title, 'Newer Expense');
      assert.equal(local.expenses[0].amount, 600);
    });

    it('propagates soft-deleted tombstones when remote is newer', () => {
      const local = {
        expenses: [
          { id: 'exp-1', title: 'Active Expense', amount: 500, deleted: false, updatedAt: 1000 }
        ]
      };
      const remote = {
        expenses: [
          { id: 'exp-1', title: 'Active Expense', amount: 500, deleted: true, updatedAt: 2000 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.expenses.length, 1);
      assert.equal(local.expenses[0].deleted, true);
      assert.equal(local.expenses[0].updatedAt, 2000);
    });

    it('preserves local deletion tombstone if local is newer than remote resurrection', () => {
      const local = {
        expenses: [
          { id: 'exp-1', title: 'Deleted Item', amount: 500, deleted: true, updatedAt: 3000 }
        ]
      };
      const remote = {
        expenses: [
          { id: 'exp-1', title: 'Stale Item', amount: 500, deleted: false, updatedAt: 2000 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, false);
      assert.equal(local.expenses[0].deleted, true);
    });
  });

  describe('Loans LWW Merge & Payoff State', () => {
    it('inserts disjoint remote loans into local state', () => {
      const local = { loans: [] };
      const remote = {
        loans: [
          { id: 'loan-1', title: 'Car Loan', totalAmount: 300000, emiAmount: 10000, remainingAmount: 250000, updatedAt: 1500 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.loans.length, 1);
      assert.equal(local.loans[0].title, 'Car Loan');
    });

    it('updates remainingAmount and paidMonths from newer remote record', () => {
      const local = {
        loans: [
          {
            id: 'loan-1',
            title: 'Home Loan',
            totalAmount: 2000000,
            remainingAmount: 1900000,
            paidMonths: ['2026-01'],
            updatedAt: 1000
          }
        ]
      };
      const remote = {
        loans: [
          {
            id: 'loan-1',
            title: 'Home Loan',
            totalAmount: 2000000,
            remainingAmount: 1800000,
            paidMonths: ['2026-01', '2026-02'],
            updatedAt: 2000
          }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.loans[0].remainingAmount, 1800000);
      assert.deepEqual(local.loans[0].paidMonths, ['2026-01', '2026-02']);
      assert.equal(local.loans[0].updatedAt, 2000);
    });

    it('propagates soft-deleted loan tombstones when remote is newer', () => {
      const local = {
        loans: [
          { id: 'loan-1', title: 'Personal Loan', deleted: false, updatedAt: 1000 }
        ]
      };
      const remote = {
        loans: [
          { id: 'loan-1', title: 'Personal Loan', deleted: true, updatedAt: 2000 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.loans[0].deleted, true);
    });

    it('ignores stale remote loan updates', () => {
      const local = {
        loans: [
          { id: 'loan-1', title: 'Education Loan', remainingAmount: 50000, updatedAt: 5000 }
        ]
      };
      const remote = {
        loans: [
          { id: 'loan-1', title: 'Education Loan Old', remainingAmount: 100000, updatedAt: 3000 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, false);
      assert.equal(local.loans[0].remainingAmount, 50000);
    });
  });

  describe('Incomes LWW Merge', () => {
    it('inserts disjoint remote inflows into local state', () => {
      const local = { incomes: [] };
      const remote = {
        incomes: [
          { id: 'inc-1', title: 'Freelance Design', amount: 15000, updatedAt: 1200 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.incomes.length, 1);
      assert.equal(local.incomes[0].title, 'Freelance Design');
      assert.equal(local.incomes[0].amount, 15000);
    });

    it('replaces local income with newer remote income update', () => {
      const local = {
        incomes: [
          { id: 'inc-1', title: 'Bonus', amount: 5000, updatedAt: 1000 }
        ]
      };
      const remote = {
        incomes: [
          { id: 'inc-1', title: 'Performance Bonus', amount: 7500, updatedAt: 2000 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.incomes[0].title, 'Performance Bonus');
      assert.equal(local.incomes[0].amount, 7500);
    });

    it('propagates soft-deleted income tombstones', () => {
      const local = {
        incomes: [
          { id: 'inc-1', title: 'Dividend', amount: 1000, deleted: false, updatedAt: 1000 }
        ]
      };
      const remote = {
        incomes: [
          { id: 'inc-1', title: 'Dividend', amount: 1000, deleted: true, updatedAt: 2000 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.incomes[0].deleted, true);
    });

    it('preserves newer local income record against older remote', () => {
      const local = {
        incomes: [
          { id: 'inc-1', title: 'Consulting', amount: 20000, updatedAt: 3000 }
        ]
      };
      const remote = {
        incomes: [
          { id: 'inc-1', title: 'Consulting Initial', amount: 10000, updatedAt: 1500 }
        ]
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, false);
      assert.equal(local.incomes[0].amount, 20000);
    });
  });

  describe('Settings LWW Merge', () => {
    it('updates all settings fields when remote.settingsUpdatedAt > local.settingsUpdatedAt', () => {
      const local = {
        salary: 50000,
        baseSalary: 50000,
        budgets: { needs: 25000, wants: 15000, savings: 10000 },
        ratios: { needs: 50, wants: 30, savings: 20 },
        subs: { needs: ['Rent'], wants: ['Dining'], savings: ['Mutual Funds'] },
        subBudgets: { 'needs:Rent': 15000 },
        settingsUpdatedAt: 1000
      };

      const remote = {
        salary: 80000,
        baseSalary: 80000,
        budgets: { needs: 40000, wants: 24000, savings: 16000 },
        ratios: { needs: 50, wants: 30, savings: 20 },
        subs: { needs: ['Rent', 'Groceries'], wants: ['Dining', 'Movies'], savings: ['SIP'] },
        subBudgets: { 'needs:Rent': 20000, 'needs:Groceries': 10000 },
        settingsUpdatedAt: 2000
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.salary, 80000);
      assert.equal(local.baseSalary, 80000);
      assert.deepEqual(local.budgets, remote.budgets);
      assert.deepEqual(local.subs, remote.subs);
      assert.deepEqual(local.subBudgets, remote.subBudgets);
      assert.equal(local.settingsUpdatedAt, 2000);
    });

    it('leaves local settings completely untouched when remote is older or equal', () => {
      const originalSettings = {
        salary: 60000,
        baseSalary: 60000,
        budgets: { needs: 30000, wants: 18000, savings: 12000 },
        ratios: { needs: 50, wants: 30, savings: 20 },
        subs: { needs: ['Rent'] },
        subBudgets: { 'needs:Rent': 15000 },
        settingsUpdatedAt: 5000,
        expenses: [],
        loans: [],
        incomes: []
      };

      const local = JSON.parse(JSON.stringify(originalSettings));
      const olderRemote = {
        salary: 40000,
        baseSalary: 40000,
        settingsUpdatedAt: 3000
      };

      let changed = reconcileStates(local, olderRemote);
      assert.equal(changed, false);
      assert.deepEqual(local, originalSettings);

      const equalRemote = {
        salary: 45000,
        settingsUpdatedAt: 5000
      };
      changed = reconcileStates(local, equalRemote);
      assert.equal(changed, false);
      assert.deepEqual(local, originalSettings);
    });

    it('handles partial remote settings updates safely', () => {
      const local = {
        salary: 50000,
        baseSalary: 50000,
        budgets: { needs: 25000, wants: 15000, savings: 10000 },
        settingsUpdatedAt: 1000
      };

      const remote = {
        salary: 75000,
        // other fields undefined
        settingsUpdatedAt: 2000
      };

      const changed = reconcileStates(local, remote);
      assert.equal(changed, true);
      assert.equal(local.salary, 75000);
      assert.equal(local.baseSalary, 50000); // untouched
      assert.deepEqual(local.budgets, { needs: 25000, wants: 15000, savings: 10000 }); // untouched
      assert.equal(local.settingsUpdatedAt, 2000);
    });
  });

  describe('Return Value & Idempotency', () => {
    it('returns false when reconciling identical state objects', () => {
      const local = {
        expenses: [{ id: 'e1', amount: 100, updatedAt: 1000 }],
        loans: [{ id: 'l1', amount: 5000, updatedAt: 1000 }],
        incomes: [{ id: 'i1', amount: 2000, updatedAt: 1000 }],
        settingsUpdatedAt: 1000
      };
      const remote = JSON.parse(JSON.stringify(local));

      const changed = reconcileStates(local, remote);
      assert.equal(changed, false);
    });

    it('is strictly idempotent on repeated reconciliations', () => {
      const local = {
        expenses: [{ id: 'e1', amount: 100, updatedAt: 1000 }],
        loans: [],
        incomes: [],
        settingsUpdatedAt: 1000
      };
      const remote = {
        expenses: [{ id: 'e1', amount: 200, updatedAt: 2000 }],
        loans: [{ id: 'l1', remainingAmount: 5000, updatedAt: 1500 }],
        incomes: [{ id: 'i1', amount: 3000, updatedAt: 1500 }],
        salary: 70000,
        settingsUpdatedAt: 2000
      };

      // First run: applies changes, returns true
      const firstRun = reconcileStates(local, remote);
      assert.equal(firstRun, true);

      // Snapshot state after first reconciliation
      const stateAfterFirstRun = JSON.parse(JSON.stringify(local));

      // Second run with the same remote: should return false and make zero mutations
      const secondRun = reconcileStates(local, remote);
      assert.equal(secondRun, false);
      assert.deepEqual(local, stateAfterFirstRun);
    });
  });

  describe('Malformed Payloads & Edge Cases', () => {
    it('returns false without throwing when remote is null or undefined', () => {
      const local = { expenses: [], loans: [], incomes: [] };
      assert.equal(reconcileStates(local, null), false);
      assert.equal(reconcileStates(local, undefined), false);
    });

    it('returns false without throwing when remote is a primitive value', () => {
      const local = { expenses: [], loans: [], incomes: [] };
      assert.equal(reconcileStates(local, 'not an object'), false);
      assert.equal(reconcileStates(local, 12345), false);
      assert.equal(reconcileStates(local, true), false);
    });

    it('handles undefined collections in local and remote without crashing', () => {
      const local = {};
      const remote = {};

      assert.doesNotThrow(() => {
        const changed = reconcileStates(local, remote);
        assert.equal(changed, false);
      });

      assert.deepEqual(local.expenses, []);
      assert.deepEqual(local.loans, []);
      assert.deepEqual(local.incomes, []);
    });

    it('ignores null, undefined, or missing ID entries inside remote collections', () => {
      const local = {
        expenses: [{ id: 'e1', title: 'Groceries', updatedAt: 1000 }],
        loans: [{ id: 'l1', title: 'Auto', updatedAt: 1000 }],
        incomes: [{ id: 'i1', title: 'Salary', updatedAt: 1000 }]
      };
      const remote = {
        expenses: [null, undefined, {}, { title: 'No ID' }],
        loans: [null, undefined, { remainingAmount: 100 }],
        incomes: [null, { amount: 500 }]
      };

      let changed = false;
      assert.doesNotThrow(() => {
        changed = reconcileStates(local, remote);
      });
      assert.equal(changed, false);
      assert.equal(local.expenses.length, 1);
      assert.equal(local.loans.length, 1);
      assert.equal(local.incomes.length, 1);
    });
  });

  describe('Full Peer Sync Integration with createSyncPayload', () => {
    it('reconciles state exported via createSyncPayload between two instances', () => {
      const peerA = createTestContext();
      const peerB = createTestContext();

      // Configure peer A
      peerA.state.salary = 90000;
      peerA.state.baseSalary = 90000;
      peerA.state.settingsUpdatedAt = 5000;
      peerA.state.expenses = [
        { id: 'exp-a1', title: 'Electric Bill', amount: 2500, cat: 'needs', updatedAt: 5000 }
      ];
      peerA.state.loans = [
        { id: 'loan-a1', title: 'Car Loan', totalAmount: 500000, remainingAmount: 400000, updatedAt: 5000 }
      ];
      peerA.state.incomes = [
        { id: 'inc-a1', title: 'Consulting', amount: 25000, updatedAt: 5000 }
      ];

      // Configure peer B with earlier state
      peerB.state.salary = 50000;
      peerB.state.settingsUpdatedAt = 1000;
      peerB.state.expenses = [
        { id: 'exp-b1', title: 'Coffee', amount: 200, cat: 'wants', updatedAt: 1000 }
      ];

      // Peer B creates payload and sends to Peer A
      const payloadB = peerB.createSyncPayload();
      const changedA = peerA.reconcileStates(peerA.state, payloadB);

      // Peer A should gain exp-b1, but keep its newer settings and data
      assert.equal(changedA, true);
      assert.equal(peerA.state.salary, 90000);
      assert.equal(peerA.state.expenses.length, 2);
      assert.ok(peerA.state.expenses.find(e => e.id === 'exp-b1'));

      // Peer A sends payload back to Peer B
      const payloadA = peerA.createSyncPayload();
      const changedB = peerB.reconcileStates(peerB.state, payloadA);

      // Peer B should now have all of Peer A's newer settings and entities
      assert.equal(changedB, true);
      assert.equal(peerB.state.salary, 90000);
      assert.equal(peerB.state.settingsUpdatedAt, 5000);
      assert.equal(peerB.state.expenses.length, 2);
      assert.equal(peerB.state.loans.length, 1);
      assert.equal(peerB.state.incomes.length, 1);
      assert.equal(peerB.state.loans[0].id, 'loan-a1');
      assert.equal(peerB.state.incomes[0].id, 'inc-a1');

      // Subsequent sync between reconciled peers causes zero changes
      assert.equal(peerA.reconcileStates(peerA.state, peerB.createSyncPayload()), false);
      assert.equal(peerB.reconcileStates(peerB.state, peerA.createSyncPayload()), false);
    });
  });
});
