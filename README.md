# Jev demo

A 15-minute TypeScript and Bun demo for engineers. Two small examples each ask **one question**:

- **Customer label:** choose the reason for a fictional customer's contact.
- **PR label:** judge whether a diff breaks a public API contract.

The workbench exposes the input, actual request, response, and source. It can also run the same question through Jev and OpenAI via Portkey.

## Run it

Install [Bun](https://bun.sh), then on a fresh clone:

```sh
bun install
cp .env.example .env
# Set TYPESAFE_API_KEY in .env for live requests.
bun dev
```

Open [localhost:3000](http://localhost:3000). Bun loads `.env` automatically; the SDK reads the key on the server. Restart after changing the key. `.env` is ignored by Git. `TYPESAFE_MODEL` defaults to `jev-1.13.0`.

For the live comparison, also set these in `.env` or the environment:

| Variable | Value |
| --- | --- |
| `OPENAI_URL` | Portkey base URL, for example `https://api.portkey.ai/v1`. |
| `OPENAI_MODEL` | Your configured model, including the full `@provider/model` route when used. It is passed through unchanged. |
| `OPENAI_API_KEY` | Your Portkey API key. The server sends it as `x-portkey-api-key`. |

There are no separate `PORTKEY_*` variables. Use a model route that supports strict structured outputs. Restart after changing configuration. See [Portkey's Universal API](https://portkey.ai/docs/product/ai-gateway/universal-api).

Choose a scenario, then **Run example**. Use **Demo** for the input and result, **Request / response** for the JSON, **Source** to select the Jev example or OpenAI adapter, and **Jev vs LLM** to run both models. PR diffs are highlighted; **Edit diff** / **View diff** switches between editing and viewing in Live mode.

**Recorded** mode replays actual Jev API results without a key. Results identify their mode, model, and capture time. There is no automatic fallback from live to recorded. Recordings cover the included scenarios; edited inputs and the two-model comparison require live requests.

Start with **Replace a card**, then **Rename a response field**. The [presenter guide](docs/presenter.md) covers the 15-minute walkthrough.

## The two examples

| Example | Question | Typed result |
| --- | --- | --- |
| Customer | What is the reason for this contact? | A `Choice`: `card_replacement`, `payment_query`, `online_banking`, or `other`. |
| Pull request | Does this diff introduce a backward-incompatible public API change? | A `Noul`: the probability of yes, from `0` to `1`. |

Customer scenarios are **Replace a card**, **Question a charge**, and **Access the app**. Each has one intent. The chosen reason becomes the customer label directly.

PR scenarios are **Rename a response field**, **Add an optional field**, and **Documentation only**. They contrast a removed contract field, a compatible addition, and words in documentation. A local comparison applies `breaking-change` when the probability meets the threshold, initially `0.8`.

Changing the PR threshold reuses the existing answer without another request. Customer labels do not use that threshold. Changing the input or scenario requires a fresh run.

## Walk through the code

| File | What to explain |
| --- | --- |
| [src/examples/customer.ts](src/examples/customer.ts) | `customerRequest`: state and one `choice` question. `labelCustomer`: the SDK call. |
| [src/examples/pull-request.ts](src/examples/pull-request.ts) | `pullRequestRequest`: one `noul` question. `pullRequestLabels`: one probability comparison. |
| [src/openai.ts](src/openai.ts) | Translate the same question into a strict JSON response through Portkey. |
| [src/compare.ts](src/compare.ts) | Run one model call and retain its request, response, and timing. |
| [src/client.ts](src/client.ts) | Model selection and server-side SDK configuration. |
| [src/catalog.ts](src/catalog.ts) | The fictional inputs and scenario definitions. |
| [src/recordings.json](src/recordings.json) | The captured results for Recorded mode. |

Request builders define the evidence and questions once for both integrations. The Jev functions pass that object to `client.systemOne(request)` and return `{ request, response }`. **Request / response** shows the actual SDK input, including `model`, `state`, and `questions`, alongside its response. The API key stays on the server.

The SDK infers answer types from the question definitions. Inspect `response.answers.reason.choice` for the customer and `response.answers.breakingChange.noul` for the PR. See the [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript) and [primitives](https://docs.typesafe.ai/primitives).

A Noul near `0.5` means uncertainty, not a moderately breaking change. Choice confidence summarizes concentration of the option probabilities, not guaranteed correctness. The PR's `0.8` threshold is illustrative and needs evaluation for a real workflow. See [confidence](https://docs.typesafe.ai/confidence).

## Compare Jev with OpenAI

Select an example and scenario, open **Jev vs LLM**, then choose **Run both models**. Both live calls start concurrently with the same state, question, and criteria. Each panel displays its result and elapsed time as soon as that model finishes, while the other keeps running. Inspect either request and response immediately, including when the other model fails.

| Result | Jev | OpenAI through Portkey |
| --- | --- | --- |
| Customer | A Choice label and native option probabilities. | Strict JSON with a `reason` enum. |
| PR | A Noul probability, which the application thresholds. | Strict JSON with a `breakingChange` boolean. |

The OpenAI adapter uses [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), so both sides return constrained values. It does not request or invent an OpenAI confidence score. Jev specializes in decisions with native probabilities; generative LLMs can also classify, use structured outputs, and perform broader generation and reasoning. See [System One](https://docs.typesafe.ai/concepts/system-one).

Timing includes network and gateway overhead. A single run is not a benchmark or evidence of a general speed, cost, or accuracy advantage.

## Terminal and maintenance

```sh
bun demo customer 1
bun demo pull-request 1
bun demo pull-request 2
```

The terminal commands make live requests. Scenario numbers are `1`, `2`, or `3` for either example.

| Command | Purpose |
| --- | --- |
| `bun dev` | Start the demo with automatic reload. |
| `bun run record` | Call the API for all six scenarios and replace the saved recordings. |
| `bun run check` | Check types and code style. |
| `bun test` | Run the local tests without an API key. |
| `bun run build` | Verify the browser bundle. |
| `bun start` | Run the Bun server in production mode. |

A build is not required before starting the server. Refresh recordings after changing the questions or scenarios, then rehearse before presenting. Live probabilities and elapsed times can vary.

All fixtures are fictional. Live Jev requests send inputs to TypeSafe; the comparison also sends them through Portkey to the configured model. Keys stay on the server. The demo does not connect to bank systems or apply GitHub labels. Customer labels describe contact reasons, not eligibility or risk.
