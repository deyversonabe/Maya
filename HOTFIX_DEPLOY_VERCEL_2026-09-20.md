# MAYA — Hotfix de CI/Vercel (20/09/2026)

## Causa confirmada no GitHub Actions
O repositorio atual possui uma pasta duplicada `tests/tests/`. Os arquivos nela mantem imports relativos calculados para `tests/`, por isso falham quando executados um nivel abaixo.

O log do CI do commit `2beb26e` registrou 20 arquivos de teste com falha por `ERR_MODULE_NOT_FOUND`.

Ha ainda um segundo problema independente: Vitest nao conhecia o alias TypeScript `@/*`, entao testes corretos em `tests/` tambem falhavam ao carregar modulos que usam `@/lib/...` e `@/modules/...`.

## Correcoes deste pacote
- adiciona `vitest.config.ts` com alias `@` apontando para a raiz;
- limita o Vitest aos testes canonicos `tests/*.test.ts`;
- exclui `tests/tests` do TypeScript como protecao contra pasta residual;
- mantem `npm test` simples e usando a configuracao oficial do Vitest;
- auditoria de producao passa a alertar caso `tests/tests` ainda exista.

## Limpeza obrigatoria no GitHub
Apague completamente a pasta `tests/tests/` do repositorio. Ela e duplicada e nao faz parte do ZIP canonico.

Depois confirme que existem apenas arquivos diretamente em `tests/`.

## Ordem de validacao
```
npm ci
npm test
npm run typecheck
npm run audit:production
npm run build
```

So promova o deploy se todos passarem.
