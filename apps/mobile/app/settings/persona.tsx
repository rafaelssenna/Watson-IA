import { useEffect, useState } from "react";
import { Pressable, Alert, ActivityIndicator } from "react-native";
import { router, Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { usePersonaStore, type Persona } from "@/stores/personaStore";

export default function PersonaListScreen() {
  const theme = useTheme();
  const { personas, isLoading, error, fetchPersonas, deletePersona } = usePersonaStore();
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchPersonas();
  }, []);

  const handleDelete = (persona: Persona) => {
    if (persona.isDefault) {
      Alert.alert("Erro", "Nao e possivel deletar a persona padrao");
      return;
    }

    Alert.alert(
      "Deletar Persona",
      `Deseja realmente deletar "${persona.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          style: "destructive",
          onPress: async () => {
            setDeleting(persona.id);
            try {
              await deletePersona(persona.id);
            } catch {
              Alert.alert("Erro", "Nao foi possivel deletar a persona");
            }
            setDeleting(null);
          },
        },
      ]
    );
  };

  const getLevelLabel = (level: number): string => {
    if (level > 70) return "Alto";
    if (level > 40) return "Medio";
    return "Baixo";
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Personas",
          headerRight: () => (
            <Pressable onPress={() => router.push("/settings/persona-edit")}>
              <Ionicons name="add" size={28} color={theme.blue10.val} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <YStack gap="$3">
          <Text color="$gray8" fontSize="$3" marginBottom="$2">
            Configure as personalidades da IA que responde suas mensagens
          </Text>

          {isLoading && personas.length === 0 ? (
            <YStack alignItems="center" padding="$6">
              <ActivityIndicator size="large" color={theme.blue10.val} />
              <Text color="$gray8" marginTop="$3">Carregando personas...</Text>
            </YStack>
          ) : error ? (
            <Card padding="$4" backgroundColor="$red5" borderRadius="$4">
              <Text color="$red10">{error}</Text>
              <Pressable onPress={fetchPersonas}>
                <Text color="$blue10" marginTop="$2">Tentar novamente</Text>
              </Pressable>
            </Card>
          ) : personas.length === 0 ? (
            <Card padding="$6" backgroundColor="$backgroundStrong" borderRadius="$4" alignItems="center">
              <Ionicons name="person-circle-outline" size={48} color={theme.gray7.val} />
              <Text color="$gray8" marginTop="$3" textAlign="center">
                Nenhuma persona configurada
              </Text>
              <Pressable onPress={() => router.push("/settings/persona-edit")}>
                <XStack
                  backgroundColor="$blue10"
                  paddingHorizontal="$4"
                  paddingVertical="$2"
                  borderRadius="$3"
                  marginTop="$4"
                  gap="$2"
                  alignItems="center"
                >
                  <Ionicons name="add" size={20} color="white" />
                  <Text color="white" fontWeight="600">Criar Persona</Text>
                </XStack>
              </Pressable>
            </Card>
          ) : (
            personas.map((persona) => (
              <Pressable
                key={persona.id}
                onPress={() => router.push(`/settings/persona-edit?id=${persona.id}`)}
              >
                <Card
                  padding="$4"
                  backgroundColor="$backgroundStrong"
                  borderRadius="$4"
                  borderWidth={persona.isDefault ? 2 : 0}
                  borderColor={persona.isDefault ? "$blue10" : "transparent"}
                >
                  <XStack justifyContent="space-between" alignItems="flex-start">
                    <YStack flex={1}>
                      <XStack alignItems="center" gap="$2">
                        <Text fontSize="$5" fontWeight="bold" color="$color">
                          {persona.name}
                        </Text>
                        {persona.isDefault && (
                          <YStack
                            backgroundColor="$blue10"
                            paddingHorizontal="$2"
                            paddingVertical={2}
                            borderRadius="$2"
                          >
                            <Text fontSize={10} color="white" fontWeight="600">
                              PADRAO
                            </Text>
                          </YStack>
                        )}
                      </XStack>

                      <XStack marginTop="$3" gap="$4" flexWrap="wrap">
                        <YStack>
                          <Text fontSize="$2" color="$gray8">Formalidade</Text>
                          <Text fontSize="$3" color="$color" fontWeight="500">
                            {getLevelLabel(persona.formalityLevel)}
                          </Text>
                        </YStack>
                        <YStack>
                          <Text fontSize="$2" color="$gray8">Persuasao</Text>
                          <Text fontSize="$3" color="$color" fontWeight="500">
                            {getLevelLabel(persona.persuasiveness)}
                          </Text>
                        </YStack>
                        <YStack>
                          <Text fontSize="$2" color="$gray8">Energia</Text>
                          <Text fontSize="$3" color="$color" fontWeight="500">
                            {getLevelLabel(persona.energyLevel)}
                          </Text>
                        </YStack>
                        <YStack>
                          <Text fontSize="$2" color="$gray8">Empatia</Text>
                          <Text fontSize="$3" color="$color" fontWeight="500">
                            {getLevelLabel(persona.empathyLevel)}
                          </Text>
                        </YStack>
                      </XStack>

                      {persona.customInstructions && (
                        <Text
                          fontSize="$2"
                          color="$gray8"
                          marginTop="$3"
                          numberOfLines={2}
                        >
                          {persona.customInstructions}
                        </Text>
                      )}
                    </YStack>

                    <XStack gap="$2">
                      {!persona.isDefault && (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(persona);
                          }}
                        >
                          {deleting === persona.id ? (
                            <ActivityIndicator size="small" color={theme.red10.val} />
                          ) : (
                            <Ionicons name="trash-outline" size={22} color={theme.red10.val} />
                          )}
                        </Pressable>
                      )}
                      <Ionicons name="chevron-forward" size={22} color={theme.gray7.val} />
                    </XStack>
                  </XStack>
                </Card>
              </Pressable>
            ))
          )}
        </YStack>
      </ScrollView>
    </>
  );
}
