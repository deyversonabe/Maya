# Como aplicar a correção da MAYA (via git)

Você recebeu o arquivo **`maya-fix.bundle`**. Ele contém 1 commit com TODA a correção
(remoção das pastas duplicadas + captura universal de documentos), pronto pra ir por cima
do estado atual do seu GitHub. É seguro: aplica em *fast-forward* (não reescreve histórico).

> Guarde o `maya-fix.bundle` em uma pasta fácil, ex.: `Downloads`.

## Passo a passo (copiar e colar no terminal)

```bash
# 1. Baixe uma cópia limpa do seu repositório
git clone https://github.com/deyversonabe/Maya.git
cd Maya

# 2. Puxe a correção do arquivo bundle (ajuste o caminho até onde salvou o arquivo)
git pull ~/Downloads/maya-fix.bundle main

# 3. Publique no GitHub (vai pedir seu login/token do GitHub)
git push origin main
```

Pronto. O Vercel vai detectar o push e fazer um novo deploy — dessa vez deve passar.

## Por que assim (e não "Add files via upload")

O bug do deploy foi causado pelo **upload manual pelo site do GitHub**, que aninhou pastas
(`modules/modules`, `app/app`, `lib/lib`, etc.) e quebrou o type check.

A partir de agora, **sempre publique via `git push`** (terminal ou GitHub Desktop).
Nunca mais use "Add files via upload" arrastando pastas — é o que recriava o problema.

## Se algo der errado

- **`git pull` reclama de "unrelated histories"**: você não está no commit `69ccdec`.
  Rode `git log --oneline -1` — se não aparecer `69ccdec`, me avise.
- **`git push` recusado (rejected)**: alguém/você mudou o repositório depois.
  Rode `git pull origin main` antes do push e me chame se aparecer conflito.
- **Prefere não usar terminal**: me avise que eu te mando o projeto completo em ZIP
  com um passo a passo alternativo.
