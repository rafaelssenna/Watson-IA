import { create } from "zustand";
import { api } from "@/services/api";

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
}

export interface UpdatePersonaData extends Partial<CreatePersonaData> {}

interface PersonaState {
  personas: Persona[];
  selectedPersona: Persona | null;
  isLoading: boolean;
  error: string | null;
}

interface PersonaActions {
  fetchPersonas: () => Promise<void>;
  fetchPersona: (id: string) => Promise<Persona | null>;
  createPersona: (data: CreatePersonaData) => Promise<Persona>;
  updatePersona: (id: string, data: UpdatePersonaData) => Promise<Persona>;
  deletePersona: (id: string) => Promise<void>;
  setSelectedPersona: (persona: Persona | null) => void;
  clearError: () => void;
}

export const usePersonaStore = create<PersonaState & PersonaActions>((set, get) => ({
  // State
  personas: [],
  selectedPersona: null,
  isLoading: false,
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
}));
