import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { createKnowledgeBaseSchema, createFaqSchema } from "@watson/shared";

export async function knowledgeRoutes(fastify: FastifyInstance) {
  // List knowledge bases
  fastify.get("/bases", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;

    const bases = await prisma.knowledgeBase.findMany({
      where: { organizationId: orgId },
      include: {
        _count: {
          select: { documents: true, faqs: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: bases.map((base) => ({
        ...base,
        documentCount: base._count.documents,
        faqCount: base._count.faqs,
      })),
    };
  });

  // Create knowledge base
  fastify.post("/bases", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;

    const result = createKnowledgeBaseSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    const base = await prisma.knowledgeBase.create({
      data: {
        organizationId: orgId,
        ...result.data,
      },
    });

    return reply.code(201).send({
      success: true,
      data: base,
    });
  });

  // Get knowledge base by ID
  fastify.get<{ Params: { id: string } }>("/bases/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const base = await prisma.knowledgeBase.findFirst({
      where: { id, organizationId: orgId },
      include: {
        documents: {
          select: {
            id: true,
            title: true,
            originalFileName: true,
            status: true,
            chunkCount: true,
            createdAt: true,
          },
        },
        faqs: {
          orderBy: { priority: "desc" },
        },
      },
    });

    if (!base) {
      return reply.notFound("Base de conhecimento nao encontrada");
    }

    return {
      success: true,
      data: base,
    };
  });

  // Delete knowledge base
  fastify.delete<{ Params: { id: string } }>("/bases/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const base = await prisma.knowledgeBase.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!base) {
      return reply.notFound("Base de conhecimento nao encontrada");
    }

    await prisma.knowledgeBase.delete({ where: { id } });

    return { success: true };
  });

  // Upload document to knowledge base
  fastify.post<{ Params: { id: string } }>("/bases/:id/documents", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const base = await prisma.knowledgeBase.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!base) {
      return reply.notFound("Base de conhecimento nao encontrada");
    }

    // TODO: Handle file upload with @fastify/multipart
    // For now, accept metadata
    const body = request.body as { title: string; fileUrl: string; mimeType: string; originalFileName: string };

    const document = await prisma.knowledgeDocument.create({
      data: {
        knowledgeBaseId: id,
        title: body.title,
        originalFileName: body.originalFileName,
        mimeType: body.mimeType,
        fileUrl: body.fileUrl,
        status: "PENDING",
      },
    });

    // TODO: Queue document processing job

    return reply.code(201).send({
      success: true,
      data: document,
    });
  });

  // Delete document
  fastify.delete<{ Params: { id: string; docId: string } }>("/bases/:id/documents/:docId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id, docId } = request.params;

    const document = await prisma.knowledgeDocument.findFirst({
      where: {
        id: docId,
        knowledgeBase: { id, organizationId: orgId },
      },
    });

    if (!document) {
      return reply.notFound("Documento nao encontrado");
    }

    await prisma.knowledgeDocument.delete({ where: { id: docId } });

    return { success: true };
  });

  // Add FAQ
  fastify.post<{ Params: { id: string } }>("/bases/:id/faqs", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const result = createFaqSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    const base = await prisma.knowledgeBase.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!base) {
      return reply.notFound("Base de conhecimento nao encontrada");
    }

    const faq = await prisma.fAQ.create({
      data: {
        knowledgeBaseId: id,
        ...result.data,
      },
    });

    // TODO: Generate embedding for FAQ question

    return reply.code(201).send({
      success: true,
      data: faq,
    });
  });

  // Update FAQ
  fastify.patch<{ Params: { id: string; faqId: string } }>("/bases/:id/faqs/:faqId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id, faqId } = request.params;

    const faq = await prisma.fAQ.findFirst({
      where: {
        id: faqId,
        knowledgeBase: { id, organizationId: orgId },
      },
    });

    if (!faq) {
      return reply.notFound("FAQ nao encontrado");
    }

    const updated = await prisma.fAQ.update({
      where: { id: faqId },
      data: request.body as any,
    });

    return {
      success: true,
      data: updated,
    };
  });

  // Delete FAQ
  fastify.delete<{ Params: { id: string; faqId: string } }>("/bases/:id/faqs/:faqId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id, faqId } = request.params;

    const faq = await prisma.fAQ.findFirst({
      where: {
        id: faqId,
        knowledgeBase: { id, organizationId: orgId },
      },
    });

    if (!faq) {
      return reply.notFound("FAQ nao encontrado");
    }

    await prisma.fAQ.delete({ where: { id: faqId } });

    return { success: true };
  });

  // Semantic search across all knowledge bases
  fastify.post("/search", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { query, limit = 5 } = request.body as { query: string; limit?: number };

    if (!query?.trim()) {
      return reply.badRequest("Query obrigatoria");
    }

    // TODO: Implement semantic search with embeddings
    // For now, do simple text search

    const [faqs, chunks] = await Promise.all([
      prisma.fAQ.findMany({
        where: {
          knowledgeBase: { organizationId: orgId },
          OR: [
            { question: { contains: query, mode: "insensitive" } },
            { answer: { contains: query, mode: "insensitive" } },
          ],
        },
        take: limit,
      }),
      prisma.documentChunk.findMany({
        where: {
          document: {
            knowledgeBase: { organizationId: orgId },
          },
          content: { contains: query, mode: "insensitive" },
        },
        include: {
          document: { select: { title: true } },
        },
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: {
        faqs: faqs.map((faq) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          type: "faq",
        })),
        documents: chunks.map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          documentTitle: chunk.document.title,
          type: "document",
        })),
      },
    };
  });
}
