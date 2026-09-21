import type { DemoRun } from "@/run";

export function RequestResponse({ result }: { result: DemoRun | null }) {
  if (!result)
    return (
      <p className="request-empty">
        Run an example in the Demo view to inspect its request and response.
      </p>
    );

  return (
    <div className="workspace request-view">
      <section className="pane" aria-labelledby="request-heading">
        <div className="pane-heading">
          <h2 id="request-heading">Request</h2>
          <span>Actual SDK payload</span>
        </div>
        <p className="endpoint">
          <code>POST https://api.typesafe.ai/v1/systemone</code>
        </p>
        <p className="hint">The SDK adds authorization on the server.</p>
        <pre className="json-output request-json">
          <code>{JSON.stringify(result.request, null, 2)}</code>
        </pre>
      </section>
      <section className="pane" aria-labelledby="response-heading">
        <div className="pane-heading">
          <h2 id="response-heading">Response</h2>
          <span>Unmodified SDK result</span>
        </div>
        <pre className="json-output request-json">
          <code>{JSON.stringify(result.response, null, 2)}</code>
        </pre>
      </section>
    </div>
  );
}
