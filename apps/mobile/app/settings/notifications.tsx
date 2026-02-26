import { useEffect, useState } from "react";
import { Alert, ActivityIndicator, TextInput, Pressable } from "react-native";
import { Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

const WATSON_TEAL = "#0d9488";

export default function NotificationsScreen() {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadNotificationPhone();
  }, []);

  const loadNotificationPhone = async () => {
    try {
      const res = await api.get<{ success: boolean; data: { notificationPhone?: string } }>("/auth/me");
      if (res.data.success && res.data.data.notificationPhone) {
        setPhone(res.data.data.notificationPhone);
      }
    } catch (error) {
      console.error("Error loading notification phone:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      await api.patch("/auth/notification-phone", { notificationPhone: phone.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      Alert.alert("Erro", "Nao foi possivel salvar o numero");
    } finally {
      setIsSaving(false);
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
      <Stack.Screen options={{ title: "Notificacoes" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <YStack gap="$4">
          {/* Notification Phone Card */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack alignItems="center" gap="$2" marginBottom="$3">
              <Ionicons name="call-outline" size={22} color={WATSON_TEAL} />
              <YStack>
                <Text fontSize="$4" fontWeight="700" color="$color">
                  Numero para Avisos
                </Text>
                <Text fontSize="$2" color="$gray8">
                  Receba avisos do funil por WhatsApp
                </Text>
              </YStack>
            </XStack>

            <Text fontSize="$3" color="$gray8" marginBottom="$2">
              Numero com DDD (ex: 11999998888)
            </Text>

            <XStack gap="$2" alignItems="center">
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="11999998888"
                placeholderTextColor={theme.gray7.val}
                keyboardType="phone-pad"
                style={{
                  flex: 1,
                  backgroundColor: theme.background.val,
                  color: theme.color.val,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: theme.gray6.val,
                }}
              />
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                style={{
                  backgroundColor: WATSON_TEAL,
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text color="white" fontWeight="600">Salvar</Text>
                )}
              </Pressable>
            </XStack>

            {saved && (
              <XStack alignItems="center" gap="$1" marginTop="$2">
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text fontSize="$2" color="#10b981">Numero salvo!</Text>
              </XStack>
            )}
          </Card>

          {/* Info Card */}
          <Card padding="$4" backgroundColor="$teal5" borderRadius="$4">
            <XStack gap="$3" alignItems="flex-start">
              <Ionicons name="information-circle-outline" size={24} color={WATSON_TEAL} />
              <YStack flex={1}>
                <Text color={WATSON_TEAL} fontWeight="600" fontSize="$4">
                  Como funciona?
                </Text>
                <Text color="$color" marginTop="$2" fontSize="$3">
                  Quando a IA detectar que um cliente fechou negocio (ganho ou perdido), voce recebe um aviso nesse numero por WhatsApp. Tambem recebe uma notificacao push no celular.
                </Text>
                <Text color="$gray8" marginTop="$2" fontSize="$2">
                  Se nao configurar um numero, o aviso vai pro numero do WhatsApp conectado.
                </Text>
              </YStack>
            </XStack>
          </Card>
        </YStack>
      </ScrollView>
    </>
  );
}
