import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { triggerAutomationCheck } from "../../services/automation.service.js";

export async function automationRoutes(fastify: FastifyInstance) {
  // Get all automations for organization
  fastify.get("/", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;

    const automations = await prisma.automation.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { executions: true },
        },
      },
    });

    return {
      success: true,
      data: automations.map((a) => ({
        ...a,
        executionsCount: a._count.executions,
        _count: undefined,
      })),
    };
  });

  // Get single automation
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orgId } = request.user;
      const { id } = request.params;

      const automation = await prisma.automation.findFirst({
        where: { id, organizationId: orgId },
        include: {
          executions: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!automation) {
        return reply.notFound("Automation not found");
      }

      return { success: true, data: automation };
    }
  );

  // Create automation
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      type: string;
      triggerDelayHours?: number;
      messageTemplate?: string;
      useAI?: boolean;
      maxExecutionsPerConversation?: number;
      respectBusinessHours?: boolean;
      onlyWhenWaitingClient?: boolean;
      isActive?: boolean;
    };
  }>("/", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const {
      name,
      description,
      type,
      triggerDelayHours,
      messageTemplate,
      useAI,
      maxExecutionsPerConversation,
      respectBusinessHours,
      onlyWhenWaitingClient,
      isActive,
    } = request.body;

    const automation = await prisma.automation.create({
      data: {
        organizationId: orgId,
        name,
        description,
        type: type as any,
        triggerDelayHours,
        messageTemplate,
        useAI: useAI ?? false,
        maxExecutionsPerConversation: maxExecutionsPerConversation ?? 1,
        respectBusinessHours: respectBusinessHours ?? true,
        onlyWhenWaitingClient: onlyWhenWaitingClient ?? true,
        isActive: isActive ?? true,
      },
    });

    fastify.log.info({ automationId: automation.id }, "Automation created");

    return reply.code(201).send({ success: true, data: automation });
  });

  // Update automation
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      triggerDelayHours?: number;
      messageTemplate?: string;
      useAI?: boolean;
      maxExecutionsPerConversation?: number;
      respectBusinessHours?: boolean;
      onlyWhenWaitingClient?: boolean;
      isActive?: boolean;
    };
  }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;
    const data = request.body;

    // Check if automation exists and belongs to org
    const existing = await prisma.automation.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return reply.notFound("Automation not found");
    }

    const automation = await prisma.automation.update({
      where: { id },
      data,
    });

    fastify.log.info({ automationId: automation.id }, "Automation updated");

    return { success: true, data: automation };
  });

  // Delete automation
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orgId } = request.user;
      const { id } = request.params;

      // Check if automation exists and belongs to org
      const existing = await prisma.automation.findFirst({
        where: { id, organizationId: orgId },
      });

      if (!existing) {
        return reply.notFound("Automation not found");
      }

      await prisma.automation.delete({ where: { id } });

      fastify.log.info({ automationId: id }, "Automation deleted");

      return { success: true };
    }
  );

  // Toggle automation active state
  fastify.post<{ Params: { id: string } }>(
    "/:id/toggle",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orgId } = request.user;
      const { id } = request.params;

      // Check if automation exists and belongs to org
      const existing = await prisma.automation.findFirst({
        where: { id, organizationId: orgId },
      });

      if (!existing) {
        return reply.notFound("Automation not found");
      }

      const automation = await prisma.automation.update({
        where: { id },
        data: { isActive: !existing.isActive },
      });

      fastify.log.info(
        { automationId: automation.id, isActive: automation.isActive },
        "Automation toggled"
      );

      return { success: true, data: automation };
    }
  );

  // Get automation execution history
  fastify.get<{ Params: { id: string }; Querystring: { limit?: number } }>(
    "/:id/executions",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orgId } = request.user;
      const { id } = request.params;
      const limit = request.query.limit || 50;

      // Check if automation exists and belongs to org
      const existing = await prisma.automation.findFirst({
        where: { id, organizationId: orgId },
      });

      if (!existing) {
        return reply.notFound("Automation not found");
      }

      const executions = await prisma.automationExecution.findMany({
        where: { automationId: id },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return { success: true, data: executions };
    }
  );

  // Manually trigger automation check (for testing)
  fastify.post(
    "/trigger-check",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      fastify.log.info("Manual automation check triggered");
      await triggerAutomationCheck(fastify.log);
      return { success: true, message: "Automation check triggered" };
    }
  );

  // ============================================
  // REMARKETING ENDPOINTS
  // ============================================

  // Get remarketing config + stats
  fastify.get("/remarketing/config", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { remarketingEnabled: true },
    });

    // Count conversations per step
    const stepCounts = await prisma.conversation.groupBy({
      by: ["followUpStep"],
      where: {
        organizationId: orgId,
        followUpStep: { gte: 1 },
        remarketingEnabled: true,
      },
      _count: true,
    });

    const steps = Array.from({ length: 7 }, (_, i) => {
      const found = stepCounts.find((s) => s.followUpStep === i + 1);
      return { step: i + 1, count: found?._count ?? 0 };
    });

    const totalActive = steps.reduce((sum, s) => sum + s.count, 0);

    return {
      success: true,
      data: {
        enabled: org?.remarketingEnabled ?? true,
        totalActive,
        steps,
      },
    };
  });

  // Toggle remarketing on/off
  fastify.patch<{ Body: { enabled: boolean } }>(
    "/remarketing/config",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orgId } = request.user;
      const { enabled } = request.body;

      await prisma.organization.update({
        where: { id: orgId },
        data: { remarketingEnabled: enabled },
      });

      // If disabling, clear all pending follow-ups
      if (!enabled) {
        await prisma.conversation.updateMany({
          where: {
            organizationId: orgId,
            followUpStep: { gte: 1 },
          },
          data: {
            followUpStep: 0,
            followUpNextAt: null,
          },
        });
      }

      fastify.log.info({ orgId, enabled }, "Remarketing toggled");

      return { success: true, data: { enabled } };
    }
  );

  // Get active remarketing conversations
  fastify.get("/remarketing/active", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;

    const conversations = await prisma.conversation.findMany({
      where: {
        organizationId: orgId,
        followUpStep: { gte: 1 },
        remarketingEnabled: true,
      },
      include: {
        contact: { select: { name: true, waId: true } },
      },
      orderBy: { followUpNextAt: "asc" },
      take: 50,
    });

    return {
      success: true,
      data: conversations.map((c) => ({
        id: c.id,
        contactName: c.contact.name,
        contactWaId: c.contact.waId,
        currentStep: c.followUpStep,
        nextAt: c.followUpNextAt,
      })),
    };
  });
}
