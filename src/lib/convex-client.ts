import { ConvexHttpClient } from "convex/browser";


export const convex = new ConvexHttpClient( // Permite comunicarte con la bd desde el servidor
  process.env.NEXT_PUBLIC_CONVEX_URL!,
)