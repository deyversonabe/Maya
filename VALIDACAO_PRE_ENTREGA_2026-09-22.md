# MAYA — Validação pré-entrega do pacote universal de documentos

Data: 2026-09-22

## Objetivo

Este pacote unifica a entrada de documentos humanamente legíveis da MAYA. Onde o contexto é leitura de documento, a interface oferece caminhos explícitos para **tirar foto** e **escolher foto ou PDF**. Importadores estruturados permanecem especializados: OFX continua OFX, CSV continua CSV e XML continua XML.

## Critério de unificação

Quando havia versões duplicadas, foi preservada a implementação canônica de melhor função e desempenho. Em empate funcional, foi usada a versão mais recente. As árvores duplicadas acidentais foram removidas em vez de manter duas implementações concorrentes.

Não existem no pacote:

- `app/app/`
- `modules/modules/`
- `tests/tests/`
- `lib/lib/`
- `scripts/scripts/`
- `public/public/`
- `supabase/migrations/migrations/`
- `supabase/migrations/supabase/`

## Estrutura universal criada

- `modules/finance/components/universal-document-picker.tsx`
- `modules/finance/lib/file-kind.ts`
- `modules/finance/lib/document-payload.ts`

O seletor universal oferece dois caminhos independentes:

1. câmera: `image/*` + `capture="environment"`;
2. arquivo: `image/*,application/pdf,.pdf`.

O pipeline comum valida o arquivo e encaminha a mesma rotina de leitura da página.

## Fluxo de PDF

Para PDF financeiro:

1. detecta PDF por MIME ou extensão `.pdf`;
2. tenta upload para Storage privado;
3. prefere URL assinada temporária;
4. usa base64 somente como fallback para PDF pequeno;
5. a API server-side valida a origem da URL;
6. a MAYA envia o PDF como `input_file` à camada de IA;
7. o retorno é um rascunho revisável;
8. nada é lançado automaticamente.

No Extrato, o prompt exige leitura de todas as páginas do PDF e a reconciliação continua determinística no TypeScript.

## Superfícies revisadas

Documentos: Despesas, Extratos, Contas, Dashboard/cadastro rápido, Horas/Ponto, Materiais do salão e documentos fiscais passam pelo padrão universal quando a operação representa leitura de documento.

Especializados e mantidos separados: QR fiscal, XML fiscal, CSV e OFX.

## Validações executadas neste ambiente

- auditoria de produção: **PASS** — 13 artefatos críticos, 0 avisos;
- auditoria de captura universal: **PASS** — 13 verificações;
- parser TypeScript: **PASS** — 149 arquivos TS/TSX, 0 erros de sintaxe;
- resolução de imports internos: **PASS** — 0 imports internos não resolvidos, desconsiderando referência gerada de `.next`;
- scan de árvores duplicadas proibidas: **PASS**;
- coerência `package.json` x raiz do `package-lock.json`: **PASS**;
- scan de segredos de alta confiança: **PASS** — nenhum segredo real identificado;
- smoke test dos helpers de arquivo/payload: **PASS**;
- smoke test do contrato do Extrato (PDF base64, URL assinada e URL externa recusada): **PASS**;
- smoke test de reconciliação determinística do extrato: **PASS**.

## Limitação da validação local

A tentativa de `npm ci` neste ambiente não concluiu por timeout/indisponibilidade do registro/cache de pacotes. Por isso, este relatório **não declara** `npm test`, `npm run typecheck` ou `npm run build` como reexecutados integralmente depois das alterações desta entrega.

Antes de merge/deploy, executar em branch/CI com acesso ao npm:

```bash
npm ci
npm test
npm run typecheck
npm run audit:production
npm run audit:documents
npm run build
npm audit
```

Production deve permanecer bloqueada se qualquer gate falhar.

## Dependências

Este pacote preserva `package.json` e `package-lock.json` coerentes da base canônica. Não foi recriada à força a atualização de segurança de Next/sharp citada em relatório anterior porque o lockfile regenerado daquela sessão não estava disponível e o ambiente atual não conseguiu acessar o npm de forma confiável. A atualização deve ser refeita em branch com `npm`, regenerando o lockfile e repetindo todos os gates.

## Regra de segurança do produto

IA interpreta e propõe. Validação determinística confere. Usuário revisa e confirma. Somente depois o estado financeiro oficial pode ser alterado.
