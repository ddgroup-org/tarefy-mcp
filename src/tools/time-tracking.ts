import { logTime, resolveTaskIds, toggleTimer } from "../api/tasks.js";
import { assertDate, durationToSeconds, requireToken } from "./common.js";

/** Inicia ou pausa o cronômetro do usuário logado na task (alterna). */
export async function runToggleTimer(input: {
  taskId: string;
}): Promise<string> {
  const token = await requireToken();
  const { publicId, internalId } = await resolveTaskIds(input.taskId, token);
  const result = await toggleTimer(internalId, token);
  const state =
    result.working === undefined
      ? "Cronômetro alternado"
      : result.working
        ? "Cronômetro iniciado"
        : "Cronômetro pausado";
  return `${state} na task ${publicId}.${result.message ? ` ${result.message}` : ""}`;
}

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Lança horas trabalhadas na task para o usuário logado. */
export async function runLogTime(input: {
  taskId: string;
  duration: string;
  date?: string;
}): Promise<string> {
  const seconds = durationToSeconds(input.duration);
  if (seconds <= 0) {
    throw new Error("A duração deve ser maior que zero.");
  }
  const date = input.date ? assertDate(input.date, "date") : today();
  const token = await requireToken();
  const { publicId } = await resolveTaskIds(input.taskId, token);
  const message = await logTime(publicId, seconds, date, token);
  return `${input.duration.trim()} lançadas na task ${publicId} em ${date}.${message ? ` ${message}` : ""}`;
}
