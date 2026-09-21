import { useState } from "react";
import { type DemoId, type DemoInput, type Mode, presets } from "@/catalog";
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
        <span className="header-description">Typed judgments in TypeScript</span>
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
        <code>{demo.config?.model ?? "Loading configuration…"}</code>
        <span>One question per request</span>
        <label htmlFor="mode">
          Mode{" "}
          <select
            id="mode"
            value={demo.mode}
            disabled={!demo.config}
            onChange={(event) => {
              setThreshold(0.8);
              demo.changeMode(event.target.value as Mode);
            }}
          >
            <option value="live" disabled={!demo.config?.liveAvailable}>
              Live
            </option>
            <option value="recorded">Recorded</option>
          </select>
        </label>
      </div>
      {demo.mode === "recorded" ? (
        <p className="notice">
          Replaying real saved responses for the preset inputs. No model call is made.
        </p>
      ) : null}

      <main>
        {view === "demo" ? (
          <div className="workspace">
            <InputPanel
              input={demo.input}
              mode={demo.mode}
              pending={demo.pending}
              ready={demo.config !== null}
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
            key={`${demo.mode}:${JSON.stringify(demo.input)}`}
            input={demo.input}
            mode={demo.mode}
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
            <span>{demo.result.source === "live" ? "Live response" : "Recorded response"}</span>
            <span>{demo.result.response.model}</span>
            <span>
              {demo.result.elapsedMs} ms
              {demo.result.source === "recorded" ? " at capture" : " request time"}
            </span>
            <span>
              {demo.result.response.usage.input_tokens} input /{" "}
              {demo.result.response.usage.output_tokens} output tokens
            </span>
            {demo.result.source === "recorded" ? (
              <span>Captured {new Date(demo.result.capturedAt).toLocaleString()}</span>
            ) : null}
          </>
        ) : (
          <span>
            Fictional customer logs and example diffs. Live mode sends the input to TypeSafe.
          </span>
        )}
      </footer>
    </div>
  );
}
