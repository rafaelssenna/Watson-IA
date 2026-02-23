import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";

export async function triggerRoutes(fastify: FastifyInstance) {
  // Get all triggers for organization
  fastify.get("/", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;

    const triggers = await prisma.trigger.findMany({
      where: { organizationId: orgId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return {
      success: true,
      data: triggers,
    };
  });

  // Get single trigger
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orgId } = request.user;
      const { id } = request.params;

      const trigger = await prisma.trigger.findFirst({
        where: { id, organizationId: orgId },
      });

      if (!trigger) {
        return reply.notFound("Trigger not found");
      }

      return { success: true, data: trigger };
    }
  );

  // Create trigger
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      triggerType: string;
      conditions: Record<string, any>;
      actions: Record<string, any>;
      priority?: number;
      isActive?: boolean;
    };
  }>("/", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { name, description, triggerType, conditions, actions, priority, isActive } =
      request.body;

    const trigger = await prisma.trigger.create({
      data: {
        organizationId: orgId,
        name,
        description,
        triggerType: triggerType as any,
        conditions,
        actions,
        priority: priority ?? 0,
        isActive: isActive ?? true,
      },
    });

    fastify.log.info({ triggerId: trigger.id }, "Trigger created");

    return reply.code(201).send({ success: true, data: trigger });
  });

  // Update trigger
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      triggerType?: string;
      conditions?: Record<string, any>;
      actions?: Record<string, any>;
      priority?: number;
      isActive?: boolean;
    };
  }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;
    const { name, description, triggerType, conditions, actions, priority, isActive } =
      request.body;

    // Check if trigger exists and belongs to org
    const existing = await prisma.trigger.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return reply.notFound("Trigger not found");
    }

    const trigger = await prisma.trigger.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(triggerType !== undefined && { triggerType: triggerType as any }),
        ...(conditions !== undefined && { conditions }),
        ...(actions !== undefined && { actions }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    fastify.log.info({ triggerId: trigger.id }, "Trigger updated");

    return { success: true, data: trigger };
  });

  // Delete trigger
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orgId } = request.user;
      const { id } = request.params;

      // Check if trigger exists and belongs to org
      const existing = await prisma.trigger.findFirst({
        where: { id, organizationId: orgId },
      });

      if (!existing) {
        return reply.notFound("Trigger not found");
      }

      await prisma.trigger.delete({ where: { id } });

      fastify.log.info({ triggerId: id }, "Trigger deleted");

      return { success: true };
    }
  );

  // Toggle trigger active state
  fastify.post<{ Params: { id: string } }>(
    "/:id/toggle",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orgId } = request.user;
      const { id } = request.params;

      // Check if trigger exists and belongs to org
      const existing = await prisma.trigger.findFirst({
        where: { id, organizationId: orgId },
      });

      if (!existing) {
        return reply.notFound("Trigger not found");
      }

      const trigger = await prisma.trigger.update({
        where: { id },
        data: { isActive: !existing.isActive },
      });

      fastify.log.info(
        { triggerId: trigger.id, isActive: trigger.isActive },
        "Trigger toggled"
      );

      return { success: true, data: trigger };
    }
  );

  // Get trigger types (for UI)
  fastify.get("/types", { preHandler: [fastify.authenticate] }, async () => {
    const triggerTypes = [
      {
        type: "KEYWORD",
        name: "Palavra-chave",
        description: "Dispara quando o cliente menciona palavras específicas",
        icon: "text-outline",
        conditionsSchema: {
          keywords: { type: "array", label: "Palavras-chave" },
          matchType: {
            type: "select",
            label: "Tipo de correspondência",
            options: [
              { value: "any", label: "Qualquer palavra" },
              { value: "all", label: "Todas as palavras" },
              { value: "exact", label: "Correspondência exata" },
            ],
          },
        },
      },
      {
        type: "INTENT",
        name: "Intenção",
        description: "Dispara quando detecta a intenção do cliente",
        icon: "bulb-outline",
        conditionsSchema: {
          intents: {
            type: "multiselect",
            label: "Intenções",
            options: [
              { value: "PURCHASE", label: "Intenção de compra" },
              { value: "COMPLAINT", label: "Reclamação" },
              { value: "SUPPORT", label: "Suporte" },
              { value: "SHIPPING", label: "Entrega/Frete" },
              { value: "CANCEL", label: "Cancelamento" },
              { value: "HUMAN", label: "Falar com humano" },
            ],
          },
        },
      },
      {
        type: "NEW_CONTACT",
        name: "Novo contato",
        description: "Dispara na primeira mensagem de um novo contato",
        icon: "person-add-outline",
        conditionsSchema: {},
      },
      {
        type: "OUT_OF_HOURS",
        name: "Fora do horário",
        description: "Dispara quando mensagem chega fora do expediente",
        icon: "moon-outline",
        conditionsSchema: {
          businessHoursStart: { type: "time", label: "Horário de abertura" },
          businessHoursEnd: { type: "time", label: "Horário de fechamento" },
          workDays: {
            type: "multiselect",
            label: "Dias de funcionamento",
            options: [
              { value: "seg", label: "Segunda" },
              { value: "ter", label: "Terça" },
              { value: "qua", label: "Quarta" },
              { value: "qui", label: "Quinta" },
              { value: "sex", label: "Sexta" },
              { value: "sab", label: "Sábado" },
              { value: "dom", label: "Domingo" },
            ],
          },
        },
      },
      {
        type: "URGENCY",
        name: "Urgência",
        description: "Dispara quando detecta urgência na mensagem",
        icon: "alert-circle-outline",
        conditionsSchema: {},
      },
      {
        type: "SENTIMENT",
        name: "Sentimento negativo",
        description: "Dispara quando detecta cliente insatisfeito",
        icon: "sad-outline",
        conditionsSchema: {},
      },
    ];

    const actionTypes = [
      { type: "sendMessage", name: "Enviar mensagem", icon: "chatbubble-outline" },
      { type: "transferToHuman", name: "Transferir para humano", icon: "person-outline" },
      { type: "notifyTeam", name: "Notificar equipe", icon: "notifications-outline" },
      { type: "skipAIResponse", name: "Não responder com IA", icon: "pause-outline" },
    ];

    return {
      success: true,
      data: {
        triggerTypes,
        actionTypes,
      },
    };
  });
}
