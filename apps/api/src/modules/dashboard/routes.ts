import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";

export async function dashboardRoutes(fastify: FastifyInstance) {
  // Get dashboard summary (Watson Insights)
  fastify.get("/summary", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Run all queries in parallel
    const [
      activeConversations,
      purchaseIntentCount,
      urgentCount,
      coolingConversations,
      todayConversations,
      yesterdayConversations,
      todayMessages,
      avgResponseTime,
      hotLeadsNotResponded,
    ] = await Promise.all([
      // Active conversations
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          status: { in: ["OPEN", "WAITING_CLIENT", "WAITING_AGENT", "IN_PROGRESS"] },
        },
      }),

      // Purchase intent
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          intent: "purchase",
          status: { notIn: ["CLOSED", "RESOLVED"] },
        },
      }),

      // Urgent conversations
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          urgency: { in: ["HIGH", "CRITICAL"] },
          status: { notIn: ["CLOSED", "RESOLVED"] },
        },
      }),

      // Cooling conversations (hot leads with no reply in 24h)
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          status: { notIn: ["CLOSED", "RESOLVED"] },
          closingProbability: { gte: 60 },
          lastMessageAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),

      // Today's conversations
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: today },
        },
      }),

      // Yesterday's conversations
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: yesterday, lt: today },
        },
      }),

      // Today's messages
      prisma.message.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: today },
        },
      }),

      // Average response time (outbound messages today)
      prisma.conversation.aggregate({
        where: {
          organizationId: orgId,
          avgResponseTime: { not: null },
        },
        _avg: { avgResponseTime: true },
      }),

      // Hot leads not responded (urgency high + last message inbound + >30min)
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          urgency: { in: ["HIGH", "CRITICAL"] },
          status: "WAITING_AGENT",
          lastMessageAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
        },
      }),
    ]);

    // Calculate response rate
    const [inboundToday, respondedToday] = await Promise.all([
      prisma.message.count({
        where: {
          organizationId: orgId,
          direction: "INBOUND",
          createdAt: { gte: today },
        },
      }),
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          messages: {
            some: {
              direction: "OUTBOUND",
              createdAt: { gte: today },
            },
          },
        },
      }),
    ]);

    const responseRate = inboundToday > 0 ? Math.round((respondedToday / inboundToday) * 100) : 100;

    // Calculate trend
    const conversationTrend = yesterdayConversations > 0
      ? Math.round(((todayConversations - yesterdayConversations) / yesterdayConversations) * 100)
      : todayConversations > 0 ? 100 : 0;

    return {
      success: true,
      data: {
        activeConversations,
        purchaseIntentCount,
        urgentCount,
        coolingCount: coolingConversations,
        responseRate,
        avgResponseTime: avgResponseTime._avg.avgResponseTime
          ? Math.round(avgResponseTime._avg.avgResponseTime / 60)
          : 0,
        hotLeadsNotResponded,
        todayConversations,
        todayMessages,
        conversationTrend,
      },
    };
  });

  // Get urgent conversations list
  fastify.get("/urgent", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;

    const conversations = await prisma.conversation.findMany({
      where: {
        organizationId: orgId,
        urgency: { in: ["HIGH", "CRITICAL"] },
        status: { notIn: ["CLOSED", "RESOLVED"] },
      },
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
          select: { content: true, createdAt: true, direction: true },
        },
      },
      orderBy: [
        { urgency: "desc" },
        { lastMessageAt: "desc" },
      ],
      take: 10,
    });

    return {
      success: true,
      data: conversations.map((conv) => ({
        id: conv.id,
        contactId: conv.contactId,
        contactName: conv.contact.name || conv.contact.pushName || conv.contact.phone,
        contactAvatar: conv.contact.profilePicUrl,
        lastMessage: conv.messages[0]?.content,
        lastMessageAt: conv.lastMessageAt,
        urgency: conv.urgency,
        intent: conv.intent,
        leadScore: conv.contact.leadScore,
      })),
    };
  });

  // Get cooling conversations
  fastify.get("/cooling", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;

    const conversations = await prisma.conversation.findMany({
      where: {
        organizationId: orgId,
        status: { notIn: ["CLOSED", "RESOLVED"] },
        closingProbability: { gte: 60 },
        lastMessageAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
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
      orderBy: { lastMessageAt: "asc" },
      take: 10,
    });

    return {
      success: true,
      data: conversations.map((conv) => ({
        id: conv.id,
        contactId: conv.contactId,
        contactName: conv.contact.name || conv.contact.pushName || conv.contact.phone,
        leadScore: conv.contact.leadScore,
        closingProbability: conv.closingProbability,
        lastMessageAt: conv.lastMessageAt,
        hoursSinceLastMessage: Math.round(
          (Date.now() - new Date(conv.lastMessageAt!).getTime()) / (1000 * 60 * 60)
        ),
      })),
    };
  });

  // Get AI suggestions
  fastify.get("/suggestions", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;

    // Generate suggestions based on current state
    const suggestions: any[] = [];

    // Check for hot leads not responded
    const hotLeads = await prisma.conversation.findMany({
      where: {
        organizationId: orgId,
        urgency: { in: ["HIGH", "CRITICAL"] },
        status: "WAITING_AGENT",
        lastMessageAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
      include: {
        contact: { select: { name: true, pushName: true } },
      },
      take: 3,
    });

    for (const lead of hotLeads) {
      suggestions.push({
        id: `urgent-${lead.id}`,
        type: "escalate",
        title: "Lead quente sem resposta",
        description: `${lead.contact.name || lead.contact.pushName} aguarda resposta ha mais de 30 minutos`,
        priority: "high",
        relatedConversationId: lead.id,
      });
    }

    // Check for cooling conversations
    const cooling = await prisma.conversation.count({
      where: {
        organizationId: orgId,
        status: { notIn: ["CLOSED", "RESOLVED"] },
        closingProbability: { gte: 60 },
        lastMessageAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (cooling > 0) {
      suggestions.push({
        id: "follow-up-cooling",
        type: "follow_up",
        title: `${cooling} conversas esfriando`,
        description: "Leads com alta probabilidade de fechamento sem resposta em 24h",
        priority: "medium",
      });
    }

    return {
      success: true,
      data: suggestions,
    };
  });
}
