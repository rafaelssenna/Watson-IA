import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@watson/database";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@watson/shared";
import bcrypt from "bcrypt";
import crypto from "crypto";

const SALT_ROUNDS = 12;
const TRIAL_DAYS = 7;

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post<{ Body: RegisterInput }>("/register", async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    const { email, password, name, organizationName, phone } = result.data;

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.conflict("Email ja cadastrado");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create organization with trial
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    const slug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: `${slug}-${crypto.randomBytes(3).toString("hex")}`,
        subscriptionStatus: "TRIAL",
        trialEndsAt,
        users: {
          create: {
            email,
            passwordHash,
            name,
            role: "OWNER",
          },
        },
        // Create default persona
        personas: {
          create: {
            name: "Assistente Padrao",
            type: "SECRETARY",
            isDefault: true,
            formalityLevel: 50,
            persuasiveness: 50,
            energyLevel: 50,
            empathyLevel: 70,
          },
        },
        // Create default funnel
        funnels: {
          create: {
            name: "Funil Padrao",
            isDefault: true,
            stages: {
              create: [
                { name: "Novo Lead", order: 0, color: "#6366f1" },
                { name: "Qualificado", order: 1, color: "#8b5cf6" },
                { name: "Em Negociacao", order: 2, color: "#a855f7" },
                { name: "Proposta Enviada", order: 3, color: "#d946ef" },
                { name: "Fechado - Ganho", order: 4, color: "#22c55e" },
                { name: "Fechado - Perdido", order: 5, color: "#ef4444" },
              ],
            },
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = organization.users[0];

    // Generate tokens
    const accessToken = fastify.jwt.sign({
      userId: user.id,
      orgId: organization.id,
      role: user.role,
    });

    const refreshToken = crypto.randomUUID();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    return reply.code(201).send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: organization.id,
          organizationName: organization.name,
        },
        accessToken,
        refreshToken,
        trialEndsAt: organization.trialEndsAt,
      },
    });
  });

  // Login
  fastify.post<{ Body: LoginInput }>("/login", async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.unauthorized("Email ou senha invalidos");
    }

    // Check subscription status
    const org = user.organization;
    if (org.subscriptionStatus === "TRIAL" && org.trialEndsAt && org.trialEndsAt < new Date()) {
      return reply.code(402).send({
        success: false,
        error: {
          code: "TRIAL_EXPIRED",
          message: "Seu periodo de teste expirou. Assine para continuar.",
        },
      });
    }

    if (org.subscriptionStatus === "CANCELLED") {
      return reply.code(402).send({
        success: false,
        error: {
          code: "SUBSCRIPTION_CANCELLED",
          message: "Sua assinatura foi cancelada. Reative para continuar.",
        },
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const accessToken = fastify.jwt.sign({
      userId: user.id,
      orgId: org.id,
      role: user.role,
    });

    const refreshToken = crypto.randomUUID();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: org.id,
          organizationName: org.name,
        },
        accessToken,
        refreshToken,
        subscriptionStatus: org.subscriptionStatus,
        trialEndsAt: org.trialEndsAt,
      },
    };
  });

  // Refresh token
  fastify.post<{ Body: { refreshToken: string } }>("/refresh", async (request, reply) => {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      return reply.badRequest("Refresh token obrigatorio");
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return reply.unauthorized("Refresh token invalido ou expirado");
    }

    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId },
      include: { organization: true },
    });

    if (!user) {
      return reply.unauthorized("Usuario nao encontrado");
    }

    // Delete old refresh token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Generate new tokens
    const accessToken = fastify.jwt.sign({
      userId: user.id,
      orgId: user.organizationId,
      role: user.role,
    });

    const newRefreshToken = crypto.randomUUID();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    };
  });

  // Logout
  fastify.post("/logout", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    return { success: true, message: "Logout realizado com sucesso" };
  });

  // Get current user
  fastify.get("/me", { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId, orgId } = request.user as { userId: string; orgId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user) {
      throw fastify.httpErrors.notFound("Usuario nao encontrado");
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        subscriptionStatus: user.organization.subscriptionStatus,
        trialEndsAt: user.organization.trialEndsAt,
      },
    };
  });
}
