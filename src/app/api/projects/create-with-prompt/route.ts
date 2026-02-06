import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

import { DEFAULT_CONVERSATION_TITLE } from "@/features/conversations/constants";

import { inngest } from "@/inngest/client";
import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";

const requestSchema = z.object({                                                   // Definición del esquema esperado en el cuerpo de la petición.
  prompt: z.string().min(1),                                                       // El prompt debe ser un string no vacío.
});

export async function POST(request: Request) {                                     // Handler para peticiones POST de creación de proyecto.
  const { userId } = await auth();                                                 // Intenta obtener el ID del usuario autenticado.

  if (!userId) {                                                                   // Si no hay usuario logueado...
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });          // Retorna un error de no autorizado 401.
  }

  const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;                     // Clave secreta para la comunicación segura con el backend.

  if (!internalKey) {                                                              // Si la clave no está configurada en el entorno...
    return NextResponse.json(
      { error: "Internal key not configured" },                                    // Retorna error de configuración del servidor 500.
      { status: 500 }
    );
  }

  const body = await request.json();                                               // Extrae el JSON del cuerpo de la petición.
  const { prompt } = requestSchema.parse(body);                                    // Valida el contenido usando el esquema de Zod.

  const projectName = uniqueNamesGenerator({                                       // Genera un nombre aleatorio como "adjetivo-animal-color".
    dictionaries: [adjectives, animals, colors],
    separator: "-",
    length: 3,
  });

  const { projectId, conversationId } = await convex.mutation(                     // Llama a Convex para crear el proyecto y el chat inicial.
    api.system.createProjectWithConversation,
    {
      internalKey,
      projectName,
      conversationTitle: DEFAULT_CONVERSATION_TITLE,
      ownerId: userId,
    },
  );

  await convex.mutation(api.system.createMessage, {                                // Registra el primer mensaje (el prompt del usuario) en la BD.
    internalKey,
    conversationId,
    projectId,
    role: "user",
    content: prompt,
  });

  const assistantMessageId = await convex.mutation(                                // Crea un "hueco" de mensaje para la IA con estado procesando.
    api.system.createMessage,
    {
      internalKey,
      conversationId,
      projectId,
      role: "assistant",
      content: "",                                                                 // El contenido se llenará cuando la IA responda.
      status: "processing",
    },
  );

  await inngest.send({                                                             // Envía el evento a Inngest para que la IA genere la respuesta.
    name: "message/sent",
    data: {
      messageId: assistantMessageId,                                               // ID del mensaje que la IA debe actualizar.
      conversationId,
      projectId,
      message: prompt,                                                             // Texto que la IA procesará.
    },
  });

  return NextResponse.json({ projectId });                                         // Devuelve el ID del proyecto recién creado al frontend.
};
