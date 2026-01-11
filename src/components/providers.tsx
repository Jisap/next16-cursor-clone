"use client"


import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ThemeProvider } from './theme-provider';

const convex = new ConvexReactClient( process.env.NEXT_PUBLIC_CONVEX_URL!);   // Instancia de conexión al backend

export const Providers = ({ children }: { children: React.ReactNode }) => {   // wrapper de providers: gestion de sesiones y conexion al backend
  return (
    <ClerkProvider >
      {/*  Permite que el cliente de Convex obtenga automáticamente el token de autenticación de Clerk en sus peticiones a la API */}
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}