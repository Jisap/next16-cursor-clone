import { v } from "convex/values";
import { mutation, query } from "./_generated/server";


/**
 * Estas funciones están diseñadas para que el Agente de IA (Polaris)
 *  pueda manipular archivos a través de Inngest.
 */

// Compara la clave de los argumentos (cliente) con la clave del entorno (servidor backend de convex)
const validateInternalKey = (key: string) => {

  const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    throw new Error("Internal key not found");
  }

  if (key !== internalKey) {
    throw new Error("Invalid internal key");
  }
}



export const getConversationById = query({
  args: {
    conversationId: v.id("conversations"),
    internalKey: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);
    const conversation = await ctx.db.get(args.conversationId)
    return conversation
  }
});

export const createMessage = mutation({
  args: {
    internalKey: v.string(),
    conversationId: v.id("conversations"),
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.optional(
      v.union(
        v.literal("processing"),
        v.literal("completed"),
        v.literal("cancelled")
      )
    )
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      projectId: args.projectId,
      role: args.role,
      content: args.content,
      status: args.status,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
    });

    return messageId;
  }
});

export const updateMessageContent = mutation({
  args: {
    internalKey: v.string(),
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);
    await ctx.db.patch(args.messageId, {
      content: args.content,
      status: "completed",
    });
  }
});

export const getProccessingMessages = query({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    return await ctx.db
      .query("messages")
      .withIndex("by_project_status", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("status", "processing")
      )
      .collect();
  }
})


export const updateMessageStatus = mutation({
  args: {
    internalKey: v.string(),
    messageId: v.id("messages"),
    status: v.optional(
      v.union(
        v.literal("processing"),
        v.literal("completed"),
        v.literal("cancelled")
      )
    )
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);
    await ctx.db.patch(args.messageId, {
      status: args.status,
    });
  }
});

// Used for Agent conversation context
export const getRecentMessages = query({
  args: {
    internalKey: v.string(),
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    const limit = args.limit ?? 10;
    return messages.slice(-limit);
  },
});

// Used for Agent to update conversation title
export const updateConversationTitle = mutation({
  args: {
    internalKey: v.string(),
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

// Used for Agent "ListFiles" tool
export const getProjectFiles = query({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Used for Agent "ReadFiles" tool
export const getFileById = query({
  args: {
    internalKey: v.string(),
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    return await ctx.db.get(args.fileId);
  },
});

// Used for Agent "UpdateFile" tool
export const updateFile = mutation({
  args: {
    internalKey: v.string(),
    fileId: v.id("files"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const file = await ctx.db.get(args.fileId);

    if (!file) {
      throw new Error("File not found");
    }

    await ctx.db.patch(args.fileId, {
      content: args.content,
      updatedAt: Date.now(),
    });

    return args.fileId;
  },
});

// Used for Agent "CreateFile" tool
export const createFile = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    content: v.string(),
    parentId: v.optional(v.id("files")),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>                              // Usa el índice que creamos específicamente para organizar archivos por proyecto y carpeta padre.
        q.eq("projectId", args.projectId).eq("parentId", args.parentId)   // Filtra para que solo nos devuelva los archivos que están dentro de la carpeta que le indicamos (el parentId).
      )
      .collect();

    const existing = files.find(
      (file) => file.name === args.name && file.type === "file"
    );

    if (existing) {
      throw new Error("File already exists");
    }

    const fileId = await ctx.db.insert("files", {
      projectId: args.projectId,
      name: args.name,
      content: args.content,
      type: "file",
      parentId: args.parentId,
      updatedAt: Date.now(),
    });

    return fileId;
  },
});

// Permite que el agente de IA cree múltiples archivos a la vez.
export const createFiles = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    files: v.array( // Recibe un array de objetos con el nombre y contenido del archivo.
      v.object({
        name: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const existingFiles = await ctx.db                                        // 1º Busca todos los archivos que existen en la carpeta actual (parentId) y que pertenecen al proyecto (projectId).
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId)
      )
      .collect();

    const results: { name: string; fileId: string; error?: string }[] = [];

    for (const file of args.files) {                                          // 2º Itera sobre cada archivo que el agente quiere crear y comprueba
      const existing = existingFiles.find(                                    // si ya existe un archivo con el mismo nombre en esa carpeta.
        (f) => f.name === file.name && f.type === "file"
      );

      if (existing) {                                                         // Si existe, lo añade al array de resultados con un mensaje de error.
        results.push({
          name: file.name,
          fileId: existing._id,
          error: "File already exists",
        });
        continue;
      }

      const fileId = await ctx.db.insert("files", {                           // Si no existe, crea el archivo y lo añade al array de resultados.
        projectId: args.projectId,
        name: file.name,
        content: file.content,
        type: "file",
        parentId: args.parentId,
        updatedAt: Date.now(),
      });

      results.push({ name: file.name, fileId });                              // 3º Devuelve el array de resultados.
    }

    return results;
  },
});

// Used for Agent "CreateFolder" tool
export const createFolder = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    parentId: v.optional(v.id("files")),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const files = await ctx.db                                                // 1º Obtiene todos los archivos/carpetas que están en el mismo proyecto y en el mismo directorio padre.
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId)
      )
      .collect();

    const existing = files.find(                                             // 2º Comprueba si ya existe una carpeta con el mismo nombre en esa ubicación.
      (file) => file.name === args.name && file.type === "folder"
    );

    if (existing) {                                                          // Si existe, lanza un error.
      throw new Error("Folder already exists");
    }

    const fileId = await ctx.db.insert("files", {                            // Si no existe, crea la carpeta.
      projectId: args.projectId,
      name: args.name,
      type: "folder",
      parentId: args.parentId,
      updatedAt: Date.now(),
    });

    return fileId;
  },
});

// Used for Agent "RenameFile" tool
export const renameFile = mutation({
  args: {
    internalKey: v.string(),
    fileId: v.id("files"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Check if a file with the new name already exists in the same parent folder
    const siblings = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", file.projectId).eq("parentId", file.parentId)
      )
      .collect();

    const existing = siblings.find(
      (sibling) =>
        sibling.name === args.newName &&
        sibling.type === file.type &&
        sibling._id !== args.fileId
    );

    if (existing) {
      throw new Error(`A ${file.type} named "${args.newName}" already exists`);
    }

    await ctx.db.patch(args.fileId, {
      name: args.newName,
      updatedAt: Date.now(),
    });

    return args.fileId;
  },
});

// Used for Agent "DeleteFile" tool
export const deleteFile = mutation({
  args: {
    internalKey: v.string(),
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Recursively delete file/folder and all descendants
    const deleteRecursive = async (fileId: typeof args.fileId) => {
      const item = await ctx.db.get(fileId);

      if (!item) {
        return;
      }

      // If it's a folder, delete all children first
      if (item.type === "folder") {
        const children = await ctx.db
          .query("files")
          .withIndex("by_project_parent", (q) =>
            q.eq("projectId", item.projectId).eq("parentId", fileId)
          )
          .collect();

        for (const child of children) {
          await deleteRecursive(child._id);
        }
      }

      // Delete storage file if it exists
      if (item.storageId) {
        await ctx.storage.delete(item.storageId);
      }

      // Delete the file/folder itself
      await ctx.db.delete(fileId);
    };

    await deleteRecursive(args.fileId);

    return args.fileId;
  },
});


// Elimina masivamente todos los archivos de un proyecto
// cuando se importa desde github un proyecto nuevo.
export const cleanup = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const file of files) {
      // Delete storage file if it exists
      if (file.storageId) {
        await ctx.storage.delete(file.storageId);
      }

      await ctx.db.delete(file._id);
    }

    return { deleted: files.length };
  },
});

// Genera una URL de subida para un archivo a Convex Storage
export const generateUploadUrl = mutation({
  args: {
    internalKey: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);
    return await ctx.storage.generateUploadUrl();
  },
});


// Gestiona archivos que no son de texto plano 
// (como imágenes, archivos PDF, ejecutables, fuentes, etc.)
export const createBinaryFile = mutation({
  args: {
    internalKey: v.string(),                   // Clave de validación para seguridad
    projectId: v.id("projects"),               // ID del proyecto donde se creará el archivo
    name: v.string(),                          // Nombre con el que se verá en el explorador
    storageId: v.id("_storage"),               // Referencia al archivo físico en Convex Storage
    parentId: v.optional(v.id("files")),       // ID de la carpeta contenedora si existe
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);     // Valida la identidad de la petición

    const files = await ctx.db                 // Busca archivos en la carpeta de destino
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId)
      )
      .collect();

    const existing = files.find(               // Verifica si el nombre ya está en uso
      (file) => file.name === args.name && file.type === "file"
    );

    if (existing) {                            // Evita crear duplicados en el mismo nivel
      throw new Error("File already exists");
    }

    const fileId = await ctx.db.insert("files", { // Registra el archivo en el explorador
      projectId: args.projectId,
      name: args.name,
      type: "file",                            // Define el tipo como archivo (no carpeta)
      storageId: args.storageId,               // Enlaza con el contenido binario/storage
      parentId: args.parentId,
      updatedAt: Date.now(),                   // Marca la fecha de creación actual
    });

    return fileId;                             // Devuelve el ID del nuevo recurso creado
  },
});

// Actualiza el estado de importación de un proyecto
export const updateImportStatus = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    status: v.optional(
      v.union(
        v.literal("importing"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    await ctx.db.patch("projects", args.projectId, {
      importStatus: args.status,
      updatedAt: Date.now(),
    });
  },
});

// Actualiza el estado de exportación de un proyecto a github
export const updateExportStatus = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    status: v.optional(
      v.union(
        v.literal("exporting"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled")
      )
    ),
    repoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    await ctx.db.patch("projects", args.projectId, {
      exportStatus: args.status,
      exportRepoUrl: args.repoUrl,
      updatedAt: Date.now(),
    });
  },
});

// Obtiene todos los archivos de un proyecto con sus URLs de Convex Storage
export const getProjectFilesWithUrls = query({
  args: {
    internalKey: v.string(),                         // Clave de seguridad para validar el acceso
    projectId: v.id("projects"),                     // ID del proyecto cuyos archivos queremos listar
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);           // Verifica la identidad de la petición

    const files = await ctx.db                       // Obtiene todos los archivos asociados al proyecto
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return await Promise.all(                        // Procesa todos los archivos en paralelo
      files.map(async (file) => {                    // Itera para generar las URLs de descarga
        if (file.storageId) {                        // Si el archivo tiene contenido en storage (binario)
          const url = await ctx.storage.getUrl(file.storageId); // Genera la URL pública de acceso
          return { ...file, storageUrl: url };       // Adjunta la URL al objeto del archivo
        }
        return { ...file, storageUrl: null };        // Si es texto o carpeta, la URL queda nula
      })
    );
  },
});

// Crea un nuevo proyecto con el nombre del repo degithub 
// para que luego pueda ser rellenado con el contenido del mismo.
export const createProject = mutation({
  args: {
    internalKey: v.string(),                        // Clave de seguridad para validar el acceso
    name: v.string(),                               // Nombre que se le dará al proyecto
    ownerId: v.string(),                            // ID del usuario propietario del proyecto
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);          // Verifica la identidad de la petición

    const projectId = await ctx.db.insert("projects", { // Crea la entrada en la tabla projects
      name: args.name,
      ownerId: args.ownerId,
      updatedAt: Date.now(),                        // Marca el momento exacto de creación
      importStatus: "importing",                    // Marca el estado inicial como "importando"
    });

    return projectId;                               // Devuelve el ID para seguir con la importación
  },
});

// Se usa cuando un usuario crea un proyecto nuevo (desde cero o mediante un prompt) 
// y quieres que ya tenga abierta una ventana de chat para empezar a hablar con la IA 
// sobre ese proyecto.
export const createProjectWithConversation = mutation({
  args: {
    internalKey: v.string(),                        // Clave de seguridad para validar el acceso
    projectName: v.string(),                        // Nombre del nuevo proyecto
    conversationTitle: v.string(),                  // Título inicial para la charla con la IA
    ownerId: v.string(),                            // ID del usuario dueño de todo
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);          // Verifica la identidad de la petición

    const now = Date.now();                         // Captura el tiempo para sincronizar ambos registros

    // 1. Crea el proyecto (el contenedor de archivos)
    const projectId = await ctx.db.insert("projects", {
      name: args.projectName,
      ownerId: args.ownerId,
      updatedAt: now,
    });

    // 2. Crea la conversación inicial vinculada a ese proyecto
    const conversationId = await ctx.db.insert("conversations", {
      projectId,                                   // Vinculación vital: a qué proyecto pertenece el chat
      title: args.conversationTitle,
      updatedAt: now,
    });

    // Devuelve ambos IDs para que el IDE sepa a dónde redirigir al usuario
    return { projectId, conversationId };
  },
});

