"use client";

import { useState } from "react";
import { Allotment } from "allotment";
import {
  Loader2Icon,
  TerminalSquareIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
} from "lucide-react";

import { useWebContainer } from "@/features/preview/hooks/use-webcontainer";
import { PreviewSettingsPopover } from "@/features/preview/components/preview-settings-popover";
import { PreviewTerminal } from "@/features/preview/components/preview-terminal";

import { Button } from "@/components/ui/button";

import { useProject } from "../hooks/use-projects";

import { Id } from "../../../../convex/_generated/dataModel";

/**
 * PROPÓSITO: Vista principal de previsualización que integra el motor de WebContainer,
 * la terminal de logs y los controles de configuración del entorno de ejecución.
 */
export const PreviewView = ({ projectId }: { projectId: Id<"projects"> }) => {
  const project = useProject(projectId);                                  // Cargamos los datos del proyecto (necesario para settings).
  const [showTerminal, setShowTerminal] = useState(true);                 // Estado para alternar la visibilidad de la terminal.

  // ENGANCHE AL MOTOR WEBCONTAINER
  const {
    status,
    previewUrl,
    error,
    restart,
    terminalOutput
  } = useWebContainer({
    projectId,
    enabled: true,
    settings: project?.settings,                                          // Pasamos los comandos de instalación/arranque de la BD.
  });

  const isLoading = status === "booting" || status === "installing";      // Simplificamos los estados de espera.

  return (
    <div className="h-full flex flex-col bg-background">
      {/* BARRA DE HERRAMIENTAS SUPERIOR */}
      <div className="h-8.75 flex items-center border-b bg-sidebar shrink-0">
        {/* BOTÓN: Reiniciar el contenedor */}
        <Button
          size="sm"
          variant="ghost"
          className="h-full rounded-none"
          disabled={isLoading}
          onClick={restart}
          title="Restart container"
        >
          <RefreshCwIcon className="size-3" />
        </Button>

        {/* INDICADOR DE ESTADO / BARRA DE URL */}
        <div className="flex-1 h-full flex items-center px-3 bg-background border-x text-xs text-muted-foreground truncate font-mono">
          {isLoading && (
            <div className="flex items-center gap-1.5">
              <Loader2Icon className="size-3 animate-spin" />
              {status === "booting" ? "Starting..." : "Installing..."}
            </div>
          )}

          {previewUrl && <span className="truncate">{previewUrl}</span>}

          {!isLoading && !previewUrl && !error && <span>Ready to preview</span>}
        </div>

        {/* BOTÓN: Alternar Terminal */}
        <Button
          size="sm"
          variant="ghost"
          className="h-full rounded-none"
          title="Toggle terminal"
          onClick={() => setShowTerminal((value) => !value)}
        >
          <TerminalSquareIcon className="size-3" />
        </Button>

        {/* POPOVER: Ajustes de Comandos (npm install, npm run dev...) */}
        <PreviewSettingsPopover
          projectId={projectId}
          initialValues={project?.settings}
          onSave={restart}
        />
      </div>

      {/* ÁREA DE CONTENIDO DIVIDIDA (PREVIEW / TERMINAL) */}
      <div className="flex-1 min-h-0">
        <Allotment vertical>
          {/* PAパネル SUPERIOR: Previsualización del sitio */}
          <Allotment.Pane>
            {/* MANEJO DE ERROR */}
            {error && (
              <div className="size-full flex items-center justify-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2 max-w-md mx-auto text-center">
                  <AlertTriangleIcon className="size-6" />
                  <p className="text-sm font-medium">{error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={restart}
                  >
                    <RefreshCwIcon className="size-4" />
                    Restart
                  </Button>
                </div>
              </div>
            )}

            {/* PANTALLA DE CARGA (Sin error) */}
            {isLoading && !error && (
              <div className="size-full flex items-center justify-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2 max-w-md mx-auto text-center">
                  <Loader2Icon className="size-6 animate-spin" />
                  <p className="text-sm font-medium">Installing...</p>
                </div>
              </div>
            )}

            {/* IFRAME: Donde ocurre la magia del WebContainer */}
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="size-full border-0"
                title="Preview"
              />
            )}
          </Allotment.Pane>

          {/* PANEL INFERIOR: Terminal de logs (Solo si está habilitada) */}
          {showTerminal && (
            <Allotment.Pane
              minSize={100}
              maxSize={500}
              preferredSize={200}
            >
              <div className="h-full flex flex-col bg-background border-t">
                <div className="h-7 flex items-center px-3 text-xs gap-1.5 text-muted-foreground border-b border-border/50 shrink-0">
                  <TerminalSquareIcon className="size-3" />
                  Terminal
                </div>
                {/* COMPONENTE XTERM.JS PARA VISUALIZACIÓN DE SALIDA */}
                <PreviewTerminal output={terminalOutput} />
              </div>
            </Allotment.Pane>
          )}
        </Allotment>
      </div>
    </div>
  );
};