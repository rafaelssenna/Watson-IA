import { useEffect, useState, useCallback } from "react";
import { ScrollView, Pressable, Alert } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { YStack, XStack, Text, Card, Button, Spinner, Input, TextArea } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api } from "@/services/api";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface FunnelStage {
  id: string;
  name: string;
  color: string;
}

interface Funnel {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  name?: string;
  pushName?: string;
  phone: string;
  email?: string;
  profilePicUrl?: string;
  leadScore: number;
  company?: string;
  notes?: string;
  tags: Tag[];
  funnel?: Funnel;
  funnelStage?: FunnelStage;
  conversationCount: number;
  lastInteractionAt?: string;
  createdAt: string;
}

interface ConversationSummary {
  id: string;
  status: string;
  intent?: string;
  messageCount: number;
  lastMessageAt: string;
}

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [contact, setContact] = useState<Contact | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");

  const fetchContact = useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: Contact;
      }>(`/contacts/${id}`);
      setContact(response.data.data);
      setEditedNotes(response.data.data.notes || "");
    } catch (error) {
      console.error("Error fetching contact:", error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: ConversationSummary[];
      }>(`/contacts/${id}/conversations`);
      setConversations(response.data.data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  }, [id]);

  useEffect(() => {
    fetchContact();
    fetchConversations();
  }, [fetchContact, fetchConversations]);

  const saveNotes = async () => {
    try {
      await api.patch(`/contacts/${id}`, { notes: editedNotes });
      setContact((prev) => prev ? { ...prev, notes: editedNotes } : prev);
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error saving notes:", error);
      Alert.alert("Erro", "Nao foi possivel salvar as notas");
    }
  };

  const startConversation = () => {
    // Find the latest open conversation or create new
    const openConversation = conversations.find(
      (c) => c.status === "OPEN" || c.status === "WAITING_AGENT" || c.status === "IN_PROGRESS"
    );

    if (openConversation) {
      router.push(`/conversation/${openConversation.id}`);
    } else {
      // TODO: Create new conversation
      Alert.alert("Info", "Funcionalidade de criar nova conversa em desenvolvimento");
    }
  };

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Spinner size="large" color="$blue10" />
        <Text marginTop="$4" color="$colorSubtle">
          Carregando contato...
        </Text>
      </YStack>
    );
  }

  if (!contact) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Text fontSize={48}>😕</Text>
        <Text marginTop="$4" color="$colorSubtle">
          Contato nao encontrado
        </Text>
        <Button marginTop="$4" onPress={() => router.back()}>
          Voltar
        </Button>
      </YStack>
    );
  }

  const contactName = contact.name || contact.pushName || contact.phone;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Contato",
          headerBackTitle: "Voltar",
        }}
      />

      <ScrollView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
        <YStack padding="$4" gap="$4">
          {/* Profile Card */}
          <Card padding="$4" bordered>
            <YStack alignItems="center" gap="$3">
              <YStack
                width={80}
                height={80}
                borderRadius={40}
                backgroundColor="$blue10"
                alignItems="center"
                justifyContent="center"
              >
                <Text color="white" fontSize="$8" fontWeight="bold">
                  {contactName.charAt(0).toUpperCase()}
                </Text>
              </YStack>

              <YStack alignItems="center">
                <Text fontSize="$6" fontWeight="bold">
                  {contactName}
                </Text>
                <Text color="$colorSubtle">{contact.phone}</Text>
                {contact.email && (
                  <Text color="$colorSubtle" fontSize="$2">
                    {contact.email}
                  </Text>
                )}
                {contact.company && (
                  <Text color="$blue10" fontSize="$2" marginTop="$1">
                    {contact.company}
                  </Text>
                )}
              </YStack>

              {/* Tags */}
              {contact.tags.length > 0 && (
                <XStack flexWrap="wrap" gap="$2" justifyContent="center">
                  {contact.tags.map((tag) => (
                    <YStack
                      key={tag.id}
                      backgroundColor={tag.color || "$gray10"}
                      paddingHorizontal="$2"
                      paddingVertical="$1"
                      borderRadius="$2"
                    >
                      <Text fontSize="$1" color="white">
                        {tag.name}
                      </Text>
                    </YStack>
                  ))}
                </XStack>
              )}

              <Button
                size="$4"
                backgroundColor="$green10"
                color="white"
                onPress={startConversation}
                icon={<Ionicons name="chatbubble" size={18} color="white" />}
              >
                Iniciar Conversa
              </Button>
            </YStack>
          </Card>

          {/* Stats Card */}
          <Card padding="$4" bordered>
            <XStack justifyContent="space-around">
              <YStack alignItems="center">
                <Text
                  fontSize="$7"
                  fontWeight="bold"
                  color={
                    contact.leadScore >= 70
                      ? "$green10"
                      : contact.leadScore >= 40
                      ? "$yellow10"
                      : "$gray10"
                  }
                >
                  {contact.leadScore}
                </Text>
                <Text fontSize="$2" color="$colorSubtle">
                  Lead Score
                </Text>
              </YStack>

              <YStack
                width={1}
                backgroundColor="$borderColor"
                marginVertical="$2"
              />

              <YStack alignItems="center">
                <Text fontSize="$7" fontWeight="bold" color="$blue10">
                  {contact.conversationCount}
                </Text>
                <Text fontSize="$2" color="$colorSubtle">
                  Conversas
                </Text>
              </YStack>

              <YStack
                width={1}
                backgroundColor="$borderColor"
                marginVertical="$2"
              />

              <YStack alignItems="center">
                <Text fontSize="$7" fontWeight="bold" color="$color">
                  {contact.lastInteractionAt
                    ? formatRelativeDate(contact.lastInteractionAt)
                    : "-"}
                </Text>
                <Text fontSize="$2" color="$colorSubtle">
                  Ultima Interacao
                </Text>
              </YStack>
            </XStack>
          </Card>

          {/* Funnel Stage */}
          {contact.funnel && contact.funnelStage && (
            <Card padding="$4" bordered>
              <YStack gap="$2">
                <Text fontWeight="600" color="$colorSubtle" fontSize="$2">
                  FUNIL DE VENDAS
                </Text>
                <XStack alignItems="center" gap="$2">
                  <YStack
                    width={12}
                    height={12}
                    borderRadius={6}
                    backgroundColor={contact.funnelStage.color || "$blue10"}
                  />
                  <Text fontWeight="600">{contact.funnelStage.name}</Text>
                  <Text color="$colorSubtle">em {contact.funnel.name}</Text>
                </XStack>
              </YStack>
            </Card>
          )}

          {/* Notes */}
          <Card padding="$4" bordered>
            <YStack gap="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontWeight="600" color="$colorSubtle" fontSize="$2">
                  NOTAS
                </Text>
                {!isEditing && (
                  <Pressable onPress={() => setIsEditing(true)}>
                    <Ionicons name="pencil" size={18} color="#666" />
                  </Pressable>
                )}
              </XStack>

              {isEditing ? (
                <YStack gap="$2">
                  <TextArea
                    value={editedNotes}
                    onChangeText={setEditedNotes}
                    placeholder="Adicione notas sobre este contato..."
                    numberOfLines={4}
                    size="$4"
                  />
                  <XStack gap="$2" justifyContent="flex-end">
                    <Button
                      size="$3"
                      variant="outlined"
                      onPress={() => {
                        setIsEditing(false);
                        setEditedNotes(contact.notes || "");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button size="$3" backgroundColor="$blue10" onPress={saveNotes}>
                      Salvar
                    </Button>
                  </XStack>
                </YStack>
              ) : (
                <Text color={contact.notes ? "$color" : "$colorSubtle"}>
                  {contact.notes || "Nenhuma nota adicionada"}
                </Text>
              )}
            </YStack>
          </Card>

          {/* Conversations History */}
          <Card padding="$4" bordered>
            <YStack gap="$3">
              <Text fontWeight="600" color="$colorSubtle" fontSize="$2">
                HISTORICO DE CONVERSAS
              </Text>

              {conversations.length === 0 ? (
                <Text color="$colorSubtle" textAlign="center" padding="$4">
                  Nenhuma conversa encontrada
                </Text>
              ) : (
                conversations.map((conv) => (
                  <Pressable
                    key={conv.id}
                    onPress={() => router.push(`/conversation/${conv.id}`)}
                  >
                    <XStack
                      padding="$3"
                      backgroundColor="$backgroundHover"
                      borderRadius="$3"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <YStack gap="$1">
                        <XStack alignItems="center" gap="$2">
                          <StatusBadge status={conv.status} />
                          {conv.intent && (
                            <Text fontSize="$2" color="$blue10">
                              {conv.intent}
                            </Text>
                          )}
                        </XStack>
                        <Text fontSize="$2" color="$colorSubtle">
                          {conv.messageCount} mensagens
                        </Text>
                      </YStack>
                      <YStack alignItems="flex-end">
                        <Text fontSize="$2" color="$colorSubtle">
                          {formatDate(conv.lastMessageAt)}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color="#999" />
                      </YStack>
                    </XStack>
                  </Pressable>
                ))
              )}
            </YStack>
          </Card>

          {/* Contact Info */}
          <Card padding="$4" bordered>
            <YStack gap="$3">
              <Text fontWeight="600" color="$colorSubtle" fontSize="$2">
                INFORMACOES
              </Text>

              <InfoRow
                icon="call"
                label="Telefone"
                value={contact.phone}
              />
              {contact.email && (
                <InfoRow
                  icon="mail"
                  label="Email"
                  value={contact.email}
                />
              )}
              {contact.company && (
                <InfoRow
                  icon="business"
                  label="Empresa"
                  value={contact.company}
                />
              )}
              <InfoRow
                icon="calendar"
                label="Cliente desde"
                value={formatDate(contact.createdAt)}
              />
            </YStack>
          </Card>
        </YStack>
      </ScrollView>
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <XStack alignItems="center" gap="$3">
      <YStack
        width={36}
        height={36}
        borderRadius={18}
        backgroundColor="$backgroundHover"
        alignItems="center"
        justifyContent="center"
      >
        <Ionicons name={icon as any} size={18} color="#666" />
      </YStack>
      <YStack>
        <Text fontSize="$2" color="$colorSubtle">
          {label}
        </Text>
        <Text fontWeight="500">{value}</Text>
      </YStack>
    </XStack>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    OPEN: { label: "Aberta", color: "$blue10" },
    WAITING_AGENT: { label: "Aguardando", color: "$yellow10" },
    WAITING_CLIENT: { label: "Aguardando Cliente", color: "$gray10" },
    IN_PROGRESS: { label: "Em Andamento", color: "$green10" },
    CLOSED: { label: "Fechada", color: "$gray10" },
    RESOLVED: { label: "Resolvida", color: "$green10" },
  };

  const { label, color } = config[status] || { label: status, color: "$gray10" };

  return (
    <YStack backgroundColor={color} paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
      <Text fontSize="$1" color="white" fontWeight="500">
        {label}
      </Text>
    </YStack>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem`;
  return `${Math.floor(diffDays / 30)}m`;
}
