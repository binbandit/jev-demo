import type { CustomerResponse } from "@/examples/customer";
import type { PullRequestResponse } from "@/examples/pull-request";

export const customerResponse = {
  model: "jev-1.13.0",
  answers: {
    reason: {
      type: "choice",
      choice: "card_replacement",
      confidence: 1,
      probabilities: {
        other: 0,
        card_replacement: 1,
        payment_query: 0,
        online_banking: 0,
      },
    },
  },
  usage: {
    input_tokens: 428,
    output_tokens: 55,
  },
} satisfies CustomerResponse;

export const pullRequestResponse = {
  model: "jev-1.13.0",
  answers: {
    breakingChange: {
      type: "noul",
      noul: 0.94,
    },
  },
  usage: {
    input_tokens: 427,
    output_tokens: 24,
  },
} satisfies PullRequestResponse;
