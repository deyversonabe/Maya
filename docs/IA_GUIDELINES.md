# IA Guidelines

Este documento define regras para uso de IA e OpenAI no projeto.

## Principios

- IA deve ampliar capacidade do usuario, nao remover controle quando houver risco.
- Chamadas de IA devem ser isoladas, auditaveis e testaveis.
- Saidas de IA devem ser tratadas como dados nao confiaveis ate validacao.
- Custos e limites devem ser considerados em design e arquitetura.
- Privacidade deve orientar o que e enviado, armazenado e exibido.

## Arquitetura para IA

Recursos de IA devem passar por um modulo centralizado, por exemplo:

```text
modules/
  ai/
    application/
    domain/
    infrastructure/
    prompts/
    tests/
```

Esse modulo deve concentrar:

- Cliente do provedor.
- Selecao de modelo.
- Templates de prompt.
- Validacao de entrada.
- Validacao de saida.
- Politica de retry, timeout e fallback.
- Logs seguros.
- Controle de custo e rate limit.

## Estado atual

O MVP funcional inicial possui rotas server-side prontas para OpenAI, mas tambem funciona sem chave local. Quando `OPENAI_API_KEY` estiver configurada na Vercel, a MAYA pode usar a OpenAI para analise conversacional e leitura de imagens de notas.

Nesta etapa, o app usa insights locais deterministicas:

- Categoria com maior gasto.
- Taxa de economia.
- Progresso de metas.
- Alertas de recorrencia.
- Sugestoes simples de priorizacao.

## MAYA

MAYA e a assistente financeira do Maya.

Personalidade:

- Clara.
- Acolhedora.
- Analitica.
- Nao julgadora.
- Objetiva nos proximos passos.

Responsabilidades:

- Ler o cenario financeiro atual.
- Comparar desempenho com meses anteriores.
- Avaliar crescimento ou queda.
- Sinalizar saude financeira.
- Considerar orcamentos mensais por categoria.
- Explicar riscos sem alarmismo.
- Recomendar acoes praticas.
- Ler notas e comprovantes quando OpenAI multimodal estiver ativa.
- Ler imagens de extrato bancario e separar renda/despesa quando as linhas estiverem legiveis.
- Alertar suspeitas de duplicidade por valor, data, tipo e data proxima antes de qualquer importacao.
- Nunca computar duplicidade sem aprovacao humana explicita.

Limites:

- MAYA nao deve prometer rentabilidade.
- MAYA nao substitui consultoria financeira profissional.
- MAYA deve pedir confirmacao antes de salvar despesas extraidas de imagem.
- MAYA nao deve apresentar avaliacao financeira como real quando nao houver dados cadastrados pelo usuario.
- MAYA deve declarar dados insuficientes quando receitas, despesas, metas e orcamentos ainda estiverem vazios.
- MAYA nao deve inventar valores, categorias, historico mensal, estabelecimentos ou itens de comprovantes.
- Em DANFE NF-e, DANFE NFC-e e cupom fiscal, MAYA deve usar o valor total da nota ou valor pago como `amount`; nunca deve usar imposto, desconto, troco, subtotal, base de calculo ou valor unitario como total.
- Em documentos fiscais brasileiros, MAYA deve extrair chave de acesso de 44 digitos, CNPJ, emissor, numero, serie, protocolo e itens somente quando estiverem legiveis.
- MAYA nao deve inferir conteudo interno de QR Code ou codigo de barras quando ele nao aparecer como texto legivel ou quando o frontend/backend nao tiver extraido o payload do QR.
- Quando o payload do QR fiscal for fornecido pelo sistema, MAYA pode usa-lo como evidencia auxiliar para chave de acesso, URL fiscal, CNPJ, numero, serie, valor e data, mas deve manter revisao humana antes de salvar.
- MAYA deve priorizar fidelidade de OCR em documentos financeiros: preservar centavos, nao arredondar valores, ler cabecalho, totais, vencimento, beneficiario/pagador, forma de pagamento e itens/linhas legiveis antes de tentar resumir.
- Quando uma imagem tiver muitos itens ou texto pequeno, a preparacao no cliente deve privilegiar resolucao suficiente para leitura, mesmo que o upload fique maior dentro do limite aceito pela API.
- MAYA nao deve inventar linhas de extrato, destinatarios Pix ou categorias quando o documento nao sustentar a informacao.
- Em extratos, MAYA deve ignorar saldo, limite, totais, subtotais, cabecalhos e linhas nao transacionais.
- Em extratos, valores negativos ou marcados como debito/saida devem virar `amount` positivo com `type = expense`; valores de credito/entrada devem virar `amount` positivo com `type = income`.
- A normalizacao deve aceitar datas com hora ou texto ao redor, desde que a data legivel possa ser validada em formato brasileiro ou ISO.
- A normalizacao deve aceitar aliases comuns de documentos brasileiros (`itens`, `produtos`, `emitente`, `favorecido`, `linhaDigitavel`, `pixCopiaCola`, `valorPago`, `valorAPagar`) sem transformar campos ilegiveis em dados inventados.
- Em Pix, MAYA deve preencher destinatario/remetente apenas quando estiver legivel; se nao estiver, o usuario deve completar antes de salvar.
- Itens de nota e linhas de extrato sao informativos e devem permanecer editaveis ou revisaveis antes da persistencia.
- Quando a leitura de comprovante falhar ou a OpenAI nao estiver configurada, o rascunho deve ficar pendente de revisao, com valor zero e categoria neutra.
- MAYA deve considerar o indicador de qualidade dos dados antes de oferecer conclusoes fortes.
- Quando a qualidade estiver insuficiente ou parcial, MAYA deve priorizar orientacoes de cadastro e organizacao dos dados.
- A interface nao deve exibir nomes de provedores, chaves, modelos ou modos tecnicos; isso deve permanecer restrito ao codigo, logs seguros e documentacao tecnica.
- Comprovantes vindos do WhatsApp seguem as mesmas regras: a MAYA cria rascunho revisavel e nunca deve salvar despesa automaticamente.
- Em calculos de juros, emprestimos e renegociacao, MAYA deve deixar claro quando esta fazendo estimativa com os dados fornecidos.
- MAYA deve pedir CET, taxa mensal/anual, IOF, tarifas, valor liberado, quantidade de parcelas, vencimentos, custo total e demonstrativo da divida antes de recomendar uma decisao.
- MAYA pode citar conceitos brasileiros como CET, Banco Central, CDC, Lei do Superendividamento, Procon-SP e Consumidor.gov.br, mas nao deve inventar artigos, taxas oficiais, decisoes ou normas especificas.
- MAYA nao deve se apresentar como advogada, correspondente bancaria, consultora certificada ou intermediadora de credito.
- Em cobranca abusiva, superendividamento, ameaca ou conflito juridico, MAYA deve orientar busca por canais oficiais de defesa do consumidor ou profissional habilitado.

Esses insights nao devem ser apresentados como IA generativa real. Quando a OpenAI for conectada, o modulo deve manter fallback local e validar todas as respostas.

## Ferramentas locais da MAYA

Antes de chamar IA externa, a MAYA deve tentar responder localmente perguntas objetivas sobre:

- Juros simples e compostos.
- Parcela fixa estimada.
- Avaliacao basica de proposta de emprestimo/financiamento.
- Negociacao de contas em atraso.

Essas ferramentas existem para reduzir custo, aumentar confiabilidade e evitar respostas genericas. Elas sempre devem:

- Usar somente valores fornecidos pelo usuario e dados financeiros cadastrados no estado atual.
- Manter a saude financeira e tendencia calculadas pelo modulo local.
- Retornar proximos passos verificaveis.
- Tratar resultados como estimativas, nao como contrato ou aconselhamento regulado.

## OpenAI

Regras obrigatorias:

- Chaves da OpenAI devem ficar apenas no backend ou em ambiente seguro.
- Nunca enviar a chave para o navegador.
- Usar variaveis de ambiente ou secret manager.
- Definir timeouts.
- Tratar rate limits e falhas temporarias.
- Registrar modelo, operacao, latencia, status e estimativa de uso quando possivel.
- Evitar armazenar prompts e respostas com dados sensiveis sem necessidade clara.
- Validar saidas estruturadas com schema quando a funcionalidade depender de formato.
- O modelo padrao configuravel por ambiente e `gpt-5-mini`, mantendo suporte para troca via `OPENAI_MODEL` e `OPENAI_VISION_MODEL`.
- Para leitura de comprovantes por imagem, `OPENAI_VISION_MODEL` deve apontar para um modelo com entrada de imagem. A configuracao recomendada de baixo custo e `gpt-4o-mini`.
- Imagens enviadas pelo navegador devem ser normalizadas/comprimidas antes do envio para reduzir falhas por tamanho, formato, payload ou resolucao excessiva.
- A leitura de comprovantes deve ter timeout server-side menor que o limite da funcao hospedada e retornar rascunho manual seguro se o provedor demorar, recusar a imagem, atingir limite ou devolver saida invalida.
- A leitura de extratos deve retornar lista estruturada de linhas ou fallback seguro sem salvar dados automaticamente.
- Falhas de leitura devem gerar logs seguros com categoria, status, codigo e request id quando houver, sem registrar imagem, chave, prompt sensivel ou dados financeiros desnecessarios.

## Prompts

Prompts relevantes devem ter:

- Objetivo.
- Entradas esperadas.
- Saida esperada.
- Restricoes de seguranca.
- Exemplos quando necessario.
- Versao ou historico quando alteracoes impactarem comportamento.

Prompts nao devem conter segredos, credenciais ou dados fixos de usuarios reais.

## Validacao de saida

Antes de usar saida de IA:

- Validar formato.
- Validar campos obrigatorios.
- Aplicar limites de tamanho.
- Rejeitar instrucoes inesperadas.
- Exigir confirmacao humana para acoes sensiveis.

## Custos e limites

Cada funcionalidade com IA deve definir:

- Quem pode usar.
- Limite por usuario, organizacao ou plano.
- Politica de retry.
- Comportamento quando o limite e atingido.
- Monitoramento de uso.

## Testes

Testes de recursos de IA devem cobrir:

- Entrada invalida.
- Saida malformada.
- Falha do provedor.
- Timeout.
- Limite de uso.
- Fallback.
- Parsing e validacao de resposta.

## Pendencias

- Definir casos de uso de IA do produto.
- Definir provedor e modelos por funcionalidade.
- Definir politica de armazenamento de prompts e respostas.
- Evoluir metricas de qualidade para IA alem do indicador local inicial.
