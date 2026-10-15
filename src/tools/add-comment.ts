import { loadToken } from "../auth/token-store.js";
import { fetchTask, postComment } from "../api/tarefy.js";

export interface AddCommentInput {
  taskId: string;
  content: string;
  client?: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Converte texto puro no HTML usado pelo editor do Tarefy:
 * um `<p>` por linha, com linhas vazias como `<p><br></p>`.
 */
export function textToHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<p><br></p>"))
    .join("");
}

/**
 * Adiciona uma conversa à task: interna (padrão) ou pública (`client: true`, visível para o cliente).
 * O `taskId` é o da URL; o ticketId exigido pela API vem dos dados gerais da task.
 */
export async function runAddComment(input: AddCommentInput): Promise<string> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("O comentário não pode ser vazio.");
  }

  const token = await loadToken();
  if (!token) {
    throw new Error(
      "Token não encontrado. Use a ferramenta 'login' primeiro para autenticar."
    );
  }

  const task = await fetchTask(input.taskId, token);
  const ticketId = task.id;
  if (ticketId == null || typeof ticketId !== "number") {
    throw new Error(
      "Resposta da API da task não contém o campo 'id' (ticketId)."
    );
  }

  const client = input.client ?? false;
  const comment = await postComment(
    ticketId,
    textToHtml(content),
    client,
    token
  );

  const kind = client ? "pública (visível para o cliente)" : "interna";
  return `Conversa ${kind} adicionada à task ${input.taskId} (comentário ${comment.id ?? "sem id retornado"}).`;
}
