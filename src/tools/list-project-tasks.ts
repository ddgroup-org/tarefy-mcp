import { fetchProjectTasks } from "../api/tasks.js";
import { requireToken, toJson } from "./common.js";

export type ProjectTaskStatus = "open" | "validation" | "done" | "all";

const STATUS_CODES: Record<Exclude<ProjectTaskStatus, "all">, number> = {
  open: 0,
  done: 1,
  validation: 2,
};

const STATUS_LABELS: Record<number, string> = {
  0: "aberta",
  1: "finalizada",
  2: "em validação",
};

interface RawProjectTask {
  id_tarefa?: number;
  tarefa_pai?: number | null;
  titulo?: string;
  status?: number;
  urgencia?: string | null;
  data_desejada?: string | null;
  estimativa?: string | null;
  work_seconds?: number | null;
  updated_at?: string | null;
  list?: { boardlists?: { id?: number; name?: string } }[];
  task_responsible?: { users?: { id?: number; nome?: string } }[];
  task_tags?: { tags?: { id?: number; name?: string } }[];
  clients?: { nome?: string } | null;
  types_task?: { tipo?: string } | null;
}

/** Resumo de uma task do quadro, sem os campos internos/volumosos. */
function summarize(t: RawProjectTask) {
  const column = t.list?.[0]?.boardlists;
  return {
    id_tarefa: t.id_tarefa,
    titulo: t.titulo,
    status: STATUS_LABELS[t.status ?? -1] ?? t.status,
    coluna: column ? { id: column.id, nome: column.name } : null,
    tarefa_pai: t.tarefa_pai ?? null,
    responsaveis: (t.task_responsible ?? []).map((r) => r.users?.nome),
    tags: (t.task_tags ?? []).map((tag) => tag.tags?.name),
    cliente: t.clients?.nome ?? null,
    tipo: t.types_task?.tipo ?? null,
    urgencia: t.urgencia ?? null,
    data_desejada: t.data_desejada ?? null,
    estimativa: t.estimativa ?? null,
    segundos_trabalhados: t.work_seconds ?? 0,
    atualizada_em: t.updated_at ?? null,
  };
}

/**
 * Lista as tasks de um projeto (quadro), resumidas e das mais recentes para as mais antigas.
 * Por padrão só as não finalizadas (`open` + `validation`), até `limit` itens.
 */
export async function runListProjectTasks(input: {
  projectId: number;
  status?: ProjectTaskStatus;
  limit?: number;
}): Promise<string> {
  const token = await requireToken();
  const data = await fetchProjectTasks(input.projectId, token);
  const raw = (
    Array.isArray(data)
      ? data
      : ((data as { data?: unknown; tasks?: unknown } | null)?.data ??
        (data as { tasks?: unknown } | null)?.tasks)
  ) as RawProjectTask[] | undefined;
  const all = Array.isArray(raw) ? raw : [];

  const status = input.status;
  const filtered = all.filter((t) =>
    status === "all"
      ? true
      : status
        ? t.status === STATUS_CODES[status]
        : t.status !== STATUS_CODES.done
  );
  filtered.sort((a, b) =>
    String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""))
  );

  const limit = input.limit ?? 100;
  return toJson({
    projectId: input.projectId,
    total: filtered.length,
    returned: Math.min(limit, filtered.length),
    tasks: filtered.slice(0, limit).map(summarize),
  });
}
