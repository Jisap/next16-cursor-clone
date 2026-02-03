import { useCallback, useEffect, useRef, useState } from "react";
import { WebContainer } from "@webcontainer/api";

import {
  buildFileTree,
  getFilePath
} from "@/features/preview/utils/file-tree";
import { useFiles } from "@/features/projects/hooks/use-files";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

// Instancias de Singleton para evitar 
// múltiples arranques del contenedor
let webcontainerInstance: WebContainer | null = null;                   // Almacena la instancia única del WebContainer.
let bootPromise: Promise<WebContainer> | null = null;                   // Promesa para manejar el estado de arranque global.

/**
 * PROPÓSITO: Obtiene o inicializa la instancia única de WebContainer.
 * Asegura que solo exista un motor de Node.js corriendo en la pestaña del navegador.
 */
const getWebContainer = async (): Promise<WebContainer> => {
  if (webcontainerInstance) {                                           // 1. Si ya existe la instancia, la devolvemos.
    return webcontainerInstance;
  }

  if (!bootPromise) {                                                   // 2. Si no ha empezado el arranque, lo iniciamos.
    bootPromise = WebContainer.boot({ coep: "credentialless" });
  }

  webcontainerInstance = await bootPromise;                             // 3. Esperamos a que el arranque termine.
  return webcontainerInstance;                                          // 4. Retornamos la instancia lista para usar.
};

/**
 * PROPÓSITO: Limpia y detiene la instancia actual del WebContainer.
 * Útil para liberar memoria o reiniciar el entorno desde cero.
 */
const teardownWebContainer = () => {
  if (webcontainerInstance) {                                           // 1. Si hay una instancia activa:
    webcontainerInstance.teardown();                                    //    a. Llamamos al método de destrucción de la API.
    webcontainerInstance = null;                                        //    b. Limpiamos la referencia.
  }
  bootPromise = null;                                                   // 2. Reseteamos la promesa de arranque.
};

interface UseWebContainerProps {
  projectId: Id<"projects">;
  enabled: boolean;
  settings?: {
    installCommand?: string;
    devCommand?: string;
  };
};

/**
 * PROPÓSITO: Hook principal para gestionar el ciclo de vida del WebContainer dentro de un componente.
 * Maneja el arranque, instalación de dependencias, ejecución de scripts y hot-reload de archivos.
 */
export const useWebContainer = ({
  projectId,
  enabled,
  settings,
}: UseWebContainerProps) => {
  // ESTADOS DE LA MÁQUINA VIRTUAL
  const [status, setStatus] = useState<
    "idle" | "booting" | "installing" | "running" | "error"
  >("idle");                                                            // Estado actual del proceso (booting -> installing -> running).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);    // URL generada para el iframe de previsualización.
  const [error, setError] = useState<string | null>(null);              // Almacena mensajes de error si algo falla.
  const [restartKey, setRestartKey] = useState(0);                      // Clave para forzar el reinicio del efecto principal.
  const [terminalOutput, setTerminalOutput] = useState("");             // Acumulado de logs para mostrar en la terminal UI.

  const containerRef = useRef<WebContainer | null>(null);               // Referencia local a la instancia del contenedor.
  const hasStartedRef = useRef(false);                                  // Flag para evitar múltiples ejecuciones del proceso de inicio.

  // Suscripción en tiempo real a los archivos del proyecto en Convex
  const files = useFiles(projectId);

  /**
   * EFECTO: Orquestador del arranque, montaje y comandos iniciales.
   */
  useEffect(() => {
    // Verificamos si podemos iniciar el contenedor
    if (!enabled || !files || files.length === 0 || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;                                       // Marcamos como iniciado para evitar bucles.

    const start = async () => {
      try {
        setStatus("booting");                                           // Pasamos a estado de arranque.
        setError(null);
        setTerminalOutput("");

        const appendOutput = (data: string) => {                        // Función auxiliar para escribir en la terminal virtual.
          setTerminalOutput((prev) => prev + data);
        };

        const container = await getWebContainer();                      // Obtenemos el motor de Node.js.
        containerRef.current = container;                               // Guardamos la referencia.

        const fileTree = buildFileTree(files);                          // Convertimos los archivos de Convex al árbol del contenedor.
        await container.mount(fileTree);                                // "Cargamos" el disco duro virtual.

        // Escuchamos cuando el servidor interno (ej. Vite/Next) esté listo
        container.on("server-ready", (_port, url) => {
          setPreviewUrl(url);                                           // Guardamos la URL de previsualización.
          setStatus("running");                                         // La aplicación ya está en marcha.
        });

        setStatus("installing");                                        // Pasamos a instalar dependencias.

        // EJECUCIÓN DEL COMANDO DE INSTALACIÓN
        const installCmd = settings?.installCommand || "npm install";
        const [installBin, ...installArgs] = installCmd.split(" ");
        appendOutput(`$ ${installCmd}\n`)
        const installProcess = await container.spawn(installBin, installArgs); // Lanzamos el proceso (ej: npm).
        installProcess.output.pipeTo(                                   // Redirigimos la salida del proceso a nuestra terminal UI.
          new WritableStream({
            write(data) {
              appendOutput(data);
            },
          })
        );
        const installExitCode = await installProcess.exit;              // Esperamos a que termine la instalación.

        if (installExitCode !== 0) {                                    // Si el código no es 0, hubo un error.
          throw new Error(
            `${installCmd} failed with code ${installExitCode}`
          );
        }

        // EJECUCIÓN DEL COMANDO DE DESARROLLO
        const devCmd = settings?.devCommand || "npm run dev";
        const [devBin, ...devArgs] = devCmd.split(" ");
        appendOutput(`\n$ ${devCmd}\n`);
        const devProcess = await container.spawn(devBin, devArgs);      // Lanzamos el servidor de desarrollo.
        devProcess.output.pipeTo(                                       // Redirigimos sus logs a la terminal.
          new WritableStream({
            write(data) {
              appendOutput(data);
            },
          })
        );
      } catch (error) {
        setError(error instanceof Error ? error.message : "Unknown error");
        setStatus("error");                                             // Capturamos cualquier fallo en el proceso.
      }
    };

    start();
  }, [
    enabled,
    files,
    restartKey,
    settings?.devCommand,
    settings?.installCommand,
  ]);

  /**
   * EFECTO: Sincronización de archivos (HOT-RELOAD).
   * Cuando un archivo cambia en la BD, lo escribimos inmediatamente en el contenedor.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !files || status !== "running") return;           // Solo sincronizamos si el contenedor está en marcha.

    const filesMap = new Map(files.map((f) => [f._id, f]));             // Creamos un mapa para búsqueda rápida de archivos por ID.

    for (const file of files) {                                         // Iteramos sobre todos los archivos del proyecto.
      if (file.type !== "file" || file.storageId || !file.content) continue; // Saltamos si no es un archivo o no tiene contenido.

      const filePath = getFilePath(file, filesMap);                     // Obtenemos la ruta absoluta en el contenedor.
      container.fs.writeFile(filePath, file.content);                   // Sobrescribimos el archivo (lanza el HMR del framework).
    }
  }, [files, status]);

  /**
   * EFECTO: Limpieza de estado cuando se deshabilita la previsualización.
   */
  useEffect(() => {
    if (!enabled) {
      hasStartedRef.current = false;
      setStatus("idle");
      setPreviewUrl(null);
      setError(null);
    }
  }, [enabled]);

  /**
   * PROPÓSITO: Reiniciar todo el proceso del WebContainer.
   * Destruye la instancia actual y fuerza un nuevo arranque desde cero.
   */
  const restart = useCallback(() => {
    teardownWebContainer();                                              // Detenemos el motor actual.
    containerRef.current = null;
    hasStartedRef.current = false;
    setStatus("idle");
    setPreviewUrl(null);
    setError(null);
    setRestartKey((k) => k + 1);                                         // Cambiamos la clave para disparar el useEffect principal.
  }, []);

  return {
    status,
    previewUrl,
    error,
    restart,
    terminalOutput,
  };
};