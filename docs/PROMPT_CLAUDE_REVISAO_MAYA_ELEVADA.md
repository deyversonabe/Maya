# Prompt para revisao final no Claude

Abra este repositorio e trate `docs/reference/Guia-Implantacao-Maya-Elevada-2026-09-20.pdf` como especificacao funcional.

Sua tarefa e auditar a implementacao, nao reescrever o produto.

1. Execute `npm ci`, `npm test`, `npm run typecheck`, `npm run audit:production` e `npm run build`.
2. Corrija somente erros comprovados e repita todos os gates.
3. Confirme que IA/WhatsApp/Open Finance/OFX nunca gravam dinheiro sem confirmacao humana explicita.
4. Confirme que `ready` significa apenas validacao automatica consistente e ainda exige confirmacao.
5. Teste foto, print, PDF, nota/recibo, extrato, WhatsApp texto/audio/imagem/PDF, OFX e Open Finance.
6. Confirme que documentos e linhas de extrato permanecem editaveis antes de confirmar e que registros confirmados continuam editaveis nas telas normais.
7. Valide reconciliacao de extrato, duplicidade e idempotencia.
8. Audite segredos: nenhuma service role/API secret pode chegar ao navegador.
9. Confirme a semantica: Resultado do periodo != Saldo atual; Saldo apos contas = Saldo atual - Contas nao pagas.
10. Revise o layout para evitar duplicacao de campos, acoes com nomes concorrentes e menus excessivos. Nao remova funcionalidade util; coloque funcoes secundarias em `Mais`.
11. Para Open Finance, valide o fluxo Pluggy apenas se as credenciais estiverem configuradas; OFX deve continuar funcionando sem Pluggy.
12. Nao apague dados historicos automaticamente. Qualquer limpeza deve ser auditada e reversivel.

Ao terminar, entregue: arquivos alterados, testes, resultado dos cinco gates, riscos remanescentes e passos externos ainda necessarios.
