import { convex } from "@/lib/convex-client";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import z from "zod";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";



const requestSchema = z.object({
  conversationId: z.string(),
  message: z.string()
});




export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    return NextResponse.json(
      { error: "Internal key not found" },
      { status: 500 }
    )
  }

  const body = await request.json()

  const { conversationId, message } = requestSchema.parse(body);

  // Obtenemos la conversación desde la api de system (server) que se basa en "const convex = new ConvexHttpClient"
  // de uso exclusivo del servidor
  const conversation = await convex.query(api.system.getConversationById, {
    internalKey,
    conversationId: conversationId as Id<"conversations">
  })

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    )
  }

  // Desde la conversation obtenemos el projectId
  const projectId = conversation.projectId;

  // TODO: Check for processing messages

  // Con el projectId, el conversationId y el content(message) creamos el mensaje
  await convex.mutation(api.system.createMessage, {
    internalKey,
    conversationId: conversationId as Id<"conversations">,
    projectId,
    role: "user",
    content: message,
  });

  // Creamos un mensaje vacío para el asistente con estado "processing".
  // Esto permite que el frontend muestre inmediatamente un indicador de carga 
  // (spinner/animación) mientras la IA genera la respuesta real.
  const assistantMessageId = await convex.mutation(api.system.createMessage, {
    internalKey,
    conversationId: conversationId as Id<"conversations">,
    projectId,
    role: "assistant",
    content: "", // El contenido se actualizará más tarde mediante un job de Inngest
    status: "processing",
  });

  // TODO: invoke inngest to process the message

  return NextResponse.json({
    success: true,
    eventId: 0,
    messageId: assistantMessageId
  });

  // TODO invole Innges background jobs

}
