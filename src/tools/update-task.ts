import {
  resolveTaskIds,
  setClientVisibility,
  updateTask,
} from "../api/tasks.js";
import { assertDate, requireToken, toTarefyDuration } from "./common.js";
import type { Urgency } from "./create-task.js";

export interface UpdateTaskInput {
  taskId: string;
  title?: string;
  typeId?: number | null;
  clientId?: number | null;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  urgency?: Urgency;
  estimatedTime?: string;
  budget?: string;
  competence?: string | null;
  bug?: boolean;
  hiddenFromClient?: boolean;
}

function optionalDate(
  value: string | null | undefined,
  name: string
): string | null | undefined {
  return value == null ? value : assertDate(value, name);
}

/**
 * Atualiza campos da task via PATCH /v2/tasks/{publicId}.
 * `null` limpa o campo (datas, tipo, cliente, competência).
 * A descrição não é editável aqui: o app a edita em tempo real (socket), não via REST.
 */
export async function runUpdateTask(input: UpdateTaskInput): Promise<string> {
  const fields: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new Error("O título não pode ser vazio.");
    fields.title = title;
  }
  if (input.typeId !== undefined) fields.type_id = input.typeId;
  if (input.clientId !== undefined) fields.client_id = input.clientId;
  if (input.dueDate !== undefined)
    fields.due_date = optionalDate(input.dueDate, "dueDate");
  if (input.startDate !== undefined)
    fields.start_date = optionalDate(input.startDate, "startDate");
  if (input.endDate !== undefined)
    fields.end_date = optionalDate(input.endDate, "endDate");
  if (input.urgency !== undefined) fields.urgency = input.urgency;
  if (input.estimatedTime !== undefined)
    fields.estimated_time = toTarefyDuration(input.estimatedTime);
  if (input.budget !== undefined)
    fields.budget = toTarefyDuration(input.budget);
  if (input.competence !== undefined) {
    if (input.competence !== null && !/^\d{6}$/.test(input.competence)) {
      throw new Error(
        `Competência inválida: "${input.competence}". Use AAAAMM, ex.: "202610".`
      );
    }
    fields.competence =
      input.competence === null ? null : Number(input.competence);
  }
  if (input.bug !== undefined) fields.bug = input.bug;

  if (
    Object.keys(fields).length === 0 &&
    input.hiddenFromClient === undefined
  ) {
    throw new Error("Nenhum campo para atualizar foi informado.");
  }

  const token = await requireToken();
  const { publicId } = await resolveTaskIds(input.taskId, token);

  const changed: string[] = [];
  if (Object.keys(fields).length > 0) {
    await updateTask(publicId, fields, token);
    changed.push(...Object.keys(fields));
  }
  if (input.hiddenFromClient !== undefined) {
    await setClientVisibility(publicId, input.hiddenFromClient, token);
    changed.push(
      input.hiddenFromClient
        ? "oculta para o cliente"
        : "visível para o cliente"
    );
  }
  return `Task ${publicId} atualizada: ${changed.join(", ")}.`;
}
