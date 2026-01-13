import { google } from "@ai-sdk/google";
import { inngest } from "./client";
import { generateText } from "ai";

export const demoGenerate = inngest.createFunction(
  { id: "demo-generate" },
  { event: "demo/generate" },
  async ({ event, step }) => {
    await step.run("generate-text", async () => {
      return await generateText({
        model: google("gemini-2.5-flash"),
        prompt: "Write a vegetarian lasagna recipe for 4 people",
      })
    })
  }
)
  
