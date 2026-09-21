import type { TypeSafeClient } from "@typesafe-ai/sdk";
import type { DemoInput } from "@/catalog";
import { customerRequest } from "@/examples/customer";
import { pullRequestRequest } from "@/examples/pull-request";
import { CachedComparisonError, type OpenAIConfig, type OpenAIResult, runOpenAI } from "@/openai";
import { type DemoResult, runDemo } from "@/run";

export type Attempt<T> = { ok: true; result: T; elapsedMs: number } | { ok: false; error: string };
export type ComparisonResult = { jev: Attempt<DemoResult>; llm: Attempt<OpenAIResult> };
export type ComparisonProvider = keyof ComparisonResult;
export type ComparisonUpdate = { jev: ComparisonResult["jev"] } | { llm: ComparisonResult["llm"] };

async function measure<T>(run: () => Promise<T>, error: string): Promise<Attempt<T>> {
  const started = performance.now();
  try {
    return { ok: true, result: await run(), elapsedMs: Math.round(performance.now() - started) };
  } catch (cause) {
    return { ok: false, error: cause instanceof CachedComparisonError ? cause.message : error };
  }
}

export async function compareModel(
  client: TypeSafeClient,
  openai: OpenAIConfig,
  input: DemoInput,
  provider: ComparisonProvider,
): Promise<ComparisonUpdate> {
  if (provider === "jev") {
    return {
      jev: await measure(
        () => runDemo(client, input),
        "The Jev request failed. Check TYPESAFE_API_KEY or try again.",
      ),
    };
  }

  const task =
    input.demo === "customer"
      ? customerRequest(client.defaultModel, input.interactions)
      : pullRequestRequest(client.defaultModel, input.title, input.diff);

  return {
    llm: await measure(
      () => runOpenAI(openai, task),
      "OpenAI did not return a valid decision. Check OPENAI_URL, OPENAI_MODEL, and OPENAI_API_KEY; the model must support structured outputs.",
    ),
  };
}
