import { useEffect, useState, useRef, useCallback } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { YStack, XStack, Text, Input, Card, Spinner, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { api } from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";

const BUBBLE_IN_LIGHT = "#f1f5f9";
const BUBBLE_IN_DARK = "#1e293b";

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
  mode: "AI_AUTO" | "AI_ASSISTED" | "HUMAN_ONLY";
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
  const theme = useTheme();
  const { gradient, primary, primaryLight, bubbleOut } = useAppColors();

  const insets = useSafeAreaInsets();
  const isDark = theme.background.val === "#020617" || theme.background.val === "#000000" || theme.background.val?.startsWith("#0");

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

      setConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, response.data.data],
        };
      });

      setMessage("");
      setSuggestion(null);

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
      await api.post(`/conversations/${id}/override`, {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchConversation();
    } catch (error) {
      console.error("Error overriding Watson:", error);
    }
  };

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Spinner size="large" color={primary} />
        <Text marginTop="$4" color="$gray8">
          Carregando conversa...
        </Text>
      </YStack>
    );
  }

  if (!conversation) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Ionicons name="chatbubble-ellipses-outline" size={48} color="#71717a" />
        <Text marginTop="$4" color="$gray8">
          Conversa nao encontrada
        </Text>
        <Pressable onPress={() => router.back()}>
          <XStack
            marginTop="$4"
            paddingHorizontal="$4"
            paddingVertical="$2"
            backgroundColor={primary}
            borderRadius="$3"
          >
            <Text color="white" fontWeight="600">Voltar</Text>
          </XStack>
        </Pressable>
      </YStack>
    );
  }

  const contactName = conversation.contact.name || conversation.contact.pushName || conversation.contact.phone;
  const bubbleInColor = isDark ? BUBBLE_IN_DARK : BUBBLE_IN_LIGHT;

  // Group messages with date separators
  const messagesWithDates = buildMessagesWithDates(conversation.messages);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : insets.top + 56}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerBackTitle: "Voltar",
          headerStyle: { backgroundColor: theme.background.val },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <XStack alignItems="center" gap="$2">
                <Ionicons name="chevron-back" size={24} color={primary} />
                <YStack
                  width={36}
                  height={36}
                  borderRadius={18}
                  backgroundColor={primary}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text color="white" fontWeight="bold" fontSize="$3">
                    {contactName.charAt(0).toUpperCase()}
                  </Text>
                </YStack>
                <YStack>
                  <Text fontWeight="600" fontSize="$3" color="$color">
                    {contactName}
                  </Text>
                  <Text fontSize="$1" color="$gray8">
                    {conversation.contact.phone}
                  </Text>
                </YStack>
              </XStack>
            </Pressable>
          ),
          headerRight: () => (
            <XStack gap="$2" alignItems="center">
              {conversation.mode !== "HUMAN_ONLY" && (
                <Pressable onPress={overrideWatson}>
                  <XStack
                    backgroundColor="#eab308"
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius="$2"
                    alignItems="center"
                    gap={4}
                  >
                    <Ionicons name="person" size={12} color="white" />
                    <Text fontSize="$1" color="white" fontWeight="600">
                      Assumir
                    </Text>
                  </XStack>
                </Pressable>
              )}
              <ModeBadge mode={conversation.mode} primary={primary} />
            </XStack>
          ),
        }}
      />

      <YStack flex={1} backgroundColor="$background">
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messagesWithDates}
          renderItem={({ item }) => {
            if (item.type === "date") {
              return <DateSeparator date={item.label} />;
            }
            return <MessageBubble message={item.message} bubbleInColor={bubbleInColor} gradient={gradient} primary={primary} bubbleOut={bubbleOut} />;
          }}
          keyExtractor={(item, index) =>
            item.type === "date" ? `date-${index}` : item.message.id
          }
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8">
              <Ionicons name="chatbubbles-outline" size={48} color="#71717a" />
              <Text marginTop="$4" color="$gray8">
                Nenhuma mensagem ainda
              </Text>
            </YStack>
          }
        />

        {/* Watson Suggestion */}
        {suggestion && (
          <Card
            marginHorizontal="$3"
            marginBottom="$2"
            padding="$3"
            backgroundColor={isDark ? "#042f2e" : "#f0fdfa"}
            borderColor={primary}
            borderWidth={1}
            borderRadius="$3"
          >
            <XStack justifyContent="space-between" alignItems="flex-start">
              <YStack flex={1}>
                <XStack alignItems="center" gap="$2" marginBottom="$2">
                  <Ionicons name="sparkles" size={14} color={primary} />
                  <Text fontSize="$2" fontWeight="600" color={primary}>
                    Sugestao do Watson
                  </Text>
                </XStack>
                <Text fontSize="$3" color="$color">
                  {suggestion}
                </Text>
              </YStack>
              <XStack gap="$1">
                <Pressable onPress={useSuggestion}>
                  <YStack padding="$2">
                    <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                  </YStack>
                </Pressable>
                <Pressable onPress={() => setSuggestion(null)}>
                  <YStack padding="$2">
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </YStack>
                </Pressable>
              </XStack>
            </XStack>
          </Card>
        )}

        {/* Input Area */}
        <XStack
          paddingHorizontal="$3"
          paddingTop="$2"
          paddingBottom={Math.max(insets.bottom, 8)}
          gap="$2"
          backgroundColor="$background"
          borderTopWidth={1}
          borderTopColor="$borderColor"
          alignItems="flex-end"
        >
          <Pressable>
            <YStack
              width={40}
              height={40}
              borderRadius={20}
              backgroundColor={isDark ? "#1e293b" : "#f1f5f9"}
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="add" size={22} color={primary} />
            </YStack>
          </Pressable>

          <YStack
            flex={1}
            backgroundColor={isDark ? "#1e293b" : "#f1f5f9"}
            borderRadius={20}
            paddingHorizontal="$3"
            paddingVertical={Platform.OS === "ios" ? 8 : 4}
            minHeight={40}
            justifyContent="center"
          >
            <Input
              unstyled
              placeholder="Mensagem..."
              placeholderTextColor="#94a3b8"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              fontSize={15}
              color="$color"
              style={{ maxHeight: 100 }}
            />
          </YStack>

          <Pressable onPress={sendMessage} disabled={isSending || !message.trim()}>
            {message.trim() ? (
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isSending ? 0.5 : 1,
                }}
              >
                {isSending ? (
                  <Spinner size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={18} color="white" />
                )}
              </LinearGradient>
            ) : (
              <YStack
                width={40}
                height={40}
                borderRadius={20}
                backgroundColor={isDark ? "#1e293b" : "#f1f5f9"}
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons name="send" size={18} color="#94a3b8" />
              </YStack>
            )}
          </Pressable>
        </XStack>
      </YStack>
    </KeyboardAvoidingView>
  );
}

// -- Date Separator --
function DateSeparator({ date }: { date: string }) {
  return (
    <XStack justifyContent="center" paddingVertical="$3">
      <YStack
        backgroundColor="$backgroundStrong"
        paddingHorizontal="$3"
        paddingVertical="$1"
        borderRadius="$4"
      >
        <Text fontSize="$1" color="$gray8" fontWeight="500">
          {date}
        </Text>
      </YStack>
    </XStack>
  );
}

// -- Message Bubble --
function MessageBubble({
  message,
  bubbleInColor,
  gradient,
  primary,
  bubbleOut,
}: {
  message: Message;
  bubbleInColor: string;
  gradient: string[];
  primary: string;
  bubbleOut: string;
}) {
  const isOut = message.direction === "OUTBOUND";

  const bubbleContent = (
    <>
      {/* AI badge */}
      {message.isAiGenerated && (
        <XStack alignItems="center" gap={4} marginBottom={2}>
          <Ionicons name="sparkles" size={10} color={isOut ? "#99f6e4" : primary} />
          <Text fontSize={10} color={isOut ? "#99f6e4" : primary} fontWeight="600">
            Watson IA
          </Text>
        </XStack>
      )}

      {/* Content */}
      <Text
        color={isOut ? "white" : "$color"}
        fontSize={15}
        lineHeight={20}
      >
        {message.content}
      </Text>

      {/* Time + Status */}
      <XStack justifyContent="flex-end" alignItems="center" gap={4} marginTop={4}>
        <Text fontSize={11} color={isOut ? "rgba(255,255,255,0.6)" : "$gray8"}>
          {formatTime(message.createdAt)}
        </Text>
        {isOut && <StatusIcon status={message.status} />}
      </XStack>
    </>
  );

  return (
    <XStack
      justifyContent={isOut ? "flex-end" : "flex-start"}
      paddingVertical={3}
      paddingLeft={isOut ? 48 : 0}
      paddingRight={isOut ? 0 : 48}
    >
      {isOut ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 18,
            borderBottomRightRadius: 4,
            borderBottomLeftRadius: 18,
            maxWidth: "100%",
          }}
        >
          {bubbleContent}
        </LinearGradient>
      ) : (
        <YStack
          backgroundColor={bubbleInColor}
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderRadius={18}
          borderBottomRightRadius={18}
          borderBottomLeftRadius={4}
          maxWidth="100%"
        >
          {bubbleContent}
        </YStack>
      )}
    </XStack>
  );
}

// -- Status Icon --
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "PENDING":
      return <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.5)" />;
    case "SENT":
      return <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.5)" />;
    case "DELIVERED":
      return <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.5)" />;
    case "READ":
      return <Ionicons name="checkmark-done" size={12} color="#99f6e4" />;
    case "FAILED":
      return <Ionicons name="alert-circle" size={12} color="#fca5a5" />;
    default:
      return null;
  }
}

// -- Mode Badge --
function ModeBadge({ mode, primary }: { mode: string; primary: string }) {
  const config: Record<string, { label: string; bg: string }> = {
    AI_ASSISTED: { label: "IA", bg: primary },
    HUMAN_ONLY: { label: "Humano", bg: "#eab308" },
    AI_AUTO: { label: "Auto", bg: "#22c55e" },
  };
  const { label, bg } = config[mode] || { label: mode, bg: "#64748b" };

  return (
    <YStack backgroundColor={bg} paddingHorizontal="$2" paddingVertical="$1" borderRadius={10}>
      <Text fontSize={11} color="white" fontWeight="600">
        {label}
      </Text>
    </YStack>
  );
}

// -- Helpers --
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diff = today.getTime() - msgDate.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";

  const weekDays = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
  if (days < 7) return weekDays[date.getDay()];

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type ListItem =
  | { type: "date"; label: string }
  | { type: "message"; message: Message };

function buildMessagesWithDates(messages: Message[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDateLabel = "";

  for (const msg of messages) {
    const dateLabel = formatDateLabel(msg.createdAt);
    if (dateLabel !== lastDateLabel) {
      items.push({ type: "date", label: dateLabel });
      lastDateLabel = dateLabel;
    }
    items.push({ type: "message", message: msg });
  }

  return items;
}
