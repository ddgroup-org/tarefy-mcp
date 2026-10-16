import {
  fetchAttachments,
  fetchInsights,
  fetchRelationships,
  fetchSubtasks,
  fetchTimeEntries,
  resolveTaskIds,
} from "../api/tasks.js";
import { requireToken, toJson } from "./common.js";

export const TASK_DETAIL_SECTIONS = [
  "subtasks",
  "attachments",
  "relationships",
  "timeEntries",
  "insights",
] as const;

export type TaskDetailSection = (typeof TASK_DETAIL_SECTIONS)[number];

const FETCHERS: Record<
  TaskDetailSection,
  (internalId: number, token: string) => Promise<unknown>
> = {
  subtasks: fetchSubtasks,
  attachments: fetchAttachments,
  relationships: fetchRelationships,
  timeEntries: fetchTimeEntries,
  insights: fetchInsights,
};

/**
 * Dados complementares da task que o `get-task` não traz:
 * subtasks, anexos, relacionamentos, horas lançadas e métricas de fluxo (insights).
 */
export async function runGetTaskDetails(input: {
  taskId: string;
  include?: TaskDetailSection[];
}): Promise<string> {
  const token = await requireToken();
  const ids = await resolveTaskIds(input.taskId, token);
  const sections = input.include?.length
    ? [...new Set(input.include)]
    : [...TASK_DETAIL_SECTIONS];

  const values = await Promise.all(
    sections.map((s) => FETCHERS[s](ids.internalId, token))
  );
  const result: Record<string, unknown> = {
    taskId: ids.publicId,
    internalId: ids.internalId,
  };
  sections.forEach((s, i) => {
    result[s] = values[i];
  });
  return toJson(result);
}
