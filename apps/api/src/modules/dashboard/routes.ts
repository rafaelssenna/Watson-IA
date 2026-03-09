import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";

// Filter: only conversations where the AI participated (replied or took action)
const aiParticipated = {
  OR: [
    { messages: { some: { isAiGenerated: true } } },
    { lastAiAction: { not: null } },
  ],
};

export async function dashboardRoutes(fastify: FastifyInstance) {
  // Get dashboard summary (Watson Insights)
  fastify.get("/summary", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;

    // Use BRT (UTC-3) for date boundaries so "today" matches Brazil time
    const nowBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const todayBRT = new Date(nowBRT.getFullYear(), nowBRT.getMonth(), nowBRT.getDate());
    // Convert to UTC for DB queries (add 3h)
    const today = new Date(todayBRT.getTime() + 3 * 60 * 60 * 1000);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Run all queries in parallel — only conversations where AI participated
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
      // Active conversations (AI participated)
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          status: { in: ["OPEN", "WAITING_CLIENT", "WAITING_AGENT", "IN_PROGRESS"] },
          ...aiParticipated,
        },
      }),

      // Purchase intent (AI participated)
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          intent: "purchase",
          status: { notIn: ["CLOSED", "RESOLVED"] },
          ...aiParticipated,
        },
      }),

      // Urgent conversations (AI participated)
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          urgency: { in: ["HIGH", "CRITICAL"] },
          status: { notIn: ["CLOSED", "RESOLVED"] },
          ...aiParticipated,
        },
      }),

      // Cooling conversations (AI participated)
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          status: { notIn: ["CLOSED", "RESOLVED"] },
          closingProbability: { gte: 60 },
          lastMessageAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          ...aiParticipated,
        },
      }),

      // Today's conversations (AI participated)
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: today },
          ...aiParticipated,
        },
      }),

      // Yesterday's conversations (AI participated)
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: yesterday, lt: today },
          ...aiParticipated,
        },
      }),

      // Today's messages (only in conversations where AI participated)
      prisma.message.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: today },
          conversation: { ...aiParticipated },
        },
      }),

      // Average response time (AI participated)
      prisma.conversation.aggregate({
        where: {
          organizationId: orgId,
          avgResponseTime: { not: null },
          ...aiParticipated,
        },
        _avg: { avgResponseTime: true },
      }),

      // Hot leads not responded (AI participated)
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          urgency: { in: ["HIGH", "CRITICAL"] },
          status: "WAITING_AGENT",
          lastMessageAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
          ...aiParticipated,
        },
      }),
    ]);

    // Calculate response rate (only AI conversations)
    const [inboundToday, respondedToday] = await Promise.all([
      prisma.message.count({
        where: {
          organizationId: orgId,
          direction: "INBOUND",
          createdAt: { gte: today },
          conversation: { ...aiParticipated },
        },
      }),
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          ...aiParticipated,
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

  // Get insights metrics
  fastify.get("/insights", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;
    const { period } = request.query as { period?: string };

    // Use BRT (UTC-3) for date boundaries so "today" matches Brazil time
    const nowBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const today = new Date(nowBRT.getFullYear(), nowBRT.getMonth(), nowBRT.getDate());
    // Convert back to UTC for DB queries (add 3h offset)
    const todayUTC = new Date(today.getTime() + 3 * 60 * 60 * 1000);
    let startDate: Date;

    if (period === "7d") {
      startDate = new Date(todayUTC);
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === "30d") {
      startDate = new Date(todayUTC);
      startDate.setDate(startDate.getDate() - 30);
    } else {
      startDate = todayUTC;
    }

    const dateFilter = { gte: startDate };

    // Only conversations where AI participated
    const [
      totalOutbound,
      aiMessages,
      transfersToHuman,
      totalConversations,
      openConversations,
      resolvedConversations,
      closedConversations,
      avgResponseTimeAgg,
      newContacts,
      totalContacts,
      inboundCount,
      respondedCount,
    ] = await Promise.all([
      // Total outbound messages (in AI conversations)
      prisma.message.count({
        where: { organizationId: orgId, direction: "OUTBOUND", createdAt: dateFilter, conversation: { ...aiParticipated } },
      }),
      // AI generated messages
      prisma.message.count({
        where: { organizationId: orgId, direction: "OUTBOUND", isAiGenerated: true, createdAt: dateFilter },
      }),
      // Transfers to human
      prisma.conversation.count({
        where: { organizationId: orgId, lastAiAction: "ESCALATED_TO_HUMAN", updatedAt: dateFilter },
      }),
      // Total conversations (AI participated)
      prisma.conversation.count({
        where: { organizationId: orgId, createdAt: dateFilter, ...aiParticipated },
      }),
      // Open (AI participated)
      prisma.conversation.count({
        where: { organizationId: orgId, status: { in: ["OPEN", "WAITING_CLIENT", "WAITING_AGENT", "IN_PROGRESS"] }, createdAt: dateFilter, ...aiParticipated },
      }),
      // Resolved (AI participated)
      prisma.conversation.count({
        where: { organizationId: orgId, status: "RESOLVED", createdAt: dateFilter, ...aiParticipated },
      }),
      // Closed (AI participated)
      prisma.conversation.count({
        where: { organizationId: orgId, status: "CLOSED", createdAt: dateFilter, ...aiParticipated },
      }),
      // Avg response time (AI participated)
      prisma.conversation.aggregate({
        where: { organizationId: orgId, avgResponseTime: { not: null }, createdAt: dateFilter, ...aiParticipated },
        _avg: { avgResponseTime: true },
      }),
      // New contacts (that interacted with AI)
      prisma.contact.count({
        where: { organizationId: orgId, createdAt: dateFilter, conversations: { some: { ...aiParticipated } } },
      }),
      // Total contacts (that interacted with AI)
      prisma.contact.count({
        where: { organizationId: orgId, conversations: { some: { ...aiParticipated } } },
      }),
      // Inbound messages (in AI conversations)
      prisma.message.count({
        where: { organizationId: orgId, direction: "INBOUND", createdAt: dateFilter, conversation: { ...aiParticipated } },
      }),
      // Conversations that got a reply (AI participated)
      prisma.conversation.count({
        where: {
          organizationId: orgId,
          ...aiParticipated,
          messages: { some: { direction: "OUTBOUND", createdAt: dateFilter } },
        },
      }),
    ]);

    const humanMessages = totalOutbound - aiMessages;
    const aiPercentage = totalOutbound > 0 ? Math.round((aiMessages / totalOutbound) * 100) : 0;
    const avgResponseTime = avgResponseTimeAgg._avg.avgResponseTime
      ? Math.round(avgResponseTimeAgg._avg.avgResponseTime / 60)
      : 0;
    const responseRate = inboundCount > 0 ? Math.round((respondedCount / inboundCount) * 100) : 100;

    // Peak hours (last 24h) - only messages in AI conversations (BRT timezone)
    const peakHoursRaw = await prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
      SELECT EXTRACT(HOUR FROM m."createdAt" AT TIME ZONE 'America/Sao_Paulo') as hour, COUNT(*) as count
      FROM "Message" m
      INNER JOIN "Conversation" c ON m."conversationId" = c."id"
      WHERE m."organizationId" = ${orgId}
        AND m."createdAt" >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)}
        AND (c."lastAiAction" IS NOT NULL OR EXISTS (
          SELECT 1 FROM "Message" m2 WHERE m2."conversationId" = c."id" AND m2."isAiGenerated" = true
        ))
      GROUP BY EXTRACT(HOUR FROM m."createdAt" AT TIME ZONE 'America/Sao_Paulo')
      ORDER BY hour
    `;
    const peakHours = peakHoursRaw.map((r) => ({
      hour: `${String(Number(r.hour)).padStart(2, "0")}:00`,
      count: Number(r.count),
    }));

    // Messages per day (last 7 days)
    const daysCount = period === "30d" ? 30 : period === "7d" ? 7 : 1;
    const msgsPerDayStart = new Date(today);
    msgsPerDayStart.setDate(msgsPerDayStart.getDate() - daysCount);

    const msgsPerDayRaw = await prisma.$queryRaw<Array<{ date: Date; direction: string; count: bigint }>>`
      SELECT DATE(m."createdAt" AT TIME ZONE 'America/Sao_Paulo') as date, m."direction", COUNT(*) as count
      FROM "Message" m
      INNER JOIN "Conversation" c ON m."conversationId" = c."id"
      WHERE m."organizationId" = ${orgId}
        AND m."createdAt" >= ${msgsPerDayStart}
        AND (c."lastAiAction" IS NOT NULL OR EXISTS (
          SELECT 1 FROM "Message" m2 WHERE m2."conversationId" = c."id" AND m2."isAiGenerated" = true
        ))
      GROUP BY DATE(m."createdAt" AT TIME ZONE 'America/Sao_Paulo'), m."direction"
      ORDER BY date
    `;

    const dayMap = new Map<string, { date: string; inbound: number; outbound: number }>();
    for (let i = 0; i < daysCount; i++) {
      // Generate day labels in BRT
      const d = new Date(today);
      d.setDate(d.getDate() - daysCount + i + 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dayMap.set(key, { date: key, inbound: 0, outbound: 0 });
    }
    for (const row of msgsPerDayRaw) {
      const rd = new Date(row.date);
      const key = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, "0")}-${String(rd.getDate()).padStart(2, "0")}`;
      const entry = dayMap.get(key);
      if (entry) {
        if (row.direction === "INBOUND") entry.inbound = Number(row.count);
        else entry.outbound = Number(row.count);
      }
    }
    const messagesPerDay = Array.from(dayMap.values());

    return {
      success: true,
      data: {
        totalOutbound,
        aiMessages,
        humanMessages,
        aiPercentage,
        transfersToHuman,
        totalConversations,
        openConversations,
        resolvedConversations,
        closedConversations,
        avgResponseTime,
        responseRate,
        newContacts,
        totalContacts,
        peakHours,
        messagesPerDay,
      },
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
