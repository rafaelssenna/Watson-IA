import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { api } from "@/services/api";
import { useAuthStore } from "./authStore";

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:3000";

interface Message {
  id: string;
  content: string;
  type: "TEXT" | "IMAGE" | "AUDIO" | "DOCUMENT";
  direction: "INBOUND" | "OUTBOUND";
  status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  isAiGenerated: boolean;
  createdAt: string;
  mediaUrl?: string;
}

interface Contact {
  id: string;
  name?: string;
  pushName?: string;
  phone: string;
  profilePicUrl?: string;
  leadScore: number;
}

interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  lastMessage: string;
  lastMessageAt: string;
  status: string;
  intent?: string;
  urgency: string;
  leadScore: number;
  messageCount: number;
  mode: "AI_ASSISTED" | "HUMAN_ONLY" | "AI_ONLY";
  sentiment?: string;
}

interface ConversationDetail {
  id: string;
  contact: Contact;
  messages: Message[];
  status: string;
  mode: "AI_ASSISTED" | "HUMAN_ONLY" | "AI_ONLY";
  intent?: string;
  urgency: string;
  sentiment?: string;
}

interface ConversationStore {
  // State
  conversations: Conversation[];
  currentConversation: ConversationDetail | null;
  isLoading: boolean;
  isConnected: boolean;
  socket: Socket | null;

  // Actions
  fetchConversations: () => Promise<void>;
  fetchConversation: (id: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, type?: string) => Promise<Message | null>;
  overrideWatson: (conversationId: string) => Promise<void>;

  // Socket
  connectSocket: () => void;
  disconnectSocket: () => void;

  // Local updates
  addMessage: (conversationId: string, message: Message) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  conversations: [],
  currentConversation: null,
  isLoading: false,
  isConnected: false,
  socket: null,

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get<{
        success: boolean;
        data: Conversation[];
      }>("/conversations");
      set({ conversations: response.data.data });
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchConversation: async (id: string) => {
    set({ isLoading: true });
    try {
      const response = await api.get<{
        success: boolean;
        data: ConversationDetail;
      }>(`/conversations/${id}`);
      set({ currentConversation: response.data.data });
    } catch (error) {
      console.error("Error fetching conversation:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  sendMessage: async (conversationId: string, content: string, type = "TEXT") => {
    try {
      const response = await api.post<{
        success: boolean;
        data: Message;
      }>(`/conversations/${conversationId}/messages`, {
        type,
        content,
      });

      const message = response.data.data;

      // Update current conversation locally
      const { currentConversation } = get();
      if (currentConversation && currentConversation.id === conversationId) {
        set({
          currentConversation: {
            ...currentConversation,
            messages: [...currentConversation.messages, message],
          },
        });
      }

      // Update conversations list
      get().updateConversation(conversationId, {
        lastMessage: content,
        lastMessageAt: new Date().toISOString(),
        messageCount: (get().conversations.find(c => c.id === conversationId)?.messageCount || 0) + 1,
      });

      return message;
    } catch (error) {
      console.error("Error sending message:", error);
      return null;
    }
  },

  overrideWatson: async (conversationId: string) => {
    try {
      await api.post(`/conversations/${conversationId}/override`);

      // Update local state
      const { currentConversation } = get();
      if (currentConversation && currentConversation.id === conversationId) {
        set({
          currentConversation: {
            ...currentConversation,
            mode: "HUMAN_ONLY",
          },
        });
      }

      get().updateConversation(conversationId, { mode: "HUMAN_ONLY" });
    } catch (error) {
      console.error("Error overriding Watson:", error);
    }
  },

  connectSocket: () => {
    const { socket } = get();
    if (socket?.connected) return;

    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected");
      set({ isConnected: true });

      // Join organization room
      const user = useAuthStore.getState().user;
      if (user?.organizationId) {
        newSocket.emit("join:org", { orgId: user.organizationId });
      }
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      set({ isConnected: false });
    });

    newSocket.on("message:new", (data: { conversationId: string; message: Message }) => {
      console.log("New message received:", data);
      get().addMessage(data.conversationId, data.message);
    });

    newSocket.on("conversation:update", (data: { conversationId: string; updates: Partial<Conversation> }) => {
      console.log("Conversation updated:", data);
      get().updateConversation(data.conversationId, data.updates);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    set({ socket: newSocket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  addMessage: (conversationId: string, message: Message) => {
    const { currentConversation, conversations } = get();

    // Update current conversation if it's the active one
    if (currentConversation && currentConversation.id === conversationId) {
      // Avoid duplicates
      const exists = currentConversation.messages.some(m => m.id === message.id);
      if (!exists) {
        set({
          currentConversation: {
            ...currentConversation,
            messages: [...currentConversation.messages, message],
          },
        });
      }
    }

    // Update conversations list
    const updatedConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        return {
          ...conv,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
          messageCount: conv.messageCount + 1,
        };
      }
      return conv;
    });

    // Move updated conversation to top
    const index = updatedConversations.findIndex(c => c.id === conversationId);
    if (index > 0) {
      const [conv] = updatedConversations.splice(index, 1);
      updatedConversations.unshift(conv);
    }

    set({ conversations: updatedConversations });
  },

  updateConversation: (conversationId: string, updates: Partial<Conversation>) => {
    const { conversations, currentConversation } = get();

    // Update conversations list
    const updatedConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        return { ...conv, ...updates };
      }
      return conv;
    });
    set({ conversations: updatedConversations });

    // Update current conversation if it's the active one
    if (currentConversation && currentConversation.id === conversationId) {
      set({
        currentConversation: {
          ...currentConversation,
          ...updates,
        } as ConversationDetail,
      });
    }
  },
}));
