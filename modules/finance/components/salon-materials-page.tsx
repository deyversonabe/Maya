"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { AlertTriangle, Calculator, CalendarClock, ClipboardList, DollarSign, FileScan, Layers, Package, Pencil, Plus, RefreshCw, Save, ShoppingBag, Trash2, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { cn, financialValueClass, formatCurrency, parseFinancialAmountInput, toInputDate } from "@/lib/utils";
import { mayaFetch } from "@/lib/api-client";
import { DEFAULT_FINANCE_ACCOUNT_ID, incomeCategories } from "../data/defaults";
import { fileToFinanceAttachment } from "../lib/image-upload";
import { useFinanceStore } from "../lib/use-finance-store";
import type {
  FinancialDocumentDraft,
  PaymentMethod,
  Person,
  SalonMaterial,
  SalonMaterialUnit,
  SalonRecipeItem,
  SalonSaleInput,
  SalonServiceRecipe,
  SalonStockMovement,
  SalonStockMovementType,
  Transaction
} from "../types";

const materialCategories = [
  "Sobrancelha",
  "Henna",
  "Brow lamination",
  "Micropigmentacao",
  "Cabelo",
  "Higiene",
  "Descartaveis",
  "Limpeza",
  "Outros"
];
const personOptions: Person[] = ["Deyverson", "Tom", "Casal"];
const paymentOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "card", label: "Cartao" },
  { value: "other", label: "Outro" }
];
const stockMovementOptions: Array<{ value: SalonStockMovementType; label: string }> = [
  { value: "purchase", label: "Entrada" },
  { value: "adjustment", label: "Ajuste positivo" },
  { value: "waste", label: "Perda/baixa manual" }
];

type MaterialForm = {
  id: string;
  name: string;
  category: string;
  unit: SalonMaterialUnit;
  packageQuantity: string;
  packageCost: string;
  stockQuantity: string;
  minStockQuantity: string;
  lotNumber: string;
  expirationDate: string;
  supplier: string;
  notes: string;
};

type RecipeForm = {
  id: string;
  name: string;
  category: string;
  price: string;
  active: boolean;
  notes: string;
  items: Array<{ id: string; materialId: string; quantity: string }>;
};

type SaleForm = {
  recipeId: string;
  clientName: string;
  amount: string;
  date: string;
  person: Person;
  paymentMethod: PaymentMethod;
  accountId: string;
  notes: string;
};

type StockForm = {
  materialId: string;
  type: SalonStockMovementType;
  quantity: string;
  date: string;
  reason: string;
  notes: string;
};

type InventoryForm = {
  materialId: string;
  countedQuantity: string;
  date: string;
  notes: string;
};

type PurchaseDraftItem = {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  amount?: number;
  materialId: string;
};

type DuplicateSaleReview = {
  input: SalonSaleInput;
  matches: Transaction[];
};

export function SalonMaterialsPage() {
  const { state, actions } = useFinanceStore();
  const [feedback, setFeedback] = useState("");
  const [materialForm, setMaterialForm] = useState<MaterialForm>(() => createEmptyMaterialForm());
  const [recipeForm, setRecipeForm] = useState<RecipeForm>(() => createEmptyRecipeForm());
  const [saleForm, setSaleForm] = useState<SaleForm>(() => createEmptySaleForm(state.salonServiceRecipes[0]));
  const [stockForm, setStockForm] = useState<StockForm>(() => createEmptyStockForm(state.salonMaterials[0]));
  const [inventoryForm, setInventoryForm] = useState<InventoryForm>(() => createEmptyInventoryForm(state.salonMaterials[0]));
  const [targetMarginPercent, setTargetMarginPercent] = useState("70");
  const [reportMonth, setReportMonth] = useState(() => toInputDate(new Date()).slice(0, 7));
  const [composeRecipeId, setComposeRecipeId] = useState("");
  const [purchaseDraftItems, setPurchaseDraftItems] = useState<PurchaseDraftItem[]>([]);
  const [isReadingPurchaseNote, setIsReadingPurchaseNote] = useState(false);
  const [duplicateReview, setDuplicateReview] = useState<DuplicateSaleReview | null>(null);

  const materialsById = useMemo(
    () => new Map(state.salonMaterials.map((material) => [material.id, material])),
    [state.salonMaterials]
  );
  const activeRecipes = state.salonServiceRecipes.filter((recipe) => recipe.active);
  const selectedRecipe = state.salonServiceRecipes.find((recipe) => recipe.id === saleForm.recipeId) ?? activeRecipes[0];
  const recipeCost = selectedRecipe ? calculateRecipeCost(selectedRecipe, materialsById) : 0;
  const parsedSaleAmount = parseFinancialAmountInput(saleForm.amount);
  const saleMargin = Number.isFinite(parsedSaleAmount) ? parsedSaleAmount - recipeCost : 0;
  const lowStockMaterials = state.salonMaterials.filter((material) => material.stockQuantity <= material.minStockQuantity);
  const expiringMaterials = state.salonMaterials.filter((material) => getDaysUntil(material.expirationDate) <= 30);
  const recentMovements = state.salonStockMovements.slice(0, 8);
  const stockInsights = useMemo(
    () => buildStockInsights(state.salonMaterials, state.salonStockMovements),
    [state.salonMaterials, state.salonStockMovements]
  );
  const salonReport = useMemo(
    () => buildSalonReport(state.transactions, state.salonStockMovements, materialsById, reportMonth),
    [materialsById, reportMonth, state.salonStockMovements, state.transactions]
  );
  const targetMargin = parseFinancialAmountInput(targetMarginPercent);
  const suggestedPrice =
    selectedRecipe && Number.isFinite(targetMargin) && targetMargin > 0 && targetMargin < 100
      ? recipeCost / (1 - targetMargin / 100)
      : 0;

  function submitMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildMaterialPayload(materialForm);

    if (!payload) {
      setFeedback("Preencha nome, quantidade do pacote, custo do pacote e estoque atual.");
      return;
    }

    if (materialForm.id) {
      actions.updateSalonMaterial(materialForm.id, payload);
      setFeedback("Material atualizado no estoque do salao.");
    } else {
      actions.addSalonMaterial(payload);
      setFeedback("Material cadastrado. Agora ele pode entrar em uma ficha de servico.");
    }

    setMaterialForm(createEmptyMaterialForm());
  }

  function submitStockMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = parseFinancialAmountInput(stockForm.quantity);

    if (!stockForm.materialId || !Number.isFinite(quantity) || quantity <= 0 || !stockForm.date) {
      setFeedback("Escolha o material, informe a quantidade e a data do movimento.");
      return;
    }

    actions.registerSalonStockMovement({
      materialId: stockForm.materialId,
      type: stockForm.type,
      quantity,
      reason: stockForm.reason.trim() || getStockMovementLabel(stockForm.type),
      date: stockForm.date,
      notes: stockForm.notes.trim() || undefined
    });
    setFeedback("Movimento de estoque registrado sem gerar valor financeiro.");
    setStockForm(createEmptyStockForm(state.salonMaterials.find((material) => material.id === stockForm.materialId)));
  }

  function submitInventoryCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const countedQuantity = parseFinancialAmountInput(inventoryForm.countedQuantity);

    if (!inventoryForm.materialId || !Number.isFinite(countedQuantity) || countedQuantity < 0 || !inventoryForm.date) {
      setFeedback("Escolha o material e informe a quantidade real contada.");
      return;
    }

    actions.setSalonInventoryCount({
      materialId: inventoryForm.materialId,
      countedQuantity,
      date: inventoryForm.date,
      notes: inventoryForm.notes.trim() || undefined
    });
    setFeedback("Inventario registrado. O estoque foi ajustado para a quantidade real contada.");
    setInventoryForm(createEmptyInventoryForm(state.salonMaterials.find((material) => material.id === inventoryForm.materialId)));
  }

  function submitRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildRecipePayload(recipeForm);

    if (!payload) {
      setFeedback("Preencha nome, preco e pelo menos um material com quantidade valida.");
      return;
    }

    if (recipeForm.id) {
      actions.updateSalonServiceRecipe(recipeForm.id, payload);
      setFeedback("Ficha de servico atualizada.");
    } else {
      actions.addSalonServiceRecipe(payload);
      setFeedback("Ficha criada. Ela ja pode ser usada para registrar uma venda.");
    }

    setRecipeForm(createEmptyRecipeForm());
  }

  function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseFinancialAmountInput(saleForm.amount);
    const recipe = state.salonServiceRecipes.find((item) => item.id === saleForm.recipeId);

    if (!recipe || !Number.isFinite(amount) || amount <= 0 || !saleForm.clientName.trim()) {
      setFeedback("Escolha a ficha, informe valor e nome da cliente antes de salvar.");
      return;
    }

    const insufficient = getInsufficientMaterials(recipe, materialsById);

    if (insufficient.length > 0) {
      setFeedback(`Estoque insuficiente para: ${insufficient.join(", ")}.`);
      return;
    }

    const input: SalonSaleInput = {
      recipeId: recipe.id,
      clientName: saleForm.clientName.trim(),
      amount,
      date: saleForm.date,
      person: saleForm.person,
      paymentMethod: saleForm.paymentMethod,
      accountId: saleForm.accountId || DEFAULT_FINANCE_ACCOUNT_ID,
      notes: saleForm.notes.trim() || undefined
    };
    const duplicates = state.transactions.filter(
      (transaction) =>
        transaction.type === "income" &&
        transaction.date === input.date &&
        Math.abs(transaction.amount - input.amount) < 0.000001
    );

    if (duplicates.length > 0) {
      setDuplicateReview({ input, matches: duplicates });
      setFeedback("Encontrei renda com mesmo valor no mesmo dia. Confirme se esta venda deve entrar mesmo assim.");
      return;
    }

    saveSale(input);
  }

  function saveSale(input: SalonSaleInput) {
    try {
      actions.registerSalonSale(input);
      setDuplicateReview(null);
      setSaleForm(createEmptySaleForm(selectedRecipe));
      setFeedback("Venda salva como receita e estoque baixado pela ficha de material.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel registrar a venda agora.");
    }
  }

  function editMaterial(material: SalonMaterial) {
    setMaterialForm({
      id: material.id,
      name: material.name,
      category: material.category,
      unit: material.unit,
      packageQuantity: String(material.packageQuantity),
      packageCost: String(material.packageCost),
      stockQuantity: String(material.stockQuantity),
      minStockQuantity: String(material.minStockQuantity),
      supplier: material.supplier ?? "",
      lotNumber: material.lotNumber ?? "",
      expirationDate: material.expirationDate ?? "",
      notes: material.notes ?? ""
    });
    setFeedback("Editando material. Salve para atualizar o custo individual e estoque.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePurchaseNoteFile(file: File) {
    setIsReadingPurchaseNote(true);
    setFeedback("MAYA esta lendo a nota de compra e procurando itens para estoque...");

    try {
      const attachment = await fileToFinanceAttachment(file);
      const response = await mayaFetch("/api/maya/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: attachment.imageDataUrl,
          fileName: file.name,
          documentKind: "expense"
        })
      });
      const result = (await response.json()) as {
        financialDraft?: FinancialDocumentDraft;
        message?: string;
      };
      const items = (result.financialDraft?.items ?? [])
        .filter((item) => item.name?.trim())
        .map((item): PurchaseDraftItem => ({
          id: `purchase_item_${crypto.randomUUID()}`,
          name: item.name.trim(),
          quantity: Number.isFinite(item.quantity) && item.quantity ? Math.max(1, item.quantity) : 1,
          unit: item.unit,
          amount: Number.isFinite(item.amount) ? item.amount : item.unitPrice,
          materialId: findMaterialByName(state.salonMaterials, item.name)?.id ?? ""
        }));

      setPurchaseDraftItems(items);
      setFeedback(
        items.length > 0
          ? `${items.length} item(ns) encontrados. Revise antes de jogar no estoque.`
          : "A MAYA nao encontrou itens claros nessa nota. Use entrada manual de estoque."
      );
    } catch (error) {
      setFeedback(
        error instanceof Error && error.message === "image_too_large"
          ? "A imagem ficou grande demais para leitura. Tente uma foto mais proxima e nitida."
          : "Nao consegui ler a nota de compra agora. Use a entrada manual de estoque."
      );
    } finally {
      setIsReadingPurchaseNote(false);
    }
  }

  function applyPurchaseDraftItem(item: PurchaseDraftItem) {
    if (!item.materialId) {
      setFeedback("Selecione um material existente ou crie o material antes de lancar a entrada.");
      return;
    }

    actions.registerSalonStockMovement({
      materialId: item.materialId,
      type: "purchase",
      quantity: item.quantity,
      reason: `Nota de compra: ${item.name}`,
      date: toInputDate(new Date()),
      notes: item.amount ? `Valor lido da nota: ${formatCurrency(item.amount)}` : undefined
    });
    setPurchaseDraftItems((current) => current.filter((draftItem) => draftItem.id !== item.id));
    setFeedback("Item da nota lancado como entrada de estoque. Nenhuma despesa financeira foi criada automaticamente.");
  }

  function preloadMaterialFromPurchaseItem(item: PurchaseDraftItem) {
    setMaterialForm({
      ...createEmptyMaterialForm(),
      name: item.name,
      unit: item.unit?.toLowerCase().includes("ml") ? "ml" : "unit",
      packageQuantity: String(item.quantity || 1),
      packageCost: item.amount ? String(item.amount) : "",
      stockQuantity: String(item.quantity || 1),
      notes: "Criado a partir de nota de compra lida pela MAYA."
    });
    setFeedback("Revise os dados do material lido na nota e salve para entrar no estoque.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editRecipe(recipe: SalonServiceRecipe) {
    setRecipeForm({
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      price: String(recipe.price),
      active: recipe.active,
      notes: recipe.notes ?? "",
      items: recipe.items.map((item) => ({
        id: item.id,
        materialId: item.materialId,
        quantity: String(item.quantity)
      }))
    });
    setFeedback("Editando ficha de servico. As proximas vendas usarao a versao atualizada.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <LedPanel className="p-4 sm:p-6" glow="cyan">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div>
              <p className="eyebrow mb-2">Studio de beleza</p>
              <h1 className="font-serif text-4xl font-bold text-bronze sm:text-5xl">Materiais e custos</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-cream/82">
                Controle o estoque por unidade ou ml, monte fichas de servico e registre vendas com baixa automatica de material.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2">
              <Metric label="Materiais" value={String(state.salonMaterials.length)} icon={<Package />} />
              <Metric label="Fichas" value={String(state.salonServiceRecipes.length)} icon={<ClipboardList />} />
              <Metric label="Baixo estoque" value={String(lowStockMaterials.length)} icon={<AlertTriangle />} tone={lowStockMaterials.length > 0 ? "warning" : "success"} />
              <Metric label="Validade" value={String(expiringMaterials.length)} icon={<CalendarClock />} tone={expiringMaterials.length > 0 ? "warning" : "success"} />
              <Metric label="Margem mes" value={formatCurrency(salonReport.grossMargin)} icon={<TrendingUp />} tone={salonReport.grossMargin >= 0 ? "success" : "warning"} />
            </div>
          </div>
        </LedPanel>

        {feedback ? (
          <div className="rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 p-3 text-sm font-bold text-cyan-100 shadow-neon">
            {feedback}
          </div>
        ) : null}

        {duplicateReview ? (
          <Card className="border-neon-amber/35 bg-neon-amber/10">
            <CardHeader eyebrow="Conferencia" title="Possivel venda duplicada" />
            <div className="space-y-3 text-sm text-cream/80">
              <p>
                Ja existe renda com o mesmo valor na mesma data. Confirme apenas se for outro atendimento real.
              </p>
              <div className="grid gap-2">
                {duplicateReview.matches.map((transaction) => (
                  <div key={transaction.id} className="rounded-lg border border-cream/10 bg-moss-950/50 p-3">
                    <strong className="text-cream">{transaction.description}</strong>
                    <span className="ml-2 text-muted">{transaction.paymentRecipient ?? "sem cliente"}</span>
                    <span className="ml-2 text-bronze">{formatCurrency(transaction.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveSale(duplicateReview.input)}>
                  <Save className="size-4" />
                  Salvar mesmo assim
                </Button>
                <Button variant="ghost" onClick={() => setDuplicateReview(null)}>
                  Revisar antes
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader eyebrow="Estoque" title={materialForm.id ? "Editar material" : "Novo material"} />
            <form className="grid gap-3" onSubmit={submitMaterial}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Label>
                  Material
                  <Input value={materialForm.name} onChange={(event) => setMaterialForm({ ...materialForm, name: event.target.value })} placeholder="Ex: Henna castanho medio" />
                </Label>
                <Label>
                  Categoria
                  <Select value={materialForm.category} onChange={(event) => setMaterialForm({ ...materialForm, category: event.target.value })}>
                    {materialCategories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </Select>
                </Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Label>
                  Medida
                  <Select value={materialForm.unit} onChange={(event) => setMaterialForm({ ...materialForm, unit: event.target.value as SalonMaterialUnit })}>
                    <option value="unit">Unidade</option>
                    <option value="ml">ml</option>
                  </Select>
                </Label>
                <Label>
                  Qtd. no pacote
                  <Input inputMode="decimal" value={materialForm.packageQuantity} onChange={(event) => setMaterialForm({ ...materialForm, packageQuantity: event.target.value })} placeholder="Ex: 100" />
                </Label>
                <Label>
                  Custo pacote
                  <Input inputMode="decimal" value={materialForm.packageCost} onChange={(event) => setMaterialForm({ ...materialForm, packageCost: event.target.value })} placeholder="Ex: 29,90" />
                </Label>
                <Label>
                  Estoque atual
                  <Input inputMode="decimal" value={materialForm.stockQuantity} onChange={(event) => setMaterialForm({ ...materialForm, stockQuantity: event.target.value })} placeholder="Ex: 80" />
                </Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Label>
                  Estoque minimo
                  <Input inputMode="decimal" value={materialForm.minStockQuantity} onChange={(event) => setMaterialForm({ ...materialForm, minStockQuantity: event.target.value })} placeholder="Ex: 10" />
                </Label>
                <Label>
                  Lote
                  <Input value={materialForm.lotNumber} onChange={(event) => setMaterialForm({ ...materialForm, lotNumber: event.target.value })} placeholder="Opcional" />
                </Label>
                <Label>
                  Validade
                  <Input type="date" value={materialForm.expirationDate} onChange={(event) => setMaterialForm({ ...materialForm, expirationDate: event.target.value })} />
                </Label>
                <Label>
                  Fornecedor
                  <Input value={materialForm.supplier} onChange={(event) => setMaterialForm({ ...materialForm, supplier: event.target.value })} placeholder="Opcional" />
                </Label>
              </div>
              <Label>
                Observacoes
                <Textarea value={materialForm.notes} onChange={(event) => setMaterialForm({ ...materialForm, notes: event.target.value })} placeholder="Lote, validade, marca ou detalhes importantes." />
              </Label>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="info">Custo individual: {formatCurrency(getUnitCostFromForm(materialForm))} / {materialForm.unit === "ml" ? "ml" : "un."}</Badge>
                <div className="flex flex-wrap gap-2">
                  {materialForm.id ? (
                    <Button variant="ghost" onClick={() => setMaterialForm(createEmptyMaterialForm())}>
                      Cancelar edicao
                    </Button>
                  ) : null}
                  <Button type="submit">
                    <Save className="size-4" />
                    Salvar material
                  </Button>
                </div>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader eyebrow="Ficha tecnica" title={recipeForm.id ? "Editar receita de servico" : "Criar receita de servico"} />
            <form className="grid gap-3" onSubmit={submitRecipe}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Label className="sm:col-span-1">
                  Servico
                  <Input value={recipeForm.name} onChange={(event) => setRecipeForm({ ...recipeForm, name: event.target.value })} placeholder="Ex: Design de sobrancelha" />
                </Label>
                <Label>
                  Categoria da renda
                  <Select value={recipeForm.category} onChange={(event) => setRecipeForm({ ...recipeForm, category: event.target.value })}>
                    {incomeCategories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </Select>
                </Label>
                <Label>
                  Preco sugerido
                  <Input inputMode="decimal" value={recipeForm.price} onChange={(event) => setRecipeForm({ ...recipeForm, price: event.target.value })} placeholder="Ex: 45,00" />
                </Label>
              </div>

              <div className="grid gap-2">
                {recipeForm.items.map((item, index) => (
                  <div key={item.id} className="grid gap-2 rounded-xl border border-cream/10 bg-cream/[0.03] p-2 sm:grid-cols-[1fr_9rem_auto]">
                    <Select
                      value={item.materialId}
                      onChange={(event) => updateRecipeItem(index, { materialId: event.target.value })}
                      aria-label="Material da ficha"
                    >
                      <option value="">Selecione material</option>
                      {state.salonMaterials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.name} ({material.unit === "ml" ? "ml" : "un."})
                        </option>
                      ))}
                    </Select>
                    <Input
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(event) => updateRecipeItem(index, { quantity: event.target.value })}
                      placeholder="Qtd."
                      aria-label="Quantidade usada"
                    />
                    <Button variant="ghost" className="min-h-10 px-3" onClick={() => removeRecipeItem(index)} aria-label="Remover item da ficha">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={addRecipeItem}>
                  <Plus className="size-4" />
                  Adicionar material
                </Button>
                <Select value={composeRecipeId} onChange={(event) => setComposeRecipeId(event.target.value)} className="w-full sm:w-64">
                  <option value="">Somar ficha existente</option>
                  {state.salonServiceRecipes
                    .filter((recipe) => recipe.id !== recipeForm.id)
                    .map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        {recipe.name}
                      </option>
                    ))}
                </Select>
                <Button variant="ghost" onClick={mergeSelectedRecipeIntoForm}>
                  <Layers className="size-4" />
                  Combinar
                </Button>
                <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-cream/10 bg-cream/[0.04] px-3 text-sm font-black text-muted">
                  <input
                    type="checkbox"
                    checked={recipeForm.active}
                    onChange={(event) => setRecipeForm({ ...recipeForm, active: event.target.checked })}
                    className="size-4 accent-cyan-300"
                  />
                  Ficha ativa
                </label>
              </div>
              <Label>
                Observacoes
                <Textarea value={recipeForm.notes} onChange={(event) => setRecipeForm({ ...recipeForm, notes: event.target.value })} placeholder="Tempo medio, cuidados, variacoes do servico." />
              </Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Metric label="Custo material" value={formatCurrency(calculateRecipeFormCost(recipeForm, materialsById))} icon={<Package />} />
                <Metric label="Preco" value={formatCurrency(parseFinancialAmountInput(recipeForm.price) || 0)} icon={<DollarSign />} />
                <Metric
                  label="Margem"
                  value={formatCurrency((parseFinancialAmountInput(recipeForm.price) || 0) - calculateRecipeFormCost(recipeForm, materialsById))}
                  icon={<ShoppingBag />}
                  tone={(parseFinancialAmountInput(recipeForm.price) || 0) - calculateRecipeFormCost(recipeForm, materialsById) >= 0 ? "success" : "warning"}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {recipeForm.id ? (
                  <Button variant="ghost" onClick={() => setRecipeForm(createEmptyRecipeForm())}>
                    Cancelar edicao
                  </Button>
                ) : null}
                <Button type="submit">
                  <Save className="size-4" />
                  Salvar ficha
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader eyebrow="Venda" title="Registrar atendimento" />
            <form className="grid gap-3" onSubmit={submitSale}>
              <Label>
                Ficha de servico
                <Select
                  value={saleForm.recipeId}
                  onChange={(event) => {
                    const recipe = state.salonServiceRecipes.find((item) => item.id === event.target.value);
                    setSaleForm({
                      ...saleForm,
                      recipeId: event.target.value,
                      amount: recipe ? String(recipe.price) : saleForm.amount
                    });
                  }}
                >
                  <option value="">Selecione</option>
                  {activeRecipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </option>
                  ))}
                </Select>
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Label>
                  Cliente / quem pagou
                  <Input value={saleForm.clientName} onChange={(event) => setSaleForm({ ...saleForm, clientName: event.target.value })} placeholder="Nome da cliente" />
                </Label>
                <Label>
                  Valor recebido
                  <Input inputMode="decimal" value={saleForm.amount} onChange={(event) => setSaleForm({ ...saleForm, amount: event.target.value })} placeholder="Ex: 45,00" />
                </Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Label>
                  Data
                  <Input type="date" value={saleForm.date} onChange={(event) => setSaleForm({ ...saleForm, date: event.target.value })} />
                </Label>
                <Label>
                  Pessoa
                  <Select value={saleForm.person} onChange={(event) => setSaleForm({ ...saleForm, person: event.target.value as Person })}>
                    {personOptions.map((person) => (
                      <option key={person}>{person}</option>
                    ))}
                  </Select>
                </Label>
                <Label>
                  Pagamento
                  <Select value={saleForm.paymentMethod} onChange={(event) => setSaleForm({ ...saleForm, paymentMethod: event.target.value as PaymentMethod })}>
                    {paymentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Label>
                <Label>
                  Carteira
                  <Select value={saleForm.accountId} onChange={(event) => setSaleForm({ ...saleForm, accountId: event.target.value })}>
                    {state.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </Label>
              </div>
              <Label>
                Observacoes
                <Textarea value={saleForm.notes} onChange={(event) => setSaleForm({ ...saleForm, notes: event.target.value })} placeholder="Opcional" />
              </Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Metric label="Material" value={formatCurrency(recipeCost)} icon={<Package />} />
                <Metric label="Receita cheia" value={formatCurrency(Number.isFinite(parsedSaleAmount) ? parsedSaleAmount : 0)} icon={<DollarSign />} />
                <Metric label="Margem estimada" value={formatCurrency(saleMargin)} icon={<ShoppingBag />} tone={saleMargin >= 0 ? "success" : "warning"} />
              </div>
              <Button type="submit" className="w-full">
                <ShoppingBag className="size-4" />
                Salvar venda e baixar estoque
              </Button>
            </form>
          </Card>

          <Card>
            <CardHeader eyebrow="Estoque" title="Entrada e ajuste manual" />
            <form className="grid gap-3" onSubmit={submitStockMovement}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Label>
                  Material
                  <Select value={stockForm.materialId} onChange={(event) => setStockForm({ ...stockForm, materialId: event.target.value })}>
                    <option value="">Selecione</option>
                    {state.salonMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name}
                      </option>
                    ))}
                  </Select>
                </Label>
                <Label>
                  Tipo
                  <Select value={stockForm.type} onChange={(event) => setStockForm({ ...stockForm, type: event.target.value as SalonStockMovementType })}>
                    {stockMovementOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Label>
                  Quantidade
                  <Input inputMode="decimal" value={stockForm.quantity} onChange={(event) => setStockForm({ ...stockForm, quantity: event.target.value })} placeholder="Ex: 20" />
                </Label>
                <Label>
                  Data
                  <Input type="date" value={stockForm.date} onChange={(event) => setStockForm({ ...stockForm, date: event.target.value })} />
                </Label>
              </div>
              <Label>
                Motivo
                <Input value={stockForm.reason} onChange={(event) => setStockForm({ ...stockForm, reason: event.target.value })} placeholder="Ex: compra, ajuste de contagem, perda" />
              </Label>
              <Label>
                Observacoes
                <Textarea value={stockForm.notes} onChange={(event) => setStockForm({ ...stockForm, notes: event.target.value })} placeholder="Nao gera despesa nem receita." />
              </Label>
              <Button type="submit" variant="secondary">
                <Plus className="size-4" />
                Registrar movimento
              </Button>
            </form>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader
              eyebrow="Dashboard do salao"
              title="Margem por periodo"
              action={
                <Input
                  type="month"
                  value={reportMonth}
                  onChange={(event) => setReportMonth(event.target.value)}
                  className="w-40"
                  aria-label="Mes do relatorio do salao"
                />
              }
            />
            <div className="grid gap-2 sm:grid-cols-4">
              <Metric label="Vendas" value={String(salonReport.salesCount)} icon={<ShoppingBag />} />
              <Metric label="Receita" value={formatCurrency(salonReport.revenue)} icon={<DollarSign />} tone="success" />
              <Metric label="Material" value={formatCurrency(salonReport.materialCost)} icon={<Package />} />
              <Metric label="Margem" value={formatCurrency(salonReport.grossMargin)} icon={<TrendingUp />} tone={salonReport.grossMargin >= 0 ? "success" : "warning"} />
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-cream/10 bg-cream/[0.03] p-3">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-muted">Servicos no periodo</h3>
                <div className="mt-3 grid gap-2">
                  {salonReport.byService.length === 0 ? (
                    <EmptyLine text="Nenhuma venda de salao neste periodo." />
                  ) : (
                    salonReport.byService.slice(0, 6).map((item) => (
                      <div key={item.name} className="rounded-lg border border-cream/10 bg-moss-950/45 p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-cream">{item.name}</strong>
                          <Badge tone="info">{item.count} venda(s)</Badge>
                        </div>
                        <p className="mt-1 text-muted">
                          Receita {formatCurrency(item.revenue)} | material {formatCurrency(item.materialCost)}
                        </p>
                        <p className={cn("font-black", financialValueClass(item.margin, "text-neon-green"))}>
                          Margem {formatCurrency(item.margin)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-cream/10 bg-cream/[0.03] p-3">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-muted">Materiais mais usados</h3>
                <div className="mt-3 grid gap-2">
                  {salonReport.materialUsage.length === 0 ? (
                    <EmptyLine text="Baixas de material por venda aparecerao aqui." />
                  ) : (
                    salonReport.materialUsage.slice(0, 6).map((item) => (
                      <div key={item.materialId} className="rounded-lg border border-cream/10 bg-moss-950/45 p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-cream">{item.name}</strong>
                          <span className="text-bronze">{formatCurrency(item.cost)}</span>
                        </div>
                        <p className="mt-1 text-muted">
                          {formatQuantity(item.quantity)} {item.unit === "ml" ? "ml" : "un."} consumidos
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="Preco ideal" title="Calculadora de margem" />
            <div className="grid gap-3">
              <Label>
                Ficha analisada
                <Select
                  value={saleForm.recipeId}
                  onChange={(event) => {
                    const recipe = state.salonServiceRecipes.find((item) => item.id === event.target.value);
                    setSaleForm({
                      ...saleForm,
                      recipeId: event.target.value,
                      amount: recipe ? String(recipe.price) : saleForm.amount
                    });
                  }}
                >
                  <option value="">Selecione</option>
                  {activeRecipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Margem desejada (%)
                <Input inputMode="decimal" value={targetMarginPercent} onChange={(event) => setTargetMarginPercent(event.target.value)} placeholder="Ex: 70" />
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Metric label="Custo atual" value={formatCurrency(recipeCost)} icon={<Package />} />
                <Metric label="Preco minimo" value={formatCurrency(suggestedPrice)} icon={<Calculator />} tone="success" />
              </div>
              <p className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 p-3 text-sm font-bold text-cyan-100">
                Use o preco minimo como referencia comercial. O valor real da renda continua sendo o valor recebido na venda.
              </p>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader eyebrow="Reposicao" title="Compras planejadas" action={<RefreshCw className="size-5 text-bronze" />} />
            {stockInsights.length === 0 ? (
              <EmptyLine text="Cadastre materiais e vendas para a Maya estimar reposicao." />
            ) : (
              <div className="grid gap-2">
                {stockInsights.slice(0, 8).map((insight) => (
                  <div key={insight.material.id} className="rounded-xl border border-cream/10 bg-cream/[0.035] p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-cream">{insight.material.name}</strong>
                      <Badge tone={insight.alert ? "warning" : "success"}>{insight.alert ? "Repor" : "Ok"}</Badge>
                    </div>
                    <p className="mt-1 text-muted">
                      Estoque {formatQuantity(insight.material.stockQuantity)} {insight.material.unit === "ml" ? "ml" : "un."} | minimo {formatQuantity(insight.material.minStockQuantity)}
                    </p>
                    <p className="text-bronze">
                      Sugestao de compra: {formatQuantity(insight.suggestedBuyQuantity)} {insight.material.unit === "ml" ? "ml" : "un."}
                    </p>
                    <p className="text-muted">
                      Estimativa: {formatFiniteEstimate(insight.remainingServices, "atendimento(s)")} ou {formatFiniteEstimate(insight.remainingDays, "dia(s)")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader eyebrow="Validade e inventario" title="Conferencia fisica" />
            <form className="grid gap-3" onSubmit={submitInventoryCount}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Label>
                  Material contado
                  <Select value={inventoryForm.materialId} onChange={(event) => setInventoryForm({ ...inventoryForm, materialId: event.target.value })}>
                    <option value="">Selecione</option>
                    {state.salonMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name}
                      </option>
                    ))}
                  </Select>
                </Label>
                <Label>
                  Quantidade real
                  <Input inputMode="decimal" value={inventoryForm.countedQuantity} onChange={(event) => setInventoryForm({ ...inventoryForm, countedQuantity: event.target.value })} placeholder="Contagem fisica" />
                </Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Label>
                  Data
                  <Input type="date" value={inventoryForm.date} onChange={(event) => setInventoryForm({ ...inventoryForm, date: event.target.value })} />
                </Label>
                <Label>
                  Observacao
                  <Input value={inventoryForm.notes} onChange={(event) => setInventoryForm({ ...inventoryForm, notes: event.target.value })} placeholder="Opcional" />
                </Label>
              </div>
              <Button type="submit" variant="secondary">
                <ClipboardList className="size-4" />
                Ajustar pelo inventario
              </Button>
            </form>

            <div className="mt-4 grid gap-2">
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-muted">Vencendo em ate 30 dias</h3>
              {expiringMaterials.length === 0 ? (
                <EmptyLine text="Nenhum material com validade proxima cadastrada." />
              ) : (
                expiringMaterials.map((material) => (
                  <div key={material.id} className="rounded-lg border border-neon-amber/25 bg-neon-amber/10 p-3 text-sm">
                    <strong className="text-cream">{material.name}</strong>
                    <p className="text-muted">
                      Validade {material.expirationDate} | lote {material.lotNumber || "nao informado"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader eyebrow="Nota de compra" title="Ler itens para estoque" action={<FileScan className="size-5 text-bronze" />} />
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="grid gap-3">
              <Label>
                Anexar foto da nota de material
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={isReadingPurchaseNote}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handlePurchaseNoteFile(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </Label>
              <p className="rounded-xl border border-cream/10 bg-cream/[0.035] p-3 text-sm text-muted">
                A leitura cria apenas rascunhos para entrada de estoque. Ela nao lanca despesa, boleto ou Pix automaticamente.
              </p>
            </div>
            <div className="grid gap-2">
              {purchaseDraftItems.length === 0 ? (
                <EmptyLine text="Os itens lidos da nota aparecerao aqui para revisao." />
              ) : (
                purchaseDraftItems.map((item) => (
                  <div key={item.id} className="grid gap-2 rounded-xl border border-cream/10 bg-cream/[0.035] p-3 md:grid-cols-[1fr_12rem_auto_auto] md:items-end">
                    <div>
                      <strong className="text-cream">{item.name}</strong>
                      <p className="text-sm text-muted">
                        {formatQuantity(item.quantity)} {item.unit ?? "un."} {item.amount ? `| ${formatCurrency(item.amount)}` : ""}
                      </p>
                    </div>
                    <Label>
                      Material
                      <Select value={item.materialId} onChange={(event) => updatePurchaseDraftItem(item.id, { materialId: event.target.value })}>
                        <option value="">Selecione</option>
                        {state.salonMaterials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name}
                          </option>
                        ))}
                      </Select>
                    </Label>
                    <Button variant="secondary" onClick={() => applyPurchaseDraftItem(item)}>
                      Entrada
                    </Button>
                    <Button variant="ghost" onClick={() => preloadMaterialFromPurchaseItem(item)}>
                      Criar material
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader eyebrow="Estoque atual" title="Materiais cadastrados" action={<Badge tone={lowStockMaterials.length > 0 ? "warning" : "success"}>{lowStockMaterials.length} alerta(s)</Badge>} />
            {state.salonMaterials.length === 0 ? (
              <EmptyLine text="Cadastre o primeiro material para montar fichas de servico." />
            ) : (
              <div className="grid gap-2">
                {state.salonMaterials.map((material) => {
                  const lowStock = material.stockQuantity <= material.minStockQuantity;
                  return (
                    <div key={material.id} className="rounded-xl border border-cream/10 bg-cream/[0.035] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-cream">{material.name}</strong>
                            <Badge tone={lowStock ? "warning" : "info"}>{material.category}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            Estoque: {formatQuantity(material.stockQuantity)} {material.unit === "ml" ? "ml" : "un."} | minimo {formatQuantity(material.minStockQuantity)}
                          </p>
                          {(material.lotNumber || material.expirationDate) ? (
                            <p className="text-sm text-muted">
                              Lote {material.lotNumber || "nao informado"} | validade {material.expirationDate || "nao informada"}
                            </p>
                          ) : null}
                          <p className="text-sm text-bronze">Custo individual: {formatCurrency(getMaterialUnitCost(material))}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" className="min-h-9 px-3" onClick={() => editMaterial(material)} aria-label={`Editar ${material.name}`}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="danger" className="min-h-9 px-3" onClick={() => actions.removeSalonMaterial(material.id)} aria-label={`Excluir ${material.name}`}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader eyebrow="Servicos" title="Fichas prontas para venda" />
            {state.salonServiceRecipes.length === 0 ? (
              <EmptyLine text="Crie uma ficha de sobrancelha, henna ou outro atendimento." />
            ) : (
              <div className="grid gap-2">
                {state.salonServiceRecipes.map((recipe) => {
                  const cost = calculateRecipeCost(recipe, materialsById);
                  const margin = recipe.price - cost;
                  return (
                    <div key={recipe.id} className="rounded-xl border border-cream/10 bg-cream/[0.035] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-cream">{recipe.name}</strong>
                            <Badge tone={recipe.active ? "success" : "neutral"}>{recipe.active ? "Ativa" : "Inativa"}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            {recipe.items.length} material(is) | venda {formatCurrency(recipe.price)} | custo {formatCurrency(cost)}
                          </p>
                          <p className={cn("text-sm font-black", financialValueClass(margin, "text-neon-green"))}>
                            Margem estimada: {formatCurrency(margin)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" className="min-h-9 px-3" onClick={() => editRecipe(recipe)} aria-label={`Editar ${recipe.name}`}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="danger" className="min-h-9 px-3" onClick={() => actions.removeSalonServiceRecipe(recipe.id)} aria-label={`Excluir ${recipe.name}`}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader eyebrow="Historico" title="Movimentos recentes de material" />
          {recentMovements.length === 0 ? (
            <EmptyLine text="As entradas, ajustes e baixas por venda aparecerao aqui." />
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {recentMovements.map((movement) => {
                const material = materialsById.get(movement.materialId);
                return (
                  <div key={movement.id} className="rounded-xl border border-cream/10 bg-cream/[0.035] p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-cream">{material?.name ?? "Material removido"}</strong>
                      <Badge tone={movement.type === "usage" || movement.type === "waste" ? "warning" : "info"}>{getStockMovementLabel(movement.type)}</Badge>
                    </div>
                    <p className="mt-1 text-muted">
                      {movement.date} | {formatQuantity(movement.quantity)} {material?.unit === "ml" ? "ml" : "un."}
                    </p>
                    <p className="text-bronze">{movement.reason}</p>
                    {movement.notes ? <p className="mt-1 text-muted">{movement.notes}</p> : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );

  function addRecipeItem() {
    setRecipeForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: `recipe_item_${crypto.randomUUID()}`,
          materialId: state.salonMaterials[0]?.id ?? "",
          quantity: ""
        }
      ]
    }));
  }

  function updateRecipeItem(index: number, patch: Partial<{ materialId: string; quantity: string }>) {
    setRecipeForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    }));
  }

  function removeRecipeItem(index: number) {
    setRecipeForm((current) => ({
      ...current,
      items: current.items.filter((_item, itemIndex) => itemIndex !== index)
    }));
  }

  function mergeSelectedRecipeIntoForm() {
    const recipe = state.salonServiceRecipes.find((item) => item.id === composeRecipeId);

    if (!recipe) {
      setFeedback("Escolha uma ficha existente para combinar.");
      return;
    }

    setRecipeForm((current) => ({
      ...current,
      items: mergeRecipeItems([
        ...current.items.map((item) => ({
          ...item,
          quantity: parseFinancialAmountInput(item.quantity)
        })),
        ...recipe.items
      ]).map((item) => ({
        ...item,
        quantity: String(item.quantity)
      }))
    }));
    setComposeRecipeId("");
    setFeedback(`Ficha ${recipe.name} somada a receita em edicao.`);
  }

  function updatePurchaseDraftItem(id: string, patch: Partial<PurchaseDraftItem>) {
    setPurchaseDraftItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }
}

function Metric({
  label,
  value,
  icon,
  tone = "info"
}: {
  label: string;
  value: string;
  icon: ReactElement;
  tone?: "info" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-cream/[0.04] p-3",
        tone === "success" && "border-neon-green/25",
        tone === "warning" && "border-neon-amber/35",
        tone === "info" && "border-neon-cyan/20"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-muted">
        <span className="text-[0.68rem] font-black uppercase tracking-[0.2em]">{label}</span>
        <span className="grid size-8 place-items-center rounded-lg border border-cream/10 bg-moss-950/55 text-bronze">
          {icon}
        </span>
      </div>
      <strong className="block truncate font-serif text-2xl text-cream">{value}</strong>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-cream/10 bg-cream/[0.03] p-4 text-sm font-bold text-muted">
      {text}
    </div>
  );
}

function createEmptyMaterialForm(): MaterialForm {
  return {
    id: "",
    name: "",
    category: materialCategories[0],
    unit: "unit",
    packageQuantity: "",
    packageCost: "",
    stockQuantity: "",
    minStockQuantity: "0",
    lotNumber: "",
    expirationDate: "",
    supplier: "",
    notes: ""
  };
}

function createEmptyRecipeForm(): RecipeForm {
  return {
    id: "",
    name: "",
    category: "Sobrancelha",
    price: "",
    active: true,
    notes: "",
    items: []
  };
}

function createEmptySaleForm(recipe?: SalonServiceRecipe): SaleForm {
  return {
    recipeId: recipe?.id ?? "",
    clientName: "",
    amount: recipe ? String(recipe.price) : "",
    date: toInputDate(new Date()),
    person: "Deyverson",
    paymentMethod: "pix",
    accountId: DEFAULT_FINANCE_ACCOUNT_ID,
    notes: ""
  };
}

function createEmptyStockForm(material?: SalonMaterial): StockForm {
  return {
    materialId: material?.id ?? "",
    type: "purchase",
    quantity: "",
    date: toInputDate(new Date()),
    reason: "",
    notes: ""
  };
}

function createEmptyInventoryForm(material?: SalonMaterial): InventoryForm {
  return {
    materialId: material?.id ?? "",
    countedQuantity: material ? String(material.stockQuantity) : "",
    date: toInputDate(new Date()),
    notes: ""
  };
}

function buildMaterialPayload(form: MaterialForm): Omit<SalonMaterial, "id" | "createdAt" | "updatedAt"> | null {
  const packageQuantity = parseFinancialAmountInput(form.packageQuantity);
  const packageCost = parseFinancialAmountInput(form.packageCost);
  const stockQuantity = parseFinancialAmountInput(form.stockQuantity);
  const minStockQuantity = parseFinancialAmountInput(form.minStockQuantity);

  if (
    !form.name.trim() ||
    !Number.isFinite(packageQuantity) ||
    packageQuantity <= 0 ||
    !Number.isFinite(packageCost) ||
    packageCost < 0 ||
    !Number.isFinite(stockQuantity) ||
    stockQuantity < 0
  ) {
    return null;
  }

  return {
    name: form.name.trim(),
    category: form.category,
    unit: form.unit,
    packageQuantity,
    packageCost,
    stockQuantity,
    minStockQuantity: Number.isFinite(minStockQuantity) ? Math.max(0, minStockQuantity) : 0,
    lotNumber: form.lotNumber.trim() || undefined,
    expirationDate: form.expirationDate || undefined,
    supplier: form.supplier.trim() || undefined,
    notes: form.notes.trim() || undefined
  };
}

function buildRecipePayload(form: RecipeForm): Omit<SalonServiceRecipe, "id" | "createdAt" | "updatedAt" | "version"> | null {
  const price = parseFinancialAmountInput(form.price);
  const items = form.items
    .map((item): SalonRecipeItem | null => {
      const quantity = parseFinancialAmountInput(item.quantity);

      if (!item.materialId || !Number.isFinite(quantity) || quantity <= 0) {
        return null;
      }

      return {
        id: item.id,
        materialId: item.materialId,
        quantity
      };
    })
    .filter((item): item is SalonRecipeItem => Boolean(item));

  if (!form.name.trim() || !Number.isFinite(price) || price <= 0 || items.length === 0) {
    return null;
  }

  return {
    name: form.name.trim(),
    category: form.category,
    price,
    active: form.active,
    notes: form.notes.trim() || undefined,
    items
  };
}

function getUnitCostFromForm(form: MaterialForm) {
  const quantity = parseFinancialAmountInput(form.packageQuantity);
  const cost = parseFinancialAmountInput(form.packageCost);

  return Number.isFinite(quantity) && quantity > 0 && Number.isFinite(cost) ? cost / quantity : 0;
}

function getMaterialUnitCost(material: SalonMaterial) {
  return material.packageQuantity > 0 ? material.packageCost / material.packageQuantity : 0;
}

function calculateRecipeCost(recipe: SalonServiceRecipe, materialsById: Map<string, SalonMaterial>) {
  return recipe.items.reduce((total, item) => {
    const material = materialsById.get(item.materialId);
    return total + (material ? getMaterialUnitCost(material) * item.quantity : 0);
  }, 0);
}

function calculateRecipeFormCost(form: RecipeForm, materialsById: Map<string, SalonMaterial>) {
  return form.items.reduce((total, item) => {
    const quantity = parseFinancialAmountInput(item.quantity);
    const material = materialsById.get(item.materialId);
    return total + (material && Number.isFinite(quantity) ? getMaterialUnitCost(material) * quantity : 0);
  }, 0);
}

function getInsufficientMaterials(recipe: SalonServiceRecipe, materialsById: Map<string, SalonMaterial>) {
  return recipe.items
    .filter((item) => {
      const material = materialsById.get(item.materialId);
      return !material || material.stockQuantity < item.quantity;
    })
    .map((item) => materialsById.get(item.materialId)?.name ?? "material removido");
}

function getStockMovementLabel(type: SalonStockMovementType) {
  if (type === "purchase") {
    return "Entrada";
  }

  if (type === "usage") {
    return "Uso em venda";
  }

  if (type === "waste") {
    return "Perda";
  }

  return "Ajuste";
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
  }).format(Number.isFinite(value) ? value : 0);
}

function getDaysUntil(date?: string) {
  if (!date) {
    return Number.POSITIVE_INFINITY;
  }

  const target = new Date(`${date}T00:00:00`);

  if (Number.isNaN(target.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  const today = new Date(`${toInputDate(new Date())}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function buildStockInsights(materials: SalonMaterial[], movements: SalonStockMovement[]) {
  const today = new Date(`${toInputDate(new Date())}T00:00:00`);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 30);

  return materials
    .map((material) => {
      const recentUsage = movements.filter((movement) => {
        if (movement.materialId !== material.id || movement.type !== "usage") {
          return false;
        }

        const date = new Date(`${movement.date}T00:00:00`);
        return !Number.isNaN(date.getTime()) && date >= cutoff;
      });
      const consumed30 = recentUsage.reduce((total, movement) => total + movement.quantity, 0);
      const dailyUse = consumed30 / 30;
      const avgPerService = recentUsage.length > 0 ? consumed30 / recentUsage.length : 0;
      const remainingDays = dailyUse > 0 ? material.stockQuantity / dailyUse : Number.POSITIVE_INFINITY;
      const remainingServices = avgPerService > 0 ? material.stockQuantity / avgPerService : Number.POSITIVE_INFINITY;
      const daysUntilExpiration = getDaysUntil(material.expirationDate);
      const suggestedBuyQuantity = Math.max(0, material.minStockQuantity * 2 - material.stockQuantity);
      const alert =
        material.stockQuantity <= material.minStockQuantity ||
        remainingDays <= 14 ||
        daysUntilExpiration <= 30;

      return {
        material,
        consumed30,
        remainingDays,
        remainingServices,
        daysUntilExpiration,
        suggestedBuyQuantity,
        alert
      };
    })
    .sort((a, b) => Number(b.alert) - Number(a.alert) || a.remainingDays - b.remainingDays || a.material.name.localeCompare(b.material.name));
}

function buildSalonReport(
  transactions: Transaction[],
  movements: SalonStockMovement[],
  materialsById: Map<string, SalonMaterial>,
  month: string
) {
  const sales = transactions.filter((transaction) => transaction.source === "salon_sale" && transaction.date.startsWith(month));
  const revenue = sales.reduce((total, transaction) => total + transaction.amount, 0);
  const materialCost = sales.reduce((total, transaction) => total + getTransactionSalonCost(transaction), 0);
  const byServiceMap = new Map<
    string,
    {
      name: string;
      count: number;
      revenue: number;
      materialCost: number;
      margin: number;
    }
  >();

  sales.forEach((transaction) => {
    const name = transaction.salonServiceName || transaction.description;
    const current = byServiceMap.get(name) ?? {
      name,
      count: 0,
      revenue: 0,
      materialCost: 0,
      margin: 0
    };
    const cost = getTransactionSalonCost(transaction);
    current.count += 1;
    current.revenue += transaction.amount;
    current.materialCost += cost;
    current.margin += transaction.amount - cost;
    byServiceMap.set(name, current);
  });

  const materialUsageMap = new Map<
    string,
    {
      materialId: string;
      name: string;
      quantity: number;
      unit: SalonMaterialUnit;
      cost: number;
    }
  >();

  movements
    .filter((movement) => movement.type === "usage" && movement.date.startsWith(month))
    .forEach((movement) => {
      const material = materialsById.get(movement.materialId);
      const current = materialUsageMap.get(movement.materialId) ?? {
        materialId: movement.materialId,
        name: material?.name ?? "Material removido",
        quantity: 0,
        unit: material?.unit ?? "unit",
        cost: 0
      };
      current.quantity += movement.quantity;
      current.cost += movement.quantity * movement.unitCost;
      materialUsageMap.set(movement.materialId, current);
    });

  return {
    salesCount: sales.length,
    revenue,
    materialCost,
    grossMargin: revenue - materialCost,
    byService: Array.from(byServiceMap.values()).sort((a, b) => b.revenue - a.revenue),
    materialUsage: Array.from(materialUsageMap.values()).sort((a, b) => b.cost - a.cost)
  };
}

function getTransactionSalonCost(transaction: Transaction) {
  if (Number.isFinite(transaction.salonMaterialCost)) {
    return transaction.salonMaterialCost ?? 0;
  }

  return (
    transaction.salonRecipeItemsSnapshot?.reduce((total, item) => total + item.quantity * item.unitCost, 0) ?? 0
  );
}

function findMaterialByName(materials: SalonMaterial[], name: string) {
  const normalizedName = normalizeSearchText(name);
  return materials.find((material) => normalizeSearchText(material.name) === normalizedName);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function mergeRecipeItems(items: Array<{ id?: string; materialId: string; quantity: number }>): SalonRecipeItem[] {
  const byMaterial = new Map<string, SalonRecipeItem>();

  items.forEach((item) => {
    if (!item.materialId || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      return;
    }

    const current = byMaterial.get(item.materialId);
    byMaterial.set(item.materialId, {
      id: current?.id ?? item.id ?? `recipe_item_${crypto.randomUUID()}`,
      materialId: item.materialId,
      quantity: (current?.quantity ?? 0) + item.quantity
    });
  });

  return Array.from(byMaterial.values());
}

function formatFiniteEstimate(value: number, suffix: string) {
  if (!Number.isFinite(value)) {
    return "sem historico";
  }

  return `${formatQuantity(Math.max(0, Math.floor(value)))} ${suffix}`;
}
