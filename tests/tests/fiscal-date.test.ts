import { describe, expect, it } from "vitest";
import { getFiscalAccessKeyReferenceMonth, normalizeFiscalDocumentDate } from "../modules/finance/lib/fiscal-date";

const accessKey = "35260812345678000123550010000012341000012345";

describe("fiscal document date normalization", () => {
  it("reads AAMM from the NF-e access key", () => {
    expect(getFiscalAccessKeyReferenceMonth(accessKey)).toEqual({ year: 2026, month: 8 });
  });

  it("corrects an OCR year using the fiscal access key while preserving the day", () => {
    expect(normalizeFiscalDocumentDate("2022-08-15", accessKey, new Date("2026-08-16T12:00:00Z"))).toMatchObject({
      date: "2026-08-15",
      corrected: true,
      needsReview: true
    });
  });

  it("blocks an implausibly old date when no fiscal key can validate it", () => {
    expect(normalizeFiscalDocumentDate("2022-08-15", undefined, new Date("2026-08-16T12:00:00Z"))).toMatchObject({
      date: "",
      needsReview: true
    });
  });

  it("does not invent a day when the date is invalid", () => {
    expect(normalizeFiscalDocumentDate("2026-02-31", accessKey, new Date("2026-08-16T12:00:00Z"))).toMatchObject({
      date: "",
      needsReview: true
    });
  });
});
