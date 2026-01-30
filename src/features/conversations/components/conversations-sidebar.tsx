"use client"

import ky from "ky"
import { toast } from "sonner";
import { useState } from "react";
import {
  CopyIcon,
  HistoryIcon,
  LoaderIcon,
  PlusIcon
} from "lucide-react"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton
} from "@/components/ai-elements/conversation";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useMessages
} from "../hooks/use-conversations";
import { DEFAULT_CONVERSATION_TITLE } from "../../../../convex/constants";



interface ConversationSidebarProps {
  projectId: Id<"projects">;
}

export const ConversationsSidebar = ({ projectId }: ConversationSidebarProps) => {

  const [input, setInput] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(null);
  const createConversation = useCreateConversation();              // Hook para crear una conversación
  const conversations = useConversations(projectId);               // Hook para obtener las conversaciones

  const activeConversationId =                                     // Si hay una conversación seleccionada, se usa esa, si no, se usa la primera conversación de la lista, si no hay conversaciones, se usa null
    selectedConversationId ?? conversations?.[0]?._id ?? null;

  const activeConversation = useConversation(activeConversationId); // Hook para obtener la conversación activa

  const conversationMessages = useMessages(activeConversationId);   // Hook para obtener los mensajes de la conversación activa

  const isProcessing = conversationMessages?.some(
    (msg) => msg.status === "processing"
  );

  const handleCancel = async () => {
    try {
      await ky.post("/api/messages/cancel", {
        json: {
          projectId,
        }
      })
    } catch (error) {
      console.error(error);
      toast.error("Unable to cancel message")
    }
  }

  const handleCreateConversation = async () => {
    try {
      const newConversationId = await createConversation({
        projectId,
        title: DEFAULT_CONVERSATION_TITLE,
      });

      setSelectedConversationId(newConversationId);

      return newConversationId;
    } catch (error) {
      console.error(error);
      toast.error("Unable to create new conversation")
      return null;
    }
  }

  const handleSubmit = async (message: PromptInputMessage) => {
    // If processing and no new message this is just a stop function
    if (isProcessing && !message.text) {
      await handleCancel()
      setInput("")
      return
    }

    // If user not click on + icon and write a message.
    let conversationId = activeConversationId;

    if (!conversationId) {
      conversationId = await handleCreateConversation();
      if (!conversationId) {
        return;
      }
    }

    // Trigger Innges function via API
    try {
      await ky.post("/api/messages", {
        json: {
          conversationId,
          message: message.text // El texto del mensaje viene del PromptInputTextarea -> route.ts -> inggest (processMessage) -> respuesta
        }
      })
    } catch (error) {
      toast.error("Message failed to send")
    }

    setInput("")
  }

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="h-[35px] flex items-center justify-between border-b">
        <div className="text-sm truncate pl-3">
          {activeConversation?.title ?? DEFAULT_CONVERSATION_TITLE}
        </div>

        <div className="flex items-center px-1 gap-1">
          <Button
            size="icon-xs"
            variant="highlight"
          >
            <HistoryIcon className="size-3.5" />
          </Button>

          <Button
            size="icon-xs"
            variant="highlight"
            onClick={handleCreateConversation}
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <Conversation className="flex-1">
        <ConversationContent>
          {conversationMessages?.map((message, messageIndex) => (
            <Message
              key={message._id}
              from={message.role}
            >
              <MessageContent>
                {message.status === "processing" ? (
                  <div className="flex items-centergap-2 text-muted-foreground">
                    <LoaderIcon className="size-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                ) : (
                  <MessageResponse>
                    {message.content}
                  </MessageResponse>
                )}
              </MessageContent>

              {
                message.role === "assistant" &&
                message.status === "completed" &&
                messageIndex === (conversationMessages?.length ?? 0) - 1 &&
                (
                  <MessageActions>
                    <MessageAction
                      onClick={() => {
                        navigator.clipboard.writeText(message.content)
                      }}
                      label="Copy"
                    >
                      <CopyIcon className="size-3" />
                    </MessageAction>
                  </MessageActions>
                )
              }
            </Message>
          ))}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      <div className="p-3">
        <PromptInput
          onSubmit={handleSubmit}
          className="mt-2 rounded-full"
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Ask Polaris anything..."
              onChange={(e) => setInput(e.target.value)}
              value={input}
              disabled={isProcessing}
            />
          </PromptInputBody>

          <PromptInputFooter>
            <PromptInputTools />

            <PromptInputSubmit
              disabled={isProcessing ? false : !input}
              status={isProcessing ? "streaming" : undefined}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
