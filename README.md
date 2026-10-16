# @alanvncs/tarefy-mcp

Servidor [MCP](https://modelcontextprotocol.io) para o [Tarefy](https://tarefy.com). Permite que agentes de IA (por exemplo no Cursor ou no Claude Code) consultem e gerenciem tasks: dados, conversas, criação, edição, status, colunas, responsáveis, seguidores, tags, subtasks, relacionamentos, anexos e lançamento de horas.

## O que é o Tarefy

[Tarefy](https://tarefy.com) é uma plataforma de gestão de tarefas e produtividade para equipes, empresas e freelancers: criar tarefas, atribuir responsáveis, definir prazos, acompanhar progresso e centralizar a comunicação. Este servidor MCP expõe as tasks (dados gerais, conversas e demais informações) e as principais ações sobre elas para agentes de IA.

---

## Instalação do MCP

No Cursor, edite `~/.cursor/mcp.json` (ou o equivalente no seu sistema) e adicione:

```json
{
  "mcpServers": {
    "tarefy": {
      "command": "npx",
      "args": ["@alanvncs/tarefy-mcp@latest"]
    }
  }
}
```

Reinicie o Cursor para carregar o servidor.

**Direto do GitHub** (versão mais recente do `main`, sem depender da publicação no npm): use `"args": ["-y", "github:ddgroup-org/tarefy-mcp"]`, ou no Claude Code `claude mcp add -s user tarefy -- npx -y github:ddgroup-org/tarefy-mcp`. Requer só Node e git. A primeira inicialização (e a primeira após cada push) leva cerca de 40 s, pois baixa as dependências e compila o TypeScript; se o cliente desistir por tempo, basta reconectar.

---

## Ferramentas

### `login`

Autentica no Tarefy para que as demais ferramentas possam usar a API.

| Parâmetro | Tipo     | Descrição                                                                  |
|----------|----------|----------------------------------------------------------------------------|
| `email`  | opcional | Email do usuário; se informado, o campo de email é preenchido no navegador. |

**Comportamento:**

1. Abre o Chrome (Playwright), acessa a [página de login](https://app.tarefy.com/login) e aguarda o usuário fazer login (o email é preenchido automaticamente se informado).
2. Obtém o cookie `tarefy` (token da API HTTP do Tarefy).
3. Salva o token em `~/.tarefy-mcp/token.txt` para uso pelas outras ferramentas.

**Requisito:** Chrome instalado (o Playwright usa o canal `chrome`).

---

### `get-task`

Obtém os dados completos de uma task: dados gerais, conversas internas (equipe) e conversas públicas (cliente).

| Parâmetro | Tipo        | Descrição                                                                 |
|-----------|-------------|----------------------------------------------------------------------------|
| `taskId`  | obrigatório | ID da task, o mesmo da URL: `https://app.tarefy.com/task/{{taskId}}`.     |
| `prompt`  | opcional    | Instruções sobre formato/conteúdo da resposta. Se omitido, retorna todos os dados em JSON. |

**Comportamento:**

1. Lê o token salvo por `login` (se não houver, retorna erro orientando a usar `login` primeiro).
2. Obtém os dados gerais da task, as conversas internas e as conversas públicas pela API do Tarefy.
3. Sem `prompt`: devolve um JSON no formato `{ task, comments, publicComments }`. Com `prompt`: devolve o mesmo JSON precedido das instruções informadas (para o cliente/agente interpretar ou reformatar).

---

### `list-tasks`

Lista as tasks do usuário logado por categoria (as abas de "Minhas tasks" do Tarefy).

| Parâmetro  | Tipo     | Descrição                                                                                                                       |
|------------|----------|---------------------------------------------------------------------------------------------------------------------------------|
| `category` | opcional | `todo` (a fazer, padrão), `validation` (em validação), `done` (finalizadas), `created` (criadas pelo usuário) ou `followed` (seguidas). |
| `prompt`   | opcional | Instruções sobre formato/conteúdo da resposta. Se omitido, retorna todos os dados em JSON.                                     |

**Comportamento:**

1. Lê o token salvo por `login` e extrai o ID do usuário (campo `id` do payload do token JWT).
2. Chama o endpoint de lista da categoria escolhida.
3. Sem `prompt`: devolve um JSON no formato `{ category, tasks }`. Com `prompt`: devolve o mesmo JSON precedido das instruções informadas.

Cada task da lista traz `id_tarefa` (o ID da URL, que deve ser passado ao `get-task`), `titulo`, `status`, `cliente`, datas, urgência e responsáveis.

---

### `add-comment`

Adiciona uma conversa a uma task: **interna** por padrão (só a equipe vê) ou **pública** (visível para o cliente).

| Parâmetro | Tipo        | Descrição                                                                                   |
|-----------|-------------|---------------------------------------------------------------------------------------------|
| `taskId`  | obrigatório | ID da task, o mesmo da URL: `https://app.tarefy.com/task/{{taskId}}`.                       |
| `content` | obrigatório | Texto do comentário. Quebras de linha viram parágrafos; HTML é escapado.                    |
| `client`  | opcional    | `true` = conversa pública, visível para o cliente. Padrão: `false` (conversa interna).      |

**Comportamento:**

1. Lê o token salvo por `login` e obtém os dados gerais da task para descobrir o `ticketId` (campo `id`).
2. Converte o texto para o HTML do editor do Tarefy e cria a conversa.
3. Devolve uma confirmação com o ID do comentário criado.

---

### `update-status`

Altera o status de uma task.

| Parâmetro | Tipo        | Descrição                                                                                              |
|-----------|-------------|--------------------------------------------------------------------------------------------------------|
| `taskId`  | obrigatório | ID da task, o mesmo da URL: `https://app.tarefy.com/task/{{taskId}}`.                                  |
| `status`  | obrigatório | `open` (aberta; reabre uma finalizada ou recusa a validação), `validation` (em validação) ou `done` (finalizada). |

**Comportamento:**

1. Lê o token salvo por `login` e obtém os dados gerais da task (`ticketId` no campo `id` e status atual no campo `status`: `0` aberta, `1` finalizada, `2` em validação).
2. Se a task já está no status pedido, não altera nada.
3. Para reabrir uma task finalizada usa a rota de reabertura; nos demais casos usa a rota de atualização de status.
4. Devolve uma confirmação com o novo status.

---

### Convenções das ferramentas de tasks

- `taskId` é sempre o ID da URL da task (`https://app.tarefy.com/task/{{taskId}}`). O servidor resolve o ID interno (o "ticketId") quando a rota exige.
- IDs de projetos, colunas, tipos, tags e usuários vêm de `get-task-options`.
- Durações usam o formato horas:minutos (`"1:30"`); datas usam `AAAA-MM-DD`.
- Exclusão e arquivamento de tasks **não** são expostos; use o app para isso.

---

### `search-tasks`

Busca tasks por texto (título) ou número.

| Parâmetro | Tipo        | Descrição                 |
|-----------|-------------|---------------------------|
| `term`    | obrigatório | Texto ou número a buscar. |

Devolve `{ term, tasks }`; cada item traz `id_tarefa` (ID da URL) e `titulo`.

---

### `get-task-options`

Sem parâmetros. Devolve os IDs necessários para criar/editar tasks: `projects` (com `columns`, as etapas do quadro, em ordem), `taskTypes`, `tags` (não arquivadas), `teams` (com `userIds`), `users` e `urgencies` (`Baixa`, `Média`, `Alta`, `Urgente`).

---

### `list-project-tasks`

Lista as tasks de um projeto (quadro), resumidas (status, coluna, responsáveis, tags, cliente, tipo, urgência, datas, tempo trabalhado), das mais recentes para as mais antigas.

| Parâmetro   | Tipo        | Descrição                                                                                              |
|-------------|-------------|--------------------------------------------------------------------------------------------------------|
| `projectId` | obrigatório | ID do projeto.                                                                                         |
| `status`    | opcional    | `open`, `validation`, `done` ou `all`. Padrão: abertas + em validação.                                 |
| `limit`     | opcional    | Máximo de tasks retornadas (até 1000). Padrão: 100.                                                    |

Devolve `{ projectId, total, returned, tasks }`.

---

### `get-task-details`

Dados complementares que o `get-task` não traz.

| Parâmetro | Tipo        | Descrição                                                                                                  |
|-----------|-------------|------------------------------------------------------------------------------------------------------------|
| `taskId`  | obrigatório | ID da task.                                                                                                |
| `include` | opcional    | Lista entre `subtasks`, `attachments`, `relationships`, `timeEntries` (horas lançadas) e `insights` (lead time, cycle time, aging). Padrão: todas. |

---

### `create-task`

Cria uma task, ou uma subtask quando `parentTaskId` é informado.

| Parâmetro        | Tipo        | Descrição                                                        |
|------------------|-------------|------------------------------------------------------------------|
| `title`          | obrigatório | Título.                                                          |
| `projectId`      | opcional    | ID do projeto (quadro).                                          |
| `columnId`       | opcional    | ID da coluna (etapa). Exige `projectId`.                         |
| `clientId`       | opcional    | ID do cliente.                                                   |
| `responsibleIds` | opcional    | IDs dos usuários responsáveis.                                   |
| `typeId`         | opcional    | ID do tipo de task.                                              |
| `dueDate`        | opcional    | Data desejada (`AAAA-MM-DD`).                                    |
| `urgency`        | opcional    | `Baixa` (padrão), `Média`, `Alta` ou `Urgente`.                  |
| `estimatedTime`  | opcional    | Estimativa (`"2:00"`).                                           |
| `description`    | opcional    | Descrição em texto puro (convertida para o formato do editor).   |
| `tagIds`         | opcional    | IDs das tags.                                                    |
| `parentTaskId`   | opcional    | ID da URL da task pai, para criar uma subtask.                   |

Devolve o ID e o link da task criada.

---

### `update-task`

Atualiza campos de uma task. Informe só o que mudar; `null` limpa o campo. A descrição não é editável por aqui (o app a edita em tempo real via socket). Para status use `update-status`; para coluna, `move-task`.

| Parâmetro          | Tipo        | Descrição                                              |
|--------------------|-------------|--------------------------------------------------------|
| `taskId`           | obrigatório | ID da task.                                            |
| `title`            | opcional    | Novo título.                                           |
| `typeId`           | opcional    | ID do tipo (ou `null`).                                |
| `clientId`         | opcional    | ID do cliente (ou `null`).                             |
| `dueDate`          | opcional    | Data desejada (ou `null`).                             |
| `startDate`        | opcional    | Data de início (ou `null`).                            |
| `endDate`          | opcional    | Data de entrega (ou `null`).                           |
| `urgency`          | opcional    | `Baixa`, `Média`, `Alta` ou `Urgente`.                 |
| `estimatedTime`    | opcional    | Estimativa (`"2:00"`).                                 |
| `budget`           | opcional    | Horas orçadas (`"10:00"`).                             |
| `competence`       | opcional    | Competência `AAAAMM` (ou `null`).                      |
| `bug`              | opcional    | Marca/desmarca como bug.                               |
| `hiddenFromClient` | opcional    | `true` oculta a task do cliente; `false` a torna visível. |

---

### `move-task`

Move a task para outra coluna (etapa), inclusive no quadro de outro projeto.

| Parâmetro   | Tipo        | Descrição                                            |
|-------------|-------------|------------------------------------------------------|
| `taskId`    | obrigatório | ID da task.                                          |
| `columnId`  | obrigatório | ID da coluna de destino.                             |
| `projectId` | opcional    | ID do projeto de destino, quando diferente do atual. |

---

### `update-responsibles`, `update-followers` e `update-tags`

Adicionam e/ou removem responsáveis, seguidores ou tags de uma task. Fazem uma chamada por item e param no primeiro erro, informando o que já foi aplicado.

| Parâmetro | Tipo        | Descrição                                 |
|-----------|-------------|-------------------------------------------|
| `taskId`  | obrigatório | ID da task.                               |
| `add`     | opcional    | IDs (de usuários ou de tags) a adicionar. |
| `remove`  | opcional    | IDs (de usuários ou de tags) a remover.   |

---

### `add-relationship`

Relaciona duas tasks.

| Parâmetro      | Tipo        | Descrição                                                                    |
|----------------|-------------|------------------------------------------------------------------------------|
| `taskId`       | obrigatório | ID da task de origem.                                                        |
| `targetTaskId` | obrigatório | ID da URL da outra task.                                                     |
| `type`         | opcional    | `relates_to` (padrão), `blocks`, `depends_on` ou `duplicates`.               |

---

### `toggle-timer`

Inicia ou pausa (alterna) o cronômetro do usuário logado na task. Iniciar em uma task pode pausar o cronômetro de outra.

| Parâmetro | Tipo        | Descrição   |
|-----------|-------------|-------------|
| `taskId`  | obrigatório | ID da task. |

---

### `log-time`

Lança horas trabalhadas na task para o usuário logado.

| Parâmetro  | Tipo        | Descrição                         |
|------------|-------------|-----------------------------------|
| `taskId`   | obrigatório | ID da task.                       |
| `duration` | obrigatório | Tempo trabalhado (`"1:30"`).      |
| `date`     | opcional    | Dia (`AAAA-MM-DD`). Padrão: hoje. |

---

### `duplicate-task`

Duplica a task e devolve os dados da cópia.

| Parâmetro | Tipo        | Descrição   |
|-----------|-------------|-------------|
| `taskId`  | obrigatório | ID da task. |

---

### `upload-attachment`

Envia um arquivo local como anexo da task.

| Parâmetro  | Tipo        | Descrição                          |
|------------|-------------|------------------------------------|
| `taskId`   | obrigatório | ID da task.                        |
| `filePath` | obrigatório | Caminho absoluto do arquivo local. |

---

## API do Tarefy (usada pelo servidor)

O servidor chama a API HTTP do Tarefy com os seguintes detalhes.

**Headers em todas as requisições:**

```http
Content-Type: application/json
Authorization: Bearer <token>
```

O `<token>` é o valor do cookie `tarefy` obtido após o login (salvo em `~/.tarefy-mcp/token.txt`).

**Endpoints:**

| Recurso              | Método | URL                                                                 | Observação                                                                 |
|----------------------|--------|---------------------------------------------------------------------|----------------------------------------------------------------------------|
| Dados da task        | GET    | `https://app.tarefy.com/nodeapi/v2/tasks/{{taskId}}`                | `taskId` = ID da URL da task (ex.: `/task/12345` → `12345`).               |
| Conversas internas   | GET    | `https://app.tarefy.com/nodeapi/v2/comments/{{ticketId}}?type=internal` | `ticketId` = campo `id` retornado nos dados gerais da task. Lista em `data.comments`. |
| Conversas públicas   | GET    | `https://app.tarefy.com/nodeapi/v2/comments/{{ticketId}}?type=client` | Idem.                                                                   |
| Criar conversa       | POST   | `https://app.tarefy.com/nodeapi/v2/comments`                        | Corpo `{ "taskId": ticketId, "content": "<p>…</p>", "client": false }`; `client: true` = pública. |
| Alterar status       | PATCH  | `https://app.tarefy.com/nodeapi/task/updatestatus`                  | Corpo `{ "idTask": ticketId, "status": 0 \| 1 \| 2 }` (0 aberta, 1 finalizada, 2 em validação). Resposta traz `task` quando deu certo. |
| Reabrir finalizada   | PATCH  | `https://app.tarefy.com/nodeapi/task/reopen`                        | Corpo `{ "id": ticketId }`. Resposta `{ status: true, message }`.         |
| ID interno da task   | GET    | `https://app.tarefy.com/nodeapi/v2/tasks/public/{{taskId}}/internal-id` | Resposta `{ data: { id, id_tarefa } }`. `id` = ID interno (ticketId). |
| Buscar tasks         | GET    | `https://app.tarefy.com/nodeapi/v2/tasks/search?term={{texto}}`     | Lista em `tasks`.                                                          |
| Opções de criação    | GET    | `https://app.tarefy.com/nodeapi/v2/tasks/creation-options`          | `projects` (com `boardlists` = colunas) e `models`.                        |
| Tipos de task        | GET    | `https://app.tarefy.com/nodeapi/v2/task-types?only_active=true`     | Lista.                                                                     |
| Tags                 | GET    | `https://app.tarefy.com/nodeapi/v2/task-tags`                       | Lista.                                                                     |
| Equipes e usuários   | GET    | `https://app.tarefy.com/nodeapi/v2/teams/task-creation-options`     | `data.teams[].usersList`.                                                  |
| Tasks do projeto     | GET    | `https://app.tarefy.com/nodeapi/v2/tasks/project/{{projectId}}`     | Lista (status numérico, coluna em `list[].boardlists`).                    |
| Subtasks             | GET    | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/subtasks`     | Lista em `subTasks`.                                                       |
| Anexos               | GET    | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/attachments`  | Lista em `attachs`.                                                        |
| Enviar anexo         | POST   | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/attachments`  | `multipart/form-data` com o campo `file`.                                  |
| Relacionamentos      | GET    | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/relationships` | Lista em `relationships`.                                                 |
| Criar relacionamento | POST   | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/relationships` | Corpo `{ "target_task_id": ticketId, "relationship_type": "relates_to" \| "blocks" \| "depends_on" \| "duplicates" }`. |
| Horas lançadas       | GET    | `https://app.tarefy.com/nodeapi/task/manualhours?id={{ticketId}}`   | Lista em `times`.                                                          |
| Métricas de fluxo    | GET    | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/insights`     | Lead time, cycle time, aging etc.                                          |
| Criar task           | POST   | `https://app.tarefy.com/nodeapi/v2/tasks` ou `.../v2/tasks/column/{{projectId}}/{{columnId}}` | Corpo `{ title, project_id, column_id, client_id, task_responsible: [{ user }], type_id, due_date, urgency, estimated_time: "HHH:MM", initialDescription: { format: "quill-delta-v1", ops }, tagsSelect: "1,2", parent_task_id, creation_context: "subtask" }`. |
| Atualizar task       | PATCH  | `https://app.tarefy.com/nodeapi/v2/tasks/{{taskId}}`                | ID da URL. Corpo com os campos: `title`, `type_id`, `client_id`, `due_date`, `start_date`, `end_date`, `urgency`, `estimated_time`, `budget`, `competence`, `bug`. |
| Visibilidade cliente | PATCH  | `https://app.tarefy.com/nodeapi/v2/tasks/{{taskId}}/client-visibility` | ID da URL. Corpo `{ "hidden": true }`.                                  |
| Mover de coluna      | PATCH  | `https://app.tarefy.com/nodeapi/v2/tasks/{{taskId}}/move`           | ID da URL. Corpo `{ "target_column_id", "insert_at": "top", "target_project_id"? }`. |
| Responsáveis         | POST / DELETE | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/responsibles` e `.../responsibles/{{userId}}` | POST com `{ "user_id" }`.                     |
| Seguidores           | POST / DELETE | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/followers` e `.../followers/{{userId}}` | POST com `{ "user_id" }`.                           |
| Tags da task         | POST / DELETE | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/tags` e `.../tags/{{tagId}}` | POST com `{ "tag_id" }`.                                       |
| Cronômetro           | PATCH  | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/play-pause`   | Corpo `{}`. Alterna; resposta traz `task.working` (1 = rodando).           |
| Lançar horas         | POST   | `https://app.tarefy.com/nodeapi/v2/tasks/{{taskId}}/worklogs`       | ID da URL. Corpo `{ "seconds", "date": "AAAA-MM-DD" }`.                   |
| Duplicar             | POST   | `https://app.tarefy.com/nodeapi/v2/tasks/bulk-duplicate`            | Corpo `{ "taskIds": [taskId] }` (IDs da URL). Resposta `{ duplicated, createdTasks }`. |
| Tasks a fazer        | GET    | `https://app.tarefy.com/nodeapi/task/open/user?userId={{userId}}`   | `userId` = campo `id` do payload do token JWT. Lista em `task`.            |
| Tasks em validação   | GET    | `https://app.tarefy.com/nodeapi/task/validation/user?userId={{userId}}` | Idem. Lista em `task`.                                                 |
| Tasks finalizadas    | GET    | `https://app.tarefy.com/nodeapi/task/finish/user?userId={{userId}}` | Idem. Lista em `task`.                                                     |
| Tasks criadas        | GET    | `https://app.tarefy.com/nodeapi/task/created/user?userId={{userId}}` | Idem. Lista em `task`.                                                    |
| Tasks seguidas       | GET    | `https://app.tarefy.com/nodeapi/user/followedTasks?userId={{userId}}` | Idem. Lista em `tasks`.                                                 |

- **Conversas internas:** alinhamentos da equipe, eventos sistêmicos (ex.: mudança de área); não visíveis para o cliente.
- **Conversas públicas:** aprovações, prazos, pedidos de dados, dúvidas; visíveis para o cliente.

---

## Desenvolvimento

**Requisitos:** Node ≥ 18, [Bun](https://bun.sh) (gerenciador de pacotes).

| Comando           | Descrição                          |
|-------------------|------------------------------------|
| `bun install`    | Instalar dependências              |
| `bun run build`  | Compilar TypeScript → `build/`     |
| `bun run start`  | Rodar o servidor (`node build/index.js`) |
| `bun run dev`    | Rodar sem build (`bun run src/index.ts`) |
| `bun run inspector` | Testar o servidor com [MCP Inspector](https://modelcontextprotocol.io/legacy/tools/inspector) (build + UI em `http://localhost:6274`) |
| `bun test`       | Testes unitários                   |
| `bun run lint`   | ESLint                             |
| `bun run format` | Prettier (formatação)              |

O binário publicado no npm é `build/index.js` (uso com `npx` ou como `tarefy-mcp` após instalação global).

**Publicação no npm:** o workflow do GitHub usa [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC); não é necessário configurar `NPM_TOKEN`. É preciso registrar o Trusted Publisher uma vez em npmjs.com → Package → Settings → Trusted publishing (repositório e nome do workflow: `publish-npm.yml`). O workflow dispara em **push de tags** `v*` (ex.: `v0.1.2`) ou manualmente. Para criar uma nova versão e publicar: `bun run release` (bump **patch**), ou `bun run release -- minor` / `bun run release -- major`. O script (TypeScript, rodado com Bun) faz o bump em `package.json`, commit com mensagem `vX.Y.Z`, tag e push; não precisa do GitHub CLI.

---

## Licença

MIT
