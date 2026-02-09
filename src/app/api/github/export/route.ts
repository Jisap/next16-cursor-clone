import { z } from "zod";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

import { inngest } from "@/inngest/client";

import { Id } from "../../../../../convex/_generated/dataModel";

const requestSchema = z.object({
  projectId: z.string(),
  repoName: z.string().min(1).max(100),
  visibility: z.enum(["public", "private"]).default("private"),
  description: z.string().max(350).optional(),
});


/**
 * Endpoint para exportar el proyecto actual a un nuevo repositorio de GitHub.
 * Al igual que el import, delega el trabajo pesado a Inngest en segundo plano.
 */
export async function POST(request: Request) {
  const { userId, has } = await auth();                                                    // Obtiene el ID del usuario autenticado (Clerk)

  if (!userId) {                                                                      // Verifica si hay una sesión activa
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasPro = has({ plan: "pro" });

  if (!hasPro) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  const body = await request.json();                                                  // Lee el cuerpo de la petición (JSON)
  const { projectId, repoName, visibility, description } = requestSchema.parse(body); // Valida los datos del nuevo repo

  const client = await clerkClient();                                                 // Inicializa el cliente administrativo de Clerk
  const tokens = await client.users.getUserOauthAccessToken(userId, "github");        // Busca el token de acceso de GitHub del usuario
  const githubToken = tokens.data[0]?.token;                                          // Extrae el token para poder crear el repo y subir archivos

  if (!githubToken) {                                                                 // Error si el usuario no tiene GitHub vinculado
    return NextResponse.json(
      { error: "GitHub not connected. Please reconnect your GitHub account." },
      { status: 400 }
    );
  }

  const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;                        // Obtiene la clave secreta de comunicación interna

  if (!internalKey) {                                                                 // Error de configuración del entorno
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const event = await inngest.send({                                                  // Dispara el evento de exportación hacia Inngest
    name: "github/export.repo",                                                       // El worker escuchará este evento "github/export.repo"
    data: {                                                                           // Datos necesarios para que el worker haga el push
      projectId,
      repoName,
      visibility,
      description,
      githubToken,
      internalKey,
    },
  });

  return NextResponse.json({                                                         // Responde inmediatamente con el ID del evento
    success: true,
    projectId,
    eventId: event.ids[0]
  });
};