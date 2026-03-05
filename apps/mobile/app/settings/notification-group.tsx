import { useState, useEffect } from "react";
import { ScrollView, Pressable, Alert } from "react-native";
import { Stack } from "expo-router";
import { YStack, XStack, Text, Card, Spinner, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";

interface WhatsAppGroup {
  id: string;
  name: string;
  picture: string | null;
}

export default function NotificationGroupScreen() {
  const { primary } = useAppColors();
  const theme = useTheme();
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError("");

    try {
      // Load current setting and groups in parallel
      const [meResponse, groupsResponse] = await Promise.all([
        api.get<{ success: boolean; data: any }>("/auth/me"),
        api.get<{ success: boolean; data: WhatsAppGroup[] }>("/whatsapp/groups"),
      ]);

      if (meResponse.data.success) {
        setSelectedGroupId(meResponse.data.data.notificationGroupId || null);
      }

      if (groupsResponse.data.success) {
        setGroups(groupsResponse.data.data);
        // Set name from groups list
        if (meResponse.data.data.notificationGroupId) {
          const current = groupsResponse.data.data.find(
            (g) => g.id === meResponse.data.data.notificationGroupId
          );
          setSelectedGroupName(current?.name || null);
        }
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar grupos");
    } finally {
      setIsLoading(false);
    }
  };

  const selectGroup = async (group: WhatsAppGroup | null) => {
    setIsSaving(true);
    try {
      await api.patch("/auth/notification-group", {
        notificationGroupId: group?.id || null,
        notificationGroupName: group?.name || null,
      });

      setSelectedGroupId(group?.id || null);
      setSelectedGroupName(group?.name || null);

      Alert.alert(
        "Salvo",
        group
          ? `Notificacoes serao enviadas para "${group.name}"`
          : "Notificacoes de grupo desativadas"
      );
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Grupo de Notificacoes" }} />
        <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
          <Spinner size="large" color={primary} />
          <Text color="$gray8" marginTop="$3">Carregando grupos...</Text>
        </YStack>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Grupo de Notificacoes" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <YStack gap="$4">
          {/* Info card */}
          <Card backgroundColor="$backgroundStrong" padding="$4" borderRadius="$4">
            <XStack gap="$3" alignItems="flex-start">
              <Ionicons name="information-circle-outline" size={24} color={primary} />
              <YStack flex={1}>
                <Text color="$color" fontWeight="600" fontSize="$4">
                  Como funciona?
                </Text>
                <Text color="$gray8" fontSize="$3" marginTop="$1">
                  Quando a IA transferir um atendimento ou um negocio for fechado, a notificacao sera enviada tambem para o grupo selecionado.
                </Text>
              </YStack>
            </XStack>
          </Card>

          {error ? (
            <Card backgroundColor="$red5" padding="$4" borderRadius="$4">
              <Text color="$red10" textAlign="center">{error}</Text>
            </Card>
          ) : null}

          {/* Current selection */}
          {selectedGroupId && (
            <Card backgroundColor="$backgroundStrong" padding="$4" borderRadius="$4">
              <XStack alignItems="center" gap="$3">
                <YStack
                  width={44}
                  height={44}
                  borderRadius={22}
                  backgroundColor={primary}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Ionicons name="people" size={22} color="white" />
                </YStack>
                <YStack flex={1}>
                  <Text fontSize="$2" color="$gray8">Grupo atual</Text>
                  <Text fontSize="$4" fontWeight="600" color="$color">
                    {selectedGroupName || "Grupo selecionado"}
                  </Text>
                </YStack>
                <Pressable onPress={() => selectGroup(null)} disabled={isSaving}>
                  <YStack
                    padding="$2"
                    borderRadius="$2"
                    backgroundColor="$red5"
                  >
                    <Ionicons name="close" size={18} color="#ef4444" />
                  </YStack>
                </Pressable>
              </XStack>
            </Card>
          )}

          {/* Groups list */}
          <YStack>
            <Text fontSize="$3" fontWeight="600" marginBottom="$3" color="$gray8" letterSpacing={1}>
              SELECIONE UM GRUPO
            </Text>

            {groups.length === 0 ? (
              <Card backgroundColor="$backgroundStrong" padding="$6" borderRadius="$4">
                <YStack alignItems="center" gap="$2">
                  <Ionicons name="people-outline" size={40} color={theme.gray7.val} />
                  <Text color="$gray8" textAlign="center">
                    Nenhum grupo encontrado. Verifique se o WhatsApp esta conectado e se voce participa de algum grupo.
                  </Text>
                </YStack>
              </Card>
            ) : (
              <Card backgroundColor="$backgroundStrong" borderRadius="$4" overflow="hidden">
                {groups.map((group, index) => {
                  const isSelected = group.id === selectedGroupId;
                  return (
                    <Pressable
                      key={group.id}
                      onPress={() => selectGroup(group)}
                      disabled={isSaving}
                    >
                      <XStack
                        padding="$4"
                        alignItems="center"
                        gap="$3"
                        backgroundColor={isSelected ? "$green5" : "transparent"}
                        borderBottomWidth={index < groups.length - 1 ? 1 : 0}
                        borderBottomColor="$gray6"
                      >
                        <YStack
                          width={44}
                          height={44}
                          borderRadius={22}
                          backgroundColor={isSelected ? "$green10" : "$gray5"}
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Ionicons
                            name={isSelected ? "checkmark" : "people-outline"}
                            size={22}
                            color={isSelected ? "white" : theme.gray8.val}
                          />
                        </YStack>
                        <YStack flex={1}>
                          <Text
                            fontWeight={isSelected ? "700" : "500"}
                            color="$color"
                            fontSize="$4"
                          >
                            {group.name}
                          </Text>
                        </YStack>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                        )}
                      </XStack>
                    </Pressable>
                  );
                })}
              </Card>
            )}
          </YStack>

          {isSaving && (
            <XStack alignItems="center" justifyContent="center" gap="$2" marginTop="$2">
              <Spinner size="small" color={primary} />
              <Text color="$gray8">Salvando...</Text>
            </XStack>
          )}
        </YStack>
      </ScrollView>
    </>
  );
}
