import { loadToken } from "../auth/token-store.js";
import {
  fetchTask,
  reopenTask,
  updateTaskStatus,
  type TarefyTaskStatus,
} from "../api/tarefy.js";

export type TaskStatusName = "open" | "validation" | "done";

export interface UpdateStatusInput {
  taskId: string;
  status: TaskStatusName;
}

const STATUS_CODES: Record<TaskStatusName, TarefyTaskStatus> = {
  open: 0,
  done: 1,
  validation: 2,
};

const STATUS_LABELS: Record<TarefyTaskStatus, string> = {
  0: "aberta",
  1: "finalizada",
  2: "em validação",
};

/**
 * Altera o status da task: `open` (aberta), `validation` (em validação) ou `done` (finalizada).
 * O `taskId` é o da URL; o ticketId e o status atual vêm dos dados gerais da task.
 * Reabrir uma task finalizada usa a rota própria de reabertura, como no app.
 */
export async function runUpdateStatus(
  input: UpdateStatusInput
): Promise<string> {
  const token = await loadToken();
  if (!token) {
    throw new Error(
      "Token não encontrado. Use a ferramenta 'login' primeiro para autenticar."
    );
  }

  const task = await fetchTask(input.taskId, token);
  const ticketId = task.id;
  if (ticketId == null || typeof ticketId !== "number") {
    throw new Error(
      "Resposta da API da task não contém o campo 'id' (ticketId)."
    );
  }

  const target = STATUS_CODES[input.status];
  const label = STATUS_LABELS[target];
  if (task.status === target) {
    return `A task ${input.taskId} já está ${label}; nada foi alterado.`;
  }

  const message =
    target === 0 && task.status === 1
      ? await reopenTask(ticketId, token)
      : await updateTaskStatus(ticketId, target, token);

  return `Task ${input.taskId} agora está ${label}.${message ? ` ${message}` : ""}`;
}
