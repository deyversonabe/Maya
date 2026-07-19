# Documentacao do projeto

Esta pasta contem a documentacao viva do projeto. Ela deve evoluir junto com o codigo e servir como referencia obrigatoria para futuras implementacoes.

## Fonte principal

Leia primeiro:

- `PROJECT_RULES.md`: regras obrigatorias, filosofia, arquitetura, qualidade, seguranca, IA, testes e documentacao.

## Documentos por area

- `ARCHITECTURE.md`: visao arquitetural e principios de evolucao.
- `API.md`: padroes de API, contratos, erros e versionamento.
- `DATABASE.md`: modelo de dados, convencoes e estrategia de migracoes.
- `DESIGN_SYSTEM.md`: fundamentos visuais e padroes de componentes.
- `FEATURES.md`: mapa funcional e criterios para novas funcionalidades.
- `USER_FLOW.md`: fluxos de usuario e jornadas principais.
- `IA_GUIDELINES.md`: regras para recursos de IA e OpenAI.
- `SECURITY.md`: modelo de seguranca, privacidade e resposta a incidentes.
- `CODE_STYLE.md`: padroes de codigo e nomenclatura.
- `CONTRIBUTING.md`: processo de contribuicao e Definition of Done.
- `DEPLOYMENT.md`: como subir a estrutura correta no GitHub e Vercel.
- `WHATSAPP_SETUP.md`: como configurar WhatsApp Cloud API direto, sem n8n.
- `WHATSAPP_CONFIGURATION_STATUS.md`: estado atual da configuracao do numero WhatsApp na Meta e Vercel.
- `ROADMAP.md`: fases planejadas de evolucao.
- `CHANGELOG.md`: historico de alteracoes.

## Regra de documentacao viva

Sempre que uma funcionalidade impactar arquitetura, banco de dados, APIs, design, seguranca, IA ou fluxos de usuario, o documento correspondente deve ser atualizado antes ou junto da implementacao.

## Estado inicial

Esta etapa estabelece a base documental e a primeira aplicacao funcional do projeto.

A stack alvo definida pelo Prompt Mestre e Next.js, React, TypeScript, TailwindCSS, shadcn/ui, Framer Motion, Supabase, PostgreSQL, Prisma, Vercel, GitHub e OpenAI API.

O MVP atual ja permite uso funcional com persistencia local no navegador. Supabase/PostgreSQL, autenticacao e OpenAI real permanecem como proximas etapas porque exigem credenciais e configuracao de ambiente.

## MAYA e OpenAI na Vercel

A MAYA funciona localmente com analises deterministicas. Para ativar OpenAI no deploy:

1. Acesse o projeto na Vercel.
2. Abra Settings > Environment Variables.
3. Adicione `OPENAI_API_KEY`.
4. Opcionalmente adicione `OPENAI_MODEL` e `OPENAI_VISION_MODEL`.
5. Faca redeploy.

A chave deve existir apenas no ambiente da Vercel ou em `.env.local` local ignorado pelo Git. Nunca coloque a chave no codigo ou no chat.

## Execucao local

Com Node.js instalado:

```bash
npm install
npm run dev
```

Depois acesse `http://localhost:3000`.
