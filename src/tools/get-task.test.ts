import { describe, expect, it, mock } from "bun:test";

mock.module("../auth/token-store.js", () => ({
  loadToken: () => Promise.resolve("fake-token"),
}));

const { runGetTask } = await import("./get-task.js");

const taskPayload = {
  id: 100,
  title: "Task teste",
  status: "open",
};
const commentsPayload = [{ id: 1, content: "Comentário interno" }];
const publicCommentsPayload = [{ id: 2, content: "Comentário público" }];

function commentsResponse(comments: unknown[]): Response {
  return new Response(
    JSON.stringify({
      status: true,
      data: { comments, total: comments.length },
    }),
    { status: 200 }
  );
}

describe("runGetTask", () => {
  it("retorna JSON com task, comments e publicComments quando sem prompt", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/nodeapi/v2/tasks/")) {
        return Promise.resolve(
          new Response(JSON.stringify(taskPayload), { status: 200 })
        );
      }
      if (url.endsWith("/nodeapi/v2/comments/100?type=internal")) {
        return Promise.resolve(commentsResponse(commentsPayload));
      }
      if (url.endsWith("/nodeapi/v2/comments/100?type=client")) {
        return Promise.resolve(commentsResponse(publicCommentsPayload));
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    };

    try {
      const result = await runGetTask({ taskId: "42" });
      const parsed = JSON.parse(result);
      expect(parsed.task).toEqual(taskPayload);
      expect(parsed.comments).toEqual(commentsPayload);
      expect(parsed.publicComments).toEqual(publicCommentsPayload);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("inclui instruções do prompt quando informado", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/nodeapi/v2/tasks/")) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 100, title: "T" }), { status: 200 })
        );
      }
      if (url.includes("/nodeapi/v2/comments/")) {
        return Promise.resolve(commentsResponse([]));
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    };

    try {
      const result = await runGetTask({
        taskId: "42",
        prompt: "Resuma em uma frase",
      });
      expect(result).toContain("Instruções (prompt):");
      expect(result).toContain("Resuma em uma frase");
      expect(result).toContain("Dados (JSON):");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
