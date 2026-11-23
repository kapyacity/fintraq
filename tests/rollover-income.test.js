import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-env.js';

describe('FinTraQ Multi-Stream Inflows & Monthly Rollover Engine', () => {
  describe('Multi-Stream Income Calculation (getMonthlyIncome)', () => {
    it('returns base salary alone when no extra inflows exist', () => {
      const ctx = createTestContext();
      ctx.state.baseSalary = 80000;
      ctx.state.incomes = [];

      const income = ctx.getMonthlyIncome();
      assert.deepEqual({ ...income }, { base: 80000, extra: 0, total: 80000 });
    });

    it('falls back to 0 if baseSalary and salary are unassigned', () => {
      const ctx = createTestContext();
      ctx.state.baseSalary = 0;
      ctx.state.salary = 0;
      ctx.state.incomes = [];

      const income = ctx.getMonthlyIncome();
      assert.deepEqual({ ...income }, { base: 0, extra: 0, total: 0 });
    });

    it('aggregates multiple active inflows within the specified time range', () => {
      const ctx = createTestContext();
      ctx.state.baseSalary = 80000;

      const nov1 = new Date(2026, 10, 1, 0, 0, 0).getTime();
      const nov15 = new Date(2026, 10, 15, 12, 0, 0).getTime();
      const nov20 = new Date(2026, 10, 20, 15, 0, 0).getTime();
      const dec1 = new Date(2026, 11, 1, 0, 0, 0).getTime();

      ctx.state.incomes = [
        {
          id: 'inc_1',
          source: 'Freelance',
          amount: 25000,
          note: 'Web Design Project',
          ts: nov15,
          updatedAt: nov15,
          deleted: false
        },
        {
          id: 'inc_2',
          source: 'Dividends',
          amount: 5000,
          note: 'Quarterly Stock Dividend',
          ts: nov20,
          updatedAt: nov20,
          deleted: false
        }
      ];

      const income = ctx.getMonthlyIncome(nov1, dec1);
      assert.deepEqual({ ...income }, { base: 80000, extra: 30000, total: 110000 });
    });

    it('excludes inflows outside the requested timestamp range [from, to)', () => {
      const ctx = createTestContext();
      ctx.state.baseSalary = 75000;

      const oct15 = new Date(2026, 9, 15).getTime();
      const nov1 = new Date(2026, 10, 1).getTime();
      const nov10 = new Date(2026, 10, 10).getTime();
      const dec1 = new Date(2026, 11, 1).getTime();
      const dec5 = new Date(2026, 11, 5).getTime();

      ctx.state.incomes = [
        { id: 'inc_past', source: 'Consulting', amount: 15000, ts: oct15, deleted: false },
        { id: 'inc_curr', source: 'Bonus', amount: 20000, ts: nov10, deleted: false },
        { id: 'inc_future', source: 'Stipend', amount: 10000, ts: dec5, deleted: false }
      ];

      // Nov window: only inc_curr should be included
      const novIncome = ctx.getMonthlyIncome(nov1, dec1);
      assert.deepEqual({ ...novIncome }, { base: 75000, extra: 20000, total: 95000 });

      // Unconstrained window includes all active inflows
      const allIncome = ctx.getMonthlyIncome();
      assert.deepEqual({ ...allIncome }, { base: 75000, extra: 45000, total: 120000 });
    });

    it('excludes soft-deleted inflow records from aggregation', () => {
      const ctx = createTestContext();
      ctx.state.baseSalary = 50000;
      const ts = Date.now();

      ctx.state.incomes = [
        { id: 'inc_active', source: 'Freelance', amount: 12000, ts, deleted: false },
        { id: 'inc_deleted', source: 'Refund', amount: 8000, ts, deleted: true }
      ];

      const income = ctx.getMonthlyIncome();
      assert.deepEqual({ ...income }, { base: 50000, extra: 12000, total: 62000 });
    });

    it('supports logging and soft-deleting inflows via saveIncome and delIncome', () => {
      const ctx = createTestContext();
      ctx.state.baseSalary = 60000;

      ctx.setElement('incAmount', { value: '15000' });
      ctx.setElement('incSource', { value: 'Consulting' });
      ctx.setElement('incNote', { value: 'Tech advisory' });

      ctx.saveIncome();

      assert.equal(ctx.state.incomes.length, 1);
      const item = ctx.state.incomes[0];
      assert.equal(item.amount, 15000);
      assert.equal(item.source, 'Consulting');
      assert.equal(item.note, 'Tech advisory');
      assert.equal(item.deleted, false);
      assert.equal(ctx.syncBroadcasts, 1);

      // Verify income calculation reflects new entry
      const income = ctx.getMonthlyIncome();
      assert.equal(income.total, 75000);

      // Soft delete
      ctx.delIncome(item.id);
      assert.equal(item.deleted, true);
      const afterDel = ctx.getMonthlyIncome();
      assert.equal(afterDel.total, 60000);
    });
  });

  describe('Date & Month Boundary Helpers', () => {
    it('monthKey(d) formats dates as YYYY-MM correctly with zero-padded months', () => {
      const ctx = createTestContext();
      assert.equal(ctx.monthKey(new Date(2026, 0, 15)), '2026-01');
      assert.equal(ctx.monthKey(new Date(2026, 8, 30)), '2026-09');
      assert.equal(ctx.monthKey(new Date(2026, 9, 1)), '2026-10');
      assert.equal(ctx.monthKey(new Date(2026, 10, 23)), '2026-11');
      assert.equal(ctx.monthKey(new Date(2026, 11, 31)), '2026-12');
    });

    it('startOfMonth(d) returns midnight timestamp on the 1st day of the given month', () => {
      const ctx = createTestContext();
      const testDate = new Date(2026, 10, 23, 14, 30, 45); // Nov 23, 2026
      const startTs = ctx.startOfMonth(testDate);
      const start = new Date(startTs);

      assert.equal(start.getFullYear(), 2026);
      assert.equal(start.getMonth(), 10); // November (0-indexed)
      assert.equal(start.getDate(), 1);
      assert.equal(start.getHours(), 0);
      assert.equal(start.getMinutes(), 0);
      assert.equal(start.getSeconds(), 0);
    });

    it('endOfMonth(d) returns midnight timestamp on the 1st day of the subsequent month', () => {
      const ctx = createTestContext();
      const testDate = new Date(2026, 10, 23, 14, 30, 45); // Nov 23, 2026
      const endTs = ctx.endOfMonth(testDate);
      const end = new Date(endTs);

      assert.equal(end.getFullYear(), 2026);
      assert.equal(end.getMonth(), 11); // December (0-indexed)
      assert.equal(end.getDate(), 1);
      assert.equal(end.getHours(), 0);
      assert.equal(end.getMinutes(), 0);
      assert.equal(end.getSeconds(), 0);

      // Verify year rollover at December
      const decDate = new Date(2026, 11, 15);
      const yearEndTs = ctx.endOfMonth(decDate);
      const yearEnd = new Date(yearEndTs);
      assert.equal(yearEnd.getFullYear(), 2027);
      assert.equal(yearEnd.getMonth(), 0);
      assert.equal(yearEnd.getDate(), 1);
    });

    it('startOfWeekMon(d) returns midnight timestamp of Monday for any day of the week', () => {
      const ctx = createTestContext();
      // Test reference week: Monday Nov 16 to Sunday Nov 22, 2026
      const expectedMon = new Date(2026, 10, 16, 0, 0, 0, 0).getTime();

      // Monday itself
      assert.equal(ctx.startOfWeekMon(new Date(2026, 10, 16)), expectedMon);
      // Wednesday
      assert.equal(ctx.startOfWeekMon(new Date(2026, 10, 18, 15, 20)), expectedMon);
      // Friday
      assert.equal(ctx.startOfWeekMon(new Date(2026, 10, 20, 23, 59)), expectedMon);
      // Sunday
      assert.equal(ctx.startOfWeekMon(new Date(2026, 10, 22, 10, 0)), expectedMon);

      // Subsequent Monday shifts 7 days
      const nextMon = new Date(2026, 10, 23, 0, 0, 0, 0).getTime();
      assert.equal(ctx.startOfWeekMon(new Date(2026, 10, 23)), nextMon);
    });

    it('fmt(n) outputs Indian Rupee currency with ₹ prefix and comma thousands separators', () => {
      const ctx = createTestContext();
      assert.equal(ctx.fmt(0), '₹0');
      assert.equal(ctx.fmt(500), '₹500');
      assert.equal(ctx.fmt(1000), '₹1,000');
      assert.equal(ctx.fmt(25000), '₹25,000');
      assert.equal(ctx.fmt(100000), '₹100,000');
      assert.equal(ctx.fmt(1234567), '₹1,234,567');
      // Negative numbers formatted with minus sign prefix
      assert.equal(ctx.fmt(-5000), '-₹5,000');
      // Rounds decimals to nearest integer
      assert.equal(ctx.fmt(1234.56), '₹1,235');
      assert.equal(ctx.fmt(1234.2), '₹1,234');
    });
  });

  describe('Monthly Reset & Unspent Leftover Rollover (checkMonthReset)', () => {
    it('performs no reset when current monthKey matches state.lastMonthKey', () => {
      const ctx = createTestContext();
      const currentMonth = ctx.monthKey(new Date());
      ctx.state.lastMonthKey = currentMonth;
      ctx.state.lastMonthLeftover = { month: 'earlier', left: { needs: 100 } };
      ctx.resetSpies();

      ctx.checkMonthReset();

      // State remains unchanged
      assert.equal(ctx.state.lastMonthKey, currentMonth);
      assert.deepEqual(ctx.state.lastMonthLeftover, { month: 'earlier', left: { needs: 100 } });
      // No save or render
      assert.equal(ctx.syncBroadcasts, 0);
    });

    it('computes leftover per category for previous month on rollover and updates lastMonthKey', () => {
      const ctx = createTestContext();
      const currentMonth = ctx.monthKey(new Date());

      // Simulate state where last month recorded was 2026-10 (October 2026)
      ctx.state.lastMonthKey = '2026-10';
      ctx.state.budgets = { needs: 40000, wants: 20000, savings: 15000 };

      // In October: spent 25,000 on needs, 12,000 on wants, 5,000 on savings
      const oct10 = new Date(2026, 9, 10).getTime();
      const oct25 = new Date(2026, 9, 25).getTime();
      // Current month expense (should NOT affect October calculations)
      const nowTs = Date.now();

      ctx.state.expenses = [
        { id: 'e1', cat: 'needs', amount: 15000, ts: oct10, deleted: false },
        { id: 'e2', cat: 'needs', amount: 10000, ts: oct25, deleted: false },
        { id: 'e3', cat: 'wants', amount: 12000, ts: oct10, deleted: false },
        { id: 'e4', cat: 'savings', amount: 5000, ts: oct25, deleted: false },
        // Soft-deleted expense in October (should be excluded)
        { id: 'e5', cat: 'wants', amount: 5000, ts: oct10, deleted: true },
        // Current month expense
        { id: 'e6', cat: 'needs', amount: 8000, ts: nowTs, deleted: false }
      ];

      ctx.checkMonthReset();

      // Verified transition to current month
      assert.equal(ctx.state.lastMonthKey, currentMonth);

      // Verified leftover calculation:
      // needs: 40,000 - 25,000 = 15,000
      // wants: 20,000 - 12,000 = 8,000
      // savings: 15,000 - 5,000 = 10,000
      assert.ok(ctx.state.lastMonthLeftover);
      assert.equal(ctx.state.lastMonthLeftover.month, '2026-10');
      assert.deepEqual(JSON.parse(JSON.stringify(ctx.state.lastMonthLeftover.left)), {
        needs: 15000,
        wants: 8000,
        savings: 10000
      });

      // Confirms updated state was persisted to storage
      const stored = JSON.parse(ctx.localStorage.getItem(ctx.KEY));
      assert.equal(stored.lastMonthKey, currentMonth);
      assert.deepEqual(stored.lastMonthLeftover.left, {
        needs: 15000,
        wants: 8000,
        savings: 10000
      });
    });

    it('can produce negative leftover when a category was overspent in the prior month', () => {
      const ctx = createTestContext();
      ctx.state.lastMonthKey = '2026-10';
      ctx.state.budgets = { needs: 20000, wants: 10000, savings: 5000 };

      const oct15 = new Date(2026, 9, 15).getTime();
      ctx.state.expenses = [
        { id: 'e_over', cat: 'needs', amount: 28000, ts: oct15, deleted: false }
      ];

      ctx.checkMonthReset();

      // needs leftover: 20,000 - 28,000 = -8,000
      assert.equal(ctx.state.lastMonthLeftover.left.needs, -8000);
      assert.equal(ctx.state.lastMonthLeftover.left.wants, 10000);
      assert.equal(ctx.state.lastMonthLeftover.left.savings, 5000);
    });

    it('NEVER purges or deletes past expenses during month reset (zero data loss)', () => {
      const ctx = createTestContext();
      ctx.state.lastMonthKey = '2026-09';
      ctx.state.budgets = { needs: 30000, wants: 15000, savings: 10000 };

      const sepTs = new Date(2026, 8, 15).getTime();
      const octTs = new Date(2026, 9, 15).getTime();
      const nowTs = Date.now();

      const initialExpenses = [
        { id: 'sep1', cat: 'needs', amount: 12000, ts: sepTs, deleted: false },
        { id: 'sep2', cat: 'wants', amount: 4500, ts: sepTs, deleted: false },
        { id: 'oct1', cat: 'needs', amount: 18000, ts: octTs, deleted: false },
        { id: 'now1', cat: 'savings', amount: 5000, ts: nowTs, deleted: false }
      ];
      ctx.state.expenses = [...initialExpenses];

      ctx.checkMonthReset();

      // Verify all 4 expenses are still present and intact
      assert.equal(ctx.state.expenses.length, 4);
      assert.deepEqual(
        ctx.state.expenses.map(e => e.id),
        ['sep1', 'sep2', 'oct1', 'now1']
      );

      // Verify stored expenses in localStorage also retain all records
      const stored = JSON.parse(ctx.localStorage.getItem(ctx.KEY));
      assert.equal(stored.expenses.length, 4);
      assert.equal(stored.expenses[0].id, 'sep1');
      assert.equal(stored.expenses[1].id, 'sep2');
      assert.equal(stored.expenses[2].id, 'oct1');
      assert.equal(stored.expenses[3].id, 'now1');
    });
  });
});
