import { searchTasks } from "../api/tasks.js";
import { requireToken, toJson } from "./common.js";

/**
 * Busca tasks por texto (título ou número).
 * Cada item traz `id_tarefa` (o ID da URL, usado pelas demais ferramentas) e `titulo`.
 */
export async function runSearchTasks(input: { term: string }): Promise<string> {
  const term = input.term.trim();
  if (!term) {
    throw new Error("O termo de busca não pode ser vazio.");
  }
  const token = await requireToken();
  const tasks = await searchTasks(term, token);
  return toJson({ term, tasks });
}
