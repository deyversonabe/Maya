# Contribuindo

Este projeto deve ser desenvolvido com foco em qualidade, manutencao e evolucao de longo prazo.

## Antes de contribuir

1. Leia `docs/PROJECT_RULES.md`.
2. Verifique os documentos relacionados a area que sera alterada.
3. Entenda o impacto da mudanca em arquitetura, banco, API, UI, seguranca, IA e fluxos.
4. Atualize a documentacao afetada antes ou junto da implementacao.

## Fluxo recomendado

1. Criar ou selecionar uma tarefa clara.
2. Registrar decisoes relevantes na documentacao.
3. Implementar a mudanca com escopo pequeno e coeso.
4. Adicionar ou atualizar testes proporcionais ao risco.
5. Validar localmente.
6. Atualizar `docs/CHANGELOG.md` quando a mudanca for relevante.
7. Gerar Implementation Report.

## Definition of Done

Uma entrega esta pronta quando:

- O comportamento solicitado foi implementado.
- A documentacao viva foi atualizada.
- O codigo segue `docs/CODE_STYLE.md`.
- A arquitetura segue `docs/ARCHITECTURE.md`.
- As APIs e dados seguem `docs/API.md` e `docs/DATABASE.md` quando aplicavel.
- Estados de erro, loading e bordas foram considerados.
- Testes foram adicionados ou a ausencia deles foi justificada.
- Nao ha segredos ou dados sensiveis expostos.
- O Implementation Report foi entregue.

## Revisao

Revisoes devem priorizar:

- Bugs e regressao de comportamento.
- Falhas de seguranca ou privacidade.
- Quebras de contrato de API.
- Acoplamento indevido.
- Duplicacao que prejudique manutencao.
- Documentacao desatualizada.
- Falta de testes em areas criticas.

## Commits e branches

Quando houver Git configurado:

- Branches devem ter nomes descritivos.
- Commits devem ser pequenos e explicar a intencao.
- Mudancas independentes nao devem ser misturadas no mesmo commit.
- PRs devem incluir resumo, validacao, riscos e links de documentacao alterada.
