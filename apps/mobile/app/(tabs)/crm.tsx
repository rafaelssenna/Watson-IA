import { useEffect, useState, useCallback } from "react";
import { FlatList, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Input, Card, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/services/api";

const WATSON_TEAL = "#0d9488";

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
  tags: Array<{ id: string; name: string; color: string }>;
  lastInteractionAt?: string;
  conversationCount: number;
  status: string;
}

export default function CRMScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const theme = useTheme();

  const fetchContacts = async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: Contact[];
      }>("/contacts");
      setContacts(response.data.data);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchContacts();
  }, []);

  // Get unique tags from all contacts
  const allTags = contacts.reduce((acc, contact) => {
    contact.tags.forEach((tag) => {
      if (!acc.find((t) => t.id === tag.id)) {
        acc.push(tag);
      }
    });
    return acc;
  }, [] as Array<{ id: string; name: string; color: string }>);

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.name?.toLowerCase().includes(search.toLowerCase()) ||
      contact.phone?.includes(search) ||
      contact.email?.toLowerCase().includes(search.toLowerCase());

    const matchesTag = selectedTag
      ? contact.tags.some((t) => t.id === selectedTag)
      : true;

    return matchesSearch && matchesTag;
  });

  // Stats
  const highScoreCount = contacts.filter((c) => c.leadScore >= 70).length;
  const taggedCount = contacts.filter((c) => c.tags.length > 0).length;

  const renderItem = ({ item }: { item: Contact }) => (
    <ContactCard
      contact={item}
      onPress={() => router.push(`/contact/${item.id}`)}
    />
  );

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={WATSON_TEAL} />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header with Gradient */}
      <LinearGradient
        colors={["#0d9488", "#0891b2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: 16, paddingBottom: 24, paddingHorizontal: 16 }}
      >
        <Text fontSize="$7" fontWeight="bold" color="white" marginBottom="$3">
          CRM
        </Text>

        {/* Search */}
        <XStack
          backgroundColor="rgba(255,255,255,0.2)"
          borderRadius="$4"
          paddingHorizontal="$3"
          alignItems="center"
          gap="$2"
        >
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.7)" />
          <Input
            flex={1}
            placeholder="Buscar contatos..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={search}
            onChangeText={setSearch}
            backgroundColor="transparent"
            borderWidth={0}
            color="white"
            paddingHorizontal={0}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          )}
        </XStack>
      </LinearGradient>

      {/* Stats Cards */}
      <XStack paddingHorizontal="$4" gap="$3" marginTop={-16}>
        <Card flex={1} padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4" elevation={4}>
          <XStack alignItems="center" gap="$2">
            <YStack
              width={36}
              height={36}
              borderRadius={18}
              backgroundColor="#0d948820"
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="people" size={18} color={WATSON_TEAL} />
            </YStack>
            <YStack>
              <Text fontSize="$2" color="$gray8">Total</Text>
              <Text fontSize="$5" fontWeight="bold" color="$color">{contacts.length}</Text>
            </YStack>
          </XStack>
        </Card>
        <Card flex={1} padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4" elevation={4}>
          <XStack alignItems="center" gap="$2">
            <YStack
              width={36}
              height={36}
              borderRadius={18}
              backgroundColor="#10b98120"
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="star" size={18} color="#10b981" />
            </YStack>
            <YStack>
              <Text fontSize="$2" color="$gray8">Score Alto</Text>
              <Text fontSize="$5" fontWeight="bold" color="#10b981">{highScoreCount}</Text>
            </YStack>
          </XStack>
        </Card>
        <Card flex={1} padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4" elevation={4}>
          <XStack alignItems="center" gap="$2">
            <YStack
              width={36}
              height={36}
              borderRadius={18}
              backgroundColor="#8b5cf620"
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="pricetags" size={18} color="#8b5cf6" />
            </YStack>
            <YStack>
              <Text fontSize="$2" color="$gray8">Com Tags</Text>
              <Text fontSize="$5" fontWeight="bold" color="#8b5cf6">{taggedCount}</Text>
            </YStack>
          </XStack>
        </Card>
      </XStack>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <YStack paddingHorizontal="$4" marginTop="$4">
          <Text fontSize="$2" color="$gray8" marginBottom="$2">Filtrar por tag</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: null, name: "Todos", color: WATSON_TEAL }, ...allTags]}
            keyExtractor={(item) => item.id || "all"}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => setSelectedTag(item.id)}>
                <XStack
                  backgroundColor={selectedTag === item.id ? item.color : `${item.color}20`}
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius="$3"
                  alignItems="center"
                  gap="$1"
                >
                  <Ionicons
                    name={item.id === null ? "apps" : "pricetag"}
                    size={14}
                    color={selectedTag === item.id ? "white" : item.color}
                  />
                  <Text
                    fontSize="$2"
                    fontWeight="600"
                    color={selectedTag === item.id ? "white" : item.color}
                  >
                    {item.name}
                  </Text>
                  {item.id !== null && (
                    <Text
                      fontSize="$1"
                      color={selectedTag === item.id ? "rgba(255,255,255,0.7)" : `${item.color}80`}
                    >
                      ({contacts.filter((c) => c.tags.some((t) => t.id === item.id)).length})
                    </Text>
                  )}
                </XStack>
              </Pressable>
            )}
          />
        </YStack>
      )}

      {/* Contacts List */}
      <FlatList
        data={filteredContacts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={WATSON_TEAL}
            colors={[WATSON_TEAL]}
          />
        }
        ListEmptyComponent={
          <YStack alignItems="center" padding="$8">
            <YStack
              width={80}
              height={80}
              borderRadius={40}
              backgroundColor="$gray4"
              alignItems="center"
              justifyContent="center"
              marginBottom="$4"
            >
              <Ionicons name="people-outline" size={40} color="#71717a" />
            </YStack>
            <Text fontSize="$4" fontWeight="600" color="$color">
              Nenhum contato encontrado
            </Text>
            <Text fontSize="$2" color="$gray8" marginTop="$1" textAlign="center">
              {search ? "Tente uma busca diferente" : "Os contatos aparecerao aqui"}
            </Text>
          </YStack>
        }
      />
    </YStack>
  );
}

function ContactCard({
  contact,
  onPress,
}: {
  contact: Contact;
  onPress: () => void;
}) {
  const theme = useTheme();

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Nunca";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays}d atras`;

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const getScoreGradient = (score: number): [string, string] => {
    if (score >= 70) return ["#10b981", "#059669"];
    if (score >= 40) return ["#f59e0b", "#d97706"];
    return ["#6b7280", "#4b5563"];
  };

  const getInitialColor = (name: string) => {
    const colors = [
      ["#8b5cf6", "#7c3aed"], // violet
      ["#ec4899", "#db2777"], // pink
      ["#06b6d4", "#0891b2"], // cyan
      ["#f59e0b", "#d97706"], // amber
      ["#10b981", "#059669"], // emerald
      ["#3b82f6", "#2563eb"], // blue
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  const [gradientStart, gradientEnd] = getInitialColor(contact.name || contact.phone);

  return (
    <Pressable onPress={onPress}>
      <Card
        padding="$4"
        backgroundColor="$backgroundStrong"
        borderRadius="$4"
        borderLeftWidth={4}
        borderLeftColor={contact.tags[0]?.color || WATSON_TEAL}
      >
        <XStack gap="$3">
          {/* Avatar with Gradient */}
          <LinearGradient
            colors={[gradientStart, gradientEnd]}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text color="white" fontSize="$6" fontWeight="bold">
              {contact.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </LinearGradient>

          {/* Content */}
          <YStack flex={1}>
            {/* Name & Score */}
            <XStack justifyContent="space-between" alignItems="center">
              <YStack flex={1} marginRight="$2">
                <Text fontWeight="700" fontSize="$4" numberOfLines={1} color="$color">
                  {contact.name || "Sem nome"}
                </Text>
                <Text color="$gray8" fontSize="$2">
                  {contact.phone}
                </Text>
              </YStack>

              {/* Score Badge */}
              <LinearGradient
                colors={getScoreGradient(contact.leadScore)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                }}
              >
                <Text fontSize="$3" color="white" fontWeight="bold">
                  {contact.leadScore}
                </Text>
              </LinearGradient>
            </XStack>

            {/* Tags */}
            {contact.tags.length > 0 && (
              <XStack marginTop="$2" gap="$2" flexWrap="wrap">
                {contact.tags.slice(0, 3).map((tag) => (
                  <XStack
                    key={tag.id}
                    backgroundColor={`${tag.color}20`}
                    paddingHorizontal="$2"
                    paddingVertical={4}
                    borderRadius="$2"
                    alignItems="center"
                    gap="$1"
                    borderWidth={1}
                    borderColor={`${tag.color}40`}
                  >
                    <YStack
                      width={6}
                      height={6}
                      borderRadius={3}
                      backgroundColor={tag.color}
                    />
                    <Text fontSize={11} fontWeight="600" color={tag.color}>
                      {tag.name}
                    </Text>
                  </XStack>
                ))}
                {contact.tags.length > 3 && (
                  <XStack
                    backgroundColor="$gray4"
                    paddingHorizontal="$2"
                    paddingVertical={4}
                    borderRadius="$2"
                  >
                    <Text fontSize={11} color="$gray8">
                      +{contact.tags.length - 3}
                    </Text>
                  </XStack>
                )}
              </XStack>
            )}

            {/* Funnel Stage */}
            {contact.funnelStage && (
              <XStack marginTop="$2" alignItems="center" gap="$1">
                <Ionicons name="funnel-outline" size={12} color={contact.funnelStage.color} />
                <Text fontSize="$1" color={contact.funnelStage.color} fontWeight="500">
                  {contact.funnelStage.name}
                </Text>
              </XStack>
            )}

            {/* Meta Info */}
            <XStack marginTop="$2" gap="$4" alignItems="center">
              <XStack alignItems="center" gap="$1">
                <Ionicons name="time-outline" size={14} color={theme.gray7.val} />
                <Text fontSize="$2" color="$gray7">
                  {formatDate(contact.lastInteractionAt)}
                </Text>
              </XStack>
              <XStack alignItems="center" gap="$1">
                <Ionicons name="chatbubbles-outline" size={14} color={theme.gray7.val} />
                <Text fontSize="$2" color="$gray7">
                  {contact.conversationCount}
                </Text>
              </XStack>
            </XStack>
          </YStack>
        </XStack>
      </Card>
    </Pressable>
  );
}
