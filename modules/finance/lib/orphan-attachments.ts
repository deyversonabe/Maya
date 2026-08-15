import type { FinanceState } from "../types";

const ATTACHMENT_KEYS = ["attachmentStoragePath", "storagePath"] as const;

export function collectFinanceAttachmentPaths(state: FinanceState) {
  const paths = new Set<string>();
  const collections = [
    state.transactions,
    state.bills,
    state.taxDocuments,
    state.laborBenefits,
    state.payrollRecords,
    state.workTimeEntries
  ];

  for (const collection of collections) {
    for (const item of collection) {
      const record = item as unknown as Record<string, unknown>;

      for (const key of ATTACHMENT_KEYS) {
        const value = record[key];

        if (typeof value === "string" && value.trim()) {
          paths.add(value.trim());
        }
      }
    }
  }

  return paths;
}

export function findOrphanAttachmentPaths({
  knownPaths,
  storagePaths,
  max = 50
}: {
  knownPaths: Set<string>;
  storagePaths: string[];
  max?: number;
}) {
  return storagePaths.filter((path) => !knownPaths.has(path)).slice(0, max);
}
