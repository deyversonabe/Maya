import { describe, expect, it } from "vitest";
import { addMonthsSafe, buildMonthKeyRange, getMonthEndDate, monthKeyAdd, toInputDate } from "../lib/utils";

describe("finance date helpers", () => {
  it("keeps month math stable across month length changes", () => {
    expect(monthKeyAdd("2026-01", 1)).toBe("2026-02");
    expect(addMonthsSafe("2026-01-31", 1)).toBe("2026-02-28");
    expect(getMonthEndDate("2026-02")).toBe("2026-02-28");
  });

  it("builds month ranges without Date.setMonth drift", () => {
    expect(buildMonthKeyRange("2026-08", -1, 1)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("formats date using the app timezone", () => {
    expect(toInputDate(new Date("2026-08-15T03:00:00.000Z"))).toBe("2026-08-15");
  });
});
