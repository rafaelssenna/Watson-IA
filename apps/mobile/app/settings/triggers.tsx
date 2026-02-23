import { useEffect, useState } from "react";
import { Pressable, Alert, ActivityIndicator, TextInput, Switch } from "react-native";
import { Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme, Separator } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/authStore";
import api from "@/services/api";

// Watson IA brand colors
const WATSON_TEAL = "#0d9488";

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface Trigger {
  id: string;
  name: string;
  description?: string;
  triggerType: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  isActive: boolean;
  priority: number;
  timesTriggered: number;
  lastTriggeredAt?: string;
}

interface TriggerTypeInfo {
  type: string;
  name: string;
  description: string;
  icon: string;
}

interface TriggerTypeExtended extends TriggerTypeInfo {
  example: string;
  tip: string;
}

const TRIGGER_TYPES: TriggerTypeExtended[] = [
  {
    type: "KEYWORD",
    name: "Palavra-chave",
    description: "Dispara quando cliente menciona palavras especificas",
    icon: "text-outline",
    example: "Cliente: \"Quanto custa o produto?\" → Detecta \"custa\", \"preco\"",
    tip: "Use para enviar catalogos quando cliente perguntar sobre precos",
  },
  {
    type: "INTENT",
    name: "Intencao",
    description: "A IA detecta automaticamente o que o cliente quer",
    icon: "bulb-outline",
    example: "Cliente: \"Quero comprar\" → Detecta intencao de COMPRA",
    tip: "Ideal para direcionar clientes interessados para vendedores",
  },
  {
    type: "NEW_CONTACT",
    name: "Novo contato",
    description: "Dispara apenas na PRIMEIRA mensagem de um contato novo",
    icon: "person-add-outline",
    example: "Novo cliente envia qualquer mensagem → Trigger dispara",
    tip: "Perfeito para enviar boas-vindas e apresentar sua empresa",
  },
  {
    type: "OUT_OF_HOURS",
    name: "Fora do horario",
    description: "Dispara quando cliente envia mensagem fora do expediente",
    icon: "moon-outline",
    example: "Cliente envia mensagem as 22h → Trigger dispara",
    tip: "Avise que respondera no proximo dia util",
  },
  {
    type: "URGENCY",
    name: "Urgencia",
    description: "Detecta palavras como \"urgente\", \"preciso agora\", \"emergencia\"",
    icon: "alert-circle-outline",
    example: "Cliente: \"Preciso disso urgente!\" → Trigger dispara",
    tip: "Transfira para atendente humano imediatamente",
  },
  {
    type: "SENTIMENT",
    name: "Sentimento negativo",
    description: "Detecta cliente irritado ou insatisfeito",
    icon: "sad-outline",
    example: "Cliente: \"Estou muito frustrado com voces\" → Trigger dispara",
    tip: "Transfira para humano antes que a situacao piore",
  },
];

const INTENT_OPTIONS = [
  { value: "PURCHASE", label: "Compra", desc: "\"quero comprar\", \"quanto custa\"" },
  { value: "COMPLAINT", label: "Reclamacao", desc: "\"problema\", \"defeito\", \"reembolso\"" },
  { value: "SUPPORT", label: "Suporte", desc: "\"ajuda\", \"duvida\", \"como funciona\"" },
  { value: "SHIPPING", label: "Entrega", desc: "\"frete\", \"prazo\", \"rastreio\"" },
  { value: "CANCEL", label: "Cancelamento", desc: "\"cancelar\", \"desistir\"" },
  { value: "HUMAN", label: "Atendente", desc: "\"falar com humano\", \"atendente\"" },
];

export default function TriggersScreen() {
  const theme = useTheme();
  const { accessToken } = useAuthStore();

  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [keywords, setKeywords] = useState("");
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [transferToHuman, setTransferToHuman] = useState(false);
  const [skipAIResponse, setSkipAIResponse] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTriggers();
  }, []);

  const fetchTriggers = async () => {
    try {
      const response = await api.get("/triggers", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setTriggers(response.data.data || []);
    } catch (error) {
      console.error("Error fetching triggers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (trigger: Trigger) => {
    try {
      await api.post(
        `/triggers/${trigger.id}/toggle`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setTriggers((prev) =>
        prev.map((t) =>
          t.id === trigger.id ? { ...t, isActive: !t.isActive } : t
        )
      );
    } catch (error) {
      Alert.alert("Erro", "Nao foi possivel alterar o status do trigger");
    }
  };

  const handleDelete = (trigger: Trigger) => {
    Alert.alert("Confirmar", `Excluir trigger "${trigger.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/triggers/${trigger.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            setTriggers((prev) => prev.filter((t) => t.id !== trigger.id));
          } catch (error) {
            Alert.alert("Erro", "Nao foi possivel excluir o trigger");
          }
        },
      },
    ]);
  };

  const handleEdit = (trigger: Trigger) => {
    setEditingTrigger(trigger);
    setName(trigger.name);
    setSelectedType(trigger.triggerType);
    setKeywords(trigger.conditions.keywords?.join(", ") || "");
    setSelectedIntents(trigger.conditions.intents || []);
    setMessageTemplate(trigger.actions.sendMessage || "");
    setTransferToHuman(trigger.actions.transferToHuman || false);
    setSkipAIResponse(trigger.actions.skipAIResponse || false);
    setShowForm(true);
  };

  const resetForm = () => {
    setName("");
    setSelectedType(null);
    setKeywords("");
    setSelectedIntents([]);
    setMessageTemplate("");
    setTransferToHuman(false);
    setSkipAIResponse(false);
    setEditingTrigger(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Erro", "Nome e obrigatorio");
      return;
    }
    if (!selectedType) {
      Alert.alert("Erro", "Selecione um tipo de trigger");
      return;
    }

    setSaving(true);

    // Build conditions based on type
    const conditions: Record<string, any> = {};
    if (selectedType === "KEYWORD" && keywords.trim()) {
      conditions.keywords = keywords.split(",").map((k) => k.trim()).filter(Boolean);
      conditions.matchType = "any";
    }
    if (selectedType === "INTENT" && selectedIntents.length > 0) {
      conditions.intents = selectedIntents;
    }

    // Build actions
    const actions: Record<string, any> = {};
    if (messageTemplate.trim()) {
      actions.sendMessage = messageTemplate.trim();
    }
    if (transferToHuman) {
      actions.transferToHuman = true;
    }
    if (skipAIResponse) {
      actions.skipAIResponse = true;
    }

    try {
      if (editingTrigger) {
        const response = await api.patch(
          `/triggers/${editingTrigger.id}`,
          { name, triggerType: selectedType, conditions, actions },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        setTriggers((prev) =>
          prev.map((t) => (t.id === editingTrigger.id ? response.data.data : t))
        );
      } else {
        const response = await api.post(
          "/triggers",
          { name, triggerType: selectedType, conditions, actions },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        setTriggers((prev) => [response.data.data, ...prev]);
      }
      resetForm();
    } catch (error) {
      Alert.alert("Erro", "Nao foi possivel salvar o trigger");
    } finally {
      setSaving(false);
    }
  };

  const getTriggerIcon = (type: string): IoniconsName => {
    const typeInfo = TRIGGER_TYPES.find((t) => t.type === type);
    return (typeInfo?.icon as IoniconsName) || "flash-outline";
  };

  const getTriggerTypeName = (type: string): string => {
    const typeInfo = TRIGGER_TYPES.find((t) => t.type === type);
    return typeInfo?.name || type;
  };

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={WATSON_TEAL} />
        <Text color="$gray8" marginTop="$3">Carregando...</Text>
      </YStack>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Triggers",
          headerRight: () =>
            showForm ? (
              <Pressable onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={WATSON_TEAL} />
                ) : (
                  <Text color={WATSON_TEAL} fontWeight="600" fontSize="$4">
                    Salvar
                  </Text>
                )}
              </Pressable>
            ) : (
              <Pressable onPress={() => setShowForm(true)}>
                <Ionicons name="add-circle" size={28} color={WATSON_TEAL} />
              </Pressable>
            ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        {showForm ? (
          <TriggerForm
            theme={theme}
            name={name}
            setName={setName}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            keywords={keywords}
            setKeywords={setKeywords}
            selectedIntents={selectedIntents}
            setSelectedIntents={setSelectedIntents}
            messageTemplate={messageTemplate}
            setMessageTemplate={setMessageTemplate}
            transferToHuman={transferToHuman}
            setTransferToHuman={setTransferToHuman}
            skipAIResponse={skipAIResponse}
            setSkipAIResponse={setSkipAIResponse}
            onCancel={resetForm}
            isEditing={!!editingTrigger}
          />
        ) : (
          <TriggerList
            theme={theme}
            triggers={triggers}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            getTriggerIcon={getTriggerIcon}
            getTriggerTypeName={getTriggerTypeName}
          />
        )}
      </ScrollView>
    </>
  );
}

function TriggerList({
  theme,
  triggers,
  onToggle,
  onEdit,
  onDelete,
  getTriggerIcon,
  getTriggerTypeName,
}: {
  theme: any;
  triggers: Trigger[];
  onToggle: (t: Trigger) => void;
  onEdit: (t: Trigger) => void;
  onDelete: (t: Trigger) => void;
  getTriggerIcon: (type: string) => IoniconsName;
  getTriggerTypeName: (type: string) => string;
}) {
  if (triggers.length === 0) {
    return (
      <YStack gap="$4">
        {/* Explanation Card */}
        <Card padding="$4" backgroundColor="$teal5" borderRadius="$4">
          <XStack gap="$3" alignItems="flex-start">
            <Ionicons name="flash" size={24} color={WATSON_TEAL} />
            <YStack flex={1}>
              <Text color={WATSON_TEAL} fontWeight="600" fontSize="$4">
                O que sao Triggers?
              </Text>
              <Text color="$color" marginTop="$2" fontSize="$3">
                Triggers sao acoes automaticas que disparam quando o Watson detecta algo especifico na mensagem do cliente.
              </Text>
            </YStack>
          </XStack>
        </Card>

        {/* Examples Card */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$3">
            Exemplos de uso
          </Text>
          <YStack gap="$3">
            <ExampleItem
              icon="person-add-outline"
              title="Boas-vindas"
              desc="Novo contato → Envia mensagem de boas-vindas"
            />
            <ExampleItem
              icon="bulb-outline"
              title="Intencao de compra"
              desc="Cliente quer comprar → Notifica vendedor"
            />
            <ExampleItem
              icon="sad-outline"
              title="Cliente irritado"
              desc="Sentimento negativo → Transfere para humano"
            />
            <ExampleItem
              icon="moon-outline"
              title="Fora do horario"
              desc="Mensagem as 22h → Avisa que respondera amanha"
            />
          </YStack>
        </Card>

        {/* Empty State */}
        <YStack alignItems="center" paddingVertical="$6">
          <Ionicons name="add-circle-outline" size={48} color={theme.gray6.val} />
          <Text color="$gray8" fontSize="$4" fontWeight="600" marginTop="$3">
            Crie seu primeiro trigger
          </Text>
          <Text color="$gray7" fontSize="$2" marginTop="$1" textAlign="center">
            Toque no + no canto superior direito
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack gap="$4">
      {/* Info Card */}
      <Card padding="$4" backgroundColor="$teal5" borderRadius="$4">
        <XStack gap="$3" alignItems="flex-start">
          <Ionicons name="flash" size={24} color={WATSON_TEAL} />
          <YStack flex={1}>
            <Text color={WATSON_TEAL} fontWeight="600" fontSize="$4">
              Triggers ativos
            </Text>
            <Text color="$color" marginTop="$2" fontSize="$3">
              Seus triggers sao verificados em cada mensagem recebida. Quando uma condicao e detectada, a acao configurada e executada automaticamente.
            </Text>
          </YStack>
        </XStack>
      </Card>

      {/* Triggers List */}
      <YStack gap="$3">
        {triggers.map((trigger) => (
          <Card
            key={trigger.id}
            padding="$4"
            backgroundColor="$backgroundStrong"
            borderRadius="$4"
          >
            <XStack alignItems="center" gap="$3">
              <YStack
                width={44}
                height={44}
                borderRadius={22}
                backgroundColor={trigger.isActive ? "$teal5" : "$gray5"}
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons
                  name={getTriggerIcon(trigger.triggerType)}
                  size={22}
                  color={trigger.isActive ? WATSON_TEAL : theme.gray8.val}
                />
              </YStack>

              <YStack flex={1}>
                <Text fontWeight="600" color="$color" fontSize="$4">
                  {trigger.name}
                </Text>
                <Text color="$gray8" fontSize="$2">
                  {getTriggerTypeName(trigger.triggerType)}
                </Text>
                {trigger.timesTriggered > 0 && (
                  <Text color="$gray7" fontSize="$1" marginTop="$1">
                    Disparado {trigger.timesTriggered}x
                  </Text>
                )}
              </YStack>

              <Switch
                value={trigger.isActive}
                onValueChange={() => onToggle(trigger)}
                trackColor={{ false: theme.gray6.val, true: WATSON_TEAL }}
                thumbColor="white"
              />
            </XStack>

            {/* Actions summary */}
            <XStack marginTop="$3" gap="$2" flexWrap="wrap">
              {trigger.actions.sendMessage && (
                <ActionBadge icon="chatbubble-outline" label="Envia mensagem" />
              )}
              {trigger.actions.transferToHuman && (
                <ActionBadge icon="person-outline" label="Transfere" />
              )}
              {trigger.actions.skipAIResponse && (
                <ActionBadge icon="pause-outline" label="Para IA" />
              )}
            </XStack>

            <Separator marginVertical="$3" backgroundColor="$gray6" />

            <XStack justifyContent="flex-end" gap="$4">
              <Pressable onPress={() => onEdit(trigger)}>
                <XStack alignItems="center" gap="$1">
                  <Ionicons name="pencil-outline" size={16} color={theme.blue10.val} />
                  <Text color="$blue10" fontSize="$3">Editar</Text>
                </XStack>
              </Pressable>
              <Pressable onPress={() => onDelete(trigger)}>
                <XStack alignItems="center" gap="$1">
                  <Ionicons name="trash-outline" size={16} color={theme.red10.val} />
                  <Text color="$red10" fontSize="$3">Excluir</Text>
                </XStack>
              </Pressable>
            </XStack>
          </Card>
        ))}
      </YStack>
    </YStack>
  );
}

function ActionBadge({ icon, label }: { icon: IoniconsName; label: string }) {
  return (
    <XStack
      backgroundColor="$gray5"
      paddingHorizontal="$2"
      paddingVertical="$1"
      borderRadius="$2"
      alignItems="center"
      gap="$1"
    >
      <Ionicons name={icon} size={12} color="#666" />
      <Text fontSize="$1" color="$gray8">{label}</Text>
    </XStack>
  );
}

function ExampleItem({ icon, title, desc }: { icon: IoniconsName; title: string; desc: string }) {
  return (
    <XStack alignItems="center" gap="$3">
      <YStack
        width={36}
        height={36}
        borderRadius={18}
        backgroundColor="$teal5"
        alignItems="center"
        justifyContent="center"
      >
        <Ionicons name={icon} size={18} color={WATSON_TEAL} />
      </YStack>
      <YStack flex={1}>
        <Text fontWeight="600" color="$color" fontSize="$3">{title}</Text>
        <Text fontSize="$2" color="$gray8">{desc}</Text>
      </YStack>
    </XStack>
  );
}

function TriggerForm({
  theme,
  name,
  setName,
  selectedType,
  setSelectedType,
  keywords,
  setKeywords,
  selectedIntents,
  setSelectedIntents,
  messageTemplate,
  setMessageTemplate,
  transferToHuman,
  setTransferToHuman,
  skipAIResponse,
  setSkipAIResponse,
  onCancel,
  isEditing,
}: {
  theme: any;
  name: string;
  setName: (v: string) => void;
  selectedType: string | null;
  setSelectedType: (v: string | null) => void;
  keywords: string;
  setKeywords: (v: string) => void;
  selectedIntents: string[];
  setSelectedIntents: (v: string[]) => void;
  messageTemplate: string;
  setMessageTemplate: (v: string) => void;
  transferToHuman: boolean;
  setTransferToHuman: (v: boolean) => void;
  skipAIResponse: boolean;
  setSkipAIResponse: (v: boolean) => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  const toggleIntent = (intent: string) => {
    if (selectedIntents.includes(intent)) {
      setSelectedIntents(selectedIntents.filter((i) => i !== intent));
    } else {
      setSelectedIntents([...selectedIntents, intent]);
    }
  };

  return (
    <YStack gap="$4">
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize="$5" fontWeight="600" color="$color">
          {isEditing ? "Editar Trigger" : "Novo Trigger"}
        </Text>
        <Pressable onPress={onCancel}>
          <Text color="$gray8" fontSize="$3">Cancelar</Text>
        </Pressable>
      </XStack>

      {/* Name */}
      <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
        <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
          Nome do Trigger
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ex: Boas-vindas para novos contatos"
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

      {/* Trigger Type Selection */}
      <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
        <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
          Tipo de Trigger
        </Text>
        <Text fontSize="$2" color="$gray8" marginBottom="$3">
          Escolha quando o trigger deve disparar
        </Text>
        <YStack gap="$2">
          {TRIGGER_TYPES.map((type) => {
            const isSelected = selectedType === type.type;
            return (
              <Pressable key={type.type} onPress={() => setSelectedType(type.type)}>
                <YStack
                  padding="$3"
                  backgroundColor={isSelected ? "$teal5" : "$background"}
                  borderRadius="$3"
                  borderWidth={isSelected ? 2 : 1}
                  borderColor={isSelected ? WATSON_TEAL : "$gray6"}
                >
                  <XStack alignItems="center" gap="$3">
                    <Ionicons
                      name={type.icon as IoniconsName}
                      size={24}
                      color={isSelected ? WATSON_TEAL : theme.gray8.val}
                    />
                    <YStack flex={1}>
                      <Text fontWeight="600" color={isSelected ? WATSON_TEAL : "$color"}>
                        {type.name}
                      </Text>
                      <Text fontSize="$2" color="$gray8">
                        {type.description}
                      </Text>
                    </YStack>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={WATSON_TEAL} />
                    )}
                  </XStack>

                  {/* Show example, tip, and conditions when selected */}
                  {isSelected && (
                    <YStack marginTop="$3" paddingTop="$3" borderTopWidth={1} borderTopColor="$gray6">
                      <XStack alignItems="flex-start" gap="$2" marginBottom="$2">
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color={WATSON_TEAL} style={{ marginTop: 2 }} />
                        <YStack flex={1}>
                          <Text fontSize="$1" color={WATSON_TEAL} fontWeight="600">EXEMPLO</Text>
                          <Text fontSize="$2" color="$color">{type.example}</Text>
                        </YStack>
                      </XStack>
                      <XStack alignItems="flex-start" gap="$2">
                        <Ionicons name="bulb-outline" size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                        <YStack flex={1}>
                          <Text fontSize="$1" color="#f59e0b" fontWeight="600">DICA</Text>
                          <Text fontSize="$2" color="$gray8">{type.tip}</Text>
                        </YStack>
                      </XStack>

                      {/* Inline conditions for KEYWORD */}
                      {type.type === "KEYWORD" && (
                        <YStack marginTop="$3" paddingTop="$3" borderTopWidth={1} borderTopColor="$gray6">
                          <XStack alignItems="center" gap="$2" marginBottom="$2">
                            <Ionicons name="list-outline" size={16} color={WATSON_TEAL} />
                            <Text fontSize="$2" fontWeight="600" color={WATSON_TEAL}>
                              CONFIGURE AS PALAVRAS
                            </Text>
                          </XStack>
                          <Text fontSize="$2" color="$gray8" marginBottom="$2">
                            Digite as palavras separadas por virgula:
                          </Text>
                          <TextInput
                            value={keywords}
                            onChangeText={setKeywords}
                            placeholder="preco, valor, quanto custa, comprar"
                            placeholderTextColor={theme.gray8.val}
                            style={{
                              backgroundColor: theme.background.val,
                              borderRadius: 8,
                              padding: 12,
                              fontSize: 16,
                              color: theme.color.val,
                            }}
                          />
                          <Text fontSize="$1" color="$gray7" marginTop="$2">
                            O trigger dispara se o cliente mencionar QUALQUER uma dessas palavras
                          </Text>
                        </YStack>
                      )}

                      {/* Inline conditions for INTENT */}
                      {type.type === "INTENT" && (
                        <YStack marginTop="$3" paddingTop="$3" borderTopWidth={1} borderTopColor="$gray6">
                          <XStack alignItems="center" gap="$2" marginBottom="$2">
                            <Ionicons name="checkbox-outline" size={16} color={WATSON_TEAL} />
                            <Text fontSize="$2" fontWeight="600" color={WATSON_TEAL}>
                              SELECIONE AS INTENCOES
                            </Text>
                          </XStack>
                          <Text fontSize="$2" color="$gray8" marginBottom="$3">
                            Marque quais intencoes devem disparar este trigger:
                          </Text>
                          <YStack gap="$2">
                            {INTENT_OPTIONS.map((intent) => {
                              const intentSelected = selectedIntents.includes(intent.value);
                              return (
                                <Pressable key={intent.value} onPress={() => toggleIntent(intent.value)}>
                                  <XStack
                                    padding="$3"
                                    backgroundColor={intentSelected ? "$green5" : "$background"}
                                    borderRadius="$3"
                                    alignItems="center"
                                    gap="$3"
                                    borderWidth={intentSelected ? 2 : 1}
                                    borderColor={intentSelected ? "#22c55e" : "$gray6"}
                                  >
                                    <YStack flex={1}>
                                      <Text fontWeight="600" color={intentSelected ? "#22c55e" : "$color"}>
                                        {intent.label}
                                      </Text>
                                      <Text fontSize="$1" color="$gray7" marginTop="$1">
                                        Detecta: {intent.desc}
                                      </Text>
                                    </YStack>
                                    {intentSelected ? (
                                      <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                                    ) : (
                                      <Ionicons name="ellipse-outline" size={24} color={theme.gray6.val} />
                                    )}
                                  </XStack>
                                </Pressable>
                              );
                            })}
                          </YStack>
                        </YStack>
                      )}

                      {/* Info for types that don't need configuration */}
                      {(type.type === "NEW_CONTACT" || type.type === "URGENCY" || type.type === "SENTIMENT") && (
                        <YStack marginTop="$3" paddingTop="$3" borderTopWidth={1} borderTopColor="$gray6">
                          <XStack alignItems="center" gap="$2">
                            <Ionicons name="checkmark-done-outline" size={16} color="#22c55e" />
                            <Text fontSize="$2" color="#22c55e" fontWeight="500">
                              Nenhuma configuracao necessaria!
                            </Text>
                          </XStack>
                          <Text fontSize="$2" color="$gray8" marginTop="$1">
                            Este trigger detecta automaticamente. Basta configurar as acoes abaixo.
                          </Text>
                        </YStack>
                      )}

                      {/* Info for OUT_OF_HOURS */}
                      {type.type === "OUT_OF_HOURS" && (
                        <YStack marginTop="$3" paddingTop="$3" borderTopWidth={1} borderTopColor="$gray6">
                          <XStack alignItems="center" gap="$2">
                            <Ionicons name="time-outline" size={16} color={WATSON_TEAL} />
                            <Text fontSize="$2" color={WATSON_TEAL} fontWeight="500">
                              Horario configurado na Persona
                            </Text>
                          </XStack>
                          <Text fontSize="$2" color="$gray8" marginTop="$1">
                            O horario de funcionamento e configurado em Configuracoes → Persona da IA. Mensagens fora desse horario disparam este trigger.
                          </Text>
                        </YStack>
                      )}
                    </YStack>
                  )}
                </YStack>
              </Pressable>
            );
          })}
        </YStack>
      </Card>

      {/* Actions */}
      <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
        <XStack alignItems="center" gap="$2" marginBottom="$3">
          <Ionicons name="flash-outline" size={20} color={WATSON_TEAL} />
          <Text fontSize="$3" fontWeight="600" color="$color">
            O que fazer quando disparar?
          </Text>
        </XStack>

        {/* Send Message */}
        <YStack marginBottom="$4" padding="$3" backgroundColor="$background" borderRadius="$3">
          <XStack alignItems="center" gap="$2" marginBottom="$2">
            <Ionicons name="chatbubble-outline" size={18} color={WATSON_TEAL} />
            <Text fontSize="$3" fontWeight="600" color="$color">
              Enviar mensagem automatica
            </Text>
          </XStack>
          <Text fontSize="$2" color="$gray8" marginBottom="$2">
            Esta mensagem sera enviada imediatamente quando o trigger disparar
          </Text>
          <TextInput
            value={messageTemplate}
            onChangeText={setMessageTemplate}
            placeholder="Ex: Ola {nome}! Obrigado pelo contato..."
            placeholderTextColor={theme.gray8.val}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: theme.backgroundStrong.val,
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: theme.color.val,
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
          <Text fontSize="$1" color="$gray7" marginTop="$2">
            Dica: Use {"{nome}"} para incluir o nome do cliente
          </Text>
        </YStack>

        <Separator marginVertical="$3" backgroundColor="$gray6" />

        <Text fontSize="$2" fontWeight="600" color="$gray8" marginBottom="$3">
          COMPORTAMENTO DA IA APOS O TRIGGER
        </Text>

        {/* Transfer to Human */}
        <YStack
          marginBottom="$3"
          padding="$3"
          backgroundColor={transferToHuman ? "$orange3" : "$background"}
          borderRadius="$3"
          borderWidth={transferToHuman ? 2 : 1}
          borderColor={transferToHuman ? "#f97316" : "$gray6"}
        >
          <XStack alignItems="center" justifyContent="space-between">
            <XStack alignItems="center" gap="$2" flex={1}>
              <Ionicons name="person-outline" size={20} color={transferToHuman ? "#f97316" : theme.gray8.val} />
              <YStack flex={1}>
                <Text color={transferToHuman ? "#f97316" : "$color"} fontWeight="600">
                  Transferir para humano
                </Text>
              </YStack>
            </XStack>
            <Switch
              value={transferToHuman}
              onValueChange={(v) => {
                setTransferToHuman(v);
                if (v) setSkipAIResponse(false);
              }}
              trackColor={{ false: theme.gray6.val, true: "#f97316" }}
              thumbColor="white"
            />
          </XStack>
          <YStack marginTop="$2" paddingLeft="$7">
            <Text fontSize="$2" color="$gray8">
              A IA PARA de responder PERMANENTEMENTE
            </Text>
            <Text fontSize="$1" color="$gray7" marginTop="$1">
              → Conversa vai para fila de atendimento humano
            </Text>
            <Text fontSize="$1" color="$gray7">
              → Ideal para: cliente irritado, pedido de atendente
            </Text>
          </YStack>
        </YStack>

        {/* Skip AI Response */}
        <YStack
          padding="$3"
          backgroundColor={skipAIResponse ? "$blue3" : "$background"}
          borderRadius="$3"
          borderWidth={skipAIResponse ? 2 : 1}
          borderColor={skipAIResponse ? "#3b82f6" : "$gray6"}
        >
          <XStack alignItems="center" justifyContent="space-between">
            <XStack alignItems="center" gap="$2" flex={1}>
              <Ionicons name="pause-outline" size={20} color={skipAIResponse ? "#3b82f6" : theme.gray8.val} />
              <YStack flex={1}>
                <Text color={skipAIResponse ? "#3b82f6" : "$color"} fontWeight="600">
                  Nao responder com IA (so desta vez)
                </Text>
              </YStack>
            </XStack>
            <Switch
              value={skipAIResponse}
              onValueChange={(v) => {
                setSkipAIResponse(v);
                if (v) setTransferToHuman(false);
              }}
              trackColor={{ false: theme.gray6.val, true: "#3b82f6" }}
              thumbColor="white"
            />
          </XStack>
          <YStack marginTop="$2" paddingLeft="$7">
            <Text fontSize="$2" color="$gray8">
              A IA NAO responde SO nesta mensagem
            </Text>
            <Text fontSize="$1" color="$gray7" marginTop="$1">
              → Proxima mensagem, IA volta a responder normal
            </Text>
            <Text fontSize="$1" color="$gray7">
              → Ideal para: avisos automaticos, mensagens fora do horario
            </Text>
          </YStack>
        </YStack>

        {/* None selected info */}
        {!transferToHuman && !skipAIResponse && (
          <YStack marginTop="$3" padding="$3" backgroundColor="$green3" borderRadius="$3">
            <XStack alignItems="center" gap="$2">
              <Ionicons name="checkmark-circle-outline" size={18} color="#22c55e" />
              <Text fontSize="$2" color="#22c55e" fontWeight="500">
                IA continua respondendo normalmente
              </Text>
            </XStack>
            <Text fontSize="$1" color="$gray7" marginTop="$1" paddingLeft="$6">
              O trigger envia a mensagem e a IA continua a conversa
            </Text>
          </YStack>
        )}
      </Card>
    </YStack>
  );
}
