import { describe, expect, it } from "vitest";
import { parseTimeClockReportText } from "../modules/ai/timecard-report-parser";

describe("timecard report parser", () => {
  it("imports Secullum/Romep PDF rows with the work date at the beginning", () => {
    const text = [
      "DATA ENTRADA 1SAIDA 1 ENTRADA 2SAIDA 2 NORMAIS FALTAS",
      "01/07/2026 - Qua 08:09 12:20 13:33 18:04 09:00 00:18",
      "02/07/2026 - Qui 08:06 12:21 13:34 18:08 09:00 00:11",
      "09/07/2026 - Qui 09:00 09:00",
      "28/07/2026 - Ter 08:07 13:12 17:55 09:00 03:55",
      "10/08/2026 - Seg 08:00 12:28 13:59 09:00 04:32",
      "11/08/2026 - Ter 07:58 13:12 09:00 03:46"
    ].join("\n");

    const drafts = parseTimeClockReportText(text, "dey cartao de ponto.pdf");

    expect(drafts).toHaveLength(5);

    expect(drafts.find((draft) => draft.date === "2026-07-01")).toMatchObject({
      firstIn: "08:09",
      firstOut: "12:20",
      secondIn: "13:33",
      secondOut: "18:04",
      punches: ["08:09", "12:20", "13:33", "18:04"]
    });

    expect(drafts.find((draft) => draft.date === "2026-07-28")).toMatchObject({
      firstIn: "08:07",
      firstOut: "13:12",
      secondIn: "",
      secondOut: "17:55",
      punches: ["08:07", "13:12", "17:55"]
    });

    expect(drafts.find((draft) => draft.date === "2026-08-10")).toMatchObject({
      firstIn: "08:00",
      firstOut: "12:28",
      secondIn: "13:59",
      secondOut: "",
      punches: ["08:00", "12:28", "13:59"]
    });

    expect(drafts.find((draft) => draft.date === "2026-08-11")).toMatchObject({
      firstIn: "07:58",
      firstOut: "13:12",
      secondIn: "",
      secondOut: "",
      punches: ["07:58", "13:12"]
    });
  });

  it("imports Secullum/Romep PDF rows with the work date at the end", () => {
    const text = [
      "DATA ENTRADA 1 SAIDA 1 ENTRADA 2 SAIDA 2 NORMAIS FALTAS",
      "12:20 13:33 18:04 09:00 00:18 08:09 01/07/2026 - Qua",
      "12:34 13:49 18:07 09:00 07:56 03/07/2026 - Sex",
      "13:12 17:55 09:00 03:55 08:07 28/07/2026 - Ter",
      "12:28 13:59 09:00 03:21 08:00 10/08/2026 - Seg"
    ].join("\n");

    const drafts = parseTimeClockReportText(text, "dey cartao de ponto.pdf");

    expect(drafts).toHaveLength(4);

    const fullDay = drafts.find((draft) => draft.date === "2026-07-01");
    expect(fullDay).toMatchObject({
      firstIn: "08:09",
      firstOut: "12:20",
      secondIn: "13:33",
      secondOut: "18:04",
      expectedMinutes: 528,
      punches: ["08:09", "12:20", "13:33", "18:04"]
    });

    const missingReturn = drafts.find((draft) => draft.date === "2026-07-28");
    expect(missingReturn).toMatchObject({
      firstIn: "08:07",
      firstOut: "13:12",
      secondIn: "",
      secondOut: "17:55",
      expectedMinutes: 528,
      punches: ["08:07", "13:12", "17:55"]
    });
    expect(missingReturn?.missingFields).toContain("secondIn");

    const missingExit = drafts.find((draft) => draft.date === "2026-08-10");
    expect(missingExit).toMatchObject({
      firstIn: "08:00",
      firstOut: "12:28",
      secondIn: "13:59",
      secondOut: "",
      punches: ["08:00", "12:28", "13:59"]
    });
    expect(missingExit?.missingFields).toContain("secondOut");
  });
});
