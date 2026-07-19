# Security

Este documento descreve os principios de seguranca e privacidade do projeto.

## Principios

- Seguranca por padrao.
- Menor privilegio.
- Defesa em profundidade.
- Minimizacao de dados.
- Auditoria para acoes sensiveis.
- Falhas devem ser seguras e observaveis.

## Segredos

- Chaves, tokens, senhas e credenciais nunca devem ser commitados.
- Segredos devem ficar em variaveis de ambiente, vault ou secret manager.
- Logs nao devem conter segredos.
- Arquivos `.env` reais devem ser ignorados pelo controle de versao.
- Exemplos devem usar `.env.example` sem valores reais.

## Autenticacao e autorizacao

Quando implementadas:

- Autenticacao deve ser centralizada.
- Autorizacao deve ocorrer no backend.
- Permissoes devem considerar organizacao, papel e escopo.
- Sessoes e tokens devem ter expiracao e estrategia de revogacao.
- Acoes sensiveis devem exigir verificacao adicional quando necessario.

## Dados sensiveis

Dados pessoais, financeiros, credenciais, prompts sensiveis e conteudos privados devem ser classificados e protegidos.

Regras:

- Coletar apenas o necessario.
- Mascarar informacoes sensiveis em logs e telas administrativas.
- Definir politica de retencao antes de armazenar dados de alto risco.
- Considerar LGPD para tratamento de dados pessoais.

## Persistencia local temporaria

O MVP funcional inicial salva dados financeiros no navegador do usuario. Essa decisao torna o app utilizavel sem backend, mas possui limites:

- Dados ficam restritos ao dispositivo e navegador.
- Limpar o armazenamento do navegador pode apagar dados.
- Nao ha sincronizacao entre dispositivos.
- Nao ha controle de acesso por usuario.

Por isso, o app deve oferecer exportacao de backup e deixar claro que Supabase/PostgreSQL e autenticacao sao proximos passos obrigatorios para uso sensivel em producao.

## Aplicacao web

Quando houver frontend/backend:

- Validar entrada no backend.
- Sanitizar conteudo renderizado.
- Proteger contra XSS, CSRF, SQL injection, SSRF e abuso de upload.
- Usar HTTPS em ambientes reais.
- Configurar CORS de forma restritiva.
- Definir headers de seguranca.

## IA e OpenAI

Recursos de IA devem seguir tambem `docs/IA_GUIDELINES.md`.

Regras de seguranca:

- Nao enviar segredos ou dados sensiveis desnecessarios a modelos.
- Reduzir ou anonimizar dados quando possivel.
- Validar saidas antes de executar acoes.
- Registrar uso com metadados seguros para auditoria e custo.
- Implementar limites de consumo e protecao contra abuso.

## MAYA e comprovantes

Ao enviar foto de nota ou comprovante:

- A imagem deve ser enviada apenas para rota server-side.
- A chave OpenAI deve existir somente em ambiente seguro.
- A resposta deve gerar rascunho, nao lancamento automatico.
- O usuario deve confirmar antes de salvar qualquer despesa.
- Imagens nao devem ser persistidas nesta etapa; apenas metadados e dados confirmados.

## WhatsApp

- O webhook do WhatsApp deve validar `WHATSAPP_VERIFY_TOKEN` no desafio inicial.
- Eventos recebidos devem validar `x-hub-signature-256` com `WHATSAPP_APP_SECRET` quando configurado.
- Tokens do WhatsApp devem existir apenas em variaveis de ambiente.
- Imagens recebidas devem ser processadas no servidor e nao devem ser armazenadas nesta etapa.
- A resposta para o usuario deve ser curta, segura e sem IDs internos.
- Mensagens recebidas de numeros nao mapeados a um casal nao devem salvar dados financeiros automaticamente.
- Despesas vindas do WhatsApp devem permanecer como rascunho ate revisao humana.

## Central de Dados e Confianca

- A rota de status do sistema deve informar apenas capacidades configuradas, nunca valores de segredos.
- A tela de dados deve deixar claro quando algo e local, configurado, planejado ou nao conectado.
- Backup JSON deve ser acao iniciada pelo usuario.
- Limpeza de dados locais deve ser acao explicita do usuario.
- Futuras conexoes financeiras devem exigir consentimento claro, escopo definido, prazo e revogacao.
- Nesta etapa, nenhuma conexao Open Finance ou bancaria real deve ser apresentada como ativa.

## Resposta a incidentes

Ao identificar vulnerabilidade ou incidente:

1. Conter o impacto.
2. Revogar ou rotacionar segredos afetados.
3. Preservar evidencias tecnicas seguras.
4. Corrigir a causa raiz.
5. Registrar o incidente e a mitigacao.
6. Adicionar testes ou verificacoes para prevenir recorrencia.

## Auditoria de seguranca (2026-07-19)

Revisao completa de seguranca realizada nesta data. Mudancas aplicadas:

- Headers HTTP de seguranca adicionados em `next.config.mjs`: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy e Permissions-Policy.
- Webhook do WhatsApp reforcado com verificacao explicita de `WHATSAPP_ENABLED` antes de processar qualquer payload, alem da validacao de assinatura ja existente.
- Confirmado que nenhuma chave secreta (OpenAI, WhatsApp) e exposta ao cliente; apenas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` sao publicas, o que e seguro por design (protegidas por Row Level Security).
- Confirmado que imagens de comprovantes nao sao persistidas em nenhuma camada; apenas o rascunho estruturado retorna ao cliente.
- Recomendacao futura (ainda nao implementada): reduzir o volume de dados financeiros brutos enviados a OpenAI em `generateMayaAnalysis`, e priorizar autenticacao real de usuario (ex.: Supabase Auth) antes de uso com dados sensiveis reais em producao, ja que hoje qualquer pessoa com acesso ao navegador ve todos os dados locais.

## Pendencias

- Definir mecanismo de autenticacao.
- Definir matriz inicial de papeis e permissoes.
- Definir politica formal de retencao de dados.
- Definir processo de gestao de segredos por ambiente.

- Priorizar autenticacao real de usuario (ex.: Supabase Auth) como proximo passo critico antes de qualquer uso com dados financeiros reais e sensiveis em producao.
- Avaliar rate limiting nas rotas de IA (`/api/maya/analyze` e `/api/maya/receipt`) para reduzir custo e risco de abuso.
