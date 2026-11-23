import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-env.js';

describe('FinTraQ Loans & EMI Tracker', () => {
  describe('Loan Creation, Updating, and Deletion', () => {
    it('creates a new loan with full balance when remainingAmount is not provided', () => {
      const ctx = createTestContext();
      ctx.setElement('loanEditId', { value: '' });
      ctx.setElement('loanName', { value: 'Home Loan' });
      ctx.setElement('loanTotal', { value: '500000' });
      ctx.setElement('loanRemaining', { value: '' });
      ctx.setElement('loanEmi', { value: '15000' });
      ctx.setElement('loanDueDay', { value: '10' });

      ctx.saveLoan();

      assert.equal(ctx.state.loans.length, 1);
      const loan = ctx.state.loans[0];
      assert.equal(loan.name, 'Home Loan');
      assert.equal(loan.totalAmount, 500000);
      assert.equal(loan.remainingAmount, 500000);
      assert.equal(loan.emiAmount, 15000);
      assert.equal(loan.dueDay, 10);
      assert.deepEqual(JSON.parse(JSON.stringify(loan.paidMonths)), []);
      assert.equal(loan.deleted, false);
      assert.ok(typeof loan.id === 'string' && loan.id.startsWith('loan_'));
      assert.ok(typeof loan.updatedAt === 'number');

      // State persistence and sync broadcast
      assert.equal(ctx.syncBroadcasts, 1);
      const stored = JSON.parse(ctx.localStorage.getItem(ctx.KEY));
      assert.equal(stored.loans.length, 1);
      assert.equal(stored.loans[0].name, 'Home Loan');
    });

    it('creates a loan with custom remaining balance when partially repaid already', () => {
      const ctx = createTestContext();
      ctx.setElement('loanEditId', { value: '' });
      ctx.setElement('loanName', { value: 'Car Loan' });
      ctx.setElement('loanTotal', { value: '400000' });
      ctx.setElement('loanRemaining', { value: '250000' });
      ctx.setElement('loanEmi', { value: '12000' });
      ctx.setElement('loanDueDay', { value: '5' });

      ctx.saveLoan();

      assert.equal(ctx.state.loans.length, 1);
      const loan = ctx.state.loans[0];
      assert.equal(loan.totalAmount, 400000);
      assert.equal(loan.remainingAmount, 250000);
      assert.equal(loan.emiAmount, 12000);
    });

    it('clamps dueDay between 1 and 31', () => {
      const ctx = createTestContext();
      // Test > 31 clamped to 31
      ctx.setElement('loanEditId', { value: '' });
      ctx.setElement('loanName', { value: 'Personal Loan' });
      ctx.setElement('loanTotal', { value: '100000' });
      ctx.setElement('loanRemaining', { value: '100000' });
      ctx.setElement('loanEmi', { value: '5000' });
      ctx.setElement('loanDueDay', { value: '35' });
      ctx.saveLoan();
      assert.equal(ctx.state.loans[0].dueDay, 31);

      // Test < 1 clamped to 1
      ctx.setElement('loanEditId', { value: '' });
      ctx.setElement('loanName', { value: 'Bike Loan' });
      ctx.setElement('loanTotal', { value: '50000' });
      ctx.setElement('loanRemaining', { value: '50000' });
      ctx.setElement('loanEmi', { value: '2000' });
      ctx.setElement('loanDueDay', { value: '-5' });
      ctx.saveLoan();
      assert.equal(ctx.state.loans[1].dueDay, 1);
    });

    it('updates an existing loan without altering its paidMonths history', () => {
      const ctx = createTestContext();
      const existingLoan = {
        id: 'loan_12345',
        name: 'Education Loan',
        totalAmount: 300000,
        remainingAmount: 200000,
        emiAmount: 10000,
        dueDay: 7,
        paidMonths: ['2026-09', '2026-10'],
        updatedAt: 1000,
        deleted: false
      };
      ctx.state.loans.push(existingLoan);

      ctx.setElement('loanEditId', { value: 'loan_12345' });
      ctx.setElement('loanName', { value: 'Education Loan (Refinanced)' });
      ctx.setElement('loanTotal', { value: '300000' });
      ctx.setElement('loanRemaining', { value: '190000' });
      ctx.setElement('loanEmi', { value: '8500' });
      ctx.setElement('loanDueDay', { value: '15' });

      ctx.saveLoan();

      assert.equal(ctx.state.loans.length, 1);
      const updated = ctx.state.loans[0];
      assert.equal(updated.name, 'Education Loan (Refinanced)');
      assert.equal(updated.remainingAmount, 190000);
      assert.equal(updated.emiAmount, 8500);
      assert.equal(updated.dueDay, 15);
      assert.deepEqual(updated.paidMonths, ['2026-09', '2026-10']);
      assert.ok(updated.updatedAt > 1000);
    });

    it('rejects loan creation with empty title or invalid total/emi amounts', () => {
      const ctx = createTestContext();

      // Empty name
      ctx.setElement('loanEditId', { value: '' });
      ctx.setElement('loanName', { value: '   ' });
      ctx.setElement('loanTotal', { value: '100000' });
      ctx.setElement('loanEmi', { value: '5000' });
      ctx.saveLoan();
      assert.equal(ctx.state.loans.length, 0);
      assert.ok(ctx.toasts.includes('Enter a loan title'));

      // Total <= 0
      ctx.setElement('loanName', { value: 'Test Loan' });
      ctx.setElement('loanTotal', { value: '0' });
      ctx.saveLoan();
      assert.equal(ctx.state.loans.length, 0);
      assert.ok(ctx.toasts.includes('Enter total loan amount'));

      // EMI <= 0
      ctx.setElement('loanTotal', { value: '100000' });
      ctx.setElement('loanEmi', { value: '0' });
      ctx.saveLoan();
      assert.equal(ctx.state.loans.length, 0);
      assert.ok(ctx.toasts.includes('Enter monthly EMI amount'));
    });

    it('soft deletes loan by marking deleted: true and updating timestamps', () => {
      const ctx = createTestContext();
      const loan = {
        id: 'loan_del_1',
        name: 'Personal Loan',
        totalAmount: 100000,
        remainingAmount: 50000,
        emiAmount: 5000,
        dueDay: 5,
        paidMonths: [],
        updatedAt: 1000,
        deleted: false
      };
      ctx.state.loans.push(loan);
      ctx.resetSpies();

      ctx.delLoan('loan_del_1');

      assert.equal(loan.deleted, true);
      assert.ok(loan.updatedAt > 1000);
      assert.equal(ctx.syncBroadcasts, 1);
      assert.ok(ctx.toasts.includes('Loan deleted'));

      const stored = JSON.parse(ctx.localStorage.getItem(ctx.KEY));
      assert.equal(stored.loans[0].deleted, true);
    });
  });

  describe('Single EMI Payment Execution', () => {
    it('reduces remainingAmount by emiAmount and records month key', () => {
      const ctx = createTestContext();
      const currentMonth = ctx.monthKey(new Date());
      const loan = {
        id: 'loan_emi_1',
        name: 'Home Loan',
        totalAmount: 500000,
        remainingAmount: 500000,
        emiAmount: 15000,
        dueDay: 10,
        paidMonths: [],
        updatedAt: 1000,
        deleted: false
      };
      ctx.state.loans.push(loan);
      ctx.resetSpies();

      ctx.payLoanEMI('loan_emi_1');

      // Loan state assertions
      assert.equal(loan.remainingAmount, 485000);
      assert.deepEqual(loan.paidMonths, [currentMonth]);
      assert.ok(loan.updatedAt > 1000);

      // Persistence and sync assertions
      assert.equal(ctx.syncBroadcasts, 1);
      assert.equal(ctx.renders, 1);
      const stored = JSON.parse(ctx.localStorage.getItem(ctx.KEY));
      assert.equal(stored.loans[0].remainingAmount, 485000);
      assert.deepEqual(stored.loans[0].paidMonths, [currentMonth]);
    });

    it('automatically logs an expense entry under Needs category', () => {
      const ctx = createTestContext();
      const loan = {
        id: 'loan_emi_exp',
        name: 'Car Loan',
        totalAmount: 600000,
        remainingAmount: 600000,
        emiAmount: 18000,
        dueDay: 5,
        paidMonths: [],
        updatedAt: 1000,
        deleted: false
      };
      ctx.state.loans.push(loan);
      assert.equal(ctx.state.expenses.length, 0);

      ctx.payLoanEMI('loan_emi_exp');

      // Auto-logged expense assertions
      assert.equal(ctx.state.expenses.length, 1);
      const exp = ctx.state.expenses[0];
      assert.equal(exp.cat, 'needs');
      assert.equal(exp.sub, 'Loan / EMI');
      assert.equal(exp.amount, 18000);
      assert.equal(exp.note, 'Car Loan EMI');
      assert.equal(exp.deleted, false);
      assert.ok(typeof exp.id === 'string' && exp.id.startsWith('e'));
      assert.ok(typeof exp.ts === 'number');
      assert.ok(typeof exp.updatedAt === 'number');

      // Confirms spentByCat().needs reflects the payment immediately
      const spent = ctx.spentByCat();
      assert.equal(spent.needs, 18000);
      assert.equal(spent.wants, 0);
      assert.equal(spent.savings, 0);
      assert.equal(ctx.totalSpent(), 18000);

      // Verifies toast confirmation message
      assert.ok(
        ctx.toasts.some(t => t.includes('Paid ₹18,000 EMI for Car Loan · logged to Needs'))
      );
    });
  });

  describe('Duplicate Payment Prevention', () => {
    it('rejects duplicate EMI payment within the same month', () => {
      const ctx = createTestContext();
      const currentMonth = ctx.monthKey(new Date());
      const loan = {
        id: 'loan_dup_1',
        name: 'Personal Loan',
        totalAmount: 200000,
        remainingAmount: 180000,
        emiAmount: 10000,
        dueDay: 15,
        paidMonths: [currentMonth], // already marked paid this month
        updatedAt: 1000,
        deleted: false
      };
      ctx.state.loans.push(loan);
      ctx.resetSpies();

      ctx.payLoanEMI('loan_dup_1');

      // State remains unchanged
      assert.equal(loan.remainingAmount, 180000);
      assert.deepEqual(loan.paidMonths, [currentMonth]);
      assert.equal(loan.updatedAt, 1000);
      assert.equal(ctx.state.expenses.length, 0);

      // Warning toast shown and no sync broadcast triggered
      assert.ok(ctx.toasts.includes('EMI already paid this month'));
      assert.equal(ctx.syncBroadcasts, 0);
    });

    it('allows EMI payment in a new month even if prior month was paid', () => {
      const ctx = createTestContext();
      const currentMonth = ctx.monthKey(new Date());
      const loan = {
        id: 'loan_next_month',
        name: 'Bike Loan',
        totalAmount: 100000,
        remainingAmount: 90000,
        emiAmount: 5000,
        dueDay: 5,
        paidMonths: ['2026-08', '2026-09'],
        updatedAt: 1000,
        deleted: false
      };
      ctx.state.loans.push(loan);

      ctx.payLoanEMI('loan_next_month');

      assert.equal(loan.remainingAmount, 85000);
      assert.deepEqual(loan.paidMonths, ['2026-08', '2026-09', currentMonth]);
      assert.equal(ctx.state.expenses.length, 1);
      assert.equal(ctx.state.expenses[0].amount, 5000);
    });
  });

  describe('Loan Payoff and Balance Clamping', () => {
    it('clamps remainingAmount to 0 when remaining balance is less than EMI amount', () => {
      const ctx = createTestContext();
      const loan = {
        id: 'loan_clamp_1',
        name: 'Final Month Loan',
        totalAmount: 100000,
        remainingAmount: 8000,
        emiAmount: 15000,
        dueDay: 10,
        paidMonths: [],
        updatedAt: 1000,
        deleted: false
      };
      ctx.state.loans.push(loan);

      ctx.payLoanEMI('loan_clamp_1');

      // Remaining amount clamped at 0 (not -7000)
      assert.equal(loan.remainingAmount, 0);
      // Auto-logged expense records the contractual EMI amount
      assert.equal(ctx.state.expenses.length, 1);
      assert.equal(ctx.state.expenses[0].amount, 15000);
    });

    it('does nothing when called with an invalid loanId', () => {
      const ctx = createTestContext();
      ctx.resetSpies();

      ctx.payLoanEMI('non_existent_id');

      assert.equal(ctx.state.expenses.length, 0);
      assert.equal(ctx.syncBroadcasts, 0);
      assert.equal(ctx.renders, 0);
    });
  });
});
