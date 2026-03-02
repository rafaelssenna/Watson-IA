import { useEffect, useState, useCallback, useMemo } from "react";
import { FlatList, RefreshControl, Pressable, Image } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Input, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";

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
  unreadCount: number;
  mode: string;
  closingProbability?: number;
  sentiment?: string;
}

type Filter = "all" | "urgent" | "purchase";

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#eab308", "#84cc16", "#22c55e", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#2563eb",
];

function avatarColor(contactId: string): string {
  let hash = 0;
  for (let i = 0; i < contactId.length; i++) {
    hash = contactId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ConversationsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const theme = useTheme();
  const { primary } = useAppColors();
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

  // Group conversations by contactId — keep only the most recent, sum unreadCount
  const grouped = useMemo(() => {
    const map = new Map<string, Conversation>();
    // conversations are already sorted by lastMessageAt desc from API
    for (const conv of conversations) {
      const existing = map.get(conv.contactId);
      if (!existing) {
        map.set(conv.contactId, { ...conv });
      } else {
        // Sum unread counts from all conversations of same contact
        existing.unreadCount = (existing.unreadCount || 0) + (conv.unreadCount || 0);
      }
    }
    return Array.from(map.values());
  }, [conversations]);

  const urgentCount = grouped.filter(c => c.urgency === "HIGH" || c.urgency === "CRITICAL").length;
  const purchaseCount = grouped.filter(c => c.intent === "purchase").length;

  const filteredConversations = grouped.filter((conv) => {
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
          primary={primary}
        />
        <FilterChip
          label="Urgentes"
          count={urgentCount}
          active={filter === "urgent"}
          onPress={() => setFilter("urgent")}
          primary={primary}
        />
        <FilterChip
          label="Compra"
          count={purchaseCount}
          active={filter === "purchase"}
          onPress={() => setFilter("purchase")}
          primary={primary}
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
            primary={primary}
          />
        )}
        keyExtractor={(item) => item.contactId}
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
  primary,
}: {
  conversation: Conversation;
  onPress: () => void;
  isDark: boolean;
  primary: string;
}) {
  const isUrgent = conversation.urgency === "HIGH" || conversation.urgency === "CRITICAL";
  const hasUnread = (conversation.unreadCount || 0) > 0;
  const isAI = conversation.mode === "AI_AUTO" || conversation.mode === "AI_ASSISTED";
  const bgColor = avatarColor(conversation.contactId);

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
          {conversation.contactAvatar ? (
            <Image
              source={{ uri: conversation.contactAvatar }}
              style={{ width: 50, height: 50, borderRadius: 25 }}
            />
          ) : (
            <YStack
              width={50}
              height={50}
              borderRadius={25}
              backgroundColor={bgColor}
              alignItems="center"
              justifyContent="center"
            >
              <Text color="white" fontSize="$5" fontWeight="bold">
                {conversation.contactName?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </YStack>
          )}
          {/* Mode indicator — bottom-right badge */}
          <YStack
            position="absolute"
            bottom={-2}
            right={-2}
            width={18}
            height={18}
            borderRadius={9}
            backgroundColor={isAI ? "#22c55e" : "#f59e0b"}
            borderWidth={2}
            borderColor="$background"
            alignItems="center"
            justifyContent="center"
          >
            <Ionicons
              name={isAI ? "hardware-chip-outline" : "person"}
              size={10}
              color="white"
            />
          </YStack>
        </YStack>

        {/* Content */}
        <YStack flex={1} gap={2}>
          <XStack justifyContent="space-between" alignItems="center">
            <XStack flex={1} alignItems="center" gap="$2">
              <Text
                fontWeight={hasUnread ? "bold" : "600"}
                fontSize={16}
                numberOfLines={1}
                color="$color"
              >
                {conversation.contactName || conversation.contactPhone}
              </Text>
              {isUrgent && (
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={conversation.urgency === "CRITICAL" ? "#ef4444" : "#eab308"}
                />
              )}
            </XStack>
            <Text fontSize={12} color={hasUnread ? primary : "$gray8"} fontWeight={hasUnread ? "bold" : "400"}>
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
              fontWeight={hasUnread ? "500" : "400"}
            >
              {conversation.lastMessage || "Sem mensagens"}
            </Text>
            {hasUnread && (
              <YStack
                backgroundColor={primary}
                minWidth={20}
                height={20}
                borderRadius={10}
                paddingHorizontal={6}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={10} color="white" fontWeight="bold">
                  {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
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
  primary,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onPress: () => void;
  primary: string;
}) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderRadius={20}
        backgroundColor={active ? primary : "$backgroundStrong"}
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
            backgroundColor={active ? "white" : primary}
            paddingHorizontal={6}
            borderRadius={8}
            minWidth={18}
            alignItems="center"
          >
            <Text fontSize={10} color={active ? primary : "white"} fontWeight="bold">
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
