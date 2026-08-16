# Implementation Report - QR Code Visivel em Despesas

## Arquivos modificados

- `modules/finance/components/expenses-page.tsx`
- `modules/finance/components/financial-document-review.tsx`
- `docs/CHANGELOG.md`

## Decisoes arquiteturais

- A leitura fiscal por QR Code foi mantida no fluxo existente de `/api/maya/receipt`, evitando nova rota e nova migration.
- A interface ganhou uma acao explicita `Ler QR Code`, usando camera do celular quando disponivel.
- O rascunho continua obrigatoriamente revisavel antes de salvar, preservando a regra de nao registrar despesas automaticamente sem confirmacao humana.
- Quando a leitura fiscal identifica QR, URL fiscal, conteudo do QR, chave de acesso ou CNPJ, esses dados aparecem na revisao do anexo.

## Dependencias adicionadas

- Nenhuma.

## Possiveis impactos

- Navegadores sem `BarcodeDetector` podem nao extrair o payload do QR localmente, mas a MAYA ainda tenta interpretar a imagem enviada.
- Fotos tremidas, com reflexo ou QR cortado podem gerar rascunho parcial e pedir preenchimento manual.

## Pendencias

- Testar em celular real com cupom NFC-e recente e QR bem enquadrado.
- Avaliar biblioteca dedicada de QR Code no futuro se for necessario ampliar suporte em navegadores sem leitura nativa.

## Proximos passos recomendados

- Validar com nota fiscal real de mercado.
- Confirmar que o anexo aparece em outro dispositivo via Supabase Storage.
- Conferir se a Vercel possui `OPENAI_API_KEY` ativa para o processamento da MAYA.
