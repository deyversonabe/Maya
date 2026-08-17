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

describe("finance state migrations - reliability regressions", () => {
  it("never invents 08:00 or 18:00 for an incomplete structured time entry", () => {
    const state = migrateFinanceState({
      schemaVersion: 7,
      profile: { name: "Maya", slogan: "", monthlyIncomeTarget: 0, emergencyReserveTarget: 0 },
      accounts: [],
      transactions: [],
      goals: [],
      budgets: [],
      bills: [],
      salonMaterials: [],
      salonServiceRecipes: [],
      salonStockMovements: [],
      taxDocuments: [],
      laborBenefits: [],
      payrollRecords: [],
      workTimeEntries: [
        {
          id: "partial",
          person: "Deyverson",
          date: "2026-08-11",
          firstOut: "13:12",
          punches: ["13:12"],
          startTime: "",
          endTime: "",
          lunchMinutes: 72,
          expectedMinutes: 528,
          createdAt: "2026-08-11T12:00:00.000Z"
        }
      ],
      activityLogs: [],
      deletedEntityIds: [],
      updatedAt: "2026-08-11T12:00:00.000Z"
    });

    expect(state.workTimeEntries[0]).toMatchObject({
      firstIn: "",
      firstOut: "13:12",
      secondIn: "",
      secondOut: "",
      startTime: "",
      endTime: ""
    });
  });

  it("corrects the fiscal month/year from a valid NF-e access key and collapses duplicate notes", () => {
    const accessKey = "35260812345678000123550010000012341000012345";
    const state = migrateFinanceState({
      schemaVersion: 7,
      profile: { name: "Maya", slogan: "", monthlyIncomeTarget: 0, emergencyReserveTarget: 0 },
      accounts: [],
      transactions: [
        {
          id: "old-a",
          type: "expense",
          description: "Tinta teto",
          amount: 61.69,
          category: "Melhoria casa",
          person: "Casal",
          date: "2022-08-15",
          recurring: false,
          source: "receipt",
          fiscalDocument: { documentType: "danfe_nfe", accessKey },
          createdAt: "2026-08-16T12:00:00.000Z"
        },
        {
          id: "old-b",
          type: "expense",
          description: "Tinta teto",
          amount: 61.69,
          category: "Melhoria casa",
          person: "Casal",
          date: "2023-08-15",
          recurring: false,
          source: "receipt",
          fiscalDocument: { documentType: "danfe_nfe", accessKey },
          createdAt: "2026-08-16T12:01:00.000Z"
        }
      ],
      goals: [],
      budgets: [],
      bills: [],
      salonMaterials: [],
      salonServiceRecipes: [],
      salonStockMovements: [],
      taxDocuments: [],
      laborBenefits: [],
      payrollRecords: [],
      workTimeEntries: [],
      activityLogs: [],
      deletedEntityIds: [],
      updatedAt: "2026-08-16T12:01:00.000Z"
    });

    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0]?.date).toBe("2026-08-15");
  });
});
