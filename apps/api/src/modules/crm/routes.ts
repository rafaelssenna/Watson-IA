import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { classifyLead, leadScoreLabels, type LeadScore, type LeadClassification } from "../../services/lead-classifier.js";
import { fetchProfilePicUrl } from "../../services/uazapi.service.js";

// Map LeadScore to Prisma ClientProfile enum
const scoreToProfile: Record<LeadScore, string> = {
  qualified: "NEGOTIATING",
  interested: "INTERESTED",
  new_lead: "NEW_LEAD",
};

// Map Prisma ClientProfile back to LeadScore
const profileToScore: Record<string, LeadScore> = {
  NEW_LEAD: "new_lead",
  INTERESTED: "interested",
  NEGOTIATING: "qualified",
  CUSTOMER: "qualified",
  VIP: "qualified",
  CHURNED: "new_lead",
  INACTIVE: "new_lead",
};

interface ClassificationCache {
  reasons: string[];
  suggestedAction?: string;
  updatedAt: string;
}

function getClassificationCache(customFields: any): ClassificationCache | null {
  if (!customFields || typeof customFields !== "object") return null;
  const c = (customFields as any).classification;
  if (!c || !c.updatedAt) return null;
  return c as ClassificationCache;
}

function isCacheValid(contact: { clientProfile: string | null; customFields: any; lastInteractionAt: Date | null }): boolean {
  if (!contact.clientProfile) return false;
  const cache = getClassificationCache(contact.customFields);
  if (!cache) return false;
  if (!contact.lastInteractionAt) return true;
  return new Date(cache.updatedAt) >= contact.lastInteractionAt;
}

async function getContactMessages(contactId: string, orgId: string): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const conversations = await prisma.conversation.findMany({
    where: { contactId, organizationId: orgId },
    select: { id: true },
    orderBy: { lastMessageAt: "desc" },
    take: 3,
  });

  if (conversations.length === 0) return [];

  const messages = await prisma.message.findMany({
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      content: { not: null },
      type: "TEXT",
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { direction: true, content: true },
  });

  return messages
    .filter((m) => m.content)
    .map((m) => ({
      role: m.direction === "INBOUND" ? "user" as const : "assistant" as const,
      content: m.content!,
    }));
}

// Map lead score to expected funnel stage name
const scoreToFunnelStage: Record<LeadScore, string> = {
  qualified: "Qualificado",
  interested: "Novo Lead", // keep in Novo Lead until more interaction
  new_lead: "Novo Lead",
};

async function classifyAndCache(
  contactId: string,
  orgId: string
): Promise<LeadClassification> {
  const messages = await getContactMessages(contactId, orgId);
  const classification = await classifyLead(messages);

  // Get current contact with funnel info
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { customFields: true, funnelId: true, funnelStageId: true },
  });

  const existingFields = (contact?.customFields as any) || {};

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      leadScore: Math.round(classification.confidence),
      clientProfile: scoreToProfile[classification.score] as any,
      customFields: {
        ...existingFields,
        classification: {
          reasons: classification.reasons,
          suggestedAction: classification.suggestedAction || null,
          updatedAt: new Date().toISOString(),
        },
      },
    },
  });

  // Auto-move in funnel based on classification (only advance, never go back)
  if (contact?.funnelId && classification.score === "qualified") {
    try {
      const stages = await prisma.funnelStage.findMany({
        where: { funnelId: contact.funnelId },
        orderBy: { order: "asc" },
        select: { id: true, name: true, order: true },
      });

      const currentStage = stages.find((s) => s.id === contact.funnelStageId);
      const targetStageName = scoreToFunnelStage[classification.score];
      const targetStage = stages.find(
        (s) => s.name.toLowerCase() === targetStageName.toLowerCase()
      );

      // Only move forward (target order > current order)
      if (targetStage && currentStage && targetStage.order > currentStage.order) {
        await prisma.contact.update({
          where: { id: contactId },
          data: { funnelStageId: targetStage.id },
        });
      }
    } catch {
      // Non-critical, don't fail the classification
    }
  }

  return classification;
}

export async function crmRoutes(fastify: FastifyInstance) {
  // GET /crm/leads - List leads with classification
  fastify.get("/leads", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;
    const query = request.query as Record<string, string>;

    const page = Math.max(1, parseInt(query.page || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || "20")));
    const scoreFilter = query.score as string | undefined;
    const search = query.search?.trim();

    // Build filter
    const where: any = { organizationId: orgId, status: "ACTIVE" };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { pushName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get all contacts for counting
    const allContacts = await prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        pushName: true,
        phone: true,
        waId: true,
        profilePicUrl: true,
        leadScore: true,
        clientProfile: true,
        customFields: true,
        lastInteractionAt: true,
        _count: { select: { conversations: true } },
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 1,
          select: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              where: { content: { not: null } },
              select: { content: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { lastInteractionAt: "desc" },
    });

    // Build leads with cached classification
    const leads = allContacts.map((contact) => {
      const hasCache = isCacheValid(contact as any);
      const score: LeadScore = hasCache && contact.clientProfile
        ? (profileToScore[contact.clientProfile] || "new_lead")
        : "new_lead";
      const cache = getClassificationCache(contact.customFields);
      const lastMsg = contact.conversations[0]?.messages[0];

      return {
        id: contact.id,
        customerPhone: contact.phone,
        customerName: contact.name || contact.pushName || contact.phone || "Desconhecido",
        profilePicUrl: contact.profilePicUrl || null,
        lastMessage: lastMsg?.content || null,
        lastMessageAt: lastMsg?.createdAt || contact.lastInteractionAt,
        messageCount: contact._count.conversations,
        score,
        scoreLabel: leadScoreLabels[score],
        confidence: hasCache ? (contact.leadScore || 0) : 0,
        needsClassification: !hasCache,
      };
    });

    // Count by score
    const counts = {
      total: leads.length,
      qualified: leads.filter((l) => l.score === "qualified").length,
      interested: leads.filter((l) => l.score === "interested").length,
      new_lead: leads.filter((l) => l.score === "new_lead").length,
    };

    // Filter by score
    let filtered = leads;
    if (scoreFilter && scoreFilter !== "all") {
      filtered = leads.filter((l) => l.score === scoreFilter);
    }

    // Paginate
    const offset = (page - 1) * limit;
    const paginatedLeads = filtered.slice(offset, offset + limit);

    // Classify leads without cache in background (max 5)
    const needsClassification = allContacts
      .filter((c) => !isCacheValid(c as any))
      .slice(0, 5);

    if (needsClassification.length > 0) {
      Promise.all(
        needsClassification.map((c) =>
          classifyAndCache(c.id, orgId).catch((err) =>
            fastify.log.error({ err, contactId: c.id }, "Background classification failed")
          )
        )
      );
    }

    // Sync profile photos in background for contacts without avatar (max 10)
    const needsPhoto = allContacts
      .filter((c) => !c.profilePicUrl && c.waId)
      .slice(0, 10);

    if (needsPhoto.length > 0) {
      const connection = await prisma.whatsAppConnection.findFirst({
        where: { organizationId: orgId, status: "CONNECTED" },
        select: { uazapiToken: true },
      });

      if (connection?.uazapiToken) {
        for (const c of needsPhoto) {
          fetchProfilePicUrl(connection.uazapiToken, c.waId!)
            .then(async (picUrl) => {
              if (picUrl) {
                await prisma.contact.update({
                  where: { id: c.id },
                  data: { profilePicUrl: picUrl },
                });
              }
            })
            .catch(() => {});
        }
      }
    }

    return {
      success: true,
      data: paginatedLeads,
      counts,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
    };
  });

  // GET /crm/leads/:id - Lead detail with full classification
  fastify.get<{ Params: { id: string } }>("/leads/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
      include: {
        funnelStage: { select: { id: true, name: true, color: true } },
      },
    });

    if (!contact) {
      return reply.notFound("Contato nao encontrado");
    }

    // Get messages for display
    const messages = await getContactMessages(id, orgId);

    // Use cache or classify now
    let classification: LeadClassification;
    if (isCacheValid(contact as any)) {
      const cache = getClassificationCache(contact.customFields);
      const score = profileToScore[contact.clientProfile!] || "new_lead";
      classification = {
        score,
        confidence: contact.leadScore || 0,
        reasons: cache?.reasons || [],
        suggestedAction: cache?.suggestedAction,
      };
    } else {
      classification = await classifyAndCache(id, orgId);
    }

    return {
      success: true,
      data: {
        id: contact.id,
        customerPhone: contact.phone,
        customerName: contact.name || contact.pushName || contact.phone,
        email: contact.email,
        company: contact.company,
        funnelStage: contact.funnelStage,
        messages,
        messageCount: messages.length,
        score: classification.score,
        scoreLabel: leadScoreLabels[classification.score],
        confidence: classification.confidence,
        reasons: classification.reasons,
        suggestedAction: classification.suggestedAction,
        lastInteractionAt: contact.lastInteractionAt,
        createdAt: contact.createdAt,
      },
    };
  });

  // GET /crm/stats - CRM statistics
  fastify.get("/stats", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;

    const contacts = await prisma.contact.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: {
        clientProfile: true,
        leadScore: true,
        customFields: true,
        lastInteractionAt: true,
      },
    });

    let qualified = 0;
    let interested = 0;
    let newLead = 0;

    for (const contact of contacts) {
      const hasCache = isCacheValid(contact as any);
      const score: LeadScore = hasCache && contact.clientProfile
        ? (profileToScore[contact.clientProfile] || "new_lead")
        : "new_lead";

      if (score === "qualified") qualified++;
      else if (score === "interested") interested++;
      else newLead++;
    }

    const total = contacts.length;
    const conversionRate = total > 0 ? ((qualified / total) * 100).toFixed(1) : "0";

    return {
      success: true,
      data: {
        total,
        qualified,
        interested,
        newLead,
        conversionRate,
      },
    };
  });

  // POST /crm/leads/:id/reclassify - Force reclassification
  fastify.post<{ Params: { id: string } }>("/leads/:id/reclassify", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!contact) {
      return reply.notFound("Contato nao encontrado");
    }

    const classification = await classifyAndCache(id, orgId);

    return {
      success: true,
      data: {
        score: classification.score,
        scoreLabel: leadScoreLabels[classification.score],
        confidence: classification.confidence,
        reasons: classification.reasons,
        suggestedAction: classification.suggestedAction,
      },
    };
  });
}
