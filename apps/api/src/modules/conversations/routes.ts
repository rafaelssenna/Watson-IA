import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { paginationSchema, updateConversationSchema, sendMessageSchema } from "@watson/shared";

export async function conversationRoutes(fastify: FastifyInstance) {
  // List conversations
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
    if (query.urgency) where.urgency = query.urgency;
    if (query.intent) where.intent = query.intent;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.mode) where.mode = query.mode;

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              pushName: true,
              phone: true,
              profilePicUrl: true,
              leadScore: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              content: true,
              type: true,
              direction: true,
              createdAt: true,
            },
          },
        },
        orderBy: [
          { urgency: "desc" },
          { lastMessageAt: "desc" },
        ],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    return {
      success: true,
      data: conversations.map((conv) => ({
        id: conv.id,
        contactId: conv.contactId,
        contactName: conv.contact.name || conv.contact.pushName || conv.contact.phone,
        contactPhone: conv.contact.phone,
        contactAvatar: conv.contact.profilePicUrl,
        lastMessage: conv.messages[0]?.content || "",
        lastMessageAt: conv.lastMessageAt,
        status: conv.status,
        intent: conv.intent,
        urgency: conv.urgency,
        leadScore: conv.contact.leadScore,
        closingProbability: conv.closingProbability,
        sentiment: conv.sentiment,
        mode: conv.mode,
        messageCount: conv.messageCount,
      })),
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  });

  // Get conversation by ID
  fastify.get<{ Params: { id: string } }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: orgId },
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: "asc" },
        },
        activePersona: {
          select: { id: true, name: true, type: true },
        },
        assignedTo: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    if (!conversation) {
      return reply.notFound("Conversa nao encontrada");
    }

    return {
      success: true,
      data: conversation,
    };
  });

  // Update conversation
  fastify.patch<{ Params: { id: string }; Body: any }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const result = updateConversationSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!conversation) {
      return reply.notFound("Conversa nao encontrada");
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: result.data,
    });

    // Emit update via Socket.IO
    const io = fastify.io;
    io.to(`org:${orgId}`).emit("conversation:update", {
      conversationId: id,
      updates: result.data,
    });

    return {
      success: true,
      data: updated,
    };
  });

  // Send message
  fastify.post<{ Params: { id: string }; Body: any }>("/:id/messages", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const result = sendMessageSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: orgId },
      include: { contact: true },
    });

    if (!conversation) {
      return reply.notFound("Conversa nao encontrada");
    }

    // Create message in database
    const message = await prisma.message.create({
      data: {
        organizationId: orgId,
        conversationId: id,
        direction: "OUTBOUND",
        type: result.data.type,
        content: result.data.content,
        mediaUrl: result.data.mediaUrl,
        caption: result.data.caption,
        isAiGenerated: false,
        status: "PENDING",
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
        status: "WAITING_CLIENT",
      },
    });

    // TODO: Send via UAZAPI
    // await uazapiService.sendMessage(conversation.contact.waId, result.data);

    // Emit new message via Socket.IO
    const io = fastify.io;
    io.to(`org:${orgId}`).emit("message:new", {
      conversationId: id,
      message,
    });

    return {
      success: true,
      data: message,
    };
  });

  // Get urgent conversations
  fastify.get("/urgent", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;

    const conversations = await prisma.conversation.findMany({
      where: {
        organizationId: orgId,
        urgency: { in: ["HIGH", "CRITICAL"] },
        status: { in: ["OPEN", "WAITING_AGENT", "IN_PROGRESS"] },
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            pushName: true,
            phone: true,
            leadScore: true,
          },
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 10,
    });

    return {
      success: true,
      data: conversations,
    };
  });

  // Override Watson (switch to human mode)
  fastify.post<{ Params: { id: string } }>("/:id/override", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId, userId } = request.user;
    const { id } = request.params;

    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!conversation) {
      return reply.notFound("Conversa nao encontrada");
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        mode: "HUMAN_ONLY",
        assignedToId: userId,
      },
    });

    // Emit update via Socket.IO
    const io = fastify.io;
    io.to(`org:${orgId}`).emit("conversation:update", {
      conversationId: id,
      updates: { mode: "HUMAN_ONLY", assignedToId: userId },
    });

    return {
      success: true,
      data: updated,
    };
  });
}
