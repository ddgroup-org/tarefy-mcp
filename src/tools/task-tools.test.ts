import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let currentToken: string | null = "fake-token";

mock.module("../auth/token-store.js", () => ({
  loadToken: () => Promise.resolve(currentToken),
}));

const { runSearchTasks } = await import("./search-tasks.js");
const { runGetTaskOptions } = await import("./get-task-options.js");
const { runListProjectTasks } = await import("./list-project-tasks.js");
const { runGetTaskDetails } = await import("./get-task-details.js");
const { runCreateTask, textToDelta } = await import("./create-task.js");
const { runUpdateTask } = await import("./update-task.js");
const { runMoveTask } = await import("./move-task.js");
const { runUpdateResponsibles, runUpdateFollowers, runUpdateTags } =
  await import("./update-members.js");
const { runAddRelationship } = await import("./add-relationship.js");
const { runToggleTimer, runLogTime } = await import("./time-tracking.js");
const { runDuplicateTask } = await import("./duplicate-task.js");
const { runUploadAttachment } = await import("./upload-attachment.js");

const BASE = "https://app.tarefy.com/nodeapi";

interface Captured {
  method: string;
  path: string;
  body?: unknown;
}

type Route = (call: Captured) => unknown;

/** IDs públicos → internos usados nos testes. */
const INTERNAL_IDS: Record<string, number> = { "295": 43983, "300": 44000 };

const originalFetch = globalThis.fetch;

/**
 * Substitui o fetch por um roteador "MÉTODO /caminho" → resposta JSON.
 * A resolução de ID público → interno já vem configurada.
 */
function mockApi(routes: Record<string, Route | unknown> = {}): Captured[] {
  const calls: Captured[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = url.slice(BASE.length);
    const raw = init?.body;
    const call: Captured = {
      method: init?.method ?? "GET",
      path,
      body:
        raw instanceof FormData
          ? raw
          : raw
            ? JSON.parse(String(raw))
            : undefined,
    };
    calls.push(call);

    const internal = /^\/v2\/tasks\/public\/(\d+)\/internal-id$/.exec(path);
    if (internal && INTERNAL_IDS[internal[1]]) {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: INTERNAL_IDS[internal[1]],
            id_tarefa: Number(internal[1]),
          },
        })
      );
    }
    const key = `${call.method} ${path}`;
    if (key in routes) {
      const route = routes[key];
      const body = typeof route === "function" ? (route as Route)(call) : route;
      return new Response(JSON.stringify(body));
    }
    return new Response(JSON.stringify({ message: "não encontrado" }), {
      status: 404,
      statusText: "Not Found",
    });
  }) as typeof fetch;
  return calls;
}

/** Chamadas feitas, exceto a resolução de ID. */
function writes(calls: Captured[]): Captured[] {
  return calls.filter((c) => !c.path.includes("/internal-id"));
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  currentToken = "fake-token";
});

describe("search-tasks", () => {
  it("busca pelo termo codificado na URL", async () => {
    const calls = mockApi({
      "GET /v2/tasks/search?term=Lead%20novo": {
        status: true,
        tasks: [{ id: 1, id_tarefa: 9704, titulo: "Lead novo" }],
      },
    });
    const result = JSON.parse(await runSearchTasks({ term: " Lead novo " }));
    expect(calls).toHaveLength(1);
    expect(result.tasks[0].id_tarefa).toBe(9704);
  });

  it("rejeita termo vazio", async () => {
    await expect(runSearchTasks({ term: "  " })).rejects.toThrow(/vazio/);
  });
});

describe("get-task-options", () => {
  it("resume projetos com colunas ordenadas, tipos, tags ativas, equipes e usuários", async () => {
    mockApi({
      "GET /v2/tasks/creation-options": {
        models: [],
        projects: [
          {
            id: 877,
            name: "Mary Kay",
            clients: { id: 5, nome: "MK" },
            boardlists: [
              { id: 2, name: "Fazendo", position: 2 },
              { id: 1, name: "A fazer", position: 1 },
            ],
          },
        ],
      },
      "GET /v2/task-types?only_active=true": [
        { id: 297, name: "Automação", behavior: "LEAF", estimated_time: null },
      ],
      "GET /v2/task-tags": [
        { id: 10, name: "Ativa", archived: false, client_id: null },
        { id: 11, name: "Velha", archived: true },
      ],
      "GET /v2/teams/task-creation-options": {
        status: true,
        data: {
          teams: [
            {
              id: 1,
              name: "Time A",
              usersList: [{ id: 834, name: "Gabriel" }],
            },
            { id: 2, name: "Arquivado", archive: true, usersList: [] },
          ],
        },
      },
    });
    const result = JSON.parse(await runGetTaskOptions());
    expect(result.projects).toEqual([
      {
        id: 877,
        name: "Mary Kay",
        client: { id: 5, name: "MK" },
        columns: [
          { id: 1, name: "A fazer" },
          { id: 2, name: "Fazendo" },
        ],
      },
    ]);
    expect(result.tags.map((t: { id: number }) => t.id)).toEqual([10]);
    expect(result.teams).toEqual([{ id: 1, name: "Time A", userIds: [834] }]);
    expect(result.users).toEqual([{ id: 834, name: "Gabriel" }]);
    expect(result.urgencies).toContain("Urgente");
  });
});

describe("list-project-tasks", () => {
  const tasks = [
    {
      id_tarefa: 1,
      titulo: "Antiga",
      status: 0,
      updated_at: "2026-01-01",
      list: [{ boardlists: { id: 4650, name: "A fazer" } }],
      task_responsible: [{ users: { id: 851, nome: "Ana" } }],
      task_tags: [{ tags: { id: 567, name: "E-mail" } }],
      descricao: "volumoso",
    },
    { id_tarefa: 2, titulo: "Feita", status: 1, updated_at: "2026-03-01" },
    { id_tarefa: 3, titulo: "Recente", status: 2, updated_at: "2026-02-01" },
  ];

  it("por padrão traz não finalizadas, resumidas e das mais recentes", async () => {
    mockApi({ "GET /v2/tasks/project/877": { data: tasks } });
    const result = JSON.parse(await runListProjectTasks({ projectId: 877 }));
    expect(result.total).toBe(2);
    expect(result.tasks.map((t: { id_tarefa: number }) => t.id_tarefa)).toEqual(
      [3, 1]
    );
    expect(result.tasks[1]).toMatchObject({
      status: "aberta",
      coluna: { id: 4650, nome: "A fazer" },
      responsaveis: ["Ana"],
      tags: ["E-mail"],
    });
    expect(result.tasks[1].descricao).toBeUndefined();
  });

  it("filtra por status e respeita o limite", async () => {
    mockApi({ "GET /v2/tasks/project/877": tasks });
    const done = JSON.parse(
      await runListProjectTasks({ projectId: 877, status: "done" })
    );
    expect(done.tasks.map((t: { id_tarefa: number }) => t.id_tarefa)).toEqual([
      2,
    ]);
    const all = JSON.parse(
      await runListProjectTasks({ projectId: 877, status: "all", limit: 1 })
    );
    expect(all).toMatchObject({ total: 3, returned: 1 });
  });
});

describe("get-task-details", () => {
  it("usa o ID interno e traz só as seções pedidas", async () => {
    const calls = mockApi({
      "GET /v2/tasks/43983/subtasks": { status: true, subTasks: [{ id: 9 }] },
      "GET /task/manualhours?id=43983": { status: true, times: [{ s: 60 }] },
    });
    const result = JSON.parse(
      await runGetTaskDetails({
        taskId: "295",
        include: ["subtasks", "timeEntries"],
      })
    );
    expect(result).toEqual({
      taskId: 295,
      internalId: 43983,
      subtasks: [{ id: 9 }],
      timeEntries: [{ s: 60 }],
    });
    expect(writes(calls)).toHaveLength(2);
  });

  it("informa quando a task não existe", async () => {
    mockApi();
    await expect(runGetTaskDetails({ taskId: "999" })).rejects.toThrow(/404/);
  });
});

describe("create-task", () => {
  it("converte texto em Quill delta", () => {
    expect(textToDelta("a\r\nb")).toEqual({
      format: "quill-delta-v1",
      ops: [{ insert: "a\nb\n" }],
    });
  });

  it("cria na coluna do projeto com os campos mapeados", async () => {
    const calls = mockApi({
      "POST /v2/tasks/column/877/1": {
        task: { id: 50000, id_tarefa: 400 },
      },
    });
    const result = await runCreateTask({
      title: " Nova ",
      projectId: 877,
      columnId: 1,
      responsibleIds: [834, 836],
      dueDate: "2026-10-20",
      urgency: "Alta",
      estimatedTime: "1:30",
      description: "Detalhes",
      tagIds: [10, 11],
    });
    expect(calls[0].body).toEqual({
      title: "Nova",
      project_id: 877,
      column_id: 1,
      task_responsible: [{ user: 834 }, { user: 836 }],
      due_date: "2026-10-20",
      urgency: "Alta",
      estimated_time: "001:30",
      initialDescription: {
        format: "quill-delta-v1",
        ops: [{ insert: "Detalhes\n" }],
      },
      tagsSelect: "10,11",
    });
    expect(result).toContain("https://app.tarefy.com/task/400");
  });

  it("cria subtask em /v2/tasks com o ID interno da task pai", async () => {
    const calls = mockApi({
      "POST /v2/tasks": { id: 50001, id_tarefa: 401 },
    });
    const result = await runCreateTask({ title: "Sub", parentTaskId: "295" });
    const post = writes(calls)[0];
    expect(post.body).toMatchObject({
      parent_task_id: 43983,
      creation_context: "subtask",
      urgency: "Baixa",
      estimated_time: "000:00",
    });
    expect(result).toContain("Subtask criada na task 295");
  });

  it("valida formato de estimativa e de data", async () => {
    mockApi();
    await expect(
      runCreateTask({ title: "x", estimatedTime: "90min" })
    ).rejects.toThrow(/Duração inválida/);
    await expect(
      runCreateTask({ title: "x", dueDate: "20/10/2026" })
    ).rejects.toThrow(/AAAA-MM-DD/);
  });

  it("exige projectId quando há columnId", async () => {
    await expect(runCreateTask({ title: "x", columnId: 1 })).rejects.toThrow(
      /projectId/
    );
  });
});

describe("update-task", () => {
  it("envia só os campos informados para o ID público, com null limpando", async () => {
    const calls = mockApi({ "PATCH /v2/tasks/295": { id: 43983 } });
    const result = await runUpdateTask({
      taskId: "295",
      title: "Novo título",
      dueDate: null,
      urgency: "Urgente",
      budget: "10:00",
      competence: "202610",
    });
    expect(writes(calls)).toEqual([
      {
        method: "PATCH",
        path: "/v2/tasks/295",
        body: {
          title: "Novo título",
          due_date: null,
          urgency: "Urgente",
          budget: "010:00",
          competence: 202610,
        },
      },
    ]);
    expect(result).toContain("title");
  });

  it("altera a visibilidade para o cliente pela rota própria", async () => {
    const calls = mockApi({
      "PATCH /v2/tasks/295/client-visibility": { status: true },
    });
    await runUpdateTask({ taskId: "295", hiddenFromClient: true });
    expect(writes(calls)).toEqual([
      {
        method: "PATCH",
        path: "/v2/tasks/295/client-visibility",
        body: { hidden: true },
      },
    ]);
  });

  it("rejeita chamada sem campos", async () => {
    await expect(runUpdateTask({ taskId: "295" })).rejects.toThrow(
      /Nenhum campo/
    );
  });

  it("rejeita competência fora do formato AAAAMM", async () => {
    await expect(
      runUpdateTask({ taskId: "295", competence: "10/2026" })
    ).rejects.toThrow(/AAAAMM/);
  });
});

describe("move-task", () => {
  it("move pelo ID público para a coluna e projeto de destino", async () => {
    const calls = mockApi({ "PATCH /v2/tasks/295/move": { status: true } });
    await runMoveTask({ taskId: "295", columnId: 7, projectId: 877 });
    expect(writes(calls)[0].body).toEqual({
      target_column_id: 7,
      insert_at: "top",
      target_project_id: 877,
    });
  });
});

describe("update-responsibles / update-followers / update-tags", () => {
  it("adiciona e remove responsáveis pelo ID interno", async () => {
    const calls = mockApi({
      "POST /v2/tasks/43983/responsibles": { status: true },
      "DELETE /v2/tasks/43983/responsibles/836": { status: true },
    });
    const result = await runUpdateResponsibles({
      taskId: "295",
      add: [834, 834],
      remove: [836],
    });
    expect(writes(calls)).toEqual([
      {
        method: "POST",
        path: "/v2/tasks/43983/responsibles",
        body: { user_id: 834 },
      },
      { method: "DELETE", path: "/v2/tasks/43983/responsibles/836" },
    ]);
    expect(result).toContain("responsáveis adicionados: 834");
  });

  it("usa as rotas de seguidores", async () => {
    const calls = mockApi({
      "POST /v2/tasks/43983/followers": { status: true },
    });
    await runUpdateFollowers({ taskId: "295", add: [834] });
    expect(writes(calls)[0].path).toBe("/v2/tasks/43983/followers");
  });

  it("usa as rotas de tags com tag_id", async () => {
    const calls = mockApi({
      "POST /v2/tasks/43983/tags": { status: true },
      "DELETE /v2/tasks/43983/tags/11": { status: true },
    });
    await runUpdateTags({ taskId: "295", add: [10], remove: [11] });
    expect(writes(calls)[0].body).toEqual({ tag_id: 10 });
    expect(writes(calls)[1].method).toBe("DELETE");
  });

  it("para no primeiro erro e informa o que já foi feito", async () => {
    mockApi({
      "POST /v2/tasks/43983/tags": { status: true },
      "DELETE /v2/tasks/43983/tags/11": {
        status: false,
        message: "Sem permissão",
      },
    });
    await expect(
      runUpdateTags({ taskId: "295", add: [10], remove: [11] })
    ).rejects.toThrow(
      /remover tag 11.*Sem permissão.*Já feito: tags adicionadas: 10/
    );
  });

  it("exige ao menos um ID", async () => {
    await expect(runUpdateTags({ taskId: "295" })).rejects.toThrow(/add/);
  });
});

describe("add-relationship", () => {
  it("relaciona pelos IDs internos das duas tasks", async () => {
    const calls = mockApi({
      "POST /v2/tasks/43983/relationships": { status: true },
    });
    const result = await runAddRelationship({
      taskId: "295",
      targetTaskId: "300",
      type: "blocks",
    });
    expect(writes(calls)[0].body).toEqual({
      target_task_id: 44000,
      relationship_type: "blocks",
    });
    expect(result).toContain("bloqueia");
  });

  it("não relaciona a task com ela mesma", async () => {
    await expect(
      runAddRelationship({ taskId: "295", targetTaskId: "295" })
    ).rejects.toThrow(/ela mesma/);
  });
});

describe("toggle-timer / log-time", () => {
  it("alterna o cronômetro e informa o novo estado", async () => {
    mockApi({
      "PATCH /v2/tasks/43983/play-pause": {
        status: true,
        message: "Play",
        task: { working: 1 },
      },
    });
    expect(await runToggleTimer({ taskId: "295" })).toContain(
      "Cronômetro iniciado"
    );
  });

  it("lança horas em segundos pelo ID público", async () => {
    const calls = mockApi({
      "POST /v2/tasks/295/worklogs": { status: true, message: "ok" },
    });
    await runLogTime({ taskId: "295", duration: "1:30", date: "2026-10-15" });
    expect(writes(calls)[0].body).toEqual({
      seconds: 5400,
      date: "2026-10-15",
    });
  });

  it("rejeita duração zero", async () => {
    await expect(
      runLogTime({ taskId: "295", duration: "0:00" })
    ).rejects.toThrow(/maior que zero/);
  });
});

describe("duplicate-task", () => {
  it("duplica pelo ID público", async () => {
    const calls = mockApi({
      "POST /v2/tasks/bulk-duplicate": {
        duplicated: 1,
        createdTasks: [{ id_tarefa: 402 }],
      },
    });
    const result = await runDuplicateTask({ taskId: "295" });
    expect(writes(calls)[0].body).toEqual({ taskIds: [295] });
    expect(result).toContain("402");
  });

  it("falha quando nada foi duplicado", async () => {
    mockApi({
      "POST /v2/tasks/bulk-duplicate": { duplicated: 0, message: "Erro" },
    });
    await expect(runDuplicateTask({ taskId: "295" })).rejects.toThrow(/Erro/);
  });
});

describe("upload-attachment", () => {
  it("envia o arquivo como multipart no campo file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tarefy-mcp-"));
    const file = join(dir, "nota.txt");
    await writeFile(file, "conteúdo");
    const calls = mockApi({
      "POST /v2/tasks/43983/attachments": {
        status: true,
        data: { id: 1, name: "nota.txt" },
      },
    });
    await runUploadAttachment({ taskId: "295", filePath: file });
    const form = writes(calls)[0].body as FormData;
    const sent = form.get("file") as File;
    expect(sent.name).toBe("nota.txt");
    expect(await sent.text()).toBe("conteúdo");
  });

  it("exige caminho absoluto de arquivo existente", async () => {
    await expect(
      runUploadAttachment({ taskId: "295", filePath: "rel.txt" })
    ).rejects.toThrow(/absoluto/);
    await expect(
      runUploadAttachment({ taskId: "295", filePath: "/nao/existe.txt" })
    ).rejects.toThrow(/não encontrado/);
  });
});

describe("login obrigatório", () => {
  it("orienta o login quando não há token", async () => {
    currentToken = null;
    await expect(runSearchTasks({ term: "x" })).rejects.toThrow(/login/);
  });
});
