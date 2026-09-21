import { useState } from "react";
import { type DemoId, type DemoInput, presets } from "@/catalog";
import { CodeWalkthrough } from "@/web/CodeWalkthrough";
import { Comparison } from "@/web/Comparison";
import { InputPanel } from "@/web/InputPanel";
import { RequestResponse } from "@/web/RequestResponse";
import { Results } from "@/web/Results";
import { useDemo } from "@/web/useDemo";

const examples: { id: DemoId; name: string }[] = [
  { id: "customer", name: "Customer labels" },
  { id: "pull-request", name: "PR labels" },
];

export function App() {
  const demo = useDemo();
  const [view, setView] = useState<"demo" | "request" | "source" | "about">("demo");
  const [threshold, setThreshold] = useState(0.8);

  function changeInput(input: DemoInput) {
    setThreshold(0.8);
    demo.changeInput(input);
  }

  function selectExample(id: DemoId) {
    const preset = presets[id][0];
    if (preset) changeInput(preset.input);
    setThreshold(0.8);
  }

  return (
    <div className="app">
      <header className="header">
        <h1>jev-demo</h1>
        <a href="https://github.com/binbandit/jev-demo" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </header>

      <div className="toolbar">
        <nav className="tabs" aria-label="Examples">
          {examples.map(({ id, name }) => (
            <button
              type="button"
              key={id}
              aria-pressed={demo.input.demo === id}
              onClick={() => selectExample(id)}
            >
              {name}
            </button>
          ))}
        </nav>
        <nav className="view-tabs" aria-label="View">
          <button type="button" aria-pressed={view === "demo"} onClick={() => setView("demo")}>
            Demo
          </button>
          <button
            type="button"
            aria-pressed={view === "request"}
            onClick={() => setView("request")}
          >
            Request / response
          </button>
          <button type="button" aria-pressed={view === "source"} onClick={() => setView("source")}>
            Source
          </button>
          <button type="button" aria-pressed={view === "about"} onClick={() => setView("about")}>
            Jev vs LLM
          </button>
        </nav>
      </div>

      <div className="session-bar">
        <code>
          {demo.config?.model ??
            (demo.configError ? "Configuration unavailable" : "Loading configuration…")}
        </code>
        <span>One question per request</span>
      </div>
      {demo.configError ? (
        <div className="notice" role="alert">
          <span>{demo.configError}</span>
          <button type="button" onClick={demo.retryConfig}>
            Retry connection
          </button>
        </div>
      ) : demo.config && !demo.config.liveAvailable ? (
        <div className="notice">
          <span>Add TYPESAFE_API_KEY to .env and restart the server to run examples.</span>
          <button type="button" onClick={demo.retryConfig}>
            Recheck configuration
          </button>
        </div>
      ) : null}

      <main>
        {view === "demo" ? (
          <div className="workspace">
            <InputPanel
              input={demo.input}
              pending={demo.pending}
              ready={demo.config?.liveAvailable ?? false}
              onChange={changeInput}
              onRun={() => void demo.execute()}
            />
            <Results
              result={demo.result}
              pending={demo.pending}
              error={demo.error}
              threshold={threshold}
              onThresholdChange={setThreshold}
            />
          </div>
        ) : view === "request" ? (
          <RequestResponse result={demo.result} />
        ) : view === "source" ? (
          <CodeWalkthrough key={demo.input.demo} demo={demo.input.demo} result={demo.result} />
        ) : null}
        <div hidden={view !== "about"}>
          <Comparison
            key={JSON.stringify(demo.input)}
            input={demo.input}
            jevAvailable={demo.config?.liveAvailable ?? false}
            llmAvailable={demo.config?.openaiAvailable ?? false}
            llmModel={demo.config?.openaiModel ?? null}
          />
        </div>
      </main>

      <footer className="footer">
        {view === "about" ? (
          <span>
            Live comparison sends the same example to Jev and the configured OpenAI endpoint.
          </span>
        ) : demo.result ? (
          <>
            <span>Live response</span>
            <span>{demo.result.response.model}</span>
            <span>{demo.result.elapsedMs} ms request time</span>
            <span>
              {demo.result.response.usage.input_tokens} input /{" "}
              {demo.result.response.usage.output_tokens} output tokens
            </span>
          </>
        ) : (
          <span>
            Fictional customer logs and example diffs. Running an example sends the input to
            TypeSafe.
          </span>
        )}
      </footer>
    </div>
  );
}
