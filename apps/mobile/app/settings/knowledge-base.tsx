import { useEffect, useState, useRef, useCallback } from "react";
import { Pressable, Alert, ActivityIndicator, TextInput, Modal, View } from "react-native";
import { Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, Input, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { usePersonaStore, type PersonaKnowledgeFile, type FAQ } from "@/stores/personaStore";
import { useAppColors } from "@/hooks/useAppColors";

export default function KnowledgeBaseScreen() {
  const theme = useTheme();
  const { primary } = useAppColors();

  const {
    selectedPersona,
    knowledgeFiles,
    faqs,
    isLoading,
    isUploading,
    fetchDefaultPersona,
    fetchKnowledgeFiles,
    uploadKnowledgeFile,
    deleteKnowledgeFile,
    fetchFaqs,
    createFaq,
    deleteFaq,
    updatePersona,
  } = usePersonaStore();

  const [customInstructions, setCustomInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  // FAQ modal state
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqAudioBase64, setFaqAudioBase64] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [savingFaq, setSavingFaq] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedPersona && !formInitialized) {
      setCustomInstructions(selectedPersona.customInstructions || "");
      setFormInitialized(true);
    }
  }, [selectedPersona, formInitialized]);

  const loadData = async () => {
    const persona = await fetchDefaultPersona();
    if (persona) {
      fetchKnowledgeFiles(persona.id);
    }
    fetchFaqs();
  };

  const handleSaveInstructions = async () => {
    if (!selectedPersona?.id) return;

    setSaving(true);
    try {
      await updatePersona(selectedPersona.id, {
        customInstructions: customInstructions.trim() || undefined,
      });
      Alert.alert("Sucesso", "Instrucoes salvas com sucesso");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Erro ao salvar instrucoes");
    }
    setSaving(false);
  };

  const handlePickFile = async () => {
    if (!selectedPersona?.id) {
      Alert.alert("Erro", "Nenhuma persona encontrada. Crie uma persona primeiro.");
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
        Alert.alert("Sucesso", "Arquivo enviado com sucesso! O Watson IA agora pode usar estas informacoes.");
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

  // === FAQ Audio Recording ===
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissao necessaria", "Permita o acesso ao microfone para gravar audio.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 120) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Erro", "Nao foi possivel iniciar a gravacao");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      if (uri) {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setFaqAudioBase64(`data:audio/mp4;base64,${base64}`);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsRecording(false);
    }
  };

  const playPreview = async () => {
    if (!faqAudioBase64) return;

    try {
      if (isPlayingPreview && previewSoundRef.current) {
        await previewSoundRef.current.stopAsync();
        await previewSoundRef.current.unloadAsync();
        previewSoundRef.current = null;
        setIsPlayingPreview(false);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: faqAudioBase64 },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlayingPreview(false);
            sound.unloadAsync();
            previewSoundRef.current = null;
          }
        }
      );

      previewSoundRef.current = sound;
      setIsPlayingPreview(true);
    } catch (error) {
      console.error("Failed to play preview:", error);
    }
  };

  const removeAudio = () => {
    setFaqAudioBase64(null);
    setRecordingDuration(0);
  };

  const resetFaqModal = () => {
    setFaqQuestion("");
    setFaqAnswer("");
    setFaqAudioBase64(null);
    setRecordingDuration(0);
    setIsRecording(false);
    setIsPlayingPreview(false);
    if (previewSoundRef.current) {
      previewSoundRef.current.unloadAsync();
      previewSoundRef.current = null;
    }
  };

  const handleSaveFaq = async () => {
    if (!faqQuestion.trim()) {
      Alert.alert("Erro", "Digite a pergunta do FAQ");
      return;
    }
    if (!faqAnswer.trim() && !faqAudioBase64) {
      Alert.alert("Erro", "Adicione uma resposta em texto ou grave um audio");
      return;
    }

    setSavingFaq(true);
    try {
      await createFaq({
        question: faqQuestion.trim(),
        answer: faqAnswer.trim() || "[Audio]",
        audioBase64: faqAudioBase64 || undefined,
      });
      resetFaqModal();
      setShowFaqModal(false);
      Alert.alert("Sucesso", "FAQ cadastrado com sucesso!");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Erro ao salvar FAQ");
    }
    setSavingFaq(false);
  };

  const handleDeleteFaq = (faq: FAQ) => {
    Alert.alert("Confirmar", `Remover FAQ "${faq.question}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => deleteFaq(faq.id),
      },
    ]);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === "application/pdf") return "document-text";
    if (mimeType.includes("word")) return "document";
    if (mimeType.includes("text")) return "document-text-outline";
    return "document-outline";
  };

  const getFileColor = (mimeType: string) => {
    if (mimeType === "application/pdf") return "#ef4444";
    if (mimeType.includes("word")) return "#3b82f6";
    if (mimeType.includes("text")) return "#22c55e";
    return theme.gray8.val;
  };

  if (isLoading && !selectedPersona) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={primary} />
        <Text color="$gray8" marginTop="$3">Carregando...</Text>
      </YStack>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Base de Conhecimento",
          headerRight: () => (
            <Pressable onPress={handleSaveInstructions} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={primary} />
              ) : (
                <Text color={primary} fontWeight="600" fontSize="$4">
                  Salvar
                </Text>
              )}
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
              <Ionicons name="bulb-outline" size={24} color={primary} />
              <YStack flex={1}>
                <Text color={primary} fontWeight="600" fontSize="$4">
                  Como funciona?
                </Text>
                <Text color="$color" marginTop="$2" fontSize="$3">
                  Adicione documentos com informacoes sobre seu negocio. O Watson IA vai usar esses arquivos para responder perguntas dos clientes com mais precisao.
                </Text>
              </YStack>
            </XStack>
          </Card>

          {/* ==================== FAQ AUDIO SECTION ==================== */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
              <XStack alignItems="center" gap="$2">
                <Ionicons name="mic-outline" size={20} color={primary} />
                <Text fontSize="$3" fontWeight="600" color="$color">
                  FAQs com Audio
                </Text>
              </XStack>
              <Pressable onPress={() => setShowFaqModal(true)}>
                <XStack
                  backgroundColor={primary}
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius="$3"
                  gap="$1"
                  alignItems="center"
                >
                  <Ionicons name="add" size={18} color="white" />
                  <Text color="white" fontWeight="600" fontSize="$3">Novo</Text>
                </XStack>
              </Pressable>
            </XStack>

            <Text fontSize="$2" color="$gray8" marginBottom="$3">
              Cadastre perguntas com respostas em audio. Quando um cliente perguntar algo que bate com o FAQ, a IA envia o audio automaticamente.
            </Text>

            {faqs.length === 0 ? (
              <YStack
                padding="$5"
                backgroundColor="$background"
                borderRadius="$3"
                alignItems="center"
              >
                <Ionicons name="chatbubble-ellipses-outline" size={44} color={theme.gray6.val} />
                <Text color="$gray8" marginTop="$3" textAlign="center" fontSize="$3">
                  Nenhum FAQ cadastrado
                </Text>
                <Text color="$gray7" fontSize="$2" marginTop="$1" textAlign="center">
                  Toque em "Novo" para adicionar
                </Text>
              </YStack>
            ) : (
              <YStack gap="$3">
                {faqs.map((faq) => (
                  <XStack
                    key={faq.id}
                    padding="$3"
                    backgroundColor="$background"
                    borderRadius="$3"
                    alignItems="center"
                    gap="$3"
                  >
                    <YStack
                      width={44}
                      height={44}
                      borderRadius={8}
                      backgroundColor={faq.audioBase64 ? `${primary}18` : "$backgroundHover"}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Ionicons
                        name={faq.audioBase64 ? "volume-high" : "chatbubble-outline"}
                        size={22}
                        color={faq.audioBase64 ? primary : theme.gray8.val}
                      />
                    </YStack>
                    <YStack flex={1}>
                      <Text color="$color" fontSize="$3" fontWeight="500" numberOfLines={2}>
                        {faq.question}
                      </Text>
                      <XStack alignItems="center" gap="$1" marginTop={2}>
                        {faq.audioBase64 ? (
                          <Text color={primary} fontSize="$2" fontWeight="500">Audio cadastrado</Text>
                        ) : (
                          <Text color="$gray8" fontSize="$2" numberOfLines={1}>{faq.answer}</Text>
                        )}
                      </XStack>
                    </YStack>
                    <Pressable onPress={() => handleDeleteFaq(faq)}>
                      <YStack
                        width={36}
                        height={36}
                        borderRadius={18}
                        backgroundColor="$red5"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </YStack>
                    </Pressable>
                  </XStack>
                ))}
              </YStack>
            )}
          </Card>

          {/* Custom Instructions */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack alignItems="center" gap="$2" marginBottom="$2">
              <Ionicons name="create-outline" size={20} color={primary} />
              <Text fontSize="$3" fontWeight="600" color="$color">
                Instrucoes Adicionais
              </Text>
            </XStack>
            <Text fontSize="$2" color="$gray8" marginBottom="$3">
              Regras especificas do seu negocio que a IA deve seguir
            </Text>
            <TextInput
              value={customInstructions}
              onChangeText={setCustomInstructions}
              placeholder="Ex: Nosso prazo de entrega e de 3-5 dias uteis. Temos frete gratis acima de R$200..."
              placeholderTextColor={theme.gray8.val}
              multiline
              numberOfLines={5}
              style={{
                backgroundColor: theme.background.val,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                color: theme.color.val,
                minHeight: 120,
                textAlignVertical: "top",
              }}
            />
          </Card>

          {/* Supported Formats */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$3">
              Formatos Aceitos
            </Text>
            <XStack flexWrap="wrap" gap="$2">
              <FormatBadge label="PDF" color="#ef4444" />
              <FormatBadge label="Word" color="#3b82f6" />
              <FormatBadge label="TXT" color="#22c55e" />
              <FormatBadge label="CSV" color="#f59e0b" />
            </XStack>
            <Text fontSize="$2" color="$gray7" marginTop="$3">
              Tamanho maximo: 10 MB por arquivo
            </Text>
          </Card>

          {/* Files Section */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
              <YStack>
                <Text fontSize="$3" fontWeight="600" color="$color">
                  Arquivos ({knowledgeFiles.length})
                </Text>
              </YStack>
              <Pressable onPress={handlePickFile} disabled={isUploading}>
                {isUploading ? (
                  <ActivityIndicator size="small" color={primary} />
                ) : (
                  <XStack
                    backgroundColor={primary}
                    paddingHorizontal="$3"
                    paddingVertical="$2"
                    borderRadius="$3"
                    gap="$1"
                    alignItems="center"
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color="white" />
                    <Text color="white" fontWeight="600" fontSize="$3">Enviar</Text>
                  </XStack>
                )}
              </Pressable>
            </XStack>

            {knowledgeFiles.length === 0 ? (
              <YStack
                padding="$6"
                backgroundColor="$background"
                borderRadius="$3"
                alignItems="center"
              >
                <Ionicons name="folder-open-outline" size={48} color={theme.gray6.val} />
                <Text color="$gray8" marginTop="$3" textAlign="center" fontSize="$4">
                  Nenhum arquivo adicionado
                </Text>
                <Text color="$gray7" fontSize="$2" marginTop="$2" textAlign="center">
                  Envie PDFs, documentos ou arquivos de texto para o Watson aprender sobre seu negocio
                </Text>
                <Pressable onPress={handlePickFile} disabled={isUploading}>
                  <XStack
                    backgroundColor={primary}
                    paddingHorizontal="$4"
                    paddingVertical="$3"
                    borderRadius="$3"
                    gap="$2"
                    alignItems="center"
                    marginTop="$4"
                  >
                    <Ionicons name="add" size={20} color="white" />
                    <Text color="white" fontWeight="600" fontSize="$4">Adicionar Arquivo</Text>
                  </XStack>
                </Pressable>
              </YStack>
            ) : (
              <YStack gap="$3">
                {knowledgeFiles.map((file) => (
                  <XStack
                    key={file.id}
                    padding="$3"
                    backgroundColor="$background"
                    borderRadius="$3"
                    alignItems="center"
                    gap="$3"
                  >
                    <YStack
                      width={44}
                      height={44}
                      borderRadius={8}
                      backgroundColor="$backgroundHover"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Ionicons
                        name={getFileIcon(file.mimeType) as any}
                        size={24}
                        color={getFileColor(file.mimeType)}
                      />
                    </YStack>
                    <YStack flex={1}>
                      <Text color="$color" fontSize="$3" fontWeight="500" numberOfLines={1}>
                        {file.fileName}
                      </Text>
                      <Text color="$gray8" fontSize="$2">
                        Enviado em {new Date(file.createdAt).toLocaleDateString("pt-BR")}
                      </Text>
                    </YStack>
                    <Pressable onPress={() => handleDeleteFile(file)}>
                      <YStack
                        width={36}
                        height={36}
                        borderRadius={18}
                        backgroundColor="$red5"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </YStack>
                    </Pressable>
                  </XStack>
                ))}
              </YStack>
            )}
          </Card>

          {/* Tips */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$3">
              Dicas para melhores resultados
            </Text>
            <YStack gap="$3">
              <TipItem
                icon="checkmark-circle"
                text="Envie catalogos de produtos com precos e descricoes"
              />
              <TipItem
                icon="checkmark-circle"
                text="Cadastre FAQs com audio para respostas mais humanizadas"
              />
              <TipItem
                icon="checkmark-circle"
                text="Adicione politicas de entrega, troca e garantia"
              />
              <TipItem
                icon="checkmark-circle"
                text="Mantenha os arquivos atualizados"
              />
            </YStack>
          </Card>
        </YStack>
      </ScrollView>

      {/* ==================== FAQ MODAL ==================== */}
      <Modal
        visible={showFaqModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          resetFaqModal();
          setShowFaqModal(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: theme.background.val }}>
          {/* Modal Header */}
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            alignItems="center"
            justifyContent="space-between"
            borderBottomWidth={1}
            borderBottomColor="$borderColor"
          >
            <Pressable onPress={() => { resetFaqModal(); setShowFaqModal(false); }}>
              <Text color="$gray8" fontSize="$4">Cancelar</Text>
            </Pressable>
            <Text fontWeight="700" fontSize="$4" color="$color">Novo FAQ</Text>
            <Pressable onPress={handleSaveFaq} disabled={savingFaq}>
              {savingFaq ? (
                <ActivityIndicator size="small" color={primary} />
              ) : (
                <Text color={primary} fontWeight="600" fontSize="$4">Salvar</Text>
              )}
            </Pressable>
          </XStack>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          >
            <YStack gap="$4">
              {/* Question */}
              <YStack>
                <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
                  Pergunta do cliente
                </Text>
                <TextInput
                  value={faqQuestion}
                  onChangeText={setFaqQuestion}
                  placeholder="Ex: Qual o horario de funcionamento?"
                  placeholderTextColor={theme.gray8.val}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: theme.backgroundStrong?.val || "#f5f5f5",
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: theme.color.val,
                    minHeight: 80,
                    textAlignVertical: "top",
                  }}
                />
              </YStack>

              {/* Answer Text (optional) */}
              <YStack>
                <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
                  Resposta em texto (opcional)
                </Text>
                <TextInput
                  value={faqAnswer}
                  onChangeText={setFaqAnswer}
                  placeholder="Ex: Funcionamos de seg a sex das 9h as 18h"
                  placeholderTextColor={theme.gray8.val}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: theme.backgroundStrong?.val || "#f5f5f5",
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: theme.color.val,
                    minHeight: 80,
                    textAlignVertical: "top",
                  }}
                />
              </YStack>

              {/* Audio Recording */}
              <YStack>
                <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
                  Resposta em audio
                </Text>
                <Text fontSize="$2" color="$gray8" marginBottom="$3">
                  Grave um audio que sera enviado automaticamente quando o cliente fizer essa pergunta
                </Text>

                {!faqAudioBase64 ? (
                  // Recording controls
                  <YStack alignItems="center" gap="$3">
                    {isRecording ? (
                      // Recording in progress
                      <YStack alignItems="center" gap="$3" width="100%">
                        <XStack
                          backgroundColor="#fee2e2"
                          borderRadius="$4"
                          padding="$4"
                          width="100%"
                          alignItems="center"
                          justifyContent="center"
                          gap="$3"
                        >
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: "#ef4444",
                            }}
                          />
                          <Text color="#dc2626" fontWeight="700" fontSize={20}>
                            {formatDuration(recordingDuration)}
                          </Text>
                        </XStack>

                        <Pressable onPress={stopRecording}>
                          <YStack
                            width={64}
                            height={64}
                            borderRadius={32}
                            backgroundColor="#ef4444"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Ionicons name="stop" size={28} color="white" />
                          </YStack>
                        </Pressable>
                        <Text color="$gray8" fontSize="$2">Toque para parar</Text>
                      </YStack>
                    ) : (
                      // Start recording button
                      <YStack alignItems="center" gap="$2">
                        <Pressable onPress={startRecording}>
                          <YStack
                            width={72}
                            height={72}
                            borderRadius={36}
                            backgroundColor={`${primary}18`}
                            alignItems="center"
                            justifyContent="center"
                            borderWidth={2}
                            borderColor={primary}
                          >
                            <Ionicons name="mic" size={32} color={primary} />
                          </YStack>
                        </Pressable>
                        <Text color="$gray8" fontSize="$2">Toque para gravar (max 2min)</Text>
                      </YStack>
                    )}
                  </YStack>
                ) : (
                  // Audio preview
                  <XStack
                    backgroundColor={`${primary}12`}
                    borderRadius="$4"
                    padding="$3"
                    alignItems="center"
                    gap="$3"
                  >
                    <Pressable onPress={playPreview}>
                      <YStack
                        width={48}
                        height={48}
                        borderRadius={24}
                        backgroundColor={primary}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Ionicons
                          name={isPlayingPreview ? "pause" : "play"}
                          size={24}
                          color="white"
                        />
                      </YStack>
                    </Pressable>

                    <YStack flex={1}>
                      <Text color="$color" fontWeight="500" fontSize="$3">
                        Audio gravado
                      </Text>
                      <Text color="$gray8" fontSize="$2">
                        {formatDuration(recordingDuration)} - Toque para ouvir
                      </Text>
                    </YStack>

                    <Pressable onPress={removeAudio}>
                      <YStack
                        width={36}
                        height={36}
                        borderRadius={18}
                        backgroundColor="$red5"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </YStack>
                    </Pressable>
                  </XStack>
                )}
              </YStack>

              {/* Info */}
              <Card padding="$3" backgroundColor="$teal5" borderRadius="$3">
                <XStack gap="$2" alignItems="flex-start">
                  <Ionicons name="information-circle-outline" size={20} color={primary} />
                  <Text color="$color" fontSize="$2" flex={1}>
                    Se voce gravar audio, quando o cliente perguntar algo parecido, a IA vai enviar o audio automaticamente como mensagem de voz no WhatsApp.
                  </Text>
                </XStack>
              </Card>
            </YStack>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function FormatBadge({ label, color }: { label: string; color: string }) {
  return (
    <YStack
      backgroundColor={color}
      paddingHorizontal="$3"
      paddingVertical="$1"
      borderRadius="$2"
    >
      <Text color="white" fontSize="$2" fontWeight="600">
        {label}
      </Text>
    </YStack>
  );
}

function TipItem({ icon, text }: { icon: string; text: string }) {
  const { primary } = useAppColors();
  return (
    <XStack alignItems="flex-start" gap="$2">
      <Ionicons name={icon as any} size={18} color={primary} style={{ marginTop: 2 }} />
      <Text color="$gray8" fontSize="$3" flex={1}>
        {text}
      </Text>
    </XStack>
  );
}
