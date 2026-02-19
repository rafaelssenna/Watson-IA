// API Constants
export const API_VERSION = "v1";
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Auth Constants
export const ACCESS_TOKEN_EXPIRY = "15m";
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;
export const TRIAL_DAYS = 7;

// Classification Thresholds
export const CLASSIFICATION_THRESHOLDS = {
  AUTO_REPLY_CONFIDENCE: 0.85,
  SUGGEST_CONFIDENCE: 0.60,
  HIGH_URGENCY_SCORE: 0.75,
  CRITICAL_URGENCY_SCORE: 0.90,
  HOT_LEAD_SCORE: 70,
  WARM_LEAD_SCORE: 40,
} as const;

// Response Delays (ms) - Humanization
export const RESPONSE_DELAYS = {
  MIN_TYPING_TIME: 1000,
  MAX_TYPING_TIME: 5000,
  CHAR_TYPING_RATE: 50, // ms per character
  RANDOM_DELAY_MIN: 500,
  RANDOM_DELAY_MAX: 2000,
} as const;

// WhatsApp Constants
export const WHATSAPP = {
  MAX_MESSAGE_LENGTH: 4096,
  MAX_CAPTION_LENGTH: 1024,
  SUPPORTED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
  SUPPORTED_VIDEO_TYPES: ["video/mp4", "video/3gp"],
  SUPPORTED_AUDIO_TYPES: ["audio/mpeg", "audio/ogg", "audio/wav"],
  SUPPORTED_DOCUMENT_TYPES: [
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
} as const;

// Lead Score Weights
export const LEAD_SCORE_WEIGHTS = {
  PURCHASE_INTENT: 0.35,
  URGENCY: 0.20,
  ENGAGEMENT: 0.15,
  RECENCY: 0.15,
  PROFILE_COMPLETENESS: 0.10,
  SENTIMENT: 0.05,
} as const;

// Funnel Stages (Default)
export const DEFAULT_FUNNEL_STAGES = [
  { name: "Novo Lead", color: "#6366f1", order: 0 },
  { name: "Qualificado", color: "#8b5cf6", order: 1 },
  { name: "Em Negociacao", color: "#a855f7", order: 2 },
  { name: "Proposta Enviada", color: "#d946ef", order: 3 },
  { name: "Fechado - Ganho", color: "#22c55e", order: 4 },
  { name: "Fechado - Perdido", color: "#ef4444", order: 5 },
] as const;

// Intent Labels (PT-BR)
export const INTENT_LABELS: Record<string, string> = {
  purchase: "Compra",
  quote: "Orcamento",
  support: "Suporte",
  complaint: "Reclamacao",
  information: "Informacao",
  curiosity: "Curiosidade",
  spam: "Spam",
  greeting: "Saudacao",
  unknown: "Desconhecido",
};

// Urgency Labels (PT-BR)
export const URGENCY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  CRITICAL: "Critica",
};

// Sentiment Labels (PT-BR)
export const SENTIMENT_LABELS: Record<string, string> = {
  VERY_NEGATIVE: "Muito Negativo",
  NEGATIVE: "Negativo",
  NEUTRAL: "Neutro",
  POSITIVE: "Positivo",
  VERY_POSITIVE: "Muito Positivo",
};

// Persona Type Labels (PT-BR)
export const PERSONA_TYPE_LABELS: Record<string, string> = {
  OWNER: "Primeira Pessoa",
  SECRETARY: "Secretaria",
  TECHNICAL: "Tecnico",
  COMMERCIAL: "Comercial",
  AGGRESSIVE_SALES: "Vendas Agressivo",
  CUSTOM: "Personalizado",
};

// Colors
export const COLORS = {
  // Urgency
  urgencyLow: "#3b82f6",
  urgencyNormal: "#6b7280",
  urgencyHigh: "#f59e0b",
  urgencyCritical: "#ef4444",

  // Sentiment
  sentimentPositive: "#22c55e",
  sentimentNeutral: "#6b7280",
  sentimentNegative: "#ef4444",

  // Lead Score
  scoreHot: "#ef4444",
  scoreWarm: "#f59e0b",
  scoreCold: "#3b82f6",

  // Status
  connected: "#22c55e",
  disconnected: "#ef4444",
  pending: "#f59e0b",
} as const;
