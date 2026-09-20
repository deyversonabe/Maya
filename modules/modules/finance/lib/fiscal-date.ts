const MAX_DOCUMENT_AGE_MONTHS = 18;
const MAX_FUTURE_DAYS = 7;

export interface FiscalDateNormalizationResult {
  date: string;
  corrected: boolean;
  needsReview: boolean;
  note?: string;
}

export function normalizeFiscalDocumentDate(
  value: string,
  accessKey?: string,
  now = new Date()
): FiscalDateNormalizationResult {
  const parsed = parseIsoDate(value);
  const referenceMonth = getFiscalAccessKeyReferenceMonth(accessKey);

  if (parsed && referenceMonth) {
    const corrected = buildDate(referenceMonth.year, referenceMonth.month, parsed.day);

    if (!corrected) {
      return {
        date: "",
        corrected: false,
        needsReview: true,
        note: "A data da nota nao e valida para o mes/ano indicado pela chave fiscal."
      };
    }

    if (corrected !== value) {
      return {
        date: corrected,
        corrected: true,
        needsReview: true,
        note: `Data ajustada de ${value} para ${corrected} usando o AAMM da chave de acesso fiscal.`
      };
    }

    return { date: corrected, corrected: false, needsReview: false };
  }

  if (!parsed) {
    return { date: "", corrected: false, needsReview: Boolean(value) };
  }

  const candidate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12));
  const futureLimit = new Date(now);
  futureLimit.setUTCHours(12, 0, 0, 0);
  futureLimit.setUTCDate(futureLimit.getUTCDate() + MAX_FUTURE_DAYS);

  const pastLimit = new Date(now);
  pastLimit.setUTCHours(12, 0, 0, 0);
  pastLimit.setUTCMonth(pastLimit.getUTCMonth() - MAX_DOCUMENT_AGE_MONTHS);

  if (candidate.getTime() > futureLimit.getTime() || candidate.getTime() < pastLimit.getTime()) {
    return {
      date: "",
      corrected: false,
      needsReview: true,
      note: `Data ${value} fora da janela segura de importacao; confirme a data antes de salvar.`
    };
  }

  return { date: value, corrected: false, needsReview: false };
}

export function getFiscalAccessKeyReferenceMonth(accessKey?: string) {
  const digits = (accessKey ?? "").replace(/\D/g, "");

  if (digits.length !== 44) {
    return undefined;
  }

  const year = 2000 + Number(digits.slice(2, 4));
  const month = Number(digits.slice(4, 6));

  if (!Number.isInteger(year) || month < 1 || month > 12) {
    return undefined;
  }

  return { year, month };
}

function parseIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!buildDate(year, month, day)) {
    return undefined;
  }

  return { year, month, day };
}

function buildDate(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) {
    return "";
  }

  const candidate = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return "";
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
