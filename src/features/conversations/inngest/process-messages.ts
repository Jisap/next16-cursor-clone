import { inngest } from "@/inngest/client";
import { Id } from "../../../../convex/_generated/dataModel";
import { NonRetriableError } from "inngest";
import { convex } from "@/lib/convex-client";
import { api } from "../../../../convex/_generated/api";
import { CODING_AGENT_SYSTEM_PROMPT, TITLE_GENERATOR_SYSTEM_PROMPT } from "./constants";
import { DEFAULT_CONVERSATION_TITLE } from "../constants";
import { createAgent, openai } from "@inngest/agent-kit";
import { createReadFilesTool } from "./tools/read-files";


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
        //createListFilesTool({ internalKey, projectId }),
        // createUpdateFileTool({ internalKey }),
        // createCreateFilesTool({ projectId, internalKey }),
        // createCreateFolderTool({ projectId, internalKey }),
        // createRenameFileTool({ internalKey }),
        // createDeleteFilesTool({ internalKey }),
        // createScrapeUrlsTool(),
      ],
    });

    await step.run("update-assistant-message", async () => {
      await convex.mutation(api.system.updateMessageContent, {
        internalKey,
        messageId,
        content: "AI processed this message (TODO)",
      })
    })
  }
)