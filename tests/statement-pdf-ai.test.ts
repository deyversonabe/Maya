import { afterEach, describe, expect, it, vi } from "vitest";
import { readBankStatementWithMaya } from "@/modules/ai/maya";

const originalApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
});

describe("MAYA bank statement PDF input", () => {
  it("sends PDF as input_file and explicitly instructs reading all pages", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as {
          input: Array<{ content: Array<Record<string, unknown>> }>;
        };
        const content = request.input[0]?.content ?? [];
        const prompt = String(content.find((item) => item.type === "input_text")?.text ?? "");
        const file = content.find((item) => item.type === "input_file");

        expect(prompt).toContain("TODAS as paginas");
        expect(file).toMatchObject({ file_data: "JVBERi0x", filename: "extrato.pdf" });
        expect(file).not.toHaveProperty("file_url");

        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              title: "Extrato setembro",
              openingBalance: 100,
              closingBalance: 125,
              totalIncome: 50,
              totalExpenses: 25,
              confidence: 0.98,
              missingFields: [],
              lines: [
                { type: "income", description: "Pix recebido", amount: 50, category: "Outros", date: "2026-09-01", confidence: 0.98 },
                { type: "expense", description: "Pagamento", amount: 25, category: "Outros", date: "2026-09-02", confidence: 0.98 }
              ]
            })
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const result = await readBankStatementWithMaya({ pdfBase64: "JVBERi0x", fileName: "extrato.pdf" });

    expect(result.statementDraft.lines).toHaveLength(2);
    expect(result.statementDraft.reconciliationDifference).toBe(0);
  });
});
