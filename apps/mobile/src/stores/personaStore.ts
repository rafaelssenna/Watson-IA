import { create } from "zustand";
import { api } from "@/services/api";

export interface PersonaKnowledgeFile {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}

export interface Persona {
  id: string;
  name: string;
  type: string;
  systemPrompt: string | null;
  formalityLevel: number;
  persuasiveness: number;
  energyLevel: number;
  empathyLevel: number;
  customInstructions: string | null;
  isDefault: boolean;
  isActive: boolean;
  // New fields
  businessName: string | null;
  greetingMessage: string | null;
  prohibitedTopics: string | null;
  responseLength: "CURTA" | "MEDIA" | "LONGA";
  businessHoursStart: string | null;
  businessHoursEnd: string | null;
  workDays: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaData {
  name: string;
  type?: string;
  systemPrompt?: string;
  formalityLevel?: number;
  persuasiveness?: number;
  energyLevel?: number;
  empathyLevel?: number;
  customInstructions?: string;
  isDefault?: boolean;
  // New fields
  businessName?: string;
  greetingMessage?: string;
  greetingEnabled?: boolean;
  prohibitedTopics?: string;
  responseLength?: "CURTA" | "MEDIA" | "LONGA";
  businessHoursStart?: string;
  businessHoursEnd?: string;
  workDays?: string[];
  triggerEnabled?: boolean;
  triggerMessage?: string;
}

export interface UpdatePersonaData extends Partial<CreatePersonaData> {}

interface PersonaState {
  personas: Persona[];
  selectedPersona: Persona | null;
  knowledgeFiles: PersonaKnowledgeFile[];
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
}

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

interface PersonaActions {
  fetchPersonas: () => Promise<void>;
  fetchPersona: (id: string) => Promise<Persona | null>;
  fetchDefaultPersona: () => Promise<Persona | null>;
  createPersona: (data: CreatePersonaData) => Promise<Persona>;
  updatePersona: (id: string, data: UpdatePersonaData) => Promise<Persona>;
  deletePersona: (id: string) => Promise<void>;
  setSelectedPersona: (persona: Persona | null) => void;
  clearError: () => void;
  // File management
  fetchKnowledgeFiles: (personaId: string) => Promise<void>;
  uploadKnowledgeFile: (personaId: string, file: { uri: string; name: string; mimeType: string }) => Promise<void>;
  deleteKnowledgeFile: (personaId: string, fileId: string) => Promise<void>;
  // AI generation
  generateFromDescription: (description: string, name?: string, businessName?: string) => Promise<GeneratedPersonaConfig>;
  generateFromAudio: (audioUri: string, name?: string, businessName?: string) => Promise<GeneratedPersonaConfig>;
}

export const usePersonaStore = create<PersonaState & PersonaActions>((set, get) => ({
  // State
  personas: [],
  selectedPersona: null,
  knowledgeFiles: [],
  isLoading: false,
  isUploading: false,
  error: null,

  // Actions
  fetchPersonas: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ success: boolean; data: Persona[] }>("/personas");
      if (response.data.success) {
        set({ personas: response.data.data, isLoading: false });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || "Erro ao carregar personas",
      });
    }
  },

  fetchPersona: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ success: boolean; data: Persona }>(`/personas/${id}`);
      if (response.data.success) {
        set({ selectedPersona: response.data.data, isLoading: false });
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || "Erro ao carregar persona",
      });
      return null;
    }
  },

  createPersona: async (data: CreatePersonaData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ success: boolean; data: Persona }>("/personas", data);
      if (response.data.success) {
        const newPersona = response.data.data;
        // Refetch all personas to get updated isDefault states
        const listResponse = await api.get<{ success: boolean; data: Persona[] }>("/personas");
        if (listResponse.data.success) {
          set({ personas: listResponse.data.data, isLoading: false });
        } else {
          set((state) => ({
            personas: [...state.personas, newPersona],
            isLoading: false,
          }));
        }
        return newPersona;
      }
      throw new Error("Erro ao criar persona");
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || "Erro ao criar persona",
      });
      throw error;
    }
  },

  updatePersona: async (id: string, data: UpdatePersonaData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch<{ success: boolean; data: Persona }>(`/personas/${id}`, data);
      if (response.data.success) {
        const updatedPersona = response.data.data;
        // Refetch all personas to get updated isDefault states
        const listResponse = await api.get<{ success: boolean; data: Persona[] }>("/personas");
        if (listResponse.data.success) {
          set({
            personas: listResponse.data.data,
            selectedPersona: updatedPersona,
            isLoading: false,
          });
        } else {
          set((state) => ({
            personas: state.personas.map((p) => (p.id === id ? updatedPersona : p)),
            selectedPersona: updatedPersona,
            isLoading: false,
          }));
        }
        return updatedPersona;
      }
      throw new Error("Erro ao atualizar persona");
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || "Erro ao atualizar persona",
      });
      throw error;
    }
  },

  deletePersona: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/personas/${id}`);
      set((state) => ({
        personas: state.personas.filter((p) => p.id !== id),
        selectedPersona: state.selectedPersona?.id === id ? null : state.selectedPersona,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || "Erro ao deletar persona",
      });
      throw error;
    }
  },

  setSelectedPersona: (persona: Persona | null) => {
    set({ selectedPersona: persona });
  },

  clearError: () => {
    set({ error: null });
  },

  fetchDefaultPersona: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ success: boolean; data: Persona[] }>("/personas");
      if (response.data.success && response.data.data.length > 0) {
        // Find default persona or use first one
        const defaultPersona = response.data.data.find((p) => p.isDefault) || response.data.data[0];
        set({ personas: response.data.data, selectedPersona: defaultPersona, isLoading: false });
        return defaultPersona;
      }
      set({ isLoading: false });
      return null;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || "Erro ao carregar persona",
      });
      return null;
    }
  },

  fetchKnowledgeFiles: async (personaId: string) => {
    try {
      const response = await api.get<{ success: boolean; data: PersonaKnowledgeFile[] }>(`/personas/${personaId}/files`);
      if (response.data.success) {
        set({ knowledgeFiles: response.data.data });
      }
    } catch (error: any) {
      console.error("Error fetching knowledge files:", error);
    }
  },

  uploadKnowledgeFile: async (personaId: string, file: { uri: string; name: string; mimeType: string }) => {
    set({ isUploading: true, error: null });
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      } as any);

      // Don't manually set Content-Type - let fetch set it automatically with the correct boundary
      const response = await api.post(`/personas/${personaId}/files`, formData);

      if (response.data.success) {
        // Refetch files
        await get().fetchKnowledgeFiles(personaId);
      }
      set({ isUploading: false });
    } catch (error: any) {
      set({
        isUploading: false,
        error: error.response?.data?.error?.message || "Erro ao fazer upload",
      });
      throw error;
    }
  },

  deleteKnowledgeFile: async (personaId: string, fileId: string) => {
    try {
      await api.delete(`/personas/${personaId}/files/${fileId}`);
      set((state) => ({
        knowledgeFiles: state.knowledgeFiles.filter((f) => f.id !== fileId),
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || "Erro ao deletar arquivo",
      });
      throw error;
    }
  },

  generateFromDescription: async (description: string, name?: string, businessName?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ success: boolean; data: GeneratedPersonaConfig }>("/personas/generate", { description, name, businessName });
      set({ isLoading: false });
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error("Erro ao gerar configuracao");
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || "Erro ao gerar configuracao com IA",
      });
      throw error;
    }
  },

  generateFromAudio: async (audioUri: string, name?: string, businessName?: string) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      // Fields MUST come before file for Fastify multipart to parse them
      if (name) formData.append("name", name);
      if (businessName) formData.append("businessName", businessName);
      formData.append("file", {
        uri: audioUri,
        name: "audio.m4a",
        type: "audio/m4a",
      } as any);

      const response = await api.post<{ success: boolean; data: GeneratedPersonaConfig }>("/personas/generate-from-audio", formData);
      set({ isLoading: false });
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error("Erro ao gerar configuracao a partir do audio");
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || "Erro ao processar audio com IA",
      });
      throw error;
    }
  },
}));
