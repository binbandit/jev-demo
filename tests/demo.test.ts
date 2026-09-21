import { describe, expect, expectTypeOf, test } from "bun:test";
import { type SystemOneRequestPayload, TypeSafeClient } from "@typesafe-ai/sdk";
import { handleRun } from "@/api";
import { type DemoInput, runSchema } from "@/catalog";
import type { CustomerResponse } from "@/examples/customer";
import { pullRequestLabels } from "@/examples/pull-request";
import { runDemo } from "@/run";
import { customerResponse, pullRequestResponse } from "./fixtures";

const customerInput: DemoInput = {
  demo: "customer",
  interactions: "My card is damaged. Please send a replacement.",
};

function sdkReturning(body: unknown, status = 200) {
  const requests: SystemOneRequestPayload[] = [];
  const client = new TypeSafeClient({
    apiKey: "test-key",
    retry: { maxRetries: 0 },
    logLevel: "off",
    fetch: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)) as SystemOneRequestPayload);
      return Response.json(body, { status });
    },
  });
  return { client, requests };
}

function request(body: unknown, origin?: string) {
  return new Request("http://localhost:3000/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
}

describe("model requests", () => {
  test("customer classification sends one Choice and exposes the exact request", async () => {
    const { client, requests } = sdkReturning(customerResponse);
    const input: DemoInput = {
      demo: "customer",
      interactions: "My card is damaged. Please send a replacement.",
    };

    const result = await runDemo(client, input);

    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual(result.request);
    expect(Object.keys(result.request.questions)).toEqual(["reason"]);
    expect(requests[0]).toMatchObject({
      model: client.defaultModel,
      state: { interactions: input.interactions },
      questions: { reason: { type: "choice" } },
    });
    expect(result).toMatchObject({ demo: "customer", response: customerResponse });
    expectTypeOf<CustomerResponse["answers"]["reason"]["choice"]>().toEqualTypeOf<
      "card_replacement" | "payment_query" | "online_banking" | "other"
    >();
    expect(
      result.demo === "customer" ? result.request.questions.reason.criteria : {},
    ).toHaveProperty(customerResponse.answers.reason.choice);
  });

  test("PR classification sends one Noul and exposes the exact request", async () => {
    const { client, requests } = sdkReturning(pullRequestResponse);
    const input: DemoInput = {
      demo: "pull-request",
      title: "Change the public API",
      diff: "-export function transfer()\n+export function createTransfer()",
    };

    const result = await runDemo(client, input);

    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual(result.request);
    expect(Object.keys(result.request.questions)).toEqual(["breakingChange"]);
    expect(requests[0]).toMatchObject({
      model: client.defaultModel,
      state: { title: input.title, diff: input.diff },
      questions: { breakingChange: { type: "noul" } },
    });
    expect(result).toMatchObject({ demo: "pull-request", response: pullRequestResponse });
  });
});

describe("label policy", () => {
  test("the PR label uses an inclusive, adjustable probability threshold", () => {
    const answers = {
      breakingChange: { type: "noul", noul: 0.8 } as const,
    };

    expect(pullRequestLabels(answers)).toEqual(["breaking-change"]);
    expect(pullRequestLabels(answers, 0.79)).toEqual(["breaking-change"]);
    expect(pullRequestLabels(answers, 0.81)).toEqual([]);
  });
});

describe("run endpoint", () => {
  test("running an example requires an API key", async () => {
    const response = await handleRun(request({ input: customerInput }), null);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Add TYPESAFE_API_KEY to .env and restart the server.",
    });
  });

  test("live success includes the actual request, typed answers, and elapsed time", async () => {
    const { client, requests } = sdkReturning(customerResponse);
    const response = await handleRun(request({ input: customerInput }), client);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      elapsedMs: expect.any(Number),
      request: requests[0],
      response: customerResponse,
    });
    expect(requests).toHaveLength(1);
  });

  test.each([
    null,
    { input: { demo: "customer", interactions: "   " } },
    { input: { demo: "pull-request", title: "Missing diff" } },
    { input: { demo: "customer", interactions: "x".repeat(20_001) } },
    { mode: "recorded", input: customerInput },
  ])("rejects invalid input before making a model request", async (body) => {
    const { client, requests } = sdkReturning(customerResponse);
    expect(runSchema.safeParse(body).success).toBe(false);
    expect((await handleRun(request(body), client)).status).toBe(400);
    expect(requests).toHaveLength(0);
  });

  test("malformed JSON gets a useful client error", async () => {
    const malformed = new Request("http://localhost:3000/api/run", {
      method: "POST",
      body: "{broken",
    });
    expect((await handleRun(malformed, null)).status).toBe(400);
  });

  test("only same-origin browser requests can use the endpoint", async () => {
    const body = { input: customerInput };
    const { client, requests } = sdkReturning(customerResponse);
    expect((await handleRun(request(body, "https://other.example"), client)).status).toBe(403);
    expect(requests).toHaveLength(0);
    expect((await handleRun(request(body, "http://localhost:3000"), client)).status).toBe(200);
    expect(requests).toHaveLength(1);
  });

  test("upstream failures return a sanitized error", async () => {
    const { client, requests } = sdkReturning({ message: "private-upstream-detail" }, 500);
    const response = await handleRun(request({ input: customerInput }), client);
    const body = await response.text();
    expect(response.status).toBe(502);
    expect(requests).toHaveLength(1);
    expect(body).not.toContain("private-upstream-detail");
    expect(JSON.parse(body)).toEqual({ error: "The live Jev request failed. Try again." });
  });
});
