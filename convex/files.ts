import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./auth";
import { Id } from "./_generated/dataModel";



export const getFiles = query({
  args: { projectId: v.id("projects")},
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project){
      throw new Error("Project not found")
    }

    if (project.ownerId !== identity.subject){
      throw new Error("Unauthorized")
    }

    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()
  }
});

export const getFile = query({
  args: { id: v.id("files")},
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);
    if (!file){
      throw new Error("File not found")
    }

    const project = await ctx.db.get("projects", file.projectId);
    if (!project){
      throw new Error("Project not found")
    }

    if (project.ownerId !== identity.subject){
      throw new Error("Unauthorized")
    }

    return file;
  }
});



// Obtiene el contenido de una carpeta específica dentro de un proyecto.
export const getFolderContent = query({
  args: { 
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")) 
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project) {
      throw new Error("Project not found")
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized")
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) => 
        q
          .eq("projectId", args.projectId)
          .eq("parentId", args.parentId)
      )
      .collect()

    // Sort: folders first, then files, alphabetically within each group
    return files.sort((a, b) => {
      // Folders come before files
      if(a.type === "folder" && b.type === "file") return -1
      if(a.type === "file" && b.type === "folder") return 1;
    
      //Within same type, sort alphabetically by name
      return a.name.localeCompare(b.name);
    })
  }
});

export const createFile = mutation({
  args: { 
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")) ,
    name: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project) {
      throw new Error("Project not found")
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized")
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) => 
        q
      .eq("projectId", args.projectId)
      .eq("parentId", args.parentId)
    )
    .collect();
  
    // Check if file with same name already exists in this parent folder
    const existing = files.find(
      (file) => file.name === args.name && file.type === "file"
    )

    if(existing) throw new Error("File already exists")

    await ctx.db.insert("files", {
      projectId: args.projectId,
      name: args.name,
      content: args.content,
      type: "file",
      parentId: args.parentId,
      updatedAt: Date.now(),
    })

    await ctx.db.patch("projects", args.projectId, {
      updatedAt: Date.now(),
    })
  }
});

export const createFolder = mutation({
  args: { 
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")) ,
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project) {
      throw new Error("Project not found")
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized")
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) => 
        q
      .eq("projectId", args.projectId)
      .eq("parentId", args.parentId)
    )
    .collect();
  
    // Check if folder with same name already exists in this parent folder
    const existing = files.find(
      (file) => file.name === args.name && file.type === "folder"
    )

    if(existing) throw new Error("Folder already exists")

    await ctx.db.insert("files", {
      projectId: args.projectId,
      name: args.name,
      type: "folder",
      parentId: args.parentId,
      updatedAt: Date.now(),
    })

    await ctx.db.patch("projects", args.projectId, {
      updatedAt: Date.now(),
    })
  }
});

export const renameFile = mutation({
  args: {
    id: v.id("files"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);
    if(!file) throw new Error("File not found")
    
    const project = await ctx.db.get("projects", file.projectId);
    if(!project) {
      throw new Error("Project not found")
    }

    if(project.ownerId !== identity.subject) {
      throw new Error("Project not found")
    }

    // Aquí obtienes todos los archivos y carpetas que viven en el mismo lugar (misma carpeta padre)
    // que el archivo que estás intentando renombrar. Es decir, traes a todos sus "hermanos". 
    const siblings = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) => 
        q
        .eq("projectId", file.projectId)
        .eq("parentId", file.parentId)
    )
    .collect();

    // Aqui se recorre la lista de hermanos
    const existing = siblings.find(               // Buscamos en la lista
      (sibling) =>                                // un hermano
        sibling.name === args.newName &&          // cuyo nombre === args.newName
        sibling.type === file.type &&             // y que sea del mismo tipo
        sibling._id !== args.id                   // y que no sea el mismo archivo
      )

    if(existing) {                                // Si existe lanzamos error 
      throw new Error(
        `A ${file.type} with this name already exists in this folder`
      )
    }

    // Si no existe un hermano con el nombre de los args se actualiza el file que queremos renombar
    await ctx.db.patch("files", args.id, {
      name: args.newName,
      updatedAt: Date.now(),
    })

    await ctx.db.patch("projects", file.projectId, {
      updatedAt: Date.now(),
    })
  }
});


export const deleteFile = mutation({
  args: {
    id: v.id("files"),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);
    if(!file) throw new Error("File not found")
    
    const project = await ctx.db.get("projects", file.projectId);
    if(!project) {
      throw new Error("Project not found")
    }

    if(project.ownerId !== identity.subject) {
      throw new Error("Project not found")
    }

    // Recursively delete file/folder and all descendants
    const deleteRecursive = async(fileId: Id<"files">) => {
      const item = await ctx.db.get("files", fileId);            // Obtiene el archivo o carpeta en bd
      if(!item) return

      //If it's a folder, delete all children first
      if(item.type === "folder") {                               // Si es una carpeta 
        const children = await ctx.db                            // Busca todos los archivos que tienen como parentId el id de esta carpeta
          .query("files")
          .withIndex("by_project_parent", (q) => 
            q
            .eq("projectId", item.projectId)
            .eq("parentId", fileId)
          )
          .collect()

          for(const child of children) {                        // Recorre esta lista de hijos y se llama asi misma para cada uno de ellos
            await deleteRecursive(child._id)                    // Esto asegura que lleguemos hasta el nivel más profundo del árbol de archivos antes de empezar a borrar.
          }
        }

        // Delete storage file if it exists
        if(item.storageId) {
          await ctx.storage.delete(item.storageId)
        }

        // Delete the file/folder itself
        await ctx.db.delete("files", fileId)
    
    }

    await deleteRecursive(args.id);

    await ctx.db.patch("projects", file.projectId, {
      updatedAt: Date.now(),
    })
  }
})

/**
 * Si intentas borrar la "Carpeta A":

    1º deleteFile("Carpeta A") llama a deleteRecursive("Carpeta A").
    2º Detecta que es carpeta y busca hijos. Encuentra "Archivo B".
    3º Llama a deleteRecursive("Archivo B").
        . "Archivo B" no es carpeta.
        . Borra "Archivo B" del Storage (si tiene contenido).
        . Borra "Archivo B" de la base de datos.
    4º Vuelve a "Carpeta A". Ya no tiene hijos pendientes.
    5º Borra "Carpeta A" de la base de datos.
 */

export const updateFile = mutation({
  args: {
    id: v.id("files"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);
    if (!file) throw new Error("File not found")

    const project = await ctx.db.get("projects", file.projectId);
    if (!project) {
      throw new Error("Project not found")
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Project not found")
    }

    const now = Date.now();
    
    await ctx.db.patch("files", args.id, {
      content: args.content,
      updatedAt: now,
    });

    await ctx.db.patch("projects", file.projectId, {
      updatedAt: now,
    })
  },
})
