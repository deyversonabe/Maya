import type { TimeClockDraft } from "../finance/types";

const DEFAULT_WEEKDAY_EXPECTED_MINUTES = 528;
const CLOCK_RE = /\b(?:[01]\d|2[0-3]):[0-5]\d\b/g;
const DATE_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;

type ReportBlock = {
  date: string;
  times: string[];
  lines: string[];
};

/**
 * Parser de fallback para texto de espelhos de ponto.
 *
 * Ele nao pressupoe que a extracao do PDF preserve as colunas da tabela:
 * aceita data+batidas na mesma linha, data seguida de varias linhas de batidas
 * e layouts em que as batidas aparecem antes da data. Cabecalhos administrativos
 * nunca sao usados como registro de jornada.
 */
export function parseTimeClockReportText(text: string, fileName?: string): TimeClockDraft[] {
  const bestByDate = new Map<string, TimeClockDraft>();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  let activeBlock: ReportBlock | null = null;
  let pendingTimes: string[] = [];
  let pendingLines: string[] = [];

  const commit = (block = activeBlock) => {
    if (!block) {
      return;
    }

    const reportTimes = normalizeClockTimes(block.times);
    const { punches, expectedMinutes } = splitReportPunchesAndExpected(reportTimes, block.date);

    if (punches.length > 0) {
      const draft = buildTimeClockDraftFromReportLine({
        date: block.date,
        punches,
        expectedMinutes,
        line: block.lines.join(" | "),
        fileName
      });
      const current = bestByDate.get(block.date);

      if (
        !current ||
        draft.punches.length > current.punches.length ||
        (draft.punches.length === current.punches.length && draft.missingFields.length < current.missingFields.length)
      ) {
        bestByDate.set(block.date, draft);
      }
    }

    if (block === activeBlock) {
      activeBlock = null;
    }
  };

  for (const line of lines) {
    if (isAdministrativeReportLine(line)) {
      continue;
    }

    const dateMatch = line.match(DATE_RE);
    const timeMatches = Array.from(line.matchAll(CLOCK_RE));

    if (dateMatch && dateMatch.index !== undefined) {
      commit();

      const [, day, month, year] = dateMatch;
      const date = `${year}-${month}-${day}`;

      if (!isValidDateKey(date)) {
        pendingTimes = [];
        pendingLines = [];
        continue;
      }

      const sameLineTimes = normalizeClockTimes(orderReportTimesForDateLine(timeMatches, dateMatch.index));

      if (sameLineTimes.length > 0) {
        activeBlock = {
          date,
          times: sameLineTimes,
          lines: [line]
        };
        pendingTimes = [];
        pendingLines = [];
        continue;
      }

      if (pendingTimes.length > 0) {
        const completedBlock: ReportBlock = {
          date,
          times: orderPendingTimesBeforeDate(pendingTimes),
          lines: [...pendingLines, line]
        };
        pendingTimes = [];
        pendingLines = [];
        commit(completedBlock);
        continue;
      }

      activeBlock = {
        date,
        times: [],
        lines: [line]
      };
      continue;
    }

    const lineTimes = normalizeClockTimes(timeMatches.map((match) => match[0]));

    if (lineTimes.length === 0) {
      continue;
    }

    if (activeBlock) {
      activeBlock.times.push(...lineTimes);
      activeBlock.lines.push(line);
    } else {
      pendingTimes = [...pendingTimes, ...lineTimes].slice(-12);
      pendingLines = [...pendingLines, line].slice(-8);
    }
  }

  commit();

  return Array.from(bestByDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function isAdministrativeReportLine(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // Comprovantes individuais de REP usam DATA/TA + HORA; isso e dado real,
  // nao cabecalho, mesmo contendo a palavra "hora".
  if (/\b(data|ta)\s*[:.-]?\s*\d{2}\/\d{2}\/\d{4}\b/.test(normalized) && /\bhora\b/.test(normalized)) {
    return false;
  }

  return /\b(periodo|emitido em|gerado em|pagina(?:\s+\d+|\s+de)|horario de trabalho|jornada prevista|empresa|cnpj|cpf|totais?|assinatura|departamento|funcao|data de emissao)\b/.test(
    normalized
  );
}

function orderReportTimesForDateLine(timeMatches: RegExpMatchArray[], dateIndex: number) {
  const times = timeMatches.map((match) => match[0]);
  const firstTimeIsBeforeDate = (timeMatches[0]?.index ?? Number.POSITIVE_INFINITY) < dateIndex;

  if (firstTimeIsBeforeDate) {
    return orderTimesBeforeDate(times);
  }

  return times;
}

/**
 * Alguns relatórios Secullum extraem a primeira entrada no fim da linha,
 * depois de carga/saldo. Ex.: 12:20 13:33 18:04 09:00 00:18 08:09 DATA.
 */
function orderPendingTimesBeforeDate(times: string[]) {
  return orderTimesBeforeDate(times);
}

function orderTimesBeforeDate(times: string[]) {
  if (times.length < 2) {
    return times;
  }

  const last = times[times.length - 1];
  const lastMinutes = timeToMinutes(last);
  const looksLikeSecullumEndDateRow =
    times.length >= 5 ||
    (times.length >= 3 && times.some(isLikelyExpectedDuration) && lastMinutes <= timeToMinutes("10:30"));

  if (Number.isFinite(lastMinutes) && lastMinutes <= timeToMinutes("10:30") && looksLikeSecullumEndDateRow) {
    return [last, ...times.slice(0, -1)];
  }

  return times;
}

function splitReportPunchesAndExpected(reportTimes: string[], date: string) {
  if (reportTimes.length === 0) {
    return { punches: [] as string[], expectedMinutes: getDefaultExpectedMinutesForDate(date) };
  }

  const times = [...reportTimes];
  const expectedMinutes = getDefaultExpectedMinutesForDate(date);
  const last = times[times.length - 1];
  const secondLast = times[times.length - 2];

  if (times.length >= 2 && isLikelyExpectedDuration(secondLast) && isLikelyMissingDuration(last)) {
    times.splice(-2, 2);
  } else if (times.length >= 3 && isLikelyExpectedDuration(last)) {
    times.splice(-1, 1);
  }

  if (times.length === 2 && isLikelyExpectedDuration(times[0]) && isLikelyExpectedDuration(times[1])) {
    return { punches: [] as string[], expectedMinutes };
  }

  return { punches: normalizeClockPunches(times).slice(0, 4), expectedMinutes };
}

function buildTimeClockDraftFromReportLine({
  date,
  punches,
  expectedMinutes,
  line,
  fileName
}: {
  date: string;
  punches: string[];
  expectedMinutes: number;
  line: string;
  fileName?: string;
}): TimeClockDraft {
  const fields = inferReportTimeClockFieldsFromPunches(punches);
  const orderedPunches = [fields.firstIn, fields.firstOut, fields.secondIn, fields.secondOut].filter(Boolean);
  const missingFields: string[] = (["firstIn", "firstOut", "secondIn", "secondOut"] as const).filter(
    (field) => !fields[field]
  );
  const hasLunchPair = Boolean(fields.firstOut && fields.secondIn && timeToMinutes(fields.secondIn) > timeToMinutes(fields.firstOut));
  const lunchMinutes = hasLunchPair ? timeToMinutes(fields.secondIn) - timeToMinutes(fields.firstOut) : 72;
  const notes = [
    fileName ? `Importado do relatorio ${fileName}.` : "Importado de relatorio de ponto.",
    `Trecho lido: ${line}.`,
    missingFields.length ? "Registro incompleto: revise os campos vazios." : ""
  ]
    .filter(Boolean)
    .join(" ");

  if (!hasLunchPair) {
    missingFields.push("lunchMinutes");
  }

  return {
    date,
    ...fields,
    startTime: fields.firstIn || "",
    endTime: fields.secondOut || "",
    lunchMinutes,
    expectedMinutes,
    confidence: missingFields.length ? 0.74 : 0.94,
    missingFields,
    punches: orderedPunches,
    notes
  };
}

function inferReportTimeClockFieldsFromPunches(punches: string[]) {
  const sorted = [...punches].sort((left, right) => timeToMinutes(left) - timeToMinutes(right));
  const fields = {
    firstIn: "",
    firstOut: "",
    secondIn: "",
    secondOut: ""
  };

  if (sorted.length >= 4) {
    return {
      firstIn: sorted[0],
      firstOut: sorted[1],
      secondIn: sorted[2],
      secondOut: sorted[3]
    };
  }

  if (sorted.length === 3) {
    fields.firstIn = sorted[0];
    fields.firstOut = sorted[1];

    if (timeToMinutes(sorted[2]) >= timeToMinutes("16:30")) {
      fields.secondOut = sorted[2];
    } else {
      fields.secondIn = sorted[2];
    }

    return fields;
  }

  if (sorted.length === 2) {
    fields.firstIn = sorted[0];

    if (timeToMinutes(sorted[1]) >= timeToMinutes("16:30")) {
      fields.secondOut = sorted[1];
    } else {
      fields.firstOut = sorted[1];
    }

    return fields;
  }

  if (sorted.length === 1) {
    const minutes = timeToMinutes(sorted[0]);

    if (minutes < timeToMinutes("10:30")) {
      fields.firstIn = sorted[0];
    } else if (minutes < timeToMinutes("13:00")) {
      fields.firstOut = sorted[0];
    } else if (minutes < timeToMinutes("16:30")) {
      fields.secondIn = sorted[0];
    } else {
      fields.secondOut = sorted[0];
    }
  }

  return fields;
}

function isLikelyExpectedDuration(value: string | undefined) {
  if (!value) {
    return false;
  }

  const minutes = timeToMinutes(value);
  return minutes >= 420 && minutes <= 600;
}

function isLikelyMissingDuration(value: string | undefined) {
  if (!value) {
    return false;
  }

  const minutes = timeToMinutes(value);
  return minutes >= 0 && minutes <= 420;
}

function normalizeClockTimes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeClockTime(item)).filter(Boolean).slice(0, 12);
}

function normalizeClockPunches(value: unknown) {
  return Array.from(new Set(normalizeClockTimes(value))).slice(0, 12);
}

function normalizeClockTime(value: unknown) {
  const raw = normalizeTimeString(value);

  if (!raw) {
    return "";
  }

  const [hours = "0", minutes = "0"] = raw.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function normalizeTimeString(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  const text = String(value);
  const match = text.match(/\b([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/);

  return match?.[0] ?? "";
}

function timeToMinutes(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return Number.NaN;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getDefaultExpectedMinutesForDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);

  if (!Number.isFinite(parsed.getTime())) {
    return DEFAULT_WEEKDAY_EXPECTED_MINUTES;
  }

  const weekday = parsed.getDay();
  return weekday >= 1 && weekday <= 5 ? DEFAULT_WEEKDAY_EXPECTED_MINUTES : 0;
}

function isValidDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
