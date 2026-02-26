import { FastifyInstance } from "fastify";
import { prisma } from "@watson/database";
import { generateResponse, getDefaultResponse, type ConversationMessage, type PersonaConfig } from "../../services/ai.service.js";
import { sendTextMessage } from "../../services/uazapi.service.js";
import { messageBuffer } from "../../services/messageBuffer.service.js";
import { processTriggers, shouldSkipAIResponse } from "../../services/trigger.service.js";
import { autoTagContact } from "../../services/autoTag.service.js";

// Store fastify instance for use in buffer callback
let fastifyInstance: FastifyInstance | null = null;

export async function webhookRoutes(fastify: FastifyInstance) {
  // Store fastify instance for buffer callback
  fastifyInstance = fastify;

  // Configure message buffer
  messageBuffer.setBufferDelay(10000); // 10 seconds delay
  messageBuffer.setProcessCallback(async (orgId, conversation, waId, combinedMessage) => {
    if (fastifyInstance) {
      await generateAndSendAIResponse(fastifyInstance, orgId, conversation, waId, combinedMessage);
    }
  });

  fastify.log.info("Message buffer configured with 10s delay");
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

    // Extract message details - Uazapi webhook sends:
    // { event: "messages", data: { chatid, sender, senderName, text, fromMe, ... } }
    // chatid = "5531971206977@s.whatsapp.net" or group ID
    // sender = same as chatid for individual chats
    let waId = message.chatid || message.sender || message.from || message.remoteJid || message.key?.remoteJid || "";

    // Clean up the waId - remove WhatsApp suffixes
    waId = waId.split("@")[0]; // Get only the number part before any @ suffix
    waId = waId.split(":")[0]; // Handle lid format like "5531971206977:62@lid" - get first part

    // Extract content - Uazapi uses 'text' for text messages
    const content =
      message.text ||
      message.body ||
      message.content ||
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.caption ||
      "";

    const messageId = message.messageid || message.id || message.key?.id || message.messageId || message.msgId;
    const pushName = message.senderName || message.pushName || message.notifyName || message.name;

    // Skip if this is an outgoing message (fromMe)
    if (message.fromMe === true || message.key?.fromMe === true) {
      fastify.log.info("Skipping outgoing message (fromMe=true)");
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

    let isNewContact = false;

    if (!contact) {
      isNewContact = true;
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

    let isNewConversation = false;

    if (!conversation) {
      isNewConversation = true;
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

    // Send greeting message for new contacts
    if (isNewContact && isNewConversation && conversation.activePersona?.greetingEnabled && conversation.activePersona?.greetingMessage) {
      const greetingText = conversation.activePersona.greetingMessage;
      fastify.log.info({ conversationId: conversation.id, contactId: contact.id }, "Sending greeting message to new contact");

      // Get WhatsApp connection
      const greetingConnection = await prisma.whatsAppConnection.findFirst({
        where: { organizationId: orgId, status: "CONNECTED" },
      });

      if (greetingConnection?.uazapiToken) {
        const greetingResult = await sendTextMessage(greetingConnection.uazapiToken, waId, greetingText);

        if (greetingResult.success) {
          // Save greeting as outbound message
          const greetingMsg = await prisma.message.create({
            data: {
              organizationId: orgId,
              conversationId: conversation.id,
              waMessageId: greetingResult.messageId,
              direction: "OUTBOUND",
              type: "TEXT",
              content: greetingText,
              status: "SENT",
              isAiGenerated: false,
            },
          });

          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
          });

          // Emit real-time event
          io.to(`org:${orgId}`).emit("message:new", {
            conversationId: conversation.id,
            message: greetingMsg,
          });

          fastify.log.info({ conversationId: conversation.id }, "Greeting message sent");
        }
      }
    }

    // Process triggers
    const triggerResult = await processTriggers(
      {
        orgId,
        conversationId: conversation.id,
        contactId: contact.id,
        waId: contact.waId,
        messageContent: content,
        isNewContact,
        contact,
        conversation,
      },
      fastify.log
    );

    // Check if we should skip AI response based on trigger
    if (shouldSkipAIResponse(triggerResult)) {
      fastify.log.info(
        { conversationId: conversation.id, triggerId: triggerResult.triggerId },
        "Skipping AI response due to trigger"
      );
      return;
    }

    // Add to buffer for AI response if mode allows
    if (conversation.mode === "AI_AUTO" || conversation.mode === "AI_ASSISTED") {
      // Get buffer delay from persona (default 10 seconds)
      const bufferDelaySeconds = conversation.activePersona?.messageBufferDelay ?? 10;
      const bufferDelayMs = bufferDelaySeconds * 1000;

      const isNewBuffer = messageBuffer.addMessage(
        conversation.id,
        {
          content,
          messageId: newMessage.id,
          timestamp: new Date(),
        },
        {
          orgId,
          conversation,
          waId: contact.waId,
          contact,
        },
        bufferDelayMs
      );

      const pendingCount = messageBuffer.getPendingCount(conversation.id);
      fastify.log.info(
        { conversationId: conversation.id, pendingCount, isNewBuffer, bufferDelay: bufferDelaySeconds },
        `Message added to buffer, waiting ${bufferDelaySeconds}s for more messages...`
      );
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
    // Count how many messages were combined (by counting newlines + 1)
    const messageCount = (incomingMessage.match(/\n/g) || []).length + 1;
    fastify.log.info(
      { conversationId: conversation.id, messageCount, combinedLength: incomingMessage.length },
      `Processing ${messageCount} buffered message(s)`
    );

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
    let conversationHistory: ConversationMessage[] = messages
      .reverse()
      .slice(0, -1) // Exclude the current message
      .map((msg) => ({
        role: msg.direction === "INBOUND" ? "user" : "assistant",
        content: msg.content || "",
      }));

    // Filter out bad/fallback responses from history so Gemini doesn't mimic them
    const fallbackPhrases = [
      "em breve um atendente",
      "recebi sua mensagem",
      "aguarde um momento",
    ];
    conversationHistory = conversationHistory.filter((msg) => {
      if (msg.role === "assistant") {
        const lowerContent = msg.content.toLowerCase();
        return !fallbackPhrases.some((phrase) => lowerContent.includes(phrase));
      }
      return true;
    });

    // Gemini requires history to start with a 'user' message
    // Remove any leading assistant messages
    while (conversationHistory.length > 0 && conversationHistory[0].role === "assistant") {
      conversationHistory.shift();
    }

    // Get organization name
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    // Build persona config
    // If conversation doesn't have a persona, try to get the default one
    let activePersona = conversation.activePersona;
    if (!activePersona) {
      activePersona = await prisma.persona.findFirst({
        where: { organizationId: orgId, isDefault: true },
        include: { knowledgeFiles: true },
      });
      // Update conversation with default persona for future messages
      if (activePersona) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { activePersonaId: activePersona.id },
        });
      }
    } else {
      // Load knowledge files for the active persona
      activePersona = await prisma.persona.findUnique({
        where: { id: activePersona.id },
        include: { knowledgeFiles: true },
      });
    }

    // Combine knowledge files content
    let knowledgeContent = "";
    if (activePersona?.knowledgeFiles?.length) {
      knowledgeContent = activePersona.knowledgeFiles
        .map((f: any) => f.extractedText)
        .filter(Boolean)
        .join("\n\n---\n\n");
    }

    const persona: PersonaConfig = activePersona
      ? {
          name: activePersona.name,
          systemPrompt: activePersona.systemPrompt || undefined,
          formalityLevel: activePersona.formalityLevel,
          persuasiveness: activePersona.persuasiveness,
          energyLevel: activePersona.energyLevel,
          empathyLevel: activePersona.empathyLevel,
          customInstructions: activePersona.customInstructions || undefined,
          businessName: activePersona.businessName || org?.name,
          prohibitedTopics: activePersona.prohibitedTopics || undefined,
          responseLength: activePersona.responseLength as "CURTA" | "MEDIA" | "LONGA" | undefined,
          knowledgeContent: knowledgeContent || undefined,
        }
      : {
          name: "Assistente Watson",
          formalityLevel: 50,
          persuasiveness: 50,
          energyLevel: 50,
          empathyLevel: 70,
          businessName: org?.name,
        };

    fastify.log.info(
      `Using persona: ${persona.name} | formality=${persona.formalityLevel} | energy=${persona.energyLevel} | responseLength=${persona.responseLength} | hasKnowledge=${!!persona.knowledgeContent}`
    );

    // Generate AI response
    let responseText: string;

    try {
      const aiResult = await generateResponse(
        incomingMessage,
        conversationHistory,
        persona
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

    // Auto-tag contact based on conversation (run async, don't block response)
    const contact = await prisma.contact.findUnique({ where: { id: conversation.contactId } });
    if (contact) {
      // Get recent messages for auto-tagging
      const recentMessages = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { content: true, direction: true },
      });

      // Run auto-tagging (non-blocking)
      autoTagContact(orgId, contact.id, recentMessages.reverse(), fastify.log)
        .then((appliedTags) => {
          if (appliedTags.length > 0) {
            fastify.log.info(
              { contactId: contact.id, tags: appliedTags.map((t) => t.name) },
              "Auto-tags applied to contact"
            );
            // Emit real-time event for tag updates
            io.to(`org:${orgId}`).emit("contact:tags-updated", {
              contactId: contact.id,
              tags: appliedTags,
            });
          }
        })
        .catch((err) => {
          fastify.log.error({ error: err, contactId: contact.id }, "Auto-tagging failed");
        });
    }
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
