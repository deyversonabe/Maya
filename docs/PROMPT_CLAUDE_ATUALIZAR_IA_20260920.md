# Prompt para Claude — conferir atualização da IA do Maya

Revise o projeto Maya fornecido e valide especificamente a atualização dos modelos OpenAI.

Objetivo da configuração atual:

- `OPENAI_MODEL=gpt-6-astra` para análise financeira e conversa da MAYA.
- `OPENAI_PDF_MODEL=gpt-5.6-terra` para leitura de PDFs e extração estruturada.
- `OPENAI_VISION_MODEL=gpt-5.6-terra` para imagens, notas, extratos e OCR.

Regras:

1. Não troque o motor financeiro determinístico por cálculo gerado pela IA.
2. A IA pode interpretar, resumir e orientar, mas valores de saldo, resultado do período, contas, projeções e regras financeiras devem continuar vindo do código validado.
3. Preserve a Responses API (`/v1/responses`).
4. Preserve `OPENAI_API_KEY` somente no servidor.
5. Preserve todos os fallbacks locais quando a OpenAI estiver ausente, indisponível ou devolver saída inválida.
6. Verifique `modules/ai/maya.ts`, `.env.example`, `docs/DEPLOYMENT.md` e `docs/IA_GUIDELINES.md`.
7. Confirme que variáveis de ambiente na Vercel têm prioridade sobre defaults do código.
8. Na Vercel, configure Production e Preview com:
   - `OPENAI_MODEL=gpt-6-astra`
   - `OPENAI_PDF_MODEL=gpt-5.6-terra`
   - `OPENAI_VISION_MODEL=gpt-5.6-terra`
9. Execute `npm ci`, `npm test`, `npm run typecheck` e `npm run build`.
10. Teste pelo menos: conversa da MAYA, leitura de foto de comprovante, leitura de extrato por imagem e leitura de PDF.
11. Não faça downgrade silencioso para `gpt-5-mini` ou `gpt-4o-mini`.
12. Se `gpt-6-astra` não estiver habilitado na conta/projeto OpenAI, informe o erro real e use temporariamente `gpt-5.6-sol` ou `gpt-5.6-terra` somente depois de documentar a limitação.

Ao final, entregue um relatório com modelos efetivamente usados, testes realizados, erros encontrados, arquivos alterados e confirmação de build.
