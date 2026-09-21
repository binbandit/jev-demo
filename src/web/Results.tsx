import { pullRequestLabels } from "@/examples/pull-request";
import type { DemoRun } from "@/run";

type Props = {
  result: DemoRun | null;
  pending: boolean;
  error: string | null;
  threshold: number;
  onThresholdChange: (value: number) => void;
};

export function Results({ result, pending, error, threshold, onThresholdChange }: Props) {
  const labels =
    result?.demo === "customer"
      ? [result.response.answers.reason.choice]
      : result
        ? pullRequestLabels(result.response.answers, threshold)
        : [];

  return (
    <section className="pane output-pane" aria-labelledby="output-heading" aria-busy={pending}>
      <div className="pane-heading">
        <h2 id="output-heading">Output</h2>
        <span>SDK response</span>
      </div>
      <div aria-live="polite">
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {pending ? <p className="empty">Waiting for Jev…</p> : null}
        {!result && !pending && !error ? (
          <p className="empty">Run the example to see Jev's answer.</p>
        ) : null}
        {result ? (
          <>
            <div className="table-scroll">
              <table className="answers">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.response.answers).map(([name, answer]) => (
                    <tr key={name}>
                      <td>
                        <code>{name}</code>
                      </td>
                      <td>{answer.type === "noul" ? "Noul" : "Choice"}</td>
                      <td className="answer-value">
                        <code>
                          {answer.type === "noul" ? answer.noul.toFixed(2) : answer.choice}
                        </code>
                      </td>
                      <td className="answer-detail">
                        {answer.type === "noul"
                          ? "P(yes)"
                          : `${Math.round(answer.confidence * 100)}% confidence`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <section className="label-section" aria-labelledby="labels-heading">
              <h3 id="labels-heading">Applied label</h3>
              <div className="labels">
                {labels.length ? (
                  labels.map((label) => (
                    <span className="label" key={label}>
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="muted">None at this threshold.</span>
                )}
              </div>
              {result.demo === "pull-request" ? (
                <>
                  <div className="threshold-control">
                    <label htmlFor="threshold">
                      P(yes) ≥ <output htmlFor="threshold">{threshold.toFixed(2)}</output>
                    </label>
                    <input
                      id="threshold"
                      type="range"
                      min="0.5"
                      max="0.99"
                      step="0.01"
                      value={threshold}
                      onChange={(event) => onThresholdChange(Number(event.target.value))}
                    />
                  </div>
                  <p className="hint">
                    Changing this threshold only runs the TypeScript filter. It makes no API call.
                  </p>
                </>
              ) : (
                <div className="option-probabilities">
                  <h3>Option probabilities</h3>
                  <dl>
                    {Object.entries(result.response.answers.reason.probabilities).map(
                      ([option, probability]) => (
                        <div key={option}>
                          <dt>
                            <code>{option}</code>
                          </dt>
                          <dd>{probability.toFixed(2)}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                </div>
              )}
            </section>
            <details className="response-details">
              <summary>Raw JSON</summary>
              <pre className="json-output">
                <code>{JSON.stringify(result.response, null, 2)}</code>
              </pre>
            </details>
            <p className="hint">
              {result.demo === "customer"
                ? "Choice selects one option. Confidence describes the distribution, not guaranteed correctness."
                : "Noul is the probability of yes. A value near 0.5 means uncertainty, not a moderate breaking change."}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
