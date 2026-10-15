import { describe, expect, it, mock } from "bun:test";

let currentToken: string | null = "fake-token";

mock.module("../auth/token-store.js", () => ({
  loadToken: () => Promise.resolve(currentToken),
}));

const { runAddComment, textToHtml } = await import("./add-comment.js");

interface Captured {
  url: string;
  method: string;
  body?: unknown;
}

function mockFetch(calls: Captured[]): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (url.includes("/nodeapi/v2/tasks/")) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: 240904, titulo: "T" }), {
          status: 200,
        })
      );
    }
    if (url.endsWith("/nodeapi/v2/comments")) {
      return Promise.resolve(
        new Response(JSON.stringify({ status: true, comment: { id: 777 } }), {
          status: 200,
        })
      );
    }
    return Promise.resolve(new Response("{}", { status: 404 }));
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

describe("textToHtml", () => {
  it("escapa HTML e cria um parágrafo por linha", () => {
    expect(textToHtml("a < b & c\nlinha 2")).toBe(
      "<p>a &lt; b &amp; c</p><p>linha 2</p>"
    );
  });

  it("converte linhas vazias em <p><br></p>", () => {
    expect(textToHtml("um\r\n\r\ndois")).toBe(
      "<p>um</p><p><br></p><p>dois</p>"
    );
  });
});

describe("runAddComment", () => {
  it("busca a task pelo taskId da URL e comenta como interno por padrão", async () => {
    currentToken = "fake-token";
    const calls: Captured[] = [];
    const restore = mockFetch(calls);

    try {
      const result = await runAddComment({ taskId: "8526", content: "Oi <b>" });
      expect(calls[0]).toMatchObject({
        url: "https://app.tarefy.com/nodeapi/v2/tasks/8526",
        method: "GET",
      });
      expect(calls[1]).toEqual({
        url: "https://app.tarefy.com/nodeapi/v2/comments",
        method: "POST",
        body: { taskId: 240904, content: "<p>Oi &lt;b&gt;</p>", client: false },
      });
      expect(result).toContain("777");
      expect(result).toContain("interna");
    } finally {
      restore();
    }
  });

  it("envia client: true quando pedido", async () => {
    currentToken = "fake-token";
    const calls: Captured[] = [];
    const restore = mockFetch(calls);

    try {
      const result = await runAddComment({
        taskId: "8526",
        content: "Prazo confirmado",
        client: true,
      });
      expect(calls[1].body).toMatchObject({ client: true });
      expect(result).toContain("pública");
    } finally {
      restore();
    }
  });

  it("rejeita comentário vazio sem chamar a API", async () => {
    currentToken = "fake-token";
    const calls: Captured[] = [];
    const restore = mockFetch(calls);

    try {
      await expect(
        runAddComment({ taskId: "1", content: "   " })
      ).rejects.toThrow(/vazio/);
      expect(calls).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it("lança orientando login quando não há token", async () => {
    currentToken = null;
    await expect(runAddComment({ taskId: "1", content: "x" })).rejects.toThrow(
      /login/
    );
  });
});
