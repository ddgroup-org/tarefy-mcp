import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { resolveTaskIds, uploadAttachment } from "../api/tasks.js";
import { requireToken, toJson } from "./common.js";

/** Envia um arquivo local como anexo da task. */
export async function runUploadAttachment(input: {
  taskId: string;
  filePath: string;
}): Promise<string> {
  if (!isAbsolute(input.filePath)) {
    throw new Error("Informe o caminho absoluto do arquivo.");
  }
  const info = await stat(input.filePath).catch(() => null);
  if (!info?.isFile()) {
    throw new Error(`Arquivo não encontrado: ${input.filePath}`);
  }
  const token = await requireToken();
  const { publicId, internalId } = await resolveTaskIds(input.taskId, token);
  const attachment = await uploadAttachment(internalId, input.filePath, token);
  return `Anexo enviado para a task ${publicId}.\n${toJson(attachment)}`;
}
