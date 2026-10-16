import { describe, expect, it, mock } from "bun:test";

let currentToken: string | null = "fake-token";

mock.module("../auth/token-store.js", () => ({
  loadToken: () => Promise.resolve(currentToken),
}));

const { runUpdateStatus } = await import("./update-status.js");

interface Captured {
  url: string;
  method: string;
  body?: unknown;
}

function mockFetch(
  calls: Captured[],
  currentStatus: number,
  updateResponse: unknown = { message: "Tarefa atualizada", task: { id: 1 } }
): () => void {
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
        new Response(JSON.stringify({ id: 43983, status: currentStatus }), {
          status: 200,
        })
      );
    }
    if (url.endsWith("/nodeapi/task/updatestatus")) {
      return Promise.resolve(
        new Response(JSON.stringify(updateResponse), { status: 200 })
      );
    }
    if (url.endsWith("/nodeapi/task/reopen")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ status: true, message: "Tarefa reaberta" }),
          { status: 200 }
        )
      );
    }
    return Promise.resolve(new Response("{}", { status: 404 }));
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

describe("runUpdateStatus", () => {
  it("finaliza a task enviando status 1 com o ticketId", async () => {
    currentToken = "fake-token";
    const calls: Captured[] = [];
    const restore = mockFetch(calls, 0);

    try {
      const result = await runUpdateStatus({ taskId: "295", status: "done" });
      expect(calls[0]).toMatchObject({
        url: "https://app.tarefy.com/nodeapi/v2/tasks/295",
        method: "GET",
      });
      expect(calls[1]).toEqual({
        url: "https://app.tarefy.com/nodeapi/task/updatestatus",
        method: "PATCH",
        body: { idTask: 43983, status: 1 },
      });
      expect(result).toContain("finalizada");
    } finally {
      restore();
    }
  });

  it("envia para validação com status 2", async () => {
    currentToken = "fake-token";
    const calls: Captured[] = [];
    const restore = mockFetch(calls, 0);

    try {
      const result = await runUpdateStatus({
        taskId: "295",
        status: "validation",
      });
      expect(calls[1].body).toEqual({ idTask: 43983, status: 2 });
      expect(result).toContain("em validação");
    } finally {
      restore();
    }
  });

  it("recusa a validação (volta para aberta) com status 0", async () => {
    currentToken = "fake-token";
    const calls: Captured[] = [];
    const restore = mockFetch(calls, 2);

    try {
      await runUpdateStatus({ taskId: "295", status: "open" });
      expect(calls[1]).toMatchObject({
        url: "https://app.tarefy.com/nodeapi/task/updatestatus",
        body: { idTask: 43983, status: 0 },
      });
    } finally {
      restore();
    }
  });

  it("reabre uma task finalizada pela rota de reabertura", async () => {
    currentToken = "fake-token";
    const calls: Captured[] = [];
    const restore = mockFetch(calls, 1);

    try {
      const result = await runUpdateStatus({ taskId: "295", status: "open" });
      expect(calls[1]).toEqual({
        url: "https://app.tarefy.com/nodeapi/task/reopen",
        method: "PATCH",
        body: { id: 43983 },
      });
      expect(result).toContain("aberta");
    } finally {
      restore();
    }
  });

  it("não chama a API de alteração quando a task já está no status pedido", async () => {
    currentToken = "fake-token";
    const calls: Captured[] = [];
    const restore = mockFetch(calls, 1);

    try {
      const result = await runUpdateStatus({ taskId: "295", status: "done" });
      expect(calls).toHaveLength(1);
      expect(result).toContain("já está finalizada");
    } finally {
      restore();
    }
  });

  it("lança erro com a mensagem da API quando a alteração não é confirmada", async () => {
    currentToken = "fake-token";
    const calls: Captured[] = [];
    const restore = mockFetch(calls, 0, { message: "Sem permissão" });

    try {
      await expect(
        runUpdateStatus({ taskId: "295", status: "done" })
      ).rejects.toThrow(/Sem permissão/);
    } finally {
      restore();
    }
  });

  it("lança orientando login quando não há token", async () => {
    currentToken = null;
    await expect(
      runUpdateStatus({ taskId: "1", status: "done" })
    ).rejects.toThrow(/login/);
  });
});
