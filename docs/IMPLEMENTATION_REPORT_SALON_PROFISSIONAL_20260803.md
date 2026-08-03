# Implementation Report - Salao profissional

Data: 2026-08-03

## Arquivos criados

- Nenhum arquivo de codigo novo nesta rodada.

## Arquivos modificados

- `modules/finance/components/salon-materials-page.tsx`
- `modules/finance/types.ts`
- `modules/finance/lib/migrations.ts`
- `modules/finance/lib/use-finance-store.ts`
- `docs/FEATURES.md`
- `docs/DATABASE.md`
- `docs/USER_FLOW.md`
- `docs/ARCHITECTURE.md`
- `docs/SUPABASE_SETUP.md`
- `docs/CHANGELOG.md`

## Decisoes arquiteturais

- A aba `Salao` foi mantida dentro do dominio financeiro, mas com separacao clara entre controle operacional e fluxo de caixa.
- Estoque, inventario, validade e compras planejadas nao geram saldo financeiro.
- Venda de servico continua criando renda real pelo valor cheio recebido e baixa estoque em movimentos internos.
- Fichas tecnicas passaram a ter `version`; cada venda guarda snapshot dos materiais usados para preservar margem historica.
- Leitura de nota de compra de material cria rascunhos revisaveis para estoque, sem criar despesa automaticamente.

## Dependencias adicionadas

- Nenhuma.

## Possiveis impactos

- Materiais existentes sem lote, validade ou versao continuam validos; a migracao local normaliza campos ausentes.
- Vendas antigas do salao sem snapshot continuam usando `salonMaterialCost` quando existir.
- A leitura de nota de compra depende do mesmo endpoint de leitura de documento da MAYA e da configuracao da OpenAI.

## Pendencias

- Testar com notas reais de fornecedores do studio para calibrar quantidade, unidade e nome dos materiais lidos.
- Futuramente separar `salon_materials`, `salon_service_recipes` e `salon_stock_movements` em tabelas relacionais quando o projeto sair de MVP.

## Proximos passos recomendados

- Criar relatorio PDF especifico do salao com margem, estoque baixo e lista de compra.
- Adicionar historico de inventarios por periodo.
- Permitir custo medio ponderado de material quando houver muitas compras do mesmo item com valores diferentes.
