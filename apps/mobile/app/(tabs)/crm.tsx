import { useEffect, useState, useCallback } from "react";
import { FlatList, RefreshControl, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { router, Stack } from "expo-router";
import { YStack, XStack, Text, useTheme, ScrollView } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

const WATSON_TEAL = "#0d9488";
const WATSON_TEAL_LIGHT = "#14b8a6";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  leadScore: number;
  funnelStage?: {
    id: string;
    name: string;
    color: string;
  };
  tags: Tag[];
  lastInteractionAt?: string;
  conversationCount: number;
  status: string;
}

export default function CRMScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const theme = useTheme();

  const fetchData = async () => {
    try {
      const [contactsRes, tagsRes] = await Promise.all([
        api.get<{ success: boolean; data: Contact[] }>("/contacts"),
        api.get<{ success: boolean; data: Tag[] }>("/tags"),
      ]);
      setContacts(contactsRes.data.data || []);
      setAllTags(tagsRes.data.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, []);

  // Filter logic
  const filteredContacts = contacts.filter((contact) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "score") return contact.leadScore >= 70;
    if (selectedFilter === "recent") {
      if (!contact.lastInteractionAt) return false;
      const daysDiff = Math.floor((Date.now() - new Date(contact.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 7;
    }
    // Tag filter
    return contact.tags?.some((t) => t.id === selectedFilter);
  });

  // Stats
  const taggedCount = contacts.filter((c) => c.tags && c.tags.length > 0).length;
  const highScoreCount = contacts.filter((c) => c.leadScore >= 70).length;
  const recentCount = contacts.filter((c) => {
    if (!c.lastInteractionAt) return false;
    const daysDiff = Math.floor((Date.now() - new Date(c.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 7;
  }).length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const getLastMessage = (contact: Contact) => {
    // Placeholder - ideally would show last message
    if (contact.conversationCount > 0) {
      return `${contact.conversationCount} conversa${contact.conversationCount > 1 ? "s" : ""}`;
    }
    return "Novo contato";
  };

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={WATSON_TEAL} />
      </YStack>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background">
        {/* Header */}
        <YStack paddingHorizontal="$4" paddingTop="$6" paddingBottom="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={28} fontWeight="bold" color="$color">
              CRM
            </Text>
            <XStack gap="$3">
              <Pressable>
                <Ionicons name="search-outline" size={24} color={theme.color.val} />
              </Pressable>
              <Pressable>
                <Ionicons name="ellipsis-vertical" size={24} color={theme.color.val} />
              </Pressable>
            </XStack>
          </XStack>
        </YStack>

        {/* Filter Chips - WhatsApp Style */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
        >
          <FilterChip
            label="Todos"
            count={contacts.length}
            isSelected={selectedFilter === "all"}
            onPress={() => setSelectedFilter("all")}
          />
          <FilterChip
            label="Recentes"
            count={recentCount}
            isSelected={selectedFilter === "recent"}
            onPress={() => setSelectedFilter("recent")}
          />
          <FilterChip
            label="Score Alto"
            count={highScoreCount}
            isSelected={selectedFilter === "score"}
            onPress={() => setSelectedFilter("score")}
          />
          {allTags.slice(0, 4).map((tag) => (
            <FilterChip
              key={tag.id}
              label={tag.name}
              count={contacts.filter((c) => c.tags?.some((t) => t.id === tag.id)).length}
              isSelected={selectedFilter === tag.id}
              onPress={() => setSelectedFilter(selectedFilter === tag.id ? "all" : tag.id)}
              color={tag.color}
            />
          ))}
        </ScrollView>

        {/* Contact List - WhatsApp Style */}
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={WATSON_TEAL}
              colors={[WATSON_TEAL]}
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/contact/${item.id}`)}>
              <XStack
                paddingHorizontal="$4"
                paddingVertical="$3"
                gap="$3"
                alignItems="center"
                backgroundColor="$background"
                borderBottomWidth={StyleSheet.hairlineWidth}
                borderBottomColor="$gray5"
              >
                {/* Avatar */}
                <YStack
                  width={52}
                  height={52}
                  borderRadius={26}
                  backgroundColor={getAvatarColor(item.name || item.phone)}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text color="white" fontSize={20} fontWeight="600">
                    {(item.name || item.phone)?.charAt(0)?.toUpperCase() || "?"}
                  </Text>
                </YStack>

                {/* Content */}
                <YStack flex={1}>
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={16} fontWeight="600" color="$color" numberOfLines={1} flex={1}>
                      {item.name || item.phone}
                    </Text>
                    <Text fontSize={12} color="$gray8">
                      {formatDate(item.lastInteractionAt)}
                    </Text>
                  </XStack>

                  <XStack justifyContent="space-between" alignItems="center" marginTop={2}>
                    <XStack flex={1} alignItems="center" gap="$2">
                      {/* Tags inline */}
                      {item.tags && item.tags.length > 0 ? (
                        <XStack gap="$1" flex={1}>
                          {item.tags.slice(0, 2).map((tag) => (
                            <XStack
                              key={tag.id}
                              backgroundColor={`${tag.color}20`}
                              paddingHorizontal={6}
                              paddingVertical={2}
                              borderRadius={4}
                            >
                              <Text fontSize={11} color={tag.color} fontWeight="500">
                                {tag.name}
                              </Text>
                            </XStack>
                          ))}
                          {item.tags.length > 2 && (
                            <Text fontSize={11} color="$gray8">+{item.tags.length - 2}</Text>
                          )}
                        </XStack>
                      ) : (
                        <Text fontSize={14} color="$gray8" numberOfLines={1} flex={1}>
                          {getLastMessage(item)}
                        </Text>
                      )}
                    </XStack>

                    {/* Score Badge */}
                    {item.leadScore > 0 && (
                      <YStack
                        backgroundColor={getScoreColor(item.leadScore)}
                        width={24}
                        height={24}
                        borderRadius={12}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Text fontSize={11} color="white" fontWeight="bold">
                          {item.leadScore}
                        </Text>
                      </YStack>
                    )}
                  </XStack>
                </YStack>
              </XStack>
            </Pressable>
          )}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8">
              <Ionicons name="people-outline" size={48} color={theme.gray6.val} />
              <Text fontSize="$4" color="$gray8" marginTop="$3">
                Nenhum contato encontrado
              </Text>
            </YStack>
          }
        />

        {/* FAB - WhatsApp Style */}
        <Pressable
          style={styles.fab}
          onPress={() => {/* Add contact action */}}
        >
          <Ionicons name="add" size={28} color="white" />
        </Pressable>
      </YStack>
    </>
  );
}

function FilterChip({
  label,
  count,
  isSelected,
  onPress,
  color,
}: {
  label: string;
  count?: number;
  isSelected: boolean;
  onPress: () => void;
  color?: string;
}) {
  const chipColor = color || WATSON_TEAL;

  return (
    <Pressable onPress={onPress}>
      <XStack
        backgroundColor={isSelected ? chipColor : `${chipColor}15`}
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderRadius={20}
        alignItems="center"
        gap="$1"
      >
        <Text
          fontSize={13}
          fontWeight="500"
          color={isSelected ? "white" : chipColor}
        >
          {label}
        </Text>
        {count !== undefined && count > 0 && (
          <Text
            fontSize={12}
            fontWeight="600"
            color={isSelected ? "rgba(255,255,255,0.8)" : `${chipColor}80`}
          >
            {count}
          </Text>
        )}
      </XStack>
    </Pressable>
  );
}

function getAvatarColor(name: string): string {
  const colors = [
    "#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b",
    "#10b981", "#3b82f6", "#ef4444", "#6366f1"
  ];
  const index = (name?.charCodeAt(0) || 0) % colors.length;
  return colors[index];
}

function getScoreColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#6b7280";
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: WATSON_TEAL,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
