import { useEffect, useState, useCallback } from "react";
import { FlatList, RefreshControl, Pressable } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Input, Card, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

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

export default function ConversationsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const theme = useTheme();

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

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.contactName?.toLowerCase().includes(search.toLowerCase()) ||
      conv.contactPhone?.includes(search) ||
      conv.lastMessage?.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }: { item: Conversation }) => (
    <ConversationCard
      conversation={item}
      onPress={() => router.push(`/conversation/${item.id}`)}
    />
  );

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Text color="$color">Carregando...</Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Search */}
      <YStack padding="$4" paddingBottom="$2">
        <Input
          placeholder="Buscar conversas..."
          placeholderTextColor={theme.gray7.val}
          value={search}
          onChangeText={setSearch}
          size="$4"
          backgroundColor="$backgroundStrong"
          borderColor="$gray6"
          color="$color"
        />
      </YStack>

      {/* Filter chips */}
      <XStack paddingHorizontal="$4" gap="$2" marginBottom="$2">
        <FilterChip label="Todos" active />
        <FilterChip label="Urgentes" count={conversations.filter(c => c.urgency === "HIGH" || c.urgency === "CRITICAL").length} />
        <FilterChip label="Compra" count={conversations.filter(c => c.intent === "purchase").length} />
      </XStack>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
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

function ConversationCard({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  const urgencyColors: Record<string, string> = {
    CRITICAL: "$red10",
    HIGH: "$yellow10",
    NORMAL: "$gray8",
    LOW: "$gray8",
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return "Agora";
    if (hours < 24) return `${hours}h`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <Pressable onPress={onPress}>
      <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
        <XStack gap="$3">
          {/* Avatar */}
          <YStack
            width={50}
            height={50}
            borderRadius={25}
            backgroundColor="$blue10"
            alignItems="center"
            justifyContent="center"
          >
            <Text color="white" fontSize="$5" fontWeight="bold">
              {conversation.contactName?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </YStack>

          {/* Content */}
          <YStack flex={1}>
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontWeight="600" numberOfLines={1} flex={1} color="$color">
                {conversation.contactName || conversation.contactPhone}
              </Text>
              <Text fontSize="$2" color="$gray8">
                {formatTime(conversation.lastMessageAt)}
              </Text>
            </XStack>

            <Text
              color="$gray8"
              fontSize="$3"
              numberOfLines={1}
              marginTop="$1"
            >
              {conversation.lastMessage || "Sem mensagens"}
            </Text>

            {/* Badges */}
            <XStack marginTop="$2" gap="$2">
              {(conversation.urgency === "HIGH" || conversation.urgency === "CRITICAL") && (
                <Badge
                  label={conversation.urgency === "CRITICAL" ? "Critico" : "Urgente"}
                  color={urgencyColors[conversation.urgency]}
                />
              )}
              {conversation.intent === "purchase" && (
                <Badge label="Compra" color="$green10" />
              )}
              <Badge
                label={`Score: ${conversation.leadScore}`}
                color="$blue10"
              />
            </XStack>
          </YStack>
        </XStack>
      </Card>
    </Pressable>
  );
}

function FilterChip({
  label,
  count,
  active = false,
}: {
  label: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$4"
      backgroundColor={active ? "$blue10" : "$backgroundStrong"}
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
          backgroundColor={active ? "white" : "$blue10"}
          paddingHorizontal="$2"
          borderRadius="$2"
        >
          <Text fontSize="$1" color={active ? "$blue10" : "white"}>
            {count}
          </Text>
        </YStack>
      )}
    </XStack>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <YStack
      backgroundColor={color}
      paddingHorizontal="$2"
      paddingVertical="$1"
      borderRadius="$2"
      opacity={0.9}
    >
      <Text fontSize="$1" color="white" fontWeight="500">
        {label}
      </Text>
    </YStack>
  );
}
