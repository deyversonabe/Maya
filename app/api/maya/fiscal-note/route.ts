import { NextResponse } from "next/server";
import { extractAccessKey, normalizeProviderResult } from "@/modules/finance/lib/fiscal-note-import";

export const maxDuration = 25;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { qrContent?: string; accessKey?: string };
    const input = (body.accessKey || body.qrContent || "").trim();
    const accessKey = extractAccessKey(input);
    if (!input) return NextResponse.json({ error: "Informe o QR Code ou a chave de acesso." }, { status: 400 });
    if (!accessKey && !/^https?:\/\//i.test(input)) return NextResponse.json({ error: "QR Code ou chave de acesso invalida." }, { status: 400 });

    const providerUrl = process.env.FISCAL_NOTE_API_URL;
    if (!providerUrl) {
      return NextResponse.json({
        requiresProvider: true,
        accessKey,
        consultationUrl: /^https?:\/\//i.test(input) ? input : undefined,
        message: "A nota foi identificada. Configure FISCAL_NOTE_API_URL para buscar automaticamente os dados completos ou importe o XML."
      });
    }

    const response = await fetch(providerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.FISCAL_NOTE_API_TOKEN ? { Authorization: `Bearer ${process.env.FISCAL_NOTE_API_TOKEN}` } : {})
      },
      body: JSON.stringify({ accessKey, qrContent: body.qrContent })
    });
    if (!response.ok) return NextResponse.json({ error: "O provedor fiscal nao conseguiu consultar essa nota." }, { status: 502 });
    const data = await response.json();
    return NextResponse.json(normalizeProviderResult(data));
  } catch {
    return NextResponse.json({ error: "Nao foi possivel consultar a nota fiscal." }, { status: 500 });
  }
}
