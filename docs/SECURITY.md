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

## Persistencia local e sincronizacao

Sem Supabase configurado, o MVP funcional salva dados financeiros no navegador do usuario. Essa decisao torna o app utilizavel sem backend, mas possui limites:

- Dados ficam restritos ao dispositivo e navegador.
- Limpar o armazenamento do navegador pode apagar dados.
- Nao ha sincronizacao entre dispositivos.
- Nao ha controle de acesso por usuario.

Com Supabase configurado, o app habilita conta por e-mail/senha e sincroniza o estado financeiro em um workspace compartilhado por membros autorizados.

Regras de seguranca:

- A chave anonima do Supabase pode ficar no frontend, mas o acesso aos dados depende de RLS.
- A `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser enviada ao navegador, nunca deve usar prefixo `NEXT_PUBLIC_` e nunca deve ser colocada em codigo de cliente.
- Scripts administrativos que usam service role devem ser executados localmente por administrador e sem registrar segredos em log.
- Senhas iniciais de usuarios devem ser definidas fora do GitHub e trocadas no primeiro acesso quando possivel.
- Senhas curtas de 4 digitos so sao aceitaveis como bootstrap temporario em ambiente controlado; para dados financeiros reais, usar senhas fortes.
- As tabelas `finance_workspaces`, `finance_workspace_members` e `finance_workspace_states` devem permitir acesso apenas a usuarios membros do workspace.
- Criar usuario no Supabase Auth nao deve liberar dados automaticamente; o usuario precisa ser membro do workspace compartilhado.
- Cadastro publico pelo frontend deve permanecer desativado; criacao de usuario e autorizacao de workspace sao tarefas administrativas.
- Com Supabase ativo, dados financeiros nao devem ficar visiveis quando a sessao estiver bloqueada ou encerrada.
- Fechamento de aba e inatividade devem marcar a sessao como bloqueada e exigir senha no retorno.
- Dados locais sao usados como cache e fallback.
- Ao entrar, dados locais podem ser enviados para a nuvem compartilhada do workspace autenticado.
- Anexos otimizados devem usar Supabase Storage privado quando `maya-finance-attachments` estiver configurado.
- URLs de anexo devem ser assinadas e temporarias; o bucket nao deve ser publico.
- `attachmentDataUrl` deve ser tratado apenas como fallback temporario para ambientes sem bucket.
- Historico de atividades deve registrar acoes operacionais sem gravar segredos ou conteudo bruto de comprovantes.
- Backups continuam disponiveis como copia manual controlada pelo usuario.
- Painel admin deve exigir usuario com papel `admin` no backend, usando access token Supabase e service role apenas no servidor.
- Usuario bloqueado em `finance_workspace_members.status` nao deve acessar dados do workspace nem passar pela funcao `is_finance_workspace_member`.
- `last_seen_at` deve ser atualizado por funcao segura no banco, nunca por permissao ampla de update em membros.
- Push real deve usar chaves VAPID em variaveis de ambiente; somente a chave publica pode usar `NEXT_PUBLIC_`.
- Rotina de envio push deve exigir `CRON_SECRET` e registrar entregas para reduzir repeticao.
- Inscricoes push expiradas ou rejeitadas devem ser desativadas.

## Aplicacao web

Quando houver frontend/backend:

- Validar entrada no backend.
- Sanitizar conteudo renderizado.
- Proteger contra XSS, CSRF, SQL injection, SSRF e abuso de upload.
- Usar HTTPS em ambientes reais.
- Configurar CORS de forma restritiva.
- Definir headers de seguranca.

## Headers HTTP de seguranca

O projeto aplica headers globais em `next.config.mjs` para todas as rotas.

Headers configurados:

- `Content-Security-Policy`: restringe origem padrao a `self`, bloqueia objetos, bloqueia carregamento em frames de terceiros e limita imagens, fontes, conexoes e workers.
- `Strict-Transport-Security`: reforca uso de HTTPS em producao.
- `X-Frame-Options`: impede uso da aplicacao dentro de iframe externo.
- `X-Content-Type-Options`: evita interpretacao incorreta de tipos de arquivo.
- `Referrer-Policy`: reduz vazamento de contexto ao navegar para outros dominios.
- `Permissions-Policy`: bloqueia microfone, geolocalizacao, pagamentos, USB e rastreamento por cohort; camera fica permitida apenas para a propria origem porque o produto possui anexos por camera.

Observacoes:

- `script-src` e `style-src` permitem inline por compatibilidade com Next.js/React nesta etapa. Uma politica com nonce/hash deve ser avaliada quando a aplicacao tiver pipeline de seguranca mais maduro.
- `connect-src` permite a propria origem e dominios Supabase para preparo futuro de sincronizacao/autenticacao.

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
- Imagens confirmadas pelo usuario podem ser mantidas no armazenamento local nesta etapa para compor anexos de contas/despesas.
- Quando Supabase Storage estiver configurado, imagens confirmadas devem ser salvas no bucket privado `maya-finance-attachments`.
- Leituras da MAYA devem verificar possivel duplicidade por data e valor antes de salvar renda ou despesa.
- Imagens enviadas pelo navegador devem ser otimizadas para reduzir tamanho, ficar abaixo do limite de payload da funcao e remover metadados carregados no arquivo original quando possivel.
- Falhas do provedor de IA devem ser registradas apenas com metadados seguros, como categoria, status, codigo e request id; nunca com chave, imagem ou dados completos do comprovante.

## PWA e notificacoes

- Service worker deve cachear apenas assets estaticos, nunca rotas `/api`, estados financeiros ou respostas Supabase.
- Notificacoes locais dependem da permissao do navegador e devem conter apenas resumo minimo de vencimento ou alerta.
- Push server-side futuro deve exigir opt-in explicito, revogacao e politica de retencao.

## WhatsApp

- O webhook do WhatsApp deve validar `WHATSAPP_VERIFY_TOKEN` no desafio inicial.
- Eventos recebidos devem validar `x-hub-signature-256` com `WHATSAPP_APP_SECRET` quando configurado.
- Eventos POST so devem ser processados quando `WHATSAPP_ENABLED=true`.
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

## Pendencias

- Validar configuracao real do Supabase Auth em producao.
- Definir matriz inicial de papeis e permissoes.
- Definir politica formal de retencao de dados.
- Definir processo de gestao de segredos por ambiente.
- Implementar rate limiting nas rotas `/api/maya/analyze` e `/api/maya/receipt`.
- Implementar storage privado para anexos quando sair do armazenamento local.
