import { z } from "zod";

// Auth Validators
export const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter no minimo 6 caracteres"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter no minimo 2 caracteres"),
  email: z.string().email("Email invalido"),
  password: z.string().min(8, "Senha deve ter no minimo 8 caracteres"),
  organizationName: z.string().min(2, "Nome da empresa obrigatorio"),
  phone: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// Contact Validators
export const createContactSchema = z.object({
  waId: z.string().min(10, "WhatsApp ID obrigatorio"),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  company: z.string().optional(),
  funnelId: z.string().optional(),
  funnelStageId: z.string().optional(),
});

export const updateContactSchema = createContactSchema.partial();

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// Conversation Validators
export const sendMessageSchema = z.object({
  content: z.string().min(1, "Mensagem obrigatoria"),
  type: z.enum(["TEXT", "IMAGE", "DOCUMENT", "AUDIO", "VIDEO"]).default("TEXT"),
  mediaUrl: z.string().url().optional(),
  caption: z.string().optional(),
});

export const updateConversationSchema = z.object({
  status: z.enum(["OPEN", "WAITING_CLIENT", "WAITING_AGENT", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  mode: z.enum(["AI_AUTO", "AI_ASSISTED", "HUMAN_ONLY"]).optional(),
  assignedToId: z.string().optional(),
  activePersonaId: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;

// Persona Validators
export const createPersonaSchema = z.object({
  name: z.string().min(2, "Nome obrigatorio"),
  type: z.enum(["OWNER", "SECRETARY", "TECHNICAL", "COMMERCIAL", "AGGRESSIVE_SALES", "CUSTOM"]),
  description: z.string().optional(),
  formalityLevel: z.number().min(0).max(100).default(50),
  persuasiveness: z.number().min(0).max(100).default(50),
  energyLevel: z.number().min(0).max(100).default(50),
  empathyLevel: z.number().min(0).max(100).default(50),
  customInstructions: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export const updatePersonaSchema = createPersonaSchema.partial();

export type CreatePersonaInput = z.infer<typeof createPersonaSchema>;
export type UpdatePersonaInput = z.infer<typeof updatePersonaSchema>;

// Trigger Validators
export const createTriggerSchema = z.object({
  name: z.string().min(2, "Nome obrigatorio"),
  description: z.string().optional(),
  triggerType: z.enum(["KEYWORD", "INTENT", "PRODUCT_MENTION", "URGENCY", "SENTIMENT", "SCHEDULE", "FUNNEL_STAGE"]),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(["equals", "contains", "starts_with", "ends_with", "greater_than", "less_than"]),
    value: z.union([z.string(), z.number(), z.boolean()]),
    caseSensitive: z.boolean().default(false),
  })),
  actions: z.array(z.object({
    type: z.enum(["send_message", "send_document", "add_tag", "change_funnel_stage", "notify_human", "set_priority"]),
    payload: z.record(z.unknown()),
  })),
  priority: z.number().default(0),
  isActive: z.boolean().default(true),
});

export type CreateTriggerInput = z.infer<typeof createTriggerSchema>;

// Knowledge Base Validators
export const createKnowledgeBaseSchema = z.object({
  name: z.string().min(2, "Nome obrigatorio"),
  description: z.string().optional(),
  type: z.enum(["GENERAL", "PRODUCTS", "SERVICES", "POLICIES", "OBJECTIONS", "SALES_ARGUMENTS"]),
});

export const createFaqSchema = z.object({
  question: z.string().min(5, "Pergunta obrigatoria"),
  answer: z.string().min(10, "Resposta obrigatoria"),
  category: z.string().optional(),
  priority: z.number().default(0),
});

export type CreateKnowledgeBaseInput = z.infer<typeof createKnowledgeBaseSchema>;
export type CreateFaqInput = z.infer<typeof createFaqSchema>;

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
