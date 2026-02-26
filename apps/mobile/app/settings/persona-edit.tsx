import { useEffect, useState, useRef } from "react";
import { Pressable, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Switch, Modal } from "react-native";
import { router, Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { usePersonaStore, type CreatePersonaData } from "@/stores/personaStore";

export default function PersonaEditScreen() {
  const theme = useTheme();

  const {
    selectedPersona,
    isLoading,
    fetchDefaultPersona,
    createPersona,
    updatePersona,
    generateFromDescription,
  } = usePersonaStore();

  // Form state
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [greetingMessage, setGreetingMessage] = useState("");
  const [greetingEnabled, setGreetingEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [formalityLevel, setFormalityLevel] = useState(50);
  const [persuasiveness, setPersuasiveness] = useState(50);
  const [energyLevel, setEnergyLevel] = useState(50);
  const [empathyLevel, setEmpathyLevel] = useState(70);
  const [responseLength, setResponseLength] = useState<"CURTA" | "MEDIA" | "LONGA">("MEDIA");
  const [prohibitedTopics, setProhibitedTopics] = useState("");
  const [businessHoursStart, setBusinessHoursStart] = useState("09:00");
  const [businessHoursEnd, setBusinessHoursEnd] = useState("18:00");
  const [workDays, setWorkDays] = useState<string[]>(["seg", "ter", "qua", "qui", "sex"]);
  const [saving, setSaving] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);
  const loadedPersonaId = useRef<string | null>(null);

  // AI Generation modal
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiDescription, setAIDescription] = useState("");
  const [generating, setGenerating] = useState(false);

  // Load default persona on mount
  useEffect(() => {
    loadPersona();
  }, []);

  const loadPersona = async () => {
    const persona = await fetchDefaultPersona();
    if (persona) {
      loadedPersonaId.current = persona.id;
    }
  };

  // Populate form when persona is loaded
  useEffect(() => {
    if (selectedPersona && !formInitialized) {
      setName(selectedPersona.name);
      setBusinessName(selectedPersona.businessName || "");
      setGreetingMessage(selectedPersona.greetingMessage || "");
      setGreetingEnabled((selectedPersona as any).greetingEnabled ?? false);
      setSystemPrompt(selectedPersona.systemPrompt || "");
      setFormalityLevel(selectedPersona.formalityLevel ?? 50);
      setPersuasiveness(selectedPersona.persuasiveness ?? 50);
      setEnergyLevel(selectedPersona.energyLevel ?? 50);
      setEmpathyLevel(selectedPersona.empathyLevel ?? 70);
      setResponseLength(selectedPersona.responseLength || "MEDIA");
      setProhibitedTopics(selectedPersona.prohibitedTopics || "");
      setBusinessHoursStart(selectedPersona.businessHoursStart || "09:00");
      setBusinessHoursEnd(selectedPersona.businessHoursEnd || "18:00");
      setWorkDays(selectedPersona.workDays || ["seg", "ter", "qua", "qui", "sex"]);
      setFormInitialized(true);
    }
  }, [selectedPersona, formInitialized]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Erro", "Nome da persona e obrigatorio");
      return;
    }

    setSaving(true);

    const data: CreatePersonaData = {
      name: name.trim(),
      businessName: businessName.trim() || undefined,
      greetingMessage: greetingMessage.trim() || undefined,
      greetingEnabled,
      systemPrompt: systemPrompt.trim() || undefined,
      formalityLevel,
      persuasiveness,
      energyLevel,
      empathyLevel,
      responseLength,
      prohibitedTopics: prohibitedTopics.trim() || undefined,
      businessHoursStart: businessHoursStart || undefined,
      businessHoursEnd: businessHoursEnd || undefined,
      workDays: workDays.length > 0 ? workDays : undefined,
      isDefault: true,
    };

    try {
      if (selectedPersona?.id) {
        await updatePersona(selectedPersona.id, data);
        Alert.alert("Sucesso", "Configuracoes salvas com sucesso");
      } else {
        const newPersona = await createPersona(data);
        loadedPersonaId.current = newPersona.id;
        Alert.alert("Sucesso", "Persona criada com sucesso");
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Erro ao salvar configuracoes");
    }

    setSaving(false);
  };

  const handleGenerateWithAI = async () => {
    if (!aiDescription.trim() || aiDescription.trim().length < 10) {
      Alert.alert("Erro", "Descreva seu negocio com mais detalhes (minimo 10 caracteres)");
      return;
    }

    setGenerating(true);
    try {
      const generated = await generateFromDescription(aiDescription.trim());

      // Fill all form fields with AI-generated values
      setName(generated.name);
      setBusinessName(generated.businessName);
      setSystemPrompt(generated.systemPrompt);
      setGreetingMessage(generated.greetingMessage);
      setGreetingEnabled(true);
      setFormalityLevel(generated.formalityLevel);
      setPersuasiveness(generated.persuasiveness);
      setEnergyLevel(generated.energyLevel);
      setEmpathyLevel(generated.empathyLevel);
      setResponseLength(generated.responseLength);
      setProhibitedTopics(generated.prohibitedTopics);

      setShowAIModal(false);
      setAIDescription("");
      Alert.alert("Pronto!", "A IA configurou tudo automaticamente. Revise os campos e clique em Salvar.");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Erro ao gerar com IA. Tente novamente.");
    }
    setGenerating(false);
  };

  const getLevelDescription = (level: number, type: string): string => {
    const descriptions: Record<string, Record<string, string>> = {
      formality: {
        low: "Casual e amigavel, usa emojis",
        medium: "Equilibrado, profissional mas acessivel",
        high: "Formal, linguagem corporativa",
      },
      persuasiveness: {
        low: "Informativo, sem pressao",
        medium: "Gentilmente sugestivo",
        high: "Persuasivo, focado em conversao",
      },
      energy: {
        low: "Calmo e tranquilo",
        medium: "Equilibrado e neutro",
        high: "Energetico e entusiasmado",
      },
      empathy: {
        low: "Direto ao ponto",
        medium: "Atencioso e educado",
        high: "Muito empatico e acolhedor",
      },
    };

    const category = level <= 33 ? "low" : level <= 66 ? "medium" : "high";
    return descriptions[type]?.[category] || "";
  };

  if (isLoading && !selectedPersona) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={theme.blue10.val} />
        <Text color="$gray8" marginTop="$3">Carregando...</Text>
      </YStack>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Configurar IA",
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={theme.blue10.val} />
              ) : (
                <Text color="$blue10" fontWeight="600" fontSize="$4">
                  Salvar
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.background.val }}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <YStack gap="$4">
            {/* AI Auto-Configure Button */}
            <Pressable onPress={() => setShowAIModal(true)}>
              <Card
                padding="$4"
                borderRadius="$4"
                backgroundColor="$blue3"
                borderWidth={1}
                borderColor="$blue8"
              >
                <XStack alignItems="center" gap="$3">
                  <YStack
                    width={44}
                    height={44}
                    borderRadius={22}
                    backgroundColor="$blue10"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Ionicons name="sparkles" size={22} color="white" />
                  </YStack>
                  <YStack flex={1}>
                    <Text fontSize="$4" fontWeight="700" color="$blue10">
                      Conte sobre sua empresa
                    </Text>
                    <Text fontSize="$2" color="$blue8" marginTop="$1">
                      A IA configura tudo automaticamente para voce
                    </Text>
                  </YStack>
                  <Ionicons name="chevron-forward" size={20} color={theme.blue10.val} />
                </XStack>
              </Card>
            </Pressable>

            {/* AI Generation Modal */}
            <Modal
              visible={showAIModal}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => !generating && setShowAIModal(false)}
            >
              <YStack flex={1} backgroundColor={theme.background.val} padding="$4">
                <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
                  <Pressable onPress={() => !generating && setShowAIModal(false)}>
                    <Text color="$gray8" fontSize="$4">Cancelar</Text>
                  </Pressable>
                  <Text fontSize="$5" fontWeight="700" color={theme.color.val}>
                    Configurar com IA
                  </Text>
                  <YStack width={60} />
                </XStack>

                <YStack
                  alignItems="center"
                  padding="$4"
                  marginBottom="$4"
                >
                  <YStack
                    width={64}
                    height={64}
                    borderRadius={32}
                    backgroundColor="$blue10"
                    alignItems="center"
                    justifyContent="center"
                    marginBottom="$3"
                  >
                    <Ionicons name="sparkles" size={32} color="white" />
                  </YStack>
                  <Text fontSize="$4" fontWeight="600" color={theme.color.val} textAlign="center">
                    Descreva seu negocio
                  </Text>
                  <Text fontSize="$2" color="$gray8" textAlign="center" marginTop="$2">
                    Conte o que sua empresa faz, publico-alvo, diferenciais, tom de comunicacao...
                  </Text>
                </YStack>

                <TextInput
                  value={aiDescription}
                  onChangeText={setAIDescription}
                  placeholder="Ex: Tenho uma barbearia no centro de BH chamada BarberKing. Atendo homens de 20-40 anos, com cortes modernos, barba e sobrancelha. Somos descontraidos e usamos gírias..."
                  placeholderTextColor={theme.gray8.val}
                  multiline
                  numberOfLines={8}
                  editable={!generating}
                  style={{
                    backgroundColor: theme.backgroundStrong?.val || "#1a1a1a",
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                    color: theme.color.val,
                    minHeight: 180,
                    textAlignVertical: "top",
                    borderWidth: 1,
                    borderColor: theme.gray6.val,
                  }}
                />

                <Text fontSize="$1" color="$gray7" marginTop="$2" textAlign="center">
                  Quanto mais detalhes, melhor sera a configuracao
                </Text>

                <Pressable
                  onPress={handleGenerateWithAI}
                  disabled={generating || !aiDescription.trim()}
                  style={{ marginTop: 24 }}
                >
                  <XStack
                    backgroundColor={generating || !aiDescription.trim() ? "$gray6" : "$blue10"}
                    paddingVertical="$4"
                    borderRadius="$4"
                    alignItems="center"
                    justifyContent="center"
                    gap="$2"
                  >
                    {generating ? (
                      <>
                        <ActivityIndicator size="small" color="white" />
                        <Text color="white" fontWeight="700" fontSize="$4">
                          Gerando configuracao...
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="sparkles" size={20} color="white" />
                        <Text color="white" fontWeight="700" fontSize="$4">
                          Gerar com IA
                        </Text>
                      </>
                    )}
                  </XStack>
                </Pressable>
              </YStack>
            </Modal>

            {/* Business Info */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$3">
                Informacoes do Negocio
              </Text>

              <YStack gap="$3">
                <YStack>
                  <Text fontSize="$2" color="$gray8" marginBottom="$1">Nome da Empresa</Text>
                  <TextInput
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="Ex: Loja do Joao"
                    placeholderTextColor={theme.gray8.val}
                    style={{
                      backgroundColor: theme.background.val,
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      color: theme.color.val,
                    }}
                  />
                </YStack>

                <YStack>
                  <Text fontSize="$2" color="$gray8" marginBottom="$1">Nome da Persona</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Ex: Assistente Virtual"
                    placeholderTextColor={theme.gray8.val}
                    style={{
                      backgroundColor: theme.background.val,
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      color: theme.color.val,
                    }}
                  />
                </YStack>
              </YStack>
            </Card>

            {/* Greeting Message */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
                <Text fontSize="$3" fontWeight="600" color="$color">
                  Mensagem de Saudacao
                </Text>
                <Switch
                  value={greetingEnabled}
                  onValueChange={setGreetingEnabled}
                  trackColor={{ false: theme.gray6.val, true: theme.green8.val }}
                  thumbColor={greetingEnabled ? theme.green10.val : theme.gray4.val}
                />
              </XStack>
              <Text fontSize="$2" color="$gray8" marginBottom="$3">
                {greetingEnabled ? "Ativado - Novos contatos receberao esta mensagem" : "Desativado - IA responde direto"}
              </Text>
              {greetingEnabled && (
                <TextInput
                  value={greetingMessage}
                  onChangeText={setGreetingMessage}
                  placeholder="Ola! Bem-vindo a nossa loja..."
                  placeholderTextColor={theme.gray8.val}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: theme.background.val,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 16,
                    color: theme.color.val,
                    minHeight: 80,
                    textAlignVertical: "top",
                  }}
                />
              )}
            </Card>

            {/* Personality Sliders */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$4">
                Personalidade
              </Text>

              {/* Formality */}
              <YStack marginBottom="$4">
                <XStack justifyContent="space-between" marginBottom="$1">
                  <Text fontSize="$3" color="$color">Formalidade</Text>
                  <Text fontSize="$3" color="$blue10" fontWeight="600">{formalityLevel}%</Text>
                </XStack>
                <Slider
                  value={formalityLevel}
                  onValueChange={setFormalityLevel}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  minimumTrackTintColor={theme.blue10.val}
                  maximumTrackTintColor={theme.gray6.val}
                  thumbTintColor={theme.blue10.val}
                />
                <Text fontSize="$2" color="$gray8" marginTop="$1">
                  {getLevelDescription(formalityLevel, "formality")}
                </Text>
              </YStack>

              {/* Persuasiveness */}
              <YStack marginBottom="$4">
                <XStack justifyContent="space-between" marginBottom="$1">
                  <Text fontSize="$3" color="$color">Persuasao</Text>
                  <Text fontSize="$3" color="$blue10" fontWeight="600">{persuasiveness}%</Text>
                </XStack>
                <Slider
                  value={persuasiveness}
                  onValueChange={setPersuasiveness}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  minimumTrackTintColor={theme.blue10.val}
                  maximumTrackTintColor={theme.gray6.val}
                  thumbTintColor={theme.blue10.val}
                />
                <Text fontSize="$2" color="$gray8" marginTop="$1">
                  {getLevelDescription(persuasiveness, "persuasiveness")}
                </Text>
              </YStack>

              {/* Energy */}
              <YStack marginBottom="$4">
                <XStack justifyContent="space-between" marginBottom="$1">
                  <Text fontSize="$3" color="$color">Energia</Text>
                  <Text fontSize="$3" color="$blue10" fontWeight="600">{energyLevel}%</Text>
                </XStack>
                <Slider
                  value={energyLevel}
                  onValueChange={setEnergyLevel}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  minimumTrackTintColor={theme.blue10.val}
                  maximumTrackTintColor={theme.gray6.val}
                  thumbTintColor={theme.blue10.val}
                />
                <Text fontSize="$2" color="$gray8" marginTop="$1">
                  {getLevelDescription(energyLevel, "energy")}
                </Text>
              </YStack>

              {/* Empathy */}
              <YStack>
                <XStack justifyContent="space-between" marginBottom="$1">
                  <Text fontSize="$3" color="$color">Empatia</Text>
                  <Text fontSize="$3" color="$blue10" fontWeight="600">{empathyLevel}%</Text>
                </XStack>
                <Slider
                  value={empathyLevel}
                  onValueChange={setEmpathyLevel}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  minimumTrackTintColor={theme.blue10.val}
                  maximumTrackTintColor={theme.gray6.val}
                  thumbTintColor={theme.blue10.val}
                />
                <Text fontSize="$2" color="$gray8" marginTop="$1">
                  {getLevelDescription(empathyLevel, "empathy")}
                </Text>
              </YStack>
            </Card>

            {/* Response Length */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$3">
                Tamanho das Respostas
              </Text>
              <XStack gap="$2">
                {(["CURTA", "MEDIA", "LONGA"] as const).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setResponseLength(option)}
                    style={{ flex: 1 }}
                  >
                    <YStack
                      padding="$3"
                      borderRadius="$3"
                      alignItems="center"
                      backgroundColor={responseLength === option ? "$blue10" : "$background"}
                    >
                      <Text
                        color={responseLength === option ? "white" : "$color"}
                        fontWeight="600"
                        fontSize="$3"
                      >
                        {option === "CURTA" ? "Curta" : option === "MEDIA" ? "Media" : "Longa"}
                      </Text>
                      <Text
                        fontSize="$1"
                        color={responseLength === option ? "white" : "$gray8"}
                        marginTop="$1"
                      >
                        {option === "CURTA" ? "1 frase" : option === "MEDIA" ? "2-3 frases" : "4-5 frases"}
                      </Text>
                    </YStack>
                  </Pressable>
                ))}
              </XStack>
            </Card>

            {/* Prohibited Topics */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
                Temas Proibidos
              </Text>
              <Text fontSize="$2" color="$gray8" marginBottom="$3">
                Assuntos que a IA nunca deve mencionar
              </Text>
              <TextInput
                value={prohibitedTopics}
                onChangeText={setProhibitedTopics}
                placeholder="Ex: precos de concorrentes, politica, religiao..."
                placeholderTextColor={theme.gray8.val}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: theme.background.val,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  color: theme.color.val,
                  minHeight: 80,
                  textAlignVertical: "top",
                }}
              />
            </Card>

            {/* Business Hours */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Ionicons name="time-outline" size={20} color={theme.blue10.val} />
                <Text fontSize="$3" fontWeight="600" color="$color">
                  Horario de Atendimento
                </Text>
              </XStack>

              {/* Work Days */}
              <YStack marginBottom="$4">
                <Text fontSize="$2" color="$gray8" marginBottom="$2">Dias de funcionamento</Text>
                <XStack flexWrap="wrap" gap="$2">
                  {[
                    { key: "seg", label: "Seg" },
                    { key: "ter", label: "Ter" },
                    { key: "qua", label: "Qua" },
                    { key: "qui", label: "Qui" },
                    { key: "sex", label: "Sex" },
                    { key: "sab", label: "Sab" },
                    { key: "dom", label: "Dom" },
                  ].map((day) => {
                    const isSelected = workDays.includes(day.key);
                    return (
                      <Pressable
                        key={day.key}
                        onPress={() => {
                          if (isSelected) {
                            setWorkDays(workDays.filter((d) => d !== day.key));
                          } else {
                            setWorkDays([...workDays, day.key]);
                          }
                        }}
                      >
                        <YStack
                          paddingHorizontal="$3"
                          paddingVertical="$2"
                          borderRadius="$3"
                          backgroundColor={isSelected ? "$blue10" : "$background"}
                          borderWidth={1}
                          borderColor={isSelected ? "$blue10" : "$gray6"}
                        >
                          <Text
                            fontSize="$2"
                            fontWeight="600"
                            color={isSelected ? "white" : "$gray8"}
                          >
                            {day.label}
                          </Text>
                        </YStack>
                      </Pressable>
                    );
                  })}
                </XStack>
              </YStack>

              {/* Time Inputs */}
              <XStack gap="$3">
                <YStack flex={1}>
                  <Text fontSize="$2" color="$gray8" marginBottom="$1">Abre as</Text>
                  <XStack
                    backgroundColor="$background"
                    borderRadius="$3"
                    paddingHorizontal="$3"
                    alignItems="center"
                    gap="$2"
                  >
                    <Ionicons name="sunny-outline" size={18} color={theme.yellow10.val} />
                    <TextInput
                      value={businessHoursStart}
                      onChangeText={setBusinessHoursStart}
                      placeholder="09:00"
                      placeholderTextColor={theme.gray8.val}
                      keyboardType="numbers-and-punctuation"
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        fontSize: 16,
                        color: theme.color.val,
                        textAlign: "center",
                      }}
                    />
                  </XStack>
                </YStack>
                <YStack flex={1}>
                  <Text fontSize="$2" color="$gray8" marginBottom="$1">Fecha as</Text>
                  <XStack
                    backgroundColor="$background"
                    borderRadius="$3"
                    paddingHorizontal="$3"
                    alignItems="center"
                    gap="$2"
                  >
                    <Ionicons name="moon-outline" size={18} color={theme.purple10.val} />
                    <TextInput
                      value={businessHoursEnd}
                      onChangeText={setBusinessHoursEnd}
                      placeholder="18:00"
                      placeholderTextColor={theme.gray8.val}
                      keyboardType="numbers-and-punctuation"
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        fontSize: 16,
                        color: theme.color.val,
                        textAlign: "center",
                      }}
                    />
                  </XStack>
                </YStack>
              </XStack>

              <Text fontSize="$1" color="$gray7" marginTop="$3">
                Fora deste horario, a IA informara o horario de funcionamento
              </Text>
            </Card>

            {/* System Prompt */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
                Prompt do Sistema (Avancado)
              </Text>
              <Text fontSize="$2" color="$gray8" marginBottom="$3">
                Instrucoes detalhadas para a IA
              </Text>
              <TextInput
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                placeholder="Voce e um assistente especializado em..."
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
            </Card>

          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
