import { useEffect, useState, useRef } from "react";
import { Pressable, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Switch, Modal, Animated as RNAnimated } from "react-native";
import { router, Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import { usePersonaStore, type CreatePersonaData } from "@/stores/personaStore";
import { api } from "@/services/api";

export default function PersonaEditScreen() {
  const theme = useTheme();

  const {
    selectedPersona,
    isLoading,
    fetchDefaultPersona,
    createPersona,
    updatePersona,
    generateFromDescription,
    generateFromAudio,
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

  // Notification phone
  const [notificationPhone, setNotificationPhone] = useState("");
  const [phoneSaved, setPhoneSaved] = useState(false);

  // Conversation style
  const [conversationStyle, setConversationStyle] = useState("");
  const [analyzingStyle, setAnalyzingStyle] = useState(false);

  // AI Generation modal
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiDescription, setAIDescription] = useState("");
  const [generating, setGenerating] = useState(false);

  // Audio recording
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Robot building animation
  const [buildStep, setBuildStep] = useState(0);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const buildSteps = [
    { icon: "hardware-chip-outline" as const, text: "Analisando seu negocio..." },
    { icon: "construct-outline" as const, text: "Montando o cerebro do Watson..." },
    { icon: "chatbubbles-outline" as const, text: "Configurando personalidade..." },
    { icon: "time-outline" as const, text: "Ajustando horarios e regras..." },
    { icon: "checkmark-done-outline" as const, text: "Finalizando configuracao..." },
  ];

  useEffect(() => {
    if (generating) {
      setBuildStep(0);
      const interval = setInterval(() => {
        setBuildStep((prev) => (prev < buildSteps.length - 1 ? prev + 1 : prev));
      }, 2200);
      // Pulse animation
      const pulse = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          RNAnimated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => {
        clearInterval(interval);
        pulse.stop();
        pulseAnim.setValue(1);
      };
    } else {
      setBuildStep(0);
    }
  }, [generating]);

  // Load default persona + notification phone on mount
  useEffect(() => {
    loadPersona();
    loadNotificationPhone();
  }, []);

  const loadNotificationPhone = async () => {
    try {
      const res = await api.get<{ success: boolean; data: { notificationPhone?: string } }>("/auth/me");
      if (res.data.success && res.data.data.notificationPhone) {
        setNotificationPhone(res.data.data.notificationPhone);
      }
    } catch {}
  };

  const saveNotificationPhone = async () => {
    try {
      await api.patch("/auth/notification-phone", { notificationPhone: notificationPhone.trim() });
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 3000);
    } catch {
      Alert.alert("Erro", "Nao foi possivel salvar o numero");
    }
  };

  const handleUploadConversationStyle = async () => {
    if (!selectedPersona?.id) {
      Alert.alert("Erro", "Salve a persona primeiro antes de anexar prints");
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const files = result.assets.slice(0, 5);

      if (result.assets.length > 5) {
        Alert.alert("Aviso", "Maximo de 5 imagens. Apenas as 5 primeiras serao usadas.");
      }

      setAnalyzingStyle(true);

      const formData = new FormData();
      files.forEach((file, i) => {
        formData.append("file", {
          uri: file.uri,
          name: file.name || `screenshot_${i + 1}.jpg`,
          type: file.mimeType || "image/jpeg",
        } as any);
      });

      const res = await api.post<{ success: boolean; style: string }>(
        `/personas/${selectedPersona.id}/conversation-style`,
        formData
      );

      if (res.data.success && res.data.style) {
        setConversationStyle(res.data.style);
        Alert.alert("Sucesso", `Estilo e fluxo extraidos de ${files.length} print${files.length > 1 ? "s" : ""}!`);
      }
    } catch (error: any) {
      Alert.alert("Erro", error?.response?.data?.error?.message || "Nao foi possivel analisar as imagens");
    } finally {
      setAnalyzingStyle(false);
    }
  };

  const handleRemoveConversationStyle = async () => {
    if (!selectedPersona?.id) return;

    Alert.alert("Remover estilo", "Deseja remover o estilo de conversa?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/personas/${selectedPersona.id}/conversation-style`);
            setConversationStyle("");
          } catch {
            Alert.alert("Erro", "Nao foi possivel remover");
          }
        },
      },
    ]);
  };

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
      setConversationStyle((selectedPersona as any).conversationStyle || "");
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

  const applyGenerated = (generated: any) => {
    // Only set name/businessName if user hasn't filled them
    if (!name.trim() && generated.name) setName(generated.name);
    if (!businessName.trim() && generated.businessName) setBusinessName(generated.businessName);
    setSystemPrompt(generated.systemPrompt);
    setGreetingMessage(generated.greetingMessage);
    setGreetingEnabled(true);
    setFormalityLevel(generated.formalityLevel);
    setPersuasiveness(generated.persuasiveness);
    setEnergyLevel(generated.energyLevel);
    setEmpathyLevel(generated.empathyLevel);
    setResponseLength(generated.responseLength);
    setProhibitedTopics(generated.prohibitedTopics);
    // Apply business hours and work days if AI generated them
    if (generated.businessHoursStart) setBusinessHoursStart(generated.businessHoursStart);
    if (generated.businessHoursEnd) setBusinessHoursEnd(generated.businessHoursEnd);
    if (generated.workDays && generated.workDays.length > 0) setWorkDays(generated.workDays);
    setShowAIModal(false);
    setAIDescription("");
    Alert.alert("Pronto!", "A IA configurou tudo automaticamente. Revise os campos e clique em Salvar.");
  };

  const startRecording = async () => {
    try {
      // Clean up any previous recording first
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch {}
        setRecording(null);
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permissao", "Precisamos de permissao para gravar audio");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimer.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Erro", "Nao foi possivel iniciar a gravacao");
    }
  };

  const stopAndSendRecording = async () => {
    if (!recording) return;

    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }

    setIsRecording(false);
    setGenerating(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      // Reset audio mode so next recording works properly
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (!uri) {
        Alert.alert("Erro", "Nao foi possivel salvar o audio");
        setGenerating(false);
        return;
      }

      const generated = await generateFromAudio(
        uri,
        name.trim() || undefined,
        businessName.trim() || undefined
      );
      applyGenerated(generated);
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Erro ao processar audio. Tente novamente.");
    }
    setGenerating(false);
    setRecordingDuration(0);
  };

  const cancelRecording = async () => {
    if (!recording) return;

    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }

    try {
      await recording.stopAndUnloadAsync();
      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch {}
    setRecording(null);
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleGenerateWithAI = async () => {
    if (!aiDescription.trim() || aiDescription.trim().length < 10) {
      Alert.alert("Erro", "Descreva seu negocio com mais detalhes (minimo 10 caracteres)");
      return;
    }

    setGenerating(true);
    try {
      const generated = await generateFromDescription(
        aiDescription.trim(),
        name.trim() || undefined,
        businessName.trim() || undefined
      );
      applyGenerated(generated);
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
            {/* Conversation Style + Flow - FIRST so AI knows the pattern */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Ionicons name="chatbubbles-outline" size={20} color="#8b5cf6" />
                <YStack flex={1}>
                  <Text fontSize="$3" fontWeight="600" color="$color">
                    Estilo e Fluxo de Conversa
                  </Text>
                  <Text fontSize="$2" color="$gray8">
                    Anexe ate 5 prints para a IA se inspirar no fluxo
                  </Text>
                </YStack>
              </XStack>

              {analyzingStyle ? (
                <YStack alignItems="center" padding="$4" gap="$2">
                  <ActivityIndicator size="large" color="#8b5cf6" />
                  <Text fontSize="$2" color="$gray8">Analisando estilo e fluxo da conversa...</Text>
                </YStack>
              ) : conversationStyle ? (
                <YStack gap="$2">
                  <YStack
                    backgroundColor="$background"
                    borderRadius={8}
                    padding="$3"
                    borderWidth={1}
                    borderColor="$gray6"
                  >
                    <Text fontSize="$2" color="$gray8" numberOfLines={8}>
                      {conversationStyle}
                    </Text>
                  </YStack>
                  <XStack gap="$2">
                    <Pressable
                      onPress={handleUploadConversationStyle}
                      style={{
                        flex: 1,
                        backgroundColor: "#8b5cf6",
                        borderRadius: 8,
                        paddingVertical: 10,
                        alignItems: "center",
                      }}
                    >
                      <Text color="white" fontWeight="600" fontSize="$2">Trocar Prints</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleRemoveConversationStyle}
                      style={{
                        borderRadius: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        borderWidth: 1,
                        borderColor: theme.red10.val,
                        alignItems: "center",
                      }}
                    >
                      <Text color="$red10" fontWeight="600" fontSize="$2">Remover</Text>
                    </Pressable>
                  </XStack>
                </YStack>
              ) : (
                <Pressable
                  onPress={handleUploadConversationStyle}
                  style={{
                    borderWidth: 2,
                    borderColor: "#8b5cf6",
                    borderStyle: "dashed",
                    borderRadius: 8,
                    paddingVertical: 20,
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="images-outline" size={32} color="#8b5cf6" />
                  <Text color="#8b5cf6" fontWeight="600" marginTop="$2">
                    Anexar Prints de Conversa
                  </Text>
                  <Text fontSize="$1" color="$gray8" marginTop="$1">
                    Ate 5 imagens - PNG, JPG ou WebP
                  </Text>
                </Pressable>
              )}
            </Card>

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
                  <Text fontSize="$2" color="$gray8" marginBottom="$1">Nome do Watson</Text>
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
                      Texto ou audio - a IA configura o Watson para voce
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
                  <Pressable onPress={() => !generating && !isRecording && setShowAIModal(false)}>
                    <Text color="$gray8" fontSize="$4">Cancelar</Text>
                  </Pressable>
                  <Text fontSize="$5" fontWeight="700" color={theme.color.val}>
                    Configurar com IA
                  </Text>
                  <YStack width={60} />
                </XStack>

                  {generating ? (
                  /* Robot Building Animation */
                  <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
                    <RNAnimated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 24 }}>
                      <YStack
                        width={100}
                        height={100}
                        borderRadius={50}
                        backgroundColor="$blue10"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Ionicons name="hardware-chip" size={50} color="white" />
                      </YStack>
                    </RNAnimated.View>

                    <Text fontSize="$5" fontWeight="700" color={theme.color.val} textAlign="center" marginBottom="$2">
                      Montando seu Watson
                    </Text>
                    <Text fontSize="$2" color="$gray8" textAlign="center" marginBottom="$6">
                      Aguarde enquanto a IA configura tudo
                    </Text>

                    <YStack gap="$3" width="100%" paddingHorizontal="$2">
                      {buildSteps.map((step, index) => {
                        const isDone = index < buildStep;
                        const isCurrent = index === buildStep;
                        const isPending = index > buildStep;
                        return (
                          <XStack
                            key={index}
                            alignItems="center"
                            gap="$3"
                            opacity={isPending ? 0.3 : 1}
                            paddingVertical="$2"
                            paddingHorizontal="$3"
                            borderRadius="$3"
                            backgroundColor={isCurrent ? "$blue3" : "transparent"}
                          >
                            <YStack
                              width={36}
                              height={36}
                              borderRadius={18}
                              backgroundColor={isDone ? "$green9" : isCurrent ? "$blue10" : "$gray6"}
                              alignItems="center"
                              justifyContent="center"
                            >
                              {isDone ? (
                                <Ionicons name="checkmark" size={20} color="white" />
                              ) : isCurrent ? (
                                <ActivityIndicator size="small" color="white" />
                              ) : (
                                <Ionicons name={step.icon} size={18} color={theme.gray8.val} />
                              )}
                            </YStack>
                            <Text
                              fontSize="$3"
                              fontWeight={isCurrent ? "700" : "400"}
                              color={isDone ? "$green9" : isCurrent ? "$blue10" : "$gray8"}
                              flex={1}
                            >
                              {isDone ? step.text.replace("...", " OK!") : step.text}
                            </Text>
                          </XStack>
                        );
                      })}
                    </YStack>
                  </YStack>
                ) : (
                  <>
                    <YStack
                      alignItems="center"
                      padding="$3"
                      marginBottom="$3"
                    >
                      <YStack
                        width={56}
                        height={56}
                        borderRadius={28}
                        backgroundColor="$blue10"
                        alignItems="center"
                        justifyContent="center"
                        marginBottom="$2"
                      >
                        <Ionicons name="sparkles" size={28} color="white" />
                      </YStack>
                      <Text fontSize="$4" fontWeight="600" color={theme.color.val} textAlign="center">
                        Conte sobre sua empresa e como o Watson vai trabalhar para voce
                      </Text>
                      <Text fontSize="$2" color="$gray8" textAlign="center" marginTop="$2">
                        Digite ou grave um audio descrevendo seu negocio
                      </Text>
                    </YStack>

                    {/* Audio Recording Section */}
                    {isRecording ? (
                      <YStack alignItems="center" padding="$4" marginBottom="$3">
                        <YStack
                          width={80}
                          height={80}
                          borderRadius={40}
                          backgroundColor="$red10"
                          alignItems="center"
                          justifyContent="center"
                          marginBottom="$3"
                        >
                          <Ionicons name="mic" size={40} color="white" />
                        </YStack>
                        <Text fontSize="$6" fontWeight="700" color="$red10" marginBottom="$1">
                          {formatDuration(recordingDuration)}
                        </Text>
                        <Text fontSize="$2" color="$gray8" marginBottom="$4">
                          Gravando... Fale sobre seu negocio
                        </Text>
                        <XStack gap="$3">
                          <Pressable onPress={cancelRecording}>
                            <XStack
                              backgroundColor="$gray6"
                              paddingVertical="$3"
                              paddingHorizontal="$5"
                              borderRadius="$4"
                              alignItems="center"
                              gap="$2"
                            >
                              <Ionicons name="close" size={18} color={theme.color.val} />
                              <Text color="$color" fontWeight="600">Cancelar</Text>
                            </XStack>
                          </Pressable>
                          <Pressable onPress={stopAndSendRecording}>
                            <XStack
                              backgroundColor="$blue10"
                              paddingVertical="$3"
                              paddingHorizontal="$5"
                              borderRadius="$4"
                              alignItems="center"
                              gap="$2"
                            >
                              <Ionicons name="checkmark" size={18} color="white" />
                              <Text color="white" fontWeight="600">Enviar</Text>
                            </XStack>
                          </Pressable>
                        </XStack>
                      </YStack>
                    ) : (
                      <>
                        {/* Mic Button */}
                        <Pressable onPress={startRecording}>
                          <XStack
                            backgroundColor="$green9"
                            paddingVertical="$3"
                            borderRadius="$4"
                            alignItems="center"
                            justifyContent="center"
                            gap="$2"
                            marginBottom="$3"
                          >
                            <Ionicons name="mic" size={22} color="white" />
                            <Text color="white" fontWeight="700" fontSize="$4">
                              Gravar Audio
                            </Text>
                          </XStack>
                        </Pressable>

                        <XStack alignItems="center" gap="$3" marginBottom="$3">
                          <YStack flex={1} height={1} backgroundColor="$gray6" />
                          <Text fontSize="$2" color="$gray8">ou digite</Text>
                          <YStack flex={1} height={1} backgroundColor="$gray6" />
                        </XStack>

                        <TextInput
                          value={aiDescription}
                          onChangeText={setAIDescription}
                          placeholder="Ex: Tenho uma barbearia no centro de BH chamada BarberKing. Atendo homens de 20-40 anos, cortes modernos, barba e sobrancelha..."
                          placeholderTextColor={theme.gray8.val}
                          multiline
                          numberOfLines={6}
                          style={{
                            backgroundColor: theme.backgroundStrong?.val || "#1a1a1a",
                            borderRadius: 12,
                            padding: 16,
                            fontSize: 16,
                            color: theme.color.val,
                            minHeight: 140,
                            textAlignVertical: "top",
                            borderWidth: 1,
                            borderColor: theme.gray6.val,
                          }}
                        />

                        <Pressable
                          onPress={handleGenerateWithAI}
                          disabled={!aiDescription.trim()}
                          style={{ marginTop: 16 }}
                        >
                          <XStack
                            backgroundColor={!aiDescription.trim() ? "$gray6" : "$blue10"}
                            paddingVertical="$3"
                            borderRadius="$4"
                            alignItems="center"
                            justifyContent="center"
                            gap="$2"
                          >
                            <Ionicons name="sparkles" size={20} color="white" />
                            <Text color="white" fontWeight="700" fontSize="$4">
                              Gerar com IA
                            </Text>
                          </XStack>
                        </Pressable>
                      </>
                    )}

                    <Text fontSize="$1" color="$gray7" marginTop="$3" textAlign="center">
                      Quanto mais detalhes, melhor sera a configuracao
                    </Text>
                  </>
                )}
              </YStack>
            </Modal>

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

            {/* Notification Phone */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Ionicons name="notifications-outline" size={20} color={theme.blue10.val} />
                <YStack>
                  <Text fontSize="$3" fontWeight="600" color="$color">
                    Numero para Avisos
                  </Text>
                  <Text fontSize="$2" color="$gray8">
                    Receba avisos por WhatsApp quando a IA transferir
                  </Text>
                </YStack>
              </XStack>

              <XStack gap="$2" alignItems="center">
                <TextInput
                  value={notificationPhone}
                  onChangeText={setNotificationPhone}
                  placeholder="11999998888"
                  placeholderTextColor={theme.gray8.val}
                  keyboardType="phone-pad"
                  style={{
                    flex: 1,
                    backgroundColor: theme.background.val,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 16,
                    color: theme.color.val,
                    borderWidth: 1,
                    borderColor: theme.gray6.val,
                  }}
                />
                <Pressable
                  onPress={saveNotificationPhone}
                  style={{
                    backgroundColor: theme.blue10.val,
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <Text color="white" fontWeight="600">Salvar</Text>
                </Pressable>
              </XStack>

              {phoneSaved && (
                <XStack alignItems="center" gap="$1" marginTop="$2">
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text fontSize="$2" color="#10b981">Numero salvo!</Text>
                </XStack>
              )}

              <Text fontSize="$1" color="$gray7" marginTop="$2">
                Se nao configurar, o aviso vai pro numero do WhatsApp conectado
              </Text>
            </Card>

          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
