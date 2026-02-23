import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { generateResponse, getDefaultResponse, type ConversationMessage, type PersonaConfig } from "../../services/ai.service.js";
import { sendTextMessage } from "../../services/uazapi.service.js";

export async function webhookRoutes(fastify: FastifyInstance) {
  // UAZAPI Webhook - Receive WhatsApp messages
  fastify.post<{ Body: any }>("/uazapi/:connectionId", async (request, reply) => {
    const { connectionId } = request.params as { connectionId: string };
    const payload = request.body;

    fastify.log.info({ connectionId, payload }, "UAZAPI webhook received");

    // Find the connection
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
      include: { organization: true },
    });

    if (!connection) {
      fastify.log.warn({ connectionId }, "Connection not found for webhook");
      return reply.code(404).send({ error: "Connection not found" });
    }

    const orgId = connection.organizationId;

    // Handle different event types from Uazapi
    const typedPayload = payload as Record<string, any>;
    const eventType = typedPayload.event || typedPayload.type || "";

    fastify.log.info({ eventType, hasMessage: !!typedPayload.message, hasData: !!typedPayload.data }, "Processing webhook event");

    // Check if this is a message event (Uazapi sends 'messages' event for incoming messages)
    if (eventType === "messages" || eventType === "messages.upsert" || eventType === "message") {
      await handleIncomingMessage(fastify, orgId, payload);
    }
    // Check if this is a status update
    else if (eventType === "messages.update" || eventType === "message.status" || eventType === "status") {
      await handleMessageStatus(fastify, orgId, payload);
    }
    // Check if this is a connection update
    else if (eventType === "connection.update" || eventType === "connection") {
      await handleConnectionUpdate(fastify, connectionId, payload);
    }
    // If no event type but has message data, treat as incoming message
    else if (typedPayload.message || typedPayload.data?.message) {
      fastify.log.info("No event type but has message data, treating as incoming message");
      await handleIncomingMessage(fastify, orgId, payload);
    }
    else {
      fastify.log.info({ eventType, payloadKeys: Object.keys(typedPayload) }, "Unhandled webhook event type");
    }

    return { success: true };
  });

  // Stripe Webhook
  fastify.post("/stripe", async () => {
    // TODO: Implement Stripe webhook handling
    return { received: true };
  });
}

async function handleIncomingMessage(fastify: FastifyInstance, orgId: string, payload: any) {
  try {
    // Log the full payload for debugging
    fastify.log.info({ fullPayload: JSON.stringify(payload) }, "Processing incoming message payload - FULL");

    // Uazapi can send message data in different structures
    const message = payload.data || payload.message || payload;

    fastify.log.info({
      messageKeys: Object.keys(message),
      dataKeys: payload.data ? Object.keys(payload.data) : null,
      hasFrom: !!message.from,
      hasRemoteJid: !!message.remoteJid,
      hasBody: !!message.body,
      hasText: !!message.text,
    }, "Message structure debug");

    // Extract message details - handle multiple possible field names from Uazapi
    // Uazapi typically sends: { data: { from: "5531...", body: "message text", ... } }
    // The 'from' field might contain @s.whatsapp.net, @c.us, or @lid suffix
    // For @lid (linked device), we need to use a different field or extract differently
    let waId = message.from || message.remoteJid || message.key?.remoteJid || message.sender || message.phone || "";

    // Clean up the waId - remove WhatsApp suffixes
    waId = waId.split("@")[0]; // Get only the number part before any @ suffix
    waId = waId.split(":")[0]; // Handle lid format like "5531971206977:62@lid" - get first part

    // Extract content - Uazapi uses 'body' for text messages
    const content =
      message.body ||
      message.text ||
      message.content ||
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.caption ||
      "";

    const messageId = message.key?.id || message.id || message.messageId || message.msgId;
    const pushName = message.pushName || message.notifyName || message.senderName || message.name;

    // Skip if this is an outgoing message (fromMe)
    if (message.fromMe === true || message.key?.fromMe === true) {
      fastify.log.info("Skipping outgoing message");
      return;
    }

    fastify.log.info({ waId, content: content?.substring(0, 50), messageId, pushName }, "Extracted message details");

    if (!waId || !content) {
      fastify.log.warn({
        waId,
        content,
        messageKeys: Object.keys(message),
        fullMessage: JSON.stringify(message).substring(0, 500)
      }, "Invalid message payload - missing waId or content");
      return;
    }

    // Find or create contact
    let contact = await prisma.contact.findFirst({
      where: { organizationId: orgId, waId },
    });

    if (!contact) {
      // Get default funnel and first stage
      const defaultFunnel = await prisma.funnel.findFirst({
        where: { organizationId: orgId, isDefault: true },
        include: { stages: { orderBy: { order: "asc" }, take: 1 } },
      });

      contact = await prisma.contact.create({
        data: {
          organizationId: orgId,
          waId,
          phone: waId,
          pushName,
          funnelId: defaultFunnel?.id,
          funnelStageId: defaultFunnel?.stages[0]?.id,
        },
      });
    } else if (pushName && !contact.name) {
      // Update pushName if we don't have a name
      await prisma.contact.update({
        where: { id: contact.id },
        data: { pushName },
      });
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        organizationId: orgId,
        contactId: contact.id,
        status: { notIn: ["CLOSED", "RESOLVED"] },
      },
      include: {
        activePersona: true,
      },
    });

    if (!conversation) {
      // Get default persona for the organization
      const defaultPersona = await prisma.persona.findFirst({
        where: { organizationId: orgId, isDefault: true },
      });

      conversation = await prisma.conversation.create({
        data: {
          organizationId: orgId,
          contactId: contact.id,
          status: "OPEN",
          mode: "AI_AUTO",
          activePersonaId: defaultPersona?.id,
        },
        include: {
          activePersona: true,
        },
      });
    }

    // Create message
    const newMessage = await prisma.message.create({
      data: {
        organizationId: orgId,
        conversationId: conversation.id,
        waMessageId: messageId,
        direction: "INBOUND",
        type: "TEXT",
        content,
        status: "DELIVERED",
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
        status: "IN_PROGRESS",
      },
    });

    // Update contact last interaction
    await prisma.contact.update({
      where: { id: contact.id },
      data: { lastInteractionAt: new Date() },
    });

    // Emit real-time event
    const io = fastify.io;
    io.to(`org:${orgId}`).emit("message:new", {
      conversationId: conversation.id,
      message: newMessage,
    });

    fastify.log.info({ conversationId: conversation.id, messageId: newMessage.id }, "Message processed");

    // Generate and send AI response if mode allows
    if (conversation.mode === "AI_AUTO" || conversation.mode === "AI_ASSISTED") {
      await generateAndSendAIResponse(fastify, orgId, conversation, contact.waId, content);
    }
  } catch (error) {
    fastify.log.error({ error, payload }, "Error processing incoming message");
  }
}

async function generateAndSendAIResponse(
  fastify: FastifyInstance,
  orgId: string,
  conversation: any,
  waId: string,
  incomingMessage: string
) {
  try {
    fastify.log.info({ conversationId: conversation.id }, "Generating AI response");

    // Get WhatsApp connection for this org
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: orgId, status: "CONNECTED" },
    });

    if (!connection?.uazapiToken) {
      fastify.log.warn({ orgId }, "No connected WhatsApp to send AI response");
      return;
    }

    // Get conversation history (last 10 messages for context)
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Format conversation history for AI
    const conversationHistory: ConversationMessage[] = messages
      .reverse()
      .slice(0, -1) // Exclude the current message
      .map((msg) => ({
        role: msg.direction === "INBOUND" ? "user" : "assistant",
        content: msg.content || "",
      }));

    // Get organization name
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    // Build persona config
    const persona: PersonaConfig = conversation.activePersona
      ? {
          name: conversation.activePersona.name,
          systemPrompt: conversation.activePersona.systemPrompt,
          formalityLevel: conversation.activePersona.formalityLevel,
          persuasiveness: conversation.activePersona.persuasiveness,
          energyLevel: conversation.activePersona.energyLevel,
          empathyLevel: conversation.activePersona.empathyLevel,
          customInstructions: conversation.activePersona.customInstructions,
        }
      : {
          name: "Assistente Watson",
          formalityLevel: 50,
          persuasiveness: 50,
          energyLevel: 50,
          empathyLevel: 70,
        };

    // Generate AI response
    let responseText: string;

    try {
      const aiResult = await generateResponse(
        incomingMessage,
        conversationHistory,
        persona,
        org?.name
      );

      if (aiResult.success && aiResult.response) {
        responseText = aiResult.response;
      } else {
        fastify.log.warn({ error: aiResult.error }, "AI generation failed, using default");
        responseText = getDefaultResponse();
      }
    } catch (aiError) {
      fastify.log.error({ error: aiError }, "AI service error, using default response");
      responseText = getDefaultResponse();
    }

    // Send response via Uazapi
    const sendResult = await sendTextMessage(connection.uazapiToken, waId, responseText);

    if (!sendResult.success) {
      fastify.log.error({ error: sendResult.error }, "Failed to send AI response");
      return;
    }

    // Save outbound message
    const outboundMessage = await prisma.message.create({
      data: {
        organizationId: orgId,
        conversationId: conversation.id,
        waMessageId: sendResult.messageId,
        direction: "OUTBOUND",
        type: "TEXT",
        content: responseText,
        status: "SENT",
        isAiGenerated: true,
        aiConfidence: 0.85,
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
        lastAiAction: "AUTO_REPLIED",
      },
    });

    // Emit real-time event for outbound message
    const io = fastify.io;
    io.to(`org:${orgId}`).emit("message:new", {
      conversationId: conversation.id,
      message: outboundMessage,
    });

    fastify.log.info({ conversationId: conversation.id, messageId: outboundMessage.id }, "AI response sent");
  } catch (error) {
    fastify.log.error({ error, conversationId: conversation.id }, "Error generating/sending AI response");
  }
}

async function handleMessageStatus(fastify: FastifyInstance, orgId: string, payload: any) {
  try {
    const update = payload.data || payload;
    const messageId = update.key?.id || update.id;
    const status = update.status || update.update?.status;

    if (!messageId) return;

    const statusMap: Record<string, string> = {
      sent: "SENT",
      delivered: "DELIVERED",
      read: "READ",
      played: "READ",
      failed: "FAILED",
    };

    const dbStatus = statusMap[status?.toLowerCase()] || status;

    await prisma.message.updateMany({
      where: { waMessageId: messageId, organizationId: orgId },
      data: {
        status: dbStatus as any,
        ...(dbStatus === "DELIVERED" && { deliveredAt: new Date() }),
        ...(dbStatus === "READ" && { readAt: new Date() }),
      },
    });
  } catch (error) {
    fastify.log.error({ error, payload }, "Error processing message status");
  }
}

async function handleConnectionUpdate(fastify: FastifyInstance, connectionId: string, payload: any) {
  try {
    const update = payload.data || payload;
    const status = update.connection || update.status;

    const statusMap: Record<string, string> = {
      open: "CONNECTED",
      close: "DISCONNECTED",
      connecting: "CONNECTING",
    };

    await prisma.whatsAppConnection.update({
      where: { id: connectionId },
      data: {
        status: (statusMap[status] || status) as any,
        ...(status === "open" && { lastConnectedAt: new Date() }),
        ...(status === "close" && { lastDisconnectedAt: new Date() }),
      },
    });
  } catch (error) {
    fastify.log.error({ error, payload }, "Error processing connection update");
  }
}
