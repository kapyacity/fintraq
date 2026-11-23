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
});
