import { google } from "@ai-sdk/google";
import { inngest } from "./client";
import { generateText } from "ai";
import { firecrawl } from "@/lib/firecrawl";

const URL_REGEX = /https?:\/\/[^\s]+/g; // Matches URLs in a string

export const demoGenerate = inngest.createFunction(
  { id: "demo-generate" },
  { event: "demo/generate" },
  async ({ event, step }) => {
    const { prompt } = event.data as { prompt: string };                  // Extrae el mensaje o pregunta (prompt) que el usuario envió en el evento.
    // 1º
    const urls = await step.run("extract-urls", async () => {
      return prompt.match(URL_REGEX);                                     // Busca dentro del texto del prompt cualquier cadena que parezca una URL usando la expresión regular.
    }) as string[];

    // 2º
    const scrapedContent = await step.run("scrape-urls", async () => {
      const results = await Promise.all(                                  // Procesa todas las urls encontradas en paralelo
        urls.map(async (url) => {
          const result = await firecrawl.scrape(                          // Visita cada url y extrae el contenido en formato markdown
            url,
            { formats: ["markdown"] },
          );
          return result.markdown ?? null;
        })
      )
      return results.filter(Boolean).join("\n\n");                        // Combina el contenido de todas las urls en un solo string
    });

    const finalPrompt = scrapedContent                                    // Si se encontró contenido en las webs (scrapedContent), 
      ? `Context:\n\n${scrapedContent}\n\nQuestion: ${prompt}`            // se crea un nuevo prompt que dice: "Aquí tienes contexto: [contenido web]. Pregunta: [pregunta original]".
      : prompt;

    // 3º
    await step.run("generate-text", async () => {
      return await generateText({
        model: google("gemini-2.5-flash"),
        prompt: finalPrompt,                                              // Se envía el prompt final a la API de Google. El modelo respondera la question que usuario hizo
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
        }
      })
    })
  }
)

export const demoError = inngest.createFunction(
  { id: "demo-error" },
  { event: "demo/error" },
  async ({ event, step }) => {
    await step.run("fail", async () => {
      throw new Error("Inngest error: Background job failed!");
    })
  }
)
  
