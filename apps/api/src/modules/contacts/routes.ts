import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { paginationSchema, createContactSchema, updateContactSchema } from "@watson/shared";

export async function contactRoutes(fastify: FastifyInstance) {
  // List contacts
  fastify.get("/", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;
    const query = request.query as Record<string, string>;

    const pagination = paginationSchema.parse({
      page: query.page,
      limit: query.limit,
    });

    const where: any = { organizationId: orgId };

    // Filters
    if (query.status) where.status = query.status;
    if (query.funnelStageId) where.funnelStageId = query.funnelStageId;
    if (query.minScore) where.leadScore = { gte: Number(query.minScore) };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          funnelStage: {
            select: { id: true, name: true, color: true },
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
          _count: {
            select: { conversations: true },
          },
        },
        orderBy: { lastInteractionAt: "desc" },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      success: true,
      data: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name || contact.pushName || contact.phone,
        phone: contact.phone,
        email: contact.email,
        avatar: contact.profilePicUrl,
        leadScore: contact.leadScore,
        funnelStage: contact.funnelStage,
        tags: contact.tags.map((t) => t.tag),
        lastInteractionAt: contact.lastInteractionAt,
        conversationCount: contact._count.conversations,
        status: contact.status,
      })),
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  });

  // Get contact by ID
  fastify.get<{ Params: { id: string } }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
      include: {
        funnelStage: true,
        funnel: true,
        tags: {
          include: { tag: true },
        },
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            intent: true,
            lastMessageAt: true,
            messageCount: true,
          },
        },
        internalNotes: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            createdBy: {
              select: { id: true, name: true },
            },
          },
        },
        tasks: {
          where: { status: { not: "COMPLETED" } },
          orderBy: { dueDate: "asc" },
          take: 5,
        },
      },
    });

    if (!contact) {
      return reply.notFound("Contato nao encontrado");
    }

    return {
      success: true,
      data: contact,
    };
  });

  // Create contact
  fastify.post("/", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;

    const result = createContactSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    // Check if contact already exists
    const existing = await prisma.contact.findFirst({
      where: { organizationId: orgId, waId: result.data.waId },
    });

    if (existing) {
      return reply.conflict("Contato ja existe");
    }

    const contact = await prisma.contact.create({
      data: {
        organizationId: orgId,
        ...result.data,
      },
    });

    return reply.code(201).send({
      success: true,
      data: contact,
    });
  });

  // Update contact
  fastify.patch<{ Params: { id: string } }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const result = updateContactSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!contact) {
      return reply.notFound("Contato nao encontrado");
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: result.data,
    });

    return {
      success: true,
      data: updated,
    };
  });

  // Add tag to contact
  fastify.post<{ Params: { id: string }; Body: { tagId: string } }>("/:id/tags", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;
    const { tagId } = request.body;

    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!contact) {
      return reply.notFound("Contato nao encontrado");
    }

    const tag = await prisma.tag.findFirst({
      where: { id: tagId, organizationId: orgId },
    });

    if (!tag) {
      return reply.notFound("Tag nao encontrada");
    }

    await prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId: id, tagId } },
      create: { contactId: id, tagId },
      update: {},
    });

    return { success: true };
  });

  // Remove tag from contact
  fastify.delete<{ Params: { id: string; tagId: string } }>("/:id/tags/:tagId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id, tagId } = request.params;

    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!contact) {
      return reply.notFound("Contato nao encontrado");
    }

    await prisma.contactTag.deleteMany({
      where: { contactId: id, tagId },
    });

    return { success: true };
  });

  // Add internal note
  fastify.post<{ Params: { id: string }; Body: { content: string } }>("/:id/notes", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId, userId } = request.user;
    const { id } = request.params;
    const { content } = request.body;

    if (!content?.trim()) {
      return reply.badRequest("Conteudo obrigatorio");
    }

    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!contact) {
      return reply.notFound("Contato nao encontrado");
    }

    const note = await prisma.internalNote.create({
      data: {
        contactId: id,
        content: content.trim(),
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return reply.code(201).send({
      success: true,
      data: note,
    });
  });

  // Get contact conversations
  fastify.get<{ Params: { id: string } }>("/:id/conversations", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!contact) {
      return reply.notFound("Contato nao encontrado");
    }

    const conversations = await prisma.conversation.findMany({
      where: { contactId: id, organizationId: orgId },
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true,
        status: true,
        intent: true,
        messageCount: true,
        lastMessageAt: true,
      },
    });

    return {
      success: true,
      data: conversations,
    };
  });

  // Move contact in funnel
  fastify.patch<{ Params: { id: string }; Body: { funnelStageId: string } }>("/:id/funnel", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;
    const { funnelStageId } = request.body;

    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!contact) {
      return reply.notFound("Contato nao encontrado");
    }

    const stage = await prisma.funnelStage.findFirst({
      where: { id: funnelStageId },
      include: { funnel: true },
    });

    if (!stage || stage.funnel.organizationId !== orgId) {
      return reply.notFound("Etapa do funil nao encontrada");
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: {
        funnelId: stage.funnelId,
        funnelStageId,
      },
    });

    return {
      success: true,
      data: updated,
    };
  });
}
