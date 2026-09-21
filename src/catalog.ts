import { z } from "zod";

const text = z.string().trim().min(1).max(12_000);
export const inputSchema = z.discriminatedUnion("demo", [
  z.object({ demo: z.literal("customer"), interactions: text }),
  z.object({ demo: z.literal("pull-request"), title: text, diff: text }),
]);

export const runSchema = z.strictObject({ input: inputSchema });
export type DemoInput = z.infer<typeof inputSchema>;
export type DemoId = DemoInput["demo"];

export const presets = {
  customer: [
    {
      label: "Replace a card",
      input: {
        demo: "customer",
        interactions: `Customer: I left my debit card in a taxi and can't get it back.
Agent: Have you frozen the card?
Customer: Yes. I need a replacement sent to my home.`,
      },
    },
    {
      label: "Question a charge",
      input: {
        demo: "customer",
        interactions: `Customer: The restaurant seems to have charged me twice for last night's dinner.
Agent: Are both transactions settled, or is one still pending?
Customer: Both have settled. Could you look into the duplicate?`,
      },
    },
    {
      label: "Access the app",
      input: {
        demo: "customer",
        interactions: `Customer: I got a new phone and the app won't let me sign in.
Agent: What happens when you try?
Customer: It asks me to approve the login on my old device, which I no longer have.`,
      },
    },
  ],
  "pull-request": [
    {
      label: "Rename a response field",
      input: {
        demo: "pull-request",
        title: "Rename the user name field",
        diff: `diff --git a/src/api/users.ts b/src/api/users.ts
--- a/src/api/users.ts
+++ b/src/api/users.ts
@@ -1,3 +1,3 @@
 // GET /api/users/:id
 export function userResponse(user: User) {
-  return { id: user.id, name: user.name };
+  return { id: user.id, fullName: user.name };
`,
      },
    },
    {
      label: "Add an optional field",
      input: {
        demo: "pull-request",
        title: "Include an optional avatar URL in user responses",
        diff: `diff --git a/src/api/users.ts b/src/api/users.ts
--- a/src/api/users.ts
+++ b/src/api/users.ts
@@ -1,3 +1,3 @@
 // GET /api/users/:id
 export function userResponse(user: User) {
-  return { id: user.id, name: user.name };
+  return { id: user.id, name: user.name, avatarUrl: user.avatarUrl ?? null };
`,
      },
    },
    {
      label: "Documentation only",
      input: {
        demo: "pull-request",
        title: "Explain how to announce breaking changes",
        diff: `diff --git a/docs/contributing.md b/docs/contributing.md
--- a/docs/contributing.md
+++ b/docs/contributing.md
@@ -1 +1,2 @@
 # Contributing
+Document breaking API changes in the release notes before merging.
`,
      },
    },
  ],
} satisfies Record<DemoId, { label: string; input: DemoInput }[]>;
