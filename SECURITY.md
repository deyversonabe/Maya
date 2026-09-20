# Seguranca

Nao abra issues publicas contendo CPF, CNPJ de clientes, dados bancarios, extratos, tokens, chaves ou documentos financeiros.

## Segredos server-side

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `WHATSAPP_APP_SECRET`, `PLUGGY_CLIENT_SECRET` ou `PLUGGY_WEBHOOK_SECRET` com prefixo `NEXT_PUBLIC_`.

## Principio de menor privilegio

- navegadores usam apenas chaves publicas apropriadas;
- rotas sensiveis validam sessao e participacao na workspace;
- tabelas auxiliares de captura/conexao usam RLS e acesso server-side;
- integracoes financeiras funcionam em leitura ate confirmacao explicita do usuario.

## Reporte

Em um repositorio privado, use o canal interno da equipe. Em um repositorio publico, habilite GitHub Private Vulnerability Reporting antes do lancamento.
