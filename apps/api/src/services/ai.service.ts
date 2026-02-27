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
  businessName?: string;
  prohibitedTopics?: string;
  responseLength?: "CURTA" | "MEDIA" | "LONGA";
  knowledgeContent?: string;
  // Dynamic context fields
  businessHoursStart?: string; // "09:00"
  businessHoursEnd?: string; // "18:00"
  workDays?: string[]; // ["seg","ter","qua","qui","sex"]
  contactName?: string;
  contactFunnelStage?: string;
  conversationStyle?: string;
}

export interface AIResponseResult {
  success: boolean;
  response?: string;
  confidence?: number;
  error?: string;
}

// Get current time in Brasilia (UTC-3)
function getBrasiliaTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function getSaudacao(): string {
  const hora = getBrasiliaTime().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function isWithinBusinessHours(
  start?: string,
  end?: string,
  workDays?: string[]
): boolean {
  const now = getBrasiliaTime();
  const dayMap = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const currentDay = dayMap[now.getDay()];
  const days = workDays?.length ? workDays : ["seg", "ter", "qua", "qui", "sex"];

  if (!days.includes(currentDay)) return false;

  const startStr = start || "09:00";
  const endStr = end || "18:00";
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return currentMinutes >= sh * 60 + sm && currentMinutes < eh * 60 + em;
}

// Build system prompt from persona configuration
function buildSystemPrompt(persona: PersonaConfig): string {
  const businessName = persona.businessName;
  const now = getBrasiliaTime();
  const horaAtual = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const saudacao = getSaudacao();
  const withinHours = isWithinBusinessHours(
    persona.businessHoursStart,
    persona.businessHoursEnd,
    persona.workDays
  );

  // Personality descriptions from sliders
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

  const emojiRule =
    persona.formalityLevel > 70
      ? "PROIBIDO usar emojis - mantenha comunicacao estritamente profissional"
      : persona.formalityLevel > 40
        ? "Use emojis com moderacao (maximo 1 por mensagem)"
        : "Pode usar emojis para ser mais amigavel";

  const responseLengthDesc =
    persona.responseLength === "CURTA"
      ? "Responda de forma MUITO breve (1 frase apenas)"
      : persona.responseLength === "LONGA"
        ? "Responda de forma detalhada (ate 4-5 frases)"
        : "Responda de forma concisa (2-3 frases)";

  // Build work days description
  const dayNames: Record<string, string> = {
    seg: "Segunda", ter: "Terca", qua: "Quarta", qui: "Quinta",
    sex: "Sexta", sab: "Sabado", dom: "Domingo",
  };
  const workDaysList = (persona.workDays?.length ? persona.workDays : ["seg", "ter", "qua", "qui", "sex"])
    .map((d) => dayNames[d] || d)
    .join(", ");

  // === 1. IDENTIDADE ===
  let prompt = `Voce e ${persona.name}, um assistente virtual inteligente${businessName ? ` da empresa ${businessName}` : ""}.
Voce e uma IA conversacional - pensa, adapta, entende contexto e responde como pessoa real. Nunca repita frases, nunca soe robotico.`;

  // === 2. CONSCIENCIA TEMPORAL ===
  prompt += `

HORARIO E DATA:
- Horario atual: ${horaAtual} (Brasilia)
- A saudacao correta agora e: "${saudacao}"
- Horario comercial: ${persona.businessHoursStart || "09:00"} as ${persona.businessHoursEnd || "18:00"}
- Dias de trabalho: ${workDaysList}
- Status: ${withinHours ? "DENTRO do horario comercial" : "FORA do horario comercial"}`;

  // === 3. REGRAS DE COMUNICACAO ===
  prompt += `

REGRAS DE COMUNICACAO (SIGA RIGOROSAMENTE):
1. Tom: ${formalityDesc}
2. Abordagem: ${persuasivenessDesc}
3. Energia: ${energyDesc}
4. Empatia: ${empathyDesc}
5. Emojis: ${emojiRule}
6. Tamanho: ${responseLengthDesc}
7. Responda sempre em portugues brasileiro
8. Nao use formatacao markdown (sem *, #, etc)
9. Nao despeje informacoes. Responda APENAS o que foi perguntado
10. NUNCA invente informacoes que voce nao tem. Se o cliente perguntar algo que nao esta nas suas instrucoes ou base de conhecimento (preco, politica de troca, desconto, permuta, garantia, etc), diga que vai verificar e retorna ou pergunte mais detalhes. NAO crie respostas ficticias.`;

  // === 4. CONTEXTO DO CLIENTE ===
  if (persona.contactName || persona.contactFunnelStage) {
    prompt += `\n\nCONTEXTO DO CLIENTE:`;
    if (persona.contactName) {
      prompt += `\n- Nome do cliente: ${persona.contactName}`;
    }
    if (persona.contactFunnelStage) {
      prompt += `\n- Etapa no funil de vendas: ${persona.contactFunnelStage}`;
    }
  }

  // === 5. COMANDO [CHAMAR_ATENDENTE] ===
  prompt += `

COMANDO ESPECIAL - CHAMAR ATENDENTE HUMANO:
Voce tem o comando [CHAMAR_ATENDENTE] para transferir a conversa para um humano.

REGRA PRINCIPAL: NUNCA use [CHAMAR_ATENDENTE] nas primeiras 3 mensagens da conversa. Mesmo que o cliente peca um humano, PRIMEIRO tente ajudar voce mesmo. So transfira depois de tentar ajudar e o cliente INSISTIR.

FLUXO OBRIGATORIO quando cliente pede humano:
1. Primeira vez que pede: "Posso te ajudar aqui mesmo! Qual sua duvida?" (NAO transfira)
2. Se insistir pela segunda vez: "Entendo! Deixa eu tentar te ajudar antes - sobre o que voce precisa?" (NAO transfira)
3. Se insistir pela TERCEIRA vez: Ai sim, transfira com [CHAMAR_ATENDENTE]

QUANDO USAR (somente apos tentar ajudar pelo menos 3 vezes):
- O cliente INSISTIU varias vezes que quer falar com humano e voce ja tentou ajudar
- Voce NAO consegue responder a duvida do cliente mesmo com as informacoes que tem (apos tentar)
- O cliente precisa de detalhes finais como pagamento, contrato, valores especificos que voce nao sabe

QUANDO NAO USAR (IMPORTANTE):
- Cliente esta fazendo perguntas sobre o produto/servico (responda voce mesmo!)
- Cliente disse "sim", "quero saber mais", "pode sim", "me explica" (ele quer INFORMACAO, nao um humano)
- Cliente esta demonstrando interesse (continue a conversa, nao transfira!)
- Voce ainda consegue ajudar com as informacoes que tem
- Cliente pediu humano apenas 1 ou 2 vezes (tente ajudar primeiro!)
- Na duvida, NAO transfira. Continue conversando.

COMO USAR:
1. Responda normalmente confirmando que um atendente vai entrar em contato
2. Numa linha SEPARADA, escreva EXATAMENTE: [CHAMAR_ATENDENTE]

${withinHours
    ? "Estamos DENTRO do horario comercial - diga que um atendente vai falar com ele em breve."
    : "Estamos FORA do horario comercial - diga que um atendente vai entrar em contato no proximo horario comercial."}

- Mande [CHAMAR_ATENDENTE] SOZINHO numa linha separada
- Use no MAXIMO 1 vez por conversa`;

  // === 6. TEMAS PROIBIDOS ===
  if (persona.prohibitedTopics?.trim()) {
    prompt += `\n\nTEMAS PROIBIDOS (NUNCA mencione ou discuta):\n${persona.prohibitedTopics}`;
  }

  // === 7. BASE DE CONHECIMENTO ===
  if (persona.knowledgeContent?.trim()) {
    prompt += `\n\nINFORMACOES DO NEGOCIO (use estas informacoes para responder):\n${persona.knowledgeContent}`;
  }

  // === 8. SYSTEM PROMPT CUSTOMIZADO ===
  if (persona.systemPrompt) {
    prompt += `\n\nContexto e instrucoes especificas:\n${persona.systemPrompt}`;
  }

  // === 9. INSTRUCOES ADICIONAIS ===
  if (persona.customInstructions) {
    prompt += `\n\nInstrucoes adicionais:\n${persona.customInstructions}`;
  }

  // === 10. ESTILO E FLUXO DE CONVERSA (extraido de screenshots) ===
  if (persona.conversationStyle?.trim()) {
    prompt += `\n\nESTILO E FLUXO DE CONVERSA (inspire-se neste padrao de atendimento, NAO copie literalmente - adapte ao contexto):
${persona.conversationStyle}`;
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

// Transcribe audio using Gemini
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

  const audioBase64 = audioBuffer.toString("base64");

  const result = await model.generateContent([
    "Transcreva este audio em portugues brasileiro. Retorne APENAS o texto falado, sem nenhuma explicacao ou formatacao extra.",
    {
      inlineData: {
        mimeType,
        data: audioBase64,
      },
    },
  ]);

  return result.response.text().trim();
}

// Analyze conversation screenshots and extract communication style + flow
export async function analyzeConversationScreenshots(
  images: Array<{ buffer: Buffer; mimeType: string }>
): Promise<string> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Analise ${images.length > 1 ? "estas screenshots" : "esta screenshot"} de uma conversa de WhatsApp (em ordem cronologica). Extraia o ESTILO e o FLUXO DE CONVERSA do vendedor/atendente (as mensagens enviadas, nao as recebidas).

ESTILO DE COMUNICACAO:
- Tom geral (formal, casual, amigavel, profissional)
- Girias ou expressoes tipicas usadas
- Uso de emojis (quais e com que frequencia)
- Tamanho tipico das mensagens
- Padroes marcantes de escrita (abreviacoes, pontuacao, etc)

FLUXO DA CONVERSA:
- Como abre a conversa / abordagem inicial
- Como apresenta produtos ou servicos
- Como lida com objecoes e duvidas do cliente
- Tecnicas de persuasao e venda usadas
- Como conduz para o fechamento
- Como se despede ou faz follow-up

Retorne APENAS a descricao detalhada do estilo e fluxo, sem introducao ou conclusao. Seja especifico para que outra IA consiga reproduzir o mesmo padrao de atendimento.`;

  const contentParts: any[] = [prompt];
  for (const img of images) {
    contentParts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.buffer.toString("base64"),
      },
    });
  }

  const result = await model.generateContent(contentParts);
  return result.response.text().trim();
}

// Simple response for when AI is not configured
export function getDefaultResponse(): string {
  return "Ola! Recebi sua mensagem. Em breve um atendente ira responder.";
}
