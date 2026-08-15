import { describe, expect, it } from "vitest";
import { createEmptyFinanceState } from "../modules/finance/data/defaults";
import { mergeFinanceStates, prepareFinanceStateForCloud } from "../modules/finance/lib/state-merge";

describe("state merge", () => {
  it("preserves different transactions from cloud and local state", () => {
    const cloud = createEmptyFinanceState();
    const local = createEmptyFinanceState();
    cloud.transactions = [
      {
        id: "cloud",
        type: "expense",
        description: "Conta",
        amount: 10,
        category: "Casa",
        person: "Casal",
        date: "2026-08-01",
        recurring: false,
        createdAt: "2026-08-01T12:00:00.000Z"
      }
    ];
    local.transactions = [
      {
        id: "local",
        type: "income",
        description: "Cliente",
        amount: 20,
        category: "Sobrancelha",
        person: "Deyverson",
        date: "2026-08-02",
        recurring: false,
        createdAt: "2026-08-02T12:00:00.000Z"
      }
    ];

    const merged = mergeFinanceStates(cloud, local);
    expect(merged.transactions.map((item) => item.id).sort()).toEqual(["cloud", "local"]);
  });

  it("strips uploaded data URLs before cloud save", () => {
    const state = createEmptyFinanceState();
    state.transactions = [
      {
        id: "with-file",
        type: "expense",
        description: "Nota",
        amount: 10,
        category: "Casa",
        person: "Casal",
        date: "2026-08-01",
        recurring: false,
        attachmentDataUrl: "data:image/jpeg;base64,abc",
        attachmentStoragePath: "workspace/2026-08-01/file.jpg",
        createdAt: "2026-08-01T12:00:00.000Z"
      }
    ];

    expect(prepareFinanceStateForCloud(state).transactions[0].attachmentDataUrl).toBeUndefined();
  });
});
