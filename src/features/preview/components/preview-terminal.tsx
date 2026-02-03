"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

import "@xterm/xterm/css/xterm.css";

interface PreviewTerminalProps {
  output: string;                                                         // El acumulado de texto enviado desde el WebContainer.
}

/**
 * PROPÓSITO: Proporciona una interfaz de terminal visual de alto rendimiento dentro del navegador.
 * Utiliza xterm.js para renderizar los logs del WebContainer con soporte para colores ANSI 
 * y redimensionamiento automático.
 */
export const PreviewTerminal = ({ output }: PreviewTerminalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);                      // Referencia al contenedor HTML donde se inyectará la terminal.
  const terminalRef = useRef<Terminal | null>(null);                      // Referencia a la instancia de la terminal xterm.
  const fitAddonRef = useRef<FitAddon | null>(null);                      // Referencia al addon para ajustar el tamaño automáticamente.
  const lastLengthRef = useRef(0);                                        // Rastrea el último punto de escritura para evitar redundancias.

  /**
   * EFECTO: Inicialización de la terminal xterm.js y sus complementos.
   */
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;             // 1. Evitamos doble inicialización.

    const terminal = new Terminal({                                       // 2. Configuramos la estética y comportamiento básico.
      convertEol: true,                                                   //    - Convierte los saltos de línea automáticamente.
      disableStdin: true,                                                 //    - Terminal de solo lectura (logs).
      fontSize: 12,
      fontFamily: "monospace",
      theme: { background: "#1f2228" },                                   //    - Color de fondo estilo editor moderno.
    });

    const fitAddon = new FitAddon();                                      // 3. Inicializamos el addon de auto-ajuste.
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);                                  // 4. "Abrimos" la terminal en el DOM.

    terminalRef.current = terminal;                                       // 5. Guardamos las referencias.
    fitAddonRef.current = fitAddon;

    // Escribimos el contenido inicial si lo hubiera (ej: al montar de nuevo)
    if (output) {
      terminal.write(output);
      lastLengthRef.current = output.length;
    }

    requestAnimationFrame(() => fitAddon.fit());                         // 6. Ajustamos el tamaño en el siguiente frame de renderizado.

    // Observador para cambios de tamaño manuales del contenedor UI
    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(containerRef.current);

    return () => {                                                        // 7. Limpieza al desmontar el componente.
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  /**
   * EFECTO: Actualización incremental de la salida de terminal.
   * Optimizado para escribir solo los fragmentos nuevos de texto.
   */
  useEffect(() => {
    if (!terminalRef.current) return;

    // Si la cadena de salida se acorta (ej: limpieza de terminal), reseteamos xterm.
    if (output.length < lastLengthRef.current) {
      terminalRef.current.clear();
      lastLengthRef.current = 0;
    }

    // Calculamos solo el fragmento de texto nuevo para inyectarlo en la terminal.
    const newData = output.slice(lastLengthRef.current);
    if (newData) {
      terminalRef.current.write(newData);                                 // Escribimos en el buffer de xterm.
      lastLengthRef.current = output.length;                              // Actualizamos el puntero de longitud.
    }
  }, [output]);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 p-3 [&_.xterm]:h-full! [&_.xterm-viewport]:h-full! [&_.xterm-screen]:h-full! bg-sidebar"
    />
  );
};