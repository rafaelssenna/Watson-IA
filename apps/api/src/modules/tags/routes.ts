import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { analyzeAndApplyTags } from "../../services/autoTag.service.js";

export async function tagRoutes(fastify: FastifyInstance) {
  // List tags for organization
  fastify.get("/", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;

    const tags = await prisma.tag.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
    });

    return {
      success: true,
      data: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        description: tag.description,
        isAuto: tag.isAuto,
        contactCount: tag._count.contacts,
      })),
    };
  });

  // Create tag
  fastify.post<{
    Body: {
      name: string;
      color?: string;
      description?: string;
      isAuto?: boolean;
    };
  }>("/", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { name, color, description, isAuto } = request.body;

    if (!name?.trim()) {
      return reply.badRequest("Nome da tag obrigatorio");
    }

    // Check if tag already exists
    const existing = await prisma.tag.findFirst({
      where: { organizationId: orgId, name: name.trim() },
    });

    if (existing) {
      return reply.conflict("Tag ja existe");
    }

    const tag = await prisma.tag.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        color: color || "#6366f1",
        description: description?.trim(),
        isAuto: isAuto || false,
      },
    });

    return reply.code(201).send({
      success: true,
      data: tag,
    });
  });

  // Update tag
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      color?: string;
      description?: string;
      isAuto?: boolean;
    };
  }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;
    const { name, color, description, isAuto } = request.body;

    const tag = await prisma.tag.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!tag) {
      return reply.notFound("Tag nao encontrada");
    }

    // Check if new name conflicts with existing tag
    if (name && name.trim() !== tag.name) {
      const existing = await prisma.tag.findFirst({
        where: { organizationId: orgId, name: name.trim(), id: { not: id } },
      });
      if (existing) {
        return reply.conflict("Tag com esse nome ja existe");
      }
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(color && { color }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isAuto !== undefined && { isAuto }),
      },
    });

    return {
      success: true,
      data: updated,
    };
  });

  // Delete tag
  fastify.delete<{ Params: { id: string } }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const tag = await prisma.tag.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!tag) {
      return reply.notFound("Tag nao encontrada");
    }

    await prisma.tag.delete({ where: { id } });

    return { success: true };
  });

  // Auto-tag a contact based on conversation
  fastify.post<{
    Params: { contactId: string };
  }>("/auto-tag/:contactId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { contactId } = request.params;

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
    });

    if (!contact) {
      return reply.notFound("Contato nao encontrado");
    }

    // Get recent messages from conversations
    const messages = await prisma.message.findMany({
      where: {
        conversation: {
          contactId,
          organizationId: orgId,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        content: true,
        direction: true,
      },
    });

    if (messages.length === 0) {
      return {
        success: true,
        data: { appliedTags: [], message: "Nenhuma mensagem encontrada para analisar" },
      };
    }

    // Get all auto-tags for the organization
    const autoTags = await prisma.tag.findMany({
      where: { organizationId: orgId, isAuto: true },
    });

    if (autoTags.length === 0) {
      return {
        success: true,
        data: { appliedTags: [], message: "Nenhuma tag automatica configurada" },
      };
    }

    // Build conversation text
    const conversationText = messages
      .reverse()
      .map((m) => `${m.direction === "INBOUND" ? "Cliente" : "Atendente"}: ${m.content}`)
      .join("\n");

    // Analyze and apply tags
    const appliedTags = await analyzeAndApplyTags(
      orgId,
      contactId,
      conversationText,
      autoTags,
      fastify.log
    );

    return {
      success: true,
      data: {
        appliedTags,
        analyzedMessages: messages.length,
      },
    };
  });

  // Get popular/suggested tags (for new orgs or suggestions)
  fastify.get("/suggestions", { preHandler: [fastify.authenticate] }, async () => {
    // Return common tag suggestions
    const suggestions = [
      { name: "Cliente VIP", color: "#f59e0b", description: "Cliente importante ou que compra com frequencia", isAuto: true },
      { name: "Interessado", color: "#10b981", description: "Demonstrou interesse em produtos ou servicos", isAuto: true },
      { name: "Reclamacao", color: "#ef4444", description: "Cliente fez reclamacao ou esta insatisfeito", isAuto: true },
      { name: "Suporte", color: "#3b82f6", description: "Precisa de suporte tecnico ou ajuda", isAuto: true },
      { name: "Orcamento", color: "#8b5cf6", description: "Pediu orcamento ou preco", isAuto: true },
      { name: "Urgente", color: "#dc2626", description: "Assunto urgente que precisa de atencao rapida", isAuto: true },
      { name: "Novo Lead", color: "#06b6d4", description: "Novo potencial cliente", isAuto: true },
      { name: "Retorno", color: "#84cc16", description: "Cliente antigo que voltou a fazer contato", isAuto: true },
    ];

    return {
      success: true,
      data: suggestions,
    };
  });

  // Create default tags for organization
  fastify.post("/setup-defaults", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;

    // Check if org already has tags
    const existingCount = await prisma.tag.count({
      where: { organizationId: orgId },
    });

    if (existingCount > 0) {
      return {
        success: true,
        data: { message: "Organizacao ja tem tags configuradas", created: 0 },
      };
    }

    // Create default tags
    const defaultTags = [
      { name: "Cliente VIP", color: "#f59e0b", description: "Cliente importante ou que compra com frequencia", isAuto: true },
      { name: "Interessado", color: "#10b981", description: "Demonstrou interesse em produtos ou servicos", isAuto: true },
      { name: "Reclamacao", color: "#ef4444", description: "Cliente fez reclamacao ou esta insatisfeito", isAuto: true },
      { name: "Suporte", color: "#3b82f6", description: "Precisa de suporte tecnico ou ajuda", isAuto: true },
      { name: "Orcamento", color: "#8b5cf6", description: "Pediu orcamento ou preco", isAuto: true },
      { name: "Urgente", color: "#dc2626", description: "Assunto urgente que precisa de atencao rapida", isAuto: true },
    ];

    const created = await prisma.tag.createMany({
      data: defaultTags.map((tag) => ({
        organizationId: orgId,
        ...tag,
      })),
    });

    return reply.code(201).send({
      success: true,
      data: { message: "Tags padrao criadas", created: created.count },
    });
  });
}
