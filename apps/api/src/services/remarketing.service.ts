// Remarketing Service - 7-step automated follow-up system
// Arms follow-up when bot responds, cancels when client responds
// Uses AI (Gemini) to generate contextual messages based on conversation history

import { prisma } from "@watson/database";
import { sendTextMessage } from "./uazapi.service.js";
import { generateResponse, type ConversationMessage, type PersonaConfig } from "./ai.service.js";

// ============================================
// 7-STEP REMARKETING CONFIGURATION
// ============================================

interface RemarketingStep {
  step: number;
  delayMs: number;
  strategy: string;
  fallbackMessage: string;
  isFixed: boolean;
  fixedMessage?: string;
}

const REMARKETING_STEPS: RemarketingStep[] = [
  {
    step: 1,
    delayMs: 5 * 60 * 1000, // 5 minutes
    strategy: "sutil",
    fallbackMessage: "Oi! Vi que voce ficou por aqui. Posso te ajudar com algo mais?",
    isFixed: false,
  },
  {
    step: 2,
    delayMs: 2 * 60 * 60 * 1000, // 2 hours
    strategy: "gentil",
    fallbackMessage: "Ola! Ainda estou por aqui caso precise de alguma ajuda.",
    isFixed: false,
  },
  {
    step: 3,
    delayMs: 8 * 60 * 60 * 1000, // 8 hours
    strategy: "lembrete",
    fallbackMessage: "Oi! Passando para lembrar que estou disponivel para te ajudar.",
    isFixed: false,
  },
  {
    step: 4,
    delayMs: 2 * 24 * 60 * 60 * 1000, // 2 days
    strategy: "valor",
    fallbackMessage: "Ola! Notei que nao conseguimos finalizar nossa conversa. Posso te ajudar?",
    isFixed: false,
  },
  {
    step: 5,
    delayMs: 4 * 24 * 60 * 60 * 1000, // 4 days
    strategy: "urgencia",
    fallbackMessage: "Oi! Faz alguns dias que conversamos. Gostaria de retomar?",
    isFixed: false,
  },
  {
    step: 6,
    delayMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    strategy: "direto",
    fallbackMessage: "Ola! Ja faz uma semana. Se ainda tiver interesse, me chame!",
    isFixed: false,
  },
  {
    step: 7,
    delayMs: 10 * 24 * 60 * 60 * 1000, // 10 days
    strategy: "despedida",
    fallbackMessage: "",
    isFixed: true,
    fixedMessage:
      "Ola! Como nao tivemos retorno, vou encerrar nosso atendimento por aqui. Caso precise de algo no futuro, e so me chamar. Foi um prazer falar com voce!",
  },
];

// AI strategy prompts per step
const STRATEGY_PROMPTS: Record<string, string> = {
  sutil:
    "O cliente parou de responder ha poucos minutos. Envie uma mensagem MUITO sutil e curta, como se fosse uma continuacao natural da conversa. Nao mencione que ele nao respondeu. Maximo 1 frase.",
  gentil:
    "O cliente nao responde ha algumas horas. Mencione algo especifico que conversaram antes. Tom leve e sem pressao. Maximo 2 frases.",
  lembrete:
    "O cliente nao responde ha varias horas. Envie um lembrete educado sobre a conversa anterior, mencionando brevemente o assunto discutido. Maximo 2 frases.",
  valor:
    "O cliente nao responde ha 2 dias. Traga um beneficio ou informacao util relacionada ao que foi conversado. Agregue valor. Maximo 2-3 frases.",
  urgencia:
    "O cliente nao responde ha 4 dias. Crie senso de oportunidade (nao pressao). Seja persuasivo mas respeitoso. Maximo 2-3 frases.",
  direto:
    "O cliente nao responde ha 1 semana. Seja direto e pergunte se ainda tem interesse. Seja honesto - se nao houver interesse, tudo bem. Maximo 2 frases.",
};

// ============================================
// IN-MEMORY FAST CANCELLATION MAP
// ============================================

const cancelledFollowUps: Map<string, boolean> = new Map();

export function cancelFollowUp(conversationId: string): void {
  cancelledFollowUps.set(conversationId, true);
}

function wasCancelled(conversationId: string): boolean {
  if (cancelledFollowUps.has(conversationId)) {
    cancelledFollowUps.delete(conversationId);
    return true;
  }
  return false;
}

// ============================================
// SOCKET.IO EVENT CALLBACK
// ============================================

type RemarketingEventCallback = (orgId: string, conversationId: string, message: any) => void;
let eventCallback: RemarketingEventCallback | null = null;

export function setRemarketingEventCallback(callback: RemarketingEventCallback): void {
  eventCallback = callback;
}

// ============================================
// ARM FOLLOW-UP (bot responded)
// ============================================

export async function scheduleFollowUp(conversationId: string, logger: any): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        organization: { select: { remarketingEnabled: true } },
      },
    });

    if (!conversation) return;
    if (!conversation.organization.remarketingEnabled) return;
    if (!conversation.remarketingEnabled) return;

    // Only arm step 1 if no active remarketing
    if (conversation.followUpStep === 0) {
      const stepConfig = REMARKETING_STEPS[0];
      const nextAt = new Date(Date.now() + stepConfig.delayMs);

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          followUpStep: 1,
          followUpNextAt: nextAt,
        },
      });

      cancelledFollowUps.delete(conversationId);
      logger.info({ conversationId, nextAt, step: 1 }, "[remarketing] Armed step 1");
    }
  } catch (error) {
    logger.error({ error, conversationId }, "[remarketing] Error scheduling follow-up");
  }
}

// ============================================
// CANCEL FOLLOW-UP (client responded)
// ============================================

export async function cancelFollowUpForConversation(conversationId: string, logger: any): Promise<void> {
  try {
    cancelFollowUp(conversationId);

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        followUpStep: 0,
        followUpNextAt: null,
      },
    });

    logger.debug({ conversationId }, "[remarketing] Cancelled - client responded");
  } catch (error) {
    logger.error({ error, conversationId }, "[remarketing] Error cancelling follow-up");
  }
}

// ============================================
// REMARKETING SCHEDULER (polling every 60s)
// ============================================

let remarketingInterval: NodeJS.Timeout | null = null;

export function startRemarketingScheduler(logger: any): void {
  logger.info("[remarketing] Starting scheduler (polls every 60s)");

  processRemarketingDue(logger).catch((err) => {
    logger.error({ error: err }, "[remarketing] Error in initial processing");
  });

  remarketingInterval = setInterval(() => {
    processRemarketingDue(logger).catch((err) => {
      logger.error({ error: err }, "[remarketing] Error processing due follow-ups");
    });
  }, 60000);
}

export function stopRemarketingScheduler(logger: any): void {
  if (remarketingInterval) {
    clearInterval(remarketingInterval);
    remarketingInterval = null;
  }
  logger.info("[remarketing] Scheduler stopped");
}

// ============================================
// PROCESS DUE FOLLOW-UPS
// ============================================

async function processRemarketingDue(logger: any): Promise<void> {
  try {
    const now = new Date();

    const dueConversations = await prisma.conversation.findMany({
      where: {
        followUpNextAt: { lte: now },
        followUpStep: { gte: 1, lte: 7 },
        status: { notIn: ["CLOSED", "RESOLVED"] },
        remarketingEnabled: true,
        organization: { remarketingEnabled: true },
      },
      include: {
        contact: true,
        activePersona: true,
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

    if (dueConversations.length === 0) return;

    logger.info({ count: dueConversations.length }, "[remarketing] Processing due follow-ups");

    for (const conversation of dueConversations) {
      try {
        if (wasCancelled(conversation.id)) {
          logger.debug({ conversationId: conversation.id }, "[remarketing] Skipped - cancelled in memory");
          continue;
        }
        await executeRemarketingStep(conversation, logger);
      } catch (err) {
        logger.error({ error: err, conversationId: conversation.id }, "[remarketing] Error executing step");
      }
    }
  } catch (err) {
    logger.error({ error: err }, "[remarketing] Error fetching due conversations");
  }
}

// ============================================
// EXECUTE A SINGLE REMARKETING STEP
// ============================================

async function executeRemarketingStep(conversation: any, logger: any): Promise<void> {
  const { contact, activePersona, organization } = conversation;
  const currentStep = conversation.followUpStep;
  const stepIndex = currentStep - 1;
  const stepConfig = REMARKETING_STEPS[stepIndex];

  if (!stepConfig) {
    logger.warn({ conversationId: conversation.id, step: currentStep }, "[remarketing] Invalid step");
    return;
  }

  // Get WhatsApp connection
  const connection = organization.whatsappConnections[0];
  if (!connection?.uazapiToken) {
    logger.warn({ conversationId: conversation.id }, "[remarketing] No WhatsApp connection");
    return;
  }

  // Check business hours
  if (activePersona && !isWithinBusinessHours(activePersona)) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { followUpNextAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    logger.debug({ conversationId: conversation.id }, "[remarketing] Postponed - outside business hours");
    return;
  }

  // Generate or get the message
  let messageContent: string;

  if (stepConfig.isFixed && stepConfig.fixedMessage) {
    messageContent = stepConfig.fixedMessage;
  } else {
    messageContent = await generateRemarketingMessage(conversation, stepConfig, logger);
  }

  // Send via WhatsApp
  const sendResult = await sendTextMessage(connection.uazapiToken, contact.waId, messageContent);

  if (!sendResult.success) {
    logger.error({ conversationId: conversation.id, step: currentStep }, "[remarketing] Failed to send message");
    return;
  }

  // Save outbound message
  const outboundMessage = await prisma.message.create({
    data: {
      organizationId: organization.id,
      conversationId: conversation.id,
      waMessageId: sendResult.messageId,
      direction: "OUTBOUND",
      type: "TEXT",
      content: messageContent,
      status: "SENT",
      isAiGenerated: !stepConfig.isFixed,
    },
  });

  // Emit real-time event
  if (eventCallback) {
    eventCallback(organization.id, conversation.id, outboundMessage);
  }

  if (currentStep >= 7) {
    // Last step: farewell sent, close conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        followUpStep: 0,
        followUpNextAt: null,
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
        status: "CLOSED",
        closedAt: new Date(),
      },
    });
    logger.info({ conversationId: conversation.id }, "[remarketing] Farewell sent - conversation closed");
  } else {
    // Advance to next step
    const nextStepConfig = REMARKETING_STEPS[currentStep]; // next step (0-indexed)
    const nextAt = new Date(Date.now() + nextStepConfig.delayMs);

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        followUpStep: currentStep + 1,
        followUpNextAt: nextAt,
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
        status: "WAITING_CLIENT",
      },
    });

    logger.info(
      { conversationId: conversation.id, completedStep: currentStep, nextStep: currentStep + 1, nextAt },
      "[remarketing] Step executed, next scheduled"
    );
  }
}

// ============================================
// AI MESSAGE GENERATION
// ============================================

async function generateRemarketingMessage(
  conversation: any,
  stepConfig: RemarketingStep,
  logger: any
): Promise<string> {
  try {
    const persona = conversation.activePersona;
    if (!persona) return stepConfig.fallbackMessage;

    // Get last 10 messages for context
    const recentMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const history: ConversationMessage[] = recentMessages.reverse().map((m: any) => ({
      role: m.direction === "INBOUND" ? ("user" as const) : ("assistant" as const),
      content: m.content || "",
    }));

    // Ensure history starts with user message (Gemini requirement)
    while (history.length > 0 && history[0].role === "assistant") {
      history.shift();
    }

    if (history.length === 0) return stepConfig.fallbackMessage;

    const personaConfig: PersonaConfig = {
      name: persona.name,
      businessName: persona.businessName,
      systemPrompt: persona.systemPrompt,
      formalityLevel: persona.formalityLevel,
      persuasiveness: persona.persuasiveness,
      energyLevel: persona.energyLevel,
      empathyLevel: persona.empathyLevel,
      customInstructions: persona.customInstructions,
      responseLength: "CURTA",
    };

    const strategyPrompt = STRATEGY_PROMPTS[stepConfig.strategy] || STRATEGY_PROMPTS["gentil"];

    const aiResult = await generateResponse(strategyPrompt, history, personaConfig);

    if (aiResult.success && aiResult.response) {
      return aiResult.response;
    }

    logger.warn({ conversationId: conversation.id, step: stepConfig.step }, "[remarketing] AI failed, using fallback");
    return stepConfig.fallbackMessage;
  } catch (error) {
    logger.error({ error, conversationId: conversation.id }, "[remarketing] Error generating message");
    return stepConfig.fallbackMessage;
  }
}

// ============================================
// BUSINESS HOURS CHECK
// ============================================

function isWithinBusinessHours(persona: any): boolean {
  const now = new Date();
  const brazilTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const currentDay = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][brazilTime.getDay()];
  const currentTime = `${brazilTime.getHours().toString().padStart(2, "0")}:${brazilTime.getMinutes().toString().padStart(2, "0")}`;

  const workDays = persona.workDays || ["seg", "ter", "qua", "qui", "sex"];
  if (!workDays.includes(currentDay)) return false;

  const startTime = persona.businessHoursStart || "09:00";
  const endTime = persona.businessHoursEnd || "18:00";

  return currentTime >= startTime && currentTime <= endTime;
}
