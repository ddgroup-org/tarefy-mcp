import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const BASE = "https://app.tarefy.com/nodeapi";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * Requisição autenticada à API do Tarefy.
 * Headers: Authorization: Bearer <token> e, com corpo JSON, Content-Type: application/json.
 * Lança erro com status e corpo da resposta quando ela não é 2xx.
 */
async function request<T>(
  method: Method,
  path: string,
  token: string,
  label: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Tarefy API ${label}: ${res.status} ${res.statusText} - ${text}`
    );
  }
  return (text ? JSON.parse(text) : null) as T;
}

/** Garante `status: true` em respostas no formato `{ status, message }`. */
function ensureStatus<T extends { status?: boolean; message?: string } | null>(
  data: T,
  label: string
): NonNullable<T> {
  if (data?.status !== true) {
    throw new Error(
      `Tarefy API ${label}: ${data?.message ?? "a API não confirmou a operação"}`
    );
  }
  return data as NonNullable<T>;
}

export interface TaskIds {
  /** ID da URL (`id_tarefa`), numerado por conta. */
  publicId: number;
  /** ID interno (o "ticketId"), exigido pela maioria das rotas. */
  internalId: number;
}

/**
 * Resolve o ID da URL para o ID interno.
 * GET /v2/tasks/public/{{taskId}}/internal-id → { status, data: { id, id_tarefa } }
 */
export async function resolveTaskIds(
  taskId: string,
  token: string
): Promise<TaskIds> {
  const data = await request<{
    status?: boolean;
    message?: string;
    data?: { id?: number; id_tarefa?: number };
  }>(
    "GET",
    `/v2/tasks/public/${encodeURIComponent(taskId)}/internal-id`,
    token,
    "task id"
  );
  const id = data?.data?.id;
  const publicId = data?.data?.id_tarefa;
  if (typeof id !== "number" || typeof publicId !== "number") {
    throw new Error(`Task ${taskId} não encontrada.`);
  }
  return { publicId, internalId: id };
}

// ---------- Leitura ----------

/** GET /v2/tasks/search?term= → { tasks: [{ id, id_tarefa, titulo, ... }] } */
export async function searchTasks(
  term: string,
  token: string
): Promise<unknown[]> {
  const data = await request<{ tasks?: unknown[] } | null>(
    "GET",
    `/v2/tasks/search?term=${encodeURIComponent(term)}`,
    token,
    "search"
  );
  return Array.isArray(data?.tasks) ? data.tasks : [];
}

/** GET /v2/tasks/creation-options → { models, projects (com boardlists = colunas) } */
export function fetchCreationOptions(token: string): Promise<unknown> {
  return request(
    "GET",
    "/v2/tasks/creation-options",
    token,
    "creation options"
  );
}

/** GET /v2/task-types?only_active=true */
export function fetchTaskTypes(token: string): Promise<unknown> {
  return request("GET", "/v2/task-types?only_active=true", token, "task types");
}

/** GET /v2/task-tags */
export function fetchTaskTags(token: string): Promise<unknown> {
  return request("GET", "/v2/task-tags", token, "task tags");
}

/** GET /v2/teams/task-creation-options → { data: { teams: [{ id, name, usersList }] } } */
export function fetchTeams(token: string): Promise<unknown> {
  return request("GET", "/v2/teams/task-creation-options", token, "teams");
}

/** GET /v2/tasks/project/{{projectId}} */
export function fetchProjectTasks(
  projectId: number,
  token: string
): Promise<unknown> {
  return request(
    "GET",
    `/v2/tasks/project/${projectId}`,
    token,
    "project tasks"
  );
}

/** GET /v2/tasks/{{internalId}}/subtasks → { subTasks } */
export async function fetchSubtasks(
  internalId: number,
  token: string
): Promise<unknown> {
  const data = await request<{ subTasks?: unknown } | null>(
    "GET",
    `/v2/tasks/${internalId}/subtasks`,
    token,
    "subtasks"
  );
  return data?.subTasks ?? [];
}

/** GET /v2/tasks/{{internalId}}/attachments → { attachs } */
export async function fetchAttachments(
  internalId: number,
  token: string
): Promise<unknown> {
  const data = await request<{ attachs?: unknown } | null>(
    "GET",
    `/v2/tasks/${internalId}/attachments`,
    token,
    "attachments"
  );
  return data?.attachs ?? [];
}

/** GET /v2/tasks/{{internalId}}/relationships → { relationships } */
export async function fetchRelationships(
  internalId: number,
  token: string
): Promise<unknown> {
  const data = await request<{ relationships?: unknown } | null>(
    "GET",
    `/v2/tasks/${internalId}/relationships`,
    token,
    "relationships"
  );
  return data?.relationships ?? [];
}

/** GET /task/manualhours?id={{internalId}} → { times } (horas lançadas) */
export async function fetchTimeEntries(
  internalId: number,
  token: string
): Promise<unknown> {
  const data = await request<{ times?: unknown } | null>(
    "GET",
    `/task/manualhours?id=${internalId}`,
    token,
    "manual hours"
  );
  return data?.times ?? [];
}

/** GET /v2/tasks/{{internalId}}/insights → lead time, cycle time, aging etc. */
export function fetchInsights(
  internalId: number,
  token: string
): Promise<unknown> {
  return request("GET", `/v2/tasks/${internalId}/insights`, token, "insights");
}

// ---------- Escrita ----------

export interface CreateTaskBody {
  title: string;
  project_id?: number;
  column_id?: number;
  client_id?: number;
  task_responsible?: { user: number }[];
  type_id?: number;
  due_date?: string;
  urgency?: string;
  estimated_time: string;
  initialDescription?: { format: "quill-delta-v1"; ops: { insert: string }[] };
  tagsSelect?: string | null;
  parent_task_id?: number;
  creation_context?: "subtask";
}

export interface CreatedTask {
  id?: number;
  id_tarefa?: number;
  task_id?: number;
  [key: string]: unknown;
}

/**
 * Cria uma task.
 * POST /v2/tasks, ou POST /v2/tasks/column/{{projectId}}/{{columnId}} quando projeto e coluna são informados.
 * Resposta: { task } ou a própria task.
 */
export async function createTask(
  body: CreateTaskBody,
  token: string
): Promise<CreatedTask> {
  const path =
    body.project_id && body.column_id && !body.parent_task_id
      ? `/v2/tasks/column/${body.project_id}/${body.column_id}`
      : "/v2/tasks";
  const data = await request<(CreatedTask & { task?: CreatedTask }) | null>(
    "POST",
    path,
    token,
    "create task",
    body
  );
  const task = data?.task ?? data;
  if (!task?.id) {
    throw new Error(
      "Tarefy API create task: a resposta não trouxe a task criada."
    );
  }
  return task;
}

/**
 * Atualiza campos da task.
 * PATCH /v2/tasks/{{publicId}}  body: { title?, type_id?, client_id?, due_date?, ... }
 */
export function updateTask(
  publicId: number,
  fields: Record<string, unknown>,
  token: string
): Promise<unknown> {
  return request(
    "PATCH",
    `/v2/tasks/${publicId}`,
    token,
    "update task",
    fields
  );
}

/** PATCH /v2/tasks/{{publicId}}/client-visibility  body: { hidden } */
export async function setClientVisibility(
  publicId: number,
  hidden: boolean,
  token: string
): Promise<void> {
  const data = await request<{ status?: boolean; message?: string } | null>(
    "PATCH",
    `/v2/tasks/${publicId}/client-visibility`,
    token,
    "client visibility",
    { hidden }
  );
  if (data?.status === false) {
    throw new Error(`Tarefy API client visibility: ${data.message ?? ""}`);
  }
}

/**
 * Move a task para uma coluna (etapa) de um projeto.
 * PATCH /v2/tasks/{{publicId}}/move  body: { target_column_id, insert_at: "top", target_project_id? }
 */
export function moveTask(
  publicId: number,
  columnId: number,
  projectId: number | undefined,
  token: string
): Promise<unknown> {
  return request("PATCH", `/v2/tasks/${publicId}/move`, token, "move task", {
    target_column_id: columnId,
    insert_at: "top",
    ...(projectId ? { target_project_id: projectId } : {}),
  });
}

export type TaskMemberKind = "responsibles" | "followers";

/** POST /v2/tasks/{{internalId}}/{responsibles|followers}  body: { user_id } */
export async function addTaskMember(
  internalId: number,
  kind: TaskMemberKind,
  userId: number,
  token: string
): Promise<void> {
  const data = await request<{ status?: boolean; message?: string } | null>(
    "POST",
    `/v2/tasks/${internalId}/${kind}`,
    token,
    `add ${kind}`,
    { user_id: userId }
  );
  if (data?.status === false) {
    throw new Error(`Tarefy API add ${kind}: ${data.message ?? ""}`);
  }
}

/** DELETE /v2/tasks/{{internalId}}/{responsibles|followers}/{{userId}} */
export async function removeTaskMember(
  internalId: number,
  kind: TaskMemberKind,
  userId: number,
  token: string
): Promise<void> {
  const data = await request<{ status?: boolean; message?: string } | null>(
    "DELETE",
    `/v2/tasks/${internalId}/${kind}/${userId}`,
    token,
    `remove ${kind}`
  );
  if (data?.status === false) {
    throw new Error(`Tarefy API remove ${kind}: ${data.message ?? ""}`);
  }
}

/** POST /v2/tasks/{{internalId}}/tags  body: { tag_id } */
export async function addTaskTag(
  internalId: number,
  tagId: number,
  token: string
): Promise<void> {
  const data = await request<{ status?: boolean; message?: string } | null>(
    "POST",
    `/v2/tasks/${internalId}/tags`,
    token,
    "add tag",
    { tag_id: tagId }
  );
  if (data?.status === false) {
    throw new Error(`Tarefy API add tag: ${data.message ?? ""}`);
  }
}

/** DELETE /v2/tasks/{{internalId}}/tags/{{tagId}} */
export async function removeTaskTag(
  internalId: number,
  tagId: number,
  token: string
): Promise<void> {
  const data = await request<{ status?: boolean; message?: string } | null>(
    "DELETE",
    `/v2/tasks/${internalId}/tags/${tagId}`,
    token,
    "remove tag"
  );
  if (data?.status === false) {
    throw new Error(`Tarefy API remove tag: ${data.message ?? ""}`);
  }
}

export type RelationshipType =
  | "relates_to"
  | "blocks"
  | "depends_on"
  | "duplicates";

/** POST /v2/tasks/{{internalId}}/relationships  body: { target_task_id (interno), relationship_type } */
export async function addRelationship(
  internalId: number,
  targetInternalId: number,
  type: RelationshipType,
  token: string
): Promise<void> {
  const data = await request<{ status?: boolean; message?: string } | null>(
    "POST",
    `/v2/tasks/${internalId}/relationships`,
    token,
    "add relationship",
    { target_task_id: targetInternalId, relationship_type: type }
  );
  ensureStatus(data, "add relationship");
}

export interface TimerResult {
  message?: string;
  working?: boolean;
}

/**
 * Inicia ou pausa o cronômetro do usuário na task (alterna).
 * PATCH /v2/tasks/{{internalId}}/play-pause → { status, message, task: { working } }
 */
export async function toggleTimer(
  internalId: number,
  token: string
): Promise<TimerResult> {
  const data = ensureStatus(
    await request<{
      status?: boolean;
      message?: string;
      working?: number | boolean;
      task?: { working?: number | boolean };
    } | null>(
      "PATCH",
      `/v2/tasks/${internalId}/play-pause`,
      token,
      "play-pause",
      {}
    ),
    "play-pause"
  );
  const working = data.task?.working ?? data.working;
  return {
    message: data.message,
    working: working === undefined ? undefined : Number(working) === 1,
  };
}

/** POST /v2/tasks/{{publicId}}/worklogs  body: { seconds, date: "YYYY-MM-DD" } */
export async function logTime(
  publicId: number,
  seconds: number,
  date: string,
  token: string
): Promise<string | undefined> {
  const data = ensureStatus(
    await request<{ status?: boolean; message?: string } | null>(
      "POST",
      `/v2/tasks/${publicId}/worklogs`,
      token,
      "worklog",
      { seconds, date }
    ),
    "worklog"
  );
  return data.message;
}

/** POST /v2/tasks/bulk-duplicate  body: { taskIds: [publicId] } → { duplicated, createdTasks } */
export async function duplicateTask(
  publicId: number,
  token: string
): Promise<{ duplicated: number; createdTasks: unknown[] }> {
  const data = await request<{
    duplicated?: number;
    message?: string;
    createdTasks?: unknown[];
  } | null>("POST", "/v2/tasks/bulk-duplicate", token, "duplicate", {
    taskIds: [publicId],
  });
  const duplicated = Number(data?.duplicated ?? 0);
  if (duplicated <= 0) {
    throw new Error(
      `Tarefy API duplicate: ${data?.message ?? "nenhuma task foi duplicada"}`
    );
  }
  return { duplicated, createdTasks: data?.createdTasks ?? [] };
}

/** POST /v2/tasks/{{internalId}}/attachments  multipart: file */
export async function uploadAttachment(
  internalId: number,
  filePath: string,
  token: string
): Promise<unknown> {
  const content = await readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([content]), basename(filePath));
  const data = ensureStatus(
    await request<{
      status?: boolean;
      message?: string;
      data?: unknown;
    } | null>(
      "POST",
      `/v2/tasks/${internalId}/attachments`,
      token,
      "upload attachment",
      form
    ),
    "upload attachment"
  );
  return data.data;
}
