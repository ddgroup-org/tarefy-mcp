import {
  addTaskMember,
  addTaskTag,
  removeTaskMember,
  removeTaskTag,
  resolveTaskIds,
} from "../api/tasks.js";
import { requireToken } from "./common.js";

export interface MembersInput {
  taskId: string;
  add?: number[];
  remove?: number[];
}

type Kind = "responsibles" | "followers" | "tags";

const LABELS: Record<Kind, { add: string; remove: string; item: string }> = {
  responsibles: {
    add: "responsáveis adicionados",
    remove: "responsáveis removidos",
    item: "usuário",
  },
  followers: {
    add: "seguidores adicionados",
    remove: "seguidores removidos",
    item: "usuário",
  },
  tags: { add: "tags adicionadas", remove: "tags removidas", item: "tag" },
};

/**
 * Adiciona/remove itens associados à task (responsáveis, seguidores ou tags).
 * Executa uma chamada por item; para no primeiro erro, informando o que já foi feito.
 */
async function updateAssociations(
  kind: Kind,
  input: MembersInput
): Promise<string> {
  const add = [...new Set(input.add ?? [])];
  const remove = [...new Set(input.remove ?? [])];
  if (add.length === 0 && remove.length === 0) {
    throw new Error("Informe ao menos um ID em 'add' ou 'remove'.");
  }
  const token = await requireToken();
  const { publicId, internalId } = await resolveTaskIds(input.taskId, token);

  const done: string[] = [];
  const run = async (id: number, op: "add" | "remove") => {
    try {
      if (kind === "tags") {
        await (op === "add" ? addTaskTag : removeTaskTag)(
          internalId,
          id,
          token
        );
      } else {
        await (op === "add" ? addTaskMember : removeTaskMember)(
          internalId,
          kind,
          id,
          token
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const progress = done.length ? ` Já feito: ${done.join("; ")}.` : "";
      throw new Error(
        `Falha ao ${op === "add" ? "adicionar" : "remover"} ${LABELS[kind].item} ${id}: ${message}.${progress}`
      );
    }
  };

  for (const id of add) await run(id, "add");
  if (add.length) done.push(`${LABELS[kind].add}: ${add.join(", ")}`);
  for (const id of remove) await run(id, "remove");
  if (remove.length) done.push(`${LABELS[kind].remove}: ${remove.join(", ")}`);

  return `Task ${publicId}: ${done.join("; ")}.`;
}

export function runUpdateResponsibles(input: MembersInput): Promise<string> {
  return updateAssociations("responsibles", input);
}

export function runUpdateFollowers(input: MembersInput): Promise<string> {
  return updateAssociations("followers", input);
}

export function runUpdateTags(input: MembersInput): Promise<string> {
  return updateAssociations("tags", input);
}
