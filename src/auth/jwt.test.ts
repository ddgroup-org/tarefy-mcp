import { describe, expect, it } from "bun:test";
import { getUserIdFromToken } from "./jwt.js";

function makeToken(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.assinatura`;
}

describe("getUserIdFromToken", () => {
  it("retorna o campo id do payload", () => {
    expect(getUserIdFromToken(makeToken({ id: "1234", nome: "Fulano" }))).toBe(
      "1234"
    );
  });

  it("aceita id numérico", () => {
    expect(getUserIdFromToken(makeToken({ id: 77 }))).toBe("77");
  });

  it("decodifica payload com caracteres base64url", () => {
    expect(getUserIdFromToken(makeToken({ id: "9", nome: "João ~?>" }))).toBe(
      "9"
    );
  });

  it("lança quando o payload não tem id", () => {
    expect(() => getUserIdFromToken(makeToken({ nome: "x" }))).toThrow(/login/);
  });

  it("lança quando o token não é um JWT", () => {
    expect(() => getUserIdFromToken("nao-e-jwt")).toThrow(/login/);
  });
});
