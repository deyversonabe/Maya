"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  FileDown,
  Loader2,
  MinusCircle,
  PlusCircle,
  ScanText,
  Trash2
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { cn, financialValueClass, toInputDate } from "@/lib/utils";
import { mayaFetch } from "@/lib/api-client";
import { AttachmentLink } from "./attachment-link";
import { fileToFinanceDocumentAttachment, type FinanceDocumentAttachmentUpload } from "../lib/image-upload";
import { useFinanceStore } from "../lib/use-finance-store";
import type { Person, TimeClockDraft, WorkTimeEntry } from "../types";

const people: Person[] = ["Deyverson"];
const DEFAULT_START = "08:00";
const DEFAULT_END = "18:00";
const DEFAULT_LUNCH_MINUTES = 72;
const DEFAULT_EXPECTED_MINUTES = 528;
const weekLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const EMPTY_PUNCH_FIELDS = {
  firstIn: "",
  firstOut: "",
  secondIn: "",
  secondOut: ""
};

type TimeClockUploadResult = {
  timeClockDraft?: TimeClockDraft;
  timeClockDrafts?: TimeClockDraft[];
  message?: string;
  error?: string;
};

export function WorkHoursPage() {
  const { state, actions } = useFinanceStore();
  const pointFileRef = useRef<HTMLInputElement>(null);
  const today = toInputDate(new Date());
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedPerson, setSelectedPerson] = useState<Person>("Deyverson");
  const [selectedDate, setSelectedDate] = useState(today);
  const [feedback, setFeedback] = useState("Registre apenas horas trabalhadas. Esta aba nao altera saldos financeiros.");
  const [isReadingTimecard, setIsReadingTimecard] = useState(false);
  const [timeClockDraft, setTimeClockDraft] = useState<TimeClockDraft | null>(null);
  const [pointAttachment, setPointAttachment] = useState<FinanceDocumentAttachmentUpload | null>(null);
  const [form, setForm] = useState({
    firstIn: DEFAULT_START,
    firstOut: "",
    secondIn: "",
    secondOut: DEFAULT_END,
    expectedMinutes: String(DEFAULT_EXPECTED_MINUTES),
    notes: ""
  });

  const monthDays = useMemo(() => buildMonthDays(selectedMonth), [selectedMonth]);
  const entriesByDate = useMemo(() => {
    const map = new Map<string, WorkTimeEntry>();
    state.workTimeEntries
      .filter((entry) => entry.person === selectedPerson && entry.date.startsWith(selectedMonth))
      .forEach((entry) => map.set(entry.date, entry));
    return map;
  }, [selectedMonth, selectedPerson, state.workTimeEntries]);
  const personEntries = useMemo(
    () => state.workTimeEntries.filter((entry) => entry.person === selectedPerson),
    [selectedPerson, state.workTimeEntries]
  );
  const selectedEntry = entriesByDate.get(selectedDate);
  const summary = useMemo(() => buildMonthSummary(monthDays, entriesByDate, today), [entriesByDate, monthDays, today]);
  const weekSummary = useMemo(() => buildWeekSummary(selectedDate, personEntries), [personEntries, selectedDate]);
  const totalBalanceMinutes = useMemo(() => calculateEntriesBalance(personEntries), [personEntries]);
  const alerts = useMemo(() => buildWorkTimeAlerts(monthDays, entriesByDate, today), [entriesByDate, monthDays, today]);
  const formPunchFields = getFormPunchFields(form);
  const formWorkedMinutes = calculateWorkedMinutesFromPunchFields(formPunchFields);
  const formLunchMinutes = calculateLunchMinutesFromPunchFields(formPunchFields);
  const formExpectedMinutes = Number(form.expectedMinutes);
  const formBalance =
    formWorkedMinutes >= 0 && Number.isFinite(formExpectedMinutes) ? formWorkedMinutes - formExpectedMinutes : 0;

  function selectDate(date: string) {
    const entry = entriesByDate.get(date);
    const expectedMinutes = getExpectedMinutesForDate(date);

    setSelectedDate(date);
    setTimeClockDraft(null);
    setPointAttachment(null);
    const punchFields = getEntryPunchFields(entry);
    setForm({
      firstIn: punchFields.firstIn,
      firstOut: punchFields.firstOut,
      secondIn: punchFields.secondIn,
      secondOut: punchFields.secondOut,
      expectedMinutes: String(entry?.expectedMinutes ?? expectedMinutes),
      notes: entry?.notes ?? ""
    });
  }

  async function handleTimecardUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    setIsReadingTimecard(true);
    setFeedback("MAYA esta lendo o ponto. Ela vai ignorar dados desnecessarios e procurar data/horarios.");

    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const attachment = await fileToFinanceDocumentAttachment(file);
      setPointAttachment(attachment);

      const response = await mayaFetch("/api/maya/timecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: attachment.imageDataUrl,
          fileDataUrl: isPdf ? attachment.fileDataUrl : undefined,
          mimeType: file.type,
          fileName: attachment.fileName,
          targetDate: selectedDate
        })
      });

      const result = (await response.json()) as TimeClockUploadResult;
      const drafts = result.timeClockDrafts?.length
        ? result.timeClockDrafts
        : result.timeClockDraft
          ? [result.timeClockDraft]
          : [];

      if (!response.ok || drafts.length === 0) {
        throw new Error(result.error || "timecard_read_failed");
      }

      if (isPdf || drafts.length > 1) {
        const imported = importTimeClockDrafts(drafts, attachment.fileName, attachment);
        setFeedback(
          result.message ||
            `${imported} dia(s) importado(s) para o calendario. Clique em qualquer dia para editar antes ou depois de salvar.`
        );
      } else {
        applyTimeClockDraft(drafts[0], attachment.fileName);
        setFeedback(result.message || "MAYA preencheu o ponto. Revise antes de salvar.");
      }
    } catch {
      setFeedback("Nao consegui ler o ponto agora. O arquivo pode ser conferido manualmente e os horarios continuam editaveis.");
    } finally {
      setIsReadingTimecard(false);
      if (pointFileRef.current) {
        pointFileRef.current.value = "";
      }
    }
  }

  function importTimeClockDrafts(
    drafts: TimeClockDraft[],
    fileName: string,
    attachment: FinanceDocumentAttachmentUpload | null
  ) {
    const validDrafts = drafts.filter((draft) => draft.date && draft.punches.length > 0);

    validDrafts.forEach((draft) => {
      actions.upsertWorkTimeEntry(buildWorkTimeEntryFromDraft(draft, fileName, attachment));
    });

    const firstDraft = validDrafts[0];

    if (firstDraft) {
      const draftDate = firstDraft.date;
      const entry = buildWorkTimeEntryFromDraft(firstDraft, fileName, attachment);
      const punchFields = getEntryPunchFields(entry);

      setTimeClockDraft(firstDraft);
      setSelectedDate(draftDate);
      setSelectedMonth(draftDate.slice(0, 7));
      setForm({
        firstIn: punchFields.firstIn,
        firstOut: punchFields.firstOut,
        secondIn: punchFields.secondIn,
        secondOut: punchFields.secondOut,
        expectedMinutes: String(entry.expectedMinutes),
        notes: entry.notes ?? ""
      });
    }

    return validDrafts.length;
  }

  function buildWorkTimeEntryFromDraft(
    draft: TimeClockDraft,
    fileName: string,
    attachment: FinanceDocumentAttachmentUpload | null
  ): Omit<WorkTimeEntry, "id" | "createdAt" | "updatedAt"> {
    const draftDate = draft.date || selectedDate;
    const existingForDraft = state.workTimeEntries.find((entry) => entry.person === selectedPerson && entry.date === draftDate);
    const punchFields = mergeTimeClockDraftIntoPunchFields(
      draft,
      existingForDraft ? getEntryPunchFields(existingForDraft) : EMPTY_PUNCH_FIELDS
    );
    const lunchMinutes = calculateLunchMinutesFromPunchFields(punchFields);
    const punches = [punchFields.firstIn, punchFields.firstOut, punchFields.secondIn, punchFields.secondOut].filter(isValidTime);

    return {
      person: selectedPerson,
      date: draftDate,
      firstIn: punchFields.firstIn,
      firstOut: punchFields.firstOut,
      secondIn: punchFields.secondIn,
      secondOut: punchFields.secondOut,
      punches,
      startTime: punchFields.firstIn || draft.startTime || punches[0] || "",
      endTime: punchFields.secondOut || draft.endTime || punches[punches.length - 1] || "",
      lunchMinutes: Number.isFinite(lunchMinutes) && lunchMinutes >= 0 ? lunchMinutes : draft.lunchMinutes ?? DEFAULT_LUNCH_MINUTES,
      expectedMinutes: draft.expectedMinutes ?? getExpectedMinutesForDate(draftDate),
      notes: [
        draft.notes,
        draft.punches.length ? `Batidas lidas: ${draft.punches.join(", ")}.` : "",
        draft.missingFields.length ? `Campos para conferir: ${draft.missingFields.join(", ")}.` : "",
        `Arquivo de origem: ${fileName}.`
      ]
        .filter(Boolean)
        .join(" "),
      attachmentImageName: attachment?.fileName ?? existingForDraft?.attachmentImageName,
      attachmentDataUrl: attachment?.storagePath
        ? existingForDraft?.attachmentDataUrl
        : attachment?.imageDataUrl ?? attachment?.fileDataUrl ?? existingForDraft?.attachmentDataUrl,
      attachmentStoragePath: attachment?.storagePath ?? existingForDraft?.attachmentStoragePath,
      attachmentMimeType: attachment?.mimeType ?? existingForDraft?.attachmentMimeType,
      attachmentSize: attachment?.size ?? existingForDraft?.attachmentSize
    };
  }

  function applyTimeClockDraft(draft: TimeClockDraft, fileName: string) {
    const draftDate = draft.date || selectedDate;
    const expectedMinutes = draft.expectedMinutes ?? getExpectedMinutesForDate(draftDate);
    const existingForDraft = entriesByDate.get(draftDate);
    const punchFields = mergeTimeClockDraftIntoPunchFields(draft, getEntryPunchFields(existingForDraft));
    const lunchMinutes = calculateLunchMinutesFromPunchFields(punchFields);

    setTimeClockDraft(draft);
    setSelectedDate(draftDate);
    setSelectedMonth(draftDate.slice(0, 7));
    setForm({
      firstIn: punchFields.firstIn,
      firstOut: punchFields.firstOut,
      secondIn: punchFields.secondIn,
      secondOut: punchFields.secondOut,
      expectedMinutes: String(expectedMinutes),
      notes: [
        draft.notes,
        draft.punches.length ? `Batidas lidas: ${draft.punches.join(", ")}.` : "",
        Number.isFinite(lunchMinutes) && lunchMinutes > 0 ? `Intervalo calculado: ${formatDuration(lunchMinutes)}.` : "",
        draft.missingFields.length ? `Campos para conferir: ${draft.missingFields.join(", ")}.` : "",
        `Anexo do ponto: ${fileName}.`
      ]
        .filter(Boolean)
        .join(" ")
    });
  }

  function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const expectedMinutes = Number(form.expectedMinutes);
    const punchFields = getFormPunchFields(form);
    const lunchMinutes = calculateLunchMinutesFromPunchFields(punchFields);
    const workedMinutes = calculateWorkedMinutesFromPunchFields(punchFields);

    if (!arePunchFieldsComplete(punchFields)) {
      setFeedback("Preencha as 4 batidas do dia: entrada, saida para almoco, retorno e saida final.");
      return;
    }

    if (workedMinutes < 0 || lunchMinutes < 0) {
      setFeedback("Confira a ordem dos horarios. Cada saida precisa ser maior que a entrada correspondente.");
      return;
    }

    if (!Number.isFinite(expectedMinutes) || expectedMinutes < 0 || expectedMinutes > 720) {
      setFeedback("Informe a carga esperada do dia em minutos, entre 0 e 720.");
      return;
    }

    actions.upsertWorkTimeEntry({
      person: selectedPerson,
      date: selectedDate,
      firstIn: punchFields.firstIn,
      firstOut: punchFields.firstOut,
      secondIn: punchFields.secondIn,
      secondOut: punchFields.secondOut,
      punches: [punchFields.firstIn, punchFields.firstOut, punchFields.secondIn, punchFields.secondOut],
      startTime: punchFields.firstIn,
      endTime: punchFields.secondOut,
      lunchMinutes,
      expectedMinutes: Math.round(expectedMinutes),
      notes: form.notes.trim() || undefined,
      attachmentImageName: pointAttachment?.fileName ?? selectedEntry?.attachmentImageName,
      attachmentDataUrl: pointAttachment?.storagePath
        ? selectedEntry?.attachmentDataUrl
        : pointAttachment?.imageDataUrl ?? pointAttachment?.fileDataUrl ?? selectedEntry?.attachmentDataUrl,
      attachmentStoragePath: pointAttachment?.storagePath ?? selectedEntry?.attachmentStoragePath,
      attachmentMimeType: pointAttachment?.mimeType ?? selectedEntry?.attachmentMimeType,
      attachmentSize: pointAttachment?.size ?? selectedEntry?.attachmentSize
    });

    const balance = workedMinutes - Math.round(expectedMinutes);
    setFeedback(`Ponto de ${formatDate(selectedDate)} salvo com saldo ${formatSignedDuration(balance)}.`);
  }

  function removeSelectedEntry() {
    if (!selectedEntry) {
      return;
    }

    actions.removeWorkTimeEntry(selectedEntry.id);
    setFeedback(`Registro de ${formatDate(selectedDate)} removido.`);
  }

  async function exportMonthPdf() {
    await exportWorkHoursPdf({
      month: selectedMonth,
      person: selectedPerson,
      days: monthDays,
      entriesByDate,
      summary,
      alerts,
      today
    });
  }

  return (
    <AppShell>
      <LedPanel className="mb-4 p-5" glow="cyan">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
          <div>
            <p className="eyebrow">Horas trabalhadas</p>
            <h1 className="mt-2 max-w-4xl font-serif text-3xl font-bold leading-tight text-bronze sm:text-4xl">
              Calendario mensal de ponto sem misturar com financeiro.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Padrao configurado: segunda a sexta, das 08:00 as 18:00, com 1h12 de almoco. Sabado e domingo sao folga
              e nao geram falta automatica.
            </p>
          </div>

          <div className="rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Saldo do mes registrado</p>
            <strong className={cn("mt-2 block font-serif text-4xl", financialValueClass(summary.balanceMinutes, "text-cyan-50"))}>
              {formatSignedDuration(summary.balanceMinutes)}
            </strong>
            <p className="mt-2 text-sm text-muted">
              {summary.recordedDays} dia(s) registrado(s), {summary.missingDays} dia(s) uteis sem registro e{" "}
              {summary.offDays} folga(s) no mes.
            </p>
          </div>
        </div>
      </LedPanel>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
        <Label>
          Mes
          <Input
            type="month"
            value={selectedMonth}
            onChange={(event) => {
              setSelectedMonth(event.target.value);
              selectDate(`${event.target.value}-01`);
            }}
          />
        </Label>
        <Label>
          Pessoa
          <Select value={selectedPerson} onChange={(event) => setSelectedPerson(event.target.value as Person)}>
            {people.map((person) => (
              <option key={person} value={person}>
                {person}
              </option>
            ))}
          </Select>
        </Label>
        <div className="rounded-card border border-bronze/20 bg-bronze/10 p-3 text-sm font-bold text-bronze">
          {feedback}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <Metric title="Trabalhado" value={formatDuration(summary.workedMinutes)} icon={Clock3} />
        <Metric title="Esperado" value={formatDuration(summary.expectedMinutes)} icon={CalendarDays} />
        <Metric title="Completos" value={String(summary.completedDays)} icon={CheckCircle2} />
        <Metric title="Sobra" value={formatDuration(summary.positiveMinutes)} icon={PlusCircle} />
        <Metric title="Devendo" value={formatDuration(summary.negativeMinutes)} icon={MinusCircle} negative />
        <Metric
          title="Semana"
          value={formatSignedDuration(weekSummary.balanceMinutes)}
          icon={CalendarDays}
          negative={weekSummary.balanceMinutes < 0}
        />
        <Metric
          title="Banco total"
          value={formatSignedDuration(totalBalanceMinutes)}
          icon={Clock3}
          negative={totalBalanceMinutes < 0}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader
            eyebrow="Calendario"
            title={formatMonthTitle(selectedMonth)}
            action={
              <Button variant="secondary" onClick={() => void exportMonthPdf()}>
                <FileDown className="size-4" aria-hidden="true" />
                PDF
              </Button>
            }
          />
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-black uppercase tracking-[0.08em] text-muted">
            {weekLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
            {Array.from({ length: getMonthStartOffset(selectedMonth) }).map((_, index) => (
              <span key={`blank-${index}`} className="min-h-24 rounded-xl border border-transparent" />
            ))}
            {monthDays.map((day) => {
              const entry = entriesByDate.get(day.date);
              const expected = getExpectedMinutesForDate(day.date);
              const worked = entry ? calculateWorkedMinutesFromEntry(entry) : 0;
              const balance = entry ? worked - entry.expectedMinutes : 0;
              const isSelected = day.date === selectedDate;
              const isPastWorkdayWithoutEntry = !entry && expected > 0 && day.date <= today;
              const status = getDayStatus(day.date, entry, today);

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => selectDate(day.date)}
                  className={cn(
                    "min-h-28 rounded-xl border p-2 text-left transition focus:outline-none focus:ring-4 focus:ring-neon-cyan/25",
                    isSelected
                      ? "border-neon-cyan/60 bg-neon-cyan/15 shadow-neon"
                      : "border-cream/10 bg-cream/[0.04] hover:border-neon-cyan/35 hover:bg-neon-cyan/10",
                    entry && balance < 0 && "border-alert-red/35 bg-alert-red/10",
                    entry && balance > 0 && "border-neon-green/30 bg-neon-green/10",
                    status.tone === "off" && "border-cream/5 bg-cream/[0.025]"
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong className="text-sm text-cream">{day.day}</strong>
                    {entry ? (
                      <span className={cn("text-xs font-black", financialValueClass(balance, "text-neon-green"))}>
                        {formatSignedDuration(balance)}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-2 block text-[0.68rem] font-bold text-muted">
                    {expected > 0 ? `Meta ${formatDuration(expected)}` : "Folga"}
                  </span>
                  <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.62rem] font-black", status.className)}>
                    {status.label}
                  </span>
                  {entry ? (
                    <span className="mt-1 block text-[0.68rem] font-bold text-cyan-50">
                      {formatEntryPunches(entry)}
                    </span>
                  ) : isPastWorkdayWithoutEntry ? (
                    <span className="mt-1 block text-[0.68rem] font-black text-amber-100">Sem registro</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {alerts.length ? (
            <div className="mt-4 rounded-2xl border border-neon-amber/25 bg-neon-amber/10 p-3">
              <div className="flex items-center gap-2 text-sm font-black text-bronze">
                <AlertTriangle className="size-4" aria-hidden="true" />
                Pontos para conferir
              </div>
              <ul className="mt-2 grid gap-1 text-sm leading-6 text-muted">
                {alerts.slice(0, 6).map((alert) => (
                  <li key={alert}>{alert}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-neon-green/20 bg-neon-green/10 p-3 text-sm font-bold text-green-100">
              Nenhum alerta de ponto no mes selecionado.
            </div>
          )}
        </Card>

        <Card>
          <CardHeader eyebrow="Registro diario" title={formatDate(selectedDate)} />
          <div className="mb-4 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => pointFileRef.current?.click()} disabled={isReadingTimecard}>
                {isReadingTimecard ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Camera className="size-4" aria-hidden="true" />
                )}
                {isReadingTimecard ? "Lendo ponto..." : "Ler foto/PDF"}
              </Button>
              {timeClockDraft ? (
                <Badge tone={timeClockDraft.missingFields.length ? "warning" : "success"}>
                  Confianca {Math.round(timeClockDraft.confidence * 100)}%
                </Badge>
              ) : null}
            </div>
            <input
              ref={pointFileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(event) => void handleTimecardUpload(event.target.files?.[0])}
            />
            <p className="mt-3 text-sm leading-6 text-muted">
              Envie uma foto do papel de ponto ou um relatorio em PDF. A MAYA procura data e batidas de entrada/saida,
              ignora informacoes administrativas e mantem os registros editaveis no calendario.
            </p>
            {pointAttachment || selectedEntry?.attachmentImageName ? (
              <AttachmentLink
                dataUrl={
                  pointAttachment?.storagePath
                    ? undefined
                    : pointAttachment?.imageDataUrl ?? pointAttachment?.fileDataUrl ?? selectedEntry?.attachmentDataUrl
                }
                storagePath={pointAttachment?.storagePath ?? selectedEntry?.attachmentStoragePath}
                imageName={pointAttachment?.fileName ?? selectedEntry?.attachmentImageName}
              />
            ) : null}
          </div>
          <form className="grid gap-3" onSubmit={submitEntry}>
            <Label>
              Data
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  const date = event.target.value;
                  if (date) {
                    setSelectedDate(date);
                    setSelectedMonth(date.slice(0, 7));
                    selectDate(date);
                  }
                }}
              />
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Label>
                1. Entrada
                <Input
                  type="time"
                  value={form.firstIn}
                  onChange={(event) => setForm((current) => ({ ...current, firstIn: event.target.value }))}
                />
              </Label>
              <Label>
                2. Saida almoco
                <Input
                  type="time"
                  value={form.firstOut}
                  onChange={(event) => setForm((current) => ({ ...current, firstOut: event.target.value }))}
                />
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Label>
                3. Retorno almoco
                <Input
                  type="time"
                  value={form.secondIn}
                  onChange={(event) => setForm((current) => ({ ...current, secondIn: event.target.value }))}
                />
              </Label>
              <Label>
                4. Saida final
                <Input
                  type="time"
                  value={form.secondOut}
                  onChange={(event) => setForm((current) => ({ ...current, secondOut: event.target.value }))}
                />
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Label>
                Intervalo calculado
                <Input value={formatDuration(formLunchMinutes)} readOnly />
              </Label>
              <Label>
                Carga esperada
                <Input
                  inputMode="numeric"
                  value={form.expectedMinutes}
                  onChange={(event) => setForm((current) => ({ ...current, expectedMinutes: event.target.value }))}
                />
              </Label>
            </div>

            <div className="rounded-2xl border border-cream/10 bg-cream/[0.04] p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Previa do dia</p>
              <strong
                className={cn(
                  "mt-1 block font-serif text-2xl",
                  financialValueClass(
                    formBalance,
                    "text-cyan-50"
                  )
                )}
              >
                {formatSignedDuration(formBalance)}
              </strong>
              <p className="mt-1 text-sm text-muted">
                Trabalhado: {formatDuration(formWorkedMinutes)}
              </p>
            </div>

            {timeClockDraft ? (
              <div className="rounded-2xl border border-neon-amber/20 bg-neon-amber/10 p-3">
                <div className="flex items-center gap-2 text-sm font-black text-bronze">
                  <ScanText className="size-4" aria-hidden="true" />
                  Rascunho lido pela MAYA
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Batidas encontradas: {timeClockDraft.punches.length ? timeClockDraft.punches.join(", ") : "nao identificadas"}.
                  {timeClockDraft.missingFields.length
                    ? ` Confira manualmente: ${timeClockDraft.missingFields.join(", ")}.`
                    : " Campos principais preenchidos."}
                </p>
              </div>
            ) : null}

            <Label>
              Observacoes
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Ex.: sai mais tarde, consulta, banco de horas..."
              />
            </Label>

            <div className="flex flex-wrap gap-2">
              <Button type="submit">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Salvar dia
              </Button>
              {selectedEntry ? (
                <Button type="button" variant="danger" onClick={removeSelectedEntry}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remover
                </Button>
              ) : null}
            </div>
          </form>

          <div className="mt-4 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 p-3">
            <Badge tone="info">Padrao: 08:00-18:00 com 1h12 de almoco</Badge>
            <p className="mt-3 text-sm leading-6 text-muted">
              Em dias uteis a carga esperada padrao e 8h48. Finais de semana entram como folga, mas se voce registrar
              horas neles, o saldo aparece como sobra.
            </p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  negative = false
}: {
  title: string;
  value: string;
  icon: typeof Clock3;
  negative?: boolean;
}) {
  return (
    <div className="rounded-card border border-cream/10 bg-cream/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">{title}</p>
        <span className="grid size-10 place-items-center rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 text-cyan-100">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <strong className={cn("mt-3 block font-serif text-2xl", negative ? "text-red-100" : "text-bronze")}>
        {value}
      </strong>
    </div>
  );
}

function calculateEntryBalance(entry: WorkTimeEntry) {
  return calculateWorkedMinutesFromEntry(entry) - entry.expectedMinutes;
}

function calculateEntriesBalance(entries: WorkTimeEntry[]) {
  return entries.reduce((total, entry) => total + calculateEntryBalance(entry), 0);
}

function buildWeekSummary(selectedDate: string, entries: WorkTimeEntry[]) {
  const selected = new Date(`${selectedDate}T12:00:00`);
  const weekday = selected.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(selected);
  monday.setDate(selected.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const start = toInputDate(monday);
  const end = toInputDate(sunday);
  const weekEntries = entries.filter((entry) => entry.date >= start && entry.date <= end);

  return {
    start,
    end,
    balanceMinutes: calculateEntriesBalance(weekEntries),
    recordedDays: weekEntries.length
  };
}

function buildWorkTimeAlerts(days: Array<{ date: string }>, entriesByDate: Map<string, WorkTimeEntry>, today: string) {
  const alerts: string[] = [];
  const missingWorkdays = days.filter(
    (day) => !entriesByDate.has(day.date) && getExpectedMinutesForDate(day.date) > 0 && day.date <= today
  );
  const weekendEntries = days.filter((day) => entriesByDate.has(day.date) && getExpectedMinutesForDate(day.date) === 0);
  const longLunches: string[] = [];
  const shortLunches: string[] = [];
  const negativeDays: string[] = [];
  const longDays: string[] = [];

  entriesByDate.forEach((entry) => {
    const worked = calculateWorkedMinutesFromEntry(entry);
    const balance = worked - entry.expectedMinutes;

    if (entry.lunchMinutes > 120) {
      longLunches.push(entry.date);
    }

    if (entry.lunchMinutes < 30 && entry.expectedMinutes > 0) {
      shortLunches.push(entry.date);
    }

    if (balance < -60) {
      negativeDays.push(`${formatDate(entry.date)} (${formatSignedDuration(balance)})`);
    }

    if (worked > 600) {
      longDays.push(`${formatDate(entry.date)} (${formatDuration(worked)})`);
    }
  });

  if (missingWorkdays.length > 0) {
    alerts.push(`${missingWorkdays.length} dia(s) util(eis) sem registro ate hoje.`);
  }

  if (weekendEntries.length > 0) {
    alerts.push(`${weekendEntries.length} registro(s) em sabado/domingo. Eles contam como sobra, porque fim de semana e folga.`);
  }

  if (negativeDays.length > 0) {
    alerts.push(`Saldo negativo maior que 1h em: ${negativeDays.slice(0, 3).join(", ")}.`);
  }

  if (longDays.length > 0) {
    alerts.push(`Jornada acima de 10h em: ${longDays.slice(0, 3).join(", ")}.`);
  }

  if (shortLunches.length > 0) {
    alerts.push(`Almoco menor que 30 min em ${shortLunches.length} dia(s). Confira se a leitura ficou correta.`);
  }

  if (longLunches.length > 0) {
    alerts.push(`Almoco maior que 2h em ${longLunches.length} dia(s). Confira se o intervalo foi lido corretamente.`);
  }

  return alerts;
}

function getDayStatus(date: string, entry: WorkTimeEntry | undefined, today: string) {
  const expected = getExpectedMinutesForDate(date);

  if (entry) {
    const balance = calculateEntryBalance(entry);

    if (balance === 0) {
      return { label: "Completo", tone: "success", className: "bg-neon-green/15 text-green-100" };
    }

    if (balance > 0) {
      return { label: "Sobrando", tone: "positive", className: "bg-neon-cyan/15 text-cyan-100" };
    }

    return { label: "Devendo", tone: "negative", className: "bg-alert-red/15 text-red-100" };
  }

  if (expected === 0) {
    return { label: "Folga", tone: "off", className: "bg-cream/10 text-muted" };
  }

  if (date > today) {
    return { label: "Aguardando", tone: "future", className: "bg-bronze/10 text-bronze" };
  }

  return { label: "Sem registro", tone: "warning", className: "bg-neon-amber/15 text-amber-100" };
}

async function exportWorkHoursPdf({
  month,
  person,
  days,
  entriesByDate,
  summary,
  alerts,
  today
}: {
  month: string;
  person: Person;
  days: Array<{ date: string; day: number }>;
  entriesByDate: Map<string, WorkTimeEntry>;
  summary: ReturnType<typeof buildMonthSummary>;
  alerts: string[];
  today: string;
}) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFillColor(8, 22, 15);
  doc.rect(0, 0, 595, 842, "F");
  doc.setTextColor(255, 245, 233);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Maya - Relatorio de horas", 40, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Pessoa: ${person}`, 40, 68);
  doc.text(`Mes: ${formatMonthTitle(month)}`, 40, 84);
  doc.text("Sabado e domingo considerados folga.", 40, 100);

  autoTable(doc, {
    startY: 122,
    head: [["Resumo", "Valor"]],
    body: [
      ["Trabalhado", formatDuration(summary.workedMinutes)],
      ["Esperado", formatDuration(summary.expectedMinutes)],
      ["Saldo do mes", formatSignedDuration(summary.balanceMinutes)],
      ["Sobra", formatDuration(summary.positiveMinutes)],
      ["Devendo", formatDuration(summary.negativeMinutes)],
      ["Dias completos", String(summary.completedDays)],
      ["Dias uteis sem registro", String(summary.missingDays)],
      ["Folgas no mes", String(summary.offDays)]
    ],
    theme: "grid",
    headStyles: { fillColor: [184, 121, 69], textColor: [8, 22, 15] },
    bodyStyles: { fillColor: [16, 33, 24], textColor: [255, 245, 233] },
    alternateRowStyles: { fillColor: [31, 48, 38] },
    styles: { lineColor: [85, 247, 255], lineWidth: 0.25 }
  });

  autoTable(doc, {
    startY: Math.min(((doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 122) + 26, 420),
    head: [["Data", "Status", "Entrada 1", "Saida almoco", "Retorno", "Saida final", "Almoco", "Trabalhado", "Esperado", "Saldo"]],
    body: days.map((day) => {
      const entry = entriesByDate.get(day.date);
      const status = getDayStatus(day.date, entry, today);
      const worked = entry ? calculateWorkedMinutesFromEntry(entry) : 0;
      const expected = entry?.expectedMinutes ?? getExpectedMinutesForDate(day.date);
      const punchFields = getEntryPunchFields(entry);

      return [
        formatDate(day.date),
        status.label,
        punchFields.firstIn,
        punchFields.firstOut,
        punchFields.secondIn,
        punchFields.secondOut,
        entry ? formatDuration(entry.lunchMinutes) : "",
        entry ? formatDuration(worked) : "",
        formatDuration(expected),
        entry ? formatSignedDuration(worked - expected) : ""
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: [85, 247, 255], textColor: [8, 22, 15] },
    bodyStyles: { fillColor: [16, 33, 24], textColor: [255, 245, 233], fontSize: 8 },
    alternateRowStyles: { fillColor: [31, 48, 38] },
    styles: { lineColor: [255, 245, 233], lineWidth: 0.15 }
  });

  if (alerts.length > 0) {
    autoTable(doc, {
      startY: Math.min(((doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 420) + 26, 720),
      head: [["Alertas de conferencia"]],
      body: alerts.map((alert) => [alert]),
      theme: "grid",
      headStyles: { fillColor: [255, 210, 122], textColor: [8, 22, 15] },
      bodyStyles: { fillColor: [16, 33, 24], textColor: [255, 245, 233], fontSize: 8 },
      styles: { lineColor: [255, 245, 233], lineWidth: 0.15 }
    });
  }

  doc.save(`maya-horas-${person.toLowerCase()}-${month}.pdf`);
}

function buildMonthDays(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const totalDays = new Date(year, monthIndex, 0).getDate();

  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return { date, day };
  });
}

function getMonthStartOffset(month: string) {
  return new Date(`${month}-01T12:00:00`).getDay();
}

function getExpectedMinutesForDate(date: string) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return weekday >= 1 && weekday <= 5 ? DEFAULT_EXPECTED_MINUTES : 0;
}

function buildMonthSummary(days: Array<{ date: string }>, entriesByDate: Map<string, WorkTimeEntry>, today: string) {
  return days.reduce(
    (summary, day) => {
      const entry = entriesByDate.get(day.date);
      const expectedDefault = getExpectedMinutesForDate(day.date);

      if (expectedDefault === 0) {
        summary.offDays += 1;
      }

      if (!entry) {
        if (expectedDefault > 0 && day.date <= today) {
          summary.missingDays += 1;
        }
        return summary;
      }

      const worked = calculateWorkedMinutesFromEntry(entry);
      const balance = worked - entry.expectedMinutes;

      summary.recordedDays += 1;
      summary.workedMinutes += worked;
      summary.expectedMinutes += entry.expectedMinutes;
      summary.balanceMinutes += balance;

      if (balance === 0) {
        summary.completedDays += 1;
      } else if (balance > 0) {
        summary.positiveMinutes += balance;
      } else {
        summary.negativeMinutes += Math.abs(balance);
      }

      return summary;
    },
    {
      recordedDays: 0,
      missingDays: 0,
      completedDays: 0,
      workedMinutes: 0,
      expectedMinutes: 0,
      balanceMinutes: 0,
      positiveMinutes: 0,
      negativeMinutes: 0,
      offDays: 0
    }
  );
}

type PunchFields = {
  firstIn: string;
  firstOut: string;
  secondIn: string;
  secondOut: string;
};

function getFormPunchFields(form: PunchFields): PunchFields {
  return {
    firstIn: form.firstIn,
    firstOut: form.firstOut,
    secondIn: form.secondIn,
    secondOut: form.secondOut
  };
}

function getEntryPunchFields(entry: Partial<WorkTimeEntry> | undefined): PunchFields {
  if (!entry) {
    return {
      firstIn: DEFAULT_START,
      firstOut: "",
      secondIn: "",
      secondOut: DEFAULT_END
    };
  }

  const hasExplicitFields = Boolean(entry.firstIn || entry.firstOut || entry.secondIn || entry.secondOut);

  if (hasExplicitFields) {
    return {
      firstIn: entry.firstIn || "",
      firstOut: entry.firstOut || "",
      secondIn: entry.secondIn || "",
      secondOut: entry.secondOut || ""
    };
  }

  const punches = normalizePunches(entry?.punches ?? []);

  return {
    firstIn: punches[0] || entry.startTime || DEFAULT_START,
    firstOut: punches[1] || "",
    secondIn: punches[2] || "",
    secondOut: punches[3] || entry.endTime || DEFAULT_END
  };
}

function mergeTimeClockDraftIntoPunchFields(draft: TimeClockDraft, base: PunchFields): PunchFields {
  const explicitFields: PunchFields = {
    firstIn: draft.firstIn || "",
    firstOut: draft.firstOut || "",
    secondIn: draft.secondIn || "",
    secondOut: draft.secondOut || ""
  };

  if (arePunchFieldsComplete(explicitFields)) {
    return explicitFields;
  }

  if (Object.values(explicitFields).some(isValidTime)) {
    return {
      firstIn: explicitFields.firstIn || base.firstIn,
      firstOut: explicitFields.firstOut || base.firstOut,
      secondIn: explicitFields.secondIn || base.secondIn,
      secondOut: explicitFields.secondOut || base.secondOut
    };
  }

  const punches = normalizePunches([
    explicitFields.firstIn,
    explicitFields.firstOut,
    explicitFields.secondIn,
    explicitFields.secondOut,
    ...(draft.punches ?? [])
  ]);

  // Relatorios e fotos de ponto podem vir com 1 a 4 batidas. A ordem cronologica e mais confiavel
  // que "adivinhar" o slot por faixa de hora quando ha escala ou atraso.
  return {
    firstIn: punches[0] || (isValidTime(draft.startTime || "") ? draft.startTime || "" : base.firstIn),
    firstOut: punches[1] || base.firstOut,
    secondIn: punches[2] || base.secondIn,
    secondOut: punches[3] || (isValidTime(draft.endTime || "") ? draft.endTime || "" : base.secondOut)
  };
}

function normalizePunches(values: string[]) {
  return Array.from(new Set(values.filter(isValidTime))).sort((left, right) => timeToMinutes(left) - timeToMinutes(right));
}

function arePunchFieldsComplete(fields: PunchFields) {
  return Object.values(fields).every(isValidTime);
}

function calculateWorkedMinutesFromEntry(entry: WorkTimeEntry) {
  const fields = getEntryPunchFields(entry);
  const worked = calculateWorkedMinutesFromPunchFields(fields);

  if ((!fields.firstOut || !fields.secondIn) && isValidTime(fields.firstIn) && isValidTime(fields.secondOut)) {
    const legacyRange = calculateTimeRange(fields.firstIn, fields.secondOut);
    return legacyRange > 0 ? Math.max(0, legacyRange - Math.max(0, Math.round(entry.lunchMinutes))) : worked;
  }

  return worked;
}

function calculateWorkedMinutesFromPunchFields(fields: PunchFields) {
  if (!arePunchFieldsComplete(fields)) {
    return 0;
  }

  const firstBlock = calculateTimeRange(fields.firstIn, fields.firstOut);
  const secondBlock = calculateTimeRange(fields.secondIn, fields.secondOut);

  if (firstBlock < 0 || secondBlock < 0) {
    return -1;
  }

  return firstBlock + secondBlock;
}

function calculateLunchMinutesFromPunchFields(fields: PunchFields) {
  if (!isValidTime(fields.firstOut) || !isValidTime(fields.secondIn)) {
    return DEFAULT_LUNCH_MINUTES;
  }

  return calculateTimeRange(fields.firstOut, fields.secondIn);
}

function calculateTimeRange(startTime: string, endTime: string) {
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return 0;
  }

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  return end > start ? end - start : -1;
}

function formatEntryPunches(entry: WorkTimeEntry) {
  const fields = getEntryPunchFields(entry);
  return [fields.firstIn, fields.firstOut, fields.secondIn, fields.secondOut].filter(Boolean).join(" / ");
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function formatDuration(minutes: number) {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${hours}h${String(remainingMinutes).padStart(2, "0")}`;
}

function formatSignedDuration(minutes: number) {
  if (!Number.isFinite(minutes)) {
    return "0h00";
  }

  if (minutes === 0) {
    return "0h00";
  }

  const sign = minutes > 0 ? "+" : "-";
  return `${sign}${formatDuration(Math.abs(minutes))}`;
}

function formatMonthTitle(month: string) {
  const date = new Date(`${month}-01T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}
