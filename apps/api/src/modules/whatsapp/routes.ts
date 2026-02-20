import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";

// Uazapi API base URL
const UAZAPI_BASE_URL = process.env.UAZAPI_BASE_URL || "https://hia-clientes.uazapi.com";

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

    let connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: orgId },
    });

    if (!connection || !connection.uazapiToken) {
      return reply.badRequest("Conexao WhatsApp nao configurada. Configure o token Uazapi primeiro.");
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
        const error = await response.text();
        fastify.log.error("Uazapi connect error:", error);
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

    if (!phone) {
      return reply.badRequest("Numero de telefone obrigatorio");
    }

    // Clean phone number - keep only digits
    const cleanPhone = phone.replace(/\D/g, "");

    let connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: orgId },
    });

    if (!connection || !connection.uazapiToken) {
      return reply.badRequest("Conexao WhatsApp nao configurada. Configure o token Uazapi primeiro.");
    }

    try {
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.uazapiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      if (!response.ok) {
        const error = await response.text();
        fastify.log.error("Uazapi connect error:", error);
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
          pairingCode: data.instance?.pairingCode,
          status: "CONNECTING",
        },
      };
    } catch (error) {
      fastify.log.error("Uazapi connect error:", error);
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
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/disconnect`, {
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

  // Configure Uazapi token (initial setup)
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

      // Upsert connection
      const connection = await prisma.whatsAppConnection.upsert({
        where: {
          id: (await prisma.whatsAppConnection.findFirst({ where: { organizationId: orgId } }))?.id || "new",
        },
        create: {
          organizationId: orgId,
          connectionType: "UAZAPI",
          uazapiToken: token,
          uazapiInstance: data.instance?.name || instanceName,
          status: data.instance?.status === "connected" ? "CONNECTED" : "DISCONNECTED",
          phoneNumber: data.status?.jid?.user,
          displayName: data.instance?.profileName,
        },
        update: {
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
