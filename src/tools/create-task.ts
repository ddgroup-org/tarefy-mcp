import {
  createTask,
  resolveTaskIds,
  type CreateTaskBody,
} from "../api/tasks.js";
import { assertDate, requireToken, toTarefyDuration } from "./common.js";

export type Urgency = "Baixa" | "Média" | "Alta" | "Urgente";

export interface CreateTaskInput {
  title: string;
  projectId?: number;
  columnId?: number;
  clientId?: number;
  responsibleIds?: number[];
  typeId?: number;
  dueDate?: string;
  urgency?: Urgency;
  estimatedTime?: string;
  description?: string;
  tagIds?: number[];
  parentTaskId?: string;
}

/** Texto puro → Quill delta, o formato da descrição no Tarefy. */
export function textToDelta(text: string): {
  format: "quill-delta-v1";
  ops: { insert: string }[];
} {
  const normalized = text.replace(/\r\n/g, "\n");
  return {
    format: "quill-delta-v1",
    ops: [
      { insert: normalized.endsWith("\n") ? normalized : `${normalized}\n` },
    ],
  };
}

/**
 * Cria uma task. Com `parentTaskId` (ID da URL da task pai), cria uma subtask.
 * IDs de projeto, coluna, tipo, tag e usuários vêm de `get-task-options`.
 */
export async function runCreateTask(input: CreateTaskInput): Promise<string> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("O título não pode ser vazio.");
  }
  if (input.columnId && !input.projectId) {
    throw new Error("Informe o projectId junto com o columnId.");
  }
  const token = await requireToken();

  const body: CreateTaskBody = {
    title,
    project_id: input.projectId,
    column_id: input.columnId,
    client_id: input.clientId,
    task_responsible: input.responsibleIds?.length
      ? input.responsibleIds.map((user) => ({ user }))
      : undefined,
    type_id: input.typeId,
    due_date: input.dueDate ? assertDate(input.dueDate, "dueDate") : undefined,
    urgency: input.urgency ?? "Baixa",
    estimated_time: input.estimatedTime
      ? toTarefyDuration(input.estimatedTime)
      : "000:00",
    initialDescription: input.description?.trim()
      ? textToDelta(input.description.trim())
      : undefined,
    tagsSelect: input.tagIds?.length ? input.tagIds.join(",") : null,
  };

  if (input.parentTaskId) {
    const parent = await resolveTaskIds(input.parentTaskId, token);
    body.parent_task_id = parent.internalId;
    body.creation_context = "subtask";
  }

  const task = await createTask(body, token);
  const publicId = task.id_tarefa ?? task.task_id;
  const kind = input.parentTaskId
    ? `Subtask criada na task ${input.parentTaskId}`
    : "Task criada";
  return `${kind}: ${publicId ?? `id interno ${task.id}`} - ${title}${
    publicId ? ` (https://app.tarefy.com/task/${publicId})` : ""
  }.`;
}
