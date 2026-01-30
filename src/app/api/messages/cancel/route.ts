import { inngest } from "@/inngest/client";
import { convex } from "@/lib/convex-client";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import z from "zod";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel"



const requestSchema = z.object({
  projectId: z.string(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId } = requestSchema.parse(body);

  const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY!;
  if (!internalKey) {
    return NextResponse.json(
      { error: "Internal key not found" },
      { status: 500 }
    );
  }

  // Find all processing messages in this project
  const proccessingMessages = await convex.query(
    api.system.getProccessingMessages,
    {
      internalKey,
      projectId: projectId as Id<"projects">
    }
  );

  // Si no existen mensajes en estado processing devolvemos true
  if (proccessingMessages.length === 0) {
    return NextResponse.json({
      success: true,
      cancelled: false,
    });
  }

  // Cancel all processing messages
  const cancelledIds = await Promise.all(
    proccessingMessages.map(async (msg) => {
      await inngest.send({
        name: "message/cancel",
        data: {
          messageId: msg._id // <--- Este llega como "event.data.messageId"
        }
      })

      await convex.mutation(api.system.updateMessageStatus, {
        internalKey,
        messageId: msg._id,
        status: "cancelled"
      });

      return msg._id
    })
  );

  return NextResponse.json({
    success: true,
    cancelled: true,
    messagesIds: cancelledIds,
  });
}



