"use client"


import { ClerkProvider, SignInButton, SignUpButton, useAuth, UserButton } from '@clerk/nextjs';
import { Authenticated, AuthLoading, ConvexReactClient, Unauthenticated } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ThemeProvider } from './theme-provider';
import { UnauthenticatedView } from '@/features/auth/components/unathenticated-view';
import { AuthLoadingView } from '@/features/auth/components/auth-loading-view';

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
          {/* <Authenticated>
            <UserButton />
            {children}
          </Authenticated> */}
          {children}

          <Unauthenticated>
            <UnauthenticatedView />
          </Unauthenticated>

          <AuthLoading>
            <AuthLoadingView />
          </AuthLoading>
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}