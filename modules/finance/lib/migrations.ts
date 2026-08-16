import { DEFAULT_FINANCE_ACCOUNT_ID, createDefaultFinanceAccount, createEmptyFinanceState } from "../data/defaults";
import { getCurrentMonthKey, toDateKey } from "../../../lib/utils";
import type {
  Budget,
  FinanceActivityLog,
  FinanceAccount,
  FinanceState,
  Goal,
  GoalContribution,
  HouseholdProfile,
  LaborBenefit,
  LaborBenefitType,
  PayableBill,
  PaymentMethod,
  Person,
  PayrollRecord,
  PayrollRecordStatus,
  SalonMaterial,
  SalonMaterialUnit,
  SalonRecipeItem,
  SalonServiceRecipe,
  SalonStockMovement,
  SalonStockMovementType,
  TaxDocument,
  TaxDocumentKind,
  TaxDocumentStatus,
  Transaction,
  WorkTimeEntry
} from "../types";

interface PersistedFinanceStateV1 {
  schemaVersion: 1;
  profile: HouseholdProfile;
  transactions: Transaction[];
  goals: Goal[];
  updatedAt: string;
}

interface PersistedFinanceStateV2 {
  schemaVersion: 2;
  profile: HouseholdProfile;
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  updatedAt: string;
}

interface PersistedFinanceStateV3 {
  schemaVersion: 3;
  profile: HouseholdProfile;
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  bills: PayableBill[];
  activityLogs?: FinanceActivityLog[];
  updatedAt: string;
}

interface PersistedFinanceStateV4 {
  schemaVersion: 4;
  profile: HouseholdProfile;
  accounts: FinanceAccount[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  bills: PayableBill[];
  activityLogs?: FinanceActivityLog[];
  updatedAt: string;
}

interface PersistedFinanceStateV5 {
  schemaVersion: 5;
  profile: HouseholdProfile;
  accounts: FinanceAccount[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  bills: PayableBill[];
  taxDocuments: TaxDocument[];
  laborBenefits: LaborBenefit[];
  activityLogs: FinanceActivityLog[];
  updatedAt: string;
}

interface PersistedFinanceStateV6 extends Omit<FinanceState, "schemaVersion" | "salonMaterials" | "salonServiceRecipes" | "salonStockMovements"> {
  schemaVersion: 6;
}

interface PersistedFinanceStateV7 extends FinanceState {
  schemaVersion: 7;
}

export function migrateFinanceState(value: unknown): FinanceState {
  if (!isRecord(value)) {
    return createEmptyFinanceState();
  }

  if (value.schemaVersion === 7) {
    return normalizeV7(value as unknown as PersistedFinanceStateV7);
  }

  if (value.schemaVersion === 6) {
    return normalizeV6(value as unknown as PersistedFinanceStateV6);
  }

  if (value.schemaVersion === 5) {
    return normalizeV5(value as unknown as PersistedFinanceStateV5);
  }

  if (value.schemaVersion === 4) {
    return normalizeV4(value as unknown as PersistedFinanceStateV4);
  }

  if (value.schemaVersion === 3) {
    const state = normalizeV3(value as unknown as PersistedFinanceStateV3);
    return {
      ...state,
      schemaVersion: 7,
      accounts: normalizeAccounts((value as { accounts?: FinanceAccount[] }).accounts),
      salonMaterials: [],
      salonServiceRecipes: [],
      salonStockMovements: [],
      taxDocuments: [],
      laborBenefits: [],
      payrollRecords: [],
      workTimeEntries: [],
      deletedEntityIds: normalizeDeletedEntityIds((value as { deletedEntityIds?: unknown[] }).deletedEntityIds)
    };
  }

  if (value.schemaVersion === 2) {
    const state = value as unknown as PersistedFinanceStateV2;
    return {
      ...normalizeV2(state),
      schemaVersion: 7,
      accounts: normalizeAccounts((value as { accounts?: FinanceAccount[] }).accounts),
      bills: normalizeBills((value as { bills?: PayableBill[] }).bills),
      salonMaterials: [],
      salonServiceRecipes: [],
      salonStockMovements: [],
      taxDocuments: [],
      laborBenefits: [],
      payrollRecords: [],
      workTimeEntries: [],
      deletedEntityIds: normalizeDeletedEntityIds((value as { deletedEntityIds?: unknown[] }).deletedEntityIds),
      activityLogs: normalizeActivityLogs((value as { activityLogs?: FinanceActivityLog[] }).activityLogs),
      updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
    };
  }

  if (value.schemaVersion === 1) {
    const state = value as unknown as PersistedFinanceStateV1;
    return {
      schemaVersion: 7,
      profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
      accounts: [createDefaultFinanceAccount()],
      transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
      goals: normalizeGoals(stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : [])),
      budgets: [],
      bills: [],
      salonMaterials: [],
      salonServiceRecipes: [],
      salonStockMovements: [],
      taxDocuments: [],
      laborBenefits: [],
      payrollRecords: [],
      workTimeEntries: [],
      deletedEntityIds: [],
      activityLogs: [],
      updatedAt: new Date().toISOString()
    };
  }

  if (looksLikeFinanceState(value)) {
    return normalizeV7({
      ...createEmptyFinanceState(),
      ...value,
      schemaVersion: 7
    } as unknown as PersistedFinanceStateV7);
  }

  return createEmptyFinanceState();
}

function looksLikeFinanceState(value: Record<string, unknown>) {
  return (
    Array.isArray(value.transactions) ||
    Array.isArray(value.bills) ||
    Array.isArray(value.goals) ||
    Array.isArray(value.budgets) ||
    Array.isArray(value.taxDocuments) ||
    Array.isArray(value.laborBenefits) ||
    Array.isArray(value.payrollRecords) ||
    Array.isArray(value.workTimeEntries) ||
    Array.isArray(value.salonMaterials)
  );
}

function normalizeV7(state: PersistedFinanceStateV7): FinanceState {
  return {
    schemaVersion: 7,
    profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
    accounts: normalizeAccounts(state.accounts),
    transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
    goals: normalizeGoals(stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : [])),
    budgets: stripLegacyDemoBudgets(normalizeBudgets(state.budgets)),
    bills: normalizeBills(state.bills),
    salonMaterials: normalizeSalonMaterials((state as { salonMaterials?: SalonMaterial[] }).salonMaterials),
    salonServiceRecipes: normalizeSalonServiceRecipes((state as { salonServiceRecipes?: SalonServiceRecipe[] }).salonServiceRecipes),
    salonStockMovements: normalizeSalonStockMovements((state as { salonStockMovements?: SalonStockMovement[] }).salonStockMovements),
    taxDocuments: normalizeTaxDocuments((state as { taxDocuments?: TaxDocument[] }).taxDocuments),
    laborBenefits: normalizeLaborBenefits((state as { laborBenefits?: LaborBenefit[] }).laborBenefits),
    payrollRecords: normalizePayrollRecords((state as { payrollRecords?: PayrollRecord[] }).payrollRecords),
    workTimeEntries: normalizeWorkTimeEntries((state as { workTimeEntries?: WorkTimeEntry[] }).workTimeEntries),
    activityLogs: normalizeActivityLogs((state as { activityLogs?: FinanceActivityLog[] }).activityLogs),
    deletedEntityIds: normalizeDeletedEntityIds((state as { deletedEntityIds?: unknown[] }).deletedEntityIds),
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
  };
}

function normalizeV6(state: PersistedFinanceStateV6): FinanceState {
  return normalizeV7({
    ...state,
    schemaVersion: 7,
    salonMaterials: (state as { salonMaterials?: SalonMaterial[] }).salonMaterials ?? [],
    salonServiceRecipes: (state as { salonServiceRecipes?: SalonServiceRecipe[] }).salonServiceRecipes ?? [],
    salonStockMovements: (state as { salonStockMovements?: SalonStockMovement[] }).salonStockMovements ?? []
  });
}

function normalizeV5(state: PersistedFinanceStateV5): FinanceState {
  return normalizeV6({
    ...state,
    schemaVersion: 6,
    payrollRecords: [],
    workTimeEntries: [],
    deletedEntityIds: []
  });
}

function normalizeV4(state: PersistedFinanceStateV4): FinanceState {
  return normalizeV6({
    ...state,
    schemaVersion: 6,
    taxDocuments: [],
    laborBenefits: [],
    payrollRecords: [],
    workTimeEntries: [],
    deletedEntityIds: [],
    activityLogs: state.activityLogs ?? []
  });
}

function normalizeV3(state: PersistedFinanceStateV3) {
  return {
    schemaVersion: 3 as const,
    profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
    transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
    goals: normalizeGoals(stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : [])),
    budgets: stripLegacyDemoBudgets(normalizeBudgets(state.budgets)),
    bills: normalizeBills(state.bills),
    activityLogs: normalizeActivityLogs((state as { activityLogs?: FinanceActivityLog[] }).activityLogs),
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
  };
}

function normalizeDeletedEntityIds(ids: unknown[] | undefined) {
  if (!Array.isArray(ids)) {
    return [];
  }

  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim()))).slice(-5000);
}

function normalizeSalonMaterials(materials: SalonMaterial[] | undefined): SalonMaterial[] {
  if (!Array.isArray(materials)) {
    return [];
  }

  return materials
    .filter((material) => typeof material.name === "string" && material.name.trim())
    .map((material): SalonMaterial => ({
      ...material,
      id: typeof material.id === "string" && material.id ? material.id : `salon_material_${crypto.randomUUID()}`,
      name: material.name.trim(),
      category: typeof material.category === "string" && material.category.trim() ? material.category.trim() : "Material",
      unit: normalizeSalonMaterialUnit(material.unit),
      packageQuantity: normalizePositiveNumber(material.packageQuantity),
      packageCost: normalizePositiveNumber(material.packageCost),
      stockQuantity: normalizePositiveNumber(material.stockQuantity),
      minStockQuantity: normalizePositiveNumber(material.minStockQuantity),
      lotNumber: typeof material.lotNumber === "string" ? material.lotNumber.trim() || undefined : undefined,
      expirationDate:
        typeof material.expirationDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(material.expirationDate)
          ? material.expirationDate
          : undefined,
      supplier: typeof material.supplier === "string" ? material.supplier.trim() || undefined : undefined,
      notes: typeof material.notes === "string" ? material.notes.trim() || undefined : undefined,
      createdAt: typeof material.createdAt === "string" ? material.createdAt : new Date().toISOString(),
      updatedAt: typeof material.updatedAt === "string" ? material.updatedAt : undefined
    }));
}

function normalizeSalonServiceRecipes(recipes: SalonServiceRecipe[] | undefined): SalonServiceRecipe[] {
  if (!Array.isArray(recipes)) {
    return [];
  }

  return recipes
    .filter((recipe) => typeof recipe.name === "string" && recipe.name.trim())
    .map((recipe): SalonServiceRecipe => ({
      ...recipe,
      id: typeof recipe.id === "string" && recipe.id ? recipe.id : `salon_recipe_${crypto.randomUUID()}`,
      name: recipe.name.trim(),
      category: typeof recipe.category === "string" && recipe.category.trim() ? recipe.category.trim() : "Sobrancelha",
      price: normalizePositiveNumber(recipe.price),
      version: Number.isInteger(recipe.version) && recipe.version > 0 ? recipe.version : 1,
      items: normalizeSalonRecipeItems(recipe.items),
      active: recipe.active !== false,
      notes: typeof recipe.notes === "string" ? recipe.notes.trim() || undefined : undefined,
      createdAt: typeof recipe.createdAt === "string" ? recipe.createdAt : new Date().toISOString(),
      updatedAt: typeof recipe.updatedAt === "string" ? recipe.updatedAt : undefined
    }));
}

function normalizeSalonRecipeItems(items: SalonRecipeItem[] | undefined): SalonRecipeItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => typeof item.materialId === "string" && item.materialId.trim() && Number.isFinite(item.quantity) && item.quantity > 0)
    .map((item): SalonRecipeItem => ({
      id: typeof item.id === "string" && item.id ? item.id : `salon_recipe_item_${crypto.randomUUID()}`,
      materialId: item.materialId.trim(),
      quantity: normalizePositiveNumber(item.quantity)
    }));
}

function normalizeSalonStockMovements(movements: SalonStockMovement[] | undefined): SalonStockMovement[] {
  if (!Array.isArray(movements)) {
    return [];
  }

  return movements
    .filter((movement) => typeof movement.materialId === "string" && movement.materialId.trim())
    .map((movement): SalonStockMovement => ({
      ...movement,
      id: typeof movement.id === "string" && movement.id ? movement.id : `salon_stock_${crypto.randomUUID()}`,
      materialId: movement.materialId.trim(),
      type: normalizeSalonStockMovementType(movement.type),
      quantity: normalizePositiveNumber(movement.quantity),
      unitCost: normalizePositiveNumber(movement.unitCost),
      reason: typeof movement.reason === "string" && movement.reason.trim() ? movement.reason.trim() : "Movimento de estoque",
      date:
        typeof movement.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(movement.date)
          ? movement.date
          : toDateKey(),
      serviceRecipeId: typeof movement.serviceRecipeId === "string" ? movement.serviceRecipeId : undefined,
      transactionId: typeof movement.transactionId === "string" ? movement.transactionId : undefined,
      notes: typeof movement.notes === "string" ? movement.notes.trim() || undefined : undefined,
      createdAt: typeof movement.createdAt === "string" ? movement.createdAt : new Date().toISOString(),
      updatedAt: normalizeTimestamp(movement.updatedAt)
    }));
}

function normalizeTaxDocuments(documents: TaxDocument[] | undefined): TaxDocument[] {
  if (!Array.isArray(documents)) {
    return [];
  }

  const currentYear = new Date().getFullYear();

  return documents
    .filter((document) => typeof document.title === "string" && document.title.trim())
    .map((document): TaxDocument => ({
      ...document,
      id: typeof document.id === "string" && document.id ? document.id : `tax_${crypto.randomUUID()}`,
      year: Number.isInteger(document.year) && document.year >= 2000 ? document.year : currentYear,
      person: normalizePerson(document.person),
      kind: normalizeTaxDocumentKind(document.kind),
      title: document.title.trim(),
      institution: typeof document.institution === "string" ? document.institution.trim() || undefined : undefined,
      amount: Number.isFinite(document.amount) ? document.amount : undefined,
      documentDate:
        typeof document.documentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(document.documentDate)
          ? document.documentDate
          : undefined,
      description: typeof document.description === "string" ? document.description.trim() || undefined : undefined,
      status: normalizeTaxDocumentStatus(document.status),
      notes: typeof document.notes === "string" ? document.notes.trim() || undefined : undefined,
      createdAt: typeof document.createdAt === "string" ? document.createdAt : new Date().toISOString(),
      updatedAt: typeof document.updatedAt === "string" ? document.updatedAt : undefined
    }));
}

function normalizeLaborBenefits(benefits: LaborBenefit[] | undefined): LaborBenefit[] {
  if (!Array.isArray(benefits)) {
    return [];
  }

  const currentMonth = getCurrentMonthKey();

  return benefits
    .filter((benefit) => Number.isFinite(benefit.amount) || Number.isFinite(benefit.blockedBalance))
    .map((benefit): LaborBenefit => ({
      ...benefit,
      id: typeof benefit.id === "string" && benefit.id ? benefit.id : `labor_${crypto.randomUUID()}`,
      person: normalizePerson(benefit.person),
      type: normalizeLaborBenefitType(benefit.type),
      employer: typeof benefit.employer === "string" ? benefit.employer.trim() || undefined : undefined,
      referenceMonth:
        typeof benefit.referenceMonth === "string" && /^\d{4}-\d{2}$/.test(benefit.referenceMonth)
          ? benefit.referenceMonth
          : currentMonth,
      amount: Number.isFinite(benefit.amount) ? benefit.amount : 0,
      availableBalance: Number.isFinite(benefit.availableBalance) ? benefit.availableBalance : undefined,
      blockedBalance: Number.isFinite(benefit.blockedBalance) ? benefit.blockedBalance : undefined,
      documentDate:
        typeof benefit.documentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(benefit.documentDate)
          ? benefit.documentDate
          : undefined,
      notes: typeof benefit.notes === "string" ? benefit.notes.trim() || undefined : undefined,
      createdAt: typeof benefit.createdAt === "string" ? benefit.createdAt : new Date().toISOString(),
      updatedAt: typeof benefit.updatedAt === "string" ? benefit.updatedAt : undefined
    }));
}

function normalizePayrollRecords(records: PayrollRecord[] | undefined): PayrollRecord[] {
  if (!Array.isArray(records)) {
    return [];
  }

  const currentMonth = getCurrentMonthKey();

  return records
    .filter((record) => Number.isFinite(record.baseSalary) || Number.isFinite(record.outsideBonus))
    .map((record): PayrollRecord => ({
      ...record,
      id: typeof record.id === "string" && record.id ? record.id : `payroll_${crypto.randomUUID()}`,
      person: normalizePerson(record.person),
      referenceMonth:
        typeof record.referenceMonth === "string" && /^\d{4}-\d{2}$/.test(record.referenceMonth)
          ? record.referenceMonth
          : currentMonth,
      employer: typeof record.employer === "string" ? record.employer.trim() || undefined : undefined,
      baseSalary: Number.isFinite(record.baseSalary) ? Math.max(0, record.baseSalary) : 0,
      outsideBonus: Number.isFinite(record.outsideBonus) ? Math.max(0, record.outsideBonus) : 0,
      payslipInss: normalizeOptionalPositiveNumber(record.payslipInss),
      payslipIrrf: normalizeOptionalPositiveNumber(record.payslipIrrf),
      payslipFgts: normalizeOptionalPositiveNumber(record.payslipFgts),
      taxesPaidByEmployer: record.taxesPaidByEmployer === true,
      status: normalizePayrollRecordStatus(record.status),
      notes: typeof record.notes === "string" ? record.notes.trim() || undefined : undefined,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined
    }));
}

function normalizeWorkTimeEntries(entries: WorkTimeEntry[] | undefined): WorkTimeEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => typeof entry.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.date))
    .map((entry): WorkTimeEntry => {
      const legacyStart = normalizeOptionalTime(entry.startTime);
      const legacyEnd = normalizeOptionalTime(entry.endTime);
      const punches = normalizeWorkPunches(entry.punches, legacyStart, legacyEnd);
      const firstIn = normalizeOptionalTime(entry.firstIn) || punches[0] || legacyStart || "08:00";
      const firstOut = normalizeOptionalTime(entry.firstOut) || punches[1];
      const secondIn = normalizeOptionalTime(entry.secondIn) || punches[2];
      const secondOut = normalizeOptionalTime(entry.secondOut) || punches[3] || legacyEnd || "18:00";
      const lunchFromPunches = firstOut && secondIn ? Math.max(0, timeToMinutes(secondIn) - timeToMinutes(firstOut)) : Number.NaN;

      return {
        ...entry,
        id: typeof entry.id === "string" && entry.id ? entry.id : `work_${crypto.randomUUID()}`,
        person: normalizePerson(entry.person),
        firstIn,
        firstOut,
        secondIn,
        secondOut,
        punches: normalizeWorkPunches([firstIn, firstOut, secondIn, secondOut].filter(Boolean)),
        startTime: firstIn,
        endTime: secondOut,
        lunchMinutes: Number.isFinite(lunchFromPunches)
          ? Math.max(0, Math.min(240, Math.round(lunchFromPunches)))
          : Number.isFinite(entry.lunchMinutes)
            ? Math.max(0, Math.min(240, Math.round(entry.lunchMinutes)))
            : 72,
        expectedMinutes:
          Number.isFinite(entry.expectedMinutes) && entry.expectedMinutes >= 0
            ? Math.round(entry.expectedMinutes)
            : getDefaultExpectedMinutesForDate(entry.date),
        notes: typeof entry.notes === "string" ? entry.notes.trim() || undefined : undefined,
        attachmentImageName: typeof entry.attachmentImageName === "string" ? entry.attachmentImageName : undefined,
        attachmentDataUrl: typeof entry.attachmentDataUrl === "string" ? entry.attachmentDataUrl : undefined,
        attachmentStoragePath: typeof entry.attachmentStoragePath === "string" ? entry.attachmentStoragePath : undefined,
        attachmentMimeType: typeof entry.attachmentMimeType === "string" ? entry.attachmentMimeType : undefined,
        attachmentSize:
          typeof entry.attachmentSize === "number" && Number.isFinite(entry.attachmentSize)
            ? Math.max(0, Math.round(entry.attachmentSize))
            : undefined,
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : undefined
      };
    });
}

function normalizeV2(state: PersistedFinanceStateV2) {
  return {
    schemaVersion: 2 as const,
    profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
    transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
    goals: normalizeGoals(stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : [])),
    budgets: stripLegacyDemoBudgets(normalizeBudgets(state.budgets)),
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
  };
}

function normalizeBudgets(budgets: Budget[] | undefined) {
  if (!Array.isArray(budgets)) {
    return [];
  }

  return budgets
    .filter((budget) => budget.limitAmount > 0)
    .map((budget): Budget => ({
      ...budget,
      month: typeof budget.month === "string" && /^\d{4}-\d{2}$/.test(budget.month) ? budget.month : getCurrentMonthKey(),
      createdAt: normalizeTimestamp(budget.createdAt) ?? new Date().toISOString(),
      updatedAt: normalizeTimestamp(budget.updatedAt)
    }));
}

function normalizeAccounts(accounts: FinanceAccount[] | undefined): FinanceAccount[] {
  const normalized = Array.isArray(accounts)
    ? accounts
        .filter((account) => typeof account.name === "string" && account.name.trim())
        .map((account): FinanceAccount => ({
          ...account,
          id: typeof account.id === "string" && account.id ? account.id : `account_${crypto.randomUUID()}`,
          name: account.name.trim() === "Conta principal" ? "Carteira do casal" : account.name.trim(),
          kind:
            account.kind === "cash" ||
            account.kind === "wallet" ||
            account.kind === "savings" ||
            account.kind === "other"
              ? account.kind
              : "checking",
          owner: normalizePerson(account.owner),
          openingBalance: Number.isFinite(account.openingBalance) ? account.openingBalance : 0,
          openingBalanceDate:
            typeof account.openingBalanceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(account.openingBalanceDate)
              ? account.openingBalanceDate
              : toDateKey(),
          color: typeof account.color === "string" ? account.color : undefined,
          createdAt: typeof account.createdAt === "string" ? account.createdAt : new Date().toISOString(),
          updatedAt: normalizeTimestamp(account.updatedAt)
        }))
    : [];

  if (!normalized.some((account) => account.id === DEFAULT_FINANCE_ACCOUNT_ID)) {
    return [createDefaultFinanceAccount(), ...normalized];
  }

  return normalized;
}

function normalizeGoals(goals: Goal[] | undefined): Goal[] {
  if (!Array.isArray(goals)) {
    return [];
  }

  return goals
    .filter((goal) => typeof goal.name === "string" && goal.targetAmount > 0)
    .map((goal) => {
      const contributions = normalizeGoalContributions((goal as { contributions?: GoalContribution[] }).contributions);
      const currentAmount = Number.isFinite(goal.currentAmount) && goal.currentAmount > 0 ? goal.currentAmount : 0;

      return {
        ...goal,
        currentAmount,
        updatedAt: normalizeTimestamp(goal.updatedAt),
        contributions:
          contributions.length > 0
            ? contributions
            : currentAmount > 0
              ? [
                  {
                    id: `goal_entry_${goal.id || "legacy"}`,
                    amount: currentAmount,
                    date: normalizeDateOnly(goal.createdAt) ?? toDateKey(),
                    notes: "Saldo anterior importado.",
                    createdAt: typeof goal.createdAt === "string" ? goal.createdAt : new Date().toISOString()
                  }
                ]
              : []
      };
    });
}

function normalizeGoalContributions(contributions: GoalContribution[] | undefined): GoalContribution[] {
  if (!Array.isArray(contributions)) {
    return [];
  }

  return contributions
    .filter((contribution) => Number.isFinite(contribution.amount) && contribution.amount !== 0)
    .map((contribution) => ({
      ...contribution,
      id: typeof contribution.id === "string" ? contribution.id : `goal_entry_${crypto.randomUUID()}`,
      date:
        typeof contribution.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(contribution.date)
          ? contribution.date
          : toDateKey(),
      createdAt: typeof contribution.createdAt === "string" ? contribution.createdAt : new Date().toISOString()
    }));
}

function normalizeBills(bills: PayableBill[] | undefined): PayableBill[] {
  if (!Array.isArray(bills)) {
    return [];
  }

  const normalized = bills
    .filter((bill) => bill.amount > 0 && typeof bill.title === "string" && normalizeDateOnly(bill.dueDate))
    .map((bill): PayableBill => ({
      ...bill,
      dueDate: normalizeDateOnly(bill.dueDate) ?? toDateKey(),
      person: normalizePerson(bill.person),
      status: bill.status === "paid" || bill.status === "overdue" ? bill.status : "pending",
      recurrence: bill.recurrence === "monthly" ? "monthly" : "none",
      paymentMethod: normalizePaymentMethod(bill.paymentMethod),
      source: bill.source === "attachment" || bill.source === "import" ? bill.source : "manual",
      paidAt: normalizeTimestamp(bill.paidAt),
      createdAt: normalizeTimestamp(bill.createdAt) ?? new Date().toISOString(),
      updatedAt: normalizeTimestamp(bill.updatedAt)
    }));

  return resetAccidentallyPaidFutureBills(normalized);
}

function resetAccidentallyPaidFutureBills(bills: PayableBill[]) {
  const keepPaidIdByGroupAndPaidDate = new Map<string, string>();

  bills
    .filter((bill) => bill.status === "paid")
    .filter((bill) => Boolean(bill.recurrenceGroupId || bill.installmentGroupId))
    .filter((bill) => {
      const paidDate = getBillPaidDate(bill);
      return Boolean(paidDate && paidDate < bill.dueDate);
    })
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || (left.id ?? "").localeCompare(right.id ?? ""))
    .forEach((bill) => {
      const paidDate = getBillPaidDate(bill);
      const groupId = bill.recurrenceGroupId || bill.installmentGroupId;

      if (!paidDate || !groupId) {
        return;
      }

      const key = `${groupId}_${paidDate}`;

      if (!keepPaidIdByGroupAndPaidDate.has(key)) {
        keepPaidIdByGroupAndPaidDate.set(key, bill.id);
      }
    });

  return bills.map((bill) => {
    const paidDate = getBillPaidDate(bill);
    const groupId = bill.recurrenceGroupId || bill.installmentGroupId;

    if (
      bill.status !== "paid" ||
      !paidDate ||
      !groupId ||
      paidDate >= bill.dueDate ||
      keepPaidIdByGroupAndPaidDate.get(`${groupId}_${paidDate}`) === bill.id
    ) {
      return bill;
    }

    return {
      ...bill,
      status: "pending" as const,
      paidAt: undefined
    };
  });
}

function getBillPaidDate(bill: PayableBill) {
  return typeof bill.paidAt === "string" ? bill.paidAt.slice(0, 10) : "";
}

function normalizeActivityLogs(logs: FinanceActivityLog[] | undefined): FinanceActivityLog[] {
  if (!Array.isArray(logs)) {
    return [];
  }

  return logs
    .filter((log) => typeof log.action === "string" && typeof log.entityLabel === "string")
    .map((log) => ({
      id: typeof log.id === "string" ? log.id : `activity_${crypto.randomUUID()}`,
      actorEmail: typeof log.actorEmail === "string" && log.actorEmail ? log.actorEmail : "usuario autorizado",
      action: log.action,
      entityType:
        log.entityType === "transaction" ||
        log.entityType === "bill" ||
        log.entityType === "goal" ||
        log.entityType === "budget" ||
        log.entityType === "account" ||
        log.entityType === "tax_document" ||
        log.entityType === "labor_benefit" ||
        log.entityType === "payroll_record" ||
        log.entityType === "work_time_entry" ||
        log.entityType === "salon_material" ||
        log.entityType === "salon_recipe" ||
        log.entityType === "salon_stock_movement" ||
        log.entityType === "sync" ||
        log.entityType === "system"
          ? log.entityType
          : "system",
      entityLabel: log.entityLabel,
      details: typeof log.details === "string" ? log.details : undefined,
      createdAt: typeof log.createdAt === "string" ? log.createdAt : new Date().toISOString()
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 200);
}

// Fingerprints de dados demonstrativos pre-producao. Mantidos somente para limpeza de migracao local.
const legacyDemoTransactionFingerprints = new Set([
  3612114414,
  4057225229,
  1538124196,
  1244043720,
  4109015035,
  2536025139,
  3617946332
]);

const legacyDemoGoalFingerprints = new Set([1670746555, 1374139306, 223302076]);

const legacyDemoBudgetFingerprints = new Set([3156547588, 341645336, 3781375277]);

function stripLegacyDemoTransactions(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => {
      const source = (transaction as { source?: unknown }).source;
      return source !== "seed" && !legacyDemoTransactionFingerprints.has(fingerprintLegacyText(transaction.description));
    })
    .map((transaction): Transaction => ({
      ...transaction,
      date: normalizeDateOnly(transaction.date) ?? toDateKey(),
      person: normalizePerson(transaction.person),
      paymentMethod: transaction.paymentMethod ? normalizePaymentMethod(transaction.paymentMethod) : undefined,
      createdAt: normalizeTimestamp(transaction.createdAt) ?? new Date().toISOString(),
      updatedAt: normalizeTimestamp(transaction.updatedAt)
    }));
}

function stripLegacyDemoGoals(goals: Goal[]) {
  return goals.filter((goal) => !legacyDemoGoalFingerprints.has(fingerprintLegacyText(goal.name)));
}

function stripLegacyDemoBudgets(budgets: Budget[]) {
  return budgets.filter((budget) => !legacyDemoBudgetFingerprints.has(fingerprintLegacyText(budget.notes ?? "")));
}

function fingerprintLegacyText(value: string) {
  let hash = 2166136261;

  for (const character of value.trim().toLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHouseholdProfile(value: unknown): value is HouseholdProfile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    typeof value.slogan === "string" &&
    typeof value.monthlyIncomeTarget === "number" &&
    typeof value.emergencyReserveTarget === "number"
  );
}

function normalizeDateOnly(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00`);

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return undefined;
  }

  return `${year}-${month}-${day}`;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function normalizePerson(person: unknown): Person {
  if (person === "Deyverson" || person === "Tom" || person === "Casal") {
    return person;
  }

  if (person === "Deyveron" || person === "Pessoa 1") {
    return "Deyverson";
  }

  if (person === "Pessoa 2") {
    return "Tom";
  }

  return "Casal";
}

function normalizePaymentMethod(method: unknown): PaymentMethod {
  if (method === "cash" || method === "boleto" || method === "pix" || method === "card" || method === "other") {
    return method;
  }

  return "other";
}

function normalizeTaxDocumentKind(kind: unknown): TaxDocumentKind {
  const allowed: TaxDocumentKind[] = [
    "income_report",
    "business_income",
    "medical_receipt",
    "education_receipt",
    "bank_balance",
    "investment",
    "asset",
    "property",
    "vehicle",
    "debt",
    "dependent",
    "other"
  ];

  return allowed.includes(kind as TaxDocumentKind) ? (kind as TaxDocumentKind) : "other";
}

function normalizeTaxDocumentStatus(status: unknown): TaxDocumentStatus {
  if (status === "reviewed" || status === "ready") {
    return status;
  }

  return "pending";
}

function normalizeLaborBenefitType(type: unknown): LaborBenefitType {
  const allowed: LaborBenefitType[] = [
    "fgts",
    "inss",
    "salary",
    "thirteenth_salary",
    "vacation",
    "benefit",
    "other"
  ];

  return allowed.includes(type as LaborBenefitType) ? (type as LaborBenefitType) : "other";
}

function normalizePayrollRecordStatus(status: unknown): PayrollRecordStatus {
  if (status === "reviewed" || status === "attention") {
    return status;
  }

  return "pending_review";
}

function normalizeOptionalPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : undefined;
}

function normalizePositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeSalonMaterialUnit(unit: unknown): SalonMaterialUnit {
  return unit === "ml" ? "ml" : "unit";
}

function normalizeSalonStockMovementType(type: unknown): SalonStockMovementType {
  if (type === "purchase" || type === "adjustment" || type === "usage" || type === "waste") {
    return type;
  }

  return "adjustment";
}

function normalizeTime(value: unknown, fallback: string) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function normalizeOptionalTime(value: unknown) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : undefined;
}

function normalizeWorkPunches(value: unknown, legacyStart?: string, legacyEnd?: string) {
  const raw = Array.isArray(value) ? value : [];
  const punches = raw
    .map((item) => normalizeOptionalTime(item))
    .filter((item): item is string => Boolean(item));

  if (punches.length > 0) {
    return Array.from(new Set(punches)).slice(0, 4);
  }

  return [legacyStart, legacyEnd].filter((item): item is string => Boolean(item));
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getDefaultExpectedMinutesForDate(date: string) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return weekday >= 1 && weekday <= 5 ? 528 : 0;
}
