# A 15-minute Jev walkthrough

Two examples, one question each. Show the input, request, response, and source, then run the same question through Jev and OpenAI via Portkey.

## Before the room

- Run `bun install`. Configure `TYPESAFE_API_KEY`, `OPENAI_URL`, `OPENAI_MODEL`, and `OPENAI_API_KEY` in `.env`, then start `bun dev`. The `OPENAI_*` settings point to Portkey; preserve the full model route. See the [setup instructions](../README.md#run-it).
- Open [localhost:3000](http://localhost:3000). Rehearse **Replace a card** and **Rename a response field**, including **Run both models**. Confirm your Portkey model supports strict structured outputs.
- Check Recorded mode too. It replays Jev results only; the comparison is always live.
- Open `src/examples/customer.ts`, `src/examples/pull-request.ts`, and `src/openai.ts` in your editor. Increase the font size for the room.
- Keep a terminal ready using the commands at the end.

## The two-minute introduction

“Jev is a specialized language model for focused decisions. TypeSafe calls this System One and describes its training focus as calibrated decisions. Here's how the interface compares with a generative LLM.”

| | Jev | A generative LLM |
| --- | --- | --- |
| Intended job | A bounded judgment about supplied evidence. | Generation, explanation, and open-ended reasoning. |
| Result | A Choice, Noul, or Score with native answer probabilities. | Content, including structured output and tool calls. |
| Our code | Uses those values to decide what happens next. | Can also enforce typed outputs and control a workflow. |

“Both models can classify and return structured values. We'll use Choice and Noul with Jev, then ask OpenAI the same question using a strict JSON schema. We'll inspect the actual requests and results.”

Jev exposes native decision probabilities. This OpenAI call returns an enum or boolean; it does not provide a confidence score. The comparison illustrates these interfaces. One run cannot establish a general performance advantage. See [System One](https://docs.typesafe.ai/concepts/system-one) and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Run of show

| Time | Show | Say or do |
| --- | --- | --- |
| 0:00-2:00 | Introduction | Give the introduction above. Establish that both examples ask one question. |
| 2:00-4:00 | Customer **Replace a card**, **Demo** | Read the fictional contact. Ask which reason the audience expects, then **Run example**. Inspect the selected reason and option probabilities. |
| 4:00-6:00 | Customer **Source**, then **Request / response** | Read `customerRequest` for the state, question, and criteria, then `labelCustomer` for the SDK call. Match `questions.reason` in the request to `answers.reason.choice` in the response. |
| 6:00-9:00 | PR **Rename a response field**, **Demo** and **Source** | Inspect the highlighted diff: removing `name` changes the contract. Run once, then read the single `breakingChange` Noul and threshold rule. Moving the threshold reuses the answer. |
| 9:00-11:00 | PR **Jev vs LLM** | Choose **Run both models**. Both calls start together; watch each result appear the moment its model finishes. Compare the measured times, then Jev's probability with OpenAI's boolean. |
| 11:00-13:00 | Comparison requests, then **Source** > OpenAI adapter | Inspect both raw requests and responses. Show the strict JSON schema in `src/openai.ts`. Note each elapsed time includes network and gateway overhead; this is one observation. |
| 13:00-15:00 | Questions | “We supplied evidence, asked one focused question, and used the typed result in ordinary code.” Take questions. |

## Keep the code explanation small

For the customer example, follow four steps:

1. `customerRequest` builds the input; `state` contains the contact to classify.
2. `choice` defines one question and four allowed reasons, including `other`.
3. `client.systemOne(request)` returns an answer whose type follows those options.
4. `response.answers.reason.choice` is the displayed label. There is no customer threshold rule.

For the PR, change only the concept being introduced: `noul` answers whether the supplied diff breaks the public contract. `response.answers.breakingChange.noul` feeds a simple threshold comparison.

Both Jev functions return `{ request, response }`, so the workbench can show what went in and what came back. The API key stays on the server. The [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript) documents the call.

For the comparison, `src/openai.ts` uses the shared request builder's question in a prompt and strict schema. The UI starts two independent requests; `src/compare.ts` measures each model call. Each panel updates as its result arrives. The adapter preserves `OPENAI_MODEL`, including Portkey routing, and sends `OPENAI_API_KEY` as `x-portkey-api-key`. See [Portkey's Universal API](https://portkey.ai/docs/product/ai-gateway/universal-api).

Keep server setup and interface code out of the walkthrough. If editing a PR, use **Edit diff**, make the change, then **View diff** and run again. Score and batching are optional discussion topics after the examples.

## Questions to be ready for

- **“Is `0.5` a moderately breaking change?”** No. A Noul near `0.5` means uncertainty about yes versus no. It does not measure severity.
- **“What does Choice confidence tell us?”** It summarizes how concentrated the option probabilities are. It does not prove the answer correct. See [confidence](https://docs.typesafe.ai/confidence).
- **“Why `0.8`?”** It is an illustrative PR label threshold. Choose a real threshold using labelled examples and the consequences of errors.
- **“Is the OpenAI boolean 100% confidence?”** No. It is the selected answer required by the schema. We do not manufacture a confidence value from it.
- **“Which model is faster?”** These timings describe this run, including network and gateway overhead. Repeatable latency and quality comparisons need a representative evaluation.
- **“What would we test?”** Test the deterministic threshold rule normally. Evaluate the model separately using labelled contacts and diffs.

## If something goes wrong

**Jev API unavailable:** select Recorded mode and the same scenario. Say: “This is an actual Jev result saved at the time shown.” You can inspect its source, request, response, and threshold. Edited inputs and the comparison need live requests.

**Portkey unavailable:** continue with the Jev example and inspect `src/openai.ts`. Say the comparison did not complete; do not present a recording as a live two-model comparison.

**Browser unavailable:** use the live terminal path:

```sh
bun demo customer 1
bun demo pull-request 1
bun demo pull-request 2
```

**Unexpected judgment:** keep it visible. Compare the input and question with the result. Treat it as an evaluation case, rather than changing the story to call it correct.

Optional swaps: **Question a charge**, **Access the app**, PR **Add an optional field**, or **Documentation only**. Keep the primary walkthrough inside 15 minutes.
