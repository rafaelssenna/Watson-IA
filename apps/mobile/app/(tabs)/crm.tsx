import { useEffect, useState, useCallback } from "react";
import { FlatList, RefreshControl, Pressable } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Input, Card, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

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

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name?.toLowerCase().includes(search.toLowerCase()) ||
      contact.phone?.includes(search) ||
      contact.email?.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }: { item: Contact }) => (
    <ContactCard
      contact={item}
      onPress={() => router.push(`/contact/${item.id}`)}
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
          placeholder="Buscar contatos..."
          placeholderTextColor={theme.gray7.val}
          value={search}
          onChangeText={setSearch}
          size="$4"
          backgroundColor="$backgroundStrong"
          borderColor="$gray6"
          color="$color"
        />
      </YStack>

      {/* Stats */}
      <XStack paddingHorizontal="$4" gap="$3" marginBottom="$3">
        <Card flex={1} padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4">
          <Text fontSize="$2" color="$gray8">Total</Text>
          <Text fontSize="$6" fontWeight="bold" color="$color">{contacts.length}</Text>
        </Card>
        <Card flex={1} padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4">
          <Text fontSize="$2" color="$gray8">Score Alto</Text>
          <Text fontSize="$6" fontWeight="bold" color="$green10">
            {contacts.filter(c => c.leadScore >= 70).length}
          </Text>
        </Card>
      </XStack>

      {/* Contacts List */}
      <FlatList
        data={filteredContacts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <YStack alignItems="center" padding="$8">
            <Ionicons name="people-outline" size={48} color="#71717a" />
            <Text marginTop="$4" color="$gray8">
              Nenhum contato encontrado
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
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "$green10";
    if (score >= 40) return "$yellow10";
    return "$gray8";
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
            backgroundColor="$purple10"
            alignItems="center"
            justifyContent="center"
          >
            <Text color="white" fontSize="$5" fontWeight="bold">
              {contact.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </YStack>

          {/* Content */}
          <YStack flex={1}>
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontWeight="600" numberOfLines={1} flex={1} color="$color">
                {contact.name || contact.phone}
              </Text>
              <XStack
                backgroundColor={getScoreColor(contact.leadScore)}
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
              >
                <Text fontSize="$2" color="white" fontWeight="600">
                  {contact.leadScore}
                </Text>
              </XStack>
            </XStack>

            <Text color="$gray8" fontSize="$2" marginTop="$1">
              {contact.phone} {contact.email && `• ${contact.email}`}
            </Text>

            {/* Funnel Stage & Tags */}
            <XStack marginTop="$2" gap="$2" flexWrap="wrap">
              {contact.funnelStage && (
                <YStack
                  backgroundColor={contact.funnelStage.color}
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderRadius="$2"
                >
                  <Text fontSize="$1" color="white">
                    {contact.funnelStage.name}
                  </Text>
                </YStack>
              )}
              {contact.tags.slice(0, 2).map((tag) => (
                <YStack
                  key={tag.id}
                  backgroundColor={tag.color}
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderRadius="$2"
                  opacity={0.8}
                >
                  <Text fontSize="$1" color="white">
                    {tag.name}
                  </Text>
                </YStack>
              ))}
            </XStack>

            {/* Meta */}
            <XStack marginTop="$2" gap="$4" alignItems="center">
              <XStack alignItems="center" gap="$1">
                <Ionicons name="calendar-outline" size={12} color={theme.gray8.val} />
                <Text fontSize="$1" color="$gray8">
                  {formatDate(contact.lastInteractionAt)}
                </Text>
              </XStack>
              <XStack alignItems="center" gap="$1">
                <Ionicons name="chatbubble-outline" size={12} color={theme.gray8.val} />
                <Text fontSize="$1" color="$gray8">
                  {contact.conversationCount} conversas
                </Text>
              </XStack>
            </XStack>
          </YStack>
        </XStack>
      </Card>
    </Pressable>
  );
}
