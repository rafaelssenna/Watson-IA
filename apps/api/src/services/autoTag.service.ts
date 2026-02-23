// Auto-tagging Service - Automatically tag contacts based on conversation analysis

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

interface TagToAnalyze {
  id: string;
  name: string;
  description: string | null;
}

interface AppliedTag {
  id: string;
  name: string;
  color: string;
  confidence: number;
  reason: string;
}

interface Logger {
  info: (obj: any, msg?: string) => void;
  error: (obj: any, msg?: string) => void;
  warn: (obj: any, msg?: string) => void;
}

/**
 * Analyze conversation and apply relevant auto-tags to a contact
 */
export async function analyzeAndApplyTags(
  orgId: string,
  contactId: string,
  conversationText: string,
  availableTags: TagToAnalyze[],
  logger?: Logger
): Promise<AppliedTag[]> {
  const log = logger || console;

  try {
    if (!conversationText.trim() || availableTags.length === 0) {
      return [];
    }

    // Build prompt for AI
    const tagsDescription = availableTags
      .map((t) => `- "${t.name}": ${t.description || "Sem descricao"}`)
      .join("\n");

    const prompt = `Analise a conversa abaixo e determine quais tags devem ser aplicadas ao cliente.

TAGS DISPONIVEIS:
${tagsDescription}

CONVERSA:
${conversationText.substring(0, 3000)}

INSTRUCOES:
1. Analise o contexto completo da conversa
2. Identifique quais tags se aplicam baseado na descricao de cada uma
3. Retorne APENAS um JSON valido no formato abaixo
4. Inclua apenas tags que REALMENTE se aplicam (confianca >= 70%)
5. Se nenhuma tag se aplicar, retorne um array vazio

FORMATO DE RESPOSTA (JSON puro, sem markdown):
[
  {"tagName": "Nome da Tag", "confidence": 85, "reason": "Motivo curto"}
]

Responda SOMENTE com o JSON, sem explicacoes adicionais.`;

    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    log.info({ responseText: responseText.substring(0, 200) }, "AI auto-tag response");

    // Parse JSON response
    let suggestedTags: Array<{ tagName: string; confidence: number; reason: string }> = [];
    try {
      // Remove markdown code blocks if present
      let jsonText = responseText;
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```\n?/g, "");
      }
      suggestedTags = JSON.parse(jsonText.trim());
    } catch (parseError) {
      log.warn({ error: parseError, responseText }, "Failed to parse AI tag response");
      return [];
    }

    if (!Array.isArray(suggestedTags)) {
      return [];
    }

    // Filter and apply tags
    const appliedTags: AppliedTag[] = [];

    for (const suggestion of suggestedTags) {
      if (suggestion.confidence < 70) continue;

      const matchingTag = availableTags.find(
        (t) => t.name.toLowerCase() === suggestion.tagName.toLowerCase()
      );

      if (!matchingTag) continue;

      // Get full tag data
      const fullTag = await prisma.tag.findUnique({
        where: { id: matchingTag.id },
      });

      if (!fullTag) continue;

      // Check if tag is already applied
      const existing = await prisma.contactTag.findUnique({
        where: { contactId_tagId: { contactId, tagId: matchingTag.id } },
      });

      if (!existing) {
        // Apply the tag
        await prisma.contactTag.create({
          data: {
            contactId,
            tagId: matchingTag.id,
            appliedByAi: true,
          },
        });

        appliedTags.push({
          id: fullTag.id,
          name: fullTag.name,
          color: fullTag.color,
          confidence: suggestion.confidence,
          reason: suggestion.reason,
        });

        log.info(
          { contactId, tagName: fullTag.name, confidence: suggestion.confidence },
          "Auto-tag applied"
        );
      }
    }

    return appliedTags;
  } catch (error) {
    log.error({ error, contactId }, "Error in auto-tagging");
    return [];
  }
}

/**
 * Auto-tag a contact after a conversation update
 * This is called from the webhook handler
 */
export async function autoTagContact(
  orgId: string,
  contactId: string,
  recentMessages: Array<{ content: string | null; direction: string }>,
  logger?: Logger
): Promise<AppliedTag[]> {
  const log = logger || console;

  try {
    // Get auto-tags for the organization
    const autoTags = await prisma.tag.findMany({
      where: { organizationId: orgId, isAuto: true },
      select: { id: true, name: true, description: true },
    });

    if (autoTags.length === 0) {
      return [];
    }

    // Build conversation text
    const conversationText = recentMessages
      .filter((m) => m.content)
      .map((m) => `${m.direction === "INBOUND" ? "Cliente" : "Atendente"}: ${m.content}`)
      .join("\n");

    if (!conversationText.trim()) {
      return [];
    }

    return analyzeAndApplyTags(orgId, contactId, conversationText, autoTags, log);
  } catch (error) {
    log.error({ error, contactId }, "Error in autoTagContact");
    return [];
  }
}
