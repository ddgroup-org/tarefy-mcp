import { describe, expect, it } from "bun:test";
import {
  fetchTask,
  fetchInternalComments,
  fetchPublicComments,
  fetchTaskList,
  postComment,
  type TaskListCategory,
} from "./tarefy.js";

const TOKEN = "test-token";

describe("tarefy API", () => {
  it("fetchTask monta URL e headers corretos", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (url: string, init?: RequestInit) => {
      expect(url).toBe("https://app.tarefy.com/nodeapi/v2/tasks/123");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      });
      return Promise.resolve(
        new Response(JSON.stringify({ id: 456, title: "Task" }), {
          status: 200,
        })
      );
    };

    const result = await fetchTask("123", TOKEN);
    expect(result).toEqual({ id: 456, title: "Task" });
    globalThis.fetch = originalFetch;
  });

  it("fetchTask lança em status não-ok", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response("Unauthorized", { status: 401 }));

    await expect(fetchTask("1", TOKEN)).rejects.toThrow(/401/);
    globalThis.fetch = originalFetch;
  });

  it("fetchInternalComments usa /v2/comments/{ticketId}?type=internal", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (url: string) => {
      expect(url).toBe(
        "https://app.tarefy.com/nodeapi/v2/comments/999?type=internal"
      );
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: true,
            data: { comments: [{ id: 1, content: "comentário" }], total: 1 },
          }),
          { status: 200 }
        )
      );
    };

    try {
      const result = await fetchInternalComments(999, TOKEN);
      expect(result).toEqual([{ id: 1, content: "comentário" }]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fetchPublicComments usa /v2/comments/{ticketId}?type=client", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (url: string) => {
      expect(url).toBe(
        "https://app.tarefy.com/nodeapi/v2/comments/888?type=client"
      );
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: true,
            data: { comments: [{ id: 2 }], total: 1 },
          }),
          { status: 200 }
        )
      );
    };

    try {
      const result = await fetchPublicComments(888, TOKEN);
      expect(result).toEqual([{ id: 2 }]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fetchInternalComments retorna [] quando a resposta não tem lista", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ status: true }), { status: 200 })
      );

    try {
      expect(await fetchInternalComments(1, TOKEN)).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fetchPublicComments lança em status não-ok", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response("Route not found", { status: 404 }));

    try {
      await expect(fetchPublicComments(1, TOKEN)).rejects.toThrow(/404/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  const listCases: [TaskListCategory, string, string][] = [
    ["todo", "/nodeapi/task/open/user", "task"],
    ["validation", "/nodeapi/task/validation/user", "task"],
    ["done", "/nodeapi/task/finish/user", "task"],
    ["created", "/nodeapi/task/created/user", "task"],
    ["followed", "/nodeapi/user/followedTasks", "tasks"],
  ];

  for (const [category, path, key] of listCases) {
    it(`fetchTaskList(${category}) usa ${path} e lê o campo ${key}`, async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (url: string, init?: RequestInit) => {
        expect(url).toBe(`https://app.tarefy.com${path}?userId=55`);
        expect(init?.headers).toMatchObject({
          Authorization: "Bearer test-token",
        });
        return Promise.resolve(
          new Response(JSON.stringify({ status: true, [key]: [{ id: 1 }] }), {
            status: 200,
          })
        );
      };

      try {
        expect(await fetchTaskList(category, "55", TOKEN)).toEqual([{ id: 1 }]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  }

  it("fetchTaskList retorna [] quando a resposta não tem lista", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ status: true }), { status: 200 })
      );

    try {
      expect(await fetchTaskList("todo", "1", TOKEN)).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fetchTaskList lança em status não-ok", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response("Unauthorized", { status: 401 }));

    try {
      await expect(fetchTaskList("todo", "1", TOKEN)).rejects.toThrow(/401/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("postComment envia POST /v2/comments com ticketId, content e client", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (url: string, init?: RequestInit) => {
      expect(url).toBe("https://app.tarefy.com/nodeapi/v2/comments");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        taskId: 240904,
        content: "<p>Olá</p>",
        client: false,
      });
      return Promise.resolve(
        new Response(JSON.stringify({ status: true, comment: { id: 555 } }), {
          status: 200,
        })
      );
    };

    try {
      expect(await postComment(240904, "<p>Olá</p>", false, TOKEN)).toEqual({
        id: 555,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("postComment lança quando a API responde status false", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ status: false, message: "Sem permissão" }),
          { status: 200 }
        )
      );

    try {
      await expect(postComment(1, "<p>x</p>", false, TOKEN)).rejects.toThrow(
        /Sem permissão/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("postComment lança em status não-ok", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response("Forbidden", { status: 403 }));

    try {
      await expect(postComment(1, "<p>x</p>", true, TOKEN)).rejects.toThrow(
        /403/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
