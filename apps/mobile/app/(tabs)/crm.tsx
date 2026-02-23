import { useEffect, useState, useCallback } from "react";
import { FlatList, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { router, Stack } from "expo-router";
import { YStack, XStack, Text, Input, Card, useTheme, ScrollView } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

const WATSON_TEAL = "#0d9488";

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
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const theme = useTheme();

  const fetchData = async () => {
    try {
      // Fetch contacts and tags in parallel
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

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.name?.toLowerCase().includes(search.toLowerCase()) ||
      contact.phone?.includes(search) ||
      contact.email?.toLowerCase().includes(search.toLowerCase());

    const matchesTag = selectedTag
      ? contact.tags?.some((t) => t.id === selectedTag)
      : true;

    return matchesSearch && matchesTag;
  });

  // Stats
  const highScoreCount = contacts.filter((c) => c.leadScore >= 70).length;
  const taggedCount = contacts.filter((c) => c.tags && c.tags.length > 0).length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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
        <YStack paddingHorizontal="$4" paddingTop="$6" paddingBottom="$3" backgroundColor={WATSON_TEAL}>
          <Text fontSize="$7" fontWeight="bold" color="white">
            CRM
          </Text>

          {/* Search */}
          <XStack
            marginTop="$3"
            backgroundColor="rgba(255,255,255,0.15)"
            borderRadius="$3"
            paddingHorizontal="$3"
            paddingVertical="$2"
            alignItems="center"
            gap="$2"
          >
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.7)" />
            <Input
              flex={1}
              placeholder="Buscar contatos..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={search}
              onChangeText={setSearch}
              backgroundColor="transparent"
              borderWidth={0}
              color="white"
              paddingHorizontal={0}
              paddingVertical={0}
              fontSize={14}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            )}
          </XStack>
        </YStack>

        {/* Stats */}
        <XStack paddingHorizontal="$4" paddingVertical="$3" gap="$2" backgroundColor="$background">
          <Card flex={1} padding="$2" backgroundColor="$backgroundStrong" borderRadius="$3">
            <XStack alignItems="center" gap="$2">
              <YStack width={32} height={32} borderRadius={16} backgroundColor={`${WATSON_TEAL}20`} alignItems="center" justifyContent="center">
                <Ionicons name="people" size={16} color={WATSON_TEAL} />
              </YStack>
              <YStack>
                <Text fontSize={11} color="$gray8">Total</Text>
                <Text fontSize="$4" fontWeight="bold" color="$color">{contacts.length}</Text>
              </YStack>
            </XStack>
          </Card>
          <Card flex={1} padding="$2" backgroundColor="$backgroundStrong" borderRadius="$3">
            <XStack alignItems="center" gap="$2">
              <YStack width={32} height={32} borderRadius={16} backgroundColor="#10b98120" alignItems="center" justifyContent="center">
                <Ionicons name="star" size={16} color="#10b981" />
              </YStack>
              <YStack>
                <Text fontSize={11} color="$gray8">Score Alto</Text>
                <Text fontSize="$4" fontWeight="bold" color="#10b981">{highScoreCount}</Text>
              </YStack>
            </XStack>
          </Card>
          <Card flex={1} padding="$2" backgroundColor="$backgroundStrong" borderRadius="$3">
            <XStack alignItems="center" gap="$2">
              <YStack width={32} height={32} borderRadius={16} backgroundColor="#8b5cf620" alignItems="center" justifyContent="center">
                <Ionicons name="pricetags" size={16} color="#8b5cf6" />
              </YStack>
              <YStack>
                <Text fontSize={11} color="$gray8">Com Tags</Text>
                <Text fontSize="$4" fontWeight="bold" color="#8b5cf6">{taggedCount}</Text>
              </YStack>
            </XStack>
          </Card>
        </XStack>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <YStack paddingBottom="$2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              <Pressable onPress={() => setSelectedTag(null)}>
                <XStack
                  backgroundColor={selectedTag === null ? WATSON_TEAL : `${WATSON_TEAL}15`}
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius="$2"
                  alignItems="center"
                  gap="$1"
                >
                  <Text fontSize={12} fontWeight="600" color={selectedTag === null ? "white" : WATSON_TEAL}>
                    Todos
                  </Text>
                </XStack>
              </Pressable>
              {allTags.map((tag) => {
                const count = contacts.filter((c) => c.tags?.some((t) => t.id === tag.id)).length;
                return (
                  <Pressable key={tag.id} onPress={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}>
                    <XStack
                      backgroundColor={selectedTag === tag.id ? tag.color : `${tag.color}15`}
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      borderRadius="$2"
                      alignItems="center"
                      gap="$1"
                    >
                      <YStack width={8} height={8} borderRadius={4} backgroundColor={selectedTag === tag.id ? "white" : tag.color} />
                      <Text fontSize={12} fontWeight="600" color={selectedTag === tag.id ? "white" : tag.color}>
                        {tag.name}
                      </Text>
                      <Text fontSize={10} color={selectedTag === tag.id ? "rgba(255,255,255,0.7)" : `${tag.color}80`}>
                        {count}
                      </Text>
                    </XStack>
                  </Pressable>
                );
              })}
            </ScrollView>
          </YStack>
        )}

        {/* Contacts List */}
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
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
              <Card
                padding="$3"
                backgroundColor="$backgroundStrong"
                borderRadius="$3"
                borderLeftWidth={3}
                borderLeftColor={item.tags?.[0]?.color || "$gray6"}
              >
                <XStack gap="$3" alignItems="center">
                  {/* Avatar */}
                  <YStack
                    width={48}
                    height={48}
                    borderRadius={24}
                    backgroundColor={getAvatarColor(item.name || item.phone)}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text color="white" fontSize="$5" fontWeight="bold">
                      {(item.name || item.phone)?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </YStack>

                  {/* Info */}
                  <YStack flex={1}>
                    <XStack justifyContent="space-between" alignItems="flex-start">
                      <YStack flex={1} marginRight="$2">
                        <Text fontWeight="600" fontSize="$4" color="$color" numberOfLines={1}>
                          {item.name || "Sem nome"}
                        </Text>
                        <Text fontSize={12} color="$gray8">{item.phone}</Text>
                      </YStack>

                      {/* Score */}
                      <YStack
                        backgroundColor={getScoreColor(item.leadScore)}
                        paddingHorizontal="$2"
                        paddingVertical={4}
                        borderRadius={12}
                        minWidth={32}
                        alignItems="center"
                      >
                        <Text fontSize={12} color="white" fontWeight="bold">{item.leadScore}</Text>
                      </YStack>
                    </XStack>

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <XStack marginTop="$2" gap="$1" flexWrap="wrap">
                        {item.tags.slice(0, 3).map((tag) => (
                          <XStack
                            key={tag.id}
                            backgroundColor={`${tag.color}20`}
                            paddingHorizontal={8}
                            paddingVertical={3}
                            borderRadius={4}
                            alignItems="center"
                            gap={4}
                          >
                            <YStack width={6} height={6} borderRadius={3} backgroundColor={tag.color} />
                            <Text fontSize={10} fontWeight="600" color={tag.color}>{tag.name}</Text>
                          </XStack>
                        ))}
                        {item.tags.length > 3 && (
                          <XStack backgroundColor="$gray5" paddingHorizontal={6} paddingVertical={3} borderRadius={4}>
                            <Text fontSize={10} color="$gray8">+{item.tags.length - 3}</Text>
                          </XStack>
                        )}
                      </XStack>
                    )}

                    {/* Meta */}
                    <XStack marginTop="$2" gap="$3" alignItems="center">
                      <XStack alignItems="center" gap={4}>
                        <Ionicons name="time-outline" size={12} color={theme.gray7.val} />
                        <Text fontSize={11} color="$gray7">{formatDate(item.lastInteractionAt)}</Text>
                      </XStack>
                      <XStack alignItems="center" gap={4}>
                        <Ionicons name="chatbubble-outline" size={12} color={theme.gray7.val} />
                        <Text fontSize={11} color="$gray7">{item.conversationCount}</Text>
                      </XStack>
                      {item.funnelStage && (
                        <XStack alignItems="center" gap={4}>
                          <Ionicons name="funnel-outline" size={12} color={item.funnelStage.color} />
                          <Text fontSize={11} color={item.funnelStage.color}>{item.funnelStage.name}</Text>
                        </XStack>
                      )}
                    </XStack>
                  </YStack>
                </XStack>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8">
              <YStack width={64} height={64} borderRadius={32} backgroundColor="$gray4" alignItems="center" justifyContent="center" marginBottom="$3">
                <Ionicons name="people-outline" size={32} color={theme.gray6.val} />
              </YStack>
              <Text fontSize="$4" fontWeight="600" color="$color">Nenhum contato</Text>
              <Text fontSize="$2" color="$gray8" marginTop="$1">
                {search || selectedTag ? "Tente outra busca ou filtro" : "Os contatos aparecerao aqui"}
              </Text>
            </YStack>
          }
        />
      </YStack>
    </>
  );
}

function getAvatarColor(name: string): string {
  const colors = ["#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];
  const index = (name?.charCodeAt(0) || 0) % colors.length;
  return colors[index];
}

function getScoreColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#6b7280";
}
