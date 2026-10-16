import { moveTask, resolveTaskIds } from "../api/tasks.js";
import { requireToken } from "./common.js";

/**
 * Move a task para uma coluna (etapa) de um projeto.
 * Com `projectId`, também pode mover para o quadro de outro projeto.
 */
export async function runMoveTask(input: {
  taskId: string;
  columnId: number;
  projectId?: number;
}): Promise<string> {
  const token = await requireToken();
  const { publicId } = await resolveTaskIds(input.taskId, token);
  await moveTask(publicId, input.columnId, input.projectId, token);
  return `Task ${publicId} movida para a coluna ${input.columnId}${
    input.projectId ? ` do projeto ${input.projectId}` : ""
  }.`;
}
