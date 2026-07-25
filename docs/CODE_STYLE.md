# Code Style

Este documento define padroes gerais de codigo. Convencoes especificas podem ser detalhadas quando a stack for escolhida.

## Principios

- Clareza acima de esperteza.
- Funcoes pequenas e orientadas a uma responsabilidade.
- Regras de negocio testaveis e isoladas.
- Tipos, schemas ou contratos explicitos quando disponiveis.
- Tratamento de erro intencional.
- Nomes alinhados ao dominio.

## Estrutura de codigo

O codigo deve ser organizado por dominio sempre que possivel:

```text
modules/
  users/
  organizations/
  billing/
  ai/
shared/
  logging/
  validation/
  database/
  errors/
```

Cada modulo deve agrupar seus casos de uso, entidades, validacoes, adaptadores e testes.

## Nomenclatura

- Classes, tipos e entidades: nomes substantivos e claros.
- Funcoes e metodos: verbos que expressem acao.
- Casos de uso: verbo + objeto.
- Variaveis booleanas: prefixos como `is`, `has`, `can` ou `should`.
- Datas: sufixo `At` quando indicarem instante no tempo.
- Arquivos: seguir convencao da stack, mantendo consistencia.

## Erros

- Nao retornar erros genericos quando o usuario precisa de acao clara.
- Nao vazar detalhes internos para usuarios finais.
- Usar categorias consistentes para validacao, autenticacao, autorizacao, conflito, nao encontrado e erro inesperado.
- Logs devem conter contexto tecnico seguro.

## Dependencias

Antes de adicionar uma dependencia:

- Verificar se a stack ou biblioteca existente ja resolve o problema.
- Avaliar manutencao, licenca, seguranca e peso.
- Registrar a dependencia no Implementation Report.
- Evitar dependencias para utilidades triviais.

## Comentarios

Comentarios devem ser usados para:

- Explicar decisoes nao obvias.
- Documentar invariantes importantes.
- Alertar sobre integracoes sensiveis.

Comentarios nao devem repetir o codigo.

## Formatacao

Quando a stack for definida, o projeto deve adotar formatador e linter automaticos. A configuracao escolhida deve ser registrada neste documento.

## Pendencias

- Definir linguagem e framework.
- Definir linter, formatter e regras especificas.
- Definir convencao de arquivos e testes da stack escolhida.
