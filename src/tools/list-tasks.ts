import { loadToken } from "../auth/token-store.js";
import { getUserIdFromToken } from "../auth/jwt.js";
import {
  fetchTaskList,
  type TarefyTask,
  type TaskListCategory,
} from "../api/tarefy.js";

export interface ListTasksInput {
  category?: TaskListCategory;
  prompt?: string;
}

export interface TaskListPayload {
  category: TaskListCategory;
  tasks: TarefyTask[];
}

/**
 * Lista as tasks do usuário logado em uma categoria (abas de "Minhas tasks").
 * O `userId` vem do próprio token salvo pelo `login`.
 * Assim como em `get-task`, o `prompt` não é processado no servidor: vai como instrução para o cliente.
 */
export async function runListTasks(input: ListTasksInput): Promise<string> {
  const token = await loadToken();
  if (!token) {
    throw new Error(
      "Token não encontrado. Use a ferramenta 'login' primeiro para autenticar."
    );
  }

  const category = input.category ?? "todo";
  const userId = getUserIdFromToken(token);
  const tasks = await fetchTaskList(category, userId, token);

  const payload: TaskListPayload = { category, tasks };

  if (input.prompt?.trim()) {
    return [
      "Instruções (prompt):",
      input.prompt.trim(),
      "",
      "Dados (JSON):",
      JSON.stringify(payload, null, 2),
    ].join("\n");
  }

  return JSON.stringify(payload, null, 2);
}
