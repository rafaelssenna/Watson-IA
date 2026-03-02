// Lead Classifier Service - AI-powered lead classification using Gemini

import { GoogleGenerativeAI } from "@google/generative-ai";

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

export type LeadScore = "qualified" | "interested" | "new_lead";

export interface LeadClassification {
  score: LeadScore;
  confidence: number;
  reasons: string[];
  suggestedAction?: string;
}

export const leadScoreLabels: Record<LeadScore, { label: string; color: string }> = {
  qualified: { label: "Qualificado", color: "green" },
  interested: { label: "Interessado", color: "yellow" },
  new_lead: { label: "Novo Lead", color: "blue" },
};

/**
 * Classify a lead based on conversation messages using Gemini AI.
 * Falls back to keyword-based classification if AI fails.
 */
export async function classifyLead(
  messagesHistory: { role: "user" | "assistant"; content: string }[]
): Promise<LeadClassification> {
  // No messages → new lead
  if (!messagesHistory || messagesHistory.length === 0) {
    return {
      score: "new_lead",
      confidence: 100,
      reasons: ["Nenhuma mensagem no historico"],
    };
  }

  // Only customer messages matter for classification
  const customerMessages = messagesHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  // Too short → new lead
  if (customerMessages.length < 50) {
    return {
      score: "new_lead",
      confidence: 80,
      reasons: ["Conversa muito curta para analise detalhada"],
    };
  }

  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Voce e um especialista em qualificacao de leads para vendas. Analise as mensagens do cliente abaixo e classifique o nivel de interesse.

CLASSIFICACOES:
- "qualified": Cliente demonstrou intencao clara de compra (pediu preco, perguntou pagamento, quer fechar, pediu link)
- "interested": Cliente demonstrou interesse mas sem intencao de compra (perguntou sobre produto, pediu fotos, comparou, disse que gostou)
- "new_lead": Apenas saudacao, perguntas genericas, sem interesse claro

MENSAGENS DO CLIENTE:
${customerMessages.substring(0, 3000)}

INSTRUCOES:
1. Analise o tom e intencao das mensagens
2. "confidence" deve ser de 0 a 100 (quao certo voce esta da classificacao)
3. "reasons" deve ter 1-3 motivos curtos em portugues
4. "suggestedAction" deve ser uma acao pratica para o vendedor em portugues
5. Responda SOMENTE com JSON valido, sem markdown

FORMATO:
{"score": "qualified|interested|new_lead", "confidence": 85, "reasons": ["motivo1", "motivo2"], "suggestedAction": "acao sugerida"}`;

    const result = await withRetry(async () => {
      const response = await model.generateContent(prompt);
      return response.response.text();
    });

    let jsonText = result.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```\n?/g, "");
    }

    const classification = JSON.parse(jsonText.trim());

    const validScores: LeadScore[] = ["qualified", "interested", "new_lead"];
    const score = validScores.includes(classification.score) ? classification.score : "new_lead";

    return {
      score,
      confidence: Math.min(100, Math.max(0, classification.confidence || 70)),
      reasons: Array.isArray(classification.reasons) ? classification.reasons : [],
      suggestedAction: classification.suggestedAction || undefined,
    };
  } catch (error) {
    // Fallback to keyword-based classification
    return classifyLeadByKeywords(messagesHistory);
  }
}

/**
 * Keyword-based fallback classification when AI is unavailable.
 */
function classifyLeadByKeywords(
  messagesHistory: { role: "user" | "assistant"; content: string }[]
): LeadClassification {
  const customerMessages = messagesHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");

  const qualifiedKeywords = [
    "quero comprar",
    "vou levar",
    "pode separar",
    "qual o pix",
    "como pago",
    "aceita cartao",
    "parcela",
    "frete",
    "entrega",
    "manda o link",
    "enviar link",
    "finalizar",
    "fechar",
    "vou pegar",
    "me passa o valor",
    "quero esse",
    "vou querer",
  ];

  const interestedKeywords = [
    "quanto custa",
    "qual o preco",
    "tem foto",
    "mostra",
    "quero ver",
    "tem em",
    "qual tamanho",
    "qual cor",
    "vou pensar",
    "interessado",
    "gostei",
    "bonito",
    "lindo",
    "tem disponivel",
    "como funciona",
    "me fala mais",
  ];

  if (qualifiedKeywords.some((kw) => customerMessages.includes(kw))) {
    return {
      score: "qualified",
      confidence: 70,
      reasons: ["Demonstrou intencao clara de compra (palavras-chave)"],
    };
  }

  if (interestedKeywords.some((kw) => customerMessages.includes(kw))) {
    return {
      score: "interested",
      confidence: 60,
      reasons: ["Demonstrou interesse em produtos (palavras-chave)"],
    };
  }

  return {
    score: "new_lead",
    confidence: 50,
    reasons: ["Sem sinais claros de interesse"],
  };
}

/**
 * Retry with exponential backoff.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, baseDelay = 1000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
