import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers/test-env.js';

describe('FinTraQ 50/30/20 Budgeting Engine', () => {
  describe('Standard 50/30/20 Allocation', () => {
    it('allocates ₹50,000 salary correctly (25k Needs, 15k Wants, 10k Savings)', () => {
      const ctx = createTestContext();
      ctx.state.salary = 50000;
      ctx.state.ratios = { ...ctx.DEFAULT_RATIO };
      ctx.applyRatioToBudgets();

      assert.equal(ctx.state.budgets.needs, 25000);
      assert.equal(ctx.state.budgets.wants, 15000);
      assert.equal(ctx.state.budgets.savings, 10000);
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        50000
      );
    });

    it('allocates ₹100,000 salary correctly (50k Needs, 30k Wants, 20k Savings)', () => {
      const ctx = createTestContext();
      ctx.state.salary = 100000;
      ctx.state.ratios = { ...ctx.DEFAULT_RATIO };
      ctx.applyRatioToBudgets();

      assert.equal(ctx.state.budgets.needs, 50000);
      assert.equal(ctx.state.budgets.wants, 30000);
      assert.equal(ctx.state.budgets.savings, 20000);
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        100000
      );
    });

    it('allocates zero salary with zero across all categories', () => {
      const ctx = createTestContext();
      ctx.state.salary = 0;
      ctx.applyRatioToBudgets();

      assert.equal(ctx.state.budgets.needs, 0);
      assert.equal(ctx.state.budgets.wants, 0);
      assert.equal(ctx.state.budgets.savings, 0);
    });
  });

  describe('Preset Budget Ratios', () => {
    it('verifies PRESETS constant includes all expected presets', () => {
      const ctx = createTestContext();
      assert.equal(ctx.PRESETS.length, 4);
      assert.equal(ctx.PRESETS[0].label, '50 / 30 / 20');
      assert.equal(ctx.PRESETS[1].label, '60 / 20 / 20');
      assert.equal(ctx.PRESETS[2].label, '70 / 20 / 10');
      assert.equal(ctx.PRESETS[3].label, '40 / 30 / 30');
      assert.deepEqual(JSON.parse(JSON.stringify(ctx.PRESETS[0].r)), { needs: 50, wants: 30, savings: 20 });
    });

    it('applies 60/20/20 preset on ₹50,000 (30k Needs, 10k Wants, 10k Savings)', () => {
      const ctx = createTestContext();
      ctx.state.salary = 50000;
      ctx.state.ratios = { needs: 60, wants: 20, savings: 20 };
      ctx.applyRatioToBudgets();

      assert.equal(ctx.state.budgets.needs, 30000);
      assert.equal(ctx.state.budgets.wants, 10000);
      assert.equal(ctx.state.budgets.savings, 10000);
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        50000
      );
    });

    it('applies 70/20/10 preset on ₹100,000 (70k Needs, 20k Wants, 10k Savings)', () => {
      const ctx = createTestContext();
      ctx.state.salary = 100000;
      ctx.state.ratios = { needs: 70, wants: 20, savings: 10 };
      ctx.applyRatioToBudgets();

      assert.equal(ctx.state.budgets.needs, 70000);
      assert.equal(ctx.state.budgets.wants, 20000);
      assert.equal(ctx.state.budgets.savings, 10000);
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        100000
      );
    });

    it('applies 40/30/30 preset on ₹60,000 (24k Needs, 18k Wants, 18k Savings)', () => {
      const ctx = createTestContext();
      ctx.state.salary = 60000;
      ctx.state.ratios = { needs: 40, wants: 30, savings: 30 };
      ctx.applyRatioToBudgets();

      assert.equal(ctx.state.budgets.needs, 24000);
      assert.equal(ctx.state.budgets.wants, 18000);
      assert.equal(ctx.state.budgets.savings, 18000);
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        60000
      );
    });
  });

  describe('Rounding Correction & Remainder Absorption', () => {
    const testSalaries = [1, 7, 1003, 10001, 33333, 99999, 123457, 500001];

    for (const sal of testSalaries) {
      it(`absorbs rounding remainders on ₹${sal.toLocaleString()} so sum equals salary exactly`, () => {
        const ctx = createTestContext();
        ctx.state.salary = sal;
        ctx.state.ratios = { needs: 50, wants: 30, savings: 20 };
        ctx.applyRatioToBudgets();

        const { needs, wants, savings } = ctx.state.budgets;
        const sum = needs + wants + savings;

        // Invariant 1: Total must equal salary exactly
        assert.equal(
          sum,
          sal,
          `Sum ${sum} did not match salary ${sal} for 50/30/20 split`
        );

        // Invariant 2: Needs and Wants are Math.round of their percentages
        assert.equal(needs, Math.round((sal * 50) / 100));
        assert.equal(wants, Math.round((sal * 30) / 100));

        // Invariant 3: Savings absorbs any remainder difference
        assert.equal(savings, sal - (needs + wants));
      });
    }

    it('corrects remainder for odd preset combinations (e.g. 70/20/10 on ₹33,333)', () => {
      const ctx = createTestContext();
      ctx.state.salary = 33333;
      ctx.state.ratios = { needs: 70, wants: 20, savings: 10 };
      ctx.applyRatioToBudgets();

      const { needs, wants, savings } = ctx.state.budgets;
      assert.equal(needs + wants + savings, 33333);
      assert.equal(needs, Math.round((33333 * 70) / 100)); // 23333
      assert.equal(wants, Math.round((33333 * 20) / 100)); // 6667
      assert.equal(savings, 33333 - (needs + wants)); // 3333
    });
  });

  describe('Non-100% Custom Ratios', () => {
    it('calculates uncorrected percentages when ratios total less than 100% (e.g., 50/30/10 = 90%)', () => {
      const ctx = createTestContext();
      ctx.state.salary = 10000;
      ctx.state.ratios = { needs: 50, wants: 30, savings: 10 }; // sum = 90%
      ctx.applyRatioToBudgets();

      assert.equal(ctx.state.budgets.needs, 5000);
      assert.equal(ctx.state.budgets.wants, 3000);
      assert.equal(ctx.state.budgets.savings, 1000);
      // Remainder is NOT absorbed when total != 100%
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        9000
      );
    });

    it('calculates uncorrected percentages when ratios total greater than 100% (e.g., 60/30/20 = 110%)', () => {
      const ctx = createTestContext();
      ctx.state.salary = 10000;
      ctx.state.ratios = { needs: 60, wants: 30, savings: 20 }; // sum = 110%
      ctx.applyRatioToBudgets();

      assert.equal(ctx.state.budgets.needs, 6000);
      assert.equal(ctx.state.budgets.wants, 3000);
      assert.equal(ctx.state.budgets.savings, 2000);
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        11000
      );
    });
  });

  describe('Subcategory Budget Allocation & Aggregation', () => {
    it('sets and retrieves subcategory budget amounts', () => {
      const ctx = createTestContext();
      ctx.setSubBudget('needs', 'Rent', 15000);

      assert.equal(ctx.subBudget('needs', 'Rent'), 15000);
      assert.equal(ctx.state.subBudgets['needs::Rent'], 15000);
    });

    it('returns 0 for unconfigured subcategories', () => {
      const ctx = createTestContext();
      assert.equal(ctx.subBudget('needs', 'NonExistent'), 0);
      assert.equal(ctx.subBudget('wants', 'Gaming'), 0);
    });

    it('deletes subcategory key when setting value <= 0', () => {
      const ctx = createTestContext();
      ctx.setSubBudget('needs', 'Rent', 15000);
      assert.equal(ctx.subBudget('needs', 'Rent'), 15000);

      // Set to 0 deletes key
      ctx.setSubBudget('needs', 'Rent', 0);
      assert.equal(ctx.subBudget('needs', 'Rent'), 0);
      assert.equal('needs::Rent' in ctx.state.subBudgets, false);

      // Set to negative deletes key
      ctx.setSubBudget('wants', 'Shopping', 5000);
      ctx.setSubBudget('wants', 'Shopping', -100);
      assert.equal(ctx.subBudget('wants', 'Shopping'), 0);
      assert.equal('wants::Shopping' in ctx.state.subBudgets, false);
    });

    it('calculates catAllocated as sum of all configured subcategories for that category', () => {
      const ctx = createTestContext();
      ctx.setSubBudget('needs', 'Rent', 20000);
      ctx.setSubBudget('needs', 'Food', 8000);
      ctx.setSubBudget('needs', 'Bills', 4000);
      // Wants subcategory should not affect needs total
      ctx.setSubBudget('wants', 'Dining out', 5000);

      assert.equal(ctx.catAllocated('needs'), 32000);
      assert.equal(ctx.catAllocated('wants'), 5000);
      assert.equal(ctx.catAllocated('savings'), 0);
    });

    it('triggers save(), broadcastSync(), and updates settingsUpdatedAt on setSubBudget', () => {
      const ctx = createTestContext();
      const beforeTime = Date.now() - 10;
      ctx.state.settingsUpdatedAt = beforeTime;
      ctx.resetSpies();

      ctx.setSubBudget('needs', 'Groceries', 6000);

      // Sync broadcast called
      assert.equal(ctx.syncBroadcasts, 1);
      // Updated timestamp bumped
      assert.ok(ctx.state.settingsUpdatedAt >= beforeTime);
      // localStorage contains saved state
      const rawStored = ctx.localStorage.getItem(ctx.KEY);
      assert.ok(rawStored !== null);
      const stored = JSON.parse(rawStored);
      assert.equal(stored.subBudgets['needs::Groceries'], 6000);
    });
  });

  describe('Dynamic Inflow Logging & Auto-Expanding Budget (REQ-12)', () => {
    it('starts with ₹0 total income and ₹0 across Needs, Wants, and Savings budgets on zero base salary', () => {
      const ctx = createTestContext({ baseSalary: 0, salary: 0, incomes: [] });
      ctx.applyRatioToBudgets();

      const mIncome = ctx.getMonthlyIncome();
      assert.equal(mIncome.base, 0);
      assert.equal(mIncome.extra, 0);
      assert.equal(mIncome.total, 0);

      assert.equal(ctx.state.salary, 0);
      assert.equal(ctx.state.budgets.needs, 0);
      assert.equal(ctx.state.budgets.wants, 0);
      assert.equal(ctx.state.budgets.savings, 0);
    });

    it('auto-expands state.salary to ₹30,000 and allocates 50/30/20 budgets on initial inflow', () => {
      const ctx = createTestContext({ baseSalary: 0, salary: 0, incomes: [] });
      ctx.setElement('incAmount', { value: '30000' });
      ctx.setElement('incSource', { value: 'Freelance' });
      ctx.setElement('incNote', { value: 'Client web project' });

      ctx.saveIncome();

      assert.equal(ctx.state.salary, 30000);
      assert.equal(ctx.state.budgets.needs, 15000);
      assert.equal(ctx.state.budgets.wants, 9000);
      assert.equal(ctx.state.budgets.savings, 6000);
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        30000
      );
    });

    it('cumulatively expands state.salary to ₹50,000 and re-splits budgets on second split inflow', () => {
      const ctx = createTestContext({ baseSalary: 0, salary: 0, incomes: [] });

      // First inflow: ₹30,000
      ctx.setElement('incAmount', { value: '30000' });
      ctx.setElement('incSource', { value: 'Client A' });
      ctx.setElement('incNote', { value: 'Sprint 1' });
      ctx.saveIncome();

      assert.equal(ctx.state.salary, 30000);

      // Second inflow: ₹20,000
      ctx.setElement('incAmount', { value: '20000' });
      ctx.setElement('incSource', { value: 'Client B' });
      ctx.setElement('incNote', { value: 'Consulting' });
      ctx.saveIncome();

      assert.equal(ctx.state.salary, 50000);
      assert.equal(ctx.state.budgets.needs, 25000);
      assert.equal(ctx.state.budgets.wants, 15000);
      assert.equal(ctx.state.budgets.savings, 10000);
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        50000
      );
    });

    it('dynamically contracts budget back to remaining total when an inflow is deleted', () => {
      const ctx = createTestContext({ baseSalary: 0, salary: 0, incomes: [] });

      // Add two inflows: ₹30,000 and ₹20,000
      ctx.setElement('incAmount', { value: '30000' });
      ctx.setElement('incSource', { value: 'Design project' });
      ctx.setElement('incNote', { value: '' });
      ctx.saveIncome();

      ctx.setElement('incAmount', { value: '20000' });
      ctx.setElement('incSource', { value: 'Bonus' });
      ctx.setElement('incNote', { value: '' });
      ctx.saveIncome();

      assert.equal(ctx.state.salary, 50000);
      assert.equal(ctx.state.incomes.length, 2);

      const bonusItem = ctx.state.incomes.find(i => i.amount === 20000);
      assert.ok(bonusItem);

      // Delete the ₹20,000 inflow
      ctx.delIncome(bonusItem.id);

      assert.equal(bonusItem.deleted, true);
      assert.equal(ctx.state.salary, 30000);
      assert.equal(ctx.state.budgets.needs, 15000);
      assert.equal(ctx.state.budgets.wants, 9000);
      assert.equal(ctx.state.budgets.savings, 6000);

      // Delete the first inflow as well -> contracts to 0
      const firstItem = ctx.state.incomes.find(i => i.amount === 30000);
      ctx.delIncome(firstItem.id);

      assert.equal(firstItem.deleted, true);
      assert.equal(ctx.state.salary, 0);
      assert.equal(ctx.state.budgets.needs, 0);
      assert.equal(ctx.state.budgets.wants, 0);
      assert.equal(ctx.state.budgets.savings, 0);
    });

    it('dynamically expands custom budget presets (60/20/20 and 70/20/10) with split inflows', () => {
      const ctx = createTestContext({
        baseSalary: 0,
        salary: 0,
        incomes: [],
        ratios: { needs: 60, wants: 20, savings: 20 }
      });

      // Log inflow of ₹40,000 under 60/20/20
      ctx.setElement('incAmount', { value: '40000' });
      ctx.setElement('incSource', { value: 'Freelance dev' });
      ctx.setElement('incNote', { value: '' });
      ctx.saveIncome();

      assert.equal(ctx.state.salary, 40000);
      assert.equal(ctx.state.budgets.needs, 24000); // 60%
      assert.equal(ctx.state.budgets.wants, 8000);  // 20%
      assert.equal(ctx.state.budgets.savings, 8000); // 20%
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        40000
      );

      // Switch to 70/20/10 preset and log another ₹10,000 inflow
      ctx.state.ratios = { needs: 70, wants: 20, savings: 10 };
      ctx.setElement('incAmount', { value: '10000' });
      ctx.setElement('incSource', { value: 'Tutoring' });
      ctx.setElement('incNote', { value: '' });
      ctx.saveIncome();

      assert.equal(ctx.state.salary, 50000);
      assert.equal(ctx.state.budgets.needs, 35000); // 70% of 50k
      assert.equal(ctx.state.budgets.wants, 10000); // 20% of 50k
      assert.equal(ctx.state.budgets.savings, 5000); // 10% of 50k
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        50000
      );
    });

    it('combines optional base salary with freelance inflows accurately', () => {
      const ctx = createTestContext({
        baseSalary: 40000,
        salary: 40000,
        incomes: [],
        ratios: { needs: 50, wants: 30, savings: 20 }
      });

      const initialIncome = ctx.getMonthlyIncome();
      assert.equal(initialIncome.base, 40000);
      assert.equal(initialIncome.extra, 0);
      assert.equal(initialIncome.total, 40000);

      // Log freelance inflow of ₹15,000
      ctx.setElement('incAmount', { value: '15000' });
      ctx.setElement('incSource', { value: 'Weekend Consulting' });
      ctx.setElement('incNote', { value: '' });
      ctx.saveIncome();

      const combinedIncome = ctx.getMonthlyIncome();
      assert.equal(combinedIncome.base, 40000);
      assert.equal(combinedIncome.extra, 15000);
      assert.equal(combinedIncome.total, 55000);

      assert.equal(ctx.state.salary, 55000);
      // 50% of 55,000 = 27,500
      assert.equal(ctx.state.budgets.needs, 27500);
      // 30% of 55,000 = 16,500
      assert.equal(ctx.state.budgets.wants, 16500);
      // 20% of 55,000 = 11,000
      assert.equal(ctx.state.budgets.savings, 11000);
      assert.equal(
        ctx.state.budgets.needs + ctx.state.budgets.wants + ctx.state.budgets.savings,
        55000
      );
    });
  });
});
