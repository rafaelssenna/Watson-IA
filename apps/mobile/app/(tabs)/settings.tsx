import { Pressable } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Card, Separator } from "tamagui";
import { ScrollView } from "react-native";
import { useAuthStore } from "@/stores/authStore";

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <YStack gap="$4">
        {/* User Card */}
        <Card padding="$4" bordered>
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
              <Text fontSize="$5" fontWeight="bold">{user?.name}</Text>
              <Text color="$colorSubtle">{user?.email}</Text>
              <Text fontSize="$2" color="$blue10" marginTop="$1">
                {user?.organizationName}
              </Text>
            </YStack>
          </XStack>
        </Card>

        {/* Watson Configuration */}
        <YStack>
          <Text fontSize="$4" fontWeight="600" marginBottom="$3" color="$colorSubtle">
            CONFIGURACOES DO WATSON
          </Text>
          <Card bordered>
            <SettingsItem
              icon="📚"
              title="Base de Conhecimento"
              description="PDFs, FAQs e informacoes da empresa"
              onPress={() => router.push("/settings/knowledge")}
            />
            <Separator />
            <SettingsItem
              icon="🎭"
              title="Persona"
              description="Configure a personalidade do Watson"
              onPress={() => router.push("/settings/persona")}
            />
            <Separator />
            <SettingsItem
              icon="⚡"
              title="Triggers"
              description="Gatilhos inteligentes"
              onPress={() => router.push("/settings/triggers")}
            />
            <Separator />
            <SettingsItem
              icon="🔄"
              title="Automacoes"
              description="Follow-ups e mensagens programadas"
              onPress={() => router.push("/settings/automations")}
            />
          </Card>
        </YStack>

        {/* WhatsApp */}
        <YStack>
          <Text fontSize="$4" fontWeight="600" marginBottom="$3" color="$colorSubtle">
            WHATSAPP
          </Text>
          <Card bordered>
            <SettingsItem
              icon="📱"
              title="Conexao WhatsApp"
              description="Status e configuracoes da conexao"
              badge="Conectado"
              badgeColor="$green10"
              onPress={() => router.push("/settings/whatsapp")}
            />
          </Card>
        </YStack>

        {/* CRM */}
        <YStack>
          <Text fontSize="$4" fontWeight="600" marginBottom="$3" color="$colorSubtle">
            CRM
          </Text>
          <Card bordered>
            <SettingsItem
              icon="🏷️"
              title="Tags"
              description="Gerenciar tags de contatos"
              onPress={() => router.push("/settings/tags")}
            />
            <Separator />
            <SettingsItem
              icon="📊"
              title="Funil de Vendas"
              description="Configurar etapas do funil"
              onPress={() => router.push("/settings/funnel")}
            />
          </Card>
        </YStack>

        {/* Account */}
        <YStack>
          <Text fontSize="$4" fontWeight="600" marginBottom="$3" color="$colorSubtle">
            CONTA
          </Text>
          <Card bordered>
            <SettingsItem
              icon="💳"
              title="Assinatura"
              description="Gerenciar plano e pagamento"
              badge="Trial"
              badgeColor="$yellow10"
              onPress={() => router.push("/settings/billing")}
            />
            <Separator />
            <SettingsItem
              icon="👥"
              title="Equipe"
              description="Gerenciar membros da equipe"
              onPress={() => router.push("/settings/team")}
            />
            <Separator />
            <SettingsItem
              icon="🔔"
              title="Notificacoes"
              description="Preferencias de notificacao"
              onPress={() => router.push("/settings/notifications")}
            />
          </Card>
        </YStack>

        {/* Danger Zone */}
        <YStack marginTop="$4">
          <Pressable onPress={handleLogout}>
            <Card
              padding="$4"
              bordered
              borderColor="$red10"
              pressStyle={{ opacity: 0.8 }}
            >
              <XStack alignItems="center" justifyContent="center" gap="$2">
                <Text>🚪</Text>
                <Text color="$red10" fontWeight="600">Sair da Conta</Text>
              </XStack>
            </Card>
          </Pressable>
        </YStack>

        {/* Version */}
        <Text textAlign="center" color="$colorSubtle" fontSize="$2" marginTop="$4">
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
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <XStack padding="$4" alignItems="center" gap="$3" pressStyle={{ opacity: 0.8 }}>
        <Text fontSize={24}>{icon}</Text>
        <YStack flex={1}>
          <XStack alignItems="center" gap="$2">
            <Text fontWeight="600">{title}</Text>
            {badge && (
              <YStack
                backgroundColor={badgeColor || "$blue10"}
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
              >
                <Text fontSize="$1" color="white">{badge}</Text>
              </YStack>
            )}
          </XStack>
          <Text fontSize="$2" color="$colorSubtle">{description}</Text>
        </YStack>
        <Text color="$colorSubtle">›</Text>
      </XStack>
    </Pressable>
  );
}
