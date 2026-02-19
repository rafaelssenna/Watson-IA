import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "@watson/database";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      userId: string;
      orgId: string;
      role: string;
    };
    user: {
      userId: string;
      orgId: string;
      role: string;
    };
  }
}

async function authenticatePlugin(fastify: FastifyInstance) {
  fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();

      // Check subscription status
      const { orgId } = request.user;
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          subscriptionStatus: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
        },
      });

      if (!org) {
        return reply.unauthorized("Organizacao nao encontrada");
      }

      // Check trial expiration
      if (org.subscriptionStatus === "TRIAL") {
        if (org.trialEndsAt && org.trialEndsAt < new Date()) {
          return reply.code(402).send({
            success: false,
            error: {
              code: "TRIAL_EXPIRED",
              message: "Seu periodo de teste expirou. Assine para continuar.",
              requiresPayment: true,
            },
          });
        }
      }

      // Check subscription status
      if (org.subscriptionStatus === "CANCELLED" || org.subscriptionStatus === "PAST_DUE") {
        return reply.code(402).send({
          success: false,
          error: {
            code: "SUBSCRIPTION_INACTIVE",
            message: "Sua assinatura esta inativa. Atualize seu pagamento.",
            requiresPayment: true,
          },
        });
      }
    } catch (err) {
      return reply.unauthorized("Token invalido ou expirado");
    }
  });
}

export default fp(authenticatePlugin, {
  name: "authenticate",
  dependencies: ["@fastify/jwt"],
});
