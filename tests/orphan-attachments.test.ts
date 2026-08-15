import { describe, expect, it } from "vitest";
import { createEmptyFinanceState } from "../modules/finance/data/defaults";
import { collectFinanceAttachmentPaths, findOrphanAttachmentPaths } from "../modules/finance/lib/orphan-attachments";

describe("orphan attachments", () => {
  it("collects attachment storage paths from finance entities", () => {
    const state = createEmptyFinanceState();
    state.bills = [
      {
        id: "bill",
        title: "Energia",
        amount: 100,
        category: "Casa",
        person: "Casal",
        dueDate: "2026-08-15",
        paymentMethod: "boleto",
        recurrence: "none",
        status: "pending",
        source: "manual",
        attachmentStoragePath: "workspace/2026-08-01/bill.jpg",
        createdAt: "2026-08-01T12:00:00.000Z"
      }
    ];

    expect(collectFinanceAttachmentPaths(state)).toContain("workspace/2026-08-01/bill.jpg");
  });

  it("finds storage files that are no longer referenced", () => {
    expect(
      findOrphanAttachmentPaths({
        knownPaths: new Set(["a.jpg"]),
        storagePaths: ["a.jpg", "b.jpg"]
      })
    ).toEqual(["b.jpg"]);
  });
});
