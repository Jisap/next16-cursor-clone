import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { groq } from '@ai-sdk/groq';
import { auth } from "@clerk/nextjs/server";
import { firecrawl } from "@/lib/firecrawl";

// El objetivo de este endpoint es recibir un fragmento de código, 
// entender qué quiere cambiar el usuario 
// y devolverle el código ya modificado. */

const quickEditSchema = z.object({
  editedCode: z
    .string()
    .describe(
      "The edited version of the selected code based on the instruction"
    )
});

const URL_REGEX = /https?:\/\/[^\s)>\]]+/g; // Detecta y extrae URLs (enlaces web) dentro de un texto.


const QUICK_EDIT_PROMPT = `You are a code editing assistant. Edit the selected code based on the user's instruction.

<context>
<selected_code>
{selectedCode}
</selected_code>
<full_code_context>
{fullCode}
</full_code_context>
</context>

{documentation}

<instruction>
{instruction}
</instruction>

<instructions>
Return ONLY the edited version of the selected code.
Maintain the same indentation level as the original.
Do not include any explanations or comments unless requested.
If the instruction is unclear or cannot be applied, return the original code unchanged.
</instructions>`;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const {
      selectedCode, // Bloque de código seleccionado por el usuario
      fullCode,     // Código completo del archivo
      instruction   // Instrucción dada por el usuario
    } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!selectedCode) {
      return NextResponse.json({ error: "Selected code is required" }, { status: 400 });
    }

    if (!instruction) {
      return NextResponse.json({ error: "Instruction is required" }, { status: 400 });
    }

    const urls: string[] = instruction.match(URL_REGEX) || [];         // Se escanea la instrucción para extraer URLs

    let documentationContext = "";

    if (urls.length > 0) {
      const scrapedResults = await Promise.all(                        // Se escanean las URLs
        urls.map(async (url) => {
          try {
            const result = await firecrawl.scrape(url, {               // Se obtiene el contenido de la url en formato markdown
              formats: ["markdown"]
            });

            if (result.markdown) {                                     // Se verifica que el resultado sea válido
              return `<doc url="${url}">\n${result.markdown}\n</doc>`  // Se envuelve el contenido en etiquetas para que el modelo lo entienda
            }

            return null;
          } catch (error) {
            return null;
          }
        })
      );

      const validResults = scrapedResults.filter(Boolean);             // Se filtran los resultados válidos

      if (validResults.length > 0) {
        documentationContext = `<documentation>\n${validResults.join("\n\n")}\n</documentation>` // Se inyecta el contenido de la url como contexto adicional en el prompt
      }
    }

    const prompt = QUICK_EDIT_PROMPT                                   // Se construye el prompt 
      .replace("{selectedCode}", selectedCode)
      .replace("{fullCode}", fullCode)
      .replace("{instruction}", instruction)
      .replace("{documentation}", documentationContext);

    const { output } = await generateText({                            // Se genera la respuesta
      model: groq("openai/gpt-oss-20b"),
      output: Output.object({ schema: quickEditSchema }),
      prompt,
    })

    return NextResponse.json({ editedCode: output.editedCode });

  } catch (error) {
    console.error("Quick edit error: ", error);
    return NextResponse.json(
      { error: "Failed to generate quick edit" },
      { status: 500 }
    );
  }
}