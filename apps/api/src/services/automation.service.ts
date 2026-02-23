/**
 * Automation Service
 *
 * Handles scheduled automations like follow-up messages for inactive conversations.
 * Runs periodically to check for conversations that need automated actions.
 */

import { prisma } from "@watson/database";
import { sendTextMessage } from "./uazapi.service.js";
import { generateResponse, type ConversationMessage, type PersonaConfig } from "./ai.service.js";

// Track if scheduler is running
let isSchedulerRunning = false;
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Start the automation scheduler
 * Runs every minute to check for pending automations
 */
export function startAutomationScheduler(logger: any) {
  if (isSchedulerRunning) {
    logger.warn("Automation scheduler already running");
    return;
  }

  isSchedulerRunning = true;
  logger.info("Starting automation scheduler (runs every 60s)");

  // Run immediately on start
  processAutomations(logger).catch((err) => {
    logger.error({ error: err }, "Error in initial automation processing");
  });

  // Then run every minute
  schedulerInterval = setInterval(() => {
    processAutomations(logger).catch((err) => {
      logger.error({ error: err }, "Error processing automations");
    });
  }, 60000); // Every 60 seconds
}

/**
 * Stop the automation scheduler
 */
export function stopAutomationScheduler(logger: any) {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  isSchedulerRunning = false;
  logger.info("Automation scheduler stopped");
}

/**
 * Main automation processing function
 */
async function processAutomations(logger: any) {
  try {
    // Get all active follow-up automations
    const automations = await prisma.automation.findMany({
      where: {
        isActive: true,
        type: "FOLLOW_UP_INACTIVITY",
        triggerDelayHours: { not: null },
      },
      include: {
        organization: {
          include: {
            whatsappConnections: {
              where: { status: "CONNECTED" },
              take: 1,
            },
          },
        },
      },
    });

    if (automations.length === 0) {
      return; // No active automations
    }

    logger.debug({ count: automations.length }, "Processing follow-up automations");

    for (const automation of automations) {
      try {
        await processFollowUpAutomation(automation, logger);
      } catch (err) {
        logger.error({ error: err, automationId: automation.id }, "Error processing automation");
      }
    }
  } catch (err) {
    logger.error({ error: err }, "Error fetching automations");
  }
}

/**
 * Process a single follow-up inactivity automation
 */
async function processFollowUpAutomation(automation: any, logger: any) {
  const { organization, triggerDelayHours, maxExecutionsPerConversation, respectBusinessHours, onlyWhenWaitingClient } = automation;

  // Check if organization has a connected WhatsApp
  const connection = organization.whatsappConnections[0];
  if (!connection?.uazapiToken) {
    return; // No WhatsApp connection
  }

  // Check business hours if required
  if (respectBusinessHours) {
    const persona = await prisma.persona.findFirst({
      where: { organizationId: organization.id, isDefault: true },
    });

    if (persona && !isWithinBusinessHours(persona)) {
      logger.debug({ automationId: automation.id }, "Skipping automation - outside business hours");
      return;
    }
  }

  // Calculate the cutoff time (conversations with no messages after this time)
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - (triggerDelayHours || 24));

  // Find conversations that need follow-up
  const conversations = await prisma.conversation.findMany({
    where: {
      organizationId: organization.id,
      status: onlyWhenWaitingClient ? "WAITING_CLIENT" : { in: ["OPEN", "WAITING_CLIENT", "IN_PROGRESS"] },
      lastMessageAt: { lt: cutoffTime },
      // Exclude conversations that already had max executions
      NOT: {
        id: {
          in: await getConversationsWithMaxExecutions(automation.id, maxExecutionsPerConversation),
        },
      },
    },
    include: {
      contact: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      activePersona: true,
    },
  });

  logger.debug(
    { automationId: automation.id, conversationsFound: conversations.length },
    "Found conversations for follow-up"
  );

  for (const conversation of conversations) {
    try {
      // Check if last message was from the business (outbound)
      const lastMessage = conversation.messages[0];
      if (lastMessage?.direction === "OUTBOUND") {
        // Last message was from us, don't send another follow-up
        continue;
      }

      // Check execution count for this conversation
      const executionCount = await prisma.automationExecution.count({
        where: {
          automationId: automation.id,
          conversationId: conversation.id,
          status: "EXECUTED",
        },
      });

      if (executionCount >= maxExecutionsPerConversation) {
        continue;
      }

      // Execute the follow-up
      await executeFollowUp(automation, conversation, connection, logger);
    } catch (err) {
      logger.error(
        { error: err, conversationId: conversation.id, automationId: automation.id },
        "Error executing follow-up for conversation"
      );
    }
  }
}

/**
 * Get conversation IDs that already reached max executions
 */
async function getConversationsWithMaxExecutions(automationId: string, maxExecutions: number): Promise<string[]> {
  const executions = await prisma.automationExecution.groupBy({
    by: ["conversationId"],
    where: {
      automationId,
      status: "EXECUTED",
    },
    _count: {
      conversationId: true,
    },
    having: {
      conversationId: {
        _count: {
          gte: maxExecutions,
        },
      },
    },
  });

  return executions.map((e) => e.conversationId);
}

/**
 * Execute a follow-up message for a conversation
 */
async function executeFollowUp(automation: any, conversation: any, connection: any, logger: any) {
  const { messageTemplate, useAI } = automation;
  const contact = conversation.contact;

  let messageContent: string;

  if (useAI && conversation.activePersona) {
    // Generate follow-up message using AI
    const persona = conversation.activePersona;
    const personaConfig: PersonaConfig = {
      name: persona.name,
      businessName: persona.businessName,
      systemPrompt: persona.systemPrompt,
      formalityLevel: persona.formalityLevel,
      persuasiveness: persona.persuasiveness,
      energyLevel: persona.energyLevel,
      empathyLevel: persona.empathyLevel,
      customInstructions: persona.customInstructions,
      responseLength: persona.responseLength,
    };

    // Get recent messages for context
    const recentMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const history: ConversationMessage[] = recentMessages.reverse().map((m) => ({
      role: m.direction === "INBOUND" ? "user" : "assistant",
      content: m.content || "",
    }));

    const aiPrompt = `O cliente não respondeu há algumas horas. Envie uma mensagem de follow-up gentil e educada para retomar a conversa. Não seja insistente. Seja breve.`;

    const aiResponse = await generateResponse(personaConfig, history, aiPrompt);
    messageContent = aiResponse.message;
  } else {
    // Use template message with variable replacement
    messageContent = messageTemplate || "Oi! Vi que não conseguimos finalizar nossa conversa. Posso te ajudar com algo mais?";
    messageContent = messageContent
      .replace("{{nome}}", contact.name || contact.pushName || "")
      .replace("{{primeiro_nome}}", (contact.name || contact.pushName || "").split(" ")[0]);
  }

  // Create execution record
  const execution = await prisma.automationExecution.create({
    data: {
      automationId: automation.id,
      conversationId: conversation.id,
      status: "PENDING",
    },
  });

  try {
    // Send the message
    const result = await sendTextMessage(connection.uazapiToken, contact.waId, messageContent);

    // Create message in database
    const message = await prisma.message.create({
      data: {
        organizationId: automation.organizationId,
        conversationId: conversation.id,
        waMessageId: result.key?.id || null,
        direction: "OUTBOUND",
        type: "TEXT",
        content: messageContent,
        isAiGenerated: useAI,
        status: "SENT",
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
        status: "WAITING_CLIENT",
      },
    });

    // Update execution as successful
    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: {
        status: "EXECUTED",
        executedAt: new Date(),
        messageId: message.id,
      },
    });

    // Update automation stats
    await prisma.automation.update({
      where: { id: automation.id },
      data: {
        timesExecuted: { increment: 1 },
        lastExecutedAt: new Date(),
      },
    });

    logger.info(
      { automationId: automation.id, conversationId: conversation.id, messageId: message.id },
      "Follow-up message sent successfully"
    );
  } catch (err) {
    // Update execution as failed
    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : "Unknown error",
      },
    });
    throw err;
  }
}

/**
 * Check if current time is within business hours
 */
function isWithinBusinessHours(persona: any): boolean {
  const now = new Date();
  const currentDay = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][now.getDay()];
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // Check if today is a work day
  const workDays = persona.workDays || ["seg", "ter", "qua", "qui", "sex"];
  if (!workDays.includes(currentDay)) {
    return false;
  }

  // Check time
  const startTime = persona.businessHoursStart || "09:00";
  const endTime = persona.businessHoursEnd || "18:00";

  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Manually trigger automation check (for testing)
 */
export async function triggerAutomationCheck(logger: any) {
  return processAutomations(logger);
}
