import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { paginationSchema, updateConversationSchema, sendMessageSchema } from "@watson/shared";
import { sendTextMessage } from "../../services/uazapi.service.js";

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

    // Calculate unread count for each conversation (INBOUND messages after last OUTBOUND)
    const convIds = conversations.map((c) => c.id);
    const unreadCounts: Record<string, number> = {};

    if (convIds.length > 0) {
      for (const conv of conversations) {
        // Find last outbound message time
        const lastOutbound = await prisma.message.findFirst({
          where: { conversationId: conv.id, direction: "OUTBOUND" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });

        if (lastOutbound) {
          const count = await prisma.message.count({
            where: {
              conversationId: conv.id,
              direction: "INBOUND",
              createdAt: { gt: lastOutbound.createdAt },
            },
          });
          unreadCounts[conv.id] = count;
        } else {
          // No outbound messages = all inbound are "unread"
          unreadCounts[conv.id] = await prisma.message.count({
            where: { conversationId: conv.id, direction: "INBOUND" },
          });
        }
      }
    }

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
        unreadCount: unreadCounts[conv.id] || 0,
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

    // Send via UAZAPI
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: orgId, status: "CONNECTED" },
      select: { uazapiToken: true },
    });

    if (connection?.uazapiToken && result.data.type === "TEXT") {
      const sendResult = await sendTextMessage(
        connection.uazapiToken,
        conversation.contact.waId,
        result.data.content
      );

      // Update message status based on send result
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: sendResult.success ? "SENT" : "FAILED",
          waMessageId: sendResult.messageId || undefined,
        },
      });

      if (!sendResult.success) {
        fastify.log.error({ error: sendResult.error }, "Failed to send message via UAZAPI");
      }
    }

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
