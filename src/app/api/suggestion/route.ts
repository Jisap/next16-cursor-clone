import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { groq } from '@ai-sdk/groq';
import { auth } from "@clerk/nextjs/server";

const suggestionSchema = z.object({
  suggestion: z
    .string()
    .describe(
      "The code to insert at cursor, or empty string if no completion needed"
    )
});

// Prompt maestro que define el comportamiento del asistente
const SUGGESTION_PROMPT = `You are an intelligent code completion assistant. Your job is to suggest the next piece of code that the user is likely to write.

<context>
  <file_name>{fileName}</file_name>
  <previous_lines>
{previousLines}
  </previous_lines>
  <current_line number="{lineNumber}">
    <before_cursor>{textBeforeCursor}</before_cursor>
    <cursor_position>|</cursor_position>
    <after_cursor>{textAfterCursor}</after_cursor>
  </current_line>
  <next_lines>
{nextLines}
  </next_lines>
  <full_code>
{code}
  </full_code>
</context>

<instructions>
Analyze the code context and suggest what should be typed next at the cursor position.

RULES:
1. If there is already code after the cursor (after_cursor is not empty) that completes the current statement, return an empty string.
2. If the code before the cursor is incomplete (e.g., incomplete function call, object literal, array, string, etc.), suggest the completion.
3. If the user just finished a complete statement and is on a new line or after whitespace, suggest the next logical line of code based on context.
4. Keep suggestions concise - typically one line or one logical completion.
5. Match the existing code style (indentation, naming conventions, etc.).
6. Never duplicate code that already exists in next_lines.
7. For incomplete expressions, complete them intelligently based on context.

EXAMPLES:
- If before_cursor is "const name = ", suggest a likely value
- If before_cursor is "function getData(", suggest parameters
- If before_cursor is "if (user", suggest a condition like ".isAuthenticated) {"
- If before_cursor is "import { ", suggest likely imports based on the file
- If before_cursor is a complete statement on its own line, suggest the next logical line

Return ONLY the text to insert at the cursor position. Return an empty string if no suggestion is appropriate.
</instructions>
`;

// Implementacion del endpoint
export async function POST(request: Request) {

  // Toma los datos del fetcher
  try {

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // 1. Intentamos parsear el JSON de forma segura
    let jsonBody;
    try {
      jsonBody = await request.json();
    } catch (parseError) {
      // Si falla el parseo (ej. petición abortada con cuerpo vacío), devolvemos 400 sin explotar
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const {
      fileName,
      code,
      currentLine,
      previousLines,
      textBeforeCursor,
      textAfterCursor,
      nextLines,
      lineNumber,
    } = jsonBody;

    if (!code) {
      return NextResponse.json(
        { error: "No code provided" },
        { status: 400 }
      );
    }

    // Construye el prompt con los datos del fetcher
    const prompt = SUGGESTION_PROMPT
      .replace("{fileName}", fileName)
      .replace("{code}", code)
      .replace("{currentLine}", currentLine)
      .replace("{previousLines}", previousLines || "")
      .replace("{textBeforeCursor}", textBeforeCursor)
      .replace("{textAfterCursor}", textAfterCursor)
      .replace("{nextLines}", nextLines || "")
      .replace("{lineNumber}", lineNumber.toString());

    // Genera la sugerencia
    // const { output } = await generateText({
    //   model: google("gemini-2.5-flash"),
    //   output: Output.object({ schema: suggestionSchema }),
    //   prompt,
    // })

    // Genera la sugerencia con Groq
    // Usa el modelo de Groq que mejor te funcione
    const { output } = await generateText({
      model: groq("openai/gpt-oss-20b"),
      output: Output.object({ schema: suggestionSchema }),
      prompt,
    })

    return NextResponse.json({ suggestion: output.suggestion });

  } catch (error) {
    // Manejo específico para límites de cuota (Rate Limiting)
    if (error instanceof Error && error.message.includes("Quota exceeded")) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    console.error("Suggestion error: ", error);
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 }
    );
  }
}
