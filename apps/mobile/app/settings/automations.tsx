import { useEffect, useState } from "react";
import { Pressable, Alert, ActivityIndicator, TextInput, Switch } from "react-native";
import { Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

// Watson IA brand colors
const WATSON_TEAL = "#0d9488";

interface Automation {
  id: string;
  name: string;
  description?: string;
  type: string;
  isActive: boolean;
  triggerDelayHours?: number;
  messageTemplate?: string;
  useAI: boolean;
  maxExecutionsPerConversation: number;
  respectBusinessHours: boolean;
  onlyWhenWaitingClient: boolean;
  timesExecuted: number;
  lastExecutedAt?: string;
}

export default function AutomationsScreen() {
  const theme = useTheme();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for creating/editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [triggerDelayHours, setTriggerDelayHours] = useState("24");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [useAI, setUseAI] = useState(false);
  const [maxExecutions, setMaxExecutions] = useState("1");
  const [respectBusinessHours, setRespectBusinessHours] = useState(true);

  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = async () => {
    try {
      const response = await api.get<{ success: boolean; data: Automation[] }>("/automations");
      setAutomations(response.data.data);
    } catch (error) {
      console.error("Error loading automations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setTriggerDelayHours("24");
    setMessageTemplate("");
    setUseAI(false);
    setMaxExecutions("1");
    setRespectBusinessHours(true);
    setShowCreateForm(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Erro", "Nome da automacao e obrigatorio");
      return;
    }

    setSaving(true);

    const data = {
      name: name.trim(),
      type: "FOLLOW_UP_INACTIVITY",
      triggerDelayHours: parseInt(triggerDelayHours) || 24,
      messageTemplate: messageTemplate.trim() || undefined,
      useAI,
      maxExecutionsPerConversation: parseInt(maxExecutions) || 1,
      respectBusinessHours,
      onlyWhenWaitingClient: true,
      isActive: true,
    };

    try {
      if (editingId) {
        await api.patch(`/automations/${editingId}`, data);
        Alert.alert("Sucesso", "Automacao atualizada");
      } else {
        await api.post("/automations", data);
        Alert.alert("Sucesso", "Automacao criada");
      }
      resetForm();
      loadAutomations();
    } catch (error: any) {
      Alert.alert("Erro", error.response?.data?.error?.message || "Erro ao salvar automacao");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (automation: Automation) => {
    try {
      await api.post(`/automations/${automation.id}/toggle`);
      loadAutomations();
    } catch (error) {
      Alert.alert("Erro", "Erro ao alternar automacao");
    }
  };

  const handleDelete = (automation: Automation) => {
    Alert.alert(
      "Confirmar",
      `Excluir automacao "${automation.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/automations/${automation.id}`);
              loadAutomations();
            } catch (error) {
              Alert.alert("Erro", "Erro ao excluir automacao");
            }
          },
        },
      ]
    );
  };

  const handleEdit = (automation: Automation) => {
    setEditingId(automation.id);
    setName(automation.name);
    setTriggerDelayHours(String(automation.triggerDelayHours || 24));
    setMessageTemplate(automation.messageTemplate || "");
    setUseAI(automation.useAI);
    setMaxExecutions(String(automation.maxExecutionsPerConversation));
    setRespectBusinessHours(automation.respectBusinessHours);
    setShowCreateForm(true);
  };

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={WATSON_TEAL} />
        <Text color="$gray8" marginTop="$3">Carregando...</Text>
      </YStack>
    );
  }

  // Show form
  if (showCreateForm) {
    return (
      <>
        <Stack.Screen
          options={{
            title: editingId ? "Editar Follow-up" : "Novo Follow-up",
            headerRight: () => (
              <Pressable onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={WATSON_TEAL} />
                ) : (
                  <Text color="$blue10" fontWeight="600" fontSize="$4">Salvar</Text>
                )}
              </Pressable>
            ),
            headerLeft: () => (
              <Pressable onPress={resetForm}>
                <Text color="$gray8" fontSize="$4">Cancelar</Text>
              </Pressable>
            ),
          }}
        />
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.background.val }}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <YStack gap="$4">
            {/* Name */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
                Nome da Automacao
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex: Follow-up 24h"
                placeholderTextColor={theme.gray8.val}
                style={{
                  backgroundColor: theme.background.val,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  color: theme.color.val,
                }}
              />
            </Card>

            {/* Delay */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <XStack alignItems="center" gap="$2" marginBottom="$2">
                <Ionicons name="time-outline" size={20} color={WATSON_TEAL} />
                <Text fontSize="$3" fontWeight="600" color="$color">
                  Tempo de Inatividade
                </Text>
              </XStack>
              <Text fontSize="$2" color="$gray8" marginBottom="$3">
                Enviar follow-up apos quantas horas sem resposta do cliente?
              </Text>
              <XStack alignItems="center" gap="$3">
                <TextInput
                  value={triggerDelayHours}
                  onChangeText={setTriggerDelayHours}
                  placeholder="24"
                  placeholderTextColor={theme.gray8.val}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: theme.background.val,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 20,
                    color: theme.color.val,
                    textAlign: "center",
                    width: 80,
                  }}
                />
                <Text color="$gray8" fontSize="$4">horas</Text>
              </XStack>
            </Card>

            {/* Message */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
                <Text fontSize="$3" fontWeight="600" color="$color">
                  Mensagem
                </Text>
                <XStack alignItems="center" gap="$2">
                  <Text fontSize="$2" color="$gray8">Usar IA</Text>
                  <Switch
                    value={useAI}
                    onValueChange={setUseAI}
                    trackColor={{ false: theme.gray6.val, true: WATSON_TEAL }}
                  />
                </XStack>
              </XStack>

              {useAI ? (
                <Card padding="$3" backgroundColor="$teal5" borderRadius="$3">
                  <XStack alignItems="center" gap="$2">
                    <Ionicons name="sparkles" size={18} color={WATSON_TEAL} />
                    <Text color={WATSON_TEAL} fontSize="$3" flex={1}>
                      O Watson vai gerar uma mensagem personalizada baseada no contexto da conversa
                    </Text>
                  </XStack>
                </Card>
              ) : (
                <>
                  <Text fontSize="$2" color="$gray8" marginBottom="$2">
                    Use {"{{nome}}"} para inserir o nome do cliente
                  </Text>
                  <TextInput
                    value={messageTemplate}
                    onChangeText={setMessageTemplate}
                    placeholder="Oi {{nome}}! Vi que não conseguimos finalizar nossa conversa..."
                    placeholderTextColor={theme.gray8.val}
                    multiline
                    numberOfLines={4}
                    style={{
                      backgroundColor: theme.background.val,
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      color: theme.color.val,
                      minHeight: 100,
                      textAlignVertical: "top",
                    }}
                  />
                </>
              )}
            </Card>

            {/* Settings */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$3">
                Configuracoes
              </Text>

              <YStack gap="$4">
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack flex={1}>
                    <Text color="$color" fontSize="$3">Maximo de follow-ups</Text>
                    <Text color="$gray8" fontSize="$2">Por conversa</Text>
                  </YStack>
                  <XStack alignItems="center" gap="$2">
                    <Pressable onPress={() => setMaxExecutions(String(Math.max(1, parseInt(maxExecutions) - 1)))}>
                      <YStack
                        width={36}
                        height={36}
                        borderRadius={18}
                        backgroundColor="$gray5"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Ionicons name="remove" size={20} color={theme.color.val} />
                      </YStack>
                    </Pressable>
                    <Text fontSize="$5" fontWeight="600" color="$color" width={30} textAlign="center">
                      {maxExecutions}
                    </Text>
                    <Pressable onPress={() => setMaxExecutions(String(parseInt(maxExecutions) + 1))}>
                      <YStack
                        width={36}
                        height={36}
                        borderRadius={18}
                        backgroundColor={WATSON_TEAL}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Ionicons name="add" size={20} color="white" />
                      </YStack>
                    </Pressable>
                  </XStack>
                </XStack>

                <XStack justifyContent="space-between" alignItems="center">
                  <YStack flex={1}>
                    <Text color="$color" fontSize="$3">Respeitar horario comercial</Text>
                    <Text color="$gray8" fontSize="$2">So envia durante o expediente</Text>
                  </YStack>
                  <Switch
                    value={respectBusinessHours}
                    onValueChange={setRespectBusinessHours}
                    trackColor={{ false: theme.gray6.val, true: WATSON_TEAL }}
                  />
                </XStack>
              </YStack>
            </Card>
          </YStack>
        </ScrollView>
      </>
    );
  }

  // Show list
  return (
    <>
      <Stack.Screen
        options={{
          title: "Automacoes",
          headerRight: () => (
            <Pressable onPress={() => setShowCreateForm(true)}>
              <Ionicons name="add-circle" size={28} color={WATSON_TEAL} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <YStack gap="$4">
          {/* Info Card */}
          <Card padding="$4" backgroundColor="$teal5" borderRadius="$4">
            <XStack gap="$3" alignItems="flex-start">
              <Ionicons name="sync-outline" size={24} color={WATSON_TEAL} />
              <YStack flex={1}>
                <Text color={WATSON_TEAL} fontWeight="600" fontSize="$4">
                  Follow-up Automatico
                </Text>
                <Text color="$color" marginTop="$2" fontSize="$3">
                  Envie mensagens automaticas para clientes que nao responderam apos um periodo de tempo.
                </Text>
              </YStack>
            </XStack>
          </Card>

          {/* Automations List */}
          {automations.length === 0 ? (
            <Card padding="$6" backgroundColor="$backgroundStrong" borderRadius="$4">
              <YStack alignItems="center" gap="$3">
                <Ionicons name="flash-outline" size={48} color={theme.gray6.val} />
                <Text color="$gray8" fontSize="$4" textAlign="center">
                  Nenhuma automacao configurada
                </Text>
                <Text color="$gray7" fontSize="$2" textAlign="center">
                  Crie sua primeira automacao de follow-up para recuperar conversas abandonadas
                </Text>
                <Pressable onPress={() => setShowCreateForm(true)}>
                  <XStack
                    backgroundColor={WATSON_TEAL}
                    paddingHorizontal="$4"
                    paddingVertical="$3"
                    borderRadius="$3"
                    gap="$2"
                    alignItems="center"
                    marginTop="$2"
                  >
                    <Ionicons name="add" size={20} color="white" />
                    <Text color="white" fontWeight="600" fontSize="$4">Criar Automacao</Text>
                  </XStack>
                </Pressable>
              </YStack>
            </Card>
          ) : (
            automations.map((automation) => (
              <Card key={automation.id} padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                <XStack justifyContent="space-between" alignItems="flex-start">
                  <YStack flex={1}>
                    <XStack alignItems="center" gap="$2">
                      <YStack
                        width={10}
                        height={10}
                        borderRadius={5}
                        backgroundColor={automation.isActive ? "$green10" : "$gray6"}
                      />
                      <Text fontSize="$4" fontWeight="600" color="$color">
                        {automation.name}
                      </Text>
                    </XStack>
                    <Text fontSize="$2" color="$gray8" marginTop="$1">
                      Envia apos {automation.triggerDelayHours}h de inatividade
                    </Text>
                    <XStack gap="$3" marginTop="$2">
                      <XStack alignItems="center" gap="$1">
                        <Ionicons name="paper-plane-outline" size={14} color={theme.gray8.val} />
                        <Text fontSize="$2" color="$gray8">{automation.timesExecuted} enviados</Text>
                      </XStack>
                      {automation.useAI && (
                        <XStack alignItems="center" gap="$1">
                          <Ionicons name="sparkles" size={14} color={WATSON_TEAL} />
                          <Text fontSize="$2" color={WATSON_TEAL}>IA</Text>
                        </XStack>
                      )}
                    </XStack>
                  </YStack>
                  <Switch
                    value={automation.isActive}
                    onValueChange={() => handleToggle(automation)}
                    trackColor={{ false: theme.gray6.val, true: WATSON_TEAL }}
                  />
                </XStack>

                <XStack gap="$2" marginTop="$3" justifyContent="flex-end">
                  <Pressable onPress={() => handleEdit(automation)}>
                    <XStack
                      backgroundColor="$gray5"
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      borderRadius="$2"
                      gap="$1"
                      alignItems="center"
                    >
                      <Ionicons name="pencil-outline" size={16} color={theme.color.val} />
                      <Text color="$color" fontSize="$2">Editar</Text>
                    </XStack>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(automation)}>
                    <XStack
                      backgroundColor="$red5"
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      borderRadius="$2"
                      gap="$1"
                      alignItems="center"
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      <Text color="$red10" fontSize="$2">Excluir</Text>
                    </XStack>
                  </Pressable>
                </XStack>
              </Card>
            ))
          )}
        </YStack>
      </ScrollView>
    </>
  );
}
