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
