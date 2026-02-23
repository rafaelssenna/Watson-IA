import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { createPersonaSchema, updatePersonaSchema } from "@watson/shared";
import pdf from "pdf-parse";

// Extract text from different file types
async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    try {
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      return "";
    }
  }

  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return buffer.toString("utf-8");
  }

  // For other types, try to read as text
  try {
    return buffer.toString("utf-8");
  } catch {
    return "";
  }
}

export async function personaRoutes(fastify: FastifyInstance) {
  // List personas
  fastify.get("/", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;

    const personas = await prisma.persona.findMany({
      where: { organizationId: orgId },
      orderBy: [
        { isDefault: "desc" },
        { name: "asc" },
      ],
    });

    return {
      success: true,
      data: personas,
    };
  });

  // Get persona by ID
  fastify.get<{ Params: { id: string } }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const persona = await prisma.persona.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!persona) {
      return reply.notFound("Persona nao encontrada");
    }

    return {
      success: true,
      data: persona,
    };
  });

  // Create persona
  fastify.post("/", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;

    const result = createPersonaSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    // If setting as default, unset other defaults
    if (result.data.isDefault) {
      await prisma.persona.updateMany({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const persona = await prisma.persona.create({
      data: {
        organizationId: orgId,
        ...result.data,
      },
    });

    return reply.code(201).send({
      success: true,
      data: persona,
    });
  });

  // Update persona
  fastify.patch<{ Params: { id: string } }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const result = updatePersonaSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    const persona = await prisma.persona.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!persona) {
      return reply.notFound("Persona nao encontrada");
    }

    // If setting as default, unset other defaults
    if (result.data.isDefault) {
      await prisma.persona.updateMany({
        where: { organizationId: orgId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.persona.update({
      where: { id },
      data: result.data,
    });

    return {
      success: true,
      data: updated,
    };
  });

  // Delete persona
  fastify.delete<{ Params: { id: string } }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const persona = await prisma.persona.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!persona) {
      return reply.notFound("Persona nao encontrada");
    }

    if (persona.isDefault) {
      return reply.badRequest("Nao e possivel deletar a persona padrao");
    }

    await prisma.persona.delete({ where: { id } });

    return { success: true };
  });

  // Test persona (preview response)
  fastify.post<{ Params: { id: string }; Body: { message: string } }>("/:id/test", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;
    const { message } = request.body;

    if (!message?.trim()) {
      return reply.badRequest("Mensagem obrigatoria");
    }

    const persona = await prisma.persona.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!persona) {
      return reply.notFound("Persona nao encontrada");
    }

    // TODO: Implement AI response generation with persona
    // For now, return a placeholder
    const previewResponse = `[Preview com persona "${persona.name}"] Resposta simulada para: "${message}"`;

    return {
      success: true,
      data: {
        response: previewResponse,
        persona: {
          name: persona.name,
          type: persona.type,
          formalityLevel: persona.formalityLevel,
          persuasiveness: persona.persuasiveness,
        },
      },
    };
  });

  // ============================================
  // KNOWLEDGE FILES
  // ============================================

  // List knowledge files for persona
  fastify.get<{ Params: { id: string } }>("/:id/files", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const persona = await prisma.persona.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!persona) {
      return reply.notFound("Persona nao encontrada");
    }

    const files = await prisma.personaKnowledgeFile.findMany({
      where: { personaId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: files,
    };
  });

  // Upload knowledge file
  fastify.post<{ Params: { id: string } }>("/:id/files", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const persona = await prisma.persona.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!persona) {
      return reply.notFound("Persona nao encontrada");
    }

    const data = await request.file();

    if (!data) {
      return reply.badRequest("Arquivo obrigatorio");
    }

    const allowedMimeTypes = [
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedMimeTypes.includes(data.mimetype)) {
      return reply.badRequest("Tipo de arquivo nao suportado. Use PDF, TXT, CSV ou DOC/DOCX.");
    }

    // Read file buffer
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Check file size (10MB max)
    if (buffer.length > 10 * 1024 * 1024) {
      return reply.badRequest("Arquivo muito grande. Maximo 10MB.");
    }

    // Extract text from file
    const extractedText = await extractTextFromFile(buffer, data.mimetype);

    if (!extractedText.trim()) {
      return reply.badRequest("Nao foi possivel extrair texto do arquivo");
    }

    // Save to database
    const file = await prisma.personaKnowledgeFile.create({
      data: {
        personaId: id,
        fileName: data.filename,
        mimeType: data.mimetype,
        extractedText,
      },
    });

    fastify.log.info(`Knowledge file uploaded for persona ${id}: ${data.filename} (${extractedText.length} chars)`);

    return reply.code(201).send({
      success: true,
      data: {
        id: file.id,
        fileName: file.fileName,
        mimeType: file.mimeType,
        textLength: extractedText.length,
        createdAt: file.createdAt,
      },
    });
  });

  // Delete knowledge file
  fastify.delete<{ Params: { id: string; fileId: string } }>("/:id/files/:fileId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id, fileId } = request.params;

    const persona = await prisma.persona.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!persona) {
      return reply.notFound("Persona nao encontrada");
    }

    const file = await prisma.personaKnowledgeFile.findFirst({
      where: { id: fileId, personaId: id },
    });

    if (!file) {
      return reply.notFound("Arquivo nao encontrado");
    }

    await prisma.personaKnowledgeFile.delete({ where: { id: fileId } });

    return { success: true };
  });
}
