# Revisão de unificação — captura universal MAYA

Data: 22/09/2026
Base funcional: árvore canônica de primeiro nível do repositório MAYA, correspondente ao estado que os relatórios identificaram como mais novo/completo em relação às cópias aninhadas.

## Política de desempate usada

Quando havia versões concorrentes de uma mesma área, foi mantida a versão com maior cobertura funcional e menor duplicação. Em empate funcional, a versão canônica/mais recente foi preservada. Não foram mescladas árvores auto-aninhadas (`app/app`, `modules/modules`, `tests/tests`, `lib/lib`, `scripts/scripts`, `public/public`, `supabase/migrations/migrations`, `supabase/migrations/supabase`).

## Estrutura implantada

Toda superfície de documento humano passou a oferecer dois caminhos explícitos:

- Tirar foto pela câmera (`accept="image/*"` + `capture="environment"`).
- Escolher foto ou PDF (`accept="image/*,application/pdf,.pdf"`).

O seletor único é `modules/finance/components/universal-document-picker.tsx`.

Foram padronizadas as áreas de Despesas/nota, Extrato, Contas, Dashboard, Horas/Ponto, Materiais do salão, Ferramentas fiscais e leitura completa de nota fiscal. QR Code, XML, CSV e OFX continuam especializados porque são formatos estruturados com função própria.

## Extrato PDF

O fluxo oficial é:

`File -> validação -> Storage privado/signed URL -> fallback base64 pequeno -> /api/maya/statement -> input_file -> BankStatementDraft -> validação determinística -> revisão humana -> confirmação`.

A rota do extrato aceita imagem, URL assinada de PDF, PDF base64 e texto. Falhas de PDF usam o evento seguro `maya_statement_pdf_failed`, sem conteúdo bancário, base64, token ou URL completa. O prompt de extrato exige leitura de todas as páginas do PDF.

## Regra financeira preservada

A IA interpreta e estrutura. Ela não altera saldo diretamente. O Dashboard deixou de salvar automaticamente um documento lido quando todos os campos estavam preenchidos: agora mantém o documento em rascunho e exige confirmação no formulário.

## Verificações executadas neste pacote

- 149 arquivos TS/TSX analisados pelo parser TypeScript: 0 erro de sintaxe.
- Resolução de imports internos `@/` e relativos: OK.
- `node scripts/audit-production.mjs`: PASS, 13 artefatos críticos, 0 aviso.
- `node scripts/audit-document-capture.mjs`: PASS, 13 verificações.
- Smoke de `isPdfFile`, imagens e payload signed URL/base64: PASS.
- Smoke da rota `/api/maya/statement` para PDF base64, signed URL e rejeição de host externo: PASS.
- Smoke de reconciliação determinística de extrato: PASS.
- Diretórios duplicados proibidos: 0.
- `node_modules`, `.next`, `.env*` e `tsconfig.tsbuildinfo`: não incluídos no pacote.

## Gate que precisa rodar no ambiente com npm/CI

Este ambiente não dispõe de todos os tarballs npm em cache, então `npm ci --offline` não conseguiu instalar a árvore completa. Por isso o pacote não afirma localmente os gates completos de Vitest/typecheck/build. No GitHub/CI ou máquina com acesso ao registry, executar obrigatoriamente:

```bash
npm ci
npm test
npm run typecheck
npm run audit:production
npm run audit:documents
npm run build
```

Só promover ao Preview se todos estiverem verdes. Depois testar um extrato PDF real multipágina com `OPENAI_API_KEY` e `OPENAI_PDF_MODEL` configurados.

## Dependências

O pacote preserva o `package.json`/`package-lock.json` coerente da base canônica para não inventar um lockfile. Relatórios anteriores registram uma atualização de segurança para Next.js/sharp, mas o lockfile regenerado dessa sessão não foi fornecido junto aos três arquivos anexados atuais. Aplicar essa atualização somente com `npm` disponível, regenerar `package-lock.json` e repetir todos os gates.
