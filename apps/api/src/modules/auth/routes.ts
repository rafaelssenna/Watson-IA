import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@watson/shared";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendPasswordResetEmail } from "../../services/email.service.js";

const SALT_ROUNDS = 12;
const TRIAL_DAYS = 7;

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post<{ Body: RegisterInput }>("/register", async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    const { email, password, name, organizationName } = result.data;

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
  fastify.post("/logout", { preHandler: [fastify.authenticate] }, async (request) => {
    const { refreshToken } = request.body as { refreshToken?: string };

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    return { success: true, message: "Logout realizado com sucesso" };
  });

  // Save push notification token
  fastify.post<{ Body: { pushToken: string } }>(
    "/push-token",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { userId } = request.user;
      const { pushToken } = request.body;

      await prisma.user.update({
        where: { id: userId },
        data: { pushToken },
      });

      return { success: true };
    }
  );

  // Get current user
  fastify.get("/me", { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user as { userId: string; orgId: string };

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
        notificationPhone: user.organization.notificationPhone,
      },
    };
  });

  // Get/Set notification phone for organization
  fastify.patch<{ Body: { notificationPhone: string } }>(
    "/notification-phone",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { orgId } = request.user;
      const { notificationPhone } = request.body;

      await prisma.organization.update({
        where: { id: orgId },
        data: { notificationPhone: notificationPhone || null },
      });

      return { success: true, data: { notificationPhone } };
    }
  );

  // Forgot Password - Request reset code
  fastify.post<{ Body: { email: string } }>("/forgot-password", async (request, reply) => {
    const { email } = request.body;

    console.log(`[FORGOT-PASSWORD] Request received for email: ${email}`);

    if (!email) {
      return reply.badRequest("Email obrigatorio");
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      console.log(`[FORGOT-PASSWORD] User NOT found for: ${email}`);
      return {
        success: true,
        message: "Se o email existir, voce recebera um codigo de recuperacao",
      };
    }

    console.log(`[FORGOT-PASSWORD] User found: ${user.name} (${user.email})`);

    // Delete any existing tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email: user.email },
    });

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await prisma.passwordResetToken.create({
      data: {
        token: resetCode,
        email: user.email,
        expiresAt,
      },
    });

    console.log(`[FORGOT-PASSWORD] Code generated: ${resetCode} for ${user.email}`);

    // Send email
    const emailSent = await sendPasswordResetEmail(user.email, resetCode, user.name);

    console.log(`[FORGOT-PASSWORD] Email sent result: ${emailSent}`);

    if (!emailSent) {
      console.error(`[FORGOT-PASSWORD] FAILED to send email to ${user.email}`);
    }

    return {
      success: true,
      message: "Se o email existir, voce recebera um codigo de recuperacao",
    };
  });

  // Verify Reset Code
  fastify.post<{ Body: { email: string; code: string } }>("/verify-reset-code", async (request, reply) => {
    const { email, code } = request.body;

    if (!email || !code) {
      return reply.badRequest("Email e codigo obrigatorios");
    }

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        token: code,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      return reply.badRequest("Codigo invalido ou expirado");
    }

    return {
      success: true,
      message: "Codigo valido",
    };
  });

  // Reset Password
  fastify.post<{ Body: { email: string; code: string; newPassword: string } }>("/reset-password", async (request, reply) => {
    const { email, code, newPassword } = request.body;

    if (!email || !code || !newPassword) {
      return reply.badRequest("Email, codigo e nova senha obrigatorios");
    }

    if (newPassword.length < 6) {
      return reply.badRequest("Senha deve ter no minimo 6 caracteres");
    }

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        token: code,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      return reply.badRequest("Codigo invalido ou expirado");
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return reply.badRequest("Usuario nao encontrado");
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    // Invalidate all refresh tokens for this user (security measure)
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    return {
      success: true,
      message: "Senha alterada com sucesso",
    };
  });
}
