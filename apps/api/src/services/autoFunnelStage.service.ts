// Auto-funnel-stage Service - Automatically move contacts to appropriate funnel stage

import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@watson/database";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is not configured");
    }
    genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  }
  return genAI;
}

interface ClassificationResult {
  stageId: string;
  stageName: string;
  confidence: number;
  reason: string;
  moved: boolean;
}

interface Logger {
  info: (obj: any, msg?: string) => void;
  error: (obj: any, msg?: string) => void;
  warn: (obj: any, msg?: string) => void;
}

/**
 * Analyze conversation and move contact to appropriate funnel stage.
 * Called from webhook after AI responds (non-blocking).
 */
export async function autoClassifyFunnelStage(
  orgId: string,
  contactId: string,
  recentMessages: Array<{ content: string | null; direction: string }>,
  logger?: Logger
): Promise<ClassificationResult | null> {
  const log = logger || console;

  try {
    // Get the contact's current funnel and stage
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { funnelId: true, funnelStageId: true },
    });

    if (!contact?.funnelId) {
      return null;
    }

    // Get all stages for this funnel
    const stages = await prisma.funnelStage.findMany({
      where: { funnelId: contact.funnelId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true },
    });

    if (stages.length === 0) return null;

    // Build conversation text
    const conversationText = recentMessages
      .filter((m) => m.content)
      .map((m) => `${m.direction === "INBOUND" ? "Cliente" : "Atendente"}: ${m.content}`)
      .join("\n");

    if (!conversationText.trim()) return null;

    // Find current stage name for context
    const currentStage = stages.find((s) => s.id === contact.funnelStageId);

    const stagesDescription = stages
      .map((s) => `- "${s.name}" (ordem: ${s.order})`)
      .join("\n");

    const prompt = `Analise a conversa abaixo e determine em qual etapa do funil de vendas o cliente se encontra.

ETAPAS DO FUNIL (em ordem):
${stagesDescription}

ETAPA ATUAL DO CLIENTE: ${currentStage?.name || "Nenhuma"}

CONVERSA RECENTE:
${conversationText.substring(0, 3000)}

INSTRUCOES:
1. Analise o contexto da conversa para entender o estagio de compra do cliente
2. "Novo Lead" = acabou de entrar em contato, sem interesse claro
3. "Qualificado" = demonstrou interesse em produto/servico especifico
4. "Em Negociacao" = esta discutindo precos, condicoes, detalhes
5. "Proposta Enviada" = recebeu proposta/orcamento formal
6. "Fechado - Ganho" = confirmou compra, pagou, fechou negocio
7. "Fechado - Perdido" = desistiu, recusou, sumiu apos negociacao
8. So mova se houver evidencia clara na conversa. Na duvida, mantenha a etapa atual
9. NUNCA retroceda o cliente no funil (ex: de "Em Negociacao" para "Novo Lead") a menos que haja evidencia clara de desistencia
10. Retorne APENAS JSON valido

FORMATO DE RESPOSTA (JSON puro, sem markdown):
{"stageName": "Nome da Etapa", "confidence": 85, "reason": "Motivo curto"}

Responda SOMENTE com o JSON.`;

    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    log.info({ responseText: responseText.substring(0, 200) }, "AI funnel-stage classification response");

    // Parse JSON response
    let suggestion: { stageName: string; confidence: number; reason: string };
    try {
      let jsonText = responseText;
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```\n?/g, "");
      }
      suggestion = JSON.parse(jsonText.trim());
    } catch (parseError) {
      log.warn({ error: parseError, responseText }, "Failed to parse AI funnel-stage response");
      return null;
    }

    if (!suggestion?.stageName || suggestion.confidence < 75) {
      return null;
    }

    // Match stage by name
    const matchedStage = stages.find(
      (s) => s.name.toLowerCase() === suggestion.stageName.toLowerCase()
    );

    if (!matchedStage) {
      log.warn({ suggestedName: suggestion.stageName }, "AI suggested unknown funnel stage");
      return null;
    }

    // Don't move if already in this stage
    if (matchedStage.id === contact.funnelStageId) {
      return {
        stageId: matchedStage.id,
        stageName: matchedStage.name,
        confidence: suggestion.confidence,
        reason: suggestion.reason,
        moved: false,
      };
    }

    // Prevent backward movement (unless to "Fechado - Perdido")
    if (currentStage && matchedStage.order < currentStage.order) {
      const isClosingLost = matchedStage.name.toLowerCase().includes("perdido");
      if (!isClosingLost) {
        log.info(
          { currentStage: currentStage.name, suggestedStage: matchedStage.name },
          "Skipping backward funnel move"
        );
        return null;
      }
    }

    // Move the contact
    await prisma.contact.update({
      where: { id: contactId },
      data: { funnelStageId: matchedStage.id },
    });

    log.info(
      { contactId, from: currentStage?.name, to: matchedStage.name, confidence: suggestion.confidence },
      "Auto-moved contact in funnel"
    );

    return {
      stageId: matchedStage.id,
      stageName: matchedStage.name,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
      moved: true,
    };
  } catch (error) {
    log.error({ error, contactId }, "Error in auto funnel-stage classification");
    return null;
  }
}
