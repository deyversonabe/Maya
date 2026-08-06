# Implantacao - despesa por QR Code, chave e XML

## Entrega
- Nova rota `/expenses/note`.
- Leitura de QR Code por camera/arquivo usando `BarcodeDetector` do navegador.
- Consulta por chave de acesso de 44 digitos ou URL do QR Code.
- Importacao local de XML NF-e/NFC-e com emitente, valores, itens, pagamento e metadados fiscais.
- Rascunho editavel antes de salvar.
- Registro final como despesa, preservando itens e dados fiscais.

## Consulta externa
O projeto nao faz scraping dos portais estaduais. Para consulta automatica, configure:
- `FISCAL_NOTE_API_URL`
- `FISCAL_NOTE_API_TOKEN` (opcional)

O provedor deve aceitar `POST { accessKey, qrContent }`. O adaptador aceita nomes de campos comuns e converte para o formato interno da MAYA.

## Seguranca
- Nenhuma nota e salva automaticamente.
- O XML e processado no navegador.
- Token fiscal permanece no servidor.
