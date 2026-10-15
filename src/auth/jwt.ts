const INVALID_TOKEN_MESSAGE =
  "Token inválido: não foi possível identificar o usuário. Use a ferramenta 'login' novamente.";

/**
 * Extrai o ID do usuário (campo `id` do payload) do token JWT do Tarefy.
 * Não valida a assinatura: o token só é decodificado para obter o `userId`.
 */
export function getUserIdFromToken(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error(INVALID_TOKEN_MESSAGE);

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }

  const id =
    payload && typeof payload === "object" && "id" in payload
      ? payload.id
      : undefined;
  if (typeof id === "number" || (typeof id === "string" && id.trim())) {
    return String(id).trim();
  }
  throw new Error(INVALID_TOKEN_MESSAGE);
}
