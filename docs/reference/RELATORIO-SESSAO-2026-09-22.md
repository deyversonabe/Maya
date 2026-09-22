# Relatório da sessão — MAYA (app financeiro)

Data: 22/09/2026 · Repositório: github.com/deyversonabe/Maya · Branch: `main`

Base: commit `69ccdec` · Trabalho: **3 commits** prontos no `maya-fix.bundle`
(187 arquivos tocados: 6 criados, 14 alterados, 167 removidos — as remoções são as
pastas duplicadas). Tudo validado: **81 testes, typecheck, audit e build = OK**.

> ⚠️ Nada disso está no ar ainda: as correções estão no bundle, mas o GitHub
> continua no commit antigo `69ccdec`. Falta **publicar** (o push é seu). Ver a seção final.

---

## 1. Diagnóstico do deploy quebrado (o pedido inicial)

O build do Vercel falhava no type check com:
`Cannot find module '../../../lib/utils'` em `modules/modules/finance/lib/migrations.ts`.

**Causa raiz:** o upload manual pelo site do GitHub ("Add files via upload") aninhou
pastas dentro delas mesmas — `modules/modules/`, `app/app/`, `lib/lib/`,
`public/public/`, `scripts/scripts/`, `tests/tests/` e até `supabase/migrations/`
em 3–4 níveis. Essas cópias antigas entravam no type check com imports quebrados e
derrubavam o build inteiro.

## 2. Correção do build

- Comparei arquivo por arquivo e confirmei que a versão de nível 1 é a mais nova e
  completa (nada único se perdeu nas cópias).
- Removi todas as pastas duplicadas aninhadas (167 arquivos mortos a menos).
- Provei a correção: `tsc`, `npm run build` e a suíte de testes passam.

## 3. Captura universal de documentos (foto / câmera / PDF)

- Novo componente **`UniversalDocumentPicker`** com dois caminhos separados
  ("Tirar foto" e "Escolher foto ou PDF") — nunca só a câmera, para não prender o
  usuário no celular quando ele quer anexar PDF.
- Helper puro **`isPdfFile`** (detecta PDF por tipo **ou** extensão `.pdf`, cobrindo o
  caso de MIME vazio no celular) e **`buildDocumentReadPayload`** (usa URL assinada do
  Storage primeiro; base64 só como reserva).
- Padronizei **todas** as telas de documento: Despesas (nota **e** extrato), Contas,
  Dashboard, Materiais do salão, Horas/Ponto, Ferramentas fiscais. Nota fiscal ganhou
  câmera + galeria para o QR. **OFX, CSV e XML seguem importadores próprios**, como pedido.
- **Extrato PDF:** instrução explícita para ler **todas as páginas**; log de erro
  estruturado e seguro (`maya_statement_pdf_failed`, sem vazar dados) e mensagens de
  erro específicas por causa.
- Testes novos: `file-kind`, `document-payload` e integração do route do extrato
  (base64 / URL assinada / rejeições).

## 4. Toast de sincronização em excesso

- "Dados sincronizados online." aparecia a cada save automático, poluindo a tela.
- Agora saves de rotina são **silenciosos**; o aviso só aparece em caso de erro e na
  recuperação depois de um erro.

## 5. Limpeza de UX estilo app de banco (fase 1)

- Navegação reduzida a uma barra principal de **5 abas**:
  **Início · Extrato · Despesas · Contas · MAYA**.
- Menu **"Mais"** reorganizado por contexto: **Planejar** (Relatórios, Meses,
  Orçamentos, Metas) · **Importar** (Capturas, Trazer do banco) · **Negócio**
  (Salão, Horas, Fiscal) · **Sistema**.
- **Salão e Horas** seguem acessíveis; **Admin/Dados** ficaram discretos (só admin, no
  grupo Sistema).
- **Duplicações removidas:** o formulário completo de Metas saiu do Dashboard (fica só
  na aba Metas); a faixa de "features" de marketing saiu do Início. Código morto
  associado também foi removido.
- **Fase 2 (pendente, a seu critério):** fundir Despesas + Receitas + Meses num
  **Extrato único** de verdade, estilo conta bancária.

## 6. Frente GitHub

- Estado remoto hoje: **`69ccdec`** (o commit antigo, com o bug). Nenhum dos 3 commits
  de correção foi publicado. É por isso que "nada mudou" e o deploy segue com erro.

## 7. Frente Supabase (revisão)

Para o app funcionar de verdade depois do build passar, o Supabase precisa de:
- **Variáveis** (no Vercel): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `OPENAI_API_KEY` (e `OPENAI_PDF_MODEL` para o extrato PDF).
- **Tabela** `finance_workspace_states` (sincronização do estado na nuvem).
- **Bucket** `maya-finance-attachments` (anexos e PDF por URL assinada).
- As **16 migrations** no repositório criam a tabela e o bucket — precisam estar
  aplicadas no banco.
- Observação do audit: `PLUGGY_CLIENT_SECRET` aparece como variável não documentada
  (aviso pré-existente, não bloqueia).

Isso é secundário por enquanto: enquanto o build não passar, o Supabase nem entra em jogo.

---

## O que falta para tudo isso entrar no ar

1. **Publicar o `maya-fix.bundle` no GitHub** (o push é seu — eu não tenho sua conta).
   Você optou por **conectar o computador** a esta sessão pelo app do Claude (desktop);
   assim eu aplico e a gente faz o push juntos, sem você digitar comando.
2. O Vercel detecta o push e refaz o deploy — dessa vez deve passar.
3. Conferir as variáveis e o Supabase (seção 7).
4. Testar o extrato PDF real no Preview (único item que só dá para validar no ar).

## Arquivos entregues nesta sessão
- `maya-fix.bundle` — as 3 correções, prontas para publicar.
- `COMO-APLICAR.md` — passo a passo do git.
- `RELATORIO-FINAL.md` — detalhe técnico da captura de documentos (20 itens).
- `RELATORIO-SESSAO.md` — este resumo.
