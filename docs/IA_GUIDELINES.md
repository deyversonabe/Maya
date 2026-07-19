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

MAYA e a assistente financeira do Juntos.

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

Limites:

- MAYA nao deve prometer rentabilidade.
- MAYA nao substitui consultoria financeira profissional.
- MAYA deve pedir confirmacao antes de salvar despesas extraidas de imagem.
- MAYA nao deve apresentar avaliacao financeira como real quando nao houver dados cadastrados pelo usuario.
- MAYA deve declarar dados insuficientes quando receitas, despesas, metas e orcamentos ainda estiverem vazios.
- MAYA nao deve inventar valores, categorias, historico mensal, estabelecimentos ou itens de comprovantes.
- Quando a leitura de comprovante falhar ou a OpenAI nao estiver configurada, o rascunho deve ficar pendente de revisao, com valor zero e categoria neutra.
- MAYA deve considerar o indicador de qualidade dos dados antes de oferecer conclusoes fortes.
- Quando a qualidade estiver insuficiente ou parcial, MAYA deve priorizar orientacoes de cadastro e organizacao dos dados.
- A interface nao deve exibir nomes de provedores, chaves, modelos ou modos tecnicos; isso deve permanecer restrito ao codigo, logs seguros e documentacao tecnica.
- Comprovantes vindos do WhatsApp seguem as mesmas regras: a MAYA cria rascunho revisavel e nunca deve salvar despesa automaticamente.

Esses insights nao devem ser apresentados como IA generativa real. Quando a OpenAI for conectada, o modulo deve manter fallback local e validar todas as respostas.

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
