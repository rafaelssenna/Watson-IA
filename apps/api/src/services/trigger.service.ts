import { prisma } from "@watson/database";
import { sendTextMessage } from "./uazapi.service.js";

// Type definitions
interface TriggerConditions {
  keywords?: string[];
  matchType?: "any" | "all" | "exact";
  intents?: string[];
  // For OUT_OF_HOURS
  businessHoursStart?: string;
  businessHoursEnd?: string;
  workDays?: string[];
}

interface TriggerActions {
  sendMessage?: string;
  useAIMessage?: boolean;
  aiMessagePrompt?: string;
  notifyTeam?: boolean;
  transferToHuman?: boolean;
  moveFunnelStage?: string;
  // Flag to skip AI response after trigger
  skipAIResponse?: boolean;
}

interface TriggerContext {
  orgId: string;
  conversationId: string;
  contactId: string;
  waId: string;
  messageContent: string;
  isNewContact: boolean;
  contact?: any;
  conversation?: any;
}

interface TriggerResult {
  triggered: boolean;
  triggerId?: string;
  triggerName?: string;
  actions?: TriggerActions;
  skipAIResponse?: boolean;
}

export async function processTriggers(
  context: TriggerContext,
  log: any
): Promise<TriggerResult> {
  try {
    // Get all active triggers for the organization, ordered by priority
    const triggers = await prisma.trigger.findMany({
      where: {
        organizationId: context.orgId,
        isActive: true,
      },
      orderBy: { priority: "desc" },
    });

    if (triggers.length === 0) {
      return { triggered: false };
    }

    log.info({ triggerCount: triggers.length }, "Processing triggers for message");

    // Check each trigger
    for (const trigger of triggers) {
      const conditions = trigger.conditions as TriggerConditions;
      const actions = trigger.actions as TriggerActions;

      const matches = await evaluateTrigger(trigger.triggerType, conditions, context, log);

      if (matches) {
        log.info({ triggerId: trigger.id, triggerName: trigger.name, type: trigger.triggerType }, "Trigger matched!");

        // Execute actions
        await executeTriggerActions(actions, context, log);

        // Update trigger stats
        await prisma.trigger.update({
          where: { id: trigger.id },
          data: {
            timesTriggered: { increment: 1 },
            lastTriggeredAt: new Date(),
          },
        });

        return {
          triggered: true,
          triggerId: trigger.id,
          triggerName: trigger.name,
          actions,
          skipAIResponse: actions.skipAIResponse || false,
        };
      }
    }

    return { triggered: false };
  } catch (error) {
    log.error({ error, context }, "Error processing triggers");
    return { triggered: false };
  }
}

async function evaluateTrigger(
  type: string,
  conditions: TriggerConditions,
  context: TriggerContext,
  log: any
): Promise<boolean> {
  switch (type) {
    case "KEYWORD":
      return evaluateKeywordTrigger(conditions, context.messageContent, log);

    case "INTENT":
      return evaluateIntentTrigger(conditions, context.messageContent, log);

    case "NEW_CONTACT":
      return context.isNewContact;

    case "OUT_OF_HOURS":
      return evaluateOutOfHoursTrigger(conditions, log);

    case "PRODUCT_MENTION":
      // Simple product mention detection using keywords
      return evaluateKeywordTrigger(conditions, context.messageContent, log);

    case "URGENCY":
      return evaluateUrgencyTrigger(context.messageContent, log);

    case "SENTIMENT":
      return evaluateSentimentTrigger(conditions, context.messageContent, log);

    default:
      log.warn({ type }, "Unknown trigger type");
      return false;
  }
}

function evaluateKeywordTrigger(
  conditions: TriggerConditions,
  message: string,
  log: any
): boolean {
  if (!conditions.keywords || conditions.keywords.length === 0) {
    return false;
  }

  const lowerMessage = message.toLowerCase();
  const matchType = conditions.matchType || "any";

  if (matchType === "exact") {
    // Check if message exactly matches any keyword
    return conditions.keywords.some(
      (kw) => lowerMessage === kw.toLowerCase()
    );
  } else if (matchType === "all") {
    // All keywords must be present
    return conditions.keywords.every((kw) =>
      lowerMessage.includes(kw.toLowerCase())
    );
  } else {
    // Default: any keyword matches
    return conditions.keywords.some((kw) =>
      lowerMessage.includes(kw.toLowerCase())
    );
  }
}

function evaluateIntentTrigger(
  conditions: TriggerConditions,
  message: string,
  log: any
): boolean {
  // Simple intent detection based on patterns
  // In a production system, this would use ML/AI for intent classification
  const lowerMessage = message.toLowerCase();

  const intentPatterns: Record<string, RegExp[]> = {
    PURCHASE: [
      /quero comprar/i,
      /quanto custa/i,
      /qual o pre[cç]o/i,
      /tem disponivel/i,
      /como fa[cç]o para comprar/i,
      /aceita cartao/i,
      /formas de pagamento/i,
      /pix/i,
      /parcela/i,
    ],
    COMPLAINT: [
      /reclama[cç][aã]o/i,
      /problema/i,
      /n[aã]o funciona/i,
      /defeito/i,
      /insatisfeito/i,
      /devolver/i,
      /reembolso/i,
      /n[aã]o gostei/i,
    ],
    SUPPORT: [
      /ajuda/i,
      /suporte/i,
      /d[uú]vida/i,
      /como funciona/i,
      /n[aã]o consigo/i,
      /n[aã]o entendi/i,
      /me explica/i,
    ],
    SHIPPING: [
      /entrega/i,
      /frete/i,
      /prazo/i,
      /rastreio/i,
      /rastrear/i,
      /onde est[aá] meu pedido/i,
      /quando chega/i,
    ],
    CANCEL: [
      /cancelar/i,
      /cancela/i,
      /desistir/i,
      /n[aã]o quero mais/i,
    ],
    HUMAN: [
      /falar com atendente/i,
      /atendente humano/i,
      /pessoa real/i,
      /falar com algu[eé]m/i,
      /humano/i,
    ],
  };

  const intentsToCheck = conditions.intents || Object.keys(intentPatterns);

  for (const intent of intentsToCheck) {
    const patterns = intentPatterns[intent];
    if (patterns && patterns.some((pattern) => pattern.test(lowerMessage))) {
      log.info({ intent, message: message.substring(0, 50) }, "Intent detected");
      return true;
    }
  }

  return false;
}

function evaluateOutOfHoursTrigger(
  conditions: TriggerConditions,
  log: any
): boolean {
  const now = new Date();
  const brazilTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );

  const currentHour = brazilTime.getHours();
  const currentMinute = brazilTime.getMinutes();
  const currentDay = brazilTime.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Map day number to Portuguese abbreviation
  const dayMap: Record<number, string> = {
    0: "dom",
    1: "seg",
    2: "ter",
    3: "qua",
    4: "qui",
    5: "sex",
    6: "sab",
  };

  const currentDayStr = dayMap[currentDay];
  const workDays = conditions.workDays || ["seg", "ter", "qua", "qui", "sex"];

  // Check if today is a work day
  if (!workDays.includes(currentDayStr)) {
    log.info({ currentDayStr, workDays }, "Outside work days");
    return true;
  }

  // Parse business hours
  const startTime = conditions.businessHoursStart || "09:00";
  const endTime = conditions.businessHoursEnd || "18:00";

  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const currentTimeMinutes = currentHour * 60 + currentMinute;
  const startTimeMinutes = startHour * 60 + startMin;
  const endTimeMinutes = endHour * 60 + endMin;

  const isOutsideHours =
    currentTimeMinutes < startTimeMinutes || currentTimeMinutes >= endTimeMinutes;

  if (isOutsideHours) {
    log.info(
      { currentTime: `${currentHour}:${currentMinute}`, startTime, endTime },
      "Outside business hours"
    );
  }

  return isOutsideHours;
}

function evaluateUrgencyTrigger(message: string, log: any): boolean {
  const urgencyPatterns = [
    /urgente/i,
    /urg[eê]ncia/i,
    /preciso agora/i,
    /muito importante/i,
    /emergencia/i,
    /o mais r[aá]pido/i,
    /hoje mesmo/i,
    /imediato/i,
  ];

  return urgencyPatterns.some((pattern) => pattern.test(message));
}

function evaluateSentimentTrigger(
  conditions: TriggerConditions,
  message: string,
  log: any
): boolean {
  // Simple negative sentiment detection
  const negativePatterns = [
    /horrivel/i,
    /p[eé]ssimo/i,
    /nunca mais/i,
    /decepcionado/i,
    /frustrado/i,
    /raiva/i,
    /absurdo/i,
    /inaceit[aá]vel/i,
    /vergonha/i,
  ];

  return negativePatterns.some((pattern) => pattern.test(message));
}

async function executeTriggerActions(
  actions: TriggerActions,
  context: TriggerContext,
  log: any
): Promise<void> {
  try {
    // Send automated message
    if (actions.sendMessage) {
      await sendTriggerMessage(actions.sendMessage, context, log);
    }

    // Transfer to human
    if (actions.transferToHuman) {
      await prisma.conversation.update({
        where: { id: context.conversationId },
        data: {
          mode: "HUMAN_ONLY",
          status: "WAITING_AGENT",
        },
      });
      log.info({ conversationId: context.conversationId }, "Transferred to human");
    }

    // Move funnel stage
    if (actions.moveFunnelStage) {
      await prisma.contact.update({
        where: { id: context.contactId },
        data: { funnelStageId: actions.moveFunnelStage },
      });
      log.info({ contactId: context.contactId, stageId: actions.moveFunnelStage }, "Moved funnel stage");
    }

    // Notify team (emit socket event)
    if (actions.notifyTeam) {
      // This would emit a socket event to notify the team
      log.info({ conversationId: context.conversationId }, "Team notification triggered");
    }
  } catch (error) {
    log.error({ error, actions }, "Error executing trigger actions");
  }
}

async function sendTriggerMessage(
  message: string,
  context: TriggerContext,
  log: any
): Promise<void> {
  try {
    // Get WhatsApp connection
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { organizationId: context.orgId, status: "CONNECTED" },
    });

    if (!connection?.uazapiToken) {
      log.warn({ orgId: context.orgId }, "No WhatsApp connection for trigger message");
      return;
    }

    // Replace placeholders in message
    let finalMessage = message;
    if (context.contact) {
      finalMessage = finalMessage
        .replace(/\{nome\}/gi, context.contact.name || context.contact.pushName || "")
        .replace(/\{telefone\}/gi, context.contact.phone || "");
    }

    // Send message
    const result = await sendTextMessage(connection.uazapiToken, context.waId, finalMessage);

    if (result.success) {
      // Save the message
      await prisma.message.create({
        data: {
          organizationId: context.orgId,
          conversationId: context.conversationId,
          waMessageId: result.messageId,
          direction: "OUTBOUND",
          type: "TEXT",
          content: finalMessage,
          status: "SENT",
          isAiGenerated: false,
        },
      });

      // Update conversation
      await prisma.conversation.update({
        where: { id: context.conversationId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
        },
      });

      log.info({ conversationId: context.conversationId }, "Trigger message sent");
    }
  } catch (error) {
    log.error({ error, message }, "Error sending trigger message");
  }
}

// Export function to check if we should skip AI response
export function shouldSkipAIResponse(result: TriggerResult): boolean {
  return result.triggered && (result.skipAIResponse || false);
}
