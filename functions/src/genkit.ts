// src/functions/src/genkit.ts
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { firebase } from "@genkit-ai/firebase";

export const ai = genkit({
  plugins: [firebase(), googleAI()],
  logLevel: "debug",
  enableTracingAndMetrics: true,
});
