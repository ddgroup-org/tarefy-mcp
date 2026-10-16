import {
  addRelationship,
  resolveTaskIds,
  type RelationshipType,
} from "../api/tasks.js";
import { requireToken } from "./common.js";

const LABELS: Record<RelationshipType, string> = {
  relates_to: "relacionada a",
  blocks: "bloqueia",
  depends_on: "depende de",
  duplicates: "duplica",
};

/** Cria um relacionamento entre duas tasks (ambas pelo ID da URL). */
export async function runAddRelationship(input: {
  taskId: string;
  targetTaskId: string;
  type?: RelationshipType;
}): Promise<string> {
  if (input.taskId.trim() === input.targetTaskId.trim()) {
    throw new Error("Uma task não pode se relacionar com ela mesma.");
  }
  const type = input.type ?? "relates_to";
  const token = await requireToken();
  const [source, target] = await Promise.all([
    resolveTaskIds(input.taskId, token),
    resolveTaskIds(input.targetTaskId, token),
  ]);
  await addRelationship(source.internalId, target.internalId, type, token);
  return `Task ${source.publicId} agora ${LABELS[type]} a task ${target.publicId}.`;
}
