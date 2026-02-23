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
  // Build personality descriptions based on slider values
  const formalityDesc =
    persona.formalityLevel > 70
      ? "FORMAL e PROFISSIONAL - use linguagem corporativa, trate por 'senhor/senhora', seja polido e educado"
      : persona.formalityLevel > 40
        ? "equilibrado entre formal e casual"
        : "casual e amigavel, pode usar girias";

  const persuasivenessDesc =
    persona.persuasiveness > 70
      ? "persuasivo e focado em vendas"
      : persona.persuasiveness > 40
        ? "gentilmente sugestivo"
        : "informativo sem pressionar";

  const energyDesc =
    persona.energyLevel > 70
      ? "energetico e entusiasmado, use exclamacoes"
      : persona.energyLevel > 40
        ? "equilibrado e neutro"
        : "CALMO e TRANQUILO - seja sereno, sem exclamacoes excessivas, tom suave e ponderado";

  const empathyDesc =
    persona.empathyLevel > 70
      ? "muito empatico e acolhedor"
      : persona.empathyLevel > 40
        ? "atencioso"
        : "direto ao ponto";

  // Build emoji rule based on formality
  const emojiRule =
    persona.formalityLevel > 70
      ? "PROIBIDO usar emojis - mantenha comunicacao estritamente profissional"
      : persona.formalityLevel > 40
        ? "Use emojis com moderacao (maximo 1 por mensagem)"
        : "Pode usar emojis para ser mais amigavel";

  // Base prompt with personality always applied
  let prompt = `Voce e ${persona.name}, um assistente virtual inteligente${businessName ? ` da empresa ${businessName}` : ""}.

REGRAS OBRIGATORIAS DE COMUNICACAO (SIGA RIGOROSAMENTE):
1. Tom: ${formalityDesc}
2. Abordagem: ${persuasivenessDesc}
3. Energia: ${energyDesc}
4. Empatia: ${empathyDesc}
5. Emojis: ${emojiRule}

Seu papel:
- Conversar com os clientes via WhatsApp
- Responder perguntas e ajudar no que for preciso
- NUNCA dizer que vai transferir para um atendente humano - voce E o atendente

Regras adicionais:
- Responda sempre em portugues brasileiro
- Seja conciso (maximo 2-3 frases)
- Nao use formatacao markdown (sem *, #, etc)
- Se o cliente perguntar algo que voce nao sabe, pergunte mais detalhes`;

  // Add custom system prompt if provided
  if (persona.systemPrompt) {
    prompt += `\n\nContexto e instrucoes especificas:\n${persona.systemPrompt}`;
  }

  // Add custom instructions if provided
  if (persona.customInstructions) {
    prompt += `\n\nInstrucoes adicionais:\n${persona.customInstructions}`;
  }

  return prompt;
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
