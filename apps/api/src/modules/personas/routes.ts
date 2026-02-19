import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { createPersonaSchema, updatePersonaSchema } from "@watson/shared";

export async function personaRoutes(fastify: FastifyInstance) {
  // List personas
  fastify.get("/", { preHandler: [fastify.authenticate] }, async (request) => {
    const { orgId } = request.user;

    const personas = await prisma.persona.findMany({
      where: { organizationId: orgId },
      orderBy: [
        { isDefault: "desc" },
        { name: "asc" },
      ],
    });

    return {
      success: true,
      data: personas,
    };
  });

  // Get persona by ID
  fastify.get<{ Params: { id: string } }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const persona = await prisma.persona.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!persona) {
      return reply.notFound("Persona nao encontrada");
    }

    return {
      success: true,
      data: persona,
    };
  });

  // Create persona
  fastify.post("/", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;

    const result = createPersonaSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    // If setting as default, unset other defaults
    if (result.data.isDefault) {
      await prisma.persona.updateMany({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const persona = await prisma.persona.create({
      data: {
        organizationId: orgId,
        ...result.data,
      },
    });

    return reply.code(201).send({
      success: true,
      data: persona,
    });
  });

  // Update persona
  fastify.patch<{ Params: { id: string } }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const result = updatePersonaSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    const persona = await prisma.persona.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!persona) {
      return reply.notFound("Persona nao encontrada");
    }

    // If setting as default, unset other defaults
    if (result.data.isDefault) {
      await prisma.persona.updateMany({
        where: { organizationId: orgId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.persona.update({
      where: { id },
      data: result.data,
    });

    return {
      success: true,
      data: updated,
    };
  });

  // Delete persona
  fastify.delete<{ Params: { id: string } }>("/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;

    const persona = await prisma.persona.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!persona) {
      return reply.notFound("Persona nao encontrada");
    }

    if (persona.isDefault) {
      return reply.badRequest("Nao e possivel deletar a persona padrao");
    }

    await prisma.persona.delete({ where: { id } });

    return { success: true };
  });

  // Test persona (preview response)
  fastify.post<{ Params: { id: string }; Body: { message: string } }>("/:id/test", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user;
    const { id } = request.params;
    const { message } = request.body;

    if (!message?.trim()) {
      return reply.badRequest("Mensagem obrigatoria");
    }

    const persona = await prisma.persona.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!persona) {
      return reply.notFound("Persona nao encontrada");
    }

    // TODO: Implement AI response generation with persona
    // For now, return a placeholder
    const previewResponse = `[Preview com persona "${persona.name}"] Resposta simulada para: "${message}"`;

    return {
      success: true,
      data: {
        response: previewResponse,
        persona: {
          name: persona.name,
          type: persona.type,
          formalityLevel: persona.formalityLevel,
          persuasiveness: persona.persuasiveness,
        },
      },
    };
  });
}
