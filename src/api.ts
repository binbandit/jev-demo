import { APIError, type TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import { inputSchema, runSchema } from "@/catalog";
import { compareModel } from "@/compare";
import type { OpenAIConfig } from "@/openai";
import { runDemo } from "@/run";

async function readRequest<T>(request: Request, schema: z.ZodType<T>) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Open the demo on this server to run it." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Choose a demo and supply text between 1 and 12,000 characters per field." },
      { status: 400 },
    );
  }
  return parsed.data;
}

export async function handleRun(request: Request, client: TypeSafeClient | null) {
  const parsed = await readRequest(request, runSchema);
  if (parsed instanceof Response) return parsed;
  const { input } = parsed;

  if (!client) {
    return Response.json(
      { error: "Add TYPESAFE_API_KEY to .env and restart the server." },
      { status: 503 },
    );
  }

  try {
    const started = performance.now();
    const result = await runDemo(client, input);
    return Response.json({
      ...result,
      elapsedMs: Math.round(performance.now() - started),
    });
  } catch (error) {
    const rejectedKey = error instanceof APIError && (error.status === 401 || error.status === 403);
    const message = rejectedKey
      ? "TypeSafe rejected the API key. Check TYPESAFE_API_KEY in .env and restart."
      : "The live Jev request failed. Try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}

export async function handleCompare(
  request: Request,
  client: TypeSafeClient | null,
  openai: OpenAIConfig | null,
) {
  const parsed = await readRequest(
    request,
    z.object({ input: inputSchema, provider: z.enum(["jev", "llm"]) }),
  );
  if (parsed instanceof Response) return parsed;
  if (!client || !openai) {
    return Response.json(
      {
        error:
          "Live comparison needs TYPESAFE_API_KEY plus OPENAI_URL, OPENAI_MODEL, and OPENAI_API_KEY. Set them in .env and restart the server.",
      },
      { status: 503 },
    );
  }
  return Response.json(await compareModel(client, openai, parsed.input, parsed.provider));
}
