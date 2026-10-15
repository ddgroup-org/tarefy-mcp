import { describe, expect, it, mock } from "bun:test";

function makeToken(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode(payload)}.assinatura`;
}

let currentToken: string | null = makeToken({ id: "321" });

mock.module("../auth/token-store.js", () => ({
  loadToken: () => Promise.resolve(currentToken),
}));

const { runListTasks } = await import("./list-tasks.js");

const tasksPayload = [
  { id_tarefa: 10, titulo: "Primeira" },
  { id_tarefa: 11, titulo: "Segunda" },
];

function mockFetch(onUrl?: (url: string) => void): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    onUrl?.(url);
    const key = url.includes("/user/followedTasks") ? "tasks" : "task";
    return Promise.resolve(
      new Response(JSON.stringify({ status: true, [key]: tasksPayload }), {
        status: 200,
      })
    );
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

describe("runListTasks", () => {
  it("usa a categoria todo por padrão e o userId do token", async () => {
    currentToken = makeToken({ id: "321" });
    const urls: string[] = [];
    const restore = mockFetch((url) => urls.push(url));

    try {
      const parsed = JSON.parse(await runListTasks({}));
      expect(urls).toEqual([
        "https://app.tarefy.com/nodeapi/task/open/user?userId=321",
      ]);
      expect(parsed).toEqual({ category: "todo", tasks: tasksPayload });
    } finally {
      restore();
    }
  });

  it("lista tasks seguidas", async () => {
    currentToken = makeToken({ id: "321" });
    const restore = mockFetch((url) =>
      expect(url).toContain("/nodeapi/user/followedTasks?userId=321")
    );

    try {
      const parsed = JSON.parse(await runListTasks({ category: "followed" }));
      expect(parsed.category).toBe("followed");
      expect(parsed.tasks).toEqual(tasksPayload);
    } finally {
      restore();
    }
  });

  it("inclui instruções do prompt quando informado", async () => {
    currentToken = makeToken({ id: "321" });
    const restore = mockFetch();

    try {
      const result = await runListTasks({
        category: "done",
        prompt: "Liste só os títulos",
      });
      expect(result).toContain("Instruções (prompt):");
      expect(result).toContain("Liste só os títulos");
      expect(result).toContain("Dados (JSON):");
    } finally {
      restore();
    }
  });

  it("lança orientando login quando não há token", async () => {
    currentToken = null;
    await expect(runListTasks({})).rejects.toThrow(/login/);
  });
});
