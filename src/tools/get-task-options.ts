import {
  fetchCreationOptions,
  fetchTaskTags,
  fetchTaskTypes,
  fetchTeams,
} from "../api/tasks.js";
import { requireToken, toJson } from "./common.js";

interface RawProject {
  id?: number;
  name?: string;
  clients?: { id?: number; nome?: string } | null;
  boardlists?: { id?: number; name?: string; position?: number }[];
}

interface RawTeam {
  id?: number;
  name?: string;
  archive?: unknown;
  usersList?: unknown[];
}

interface RawType {
  id?: number;
  name?: string;
  behavior?: string;
  estimated_time?: string | null;
}

interface RawTag {
  id?: number;
  name?: string;
  archived?: boolean;
  client_id?: number | null;
  project_ids?: number[];
}

interface RawUser {
  id?: number;
  name?: string;
  nome?: string;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Reúne os IDs necessários para criar/editar tasks: projetos com suas colunas (etapas),
 * tipos de task, tags, equipes e usuários (para responsáveis/seguidores).
 */
export async function runGetTaskOptions(): Promise<string> {
  const token = await requireToken();
  const [creation, types, tags, teams] = await Promise.all([
    fetchCreationOptions(token),
    fetchTaskTypes(token),
    fetchTaskTags(token),
    fetchTeams(token),
  ]);

  const projects = asArray<RawProject>(
    (creation as { projects?: unknown } | null)?.projects
  ).map((p) => ({
    id: p.id,
    name: p.name,
    client: p.clients ? { id: p.clients.id, name: p.clients.nome } : null,
    columns: asArray<{ id?: number; name?: string; position?: number }>(
      p.boardlists
    )
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((c) => ({ id: c.id, name: c.name })),
  }));

  const teamList = asArray<RawTeam>(
    (teams as { data?: { teams?: unknown } } | null)?.data?.teams
  ).filter((t) => !t.archive);

  const users = new Map<number, string>();
  for (const team of teamList) {
    for (const user of asArray<RawUser>(team.usersList)) {
      if (typeof user.id === "number") {
        users.set(user.id, user.name ?? user.nome ?? "");
      }
    }
  }

  return toJson({
    projects,
    taskTypes: asArray<RawType>(types).map((t) => ({
      id: t.id,
      name: t.name,
      behavior: t.behavior,
      estimatedTime: t.estimated_time,
    })),
    tags: asArray<RawTag>(tags)
      .filter((t) => !t.archived)
      .map((t) => ({
        id: t.id,
        name: t.name,
        clientId: t.client_id ?? null,
        projectIds: t.project_ids ?? [],
      })),
    teams: teamList.map((t) => ({
      id: t.id,
      name: t.name,
      userIds: asArray<RawUser>(t.usersList).map((u) => u.id),
    })),
    users: [...users].map(([id, name]) => ({ id, name })),
    urgencies: ["Baixa", "Média", "Alta", "Urgente"],
  });
}
