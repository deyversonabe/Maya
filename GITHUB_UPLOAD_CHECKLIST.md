# Checklist de atualização do GitHub — MAYA

## Forma recomendada

Evite **Add files via upload** para substituir o projeto inteiro. Foi esse tipo de fluxo que anteriormente gerou árvores como `modules/modules` e `tests/tests`.

Use Git em uma branch nova:

```bash
git checkout main
git pull --ff-only
git checkout -b fix/universal-document-capture-2026-09-22
```

Substitua o conteúdo do repositório pelo conteúdo **interno** deste pacote, preservando apenas a pasta `.git` do clone.

Depois confira que não existem pastas duplicadas e rode:

```bash
npm ci
npm test
npm run typecheck
npm run audit:production
npm run audit:documents
npm run build
npm audit
```

Somente com os gates verdes:

```bash
git add -A
git commit -m "Unify document capture for camera images and PDFs"
git push -u origin fix/universal-document-capture-2026-09-22
```

Abra PR para `main`, valide o Vercel Preview e teste um PDF real de extrato antes do merge.

## Critério de aceite do Extrato

Um PDF real deve gerar `BankStatementDraft` revisável, com todas as páginas consideradas. Antes de confirmar, o saldo não pode mudar. Após a confirmação, cada movimento deve ser aplicado no máximo uma vez e passar pelas regras de duplicidade/reconciliação.
