import type { FinancialDocumentDraft, FinancialDocumentItem, FiscalDocumentMetadata, PaymentMethod, Person } from "../types";

export type FiscalNoteImportResult = {
  financialDraft: FinancialDocumentDraft;
  source: "xml" | "qr" | "access_key";
  message: string;
};

export function extractAccessKey(value: string): string | null {
  const decoded = safeDecode(value);
  const candidates = decoded.match(/\d{44}/g) ?? [];
  return candidates[0] ?? null;
}

export function parseBrazilianFiscalXml(xmlText: string, person: Person = "Casal"): FiscalNoteImportResult {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("xml_invalid");

  const text = (...names: string[]) => {
    for (const name of names) {
      const node = xml.getElementsByTagName(name)[0];
      if (node?.textContent?.trim()) return node.textContent.trim();
    }
    return "";
  };
  const number = (...names: string[]) => parseNumber(text(...names));
  const issuerName = text("xNome");
  const issuerCnpj = text("CNPJ", "CPF");
  const accessKey = extractAccessKey(text("chNFe", "Id")) ?? extractAccessKey(xmlText) ?? undefined;
  const issueDateRaw = text("dhEmi", "dEmi");
  const issueDate = normalizeDate(issueDateRaw);
  const items: FinancialDocumentItem[] = Array.from(xml.getElementsByTagName("det")).map((det) => {
    const childText = (...names: string[]) => {
      for (const name of names) {
        const node = det.getElementsByTagName(name)[0];
        if (node?.textContent?.trim()) return node.textContent.trim();
      }
      return "";
    };
    return {
      name: childText("xProd") || "Item sem descricao",
      code: childText("cProd") || undefined,
      ean: childText("cEAN") || undefined,
      ncm: childText("NCM") || undefined,
      quantity: parseNumber(childText("qCom")) || undefined,
      unit: childText("uCom") || undefined,
      unitPrice: parseNumber(childText("vUnCom")) || undefined,
      amount: parseNumber(childText("vProd")) || undefined
    };
  });
  const paymentCode = text("tPag");
  const paymentMethod = paymentMethodFromFiscalCode(paymentCode);
  const total = number("vNF", "vCFe") || items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const fiscalDocument: FiscalDocumentMetadata = {
    documentType: text("mod") === "65" ? "danfe_nfce" : "danfe_nfe",
    accessKey,
    issuerName: issuerName || undefined,
    issuerCnpj: issuerCnpj || undefined,
    documentNumber: text("nNF", "nCFe") || undefined,
    series: text("serie") || undefined,
    issueTime: issueDateRaw || undefined,
    protocolNumber: text("nProt") || undefined,
    totalItemsAmount: number("vProd") || undefined,
    discountAmount: number("vDesc") || undefined,
    taxAmount: number("vTotTrib") || undefined,
    paidAmount: number("vPag") || total || undefined
  };

  return {
    source: "xml",
    message: `XML lido com ${items.length} item(ns). Confira os dados antes de salvar.`,
    financialDraft: {
      kind: "expense",
      title: issuerName || "Compra por nota fiscal",
      description: issuerName ? `Compra em ${issuerName}` : "Compra importada de nota fiscal",
      amount: total,
      category: "Outros",
      documentDate: issueDate,
      person,
      paymentMethod,
      paymentRecipient: issuerName || undefined,
      confidence: 0.98,
      source: "import",
      missingFields: [!total ? "amount" : "", !issueDate ? "documentDate" : ""].filter(Boolean),
      items,
      fiscalDocument,
      notes: accessKey ? `Chave de acesso: ${accessKey}` : undefined
    }
  };
}

export function normalizeProviderResult(data: unknown, person: Person = "Casal"): FiscalNoteImportResult {
  const root = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const note = ((root.note ?? root.nota ?? root.data ?? root) && typeof (root.note ?? root.nota ?? root.data ?? root) === "object"
    ? (root.note ?? root.nota ?? root.data ?? root)
    : {}) as Record<string, unknown>;
  const itemsRaw = Array.isArray(note.items) ? note.items : [];
  const items: FinancialDocumentItem[] = itemsRaw.map((raw) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      name: stringValue(item.name ?? item.description ?? item.xProd) || "Item sem descricao",
      code: optionalString(item.code ?? item.cProd),
      ean: optionalString(item.ean ?? item.cEAN),
      ncm: optionalString(item.ncm ?? item.NCM),
      quantity: optionalNumber(item.quantity ?? item.qCom),
      unit: optionalString(item.unit ?? item.uCom),
      unitPrice: optionalNumber(item.unitPrice ?? item.vUnCom),
      amount: optionalNumber(item.amount ?? item.total ?? item.vProd)
    };
  });
  const issuerName = stringValue(note.issuerName ?? note.emitente ?? note.companyName ?? note.xNome);
  const accessKey = extractAccessKey(stringValue(note.accessKey ?? note.chave ?? note.chNFe)) ?? undefined;
  const total = optionalNumber(note.amount ?? note.total ?? note.vNF) ?? items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const date = normalizeDate(stringValue(note.issueDate ?? note.date ?? note.dhEmi));

  return {
    source: accessKey ? "access_key" : "qr",
    message: stringValue(root.message) || `Nota consultada com ${items.length} item(ns). Confira antes de salvar.`,
    financialDraft: {
      kind: "expense",
      title: issuerName || "Compra por nota fiscal",
      description: issuerName ? `Compra em ${issuerName}` : "Compra importada por QR Code",
      amount: total,
      category: "Outros",
      documentDate: date,
      person,
      paymentMethod: paymentMethodFromLabel(stringValue(note.paymentMethod ?? note.formaPagamento)),
      paymentRecipient: issuerName || undefined,
      confidence: optionalNumber(note.confidence) ?? 0.9,
      source: "import",
      missingFields: [!total ? "amount" : "", !date ? "documentDate" : ""].filter(Boolean),
      items,
      fiscalDocument: {
        documentType: stringValue(note.model ?? note.mod) === "65" ? "danfe_nfce" : "danfe_nfe",
        accessKey,
        issuerName: issuerName || undefined,
        issuerCnpj: optionalString(note.issuerCnpj ?? note.cnpj ?? note.CNPJ),
        documentNumber: optionalString(note.documentNumber ?? note.numero ?? note.nNF),
        series: optionalString(note.series ?? note.serie),
        issueTime: optionalString(note.issueTime ?? note.dhEmi),
        protocolNumber: optionalString(note.protocolNumber ?? note.protocolo ?? note.nProt),
        totalItemsAmount: optionalNumber(note.totalItemsAmount ?? note.vProd),
        discountAmount: optionalNumber(note.discountAmount ?? note.vDesc),
        taxAmount: optionalNumber(note.taxAmount ?? note.vTotTrib),
        paidAmount: optionalNumber(note.paidAmount ?? note.vPag ?? total)
      }
    }
  };
}

function safeDecode(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
function parseNumber(value: string) {
  const raw = value.trim();
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
function stringValue(value: unknown) { return typeof value === "string" ? value.trim() : value == null ? "" : String(value); }
function optionalString(value: unknown) { const text = stringValue(value); return text || undefined; }
function optionalNumber(value: unknown) { const n = typeof value === "number" ? value : parseNumber(stringValue(value)); return Number.isFinite(n) && n !== 0 ? n : undefined; }
function normalizeDate(value: string) { const match = value.match(/(\d{4})-(\d{2})-(\d{2})/); return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined; }
function paymentMethodFromFiscalCode(code: string): PaymentMethod { return code === "01" ? "cash" : ["03","04","10","11","12","13","15","17","18"].includes(code) ? "card" : code === "16" ? "pix" : "other"; }
function paymentMethodFromLabel(label: string): PaymentMethod { const v = label.toLowerCase(); return v.includes("pix") ? "pix" : v.includes("dinheiro") ? "cash" : v.includes("cart") ? "card" : v.includes("boleto") ? "boleto" : "other"; }
