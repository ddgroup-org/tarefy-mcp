import { loadToken } from "../auth/token-store.js";

/** Lê o token salvo pelo `login` ou lança orientando o login. */
export async function requireToken(): Promise<string> {
  const token = await loadToken();
  if (!token) {
    throw new Error(
      "Token não encontrado. Use a ferramenta 'login' primeiro para autenticar."
    );
  }
  return token;
}

/**
 * Converte duração para o formato "HHH:MM" usado pelo Tarefy (ex.: "1:30" → "001:30").
 * Aceita "H:MM" ou "HH:MM".
 */
export function toTarefyDuration(value: string): string {
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `Duração inválida: "${value}". Use o formato horas:minutos, ex.: "1:30".`
    );
  }
  return `${match[1].padStart(3, "0")}:${match[2]}`;
}

/** Converte "H:MM" em segundos. */
export function durationToSeconds(value: string): number {
  const [hours, minutes] = toTarefyDuration(value).split(":").map(Number);
  return hours * 3600 + minutes * 60;
}

/** Valida data no formato YYYY-MM-DD. */
export function assertDate(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} inválida: "${value}". Use o formato AAAA-MM-DD.`);
  }
  return value;
}

/** Serializa o resultado como JSON legível. */
export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
