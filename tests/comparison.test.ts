import { describe, expect, test } from "bun:test";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import { handleCompare } from "@/api";
import type { DemoInput } from "@/catalog";
import { type ComparisonUpdate, compareModel } from "@/compare";
import { customerRequest } from "@/examples/customer";
import { pullRequestRequest } from "@/examples/pull-request";
import { createOpenAIClient, runOpenAI } from "@/openai";
import { customerResponse } from "./fixtures";

const environment = {
  OPENAI_API_KEY: "synthetic-comparison-key",
  OPENAI_URL: "https://gateway.example.test/v1",
  OPENAI_MODEL: "configured-test-model",
};
const input: DemoInput = { demo: "customer", interactions: "Please replace my lost card." };
const customerTask = customerRequest("jev-test-model", input.interactions);
const prTask = pullRequestRequest("jev-test-model", "Rename a field", "-name\n+fullName");

function completion(
  content: string | null,
  finishReason: ChatCompletion.Choice["finish_reason"] = "stop",
  refusal: string | null = null,
): ChatCompletion {
  return {
    id: "completion-test",
    object: "chat.completion",
    created: 0,
    model: environment.OPENAI_MODEL,
    usage: {
      prompt_tokens: 256,
      completion_tokens: 10,
      total_tokens: 266,
      prompt_tokens_details: { cached_tokens: 0 },
    },
    choices: [
      {
        index: 0,
        finish_reason: finishReason,
        logprobs: null,
        message: { role: "assistant", content, refusal },
      },
    ],
  };
}

function openAIReturning(body: unknown, status = 200, beforeReply = () => Promise.resolve()) {
  const config = createOpenAIClient(environment);
  if (!config) throw new Error("Synthetic OpenAI configuration must be complete.");
  const calls: { url: string; headers: Headers; body: ChatCompletionCreateParamsNonStreaming }[] =
    [];
  const client = config.client.withOptions({
    logLevel: "off",
    fetch: async (url, init) => {
      calls.push({
        url: String(url),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as ChatCompletionCreateParamsNonStreaming,
      });
      await beforeReply();
      return Response.json(body, { status });
    },
  });
  return { config: { ...config, client }, calls };
}

function jevReturning(status = 200, beforeReply = () => Promise.resolve()) {
  const calls: unknown[] = [];
  const client = new TypeSafeClient({
    apiKey: "synthetic-jev-key",
    retry: { maxRetries: 0 },
    logLevel: "off",
    fetch: async (_url, init) => {
      calls.push(JSON.parse(String(init?.body)));
      await beforeReply();
      return Response.json(
        status === 200 ? customerResponse : { message: "private-provider-detail" },
        { status },
      );
    },
  });
  return { client, calls };
}

function compareRequest(body: unknown, origin?: string) {
  return new Request("http://localhost:3000/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
}

describe("OpenAI comparison request", () => {
  test.each(["OPENAI_API_KEY", "OPENAI_URL", "OPENAI_MODEL"])(
    "requires %s explicitly",
    (missing) => {
      expect(createOpenAIClient({ ...environment, [missing]: undefined })).toBeNull();
    },
  );

  test.each([
    {
      name: "customer",
      task: customerTask,
      answer: { reason: "card_replacement" },
      properties: {
        reason: { type: "string", enum: Object.keys(customerTask.questions.reason.criteria) },
      },
    },
    {
      name: "PR",
      task: prTask,
      answer: { breakingChange: true },
      properties: { breakingChange: { type: "boolean" } },
    },
  ])(
    "sends the same $name task with a strict output schema",
    async ({ task, answer, properties }) => {
      const reply = completion(JSON.stringify(answer));
      const { config, calls } = openAIReturning(reply);
      const result = await runOpenAI(config, task);

      expect(config.client.baseURL).toBe(environment.OPENAI_URL);
      expect(config.client.maxRetries).toBe(0);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe(`${environment.OPENAI_URL}/chat/completions`);
      expect(calls[0]?.headers.get("x-portkey-api-key")).toBe(environment.OPENAI_API_KEY);
      expect(calls[0]?.body).toEqual(result.request);
      expect(result.request.model).toBe(environment.OPENAI_MODEL);
      const message = result.request.messages.find(({ role }) => role === "user");
      expect(JSON.parse(String(message?.content))).toEqual({
        state: task.state,
        questions: task.questions,
      });
      expect(result.request.response_format).toMatchObject({
        type: "json_schema",
        json_schema: {
          strict: true,
          schema: {
            type: "object",
            properties,
            required: Object.keys(properties),
            additionalProperties: false,
          },
        },
      });
      expect(result.answer).toEqual(answer);
      expect(result.response).toMatchObject(reply);
      expect(JSON.stringify(result)).not.toContain(environment.OPENAI_API_KEY);
    },
  );

  test("repeated comparisons bypass gateway caching and use distinct prompt prefixes", async () => {
    const { config, calls } = openAIReturning(completion('{"reason":"card_replacement"}'));
    await runOpenAI(config, customerTask);
    await runOpenAI(config, customerTask);

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.headers.get("x-portkey-cache-force-refresh")).toBe("true");
      expect(call.headers.get("cache-control")).toBe("no-store");
      expect(call.body.prompt_cache_key).toEqual(expect.any(String));
      expect(call.body.messages[0]?.content).toContain(call.body.prompt_cache_key ?? "missing");
      expect(call.body.messages[1]).toEqual(calls[0]?.body.messages[1]);
    }
    expect(calls[0]?.body.prompt_cache_key).not.toBe(calls[1]?.body.prompt_cache_key);
    expect(calls[0]?.body.messages[0]).not.toEqual(calls[1]?.body.messages[0]);
  });

  test.each([undefined, 0, 128])(
    "only accepts uncached provider results (cached tokens: %s)",
    async (cachedTokens) => {
      const reply = completion('{"reason":"card_replacement"}');
      reply.usage = {
        prompt_tokens: 256,
        completion_tokens: 10,
        total_tokens: 266,
        prompt_tokens_details: { cached_tokens: cachedTokens },
      };
      const { config } = openAIReturning(reply);
      const jev = jevReturning();
      const result = await compareModel(jev.client, config, input, "llm");
      expect(result).toMatchObject(
        cachedTokens !== 0
          ? { llm: { ok: false, error: expect.stringContaining("This run was excluded") } }
          : { llm: { ok: true } },
      );
      if (cachedTokens !== 0) {
        expect(result).not.toHaveProperty("llm.elapsedMs");
        expect(result).not.toHaveProperty("llm.result");
      }
    },
  );

  test.each([
    { name: "unknown Choice", task: customerTask, reply: completion('{"reason":"unknown"}') },
    {
      name: "string instead of boolean",
      task: prTask,
      reply: completion('{"breakingChange":"true"}'),
    },
    { name: "invalid JSON", task: customerTask, reply: completion("not JSON") },
    {
      name: "refusal",
      task: customerTask,
      reply: completion('{"reason":"other"}', "stop", "Cannot answer"),
    },
    { name: "truncation", task: prTask, reply: completion('{"breakingChange":true}', "length") },
  ])("rejects $name instead of displaying a decision", async ({ task, reply }) => {
    const { config } = openAIReturning(reply);
    await expect(runOpenAI(config, task)).rejects.toThrow();
  });
});

describe("comparison execution", () => {
  test.each(["jev", "llm"] as const)("calls only the selected %s provider", async (provider) => {
    const jev = jevReturning();
    const llm = openAIReturning(completion('{"reason":"card_replacement"}'));
    const update = await compareModel(jev.client, llm.config, input, provider);

    expect(Object.keys(update)).toEqual([provider]);
    expect(update).toMatchObject({ [provider]: { ok: true } });
    expect(jev.calls).toHaveLength(provider === "jev" ? 1 : 0);
    expect(llm.calls).toHaveLength(provider === "llm" ? 1 : 0);
  });

  test.each(["jev", "llm"] as const)(
    "returns %s immediately while the other response remains held",
    async (fast) => {
      const slow = fast === "jev" ? "llm" : "jev";
      const gates = { jev: Promise.withResolvers<void>(), llm: Promise.withResolvers<void>() };
      const bothStarted = Promise.withResolvers<boolean>();
      let started = 0;
      const beforeReply = (provider: "jev" | "llm") => {
        if (++started === 2) bothStarted.resolve(true);
        return gates[provider].promise;
      };
      const jev = jevReturning(200, () => beforeReply("jev"));
      const llm = openAIReturning(completion('{"reason":"card_replacement"}'), 200, () =>
        beforeReply("llm"),
      );
      const pending = {
        jev: handleCompare(compareRequest({ input, provider: "jev" }), jev.client, llm.config),
        llm: handleCompare(compareRequest({ input, provider: "llm" }), jev.client, llm.config),
      };
      let slowFinished = false;
      const slowResponse = pending[slow].then((response) => {
        slowFinished = true;
        return response;
      });

      try {
        expect(await Promise.race([bothStarted.promise, Bun.sleep(1_000).then(() => false)])).toBe(
          true,
        );
        gates[fast].resolve();
        const response = await Promise.race([pending[fast], Bun.sleep(1_000).then(() => null)]);
        if (!response) throw new Error("The completed provider waited for the held provider.");
        const update: ComparisonUpdate = await response.json();

        expect(response.status).toBe(200);
        expect(Object.keys(update)).toEqual([fast]);
        expect(update).toMatchObject({ [fast]: { ok: true } });
        expect(slowFinished).toBe(false);
        expect(jev.calls).toHaveLength(1);
        expect(llm.calls).toHaveLength(1);
      } finally {
        gates.jev.resolve();
        gates.llm.resolve();
        await Promise.all(Object.values(pending));
      }

      const response = await slowResponse;
      const update: ComparisonUpdate = await response.json();
      expect(response.status).toBe(200);
      expect(Object.keys(update)).toEqual([slow]);
      expect(update).toMatchObject({ [slow]: { ok: true } });
    },
  );

  test.each(["jev", "llm"] as const)("keeps the other result when %s fails", async (failed) => {
    const jev = jevReturning(failed === "jev" ? 500 : 200);
    const llm = openAIReturning(
      failed === "llm"
        ? { error: { message: "private-provider-detail" } }
        : completion('{"reason":"card_replacement"}'),
      failed === "llm" ? 500 : 200,
    );
    const successful = failed === "jev" ? "llm" : "jev";
    const [failedResponse, successfulResponse] = await Promise.all([
      handleCompare(compareRequest({ input, provider: failed }), jev.client, llm.config),
      handleCompare(compareRequest({ input, provider: successful }), jev.client, llm.config),
    ]);
    const failedUpdate: ComparisonUpdate = await failedResponse.json();
    const successfulUpdate: ComparisonUpdate = await successfulResponse.json();

    expect(failedResponse.status).toBe(200);
    expect(successfulResponse.status).toBe(200);
    expect(Object.keys(failedUpdate)).toEqual([failed]);
    expect(Object.keys(successfulUpdate)).toEqual([successful]);
    expect(failedUpdate).toMatchObject({ [failed]: { ok: false, error: expect.any(String) } });
    expect(successfulUpdate).toMatchObject({ [successful]: { ok: true } });
    expect(jev.calls).toHaveLength(1);
    expect(llm.calls).toHaveLength(1);
    expect(JSON.stringify(failedUpdate)).not.toContain("private-provider-detail");
    expect(JSON.stringify(failedUpdate)).not.toContain(environment.OPENAI_API_KEY);
  });
});

describe("comparison endpoint", () => {
  test.each(["jev", "llm"] as const)(
    "requires %s configuration before calling either provider",
    async (missing) => {
      const jev = jevReturning();
      const llm = openAIReturning(completion('{"reason":"other"}'));
      const response = await handleCompare(
        compareRequest({ input, provider: missing === "jev" ? "llm" : "jev" }),
        missing === "jev" ? null : jev.client,
        missing === "llm" ? null : llm.config,
      );

      expect(response.status).toBe(503);
      expect(jev.calls).toHaveLength(0);
      expect(llm.calls).toHaveLength(0);
    },
  );

  test.each([
    { body: null, origin: undefined, status: 400 },
    {
      body: { input: { demo: "customer", interactions: " " }, provider: "jev" },
      origin: undefined,
      status: 400,
    },
    { body: { input }, origin: undefined, status: 400 },
    { body: { input, provider: "unknown" }, origin: undefined, status: 400 },
    { body: { input, provider: "jev" }, origin: "https://other.example", status: 403 },
  ])(
    "rejects invalid comparison requests before using either provider",
    async ({ body, origin, status }) => {
      const jev = jevReturning();
      const llm = openAIReturning(completion('{"reason":"other"}'));
      const response = await handleCompare(compareRequest(body, origin), jev.client, llm.config);
      expect(response.status).toBe(status);
      expect(jev.calls).toHaveLength(0);
      expect(llm.calls).toHaveLength(0);
    },
  );

  test("rejects malformed JSON", async () => {
    const request = new Request("http://localhost:3000/api/compare", {
      method: "POST",
      body: "{broken",
    });
    expect((await handleCompare(request, null, null)).status).toBe(400);
  });
});
