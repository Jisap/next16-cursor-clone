import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./auth";



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
  }
})
