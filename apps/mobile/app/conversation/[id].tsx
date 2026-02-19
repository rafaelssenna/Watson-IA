import { useEffect, useState, useRef, useCallback } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { YStack, XStack, Text, Input, Card, Button, Spinner } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api } from "@/services/api";

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
  contact: Contact;
  messages: Message[];
  status: string;
  mode: "AI_ASSISTED" | "HUMAN_ONLY" | "AI_ONLY";
  intent?: string;
  urgency: string;
  sentiment?: string;
}

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchConversation = useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: Conversation;
      }>(`/conversations/${id}`);
      setConversation(response.data.data);
    } catch (error) {
      console.error("Error fetching conversation:", error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  const sendMessage = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await api.post<{
        success: boolean;
        data: Message;
      }>(`/conversations/${id}/messages`, {
        type: "TEXT",
        content: message.trim(),
      });

      // Add message to local state
      setConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, response.data.data],
        };
      });

      setMessage("");
      setSuggestion(null);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Error sending message:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSending(false);
    }
  };

  const useSuggestion = () => {
    if (suggestion) {
      setMessage(suggestion);
      setSuggestion(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const overrideWatson = async () => {
    try {
      await api.post(`/conversations/${id}/override`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchConversation();
    } catch (error) {
      console.error("Error overriding Watson:", error);
    }
  };

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Spinner size="large" color="$blue10" />
        <Text marginTop="$4" color="$colorSubtle">
          Carregando conversa...
        </Text>
      </YStack>
    );
  }

  if (!conversation) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Text fontSize={48}>😕</Text>
        <Text marginTop="$4" color="$colorSubtle">
          Conversa nao encontrada
        </Text>
        <Button marginTop="$4" onPress={() => router.back()}>
          Voltar
        </Button>
      </YStack>
    );
  }

  const contactName = conversation.contact.name || conversation.contact.pushName || conversation.contact.phone;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: contactName,
          headerBackTitle: "Voltar",
          headerRight: () => (
            <XStack gap="$2">
              {conversation.mode === "AI_ASSISTED" && (
                <Pressable onPress={overrideWatson}>
                  <XStack
                    backgroundColor="$yellow10"
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius="$2"
                  >
                    <Text fontSize="$1" color="white" fontWeight="500">
                      Override
                    </Text>
                  </XStack>
                </Pressable>
              )}
              <StatusBadge mode={conversation.mode} />
            </XStack>
          ),
        }}
      />

      <YStack flex={1} backgroundColor="$background">
        {/* Contact Info Bar */}
        <XStack
          padding="$3"
          backgroundColor="$backgroundHover"
          alignItems="center"
          gap="$3"
          borderBottomWidth={1}
          borderBottomColor="$borderColor"
        >
          <YStack
            width={40}
            height={40}
            borderRadius={20}
            backgroundColor="$blue10"
            alignItems="center"
            justifyContent="center"
          >
            <Text color="white" fontWeight="bold">
              {contactName.charAt(0).toUpperCase()}
            </Text>
          </YStack>
          <YStack flex={1}>
            <Text fontWeight="600">{contactName}</Text>
            <XStack gap="$2" alignItems="center">
              <Text fontSize="$2" color="$colorSubtle">
                {conversation.contact.phone}
              </Text>
              {conversation.intent && (
                <Badge label={conversation.intent} color="$green10" />
              )}
              {(conversation.urgency === "HIGH" || conversation.urgency === "CRITICAL") && (
                <Badge
                  label={conversation.urgency === "CRITICAL" ? "Critico" : "Urgente"}
                  color={conversation.urgency === "CRITICAL" ? "$red10" : "$yellow10"}
                />
              )}
            </XStack>
          </YStack>
          <YStack alignItems="center">
            <Text fontSize="$1" color="$colorSubtle">
              Score
            </Text>
            <Text
              fontWeight="bold"
              color={
                conversation.contact.leadScore >= 70
                  ? "$green10"
                  : conversation.contact.leadScore >= 40
                  ? "$yellow10"
                  : "$colorSubtle"
              }
            >
              {conversation.contact.leadScore}
            </Text>
          </YStack>
        </XStack>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={conversation.messages}
          renderItem={({ item }) => <MessageBubble message={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8">
              <Text fontSize={48}>💬</Text>
              <Text marginTop="$4" color="$colorSubtle">
                Nenhuma mensagem ainda
              </Text>
            </YStack>
          }
        />

        {/* Watson Suggestion */}
        {suggestion && (
          <Card margin="$3" padding="$3" backgroundColor="$blue2" borderColor="$blue6" bordered>
            <XStack justifyContent="space-between" alignItems="flex-start">
              <YStack flex={1}>
                <XStack alignItems="center" gap="$2" marginBottom="$2">
                  <Ionicons name="sparkles" size={16} color="#2563EB" />
                  <Text fontSize="$2" fontWeight="600" color="$blue10">
                    Sugestao do Watson
                  </Text>
                </XStack>
                <Text fontSize="$3" color="$color">
                  {suggestion}
                </Text>
              </YStack>
              <XStack gap="$2">
                <Pressable onPress={useSuggestion}>
                  <YStack padding="$2">
                    <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                  </YStack>
                </Pressable>
                <Pressable onPress={() => setSuggestion(null)}>
                  <YStack padding="$2">
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </YStack>
                </Pressable>
              </XStack>
            </XStack>
          </Card>
        )}

        {/* Input Area */}
        <XStack
          padding="$3"
          gap="$2"
          backgroundColor="$background"
          borderTopWidth={1}
          borderTopColor="$borderColor"
        >
          <Pressable>
            <YStack
              width={44}
              height={44}
              borderRadius={22}
              backgroundColor="$backgroundHover"
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="add" size={24} color="#666" />
            </YStack>
          </Pressable>

          <Input
            flex={1}
            placeholder="Digite sua mensagem..."
            value={message}
            onChangeText={setMessage}
            size="$4"
            borderRadius="$6"
            multiline
            maxLength={1000}
          />

          <Pressable onPress={sendMessage} disabled={isSending || !message.trim()}>
            <YStack
              width={44}
              height={44}
              borderRadius={22}
              backgroundColor={message.trim() ? "$blue10" : "$backgroundHover"}
              alignItems="center"
              justifyContent="center"
              opacity={isSending ? 0.5 : 1}
            >
              {isSending ? (
                <Spinner size="small" color="white" />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={message.trim() ? "white" : "#666"}
                />
              )}
            </YStack>
          </Pressable>
        </XStack>
      </YStack>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === "OUTBOUND";

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusIcon = () => {
    switch (message.status) {
      case "PENDING":
        return <Ionicons name="time-outline" size={12} color="#999" />;
      case "SENT":
        return <Ionicons name="checkmark" size={12} color="#999" />;
      case "DELIVERED":
        return <Ionicons name="checkmark-done" size={12} color="#999" />;
      case "READ":
        return <Ionicons name="checkmark-done" size={12} color="#2563EB" />;
      case "FAILED":
        return <Ionicons name="alert-circle" size={12} color="#EF4444" />;
      default:
        return null;
    }
  };

  return (
    <XStack justifyContent={isOutbound ? "flex-end" : "flex-start"}>
      <YStack
        maxWidth="80%"
        backgroundColor={isOutbound ? "$blue10" : "$backgroundHover"}
        padding="$3"
        borderRadius="$4"
        borderBottomRightRadius={isOutbound ? "$1" : "$4"}
        borderBottomLeftRadius={isOutbound ? "$4" : "$1"}
      >
        {message.isAiGenerated && (
          <XStack alignItems="center" gap="$1" marginBottom="$1">
            <Ionicons name="sparkles" size={10} color={isOutbound ? "#93C5FD" : "#2563EB"} />
            <Text fontSize="$1" color={isOutbound ? "#93C5FD" : "$blue10"}>
              Watson AI
            </Text>
          </XStack>
        )}

        <Text color={isOutbound ? "white" : "$color"}>{message.content}</Text>

        <XStack justifyContent="flex-end" alignItems="center" gap="$1" marginTop="$1">
          <Text fontSize="$1" color={isOutbound ? "#93C5FD" : "$colorSubtle"}>
            {formatTime(message.createdAt)}
          </Text>
          {isOutbound && statusIcon()}
        </XStack>
      </YStack>
    </XStack>
  );
}

function StatusBadge({ mode }: { mode: string }) {
  const config = {
    AI_ASSISTED: { label: "IA", color: "$blue10" },
    HUMAN_ONLY: { label: "Humano", color: "$yellow10" },
    AI_ONLY: { label: "Auto", color: "$green10" },
  };

  const { label, color } = config[mode as keyof typeof config] || { label: mode, color: "$gray10" };

  return (
    <YStack backgroundColor={color} paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
      <Text fontSize="$1" color="white" fontWeight="500">
        {label}
      </Text>
    </YStack>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <YStack backgroundColor={color} paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
      <Text fontSize="$1" color="white" fontWeight="500">
        {label}
      </Text>
    </YStack>
  );
}
