import { useCallback, useEffect, useRef, useState } from "react";
import { type DemoInput, presets } from "@/catalog";
import type { DemoRun } from "@/run";

type Config = {
  liveAvailable: boolean;
  model: string;
  openaiAvailable: boolean;
  openaiModel: string | null;
};

export function useDemo() {
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [input, setInput] = useState<DemoInput>(
    presets.customer[0]?.input ?? { demo: "customer", interactions: "" },
  );
  const [result, setResult] = useState<DemoRun | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const configRequest = useRef<AbortController | null>(null);

  const retryConfig = useCallback(async () => {
    configRequest.current?.abort();
    const controller = new AbortController();
    configRequest.current = controller;
    setConfig(null);
    setConfigError(null);
    try {
      const response = await fetch("/api/config", { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the demo configuration.");
      const next = (await response.json()) as Config;
      if (controller.signal.aborted) return;
      setConfig(next);
    } catch {
      if (controller.signal.aborted) return;
      setConfigError(
        "Could not load the demo configuration. Check the server connection and retry.",
      );
    }
  }, []);

  useEffect(() => {
    void retryConfig();
    return () => {
      configRequest.current?.abort();
      request.current?.abort();
      request.current = null;
    };
  }, [retryConfig]);

  function clearResult() {
    request.current?.abort();
    request.current = null;
    setResult(null);
    setPending(false);
    setError(null);
  }

  function changeInput(next: DemoInput) {
    clearResult();
    setInput(next);
  }

  async function execute() {
    clearResult();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as DemoRun | { error: string };
      if (!response.ok || "error" in payload) {
        throw new Error(
          "error" in payload ? payload.error : `Request failed (${response.status}).`,
        );
      }
      if (request.current === controller) setResult(payload);
    } catch (cause) {
      if (request.current !== controller) return;
      setError(cause instanceof Error ? cause.message : "The request failed. Try again.");
    } finally {
      if (request.current === controller) {
        setPending(false);
        request.current = null;
      }
    }
  }

  return { config, configError, retryConfig, input, result, pending, error, changeInput, execute };
}
