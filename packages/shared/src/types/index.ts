// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Auth Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "AGENT";
  organizationId: string;
  organizationName: string;
}

// Classification Types
export interface MessageClassification {
  intent: {
    primary: IntentType;
    confidence: number;
    secondary?: IntentType[];
  };
  urgency: {
    level: UrgencyLevel;
    confidence: number;
    reasons: string[];
  };
  sentiment: {
    value: SentimentValue;
    score: number;
  };
  clientProfile: {
    type: ClientProfileType;
    confidence: number;
  };
  closingProbability: number;
  reputationalRisk: {
    level: RiskLevel;
    factors: string[];
  };
  leadScore: number;
  suggestedAction: SuggestedAction;
  extractedEntities: ExtractedEntities;
}

export type IntentType =
  | "purchase"
  | "quote"
  | "support"
  | "complaint"
  | "information"
  | "curiosity"
  | "spam"
  | "greeting"
  | "unknown";

export type UrgencyLevel = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type SentimentValue =
  | "VERY_NEGATIVE"
  | "NEGATIVE"
  | "NEUTRAL"
  | "POSITIVE"
  | "VERY_POSITIVE";

export type ClientProfileType =
  | "NEW_LEAD"
  | "INTERESTED"
  | "NEGOTIATING"
  | "CUSTOMER"
  | "VIP"
  | "CHURNED"
  | "INACTIVE";

export type RiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";

export type SuggestedAction =
  | "AUTO_REPLY"
  | "SUGGEST_RESPONSE"
  | "ESCALATE_HUMAN"
  | "PRIORITY_FLAG";

export interface ExtractedEntities {
  phone?: string;
  email?: string;
  city?: string;
  product?: string;
  quantity?: number;
  budget?: number;
}

// Conversation Types
export interface ConversationSummary {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  intent?: IntentType;
  urgency: UrgencyLevel;
  leadScore: number;
  status: ConversationStatus;
  mode: ConversationMode;
}

export type ConversationStatus =
  | "OPEN"
  | "WAITING_CLIENT"
  | "WAITING_AGENT"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export type ConversationMode = "AI_AUTO" | "AI_ASSISTED" | "HUMAN_ONLY";

// Contact Types
export interface ContactSummary {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  leadScore: number;
  funnelStage?: string;
  funnelStageColor?: string;
  lastInteractionAt?: string;
  tags: Array<{ id: string; name: string; color: string }>;
}

// Dashboard Types
export interface DashboardInsights {
  activeConversations: number;
  purchaseIntentCount: number;
  urgentCount: number;
  coolingCount: number;
  responseRate: number;
  avgResponseTime: number;
  hotLeadsNotResponded: number;
  todayConversations: number;
  todayMessages: number;
  conversionRate: number;
}

export interface ActionSuggestion {
  id: string;
  type: "follow_up" | "send_proposal" | "escalate" | "close" | "tag";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  relatedContactId?: string;
  relatedConversationId?: string;
}

// Persona Types
export interface PersonaConfig {
  id: string;
  name: string;
  type: PersonaType;
  formalityLevel: number;
  persuasiveness: number;
  energyLevel: number;
  empathyLevel: number;
  customInstructions?: string;
  isActive: boolean;
  isDefault: boolean;
}

export type PersonaType =
  | "OWNER"
  | "SECRETARY"
  | "TECHNICAL"
  | "COMMERCIAL"
  | "AGGRESSIVE_SALES"
  | "CUSTOM";

// WebSocket Events
export interface WsNewMessage {
  conversationId: string;
  message: {
    id: string;
    content: string;
    type: string;
    direction: "INBOUND" | "OUTBOUND";
    createdAt: string;
    isAiGenerated: boolean;
  };
}

export interface WsClassification {
  conversationId: string;
  classification: MessageClassification;
  suggestedResponses?: string[];
}

export interface WsConversationUpdate {
  conversationId: string;
  updates: Partial<ConversationSummary>;
}
