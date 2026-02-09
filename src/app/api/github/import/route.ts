import { z } from "zod";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

import { convex } from "@/lib/convex-client";
import { inngest } from "@/inngest/client";

import { api } from "../../../../../convex/_generated/api";

const requestSchema = z.object({
  url: z.url(),
});

function parseGitHubUrl(url: string) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);                  // Validación de URL de GitHub
  if (!match) {
    throw new Error("Invalid GitHub URL");
  }

  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };          // Devuelve el owner y el repo
}


/**
 *  El endpoint no clona el código, sino que prepara el terreno 
 *  y le da el relevo a Inngest para que haga el trabajo pesado 
 *  en segundo plano
 */
export async function POST(request: Request) {
  const { userId, has } = await auth();                                           // Obtiene el ID del usuario autenticado (Clerk)

  if (!userId) {                                                             // Verifica si hay una sesión activa
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasPro = has({ plan: "pro" });

  if (!hasPro) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  const body = await request.json();                                         // Lee el cuerpo de la petición (JSON)
  const { url } = requestSchema.parse(body);                                 // Valida que sea una URL de GitHub válida

  const { owner, repo } = parseGitHubUrl(url);                               // Extrae el dueño y nombre del repo de la URL

  const client = await clerkClient();                                        // Inicializa el cliente administrativo de Clerk
  const tokens = await client.users.getUserOauthAccessToken(                 // Busca el token de acceso de GitHub del usuario
    userId,
    "github"
  );
  const githubToken = tokens.data[0]?.token;                                 // Extrae el token (necesario para leer repos privados)

  if (!githubToken) {                                                        // Si no hay token, el usuario debe reconectar GitHub
    return NextResponse.json(
      { error: "GitHub not connected. Please reconnect your GitHub account." },
      { status: 400 }
    );
  }

  const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;               // Obtiene la clave secreta de comunicación interna

  if (!internalKey) {                                                        // Error si falta la configuración en el servidor
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const projectId = await convex.mutation(api.system.createProject, {        // Crea el registro del proyecto en Convex (la "carcasa")
    internalKey,
    name: repo,
    ownerId: userId,
  });

  const event = await inngest.send({                                         // Dispara un evento de background hacia Inngest
    name: "github/import.repo",                                              // Nombre del evento que escuchará el worker
    data: {                                                                  // Datos necesarios para que el worker procese el clonado
      owner,
      repo,
      projectId,
      githubToken,
    },
  });

  return NextResponse.json({                                                 // Responde inmediatamente al frontend con éxito
    success: true,
    projectId,
    eventId: event.ids[0]                                                    // ID del evento para seguimiento
  });
};