"use client";

import { useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  FileText,
  Landmark,
  type LucideIcon,
  Paperclip,
  Plus,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { cn, financialValueClass, formatCurrency, getCurrentMonthKey, parseFinancialAmountInput, toInputDate } from "@/lib/utils";
import { fileToFinanceAttachment, type FinanceAttachmentUpload } from "../lib/image-upload";
import { useFinanceStore } from "../lib/use-finance-store";
import type { LaborBenefitType, PayrollRecordStatus, Person, TaxDocumentKind, TaxDocumentStatus } from "../types";
import { AttachmentLink } from "./attachment-link";

type PersonFilter = Person | "Todos";

const taxDocumentKinds: Array<{ value: TaxDocumentKind; label: string }> = [
  { value: "income_report", label: "Informe de rendimento" },
  { value: "business_income", label: "Renda variavel/profissional" },
  { value: "medical_receipt", label: "Saude" },
  { value: "education_receipt", label: "Educacao" },
  { value: "bank_balance", label: "Saldo bancario" },
  { value: "investment", label: "Investimento" },
  { value: "asset", label: "Bem/direito" },
  { value: "property", label: "Imovel" },
  { value: "vehicle", label: "Veiculo" },
  { value: "debt", label: "Divida/financiamento" },
  { value: "dependent", label: "Dependente" },
  { value: "other", label: "Outro" }
];

const taxStatuses: Array<{ value: TaxDocumentStatus; label: string }> = [
  { value: "pending", label: "Pendente" },
  { value: "reviewed", label: "Conferido" },
  { value: "ready", label: "Pronto" }
];

const laborBenefitTypes: Array<{ value: LaborBenefitType; label: string }> = [
  { value: "fgts", label: "FGTS" },
  { value: "inss", label: "INSS" },
  { value: "salary", label: "Salario" },
  { value: "thirteenth_salary", label: "13 salario" },
  { value: "vacation", label: "Ferias" },
  { value: "benefit", label: "Beneficio" },
  { value: "other", label: "Outro" }
];

const payrollStatuses: Array<{ value: PayrollRecordStatus; label: string }> = [
  { value: "pending_review", label: "Pendente" },
  { value: "reviewed", label: "Conferido" },
  { value: "attention", label: "Atencao" }
];

const people: Person[] = ["Deyverson", "Tom", "Casal"];
const cltPeople: Person[] = ["Deyverson"];

const taxKindLabels = Object.fromEntries(taxDocumentKinds.map((kind) => [kind.value, kind.label])) as Record<
  TaxDocumentKind,
  string
>;

const laborTypeLabels = Object.fromEntries(laborBenefitTypes.map((kind) => [kind.value, kind.label])) as Record<
  LaborBenefitType,
  string
>;

export function FiscalToolsPage() {
  const { state, actions } = useFinanceStore();
  const currentYear = new Date().getFullYear();
  const currentMonth = getCurrentMonthKey();
  const taxFileRef = useRef<HTMLInputElement>(null);
  const laborFileRef = useRef<HTMLInputElement>(null);
  const payrollFileRef = useRef<HTMLInputElement>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedPerson, setSelectedPerson] = useState<PersonFilter>("Todos");
  const [feedback, setFeedback] = useState("Organize documentos fiscais e trabalhistas sem misturar com saldo livre.");
  const [isUploadingTax, setIsUploadingTax] = useState(false);
  const [isUploadingLabor, setIsUploadingLabor] = useState(false);
  const [isUploadingPayroll, setIsUploadingPayroll] = useState(false);
  const [taxAttachment, setTaxAttachment] = useState<FinanceAttachmentUpload | null>(null);
  const [laborAttachment, setLaborAttachment] = useState<FinanceAttachmentUpload | null>(null);
  const [payrollAttachment, setPayrollAttachment] = useState<FinanceAttachmentUpload | null>(null);
  const [taxForm, setTaxForm] = useState({
    year: String(currentYear),
    person: "Deyverson" as Person,
    kind: "income_report" as TaxDocumentKind,
    title: "",
    institution: "",
    amount: "",
    documentDate: toInputDate(new Date()),
    status: "pending" as TaxDocumentStatus,
    notes: ""
  });
  const [laborForm, setLaborForm] = useState({
    person: "Deyverson" as Person,
    type: "fgts" as LaborBenefitType,
    employer: "",
    referenceMonth: currentMonth,
    amount: "",
    availableBalance: "",
    blockedBalance: "",
    documentDate: toInputDate(new Date()),
    notes: ""
  });
  const [payrollForm, setPayrollForm] = useState({
    person: "Deyverson" as Person,
    referenceMonth: currentMonth,
    employer: "",
    baseSalary: "",
    outsideBonus: "",
    payslipInss: "",
    payslipIrrf: "",
    payslipFgts: "",
    taxesPaidByEmployer: true,
    status: "pending_review" as PayrollRecordStatus,
    notes: ""
  });

  const years = useMemo(() => {
    const fromTax = state.taxDocuments.map((document) => document.year);
    const fromLabor = state.laborBenefits
      .map((benefit) => Number(benefit.referenceMonth.slice(0, 4)))
      .filter((year) => Number.isInteger(year));
    const fromPayroll = state.payrollRecords
      .map((record) => Number(record.referenceMonth.slice(0, 4)))
      .filter((year) => Number.isInteger(year));

    return Array.from(new Set([currentYear, currentYear - 1, currentYear + 1, ...fromTax, ...fromLabor, ...fromPayroll])).sort(
      (left, right) => right - left
    );
  }, [currentYear, state.laborBenefits, state.payrollRecords, state.taxDocuments]);

  const visibleTaxDocuments = useMemo(
    () =>
      state.taxDocuments.filter(
        (document) =>
          document.year === selectedYear && (selectedPerson === "Todos" || document.person === selectedPerson)
      ),
    [selectedPerson, selectedYear, state.taxDocuments]
  );

  const visibleLaborBenefits = useMemo(
    () =>
      state.laborBenefits.filter((benefit) => {
        const year = Number(benefit.referenceMonth.slice(0, 4));
        return year === selectedYear && (selectedPerson === "Todos" || benefit.person === selectedPerson);
      }),
    [selectedPerson, selectedYear, state.laborBenefits]
  );

  const visiblePayrollRecords = useMemo(
    () =>
      state.payrollRecords.filter((record) => {
        const year = Number(record.referenceMonth.slice(0, 4));
        return year === selectedYear && (selectedPerson === "Todos" || record.person === selectedPerson);
      }),
    [selectedPerson, selectedYear, state.payrollRecords]
  );

  const totals = useMemo(() => {
    const income = visibleTaxDocuments
      .filter((document) => document.kind === "income_report" || document.kind === "business_income")
      .reduce((total, document) => total + (document.amount ?? 0), 0);
    const deductions = visibleTaxDocuments
      .filter((document) => document.kind === "medical_receipt" || document.kind === "education_receipt")
      .reduce((total, document) => total + (document.amount ?? 0), 0);
    const assets = visibleTaxDocuments
      .filter((document) =>
        ["asset", "bank_balance", "investment", "property", "vehicle"].includes(document.kind)
      )
      .reduce((total, document) => total + (document.amount ?? 0), 0);
    const debts = visibleTaxDocuments
      .filter((document) => document.kind === "debt")
      .reduce((total, document) => total + Math.abs(document.amount ?? 0), 0);
    const fgtsBlocked = visibleLaborBenefits
      .filter((benefit) => benefit.type === "fgts")
      .reduce((total, benefit) => total + (benefit.blockedBalance ?? benefit.amount), 0);
    const laborRecords = visibleLaborBenefits.reduce((total, benefit) => total + benefit.amount, 0);
    const payrollBase = visiblePayrollRecords.reduce((total, record) => total + record.baseSalary, 0);
    const payrollOutside = visiblePayrollRecords.reduce((total, record) => total + record.outsideBonus, 0);

    return { income, deductions, assets, debts, fgtsBlocked, laborRecords, payrollBase, payrollOutside };
  }, [visibleLaborBenefits, visiblePayrollRecords, visibleTaxDocuments]);

  const checklist = useMemo(
    () => buildChecklist(selectedYear, selectedPerson, visibleTaxDocuments, visibleLaborBenefits, visiblePayrollRecords),
    [selectedPerson, selectedYear, visibleLaborBenefits, visiblePayrollRecords, visibleTaxDocuments]
  );

  async function handleTaxAttachment(file: File | undefined) {
    if (!file) {
      return;
    }

    setIsUploadingTax(true);
    setFeedback("Salvando anexo fiscal para revisao.");

    try {
      const attachment = await fileToFinanceAttachment(file);
      setTaxAttachment(attachment);
      setFeedback(
        attachment.storagePath
          ? "Anexo fiscal salvo na nuvem."
          : "Anexo fiscal carregado localmente. Verifique a configuracao do Storage para nuvem."
      );
    } catch {
      setFeedback("Nao consegui anexar esse arquivo agora. Use imagem JPG/PNG e tente novamente.");
    } finally {
      setIsUploadingTax(false);
      if (taxFileRef.current) {
        taxFileRef.current.value = "";
      }
    }
  }

  async function handleLaborAttachment(file: File | undefined) {
    if (!file) {
      return;
    }

    setIsUploadingLabor(true);
    setFeedback("Salvando anexo trabalhista para revisao.");

    try {
      const attachment = await fileToFinanceAttachment(file);
      setLaborAttachment(attachment);
      setFeedback(
        attachment.storagePath
          ? "Anexo trabalhista salvo na nuvem."
          : "Anexo trabalhista carregado localmente. Verifique a configuracao do Storage para nuvem."
      );
    } catch {
      setFeedback("Nao consegui anexar esse arquivo agora. Use imagem JPG/PNG e tente novamente.");
    } finally {
      setIsUploadingLabor(false);
      if (laborFileRef.current) {
        laborFileRef.current.value = "";
      }
    }
  }

  async function handlePayrollAttachment(file: File | undefined) {
    if (!file) {
      return;
    }

    setIsUploadingPayroll(true);
    setFeedback("Salvando holerite/comprovante para revisao.");

    try {
      const attachment = await fileToFinanceAttachment(file);
      setPayrollAttachment(attachment);
      setFeedback(
        attachment.storagePath
          ? "Holerite/comprovante salvo na nuvem."
          : "Holerite/comprovante carregado localmente. Verifique a configuracao do Storage para nuvem."
      );
    } catch {
      setFeedback("Nao consegui anexar esse holerite agora. Use imagem JPG/PNG e tente novamente.");
    } finally {
      setIsUploadingPayroll(false);
      if (payrollFileRef.current) {
        payrollFileRef.current.value = "";
      }
    }
  }

  function submitTaxDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const year = Number(taxForm.year);
    const amount = taxForm.amount.trim() ? parseFinancialAmountInput(taxForm.amount) : undefined;

    if (!Number.isInteger(year) || year < 2000 || !taxForm.title.trim()) {
      setFeedback("Informe ano e titulo para salvar o documento fiscal.");
      return;
    }

    if (amount !== undefined && !Number.isFinite(amount)) {
      setFeedback("O valor fiscal informado nao e valido.");
      return;
    }

    actions.addTaxDocument({
      year,
      person: taxForm.person,
      kind: taxForm.kind,
      title: taxForm.title.trim(),
      institution: taxForm.institution.trim() || undefined,
      amount,
      documentDate: taxForm.documentDate || undefined,
      status: taxForm.status,
      notes: taxForm.notes.trim() || undefined,
      attachmentImageName: taxAttachment?.fileName,
      attachmentDataUrl: taxAttachment?.storagePath ? undefined : taxAttachment?.imageDataUrl,
      attachmentStoragePath: taxAttachment?.storagePath,
      attachmentMimeType: taxAttachment?.mimeType,
      attachmentSize: taxAttachment?.size
    });

    setSelectedYear(year);
    setTaxForm((current) => ({
      ...current,
      title: "",
      institution: "",
      amount: "",
      notes: ""
    }));
    setTaxAttachment(null);
    setFeedback("Documento fiscal salvo. A Maya ja consegue separar por pessoa e ano.");
  }

  function submitLaborBenefit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = laborForm.amount.trim() ? parseFinancialAmountInput(laborForm.amount) : 0;
    const availableBalance = laborForm.availableBalance.trim()
      ? parseFinancialAmountInput(laborForm.availableBalance)
      : undefined;
    const blockedBalance = laborForm.blockedBalance.trim()
      ? parseFinancialAmountInput(laborForm.blockedBalance)
      : undefined;

    if (!laborForm.referenceMonth || !Number.isFinite(amount)) {
      setFeedback("Informe mes de referencia e valor valido para salvar o dado trabalhista.");
      return;
    }

    if (
      (availableBalance !== undefined && !Number.isFinite(availableBalance)) ||
      (blockedBalance !== undefined && !Number.isFinite(blockedBalance))
    ) {
      setFeedback("Os saldos informado nao sao validos.");
      return;
    }

    if (amount === 0 && !availableBalance && !blockedBalance) {
      setFeedback("Informe pelo menos um valor, saldo disponivel ou saldo vinculado.");
      return;
    }

    actions.addLaborBenefit({
      person: laborForm.person,
      type: laborForm.type,
      employer: laborForm.employer.trim() || undefined,
      referenceMonth: laborForm.referenceMonth,
      amount,
      availableBalance,
      blockedBalance,
      documentDate: laborForm.documentDate || undefined,
      notes: laborForm.notes.trim() || undefined,
      attachmentImageName: laborAttachment?.fileName,
      attachmentDataUrl: laborAttachment?.storagePath ? undefined : laborAttachment?.imageDataUrl,
      attachmentStoragePath: laborAttachment?.storagePath,
      attachmentMimeType: laborAttachment?.mimeType,
      attachmentSize: laborAttachment?.size
    });

    setSelectedYear(Number(laborForm.referenceMonth.slice(0, 4)));
    setLaborForm((current) => ({
      ...current,
      employer: "",
      amount: "",
      availableBalance: "",
      blockedBalance: "",
      notes: ""
    }));
    setLaborAttachment(null);
    setFeedback("Dado trabalhista salvo separado do saldo livre.");
  }

  function submitPayrollRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const baseSalary = parseFinancialAmountInput(payrollForm.baseSalary);
    const outsideBonus = payrollForm.outsideBonus.trim() ? parseFinancialAmountInput(payrollForm.outsideBonus) : 0;
    const payslipInss = payrollForm.payslipInss.trim() ? parseFinancialAmountInput(payrollForm.payslipInss) : undefined;
    const payslipIrrf = payrollForm.payslipIrrf.trim() ? parseFinancialAmountInput(payrollForm.payslipIrrf) : undefined;
    const payslipFgts = payrollForm.payslipFgts.trim() ? parseFinancialAmountInput(payrollForm.payslipFgts) : undefined;

    if (!payrollForm.referenceMonth || !Number.isFinite(baseSalary) || baseSalary <= 0) {
      setFeedback("Informe mes e salario base do holerite para salvar.");
      return;
    }

    if (
      !Number.isFinite(outsideBonus) ||
      (payslipInss !== undefined && !Number.isFinite(payslipInss)) ||
      (payslipIrrf !== undefined && !Number.isFinite(payslipIrrf)) ||
      (payslipFgts !== undefined && !Number.isFinite(payslipFgts))
    ) {
      setFeedback("Confira os valores do holerite. Use formato como 1.234,56.");
      return;
    }

    actions.addPayrollRecord({
      person: payrollForm.person,
      referenceMonth: payrollForm.referenceMonth,
      employer: payrollForm.employer.trim() || undefined,
      baseSalary,
      outsideBonus: Math.max(0, outsideBonus),
      payslipInss,
      payslipIrrf,
      payslipFgts,
      taxesPaidByEmployer: payrollForm.taxesPaidByEmployer,
      status: payrollForm.status,
      notes: payrollForm.notes.trim() || undefined,
      attachmentImageName: payrollAttachment?.fileName,
      attachmentDataUrl: payrollAttachment?.storagePath ? undefined : payrollAttachment?.imageDataUrl,
      attachmentStoragePath: payrollAttachment?.storagePath,
      attachmentMimeType: payrollAttachment?.mimeType,
      attachmentSize: payrollAttachment?.size
    });

    setSelectedYear(Number(payrollForm.referenceMonth.slice(0, 4)));
    setPayrollForm((current) => ({
      ...current,
      employer: "",
      baseSalary: "",
      outsideBonus: "",
      payslipInss: "",
      payslipIrrf: "",
      payslipFgts: "",
      notes: ""
    }));
    setPayrollAttachment(null);
    setFeedback("Holerite salvo. A Maya ja consegue comparar base oficial e remuneracao real estimada.");
  }

  return (
    <AppShell>
      <LedPanel className="mb-4 p-5" glow="cyan">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
          <div className="min-w-0">
            <p className="eyebrow">Fiscal e patrimonio</p>
            <h1 className="mt-2 max-w-4xl font-serif text-3xl font-bold leading-tight text-bronze sm:text-4xl">
              Prepare documentos por pessoa sem misturar com o saldo do mes.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Use esta area para separar informes, bens, dividas, FGTS, INSS e comprovantes. A Maya organiza a base para
              conferencia futura, mas a declaracao final deve ser revisada nas plataformas oficiais ou com contador.
            </p>
          </div>

          <div className="grid gap-2 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 p-4">
            <div className="flex items-center gap-2 text-cyan-50">
              <ShieldCheck className="size-5" aria-hidden="true" />
              <strong>Base separada para IR</strong>
            </div>
            <p className="text-sm leading-6 text-muted">
              FGTS e beneficios ficam como patrimonio vinculado. Eles nao entram no saldo disponivel nem mudam despesas
              do mes.
            </p>
            <Badge tone="info">Sem valores legais fixos no codigo</Badge>
          </div>
        </div>
      </LedPanel>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
        <Label>
          Ano de referencia
          <Select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </Label>
        <Label>
          Pessoa
          <Select value={selectedPerson} onChange={(event) => setSelectedPerson(event.target.value as PersonFilter)}>
            <option value="Todos">Todos</option>
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Rendimentos" value={totals.income} icon={Landmark} />
        <MetricCard title="Deducoes candidatas" value={totals.deductions} icon={FileText} />
        <MetricCard title="Bens e saldos" value={totals.assets} icon={ShieldCheck} />
        <MetricCard title="Dividas" value={-totals.debts} icon={Landmark} />
        <MetricCard title="FGTS vinculado" value={totals.fgtsBlocked} icon={BriefcaseBusiness} />
        <MetricCard title="Registros trab." value={totals.laborRecords} icon={BriefcaseBusiness} />
        <MetricCard title="Base holerite" value={totals.payrollBase} icon={Calculator} />
        <MetricCard title="Bonus por fora" value={totals.payrollOutside} icon={Calculator} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Imposto de renda" title="Novo documento fiscal" />
          <form className="grid gap-3" onSubmit={submitTaxDocument}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Label>
                Ano
                <Input
                  inputMode="numeric"
                  value={taxForm.year}
                  onChange={(event) => setTaxForm((current) => ({ ...current, year: event.target.value }))}
                />
              </Label>
              <Label>
                Pessoa
                <Select
                  value={taxForm.person}
                  onChange={(event) => setTaxForm((current) => ({ ...current, person: event.target.value as Person }))}
                >
                  {people.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Status
                <Select
                  value={taxForm.status}
                  onChange={(event) =>
                    setTaxForm((current) => ({ ...current, status: event.target.value as TaxDocumentStatus }))
                  }
                >
                  {taxStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </Select>
              </Label>
            </div>

            <Label>
              Tipo
              <Select
                value={taxForm.kind}
                onChange={(event) =>
                  setTaxForm((current) => ({ ...current, kind: event.target.value as TaxDocumentKind }))
                }
              >
                {taxDocumentKinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </Select>
            </Label>

            <div className="grid gap-3 sm:grid-cols-2">
              <Label>
                Titulo
                <Input
                  value={taxForm.title}
                  onChange={(event) => setTaxForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Informe, recibo, bem ou divida"
                />
              </Label>
              <Label>
                Fonte/instituicao
                <Input
                  value={taxForm.institution}
                  onChange={(event) => setTaxForm((current) => ({ ...current, institution: event.target.value }))}
                  placeholder="Banco, empresa, clinica..."
                />
              </Label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Label>
                Valor
                <Input
                  inputMode="decimal"
                  value={taxForm.amount}
                  onChange={(event) => setTaxForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
              <Label>
                Data do documento
                <Input
                  type="date"
                  value={taxForm.documentDate}
                  onChange={(event) => setTaxForm((current) => ({ ...current, documentDate: event.target.value }))}
                />
              </Label>
            </div>

            <Label>
              Observacoes
              <Textarea
                value={taxForm.notes}
                onChange={(event) => setTaxForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Detalhes uteis para conferencia futura"
              />
            </Label>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => taxFileRef.current?.click()}
                disabled={isUploadingTax}
              >
                <Paperclip className="size-4" aria-hidden="true" />
                {taxAttachment ? taxAttachment.fileName : "Anexar imagem"}
              </Button>
              <Button type="submit">
                <Plus className="size-4" aria-hidden="true" />
                Salvar documento
              </Button>
            </div>
            <input
              ref={taxFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleTaxAttachment(event.target.files?.[0])}
            />
          </form>
        </Card>

        <Card>
          <CardHeader eyebrow="Trabalhista" title="FGTS, INSS e beneficios" />
          <form className="grid gap-3" onSubmit={submitLaborBenefit}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Label>
                Pessoa
                <Select
                  value={laborForm.person}
                  onChange={(event) =>
                    setLaborForm((current) => ({ ...current, person: event.target.value as Person }))
                  }
                >
                  {cltPeople.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Tipo
                <Select
                  value={laborForm.type}
                  onChange={(event) =>
                    setLaborForm((current) => ({ ...current, type: event.target.value as LaborBenefitType }))
                  }
                >
                  {laborBenefitTypes.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Mes
                <Input
                  type="month"
                  value={laborForm.referenceMonth}
                  onChange={(event) =>
                    setLaborForm((current) => ({ ...current, referenceMonth: event.target.value }))
                  }
                />
              </Label>
            </div>

            <Label>
              Empresa/origem
              <Input
                value={laborForm.employer}
                onChange={(event) => setLaborForm((current) => ({ ...current, employer: event.target.value }))}
                placeholder="Empresa, INSS, Caixa ou outro"
              />
            </Label>

            <div className="grid gap-3 sm:grid-cols-3">
              <Label>
                Valor do mes
                <Input
                  inputMode="decimal"
                  value={laborForm.amount}
                  onChange={(event) => setLaborForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
              <Label>
                Saldo disponivel
                <Input
                  inputMode="decimal"
                  value={laborForm.availableBalance}
                  onChange={(event) =>
                    setLaborForm((current) => ({ ...current, availableBalance: event.target.value }))
                  }
                  placeholder="0,00"
                />
              </Label>
              <Label>
                Saldo vinculado
                <Input
                  inputMode="decimal"
                  value={laborForm.blockedBalance}
                  onChange={(event) =>
                    setLaborForm((current) => ({ ...current, blockedBalance: event.target.value }))
                  }
                  placeholder="0,00"
                />
              </Label>
            </div>

            <Label>
              Data do comprovante
              <Input
                type="date"
                value={laborForm.documentDate}
                onChange={(event) => setLaborForm((current) => ({ ...current, documentDate: event.target.value }))}
              />
            </Label>

            <Label>
              Observacoes
              <Textarea
                value={laborForm.notes}
                onChange={(event) => setLaborForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Ex.: extrato FGTS, informe INSS, ferias, 13 salario"
              />
            </Label>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => laborFileRef.current?.click()}
                disabled={isUploadingLabor}
              >
                <Paperclip className="size-4" aria-hidden="true" />
                {laborAttachment ? laborAttachment.fileName : "Anexar imagem"}
              </Button>
              <Button type="submit">
                <Plus className="size-4" aria-hidden="true" />
                Salvar dado
              </Button>
            </div>
            <input
              ref={laborFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleLaborAttachment(event.target.files?.[0])}
            />
          </form>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader eyebrow="Holerite" title="Base oficial x remuneracao real" />
          <form className="grid gap-3" onSubmit={submitPayrollRecord}>
            <div className="grid gap-3 sm:grid-cols-4">
              <Label>
                Pessoa
                <Select
                  value={payrollForm.person}
                  onChange={(event) =>
                    setPayrollForm((current) => ({ ...current, person: event.target.value as Person }))
                  }
                >
                  {cltPeople.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Mes
                <Input
                  type="month"
                  value={payrollForm.referenceMonth}
                  onChange={(event) =>
                    setPayrollForm((current) => ({ ...current, referenceMonth: event.target.value }))
                  }
                />
              </Label>
              <Label>
                Status
                <Select
                  value={payrollForm.status}
                  onChange={(event) =>
                    setPayrollForm((current) => ({ ...current, status: event.target.value as PayrollRecordStatus }))
                  }
                >
                  {payrollStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 p-3">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={payrollForm.taxesPaidByEmployer}
                    onChange={(event) =>
                      setPayrollForm((current) => ({ ...current, taxesPaidByEmployer: event.target.checked }))
                    }
                  />
                  Empresa arca com taxas
                </span>
              </Label>
            </div>

            <Label>
              Empresa
              <Input
                value={payrollForm.employer}
                onChange={(event) => setPayrollForm((current) => ({ ...current, employer: event.target.value }))}
                placeholder="Nome da empresa"
              />
            </Label>

            <div className="grid gap-3 sm:grid-cols-5">
              <Label>
                Base no holerite
                <Input
                  inputMode="decimal"
                  value={payrollForm.baseSalary}
                  onChange={(event) => setPayrollForm((current) => ({ ...current, baseSalary: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
              <Label>
                Bonus por fora
                <Input
                  inputMode="decimal"
                  value={payrollForm.outsideBonus}
                  onChange={(event) => setPayrollForm((current) => ({ ...current, outsideBonus: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
              <Label>
                INSS no holerite
                <Input
                  inputMode="decimal"
                  value={payrollForm.payslipInss}
                  onChange={(event) => setPayrollForm((current) => ({ ...current, payslipInss: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
              <Label>
                IRRF no holerite
                <Input
                  inputMode="decimal"
                  value={payrollForm.payslipIrrf}
                  onChange={(event) => setPayrollForm((current) => ({ ...current, payslipIrrf: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
              <Label>
                FGTS depositado
                <Input
                  inputMode="decimal"
                  value={payrollForm.payslipFgts}
                  onChange={(event) => setPayrollForm((current) => ({ ...current, payslipFgts: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
            </div>

            <Label>
              Observacoes
              <Textarea
                value={payrollForm.notes}
                onChange={(event) => setPayrollForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Ex.: bonus recorrente, pago via Pix, empresa diz que arca com impostos..."
              />
            </Label>

            <div className="rounded-2xl border border-neon-amber/25 bg-neon-amber/10 p-3 text-sm leading-6 text-amber-50">
              A comparacao e estimativa de conferencia. Ela nao substitui contador, advogado trabalhista ou consulta aos
              sistemas oficiais.
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => payrollFileRef.current?.click()}
                disabled={isUploadingPayroll}
              >
                <Paperclip className="size-4" aria-hidden="true" />
                {payrollAttachment ? payrollAttachment.fileName : "Anexar holerite"}
              </Button>
              <Button type="submit">
                <Plus className="size-4" aria-hidden="true" />
                Salvar holerite
              </Button>
            </div>
            <input
              ref={payrollFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handlePayrollAttachment(event.target.files?.[0])}
            />
          </form>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader eyebrow="Checklist" title={`IR ${selectedYear}`} />
          <div className="grid gap-2">
            {checklist.map((item) => (
              <div
                key={item.title}
                className={cn(
                  "rounded-2xl border p-3",
                  item.ready ? "border-neon-green/25 bg-neon-green/10" : "border-neon-amber/25 bg-neon-amber/10"
                )}
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2
                    className={cn("mt-0.5 size-4", item.ready ? "text-neon-green" : "text-neon-amber")}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-black text-cream">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{item.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader eyebrow="Documentos" title="Base fiscal do ano" />
            {visibleTaxDocuments.length === 0 ? (
              <EmptyState
                title="Nenhum documento fiscal registrado"
                text="Cadastre informes, saldos, bens, dividas e comprovantes para a Maya separar por pessoa."
              />
            ) : (
              <div className="grid gap-3">
                {visibleTaxDocuments.map((document) => (
                  <div key={document.id} className="rounded-2xl border border-cream/10 bg-cream/[0.04] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-xl font-bold text-bronze">{document.title}</h3>
                          <Badge tone={document.status === "ready" ? "success" : document.status === "reviewed" ? "info" : "warning"}>
                            {getStatusLabel(document.status)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {taxKindLabels[document.kind]} - {document.person}
                          {document.institution ? ` - ${document.institution}` : ""}
                        </p>
                      </div>
                      <strong className={cn("text-lg", financialValueClass(document.amount ?? 0, "text-cyan-50"))}>
                        {document.amount !== undefined ? formatCurrency(document.amount) : "Sem valor"}
                      </strong>
                    </div>

                    {document.notes ? <p className="mt-3 text-sm leading-6 text-muted">{document.notes}</p> : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Select
                        className="w-auto min-w-36"
                        value={document.status}
                        onChange={(event) =>
                          actions.updateTaxDocument(document.id, { status: event.target.value as TaxDocumentStatus })
                        }
                      >
                        {taxStatuses.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </Select>
                      <AttachmentLink
                        dataUrl={document.attachmentDataUrl}
                        storagePath={document.attachmentStoragePath}
                        imageName={document.attachmentImageName}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-3 text-sm font-black text-cyan-100"
                      />
                      <Button variant="danger" onClick={() => actions.removeTaxDocument(document.id)}>
                        <Trash2 className="size-4" aria-hidden="true" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader eyebrow="Trabalhista" title="Registros e saldos vinculados" />
            {visibleLaborBenefits.length === 0 ? (
              <EmptyState
                title="Nenhum dado trabalhista registrado"
                text="Inclua FGTS, INSS, salario, ferias ou beneficios por usuario para compor a memoria patrimonial."
              />
            ) : (
              <div className="grid gap-3">
                {visibleLaborBenefits.map((benefit) => (
                  <div key={benefit.id} className="rounded-2xl border border-cream/10 bg-cream/[0.04] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-xl font-bold text-bronze">
                          {laborTypeLabels[benefit.type]} - {benefit.person}
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                          {benefit.referenceMonth}
                          {benefit.employer ? ` - ${benefit.employer}` : ""}
                        </p>
                      </div>
                      <strong className={cn("text-lg", financialValueClass(benefit.amount, "text-cyan-50"))}>
                        {formatCurrency(benefit.amount)}
                      </strong>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <SmallValue label="Saldo disponivel" value={benefit.availableBalance} />
                      <SmallValue label="Saldo vinculado" value={benefit.blockedBalance} />
                    </div>

                    {benefit.notes ? <p className="mt-3 text-sm leading-6 text-muted">{benefit.notes}</p> : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <AttachmentLink
                        dataUrl={benefit.attachmentDataUrl}
                        storagePath={benefit.attachmentStoragePath}
                        imageName={benefit.attachmentImageName}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-3 text-sm font-black text-cyan-100"
                      />
                      <Button variant="danger" onClick={() => actions.removeLaborBenefit(benefit.id)}>
                        <Trash2 className="size-4" aria-hidden="true" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader eyebrow="Holerites" title="Comparativo trabalhista estimado" />
            {visiblePayrollRecords.length === 0 ? (
              <EmptyState
                title="Nenhum holerite registrado"
                text="Cadastre o salario base do holerite e o bonus por fora para comparar bases de ferias, 13 salario e FGTS."
              />
            ) : (
              <div className="grid gap-3">
                {visiblePayrollRecords.map((record) => {
                  const comparison = calculatePayrollComparison(record.baseSalary, record.outsideBonus, record.payslipFgts);

                  return (
                    <div key={record.id} className="rounded-2xl border border-cream/10 bg-cream/[0.04] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-serif text-xl font-bold text-bronze">
                              {record.referenceMonth} - {record.person}
                            </h3>
                            <Badge tone={record.status === "attention" ? "warning" : record.status === "reviewed" ? "success" : "info"}>
                              {getPayrollStatusLabel(record.status)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            {record.employer ?? "Empresa nao informada"}
                            {record.taxesPaidByEmployer ? " - empresa arca com taxas informadas" : ""}
                          </p>
                        </div>
                        <strong className="text-lg text-cyan-50">{formatCurrency(comparison.realGross)}</strong>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <SmallValue label="Base holerite" value={record.baseSalary} />
                        <SmallValue label="Bonus por fora" value={record.outsideBonus} />
                        <SmallValue label="Diferenca nao registrada" value={comparison.outsideBonus} />
                        <SmallValue label="FGTS diferenca estimada" value={comparison.fgtsGapFromPayslip} />
                        <SmallValue label="Ferias pela base" value={comparison.vacationOfficial} />
                        <SmallValue label="Ferias pelo real" value={comparison.vacationReal} />
                        <SmallValue label="13 pela base" value={comparison.thirteenthOfficial} />
                        <SmallValue label="13 pelo real" value={comparison.thirteenthReal} />
                      </div>

                      {record.notes ? <p className="mt-3 text-sm leading-6 text-muted">{record.notes}</p> : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Select
                          className="w-auto min-w-36"
                          value={record.status}
                          onChange={(event) =>
                            actions.updatePayrollRecord(record.id, {
                              status: event.target.value as PayrollRecordStatus
                            })
                          }
                        >
                          {payrollStatuses.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </Select>
                        <AttachmentLink
                          dataUrl={record.attachmentDataUrl}
                          storagePath={record.attachmentStoragePath}
                          imageName={record.attachmentImageName}
                          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-3 text-sm font-black text-cyan-100"
                        />
                        <Button variant="danger" onClick={() => actions.removePayrollRecord(record.id)}>
                          <Trash2 className="size-4" aria-hidden="true" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon
}: {
  title: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-card border border-cream/10 bg-cream/[0.04] p-4 shadow-neon">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">{title}</p>
        <span className="grid size-10 place-items-center rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 text-cyan-100">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <strong className={cn("mt-3 block font-serif text-2xl text-bronze", financialValueClass(value))}>
        {formatCurrency(value)}
      </strong>
    </div>
  );
}

function SmallValue({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-cream/10 bg-moss-950/40 p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <strong className={cn("mt-1 block", financialValueClass(value ?? 0, "text-cyan-50"))}>
        {value !== undefined ? formatCurrency(value) : "Nao informado"}
      </strong>
    </div>
  );
}

function buildChecklist(
  year: number,
  person: PersonFilter,
  documents: Array<{ kind: TaxDocumentKind; status: TaxDocumentStatus; person: Person }>,
  benefits: Array<{ type: LaborBenefitType; person: Person }>,
  payrollRecords: Array<{ person: Person }>
) {
  const targetPeople = person === "Todos" ? ["Deyverson", "Tom"] : person === "Casal" ? ["Deyverson", "Tom"] : [person];
  const hasForPerson = (target: Person, kinds: TaxDocumentKind[]) =>
    documents.some((document) => document.person === target && kinds.includes(document.kind));
  const hasLaborForPerson = (target: Person) => benefits.some((benefit) => benefit.person === target);
  const hasPayrollForPerson = (target: Person) => payrollRecords.some((record) => record.person === target);
  const pendingCount = documents.filter((document) => document.status === "pending").length;

  return [
    {
      title: `Rendimentos por pessoa em ${year}`,
      ready: targetPeople.every((target) =>
        hasForPerson(target as Person, ["income_report", "business_income"]) ||
        hasLaborForPerson(target as Person) ||
        hasPayrollForPerson(target as Person)
      ),
      text: "Separe informes de rendimento, renda profissional e comprovantes de entrada por CPF."
    },
    {
      title: "Bens, saldos e investimentos",
      ready: documents.some((document) =>
        ["bank_balance", "investment", "asset", "property", "vehicle"].includes(document.kind)
      ),
      text: "Inclua contas, investimentos, veiculos, imoveis e outros bens para conferencia patrimonial."
    },
    {
      title: "Dividas e financiamentos",
      ready: documents.some((document) => document.kind === "debt"),
      text: "Registre financiamentos, emprestimos e dividas para nao misturar com despesas comuns."
    },
    {
      title: "Saude, educacao e recibos",
      ready: documents.some((document) => document.kind === "medical_receipt" || document.kind === "education_receipt"),
      text: "Guarde comprovantes de despesas que precisam ser conferidas antes de qualquer declaracao."
    },
    {
      title: "FGTS, INSS e historico trabalhista",
      ready: benefits.length > 0 || payrollRecords.length > 0,
      text: "FGTS fica como saldo vinculado; INSS, holerites, beneficios e bonus por fora ficam no historico da pessoa."
    },
    {
      title: "Conferencia final",
      ready: pendingCount === 0 && (documents.length > 0 || benefits.length > 0),
      text: pendingCount > 0 ? `${pendingCount} documento(s) ainda pendente(s).` : "Sem pendencias marcadas neste filtro."
    }
  ];
}

function getStatusLabel(status: TaxDocumentStatus) {
  if (status === "ready") {
    return "Pronto";
  }

  if (status === "reviewed") {
    return "Conferido";
  }

  return "Pendente";
}

function getPayrollStatusLabel(status: PayrollRecordStatus) {
  if (status === "reviewed") {
    return "Conferido";
  }

  if (status === "attention") {
    return "Atencao";
  }

  return "Pendente";
}

function calculatePayrollComparison(baseSalary: number, outsideBonus: number, payslipFgts?: number) {
  const officialGross = Math.max(0, baseSalary);
  const bonus = Math.max(0, outsideBonus);
  const realGross = officialGross + bonus;
  const estimatedFgtsOfficial = officialGross * 0.08;
  const estimatedFgtsReal = realGross * 0.08;
  const fgtsReference = Number.isFinite(payslipFgts) ? payslipFgts ?? 0 : estimatedFgtsOfficial;

  return {
    officialGross,
    outsideBonus: bonus,
    realGross,
    estimatedFgtsOfficial,
    estimatedFgtsReal,
    fgtsGapFromPayslip: Math.max(0, estimatedFgtsReal - fgtsReference),
    vacationOfficial: officialGross + officialGross / 3,
    vacationReal: realGross + realGross / 3,
    thirteenthOfficial: officialGross,
    thirteenthReal: realGross
  };
}
