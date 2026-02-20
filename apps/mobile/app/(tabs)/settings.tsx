import { Pressable } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Card, Separator, useTheme } from "tamagui";
import { ScrollView } from "react-native";
import { useAuthStore } from "@/stores/authStore";

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const theme = useTheme();

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <YStack gap="$4">
        {/* User Card */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <XStack gap="$4" alignItems="center">
            <YStack
              width={60}
              height={60}
              borderRadius={30}
              backgroundColor="$blue10"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="white" fontSize="$7" fontWeight="bold">
                {user?.name?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </YStack>
            <YStack flex={1}>
              <Text fontSize="$5" fontWeight="bold" color="$color">{user?.name}</Text>
              <Text color="$gray8" fontSize="$3">{user?.email}</Text>
              <Text fontSize="$2" color="$blue10" marginTop="$1">
                {user?.organizationName}
              </Text>
            </YStack>
          </XStack>
        </Card>

        {/* Watson Configuration */}
        <YStack>
          <Text fontSize="$3" fontWeight="600" marginBottom="$3" color="$gray8" letterSpacing={1}>
            CONFIGURACOES DO WATSON
          </Text>
          <Card backgroundColor="$backgroundStrong" borderRadius="$4" overflow="hidden">
            <SettingsItem
              icon="📚"
              title="Base de Conhecimento"
              description="PDFs, FAQs e informacoes da empresa"
            />
            <Separator backgroundColor="$gray6" />
            <SettingsItem
              icon="🎭"
              title="Persona"
              description="Configure a personalidade do Watson"
            />
            <Separator backgroundColor="$gray6" />
            <SettingsItem
              icon="⚡"
              title="Triggers"
              description="Gatilhos inteligentes"
            />
            <Separator backgroundColor="$gray6" />
            <SettingsItem
              icon="🔄"
              title="Automacoes"
              description="Follow-ups e mensagens programadas"
            />
          </Card>
        </YStack>

        {/* WhatsApp */}
        <YStack>
          <Text fontSize="$3" fontWeight="600" marginBottom="$3" color="$gray8" letterSpacing={1}>
            WHATSAPP
          </Text>
          <Card backgroundColor="$backgroundStrong" borderRadius="$4" overflow="hidden">
            <SettingsItem
              icon="📱"
              title="Conexao WhatsApp"
              description="Status e configuracoes da conexao"
              badge="Conectado"
              badgeColor="$green10"
            />
          </Card>
        </YStack>

        {/* CRM */}
        <YStack>
          <Text fontSize="$3" fontWeight="600" marginBottom="$3" color="$gray8" letterSpacing={1}>
            CRM
          </Text>
          <Card backgroundColor="$backgroundStrong" borderRadius="$4" overflow="hidden">
            <SettingsItem
              icon="🏷️"
              title="Tags"
              description="Gerenciar tags de contatos"
            />
            <Separator backgroundColor="$gray6" />
            <SettingsItem
              icon="📊"
              title="Funil de Vendas"
              description="Configurar etapas do funil"
            />
          </Card>
        </YStack>

        {/* Account */}
        <YStack>
          <Text fontSize="$3" fontWeight="600" marginBottom="$3" color="$gray8" letterSpacing={1}>
            CONTA
          </Text>
          <Card backgroundColor="$backgroundStrong" borderRadius="$4" overflow="hidden">
            <SettingsItem
              icon="💳"
              title="Assinatura"
              description="Gerenciar plano e pagamento"
              badge="Trial"
              badgeColor="$yellow10"
            />
            <Separator backgroundColor="$gray6" />
            <SettingsItem
              icon="👥"
              title="Equipe"
              description="Gerenciar membros da equipe"
            />
            <Separator backgroundColor="$gray6" />
            <SettingsItem
              icon="🔔"
              title="Notificacoes"
              description="Preferencias de notificacao"
            />
          </Card>
        </YStack>

        {/* Danger Zone */}
        <YStack marginTop="$2">
          <Pressable onPress={handleLogout}>
            <Card
              padding="$4"
              backgroundColor="$red5"
              borderRadius="$4"
            >
              <XStack alignItems="center" justifyContent="center" gap="$2">
                <Text fontSize={18}>🚪</Text>
                <Text color="$red10" fontWeight="600" fontSize="$4">Sair da Conta</Text>
              </XStack>
            </Card>
          </Pressable>
        </YStack>

        {/* Version */}
        <Text textAlign="center" color="$gray8" fontSize="$2" marginTop="$4">
          Watson AI v1.0.0
        </Text>
      </YStack>
    </ScrollView>
  );
}

function SettingsItem({
  icon,
  title,
  description,
  badge,
  badgeColor,
}: {
  icon: string;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <Pressable>
      <XStack padding="$4" alignItems="center" gap="$3">
        <Text fontSize={24}>{icon}</Text>
        <YStack flex={1}>
          <XStack alignItems="center" gap="$2">
            <Text fontWeight="600" color="$color" fontSize="$4">{title}</Text>
            {badge && (
              <YStack
                backgroundColor={badgeColor || "$blue10"}
                paddingHorizontal="$2"
                paddingVertical={2}
                borderRadius="$2"
              >
                <Text fontSize={10} color="white" fontWeight="600">{badge}</Text>
              </YStack>
            )}
          </XStack>
          <Text fontSize="$2" color="$gray8" marginTop={2}>{description}</Text>
        </YStack>
        <Text color="$gray7" fontSize="$5">›</Text>
      </XStack>
    </Pressable>
  );
}
