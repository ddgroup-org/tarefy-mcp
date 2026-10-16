const BASE = "https://app.tarefy.com";

export interface TarefyTask {
  id?: number;
  [key: string]: unknown;
}

export interface TarefyComment {
  [key: string]: unknown;
}

/**
 * Cliente HTTP para a API do Tarefy.
 * Headers: Content-Type: application/json, Authorization: Bearer <token>
 */
export async function fetchTask(
  taskId: string,
  token: string
): Promise<TarefyTask> {
  const url = `${BASE}/nodeapi/v2/tasks/${encodeURIComponent(taskId)}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Tarefy API task: ${res.status} ${res.statusText} - ${text}`
    );
  }
  return (await res.json()) as TarefyTask;
}

/**
 * Conversas de uma task, por tipo.
 * GET .../nodeapi/v2/comments/{{ticketId}}?type={{internal|client}}
 * Resposta: { status, data: { comments: [...], total } } (sem paginação).
 */
async function fetchComments(
  ticketId: number,
  type: "internal" | "client",
  token: string
): Promise<TarefyComment[]> {
  const url = `${BASE}/nodeapi/v2/comments/${ticketId}?type=${type}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Tarefy API comments (${type}): ${res.status} ${res.statusText} - ${text}`
    );
  }
  const data = (await res.json()) as {
    data?: { comments?: TarefyComment[] };
  } | null;
  const comments = data?.data?.comments;
  return Array.isArray(comments) ? comments : [];
}

/** Conversas internas (ocultas para o cliente). */
export function fetchInternalComments(
  ticketId: number,
  token: string
): Promise<TarefyComment[]> {
  return fetchComments(ticketId, "internal", token);
}

/** Conversas públicas (visíveis para o cliente). */
export function fetchPublicComments(
  ticketId: number,
  token: string
): Promise<TarefyComment[]> {
  return fetchComments(ticketId, "client", token);
}

export type TaskListCategory =
  | "todo"
  | "validation"
  | "done"
  | "created"
  | "followed";

/** Endpoint e campo da resposta que contém a lista, por categoria (abas de "Minhas tasks"). */
const TASK_LIST_ENDPOINTS: Record<
  TaskListCategory,
  { path: string; key: "task" | "tasks" }
> = {
  todo: { path: "/nodeapi/task/open/user", key: "task" },
  validation: { path: "/nodeapi/task/validation/user", key: "task" },
  done: { path: "/nodeapi/task/finish/user", key: "task" },
  created: { path: "/nodeapi/task/created/user", key: "task" },
  followed: { path: "/nodeapi/user/followedTasks", key: "tasks" },
};

/**
 * Lista de tasks do usuário por categoria.
 * GET .../nodeapi/task/{open|validation|finish|created}/user?userId={{userId}}
 * GET .../nodeapi/user/followedTasks?userId={{userId}}
 */
export async function fetchTaskList(
  category: TaskListCategory,
  userId: string,
  token: string
): Promise<TarefyTask[]> {
  const { path, key } = TASK_LIST_ENDPOINTS[category];
  const url = `${BASE}${path}?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Tarefy API task list: ${res.status} ${res.statusText} - ${text}`
    );
  }
  const data = (await res.json()) as Record<string, unknown> | null;
  const list = data && typeof data === "object" ? data[key] : undefined;
  return Array.isArray(list) ? (list as TarefyTask[]) : [];
}

export interface TarefyCreatedComment {
  id?: number;
  [key: string]: unknown;
}

/**
 * Cria uma conversa na task.
 * POST .../nodeapi/v2/comments  body: { taskId: {{ticketId}}, content: "<p>...</p>", client }
 * `client: true` torna a conversa pública (visível para o cliente).
 */
export async function postComment(
  ticketId: number,
  contentHtml: string,
  client: boolean,
  token: string
): Promise<TarefyCreatedComment> {
  const res = await fetch(`${BASE}/nodeapi/v2/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ taskId: ticketId, content: contentHtml, client }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Tarefy API create comment: ${res.status} ${res.statusText} - ${text}`
    );
  }
  const data = (await res.json()) as {
    status?: boolean;
    message?: string;
    comment?: TarefyCreatedComment;
  } | null;
  if (data?.status !== true) {
    throw new Error(
      `Tarefy API create comment: ${data?.message ?? "a API não confirmou a criação do comentário"}`
    );
  }
  return data.comment ?? {};
}

/** Status numérico da task: 0 = aberta, 1 = finalizada, 2 = em validação. */
export type TarefyTaskStatus = 0 | 1 | 2;

/**
 * Altera o status da task (abrir/recusar validação, finalizar, enviar para validação).
 * PATCH .../nodeapi/task/updatestatus  body: { idTask: {{ticketId}}, status: 0|1|2 }
 * Resposta: { message, task } — sem `task` a alteração não foi feita.
 */
export async function updateTaskStatus(
  ticketId: number,
  status: TarefyTaskStatus,
  token: string
): Promise<string> {
  const res = await fetch(`${BASE}/nodeapi/task/updatestatus`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ idTask: ticketId, status }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Tarefy API update status: ${res.status} ${res.statusText} - ${text}`
    );
  }
  const data = (await res.json()) as {
    message?: string;
    task?: unknown;
  } | null;
  if (!data?.task) {
    throw new Error(
      `Tarefy API update status: ${data?.message ?? "a API não confirmou a alteração de status"}`
    );
  }
  return data.message ?? "";
}

/**
 * Reabre uma task finalizada.
 * PATCH .../nodeapi/task/reopen  body: { id: {{ticketId}} }
 * Resposta: { status: true|false, message }.
 */
export async function reopenTask(
  ticketId: number,
  token: string
): Promise<string> {
  const res = await fetch(`${BASE}/nodeapi/task/reopen`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: ticketId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Tarefy API reopen: ${res.status} ${res.statusText} - ${text}`
    );
  }
  const data = (await res.json()) as {
    status?: boolean;
    message?: string;
  } | null;
  if (data?.status !== true) {
    throw new Error(
      `Tarefy API reopen: ${data?.message ?? "a API não confirmou a reabertura da task"}`
    );
  }
  return data.message ?? "";
}
