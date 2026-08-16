import type { TimeClockDraft } from "../finance/types";

const DEFAULT_WEEKDAY_EXPECTED_MINUTES = 528;

export function parseTimeClockReportText(text: string, fileName?: string): TimeClockDraft[] {
  const bestByDate = new Map<string, TimeClockDraft>();

  text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .forEach((line) => {
      const dateMatch = line.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);

      if (!dateMatch || dateMatch.index === undefined) {
        return;
      }

      const [, day, month, year] = dateMatch;
      const date = `${year}-${month}-${day}`;
      const timeMatches = Array.from(line.matchAll(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/g));
      const reportTimes = normalizeClockPunches(orderReportTimesForDateLine(timeMatches, dateMatch.index));
      const { punches, expectedMinutes } = splitReportPunchesAndExpected(reportTimes, date);

      if (punches.length === 0) {
        return;
      }

      const draft = buildTimeClockDraftFromReportLine({
        date,
        punches,
        expectedMinutes,
        line,
        fileName
      });
      const current = bestByDate.get(date);

      if (!current || draft.punches.length > current.punches.length || draft.missingFields.length < current.missingFields.length) {
        bestByDate.set(date, draft);
      }
    });

  return Array.from(bestByDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function orderReportTimesForDateLine(timeMatches: RegExpMatchArray[], dateIndex: number) {
  const times = timeMatches.map((match) => match[0]);
  const firstTimeIsBeforeDate = (timeMatches[0]?.index ?? Number.POSITIVE_INFINITY) < dateIndex;
  const looksLikeSecullumEndDateRow =
    times.length >= 5 ||
    (times.length >= 3 && times.some(isLikelyExpectedDuration) && timeToMinutes(times[times.length - 1]) <= timeToMinutes("10:30"));

  if (firstTimeIsBeforeDate && looksLikeSecullumEndDateRow) {
    const firstPunchMovedToEnd = times[times.length - 1];
    return [firstPunchMovedToEnd, ...times.slice(0, -1)];
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

  return { punches: times.slice(0, 4), expectedMinutes };
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
    `Linha lida: ${line}.`,
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
    startTime: fields.firstIn,
    endTime: fields.secondOut || orderedPunches[orderedPunches.length - 1] || "",
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
    fields.firstIn = sorted[0];
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

function normalizeClockPunches(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeClockTime(item)).filter(Boolean).slice(0, 12);
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
