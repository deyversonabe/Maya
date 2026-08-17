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

  it("imports the real Secullum/Romep report text exported from the attached PDF", () => {
    const text = [
      "Secullum RH | Romep",
      "Periodo: 01/07/2026 ate 11/08/2026.",
      "www.secullum.com.br Emitido em 11/08/2026 14:49:02 2 PAGINA DE 1",
      "DATA ENTRADA 1 SAIDA 1 ENTRADA 2 SAIDA 2 NORMAIS FALTAS",
      "12:20 13:33 18:04 09:00 00:18 08:09 01/07/2026 - Qua",
      "12:21 13:34 18:08 09:00 00:11 08:06 02/07/2026 - Qui",
      "12:34 13:49 18:07 09:00 07:56 03/07/2026 - Sex",
      "04/07/2026 - Sab",
      "05/07/2026 - Dom",
      "11:48 13:20 18:20 09:00 00:15 08:03 06/07/2026 - Seg",
      "12:11 13:32 18:33 09:00 08:11 07/07/2026 - Ter",
      "12:30 13:50 18:15 09:00 00:11 08:06 08/07/2026 - Qua",
      "09:00 09:00 09/07/2026 - Qui",
      "12:51 13:54 18:03 09:00 08:03 10/07/2026 - Sex",
      "13:05 14:16 18:21 09:00 08:05 20/07/2026 - Seg",
      "12:32 13:38 17:48 09:00 00:27 08:09 22/07/2026 - Qua",
      "11:01 12:21 18:00 09:00 00:25 08:05 23/07/2026 - Qui",
      "13:12 17:55 09:00 03:55 08:07 28/07/2026 - Ter",
      "13:10 14:32 18:13 09:00 00:27 08:18 03/08/2026 - Seg",
      "18:15 09:00 08:11 06/08/2026 - Qui",
      "12:28 13:59 09:00 04:32 08:00 10/08/2026 - Seg",
      "13:12 09:00 03:46 07:58 11/08/2026 - Ter",
      "270:00 52:39 TOTAIS"
    ].join("\n");

    const drafts = parseTimeClockReportText(text, "dey cartao de ponto.pdf");

    expect(drafts.find((draft) => draft.date === "2026-07-09")).toBeUndefined();
    expect(drafts.find((draft) => draft.date === "2026-07-01")).toMatchObject({
      firstIn: "08:09",
      firstOut: "12:20",
      secondIn: "13:33",
      secondOut: "18:04"
    });
    expect(drafts.find((draft) => draft.date === "2026-08-03")).toMatchObject({
      firstIn: "08:18",
      firstOut: "13:10",
      secondIn: "14:32",
      secondOut: "18:13"
    });
    expect(drafts.find((draft) => draft.date === "2026-08-06")).toMatchObject({
      firstIn: "08:11",
      secondOut: "18:15",
      punches: ["08:11", "18:15"]
    });
  });

  it("reads an individual REP receipt with DATA/HORA as a single editable punch", () => {
    const text = [
      "COMPROVANTE DE REGISTRO DE PONTO DO TRABALHADOR",
      "NOME: DEYVERSON SILVA",
      "DATA:03/08/2026 HORA:18:13 AD:W6HYY6"
    ].join("\n");

    const drafts = parseTimeClockReportText(text, "comprovante-ponto.jpeg");

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      date: "2026-08-03",
      firstIn: "",
      firstOut: "",
      secondIn: "",
      secondOut: "18:13",
      endTime: "18:13",
      punches: ["18:13"]
    });
  });
});

describe("timecard report parser - reliability regressions", () => {
  it("reads vertical layouts where a date is followed by one punch per line", () => {
    const text = [
      "01/07/2026",
      "08:09",
      "12:20",
      "13:33",
      "18:04",
      "02/07/2026",
      "08:06",
      "12:21",
      "13:34",
      "18:08"
    ].join("\n");

    const drafts = parseTimeClockReportText(text, "vertical.pdf");

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      date: "2026-07-01",
      firstIn: "08:09",
      firstOut: "12:20",
      secondIn: "13:33",
      secondOut: "18:04"
    });
    expect(drafts[1]).toMatchObject({ date: "2026-07-02", secondOut: "18:08" });
  });

  it("reads vertical Secullum extraction where punches appear before the date", () => {
    const text = [
      "12:20",
      "13:33",
      "18:04",
      "09:00",
      "00:18",
      "08:09",
      "01/07/2026 - Qua",
      "12:21",
      "13:34",
      "18:08",
      "09:00",
      "00:11",
      "08:06",
      "02/07/2026 - Qui"
    ].join("\n");

    const drafts = parseTimeClockReportText(text, "vertical-secullum.pdf");

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      date: "2026-07-01",
      punches: ["08:09", "12:20", "13:33", "18:04"]
    });
    expect(drafts[1]).toMatchObject({
      date: "2026-07-02",
      punches: ["08:06", "12:21", "13:34", "18:08"]
    });
  });

  it("never turns Emitido em into a worked day", () => {
    const drafts = parseTimeClockReportText(
      [
        "www.secullum.com.br Emitido em 12/08/2026 14:49:02 PAGINA DE 1",
        "13/08/2026 - Qui 08:10 12:00 13:10 18:00 09:00 00:00"
      ].join("\n")
    );

    expect(drafts.find((draft) => draft.date === "2026-08-12")).toBeUndefined();
    expect(drafts.find((draft) => draft.date === "2026-08-13")).toBeDefined();
  });

  it("keeps endTime empty when the final exit was not actually read", () => {
    const drafts = parseTimeClockReportText("10/08/2026 - Seg 08:00 12:28 13:59 09:00 04:32");
    expect(drafts[0]).toMatchObject({
      firstIn: "08:00",
      firstOut: "12:28",
      secondIn: "13:59",
      secondOut: "",
      startTime: "08:00",
      endTime: ""
    });
  });
});
