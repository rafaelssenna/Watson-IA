// AI Service - Generate responses using Google Gemini

import { GoogleGenerativeAI } from "@google/generative-ai";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

// Initialize Gemini
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

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PersonaConfig {
  name: string;
  systemPrompt?: string;
  formalityLevel: number; // 0-100
  persuasiveness: number; // 0-100
  energyLevel: number; // 0-100
  empathyLevel: number; // 0-100
  customInstructions?: string;
}

export interface AIResponseResult {
  success: boolean;
  response?: string;
  confidence?: number;
  error?: string;
}

// Build system prompt from persona configuration
function buildSystemPrompt(persona: PersonaConfig, businessName?: string): string {
  // If persona has a custom system prompt, use it
  if (persona.systemPrompt) {
    return persona.systemPrompt;
  }

  // Build prompt based on persona attributes
  const formalityDesc =
    persona.formalityLevel > 70
      ? "formal e profissional"
      : persona.formalityLevel > 40
        ? "equilibrado entre formal e casual"
        : "casual e amigavel";

  const persuasivenessDesc =
    persona.persuasiveness > 70
      ? "persuasivo e focado em vendas"
      : persona.persuasiveness > 40
        ? "gentilmente sugestivo"
        : "informativo sem pressionar";

  const energyDesc =
    persona.energyLevel > 70
      ? "energetico e entusiasmado"
      : persona.energyLevel > 40
        ? "equilibrado"
        : "calmo e tranquilo";

  const empathyDesc =
    persona.empathyLevel > 70
      ? "muito empatico e acolhedor"
      : persona.empathyLevel > 40
        ? "atencioso"
        : "direto ao ponto";

  return `Voce e ${persona.name}, um assistente virtual${businessName ? ` da empresa ${businessName}` : ""}.

Seu estilo de comunicacao e:
- Tom: ${formalityDesc}
- Abordagem: ${persuasivenessDesc}
- Energia: ${energyDesc}
- Empatia: ${empathyDesc}

Regras importantes:
- Responda sempre em portugues brasileiro
- Seja conciso e direto nas respostas
- Nao use formatacao markdown (sem *, #, etc)
- Nao faca perguntas demais, foque em ajudar
- Se nao souber algo, seja honesto
${persona.customInstructions ? `\nInstrucoes adicionais:\n${persona.customInstructions}` : ""}`;
}

// Generate AI response
export async function generateResponse(
  incomingMessage: string,
  conversationHistory: ConversationMessage[],
  persona: PersonaConfig,
  businessName?: string
): Promise<AIResponseResult> {
  try {
    console.log(`[ai.generateResponse] Generating response for: "${incomingMessage.substring(0, 50)}..."`);

    const ai = getGenAI();
    // Use gemini-pro which is widely available
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const systemPrompt = buildSystemPrompt(persona, businessName);

    // Build conversation for Gemini
    // Gemini uses a different format - we'll use the chat API
    const chat = model.startChat({
      history: conversationHistory.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),
      generationConfig: {
        maxOutputTokens: 500, // Keep responses concise for WhatsApp
        temperature: 0.7,
      },
      // systemInstruction must be a Content object with parts array
      systemInstruction: {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
    });

    // Send the new message
    const result = await chat.sendMessage(incomingMessage);
    const response = result.response.text();

    console.log(`[ai.generateResponse] Response generated: "${response.substring(0, 100)}..."`);

    return {
      success: true,
      response: response.trim(),
      confidence: 0.85, // TODO: Calculate actual confidence
    };
  } catch (error) {
    console.error("[ai.generateResponse] Error:", error);
    return {
      success: false,
      error: String(error),
    };
  }
}

// Simple response for when AI is not configured
export function getDefaultResponse(): string {
  return "Ola! Recebi sua mensagem. Em breve um atendente ira responder.";
}
