#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runLogin } from "./tools/login.js";
import { runGetTask } from "./tools/get-task.js";
import { runListTasks } from "./tools/list-tasks.js";
import { runAddComment } from "./tools/add-comment.js";
import { runUpdateStatus } from "./tools/update-status.js";
import { runSearchTasks } from "./tools/search-tasks.js";
import { runGetTaskOptions } from "./tools/get-task-options.js";
import { runListProjectTasks } from "./tools/list-project-tasks.js";
import {
  runGetTaskDetails,
  TASK_DETAIL_SECTIONS,
} from "./tools/get-task-details.js";
import { runCreateTask } from "./tools/create-task.js";
import { runUpdateTask } from "./tools/update-task.js";
import { runMoveTask } from "./tools/move-task.js";
import {
  runUpdateFollowers,
  runUpdateResponsibles,
  runUpdateTags,
} from "./tools/update-members.js";
import { runAddRelationship } from "./tools/add-relationship.js";
import { runLogTime, runToggleTimer } from "./tools/time-tracking.js";
import { runDuplicateTask } from "./tools/duplicate-task.js";
import { runUploadAttachment } from "./tools/upload-attachment.js";

const server = new McpServer({
  name: "tarefy",
  version: "1.0.0",
});

server.registerTool(
  "login",
  {
    description:
      "Abre o Chrome na página de login do Tarefy, permite que o usuário faça login, obtém o cookie de autenticação e salva o token para uso pelas demais ferramentas.",
    inputSchema: {
      email: z
        .string()
        .optional()
        .describe(
          "Email do usuário; se informado, é preenchido automaticamente no navegador."
        ),
    },
  },
  async ({ email }) => {
    try {
      await runLogin({ email });
      return {
        content: [
          {
            type: "text",
            text: "Login realizado com sucesso. O token foi salvo e as demais ferramentas já podem ser usadas.",
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Erro no login: ${message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get-task",
  {
    description:
      "Obtém os dados gerais de uma task do Tarefy, as conversas internas e as conversas públicas. Requer que o usuário já tenha feito login (ferramenta 'login').",
    inputSchema: {
      taskId: z
        .string()
        .min(1)
        .describe(
          "ID da task (o mesmo da URL: https://app.tarefy.com/task/{{taskId}})."
        ),
      prompt: z
        .string()
        .optional()
        .describe(
          "Instruções sobre o formato/conteúdo da resposta (quais dados incluir, formato etc.). Se omitido, retorna todos os dados em JSON."
        ),
    },
  },
  async ({ taskId, prompt }) => {
    try {
      const text = await runGetTask({ taskId, prompt });
      return {
        content: [{ type: "text", text }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Erro ao obter task: ${message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "list-tasks",
  {
    description:
      "Lista as tasks do usuário logado no Tarefy por categoria (as abas de 'Minhas tasks'). Requer que o usuário já tenha feito login (ferramenta 'login').",
    inputSchema: {
      category: z
        .enum(["todo", "validation", "done", "created", "followed"])
        .optional()
        .describe(
          "Categoria: 'todo' (a fazer, padrão), 'validation' (em validação), 'done' (finalizadas), 'created' (criadas pelo usuário) ou 'followed' (seguidas)."
        ),
      prompt: z
        .string()
        .optional()
        .describe(
          "Instruções sobre o formato/conteúdo da resposta (quais dados incluir, formato etc.). Se omitido, retorna todos os dados em JSON."
        ),
    },
  },
  async ({ category, prompt }) => {
    try {
      const text = await runListTasks({ category, prompt });
      return {
        content: [{ type: "text", text }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Erro ao listar tasks: ${message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "add-comment",
  {
    description:
      "Adiciona uma conversa (comentário) a uma task do Tarefy. Por padrão a conversa é interna (só a equipe vê); com client=true ela é pública e fica visível para o cliente. Requer que o usuário já tenha feito login (ferramenta 'login').",
    inputSchema: {
      taskId: z
        .string()
        .min(1)
        .describe(
          "ID da task (o mesmo da URL: https://app.tarefy.com/task/{{taskId}})."
        ),
      content: z
        .string()
        .min(1)
        .describe(
          "Texto do comentário. Quebras de linha viram parágrafos; HTML é escapado."
        ),
      client: z
        .boolean()
        .optional()
        .describe(
          "true = conversa pública, visível para o cliente. Padrão: false (conversa interna). Só use true quando o usuário pedir explicitamente."
        ),
    },
  },
  async ({ taskId, content, client }) => {
    try {
      const text = await runAddComment({ taskId, content, client });
      return {
        content: [{ type: "text", text }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: "text", text: `Erro ao adicionar comentário: ${message}` },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "update-status",
  {
    description:
      "Altera o status de uma task do Tarefy: 'open' (aberta; reabre uma finalizada ou recusa a validação), 'validation' (envia para validação) ou 'done' (finaliza). Requer que o usuário já tenha feito login (ferramenta 'login').",
    inputSchema: {
      taskId: z
        .string()
        .min(1)
        .describe(
          "ID da task (o mesmo da URL: https://app.tarefy.com/task/{{taskId}})."
        ),
      status: z
        .enum(["open", "validation", "done"])
        .describe(
          "Novo status: 'open' (aberta), 'validation' (em validação) ou 'done' (finalizada)."
        ),
    },
  },
  async ({ taskId, status }) => {
    try {
      const text = await runUpdateStatus({ taskId, status });
      return {
        content: [{ type: "text", text }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Erro ao alterar status: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Executa a lógica da tool e converte o texto (ou o erro) no formato de resposta do MCP.
 */
async function textResult(errorPrefix: string, run: () => Promise<string>) {
  try {
    return { content: [{ type: "text" as const, text: await run() }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `${errorPrefix}: ${message}` }],
      isError: true,
    };
  }
}

const LOGIN_NOTE =
  "Requer que o usuário já tenha feito login (ferramenta 'login').";

const taskIdSchema = z
  .string()
  .min(1)
  .describe(
    "ID da task (o mesmo da URL: https://app.tarefy.com/task/{{taskId}})."
  );

const durationSchema = z
  .string()
  .describe('Duração no formato horas:minutos, ex.: "1:30".');

const dateSchema = z.string().describe("Data no formato AAAA-MM-DD.");

const urgencySchema = z
  .enum(["Baixa", "Média", "Alta", "Urgente"])
  .describe("Urgência (prioridade) da task.");

const idListSchema = (what: string) =>
  z.array(z.number().int().positive()).optional().describe(what);

server.registerTool(
  "search-tasks",
  {
    description: `Busca tasks do Tarefy por texto (título) ou número. Retorna id_tarefa (ID da URL) e título de cada resultado. ${LOGIN_NOTE}`,
    inputSchema: {
      term: z.string().min(1).describe("Texto ou número a buscar."),
    },
  },
  ({ term }) =>
    textResult("Erro ao buscar tasks", () => runSearchTasks({ term }))
);

server.registerTool(
  "get-task-options",
  {
    description: `Lista os IDs necessários para criar/editar tasks: projetos com suas colunas (etapas), tipos de task, tags, equipes, usuários e urgências. Use antes de create-task, update-task, move-task, update-responsibles, update-followers e update-tags. ${LOGIN_NOTE}`,
    inputSchema: {},
  },
  () => textResult("Erro ao obter opções", () => runGetTaskOptions())
);

server.registerTool(
  "list-project-tasks",
  {
    description: `Lista as tasks de um projeto (quadro) do Tarefy, resumidas (coluna, responsáveis, tags, datas), das mais recentes para as mais antigas. Por padrão só as não finalizadas. ${LOGIN_NOTE}`,
    inputSchema: {
      projectId: z
        .number()
        .int()
        .positive()
        .describe("ID do projeto (veja get-task-options)."),
      status: z
        .enum(["open", "validation", "done", "all"])
        .optional()
        .describe(
          "Filtro: 'open' (abertas), 'validation' (em validação), 'done' (finalizadas) ou 'all'. Padrão: abertas + em validação."
        ),
      limit: z
        .number()
        .int()
        .positive()
        .max(1000)
        .optional()
        .describe("Máximo de tasks retornadas. Padrão: 100."),
    },
  },
  ({ projectId, status, limit }) =>
    textResult("Erro ao listar tasks do projeto", () =>
      runListProjectTasks({ projectId, status, limit })
    )
);

server.registerTool(
  "get-task-details",
  {
    description: `Obtém dados complementares de uma task que o get-task não traz: subtasks, anexos, relacionamentos, horas lançadas (timeEntries) e métricas de fluxo (insights). ${LOGIN_NOTE}`,
    inputSchema: {
      taskId: taskIdSchema,
      include: z
        .array(z.enum(TASK_DETAIL_SECTIONS))
        .optional()
        .describe("Seções a incluir. Padrão: todas."),
    },
  },
  ({ taskId, include }) =>
    textResult("Erro ao obter detalhes da task", () =>
      runGetTaskDetails({ taskId, include })
    )
);

server.registerTool(
  "create-task",
  {
    description: `Cria uma task no Tarefy (ou uma subtask, com parentTaskId). IDs de projeto, coluna, tipo, tags e usuários vêm de get-task-options. ${LOGIN_NOTE}`,
    inputSchema: {
      title: z.string().min(1).describe("Título da task."),
      projectId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("ID do projeto (quadro)."),
      columnId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("ID da coluna (etapa) do projeto. Exige projectId."),
      clientId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("ID do cliente."),
      responsibleIds: idListSchema("IDs dos usuários responsáveis."),
      typeId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("ID do tipo de task."),
      dueDate: dateSchema.optional().describe("Data desejada (AAAA-MM-DD)."),
      urgency: urgencySchema.optional().describe("Urgência. Padrão: Baixa."),
      estimatedTime: durationSchema
        .optional()
        .describe('Estimativa, ex.: "2:00".'),
      description: z.string().optional().describe("Descrição em texto puro."),
      tagIds: idListSchema("IDs das tags."),
      parentTaskId: z
        .string()
        .optional()
        .describe("ID da URL da task pai, para criar uma subtask."),
    },
  },
  (input) => textResult("Erro ao criar task", () => runCreateTask(input))
);

server.registerTool(
  "update-task",
  {
    description: `Atualiza campos de uma task do Tarefy (título, tipo, cliente, datas, urgência, estimativa, horas orçadas, competência, bug e visibilidade para o cliente). Informe só os campos a alterar; null limpa o campo. A descrição não pode ser editada por aqui. Para status use update-status; para coluna use move-task. ${LOGIN_NOTE}`,
    inputSchema: {
      taskId: taskIdSchema,
      title: z.string().min(1).optional().describe("Novo título."),
      typeId: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional()
        .describe("ID do tipo de task."),
      clientId: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional()
        .describe("ID do cliente."),
      dueDate: dateSchema.nullable().optional().describe("Data desejada."),
      startDate: dateSchema.nullable().optional().describe("Data de início."),
      endDate: dateSchema.nullable().optional().describe("Data de entrega."),
      urgency: urgencySchema.optional(),
      estimatedTime: durationSchema.optional().describe("Estimativa."),
      budget: durationSchema.optional().describe("Horas orçadas."),
      competence: z
        .string()
        .nullable()
        .optional()
        .describe('Competência no formato AAAAMM, ex.: "202610".'),
      bug: z.boolean().optional().describe("Marca/desmarca a task como bug."),
      hiddenFromClient: z
        .boolean()
        .optional()
        .describe(
          "true oculta a task do cliente; false a torna visível. Só altere quando o usuário pedir."
        ),
    },
  },
  (input) => textResult("Erro ao atualizar task", () => runUpdateTask(input))
);

server.registerTool(
  "move-task",
  {
    description: `Move uma task para outra coluna (etapa) de um projeto, ou para o quadro de outro projeto. IDs vêm de get-task-options. ${LOGIN_NOTE}`,
    inputSchema: {
      taskId: taskIdSchema,
      columnId: z
        .number()
        .int()
        .positive()
        .describe("ID da coluna de destino."),
      projectId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("ID do projeto de destino, quando diferente do atual."),
    },
  },
  (input) => textResult("Erro ao mover task", () => runMoveTask(input))
);

const membersSchema = (what: string) => ({
  taskId: taskIdSchema,
  add: idListSchema(`IDs de ${what} a adicionar.`),
  remove: idListSchema(`IDs de ${what} a remover.`),
});

server.registerTool(
  "update-responsibles",
  {
    description: `Adiciona e/ou remove responsáveis de uma task. IDs de usuários vêm de get-task-options. ${LOGIN_NOTE}`,
    inputSchema: membersSchema("usuários"),
  },
  (input) =>
    textResult("Erro ao atualizar responsáveis", () =>
      runUpdateResponsibles(input)
    )
);

server.registerTool(
  "update-followers",
  {
    description: `Adiciona e/ou remove seguidores de uma task. IDs de usuários vêm de get-task-options. ${LOGIN_NOTE}`,
    inputSchema: membersSchema("usuários"),
  },
  (input) =>
    textResult("Erro ao atualizar seguidores", () => runUpdateFollowers(input))
);

server.registerTool(
  "update-tags",
  {
    description: `Adiciona e/ou remove tags de uma task. IDs de tags vêm de get-task-options. ${LOGIN_NOTE}`,
    inputSchema: membersSchema("tags"),
  },
  (input) => textResult("Erro ao atualizar tags", () => runUpdateTags(input))
);

server.registerTool(
  "add-relationship",
  {
    description: `Relaciona duas tasks do Tarefy: relates_to (relacionada), blocks (bloqueia), depends_on (depende de) ou duplicates (duplica). ${LOGIN_NOTE}`,
    inputSchema: {
      taskId: taskIdSchema,
      targetTaskId: z.string().min(1).describe("ID da URL da outra task."),
      type: z
        .enum(["relates_to", "blocks", "depends_on", "duplicates"])
        .optional()
        .describe("Tipo do relacionamento. Padrão: relates_to."),
    },
  },
  (input) =>
    textResult("Erro ao relacionar tasks", () => runAddRelationship(input))
);

server.registerTool(
  "toggle-timer",
  {
    description: `Inicia ou pausa (alterna) o cronômetro de tempo do usuário logado em uma task. Iniciar em uma task pode pausar o cronômetro de outra. ${LOGIN_NOTE}`,
    inputSchema: { taskId: taskIdSchema },
  },
  (input) =>
    textResult("Erro ao alternar cronômetro", () => runToggleTimer(input))
);

server.registerTool(
  "log-time",
  {
    description: `Lança horas trabalhadas em uma task para o usuário logado. ${LOGIN_NOTE}`,
    inputSchema: {
      taskId: taskIdSchema,
      duration: durationSchema.describe(
        'Tempo trabalhado no formato horas:minutos, ex.: "1:30".'
      ),
      date: dateSchema.optional().describe("Dia do lançamento. Padrão: hoje."),
    },
  },
  (input) => textResult("Erro ao lançar horas", () => runLogTime(input))
);

server.registerTool(
  "duplicate-task",
  {
    description: `Duplica uma task do Tarefy. ${LOGIN_NOTE}`,
    inputSchema: { taskId: taskIdSchema },
  },
  (input) => textResult("Erro ao duplicar task", () => runDuplicateTask(input))
);

server.registerTool(
  "upload-attachment",
  {
    description: `Envia um arquivo local como anexo de uma task. ${LOGIN_NOTE}`,
    inputSchema: {
      taskId: taskIdSchema,
      filePath: z
        .string()
        .min(1)
        .describe("Caminho absoluto do arquivo local."),
    },
  },
  (input) =>
    textResult("Erro ao enviar anexo", () => runUploadAttachment(input))
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Tarefy MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
