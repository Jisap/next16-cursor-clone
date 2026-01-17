import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";




export const useProjects = () => {
  return useQuery(api.projects.get);
}

export const useProjectsPartial = (limit:number) => {
  return useQuery(api.projects.getPartial, {
    limit,
  });
};



// Usamos la actualización optimista donde se crea un objeto 
// para mostrarlo automaticamente y luego cuando convex detecta 
// la creación del objeto real lo sustituye en lugar del ficticio.
export const useCreateProject = () => {

  return useMutation(api.projects.create).withOptimisticUpdate(          // 1. useMutation prepara la llamada a la fn del backend "create"
    (localStore, args) => {                                              // 2. Obtiene el estado actual
      const existingProjects = localStore.getQuery(api.projects.get);        // Busca en la caché local los datos de la consulta

      if(existingProjects !== undefined){                                // 3. Solo procedemos si la lista de proyectos esta cargada en memoria
        const now = Date.now();                                              // Si si lo esta cargada obtenemos la fecha actual
        const newProject = {                                                 // y se la aplicamos al objeto temporal (optimista)
          _id: crypto.randomUUID() as Id<"projects">,                             // Con id random
          _creationTime: now,                                                     // Fecha del sistema
          name: args.name,                                                        // Nombre del proyecto según args
          ownerId: "anonymous",                                                   // propietario anónimo 
          updatedAt: now                                                          // Fecha de actualización del sistema
        }

        localStore.setQuery(api.projects.get, {}, [                      // 4. Actualizamos la caché local 
          newProject,                                                    // Con el nuevo proyecto
          ...existingProjects,
        ])
      }
    }
  )
}
