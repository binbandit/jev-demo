import type { TypeSafeClient } from "@typesafe-ai/sdk";
import type { DemoInput } from "@/catalog";
import { type customerRequest, labelCustomer } from "@/examples/customer";
import { labelPullRequest, type pullRequestRequest } from "@/examples/pull-request";

export type JevRequest = ReturnType<typeof customerRequest> | ReturnType<typeof pullRequestRequest>;

export async function runDemo(client: TypeSafeClient, input: DemoInput) {
  switch (input.demo) {
    case "customer":
      return { demo: input.demo, ...(await labelCustomer(client, input.interactions)) };
    case "pull-request":
      return {
        demo: input.demo,
        ...(await labelPullRequest(client, input.title, input.diff)),
      };
  }
}

export type DemoResult = Awaited<ReturnType<typeof runDemo>>;
export type DemoRun = DemoResult & {
  elapsedMs: number;
};
