import { useEffect, useState, useRef } from "react";
import { Pressable, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { router, Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as DocumentPicker from "expo-document-picker";
import { usePersonaStore, type CreatePersonaData, type PersonaKnowledgeFile } from "@/stores/personaStore";

export default function PersonaEditScreen() {
  const theme = useTheme();

  const {
    selectedPersona,
    knowledgeFiles,
    isLoading,
    isUploading,
    fetchDefaultPersona,
    createPersona,
    updatePersona,
    fetchKnowledgeFiles,
    uploadKnowledgeFile,
    deleteKnowledgeFile,
  } = usePersonaStore();

  // Form state
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [greetingMessage, setGreetingMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [formalityLevel, setFormalityLevel] = useState(50);
  const [persuasiveness, setPersuasiveness] = useState(50);
  const [energyLevel, setEnergyLevel] = useState(50);
  const [empathyLevel, setEmpathyLevel] = useState(70);
  const [responseLength, setResponseLength] = useState<"CURTA" | "MEDIA" | "LONGA">("MEDIA");
  const [prohibitedTopics, setProhibitedTopics] = useState("");
  const [businessHoursStart, setBusinessHoursStart] = useState("09:00");
  const [businessHoursEnd, setBusinessHoursEnd] = useState("18:00");
  const [customInstructions, setCustomInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);
  const loadedPersonaId = useRef<string | null>(null);

  // Load default persona on mount
  useEffect(() => {
    loadPersona();
  }, []);

  const loadPersona = async () => {
    const persona = await fetchDefaultPersona();
    if (persona) {
      loadedPersonaId.current = persona.id;
      // Load knowledge files
      fetchKnowledgeFiles(persona.id);
    }
  };

  // Populate form when persona is loaded
  useEffect(() => {
    if (selectedPersona && !formInitialized) {
      setName(selectedPersona.name);
      setBusinessName(selectedPersona.businessName || "");
      setGreetingMessage(selectedPersona.greetingMessage || "");
      setSystemPrompt(selectedPersona.systemPrompt || "");
      setFormalityLevel(selectedPersona.formalityLevel ?? 50);
      setPersuasiveness(selectedPersona.persuasiveness ?? 50);
      setEnergyLevel(selectedPersona.energyLevel ?? 50);
      setEmpathyLevel(selectedPersona.empathyLevel ?? 70);
      setResponseLength(selectedPersona.responseLength || "MEDIA");
      setProhibitedTopics(selectedPersona.prohibitedTopics || "");
      setBusinessHoursStart(selectedPersona.businessHoursStart || "09:00");
      setBusinessHoursEnd(selectedPersona.businessHoursEnd || "18:00");
      setCustomInstructions(selectedPersona.customInstructions || "");
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
      systemPrompt: systemPrompt.trim() || undefined,
      formalityLevel,
      persuasiveness,
      energyLevel,
      empathyLevel,
      responseLength,
      prohibitedTopics: prohibitedTopics.trim() || undefined,
      businessHoursStart: businessHoursStart || undefined,
      businessHoursEnd: businessHoursEnd || undefined,
      customInstructions: customInstructions.trim() || undefined,
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

  const handlePickFile = async () => {
    if (!selectedPersona?.id) {
      Alert.alert("Erro", "Salve a persona primeiro antes de adicionar arquivos");
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "text/plain",
          "text/csv",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        await uploadKnowledgeFile(selectedPersona.id, {
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType || "application/octet-stream",
        });
        Alert.alert("Sucesso", "Arquivo enviado com sucesso");
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Erro ao enviar arquivo");
    }
  };

  const handleDeleteFile = (file: PersonaKnowledgeFile) => {
    if (!selectedPersona?.id) return;

    Alert.alert("Confirmar", `Remover arquivo "${file.fileName}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => deleteKnowledgeFile(selectedPersona.id, file.id),
      },
    ]);
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
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
                Mensagem de Saudacao
              </Text>
              <Text fontSize="$2" color="$gray8" marginBottom="$3">
                Primeira mensagem para novos contatos
              </Text>
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
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$3">
                Horario de Atendimento
              </Text>
              <XStack gap="$3">
                <YStack flex={1}>
                  <Text fontSize="$2" color="$gray8" marginBottom="$1">Inicio</Text>
                  <TextInput
                    value={businessHoursStart}
                    onChangeText={setBusinessHoursStart}
                    placeholder="09:00"
                    placeholderTextColor={theme.gray8.val}
                    style={{
                      backgroundColor: theme.background.val,
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      color: theme.color.val,
                      textAlign: "center",
                    }}
                  />
                </YStack>
                <YStack flex={1}>
                  <Text fontSize="$2" color="$gray8" marginBottom="$1">Fim</Text>
                  <TextInput
                    value={businessHoursEnd}
                    onChangeText={setBusinessHoursEnd}
                    placeholder="18:00"
                    placeholderTextColor={theme.gray8.val}
                    style={{
                      backgroundColor: theme.background.val,
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      color: theme.color.val,
                      textAlign: "center",
                    }}
                  />
                </YStack>
              </XStack>
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

            {/* Custom Instructions */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
                Instrucoes Adicionais
              </Text>
              <Text fontSize="$2" color="$gray8" marginBottom="$3">
                Regras especificas do seu negocio
              </Text>
              <TextInput
                value={customInstructions}
                onChangeText={setCustomInstructions}
                placeholder="Ex: Nosso prazo de entrega e de 3-5 dias uteis..."
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

            {/* Knowledge Files */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                <YStack>
                  <Text fontSize="$3" fontWeight="600" color="$color">
                    Arquivos de Conhecimento
                  </Text>
                  <Text fontSize="$2" color="$gray8" marginTop="$1">
                    PDFs, docs com informacoes do negocio
                  </Text>
                </YStack>
                <Pressable onPress={handlePickFile} disabled={isUploading}>
                  {isUploading ? (
                    <ActivityIndicator size="small" color={theme.blue10.val} />
                  ) : (
                    <XStack
                      backgroundColor="$blue10"
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      borderRadius="$3"
                      gap="$1"
                      alignItems="center"
                    >
                      <Ionicons name="add" size={18} color="white" />
                      <Text color="white" fontWeight="600" fontSize="$3">Adicionar</Text>
                    </XStack>
                  )}
                </Pressable>
              </XStack>

              {knowledgeFiles.length === 0 ? (
                <YStack
                  padding="$4"
                  backgroundColor="$background"
                  borderRadius="$3"
                  alignItems="center"
                >
                  <Ionicons name="document-outline" size={32} color={theme.gray7.val} />
                  <Text color="$gray8" marginTop="$2" textAlign="center">
                    Nenhum arquivo adicionado
                  </Text>
                  <Text color="$gray7" fontSize="$2" marginTop="$1" textAlign="center">
                    Adicione PDFs ou documentos para a IA usar como referencia
                  </Text>
                </YStack>
              ) : (
                <YStack gap="$2">
                  {knowledgeFiles.map((file) => (
                    <XStack
                      key={file.id}
                      padding="$3"
                      backgroundColor="$background"
                      borderRadius="$3"
                      alignItems="center"
                      gap="$3"
                    >
                      <Ionicons
                        name={file.mimeType === "application/pdf" ? "document-text" : "document"}
                        size={24}
                        color={theme.blue10.val}
                      />
                      <YStack flex={1}>
                        <Text color="$color" fontSize="$3" numberOfLines={1}>
                          {file.fileName}
                        </Text>
                        <Text color="$gray8" fontSize="$2">
                          {new Date(file.createdAt).toLocaleDateString("pt-BR")}
                        </Text>
                      </YStack>
                      <Pressable onPress={() => handleDeleteFile(file)}>
                        <Ionicons name="trash-outline" size={20} color={theme.red10.val} />
                      </Pressable>
                    </XStack>
                  ))}
                </YStack>
              )}
            </Card>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
