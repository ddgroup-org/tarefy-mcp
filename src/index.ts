#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runLogin } from "./tools/login.js";
import { runGetTask } from "./tools/get-task.js";
import { runListTasks } from "./tools/list-tasks.js";
import { runAddComment } from "./tools/add-comment.js";
import { runUpdateStatus } from "./tools/update-status.js";

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

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Tarefy MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
