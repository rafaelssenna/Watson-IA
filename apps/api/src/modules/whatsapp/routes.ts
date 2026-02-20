import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import crypto from "crypto";

// Uazapi API config
const UAZAPI_BASE_URL = process.env.UAZAPI_BASE_URL || "https://hia-clientes.uazapi.com";
const UAZAPI_ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;

// Helper: Create instance on Uazapi
async function createUazapiInstance(orgId: string, orgName: string): Promise<{ token: string; instanceName: string } | null> {
  console.log(`[createUazapiInstance] Starting - orgId: ${orgId}, orgName: ${orgName}`);
  console.log(`[createUazapiInstance] UAZAPI_ADMIN_TOKEN exists: ${!!UAZAPI_ADMIN_TOKEN}, length: ${UAZAPI_ADMIN_TOKEN?.length}`);
  console.log(`[createUazapiInstance] UAZAPI_BASE_URL: ${UAZAPI_BASE_URL}`);

  if (!UAZAPI_ADMIN_TOKEN) {
    console.error("[createUazapiInstance] No admin token");
    return null;
  }

  try {
    // Generate unique instance name
    const instanceName = `watson-${orgId.slice(0, 8)}-${crypto.randomBytes(3).toString("hex")}`;
    console.log(`[createUazapiInstance] Instance name: ${instanceName}`);

    const url = `${UAZAPI_BASE_URL}/instance/init`;
    const body = {
      name: instanceName,
      systemName: "WatsonAI",
      adminField01: orgId,
      adminField02: orgName,
    };
    console.log(`[createUazapiInstance] Calling: ${url}`);
    console.log(`[createUazapiInstance] Body: ${JSON.stringify(body)}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UAZAPI_ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log(`[createUazapiInstance] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[createUazapiInstance] Failed: ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log(`[createUazapiInstance] Success - token length: ${data.token?.length}, name: ${data.name}`);

    return {
      token: data.token,
      instanceName: data.name || instanceName,
    };
  } catch (error) {
    console.error("[createUazapiInstance] Exception:", error);
    return null;
  }
}

// Helper: Get or create WhatsApp connection
// Now uses the instance token directly from env (no admin token needed)
async function getOrCreateConnection(orgId: string, fastify: FastifyInstance) {
  fastify.log.info(`[getOrCreateConnection] Starting for orgId: ${orgId}`);

  let connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: orgId },
  });

  fastify.log.info(`[getOrCreateConnection] Existing connection: ${connection ? `id=${connection.id}, hasToken=${!!connection.uazapiToken}` : 'none'}`);

  // If no connection, create one using the instance token from env
  if (!connection) {
    if (!UAZAPI_ADMIN_TOKEN) {
      fastify.log.error("[getOrCreateConnection] UAZAPI_ADMIN_TOKEN is not configured");
      return { connection: null, error: "Token Uazapi nao configurado no servidor" };
    }

    fastify.log.info(`[getOrCreateConnection] Creating connection with env token (length: ${UAZAPI_ADMIN_TOKEN.length})`);

    connection = await prisma.whatsAppConnection.create({
      data: {
        organizationId: orgId,
        connectionType: "UAZAPI",
        uazapiToken: UAZAPI_ADMIN_TOKEN,
        uazapiInstance: "watson-instance",
        status: "DISCONNECTED",
      },
    });
    fastify.log.info(`[getOrCreateConnection] Created new connection: ${connection.id}`);
  }

  // If connection exists but has no token, update with env token
  if (!connection.uazapiToken && UAZAPI_ADMIN_TOKEN) {
    connection = await prisma.whatsAppConnection.update({
      where: { id: connection.id },
      data: {
        uazapiToken: UAZAPI_ADMIN_TOKEN,
      },
    });
    fastify.log.info(`[getOrCreateConnection] Updated connection with env token`);
  }

  return { connection, error: null };
}

export async function whatsappRoutes(fastify: FastifyInstance) {
  // Get current connection status
  fastify.get("/status", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user as { userId: string; orgId: string };

    const connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: orgId },
    });

    if (!connection) {
      return {
        success: true,
        data: {
          status: "DISCONNECTED",
          hasConnection: false,
        },
      };
    }

    // If we have uazapi token, check real status
    if (connection.uazapiToken) {
      try {
        const response = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
          headers: {
            Authorization: `Bearer ${connection.uazapiToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const uazapiStatus = data.instance?.status || "disconnected";

          // Map uazapi status to our status
          let status = "DISCONNECTED";
          if (uazapiStatus === "connected") status = "CONNECTED";
          else if (uazapiStatus === "connecting") status = "CONNECTING";

          // Update local status
          await prisma.whatsAppConnection.update({
            where: { id: connection.id },
            data: {
              status: status as any,
              phoneNumber: data.status?.jid?.user || connection.phoneNumber,
              displayName: data.instance?.profileName || connection.displayName,
              profilePicUrl: data.instance?.profilePicUrl || connection.profilePicUrl,
              lastConnectedAt: status === "CONNECTED" ? new Date() : connection.lastConnectedAt,
            },
          });

          return {
            success: true,
            data: {
              status,
              hasConnection: true,
              phoneNumber: data.status?.jid?.user || connection.phoneNumber,
              displayName: data.instance?.profileName || connection.displayName,
              profilePicUrl: data.instance?.profilePicUrl,
              qrcode: data.instance?.qrcode,
              pairingCode: data.instance?.pairingCode,
            },
          };
        }
      } catch (error) {
        fastify.log.error("Uazapi status check error:", error);
      }
    }

    return {
      success: true,
      data: {
        status: connection.status,
        hasConnection: true,
        phoneNumber: connection.phoneNumber,
        displayName: connection.displayName,
        profilePicUrl: connection.profilePicUrl,
      },
    };
  });

  // Connect via QR Code (no phone provided)
  fastify.post("/connect/qrcode", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user as { userId: string; orgId: string };

    // Get or create connection (auto-creates instance if needed)
    const { connection, error } = await getOrCreateConnection(orgId, fastify);

    if (!connection) {
      return reply.badRequest(error || "Erro ao configurar conexao WhatsApp");
    }

    try {
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.uazapiToken}`,
          "Content-Type": "application/json",
        },
        // No body = QR Code mode
      });

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.error("Uazapi connect error:", errorText);
        return reply.code(response.status).send({
          success: false,
          error: "Erro ao conectar com Uazapi",
        });
      }

      const data = await response.json();

      // Update connection status
      await prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: "CONNECTING" },
      });

      return {
        success: true,
        data: {
          qrcode: data.instance?.qrcode,
          status: "CONNECTING",
        },
      };
    } catch (error) {
      fastify.log.error("Uazapi connect error:", error);
      return reply.internalServerError("Erro ao conectar com Uazapi");
    }
  });

  // Connect via pairing code (phone provided)
  fastify.post<{ Body: { phone: string } }>("/connect/code", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user as { userId: string; orgId: string };
    const { phone } = request.body;

    fastify.log.info(`[WhatsApp Connect Code] Started - orgId: ${orgId}, phone: ${phone}`);
    fastify.log.info(`[WhatsApp Connect Code] UAZAPI_ADMIN_TOKEN exists: ${!!UAZAPI_ADMIN_TOKEN}`);

    if (!phone) {
      fastify.log.warn("[WhatsApp Connect Code] Phone is missing");
      return reply.badRequest("Numero de telefone obrigatorio");
    }

    // Clean phone number - keep only digits
    const cleanPhone = phone.replace(/\D/g, "");
    fastify.log.info(`[WhatsApp Connect Code] Clean phone: ${cleanPhone}`);

    // Get or create connection (auto-creates instance if needed)
    fastify.log.info("[WhatsApp Connect Code] Getting or creating connection...");
    const { connection, error } = await getOrCreateConnection(orgId, fastify);

    if (!connection) {
      fastify.log.error(`[WhatsApp Connect Code] Connection failed: ${error}`);
      return reply.badRequest(error || "Erro ao configurar conexao WhatsApp");
    }

    fastify.log.info(`[WhatsApp Connect Code] Connection ready - id: ${connection.id}, token exists: ${!!connection.uazapiToken}`);

    try {
      const url = `${UAZAPI_BASE_URL}/instance/connect`;
      const body = JSON.stringify({ phone: cleanPhone });
      fastify.log.info(`[WhatsApp Connect Code] Calling Uazapi: ${url}`);
      fastify.log.info(`[WhatsApp Connect Code] Request body: ${body}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.uazapiToken}`,
          "Content-Type": "application/json",
        },
        body,
      });

      fastify.log.info(`[WhatsApp Connect Code] Uazapi response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.error(`[WhatsApp Connect Code] Uazapi error response: ${errorText}`);
        return reply.code(response.status).send({
          success: false,
          error: `Erro Uazapi: ${errorText}`,
        });
      }

      const data = await response.json();
      fastify.log.info(`[WhatsApp Connect Code] Uazapi response data: ${JSON.stringify(data)}`);

      // Update connection status
      await prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: "CONNECTING" },
      });

      fastify.log.info(`[WhatsApp Connect Code] Success - pairingCode: ${data.instance?.pairingCode}`);

      return {
        success: true,
        data: {
          pairingCode: data.instance?.pairingCode,
          status: "CONNECTING",
        },
      };
    } catch (error) {
      fastify.log.error("[WhatsApp Connect Code] Exception:", error);
      return reply.internalServerError("Erro ao conectar com Uazapi");
    }
  });

  // Disconnect
  fastify.post("/disconnect", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user as { userId: string; orgId: string };

    const connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: orgId },
    });

    if (!connection || !connection.uazapiToken) {
      return reply.badRequest("Conexao WhatsApp nao encontrada");
    }

    try {
      await fetch(`${UAZAPI_BASE_URL}/instance/disconnect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.uazapiToken}`,
        },
      });

      // Update local status regardless of API response
      await prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: {
          status: "DISCONNECTED",
          lastDisconnectedAt: new Date(),
        },
      });

      return {
        success: true,
        message: "Desconectado com sucesso",
      };
    } catch (error) {
      fastify.log.error("Uazapi disconnect error:", error);

      // Still update local status
      await prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: {
          status: "DISCONNECTED",
          lastDisconnectedAt: new Date(),
        },
      });

      return {
        success: true,
        message: "Desconectado localmente",
      };
    }
  });

  // Manual setup (optional - for when admin token is not configured)
  fastify.post<{ Body: { token: string; instanceName?: string } }>("/setup", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { orgId } = request.user as { userId: string; orgId: string };
    const { token, instanceName } = request.body;

    if (!token) {
      return reply.badRequest("Token Uazapi obrigatorio");
    }

    // Check if token is valid by calling status
    try {
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return reply.badRequest("Token Uazapi invalido");
      }

      const data = await response.json();

      // Find existing connection
      const existing = await prisma.whatsAppConnection.findFirst({
        where: { organizationId: orgId },
      });

      // Upsert connection
      const connection = existing
        ? await prisma.whatsAppConnection.update({
            where: { id: existing.id },
            data: {
              uazapiToken: token,
              uazapiInstance: data.instance?.name || instanceName,
              status: data.instance?.status === "connected" ? "CONNECTED" : "DISCONNECTED",
              phoneNumber: data.status?.jid?.user,
              displayName: data.instance?.profileName,
            },
          })
        : await prisma.whatsAppConnection.create({
            data: {
              organizationId: orgId,
              connectionType: "UAZAPI",
              uazapiToken: token,
              uazapiInstance: data.instance?.name || instanceName,
              status: data.instance?.status === "connected" ? "CONNECTED" : "DISCONNECTED",
              phoneNumber: data.status?.jid?.user,
              displayName: data.instance?.profileName,
            },
          });

      return {
        success: true,
        data: {
          status: connection.status,
          instanceName: connection.uazapiInstance,
          phoneNumber: connection.phoneNumber,
          displayName: connection.displayName,
        },
      };
    } catch (error) {
      fastify.log.error("Uazapi setup error:", error);
      return reply.internalServerError("Erro ao configurar Uazapi");
    }
  });
}
