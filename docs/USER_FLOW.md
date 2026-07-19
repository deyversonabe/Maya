# User Flow

Este documento descreve jornadas e fluxos de usuario. Ele deve ser atualizado sempre que uma funcionalidade alterar navegacao, etapas, permissoes ou estados de interface.

## Principios

- Cada fluxo deve ter objetivo claro.
- O usuario deve entender onde esta, o que pode fazer e o que aconteceu apos cada acao.
- Estados de erro devem ajudar recuperacao.
- Fluxos criticos devem evitar perda de dados.
- Acoes irreversiveis devem pedir confirmacao.

## Fluxos-base previstos

Como o produto ainda nao tem dominio definido, os fluxos abaixo representam uma base SaaS provavel.

### Acesso inicial funcional

1. Usuario acessa a URL raiz do projeto.
2. Sistema exibe tela inicial premium com logo, resumo do casal e acoes principais.
3. Usuario escolhe Dashboard, Meses, Despesas, Orcamentos, Metas, Dados ou MAYA.
4. Sistema carrega dados salvos no navegador ou cria dados iniciais.
5. Usuario visualiza saldo, receitas, despesas, metas e insights.
6. Usuario cadastra transacoes, metas, recorrencias ou parcelas.
7. Sistema recalcula os indicadores imediatamente.
8. Sistema salva os dados localmente.
9. Usuario pode exportar dados para backup.

### Navegacao mobile

1. Usuario acessa o app em celular.
2. Sistema exibe navegacao inferior fixa.
3. Usuario alterna entre Inicio, Meses, Despesas, Orcamentos, Metas, Dados e MAYA com um toque.
4. O conteudo principal mantem espacamento inferior para nao ficar coberto pela barra.

### Cadastro de despesa com nota

1. Usuario acessa Despesas.
2. Usuario clica em anexar nota ou abrir camera.
3. Sistema envia a imagem para `POST /api/maya/receipt`.
4. Se OpenAI estiver configurada, MAYA extrai dados da imagem.
5. Se OpenAI nao estiver configurada, sistema cria rascunho revisavel e solicita preenchimento manual.
6. Sistema exibe os dados do anexo em painel editavel.
7. Usuario pode abrir o anexo original para conferencia.
8. Usuario revisa e edita nome, descricao, valor, categoria, pessoa, data e parcelas.
9. Usuario confirma.
10. Sistema salva a despesa.

### Envio de nota pelo WhatsApp

1. Usuario envia uma foto de nota para o numero do Juntos Maya.
2. WhatsApp chama o webhook do sistema.
3. Sistema valida a origem do evento.
4. Sistema baixa a imagem no servidor.
5. MAYA tenta criar um rascunho revisavel.
6. Sistema responde no WhatsApp com um resumo curto.
7. Usuario abre o app e revisa antes de salvar a despesa.
8. Se a imagem nao puder ser lida, sistema orienta cadastro manual.

Nesta etapa, o WhatsApp nao salva despesa automaticamente porque ainda nao ha login, vinculacao segura de telefone e banco em nuvem definitivo.

### Despesa recorrente ou parcelada

1. Usuario escolhe cadastro manual.
2. Usuario define tipo: unica, recorrente ou parcelada.
3. Para recorrente, sistema gera lancamentos mensais pelo periodo informado.
4. Para parcelada, sistema gera uma transacao por parcela em cada mes.
5. Todas as parcelas ficam visiveis na divisao por meses.
6. Usuario pode remover lancamentos individualmente.

### Resumo mensal de entradas e saidas

1. Usuario acessa Meses.
2. Usuario seleciona o mes que deseja analisar.
3. Sistema mostra entradas, saidas, investimentos, transferencias e saldo final do mes.
4. Sistema lista lancamentos discriminados por tipo.
5. Usuario identifica descricao, categoria, pessoa, data, recorrencia e parcelas.
6. Usuario pode remover um lancamento se identificar erro.

### Planejamento por orcamento mensal

1. Usuario acessa Orcamentos.
2. Usuario escolhe mes, categoria e limite.
3. Sistema salva o orcamento no banco local.
4. Sistema compara limite com despesas reais daquele mes.
5. Usuario visualiza saldo restante ou excesso.
6. MAYA usa esse contexto para orientar ajustes.

### Cadastro de metas

1. Usuario acessa Metas.
2. Usuario informa nome, tipo, prioridade, valor alvo, valor atual e prazo.
3. Sistema salva a meta no banco local.
4. Usuario acompanha progresso individual e progresso geral.
5. Usuario pode atualizar valor atual ou remover metas.
6. MAYA usa metas como contexto, mas nao cria previsoes sem receitas e despesas reais.

### Central de Dados e Confianca

1. Usuario acessa Dados.
2. Sistema mostra onde os dados estao armazenados no momento.
3. Se sincronizacao online estiver configurada, usuario entra com e-mail e senha criados no Supabase Auth.
4. Sistema verifica se o usuario e membro da base compartilhada.
5. Sistema migra dados locais existentes para a base compartilhada quando necessario.
6. Sistema mostra status de IA, conta online e futura conexao financeira.
7. Sistema calcula a qualidade da analise da MAYA.
8. Usuario pode exportar backup JSON.
9. Usuario pode limpar dados locais quando quiser reiniciar o uso.
10. Sistema deixa claro que Open Finance ainda e preparo futuro, nao conexao ativa.

### Sincronizacao entre celular e desktop

1. Usuario autorizado cadastra despesas, contas, metas ou orcamentos em um aparelho.
2. Sistema salva automaticamente na base compartilhada quando a sessao esta online.
3. Outros usuarios autorizados e outros aparelhos recebem a atualizacao pela assinatura online.
4. Se o aparelho estiver offline, o app preserva dados locais e tenta sincronizar no retorno.
5. Se a sessao ficar sem uso ou a aba for fechada, o app pede senha no retorno.

### Usuarios e recuperacao

1. Administrador cria usuarios iniciais pelo Supabase Auth seguindo `docs/AUTH_USERS_SETUP.md`.
2. Administrador adiciona cada usuario ao workspace compartilhado.
3. Sistema usa e-mail como login tecnico e nome de exibicao para identificar pessoas como Deyveron e Tom.
4. Senhas iniciais nao sao armazenadas no repositorio.
5. Recuperacao de senha e iniciada pelo painel do Supabase.
6. Conta administradora usa `deyversonsilvaf@gmail.com` como e-mail de recuperacao administrativa.

### Contas a pagar

1. Usuario acessa Contas.
2. Usuario escolhe cadastrar manualmente ou anexar uma imagem.
3. Quando houver imagem, MAYA le o documento e preenche um rascunho com titulo, descricao, valor, vencimento, categoria, tipo de pagamento e codigo quando existir.
4. Sistema exibe os dados do anexo em painel editavel e deixa vazios os campos que nao foram identificados com confianca.
5. Usuario pode abrir o anexo original para conferencia.
6. Usuario revisa e completa titulo, valor e vencimento antes de salvar.
7. Sistema salva a conta no mes do vencimento.
8. Usuario acompanha status pendente, pago ou atrasado.
9. Usuario pode copiar codigo Pix/boleto.
10. Usuario pode marcar como pago.
11. Sistema mostra contas vencendo, alerta 48h antes, alerta do dia e resumo mensal.

### Leitura de renda por imagem

1. Usuario acessa Dashboard.
2. Usuario seleciona tipo Receita e anexa imagem de comprovante ou documento de entrada.
3. MAYA cria rascunho revisavel com descricao, valor, categoria e data de entrada quando legivel.
4. Usuario completa campos faltantes.
5. Sistema verifica se ja existe renda ou despesa com a mesma data, mesmo valor e mesmo tipo.
6. Se houver possivel duplicidade, sistema pede confirmacao antes de salvar.
7. Sistema salva a receita no mes da data de entrada.

### Confirmacao de duplicidade

1. Usuario tenta salvar renda, despesa ou conta.
2. Sistema compara data, valor e tipo com os registros existentes.
3. Sistema exibe os registros possivelmente duplicados quando encontrar coincidencia.
4. Usuario escolhe cancelar ou confirmar o salvamento mesmo assim.
5. Sistema so salva duplicidade apos confirmacao explicita.

### Consentimento financeiro futuro

1. Usuario escolhe conectar uma instituicao quando a integracao real existir.
2. Sistema informa escopo, finalidade, prazo e possibilidade de revogacao.
3. Usuario confirma consentimento fora do app ou em fluxo seguro autorizado.
4. Sistema registra status da conexao.
5. Usuario pode revisar ou revogar a conexao depois.

Nesta etapa, esse fluxo existe apenas como diretriz de produto e interface preparatoria.

### Primeiro acesso

1. Usuario acessa a aplicacao.
2. Usuario cria conta ou entra.
3. Sistema cria ou associa o usuario a uma organizacao.
4. Usuario conclui configuracao inicial.
5. Usuario chega ao painel principal.

### Convite para organizacao

1. Administrador convida um membro.
2. Sistema envia convite.
3. Convidado aceita.
4. Sistema valida convite e permissoes.
5. Convidado acessa o workspace com papel adequado.

### Uso de recurso com IA

1. Usuario informa dados ou seleciona contexto.
2. Sistema valida entrada e permissao.
3. Sistema exibe custo, limite ou estado de processamento quando necessario.
4. Servico de IA processa a solicitacao.
5. Sistema valida a resposta.
6. Usuario revisa, confirma ou ajusta o resultado.

Enquanto a OpenAI real nao estiver conectada, os insights serao calculados localmente por regras deterministicas.
Quando a qualidade dos dados for insuficiente, a MAYA deve explicar o que falta antes de sugerir conclusoes.

### Erro recuperavel

1. Usuario executa acao.
2. Sistema detecta erro esperado.
3. Interface mostra mensagem clara.
4. Usuario recebe caminho de correcao.
5. Dados preenchidos sao preservados quando possivel.

## Estados obrigatorios por fluxo

- Inicial.
- Loading.
- Sucesso.
- Vazio.
- Erro recuperavel.
- Erro inesperado.
- Sem permissao.

## Pendencias

- Mapear personas.
- Definir jornada principal do MVP.
- Definir arquitetura de navegacao.
- Definir fluxos administrativos.
