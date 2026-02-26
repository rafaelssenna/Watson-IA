import { useEffect, useState, useCallback } from "react";
import {
  FlatList, RefreshControl, Pressable, ActivityIndicator,
  ScrollView as RNScrollView, Dimensions, Alert,
  ActionSheetIOS, Platform,
} from "react-native";
import { router, Stack } from "expo-router";
import { YStack, XStack, Text, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api } from "@/services/api";

const WATSON_TEAL = "#0d9488";
const SCREEN_WIDTH = Dimensions.get("window").width;
const COLUMN_WIDTH = SCREEN_WIDTH * 0.75;
const COLUMN_GAP = 12;

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface FunnelContact {
  id: string;
  name: string;
  phone: string;
  leadScore: number;
  tags: Tag[];
  lastInteractionAt?: string;
}

interface FunnelStageData {
  id: string;
  name: string;
  color: string;
  order: number;
  contacts: FunnelContact[];
  contactCount: number;
}

interface FunnelBoardData {
  funnel: { id: string; name: string } | null;
  stages: FunnelStageData[];
}

export default function FunilScreen() {
  const [boardData, setBoardData] = useState<FunnelBoardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const theme = useTheme();

  const fetchBoard = async () => {
    try {
      const res = await api.get<{ success: boolean; data: FunnelBoardData }>("/contacts/funnel-board");
      setBoardData(res.data.data);
    } catch (error) {
      console.error("Error fetching funnel board:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchBoard(); }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchBoard();
  }, []);

  const moveContact = async (contactId: string, newStageId: string) => {
    try {
      await api.patch(`/contacts/${contactId}/funnel`, { funnelStageId: newStageId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchBoard();
    } catch (error) {
      Alert.alert("Erro", "Nao foi possivel mover o contato");
    }
  };

  const showMoveOptions = (contact: FunnelContact, currentStageId: string) => {
    if (!boardData) return;

    const otherStages = boardData.stages.filter((s) => s.id !== currentStageId);
    const stageNames = otherStages.map((s) => s.name);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancelar", ...stageNames],
          cancelButtonIndex: 0,
          title: `Mover ${contact.name}`,
          message: "Selecione a nova etapa",
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            moveContact(contact.id, otherStages[buttonIndex - 1].id);
          }
        }
      );
    } else {
      Alert.alert(
        `Mover ${contact.name}`,
        "Selecione a nova etapa",
        [
          { text: "Cancelar", style: "cancel" },
          ...otherStages.map((stage) => ({
            text: stage.name,
            onPress: () => moveContact(contact.id, stage.id),
          })),
        ]
      );
    }
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
            <YStack>
              <Text fontSize={28} fontWeight="bold" color="$color">
                Funil
              </Text>
              {boardData?.funnel && (
                <Text fontSize={13} color="$gray8">
                  {boardData.funnel.name}
                </Text>
              )}
            </YStack>
            <Pressable onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={24} color={theme.color.val} />
            </Pressable>
          </XStack>
        </YStack>

        {/* Kanban Board */}
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 80,
            gap: COLUMN_GAP,
          }}
          decelerationRate="fast"
          snapToInterval={COLUMN_WIDTH + COLUMN_GAP}
          snapToAlignment="start"
        >
          {boardData?.stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              onContactPress={(c) => router.push(`/contact/${c.id}`)}
              onContactLongPress={(c) => showMoveOptions(c, stage.id)}
              isRefreshing={isRefreshing}
              onRefresh={onRefresh}
            />
          ))}
        </RNScrollView>
      </YStack>
    </>
  );
}

function KanbanColumn({
  stage,
  onContactPress,
  onContactLongPress,
  isRefreshing,
  onRefresh,
}: {
  stage: FunnelStageData;
  onContactPress: (c: FunnelContact) => void;
  onContactLongPress: (c: FunnelContact) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <YStack
      width={COLUMN_WIDTH}
      backgroundColor="$backgroundStrong"
      borderRadius={12}
      overflow="hidden"
    >
      {/* Column Header */}
      <XStack
        paddingHorizontal="$3"
        paddingVertical="$3"
        alignItems="center"
        gap="$2"
        borderBottomWidth={3}
        borderBottomColor={stage.color}
      >
        <YStack
          width={10}
          height={10}
          borderRadius={5}
          backgroundColor={stage.color}
        />
        <Text fontWeight="600" color="$color" flex={1} numberOfLines={1}>
          {stage.name}
        </Text>
        <YStack
          backgroundColor={`${stage.color}25`}
          paddingHorizontal={8}
          paddingVertical={2}
          borderRadius={10}
        >
          <Text fontSize={12} fontWeight="600" color={stage.color}>
            {stage.contactCount}
          </Text>
        </YStack>
      </XStack>

      {/* Contact Cards */}
      <FlatList
        data={stage.contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 8, gap: 8 }}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={WATSON_TEAL}
          />
        }
        renderItem={({ item }) => (
          <ContactCard
            contact={item}
            stageColor={stage.color}
            onPress={() => onContactPress(item)}
            onLongPress={() => onContactLongPress(item)}
          />
        )}
        ListEmptyComponent={
          <YStack alignItems="center" padding="$4">
            <Text fontSize={12} color="$gray8">
              Nenhum contato
            </Text>
          </YStack>
        }
      />
    </YStack>
  );
}

function ContactCard({
  contact,
  stageColor,
  onPress,
  onLongPress,
}: {
  contact: FunnelContact;
  stageColor: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      <YStack
        backgroundColor="$background"
        padding="$3"
        borderRadius={8}
        borderLeftWidth={3}
        borderLeftColor={stageColor}
        gap="$1"
      >
        {/* Name + Score */}
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontWeight="600" color="$color" fontSize={14} numberOfLines={1} flex={1}>
            {contact.name}
          </Text>
          {contact.leadScore > 0 && (
            <YStack
              backgroundColor={getScoreColor(contact.leadScore)}
              width={22}
              height={22}
              borderRadius={11}
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={10} color="white" fontWeight="bold">
                {contact.leadScore}
              </Text>
            </YStack>
          )}
        </XStack>

        {/* Tags (max 2) */}
        {contact.tags.length > 0 && (
          <XStack gap={4} flexWrap="wrap">
            {contact.tags.slice(0, 2).map((tag) => (
              <XStack
                key={tag.id}
                backgroundColor={`${tag.color}20`}
                paddingHorizontal={5}
                paddingVertical={1}
                borderRadius={3}
              >
                <Text fontSize={10} color={tag.color} fontWeight="500">
                  {tag.name}
                </Text>
              </XStack>
            ))}
            {contact.tags.length > 2 && (
              <Text fontSize={10} color="$gray8">+{contact.tags.length - 2}</Text>
            )}
          </XStack>
        )}

        {/* Last interaction */}
        {contact.lastInteractionAt && (
          <Text fontSize={11} color="$gray8">
            {formatDate(contact.lastInteractionAt)}
          </Text>
        )}
      </YStack>
    </Pressable>
  );
}

function getScoreColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#6b7280";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays}d atras`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
