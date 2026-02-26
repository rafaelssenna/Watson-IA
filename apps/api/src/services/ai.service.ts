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
  // New fields
  businessName?: string;
  prohibitedTopics?: string;
  responseLength?: "CURTA" | "MEDIA" | "LONGA";
  knowledgeContent?: string; // Combined text from knowledge files
}

export interface AIResponseResult {
  success: boolean;
  response?: string;
  confidence?: number;
  error?: string;
}

// Build system prompt from persona configuration
function buildSystemPrompt(persona: PersonaConfig): string {
  const businessName = persona.businessName;

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

  // Build response length rule
  const responseLengthDesc =
    persona.responseLength === "CURTA"
      ? "Responda de forma MUITO breve (1 frase apenas)"
      : persona.responseLength === "LONGA"
        ? "Responda de forma detalhada (ate 4-5 frases)"
        : "Responda de forma concisa (2-3 frases)";

  // Base prompt with personality always applied
  let prompt = `Voce e ${persona.name}, um assistente virtual inteligente${businessName ? ` da empresa ${businessName}` : ""}.

REGRAS OBRIGATORIAS DE COMUNICACAO (SIGA RIGOROSAMENTE):
1. Tom: ${formalityDesc}
2. Abordagem: ${persuasivenessDesc}
3. Energia: ${energyDesc}
4. Empatia: ${empathyDesc}
5. Emojis: ${emojiRule}
6. Tamanho: ${responseLengthDesc}

Seu papel:
- Conversar com os clientes via WhatsApp
- Responder perguntas e ajudar no que for preciso
- NUNCA dizer que vai transferir para um atendente humano - voce E o atendente

Regras adicionais:
- Responda sempre em portugues brasileiro
- Nao use formatacao markdown (sem *, #, etc)
- Se o cliente perguntar algo que voce nao sabe, pergunte mais detalhes`;

  // Add prohibited topics if provided
  if (persona.prohibitedTopics?.trim()) {
    prompt += `\n\nTEMAS PROIBIDOS (NUNCA mencione ou discuta):\n${persona.prohibitedTopics}`;
  }

  // Add knowledge content if provided
  if (persona.knowledgeContent?.trim()) {
    prompt += `\n\nINFORMACOES DO NEGOCIO (use estas informacoes para responder):\n${persona.knowledgeContent}`;
  }

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
  persona: PersonaConfig
): Promise<AIResponseResult> {
  try {
    console.log(`[ai.generateResponse] Generating response for: "${incomingMessage.substring(0, 50)}..."`);

    const ai = getGenAI();
    // Use gemini-pro which is widely available
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const systemPrompt = buildSystemPrompt(persona);

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

// Generate persona configuration from business description
export interface GeneratedPersonaConfig {
  name: string;
  businessName: string;
  systemPrompt: string;
  greetingMessage: string;
  formalityLevel: number;
  persuasiveness: number;
  energyLevel: number;
  empathyLevel: number;
  responseLength: "CURTA" | "MEDIA" | "LONGA";
  prohibitedTopics: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  workDays: string[];
}

export async function generatePersonaFromDescription(
  description: string,
  fixedName?: string,
  fixedBusinessName?: string
): Promise<GeneratedPersonaConfig> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

  const nameInstruction = fixedName
    ? `O nome do assistente JA FOI definido pelo usuario como "${fixedName}". Use EXATAMENTE este nome no campo "name".`
    : `Crie um nome adequado para o assistente (ex: 'Assistente da Barbearia X').`;

  const businessNameInstruction = fixedBusinessName
    ? `O nome da empresa JA FOI definido pelo usuario como "${fixedBusinessName}". Use EXATAMENTE este nome no campo "businessName".`
    : `Extraia o nome do negocio da descricao.`;

  const prompt = `Voce e um especialista em configurar assistentes virtuais de WhatsApp para empresas brasileiras.

O usuario descreveu seu negocio assim:
"${description}"

${nameInstruction}
${businessNameInstruction}

Com base nessa descricao, gere uma configuracao COMPLETA para o assistente virtual. Retorne APENAS um JSON valido (sem markdown, sem \`\`\`) com os seguintes campos:

{
  "name": "Nome do assistente",
  "businessName": "Nome do negocio",
  "systemPrompt": "Prompt detalhado descrevendo quem e o assistente, o que o negocio faz, servicos oferecidos, diferenciais, e como deve atender os clientes. Minimo 3 paragrafos.",
  "greetingMessage": "Mensagem de boas-vindas para novos contatos no WhatsApp. Deve ser acolhedora e mencionar o nome do negocio.",
  "formalityLevel": 0-100 (0=muito casual, 100=muito formal),
  "persuasiveness": 0-100 (0=apenas informativo, 100=muito persuasivo/vendedor),
  "energyLevel": 0-100 (0=calmo/sereno, 100=muito energetico),
  "empathyLevel": 0-100 (0=direto ao ponto, 100=muito empatico),
  "responseLength": "CURTA" ou "MEDIA" ou "LONGA",
  "prohibitedTopics": "Lista de temas que o assistente NAO deve abordar (ex: concorrentes, politica, precos de terceiros)",
  "businessHoursStart": "HH:MM formato 24h (ex: 09:00). Se o usuario mencionou horario, use o que ele disse. Senao, use 09:00",
  "businessHoursEnd": "HH:MM formato 24h (ex: 18:00). Se o usuario mencionou horario, use o que ele disse. Senao, use 18:00",
  "workDays": ["seg", "ter", "qua", "qui", "sex"] // Array com dias da semana abreviados: seg, ter, qua, qui, sex, sab, dom. Se o usuario mencionou dias, use os que ele disse.
}

REGRAS:
- Adapte a personalidade ao tipo de negocio (barbearia = casual, escritorio advocacia = formal)
- O systemPrompt deve ser rico e detalhado, incluindo informacoes extraidas da descricao
- A greetingMessage deve ser natural e nao robotica
- prohibitedTopics deve incluir temas sensiveis para o tipo de negocio
- Se o usuario mencionou horario de funcionamento, dias de atendimento, tamanho de respostas, personalidade ou qualquer configuracao especifica, RESPEITE e configure exatamente como ele pediu
- Retorne SOMENTE o JSON, nada mais`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  return parseGeneratedJSON(text);
}

// Generate persona configuration from audio description
export async function generatePersonaFromAudio(
  audioBuffer: Buffer,
  mimeType: string,
  fixedName?: string,
  fixedBusinessName?: string
): Promise<GeneratedPersonaConfig> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

  const nameInstruction = fixedName
    ? `O nome do assistente JA FOI definido pelo usuario como "${fixedName}". Use EXATAMENTE este nome no campo "name".`
    : `Crie um nome adequado para o assistente (ex: 'Assistente da Barbearia X').`;

  const businessNameInstruction = fixedBusinessName
    ? `O nome da empresa JA FOI definido pelo usuario como "${fixedBusinessName}". Use EXATAMENTE este nome no campo "businessName".`
    : `Extraia o nome do negocio do audio.`;

  const prompt = `Voce e um especialista em configurar assistentes virtuais de WhatsApp para empresas brasileiras.

O usuario gravou um AUDIO descrevendo seu negocio e como quer que o assistente Watson trabalhe para ele.

${nameInstruction}
${businessNameInstruction}

Escute o audio com atencao e, com base no que o usuario disse, gere uma configuracao COMPLETA para o assistente virtual. Retorne APENAS um JSON valido (sem markdown, sem \`\`\`) com os seguintes campos:

{
  "name": "Nome do assistente",
  "businessName": "Nome do negocio",
  "systemPrompt": "Prompt detalhado descrevendo quem e o assistente, o que o negocio faz, servicos oferecidos, diferenciais, e como deve atender os clientes. Minimo 3 paragrafos.",
  "greetingMessage": "Mensagem de boas-vindas para novos contatos no WhatsApp. Deve ser acolhedora e mencionar o nome do negocio.",
  "formalityLevel": 0-100 (0=muito casual, 100=muito formal),
  "persuasiveness": 0-100 (0=apenas informativo, 100=muito persuasivo/vendedor),
  "energyLevel": 0-100 (0=calmo/sereno, 100=muito energetico),
  "empathyLevel": 0-100 (0=direto ao ponto, 100=muito empatico),
  "responseLength": "CURTA" ou "MEDIA" ou "LONGA",
  "prohibitedTopics": "Lista de temas que o assistente NAO deve abordar (ex: concorrentes, politica, precos de terceiros)",
  "businessHoursStart": "HH:MM formato 24h (ex: 09:00). Se o usuario mencionou horario, use o que ele disse. Senao, use 09:00",
  "businessHoursEnd": "HH:MM formato 24h (ex: 18:00). Se o usuario mencionou horario, use o que ele disse. Senao, use 18:00",
  "workDays": ["seg", "ter", "qua", "qui", "sex"] // Array com dias da semana abreviados: seg, ter, qua, qui, sex, sab, dom. Se o usuario mencionou dias, use os que ele disse.
}

REGRAS:
- Adapte a personalidade ao tipo de negocio (barbearia = casual, escritorio advocacia = formal)
- O systemPrompt deve ser rico e detalhado, incluindo informacoes extraidas do audio
- A greetingMessage deve ser natural e nao robotica
- prohibitedTopics deve incluir temas sensiveis para o tipo de negocio
- Se o usuario mencionou horario de funcionamento, dias de atendimento, tamanho de respostas, personalidade ou qualquer configuracao especifica, RESPEITE e configure exatamente como ele pediu
- Retorne SOMENTE o JSON, nada mais`;

  const audioBase64 = audioBuffer.toString("base64");

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: mimeType,
        data: audioBase64,
      },
    },
  ]);

  const text = result.response.text().trim();
  const parsed = parseGeneratedJSON(text);
  return parsed;
}

function parseGeneratedJSON(text: string): GeneratedPersonaConfig {
  // Remove possible markdown wrapping
  let jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();

  // Try parsing directly first
  try {
    const parsed = JSON.parse(jsonStr) as GeneratedPersonaConfig;
    return clampPersonaValues(parsed);
  } catch {
    // If it fails, fix control characters ONLY inside JSON string values
    // This regex matches JSON string literals and escapes newlines within them
    jsonStr = jsonStr.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
      return match
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
    });

    try {
      const parsed = JSON.parse(jsonStr) as GeneratedPersonaConfig;
      return clampPersonaValues(parsed);
    } catch (e) {
      console.error("[parseGeneratedJSON] Failed to parse. Raw text:", text.substring(0, 500));
      throw e;
    }
  }
}

function clampPersonaValues(parsed: GeneratedPersonaConfig): GeneratedPersonaConfig {
  parsed.formalityLevel = Math.max(0, Math.min(100, parsed.formalityLevel));
  parsed.persuasiveness = Math.max(0, Math.min(100, parsed.persuasiveness));
  parsed.energyLevel = Math.max(0, Math.min(100, parsed.energyLevel));
  parsed.empathyLevel = Math.max(0, Math.min(100, parsed.empathyLevel));

  if (!["CURTA", "MEDIA", "LONGA"].includes(parsed.responseLength)) {
    parsed.responseLength = "MEDIA";
  }

  // Default business hours if not provided
  if (!parsed.businessHoursStart) parsed.businessHoursStart = "09:00";
  if (!parsed.businessHoursEnd) parsed.businessHoursEnd = "18:00";

  // Validate work days
  const validDays = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
  if (!Array.isArray(parsed.workDays) || parsed.workDays.length === 0) {
    parsed.workDays = ["seg", "ter", "qua", "qui", "sex"];
  } else {
    parsed.workDays = parsed.workDays.filter((d: string) => validDays.includes(d));
    if (parsed.workDays.length === 0) {
      parsed.workDays = ["seg", "ter", "qua", "qui", "sex"];
    }
  }

  return parsed;
}

// Simple response for when AI is not configured
export function getDefaultResponse(): string {
  return "Ola! Recebi sua mensagem. Em breve um atendente ira responder.";
}
