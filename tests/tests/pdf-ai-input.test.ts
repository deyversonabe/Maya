import { afterEach, describe, expect, it, vi } from "vitest";
import { readReceiptWithMaya, readTimeClockWithMaya } from "../modules/ai/maya";

const originalApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

describe("native PDF inputs for MAYA", () => {
  it("sends a timecard PDF as input_file and imports multiple dates", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        input: Array<{ content: Array<Record<string, unknown>> }>;
      };
      const file = request.input[0]?.content.find((item) => item.type === "input_file");
      expect(file).toMatchObject({ file_data: "JVBERi0x", filename: "ponto.pdf" });

      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            detectedDates: 2,
            entries: [
              {
                date: "2026-08-03",
                firstIn: "08:18",
                firstOut: "13:10",
                secondIn: "14:32",
                secondOut: "18:13",
                punches: ["08:18", "13:10", "14:32", "18:13"],
                lunchMinutes: 82,
                expectedMinutes: 528,
                missingFields: [],
                confidence: 0.99
              },
              {
                date: "2026-08-04",
                firstIn: "08:06",
                firstOut: "12:20",
                secondIn: "13:32",
                secondOut: "18:02",
                punches: ["08:06", "12:20", "13:32", "18:02"],
                lunchMinutes: 72,
                expectedMinutes: 528,
                missingFields: [],
                confidence: 0.99
              }
            ]
          })
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await readTimeClockWithMaya({ pdfBase64: "JVBERi0x", fileName: "ponto.pdf" });

    expect(result.timeClockDrafts).toHaveLength(2);
    expect(result.timeClockDrafts?.[0]).toMatchObject({ firstIn: "08:18", secondOut: "18:13" });
  });

  it("sends a receipt PDF as input_file instead of using pdf-parse", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        input: Array<{ content: Array<Record<string, unknown>> }>;
      };
      const file = request.input[0]?.content.find((item) => item.type === "input_file");
      expect(file).toMatchObject({ file_data: "JVBERi0x", filename: "nota.pdf" });

      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            kind: "expense",
            title: "Mercado",
            description: "Nota fiscal",
            amount: 123.45,
            documentDate: "2026-08-16",
            category: "Alimentacao",
            fiscalDocument: { accessKey: "35260812345678000123550010000012341000012345" },
            missingFields: ["paymentMethod"],
            items: []
          })
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await readReceiptWithMaya({ pdfBase64: "JVBERi0x", fileName: "nota.pdf", documentKind: "expense" });

    expect(result.financialDraft).toMatchObject({ amount: 123.45, documentDate: "2026-08-16" });
  });
});

describe("signed PDF URL inputs for MAYA", () => {
  it("sends a timecard PDF as file_url when Storage provides a signed URL", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const signedUrl = "https://example.supabase.co/storage/v1/object/sign/maya-finance-attachments/ponto.pdf?token=test";
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        input: Array<{ content: Array<Record<string, unknown>> }>;
      };
      const file = request.input[0]?.content.find((item) => item.type === "input_file");
      expect(file).toMatchObject({ file_url: signedUrl, filename: "ponto.pdf" });
      expect(file).not.toHaveProperty("file_data");

      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            detectedDates: 1,
            entries: [
              {
                date: "2026-08-03",
                secondOut: "18:13",
                punches: ["18:13"],
                expectedMinutes: 528,
                missingFields: ["firstIn", "firstOut", "secondIn"],
                confidence: 0.9
              }
            ]
          })
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await readTimeClockWithMaya({ pdfUrl: signedUrl, fileName: "ponto.pdf" });

    expect(result.timeClockDraft).toMatchObject({ secondOut: "18:13", firstIn: "" });
  });
});
