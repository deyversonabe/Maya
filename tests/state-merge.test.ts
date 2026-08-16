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

  it("keeps the newest version when cloud and local have the same transaction id", () => {
    const cloud = createEmptyFinanceState();
    const local = createEmptyFinanceState();

    cloud.transactions = [
      {
        id: "same",
        type: "expense",
        description: "Conta corrigida no desktop",
        amount: 19.87,
        category: "Casa",
        person: "Casal",
        date: "2026-08-01",
        recurring: false,
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-16T12:00:00.000Z"
      }
    ];
    local.transactions = [
      {
        id: "same",
        type: "expense",
        description: "Conta antiga no celular",
        amount: 10,
        category: "Casa",
        person: "Casal",
        date: "2026-08-01",
        recurring: false,
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-15T12:00:00.000Z"
      }
    ];

    const merged = mergeFinanceStates(cloud, local);
    expect(merged.transactions).toHaveLength(1);
    expect(merged.transactions[0]?.description).toBe("Conta corrigida no desktop");
    expect(merged.transactions[0]?.amount).toBe(19.87);
  });

  it("uses deletion tombstones to stop stale local records from returning", () => {
    const cloud = createEmptyFinanceState();
    const local = createEmptyFinanceState();

    cloud.deletedEntityIds = ["removed"];
    local.transactions = [
      {
        id: "removed",
        type: "expense",
        description: "Despesa apagada",
        amount: 10,
        category: "Casa",
        person: "Casal",
        date: "2026-08-01",
        recurring: false,
        createdAt: "2026-08-01T12:00:00.000Z"
      }
    ];

    const merged = mergeFinanceStates(cloud, local);
    expect(merged.transactions).toHaveLength(0);
    expect(merged.deletedEntityIds).toContain("removed");
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
