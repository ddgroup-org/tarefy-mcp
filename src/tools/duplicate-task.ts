import { duplicateTask, resolveTaskIds } from "../api/tasks.js";
import { requireToken, toJson } from "./common.js";

/** Duplica a task e devolve os dados da cópia criada. */
export async function runDuplicateTask(input: {
  taskId: string;
}): Promise<string> {
  const token = await requireToken();
  const { publicId } = await resolveTaskIds(input.taskId, token);
  const { createdTasks } = await duplicateTask(publicId, token);
  return `Task ${publicId} duplicada.\n${toJson(createdTasks)}`;
}
