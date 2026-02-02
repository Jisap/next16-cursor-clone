import { inngest } from "@/inngest/client";
import { Id } from "../../../../convex/_generated/dataModel";
import { NonRetriableError } from "inngest";
import { convex } from "@/lib/convex-client";
import { api } from "../../../../convex/_generated/api";
import { CODING_AGENT_SYSTEM_PROMPT, TITLE_GENERATOR_SYSTEM_PROMPT } from "./constants";
import { DEFAULT_CONVERSATION_TITLE } from "../constants";
import { createAgent, createNetwork, openai } from "@inngest/agent-kit";
import { createReadFilesTool } from "./tools/read-files";
import { createListFilesTool } from "./tools/list-files";
import { createUpdateFileTool } from "./tools/update-file";
import { createCreateFilesTool } from "./tools/create-files";
import { createCreateFolderTool } from "./tools/create-folder";
import { createRenameFileTool } from "./tools/rename-file";


interface MessageEvent {
  messageId: Id<"messages">;
  conversationId: Id<"conversations">;
  projectId: Id<"projects">;
  message: string;
}

export const processMessage = inngest.createFunction(
  {
    id: "process-message",
    cancelOn: [{
      event: "message/cancel",
      //id del msg a cancelar == id de mensaje que activo el send del evento en inngest
      if: "event.data.messageId == async.data.messageId"
    }],
    onFailure: async ({ event, step }) => {
      const { messageId } = event.data.event.data as MessageEvent;
      const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;

      // Update the message with error content
      if (internalKey) {
        await step.run("update-message-on-failure", async () => {
          await convex.mutation(api.system.updateMessageContent, {
            internalKey,
            messageId,
            content: "My apologies, I encountered an error while processing your message. Please try again.",
          })
        })
      }

    }
  },
  {
    event: "message/sent",
  },
  async ({ event, step }) => {
    const {
      messageId,
      conversationId,
      projectId,
      message } = event.data as MessageEvent

    const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;

    if (!internalKey) {
      throw new NonRetriableError("CONVEX_INTERNAL_KEY is not configured");
    }

    // TODO: Check if this is needed
    await step.sleep("wait-for-db-sync", "1s");

    // Get conversation for title generation check
    const conversation = await step.run("get-conversation", async () => {
      return await convex.query(api.system.getConversationById, {
        internalKey,
        conversationId,
      })
    });

    if (!conversation) {
      throw new NonRetriableError("Conversation not found");
    };

    // Fetch recent messages for conversation context
    const recentMessages = await step.run("get-recent-messages", async () => {
      return await convex.query(api.system.getRecentMessages, {
        internalKey,
        conversationId,
        limit: 10,
      });
    });

    // Se crea el prompt del sistema
    let systemPrompt = CODING_AGENT_SYSTEM_PROMPT;

    // Se crea el contexto de mensaje filtrando el mensaje actual y los mensajes vacios.
    const contextMessages = recentMessages.filter(
      (msg) => msg._id !== messageId && msg.content.trim() !== ""
    );

    if (contextMessages.length > 0) {                              // Si hay mensajes en el contexto
      const historyText = contextMessages                          // Se mapea el historial de mensajes 
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`) // y se le da una estructura: "USER/ASSISTANT": "Mensaje"
        .join("\n\n");

      // Se inyecta al systemPrompt instrucciones para que la IA distinga claramente
      // entre lo que ya pasó y lo que debe responder ahora
      systemPrompt += `\n\n## Previous Conversation (for context only - do NOT repeat these responses):\n${historyText}\n\n## Current Request:\nRespond ONLY to the user's new message below. Do not repeat or reference your previous responses.`;
    };

    // Se genera el titulo de la conversacion si es el titulo por defecto
    const shouldGenerateTitle =
      conversation.title === DEFAULT_CONVERSATION_TITLE;


    // Si se debe generar el título se crea un agente que lo modifica
    if (shouldGenerateTitle) {
      const titleAgent = createAgent({
        name: "title-generator",
        system: TITLE_GENERATOR_SYSTEM_PROMPT,
        model: openai({
          model: "openai/gpt-oss-20b",
          apiKey: process.env.GROQ_API_KEY,
          baseUrl: "https://api.groq.com/openai/v1"
        }),
      });

      // Se ejecuta el agente
      const { output } = await titleAgent.run(message, { step });

      // Se extrae el texto del mensaje del agente
      const textMessage = output.find(
        (m) => m.type === "text" && m.role === "assistant"
      );

      // Se verifica que el mensaje sea de tipo texto
      if (textMessage?.type === "text") {
        const title =
          typeof textMessage.content === "string"
            ? textMessage.content.trim()
            : textMessage.content
              .map((c) => c.text)
              .join("")
              .trim();

        // Si el título es válido se actualiza la bd -> frontend refleja el cambio
        if (title) {
          await step.run("update-conversation-title", async () => {
            await convex.mutation(api.system.updateConversationTitle, {
              internalKey,
              conversationId,
              title,
            });
          });
        }
      }
    }

    // Creamos el agente que va a procesar el mensaje
    const codingAgent = createAgent({
      name: "polaris",
      description: "An expert AI coding assistant",
      system: systemPrompt,
      model: openai({
        model: "openai/gpt-oss-20b",
        apiKey: process.env.GROQ_API_KEY,
        baseUrl: "https://api.groq.com/openai/v1"
      }),
      tools: [
        createReadFilesTool({ internalKey }),
        createListFilesTool({ internalKey, projectId }),
        createUpdateFileTool({ internalKey }),
        createCreateFilesTool({ projectId, internalKey }),
        createCreateFolderTool({ projectId, internalKey }),
        createRenameFileTool({ internalKey }),
        // createDeleteFilesTool({ internalKey }),
        // createScrapeUrlsTool(),
      ],
    });

    // Crea una red de ejecución autónoma (Autonomous Network Loop)
    // Aunque solo tenemos un agente ('codingAgent'), el "network" permite crear un bucle de razonamiento
    // estilo ReAct (Reasoning + Acting). Esto permite que el agente:
    // 1. Reciba el mensaje del usuario.
    // 2. Decida usar herramientas (si es necesario).
    // 3. Reciba la salida de esas herramientas.
    // 4. Vuelva a pensar y decida si necesita más herramientas o si ya tiene la respuesta final.
    const network = createNetwork({
      name: "polaris-network",
      agents: [codingAgent],
      maxIter: 20,                                             // "Kill switch": Límite máximo de iteraciones (pensamientos/acciones) para evitar bucles infinitos.
      // --- CEREBRO DEL BUCLE (ROUTER) ---
      // Esta función se ejecuta después de cada paso 
      // del agente para decidir qué hacer a continuación.
      router: ({ network }) => {
        const lastResult = network.state.results.at(-1);       // Inspeccionamos lo último que hizo el agente


        const hasTextResponse = lastResult?.output.some(       // Verificamos si el agente generó texto para el usuario (respuesta hablada)
          (m) => m.type === "text" && m.role === "assistant"
        );


        const hasToolCalls = lastResult?.output.some(          // Verificamos si el agente solicitó usar alguna herramienta (abrir archivo, leer web, etc.) 
          (m) => m.type === "tool_call"
        );

        // Lógica de decisión de parada:
        // Si el agente respondió con texto Y NO está intentando usar herramientas...
        // significa que ha terminado su trabajo y nos está dando la respuesta final.
        // Retornamos 'undefined' para romper el bucle y finalizar la ejecución de la red.
        if (hasTextResponse && !hasToolCalls) {
          return undefined;
        }

        // Si hay llamadas a herramientas (o no hubo respuesta de texto aún),
        // devolvemos al 'codingAgent' para que se vuelva a ejecutar.
        // El framework de Inngest ejecutará las herramientas automáticamente e inyectará
        // los resultados en la "memoria" del agente en la siguiente vuelta.
        return codingAgent;
      }
    });

    // Run the agent
    const result = await network.run(message);                 // Ejecuta la red con el mensaje del usuario

    // Extract the assistant's text response 
    // from the last agent result
    const lastResult = result.state.results.at(-1);            // Obtiene el resultado final
    const textMessage = lastResult?.output.find(
      (m) => m.type === "text" && m.role === "assistant"       // Busca el mensaje de texto final del asistente
    );

    let assistantResponse =
      "I processed your request. Let me know if you need anything else!"; // Respuesta por defecto

    if (textMessage?.type === "text") {
      assistantResponse =
        typeof textMessage.content === "string"
          ? textMessage.content                                // Si es string, lo usa directamente
          : textMessage.content.map((c) => c.text).join("");   // Si es array, une los fragmentos de texto
    }

    // Update the assistant message with the response 
    // (this also sets status to completed)
    await step.run("update-assistant-message", async () => {
      await convex.mutation(api.system.updateMessageContent, {
        internalKey,
        messageId,
        content: assistantResponse,                             // Guarda la respuesta en la base de datos
      })
    });

    return { success: true, messageId, conversationId };        // Retorna éxito
  }
)