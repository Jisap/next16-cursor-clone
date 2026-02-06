"use client";

import { useEffect, useState } from "react";
import ky from "ky";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";

import { Id } from "../../../../convex/_generated/dataModel";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewProjectDialog = ({
  open,
  onOpenChange,
}: NewProjectDialogProps) => {
  const router = useRouter();                                                      // Hook para la navegación.
  const [input, setInput] = useState("");                                          // Estado para el prompt del usuario.
  const [isSubmitting, setIsSubmitting] = useState(false);                         // Estado de carga para la petición.

  const handleSubmit = async (message: PromptInputMessage) => {                    // Procesa la creación del proyecto.
    if (!message.text) return;                                                     // Evita peticiones vacías.

    setIsSubmitting(true);                                                         // Inicia el estado de carga.

    try {
      const { projectId } = await ky                                               // Llamada a la API de creación.
        .post("/api/projects/create-with-prompt", {
          json: { prompt: message.text.trim() },                                   // Envía el prompt validado.
        })
        .json<{ projectId: Id<"projects"> }>();                                    // Espera el ID del nuevo proyecto.

      toast.success("Project created");                                            // Muestra notificación de éxito.
      onOpenChange(false);                                                         // Cierra el modal.
      setInput("");                                                                // Limpia el input.
      router.push(`/projects/${projectId}`);                                       // Redirige al IDE con el nuevo proyecto.
    } catch {
      toast.error("Unable to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg p-0"
      >
        <DialogHeader className="hidden">
          <DialogTitle>What do you want to build?</DialogTitle>
          <DialogDescription>
            Describe your project and AI will help you create it.
          </DialogDescription>
        </DialogHeader>

        {/* Componente gestionador de entrada de texto */}
        <PromptInput
          onSubmit={handleSubmit}
          className="border-none!"
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Ask Polaris to build..."
              onChange={(e) => setInput(e.target.value)}
              value={input}
              disabled={isSubmitting}                                              // Bloquea edición mientras envía.
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit disabled={!input || isSubmitting} />                {/* Botón dinámico según el estado */}
          </PromptInputFooter>
        </PromptInput>
      </DialogContent>
    </Dialog>
  );
};