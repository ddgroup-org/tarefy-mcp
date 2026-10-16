# Servidor MCP para o Tarefy

## Índice

1. [O que é o Tarefy](#o-que-é-o-tarefy)
2. [API do Tarefy](#api-do-tarefy)
3. [Instalação do MCP](#instalação-do-mcp)
4. [Ferramentas do MCP](#ferramentas-do-mcp)

---

## O que é o [Tarefy](https://tarefy.com)

Tarefy é uma plataforma de gestão de tarefas e produtividade voltada principalmente para equipes, empresas e freelancers que querem organizar atividades, acompanhar projetos e monitorar resultados em um único lugar. Funciona como um hub de tarefas e processos, onde você pode:

- Criar tarefas
- Atribuir responsáveis
- Definir prazos
- Acompanhar progresso
- Centralizar comunicação da equipe

O objetivo deste servidor MCP é expor informações completas sobre tasks para uso por agentes de IA.

---

## API do Tarefy

### Headers

```http
Content-Type: application/json
Authorization: {{token}}
```

Onde `{{token}}` é um token do tipo `Bearer eyJhbG...`.

### Endpoints

#### Dados gerais de uma task

```http
GET https://app.tarefy.com/nodeapi/v2/tasks/{{taskId}}
```

- **taskId**: ID da task (o mesmo da URL: `https://app.tarefy.com/task/{{taskId}}`).
- **Retorno**: Dados gerais da task (sem conversas internas e sem conversas públicas).

#### Conversas de uma task (internas e públicas)

```http
GET https://app.tarefy.com/nodeapi/v2/comments/{{ticketId}}?type=internal
GET https://app.tarefy.com/nodeapi/v2/comments/{{ticketId}}?type=client
```

- **ticketId**: Campo `id` dos dados gerais da task.
- **type**: `internal` = conversas internas da equipe (ocultas para o cliente), alinhamentos técnicos e eventos sistêmicos (ex.: mudança de área); `client` = conversas públicas (visíveis para o cliente): aprovações, prazos, pedidos de dados, dúvidas etc.
- **Retorno**: `{ status, data: { comments: [...], total } }`, sem paginação, do mais recente para o mais antigo. Cada comentário traz `id`, `content` (HTML), `type`, `isClient`, `createdAt`, `author` etc.
- As rotas antigas `/nodeapi/task/comments?id=` e `/nodeapi/task/comments/client?id=` foram removidas pelo Tarefy (respondem 404).

#### Criar conversa em uma task

```http
POST https://app.tarefy.com/nodeapi/v2/comments
```

```json
{ "taskId": {{ticketId}}, "content": "<p>Texto</p>", "client": false }
```

- **taskId**: o **ticketId** (campo `id` dos dados gerais), não o ID da URL.
- **content**: HTML do editor do Tarefy (um `<p>` por linha).
- **client**: `false` = conversa interna; `true` = conversa pública (visível para o cliente).
- **Retorno**: `{ status: true, comment: { id, ... } }`.

#### Alterar status de uma task

```http
PATCH https://app.tarefy.com/nodeapi/task/updatestatus
```

```json
{ "idTask": {{ticketId}}, "status": 0 }
```

- **idTask**: o **ticketId** (campo `id` dos dados gerais).
- **status**: `0` = aberta (recusa a validação), `1` = finalizada, `2` = em validação. É o mesmo campo numérico `status` dos dados gerais da task.
- **Retorno**: `{ message, task }`; sem `task`, a alteração não foi feita (`message` explica o motivo).

#### Reabrir uma task finalizada

```http
PATCH https://app.tarefy.com/nodeapi/task/reopen
```

```json
{ "id": {{ticketId}} }
```

- **Retorno**: `{ status: true, message }` em caso de sucesso.

#### Demais rotas de tasks

`{{taskId}}` = ID da URL; `{{ticketId}}` = ID interno, obtido em `GET /nodeapi/v2/tasks/public/{{taskId}}/internal-id`. A maioria das rotas `/v2/tasks/{id}/...` exige o ID interno (com o ID da URL respondem 404), exceto as marcadas com "ID da URL".

| Recurso              | Método        | URL                                                                                                 | Observação                                                                                                                                                                                                                                                      |
| -------------------- | ------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID interno da task   | GET           | `https://app.tarefy.com/nodeapi/v2/tasks/public/{{taskId}}/internal-id`                             | Resposta `{ data: { id, id_tarefa } }`. `id` = ID interno (ticketId).                                                                                                                                                                                           |
| Buscar tasks         | GET           | `https://app.tarefy.com/nodeapi/v2/tasks/search?term={{texto}}`                                     | Lista em `tasks`.                                                                                                                                                                                                                                               |
| Opções de criação    | GET           | `https://app.tarefy.com/nodeapi/v2/tasks/creation-options`                                          | `projects` (com `boardlists` = colunas) e `models`.                                                                                                                                                                                                             |
| Tipos de task        | GET           | `https://app.tarefy.com/nodeapi/v2/task-types?only_active=true`                                     | Lista.                                                                                                                                                                                                                                                          |
| Tags                 | GET           | `https://app.tarefy.com/nodeapi/v2/task-tags`                                                       | Lista.                                                                                                                                                                                                                                                          |
| Equipes e usuários   | GET           | `https://app.tarefy.com/nodeapi/v2/teams/task-creation-options`                                     | `data.teams[].usersList`.                                                                                                                                                                                                                                       |
| Tasks do projeto     | GET           | `https://app.tarefy.com/nodeapi/v2/tasks/project/{{projectId}}`                                     | Lista (status numérico, coluna em `list[].boardlists`).                                                                                                                                                                                                         |
| Subtasks             | GET           | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/subtasks`                                     | Lista em `subTasks`.                                                                                                                                                                                                                                            |
| Anexos               | GET           | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/attachments`                                  | Lista em `attachs`.                                                                                                                                                                                                                                             |
| Enviar anexo         | POST          | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/attachments`                                  | `multipart/form-data` com o campo `file`.                                                                                                                                                                                                                       |
| Relacionamentos      | GET           | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/relationships`                                | Lista em `relationships`.                                                                                                                                                                                                                                       |
| Criar relacionamento | POST          | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/relationships`                                | Corpo `{ "target_task_id": ticketId, "relationship_type": "relates_to" \| "blocks" \| "depends_on" \| "duplicates" }`.                                                                                                                                          |
| Horas lançadas       | GET           | `https://app.tarefy.com/nodeapi/task/manualhours?id={{ticketId}}`                                   | Lista em `times`.                                                                                                                                                                                                                                               |
| Métricas de fluxo    | GET           | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/insights`                                     | Lead time, cycle time, aging etc.                                                                                                                                                                                                                               |
| Criar task           | POST          | `https://app.tarefy.com/nodeapi/v2/tasks` ou `.../v2/tasks/column/{{projectId}}/{{columnId}}`       | Corpo `{ title, project_id, column_id, client_id, task_responsible: [{ user }], type_id, due_date, urgency, estimated_time: "HHH:MM", initialDescription: { format: "quill-delta-v1", ops }, tagsSelect: "1,2", parent_task_id, creation_context: "subtask" }`. |
| Atualizar task       | PATCH         | `https://app.tarefy.com/nodeapi/v2/tasks/{{taskId}}`                                                | ID da URL. Corpo com os campos: `title`, `type_id`, `client_id`, `due_date`, `start_date`, `end_date`, `urgency`, `estimated_time`, `budget`, `competence`, `bug`.                                                                                              |
| Visibilidade cliente | PATCH         | `https://app.tarefy.com/nodeapi/v2/tasks/{{taskId}}/client-visibility`                              | ID da URL. Corpo `{ "hidden": true }`.                                                                                                                                                                                                                          |
| Mover de coluna      | PATCH         | `https://app.tarefy.com/nodeapi/v2/tasks/{{taskId}}/move`                                           | ID da URL. Corpo `{ "target_column_id", "insert_at": "top", "target_project_id"? }`.                                                                                                                                                                            |
| Responsáveis         | POST / DELETE | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/responsibles` e `.../responsibles/{{userId}}` | POST com `{ "user_id" }`.                                                                                                                                                                                                                                       |
| Seguidores           | POST / DELETE | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/followers` e `.../followers/{{userId}}`       | POST com `{ "user_id" }`.                                                                                                                                                                                                                                       |
| Tags da task         | POST / DELETE | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/tags` e `.../tags/{{tagId}}`                  | POST com `{ "tag_id" }`.                                                                                                                                                                                                                                        |
| Cronômetro           | PATCH         | `https://app.tarefy.com/nodeapi/v2/tasks/{{ticketId}}/play-pause`                                   | Corpo `{}`. Alterna; resposta traz `task.working` (1 = rodando).                                                                                                                                                                                                |
| Lançar horas         | POST          | `https://app.tarefy.com/nodeapi/v2/tasks/{{taskId}}/worklogs`                                       | ID da URL. Corpo `{ "seconds", "date": "AAAA-MM-DD" }`.                                                                                                                                                                                                         |
| Duplicar             | POST          | `https://app.tarefy.com/nodeapi/v2/tasks/bulk-duplicate`                                            | Corpo `{ "taskIds": [taskId] }` (IDs da URL). Resposta `{ duplicated, createdTasks }`.                                                                                                                                                                          |

Ações destrutivas existentes na API e **não** expostas pelo MCP: `DELETE /v2/tasks/{{id}}`, `POST /v2/tasks/bulk-delete` e `POST /v2/tasks/bulk-archive`.

#### Listas de tasks do usuário (abas de "Minhas tasks")

```http
GET https://app.tarefy.com/nodeapi/task/open/user?userId={{userId}}
GET https://app.tarefy.com/nodeapi/task/validation/user?userId={{userId}}
GET https://app.tarefy.com/nodeapi/task/finish/user?userId={{userId}}
GET https://app.tarefy.com/nodeapi/task/created/user?userId={{userId}}
GET https://app.tarefy.com/nodeapi/user/followedTasks?userId={{userId}}
```

- **userId**: Campo `id` do payload do token JWT (o próprio token de autenticação).
- **Retorno**: `{ status, task: [...] }` (ou `{ tasks: [...] }` em `followedTasks`). Cada item traz `id_tarefa` (ID usado na URL da task e em `get-task`), `id` (ticketId), `titulo`, `status`, `cliente`, `data_desejada`, `data_entrega`, `urgencia`, responsáveis etc.

---

## Instalação do MCP

Em `~/cursor/mcp.json` (ou equivalente):

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

---

## Ferramentas do MCP

### `login`

**Inputs**

| Nome    | Tipo     | Descrição                                                                  |
| ------- | -------- | -------------------------------------------------------------------------- |
| `email` | opcional | Email do usuário; se informado, é preenchido automaticamente no navegador. |

**Funcionamento**

1. Abre o Chrome (Playwright), acessa a [página de login](https://app.tarefy.com/login) e aguarda o usuário efetuar login (se o email foi informado, preenche o campo).
2. Obtém o cookie `tarefy`, que corresponde ao token de autenticação da API HTTP do Tarefy.
3. Salva o token na pasta pessoal do usuário para uso pelas demais ferramentas do MCP.

---

### `get-task`

**Inputs**

| Nome     | Tipo     | Descrição                                                                                                                |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `prompt` | opcional | Instruções sobre o formato/conteúdo da resposta (quais dados incluir, formato etc.). Se omitido, retorna todos os dados. |

**Funcionamento**

1. Obtém os dados gerais da task, as conversas internas e as conversas públicas.
2. Com esses dados e o `prompt` (se houver), monta e devolve a resposta. Sem `prompt`, monta e devolve um JSON no formato `{ task, comments, publicComments }`.

---

### `list-tasks`

**Inputs**

| Nome       | Tipo     | Descrição                                                                                                                               |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `category` | opcional | `todo` (a fazer, padrão), `validation` (em validação), `done` (finalizadas), `created` (criadas pelo usuário) ou `followed` (seguidas). |
| `prompt`   | opcional | Instruções sobre o formato/conteúdo da resposta (quais dados incluir, formato etc.). Se omitido, retorna todos os dados.                |

**Funcionamento**

1. Lê o token salvo e extrai o `userId` (campo `id` do payload JWT).
2. Chama o endpoint de lista correspondente à `category`.
3. Sem `prompt`, devolve um JSON no formato `{ category, tasks }`. Com `prompt`, devolve o mesmo JSON precedido das instruções.

---

### `add-comment`

**Inputs**

| Nome      | Tipo        | Descrição                                                                              |
| --------- | ----------- | -------------------------------------------------------------------------------------- |
| `taskId`  | obrigatório | ID da task (o mesmo da URL: `https://app.tarefy.com/task/{{taskId}}`).                 |
| `content` | obrigatório | Texto do comentário. Quebras de linha viram parágrafos; HTML é escapado.               |
| `client`  | opcional    | `true` = conversa pública (visível para o cliente). Padrão `false` (conversa interna). |

**Funcionamento**

1. Lê o token salvo e obtém os dados gerais da task para descobrir o ticketId (campo `id`).
2. Converte o texto em HTML (escapa caracteres especiais, um `<p>` por linha).
3. Cria a conversa via `POST /nodeapi/v2/comments` e devolve uma confirmação com o ID do comentário criado.

---

### `update-status`

**Inputs**

| Nome     | Tipo        | Descrição                                                                                                         |
| -------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `taskId` | obrigatório | ID da task (o mesmo da URL: `https://app.tarefy.com/task/{{taskId}}`).                                            |
| `status` | obrigatório | `open` (aberta; reabre uma finalizada ou recusa a validação), `validation` (em validação) ou `done` (finalizada). |

**Funcionamento**

1. Lê o token salvo e obtém os dados gerais da task: ticketId (campo `id`) e status atual (campo `status`: `0` aberta, `1` finalizada, `2` em validação).
2. Se a task já está no status pedido, devolve uma mensagem sem chamar a API de alteração.
3. `open` em task finalizada usa `PATCH /nodeapi/task/reopen`; os demais casos usam `PATCH /nodeapi/task/updatestatus` com o código do status.
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
| --------- | ----------- | ------------------------- |
| `term`    | obrigatório | Texto ou número a buscar. |

Devolve `{ term, tasks }`; cada item traz `id_tarefa` (ID da URL) e `titulo`.

---

### `get-task-options`

Sem parâmetros. Devolve os IDs necessários para criar/editar tasks: `projects` (com `columns`, as etapas do quadro, em ordem), `taskTypes`, `tags` (não arquivadas), `teams` (com `userIds`), `users` e `urgencies` (`Baixa`, `Média`, `Alta`, `Urgente`).

---

### `list-project-tasks`

Lista as tasks de um projeto (quadro), resumidas (status, coluna, responsáveis, tags, cliente, tipo, urgência, datas, tempo trabalhado), das mais recentes para as mais antigas.

| Parâmetro   | Tipo        | Descrição                                                              |
| ----------- | ----------- | ---------------------------------------------------------------------- |
| `projectId` | obrigatório | ID do projeto.                                                         |
| `status`    | opcional    | `open`, `validation`, `done` ou `all`. Padrão: abertas + em validação. |
| `limit`     | opcional    | Máximo de tasks retornadas (até 1000). Padrão: 100.                    |

Devolve `{ projectId, total, returned, tasks }`.

---

### `get-task-details`

Dados complementares que o `get-task` não traz.

| Parâmetro | Tipo        | Descrição                                                                                                                                          |
| --------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taskId`  | obrigatório | ID da task.                                                                                                                                        |
| `include` | opcional    | Lista entre `subtasks`, `attachments`, `relationships`, `timeEntries` (horas lançadas) e `insights` (lead time, cycle time, aging). Padrão: todas. |

---

### `create-task`

Cria uma task, ou uma subtask quando `parentTaskId` é informado.

| Parâmetro        | Tipo        | Descrição                                                      |
| ---------------- | ----------- | -------------------------------------------------------------- |
| `title`          | obrigatório | Título.                                                        |
| `projectId`      | opcional    | ID do projeto (quadro).                                        |
| `columnId`       | opcional    | ID da coluna (etapa). Exige `projectId`.                       |
| `clientId`       | opcional    | ID do cliente.                                                 |
| `responsibleIds` | opcional    | IDs dos usuários responsáveis.                                 |
| `typeId`         | opcional    | ID do tipo de task.                                            |
| `dueDate`        | opcional    | Data desejada (`AAAA-MM-DD`).                                  |
| `urgency`        | opcional    | `Baixa` (padrão), `Média`, `Alta` ou `Urgente`.                |
| `estimatedTime`  | opcional    | Estimativa (`"2:00"`).                                         |
| `description`    | opcional    | Descrição em texto puro (convertida para o formato do editor). |
| `tagIds`         | opcional    | IDs das tags.                                                  |
| `parentTaskId`   | opcional    | ID da URL da task pai, para criar uma subtask.                 |

Devolve o ID e o link da task criada.

---

### `update-task`

Atualiza campos de uma task. Informe só o que mudar; `null` limpa o campo. A descrição não é editável por aqui (o app a edita em tempo real via socket). Para status use `update-status`; para coluna, `move-task`.

| Parâmetro          | Tipo        | Descrição                                                 |
| ------------------ | ----------- | --------------------------------------------------------- |
| `taskId`           | obrigatório | ID da task.                                               |
| `title`            | opcional    | Novo título.                                              |
| `typeId`           | opcional    | ID do tipo (ou `null`).                                   |
| `clientId`         | opcional    | ID do cliente (ou `null`).                                |
| `dueDate`          | opcional    | Data desejada (ou `null`).                                |
| `startDate`        | opcional    | Data de início (ou `null`).                               |
| `endDate`          | opcional    | Data de entrega (ou `null`).                              |
| `urgency`          | opcional    | `Baixa`, `Média`, `Alta` ou `Urgente`.                    |
| `estimatedTime`    | opcional    | Estimativa (`"2:00"`).                                    |
| `budget`           | opcional    | Horas orçadas (`"10:00"`).                                |
| `competence`       | opcional    | Competência `AAAAMM` (ou `null`).                         |
| `bug`              | opcional    | Marca/desmarca como bug.                                  |
| `hiddenFromClient` | opcional    | `true` oculta a task do cliente; `false` a torna visível. |

---

### `move-task`

Move a task para outra coluna (etapa), inclusive no quadro de outro projeto.

| Parâmetro   | Tipo        | Descrição                                            |
| ----------- | ----------- | ---------------------------------------------------- |
| `taskId`    | obrigatório | ID da task.                                          |
| `columnId`  | obrigatório | ID da coluna de destino.                             |
| `projectId` | opcional    | ID do projeto de destino, quando diferente do atual. |

---

### `update-responsibles`, `update-followers` e `update-tags`

Adicionam e/ou removem responsáveis, seguidores ou tags de uma task. Fazem uma chamada por item e param no primeiro erro, informando o que já foi aplicado.

| Parâmetro | Tipo        | Descrição                                 |
| --------- | ----------- | ----------------------------------------- |
| `taskId`  | obrigatório | ID da task.                               |
| `add`     | opcional    | IDs (de usuários ou de tags) a adicionar. |
| `remove`  | opcional    | IDs (de usuários ou de tags) a remover.   |

---

### `add-relationship`

Relaciona duas tasks.

| Parâmetro      | Tipo        | Descrição                                                      |
| -------------- | ----------- | -------------------------------------------------------------- |
| `taskId`       | obrigatório | ID da task de origem.                                          |
| `targetTaskId` | obrigatório | ID da URL da outra task.                                       |
| `type`         | opcional    | `relates_to` (padrão), `blocks`, `depends_on` ou `duplicates`. |

---

### `toggle-timer`

Inicia ou pausa (alterna) o cronômetro do usuário logado na task. Iniciar em uma task pode pausar o cronômetro de outra.

| Parâmetro | Tipo        | Descrição   |
| --------- | ----------- | ----------- |
| `taskId`  | obrigatório | ID da task. |

---

### `log-time`

Lança horas trabalhadas na task para o usuário logado.

| Parâmetro  | Tipo        | Descrição                         |
| ---------- | ----------- | --------------------------------- |
| `taskId`   | obrigatório | ID da task.                       |
| `duration` | obrigatório | Tempo trabalhado (`"1:30"`).      |
| `date`     | opcional    | Dia (`AAAA-MM-DD`). Padrão: hoje. |

---

### `duplicate-task`

Duplica a task e devolve os dados da cópia.

| Parâmetro | Tipo        | Descrição   |
| --------- | ----------- | ----------- |
| `taskId`  | obrigatório | ID da task. |

---

### `upload-attachment`

Envia um arquivo local como anexo da task.

| Parâmetro  | Tipo        | Descrição                          |
| ---------- | ----------- | ---------------------------------- |
| `taskId`   | obrigatório | ID da task.                        |
| `filePath` | obrigatório | Caminho absoluto do arquivo local. |
