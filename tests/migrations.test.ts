import { describe, expect, it } from "vitest";
import { migrateFinanceState } from "../modules/finance/lib/migrations";

describe("finance state migrations", () => {
  it("preserves salon arrays when normalizing schema version 6", () => {
    const state = migrateFinanceState({
      schemaVersion: 6,
      profile: { name: "Maya", slogan: "", monthlyIncomeTarget: 0, emergencyReserveTarget: 0 },
      accounts: [],
      transactions: [],
      goals: [],
      budgets: [],
      bills: [],
      taxDocuments: [],
      laborBenefits: [],
      payrollRecords: [],
      workTimeEntries: [],
      activityLogs: [],
      deletedEntityIds: [],
      salonMaterials: [
        {
          id: "mat",
          name: "Henna",
          category: "Sobrancelha",
          unit: "ml",
          packageQuantity: 30,
          packageCost: 45,
          stockQuantity: 30,
          minStockQuantity: 5,
          createdAt: "2026-08-01T12:00:00.000Z"
        }
      ],
      salonServiceRecipes: [],
      salonStockMovements: [],
      updatedAt: "2026-08-01T12:00:00.000Z"
    });

    expect(state.schemaVersion).toBe(7);
    expect(state.salonMaterials).toHaveLength(1);
  });

  it("does not wipe a future-looking state without schemaVersion", () => {
    const state = migrateFinanceState({
      transactions: [
        {
          id: "txn",
          type: "income",
          description: "Cliente",
          amount: 90,
          category: "Sobrancelha",
          person: "Deyverson",
          date: "2026-08-15",
          recurring: false,
          createdAt: "2026-08-15T12:00:00.000Z"
        }
      ]
    });

    expect(state.transactions).toHaveLength(1);
  });
});
