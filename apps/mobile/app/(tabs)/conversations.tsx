import { useEffect, useState, useCallback } from "react";
import { FlatList, RefreshControl, Pressable } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Input, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

const WATSON_TEAL = "#0d9488";

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
}

type Filter = "all" | "urgent" | "purchase";

export default function ConversationsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const theme = useTheme();
  const isDark = theme.background.val === "#020617" || theme.background.val === "#000000" || theme.background.val?.startsWith("#0");

  const fetchConversations = async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: Conversation[];
      }>("/conversations");
      setConversations(response.data.data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchConversations();
  }, []);

  const urgentCount = conversations.filter(c => c.urgency === "HIGH" || c.urgency === "CRITICAL").length;
  const purchaseCount = conversations.filter(c => c.intent === "purchase").length;

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      !search ||
      conv.contactName?.toLowerCase().includes(search.toLowerCase()) ||
      conv.contactPhone?.includes(search) ||
      conv.lastMessage?.toLowerCase().includes(search.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      (filter === "urgent" && (conv.urgency === "HIGH" || conv.urgency === "CRITICAL")) ||
      (filter === "purchase" && conv.intent === "purchase");

    return matchesSearch && matchesFilter;
  });

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Text color="$gray8">Carregando...</Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Search */}
      <YStack paddingHorizontal="$4" paddingTop="$3" paddingBottom="$2">
        <XStack
          backgroundColor={isDark ? "#1e293b" : "#f1f5f9"}
          borderRadius={12}
          paddingHorizontal="$3"
          alignItems="center"
          gap="$2"
        >
          <Ionicons name="search" size={18} color="#94a3b8" />
          <Input
            unstyled
            flex={1}
            placeholder="Buscar conversas..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            fontSize={15}
            color="$color"
            paddingVertical={10}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </Pressable>
          )}
        </XStack>
      </YStack>

      {/* Filter chips */}
      <XStack paddingHorizontal="$4" gap="$2" marginBottom="$2">
        <FilterChip
          label="Todos"
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <FilterChip
          label="Urgentes"
          count={urgentCount}
          active={filter === "urgent"}
          onPress={() => setFilter("urgent")}
        />
        <FilterChip
          label="Compra"
          count={purchaseCount}
          active={filter === "purchase"}
          onPress={() => setFilter("purchase")}
        />
      </XStack>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            onPress={() => router.push(`/conversation/${item.id}`)}
            isDark={isDark}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ItemSeparatorComponent={() => (
          <YStack height={1} backgroundColor="$borderColor" marginLeft={76} />
        )}
        ListEmptyComponent={
          <YStack alignItems="center" padding="$8">
            <Ionicons name="chatbubbles-outline" size={48} color="#71717a" />
            <Text marginTop="$4" color="$gray8">
              Nenhuma conversa encontrada
            </Text>
          </YStack>
        }
      />
    </YStack>
  );
}

function ConversationRow({
  conversation,
  onPress,
  isDark,
}: {
  conversation: Conversation;
  onPress: () => void;
  isDark: boolean;
}) {
  const isUrgent = conversation.urgency === "HIGH" || conversation.urgency === "CRITICAL";
  const isPurchase = conversation.intent === "purchase";

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      style={({ pressed }) => ({
        backgroundColor: pressed ? (isDark ? "#1e293b" : "#f8fafc") : "transparent",
      })}
    >
      <XStack paddingHorizontal="$4" paddingVertical="$3" gap="$3" alignItems="center">
        {/* Avatar */}
        <YStack position="relative">
          <YStack
            width={50}
            height={50}
            borderRadius={25}
            backgroundColor={WATSON_TEAL}
            alignItems="center"
            justifyContent="center"
          >
            <Text color="white" fontSize="$5" fontWeight="bold">
              {conversation.contactName?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </YStack>
          {isUrgent && (
            <YStack
              position="absolute"
              bottom={-1}
              right={-1}
              width={14}
              height={14}
              borderRadius={7}
              backgroundColor={conversation.urgency === "CRITICAL" ? "#ef4444" : "#eab308"}
              borderWidth={2}
              borderColor="$background"
            />
          )}
        </YStack>

        {/* Content */}
        <YStack flex={1} gap={2}>
          <XStack justifyContent="space-between" alignItems="center">
            <XStack flex={1} alignItems="center" gap="$2">
              <Text fontWeight="600" fontSize={16} numberOfLines={1} color="$color">
                {conversation.contactName || conversation.contactPhone}
              </Text>
              {isPurchase && (
                <Ionicons name="cart" size={14} color="#22c55e" />
              )}
            </XStack>
            <Text fontSize={12} color="$gray8">
              {formatTime(conversation.lastMessageAt)}
            </Text>
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <Text
              color="$gray8"
              fontSize={14}
              numberOfLines={1}
              flex={1}
              marginRight="$2"
            >
              {conversation.lastMessage || "Sem mensagens"}
            </Text>
            {conversation.messageCount > 0 && (
              <YStack
                backgroundColor={WATSON_TEAL}
                width={20}
                height={20}
                borderRadius={10}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={10} color="white" fontWeight="bold">
                  {conversation.messageCount > 99 ? "99" : conversation.messageCount}
                </Text>
              </YStack>
            )}
          </XStack>
        </YStack>
      </XStack>
    </Pressable>
  );
}

function FilterChip({
  label,
  count,
  active = false,
  onPress,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderRadius={20}
        backgroundColor={active ? WATSON_TEAL : "$backgroundStrong"}
        alignItems="center"
        gap="$1"
      >
        <Text
          fontSize="$2"
          color={active ? "white" : "$color"}
          fontWeight={active ? "600" : "400"}
        >
          {label}
        </Text>
        {count !== undefined && count > 0 && (
          <YStack
            backgroundColor={active ? "white" : WATSON_TEAL}
            paddingHorizontal={6}
            borderRadius={8}
            minWidth={18}
            alignItems="center"
          >
            <Text fontSize={10} color={active ? WATSON_TEAL : "white"} fontWeight="bold">
              {count}
            </Text>
          </YStack>
        )}
      </XStack>
    </Pressable>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return "Agora";
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Ontem";
  if (days < 7) {
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
    return weekDays[date.getDay()];
  }

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
